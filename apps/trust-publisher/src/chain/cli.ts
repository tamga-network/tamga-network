/**
 * chain-anchor / chain-check komutları (ADR-0051 öneri; CH5 bayrak).
 *   chain-anchor [--dry-run] [--skip-verify]   dist/ özetlerini zincire yaz (bayrak kapalıysa yalnız --dry-run çalışır)
 *   chain-check <dosya.jws>                     listenin özeti zincirde onaylı mı? (YES / NO / UNKNOWN)
 * Ortam: TAMGA_CHAIN_ENABLED (0/1, varsayılan 0) · TAMGA_CHAIN_RPC_URL · TAMGA_CHAIN_ANCHOR_REGISTRY · TAMGA_CHAIN_ANCHORER_KEY
 * (yalnız yazma; .env'de, depoda yer tutucu). Üretimde bayrak ikinci bağımsız işletmeci ve eşik ≥ 2 olmadan açılmaz (K4).
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";

import { anchorDist } from "./anchor.js";
import { EthersChainClient, MemoryChainClient, type ChainClient } from "./client.js";
import type { Environment } from "./projection.js";
import { checkListAnchored } from "./verify.js";

export const chainEnabled = (env: NodeJS.ProcessEnv = process.env) => env.TAMGA_CHAIN_ENABLED === "1";

/** Bayrak açıksa gerçek istemci (ortamdan), kapalıysa null. Eksik ayar → hata (sessizce bellek içi istemciye düşmez). */
export function chainClientFromEnv(env: NodeJS.ProcessEnv = process.env, needWriter = false): ChainClient | null {
  if (!chainEnabled(env)) return null;
  const rpcUrl = env.TAMGA_CHAIN_RPC_URL;
  const registry = env.TAMGA_CHAIN_ANCHOR_REGISTRY;
  if (!rpcUrl || !registry) throw new Error("chain: TAMGA_CHAIN_RPC_URL ve TAMGA_CHAIN_ANCHOR_REGISTRY gerekir");
  if (needWriter && !env.TAMGA_CHAIN_ANCHORER_KEY) throw new Error("chain: TAMGA_CHAIN_ANCHORER_KEY gerekir (yazma)");
  return new EthersChainClient({ rpcUrl, registry, anchorerKey: env.TAMGA_CHAIN_ANCHORER_KEY });
}

export async function chainCommand(
  cmd: string,
  args: string[],
  ctx: { dist: string; environment: Environment; env?: NodeJS.ProcessEnv },
): Promise<number> {
  const env = ctx.env ?? process.env;
  if (cmd === "chain-anchor") {
    const dryRun = args.includes("--dry-run");
    const skipVerify = args.includes("--skip-verify");
    if (!chainEnabled(env) && !dryRun) {
      console.log(
        JSON.stringify({
          chain: "disabled",
          note: "TAMGA_CHAIN_ENABLED=0 — hiçbir şey yazılmadı; plan için --dry-run",
        }),
      );
      return 0;
    }
    // dry-run: bayrak açıksa zincir OKUNUR (karar gerçek duruma göre) ama yazılmaz; kapalıysa bellek içi boş zincir
    const client = chainEnabled(env) ? chainClientFromEnv(env, !dryRun)! : new MemoryChainClient(1);
    const report = await anchorDist(client, ctx.dist, ctx.environment, { dryRun, skipVerify });
    console.log(JSON.stringify(report, null, 2));
    if (report.conflicts > 0) {
      console.error(
        `chain: ${report.conflicts} ÇELİŞKİ — zincirde farklı özet; imzalı liste geçerli, işletmeci incelesin`,
      );
      return 3;
    }
    return 0;
  }
  if (cmd === "chain-check") {
    const path = args.find((a) => !a.startsWith("--"));
    if (!path) throw new Error("kullanım: chain-check <lotl.jws|tl-xx.jws>");
    const file = basename(path).replace(/\.jws$/, "");
    const client = chainClientFromEnv(env, false);
    const out = await checkListAnchored(client, ctx.environment, file, readFileSync(path, "utf8"));
    console.log(JSON.stringify(out, null, 2));
    return out.anchored === "NO" ? 3 : 0;
  }
  throw new Error(`chain: bilinmeyen komut ${cmd}`);
}
