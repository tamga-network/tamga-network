/**
 * ISO/IEC 18013-7 Ek C — tarayıcı Digital Credentials API'si üzerinden mdoc (protokol `org-iso-mdoc`). OpenID4VP kullanmayan
 * tarayıcılarda (Safari / iOS 26) mdoc isteğinin tek yolu. Saf @noble; RN uyumlu (cüzdan tarafı da aynı modülü kullanabilir).
 *
 *  İstek (`navigator.credentials.get({ digital: { requests: [{ protocol: "org-iso-mdoc", data }] } })`):
 *    data = { deviceRequest: base64url(DeviceRequest), encryptionInfo: base64url(EncryptionInfo) }
 *    EncryptionInfo = ["dcapi", { "nonce": bstr, "recipientPublicKey": COSE_Key }]
 *  Oturum dökümü (holder binding, cihaz imzası ve HPKE `info`):
 *    SessionTranscript = [null, null, ["dcapi", SHA-256(CBOR([Base64EncryptionInfo, SerializedOrigin]))]]
 *    (Base64EncryptionInfo = istekte gönderilen base64url dize; SerializedOrigin = sayfanın kökeni, ör. "https://verify.tamga.network")
 *  Yanıt (`credential.data`): { response: base64url(EncryptedResponse) }
 *    EncryptedResponse = ["dcapi", { "enc": bstr, "cipherText": bstr }] — HPKE (RFC 9180) temel kip,
 *    DHKEM(P-256, HKDF-SHA256) / HKDF-SHA256 / AES-128-GCM, info = SessionTranscript CBOR baytları, aad boş; açık metin DeviceResponse.
 * İstek `readerAuth` taşıyabilir (okuyucu imzası bu oturum dökümüyle — `signReaderAuth`).
 */
import { p256 } from "@noble/curves/nist.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { randomBytes as nobleRandom } from "@noble/hashes/utils.js";
import { decode, encode, type CborValue } from "./cbor.js";
import { coseKeyFromPoint, pointFromCoseKey } from "./cose.js";
import { hpkeOpen, hpkeSeal } from "./hpke.js";
import {
  decodeDeviceRequest,
  encodeDeviceRequest,
  signReaderAuth,
  type DecodedItemsRequest,
  type ItemsRequest,
} from "./proximity.js";

export const ORG_ISO_MDOC = "org-iso-mdoc";

export interface AnnexCRequestData {
  deviceRequest: string;
  encryptionInfo: string;
}

const b64u = (b: Uint8Array) => {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const b64uDecode = (s: string) => {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error("not base64url");
  const t = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(t + "=".repeat((4 - (t.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

/** SessionTranscript (Ek C, dcapi handover) CBOR baytları. */
export function annexCSessionTranscript(encryptionInfoB64: string, origin: string): Uint8Array {
  const dcapiInfoHash = sha256(encode([encryptionInfoB64, origin]));
  return encode([null, null, ["dcapi", dcapiInfoHash]]);
}

/**
 * Doğrulayıcı: Ek C isteği. `recipientPrivateKey` yalnız doğrulayıcıda kalır (yanıtı açmak için). `readerAuth` verilirse her istek
 * öğesi bu oturumun dökümüyle okuyucu imzası taşır.
 */
export function createAnnexCRequest(p: {
  items: ItemsRequest[];
  origin: string;
  readerAuth?: { sk: Uint8Array; x5chain: Uint8Array[] };
  randomBytes?: (n: number) => Uint8Array;
}): { data: AnnexCRequestData; recipientPrivateKey: Uint8Array; sessionTranscript: Uint8Array } {
  const rnd = p.randomBytes ?? nobleRandom;
  let sk: Uint8Array;
  do sk = rnd(32);
  while (!p256.utils.isValidSecretKey(sk));
  const encryptionInfo = encode([
    "dcapi",
    new Map<string, CborValue>([
      ["nonce", rnd(16)],
      ["recipientPublicKey", coseKeyFromPoint(p256.getPublicKey(sk, false))],
    ]),
  ]);
  const encryptionInfoB64 = b64u(encryptionInfo);
  const sessionTranscript = annexCSessionTranscript(encryptionInfoB64, p.origin);
  const deviceRequest = encodeDeviceRequest(
    p.items,
    p.readerAuth ? (b) => signReaderAuth(sessionTranscript, b, p.readerAuth!) : undefined,
  );
  return {
    data: { deviceRequest: b64u(deviceRequest), encryptionInfo: encryptionInfoB64 },
    recipientPrivateKey: sk,
    sessionTranscript,
  };
}

/** Cüzdan: Ek C isteğini çözer (köken işletim sisteminden / tarayıcıdan gelir). */
export function parseAnnexCRequest(
  data: unknown,
  origin: string,
): {
  items: DecodedItemsRequest[];
  recipientPublicKey: Uint8Array;
  nonce: Uint8Array;
  sessionTranscript: Uint8Array;
} {
  const d = data as Partial<AnnexCRequestData> | null;
  if (!d || typeof d.deviceRequest !== "string" || typeof d.encryptionInfo !== "string")
    throw new Error("org-iso-mdoc: deviceRequest/encryptionInfo missing");
  const ei = decode(b64uDecode(d.encryptionInfo));
  if (!Array.isArray(ei) || ei.length !== 2 || ei[0] !== "dcapi" || !(ei[1] instanceof Map))
    throw new Error("org-iso-mdoc: EncryptionInfo");
  const nonce = ei[1].get("nonce");
  if (!(nonce instanceof Uint8Array) || nonce.length < 16) throw new Error("org-iso-mdoc: EncryptionInfo.nonce");
  const recipientPublicKey = pointFromCoseKey(ei[1].get("recipientPublicKey") as CborValue);
  return {
    items: decodeDeviceRequest(b64uDecode(d.deviceRequest)),
    recipientPublicKey,
    nonce,
    sessionTranscript: annexCSessionTranscript(d.encryptionInfo, origin),
  };
}

/** Cüzdan: DeviceResponse'u doğrulayıcının anahtarına HPKE ile şifreler → `credential.data` gövdesi. */
export function sealAnnexCResponse(
  deviceResponse: Uint8Array,
  p: { recipientPublicKey: Uint8Array; sessionTranscript: Uint8Array; randomBytes?: (n: number) => Uint8Array },
): { response: string } {
  const { enc, ciphertext } = hpkeSeal({
    recipientPublicKey: p.recipientPublicKey,
    info: p.sessionTranscript,
    plaintext: deviceResponse,
    randomBytes: p.randomBytes,
  });
  return {
    response: b64u(
      encode([
        "dcapi",
        new Map<string, CborValue>([
          ["enc", enc],
          ["cipherText", ciphertext],
        ]),
      ]),
    ),
  };
}

/** Doğrulayıcı: `credential.data.response` → DeviceResponse baytları. Çözülemez ya da açılamazsa hata. */
export function openAnnexCResponse(
  response: unknown,
  p: { recipientPrivateKey: Uint8Array; sessionTranscript: Uint8Array },
): Uint8Array {
  if (typeof response !== "string" || !response) throw new Error("org-iso-mdoc: response missing");
  const er = decode(b64uDecode(response));
  if (!Array.isArray(er) || er.length !== 2 || er[0] !== "dcapi" || !(er[1] instanceof Map))
    throw new Error("org-iso-mdoc: EncryptedResponse");
  const enc = er[1].get("enc");
  const cipherText = er[1].get("cipherText");
  if (!(enc instanceof Uint8Array) || !(cipherText instanceof Uint8Array))
    throw new Error("org-iso-mdoc: EncryptedResponse fields");
  return hpkeOpen({
    recipientPrivateKey: p.recipientPrivateKey,
    enc,
    info: p.sessionTranscript,
    ciphertext: cipherText,
  });
}
