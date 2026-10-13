/**
 * Cüzdan kanıtı doğrulaması (SPEC-CRED-0001 §4, ADR-0025): tek biçim (-07 istemci kanıtı = WIA), `exp` zorunlu, `client_status`
 * yoksa politika (`optional` / `required`), `iss` ve kanıtta `iat` isteğe bağlı, PoP'ta `iat` zorunlu, PoP `jti`/`iat` sonuçta döner,
 * `jtiSeen` ile tekrar oynatma reddedilir. Anahtarlar test içinde üretilir (kişisel veri yok).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { webcrypto } from "node:crypto";
import { X509CertificateGenerator, cryptoProvider, KeyUsageFlags, KeyUsagesExtension } from "@peculiar/x509";
import { SignJWT, exportJWK, type JWK } from "jose";
import { certFingerprintSha256Hex } from "@tamga-network/core";
import { verifyWalletAttestation, WUA_POP_TYP, WUA_TYP } from "./wallet-attestation.js";

cryptoProvider.set(webcrypto as unknown as Crypto);
const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;
const ISSUER = "https://issuer.example.test";
const NOW = Math.floor(Date.now() / 1000);

let provider: { keys: CryptoKeyPair; der: Uint8Array; fp: string };
let holder: CryptoKeyPair;
let holderJwk: JWK;

beforeAll(async () => {
  const keys = (await webcrypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
  const cert = await X509CertificateGenerator.createSelfSigned({
    serialNumber: "01",
    name: "CN=Test Wallet Provider",
    notBefore: new Date(Date.now() - 86400_000),
    notAfter: new Date(Date.now() + 86400_000),
    signingAlgorithm: ALG,
    keys,
    extensions: [new KeyUsagesExtension(KeyUsageFlags.digitalSignature, true)],
  });
  const der = new Uint8Array(cert.rawData);
  provider = { keys, der, fp: certFingerprintSha256Hex(der) };
  holder = (await webcrypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
  holderJwk = await exportJWK(holder.publicKey);
});

async function wua(extra: Record<string, unknown> = {}, withExp = true) {
  return new SignJWT({
    iss: "https://wallet.example.test",
    sub: "unit-1",
    cnf: { jwk: holderJwk },
    wallet_name: "Test Wallet",
    wallet_version: "1.0",
    iat: NOW,
    ...(withExp ? { exp: NOW + 600 } : {}),
    ...extra,
  })
    .setProtectedHeader({ alg: "ES256", typ: WUA_TYP, x5c: [Buffer.from(provider.der).toString("base64")] })
    .sign(provider.keys.privateKey);
}
const pop = (jti = "j-1", iat: number | null = NOW) =>
  new SignJWT({ iss: "unit-1", aud: ISSUER, jti, ...(iat !== null ? { iat } : {}) })
    .setProtectedHeader({ alg: "ES256", typ: WUA_POP_TYP })
    .sign(holder.privateKey);
const base = () => ({
  issuerUrl: ISSUER,
  now: NOW,
  isProviderKey: (f: string): "YES" | "NO" => (f === provider.fp ? "YES" : "NO"),
});

describe("verifyWalletAttestation", () => {
  it("geçerli kanıt + PoP: sonuçta PoP jti ve iat döner", async () => {
    const r = await verifyWalletAttestation({ ...base(), wua: await wua(), pop: await pop("abc") });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.pop).toEqual({ jti: "abc", iat: NOW });
  });

  it("client_status'suz genel -07 kanıtı eski WUA yoluna düşmez: varsayılan politika kabul eder (NOT_APPLICABLE)", async () => {
    // eski Tamga WUA alanları (solution_id, key_storage) artık anlam taşımaz; beyan edilen "software" altı seviye de reddedilmez
    const r = await verifyWalletAttestation({
      ...base(),
      wua: await wua({ key_storage: "nonsense", solution_id: undefined, user_auth: undefined }),
      pop: await pop(),
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.clientStatus).toBe("NOT_APPLICABLE");
      expect(r.claims.key_storage).toBe("software"); // seviye KA'dan
      expect(r.claims.solution_id).toBe("Test Wallet");
    }
  });

  it("clientStatus: required → iptal girişi olmayan kanıt RED (kimlik servisi politikası)", async () => {
    const r = await verifyWalletAttestation({
      ...base(),
      clientStatus: "required",
      wua: await wua(),
      pop: await pop(),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/client_status/);
  });

  it("client_status varsa denetlenir: VALID / INVALID / NONCOMPLIANT / UNKNOWN; statusOf yoksa NOT_CHECKED", async () => {
    const w = await wua({ client_status: { status: { status_list: { idx: 3, uri: "https://wp.test/s" } } } });
    const run = async (v: "VALID" | "INVALID" | "UNKNOWN" | "NONCOMPLIANT") =>
      verifyWalletAttestation({
        ...base(),
        clientStatus: "required",
        wua: w,
        pop: await pop(),
        statusOf: async () => v,
      });
    const ok = await run("VALID");
    expect(ok.ok && ok.clientStatus).toBe("VALID");
    const revoked = await run("INVALID");
    expect(!revoked.ok && revoked.reason).toMatch(/revoked/);
    const small = await run("NONCOMPLIANT");
    expect(!small.ok && !small.indeterminate && small.reason).toMatch(/profile/);
    const unknown = await run("UNKNOWN");
    expect(!unknown.ok && unknown.indeterminate).toBe(true);
    const unchecked = await verifyWalletAttestation({ ...base(), wua: w, pop: await pop() });
    expect(unchecked.ok && unchecked.clientStatus).toBe("NOT_CHECKED");
    const bad = await verifyWalletAttestation({
      ...base(),
      wua: await wua({ client_status: { status: {} } }),
      pop: await pop(),
    });
    expect(!bad.ok && bad.reason).toMatch(/malformed/);
  });

  it("iss isteğe bağlı (varsa dize); kanıtta iat yoksa tolere edilir; PoP'ta iat zorunlu", async () => {
    const noIss = await verifyWalletAttestation({ ...base(), wua: await wua({ iss: undefined }), pop: await pop() });
    expect(noIss.ok).toBe(true);
    if (noIss.ok) expect(noIss.claims.iss).toBeUndefined();
    const badIss = await verifyWalletAttestation({ ...base(), wua: await wua({ iss: 7 }), pop: await pop() });
    expect(!badIss.ok && badIss.reason).toMatch(/iss/);
    const noIat = await verifyWalletAttestation({ ...base(), wua: await wua({ iat: undefined }), pop: await pop() });
    expect(noIat.ok).toBe(true);
    const popNoIat = await verifyWalletAttestation({ ...base(), wua: await wua(), pop: await pop("j", null) });
    expect(!popNoIat.ok && popNoIat.reason).toMatch(/PoP iat/);
  });

  it("ömür 24 saatten uzun kanıt RED (TS3 §2.2.1.1; iat yoksa şimdiden sayılır)", async () => {
    const long = await verifyWalletAttestation({
      ...base(),
      wua: await wua({ exp: NOW + 30 * 86400 }),
      pop: await pop(),
    });
    expect(!long.ok && long.reason).toMatch(/24 hours/);
    const longNoIat = await verifyWalletAttestation({
      ...base(),
      wua: await wua({ iat: undefined, exp: NOW + 25 * 3600 }),
      pop: await pop(),
    });
    expect(longNoIat.ok).toBe(false);
  });

  it("exp taşımayan kanıt RED (süresiz kanıt yok)", async () => {
    const noExp = await verifyWalletAttestation({ ...base(), wua: await wua({}, false), pop: await pop() });
    expect(noExp.ok).toBe(false);
    if (!noExp.ok) expect(noExp.reason).toMatch(/exp missing/);
    const wia = await wua({ client_status: { status: { status_list: { idx: 1, uri: "https://wp.test/s" } } } }, false);
    const r = await verifyWalletAttestation({ ...base(), wua: wia, pop: await pop() });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/exp missing/);
  });

  it("jtiSeen: aynı PoP ikinci kez → RED (replay)", async () => {
    const seen = new Set<string>();
    const jtiSeen = (jti: string) => {
      if (seen.has(jti)) return true;
      seen.add(jti);
      return false;
    };
    const w = await wua();
    const p = await pop("once");
    const first = await verifyWalletAttestation({ ...base(), wua: w, pop: p, jtiSeen });
    expect(first.ok).toBe(true);
    const again = await verifyWalletAttestation({ ...base(), wua: w, pop: p, jtiSeen });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.reason).toMatch(/replayed/);
  });
});
