/**
 * Play Integrity (a2 — proje yönetimi 2026-10-04: kod hazır, ZORUNLU DEĞİL). Android cüzdan birim kaydında Play Integrity
 * standart API jetonu gönderirse sağlayıcı jetonu Google'a çözdürür (`decodeIntegrityToken`; servis hesabı anahtarı
 * `TAMGA_WP_PLAY_INTEGRITY_SA`) ve hüküm sınıflarını birimin cihaz kaydına yazar. Depo seviyesi (`key_storage`) Android anahtar
 * kanıtından gelir; Play Integrity sonucu onu DÜŞÜRMEZ, yokluğu kaydı engellemez, servis hesabı yoksa doğrulama atlanır (`null`).
 * Zorunlu kılmak ADR gerektirir (ADR-0025 uygulama notu). Saklanan/günlüklenen tek şey hüküm sınıflarıdır (kişisel ve cihaz
 * verisi yok). Dış HTTP `fetch` ile (testte sahte).
 */
import { existsSync, readFileSync } from "node:fs";
import { SignJWT, importPKCS8 } from "jose";

export const PLAY_INTEGRITY_SCOPE = "https://www.googleapis.com/auth/playintegrity";
export const PLAY_INTEGRITY_API = "https://playintegrity.googleapis.com/v1";
const GOOGLE_TOKEN_URI = "https://oauth2.googleapis.com/token";
/** Hüküm zamanı ile kayıt arasındaki en büyük fark (Google önerisi: dakikalar) */
export const MAX_VERDICT_AGE_MS = 10 * 60_000;
/** Jeton üst boyutu (standart API jetonları birkaç KB) */
const MAX_TOKEN_LEN = 20_000;

export type DeviceVerdict = "strong" | "device" | "basic" | "none";
export type AppVerdict = "play_recognized" | "unrecognized_version" | "unevaluated";
export interface PlayIntegrityResult {
  /** cihaz bütünlüğü (en az MEETS_DEVICE_INTEGRITY) + uygulama Play'in tanıdığı sürüm (geliştirmede tanınmayan sürüm de geçer) */
  ok: boolean;
  device: DeviceVerdict;
  app: AppVerdict;
  /** sabit metin; kişisel ya da cihaz verisi yok */
  reason?: string;
}

export interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

/** `TAMGA_WP_PLAY_INTEGRITY_SA`: servis hesabı JSON dosyasının yolu ya da JSON'un kendisi; boş → null (doğrulama atlanır). */
export function loadServiceAccount(value: string | null | undefined): ServiceAccount | null {
  const v = value?.trim();
  if (!v) return null;
  // Hata iletileri SABİT: bozuk JSON'da ayrıştırıcı iletisi dosya içeriğinden (özel anahtar) parça basabilirdi
  const text = v.startsWith("{") ? v : existsSync(v) ? readFileSync(v, "utf8") : null;
  if (!text) throw new Error("play_integrity_config_missing");
  let j: Partial<ServiceAccount>;
  try {
    j = JSON.parse(text) as Partial<ServiceAccount>;
  } catch {
    throw new Error("play_integrity_config_invalid");
  }
  if (!j || typeof j.client_email !== "string" || typeof j.private_key !== "string")
    throw new Error("play_integrity_config_invalid");
  return { client_email: j.client_email, private_key: j.private_key, token_uri: j.token_uri };
}

/** Dış çağrı zaman aşımı (Google): kayıt isteğini askıda bırakmaz — belirteç + çözüm çağrıları ve gövde okumaları TOPLAM bütçe */
export const GOOGLE_TIMEOUT_MS = 5_000;

/** Tek bir toplam süre bütçesi: bütün istekler aynı sinyalle, gövde okumaları da aynı süre sınırıyla yarışır. */
export interface Budget {
  signal: AbortSignal;
  /** sözü bütçe dolunca reddeder (gövde okuması sinyale uymayan bir `fetch` gerçeklemesinde de askıda kalmaz) */
  guard<T>(p: Promise<T>): Promise<T>;
  done(): void;
}
function budget(ms: number): Budget {
  const ac = new AbortController();
  let fire: () => void = () => {};
  const expired = new Promise<never>((_, rej) => {
    fire = () => rej(new Error("google timeout"));
  });
  expired.catch(() => {}); // işlenmemiş ret olmasın
  const t = setTimeout(() => {
    ac.abort();
    fire();
  }, ms);
  return {
    signal: ac.signal,
    guard: (p) => Promise.race([p, expired]),
    done: () => clearTimeout(t),
  };
}

/** Servis hesabının özel anahtarı açılabiliyor mu (açılışta bir kez; bozuksa Play Integrity kapalı sayılır). İçerik basmaz. */
export async function serviceAccountUsable(sa: ServiceAccount): Promise<boolean> {
  try {
    await importPKCS8(sa.private_key, "RS256");
    return true;
  } catch {
    return false;
  }
}

const deviceOf = (verdicts: unknown): DeviceVerdict => {
  const v = Array.isArray(verdicts) ? verdicts.map(String) : [];
  if (v.includes("MEETS_STRONG_INTEGRITY")) return "strong";
  if (v.includes("MEETS_DEVICE_INTEGRITY")) return "device";
  if (v.includes("MEETS_BASIC_INTEGRITY")) return "basic";
  return "none";
};
const appOf = (verdict: unknown): AppVerdict =>
  verdict === "PLAY_RECOGNIZED"
    ? "play_recognized"
    : verdict === "UNRECOGNIZED_VERSION"
      ? "unrecognized_version"
      : "unevaluated";

/**
 * Google'ın çözdüğü hüküm (`tokenPayloadExternal`) → sonuç. Saf mantık: istek paketi ve `requestHash` (meydan okuma) eşleşmeli,
 * hüküm taze olmalı; cihaz en az MEETS_DEVICE_INTEGRITY; uygulama Play'in tanıdığı sürüm (`allowDevelopment`: tanınmayan sürüm
 * — yan yükleme / iç test — de geçer).
 */
export function evaluatePlayIntegrity(
  payload: unknown,
  p: { packageName: string; requestHash: string; now?: Date; maxAgeMs?: number; allowDevelopment?: boolean },
): PlayIntegrityResult {
  const o = (payload ?? {}) as Record<string, Record<string, unknown> | undefined>;
  const req = o.requestDetails ?? {};
  const device = deviceOf(o.deviceIntegrity?.deviceRecognitionVerdict);
  const app = appOf(o.appIntegrity?.appRecognitionVerdict);
  const fail = (reason: string): PlayIntegrityResult => ({ ok: false, device, app, reason });
  if (req.requestPackageName !== p.packageName) return fail("package mismatch");
  if (req.requestHash !== p.requestHash) return fail("request hash mismatch");
  const ts = Number(req.timestampMillis);
  if (!Number.isFinite(ts)) return fail("timestamp missing");
  if (Math.abs((p.now ?? new Date()).getTime() - ts) > (p.maxAgeMs ?? MAX_VERDICT_AGE_MS))
    return fail("verdict too old");
  if (o.appIntegrity?.packageName !== undefined && o.appIntegrity.packageName !== p.packageName)
    return fail("app package mismatch");
  if (device === "none" || device === "basic") return fail(`device integrity: ${device}`);
  if (app !== "play_recognized" && !(app === "unrecognized_version" && p.allowDevelopment))
    return fail(`app integrity: ${app}`);
  return { ok: true, device, app };
}

type Fetch = typeof fetch;
const tokenCache = new Map<string, { token: string; exp: number }>();

/** OAuth 2.0 JWT bearer (RS256, servis hesabı) → erişim belirteci; süresi dolana kadar bellekte. */
export async function googleAccessToken(
  sa: ServiceAccount,
  fetchFn: Fetch = fetch,
  now = new Date(),
  b?: Budget,
): Promise<string> {
  const own = b ? null : budget(GOOGLE_TIMEOUT_MS);
  const bud = b ?? own!;
  try {
    return await accessTokenWithin(sa, fetchFn, now, bud);
  } finally {
    own?.done();
  }
}

async function accessTokenWithin(sa: ServiceAccount, fetchFn: Fetch, now: Date, bud: Budget): Promise<string> {
  const nowSec = Math.floor(now.getTime() / 1000);
  const cached = tokenCache.get(sa.client_email);
  if (cached && cached.exp - 60 > nowSec) return cached.token;
  const tokenUri = sa.token_uri ?? GOOGLE_TOKEN_URI;
  const assertion = await new SignJWT({ scope: PLAY_INTEGRITY_SCOPE })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(sa.client_email)
    .setAudience(tokenUri)
    .setIssuedAt(nowSec)
    .setExpirationTime(nowSec + 3600)
    .sign(await importPKCS8(sa.private_key, "RS256"));
  const r = await bud.guard(
    fetchFn(tokenUri, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }).toString(),
      signal: bud.signal,
    }),
  );
  if (!r.ok) throw new Error(`google token: HTTP ${r.status}`);
  const j = (await bud.guard(r.json())) as { access_token?: string; expires_in?: number };
  if (typeof j.access_token !== "string") throw new Error("google token: no access_token");
  tokenCache.set(sa.client_email, { token: j.access_token, exp: nowSec + (Number(j.expires_in) || 3600) });
  return j.access_token;
}

/** Jetonu Google'a çözdürür → `tokenPayloadExternal` (ham hüküm; değerlendirme `evaluatePlayIntegrity`). */
export async function decodeIntegrityToken(
  token: string,
  p: { packageName: string; serviceAccount: ServiceAccount; fetch?: Fetch; now?: Date; timeoutMs?: number },
): Promise<unknown> {
  const fetchFn = p.fetch ?? fetch;
  const bud = budget(p.timeoutMs ?? GOOGLE_TIMEOUT_MS); // belirteç + çözüm + gövdeler: tek toplam bütçe
  try {
    const access = await googleAccessToken(p.serviceAccount, fetchFn, p.now, bud);
    const r = await bud.guard(
      fetchFn(`${PLAY_INTEGRITY_API}/${encodeURIComponent(p.packageName)}:decodeIntegrityToken`, {
        method: "POST",
        headers: { authorization: `Bearer ${access}`, "content-type": "application/json" },
        body: JSON.stringify({ integrity_token: token }),
        signal: bud.signal,
      }),
    );
    if (!r.ok) throw new Error(`play integrity decode: HTTP ${r.status}`);
    const j = (await bud.guard(r.json())) as { tokenPayloadExternal?: unknown };
    if (!j.tokenPayloadExternal) throw new Error("play integrity decode: no payload");
    return j.tokenPayloadExternal;
  } finally {
    bud.done();
  }
}

/**
 * Kayıttaki Play Integrity jetonunu doğrular. `null` = atlandı (servis hesabı yok ya da jeton yok/biçimsiz) — seviye değişmez.
 * Google'a ulaşılamazsa sonuç `ok: false, reason: "google unavailable"` (kayıt yine sürer).
 */
export async function verifyPlayIntegrity(
  token: unknown,
  p: {
    packageName: string;
    requestHash: string;
    serviceAccount: ServiceAccount | null;
    fetch?: Fetch;
    now?: Date;
    allowDevelopment?: boolean;
    /** test: Google çağrısı zaman aşımı (varsayılan 5 sn) */
    timeoutMs?: number;
  },
): Promise<PlayIntegrityResult | null> {
  if (!p.serviceAccount || typeof token !== "string" || !token || token.length > MAX_TOKEN_LEN) return null;
  let payload: unknown;
  try {
    payload = await decodeIntegrityToken(token, {
      packageName: p.packageName,
      serviceAccount: p.serviceAccount,
      fetch: p.fetch,
      now: p.now,
      timeoutMs: p.timeoutMs,
    });
  } catch {
    return { ok: false, device: "none", app: "unevaluated", reason: "google unavailable" };
  }
  return evaluatePlayIntegrity(payload, p);
}

/** test: erişim belirteci önbelleğini sıfırlar */
export const _resetTokenCache = () => tokenCache.clear();
