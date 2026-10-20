// docs.tamga.network çeviri denetimi (CONTRIBUTING.md — Belgeler: diller ve terimler):
//   - yayınlanan her Türkçe sayfanın İngilizcesi docs/en/<aynı yol>'da var;
//   - document_id taşıyan sayfada çeviri `translation_of` = kimlik ve `source_version` = kaynağın sürümü;
//   - docs/az/<yol> (Azerbaycanca) varsa Türkçe kaynağıyla aynı kimlik ve sürümde;
//   - [[t:…]] terimlerinin hepsi docs/.vitepress/terms.json'da (docs, docs/en, docs/az, docs/framework, arf), az açıklamalı.
// Kullanım: node scripts/docs-i18n-check.mjs   (sorun varsa çıkış 1)
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(fileURLToPath(import.meta.url), "..", "..");
const docs = join(repo, "docs");
const TERMS = JSON.parse(readFileSync(join(docs, ".vitepress", "terms.json"), "utf8"));
/** docs/.vitepress/config.ts UNPUBLISHED ile aynı + üretilen sayfalar. */
const SKIP_DIRS = new Set([
  "en",
  "az",
  "framework",
  "_archive",
  "_internal",
  "ledger",
  "background",
  "packages",
  "public",
  ".vitepress",
]);
const SKIP_FILES = new Set([
  "architecture/servers.md",
  "architecture/package-publishing.md",
  "architecture/index.md",
  "changelog.md",
  "rules.md",
]);

function walk(dir, out = [], top = true) {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) {
      if (!(top && SKIP_DIRS.has(n)) && n !== ".vitepress" && n !== "node_modules") walk(p, out, false);
    } else if (n.endsWith(".md")) out.push(p);
  }
  return out;
}
const fm = (txt) => {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(txt);
  const o = {};
  if (m)
    for (const l of m[1].split(/\r?\n/)) {
      const r = /^([a-z_]+):\s*(.*)$/.exec(l);
      if (r) o[r[1]] = r[2].trim().replace(/^["']|["']$/g, "");
    }
  return o;
};

const problems = [];
let pages = 0;
for (const f of walk(docs)) {
  const rel = relative(docs, f).split(sep).join("/");
  if (SKIP_FILES.has(rel)) continue;
  pages++;
  const src = fm(readFileSync(f, "utf8"));
  const enPath = join(docs, "en", rel);
  if (!existsSync(enPath)) {
    problems.push(`${rel}: İngilizce çeviri yok (docs/en/${rel})`);
    continue;
  }
  const en = fm(readFileSync(enPath, "utf8"));
  if (src.document_id) {
    if (en.document_id !== src.document_id)
      problems.push(`en/${rel}: document_id ${en.document_id} ≠ ${src.document_id}`);
    if (en.translation_of !== src.document_id)
      problems.push(`en/${rel}: translation_of ${en.translation_of} ≠ ${src.document_id}`);
    if (en.source_version !== src.version)
      problems.push(`en/${rel}: source_version ${en.source_version} ≠ kaynak ${src.version} — çeviriyi güncelleyin`);
  }
}
// Azerbaycanca (docs/az, makine çevirisi): her sayfanın Türkçe kaynağı var, kimlik/translation_of/source_version kaynağa uyar.
// Kapsam zorunlu değil (çevrilmemiş sayfa İngilizceye bağlanır); var olan çeviri eskiyse hata.
let azPages = 0;
for (const f of walk(join(docs, "az"), [], false)) {
  const rel = relative(join(docs, "az"), f).split(sep).join("/");
  // üretilen yedek sayfalar (scripts/docs-sync-root.mjs) çeviri değildir
  if (/^az_fallback:\s*true/m.test(readFileSync(f, "utf8"))) continue;
  azPages++;
  const srcPath = join(docs, rel);
  if (!existsSync(srcPath)) {
    problems.push(`az/${rel}: Türkçe kaynağı yok (docs/${rel})`);
    continue;
  }
  const src = fm(readFileSync(srcPath, "utf8"));
  const az = fm(readFileSync(f, "utf8"));
  if (src.document_id) {
    if (az.document_id !== src.document_id)
      problems.push(`az/${rel}: document_id ${az.document_id} ≠ ${src.document_id}`);
    if (az.translation_of !== src.document_id)
      problems.push(`az/${rel}: translation_of ${az.translation_of} ≠ ${src.document_id}`);
    if (az.source_version !== src.version)
      problems.push(`az/${rel}: source_version ${az.source_version} ≠ kaynak ${src.version} — çeviriyi güncelleyin`);
  }
}
for (const [id, t] of Object.entries(TERMS)) if (!t.az) problems.push(`terms.json: ${id} için az açıklaması yok`);
// Terimler
const TERM_RE = /\[\[t:([A-Za-z0-9_.-]+)(?:\|[^\]]+)?\]\]/g;
const termFiles = [
  ...walk(docs),
  ...walk(join(docs, "en"), [], false),
  ...walk(join(docs, "az"), [], false),
  ...walk(join(docs, "framework"), [], false),
];
for (const f of [...termFiles, ...walk(join(repo, "arf"), [], false)]) {
  const txt = readFileSync(f, "utf8");
  for (const m of txt.matchAll(TERM_RE))
    if (!TERMS[m[1]]) problems.push(`${relative(repo, f).split(sep).join("/")}: bilinmeyen terim [[t:${m[1]}]]`);
}
if (problems.length) {
  console.error(`docs-i18n: ${problems.length} sorun`);
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log(`docs-i18n: ${pages} sayfa çevrilmiş (az: ${azPages}), terimler tanımlı`);
