/**
 * Devre kaynakları (React Native uyumlu). Devre dosyası (~300 KB, zstd) kişisel veri içermez; güven listesinde özetiyle yayınlanır
 * ve her kullanımda o özetle denetlenir (`loadCircuit`), bu yüzden nereden geldiği güveni değiştirmez.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { ZkCircuitEntry, ZkCircuitSource } from "./types.js";

/** İndirilen devre dosyası üst sınırı (bugünkü devreler ~300 KB) — bellek tüketme saldırısı. */
const MAX_CIRCUIT_BYTES = 8 * 1024 * 1024;

/** Bellekteki devreler (uygulamayla gelen varlıklar ya da testler). */
export function memoryCircuitSource(circuits: Record<string, Uint8Array>): ZkCircuitSource {
  return { get: async (id) => circuits[id] };
}

/**
 * Ağdan indirilen devreler: `${baseUrl}/${circuit_id}.zst` (ör. güven listesi sitesi). İsteğe bağlı önbellek telefonda tutar;
 * indirme yalnız devre içindir (kişi verisi, belge ya da oturum bilgisi gönderilmez). Boyut üst sınırlı (`maxBytes`). Önbelleğe
 * yalnız güven listesindeki özetle (`trustedCircuits`) eşleşen dosya yazılır — bozuk/sahte dosya önbelleği kalıcı zehirlemez;
 * liste verilmezse indirilen dosya önbelleğe yazılmaz (kullanımda `loadCircuit` yine denetler).
 */
export function httpCircuitSource(
  baseUrl: string,
  opts: {
    fetch?: typeof fetch;
    cache?: { get(id: string): Promise<Uint8Array | undefined>; set(id: string, bytes: Uint8Array): Promise<void> };
    /** Güven listesindeki devreler (`lotl.zk_circuits`): önbelleğe yazmadan önce özet denetimi için. */
    trustedCircuits?: readonly ZkCircuitEntry[];
    /** Dosya üst sınırı (bayt; varsayılan 8 MiB). */
    maxBytes?: number;
  } = {},
): ZkCircuitSource {
  const f = opts.fetch ?? fetch;
  const base = baseUrl.replace(/\/$/, "");
  return {
    async get(id) {
      if (!/^[0-9a-f]{64}$/.test(id)) return undefined;
      const hit = await opts.cache?.get(id);
      if (hit) return hit;
      const r = await f(`${base}/${id}.zst`);
      if (!r.ok) return undefined;
      const max = opts.maxBytes ?? MAX_CIRCUIT_BYTES;
      if (Number(r.headers?.get?.("content-length") ?? 0) > max) return undefined;
      const bytes = new Uint8Array(await r.arrayBuffer());
      if (bytes.length > max) return undefined;
      const want = opts.trustedCircuits?.find((c) => c.circuit_id === id)?.sha256;
      if (opts.cache && want) {
        if (bytesToHex(sha256(bytes)) !== want) return undefined; // ZK2: listedeki özetle tutmayan dosya kullanılmaz
        await opts.cache.set(id, bytes);
      }
      return bytes;
    },
  };
}

/** Birden çok kaynağı sırayla dener (ör. önce uygulamayla gelen, yoksa ağ). */
export function firstCircuitSource(...sources: ZkCircuitSource[]): ZkCircuitSource {
  return {
    async get(id) {
      for (const s of sources) {
        const b = await s.get(id);
        if (b) return b;
      }
      return undefined;
    },
  };
}

/** Bu cihazda ispatçı yokken kullanılan arka uç: her zaman `available() === false` (cüzdan olağan yola döner — ZK5). */
export const unavailableProver = {
  name: "unavailable",
  available: async () => false,
  circuitVersion: async () => 0,
  prove: async (): Promise<Uint8Array> => {
    throw new Error("zero-knowledge prover is not available");
  },
} as const;
