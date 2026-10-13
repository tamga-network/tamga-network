/**
 * Cüzdan günlüğü — olay türleri ve saklama süresi (AB ARF DASH_02, DASH_02a, DASH_03b; TS9 STS9_35; Tamga Wallet WA-ADR-0007
 * WW2 değişikliği, 2026-10-13). Günlük cihazda kalır (WL4) ve DEĞER içermez: yalnız zaman, belge türü, karşı taraf kimliği ve
 * sonuç.
 *
 *  - `issuance_failed`: belge alma başarısız (kurum, tür, neden kodu — kişi verisi yok).
 *  - `reissued`: belge yeniden alındı (yenileme, ADR-0023; yeniden ihraç, ADR-0048 K4).
 *  - `w2w_verified`: doğrulayan kipinde bir kişinin belgesi denetlendi (zaman, belge türü, sonuç; alan değerleri ve gösterenin
 *    kimliği YOK — STS9_35 / DASH_03b).
 *  - Saklama süresi (`settings.logRetentionDays`, DASH_02a): süresi dolan kayıtlar silinmeden önce uygulamaya sorulur
 *    (`applyLogRetention`'ın `beforeDelete` kancası) ve yaklaşan silmeler önceden listelenir (`upcomingLogDeletions`).
 */
import type { PresentationLogEntry, WalletEvent, WalletState } from "./store.js";
import type { W2wVerdict } from "./w2w.js";

/** Kişiye sunulan saklama süreleri (gün). `null` = süresiz (varsayılan). */
export const LOG_RETENTION_OPTIONS_DAYS = [30, 90, 180, 365] as const;
/** Yaklaşan silme uyarısının varsayılan önceden bildirme süresi (gün). */
export const LOG_RETENTION_WARN_DAYS = 7;
const DAY_MS = 86_400_000;

/** Belge alma hatasının neden kodları (değer ve sunucu iletisi taşımaz). */
export type IssuanceFailureReason =
  "network" | "issuer_error" | "denied" | "expired_offer" | "unit_revoked" | "trust_error" | "cancelled" | "other";

const push = (state: WalletState, e: WalletEvent): WalletState => ({ ...state, events: [...(state.events ?? []), e] });

/** DASH_02: belge alma başarısız oldu. `issuer` kurumun adresi (credential_issuer) — kişisel veri değildir. */
export function logIssuanceFailed(
  state: WalletState,
  p: { vct: string; typeName?: string; issuer?: string; reason: IssuanceFailureReason; now?: number },
): WalletState {
  return push(state, {
    ts: p.now ?? Date.now(),
    kind: "issuance_failed",
    vct: p.vct,
    typeName: p.typeName ?? p.vct,
    ...(p.issuer ? { issuer: p.issuer } : {}),
    reason: p.reason,
  });
}

/** DASH_02: belge yeniden alındı (eski kopyaların yerini yenisi aldı). */
export function logReissued(
  state: WalletState,
  p: { vct: string; typeName: string; issuer?: string; now?: number },
): WalletState {
  return push(state, {
    ts: p.now ?? Date.now(),
    kind: "reissued",
    vct: p.vct,
    typeName: p.typeName,
    ...(p.issuer ? { issuer: p.issuer } : {}),
  });
}

/**
 * Doğrulayan kipi (TS9 STS9_35, DASH_03b): yalnız zaman, belge türü ve sonuç. Doğrulanan alanlar, değerleri ve belge verenin adı
 * günlüğe GİRMEZ (WW2). `verdict` `verifyW2wResponse`'un sonucudur.
 */
export function logW2wVerified(
  state: WalletState,
  p: { docType: string; typeName?: string; verdict: Pick<W2wVerdict, "kind">; now?: number },
): WalletState {
  return push(state, {
    ts: p.now ?? Date.now(),
    kind: "w2w_verified",
    vct: p.docType,
    typeName: p.typeName ?? p.docType,
    outcome: p.verdict.kind,
  });
}

/** DASH_02a: saklama süresini ayarlar (`null` = süresiz). Yalnız sunulan seçenekler kabul edilir. */
export function setLogRetention(state: WalletState, days: number | null): WalletState {
  if (days !== null && !(LOG_RETENTION_OPTIONS_DAYS as readonly number[]).includes(days))
    throw new Error("unsupported log retention period");
  const settings = { ...state.settings };
  if (days === null) delete settings.logRetentionDays;
  else settings.logRetentionDays = days;
  return { ...state, settings };
}

export interface LogDeletion {
  /** bu andan (ms) önceki kayıtlar silinir */
  cutoff: number;
  presentations: PresentationLogEntry[];
  events: WalletEvent[];
}

/** Şu an süresi dolmuş kayıtlar (saklama süresi yoksa boş). `now` ms. */
export function logRetentionDue(state: WalletState, now = Date.now()): LogDeletion {
  const days = state.settings.logRetentionDays;
  if (!days) return { cutoff: -Infinity, presentations: [], events: [] };
  const cutoff = now - days * DAY_MS;
  return {
    cutoff,
    presentations: state.presentationLog.filter((e) => e.ts < cutoff),
    events: (state.events ?? []).filter((e) => e.ts < cutoff),
  };
}

/** Önümüzdeki `withinDays` gün içinde silinecek kayıtlar — uyarı ekranı için (DASH_02a "silmeden önce uyar"). */
export function upcomingLogDeletions(
  state: WalletState,
  now = Date.now(),
  withinDays = LOG_RETENTION_WARN_DAYS,
): LogDeletion {
  return logRetentionDue(state, now + withinDays * DAY_MS);
}

/**
 * Süresi dolan kayıtları siler. `beforeDelete` (silmeden önce uyarı kancası) silinecek kayıtları alır; `false` dönerse hiçbir şey
 * silinmez (kişi ertelemek ya da önce dışa aktarmak istedi). Silinecek kayıt yoksa kanca çağrılmaz.
 */
export async function applyLogRetention(
  state: WalletState,
  now = Date.now(),
  beforeDelete?: (due: LogDeletion) => boolean | Promise<boolean>,
): Promise<{ state: WalletState; deleted: number }> {
  const due = logRetentionDue(state, now);
  const n = due.presentations.length + due.events.length;
  if (!n) return { state, deleted: 0 };
  if (beforeDelete && !(await beforeDelete(due))) return { state, deleted: 0 };
  return {
    state: {
      ...state,
      presentationLog: state.presentationLog.filter((e) => e.ts >= due.cutoff),
      ...(state.events ? { events: state.events.filter((e) => e.ts >= due.cutoff) } : {}),
    },
    deleted: n,
  };
}
