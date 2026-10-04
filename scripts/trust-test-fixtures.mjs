/**
 * Test güven listesi — `apps/trust-publisher/test/fixtures/registry/` kaynağından `apps/trust-publisher/dist-test/` üretir.
 * Gerçek ağ kaynağı (`registry/`) yalnız gerçek kayıtları taşır; uçtan uca testlerin örnek kurumları (ACTIVE) bu ayrı test
 * listesindedir (2026-10-04: gerçek ağda test/demo kalmaz). Aynı dev PKI (`ops/pki`) kullanılır; liste iki kez derlenir
 * (geri sarma testi eski sürüm ister), sonra çapa günlüğüne bir satır eklenir. `npm run setup` bunu da çalıştırır.
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const app = resolve(root, "apps/trust-publisher");
const env = {
  ...process.env,
  TAMGA_TP_REGISTRY: resolve(app, "test/fixtures/registry"),
  TAMGA_TP_DIST: resolve(app, "dist-test"),
};
delete env.TAMGA_NETWORK;
for (const cmd of ["build", "build", "heartbeat", "verify"]) {
  const r = spawnSync("npx", ["tsx", "apps/trust-publisher/src/cli.ts", cmd], {
    cwd: root,
    env,
    stdio: ["ignore", "ignore", "inherit"],
    shell: process.platform === "win32",
  });
  if (r.status !== 0) {
    console.error(`trust-test-fixtures: ${cmd} başarısız (${r.status})`);
    process.exit(r.status ?? 1);
  }
}
console.log("test güven listesi hazır: apps/trust-publisher/dist-test");
