// MASTER_INDEX.md'yi belgelerin front matter'ından üretir (elle düzenlenmez).
// Kullanım: node scripts/master-index.mjs [--check]   (--check: dosya güncel değilse çıkış 1)
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const DOCS = join(ROOT, "docs");
const OUT = join(ROOT, "MASTER_INDEX.md");
const SKIP = new Set([
  "en",
  "_archive",
  "_internal",
  ".vitepress",
  "packages",
  "root",
  "public",
  "api",
  "node_modules",
]);

/** Bölümler: okurun yolu sırasıyla (sadeden derine). */
const SECTIONS = [
  ["guides", "Başlarken (rehberler)", "Adım adım: doğrulayıcı, belge veren kurum, cüzdan geliştirici."],
  ["concepts", "Kavramlar", "Sade anlatım; kod ve kural kodu yok."],
  ["specifications", "Şartnameler", "Kesin kurallar; uygulama bunlara uyar."],
  ["framework", "Tamga ARF ve ekleri", "Roller ve kurallar (arf.tamga.network)."],
  ["architecture", "Mimari", "Bugünkü bileşenler ve güven sınırları."],
  ["adr", "Kararlar (ADR)", "Kapatılmış kararlar; değişiklik yeni ADR ile."],
  ["background", "Arka plan", "Gerekçe (PM-*) ve araştırma (RS-*); sitede yayınlanmaz."],
  ["ledger", "Zincir aşaması", "Bugün kullanılmıyor (ADR-0009 eşiği); sitede yayınlanmaz."],
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (!SKIP.has(name)) walk(p, out);
    } else if (name.endsWith(".md")) out.push(p);
  }
  return out;
}

function frontMatter(file) {
  const s = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const m = /^---\n([\s\S]*?)\n---/.exec(s);
  if (!m) return null;
  const get = (k) => {
    const r = new RegExp(`^${k}:\\s*(.*)$`, "m").exec(m[1]);
    return r ? r[1].trim().replace(/^["']|["']$/g, "") : undefined;
  };
  const id = get("document_id");
  return id ? { id, title: get("title") ?? id, version: get("version") ?? "", status: get("status") ?? "" } : null;
}

const docs = walk(DOCS)
  .map((f) => ({ ...frontMatter(f), path: relative(ROOT, f).replace(/\\/g, "/") }))
  .filter((d) => d.id);

const lines = [
  "# Belge dizini",
  "",
  "> Bu dosya `node scripts/master-index.mjs` ile belgelerin front matter'ından **üretilir**; elle düzenlenmez.",
  "> Belgeler birbirine kimlikle (`[[ADR-0031]]`) bağlanır; klasör ya da başlık değişse de kimlik değişmez.",
  "",
  "Okuma sırası: Başlarken → Kavramlar → Şartnameler → Tamga ARF → Kararlar. Kök belgeler: `README.md`, `DECISIONS.md`",
  "(kararların özeti), `INVARIANTS.md` (bağlayıcı kurallar, üretilir), `docs/glossary.md` (sözlük), `CONVENTIONS.md` (kod kuralları),",
  "`DOCUMENTATION-STANDARD.md` (belge kuralları), `CHANGELOG.md` (sürüm notları).",
  "",
];
let total = 0;
for (const [dir, heading, note] of SECTIONS) {
  const items = docs
    .filter((d) => d.path.startsWith(`docs/${dir}/`))
    .sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));
  if (!items.length) continue;
  total += items.length;
  lines.push(`## ${heading}`, "", note, "", "| Kimlik | Başlık | Sürüm | Durum | Dosya |", "|---|---|---|---|---|");
  for (const d of items) lines.push(`| \`${d.id}\` | ${d.title} | ${d.version} | ${d.status} | \`${d.path}\` |`);
  lines.push("");
}
lines.push(`**Toplam:** ${total} belge.`, "");
const text = lines.join("\n");

if (process.argv.includes("--check")) {
  const cur = existsSync(OUT) ? readFileSync(OUT, "utf8").replace(/\r\n/g, "\n") : "";
  if (cur !== text) {
    console.error("MASTER_INDEX.md güncel değil — node scripts/master-index.mjs");
    process.exit(1);
  }
  console.log(`master-index: güncel (${total} belge)`);
} else {
  writeFileSync(OUT, text);
  console.log(`MASTER_INDEX.md yazıldı (${total} belge)`);
}
