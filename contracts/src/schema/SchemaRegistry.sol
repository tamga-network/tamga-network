// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {TamgaRegistryBase} from "../base/TamgaRegistryBase.sol";
import {ISchemaRegistry} from "../interfaces/ISchemaRegistry.sol";

/**
 * @title  SchemaRegistry
 * @notice Şema kayıt defterinin zincir tarafı. Şema DOKÜMANI zincirde değildir;
 *         burada kanonik tip URL'i, içerik hash'i, sürüm ve durum durur — ÇAPA.
 *
 * @dev    SPEC-BC-0001 §4, SPEC-SCHEMA-0001 §5.1, ADR-0007.
 *
 *         İki katmanlı yetki (ADR-0007 Karar 5):
 *           NETWORK  → yalnızca Governance yürütmesi (2/3 oy)
 *           NATIONAL → onlyOwnerState, oy yok
 *
 *         Değişmezler:
 *           S1  vctURI ve contentHash asla güncellenmez. Değişiklik = yeni sürüm.
 *           S2  deprecate/revoke yalnızca status'ü değiştirir.
 *           S3  DEPRECATED şema DOĞRULANABİLİR kalır; yalnızca yeni ihraç durur.
 */
contract SchemaRegistry is TamgaRegistryBase, ISchemaRegistry {
    mapping(bytes32 => SchemaRecord) private _schemas;
    mapping(bytes2 => bytes32[]) private _byState;
    bytes32[] private _networkSchemas;

    uint256[46] private __gap;

    function initialize(address sovereignty_, address governance_) external initializer {
        __TamgaRegistryBase_init(sovereignty_, governance_);
    }

    /// @inheritdoc ISchemaRegistry
    function schemaIdOf(string calldata vctURI) public pure returns (bytes32) {
        return keccak256(bytes(vctURI));
    }

    /// @inheritdoc ISchemaRegistry
    function registerSchema(SchemaRecord calldata rec) external {
        if (rec.tier == SchemaTier.NETWORK) {
            if (msg.sender != governance) revert NetworkTierRequiresGovernance();
            if (rec.stateCode != bytes2(0)) revert NetworkTierHasNoState();
        } else {
            if (rec.stateCode == bytes2(0)) revert NationalTierRequiresState();
            if (!sovereignty.isDelegateOf(msg.sender, rec.stateCode)) {
                revert NotOwnerState(rec.stateCode, msg.sender);
            }
        }

        if (bytes(rec.vctURI).length == 0) revert EmptyVctURI();
        if (rec.contentHash == bytes32(0)) revert EmptyContentHash();
        if (bytes(rec.version).length == 0) revert EmptyVersion();
        if (rec.status != SchemaStatus.ACTIVE) revert MustRegisterAsActive();

        bytes32 schemaId = keccak256(bytes(rec.vctURI));
        if (_schemas[schemaId].status != SchemaStatus.NONE) revert SchemaExists(schemaId);

        SchemaRecord storage s = _schemas[schemaId];
        s.vctURI = rec.vctURI;
        s.contentHash = rec.contentHash;    // S1 — bir daha yazılmaz
        s.version = rec.version;
        s.tier = rec.tier;
        s.stateCode = rec.stateCode;
        s.status = SchemaStatus.ACTIVE;
        s.validFrom = rec.validFrom == 0 ? uint64(block.timestamp) : rec.validFrom;

        if (rec.tier == SchemaTier.NETWORK) _networkSchemas.push(schemaId);
        else _byState[rec.stateCode].push(schemaId);

        emit SchemaRegistered(schemaId, rec.vctURI, rec.tier, rec.stateCode);
    }

    /// @inheritdoc ISchemaRegistry
    function deprecateSchema(bytes32 schemaId, bytes32 supersededBy) external {
        SchemaRecord storage s = _require(schemaId);
        _requireWriteAuth(s);
        if (s.status != SchemaStatus.ACTIVE) revert NotActive(schemaId);
        if (supersededBy != bytes32(0)) {
            if (supersededBy == schemaId) revert SelfSuccession();
            if (_schemas[supersededBy].status != SchemaStatus.ACTIVE) revert SuccessorNotActive(supersededBy);
        }
        s.status = SchemaStatus.DEPRECATED;   // S2, S3
        s.supersededBy = supersededBy;
        emit SchemaDeprecated(schemaId, supersededBy);
    }

    /// @inheritdoc ISchemaRegistry
    function revokeSchema(bytes32 schemaId, string calldata reason) external {
        SchemaRecord storage s = _require(schemaId);
        _requireWriteAuth(s);
        if (s.status == SchemaStatus.REVOKED) revert AlreadyRevoked(schemaId);
        s.status = SchemaStatus.REVOKED;
        emit SchemaRevoked(schemaId, reason);
    }

    function getSchema(bytes32 schemaId) external view returns (SchemaRecord memory) {
        SchemaRecord memory s = _schemas[schemaId];
        if (s.status == SchemaStatus.NONE) revert UnknownSchema(schemaId);
        return s;
    }

    function exists(bytes32 schemaId) external view returns (bool) {
        return _schemas[schemaId].status != SchemaStatus.NONE;
    }

    /**
     * @notice "Bu şemayla YENİ credential verilebilir mi?"
     * @dev    DEPRECATED için false döner. DİKKAT (S3): bu, o şemayla geçmişte
     *         verilmiş credential'ların geçersiz olduğu anlamına GELMEZ.
     *         Doğrulayıcı bu fonksiyonu geçmiş credential'ı reddetmek için
     *         KULLANMAMALIDIR — yalnızca ihraç yetkisi kontrolü içindir.
     */
    function isActiveSchema(bytes32 schemaId) external view returns (bool) {
        SchemaRecord storage s = _schemas[schemaId];
        return s.status == SchemaStatus.ACTIVE && block.timestamp >= s.validFrom;
    }

    /// @notice Bütünlük kontrolü. REVOKED şema için false döner.
    function matchesContentHash(bytes32 schemaId, bytes32 hash) external view returns (bool) {
        SchemaRecord storage s = _schemas[schemaId];
        if (s.status == SchemaStatus.NONE || s.status == SchemaStatus.REVOKED) return false;
        return s.contentHash == hash;
    }

    function getSchemasByState(bytes2 stateCode) external view returns (bytes32[] memory) {
        return _byState[stateCode];
    }

    function getNetworkSchemas() external view returns (bytes32[] memory) {
        return _networkSchemas;
    }

    function _require(bytes32 schemaId) private view returns (SchemaRecord storage s) {
        s = _schemas[schemaId];
        if (s.status == SchemaStatus.NONE) revert UnknownSchema(schemaId);
    }

    function _requireWriteAuth(SchemaRecord storage s) private view {
        if (s.tier == SchemaTier.NETWORK) {
            if (msg.sender != governance) revert NetworkTierRequiresGovernance();
        } else if (!sovereignty.isDelegateOf(msg.sender, s.stateCode)) {
            revert NotOwnerState(s.stateCode, msg.sender);
        }
    }
}
