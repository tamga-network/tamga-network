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
 *
 * 0.8.3: denetim kaydın İÇİNE de bakar. Önceki sürümde olup yenisinde olmayan kök CA, şema (ülke listesinde `national_schemas`,
 * LOTL'da `schemas`) ve — listede KALAN kayıtlarda — kullanım (`scopes`), şema yetkisi (`schema_authorizations`) ve durum geçmişi
 * satırı (`status_history`) de sayılır; biri eksikse yayın aynı kuralla durur. Bunlar çıkarma kaydında isteğe bağlı sayılardır
 * (`root_cas`, `schemas`, `scopes`, `schema_authorizations`, `status_history`; yazılmamışsa 0) ve birebir tutmalıdır. Tümüyle
 * çıkan kaydın kullanımları ve geçmişi ayrıca sayılmaz (kayıt sayısı onları kapsar).
 */
export interface RemovalCounts {
  issuers: number;
  relying_parties: number;
  terminal_groups: number;
  /** aşağıdakiler yalnız sıfırdan büyükse bulunur (çıkarma kaydında yazılmamışsa 0 sayılır) */
  root_cas?: number;
  schemas?: number;
  scopes?: number;
  schema_authorizations?: number;
  status_history?: number;
}
const DETAIL_KEYS = ["root_cas", "schemas", "scopes", "schema_authorizations", "status_history"] as const;
const DETAIL_TR = {
  root_cas: "kök CA",
  schemas: "şema",
  scopes: "kullanım",
  schema_authorizations: "şema yetkisi",
  status_history: "durum geçmişi satırı",
} as const;
const DETAIL_EN = {
  root_cas: "root CA(s)",
  schemas: "schema(s)",
  scopes: "scope(s)",
  schema_authorizations: "schema authorization(s)",
  status_history: "status history row(s)",
} as const;

export interface ApprovedRemoval extends RemovalCounts {
  /** liste dosyası adı (`tl-tr`, `lotl`) */
  list: string;
  /** kararın tarihi (YYYY-AA-GG) */
  date: string;
  /** CHANGELOG'a yazılacak kısa, adsız gerekçe (İngilizce) */
  note: string;
}

type HistoryRow = { status?: string; since?: string };
interface ListRecords {
  root_cas?: Array<{ ca_id?: string; status_history?: HistoryRow[] }>;
  issuers?: Array<{
    issuer_id?: string;
    status_history?: HistoryRow[];
    schema_authorizations?: Array<{ schema_id?: string; vct?: string; valid_from?: string }>;
  }>;
  relying_parties?: Array<{
    rp_id?: string;
    dns_name?: string;
    terminal_groups?: Array<{ group_id?: string }>;
    scopes?: Array<{ scope_id?: string }>;
    status_history?: HistoryRow[];
  }>;
  /** ülke listesi */
  national_schemas?: Array<{ schema_id?: string }>;
  /** LOTL */
  schemas?: Array<{ schema_id?: string }>;
}

// doğrulayıcının kalıcı kimliği alan adıdır (ADR-0034): sertifika yenilemesi (`rp_id` değişir) çıkarma sayılmaz
const rpKey = (r: { rp_id?: string; dns_name?: string }) => String(r.dns_name ?? r.rp_id).toLowerCase();
const ids = (l: ListRecords | null | undefined) => ({
  issuers: new Set((l?.issuers ?? []).map((i) => String(i.issuer_id))),
  rps: new Set((l?.relying_parties ?? []).map(rpKey)),
  groups: new Set((l?.relying_parties ?? []).flatMap((r) => (r.terminal_groups ?? []).map((g) => String(g.group_id)))),
  schemas: new Set([...(l?.national_schemas ?? []), ...(l?.schemas ?? [])].map((s) => String(s.schema_id))),
});
const historyKeys = (h: HistoryRow[] | undefined) => (h ?? []).map((x) => `${String(x.status)}|${String(x.since)}`);
/** Önceki sürümdeki satırlardan yenisinde bulunmayanların sayısı (aynı satır iki kez varsa iki kez aranır). */
function missing(prevKeys: string[], nextKeys: string[]): number {
  const left = new Map<string, number>();
  for (const k of nextKeys) left.set(k, (left.get(k) ?? 0) + 1);
  let n = 0;
  for (const k of prevKeys) {
    const c = left.get(k) ?? 0;
    if (c > 0) left.set(k, c - 1);
    else n++;
  }
  return n;
}

/** Önceki yayımlanmış listede olup yenisinde olmayan kayıtların sayısı (önceki liste yoksa hepsi 0). */
export function removedRecords(prev: ListRecords | null | undefined, next: ListRecords): RemovalCounts {
  if (!prev) return { issuers: 0, relying_parties: 0, terminal_groups: 0 };
  const a = ids(prev);
  const b = ids(next);
  const gone = (x: Set<string>, y: Set<string>) => [...x].filter((v) => !y.has(v)).length;
  // kaydın içi: yalnız iki sürümde de bulunan kayıtlarda (tümüyle çıkan kayıt yukarıdaki sayılarla kapsanır)
  const detail = {
    root_cas: 0,
    schemas: gone(a.schemas, b.schemas),
    scopes: 0,
    schema_authorizations: 0,
    status_history: 0,
  };
  const caNext = new Map((next.root_cas ?? []).map((c) => [String(c.ca_id), c]));
  for (const c of prev.root_cas ?? []) {
    const n = caNext.get(String(c.ca_id));
    if (!n) detail.root_cas++;
    else detail.status_history += missing(historyKeys(c.status_history), historyKeys(n.status_history));
  }
  type Iss = NonNullable<ListRecords["issuers"]>[number];
  const authKeys = (i: Iss) =>
    (i.schema_authorizations ?? []).map((x) => `${String(x.schema_id ?? x.vct)}|${String(x.valid_from)}`);
  const issNext = new Map((next.issuers ?? []).map((i) => [String(i.issuer_id), i]));
  for (const i of prev.issuers ?? []) {
    const n = issNext.get(String(i.issuer_id));
    if (!n) continue;
    detail.status_history += missing(historyKeys(i.status_history), historyKeys(n.status_history));
    detail.schema_authorizations += missing(authKeys(i), authKeys(n));
  }
  const rpNext = new Map((next.relying_parties ?? []).map((r) => [rpKey(r), r]));
  for (const r of prev.relying_parties ?? []) {
    const n = rpNext.get(rpKey(r));
    if (!n) continue;
    detail.status_history += missing(historyKeys(r.status_history), historyKeys(n.status_history));
    detail.scopes += missing(
      (r.scopes ?? []).map((s) => String(s.scope_id)),
      (n.scopes ?? []).map((s) => String(s.scope_id)),
    );
  }
  return {
    issuers: gone(a.issuers, b.issuers),
    relying_parties: gone(a.rps, b.rps),
    terminal_groups: gone(a.groups, b.groups),
    ...Object.fromEntries(DETAIL_KEYS.filter((k) => detail[k] > 0).map((k) => [k, detail[k]])),
  };
}

export const anyRemoved = (c: RemovalCounts) =>
  c.issuers + c.relying_parties + c.terminal_groups + DETAIL_KEYS.reduce((n, k) => n + (c[k] ?? 0), 0) > 0;

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
      DETAIL_KEYS.every((k) => (r[k] ?? 0) === (counts[k] ?? 0)) &&
      typeof r.note === "string" &&
      /^[\x20-\x7e]{8,200}$/.test(r.note) &&
      typeof r.date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(r.date),
  );
  const details = DETAIL_KEYS.filter((k) => (counts[k] ?? 0) > 0);
  if (!hit)
    throw new Error(
      `TL2: ${list} — önceki yayımlanmış sürümdeki kayıtlar yeni listede yok (belge veren ${counts.issuers}, doğrulayıcı ` +
        `${counts.relying_parties}, kapı grubu ${counts.terminal_groups}` +
        details.map((k) => `, ${DETAIL_TR[k]} ${counts[k]}`).join("") +
        `). Kayıt silinmez: durum değişikliği için status / ` +
        `rp-status / end-use kullanın. Çıkarma bilerek yapılıyorsa kayıt defterine (removals.json) sayıları birebir tutan onaylı ` +
        `bir çıkarma kaydı ekleyin — DURDU`,
    );
  return (
    `records removed from ${list}: ${counts.issuers} issuer(s), ${counts.relying_parties} relying part(y/ies), ` +
    `${counts.terminal_groups} terminal group(s)` +
    details.map((k) => `, ${counts[k]} ${DETAIL_EN[k]}`).join("") +
    ` — ${hit.note} (decision ${hit.date}); earlier list versions remain in the archive`
  );
}
