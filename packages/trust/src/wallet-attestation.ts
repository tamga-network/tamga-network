/**
 * Cüzdan kanıtı — issuer tarafı doğrulama (SPEC-CRED-0001 §4; ADR-0025, AB TS3; ETSI TS 119 471 REQ-EAASP-4.2.1.2-02/03).
 * Taşıma: OAuth 2.0 Attestation-Based Client Authentication (draft -07; OpenID4VCI 1.0 ve HAIP 1.0 atfı) — token isteğinde iki başlık:
 *   OAuth-Client-Attestation:     <kanıt JWT>  (cüzdan sağlayıcı imzalı; x5c yaprağı güven listesindeki sağlayıcı anahtarı)
 *   OAuth-Client-Attestation-PoP: <PoP JWT>    (kanıttaki cnf anahtarıyla; aud = credential_issuer; iss = kanıtın sub'ı; jti; iat ±300 s)
 * Tek biçim vardır: her -07 istemci kanıtı bir **WIA** (cüzdan örneği kanıtı) olarak okunur (ADR-0029: eski Tamga "WUA" yolu
 * kaldırıldı; anahtar deposu seviyesi kanıtta değil, credential ucundaki Anahtar Kanıtı'nda — KA). Kurallar:
 *  - `exp` zorunlu, ömür 24 saatten kısa (TS3 §2.2.1.1); `cnf.jwk` P-256; `sub` zorunlu.
 *  - `iss` varsa dize olmalı, yoksa da kabul (-07'de zorunluydu, -08'de kalktı); `iat` kanıtta yoksa tolere edilir, PoP'ta zorunlu.
 *  - `client_status` (iptal girişi) varsa denetlenir. Yoksa davranış çağıranın politikası (`clientStatus`): `"optional"` (varsayılan;
 *    AB uyumu için genel -07 kanıtı kabul edilir, sonuçta `clientStatus: "NOT_APPLICABLE"`) ya da `"required"` (zincirleme iptal
 *    yapan belge veren — kimlik servisi — iptal girişi olmayan kanıtı reddeder).
 * PoP tek kullanımlıktır: `jti` ve `iat` sonuçta döner; çağıran `jtiSeen` ile tekrar oynatmayı (replay) reddeder.
 */
import { decodeProtectedHeader, importJWK, importX509, jwtVerify, type JWK } from "jose";
import { b64ToDer, derToPem, certFingerprintSha256Hex } from "@tamga-network/core";

/** Belgenin iptal listesi başvurusu (status_list: idx + uri). */
export interface StatusRef {
  idx: number;
  uri: string;
}
/**
 * İptal listesi sorgusu (çağıran sağlar; liste indirme + doğrulama + önbellek). `NONCOMPLIANT`: liste indi ve imzası geçerli ama
 * profile uymuyor (ör. CIR 2026/1731 Ek Ib: 10.000'den az girişli WIA/KA listesi) — geçici hata değil, ret. Girişin biti açıksa
 * liste küçük olsa da sonuç `INVALID`dir (sağlayıcının imzalı iptal beyanı; 0.5.2): `NONCOMPLIANT` yalnız bit kapalıyken.
 */
export type StatusValueOf = (ref: StatusRef, now: number) => Promise<"VALID" | "INVALID" | "UNKNOWN" | "NONCOMPLIANT">;

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

/** İptal girişi (`client_status`) olmayan kanıt için politika: `"optional"` kabul eder, `"required"` reddeder. */
export type ClientStatusPolicy = "optional" | "required";

export interface WuaClaims {
  /** -07'de zorunluydu, -08'de kalktı: varsa dize */
  iss?: string;
  sub: string;
  cnf: { jwk: JWK };
  wallet_name?: string;
  wallet_version?: string;
  /** Türetilir: `wallet_name`, yoksa `iss`, yoksa `sub` (denetim kaydı için çözüm adı) */
  solution_id: string;
  /** Kanıt anahtar deposu beyanı taşımaz: her zaman `"software"`; gerçek seviye credential ucunda KA'dan (TS3) */
  key_storage: KeyStorage;
  /** ADR-0025: WIA iptal girişi */
  client_status?: { status?: { status_list?: { idx: number; uri: string } }; exp?: number };
  security_level?: string;
  iat?: number;
  exp: number;
}
export type WuaResult =
  | {
      ok: true;
      claims: WuaClaims;
      providerFingerprint: string;
      /**
       * İptal durumu: `VALID` (girişi var, listede geçerli), `NOT_CHECKED` (girişi var, `statusOf` verilmedi),
       * `NOT_APPLICABLE` (girişi yok; `clientStatus: "optional"` politikasıyla kabul edildi).
       */
      clientStatus: "VALID" | "NOT_CHECKED" | "NOT_APPLICABLE";
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
  /** ADR-0025: WIA `client_status` iptal denetimi (yoksa denetlenmez) */
  statusOf?: StatusValueOf;
  /** İptal girişi olmayan kanıt (varsayılan `"optional"`: AB uyumu için genel -07 kanıtı kabul edilir). */
  clientStatus?: ClientStatusPolicy;
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
      return { ok: false, reason: "wallet attestation header (typ/alg/x5c)" };
    const leafDer = b64ToDer(h.x5c[0]);
    const fp = certFingerprintSha256Hex(leafDer);
    const tri = p.isProviderKey(fp);
    if (tri === "UNKNOWN")
      return { ok: false, reason: "wallet provider list UNKNOWN (list stale)", indeterminate: true };
    if (tri === "NO")
      return { ok: false, reason: "wallet attestation signer is not a wallet provider key in the trusted list (R-7)" };
    const { payload } = await jwtVerify(p.wua, await importX509(derToPem(leafDer), "ES256"), {
      currentDate: new Date(now * 1000),
    });
    const c = payload as unknown as WuaClaims;
    if (typeof c.exp !== "number" || !Number.isFinite(c.exp))
      return { ok: false, reason: "wallet attestation exp missing" };
    if (c.iat !== undefined && (typeof c.iat !== "number" || !Number.isFinite(c.iat)))
      return { ok: false, reason: "wallet attestation iat is not a number" };
    if (c.iss !== undefined && (typeof c.iss !== "string" || !c.iss))
      return { ok: false, reason: "wallet attestation iss is not a string" };
    if (typeof c.sub !== "string" || !c.sub) return { ok: false, reason: "wallet attestation sub missing" };
    if (!c.cnf?.jwk || c.cnf.jwk.kty !== "EC" || c.cnf.jwk.crv !== "P-256")
      return { ok: false, reason: "wallet attestation cnf is not P-256" };
    if (c.wallet_name !== undefined && (typeof c.wallet_name !== "string" || !c.wallet_name))
      return { ok: false, reason: "wallet attestation wallet_name is not a string" };
    // TS3 §2.2.1.1: ömür < 24 saat (iat yoksa şimdiden sayılır)
    if (c.exp - (typeof c.iat === "number" ? c.iat : now) >= WIA_MAX_TTL_SEC)
      return { ok: false, reason: "wallet attestation lifetime must be shorter than 24 hours (TS3 §2.2.1.1)" };
    let clientStatus: "VALID" | "NOT_CHECKED" | "NOT_APPLICABLE";
    if (c.client_status !== undefined) {
      const ref = c.client_status?.status?.status_list;
      if (!ref || typeof ref.idx !== "number" || typeof ref.uri !== "string")
        return { ok: false, reason: "WIA client_status malformed" };
      if (p.statusOf) {
        const v = await p.statusOf(ref, now);
        if (v === "INVALID") return { ok: false, reason: "wallet instance revoked (WIA client_status)" };
        if (v === "NONCOMPLIANT") return { ok: false, reason: "WIA status list does not meet the profile" };
        if (v === "UNKNOWN") return { ok: false, reason: "WIA status unavailable", indeterminate: true };
        clientStatus = "VALID";
      } else clientStatus = "NOT_CHECKED";
    } else {
      if ((p.clientStatus ?? "optional") === "required")
        return { ok: false, reason: "wallet attestation without client_status (revocation entry required by policy)" };
      clientStatus = "NOT_APPLICABLE";
    }
    c.solution_id = c.wallet_name ?? c.iss ?? c.sub;
    c.key_storage = "software"; // gerçek seviye KA'dan (credential ucu); kanıt beyan taşımaz
    // PoP
    const ph = decodeProtectedHeader(p.pop);
    if (ph.typ !== WUA_POP_TYP || ph.alg !== "ES256") return { ok: false, reason: "PoP header" };
    const { payload: pp } = await jwtVerify(p.pop, await importJWK(c.cnf.jwk, "ES256"), {
      audience: p.issuerUrl,
      currentDate: new Date(now * 1000),
    });
    if (pp.iss !== c.sub) return { ok: false, reason: "PoP iss ≠ attestation sub" };
    if (typeof pp.iat !== "number" || Math.abs(now - pp.iat) > POP_MAX_AGE_SEC)
      return { ok: false, reason: "PoP iat missing or outside the allowed window" };
    if (typeof pp.jti !== "string" || !pp.jti) return { ok: false, reason: "PoP jti missing" };
    if (p.jtiSeen && (await p.jtiSeen(pp.jti, pp.iat))) return { ok: false, reason: "PoP jti replayed" };
    return { ok: true, claims: c, providerFingerprint: fp, clientStatus, pop: { jti: pp.jti, iat: pp.iat } };
  } catch (e) {
    return { ok: false, reason: `wallet attestation/PoP: ${(e as Error).message}` };
  }
}

/** İki asgari anahtar deposu kuralından sıkı olanı (bilinmeyen değer yok sayılır). */
export function stricterKeyStorage(a: KeyStorage, b: string | null | undefined): KeyStorage {
  if (!b || !isKeyStorage(b)) return a;
  return KEY_STORAGE_RANK[b] > KEY_STORAGE_RANK[a] ? b : a;
}
