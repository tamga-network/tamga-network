/** WIA iptal listesi okuması (ADR-0025 `client_status`): bit genişliğine göre sınır ve bit değeri. */
import { describe, it, expect } from "vitest";
import { wiaRevokedInList, wiaStatusInList, wiaValidInList } from "./wua.js";

describe("wiaRevokedInList", () => {
  it("1 bitlik listede bayt başına 8 giriş: son yarıdaki iptal okunur, liste dışı giriş iptal değil", () => {
    // 2 bayt = 16 giriş; idx 13 iptal (bayt 1, bit 5)
    const bytes = new Uint8Array([0x00, 1 << 5]);
    const list = { bits: 1 as const, bytes };
    expect(wiaRevokedInList(list, 13)).toBe(true);
    expect(wiaRevokedInList(list, 12)).toBe(false);
    expect(wiaRevokedInList(list, 15)).toBe(false);
    expect(wiaRevokedInList(list, 16)).toBe(false); // liste dışı: giriş yok → iptal değil
  });

  it("2 bitlik listede bayt başına 4 giriş: 0x01 iptal, askı (0x02) iptal değil ama GEÇERLİ de değil, tanımsız 0x03 iptal (kapalı güvenli, K11)", () => {
    // idx 5 → bayt 1, bitler 2–3 = 01 (INVALID); idx 6 → bitler 4–5 = 10 (SUSPENDED); idx 7 → bitler 6–7 = 11 (tanımsız)
    const bytes = new Uint8Array([0x00, (1 << 2) | (2 << 4) | (3 << 6)]);
    const list = { bits: 2 as const, bytes };
    expect(wiaRevokedInList(list, 5)).toBe(true);
    expect(wiaRevokedInList(list, 6)).toBe(false); // askı: yerel silme nedeni değil
    expect(wiaRevokedInList(list, 7)).toBe(true); // 3: fail-closed → iptal
    expect(wiaRevokedInList(list, 4)).toBe(false);
    expect(wiaRevokedInList(list, 8)).toBe(false); // liste dışı
    expect(wiaStatusInList(list, 4)).toBe("valid");
    expect(wiaStatusInList(list, 5)).toBe("revoked");
    expect(wiaStatusInList(list, 6)).toBe("suspended");
    expect(wiaStatusInList(list, 7)).toBe("revoked");
    // sıfır dışı her değer "geçerli değil"
    expect([4, 5, 6, 7].map((i) => wiaValidInList(list, i))).toEqual([true, false, false, false]);
  });

  it("4 ve 8 bitlik listede sınır `8 / bits`: bayt başına 2 / 1 giriş — liste içindeki son giriş okunur, dışı geçerli (2026-11-04)", () => {
    // 4 bit: 2 bayt = 4 giriş; idx 3 → bayt 1, üst yarım bayt = 1 (iptal). Eski sınır (×4) 8 giriş sanıp idx 4–7'yi statusBitAt'e
    // gönderiyor ve "idx outside the list" hatası veriyordu
    const four = { bits: 4 as const, bytes: new Uint8Array([0x00, 0x10]) };
    expect(wiaStatusInList(four, 3)).toBe("revoked");
    expect(wiaStatusInList(four, 2)).toBe("valid");
    expect(wiaStatusInList(four, 4)).toBe("valid"); // liste dışı
    expect(wiaStatusInList(four, 7)).toBe("valid");
    // 8 bit: 2 bayt = 2 giriş; idx 1 = 2 (askı)
    const eight = { bits: 8 as const, bytes: new Uint8Array([0x00, 0x02]) };
    expect(wiaStatusInList(eight, 1)).toBe("suspended");
    expect(wiaStatusInList(eight, 2)).toBe("valid"); // liste dışı
  });
});
