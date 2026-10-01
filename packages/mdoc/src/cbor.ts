/**
 * Minimal, deterministik CBOR (RFC 8949) — mdoc/COSE için gereken alt küme. Saf JS (RN uyumlu), bağımlılık yok.
 * Kapsam: uint/negint (number ve gerekirse bigint), bstr (Uint8Array), tstr (string), array, map (Map | düz nesne),
 * bool, null, tag (CborTag), float64. Deterministik kural (RFC 8949 §4.2.1): tamsayı en kısa biçim, kesin uzunluk,
 * map anahtarları KODLANMIŞ hâllerinin bayt sırasına göre (bytewise). Not: ISO 18013-5 RFC 7049 §3.9 (uzunluk-önce) atar;
 * biz tüm ekosistemi kontrol ettiğimiz için öz-tutarlı §4.2.1 yeterli — pilot tam interop gerekirse sıralama tek satır değişir.
 */
export class CborTag {
  constructor(
    readonly tag: number,
    readonly value: unknown,
  ) {}
}
/** Map'te sıralamayı korumak istemeyen çağıran için: düz nesne string-anahtarlı map olarak kodlanır. */
export type CborValue =
  | number
  | bigint
  | boolean
  | null
  | string
  | Uint8Array
  | CborValue[]
  | Map<CborValue, CborValue>
  | { [k: string]: CborValue }
  | CborTag;

// ---------- encode
function head(major: number, len: number | bigint, out: number[]) {
  const mt = major << 5;
  const n = typeof len === "bigint" ? len : BigInt(len);
  if (n < 24n) out.push(mt | Number(n));
  else if (n < 0x100n) out.push(mt | 24, Number(n));
  else if (n < 0x10000n) out.push(mt | 25, Number(n >> 8n) & 0xff, Number(n) & 0xff);
  else if (n < 0x100000000n) {
    out.push(mt | 26);
    for (let s = 24n; s >= 0n; s -= 8n) out.push(Number((n >> s) & 0xffn));
  } else {
    out.push(mt | 27);
    for (let s = 56n; s >= 0n; s -= 8n) out.push(Number((n >> s) & 0xffn));
  }
}

function encodeInto(v: CborValue, out: number[]): void {
  if (v === null || v === undefined) return void out.push(0xf6);
  if (v === true) return void out.push(0xf5);
  if (v === false) return void out.push(0xf4);
  if (typeof v === "number") {
    if (Number.isInteger(v)) {
      if (v >= 0) head(0, v, out);
      else head(1, -v - 1, out);
    } else {
      // float64 (0xfb) — deterministik hâlde de tam biçim; timestamp'lerde tercih tag+tstr, float nadir
      const buf = new ArrayBuffer(8);
      new DataView(buf).setFloat64(0, v);
      out.push(0xfb, ...new Uint8Array(buf));
    }
    return;
  }
  if (typeof v === "bigint") {
    if (v >= 0n) head(0, v, out);
    else head(1, -v - 1n, out);
    return;
  }
  if (typeof v === "string") {
    const b = new TextEncoder().encode(v);
    head(3, b.length, out);
    for (const x of b) out.push(x);
    return;
  }
  if (v instanceof Uint8Array) {
    head(2, v.length, out);
    for (const x of v) out.push(x);
    return;
  }
  if (Array.isArray(v)) {
    head(4, v.length, out);
    for (const item of v) encodeInto(item, out);
    return;
  }
  if (v instanceof CborTag) {
    head(6, v.tag, out);
    encodeInto(v.value as CborValue, out);
    return;
  }
  if (v instanceof Map) {
    const entries = [...v.entries()].map(([k, val]) => ({ k: encode(k as CborValue), val }));
    entries.sort((a, b) => cmpBytes(a.k, b.k));
    head(5, entries.length, out);
    for (const e of entries) {
      for (const x of e.k) out.push(x);
      encodeInto(e.val as CborValue, out);
    }
    return;
  }
  // düz nesne → string anahtarlı map
  const keys = Object.keys(v);
  const entries = keys.map((k) => ({ k: encode(k), val: (v as Record<string, CborValue>)[k] }));
  entries.sort((a, b) => cmpBytes(a.k, b.k));
  head(5, entries.length, out);
  for (const e of entries) {
    for (const x of e.k) out.push(x);
    encodeInto(e.val, out);
  }
}

function cmpBytes(a: Uint8Array, b: Uint8Array): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
}

export function encode(v: CborValue): Uint8Array {
  const out: number[] = [];
  encodeInto(v, out);
  return Uint8Array.from(out);
}

// ---------- decode
// Güvenilmeyen girdi (doğrulayıcıya gelen sunum) için katı çözücü: kesik girdi, belirsiz uzunluk, girdiden büyük uzunluk
// bildirimi, aşırı iç içelik, yinelenen map anahtarı ve sondaki fazla bayt HATA'dır (hizmet dışı bırakma ve belirsizlik yok).
const MAX_DEPTH = 64;
interface Cur {
  b: Uint8Array;
  p: number;
}
function need(c: Cur, n: number): void {
  if (!Number.isSafeInteger(n) || n < 0 || c.p + n > c.b.length)
    throw new Error("CBOR: truncated input or invalid length");
}
function readHead(c: Cur): { major: number; info: number; len: number } {
  need(c, 1);
  const ib = c.b[c.p++];
  const major = ib >> 5;
  const info = ib & 0x1f;
  let len = info;
  if (info === 24) {
    need(c, 1);
    len = c.b[c.p++];
  } else if (info === 25) {
    need(c, 2);
    len = (c.b[c.p++] << 8) | c.b[c.p++];
  } else if (info === 26) {
    need(c, 4);
    len = 0;
    for (let i = 0; i < 4; i++) len = len * 256 + c.b[c.p++];
  } else if (info === 27) {
    need(c, 8);
    len = 0;
    for (let i = 0; i < 8; i++) len = len * 256 + c.b[c.p++];
  } else if (info >= 28 && major !== 7) {
    throw new Error("CBOR: indefinite length or reserved additional info not supported");
  }
  return { major, info, len };
}

function decodeItem(c: Cur, depth: number): CborValue {
  if (depth > MAX_DEPTH) throw new Error("CBOR: nesting limit exceeded");
  const start = c.p;
  const { major, info, len } = readHead(c);
  switch (major) {
    case 0:
      if (!Number.isSafeInteger(len)) throw new Error("CBOR: integer outside the safe range");
      return len;
    case 1:
      if (!Number.isSafeInteger(len)) throw new Error("CBOR: integer outside the safe range");
      return -1 - len;
    case 2: {
      need(c, len);
      const s = c.b.subarray(c.p, c.p + len);
      c.p += len;
      return new Uint8Array(s);
    }
    case 3: {
      need(c, len);
      const s = c.b.subarray(c.p, c.p + len);
      c.p += len;
      return new TextDecoder("utf-8", { fatal: true }).decode(s);
    }
    case 4: {
      need(c, len); // her öğe en az 1 bayt: girdiden uzun dizi bildirimi reddedilir
      const arr: CborValue[] = [];
      for (let i = 0; i < len; i++) arr.push(decodeItem(c, depth + 1));
      return arr;
    }
    case 5: {
      need(c, len * 2);
      const m = new Map<CborValue, CborValue>();
      for (let i = 0; i < len; i++) {
        const k = decodeItem(c, depth + 1);
        if ((typeof k === "string" || typeof k === "number") && m.has(k)) throw new Error("CBOR: duplicate map key");
        m.set(k, decodeItem(c, depth + 1));
      }
      return m;
    }
    case 6:
      return new CborTag(len, decodeItem(c, depth + 1));
    case 7:
      if (info === 20) return false;
      if (info === 21) return true;
      if (info === 22 || info === 23) return null;
      if (info === 27) {
        const dv = new DataView(c.b.buffer, c.b.byteOffset + start + 1, 8);
        c.p = start + 9;
        return dv.getFloat64(0);
      }
      throw new Error(`CBOR: desteklenmeyen simple/float info ${info}`);
    default:
      throw new Error(`CBOR: bilinmeyen major ${major}`);
  }
}

export function decode(bytes: Uint8Array): CborValue {
  const c: Cur = { b: bytes, p: 0 };
  const v = decodeItem(c, 0);
  if (c.p !== bytes.length) throw new Error("CBOR: trailing bytes after item");
  return v;
}

/** Tag 24: gömülü CBOR (bstr içine kodlanmış). mdoc'ta IssuerSignedItem ve MSO bu şekilde taşınır. */
export const encodeEmbedded = (v: CborValue): CborTag => new CborTag(24, encode(v));
export function decodeEmbedded(tag: CborValue): CborValue {
  if (!(tag instanceof CborTag) || tag.tag !== 24 || !(tag.value instanceof Uint8Array))
    throw new Error("CBOR: expected tag 24 (embedded bstr)");
  return decode(tag.value);
}
