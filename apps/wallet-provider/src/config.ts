import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadDotenv } from "../../_shared/dotenv.js";

export interface WpConfig {
  publicBase: string;
  port: number;
  pkiDir: string;
  certName: string;
  wuaTtlDays: number;
  /** ADR-0025: birim kayıtları + iptal listeleri (null = yalnız bellek, test) */
  dataDir: string | null;
  solutions: Array<{ solution_id: string; min_version: string }>;
  /** P4-2 cihaz kanıtı: Android paket adı, Apple App ID (TeamID.BundleID; yoksa iOS kanıtı kabul edilmez), geliştirme gevşekliği */
  device: { androidPackage: string; appleAppId: string | null; allowDevelopment: boolean };
}

export function loadWpConfig(root = resolve(import.meta.dirname, "../../..")): WpConfig {
  for (const p of [
    resolve(root, "apps/wallet-provider/.env"),
    resolve(root, ".env"),
    resolve(root, "../tamga-platform/.env"),
  ])
    loadDotenv(p);
  const e = process.env;
  return {
    publicBase: (e.TAMGA_WP_BASE ?? "http://localhost:4005").replace(/\/$/, ""),
    port: Number(e.TAMGA_WP_PORT ?? 4005),
    pkiDir: resolve(root, e.TAMGA_PKI_DIR ?? "ops/pki"),
    certName: e.TAMGA_WP_CERT ?? "wallet-provider",
    wuaTtlDays: Number(e.TAMGA_WP_WUA_TTL_DAYS ?? 30),
    // Sunucuda operatör verisiyle aynı yer (tamga-platform/data); yerelde uygulama klasörü (gitignore)
    dataDir: e.TAMGA_WP_DATA_DIR
      ? resolve(root, e.TAMGA_WP_DATA_DIR)
      : existsSync(resolve(root, "../tamga-platform/data"))
        ? resolve(root, "../tamga-platform/data/wallet-provider")
        : resolve(root, "apps/wallet-provider/data"),
    solutions: [{ solution_id: "tamga-wallet-expo", min_version: "0.1.0" }],
    device: {
      androidPackage: e.TAMGA_WP_ANDROID_PACKAGE ?? "network.tamga.wallet",
      appleAppId: e.TAMGA_WP_APPLE_APP_ID || null, // ör. ABCDE12345.network.tamga.wallet (Apple geliştirici hesabı gelince)
      allowDevelopment: e.TAMGA_WP_DEVICE_DEV === "1", // yalnız geliştirme: kilidi açık cihaz / App Attest development
    },
  };
}
