/**
 * ADR-0025 / AB TS3 — Anahtar Kanıtı (KA, OpenID4VCI 1.0 Ek D `key_attestation`) ve cüzdan sağlayıcı iptal listesi denetimi.
 *  - KA: cüzdan sağlayıcı imzalı (`key-attestation+jwt`, OpenID4VCI 1.0 Ek D.1; x5c yaprağı güven listesindeki sağlayıcı anahtarı); `attested_keys`,
 *    `key_storage` / `user_authentication` (ISO 18045), `key_storage_status {status, exp}`.
 *  - KA'lı proof: `openid4vci-proof+jwt` başlığında `key_attestation`; proof `attested_keys[0]` ile imzalı (TS3 §2.2.2.1).
 *  - WIA `client_status` ve KA `key_storage_status` iptal durumu: sağlayıcının Token Status List'i (imzacı = sağlayıcı anahtarı).
 */
import {
  calculateJwkThumbprint,
  decodeJwt,
  decodeProtectedHeader,
  importJWK,
  importX509,
  jwtVerify,
  type JWK,
} from "jose";
import { b64ToDer, derToPem, certFingerprintSha256Hex } from "@tamga-network/core";
import { KEY_STORAGE_RANK, type KeyStorage, type StatusRef, type StatusValueOf } from "@tamga-network/trust";
import { verifyStatusListToken } from "@tamga-network/sd-jwt";

export const KA_TYP = "key-attestation+jwt"; // OpenID4VCI 1.0 Final Ek D.1
export const PROOF_TYP_KA = "openid4vci-proof+jwt";

/** ISO/IEC 18045 saldırı potansiyeli direnci → Tamga anahtar deposu sırası (politika `min_key_storage`). */
export const ISO18045_TO_STORAGE: Record<string, KeyStorage> = {
  iso_18045_basic: "software",
  "iso_18045_enhanced-basic": "tee",
  iso_18045_moderate: "secure_enclave",
  iso_18045_high: "wscd",
};
export const STORAGE_TO_ISO18045: Record<KeyStorage, string> = {
  software: "iso_18045_basic",
  tee: "iso_18045_enhanced-basic",
  secure_enclave: "iso_18045_moderate",
  strongbox: "iso_18045_moderate",
  wscd: "iso_18045_high",
};

export type { StatusRef, StatusValueOf };

export interface KeyAttestationOk {
  ok: true;
  keys: JWK[];
  keyStorage: KeyStorage;
  status?: StatusRef;
  providerFingerprint: string;
}
export type KeyAttestationResult = KeyAttestationOk | { ok: false; reason: string; indeterminate?: boolean };

const statusRefOf = (o: unknown): StatusRef | undefined => {
  const s = (o as { status?: { status_list?: { idx?: unknown; uri?: unknown } } } | undefined)?.status?.status_list;
  return s && typeof s.idx === "number" && typeof s.uri === "string" ? { idx: s.idx, uri: s.uri } : undefined;
};

/** KA JWT'sini doğrular (imza, sağlayıcı anahtarı, süre, alanlar, iptal). */
export async function verifyKeyAttestation(
  ka: string,
  p: {
    now: number;
    isProviderKey: (fp: string) => "YES" | "NO" | "UNKNOWN";
    statusOf?: StatusValueOf;
  },
): Promise<KeyAttestationResult> {
  try {
    const h = decodeProtectedHeader(ka);
    if (h.typ !== KA_TYP || h.alg !== "ES256" || !h.x5c?.length)
      return { ok: false, reason: "KA header (typ/alg/x5c)" };
    const leafDer = b64ToDer(h.x5c[0]);
    const fp = certFingerprintSha256Hex(leafDer);
    const tri = p.isProviderKey(fp);
    if (tri === "UNKNOWN") return { ok: false, reason: "wallet provider list UNKNOWN", indeterminate: true };
    if (tri === "NO") return { ok: false, reason: "KA signer is not a wallet provider key in the trusted list" };
    const { payload } = await jwtVerify(ka, await importX509(derToPem(leafDer), "ES256"), {
      currentDate: new Date(p.now * 1000),
    });
    const keys = payload.attested_keys as JWK[] | undefined;
    if (!Array.isArray(keys) || !keys.length) return { ok: false, reason: "KA attested_keys missing" };
    for (const k of keys)
      if (k.kty !== "EC" || k.crv !== "P-256" || "d" in k)
        return { ok: false, reason: "KA attested key is not public P-256" };
    const levels = (payload.key_storage as string[] | undefined) ?? [];
    const mapped = levels.map((l) => ISO18045_TO_STORAGE[l]).filter(Boolean) as KeyStorage[];
    if (!mapped.length) return { ok: false, reason: "KA key_storage missing or unknown" };
    // Birden çok seviye verildiyse en düşük olan esas alınır (iddia değil, garanti)
    const keyStorage = mapped.reduce((a, b) => (KEY_STORAGE_RANK[a] <= KEY_STORAGE_RANK[b] ? a : b));
    const status = statusRefOf(payload.key_storage_status);
    if (!status) return { ok: false, reason: "KA key_storage_status missing (TS3 §2.4.2)" };
    if (p.statusOf) {
      const v = await p.statusOf(status, p.now);
      if (v === "INVALID") return { ok: false, reason: "key storage revoked (KA status)" };
      if (v === "UNKNOWN") return { ok: false, reason: "KA status unavailable", indeterminate: true };
    }
    return { ok: true, keys, keyStorage, status, providerFingerprint: fp };
  } catch (e) {
    return { ok: false, reason: `KA: ${(e as Error).message}` };
  }
}

/** KA'lı `jwt` proof'u: KA doğrulanır, proof `attested_keys[0]` ile imzalı, `aud` ve `nonce` eşleşir. */
export async function verifyKaProof(
  proof: string,
  p: {
    aud: string;
    nonce: string;
    now: number;
    isProviderKey: (fp: string) => "YES" | "NO" | "UNKNOWN";
    statusOf?: StatusValueOf;
  },
): Promise<KeyAttestationResult> {
  let h: ReturnType<typeof decodeProtectedHeader> & { key_attestation?: string };
  try {
    h = decodeProtectedHeader(proof) as typeof h;
  } catch {
    return { ok: false, reason: "proof unreadable" };
  }
  if (h.typ !== PROOF_TYP_KA || h.alg !== "ES256" || typeof h.key_attestation !== "string")
    return { ok: false, reason: "proof header (typ/alg/key_attestation)" };
  const ka = await verifyKeyAttestation(h.key_attestation, p);
  if (!ka.ok) return ka;
  try {
    const { payload } = await jwtVerify(proof, await importJWK(ka.keys[0], "ES256"), {
      audience: p.aud,
      currentDate: new Date(p.now * 1000),
    });
    if (payload.nonce !== p.nonce) return { ok: false, reason: "proof nonce mismatch" };
    if (typeof payload.iat !== "number" || Math.abs(p.now - payload.iat) > 300)
      return { ok: false, reason: "proof iat outside the window" };
  } catch (e) {
    return { ok: false, reason: `proof signature (attested_keys[0]): ${(e as Error).message}` };
  }
  return noDuplicateKeys(ka);
}

/** Aynı anahtar pakette iki kez olmasın (her kopya ayrı anahtar — PR6). */
async function noDuplicateKeys(ka: KeyAttestationOk): Promise<KeyAttestationResult> {
  const thumbs = await Promise.all(ka.keys.map((k) => calculateJwkThumbprint(k)));
  if (new Set(thumbs).size !== thumbs.length) return { ok: false, reason: "KA contains duplicate keys" };
  return ka;
}

/**
 * `attestation` proof türü (OpenID4VCI 1.0 Ek F.3; HAIP §4.5.1; CIR 2026/1731 Ek Ib TR_KA-4/TR_KA-7): proof, KA'nın kendisidir.
 * KA sağlayıcı imzalı ve güven listesindeki bir sağlayıcı anahtarıyla doğrulanır; issuer'ın c_nonce'unu KA'nın `nonce`'u taşır.
 */
export async function verifyAttestationProof(
  ka: string,
  p: {
    nonce: string;
    now: number;
    isProviderKey: (fp: string) => "YES" | "NO" | "UNKNOWN";
    statusOf?: StatusValueOf;
  },
): Promise<KeyAttestationResult> {
  const v = await verifyKeyAttestation(ka, p);
  if (!v.ok) return v;
  let nonce: unknown;
  try {
    nonce = decodeJwt(ka).nonce;
  } catch {
    return { ok: false, reason: "KA unreadable" };
  }
  if (nonce !== p.nonce) return { ok: false, reason: "KA nonce mismatch (attestation proof)" };
  return noDuplicateKeys(v);
}

/**
 * Credential isteğindeki `proofs` nesnesi (OpenID4VCI 1.0 §8.2): tam olarak bir proof türü. `attestation` en çok bir öğe taşır.
 * Dönen `nonce` issuer'ın nonce tablosunda aranır (imza denetiminden önce ucuz ön eleme).
 */
export function readProofs(
  proofs: unknown,
  max: number,
):
  | { ok: true; kind: "jwt"; items: string[] }
  | { ok: true; kind: "attestation"; ka: string; nonce: unknown }
  | { ok: false; reason: string } {
  const o = (proofs ?? {}) as { jwt?: unknown; attestation?: unknown };
  const kinds = Object.keys(o);
  if (kinds.length !== 1) return { ok: false, reason: "proofs must contain exactly one proof type" };
  if (Array.isArray(o.attestation)) {
    if (o.attestation.length !== 1 || typeof o.attestation[0] !== "string")
      return { ok: false, reason: "proofs.attestation must contain one key attestation" };
    let nonce: unknown;
    try {
      nonce = decodeJwt(o.attestation[0]).nonce;
    } catch {
      return { ok: false, reason: "KA unreadable" };
    }
    return { ok: true, kind: "attestation", ka: o.attestation[0], nonce };
  }
  if (Array.isArray(o.jwt) && o.jwt.length >= 1 && o.jwt.length <= max && o.jwt.every((x) => typeof x === "string"))
    return { ok: true, kind: "jwt", items: o.jwt as string[] };
  return { ok: false, reason: `proofs.jwt 1..${max}` };
}

/**
 * Cüzdan sağlayıcı iptal listesi denetleyicisi (WIA `client_status`, KA `key_storage_status`). Liste imzacısı güven listesindeki
 * bir sağlayıcı anahtarı olmalı; token kısa süre önbellekte tutulur (sorgu başına indirme yok).
 */
export class WalletStatusChecker {
  private cache = new Map<string, { at: number; token: string }>();
  constructor(
    private fetchToken: (uri: string) => Promise<string | null>,
    private isProviderKey: (fp: string) => "YES" | "NO" | "UNKNOWN",
    private maxAgeSec = 300,
  ) {}
  statusOf: StatusValueOf = async (ref, now) => {
    let c = this.cache.get(ref.uri);
    if (!c || now - c.at >= this.maxAgeSec) {
      const t = await this.fetchToken(ref.uri).catch(() => null);
      if (t) {
        c = { at: now, token: t.trim() };
        this.cache.set(ref.uri, c);
      }
    }
    if (!c) return "UNKNOWN";
    try {
      const v = await verifyStatusListToken(c.token, ref.uri, now);
      if (this.isProviderKey(v.leafFingerprintHex) !== "YES") return "UNKNOWN";
      return v.bitstring.get(ref.idx) === 0 ? "VALID" : "INVALID";
    } catch {
      return "UNKNOWN";
    }
  };
}

/** Proof başlığında `key_attestation` var mı (TS3 KA'lı proof)? */
export function hasKeyAttestation(proof: string): boolean {
  try {
    return typeof (decodeProtectedHeader(proof) as { key_attestation?: unknown }).key_attestation === "string";
  } catch {
    return false;
  }
}
/** Credential ucunda proof doğrulamasının ortak sonucu (kurum issuer'ı + kimlik servisi). */
/** `invalidNonce`: kanıttaki c_nonce bilinmiyor / süresi geçmiş / tüketilmiş → OpenID4VCI 1.0 §8.3.1.2 `invalid_nonce` (cüzdan yeni
 *  c_nonce alır); diğer başarısızlıklar `invalid_proof`. */
export type ProofCheck =
  | { ok: true; jwks: JWK[]; keyStorage?: KeyStorage }
  | { ok: false; reason: string; indeterminate?: boolean; invalidNonce?: boolean };
/** Anahtar deposu kurum politikasının alt sınırını karşılıyor mu (WL3)? */
export const meetsKeyStorage = (have: KeyStorage, min: KeyStorage) => KEY_STORAGE_RANK[have] >= KEY_STORAGE_RANK[min];
