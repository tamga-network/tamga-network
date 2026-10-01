// Güven çapasını cüzdana göm (S-13): LOTL imzacı parmak izleri → src/trust-anchor.ts (ÜRETİLEN dosya).
// Kaynak: apps/trust-publisher/dist/keys/root-fingerprints.json (= tamga.network/trust-anchor sayfasında ilan edilen değer).
// PKI değişince (gen-pki --force) yeniden çalıştır: `npm run pin:trust -w @tamga-network/wallet-app`.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../../trust-publisher/dist/keys/root-fingerprints.json");
const out = resolve(here, "../src/trust-anchor.ts");
const j = JSON.parse(readFileSync(src, "utf8"));
const fps = (j.lotl_signing_keys ?? []).filter((k) => (k.status ?? "ACTIVE") === "ACTIVE").map((k) => k.fingerprint_sha256);
if (!fps.length) throw new Error("root-fingerprints.json içinde aktif LOTL imzacısı yok");
writeFileSync(
  out,
  `/**
 * ÜRETİLEN DOSYA — elle düzenleme; \`npm run pin:trust\` (scripts/pin-trust.mjs).
 * Güven çapası (S-13): cüzdan LOTL imzasını YALNIZCA bu parmak izleriyle kabul eder; liste sunucusuna güvenmez.
 * Kaynak: apps/trust-publisher/dist/keys/root-fingerprints.json (tamga.network/trust-anchor ile aynı).
 */
import type { TrustPins } from "@tamga-network/wallet-core";

export const TRUST_PINS: TrustPins = {
  lotlSigners: ${JSON.stringify(fps, null, 2).replace(/\n/g, "\n  ")},
};
`,
);
console.log(`trust-anchor.ts yazıldı: ${fps.length} LOTL imzacısı`);
