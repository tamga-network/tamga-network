/**
 * Terim ipucu (2026-10-02): teknik terimler çevrilmez; `[[t:QTSP]]` yazılır, sayfada "QTSP (Qualified Trust Service
 * Provider) ⓘ" görünür — açılım yalnız sayfadaki ilk kullanımda. (i) üzerine gelince / dokununca okurun dilindeki açıklama
 * açılır. Terimler tek kaynakta: docs/.vitepress/terms.json (docs ve ARF ortak).
 * Etiketi değiştirmek için: `[[t:holder|holders]]` (açıklama yine `holder` teriminden).
 * Karma kural: `tr_label` olan terim Türkçe sayfada Türkçe yazılır, ilk kullanımda İngilizce terim parantezde ("güven listesi
 * (trust list) ⓘ"); Türkçe çekimli biçim için `[[t:trust-list|güven listesinde]]`.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type MarkdownIt from "markdown-it";
import { sourceRel } from "./doc-index";

export type Term = { label: string; expansion?: string; en: string; tr: string; tr_label?: string };
export const TERMS: Record<string, Term> = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "terms.json"), "utf8"),
);

const TERM_RE = /\[\[t:([A-Za-z0-9_.-]+)(?:\|([^\]]+))?\]\]/g;

export function termTips(md: MarkdownIt, langOf: (relativePath: string) => "en" | "tr"): void {
  // docLinks'ten SONRA çalışır (push): [[DOC-ID]] içeren düğüm html_inline olmuş olabilir; terimler orada da işlenir.
  md.core.ruler.push("tamga-terms", (state) => {
    const env = state.env as { relativePath?: string; tamgaTermsSeen?: Set<string> };
    const lang = langOf(sourceRel(env));
    const seen = (env.tamgaTermsSeen ??= new Set());
    const esc = md.utils.escapeHtml;
    for (const tok of state.tokens) {
      if (tok.type !== "inline" || !tok.children) continue;
      for (const child of tok.children) {
        if ((child.type !== "text" && child.type !== "html_inline") || !child.content.includes("[[t:")) continue;
        const html = child.type === "text" ? esc(child.content) : child.content;
        child.type = "html_inline";
        child.content = html.replace(TERM_RE, (m, id: string, alt?: string) => {
          const t = TERMS[id];
          if (!t) return `<code title="unknown term">${esc(id)}</code>`;
          const first = !seen.has(id);
          seen.add(id);
          // Türkçe sayfada Türkçe karşılığı olan terim (karma kural): metinde Türkçe, ilk kullanımda İngilizce terim parantezde.
          const trWord = lang === "tr" && t.tr_label;
          const label = esc(alt ?? (trWord ? t.tr_label! : t.label));
          // Etiket zaten İngilizce terimse ("Status List") parantezde tekrar yazılmaz.
          const englishAlt = !!alt && alt.toLocaleLowerCase("en").startsWith(t.label.toLocaleLowerCase("en"));
          const exp = !first
            ? ""
            : trWord
              ? englishAlt
                ? ""
                : ` (${esc(t.label)})`
              : t.expansion && !alt
                ? ` (${esc(t.expansion)})`
                : "";
          const tip = esc(lang === "tr" ? t.tr : t.en);
          return (
            `<span class="term">${label}${exp}<button type="button" class="term-i" aria-label="${esc(t.label)}: ${tip}">i</button>` +
            `<span class="term-tip" role="tooltip">${tip}</span></span>`
          );
        });
      }
    }
  });
}
