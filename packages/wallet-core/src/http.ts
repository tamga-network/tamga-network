/** HTTP taşıyıcı arayüzü ve cüzdan hata sınıfı — oid4vci/oid4vp/wua ortak tabanı (döngüsel import olmasın diye ayrı modül). */
export interface HttpResponse {
  status: number;
  text(): Promise<string>;
  /** Yanıt başlıkları, küçük harfli adlarla (ör. `dpop-nonce`). Taşıyıcı vermiyorsa yok sayılır. */
  headers?: Record<string, string>;
}
export type Http = (
  url: string,
  init?: {
    method?: "GET" | "POST";
    headers?: Record<string, string>;
    body?: string;
    /**
     * Önbelleği atla: yanıt cihazın HTTP önbelleğinden gelmesin (ör. `immutable` başlıklı ama yerinde değişen şema kataloğu).
     * Expo/React Native fetch'i `cache` seçeneğini uygulamadığından GET adresine `_=<ms>` sorgusu da eklenir.
     */
    fresh?: boolean;
  },
) => Promise<HttpResponse>;
/** `fresh` GET isteğinin adresi: önbellek anahtarı her seferinde farklı olsun diye `_=<ms>` (whatwg-fetch ile aynı ad). */
export const freshUrl = (url: string, now = Date.now()) =>
  /[?&]_=[^&]*/.test(url)
    ? url.replace(/([?&])_=[^&]*/, `$1_=${now}`)
    : `${url}${url.includes("?") ? "&" : "?"}_=${now}`;
/** Varsayılan taşıyıcı; yanıt vermeyen sunucu cüzdanı sonsuza dek bekletmesin diye istek başına zaman aşımı (20 sn). */
export const HTTP_TIMEOUT_MS = 20_000;
export const fetchHttp: Http = async (url, init) => {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), HTTP_TIMEOUT_MS);
  try {
    const method = init?.method ?? "GET";
    const fresh = !!init?.fresh && method === "GET";
    const r = await fetch(fresh ? freshUrl(url) : url, {
      method,
      headers: fresh ? { ...init?.headers, "cache-control": "no-cache" } : init?.headers,
      body: init?.body,
      signal: ctl.signal,
      ...(fresh ? { cache: "no-store" as const } : {}),
    });
    const body = await r.text();
    const headers: Record<string, string> = {};
    r.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));
    return { status: r.status, text: async () => body, headers };
  } catch (e) {
    if (ctl.signal.aborted) throw new WalletError("network", "The server did not respond in time.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
};

/** Yanıt gövdesini JSON olarak okur; gövde JSON değilse (ör. vekil sunucunun HTML hata sayfası) anlaşılır bir WalletError. */
export async function readJson<T>(r: HttpResponse, what: string): Promise<T> {
  const t = await r.text();
  try {
    return JSON.parse(t) as T;
  } catch {
    throw new WalletError("issuer_error", `${what}: the server returned no valid response (HTTP ${r.status})`);
  }
}

export class WalletError extends Error {
  constructor(
    public code:
      | "invalid_offer"
      | "offer_not_found"
      | "tx_code_mismatch"
      | "too_many_attempts"
      | "offer_used"
      | "offer_expired"
      | "issuer_error"
      | "unsupported"
      | "network"
      | "trust_error"
      /** WA-ADR-0002: cüzdan birimi sağlayıcıda iptal edilmiş (uzaktan kapatma ya da kişinin isteği) */
      | "unit_revoked",
    message: string,
    public detail?: unknown,
  ) {
    super(message);
  }
}
