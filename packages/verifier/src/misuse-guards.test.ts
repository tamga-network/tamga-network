/**
 * Güvenlik turu 2026-10-19 (sharp-edges): yanlış kullanımda sessizce geçen denetimler kapalı kalır — eksik politika tazelik
 * sınırları, yerel adres eşleşmesi, boş beklenen değerli takma ad. Kişisel veri yok.
 */
import { describe, it, expect, vi } from "vitest";
import { isLocalUrl, stepT0, type VerifyCtx } from "./steps.js";
import { verifyPseudonym } from "./pseudonym.js";
import type { TrustSource } from "@tamga-network/trust";

const ctxWith = (freshness: unknown) =>
  ({
    fr: { healthy: true, ageSec: 10 },
    input: {
      policy: {
        trust: { min_issuer_assurance: "I1", allowed_categories: [], require_recognition: false, state_code: "TR" },
        credentials: [],
        freshness,
      },
    },
    done: [],
  }) as unknown as VerifyCtx;

describe("yanlış kullanım korumaları", () => {
  it("T0: politika tazelik sınırları eksik/bozuk → DOĞRULANAMADI (yaş denetimi sessizce kapanmaz)", () => {
    const ok = ctxWith({ max_trust_age_sec: 86400, max_status_token_age_sec: 3600 });
    expect(stepT0(ok)).toBeUndefined();
    expect(ok.done).toContain("T0");
    for (const bad of [
      {},
      { max_trust_age_sec: 86400 },
      { max_trust_age_sec: "86400", max_status_token_age_sec: 3600 },
      { max_trust_age_sec: -1, max_status_token_age_sec: 3600 },
      { max_trust_age_sec: Number.NaN, max_status_token_age_sec: 3600 },
      { max_trust_age_sec: 86400, max_status_token_age_sec: 3600, max_clock_skew_sec: 86400 },
    ]) {
      const c = ctxWith(bad);
      expect(stepT0(c), JSON.stringify(bad)).toMatchObject({ step: "T0" });
      expect(c.done).not.toContain("T0");
    }
  });

  it("yerel issuer adresi: ana makine adı tam eşleşir", () => {
    for (const u of ["http://localhost:4001/example-university", "http://192.168.1.20:4001/x", "https://10.0.0.5/x"])
      expect(isLocalUrl(u), u).toBe(true);
    for (const u of [
      "http://localhost.evil.example/x",
      "http://10.0.0.1.evil.example/x",
      "https://localhost/x",
      "https://issuer.tamga.network/example-university",
      "not a url",
    ])
      expect(isLocalUrl(u), u).toBe(false);
  });

  it("takma ad: boş beklenen aud/nonce/rp ve istemci kimliği biçimli site kabul edilmez", async () => {
    const trust = {} as TrustSource;
    for (const p of [
      { aud: "", nonce: "n", rpKey: "site.example" },
      { aud: "x509_hash:a", nonce: "", rpKey: "site.example" },
      { aud: "x509_hash:a", nonce: "n", rpKey: "" },
      // ADR-0031 K2: beklenen site istemci kimliği olamaz (sertifika yenilenince değişir)
      { aud: "x509_hash:a", nonce: "n", rpKey: "x509_hash:a" },
    ])
      expect(await verifyPseudonym({ walletStatusOf: "none", ...p, token: "x.y.z", trust })).toMatchObject({
        ok: false,
        reason: expect.stringMatching(/expected/),
      });
  });
});

describe("C6-Kü7 (güvenlik incelemesi 2026-11-18): verification_id kriptografik rastgele", () => {
  it("Math.random kullanılmaz; biçim vrf_ + küçük harf/rakam; iki kimlik farklı", async () => {
    const { verifyPresentation } = await import("./verify.js");
    const ids: string[] = [];
    const spy = vi.spyOn(Math, "random");
    for (let i = 0; i < 2; i++)
      await verifyPresentation({
        presentation: "x~",
        aud: "a",
        nonce: "n",
        policyCredentialId: "c",
        rp: "none",
        rootCertsDer: "none",
        statusCache: { get: () => null } as never,
        trust: {
          freshness: () => ({ source: "list", version: 1, ageSec: 0, healthy: true }),
        } as unknown as TrustSource,
        policy: { freshness: undefined } as never,
        audit: (e: { verification_id: string }) => void ids.push(e.verification_id),
      } as never);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    expect(ids).toHaveLength(2);
    for (const id of ids) expect(id).toMatch(/^vrf_[0-9a-z]{12,}$/);
    expect(ids[0]).not.toBe(ids[1]);
  });
});
