/**
 * Taşınabilir özet yardımcıları (ADR-0015): `trust/core` Node API'si kullanmaz — `@tamga-network/core` node:crypto içe aktardığı için
 * yükleyici bunları kullanır. Çıktı `@tamga-network/core`'daki `sha256Tag` ile birebir aynıdır ("sha256:<hex>").
 */
import { sha256 } from "@noble/hashes/sha2.js";

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

export const sha256Tag = (b: Uint8Array) =>
  `sha256:${Array.from(sha256(b), (x) => x.toString(16).padStart(2, "0")).join("")}`;
