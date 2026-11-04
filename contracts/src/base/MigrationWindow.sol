// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {IMigrationWindow} from "../interfaces/IMigrationWindow.sol";

/**
 * @title  MigrationWindow
 * @notice ADR-0073 K1 / CE1 — tek seferlik göç kipi. Kayıt kontratları (TamgaRegistryBase üzerinden), StatusListRegistry ve
 *         NetworkRegistry bunu kalıtır.
 *
 * @dev    Depolama ERC-7201 ad alanındadır (`tamga.storage.MigrationWindow`): kalıtan kontratların sıralı depolama düzenini ve
 *         `__gap`'lerini değiştirmez. Yükseltme bu durumu sıfırlayamaz: Governance her yükseltmeden önce ve sonra
 *         `migrationState()`'i karşılaştırır, fark varsa yükseltme geri alınır (ADR-0073 K1, ADR-0055 GE2).
 */
abstract contract MigrationWindow is IMigrationWindow {
    /// @notice Pencere açılıştan en çok 30 gün (ADR-0073 K1, proje yönetimi kararı 2026-11-04).
    uint64 public constant MAX_MIGRATION_WINDOW = 30 days;

    /// @custom:storage-location erc7201:tamga.storage.MigrationWindow
    struct MigrationStorage {
        MigrationPhase phase;
        uint64 openedAt;
        uint64 deadline;
        address executor;
        bytes32 replayPlanHash;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("tamga.storage.MigrationWindow")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant MIGRATION_STORAGE = 0xbae22249a336a4c3cc038a352f499331483538b99714e093c49fd1263f93a700;

    function _migration() private pure returns (MigrationStorage storage $) {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            $.slot := MIGRATION_STORAGE
        }
    }

    /// @dev Kipi açma, uzatma ve kapatma yetkisi (Governance).
    function _requireMigrationAdmin() internal view virtual;

    /// @inheritdoc IMigrationWindow
    function openMigration(bytes32 replayPlanHash, uint64 deadline, address executor) external {
        _requireMigrationAdmin();
        MigrationStorage storage m = _migration();
        if (m.phase != MigrationPhase.NOT_STARTED) revert MigrationAlreadyStarted();
        if (replayPlanHash == bytes32(0)) revert EmptyReplayPlanHash();
        uint64 now_ = uint64(block.timestamp);
        if (deadline <= now_ || deadline > now_ + MAX_MIGRATION_WINDOW) revert InvalidMigrationDeadline(deadline);
        m.phase = MigrationPhase.OPEN;
        m.openedAt = now_;
        m.deadline = deadline;
        m.executor = executor;
        m.replayPlanHash = replayPlanHash;
        emit MigrationOpened(replayPlanHash, deadline, executor);
    }

    /// @inheritdoc IMigrationWindow
    function extendMigration(uint64 deadline) external {
        _requireMigrationAdmin();
        if (!isMigrationOpen()) revert MigrationNotOpen();
        MigrationStorage storage m = _migration();
        if (deadline <= m.deadline || deadline > m.openedAt + MAX_MIGRATION_WINDOW) {
            revert InvalidMigrationDeadline(deadline);
        }
        m.deadline = deadline;
        emit MigrationExtended(deadline);
    }

    /// @inheritdoc IMigrationWindow
    function closeMigration() external {
        _requireMigrationAdmin();
        MigrationStorage storage m = _migration();
        // Süresi dolmuş pencere zaten kapalı sayılır; kapanış önerisi yine de ham durumu CLOSED'a çeker.
        if (m.phase != MigrationPhase.OPEN) revert MigrationNotOpen();
        m.phase = MigrationPhase.CLOSED;
        emit MigrationClosed(uint64(block.timestamp));
    }

    /// @inheritdoc IMigrationWindow
    function migrationPhase() public view returns (MigrationPhase) {
        MigrationStorage storage m = _migration();
        if (m.phase == MigrationPhase.OPEN && block.timestamp > m.deadline) return MigrationPhase.CLOSED;
        return m.phase;
    }

    /// @inheritdoc IMigrationWindow
    function isMigrationOpen() public view returns (bool) {
        return migrationPhase() == MigrationPhase.OPEN;
    }

    /// @inheritdoc IMigrationWindow
    function migrationState()
        external
        view
        returns (MigrationPhase storedPhase, uint64 openedAt, uint64 deadline, bytes32 replayPlanHash, address executor)
    {
        MigrationStorage storage m = _migration();
        return (m.phase, m.openedAt, m.deadline, m.replayPlanHash, m.executor);
    }

    /// @dev Tarih kuralı (CE1): 0 → blok zamanı; açık tarih yalnız kip açıkken ve blok zamanından ileri değil.
    function _effectiveDate(uint64 at) internal view returns (uint64) {
        if (at == 0) return uint64(block.timestamp);
        if (!isMigrationOpen()) revert PastDateOutsideMigration(at);
        if (at > block.timestamp) revert DateInFuture(at);
        return at;
    }

    /// @dev Ağ düzeyi kayıtların tek göç yürütücüsü — yalnız kip açıkken (ADR-0073 K1, PJ3).
    function _isMigrationExecutor(address account) internal view returns (bool) {
        address e = _migration().executor;
        return e != address(0) && account == e && isMigrationOpen();
    }
}
