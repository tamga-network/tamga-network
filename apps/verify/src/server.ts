import { loadVerifyConfig } from "./config.js";
import { buildVerifyApp } from "./app.js";

const cfg = loadVerifyConfig();
const app = await buildVerifyApp(cfg);
let lastFailed = "";
let ticking = false; // üst üste binme yok: önceki tur bitmeden yeni tur başlamaz
const tick = async () => {
  if (ticking) return;
  ticking = true;
  try {
    await app.reloadTrust();
    const r = await app.prefetchStatus();
    const key = r.failed.join("|");
    if (key !== lastFailed) {
      lastFailed = key;
      console.log(
        `[verify] status ön çekim: ${r.ok} ok${r.failed.length ? `, erişilemeyen: ${r.failed.join(", ")}` : ""}`,
      );
    }
  } catch (e) {
    console.error("[verify] güven/status yenileme hatası:", (e as Error).message);
  } finally {
    ticking = false;
  }
};
await tick();
setInterval(tick, Math.min(cfg.trustReloadSec, cfg.statusPrefetchSec) * 1000);
await app.listen({
  port: cfg.port,
  host: process.env.TAMGA_BIND_HOST ?? "0.0.0.0" /* sunucuda 127.0.0.1 (systemd); yerelde LAN için 0.0.0.0 */,
});
console.log(`[verify] ${cfg.publicBase} (port ${cfg.port}) · client_id ${cfg.clientId} · trust ${cfg.trustDist}`);
