import { existsSync, mkdtempSync, readFileSync, writeFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { guardedReload, loadTrustSourceFromDir, trustDistStamp } from "./fs.js";

describe("guardedReload", () => {
  it("damga değişmeden yeniden yüklemez; üst üste binen tetikler tek yüklemeye katılır; dosya değişince yükler", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tamga-trust-"));
    writeFileSync(join(dir, "lotl.jws"), "a");
    writeFileSync(join(dir, "anchors.jsonl"), "l1\n");
    let loads = 0;
    let release: () => void = () => {};
    const load = () =>
      new Promise<void>((r) => {
        loads++;
        release = r;
      });
    const g = guardedReload(dir, load, { seedStamp: true });
    await g.reload(); // damga aynı → yükleme yok
    expect(loads).toBe(0);
    const s0 = trustDistStamp(dir);
    utimesSync(join(dir, "anchors.jsonl"), new Date(Date.now() + 5000), new Date(Date.now() + 5000)); // yeni satır eklendi gibi
    writeFileSync(join(dir, "anchors.jsonl"), "l1\nl2\n");
    expect(trustDistStamp(dir)).not.toBe(s0);
    const p1 = g.reload();
    const p2 = g.reload(); // ilki bitmeden ikinci tetik → aynı yüklemeye katılır
    expect(loads).toBe(1);
    expect(g.inFlight()).toBe(true);
    release();
    await Promise.all([p1, p2]);
    expect(g.inFlight()).toBe(false);
    await g.reload(); // değişiklik yok
    expect(loads).toBe(1);
    const p3 = g.force(); // damga yok sayılır
    release();
    await p3;
    expect(loads).toBe(2);
  });
});

const ROOT = join(import.meta.dirname, "../../..");
const DIST = join(ROOT, "apps/trust-publisher/dist-test"); // npm run setup
const distReady = existsSync(join(DIST, "lotl.jws"));
/** Son çapa satırının zamanı (ms). */
const lastAnchorMs = () => {
  const lines = readFileSync(join(DIST, "anchors.jsonl"), "utf8").trim().split("\n");
  const payload = JSON.parse(Buffer.from(lines[lines.length - 1].split(".")[1], "base64url").toString("utf8")) as {
    ts: string;
  };
  return new Date(payload.ts).getTime();
};

describe.skipIf(!distReady)(
  "C6-Ö3/Ö4: dizin yükleyicisinin çapa tazelik sınırı (güvenlik incelemesi 2026-11-18)",
  () => {
    it("varsayılan 2 saat: son çapadan 3 saat sonra kaynak bayat; geniş sınır açıkça verilirse taze", async () => {
      const now = new Date(lastAnchorMs() + 3 * 3600_000);
      const def = await loadTrustSourceFromDir(DIST, { now, versionMemory: "none" });
      expect(def.report.healthy).toBe(false);
      expect(def.report.warnings.join(" ")).toMatch(/anchors stale/);
      const wide = await loadTrustSourceFromDir(DIST, { now, versionMemory: "none", anchorMaxAgeMs: 365 * 86400_000 });
      expect(wide.report.warnings.join(" ")).not.toMatch(/anchors stale/);
    });
    it("sonlu ve pozitif olmayan sınır RangeError (NaN bayatlığı sessizce kapatmaz)", async () => {
      for (const bad of [NaN, Infinity, 0, -1])
        await expect(loadTrustSourceFromDir(DIST, { anchorMaxAgeMs: bad, versionMemory: "none" })).rejects.toThrow(
          RangeError,
        );
    });
  },
);
