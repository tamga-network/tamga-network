// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {INetworkRegistry} from "../interfaces/INetworkRegistry.sol";
import {MigrationWindow} from "../base/MigrationWindow.sol";
import {StatusHistory} from "../base/StatusHistory.sol";

/**
 * @title  NetworkRegistry
 * @notice Ağ düzeyi güven kayıtları — ADR-0074 K3 (ad onaylı 2026-11-04). Hiçbir devletin değil, ağın kaydıdır; tek
 *         Governance kapısı (PJ3).
 * @dev    İki yazım yolu: (1) `stageRecord` → Governance önerisi (`proposeNetworkRecord`, içeriğin özetini taşır) → 2/3 oy →
 *         `commitStaged`; (2) göç kipinde tek göç yürütücüsü `writeRecord` ile tarihli yazar (ADR-0073 K1).
 *         Kayıt yazımı "son hâl" yazımıdır; durum geçmişi yalnız eklenir (StatusHistory, yarı açık). Kayıt silinmez.
 *         Kişisel veri ve serbest metin yok (PJ2): ayrıntı yalnız `detailsHash`.
 */
contract NetworkRegistry is Initializable, UUPSUpgradeable, INetworkRegistry, MigrationWindow {
    using StatusHistory for StatusHistory.Change[];

    /// @notice Kayıt başına özet kümesi tavanı (saha verisiyle gözden geçirilir).
    uint256 public constant MAX_DIGESTS = 64;

    address public governance;

    mapping(bytes32 => NetworkRecord) private _records; // keccak256(kind, recordId) => kayıt
    mapping(bytes32 => StatusHistory.Change[]) private _history;
    mapping(RecordKind => bytes32[]) private _ids;
    mapping(bytes32 => NetworkRecord) private _staged; // stageId => içerik

    uint256[45] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address governance_) external initializer {
        if (governance_ == address(0)) revert ZeroAddress();
        governance = governance_;
    }

    function _authorizeUpgrade(address) internal view override {
        if (msg.sender != governance) revert NotGovernance(msg.sender);
    }

    function _requireMigrationAdmin() internal view override {
        if (msg.sender != governance) revert NotGovernance(msg.sender);
    }

    // -----------------------------------------------------------------
    // Yazım
    // -----------------------------------------------------------------

    /// @inheritdoc INetworkRegistry
    function stageIdOf(NetworkRecord calldata rec) public pure returns (bytes32) {
        return keccak256(abi.encode(rec));
    }

    /// @inheritdoc INetworkRegistry
    function stageRecord(NetworkRecord calldata rec) external returns (bytes32 stageId) {
        _validate(rec);
        stageId = stageIdOf(rec);
        _staged[stageId] = rec;
        emit RecordStaged(stageId, rec.kind, rec.recordId);
    }

    /// @inheritdoc INetworkRegistry
    function commitStaged(bytes32 stageId) external {
        if (msg.sender != governance) revert NotGovernance(msg.sender);
        NetworkRecord storage s = _staged[stageId];
        if (s.kind == RecordKind.NONE) revert UnknownStage(stageId);
        _write(s, uint64(block.timestamp));
        delete _staged[stageId];
    }

    /// @inheritdoc INetworkRegistry
    function writeRecord(NetworkRecord calldata rec, uint64 at) external {
        if (!_isMigrationExecutor(msg.sender)) revert NotMigrationWriter(msg.sender);
        _validate(rec);
        _write(rec, _effectiveDate(at));
    }

    function _validate(NetworkRecord calldata rec) private pure {
        if (
            rec.kind == RecordKind.NONE || rec.recordId == bytes32(0) || rec.status == RecordStatus.NONE
                || (rec.validUntil != 0 && rec.validUntil <= rec.validFrom)
        ) revert InvalidRecord(rec.kind, rec.recordId);
        if (rec.digests.length > MAX_DIGESTS) revert TooManyDigests(rec.digests.length, MAX_DIGESTS);
    }

    /// @dev Üst kayıt bağı yazım anında denetlenir: WUA anahtarı kayıtlı bir sağlayıcıya, rol slotu bir devlet slotuna bağlıdır.
    function _checkParent(RecordKind kind, bytes32 parentId) private view {
        if (kind == RecordKind.WALLET_PROVIDER_KEY && !_exists(RecordKind.WALLET_PROVIDER, parentId)) {
            revert UnknownParent(parentId);
        }
        if (kind == RecordKind.ROLE_SLOT && !_exists(RecordKind.STATE_SLOT, parentId)) revert UnknownParent(parentId);
    }

    /// @dev Kayıt son hâlle yazılır; durum değiştiyse (ya da ilk yazımsa) geçmişe `since` anıyla eklenir.
    function _write(NetworkRecord memory rec, uint64 since) private {
        _checkParent(rec.kind, rec.parentId);
        bytes32 k = _key(rec.kind, rec.recordId);
        NetworkRecord storage cur = _records[k];
        bool isNew = cur.kind == RecordKind.NONE;
        if (isNew) _ids[rec.kind].push(rec.recordId);
        if (isNew || cur.status != rec.status) {
            _history[k].record(since, uint8(rec.status));
            emit RecordWritten(rec.kind, rec.recordId, rec.status, since);
        }
        _records[k] = rec;
    }

    // -----------------------------------------------------------------
    // Okuma
    // -----------------------------------------------------------------

    function stagedRecord(bytes32 stageId) external view returns (NetworkRecord memory) {
        return _staged[stageId];
    }

    function exists(RecordKind kind, bytes32 recordId) external view returns (bool) {
        return _exists(kind, recordId);
    }

    function getRecord(RecordKind kind, bytes32 recordId) external view returns (NetworkRecord memory) {
        return _records[_key(kind, recordId)];
    }

    function recordIdsOf(RecordKind kind) external view returns (bytes32[] memory) {
        return _ids[kind];
    }

    function recordStatusAt(RecordKind kind, bytes32 recordId, uint64 t) external view returns (RecordStatus) {
        return RecordStatus(_history[_key(kind, recordId)].statusAt(t));
    }

    function recordStatusHistoryOf(RecordKind kind, bytes32 recordId)
        external
        view
        returns (StatusHistory.Change[] memory)
    {
        return _history[_key(kind, recordId)];
    }

    /// @inheritdoc INetworkRegistry
    function isActiveRecord(RecordKind kind, bytes32 recordId) public view returns (bool) {
        NetworkRecord storage r = _records[_key(kind, recordId)];
        bool live = r.status == RecordStatus.ACTIVE
            || (kind == RecordKind.LIST_OPERATOR
                && (r.status == RecordStatus.DESIGNATED || r.status == RecordStatus.PROVISIONAL));
        if (!live) return false;
        uint64 now_ = uint64(block.timestamp);
        return now_ >= r.validFrom && (r.validUntil == 0 || now_ < r.validUntil);
    }

    /// @inheritdoc INetworkRegistry
    function isListedProviderKey(bytes32 fingerprint) external view returns (bool) {
        if (!isActiveRecord(RecordKind.WALLET_PROVIDER_KEY, fingerprint)) return false;
        bytes32 provider = _records[_key(RecordKind.WALLET_PROVIDER_KEY, fingerprint)].parentId;
        return isActiveRecord(RecordKind.WALLET_PROVIDER, provider);
    }

    function _exists(RecordKind kind, bytes32 recordId) private view returns (bool) {
        return _records[_key(kind, recordId)].kind != RecordKind.NONE;
    }

    function _key(RecordKind kind, bytes32 recordId) private pure returns (bytes32) {
        return keccak256(abi.encode(kind, recordId));
    }
}
