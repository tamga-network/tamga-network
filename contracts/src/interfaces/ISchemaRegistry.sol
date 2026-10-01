// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {ITamgaErrors} from "./ITamgaErrors.sol";

/// @title ISchemaRegistry — SPEC-BC-0001 §4 / ADR-0007
interface ISchemaRegistry is ITamgaErrors {
    enum SchemaTier   {NETWORK, NATIONAL}
    enum SchemaStatus {NONE, ACTIVE, DEPRECATED, REVOKED}

    struct SchemaRecord {
        string vctURI;
        bytes32 contentHash;
        string version;
        SchemaTier tier;
        bytes2 stateCode;
        SchemaStatus status;
        uint64 validFrom;
        bytes32 supersededBy;
    }

    event SchemaRegistered(bytes32 indexed schemaId, string vctURI, SchemaTier tier, bytes2 indexed stateCode);
    event SchemaDeprecated(bytes32 indexed schemaId, bytes32 supersededBy);
    event SchemaRevoked(bytes32 indexed schemaId, string reason);

    error SchemaExists(bytes32 schemaId);
    error UnknownSchema(bytes32 schemaId);
    error NetworkTierRequiresGovernance();
    error NetworkTierHasNoState();
    error NationalTierRequiresState();
    error EmptyVctURI();
    error EmptyVersion();
    error NotActive(bytes32 schemaId);
    error SelfSuccession();

    function schemaIdOf(string calldata vctURI) external pure returns (bytes32);
    function registerSchema(SchemaRecord calldata rec) external;
    function deprecateSchema(bytes32 schemaId, bytes32 supersededBy) external;
    function revokeSchema(bytes32 schemaId, string calldata reason) external;

    function getSchema(bytes32 schemaId) external view returns (SchemaRecord memory);
    function exists(bytes32 schemaId) external view returns (bool);
    function isActiveSchema(bytes32 schemaId) external view returns (bool);
    function matchesContentHash(bytes32 schemaId, bytes32 hash) external view returns (bool);
    function getSchemasByState(bytes2 stateCode) external view returns (bytes32[] memory);
    function getNetworkSchemas() external view returns (bytes32[] memory);
}
