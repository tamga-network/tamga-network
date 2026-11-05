/**
 * Besu duman testi (YALNIZ yerel geliştirme ya da test/staging zinciri):
 *   npm run chain:besu:start && npm run chain:besu:deploy
 *   npx tsx apps/chain-indexer/scripts/besu-smoke.ts [rpc] [--archive-dir <klasör>] [--open-only]   # rpc: http://127.0.0.1:8546
 *   npm run chain:besu:stop
 * Zincirin saatine göre fikstür arşivi üretir (apps/chain-indexer/test/fixture.ts), bir yayın klasörüne yazar ve
 * `trust:chain-replay`'i (yazım + eşdeğerlik) o klasörle çalıştırır. Çıkış kodu komutunkidir (0 = eşdeğer).
 *   --archive-dir  arşiv bu klasöre yazılır ve silinmez; klasörde arşiv varsa YENİDEN KULLANILIR (aynı plan özeti — yarıda kalan
 *                  koşu kaldığı yerden sürer; network/testnet/bootstrap-governance.sh). Yoksa geçici klasör, sonunda silinir.
 *   --open-only    yalnız göç pencerelerini açar (trust:chain-replay --open-only).
 * Test/staging zincirinde (31339) anahtarlar ve dağıtım dosyası ortamdan: TAMGA_CHAIN_KEYS, TAMGA_CHAIN_DEPLOYMENT.
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { JsonRpcProvider } from "ethers";

import { chainReplayCommand } from "../../trust-publisher/src/chain/replay-cli.js";
import { buildFixture, writeFixtureDist } from "../test/fixture.js";

const argv = process.argv.slice(2);
const k = argv.indexOf("--archive-dir");
const archiveDir = k >= 0 ? resolve(argv[k + 1] ?? "") : null;
const rpc = argv.find((a, i) => !a.startsWith("--") && (k < 0 || i !== k + 1)) ?? "http://127.0.0.1:8546";
const passThrough = argv.filter((a) => a === "--open-only");

let dist: string;
if (archiveDir && existsSync(join(archiveDir, "lotl.jws"))) {
  dist = archiveDir;
  console.error(`besu-smoke: arşiv yeniden kullanılıyor (${dist})`);
} else {
  const provider = new JsonRpcProvider(rpc);
  const now = (await provider.getBlock("latest"))!.timestamp;
  provider.destroy();
  const f = await buildFixture(now);
  if (archiveDir) mkdirSync(archiveDir, { recursive: true });
  dist = archiveDir ?? mkdtempSync(join(tmpdir(), "tamga-replay-"));
  writeFixtureDist(f, dist);
}
const t0 = Date.now();
const code = await chainReplayCommand(["--archive", dist, ...passThrough], {
  dist,
  environment: "production",
  env: { ...process.env, TAMGA_CHAIN_ENABLED: "1", TAMGA_CHAIN_RPC_URL: rpc },
  // fikstürün iptal listesi adresleri uydurmadır: bit sayısı satırda olmayan liste varsayılanla yazılır (yerel / test zinciri)
  fetchText: () => Promise.reject(new Error("fikstür: ağ yok")),
});
console.error(`besu-smoke: çıkış ${code}, ${Math.round((Date.now() - t0) / 1000)} sn`);
if (!archiveDir) rmSync(dist, { recursive: true, force: true });
process.exit(code);
