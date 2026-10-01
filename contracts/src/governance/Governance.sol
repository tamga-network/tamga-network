// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IERC1822Proxiable} from "@openzeppelin/contracts/interfaces/draft-IERC1822.sol";

import {IGovernance} from "../interfaces/IGovernance.sol";
import {ISovereignty} from "../interfaces/ISovereignty.sol";
import {ISchemaRegistry} from "../interfaces/ISchemaRegistry.sol";

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
 */
contract Governance is Initializable, UUPSUpgradeable, IGovernance, ISovereignty {
    uint256 public constant MAX_DELEGATES = 16;
    uint64 public constant PROPOSAL_TTL = 30 days;

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

    uint256[42] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @param founders Kurucu üye devlet kodları.
     * @param validators Her kurucunun validator adresi (aynı sırada).
     * @dev   Kurucular oy olmadan ACTIVE başlar (ADR-0002 #3).
     */
    function initialize(bytes2[] calldata founders, address[] calldata validators)
        external
        initializer
    {
        if (founders.length == 0 || founders.length != validators.length) revert FounderMismatch();
        __UUPSUpgradeable_init();

        for (uint256 i = 0; i < founders.length; i++) {
            if (validators[i] == address(0)) revert ZeroAddress();
            if (_members[founders[i]].status != MemberStatus.NONE) revert MemberExists(founders[i]);

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

        address[] storage old = _delegateKeys[stateCode];
        for (uint256 i = 0; i < old.length; i++) {
            delete _delegateToState[old[i]];
        }
        delete _delegateKeys[stateCode];

        for (uint256 i = 0; i < keys.length; i++) {
            if (keys[i] == address(0)) revert ZeroAddress();
            _delegateKeys[stateCode].push(keys[i]);
            _delegateToState[keys[i]] = stateCode;
        }
        emit DelegateKeysSet(stateCode, keys.length);
    }

    // -----------------------------------------------------------------
    // Öneriler
    // -----------------------------------------------------------------

    modifier onlyValidator() {
        bytes2 s = _validatorToState[msg.sender];
        if (s == bytes2(0) || _members[s].status != MemberStatus.ACTIVE) revert NotValidator(msg.sender);
        _;
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
        id = _newProposal(ProposalKind.STATE_ADMISSION);
        _proposals[id].stateCode = stateCode;
        _proposals[id].validatorAddress = validator;
    }

    /// @inheritdoc IGovernance
    function proposeStateRemoval(bytes2 stateCode, string calldata) external onlyValidator returns (bytes32 id) {
        if (_members[stateCode].status != MemberStatus.ACTIVE) revert UnknownMember(stateCode);
        if (_activeCount <= 1) revert LastValidator();
        id = _newProposal(ProposalKind.STATE_REMOVAL);
        _proposals[id].stateCode = stateCode;
    }

    /// @inheritdoc IGovernance
    function proposeProtocolUpgrade(address target, address newImplementation)
        external onlyValidator returns (bytes32 id)
    {
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
    }

    /// @inheritdoc IGovernance
    function proposeNetworkSchema(ISchemaRegistry.SchemaRecord calldata rec)
        external onlyValidator returns (bytes32 id)
    {
        if (rec.tier != ISchemaRegistry.SchemaTier.NETWORK) revert NotNetworkTier();
        id = _newProposal(ProposalKind.NETWORK_SCHEMA);
        _schemaPayload[id] = rec;
    }

    // -----------------------------------------------------------------
    // Oylama
    // -----------------------------------------------------------------

    /// @inheritdoc IGovernance
    function vote(bytes32 proposalId, bool support) external onlyValidator {
        Proposal storage p = _proposals[proposalId];
        if (p.status == ProposalStatus.NONE) revert UnknownProposal(proposalId);
        if (p.status != ProposalStatus.OPEN) revert ProposalNotOpen(proposalId);
        if (block.timestamp > p.expiresAt) revert ProposalExpired(proposalId);
        if (_hasVoted[proposalId][msg.sender]) revert AlreadyVoted(proposalId, msg.sender);

        // ADR-0002: çıkarma oylamasında çıkarılanın oyu SAYILMAZ.
        if (p.kind == ProposalKind.STATE_REMOVAL && _validatorToState[msg.sender] == p.stateCode) {
            revert NotValidator(msg.sender);
        }

        _hasVoted[proposalId][msg.sender] = true;
        if (support) p.forVotes++;
        else p.againstVotes++;
        emit Voted(proposalId, msg.sender, support);
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
        Proposal storage p = _proposals[proposalId];
        if (p.status == ProposalStatus.NONE) revert UnknownProposal(proposalId);
        if (p.status != ProposalStatus.OPEN) revert ProposalNotOpen(proposalId);
        if (block.timestamp > p.expiresAt) revert ProposalExpired(proposalId);

        bytes2 excluded = p.kind == ProposalKind.STATE_REMOVAL ? p.stateCode : bytes2(0);
        uint32 need = requiredVotes(excluded);
        if (p.forVotes < need) revert ThresholdNotMet(p.forVotes, need);

        p.status = ProposalStatus.EXECUTED;

        if (p.kind == ProposalKind.STATE_ADMISSION) {
            _admit(p.stateCode, p.validatorAddress);
        } else if (p.kind == ProposalKind.STATE_REMOVAL) {
            _remove(p.stateCode);
        } else if (p.kind == ProposalKind.PROTOCOL_UPGRADE) {
            IUpgradeableTarget(p.target).upgradeToAndCall(p.newImplementation, "");
        } else if (p.kind == ProposalKind.NETWORK_SCHEMA) {
            schemaRegistry.registerSchema(_schemaPayload[proposalId]);
        }

        emit ProposalExecuted(proposalId);
    }

    // -----------------------------------------------------------------
    // Üyelik
    // -----------------------------------------------------------------

    function _admit(bytes2 stateCode, address validator) private {
        StateMember storage m = _members[stateCode];
        if (m.status == MemberStatus.ACTIVE) revert MemberExists(stateCode);

        bool readmission = (m.status != MemberStatus.NONE);
        if (readmission) {
            // Eski validator eşlemesini temizle; eski delegate anahtarları da düşer.
            delete _validatorToState[m.validatorAddress];
            address[] storage old = _delegateKeys[stateCode];
            for (uint256 i = 0; i < old.length; i++) delete _delegateToState[old[i]];
            delete _delegateKeys[stateCode];
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
    function _remove(bytes2 stateCode) private {
        StateMember storage m = _members[stateCode];
        m.status = MemberStatus.SUSPENDED;
        _activeCount--;
        emit StateRemoved(stateCode, "");
    }

    /// @inheritdoc IGovernance
    function withdraw() external onlyValidator {
        bytes2 s = _validatorToState[msg.sender];
        if (_activeCount <= 1) revert LastValidator();
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

    function _authorizeUpgrade(address) internal view override {
        if (msg.sender != address(this)) revert NotGovernance(msg.sender);
    }
}
