/**
 * Kurumun cüzdan kanıtı tercihleri — AB ARF WUA_05a, WUA_32; AB TS3 (v1.5) §2.4; OpenID4VCI 1.0 §12.2.4 ve Ek D.2.
 *
 * Kurum, belge yapılandırmasının `proof_types_supported.jwt.key_attestations_required` nesnesinde kabul ettiği anahtar deposu ve
 * kullanıcı doğrulaması seviyelerini (`key_storage`, `user_authentication`) ve KA iptal bakım süresi tercihini
 * (`preferred_key_storage_status_period`, saniye) ilan eder; WIA için tercih metadata'nın en üstündedir
 * (`preferred_client_status_period`). Cüzdan belge isterken:
 *  - kurumun seviye şartını karşılamayan bir KA göndermez; şart karşılanamıyorsa akışı açık bir hatayla durdurur (WUA_05a);
 *  - KA'yı ve WIA'yı, kalan iptal bakım süresi (`*.exp − şimdi`) tercihe eşit ya da uzun olacak biçimde seçer; elindeki kısa
 *    kalırsa sağlayıcıdan yenisini ister (TS3 §2.4.2). Sağlayıcı daha uzununu veremezse tercih zorunluluk değildir: belge yine
 *    istenir, kurum belgenin süresini bakım süresiyle sınırlar (ISSU_12c).
 * Saf TS; ağ isteği yok.
 */
import { decodeJwt } from "./jws.js";
import type { IssuerMetadata } from "./oid4vci.js";
import type { WuaRecord } from "./wua.js";

/** Cüzdan sağlayıcının KA üreticisine geçirilen istek (TS3 §2.4.2: kalan bakım süresi en az `minStatusPeriod` saniye). */
export interface KeyAttestationRequest {
  /** Kurumun kabul ettiği anahtar deposu seviyeleri (Ek D.2; ör. `iso_18045_high`) — biri yeter */
  keyStorage?: string[];
  /** Kurumun kabul ettiği kullanıcı doğrulaması seviyeleri — biri yeter */
  userAuthentication?: string[];
  /** `key_storage_status.exp − şimdi` için asgari süre (saniye) */
  minStatusPeriod?: number;
}

export interface IssuerAttestationPrefs {
  /** Yapılandırma `key_attestations_required` ilan ediyor mu (KA zorunlu) */
  keyAttestationsRequired: boolean;
  keyStorage?: string[];
  userAuthentication?: string[];
  preferredKeyStorageStatusPeriod?: number;
  preferredClientStatusPeriod?: number;
}

const strings = (v: unknown): string[] | undefined =>
  Array.isArray(v) && v.length && v.every((x) => typeof x === "string") ? (v as string[]) : undefined;
const seconds = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isInteger(v) && v > 0 ? v : undefined;

/** Belge yapılandırması için kurumun tercihleri (metadata'da yoksa alanlar boş). Bozuk değerler yok sayılır. */
export function issuerAttestationPrefs(md: IssuerMetadata, configurationId: string): IssuerAttestationPrefs {
  const kar = md.credential_configurations_supported[configurationId]?.proof_types_supported?.jwt
    ?.key_attestations_required as Record<string, unknown> | undefined;
  const out: IssuerAttestationPrefs = { keyAttestationsRequired: !!kar && typeof kar === "object" };
  const ks = strings(kar?.key_storage);
  const ua = strings(kar?.user_authentication);
  const kp = seconds(kar?.preferred_key_storage_status_period);
  const cp = seconds(md.preferred_client_status_period);
  if (ks) out.keyStorage = ks;
  if (ua) out.userAuthentication = ua;
  if (kp) out.preferredKeyStorageStatusPeriod = kp;
  if (cp) out.preferredClientStatusPeriod = cp;
  return out;
}

/** KA üreticisine verilecek istek; tercih yoksa `undefined` (eski KA üreticileri ikinci bağımsız değişkeni yok sayar). */
export function keyAttestationRequestOf(prefs: IssuerAttestationPrefs): KeyAttestationRequest | undefined {
  const r: KeyAttestationRequest = {
    ...(prefs.keyStorage ? { keyStorage: prefs.keyStorage } : {}),
    ...(prefs.userAuthentication ? { userAuthentication: prefs.userAuthentication } : {}),
    ...(prefs.preferredKeyStorageStatusPeriod ? { minStatusPeriod: prefs.preferredKeyStorageStatusPeriod } : {}),
  };
  return Object.keys(r).length ? r : undefined;
}

export type KaCheck =
  | { ok: true; statusRemaining?: number; periodMet: boolean }
  | { ok: false; reason: string; missing: "key_storage" | "user_authentication" };

/**
 * Sağlayıcının verdiği KA kurumun şartını karşılıyor mu (WUA_05a): `key_storage` ve `user_authentication` dizilerinde kurumun
 * kabul ettiği değerlerden biri olmalı. Bakım süresi (`key_storage_status.exp`) tercihi karşılamıyorsa `periodMet: false` —
 * bu bir ret değildir (yukarıdaki açıklama).
 */
export function checkKeyAttestation(kaJwt: string, prefs: IssuerAttestationPrefs, now: number): KaCheck {
  const c = decodeJwt(kaJwt).payload as {
    key_storage?: unknown;
    user_authentication?: unknown;
    key_storage_status?: { exp?: unknown };
  };
  const has = (v: unknown, accepted?: string[]) =>
    !accepted || (Array.isArray(v) && v.some((x) => typeof x === "string" && accepted.includes(x)));
  if (!has(c.key_storage, prefs.keyStorage))
    return {
      ok: false,
      missing: "key_storage",
      reason: `the issuer requires key storage ${prefs.keyStorage!.join(" or ")}; this wallet's keys are ${levels(c.key_storage)}`,
    };
  if (!has(c.user_authentication, prefs.userAuthentication))
    return {
      ok: false,
      missing: "user_authentication",
      reason: `the issuer requires user authentication ${prefs.userAuthentication!.join(" or ")}; this wallet offers ${levels(c.user_authentication)}`,
    };
  const exp = typeof c.key_storage_status?.exp === "number" ? c.key_storage_status.exp : undefined;
  const statusRemaining = exp === undefined ? undefined : exp - now;
  const periodMet =
    !prefs.preferredKeyStorageStatusPeriod ||
    (statusRemaining !== undefined && statusRemaining >= prefs.preferredKeyStorageStatusPeriod);
  return { ok: true, periodMet, ...(statusRemaining !== undefined ? { statusRemaining } : {}) };
}
const levels = (v: unknown) =>
  Array.isArray(v) && v.length ? v.filter((x) => typeof x === "string").join(", ") : "not declared";

/** WIA'nın kalan iptal bakım süresi (`client_status.exp − şimdi`, saniye); eski WUA'da `undefined`. */
export function wiaStatusRemaining(wua: WuaRecord, now: number): number | undefined {
  const c = decodeJwt(wua.jwt).payload as { client_status?: { exp?: unknown } };
  return typeof c.client_status?.exp === "number" ? c.client_status.exp - now : undefined;
}

/** WIA kurumun `preferred_client_status_period` tercihini karşılıyor mu (tercih yoksa evet). */
export const wiaMeetsPreference = (wua: WuaRecord, prefs: IssuerAttestationPrefs, now: number): boolean =>
  !prefs.preferredClientStatusPeriod || (wiaStatusRemaining(wua, now) ?? -1) >= prefs.preferredClientStatusPeriod;

/**
 * TS3 §2.4.2: elindeki WIA tercihi karşılamıyorsa ve çağıran yenileme yolu verdiyse (`renew`), sağlayıcıdan
 * `minStatusPeriod`'lu yenisini ister; yenisi de karşılamazsa elindekinden uzun olanı kullanır. Yenileme hatası akışı
 * durdurmaz (tercih zorunluluk değildir).
 */
export async function wuaForIssuer(p: {
  wua: WuaRecord;
  prefs: IssuerAttestationPrefs;
  now: number;
  renew?: (req: { minStatusPeriod: number }) => Promise<WuaRecord>;
}): Promise<WuaRecord> {
  const want = p.prefs.preferredClientStatusPeriod;
  if (!want || wiaMeetsPreference(p.wua, p.prefs, p.now) || !p.renew) return p.wua;
  const fresh = await p.renew({ minStatusPeriod: want }).catch(() => undefined);
  if (!fresh) return p.wua;
  return (wiaStatusRemaining(fresh, p.now) ?? -1) >= (wiaStatusRemaining(p.wua, p.now) ?? -1) ? fresh : p.wua;
}
