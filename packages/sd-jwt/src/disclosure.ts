/**
 * Disclosure üretimi ve digest — SPEC-CRED-0002 §3.
 *  C3: salt 128 bit, her disclosure için yeni.  C4: digest = SHA-256(disclosure DİZESİNİN ASCII baytları);
 *  asla çözüp yeniden serileştirme (C14).  C5: _sd sıralı.  C6: decoy yok.
 */
import { randomBytes } from "node:crypto";
import { b64u, sha256, utf8 } from "@tamga-network/core";

export const SD_ALG = "sha-256";
export const SD_JWT_TYP = "dc+sd-jwt";
export const KB_JWT_TYP = "kb+jwt";
export const KB_IAT_WINDOW_SEC = 300; // C17

export interface Disclosure {
  disclosure: string;
  digest: string;
  name: string;
  value: unknown;
}

export function makeDisclosure(name: string, value: unknown, salt?: Uint8Array): Disclosure {
  const s = salt ?? new Uint8Array(randomBytes(16));
  if (s.length < 16) throw new Error("C3: salt < 128 bit");
  const json = JSON.stringify([b64u(s), name, value]); // bu baytlar artık sabittir
  const disclosure = b64u(utf8(json));
  return { disclosure, digest: digestOf(disclosure), name, value };
}

/** Digest, disclosure dizesinin ASCII baytları üzerinden — önce hash'le, sonra çöz (C4/C14). */
export function digestOf(disclosure: string): string {
  return b64u(sha256(new TextEncoder().encode(disclosure)));
}

/** Birleşik biçim ayrıştırma: "<jwt>~<d1>~…~[<kb>]". Aradaki boş parça ("~~") biçim hatasıdır (RFC 9901 §4). Disclosure
 *  çözümü ortak kuralda: `decodeDisclosures` (@tamga-network/core/sd-structure). */
export function splitCombined(combined: string): { jwt: string; disclosures: string[]; kb: string } {
  const parts = combined.split("~");
  if (parts.length < 2) throw new Error("Ş1: missing ~ separator");
  const jwt = parts[0];
  if (!jwt) throw new Error("Ş1: issuer-signed JWT missing");
  const kb = parts[parts.length - 1]; // sunumda KB-JWT, ihraç biçiminde boş
  const disclosures = parts.slice(1, -1);
  if (disclosures.some((d) => d.length === 0)) throw new Error("Ş1: empty disclosure segment (~~)");
  return { jwt, disclosures, kb };
}

/** sd_hash — KB-JWT hariç, sondaki ~ dahil (C9, §6.2). */
export function sdHashOf(presentationWithoutKb: string): string {
  if (!presentationWithoutKb.endsWith("~")) throw new Error("C9: sd_hash input must end with ~");
  return b64u(sha256(new TextEncoder().encode(presentationWithoutKb)));
}
