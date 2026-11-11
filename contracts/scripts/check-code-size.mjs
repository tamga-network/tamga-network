// SPEC-BC-0001 §9 — dağıtılan kod boyutu ve bayt payı (EIP-170: bir kontratın çalışma kodu en çok 24.576 bayt).
//
// Sınıra dayanmış bir kontrata güvenlik düzeltmesi sığmaz; pay tükenmeden görülmeli. Bu betik derlenmiş her kontratın
// çalışma kodunu ölçer ve sınıra MIN_HEADROOM bayttan az kalmışsa çıkış 1 verir (kontrat denetimi 2026-11-11: Governance
// 24.530 bayttı, 46 bayt pay kalmıştı).
//
// Kullanım (derlemeden sonra): node scripts/check-code-size.mjs
// Pay azaldığında eşiği düşürmek çözüm değildir: mantık ayrılır (ortak yardımcı fonksiyon, kütüphane, ayrı kontrat).
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** EIP-170 */
export const MAX_CODE_SIZE = 24_576;
/** Sınıra en az bu kadar bayt kalmalı. */
export const MIN_HEADROOM = 512;

/** Dağıtılan kontratlar (proxy arkasındaki implementasyonlar + doğrulayıcı cephesi). */
const CONTRACTS = [
  ["src/governance/Governance.sol", "Governance"],
  ["src/identity/RootCARegistry.sol", "RootCARegistry"],
  ["src/schema/SchemaRegistry.sol", "SchemaRegistry"],
  ["src/registry/IssuerRegistry.sol", "IssuerRegistry"],
  ["src/registry/RelyingPartyRegistry.sol", "RelyingPartyRegistry"],
  ["src/recognition/CrossRecognition.sol", "CrossRecognition"],
  ["src/revocation/StatusListRegistry.sol", "StatusListRegistry"],
  ["src/anchor/TrustListAnchorRegistry.sol", "TrustListAnchorRegistry"],
  ["src/network/NetworkRegistry.sol", "NetworkRegistry"],
  ["src/TrustQueries.sol", "TrustQueries"],
];

/** Çalışma kodunun bayt sayısı ("0x…" onaltılık dizgiden). */
export function codeSize(deployedBytecode) {
  const hex = String(deployedBytecode ?? "").replace(/^0x/, "");
  return hex.length / 2;
}

let fail = 0;
console.log(`==> Kod boyutu (EIP-170: ${MAX_CODE_SIZE} bayt; en az ${MIN_HEADROOM} bayt pay)`);
for (const [src, name] of CONTRACTS) {
  const p = join(root, "artifacts", src, `${name}.json`);
  if (!existsSync(p)) {
    fail = 1;
    console.log(`  ✗ ${name} — artifact yok (önce derle)`);
    continue;
  }
  const size = codeSize(JSON.parse(readFileSync(p, "utf8")).deployedBytecode);
  const room = MAX_CODE_SIZE - size;
  if (size === 0) {
    fail = 1;
    console.log(`  ✗ ${name} — çalışma kodu boş`);
  } else if (room < MIN_HEADROOM) {
    fail = 1;
    console.log(`  ✗ ${name} — ${size} bayt, pay ${room} bayt (< ${MIN_HEADROOM})`);
  } else console.log(`  ✓ ${name} — ${size} bayt, pay ${room} bayt`);
}
if (fail)
  console.log("Bayt payı yetersiz: mantığı ayır (ortak yardımcı, kütüphane ya da ayrı kontrat); eşiği düşürme.");
process.exit(fail);
