// Marka simgeleri: tek kaynaktan (logo/mark.svg + logo/mark-mono.svg) bütün simge ve paylaşım görsellerini üretir.
// Logo değişince yalnız logo/*.svg değişir, sonra: node ops/brand/build-icons.mjs  (çıktılar depoya girer)
//   icons/  → sitelerin ve alt alan adlarının simgeleri (favicon.ico, icon.svg, apple-touch-icon.png, icon-192/512, og.png)
//   apps/wallet/assets/ → cüzdan simgeleri (iOS, Android uyarlanır simge, açılış, web)
// Renkler marka tablosundan: Obsidyen #17110F, Altın #C8A24C, Al Kızıl #B01E22, Parşömen #F4EDE2.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../..");
const OUT = join(HERE, "icons");
const WALLET = join(REPO, "apps/wallet/assets");

// sharp bu depoda bağımlılık değil; yan klasördeki site deposundan (Next.js ile gelir) yüklenir.
function loadSharp() {
  for (const base of [import.meta.url, join(REPO, "package.json"), resolve(REPO, "../tamga-web/package.json")]) {
    try {
      return createRequire(base)("sharp");
    } catch {}
  }
  throw new Error("sharp bulunamadı: ../tamga-web içinde npm install çalıştırın");
}
const sharp = loadSharp();

const OBSIDYEN = "#17110F";
const PARSOMEN = "#F4EDE2";
const ALTIN = "#C8A24C";

/** Bir SVG dosyasının iç çizimi ve viewBox'ı. */
function inner(file) {
  const src = readFileSync(join(HERE, "logo", file), "utf8");
  const vb = /viewBox="([^"]+)"/.exec(src)?.[1] ?? "0 0 100 100";
  const body = src.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  const [, , w, h] = vb.split(/\s+/).map(Number);
  return { vb, body, w, h };
}
const MARK = inner("mark.svg");
const MONO = inner("mark-mono.svg");

/** İşareti `size` karelik tuvale, kenar payı `pad` (oran) ile yerleştirir. */
function composed({ size, pad, bg, radius = 0, mark = MARK }) {
  const box = size * (1 - 2 * pad);
  const s = box / Math.max(mark.w, mark.h);
  const x = (size - mark.w * s) / 2;
  const y = (size - mark.h * s) / 2;
  const rect = bg ? `<rect width="${size}" height="${size}" rx="${radius}" fill="${bg}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${rect}<g transform="translate(${x} ${y}) scale(${s})">${mark.body}</g></svg>`;
}

const png = (svg, file) => sharp(Buffer.from(svg)).png().toFile(file);
const flatPng = (svg, file) => sharp(Buffer.from(svg)).flatten({ background: OBSIDYEN }).png().toFile(file);

/** PNG girdili ICO (16/32/48) — tarayıcıların /favicon.ico isteği için. */
async function ico(file) {
  const sizes = [16, 32, 48];
  const pngs = await Promise.all(
    sizes.map((z) =>
      sharp(Buffer.from(composed({ size: z, pad: 0.04, bg: OBSIDYEN, radius: z * 0.2 })))
        .png()
        .toBuffer(),
    ),
  );
  const head = Buffer.alloc(6 + 16 * sizes.length);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(sizes.length, 4);
  let offset = head.length;
  sizes.forEach((z, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(z, e);
    head.writeUInt8(z, e + 1);
    head.writeUInt16LE(1, e + 4);
    head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(pngs[i].length, e + 8);
    head.writeUInt32LE(offset, e + 12);
    offset += pngs[i].length;
  });
  writeFileSync(file, Buffer.concat([head, ...pngs]));
}

/** Paylaşım görseli (1200×630): alt alan adlarının ortak önizlemesi. Yazı IBM Plex Sans (yoksa sistem yazısı). */
function ogSvg() {
  const W = 1200;
  const H = 630;
  const m = 260;
  const s = m / Math.max(MARK.w, MARK.h);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${OBSIDYEN}"/>
  <g transform="translate(${(W - MARK.w * s) / 2} 70) scale(${s})">${MARK.body}</g>
  <text x="${W / 2}" y="440" text-anchor="middle" font-family="IBM Plex Sans, Segoe UI, Arial, sans-serif" font-size="84" font-weight="600" fill="${PARSOMEN}" letter-spacing="-2">Tamga Network</text>
  <text x="${W / 2}" y="510" text-anchor="middle" font-family="IBM Plex Mono, Consolas, monospace" font-size="28" fill="${ALTIN}" letter-spacing="8">DIGITAL TRUST INFRASTRUCTURE</text>
</svg>`;
}

mkdirSync(OUT, { recursive: true });
// Siteler
writeFileSync(join(OUT, "icon.svg"), composed({ size: 100, pad: 0.1, bg: OBSIDYEN, radius: 20 }));
writeFileSync(join(OUT, "mark.svg"), readFileSync(join(HERE, "logo/mark.svg")));
await ico(join(OUT, "favicon.ico"));
await flatPng(composed({ size: 180, pad: 0.14, bg: OBSIDYEN }), join(OUT, "apple-touch-icon.png"));
await png(composed({ size: 192, pad: 0.1, bg: OBSIDYEN, radius: 38 }), join(OUT, "icon-192.png"));
await png(composed({ size: 512, pad: 0.1, bg: OBSIDYEN, radius: 102 }), join(OUT, "icon-512.png"));
await flatPng(composed({ size: 512, pad: 0.22, bg: OBSIDYEN }), join(OUT, "icon-maskable-512.png"));
await flatPng(composed({ size: 512, pad: 0.12, bg: OBSIDYEN }), join(OUT, "logo-512.png"));
await flatPng(ogSvg(), join(OUT, "og.png"));
// Cüzdan (Expo): iOS simgesi saydam olamaz; Android ön plan güvenli alanı ~%66
await flatPng(composed({ size: 1024, pad: 0.16, bg: OBSIDYEN }), join(WALLET, "icon.png"));
await png(composed({ size: 1024, pad: 0.3 }), join(WALLET, "splash-icon.png"));
await png(composed({ size: 512, pad: 0.26 }), join(WALLET, "android-icon-foreground.png"));
await png(
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="${OBSIDYEN}"/></svg>`,
  join(WALLET, "android-icon-background.png"),
);
await png(composed({ size: 432, pad: 0.26, mark: MONO }), join(WALLET, "android-icon-monochrome.png"));
await png(composed({ size: 48, pad: 0.06, bg: OBSIDYEN, radius: 10 }), join(WALLET, "favicon.png"));
console.log("brand: icons/ (9 dosya) + apps/wallet/assets (6 dosya) üretildi");
