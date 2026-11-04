// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {ITamgaErrors} from "./ITamgaErrors.sol";
import {StatusHistory} from "../base/StatusHistory.sol";

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
    /// @dev ADR-0073 K5: her durum değişikliğinin geçerlilik anı (göç kipinde açık tarih; aksi hâlde blok zamanı).
    event SchemaStatusChanged(bytes32 indexed schemaId, SchemaStatus status, uint64 since);
    /// @dev ADR-0073 K3: şemanın yeni sürüm özeti (SHA-256 baytları; liste SRI `sha256-<base64>`) — yalnız eklenir.
    event SchemaContentHashAdded(bytes32 indexed schemaId, bytes32 contentHash);

    error SchemaExists(bytes32 schemaId);
    error UnknownSchema(bytes32 schemaId);
    error NetworkTierRequiresGovernance();
    error NetworkTierHasNoState();
    error NationalTierRequiresState();
    error EmptyVctURI();
    error EmptyVersion();
    error NotActive(bytes32 schemaId);
    error SelfSuccession();
    /// @dev ADR-0054 NS1: ulusal şemanın vct'si kayıt yapan devletin ad alanında değil.
    error NationalVctOutsideNamespace(bytes2 stateCode);
    /// @dev ADR-0073 K3: özet zaten kayıtlı (ilk özet dahil).
    error ContentHashExists(bytes32 schemaId, bytes32 contentHash);
    error TooManyContentHashes(bytes32 schemaId, uint256 max);

    function schemaIdOf(string calldata vctURI) external pure returns (bytes32);
    function registerSchema(SchemaRecord calldata rec) external;
    function deprecateSchema(bytes32 schemaId, bytes32 supersededBy) external;
    function revokeSchema(bytes32 schemaId, string calldata reason) external;
    /// @notice ADR-0073 K1: `at` = 0 → blok zamanı; açık tarih yalnız göç kipinde.
    function deprecateSchemaAt(bytes32 schemaId, bytes32 supersededBy, uint64 at) external;
    function revokeSchemaAt(bytes32 schemaId, string calldata reason, uint64 at) external;
    /// @notice ADR-0073 K3 / CE3: yeni sürüm özeti ekler (ulusal şemada o devlet; ağ şemasında Governance önerisi ya da göç
    ///         yürütücüsü). Yazılmış özet değiştirilmez ve silinmez; REVOKED şemaya eklenmez.
    function addSchemaContentHash(bytes32 schemaId, bytes32 contentHash) external;
    /// @notice İlk özet + eklenen sürüm özetleri (yazılma sırasıyla).
    function contentHashesOf(bytes32 schemaId) external view returns (bytes32[] memory);

    function getSchema(bytes32 schemaId) external view returns (SchemaRecord memory);
    function exists(bytes32 schemaId) external view returns (bool);
    function isActiveSchema(bytes32 schemaId) external view returns (bool);
    /// @notice Bütünlük (C3): özet ilk özetle ya da eklenen herhangi bir sürüm özetiyle eşleşir; REVOKED şemada hiçbiriyle.
    function matchesContentHash(bytes32 schemaId, bytes32 hash) external view returns (bool);
    /// @notice Doğrulama C2'nin şema adımı (ADR-0073 K5): şema `iat` anında ACTIVE ve hiç REVOKED değil.
    ///         DEPRECATED'dan ÖNCE verilmiş belge kabul (SC3), sonra verilmiş belge ret (liste kuralı).
    function isSchemaAcceptableAt(bytes32 schemaId, uint64 iat) external view returns (bool);
    function schemaStatusAt(bytes32 schemaId, uint64 t) external view returns (SchemaStatus);
    function schemaStatusHistoryOf(bytes32 schemaId) external view returns (StatusHistory.Change[] memory);
    function getSchemasByState(bytes2 stateCode) external view returns (bytes32[] memory);
    function getNetworkSchemas() external view returns (bytes32[] memory);
}
