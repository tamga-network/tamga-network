/**
 * ADR-0026 K4: istek nesnesine eklenecek kayıt sertifikaları. Kaynak liste yayıncısının çıktısı (`<trustDist>/wrprc/`): dizin
 * değişince yeniden okunur. Sertifika yoksa (kimlik numarası kayda girilmemiş) istek bugünkü gibi sertifikasız gider.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

interface IndexItem {
  kind: "rp" | "issuer";
  path: string;
  /** aynı yükün CBOR biçimi (`rc-wrp+cwt`; ADR-0026 K5) */
  cwt_path?: string;
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

/**
 * İsteğin kayıt sertifikası (ETSI TS 119 472-2 RO-13…16, ARF RPRC_19): istek başına TEK sertifika — DCQL sorgularının kullanım
 * eşlemesinden (`registrationScopesFor`) en çok sorguyu kapsayan kullanımınki (eşitlikte ilk sorgunun kullanımı). Sertifika
 * `credential_ids` olmadan isteğin bütününe aittir; kapsamadığı sorgu için cüzdan "kayıtlı kullanımdan fazla istek" uyarısı
 * gösterir. Kullanımın sertifikası yoksa (ya da dosya yayın sırasında değiştiyse) istek sertifikasız gider.
 */
export function registrationCertFor(
  trustDist: string,
  clientId: string,
  picks: Array<{ queryId: string; scopeId: string }>,
): string | undefined {
  const b = pickCert(trustDist, clientId, picks, "path");
  return b ? new TextDecoder().decode(b).trim() : undefined;
}

/**
 * Aynı seçimin CBOR biçimi (`rc-wrp+cwt`) — ISO/IEC 18013-7 Ek C isteğinin `requestInfo.euWrprc`'si (ADR-0026 K5). Yoksa `undefined`.
 */
export function registrationCwtFor(
  trustDist: string,
  clientId: string,
  picks: Array<{ queryId: string; scopeId: string }>,
): Uint8Array | undefined {
  return pickCert(trustDist, clientId, picks, "cwt_path");
}

function pickCert(
  trustDist: string,
  clientId: string,
  picks: Array<{ queryId: string; scopeId: string }>,
  field: "path" | "cwt_path",
): Uint8Array | undefined {
  const items = indexOf(trustDist).filter((i) => i.kind === "rp" && i.client_id === clientId);
  const count = new Map<string, number>();
  for (const p of picks) count.set(p.scopeId, (count.get(p.scopeId) ?? 0) + 1);
  // Map ekleme sırasını korur: sıralama kararlı, eşitlikte ilk sorgunun kullanımı önde
  const ranked = [...count.entries()].sort((a, b) => b[1] - a[1]).map(([scopeId]) => scopeId);
  for (const scopeId of ranked) {
    const it = items.find((i) => i.scope_id === scopeId);
    const rel = it?.[field];
    if (!rel) continue;
    try {
      return new Uint8Array(readFileSync(resolve(trustDist, rel)));
    } catch {
      /* dosya yayın sırasında değişti: sıradaki kullanım */
    }
  }
  return undefined;
}
