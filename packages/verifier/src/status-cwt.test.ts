/**
 * ADR-0048 — doğrulayıcının D adımı: mdoc kopyasının MSO'su iptal listesinin CWT gösterimine işaret eder (ön çekim önbelleğinde
 * `b64u:` bayt), `bits = 1` listeler okunur, askısı olmayan türde `0x02` bozuk liste değeridir (SU2).
 */
import { describe, expect, it, beforeAll } from "vitest";
import { createHash, webcrypto } from "node:crypto";
import { X509CertificateGenerator, cryptoProvider } from "@peculiar/x509";
import { CompactSign } from "jose";
import {
  MIN_CAPACITY,
  StatusBitstring,
  StatusValue,
  signStatusListCwt,
  signStatusListToken,
  type IssuerSigner,
} from "@tamga-network/sd-jwt";
import { stepD, type VerifyCtx } from "./steps.js";
import { MemoryStatusCache, statusBodyForCache } from "./status-cache.js";

cryptoProvider.set(webcrypto as unknown as Crypto);
const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;
const CWT_URI = "https://status.example/c/9a8b7c6d5e4f3a2b";
const JWT_URI = "https://status.example/c/1a2b3c4d5e6f7a8b";
const ISS = "https://issuer.example/acme";
const NOW = Math.floor(Date.now() / 1000);
const IDENTITY = "urn:tamga:id:IdentityAttestation:1";
const DIPLOMA = "urn:tamga:edu:DiplomaCredential:1";

let signer: IssuerSigner;
let fp: string;
beforeAll(async () => {
  const keys = (await webcrypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
  const cert = await X509CertificateGenerator.createSelfSigned({
    serialNumber: "03",
    name: "CN=Test status signer",
    notBefore: new Date(Date.now() - 86400_000),
    notAfter: new Date(Date.now() + 86400_000),
    keys,
    signingAlgorithm: ALG,
  });
  const der = new Uint8Array(cert.rawData);
  fp = createHash("sha256").update(der).digest("hex");
  signer = {
    x5c: [der],
    sign: (h, p) => new CompactSign(p).setProtectedHeader(h as never).sign(keys.privateKey),
    signRaw: async (d) =>
      new Uint8Array(await webcrypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keys.privateKey, d)),
  };
});

const list = (bits: 1 | 2) => {
  const bs = new StatusBitstring(MIN_CAPACITY, undefined, bits);
  bs.set(5, StatusValue.INVALID);
  if (bits === 2) bs.set(6, StatusValue.SUSPENDED);
  return bs;
};
async function cachedCwt(bits: 1 | 2) {
  const bytes = await signStatusListCwt({ signer, uri: CWT_URI, bitstring: list(bits), iat: NOW - 30, ttlSec: 120 });
  // ön çekim önbelleği gövdeyi içerik türüne bakmadan da bayt olarak saklar (COSE_Sign1 baytları)
  return statusBodyForCache(bytes, "status_list", "application/statuslist+cwt");
}
function ctx(p: { format: "mso_mdoc" | "dc+sd-jwt"; vct: string; idx: number; uri: string; body: string }): VerifyCtx {
  const cache = new MemoryStatusCache();
  cache.set(p.uri, p.body);
  return {
    input: {
      statusCache: cache,
      policy: { freshness: { max_status_token_age_sec: 6 * 3600 } },
      trust: { statusAnchor: () => null },
    },
    now: NOW,
    done: [],
    skipped: [],
    a: { format: p.format, vct: p.vct, status: { status_list: { idx: p.idx, uri: p.uri } } },
    issuerRec: {
      issuer_url: ISS,
      delegate_keys: [{ purpose: "status_list", fingerprint_sha256: fp, status: "ACTIVE" }],
    },
  } as unknown as VerifyCtx;
}

describe("D — CWT gösterimi ve bits = 1 (ADR-0048)", () => {
  it("önbellek: CWT gövdesi içerik türü bilinmese de bayt (`b64u:`) saklanır", async () => {
    const bytes = await signStatusListCwt({ signer, uri: CWT_URI, bitstring: list(1), iat: NOW, ttlSec: 120 });
    expect(statusBodyForCache(bytes, "status_list", null)).toMatch(/^b64u:/);
    expect(statusBodyForCache(bytes, undefined, "application/statuslist+cwt")).toMatch(/^b64u:/);
  });

  it("mdoc + CWT, bits = 1: geçerli → VALID; iptal → INVALID (D6)", async () => {
    const body = await cachedCwt(1);
    const ok = ctx({ format: "mso_mdoc", vct: IDENTITY, idx: 4, uri: CWT_URI, body });
    expect(await stepD(ok)).toBeUndefined();
    expect(ok.status.value).toBe("VALID");
    const bad = ctx({ format: "mso_mdoc", vct: IDENTITY, idx: 5, uri: CWT_URI, body });
    expect(await stepD(bad)).toMatchObject({ kind: "reject", step: "D6" });
    expect(bad.status.value).toBe("INVALID");
  });

  it("kayıtsız imzacı CWT'si RED (D3); başka adresin CWT'si RED (D3)", async () => {
    const body = await cachedCwt(1);
    const c = ctx({ format: "mso_mdoc", vct: IDENTITY, idx: 4, uri: CWT_URI, body });
    (c.issuerRec as { delegate_keys: Array<{ fingerprint_sha256: string }> }).delegate_keys[0].fingerprint_sha256 =
      "00".repeat(32);
    expect(await stepD(c)).toMatchObject({ kind: "reject", step: "D3" });
    const wrong = ctx({ format: "mso_mdoc", vct: IDENTITY, idx: 4, uri: JWT_URI, body });
    expect(await stepD(wrong)).toMatchObject({ kind: "reject", step: "D3" });
  });

  it("SU2: askısı olmayan türde 0x02 → INVALID + RED; diplomada 0x02 → SUSPENDED", async () => {
    const body = await cachedCwt(2);
    const id = ctx({ format: "mso_mdoc", vct: IDENTITY, idx: 6, uri: CWT_URI, body });
    expect(await stepD(id)).toMatchObject({ kind: "reject", step: "D6", reason: expect.stringMatching(/SU2/) });
    expect(id.status.value).toBe("INVALID");
    const jwt = await signStatusListToken({
      signer,
      iss: ISS,
      uri: JWT_URI,
      bitstring: list(2),
      iat: NOW,
      ttlSec: 120,
    });
    const dip = ctx({ format: "dc+sd-jwt", vct: DIPLOMA, idx: 6, uri: JWT_URI, body: jwt });
    expect(await stepD(dip)).toMatchObject({ kind: "reject", step: "D6", reason: "credential suspended" });
    expect(dip.status.value).toBe("SUSPENDED");
  });

  it("eski mdoc kopyası JWT adresini gösteriyorsa JWT gövdesi okunur", async () => {
    const jwt = await signStatusListToken({
      signer,
      iss: ISS,
      uri: JWT_URI,
      bitstring: list(1),
      iat: NOW,
      ttlSec: 120,
    });
    const c = ctx({ format: "mso_mdoc", vct: IDENTITY, idx: 4, uri: JWT_URI, body: jwt });
    expect(await stepD(c)).toBeUndefined();
    expect(c.status.value).toBe("VALID");
  });
});
