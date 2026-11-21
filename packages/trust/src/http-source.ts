/**
 * ADR-0015 (D-TRUST-1) K2 — istemci güven kaynağı: listeleri HTTP'den toplu çeker (TS3: kullanıcıya bağlanabilir çağrı yok),
 * gömülü kök parmak iziyle (pin) doğrular ve `ListTrustSource` döndürür. Platformdan bağımsız: imza doğrulama `JwsVerifier`
 * olarak verilir; jose/node:fs yok. Ek istemci kuralları: istenen devletin listesi ACTIVE olmalı, bayat liste reddedilir,
 * oturum içinde daha önce görülen sürümden eski liste reddedilir (geri sarma — TL2).
 */
import {
  applyExternalListsWith,
  loadTrustSetWith,
  resetDefaultListVersionMemory,
  type JwsVerifier,
  type ListVersionMemory,
  type LoadReport,
} from "./loader.js";
import { b64ToBytes } from "./lote-reader.js";
import type { TrustStore } from "./store.js";
import { ListTrustSource } from "./trust-source.js";

export type HttpGet = (url: string) => Promise<{ status: number; text(): Promise<string> }>;

export class TrustListError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrustListError";
  }
}

const seen = new Map<string, { lotl: number; tl: number }>(); // taban|devlet → görülen en yüksek sürümler

/** Test/yeniden kurulum için oturum içi sürüm belleğini sıfırlar (yükleyicinin varsayılan TL2 belleği dahil — ADR-0056). */
export function resetListMonotonicity() {
  seen.clear();
  resetDefaultListVersionMemory();
}

/** Verilen başlangıç anından gerçek zamanla ilerleyen saat; başlangıç yoksa gerçek saat. */
function advancingClock(start: Date | undefined): () => Date {
  if (!start) return () => new Date();
  const base = start.getTime();
  const t0 = Date.now();
  return () => new Date(base + (Date.now() - t0));
}

export async function fetchListTrustSource(
  trustBase: string,
  http: HttpGet,
  opts: {
    rootFingerprints: string[];
    verifyJws: JwsVerifier;
    stateCode?: string;
    /**
     * 0.8.3: `stateCode`'a ek olarak yüklenecek ülke listeleri (ör. `["AZ", "KZ"]`). Ülkeler arası kurallar (aynı `dns_name`'in
     * iki listede görünmesi — ADR-0075) yalnız yüklü listeler arasında görülür; verilmezse TEK liste yüklenir ve bu kurallar
     * devreye giremez. Listelenen her ülkenin LOTL'da ACTIVE bir listesi olmalı ve hepsi doğrulanmalıdır; biri eksikse yükleme
     * `TrustListError` ile reddedilir: kod iki harfli değilse, ülke LOTL'da yoksa ya da listesi ACTIVE değilse (askıda), liste
     * alınamıyorsa. Sessizce daha az listeyle dönülmez — çağıran, kuralın işlediğini sanmasın.
     */
    additionalStates?: string[];
    /**
     * ADR-0093 K2 (0.9.0): `"all-active"` — LOTL'daki bütün ETKİN ülke listelerini de yükle. `stateCode` (ve `additionalStates`)
     * zorunludur; ötekiler isteğe bağlıdır: alınamayan, doğrulanamayan, geri sarılmış ya da süresi geçmiş bir liste yalnız o ülkenin
     * kurumlarını UNKNOWN yapar (UL2). İndirilecek dosyaları imzası henüz doğrulanmamış LOTL'dan seçer; hangi listenin SAYILACAĞINA
     * yükleyici imzası doğrulanmış LOTL'a göre karar verir. Verilmezse yalnız `stateCode` + `additionalStates`.
     */
    nationalLists?: "all-active";
    now?: Date;
    /** Çapa günlüğünü de yükle (doğrulayıcı sunucular: iptal listesi çapaları için gerekir). */
    anchors?: boolean;
    /**
     * ADR-0036: LOTL'daki dış listeleri de yükle. Önce yayıncının kopyası (`<base>/external/<list_id>.jws` ya da TL için `.xml`),
     * yoksa özgün adres.
     * İmza her iki durumda LOTL'da sabitlenmiş imzacıya karşı doğrulanır; kopya içeriği değiştiremez.
     */
    externalLists?: boolean;
    /**
     * Yayıncının kopyası yoksa dış listeyi özgün adresinden (`list_url`) doğrudan çek (varsayılan `true`). Gizlilik notu: doğrudan
     * çekmede dış listenin sunucusu (Tamga dışı bir işletmeci) istemcinin IP adresini ve çekme zamanını görür; istek kişiye ya da
     * belgeye bağlı değildir (toplu liste çekimi, TS3). `false`: yalnız yayıncının kopyası kullanılır, kopyası olmayan dış liste
     * yüklenmez (o listeye dayanan belgeler doğrulanamaz).
     */
    externalListsDirect?: boolean;
    anchorMaxAgeMs?: number;
    /** ADR-0038: beklenen ağ (varsayılan "production"); sandbox listesi gerçek ağ istemcisinde reddedilir. */
    environment?: "production" | "sandbox";
    /**
     * TL2: kalıcı "son görülen" sürüm belleği (cüzdan deposu vb.) — oturumlar arası geri sarmayı da yakalar; yoksa yalnız
     * oturum içi denetim.
     */
    versionMemory?: ListVersionMemory | "none";
  },
): Promise<{ source: ListTrustSource; store: TrustStore; report: LoadReport }> {
  if (!opts.rootFingerprints.length) throw new TrustListError("no trust anchor (pin) configured");
  const base = trustBase.replace(/\/$/, "");
  const cc = (opts.stateCode ?? "tr").toUpperCase();
  const now = opts.now ?? new Date();
  const get = async (path: string) => {
    const r = await http(`${base}/${path}`);
    if (r.status !== 200) throw new TrustListError(`trusted list could not be fetched: ${path} (${r.status})`);
    return (await r.text()).trim();
  };
  const requested = [...new Set((opts.additionalStates ?? []).map((s) => String(s).toUpperCase()))];
  const malformed = requested.filter((s) => !/^[A-Z]{2}$/.test(s));
  if (malformed.length)
    throw new TrustListError(
      `additionalStates: not a two-letter state code: ${malformed.map((s) => `"${s}"`).join(", ")}`,
    );
  const extra = requested.filter((s) => s !== cc);
  const allActive = opts.nationalLists === "all-active";
  const lotlJws = await get("lotl.jws");
  // ADR-0093 K2: yalnız indirilecek dosyaları seçer (imza yükleyicide doğrulanır; LOTL'da olmayan liste sayılmaz)
  const optional = allActive ? activeStatesOf(lotlJws).filter((s) => s !== cc && !extra.includes(s)) : [];
  const fetchStates = [...extra, ...optional];
  const [tlJws, anchorsJsonl, ...extraJws] = await Promise.all([
    get(`tl-${cc.toLowerCase()}.jws`).catch(() => ""),
    opts.anchors ? get("anchors.jsonl") : Promise.resolve(""),
    ...fetchStates.map((s) => get(`tl-${s.toLowerCase()}.jws`).catch(() => "")),
  ]);
  const nationalListJws: Record<string, string> = tlJws ? { [cc]: tlJws } : {};
  fetchStates.forEach((s, k) => {
    if (extraJws[k]) nationalListJws[s] = extraJws[k];
  });
  const { store, report } = await loadTrustSetWith(
    {
      lotlJws,
      nationalListJws,
      anchorsJsonl,
      rootFingerprints: opts.rootFingerprints.map((f) => f.toLowerCase()),
      now,
      skipAnchors: !opts.anchors,
      // all-active: LOTL'daki bütün ETKİN listeler (imzalı LOTL'a göre), zorunlu olanlar kendi ülkesi + istenenler
      ...(allActive ? { requiredStates: [cc, ...extra] } : { states: [cc, ...extra] }),
      anchorMaxAgeMs: opts.anchorMaxAgeMs,
      environment: opts.environment,
      versionMemory: opts.versionMemory,
    },
    opts.verifyJws,
  );
  if (opts.externalLists && store.lotl.external_lists?.length) {
    const jwsMap: Record<string, string> = {};
    for (const ptr of store.lotl.external_lists) {
      if (ptr.status !== "ACTIVE") continue;
      // yayıncının kopyası: LoTE `.jws`, TL `.xml` (özgün imzalı belge; kopya içeriği değiştiremez)
      const ext = ptr.format === "etsi-tl-xml" ? "xml" : "jws";
      const mirror = await get(`external/${ptr.list_id}.${ext}`).catch(() => "");
      const body =
        mirror ||
        (opts.externalListsDirect === false
          ? ""
          : await http(ptr.list_url)
              .then(async (r) => (r.status === 200 ? (await r.text()).trim() : ""))
              .catch(() => ""));
      if (body) jwsMap[ptr.list_id] = body;
    }
    report.warnings.push(
      ...(await applyExternalListsWith(
        store,
        jwsMap,
        opts.verifyJws,
        now,
        opts.versionMemory === "none" ? undefined : opts.versionMemory,
      )),
    );
  }
  const tl = store.national.get(cc)?.list;
  if (!tl) throw new TrustListError(`no active ${cc} list in the lotl`);
  if (!report.healthy) throw new TrustListError(`trusted list stale (${report.warnings.join("; ")})`);
  // İstenen her ek ülke gerçekten yüklenmiş olmalı: LOTL'da yoksa ya da listesi ACTIVE değilse yükleyici onu atlar ve `healthy`
  // kalır (alınamayan liste yukarıda yakalanır). Sessizce daha az listeyle dönmek, ülkeler arası kuralı (ADR-0075) habersiz kapatır.
  const missing = extra.filter((s) => !store.national.has(s));
  if (missing.length)
    throw new TrustListError(`additionalStates: no active ${missing.join(", ")} list in the lotl — not loaded`);
  const key = `${base}|${cc}`;
  const prev = seen.get(key);
  if (prev && (store.lotl.version < prev.lotl || tl.version < prev.tl))
    throw new TrustListError("trusted list older than a previously seen version (rollback)");
  seen.set(key, { lotl: Math.max(store.lotl.version, prev?.lotl ?? 0), tl: Math.max(tl.version, prev?.tl ?? 0) });
  // ADR-0093 K2: isteğe bağlı listelerde geri sarma yalnız o ülkeyi kullanılamaz yapar (oturum içi bellek, liste başına)
  for (const [s, { list }] of store.national) {
    if (s === cc || extra.includes(s)) continue;
    const k = `${base}|${cc}|tl-${s}`;
    const p = seen.get(k);
    if (p && list.version < p.tl) {
      store.unavailable_states.add(s);
      report.warnings.push(`tl-${s.toLowerCase()} older than a previously seen version (rollback) — not used`);
      continue;
    }
    seen.set(k, { lotl: 0, tl: Math.max(list.version, p?.tl ?? 0) });
  }
  // Saat donmaz (güvenlik incelemesi 2026-11-18): `now` yalnız YÜKLEME anıdır. Kaynağın saati gerçek zamanla ilerler — `now`
  // verildiyse ondan başlayıp geçen süre kadar ilerler; liste `next_update`'i geçince sorgular UNKNOWN olur.
  return { source: new ListTrustSource(store, advancingClock(opts.now)), store, report };
}

/**
 * ADR-0093 K2: imzası HENÜZ doğrulanmamış LOTL'dan ETKİN ülke listelerinin kodları — yalnız hangi dosyaların indirileceğini seçmek
 * için. Okunamazsa boş (o zaman yalnız zorunlu listeler indirilir; yükleyici eksikleri "kullanılamaz" işaretler).
 */
/** Bir LOTL'dan indirilecek en çok ülke listesi (TDT üye ve gözlemci yerleri bunun çok altında). */
const MAX_NATIONAL_LISTS = 32;
function activeStatesOf(lotlJws: string): string[] {
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64ToBytes(lotlJws.split(".")[1] ?? ""))) as {
      national_lists?: Array<{ state_code?: unknown; status?: unknown }>;
    };
    // imzası henüz doğrulanmamış içerik: tekrarlar ayıklanır ve indirme sayısı sınırlıdır (hangi listenin sayılacağını imzalı LOTL seçer)
    const codes = (payload.national_lists ?? [])
      .filter((n) => n.status === "ACTIVE" && typeof n.state_code === "string" && /^[A-Z]{2}$/.test(n.state_code))
      .map((n) => n.state_code as string);
    return [...new Set(codes)].slice(0, MAX_NATIONAL_LISTS);
  } catch {
    return [];
  }
}
