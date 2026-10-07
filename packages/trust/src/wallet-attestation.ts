/**
 * Wallet Unit Attestation (WUA) — issuer tarafı doğrulama (SPEC-CRED-0001 §4; ETSI TS 119 471 REQ-EAASP-4.2.1.2-02/03; DB-16).
 * Taşıma: OAuth 2.0 Attestation-Based Client Authentication (HAIP) — token isteğinde iki başlık:
 *   OAuth-Client-Attestation:     <WUA JWT>  (Wallet Provider imzalı; x5c yaprağı lotl.wallet_providers[].wua_signing_keys içinde)
 *   OAuth-Client-Attestation-PoP: <PoP JWT>  (WUA'daki cnf anahtarıyla; aud = credential_issuer; iss = WUA sub; jti; iat ±300 s)
 * WUA credential'a girmez; yalnızca ihraç ön koşulu + denetim kaydı (key_storage, solution_id).
 *
 * ADR-0025 (AB TS3): aynı başlıklarla **WIA** da kabul edilir — `client_status` taşıyan, 24 saatten kısa ömürlü, işlem başına yeni
 * anahtarlı cüzdan örneği kanıtı. WIA anahtar deposu bilgisi taşımaz (o KA'dadır); `client_status` iptal durumu denetlenir.
 * Eski WUA biçimi pilot öncesine kadar kabul edilir (bugün test yardımcıları ve kurumun eski cüzdanları üretiyor).
 * Her iki biçimde `exp` zorunlu (süresiz kanıt yok). PoP tek kullanımlıktır: `jti` ve `iat` sonuçta döner; çağıran
 * `jtiSeen` ile tekrar oynatmayı (replay) reddeder.
 */
import { decodeProtectedHeader, importJWK, importX509, jwtVerify, type JWK } from "jose";
import { b64ToDer, derToPem, certFingerprintSha256Hex } from "@tamga-network/core";

/** Belgenin iptal listesi başvurusu (status_list: idx + uri). */
export interface StatusRef {
  idx: number;
  uri: string;
}
/** İptal listesi sorgusu (çağıran sağlar; liste indirme + doğrulama + önbellek). */
export type StatusValueOf = (ref: StatusRef, now: number) => Promise<"VALID" | "INVALID" | "UNKNOWN">;

/** TS3 §2.2.1.1: WIA ömrü 24 saatten kısa */
export const WIA_MAX_TTL_SEC = 24 * 3600;

export const WUA_TYP = "oauth-client-attestation+jwt";
export const WUA_POP_TYP = "oauth-client-attestation-pop+jwt";
/** `tee`: Android güvenilir yürütme ortamı (StrongBox olmayan donanım Keystore). */
export type KeyStorage = "software" | "tee" | "secure_enclave" | "strongbox" | "wscd";
export const KEY_STORAGE_RANK: Record<KeyStorage, number> = {
  software: 0,
  tee: 1,
  secure_enclave: 2,
  strongbox: 2,
  wscd: 3,
};
/** Yalnızca tanımlı değerler; `in` yerine kendi alanı denetimi ("constructor" gibi prototip adları geçmesin). */
export const isKeyStorage = (v: unknown): v is KeyStorage =>
  typeof v === "string" && Object.prototype.hasOwnProperty.call(KEY_STORAGE_RANK, v);
export const POP_MAX_AGE_SEC = 300;

export interface WuaClaims {
  iss: string;
  sub: string;
  cnf: { jwk: JWK };
  wallet_name: string;
  wallet_version: string;
  solution_id: string;
  /** Eski WUA'da beyan; WIA'da yok (KA'dan gelir) — WIA için "software" varsayılır, gerçek seviye credential ucunda KA'dan */
  key_storage: KeyStorage;
  user_auth: string;
  /** ADR-0025: WIA iptal girişi */
  client_status?: { status?: { status_list?: { idx: number; uri: string } }; exp?: number };
  security_level?: string;
  iat: number;
  exp: number;
}
export type WuaResult =
  | {
      ok: true;
      claims: WuaClaims;
      providerFingerprint: string;
      kind: "wua" | "wia";
      /** PoP kimliği ve zamanı — çağıran tekrar oynatma kaydı için (`jti` en az `iat + POP_MAX_AGE_SEC`'e kadar saklanmalı). */
      pop: { jti: string; iat: number };
    }
  | { ok: false; reason: string; indeterminate?: boolean };

export async function verifyWalletAttestation(p: {
  wua: string;
  pop: string;
  issuerUrl: string;
  now?: number;
  isProviderKey: (fingerprintHex: string) => "YES" | "NO" | "UNKNOWN";
  minKeyStorage?: KeyStorage;
  /** ADR-0025: WIA `client_status` iptal denetimi (yoksa denetlenmez) */
  statusOf?: StatusValueOf;
  /**
   * ADR-0036: dış listeden tanınan cüzdan sağlayıcısının kapsamındaki en az anahtar deposu (yoksa null). Kurumun
   * politikasından sıkıysa o uygulanır (WUA beyanında burada; WIA'da credential ucundaki KA denetiminde).
   */
  minKeyStorageFor?: (fingerprintHex: string) => string | null;
  /**
   * PoP tekrar oynatma denetimi: bu `jti` (aynı cüzdan anahtarı için) daha önce görüldüyse true döndürür; görülmediyse kaydeder ve
   * false döndürür. Verilmezse denetlenmez (çağıran sonuçtaki `pop.jti` ile kendisi yapar).
   */
  jtiSeen?: (jti: string, iat: number) => boolean | Promise<boolean>;
}): Promise<WuaResult> {
  const now = p.now ?? Math.floor(Date.now() / 1000);
  try {
    const h = decodeProtectedHeader(p.wua);
    if (h.typ !== WUA_TYP || h.alg !== "ES256" || !h.x5c?.length)
      return { ok: false, reason: "WUA header (typ/alg/x5c)" };
    const leafDer = b64ToDer(h.x5c[0]);
    const fp = certFingerprintSha256Hex(leafDer);
    const tri = p.isProviderKey(fp);
    if (tri === "UNKNOWN")
      return { ok: false, reason: "wallet provider list UNKNOWN (list stale)", indeterminate: true };
    if (tri === "NO") return { ok: false, reason: "WUA signer is not a wallet provider key in the trusted list (R-7)" };
    const { payload } = await jwtVerify(p.wua, await importX509(derToPem(leafDer), "ES256"), {
      currentDate: new Date(now * 1000),
    });
    const c = payload as unknown as WuaClaims;
    if (typeof c.exp !== "number" || !Number.isFinite(c.exp)) return { ok: false, reason: "WUA/WIA exp missing" };
    if (!c.cnf?.jwk || c.cnf.jwk.kty !== "EC" || c.cnf.jwk.crv !== "P-256")
      return { ok: false, reason: "WUA cnf is not P-256" };
    const kind: "wua" | "wia" = c.client_status ? "wia" : "wua";
    if (kind === "wia") {
      // TS3: WIA — wallet_name zorunlu, ömür < 24 saat, client_status iptal değil
      if (typeof c.sub !== "string" || typeof c.wallet_name !== "string")
        return { ok: false, reason: "WIA fields missing (sub/wallet_name)" };
      if (typeof c.exp !== "number" || c.exp - (typeof c.iat === "number" ? c.iat : now) >= WIA_MAX_TTL_SEC)
        return { ok: false, reason: "WIA lifetime must be shorter than 24 hours (TS3 §2.2.1.1)" };
      const ref = c.client_status?.status?.status_list;
      if (!ref || typeof ref.idx !== "number" || typeof ref.uri !== "string")
        return { ok: false, reason: "WIA client_status missing" };
      if (p.statusOf) {
        const v = await p.statusOf(ref, now);
        if (v === "INVALID") return { ok: false, reason: "wallet instance revoked (WIA client_status)" };
        if (v === "UNKNOWN") return { ok: false, reason: "WIA status unavailable", indeterminate: true };
      }
      c.solution_id = c.wallet_name;
      c.key_storage = "software"; // gerçek seviye KA'dan (credential ucu); WIA beyan taşımaz
    } else {
      if (typeof c.sub !== "string" || typeof c.solution_id !== "string" || !isKeyStorage(c.key_storage))
        return { ok: false, reason: "WUA fields missing (sub/solution_id/key_storage)" };
      const min = stricterKeyStorage(p.minKeyStorage ?? "secure_enclave", p.minKeyStorageFor?.(fp) ?? null);
      if (KEY_STORAGE_RANK[c.key_storage] < KEY_STORAGE_RANK[min])
        return { ok: false, reason: `key_storage=${c.key_storage} < politika ${min} (WL3)` };
    }
    // PoP
    const ph = decodeProtectedHeader(p.pop);
    if (ph.typ !== WUA_POP_TYP || ph.alg !== "ES256") return { ok: false, reason: "PoP header" };
    const { payload: pp } = await jwtVerify(p.pop, await importJWK(c.cnf.jwk, "ES256"), {
      audience: p.issuerUrl,
      currentDate: new Date(now * 1000),
    });
    if (pp.iss !== c.sub) return { ok: false, reason: "PoP iss ≠ WUA sub" };
    if (typeof pp.iat !== "number" || Math.abs(now - pp.iat) > POP_MAX_AGE_SEC)
      return { ok: false, reason: "PoP iat outside the allowed window" };
    if (typeof pp.jti !== "string" || !pp.jti) return { ok: false, reason: "PoP jti missing" };
    if (p.jtiSeen && (await p.jtiSeen(pp.jti, pp.iat))) return { ok: false, reason: "PoP jti replayed" };
    return { ok: true, claims: c, providerFingerprint: fp, kind, pop: { jti: pp.jti, iat: pp.iat } };
  } catch (e) {
    return { ok: false, reason: `WUA/PoP: ${(e as Error).message}` };
  }
}

/** İki asgari anahtar deposu kuralından sıkı olanı (bilinmeyen değer yok sayılır). */
export function stricterKeyStorage(a: KeyStorage, b: string | null | undefined): KeyStorage {
  if (!b || !isKeyStorage(b)) return a;
  return KEY_STORAGE_RANK[b] > KEY_STORAGE_RANK[a] ? b : a;
}
