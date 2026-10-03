/**
 * arf.tamga.network — Tamga ARF (ADR-0018). İngilizce kök, Türkçe /tr/.
 * İngilizce sayfalar arf/*.md (elle çevrilir, `source_version` taşır); Türkçe sayfalar docs/framework'ten üretilir
 * (scripts/arf-sync.mjs → arf/tr/, gitignore — index.md hariç). [[FW-*]] atıfları bu sitenin sayfalarına, diğer
 * [[DOC-ID]] atıfları geliştirici belgelerine (docs.tamga.network) bağlanır.
 */
import { defineConfig, type DefaultTheme } from "vitepress";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { ARF_PAGES, DOCS_BASE, buildDocIndex, docLinks } from "../../docs/.vitepress/doc-index";
import { termTips } from "../../docs/.vitepress/terms";
import { brandHead, pageHead } from "../../docs/.vitepress/seo";

const REPO = join(__dirname, "..", "..");
// Geliştirici belgelerine bağlantı sayfanın diline göre: İngilizce ARF → docs kökü, Türkçe ARF → docs /tr/.
const IDX = { en: buildDocIndex(join(REPO, "docs"), "en"), tr: buildDocIndex(join(REPO, "docs"), "tr") };
const REL: { latest: string; releases: { id: string; languages: string[]; docs: Record<string, string> }[] } =
  JSON.parse(readFileSync(join(__dirname, "..", "releases.json"), "utf8"));
const RELEASE = REL.latest;

type Loc = "en" | "tr";
const T: Record<
  Loc,
  { prefix: string; doc: string[]; nav: Record<string, string>; outline: string; prev: string; next: string }
> = {
  en: {
    prefix: "/",
    doc: [
      "Architecture and Reference Framework",
      "Annex A — Trust Framework",
      "Annex B — Tamga Rulebook",
      "Education Rulebook",
      "Identity Rulebook",
      "Event Ticket Rulebook",
      "Annex D — Definitions",
      "Annex E — References",
      "Reading path",
      "Roles",
      "Onboarding",
    ],
    nav: {
      framework: "Framework",
      annexes: "Annexes",
      joining: "Taking part",
      changes: "What changed",
      general: "General docs",
      developers: "Developer docs",
    },
    outline: "On this page",
    prev: "Previous",
    next: "Next",
  },
  tr: {
    prefix: "/tr/",
    doc: [
      "Mimari ve Referans Çerçevesi",
      "Ek A — Trust Framework",
      "Ek B — Tamga Rulebook",
      "Education Rulebook",
      "Identity Rulebook",
      "Event Ticket Rulebook",
      "Ek D — Tanımlar",
      "Ek E — Kaynaklar",
      "Okuma yolu",
      "Roller",
      "Katılım süreci",
    ],
    nav: {
      framework: "Çerçeve",
      annexes: "Ekler",
      joining: "Katılım",
      changes: "Ne değişti",
      general: "Genel belgeler",
      developers: "Geliştirici belgeleri",
    },
    outline: "Bu sayfada",
    prev: "Önceki",
    next: "Sonraki",
  },
};
const IDS = Object.keys(ARF_PAGES);
const PAGES = Object.values(ARF_PAGES);

function theme(l: Loc): DefaultTheme.Config {
  const t = T[l];
  /** Yayında bulunan belgeler (sıra numarasıyla seçilir): Ek C rulebook'ları ayrı bir grup altında. */
  const docItems = (docs: Record<string, string>, root: string, idx: number[]): DefaultTheme.SidebarItem[] =>
    idx.filter((i) => docs[IDS[i]]).map((i) => ({ text: t.doc[i], link: `${root}${PAGES[i]}` }));
  const link = (i: number) => `${t.prefix}${PAGES[i]}`;
  const general = l === "tr" ? "https://tamga.network/tr/docs" : "https://tamga.network/en/docs";
  return {
    nav: [
      { text: t.nav.framework, link: link(0) },
      {
        text: t.nav.annexes,
        items: [1, 2, 3, 4, 5, 6, 7].map((i) => ({ text: t.doc[i], link: link(i) })),
      },
      { text: t.nav.joining, items: [8, 9, 10].map((i) => ({ text: t.doc[i], link: link(i) })) },
      { text: t.nav.changes, link: `${t.prefix}changes` },
      { text: t.nav.developers, link: DOCS_BASE },
      { text: t.nav.general, link: general },
    ],
    // Her yayının kendi kenar çubuğu: güncel yayın kökte, eskiler /v<yayın>/ altında (İngilizcesi olmayan yayın Türkçeye bağlanır).
    sidebar: Object.fromEntries(
      REL.releases.map((r) => {
        const cur = r.id === RELEASE;
        const root = `${t.prefix}${cur ? "" : `v${r.id}/`}`;
        const docRoot = l === "en" && !r.languages.includes("en") ? `/tr/v${r.id}/` : root;
        const items: DefaultTheme.SidebarItem[] = [
          {
            text: `Tamga ARF ${r.id}${cur ? (l === "tr" ? " · güncel" : " · latest") : ""}`,
            items: [
              { text: l === "tr" ? "Genel bakış" : "Overview", link: root },
              ...docItems(r.docs, docRoot, [8]),
              ...docItems(r.docs, docRoot, [0, 1, 2]),
              {
                text: l === "tr" ? "Ek C — Rulebook'lar" : "Annex C — Rulebooks",
                collapsed: false,
                items: docItems(r.docs, docRoot, [3, 4, 5]),
              },
              ...docItems(r.docs, docRoot, [6, 7]),
              ...(r.docs[IDS[9]]
                ? [{ text: t.nav.joining, collapsed: false, items: docItems(r.docs, docRoot, [9, 10]) }]
                : []),
              { text: t.nav.changes, link: `${t.prefix}changes` },
            ],
          },
        ];
        return [root, items];
      }),
    ),
    outline: { level: [2, 3], label: t.outline },
    docFooter: { prev: t.prev, next: t.next },
    footer: {
      message:
        l === "tr"
          ? `Tamga ARF ${RELEASE} · CC BY 4.0 · Türkçe metin kaynaktır`
          : `Tamga ARF ${RELEASE} · CC BY 4.0 · The Turkish text is the source; this is its official translation`,
      copyright: "Tamga Network",
    },
  };
}

export default defineConfig({
  title: "Tamga ARF",
  description:
    "Tamga ARF — the Architecture and Reference Framework of Tamga Network: roles, trust model, flows and participant rules.",
  srcDir: ".",
  srcExclude: ["archive/**"], // dondurulmuş kaynak; sayfaları arf-sync üretir
  outDir: "./.vitepress/dist",
  cleanUrls: true,
  ignoreDeadLinks: true,
  lastUpdated: false,
  sitemap: { hostname: "https://arf.tamga.network" },
  // Dil eşleri: İngilizce kök ↔ /tr/ — yalnız iki dilde de sayfa varsa (eski yayınlar yalnız Türkçe olabilir: v0.1).
  transformHead: (ctx) =>
    pageHead("arf.tamga.network", ctx, (rel) => {
      const en = rel.replace(/^tr\//, "");
      const md = (p: string) => join(__dirname, "..", `${p === "" || p.endsWith("/") ? `${p}index` : p}.md`);
      if (!existsSync(md(en)) || !existsSync(md(`tr/${en}`))) return undefined;
      return { en, tr: `tr/${en}`, "x-default": en };
    }),
  head: [
    ["meta", { name: "robots", content: "index,follow" }],
    ...brandHead("Tamga ARF"),
    ["link", { rel: "preconnect", href: "https://fonts.googleapis.com" }],
    ["link", { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" }],
    [
      "link",
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=Onest:wght@500;600;700&display=swap",
      },
    ],
  ],
  locales: {
    root: { label: "English", lang: "en", themeConfig: theme("en") },
    tr: { label: "Türkçe", lang: "tr-TR", link: "/tr/", themeConfig: theme("tr") },
  },
  themeConfig: {
    logo: "/mark.svg",
    siteTitle: "Tamga ARF",
    search: { provider: "local" },
  },
  markdown: {
    config(md) {
      docLinks(md, (id, rel) => {
        // Sayfanın dili ve yayını: tr/v0.1/… → /tr/v0.1/; çerçeve atıfları aynı yayının sayfalarına gider.
        const prefix = "/" + (/^(tr\/)?(v\d+\.\d+\/)?/.exec(rel)?.[0] ?? "");
        const page = ARF_PAGES[id];
        const e = IDX[rel.startsWith("tr/") ? "tr" : "en"].get(id);
        if (page) return { href: `${prefix}${page}`, title: e?.title ?? id };
        if (!e) return undefined;
        return { href: e.path.startsWith("http") ? e.path : `${DOCS_BASE}${e.path}`, title: e.title };
      });
      termTips(md, (rel) => (rel.startsWith("tr/") ? "tr" : "en"));
    },
  },
});
