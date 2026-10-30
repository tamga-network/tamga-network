/**
 * Güvenlik turu S3 (ADR-0017 K6): gerçek ağda — yayın adresi HTTPS ve sandbox değil — RP beyanı zorunlu kipi ayardan bağımsız
 * açıktır; yerelde (http) ve sandbox'ta ayar geçerlidir.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadVerifyConfig } from "../src/config.js";

// .env dosyaları okunmasın: boş bir kök (ortamda tanımlı değişken zaten ezilmez)
const EMPTY_ROOT = mkdtempSync(join(tmpdir(), "tamga-verify-cfg-"));
const KEYS = ["TAMGA_VERIFY_BASE", "TAMGA_NETWORK", "TAMGA_VERIFY_REQUIRE_RP_AUTH", "TAMGA_VERIFY_TERMINAL_KEYS"];
const load = (env: Record<string, string | undefined>) => {
  for (const k of KEYS) vi.stubEnv(k, env[k] ?? "");
  // vi.stubEnv("") tanımlı sayılır; tanımsız istenenleri sil
  for (const k of KEYS) if (env[k] === undefined) delete process.env[k];
  return loadVerifyConfig(EMPTY_ROOT);
};

describe("verify config — requireRpAuth (S3)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("gerçek ağ (https, sandbox değil): ayar yok ya da 0 olsa da sıkı kip; uyarı yazılır", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(load({ TAMGA_VERIFY_BASE: "https://verify.tamga.network" }).requireRpAuth).toBe(true);
    expect(warn).toHaveBeenCalledTimes(0);
    expect(
      load({ TAMGA_VERIFY_BASE: "https://verify.tamga.network", TAMGA_VERIFY_REQUIRE_RP_AUTH: "0" }).requireRpAuth,
    ).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("sandbox (https) ve yerel (http): ayar geçerli — varsayılan kapalı, 1 ile açık", () => {
    expect(
      load({ TAMGA_VERIFY_BASE: "https://verify.sandbox.tamga.network", TAMGA_NETWORK: "sandbox" }).requireRpAuth,
    ).toBe(false);
    expect(
      load({
        TAMGA_VERIFY_BASE: "https://verify.sandbox.tamga.network",
        TAMGA_NETWORK: "sandbox",
        TAMGA_VERIFY_REQUIRE_RP_AUTH: "1",
      }).requireRpAuth,
    ).toBe(true);
    expect(load({ TAMGA_VERIFY_BASE: "http://192.168.1.20:4004" }).requireRpAuth).toBe(false);
    expect(
      load({ TAMGA_VERIFY_BASE: "http://192.168.1.20:4004", TAMGA_VERIFY_REQUIRE_RP_AUTH: "1" }).requireRpAuth,
    ).toBe(true);
  });
});

describe("verify config — ortamdan terminal anahtarı (ADR-0065 TK3)", () => {
  afterEach(() => vi.unstubAllEnvs());
  const KEYS_ENV = "gate-a:deneme-anahtari";

  it("gerçek ağ (https, sandbox değil): TAMGA_VERIFY_TERMINAL_KEYS ile servis başlamaz", () => {
    expect(() =>
      load({ TAMGA_VERIFY_BASE: "https://verify.tamga.network", TAMGA_VERIFY_TERMINAL_KEYS: KEYS_ENV }),
    ).toThrow(/ADR-0065 TK3/);
    // ayar yoksa (ya da boşsa) sorun yok
    expect(load({ TAMGA_VERIFY_BASE: "https://verify.tamga.network" }).terminalKeys).toBeUndefined();
    expect(
      load({ TAMGA_VERIFY_BASE: "https://verify.tamga.network", TAMGA_VERIFY_TERMINAL_KEYS: "  " }).terminalKeys,
    ).toBeUndefined();
  });

  it("sandbox (https) ve yerel (http): ortamdan anahtar yüklenir", () => {
    expect(
      load({
        TAMGA_VERIFY_BASE: "https://verify.sandbox.tamga.network",
        TAMGA_NETWORK: "sandbox",
        TAMGA_VERIFY_TERMINAL_KEYS: KEYS_ENV,
      }).terminalKeys,
    ).toBe(KEYS_ENV);
    expect(
      load({ TAMGA_VERIFY_BASE: "http://192.168.1.20:4004", TAMGA_VERIFY_TERMINAL_KEYS: KEYS_ENV }).terminalKeys,
    ).toBe(KEYS_ENV);
  });
});
