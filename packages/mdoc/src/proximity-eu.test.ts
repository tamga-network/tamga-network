/**
 * 0.6.0 yakın alan eklentileri: okuyucu kimliği (ReaderAuth, ISO 18013-5 §9.1.4), `requestInfo.euWrprc` (CIR 2024/2979 Ek,
 * 2026/1731 ile: ISO/IEC 18013-5-REQ-04…07; ADR-0026 K5), kayıt sertifikasının CBOR biçimi (`rc-wrp+cwt`, ETSI TS 119 475
 * §5.2.3), AB TS9 sunum teklifi (DeviceEngagement[-1]) ve belgesiz DeviceResponse (status 10).
 */
import { describe, it, expect } from "vitest";
import { p256 } from "@noble/curves/nist.js";
import {
  CborTag,
  buildDeviceResponseStatus,
  createEngagement,
  decode,
  deviceResponseStatus,
  encodePresentationOffer,
  decodePresentationOffer,
  hasIntentToRetain,
  holderReceiveEstablishment,
  isSubsetOfOffer,
  parseEngagement,
  parseWrprcCwt,
  readerStart,
  signWrprcCwt,
  verifyReaderAuth,
  type PresentationOffer,
} from "./index.js";

const DOCTYPE = "urn:tamga:id:IdentityAttestation:1";
const NS = "tamga.id.1";
// sertifika yerine anahtar eşlemesi: testte "sertifika" baytları → açık anahtar
const keyring = new Map<string, Uint8Array>();
function key(tag: number) {
  const sk = p256.utils.randomSecretKey();
  const cert = new Uint8Array([0x30, tag, 9, 9]);
  keyring.set(cert.join(), p256.getPublicKey(sk, false));
  return { sk, cert };
}
const publicKeyOf = (der: Uint8Array) => {
  const k = keyring.get(der.join());
  if (!k) throw new Error("unknown cert");
  return k;
};
const signer = (sk: Uint8Array) => (tbs: Uint8Array) =>
  p256.sign(tbs, sk, { prehash: true, lowS: true, format: "compact" });

describe("ReaderAuth + requestInfo.euWrprc", () => {
  it("okuyucu imzalı istek: cüzdan imzayı bu oturumun dökümüyle doğrular; requestInfo.euWrprc bayt olarak gelir", async () => {
    const reader = key(1);
    const registrar = key(2);
    const wrprc = await signWrprcCwt({
      payload: { sub: "VATTR-1234567890", name: "Kapı", iat: 1, credentials: [{ format: "mso_mdoc", claim: [] }] },
      x5chain: [registrar.cert],
      sign: signer(registrar.sk),
    });
    const eng = createEngagement();
    const { establishment, session } = readerStart(
      eng.qr,
      [{ docType: DOCTYPE, nameSpaces: { [NS]: { age_over_18: false } }, requestInfo: { euWrprc: wrprc } }],
      { readerAuth: { sk: reader.sk, x5chain: [reader.cert] } },
    );
    const hs = holderReceiveEstablishment(eng, establishment);
    const it0 = hs.request[0];
    expect(it0.requestInfo?.euWrprc).toEqual(wrprc);
    expect(it0.readerAuth).toBeInstanceOf(Uint8Array);
    const ok = verifyReaderAuth(it0.readerAuth!, hs.transcript, it0.itemsRequestBytes, publicKeyOf);
    expect(ok?.chainDer[0]).toEqual(reader.cert);
    // başka oturumun dökümüyle (tekrar oynatma) ya da değiştirilmiş istekle geçmez
    const other = readerStart(createEngagement().qr, [{ docType: DOCTYPE, nameSpaces: {} }]);
    expect(verifyReaderAuth(it0.readerAuth!, other.session.transcript, it0.itemsRequestBytes, publicKeyOf)).toBeNull();
    const tampered = it0.itemsRequestBytes.slice();
    tampered[tampered.length - 1] ^= 1;
    expect(verifyReaderAuth(it0.readerAuth!, hs.transcript, tampered, publicKeyOf)).toBeNull();
    expect(session.transcript).toEqual(hs.transcript);
    // CBOR kayıt sertifikası: typ rc-wrp+cwt, imza kayıt kurumunun anahtarıyla, yük JSON nesnesi
    const parsed = parseWrprcCwt(wrprc, publicKeyOf);
    expect(parsed.payload).toMatchObject({ sub: "VATTR-1234567890", name: "Kapı", iat: 1 });
    expect(parsed.chainDer[0]).toEqual(registrar.cert);
    const bad = wrprc.slice();
    bad[bad.length - 2] ^= 1;
    expect(() => parseWrprcCwt(bad, publicKeyOf)).toThrow(/signature/);
  });

  it("requestInfo.euWrprc bayt dizisi değilse istek çözülmez", () => {
    const eng = createEngagement();
    const { establishment } = readerStart(eng.qr, [
      { docType: DOCTYPE, nameSpaces: {}, requestInfo: { euWrprc: "not-bytes" as unknown as Uint8Array } },
    ]);
    expect(() => holderReceiveEstablishment(eng, establishment)).toThrow(/euWrprc/);
  });
});

describe("TS9 sunum teklifi ve status 10", () => {
  const offer: PresentationOffer = {
    version: "1.0",
    docs: [{ docType: DOCTYPE, nameSpaces: { [NS]: ["given_name", "age_over_18"] } }],
  };
  it('teklif DeviceEngagement[-1] altında, TS9 biçiminde: {0: "1.0", 1: [{0: DocType, 1: {NS: [ids]}}]}', () => {
    const eng = createEngagement({ offer });
    const de = decode(eng.deviceEngagementBytes) as Map<number, unknown>;
    const raw = de.get(-1) as Map<number, unknown>;
    expect(raw.get(0)).toBe("1.0");
    const doc = (raw.get(1) as Array<Map<number, unknown>>)[0];
    expect(doc.get(0)).toBe(DOCTYPE);
    expect((doc.get(1) as Map<string, string[]>).get(NS)).toEqual(["given_name", "age_over_18"]);
    expect(parseEngagement(eng.qr).offer).toEqual(offer);
    expect(decodePresentationOffer(encodePresentationOffer(offer))).toEqual(offer);
    // teklifsiz tanıtımda yok; teklifi bilmeyen okuyucu oturumu yine kurar
    expect(parseEngagement(createEngagement().qr).offer).toBeUndefined();
    expect(readerStart(eng.qr, [{ docType: DOCTYPE, nameSpaces: {} }]).session.offer).toEqual(offer);
  });

  it("alt küme ve saklama niyeti denetimi", () => {
    const req = (els: Record<string, boolean>, docType = DOCTYPE) => [{ docType, nameSpaces: { [NS]: els } }];
    expect(isSubsetOfOffer(req({ given_name: false }), offer)).toBe(true);
    expect(isSubsetOfOffer(req({ given_name: false, family_name: false }), offer)).toBe(false);
    expect(isSubsetOfOffer(req({ given_name: false }, "urn:other:1"), offer)).toBe(false);
    expect(hasIntentToRetain(req({ given_name: false }))).toBe(false);
    expect(hasIntentToRetain(req({ given_name: true }))).toBe(true);
  });

  it("belgesiz DeviceResponse: {version, status: 10}, documents yok", () => {
    const b = buildDeviceResponseStatus(10);
    expect(deviceResponseStatus(b)).toEqual({ status: 10, documents: 0 });
    const m = decode(b) as Map<string, unknown>;
    expect([...m.keys()].sort()).toEqual(["status", "version"]);
    expect(() => buildDeviceResponseStatus(0)).toThrow();
    expect(decode(new Uint8Array([0xd2, 0x80]))).toBeInstanceOf(CborTag);
  });
});
