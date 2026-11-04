// SPEC-BC-0001 §9 — UUPS brick koruması, statik denetim (eski script/check-upgrade-safety.sh'in Node karşılığı).
//
// UUPS'te yükseltme mantığı İMPLEMENTASYONDADIR. `_authorizeUpgrade` içermeyen bir implementasyona yükseltirsen proxy
// KALICI OLARAK KİLİTLENİR. Bu betik üç şeyi kaynak düzeyinde arar; davranışsal kanıt test/upgrade-safety.test.ts'tedir.
//   1) `_authorizeUpgrade` doğrudan ya da TamgaRegistryBase üzerinden tanımlı
//   2) constructor'da `_disableInitializers` (implementasyon doğrudan initialize edilemesin)
//   3) `__gap` (depolama düzeni sona ekleyerek genişletilebilir kalsın)
// Depolama düzeni karşılaştırması ayrı betiktedir: scripts/check-storage-layout.mjs (taban çizgisi storage-layout/, depoda).
// Kullanım: node scripts/check-upgrade-safety.mjs   (sorun varsa çıkış 1)
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const UPGRADEABLE = [
  "src/governance/Governance.sol",
  "src/identity/RootCARegistry.sol",
  "src/schema/SchemaRegistry.sol",
  "src/registry/IssuerRegistry.sol",
  "src/registry/RelyingPartyRegistry.sol",
  "src/recognition/CrossRecognition.sol",
  "src/revocation/StatusListRegistry.sol",
  "src/anchor/TrustListAnchorRegistry.sol",
  "src/network/NetworkRegistry.sol",
];

let fail = 0;
console.log("==> UUPS güvenlik denetimi");
for (const rel of UPGRADEABLE) {
  const p = join(root, rel);
  if (!existsSync(p)) {
    fail = 1;
    console.log(`  ✗ ${rel} — dosya yok (liste güncel değil)`);
    continue;
  }
  const src = readFileSync(p, "utf8");
  const viaBase = src.includes("TamgaRegistryBase");
  const problems = [];
  if (!src.includes("_authorizeUpgrade") && !viaBase)
    problems.push("_authorizeUpgrade YOK — yükseltirsen proxy kilitlenir");
  if (!src.includes("_disableInitializers") && !viaBase)
    problems.push("_disableInitializers YOK — implementasyon doğrudan initialize edilebilir");
  if (!src.includes("__gap")) problems.push("__gap YOK — sonraki sürümde yeni değişken eklenemez");
  if (problems.length) {
    fail = 1;
    for (const m of problems) console.log(`  ✗ ${rel} — ${m}`);
  } else console.log(`  ✓ ${rel}`);
}

process.exit(fail);
