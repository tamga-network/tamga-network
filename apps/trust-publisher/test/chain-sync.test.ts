/**
 * Sürekli projeksiyon (ADR-0085) — ağsız testler: fark = plan(şimdi) − plan(önce) (SP1), ara durumların birleştirilmesi ve ileri
 * tarihli işin zamanı gelince farkta çıkması (SP3), değişiklik yokken boş plan, yayın kancasının bayrak kapalıyken hiçbir şey
 * yapmaması ve açıkken hatasının yayını durdurmaması (SP5, SP7; ADR-0084 LS4), başlangıç noktası olmadan yazım olmaması.
 * Zincirde uçtan uca sürekli eşdeğerlik: contracts/test/chain-sync.test.ts.
 */
import { describe, it, expect } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildReplayPlan, type ReplayOp } from "../../chain-indexer/src/replay-plan.js";
import { canonicalJson } from "../../chain-indexer/src/ids.js";
import { buildFixture, writeFixtureDist } from "../../chain-indexer/test/fixture.js";
import { collapseOps, planChainSync, sliceArchive, syncPointOf } from "../src/chain/sync-plan.js";
import {
  SYNC_STATE_FILE,
  chainAfterPublish,
  chainSyncCommand,
  readSyncState,
  writeSyncBaseline,
} from "../src/chain/sync-cli.js";

const DAY = 86400;
const ident = (o: ReplayOp) => {
  const { seq: _s, n: _n, src: _src, ...b } = o;
  return canonicalJson(b);
};

describe("ADR-0085 sürekli projeksiyon — planlayıcı", () => {
  it("SP1: fark = plan(şimdi) − plan(önce); önceki noktadaki set kendisiyle farksız", async () => {
    const f = await buildFixture();
    const T = f.planTime;
    const same = planChainSync({ archive: f.archive, planTime: T }, { archive: f.archive, planTime: T });
    expect(same.ops).toEqual([]);

    // önceki nokta: her listenin sondan bir önceki sürümü
    const full = syncPointOf(f.archive, T);
    const earlier = {
      ...full,
      versions: Object.fromEntries(Object.entries(full.versions).map(([k, v]) => [k, v - 1])),
      planTime: T - DAY,
    };
    const prev = sliceArchive(f.archive, earlier);
    expect(prev.lotl.length).toBe(f.archive.lotl.length - 1);
    const plan = planChainSync({ archive: prev, planTime: earlier.planTime }, { archive: f.archive, planTime: T });
    expect(plan.ops.length).toBeGreaterThan(0);
    expect(plan.from?.versions).toEqual(earlier.versions);
    expect(plan.to.versions).toEqual(full.versions);
    // her fark işlemi tam planda var ve önceki planda (kimliğiyle) yok
    const p1 = new Set(buildReplayPlan(prev, { planTime: earlier.planTime }).ops.map(ident));
    const p2 = new Set(buildReplayPlan(f.archive, { planTime: T }).ops.map(ident));
    for (const o of plan.ops) {
      const { listedFrom: _lf, ...base } = o;
      expect(p2.has(ident(base as ReplayOp))).toBe(true);
      expect(p1.has(ident(base as ReplayOp))).toBe(false);
    }
    // kişisel veri / serbest metin yok (PJ2): adlar ve gerekçeler planda düz metin olarak geçmez
    const text = JSON.stringify(plan.ops);
    expect(text).not.toContain("Example uni-one");
    expect(text).not.toContain("key compromise");
    // düzey: yansıtılan setin en son liste yayını
    expect(plan.level).toBe(T);
  });

  it("SP3: aynı kayda düşen ara durumlar birleşir; son hâl yazılır, en erken liste tarihi saklanır", () => {
    const who = { role: "state" as const, state: "TR" };
    const id = "0x" + "11".repeat(32);
    const ops = [
      { op: "registerIssuer", seq: 0, at: 5, who, src: "x" },
      { op: "issuerStatus", issuerId: id, status: "SUSPENDED", seq: 1, at: 10, who, src: "x" },
      { op: "issuerStatus", issuerId: id, status: "ACTIVE", seq: 2, at: 20, who, src: "x" },
      { op: "publishList", listId: "0xa", contentHash: "0x1", version: 2, seq: 3, at: 21, who, src: "x" },
      { op: "publishList", listId: "0xa", contentHash: "0x2", version: 3, seq: 4, at: 22, who, src: "x" },
    ] as unknown as ReplayOp[];
    const { ops: out, collapsed } = collapseOps(ops);
    expect(collapsed).toBe(2);
    expect(out.map((o) => o.op)).toEqual(["registerIssuer", "issuerStatus", "publishList"]);
    const st = out[1] as ReplayOp & { status: string; listedFrom?: number };
    expect(st.status).toBe("ACTIVE");
    expect(st.listedFrom).toBe(10);
    expect((out[2] as ReplayOp & { version: number }).version).toBe(3);
    expect(out.map((o) => o.seq)).toEqual([0, 1, 2]);
  });

  it("SP3: ileri tarihli kayıt bugün yazılmaz; zamanı gelince yeni liste sürümü olmadan farkta çıkar", async () => {
    const f = await buildFixture();
    // fikstürde yetki pencereleri geçmiştedir; plan anını geriye çekmek "ileri tarih" durumunu kurar
    const early = f.base + 56 * DAY; // student yetkisinin ikinci açılışı (d58) ve sonrası bu anda ileri tarihlidir
    const a = planChainSync({ archive: f.archive, planTime: early }, { archive: f.archive, planTime: early });
    expect(a.ops).toEqual([]);
    const b = planChainSync({ archive: f.archive, planTime: early }, { archive: f.archive, planTime: f.planTime });
    expect(b.ops.length).toBeGreaterThan(0);
    expect(b.ops.every((o) => o.at > early)).toBe(true);
  });
});

describe("ADR-0085 — komut ve yayın kancası", () => {
  it("SP7: kanca bayrak kapalıyken hiçbir şey yapmaz (adım çağrılmaz, dosya yazılmaz)", async () => {
    let called = 0;
    const steps = { sync: async () => (called++, 0), submit: async () => (called++, 0) };
    const dir = mkdtempSync(join(tmpdir(), "chain-sync-"));
    try {
      for (const env of [{}, { TAMGA_CHAIN_ENABLED: "0" }, { TAMGA_CHAIN_ENABLED: "true" }]) {
        const r = await chainAfterPublish({ dist: dir, environment: "production", env }, steps);
        expect(r).toEqual({ ran: false, results: [] });
      }
      expect(called).toBe(0);
      expect(existsSync(join(dir, SYNC_STATE_FILE))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("SP5 / LS4: bayrak açıkken adım hatası fırlatılmaz; iki adım da denenir, alarm döner", async () => {
    const order: string[] = [];
    const r = await chainAfterPublish(
      { dist: "x", environment: "production", env: { TAMGA_CHAIN_ENABLED: "1" } },
      {
        sync: async () => {
          order.push("sync");
          throw new Error("zincir erişilemez");
        },
        submit: async () => (order.push("submit"), 3),
      },
    );
    expect(order).toEqual(["sync", "submit"]);
    expect(r.ran).toBe(true);
    expect(r.results).toEqual([
      { step: "chain-sync", code: null, error: "zincir erişilemez" },
      { step: "chain-submit", code: 3 },
    ]);
    // gerçek adımlar, ayar yokken: yine fırlatmaz
    const real = await chainAfterPublish({
      dist: mkdtempSync(join(tmpdir(), "chain-sync-")),
      environment: "production",
      env: { TAMGA_CHAIN_ENABLED: "1" },
    });
    expect(real.ran).toBe(true);
    expect(real.results.every((x) => x.code !== 0)).toBe(true);
  });

  it("SP7: başlangıç noktası (göç) yoksa yazılmaz; göç sonrası nokta yazılınca kuru koşu farkı basar", async () => {
    const f = await buildFixture();
    const dist = mkdtempSync(join(tmpdir(), "chain-sync-"));
    try {
      writeFixtureDist(f, dist);
      const env = { TAMGA_CHAIN_ENABLED: "1" };
      expect(await chainSyncCommand([], { dist, environment: "production", env })).toBe(2);
      const base = writeSyncBaseline(dist, f.archive, f.planTime, 31337);
      expect(readSyncState(dist)).toEqual(base);
      const logs: string[] = [];
      const log = console.log;
      console.log = (x: string) => logs.push(x);
      try {
        const code = await chainSyncCommand(["--dry-run"], {
          dist,
          environment: "production",
          env,
          now: () => f.planTime + 60,
        });
        expect(code).toBe(0);
      } finally {
        console.log = log;
      }
      const out = JSON.parse(logs.join("\n"));
      expect(out.dryRun).toBe(true);
      expect(out.operations).toBe(0); // göçten beri değişiklik yok
      // kuru koşu durum dosyasını değiştirmez
      expect(JSON.parse(readFileSync(join(dist, SYNC_STATE_FILE), "utf8"))).toEqual(base);
      // başka ortamın durum dosyası kabul edilmez
      expect(await chainSyncCommand(["--dry-run"], { dist, environment: "sandbox", env })).toBe(2);
    } finally {
      rmSync(dist, { recursive: true, force: true });
    }
  });
});
