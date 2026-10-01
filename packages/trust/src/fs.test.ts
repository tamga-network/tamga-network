import { mkdtempSync, writeFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { guardedReload, trustDistStamp } from "./fs.js";

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
