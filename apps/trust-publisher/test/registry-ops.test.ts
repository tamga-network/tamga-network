/** Operatör kayıt aracı: başvurudan kayıt, eksiklerin tamamı tek hatada, şema yetkisi geçmişi korunur. */
import { describe, it, expect } from "vitest";
import {
  RegistryError,
  addIssuer,
  addRelyingParty,
  addScope,
  setAuthorization,
  summarize,
  type RegistryEnv,
} from "../src/registry-ops.js";

const env: RegistryEnv = {
  now: new Date("2026-10-01T00:00:00Z"),
  certExists: (r) => ["issuer-yeni", "rp-yeni", "issuer-bilgi"].includes(r),
  knownVcts: new Set(["urn:tamga:edu:StudentCredential:1", "urn:tamga:edu:DiplomaCredential:1"]),
};
const registration = {
  trade_name: "Yeni Üniversite",
  identifiers: [{ scheme: "TR-VKN", value: "TR1234567890" }],
  postal_address: { street_address: "Örnek Cad. 1", country: "TR" },
  contact: { support_uri: "https://yeni.example/destek" },
  supervisory_authority: { name: "KVKK", country: "TR", form_uri: "https://dpa.example/form" },
};
const src = () => ({
  root_cas: [{ cert: "root-ca" }],
  issuers: [
    {
      slug: "bilgi",
      cert: "issuer-bilgi",
      status: "ACTIVE",
      category: "EDUCATION",
      class: "EAA",
      assurance: "I2",
      schema_authorizations: [
        {
          vct: "urn:tamga:edu:StudentCredential:1",
          allowed: true,
          valid_from: "2026-09-24T00:00:00Z",
          valid_until: null,
        },
      ],
    },
  ],
  relying_parties: [] as Record<string, unknown>[],
});
const issuerApp = {
  slug: "yeni",
  legal_name: "Yeni Üniversitesi",
  category: "EDUCATION",
  class: "EAA",
  assurance: "I2",
  cert: "issuer-yeni",
  vcts: ["urn:tamga:edu:StudentCredential:1"],
  ...registration,
};
const rpApp = {
  dns_name: "shop.example",
  legal_name: "Shop A.Ş.",
  access_cert: "rp-yeni",
  service_description: { "en-US": "Online shop" },
  is_public_sector_body: false,
  entitlements: ["service_provider"],
  scopes: [
    {
      scope_id: "student-discount-1",
      purpose: "Student discount",
      vct: "urn:tamga:edu:StudentCredential:1",
      claims: ["is_enrolled"],
      privacy_policy_uri: "https://shop.example/privacy",
    },
  ],
  ...registration,
  trade_name: "Shop",
};

describe("operatör kayıt aracı", () => {
  it("kurum başvurusu → kayıt: durum, tarihçe, 2 yıl geçerlilik, yetki türü, şema yetkisi üretilir; kaynak değişmez", () => {
    const s = src();
    const out = addIssuer(s, issuerApp, env);
    expect(s.issuers).toHaveLength(1);
    const rec = out.issuers[1];
    expect(rec).toMatchObject({
      slug: "yeni",
      parent_ca: "root-ca",
      issuer_url: "https://issuer.tamga.network/yeni",
      status: "ACTIVE",
      valid_from: "2026-10-01T00:00:00.000Z",
      valid_until: "2028-10-01T00:00:00.000Z",
      entitlements: ["non_q_eaa_provider"],
      schema_authorizations: [{ vct: "urn:tamga:edu:StudentCredential:1", allowed: true, valid_until: null }],
    });
    expect(rec.vcts).toBeUndefined();
  });

  it("eksiklerin tamamı tek hatada", () => {
    const bad = {
      ...issuerApp,
      slug: "bilgi",
      class: "QUALIFIED",
      cert: "yok",
      vcts: ["urn:tamga:x:Y:1"],
      supervisory_authority: undefined,
    };
    try {
      addIssuer(src(), bad, env);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(RegistryError);
      const p = (e as RegistryError).problems.join(" | ");
      expect(p).toContain("slug zaten kayıtlı");
      expect(p).toContain("QUALIFIED sınıfı I3");
      expect(p).toContain("sertifika bulunamadı");
      expect(p).toContain("şema katalogda yok");
      expect(p).toContain("supervisory_authority");
    }
  });

  it("doldurulmamış yer tutucu ([DOLDURULACAK]) taşıyan başvuru kayda girmez (registry/pending)", () => {
    const pending = { ...issuerApp, identifiers: [{ scheme: "TR-VKN", value: "[DOLDURULACAK]" }] };
    expect(() => addIssuer(src(), pending, env)).toThrow(RegistryError);
    expect(() => addRelyingParty(src(), { ...rpApp, trade_name: "[DOLDURULACAK]" }, env)).toThrow(RegistryError);
  });

  it("aynı sertifika iki kurumda kullanılamaz", () => {
    expect(() => addIssuer(src(), { ...issuerApp, cert: "issuer-bilgi" }, env)).toThrow(/başka bir kurumda/);
  });

  it("doğrulayıcı başvurusu + yeni kullanım; gizlilik politikası zorunlu", () => {
    const out = addRelyingParty(src(), rpApp, env);
    const rp = out.relying_parties[0];
    expect(rp).toMatchObject({ status: "ACTIVE", registered_at: "2026-10-01T00:00:00.000Z" });
    expect(rp.scopes[0].valid_until).toBe("2027-10-01T00:00:00.000Z");
    expect(() =>
      addScope(
        out,
        rpApp.dns_name,
        { scope_id: "diploma-1", purpose: "x", vct: "urn:tamga:edu:DiplomaCredential:1", claims: [] },
        env,
      ),
    ).toThrow(/privacy_policy_uri/);
    const out2 = addScope(
      out,
      rpApp.dns_name,
      {
        scope_id: "diploma-1",
        purpose: "Graduation check",
        vct: "urn:tamga:edu:DiplomaCredential:1",
        claims: ["is_graduate"],
        privacy_policy_uri: "https://shop.example/privacy",
      },
      env,
    );
    expect(out2.relying_parties[0].scopes).toHaveLength(2);
    expect(() => addRelyingParty(out, rpApp, env)).toThrow(/zaten kayıtlı/);
  });

  it("ADR-0034: başvuruda client_id verilmez (yayıncı x509_hash hesaplar); dns_name alan adı olmalı", () => {
    expect(() => addRelyingParty(src(), { ...rpApp, client_id: "x509_san_dns:shop.example" }, env)).toThrow(
      /client_id başvuruda verilmez/,
    );
    expect(() => addRelyingParty(src(), { ...rpApp, dns_name: "x509_san_dns:shop.example" }, env)).toThrow(/dns_name/);
    expect(() => addRelyingParty(src(), { ...rpApp, dns_name: "localhost" }, env)).toThrow(/dns_name/);
  });

  it("şema yetkisi: ver, kaldır (kayıt silinmez, bitiş tarihi), tekrar ver", () => {
    let s = setAuthorization(src(), "bilgi", "urn:tamga:edu:DiplomaCredential:1", true, env);
    expect(() => setAuthorization(s, "bilgi", "urn:tamga:edu:DiplomaCredential:1", true, env)).toThrow(/zaten yetkili/);
    s = setAuthorization(s, "bilgi", "urn:tamga:edu:StudentCredential:1", false, env);
    const auths = s.issuers[0].schema_authorizations;
    expect(auths).toHaveLength(2);
    expect(auths[0]).toMatchObject({
      vct: "urn:tamga:edu:StudentCredential:1",
      valid_until: "2026-10-01T00:00:00.000Z",
    });
    s = setAuthorization(s, "bilgi", "urn:tamga:edu:StudentCredential:1", true, env);
    expect(s.issuers[0].schema_authorizations).toHaveLength(3);
  });

  it("özet eksik kayıt verisini gösterir", () => {
    const lines = summarize(src());
    expect(lines[0]).toMatch(/^kurum\s+bilgi\s+ACTIVE\s+EDUCATION\/EAA\/I2\s+1 tür\s+eksik: trade_name/);
  });
});
