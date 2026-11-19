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
  /**
   * Çapa günlüğü tazelik sınırı, saniye (`TAMGA_VERIFY_ANCHOR_MAX_AGE_SEC`). Günlüğün son satırı bundan eskiyse güven kaynağı
   * bayat sayılır ve cevaplar "bilinmiyor" olur (paketin mevcut yolu: `anchorMaxAgeMs` → `freshness().healthy` = false →
   * INDETERMINATE; SPEC-TRUST-0001 §6). Yayın adresi HTTPS iken (gerçek ağ ve sandbox) varsayılan 3 saat: heartbeat saatlik,
   * iptal listesi çapaları dakikalar aralığında yazılır. Yerelde (http) ayar verilmezse tanımsızdır → dizin yükleyicisinin gevşek
   * varsayılanı (365 gün; heartbeat'siz `dist/` klasörleri).
   */
  anchorMaxAgeSec?: number;
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
  /**
   * ADR-0065: ortamdan yüklenen terminal anahtarları (`grup:anahtar,…`) — yalnız yerel geliştirme ve sandbox (deneme kapısı).
   * Gerçek ağda anahtarlar yönetici ucundan verilir (`POST /terminal/keys`, `terminal-keys.json`).
   */
  terminalKeys?: string;
  /**
   * Hız sınırı için istemci anahtarı başlığı (`TAMGA_VERIFY_CLIENT_KEY_HEADER`; varsayılan yok). Vekil istemci adresini
   * iletmediğinden beyansız istekler tek kovaya düşer; vekil bu başlığa istemciyi ayıran bir değer yazarsa (her istekte ezerek)
   * kovalar istemci başına ayrılır. Yalnız yerel vekilden gelen istekte okunur; değer saklanmaz, loglanmaz (rate-limit.ts).
   */
  clientKeyHeader?: string;
}

/** Gerçek ağda yönetici belirtecinin en kısa uzunluğu (karakter). */
export const MIN_ADMIN_TOKEN_LENGTH = 24;

/** HTTPS yayın adresinde çapa günlüğü tazelik sınırının varsayılanı: 3 saat (saatlik heartbeat'in üç turu). */
export const DEFAULT_ANCHOR_MAX_AGE_SEC = 3 * 3600;

/** `TAMGA_VERIFY_ANCHOR_MAX_AGE_SEC`: pozitif sayı ise o; değilse HTTPS'te varsayılan, yerelde tanımsız (gevşek). */
function anchorMaxAgeSecOf(raw: string | undefined, https: boolean): number | undefined {
  const v = raw?.trim();
  if (v) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
    console.warn(
      `[verify] TAMGA_VERIFY_ANCHOR_MAX_AGE_SEC is not a positive number — ${https ? `using the default (${DEFAULT_ANCHOR_MAX_AGE_SEC} s)` : "ignored"}`,
    );
  }
  return https ? DEFAULT_ANCHOR_MAX_AGE_SEC : undefined;
}

const SANDBOX_PORTAL = "https://sandbox.tamga.network";
const SANDBOX_SAMPLE_SITE = "https://verify.sandbox.tamga.network/sample-site";
const sandboxGuide = (lang: "en" | "tr") =>
  lang === "tr" ? "https://docs.tamga.network/tr/guides/sandbox" : "https://docs.tamga.network/guides/sandbox";
/** "Denemek için sandbox" bağlantısı (portal yayındaysa portal, değilse rehber). */
export const sandboxUrl = (live: boolean | undefined, lang: "en" | "tr") =>
  live ? SANDBOX_PORTAL : sandboxGuide(lang);
/** Gerçek ağda /sample-site'ın gideceği yer: sandbox'taki örnek site (yayındaysa), değilse rehber. */
export const sandboxSampleSiteUrl = (live: boolean | undefined, lang: "en" | "tr") =>
  live ? SANDBOX_SAMPLE_SITE : sandboxGuide(lang);

/** .env sırası: apps/verify/.env → tamga-network/.env → ../tamga-platform/.env (tek sunucuda ortak dosya). */
export function loadVerifyConfig(root = resolve(import.meta.dirname, "../../..")): VerifyConfig {
  // Canlı kilit (denetim turu D; belge verme ve kimlik servisleriyle aynı kural): `TAMGA_LIVE=1` YALNIZ süreç ortamından (gerçek ağın systemd
  // birimi) okunur, .env'den değil (`loadDotenv` satırı yok sayar). Açıkken servis geliştirme (http) ya da sandbox kipinde açılmaz:
  // .env kaybolsa ya da yanlış yazılsa da sessizce gevşek kipte değil, açılış hatasıyla durur.
  const liveRaw = process.env.TAMGA_LIVE;
  if (liveRaw !== undefined && liveRaw !== "0" && liveRaw !== "1")
    throw new Error("[verify] TAMGA_LIVE must be 0 or 1");
  const live = liveRaw === "1";
  loadServiceEnv([resolve(root, "apps/verify/.env"), resolve(root, ".env"), resolve(root, "../tamga-platform/.env")]);
  const e = process.env;
  const network = networkOf(e);
  const publicBase = (e.TAMGA_VERIFY_BASE ?? "http://localhost:4004").replace(/\/$/, "");
  // Güvenlik turu S3 / ADR-0017 K6: gerçek ağda (HTTPS yayın adresi, sandbox değil) RP beyanı her zaman zorunlu — ayar
  // unutulsa ya da 0 yazılsa da sıkı kip; eski beyansız yol yalnız yerelde (http) ve sandbox'ta açılabilir
  const https = publicBase.startsWith("https://");
  const production = https && network !== "sandbox";
  if (live && !https)
    throw new Error("[verify] TAMGA_LIVE=1: TAMGA_VERIFY_BASE must be an https address — is .env missing?");
  if (live && network === "sandbox") throw new Error("[verify] TAMGA_LIVE=1: TAMGA_NETWORK=sandbox is not allowed");
  if (production && e.TAMGA_VERIFY_REQUIRE_RP_AUTH === "0")
    console.warn(
      "[verify] TAMGA_VERIFY_REQUIRE_RP_AUTH=0 is ignored on the production network (ADR-0017 K6) — strict mode on",
    );
  // ADR-0065 TK3: ortamdan yüklenen terminal anahtarları iptal edilemez, kuruma bağlanmaz — yalnız yerel geliştirme ve sandbox.
  // Gerçek ağda servis bu ayarla başlamaz (sessizce yok saymak yerine açık hata: ayar yanlış dosyaya yazılmış demektir)
  const terminalKeys = e.TAMGA_VERIFY_TERMINAL_KEYS?.trim() || undefined;
  if (production && terminalKeys)
    throw new Error(
      "[verify] TAMGA_VERIFY_TERMINAL_KEYS is not allowed on the production network (ADR-0065 TK3) — " +
        "remove it from the .env; issue terminal keys via POST /terminal/keys (Institution Console)",
    );
  // Güvenlik incelemesi 2026-11-18: gerçek ağda kısa yönetici belirteci (tahmin edilebilir) ile servis başlamaz — en az 24 karakter
  const adminToken = e.TAMGA_ADMIN_TOKEN;
  if (production && adminToken !== undefined && adminToken !== "" && adminToken.length < MIN_ADMIN_TOKEN_LENGTH)
    throw new Error(
      `[verify] TAMGA_ADMIN_TOKEN is too short for the production network (at least ${MIN_ADMIN_TOKEN_LENGTH} characters)`,
    );
  return {
    network,
    publicBase,
    port: Number(e.TAMGA_VERIFY_PORT ?? 4004),
    clientId: "", // app.ts: imzacının sertifikasından (x509_hash)
    pkiDir: resolve(root, e.TAMGA_PKI_DIR ?? "ops/pki"),
    trustDist: resolve(root, e.TAMGA_TRUST_DIST ?? "apps/trust-publisher/dist"),
    stateCode: e.TAMGA_STATE_CODE ?? "TR",
    trustReloadSec: Number(e.TAMGA_VERIFY_TRUST_RELOAD_SEC ?? 60),
    anchorMaxAgeSec: anchorMaxAgeSecOf(e.TAMGA_VERIFY_ANCHOR_MAX_AGE_SEC, https),
    statusPrefetchSec: Number(e.TAMGA_VERIFY_STATUS_PREFETCH_SEC ?? 60),
    dataDir: e.TAMGA_VERIFY_DATA_DIR ?? resolve(root, "apps/verify/data"),
    requireRpAuth: production || e.TAMGA_VERIFY_REQUIRE_RP_AUTH === "1",
    zkNativeBin: e.TAMGA_ZK_NATIVE_BIN?.trim() || undefined,
    sandboxLive: e.TAMGA_SANDBOX_LIVE !== "0", // 2026-10-04 sandbox yayında: varsayılan açık
    terminalKeys,
    clientKeyHeader: /^[a-z0-9-]{1,64}$/i.test(e.TAMGA_VERIFY_CLIENT_KEY_HEADER ?? "")
      ? e.TAMGA_VERIFY_CLIENT_KEY_HEADER!.toLowerCase()
      : undefined,
  };
}
