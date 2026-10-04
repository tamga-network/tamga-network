/** WA-ADR-0002 K1: kapatma kodu üretimi, biçimi ve ön özeti (saf mantık). */
import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import {
  LOCK_CODE_ALPHABET,
  LOCK_CODE_LEN,
  formatLockCode,
  generateLockCode,
  isLockCode,
  lockCodePrehash,
  normalizeLockCode,
} from "./lock-code.js";

const rnd = (n: number) => new Uint8Array(randomBytes(n));

describe("kapatma kodu (WA-ADR-0002)", () => {
  it("4×5 karakter, karışmayan alfabe (0/O, 1/I/L, U yok), tireli gösterim", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateLockCode(rnd);
      expect(code).toMatch(/^[2-9A-HJKMNP-TV-Z]{5}(-[2-9A-HJKMNP-TV-Z]{5}){3}$/);
      expect(normalizeLockCode(code)).toHaveLength(LOCK_CODE_LEN);
      expect(isLockCode(normalizeLockCode(code))).toBe(true);
    }
    expect(LOCK_CODE_ALPHABET).toHaveLength(30);
    for (const bad of "0OIL1U") expect(LOCK_CODE_ALPHABET).not.toContain(bad);
  });

  it("ret örneklemesi: bütün alfabe kullanılır, kod başına 30^20 (≈ 98 bit) eşit dağılım", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) for (const ch of normalizeLockCode(generateLockCode(rnd))) seen.add(ch);
    expect(seen.size).toBe(30);
    // 240..255 baytları atlanır: yalnız bu baytları veren kaynakla üretim ilerlemez ama takılmaz — karışık kaynak çalışır
    let calls = 0;
    const mixed = (n: number) => {
      calls++;
      return new Uint8Array(Array.from({ length: n }, (_, k) => (k % 2 ? 250 : (k * 7) % 240)));
    };
    const code = generateLockCode(mixed);
    expect(isLockCode(normalizeLockCode(code))).toBe(true);
    expect(calls).toBeGreaterThan(1);
  });

  it("giriş büyük/küçük harf, boşluk ve tireden bağımsız; alfabe dışı karakter biçim hatası", () => {
    const code = generateLockCode(rnd);
    const typed = code.toLowerCase().replace(/-/g, " ") + "  ";
    expect(normalizeLockCode(typed)).toBe(normalizeLockCode(code));
    expect(lockCodePrehash(typed)).toBe(lockCodePrehash(code));
    expect(isLockCode(normalizeLockCode("7KQ4M-0OIL1-ABCDE-FGHJK"))).toBe(false); // 0, O, I, L, 1 yok
    expect(isLockCode(normalizeLockCode(code).slice(1))).toBe(false);
    expect(formatLockCode("ABCDEFGHJKMNPQRSTVWX")).toBe("ABCDE-FGHJK-MNPQR-STVWX");
  });

  it("ön özet: alan ayırıcılı SHA-256, base64url (43 karakter); farklı kod farklı özet; bozuk kod da özet alır", () => {
    const a = lockCodePrehash(generateLockCode(rnd));
    const b = lockCodePrehash(generateLockCode(rnd));
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
    expect(lockCodePrehash("bozuk")).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});
