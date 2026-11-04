/**
 * chain-submit / chain-check komutları (ADR-0051; CH5 bayrak).
 *   chain-submit [--dry-run] [--skip-verify]   dist/ özetlerini zincire yaz (bayrak kapalıysa yalnız --dry-run çalışır)
 *   chain-check <dosya>                         listenin özeti zincirde onaylı mı? (YES / NO / UNKNOWN) — lotl.jws / tl-<cc>.jws;
 *                                               ADR-0074 K4: görünüm (tl-<cc>.xml, lote/<tür>.jws) ve kayıt sertifikası durum
 *                                               listesi (status/<ad>) da — sürüm dist/anchors.jsonl'daki satırdan
 *   chain-replay …                              liste geçmişinin kontratlara yeniden oynatılması (ADR-0073 K1) — replay-cli.ts
 * Ortam: TAMGA_CHAIN_ENABLED (0/1, varsayılan 0) · TAMGA_CHAIN_RPC_URL · TAMGA_CHAIN_ANCHOR_REGISTRY · TAMGA_CHAIN_ANCHORER_KEY
 * (yalnız yazma; .env'de, depoda yer tutucu). Üretimde bayrak ikinci bağımsız işletmeci ve eşik ≥ 2 olmadan açılmaz (K4).
 */
import { existsSync, readFileSync } from "node:fs";
import { basename, relative, resolve } from "node:path";

import { anchorDist } from "./anchor.js";
import { EthersChainClient, MemoryChainClient, type ChainClient } from "./client.js";
import type { Environment } from "./projection.js";
import { chainReplayCommand } from "./replay-cli.js";
import { checkListAnchored, checkViewAnchored } from "./verify.js";

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
  if (cmd === "chain-submit") {
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
    if (report.contested > 0) {
      console.error(
        `chain: ${report.contested} RAKİP ADAY — zincirde bekleyen farklı özet var; kendi özetimiz gönderildi (ADR-0053), işletmeci incelesin`,
      );
    }
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
    if (!path) throw new Error("kullanım: chain-check <lotl.jws|tl-xx.jws|tl-xx.xml|lote/<tür>.jws|status/<ad>>");
    const client = chainClientFromEnv(env, false);
    const name = basename(path);
    let out;
    if (/^(lotl|tl-[a-z]{2})\.jws$/.test(name) && !/[\\/]lote[\\/]/.test(path))
      out = await checkListAnchored(client, ctx.environment, name.replace(/\.jws$/, ""), readFileSync(path, "utf8"));
    else {
      // görünüm: yayın kökündeki yol (dist içindeyse göreli yol, değilse olduğu gibi)
      const abs = resolve(path);
      const rel = abs.startsWith(resolve(ctx.dist))
        ? relative(ctx.dist, abs).replace(/\\/g, "/")
        : path.replace(/\\/g, "/");
      const log = resolve(ctx.dist, "anchors.jsonl");
      out = await checkViewAnchored(
        client,
        ctx.environment,
        rel,
        readFileSync(path, "utf8"), // görünüm baytları olduğu gibi (XML sonundaki satır sonu özete dahil)
        existsSync(log) ? readFileSync(log, "utf8") : "",
      );
    }
    console.log(JSON.stringify(out, null, 2));
    return out.anchored === "NO" ? 3 : 0;
  }
  if (cmd === "chain-replay") return chainReplayCommand(args, { ...ctx, env });
  throw new Error(`chain: bilinmeyen komut ${cmd}`);
}
