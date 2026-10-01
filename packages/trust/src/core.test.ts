/** ADR-0015 TS2 — `trust/core` taşınabilir kalmalı: içe aktarma ağacında Node'a özgü modül yok; özet çıktısı core ile aynı. */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { sha256Tag as coreTag, utf8 as coreUtf8 } from "@tamga-network/core";
import { sha256Tag, utf8 } from "./portable-hash.js";

const HERE = import.meta.dirname;
const FORBIDDEN = [/^node:/, /^jose$/, /^@tamga-network\/core$/, /^fs$/, /^path$/, /^crypto$/];

function importGraph(entry: string, seen = new Set<string>(), external = new Set<string>()) {
  if (seen.has(entry)) return { seen, external };
  seen.add(entry);
  const src = readFileSync(entry, "utf8");
  for (const m of src.matchAll(/(?:import|export)[^"']*?from\s+["']([^"']+)["']/g)) {
    const spec = m[1];
    if (spec.startsWith(".")) importGraph(resolve(dirname(entry), spec.replace(/\.js$/, ".ts")), seen, external);
    else external.add(spec);
  }
  return { seen, external };
}

describe("trust/core taşınabilirlik (ADR-0015)", () => {
  it("içe aktarma ağacında node:*, jose ya da @tamga-network/core yok", () => {
    const { seen, external } = importGraph(resolve(HERE, "core.ts"));
    expect(seen.size).toBeGreaterThan(3);
    const bad = [...external].filter((e) => FORBIDDEN.some((f) => f.test(e)));
    expect(bad).toEqual([]);
    expect([...external].sort()).toEqual(["@noble/hashes/sha2.js", "zod"]);
  });

  it("taşınabilir özet core ile birebir (çapa zinciri değişmez)", () => {
    for (const s of ["", "Tamga çapa satırı ğüşıöç 🙂", "a".repeat(1000)]) {
      expect(sha256Tag(utf8(s))).toBe(coreTag(coreUtf8(s)));
    }
  });
});

describe("liste şeması — tarih alanları", () => {
  it("okunamayan tarih reddedilir (NaN ile karşılaştırma sessizce geçmesin — fail-closed)", async () => {
    const { IsoDate, StatusHistoryEntry } = await import("./types.js");
    expect(IsoDate.safeParse("2026-09-24T00:00:00Z").success).toBe(true);
    expect(IsoDate.safeParse("2026-09-24").success).toBe(true);
    expect(IsoDate.safeParse("yarın").success).toBe(false);
    expect(IsoDate.safeParse("").success).toBe(false);
    expect(StatusHistoryEntry.safeParse({ status: "ACTIVE", since: "bozuk" }).success).toBe(false);
  });
});
