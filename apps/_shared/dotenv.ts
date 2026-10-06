/**
 * Servisler (verify) için ortak `.env` okuyucu — yayımlanan paketlerde değil (yalnızca apps/ içi, iç inceleme S6).
 * Kurallar: `AD=değer` satırları; `#` sonrası yorum; ortamda zaten tanımlı değişken EZİLMEZ (ilk dosya kazanır).
 * Tırnak soyulmaz; değerde `#` kullanmayın (tamga-platform/shared/config.ts ile aynı davranış).
 */
import { existsSync, readFileSync } from "node:fs";

/** ADR-0038: bu süreç hangi ağda (`TAMGA_NETWORK=sandbox` → sandbox; yoksa gerçek ağ). Ortamdan okunur, .env'den DEĞİL. */
export const networkOf = (env: NodeJS.ProcessEnv = process.env): "production" | "sandbox" =>
  env.TAMGA_NETWORK === "sandbox" ? "sandbox" : "production";

/**
 * Servis ayarları: gerçek ağda verilen .env dosyaları sırayla; sandbox'ta (ADR-0038) gerçek ağın .env'leri OKUNMAZ (gizli
 * anahtarlar, gerçek veritabanı, kimlik doğrulama sağlayıcısı sızmasın) — yalnız `TAMGA_ENV_FILE`.
 */
export function loadServiceEnv(paths: string[], env: NodeJS.ProcessEnv = process.env): void {
  if (networkOf(env) === "sandbox") {
    if (env.TAMGA_ENV_FILE) loadDotenv(env.TAMGA_ENV_FILE, env);
    return;
  }
  for (const p of paths) loadDotenv(p, env);
}

export function loadDotenv(p: string, env: NodeJS.ProcessEnv = process.env): void {
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*(#.*)?$/.exec(line);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2];
  }
}
