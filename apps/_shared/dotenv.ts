/**
 * Servisler (verify, wallet-provider) için ortak `.env` okuyucu — yayımlanan paketlerde değil (yalnızca apps/ içi, iç inceleme S6).
 * Kurallar: `AD=değer` satırları; `#` sonrası yorum; ortamda zaten tanımlı değişken EZİLMEZ (ilk dosya kazanır).
 * Tırnak soyulmaz; değerde `#` kullanmayın (tamga-platform/shared/config.ts ile aynı davranış).
 */
import { existsSync, readFileSync } from "node:fs";

export function loadDotenv(p: string, env: NodeJS.ProcessEnv = process.env): void {
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*(#.*)?$/.exec(line);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2];
  }
}
