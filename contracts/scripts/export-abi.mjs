// Liste çapası kaydının ABI'sini liste yayıncısına kopyalar (ADR-0051 K2): apps/trust-publisher/src/chain/abi/.
// Kaynak contracts/, kopya liste yayıncısında (yayıncı contracts/'ı derlemeden kurulur) — bu betik ikisini aynı tutar.
//   node scripts/export-abi.mjs            → yazar
//   node scripts/export-abi.mjs --check    → fark varsa çıkış 1 (CI: npm run contracts:check)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");
const EXPORTS = [
  {
    artifact: "artifacts/src/anchor/TrustListAnchorRegistry.sol/TrustListAnchorRegistry.json",
    out: "../apps/trust-publisher/src/chain/abi/trust-list-anchor-registry.json",
  },
];

let diff = 0;
for (const e of EXPORTS) {
  const a = join(root, e.artifact);
  if (!existsSync(a)) {
    console.error(`artifact yok: ${e.artifact} — önce npm run compile`);
    process.exit(1);
  }
  const art = JSON.parse(readFileSync(a, "utf8"));
  const out = {
    _note:
      "contracts/scripts/export-abi.mjs üretir — elle düzenlenmez. Kaynak: contracts/src/anchor/TrustListAnchorRegistry.sol (ADR-0051, SPEC-BC-0001 §15).",
    contractName: art.contractName,
    solidity: "0.8.24",
    evmVersion: "shanghai",
    abi: art.abi,
  };
  const text = JSON.stringify(out, null, 2) + "\n";
  const p = join(root, e.out);
  const cur = existsSync(p) ? readFileSync(p, "utf8") : null;
  if (cur === text) {
    console.log(`güncel: ${e.out}`);
    continue;
  }
  if (CHECK) {
    console.error(`FARK: ${e.out} derlenmiş ABI ile aynı değil — node scripts/export-abi.mjs`);
    diff = 1;
    continue;
  }
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, text);
  console.log(`yazıldı: ${e.out}`);
}
process.exit(diff);
