/**
 * docs.tamga.network ve arf.tamga.network ortak belge indeksi: document_id → yol, [[DOC-ID]] bağlantı eklentisi.
 * Çerçeve belgeleri (FW-*) yalnızca Tamga ARF sitesinde yayınlanır (ADR-0018/DY1); diğer siteler oraya bağlanır.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type MarkdownIt from "markdown-it";

export const DOCS_BASE = "https://docs.tamga.network";
export const ARF_BASE = "https://arf.tamga.network";

/** Tamga ARF sayfaları: document_id → yayın yolu (her iki dilde aynı; Türkçe `/tr/` önekli). */
export const ARF_PAGES: Record<string, string> = {
  "FW-ARF-0001": "architecture",
  "FW-TF-0001": "annex-a-trust-framework",
  "FW-RB-0001": "annex-b-participant-rules",
  "FW-RB-0002": "annex-c-education",
  "FW-RB-0003": "annex-c-identity",
  "FW-RB-0004": "annex-c-event-ticket",
  "FW-DEF-0001": "annex-d-definitions",
  "FW-REF-0001": "annex-e-references",
};

/** Kök md dosyaları docs sitesinde /root/<AD> olarak yayınlanır (scripts/docs-sync-root.mjs). */
export const ROOT_IDS = ["DECISIONS", "GLOSSARY", "INVARIANTS", "SCENARIOS", "MASTER_INDEX", "DOCUMENTATION-STANDARD"];

export type Entry = { id: string; title: string; path: string; version?: string; status?: string };

export function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".") || name === "node_modules") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith(".md")) out.push(p);
  }
  return out;
}

export function frontMatter(file: string): Record<string, string> {
  const txt = readFileSync(file, "utf8");
  if (!txt.startsWith("---")) return {};
  const end = txt.indexOf("\n---", 3);
  if (end < 0) return {};
  const fm: Record<string, string> = {};
  for (const line of txt.slice(3, end).split(/\r?\n/)) {
    const m = /^([a-z_]+):\s*(.+)$/.exec(line);
    if (m) fm[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return fm;
}

export function firstHeading(file: string, base: string): string {
  const txt = readFileSync(file, "utf8");
  const m = /^#\s+(.+)$/m.exec(txt.replace(/^---[\s\S]*?\n---/, ""));
  return m ? m[1].trim() : relative(base, file);
}

export function toUrl(file: string, base: string): string {
  return "/" + relative(base, file).split(sep).join("/").replace(/\.md$/, "");
}

/** docs/ altındaki tüm document_id'ler (yollar docs sitesine göre). */
export function buildDocIndex(docsDir: string): Map<string, Entry> {
  const entries = new Map<string, Entry>();
  for (const f of walk(docsDir)) {
    const fm = frontMatter(f);
    const id = fm.document_id;
    if (id && !entries.has(id))
      entries.set(id, { id, title: fm.title ?? firstHeading(f, docsDir), path: toUrl(f, docsDir), version: fm.version, status: fm.status });
  }
  for (const id of ROOT_IDS) if (!entries.has(id)) entries.set(id, { id, title: id, path: `/root/${id}` });
  return entries;
}

export type Resolved = { href: string; title: string } | undefined;

/** [[DOC-ID]] → bağlantı; [[DOC-ID]]/KOD → bağlantı + kod. `resolve` sayfanın göreli yolunu da alır (dil öneki için). */
export function docLinks(md: MarkdownIt, resolve: (id: string, relativePath: string) => Resolved): void {
  const ID_RE = /\[\[([A-Z][A-Z0-9_-]+)\]\](\/[A-Za-z0-9.-]+)?/g;
  md.core.ruler.after("inline", "tamga-doc-links", (state) => {
    const rel: string = (state.env as { relativePath?: string })?.relativePath ?? "";
    for (const tok of state.tokens) {
      if (tok.type !== "inline" || !tok.children) continue;
      for (const child of tok.children) {
        if (child.type !== "text" || !ID_RE.test(child.content)) continue;
        ID_RE.lastIndex = 0;
        child.type = "html_inline";
        child.content = md.utils.escapeHtml(child.content).replace(ID_RE, (_m, id: string, code: string | undefined) => {
          const r = resolve(id, rel);
          const label = code ? `${id}${code}` : id;
          return r
            ? `<a class="doc-id" href="${md.normalizeLink(r.href)}" title="${md.utils.escapeHtml(r.title)}">${label}</a>`
            : `<code>${label}</code>`;
        });
      }
    }
  });
}
