/**
 * İmzalı liste aynası (gölge zincir): fikstür yayın klasörü "sunucu" olarak okunur, ayna yeniden oynatmanın okuduğu düzene yazılır
 * ve doğrulanır; ikinci koşu arşivi yeniden indirmez (artımlı); budanmış arşivde ilk eksik sürümde durur; sabitlenen kök parmak
 * izi tutmazsa indirme durur; kaynak yalnız https (yerel sınama için 127.0.0.1).
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { mirrorSignedLists, type FetchText } from "../src/list-mirror.js";
import { readArchiveDir } from "../src/replay-archive.js";
import { buildFixture, writeFixtureDist } from "./fixture.js";

const BASE = "http://127.0.0.1:9";
const serveDir =
  (dir: string, seen: string[] = []): FetchText =>
  async (url) => {
    const path = url.slice(BASE.length + 1);
    seen.push(path);
    const p = join(dir, path);
    if (path.includes("..") || !existsSync(p)) return { status: 404, body: "" };
    return { status: 200, body: readFileSync(p, "utf8") };
  };

describe("imzalı liste aynası", () => {
  it("fikstürü indirir, doğrular; ikinci koşu arşivi yeniden indirmez", async () => {
    const f = await buildFixture();
    const src = mkdtempSync(join(tmpdir(), "mirror-src-"));
    const out = mkdtempSync(join(tmpdir(), "mirror-out-"));
    try {
      writeFixtureDist(f, src);
      const r = await mirrorSignedLists({ base: BASE, out, fetchText: serveDir(src) });
      expect(r.lists.lotl.current).toBe(f.archive.lotl.length);
      expect(r.lists.lotl.archived).toBe(f.archive.lotl.length);
      for (const [file, list] of Object.entries(f.archive.national)) expect(r.lists[file].current).toBe(list.length);
      expect(r.verified.lotl).toBe(f.archive.lotl.length);
      // yeniden oynatmanın gördüğü arşiv kaynakla aynı
      const a = readArchiveDir(out, "production");
      expect(a.lotl).toEqual(f.archive.lotl.map((x) => x.trim()));
      expect(a.anchorsJsonl.trim()).toBe(f.archive.anchorsJsonl.trim());
      // artımlı: arşivlenmiş sürümler yeniden istenmez
      const seen: string[] = [];
      const again = await mirrorSignedLists({ base: BASE, out, fetchText: serveDir(src, seen) });
      expect(seen.filter((p) => p.startsWith("archive/"))).toEqual([]);
      expect(Object.values(again.lists).every((l) => l.downloaded === 0)).toBe(true);
    } finally {
      rmSync(src, { recursive: true, force: true });
      rmSync(out, { recursive: true, force: true });
    }
  });

  it("budanmış arşiv: ilk eksik sürümde durur; kök parmak izi tutmazsa indirme durur; kaynak denetimi", async () => {
    const f = await buildFixture();
    const src = mkdtempSync(join(tmpdir(), "mirror-src-"));
    const out = mkdtempSync(join(tmpdir(), "mirror-out-"));
    try {
      writeFixtureDist(f, src);
      unlinkSync(join(src, "archive", "lotl.v0001.jws"));
      const seen: string[] = [];
      await mirrorSignedLists({ base: BASE, out, fetchText: serveDir(src, seen) }).catch(() => undefined);
      expect(existsSync(join(out, "archive", "lotl.v0001.jws"))).toBe(false);
      expect(existsSync(join(out, "archive", "lotl.v0002.jws"))).toBe(true);
      await expect(
        mirrorSignedLists({
          base: BASE,
          out: mkdtempSync(join(tmpdir(), "m-")),
          fetchText: serveDir(src),
          expectRoots: ["00".repeat(32)],
        }),
      ).rejects.toThrow(/kök parmak izleri/);
      await expect(mirrorSignedLists({ base: "http://trust.example", out, fetchText: serveDir(src) })).rejects.toThrow(
        /https/,
      );
    } finally {
      rmSync(src, { recursive: true, force: true });
      rmSync(out, { recursive: true, force: true });
    }
  });
});
