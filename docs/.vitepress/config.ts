/**
 * docs.tamga.network — geliştirici belgeleri (ADR-0018: üç kapı). VitePress yapılandırması.
 * Diller (2026-10-02): İngilizce kökte, Türkçe /tr/ altında. Kaynak: Türkçe `docs/<bölüm>/…` (normatif metin), İngilizce
 * çevirisi `docs/en/<bölüm>/…` (`translation_of` + `source_version`). `rewrites` en/ → kök, gerisi → tr/.
 * Yapı (Stripe benzeri): Başlarken · Kavramlar · API · SDK'lar · Şartnameler · Sürüm notları; her bölümün kendi kenar çubuğu.
 * Üretilen sayfalar (scripts/docs-sync-root.mjs, gitignore): paketler, sürüm notları, bağlayıcı kurallar, API başvuru sayfaları
 * (docs/api/*.openapi.yaml → scripts/openapi-pages.mjs; genel bakış api/index.md elle yazılır).
 * Çerçeve belgeleri (docs/framework) Tamga ARF sitesinde yayınlanır; [[FW-*]] atıfları oraya bağlanır (DY1).
 */
import { defineConfig, type DefaultTheme } from "vitepress";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { brandHead, pageHead } from "./seo";
import { ARF_BASE, ARF_PAGES, GITHUB, buildDocIndex, docLinks, docsLangOf, localeLinks, type Lang } from "./doc-index";
import { termTips } from "./terms";

const DOCS = __dirname.replace(/[\\/]\.vitepress$/, "");
const IDX = { en: buildDocIndex(DOCS, "en"), tr: buildDocIndex(DOCS, "tr") };

/**
 * Yayın kapsamı: geliştiriciye bugün gereken belgeler yayında; arka plan, zincir aşaması, iç kayıtlar ve arşiv depoda kalır.
 * Yayında olmayan belgeye verilen [[DOC-ID]] atfı GitHub'daki kaynağına gider (atıf kopmaz).
 */
const UNPUBLISHED = [
  "framework/**", // Tamga ARF sitesinde
  "_archive/**",
  "_internal/**",
  "ledger/**",
  "background/**",
  "architecture/servers.md", // işletim içi
  "architecture/package-publishing.md",
  "architecture/index.md",
];
const unpublishedRe = UNPUBLISHED.map(
  (g) =>
    new RegExp(
      "^(en/)?" +
        g
          .replace(/[.+^${}()|[\]\\]/g, "\\$&")
          .replace(/\*\*/g, "\u0000")
          .replace(/\*/g, "[^/]*")
          .replace(/\u0000/g, ".*") +
        "$",
    ),
);
const isPublished = (src: string) => !unpublishedRe.some((re) => re.test(src));

const PACKAGES = ["core", "trust", "schemas", "sd-jwt", "mdoc", "issuer", "verifier", "wallet-core"];

/** Arayüz metinleri. */
const T = {
  en: {
    prefix: "/",
    getStarted: "Get started",
    concepts: "Concepts",
    sdks: "SDKs",
    specs: "Specifications",
    releaseNotes: "Release notes",
    more: "More",
    arf: "Tamga ARF — roles and rules",
    site: "tamga.network — overview",
    learn: "Learn — from zero to the network",
    joining: "Joining the network",
    help: "Help",
    overview: "Overview",
    codeExamples: "Code examples",
    verify: "Verifying credentials",
    issue: "Issuing credentials",
    wallet: "Wallets",
    trust: "Trust lists",
    groups: ["Credentials", "Protocols", "Trust and identity", "Schemas", "Wallet", "Architecture"],
    decisions: "Decisions (ADR)",
    allDecisions: "All decisions",
    adrGroups: {
      Trust: "Trust",
      Credentials: "Credentials",
      Identity: "Identity and privacy",
      Wallet: "Wallet",
      Services: "Services",
      Governance: "Governance",
    },
    glossaryRules: "Glossary and rules",
    glossary: "Glossary",
    rules: "Binding rules",
    allPackages: "All packages",
    apiRef: "API reference",
    apiServices: "Services",
    apiRegistries: "Public registries",
    apiProtocols: "Standard protocols",
    apiPages: {
      verify: "Tamga Verify API",
      issuer: "Hosted issuer API",
      "institution-source": "Institution source endpoint",
      "trust-lists": "Trust lists",
      "status-lists": "Status lists",
      "schema-catalogue": "Schema catalogue",
    },
    outline: "On this page",
    edit: "Edit this page on GitHub",
    prev: "Previous",
    next: "Next",
    footer: "Docs CC BY 4.0 · Code Apache-2.0",
    title: "Tamga Developer Docs",
    description:
      "Tamga Network developer docs: guides, code examples, packages and specifications for verifiers, issuers, wallet developers and network operators.",
  },
  tr: {
    prefix: "/tr/",
    getStarted: "Başlarken",
    concepts: "Kavramlar",
    sdks: "SDK'lar",
    specs: "Şartnameler",
    releaseNotes: "Sürüm notları",
    more: "Daha fazla",
    arf: "Tamga ARF — roller ve kurallar",
    site: "tamga.network — genel anlatım",
    learn: "Öğren — sıfırdan ağa",
    joining: "Ağa katılım",
    help: "Yardım",
    overview: "Genel bakış",
    codeExamples: "Kod örnekleri",
    verify: "Belge doğrulama",
    issue: "Belge verme",
    wallet: "Cüzdan",
    trust: "Güven listeleri",
    groups: ["Belgeler", "Protokoller", "Güven ve kimlik", "Şemalar", "Cüzdan", "Mimari"],
    decisions: "Kararlar (ADR)",
    allDecisions: "Tüm kararlar",
    adrGroups: {
      Trust: "Güven",
      Credentials: "Belgeler",
      Identity: "Kimlik ve gizlilik",
      Wallet: "Cüzdan",
      Services: "Hizmetler",
      Governance: "Yönetişim",
    },
    glossaryRules: "Sözlük ve kurallar",
    glossary: "Sözlük",
    rules: "Bağlayıcı kurallar",
    allPackages: "Tüm paketler",
    apiRef: "API başvurusu",
    apiServices: "Hizmetler",
    apiRegistries: "Herkese açık kayıtlar",
    apiProtocols: "Standart protokoller",
    apiPages: {
      verify: "Tamga Verify API",
      issuer: "Belge verme API'si",
      "institution-source": "Kurum sorgu ucu",
      "trust-lists": "Güven listeleri",
      "status-lists": "Durum listeleri",
      "schema-catalogue": "Şema kataloğu",
    },
    outline: "Bu sayfada",
    edit: "Bu sayfayı GitHub'da düzenle",
    prev: "Önceki",
    next: "Sonraki",
    footer: "Belgeler CC BY 4.0 · Kod Apache-2.0",
    title: "Tamga Geliştirici Belgeleri",
    description:
      "Tamga Network geliştirici belgeleri: doğrulayıcılar, belge veren kurumlar, cüzdan geliştiricileri ve ağ operatörleri için rehberler, kod örnekleri, paketler ve şartnameler.",
  },
};

/** ADR konu grupları (ön bilgideki `domain`), okuma sırasıyla. */
const ADR_GROUPS = ["Trust", "Credentials", "Identity", "Wallet", "Services", "Governance"] as const;

function sidebars(l: Lang): DefaultTheme.Sidebar {
  const t = T[l];
  const p = l === "tr" ? "/tr" : "";
  const idx = IDX[l];
  const doc = (id: string, text?: string): DefaultTheme.SidebarItem => {
    const e = idx.get(id);
    if (!e) throw new Error(`docs config: ${id} bulunamadı`);
    if (!isPublished(e.src)) throw new Error(`docs config: ${id} yayında değil`);
    return { text: text ?? e.title, link: e.path };
  };
  const adrs = [...idx.values()].filter((e) => e.id.startsWith("ADR-"));
  const domainOf = (e: { src: string }) => {
    const src = join(DOCS, e.src);
    return existsSync(src) ? /^domain:\s*(\S+)/m.exec(readFileSync(src, "utf8"))?.[1] : undefined;
  };
  const adrGroup = (g: string) =>
    adrs
      .filter((e) => domainOf(e) === g)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((e) => ({ text: `${e.id.slice(4)} · ${e.title}`, link: e.path }));

  const guides: DefaultTheme.SidebarItem[] = [
    { text: t.getStarted, items: [doc("GUIDE-0000", t.overview), doc("GUIDE-0004")] },
    { text: t.joining, items: [doc("GUIDE-0007"), doc("GUIDE-0008"), doc("GUIDE-0009"), doc("GUIDE-0013")] },
    { text: t.verify, items: [doc("GUIDE-0001"), doc("GUIDE-0002")] },
    { text: t.issue, items: [doc("GUIDE-0003")] },
    { text: t.wallet, items: [doc("GUIDE-0005"), doc("GUIDE-0010")] },
    { text: t.trust, items: [doc("GUIDE-0006"), doc("GUIDE-0011")] },
    { text: t.help, items: [doc("GUIDE-0012")] },
  ];
  const concepts: DefaultTheme.SidebarItem[] = [
    {
      text: t.concepts,
      items: [
        { text: t.overview, link: `${p}/concepts/` },
        ...["trust-lists", "federation", "credential-formats", "issuance", "presentation", "privacy", "revocation"].map((s) => ({
          text: conceptTitle(l, s),
          link: `${p}/concepts/${s}`,
        })),
      ],
    },
  ];
  const reference: DefaultTheme.SidebarItem[] = [
    { text: t.specs, link: `${p}/specifications/` },
    { text: t.groups[0], collapsed: false, items: ["SPEC-CRED-0001", "SPEC-CRED-0002", "SPEC-CRED-0003"].map((i) => doc(i)) },
    { text: t.groups[1], collapsed: false, items: ["SPEC-PROTO-0001", "SPEC-PROTO-0002", "SPEC-API-0001"].map((i) => doc(i)) },
    { text: t.groups[2], collapsed: false, items: ["SPEC-TRUST-0001", "SPEC-ID-0002", "SPEC-ID-0003"].map((i) => doc(i)) },
    { text: t.groups[3], collapsed: true, items: ["SPEC-SCHEMA-0001", "SPEC-SCHEMA-0002", "SPEC-SCHEMA-0003"].map((i) => doc(i)) },
    { text: t.groups[4], collapsed: true, items: [doc("SPEC-WALLET-0001")] },
    { text: t.groups[5], collapsed: true, items: [doc("ARCH-0003")] },
    {
      text: t.decisions,
      collapsed: true,
      items: [
        { text: t.allDecisions, link: `${p}/adr/` },
        ...ADR_GROUPS.map((g) => ({ text: t.adrGroups[g], collapsed: true, items: adrGroup(g) })),
      ],
    },
    {
      text: t.glossaryRules,
      collapsed: true,
      items: [
        { text: t.glossary, link: `${p}/glossary` },
        { text: t.rules, link: `${p}/rules` },
      ],
    },
    { text: t.releaseNotes, link: `${p}/changelog` },
  ];
  const packages: DefaultTheme.SidebarItem[] = [
    {
      text: t.sdks,
      items: [
        { text: t.allPackages, link: `${p}/packages/` },
        ...PACKAGES.map((n) => ({ text: `@tamga-network/${n}`, link: `${p}/packages/${n}` })),
      ],
    },
    { text: t.apiRef, items: [{ text: t.overview, link: `${p}/api/` }] },
  ];
  const apiPage = (slug: keyof typeof t.apiPages) => ({ text: t.apiPages[slug], link: `${p}/api/${slug}` });
  const api: DefaultTheme.SidebarItem[] = [
    { text: t.apiRef, items: [{ text: t.overview, link: `${p}/api/` }] },
    { text: t.apiServices, items: [apiPage("verify"), apiPage("issuer"), apiPage("institution-source")] },
    { text: t.apiRegistries, items: [apiPage("trust-lists"), apiPage("status-lists"), apiPage("schema-catalogue")] },
    { text: t.apiProtocols, items: [doc("SPEC-PROTO-0001"), doc("SPEC-PROTO-0002"), doc("SPEC-API-0001")] },
  ];
  return {
    [`${p}/guides/`]: guides,
    [`${p}/concepts/`]: concepts,
    [`${p}/packages/`]: packages,
    [`${p}/api/`]: api,
    [`${p}/specifications/`]: reference,
    [`${p}/adr/`]: reference,
    [`${p}/architecture/`]: reference,
    [`${p}/glossary`]: reference,
    [`${p}/rules`]: reference,
    [`${p}/changelog`]: reference,
  };
}

/** Kavram sayfalarının başlığı (ön bilgide document_id yok; başlık dosyadan). */
function conceptTitle(l: Lang, slug: string): string {
  const f = join(DOCS, l === "en" ? "en" : "", "concepts", `${slug}.md`);
  const src = existsSync(f) ? f : join(DOCS, "concepts", `${slug}.md`);
  return /^title:\s*"?([^"\n]+)"?/m.exec(readFileSync(src, "utf8"))?.[1] ?? slug;
}

function theme(l: Lang): DefaultTheme.Config {
  const t = T[l];
  const p = l === "tr" ? "/tr" : "";
  const arf = l === "tr" ? `${ARF_BASE}/tr/` : `${ARF_BASE}/`;
  const site = l === "tr" ? "https://tamga.network/tr" : "https://tamga.network/en";
  const learn = `${site}/learn`;
  return {
    nav: [
      { text: t.getStarted, link: `${p}/guides/`, activeMatch: `^${p}/guides/` },
      { text: t.concepts, link: `${p}/concepts/`, activeMatch: `^${p}/concepts/` },
      { text: "API", link: `${p}/api/`, activeMatch: `^${p}/api/` },
      { text: t.sdks, link: `${p}/packages/`, activeMatch: `^${p}/packages/` },
      {
        text: t.specs,
        link: `${p}/specifications/`,
        activeMatch: `^${p}/(specifications|adr|architecture|glossary|rules)`,
      },
      { text: t.releaseNotes, link: `${p}/changelog` },
      {
        text: t.more,
        items: [
          { text: t.learn, link: learn },
          { text: t.arf, link: arf },
          { text: t.site, link: site },
          { text: "GitHub", link: "https://github.com/tamga-network" },
        ],
      },
    ],
    sidebar: sidebars(l),
    outline: { level: [2, 3], label: t.outline },
    editLink: {
      // Üretilen sayfalar (docs-sync-root) kaynak dosyalarına bağlanır; gerisi docs/ altındaki dosyaya.
      pattern: ({ filePath }) => {
        // İstemcide çalışır (dizgeye çevrilir): dış sabit kullanılamaz.
        const G = "https://github.com/tamga-network/tamga-network/blob/main";
        const s = filePath.replace(/^en\//, "");
        if (s === "changelog.md") return `${G}/CHANGELOG.md`;
        // API başvuru sayfaları OpenAPI tanımından üretilir: düzenleme YAML'da
        const api: Record<string, string> = {
          verify: "hosted-verifier-api",
          issuer: "tamga-issuer-api",
          "institution-source": "institution-source",
          "trust-lists": "trust-lists",
          "status-lists": "status-lists",
          "schema-catalogue": "schema-catalogue",
        };
        const a = /^api\/(.+)\.md$/.exec(s);
        if (a && api[a[1]]) return `${G}/docs/api/${api[a[1]]}.openapi.yaml`;
        if (s === "rules.md") return `${G}/INVARIANTS.md`;
        const m = /^packages\/(.+)\.md$/.exec(s);
        if (m) return m[1] === "index" ? `${G}/packages` : `${G}/packages/${m[1]}/README.md`;
        return `${G}/docs/${filePath}`;
      },
      text: t.edit,
    },
    docFooter: { prev: t.prev, next: t.next },
    footer: {
      message: `${t.footer} · <a href="${arf}">Tamga ARF</a> · <a href="${site}">tamga.network</a>`,
      copyright: "Tamga Network",
    },
  };
}

export default defineConfig({
  title: T.en.title,
  titleTemplate: ":title · Tamga Docs",
  description: T.en.description,
  srcDir: ".",
  srcExclude: UNPUBLISHED.flatMap((g) => [g, `en/${g}`]),
  // İngilizce (en/) kökte, Türkçe kaynak /tr/ altında.
  rewrites: (id) => (id.startsWith("en/") ? id.slice(3) : `tr/${id}`),
  outDir: "./.vitepress/dist",
  cleanUrls: true,
  ignoreDeadLinks: true,
  lastUpdated: false,
  head: [
    ["meta", { name: "robots", content: "index,follow" }],
    ...brandHead("Tamga Docs"),
    ["link", { rel: "preconnect", href: "https://fonts.googleapis.com" }],
    ["link", { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" }],
    [
      "link",
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=Onest:wght@500;600;700&display=swap",
      },
    ],
  ],
  sitemap: { hostname: "https://docs.tamga.network" },
  // Dil eşleri: kök (en) ↔ /tr/ — yalnız iki dilde de sayfa varsa.
  transformHead: (ctx) =>
    pageHead("docs.tamga.network", ctx, (rel) => {
      const en = rel.replace(/^tr\//, "");
      const src = (base: string) => {
        const f = en === "" || en.endsWith("/") ? `${en}index` : en;
        return existsSync(join(DOCS, base, `${f}.md`));
      };
      if (!src("en") || !src("")) return undefined;
      return { en, tr: `tr/${en}`, "x-default": en };
    }),
  locales: {
    root: { label: "English", lang: "en", title: T.en.title, description: T.en.description, themeConfig: theme("en") },
    tr: {
      label: "Türkçe",
      lang: "tr-TR",
      link: "/tr/",
      title: T.tr.title,
      description: T.tr.description,
      themeConfig: theme("tr"),
    },
  },
  themeConfig: {
    logo: "/mark.svg",
    siteTitle: "Tamga Docs",
    search: {
      provider: "local",
      options: {
        locales: {
          tr: {
            translations: {
              button: { buttonText: "Ara", buttonAriaLabel: "Belgelerde ara" },
              modal: {
                displayDetails: "Ayrıntıları göster",
                resetButtonTitle: "Aramayı temizle",
                backButtonTitle: "Kapat",
                noResultsText: "Sonuç yok:",
                footer: { selectText: "seç", navigateText: "gezin", closeText: "kapat" },
              },
            },
          },
        },
      },
    },
  },
  markdown: {
    lineNumbers: true,
    config(md) {
      docLinks(md, (id, rel) => {
        const l = docsLangOf(rel);
        const page = ARF_PAGES[id];
        if (page) return { href: `${ARF_BASE}/${l === "tr" ? "tr/" : ""}${page}`, title: IDX[l].get(id)?.title ?? id };
        const e = IDX[l].get(id);
        if (!e) return undefined;
        if (e.path.startsWith("http")) return { href: e.path, title: e.title };
        return { href: isPublished(e.src) ? e.path : `${GITHUB}/docs/${e.src}`, title: e.title };
      });
      termTips(md, docsLangOf);
      localeLinks(md, (rel) => docsLangOf(rel) === "tr");
    },
  },
});
