/**
 * Kayıt sertifikasının (WRPRC) CBOR biçimi — ETSI TS 119 475 V1.2.1 §5.2.1 ve §5.2.3 (`rc-wrp+cwt`), yakın alanda ISO/IEC 18013-5
 * isteğinin `requestInfo.euWrprc` değeri (Uygulama Tüzüğü (AB) 2024/2979 Ek, 2026/1731 ile: ISO/IEC 18013-5-REQ-04…07; ağın
 * ADR-0026 K5'i). JWT biçimiyle (`rc-wrp+jwt`) aynı yük alanları, CBOR haritası olarak (metin anahtarlar):
 *  - COSE_Sign1_Tagged (#6.18), ES256; korunan başlıkta `alg` (1), `typ` (16) = `rc-wrp+cwt`, `x5chain` (33);
 *  - yük: Tablo 7–9 alanları (`name`, `sub`, `sub_ln`, `credentials`, `iat`, `exp`, …).
 * Doğrulama sırası (imzacı kayıt kurumu mu, süre, `sub` ↔ okuyucu sertifikası) çağıranın (wallet-core); burada yalnız biçim ve
 * imza. Saf @noble; RN uyumlu.
 */
import { p256 } from "@noble/curves/nist.js";
import { encode, decode, CborTag, type CborValue } from "./cbor.js";

export const WRPRC_CWT_TYP = "rc-wrp+cwt";
const HDR_ALG = 1;
const HDR_TYP = 16;
const HDR_X5CHAIN = 33;
const ALG_ES256 = -7;
const TAG_COSE_SIGN1 = 18;
/** Kabul edilen en büyük kayıt sertifikası (bayt). */
export const MAX_WRPRC_CWT_BYTES = 64 * 1024;

const sigStructure = (protectedBstr: Uint8Array, payload: Uint8Array) =>
  encode(["Signature1", protectedBstr, new Uint8Array(0), payload]);

/** JSON uyumlu değer → CBOR (nesne → metin anahtarlı harita; yalnız sonlu sayılar). */
function fromJson(v: unknown): CborValue {
  if (v === null || typeof v === "boolean" || typeof v === "string") return v;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new Error("WRPRC: non-finite number");
    return v;
  }
  if (Array.isArray(v)) return v.map(fromJson);
  if (typeof v === "object")
    return new Map<CborValue, CborValue>(
      Object.entries(v as Record<string, unknown>)
        .filter(([, x]) => x !== undefined)
        .map(([k, x]) => [k, fromJson(x)]),
    );
  throw new Error(`WRPRC: unsupported value ${typeof v}`);
}

/** CBOR → JSON uyumlu değer (metin anahtarlı harita → nesne). Metin dışı anahtar ve bayt dizisi yükte kabul edilmez. */
function toJson(v: unknown, depth = 0): unknown {
  if (depth > 16) throw new Error("WRPRC: nesting too deep");
  if (v === null || typeof v === "boolean" || typeof v === "string" || typeof v === "number") return v;
  if (Array.isArray(v)) return v.map((x) => toJson(x, depth + 1));
  if (v instanceof Map) {
    const o: Record<string, unknown> = {};
    for (const [k, x] of v) {
      if (typeof k !== "string") throw new Error("WRPRC: map key is not a text string");
      o[k] = toJson(x, depth + 1);
    }
    return o;
  }
  throw new Error("WRPRC: unsupported CBOR value in the payload");
}

/** Kayıt sertifikasının CWT biçimini üretir (kayıt kurumu; JWT biçimiyle aynı yük). */
export async function signWrprcCwt(p: {
  payload: Record<string, unknown>;
  x5chain: Uint8Array[];
  sign: (tbs: Uint8Array) => Promise<Uint8Array> | Uint8Array;
}): Promise<Uint8Array> {
  if (!p.x5chain.length) throw new Error("WRPRC CWT needs an x5chain");
  const prot = encode(
    new Map<number, CborValue>([
      [HDR_ALG, ALG_ES256],
      [HDR_TYP, WRPRC_CWT_TYP],
      [HDR_X5CHAIN, p.x5chain.length === 1 ? p.x5chain[0] : p.x5chain.slice()],
    ]),
  );
  const payload = encode(fromJson(p.payload));
  const sig = await p.sign(sigStructure(prot, payload));
  if (!(sig instanceof Uint8Array) || sig.length !== 64) throw new Error("WRPRC CWT: signer must return 64 bytes");
  return encode(new CborTag(TAG_COSE_SIGN1, [prot, new Map(), payload, sig]));
}

/**
 * Biçim ve imza: COSE_Sign1 (etiketli/etiketsiz), `alg` ES256, `typ` `rc-wrp+cwt`, korunan başlıkta `x5chain`, imza yaprakla.
 * Dönen yük JSON nesnesidir (JWT biçimindeki yükle aynı alanlar); zincir yaprak ilk.
 */
export function parseWrprcCwt(
  bytes: Uint8Array,
  publicKeyOf: (leafDer: Uint8Array) => Uint8Array,
): { payload: Record<string, unknown>; chainDer: Uint8Array[] } {
  if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > MAX_WRPRC_CWT_BYTES)
    throw new Error("registration certificate size");
  let top: unknown = decode(bytes);
  if (top instanceof CborTag && top.tag === TAG_COSE_SIGN1) top = top.value;
  if (!Array.isArray(top) || top.length !== 4) throw new Error("registration certificate is not a COSE_Sign1");
  const [prot, , payload, sig] = top;
  if (!(prot instanceof Uint8Array) || !(payload instanceof Uint8Array) || !(sig instanceof Uint8Array))
    throw new Error("registration certificate COSE_Sign1 fields");
  const ph = decode(prot);
  if (!(ph instanceof Map) || ph.get(HDR_ALG) !== ALG_ES256) throw new Error("registration certificate alg");
  if (String(ph.get(HDR_TYP) ?? "").toLowerCase() !== WRPRC_CWT_TYP) throw new Error("registration certificate typ");
  const x5 = ph.get(HDR_X5CHAIN);
  const chainDer =
    x5 instanceof Uint8Array
      ? [x5]
      : Array.isArray(x5)
        ? (x5.filter((c) => c instanceof Uint8Array) as Uint8Array[])
        : [];
  if (!chainDer.length) throw new Error("registration certificate without x5chain");
  let ok = false;
  try {
    ok = p256.verify(sig, sigStructure(prot, payload), publicKeyOf(chainDer[0]), {
      prehash: true,
      lowS: false,
      format: "compact",
    });
  } catch {
    ok = false;
  }
  if (!ok) throw new Error("registration certificate signature invalid");
  const body = toJson(decode(payload));
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("registration certificate payload");
  return { payload: body as Record<string, unknown>, chainDer };
}
