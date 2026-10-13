/**
 * Cüzdan sağlayıcı iptal listesi denetleyicisi (WIA `client_status`, KA `key_storage_status`): CIR 2026/1731 Ek Ib — 10.000'den az
 * girişli liste `NONCOMPLIANT` (ret); `minEntries: 0` denetimi kapatır. Anahtarlar test içinde üretilir (kişisel veri yok).
 */
import { describe, it, expect } from "vitest";
import { webcrypto } from "node:crypto";
import { deflateSync } from "node:zlib";
import { SignJWT, importPKCS8 } from "jose";
import { X509CertificateGenerator, cryptoProvider } from "@peculiar/x509";
import { certFingerprintSha256Hex } from "@tamga-network/core";
import { WALLET_STATUS_MIN_ENTRIES, WalletStatusChecker, verifyKeyAttestation, KA_TYP } from "./key-attestation.js";

cryptoProvider.set(webcrypto as unknown as Crypto);
const now = 1_800_000_000;
const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;
const URI = "https://wp.example.test/status/1";

async function provider() {
  const keys = (await webcrypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
  const cert = await X509CertificateGenerator.createSelfSigned({
    serialNumber: "01",
    name: "CN=Test Wallet Provider",
    notBefore: new Date((now - 86400) * 1000),
    notAfter: new Date((now + 86400) * 1000),
    signingAlgorithm: ALG,
    keys,
  });
  const pkcs8 = Buffer.from(await webcrypto.subtle.exportKey("pkcs8", keys.privateKey)).toString("base64");
  const key = await importPKCS8(`-----BEGIN PRIVATE KEY-----\n${pkcs8}\n-----END PRIVATE KEY-----`, "ES256");
  const der = new Uint8Array(cert.rawData);
  return { key, der, fp: certFingerprintSha256Hex(der) };
}

/** `entries` girişli (2 bit) boş liste; Token Status List biçimi. */
async function statusToken(p: Awaited<ReturnType<typeof provider>>, entries: number) {
  const lst = Buffer.from(deflateSync(new Uint8Array(Math.ceil(entries / 4)))).toString("base64url");
  return new SignJWT({ sub: URI, status_list: { bits: 2, lst } })
    .setProtectedHeader({ alg: "ES256", typ: "statuslist+jwt", x5c: [Buffer.from(p.der).toString("base64")] })
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(p.key);
}

describe("WalletStatusChecker — en az giriş sayısı (CIR 2026/1731 Ek Ib)", () => {
  it("varsayılan 10.000: küçük liste NONCOMPLIANT, yeterli liste VALID", async () => {
    expect(WALLET_STATUS_MIN_ENTRIES).toBe(10_000);
    const p = await provider();
    const isKey = (fp: string) => (fp === p.fp ? ("YES" as const) : ("NO" as const));
    const small = await statusToken(p, 4_000);
    const big = await statusToken(p, 10_000);
    const smallChecker = new WalletStatusChecker(async () => small, isKey);
    expect(await smallChecker.statusOf({ idx: 1, uri: URI }, now)).toBe("NONCOMPLIANT");
    const bigChecker = new WalletStatusChecker(async () => big, isKey);
    expect(await bigChecker.statusOf({ idx: 1, uri: URI }, now)).toBe("VALID");
  });

  it("minEntries: 0 denetimi kapatır (geliştirme/test)", async () => {
    const p = await provider();
    const isKey = (fp: string) => (fp === p.fp ? ("YES" as const) : ("NO" as const));
    const small = await statusToken(p, 400);
    const c = new WalletStatusChecker(async () => small, isKey, 300, { minEntries: 0 });
    expect(await c.statusOf({ idx: 1, uri: URI }, now)).toBe("VALID");
  });

  it("KA'nın listesi küçükse KA reddedilir (geçici hata değil)", async () => {
    const p = await provider();
    const isProviderKey = (fp: string) => (fp === p.fp ? ("YES" as const) : ("NO" as const));
    const small = await statusToken(p, 4_000);
    const checker = new WalletStatusChecker(async () => small, isProviderKey);
    const holder = await webcrypto.subtle.generateKey(ALG, true, ["sign", "verify"]);
    const jwk = await webcrypto.subtle.exportKey("jwk", (holder as CryptoKeyPair).publicKey);
    const ka = await new SignJWT({
      attested_keys: [{ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y }],
      key_storage: ["iso_18045_moderate"],
      user_authentication: ["iso_18045_moderate"],
      key_storage_status: { status: { status_list: { idx: 7, uri: URI } } },
    })
      .setProtectedHeader({ alg: "ES256", typ: KA_TYP, x5c: [Buffer.from(p.der).toString("base64")] })
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(p.key);
    const r = await verifyKeyAttestation(ka, { now, isProviderKey, statusOf: checker.statusOf });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toMatch(/profile/);
      expect(r.indeterminate).toBeFalsy();
    }
  });
});
