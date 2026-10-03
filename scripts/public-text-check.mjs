// Kamuya açık belgelerde kişi adı, araç adı ve özel depo yolu olmaz (ADR-0018 DY3).
// Denetlenen: docs sitesinde yayınlanan belgeler (docs/, derleme dışı klasörler hariç), kök kayıtlar, Tamga ARF kaynakları.
// Onay alıntıları operatörün (özel) onay kaydında tutulur.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { PRIVATE_NAMES_RE } from "./private-names.mjs";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
/** docs/.vitepress/config.ts srcExclude ile aynı: yayınlanmayan iç kayıtlar. */
export const DOCS_UNPUBLISHED = ["_archive", "_internal", "root", "packages", ".vitepress"];
const ROOT_PUBLISHED = [
  "DECISIONS.md",
  "INVARIANTS.md",
  "MASTER_INDEX.md",
  "SCENARIOS.md",
  "DOCUMENTATION-STANDARD.md",
];
const FORBIDDEN = [
  [PRIVATE_NAMES_RE, "kişi adı"],
  [/\bClaude\b|\bOpus\b|\bFable\b|\bSonnet\b/, "araç adı"],
  [/TOPARLAMA|_reports\/|tamga-platform\/docs\/|-konusma-/, "iç kayıt yolu"],
  // 2026-10-02: yayınlanan belgelerde (docs sitesi) özel depo adı yok — "operatör deposu" yazılır
  [/tamga-platform/, "özel depo adı", (rel) => /^docs\//.test(rel)],
  // 2026-10-02: çalışma alanının ortak (private) docs/ klasörü
  [/docs\/records\/|docs\/roadmap\/|docs\/strategy\/|docs\/business\/|acik-isler\.md|onay-kayitlari/, "iç kayıt yolu"],
];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (dir === join(repo, "docs") && DOCS_UNPUBLISHED.includes(name)) continue;
      if (name === "node_modules" || name === ".vitepress") continue;
      walk(p, out);
    } else if (name.endsWith(".md")) out.push(p);
  }
  return out;
}

const files = [
  ...walk(join(repo, "docs")),
  ...ROOT_PUBLISHED.map((f) => join(repo, f)).filter(existsSync),
  ...walk(join(repo, "arf")).filter((f) => !f.split(sep).includes("tr") || f.endsWith(join("tr", "index.md"))),
];
const problems = [];
for (const f of files) {
  const lines = readFileSync(f, "utf8").split(/\r?\n/);
  lines.forEach((l, i) => {
    for (const [re, what, only] of FORBIDDEN)
      if ((!only || only(relative(repo, f).split("\\").join("/"))) && re.test(l))
        problems.push(`${relative(repo, f)}:${i + 1} ${what}: ${l.trim().slice(0, 90)}`);
  });
}
if (problems.length) {
  console.error(`public-text: ${problems.length} sorun\n  - ` + problems.join("\n  - "));
  process.exit(1);
}
console.log(`public-text: ${files.length} yayınlanan belge temiz`);
