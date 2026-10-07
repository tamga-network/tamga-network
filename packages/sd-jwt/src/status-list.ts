/**
 * Token Status List — SPEC-CRED-0003 (IETF draft-ietf-oauth-status-list-20; AB CIR 2026/1731 ile aynı sürüm).
 *  S2 bits=2 (0 VALID, 1 INVALID/iptal, 2 SUSPENDED) · S7 idx rastgele · S10 kapasite ≥100.000, doluluk ≤%80
 *  S3 version monoton · S5 sabit aralık, değişiklik olmasa da yayın · S6 aralık dışı yayın yok
 *  S11 status anahtarı credential anahtarından ayrı (K1) · S8 liste URI'si opak
 *  Token: typ "statuslist+jwt", {iss, sub: uri, iat, exp, ttl, status_list:{bits:2, lst}} — lst = base64url(zlib(bytes))
 *  Doğrulayıcı güvenilmeyen girdiye karşı: token boyutu ve açılmış liste boyutu sınırlı (zlib bombası yok), `exp` geçmişse D4,
 *  `iat` saat kayması payından ileride ise D3.
 */
import { deflateSync, inflateSync } from "node:zlib";
import { randomBytes, randomInt } from "node:crypto";
import { CompactSign, compactVerify, decodeProtectedHeader, importX509 } from "jose";
import { b64u, b64uToBytes, derToB64, b64ToDer, derToPem, sha256Hex, sha256Tag, utf8 } from "@tamga-network/core";
import type { IssuerSigner } from "./issue.js";

export const STATUS_TYP = "statuslist+jwt";
export const BITS = 2;
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
  ) {
    if (!Number.isInteger(capacity) || capacity < MIN_CAPACITY) throw new Error(`S10: kapasite ≥ ${MIN_CAPACITY}`);
    if (capacity > MAX_CAPACITY) throw new Error(`status list capacity above ${MAX_CAPACITY}`);
    this.bytes = bytes ?? new Uint8Array(Math.ceil((capacity * BITS) / 8));
  }
  get(idx: number): StatusValue {
    // Liste dışı indeks "geçerli" (0) okunmaz: kesilmiş/bozuk listede iptal edilmiş belge geçerli görünmesin (fail-closed)
    if (!Number.isInteger(idx) || idx < 0 || idx >= this.bytes.length * 4) throw new Error("D6: idx outside the list");
    const byte = this.bytes[idx >> 2];
    return ((byte >> ((idx & 3) * 2)) & 0b11) as StatusValue; // LSB-first (draft §4.1)
  }
  set(idx: number, v: StatusValue) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= this.capacity) throw new Error("idx out of range");
    if (!Number.isInteger(v) || v < 0 || v > 0b11) throw new Error("status value out of range (2 bits)");
    const shift = (idx & 3) * 2;
    this.bytes[idx >> 2] = (this.bytes[idx >> 2] & ~(0b11 << shift)) | ((v & 0b11) << shift);
  }
  /** lst = base64url(zlib-deflate(bytes)) */
  encodeLst(): string {
    return b64u(new Uint8Array(deflateSync(this.bytes, { level: 9 })));
  }
  /** Açılmış liste en çok `MAX_CAPACITY` girdilik olabilir (zlib bombası: sınır aşılırsa açma durur, D6). */
  static fromLst(lst: string, capacity = MIN_CAPACITY): StatusBitstring {
    const maxOutputLength = Math.ceil((MAX_CAPACITY * BITS) / 8);
    let bytes: Buffer;
    try {
      bytes = inflateSync(b64uToBytes(lst), { maxOutputLength });
    } catch (e) {
      if ((e as { code?: string }).code === "ERR_BUFFER_TOO_LARGE" || e instanceof RangeError)
        throw new Error("D6: status list exceeds the maximum size");
      throw new Error(`D6: status list could not be decompressed: ${(e as Error).message}`);
    }
    return new StatusBitstring(capacity, new Uint8Array(bytes));
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
  ttlSec: number; // Tamga'da zorunlu (3600; yayın aralığı kısaltılırsa ona göre)
}
export async function signStatusListToken(i: StatusListTokenInput): Promise<string> {
  const payload = {
    iss: i.iss,
    sub: i.uri,
    iat: i.iat,
    exp: i.iat + i.ttlSec * 2,
    ttl: i.ttlSec,
    status_list: { bits: BITS, lst: i.bitstring.encodeLst() },
  };
  return i.signer.sign(
    { alg: "ES256", typ: STATUS_TYP, x5c: i.signer.x5c.map(derToB64) },
    utf8(JSON.stringify(payload)),
  );
}

export interface VerifiedStatusToken {
  payload: {
    iss: string;
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
 * Verifier tarafı D3/D4/D6: imza (x5c yaprak), sub eşleşmesi, tazelik (ttl×2, `exp`), `iat` gelecekte değil, bits=2, boyut
 * sınırları, idx okuma. Çapa (D5) çağıran tarafta: contentHash ↔ TrustSource.statusAnchor. Hata iletileri adım koduyla başlar
 * ("D3:", "D4:", "D6:") — doğrulayıcı D4'ü INDETERMINATE (tazelik), ötekileri RED sayar.
 */
export async function verifyStatusListToken(
  token: string,
  expectedUri: string,
  now: number,
  opts: { maxSkewSec?: number } = {},
): Promise<VerifiedStatusToken> {
  if (typeof token !== "string" || token.length > MAX_STATUS_TOKEN_LENGTH)
    throw new Error("D3: status token too large");
  const h = decodeProtectedHeader(token);
  if (h.typ !== STATUS_TYP || h.alg !== "ES256" || !h.x5c?.length) throw new Error("D3: status token header");
  const leafDer = b64ToDer(h.x5c[0]);
  const pub = await importX509(derToPem(leafDer), "ES256");
  const { payload: raw } = await compactVerify(token, pub);
  const payload = JSON.parse(new TextDecoder().decode(raw)) as VerifiedStatusToken["payload"];
  if (payload.sub !== expectedUri) throw new Error("D3: sub ≠ status uri");
  if (payload.status_list?.bits !== BITS) throw new Error("D6: bits ≠ 2");
  if (typeof payload.iat !== "number" || !Number.isFinite(payload.iat)) throw new Error("D3: status token iat missing");
  if (payload.iat > now + (opts.maxSkewSec ?? STATUS_IAT_SKEW_SEC))
    throw new Error("D3: status token iat in the future");
  if (payload.exp !== undefined && (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)))
    throw new Error("D3: status token exp is not a number");
  const ttl = payload.ttl ?? 3600;
  if (now - payload.iat > ttl * 2) throw new Error("D4: status token stale");
  if (typeof payload.exp === "number" && payload.exp < now) throw new Error("D4: status token expired");
  return {
    payload,
    leafFingerprintHex: sha256Hex(leafDer),
    contentHash: sha256Tag(utf8(token)),
    bitstring: StatusBitstring.fromLst(payload.status_list.lst),
  };
}
