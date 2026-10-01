import { loadWpConfig } from "./config.js";
import { buildWalletProviderApp } from "./app.js";

const cfg = loadWpConfig();
const app = await buildWalletProviderApp(cfg);
await app.listen({
  port: cfg.port,
  host: process.env.TAMGA_BIND_HOST ?? "0.0.0.0" /* sunucuda 127.0.0.1 (systemd); yerelde LAN için 0.0.0.0 */,
});
console.log(
  `[wallet-provider] ${cfg.publicBase} (port ${cfg.port}) · cert ${cfg.certName} · WIA/KA (ADR-0025) · veri ${cfg.dataDir}`,
);
