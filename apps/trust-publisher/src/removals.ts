/**
 * Listeden kayıt çıkarma denetimi (SPEC-TRUST-0001 TL2: kayıt silinmez — durum `status_history`'ye eklenir).
 *
 * Yayıncı her yayında yeni ülke listesini bir önceki yayımlanmış sürümle karşılaştırır. Önceki sürümde olup yenisinde olmayan
 * bir belge veren, doğrulayıcı ya da kapı grubu varsa yayın DURUR — kaynaktan yanlışlıkla silinen kayıt sessizce yayından
 * kalkmasın. Tek istisna, kayıt defterindeki `removals.json` dosyasında AÇIKÇA yazılmış, sayıları birebir tutan bir çıkarma
 * kaydıdır (proje yönetimi kararıyla; ör. pilot öncesi sınama döneminden kalan, hiçbir gerçek kurumun kullanmadığı test
 * kayıtları). O zaman yayın yapılır ve herkese açık CHANGELOG'a adsız bir satır yazılır; eski liste sürümleri arşivde kalır.
 * Çıkarma kaydı kimlik ya da ad taşımaz: yalnız liste, tarih, sayılar ve kısa gerekçe.
 * Sandbox'ta uygulanmaz (test kurumları orada her gece kaldırılır — ADR-0041 TI5).
 */
export interface RemovalCounts {
  issuers: number;
  relying_parties: number;
  terminal_groups: number;
}
export interface ApprovedRemoval extends RemovalCounts {
  /** liste dosyası adı (`tl-tr`) */
  list: string;
  /** kararın tarihi (YYYY-AA-GG) */
  date: string;
  /** CHANGELOG'a yazılacak kısa, adsız gerekçe (İngilizce) */
  note: string;
}

interface ListRecords {
  issuers?: Array<{ issuer_id?: string }>;
  relying_parties?: Array<{ rp_id?: string; dns_name?: string; terminal_groups?: Array<{ group_id?: string }> }>;
}

const ids = (l: ListRecords | null | undefined) => ({
  issuers: new Set((l?.issuers ?? []).map((i) => String(i.issuer_id))),
  // doğrulayıcının kalıcı kimliği alan adıdır (ADR-0034): sertifika yenilemesi (`rp_id` değişir) çıkarma sayılmaz
  rps: new Set((l?.relying_parties ?? []).map((r) => String(r.dns_name ?? r.rp_id).toLowerCase())),
  groups: new Set((l?.relying_parties ?? []).flatMap((r) => (r.terminal_groups ?? []).map((g) => String(g.group_id)))),
});

/** Önceki yayımlanmış listede olup yenisinde olmayan kayıtların sayısı (önceki liste yoksa hepsi 0). */
export function removedRecords(prev: ListRecords | null | undefined, next: ListRecords): RemovalCounts {
  if (!prev) return { issuers: 0, relying_parties: 0, terminal_groups: 0 };
  const a = ids(prev);
  const b = ids(next);
  const gone = (x: Set<string>, y: Set<string>) => [...x].filter((v) => !y.has(v)).length;
  return {
    issuers: gone(a.issuers, b.issuers),
    relying_parties: gone(a.rps, b.rps),
    terminal_groups: gone(a.groups, b.groups),
  };
}

export const anyRemoved = (c: RemovalCounts) => c.issuers + c.relying_parties + c.terminal_groups > 0;

/**
 * Çıkarma varsa onaylı kaydı bulur ve CHANGELOG satırını döndürür; çıkarma yoksa null. Onaylı, sayıları birebir tutan kayıt yoksa
 * hata (yayın durur).
 */
export function removalChangelogLine(list: string, counts: RemovalCounts, approved: unknown): string | null {
  if (!anyRemoved(counts)) return null;
  const rows = (Array.isArray(approved) ? approved : []) as Array<Partial<ApprovedRemoval>>;
  const hit = rows.find(
    (r) =>
      r.list === list &&
      r.issuers === counts.issuers &&
      r.relying_parties === counts.relying_parties &&
      r.terminal_groups === counts.terminal_groups &&
      typeof r.note === "string" &&
      /^[\x20-\x7e]{8,200}$/.test(r.note) &&
      typeof r.date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(r.date),
  );
  if (!hit)
    throw new Error(
      `TL2: ${list} — önceki yayımlanmış sürümdeki kayıtlar yeni listede yok (belge veren ${counts.issuers}, doğrulayıcı ` +
        `${counts.relying_parties}, kapı grubu ${counts.terminal_groups}). Kayıt silinmez: durum değişikliği için status / ` +
        `rp-status / end-use kullanın. Çıkarma bilerek yapılıyorsa kayıt defterine (removals.json) sayıları birebir tutan onaylı ` +
        `bir çıkarma kaydı ekleyin — DURDU`,
    );
  return (
    `records removed from ${list}: ${counts.issuers} issuer(s), ${counts.relying_parties} relying part(y/ies), ` +
    `${counts.terminal_groups} terminal group(s) — ${hit.note} (decision ${hit.date}); earlier list versions remain in the archive`
  );
}
