// SPEC-BC-0001 §9 — "CI'da depolama düzeni karşılaştırması zorunludur."
// Derlenmiş düzeni depodaki taban çizgisiyle (storage-layout/<Ad>.json) karşılaştırır; uyumsuzlukta çıkış 1.
// Kurallar: scripts/lib/storage-layout.mjs başı.
//
// Kullanım (derlemeden sonra):
//   node scripts/check-storage-layout.mjs            karşılaştır
//   node scripts/check-storage-layout.mjs --update   taban çizgisini yeniden yaz (yalnız bilinçli, gözden geçirilmiş
//                                                    bir düzen değişikliğinden sonra; fark commit'te görünür)
// Üretimde dağıtılmış bir sürüm olunca taban çizgisi o sürümün düzenidir; --update yalnız yükseltme yayımlanınca yapılır.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { compareLayouts, normalizeLayout, readLayoutFromArtifacts } from "./lib/storage-layout.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const baselineDir = join(root, "storage-layout");

/** Yükseltilebilir (UUPS proxy arkasındaki) kontratlar. */
export const UPGRADEABLE = [
  ["src/governance/Governance.sol", "Governance"],
  ["src/identity/RootCARegistry.sol", "RootCARegistry"],
  ["src/schema/SchemaRegistry.sol", "SchemaRegistry"],
  ["src/registry/IssuerRegistry.sol", "IssuerRegistry"],
  ["src/registry/RelyingPartyRegistry.sol", "RelyingPartyRegistry"],
  ["src/recognition/CrossRecognition.sol", "CrossRecognition"],
  ["src/revocation/StatusListRegistry.sol", "StatusListRegistry"],
  ["src/anchor/TrustListAnchorRegistry.sol", "TrustListAnchorRegistry"],
  ["src/network/NetworkRegistry.sol", "NetworkRegistry"],
];

const update = process.argv.includes("--update");
let fail = 0;
console.log(`==> Depolama düzeni ${update ? "taban çizgisi yazılıyor" : "karşılaştırması"} (SPEC-BC-0001 §9)`);
if (update) mkdirSync(baselineDir, { recursive: true });

for (const [src, name] of UPGRADEABLE) {
  const current = normalizeLayout(readLayoutFromArtifacts(root, src, name));
  const file = join(baselineDir, `${name}.json`);
  if (update) {
    writeFileSync(file, JSON.stringify(current, null, 2) + "\n");
    console.log(`  ✎ ${name} (${current.storage.length} değişken)`);
    continue;
  }
  if (!existsSync(file)) {
    fail = 1;
    console.log(`  ✗ ${name} — taban çizgisi yok (storage-layout/${name}.json); --update ile oluştur`);
    continue;
  }
  const errors = compareLayouts(JSON.parse(readFileSync(file, "utf8")), current);
  if (errors.length) {
    fail = 1;
    console.log(`  ✗ ${name}`);
    for (const e of errors) console.log(`      ${e}`);
  } else console.log(`  ✓ ${name}`);
}
if (fail && !update)
  console.log("Düzen uyumsuz: mevcut slot'lar değişmez; yeni değişken sona ya da __gap'e, gap aynı sayıda azalır.");
process.exit(fail);
