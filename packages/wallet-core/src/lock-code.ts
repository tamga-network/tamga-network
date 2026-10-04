/**
 * Kapatma kodu (Tamga Wallet WA-ADR-0002 K1/K6, RL1) — telefonu kaybolan kişi cüzdanını telefonsuz kapatır.
 *  - Kod YALNIZ telefonda üretilir: 4×5 = 20 karakter, 30 harfli karışmayan alfabe (0/O, 1/I/L ve U yok) ≈ 98 bit.
 *  - Sağlayıcıya kodun kendisi değil ön özeti gider: SHA-256("tamga-wallet/lock-code/v1|" + kod). Sağlayıcı bunun yavaş
 *    özetini (scrypt) tutar; kod hiçbir sunucuda ve günlükte bulunmaz.
 *  - Giriş büyük/küçük harf, boşluk ve tireden bağımsızdır (`normalizeLockCode`); O→0, I/L→1 gibi düzeltme YAPILMAZ (alfabe
 *    dışı karakter biçim hatasıdır) — kullanıcı kodu gördüğü gibi yazar.
 * Saf TS; cüzdan (React Native) ve sağlayıcı (Node) aynı dosyayı kullanır.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { b64u, utf8 } from "./b64.js";

export const LOCK_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
export const LOCK_CODE_GROUPS = 4;
export const LOCK_CODE_GROUP_LEN = 5;
export const LOCK_CODE_LEN = LOCK_CODE_GROUPS * LOCK_CODE_GROUP_LEN;
const PREHASH_DOMAIN = "tamga-wallet/lock-code/v1|";

/** Rastgele kod, gösterim biçiminde (`7KQ4M-…`). Eşit dağılım için ret örneklemesi (30 ∤ 256). */
export function generateLockCode(randomBytes: (n: number) => Uint8Array): string {
  const out: string[] = [];
  const limit = 256 - (256 % LOCK_CODE_ALPHABET.length); // 240: 0..239 eşit dağılır
  while (out.length < LOCK_CODE_LEN) {
    for (const b of randomBytes(LOCK_CODE_LEN)) {
      if (b >= limit) continue;
      out.push(LOCK_CODE_ALPHABET[b % LOCK_CODE_ALPHABET.length]);
      if (out.length === LOCK_CODE_LEN) break;
    }
  }
  return formatLockCode(out.join(""));
}

/** Boşluk ve tire atılır, büyük harfe çevrilir; biçim denetimi yapılmaz (`isLockCode`). */
export const normalizeLockCode = (input: string): string => input.replace(/[\s-]+/g, "").toUpperCase();

/** 20 karakter, hepsi alfabeden mi (normalize edilmiş girdi)? */
export function isLockCode(normalized: string): boolean {
  if (normalized.length !== LOCK_CODE_LEN) return false;
  for (const ch of normalized) if (!LOCK_CODE_ALPHABET.includes(ch)) return false;
  return true;
}

/** Gösterim: 5'li gruplar tireyle. */
export function formatLockCode(normalized: string): string {
  const groups: string[] = [];
  for (let i = 0; i < normalized.length; i += LOCK_CODE_GROUP_LEN)
    groups.push(normalized.slice(i, i + LOCK_CODE_GROUP_LEN));
  return groups.join("-");
}

/**
 * Sağlayıcıya giden ön özet (base64url SHA-256). Biçimi bozuk kod için de bir özet üretir: sağlayıcı bulunamayan kodla biçim
 * hatasına aynı yanıtı ve aynı süreyi verir (zamanlama/sayım sızıntısı yok).
 */
export const lockCodePrehash = (code: string): string => b64u(sha256(utf8(PREHASH_DOMAIN + normalizeLockCode(code))));
