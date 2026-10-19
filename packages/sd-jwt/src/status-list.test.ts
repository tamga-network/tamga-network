/**
 * Token Status List doğrulayıcısının güvenilmeyen girdi sınırları (SPEC-CRED-0003): zlib bombası (açılmış boyut sınırı), token
 * boyutu, `exp` geçmiş → D4, `iat` gelecekte → D3, `set()` tamsayı denetimi.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { deflateSync } from "node:zlib";
import { webcrypto } from "node:crypto";
import { X509CertificateGenerator, cryptoProvider, KeyUsageFlags, KeyUsagesExtension } from "@peculiar/x509";
import { CompactSign } from "jose";
import { b64u, derToB64, utf8 } from "@tamga-network/core";
import {
  MAX_CAPACITY,
  MAX_STATUS_TOKEN_LENGTH,
  MIN_CAPACITY,
  STATUS_TYP,
  StatusBitstring,
  StatusValue,
  signStatusListToken,
  verifyStatusListToken,
  type IssuerSigner,
} from "./index.js";
import { epochSeconds, sha256Hex } from "@tamga-network/core";

cryptoProvider.set(webcrypto as unknown as Crypto);
const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;
const NOW = epochSeconds(1790000000);
/** ADR-0056 K6: iptal listesi imzacısı sabitlenir (testin imzacı sertifikası) */
let PIN: { expectedSignerFingerprints: string[] };
const URI = "https://status.tamga.network/ab12cd34ef567890";
let signer: IssuerSigner;

beforeAll(async () => {
  const keys = (await webcrypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
  const cert = await X509CertificateGenerator.createSelfSigned({
    serialNumber: "01",
    name: "CN=Status (test)",
    notBefore: new Date(0),
    notAfter: new Date("2099-01-01"),
    signingAlgorithm: ALG,
    keys,
    extensions: [new KeyUsagesExtension(KeyUsageFlags.digitalSignature, true)],
  });
  PIN = { expectedSignerFingerprints: [sha256Hex(new Uint8Array(cert.rawData))] };
  signer = {
    x5c: [new Uint8Array(cert.rawData)],
    sign: (h, p) => new CompactSign(p).setProtectedHeader(h as never).sign(keys.privateKey),
  };
});

/** Elle token: kütüphanenin üretmeyeceği yükler (exp/iat oynanmış, aşırı büyük liste). */
const rawToken = (payload: Record<string, unknown>) =>
  signer.sign({ alg: "ES256", typ: STATUS_TYP, x5c: signer.x5c.map(derToB64) }, utf8(JSON.stringify(payload)));

describe("status list doğrulama sınırları", () => {
  it("zlib bombası: açılmış hâli azami boyutu aşan liste D6 ile reddedilir", () => {
    const bomb = b64u(new Uint8Array(deflateSync(new Uint8Array(Math.ceil((MAX_CAPACITY * 2) / 8) + 1))));
    expect(() => StatusBitstring.fromLst(bomb)).toThrow(/^D6: status list exceeds/);
    expect(() => StatusBitstring.fromLst("bm90LXpsaWI")).toThrow(/^D6:/);
  });

  it("aşırı büyük token D3 ile reddedilir (ayrıştırılmadan)", async () => {
    await expect(verifyStatusListToken("a".repeat(MAX_STATUS_TOKEN_LENGTH + 1), URI, NOW, { ...PIN })).rejects.toThrow(
      /^D3: status token too large/,
    );
  });

  it("D4: exp geçmiş token (ttl×2 dolmadan) bayat sayılır; D3: iat saat kayması payından ileride", async () => {
    const lst = new StatusBitstring().encodeLst();
    const expired = await rawToken({
      iss: "x",
      sub: URI,
      iat: NOW - 100,
      exp: NOW - 10,
      ttl: 3600,
      status_list: { bits: 2, lst },
    });
    await expect(verifyStatusListToken(expired, URI, NOW, { ...PIN })).rejects.toThrow(/^D4: status token expired/);
    const future = await rawToken({ iss: "x", sub: URI, iat: NOW + 3600, ttl: 3600, status_list: { bits: 2, lst } });
    await expect(verifyStatusListToken(future, URI, NOW, { ...PIN })).rejects.toThrow(
      /^D3: status token iat in the future/,
    );
    // küçük kayma kabul
    const ok = await signStatusListToken({
      signer,
      iss: "x",
      uri: URI,
      bitstring: new StatusBitstring(),
      iat: NOW + 60,
      ttlSec: 3600,
    });
    await expect(verifyStatusListToken(ok, URI, NOW, { ...PIN })).resolves.toBeTruthy();
  });

  it("0.3.1: sınır exp — iat + 2 × ttl geçmiş ama exp dolmamış token geçerli; maxAgeSec verilirse D4", async () => {
    const tok = await signStatusListToken({
      signer,
      iss: "x",
      uri: URI,
      bitstring: new StatusBitstring(),
      iat: NOW - 3 * 3600,
      ttlSec: 120,
      expSec: 6 * 3600,
    });
    const v = await verifyStatusListToken(tok, URI, NOW, { ...PIN });
    expect(v.payload.exp! - v.payload.iat).toBe(6 * 3600);
    expect(v.payload.ttl).toBe(120);
    await expect(verifyStatusListToken(tok, URI, epochSeconds(NOW), { ...PIN, maxAgeSec: 3600 })).rejects.toThrow(
      /^D4: status token stale/,
    );
    await expect(verifyStatusListToken(tok, URI, epochSeconds(NOW + 3 * 3600 + 1), { ...PIN })).rejects.toThrow(
      /^D4: status token expired/,
    );
  });

  it("signStatusListToken: expSec verilmezse 2 × ttl; 2 × ttl'den kısa expSec HATA", async () => {
    const base = { signer, iss: "x", uri: URI, bitstring: new StatusBitstring(), iat: NOW, ttlSec: 120 };
    const v = await verifyStatusListToken(await signStatusListToken(base), URI, NOW, { ...PIN });
    expect(v.payload.exp).toBe(NOW + 240);
    await expect(signStatusListToken({ ...base, expSec: 200 })).rejects.toThrow(/≥ 2 × ttl/);
    await expect(signStatusListToken({ ...base, expSec: 1.5 })).rejects.toThrow(/≥ 2 × ttl/);
  });

  it("set(): tamsayı olmayan indeks ve 2 bite sığmayan değer HATA", () => {
    const bs = new StatusBitstring(MIN_CAPACITY);
    expect(() => bs.set(1.5, StatusValue.INVALID)).toThrow(/idx/);
    expect(() => bs.set(Number.NaN, StatusValue.INVALID)).toThrow(/idx/);
    expect(() => bs.set(0, 4 as StatusValue)).toThrow(/2 bits/);
    expect(() => new StatusBitstring(MAX_CAPACITY + 1)).toThrow(/capacity/);
  });
});

describe("ADR-0056 K6: iptal listesi imzacısı sabitlenir", () => {
  it("beklenmeyen imzacı, boş liste ve verilmeyen sabitleme reddedilir; işlev biçimi de kabul edilir", async () => {
    const bs = new StatusBitstring();
    const tok = await signStatusListToken({
      signer,
      iss: "https://id.tamga.network",
      uri: URI,
      bitstring: bs,
      iat: NOW - 10,
      ttlSec: 3600,
    });
    await expect(
      verifyStatusListToken(tok, URI, NOW, { expectedSignerFingerprints: ["00".repeat(32)] }),
    ).rejects.toThrow(/^D3: status token signer is not an expected signer/);
    await expect(verifyStatusListToken(tok, URI, NOW, { expectedSignerFingerprints: [] })).rejects.toThrow(
      /^D3: .*signer/,
    );
    await expect(verifyStatusListToken(tok, URI, NOW, undefined as never)).rejects.toThrow(/^D3: .*must be pinned/);
    const fp = PIN.expectedSignerFingerprints[0];
    await expect(
      verifyStatusListToken(tok, URI, NOW, { expectedSignerFingerprints: [fp.toUpperCase()] }),
    ).resolves.toBeTruthy();
    await expect(
      verifyStatusListToken(tok, URI, NOW, { expectedSignerFingerprints: (f) => f === fp }),
    ).resolves.toBeTruthy();
  });
  it("saat kayması üst sınırı (en çok 600 sn) ve saniye birimi denetlenir", async () => {
    const tok = await signStatusListToken({
      signer,
      iss: "https://id.tamga.network",
      uri: URI,
      bitstring: new StatusBitstring(),
      iat: NOW,
      ttlSec: 3600,
    });
    await expect(verifyStatusListToken(tok, URI, NOW, { ...PIN, maxSkewSec: 3600 })).rejects.toThrow(RangeError);
    await expect(verifyStatusListToken(tok, URI, (NOW * 1000) as never, PIN)).rejects.toThrow(/seconds/);
  });
});
