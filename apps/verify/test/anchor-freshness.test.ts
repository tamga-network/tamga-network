/**
 * Çapa günlüğü tazeliği (SPEC-TRUST-0001 §6; `TAMGA_VERIFY_ANCHOR_MAX_AGE_SEC`): servis sınırı dizin yükleyicisine geçirir.
 * Sınır aşılınca paketin mevcut "bayat çapa" yolu işler — kaynak sağlıksız, güven soruları UNKNOWN (doğrulamada INDETERMINATE);
 * RED üretilmez. Sınır verilmezse (yerel geliştirme / test) eski gevşek davranış. Dev PKI + test listesi (`npm run setup`).
 */
import { existsSync, mkdtempSync, cpSync, readFileSync, utimesSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it, expect, afterEach } from "vitest";
import { buildVerifyApp } from "../src/app.js";
import type { VerifyConfig } from "../src/config.js";

const ROOT = resolve(import.meta.dirname, "../../..");
const PKI = resolve(ROOT, "ops/pki");
const DIST = resolve(ROOT, "apps/trust-publisher/dist-test");
const ready = existsSync(resolve(PKI, "rp-verify.pkcs8.pem")) && existsSync(resolve(DIST, "lotl.jws"));

describe.skipIf(!ready)("apps/verify — çapa günlüğü tazelik sınırı", () => {
  type App = Awaited<ReturnType<typeof buildVerifyApp>>;
  const apps: App[] = [];
  const build = async (extra: Partial<VerifyConfig> = {}) => {
    const app = await buildVerifyApp({
      publicBase: "http://verify.local",
      port: 0,
      clientId: "",
      pkiDir: PKI,
      trustDist: DIST,
      stateCode: "TR",
      trustReloadSec: 60,
      statusPrefetchSec: 60,
      dataDir: join(tmpdir(), `tamga-verify-anchor-${process.pid}-${Math.random().toString(36).slice(2, 8)}`),
      requireRpAuth: false,
      ...extra,
    });
    apps.push(app);
    return app;
  };
  const health = async (app: App) =>
    (await app.inject({ method: "GET", url: "/healthz" })).json() as { ok: boolean; trust: { healthy: boolean } };
  /** Test listesindeki ilk etkin kurumun kimliği (liste içeriği: kişisel veri yok). */
  const anIssuerId = (): string => {
    const jws = readFileSync(resolve(DIST, "tl-tr.jws"), "utf8").trim();
    const list = JSON.parse(Buffer.from(jws.split(".")[1], "base64url").toString("utf8")) as {
      issuers: Array<{ issuer_id: string; status: string }>;
    };
    return list.issuers.find((i) => i.status === "ACTIVE")!.issuer_id;
  };
  const nowSec = () => Math.floor(Date.now() / 1000);

  afterEach(async () => {
    while (apps.length) await apps.pop()!.close();
  });

  it("sınır verilmezse (yerel / test) eski gevşek davranış: kaynak sağlıklı, güven soruları cevaplanır", async () => {
    const app = await build();
    expect((await health(app)).trust.healthy).toBe(true);
    expect(app.trust().isCredentialAcceptable(anIssuerId(), nowSec())).not.toBe("UNKNOWN");
  });

  it("son çapa sınırdan eskiyse kaynak bayat: /healthz healthy=false, güven soruları UNKNOWN (RED değil)", async () => {
    // test listesinin son çapası en az birkaç saniye önce yazıldı; 1 saniyelik sınır onu bayat yapar
    const app = await build({ anchorMaxAgeSec: 1 });
    const h = await health(app);
    expect(h.ok).toBe(true); // servis ayakta; sonuçlar "bilinmiyor"
    expect(h.trust.healthy).toBe(false);
    expect(app.trust().isCredentialAcceptable(anIssuerId(), nowSec())).toBe("UNKNOWN");
  });

  it("sınır içindeki çapa günlüğü sağlıklıdır; yeniden yüklemede de aynı sınır uygulanır", async () => {
    const copy = mkdtempSync(join(tmpdir(), "tamga-verify-anchor-dist-"));
    cpSync(DIST, copy, { recursive: true });
    const wide = await build({ trustDist: copy, anchorMaxAgeSec: 400 * 86_400 });
    expect((await health(wide)).trust.healthy).toBe(true);
    const tight = await build({ trustDist: copy, anchorMaxAgeSec: 1 });
    expect((await health(tight)).trust.healthy).toBe(false);
    // dosya damgası değişince yeniden yüklenir: sınır yine geçerli (gevşek varsayılana dönmez)
    const later = new Date(Date.now() + 5000);
    utimesSync(join(copy, "anchors.jsonl"), later, later);
    await tight.reloadTrust();
    expect((await health(tight)).trust.healthy).toBe(false);
  });
});
