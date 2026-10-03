// ADR listesi (Türkçe docs/adr ve İngilizce docs/en/adr ön bilgisinden) — ADR ana sayfasındaki karar tablosu için.
import { createContentLoader } from "vitepress";

export interface AdrRow {
  id: string;
  title: string;
  url: string;
  lang: "en" | "tr";
  status: string;
  domain: string;
  created: string;
}

declare const data: AdrRow[];
export { data };

export default createContentLoader(["adr/0*.md", "en/adr/0*.md"], {
  transform(raw): AdrRow[] {
    return raw
      .map(({ url, frontmatter: f }) => {
        const en = url.startsWith("/en/") || !url.startsWith("/tr/");
        const slug = url.replace(/^\/(en|tr)\//, "/").replace(/^\/adr\//, "");
        return {
          id: String(f.document_id ?? ""),
          title: String(f.title ?? ""),
          url: (en ? "/adr/" : "/tr/adr/") + slug,
          lang: (en ? "en" : "tr") as "en" | "tr",
          status: String(f.status ?? ""),
          domain: String(f.domain ?? ""),
          created: f.created instanceof Date ? f.created.toISOString().slice(0, 10) : String(f.created ?? "").slice(0, 10),
        };
      })
      .filter((r) => r.id)
      .sort((a, b) => a.id.localeCompare(b.id));
  },
});
