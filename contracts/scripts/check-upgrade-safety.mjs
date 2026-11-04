// SPEC-BC-0001 §9 — UUPS brick koruması, statik denetim (eski script/check-upgrade-safety.sh'in Node karşılığı).
//
// UUPS'te yükseltme mantığı İMPLEMENTASYONDADIR. `_authorizeUpgrade` içermeyen bir implementasyona yükseltirsen proxy
// KALICI OLARAK KİLİTLENİR. Bu betik üç şeyi kaynak düzeyinde arar; davranışsal kanıt test/upgrade-safety.test.ts'tedir.
//   1) `_authorizeUpgrade` doğrudan ya da TamgaRegistryBase üzerinden tanımlı
//   2) constructor'da `_disableInitializers` (implementasyon doğrudan initialize edilemesin)
//   3) `__gap` (depolama düzeni sona ekleyerek genişletilebilir kalsın)
// Depolama düzeni karşılaştırması ayrı betiktedir: scripts/check-storage-layout.mjs (taban çizgisi storage-layout/, depoda).
//
// Göç kipi (ADR-0073 K1, CE1 — "yükseltme dahil hiçbir yolla yeniden açılamaz"; güvenlik turu 2026-11-04):
//   4) src/base/MigrationWindow.sol'un kaynak özeti (satır sonları LF) storage-layout/MigrationWindow.pin.json'daki ile aynı
//   5) ad alanı slot sabiti ERC-7201 formülüne ve sabitlenmiş değere eşit (`tamga.storage.MigrationWindow`)
//   6) slot sabiti ya da ad alanı adı başka hiçbir kaynakta geçmez; satır içi assembly yalnız MigrationWindow'da
//   7) göç kipi taşıyan kayıt kontratları MigrationWindow'u (doğrudan ya da TamgaRegistryBase üzerinden) kalıtmaya devam eder
// Governance'ın yükseltme öncesi/sonrası durum karşılaştırması yalnız yükseltme anını görür; yeni implementasyonun göç
// depolamasına SONRADAN yazan bir fonksiyon taşıması ancak bu kaynak incelemesiyle yakalanır.
//
// Kullanım: node scripts/check-upgrade-safety.mjs               (sorun varsa çıkış 1)
//           node scripts/check-upgrade-safety.mjs --update-pin  (MigrationWindow bilinçli ve gözden geçirilmiş biçimde
//                                                                değiştiyse özeti yeniden yazar; fark commit'te görünür)
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { AbiCoder, keccak256, toUtf8Bytes } from "ethers";

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
/** ADR-0073 K1: göç kipini taşıyan kayıt kontratları. */
const MIGRATING = [
  "src/identity/RootCARegistry.sol",
  "src/schema/SchemaRegistry.sol",
  "src/registry/IssuerRegistry.sol",
  "src/registry/RelyingPartyRegistry.sol",
  "src/recognition/CrossRecognition.sol",
  "src/revocation/StatusListRegistry.sol",
  "src/network/NetworkRegistry.sol",
];
const MW = "src/base/MigrationWindow.sol";
const NAMESPACE = "tamga.storage.MigrationWindow";
const PIN = join(root, "storage-layout", "MigrationWindow.pin.json");

let fail = 0;
const bad = (m) => {
  fail = 1;
  console.log(`  ✗ ${m}`);
};

console.log("==> UUPS güvenlik denetimi");
for (const rel of UPGRADEABLE) {
  const p = join(root, rel);
  if (!existsSync(p)) {
    bad(`${rel} — dosya yok (liste güncel değil)`);
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
  if (problems.length) for (const m of problems) bad(`${rel} — ${m}`);
  else console.log(`  ✓ ${rel}`);
}

console.log("==> Göç kipi bütünlüğü (ADR-0073 CE1)");
// ERC-7201: keccak256(abi.encode(uint256(keccak256(id)) - 1)) & ~bytes32(uint256(0xff))
const expectedSlot = (() => {
  const inner = BigInt(keccak256(toUtf8Bytes(NAMESPACE))) - 1n;
  const outer = BigInt(keccak256(AbiCoder.defaultAbiCoder().encode(["uint256"], [inner])));
  return "0x" + (outer & ~0xffn).toString(16).padStart(64, "0");
})();
const mwSrc = readFileSync(join(root, MW), "utf8").replace(/\r\n/g, "\n");
const sourceSha256 = createHash("sha256").update(mwSrc).digest("hex");
const slotMatch = mwSrc.match(/MIGRATION_STORAGE\s*=\s*(0x[0-9a-fA-F]{64})/);
const slot = slotMatch ? slotMatch[1].toLowerCase() : null;

if (process.argv.includes("--update-pin")) {
  writeFileSync(
    PIN,
    JSON.stringify({ file: MW, namespace: NAMESPACE, slot: expectedSlot, sourceSha256 }, null, 2) + "\n",
  );
  console.log(`  ✎ ${relative(root, PIN)} (sha256 ${sourceSha256.slice(0, 16)}…)`);
}

if (slot !== expectedSlot) bad(`${MW} — slot sabiti ${slot} ≠ ERC-7201(${NAMESPACE}) ${expectedSlot}`);
else console.log(`  ✓ slot sabiti = ERC-7201(${NAMESPACE})`);

if (!existsSync(PIN)) bad(`${relative(root, PIN)} yok — --update-pin ile oluştur`);
else {
  const pin = JSON.parse(readFileSync(PIN, "utf8"));
  if (pin.slot !== expectedSlot) bad(`sabitlenmiş slot ${pin.slot} değişmiş`);
  if (pin.sourceSha256 !== sourceSha256)
    bad(
      `${MW} kaynağı sabitlenmiş özetten farklı (${sourceSha256.slice(0, 16)}… ≠ ${String(pin.sourceSha256).slice(0, 16)}…)` +
        " — göç kipi değişikliği ayrıca incelenir; bilinçliyse --update-pin",
    );
  else console.log(`  ✓ ${MW} kaynak özeti sabitlenmiş değerle aynı`);
}

const files = [];
const walk = (d) => {
  for (const f of readdirSync(d).sort()) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith(".sol")) files.push(p);
  }
};
walk(join(root, "src"));
let leaks = 0;
for (const p of files) {
  const rel = relative(root, p).split("\\").join("/");
  if (rel === MW) continue;
  const s = readFileSync(p, "utf8");
  const lower = s.toLowerCase();
  if (lower.includes(expectedSlot.slice(2)) || s.includes(NAMESPACE)) {
    leaks++;
    bad(`${rel} — göç kipi slotuna ya da ad alanına atıf (yalnız ${MW} dokunabilir)`);
  }
  if (/\bassembly\b\s*(\(|\{|"memory-safe")/.test(s)) {
    leaks++;
    bad(`${rel} — satır içi assembly (yalnız ${MW}'da izinli; ham depolama yazımı denetlenemez)`);
  }
}
if (!leaks) console.log("  ✓ göç kipi slotuna ve satır içi assembly'ye başka kaynak dokunmuyor");

for (const rel of MIGRATING) {
  const s = readFileSync(join(root, rel), "utf8");
  if (!/\bis\b[^{]*\b(TamgaRegistryBase|MigrationWindow)\b/.test(s)) bad(`${rel} — MigrationWindow'u kalıtmıyor`);
}
if (!fail) console.log(`  ✓ ${MIGRATING.length} kayıt kontratı MigrationWindow'u kalıtıyor`);

process.exit(fail);
