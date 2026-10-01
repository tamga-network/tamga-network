/**
 * COSE_Sign1 (RFC 9052) — mdoc issuerAuth ve deviceSignature için gereken alt küme. Yalnızca ES256 (P-256 + SHA-256).
 * Saf @noble; imza 64 baytlık compact (r‖s). Sig_structure = ["Signature1", protected, external_aad, payload].
 * COSE_Sign1 = [protected: bstr, unprotected: map, payload: bstr|nil, signature: bstr].
 */
import { p256 } from "@noble/curves/nist.js";
import { encode, decode, CborTag, type CborValue } from "./cbor.js";

const ALG_ES256 = -7;
const HDR_ALG = 1;
const HDR_X5CHAIN = 33;

/** ["Signature1", protected(bstr), external_aad(bstr), payload(bstr)] → imzalanacak baytlar. */
function sigStructure(protectedBstr: Uint8Array, external: Uint8Array, payload: Uint8Array): Uint8Array {
  return encode(["Signature1", protectedBstr, external, payload]);
}

export interface CoseSign1Opts {
  sk: Uint8Array; // 32 baytlık P-256 özel anahtarı
  x5chain?: Uint8Array[]; // sertifika zinciri (DER); tek sertifika da bstr olarak konur
  external?: Uint8Array; // external_aad (mdoc'ta genelde boş)
  /** Ayrık yük (RFC 9052 §4.1): imza yükü kapsar ama COSE_Sign1'de payload = nil (ISO 18013-5 DeviceSignature). */
  detached?: boolean;
}

export function coseSign1(payload: Uint8Array, opts: CoseSign1Opts): Uint8Array {
  const protectedMap = new Map<number, number>([[HDR_ALG, ALG_ES256]]);
  const protectedBstr = encode(protectedMap);
  const external = opts.external ?? new Uint8Array(0);
  const tbs = sigStructure(protectedBstr, external, payload);
  const sig = p256.sign(tbs, opts.sk, { prehash: true, lowS: true, format: "compact" });
  const unprotected = new Map<number, CborValue>();
  if (opts.x5chain?.length)
    unprotected.set(HDR_X5CHAIN, opts.x5chain.length === 1 ? opts.x5chain[0] : opts.x5chain.slice());
  return encode([protectedBstr, unprotected, opts.detached ? null : payload, sig]);
}

/**
 * Harici imzalayıcıyla COSE_Sign1 — özel anahtar dışarı verilmez (cüzdan: KeyProvider / Secure Enclave; issuer: KMS).
 * `sign(tbs)`: tbs üzerinde ES256 (SHA-256 ön özet) → 64 baytlık compact imza döndürmeli.
 */
export async function coseSign1Async(
  payload: Uint8Array,
  opts: {
    sign: (tbs: Uint8Array) => Promise<Uint8Array>;
    x5chain?: Uint8Array[];
    external?: Uint8Array;
    detached?: boolean;
  },
): Promise<Uint8Array> {
  const protectedBstr = encode(new Map<number, number>([[HDR_ALG, ALG_ES256]]));
  const tbs = sigStructure(protectedBstr, opts.external ?? new Uint8Array(0), payload);
  const sig = await opts.sign(tbs);
  if (sig.length !== 64) throw new Error("COSE_Sign1: signer must return a 64-byte compact signature");
  const unprotected = new Map<number, CborValue>();
  if (opts.x5chain?.length)
    unprotected.set(HDR_X5CHAIN, opts.x5chain.length === 1 ? opts.x5chain[0] : opts.x5chain.slice());
  return encode([protectedBstr, unprotected, opts.detached ? null : payload, sig]);
}

export interface CoseSign1Parsed {
  protectedBstr: Uint8Array;
  unprotected: Map<CborValue, CborValue>;
  /** null = ayrık yük (doğrulayan kendisi kurar). */
  payload: Uint8Array | null;
  signature: Uint8Array;
  x5chain: Uint8Array[];
}

export function parseCoseSign1(bytes: Uint8Array): CoseSign1Parsed {
  const arr = decode(bytes);
  if (!Array.isArray(arr) || arr.length !== 4) throw new Error("COSE_Sign1: expected a 4-element array");
  const [protectedBstr, unprotected, payload, signature] = arr;
  if (
    !(protectedBstr instanceof Uint8Array) ||
    !(payload instanceof Uint8Array || payload === null) ||
    !(signature instanceof Uint8Array)
  )
    throw new Error("COSE_Sign1: invalid field types");
  const up = unprotected instanceof Map ? unprotected : new Map<CborValue, CborValue>();
  const x5 = up.get(HDR_X5CHAIN);
  const x5chain =
    x5 instanceof Uint8Array
      ? [x5]
      : Array.isArray(x5)
        ? (x5.filter((c) => c instanceof Uint8Array) as Uint8Array[])
        : [];
  return { protectedBstr, unprotected: up, payload, signature, x5chain };
}

/**
 * İmzayı P-256 açık anahtarıyla (65 baytlık uncompressed nokta) doğrular. Ayrık yükte (payload nil) `detachedPayload` verilir;
 * ekli yükte verilmez.
 */
export function coseVerify1(
  bytes: Uint8Array,
  publicKeyRaw: Uint8Array,
  external = new Uint8Array(0),
  detachedPayload?: Uint8Array,
): boolean {
  const s = parseCoseSign1(bytes);
  const payload = s.payload ?? detachedPayload;
  if (!payload || (s.payload && detachedPayload)) return false; // ya ekli ya ayrık — ikisi birden değil
  // protected map ES256 mı?
  const pm = decode(s.protectedBstr);
  if (!(pm instanceof Map) || pm.get(HDR_ALG) !== ALG_ES256) return false;
  const tbs = sigStructure(s.protectedBstr, external, payload);
  try {
    return p256.verify(s.signature, tbs, publicKeyRaw, { prehash: true, lowS: false, format: "compact" });
  } catch {
    return false;
  }
}

/** COSE_Key (RFC 9052 §7) — EC2/P-256 açık anahtarı; MSO deviceKey alanında taşınır. */
export function coseKeyFromPoint(pointRaw: Uint8Array): Map<number, CborValue> {
  // pointRaw: 0x04 || X(32) || Y(32)
  if (pointRaw.length !== 65 || pointRaw[0] !== 0x04) throw new Error("coseKey: expected a 65-byte uncompressed point");
  return new Map<number, CborValue>([
    [1, 2], // kty: EC2
    [-1, 1], // crv: P-256
    [-2, pointRaw.slice(1, 33)], // x
    [-3, pointRaw.slice(33, 65)], // y
  ]);
}
export function pointFromCoseKey(k: CborValue): Uint8Array {
  if (!(k instanceof Map)) throw new Error("coseKey: expected a map");
  const x = k.get(-2);
  const y = k.get(-3);
  if (!(x instanceof Uint8Array) || !(y instanceof Uint8Array)) throw new Error("coseKey: x/y missing");
  return Uint8Array.from([0x04, ...x, ...y]);
}

export { CborTag };
