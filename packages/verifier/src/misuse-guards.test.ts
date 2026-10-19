/**
 * Güvenlik turu 2026-10-19 (sharp-edges): yanlış kullanımda sessizce geçen denetimler kapalı kalır — eksik politika tazelik
 * sınırları, yerel adres eşleşmesi, boş beklenen değerli takma ad. Kişisel veri yok.
 */
import { describe, it, expect } from "vitest";
import { isLocalUrl, stepT0, type VerifyCtx } from "./steps.js";
import { verifyPseudonym } from "./pseudonym.js";
import type { TrustSource } from "@tamga-network/trust";

const ctxWith = (freshness: unknown) =>
  ({ fr: { healthy: true, ageSec: 10 }, input: { policy: { freshness } }, done: [] }) as unknown as VerifyCtx;

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
    for (const u of ["http://localhost:4001/bilgi", "http://192.168.1.20:4001/x", "https://10.0.0.5/x"])
      expect(isLocalUrl(u), u).toBe(true);
    for (const u of [
      "http://localhost.evil.example/x",
      "http://10.0.0.1.evil.example/x",
      "https://localhost/x",
      "https://issuer.tamga.network/bilgi",
      "not a url",
    ])
      expect(isLocalUrl(u), u).toBe(false);
  });

  it("takma ad: boş beklenen aud/nonce/rp kabul edilmez", async () => {
    const trust = {} as TrustSource;
    for (const p of [
      { aud: "", nonce: "n", rpKey: "site.example" },
      { aud: "x509_hash:a", nonce: "", rpKey: "site.example" },
      { aud: "x509_hash:a", nonce: "n", rpKey: "" },
    ])
      expect(await verifyPseudonym({ ...p, token: "x.y.z", trust })).toMatchObject({
        ok: false,
        reason: expect.stringMatching(/expected/),
      });
  });
});
