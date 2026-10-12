/**
 * Attestation Revocation List (tanımlayıcı listesi) — Uygulama Tüzüğü (AB) 2024/2979 Ek II, 2026/1731 ile değişik hâli
 * (ETSI TS 119 472-1 §6.2.10.1 uyarlaması; EAA-6.2.10.1-01.1, -02.3, -07…-11, -17). ISO/IEC 18013-5 belgesinde MSO'nun `status`
 * yapısı `identifier_list {id, uri, ?certificate}` taşır; liste, `uri` adresinde yayımlanan bir CWT'dir:
 *  - COSE_Sign1, korunan başlıkta `alg` (ES256), `typ` (16) = `application/identifierlist+cwt` ve `x5chain` (33);
 *  - talepler: `sub` (2) = liste adresi, `iat` (6), `exp` (4, zorunlu), isteğe bağlı `ttl` (65534) ve 65530 anahtarında
 *    `IdentifierList = { "identifiers": { * bstr => {} }, ? "aggregation_uri": tstr }`;
 *  - belge, MSO'daki tanımlayıcı listede varsa iptaldir (askı yok: yalnız iptal edilmiş MSO'lar listeye girer).
 * Tamga belge verenleri Attestation Status List (Token Status List) kullanır (VCR_11 "ya da"); bu modül doğrulayıcı ve
 * cüzdanın İKİ mekanizmayı da desteklemesi içindir (VCR_10, VCR_12; EAA-6.2.10.1-05.1, -15). İmzacının kim olabileceği
 * (güven) çağıranın kararıdır — Tamga'da belge verenin güven listesinde kayıtlı iptal anahtarı (S11).
 * Saf @noble; RN uyumlu.
 */
import { p256 } from "@noble/curves/nist.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { encode, decode, CborTag, type CborValue } from "./cbor.js";

export const IDENTIFIER_LIST_TYP = "application/identifierlist+cwt";
const HDR_ALG = 1;
const HDR_TYP = 16;
const HDR_X5CHAIN = 33;
const ALG_ES256 = -7;
const CWT_SUB = 2;
const CWT_EXP = 4;
const CWT_IAT = 6;
const CWT_TTL = 65534;
const CWT_IDENTIFIER_LIST = 65530;
const TAG_COSE_SIGN1 = 18;
const TAG_CWT = 61;

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const sigStructure = (protectedBstr: Uint8Array, payload: Uint8Array) =>
  encode(["Signature1", protectedBstr, new Uint8Array(0), payload]);

/** MSO `status.identifier_list` (EAA-6.2.10.1-11.1). `id` belge başına benzersizdir (bağlanabilirliğe karşı, -11.2). */
export interface IdentifierListRef {
  id: Uint8Array;
  uri: string;
  certificate?: Uint8Array;
}

/** Test ve isteyen belge verenler için: tanımlayıcı listesi CWT'si üretir (ES256; x5chain korunan başlıkta). */
export function signIdentifierListToken(p: {
  uri: string;
  identifiers: Uint8Array[];
  sk: Uint8Array;
  x5chain: Uint8Array[];
  iat: number;
  exp: number;
  ttl?: number;
  aggregationUri?: string;
}): Uint8Array {
  const prot = encode(
    new Map<number, CborValue>([
      [HDR_ALG, ALG_ES256],
      [HDR_TYP, IDENTIFIER_LIST_TYP],
      [HDR_X5CHAIN, p.x5chain.length === 1 ? p.x5chain[0] : p.x5chain.slice()],
    ]),
  );
  const idl = new Map<string, CborValue>([
    ["identifiers", new Map<CborValue, CborValue>(p.identifiers.map((id) => [id, new Map()]))],
  ]);
  if (p.aggregationUri) idl.set("aggregation_uri", p.aggregationUri);
  const claims = new Map<number, CborValue>([
    [CWT_SUB, p.uri],
    [CWT_IAT, p.iat],
    [CWT_EXP, p.exp],
    ...(p.ttl ? ([[CWT_TTL, p.ttl]] as Array<[number, CborValue]>) : []),
    [CWT_IDENTIFIER_LIST, idl],
  ]);
  const payload = encode(claims);
  const sig = p256.sign(sigStructure(prot, payload), p.sk, { prehash: true, lowS: true, format: "compact" });
  return encode([prot, new Map(), payload, sig]);
}

export interface VerifiedIdentifierList {
  uri: string;
  iat: number;
  exp: number;
  ttl?: number;
  /** İptal edilmiş tanımlayıcılar (onaltılık) */
  identifiers: Set<string>;
  /** İmzacı yaprak sertifikası (DER) — güven kararı çağıranın */
  leafDer: Uint8Array;
  /** CWT baytlarının SHA-256'sı (`sha256:<hex>`) */
  contentHash: string;
}

/**
 * Tanımlayıcı listesi CWT'sini doğrular: COSE_Sign1 (ES256), `typ`, korunan başlıkta `x5chain`, imza, `sub` = beklenen adres,
 * `exp` zorunlu. Hata iletisi önekleri doğrulayıcı adımlarıdır: `D3:` imza/biçim, `D4:` süresi geçmiş.
 */
export function verifyIdentifierListToken(
  bytes: Uint8Array,
  p: { uri: string; now: number; publicKeyOf: (leafDer: Uint8Array) => Uint8Array },
): VerifiedIdentifierList {
  let top: unknown = decode(bytes);
  if (top instanceof CborTag && top.tag === TAG_CWT) top = top.value;
  if (top instanceof CborTag && top.tag === TAG_COSE_SIGN1) top = top.value;
  if (!Array.isArray(top) || top.length !== 4) throw new Error("D3: identifier list is not a COSE_Sign1");
  const [prot, , payload, sig] = top;
  if (!(prot instanceof Uint8Array) || !(payload instanceof Uint8Array) || !(sig instanceof Uint8Array))
    throw new Error("D3: identifier list COSE_Sign1 fields invalid");
  const ph = decode(prot);
  if (!(ph instanceof Map)) throw new Error("D3: protected header is not a map");
  if (ph.get(HDR_ALG) !== ALG_ES256) throw new Error("D3: identifier list alg must be ES256");
  if (ph.get(HDR_TYP) !== IDENTIFIER_LIST_TYP)
    throw new Error("D3: identifier list typ must be application/identifierlist+cwt");
  const x5 = ph.get(HDR_X5CHAIN);
  const chain =
    x5 instanceof Uint8Array
      ? [x5]
      : Array.isArray(x5)
        ? (x5.filter((c) => c instanceof Uint8Array) as Uint8Array[])
        : [];
  if (!chain.length) throw new Error("D3: x5chain missing from the protected header (EAA-6.2.10.1-08)");
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
  if (!ok) throw new Error("D3: identifier list signature invalid");
  const c = decode(payload);
  if (!(c instanceof Map)) throw new Error("D3: identifier list claims are not a map");
  if (c.get(CWT_SUB) !== p.uri) throw new Error("D3: identifier list sub does not match its address");
  const iat = c.get(CWT_IAT);
  const exp = c.get(CWT_EXP);
  if (typeof iat !== "number" || typeof exp !== "number") throw new Error("D3: identifier list iat/exp missing");
  if (exp < p.now) throw new Error("D4: identifier list expired");
  const idl = c.get(CWT_IDENTIFIER_LIST);
  const ids = idl instanceof Map ? idl.get("identifiers") : undefined;
  if (!(ids instanceof Map)) throw new Error("D3: IdentifierList.identifiers missing");
  const identifiers = new Set<string>();
  for (const k of ids.keys()) if (k instanceof Uint8Array) identifiers.add(hex(k));
  const ttl = c.get(CWT_TTL);
  return {
    uri: p.uri,
    iat,
    exp,
    ...(typeof ttl === "number" ? { ttl } : {}),
    identifiers,
    leafDer: chain[0],
    contentHash: `sha256:${hex(sha256(bytes))}`,
  };
}

/** MSO tanımlayıcısı listede mi (EAA-6.2.10.1-10.1: varsa belge iptal). */
export const identifierRevoked = (list: VerifiedIdentifierList, id: Uint8Array) => list.identifiers.has(hex(id));
