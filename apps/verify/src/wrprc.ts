/**
 * ADR-0026 K4: istek nesnesine eklenecek kayıt sertifikaları. Kaynak liste yayıncısının çıktısı (`<trustDist>/wrprc/`): dizin
 * değişince yeniden okunur. Sertifika yoksa (kimlik numarası kayda girilmemiş) istek bugünkü gibi sertifikasız gider.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

interface IndexItem {
  kind: "rp" | "issuer";
  path: string;
  client_id?: string;
  scope_id?: string;
}

let cache: { file: string; mtime: number; items: IndexItem[] } | null = null;

function indexOf(trustDist: string): IndexItem[] {
  const file = resolve(trustDist, "wrprc", "index.json");
  if (!existsSync(file)) return [];
  const mtime = statSync(file).mtimeMs;
  if (cache?.file !== file || cache.mtime !== mtime) {
    try {
      cache = { file, mtime, items: (JSON.parse(readFileSync(file, "utf8")) as { items: IndexItem[] }).items ?? [] };
    } catch {
      return []; // yayın sırasında yarım dosya: bu istek sertifikasız gider
    }
  }
  return cache.items;
}

/** DCQL sorgusu → kullanım eşlemesinden (`registrationScopesFor`) sertifikalar; aynı kullanımın sorguları tek girdide. */
export function registrationCertsFor(
  trustDist: string,
  clientId: string,
  picks: Array<{ queryId: string; scopeId: string }>,
): Array<{ jwt: string; credentialIds: string[] }> {
  const items = indexOf(trustDist).filter((i) => i.kind === "rp" && i.client_id === clientId);
  const byScope = new Map<string, string[]>();
  for (const p of picks) byScope.set(p.scopeId, [...(byScope.get(p.scopeId) ?? []), p.queryId]);
  const out: Array<{ jwt: string; credentialIds: string[] }> = [];
  for (const [scopeId, credentialIds] of byScope) {
    const it = items.find((i) => i.scope_id === scopeId);
    if (!it) continue;
    try {
      out.push({ jwt: readFileSync(resolve(trustDist, it.path), "utf8").trim(), credentialIds });
    } catch {
      /* dosya yayın sırasında değişti: sertifikasız */
    }
  }
  return out;
}
