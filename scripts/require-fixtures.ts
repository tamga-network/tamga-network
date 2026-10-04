/**
 * Vitest globalSetup — test ön koşulları (iç inceleme O1). Dev PKI ve güven listesi yoksa uçtan uca testler
 * `describe.skipIf` ile sessizce atlanır; yerelde bu kolaylıktır ama CI'da "geçti" yanıltır.
 * `TAMGA_REQUIRE_FIXTURES=1` verilirse eksik ön koşul testi başlatmadan açık hatayla durdurur.
 * Hazırlamak için: tamga-network kökünde `npm run setup` (pki → schemas:build → trust:build → heartbeat → verify).
 * tamga-platform da bu dosyayı kullanır (kök: bu dosyanın iki üst klasörü = tamga-network).
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const NET = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const REQUIRED = [
  "ops/pki/root-ca.cert.pem",
  "ops/pki/issuer-bilgi.pkcs8.pem",
  "ops/pki/rp-verify.pkcs8.pem",
  "apps/trust-publisher/dist/lotl.jws",
  "apps/trust-publisher/dist/tl-tr.jws",
  "apps/trust-publisher/dist-test/lotl.jws", // test listesi (örnek kurumlar; npm run trust:test-fixtures)
  "apps/trust-publisher/dist-test/tl-tr.jws",
  "packages/schemas/dist/index.json",
];

export default function setup() {
  const missing = REQUIRED.filter((p) => !existsSync(resolve(NET, p)));
  if (!missing.length) return;
  const msg = `Test ön koşulları eksik (${missing.join(", ")}) — uçtan uca testler ATLANACAK. Hazırlamak için tamga-network'te: npm run setup`;
  if (process.env.TAMGA_REQUIRE_FIXTURES === "1") throw new Error(msg);
  console.warn(`⚠ ${msg}`);
}
