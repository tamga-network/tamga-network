/**
 * Saf TS base64url / base64 / UTF-8 — Buffer, TextEncoder ve atob'a bağımlı değil (RN Hermes uyumu).
 * Bilinçli kopya (iç inceleme S6): Node tarafı `@tamga-network/core` b64.ts (Buffer), tarayıcı tarafı `verifier/web` (btoa, bağımlılıksız paket).
 */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const LOOKUP = new Int16Array(128).fill(-1);
for (let i = 0; i < ALPHABET.length; i++) LOOKUP[ALPHABET.charCodeAt(i)] = i;
LOOKUP["-".charCodeAt(0)] = 62;
LOOKUP["_".charCodeAt(0)] = 63;

function encode(bytes: Uint8Array, url: boolean): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i],
      b = bytes[i + 1],
      c = bytes[i + 2];
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += ALPHABET[(n >> 18) & 63] + ALPHABET[(n >> 12) & 63];
    out += b === undefined ? (url ? "" : "=") : ALPHABET[(n >> 6) & 63];
    out += c === undefined ? (url ? "" : "=") : ALPHABET[n & 63];
  }
  return url ? out.replace(/\+/g, "-").replace(/\//g, "_") : out;
}
function decode(s: string): Uint8Array {
  const clean = s.replace(/=+$/, "").replace(/\s+/g, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0,
    buf = 0,
    bits = 0;
  for (let i = 0; i < clean.length; i++) {
    const v = LOOKUP[clean.charCodeAt(i)];
    if (v === undefined || v < 0) throw new Error("base64: invalid character");
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (buf >> bits) & 0xff;
    }
  }
  return out.subarray(0, o);
}

export const b64u = (bytes: Uint8Array): string => encode(bytes, true);
export const b64uDecode = (s: string): Uint8Array => decode(s);
export const b64 = (bytes: Uint8Array): string => encode(bytes, false);
export const b64Decode = (s: string): Uint8Array => decode(s);

export function utf8(s: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
        i++;
      }
    }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return new Uint8Array(out);
}
export function utf8Decode(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length;) {
    const x = b[i++];
    let cp: number;
    if (x < 0x80) cp = x;
    else if ((x & 0xe0) === 0xc0) cp = ((x & 31) << 6) | (b[i++] & 63);
    else if ((x & 0xf0) === 0xe0) cp = ((x & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    else cp = ((x & 7) << 18) | ((b[i++] & 63) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    if (cp >= 0x10000) {
      cp -= 0x10000;
      s += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    } else s += String.fromCharCode(cp);
  }
  return s;
}
export const b64uUtf8 = (s: string): string => b64u(utf8(s));
export const b64uToUtf8 = (s: string): string => utf8Decode(b64uDecode(s));
export const toHex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
export function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
