/**
 * ADR-0015 (D-TRUST-1) K2 — istemci güven kaynağı: listeleri HTTP'den toplu çeker (TS3: kullanıcıya bağlanabilir çağrı yok),
 * gömülü kök parmak iziyle (pin) doğrular ve `ListTrustSource` döndürür. Platformdan bağımsız: imza doğrulama `JwsVerifier`
 * olarak verilir; jose/node:fs yok. Ek istemci kuralları: istenen devletin listesi ACTIVE olmalı, bayat liste reddedilir,
 * oturum içinde daha önce görülen sürümden eski liste reddedilir (geri sarma — TL2).
 */
import { applyExternalListsWith, loadTrustSetWith, type JwsVerifier, type LoadReport } from "./loader.js";
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

/** Test/yeniden kurulum için oturum içi sürüm belleğini sıfırlar. */
export function resetListMonotonicity() {
  seen.clear();
}

export async function fetchListTrustSource(
  trustBase: string,
  http: HttpGet,
  opts: {
    rootFingerprints: string[];
    verifyJws: JwsVerifier;
    stateCode?: string;
    now?: Date;
    /** Çapa günlüğünü de yükle (doğrulayıcı sunucular: iptal listesi çapaları için gerekir). */
    anchors?: boolean;
    /**
     * ADR-0036: LOTL'daki dış listeleri de yükle. Önce yayıncının kopyası (`<base>/external/<list_id>.jws`), yoksa özgün adres.
     * İmza her iki durumda LOTL'da sabitlenmiş imzacıya karşı doğrulanır; kopya içeriği değiştiremez.
     */
    externalLists?: boolean;
    anchorMaxAgeMs?: number;
    /** ADR-0038: beklenen ağ (varsayılan "production"); sandbox listesi gerçek ağ istemcisinde reddedilir. */
    environment?: "production" | "sandbox";
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
  const [lotlJws, tlJws, anchorsJsonl] = await Promise.all([
    get("lotl.jws"),
    get(`tl-${cc.toLowerCase()}.jws`).catch(() => ""),
    opts.anchors ? get("anchors.jsonl") : Promise.resolve(""),
  ]);
  const { store, report } = await loadTrustSetWith(
    {
      lotlJws,
      nationalListJws: tlJws ? { [cc]: tlJws } : {},
      anchorsJsonl,
      rootFingerprints: opts.rootFingerprints.map((f) => f.toLowerCase()),
      now,
      skipAnchors: !opts.anchors,
      states: [cc],
      anchorMaxAgeMs: opts.anchorMaxAgeMs,
      environment: opts.environment,
    },
    opts.verifyJws,
  );
  if (opts.externalLists && store.lotl.external_lists?.length) {
    const jwsMap: Record<string, string> = {};
    for (const ptr of store.lotl.external_lists) {
      if (ptr.status !== "ACTIVE") continue;
      const mirror = await get(`external/${ptr.list_id}.jws`).catch(() => "");
      const body =
        mirror ||
        (await http(ptr.list_url)
          .then(async (r) => (r.status === 200 ? (await r.text()).trim() : ""))
          .catch(() => ""));
      if (body) jwsMap[ptr.list_id] = body;
    }
    report.warnings.push(...(await applyExternalListsWith(store, jwsMap, opts.verifyJws, now)));
  }
  const tl = store.national.get(cc)?.list;
  if (!tl) throw new TrustListError(`no active ${cc} list in the lotl`);
  if (!report.healthy) throw new TrustListError(`trusted list stale (${report.warnings.join("; ")})`);
  const key = `${base}|${cc}`;
  const prev = seen.get(key);
  if (prev && (store.lotl.version < prev.lotl || tl.version < prev.tl))
    throw new TrustListError("trusted list older than a previously seen version (rollback)");
  seen.set(key, { lotl: Math.max(store.lotl.version, prev?.lotl ?? 0), tl: Math.max(tl.version, prev?.tl ?? 0) });
  // Saat donmaz: tazelik her sorguda gerçek zamana göre (opts.now yalnızca test/vektör içindir)
  return { source: new ListTrustSource(store, opts.now ? () => now : () => new Date()), store, report };
}
