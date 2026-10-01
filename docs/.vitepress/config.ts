/**
 * docs.tamga.network — geliştirici belgeleri (ADR-0018: üç kapı). VitePress yapılandırması.
 * Yapı (Stripe benzeri): üst menü Başlarken · Kavramlar · API · SDK'lar · Spesifikasyonlar · Sürüm notları; her bölümün
 * kendi kenar çubuğu. İç kayıtlar ve geçersiz tasarımlar yayınlanmaz (UNPUBLISHED).
 * Kök md dosyaları ve paket sayfaları derleme öncesi scripts/docs-sync-root.mjs ile üretilir (docs/root/, docs/packages/ — gitignore).
 * Çerçeve belgeleri (docs/framework) burada yayınlanmaz; Tamga ARF sitesinde yayınlanır, [[FW-*]] atıfları oraya bağlanır (DY1).
 */
import { defineConfig, type DefaultTheme } from "vitepress";
import { brandHead, pageHead } from "./seo";
import { ARF_BASE, ARF_PAGES, buildDocIndex, docLinks } from "./doc-index";

const DOCS = __dirname.replace(/[\\/]\.vitepress$/, "");
const byId = buildDocIndex(DOCS);

/**
 * Yayın kapsamı (2026-10-01, ADR-0035 konumlanması): geliştiriciye bugün gereken belgeler yayında; geçersiz ya da iç kayıtlar
 * (zincir-önce tasarımlar, DID yöntemi, EBSI araştırmaları, proje hafızası, akademi) depoda kalır, sitede yayınlanmaz.
 * Yayında olmayan bir belgeye verilen [[DOC-ID]] atfı GitHub'daki kaynağına gider (atıf kopmaz).
 */
const UNPUBLISHED = [
  "api/**", // Scalar sayfası public/api altından statik yayınlanır
  "framework/**", // Tamga ARF sitesinde
  "_archive/**",
  "reviews/**",
  "beta/**",
  "delivery/**",
  "rfc/**",
  "project-memory/**",
  "research/**",
  "academy/**",
  "specifications/0001-trust-layer-contracts.md", // zincir kontratları — zincir aşamasında (ADR-0009)
  "specifications/0002-tamga-did-method.md", // DID yöntemi — kullanılmıyor (kurum kimliği X.509)
  "specifications/0003-guardian-escrow-accountable-disclosure.md", // araştırma
  "specifications/0015-agent-delegation-and-credential-gating.md", // zincir aşaması
  "architecture/0001-network-architecture.md", // zincir-önce topoloji
  "architecture/0002-besu-network-setup-step-by-step.md",
  "architecture/0004-server-inventory-and-operations.md", // işletim içi
  "architecture/0005-sdk-and-package-publishing.md",
  "architecture/0006-getting-started-runbook.md",
  "architecture/README.md",
  "root/DECISIONS.md",
  "root/MASTER_INDEX.md",
  "root/DOCUMENTATION-STANDARD.md",
  "root/SCENARIOS.md",
];
const GITHUB = "https://github.com/tamga-network/tamga-network/blob/main";
const unpublishedRe = UNPUBLISHED.map(
  (g) =>
    new RegExp(
      "^" +
        g
          .replace(/[.+^${}()|[\]\\]/g, "\\$&")
          .replace(/\*\*/g, "\u0000")
          .replace(/\*/g, "[^/]*")
          .replace(/\u0000/g, ".*") +
        "$",
    ),
);
/** Site yolu (/specifications/0002-…) yayında mı? */
const isPublished = (path: string) => !unpublishedRe.some((re) => re.test(path.replace(/^\//, "") + ".md"));
/** Yayında olmayan belgenin GitHub kaynağı. */
const sourceUrl = (path: string) =>
  path.startsWith("/root/") ? `${GITHUB}/${path.slice(6)}.md` : `${GITHUB}/docs${path}.md`;

/** Belge kimliğiyle kenar çubuğu öğesi; etiket verilmezse başlığın ilk parçası. */
function doc(id: string, text?: string): DefaultTheme.SidebarItem {
  const e = byId.get(id);
  if (!e) throw new Error(`docs config: ${id} bulunamadı`);
  if (!isPublished(e.path)) throw new Error(`docs config: ${id} yayında değil`);
  return { text: text ?? e.title.split(" — ")[0], link: e.path };
}

/** ADR'ler: "0035 · Konumlanma" biçiminde, yeniden eskiye. */
function adrItems(): DefaultTheme.SidebarItem[] {
  return [...byId.values()]
    .filter((e) => e.id.startsWith("ADR-"))
    .sort((a, b) => b.id.localeCompare(a.id))
    .map((e) => ({ text: `${e.id.slice(4)} · ${e.title.split(" — ")[0]}`, link: e.path }));
}

const PACKAGES = ["core", "trust", "schemas", "sd-jwt", "mdoc", "issuer", "verifier", "wallet-core"];
const ARF_TR = `${ARF_BASE}/tr/`;
const SITE = "https://tamga.network/tr";

const CONCEPTS: DefaultTheme.SidebarItem[] = [
  { text: "Genel bakış", link: "/concepts/" },
  { text: "Güven listeleri ve federasyon", link: "/concepts/guven-listeleri" },
  { text: "Belge biçimleri", link: "/concepts/belge-bicimleri" },
  { text: "Belge verme (OpenID4VCI)", link: "/concepts/belge-verme" },
  { text: "Belge gösterme (OpenID4VP)", link: "/concepts/belge-gosterme" },
  { text: "Gizlilik", link: "/concepts/gizlilik" },
  { text: "İptal ve tazelik", link: "/concepts/iptal" },
];

const GUIDES: DefaultTheme.SidebarItem[] = [
  { text: "Başlarken", items: [doc("GUIDE-0000", "Genel bakış"), doc("GUIDE-0004", "Kod örnekleri")] },
  {
    text: "Belge doğrulama",
    items: [doc("GUIDE-0001", "Web sitesine “Tamga ile giriş yap”"), doc("GUIDE-0002", "Sunucuda doğrulama")],
  },
  { text: "Belge verme", items: [doc("GUIDE-0003", "Kurum olarak belge vermek")] },
  { text: "Cüzdan", items: [doc("GUIDE-0005", "Uyumlu cüzdan geliştirmek")] },
  { text: "Güven listeleri", items: [doc("GUIDE-0006", "Listeleri okumak ve ağ")] },
];

const REFERENCE: DefaultTheme.SidebarItem[] = [
  { text: "Spesifikasyonlar", link: "/specifications/README" },
  {
    text: "Belgeler",
    collapsed: false,
    items: [
      doc("SPEC-CRED-0001", "Belge biçimi ve protokoller"),
      doc("SPEC-CRED-0002", "SD-JWT VC profili"),
      doc("SPEC-CRED-0003", "İptal listesi"),
    ],
  },
  {
    text: "Protokoller",
    collapsed: false,
    items: [
      doc("SPEC-PROTO-0001", "Belge verme (OpenID4VCI)"),
      doc("SPEC-PROTO-0002", "Belge gösterme (OpenID4VP)"),
      doc("SPEC-API-0001", "Doğrulama hattı ve servis API'si"),
    ],
  },
  {
    text: "Güven ve kimlik",
    collapsed: false,
    items: [
      doc("SPEC-TRUST-0001", "Güven listesi biçimi"),
      doc("SPEC-ID-0002", "Kurum kimliği (X.509)"),
      doc("SPEC-ID-0003", "Kimlik doğrulama profili"),
    ],
  },
  {
    text: "Şemalar",
    collapsed: true,
    items: [
      doc("SPEC-SCHEMA-0001", "Şema kataloğu"),
      doc("SPEC-SCHEMA-0002", "Eğitim şemaları"),
      doc("SPEC-SCHEMA-0003", "Sektör şemaları"),
    ],
  },
  { text: "Cüzdan", collapsed: true, items: [doc("SPEC-WALLET-0001", "Cüzdan kuralları")] },
  { text: "Mimari", collapsed: true, items: [doc("ARCH-0003", "Bileşen mimarisi")] },
  {
    text: "Kararlar (ADR)",
    collapsed: true,
    items: [{ text: "Tüm kararlar", link: "/adr/README" }, ...adrItems()],
  },
  {
    text: "Sözlük ve kurallar",
    collapsed: true,
    items: [
      { text: "Sözlük", link: "/root/GLOSSARY" },
      { text: "Bağlayıcı kurallar", link: "/root/INVARIANTS" },
    ],
  },
  { text: "Sürüm notları", link: "/root/CHANGELOG" },
];

const PACKAGE_SIDEBAR: DefaultTheme.SidebarItem[] = [
  {
    text: "SDK'lar",
    items: [
      { text: "Tüm paketler", link: "/packages/" },
      ...PACKAGES.map((p) => ({ text: `@tamga-network/${p}`, link: `/packages/${p}` })),
    ],
  },
  { text: "API başvurusu", items: [{ text: "Barındırılan servis API'leri ↗", link: "/api/", target: "_self" }] },
];

export default defineConfig({
  lang: "tr-TR",
  title: "Tamga Geliştirici Belgeleri",
  description:
    "Tamga Network geliştirici belgeleri: doğrulayıcılar, belge veren kurumlar, cüzdan geliştiricileri ve ağ operatörleri için rehberler, kod örnekleri, paketler ve spesifikasyonlar.",
  srcDir: ".",
  srcExclude: UNPUBLISHED,
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
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=Sora:wght@500;600;700&display=swap",
      },
    ],
  ],
  sitemap: { hostname: "https://docs.tamga.network" },
  transformHead: (ctx) => pageHead("docs.tamga.network", ctx),
  themeConfig: {
    logo: "/mark.svg",
    siteTitle: "Tamga Docs",
    search: {
      provider: "local",
      options: {
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
    outline: { level: [2, 3], label: "Bu sayfada" },
    editLink: { pattern: `${GITHUB}/docs/:path`, text: "Bu sayfayı GitHub'da düzenle" },
    docFooter: { prev: "Önceki", next: "Sonraki" },
    nav: [
      { text: "Başlarken", link: "/guides/README", activeMatch: "^/guides/" },
      { text: "Kavramlar", link: "/concepts/", activeMatch: "^/concepts/" },
      { text: "API", link: "/api/", target: "_self" },
      { text: "SDK'lar", link: "/packages/", activeMatch: "^/packages/" },
      { text: "Spesifikasyonlar", link: "/specifications/README", activeMatch: "^/(specifications|adr|root|architecture)/" },
      { text: "Sürüm notları", link: "/root/CHANGELOG" },
      {
        text: "Daha fazla",
        items: [
          { text: "Tamga ARF — roller ve kurallar", link: ARF_TR },
          { text: "tamga.network — genel anlatım", link: `${SITE}/docs` },
          { text: "GitHub", link: "https://github.com/tamga-network" },
        ],
      },
    ],
    sidebar: {
      "/guides/": GUIDES,
      "/concepts/": [{ text: "Kavramlar", items: CONCEPTS }],
      "/packages/": PACKAGE_SIDEBAR,
      "/specifications/": REFERENCE,
      "/adr/": REFERENCE,
      "/root/": REFERENCE,
      "/architecture/": REFERENCE,
    },
    footer: {
      message: `Belgeler CC BY 4.0 · Kod Apache-2.0 · <a href="${ARF_TR}">Tamga ARF</a> · <a href="${SITE}">tamga.network</a>`,
      copyright: "Tamga Network",
    },
  },
  markdown: {
    config(md) {
      docLinks(md, (id) => {
        const page = ARF_PAGES[id];
        if (page) return { href: `${ARF_TR}${page}`, title: byId.get(id)?.title ?? id };
        const e = byId.get(id);
        if (!e) return undefined;
        return { href: isPublished(e.path) ? e.path : sourceUrl(e.path), title: e.title };
      });
    },
  },
});
