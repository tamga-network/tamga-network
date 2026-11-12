/**
 * Listeden kayıt çıkarma denetimi (SPEC-TRUST-0001 TL2: kayıt silinmez — durum `status_history`'ye eklenir).
 *
 * Yayıncı her yayında yeni ülke listesini bir önceki yayımlanmış sürümle karşılaştırır. Önceki sürümde olup yenisinde olmayan
 * bir belge veren, doğrulayıcı ya da kapı grubu varsa yayın DURUR — kaynaktan yanlışlıkla silinen kayıt sessizce yayından
 * kalkmasın. Tek istisna, kayıt defterindeki `removals.json` dosyasında AÇIKÇA yazılmış, sayıları birebir tutan bir çıkarma
 * kaydıdır (proje yönetimi kararıyla; ör. pilot öncesi sınama döneminden kalan, hiçbir gerçek kurumun kullanmadığı test
 * kayıtları). O zaman yayın yapılır ve herkese açık CHANGELOG'a adsız bir satır yazılır; eski liste sürümleri arşivde kalır.
 * Çıkarma kaydı kimlik ya da ad taşımaz: yalnız liste, tarih, sayılar ve kısa gerekçe.
 * İstisnanın sınırı ADR-0081'dedir (RR1–RR4): yalnız sınama kaydı, ilk katılımcı kurum gerçek ağın listesine girmeden önce; gerçek
 * bir kurumun kaydı için bu yol kullanılmaz. Bu koşulu yayıncı bilemez — karar düzeyinde denetlenir; yayıncı sayıları denetler.
 * Sandbox'ta uygulanmaz (test kurumları orada her gece kaldırılır — ADR-0041 TI5).
 *
 * 0.8.3: denetim kaydın İÇİNE de bakar. Önceki sürümde olup yenisinde olmayan kök CA, şema (ülke listesinde `national_schemas`,
 * LOTL'da `schemas`) ve — listede KALAN kayıtlarda — kullanım (`scopes`), şema yetkisi (`schema_authorizations`) ve durum geçmişi
 * satırı (`status_history`) de sayılır; biri eksikse yayın aynı kuralla durur. Bunlar çıkarma kaydında isteğe bağlı sayılardır
 * (`root_cas`, `schemas`, `scopes`, `schema_authorizations`, `status_history`; yazılmamışsa 0) ve birebir tutmalıdır. Tümüyle
 * çıkan kaydın kullanımları ve geçmişi ayrıca sayılmaz (kayıt sayısı onları kapsar).
 *
 * 0.8.3 (ikinci inceleme):
 *  - Çıkarma kaydı TEK bir sürüm geçişine bağlıdır: `previous_version` (çıkarmadan önceki imzalı sürümün numarası; zorunlu) ve
 *    isteğe bağlı `previous_version_hash` (o sürümün `.jws` özeti). Yayıncı kaydı yalnız önceki yayımlanmış sürüm bu ise kabul
 *    eder; yayın yapılınca sürüm ilerler ve kayıt kendiliğinden geçersiz kalır (önce: aynı sayıda başka kaydın silinmesini de
 *    geçiriyordu).
 *  - Geçmiş satırları İÇERİKLERİYLE korunur: listede kalan kayıtta önceki sürümdeki her `status_history` satırı yeni listede
 *    aynen (kanonik karşılaştırma) bulunmalıdır — ör. `invalidates_from`'u değiştirilen satır silinmiş sayılır. Şema yetkisi
 *    satırı da aynen kalır; tek serbest değişiklik açık dönemin KAPATILMASIDIR (`valid_until`: yok/null → tarih). Kapanmış
 *    yetkinin yeniden açılması ya da bitişinin değiştirilmesi satırın silinmesi sayılır.
 *  - Sayılanlara eklendi: listede kalan belge verenin `delegate_keys` satırı (parmak izi + amaç) ve LOTL'da `national_lists`,
 *    `wallet_providers`, `external_lists` kayıtları (cüzdan sağlayıcının durum geçmişi satırları da).
 *  - Listede kalan kullanım (`scopes`) ve kapı grubu (`terminal_groups`) satırının GEÇERLİLİK alanları da korunur: başlangıç
 *    (`valid_from`) değişemez; bitiş (`valid_until`) yalnız açık dönemin kapatılması yönünde değişir — bitişi olmayan ya da
 *    bitişi henüz gelmemiş satıra daha erken bir bitiş yazılabilir (`end-use`, `rp-status REVOKED|RETIRED`, yeniden kayıt, devir).
 *    Bitişi geçmiş (kapanmış) satırın bitişi değiştirilemez; hiçbir satırın bitişi ileri alınamaz ya da kaldırılamaz (süre
 *    uzatma yok: yeni dönem yeni kimlikle yeni satırdır). Böyle değişmiş satır silinmiş sayılır (`scopes` / `terminal_groups`
 *    sayısına girer). Amaç metni, çeviriler, istenen alanlar, etiket, politika gibi açıklayıcı alanlar düzenlenebilir.
 *
 * 0.8.4 (bağımsız inceleme): "açık dönem" ve yeni bitişin alt sınırı ÖNCEKİ imzalı listenin yayın anına (`issued_at`) göredir,
 * yeni yayın anına göre değil.
 *  - Yeni bitiş, satırın başlangıcından (`valid_from`) ve önceki imzalı listenin yayın anından önce olamaz: önceki liste o satırı
 *    yayın anında açık diye imzaladı; bitişi daha eskiye (ör. 1970) yazmak o beyanı onaysız, geriye dönük değiştirirdi.
 *  - Dönem, bitişi önceki listenin yayın anından sonraysa açıktır. Önce yeni yayın anına bakılıyordu: 1 Aralık'ta bitecek satır
 *    30 Kasım'da `end-use` ile kapatılıp liste 2 Aralık'ta yayımlanınca satır "kapanmış" sayılıyor, yayın yersiz duruyordu.
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
  delegate_keys?: number;
  national_lists?: number;
  wallet_providers?: number;
  external_lists?: number;
}
const DETAIL_KEYS = [
  "root_cas",
  "schemas",
  "scopes",
  "schema_authorizations",
  "status_history",
  "delegate_keys",
  "national_lists",
  "wallet_providers",
  "external_lists",
] as const;
const DETAIL_TR = {
  root_cas: "kök CA",
  schemas: "şema",
  scopes: "kullanım",
  schema_authorizations: "şema yetkisi",
  status_history: "durum geçmişi satırı",
  delegate_keys: "yetkili anahtar",
  national_lists: "ülke listesi kaydı",
  wallet_providers: "cüzdan sağlayıcı",
  external_lists: "dış liste",
} as const;
const DETAIL_EN = {
  root_cas: "root CA(s)",
  schemas: "schema(s)",
  scopes: "scope(s)",
  schema_authorizations: "schema authorization(s)",
  status_history: "status history row(s)",
  delegate_keys: "delegate key(s)",
  national_lists: "national list entr(y/ies)",
  wallet_providers: "wallet provider(s)",
  external_lists: "external list(s)",
} as const;

export interface ApprovedRemoval extends RemovalCounts {
  /** liste dosyası adı (`tl-tr`, `lotl`) */
  list: string;
  /** kararın tarihi (YYYY-AA-GG) */
  date: string;
  /** CHANGELOG'a yazılacak kısa, adsız gerekçe (İngilizce) */
  note: string;
  /** çıkarmadan ÖNCEKİ imzalı sürümün numarası: kayıt yalnız bu sürümden sonraki yayında geçer */
  previous_version: number;
  /** isteğe bağlı: o sürümün `.jws` özeti (`sha256:…`, listedeki `previous_version_hash` ile aynı biçim); yazılmışsa tutmalıdır */
  previous_version_hash?: string;
}

/** Önceki yayımlanmış imzalı sürüm (yayıncının `prevPublished` çıktısı). */
export interface PreviousVersion {
  version: number;
  hash: string | null;
}

type HistoryRow = Record<string, unknown>;
/** kullanım ve kapı grubu satırının geçerlilik alanları (`RpScope`, `TerminalGroup` — `@tamga-network/trust`) */
interface Validity {
  valid_from?: string;
  valid_until?: string | null;
}
type AuthRow = Record<string, unknown>;
interface ListRecords {
  /** imzalı listenin yayın anı (önceki sürümde: geçerlilik karşılaştırmasının dayanağı) */
  issued_at?: string;
  root_cas?: Array<{ ca_id?: string; status_history?: HistoryRow[] }>;
  issuers?: Array<{
    issuer_id?: string;
    status_history?: HistoryRow[];
    schema_authorizations?: AuthRow[];
    delegate_keys?: Array<{ fingerprint_sha256?: string; purpose?: string }>;
  }>;
  relying_parties?: Array<{
    rp_id?: string;
    dns_name?: string;
    terminal_groups?: Array<{ group_id?: string } & Validity>;
    scopes?: Array<{ scope_id?: string } & Validity>;
    status_history?: HistoryRow[];
  }>;
  /** ülke listesi */
  national_schemas?: Array<{ schema_id?: string }>;
  /** LOTL */
  schemas?: Array<{ schema_id?: string }>;
  national_lists?: Array<{ state_code?: string }>;
  wallet_providers?: Array<{ provider_id?: string; status_history?: HistoryRow[] }>;
  external_lists?: Array<{ list_id?: string }>;
}

// doğrulayıcının kalıcı kimliği alan adıdır (ADR-0034): sertifika yenilemesi (`rp_id` değişir) çıkarma sayılmaz
const rpKey = (r: { rp_id?: string; dns_name?: string }) => String(r.dns_name ?? r.rp_id).toLowerCase();
const ids = (l: ListRecords | null | undefined) => ({
  issuers: new Set((l?.issuers ?? []).map((i) => String(i.issuer_id))),
  rps: new Set((l?.relying_parties ?? []).map(rpKey)),
  groups: new Set((l?.relying_parties ?? []).flatMap((r) => (r.terminal_groups ?? []).map((g) => String(g.group_id)))),
  schemas: new Set([...(l?.national_schemas ?? []), ...(l?.schemas ?? [])].map((s) => String(s.schema_id))),
});
/** Kanonik metin: anahtarlar sıralı (alan sırası değişikliği fark sayılmaz), değerler birebir. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .filter((k) => o[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}
// durum geçmişi satırı tam içeriğiyle tanınır (durum, tarih, gerekçe, `invalidates_from`, …)
const historyKeys = (h: HistoryRow[] | undefined) => (h ?? []).map(canonical);
/**
 * Şema yetkisi satırları: önceki sürümdeki her satır yenisinde aynen bulunmalı; tek serbest değişiklik açık dönemin kapatılması
 * (`valid_until` yok/null → tarih; `authorize --revoke`, `status REVOKED|RETIRED`). Eksik (ya da başka türlü değişmiş) satır sayısı.
 */
function missingAuthorizations(prev: AuthRow[] | undefined, next: AuthRow[] | undefined): number {
  const split = (r: AuthRow) => {
    const { valid_until, ...rest } = r;
    return { base: canonical(rest), until: valid_until ?? null };
  };
  const left = (next ?? []).map(split);
  const take = (ok: (n: { base: string; until: unknown }) => boolean) => {
    const k = left.findIndex(ok);
    if (k >= 0) left.splice(k, 1);
    return k >= 0;
  };
  // önce birebir eşleşenler ayrılır; kalan AÇIK satırlar kapatılmış karşılıklarıyla eşleşir
  const changed = (prev ?? []).map(split).filter((p) => !take((n) => n.base === p.base && n.until === p.until));
  return changed.filter((p) => !(p.until === null && take((n) => n.base === p.base && typeof n.until === "string")))
    .length;
}
/** İki tarih aynı an mı (yazım farkı — `…00Z` / `…00.000Z` — fark sayılmaz); tarih olarak okunamıyorsa metin birebir. */
function sameInstant(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a == null || b == null) return a == null && b == null;
  const x = Date.parse(a);
  const y = Date.parse(b);
  return Number.isNaN(x) || Number.isNaN(y) ? a === b : x === y;
}
/**
 * Listede kalan kullanım / kapı grubu satırının geçerlilik alanları korunmuş mu: başlangıç aynı; bitiş aynı ya da AÇIK dönem
 * (bitiş yok, ya da önceki imzalı listenin yayın anı `prevAt`'ten sonra) daha erken bir tarihle kapatılmış. Yeni bitiş
 * başlangıçtan ve `prevAt`'ten önce olamaz (geriye dönük yeniden yazım yok). Kapanmış dönem değişmez; bitiş ileri alınamaz,
 * kaldırılamaz.
 */
function validityKept(prev: Validity, next: Validity, prevAt: number): boolean {
  if (!sameInstant(prev.valid_from, next.valid_from)) return false;
  if (sameInstant(prev.valid_until, next.valid_until)) return true;
  if (next.valid_until == null) return false; // bitişi olan satır yeniden açılamaz
  const to = Date.parse(next.valid_until);
  if (Number.isNaN(to)) return false;
  // önceki liste satırı yayın anında açık diye imzaladı: bitiş o andan ve başlangıçtan geriye yazılamaz
  if (to < prevAt) return false;
  const from = prev.valid_from == null ? NaN : Date.parse(prev.valid_from);
  if (!Number.isNaN(from) && to < from) return false;
  if (prev.valid_until == null) return true; // açık dönem kapatıldı
  const was = Date.parse(prev.valid_until);
  return !Number.isNaN(was) && was > prevAt && to < was; // önceki yayında henüz bitmemiş dönem öne çekildi
}
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

/**
 * Önceki yayımlanmış listede olup yenisinde olmayan kayıtların sayısı (önceki liste yoksa hepsi 0). Kullanım ve kapı grubu
 * satırında "kapanmış dönem" ve yeni bitişin alt sınırı ÖNCEKİ imzalı listenin yayın anına göredir (`prev.issued_at`): bitişi o
 * andan önce ya da o an olan satırın bitişi değişmez; yeni bitiş o andan geriye yazılamaz. `prevPublishedAt` yalnız önceki listede
 * okunabilir `issued_at` yoksa kullanılır (imzalı listede hep vardır; varsayılan şimdi — en sıkı hâl).
 */
export function removedRecords(
  prev: ListRecords | null | undefined,
  next: ListRecords,
  prevPublishedAt: Date = new Date(),
): RemovalCounts {
  if (!prev) return { issuers: 0, relying_parties: 0, terminal_groups: 0 };
  const issuedAt = typeof prev.issued_at === "string" ? Date.parse(prev.issued_at) : NaN;
  const prevAt = Number.isNaN(issuedAt) ? prevPublishedAt.getTime() : issuedAt;
  const a = ids(prev);
  const b = ids(next);
  const gone = (x: Set<string>, y: Set<string>) => [...x].filter((v) => !y.has(v)).length;
  const keySet = <T>(rows: T[] | undefined, key: (r: T) => unknown) => new Set((rows ?? []).map((r) => String(key(r))));
  // kaydın içi: yalnız iki sürümde de bulunan kayıtlarda (tümüyle çıkan kayıt yukarıdaki sayılarla kapsanır)
  const detail = {
    root_cas: 0,
    schemas: gone(a.schemas, b.schemas),
    scopes: 0,
    schema_authorizations: 0,
    status_history: 0,
    delegate_keys: 0,
    // LOTL
    national_lists: gone(
      keySet(prev.national_lists, (n) => n.state_code),
      keySet(next.national_lists, (n) => n.state_code),
    ),
    wallet_providers: 0,
    external_lists: gone(
      keySet(prev.external_lists, (e) => e.list_id),
      keySet(next.external_lists, (e) => e.list_id),
    ),
  };
  const wpNext = new Map((next.wallet_providers ?? []).map((w) => [String(w.provider_id), w]));
  for (const w of prev.wallet_providers ?? []) {
    const n = wpNext.get(String(w.provider_id));
    if (!n) detail.wallet_providers++;
    else detail.status_history += missing(historyKeys(w.status_history), historyKeys(n.status_history));
  }
  const caNext = new Map((next.root_cas ?? []).map((c) => [String(c.ca_id), c]));
  for (const c of prev.root_cas ?? []) {
    const n = caNext.get(String(c.ca_id));
    if (!n) detail.root_cas++;
    else detail.status_history += missing(historyKeys(c.status_history), historyKeys(n.status_history));
  }
  type Iss = NonNullable<ListRecords["issuers"]>[number];
  // yetkili anahtar (ör. iptal listesi imzacısı) parmak izi + amaçla tanınır: durumu ve bitişi (`valid_to`) güncellenebilir, satır silinmez
  const delegateKeys = (i: Iss) =>
    (i.delegate_keys ?? []).map((k) => `${String(k.fingerprint_sha256)}|${String(k.purpose)}`);
  const issNext = new Map((next.issuers ?? []).map((i) => [String(i.issuer_id), i]));
  for (const i of prev.issuers ?? []) {
    const n = issNext.get(String(i.issuer_id));
    if (!n) continue;
    detail.status_history += missing(historyKeys(i.status_history), historyKeys(n.status_history));
    detail.schema_authorizations += missingAuthorizations(i.schema_authorizations, n.schema_authorizations);
    detail.delegate_keys += missing(delegateKeys(i), delegateKeys(n));
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
    // listede kalan kullanım: geçerlilik alanları değişmişse satır silinmiş sayılır
    const scopeNext = new Map((n.scopes ?? []).map((s) => [String(s.scope_id), s]));
    for (const s of r.scopes ?? []) {
      const k = scopeNext.get(String(s.scope_id));
      if (k && !validityKept(s, k, prevAt)) detail.scopes++;
    }
  }
  // listede kalan kapı grubu (kimlik bütün listede tektir — ADR-0069 TG1): aynı kural
  const groupNext = new Map(
    (next.relying_parties ?? []).flatMap((r) => (r.terminal_groups ?? []).map((g) => [String(g.group_id), g] as const)),
  );
  let groupsChanged = 0;
  for (const g of (prev.relying_parties ?? []).flatMap((r) => r.terminal_groups ?? [])) {
    const k = groupNext.get(String(g.group_id));
    if (k && !validityKept(g, k, prevAt)) groupsChanged++;
  }
  return {
    issuers: gone(a.issuers, b.issuers),
    relying_parties: gone(a.rps, b.rps),
    terminal_groups: gone(a.groups, b.groups) + groupsChanged,
    ...Object.fromEntries(DETAIL_KEYS.filter((k) => detail[k] > 0).map((k) => [k, detail[k]])),
  };
}

export const anyRemoved = (c: RemovalCounts) =>
  c.issuers + c.relying_parties + c.terminal_groups + DETAIL_KEYS.reduce((n, k) => n + (c[k] ?? 0), 0) > 0;

/**
 * Çıkarma varsa onaylı kaydı bulur ve CHANGELOG satırını döndürür; çıkarma yoksa null. Onaylı, sayıları birebir tutan VE bu sürüm
 * geçişine (önceki imzalı sürüm `prev`) yazılmış kayıt yoksa hata (yayın durur). Kayıt başka bir geçişte yeniden kullanılamaz.
 */
export function removalChangelogLine(
  list: string,
  counts: RemovalCounts,
  approved: unknown,
  prev: PreviousVersion | null | undefined,
): string | null {
  if (!anyRemoved(counts)) return null;
  const rows = (Array.isArray(approved) ? approved : []) as Array<Partial<ApprovedRemoval>>;
  const hit = rows.find(
    (r) =>
      r.list === list &&
      Number.isInteger(r.previous_version) &&
      r.previous_version === prev?.version &&
      (r.previous_version_hash === undefined || (prev?.hash != null && r.previous_version_hash === prev.hash)) &&
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
        `rp-status / end-use kullanın; geçmiş satırları (status_history, kapanmış şema yetkisi) değiştirilmez; kullanım ve kapı ` +
        `grubunun başlangıcı değişmez, bitişi yalnız öne çekilir (uzatma yerine yeni kimlikle yeni satır). Çıkarma bilerek ` +
        `yapılıyorsa kayıt defterine (removals.json) sayıları birebir tutan ve bu geçişe yazılmış (previous_version: ` +
        `${prev?.version ?? "?"}) onaylı bir çıkarma kaydı ekleyin; eski bir çıkarma kaydı yeniden kullanılamaz — DURDU`,
    );
  return (
    `records removed from ${list}: ${counts.issuers} issuer(s), ${counts.relying_parties} relying part(y/ies), ` +
    `${counts.terminal_groups} terminal group(s)` +
    details.map((k) => `, ${counts[k]} ${DETAIL_EN[k]}`).join("") +
    ` — ${hit.note} (decision ${hit.date}); earlier list versions remain in the archive`
  );
}
