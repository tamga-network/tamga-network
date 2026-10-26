/**
 * Sunum durumu (bellekte; demo). Kişisel veri: yalnızca `claims` (ayrı uçtan, AP3) — süresi dolunca silinir.
 * `showKey`: kontrol görünümü bağlantısı için rastgele anahtar (ADR-0012 C); sonuçtan sonra 5 dk geçerli.
 */
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Policy, PresentationRequest, VerificationResult } from "@tamga-network/verifier";

export interface TraceEntry {
  t: number;
  step: string;
  detail?: string;
}

export interface Presentation {
  req: PresentationRequest;
  policy: Policy;
  createdAt: number;
  /**
   * Sunum tüketildi: ya cüzdanın yanıtı sahiplik kanıtına (A6 / Z1) kadar geçti ve sonuç yazıldı, ya kişi reddetti (PV5), ya da
   * deneme sınırı doldu. Öncesindeki başarısız yanıtlar (çözülemeyen gövde, state uyuşmazlığı, boş vp_token, A1–A6) sunumu
   * KAPATMAZ — sunum kimliği QR'da açık olduğundan yakındaki biri anlamsız bir gövdeyle gerçek kullanıcının sunumunu düşüremesin.
   */
  used: boolean;
  /** Sahiplik kanıtına ulaşmadan başarısız olan yanıt sayısı; `MAX_RESPONSE_ATTEMPTS` dolunca sunum kapanır. */
  attempts: number;
  /** Son başarısız (tüketmeyen) yanıtın adımı ve nedeni — bekleyen sunumun durumunda RP'ye gösterilir; kişisel veri yok. */
  lastAttempt?: { failed_step: string | null; failed_reason: string; at: number };
  /** Bir yanıt şu anda doğrulanıyor (await sırasında ikinci yanıt işlenmez; tek kullanım kuralı — PV10). */
  busy?: boolean;
  trace: TraceEntry[];
  result?: VerificationResult;
  resultAt?: number;
  claims?: Record<string, unknown> | null;
  showKey: string;
  /** D11: örnek site bu sunumla bir oturum açtı (tek kullanım). */
  consumedBySite?: boolean;
  /** ADR-0017 K2: sunumu açan RP (client_id). Yoksa eski yol (demo; RP beyanısız). */
  owner?: string;
  /** ADR-0017 K4: tarayıcının yalnızca DURUM okuyabildiği jeton (değer okuyamaz — HV4). */
  statusToken: string;
  /** ADR-0017 K3: değerler okunduysa zamanı (bir kez okunur). */
  claimsReadAt?: number;
  /** Tarayıcı Digital Credentials API'si: isteği yapacak sayfanın kökeni (expected_origins; mdoc oturum özetine girer). */
  dcApiOrigin?: string;
  /**
   * ISO/IEC 18013-7 Ek C (`org-iso-mdoc`, 0.6.0): aynı sunumun ikinci DC API isteği — HPKE alıcı anahtarı ve oturum dökümü
   * sunucuda kalır; tarayıcıya yalnız `dcApiRequest` gider.
   */
  mdocDc?: import("@tamga-network/verifier").MdocDcApiRequest;
}

/** Sahiplik kanıtına ulaşmayan yanıt denemesi sınırı; dolunca sunum REJECTED ile kapanır (sunum başına; hız sınırı ayrıca). */
export const MAX_RESPONSE_ATTEMPTS = 5;
export const SHOW_TTL_MS = 5 * 60 * 1000;
/** ADR-0017 K3 / HV3: okunmayan değerler sonuçtan en geç 5 dk sonra silinir. */
export const CLAIMS_TTL_MS = 5 * 60 * 1000;
const RETAIN_MS = 30 * 60 * 1000; // sonuçtan 30 dk sonra kayıt (ve claim değerleri) silinir
/** Bellekteki sunum üst sınırı: dolunca önce en eski yanıtsız (bekleyen) sunum, yoksa en eski kayıt atılır (taşma koruması). */
export const MAX_PRESENTATIONS = 10_000;

/** Sabit süreli karşılaştırma: uzunluk farklıysa eşit uzunlukta sahte karşılaştırma yapılır ve sonuç yanlış döner. */
export function sameKey(given: string, expected: string): boolean {
  const a = Buffer.from(given, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

export class PresentationStore {
  private map = new Map<string, Presentation>();
  constructor(private max = MAX_PRESENTATIONS) {}

  create(req: PresentationRequest, policy: Policy, firstTrace: TraceEntry, owner?: string): Presentation {
    const p: Presentation = {
      req,
      policy,
      createdAt: Date.now(),
      used: false,
      attempts: 0,
      trace: [firstTrace],
      showKey: randomBytes(12).toString("base64url"),
      statusToken: randomBytes(16).toString("base64url"),
      ...(owner ? { owner } : {}),
    };
    this.sweep();
    while (this.map.size >= this.max) this.evictOne();
    this.map.set(req.presentationId, p);
    return p;
  }

  get(id: string) {
    this.sweep();
    return this.map.get(id);
  }

  /** OpenID4VP hata yanıtı (`error` + `state`) şifreli değildir ve `kid` taşımaz: sunum `state` ile bulunur (yalnız bekleyenler). */
  byState(state: string) {
    this.sweep();
    for (const p of this.map.values()) if (!p.used && sameKey(state, p.req.state)) return p;
    return undefined;
  }

  /** ADR-0017 K3: değerleri BİR KEZ verir ve bellekten siler; okunmuşsa ya da süresi geçtiyse "gone". */
  takeClaims(p: Presentation, now = Date.now()): Record<string, unknown> | null | "gone" {
    if (p.claimsReadAt || (p.resultAt && now - p.resultAt > CLAIMS_TTL_MS)) return "gone";
    const c = p.claims ?? null;
    delete p.claims;
    p.claimsReadAt = now;
    return c;
  }

  /** Kontrol görünümü: anahtar doğru (sabit süreli karşılaştırma) ve sonuç 5 dk'dan taze ise. */
  showAllowed(p: Presentation, key: string | undefined, now = Date.now()) {
    return !!key && sameKey(key, p.showKey) && !!p.resultAt && now - p.resultAt <= SHOW_TTL_MS;
  }

  size() {
    return this.map.size;
  }

  /** Map ekleme sırasını korur: ilk yanıtsız sunum en eskisidir; hepsi yanıtlıysa en eski kayıt. */
  private evictOne() {
    for (const [id, p] of this.map)
      if (!p.result) {
        this.map.delete(id);
        return;
      }
    const first = this.map.keys().next();
    if (!first.done) this.map.delete(first.value);
  }

  private sweep(now = Date.now()) {
    for (const [id, p] of this.map) {
      const expiredUnanswered = !p.result && p.req.expiresAt * 1000 + RETAIN_MS < now;
      const retainedResult = p.resultAt && now - p.resultAt > RETAIN_MS;
      if (expiredUnanswered || retainedResult) this.map.delete(id);
      else if (p.claims && p.resultAt && now - p.resultAt > CLAIMS_TTL_MS) delete p.claims; // HV3
    }
  }
}
