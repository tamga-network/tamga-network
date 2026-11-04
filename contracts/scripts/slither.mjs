// Slither statik analizi (SPEC-BC-0001 güvenlik notları; dış denetim hazırlığı).
// Hardhat 3 derleme çıktısı crytic-compile tarafından okunamıyor (kaynak adları "project/…"); bu yüzden kaynaklar solc ile
// doğrudan derlenir: src/ altındaki bütün .sol dosyalarını içe aktaran geçici bir giriş dosyası (cache/slither/All.sol) üretilir
// ve Slither ona karşı koşar. Ayarlar ve gerekçeli dışlamalar slither.config.json'dadır.
//
// Gerekenler: slither-analyzer ve solc 0.8.24 (ör. `uv tool install slither-analyzer`, `uv tool install solc-select`,
// `solc-select install 0.8.24 && solc-select use 0.8.24`).
//   node scripts/slither.mjs           → bulgu varsa çıkış 1 (CI)
//   node scripts/slither.mjs --json f  → ayrıca JSON rapor yazar
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src");
const entryDir = join(root, "cache", "slither");

const files = [];
const walk = (d) => {
  for (const f of readdirSync(d).sort()) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith(".sol")) files.push(p);
  }
};
walk(src);

mkdirSync(entryDir, { recursive: true });
const entry = join(entryDir, "All.sol");
const imports = files.map((f) => `import "${relative(entryDir, f).split("\\").join("/")}";`);
writeFileSync(entry, ["// SPDX-License-Identifier: Apache-2.0", "pragma solidity ^0.8.24;", ...imports, ""].join("\n"));

const args = [relative(root, entry).split("\\").join("/"), "--config-file", "slither.config.json"];
const ji = process.argv.indexOf("--json");
if (ji !== -1 && process.argv[ji + 1]) args.push("--json", process.argv[ji + 1]);

const r = spawnSync("slither", args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
if (r.error) {
  console.error(`slither çalıştırılamadı: ${r.error.message} — kurulum: scripts/slither.mjs başı`);
  process.exit(2);
}
process.exit(r.status ?? 1);
