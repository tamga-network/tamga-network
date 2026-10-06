// Marka simgeleri: tek kaynaktan (logo/mark.svg + logo/mark-mono.svg) bütün simge ve paylaşım görsellerini üretir.
// Logo değişince yalnız logo/*.svg değişir, sonra: node ops/brand/build-icons.mjs  (çıktılar depoya girer)
//   icons/  → sitelerin ve alt alan adlarının simgeleri (favicon.ico, icon.svg, apple-touch-icon.png, icon-192/512, og.png)
// Renkler: Gök #1E5A78 (ağın rengi), açık Gök #6FB3D2, mürekkep #101820, kâğıt #F8F6F1.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../..");
const OUT = join(HERE, "icons");

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

const GOK = "#1E5A78";
const GOK_LIGHT = "#6FB3D2";
const INK_BLUE = "#101820";
const PAPER = "#F8F6F1";

/** Bir SVG dosyasının iç çizimi ve viewBox'ı. */
function inner(file) {
  const src = readFileSync(join(HERE, "logo", file), "utf8");
  const vb = /viewBox="([^"]+)"/.exec(src)?.[1] ?? "0 0 100 100";
  const body = src.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  const [x0, y0, w, h] = vb.split(/\s+/).map(Number);
  return { vb, body, w, h, x0, y0 };
}
const MARK = inner("mark.svg");
const MONO = inner("mark-mono.svg");

/** İşareti `size` karelik tuvale, kenar payı `pad` (oran) ile yerleştirir. */
function composed({ size, pad, bg, radius = 0, mark = MARK }) {
  const box = size * (1 - 2 * pad);
  const s = box / Math.max(mark.w, mark.h);
  const x = (size - mark.w * s) / 2 - mark.x0 * s;
  const y = (size - mark.h * s) / 2 - mark.y0 * s;
  const rect = bg ? `<rect width="${size}" height="${size}" rx="${radius}" fill="${bg}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${rect}<g transform="translate(${x} ${y}) scale(${s})">${mark.body}</g></svg>`;
}

const png = (svg, file) => sharp(Buffer.from(svg)).png().toFile(file);
const flatPng = (svg, file, bg) => sharp(Buffer.from(svg)).flatten({ background: bg }).png().toFile(file);

/** PNG girdili ICO (16/32/48) — tarayıcıların /favicon.ico isteği için. Her boyutta tam işaret N1 (2026-10-06 kararı). */
async function ico(file) {
  const sizes = [16, 32, 48];
  const pngs = await Promise.all(
    sizes.map((z) =>
      sharp(
        Buffer.from(
          composed({
            size: z,
            pad: z <= 32 ? 0.08 : 0.12,
            bg: GOK,
            radius: z * 0.2,
            mark: MONO,
          }),
        ),
      )
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
  const s = 250 / Math.max(MARK.w, MARK.h);
  const body = MARK.body.replace(/fill="#[0-9A-Fa-f]{6}"/g, `fill="${GOK_LIGHT}"`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${INK_BLUE}"/>
  <g transform="translate(${(W - MARK.w * s) / 2 - MARK.x0 * s} ${80 - MARK.y0 * s}) scale(${s})">${body}</g>
  <text x="${W / 2}" y="455" text-anchor="middle" font-family="Onest, IBM Plex Sans, Segoe UI, Arial, sans-serif" font-size="80" font-weight="600" fill="#F4F7F9" letter-spacing="-2">Tamga Network</text>
  <text x="${W / 2}" y="515" text-anchor="middle" font-family="IBM Plex Mono, Consolas, monospace" font-size="26" fill="${GOK_LIGHT}" letter-spacing="6">TÜRK DÜNYASI İÇİN ORTAK GÜVEN AĞI</text>
</svg>`;
}

mkdirSync(OUT, { recursive: true });
// Siteler (2026-10-02 logo: N1, Gök zemin üstünde beyaz işaret; 2026-10-06'dan beri her boyutta N1, sade işaret NS kaldırıldı). Cüzdan simgeleri artık
// Tamga Wallet'ın kendi logosundan, çalışma alanının marka kitinden üretilir (ağ deposu cüzdana yazmaz).
writeFileSync(join(OUT, "icon.svg"), composed({ size: 100, pad: 0.14, bg: GOK, radius: 20, mark: MONO }));
writeFileSync(join(OUT, "mark.svg"), readFileSync(join(HERE, "logo/mark.svg")));
await ico(join(OUT, "favicon.ico"));
await flatPng(composed({ size: 180, pad: 0.16, bg: GOK, mark: MONO }), join(OUT, "apple-touch-icon.png"), GOK);
await png(composed({ size: 192, pad: 0.14, bg: GOK, radius: 38, mark: MONO }), join(OUT, "icon-192.png"));
await png(composed({ size: 512, pad: 0.14, bg: GOK, radius: 102, mark: MONO }), join(OUT, "icon-512.png"));
await flatPng(composed({ size: 512, pad: 0.24, bg: GOK, mark: MONO }), join(OUT, "icon-maskable-512.png"), GOK);
await flatPng(composed({ size: 512, pad: 0.12, bg: PAPER }), join(OUT, "logo-512.png"), PAPER);
await flatPng(ogSvg(), join(OUT, "og.png"), INK_BLUE);
console.log("brand: icons/ (9 dosya) üretildi");
