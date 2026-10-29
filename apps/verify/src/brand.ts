/**
 * Sayfa iskeleti: tamga.network ile aynı görünüm. Tasarım dosyaları tek kaynaktan — `ops/brand/tamga-ui.{css,js}` — okunur ve
 * sayfaya gömülür (nginx olmadan da çalışır). Dil: tarayıcının ilk tercihi Türkçeyse "tr", değilse "en".
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";

const BRAND_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../../ops/brand");
const read = (f: string) => {
  try {
    return readFileSync(resolve(BRAND_DIR, f), "utf8");
  } catch {
    return "";
  }
};
/**
 * Sayfaların bütün biçim ve betik dosyaları ayrı dosya olarak bu servisten (`/assets/*`) sunulur: CSP'de satır içi biçim ve
 * betik yok (`style-src`/`script-src` yalnız 'self'; nonce yok). Marka dosyaları tek kaynaktan (`ops/brand`), sayfa betikleri
 * `apps/verify/assets/`, üçüncü taraf kütüphane kendi kopyamız (`assets/vendor/`, CDN yok).
 */
const ASSET_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../assets");
const readAsset = (f: string) => {
  try {
    return readFileSync(resolve(ASSET_DIR, f), "utf8");
  } catch {
    return "";
  }
};
const CSS_TYPE = "text/css; charset=utf-8";
const JS_TYPE = "application/javascript; charset=utf-8";
/**
 * Yazı tipleri kendi kopyamız (`ops/brand/fonts`, OFL 1.1): `tamga-ui.css` → `@import "fonts/fonts.css"` → `/assets/fonts/*.woff2`.
 * Üçüncü taraf yazı tipi sunucusu yok (ziyaretçinin IP'si başkasına gitmez; CSP `font-src 'self'`).
 */
export const FONT_FILES = [
  "onest-var.woff2",
  "ibm-plex-sans-var.woff2",
  "ibm-plex-sans-italic-var.woff2",
  "ibm-plex-mono-400.woff2",
  "ibm-plex-mono-500.woff2",
] as const;
const readFont = (f: string) => {
  try {
    return readFileSync(resolve(BRAND_DIR, "fonts", f));
  } catch {
    return Buffer.alloc(0);
  }
};
export const ASSETS: Record<string, { type: string; body: string | Buffer; maxAge?: number }> = {
  "/assets/tamga-ui.css": { type: CSS_TYPE, body: read("tamga-ui.css") },
  "/assets/fonts/fonts.css": { type: CSS_TYPE, body: read("fonts/fonts.css") },
  ...Object.fromEntries(
    FONT_FILES.map((f) => [`/assets/fonts/${f}`, { type: "font/woff2", body: readFont(f), maxAge: 604800 }]),
  ),
  "/assets/tamga-ui.js": { type: JS_TYPE, body: read("tamga-ui.js") },
  "/assets/tamga-theme.js": { type: JS_TYPE, body: read("tamga-theme.js") },
  "/assets/pending.js": { type: JS_TYPE, body: readAsset("pending.js") },
  "/assets/sample-site.js": { type: JS_TYPE, body: readAsset("sample-site.js") },
  "/assets/terminal.js": { type: JS_TYPE, body: readAsset("terminal.js") },
  "/assets/dc-test.js": { type: JS_TYPE, body: readAsset("dc-test.js") },
  "/assets/vendor/jsQR.js": { type: JS_TYPE, body: readAsset("vendor/jsQR.js") },
};
/** `/assets/*` uçları (yalnız yukarıdaki sabit liste; yol parametresi yok). */
export function registerAssetRoutes(app: FastifyInstance) {
  for (const [path, a] of Object.entries(ASSETS))
    app.get(path, async (_req, reply) =>
      reply
        .type(a.type)
        .header("cache-control", `public, max-age=${a.maxAge ?? 3600}`)
        .send(a.body),
    );
}

/**
 * Sayfa betiği: `<script src="/assets/<ad>.js" data-…>`. Değerler (adres, ileti metinleri) `data-*` özniteliklerinde, HTML
 * kaçışlı — betik `document.currentScript.dataset` ile okur. Satır içi betik yok (CSP `script-src 'self'`).
 */
export function pageScript(name: string, data: Record<string, string> = {}): string {
  const attrs = Object.entries(data)
    .map(([k, v]) => ` data-${k}="${escHtml(v)}"`)
    .join("");
  return `<script src="/assets/${name}.js"${attrs}></script>`;
}
/**
 * Logo tek kaynaktan: üst çubukta (30 px) tam işaret `ops/brand/logo/mark.svg` (N1; tamga.network başlığıyla aynı). SVG'nin kendi viewBox'ı
 * aynen kullanılır (sabit 0 0 100 100 değil); Gök dolgusu sayfa temasına bağlanır (--primary, koyu temada açık Gök).
 */
function markSvg(file: string): { vb: string; body: string } {
  const src = read(file);
  const vb = /viewBox="([^"]+)"/.exec(src)?.[1] ?? "0 0 100 100";
  const body = src
    .replace(/^[\s\S]*?<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "")
    .trim()
    .replace(/#1E5A78/gi, "var(--primary)")
    .replace(/#C8A24C/gi, "var(--gold-bright)");
  return { vb, body };
}
const MARK_HEADER = markSvg("logo/mark.svg");

export type Lang = "en" | "tr";
/**
 * ADR-0038 SB4: sandbox sürecinde her sayfanın üstünde görünür "test" şeridi. Ağ, uygulamanın ayarından (`cfg.network`) gelir:
 * app.ts HTML yanıtlarına `<body>`'nin hemen ardına ekler (süreç ortamı okunmaz).
 */
export const sandboxBar = (lang: "en" | "tr"): string =>
  `<div role="note" class="sandbox-bar">${
    lang === "tr"
      ? "SANDBOX · TEST — Bu ortamdaki kurumlar, kişiler ve belgeler örnektir; gerçek işlemde geçmez."
      : "SANDBOX · TEST — Institutions, people and credentials here are examples; they are not valid in real transactions."
  }</div>`;

/**
 * Tamga Verify sayfaları tek dilde, İngilizce (proje yönetimi 2026-10-27: "her şeyi İngilizce yapsak … multi language gerek yok").
 * Türkçe metinler kodda duruyor; çok dilliliğe dönülürse yalnız bu işlev değişir (eski hâli: Accept-Language "tr" → "tr").
 */
export const langOf = (_acceptLanguage?: string | string[]): Lang => "en";

const escHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function brandPage(o: { lang: Lang; title: string; host: string; body: string; headExtra?: string }): string {
  const [sub, ...rest] = o.host.split(".");
  const tr = o.lang === "tr";
  const [ts, tl, td] = tr ? ["Sistem", "Açık", "Koyu"] : ["System", "Light", "Dark"];
  return `<!doctype html><html lang="${o.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(o.title)}</title><meta name="description" content="${tr ? "Tamga'nın barındırılan doğrulayıcısı: ağın kurallarına uyan cüzdanlardan belge ister ve doğrular (OpenID4VP)." : "Tamga's hosted verifier: requests and verifies credentials from wallets that follow the network's rules (OpenID4VP)."}"><link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><meta name="theme-color" content="#1E5A78" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#101820" media="(prefers-color-scheme: dark)">${o.headExtra ?? ""}
<script src="/assets/tamga-theme.js"></script>
<link rel="stylesheet" href="/assets/tamga-ui.css"></head><body>
<header class="bar"><div class="shell">
<a class="brand" href="https://tamga.network" aria-label="Tamga Network"><svg width="30" height="30" viewBox="${MARK_HEADER.vb}" aria-hidden="true">${MARK_HEADER.body}</svg><span class="words"><b>Tamga</b><small>Network</small></span></a>
<span class="crumb">${escHtml(sub ?? "")}.<span>${escHtml(rest.join("."))}</span></span>
<div class="bar-end"><div class="theme" role="group" aria-label="${tr ? "Tema" : "Theme"}">
<button type="button" data-theme-choice="system" aria-label="${ts}" title="${ts}"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg></button>
<button type="button" data-theme-choice="light" aria-label="${tl}" title="${tl}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg></button>
<button type="button" data-theme-choice="dark" aria-label="${td}" title="${td}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg></button>
</div></div></div></header>
<main class="shell main-pad-lg">${o.body}</main>
<footer><div class="shell"><span>© Tamga Network</span><a href="https://tamga.network">tamga.network</a><a href="https://docs.tamga.network">${tr ? "Geliştirici belgeleri" : "Developer docs"}</a><a href="https://trust.tamga.network">${tr ? "Güven listeleri" : "Trusted lists"}</a></div></footer>
<script src="/assets/tamga-ui.js"></script></body></html>`;
}
