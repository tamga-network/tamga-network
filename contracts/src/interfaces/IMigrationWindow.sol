// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/**
 * @title  IMigrationWindow — tek seferlik göç kipi (ADR-0073 K1, CE1)
 * @notice Liste geçmişinin kontratlara bir kez yeniden oynatılması için denetimli pencere. Aşamalar yalnız ileri gider:
 *         NOT_STARTED → OPEN → CLOSED. Governance önerisiyle bir kez açılır; pencere en çok 30 gündür; süre dolunca ya da
 *         kapanış önerisiyle kesin kapanır ve hiçbir yolla (yükseltme dahil) yeniden açılamaz.
 * @dev    Kip açıkken tarih taşıyan yazımlar tarihi açıkça alabilir (blok zamanından ileri değil, kayıt başına sıralı) ve
 *         günlük kotalar uygulanmaz; kip kapalıyken tarihler blok zamanıdır (sert iptal tarihi hariç, CE2).
 */
interface IMigrationWindow {
    enum MigrationPhase {NOT_STARTED, OPEN, CLOSED}

    event MigrationOpened(bytes32 indexed replayPlanHash, uint64 deadline, address executor);
    event MigrationExtended(uint64 deadline);
    event MigrationClosed(uint64 closedAt);

    error MigrationAlreadyStarted();
    error MigrationNotOpen();
    error InvalidMigrationDeadline(uint64 deadline);
    error EmptyReplayPlanHash();
    /// @dev Açık tarih yalnız göç kipi açıkken yazılabilir (CE1).
    error PastDateOutsideMigration(uint64 at);
    /// @dev Hiçbir tarih blok zamanından ileri olamaz (CE1).
    error DateInFuture(uint64 at);
    /// @dev Kaydın geçmişi zaman sırasıyla yazılır; öncekinden geri tarih reddedilir (CE1).
    error DateOutOfOrder(uint64 previous, uint64 at);
    /// @dev Güvenlik turu 2026-11-04: pencere açıkken kayıt kontratı yükseltilemez (önce kapanış önerisi ya da süre dolar).
    error UpgradeDuringMigration();
    /// @dev Güvenlik turu 2026-11-04 (K1: "kip açıkken tarih taşıyan yazımlar tarihi açıkça alır"): pencere açıkken tarihsiz
    ///      (`at` = 0, blok zamanlı) olağan yazım reddedilir; acil yazım açık tarihle (`at` = şimdi) yapılır. Governance hariç.
    error DateRequiredDuringMigration();

    /// @notice Governance: kipi bir kez açar. `deadline` ≤ açılış + 30 gün; `executor` ağ düzeyi kayıtların tek göç yürütücüsü.
    function openMigration(bytes32 replayPlanHash, uint64 deadline, address executor) external;
    /// @notice Governance: kip açıkken süreyi uzatır (açılıştan en çok 30 gün).
    function extendMigration(uint64 deadline) external;
    /// @notice Governance: kipi kesin kapatır (açık ya da süresi dolmuş).
    function closeMigration() external;

    /// @notice Etkin aşama: süresi dolmuş açık pencere CLOSED sayılır.
    function migrationPhase() external view returns (MigrationPhase);
    function isMigrationOpen() external view returns (bool);
    /// @notice Depolanan ham durum (yükseltme denetimi bunu karşılaştırır; süresi dolmuş pencere burada OPEN görünebilir).
    function migrationState()
        external
        view
        returns (MigrationPhase storedPhase, uint64 openedAt, uint64 deadline, bytes32 replayPlanHash, address executor);
}
