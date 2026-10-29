/**
 * Sunum durumu (bellekte; demo). Kişisel veri: yalnızca `claims` (ayrı uçtan, AP3) — süresi dolunca silinir.
 * `showKey`: kontrol görünümü bağlantısı için rastgele anahtar (ADR-0012 C); sonuçtan sonra 5 dk geçerli.
 */
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Policy, PresentationRequest, RequestBranch, VerificationResult } from "@tamga-network/verifier";

export interface TraceEntry {
  t: number;
  step: string;
  detail?: string;
}

/**
 * ADR-0067: `request_uri`'nin bir çekimi (çekim dalı). Ret ya da deneme sınırı yalnız bu dalı kapatır; sunumun bütünü ancak tek
 * dalı varsa ve o dal kapandıysa REJECTED olur (FB3). Dal bilgisi iç durumdur; durum API'sinde görünmez.
 */
export interface Branch extends RequestBranch {
  /** Bu dalda sahiplik kanıtına ulaşmadan başarısız olan (çözülmüş) yanıt sayısı. */
  attempts: number;
  /** Dal kapandı: kişi reddetti (`declined`) ya da deneme sınırı doldu (`attempts`); kapalı dala yanıt kabul edilmez. */
  closed?: "declined" | "attempts";
}

export interface Presentation {
  req: PresentationRequest;
  policy: Policy;
  createdAt: number;
  /**
   * Sunum tüketildi: ya cüzdanın yanıtı sahiplik kanıtına (A6 / Z1) kadar geçti ve sonuç yazıldı, ya tek çekim dalı olan sunumda
   * kişi reddetti (PV5) ya da o dalın deneme sınırı doldu (ADR-0067 FB3). Öncesindeki başarısız yanıtlar (state uyuşmazlığı, boş
   * vp_token, A1–A6) sunumu KAPATMAZ; çözülemeyen gövde deneme bile sayılmaz (FB4) — sunum kimliği QR'da açık olduğundan
   * yakındaki biri gerçek kullanıcının sunumunu düşüremesin.
   */
  used: boolean;
  /**
   * Sahiplik kanıtına ulaşmadan başarısız olan (çözülmüş) yanıtların toplamı (bütün dallar + DC API yolu) — durum API'sindeki
   * `attempts`. Kapanma dal başına (`Branch.attempts`) ve DC API yolu için `dcAttempts` ile sayılır.
   */
  attempts: number;
  /** DC API yollarında (dc_api.jwt, Ek C) başarısız denemeler; `MAX_RESPONSE_ATTEMPTS` dolunca sunum kapanır. */
  dcAttempts: number;
  /** ADR-0067 K1: `request_uri`'nin çekimleri (en çok `MAX_BRANCHES`). */
  branches: Branch[];
  /** Yeni çekim dalı üretir (sunumun imzacısı, DCQL'i ve kayıt sertifikasıyla); `walletNonce` §5.10. */
  mintBranch?: (walletNonce?: string) => Promise<RequestBranch>;
  /** Şu anda imzalanmakta olan çekim sayısı (eşzamanlı çekimler dal sınırını aşmasın). */
  minting?: number;
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

/**
 * Sahiplik kanıtına ulaşmayan (çözülmüş) yanıt denemesi sınırı — çekim dalı başına (dolunca dal kapanır; sunum yalnız tek dallıysa
 * REJECTED olur, ADR-0067 FB3) ve DC API yolu için sunum başına. Hız sınırı ayrıca.
 */
export const MAX_RESPONSE_ATTEMPTS = 5;
/** ADR-0067 FB5: sunum başına en çok çekim dalı; sonrası 429 (var olan dallar etkilenmez). */
export const MAX_BRANCHES = 10;
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
      dcAttempts: 0,
      branches: [],
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

  /**
   * OpenID4VP şifresiz hata yanıtı (`error` + `state`) `kid` taşımaz: sunum ve çekim dalı `state` ile bulunur (yalnız bekleyen
   * sunumlar; ADR-0067 — `state` dal başınadır ve yalnız o dalın istek nesnesinde geçer). DC API nesnesinin `state`'i dal değildir.
   */
  byState(state: string): { p: Presentation; branch: Branch } | undefined {
    this.sweep();
    for (const p of this.map.values())
      if (!p.used) for (const b of p.branches) if (sameKey(state, b.state)) return { p, branch: b };
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
