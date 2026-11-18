/**
 * Cüzdan deposu şifrelemesi (AES-256-GCM, saf TS — React Native/Hermes). Anahtar cihazın güvenli deposunda, yalnızca bu cihazda
 * (yedeğe/başka cihaza gitmez); dosya telefon yedeğine girse bile içerik (ad, doğum tarihi, TCKN) okunamaz.
 *
 * Biçim "tws2." (2026-11-18, ECCG Agreed Cryptographic Mechanisms v2 §3.5 Note 23/25 — GCM'de IV tekrarı olmamalı): her yazımda
 * rastgele 32 baytlık tuzla ana anahtardan HKDF-SHA-256 ile o yazıma özel alt anahtar türetilir; alt anahtar yalnız bir kez
 * kullanılır, bu yüzden IV sabit (12 sıfır bayt) ve tekrar sorunu yapı gereği yoktur. Biçim: "tws2." + base64url(tuz 32 ||
 * şifreli metin || etiket 16). Eski "tws1." (rastgele IV, ana anahtarla) yalnız OKUNUR — telefonlardaki mevcut kayıtlar için;
 * bir sonraki yazımda tws2'ye geçer.
 */
import { gcm } from "@noble/ciphers/aes.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { b64u, b64uDecode, concat, utf8, utf8Decode } from "./b64.js";

export const SEAL_PREFIX = "tws2.";
const LEGACY_PREFIX = "tws1.";
const SALT_LEN = 32;
const ZERO_IV = new Uint8Array(12);
const INFO = utf8("tamga-wallet-store-v2");

const subkey = (key: Uint8Array, salt: Uint8Array) => hkdf(sha256, key, salt, INFO, 32);

export function sealText(key: Uint8Array, text: string, randomBytes: (n: number) => Uint8Array): string {
  if (key.length !== 32) throw new Error("store key must be 32 bytes");
  const salt = randomBytes(SALT_LEN);
  // sabit IV'nin güvenliği tuzun tekliğine bağlı: kısa/bozuk rastgelelik kaynağı yazımı durdurur
  if (salt.length !== SALT_LEN || salt.every((b) => b === 0)) throw new Error("randomBytes returned an unusable salt");
  return SEAL_PREFIX + b64u(concat(salt, gcm(subkey(key, salt), ZERO_IV, utf8(SEAL_PREFIX)).encrypt(utf8(text))));
}

export function openText(key: Uint8Array, sealed: string): string {
  if (sealed.startsWith(SEAL_PREFIX)) {
    const raw = b64uDecode(sealed.slice(SEAL_PREFIX.length));
    if (raw.length < SALT_LEN + 16) throw new Error("encrypted store corrupted");
    const salt = raw.subarray(0, SALT_LEN);
    return utf8Decode(gcm(subkey(key, salt), ZERO_IV, utf8(SEAL_PREFIX)).decrypt(raw.subarray(SALT_LEN)));
  }
  if (sealed.startsWith(LEGACY_PREFIX)) {
    const raw = b64uDecode(sealed.slice(LEGACY_PREFIX.length));
    if (raw.length < 12 + 16) throw new Error("encrypted store corrupted");
    return utf8Decode(gcm(key, raw.subarray(0, 12), utf8(LEGACY_PREFIX)).decrypt(raw.subarray(12)));
  }
  throw new Error("not an encrypted store format");
}
