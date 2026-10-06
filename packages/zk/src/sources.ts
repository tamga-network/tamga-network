/**
 * Devre kaynakları (React Native uyumlu). Devre dosyası (~300 KB, zstd) kişisel veri içermez; güven listesinde özetiyle yayınlanır
 * ve her kullanımda o özetle denetlenir (`loadCircuit`), bu yüzden nereden geldiği güveni değiştirmez.
 */
import type { ZkCircuitSource } from "./types.js";

/** Bellekteki devreler (uygulamayla gelen varlıklar ya da testler). */
export function memoryCircuitSource(circuits: Record<string, Uint8Array>): ZkCircuitSource {
  return { get: async (id) => circuits[id] };
}

/**
 * Ağdan indirilen devreler: `${baseUrl}/${circuit_id}.zst` (ör. güven listesi sitesi). İsteğe bağlı önbellek telefonda tutar;
 * indirme yalnız devre içindir (kişi verisi, belge ya da oturum bilgisi gönderilmez).
 */
export function httpCircuitSource(
  baseUrl: string,
  opts: {
    fetch?: typeof fetch;
    cache?: { get(id: string): Promise<Uint8Array | undefined>; set(id: string, bytes: Uint8Array): Promise<void> };
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
      const bytes = new Uint8Array(await r.arrayBuffer());
      await opts.cache?.set(id, bytes);
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
