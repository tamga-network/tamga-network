/**
 * `trust:chain-replay` (ADR-0073 K1, K6; ADR-0009 K7) — imzalı liste arşivinin kontratlara yeniden oynatılması.
 *   chain-replay [--dry-run] [--archive <dist klasörü>]
 * Adımlar: arşivi oku ve doğrula (imza, sürüm zinciri, çapa zinciri) → deterministik plan + `replayPlanHash` → (yazımda) göç
 * penceresi bu planın özetiyle açık mı → işlemleri kaldığı yerden yaz → indeksle → eşdeğerlik testi (CE6).
 * Varsayılan yalnız plan: `TAMGA_CHAIN_ENABLED` kapalıyken ya da `--dry-run` ile hiçbir bağlantı kurulmaz ve hiçbir şey yazılmaz.
 * Yazım:
 *   - yerel geliştirme zinciri (Hardhat 31337, yerel Besu 31338): dağıtım dosyası `contracts/deployments/<ağ>.json`, Hardhat'in
 *     herkese açık test hesapları; pencere yoksa Governance oyuyla açılır (yalnız yerel);
 *   - gerçek ağ: `TAMGA_CONFIRM_PROD=<plan özeti>` kapısı; pencere üyelerin oyuyla önceden açılmış olmalı. Devlet delegesi ve göç
 *     yürütücüsü anahtarlarının yapılandırması henüz tanımlı değil (ad onayı bekliyor) — kapıdan sonra yine durur.
 *   - sandbox seti yalnız yerel zincire (ADR-0074 K7 / PJ4).
 * Çıkış: 0 tamam · 2 kapı / yapılandırma · 3 eşdeğerlik farkı (göç kapanmaz) · 4 Governance oyu bekleniyor.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JsonRpcProvider } from "ethers";

import { ChainTrustSource } from "../../../chain-indexer/src/chain-trust-source.js";
import { UNCACHED_PROVIDER, addressesFrom, connectTrustContracts } from "../../../chain-indexer/src/contracts.js";
import { compareSources } from "../../../chain-indexer/src/equivalence.js";
import { ChainIndexer } from "../../../chain-indexer/src/indexer.js";
import { LOCAL_CHAIN_IDS, localDevSigners, type DevDeployment } from "../../../chain-indexer/src/local-dev.js";
import { listSourceFromArchive, readArchiveDir, verifyArchive } from "../../../chain-indexer/src/replay-archive.js";
import { executeReplay, openMigrationWindows } from "../../../chain-indexer/src/replay-exec.js";
import { buildReplayPlan } from "../../../chain-indexer/src/replay-plan.js";
import { assertEnvironmentAllowed, type Environment } from "./projection.js";

const DEPLOYMENTS = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
  "contracts",
  "deployments",
);
const DEPLOYMENT_OF: Record<number, string> = { 31337: "localhost.json", 31338: "besuDev.json" };

export async function chainReplayCommand(
  args: string[],
  ctx: { dist: string; environment: Environment; env: NodeJS.ProcessEnv },
): Promise<number> {
  const k = args.indexOf("--archive");
  const dir = k >= 0 ? resolve(args[k + 1] ?? "") : ctx.dist;
  const archive = readArchiveDir(dir, ctx.environment);
  const counts = await verifyArchive(archive);
  const plan = buildReplayPlan(archive);
  const dryRun = args.includes("--dry-run") || ctx.env.TAMGA_CHAIN_ENABLED !== "1";
  const head = {
    replayPlanHash: plan.hash,
    planTime: new Date(plan.planTime * 1000).toISOString(),
    archive: counts,
    operations: plan.ops.length,
    summary: plan.summary,
    warnings: plan.warnings,
  };
  if (dryRun) {
    console.log(JSON.stringify({ ...head, dryRun: true, plan }, null, 2));
    return 0;
  }
  const rpc = ctx.env.TAMGA_CHAIN_RPC_URL;
  if (!rpc || !/^https?:\/\//.test(rpc)) throw new Error("chain-replay: TAMGA_CHAIN_RPC_URL gerekir (http/https)");
  const provider = new JsonRpcProvider(rpc, undefined, UNCACHED_PROVIDER);
  const chainId = Number((await provider.getNetwork()).chainId);
  assertEnvironmentAllowed(ctx.environment, chainId); // PJ4
  if (!LOCAL_CHAIN_IDS.has(chainId)) {
    if (ctx.env.TAMGA_CONFIRM_PROD !== plan.hash) {
      console.error(`chain-replay: gerçek ağa yazım TAMGA_CONFIRM_PROD=${plan.hash} ister (plan özeti) — yazılmadı`);
      return 2;
    }
    if (plan.ops.some((o) => o.op === "registerList" && o.params === "default")) {
      console.error(
        "chain-replay: iptal listelerinin bit sayısı ve boyutu arşivde yok — gerçek ağda varsayılan yazılmaz",
      );
      return 2;
    }
    console.error(
      "chain-replay: gerçek ağ için devlet delegesi ve göç yürütücüsü anahtar yapılandırması henüz tanımlı değil — yazılmadı",
    );
    return 2;
  }
  const file = resolve(DEPLOYMENTS, DEPLOYMENT_OF[chainId]);
  if (!existsSync(file)) throw new Error(`chain-replay: dağıtım dosyası yok: ${file} (önce chain:besu:deploy)`);
  const deployment = JSON.parse(readFileSync(file, "utf8")) as DevDeployment;
  const contracts = connectTrustContracts(addressesFrom(deployment), provider);
  const signers = await localDevSigners(provider, deployment);
  await openMigrationWindows(contracts, signers.governance!, plan.hash, await signers.executor.getAddress());
  let done = 0;
  const report = await executeReplay(plan, contracts, signers, {
    onProgress: () => {
      if (++done % 20 === 0) console.error(`chain-replay: ${done}/${plan.ops.length}`);
    },
  });
  if (report.pendingGovernance) {
    console.log(JSON.stringify({ ...head, report }, null, 2));
    console.error(
      `chain-replay: Governance oyu gerekiyor (#${report.pendingGovernance.seq} ${report.pendingGovernance.op})`,
    );
    return 4;
  }
  // ADR-0073 K6: eşdeğerlik — liste son sürümleri ile indeks ve kontrat okuması aynı cevabı vermeli
  const now = new Date((plan.planTime + 60) * 1000);
  const { store, source: list } = await listSourceFromArchive(archive, now);
  const indexer = new ChainIndexer(provider, contracts);
  const block = await indexer.sync();
  const chain = new ChainTrustSource(indexer.index, {
    now: () => now,
    dnsNames: [...store.relying_parties_by_dns.keys()],
  });
  const eq = await compareSources(store, list, chain, { contracts, blockTag: block });
  console.log(JSON.stringify({ ...head, report, equivalence: eq }, null, 2));
  return eq.decisionDifferences > 0 || eq.unexpected > 0 ? 3 : 0;
}
