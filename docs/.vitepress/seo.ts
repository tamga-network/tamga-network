/**
 * docs.tamga.network ve arf.tamga.network için ortak arama/paylaşım etiketleri: simgeler, sayfa başına canonical,
 * Open Graph / Twitter kartı, dil eşleri (ARF: İngilizce kök ↔ /tr/) ve JSON-LD. Simge dosyaları tek kaynaktan
 * (`ops/brand/icons/`) `copyBrandPublic` ile sitenin `public/` klasörüne kopyalanır (gitignore).
 */
import type { HeadConfig, TransformContext } from "vitepress";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
    ["meta", { name: "theme-color", content: "#1E5A78" }],
    ["meta", { property: "og:site_name", content: siteName }],
    ["meta", { property: "og:type", content: "article" }],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
  ];
}

const ogLocale = (lang: string) => (lang.startsWith("tr") ? "tr_TR" : lang.startsWith("az") ? "az_AZ" : "en_US");

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
  const title = rel === "" || rel === "tr/" || rel === "az/" ? ctx.siteData.title : ctx.pageData.title || ctx.title;
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

type SitemapItem = { url: string; lastmod?: string | number; links?: { url: string; lang: string }[] };

/** Deponun bütün dosyalarının son commit tarihi (tek `git log`; yollar depo köküne göre). */
function gitDates(repo: string): Map<string, string> {
  const dates = new Map<string, string>();
  try {
    const out = execFileSync("git", ["-c", "core.quotePath=false", "log", "--format=@%cI", "--name-only"], {
      cwd: repo,
      encoding: "utf8",
      maxBuffer: 512 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
    let current = "";
    for (const raw of out.split(/\r?\n/)) {
      const line = raw.trim();
      if (line.startsWith("@")) current = line.slice(1);
      else if (line && !dates.has(line)) dates.set(line, current);
    }
  } catch {
    /* git yok: lastmod yazılmaz */
  }
  return dates;
}

/** Sayfa dosyasının başı (ön madde + üretim işareti); dosya yoksa boş. */
function headOf(file: string): string {
  try {
    return readFileSync(file, "utf8").split("\n", 14).join("\n");
  } catch {
    return "";
  }
}

/**
 * Site haritası düzeltmesi (`sitemap.transformItems`):
 * 1. Gerçek `lastmod`: sayfanın kaynak dosyasının son commit tarihi (VitePress'in `lastUpdated` seçeneği her sayfa için ayrı git
 *    çağırır ve sayfaya "son güncelleme" satırı ekler; burada yalnız site haritası, tek git çağrısıyla). `toSource` site
 *    adresini (ör. "tr/adr/0001-…", "index") depo köküne göre .md yoluna çevirir. Sayfa üretilmişse (gitignore) dosyanın
 *    "ÜRETİLDİ … Kaynak:" işaretindeki kaynak, o da yoksa `fallback`'in verdiği kaynaklar denenir. Tarih bulunamazsa lastmod
 *    yazılmaz (uydurma "bugün" yok; Google her derlemede değişen lastmod'a güvenmez).
 * 2. noindex sayfalar (Azerbaycanca yedek sayfalar, `az_fallback: true`) haritadan ve dil eşlerinden çıkarılır — haritada
 *    noindex adres olması Search Console'da hata sayılır.
 */
export function gitLastmod(repo: string, toSource: (page: string) => string, fallback?: (src: string) => string[]) {
  const dates = gitDates(repo);
  return (items: SitemapItem[]): SitemapItem[] => {
    const info = new Map<string, { lastmod?: string; noindex: boolean }>();
    for (const it of items) {
      const page = it.url === "" || it.url.endsWith("/") ? `${it.url}index` : it.url;
      const src = toSource(page);
      const head = headOf(join(repo, src));
      const noindex = /^az_fallback:\s*true/m.test(head) || /name:\s*"robots",\s*content:\s*"noindex"/.test(head);
      const gen = dates.has(src) ? undefined : head.match(/ÜRETİLDİ[^\n]*?[Kk]aynak:\s*([^\s()]+)/)?.[1];
      const candidates = [src, ...(gen ? [gen] : []), ...(fallback?.(src) ?? [])];
      info.set(it.url, { lastmod: candidates.map((c) => dates.get(c)).find(Boolean), noindex });
    }
    return items
      .filter((it) => !info.get(it.url)?.noindex)
      .map((it) => {
        const { lastmod } = info.get(it.url) ?? {};
        const links = it.links?.filter((l) => !info.get(l.url)?.noindex);
        return {
          ...it,
          ...(lastmod ? { lastmod } : {}),
          ...(links ? { links: links.length > 1 ? links : undefined } : {}),
        };
      });
  };
}
