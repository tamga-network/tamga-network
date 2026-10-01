/**
 * ARF VCR_19: cüzdan kendi belgelerinin iptal durumunu düzenli yeniler (uygulama öne gelince, en çok 6 saatte bir). Güven listesi
 * sabitli imzacılarla doğrulanır (S-13); sonuçlar belgeye yazılır, iptal/askıdaki belge sunumda eşleşmez ve ekranda işaretlenir.
 */
import { fetchHttp, fetchTrustSource, refreshCredentialStatuses, type WalletState } from "@tamga-network/wallet-core";
import { TRUST_PINS } from "@/trust-anchor";

const DEFAULT_TRUST_BASE = "https://trust.tamga.network";
export const STATUS_CHECK_INTERVAL_MS = 6 * 3600 * 1000;

/** Yalnız durum alanlarını döndürür (id → durum); çağıran taraf en güncel duruma birleştirir. */
export async function checkStatuses(
  state: WalletState,
): Promise<Map<string, NonNullable<WalletState["credentials"][number]["status"]>>> {
  const out = new Map<string, NonNullable<WalletState["credentials"][number]["status"]>>();
  if (!state.credentials.some((c) => c.statusUri)) return out;
  const { source } = await fetchTrustSource(state.settings.trustBase ?? DEFAULT_TRUST_BASE, fetchHttp, {
    pins: TRUST_PINS,
  });
  const next = await refreshCredentialStatuses(state, fetchHttp, source);
  for (const c of next.credentials) if (c.status) out.set(c.id, c.status);
  return out;
}

export function mergeStatuses(
  state: WalletState,
  statuses: Map<string, NonNullable<WalletState["credentials"][number]["status"]>>,
): WalletState {
  if (!statuses.size) return state;
  return {
    ...state,
    credentials: state.credentials.map((c) => (statuses.has(c.id) ? { ...c, status: statuses.get(c.id) } : c)),
  };
}
