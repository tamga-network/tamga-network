// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/**
 * @title  StatusHistory — yalnız eklenebilir durum pencereleri (ADR-0073 K5, CE5)
 * @notice Bir kaydın durumu `since` anından itibaren geçerlidir; aralıklar yarı açıktır: [since, sonraki since). Böylece
 *         "iat anındaki durum" imzalı listedeki `status_history` ile aynı cevabı verir (TrustSource `statusAt`).
 * @dev    Durum değeri kaydın kendi enum'unun `uint8` karşılığıdır (0 = NONE: o anda kayıt yok). Geçmiş değiştirilmez; yeni
 *         değişiklik öncekinden geri tarihli olamaz (aynı an serbest: son yazılan geçerlidir).
 *
 *         Boyut (güvenlik turu 2026-11-04): dizi tavansızdır — bir tavan, ele geçirilmiş kurumun iptalini engelleyebilirdi. Yazım
 *         O(1)'dir; `statusAt` sondan, `ever` baştan tarar (yalnız görünüm). Dizi yalnız kaydın sahibi devletin (ya da ağ
 *         kaydında Governance'ın) yazımıyla büyür ve kip dışında günlük kotaya sayılır (SPEC-BC-0001 §12.2). Gerçekçi bir
 *         kayıtta değişiklik sayısı onlarla sınırlıdır; zincir üstü okuyucu (TrustQueries) gaz sınırını buna göre hesaba katar.
 *         Göç penceresinde tarihsiz olağan yazım dondurulur (MigrationWindow `_effectiveDate`): yeniden oynatılan geçmiş ile
 *         o günkü işletim aynı dizide sessizce yarışmaz.
 */
library StatusHistory {
    struct Change {
        uint64 since;
        uint8 status;
    }

    error StatusOutOfOrder(uint64 previous, uint64 since);

    function record(Change[] storage h, uint64 since, uint8 status) internal {
        uint256 n = h.length;
        if (n != 0 && since < h[n - 1].since) revert StatusOutOfOrder(h[n - 1].since, since);
        h.push(Change(since, status));
    }

    /// @notice `t` anındaki durum: `since ≤ t` olan son değişiklik; yoksa 0 (NONE).
    function statusAt(Change[] storage h, uint64 t) internal view returns (uint8) {
        for (uint256 i = h.length; i > 0; i--) {
            Change storage c = h[i - 1];
            if (c.since <= t) return c.status;
        }
        return 0;
    }

    /// @notice Kayıt bu duruma hiç geçti mi (ör. kök CA bir kez REVOKED olduysa bütün altı düşer, CA2).
    function ever(Change[] storage h, uint8 status) internal view returns (bool) {
        for (uint256 i = 0; i < h.length; i++) {
            if (h[i].status == status) return true;
        }
        return false;
    }

    function lastSince(Change[] storage h) internal view returns (uint64) {
        uint256 n = h.length;
        return n == 0 ? 0 : h[n - 1].since;
    }
}
