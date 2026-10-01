/**
 * docs.tamga.network ve arf.tamga.network için ortak arama/paylaşım etiketleri: simgeler, sayfa başına canonical,
 * Open Graph / Twitter kartı, dil eşleri (ARF: İngilizce kök ↔ /tr/) ve JSON-LD. Simge dosyaları tek kaynaktan
 * (`ops/brand/icons/`) `copyBrandPublic` ile sitenin `public/` klasörüne kopyalanır (gitignore).
 */
import type { HeadConfig, TransformContext } from "vitepress";
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const BRAND_FILES = ["favicon.ico", "icon.svg", "mark.svg", "apple-touch-icon.png", "og.png"];

/** Simgeleri ve robots.txt'yi sitenin public/ klasörüne yazar (sync betiklerinden çağrılır). */
export function copyBrandPublic(repo: string, publicDir: string, host: string): void {
  const src = join(repo, "ops", "brand", "icons");
  mkdirSync(publicDir, { recursive: true });
  for (const f of BRAND_FILES) if (existsSync(join(src, f))) copyFileSync(join(src, f), join(publicDir, f));
  writeFileSync(join(publicDir, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: https://${host}/sitemap.xml\n`);
}

/** Her sayfada aynı olan etiketler. */
export function brandHead(siteName: string): HeadConfig[] {
  return [
    ["link", { rel: "icon", href: "/favicon.ico", sizes: "48x48" }],
    ["link", { rel: "icon", href: "/icon.svg", type: "image/svg+xml" }],
    ["link", { rel: "apple-touch-icon", href: "/apple-touch-icon.png" }],
    ["meta", { name: "theme-color", content: "#17110F" }],
    ["meta", { property: "og:site_name", content: siteName }],
    ["meta", { property: "og:type", content: "article" }],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
  ];
}

const ogLocale = (lang: string) => (lang.startsWith("tr") ? "tr_TR" : "en_US");

/** Sayfa başına etiketler. `alternates` verilirse dil eşleri (hreflang) de yazılır. */
export function pageHead(
  host: string,
  ctx: TransformContext,
  alternates?: (path: string) => Record<string, string> | undefined,
): HeadConfig[] {
  const rel = ctx.pageData.relativePath.replace(/\.md$/, "").replace(/(^|\/)index$/, "$1");
  if (ctx.pageData.isNotFound || rel === "404") return [["meta", { name: "robots", content: "noindex" }]];
  const url = `https://${host}/${rel}`;
  // Paylaşım başlığı sayfanın kendi başlığı (site adı og:site_name'de); ana sayfada site adı.
  const title = rel === "" || rel === "tr/" ? ctx.siteData.title : ctx.pageData.title || ctx.title;
  const description = ctx.description;
  const image = `https://${host}/og.png`;
  const head: HeadConfig[] = [
    ["link", { rel: "canonical", href: url }],
    ["meta", { property: "og:url", content: url }],
    ["meta", { property: "og:title", content: title }],
    ["meta", { property: "og:description", content: description }],
    ["meta", { property: "og:locale", content: ogLocale(ctx.pageData.frontmatter.lang ?? ctx.siteData.lang) }],
    ["meta", { property: "og:image", content: image }],
    ["meta", { property: "og:image:width", content: "1200" }],
    ["meta", { property: "og:image:height", content: "630" }],
    ["meta", { name: "twitter:title", content: title }],
    ["meta", { name: "twitter:description", content: description }],
    ["meta", { name: "twitter:image", content: image }],
  ];
  const alt = alternates?.(rel);
  if (alt) {
    for (const [lang, p] of Object.entries(alt))
      head.push(["link", { rel: "alternate", hreflang: lang, href: `https://${host}/${p}` }]);
  }
  if (rel === "") {
    head.push([
      "script",
      { type: "application/ld+json" },
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: ctx.siteData.title,
        url: `https://${host}/`,
        inLanguage: ctx.siteData.lang,
        publisher: {
          "@type": "Organization",
          name: "Tamga Network",
          url: "https://tamga.network",
          logo: "https://tamga.network/logo-512.png",
        },
      }),
    ]);
  }
  return head;
}
