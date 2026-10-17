/** WIA iptal listesi okuması (ADR-0025 `client_status`): bit genişliğine göre sınır ve bit değeri. */
import { describe, it, expect } from "vitest";
import { wiaRevokedInList } from "./wua.js";

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

  it("2 bitlik listede bayt başına 4 giriş: yalnız 0x01 iptaldir, askı (0x02) iptal sayılmaz", () => {
    // idx 5 → bayt 1, bitler 2–3 = 01 (INVALID); idx 6 → bitler 4–5 = 10 (SUSPENDED)
    const bytes = new Uint8Array([0x00, (1 << 2) | (2 << 4)]);
    const list = { bits: 2 as const, bytes };
    expect(wiaRevokedInList(list, 5)).toBe(true);
    expect(wiaRevokedInList(list, 6)).toBe(false);
    expect(wiaRevokedInList(list, 7)).toBe(false);
    expect(wiaRevokedInList(list, 8)).toBe(false); // liste dışı
  });
});
