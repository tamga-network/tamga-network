/**
 * Canlı ağın imzalı listelerini yalnız okuyarak yerel bir yayın klasörüne indirir (gölge zincir; network/testnet/shadow-chain.sh):
 *   npx tsx apps/chain-indexer/scripts/mirror-lists.ts --base https://trust.tamga.network --out <klasör> [--expect-root <fp,…>]
 *                                                       [--environment production|sandbox]
 * Artımlıdır (arşivde olan sürüm yeniden indirilmez), sonunda arşivi doğrular. Rapor JSON (stdout); çıkış 0 tamam · 1 hata.
 * Kural ve ayrıntı: apps/chain-indexer/src/list-mirror.ts.
 */
import { resolve } from "node:path";

import { mirrorSignedLists } from "../src/list-mirror.js";

const argv = process.argv.slice(2);
const opt = (k: string) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
try {
  const base = opt("base");
  const out = opt("out");
  if (!base || !out)
    throw new Error("kullanım: mirror-lists.ts --base <https://…> --out <klasör> [--expect-root fp,…]");
  const env = opt("environment") ?? "production";
  if (env !== "production" && env !== "sandbox") throw new Error("--environment production|sandbox");
  const report = await mirrorSignedLists({
    base,
    out: resolve(out),
    environment: env,
    expectRoots: opt("expect-root")?.split(",").filter(Boolean),
  });
  console.log(JSON.stringify(report, null, 2));
} catch (e) {
  console.error(`mirror-lists: ${(e as Error).message}`);
  process.exit(1);
}
