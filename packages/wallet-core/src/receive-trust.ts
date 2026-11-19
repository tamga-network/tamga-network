/**
 * İç yardımcı (paket dışına açılmaz): belge almada güven kaynağı zorunluluğu — ADR-0056 MR1 (güvenlik incelemesi 2026-11-18).
 * `receiveCredentials` ve onu çağıran yenileme işlevleri (`autoRefreshCredential`, `renewIdentityCredential`) aynı kapıyı
 * kullanır; yenilemede kapı AĞA ÇIKMADAN denetlenir (tek kullanımlık yenileme belirteci boşa harcanmasın).
 */
import type { TrustSource } from "@tamga-network/trust/core";

/** `trust` verilmemişse (JavaScript çağıran dahil) alma reddedilir; atlamak yalnız açık `"none"` ile. */
export function assertReceiveTrust(opt: { trust?: TrustSource | "none" } | undefined): void {
  const t = opt?.trust;
  if (t === "none") return;
  if (!t || typeof t !== "object" || typeof t.isCredentialAcceptable !== "function")
    throw new Error('receive: trust source missing (pass a verified TrustSource, or "none" to skip deliberately)');
}
