/**
 * Kişinin silme isteği — Tamga'nın kendi servisleri (Apple 5.1.1(v), Google Play hesap silme, KVKK md. 7/11).
 *
 *  - Kimlik servisi (kimlik ve iletişim belgelerini veren): `POST {issuer}/erasure` — her belge için alan açmadan sunum
 *    (SD-JWT VC + KB-JWT; aud = servis, nonce = servisin /nonce'ı). Servis kaydı ve olay satırlarını siler, kopyaları iptal eder,
 *    kimlik doğrulama sağlayıcısındaki oturumu ve görüntüleri sildirir.
 *  - Cüzdan sağlayıcısı: `deleteUnit` (wua.ts) — birim iptal + kayıt silinir.
 * Kurumların (üniversite vb.) tuttuğu veri kurumun sorumluluğundadır; o yol TS7 silme talebidir (cüzdanda "Haklarım").
 */
import { presentSdJwt } from "./sdjwt.js";
import type { KeyProvider } from "./keys.js";
import type { Http } from "./http.js";
import type { StoredCredential } from "./store.js";

const MAX_PER_REQUEST = 20;

export interface ErasureResult {
  /** Silinen kayıt sayısı (servisin yanıtı); 0 = tutulan bir şey yokmuş */
  erased: number;
  /** Sağlayıcıdaki oturum silme sonucu: "deleted" | "partial" | "none" */
  provider: string;
}

/** Kimlik servisinden alınmış belgelerin kayıtlarını sildirir. Belge yoksa istek gönderilmez. */
export async function requestIdentityErasure(p: {
  issuer: string;
  credentials: StoredCredential[];
  keys: KeyProvider;
  http: Http;
}): Promise<ErasureResult> {
  const base = p.issuer.replace(/\/$/, "");
  const own = p.credentials.filter((c) => c.issuer.replace(/\/$/, "") === base && c.copies.length > 0);
  if (!own.length) return { erased: 0, provider: "none" };
  const presentations: string[] = [];
  for (const c of own.slice(0, MAX_PER_REQUEST)) {
    const n = await p.http(`${base}/nonce`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const nonce = (JSON.parse(await n.text()) as { c_nonce?: string }).c_nonce;
    if (n.status !== 200 || typeof nonce !== "string") throw new Error("erasure: nonce could not be obtained");
    const copy = c.copies[0];
    presentations.push(
      await presentSdJwt({
        combined: copy.combined,
        discloseClaims: [],
        keys: p.keys,
        keyRef: copy.keyRef,
        aud: base,
        nonce,
      }),
    );
  }
  const r = await p.http(`${base}/erasure`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ presentations }),
  });
  const body = JSON.parse((await r.text()) || "{}") as { erased?: number; provider?: string; error?: string };
  if (r.status === 404) return { erased: 0, provider: "none" };
  if (r.status !== 200) throw new Error(`erasure failed (${r.status}${body.error ? `: ${body.error}` : ""})`);
  return { erased: Number(body.erased ?? 0), provider: String(body.provider ?? "none") };
}
