/**
 * Sunum durumu (bellekte; demo). Kişisel veri: yalnızca `claims` (ayrı uçtan, AP3) — süresi dolunca silinir.
 * `showKey`: kontrol görünümü bağlantısı için rastgele anahtar (ADR-0012 C); sonuçtan sonra 5 dk geçerli.
 */
import { randomBytes } from "node:crypto";
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
  used: boolean;
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
}

export const SHOW_TTL_MS = 5 * 60 * 1000;
/** ADR-0017 K3 / HV3: okunmayan değerler sonuçtan en geç 5 dk sonra silinir. */
export const CLAIMS_TTL_MS = 5 * 60 * 1000;
const RETAIN_MS = 30 * 60 * 1000; // sonuçtan 30 dk sonra kayıt (ve claim değerleri) silinir
/** Bellekteki sunum üst sınırı: dolunca önce en eski yanıtsız (bekleyen) sunum, yoksa en eski kayıt atılır (taşma koruması). */
export const MAX_PRESENTATIONS = 10_000;

export class PresentationStore {
  private map = new Map<string, Presentation>();
  constructor(private max = MAX_PRESENTATIONS) {}

  create(req: PresentationRequest, policy: Policy, firstTrace: TraceEntry, owner?: string): Presentation {
    const p: Presentation = {
      req,
      policy,
      createdAt: Date.now(),
      used: false,
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

  /** ADR-0017 K3: değerleri BİR KEZ verir ve bellekten siler; okunmuşsa ya da süresi geçtiyse "gone". */
  takeClaims(p: Presentation, now = Date.now()): Record<string, unknown> | null | "gone" {
    if (p.claimsReadAt || (p.resultAt && now - p.resultAt > CLAIMS_TTL_MS)) return "gone";
    const c = p.claims ?? null;
    delete p.claims;
    p.claimsReadAt = now;
    return c;
  }

  /** Kontrol görünümü: anahtar doğru ve sonuç 5 dk'dan taze ise. */
  showAllowed(p: Presentation, key: string | undefined, now = Date.now()) {
    return !!key && key === p.showKey && !!p.resultAt && now - p.resultAt <= SHOW_TTL_MS;
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
