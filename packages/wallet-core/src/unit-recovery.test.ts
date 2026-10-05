/**
 * Bilinmeyen birimden kurtulma (sağlayıcının veritabanı yeniden kuruldu ya da birim kaydı silindi) — saf karar ve yanıt sınıflama.
 * Güvence (WA-ADR-0002): iptal edilmiş birim ASLA yeniden kaydolmaz; bilinmeyen birim de imzalı WIA iptal listesinde iptalse
 * yeniden kaydolmaz (kapatma sayfasının "verilerimi de sil" adımı kaydı siler, iptal biti listede kalır).
 */
import { describe, it, expect } from "vitest";
import { WalletError } from "./http.js";
import { decideUnitRecovery, unitFailureOf, unitRejection } from "./wua.js";

describe("bilinmeyen birim → yeniden kayıt (karar)", () => {
  it("unknown + liste iptal değil → yeniden kayıt; ikinci kez → fail (döngü yok)", () => {
    expect(decideUnitRecovery({ failure: "unknown_unit", list: "not_revoked", attempted: false })).toBe("re_register");
    expect(decideUnitRecovery({ failure: "unknown_unit", list: "not_revoked", attempted: true })).toBe("fail");
  });
  it("revoked → asla yeniden kayıt yok (liste ne derse desin)", () => {
    for (const list of ["revoked", "not_revoked", "error", undefined] as const)
      for (const attempted of [false, true])
        expect(decideUnitRecovery({ failure: "unit_revoked", list, attempted })).toBe("remote_lock");
  });
  it("unknown ama son WIA imzalı listede iptal → yeniden kayıt yok, uzaktan kapatma yolu", () => {
    expect(decideUnitRecovery({ failure: "unknown_unit", list: "revoked", attempted: false })).toBe("remote_lock");
  });
  it("unknown ama liste okunamadı → sonra yeniden dene (kayıt bırakılmaz)", () => {
    expect(decideUnitRecovery({ failure: "unknown_unit", list: "error", attempted: false })).toBe("retry_later");
    expect(decideUnitRecovery({ failure: "unknown_unit", attempted: false })).toBe("retry_later");
  });
  it("ağ hatası → sonra yeniden dene; başka hata → fail", () => {
    expect(decideUnitRecovery({ failure: "network", attempted: false })).toBe("retry_later");
    expect(decideUnitRecovery({ failure: "other", list: "not_revoked", attempted: false })).toBe("fail");
  });
});

describe("sağlayıcı yanıtı ve hata sınıflama", () => {
  it("yeni ve eski sağlayıcının bilinmeyen birim yanıtı tanınır", () => {
    expect(unitRejection(400, { error: "unknown_unit", error_description: "unknown unit" })).toBe("unknown_unit");
    expect(unitRejection(400, { error: "invalid_request", error_description: "unknown unit or bad key" })).toBe(
      "unknown_unit",
    );
    expect(unitRejection(403, { error: "unit_revoked" })).toBe("unit_revoked");
    expect(unitRejection(400, { error: "invalid_request", error_description: "proof replayed" })).toBe("other");
    expect(unitRejection(500, { error: "unknown_unit" })).toBe("other");
  });
  it("WalletError kodları ve ağ hatası", () => {
    expect(unitFailureOf(new WalletError("unit_unknown", "x"))).toBe("unknown_unit");
    expect(unitFailureOf(new WalletError("unit_revoked", "x"))).toBe("unit_revoked");
    expect(unitFailureOf(new WalletError("network", "x"))).toBe("network");
    expect(unitFailureOf(new TypeError("Network request failed"))).toBe("network");
    expect(unitFailureOf(new WalletError("issuer_error", "x"))).toBe("other");
  });
});
