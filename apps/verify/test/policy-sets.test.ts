/**
 * Politika kümeleri ortama göre (ADR-0038; 2026-10-04 "gerçek ağda test/demo kalmaz"):
 * gerçek ağ = genel (yaş, Tamga ile giriş) + mağaza inceleme (ADR-0033); kurgusal senaryolar, deneme paneli, örnek site ve kapı
 * sayfası yalnız sandbox'ta. /sample-site gerçek ağda sandbox'a (yayında değilse rehbere) yönlenir.
 */
import { ZK_COPY_VCT, isShortLivedType } from "@tamga-network/schemas";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { buildVerifyApp } from "../src/app.js";
import { policiesFor, policySummaries, POLICIES } from "../src/policies.js";
import { sandboxSampleSiteUrl, sandboxUrl, type VerifyConfig } from "../src/config.js";

const ROOT = resolve(import.meta.dirname, "../../..");
const SCENARIOS = [
  "job-application-degree",
  "student-discount",
  "campus-access",
  "event-tamga-id",
  "event-ticket",
  "car-rental-driving",
];
const GENERAL = ["age-over-18-mdoc", "age-over-18-zk", "site-signup", "site-signin"];
const REVIEW = ["review-age-over-18", "review-site-signup"];

describe("policiesFor", () => {
  it("gerçek ağ: genel + inceleme; kurgusal senaryo yok", () => {
    const ids = policiesFor("production").map((p) => p.policy_id);
    expect(ids.sort()).toEqual([...GENERAL, ...REVIEW].sort());
    for (const s of SCENARIOS) expect(ids).not.toContain(s);
    expect(policiesFor("production").some((p) => p.proximity)).toBe(false); // gerçek ağda kapı grubu yok
    expect(
      policiesFor(undefined)
        .map((p) => p.policy_id)
        .sort(),
    ).toEqual(ids.sort()); // varsayılan gerçek ağ
  });
  it("sandbox: hepsi (senaryolar dahil)", () => {
    const ids = policiesFor("sandbox").map((p) => p.policy_id);
    expect(ids.length).toBe(POLICIES.length);
    for (const s of [...SCENARIOS, ...GENERAL, ...REVIEW]) expect(ids).toContain(s);
    expect(policySummaries(policiesFor("production")).map((p) => p.policy_id)).not.toContain("campus-access");
  });
  it("ADR-0044: ZK politikası yalnız kısa ömürlü ZK kopyası türünü ister (K5) ve accept_unrevocable_zk kullanmaz", () => {
    const zk = POLICIES.filter((p) => p.credentials.some((c) => c.format === "mso_mdoc_zk"));
    expect(zk.map((p) => p.policy_id)).toContain("age-over-18-zk");
    for (const p of zk)
      for (const c of p.credentials.filter((x) => x.format === "mso_mdoc_zk")) {
        expect(c.vct_values, p.policy_id).toEqual([ZK_COPY_VCT]);
        expect(c.vct_values.every(isShortLivedType), p.policy_id).toBe(true);
        expect(c.accept_unrevocable_zk, p.policy_id).toBeUndefined();
      }
    const s = policySummaries(POLICIES);
    expect(s.find((p) => p.policy_id === "age-over-18-zk")).toMatchObject({
      accept_unrevocable_zk: false,
      vct_values: [ZK_COPY_VCT],
    });
    expect(s.find((p) => p.policy_id === "age-over-18-mdoc")).not.toHaveProperty("accept_unrevocable_zk");
  });
  it("sandbox bağlantısı: yayındaysa portal / sandbox örnek sitesi, değilse rehber (TR/EN)", () => {
    expect(sandboxUrl(true, "tr")).toBe("https://sandbox.tamga.network");
    expect(sandboxUrl(false, "tr")).toBe("https://docs.tamga.network/guides/sandbox");
    expect(sandboxUrl(false, "en")).toBe("https://docs.tamga.network/en/guides/sandbox");
    expect(sandboxSampleSiteUrl(true, "en")).toBe("https://verify.sandbox.tamga.network/sample-site");
    expect(sandboxSampleSiteUrl(false, "en")).toBe("https://docs.tamga.network/en/guides/sandbox");
  });
});

const cfgFor = (dist: string, pki: string, extra: Partial<VerifyConfig> = {}): VerifyConfig => ({
  publicBase: "http://verify.local",
  port: 0,
  clientId: "",
  pkiDir: pki,
  trustDist: dist,
  stateCode: "TR",
  trustReloadSec: 60,
  statusPrefetchSec: 60,
  dataDir: join(tmpdir(), "tamga-verify-sets-" + process.pid + "-" + Math.random().toString(36).slice(2)),
  requireRpAuth: false,
  ...extra,
});

const PROD_DIST = resolve(ROOT, "apps/trust-publisher/dist-test");
const PROD_PKI = resolve(ROOT, "ops/pki");
const prodReady = existsSync(resolve(PROD_PKI, "rp-verify.pkcs8.pem")) && existsSync(resolve(PROD_DIST, "lotl.jws"));

describe.skipIf(!prodReady)("gerçek ağ kipi (uygulama)", () => {
  it("ana sayfa: QR paneli yok, inceleme vitrini yok, geliştirici + sandbox bağlantısı var; API genel + inceleme", async () => {
    const app = await buildVerifyApp(cfgFor(PROD_DIST, PROD_PKI, { network: "production" }));
    const en = await app.inject({ method: "GET", url: "/" });
    expect(en.statusCode).toBe(200);
    expect(en.body).not.toContain("Create QR");
    expect(en.body).not.toContain('action="/presentations"');
    expect(en.body).not.toMatch(/review-age-over-18|review-site-signup|campus-access/);
    expect(en.body).toContain("https://docs.tamga.network/en/guides/sign-in-with-tamga");
    expect(en.body).toContain("https://docs.tamga.network/en/guides/sandbox");
    expect(en.body).not.toContain("/sample-site");
    expect(en.body).not.toContain("SANDBOX · TEST"); // gerçek ağda şerit yok
    expect(en.headers["x-robots-tag"]).toBeUndefined(); // ana sayfa dizine girebilir
    const tr = await app.inject({ method: "GET", url: "/", headers: { "accept-language": "tr-TR" } });
    expect(tr.body).toContain("https://docs.tamga.network/guides/sandbox");
    expect(tr.body).toContain("Gerçek ağda deneme yoktur");

    const health = (await app.inject({ method: "GET", url: "/healthz" })).json() as { policies: string[] };
    expect(health.policies.sort()).toEqual([...GENERAL, ...REVIEW].sort());
    const list = (await app.inject({ method: "GET", url: "/policies" })).json() as Array<{ policy_id: string }>;
    expect(list.map((p) => p.policy_id)).not.toContain("event-ticket");

    const post = (policy_id: string) =>
      app.inject({
        method: "POST",
        url: "/presentations",
        headers: { accept: "application/json", "content-type": "application/json" },
        payload: { policy_id },
      });
    expect((await post("campus-access")).statusCode).toBe(400); // senaryo yüklü değil
    expect((await post("age-over-18-mdoc")).statusCode).toBe(200);
    expect((await post("review-age-over-18")).statusCode).toBe(200);

    // ADR-0033: inceleyicinin doğrudan bağlantısı — yalnız inceleme politikaları, noindex, ana sayfadan bağlanmaz
    const rv = await app.inject({ method: "GET", url: "/app-review" });
    expect(rv.statusCode).toBe(200);
    expect(rv.headers["x-robots-tag"]).toContain("noindex");
    expect(rv.body).toContain('name="robots" content="noindex');
    expect(rv.body).toContain('value="review-age-over-18"');
    expect(rv.body).toContain('value="review-site-signup"');
    expect(rv.body).not.toMatch(/value="(age-over-18-mdoc|site-signup|campus-access)"/);
    expect(en.body).not.toContain("/app-review");
    const form = await app.inject({
      method: "POST",
      url: "/presentations",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: "policy_id=review-age-over-18",
    });
    expect(form.statusCode).toBe(302);
    expect(form.headers.location).toMatch(new RegExp("^/p/"));

    // kapı yüzü kapalı (politika yok)
    expect((await app.inject({ method: "GET", url: "/terminal" })).statusCode).toBe(404);
    const tv = await app.inject({ method: "POST", url: "/terminal/verify", payload: { token: "x" } });
    expect(tv.statusCode).toBe(404);
    await app.close();
  });

  it("/sample-site: sandbox yayında değilse rehbere, yayındaysa sandbox örnek sitesine 302", async () => {
    const off = await buildVerifyApp(cfgFor(PROD_DIST, PROD_PKI, { sandboxLive: false }));
    for (const url of ["/sample-site", "/demo-site", "/ornek-site", "/sample-site/session"]) {
      const r = await off.inject({ method: "GET", url });
      expect(r.statusCode, url).toBe(302);
      expect(r.headers.location, url).toBe("https://docs.tamga.network/en/guides/sandbox");
    }
    const st = await off.inject({ method: "POST", url: "/sample-site/start", payload: {} });
    expect(st.statusCode).toBe(302);
    // site kiti gerçek siteler için kalır
    expect((await off.inject({ method: "GET", url: "/tamga-verifier.js" })).statusCode).toBe(200);
    await off.close();
    const on = await buildVerifyApp(cfgFor(PROD_DIST, PROD_PKI, { sandboxLive: true }));
    const r = await on.inject({ method: "GET", url: "/sample-site", headers: { "accept-language": "tr" } });
    expect(r.statusCode).toBe(302);
    expect(r.headers.location).toBe("https://verify.sandbox.tamga.network/sample-site");
    expect((await on.inject({ method: "GET", url: "/" })).body).toContain('href="https://sandbox.tamga.network"');
    await on.close();
  });
});

const SB_DIST = resolve(ROOT, "apps/trust-publisher/dist-sandbox");
const SB_PKI = resolve(ROOT, "ops/pki-sandbox");
const sbReady = existsSync(resolve(SB_PKI, "rp-verify.pkcs8.pem")) && existsSync(resolve(SB_DIST, "lotl.jws"));

describe.skipIf(!sbReady)("sandbox kipi (uygulama)", () => {
  it("senaryolar, deneme paneli, örnek site ve kapı sayfası açık", async () => {
    const app = await buildVerifyApp(cfgFor(SB_DIST, SB_PKI, { network: "sandbox" }));
    const home = await app.inject({ method: "GET", url: "/" });
    expect(home.body).toContain("Create QR");
    expect(home.body).toContain("campus-access");
    const health = (await app.inject({ method: "GET", url: "/healthz" })).json() as { policies: string[] };
    for (const s of SCENARIOS) expect(health.policies).toContain(s);
    const site = await app.inject({ method: "GET", url: "/sample-site" });
    expect(site.statusCode).toBe(200);
    expect(site.body).toContain("Sign up with Tamga");
    const term = await app.inject({ method: "GET", url: "/terminal" });
    expect(term.statusCode).toBe(200);
    expect(term.headers["x-robots-tag"]).toContain("noindex");
    // ADR-0038 SB4: "test" şeridi ağ ayarından (cfg.network), süreç ortamından değil
    expect(process.env.TAMGA_NETWORK).not.toBe("sandbox");
    expect(home.body).toContain("SANDBOX · TEST");
    expect(term.body).toContain("SANDBOX · TEST");
    await app.close();
  });
});
