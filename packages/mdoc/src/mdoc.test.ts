import { describe, it, expect } from "vitest";
import { p256 } from "@noble/curves/nist.js";
import {
  issueMdoc,
  discloseMdoc,
  verifyIssuerSigned,
  deviceSign,
  verifyDeviceAuth,
  oid4vpSessionTranscript,
  deviceSignAsync,
  buildDeviceResponse,
  parseDeviceResponse,
} from "./mdoc.js";
import { encode, decode, encodeEmbedded, CborTag, type CborValue } from "./cbor.js";
import { coseSign1 } from "./cose.js";

const rnd = (n: number) => {
  const b = new Uint8Array(n);
  for (let i = 0; i < n; i++) b[i] = (i * 37 + 11) & 0xff;
  return b;
};
const DOCTYPE = "urn:tamga:id:IdentityAttestation:1";
const NS = "tamga.id.1";

function makeIssued() {
  const issuerSk = p256.utils.randomSecretKey();
  const issuerPub = p256.getPublicKey(issuerSk, false);
  const deviceSk = p256.utils.randomSecretKey();
  const deviceKeyRaw = p256.getPublicKey(deviceSk, false);
  const now = Math.floor(Date.now() / 1000);
  const issued = issueMdoc({
    docType: DOCTYPE,
    namespaces: {
      [NS]: { given_name: "Ayşe", family_name: "Yılmaz", nationality: "TR", age_over_18: true },
    },
    deviceKeyRaw,
    issuerSk,
    x5chain: [new Uint8Array([0x30, 1, 2, 3])],
    signed: now,
    validFrom: now,
    validUntil: now + 365 * 86400,
    randomBytes: rnd,
    status: { idx: 42, uri: "https://id.tamga.network/status/abc" },
  });
  return { issued, issuerPub, deviceSk, deviceKeyRaw, now };
}

describe("mdoc (ISO 18013-5 minimal)", () => {
  it("issue → verify: tüm alanlar, imza ve digest geçerli; deviceKey döner", () => {
    const { issued, issuerPub } = makeIssued();
    const res = verifyIssuerSigned(issued.issuerSigned, { issuerPubRaw: issuerPub, expectedDocType: DOCTYPE });
    expect(res.valid).toBe(true);
    expect(res.claims?.[NS].given_name).toBe("Ayşe");
    expect(res.claims?.[NS].age_over_18).toBe(true);
    expect(res.deviceKeyRaw?.length).toBe(65);
  });

  it("seçici açıklama: yalnızca age_over_18 sunulur; digest yine tutar, diğer alanlar yok", () => {
    const { issued, issuerPub } = makeIssued();
    const partial = discloseMdoc(issued.issuerSigned, { [NS]: ["age_over_18"] });
    const res = verifyIssuerSigned(partial, { issuerPubRaw: issuerPub });
    expect(res.valid).toBe(true);
    expect(Object.keys(res.claims?.[NS] ?? {})).toEqual(["age_over_18"]);
    expect(res.claims?.[NS].given_name).toBeUndefined();
  });

  it("kurcalanmış alan değeri → digest uyuşmaz → REJECTED", () => {
    const { issued, issuerPub } = makeIssued();
    // issuerSigned baytlarında 'Ayşe' → 'Bxşe' gibi bir baytı boz (nameSpaces içinde)
    const bad = issued.issuerSigned.slice();
    const idx = bad.indexOf("Ayşe".charCodeAt(0));
    expect(idx).toBeGreaterThan(0);
    bad[idx] ^= 0x01;
    const res = verifyIssuerSigned(bad, { issuerPubRaw: issuerPub });
    expect(res.valid).toBe(false);
  });

  it("yanlış issuer anahtarı → issuerAuth imzası geçersiz", () => {
    const { issued } = makeIssued();
    const wrong = p256.getPublicKey(p256.utils.randomSecretKey(), false);
    expect(verifyIssuerSigned(issued.issuerSigned, { issuerPubRaw: wrong }).valid).toBe(false);
  });

  it("süresi dolmuş belge → REJECTED", () => {
    const { issued, issuerPub, now } = makeIssued();
    expect(verifyIssuerSigned(issued.issuerSigned, { issuerPubRaw: issuerPub, now: now + 400 * 86400 }).valid).toBe(
      false,
    );
  });

  it("cihaz kimlik doğrulaması: holder anahtarıyla imza geçer; başka anahtar ya da farklı transcript geçmez", () => {
    const { issued, issuerPub, deviceSk, deviceKeyRaw } = makeIssued();
    const res = verifyIssuerSigned(issued.issuerSigned, { issuerPubRaw: issuerPub });
    expect(res.valid).toBe(true);
    const st = oid4vpSessionTranscript("x509_san_dns:verify.tamga.network", "nonce123", "https://verify/vp");
    const devSig = deviceSign(st, DOCTYPE, deviceSk);
    expect(verifyDeviceAuth(devSig, st, DOCTYPE, res.deviceKeyRaw!)).toBe(true);
    // farklı transcript (replay başka oturuma) → geçmez
    const st2 = oid4vpSessionTranscript("x509_san_dns:verify.tamga.network", "nonceXXX", "https://verify/vp");
    expect(verifyDeviceAuth(devSig, st2, DOCTYPE, res.deviceKeyRaw!)).toBe(false);
    // hırsız anahtarı → geçmez
    const thiefSk = p256.utils.randomSecretKey();
    const forged = deviceSign(st, DOCTYPE, thiefSk);
    expect(verifyDeviceAuth(forged, st, DOCTYPE, res.deviceKeyRaw!)).toBe(false);
  });

  it("OpenID4VP 1.0 Ek B.2.6.1: SessionTranscript = [null, null, OpenID4VPHandover]; cihaz imzası ayrık; parmak izi bağlar", () => {
    const { issued, issuerPub, deviceSk } = makeIssued();
    const res = verifyIssuerSigned(issued.issuerSigned, { issuerPubRaw: issuerPub });
    const thumb = rnd(32);
    const st = oid4vpSessionTranscript("x509_san_dns:verify.tamga.network", "n-2", "https://verify/vp", thumb);
    const t = decode(st) as CborValue[];
    expect(t[0]).toBeNull();
    expect(t[1]).toBeNull();
    const handover = t[2] as CborValue[];
    expect(handover[0]).toBe("OpenID4VPHandover");
    expect((handover[1] as Uint8Array).length).toBe(32); // sha256(cbor([client_id, nonce, jwkThumbprint, response_uri]))
    const devSig = deviceSign(st, DOCTYPE, deviceSk);
    expect((decode(devSig) as CborValue[])[2]).toBeNull(); // ISO 18013-5: deviceSignature yükü nil (ayrık)
    expect(verifyDeviceAuth(devSig, st, DOCTYPE, res.deviceKeyRaw!)).toBe(true);
    // başka bir şifreleme anahtarı (yanıt başka doğrulayıcıya şifrelenmiş) → oturum özeti farklı → geçmez
    const other = oid4vpSessionTranscript("x509_san_dns:verify.tamga.network", "n-2", "https://verify/vp", rnd(31));
    expect(verifyDeviceAuth(devSig, other, DOCTYPE, res.deviceKeyRaw!)).toBe(false);
  });

  it("MSO status (IETF Token Status List mdoc profili) ve signedEpoch doğrulamada döner", () => {
    const { issued, issuerPub, now } = makeIssued();
    const res = verifyIssuerSigned(issued.issuerSigned, { issuerPubRaw: issuerPub });
    expect(res.status).toEqual({ idx: 42, uri: "https://id.tamga.network/status/abc" });
    expect(res.signedEpoch).toBe(now);
  });

  it("DeviceResponse: harici imzalayıcıyla (KeyProvider benzeri) üret → çöz → issuerSigned + cihaz imzası doğrulanır", async () => {
    const { issued, issuerPub, deviceSk } = makeIssued();
    const partial = discloseMdoc(issued.issuerSigned, { [NS]: ["age_over_18"] });
    const st = oid4vpSessionTranscript("x509_san_dns:verify.tamga.network", "n-1", "https://verify/vp");
    // anahtar dışarı çıkmaz: yalnızca "imzala" fonksiyonu verilir
    const sign = async (tbs: Uint8Array) => p256.sign(tbs, deviceSk, { prehash: true, lowS: true, format: "compact" });
    const devSig = await deviceSignAsync(st, DOCTYPE, sign);
    const dr = buildDeviceResponse({ docType: DOCTYPE, issuerSigned: partial, deviceSignature: devSig });
    const back = parseDeviceResponse(dr);
    expect(back.docType).toBe(DOCTYPE);
    const res = verifyIssuerSigned(back.issuerSigned, { issuerPubRaw: issuerPub, expectedDocType: DOCTYPE });
    expect(res.valid).toBe(true);
    expect(Object.keys(res.claims?.[NS] ?? {})).toEqual(["age_over_18"]);
    expect(verifyDeviceAuth(back.deviceSignature, st, DOCTYPE, res.deviceKeyRaw!)).toBe(true);
  });

  it("okunamayan geçerlilik tarihi geçerli sayılmaz (fail-closed); ayrılmış alan adı reddedilir", () => {
    const issuerSk = p256.utils.randomSecretKey();
    const issuerPub = p256.getPublicKey(issuerSk, false);
    const deviceKeyRaw = p256.getPublicKey(p256.utils.randomSecretKey(), false);
    const mso = new Map<string, CborValue>([
      ["version", "1.0"],
      ["digestAlgorithm", "SHA-256"],
      ["valueDigests", new Map<string, CborValue>([[NS, new Map<number, CborValue>()]])],
      ["deviceKeyInfo", new Map<string, CborValue>()],
      ["docType", DOCTYPE],
      [
        "validityInfo",
        new Map<string, CborValue>([
          ["signed", new CborTag(0, "bozuk")],
          ["validFrom", new CborTag(0, "bozuk")],
          ["validUntil", new CborTag(0, "bozuk")],
        ]),
      ],
    ]);
    const issuerAuth = coseSign1(encode(encodeEmbedded(mso)), { sk: issuerSk, x5chain: [new Uint8Array([0x30])] });
    const bad = encode(
      new Map<string, CborValue>([
        ["nameSpaces", new Map()],
        ["issuerAuth", decodeLike(issuerAuth)],
      ]),
    );
    const res = verifyIssuerSigned(bad, { issuerPubRaw: issuerPub });
    expect(res.valid).toBe(false);
    expect(res.reason).toMatch(/dates/);

    const now = Math.floor(Date.now() / 1000);
    const proto = issueMdoc({
      docType: DOCTYPE,
      namespaces: { [NS]: JSON.parse('{"__proto__": true, "given_name": "Ayşe"}') },
      deviceKeyRaw,
      issuerSk,
      x5chain: [new Uint8Array([0x30])],
      signed: now,
      validFrom: now,
      validUntil: now + 3600,
      randomBytes: rnd,
    });
    const r2 = verifyIssuerSigned(proto.issuerSigned, { issuerPubRaw: issuerPub });
    expect(r2.valid).toBe(false);
  });
});

function decodeLike(b: Uint8Array): CborValue {
  return decode(b);
}
