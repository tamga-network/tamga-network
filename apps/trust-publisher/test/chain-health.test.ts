/**
 * `trust:chain-health` — zincir izleme ve alarm (ADR-0084 LS5, ADR-0085 SP2/SP5, ADR-0051 CH1, ADR-0053), ağsız:
 *   - bayrak kapalıyken "disabled", alarm yok, çıkış 0, izleme satırı yok (canlı sisteme etkisizlik);
 *   - blok durması, eş yokluğu, eksik eşitleme koşusu, iki saati aşan projeksiyon gecikmesi;
 *   - liste çapasında NO / CONFLICT / CONTEST ve iki saatten uzun çapalanmamış sürüm;
 *   - izleme satırları (`[!] chain: <KOD> …`) ve çıkış kodları (0 / 4 / 5).
 */
import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildFixture, writeFixtureDist } from "../../chain-indexer/test/fixture.js";
import { MemoryChainClient } from "../src/chain/client.js";
import {
  ALARM_CODES,
  DEFAULT_BLOCK_STALL_SEC,
  chainHealthCommand,
  collectChainHealth,
  evaluateHealth,
  exitCodeOf,
  monitorLines,
} from "../src/chain/health.js";
import { listKeyOf } from "../src/chain/projection.js";
import { writeSyncBaseline, writeSyncState, SYNC_STATE_FORMAT, type SyncState } from "../src/chain/sync-cli.js";
import type { AnchorReport } from "../src/chain/anchor.js";

const NOW = 2_000_000_000;
const block = (age: number, peers: number | null = 3) => ({ chainId: 31339, number: 100, timestamp: NOW - age, peers });
const report = (decisions: AnchorReport["decisions"]): AnchorReport => ({
  environment: "production",
  dryRun: true,
  chain: { chainId: 31339, registry: "0x", requiredConfirmations: 2 },
  verified: false,
  decisions,
  conflicts: 0,
  contested: 0,
  written: 0,
});

describe("chain-health — değerlendirme", () => {
  it("bayrak kapalı: disabled, alarm yok, çıkış 0, izleme satırı yok", () => {
    const h = evaluateHealth({ now: NOW, environment: "production", enabled: false, block: { error: "x" } });
    expect(h.status).toBe("disabled");
    expect(h.alarms).toEqual([]);
    expect(h.chain).toBeUndefined();
    expect(exitCodeOf(h)).toBe(0);
    expect(monitorLines(h)).toEqual([]);
    expect(h.format).toBe("tamga-chain-health/1");
    expect(h.thresholds).toEqual({ lag_alarm_sec: 7200, block_stall_sec: DEFAULT_BLOCK_STALL_SEC });
  });

  it("sağlıklı zincir: ok, çıkış 0", () => {
    const h = evaluateHealth({
      now: NOW,
      environment: "production",
      enabled: true,
      block: block(2),
      sync: {
        state: {
          format: SYNC_STATE_FORMAT,
          environment: "production",
          chainId: 31339,
          point: { versions: {}, anchorSeq: 0, planTime: NOW - 100 },
          updated_at: "x",
          last_run: { at: "x", complete: true, written: 3, failed: 0, pending: 0, deferred: 0 },
        },
        unreflectedLists: [],
        unreflectedAnchorTimes: [],
      },
      anchors: {
        checks: [{ file: "lotl", version: 4, contentHash: "h", anchored: "YES", reason: "" }],
        report: report([]),
        pendingIssuedAt: [],
      },
    });
    expect(h.status).toBe("ok");
    expect(h.sync?.state).toBe("ok");
    expect(exitCodeOf(h)).toBe(0);
  });

  it("blok durması (alarm), eş yok (uyarı), erişilemeyen düğüm (alarm)", () => {
    const stall = evaluateHealth({ now: NOW, environment: "production", enabled: true, block: block(600, 0) });
    expect(stall.alarms.map((a) => a.code)).toEqual(["BLOCK_STALL", "PEERS_NONE"]);
    expect(stall.status).toBe("alarm");
    expect(exitCodeOf(stall)).toBe(5);
    const peersOnly = evaluateHealth({ now: NOW, environment: "production", enabled: true, block: block(1, 0) });
    expect(peersOnly.status).toBe("warn");
    expect(exitCodeOf(peersOnly)).toBe(4);
    const down = evaluateHealth({
      now: NOW,
      environment: "production",
      enabled: true,
      block: { error: "ECONNREFUSED" },
    });
    expect(down.alarms[0].code).toBe("CHAIN_UNREACHABLE");
    expect(monitorLines(down)[0]).toBe("[!] chain: CHAIN_UNREACHABLE zincir düğümüne ulaşılamadı");
    // sınır seçenekle değişir
    expect(
      evaluateHealth({ now: NOW, environment: "production", enabled: true, block: block(600), blockStallSec: 900 })
        .status,
    ).toBe("ok");
  });

  it("eşitleme: başlangıç yok (uyarı), eksik koşu (alarm), iki saati aşan gecikme (alarm), sınırın altı (geride ama alarm yok)", () => {
    const st = (complete: boolean): SyncState => ({
      format: SYNC_STATE_FORMAT,
      environment: "production" as const,
      chainId: 31339,
      point: { versions: {}, anchorSeq: 0, planTime: NOW },
      updated_at: "x",
      last_run: { at: "x", complete, written: 1, failed: complete ? 0 : 2, pending: complete ? 0 : 1, deferred: 0 },
    });
    const none = evaluateHealth({
      now: NOW,
      environment: "production",
      enabled: true,
      sync: { state: null, unreflectedLists: [], unreflectedAnchorTimes: [] },
    });
    expect(none.alarms.map((a) => a.code)).toEqual(["SYNC_NO_BASELINE"]);
    expect(none.sync?.state).toBe("missing");
    const inc = evaluateHealth({
      now: NOW,
      environment: "production",
      enabled: true,
      sync: { state: st(false), unreflectedLists: [], unreflectedAnchorTimes: [] },
    });
    expect(inc.alarms[0].code).toBe("SYNC_INCOMPLETE");
    expect(inc.alarms[0].message).toMatch(/düşen 2, oy bekleyen 1/);
    const lag = evaluateHealth({
      now: NOW,
      environment: "production",
      enabled: true,
      sync: { state: st(true), unreflectedLists: [NOW - 7201], unreflectedAnchorTimes: [NOW - 60] },
    });
    expect(lag.alarms.map((a) => a.code)).toEqual(["SYNC_LAG"]);
    expect(lag.sync).toMatchObject({ state: "behind", lag_sec: 7201, unreflected: { lists: 1, anchor_lines: 1 } });
    const fresh = evaluateHealth({
      now: NOW,
      environment: "production",
      enabled: true,
      sync: { state: st(true), unreflectedLists: [NOW - 600], unreflectedAnchorTimes: [] },
    });
    expect(fresh.status).toBe("ok");
    expect(fresh.sync?.state).toBe("behind");
  });

  it("liste çapası: NO, CONFLICT, CONTEST ve uzun süre çapalanmamış sürüm alarm üretir", () => {
    const h = evaluateHealth({
      now: NOW,
      environment: "production",
      enabled: true,
      anchors: {
        checks: [
          { file: "lotl", version: 5, contentHash: "a", anchored: "NO", reason: "" },
          { file: "tl-tr", version: 3, contentHash: "b", anchored: "UNKNOWN", reason: "" },
        ],
        report: report([
          {
            kind: "list",
            file: "lotl",
            version: 5,
            contentHash: "a",
            decision: "CONFLICT",
            reason: "zincirde onaylı FARKLI özet",
          },
          { kind: "list", file: "tl-tr", version: 3, contentHash: "b", decision: "CONTEST", reason: "bekleyen aday" },
          { kind: "list", file: "tl-kz", version: 2, contentHash: "c", decision: "ANCHOR", reason: "yeni sürüm" },
        ]),
        pendingIssuedAt: [NOW - 9000],
      },
    });
    expect(h.alarms.map((a) => a.code)).toEqual(["ANCHOR_NO", "ANCHOR_CONFLICT", "ANCHOR_CONTEST", "ANCHOR_LAG"]);
    expect(h.anchors).toMatchObject({
      decisions: { conflict: 1, contest: 1, pending: 1, oldest_pending_age_sec: 9000 },
    });
    for (const a of h.alarms) expect(ALARM_CODES).toContain(a.code);
    const skipped = evaluateHealth({
      now: NOW,
      environment: "production",
      enabled: true,
      anchors: { skipped: "kayıt adresi yok" },
    });
    expect(skipped.alarms.map((a) => a.code)).toEqual(["CONFIG_INCOMPLETE"]);
  });
});

describe("chain-health — toplama (yayın klasörü + bellek içi zincir)", () => {
  it("bayrak kapalıyken zincire ve klasöre bakmaz: disabled; komut çıkışı 0, --monitor boş", async () => {
    const h = await collectChainHealth({ dist: "/yok", environment: "production", env: { TAMGA_CHAIN_ENABLED: "0" } });
    expect(h.status).toBe("disabled");
    const out: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((x: unknown) => void out.push(String(x)));
    try {
      expect(await chainHealthCommand(["--monitor"], { dist: "/yok", environment: "production", env: {} })).toBe(0);
      expect(out).toEqual([]);
      expect(await chainHealthCommand([], { dist: "/yok", environment: "production", env: {} })).toBe(0);
      expect(JSON.parse(out.join("\n")).status).toBe("disabled");
    } finally {
      spy.mockRestore();
    }
  });

  it("fikstür klasörü: geride kalmış projeksiyon ve çapalanmamış listeler alarm; onaylı farklı özet NO + CONFLICT", async () => {
    const f = await buildFixture();
    const dist = mkdtempSync(join(tmpdir(), "chain-health-"));
    try {
      writeFixtureDist(f, dist);
      const now = f.planTime + 3 * 3600; // son liste yayınından üç saat sonra
      const provider = {
        getBlock: async () => ({ number: 10, timestamp: now - 2 }),
        getNetwork: async () => ({ chainId: 31337n }),
        send: async () => "0x2",
      };
      const env = { TAMGA_CHAIN_ENABLED: "1" };
      // başlangıç noktası yok
      let h = await collectChainHealth({
        dist,
        environment: "production",
        env,
        provider,
        client: new MemoryChainClient(1, 31337),
        now: () => now,
      });
      expect(h.alarms.map((a) => a.code)).toContain("SYNC_NO_BASELINE");
      expect(h.chain).toMatchObject({ chain_id: 31337, block: 10, peers: 2 });
      // göç bitti, nokta arşivin sonunda → geride değil
      writeSyncBaseline(dist, f.archive, f.planTime, 31337);
      h = await collectChainHealth({
        dist,
        environment: "production",
        env,
        provider,
        client: new MemoryChainClient(1, 31337),
        now: () => now,
      });
      expect(h.sync?.state).toBe("ok");
      expect(h.alarms.map((a) => a.code)).not.toContain("SYNC_LAG");
      // zincirde hiç çapa yok → son sürümler çapalanmamış ve üç saattir bekliyor → ANCHOR_LAG
      expect(h.alarms.map((a) => a.code)).toContain("ANCHOR_LAG");
      // nokta geride: hiçbir şey yansıtılmamış gibi → SYNC_LAG
      writeSyncState(dist, {
        format: SYNC_STATE_FORMAT,
        environment: "production",
        chainId: 31337,
        point: { versions: {}, anchorSeq: -1, planTime: 0 },
        updated_at: "x",
      });
      h = await collectChainHealth({
        dist,
        environment: "production",
        env,
        provider,
        client: new MemoryChainClient(1, 31337),
        now: () => now,
      });
      expect(h.alarms.map((a) => a.code)).toContain("SYNC_LAG");
      // onaylı farklı özet → NO (chain-check) ve CONFLICT (kuru chain-submit)
      const c = new MemoryChainClient(1, 31337);
      const lotlVersion = f.archive.lotl.length;
      c.seedList(listKeyOf("production", "lotl"), {
        version: lotlVersion,
        contentHash: `0x${"ab".repeat(32)}`,
        previousHash: `0x${"0".repeat(64)}`,
        issuedAt: 1,
      });
      h = await collectChainHealth({ dist, environment: "production", env, provider, client: c, now: () => now });
      const codes = h.alarms.map((a) => a.code);
      expect(codes).toContain("ANCHOR_NO");
      expect(codes).toContain("ANCHOR_CONFLICT");
      expect(h.status).toBe("alarm");
      expect(monitorLines(h).every((l) => l.startsWith("[!] chain: "))).toBe(true);
    } finally {
      rmSync(dist, { recursive: true, force: true });
    }
  });
});
