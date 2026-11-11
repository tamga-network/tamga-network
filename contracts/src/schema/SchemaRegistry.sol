// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {TamgaRegistryBase} from "../base/TamgaRegistryBase.sol";
import {ISchemaRegistry} from "../interfaces/ISchemaRegistry.sol";
import {VctNamespace} from "./VctNamespace.sol";
import {StatusHistory} from "../base/StatusHistory.sol";

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
 *           S1  vctURI ve yazılmış her içerik özeti asla güncellenmez ya da silinmez; yeni sürüm özeti yalnız eklenir
 *               (ADR-0073 K3 / CE3 — ADR-0010 K4'ün zincir karşılığı).
 *           S2  deprecate/revoke status'ü değiştirir; deprecate ayrıca halefi (supersededBy) yazar. vctURI/contentHash değişmez.
 *           NS1 Ad alanları ayrık (ADR-0054): ulusal vct = urn:tamga:<cc>:<alan>:<Tür>:<ana sürüm> (kendi devlet kodu);
 *               ağ vct'si bu biçimde olamaz.
 *           S3  DEPRECATED şema DOĞRULANABİLİR kalır; yalnızca yeni ihraç durur. ADR-0073 K5: "doğrulanabilir"
 *               = DEPRECATED'dan ÖNCE verilmiş belge; durum belgenin iat anına göre (yarı açık pencereler).
 *
 *         Göç kipinde (ADR-0073 K1) ağ şemasını Governance'ın yanında açılış önerisinin yetkilendirdiği tek göç
 *         yürütücüsü de yazar: kayıt, sürüm özeti ve deprecate. Ağ şemasının İPTALİ (kalıcı) yalnız Governance'tadır.
 */
contract SchemaRegistry is TamgaRegistryBase, ISchemaRegistry {
    using StatusHistory for StatusHistory.Change[];

    mapping(bytes32 => SchemaRecord) private _schemas;
    mapping(bytes2 => bytes32[]) private _byState;
    bytes32[] private _networkSchemas;
    /// @dev ADR-0073 K5: schemaId => durum pencereleri (yalnız eklenir).
    mapping(bytes32 => StatusHistory.Change[]) private _history;
    /// @dev ADR-0073 K3: schemaId => eklenen sürüm özetleri (ilk özet `SchemaRecord.contentHash`'tedir).
    mapping(bytes32 => bytes32[]) private _versionHashes;

    // Yanlış alarm: iki `__gap` de private; Solidity ayrı slotlar ayırır (taban 46, bu kontrat 44), düzen check:storage'da.
    // slither-disable-next-line shadowing-state
    uint256[44] private __gap;

    /// @notice ADR-0073 K3: şema başına en çok sürüm özeti (ilk özet hariç); saha verisiyle gözden geçirilir.
    uint256 public constant MAX_CONTENT_HASHES = 32;

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
            _requireNetworkWriter();
            if (rec.stateCode != bytes2(0)) revert NetworkTierHasNoState();
        } else {
            if (rec.stateCode == bytes2(0)) revert NationalTierRequiresState();
            _requireOwnerAndCount(rec.stateCode); // §4.3 onlyOwnerState(rec.stateCode) + §12.2 kota
        }

        if (bytes(rec.vctURI).length == 0) revert EmptyVctURI();
        if (rec.contentHash == bytes32(0)) revert EmptyContentHash();
        if (bytes(rec.version).length == 0) revert EmptyVersion();
        if (rec.status != SchemaStatus.ACTIVE) revert MustRegisterAsActive();

        // ADR-0054 NS1: ad alanları ayrık — ulusal vct yalnız kendi devletinin ad alanında
        // (urn:tamga:<cc>:<alan>:<Tür>:<ana sürüm>); ağ vct'si bu biçimde olamaz
        bytes2 ns = VctNamespace.nationalStateOf(rec.vctURI);
        if (rec.tier == SchemaTier.NETWORK) {
            if (ns != bytes2(0)) revert NetworkVctInNationalNamespace();
        } else if (ns != rec.stateCode) {
            revert NationalVctOutsideNamespace(rec.stateCode);
        }

        bytes32 schemaId = keccak256(bytes(rec.vctURI));
        if (_schemas[schemaId].status != SchemaStatus.NONE) revert SchemaExists(schemaId);

        SchemaRecord storage s = _schemas[schemaId];
        s.vctURI = rec.vctURI;
        s.contentHash = rec.contentHash;    // S1 — bir daha yazılmaz
        s.version = rec.version;
        s.tier = rec.tier;
        s.stateCode = rec.stateCode;
        s.status = SchemaStatus.ACTIVE;
        // Kontrol 2026-11-10: başlangıç öteki kayıtlarla aynı kuraldan geçer — kip dışında geçmişe çekilemez (`_validFrom`),
        // göç kipinde blok zamanından ileri olamaz (`_effectiveDate`, aşağıda).
        s.validFrom = _validFrom(rec.validFrom);
        // Kip dışında ilk ACTIVE penceresi başlangıçsızdır (since = 0); göç kipinde listedeki ilk durum anı = validFrom
        // (blok zamanından ileri olamaz).
        uint64 since = isMigrationOpen() && rec.validFrom != 0 ? _effectiveDate(rec.validFrom) : 0;
        _history[schemaId].record(since, uint8(SchemaStatus.ACTIVE));

        if (rec.tier == SchemaTier.NETWORK) _networkSchemas.push(schemaId);
        else _byState[rec.stateCode].push(schemaId);

        emit SchemaRegistered(schemaId, rec.vctURI, rec.tier, rec.stateCode);
    }

    /// @inheritdoc ISchemaRegistry
    function deprecateSchema(bytes32 schemaId, bytes32 supersededBy) external {
        _deprecate(schemaId, supersededBy, 0);
    }

    /// @inheritdoc ISchemaRegistry
    function deprecateSchemaAt(bytes32 schemaId, bytes32 supersededBy, uint64 at) external {
        _deprecate(schemaId, supersededBy, at);
    }

    /// @inheritdoc ISchemaRegistry
    function revokeSchema(bytes32 schemaId, bytes32 reasonHash) external {
        _revoke(schemaId, reasonHash, 0);
    }

    /// @inheritdoc ISchemaRegistry
    function revokeSchemaAt(bytes32 schemaId, bytes32 reasonHash, uint64 at) external {
        _revoke(schemaId, reasonHash, at);
    }

    function _deprecate(bytes32 schemaId, bytes32 supersededBy, uint64 at) private {
        SchemaRecord storage s = _require(schemaId);
        _requireWriteAuth(s, false);
        if (s.status != SchemaStatus.ACTIVE) revert NotActive(schemaId);
        if (supersededBy != bytes32(0)) {
            if (supersededBy == schemaId) revert SelfSuccession();
            if (_schemas[supersededBy].status != SchemaStatus.ACTIVE) revert SuccessorNotActive(supersededBy);
        }
        _setStatus(schemaId, s, SchemaStatus.DEPRECATED, at); // S2, S3
        s.supersededBy = supersededBy;
        emit SchemaDeprecated(schemaId, supersededBy);
    }

    function _revoke(bytes32 schemaId, bytes32 reasonHash, uint64 at) private {
        SchemaRecord storage s = _require(schemaId);
        // Güvenlik turu 2026-11-04 (YÜKSEK): ağ şemasının iptali kalıcıdır (S3, `ever(REVOKED)`) — tek adresli göç
        // yürütücüsüne bırakılmaz; yalnız Governance önerisi (2/3). Yürütücü kayıt, sürüm özeti ve deprecate yazar.
        _requireWriteAuth(s, true);
        if (s.status == SchemaStatus.REVOKED) revert AlreadyRevoked(schemaId);
        _setStatus(schemaId, s, SchemaStatus.REVOKED, at);
        emit SchemaRevoked(schemaId, reasonHash);
    }

    /// @dev ADR-0073 K1/K5: durum değişikliği `since` anından itibaren geçerli; geçmiş sıralı ve yalnız eklenir.
    function _setStatus(bytes32 schemaId, SchemaRecord storage s, SchemaStatus st, uint64 at) private {
        uint64 since = _effectiveDate(at);
        _history[schemaId].record(since, uint8(st));
        s.status = st;
        emit SchemaStatusChanged(schemaId, st, since);
    }

    /// @inheritdoc ISchemaRegistry
    function addSchemaContentHash(bytes32 schemaId, bytes32 contentHash) external {
        SchemaRecord storage s = _require(schemaId);
        _requireWriteAuth(s, false);
        if (s.status == SchemaStatus.REVOKED) revert AlreadyRevoked(schemaId);
        if (contentHash == bytes32(0)) revert EmptyContentHash();
        bytes32[] storage v = _versionHashes[schemaId];
        if (v.length >= MAX_CONTENT_HASHES) revert TooManyContentHashes(schemaId, MAX_CONTENT_HASHES);
        if (_hasHash(s, v, contentHash)) revert ContentHashExists(schemaId, contentHash);
        v.push(contentHash);
        emit SchemaContentHashAdded(schemaId, contentHash);
    }

    /// @inheritdoc ISchemaRegistry
    function contentHashesOf(bytes32 schemaId) external view returns (bytes32[] memory out) {
        SchemaRecord storage s = _schemas[schemaId];
        if (s.status == SchemaStatus.NONE) return out;
        bytes32[] storage v = _versionHashes[schemaId];
        out = new bytes32[](v.length + 1);
        out[0] = s.contentHash;
        for (uint256 k = 0; k < v.length; k++) out[k + 1] = v[k];
    }

    function _hasHash(SchemaRecord storage s, bytes32[] storage v, bytes32 h) private view returns (bool) {
        if (s.contentHash == h) return true;
        for (uint256 k = 0; k < v.length; k++) {
            if (v[k] == h) return true;
        }
        return false;
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
        return _hasHash(s, _versionHashes[schemaId], hash);
    }

    /// @inheritdoc ISchemaRegistry
    function isSchemaAcceptableAt(bytes32 schemaId, uint64 iat) external view returns (bool) {
        StatusHistory.Change[] storage h = _history[schemaId];
        if (h.ever(uint8(SchemaStatus.REVOKED))) return false;
        return h.statusAt(iat) == uint8(SchemaStatus.ACTIVE);
    }

    function schemaStatusAt(bytes32 schemaId, uint64 t) external view returns (SchemaStatus) {
        return SchemaStatus(_history[schemaId].statusAt(t));
    }

    function schemaStatusHistoryOf(bytes32 schemaId) external view returns (StatusHistory.Change[] memory) {
        return _history[schemaId];
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

    /// @param governanceOnly ağ şemasında yalnız Governance (iptal); ulusal şemada etkisiz (egemenlik N1).
    function _requireWriteAuth(SchemaRecord storage s, bool governanceOnly) private {
        if (s.tier == SchemaTier.NETWORK) {
            if (governanceOnly) {
                if (msg.sender != governance) revert NetworkTierRequiresGovernance();
            } else {
                _requireNetworkWriter();
            }
        } else {
            _requireOwnerAndCount(s.stateCode);
        }
    }

    /// @dev Ağ şemasını Governance (2/3 öneri) ya da göç kipinde tek göç yürütücüsü yazar (ADR-0073 K1) — iptal hariç.
    function _requireNetworkWriter() private view {
        if (msg.sender != governance && !_isMigrationExecutor(msg.sender)) revert NetworkTierRequiresGovernance();
    }
}
