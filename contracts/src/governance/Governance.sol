// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {IERC1822Proxiable} from "@openzeppelin/contracts/interfaces/draft-IERC1822.sol";

import {IGovernance} from "../interfaces/IGovernance.sol";
import {ISovereignty} from "../interfaces/ISovereignty.sol";
import {ISchemaRegistry} from "../interfaces/ISchemaRegistry.sol";
import {ITrustListAnchorRegistry} from "../interfaces/ITrustListAnchorRegistry.sol";
import {ICrossRecognition} from "../interfaces/ICrossRecognition.sol";
import {IMigrationWindow} from "../interfaces/IMigrationWindow.sol";
import {INetworkRegistry} from "../interfaces/INetworkRegistry.sol";
import {IRelyingPartyRegistry} from "../interfaces/IRelyingPartyRegistry.sol";
import {VctNamespace} from "../schema/VctNamespace.sol";

interface IUpgradeableTarget {
    function upgradeToAndCall(address newImplementation, bytes memory data) external payable;
}

/**
 * @title  Governance
 * @notice Katman 1 — YALNIZCA ağ üyeliği ve protokol. Ulusal kayıtlar burada
 *         DEĞİLDİR; onlar registry'lerde ve `onlyOwnerState` ile korunur.
 *
 * @dev    SPEC-BC-0001 §1 / ADR-0002.
 *         Aynı zamanda ISovereignty'yi uygular — `onlyOwnerState`'in tek
 *         yetki kaynağıdır.
 *
 *         Eşik: 2/3 (kabul, çıkarma, protokol yükseltme, NETWORK şeması).
 *         Çıkarma oylamasında çıkarılanın oyu SAYILMAZ.
 *
 *         Değişmez G1: Çıkarma/çıkış yalnızca yeni yazımı durdurur; mevcut
 *         kayıtlar ve verilmiş credential'lar GEÇERSİZ OLMAZ (ADR-0002 #4).
 *
 *         ADR-0055: protokol yükseltmesi eşik dolunca KUYRUĞA alınır ve en erken
 *         UPGRADE_DELAY sonra, eşik yeniden sayılarak uygulanır (GE1); başlangıç
 *         çağrısı yalnız parametresiz seçicidir (GE2). Kayıt yönetimi türü belli
 *         önerilerle yapılır, genel çağrı yoktur (GE3).
 */
contract Governance is Initializable, UUPSUpgradeable, IGovernance, ISovereignty {
    uint256 public constant MAX_DELEGATES = 16;
    uint64 public constant PROPOSAL_TTL = 30 days;
    /// @notice ADR-0055 GE1: yükseltme kuyruğa alındıktan sonra uygulanmadan önceki bekleme.
    uint64 public constant UPGRADE_DELAY = 7 days;
    /// @notice BOOTSTRAP_FOUNDERS önerisinde en çok kurucu (döngü sınırı).
    uint256 public constant MAX_FOUNDERS = 32;
    /// @notice ADR-0073 K1: göç penceresi en çok 30 gün (kayıt kontratı da denetler).
    uint64 public constant MAX_MIGRATION_WINDOW = 30 days;

    /// @dev Review bulgusu R6: 2/3 kuralı n<3'te dejenere olur — 2 üyeli ağda
    ///      biri diğerini tek başına atabilirdi. Asgari mutlak oy sayısı.
    uint32 public constant MIN_ABSOLUTE_VOTES = 2;

    mapping(bytes2 => StateMember) private _members;
    mapping(bytes2 => address[]) private _delegateKeys;
    mapping(address => bytes2) private _delegateToState;
    mapping(address => bytes2) private _validatorToState;

    mapping(bytes32 => Proposal) private _proposals;
    mapping(bytes32 => mapping(address => bool)) private _hasVoted;
    /// @dev NETWORK_SCHEMA önerilerinin yükü ayrı tutulur (string içerdiği için).
    mapping(bytes32 => ISchemaRegistry.SchemaRecord) private _schemaPayload;

    bytes2[] private _memberList;
    uint32 private _activeCount;
    uint256 private _nonce;

    ISchemaRegistry public schemaRegistry;

    /// @dev Oyun yönü (vote). Yürütmede oylar bugünkü ACTIVE üyelerin validator'larından YENİDEN sayılır (GV3):
    ///      çekilen/çıkarılan üyenin eski oyu eşiği dolduramaz. 2026-10-19 güvenlik turu.
    mapping(bytes32 => mapping(address => bool)) private _support;

    /// @dev ADR-0055: yükseltme kuyruğu ve başlangıç seçicisi (öneri kimliğine göre).
    ///      `implCodehash` (kontrat denetimi 2026-11-11): öneri açılırken yeni implementasyonun kod özeti; yürütmede
    ///      karşılaştırılır. Yapı yalnız mapping değeridir — üye sona eklenir, sıralı düzen ve `__gap` değişmez.
    struct UpgradeQueue {
        uint64 queuedAt;
        bytes4 initSelector;
        bytes32 implCodehash;
    }

    mapping(bytes32 => UpgradeQueue) private _upgradeQueue;
    /// @dev ADR-0055 K3: REGISTRY_ADMIN önerilerinin yükü.
    mapping(bytes32 => AdminPayload) private _admin;
    /// @dev F-18: STATE_REMOVAL önerisinin gerekçe özeti (öneri kimliğine göre).
    mapping(bytes32 => bytes32) private _removalReason;

    /// @dev Oyun verildiği (ya da son değiştirildiği / tazelendiği) blok zamanı. Yürütmede oy yalnız üyenin SON kabulünden
    ///      (`joinedAt`) sonra verilmişse sayılır: çıkarılan ya da çekilen üye aynı adresle yeniden kabul edilince açık
    ///      önerilerdeki eski "evet" oyları kendiliğinden yeniden sayılmaz; başka bir devlete geçen adresin eski oyları da
    ///      sayılmaz (ikinci kontrol 2026-11-12). `__gap`'ten bir slot alındı (38 → 37).
    mapping(bytes32 => mapping(address => uint64)) private _votedAt;

    uint256[37] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @param founders Kurucu üye devlet kodları.
     * @param validators Her kurucunun validator adresi (aynı sırada).
     * @dev   Kurucular oy olmadan ACTIVE başlar (ADR-0002 #3). En az iki kurucu gerekir (ADR-0076 GC4): tek üyeyle asgari
     *        mutlak oy (2) hiçbir zaman dolmaz, yönetişim ilk bloktan kilitli doğardı.
     */
    function initialize(bytes2[] calldata founders, address[] calldata validators)
        external
        initializer
    {
        if (founders.length < MIN_ABSOLUTE_VOTES || founders.length != validators.length) revert FounderMismatch();

        for (uint256 i = 0; i < founders.length; i++) {
            // Kontrat denetimi 2026-11-11: sıfır devlet kodu üye olamaz (`proposeStateAdmission` ile aynı kural).
            if (founders[i] == bytes2(0) || validators[i] == address(0)) revert ZeroAddress();
            if (_members[founders[i]].status != MemberStatus.NONE) revert MemberExists(founders[i]);
            bytes2 used = _validatorToState[validators[i]];
            if (used != bytes2(0)) revert ValidatorInUse(validators[i], used);

            _members[founders[i]] = StateMember({
                stateCode: founders[i],
                validatorAddress: validators[i],
                status: MemberStatus.ACTIVE,
                joinedAt: uint64(block.timestamp)
            });
            _validatorToState[validators[i]] = founders[i];
            _memberList.push(founders[i]);
            _activeCount++;
            emit StateAdmitted(founders[i], validators[i]);
        }
    }

    error SchemaRegistryAlreadySet();
    error NotNetworkTier();
    error FounderMismatch();

    /**
     * @notice SchemaRegistry adresini bağlar. Dağıtım sırasında BİR KEZ.
     * @dev    Sonradan değiştirilemez — değiştirilebilir olsaydı, tek bir
     *         anahtar NETWORK şema kaydını sahte bir kontrata yönlendirebilirdi.
     *         Değişmesi gerekirse protokol yükseltmesiyle (2/3 oy) yapılır.
     */
    function setSchemaRegistry(address registry) external onlyValidator {
        if (address(schemaRegistry) != address(0)) revert SchemaRegistryAlreadySet();
        if (registry == address(0)) revert ZeroAddress();
        schemaRegistry = ISchemaRegistry(registry);
        emit SchemaRegistrySet(registry);
    }

    // -----------------------------------------------------------------
    // ISovereignty
    // -----------------------------------------------------------------

    /// @inheritdoc ISovereignty
    function isDelegateOf(address account, bytes2 stateCode) external view returns (bool) {
        if (_members[stateCode].status != MemberStatus.ACTIVE) return false;
        return _delegateToState[account] == stateCode && stateCode != bytes2(0);
    }

    /// @inheritdoc ISovereignty
    function isActiveMember(bytes2 stateCode) external view returns (bool) {
        return _members[stateCode].status == MemberStatus.ACTIVE;
    }

    // -----------------------------------------------------------------
    // Delegate anahtarları — devletin kendi iç işi, OY GEREKMEZ
    // -----------------------------------------------------------------

    /// @inheritdoc IGovernance
    function setDelegateKeys(bytes2 stateCode, address[] calldata keys) external {
        StateMember storage m = _members[stateCode];
        if (m.status != MemberStatus.ACTIVE) revert UnknownMember(stateCode);
        // Yalnızca o devletin validator'ı kendi delegate listesini değiştirebilir.
        if (msg.sender != m.validatorAddress) revert NotValidator(msg.sender);
        if (keys.length > MAX_DELEGATES) revert TooManyDelegates(keys.length, MAX_DELEGATES);

        _clearDelegates(stateCode);

        for (uint256 i = 0; i < keys.length; i++) {
            if (keys[i] == address(0)) revert ZeroAddress();
            // N1: başka bir devletin anahtarı bu devlete yazılamaz (yazılsaydı o devletin yazma yetkisi düşerdi).
            bytes2 owner = _delegateToState[keys[i]];
            if (owner != bytes2(0) && owner != stateCode) revert DelegateKeyInUse(keys[i], owner);
            _delegateKeys[stateCode].push(keys[i]);
            _delegateToState[keys[i]] = stateCode;
        }
        emit DelegateKeysSet(stateCode, keys);
    }

    /// @dev Devletin delege listesini boşaltır; yalnız HÂLÂ bu devlete eşli anahtarların eşlemesini siler.
    function _clearDelegates(bytes2 stateCode) private {
        address[] storage old = _delegateKeys[stateCode];
        for (uint256 i = 0; i < old.length; i++) {
            if (_delegateToState[old[i]] == stateCode) delete _delegateToState[old[i]];
        }
        delete _delegateKeys[stateCode];
    }

    /// @dev Validator adresi başka bir devlete aitse reddeder (yeniden kabulde aynı devletin eski adresi serbesttir).
    function _requireValidatorFree(address validator, bytes2 stateCode) private view {
        bytes2 used = _validatorToState[validator];
        if (used != bytes2(0) && used != stateCode) revert ValidatorInUse(validator, used);
    }

    // -----------------------------------------------------------------
    // Öneriler
    // -----------------------------------------------------------------

    /// @dev Gövde ayrı fonksiyondadır: değiştirici her kullanımda satır içine kopyalanır (EIP-170 bayt payı).
    modifier onlyValidator() {
        _requireValidator();
        _;
    }

    function _requireValidator() private view {
        bytes2 s = _validatorToState[msg.sender];
        if (s == bytes2(0) || _members[s].status != MemberStatus.ACTIVE) revert NotValidator(msg.sender);
    }

    function _newProposal(ProposalKind kind) private returns (bytes32 id) {
        id = keccak256(abi.encodePacked(kind, msg.sender, block.timestamp, _nonce++));
        Proposal storage p = _proposals[id];
        p.id = id;
        p.kind = kind;
        p.status = ProposalStatus.OPEN;
        p.proposer = msg.sender;
        p.createdAt = uint64(block.timestamp);
        p.expiresAt = uint64(block.timestamp) + PROPOSAL_TTL;
        emit ProposalCreated(id, kind, msg.sender);
    }

    /// @inheritdoc IGovernance
    function proposeStateAdmission(bytes2 stateCode, address validator)
        external onlyValidator returns (bytes32 id)
    {
        if (stateCode == bytes2(0) || validator == address(0)) revert ZeroAddress();
        // Review R7: ACTIVE ise zaten üye; SUSPENDED/WITHDRAWN ise YENİDEN KABUL mümkün.
        if (_members[stateCode].status == MemberStatus.ACTIVE) revert MemberExists(stateCode);
        _requireValidatorFree(validator, stateCode);
        id = _newProposal(ProposalKind.STATE_ADMISSION);
        _proposals[id].stateCode = stateCode;
        _proposals[id].validatorAddress = validator;
    }

    /// @inheritdoc IGovernance
    function proposeStateRemoval(bytes2 stateCode, bytes32 reasonHash) external onlyValidator returns (bytes32 id) {
        if (_members[stateCode].status != MemberStatus.ACTIVE) revert UnknownMember(stateCode);
        if (_activeCount <= 1) revert LastValidator();
        id = _newProposal(ProposalKind.STATE_REMOVAL);
        _proposals[id].stateCode = stateCode;
        _removalReason[id] = reasonHash;
    }

    /// @inheritdoc IGovernance
    function proposeProtocolUpgrade(address target, address newImplementation)
        external onlyValidator returns (bytes32 id)
    {
        id = _proposeUpgrade(target, newImplementation);
    }

    function _proposeUpgrade(address target, address newImplementation) private returns (bytes32 id) {
        if (target == address(0) || newImplementation == address(0)) revert ZeroAddress();

        // SPEC-BC-0001 §9 — brick koruması, azaltma 3.
        // Yeni implementasyon UUPS uyumlu değilse öneri hiç açılmaz.
        try IERC1822Proxiable(newImplementation).proxiableUUID() returns (bytes32 slot) {
            if (slot != 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc) {
                revert UpgradeTargetNotProxiable(newImplementation);
            }
        } catch {
            revert UpgradeTargetNotProxiable(newImplementation);
        }

        id = _newProposal(ProposalKind.PROTOCOL_UPGRADE);
        _proposals[id].target = target;
        _proposals[id].newImplementation = newImplementation;
        // Kontrat denetimi 2026-11-11: oylanan şey adres değil KODDUR. Kod özeti burada sabitlenir, `execute` karşılaştırır.
        // Zincir Cancun kurallarındadır (ADR-0077): SELFDESTRUCT kodu silmez (EIP-6780), aynı adrese başka kod konamaz;
        // denetim ikinci savunma hattı olarak kalır (kural seti değişirse ya da kod başka bir yoldan değişirse).
        _upgradeQueue[id].implCodehash = newImplementation.codehash;
    }

    /// @inheritdoc IGovernance
    function proposeProtocolUpgradeAndInit(address target, address newImplementation, bytes4 initSelector)
        external onlyValidator returns (bytes32 id)
    {
        id = _proposeUpgrade(target, newImplementation);
        _upgradeQueue[id].initSelector = initSelector;
    }

    /// @inheritdoc IGovernance
    function proposeNetworkSchema(ISchemaRegistry.SchemaRecord calldata rec)
        external onlyValidator returns (bytes32 id)
    {
        if (rec.tier != ISchemaRegistry.SchemaTier.NETWORK) revert NotNetworkTier();
        // ADR-0054 NS1: devlet-özel ad alanındaki bir vct ağ şeması olarak önerilemez
        if (VctNamespace.nationalStateOf(rec.vctURI) != bytes2(0)) revert NetworkVctInNationalNamespace();
        id = _newProposal(ProposalKind.NETWORK_SCHEMA);
        _schemaPayload[id] = rec;
    }

    // -----------------------------------------------------------------
    // Kayıt yönetimi önerileri — ADR-0055 K3 (türü belli, genel çağrı yok)
    // -----------------------------------------------------------------

    function _requireAdminTarget(address target) private view {
        if (target == address(0) || target == address(this) || target.code.length == 0) {
            revert InvalidAdminTarget(target);
        }
    }

    function _newAdmin(AdminAction action, address registry) private returns (bytes32 id, AdminPayload storage a) {
        _requireAdminTarget(registry);
        id = _newProposal(ProposalKind.REGISTRY_ADMIN);
        a = _admin[id];
        a.action = action;
        a.registry = registry;
    }

    /// @dev Bağlı SchemaRegistry'ye giden ağ şeması yönetim önerisi (hedef öneriyle verilmez).
    function _newSchemaAdmin(AdminAction action, bytes32 schemaId)
        private
        returns (bytes32 id, AdminPayload storage a)
    {
        address registry = address(schemaRegistry);
        if (registry == address(0)) revert SchemaRegistryNotSet();
        (id, a) = _newAdmin(action, registry);
        a.schemaId = schemaId;
    }

    /// @inheritdoc IGovernance
    function proposeAnchorerChange(address registry, address anchorer, bool allowed)
        external onlyValidator returns (bytes32 id)
    {
        if (anchorer == address(0)) revert ZeroAddress();
        AdminPayload storage a;
        (id, a) = _newAdmin(AdminAction.SET_ANCHORER, registry);
        a.account = anchorer;
        a.allowed = allowed;
    }

    /// @inheritdoc IGovernance
    function proposeAnchorThreshold(address registry, uint8 required) external onlyValidator returns (bytes32 id) {
        AdminPayload storage a;
        (id, a) = _newAdmin(AdminAction.SET_ANCHOR_THRESHOLD, registry);
        a.required = required;
    }

    /// @inheritdoc IGovernance
    function proposeFounderRecognition(address registry, bytes2[] calldata founders)
        external onlyValidator returns (bytes32 id)
    {
        if (founders.length < 2 || founders.length > MAX_FOUNDERS) revert FounderMismatch();
        AdminPayload storage a;
        (id, a) = _newAdmin(AdminAction.BOOTSTRAP_FOUNDERS, registry);
        for (uint256 i = 0; i < founders.length; i++) a.founders.push(founders[i]);
    }

    /// @inheritdoc IGovernance
    function proposeNetworkSchemaDeprecation(bytes32 schemaId, bytes32 supersededBy)
        external onlyValidator returns (bytes32 id)
    {
        AdminPayload storage a;
        (id, a) = _newSchemaAdmin(AdminAction.DEPRECATE_NETWORK_SCHEMA, schemaId);
        a.supersededBy = supersededBy;
    }

    /// @inheritdoc IGovernance
    function proposeNetworkSchemaRevocation(bytes32 schemaId, bytes32 reasonHash)
        external onlyValidator returns (bytes32 id)
    {
        AdminPayload storage a;
        (id, a) = _newSchemaAdmin(AdminAction.REVOKE_NETWORK_SCHEMA, schemaId);
        a.reasonHash = reasonHash;
    }

    // -----------------------------------------------------------------
    // Göç kipi önerileri — ADR-0073 K1 (kayıt başına, türü belli)
    // -----------------------------------------------------------------

    /// @inheritdoc IGovernance
    function proposeMigrationOpen(address registry, bytes32 replayPlanHash, uint64 window, address executor)
        external onlyValidator returns (bytes32 id)
    {
        if (replayPlanHash == bytes32(0) || window == 0 || window > MAX_MIGRATION_WINDOW) {
            revert InvalidMigrationProposal();
        }
        AdminPayload storage a;
        (id, a) = _newAdmin(AdminAction.OPEN_MIGRATION, registry);
        a.digest = replayPlanHash;
        a.window = window;
        a.account = executor;
    }

    /// @inheritdoc IGovernance
    function proposeMigrationExtend(address registry, uint64 deadline) external onlyValidator returns (bytes32 id) {
        AdminPayload storage a;
        (id, a) = _newAdmin(AdminAction.EXTEND_MIGRATION, registry);
        a.window = deadline;
    }

    /// @inheritdoc IGovernance
    function proposeMigrationClose(address registry) external onlyValidator returns (bytes32 id) {
        (id, ) = _newAdmin(AdminAction.CLOSE_MIGRATION, registry);
    }

    /// @inheritdoc IGovernance
    function proposeNetworkSchemaContentHash(bytes32 schemaId, bytes32 contentHash)
        external onlyValidator returns (bytes32 id)
    {
        AdminPayload storage a;
        (id, a) = _newSchemaAdmin(AdminAction.ADD_NETWORK_SCHEMA_HASH, schemaId);
        a.digest = contentHash;
    }

    /// @inheritdoc IGovernance
    function proposeNetworkRecord(address registry, bytes32 stageId) external onlyValidator returns (bytes32 id) {
        id = _proposeStaged(AdminAction.NETWORK_RECORD, registry, stageId);
    }

    /// @inheritdoc IGovernance
    function proposeRelyingPartyReassignment(address registry, bytes32 stageId)
        external onlyValidator returns (bytes32 id)
    {
        id = _proposeStaged(AdminAction.REASSIGN_RELYING_PARTY, registry, stageId);
    }

    /// @inheritdoc IGovernance
    function proposeRelyingPartyReRegistration(address registry, bytes32 stageId)
        external onlyValidator returns (bytes32 id)
    {
        id = _proposeStaged(AdminAction.REREGISTER_RELYING_PARTY, registry, stageId);
    }

    /// @dev Kayıtta sabitlenmiş içeriğin özetini taşıyan öneri (ADR-0074 K3 deseni; ADR-0075 aynı deseni kullanır).
    function _proposeStaged(AdminAction action, address registry, bytes32 stageId) private returns (bytes32 id) {
        AdminPayload storage a;
        (id, a) = _newAdmin(action, registry);
        a.digest = stageId;
    }

    // -----------------------------------------------------------------
    // Oylama
    // -----------------------------------------------------------------

    /// @inheritdoc IGovernance
    function vote(bytes32 proposalId, bool support) external onlyValidator {
        Proposal storage p = _openProposal(proposalId);
        _requireVotable(p, proposalId);

        // ADR-0002: çıkarma oylamasında çıkarılanın oyu SAYILMAZ.
        if (p.kind == ProposalKind.STATE_REMOVAL && _validatorToState[msg.sender] == p.stateCode) {
            revert NotValidator(msg.sender);
        }

        if (_hasVoted[proposalId][msg.sender]) {
            // Oy değiştirme (kontrol 2026-11-10): öneri yürütülene kadar — kuyruktaki yükseltme dahil — üye oyunu çevirebilir.
            // Aynı yönde ikinci oy yine reddedilir (çift sayım yok).
            // Tek istisna: üyenin son kabulünden ÖNCE verilmiş (artık sayılmayan) oy aynı yönde yeniden verilebilir — sayaçlar
            // değişmez, yalnız oyun zamanı tazelenir.
            if (_support[proposalId][msg.sender] == support) {
                if (_votedAt[proposalId][msg.sender] >= _members[_validatorToState[msg.sender]].joinedAt) {
                    revert AlreadyVoted(proposalId, msg.sender);
                }
            } else if (support) {
                p.againstVotes--;
                p.forVotes++;
            } else {
                p.forVotes--;
                p.againstVotes++;
            }
        } else {
            _hasVoted[proposalId][msg.sender] = true;
            if (support) p.forVotes++;
            else p.againstVotes++;
        }
        _support[proposalId][msg.sender] = support;
        _votedAt[proposalId][msg.sender] = uint64(block.timestamp);
        emit Voted(proposalId, msg.sender, support);
    }

    /// @inheritdoc IGovernance
    function retractVote(bytes32 proposalId) external onlyValidator {
        Proposal storage p = _openProposal(proposalId);
        _requireVotable(p, proposalId);
        if (!_hasVoted[proposalId][msg.sender]) revert NoVote(proposalId, msg.sender);
        if (_support[proposalId][msg.sender]) p.forVotes--;
        else p.againstVotes--;
        _hasVoted[proposalId][msg.sender] = false;
        _support[proposalId][msg.sender] = false;
        emit VoteRetracted(proposalId, msg.sender);
    }

    /// @dev Bilinen ve hâlâ açık öneri (oy, geri çekme, yürütme ortak denetimi).
    function _openProposal(bytes32 proposalId) private view returns (Proposal storage p) {
        p = _proposals[proposalId];
        if (p.status == ProposalStatus.NONE) revert UnknownProposal(proposalId);
        if (p.status != ProposalStatus.OPEN) revert ProposalNotOpen(proposalId);
    }

    /// @dev Oy verme / değiştirme / geri çekme penceresi: açık öneride `expiresAt`'a kadar; kuyruktaki yükseltmede uygulama
    ///      penceresinin sonuna (eta + PROPOSAL_TTL) kadar — bekleme süresi tam da üyelerin fikir değiştirebilmesi içindir.
    ///      `execute` eşiği her seferinde o anki oylardan yeniden sayar; geri çekilen oyla eşik düşerse yükseltme uygulanmaz.
    function _requireVotable(Proposal storage p, bytes32 proposalId) private view {
        uint64 queuedAt = _upgradeQueue[proposalId].queuedAt;
        uint64 until = queuedAt != 0 ? queuedAt + UPGRADE_DELAY + PROPOSAL_TTL : p.expiresAt;
        if (block.timestamp > until) revert ProposalExpired(proposalId);
    }

    /// @inheritdoc IGovernance
    function requiredVotes(bytes2 excludedState) public view returns (uint32) {
        uint32 eligible = _activeCount;
        if (excludedState != bytes2(0) && _members[excludedState].status == MemberStatus.ACTIVE) {
            eligible -= 1;
        }
        // 2/3, yukarı yuvarlanır; ancak hiçbir zaman MIN_ABSOLUTE_VOTES'un altına inmez.
        uint32 twoThirds = (eligible * 2 + 2) / 3;
        return twoThirds < MIN_ABSOLUTE_VOTES ? MIN_ABSOLUTE_VOTES : twoThirds;
    }

    /// @inheritdoc IGovernance
    function execute(bytes32 proposalId) external {
        Proposal storage p = _openProposal(proposalId);

        UpgradeQueue storage q = _upgradeQueue[proposalId];
        bool queued = q.queuedAt != 0;
        if (queued) {
            // GE1: kuyruktaki yükseltme bekleme süresinden önce uygulanamaz; oylama süresi (TTL) artık bağlamaz,
            // uygulama penceresi eta + PROPOSAL_TTL'dir.
            uint64 eta = q.queuedAt + UPGRADE_DELAY;
            if (block.timestamp < eta) revert UpgradeNotReady(proposalId, eta);
            if (block.timestamp > eta + PROPOSAL_TTL) revert ProposalExpired(proposalId);
        } else if (block.timestamp > p.expiresAt) {
            revert ProposalExpired(proposalId);
        }

        bytes2 excluded = p.kind == ProposalKind.STATE_REMOVAL ? p.stateCode : bytes2(0);
        uint32 need = requiredVotes(excluded);
        // GV3: eşik bugünkü ACTIVE üyelerin oylarıyla karşılaştırılır; `forVotes` atılan oyların ham sayısıdır.
        uint32 counted = _countedForVotes(proposalId, excluded);
        if (counted < need) revert ThresholdNotMet(counted, need);

        // Kuyruğa alınırken de uygulanırken de: implementasyonun kodu öneri açıldığındaki kod olmalı.
        if (p.kind == ProposalKind.PROTOCOL_UPGRADE && p.newImplementation.codehash != q.implCodehash) {
            revert UpgradeImplementationChanged(p.newImplementation);
        }

        if (p.kind == ProposalKind.PROTOCOL_UPGRADE && !queued) {
            // GE1: eşik doldu — uygulanmaz, kuyruğa alınır
            uint64 now_ = uint64(block.timestamp);
            q.queuedAt = now_;
            emit ProposalQueued(proposalId, now_ + UPGRADE_DELAY);
            return;
        }

        p.status = ProposalStatus.EXECUTED;
        // Olay dış çağrılardan ÖNCE (checks-effects-interactions); çağrı düşerse işlem bütünüyle geri alınır.
        emit ProposalExecuted(proposalId);

        if (p.kind == ProposalKind.STATE_ADMISSION) {
            _admit(p.stateCode, p.validatorAddress);
        } else if (p.kind == ProposalKind.STATE_REMOVAL) {
            _remove(p.stateCode, _removalReason[proposalId]);
        } else if (p.kind == ProposalKind.PROTOCOL_UPGRADE) {
            // GE2: başlangıç çağrısı yalnız parametresiz seçici
            bytes memory init = q.initSelector == bytes4(0) ? bytes("") : abi.encodeWithSelector(q.initSelector);
            // ADR-0073 K1: yükseltme göç durumunu değiştiremez (kapanmış kip açılamaz, pencere uzatılamaz).
            (bool hadState, bytes memory before) = _migrationStateOf(p.target);
            IUpgradeableTarget(p.target).upgradeToAndCall(p.newImplementation, init);
            if (hadState) {
                (bool ok, bytes memory after_) = _migrationStateOf(p.target);
                if (!ok || keccak256(after_) != keccak256(before)) revert MigrationStateChanged(p.target);
            }
        } else if (p.kind == ProposalKind.NETWORK_SCHEMA) {
            schemaRegistry.registerSchema(_schemaPayload[proposalId]);
        } else if (p.kind == ProposalKind.REGISTRY_ADMIN) {
            _executeAdmin(_admin[proposalId]);
        }
    }

    /// @inheritdoc IGovernance
    function cancelProposal(bytes32 proposalId) external onlyValidator {
        Proposal storage p = _proposals[proposalId];
        if (p.status != ProposalStatus.OPEN) revert ProposalNotOpen(proposalId);
        if (msg.sender != p.proposer) revert NotProposer(msg.sender);
        p.status = ProposalStatus.CANCELLED;
        emit ProposalCancelled(proposalId);
    }

    /// @dev ADR-0055 K3 — yalnız türü belli çağrılar (GE3).
    function _executeAdmin(AdminPayload storage a) private {
        if (a.action == AdminAction.SET_ANCHORER) {
            ITrustListAnchorRegistry(a.registry).setAnchorer(a.account, a.allowed);
        } else if (a.action == AdminAction.SET_ANCHOR_THRESHOLD) {
            ITrustListAnchorRegistry(a.registry).setRequiredConfirmations(a.required);
        } else if (a.action == AdminAction.BOOTSTRAP_FOUNDERS) {
            ICrossRecognition(a.registry).bootstrapFounders(a.founders);
        } else if (a.action == AdminAction.DEPRECATE_NETWORK_SCHEMA) {
            ISchemaRegistry(a.registry).deprecateSchema(a.schemaId, a.supersededBy);
        } else if (a.action == AdminAction.REVOKE_NETWORK_SCHEMA) {
            ISchemaRegistry(a.registry).revokeSchema(a.schemaId, a.reasonHash);
        } else if (a.action == AdminAction.OPEN_MIGRATION) {
            // Pencere yürütme anından sayılır (öneri oylanırken süre işlemez).
            IMigrationWindow(a.registry).openMigration(a.digest, uint64(block.timestamp) + a.window, a.account);
        } else if (a.action == AdminAction.EXTEND_MIGRATION) {
            IMigrationWindow(a.registry).extendMigration(a.window);
        } else if (a.action == AdminAction.CLOSE_MIGRATION) {
            IMigrationWindow(a.registry).closeMigration();
        } else if (a.action == AdminAction.ADD_NETWORK_SCHEMA_HASH) {
            ISchemaRegistry(a.registry).addSchemaContentHash(a.schemaId, a.digest);
        } else if (a.action == AdminAction.NETWORK_RECORD) {
            INetworkRegistry(a.registry).commitStaged(a.digest);
        } else if (a.action == AdminAction.REASSIGN_RELYING_PARTY) {
            IRelyingPartyRegistry(a.registry).commitPeriodChange(a.digest, IRelyingPartyRegistry.PeriodAction.REASSIGNMENT);
        } else if (a.action == AdminAction.REREGISTER_RELYING_PARTY) {
            IRelyingPartyRegistry(a.registry).commitPeriodChange(a.digest, IRelyingPartyRegistry.PeriodAction.RE_REGISTRATION);
        }
    }

    /// @dev Hedef göç kipini taşıyorsa ham durumunu döndürür (taşımıyorsa `ok` = false). Yalnız okuma (staticcall).
    // Bilerek düşük düzey: hedef göç kipini taşımayabilir (Governance, TrustListAnchorRegistry); staticcall yalnız okur,
    // başarısızlık ve dönüş uzunluğu aşağıda denetlenir.
    // slither-disable-next-line low-level-calls
    function _migrationStateOf(address target) private view returns (bool ok, bytes memory state) {
        (ok, state) = target.staticcall(abi.encodeWithSelector(IMigrationWindow.migrationState.selector));
        if (ok && state.length != 160) ok = false; // beş sözcük: (phase, openedAt, deadline, replayPlanHash, executor)
    }

    /// @dev Destek oylarını bugünkü ACTIVE üyelerin bugünkü validator adresinden sayar; çıkarma hedefi sayılmaz.
    ///      Oy, üyenin son kabulünden sonra verilmiş olmalıdır (`_votedAt` ≥ `joinedAt`): yeniden kabul edilen üyenin önceki
    ///      üyelik dönemindeki oyu sayılmaz; üye oyunu yeniden verir. Üye sayısı küçüktür (devlet sayısı); döngü sınırlıdır.
    function _countedForVotes(bytes32 proposalId, bytes2 excluded) private view returns (uint32 n) {
        uint256 len = _memberList.length;
        for (uint256 i = 0; i < len; i++) {
            bytes2 s = _memberList[i];
            StateMember storage m = _members[s];
            if (m.status != MemberStatus.ACTIVE || s == excluded) continue;
            address v = m.validatorAddress;
            if (_hasVoted[proposalId][v] && _support[proposalId][v] && _votedAt[proposalId][v] >= m.joinedAt) n++;
        }
    }

    /// @notice Bir önerinin yürütmede sayılacak destek oyu (bugünkü ACTIVE üyeler; çıkarma hedefi hariç).
    function countedForVotes(bytes32 proposalId) external view returns (uint32) {
        Proposal storage p = _proposals[proposalId];
        return _countedForVotes(proposalId, p.kind == ProposalKind.STATE_REMOVAL ? p.stateCode : bytes2(0));
    }

    // -----------------------------------------------------------------
    // Üyelik
    // -----------------------------------------------------------------

    function _admit(bytes2 stateCode, address validator) private {
        StateMember storage m = _members[stateCode];
        if (m.status == MemberStatus.ACTIVE) revert MemberExists(stateCode);
        _requireValidatorFree(validator, stateCode); // öneri ile yürütme arasında adres başka devlete geçmiş olabilir

        bool readmission = (m.status != MemberStatus.NONE);
        if (readmission) {
            // Eski validator eşlemesini temizle; eski delegate anahtarları da düşer (yalnız bu devlete eşli olanlar).
            if (_validatorToState[m.validatorAddress] == stateCode) delete _validatorToState[m.validatorAddress];
            _clearDelegates(stateCode);
        } else {
            _memberList.push(stateCode);
        }

        m.stateCode = stateCode;
        m.validatorAddress = validator;
        m.status = MemberStatus.ACTIVE;
        m.joinedAt = uint64(block.timestamp);
        _validatorToState[validator] = stateCode;
        _activeCount++;
        emit StateAdmitted(stateCode, validator);
    }

    /**
     * @dev DEĞİŞMEZ G1: Bu fonksiyon YALNIZCA üyelik durumunu değiştirir.
     *      Hiçbir issuer, şema, RP kaydına dokunmaz ve dokunmamalıdır.
     *      Çıkarılan devletin kurumlarının verdiği credential'lar geçerli
     *      kalır (ADR-0002 #4). Yeni yazma `isDelegateOf` üzerinden durur.
     */
    function _remove(bytes2 stateCode, bytes32 reasonHash) private {
        StateMember storage m = _members[stateCode];
        // Hedef öneri açıkken çekilmiş ya da başka bir öneriyle çıkarılmış olabilir: sayaç İKİ KEZ düşmemeli (GV3).
        if (m.status != MemberStatus.ACTIVE) revert UnknownMember(stateCode);
        m.status = MemberStatus.SUSPENDED;
        _activeCount--;
        emit StateRemoved(stateCode, reasonHash);
    }

    /// @inheritdoc IGovernance
    /// @dev ADR-0076 GC1: çıkıştan sonra etkin üye sayısı asgari mutlak oyun (2) altına inemez. İki üyeli ağda tek üye
    ///      kalsaydı hiçbir öneri yürütülemez, yeni üye kabul edilemezdi (yönetişim kalıcı kilitlenirdi); çıkmak isteyen
    ///      üye önce üçüncü üyenin kabulünü bekler.
    function withdraw() external onlyValidator {
        bytes2 s = _validatorToState[msg.sender];
        if (_activeCount <= MIN_ABSOLUTE_VOTES) revert TooFewMembers(_activeCount, MIN_ABSOLUTE_VOTES + 1);
        _members[s].status = MemberStatus.WITHDRAWN;
        _activeCount--;
        emit StateWithdrawn(s);
    }

    // -----------------------------------------------------------------
    // Okuma
    // -----------------------------------------------------------------

    function activeMemberCount() external view returns (uint32) {return _activeCount;}
    function getMember(bytes2 stateCode) external view returns (StateMember memory) {return _members[stateCode];}
    function getProposal(bytes32 id) external view returns (Proposal memory) {return _proposals[id];}
    function delegateKeysOf(bytes2 stateCode) external view returns (address[] memory) {
        return _delegateKeys[stateCode];
    }

    function memberList() external view returns (bytes2[] memory) {
        return _memberList;
    }

    /// @inheritdoc IGovernance
    function executableAt(bytes32 id) external view returns (uint64) {
        uint64 q = _upgradeQueue[id].queuedAt;
        return q == 0 ? 0 : q + UPGRADE_DELAY;
    }

    /// @inheritdoc IGovernance
    function getAdminPayload(bytes32 id) external view returns (AdminPayload memory) {
        return _admin[id];
    }

    /// @inheritdoc IGovernance
    function getSchemaPayload(bytes32 id) external view returns (ISchemaRegistry.SchemaRecord memory) {
        return _schemaPayload[id];
    }

    /// @inheritdoc IGovernance
    function upgradePayloadOf(bytes32 id) external view returns (bytes4 initSelector, bytes32 implCodehash) {
        UpgradeQueue storage q = _upgradeQueue[id];
        return (q.initSelector, q.implCodehash);
    }

    /// @inheritdoc IGovernance
    function removalReasonOf(bytes32 id) external view returns (bytes32) {
        return _removalReason[id];
    }

    function _authorizeUpgrade(address) internal view override {
        if (msg.sender != address(this)) revert NotGovernance(msg.sender);
    }
}
