/**
 * docs.tamga.network ve arf.tamga.network ortak belge indeksi: document_id → yol, [[DOC-ID]] bağlantı eklentisi,
 * Türkçe sayfalarda site içi bağlantılara `/tr` öneki.
 * Dil düzeni (2026-10-02): İngilizce kökte (`docs/en/…` kaynağından), Türkçe `/tr/` altında (`docs/…` kaynağı, normatif metin).
 * Çerçeve belgeleri (FW-*) yalnızca Tamga ARF sitesinde yayınlanır (ADR-0018/DY1); diğer siteler oraya bağlanır.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type MarkdownIt from "markdown-it";

export const DOCS_BASE = "https://docs.tamga.network";
export const ARF_BASE = "https://arf.tamga.network";
export const GITHUB = "https://github.com/tamga-network/tamga-network/blob/main";

export type Lang = "en" | "tr";
/** Kaynak yolundan sayfanın dili: `en/…` İngilizce, gerisi Türkçe (docs); ARF'de `tr/…` Türkçe. */
export const docsLangOf = (rel: string): Lang => (rel.startsWith("en/") ? "en" : "tr");

/** Tamga ARF sayfaları: document_id → yayın yolu (her iki dilde aynı; Türkçe `/tr/` önekli). */
export const ARF_PAGES: Record<string, string> = {
  "FW-ARF-0001": "architecture",
  "FW-TF-0001": "trust-framework",
  "FW-RB-0001": "rulebook",
  "FW-RB-0002": "rulebooks/education",
  "FW-RB-0003": "rulebooks/identity",
  "FW-RB-0004": "rulebooks/event-ticket",
  "FW-DEF-0001": "definitions",
  "FW-REF-0001": "references",
  "FW-READ-0001": "reading-path",
  "FW-ROLE-0001": "roles",
  "FW-ONB-0001": "onboarding",
};

/**
 * Sitede sayfası olan kök belgeler. INVARIANTS sitede /rules sayfasıdır; iç karar kütüğüne (DECISIONS) verilen atıf karar
 * kayıtları sayfasına (/adr/) gider. Diğer iç kök belgeler public depoda yoktur: atıfları bağlantısız kod olarak görünür.
 */
const ROOT_LINKS: Record<string, { title: string; path?: string; github?: string }> = {
  INVARIANTS: { title: "Binding rules · Bağlayıcı kurallar", path: "/rules" },
  DECISIONS: { title: "Decision records · Karar kayıtları", path: "/adr/" },
};

/** `src`: docs/'a göre kaynak yolu (`specifications/wallet.md`, `en/specifications/wallet.md`); `path`: sitedeki adres. */
export type Entry = { id: string; title: string; path: string; src: string; version?: string; status?: string };

export function walk(dir: string, out: string[] = [], skip: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".") || name === "node_modules" || skip.includes(name)) continue;
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

/** Kaynak yolu → site yolu (`index` klasör köküdür). */
export function toUrl(file: string, base: string): string {
  return ("/" + relative(base, file).split(sep).join("/").replace(/\.md$/, "")).replace(/\/index$/, "/");
}

/**
 * Bir dilin belge indeksi. Türkçe: docs/ (en/ hariç), yollar `/tr/…`. İngilizce: docs/en/; çevirisi olmayan belge Türkçe
 * sayfasına düşer (atıf kopmaz).
 */
export function buildDocIndex(docsDir: string, lang: Lang = "tr"): Map<string, Entry> {
  const entries = new Map<string, Entry>();
  const add = (f: string, base: string, prefix: string, srcPrefix: string) => {
    const fm = frontMatter(f);
    const id = fm.document_id;
    if (!id || entries.has(id)) return;
    entries.set(id, {
      id,
      title: fm.title ?? firstHeading(f, base),
      path: prefix + toUrl(f, base),
      src: srcPrefix + relative(base, f).split(sep).join("/"),
      version: fm.version,
      status: fm.status,
    });
  };
  if (lang === "en") for (const f of walk(join(docsDir, "en"))) add(f, join(docsDir, "en"), "", "en/");
  for (const f of walk(docsDir, [], ["en"])) add(f, docsDir, "/tr", "");
  for (const [id, r] of Object.entries(ROOT_LINKS))
    if (!entries.has(id))
      entries.set(id, {
        id,
        title: r.title,
        path: r.path ? (lang === "tr" ? "/tr" : "") + r.path : `${GITHUB}/${r.github}`,
        src: r.github ?? "",
      });
  return entries;
}

export type Resolved = { href: string; title: string } | undefined;

/**
 * Sayfanın kaynak yoluna göre göreli yolu. VitePress `rewrites` sonrası `relativePath` yayın yoludur (`docs/en/adr/x.md` →
 * `adr/x.md`); dil `docsLangOf` ile kaynaktan anlaşılsın diye İngilizce kaynaklara `en/` öneki geri eklenir.
 */
export function sourceRel(env: unknown): string {
  // `path` de yayın yoludur; kaynak dosya `realPath`'tedir.
  const e = (env ?? {}) as { relativePath?: string; realPath?: string };
  const rel = e.relativePath ?? "";
  const src = (e.realPath ?? "").split(sep).join("/");
  return /\/docs\/en\//.test(src) && !rel.startsWith("en/") ? "en/" + rel : rel;
}

/** [[DOC-ID]] → bağlantı; [[DOC-ID]]/KOD → bağlantı + kod. `resolve` sayfanın göreli yolunu da alır (dil öneki için). */
export function docLinks(md: MarkdownIt, resolve: (id: string, relativePath: string) => Resolved): void {
  const ID_RE = /\[\[([A-Z][A-Z0-9_-]+)\]\](\/[A-Za-z0-9.-]+)?/g;
  md.core.ruler.after("inline", "tamga-doc-links", (state) => {
    const rel = sourceRel(state.env);
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

/**
 * Türkçe sayfalarda (kaynağı `en/` olmayan) site içi mutlak bağlantılara `/tr` öneki: markdown bağlantıları ve ham HTML
 * (`href="/…"`). `/tr/`, dosya bağlantıları (`.json`, `.yaml`, `.pdf`) ve dış adresler dokunulmaz.
 */
export function localeLinks(md: MarkdownIt, isTr: (relativePath: string) => boolean): void {
  const skip = (href: string) => !href.startsWith("/") || href.startsWith("//") || /^\/tr(\/|$)/.test(href) || /\.(json|ya?ml|pdf|svg|png|ico)$/.test(href);
  const fix = (href: string) => (skip(href) ? href : "/tr" + href);
  const fixHtml = (html: string) => html.replace(/href="(\/[^"]*)"/g, (_m, h: string) => `href="${fix(h)}"`);
  md.core.ruler.push("tamga-locale-links", (state) => {
    const rel = sourceRel(state.env);
    if (!isTr(rel)) return;
    for (const tok of state.tokens) {
      if (tok.type === "html_block") tok.content = fixHtml(tok.content);
      for (const child of tok.children ?? []) {
        if (child.type === "link_open") {
          const href = child.attrGet("href");
          if (href) child.attrSet("href", fix(href));
        } else if (child.type === "html_inline") child.content = fixHtml(child.content);
      }
    }
  });
}
