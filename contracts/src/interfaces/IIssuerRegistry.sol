// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {ITamgaErrors} from "./ITamgaErrors.sol";

/// @title IIssuerRegistry — SPEC-BC-0001 §3
interface IIssuerRegistry is ITamgaErrors {
    enum IssuerCategory  {GOVERNMENT, IDENTITY, EDUCATION, HEALTH, FINANCE, LOGISTICS, OTHER, EVENTS} // ADR-0014: yalnızca sona ekle
    enum IssuerAssurance {I1, I2, I3}
    enum IssuerStatus    {NONE, ACTIVE, SUSPENDED, REVOKED}

    struct Issuer {
        bytes32 issuerId;
        bytes2 stateCode;
        bytes32 nameHash;
        IssuerCategory category;
        IssuerAssurance assurance;
        bytes32 certFingerprint;
        bytes32 parentCA;
        string metadataURI;
        IssuerStatus status;
        uint64 validFrom;
        uint64 validUntil;
        bytes32 successorId;
        uint64 registeredAt;
        uint64 revokedAt;      // 0 = iptal edilmemiş. Yumuşak iptalin zaman sınırı.
    }

    /// @dev Şema yetkisinin ZAMAN PENCERESİ. Doğrulama, credential'ın iat'ının
    ///      bu pencereye düşüp düşmediğine bakar — bugünkü duruma değil.
    struct SchemaAuth {
        bool allowed;
        uint64 since;   // ilk yetkilendirme
        uint64 until;   // 0 = hâlâ yetkili; aksi hâlde geri alınma anı
    }

    event IssuerRegistered(bytes32 indexed issuerId, bytes2 indexed stateCode, IssuerCategory category);
    event IssuerSuspended(bytes32 indexed issuerId);
    event IssuerRevoked(bytes32 indexed issuerId, bytes32 successorId);
    event IssuerRenewed(bytes32 indexed issuerId, uint64 newValidUntil);
    event IssuerDelegatesSet(bytes32 indexed issuerId, uint256 count);
    event SchemaAuthorizationSet(bytes32 indexed issuerId, bytes32 indexed schemaId, bool allowed);

    error IssuerExists(bytes32 issuerId);
    error UnknownIssuer(bytes32 issuerId);
    error SchemaNotAuthorized(bytes32 issuerId, bytes32 schemaId);
    error UnknownRootCA(bytes32 caId);

    function registerIssuer(Issuer calldata data) external;
    function suspendIssuer(bytes32 issuerId) external;
    function reinstateIssuer(bytes32 issuerId) external;
    function revokeIssuer(bytes32 issuerId, bytes32 successorId) external;
    function renewIssuer(bytes32 issuerId, uint64 newValidUntil) external;
    function setIssuerDelegates(bytes32 issuerId, address[] calldata keys) external;

    function setSchemaAuthorization(bytes32 issuerId, bytes32 schemaId, bool allowed) external;
    function isAuthorizedForSchema(bytes32 issuerId, bytes32 schemaId) external view returns (bool);
    function authorizedSchemasOf(bytes32 issuerId) external view returns (bytes32[] memory);

    // ---------------------------------------------------------------
    // ÜÇ FARKLI SORU — karıştırılmamalı (SPEC-BC-0001 §3.3, review bulgusu R1)
    // ---------------------------------------------------------------

    /// @notice "Bu issuer ŞİMDİ yeni credential verebilir mi?"  (ihraç zamanı)
    function isValidIssuer(bytes32 issuerId) external view returns (bool);

    /// @notice "Bu issuer günlük operasyon yapabilir mi?" (status list yayını)
    /// @dev    CA durumundan BAĞIMSIZ — CA rotasyonu status yayınını durdurmamalı.
    function isOperational(bytes32 issuerId) external view returns (bool);

    /// @notice "iat anında verilmiş bir credential, issuer açısından kabul edilebilir mi?"
    /// @dev    Yumuşak iptalin gerçek uygulaması: REVOKED issuer'ın revokedAt öncesi
    ///         credential'ları kabul edilir. SUSPENDED → false (ihtiyati).
    function isCredentialAcceptable(bytes32 issuerId, uint64 iat) external view returns (bool);

    /// @notice "iat anında verilmiş credential, şema yetkisi açısından kabul edilebilir mi?"
    /// @dev    Yetki penceresine bakar; şemanın DEPRECATED olması engel DEĞİLDİR (SC3).
    ///         Şema REVOKED ise false.
    function isCredentialSchemaAcceptable(bytes32 issuerId, bytes32 schemaId, uint64 iat)
        external view returns (bool);

    function schemaAuthOf(bytes32 issuerId, bytes32 schemaId) external view returns (SchemaAuth memory);
    function isIssuerDelegate(bytes32 issuerId, address key) external view returns (bool);
    function getIssuer(bytes32 issuerId) external view returns (Issuer memory);
    function getIssuersByState(bytes2 stateCode) external view returns (bytes32[] memory);
    function stateOf(bytes32 issuerId) external view returns (bytes2);
}
