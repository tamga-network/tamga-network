/**
 * Token Status List — SPEC-CRED-0003 (IETF draft-ietf-oauth-status-list-20; AB CIR 2026/1731 ile aynı sürüm).
 *  S2 bits=2 (0 VALID, 1 INVALID/iptal, 2 SUSPENDED) · S7 idx rastgele · S10 kapasite ≥100.000, doluluk ≤%80
 *  S3 version monoton · S5 sabit aralık, değişiklik olmasa da yayın · S6 aralık dışı yayın yok
 *  S11 status anahtarı credential anahtarından ayrı (K1) · S8 liste URI'si opak
 *  Token: typ "statuslist+jwt", {iss, sub: uri, iat, ttl, status_list:{bits:2, lst}} — lst = base64url(zlib(bytes))
 */
import { deflateSync, inflateSync } from "node:zlib";
import { randomBytes, randomInt } from "node:crypto";
import { CompactSign, compactVerify, decodeProtectedHeader, importX509 } from "jose";
import { b64u, b64uToBytes, derToB64, b64ToDer, derToPem, sha256Tag, utf8 } from "@tamga-network/core";
import type { IssuerSigner } from "./issue.js";

export const STATUS_TYP = "statuslist+jwt";
export const BITS = 2;
export const MIN_CAPACITY = 100_000;
export const MAX_FILL = 0.8;
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
    if (capacity < MIN_CAPACITY) throw new Error(`S10: kapasite ≥ ${MIN_CAPACITY}`);
    this.bytes = bytes ?? new Uint8Array(Math.ceil((capacity * BITS) / 8));
  }
  get(idx: number): StatusValue {
    // Liste dışı indeks "geçerli" (0) okunmaz: kesilmiş/bozuk listede iptal edilmiş belge geçerli görünmesin (fail-closed)
    if (!Number.isInteger(idx) || idx < 0 || idx >= this.bytes.length * 4) throw new Error("D6: idx outside the list");
    const byte = this.bytes[idx >> 2];
    return ((byte >> ((idx & 3) * 2)) & 0b11) as StatusValue; // LSB-first (draft §4.1)
  }
  set(idx: number, v: StatusValue) {
    if (idx < 0 || idx >= this.capacity) throw new Error("idx out of range");
    const shift = (idx & 3) * 2;
    this.bytes[idx >> 2] = (this.bytes[idx >> 2] & ~(0b11 << shift)) | ((v & 0b11) << shift);
  }
  /** lst = base64url(zlib-deflate(bytes)) */
  encodeLst(): string {
    return b64u(new Uint8Array(deflateSync(this.bytes, { level: 9 })));
  }
  static fromLst(lst: string, capacity = MIN_CAPACITY): StatusBitstring {
    return new StatusBitstring(capacity, new Uint8Array(inflateSync(b64uToBytes(lst))));
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
  ttlSec: number; // Tamga'da zorunlu (3600; demo'da yayın aralığına göre)
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
/** Verifier tarafı D3/D4/D6: imza (x5c yaprak), sub eşleşmesi, tazelik, bits=2, idx okuma. Çapa (D5) çağıran tarafta: contentHash ↔ TrustSource.statusAnchor. */
export async function verifyStatusListToken(
  token: string,
  expectedUri: string,
  now: number,
): Promise<VerifiedStatusToken> {
  const h = decodeProtectedHeader(token);
  if (h.typ !== STATUS_TYP || h.alg !== "ES256" || !h.x5c?.length) throw new Error("D3: status token header");
  const leafDer = b64ToDer(h.x5c[0]);
  const pub = await importX509(derToPem(leafDer), "ES256");
  const { payload: raw } = await compactVerify(token, pub);
  const payload = JSON.parse(new TextDecoder().decode(raw)) as VerifiedStatusToken["payload"];
  if (payload.sub !== expectedUri) throw new Error("D3: sub ≠ status uri");
  if (payload.status_list?.bits !== BITS) throw new Error("D6: bits ≠ 2");
  const ttl = payload.ttl ?? 3600;
  if (now - payload.iat > ttl * 2) throw new Error("D4: status token stale");
  const { sha256Hex } = await import("@tamga-network/core");
  return {
    payload,
    leafFingerprintHex: sha256Hex(leafDer),
    contentHash: sha256Tag(utf8(token)),
    bitstring: StatusBitstring.fromLst(payload.status_list.lst),
  };
}
