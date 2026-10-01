// Kök md dosyalarını docs/root/ altına kopyalar (VitePress srcDir = docs). Çıktı gitignore'dadır.
import { mkdirSync, copyFileSync, readdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(repo, "docs", "root");
// Yayınlanan kök kayıtlar (docs.tamga.network /root/…). STATUS, ROADMAP gibi iç çalışma kayıtları yayınlanmaz (ADR-0018 DY3).
const files = [
  "DECISIONS.md",
  "GLOSSARY.md",
  "INVARIANTS.md",
  "SCENARIOS.md",
  "MASTER_INDEX.md",
  "DOCUMENTATION-STANDARD.md",
];

if (existsSync(out)) rmSync(out, { recursive: true });
mkdirSync(out, { recursive: true });
let n = 0;
for (const f of files) {
  const src = join(repo, f);
  if (existsSync(src)) {
    copyFileSync(src, join(out, f));
    n++;
  }
}
// Sürüm notları: CHANGELOG.md → docs/root/CHANGELOG.md, okura yönelik başlıkla (iç kayıtlara atıf satırları çıkarılır).
{
  const cl = readFileSync(join(repo, "CHANGELOG.md"), "utf8");
  const body = cl.slice(cl.indexOf("\n## ") + 1);
  writeFileSync(
    join(out, "CHANGELOG.md"),
    [
      "---",
      "title: Sürüm notları",
      "outline: [2, 3]",
      "---",
      "",
      "# Sürüm notları",
      "",
      "`@tamga-network/*` paketlerinin, servislerin ve belgelerin değişiklikleri — yeniden eskiye. Biçim [Keep a Changelog](https://keepachangelog.com/tr/1.1.0/);",
      "paketler SemVer, npm'de ön sürüm (`0.1.x`): `1.0`'a kadar arayüz değişebilir.",
      "",
      body.replace(/^.*STATUS\.md.*$\n?/gm, ""),
    ].join("\n"),
  );
  n++;
}
console.log(`docs/root: ${n} dosya kopyalandı (${readdirSync(out).join(", ")})`);

// Paket sayfaları: packages/*/README.md → docs/packages/<ad>.md (gitignore). Paket belgesi tek kaynaktan (npm'deki README ile aynı).
const PKG = [
  ["core", "Ortak yapı taşları: özetler, kimlik türetme, sertifika yardımcıları"],
  ["trust", "İmzalı güven listeleri ve TrustSource (+ /core: platformdan bağımsız çekirdek)"],
  ["schemas", "Belge türü kataloğu: tip tanımı, JSON Schema, içerik özetleri"],
  ["sd-jwt", "SD-JWT VC: seçici açıklama, cihaz bağı, biçim denetimleri"],
  ["mdoc", "ISO/IEC 18013-5 mdoc: CBOR, COSE, verme ve doğrulama"],
  ["issuer", "Belge verme: OpenID4VCI, iptal listesi yayıncısı; /client barındırılan servis için"],
  ["verifier", "Doğrulama hattı (T0 + A–E), OpenID4VP; /web sayfa kiti"],
  ["wallet-core", "Cüzdan çekirdeği: anahtarlar, alma, yerel denetim, sunma"],
];
const pkgOut = join(repo, "docs", "packages");
if (existsSync(pkgOut)) rmSync(pkgOut, { recursive: true });
mkdirSync(pkgOut, { recursive: true });
const rows = [];
for (const [name, what] of PKG) {
  const readme = join(repo, "packages", name, "README.md");
  if (!existsSync(readme)) continue;
  const body = readFileSync(readme, "utf8").replace(/\r\n/g, "\n");
  writeFileSync(
    join(pkgOut, `${name}.md`),
    `---\ntitle: "@tamga-network/${name}"\n---\n\n<!-- ÜRETİLDİ — kaynak: packages/${name}/README.md (npm run docs:sync) -->\n\n${body}`,
  );
  rows.push(`| [\`@tamga-network/${name}\`](./${name}) | ${what} |`);
}
writeFileSync(
  join(pkgOut, "index.md"),
  [
    "---",
    "title: Paketler",
    "---",
    "",
    "# Paketler",
    "",
    "Tamga'nın açık kaynak paketleri (`@tamga-network/*`, Apache-2.0). Her sayfa paketin kendi README'sidir — npm'de görünecek",
    "metinle aynı. Paketler npm'de **ön sürüm (`0.1.0`)** olarak yayında; `1.0`'a kadar arayüz değişebilir. Çalışan örnekler: [Kod örnekleri](/guides/04-kod-ornekleri).",
    "",
    "| Paket | Ne işe yarar |",
    "|---|---|",
    ...rows,
    "",
    "Hangi paketi kuracağınız rolünüze bağlıdır: [Başlarken](/guides/README).",
    "",
  ].join("\n"),
);
console.log(`docs/packages: ${rows.length} paket sayfası`);

// API tanımları: docs/api/*.openapi.yaml → docs/public/api/ (gitignore) — /api/ sayfasındaki indirme bağlantıları için
const apiOut = join(repo, "docs", "public", "api");
mkdirSync(apiOut, { recursive: true });
const apiFiles = readdirSync(join(repo, "docs", "api")).filter((f) => f.endsWith(".openapi.yaml"));
for (const f of apiFiles) copyFileSync(join(repo, "docs", "api", f), join(apiOut, f));
// API başvuru sayfası (Stripe benzeri, üç sütun): docs/api/site/index.html + Scalar tek dosyalık paketi (@scalar/api-reference)
copyFileSync(join(repo, "docs", "api", "site", "index.html"), join(apiOut, "index.html"));
copyFileSync(
  join(repo, "node_modules", "@scalar", "api-reference", "dist", "browser", "standalone.js"),
  join(apiOut, "scalar.js"),
);
console.log(`docs/public/api: ${apiFiles.length} OpenAPI dosyası + başvuru sayfası`);

// Marka simgeleri + robots.txt: ops/brand/icons/ (tek kaynak) → docs/public/ (gitignore). Paylaşım görseli og.png.
const brandSrc = join(repo, "ops", "brand", "icons");
const pub = join(repo, "docs", "public");
for (const f of ["favicon.ico", "icon.svg", "mark.svg", "apple-touch-icon.png", "og.png"])
  copyFileSync(join(brandSrc, f), join(pub, f));
writeFileSync(join(pub, "robots.txt"), "User-agent: *\nAllow: /\n\nSitemap: https://docs.tamga.network/sitemap.xml\n");
console.log("docs/public: marka simgeleri + robots.txt");
