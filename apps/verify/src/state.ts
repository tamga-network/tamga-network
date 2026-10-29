/**
 * Sunum durumu (bellekte; demo). Kişisel veri: yalnızca `claims` (ayrı uçtan, AP3) — süresi dolunca silinir.
 * `showKey`: kontrol görünümü bağlantısı için rastgele anahtar (ADR-0012 C); sonuçtan sonra 5 dk geçerli.
 * Çekim dalları ve tek kullanım kilidi `@tamga-network/verifier` `BranchSet` / `BranchRegistry` (ADR-0067; kurumun belge verme
 * servisiyle aynı birim).
 */
import { randomBytes, timingSafeEqual } from "node:crypto";
import {
  BranchRegistry,
  type Branch,
  type BranchSet,
  type Policy,
  type PresentationSession,
  type VerificationResult,
} from "@tamga-network/verifier";

export type { Branch };

export interface TraceEntry {
  t: number;
  step: string;
  detail?: string;
}

export interface Presentation {
  req: PresentationSession;
  policy: Policy;
  createdAt: number;
  /**
   * ADR-0067 çekim dalları ve tek kullanım kilidi. `branches.used`: sunum tüketildi — yanıt sahiplik kanıtına (A6 / Z1) kadar geçti,
   * ya tek çekimli sunumda kişi reddetti (PV5) ya da o dalın deneme sınırı doldu (RQ2, RQ4). `branches.busy`: bir yanıt işleniyor
   * (PV10). `branches.attempts`: sahiplik kanıtına ulaşmadan başarısız olan (çözülmüş) yanıtların toplamı — durum API'sindeki
   * `attempts`. Çözülemeyen gövde deneme sayılmaz (RQ4): sunum kimliği QR'da açık, yakındaki biri gerçek kullanıcının sunumunu
   * düşüremesin.
   */
  branches: BranchSet;
  /** Son başarısız (tüketmeyen) yanıtın adımı ve nedeni — bekleyen sunumun durumunda RP'ye gösterilir; kişisel veri yok. */
  lastAttempt?: { failed_step: string | null; failed_reason: string; at: number };
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
 * Sahiplik kanıtına ulaşmayan (çözülmüş) yanıt denemesi sınırı — çekim dalı başına (dolunca dal kapanır; sunum yalnız tek çekimliyse
 * REJECTED olur, ADR-0067 RQ4) ve DC API yolu için sunum başına. Hız sınırı ayrıca. Dal sınırları paketin `BRANCH_LIMITS`'i.
 */
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
  /** ADR-0067: bütün sunumların çekim dalları — `state` özetinden dala arama ve ortak dal bütçesi (bellek tavanı). */
  readonly registry: BranchRegistry;
  constructor(
    private max = MAX_PRESENTATIONS,
    maxBranches?: number,
  ) {
    this.registry = new BranchRegistry(maxBranches ? { maxBranches } : {});
  }

  create(
    req: PresentationSession,
    policy: Policy,
    firstTrace: TraceEntry,
    owner: string | undefined,
    branches: BranchSet,
  ): Presentation {
    const p: Presentation = {
      req,
      policy,
      createdAt: Date.now(),
      branches,
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
   * sunumlar; ADR-0067 — `state` dal başınadır ve yalnız o dalın istek nesnesinde geçer). Arama `state` özetiyle (doğrusal tarama
   * yok), eşitlik sabit süreli. DC API nesnesinin `state`'i dal değildir.
   */
  byState(state: unknown): { p: Presentation; branch: Branch } | undefined {
    this.sweep();
    const hit = this.registry.byState(state);
    const p = hit && this.map.get(hit.set.presentationId);
    return p && hit && p.branches === hit.set ? { p, branch: hit.branch } : undefined;
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
        this.drop(id, p);
        return;
      }
    const first = this.map.entries().next();
    if (!first.done) this.drop(first.value[0], first.value[1]);
  }

  /** Sunum bellekten çıkar; dalları ortak kayıttan da (bütçe ve `state` araması). */
  private drop(id: string, p: Presentation) {
    p.branches.dispose();
    this.map.delete(id);
  }

  private sweep(now = Date.now()) {
    for (const [id, p] of this.map) {
      const expiredUnanswered = !p.result && p.req.expiresAt * 1000 + RETAIN_MS < now;
      const retainedResult = p.resultAt && now - p.resultAt > RETAIN_MS;
      if (expiredUnanswered || retainedResult) this.drop(id, p);
      else if (p.claims && p.resultAt && now - p.resultAt > CLAIMS_TTL_MS) delete p.claims; // HV3
    }
  }
}
