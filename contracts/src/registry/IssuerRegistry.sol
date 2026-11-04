// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {TamgaRegistryBase} from "../base/TamgaRegistryBase.sol";
import {IIssuerRegistry} from "../interfaces/IIssuerRegistry.sol";
import {IRootCARegistry} from "../interfaces/IRootCARegistry.sol";
import {ISchemaRegistry} from "../interfaces/ISchemaRegistry.sol";
import {StatusHistory} from "../base/StatusHistory.sol";

/**
 * @title  IssuerRegistry
 * @notice Katman 2 — ulusal issuer kayıtları. YAZMA yalnızca ilgili devlet,
 *         OYLAMA YOK (ADR-0002).
 *
 * @dev    SPEC-BC-0001 §3.
 *
 *         Değişmez I1 — ALLOWLIST: şema yetkisi varsayılan olarak YOKTUR.
 *         Bu, PM-SCHEMA-0001 Zafiyet 1'i (kategori aşımı) kapatır: EDUCATION
 *         kategorili bir üniversite sağlık şemasıyla belge imzalasa bile,
 *         yetkilendirilmediği için hiçbir uyumlu verifier kabul etmez.
 *
 *         Yumuşak iptal (§3.3): REVOKED bir issuer'ın validUntil'e kadar
 *         verdiği credential'lar GEÇERLİ KALIR. isValidIssuer yalnızca
 *         "YENİ credential verebilir mi" sorusunu cevaplar.
 *
 *         ADR-0073 K5 (2026-11-04): doğrulama (C1/C2) belgenin `iat` anındaki duruma
 *         bakar; durum pencereleri yalnız eklenir ve yarı açıktır. Askıdan önce
 *         verilmiş belge geçerlidir (liste kuralı).
 */
contract IssuerRegistry is TamgaRegistryBase, IIssuerRegistry {
    using StatusHistory for StatusHistory.Change[];

    uint256 public constant MAX_DELEGATES = 16;

    IRootCARegistry public rootCARegistry;
    ISchemaRegistry public schemaRegistry;

    mapping(bytes32 => Issuer) private _issuers;
    mapping(bytes2 => bytes32[]) private _byState;
    mapping(bytes32 => address[]) private _delegates;
    mapping(bytes32 => mapping(address => bool)) private _isDelegate;

    /// @dev issuerId => schemaId => yetki penceresi (I1: varsayılan allowed=false)
    mapping(bytes32 => mapping(bytes32 => SchemaAuth)) private _schemaAuth;
    mapping(bytes32 => bytes32[]) private _authList;

    /// @dev I3: kapanmış eski yetki pencereleri. Yeniden yetkilendirme güncel pencereyi ezmeden önce eskisi buraya
    ///      eklenir; aksi hâlde ilk pencerede verilmiş belgeler C2'de düşerdi. 2026-10-19 güvenlik turu.
    mapping(bytes32 => mapping(bytes32 => SchemaAuth[])) private _pastAuth;

    /// @dev ADR-0073 K5: issuerId => durum pencereleri (yalnız eklenir).
    mapping(bytes32 => StatusHistory.Change[]) private _history;
    /// @dev ADR-0073 K2: issuerId => sert iptal başlangıcı (0 = yok).
    mapping(bytes32 => uint64) private _invalidatesFrom;
    /// @dev ADR-0074 K2: issuerId => sınıf ve kayıt verisi özetleri.
    mapping(bytes32 => IssuerProfile) private _profiles;

    uint256[38] private __gap;

    function initialize(
        address sovereignty_,
        address governance_,
        address rootCARegistry_,
        address schemaRegistry_
    ) external initializer {
        __TamgaRegistryBase_init(sovereignty_, governance_);
        if (rootCARegistry_ == address(0) || schemaRegistry_ == address(0)) revert ZeroAddress();
        rootCARegistry = IRootCARegistry(rootCARegistry_);
        schemaRegistry = ISchemaRegistry(schemaRegistry_);
    }

    // -----------------------------------------------------------------
    // Kayıt
    // -----------------------------------------------------------------

    /// @inheritdoc IIssuerRegistry
    function registerIssuer(Issuer calldata data) external onlyOwnerState(data.stateCode) {
        if (data.status != IssuerStatus.ACTIVE) revert MustRegisterAsActive();
        if (data.validUntil <= data.validFrom) revert InvalidValidity(data.validFrom, data.validUntil);
        if (data.certFingerprint == bytes32(0)) revert EmptyContentHash();
        if (!rootCARegistry.exists(data.parentCA)) revert UnknownRootCA(data.parentCA);
        if (!rootCARegistry.isValidRootCA(data.parentCA)) revert RootCANotActive(data.parentCA); // CA3
        // ADR-0054 NS2: kurum yalnız kendi devletinin kök sertifikasına bağlanır
        bytes2 caState = rootCARegistry.getRootCA(data.parentCA).stateCode;
        if (caState != data.stateCode) revert CrossStateReference(data.parentCA, caState);

        bytes32 issuerId = keccak256(abi.encodePacked(data.stateCode, data.certFingerprint));
        if (_issuers[issuerId].status != IssuerStatus.NONE) revert IssuerExists(issuerId);
        // ADR-0073 K1: kayıt anı göç kipinde açık tarihle; kip dışında blok zamanı (registeredAt verilmez)
        uint64 registeredAt = _effectiveDate(data.registeredAt);

        Issuer storage i = _issuers[issuerId];
        i.issuerId = issuerId;
        i.stateCode = data.stateCode;
        i.nameHash = data.nameHash;
        i.category = data.category;
        i.assurance = data.assurance;
        i.certFingerprint = data.certFingerprint;
        i.parentCA = data.parentCA;
        i.metadataURI = data.metadataURI;
        i.status = IssuerStatus.ACTIVE;
        i.validFrom = data.validFrom == 0 ? uint64(block.timestamp) : data.validFrom;
        i.validUntil = data.validUntil;
        i.registeredAt = registeredAt;
        // Kip dışında ilk ACTIVE penceresi başlangıçsızdır (since = 0; geçerlilik validFrom'dan); göçte listedeki ilk durum anı.
        _history[issuerId].record(data.registeredAt == 0 ? 0 : registeredAt, uint8(IssuerStatus.ACTIVE));

        _byState[data.stateCode].push(issuerId);
        emit IssuerRegistered(issuerId, data.stateCode, data.category);
    }

    function suspendIssuer(bytes32 issuerId) external {
        _suspend(issuerId, 0);
    }

    function suspendIssuerAt(bytes32 issuerId, uint64 at) external {
        _suspend(issuerId, at);
    }

    function reinstateIssuer(bytes32 issuerId) external {
        _reinstate(issuerId, 0);
    }

    function reinstateIssuerAt(bytes32 issuerId, uint64 at) external {
        _reinstate(issuerId, at);
    }

    /**
     * @notice Kurumu kapatır ve isteğe bağlı olarak halefini işaret eder.
     * @dev    YUMUŞAK: iptalden önce verdiği credential'lar validUntil'e kadar geçerli kalır.
     *         Bakanlık kapanınca diplomalar çöp olmaz (ADR-0002 #4).
     */
    function revokeIssuer(bytes32 issuerId, bytes32 successorId) external {
        _revoke(issuerId, successorId, 0);
    }

    function revokeIssuerAt(bytes32 issuerId, bytes32 successorId, uint64 at) external {
        _revoke(issuerId, successorId, at);
    }

    /// @inheritdoc IIssuerRegistry
    function retireIssuer(bytes32 issuerId, bytes32 successorId, uint64 at) external {
        _revoke(issuerId, successorId, at);
        emit IssuerRetired(issuerId, successorId);
    }

    function _suspend(bytes32 issuerId, uint64 at) private {
        Issuer storage i = _require(issuerId);
        _requireOwner(i.stateCode);
        if (i.status != IssuerStatus.ACTIVE) revert UnknownIssuer(issuerId);
        _setStatus(issuerId, i, IssuerStatus.SUSPENDED, at);
        emit IssuerSuspended(issuerId);
    }

    function _reinstate(bytes32 issuerId, uint64 at) private {
        Issuer storage i = _require(issuerId);
        _requireOwner(i.stateCode);
        if (i.status != IssuerStatus.SUSPENDED) revert UnknownIssuer(issuerId);
        _setStatus(issuerId, i, IssuerStatus.ACTIVE, at);
        emit IssuerReinstated(issuerId);
    }

    function _revoke(bytes32 issuerId, bytes32 successorId, uint64 at) private {
        Issuer storage i = _require(issuerId);
        _requireOwner(i.stateCode);
        if (i.status == IssuerStatus.REVOKED) revert AlreadyRevoked(issuerId);
        if (successorId == issuerId) revert InvalidSuccessor(successorId);
        if (successorId != bytes32(0)) {
            Issuer storage s = _issuers[successorId];
            if (s.status != IssuerStatus.ACTIVE) revert SuccessorNotActive(successorId);
            // ADR-0054 NS2: halef aynı devletin kurumu olmalı (aksi hâlde başka devletin anahtarları öncülün listelerini yönetir)
            if (s.stateCode != i.stateCode) revert CrossStateReference(successorId, s.stateCode);
        }
        i.successorId = successorId;
        i.revokedAt = _setStatus(issuerId, i, IssuerStatus.REVOKED, at); // yumuşak iptalin zaman sınırı
        emit IssuerRevoked(issuerId, successorId);
    }

    /// @dev ADR-0073 K1/K5: durum değişikliği `since` anından itibaren geçerli; geçmiş sıralı ve yalnız eklenir.
    function _setStatus(bytes32 issuerId, Issuer storage i, IssuerStatus st, uint64 at) private returns (uint64 since) {
        since = _effectiveDate(at);
        _history[issuerId].record(since, uint8(st));
        i.status = st;
        emit IssuerStatusChanged(issuerId, st, since);
    }

    /// @inheritdoc IIssuerRegistry
    function setIssuerInvalidatesFrom(bytes32 issuerId, uint64 invalidatesFrom) external {
        Issuer storage i = _require(issuerId);
        _requireOwner(i.stateCode);
        uint64 cur = _invalidatesFrom[issuerId];
        if (
            i.status != IssuerStatus.REVOKED || invalidatesFrom < i.validFrom || invalidatesFrom > i.revokedAt
                || (cur != 0 && invalidatesFrom >= cur)
        ) revert InvalidInvalidatesFrom(invalidatesFrom);
        _invalidatesFrom[issuerId] = invalidatesFrom;
        emit IssuerInvalidatedFrom(issuerId, invalidatesFrom);
    }

    function invalidatesFromOf(bytes32 issuerId) external view returns (uint64) {
        return _invalidatesFrom[issuerId];
    }

    /// @inheritdoc IIssuerRegistry
    function setIssuerProfile(bytes32 issuerId, IssuerProfile calldata profile) external {
        Issuer storage i = _require(issuerId);
        _requireOwner(i.stateCode);
        _profiles[issuerId] = profile;
        emit IssuerProfileSet(issuerId, profile.issuerClass, profile.registrationHash, profile.operationsHash);
    }

    function issuerProfileOf(bytes32 issuerId) external view returns (IssuerProfile memory) {
        return _profiles[issuerId];
    }

    function renewIssuer(bytes32 issuerId, uint64 newValidUntil) external {
        Issuer storage i = _require(issuerId);
        _requireOwner(i.stateCode);
        if (newValidUntil <= i.validUntil) revert InvalidValidity(i.validUntil, newValidUntil);
        i.validUntil = newValidUntil;
        emit IssuerRenewed(issuerId, newValidUntil);
    }

    // -----------------------------------------------------------------
    // Issuer delegate anahtarları (rol: issuer delegate — SPEC-BC-0001 §10)
    // -----------------------------------------------------------------

    /**
     * @dev DEĞİŞMEZ R1: Bu anahtarlar YALNIZCA günlük operasyon içindir
     *      (status list yayını). Ulusal kayıtlara YAZAMAZLAR — bu fonksiyon
     *      onlyOwnerState ile korunduğu için issuer kendi delegate'ini bile
     *      atayamaz; devlet atar.
     */
    function setIssuerDelegates(bytes32 issuerId, address[] calldata keys) external {
        Issuer storage i = _require(issuerId);
        _requireOwner(i.stateCode);
        if (keys.length > MAX_DELEGATES) revert TooManyDelegates(keys.length, MAX_DELEGATES);

        address[] storage old = _delegates[issuerId];
        for (uint256 k = 0; k < old.length; k++) _isDelegate[issuerId][old[k]] = false;
        delete _delegates[issuerId];

        for (uint256 k = 0; k < keys.length; k++) {
            if (keys[k] == address(0)) revert ZeroAddress();
            _delegates[issuerId].push(keys[k]);
            _isDelegate[issuerId][keys[k]] = true;
        }
        emit IssuerDelegatesSet(issuerId, keys.length);
    }

    // -----------------------------------------------------------------
    // Şema yetkilendirmesi — ADR-0007 Karar 6
    // -----------------------------------------------------------------

    /// @inheritdoc IIssuerRegistry
    function setSchemaAuthorization(bytes32 issuerId, bytes32 schemaId, bool allowed) external {
        _setSchemaAuthorization(issuerId, schemaId, allowed, 0);
    }

    /// @inheritdoc IIssuerRegistry
    function setSchemaAuthorizationAt(bytes32 issuerId, bytes32 schemaId, bool allowed, uint64 at) external {
        _setSchemaAuthorization(issuerId, schemaId, allowed, at);
    }

    function _setSchemaAuthorization(bytes32 issuerId, bytes32 schemaId, bool allowed, uint64 at) private {
        Issuer storage i = _require(issuerId);
        _requireOwner(i.stateCode);

        SchemaAuth storage a = _schemaAuth[issuerId][schemaId];
        if (a.allowed == allowed) return;

        uint64 t = _effectiveDate(at);
        a.allowed = allowed;
        if (allowed) {
            // Yeniden yetkilendirme: kapanmış pencere geçmişe (I3); yeni pencere eskisinin kapanışından önce başlayamaz.
            if (a.since != 0) {
                if (t < a.until) revert DateOutOfOrder(a.until, t);
                _pastAuth[issuerId][schemaId].push(SchemaAuth(false, a.since, a.until));
            }
            a.since = t;
            a.until = 0;
            _authList[issuerId].push(schemaId);
        } else {
            if (t < a.since) revert DateOutOfOrder(a.since, t);
            a.until = t;
            bytes32[] storage list = _authList[issuerId];
            for (uint256 k = 0; k < list.length; k++) {
                if (list[k] == schemaId) {
                    list[k] = list[list.length - 1];
                    list.pop();
                    break;
                }
            }
        }
        emit SchemaAuthorizationSet(issuerId, schemaId, allowed);
        emit SchemaAuthorizationWindow(issuerId, schemaId, allowed, t);
    }

    /**
     * @notice Doğrulayıcının ZORUNLU adımı (SPEC-BC-0001 §11.2, sorgu 2).
     * @dev    ÜÇ koşulun hepsi gerekir:
     *           1) issuer geçerli
     *           2) şema aktif (DEPRECATED ile YENİ ihraç yapılamaz)
     *           3) (issuer, schema) çifti açıkça izinli — I1 allowlist
     */
    function isAuthorizedForSchema(bytes32 issuerId, bytes32 schemaId) external view returns (bool) {
        if (!_isValid(issuerId)) return false;
        if (!schemaRegistry.isActiveSchema(schemaId)) return false;
        return _schemaAuth[issuerId][schemaId].allowed;
    }

    /**
     * @inheritdoc IIssuerRegistry
     * @dev Review bulgusu R3: doğrulama, "şimdi yetkili mi"ye değil
     *      "iat anında yetkili miydi"ye bakar. Aksi hâlde DEPRECATED şemayla
     *      verilmiş her eski diploma C2'de düşerdi — SC3 ile çelişki.
     */
    function isCredentialSchemaAcceptable(bytes32 issuerId, bytes32 schemaId, uint64 iat)
        external view returns (bool)
    {
        // ADR-0073 K5: şema iat anında ACTIVE ve hiç REVOKED değil (DEPRECATED'dan ÖNCE verilmiş belge geçerli, SC3);
        // kayıtsız şema → false (revert değil).
        if (!schemaRegistry.isSchemaAcceptableAt(schemaId, iat)) return false;

        if (_inWindow(_schemaAuth[issuerId][schemaId], iat)) return true;
        SchemaAuth[] storage past = _pastAuth[issuerId][schemaId];
        for (uint256 k = 0; k < past.length; k++) {
            if (_inWindow(past[k], iat)) return true;
        }
        return false;
    }

    /// @dev Yarı açık pencere (ADR-0073 K5): iat ∈ [since, until); until = 0 → hâlâ açık. since = 0 → hiç yetkilendirilmemiş.
    ///      Geri alma anında verilmiş belge yetkisizdir (liste: `iat < valid_until`).
    function _inWindow(SchemaAuth storage a, uint64 iat) private view returns (bool) {
        if (a.since == 0 || iat < a.since) return false;
        return a.until == 0 || iat < a.until;
    }

    function schemaAuthHistoryOf(bytes32 issuerId, bytes32 schemaId) external view returns (SchemaAuth[] memory) {
        return _pastAuth[issuerId][schemaId];
    }

    function schemaAuthOf(bytes32 issuerId, bytes32 schemaId) external view returns (SchemaAuth memory) {
        return _schemaAuth[issuerId][schemaId];
    }

    function authorizedSchemasOf(bytes32 issuerId) external view returns (bytes32[] memory) {
        return _authList[issuerId];
    }

    // -----------------------------------------------------------------
    // Okuma
    // -----------------------------------------------------------------

    /// @notice "Bu issuer YENİ credential verebilir mi?" — geçmişi kapsamaz (§3.3).
    function isValidIssuer(bytes32 issuerId) external view returns (bool) {
        return _isValid(issuerId);
    }

    function _isValid(bytes32 issuerId) private view returns (bool) {
        Issuer storage i = _issuers[issuerId];
        if (i.status != IssuerStatus.ACTIVE) return false;
        if (block.timestamp < i.validFrom || block.timestamp > i.validUntil) return false;
        // Yeni ihraç için CA ACTIVE olmalı (RETIRED yeterli değil).
        return rootCARegistry.isValidRootCA(i.parentCA);
    }

    /**
     * @inheritdoc IIssuerRegistry
     * @dev Review bulgusu R2: CA rotasyonu (RETIRED) status yayınını durdurmamalı.
     *      Bu yüzden CA'ya hiç bakılmaz; yalnızca issuer'ın kendi durumu.
     */
    function isOperational(bytes32 issuerId) external view returns (bool) {
        Issuer storage i = _issuers[issuerId];
        if (i.status != IssuerStatus.ACTIVE) return false;
        return block.timestamp >= i.validFrom && block.timestamp <= i.validUntil;
    }

    /**
     * @inheritdoc IIssuerRegistry
     * @dev Review bulgusu R1 — yumuşak iptalin GERÇEK uygulaması.
     *      Önceki tasarımda C1 = isValidIssuer idi; bu, REVOKED bir bakanlığın
     *      TÜM diplomalarını reddediyordu — ADR-0002 #4 ve GV1 ile çelişki.
     */
    function isCredentialAcceptable(bytes32 issuerId, uint64 iat) external view returns (bool) {
        Issuer storage i = _issuers[issuerId];
        if (i.status == IssuerStatus.NONE) return false;
        if (iat < i.validFrom || iat > i.validUntil) return false;     // pencere dışı
        // ADR-0073 K5: iat anındaki durum ACTIVE olmalı. Askı yalnız askı süresinde verilen belgeyi düşürür; iptal anında ya
        // da sonra verilmiş belge ret (yarı açık sınır: iat < revokedAt — önceki `iat <= revokedAt` bir saniyelik farkı kapandı).
        if (_history[issuerId].statusAt(iat) != uint8(IssuerStatus.ACTIVE)) return false;
        // ADR-0073 K2: sert iptal — `invalidatesFrom` ≤ iat olan belge düşer (liste: `invalidates_from ≤ iat` → NO).
        uint64 inv = _invalidatesFrom[issuerId];
        if (inv != 0 && iat >= inv) return false;
        // Kök: iat anında ACTIVE ve hiç REVOKED değil (emekli kökün emeklilikten sonraki belgeleri ret).
        return rootCARegistry.isChainAcceptableAt(i.parentCA, iat);
    }

    function issuerStatusAt(bytes32 issuerId, uint64 t) external view returns (IssuerStatus) {
        return IssuerStatus(_history[issuerId].statusAt(t));
    }

    function issuerStatusHistoryOf(bytes32 issuerId) external view returns (StatusHistory.Change[] memory) {
        return _history[issuerId];
    }

    function issuerDelegatesOf(bytes32 issuerId) external view returns (address[] memory) {
        return _delegates[issuerId];
    }

    function isIssuerDelegate(bytes32 issuerId, address key) external view returns (bool) {
        return _isDelegate[issuerId][key];
    }

    function getIssuer(bytes32 issuerId) external view returns (Issuer memory) {
        Issuer memory i = _issuers[issuerId];
        if (i.status == IssuerStatus.NONE) revert UnknownIssuer(issuerId);
        return i;
    }

    function getIssuersByState(bytes2 stateCode) external view returns (bytes32[] memory) {
        return _byState[stateCode];
    }

    function stateOf(bytes32 issuerId) external view returns (bytes2) {
        return _issuers[issuerId].stateCode;
    }

    function _require(bytes32 issuerId) private view returns (Issuer storage i) {
        i = _issuers[issuerId];
        if (i.status == IssuerStatus.NONE) revert UnknownIssuer(issuerId);
    }

    /// @dev SPEC-BC-0001 §3.1/§2/§6 `onlyOwnerState(_stateOf(id))`: delege denetimi + günlük kota (§12.2).
    function _requireOwner(bytes2 stateCode) private {
        _requireOwnerAndCount(stateCode);
    }
}
