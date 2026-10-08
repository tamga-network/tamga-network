#!/usr/bin/env node
/**
 * Paket sürümünü tek seferde değiştirir (paket güncelleme rehberi: docs/_internal/delivery/20-PAKET-GUNCELLEME.md).
 *   node scripts/set-version.mjs 0.2.1
 * Değiştirdikleri: 9 `packages/<ad>/package.json` sürümü, doğrulayıcının `SDK_VERSION` sabiti, package-lock.json.
 * Değiştirmedikleri (elle, rehberdeki listeye göre): belgelerdeki sürüm cümleleri, CHANGELOG, tamga-web SDK rozeti.
 * Belge ve ARF sürümleri (1.0) bu betiğin işi değil — onlar ayrı kuraldır.
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const PKGS = ["core", "mdoc", "schemas", "sd-jwt", "trust", "issuer", "verifier", "wallet-core", "zk"];
const next = process.argv[2];
if (!next || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(next)) {
  console.error("Kullanım: node scripts/set-version.mjs <sürüm>   ör. 0.2.1");
  process.exit(1);
}

const prev = new Set();
for (const p of PKGS) {
  const f = join(ROOT, "packages", p, "package.json");
  const j = JSON.parse(readFileSync(f, "utf8"));
  prev.add(j.version);
  j.version = next;
  writeFileSync(f, JSON.stringify(j, null, 2) + "\n");
}
if (prev.size !== 1) console.warn(`⚠ paketler farklı sürümlerdeydi: ${[...prev].join(", ")} — hepsi ${next} yapıldı`);

const vf = join(ROOT, "packages", "verifier", "src", "verify.ts");
const vs = readFileSync(vf, "utf8");
const vn = vs.replace(/(export const SDK_VERSION = "@tamga-network\/verifier@)[^"]+(")/, `$1${next}$2`);
if (!/export const SDK_VERSION = "@tamga-network\/verifier@[^"]+"/.test(vs))
  throw new Error("SDK_VERSION sabiti bulunamadı (packages/verifier/src/verify.ts)");
writeFileSync(vf, vn);

execSync("npm install --package-lock-only --no-audit --no-fund", { cwd: ROOT, stdio: "inherit" });
console.log(`✓ ${[...prev].join(", ")} → ${next} (9 paket + SDK_VERSION + package-lock.json)`);
console.log(
  "Sıradaki: rehberdeki elle güncellenecek yerler (belgelerdeki sürüm cümlesi, CHANGELOG, tamga-web SDK rozeti).",
);
