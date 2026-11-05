/**
 * `trust:chain-replay` (ADR-0073 K1, K6; ADR-0009 K7) — imzalı liste arşivinin kontratlara yeniden oynatılması.
 *   chain-replay [--dry-run] [--archive <dist klasörü>]
 * Adımlar: arşivi oku ve doğrula (imza, sürüm zinciri, çapa zinciri) → deterministik plan + `replayPlanHash` → (yazımda) göç
 * penceresi bu planın özetiyle açık mı → işlemleri kaldığı yerden yaz → indeksle → eşdeğerlik testi (CE6).
 * Varsayılan yalnız plan: `TAMGA_CHAIN_ENABLED` kapalıyken ya da `--dry-run` ile zincire bağlanılmaz ve hiçbir şey yazılmaz.
 * İptal listesinin bit sayısı ve boyutu çapa satırında yoksa (eski satırlar) planı kuran araç listeyi adresinden okur (yalnız
 * https; belirtecin `sub`'ı adresle aynı olmalı) — plan özeti bu değerleri içerir, herkes aynı adresten yeniden üretebilir. Okunamazsa
 * varsayılan planlanır ve gerçek ağa yazım reddedilir.
 * Yazım:
 *   - yerel geliştirme zinciri (Hardhat 31337, yerel Besu 31338): dağıtım dosyası `contracts/deployments/<ağ>.json`, Hardhat'in
 *     herkese açık test hesapları; pencere yoksa Governance oyuyla açılır (yalnız yerel);
 *   - test/staging zinciri (`STAGING_CHAIN_IDS`, 31339; GUIDE-0018 yol C): dağıtım dosyası `TAMGA_CHAIN_DEPLOYMENT`, anahtarlar
 *     `TAMGA_CHAIN_KEYS` anahtar haritasından (`tamga-chain-keys/1`, apps/chain-indexer/src/chain-keys.ts): devlet delegeleri, göç
 *     yürütücüsü, Governance oyu = zincirde aktif üyelerin doğrulayıcıları; pencere yoksa oyla açılır;
 *   - gerçek ağ: `TAMGA_CONFIRM_PROD=<plan özeti>` kapısı; pencere üyelerin oyuyla önceden açılmış olmalı. Gerçek ağın devlet
 *     delegesi ve göç yürütücüsü anahtarları HSM'dedir; yapılandırması tanımlı değil — kapıdan sonra yine durur.
 *   - sandbox seti yalnız yerel zincire (ADR-0074 K7 / PJ4).
 *   `--open-only`: yalnız göç pencerelerini açar (plan özeti + yürütücü) ve durur — yol C'de izin listesi, yürütücü listeye girdikten
 *   sonra yeniden üretilsin diye (ADR-0052 K2 notu 2026-11-05).
 * Çıkış: 0 tamam · 2 kapı / yapılandırma · 3 eşdeğerlik farkı (göç kapanmaz) · 4 Governance oyu bekleniyor.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JsonRpcProvider } from "ethers";

import { ChainTrustSource } from "../../../chain-indexer/src/chain-trust-source.js";
import { UNCACHED_PROVIDER, addressesFrom, connectTrustContracts } from "../../../chain-indexer/src/contracts.js";
import { STAGING_CHAIN_IDS, keyMapSigners, loadChainKeys } from "../../../chain-indexer/src/chain-keys.js";
import { compareSources } from "../../../chain-indexer/src/equivalence.js";
import { ChainIndexer } from "../../../chain-indexer/src/indexer.js";
import { LOCAL_CHAIN_IDS, localDevSigners, type DevDeployment } from "../../../chain-indexer/src/local-dev.js";
import { listSourceFromArchive, readArchiveDir, verifyArchive } from "../../../chain-indexer/src/replay-archive.js";
import { executeReplay, openMigrationWindows, type ReplaySigners } from "../../../chain-indexer/src/replay-exec.js";
import { buildReplayPlan, statusListUrisMissingParams } from "../../../chain-indexer/src/replay-plan.js";
import { assertEnvironmentAllowed, statusListRegistrationOf, type Environment } from "./projection.js";

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

/** Belirteci adresinden okur (yalnız https; 10 sn). */
async function fetchToken(uri: string): Promise<string> {
  if (!/^https:\/\//.test(uri)) throw new Error("yalnız https");
  const r = await fetch(uri, { signal: AbortSignal.timeout(10_000), redirect: "error" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

/**
 * Çapa satırında bit sayısı ve boyutu olmayan iptal listelerinin değerleri belirteçten (`statusListRegistrationOf`). Okunamayan liste
 * uyarıyla atlanır (plan varsayılanı yazar, gerçek ağ yazımı reddeder).
 */
export async function statusListParamsFromTokens(
  uris: string[],
  fetchText: (uri: string) => Promise<string> = fetchToken,
): Promise<{ params: Map<string, { bits: number; size: number }>; warnings: string[] }> {
  const params = new Map<string, { bits: number; size: number }>();
  const warnings: string[] = [];
  for (const uri of uris)
    try {
      const reg = statusListRegistrationOf(await fetchText(uri));
      if (reg.listURI !== uri) throw new Error(`belirtecin sub'ı farklı (${reg.listURI})`);
      if (!Number.isInteger(reg.listSize) || reg.listSize <= 0) throw new Error("liste boyutu geçersiz");
      params.set(uri, { bits: reg.bitsPerEntry, size: reg.listSize });
    } catch (e) {
      warnings.push(`iptal listesi ${uri}: belirteç okunamadı — ${(e as Error).message}`);
    }
  return { params, warnings };
}

export async function chainReplayCommand(
  args: string[],
  ctx: {
    dist: string;
    environment: Environment;
    env: NodeJS.ProcessEnv;
    /** test: belirteç okuyucu (varsayılan https) */
    fetchText?: (uri: string) => Promise<string>;
  },
): Promise<number> {
  const k = args.indexOf("--archive");
  const dir = k >= 0 ? resolve(args[k + 1] ?? "") : ctx.dist;
  const archive = readArchiveDir(dir, ctx.environment);
  const counts = await verifyArchive(archive);
  const fetched = await statusListParamsFromTokens(statusListUrisMissingParams(archive), ctx.fetchText);
  const plan = buildReplayPlan(archive, { statusListParams: (u) => fetched.params.get(u) ?? null });
  plan.warnings.push(...fetched.warnings);
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
  let deployment: DevDeployment;
  let signers: ReplaySigners;
  if (LOCAL_CHAIN_IDS.has(chainId)) {
    const file = resolve(DEPLOYMENTS, DEPLOYMENT_OF[chainId]);
    if (!existsSync(file)) throw new Error(`chain-replay: dağıtım dosyası yok: ${file} (önce chain:besu:deploy)`);
    deployment = JSON.parse(readFileSync(file, "utf8")) as DevDeployment;
    signers = await localDevSigners(provider, deployment);
  } else if (STAGING_CHAIN_IDS.has(chainId)) {
    // GUIDE-0018 yol C: test/staging zinciri, anahtarlar haritadan (Hardhat test anahtarları burada kullanılmaz)
    const keysFile = ctx.env.TAMGA_CHAIN_KEYS;
    const depFile = ctx.env.TAMGA_CHAIN_DEPLOYMENT;
    if (!keysFile || !depFile || !existsSync(depFile)) {
      console.error(
        `chain-replay: test/staging zinciri (chainId ${chainId}) TAMGA_CHAIN_KEYS ve TAMGA_CHAIN_DEPLOYMENT ister — yazılmadı`,
      );
      return 2;
    }
    deployment = JSON.parse(readFileSync(depFile, "utf8")) as DevDeployment;
    if (deployment.chainId !== chainId) {
      console.error(`chain-replay: dağıtım dosyası chainId ${deployment.chainId}, zincir ${chainId} — yazılmadı`);
      return 2;
    }
    signers = await keyMapSigners(provider, loadChainKeys(keysFile), deployment.contracts.Governance);
    if (plan.ops.some((o) => o.op === "registerList" && o.params === "default"))
      console.error(
        "chain-replay: UYARI — bazı iptal listelerinin bit sayısı ve boyutu bilinmiyor, varsayılan yazılıyor (yalnız test/staging)",
      );
  } else {
    if (ctx.env.TAMGA_CONFIRM_PROD !== plan.hash) {
      console.error(`chain-replay: gerçek ağa yazım TAMGA_CONFIRM_PROD=${plan.hash} ister (plan özeti) — yazılmadı`);
      return 2;
    }
    if (plan.ops.some((o) => o.op === "registerList" && o.params === "default")) {
      console.error(
        "chain-replay: bazı iptal listelerinin bit sayısı ve boyutu ne çapa satırında ne belirteçte — gerçek ağda varsayılan yazılmaz",
      );
      return 2;
    }
    console.error(
      "chain-replay: gerçek ağın devlet delegesi ve göç yürütücüsü anahtarları HSM'dedir; yapılandırması tanımlı değil — yazılmadı",
    );
    return 2;
  }
  const contracts = connectTrustContracts(addressesFrom(deployment), provider);
  await openMigrationWindows(contracts, signers.governance!, plan.hash, await signers.executor.getAddress());
  if (args.includes("--open-only")) {
    console.log(JSON.stringify({ ...head, migration: "open", executor: await signers.executor.getAddress() }, null, 2));
    return 0;
  }
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
