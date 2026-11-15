/**
 * `trust:chain-health` — zincir izleme ve alarm (ADR-0084 LS5, ADR-0085 SP2/SP5, ADR-0051 CH1, ADR-0053). Ad önerisi.
 *
 *   chain-health [--monitor] [--block-stall-sec <n>]
 *
 * Makine okunur tek bir JSON (`tamga-chain-health/1`) basar; `--monitor` ile her uyarı/alarm için bir satır
 * (`[!] chain: <KOD> <ileti>`) — işletmecinin izleme betiği (ör. tamga-platform `ops/server/monitor.sh`) bu satırları kendi
 * sorun listesine ekler; satır yoksa sorun yoktur. Arayüz belgesi: docs/guides/chain-testnet.md "Zincir sağlığı".
 *
 * Denetimler (hepsi yalnız okur; hiçbir şey yazmaz, liste yayınını etkilemez — LS4):
 *   chain    blok yüksekliği ve son bloğun yaşı (blok durması), eş sayısı (`net_peerCount`, varsa)
 *   sync     sürekli projeksiyonun durum dosyası (`<dist>/chain-sync.json`): son koşu eksik mi (SP5), yayımlanmış ama zincire
 *            yansıtılmamış en eski liste sürümü / çapa satırının yaşı (SP2: iki saat)
 *   anchors  liste çapası kaydına karşı kuru `chain-submit` kararları ve `chain-check`: onaylı FARKLI özet (NO / CONFLICT),
 *            bekleyen rakip aday (CONTEST), iki saatten uzun çapalanmamış sürüm
 * Bayrak `TAMGA_CHAIN_ENABLED` kapalıyken zincire bağlanılmaz: `status: "disabled"`, alarm yok, çıkış 0 (bugünkü canlı durum).
 * Çıkış: 0 ok / disabled · 4 uyarı · 5 alarm.
 *
 * Alarm kodları (kapalı küme; yalnız sona eklenir):
 *   CHAIN_UNREACHABLE (alarm) · BLOCK_STALL (alarm) · PEERS_NONE (uyarı) · CONFIG_INCOMPLETE (uyarı) · SYNC_NO_BASELINE (uyarı)
 *   SYNC_INCOMPLETE (alarm) · SYNC_LAG (alarm) · ANCHOR_NO (alarm) · ANCHOR_CONFLICT (alarm) · ANCHOR_CONTEST (alarm)
 *   ANCHOR_LAG (alarm) · DIST_UNREADABLE (uyarı)
 * İletilerde kişi verisi yoktur (liste adı, sürüm, süre, kod).
 */
import { existsSync } from "node:fs";
import { JsonRpcProvider } from "ethers";
import type { Tri } from "@tamga-network/trust";

import { UNCACHED_PROVIDER } from "../../../chain-indexer/src/contracts.js";
import { readArchiveDir } from "../../../chain-indexer/src/replay-archive.js";
import type { ArchiveSet } from "../../../chain-indexer/src/replay-plan.js";
import { anchorDist, type AnchorReport } from "./anchor.js";
import { EthersChainClient, type ChainClient } from "./client.js";
import type { Environment } from "./projection.js";
import { SYNC_LAG_ALARM_SEC, readSyncState, type SyncState } from "./sync-cli.js";
import { checkDistAnchored, type ChainCheck } from "./verify.js";

export const HEALTH_FORMAT = "tamga-chain-health/1";
export const DEFAULT_BLOCK_STALL_SEC = 60;

export const ALARM_CODES = [
  "CHAIN_UNREACHABLE",
  "BLOCK_STALL",
  "PEERS_NONE",
  "CONFIG_INCOMPLETE",
  "SYNC_NO_BASELINE",
  "SYNC_INCOMPLETE",
  "SYNC_LAG",
  "ANCHOR_NO",
  "ANCHOR_CONFLICT",
  "ANCHOR_CONTEST",
  "ANCHOR_LAG",
  "DIST_UNREADABLE",
] as const;
export type AlarmCode = (typeof ALARM_CODES)[number];

export interface Alarm {
  code: AlarmCode;
  severity: "warn" | "alarm";
  message: string;
}

export interface ChainHealth {
  format: typeof HEALTH_FORMAT;
  checked_at: string;
  environment: Environment;
  chain_enabled: boolean;
  status: "disabled" | "ok" | "warn" | "alarm";
  alarms: Alarm[];
  thresholds: { lag_alarm_sec: number; block_stall_sec: number };
  chain?:
    | { chain_id: number; block: number; block_time: number; block_age_sec: number; peers: number | null }
    | { error: string };
  sync?: {
    state: "missing" | "ok" | "incomplete" | "behind";
    point_updated_at: string | null;
    last_run: SyncState["last_run"] | null;
    /** yayımlanmış ama zincire yansıtılmamış en eski sürümün/satırın yaşı (sn; 0 = geride değil) */
    lag_sec: number;
    unreflected: { lists: number; anchor_lines: number };
  };
  anchors?:
    | {
        lists: Array<{ file: string; version: number; anchored: Tri }>;
        decisions: { conflict: number; contest: number; pending: number; oldest_pending_age_sec: number };
      }
    | { skipped: string };
}

// -----------------------------------------------------------------------------------------------------------------
// Saf değerlendirme (testler doğrudan çağırır)
// -----------------------------------------------------------------------------------------------------------------

export interface HealthInputs {
  now: number;
  environment: Environment;
  enabled: boolean;
  blockStallSec?: number;
  block?: { chainId: number; number: number; timestamp: number; peers: number | null } | { error: string };
  sync?: { state: SyncState | null; unreflectedLists: number[]; unreflectedAnchorTimes: number[] } | { error: string };
  anchors?: { checks: ChainCheck[]; report: AnchorReport; pendingIssuedAt: number[] } | { skipped: string };
}

export function evaluateHealth(i: HealthInputs): ChainHealth {
  const stall = i.blockStallSec ?? DEFAULT_BLOCK_STALL_SEC;
  const h: ChainHealth = {
    format: HEALTH_FORMAT,
    checked_at: new Date(i.now * 1000).toISOString(),
    environment: i.environment,
    chain_enabled: i.enabled,
    status: "disabled",
    alarms: [],
    thresholds: { lag_alarm_sec: SYNC_LAG_ALARM_SEC, block_stall_sec: stall },
  };
  if (!i.enabled) return h;
  const add = (code: AlarmCode, severity: Alarm["severity"], message: string) =>
    h.alarms.push({ code, severity, message });

  if (i.block) {
    if ("error" in i.block) {
      h.chain = { error: i.block.error };
      add("CHAIN_UNREACHABLE", "alarm", "zincir düğümüne ulaşılamadı");
    } else {
      const age = Math.max(0, i.now - i.block.timestamp);
      h.chain = {
        chain_id: i.block.chainId,
        block: i.block.number,
        block_time: i.block.timestamp,
        block_age_sec: age,
        peers: i.block.peers,
      };
      if (age > stall)
        add("BLOCK_STALL", "alarm", `son blok ${age} sn önce (sınır ${stall} sn) — blok üretimi durmuş olabilir`);
      if (i.block.peers === 0) add("PEERS_NONE", "warn", "düğümün eşi yok (net_peerCount = 0)");
    }
  }

  if (i.sync) {
    if ("error" in i.sync) add("DIST_UNREADABLE", "warn", `yayın klasörü okunamadı: ${i.sync.error}`);
    else {
      const st = i.sync.state;
      const times = [...i.sync.unreflectedLists, ...i.sync.unreflectedAnchorTimes];
      const lag = times.length ? Math.max(0, i.now - Math.min(...times)) : 0;
      const incomplete = st?.last_run ? !st.last_run.complete : false;
      h.sync = {
        state: !st ? "missing" : incomplete ? "incomplete" : times.length ? "behind" : "ok",
        point_updated_at: st?.updated_at ?? null,
        last_run: st?.last_run ?? null,
        lag_sec: lag,
        unreflected: { lists: i.sync.unreflectedLists.length, anchor_lines: i.sync.unreflectedAnchorTimes.length },
      };
      if (!st)
        add("SYNC_NO_BASELINE", "warn", "sürekli projeksiyonun başlangıç noktası yok (chain-sync.json) — göç bitmemiş");
      if (incomplete)
        add(
          "SYNC_INCOMPLETE",
          "alarm",
          `son eşitleme koşusu eksik (düşen ${st!.last_run!.failed}, oy bekleyen ${st!.last_run!.pending}, sonraya kalan ${st!.last_run!.deferred})`,
        );
      if (st && lag > SYNC_LAG_ALARM_SEC)
        add("SYNC_LAG", "alarm", `projeksiyon gecikmesi ${lag} sn (sınır ${SYNC_LAG_ALARM_SEC} sn; ADR-0085 SP2)`);
    }
  }

  if (i.anchors) {
    if ("skipped" in i.anchors) {
      h.anchors = { skipped: i.anchors.skipped };
      add("CONFIG_INCOMPLETE", "warn", i.anchors.skipped);
    } else {
      const d = i.anchors.report.decisions;
      const pendingAge = i.anchors.pendingIssuedAt.length
        ? Math.max(0, i.now - Math.min(...i.anchors.pendingIssuedAt))
        : 0;
      h.anchors = {
        lists: i.anchors.checks.map((c) => ({ file: c.file, version: c.version, anchored: c.anchored })),
        decisions: {
          conflict: d.filter((x) => x.decision === "CONFLICT").length,
          contest: d.filter((x) => x.decision === "CONTEST").length,
          pending: d.filter((x) => x.decision === "ANCHOR").length,
          oldest_pending_age_sec: pendingAge,
        },
      };
      for (const c of i.anchors.checks)
        if (c.anchored === "NO")
          add(
            "ANCHOR_NO",
            "alarm",
            `${c.file} v${c.version}: zincirde onaylı FARKLI özet — imzalı liste geçerli, çift konuşma işareti`,
          );
      for (const x of d) {
        const name = "file" in x ? `${x.file} v${x.version}` : `çapa günlüğü seq ${x.seq}`;
        if (x.decision === "CONFLICT") add("ANCHOR_CONFLICT", "alarm", `${name}: ${x.reason}`);
        if (x.decision === "CONTEST") add("ANCHOR_CONTEST", "alarm", `${name}: bekleyen rakip aday (ADR-0053)`);
      }
      if (pendingAge > SYNC_LAG_ALARM_SEC)
        add(
          "ANCHOR_LAG",
          "alarm",
          `en eski çapalanmamış sürüm ${pendingAge} sn önce yayımlandı (sınır ${SYNC_LAG_ALARM_SEC} sn)`,
        );
    }
  }

  h.status = h.alarms.some((a) => a.severity === "alarm") ? "alarm" : h.alarms.length ? "warn" : "ok";
  return h;
}

/** `--monitor` biçimi: her uyarı/alarm bir satır; sorun yoksa boş. */
export function monitorLines(h: ChainHealth): string[] {
  return h.alarms.map((a) => `[!] chain: ${a.code} ${a.message}`);
}

export const exitCodeOf = (h: ChainHealth) => (h.status === "alarm" ? 5 : h.status === "warn" ? 4 : 0);

// -----------------------------------------------------------------------------------------------------------------
// Okuma (zincir ve yayın klasörü)
// -----------------------------------------------------------------------------------------------------------------

function payload<T>(jws: string): T {
  return JSON.parse(Buffer.from(jws.trim().split(".")[1], "base64url").toString("utf8")) as T;
}
const epoch = (v: unknown) => Math.floor(Date.parse(String(v)) / 1000);

/** Projeksiyon noktasından sonra yayımlanmış liste sürümlerinin ve çapa satırlarının yayın anları. */
export function unreflectedSince(archive: ArchiveSet, state: SyncState | null) {
  const lists: number[] = [];
  const anchors: number[] = [];
  if (!state) return { lists, anchors };
  const each = (file: string, jwss: string[]) => {
    for (const j of jwss) {
      const p = payload<{ version: unknown; issued_at: unknown }>(j);
      const seen = state.point.versions[file];
      if (seen === undefined || Number(p.version) > seen) lists.push(epoch(p.issued_at));
    }
  };
  each("lotl", archive.lotl);
  for (const [f, l] of Object.entries(archive.national)) each(f, l);
  for (const l of archive.anchorsJsonl.split(/\r?\n/).filter((x) => x.trim())) {
    const p = payload<{ seq: unknown; ts: unknown }>(l);
    if (Number(p.seq) > state.point.anchorSeq) anchors.push(epoch(p.ts));
  }
  return { lists, anchors };
}

export async function collectChainHealth(ctx: {
  dist: string;
  environment: Environment;
  env: NodeJS.ProcessEnv;
  blockStallSec?: number;
  now?: () => number;
  /** testler: hazır istemci ve sağlayıcı */
  client?: ChainClient | null;
  provider?: {
    getBlock(t: "latest"): Promise<{ number: number; timestamp: number } | null>;
    getNetwork(): Promise<{ chainId: bigint }>;
    send(m: string, p: unknown[]): Promise<unknown>;
  };
}): Promise<ChainHealth> {
  const enabled = ctx.env.TAMGA_CHAIN_ENABLED === "1";
  const now = ctx.now?.() ?? Math.floor(Date.now() / 1000);
  const base: HealthInputs = { now, environment: ctx.environment, enabled, blockStallSec: ctx.blockStallSec };
  if (!enabled) return evaluateHealth(base);

  const rpc = ctx.env.TAMGA_CHAIN_RPC_URL;
  let provider = ctx.provider;
  let own: JsonRpcProvider | undefined;
  if (!provider) {
    if (!rpc || !/^https?:\/\//.test(rpc))
      return evaluateHealth({ ...base, block: { error: "TAMGA_CHAIN_RPC_URL yok" } });
    own = new JsonRpcProvider(rpc, undefined, UNCACHED_PROVIDER);
    provider = own;
  }
  try {
    try {
      const [b, net] = await Promise.all([provider.getBlock("latest"), provider.getNetwork()]);
      let peers: number | null = null;
      try {
        peers = Number(await provider.send("net_peerCount", []));
      } catch {
        peers = null; // RPC süzgeci ya da yerel Hardhat: bilgi yok
      }
      base.block = { chainId: Number(net.chainId), number: b!.number, timestamp: b!.timestamp, peers };
    } catch (e) {
      base.block = { error: (e as Error).message.slice(0, 200) };
    }

    try {
      const state = readSyncState(ctx.dist);
      const archive = existsSync(ctx.dist) ? readArchiveDir(ctx.dist, ctx.environment) : null;
      const u = archive ? unreflectedSince(archive, state) : { lists: [], anchors: [] };
      base.sync = { state, unreflectedLists: u.lists, unreflectedAnchorTimes: u.anchors };
    } catch (e) {
      base.sync = { error: (e as Error).message.slice(0, 200) };
    }

    const client =
      ctx.client !== undefined
        ? ctx.client
        : ctx.env.TAMGA_CHAIN_ANCHOR_REGISTRY && rpc
          ? new EthersChainClient({ rpcUrl: rpc, registry: ctx.env.TAMGA_CHAIN_ANCHOR_REGISTRY })
          : null;
    if (!client) base.anchors = { skipped: "TAMGA_CHAIN_ANCHOR_REGISTRY yok — liste çapası denetlenmedi" };
    else if (!("error" in (base.block ?? {}))) {
      try {
        const report = await anchorDist(client, ctx.dist, ctx.environment, { dryRun: true, skipVerify: true });
        const checks = await checkDistAnchored(client, ctx.environment, ctx.dist);
        // çapalanmamış (ANCHOR kararı) liste sürümlerinin yayın anı arşivden; bulunamazsa şimdi (gecikme 0 sayılır)
        const pendingIssuedAt = report.decisions.flatMap((d) =>
          d.decision === "ANCHOR" && d.kind === "list" && "file" in d
            ? [archiveIssuedAt(ctx.dist, ctx.environment, d.file, d.version) ?? now]
            : [],
        );
        base.anchors = { checks, report, pendingIssuedAt };
      } catch (e) {
        base.anchors = { skipped: `liste çapası okunamadı: ${(e as Error).message.slice(0, 200)}` };
      }
    }
    return evaluateHealth(base);
  } finally {
    own?.destroy();
  }
}

function archiveIssuedAt(dist: string, environment: Environment, file: string, version: number): number | null {
  try {
    const a = readArchiveDir(dist, environment);
    const list = file === "lotl" ? a.lotl : (a.national[file] ?? []);
    const j = list.find((x) => Number(payload<{ version: unknown }>(x).version) === version);
    return j ? epoch(payload<{ issued_at: unknown }>(j).issued_at) : null;
  } catch {
    return null;
  }
}

export async function chainHealthCommand(
  args: string[],
  ctx: { dist: string; environment: Environment; env: NodeJS.ProcessEnv },
): Promise<number> {
  const k = args.indexOf("--block-stall-sec");
  const blockStallSec = k >= 0 ? Number(args[k + 1]) : undefined;
  if (blockStallSec !== undefined && (!Number.isInteger(blockStallSec) || blockStallSec < 1))
    throw new Error("chain-health: --block-stall-sec pozitif tam sayı");
  const h = await collectChainHealth({ ...ctx, blockStallSec });
  if (args.includes("--monitor")) {
    for (const l of monitorLines(h)) console.log(l);
  } else console.log(JSON.stringify(h, null, 2));
  return exitCodeOf(h);
}
