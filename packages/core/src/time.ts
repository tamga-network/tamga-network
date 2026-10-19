/**
 * Zaman birimleri (ADR-0056 K12) — Unix saniyesi ile milisaniyesi tür düzeyinde ayrılır. Doğrulama işlevleri `now`'ı birimiyle
 * işaretlenmiş türden alır: `Date.now()` (ms) saniye bekleyen yere ya da `Math.floor(Date.now() / 1000)` (sn) milisaniye bekleyen
 * yere verilemez (derleme hatası). Değer çalışma zamanında da denetlenir: saniye `< 1e11`, milisaniye `≥ 1e11` (1973 sonrası).
 * Saniyeyle verilen milisaniye 2028 ret tarihini hiç getirmiyordu (güvenlik turu 2026-10-19); bu tür o hatayı derlemede yakalar.
 */

declare const unit: unique symbol;
/** Unix zamanı, saniye (ör. JWT `iat`/`exp`). Üret: `epochSeconds(n)` ya da `nowSeconds()`. */
export type EpochSeconds = number & { readonly [unit]: "s" };
/** Unix zamanı, milisaniye (`Date.now()`). Üret: `epochMillis(n)` ya da `nowMillis()`. */
export type EpochMillis = number & { readonly [unit]: "ms" };

/** Saniye/milisaniye sınırı: bundan küçük değer saniye (yıl 5138'e kadar), büyük ya da eşit değer milisaniye (1973'ten sonra). */
const MS_THRESHOLD = 1e11;

/** Sayıyı Unix saniyesi olarak işaretler; sonlu değilse ya da milisaniye büyüklüğündeyse `RangeError`. */
export function epochSeconds(n: number): EpochSeconds {
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n >= MS_THRESHOLD)
    throw new RangeError(`epochSeconds: ${String(n)} is not Unix time in seconds`);
  return n as EpochSeconds;
}
/** Sayıyı Unix milisaniyesi olarak işaretler; sonlu değilse ya da saniye büyüklüğündeyse `RangeError`. */
export function epochMillis(n: number): EpochMillis {
  if (typeof n !== "number" || !Number.isFinite(n) || n < MS_THRESHOLD)
    throw new RangeError(`epochMillis: ${String(n)} is not Unix time in milliseconds`);
  return n as EpochMillis;
}
/** Şimdi, Unix saniyesi (aşağı yuvarlanmış). */
export const nowSeconds = (): EpochSeconds => Math.floor(Date.now() / 1000) as EpochSeconds;
/** Şimdi, Unix milisaniyesi. */
export const nowMillis = (): EpochMillis => Date.now() as EpochMillis;
/** Saniye → milisaniye. */
export const secondsToMillis = (s: EpochSeconds): EpochMillis => (s * 1000) as EpochMillis;
/** Milisaniye → saniye (aşağı yuvarlanmış). */
export const millisToSeconds = (ms: EpochMillis): EpochSeconds => Math.floor(ms / 1000) as EpochSeconds;

/**
 * İsteğe bağlı `now` girdisinin çalışma zamanı denetimi (JavaScript çağıranlar tür denetiminden geçmez): verilmediyse şimdi,
 * verildiyse birimi doğru olmalı (yanlış birim `RangeError`).
 */
export const secondsOrNow = (now: EpochSeconds | undefined): EpochSeconds =>
  now === undefined ? nowSeconds() : epochSeconds(now);
export const millisOrNow = (now: EpochMillis | undefined): EpochMillis =>
  now === undefined ? nowMillis() : epochMillis(now);

/**
 * Saat kayması seçeneklerinin üst sınırı (sn, ADR-0056): daha geniş pencere geçerlilik ve tazelik denetimlerini anlamsızlaştırır.
 * Doğrulayıcı politikasındaki `max_clock_skew_sec` sınırıyla aynı.
 */
export const MAX_CLOCK_SKEW_SEC = 600;

/** Kayma seçeneğini denetler: verilmediyse `fallback`; negatif, sonlu olmayan ya da `MAX_CLOCK_SKEW_SEC`'ten büyükse `RangeError`. */
export function clockSkewOption(name: string, v: number | undefined, fallback: number): number {
  if (v === undefined) return fallback;
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > MAX_CLOCK_SKEW_SEC)
    throw new RangeError(`${name} must be between 0 and ${MAX_CLOCK_SKEW_SEC} seconds`);
  return v;
}
