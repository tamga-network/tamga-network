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

  it("eşi olmayan vekil (lone surrogate) TextEncoder gibi U+FFFD olarak kodlanır", () => {
    for (const s of ["\ud800", "a\udc00b", "x\ud83d", "\udfff\ud800", "ok 🙂 \ud800"]) {
      expect([...utf8(s)]).toEqual([...new TextEncoder().encode(s)]);
    }
  });
});

describe("LoTE okuyucusu — katı ayrıştırma", () => {
  const doc = (info: Record<string, unknown>, list: unknown = []) => ({
    LoTE: {
      ListAndSchemeInformation: {
        LoTEVersionIdentifier: 1,
        LoTESequenceNumber: 1,
        ListIssueDateTime: "2026-10-01T00:00:00Z",
        NextUpdate: "2026-11-01T00:00:00Z",
        SchemeTerritory: "TR",
        ...info,
      },
      TrustedEntitiesList: list,
    },
  });
  it("SchemeTerritory zorunlu; liste alanları dizi olmalı", async () => {
    const { parseLote } = await import("./lote-reader.js");
    expect(parseLote(doc({})).territory).toBe("TR");
    expect(() => parseLote(doc({ SchemeTerritory: undefined }))).toThrow(/SchemeTerritory/);
    expect(() => parseLote(doc({ SchemeTerritory: "  " }))).toThrow(/SchemeTerritory/);
    expect(() => parseLote(doc({}, { not: "array" }))).toThrow(/TrustedEntitiesList is not an array/);
    expect(() => parseLote(doc({}, [{ TrustedEntityServices: {} }]))).toThrow(/TrustedEntityServices is not an array/);
    const svc = (certs: unknown) => [
      {
        TrustedEntityServices: [
          { ServiceInformation: { ServiceTypeIdentifier: "x", ServiceDigitalIdentity: { X509Certificates: certs } } },
        ],
      },
    ];
    expect(() => parseLote(doc({}, svc({ val: "AA==" })))).toThrow(/X509Certificates is not an array/);
  });
  it("base64: geçerli standart/URL güvenli kabul; karışık alfabe, ortada dolgu, bozuk uzunluk RED", async () => {
    const { b64ToBytes } = await import("./lote-reader.js");
    expect([...b64ToBytes("AAEC")]).toEqual([0, 1, 2]);
    expect([...b64ToBytes("AAE=")]).toEqual([0, 1]);
    expect([...b64ToBytes("AA\n E=")]).toEqual([0, 1]);
    expect([...b64ToBytes("-_8")]).toEqual([...Buffer.from("-_8", "base64url")]);
    expect(() => b64ToBytes("A+_B")).toThrow(/mixed/);
    expect(() => b64ToBytes("AA=A")).toThrow(/invalid base64/);
    expect(() => b64ToBytes("AAAAA")).toThrow(/length/);
    expect(() => b64ToBytes("AAE==")).toThrow(/length|padding/);
    expect(() => b64ToBytes("AA*A")).toThrow(/invalid base64/);
  });
});

describe("TrustStore — cüzdan sağlayıcı anahtar penceresi", () => {
  it("valid_from gelecekte ya da valid_to geçmişte olan WUA anahtarı tanınmaz", async () => {
    const { TrustStore } = await import("./store.js");
    const fp = (c: string) => c.repeat(64);
    const store = new TrustStore();
    const now = new Date("2026-10-07T00:00:00Z");
    store.applyLotl(
      {
        schemas: [],
        national_lists: [],
        wallet_providers: [
          {
            provider_id: "wp",
            legal_name: "WP",
            status: "ACTIVE",
            wua_signing_keys: [
              { fingerprint_sha256: fp("a"), status: "ACTIVE" },
              { fingerprint_sha256: fp("b"), status: "ACTIVE", valid_from: "2027-01-01T00:00:00Z" },
              { fingerprint_sha256: fp("c"), status: "ACTIVE", valid_to: "2026-01-01T00:00:00Z" },
              { fingerprint_sha256: fp("d"), status: "RETIRED" },
              { fingerprint_sha256: fp("e"), valid_from: "2026-01-01T00:00:00Z", valid_to: "2027-01-01T00:00:00Z" },
            ],
          },
        ],
      } as never,
      "",
      now,
    );
    expect([...store.wallet_provider_keys].sort()).toEqual([fp("a"), fp("e")]);
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
