import { describe, expect, it } from "vitest";
import { computeIdFromFingerprintHex, computeIssuerId } from "@tamga-network/core";
import { idFromCertDer, idFromFingerprintHex } from "./portable-hash.js";

describe("taşınabilir kimlik türetimi (ADR-0093, SPEC-ID-0002)", () => {
  it("@tamga-network/core ile birebir aynı", () => {
    const der = new Uint8Array(Array.from({ length: 300 }, (_, i) => (i * 37) % 256));
    for (const cc of ["TR", "AZ", "KZ"]) expect(idFromCertDer(cc, der)).toBe(computeIssuerId(cc, der));
    const fp = "ab".repeat(32);
    expect(idFromFingerprintHex("AZ", fp)).toBe(computeIdFromFingerprintHex("AZ", fp));
    expect(idFromFingerprintHex("TR", fp)).not.toBe(idFromFingerprintHex("AZ", fp));
    expect(() => idFromFingerprintHex("TR", "xyz")).toThrow();
  });
});
