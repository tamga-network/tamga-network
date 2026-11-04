/**
 * Yol sınırı (2026-11-04 güvenlik turu O3/D2): katılım klasöründen (ve MCP kökünden) okunan/yazılan her yol, sembolik bağ ve
 * Windows bağlantı noktası (junction) çözüldükten SONRA o klasörün içinde kalmalı. Henüz var olmayan yolda en yakın mevcut üst
 * klasör `realpath` ile çözülür, kalan bölümler ona eklenir; çözülemeyen (kırık) bağ reddedilir.
 */
import { lstatSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

/** Yolun gerçek (bağları çözülmüş) karşılığı; var olmayan kuyruk olduğu gibi eklenir. */
export function realResolve(p: string): string {
  let cur = resolve(p);
  const rest: string[] = [];
  for (;;) {
    let exists = true;
    try {
      lstatSync(cur);
    } catch {
      exists = false;
    }
    if (exists) break;
    const parent = dirname(cur);
    if (parent === cur) return join(cur, ...rest);
    rest.unshift(basename(cur));
    cur = parent;
  }
  // var olan yol: bağ ise hedefi (kırık bağ → hata; sınır dışına çıkıyor olabilir)
  return join(realpathSync.native(cur), ...rest);
}

/** `p` (bağlar çözüldükten sonra) `base`'in içinde mi (ya da kendisi mi). */
export function isInside(base: string, p: string): boolean {
  let b: string;
  let a: string;
  try {
    b = realResolve(base);
    a = realResolve(p);
  } catch {
    return false;
  }
  const rel = relative(b, a);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

export class PathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathError";
  }
}

/** `join(base, ...parts)` — sonuç `base` dışına çıkıyorsa PathError. */
export function within(base: string, ...parts: string[]): string {
  const p = join(base, ...parts);
  if (!isInside(base, p)) throw new PathError(`yol katılım klasörünün dışında: ${parts.join("/")}`);
  return p;
}

/** Başvuru dosyası adı (onboarding.json `applications`): `<kısa ad>.issuer.json` / `<kısa ad>.rp.json`. */
export const APPLICATION_FILE_RE = /^[a-z0-9-]+\.(issuer|rp)\.json$/;
