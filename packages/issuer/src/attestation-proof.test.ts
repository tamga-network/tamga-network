/**
 * `attestation` proof türü (OpenID4VCI 1.0 Ek F.3; HAIP §4.5.1; CIR 2026/1731 Ek Ib TR_KA-4/7) ve `proofs` ayrıştırması.
 */
import { describe, it, expect } from "vitest";
import { webcrypto } from "node:crypto";
import { SignJWT, exportJWK, generateKeyPair, importPKCS8 } from "jose";
import { X509CertificateGenerator, cryptoProvider } from "@peculiar/x509";
import { certFingerprintSha256Hex } from "@tamga-network/core";
import { KA_TYP, readProofs, verifyAttestationProof } from "./key-attestation.js";

cryptoProvider.set(webcrypto as unknown as Crypto);
const now = 1_800_000_000;
const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;

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
async function holderKeys(n: number) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(await exportJWK((await generateKeyPair("ES256")).publicKey));
  return out;
}
async function ka(
  p: Awaited<ReturnType<typeof provider>>,
  o: { nonce?: string; keys?: unknown[]; typ?: string } = {},
): Promise<string> {
  return new SignJWT({
    attested_keys: o.keys ?? (await holderKeys(2)),
    key_storage: ["iso_18045_moderate"],
    user_authentication: ["iso_18045_moderate"],
    key_storage_status: { status: { status_list: { idx: 7, uri: "https://wp.tamga.network/status/1" } } },
    ...(o.nonce !== undefined ? { nonce: o.nonce } : {}),
  })
    .setProtectedHeader({ alg: "ES256", typ: o.typ ?? KA_TYP, x5c: [Buffer.from(p.der).toString("base64")] })
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(p.key);
}

describe("attestation proof türü", () => {
  it("sağlayıcı imzalı KA + doğru c_nonce → anahtarlar ve depo seviyesi", async () => {
    const p = await provider();
    const isProviderKey = (fp: string) => (fp === p.fp ? ("YES" as const) : ("NO" as const));
    const v = await verifyAttestationProof(await ka(p, { nonce: "n-1" }), { nonce: "n-1", now, isProviderKey });
    expect(v.ok && v.keys.length).toBe(2);
    expect(v.ok && v.keyStorage).toBe("secure_enclave");
  });
  it("nonce yok ya da farklı, sağlayıcı listede değil, yinelenen anahtar → ret", async () => {
    const p = await provider();
    const yes = (fp: string) => (fp === p.fp ? ("YES" as const) : ("NO" as const));
    expect((await verifyAttestationProof(await ka(p), { nonce: "n-1", now, isProviderKey: yes })).ok).toBe(false);
    expect(
      (await verifyAttestationProof(await ka(p, { nonce: "x" }), { nonce: "n-1", now, isProviderKey: yes })).ok,
    ).toBe(false);
    expect(
      (await verifyAttestationProof(await ka(p, { nonce: "n-1" }), { nonce: "n-1", now, isProviderKey: () => "NO" }))
        .ok,
    ).toBe(false);
    const [k] = await holderKeys(1);
    const dup = await verifyAttestationProof(await ka(p, { nonce: "n-1", keys: [k, k] }), {
      nonce: "n-1",
      now,
      isProviderKey: yes,
    });
    expect(dup).toMatchObject({ ok: false, reason: expect.stringMatching(/duplicate/) });
  });
  it("KA typ OpenID4VCI 1.0 Final Ek D.1: key-attestation+jwt; eski taslak adı reddedilir", async () => {
    expect(KA_TYP).toBe("key-attestation+jwt");
    const p = await provider();
    const yes = (fp: string) => (fp === p.fp ? ("YES" as const) : ("NO" as const));
    const old = await ka(p, { nonce: "n-1", typ: "keyattestation+jwt" });
    expect(await verifyAttestationProof(old, { nonce: "n-1", now, isProviderKey: yes })).toMatchObject({ ok: false });
  });
  it("readProofs: tam olarak bir proof türü; attestation tek öğe; jwt 1..max", async () => {
    const p = await provider();
    const k = await ka(p, { nonce: "n-9" });
    expect(readProofs({ attestation: [k] }, 10)).toMatchObject({ ok: true, kind: "attestation", nonce: "n-9" });
    expect(readProofs({ jwt: ["a", "b"] }, 10)).toMatchObject({ ok: true, kind: "jwt", items: ["a", "b"] });
    expect(readProofs({ jwt: ["a"], attestation: [k] }, 10).ok).toBe(false);
    expect(readProofs({ attestation: [k, k] }, 10).ok).toBe(false);
    expect(readProofs({ jwt: [] }, 10).ok).toBe(false);
    expect(readProofs({ jwt: Array(11).fill("a") }, 10).ok).toBe(false);
    expect(readProofs(undefined, 10).ok).toBe(false);
  });
});
