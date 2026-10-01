/**
 * Cüzdan deposu şifrelemesi (AES-256-GCM, saf TS — React Native/Hermes). Anahtar cihazın güvenli deposunda, yalnızca bu cihazda
 * (yedeğe/başka cihaza gitmez); dosya telefon yedeğine girse bile içerik (ad, doğum tarihi, TCKN) okunamaz.
 * Biçim: "tws1." + base64url(iv 12 bayt || şifreli metin || etiket 16 bayt).
 */
import { gcm } from "@noble/ciphers/aes.js";
import { b64u, b64uDecode, concat, utf8, utf8Decode } from "./b64.js";

export const SEAL_PREFIX = "tws1.";

export function sealText(key: Uint8Array, text: string, randomBytes: (n: number) => Uint8Array): string {
  if (key.length !== 32) throw new Error("store key must be 32 bytes");
  const iv = randomBytes(12);
  return SEAL_PREFIX + b64u(concat(iv, gcm(key, iv, utf8(SEAL_PREFIX)).encrypt(utf8(text))));
}

export function openText(key: Uint8Array, sealed: string): string {
  if (!sealed.startsWith(SEAL_PREFIX)) throw new Error("not an encrypted store format");
  const raw = b64uDecode(sealed.slice(SEAL_PREFIX.length));
  if (raw.length < 12 + 16) throw new Error("encrypted store corrupted");
  return utf8Decode(gcm(key, raw.subarray(0, 12), utf8(SEAL_PREFIX)).decrypt(raw.subarray(12)));
}
