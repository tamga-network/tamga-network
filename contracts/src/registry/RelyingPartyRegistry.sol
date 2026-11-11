// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {TamgaRegistryBase} from "../base/TamgaRegistryBase.sol";
import {IRelyingPartyRegistry} from "../interfaces/IRelyingPartyRegistry.sol";
import {IIssuerRegistry} from "../interfaces/IIssuerRegistry.sol";
import {StatusHistory} from "../base/StatusHistory.sol";

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
 *
 *         ADR-0075 — kayıt dönemleri: ilk kayıt dönem 0'dır. Kimliğin sahibi devlet (devir) ya da iptal edilmiş kimliğin
 *         yeniden kaydı yalnız Governance'ın türü belli önerisiyle (2/3) değişir: içerik önce `stagePeriodChange` ile sabitlenir,
 *         öneri yalnız `stageId`'yi taşır, yürütme `commitPeriodChange`'i çağırır (NetworkRegistry deseni). Yeni dönem kaydı
 *         ACTIVE açar; kapsamlar, kayıt verisi ve kapı grubu listesi döneme göre ayrı tutulur (eski dönemin kayıtları silinmez,
 *         yeni dönem devralmaz), eski dönemin açık kapı grupları kapanır. Durum geçmişi bütün dönemler boyunca yalnız eklenir;
 *         `relyingPartyAt` ve `isRelyingPartyAcceptableAt` `t` anındaki döneme göre cevap verir.
 */
contract RelyingPartyRegistry is TamgaRegistryBase, IRelyingPartyRegistry {
    using StatusHistory for StatusHistory.Change[];

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
    // Yanlış alarm: eşleme setTerminalGroup'ta depolama göstericisiyle (`mine.push`) yazılır.
    // slither-disable-next-line uninitialized-state
    mapping(bytes32 => bytes32[]) private _groupsOf; // rpId => groupId'ler
    /// @dev Güvenlik turu 2026-11-04: kapı grubunun kurum bağı (`institutionId` = issuerId) bu kayıttan doğrulanır.
    IIssuerRegistry public issuerRegistry;
    /// @dev ADR-0075: durum geçmişi (bütün dönemler), kayıt dönemleri ve sabitlenmiş dönem değişiklikleri.
    mapping(bytes32 => StatusHistory.Change[]) private _history;
    mapping(bytes32 => RegistrationPeriod[]) private _periods;
    mapping(bytes32 => PeriodChange) private _stagedChanges;
    mapping(bytes32 => uint32) private _stagedBase;

    uint256[35] private __gap;

    function initialize(address sovereignty_, address governance_, address issuerRegistry_) external initializer {
        __TamgaRegistryBase_init(sovereignty_, governance_);
        if (issuerRegistry_ == address(0)) revert ZeroAddress();
        issuerRegistry = IIssuerRegistry(issuerRegistry_);
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
        uint64 since = _effectiveDate(data.registeredAt); // ADR-0073 K1
        r.registeredAt = since;
        _certOwner[data.accessCertFingerprint] = data.rpId;
        _periods[data.rpId].push(RegistrationPeriod(data.stateCode, since));
        _history[data.rpId].record(since, uint8(RPStatus.ACTIVE));

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
        _suspend(rpId, 0);
    }

    /// @inheritdoc IRelyingPartyRegistry
    function suspendRelyingPartyAt(bytes32 rpId, uint64 at) external {
        _suspend(rpId, at);
    }

    /// @inheritdoc IRelyingPartyRegistry
    function reinstateRelyingParty(bytes32 rpId) external {
        _reinstate(rpId, 0);
    }

    /// @inheritdoc IRelyingPartyRegistry
    function reinstateRelyingPartyAt(bytes32 rpId, uint64 at) external {
        _reinstate(rpId, at);
    }

    function revokeRelyingParty(bytes32 rpId) external {
        _revoke(rpId, 0);
    }

    /// @inheritdoc IRelyingPartyRegistry
    function revokeRelyingPartyAt(bytes32 rpId, uint64 at) external {
        _revoke(rpId, at);
    }

    function _suspend(bytes32 rpId, uint64 at) private {
        RelyingParty storage r = _require(rpId);
        _requireOwner(r.stateCode);
        // yalnız ACTIVE askıya alınır; iptal edilmiş kayıt geri yazılamaz (2026-10-19 güvenlik turu F-18)
        if (r.status != RPStatus.ACTIVE) revert RelyingPartyNotActive(rpId);
        _setStatus(rpId, r, RPStatus.SUSPENDED, _effectiveDate(at));
        emit RelyingPartySuspended(rpId);
    }

    function _reinstate(bytes32 rpId, uint64 at) private {
        RelyingParty storage r = _require(rpId);
        _requireOwner(r.stateCode);
        if (r.status != RPStatus.SUSPENDED) revert RelyingPartyNotSuspended(rpId);
        _setStatus(rpId, r, RPStatus.ACTIVE, _effectiveDate(at));
        emit RelyingPartyReinstated(rpId);
    }

    function _revoke(bytes32 rpId, uint64 at) private {
        RelyingParty storage r = _require(rpId);
        _requireOwner(r.stateCode);
        if (r.status == RPStatus.REVOKED) revert AlreadyRevoked(rpId);
        _setStatus(rpId, r, RPStatus.REVOKED, _effectiveDate(at));
        emit RelyingPartyRevoked(rpId);
    }

    /// @dev Durum `since` anından itibaren geçerli (ADR-0073 K1/K5): olağan yazımda blok zamanı, göç kipinde listedeki an;
    ///      geçmiş kayıt başına sıralı ve yalnız eklenir (`StatusOutOfOrder`).
    function _setStatus(bytes32 rpId, RelyingParty storage r, RPStatus st, uint64 since) private {
        r.status = st;
        _history[rpId].record(since, uint8(st));
    }

    // -----------------------------------------------------------------
    // ADR-0075 — devir ve iptal sonrası yeniden kayıt (yalnız Governance oyuyla)
    // -----------------------------------------------------------------

    /// @inheritdoc IRelyingPartyRegistry
    function periodChangeIdOf(PeriodChange calldata change) public view returns (bytes32) {
        return keccak256(abi.encode(change, uint32(_periods[change.rpId].length)));
    }

    /// @inheritdoc IRelyingPartyRegistry
    function stagePeriodChange(PeriodChange calldata change) external returns (bytes32 stageId) {
        if (
            change.action == PeriodAction.NONE || change.rpId == bytes32(0) || change.toState == bytes2(0)
                || change.nameHash == bytes32(0) || change.accessCertFingerprint == bytes32(0)
                || change.reasonHash == bytes32(0)
        ) revert InvalidPeriodChange(change.rpId);
        // Kontrol 2026-11-10: yalnız KAYITLI kimlik için sabitlenir (devir de yeniden kayıt da var olan kaydın üstünedir);
        // kayıtsız kimlik için yayılan olay, olayı izleyen indeksleyicileri olmayan kaydı okumaya yöneltiyordu.
        _require(change.rpId);
        uint32 base = uint32(_periods[change.rpId].length);
        stageId = periodChangeIdOf(change);
        _stagedChanges[stageId] = change;
        _stagedBase[stageId] = base;
        emit PeriodChangeStaged(stageId, change.rpId, change.action, base);
    }

    /// @inheritdoc IRelyingPartyRegistry
    function commitPeriodChange(bytes32 stageId, PeriodAction action) external onlyGovernance {
        PeriodChange memory c = _stagedChanges[stageId];
        if (c.action == PeriodAction.NONE || c.action != action) revert UnknownPeriodChange(stageId);
        RelyingParty storage r = _require(c.rpId);
        RegistrationPeriod[] storage periods = _periods[c.rpId];
        uint32 cur = uint32(periods.length);
        uint32 base = _stagedBase[stageId];
        if (cur != base) revert StalePeriodChange(stageId, base, cur);
        bool revoked = r.status == RPStatus.REVOKED;
        // Devir: iptal edilmemiş kayıt başka devlete; yeniden kayıt: yalnız iptal edilmiş kayıt (aynı ya da başka devlet).
        if (
            r.stateCode != c.fromState
                || (action == PeriodAction.REASSIGNMENT ? (revoked || c.toState == c.fromState) : !revoked)
                || !sovereignty.isActiveMember(c.toState)
        ) revert InvalidPeriodChange(c.rpId);
        bytes32 owner = _certOwner[c.accessCertFingerprint];
        if (owner != bytes32(0) && owner != c.rpId) revert CertificateInUse(c.accessCertFingerprint, owner);
        delete _stagedChanges[stageId];
        delete _stagedBase[stageId];

        uint64 now_ = uint64(block.timestamp);
        _closeOpenGroups(c.rpId, _periodKey(c.rpId), now_); // eski dönemin kapı grupları yeni sahibe geçmez
        bool known = false;
        for (uint256 i = 0; i < cur; i++) {
            if (periods[i].stateCode == c.toState) known = true;
        }
        if (!known) _byState[c.toState].push(c.rpId);

        delete _certOwner[r.accessCertFingerprint];
        _certOwner[c.accessCertFingerprint] = c.rpId;
        r.stateCode = c.toState;
        r.nameHash = c.nameHash;
        r.accessCertFingerprint = c.accessCertFingerprint;
        r.registeredAt = now_;
        _setStatus(c.rpId, r, RPStatus.ACTIVE, now_); // dönem değişikliğinin tarihi yürütme anıdır (ADR-0075 açık soru 3)
        periods.push(RegistrationPeriod(c.toState, now_));

        if (action == PeriodAction.REASSIGNMENT) {
            emit RelyingPartyReassigned(c.rpId, c.fromState, c.toState, cur, c.reasonHash);
        } else {
            emit RelyingPartyReRegistered(c.rpId, c.toState, cur, c.reasonHash);
        }
    }

    /// @dev Dönemin açık kapı gruplarını `t` anında kapatır (dönem başına en çok MAX_TERMINAL_GROUPS).
    function _closeOpenGroups(bytes32 rpId, bytes32 key, uint64 t) private {
        bytes32[] storage ids = _groupsOf[key];
        for (uint256 i = 0; i < ids.length; i++) {
            TerminalGroup storage g = _groups[ids[i]];
            if (g.validUntil == 0 || g.validUntil > t) {
                g.validUntil = t;
                emit TerminalGroupClosed(rpId, ids[i], t);
            }
        }
    }

    /// @dev Dönem anahtarı: dönem 0'da rpId'nin kendisi, sonraki dönemlerde keccak256(rpId, dönem). Kapsamlar, kayıt verisi ve
    ///      kapı grubu listesi bu anahtarla tutulur: yeni dönem eskisinin kayıtlarını devralmaz, eskiler silinmez.
    function _periodKey(bytes32 rpId) private view returns (bytes32) {
        uint256 n = _periods[rpId].length;
        return n <= 1 ? rpId : keccak256(abi.encode(rpId, n - 1));
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

        bytes32 key = _periodKey(rpId);
        RequestScope[] storage list = _scopes[key];
        uint256 idx = _scopeIndex[key][scope.scopeHash];
        if (idx == 0) {
            // Kapanmış kapsamlar da yer tutar (silinmez, geçmiş zincirde kalır); tavan saha verisiyle gözden geçirilir.
            if (list.length >= MAX_SCOPES) revert TooManyScopes(list.length + 1, MAX_SCOPES);
            list.push(scope);
            _scopeIndex[key][scope.scopeHash] = list.length;
        } else {
            // Güvenlik turu 2026-11-04: kapanmış (aralığı bitmiş) kapsam aynı kimlikle sessizce yeniden açılamaz;
            // yeni kullanım yeni `scopeHash` ister.
            RequestScope storage cur = list[idx - 1];
            if (cur.validUntil != 0 && cur.validUntil <= block.timestamp) revert ScopeClosed(rpId, scope.scopeHash);
            list[idx - 1] = scope;
        }
        emit RequestScopeSet(rpId, scope.scopeHash, scope.schemaId, scope.format, scope.validFrom, scope.validUntil);
    }

    /// @inheritdoc IRelyingPartyRegistry
    function closeRequestScope(bytes32 rpId, bytes32 scopeHash, uint64 at) external {
        RelyingParty storage r = _require(rpId);
        _requireOwner(r.stateCode);
        bytes32 key = _periodKey(rpId);
        uint256 idx = _scopeIndex[key][scopeHash];
        if (idx == 0) revert UnknownScope(rpId, scopeHash);
        RequestScope storage s = _scopes[key][idx - 1];
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
        _profiles[_periodKey(rpId)] = profile;
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
        _requireInstitution(group.institutionId, rpId, r.stateCode);
        bytes32 owner = _groupOwner[group.groupId];
        if (owner == bytes32(0)) {
            // Kapanmış gruplar da yer tutar (silinmez, ADR-0074 K2); tavan saha verisiyle gözden geçirilir.
            bytes32[] storage mine = _groupsOf[_periodKey(rpId)];
            if (mine.length >= MAX_TERMINAL_GROUPS) revert TooManyEntries(mine.length + 1, MAX_TERMINAL_GROUPS);
            mine.push(group.groupId);
            _groupOwner[group.groupId] = rpId;
        } else if (owner != rpId) {
            revert TerminalGroupOwnedByOther(group.groupId, owner);
        } else {
            // Güvenlik turu 2026-11-04: geri çekilmiş (aralığı bitmiş) grup aynı kimlikle sessizce yeniden açılamaz.
            uint64 until = _groups[group.groupId].validUntil;
            if (until != 0 && until <= block.timestamp) revert TerminalGroupNotOpen(group.groupId);
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

    /// @dev Kurum bağı (ADR-0074 K2: issuerId ya da rpId) aynı devletin kayıtlı bir kurumu ya da doğrulayıcısı olmalı
    ///      (ADR-0054 NS2: devletler arası bağ yok). Güvenlik turu 2026-11-04.
    function _requireInstitution(bytes32 institutionId, bytes32 rpId, bytes2 stateCode) private view {
        if (institutionId == rpId) return;
        RelyingParty storage other = _rps[institutionId];
        if (other.status != RPStatus.NONE) {
            if (other.stateCode != stateCode) revert UnknownInstitution(institutionId);
            return;
        }
        if (issuerRegistry.stateOf(institutionId) != stateCode) revert UnknownInstitution(institutionId);
    }

    function relyingPartyProfileOf(bytes32 rpId) external view returns (RelyingPartyProfile memory) {
        return _profiles[_periodKey(rpId)];
    }

    function terminalGroupOf(bytes32 groupId) external view returns (bytes32 rpId, TerminalGroup memory group) {
        return (_groupOwner[groupId], _groups[groupId]);
    }

    function terminalGroupsOf(bytes32 rpId) external view returns (bytes32[] memory) {
        return _groupsOf[_periodKey(rpId)];
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
        RequestScope[] storage list = _scopes[_periodKey(rpId)];
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
        return _scopes[_periodKey(rpId)];
    }

    function getRelyingParty(bytes32 rpId) external view returns (RelyingParty memory) {
        RelyingParty memory r = _rps[rpId];
        if (r.status == RPStatus.NONE) revert UnknownRP(rpId);
        return r;
    }

    /// @dev ADR-0075: bir devletin sahip olduğu ya da olmuş kimlikler (yalnız eklenir); bugünkü sahip `getRelyingParty`.
    function getRelyingPartiesByState(bytes2 stateCode) external view returns (bytes32[] memory) {
        return _byState[stateCode];
    }

    /// @inheritdoc IRelyingPartyRegistry
    function stagedPeriodChangeOf(bytes32 stageId) external view returns (PeriodChange memory, uint32) {
        return (_stagedChanges[stageId], _stagedBase[stageId]);
    }

    function registrationPeriodsOf(bytes32 rpId) external view returns (RegistrationPeriod[] memory) {
        return _periods[rpId];
    }

    /// @inheritdoc IRelyingPartyRegistry
    function relyingPartyAt(bytes32 rpId, uint64 t)
        external
        view
        returns (RPStatus status, bytes2 stateCode, uint32 period)
    {
        status = RPStatus(_history[rpId].statusAt(t));
        if (status == RPStatus.NONE) return (status, bytes2(0), 0);
        RegistrationPeriod[] storage ps = _periods[rpId];
        for (uint256 i = ps.length; i > 0; i--) {
            if (ps[i - 1].since <= t) return (status, ps[i - 1].stateCode, uint32(i - 1));
        }
    }

    /// @inheritdoc IRelyingPartyRegistry
    function isRelyingPartyAcceptableAt(bytes32 rpId, uint64 t) external view returns (bool) {
        return RPStatus(_history[rpId].statusAt(t)) == RPStatus.ACTIVE;
    }

    function relyingPartyStatusHistoryOf(bytes32 rpId) external view returns (StatusHistory.Change[] memory) {
        return _history[rpId];
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
