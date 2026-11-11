// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {ITamgaErrors} from "./ITamgaErrors.sol";
import {ISchemaRegistry} from "./ISchemaRegistry.sol";

/// @title IGovernance — SPEC-BC-0001 §1 / ADR-0002
interface IGovernance is ITamgaErrors {
    enum MemberStatus {NONE, ACTIVE, SUSPENDED, WITHDRAWN}
    /// @dev Değer yalnız SONA eklenir. REGISTRY_ADMIN: ADR-0055 K3.
    enum ProposalKind {NONE, STATE_ADMISSION, STATE_REMOVAL, PROTOCOL_UPGRADE, NETWORK_SCHEMA, REGISTRY_ADMIN}
    /// @dev Güvenlik turu 2026-11-04: CANCELLED yeniden eklendi (yalnız sona) — öneren yürütülmemiş önerisini geri çeker.
    enum ProposalStatus {NONE, OPEN, EXECUTED, CANCELLED}

    /// @dev ADR-0055 K3 — türü belli kayıt yönetimi işlemleri (genel çağrı yok, GE3).
    enum AdminAction {
        NONE,
        SET_ANCHORER,
        SET_ANCHOR_THRESHOLD,
        BOOTSTRAP_FOUNDERS,
        DEPRECATE_NETWORK_SCHEMA,
        REVOKE_NETWORK_SCHEMA,
        // ADR-0073 K1: tek seferlik göç kipi (değerler yalnız sona eklenir)
        OPEN_MIGRATION,
        EXTEND_MIGRATION,
        CLOSE_MIGRATION,
        // ADR-0073 K3: ağ şemasına yeni sürüm özeti
        ADD_NETWORK_SCHEMA_HASH,
        // ADR-0074 K3: NetworkRegistry'de sabitlenmiş (stageRecord) kaydı yazar
        NETWORK_RECORD,
        // ADR-0075: RelyingPartyRegistry'de sabitlenmiş (stagePeriodChange) devir / iptal sonrası yeniden kayıt
        REASSIGN_RELYING_PARTY,
        REREGISTER_RELYING_PARTY
    }

    struct AdminPayload {
        AdminAction action;
        address registry; // SET_ANCHORER / SET_ANCHOR_THRESHOLD / BOOTSTRAP_FOUNDERS hedefi; şema işlemlerinde bağlı SchemaRegistry
        address account; // SET_ANCHORER
        bool allowed; // SET_ANCHORER
        uint8 required; // SET_ANCHOR_THRESHOLD
        bytes32 schemaId; // DEPRECATE / REVOKE
        bytes32 supersededBy; // DEPRECATE
        bytes32 reasonHash; // REVOKE — gerekçe metninin özeti (güvenlik turu 2026-11-04; ADR-0074 PJ2)
        bytes2[] founders; // BOOTSTRAP_FOUNDERS
        bytes32 digest; // OPEN_MIGRATION: plan özeti; ADD_NETWORK_SCHEMA_HASH: sürüm özeti; NETWORK_RECORD / ADR-0075: stageId
        uint64 window; // OPEN_MIGRATION: pencere süresi (sn, ≤ 30 gün); EXTEND_MIGRATION: yeni bitiş anı
        // `account` OPEN_MIGRATION'da ağ düzeyi kayıtların tek göç yürütücüsüdür.
    }

    struct StateMember {
        bytes2 stateCode;
        address validatorAddress;
        MemberStatus status;
        uint64 joinedAt;
    }

    struct Proposal {
        bytes32 id;
        ProposalKind kind;
        ProposalStatus status;
        address proposer;
        uint64 createdAt;
        uint64 expiresAt;
        // STATE_ADMISSION / STATE_REMOVAL
        bytes2 stateCode;
        address validatorAddress;
        // PROTOCOL_UPGRADE
        address target;
        address newImplementation;
        uint32 forVotes;
        uint32 againstVotes;
    }

    event StateAdmitted(bytes2 indexed stateCode, address validator);
    /// @dev F-18: gerekçe serbest metin değil, özetidir (ADR-0074 PJ2) — öneriyle gelir.
    event StateRemoved(bytes2 indexed stateCode, bytes32 reasonHash);
    event StateWithdrawn(bytes2 indexed stateCode);
    /// @dev F-18: anahtarların kendisi olayda (indeksleyici delege listesini olaylardan kurar, C33 (1)).
    event DelegateKeysSet(bytes2 indexed stateCode, address[] keys);
    /// @dev F-18: SchemaRegistry bağı (bir kez) olayla görünür.
    event SchemaRegistrySet(address indexed registry);
    event ProposalCreated(bytes32 indexed id, ProposalKind kind, address proposer);
    event Voted(bytes32 indexed id, address voter, bool support);
    /// @dev Kontrol 2026-11-10: üye, yürütülmemiş öneride oyunu geri çekti (oy değişikliği yeni bir `Voted` olayıdır).
    event VoteRetracted(bytes32 indexed id, address voter);
    event ProposalExecuted(bytes32 indexed id);
    /// @dev Güvenlik turu 2026-11-04: öneren önerisini yürütülmeden geri çekti.
    event ProposalCancelled(bytes32 indexed id);
    /// @dev ADR-0055 GE1: yükseltme eşiği doldu, kuyruğa alındı; en erken `eta`'da uygulanır.
    event ProposalQueued(bytes32 indexed id, uint64 eta);

    error NotValidator(address caller);
    /// @dev Yalnız öneren kendi önerisini geri çekebilir.
    error NotProposer(address caller);
    error UnknownProposal(bytes32 id);
    error ProposalNotOpen(bytes32 id);
    error ProposalExpired(bytes32 id);
    error AlreadyVoted(bytes32 id, address voter);
    /// @dev Geri çekilecek oy yok.
    error NoVote(bytes32 id, address voter);
    error ThresholdNotMet(uint32 forVotes, uint32 required);
    error MemberExists(bytes2 stateCode);
    error UnknownMember(bytes2 stateCode);
    error LastValidator();
    error UpgradeTargetNotProxiable(address impl);
    /// @dev Bir validator adresi yalnız bir devlete ait olabilir (N1 — başka devletin koltuğu ele geçirilemez).
    error ValidatorInUse(address validator, bytes2 ownerState);
    /// @dev Bir delege anahtarı yalnız bir devlete ait olabilir (N1 — başka devletin anahtarı çekilemez).
    error DelegateKeyInUse(address key, bytes2 ownerState);
    /// @dev ADR-0055 GE1: kuyruktaki yükseltmenin bekleme süresi dolmadı.
    error UpgradeNotReady(bytes32 id, uint64 eta);
    /// @dev ADR-0055 K3: yönetim önerisinin hedefi sıfır, Governance'ın kendisi ya da kodsuz adres.
    error InvalidAdminTarget(address target);
    error SchemaRegistryNotSet();
    /// @dev ADR-0073 K1: plan özeti boş ya da pencere 0 / 30 günden uzun.
    error InvalidMigrationProposal();
    /// @dev ADR-0073 K1: yükseltme hedefin göç durumunu değiştirdi (kapanmış kip yükseltmeyle açılamaz) — yükseltme geri alınır.
    error MigrationStateChanged(address target);

    function proposeStateAdmission(bytes2 stateCode, address validator) external returns (bytes32);
    /// @param reasonHash gerekçe metninin özeti (metin zincire yazılmaz, ADR-0074 PJ2).
    function proposeStateRemoval(bytes2 stateCode, bytes32 reasonHash) external returns (bytes32);
    function proposeProtocolUpgrade(address target, address newImplementation) external returns (bytes32);
    function proposeNetworkSchema(ISchemaRegistry.SchemaRecord calldata rec) external returns (bytes32);
    /// @notice ADR-0055 K2: yükseltme + yeni sürümün PARAMETRESİZ başlangıç fonksiyonu (yalnız 4 baytlık seçici).
    function proposeProtocolUpgradeAndInit(address target, address newImplementation, bytes4 initSelector)
        external
        returns (bytes32);

    // --- ADR-0055 K3: türü belli kayıt yönetimi önerileri (2/3) ---
    function proposeAnchorerChange(address registry, address anchorer, bool allowed) external returns (bytes32);
    function proposeAnchorThreshold(address registry, uint8 required) external returns (bytes32);
    function proposeFounderRecognition(address registry, bytes2[] calldata founders) external returns (bytes32);
    function proposeNetworkSchemaDeprecation(bytes32 schemaId, bytes32 supersededBy) external returns (bytes32);
    function proposeNetworkSchemaRevocation(bytes32 schemaId, bytes32 reasonHash) external returns (bytes32);
    // --- ADR-0073 K1: göç kipi (kayıt başına; 2/3) ---
    function proposeMigrationOpen(address registry, bytes32 replayPlanHash, uint64 window, address executor)
        external
        returns (bytes32);
    function proposeMigrationExtend(address registry, uint64 deadline) external returns (bytes32);
    function proposeMigrationClose(address registry) external returns (bytes32);
    /// @notice ADR-0073 K3: ağ şemasına yeni sürüm özeti (2/3).
    function proposeNetworkSchemaContentHash(bytes32 schemaId, bytes32 contentHash) external returns (bytes32);
    /// @notice ADR-0074 K3: ağ düzeyi kayıt (NetworkRegistry.stageRecord ile sabitlenmiş içeriğin özeti), 2/3.
    function proposeNetworkRecord(address registry, bytes32 stageId) external returns (bytes32);
    /// @notice ADR-0075: doğrulayıcı kimliğinin sahibi devleti değiştirir (RelyingPartyRegistry.stagePeriodChange özeti), 2/3.
    function proposeRelyingPartyReassignment(address registry, bytes32 stageId) external returns (bytes32);
    /// @notice ADR-0075: iptal edilmiş doğrulayıcı kimliğini yeni dönemle yeniden kaydeder (sabitlenmiş özet), 2/3.
    function proposeRelyingPartyReRegistration(address registry, bytes32 stageId) external returns (bytes32);

    /// @notice Oy verir ya da — öneri yürütülene kadar (kuyruktaki yükseltme dahil) — verdiği oyu öteki yöne çevirir.
    ///         Aynı yönde ikinci oy `AlreadyVoted` ile reddedilir.
    function vote(bytes32 proposalId, bool support) external;
    /// @notice Verdiği oyu geri çeker (öneri yürütülene kadar). Eşik yürütmede o anki oylardan sayılır.
    function retractVote(bytes32 proposalId) external;
    function execute(bytes32 proposalId) external;
    /// @notice Öneren, yürütülmemiş (açık ya da kuyruktaki) önerisini geri çeker; geri çekilen öneri oylanamaz ve yürütülemez.
    function cancelProposal(bytes32 proposalId) external;
    function withdraw() external;
    function setDelegateKeys(bytes2 stateCode, address[] calldata keys) external;

    function activeMemberCount() external view returns (uint32);
    function requiredVotes(bytes2 excludedState) external view returns (uint32);
    function getMember(bytes2 stateCode) external view returns (StateMember memory);
    function getProposal(bytes32 id) external view returns (Proposal memory);
    function delegateKeysOf(bytes2 stateCode) external view returns (address[] memory);
    /// @notice SPEC-BC-0001 C33 (1): bütün üye kodları (durumu `getMember` ile).
    function memberList() external view returns (bytes2[] memory);
    /// @notice Kuyruktaki yükseltmenin en erken uygulama anı (0 = kuyrukta değil).
    function executableAt(bytes32 id) external view returns (uint64);
    function getAdminPayload(bytes32 id) external view returns (AdminPayload memory);
}
