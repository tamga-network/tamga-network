/**
 * Doğrulayıcının D adımı — Attestation Revocation List (tanımlayıcı listesi; CIR 2024/2979 Ek II; ARF VCR_12). Status List ile
 * aynı ilkeler: ön çekim önbelleği (D2), kurumun kayıtlı iptal anahtarı (D3, S11), tazelik (D4), listede = iptal (D6).
 */
import { describe, expect, it, beforeAll } from "vitest";
import { createHash, webcrypto } from "node:crypto";
import { X509CertificateGenerator, cryptoProvider } from "@peculiar/x509";
import { signIdentifierListToken } from "@tamga-network/mdoc";
import { stepD, type VerifyCtx } from "./steps.js";
import { MemoryStatusCache } from "./status-cache.js";

cryptoProvider.set(webcrypto as unknown as Crypto);
const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;
const URI = "https://status.example/il/1";
const NOW = Math.floor(Date.now() / 1000);

async function statusKey() {
  const keys = (await webcrypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
  const cert = await X509CertificateGenerator.createSelfSigned({
    serialNumber: "02",
    name: "CN=Test status signer",
    notBefore: new Date(Date.now() - 86400_000),
    notAfter: new Date(Date.now() + 86400_000),
    keys,
    signingAlgorithm: ALG,
  });
  const der = new Uint8Array(cert.rawData);
  const d = ((await webcrypto.subtle.exportKey("jwk", keys.privateKey)) as { d: string }).d;
  return { der, sk: new Uint8Array(Buffer.from(d, "base64url")), fp: createHash("sha256").update(der).digest("hex") };
}

describe("D — tanımlayıcı listesi (Attestation Revocation List)", () => {
  let key: Awaited<ReturnType<typeof statusKey>>;
  let stranger: Awaited<ReturnType<typeof statusKey>>;
  beforeAll(async () => {
    key = await statusKey();
    stranger = await statusKey();
  });
  const revokedId = "11".repeat(16);
  const token = (k = key, o: { iat?: number; exp?: number } = {}) =>
    "b64u:" +
    Buffer.from(
      signIdentifierListToken({
        uri: URI,
        identifiers: [Buffer.from(revokedId, "hex")],
        sk: k.sk,
        x5chain: [k.der],
        iat: o.iat ?? NOW - 30,
        exp: o.exp ?? NOW + 3600,
      }),
    ).toString("base64url");
  function ctx(id: string, cached?: string): VerifyCtx {
    const cache = new MemoryStatusCache();
    if (cached) cache.set(URI, cached);
    return {
      input: { statusCache: cache, policy: { freshness: { max_status_token_age_sec: 6 * 3600 } } },
      now: NOW,
      done: [],
      skipped: [],
      a: { format: "mso_mdoc", identifierList: { id, uri: URI } },
      issuerRec: { delegate_keys: [{ purpose: "status_list", fingerprint_sha256: key.fp, status: "ACTIVE" }] },
    } as unknown as VerifyCtx;
  }

  it("listede olmayan belge VALID; listedeki belge REJECTED (D6)", async () => {
    const ok = ctx("22".repeat(16), token());
    expect(await stepD(ok)).toBeUndefined();
    expect(ok.status.value).toBe("VALID");
    expect(ok.done).toEqual(["D1", "D2", "D3", "D4", "D6"]);
    expect(ok.skipped).toEqual(["D5"]);
    const bad = ctx(revokedId, token());
    expect(await stepD(bad)).toMatchObject({ kind: "reject", step: "D6" });
    expect(bad.status.value).toBe("INVALID");
  });

  it("önbellekte yok → DOĞRULANAMADI (D2); bayat → DOĞRULANAMADI (D4); kayıtsız imzacı → RED (D3)", async () => {
    expect(await stepD(ctx("22".repeat(16)))).toMatchObject({ kind: "indeterminate", step: "D2" });
    expect(await stepD(ctx("22".repeat(16), token(key, { exp: NOW - 1 })))).toMatchObject({
      kind: "indeterminate",
      step: "D4",
    });
    expect(await stepD(ctx("22".repeat(16), token(key, { iat: NOW - 7 * 3600 })))).toMatchObject({
      kind: "indeterminate",
      step: "D4",
    });
    expect(await stepD(ctx("22".repeat(16), token(stranger)))).toMatchObject({ kind: "reject", step: "D3" });
  });
});
