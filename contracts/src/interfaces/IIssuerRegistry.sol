// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {ITamgaErrors} from "./ITamgaErrors.sol";
import {StatusHistory} from "../base/StatusHistory.sol";

/// @title IIssuerRegistry — SPEC-BC-0001 §3
interface IIssuerRegistry is ITamgaErrors {
    enum IssuerCategory  {GOVERNMENT, IDENTITY, EDUCATION, HEALTH, FINANCE, LOGISTICS, OTHER, EVENTS} // ADR-0014: yalnızca sona ekle
    enum IssuerAssurance {I1, I2, I3}
    enum IssuerStatus    {NONE, ACTIVE, SUSPENDED, REVOKED}
    /// @dev ADR-0074 K2: listedeki `issuers[].class` — kapalı küme, yalnız SONA eklenir.
    enum IssuerClass     {NONE, PUB, QUALIFIED, EAA}

    /// @dev ADR-0074 K2 — kayıt verisi zincirde yalnız özet, `bool` ve bit maskesi (PJ2; kişisel veri ve serbest metin yok).
    struct IssuerProfile {
        IssuerClass issuerClass;
        bool publicSector; // is_public_sector_body
        uint32 entitlements; // kapalı küme bit maskesi
        bytes32 registrationHash; // ADR-0024 kayıt verisi bloğunun RFC 8785 + SHA-256'sı
        bytes32 operationsHash; // işletim adresleri, assurance_basis, authentic_source, delegate_keys bloğunun özeti
    }

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
        uint64 since;   // güncel pencerenin başı (eski pencereler: schemaAuthHistoryOf)
        uint64 until;   // 0 = hâlâ yetkili; aksi hâlde geri alınma anı — yarı açık: iat < until (ADR-0073 K5)
    }

    event IssuerRegistered(bytes32 indexed issuerId, bytes2 indexed stateCode, IssuerCategory category);
    event IssuerSuspended(bytes32 indexed issuerId);
    /// @dev Olay tabanlı indeksleyici (§11.2) askıdan dönüşü görebilsin diye (2026-10-19).
    event IssuerReinstated(bytes32 indexed issuerId);
    event IssuerRevoked(bytes32 indexed issuerId, bytes32 successorId);
    event IssuerRenewed(bytes32 indexed issuerId, uint64 newValidUntil);
    event IssuerDelegatesSet(bytes32 indexed issuerId, uint256 count);
    event SchemaAuthorizationSet(bytes32 indexed issuerId, bytes32 indexed schemaId, bool allowed);
    /// @dev ADR-0073 K5: her durum değişikliğinin geçerlilik anı (göç kipinde açık tarih; aksi hâlde blok zamanı).
    event IssuerStatusChanged(bytes32 indexed issuerId, IssuerStatus status, uint64 since);
    /// @dev ADR-0073 K5 eşlemesi: listedeki `RETIRED` = zincirde yumuşak REVOKED + bu olay (önceki belgeler geçerli, GV1).
    event IssuerRetired(bytes32 indexed issuerId, bytes32 successorId);
    /// @dev Şema yetkisi penceresinin açılış/kapanış anı (göç kipinde açık tarih).
    event SchemaAuthorizationWindow(bytes32 indexed issuerId, bytes32 indexed schemaId, bool allowed, uint64 at);
    /// @dev ADR-0073 K2: sert iptal — bu andan itibaren verilmiş belgeler düşer (yalnız geriye çekilir).
    event IssuerInvalidatedFrom(bytes32 indexed issuerId, uint64 invalidatesFrom);
    event IssuerProfileSet(
        bytes32 indexed issuerId, IssuerClass issuerClass, bytes32 registrationHash, bytes32 operationsHash
    );

    error IssuerExists(bytes32 issuerId);
    error UnknownIssuer(bytes32 issuerId);
    error UnknownRootCA(bytes32 caId);
    /// @dev CA3: yeni issuer yalnız ACTIVE (ve geçerlilik penceresi içindeki) kök CA'ya bağlanır.
    error RootCANotActive(bytes32 caId);
    /// @dev Issuer kendisinin halefi olamaz (I4: listesi donardı).
    error InvalidSuccessor(bytes32 successorId);
    /// @dev ADR-0054 NS2: kök sertifika ya da halef başka bir devlete ait.
    error CrossStateReference(bytes32 ref, bytes2 refState);
    /// @dev ADR-0073 K2 / CE2: validFrom ≤ tarih ≤ revokedAt, kurum REVOKED ve tarih yalnız geriye çekilir.
    error InvalidInvalidatesFrom(uint64 invalidatesFrom);

    function registerIssuer(Issuer calldata data) external;
    function suspendIssuer(bytes32 issuerId) external;
    function reinstateIssuer(bytes32 issuerId) external;
    function revokeIssuer(bytes32 issuerId, bytes32 successorId) external;
    function renewIssuer(bytes32 issuerId, uint64 newValidUntil) external;
    function setIssuerDelegates(bytes32 issuerId, address[] calldata keys) external;

    // --- ADR-0073 K1: tarihli yazımlar (`at` = 0 → blok zamanı; açık tarih yalnız göç kipinde) ---
    function suspendIssuerAt(bytes32 issuerId, uint64 at) external;
    function reinstateIssuerAt(bytes32 issuerId, uint64 at) external;
    function revokeIssuerAt(bytes32 issuerId, bytes32 successorId, uint64 at) external;
    /// @notice Listedeki `RETIRED`: yumuşak iptal (revokedAt = since) + IssuerRetired.
    function retireIssuer(bytes32 issuerId, bytes32 successorId, uint64 at) external;
    function setSchemaAuthorizationAt(bytes32 issuerId, bytes32 schemaId, bool allowed, uint64 at) external;

    /// @notice ADR-0073 K2 — sert iptal (ele geçirilme): `invalidatesFrom` ≤ iat olan belge C1'de düşer. Kurum REVOKED olmalı;
    ///         `validFrom ≤ invalidatesFrom ≤ revokedAt`; yazılan tarih silinmez, yalnız daha geriye çekilir. Göç kipi dışında
    ///         geçmiş tarih yazılabilen tek alandır (CE2), kurumun kendi geçerlilik aralığıyla sınırlı.
    function setIssuerInvalidatesFrom(bytes32 issuerId, uint64 invalidatesFrom) external;
    function invalidatesFromOf(bytes32 issuerId) external view returns (uint64);

    /// @notice ADR-0074 K2: kurum sınıfı, kamu kurumu bayrağı, yetki maskesi ve kayıt/işletim ayrıntı özetleri.
    function setIssuerProfile(bytes32 issuerId, IssuerProfile calldata profile) external;
    function issuerProfileOf(bytes32 issuerId) external view returns (IssuerProfile memory);

    /// @notice Yetki yalnız `SchemaRegistry`'de kayıtlı şemaya verilir (`UnknownSchema`; kontrat denetimi 2026-11-11). Geri alma
    ///         kayıt aramaz.
    function setSchemaAuthorization(bytes32 issuerId, bytes32 schemaId, bool allowed) external;
    function isAuthorizedForSchema(bytes32 issuerId, bytes32 schemaId) external view returns (bool);
    function authorizedSchemasOf(bytes32 issuerId) external view returns (bytes32[] memory);
    /// @notice Kapanmış eski yetki pencereleri (I3) — yeniden yetkilendirmede güncel pencere buraya taşınır.
    function schemaAuthHistoryOf(bytes32 issuerId, bytes32 schemaId) external view returns (SchemaAuth[] memory);

    // ---------------------------------------------------------------
    // ÜÇ FARKLI SORU — karıştırılmamalı (SPEC-BC-0001 §3.3, review bulgusu R1)
    // ---------------------------------------------------------------

    /// @notice "Bu issuer ŞİMDİ yeni credential verebilir mi?"  (ihraç zamanı)
    function isValidIssuer(bytes32 issuerId) external view returns (bool);

    /// @notice "Bu issuer günlük operasyon yapabilir mi?" (status list yayını)
    /// @dev    CA durumundan BAĞIMSIZ — CA rotasyonu status yayınını durdurmamalı.
    function isOperational(bytes32 issuerId) external view returns (bool);

    /// @notice "iat anında verilmiş bir credential, issuer açısından kabul edilebilir mi?"
    /// @dev    ADR-0073 K5: kurumun ve kök CA'nın `iat` anındaki durumuna bakar (yarı açık pencereler). Askıdan ya da
    ///         iptalden ÖNCE verilmiş belge kabul; askı süresinde ya da iptal anında/sonra verilmiş belge ret (liste kuralı).
    function isCredentialAcceptable(bytes32 issuerId, uint64 iat) external view returns (bool);

    /// @notice "iat anında verilmiş credential, şema yetkisi açısından kabul edilebilir mi?"
    /// @dev    Yetki penceresine bakar; şemanın DEPRECATED olması engel DEĞİLDİR (SC3).
    ///         Şema REVOKED ise false.
    function isCredentialSchemaAcceptable(bytes32 issuerId, bytes32 schemaId, uint64 iat)
        external view returns (bool);

    function schemaAuthOf(bytes32 issuerId, bytes32 schemaId) external view returns (SchemaAuth memory);
    function issuerStatusAt(bytes32 issuerId, uint64 t) external view returns (IssuerStatus);
    function issuerStatusHistoryOf(bytes32 issuerId) external view returns (StatusHistory.Change[] memory);
    /// @notice SPEC-BC-0001 C33 (1): kurumun güncel delege anahtarları.
    function issuerDelegatesOf(bytes32 issuerId) external view returns (address[] memory);
    function isIssuerDelegate(bytes32 issuerId, address key) external view returns (bool);
    function getIssuer(bytes32 issuerId) external view returns (Issuer memory);
    function getIssuersByState(bytes2 stateCode) external view returns (bytes32[] memory);
    function stateOf(bytes32 issuerId) external view returns (bytes2);
}
