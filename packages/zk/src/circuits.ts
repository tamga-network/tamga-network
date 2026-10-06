/**
 * Devre seçimi ve denetimi (ZK2: yalnız güven listesinde yayınlanan ve özetiyle sabitlenen devre kullanılır). Cüzdan ve doğrulayıcı
 * aynı listeye bakar; ispatçı listede olmayan devreyle ispat üretmez.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { ZkError, type ZkCircuitEntry, type ZkCircuitSource } from "./types.js";

export const ZK_SYSTEM = "longfellow-libzk-v1";

/**
 * `attributes` öğeli istek için kullanılacak devre: etkin, sistem Longfellow, sürümü ispatçınınkiyle aynı, öğe sayısı eşleşen.
 * Birden çok uygun devre varsa listedeki ilki (yayıncı sırası). Yoksa `no_circuit`.
 */
export function selectCircuit(
  list: readonly ZkCircuitEntry[] | undefined,
  attributes: number,
  version: number,
): ZkCircuitEntry {
  const c = (list ?? []).find(
    (x) =>
      x.status.toUpperCase() === "ACTIVE" &&
      x.system === ZK_SYSTEM &&
      x.version === version &&
      x.attributes === attributes,
  );
  if (!c) throw new ZkError("no_circuit", `no active circuit for ${attributes} attribute(s), version ${version}`);
  return c;
}

/** Devre baytlarını kaynaktan alır ve listedeki SHA-256 ile karşılaştırır (eşleşmezse kullanılmaz). */
export async function loadCircuit(source: ZkCircuitSource, entry: ZkCircuitEntry): Promise<Uint8Array> {
  const bytes = await source.get(entry.circuit_id);
  if (!bytes) throw new ZkError("no_circuit", `circuit ${entry.circuit_id} is not available on this device`);
  if (bytesToHex(sha256(bytes)) !== entry.sha256)
    throw new ZkError("circuit_mismatch", "circuit does not match the trust list");
  return bytes;
}
