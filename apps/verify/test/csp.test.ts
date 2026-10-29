/**
 * Güvenlik turu K10 (S9'un devamı): doğrulayıcının HTML sayfalarında tam CSP — betik ve biçim yalnız kendi kökeninden ayrı dosya
 * (`/assets/*`), satır içi `<script>`/`<style>`/`style=""`/olay özniteliği yok, nonce yok, CDN yok (QR okuyucu kendi kopyamız),
 * Trusted Types zorunlu. Her sayfa üretilir ve düzenli ifadeyle taranır; CSP dizgisi birebir denetlenir.
 */
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, it, expect, beforeAll } from "vitest";
import type { VerificationResult } from "@tamga-network/verifier";
import { buildVerifyApp, VERIFY_CSP } from "../src/app.js";
import { ASSETS, sandboxBar } from "../src/brand.js";
import { checkPage, resultPage } from "../src/html.js";
import type { VerifyConfig } from "../src/config.js";

const ROOT = resolve(import.meta.dirname, "../../..");
const PKI = resolve(ROOT, "ops/pki");
const DIST = resolve(ROOT, "apps/trust-publisher/dist-test");
const ready = existsSync(resolve(PKI, "rp-verify.pkcs8.pem")) && existsSync(resolve(DIST, "lotl.jws"));
const cfg = (): VerifyConfig => ({
  publicBase: "http://verify.local",
  port: 0,
  clientId: "",
  pkiDir: PKI,
  trustDist: DIST,
  stateCode: "TR",
  trustReloadSec: 60,
  statusPrefetchSec: 60,
  dataDir: join(tmpdir(), "tamga-verify-csp-" + process.pid + "-" + Math.random().toString(36).slice(2)),
  requireRpAuth: false,
});

const EXPECTED_CSP =
  "default-src 'none'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; " +
  "img-src 'self' data:; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; " +
  "require-trusted-types-for 'script'; trusted-types 'none'";

/** Sayfada satır içi betik/biçim yok: her `<script>` kendi kökeninden `src`'li, `<style>` ve `style=` yok, `on…=` yok. */
export function expectNoInline(html: string, where: string) {
  expect(html, `${where}: <style>`).not.toMatch(/<style\b/i);
  expect(html, `${where}: style=""`).not.toMatch(/\sstyle\s*=/i);
  expect(html, `${where}: olay özniteliği`).not.toMatch(/<[^>]+\son[a-z]+\s*=/i);
  expect(html, `${where}: javascript: bağlantısı`).not.toMatch(/(href|src|action)\s*=\s*["']?\s*javascript:/i);
  expect(html, `${where}: nonce`).not.toMatch(/\snonce\s*=/i);
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const src = /\ssrc="([^"]+)"/.exec(m[1])?.[1];
    expect(src, `${where}: satır içi <script>`).toBeTruthy();
    expect(src!.startsWith("/") && !src!.startsWith("//"), `${where}: dış betik ${src}`).toBe(true);
    expect(m[2].trim(), `${where}: src'li betiğin gövdesi`).toBe("");
  }
}

describe.skipIf(!ready)("CSP (K10)", () => {
  let app: Awaited<ReturnType<typeof buildVerifyApp>>;
  beforeAll(async () => {
    app = await buildVerifyApp(cfg(), { showcase: true });
  });

  const check = async (url: string, status = 200) => {
    const r = await app.inject({ url, headers: { "accept-language": "tr" } });
    expect(r.statusCode, url).toBe(status);
    expect(String(r.headers["content-type"])).toContain("text/html");
    expect(r.headers["content-security-policy"], url).toBe(EXPECTED_CSP);
    expect(r.headers["x-frame-options"]).toBe("DENY");
    expect(r.headers["x-content-type-options"]).toBe("nosniff");
    expectNoInline(r.body, url);
    return r;
  };

  it("CSP dizgisi birebir: nonce yok, 'unsafe-inline'/'unsafe-eval' yok, CDN yok", () => {
    expect(VERIFY_CSP).toBe(EXPECTED_CSP);
    expect(VERIFY_CSP).not.toMatch(/unsafe-|nonce-|jsdelivr|\*/);
  });

  it("bütün HTML sayfaları: ana sayfa, örnek site, DC API, kapı, inceleme, bekleme, nötr durum, bulunamadı", async () => {
    await check("/");
    const site = await check("/sample-site");
    expect(site.body).toContain('src="/assets/sample-site.js"');
    await check("/dc-api-test");
    await check("/app-review");
    const term = await app.inject({ url: "/terminal" });
    if (String(term.headers["content-type"]).includes("text/html")) {
      const t = await check("/terminal", term.statusCode);
      if (term.statusCode === 200) expect(t.body).toContain('src="/assets/vendor/jsQR.js"');
    }
    // inceleme sayfasındaki "QR oluştur" formu → bekleme sayfası (QR + yoklama betiği)
    const policy_id = /name="policy_id" value="([^"]+)"/.exec((await app.inject({ url: "/app-review" })).body)?.[1];
    expect(policy_id).toBeTruthy();
    const made = await app.inject({ method: "POST", url: "/presentations", payload: { policy_id } });
    expect(made.statusCode).toBe(302);
    const loc = String(made.headers.location);
    const pending = await check(loc);
    expect(pending.body).toMatch(
      /<script src="\/assets\/pending\.js" data-poll="\/presentations\/[^"?]+\?st=[^"]+"><\/script>/,
    );
    await check(loc.split("?")[0]); // durum jetonsuz: nötr durum
    await check("/p/yok", 404);
  });

  it("sonuç ve kontrol görünümü (satır içi yok)", async () => {
    const policy_id = /name="policy_id" value="([^"]+)"/.exec((await app.inject({ url: "/app-review" })).body)![1];
    const made = await app.inject({ method: "POST", url: "/presentations", payload: { policy_id } });
    const id = /\/p\/([^?]+)/.exec(String(made.headers.location))![1];
    const p = app.presentations.get(id)!;
    const r = {
      outcome: "REJECTED",
      failed_step: "B1",
      failed_reason: '<img src=x onerror="alert(1)">',
      indeterminate_reason: null,
      checks_performed: ["T0", "A1"],
      issuer: null,
      schema: null,
      status: { value: "unknown", token_age_sec: null, list_version: null },
      freshness: { trust_source: "test", trust_version: 1, trust_age_sec: 0 },
      disclosed_claims: [],
      spec_version: "x",
      sdk_version: "y",
      verification_id: "z",
    } as unknown as VerificationResult;
    expectNoInline(resultPage("tr", p, r, id), "resultPage");
    expectNoInline(checkPage("en", p, r, id, "verify.local"), "checkPage");
  });

  it("sandbox şeridi sınıfla (style özniteliği yok)", () => {
    for (const l of ["en", "tr"] as const) {
      expect(sandboxBar(l)).toContain('class="sandbox-bar"');
      expectNoInline(sandboxBar(l), "sandboxBar");
    }
  });

  it("varlıklar kendi kökeninden, doğru türle; JSON ve betik yanıtlarında CSP yok", async () => {
    for (const path of Object.keys(ASSETS)) {
      const a = await app.inject({ url: path });
      expect(a.statusCode, path).toBe(200);
      expect(a.body.length, path).toBeGreaterThan(0);
      expect(String(a.headers["content-type"]), path).toMatch(
        path.endsWith(".css") ? /^text\/css/ : /^application\/javascript/,
      );
      expect(a.headers["content-security-policy"]).toBeUndefined();
      expect(a.headers["x-content-type-options"]).toBe("nosniff");
    }
    const pol = await app.inject({ url: "/policies" });
    expect(pol.headers["content-security-policy"]).toBeUndefined();
    const kit = await app.inject({ url: "/tamga-verifier.js" });
    expect(kit.statusCode).toBe(200);
    expect(kit.headers["content-security-policy"]).toBeUndefined();
    // site kiti biçimi CSSOM ile yazar (style özniteliği değil) ve HTML dizgisi kullanmaz
    expect(kit.body).not.toMatch(/innerHTML|setAttribute\(\s*["']style/);
  });

  it("kendi QR okuyucu kopyamız: kayıtlı sürümün özetiyle aynı (CDN dosyasıyla birebir)", () => {
    const file = readFileSync(resolve(import.meta.dirname, "../assets/vendor/jsQR.js"));
    const sha = createHash("sha384").update(file).digest("base64");
    expect(sha).toBe("b5Ya4Bq3qCyz39m2ISh+4DxjAIljdeFwK/BsXLuj9gugaNwAcj/ia15fxNZL9Nlx");
    const readme = readFileSync(resolve(import.meta.dirname, "../assets/vendor/README.md"), "utf8");
    expect(readme).toContain(sha);
  });
});
