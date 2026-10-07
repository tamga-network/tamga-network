/**
 * Doğrulayıcı sertleştirme: hız sınırı (istemci adresi saklanmaz), bellekteki sunum üst sınırı, LAN güven listesi aynasında
 * kök dışına çıkan yol reddi.
 */
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { describe, it, expect } from "vitest";
import type { Policy, PresentationRequest } from "@tamga-network/verifier";
import { buildVerifyApp } from "../src/app.js";
import { TokenBucketLimiter } from "../src/rate-limit.js";
import { PresentationStore } from "../src/state.js";
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
  dataDir: join(tmpdir(), "tamga-verify-hard-" + process.pid + "-" + Math.random().toString(36).slice(2)),
  requireRpAuth: false,
});

describe("hız sınırı (TokenBucketLimiter)", () => {
  it("kova dolunca reddeder, zamanla dolar; anahtar adres değil (bellekte HMAC)", () => {
    let t = 0;
    const l = new TokenBucketLimiter({ burst: 2, perMin: 60 }, () => t);
    expect(l.take("203.0.113.7")).toBe(true);
    expect(l.take("203.0.113.7")).toBe(true);
    expect(l.take("203.0.113.7")).toBe(false);
    expect(l.take("198.51.100.1")).toBe(true); // başka istemci ayrı kova
    t += 1000; // 1 sn = 1 jeton
    expect(l.take("203.0.113.7")).toBe(true);
    expect(JSON.stringify([...(l as unknown as { buckets: Map<string, unknown> }).buckets.keys()])).not.toContain(
      "203.0.113.7",
    );
  });
});

describe("PresentationStore üst sınırı", () => {
  it("dolunca önce en eski yanıtsız sunum atılır", () => {
    const s = new PresentationStore(3);
    const far = Math.floor(Date.now() / 1000) + 600;
    const mk = (id: string) =>
      s.create({ presentationId: id, expiresAt: far } as PresentationRequest, {} as Policy, { t: 0, step: "x" });
    const a = mk("a");
    mk("b");
    mk("c");
    a.result = {} as never; // a yanıtlandı → en eski yanıtsız b
    a.resultAt = Date.now();
    mk("d");
    expect(s.size()).toBe(3);
    expect(s.get("a")).toBeDefined();
    expect(s.get("b")).toBeUndefined();
    expect(s.get("d")).toBeDefined();
  });
});

describe.skipIf(!ready)("apps/verify uç sertleştirmesi", () => {
  it("POST /presentations, /vp/response, /terminal/verify sınırı aşınca 429", async () => {
    const one = { burst: 1, perMin: 1 };
    const app = await buildVerifyApp(cfg(), { rateRules: { presentations: one, vpResponse: one, terminal: one } });
    const post = (url: string, payload: Record<string, unknown>) =>
      app.inject({ method: "POST", url, headers: { "content-type": "application/json" }, payload });
    expect((await post("/presentations", { policy_id: "yok" })).statusCode).toBe(400);
    const lim = await post("/presentations", { policy_id: "yok" });
    expect(lim.statusCode).toBe(429);
    expect(lim.headers["retry-after"]).toBeDefined();
    expect((await post("/vp/response", {})).statusCode).toBe(400);
    expect((await post("/vp/response", {})).statusCode).toBe(429);
    expect((await post("/terminal/verify", { token: "x" })).statusCode).toBe(404); // gerçek ağ biçimli liste: kapı yok
    expect((await post("/terminal/verify", { token: "x" })).statusCode).toBe(429);
    await app.close();
  });

  it("LAN güven listesi aynası: kök içindeki dosya sunulur, mutlak yol ve kök dışı reddedilir", async () => {
    const prev = process.env.TAMGA_VERIFY_SERVE_TRUST;
    process.env.TAMGA_VERIFY_SERVE_TRUST = "1";
    try {
      const app = await buildVerifyApp(cfg());
      expect((await app.inject({ method: "GET", url: "/trust/lotl.json" })).statusCode).toBe(200);
      for (const bad of ["/trust//etc/passwd", "/trust/%2Fetc%2Fpasswd", "/trust/C:/x", "/trust/keys/..%2F..%2Fx"])
        expect((await app.inject({ method: "GET", url: bad })).statusCode, bad).toBe(400);
      // yönlendirici "../"yı kendisi sadeleştirir: kök dışındaki dosya hiçbir yoldan sunulmaz
      expect((await app.inject({ method: "GET", url: "/trust/../package.json" })).statusCode).not.toBe(200);
      await app.close();
    } finally {
      if (prev === undefined) delete process.env.TAMGA_VERIFY_SERVE_TRUST;
      else process.env.TAMGA_VERIFY_SERVE_TRUST = prev;
    }
  });
});
