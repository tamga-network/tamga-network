import { describe, expect, it } from "vitest";
import { p256 } from "@noble/curves/nist.js";
import {
  IDENTIFIER_LIST_TYP,
  identifierRevoked,
  signIdentifierListToken,
  verifyIdentifierListToken,
} from "./identifier-list.js";
import { issueMdoc, verifyIssuerSigned } from "./mdoc.js";
import { decode, encode, type CborValue } from "./cbor.js";
import { epochSeconds } from "@tamga-network/core";

const URI = "https://status.example/il/1";
const NOW = 1_800_000_000;
const sk = p256.utils.randomSecretKey();
const pub = p256.getPublicKey(sk, false);
const other = p256.utils.randomSecretKey();
const leaf = new Uint8Array([0x30, 0x03, 1, 2, 3]); // yer tutucu: doğrulayıcı açık anahtarı `publicKeyOf` ile verir
const id = (n: number) => new Uint8Array(16).fill(n);
const tok = (o: Partial<Parameters<typeof signIdentifierListToken>[0]> = {}) =>
  signIdentifierListToken({
    uri: URI,
    identifiers: [id(1), id(2)],
    sk,
    x5chain: [leaf],
    iat: NOW - 60,
    exp: NOW + 3600,
    ...o,
  });
const verify = (b: Uint8Array, k = pub) => verifyIdentifierListToken(b, { uri: URI, now: NOW, publicKeyOf: () => k });

describe("Attestation Revocation List (CIR 2024/2979 Ek II tanımlayıcı listesi)", () => {
  it("imzalı liste doğrulanır; listedeki tanımlayıcı iptal, olmayan geçerli", () => {
    const l = verify(tok({ ttl: 600 }));
    expect(l).toMatchObject({ uri: URI, iat: NOW - 60, exp: NOW + 3600, ttl: 600 });
    expect(identifierRevoked(l, id(2))).toBe(true);
    expect(identifierRevoked(l, id(3))).toBe(false);
    expect(l.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("korunan başlık: typ ve x5chain; talepler 65530 anahtarında (EAA-6.2.10.1-08/09)", () => {
    const [prot, , payload] = decode(tok()) as [Uint8Array, unknown, Uint8Array];
    const ph = decode(prot) as Map<number, CborValue>;
    expect(ph.get(16)).toBe(IDENTIFIER_LIST_TYP);
    expect(ph.get(33)).toBeInstanceOf(Uint8Array);
    const c = decode(payload) as Map<number, CborValue>;
    expect((c.get(65530) as Map<string, CborValue>).get("identifiers")).toBeInstanceOf(Map);
    expect(c.has(65533)).toBe(false); // StatusList talebi yok
  });

  it("başka anahtar, başka adres, süresi geçmiş liste, yanlış typ reddedilir", () => {
    expect(() => verify(tok(), p256.getPublicKey(other, false))).toThrow(/^D3: .*signature/);
    expect(() => verifyIdentifierListToken(tok(), { uri: URI + "x", now: NOW, publicKeyOf: () => pub })).toThrow(/sub/);
    expect(() => verify(tok({ exp: NOW - 1 }))).toThrow(/^D4:/);
    const [prot, unp, payload, sig] = decode(tok()) as [Uint8Array, CborValue, Uint8Array, Uint8Array];
    const ph = decode(prot) as Map<number, CborValue>;
    ph.set(16, "application/statuslist+cwt");
    expect(() => verify(encode([encode(ph), unp, payload, sig]))).toThrow(/typ/);
  });

  it("MSO `status.identifier_list` yazılır ve okunur", () => {
    const deviceKeyRaw = p256.getPublicKey(p256.utils.randomSecretKey(), false);
    const issued = issueMdoc({
      docType: "org.example.test.1",
      namespaces: { "org.example.test.1": { a: 1 } },
      deviceKeyRaw,
      issuerSk: sk,
      x5chain: [leaf],
      signed: NOW,
      validFrom: NOW,
      validUntil: NOW + 3600,
      randomBytes: (n) => p256.utils.randomSecretKey().slice(0, n),
      identifierList: { id: id(7), uri: URI },
    });
    const v = verifyIssuerSigned(issued.issuerSigned, { issuerPubRaw: pub, now: epochSeconds(NOW) });
    expect(v.valid).toBe(true);
    expect(v.status).toBeUndefined();
    expect(v.identifierList?.uri).toBe(URI);
    expect(Buffer.from(v.identifierList!.id).equals(Buffer.from(id(7)))).toBe(true);
  });
});
