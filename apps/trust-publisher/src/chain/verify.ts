/**
 * chain-check — doğrulayıcı tarafı (ADR-0051 K1.2, K5): elindeki imzalı listenin özeti zincirde ONAYLI çapalanmış mı?
 * Üç değerli cevap (TrustSource ile aynı dil):
 *   YES      onaylı çapa listenin özetiyle aynı
 *   NO       aynı sürüm için onaylı FARKLI özet var — çift konuşma işareti; doğrulama sonucunu DEĞİŞTİRMEZ, alarm üretir
 *   UNKNOWN  bayrak kapalı / zincir erişilemez / çapa yok ya da onaysız
 * İsteğe bağlı ek güvencedir; A–E doğrulama hattının adımı değildir ve `UNKNOWN` sonucu kötüleştirmez (CH1).
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Tri } from "@tamga-network/trust";

import type { ChainClient } from "./client.js";
import { allViewAnchorsOf, jwsHash, listAnchorOf, type Environment, type ListVersionAnchor } from "./projection.js";

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
  return checkAnchored(client, listAnchorOf(environment, file, jws));
}

/**
 * ADR-0074 K4 (PJ5): liste görünümü (`tl-tr.xml`, `lote/<tür>.jws`) ya da kayıt sertifikası durum listesi (`status/<ad>`) zincirde
 * onaylı mı. Sürüm, dosyanın özetini taşıyan çapa günlüğü satırından okunur; satır yoksa `UNKNOWN` (çapalanmamış).
 */
export async function checkViewAnchored(
  client: ChainClient | null,
  environment: Environment,
  file: string,
  bytes: string,
  anchorsJsonl: string,
): Promise<ChainCheck> {
  const contentHash = jwsHash(bytes);
  const hit = allViewAnchorsOf(environment, anchorsJsonl).find((a) => a.file === file && a.contentHash === contentHash);
  if (!hit)
    return {
      file,
      version: 0,
      contentHash,
      anchored: "UNKNOWN",
      reason: "çapa günlüğünde bu dosya ve özet için satır yok (ADR-0074 K4)",
    };
  return checkAnchored(client, hit);
}

async function checkAnchored(client: ChainClient | null, a: ListVersionAnchor): Promise<ChainCheck> {
  const file = a.file;
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

/**
 * C32 (7): bir yayın klasöründeki imzalı listelerin (`lotl.jws`, `tl-<cc>.jws`; ad sırasıyla) zincir denetimi — doğrulayıcının
 * sağlık sayfası (`apps/verify` `/healthz` `chain`) bunu kullanır. Okunamayan dosya `UNKNOWN`.
 */
export async function checkDistAnchored(
  client: ChainClient | null,
  environment: Environment,
  dist: string,
): Promise<ChainCheck[]> {
  const files = readdirSync(dist)
    .filter((f) => /^(lotl|tl-[a-z]{2})\.jws$/.test(f))
    .sort();
  const out: ChainCheck[] = [];
  for (const f of files) {
    const name = f.replace(/\.jws$/, "");
    try {
      out.push(await checkListAnchored(client, environment, name, readFileSync(join(dist, f), "utf8")));
    } catch (e) {
      out.push({ file: name, version: 0, contentHash: "", anchored: "UNKNOWN", reason: (e as Error).message });
    }
  }
  return out;
}
