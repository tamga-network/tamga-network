/**
 * Yerel Besu duman testi (YALNIZ yerel geliştirme zinciri; elle çalıştırılır, CI'da değil):
 *   npm run chain:besu:start && npm run chain:besu:deploy
 *   npx tsx apps/chain-indexer/scripts/besu-smoke.ts [rpc]        # varsayılan http://127.0.0.1:8546
 *   npm run chain:besu:stop
 * Zincirin saatine göre fikstür arşivi üretir (apps/chain-indexer/test/fixture.ts), geçici bir yayın klasörüne yazar ve
 * `trust:chain-replay`'i (yazım + eşdeğerlik) o klasörle çalıştırır. Çıkış kodu komutunkidir (0 = eşdeğer).
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonRpcProvider } from "ethers";

import { chainReplayCommand } from "../../trust-publisher/src/chain/replay-cli.js";
import { buildFixture, writeFixtureDist } from "../test/fixture.js";

const rpc = process.argv[2] ?? "http://127.0.0.1:8546";
const provider = new JsonRpcProvider(rpc);
const now = (await provider.getBlock("latest"))!.timestamp;
const f = await buildFixture(now);
const dist = mkdtempSync(join(tmpdir(), "tamga-replay-"));
writeFixtureDist(f, dist);
const t0 = Date.now();
const code = await chainReplayCommand(["--archive", dist], {
  dist,
  environment: "production",
  env: { ...process.env, TAMGA_CHAIN_ENABLED: "1", TAMGA_CHAIN_RPC_URL: rpc },
});
console.error(`besu-smoke: çıkış ${code}, ${Math.round((Date.now() - t0) / 1000)} sn`);
rmSync(dist, { recursive: true, force: true });
provider.destroy();
process.exit(code);
