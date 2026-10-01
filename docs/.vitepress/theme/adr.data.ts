// ADR listesi (docs/adr/*.md ön bilgisinden) — ADR ana sayfasındaki karar tablosu için.
import { createContentLoader } from "vitepress";

export interface AdrRow {
  id: string;
  title: string;
  url: string;
  status: string;
  domain: string;
  created: string;
}

declare const data: AdrRow[];
export { data };

export default createContentLoader("adr/0*.md", {
  transform(raw): AdrRow[] {
    return raw
      .map(({ url, frontmatter: f }) => ({
        id: String(f.document_id ?? ""),
        title: String(f.title ?? ""),
        url,
        status: String(f.status ?? ""),
        domain: String(f.domain ?? ""),
        created: String(f.created ?? ""),
      }))
      .filter((r) => r.id)
      .sort((a, b) => b.id.localeCompare(a.id));
  },
});
