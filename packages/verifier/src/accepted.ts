/**
 * İç modül (paket dışına açılmaz; `index.ts` dışa aktarmaz) — ADR-0056 K9: bu süreçte `verifyPresentation`'ın ürettiği KABUL
 * çıktıları. Yalnız bunlar geçiş kartına (`PassRegistry.issue`) dönüşebilir: elle kurulmuş `{ outcome: "ACCEPTED" }` nesnesi
 * ya da kopyalanmış/değiştirilmiş çıktı kabul edilmez. Doğrulanan sunum dizesi çıktıyla birlikte saklanır (kart anahtarı
 * doğrulanan sunumdan alınır, çağıranın verdiği başka bir sunumdan değil).
 */
import type { VerifyInput, VerifyOutput } from "./verify.js";

export interface AcceptedPresentation {
  presentation: string;
  format: VerifyInput["format"];
}

const accepted = new WeakMap<object, AcceptedPresentation>();

/** `verifyPresentation` kabul çıktısını kaydeder. */
export function registerAccepted(out: VerifyOutput, info: AcceptedPresentation): void {
  accepted.set(out, info);
}

/** Çıktı bu süreçte `verifyPresentation`'dan ACCEPTED olarak mı çıktı? Çıktıysa doğrulanan sunum, değilse null. */
export function acceptedPresentationOf(out: unknown): AcceptedPresentation | null {
  if (!out || typeof out !== "object") return null;
  if ((out as VerifyOutput).result?.outcome !== "ACCEPTED") return null;
  return accepted.get(out) ?? null;
}
