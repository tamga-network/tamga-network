/**
 * chain-check — doğrulayıcı tarafı (ADR-0051 K1.2, K5): elindeki imzalı listenin özeti zincirde ONAYLI çapalanmış mı?
 * Üç değerli cevap (TrustSource ile aynı dil):
 *   YES      onaylı çapa listenin özetiyle aynı
 *   NO       aynı sürüm için onaylı FARKLI özet var — çift konuşma işareti; doğrulama sonucunu DEĞİŞTİRMEZ, alarm üretir
 *   UNKNOWN  bayrak kapalı / zincir erişilemez / çapa yok ya da onaysız
 * İsteğe bağlı ek güvencedir; A–E doğrulama hattının adımı değildir ve `UNKNOWN` sonucu kötüleştirmez (CH1).
 */
import type { Tri } from "@tamga-network/trust";

import type { ChainClient } from "./client.js";
import { listAnchorOf, type Environment } from "./projection.js";

export interface ChainCheck {
  file: string;
  version: number;
  contentHash: string;
  anchored: Tri;
  reason: string;
  chain?: { contentHash: string; confirmations: number; confirmed: boolean; latestVersion: number };
}

export async function checkListAnchored(
  client: ChainClient | null,
  environment: Environment,
  file: string,
  jws: string,
): Promise<ChainCheck> {
  const a = listAnchorOf(environment, file, jws);
  const base = { file, version: a.version, contentHash: a.contentHash };
  if (!client) return { ...base, anchored: "UNKNOWN", reason: "zincir kapalı (TAMGA_CHAIN_ENABLED=0)" };
  try {
    const [existing, latestVersion] = await Promise.all([
      client.listAnchor(a.listKey, a.version),
      client.latestListVersion(a.listKey),
    ]);
    if (!existing) return { ...base, anchored: "UNKNOWN", reason: "zincirde bu sürüm için çapa yok", chain: undefined };
    const chain = {
      contentHash: existing.contentHash,
      confirmations: existing.confirmations,
      confirmed: existing.confirmed,
      latestVersion,
    };
    if (!existing.confirmed) return { ...base, anchored: "UNKNOWN", reason: "çapa var ama onay eşiği dolmadı", chain };
    if (existing.contentHash === a.contentHash)
      return { ...base, anchored: "YES", reason: "onaylı çapa aynı özet", chain };
    return {
      ...base,
      anchored: "NO",
      reason: "onaylı çapa FARKLI özet — çift konuşma işareti; imzalı liste geçerli (CH1)",
      chain,
    };
  } catch (e) {
    return { ...base, anchored: "UNKNOWN", reason: `zincir erişilemedi: ${(e as Error).message}` };
  }
}
