/**
 * Taşınabilir özet yardımcıları (ADR-0015): `trust/core` Node API'si kullanmaz — `@tamga-network/core` node:crypto içe aktardığı için
 * yükleyici bunları kullanır. Çıktı `@tamga-network/core`'daki `sha256Tag` ile birebir aynıdır ("sha256:<hex>").
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { keccak_256 } from "@noble/hashes/sha3.js";

/** UTF-8 kodlama — `TextEncoder` ile birebir: eşi olmayan vekil (lone surrogate) U+FFFD olarak kodlanır. */
export function utf8(s: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const d = i + 1 < s.length ? s.charCodeAt(i + 1) : 0;
      if (d >= 0xdc00 && d <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
        i++;
      } else c = 0xfffd; // eşsiz yüksek vekil
    } else if (c >= 0xdc00 && c <= 0xdfff) c = 0xfffd; // eşsiz düşük vekil
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return new Uint8Array(out);
}

export const sha256Tag = (b: Uint8Array) =>
  `sha256:${Array.from(sha256(b), (x) => x.toString(16).padStart(2, "0")).join("")}`;

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

/**
 * SPEC-ID-0002 kimlik türetimi, taşınabilir (ADR-0015): `keccak256(utf8(stateCode) || fingerprint)` → `0x…`. `@tamga-network/core`
 * `computeIdFromFingerprintHex` / `computeIssuerId` ile birebir aynı (eşdeğerlik testi `portable-hash.test.ts`).
 */
export function idFromFingerprintHex(stateCode: string, fingerprintHex: string): string {
  if (!/^[0-9a-fA-F]{64}$/.test(fingerprintHex)) throw new Error("fingerprint must be 64 hex digits (SHA-256)");
  const fp = new Uint8Array(32);
  for (let i = 0; i < 32; i++) fp[i] = parseInt(fingerprintHex.slice(i * 2, i * 2 + 2), 16);
  const cc = utf8(stateCode);
  const buf = new Uint8Array(cc.length + 32);
  buf.set(cc);
  buf.set(fp, cc.length);
  return `0x${hex(keccak_256(buf))}`;
}
/** Sertifika DER'inden kimlik (SPEC-ID-0002): `keccak256(utf8(stateCode) || SHA-256(DER))`. */
export const idFromCertDer = (stateCode: string, der: Uint8Array) => idFromFingerprintHex(stateCode, hex(sha256(der)));
