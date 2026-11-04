// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {ITamgaErrors} from "./ITamgaErrors.sol";
import {StatusHistory} from "../base/StatusHistory.sol";

/**
 * @title IRelyingPartyRegistry — SPEC-BC-0001 §6, ADR-0073 K4 (CE4)
 * @dev   Kimlik `rpId = keccak256(utf8(dns_name))`: kayıt kurumu hesaplar (ABI'de alan adı metni yok), erişim sertifikası
 *        yenilenince değişmez. İstek kapsamları öğe öğedir; serbest metin yalnız özetle (ayrıntı özeti, RFC 8785 + SHA-256).
 *        ADR-0075: kimliğin sahibi devlet yalnız Governance oyuyla (2/3) değişir; iptal edilmiş kimlik yalnız Governance oyuyla
 *        yeniden kaydedilir. İkisi de yeni bir kayıt dönemi açar; eski dönemin geçmişi ve olayları korunur.
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

    /// @dev ADR-0075 — dönem değişikliğinin türü (değer yalnız SONA eklenir).
    ///      REASSIGNMENT: iptal edilmemiş kimliğin sahibi devlet değişir (anlaşmazlık / devir).
    ///      RE_REGISTRATION: iptal edilmiş (REVOKED) kimlik yeniden kaydedilir (aynı ya da başka devlet).
    enum PeriodAction {NONE, REASSIGNMENT, RE_REGISTRATION}

    /// @dev ADR-0075 — Governance önerisinin sabitlenmiş içeriği (öneri yalnız `stageId` özetini taşır, ADR-0074 K3 deseni).
    ///      Serbest metin yok (ADR-0074 PJ2): gerekçe yalnız özet.
    struct PeriodChange {
        PeriodAction action;
        bytes32 rpId;
        bytes2 fromState; // yürütmede kaydın bugünkü sahibi olmalı
        bytes2 toState; // yeni dönemin sahibi (etkin üye)
        bytes32 nameHash; // yeni dönemin ad özeti
        bytes32 accessCertFingerprint; // yeni dönemin erişim sertifikası (aynı anda tek doğrulayıcı)
        bytes32 reasonHash; // gerekçe / kanıt bloğunun özeti
    }

    /// @dev ADR-0075 — kayıt dönemi: ilk kayıt dönem 0'dır; her devir ya da yeniden kayıt bir dönem ekler (silinmez).
    struct RegistrationPeriod {
        bytes2 stateCode;
        uint64 since; // dönemin başlangıcı (yarı açık: sonraki dönemin başlangıcına kadar)
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
    /// @dev ADR-0075: dönem değişikliği sabitlendi (`basePeriods`: sabitlemedeki dönem sayısı; araya giren değişiklik bayatlatır).
    event PeriodChangeStaged(bytes32 indexed stageId, bytes32 indexed rpId, PeriodAction action, uint32 basePeriods);
    /// @dev ADR-0075: sahibi devlet Governance oyuyla değişti; `period` yeni dönemin sırası (0 tabanlı).
    event RelyingPartyReassigned(
        bytes32 indexed rpId, bytes2 indexed fromState, bytes2 indexed toState, uint32 period, bytes32 reasonHash
    );
    /// @dev ADR-0075: iptal edilmiş kimlik Governance oyuyla yeniden kaydedildi.
    event RelyingPartyReRegistered(bytes32 indexed rpId, bytes2 indexed stateCode, uint32 period, bytes32 reasonHash);

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
    /// @dev ADR-0075: sabitlenmiş dönem değişikliği yok ya da önerinin türüyle uyuşmuyor.
    error UnknownPeriodChange(bytes32 stageId);
    /// @dev ADR-0075: içerik eksik ya da yürütme anında koşul tutmuyor (sahip, durum, yeni devletin üyeliği).
    error InvalidPeriodChange(bytes32 rpId);
    /// @dev ADR-0075: sabitlemeden sonra kayda başka bir dönem eklendi — öneri yeniden sabitlenip oylanır.
    error StalePeriodChange(bytes32 stageId, uint32 basePeriods, uint32 currentPeriods);

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

    // --- ADR-0075: kimliğin sahipliği ve iptal sonrası yeniden kayıt ---
    /// @notice Dönem değişikliğini sabitler (herkes; yalnız saklar). Governance önerisi dönen `stageId`'yi taşır.
    function stagePeriodChange(PeriodChange calldata change) external returns (bytes32 stageId);
    /// @notice Yalnız Governance (2/3 oyla yürütülen türü belli öneri): sabitlenmiş değişikliği yeni dönem olarak yazar.
    function commitPeriodChange(bytes32 stageId, PeriodAction action) external;
    /// @notice Değişikliğin bugünkü dönem sayısına göre `stageId`'si.
    function periodChangeIdOf(PeriodChange calldata change) external view returns (bytes32);
    function stagedPeriodChangeOf(bytes32 stageId) external view returns (PeriodChange memory change, uint32 basePeriods);
    function registrationPeriodsOf(bytes32 rpId) external view returns (RegistrationPeriod[] memory);
    /// @notice `t` anındaki durum, sahibi devlet ve dönem (o anda kayıt yoksa NONE).
    function relyingPartyAt(bytes32 rpId, uint64 t)
        external
        view
        returns (RPStatus status, bytes2 stateCode, uint32 period);
    /// @notice `t` anında (ör. `iat`) doğrulayıcı ACTIVE mıydı — o andaki döneme göre.
    function isRelyingPartyAcceptableAt(bytes32 rpId, uint64 t) external view returns (bool);
    function relyingPartyStatusHistoryOf(bytes32 rpId) external view returns (StatusHistory.Change[] memory);
    function getRelyingPartiesByState(bytes2 stateCode) external view returns (bytes32[] memory);
}
