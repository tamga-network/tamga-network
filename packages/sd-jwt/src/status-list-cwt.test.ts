/**
 * ADR-0048: tür başına bit sayısı (kimlik servisi `bits = 1`) ve aynı mantıksal listenin CWT gösterimi
 * (`application/statuslist+cwt`, COSE_Sign1_Tagged; IETF draft-ietf-oauth-status-list-20 §5.2).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { webcrypto } from "node:crypto";
import { X509CertificateGenerator, cryptoProvider, KeyUsageFlags, KeyUsagesExtension } from "@peculiar/x509";
import { CompactSign } from "jose";
import { fromHex } from "@tamga-network/core";
import { CborTag, decode, encode } from "@tamga-network/mdoc";
import {
  BINARY_CACHE_PREFIX,
  MIN_CAPACITY,
  StatusBitstring,
  StatusValue,
  signStatusListCwt,
  signStatusListToken,
  verifyStatusListAny,
  verifyStatusListCwt,
  verifyStatusListToken,
  type IssuerSigner,
} from "./index.js";
import { epochSeconds, sha256Hex } from "@tamga-network/core";

cryptoProvider.set(webcrypto as unknown as Crypto);
const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;
const NOW = epochSeconds(1790000000);
/** ADR-0056 K6: iptal listesi imzacısı sabitlenir (testin imzacı sertifikası) */
let PIN: { expectedSignerFingerprints: string[] };
const JWT_URI = "https://status.tamga.network/ab12cd34ef567890";
const CWT_URI = "https://status.tamga.network/0f1e2d3c4b5a6978";
let signer: IssuerSigner;

beforeAll(async () => {
  const keys = (await webcrypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
  const cert = await X509CertificateGenerator.createSelfSigned({
    serialNumber: "02",
    name: "CN=Status CWT (test)",
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
    // WebCrypto ECDSA imzası IEEE P1363 (r‖s) biçimindedir
    signRaw: async (d) =>
      new Uint8Array(await webcrypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keys.privateKey, d)),
  };
});

describe("bits = 1 (ADR-0048 K1)", () => {
  it("taslağın örneği: [0xb9, 0xa3] — LSB önce, girdi başına bir bit; sıkıştırılmış hâl taslaktaki baytlarla açılır", () => {
    const bs = StatusBitstring.fromCompressed(fromHex("78dadbb918000217015d"), MIN_CAPACITY, 1);
    expect([...bs.bytes]).toEqual([0xb9, 0xa3]);
    const vals = Array.from({ length: 16 }, (_, i) => bs.get(i));
    expect(vals).toEqual([1, 0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 1, 0, 1]);
    expect(() => bs.get(16)).toThrow(/^D6: idx outside/);
  });

  it("set/get; 1 bite sığmayan değer (askı) yazılamaz; bayt dizisi kapasite/8", async () => {
    const bs = new StatusBitstring(MIN_CAPACITY, undefined, 1);
    expect(bs.bytes.length).toBe(MIN_CAPACITY / 8);
    bs.set(9, StatusValue.INVALID);
    expect(bs.get(9)).toBe(StatusValue.INVALID);
    expect(bs.get(8)).toBe(StatusValue.VALID);
    expect(() => bs.set(1, StatusValue.SUSPENDED)).toThrow(/1 bits/);
    // okuma tarafı IETF'nin bütün değerlerini ayrıştırır (dış listeler 4/8 bit olabilir); 3 geçersiz
    expect(() => new StatusBitstring(MIN_CAPACITY, undefined, 3 as 1)).toThrow(/bits must be 1, 2, 4 or 8/);
    const wide = new StatusBitstring(MIN_CAPACITY, undefined, 8);
    wide.set(7, 0x0b as StatusValue); // uygulamaya özel değer (0x0B–0x0F) yazılıp okunur; yorumu doğrulayıcıda (DOĞRULANAMADI)
    expect(wide.get(7)).toBe(0x0b);
    expect(wide.bytes.length).toBe(MIN_CAPACITY);
    // Tamga türleri yalnız 1 ya da 2 bitle YAYIMLAR (ADR-0048 / ADR-0063 BL2)
    await expect(
      signStatusListToken({ signer, iss: "x", uri: JWT_URI, bitstring: wide, iat: NOW, ttlSec: 120 }),
    ).rejects.toThrow(/bits must be 1 or 2/);
  });

  it("JWT gösterimi bits = 1 taşır ve doğrulanır", async () => {
    const bs = new StatusBitstring(MIN_CAPACITY, undefined, 1);
    bs.set(42, StatusValue.INVALID);
    const tok = await signStatusListToken({ signer, iss: "x", uri: JWT_URI, bitstring: bs, iat: NOW, ttlSec: 120 });
    const v = await verifyStatusListToken(tok, JWT_URI, NOW, { ...PIN });
    expect(v.format).toBe("jwt");
    expect(v.payload.status_list.bits).toBe(1);
    expect(v.bitstring.get(42)).toBe(StatusValue.INVALID);
    expect(v.bitstring.get(43)).toBe(StatusValue.VALID);
  });
});

describe("CWT gösterimi (ADR-0048 K3)", () => {
  const sign = async (bits: 1 | 2, over: Partial<{ iat: number; uri: string; expSec: number }> = {}) => {
    const bs = new StatusBitstring(MIN_CAPACITY, undefined, bits);
    bs.set(7, StatusValue.INVALID);
    if (bits === 2) bs.set(8, StatusValue.SUSPENDED);
    const base = { signer, bitstring: bs, iat: over.iat ?? NOW, ttlSec: 120, expSec: over.expSec ?? 6 * 3600 };
    return {
      bs,
      jwt: await signStatusListToken({ ...base, iss: "x", uri: JWT_URI }),
      cwt: await signStatusListCwt({ ...base, uri: over.uri ?? CWT_URI }),
    };
  };

  it("yapı: COSE_Sign1_Tagged (#6.18), korunan başlıkta alg ES256 + typ + x5chain; talepler 2/6/4/65534/65533", async () => {
    const { cwt } = await sign(1);
    const top = decode(cwt);
    expect(top).toBeInstanceOf(CborTag);
    expect((top as CborTag).tag).toBe(18);
    const [prot, , payload] = (top as CborTag).value as [Uint8Array, unknown, Uint8Array, Uint8Array];
    const ph = decode(prot) as Map<number, unknown>;
    expect(ph.get(1)).toBe(-7);
    expect(ph.get(16)).toBe("application/statuslist+cwt");
    expect(ph.get(33)).toBeInstanceOf(Uint8Array);
    const c = decode(payload) as Map<number, unknown>;
    expect(c.get(2)).toBe(CWT_URI);
    expect(c.get(6)).toBe(NOW);
    expect(c.get(4)).toBe(NOW + 6 * 3600);
    expect(c.get(65534)).toBe(120);
    const sl = c.get(65533) as Map<string, unknown>;
    expect(sl.get("bits")).toBe(1);
    expect(sl.get("lst")).toBeInstanceOf(Uint8Array);
  });

  it("aynı mantıksal liste: CWT ve JWT gösterimleri aynı bitleri, aynı iat/exp/ttl'yi ve aynı imzacıyı taşır", async () => {
    for (const bits of [1, 2] as const) {
      const { jwt, cwt } = await sign(bits);
      const a = await verifyStatusListToken(jwt, JWT_URI, NOW, { ...PIN });
      const b = await verifyStatusListCwt(cwt, CWT_URI, NOW, { ...PIN });
      expect(b.format).toBe("cwt");
      expect(b.payload.iss).toBeUndefined();
      expect([...b.bitstring.bytes]).toEqual([...a.bitstring.bytes]);
      expect(b.payload.status_list.bits).toBe(bits);
      expect([b.payload.iat, b.payload.exp, b.payload.ttl]).toEqual([a.payload.iat, a.payload.exp, a.payload.ttl]);
      expect(b.leafFingerprintHex).toBe(a.leafFingerprintHex);
      expect(b.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(b.bitstring.get(7)).toBe(StatusValue.INVALID);
      if (bits === 2) expect(b.bitstring.get(8)).toBe(StatusValue.SUSPENDED);
    }
  });

  it("adres (sub) farklı → D3; süresi geçmiş → D4; iat gelecekte → D3; maxAgeSec → D4", async () => {
    const { cwt } = await sign(1);
    await expect(verifyStatusListCwt(cwt, JWT_URI, NOW, { ...PIN })).rejects.toThrow(/^D3: sub/);
    await expect(verifyStatusListCwt(cwt, CWT_URI, epochSeconds(NOW + 7 * 3600), { ...PIN })).rejects.toThrow(
      /^D4: status token expired/,
    );
    const future = (await sign(1, { iat: NOW + 3600 })).cwt;
    await expect(verifyStatusListCwt(future, CWT_URI, NOW, { ...PIN })).rejects.toThrow(
      /^D3: status token iat in the future/,
    );
    await expect(
      verifyStatusListCwt(cwt, CWT_URI, epochSeconds(NOW + 3601), { ...PIN, maxAgeSec: 3600 }),
    ).rejects.toThrow(/^D4: .*stale/);
  });

  it("bozuk imza → D3; çözülemeyen baytlar → D4 (okunamıyor, altyapı sorunu); bits 4 → D6", async () => {
    const { cwt } = await sign(2);
    const bad = cwt.slice();
    bad[bad.length - 1] ^= 0xff;
    await expect(verifyStatusListCwt(bad, CWT_URI, NOW, { ...PIN })).rejects.toThrow(
      /^D3: status list CWT signature invalid/,
    );
    await expect(verifyStatusListCwt(new Uint8Array([0xd2, 0x84, 0xff]), CWT_URI, NOW, { ...PIN })).rejects.toThrow(
      /^D4:/,
    );
    // bits = 4 ve 8: IETF değerleri; Tamga yayımlamaz ama (dış listeler için) okur — bits = 3 geçersiz (D6)
    const top = decode(cwt) as CborTag;
    const [prot, unp, payload] = top.value as [Uint8Array, unknown, Uint8Array, Uint8Array];
    const rebits = async (bits: number) => {
      const c = decode(payload) as Map<number, unknown>;
      (c.get(65533) as Map<string, unknown>).set("bits", bits);
      const p2 = encode(c as never);
      const tbs = encode(["Signature1", prot, new Uint8Array(0), p2]);
      const sig = await signer.signRaw!(tbs);
      return encode(new CborTag(18, [prot, unp, p2, sig]) as never);
    };
    const four = await verifyStatusListCwt(await rebits(4), CWT_URI, NOW, { ...PIN });
    expect(four.bitstring.bits).toBe(4);
    expect((await verifyStatusListCwt(await rebits(8), CWT_URI, NOW, { ...PIN })).bitstring.bits).toBe(8);
    await expect(verifyStatusListCwt(await rebits(3), CWT_URI, NOW, { ...PIN })).rejects.toThrow(/^D6: bits/);
  });

  it("verifyStatusListAny: önbellekteki `b64u:` gövde CWT, metin gövde JWT olarak doğrulanır", async () => {
    const { jwt, cwt } = await sign(1);
    const cached = BINARY_CACHE_PREFIX + Buffer.from(cwt).toString("base64url");
    expect((await verifyStatusListAny(cached, CWT_URI, NOW, { ...PIN })).format).toBe("cwt");
    expect((await verifyStatusListAny(jwt, JWT_URI, NOW, { ...PIN })).format).toBe("jwt");
  });

  it("signRaw olmayan imzacı CWT üretemez (açık hata)", async () => {
    const plain: IssuerSigner = { x5c: signer.x5c, sign: signer.sign };
    await expect(
      signStatusListCwt({ signer: plain, uri: CWT_URI, bitstring: new StatusBitstring(), iat: NOW, ttlSec: 120 }),
    ).rejects.toThrow(/signRaw/);
  });
});

describe("ADR-0056 K6: CWT gösteriminde de imzacı sabitlenir", () => {
  it("beklenmeyen imzacı → D3 (imza denetiminden önce)", async () => {
    const bs = new StatusBitstring(MIN_CAPACITY, undefined, 1);
    const cwt = await signStatusListCwt({ signer, uri: CWT_URI, bitstring: bs, iat: NOW - 10, ttlSec: 3600 });
    await expect(
      verifyStatusListCwt(cwt, CWT_URI, NOW, { expectedSignerFingerprints: ["00".repeat(32)] }),
    ).rejects.toThrow(/^D3: status token signer is not an expected signer/);
    await expect(verifyStatusListCwt(cwt, CWT_URI, NOW, PIN)).resolves.toBeTruthy();
  });
});
