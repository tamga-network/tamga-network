/**
 * mdoc güvenilmeyen girdi sertleştirmeleri: CBOR yinelenen anahtar (kodlanmış baytlarla), COSE_Sign1 etiketli biçim (#6.18),
 * COSE_Key kty/crv/uzunluk denetimi, ayrılmış ad alanı adları, rastgele digestID, DeviceEngagement "1.1".
 */
import { describe, it, expect } from "vitest";
import { p256 } from "@noble/curves/nist.js";
import { randomBytes } from "@noble/hashes/utils.js";
import { CborTag, decode, encode, type CborValue } from "./cbor.js";
import { coseKeyFromPoint, coseSign1, coseVerify1, parseCoseSign1, pointFromCoseKey } from "./cose.js";
import { issueMdoc, verifyIssuerSigned } from "./mdoc.js";
import { createEngagement, parseEngagement } from "./proximity.js";

const issue = (namespaces: Record<string, Record<string, CborValue>>) => {
  const issuerSk = p256.utils.randomSecretKey();
  const now = Math.floor(Date.now() / 1000);
  const issued = issueMdoc({
    docType: "urn:test:doc:1",
    namespaces,
    deviceKeyRaw: p256.getPublicKey(p256.utils.randomSecretKey(), false),
    issuerSk,
    x5chain: [new Uint8Array([0x30, 1])],
    signed: now,
    validFrom: now,
    validUntil: now + 3600,
    randomBytes,
  });
  return { issued, issuerPub: p256.getPublicKey(issuerSk, false) };
};

describe("mdoc sertleştirme", () => {
  it("CBOR: içeriği aynı iki bstr anahtar (Map'te ayrı nesne) yinelenen anahtar sayılır", () => {
    // {h'01': 1, h'01': 2}
    expect(() => decode(Uint8Array.from([0xa2, 0x41, 0x01, 0x01, 0x41, 0x01, 0x02]))).toThrow(/duplicate map key/);
    // farklı anahtarlar sorun değil
    expect(decode(Uint8Array.from([0xa2, 0x41, 0x01, 0x01, 0x41, 0x02, 0x02]))).toBeInstanceOf(Map);
  });

  it("COSE_Sign1: etiketli (#6.18) biçim de okunur ve doğrulanır", () => {
    const sk = p256.utils.randomSecretKey();
    const untagged = coseSign1(new Uint8Array([1, 2, 3]), { sk });
    const tagged = encode(new CborTag(18, decode(untagged)));
    expect(parseCoseSign1(tagged).payload).toEqual(new Uint8Array([1, 2, 3]));
    expect(coseVerify1(tagged, p256.getPublicKey(sk, false))).toBe(true);
    expect(() => parseCoseSign1(encode(new CborTag(98, decode(untagged))))).toThrow(/4-element/);
  });

  it("COSE_Key: kty≠2, crv≠1 ya da 32 bayttan farklı koordinat RED", () => {
    const k = coseKeyFromPoint(p256.getPublicKey(p256.utils.randomSecretKey(), false));
    expect(pointFromCoseKey(k).length).toBe(65);
    const mut = (key: number, v: CborValue) => new Map<CborValue, CborValue>([...k, [key, v]]);
    expect(() => pointFromCoseKey(mut(1, 1))).toThrow(/kty/);
    expect(() => pointFromCoseKey(mut(-1, 2))).toThrow(/crv/);
    expect(() => pointFromCoseKey(mut(-2, new Uint8Array(31)))).toThrow(/32 bytes/);
    expect(() => pointFromCoseKey(mut(-3, new Uint8Array(33)))).toThrow(/32 bytes/);
  });

  it("ayrılmış ad alanı adı (__proto__ vb.) taşıyan belge RED", () => {
    for (const ns of ["__proto__", "constructor", "prototype"]) {
      const { issued, issuerPub } = issue({ [ns]: { a: 1 } });
      const r = verifyIssuerSigned(issued.issuerSigned, { issuerPubRaw: issuerPub });
      expect(r.valid, ns).toBe(false);
      expect(r.reason).toMatch(/reserved namespace/);
    }
  });

  it("digestID'ler rastgele ve tekil (sıralı değil); doğrulama yine geçer", () => {
    const elems: Record<string, CborValue> = {};
    for (let i = 0; i < 20; i++) elems[`e${i}`] = i;
    const { issued, issuerPub } = issue({ "test.ns": elems });
    const m = decode(issued.issuerSigned) as Map<string, CborValue>;
    const items = (m.get("nameSpaces") as Map<string, CborValue[]>).get("test.ns")!;
    const ids = items.map((it) =>
      (decode((it as CborTag).value as Uint8Array) as Map<string, CborValue>).get("digestID"),
    );
    expect(new Set(ids).size).toBe(20);
    expect(ids).not.toEqual(Array.from({ length: 20 }, (_, i) => i));
    expect(verifyIssuerSigned(issued.issuerSigned, { issuerPubRaw: issuerPub }).valid).toBe(true);
    // sabit rastgelelik veren kaynakta da sonlanır ve tekil kalır
    const fixed = issueMdoc({
      docType: "urn:test:doc:1",
      namespaces: { "test.ns": elems },
      deviceKeyRaw: p256.getPublicKey(p256.utils.randomSecretKey(), false),
      issuerSk: p256.utils.randomSecretKey(),
      x5chain: [new Uint8Array([0x30, 1])],
      signed: 1,
      validFrom: 1,
      validUntil: 2,
      randomBytes: (n) => new Uint8Array(n).fill(7),
    });
    expect(fixed.issuerSigned.length).toBeGreaterThan(0);
  });

  it('DeviceEngagement sürümü "1.1" de kabul edilir; bilinmeyen sürüm RED', () => {
    const e = createEngagement({});
    const de = decode(e.deviceEngagementBytes) as Map<CborValue, CborValue>;
    const withVersion = (v: string) => {
      const m = new Map(de);
      m.set(0, v);
      return "mdoc:" + Buffer.from(encode(m)).toString("base64url");
    };
    expect(parseEngagement(withVersion("1.1")).eDevicePoint.length).toBe(65);
    expect(() => parseEngagement(withVersion("2.0"))).toThrow(/version/);
  });
});
