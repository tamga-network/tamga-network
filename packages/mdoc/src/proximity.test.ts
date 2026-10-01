/**
 * ISO 18013-5 yakın alan (P4-3): QR tanıtımı → okuyucu isteği (şifreli) → cüzdan seçici açıklama + cihaz imzası → okuyucu
 * yanıtı çözer ve doğrular. BLE parçalama/birleştirme. Taşıyıcı (Bluetooth) dışında tüm protokol burada sınanır.
 */
import { describe, it, expect } from "vitest";
import { p256 } from "@noble/curves/nist.js";
import {
  BleReassembler,
  bleChunks,
  buildDeviceResponse,
  createEngagement,
  deviceSign,
  discloseMdoc,
  holderReceiveEstablishment,
  holderSendResponse,
  issueMdoc,
  parseDeviceResponse,
  parseEngagement,
  readerReceive,
  readerStart,
  sessionEnd,
  verifyDeviceAuth,
  verifyIssuerSigned,
} from "./index.js";

const DOCTYPE = "urn:tamga:id:IdentityAttestation:1";
const NS = "tamga.id.1";

function issued() {
  const issuerSk = p256.utils.randomSecretKey();
  const deviceSk = p256.utils.randomSecretKey();
  const now = Math.floor(Date.now() / 1000);
  const i = issueMdoc({
    docType: DOCTYPE,
    namespaces: { [NS]: { given_name: "Ayşe", family_name: "Yılmaz", age_over_18: true } },
    deviceKeyRaw: p256.getPublicKey(deviceSk, false),
    issuerSk,
    x5chain: [new Uint8Array([0x30, 1, 2, 3])],
    signed: now,
    validFrom: now,
    validUntil: now + 86400,
    randomBytes: (n) => p256.utils.randomSecretKey().slice(0, n),
  });
  return { ...i, issuerPub: p256.getPublicKey(issuerSk, false), deviceSk };
}

describe("ISO 18013-5 yakın alan", () => {
  it("QR → istek → yalnız istenen alan + cihaz imzası → okuyucu doğrular", () => {
    const doc = issued();
    // 1) cüzdan QR gösterir
    const eng = createEngagement();
    expect(eng.qr.startsWith("mdoc:")).toBe(true);
    // 2) okuyucu tarar, yalnız age_over_18 ister
    const pe = parseEngagement(eng.qr);
    expect(pe.bleServiceUuid).toBe(eng.bleServiceUuid);
    const { session: rs, establishment } = readerStart(eng.qr, [
      { docType: DOCTYPE, nameSpaces: { [NS]: { age_over_18: false } } },
    ]);
    // 3) cüzdan isteği çözer
    const hs = holderReceiveEstablishment(eng, establishment);
    expect(hs.request).toEqual([{ docType: DOCTYPE, nameSpaces: { [NS]: { age_over_18: false } } }]);
    expect(hs.transcript).toEqual(rs.transcript); // iki taraf aynı SessionTranscript
    // 4) cüzdan: kişi onayladı → seçici açıklama + DeviceAuth (holder anahtarıyla) → şifreli yanıt
    const partial = discloseMdoc(doc.issuerSigned, { [NS]: ["age_over_18"] });
    const response = buildDeviceResponse({
      docType: DOCTYPE,
      issuerSigned: partial,
      deviceSignature: deviceSign(hs.transcript, DOCTYPE, doc.deviceSk),
    });
    const sessionData = holderSendResponse(hs, response);
    // 5) okuyucu çözer ve doğrular
    const got = readerReceive(rs, sessionData);
    expect(got.ended).toBe(true);
    const dr = parseDeviceResponse(got.deviceResponse!);
    const v = verifyIssuerSigned(dr.issuerSigned, { issuerPubRaw: doc.issuerPub, expectedDocType: DOCTYPE });
    expect(v.valid).toBe(true);
    expect(v.claims?.[NS]).toEqual({ age_over_18: true });
    expect(verifyDeviceAuth(dr.deviceSignature, rs.transcript, DOCTYPE, v.deviceKeyRaw!)).toBe(true);
  });

  it("başka oturumun cihaz imzası kabul edilmez (yeniden oynatma)", () => {
    const doc = issued();
    const e1 = createEngagement();
    const e2 = createEngagement();
    const r1 = readerStart(e1.qr, [{ docType: DOCTYPE, nameSpaces: { [NS]: { age_over_18: false } } }]);
    const r2 = readerStart(e2.qr, [{ docType: DOCTYPE, nameSpaces: { [NS]: { age_over_18: false } } }]);
    const h1 = holderReceiveEstablishment(e1, r1.establishment);
    const sig = deviceSign(h1.transcript, DOCTYPE, doc.deviceSk);
    const v = verifyIssuerSigned(doc.issuerSigned, { issuerPubRaw: doc.issuerPub });
    expect(verifyDeviceAuth(sig, r2.session.transcript, DOCTYPE, v.deviceKeyRaw!)).toBe(false);
  });

  it("yanlış oturuma ait şifreli ileti çözülemez; kişi reddedince yalnız oturum sonu", () => {
    const e1 = createEngagement();
    const e2 = createEngagement();
    const r2 = readerStart(e2.qr, [{ docType: DOCTYPE, nameSpaces: {} }]);
    expect(() => holderReceiveEstablishment(e1, r2.establishment)).toThrow();
    const r1 = readerStart(e1.qr, [{ docType: DOCTYPE, nameSpaces: {} }]);
    expect(readerReceive(r1.session, sessionEnd())).toEqual({ deviceResponse: null, ended: true });
  });

  it("BLE: parçalama ve birleştirme (MTU 20 ve 512), aşırı büyük ileti reddi", () => {
    const msg = new Uint8Array(1300).map((_, i) => i & 0xff);
    for (const mtu of [20, 512]) {
      const r = new BleReassembler();
      const chunks = bleChunks(msg, mtu);
      expect(chunks.every((c) => c.length <= mtu)).toBe(true);
      let out: Uint8Array | null = null;
      for (const c of chunks) out = r.push(c) ?? out;
      expect(out).toEqual(msg);
    }
    expect(bleChunks(new Uint8Array(0), 20)).toEqual([new Uint8Array([0])]);
    const small = new BleReassembler(10);
    expect(() => small.push(Uint8Array.from([1, ...new Uint8Array(11)]))).toThrow(/too large/);
  });
});
