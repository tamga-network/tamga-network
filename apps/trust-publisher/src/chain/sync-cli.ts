/**
 * `trust:chain-sync` — sürekli projeksiyon (ADR-0085; ADR-0084 liste kaynak, zincir tanık). Ad öneridir, onay bekler.
 *   chain-sync [--dry-run] [--max-writes <n>]
 * Adımlar: durum dosyası (`<dist>/chain-sync.json`: son yansıtılan liste sürümleri, çapa satırı, plan anı) → arşivi oku ve doğrula →
 * farkı planla (sync-plan.ts) → (yazımda) göç penceresi kapalı mı → farkı blok anıyla yaz (sync-exec.ts) → tamamsa durum ilerler.
 * Varsayılan yalnız plan: `TAMGA_CHAIN_ENABLED` kapalıyken ya da `--dry-run` ile zincire bağlanılmaz, durum dosyası yazılmaz.
 * Başlangıç noktası göçtür: `trust:chain-replay` eşdeğerlik farksız geçince durum dosyasını yazar; dosya yoksa bu komut yazmaz.
 * Yazım YALNIZ yerel geliştirme zincirine (Hardhat 31337, yerel Besu 31338) ve test/staging zincirine (31339; `TAMGA_CHAIN_KEYS`,
 * `TAMGA_CHAIN_DEPLOYMENT`). Gerçek ağa yazma yolu yoktur (SP7): plan basılır, yazılmaz.
 * Eksik koşu (düşen işlem, Governance oyu bekleyen kayıt, yazım bütçesi) durumu ilerletmez; fark sonraki koşuda yine denenir (SP5).
 * Çıkış: 0 tamam · 2 kapı / yapılandırma / başlangıç yok · 5 eksik koşu (alarm).
 *
 * `chainAfterPublish`: liste yayınından ve çapa satırından sonra çağrılan kanca (cli.ts). Bayrak kapalıyken HİÇBİR ŞEY yapmaz
 * (bağlantı yok, dosya yok, çıktı yok). Açıkken önce chain-sync, sonra chain-submit; hata liste yayınını durdurmaz (LS4, SP5):
 * yalnız alarm satırı basılır, yayın komutunun çıkış kodu değişmez.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JsonRpcProvider } from "ethers";

import { STAGING_CHAIN_IDS, keyMapSigners, loadChainKeys } from "../../../chain-indexer/src/chain-keys.js";
import { UNCACHED_PROVIDER, addressesFrom, connectTrustContracts } from "../../../chain-indexer/src/contracts.js";
import { LOCAL_CHAIN_IDS, localDevSigners, type DevDeployment } from "../../../chain-indexer/src/local-dev.js";
import { readArchiveDir, verifyArchive } from "../../../chain-indexer/src/replay-archive.js";
import type { ReplaySigners } from "../../../chain-indexer/src/replay-exec.js";
import { DEFAULT_MAX_WRITES, executeChainSync } from "../../../chain-indexer/src/sync-exec.js";
import type { ArchiveSet } from "../../../chain-indexer/src/replay-plan.js";
import { assertEnvironmentAllowed, type Environment } from "./projection.js";
import { planChainSync, sliceArchive, syncPointOf, type SyncPoint } from "./sync-plan.js";

export const SYNC_STATE_FILE = "chain-sync.json";
export const SYNC_STATE_FORMAT = "tamga-chain-sync-state/1";
/** SP2: bu kadar saniyeden uzun gecikme alarm üretir (saatlik çapa kadansının iki katı). */
export const SYNC_LAG_ALARM_SEC = 7200;

export interface SyncState {
  format: typeof SYNC_STATE_FORMAT;
  environment: Environment;
  chainId: number;
  /** son TAM koşunun noktası (başlangıç: göçün planı) */
  point: SyncPoint;
  updated_at: string;
  /** son koşunun özeti (eksik koşu da yazılır; nokta ilerlemez) */
  last_run?: { at: string; complete: boolean; written: number; failed: number; pending: number; deferred: number };
}

export function readSyncState(dir: string): SyncState | null {
  const f = resolve(dir, SYNC_STATE_FILE);
  if (!existsSync(f)) return null;
  const s = JSON.parse(readFileSync(f, "utf8")) as SyncState;
  if (s.format !== SYNC_STATE_FORMAT) throw new Error(`chain-sync: durum dosyası biçimi tanınmıyor: ${s.format}`);
  return s;
}

export function writeSyncState(dir: string, s: SyncState): void {
  writeFileSync(resolve(dir, SYNC_STATE_FILE), JSON.stringify(s, null, 2) + "\n");
}

/** Göçten sonra başlangıç noktası (replay-cli.ts eşdeğerlik farksız geçince çağırır). */
export function writeSyncBaseline(dir: string, archive: ArchiveSet, planTime: number, chainId: number): SyncState {
  const s: SyncState = {
    format: SYNC_STATE_FORMAT,
    environment: archive.environment,
    chainId,
    point: syncPointOf(archive, planTime),
    updated_at: new Date().toISOString(),
  };
  writeSyncState(dir, s);
  return s;
}

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

/** Yazım imzacıları: yalnız yerel geliştirme ve test/staging zinciri. Gerçek ağda null (yazma yolu yok — SP7). */
async function signersFor(
  provider: JsonRpcProvider,
  chainId: number,
  env: NodeJS.ProcessEnv,
): Promise<{ deployment: DevDeployment; signers: ReplaySigners } | { error: string }> {
  if (LOCAL_CHAIN_IDS.has(chainId)) {
    const file = resolve(DEPLOYMENTS, DEPLOYMENT_OF[chainId]);
    if (!existsSync(file)) return { error: `dağıtım dosyası yok: ${file}` };
    const deployment = JSON.parse(readFileSync(file, "utf8")) as DevDeployment;
    return { deployment, signers: await localDevSigners(provider, deployment) };
  }
  if (STAGING_CHAIN_IDS.has(chainId)) {
    const keys = env.TAMGA_CHAIN_KEYS;
    const dep = env.TAMGA_CHAIN_DEPLOYMENT;
    if (!keys || !dep || !existsSync(dep))
      return { error: `test/staging zinciri (chainId ${chainId}) TAMGA_CHAIN_KEYS ve TAMGA_CHAIN_DEPLOYMENT ister` };
    const deployment = JSON.parse(readFileSync(dep, "utf8")) as DevDeployment;
    if (deployment.chainId !== chainId)
      return { error: `dağıtım dosyası chainId ${deployment.chainId}, zincir ${chainId}` };
    return { deployment, signers: await keyMapSigners(provider, loadChainKeys(keys), deployment.contracts.Governance) };
  }
  return {
    error: `gerçek ağa yazma yolu yok (chainId ${chainId}; ADR-0085 SP7) — önce test ağı, anahtar yolu ve ikinci işletmeci`,
  };
}

export async function chainSyncCommand(
  args: string[],
  ctx: { dist: string; environment: Environment; env: NodeJS.ProcessEnv; now?: () => number },
): Promise<number> {
  const state = readSyncState(ctx.dist);
  if (!state) {
    console.error(
      `chain-sync: başlangıç noktası yok (${SYNC_STATE_FILE}) — önce trust:chain-replay (göç) eşdeğerlik farksız bitmeli`,
    );
    return 2;
  }
  if (state.environment !== ctx.environment) {
    console.error(`chain-sync: durum dosyası ortamı ${state.environment}, yayıncı ${ctx.environment} — yazılmadı`);
    return 2;
  }
  const k = args.indexOf("--max-writes");
  const maxWrites = k >= 0 ? Number(args[k + 1]) : DEFAULT_MAX_WRITES;
  if (!Number.isInteger(maxWrites) || maxWrites < 0) throw new Error("chain-sync: --max-writes tam sayı olmalı");
  const archive = readArchiveDir(ctx.dist, ctx.environment);
  await verifyArchive(archive); // sağlıksız set yansıtılmaz
  const now = ctx.now?.() ?? Math.floor(Date.now() / 1000);
  const plan = planChainSync(
    { archive: sliceArchive(archive, state.point), planTime: state.point.planTime },
    { archive, planTime: Math.max(now, state.point.planTime) },
  );
  const head = {
    from: plan.from,
    to: plan.to,
    level: plan.level,
    operations: plan.ops.length,
    collapsed: plan.collapsed,
    summary: plan.summary,
    warnings: plan.warnings,
  };
  const dryRun = args.includes("--dry-run") || ctx.env.TAMGA_CHAIN_ENABLED !== "1";
  if (dryRun) {
    console.log(JSON.stringify({ ...head, dryRun: true, ops: plan.ops }, null, 2));
    return 0;
  }
  const rpc = ctx.env.TAMGA_CHAIN_RPC_URL;
  if (!rpc || !/^https?:\/\//.test(rpc)) throw new Error("chain-sync: TAMGA_CHAIN_RPC_URL gerekir (http/https)");
  const provider = new JsonRpcProvider(rpc, undefined, UNCACHED_PROVIDER);
  const chainId = Number((await provider.getNetwork()).chainId);
  assertEnvironmentAllowed(ctx.environment, chainId); // PJ4
  if (state.chainId !== chainId) {
    console.error(`chain-sync: durum dosyası zinciri ${state.chainId}, bağlanılan ${chainId} — yazılmadı`);
    return 2;
  }
  const who = await signersFor(provider, chainId, ctx.env);
  if ("error" in who) {
    console.log(JSON.stringify({ ...head, dryRun: true, refused: who.error }, null, 2));
    console.error(`chain-sync: ${who.error} — yazılmadı`);
    return 2;
  }
  const contracts = connectTrustContracts(addressesFrom(who.deployment), provider);
  const report = await executeChainSync(plan.ops, contracts, who.signers, { maxWrites });
  const at = new Date().toISOString();
  const lastRun = {
    at,
    complete: report.complete,
    written: report.written,
    failed: report.failed.length,
    pending: report.pendingGovernance.length,
    deferred: report.deferred,
  };
  writeSyncState(ctx.dist, {
    ...state,
    ...(report.complete ? { point: plan.to, updated_at: at } : {}),
    last_run: lastRun,
  });
  console.log(JSON.stringify({ ...head, report }, null, 2));
  if (report.maxLagSec > SYNC_LAG_ALARM_SEC)
    console.error(
      `chain-sync: ALARM — projeksiyon gecikmesi ${report.maxLagSec} sn (sınır ${SYNC_LAG_ALARM_SEC}; SP2)`,
    );
  if (!report.complete) {
    console.error(
      `chain-sync: ALARM — eksik koşu (düşen ${report.failed.length}, oy bekleyen ${report.pendingGovernance.length}, ` +
        `sonraya kalan ${report.deferred}); liste yayını etkilenmez, fark sonraki koşuda yine denenir (SP5)`,
    );
    return 5;
  }
  return 0;
}

/**
 * Yayın kancası (ADR-0085 SP1, SP5, SP7; ADR-0051 K4): liste yayınından, saatlik satırdan ve iptal listesi satırından sonra.
 * Bayrak kapalıyken hiçbir şey yapmaz. Hiçbir zaman hata fırlatmaz; dönen değer yalnız bilgi içindir.
 */
export async function chainAfterPublish(
  ctx: { dist: string; environment: Environment; env?: NodeJS.ProcessEnv },
  steps?: {
    sync: (ctx: { dist: string; environment: Environment; env: NodeJS.ProcessEnv }) => Promise<number>;
    submit: (ctx: { dist: string; environment: Environment; env: NodeJS.ProcessEnv }) => Promise<number>;
  },
): Promise<{ ran: boolean; results: Array<{ step: string; code: number | null; error?: string }> }> {
  const env = ctx.env ?? process.env;
  if (env.TAMGA_CHAIN_ENABLED !== "1") return { ran: false, results: [] };
  const c = { dist: ctx.dist, environment: ctx.environment, env };
  const run = steps ?? {
    sync: (x) => chainSyncCommand([], x),
    submit: async (x) => (await import("./cli.js")).chainCommand("chain-submit", [], x),
  };
  const results: Array<{ step: string; code: number | null; error?: string }> = [];
  for (const [step, fn] of [
    ["chain-sync", run.sync],
    ["chain-submit", run.submit],
  ] as const) {
    try {
      const code = await fn(c);
      results.push({ step, code });
      if (code !== 0) console.error(JSON.stringify({ chain_hook: "alarm", step, code }));
    } catch (e) {
      const error = (e as Error).message.slice(0, 300);
      results.push({ step, code: null, error });
      console.error(JSON.stringify({ chain_hook: "alarm", step, error }));
    }
  }
  return { ran: true, results };
}
