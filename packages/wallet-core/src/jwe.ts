/**
 * JWE (compact) — ECDH-ES + A128GCM ya da A256GCM, yalnızca şifreleme tarafı (cüzdan → verifier, SPEC-PROTO-0002 §5.3 / PV3;
 * HAIP §5: cüzdan en az birini destekler, ikisi de varsa A256GCM). RFC 7516/7518: efemer P-256 anahtar, Concat KDF (SHA-256,
 * keydatalen 128/256, AlgorithmID = enc), AES-GCM, AAD = ASCII(b64u(header)).
 * Saf TS: @noble/curves (ECDH), @noble/hashes (SHA-256), @noble/ciphers (GCM). Çözme tarafı Node'da jose ile (uyum testi).
 */
import { p256 } from "@noble/curves/nist.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { gcm } from "@noble/ciphers/aes.js";
import { randomBytes as nobleRandom } from "@noble/hashes/utils.js";
import { b64u, b64uUtf8, concat, utf8 } from "./b64.js";
import { jwkToRaw, rawToJwk, type PublicJwk } from "./keys.js";

export interface EncJwk extends PublicJwk {
  kid?: string;
  use?: string;
}

/** RFC 7638 JWK SHA-256 parmak izi (EC P-256): gerekli üyeler sözlük sırasıyla, boşluksuz. */
export function jwkThumbprint(jwk: PublicJwk): Uint8Array {
  return sha256(new TextEncoder().encode(`{"crv":"${jwk.crv}","kty":"${jwk.kty}","x":"${jwk.x}","y":"${jwk.y}"}`));
}

const u32 = (n: number) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const lenInput = (b: Uint8Array) => concat(u32(b.length), b);

/** Concat KDF tek tur (keydatalen ≤ 256 bit): SHA-256(0x00000001 || Z || AlgorithmID || PartyUInfo || PartyVInfo || SuppPubInfo). */
export function concatKdf(
  z: Uint8Array,
  bits: number,
  alg: string,
  apu = new Uint8Array(0),
  apv = new Uint8Array(0),
): Uint8Array {
  const other = concat(lenInput(utf8(alg)), lenInput(apu), lenInput(apv), u32(bits));
  return sha256(concat(u32(1), z, other)).subarray(0, bits / 8);
}

export type JweEnc = "A128GCM" | "A256GCM";

/** Doğrulayıcının ilanına göre içerik şifrelemesi: ilan yoksa A128GCM (OpenID4VP varsayılanı), A256GCM varsa o (HAIP). */
export function chooseEnc(supported: unknown): JweEnc | null {
  if (supported === undefined) return "A128GCM";
  if (!Array.isArray(supported)) return null;
  if (supported.includes("A256GCM")) return "A256GCM";
  if (supported.includes("A128GCM")) return "A128GCM";
  return null;
}

export function encryptJwe(
  plaintext: Uint8Array,
  recipient: EncJwk,
  opts: { randomBytes?: (n: number) => Uint8Array; kid?: string; enc?: JweEnc } = {},
): string {
  const enc = opts.enc ?? "A128GCM";
  if (recipient.kty !== "EC" || recipient.crv !== "P-256") throw new Error("recipient key must be P-256");
  const rnd = opts.randomBytes ?? nobleRandom;
  let esk: Uint8Array;
  do {
    esk = rnd(32);
  } while (!p256.utils.isValidSecretKey(esk));
  const epk = rawToJwk(p256.getPublicKey(esk, false));
  const shared = p256.getSharedSecret(esk, jwkToRaw(recipient), true); // 33 bayt sıkıştırılmış nokta
  const z = shared.subarray(1, 33); // x koordinatı
  const cek = concatKdf(z, enc === "A256GCM" ? 256 : 128, enc);
  const header: Record<string, unknown> = {
    alg: "ECDH-ES",
    enc,
    epk: { kty: "EC", crv: "P-256", x: epk.x, y: epk.y },
  };
  const kid = opts.kid ?? recipient.kid;
  if (kid) header.kid = kid;
  const protectedB64 = b64uUtf8(JSON.stringify(header));
  const iv = rnd(12);
  const out = gcm(cek, iv, utf8(protectedB64)).encrypt(plaintext); // ciphertext || tag(16)
  const ct = out.subarray(0, out.length - 16),
    tag = out.subarray(out.length - 16);
  return `${protectedB64}..${b64u(iv)}.${b64u(ct)}.${b64u(tag)}`;
}
