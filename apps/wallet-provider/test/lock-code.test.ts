/**
 * Tamga Wallet WA-ADR-0002 — kapatma koduyla uzaktan kapatma, uçtan uca: cüzdan kodu üretir ve ön özetini kaydeder →
 * telefonsuz kişi `/lost` sayfasından (ya da JSON) kodu girer → birim ve WIA girişleri iptal → WIA verilmez, durum `revoked`.
 * Güvenlik: bozuk kod ile bilinmeyen kod aynı yanıt; genel sayaç yok, eşzamanlılık 503; yeni kod eskisini geçersiz kılar; iptal edilmiş birim
 * kod alamaz; sayfa no-store + çerçeve yok + dış betik yok; yanıtlarda ve durumda kod/ön özet geçmez.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { buildWalletProviderApp } from "../src/app.js";
import { LOST_PATH, slowHash } from "../src/lock.js";
import {
  SoftwareKeyProvider,
  MemoryKeyStore,
  WP_PATHS,
  generateLockCode,
  lockCodePrehash,
  registerLockCode,
  registerUnit,
  requestWia,
  unitStatus,
  wiaRevokedByList,
  type Http,
} from "@tamga-network/wallet-core";
import { loadTrustSourceFromDir } from "@tamga-network/trust";
import { randomBytes as nodeRandom } from "node:crypto";

const ROOT = resolve(import.meta.dirname, "../../..");
const PKI = resolve(ROOT, "ops/pki");
const DIST = resolve(ROOT, "apps/trust-publisher/dist-test"); // test listesi (test/fixtures/registry; npm run setup)
const ready = existsSync(resolve(PKI, "wallet-provider.pkcs8.pem")) && existsSync(resolve(DIST, "lotl.jws"));
const BASE = "http://wp.local";
const rnd = (n: number) => new Uint8Array(nodeRandom(n));
const build = (lost: { concurrent: number; minDelayMs: number; retryAfterSec?: number }) =>
  buildWalletProviderApp(
    {
      publicBase: BASE,
      port: 0,
      pkiDir: PKI,
      certName: "wallet-provider",
      wuaTtlDays: 30,
      solutions: [{ solution_id: "tamga-wallet-expo", min_version: "0.1.0" }],
      dataDir: null,
      device: { androidPackage: "network.tamga.wallet", appleAppId: null, allowDevelopment: false },
    },
    { lost },
  );

describe.skipIf(!ready)("wallet-provider: kapatma kodu (WA-ADR-0002)", () => {
  let app: Awaited<ReturnType<typeof buildWalletProviderApp>>;
  beforeAll(async () => {
    app = await build({ concurrent: 8, minDelayMs: 0 });
  });
  const http: Http = async (url, init) => {
    const r = await app.inject({
      method: init?.method ?? "GET",
      url: url.slice(BASE.length),
      headers: init?.headers,
      payload: init?.body,
    });
    return { status: r.statusCode, text: async () => r.body };
  };
  const wallet = () => new SoftwareKeyProvider(new MemoryKeyStore(), { platform: "ios-test" });
  const closeJson = (code: unknown) =>
    app.inject({ method: "POST", url: WP_PATHS.revoke, payload: { revocation_code: code } });

  it("kod kaydı → sayfadan kodla kapatma → birim revoked, WIA verilmez; yanıt hangi cüzdan olduğunu söylemez", async () => {
    const keys = wallet();
    const { unitId } = await registerUnit({ providerBase: BASE, keys, http, appVersion: "0.2.0", platform: "ios" });
    const code = generateLockCode(rnd);
    await registerLockCode({ providerBase: BASE, keys, http, code, randomBytes: rnd });
    expect(await unitStatus({ providerBase: BASE, keys, http, randomBytes: rnd })).toBe("active");
    // sayfa (TR): form gönderimi, küçük harf + boşluklu giriş kabul edilir
    const form = await app.inject({
      method: "POST",
      url: LOST_PATH,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: new URLSearchParams({
        code: code.toLowerCase().replace(/-/g, " "),
        confirm: "1",
        lang: "tr",
      }).toString(),
    });
    expect(form.statusCode).toBe(200);
    expect(form.headers["cache-control"]).toBe("no-store");
    expect(form.headers["x-frame-options"]).toBe("DENY");
    expect(form.body).toContain("Cüzdan kapatıldı");
    expect(form.body).not.toContain(unitId);
    expect(form.body).not.toContain("<script");
    // sonuç: birim iptal, WIA yok, durum revoked
    await expect(requestWia({ providerBase: BASE, keys, http })).rejects.toThrow(/revoked/);
    expect(await unitStatus({ providerBase: BASE, keys, http, randomBytes: rnd })).toBe("revoked");
    // aynı kod yeniden: zaten kapatılmış
    expect((await closeJson(code)).statusCode).toBe(409);
    // iptal edilmiş birim yeni kod kaydedemez
    await expect(
      registerLockCode({ providerBase: BASE, keys, http, code: generateLockCode(rnd), randomBytes: rnd }),
    ).rejects.toThrow(/revoked/);
    // depoda ve sağlık yanıtında kod ya da ön özet yok
    const healthz = (await app.inject({ url: "/healthz" })).body;
    expect(healthz).not.toContain(code.replace(/-/g, ""));
    expect(healthz).not.toContain(lockCodePrehash(code));
  });

  it("bilinmeyen kod ile biçim hatası aynı yanıt (404 code_unknown); onay kutusu yoksa form yeniden gösterilir", async () => {
    const unknown = await closeJson(generateLockCode(rnd));
    const malformed = await closeJson("0OIL1-0OIL1-0OIL1-0OIL1");
    const empty = await closeJson("");
    for (const r of [unknown, malformed, empty]) {
      expect(r.statusCode).toBe(404);
      expect(r.json()).toEqual({ error: "code_unknown" });
    }
    const noConfirm = await app.inject({
      method: "POST",
      url: LOST_PATH,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: new URLSearchParams({ code: generateLockCode(rnd), lang: "en" }).toString(),
    });
    expect(noConfirm.statusCode).toBe(400);
    expect(noConfirm.body).toContain("<form");
  });

  it("yeni kod eskisini geçersiz kılar; yalnız yeni kod kapatır", async () => {
    const keys = wallet();
    await registerUnit({ providerBase: BASE, keys, http, appVersion: "0.2.0", platform: "android" });
    const old = generateLockCode(rnd);
    const fresh = generateLockCode(rnd);
    await registerLockCode({ providerBase: BASE, keys, http, code: old, randomBytes: rnd });
    await registerLockCode({ providerBase: BASE, keys, http, code: fresh, randomBytes: rnd });
    expect((await closeJson(old)).statusCode).toBe(404);
    expect((await closeJson(fresh)).statusCode).toBe(200);
    expect((await closeJson(fresh)).json()).toEqual({ error: "already_revoked" });
  });

  it("genel deneme sayacı YOK (DoS): ardışık 8 yanlış kod yine 404; eşzamanlılık sınırı aşılınca 503 + Retry-After", async () => {
    for (let i = 0; i < 8; i++) expect((await closeJson(generateLockCode(rnd))).statusCode).toBe(404);
    const limited = await build({ concurrent: 1, minDelayMs: 300, retryAfterSec: 2 });
    const burst = await Promise.all(
      Array.from({ length: 4 }, () =>
        limited.inject({ method: "POST", url: WP_PATHS.revoke, payload: { revocation_code: generateLockCode(rnd) } }),
      ),
    );
    const codes = burst.map((r) => r.statusCode).sort();
    expect(codes).toEqual([404, 503, 503, 503]);
    expect(burst.find((r) => r.statusCode === 503)!.headers["retry-after"]).toBe("2");
    // kapı serbest kalınca yeniden çalışır
    expect(
      (await limited.inject({ method: "POST", url: WP_PATHS.revoke, payload: { revocation_code: "x" } })).statusCode,
    ).toBe(404);
    const h = await slowHash(lockCodePrehash(generateLockCode(rnd)));
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("form gövdesi yalnız /lost'ta ayrıştırılır; başka birimin kodu kaydedilemez (409)", async () => {
    const other = await app.inject({
      method: "POST",
      url: WP_PATHS.revoke,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: "revocation_code=abc",
    });
    expect(other.statusCode).toBe(415);
    const a = wallet();
    const b = wallet();
    await registerUnit({ providerBase: BASE, keys: a, http, appVersion: "0.2.0", platform: "ios" });
    await registerUnit({ providerBase: BASE, keys: b, http, appVersion: "0.2.0", platform: "ios" });
    const code = generateLockCode(rnd);
    await registerLockCode({ providerBase: BASE, keys: a, http, code, randomBytes: rnd });
    await expect(registerLockCode({ providerBase: BASE, keys: b, http, code, randomBytes: rnd })).rejects.toThrow(
      /another code/,
    );
  });

  it("K3/RL4: telefon silmeyi yalnız İMZALI WIA listesinden karar verir; imzasız ipucu ve bilinmeyen birim silme nedeni değil", async () => {
    const { trust } = await loadTrustSourceFromDir(DIST);
    const keys = wallet();
    await registerUnit({ providerBase: BASE, keys, http, appVersion: "0.2.0", platform: "ios" });
    const wia = await requestWia({ providerBase: BASE, keys, http });
    expect(await wiaRevokedByList({ wua: wia, http, trust })).toBe(false);
    const code = generateLockCode(rnd);
    await registerLockCode({ providerBase: BASE, keys, http, code, randomBytes: rnd });
    expect((await closeJson(code)).statusCode).toBe(200);
    expect(await wiaRevokedByList({ wua: wia, http, trust })).toBe(true);
    // imzacı güven listesinde değilse karar verilmez (fırlatır) — TLS'e tek başına güvenilmez
    await expect(wiaRevokedByList({ wua: wia, http, trust: { isWalletProviderKey: () => "NO" } })).rejects.toThrow(
      /registered wallet provider/,
    );
    // ipucu ucu: bilinmeyen birim → hata (silme değil)
    await expect(unitStatus({ providerBase: BASE, keys: wallet(), http, randomBytes: rnd })).rejects.toThrow();
  });

  it("sayfa TR/EN: sorgu > Accept-Language > İngilizce; metadata uçları ilan eder", async () => {
    const tr = await app.inject({ url: `${LOST_PATH}?lang=tr` });
    const en = await app.inject({ url: LOST_PATH, headers: { "accept-language": "de-DE" } });
    const viaHeader = await app.inject({ url: LOST_PATH, headers: { "accept-language": "tr" } });
    expect(tr.body).toContain("Telefonunu mu kaybettin?");
    expect(en.body).toContain("Lost your phone?");
    expect(viaHeader.body).toContain("Telefonunu mu kaybettin?");
    expect(tr.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    const meta = (await app.inject({ url: "/.well-known/wallet-provider" })).json() as Record<string, string>;
    expect(meta.unit_revocation_code_endpoint).toBe(`${BASE}${WP_PATHS.revocationCode}`);
    expect(meta.unit_status_endpoint).toBe(`${BASE}${WP_PATHS.status}`);
    expect(meta.lost_phone_page).toBe(`${BASE}${LOST_PATH}`);
  });
});
