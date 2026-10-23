/**
 * Şema kataloğu bütünlüğü (SPEC-SCHEMA-0001, ADR-0010): kaynak tanımlar ve — derlenmişse — dist/ çıktısı.
 * dist/ yoksa (npm run setup çalışmadıysa) ikinci bölüm atlanır.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256Sri, computeSchemaId } from "@tamga-network/core";
import { ALL, CATALOGUE_BASE, suspensionAllowed } from "./definitions.js";

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

describe("ADR-0048 K2: askı izni (suspension_allowed)", () => {
  it("yalnız diploma askıya alınabilir; kimlik servisinin türleri ve öteki türler alamaz; katalog dışı tür bilinmez", () => {
    expect(suspensionAllowed("urn:tamga:edu:DiplomaCredential:1")).toBe(true);
    for (const vct of [
      "urn:tamga:id:IdentityAttestation:1",
      "urn:tamga:id:DrivingLicenceAttestation:1",
      "urn:tamga:contact:EmailAddress:1",
      "urn:tamga:contact:PhoneNumber:1",
      "urn:tamga:edu:StudentCredential:1",
      "urn:tamga:tkt:EventTicket:1",
    ])
      expect(suspensionAllowed(vct)).toBe(false);
    expect(suspensionAllowed("urn:example:Other:1")).toBeUndefined();
    const withFlag = ALL.filter((d) => (d.typeMetadata.tamga as { suspension_allowed?: boolean }).suspension_allowed);
    expect(withFlag.map((d) => d.vct)).toEqual(["urn:tamga:edu:DiplomaCredential:1"]);
  });
});

describe("ADR-0064: yaş eşikleri (`age_over_NN`, kapalı küme)", () => {
  const ageClaims = (vct: string) => {
    const d = ALL.find((s) => s.vct === vct)!;
    const props = Object.keys((d.jsonSchema as { properties: Record<string, unknown> }).properties);
    return props.filter((k) => k.startsWith("age_over_")).sort();
  };
  it("kimlik belgesi ve ZK kopyası tam olarak {15, 18} taşır; adlar ISO/IEC 18013-5 deseninde", () => {
    for (const vct of ["urn:tamga:id:IdentityAttestation:1", "urn:tamga:id:ShortLivedIdentityAttestation:1"]) {
      const ages = ageClaims(vct);
      expect(ages).toEqual(["age_over_15", "age_over_18"]);
      for (const a of ages) expect(a).toMatch(/^age_over_\d{2}$/);
    }
  });
  it("her yaş alanı seçici açıklanır, boolean, türetilmiş ve şemada zorunlu değil (kimlik belgesi)", () => {
    const d = ALL.find((s) => s.vct === "urn:tamga:id:IdentityAttestation:1")!;
    const js = d.jsonSchema as { properties: Record<string, { type?: string }>; required: string[] };
    const tm = d.typeMetadata as { claims: { path: string[]; sd?: string }[]; tamga: { derived_claims: string[] } };
    for (const a of ["age_over_15", "age_over_18"]) {
      expect(js.properties[a]).toEqual({ type: "boolean" });
      expect(js.required).not.toContain(a);
      expect(tm.claims.find((c) => c.path.length === 1 && c.path[0] === a)?.sd).toBe("always");
      expect(tm.tamga.derived_claims).toContain(a);
    }
  });
  it("sürücü belgesi bilgisi yalnız age_over_18 taşır (K2)", () => {
    expect(ageClaims("urn:tamga:id:DrivingLicenceAttestation:1")).toEqual(["age_over_18"]);
  });
});
