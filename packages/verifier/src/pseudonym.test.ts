/**
 * ADR-0031 PS5 + ADR-0056 K3: takma ad doğrulaması cüzdan biriminin iptal durumunu sorgulamak zorundadır (`walletStatusOf`
 * zorunlu; `"none"` bilerek atlar) ve sonuç `clientStatus` taşır. Kişisel veri yok.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { webcrypto } from "node:crypto";
import { X509CertificateGenerator, cryptoProvider, KeyUsageFlags, KeyUsagesExtension } from "@peculiar/x509";
import { SignJWT, exportJWK, generateKeyPair, type JWK } from "jose";
import { certFingerprintSha256Hex, nowSeconds } from "@tamga-network/core";
import { WUA_POP_TYP, WUA_TYP, type TrustSource } from "@tamga-network/trust";
import { PSEUDONYM_TYP, verifyPseudonym } from "./pseudonym.js";

cryptoProvider.set(webcrypto as unknown as Crypto);
const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;
const AUD = "x509_hash:verifier-test";
const NONCE = "nonce-pseudonym-1";
const RP = "site.example";
const NOW = nowSeconds();

let provider: { keys: CryptoKeyPair; der: Uint8Array; fp: string };
let trust: TrustSource;

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
  trust = { isWalletProviderKey: (fp: string) => (fp === provider.fp ? "YES" : "NO") } as unknown as TrustSource;
});

/** Cüzdanın takma ad yanıtı: WIA (+ PoP) içeren, takma ad anahtarıyla imzalı JWT. */
async function pseudonymToken(withClientStatus: boolean) {
  const wia = await generateKeyPair("ES256");
  const wiaJwk = await exportJWK(wia.publicKey);
  const wiaJwt = await new SignJWT({
    sub: "unit-1",
    cnf: { jwk: wiaJwk },
    wallet_name: "Test Wallet",
    iat: NOW,
    exp: NOW + 600,
    ...(withClientStatus ? { client_status: { status: { status_list: { idx: 7, uri: "https://wp.test/s" } } } } : {}),
  })
    .setProtectedHeader({ alg: "ES256", typ: WUA_TYP, x5c: [Buffer.from(provider.der).toString("base64")] })
    .sign(provider.keys.privateKey);
  const pop = await new SignJWT({ iss: "unit-1", aud: AUD, jti: `j-${Math.random()}`, iat: NOW })
    .setProtectedHeader({ alg: "ES256", typ: WUA_POP_TYP })
    .sign(wia.privateKey);
  const p = await generateKeyPair("ES256");
  const jwk = (await exportJWK(p.publicKey)) as JWK;
  return new SignJWT({ aud: AUD, nonce: NONCE, iat: NOW, rp: RP, wia: wiaJwt, wia_pop: pop })
    .setProtectedHeader({ alg: "ES256", typ: PSEUDONYM_TYP, jwk })
    .sign(p.privateKey);
}

const verify = async (token: string, walletStatusOf: Parameters<typeof verifyPseudonym>[0]["walletStatusOf"]) =>
  verifyPseudonym({ token, aud: AUD, nonce: NONCE, rpKey: RP, trust, walletStatusOf, now: NOW });

describe("verifyPseudonym — cüzdan birimi iptal durumu (ADR-0056)", () => {
  it('clientStatus: VALID (denetlendi), NOT_CHECKED ("none"), NOT_APPLICABLE (iptal girişi yok)', async () => {
    const withStatus = await pseudonymToken(true);
    expect(await verify(withStatus, async () => "VALID")).toMatchObject({ ok: true, clientStatus: "VALID" });
    expect(await verify(await pseudonymToken(true), "none")).toMatchObject({ ok: true, clientStatus: "NOT_CHECKED" });
    expect(await verify(await pseudonymToken(false), async () => "VALID")).toMatchObject({
      ok: true,
      clientStatus: "NOT_APPLICABLE",
    });
  });
  it("iptal edilmiş birim reddedilir; sorgu verilmemesi (JavaScript çağıran) ret", async () => {
    expect(await verify(await pseudonymToken(true), async () => "INVALID")).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/revoked/),
    });
    expect(await verify(await pseudonymToken(true), undefined as never)).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/statusOf missing/),
    });
  });
});
