/**
 * C32 (7) — `chain-check` sonucunun doğrulayıcı sağlık sayfasına (`/healthz` `chain`) bağlanması (ADR-0051 K1.2/K5, CH1, CH5):
 * bayrak kapalıyken ve sandbox'ta UNKNOWN (zincire bağlanılmaz); açıkken yüklü listeler zincirde onaylı mı (YES / NO / UNKNOWN);
 * zincir hatası kötüleştirmez; `ok` değişmez.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { MemoryChainClient } from "../../trust-publisher/src/chain/client.js";
import { listAnchorOf } from "../../trust-publisher/src/chain/projection.js";
import { checkDistAnchored } from "../../trust-publisher/src/chain/verify.js";
import { buildVerifyApp } from "../src/app.js";
import {
  CHAIN_DISABLED_REASON,
  CHAIN_MISCONFIGURED_REASON,
  CHAIN_SANDBOX_REASON,
  CHAIN_UNREACHABLE_REASON,
  ChainHealthMonitor,
  chainHealthFromEnv,
  summarizeChain,
} from "../src/chain-health.js";
import type { VerifyConfig } from "../src/config.js";

const fakeJws = (payload: Record<string, unknown>) =>
  `eyJhbGciOiJFUzI1NiJ9.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.c2ln`;
const list = (v: number, extra = "") =>
  fakeJws({ version: v, issued_at: "2026-11-01T00:00:00Z", previous_version_hash: null, x: extra });

describe("zincir sağlığı — özet ve monitör", () => {
  it("summarizeChain: NO baskın, hepsi YES → YES, aksi UNKNOWN", () => {
    const y = { file: "lotl", version: 2, anchored: "YES" as const, reason: "" };
    const n = { file: "tl-tr", version: 5, anchored: "NO" as const, reason: "" };
    const u = { file: "tl-kz", version: 1, anchored: "UNKNOWN" as const, reason: "çapa yok" };
    expect(summarizeChain([y, y]).anchored).toBe("YES");
    expect(summarizeChain([y, n, u]).anchored).toBe("NO");
    expect(summarizeChain([y, n]).reason).toContain("tl-tr v5");
    expect(summarizeChain([y, u])).toEqual({ anchored: "UNKNOWN", reason: "tl-kz: çapa yok" });
    expect(summarizeChain([]).anchored).toBe("UNKNOWN");
  });

  it("kapalı monitör: UNKNOWN + gerekçe, yenileme bir şey yapmaz; hata kötüleştirmez", async () => {
    const off = new ChainHealthMonitor(null);
    expect(off.current()).toEqual({
      enabled: false,
      anchored: "UNKNOWN",
      reason: CHAIN_DISABLED_REASON,
      checked_at: null,
      lists: [],
    });
    expect(await off.refresh()).toBe(off.current());
    // kontrol 2026-11-10: hata metni (RPC adresi, kimlik bilgisi taşıyabilir) herkese açık cevaba girmez — sabit gerekçe; ayrıntı günlüğe
    const logged: unknown[] = [];
    const broken = new ChainHealthMonitor(
      async () => {
        throw new Error("connect ECONNREFUSED https://user:secret@rpc.internal.example:8545");
      },
      undefined,
      undefined,
      (e) => logged.push(e),
    );
    const s = await broken.refresh();
    expect(s.anchored).toBe("UNKNOWN");
    expect(s.reason).toBe(CHAIN_UNREACHABLE_REASON);
    expect(JSON.stringify(s)).not.toMatch(/ECONNREFUSED|secret|rpc\.internal/);
    expect((logged[0] as Error).message).toContain("ECONNREFUSED");
    expect(s.checked_at).not.toBeNull();
  });

  it("ortamdan: bayrak kapalı → kapalı; sandbox → kapalı (PJ4); eksik ayar → kapalı + gerekçe (servis durmaz)", async () => {
    expect((await chainHealthFromEnv("production", "x", {})).current().reason).toBe(CHAIN_DISABLED_REASON);
    expect((await chainHealthFromEnv("sandbox", "x", { TAMGA_CHAIN_ENABLED: "1" })).current().reason).toBe(
      CHAIN_SANDBOX_REASON,
    );
    const miss = (await chainHealthFromEnv("production", "x", { TAMGA_CHAIN_ENABLED: "1" })).current();
    expect(miss.enabled).toBe(false);
    expect(miss.reason).toBe(CHAIN_MISCONFIGURED_REASON); // ayrıntı (hangi ayar) günlükte
  });

  it("yayın klasörü denetimi: onaylı aynı özet YES, farklı özet NO, çapasız UNKNOWN; zincir kapalı → UNKNOWN", async () => {
    const dist = mkdtempSync(join(tmpdir(), "chain-health-"));
    const lotl = list(3);
    const tr = list(7);
    writeFileSync(join(dist, "lotl.jws"), lotl);
    writeFileSync(join(dist, "tl-tr.jws"), tr);
    writeFileSync(join(dist, "tl-kz.jws"), list(1));
    writeFileSync(join(dist, "anchors.jsonl"), ""); // liste değil
    const chain = new MemoryChainClient(1);
    const a = listAnchorOf("production", "lotl", lotl);
    chain.seedList(a.listKey, {
      version: 3,
      contentHash: a.contentHash,
      previousHash: a.previousHash,
      issuedAt: a.issuedAt,
    });
    const b = listAnchorOf("production", "tl-tr", tr);
    chain.seedList(b.listKey, {
      version: 7,
      contentHash: "0x" + "ab".repeat(32),
      previousHash: b.previousHash,
      issuedAt: 1,
    });
    const out = await checkDistAnchored(chain, "production", dist);
    expect(out.map((c) => [c.file, c.anchored])).toEqual([
      ["lotl", "YES"],
      ["tl-kz", "UNKNOWN"],
      ["tl-tr", "NO"],
    ]);
    const mon = new ChainHealthMonitor(() => checkDistAnchored(chain, "production", dist));
    expect((await mon.refresh()).anchored).toBe("NO");
    expect((await checkDistAnchored(null, "production", dist)).every((c) => c.anchored === "UNKNOWN")).toBe(true);
  });
});

const ROOT = resolve(import.meta.dirname, "../../..");
const DIST = resolve(ROOT, "apps/trust-publisher/dist-test");
const PKI = resolve(ROOT, "ops/pki");
const ready = existsSync(resolve(PKI, "rp-verify.pkcs8.pem")) && existsSync(resolve(DIST, "lotl.jws"));

describe.skipIf(!ready)("/healthz — chain alanı", () => {
  const cfg = (): VerifyConfig => ({
    publicBase: "http://verify.local",
    port: 0,
    clientId: "",
    pkiDir: PKI,
    trustDist: DIST,
    stateCode: "TR",
    trustReloadSec: 60,
    statusPrefetchSec: 60,
    dataDir: mkdtempSync(join(tmpdir(), "tamga-verify-chain-")),
    requireRpAuth: false,
    network: "production",
  });

  it("varsayılan (bayrak kapalı): UNKNOWN, ok değişmez", async () => {
    const app = await buildVerifyApp(cfg());
    const h = (await app.inject({ method: "GET", url: "/healthz" })).json() as { ok: boolean; chain: any };
    expect(h.ok).toBe(true);
    expect(h.chain).toMatchObject({ enabled: false, anchored: "UNKNOWN", reason: CHAIN_DISABLED_REASON });
    await app.close();
  });

  it("monitör verilince yenileme sonucu görünür (NO yalnız bilgi; ok true kalır)", async () => {
    const mon = new ChainHealthMonitor(async () => [{ file: "lotl", version: 9, anchored: "NO", reason: "farklı" }]);
    const app = await buildVerifyApp(cfg(), { chainHealth: mon });
    await app.refreshChainHealth();
    const h = (await app.inject({ method: "GET", url: "/healthz" })).json() as { ok: boolean; chain: any };
    expect(h.ok).toBe(true);
    expect(h.chain.anchored).toBe("NO");
    expect(h.chain.lists).toHaveLength(1);
    await app.close();
  });
});
