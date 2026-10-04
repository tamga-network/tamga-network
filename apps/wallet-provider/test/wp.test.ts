/**
 * ADR-0025 / AB TS3 uçtan uca: cüzdan sağlayıcı ↔ wallet-core ↔ @tamga-network/issuer.
 * Birim kaydı → işlem başına WIA (< 24 saat, yeni anahtar + yeni iptal girişi) → kurum doğrular (imza, güven listesi, PoP,
 * client_status) → KA'lı proof (attested_keys, iso_18045_basic, tür başına iptal girişi) → birim iptali → WIA reddedilir;
 * anahtar deposu türü iptali → KA reddedilir. Eski WUA biçimi geçiş için hâlâ doğrulanır.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { decodeJwt } from "jose";
import { buildWalletProviderApp } from "../src/app.js";
import { WalletStatusChecker, verifyKaProof, verifyWalletAttestation, type KeyStorage } from "@tamga-network/issuer";
import { loadTrustSourceFromDir } from "@tamga-network/trust";
import {
  SoftwareKeyProvider,
  MemoryKeyStore,
  clientAttestationPop,
  registerUnit,
  requestWia,
  requestKeyAttestation,
  revokeUnit,
  deleteUnit,
  signJwt,
  type Http,
} from "@tamga-network/wallet-core";

const ROOT = resolve(import.meta.dirname, "../../..");
const PKI = resolve(ROOT, "ops/pki");
const DIST = resolve(ROOT, "apps/trust-publisher/dist-test"); // test listesi (test/fixtures/registry; npm run setup)
const ready = existsSync(resolve(PKI, "wallet-provider.pkcs8.pem")) && existsSync(resolve(DIST, "lotl.jws"));
const BASE = "http://wp.local";
const ISSUER = "https://issuer.tamga.network/bilgi";

describe.skipIf(!ready)("wallet-provider (TS3: WIA + KA)", () => {
  let app: Awaited<ReturnType<typeof buildWalletProviderApp>> & {
    revokeKeyStorageType?: (s: KeyStorage) => Promise<void>;
  };
  let isProviderKey: (fp: string) => "YES" | "NO" | "UNKNOWN";
  let checker: WalletStatusChecker;
  beforeAll(async () => {
    app = await buildWalletProviderApp({
      publicBase: BASE,
      port: 0,
      pkiDir: PKI,
      certName: "wallet-provider",
      wuaTtlDays: 30,
      solutions: [{ solution_id: "tamga-wallet-expo", min_version: "0.1.0" }],
      dataDir: null,
      device: { androidPackage: "network.tamga.wallet", appleAppId: null, allowDevelopment: false },
    });
    const { trust } = await loadTrustSourceFromDir(DIST);
    isProviderKey = (fp) => trust.isWalletProviderKey(fp);
    // her denetimde taze liste (önbellek 0 sn) — iptalin hemen görünmesi için
    checker = new WalletStatusChecker(
      async (uri) => (await app.inject({ url: uri.slice(BASE.length) })).body,
      isProviderKey,
      0,
    );
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
  const now = () => Math.floor(Date.now() / 1000);

  async function verifyWia(keys: SoftwareKeyProvider, wia: Awaited<ReturnType<typeof requestWia>>) {
    return verifyWalletAttestation({
      wua: wia.jwt,
      pop: await clientAttestationPop({ keys, wua: wia, aud: ISSUER }),
      issuerUrl: ISSUER,
      isProviderKey,
      minKeyStorage: "secure_enclave", // WIA'da depo yok → bu denetim KA'ya taşınır
      statusOf: checker.statusOf,
    });
  }
  async function kaProof(keys: SoftwareKeyProvider, nonce: string, n = 3) {
    const refs = Array.from({ length: n }, (_, i) => `c.${Math.random().toString(36).slice(2)}.${i}`);
    const jwks = [];
    for (const r of refs) jwks.push(await keys.generate(r));
    const ka = await requestKeyAttestation({ providerBase: BASE, keys, http, jwks });
    return signJwt(
      { typ: "openid4vci-proof+jwt", key_attestation: ka },
      { aud: ISSUER, nonce, iat: now() },
      keys,
      refs[0],
    );
  }

  it("birim kaydı → WIA: < 24 saat, client_status, her işlemde yeni anahtar ve yeni giriş; kurum doğrular", async () => {
    const keys = wallet();
    const { unitId } = await registerUnit({ providerBase: BASE, keys, http, appVersion: "0.2.0", platform: "ios" });
    expect(unitId).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const a = await requestWia({ providerBase: BASE, keys, http });
    const b = await requestWia({ providerBase: BASE, keys, http });
    const ca = decodeJwt(a.jwt) as {
      exp: number;
      iat: number;
      client_status: { status: { status_list: { idx: number } } };
    };
    const cb = decodeJwt(b.jwt) as typeof ca;
    expect(ca.exp - ca.iat).toBeLessThan(24 * 3600);
    // HAIP 1.0 §4.4.1 (ADR-0034): sub bütün örneklerde ortak (cüzdan çözümü); örneğe özgü değer taşımaz
    expect(a.sub).toBe("tamga-wallet-expo");
    expect(b.sub).toBe(a.sub);
    // her işlemde yeni PoP anahtarı → kurumlar arası bağlanamaz
    expect(JSON.stringify((decodeJwt(a.jwt) as { cnf: unknown }).cnf)).not.toBe(
      JSON.stringify((decodeJwt(b.jwt) as { cnf: unknown }).cnf),
    );
    expect(ca.client_status.status.status_list.idx).not.toBe(cb.client_status.status.status_list.idx);
    expect(JSON.stringify(ca)).not.toContain(unitId); // birim kimliği WIA'da yok
    const v = await verifyWia(keys, a);
    expect(v).toMatchObject({ ok: true, kind: "wia" });
  });

  it("KA'lı proof: attested_keys, iso_18045_basic, tür başına giriş; kurum doğrular; yanlış nonce reddedilir", async () => {
    const keys = wallet();
    await registerUnit({ providerBase: BASE, keys, http, appVersion: "0.2.0", platform: "ios" });
    const proof = await kaProof(keys, "n-123", 3);
    const ka = decodeJwt(
      decodeJwt(proof) &&
        (JSON.parse(Buffer.from(proof.split(".")[0], "base64url").toString()).key_attestation as string),
    ) as {
      key_storage: string[];
      key_storage_status: { status: { status_list: { idx: number } } };
    };
    expect(ka.key_storage).toEqual(["iso_18045_basic"]); // WIA3: gerçek seviye
    expect(ka.key_storage_status.status.status_list.idx).toBe(0); // yazılım deposu türü
    const ok = await verifyKaProof(proof, {
      aud: ISSUER,
      nonce: "n-123",
      now: now(),
      isProviderKey,
      statusOf: checker.statusOf,
    });
    expect(ok).toMatchObject({ ok: true, keyStorage: "software" });
    if (ok.ok) expect(ok.keys).toHaveLength(3);
    const bad = await verifyKaProof(proof, { aud: ISSUER, nonce: "baska", now: now(), isProviderKey });
    expect(bad.ok).toBe(false);
  });

  it("kullanıcı isteğiyle birim iptali: eski WIA reddedilir, yenisi verilmez (WIA2, WIA4)", async () => {
    const keys = wallet();
    await registerUnit({ providerBase: BASE, keys, http, appVersion: "0.2.0", platform: "ios" });
    const wia = await requestWia({ providerBase: BASE, keys, http });
    expect((await verifyWia(keys, wia)).ok).toBe(true);
    await revokeUnit({ providerBase: BASE, keys, http });
    expect(await verifyWia(keys, wia)).toMatchObject({ ok: false, reason: expect.stringMatching(/revoked/) });
    await expect(requestWia({ providerBase: BASE, keys, http })).rejects.toThrow(/revoked/);
  });

  it("kişinin silme isteği: birim iptal edilir ve kaydı silinir; ikinci istek de başarılı (bilinmeyen birim)", async () => {
    const keys = wallet();
    const { unitId } = await registerUnit({ providerBase: BASE, keys, http, appVersion: "0.2.0", platform: "android" });
    const wia = await requestWia({ providerBase: BASE, keys, http });
    const before = (await app.inject({ method: "GET", url: "/healthz" })).json() as { units: number };
    await deleteUnit({ providerBase: BASE, keys, http });
    expect(await verifyWia(keys, wia)).toMatchObject({ ok: false, reason: expect.stringMatching(/revoked/) });
    const after = (await app.inject({ method: "GET", url: "/healthz" })).json() as { units: number };
    expect(after.units).toBe(before.units - 1); // kayıt (açık anahtar, sürüm, cihaz bilgisi) yok
    expect(JSON.stringify(after)).not.toContain(unitId);
    await expect(requestWia({ providerBase: BASE, keys, http })).rejects.toThrow();
    await deleteUnit({ providerBase: BASE, keys, http }); // tekrar: hata vermez
    const meta = (await app.inject({ method: "GET", url: "/.well-known/wallet-provider" })).json() as Record<
      string,
      string
    >;
    expect(meta.unit_deletion_endpoint).toBe(`${BASE}/units/delete`);
  });

  it("anahtar deposu türü iptal edilince KA reddedilir; yabancı imzacı ve kayıtsız birim reddedilir", async () => {
    const keys = wallet();
    await registerUnit({ providerBase: BASE, keys, http, appVersion: "0.2.0", platform: "ios" });
    const proof = await kaProof(keys, "n-9", 1);
    await app.revokeKeyStorageType!("software");
    const r = await verifyKaProof(proof, {
      aud: ISSUER,
      nonce: "n-9",
      now: now(),
      isProviderKey,
      statusOf: checker.statusOf,
    });
    expect(r).toMatchObject({ ok: false, reason: expect.stringMatching(/revoked/) });
    // güven listesinde olmayan imzacı
    const untrusted = await verifyKaProof(proof, { aud: ISSUER, nonce: "n-9", now: now(), isProviderKey: () => "NO" });
    expect(untrusted.ok).toBe(false);
    // kayıtsız birim WIA alamaz
    await expect(requestWia({ providerBase: BASE, keys: wallet(), http })).rejects.toThrow();
  });
});
