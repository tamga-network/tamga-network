/**
 * Sayfa iskeleti: tamga.network ile aynı görünüm. Tasarım dosyaları tek kaynaktan — `ops/brand/tamga-ui.{css,js}` — okunur ve
 * sayfaya gömülür (nginx olmadan da çalışır). Dil: tarayıcının ilk tercihi Türkçeyse "tr", değilse "en".
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BRAND_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../../ops/brand");
const read = (f: string) => {
  try {
    return readFileSync(resolve(BRAND_DIR, f), "utf8");
  } catch {
    return "";
  }
};
const CSS = read("tamga-ui.css");
const JS = read("tamga-ui.js");
/** Logo tek kaynaktan (`ops/brand/logo/mark.svg`); renkler sayfa temasına bağlanır. */
const MARK_SVG = read("logo/mark.svg")
  .replace(/^[\s\S]*?<svg[^>]*>/, "")
  .replace(/<\/svg>\s*$/, "")
  .trim()
  .replace(/#C8A24C/gi, "var(--gold-bright)")
  .replace(/#B01E22/gi, "var(--primary)");

export type Lang = "en" | "tr";
export const langOf = (acceptLanguage?: string | string[]): Lang => {
  const h = Array.isArray(acceptLanguage) ? acceptLanguage[0] : (acceptLanguage ?? "");
  return h.split(",")[0]?.trim().toLowerCase().startsWith("tr") ? "tr" : "en";
};

const escHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function brandPage(o: { lang: Lang; title: string; host: string; body: string; headExtra?: string }): string {
  const [sub, ...rest] = o.host.split(".");
  const tr = o.lang === "tr";
  const [ts, tl, td] = tr ? ["Sistem", "Açık", "Koyu"] : ["System", "Light", "Dark"];
  return `<!doctype html><html lang="${o.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(o.title)}</title><meta name="description" content="${tr ? "Tamga'nın barındırılan doğrulayıcısı: Tamga Wallet'tan belge ister ve doğrular (OpenID4VP)." : "Tamga's hosted verifier: requests and verifies credentials from Tamga Wallet (OpenID4VP)."}"><link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><meta name="theme-color" content="#17110F">${o.headExtra ?? ""}
<script>try{const t=localStorage.getItem("tamga.theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch{}</script>
<style>${CSS}</style></head><body>
<header class="bar"><div class="shell">
<a class="brand" href="https://tamga.network" aria-label="Tamga Network"><svg width="30" height="30" viewBox="0 0 100 100" aria-hidden="true">${MARK_SVG}</svg><span class="words"><b>Tamga</b><small>Network</small></span></a>
<span class="crumb">${escHtml(sub ?? "")}.<span>${escHtml(rest.join("."))}</span></span>
<div class="bar-end"><div class="theme" role="group" aria-label="${tr ? "Tema" : "Theme"}">
<button type="button" data-theme-choice="system" aria-label="${ts}" title="${ts}"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg></button>
<button type="button" data-theme-choice="light" aria-label="${tl}" title="${tl}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg></button>
<button type="button" data-theme-choice="dark" aria-label="${td}" title="${td}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg></button>
</div></div></div></header>
<main class="shell" style="padding-block:40px 0">${o.body}</main>
<footer><div class="shell"><span>© Tamga Network</span><a href="https://tamga.network">tamga.network</a><a href="https://docs.tamga.network">${tr ? "Geliştirici belgeleri" : "Developer docs"}</a><a href="https://trust.tamga.network">${tr ? "Güven listeleri" : "Trusted lists"}</a></div></footer>
<script>${JS}</script></body></html>`;
}
