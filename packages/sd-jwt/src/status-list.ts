/**
 * Token Status List — SPEC-CRED-0003 (IETF draft-ietf-oauth-status-list-20; AB CIR 2026/1731 ile aynı sürüm).
 *  S2 (ADR-0048) bits tür başına: kimlik servisinin türleri 1 (0 VALID, 1 INVALID/iptal), kurum listeleri 2 (+ 2 SUSPENDED;
 *     yalnız şeması `suspension_allowed: true` olan türlerde yazılır) · S7 idx rastgele · S10 kapasite ≥100.000, doluluk ≤%80
 *  S3 version monoton · S5 sabit aralık, değişiklik olmasa da yayın · S6 aralık dışı yayın yok
 *  S11 status anahtarı credential anahtarından ayrı (K1) · S8 liste URI'si opak
 *  JWT gösterimi: typ "statuslist+jwt", {iss, sub: uri, iat, exp, ttl, status_list:{bits, lst}} — lst = base64url(zlib(bytes))
 *  CWT gösterimi (ADR-0048 K3, mdoc kopyaları için; ayrı opak adres, aynı bitler): COSE_Sign1, typ
 *  "application/statuslist+cwt", {2: sub, 6: iat, 4: exp, 65534: ttl, 65533: {bits, lst: zlib(bytes)}} — `@tamga-network/mdoc`
 *  CBOR/COSE katmanı + burada sıkıştırma.
 *  Doğrulayıcı güvenilmeyen girdiye karşı: token boyutu ve açılmış liste boyutu sınırlı (zlib bombası yok), `exp` geçmişse D4,
 *  `iat` saat kayması payından ileride ise D3.
 */
import { deflateSync, inflateSync } from "node:zlib";
import { randomBytes, randomInt } from "node:crypto";
import { CompactSign, compactVerify, decodeProtectedHeader, importX509 } from "jose";
import { X509Certificate } from "@peculiar/x509";
import {
  b64u,
  b64uToBytes,
  derToB64,
  b64ToDer,
  derToPem,
  sha256Hex,
  sha256Tag,
  utf8,
  clockSkewOption,
  epochSeconds,
  type EpochSeconds,
} from "@tamga-network/core";
import { parseStatusListCwt, signStatusListCwt as signCwt, STATUS_LIST_CWT_TYP } from "@tamga-network/mdoc";
import type { IssuerSigner } from "./issue.js";

export const STATUS_TYP = "statuslist+jwt";
export { STATUS_LIST_CWT_TYP };
/** Kurum listelerinin bit sayısı (varsayılan). Kimlik servisi `bits = 1` kullanır (ADR-0048 K1). */
export const BITS = 2;
/**
 * Tamga türlerinin YAYIMLADIĞI `bits` değerleri (ADR-0048: kimlik servisi 1, kurumlar 2). Okuma tarafı (doğrulayıcı) IETF Token
 * Status List'in bütün değerlerini (1, 2, 4, 8) ayrıştırır: dış kurumun (AB PID / EAA, ADR-0036) listesi 4 ya da 8 bit olabilir;
 * 0, 1, 2 dışındaki değerler doğrulayıcıda DOĞRULANAMADI'dır (uygulamaya özel durum; RED değil).
 */
export type StatusBits = 1 | 2 | 4 | 8;
export const STATUS_BITS: ReadonlySet<number> = new Set([1, 2]);
export const READ_STATUS_BITS: ReadonlySet<number> = new Set([1, 2, 4, 8]);
export const MIN_CAPACITY = 100_000;
export const MAX_FILL = 0.8;
/** Kabul edilen en büyük liste (girdi sayısı): 10 milyon × 2 bit = 2,5 MB açılmış liste. */
export const MAX_CAPACITY = 10_000_000;
/** Kabul edilen en büyük status token (karakter) — indirme/ayrıştırma sınırı. */
export const MAX_STATUS_TOKEN_LENGTH = 5 * 1024 * 1024;
/** Token `iat`'ı doğrulayıcı saatinden en fazla bu kadar ileride olabilir. */
export const STATUS_IAT_SKEW_SEC = 300;
export enum StatusValue {
  VALID = 0,
  INVALID = 1,
  SUSPENDED = 2,
}

export class StatusBitstring {
  readonly bytes: Uint8Array;
  constructor(
    public readonly capacity: number = MIN_CAPACITY,
    bytes?: Uint8Array,
    /** girdi başına bit (ADR-0048: 1 = yalnız geçerli/iptal, 2 = askı da) */
    public readonly bits: StatusBits = BITS,
  ) {
    if (!Number.isInteger(capacity) || capacity < MIN_CAPACITY) throw new Error(`S10: kapasite ≥ ${MIN_CAPACITY}`);
    if (capacity > MAX_CAPACITY) throw new Error(`status list capacity above ${MAX_CAPACITY}`);
    if (!READ_STATUS_BITS.has(bits)) throw new Error("status list bits must be 1, 2, 4 or 8");
    this.bytes = bytes ?? new Uint8Array(Math.ceil((capacity * bits) / 8));
  }
  /** Bayt dizisinin taşıdığı girdi sayısı (liste dışı indeks denetimi). */
  get entries(): number {
    return (this.bytes.length * 8) / this.bits;
  }
  get(idx: number): StatusValue {
    // Liste dışı indeks "geçerli" (0) okunmaz: kesilmiş/bozuk listede iptal edilmiş belge geçerli görünmesin (fail-closed)
    if (!Number.isInteger(idx) || idx < 0 || idx >= this.entries) throw new Error("D6: idx outside the list");
    const perByte = 8 / this.bits;
    const mask = (1 << this.bits) - 1;
    // LSB önce (draft §4.1)
    return ((this.bytes[Math.floor(idx / perByte)] >> ((idx % perByte) * this.bits)) & mask) as StatusValue;
  }
  set(idx: number, v: StatusValue) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= this.capacity) throw new Error("idx out of range");
    const mask = (1 << this.bits) - 1;
    if (!Number.isInteger(v) || v < 0 || v > mask) throw new Error(`status value out of range (${this.bits} bits)`);
    const perByte = 8 / this.bits;
    const at = Math.floor(idx / perByte);
    const shift = (idx % perByte) * this.bits;
    this.bytes[at] = (this.bytes[at] & ~(mask << shift)) | ((v & mask) << shift);
  }
  /** zlib-deflate(bytes) — CWT gösteriminin `lst`'i */
  compressed(): Uint8Array {
    return new Uint8Array(deflateSync(this.bytes, { level: 9 }));
  }
  /** lst = base64url(zlib-deflate(bytes)) — JWT gösterimi */
  encodeLst(): string {
    return b64u(this.compressed());
  }
  /** Açılmış liste en çok `MAX_CAPACITY` girdilik olabilir (zlib bombası: sınır aşılırsa açma durur, D6). */
  static fromLst(lst: string, capacity = MIN_CAPACITY, bits: StatusBits = BITS): StatusBitstring {
    return StatusBitstring.fromCompressed(b64uToBytes(lst), capacity, bits);
  }
  static fromCompressed(data: Uint8Array, capacity = MIN_CAPACITY, bits: StatusBits = BITS): StatusBitstring {
    const maxOutputLength = Math.ceil((MAX_CAPACITY * BITS) / 8);
    let bytes: Buffer;
    try {
      bytes = inflateSync(data, { maxOutputLength });
    } catch (e) {
      if ((e as { code?: string }).code === "ERR_BUFFER_TOO_LARGE" || e instanceof RangeError)
        throw new Error("D6: status list exceeds the maximum size");
      throw new Error(`D6: status list could not be decompressed: ${(e as Error).message}`);
    }
    return new StatusBitstring(capacity, new Uint8Array(bytes), bits);
  }
}

/** S7: rastgele, çakışmasız idx; doluluk %80'i aşınca yeni liste açılmalı (S10). */
export class IndexAllocator {
  private used: Set<number>;
  constructor(
    private capacity: number,
    used: Iterable<number> = [],
  ) {
    this.used = new Set(used);
  }
  get fill() {
    return this.used.size / this.capacity;
  }
  allocate(): number {
    if (this.fill >= MAX_FILL) throw new Error("S10: list 80% full — open a new list");
    for (;;) {
      const i = randomInt(0, this.capacity);
      if (!this.used.has(i)) {
        this.used.add(i);
        return i;
      }
    }
  }
  snapshot(): number[] {
    return [...this.used];
  }
}

/** Opak liste kimliği (S8): URI'de yıl/bölüm/kohort yok. */
export const newListId = () => randomBytes(8).toString("hex");

export interface StatusListTokenInput {
  signer: IssuerSigner; // STATUS anahtarı (K1: credential anahtarından ayrı)
  iss: string; // issuer_url
  uri: string; // https://status.tamga.network/<opak>
  bitstring: StatusBitstring;
  iat: number;
  ttlSec: number; // Tamga'da zorunlu: yayın aralığı (SPEC-CRED-0003 §5.1, §8.1; draft-20 `ttl` = yenileme ipucu)
  /**
   * `exp − iat` (saniye; SPEC-CRED-0003 §8.1: mutlak sınır, kesinti tamponu — ağın servislerinde 6 saat). Verilmezse
   * `2 × ttlSec` (0.3.0 davranışı). En az `2 × ttlSec` olmalı.
   */
  expSec?: number;
}
export async function signStatusListToken(i: StatusListTokenInput): Promise<string> {
  // ADR-0048 / ADR-0063 BL2: Tamga türlerinin listesi yalnız 1 ya da 2 bitle yayımlanır (4/8 yalnız okunur)
  if (!STATUS_BITS.has(i.bitstring.bits)) throw new Error("status list bits must be 1 or 2 (Tamga types)");
  const expSec = i.expSec ?? i.ttlSec * 2;
  if (!Number.isInteger(expSec) || expSec < 2 * i.ttlSec) throw new Error("status token exp must be ≥ 2 × ttl");
  const payload = {
    iss: i.iss,
    sub: i.uri,
    iat: i.iat,
    exp: i.iat + expSec,
    ttl: i.ttlSec,
    status_list: { bits: i.bitstring.bits, lst: i.bitstring.encodeLst() },
  };
  return i.signer.sign(
    { alg: "ES256", typ: STATUS_TYP, x5c: i.signer.x5c.map(derToB64) },
    utf8(JSON.stringify(payload)),
  );
}

export interface VerifiedStatusToken {
  /** hangi gösterim doğrulandı (ADR-0048 K3) */
  format: "jwt" | "cwt";
  payload: {
    /** JWT gösteriminde zorunlu; CWT gösteriminde yok (imzacı bağı S11 ile kurulur) */
    iss?: string;
    sub: string;
    iat: number;
    exp?: number;
    ttl?: number;
    status_list: { bits: number; lst: string };
  };
  leafFingerprintHex: string;
  contentHash: string;
  bitstring: StatusBitstring;
}
/**
 * Verifier tarafı D3/D4/D6: imza (x5c yaprak), sub eşleşmesi, tazelik (`exp`), `iat` gelecekte değil, bits ∈ {1, 2}, boyut
 * sınırları, idx okuma. Tazelik sınırı `exp`'tir (SPEC-CRED-0003 §8.1; draft-20: `ttl` yenileme ipucudur, geçerlilik sınırı
 * değil — 0.3.1'de `iat + 2 × ttl` bayatlık kuralı kaldırıldı); azami token yaşı doğrulayıcı politikasında
 * (`max_status_token_age_sec`) ya da `opts.maxAgeSec` ile. Çapa (D5) çağıran tarafta: contentHash ↔ TrustSource.statusAnchor. Hata iletileri adım koduyla başlar
 * ("D3:", "D4:", "D6:") — doğrulayıcı D4'ü INDETERMINATE (tazelik), ötekileri RED sayar.
 *
 * **İmzacı sabitlenir (ADR-0056 K6):** `expectedSignerFingerprints` ZORUNLUDUR — token'ın `x5c[0]` yaprağının SHA-256 parmak izi
 * (onaltılık) bu listede olmalı (ya da işlev `true` dönmeli); değilse `D3: status token signer is not an expected signer`. Kurum
 * listesinde kurumun güven listesindeki iptal anahtarı (`delegate_keys[purpose=status_list]`), cüzdan listesinde sağlayıcı anahtarı.
 * Azami yaşı (`maxAgeSec`) da verin.
 */
export async function verifyStatusListToken(
  token: string,
  expectedUri: string,
  now: EpochSeconds,
  opts: StatusTokenVerifyOptions,
): Promise<VerifiedStatusToken> {
  checkVerifyOptions(now, opts);
  if (typeof token !== "string" || token.length > MAX_STATUS_TOKEN_LENGTH)
    throw new Error("D3: status token too large");
  const h = decodeProtectedHeader(token);
  if (h.typ !== STATUS_TYP || h.alg !== "ES256" || !h.x5c?.length) throw new Error("D3: status token header");
  const leafDer = b64ToDer(h.x5c[0]);
  if (!signerExpected(opts.expectedSignerFingerprints, sha256Hex(leafDer)))
    throw new Error("D3: status token signer is not an expected signer");
  const pub = await importX509(derToPem(leafDer), "ES256");
  const { payload: raw } = await compactVerify(token, pub);
  const payload = JSON.parse(new TextDecoder().decode(raw)) as VerifiedStatusToken["payload"];
  if (payload.sub !== expectedUri) throw new Error("D3: sub ≠ status uri");
  const bits = payload.status_list?.bits;
  if (typeof bits !== "number" || !READ_STATUS_BITS.has(bits)) throw new Error("D6: bits not 1, 2, 4 or 8");
  if (typeof payload.status_list.lst !== "string") throw new Error("D3: status_list.lst missing");
  if (typeof payload.iat !== "number" || !Number.isFinite(payload.iat)) throw new Error("D3: status token iat missing");
  if (payload.iat > now + clockSkewOption("maxSkewSec", opts.maxSkewSec, STATUS_IAT_SKEW_SEC))
    throw new Error("D3: status token iat in the future");
  if (payload.exp !== undefined && (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)))
    throw new Error("D3: status token exp is not a number");
  if (opts.maxAgeSec !== undefined && now - payload.iat > opts.maxAgeSec) throw new Error("D4: status token stale");
  if (typeof payload.exp === "number" && payload.exp < now) throw new Error("D4: status token expired");
  return {
    format: "jwt",
    payload,
    leafFingerprintHex: sha256Hex(leafDer),
    contentHash: sha256Tag(utf8(token)),
    bitstring: StatusBitstring.fromLst(payload.status_list.lst, MIN_CAPACITY, bits as StatusBits),
  };
}

// ------------------------------------------------------------------ CWT gösterimi (ADR-0048 K3)

/** JWT gösterimiyle aynı girdiler; `uri` CWT gösteriminin kendi (ayrı, opak) adresidir. İmzacı `signRaw` sağlamalı. */
export type StatusListCwtInput = Omit<StatusListTokenInput, "iss">;

/**
 * Aynı mantıksal listenin CWT gösterimi (`application/statuslist+cwt`). JWT gösterimiyle aynı yayın döngüsünde, aynı anahtar
 * ve aynı `iat`/`exp`/`ttl` ile üretilir; yalnız `uri` (ve böylece `sub`) farklıdır.
 */
export async function signStatusListCwt(i: StatusListCwtInput): Promise<Uint8Array> {
  const expSec = i.expSec ?? i.ttlSec * 2;
  if (!Number.isInteger(expSec) || expSec < 2 * i.ttlSec) throw new Error("status token exp must be ≥ 2 × ttl");
  const signRaw = i.signer.signRaw;
  if (!signRaw) throw new Error("status list CWT: the signer has no raw ES256 signing (signRaw)");
  return signCwt({
    uri: i.uri,
    bits: i.bitstring.bits,
    lst: i.bitstring.compressed(),
    iat: i.iat,
    exp: i.iat + expSec,
    ttl: i.ttlSec,
    x5chain: i.signer.x5c,
    sign: (tbs) => signRaw.call(i.signer, tbs),
  });
}

/** Sertifikadaki P-256 açık anahtarı (sıkıştırılmamış nokta, 65 bayt). */
function p256PointFromCertDer(der: Uint8Array): Uint8Array {
  const spki = new Uint8Array(new X509Certificate(Uint8Array.from(der)).publicKey.rawData);
  const point = spki.subarray(spki.length - 65);
  if (point[0] !== 0x04) throw new Error("D3: status list signer key is not an uncompressed P-256 point");
  return point;
}

/**
 * CWT gösterimini doğrular (JWT doğrulamasıyla aynı adımlar ve hata önekleri: D3 imza/başlık/adres, D4 tazelik, D6 bits ve
 * boyut). Dönen yapı JWT doğrulamasınınkiyle aynıdır (`format: "cwt"`, `payload.iss` yok).
 */
export async function verifyStatusListCwt(
  bytes: Uint8Array,
  expectedUri: string,
  now: EpochSeconds,
  opts: StatusTokenVerifyOptions,
): Promise<VerifiedStatusToken> {
  checkVerifyOptions(now, opts);
  const p = parseStatusListCwt(bytes, {
    uri: expectedUri,
    now,
    // ADR-0056 K6: imzacı, imza denetiminden önce sabitlenmiş parmak izleriyle karşılaştırılır
    publicKeyOf: (der) => {
      if (!signerExpected(opts.expectedSignerFingerprints, sha256Hex(der)))
        throw new Error("D3: status token signer is not an expected signer");
      return p256PointFromCertDer(der);
    },
    maxSkewSec: clockSkewOption("maxSkewSec", opts.maxSkewSec, STATUS_IAT_SKEW_SEC),
  });
  if (opts.maxAgeSec !== undefined && now - p.iat > opts.maxAgeSec) throw new Error("D4: status token stale");
  return {
    format: "cwt",
    payload: {
      sub: p.uri,
      iat: p.iat,
      ...(p.exp !== undefined ? { exp: p.exp } : {}),
      ...(p.ttl !== undefined ? { ttl: p.ttl } : {}),
      status_list: { bits: p.bits, lst: b64u(p.lst) },
    },
    leafFingerprintHex: sha256Hex(p.leafDer),
    contentHash: p.contentHash,
    bitstring: StatusBitstring.fromCompressed(p.lst, MIN_CAPACITY, p.bits as StatusBits),
  };
}

/** Doğrulayıcının ön çekim önbelleğinde ikili gövdenin öneki (`b64u:` + base64url). */
export const BINARY_CACHE_PREFIX = "b64u:";

/**
 * Önbellekteki gövde hangi gösterimse onu doğrular: `b64u:` önekli ikili gövde CWT, ötekiler JWT. Doğrulayıcı mdoc kopyasının
 * CWT adresini de, eski kopyaların JWT adresini de okur.
 */
export async function verifyStatusListAny(
  body: string,
  expectedUri: string,
  now: EpochSeconds,
  opts: StatusTokenVerifyOptions,
): Promise<VerifiedStatusToken> {
  if (body.startsWith(BINARY_CACHE_PREFIX)) {
    let bytes: Uint8Array;
    try {
      bytes = b64uToBytes(body.slice(BINARY_CACHE_PREFIX.length));
    } catch {
      throw new Error("D4: status list CWT unreadable (cache body)");
    }
    return verifyStatusListCwt(bytes, expectedUri, now, opts);
  }
  return verifyStatusListToken(body, expectedUri, now, opts);
}

/** İptal listesi doğrulama seçenekleri (JWT ve CWT gösterimi ortak). */
export interface StatusTokenVerifyOptions {
  /**
   * ZORUNLU (ADR-0056 K6): beklenen imzacıların sertifika SHA-256 parmak izleri (onaltılık, küçük harf) ya da parmak izini
   * değerlendiren işlev (ör. cüzdan sağlayıcı anahtarı sorgusu). Boş liste hiçbir imzacıyı kabul etmez.
   */
  expectedSignerFingerprints: readonly string[] | ((fingerprintHex: string) => boolean);
  /** `iat` için saat kayması payı (sn; varsayılan `STATUS_IAT_SKEW_SEC`, en çok `MAX_CLOCK_SKEW_SEC`) */
  maxSkewSec?: number;
  /** verilirse `now − iat` bu süreyi aşan token bayattır (D4) */
  maxAgeSec?: number;
}

function signerExpected(expected: StatusTokenVerifyOptions["expectedSignerFingerprints"], fp: string): boolean {
  if (typeof expected === "function") return expected(fp) === true;
  if (!Array.isArray(expected)) return false;
  return expected.some((e) => typeof e === "string" && e.toLowerCase() === fp);
}

function checkVerifyOptions(now: EpochSeconds, opts: StatusTokenVerifyOptions) {
  epochSeconds(now);
  const e = opts?.expectedSignerFingerprints;
  if (typeof e !== "function" && !Array.isArray(e))
    throw new Error("D3: expectedSignerFingerprints missing (the status list signer must be pinned)");
}
