/**
 * Katalog derleyici — schemas.tamga.network/v1 statik çıktısı.
 *   dist/<path>/schema.json      JSON Schema (LF, UTF-8, BOM'suz, sonda \n — SPEC-SCHEMA-0001 §3.2)
 *   dist/<path>/metadata.json    Type Metadata (extends#integrity, schema_uri#integrity dolu)
 *   dist/catalogue.json          vct → {schema_id, metadata_url, content_hash, layer, status}
 *   dist/index.json              build özeti (trust-publisher bunu lotl.schemas'a alır)
 * D1: dist/ içinde var olan bir dosya farklı baytlarla yeniden yazılmak istenirse HATA (değişmezlik).
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ALL, CATALOGUE_BASE, SCHEMA_STAGE, type SchemaDef } from "./definitions.js";
import { sha256Sri, utf8, computeSchemaId } from "@tamga-network/core";

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, "..", "dist");

function canon(obj: unknown): Uint8Array {
  return utf8(JSON.stringify(obj, null, 2) + "\n");
}

function writeImmutable(file: string, bytes: Uint8Array) {
  if (existsSync(file)) {
    const cur = new Uint8Array(readFileSync(file));
    if (Buffer.compare(Buffer.from(cur), Buffer.from(bytes)) !== 0) {
      // ADR-0029: geliştirme evresinde yerinde düzeltme; beta'da (stable) D1 hatası
      if (SCHEMA_STAGE === "stable")
        throw new Error(`D1 violation: a published file would change: ${file} — open a new version path`);
      console.warn(`[geliştirme] şema yerinde güncellendi (ADR-0029): ${file}`);
      writeFileSync(file, bytes);
    }
    return;
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, bytes);
}

const ORDER = [
  "vct",
  "version",
  "name",
  "description",
  "extends",
  "extends#integrity",
  "schema_uri",
  "schema_uri#integrity",
  "display",
  "claims",
  "tamga",
];

/** Tek sürümün metadata baytları (alan sırası sabit; ebeveyn metadata baytları extends#integrity için). */
function render(def: SchemaDef, schemaBytes: Uint8Array, parentMeta?: Uint8Array): Uint8Array {
  const base = `${CATALOGUE_BASE}/${def.path}`;
  const meta: Record<string, unknown> = { vct: def.vct, version: def.metadataVersion, ...def.typeMetadata };
  if (def.extends) {
    if (!parentMeta) throw new Error(`parent must be built first: ${def.extends}`);
    meta.extends = def.extends;
    meta["extends#integrity"] = sha256Sri(parentMeta);
  }
  meta.schema_uri = `${base}/schema.json`;
  meta["schema_uri#integrity"] = sha256Sri(schemaBytes);
  const ordered: Record<string, unknown> = {};
  for (const k of ORDER) if (k in meta) ordered[k] = meta[k];
  return canon(ordered);
}

export function build() {
  const byVct = new Map<string, { def: SchemaDef; schemaBytes: Uint8Array; metaBytes?: Uint8Array }>();
  for (const def of ALL) byVct.set(def.vct, { def, schemaBytes: canon(def.jsonSchema) });

  const out: Array<{
    vct: string;
    schema_id: string;
    metadata_url: string;
    schema_url: string;
    content_hash: string;
    /** ADR-0010 K4: aynı vct'nin geçerli tüm sürümleri (eskiden yeniye; son = güncel) */
    content_hashes: string[];
    version: string;
    layer: string;
    status: string;
  }> = [];
  // Ebeveynler önce (extends#integrity için)
  const order = [...byVct.values()].sort((a, b) => (a.def.extends ? 1 : 0) - (b.def.extends ? 1 : 0));
  for (const item of order) {
    const { def, schemaBytes } = item;
    const metaBytes = render(def, schemaBytes, def.extends ? byVct.get(def.extends)?.metaBytes : undefined);
    item.metaBytes = metaBytes;
    writeImmutable(resolve(dist, def.path, "schema.json"), schemaBytes);
    writeImmutable(resolve(dist, def.path, "metadata.json"), metaBytes);
  }
  for (const item of order) {
    const { def, metaBytes } = item;
    const base = `${CATALOGUE_BASE}/${def.path}`;
    const current = sha256Sri(metaBytes!);
    out.push({
      vct: def.vct,
      schema_id: computeSchemaId(def.vct),
      metadata_url: `${base}/metadata.json`,
      schema_url: `${base}/schema.json`,
      content_hash: current,
      content_hashes: [current],
      version: def.metadataVersion,
      layer: def.layer,
      status: "ACTIVE",
    });
  }
  const catalogue = {
    catalogue_version: 1,
    generated_at: new Date().toISOString(),
    base: CATALOGUE_BASE,
    note: "IETF SD-JWT VC §5.3.2 registry resolution: vct → metadata_url (current); content_hash == vct#integrity; content_hashes = valid versions (development stage: only the current one, ADR-0029).",
    entries: out,
  };
  mkdirSync(dist, { recursive: true });
  writeFileSync(resolve(dist, "catalogue.json"), JSON.stringify(catalogue, null, 2) + "\n");
  writeFileSync(resolve(dist, "index.json"), JSON.stringify(out, null, 2) + "\n");
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const r = build();
  console.log(JSON.stringify(r, null, 2));
}
