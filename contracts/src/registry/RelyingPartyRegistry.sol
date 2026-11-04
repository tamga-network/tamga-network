// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {TamgaRegistryBase} from "../base/TamgaRegistryBase.sol";
import {IRelyingPartyRegistry} from "../interfaces/IRelyingPartyRegistry.sol";

/**
 * @title  RelyingPartyRegistry
 * @notice Katman 2 — doğrulayıcı (verifier) kayıtları ve aşırı istek koruması.
 * @dev    SPEC-BC-0001 §6, ADR-0073 K4 (CE4).
 *
 *         Kimlik `rpId = keccak256(utf8(dns_name))` (ADR-0034 CI3/CI4): kayıt kurumu hesaplar, erişim sertifikası
 *         yenilenince değişmez; bir parmak izi aynı anda yalnız bir doğrulayıcıya aittir. Kaba `allowedScopes` kalktı
 *         (SPEC-BC-0001 §14 açık konu 3 kapandı): her kullanım bir kapsam kaydıdır — hizmet, tür, biçim, ad alanı, öğe
 *         özetleri, geçerlilik ve ayrıntı özeti. Cüzdan "bu doğrulayıcı bu hizmette bu türün bu öğesini şu anda isteyebilir mi"
 *         diye sorar (`mayRequest`).
 */
contract RelyingPartyRegistry is TamgaRegistryBase, IRelyingPartyRegistry {
    /// @notice Doğrulayıcı başına kapsam ve kapsam başına öğe tavanları (ADR-0073 açık soru 6: başlangıç değeri).
    uint256 public constant MAX_SCOPES = 32;
    uint256 public constant MAX_ATTRIBUTES = 64;
    /// @notice ADR-0074 K2 dizi tavanları (aracı / hizmet verilen doğrulayıcı, kapı grubu, politika, kapı sertifikası).
    uint256 public constant MAX_LINKED = 32;
    uint256 public constant MAX_TERMINAL_GROUPS = 32;
    uint256 public constant MAX_GROUP_POLICIES = 16;
    uint256 public constant MAX_GROUP_CERTIFICATES = 32;

    mapping(bytes32 => RelyingParty) private _rps;
    mapping(bytes2 => bytes32[]) private _byState;
    /// @dev erişim sertifikası parmak izi => rpId (CE4: bir parmak izi tek doğrulayıcı)
    mapping(bytes32 => bytes32) private _certOwner;
    mapping(bytes32 => RequestScope[]) private _scopes;
    /// @dev rpId => scopeHash => 1 tabanlı dizin (0 = yok)
    mapping(bytes32 => mapping(bytes32 => uint256)) private _scopeIndex;
    /// @dev ADR-0074 K2
    mapping(bytes32 => RelyingPartyProfile) private _profiles;
    mapping(bytes32 => TerminalGroup) private _groups; // groupId => grup
    mapping(bytes32 => bytes32) private _groupOwner; // groupId => rpId (TG1: ağda tek)
    mapping(bytes32 => bytes32[]) private _groupsOf; // rpId => groupId'ler

    uint256[40] private __gap;

    function initialize(address sovereignty_, address governance_) external initializer {
        __TamgaRegistryBase_init(sovereignty_, governance_);
    }

    function registerRelyingParty(RelyingParty calldata data) external onlyOwnerState(data.stateCode) {
        if (data.status != RPStatus.ACTIVE) revert MustRegisterAsActive();
        if (data.rpId == bytes32(0)) revert EmptyRpId();
        if (data.accessCertFingerprint == bytes32(0)) revert EmptyContentHash();
        if (_rps[data.rpId].status != RPStatus.NONE) revert RPExists(data.rpId);
        bytes32 owner = _certOwner[data.accessCertFingerprint];
        if (owner != bytes32(0)) revert CertificateInUse(data.accessCertFingerprint, owner);

        RelyingParty storage r = _rps[data.rpId];
        r.rpId = data.rpId;
        r.stateCode = data.stateCode;
        r.nameHash = data.nameHash;
        r.accessCertFingerprint = data.accessCertFingerprint;
        r.status = RPStatus.ACTIVE;
        r.registeredAt = _effectiveDate(data.registeredAt); // ADR-0073 K1
        _certOwner[data.accessCertFingerprint] = data.rpId;

        _byState[data.stateCode].push(data.rpId);
        emit RelyingPartyRegistered(data.rpId, data.stateCode);
    }

    /// @inheritdoc IRelyingPartyRegistry
    function updateAccessCertificate(bytes32 rpId, bytes32 newFingerprint) external {
        RelyingParty storage r = _require(rpId);
        _requireOwner(r.stateCode);
        if (r.status == RPStatus.REVOKED) revert RelyingPartyNotActive(rpId);
        if (newFingerprint == bytes32(0)) revert EmptyContentHash();
        bytes32 owner = _certOwner[newFingerprint];
        if (owner != bytes32(0)) revert CertificateInUse(newFingerprint, owner);
        bytes32 prev = r.accessCertFingerprint;
        delete _certOwner[prev];
        _certOwner[newFingerprint] = rpId;
        r.accessCertFingerprint = newFingerprint;
        emit AccessCertificateUpdated(rpId, prev, newFingerprint);
    }

    function suspendRelyingParty(bytes32 rpId) external {
        RelyingParty storage r = _require(rpId);
        _requireOwner(r.stateCode);
        // yalnız ACTIVE askıya alınır; iptal edilmiş kayıt geri yazılamaz (2026-10-19 güvenlik turu F-18)
        if (r.status != RPStatus.ACTIVE) revert RelyingPartyNotActive(rpId);
        r.status = RPStatus.SUSPENDED;
        emit RelyingPartySuspended(rpId);
    }

    /// @inheritdoc IRelyingPartyRegistry
    function reinstateRelyingParty(bytes32 rpId) external {
        RelyingParty storage r = _require(rpId);
        _requireOwner(r.stateCode);
        if (r.status != RPStatus.SUSPENDED) revert RelyingPartyNotSuspended(rpId);
        r.status = RPStatus.ACTIVE;
        emit RelyingPartyReinstated(rpId);
    }

    function revokeRelyingParty(bytes32 rpId) external {
        RelyingParty storage r = _require(rpId);
        _requireOwner(r.stateCode);
        if (r.status == RPStatus.REVOKED) revert AlreadyRevoked(rpId);
        r.status = RPStatus.REVOKED;
        emit RelyingPartyRevoked(rpId);
    }

    /// @inheritdoc IRelyingPartyRegistry
    function setRequestScope(bytes32 rpId, RequestScope calldata scope) external {
        RelyingParty storage r = _require(rpId);
        _requireOwner(r.stateCode);
        if (r.status == RPStatus.REVOKED) revert RelyingPartyNotActive(rpId);
        if (
            scope.scopeHash == bytes32(0) || scope.serviceHash == bytes32(0) || scope.schemaId == bytes32(0)
                || (scope.validUntil != 0 && scope.validUntil <= scope.validFrom)
        ) revert InvalidScope(scope.scopeHash);
        uint256 n = scope.attributes.length;
        if (n == 0) revert InvalidScope(scope.scopeHash);
        if (n > MAX_ATTRIBUTES) revert TooManyAttributes(n, MAX_ATTRIBUTES);
        for (uint256 k = 1; k < n; k++) {
            if (scope.attributes[k] <= scope.attributes[k - 1]) revert AttributesNotSorted();
        }

        uint256 idx = _scopeIndex[rpId][scope.scopeHash];
        if (idx == 0) {
            RequestScope[] storage list = _scopes[rpId];
            if (list.length >= MAX_SCOPES) revert TooManyScopes(list.length + 1, MAX_SCOPES);
            list.push(scope);
            _scopeIndex[rpId][scope.scopeHash] = list.length;
        } else {
            _scopes[rpId][idx - 1] = scope;
        }
        emit RequestScopeSet(rpId, scope.scopeHash, scope.schemaId, scope.format, scope.validFrom, scope.validUntil);
    }

    /// @inheritdoc IRelyingPartyRegistry
    function closeRequestScope(bytes32 rpId, bytes32 scopeHash, uint64 at) external {
        RelyingParty storage r = _require(rpId);
        _requireOwner(r.stateCode);
        uint256 idx = _scopeIndex[rpId][scopeHash];
        if (idx == 0) revert UnknownScope(rpId, scopeHash);
        RequestScope storage s = _scopes[rpId][idx - 1];
        uint64 t = _effectiveDate(at);
        // aralık yalnız daralır (genişlemez); başlamadan kapatılan kapsamın aralığı boştur
        if (s.validUntil != 0 && s.validUntil <= t) revert InvalidScope(scopeHash);
        s.validUntil = t;
        emit RequestScopeClosed(rpId, scopeHash, t);
    }

    /// @inheritdoc IRelyingPartyRegistry
    function setRelyingPartyProfile(bytes32 rpId, RelyingPartyProfile calldata profile) external {
        RelyingParty storage r = _require(rpId);
        _requireOwner(r.stateCode);
        if (profile.intermediaries.length > MAX_LINKED) revert TooManyEntries(profile.intermediaries.length, MAX_LINKED);
        if (profile.servedParties.length > MAX_LINKED) revert TooManyEntries(profile.servedParties.length, MAX_LINKED);
        _profiles[rpId] = profile;
        emit RelyingPartyProfileSet(rpId, profile.registrationHash);
    }

    /// @inheritdoc IRelyingPartyRegistry
    function setTerminalGroup(bytes32 rpId, TerminalGroup calldata group) external {
        RelyingParty storage r = _require(rpId);
        _requireOwner(r.stateCode);
        if (r.status == RPStatus.REVOKED) revert RelyingPartyNotActive(rpId);
        // TG1: etkin grup bir kuruma ve en az bir kapı politikasına bağlıdır
        if (
            group.groupId == bytes32(0) || group.institutionId == bytes32(0) || group.policyIds.length == 0
                || (group.validUntil != 0 && group.validUntil <= group.validFrom)
        ) revert InvalidTerminalGroup(group.groupId);
        if (group.policyIds.length > MAX_GROUP_POLICIES) {
            revert TooManyEntries(group.policyIds.length, MAX_GROUP_POLICIES);
        }
        if (group.certFingerprints.length > MAX_GROUP_CERTIFICATES) {
            revert TooManyEntries(group.certFingerprints.length, MAX_GROUP_CERTIFICATES);
        }
        bytes32 owner = _groupOwner[group.groupId];
        if (owner == bytes32(0)) {
            bytes32[] storage mine = _groupsOf[rpId];
            if (mine.length >= MAX_TERMINAL_GROUPS) revert TooManyEntries(mine.length + 1, MAX_TERMINAL_GROUPS);
            mine.push(group.groupId);
            _groupOwner[group.groupId] = rpId;
        } else if (owner != rpId) {
            revert TerminalGroupOwnedByOther(group.groupId, owner);
        }
        _groups[group.groupId] = group;
        emit TerminalGroupSet(rpId, group.groupId, group.institutionId, group.validFrom, group.validUntil);
    }

    /// @inheritdoc IRelyingPartyRegistry
    function closeTerminalGroup(bytes32 rpId, bytes32 groupId, uint64 at) external {
        RelyingParty storage r = _require(rpId);
        _requireOwner(r.stateCode);
        if (_groupOwner[groupId] != rpId) revert UnknownTerminalGroup(groupId);
        TerminalGroup storage g = _groups[groupId];
        uint64 t = _effectiveDate(at);
        if (g.validUntil != 0 && g.validUntil <= t) revert InvalidTerminalGroup(groupId);
        g.validUntil = t;
        emit TerminalGroupClosed(rpId, groupId, t);
    }

    function relyingPartyProfileOf(bytes32 rpId) external view returns (RelyingPartyProfile memory) {
        return _profiles[rpId];
    }

    function terminalGroupOf(bytes32 groupId) external view returns (bytes32 rpId, TerminalGroup memory group) {
        return (_groupOwner[groupId], _groups[groupId]);
    }

    function terminalGroupsOf(bytes32 rpId) external view returns (bytes32[] memory) {
        return _groupsOf[rpId];
    }

    /// @inheritdoc IRelyingPartyRegistry
    function isActiveTerminalCertificate(bytes32 groupId, bytes32 certFingerprint) external view returns (bool) {
        bytes32 rpId = _groupOwner[groupId];
        if (rpId == bytes32(0) || _rps[rpId].status != RPStatus.ACTIVE) return false;
        TerminalGroup storage g = _groups[groupId];
        uint64 now_ = uint64(block.timestamp);
        if (now_ < g.validFrom || (g.validUntil != 0 && now_ >= g.validUntil)) return false;
        for (uint256 i = 0; i < g.certFingerprints.length; i++) {
            if (g.certFingerprints[i] == certFingerprint) return true;
        }
        return false;
    }

    function isValidRelyingParty(bytes32 rpId) external view returns (bool) {
        return _rps[rpId].status == RPStatus.ACTIVE;
    }

    function rpIdOfCertificate(bytes32 fingerprint) external view returns (bytes32) {
        return _certOwner[fingerprint];
    }

    /// @inheritdoc IRelyingPartyRegistry
    function mayRequest(
        bytes32 rpId,
        bytes32 serviceHash,
        bytes32 schemaId,
        PresentationFormat format,
        bytes32 namespaceHash,
        bytes32 attribute
    ) external view returns (bool) {
        if (_rps[rpId].status != RPStatus.ACTIVE) return false;
        RequestScope[] storage list = _scopes[rpId];
        uint64 now_ = uint64(block.timestamp);
        for (uint256 i = 0; i < list.length; i++) {
            RequestScope storage s = list[i];
            if (s.serviceHash != serviceHash || s.schemaId != schemaId || s.format != format) continue;
            if (s.namespaceHash != namespaceHash) continue;
            if (now_ < s.validFrom || (s.validUntil != 0 && now_ >= s.validUntil)) continue;
            if (_contains(s.attributes, attribute)) return true;
        }
        return false;
    }

    /// @dev Kesin artan dizide ikili arama.
    function _contains(bytes32[] storage xs, bytes32 x) private view returns (bool) {
        uint256 lo = 0;
        uint256 hi = xs.length;
        while (lo < hi) {
            uint256 mid = (lo + hi) / 2;
            bytes32 v = xs[mid];
            if (v == x) return true;
            if (v < x) lo = mid + 1;
            else hi = mid;
        }
        return false;
    }

    function requestScopesOf(bytes32 rpId) external view returns (RequestScope[] memory) {
        return _scopes[rpId];
    }

    function getRelyingParty(bytes32 rpId) external view returns (RelyingParty memory) {
        RelyingParty memory r = _rps[rpId];
        if (r.status == RPStatus.NONE) revert UnknownRP(rpId);
        return r;
    }

    function getRelyingPartiesByState(bytes2 stateCode) external view returns (bytes32[] memory) {
        return _byState[stateCode];
    }

    function _require(bytes32 rpId) private view returns (RelyingParty storage r) {
        r = _rps[rpId];
        if (r.status == RPStatus.NONE) revert UnknownRP(rpId);
    }

    /// @dev SPEC-BC-0001 §3.1/§2/§6 `onlyOwnerState(_stateOf(id))`: delege denetimi + günlük kota (§12.2).
    function _requireOwner(bytes2 stateCode) private {
        _requireOwnerAndCount(stateCode);
    }
}
