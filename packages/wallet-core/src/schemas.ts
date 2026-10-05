/**
 * Şema kataloğu (B4) — `schemas.tamga.network/v1/index.json` toplu çekimi (WL9/CMP8).
 * Dönen fonksiyon `receiveCredentials(..., { catalogueHash })` seçeneğine verilir. Katalog erişilemezse B4 atlanır:
 * çağıran `undefined` alır ve nedeni `onError` ile öğrenir (cüzdan bunu iz kaydına yazar).
 * Katalog her seferinde önbelleksiz çekilir (`fresh`): şemalar yerinde düzeltilir (ADR-0029); cihaz önbelleğindeki eski kopya
 * yeni belgenin `vct#integrity`'sini tanımaz ve belgeyi haksız yere reddettirir (2026-10-04 cihaz hatası).
 */
import { fetchHttp, type Http } from "./http.js";

export const DEFAULT_SCHEMAS_BASE = "https://schemas.tamga.network";

export interface CatalogueEntry {
  vct: string;
  content_hash: string;
  /** ADR-0010 K4: geçerli tüm sürümler */
  content_hashes?: string[];
}

/** vct → geçerli sürüm özetleri (belgenin `vct#integrity`'si bunlardan biri olmalı) */
export type CatalogueHash = (vct: string) => string[] | undefined;

export async function fetchCatalogueHash(
  opt: {
    schemasBase?: string;
    http?: Http;
    onLoaded?: (count: number) => void;
    onError?: (message: string) => void;
  } = {},
): Promise<CatalogueHash | undefined> {
  const base = (opt.schemasBase ?? DEFAULT_SCHEMAS_BASE).replace(/\/+$/, "");
  try {
    const r = await (opt.http ?? fetchHttp)(`${base}/v1/index.json`, { method: "GET", fresh: true });
    if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
    const idx = JSON.parse(await r.text()) as CatalogueEntry[];
    if (!Array.isArray(idx)) throw new Error("catalogue is not an array");
    const map = new Map(idx.map((x) => [x.vct, x.content_hashes?.length ? x.content_hashes : [x.content_hash]]));
    opt.onLoaded?.(map.size);
    return (vct) => map.get(vct);
  } catch (e) {
    opt.onError?.(String((e as Error).message));
    return undefined;
  }
}
