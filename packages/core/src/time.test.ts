/** ADR-0056 K12: saniye/milisaniye türleri ve saat kayması üst sınırı. */
import { describe, it, expect } from "vitest";
import {
  MAX_CLOCK_SKEW_SEC,
  clockSkewOption,
  epochMillis,
  epochSeconds,
  millisOrNow,
  millisToSeconds,
  nowMillis,
  nowSeconds,
  secondsOrNow,
  secondsToMillis,
} from "./time.js";

describe("zaman birimleri (ADR-0056 K12)", () => {
  it("saniye ve milisaniye karıştırılamaz (çalışma zamanında da)", () => {
    expect(epochSeconds(1_790_000_000)).toBe(1_790_000_000);
    expect(() => epochSeconds(Date.now())).toThrow(/seconds/);
    expect(() => epochSeconds(Number.NaN)).toThrow(RangeError);
    expect(() => epochSeconds(-1)).toThrow(RangeError);
    expect(epochMillis(1_790_000_000_000)).toBe(1_790_000_000_000);
    expect(() => epochMillis(1_790_000_000)).toThrow(/milliseconds/);
    expect(() => epochMillis(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
  it("şimdi ve dönüşümler", () => {
    const s = nowSeconds();
    const ms = nowMillis();
    expect(Math.abs(millisToSeconds(ms) - s)).toBeLessThanOrEqual(1);
    expect(secondsToMillis(epochSeconds(10))).toBe(10_000);
    expect(secondsOrNow(undefined)).toBeGreaterThan(1_700_000_000);
    expect(() => secondsOrNow(Date.now() as never)).toThrow(/seconds/);
    expect(millisOrNow(undefined)).toBeGreaterThan(1_700_000_000_000);
    expect(() => millisOrNow(1_790_000_000 as never)).toThrow(/milliseconds/);
  });
  it("saat kayması seçeneği: varsayılan, sınır içi, sınır dışı", () => {
    expect(clockSkewOption("x", undefined, 120)).toBe(120);
    expect(clockSkewOption("x", 0, 120)).toBe(0);
    expect(clockSkewOption("x", MAX_CLOCK_SKEW_SEC, 120)).toBe(600);
    for (const bad of [601, -1, Number.NaN, 86400]) expect(() => clockSkewOption("x", bad, 120)).toThrow(RangeError);
  });
});
