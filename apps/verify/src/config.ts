import { resolve } from "node:path";
import { loadServiceEnv, networkOf } from "../../_shared/dotenv.js";

export interface VerifyConfig {
  publicBase: string; // https://verify.tamga.network (LAN: http://<ip>:4004)
  port: number;
  /**
   * ADR-0034: OpenID4VP istemci kimliği `x509_hash:…` — ayardan okunmaz, erişim sertifikasından hesaplanır (app.ts, imzacı yüklenince);
   * listedeki kaydın `client_id`'siyle aynıdır.
   */
  clientId: string;
  /** ADR-0038: beklenen ağ — güven listesinin `environment` alanı bununla eşleşmeli (SB2). */
  network?: "production" | "sandbox";
  pkiDir: string; // rp-verify.cert.pem / rp-verify.pkcs8.pem (demo)
  trustDist: string; // trust-publisher dist (veya trust.tamga.network aynası)
  stateCode: string;
  trustReloadSec: number;
  statusPrefetchSec: number;
  dataDir: string; // geçiş kartı kayıtları (passes.json) — gitignore
  /** ADR-0017 K6: üretimde 1 — sunum açmak ve sonuç/değer okumak RP beyanı ister; 0 (demo) eski yol Deprecation başlığıyla. */
  requireRpAuth: boolean;
  /**
   * ADR-0032 Aşama 3: yerel ZK doğrulayıcısı (`tamga-zk-verify`; WASM ~3 s → yerel ~0,2 s). Boş = paketle gelen WASM.
   * İkili yoksa ya da yanıt vermezse istek WASM ile doğrulanır (servis durmaz).
   */
  zkNativeBin?: string;
  /**
   * Sandbox yayında mı (`TAMGA_SANDBOX_LIVE=1`; tamga-web SANDBOX_LIVE ile aynı anlam). Gerçek ağdaki "Denemek için sandbox"
   * bağlantıları ve /sample-site yönlendirmesi: açıksa sandbox.tamga.network, değilse geliştirici belgelerindeki sandbox rehberi.
   */
  sandboxLive?: boolean;
}

const SANDBOX_PORTAL = "https://sandbox.tamga.network";
const SANDBOX_SAMPLE_SITE = "https://verify.sandbox.tamga.network/sample-site";
const sandboxGuide = (lang: "en" | "tr") =>
  lang === "tr" ? "https://docs.tamga.network/guides/sandbox" : "https://docs.tamga.network/en/guides/sandbox";
/** "Denemek için sandbox" bağlantısı (portal yayındaysa portal, değilse rehber). */
export const sandboxUrl = (live: boolean | undefined, lang: "en" | "tr") =>
  live ? SANDBOX_PORTAL : sandboxGuide(lang);
/** Gerçek ağda /sample-site'ın gideceği yer: sandbox'taki örnek site (yayındaysa), değilse rehber. */
export const sandboxSampleSiteUrl = (live: boolean | undefined, lang: "en" | "tr") =>
  live ? SANDBOX_SAMPLE_SITE : sandboxGuide(lang);

/** .env sırası: apps/verify/.env → tamga-network/.env → ../tamga-platform/.env (tek sunucuda ortak dosya). */
export function loadVerifyConfig(root = resolve(import.meta.dirname, "../../..")): VerifyConfig {
  loadServiceEnv([resolve(root, "apps/verify/.env"), resolve(root, ".env"), resolve(root, "../tamga-platform/.env")]);
  const e = process.env;
  return {
    network: networkOf(e),
    publicBase: (e.TAMGA_VERIFY_BASE ?? "http://localhost:4004").replace(/\/$/, ""),
    port: Number(e.TAMGA_VERIFY_PORT ?? 4004),
    clientId: "", // app.ts: imzacının sertifikasından (x509_hash)
    pkiDir: resolve(root, e.TAMGA_PKI_DIR ?? "ops/pki"),
    trustDist: resolve(root, e.TAMGA_TRUST_DIST ?? "apps/trust-publisher/dist"),
    stateCode: e.TAMGA_STATE_CODE ?? "TR",
    trustReloadSec: Number(e.TAMGA_VERIFY_TRUST_RELOAD_SEC ?? 60),
    statusPrefetchSec: Number(e.TAMGA_VERIFY_STATUS_PREFETCH_SEC ?? 60),
    dataDir: e.TAMGA_VERIFY_DATA_DIR ?? resolve(root, "apps/verify/data"),
    requireRpAuth: e.TAMGA_VERIFY_REQUIRE_RP_AUTH === "1",
    zkNativeBin: e.TAMGA_ZK_NATIVE_BIN?.trim() || undefined,
    sandboxLive: e.TAMGA_SANDBOX_LIVE === "1",
  };
}
