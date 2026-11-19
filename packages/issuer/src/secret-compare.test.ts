/** C6-Ö8 (güvenlik incelemesi 2026-11-18): ön yetkili kod ve PIN sabit zamanlı karşılaştırılır (`timingSafeEqual`). */
import { describe, it, expect, vi } from "vitest";

const calls = vi.hoisted(() => ({ n: 0 }));
vi.mock("node:crypto", async (orig) => {
  const real = await orig<typeof import("node:crypto")>();
  return {
    ...real,
    timingSafeEqual: (a: NodeJS.ArrayBufferView, b: NodeJS.ArrayBufferView) => {
      calls.n++;
      return real.timingSafeEqual(a, b);
    },
  };
});
const { createOffer, redeemOffer } = await import("./oid4vci.js");

const NOW = 1_800_000_000;
const offer = () =>
  createOffer({
    slug: "example-university",
    subjectRef: "s-1",
    vct: "urn:tamga:edu:Diploma:1",
    klass: "on-screen",
    now: NOW,
  });

describe("C6-Ö8: sabit zamanlı gizli değer karşılaştırması", () => {
  it("yanlış PIN ve doğru PIN timingSafeEqual ile karşılaştırılır; sonuç değişmez", () => {
    const o = offer();
    calls.n = 0;
    const wrong = o.txCode === "000000" ? "111111" : "000000";
    expect(redeemOffer(o, o.preAuthorizedCode, wrong, NOW)).toEqual({ ok: false, error: "tx_code_mismatch" });
    expect(calls.n).toBeGreaterThanOrEqual(2); // ön yetkili kod + PIN
    expect(redeemOffer(o, o.preAuthorizedCode, o.txCode, NOW).ok).toBe(true);
  });
  it("yanlış ön yetkili kod (farklı uzunluk dahil) invalid_grant", () => {
    const o = offer();
    expect(redeemOffer(o, o.preAuthorizedCode + "x", o.txCode, NOW)).toEqual({ ok: false, error: "invalid_grant" });
    expect(redeemOffer(o, "x", o.txCode, NOW)).toEqual({ ok: false, error: "invalid_grant" });
    expect(o.attempts).toBe(0);
  });
});
