// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {ITamgaErrors} from "./ITamgaErrors.sol";

/**
 * @title IRelyingPartyRegistry — SPEC-BC-0001 §6, ADR-0073 K4 (CE4)
 * @dev   Kimlik `rpId = keccak256(utf8(dns_name))`: kayıt kurumu hesaplar (ABI'de alan adı metni yok), erişim sertifikası
 *        yenilenince değişmez. İstek kapsamları öğe öğedir; serbest metin yalnız özetle (ayrıntı özeti, RFC 8785 + SHA-256).
 */
interface IRelyingPartyRegistry is ITamgaErrors {
    enum RPStatus {NONE, ACTIVE, SUSPENDED, REVOKED}
    /// @dev Kapalı küme, değer yalnız SONA eklenir: `dc+sd-jwt`, `mso_mdoc`, `mso_mdoc_zk` (ADR-0073 K4).
    enum PresentationFormat {SD_JWT_VC, MSO_MDOC, MSO_MDOC_ZK}
    /// @dev ADR-0074 K2: listedeki `pseudonyms` — kapalı küme `single`, `multiple` (yalnız SONA eklenir).
    enum AliasPolicy {UNSPECIFIED, SINGLE, MULTIPLE}

    /// @dev ADR-0074 K2 — doğrulayıcı kayıt verisi: özet, `bool`, bit maskesi ve rpId dizileri (PJ2).
    struct RelyingPartyProfile {
        bool publicSector;
        uint32 entitlements; // kapalı küme bit maskesi
        AliasPolicy aliasPolicy;
        bytes32 registrationHash; // ADR-0024 kayıt verisi bloğunun RFC 8785 + SHA-256'sı
        bytes32[] intermediaries; // uses_intermediaries → rpId'ler
        bytes32[] servedParties; // served_relying_parties → rpId'ler
    }

    /// @dev ADR-0069 / ADR-0074 K2 — kapı grubu (`relying_parties[].terminal_groups[]`). `groupId` bütün ağda tektir (TG1).
    struct TerminalGroup {
        bytes32 groupId; // keccak256(group_id)
        bytes32 institutionId; // kurum bağı: issuerId ya da rpId
        bytes32[] policyIds; // kapı politikası kimliği özetleri (en az bir)
        bytes32[] certFingerprints; // kapı sertifikası parmak izleri
        bool offlineAllowed;
        uint64 validFrom;
        uint64 validUntil; // 0 = açık uçlu; geri çekilen grup silinmez, aralığı kapanır
        bytes32 labelHash; // label → özet
    }

    struct RelyingParty {
        bytes32 rpId; // keccak256(utf8(dns_name)) — kayıt kurumu hesaplar
        bytes2 stateCode;
        bytes32 nameHash;
        bytes32 accessCertFingerprint; // güncellenebilir; aynı anda yalnız bir doğrulayıcıya ait
        RPStatus status;
        uint64 registeredAt; // göç kipinde açık tarih; aksi hâlde 0 verilir (blok zamanı)
    }

    /// @dev Listedeki bir kullanım (`relying_parties[].scopes[]`) — ADR-0073 K4 tablosu.
    struct RequestScope {
        bytes32 scopeHash; // keccak256(scope_id)
        bytes32 serviceHash; // keccak256(service_id ?? scope_id)
        bytes32 schemaId; // keccak256(vct)
        PresentationFormat format;
        bytes32 namespaceHash; // keccak256(mdoc_namespace) ya da 0
        bytes32[] attributes; // keccak256(utf8(öğe yolu)), kesin artan sırada (tekil)
        uint64 validFrom;
        uint64 validUntil; // 0 = açık uçlu; yarı açık [validFrom, validUntil)
        bytes32 detailsHash; // amaç, yerelleştirilmiş amaç, gizlilik politikası adresi bloğunun kanonik JSON SHA-256'sı
    }

    event RelyingPartyRegistered(bytes32 indexed rpId, bytes2 indexed stateCode);
    event RelyingPartySuspended(bytes32 indexed rpId);
    event RelyingPartyReinstated(bytes32 indexed rpId);
    event RelyingPartyRevoked(bytes32 indexed rpId);
    event AccessCertificateUpdated(bytes32 indexed rpId, bytes32 previousFingerprint, bytes32 newFingerprint);
    event RequestScopeSet(
        bytes32 indexed rpId,
        bytes32 indexed scopeHash,
        bytes32 schemaId,
        PresentationFormat format,
        uint64 validFrom,
        uint64 validUntil
    );
    event RequestScopeClosed(bytes32 indexed rpId, bytes32 indexed scopeHash, uint64 validUntil);
    event RelyingPartyProfileSet(bytes32 indexed rpId, bytes32 registrationHash);
    event TerminalGroupSet(bytes32 indexed rpId, bytes32 indexed groupId, bytes32 institutionId, uint64 validFrom, uint64 validUntil);
    event TerminalGroupClosed(bytes32 indexed rpId, bytes32 indexed groupId, uint64 validUntil);

    error RPExists(bytes32 rpId);
    error UnknownRP(bytes32 rpId);
    error EmptyRpId();
    error TooManyScopes(uint256 count, uint256 max);
    error TooManyAttributes(uint256 count, uint256 max);
    /// @dev Öğe özetleri kesin artan sırada olmalı (tekillik + ikili arama).
    error AttributesNotSorted();
    error InvalidScope(bytes32 scopeHash);
    error UnknownScope(bytes32 rpId, bytes32 scopeHash);
    /// @dev Yalnız ACTIVE kayıt askıya alınır (iptal geri yazılamaz, F-18).
    error RelyingPartyNotActive(bytes32 rpId);
    error RelyingPartyNotSuspended(bytes32 rpId);
    /// @dev Bir erişim sertifikası parmak izi aynı anda yalnız bir doğrulayıcıya ait olabilir (ADR-0073 K4).
    error CertificateInUse(bytes32 fingerprint, bytes32 rpId);
    error TooManyEntries(uint256 count, uint256 max);
    error InvalidTerminalGroup(bytes32 groupId);
    /// @dev TG1: grup kimliği bütün ağda tek; başka doğrulayıcının grubu yazılamaz.
    error TerminalGroupOwnedByOther(bytes32 groupId, bytes32 rpId);
    error UnknownTerminalGroup(bytes32 groupId);
    /// @dev Güvenlik turu 2026-11-04: kapanmış kapsam / kapı grubu aynı kimlikle yeniden açılamaz.
    error ScopeClosed(bytes32 rpId, bytes32 scopeHash);
    error TerminalGroupNotOpen(bytes32 groupId);
    /// @dev Kapı grubunun kurum bağı aynı devletin kayıtlı kurumu (issuerId) ya da doğrulayıcısı (rpId) değil.
    error UnknownInstitution(bytes32 institutionId);

    function registerRelyingParty(RelyingParty calldata data) external;
    /// @notice Erişim sertifikası yenilemesi: kimlik değişmez; eski ve yeni parmak izi olayla yayılır.
    function updateAccessCertificate(bytes32 rpId, bytes32 newFingerprint) external;
    function suspendRelyingParty(bytes32 rpId) external;
    /// @notice ADR-0073 K4: SUSPENDED → ACTIVE (REVOKED kesindir).
    function reinstateRelyingParty(bytes32 rpId) external;
    function revokeRelyingParty(bytes32 rpId) external;
    /// @notice Kapsamı ekler ya da (aynı `scopeHash`) günceller.
    function setRequestScope(bytes32 rpId, RequestScope calldata scope) external;
    /// @notice Geri çekilen kapsam silinmez, aralığı kapanır (`at` = 0 → blok zamanı; açık tarih yalnız göç kipinde).
    function closeRequestScope(bytes32 rpId, bytes32 scopeHash, uint64 at) external;
    /// @notice ADR-0074 K2: kayıt verisi özeti, kamu kurumu bayrağı, yetki maskesi, takma ad politikası, aracı ve hizmet verilen
    ///         doğrulayıcılar (her dizi en çok 32).
    function setRelyingPartyProfile(bytes32 rpId, RelyingPartyProfile calldata profile) external;
    /// @notice ADR-0074 K2 / ADR-0069: kapı grubunu ekler ya da günceller (doğrulayıcı başına en çok 32 grup).
    function setTerminalGroup(bytes32 rpId, TerminalGroup calldata group) external;
    function closeTerminalGroup(bytes32 rpId, bytes32 groupId, uint64 at) external;

    function isValidRelyingParty(bytes32 rpId) external view returns (bool);
    function rpIdOfCertificate(bytes32 fingerprint) external view returns (bytes32);
    /// @notice "Bu doğrulayıcı bu hizmette, bu türde, bu biçimde, bu öğeyi ŞU ANDA isteyebilir mi?" (aşırı istek denetimi)
    function mayRequest(
        bytes32 rpId,
        bytes32 serviceHash,
        bytes32 schemaId,
        PresentationFormat format,
        bytes32 namespaceHash,
        bytes32 attribute
    ) external view returns (bool);
    function requestScopesOf(bytes32 rpId) external view returns (RequestScope[] memory);
    function relyingPartyProfileOf(bytes32 rpId) external view returns (RelyingPartyProfile memory);
    function terminalGroupOf(bytes32 groupId) external view returns (bytes32 rpId, TerminalGroup memory group);
    function terminalGroupsOf(bytes32 rpId) external view returns (bytes32[] memory);
    /// @notice Grup şu anda etkin mi (sahibi etkin doğrulayıcı, aralık içinde) ve bu kapı sertifikası gruba ait mi.
    function isActiveTerminalCertificate(bytes32 groupId, bytes32 certFingerprint) external view returns (bool);
    function getRelyingParty(bytes32 rpId) external view returns (RelyingParty memory);
    function getRelyingPartiesByState(bytes2 stateCode) external view returns (bytes32[] memory);
}
