/**
 * WUA/WIA doğrulaması (SPEC-CRED-0001 §4, ADR-0025): `exp` zorunlu, PoP `jti`/`iat` sonuçta döner, `jtiSeen` ile tekrar oynatma
 * reddedilir. Anahtarlar test içinde üretilir (kişisel veri yok).
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
    solution_id: "test-wallet",
    key_storage: "secure_enclave",
    user_auth: "system_biometry",
    iat: NOW,
    ...(withExp ? { exp: NOW + 600 } : {}),
    ...extra,
  })
    .setProtectedHeader({ alg: "ES256", typ: WUA_TYP, x5c: [Buffer.from(provider.der).toString("base64")] })
    .sign(provider.keys.privateKey);
}
const pop = (jti = "j-1") =>
  new SignJWT({ iss: "unit-1", aud: ISSUER, jti, iat: NOW })
    .setProtectedHeader({ alg: "ES256", typ: WUA_POP_TYP })
    .sign(holder.privateKey);
const base = () => ({
  issuerUrl: ISSUER,
  now: NOW,
  isProviderKey: (f: string): "YES" | "NO" => (f === provider.fp ? "YES" : "NO"),
});

describe("verifyWalletAttestation", () => {
  it("geçerli WUA + PoP: sonuçta PoP jti ve iat döner", async () => {
    const r = await verifyWalletAttestation({ ...base(), wua: await wua(), pop: await pop("abc") });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.pop).toEqual({ jti: "abc", iat: NOW });
  });

  it("exp taşımayan WUA ve WIA RED (süresiz kanıt yok)", async () => {
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
