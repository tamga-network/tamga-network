/**
 * Güvenlik turu S9: doğrulayıcının HTML sayfalarında CSP — betik yalnız kendi kökeninden ve isteğe özgü nonce ile; her satır içi
 * <script> aynı nonce'u taşır; çerçeveye alınmaz; nonce istekten isteğe değişir. Örnek site ve DC API test sayfası çalışır kalır.
 */
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { describe, it, expect, beforeAll } from "vitest";
import { buildVerifyApp } from "../src/app.js";
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

describe.skipIf(!ready)("CSP (S9)", () => {
  let app: Awaited<ReturnType<typeof buildVerifyApp>>;
  beforeAll(async () => {
    app = await buildVerifyApp(cfg(), { showcase: true });
  });

  const check = async (url: string) => {
    const r = await app.inject({ url, headers: { "accept-language": "tr" } });
    expect(r.statusCode).toBe(200);
    expect(String(r.headers["content-type"])).toContain("text/html");
    const csp = String(r.headers["content-security-policy"]);
    for (const d of [
      "default-src 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
    ])
      expect(csp).toContain(d);
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
    expect(nonce, "başlıkta nonce").toBeTruthy();
    // sayfadaki HER satır içi <script> bu isteğin nonce'unu taşır; src'li betikler kendi kökeninden ya da listedeki CDN'den
    const scripts = [...r.body.matchAll(/<script\b([^>]*)>/g)].map((m) => m[1]);
    expect(scripts.length).toBeGreaterThan(0);
    for (const attrs of scripts) {
      if (/\bsrc=/.test(attrs)) {
        const src = /src="([^"]+)"/.exec(attrs)![1];
        expect(src.startsWith("/") || src.startsWith("https://cdn.jsdelivr.net/")).toBe(true);
      } else expect(attrs).toContain(`nonce="${nonce}"`);
    }
    expect(r.headers["x-frame-options"]).toBe("DENY");
    expect(r.headers["x-content-type-options"]).toBe("nosniff");
    return nonce!;
  };

  it("ana sayfa, örnek site, kapı sayfası, DC API test sayfası: CSP + nonce; nonce her istekte farklı", async () => {
    const n1 = await check("/");
    const n2 = await check("/");
    expect(n1).not.toBe(n2);
    await check("/sample-site");
    await check("/dc-api-test");
    const term = await app.inject({ url: "/terminal" });
    if (term.statusCode === 200 && String(term.headers["content-type"]).includes("text/html")) await check("/terminal");
  });

  it("JSON ve betik yanıtlarında CSP yok, nosniff var; site kiti yüklenir", async () => {
    const pol = await app.inject({ url: "/policies" });
    expect(pol.statusCode).toBe(200);
    expect(pol.headers["content-security-policy"]).toBeUndefined();
    expect(pol.headers["x-content-type-options"]).toBe("nosniff");
    const kit = await app.inject({ url: "/tamga-verifier.js" });
    expect(kit.statusCode).toBe(200);
    expect(kit.headers["content-security-policy"]).toBeUndefined();
  });
});
