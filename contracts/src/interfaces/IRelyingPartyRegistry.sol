// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {ITamgaErrors} from "./ITamgaErrors.sol";

/// @title IRelyingPartyRegistry — SPEC-BC-0001 §6
interface IRelyingPartyRegistry is ITamgaErrors {
    enum RPStatus {NONE, ACTIVE, SUSPENDED, REVOKED}

    struct RelyingParty {
        bytes32 rpId;
        bytes2 stateCode;
        bytes32 nameHash;
        bytes32 accessCertFingerprint;
        bytes32[] allowedScopes;
        RPStatus status;
        uint64 registeredAt;
    }

    event RelyingPartyRegistered(bytes32 indexed rpId, bytes2 indexed stateCode);
    event ScopeUpdated(bytes32 indexed rpId, uint256 scopeCount);
    event RelyingPartySuspended(bytes32 indexed rpId);
    event RelyingPartyRevoked(bytes32 indexed rpId);

    error RPExists(bytes32 rpId);
    error UnknownRP(bytes32 rpId);
    error TooManyScopes(uint256 count, uint256 max);

    function registerRelyingParty(RelyingParty calldata data) external;
    function updateScope(bytes32 rpId, bytes32[] calldata newScopes) external;
    function suspendRelyingParty(bytes32 rpId) external;
    function revokeRelyingParty(bytes32 rpId) external;

    function isValidRelyingParty(bytes32 rpId) external view returns (bool);
    function hasScope(bytes32 rpId, bytes32 scope) external view returns (bool);
    function getRelyingParty(bytes32 rpId) external view returns (RelyingParty memory);
}
