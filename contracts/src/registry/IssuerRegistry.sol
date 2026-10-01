// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {TamgaRegistryBase} from "../base/TamgaRegistryBase.sol";
import {IIssuerRegistry} from "../interfaces/IIssuerRegistry.sol";
import {IRootCARegistry} from "../interfaces/IRootCARegistry.sol";
import {ISchemaRegistry} from "../interfaces/ISchemaRegistry.sol";

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
 */
contract IssuerRegistry is TamgaRegistryBase, IIssuerRegistry {
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

    uint256[42] private __gap;

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

        bytes32 issuerId = keccak256(abi.encodePacked(data.stateCode, data.certFingerprint));
        if (_issuers[issuerId].status != IssuerStatus.NONE) revert IssuerExists(issuerId);

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
        i.registeredAt = uint64(block.timestamp);

        _byState[data.stateCode].push(issuerId);
        emit IssuerRegistered(issuerId, data.stateCode, data.category);
    }

    function suspendIssuer(bytes32 issuerId) external {
        Issuer storage i = _require(issuerId);
        _requireOwner(i.stateCode);
        if (i.status != IssuerStatus.ACTIVE) revert UnknownIssuer(issuerId);
        i.status = IssuerStatus.SUSPENDED;
        emit IssuerSuspended(issuerId);
    }

    function reinstateIssuer(bytes32 issuerId) external {
        Issuer storage i = _require(issuerId);
        _requireOwner(i.stateCode);
        if (i.status != IssuerStatus.SUSPENDED) revert UnknownIssuer(issuerId);
        i.status = IssuerStatus.ACTIVE;
    }

    /**
     * @notice Kurumu kapatır ve isteğe bağlı olarak halefini işaret eder.
     * @dev    YUMUŞAK: verdiği credential'lar validUntil'e kadar geçerli kalır.
     *         Bakanlık kapanınca diplomalar çöp olmaz (ADR-0002 #4).
     */
    function revokeIssuer(bytes32 issuerId, bytes32 successorId) external {
        Issuer storage i = _require(issuerId);
        _requireOwner(i.stateCode);
        if (i.status == IssuerStatus.REVOKED) revert AlreadyRevoked(issuerId);
        if (successorId != bytes32(0)) {
            Issuer storage s = _issuers[successorId];
            if (s.status != IssuerStatus.ACTIVE) revert SuccessorNotActive(successorId);
        }
        i.status = IssuerStatus.REVOKED;
        i.successorId = successorId;
        i.revokedAt = uint64(block.timestamp);   // yumuşak iptalin zaman sınırı
        emit IssuerRevoked(issuerId, successorId);
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
        Issuer storage i = _require(issuerId);
        _requireOwner(i.stateCode);

        SchemaAuth storage a = _schemaAuth[issuerId][schemaId];
        if (a.allowed == allowed) return;

        a.allowed = allowed;
        if (allowed) {
            a.since = uint64(block.timestamp);
            a.until = 0;
            _authList[issuerId].push(schemaId);
        } else {
            a.until = uint64(block.timestamp);
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
        SchemaAuth storage a = _schemaAuth[issuerId][schemaId];
        if (a.since == 0) return false;                       // hiç yetkilendirilmemiş
        if (iat < a.since) return false;                      // yetkiden önce verilmiş
        if (a.until != 0 && iat > a.until) return false;      // yetki kalktıktan sonra verilmiş
        // Şema DEPRECATED olabilir (SC3) ama REVOKED olamaz.
        ISchemaRegistry.SchemaRecord memory rec = schemaRegistry.getSchema(schemaId);
        return rec.status != ISchemaRegistry.SchemaStatus.REVOKED;
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
        if (i.status == IssuerStatus.SUSPENDED) return false;          // ihtiyati
        if (iat < i.validFrom || iat > i.validUntil) return false;     // pencere dışı
        if (i.status == IssuerStatus.REVOKED && i.revokedAt != 0 && iat > i.revokedAt) return false;
        // CA: REVOKED (ele geçirilme) → red; RETIRED (rotasyon) → kabul.
        return rootCARegistry.isChainAcceptable(i.parentCA);
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

    function _requireOwner(bytes2 stateCode) private view {
        if (!sovereignty.isDelegateOf(msg.sender, stateCode)) revert NotOwnerState(stateCode, msg.sender);
    }
}
