// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {ITamgaErrors} from "./ITamgaErrors.sol";
import {ISchemaRegistry} from "./ISchemaRegistry.sol";

/// @title IGovernance — SPEC-BC-0001 §1 / ADR-0002
interface IGovernance is ITamgaErrors {
    enum MemberStatus {NONE, ACTIVE, SUSPENDED, WITHDRAWN}
    enum ProposalKind {NONE, STATE_ADMISSION, STATE_REMOVAL, PROTOCOL_UPGRADE, NETWORK_SCHEMA}
    enum ProposalStatus {NONE, OPEN, EXECUTED, CANCELLED}

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
    event StateRemoved(bytes2 indexed stateCode, string reason);
    event StateWithdrawn(bytes2 indexed stateCode);
    event DelegateKeysSet(bytes2 indexed stateCode, uint256 count);
    event ProposalCreated(bytes32 indexed id, ProposalKind kind, address proposer);
    event Voted(bytes32 indexed id, address voter, bool support);
    event ProposalExecuted(bytes32 indexed id);
    event ProposalCancelled(bytes32 indexed id);

    error NotValidator(address caller);
    error UnknownProposal(bytes32 id);
    error ProposalNotOpen(bytes32 id);
    error ProposalExpired(bytes32 id);
    error AlreadyVoted(bytes32 id, address voter);
    error ThresholdNotMet(uint32 forVotes, uint32 required);
    error MemberExists(bytes2 stateCode);
    error UnknownMember(bytes2 stateCode);
    error LastValidator();
    error UpgradeTargetNotProxiable(address impl);

    function proposeStateAdmission(bytes2 stateCode, address validator) external returns (bytes32);
    function proposeStateRemoval(bytes2 stateCode, string calldata reason) external returns (bytes32);
    function proposeProtocolUpgrade(address target, address newImplementation) external returns (bytes32);
    function proposeNetworkSchema(ISchemaRegistry.SchemaRecord calldata rec) external returns (bytes32);

    function vote(bytes32 proposalId, bool support) external;
    function execute(bytes32 proposalId) external;
    function withdraw() external;
    function setDelegateKeys(bytes2 stateCode, address[] calldata keys) external;

    function activeMemberCount() external view returns (uint32);
    function requiredVotes(bytes2 excludedState) external view returns (uint32);
    function getMember(bytes2 stateCode) external view returns (StateMember memory);
    function getProposal(bytes32 id) external view returns (Proposal memory);
    function delegateKeysOf(bytes2 stateCode) external view returns (address[] memory);
}
