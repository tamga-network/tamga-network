import { createHash } from "node:crypto";
import { keccak_256 } from "@noble/hashes/sha3.js";

export const utf8 = (s: string) => new TextEncoder().encode(s);

export function sha256(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(createHash("sha256").update(bytes).digest());
}
export function toHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}
export function fromHex(h: string): Uint8Array {
  const s = h.startsWith("0x") ? h.slice(2) : h;
  return new Uint8Array(s.match(/.{2}/g)!.map((x) => parseInt(x, 16)));
}
export const sha256Hex = (b: Uint8Array) => toHex(sha256(b));
/** "sha256:<hex>" — liste/çapa zinciri gösterimi */
export const sha256Tag = (b: Uint8Array) => `sha256:${sha256Hex(b)}`;
/** W3C SRI biçimi — vct#integrity / content_hash (SPEC-SCHEMA-0001 §3.1) */
export const sha256Sri = (b: Uint8Array) => `sha256-${Buffer.from(sha256(b)).toString("base64")}`;
export const keccak256 = (b: Uint8Array) => keccak_256(b);
export const keccak256Hex = (b: Uint8Array) => "0x" + toHex(keccak_256(b));
export function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
