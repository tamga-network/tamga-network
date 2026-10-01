/** Node yardımcıları — trust-publisher dist dizininden (veya trust.tamga.network aynasından) TrustSource yükleme. */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { loadTrustSet } from "./jws.js";
import { ListTrustSource } from "./trust-source.js";

export interface DistLoadOptions {
  anchorMaxAgeMs?: number;
  now?: Date;
}

/** `dist/` düzeni: lotl.jws, tl-<cc>.jws, anchors.jsonl, keys/root-fingerprints.json ({ lotl_signing_keys: [{fingerprint_sha256}] }). */
export async function loadTrustSourceFromDir(
  dir: string,
  opt: DistLoadOptions = {},
): Promise<{
  trust: ListTrustSource;
  report: Awaited<ReturnType<typeof loadTrustSet>>["report"];
  rootCertPem: string | null;
}> {
  const national: Record<string, string> = {};
  for (const f of readdirSync(dir)) {
    const m = /^tl-([a-z]{2})\.jws$/.exec(f);
    if (m) national[m[1].toUpperCase()] = readFileSync(resolve(dir, f), "utf8");
  }
  const keys = JSON.parse(readFileSync(resolve(dir, "keys", "root-fingerprints.json"), "utf8")) as {
    lotl_signing_keys: Array<{ fingerprint_sha256: string }>;
  };
  // ADR-0036: yayıncının dış liste kopyaları (dist/external/<list_id>.jws); imza LOTL'daki sabit imzacıya karşı doğrulanır
  const external: Record<string, string> = {};
  const extDir = resolve(dir, "external");
  if (existsSync(extDir))
    for (const f of readdirSync(extDir)) {
      const m = /^([a-z0-9-]{3,64})\.jws$/.exec(f);
      if (m) external[m[1]] = readFileSync(resolve(extDir, f), "utf8").trim();
    }
  const anchorsPath = resolve(dir, "anchors.jsonl");
  const { store, report } = await loadTrustSet({
    lotlJws: readFileSync(resolve(dir, "lotl.jws"), "utf8"),
    nationalListJws: national,
    anchorsJsonl: existsSync(anchorsPath) ? readFileSync(anchorsPath, "utf8") : "",
    rootFingerprints: keys.lotl_signing_keys.map((k) => k.fingerprint_sha256),
    now: opt.now,
    anchorMaxAgeMs: opt.anchorMaxAgeMs ?? 365 * 86400_000,
    externalListJws: external,
  });
  const rootPath = resolve(dir, "keys", "root-ca.cert.pem");
  return {
    trust: new ListTrustSource(store),
    report,
    rootCertPem: existsSync(rootPath) ? readFileSync(rootPath, "utf8") : null,
  };
}

/**
 * `dist/` damgası: lotl.jws, tl-*.jws, anchors.jsonl ve keys/root-fingerprints.json için (ad, mtime, boyut).
 * Damga değişmediyse liste içeriği de değişmemiştir → yeniden yükleme (JWS doğrulamaları) gereksizdir.
 */
export function trustDistStamp(dir: string): string {
  const names = readdirSync(dir).filter(
    (f) => f === "lotl.jws" || f === "anchors.jsonl" || /^tl-[a-z]{2}\.jws$/.test(f),
  );
  names.push("keys/root-fingerprints.json");
  // ADR-0036: dış liste kopyaları değişince de yeniden yükle
  const extDir = resolve(dir, "external");
  if (existsSync(extDir)) for (const f of readdirSync(extDir)) if (f.endsWith(".jws")) names.push(`external/${f}`);
  return names
    .sort()
    .map((n) => {
      const p = resolve(dir, n);
      if (!existsSync(p)) return `${n}:-`;
      const s = statSync(p);
      return `${n}:${s.mtimeMs}:${s.size}`;
    })
    .join("|");
}

/**
 * Periyodik yenileme sarmalayıcısı: (1) aynı anda tek yükleme — önceki bitmeden yeni tetik gelirse atlanır (çapa günlüğü
 * büyüdükçe bir yükleme saniyeler sürer; üst üste binen yüklemeler servisi yetişemez hâle getirir), (2) dist damgası
 * değişmediyse yükleme yapılmaz. `seedStamp`: çağıran listeyi az önce yükledi (ilk tetikte yeniden yükleme yok).
 * `force()` damgayı yok sayar (operatör komutu / test).
 */
export function guardedReload(
  dir: string,
  load: () => Promise<void>,
  opt: { seedStamp?: boolean } = {},
): { reload: () => Promise<void>; force: () => Promise<void>; inFlight: () => boolean } {
  let stamp = opt.seedStamp ? trustDistStamp(dir) : "";
  let running: Promise<void> | null = null;
  const run = (ignoreStamp: boolean) => {
    if (running) return running; // üst üste binme yok: devam eden yüklemeye katıl
    const next = trustDistStamp(dir);
    if (!ignoreStamp && next === stamp) return Promise.resolve();
    running = load()
      .then(() => {
        stamp = next;
      })
      .finally(() => {
        running = null;
      });
    return running;
  };
  return { reload: () => run(false), force: () => run(true), inFlight: () => running !== null };
}
