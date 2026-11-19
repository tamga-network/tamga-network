/**
 * Güvenlik turu S3 (ADR-0017 K6): gerçek ağda — yayın adresi HTTPS ve sandbox değil — RP beyanı zorunlu kipi ayardan bağımsız
 * açıktır; yerelde (http) ve sandbox'ta ayar geçerlidir.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_ANCHOR_MAX_AGE_SEC, loadVerifyConfig } from "../src/config.js";

// .env dosyaları okunmasın: boş bir kök (ortamda tanımlı değişken zaten ezilmez)
const EMPTY_ROOT = mkdtempSync(join(tmpdir(), "tamga-verify-cfg-"));
const KEYS = [
  "TAMGA_VERIFY_BASE",
  "TAMGA_NETWORK",
  "TAMGA_VERIFY_REQUIRE_RP_AUTH",
  "TAMGA_VERIFY_TERMINAL_KEYS",
  "TAMGA_VERIFY_ANCHOR_MAX_AGE_SEC",
  "TAMGA_ADMIN_TOKEN",
];
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

describe("verify config — çapa günlüğü tazelik sınırı (TAMGA_VERIFY_ANCHOR_MAX_AGE_SEC)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("HTTPS yayın adresi (gerçek ağ ve sandbox): varsayılan 3 saat; ayar saniye olarak değiştirir", () => {
    expect(DEFAULT_ANCHOR_MAX_AGE_SEC).toBe(10_800);
    expect(load({ TAMGA_VERIFY_BASE: "https://verify.tamga.network" }).anchorMaxAgeSec).toBe(10_800);
    expect(
      load({ TAMGA_VERIFY_BASE: "https://verify.sandbox.tamga.network", TAMGA_NETWORK: "sandbox" }).anchorMaxAgeSec,
    ).toBe(10_800);
    expect(
      load({ TAMGA_VERIFY_BASE: "https://verify.tamga.network", TAMGA_VERIFY_ANCHOR_MAX_AGE_SEC: "7200" })
        .anchorMaxAgeSec,
    ).toBe(7200);
  });

  it("yerel (http): ayar yoksa tanımsız — uygulama yerel geliştirme sınırını açıkça verir; ayar verilirse o", () => {
    expect(load({ TAMGA_VERIFY_BASE: "http://192.168.1.20:4004" }).anchorMaxAgeSec).toBeUndefined();
    expect(load({}).anchorMaxAgeSec).toBeUndefined();
    expect(
      load({ TAMGA_VERIFY_BASE: "http://192.168.1.20:4004", TAMGA_VERIFY_ANCHOR_MAX_AGE_SEC: "600" }).anchorMaxAgeSec,
    ).toBe(600);
  });

  it("geçersiz değer (sayı değil, sıfır, negatif) sınırı kapatmaz: HTTPS'te varsayılan, yerelde yok sayılır; uyarı yazılır", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    warn.mockClear(); // önceki testlerin casusu aynı nesnedir
    for (const bad of ["abc", "0", "-5", "Infinity"]) {
      expect(
        load({ TAMGA_VERIFY_BASE: "https://verify.tamga.network", TAMGA_VERIFY_ANCHOR_MAX_AGE_SEC: bad })
          .anchorMaxAgeSec,
      ).toBe(10_800);
      expect(
        load({ TAMGA_VERIFY_BASE: "http://localhost:4004", TAMGA_VERIFY_ANCHOR_MAX_AGE_SEC: bad }).anchorMaxAgeSec,
      ).toBeUndefined();
    }
    expect(warn).toHaveBeenCalledTimes(8);
    warn.mockRestore();
  });
});

describe("verify config — yönetici belirteci uzunluğu (C1-4, güvenlik incelemesi 2026-11-18)", () => {
  afterEach(() => vi.unstubAllEnvs());
  const PROD = "https://verify.tamga.network";
  it("gerçek ağda 24 karakterden kısa TAMGA_ADMIN_TOKEN ile servis başlamaz; yeterli uzunluk ya da tanımsız sorun değil", () => {
    expect(() => load({ TAMGA_VERIFY_BASE: PROD, TAMGA_ADMIN_TOKEN: "kisa-belirtec" })).toThrow(/at least 24/);
    expect(() => load({ TAMGA_VERIFY_BASE: PROD, TAMGA_ADMIN_TOKEN: "x".repeat(23) })).toThrow(/TAMGA_ADMIN_TOKEN/);
    expect(load({ TAMGA_VERIFY_BASE: PROD, TAMGA_ADMIN_TOKEN: "x".repeat(24) }).requireRpAuth).toBe(true);
    expect(load({ TAMGA_VERIFY_BASE: PROD }).requireRpAuth).toBe(true);
  });
  it("sandbox ve yerel: kısa belirteç geliştirme için kabul (uyarısız)", () => {
    expect(() =>
      load({
        TAMGA_VERIFY_BASE: "https://verify.sandbox.tamga.network",
        TAMGA_NETWORK: "sandbox",
        TAMGA_ADMIN_TOKEN: "dev",
      }),
    ).not.toThrow();
    expect(() => load({ TAMGA_ADMIN_TOKEN: "dev" })).not.toThrow();
  });
});

describe("verify config — canlı kilit TAMGA_LIVE=1 (denetim turu D; kimlik ve belge verme servisleriyle aynı kural)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete process.env.TAMGA_LIVE;
  });
  const live = (env: Record<string, string | undefined>, root = EMPTY_ROOT) => {
    process.env.TAMGA_LIVE = "1";
    for (const k of KEYS) vi.stubEnv(k, env[k] ?? "");
    for (const k of KEYS) if (env[k] === undefined) delete process.env[k];
    return loadVerifyConfig(root);
  };
  it(".env yoksa kilitli süreç geliştirme kipinde (http) açılmaz; tam gerçek ağ ayarıyla açılır", () => {
    expect(() => live({})).toThrow(/TAMGA_LIVE=1: TAMGA_VERIFY_BASE must be an https address/);
    expect(live({ TAMGA_VERIFY_BASE: "https://verify.tamga.network" }).requireRpAuth).toBe(true);
  });
  it("kilitli süreç sandbox kipinde açılmaz", () => {
    expect(() => live({ TAMGA_VERIFY_BASE: "https://verify.sandbox.tamga.network", TAMGA_NETWORK: "sandbox" })).toThrow(
      /TAMGA_LIVE=1: TAMGA_NETWORK=sandbox is not allowed/,
    );
  });
  it(".env kilidi açamaz; bilinmeyen değer açılış hatası", () => {
    const root = mkdtempSync(join(tmpdir(), "tamga-verify-live-"));
    writeFileSync(join(root, ".env"), "TAMGA_LIVE=1\n");
    for (const k of KEYS) delete process.env[k];
    delete process.env.TAMGA_LIVE;
    expect(loadVerifyConfig(root).publicBase).toBe("http://localhost:4004"); // .env satırı yok sayıldı
    expect(process.env.TAMGA_LIVE).toBeUndefined();
    process.env.TAMGA_LIVE = "yes";
    expect(() => loadVerifyConfig(EMPTY_ROOT)).toThrow(/TAMGA_LIVE must be 0 or 1/);
  });
});
