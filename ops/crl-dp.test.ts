/**
 * ADR-0090 — `pki-issue --crl-uri` denetimi: biçim, yol = veren makam, alan adı = PKI klasörünün ağı (gerçek / sandbox).
 */
import { describe, it, expect } from "vitest";
import { crlHostForProfile, crlUriProblem } from "./crl-dp.js";

describe("CRL dağıtım noktası adresi (ADR-0090)", () => {
  it("ağ profili → CRL alan adı; geliştirme PKI'sında kısıt yok", () => {
    expect(crlHostForProfile("production")).toBe("crl.tamga.network");
    expect(crlHostForProfile("sandbox")).toBe("crl.sandbox.tamga.network");
    expect(crlHostForProfile("development")).toBeUndefined();
    expect(crlHostForProfile(undefined)).toBeUndefined();
  });

  it("gerçek ağın sertifikası sandbox CRL'ine (ve tersi) gösteremez", () => {
    expect(crlUriProblem("http://crl.tamga.network/access-ca-1.crl", "access-ca-1", "production")).toBeNull();
    expect(crlUriProblem("http://crl.sandbox.tamga.network/access-ca-1.crl", "access-ca-1", "sandbox")).toBeNull();
    expect(crlUriProblem("http://crl.sandbox.tamga.network/access-ca-1.crl", "access-ca-1", "production")).toMatch(
      /crl\.tamga\.network/,
    );
    expect(crlUriProblem("http://crl.tamga.network/access-ca-1.crl", "access-ca-1", "sandbox")).toMatch(
      /crl\.sandbox\.tamga\.network/,
    );
    expect(crlUriProblem("http://crl.example.org/access-ca-1.crl", "access-ca-1", "production")).not.toBeNull();
    // geliştirme PKI'sı: biçim ve makam adı yine denetlenir
    expect(crlUriProblem("http://crl.example.org/access-ca-1.crl", "access-ca-1", "development")).toBeNull();
  });

  it("biçim ve yol = veren makam", () => {
    expect(crlUriProblem("https://crl.tamga.network/access-ca-1.crl", "access-ca-1")).toMatch(/biçiminde/);
    expect(crlUriProblem("http://crl.tamga.network/root-ca.crl", "access-ca-1")).toMatch(/verenin/);
  });
});
