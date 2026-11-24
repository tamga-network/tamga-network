/** ADR-0089 eki (2026-11-24, ARF ISSU_37): belge verenin kopya politikasına uyma — yöntem A / B / D (ETSI TS 119 472-3 §4.2.4.2). */
import { describe, it, expect } from "vitest";
import { reuseMethodOf } from "./reuse-policy.js";
import { planCopy, remainingCopies, selectCopy, type StoredCredential } from "./store.js";
import type { IssuerMetadata } from "./oid4vci.js";

const VCT = "urn:tamga:edu:StudentCredential:1";
const md = (policy?: unknown): IssuerMetadata =>
  ({
    credential_issuer: "https://issuer.example",
    credential_endpoint: "https://issuer.example/credential",
    credential_configurations_supported: {
      [VCT]: {
        format: "dc+sd-jwt",
        vct: VCT,
        ...(policy ? { credential_metadata: { credential_reuse_policy: policy } } : {}),
      },
    },
  }) as unknown as IssuerMetadata;
const pol = (details: string[]) => ({
  id: "arf_annex_ii",
  options: [{ details, batch_size: 10, reissue_trigger_unused: 2 }],
});

const cred = (usedBy: string[][], reuse?: StoredCredential["reuse"]): StoredCredential => ({
  id: "a",
  vct: VCT,
  typeName: "x",
  issuer: "https://issuer.example",
  issuerId: "0x1",
  leafFingerprint: "fp",
  iat: 1,
  claims: {},
  disclosureNames: [],
  copies: usedBy.map((u, i) => ({
    keyRef: `a.${i}`,
    cnf: { kty: "EC", crv: "P-256", x: "x", y: "y" },
    combined: "c",
    usedBy: u,
  })),
  receivedAt: 1,
  ...(reuse ? { reuse } : {}),
});

describe("reuseMethodOf: details dizisinde ilk desteklenen yöntem (-05/-06)", () => {
  it("Tamga belge vereni [per-relying-party, once_only] → D (bugünkü davranış değişmez)", () => {
    expect(reuseMethodOf(md(pol(["per-relying-party", "once_only"])), VCT)).toBe("per_relying_party");
  });
  it("desteklenmeyen rotating-batch atlanır; once_only / limited_time (iki yazım) seçilir", () => {
    expect(reuseMethodOf(md(pol(["rotating-batch", "once_only"])), VCT)).toBe("once_only");
    expect(reuseMethodOf(md(pol(["limited_time"])), VCT)).toBe("limited_time");
    expect(reuseMethodOf(md(pol(["limited-time"])), VCT)).toBe("limited_time");
  });
  it("politika yok, başka id ya da yalnız desteklenmeyen yöntem → undefined", () => {
    expect(reuseMethodOf(md(), VCT)).toBeUndefined();
    expect(reuseMethodOf(md({ id: "other", options: [{ details: ["once_only"] }] }), VCT)).toBeUndefined();
    expect(reuseMethodOf(md(pol(["rotating-batch"])), VCT)).toBeUndefined();
  });
});

describe("kopya seçimi yönteme göre", () => {
  it("D ve politikasız: aynı doğrulayıcıya aynı kopya (yapışkan)", () => {
    for (const r of ["per_relying_party", undefined] as const) {
      const c = cred([["rp1"], []], r);
      expect(planCopy(c, "rp1")).toMatchObject({ kind: "sticky", keyRef: "a.0" });
      expect(selectCopy(c, "rp1")?.keyRef).toBe("a.0");
    }
  });
  it("A (once_only): aynı doğrulayıcıya da yeni kopya; tükenince en az gösterilmiş kopya yedeği (ISSU_47)", () => {
    const c = cred([["rp1"], []], "once_only");
    expect(planCopy(c, "rp1")).toMatchObject({ kind: "fresh", keyRef: "a.1" });
    expect(selectCopy(c, "rp1")?.keyRef).toBe("a.1");
    const done = cred([["rp1", "rp2"], ["rp1"]], "once_only");
    expect(planCopy(done, "rp1")).toMatchObject({ kind: "exhausted", reuse: { keyRef: "a.1" } });
    expect(selectCopy(done, "rp1")).toBeNull();
  });
  it("B (limited_time): tek kopya her doğrulayıcıya; tükenmez, az kopya uyarısı çıkmaz", () => {
    const c = cred([["rp1", "rp2"]], "limited_time");
    expect(planCopy(c, "rp3")).toMatchObject({ kind: "fresh", keyRef: "a.0" });
    expect(planCopy(c, "rp1")).toMatchObject({ kind: "sticky", keyRef: "a.0" });
    expect(selectCopy(c, "rp9")?.keyRef).toBe("a.0");
    expect(remainingCopies(c)).toBe(1);
  });
});

describe("yöntem B'de kopya eşiği yok (yenileme süreye bağlı, ISSU_50)", () => {
  it("copiesLow: A ve D'de eşik, B'de hiçbir zaman", async () => {
    const { copiesLow } = await import("./store.js");
    expect(copiesLow(cred([["rp1"], [], []], "once_only"))).toBe(true);
    expect(copiesLow(cred([[], [], [], []]))).toBe(false);
    expect(copiesLow(cred([["rp1"]], "limited_time"))).toBe(false);
  });
});
