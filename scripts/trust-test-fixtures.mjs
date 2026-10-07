/**
 * Test güven listesi — `apps/trust-publisher/test/fixtures/registry/` kaynağından `apps/trust-publisher/dist-test/` üretir.
 * Gerçek ağ kaynağı (`registry/`) yalnız gerçek kayıtları taşır; uçtan uca testlerin örnek kurumları (ACTIVE) bu ayrı test
 * listesindedir (2026-10-04: gerçek ağda test/demo kalmaz). Aynı dev PKI (`ops/pki`) kullanılır; liste iki kez derlenir
 * (geri sarma testi eski sürüm ister), sonra çapa günlüğüne bir satır eklenir. `npm run setup` bunu da çalıştırır.
 *
 * `--sandbox` (`npm run trust:build:sandbox`): sandbox listesi (ADR-0038) — `registry-sandbox/` + sandbox PKI (`ops/pki-sandbox`,
 * `npm run pki:sandbox`) → `dist-sandbox/`. Sunucudaki sandbox kurulumuyla aynı ortam değişkenleri; çapa günlüğüne bir heartbeat
 * satırı eklenir. Sandbox kipi testleri (apps/verify policy-sets) bunu ister; `npm run setup` bunu da çalıştırır.
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const app = resolve(root, "apps/trust-publisher");
const sandbox = process.argv.includes("--sandbox");
const dist = resolve(app, sandbox ? "dist-sandbox" : "dist-test");
const env = { ...process.env };
delete env.TAMGA_NETWORK;
delete env.TAMGA_SANDBOX_SELF_DIR;
delete env.TAMGA_TP_PKI;
if (sandbox) {
  env.TAMGA_NETWORK = "sandbox";
  env.TAMGA_TP_REGISTRY = resolve(app, "registry-sandbox");
  env.TAMGA_TP_PKI = resolve(root, "ops/pki-sandbox");
} else env.TAMGA_TP_REGISTRY = resolve(app, "test/fixtures/registry");
env.TAMGA_TP_DIST = dist;
// heartbeat her seferinde: çapa günlüğü bir saatten eskiyse doğrulama "stale" der (S5)
const cmds = sandbox ? ["build", "heartbeat", "verify"] : ["build", "build", "heartbeat", "verify"];
for (const cmd of cmds) {
  const r = spawnSync("npx", ["tsx", "apps/trust-publisher/src/cli.ts", cmd], {
    cwd: root,
    env,
    stdio: ["ignore", "ignore", "inherit"],
    shell: process.platform === "win32",
  });
  if (r.status !== 0) {
    console.error(`trust-test-fixtures${sandbox ? " --sandbox" : ""}: ${cmd} başarısız (${r.status})`);
    process.exit(r.status ?? 1);
  }
}
console.log(
  `${sandbox ? "sandbox" : "test"} güven listesi hazır: apps/trust-publisher/${sandbox ? "dist-sandbox" : "dist-test"}`,
);
