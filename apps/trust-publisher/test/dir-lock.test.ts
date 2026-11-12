/**
 * Klasör kilidi (src/dir-lock.ts): tutulurken tazelenir — bayatlık süresini aşan iş sürerken ikinci yazar kilidi devralamaz
 * (0.8.3; önce tazeleme yoktu). Sahibi ölmüş (tazelenmeyen) kilit yine devralınır.
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { withDirLockAt } from "../src/dir-lock.js";

const tmp = mkdtempSync(join(tmpdir(), "tamga-lock-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("klasör kilidi", () => {
  it("uzun iş sürerken kilit tazelenir: ikinci yazar bayat sayıp devralamaz, iş bitince alır", async () => {
    const lock = join(tmp, "a.lock");
    const opt = { staleMs: 150, beatMs: 30, waitMs: 5_000 };
    const order: string[] = [];
    let overlap = false;
    let firstRunning = false;
    const first = withDirLockAt(
      lock,
      async () => {
        firstRunning = true;
        order.push("1 başladı");
        await sleep(700); // bayatlık süresinin (150 ms) çok üstünde
        order.push("1 bitti");
        firstRunning = false;
      },
      opt,
    );
    await sleep(50);
    const second = withDirLockAt(
      lock,
      async () => {
        if (firstRunning) overlap = true;
        order.push("2 başladı");
      },
      opt,
    );
    await Promise.all([first, second]);
    expect(overlap).toBe(false);
    expect(order).toEqual(["1 başladı", "1 bitti", "2 başladı"]);
    expect(existsSync(lock)).toBe(false);
  });

  it("sahibi ölmüş (tazelenmeyen) kilit bayatlık süresinden sonra devralınır; taze kilit beklenir ve süre dolunca hata", async () => {
    const dead = join(tmp, "b.lock");
    mkdirSync(dead);
    const old = new Date(Date.now() - 60_000);
    utimesSync(dead, old, old);
    await expect(withDirLockAt(dead, async () => "ok", { staleMs: 150, beatMs: 30, waitMs: 1_000 })).resolves.toBe(
      "ok",
    );
    const held = join(tmp, "c.lock");
    mkdirSync(held); // taze ve tutuluyor
    await expect(withDirLockAt(held, async () => "ok", { staleMs: 60_000, waitMs: 200 })).rejects.toThrow(
      /c\.lock: kilit alınamadı/,
    );
  });

  it("iş hata verse de kilit bırakılır", async () => {
    const lock = join(tmp, "d.lock");
    await expect(
      withDirLockAt(lock, async () => {
        throw new Error("x");
      }),
    ).rejects.toThrow("x");
    expect(existsSync(lock)).toBe(false);
  });
});
