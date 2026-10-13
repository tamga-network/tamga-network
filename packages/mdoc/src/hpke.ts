/**
 * HPKE (RFC 9180) — yalnız ISO/IEC 18013-7 Ek C'nin kullandığı takım: temel kip (mode_base), DHKEM(P-256, HKDF-SHA256)
 * (kem_id 0x0010), HKDF-SHA256 (kdf_id 0x0001), AES-128-GCM (aead_id 0x0001); tek atımlık (single-shot) seal/open, sıra 0.
 * Saf @noble; RN uyumlu. RFC 9180 Ek A.3 test vektörüyle sınanır (`hpke.test.ts`).
 */
import { p256 } from "@noble/curves/nist.js";
import { gcm } from "@noble/ciphers/aes.js";
import { expand, extract } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { randomBytes as nobleRandom } from "@noble/hashes/utils.js";

const te = new TextEncoder();
const i2osp = (n: number, len: number) => {
  const out = new Uint8Array(len);
  for (let i = len - 1, v = n; i >= 0; i--, v >>>= 8) out[i] = v & 0xff;
  return out;
};
const cat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};
const KEM_ID = 0x0010;
const KDF_ID = 0x0001;
const AEAD_ID = 0x0001;
const NK = 16;
const NN = 12;
const NSECRET = 32;
const SUITE_KEM = cat(te.encode("KEM"), i2osp(KEM_ID, 2));
const SUITE_HPKE = cat(te.encode("HPKE"), i2osp(KEM_ID, 2), i2osp(KDF_ID, 2), i2osp(AEAD_ID, 2));
const V1 = te.encode("HPKE-v1");

const labeledExtract = (suite: Uint8Array, salt: Uint8Array, label: string, ikm: Uint8Array) =>
  extract(sha256, cat(V1, suite, te.encode(label), ikm), salt);
const labeledExpand = (suite: Uint8Array, prk: Uint8Array, label: string, info: Uint8Array, L: number) =>
  expand(sha256, prk, cat(i2osp(L, 2), V1, suite, te.encode(label), info), L);

/** DHKEM: ortak sır (x koordinatı) → shared_secret (RFC 9180 §4.1 ExtractAndExpand). */
function kemShared(dh: Uint8Array, enc: Uint8Array, pkRm: Uint8Array): Uint8Array {
  const eaePrk = labeledExtract(SUITE_KEM, new Uint8Array(0), "eae_prk", dh);
  return labeledExpand(SUITE_KEM, eaePrk, "shared_secret", cat(enc, pkRm), NSECRET);
}
/** Anahtar takvimi (mode_base, psk yok) → AEAD anahtarı ve temel nonce. */
function keySchedule(sharedSecret: Uint8Array, info: Uint8Array): { key: Uint8Array; baseNonce: Uint8Array } {
  const empty = new Uint8Array(0);
  const pskIdHash = labeledExtract(SUITE_HPKE, empty, "psk_id_hash", empty);
  const infoHash = labeledExtract(SUITE_HPKE, empty, "info_hash", info);
  const ctx = cat(new Uint8Array([0]), pskIdHash, infoHash);
  const secret = labeledExtract(SUITE_HPKE, sharedSecret, "secret", empty);
  return {
    key: labeledExpand(SUITE_HPKE, secret, "key", ctx, NK),
    baseNonce: labeledExpand(SUITE_HPKE, secret, "base_nonce", ctx, NN),
  };
}
const dhX = (sk: Uint8Array, pk: Uint8Array) => p256.getSharedSecret(sk, pk, true).subarray(1);

/** Gönderen: alıcının açık anahtarına (65 baytlık sıkıştırılmamış nokta) şifreler. `skE` yalnız test vektörü için. */
export function hpkeSeal(p: {
  recipientPublicKey: Uint8Array;
  info: Uint8Array;
  aad?: Uint8Array;
  plaintext: Uint8Array;
  skE?: Uint8Array;
  randomBytes?: (n: number) => Uint8Array;
}): { enc: Uint8Array; ciphertext: Uint8Array } {
  const pkR = p256.Point.fromBytes(p.recipientPublicKey).toBytes(false);
  let skE = p.skE;
  if (!skE) {
    const rnd = p.randomBytes ?? nobleRandom;
    do skE = rnd(32);
    while (!p256.utils.isValidSecretKey(skE));
  }
  const enc = p256.getPublicKey(skE, false);
  const ss = kemShared(dhX(skE, pkR), enc, pkR);
  const { key, baseNonce } = keySchedule(ss, p.info);
  return { enc, ciphertext: gcm(key, baseNonce, p.aad ?? new Uint8Array(0)).encrypt(p.plaintext) };
}

/** Alıcı: `enc` (gönderenin geçici açık anahtarı) ve kendi özel anahtarıyla açar; doğrulama başarısızsa hata. */
export function hpkeOpen(p: {
  recipientPrivateKey: Uint8Array;
  enc: Uint8Array;
  info: Uint8Array;
  aad?: Uint8Array;
  ciphertext: Uint8Array;
}): Uint8Array {
  const pkE = p256.Point.fromBytes(p.enc).toBytes(false);
  const pkR = p256.getPublicKey(p.recipientPrivateKey, false);
  const ss = kemShared(dhX(p.recipientPrivateKey, pkE), pkE, pkR);
  const { key, baseNonce } = keySchedule(ss, p.info);
  return gcm(key, baseNonce, p.aad ?? new Uint8Array(0)).decrypt(p.ciphertext);
}

/** Test için: iç değerler (RFC 9180 Ek A.3 karşılaştırması). */
export function hpkeContextForTest(sharedSecretDh: { skE: Uint8Array; pkR: Uint8Array }, info: Uint8Array) {
  const enc = p256.getPublicKey(sharedSecretDh.skE, false);
  const ss = kemShared(dhX(sharedSecretDh.skE, sharedSecretDh.pkR), enc, sharedSecretDh.pkR);
  return { sharedSecret: ss, ...keySchedule(ss, info) };
}
