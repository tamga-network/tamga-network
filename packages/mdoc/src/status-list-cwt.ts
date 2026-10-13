/**
 * Token Status List — CWT gösterimi (IETF draft-ietf-oauth-status-list-20 §5.2; ADR-0048 K3). mdoc belgesinin MSO'su
 * (`status.status_list {idx, uri}`) bu gösterime işaret eder; SD-JWT VC kopyası aynı mantıksal listenin JWT gösterimine.
 *  - COSE_Sign1_Tagged (#6.18; CWT etiketi #6.61 KULLANILMAZ), ES256; korunan başlıkta `alg` (1), `typ` (16) =
 *    `application/statuslist+cwt` ve `x5chain` (33);
 *  - talepler: `sub` (2) = liste adresi, `iat` (6), `exp` (4), `ttl` (65534), `status_list` (65533) =
 *    `{ "bits": uint, "lst": bstr (zlib ile sıkıştırılmış bit dizisi), ? "aggregation_uri": tstr }`.
 * Bu modül yalnız CBOR/COSE katmanıdır: sıkıştırma ve bit okuma çağıranda (Node: `@tamga-network/sd-jwt`, RN: wallet-core),
 * imzacının kim olabileceği (S11: kurumun kayıtlı iptal anahtarı) çağıranın kararıdır. Saf @noble; RN uyumlu.
 * Hata iletileri doğrulayıcı adımlarıyla başlar: `D3:` imza, başlık, adres, içerik; `D4:` süresi geçmiş ya da OKUNAMAYAN liste
 * (CBOR çözülemiyor — bozuk aktarım: altyapı sorunu); `D6:` `bits` desteklenmiyor.
 */
import { p256 } from "@noble/curves/nist.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { encode, decode, CborTag, type CborValue } from "./cbor.js";

export const STATUS_LIST_CWT_TYP = "application/statuslist+cwt";
/** Tamga'nın yayımladığı ve okuduğu `bits` değerleri (ADR-0048: kimlik servisi 1, kurumlar 2). */
export const STATUS_LIST_CWT_BITS: ReadonlySet<number> = new Set([1, 2]);
const HDR_ALG = 1;
const HDR_TYP = 16;
const HDR_X5CHAIN = 33;
const ALG_ES256 = -7;
const CWT_SUB = 2;
const CWT_EXP = 4;
const CWT_IAT = 6;
const CWT_TTL = 65534;
const CWT_STATUS_LIST = 65533;
const TAG_COSE_SIGN1 = 18;
const TAG_CWT = 61;
/** Kabul edilen en büyük CWT (bayt) — indirme/ayrıştırma sınırı (JWT gösterimiyle aynı ölçek). */
export const MAX_STATUS_LIST_CWT_BYTES = 5 * 1024 * 1024;

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const sigStructure = (protectedBstr: Uint8Array, payload: Uint8Array) =>
  encode(["Signature1", protectedBstr, new Uint8Array(0), payload]);

export interface StatusListCwtInput {
  uri: string;
  bits: number;
  /** zlib ile sıkıştırılmış bit dizisi (JWT gösterimindeki `lst`'nin base64url'siz baytları) */
  lst: Uint8Array;
  iat: number;
  exp: number;
  ttl?: number;
  /** imzacı zinciri (DER; yaprak ilk, kök hariç) */
  x5chain: Uint8Array[];
  /** ES256 imzası (SHA-256 ön özetli, 64 baytlık r‖s) — özel anahtar dışarı verilmez (KMS / HSM) */
  sign: (tbs: Uint8Array) => Promise<Uint8Array> | Uint8Array;
}

/** Status List CWT'si üretir (COSE_Sign1_Tagged). */
export async function signStatusListCwt(i: StatusListCwtInput): Promise<Uint8Array> {
  if (!STATUS_LIST_CWT_BITS.has(i.bits)) throw new Error("status list bits must be 1 or 2");
  if (!i.x5chain.length) throw new Error("status list CWT needs an x5chain");
  if (!(i.exp > i.iat)) throw new Error("status list CWT exp must be after iat");
  const prot = encode(
    new Map<number, CborValue>([
      [HDR_ALG, ALG_ES256],
      [HDR_TYP, STATUS_LIST_CWT_TYP],
      [HDR_X5CHAIN, i.x5chain.length === 1 ? i.x5chain[0] : i.x5chain.slice()],
    ]),
  );
  const claims = new Map<number, CborValue>([
    [CWT_SUB, i.uri],
    [CWT_IAT, i.iat],
    [CWT_EXP, i.exp],
    ...(i.ttl ? ([[CWT_TTL, i.ttl]] as Array<[number, CborValue]>) : []),
    [
      CWT_STATUS_LIST,
      new Map<string, CborValue>([
        ["bits", i.bits],
        ["lst", i.lst],
      ]),
    ],
  ]);
  const payload = encode(claims);
  const sig = await i.sign(sigStructure(prot, payload));
  if (!(sig instanceof Uint8Array) || sig.length !== 64)
    throw new Error("status list CWT: signer must return a 64-byte compact signature");
  return encode(new CborTag(TAG_COSE_SIGN1, [prot, new Map(), payload, sig]));
}

/** Ham P-256 özel anahtarıyla imzacı (testler ve anahtarı süreçte tutan servisler). */
export const rawStatusListSigner = (sk: Uint8Array) => (tbs: Uint8Array) =>
  p256.sign(tbs, sk, { prehash: true, lowS: true, format: "compact" });

export interface ParsedStatusListCwt {
  uri: string;
  iat: number;
  exp?: number;
  ttl?: number;
  bits: number;
  /** sıkıştırılmış bit dizisi */
  lst: Uint8Array;
  /** imzacı yaprak sertifikası (DER) — güven kararı çağıranın */
  leafDer: Uint8Array;
  /** CWT baytlarının SHA-256'sı (`sha256:<hex>`) — çapa günlüğündeki `content_hash` ile karşılaştırılır */
  contentHash: string;
}

/**
 * Status List CWT'sini doğrular: COSE_Sign1 (etiketli ya da etiketsiz okunur; #6.61 sarmalı da sökülür), `alg` ES256, `typ`,
 * korunan başlıkta `x5chain`, imza, `sub` = beklenen adres, `iat` var ve gelecekte değil (kayma payı), `exp` geçmemiş,
 * `bits` ∈ {1, 2}, `lst` bayt dizisi.
 */
export function parseStatusListCwt(
  bytes: Uint8Array,
  p: {
    uri: string;
    now: number;
    publicKeyOf: (leafDer: Uint8Array) => Uint8Array;
    /** `iat` doğrulayıcı saatinden en çok bu kadar ileride olabilir (varsayılan 300 sn) */
    maxSkewSec?: number;
  },
): ParsedStatusListCwt {
  const unreadable = (why: string) => new Error(`D4: status list CWT unreadable (${why})`);
  if (!(bytes instanceof Uint8Array) || bytes.length > MAX_STATUS_LIST_CWT_BYTES)
    throw new Error("D3: status list CWT too large");
  let top: unknown;
  try {
    top = decode(bytes);
  } catch (e) {
    throw unreadable((e as Error).message);
  }
  if (top instanceof CborTag && top.tag === TAG_CWT) top = top.value;
  if (top instanceof CborTag && top.tag === TAG_COSE_SIGN1) top = top.value;
  if (!Array.isArray(top) || top.length !== 4) throw unreadable("not a COSE_Sign1");
  const [prot, , payload, sig] = top;
  if (!(prot instanceof Uint8Array) || !(payload instanceof Uint8Array) || !(sig instanceof Uint8Array))
    throw unreadable("COSE_Sign1 fields invalid");
  let ph: unknown;
  try {
    ph = decode(prot);
  } catch (e) {
    throw unreadable((e as Error).message);
  }
  if (!(ph instanceof Map)) throw unreadable("protected header is not a map");
  if (ph.get(HDR_ALG) !== ALG_ES256) throw new Error("D3: status list CWT alg must be ES256");
  if (ph.get(HDR_TYP) !== STATUS_LIST_CWT_TYP)
    throw new Error("D3: status list CWT typ must be application/statuslist+cwt");
  const x5 = ph.get(HDR_X5CHAIN);
  const chain =
    x5 instanceof Uint8Array
      ? [x5]
      : Array.isArray(x5)
        ? (x5.filter((c) => c instanceof Uint8Array) as Uint8Array[])
        : [];
  if (!chain.length) throw new Error("D3: status list CWT has no x5chain in the protected header");
  let ok = false;
  try {
    ok = p256.verify(sig, sigStructure(prot, payload), p.publicKeyOf(chain[0]), {
      prehash: true,
      lowS: false,
      format: "compact",
    });
  } catch {
    ok = false;
  }
  if (!ok) throw new Error("D3: status list CWT signature invalid");
  let c: unknown;
  try {
    c = decode(payload);
  } catch (e) {
    throw new Error(`D3: status list CWT claims unreadable: ${(e as Error).message}`);
  }
  if (!(c instanceof Map)) throw new Error("D3: status list CWT claims are not a map");
  if (c.get(CWT_SUB) !== p.uri) throw new Error("D3: sub ≠ status uri");
  const iat = c.get(CWT_IAT);
  if (typeof iat !== "number" || !Number.isFinite(iat)) throw new Error("D3: status token iat missing");
  if (iat > p.now + (p.maxSkewSec ?? 300)) throw new Error("D3: status token iat in the future");
  const exp = c.get(CWT_EXP);
  if (exp !== undefined && (typeof exp !== "number" || !Number.isFinite(exp)))
    throw new Error("D3: status token exp is not a number");
  if (typeof exp === "number" && exp < p.now) throw new Error("D4: status token expired");
  const sl = c.get(CWT_STATUS_LIST);
  if (!(sl instanceof Map)) throw new Error("D3: status_list claim missing");
  const bits = sl.get("bits");
  if (typeof bits !== "number" || !STATUS_LIST_CWT_BITS.has(bits)) throw new Error("D6: bits not 1 or 2");
  const lst = sl.get("lst");
  if (!(lst instanceof Uint8Array)) throw new Error("D3: status_list.lst is not a byte string");
  const ttl = c.get(CWT_TTL);
  return {
    uri: p.uri,
    iat,
    ...(typeof exp === "number" ? { exp } : {}),
    ...(typeof ttl === "number" ? { ttl } : {}),
    bits,
    lst,
    leafDer: chain[0],
    contentHash: `sha256:${hex(sha256(bytes))}`,
  };
}

/** CWT mi (ilk bayt bir CBOR etiketi ya da 4 öğeli dizi) — önbellekteki gövdenin hangi gösterim olduğunu ayırmak için. */
export const looksLikeStatusListCwt = (bytes: Uint8Array) =>
  bytes.length > 0 && (bytes[0] === 0xd2 || bytes[0] === 0xd8 || bytes[0] === 0x84);
