/**
 * Şema kataloğu bütünlüğü (SPEC-SCHEMA-0001, ADR-0010): kaynak tanımlar ve — derlenmişse — dist/ çıktısı.
 * dist/ yoksa (npm run setup çalışmadıysa) ikinci bölüm atlanır.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256Sri, computeSchemaId } from "@tamga-network/core";
import { ALL, CATALOGUE_BASE } from "./definitions.js";

const DIST = resolve(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const VCT_URN = /^urn:tamga:[a-z]+:[A-Za-z]+:\d+$/;

describe("şema tanımları", () => {
  it("her vct URN biçiminde ve tekil", () => {
    const vcts = ALL.map((s) => s.vct);
    for (const v of vcts) expect(v).toMatch(VCT_URN);
    expect(new Set(vcts).size).toBe(vcts.length);
  });

  it("katalog yolları tekil ve sürümlü", () => {
    const paths = ALL.map((s) => s.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const p of paths) expect(p).toMatch(/^[a-z]+\/[A-Za-z]+\/\d+\.\d+\.\d+$/);
  });

  it("extends yalnızca katalogdaki bir vct'yi gösterir", () => {
    const vcts = new Set(ALL.map((s) => s.vct));
    for (const s of ALL) if (s.extends) expect(vcts.has(s.extends)).toBe(true);
  });

  it("JSON şeması ve tip metadata'sı JSON olarak gidip gelir", () => {
    for (const s of ALL) {
      expect(JSON.parse(JSON.stringify(s.jsonSchema))).toEqual(s.jsonSchema);
      expect(JSON.parse(JSON.stringify(s.typeMetadata))).toEqual(s.typeMetadata);
    }
  });
});

describe.skipIf(!existsSync(resolve(DIST, "catalogue.json")))("derlenmiş katalog (dist/)", () => {
  const catalogue = () =>
    JSON.parse(readFileSync(resolve(DIST, "catalogue.json"), "utf8")) as {
      base: string;
      entries: { vct: string; schema_id: string; metadata_url: string; content_hash: string }[];
    };

  it("her tanım katalogda bir kez yer alır", () => {
    const c = catalogue();
    expect(c.base).toBe(CATALOGUE_BASE);
    const vcts = c.entries.map((e) => e.vct);
    expect(new Set(vcts).size).toBe(vcts.length);
    expect([...vcts].sort()).toEqual(ALL.map((s) => s.vct).sort());
  });

  it("schema_id = keccak256(vct); content_hash = metadata.json özeti", () => {
    for (const e of catalogue().entries) {
      expect(e.schema_id).toBe(computeSchemaId(e.vct));
      const file = resolve(DIST, e.metadata_url.slice(CATALOGUE_BASE.length + 1));
      expect(e.content_hash).toBe(sha256Sri(new Uint8Array(readFileSync(file))));
    }
  });

  it("metadata.json: schema_uri#integrity şema dosyasıyla eşleşir", () => {
    for (const s of ALL) {
      const meta = JSON.parse(readFileSync(resolve(DIST, s.path, "metadata.json"), "utf8")) as Record<string, string>;
      expect(meta.vct).toBe(s.vct);
      const schemaBytes = new Uint8Array(readFileSync(resolve(DIST, s.path, "schema.json")));
      expect(meta["schema_uri#integrity"]).toBe(sha256Sri(schemaBytes));
      if (s.extends) expect(meta["extends#integrity"]).toMatch(/^sha256-/);
    }
  });
});
