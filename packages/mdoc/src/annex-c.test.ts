/** ISO/IEC 18013-7 Ek C (`org-iso-mdoc`): istek → cüzdan çözümü → HPKE şifreli yanıt → doğrulayıcı açar; döküm kökene bağlı. */
import { describe, it, expect } from "vitest";
import { p256 } from "@noble/curves/nist.js";
import { sha256 } from "@noble/hashes/sha2.js";
import {
  annexCSessionTranscript,
  createAnnexCRequest,
  decode,
  encode,
  openAnnexCResponse,
  parseAnnexCRequest,
  sealAnnexCResponse,
  verifyReaderAuth,
} from "./index.js";

const ORIGIN = "https://verify.tamga.network";
const items = [{ docType: "urn:tamga:id:IdentityAttestation:1", nameSpaces: { "tamga.id.1": { age_over_18: false } } }];

describe("ISO/IEC 18013-7 Ek C", () => {
  it('EncryptionInfo = ["dcapi", {nonce, recipientPublicKey}]; döküm [null, null, ["dcapi", SHA-256(CBOR([b64 EncryptionInfo, köken]))]]', () => {
    const r = createAnnexCRequest({ items, origin: ORIGIN });
    const ei = decode(Buffer.from(r.data.encryptionInfo, "base64url")) as [string, Map<string, unknown>];
    expect(ei[0]).toBe("dcapi");
    expect((ei[1].get("nonce") as Uint8Array).length).toBe(16);
    expect((ei[1].get("recipientPublicKey") as Map<number, unknown>).get(1)).toBe(2); // COSE_Key EC2
    const want = encode([null, null, ["dcapi", sha256(encode([r.data.encryptionInfo, ORIGIN]))]]);
    expect(r.sessionTranscript).toEqual(want);
    expect(annexCSessionTranscript(r.data.encryptionInfo, ORIGIN)).toEqual(want);
  });

  it("uçtan uca: cüzdan aynı dökümü kurar, yanıtı alıcı anahtarına şifreler, doğrulayıcı açar; başka köken açamaz", () => {
    const reader = p256.utils.randomSecretKey();
    const cert = new Uint8Array([0x30, 7]);
    const r = createAnnexCRequest({ items, origin: ORIGIN, readerAuth: { sk: reader, x5chain: [cert] } });
    const w = parseAnnexCRequest(r.data, ORIGIN);
    expect(w.sessionTranscript).toEqual(r.sessionTranscript);
    expect(w.items[0].nameSpaces).toEqual(items[0].nameSpaces);
    // okuyucu imzası Ek C dökümüyle
    expect(
      verifyReaderAuth(w.items[0].readerAuth!, w.sessionTranscript, w.items[0].itemsRequestBytes, () =>
        p256.getPublicKey(reader, false),
      ),
    ).not.toBeNull();
    const dr = new Uint8Array([0xa1, 0x66, 0x73, 0x74, 0x61, 0x74, 0x75, 0x73, 0x00]);
    const sealed = sealAnnexCResponse(dr, w);
    const er = decode(Buffer.from(sealed.response, "base64url")) as [string, Map<string, Uint8Array>];
    expect(er[0]).toBe("dcapi");
    expect(er[1].get("enc")!.length).toBe(65);
    expect(openAnnexCResponse(sealed.response, r)).toEqual(dr);
    const evil = parseAnnexCRequest(r.data, "https://evil.example");
    expect(() => openAnnexCResponse(sealAnnexCResponse(dr, evil).response, r)).toThrow();
    expect(() => openAnnexCResponse("!!", r)).toThrow();
    expect(() => parseAnnexCRequest({ deviceRequest: "x" }, ORIGIN)).toThrow(/missing/);
  });
});
