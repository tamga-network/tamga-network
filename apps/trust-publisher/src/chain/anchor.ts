/**
 * chain-submit — projeksiyon koşusu (ADR-0051 K1, K4): yayıncının dist/ çıktısındaki imzalı listelerin ve çapa günlüğü başının
 * ÖZETLERİNİ zincirdeki liste çapası kaydına yazar. Kurallar:
 *   - Set önce yükleyiciyle doğrulanır (imza, hash zinciri, tazelik); sağlıksız set çapalanmaz.
 *   - Zincirde aynı sürüm aynı özetle onaylıysa SKIP; onaylı FARKLI özet varsa CONFLICT — yazılmaz, imzalı liste geçerlidir (CH1),
 *     işletmeciye alarm. Zincirdeki en yüksek onaylı sürümden küçük sürüm yazılmaz (CH4).
 *   - dryRun: hiçbir yazma yok; plan ve kararlar raporlanır.
 * Bayrak (TAMGA_CHAIN_ENABLED) bu modülün DIŞINDA denetlenir (cli.ts): kapalıyken bu fonksiyon gerçek istemciyle çağrılmaz (CH5).
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { loadTrustSet } from "@tamga-network/trust";

import type { ChainClient } from "./client.js";
import {
  planProjection,
  type Environment,
  type ListVersionAnchor,
  type LogHeadAnchor,
  type ProjectionPlan,
} from "./projection.js";

export type Decision = "ANCHOR" | "SKIP" | "CONFLICT" | "STALE";

export interface ListDecision {
  kind: "list";
  file: string;
  version: number;
  contentHash: string;
  decision: Decision;
  reason: string;
  tx?: string;
}
export interface LogDecision {
  kind: "log";
  seq: number;
  lineHash: string;
  decision: Decision;
  reason: string;
  tx?: string;
}

export interface AnchorReport {
  environment: Environment;
  dryRun: boolean;
  chain: { chainId: number; registry: string; requiredConfirmations: number };
  verified: boolean;
  decisions: Array<ListDecision | LogDecision>;
  conflicts: number;
  written: number;
}

export interface DistSet {
  environment: Environment;
  lotlJws: string;
  nationalListJws: Record<string, string>; // "tl-tr" → jws
  anchorsJsonl: string;
  rootFingerprints: string[];
}

/** dist/ klasörünü okur (yayıncının kendi çıktısı). */
export function readDistSet(dist: string, environment: Environment): DistSet {
  const nationalListJws: Record<string, string> = {};
  for (const f of readdirSync(dist)) {
    const m = /^(tl-[a-z]{2})\.jws$/.exec(f);
    if (m) nationalListJws[m[1]] = readFileSync(resolve(dist, f), "utf8");
  }
  const keys = resolve(dist, "keys", "root-fingerprints.json");
  const rootFingerprints = existsSync(keys)
    ? (JSON.parse(readFileSync(keys, "utf8")).lotl_signing_keys as Array<{ fingerprint_sha256: string }>).map(
        (k) => k.fingerprint_sha256,
      )
    : [];
  const anchorsFile = resolve(dist, "anchors.jsonl");
  return {
    environment,
    lotlJws: readFileSync(resolve(dist, "lotl.jws"), "utf8"),
    nationalListJws,
    anchorsJsonl: existsSync(anchorsFile) ? readFileSync(anchorsFile, "utf8") : "",
    rootFingerprints,
  };
}

/** Yükleyici doğrulaması: imza + biçim + hash zinciri + tazelik. Sağlıksızsa hata (çapalanmaz). */
export async function verifySet(set: DistSet, clock?: { now?: Date; anchorMaxAgeMs?: number }): Promise<void> {
  const byState: Record<string, string> = {};
  for (const [file, jws] of Object.entries(set.nationalListJws)) byState[file.slice(3).toUpperCase()] = jws;
  const { report } = await loadTrustSet({
    lotlJws: set.lotlJws,
    nationalListJws: byState,
    anchorsJsonl: set.anchorsJsonl,
    rootFingerprints: set.rootFingerprints,
    environment: set.environment,
    now: clock?.now,
    anchorMaxAgeMs: clock?.anchorMaxAgeMs,
  });
  if (!report.healthy) throw new Error(`chain: set sağlıksız, çapalanmadı — ${report.warnings.join("; ")}`);
}

async function decideList(client: ChainClient, a: ListVersionAnchor): Promise<ListDecision> {
  const base = { kind: "list" as const, file: a.file, version: a.version, contentHash: a.contentHash };
  const existing = await client.listAnchor(a.listKey, a.version);
  if (existing?.confirmed) {
    if (existing.contentHash === a.contentHash)
      return { ...base, decision: "SKIP", reason: "zincirde aynı özetle onaylı" };
    return {
      ...base,
      decision: "CONFLICT",
      reason: `zincirde onaylı FARKLI özet: ${existing.contentHash} — imzalı liste geçerli (CH1)`,
    };
  }
  if (existing && existing.contentHash !== a.contentHash)
    return { ...base, decision: "CONFLICT", reason: `zincirde bekleyen FARKLI özet: ${existing.contentHash}` };
  const latest = await client.latestListVersion(a.listKey);
  if (a.version < latest) return { ...base, decision: "STALE", reason: `zincirde onaylı sürüm ${latest} daha yeni` };
  if (a.version === latest) return { ...base, decision: "SKIP", reason: "zincirde aynı sürüm onaylı" };
  return { ...base, decision: "ANCHOR", reason: existing ? "bekleyen çapaya onay" : "yeni sürüm" };
}

async function decideLog(client: ChainClient, h: LogHeadAnchor): Promise<LogDecision> {
  const base = { kind: "log" as const, seq: h.seq, lineHash: h.lineHash };
  const existing = await client.logHead(h.logKey, h.seq);
  if (existing) {
    if (existing.lineHash !== h.lineHash)
      return { ...base, decision: "CONFLICT", reason: `zincirde seq ${h.seq} için FARKLI özet: ${existing.lineHash}` };
    if (existing.confirmed) return { ...base, decision: "SKIP", reason: "zincirde aynı özetle onaylı" };
    return { ...base, decision: "ANCHOR", reason: "bekleyen çapaya onay" };
  }
  const latest = await client.latestLogSeq(h.logKey);
  if (h.seq < latest) return { ...base, decision: "STALE", reason: `zincirde onaylı seq ${latest} daha ileri` };
  if (h.seq === latest && latest !== 0) return { ...base, decision: "SKIP", reason: "zincirde aynı seq onaylı" };
  return { ...base, decision: "ANCHOR", reason: "yeni günlük başı" };
}

/** Planı zincirle karşılaştırır, dryRun değilse ANCHOR kararlarını yazar. */
export async function runProjection(
  client: ChainClient,
  plan: ProjectionPlan,
  opts: { dryRun: boolean; verified: boolean },
): Promise<AnchorReport> {
  const chain = await client.describe();
  const decisions: Array<ListDecision | LogDecision> = [];
  for (const a of plan.lists) {
    const d = await decideList(client, a);
    if (d.decision === "ANCHOR" && !opts.dryRun) d.tx = await client.anchorList(a);
    decisions.push(d);
  }
  if (plan.logHead) {
    const d = await decideLog(client, plan.logHead);
    if (d.decision === "ANCHOR" && !opts.dryRun) d.tx = await client.anchorLogHead(plan.logHead);
    decisions.push(d);
  }
  return {
    environment: plan.environment,
    dryRun: opts.dryRun,
    chain,
    verified: opts.verified,
    decisions,
    conflicts: decisions.filter((d) => d.decision === "CONFLICT").length,
    written: decisions.filter((d) => d.tx).length,
  };
}

/** Uçtan uca: dist oku → (doğrula) → plan → zincir. */
export async function anchorDist(
  client: ChainClient,
  dist: string,
  environment: Environment,
  opts: { dryRun: boolean; skipVerify?: boolean; clock?: { now?: Date; anchorMaxAgeMs?: number } },
): Promise<AnchorReport> {
  const set = readDistSet(dist, environment);
  if (!opts.skipVerify) await verifySet(set, opts.clock);
  const plan = planProjection(set);
  return runProjection(client, plan, { dryRun: opts.dryRun, verified: !opts.skipVerify });
}
