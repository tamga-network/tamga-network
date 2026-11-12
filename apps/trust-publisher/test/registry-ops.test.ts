/** Operatör kayıt aracı: başvurudan kayıt, eksiklerin tamamı tek hatada, şema yetkisi geçmişi korunur. */
import { describe, it, expect } from "vitest";
import {
  RegistryError,
  addIssuer,
  addRelyingParty,
  addScope,
  setAuthorization,
  setRpStatus,
  summarize,
  type RegistryEnv,
} from "../src/registry-ops.js";

const env: RegistryEnv = {
  now: new Date("2026-10-01T00:00:00Z"),
  certExists: (r) => ["issuer-yeni", "rp-yeni", "issuer-example-university"].includes(r),
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
      slug: "example-university",
      cert: "issuer-example-university",
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
  it("0.8.3 — ADR-0075 RO5: kayıtlı ad başka yazımla (büyük harf, sonda nokta) kaynakta dursa da ikinci kez kaydedilmez", () => {
    for (const stored of ["Shop.Example", "shop.example."]) {
      const s = src();
      s.relying_parties.push({
        dns_name: stored,
        status: "ACTIVE",
        access_cert: "rp-eski",
        scopes: [],
        status_history: [],
      });
      expect(() => addRelyingParty(s, rpApp, env), stored).toThrow(/dns_name zaten kayıtlı/);
    }
    expect(() => addRelyingParty(src(), { ...rpApp, dns_name: "shop.example." }, env)).toThrow(/dns_name: alan adı/);
  });

  it("0.8.3 — TL11: başvurudaki iletişim alanı biçimsizse kayıt yapılmaz", () => {
    expect(() => addIssuer(src(), { ...issuerApp, contact: { email: "Ad Soyad" } }, env)).toThrow(/contact\.email/);
    expect(() => addRelyingParty(src(), { ...rpApp, contact: { support_uri: "http://shop.example" } }, env)).toThrow(
      /contact\.support_uri/,
    );
  });

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
      slug: "example-university",
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

  it("ADR-0047 K2: isteğe bağlı revocation_policy_uri kayda girer; https değilse ret", () => {
    const out = addIssuer(src(), { ...issuerApp, revocation_policy_uri: "https://ornek.edu.tr/iptal-kosullari" }, env);
    const rec = (out.issuers as Array<Record<string, unknown>>).find((i) => i.slug === issuerApp.slug);
    expect(rec?.revocation_policy_uri).toBe("https://ornek.edu.tr/iptal-kosullari");
    expect(() => addIssuer(src(), { ...issuerApp, revocation_policy_uri: "http://ornek.edu.tr/x" }, env)).toThrow(
      /revocation_policy_uri/,
    );
  });

  it("O1: sertifikadaki kurum kimlik numarası başvurudaki identifiers ile birebir; gerçek ağda numarasız sertifika RED", () => {
    const withOrg = (m: Record<string, string | null>, requireCertOrgId = false): RegistryEnv => ({
      ...env,
      certOrgId: (ref) => m[ref] ?? null,
      requireCertOrgId,
    });
    // VKN TR1234567890 → VATTR-1234567890
    expect(() => addIssuer(src(), issuerApp, withOrg({ "issuer-yeni": "VATTR-1234567890" }, true))).not.toThrow();
    expect(() => addIssuer(src(), issuerApp, withOrg({ "issuer-yeni": "VATTR-9999999999" }))).toThrow(
      /VATTR-9999999999\) başvurudaki identifiers ile aynı değil \(VATTR-1234567890/,
    );
    expect(() => addIssuer(src(), issuerApp, withOrg({}, true))).toThrow(/organizationIdentifier\) yok/);
    expect(() => addIssuer(src(), issuerApp, withOrg({}))).not.toThrow(); // geliştirme: numarasız sertifika uyarısız geçer
    // iptal listesi sertifikası da aynı kurumun numarasını taşımalı
    expect(() =>
      addIssuer(
        src(),
        { ...issuerApp, status_cert: "rp-yeni" },
        withOrg({ "issuer-yeni": "VATTR-1234567890", "rp-yeni": "VATTR-1" }),
      ),
    ).toThrow(/rp-yeni: sertifikadaki kurum kimlik numarası/);
    // doğrulayıcı: erişim sertifikası (aracısız) aynı kural
    expect(() => addRelyingParty(src(), rpApp, withOrg({ "rp-yeni": "NTRTR-1" }))).toThrow(/aynı değil/);
    expect(() => addRelyingParty(src(), rpApp, withOrg({ "rp-yeni": "VATTR-1234567890" }, true))).not.toThrow();
  });

  it("aynı sertifika iki kurumda kullanılamaz", () => {
    expect(() => addIssuer(src(), { ...issuerApp, cert: "issuer-example-university" }, env)).toThrow(
      /başka bir kurumda/,
    );
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

  it("ADR-0075: iptal edilmiş alan adı yalnız onay kaydıyla yeniden kaydedilir; yeni dönem eski geçmişi korur, devralmaz", () => {
    const later = { ...env, now: new Date("2026-11-01T00:00:00Z") };
    const out = addRelyingParty(src(), rpApp, env);
    // etkin kayıt: sahiplik değişimi yeni kayıtla yapılamaz; onay da etkin kaydı yeniden kaydetmez
    expect(() => addRelyingParty(out, rpApp, env)).toThrow(/ADR-0075/);
    expect(() => addRelyingParty(out, rpApp, env, { approval: "OK-2026-11-01" })).toThrow(/sahiplik değişimi/);
    // hiç kaydedilmemiş alan adında onay anlamsız
    expect(() => addRelyingParty(src(), rpApp, env, { approval: "OK-2026-11-01" })).toThrow(/yalnız iptal edilmiş/);
    const revoked = setRpStatus(out, rpApp.dns_name, "REVOKED", { reason: "operator" }, env);
    expect(() => addRelyingParty(revoked, rpApp, later)).toThrow(/yalnız proje yönetimi onaylı açık işlemle/);
    expect(() => addRelyingParty(revoked, rpApp, later, { approval: "bad ref!" })).toThrow(/approval/);
    // yeni dönem eski kullanım kimliğini yeniden kullanamaz
    expect(() => addRelyingParty(revoked, rpApp, later, { approval: "OK-2026-11-01" })).toThrow(/önceki dönemde/);

    const next = { ...rpApp, scopes: [{ ...rpApp.scopes[0], scope_id: "student-discount-2" }] };
    const re = addRelyingParty(revoked, next, later, { approval: "OK-2026-11-01" });
    expect(re.relying_parties).toHaveLength(1); // kayıt silinmez, yeni dönem aynı kayda eklenir
    const rp = re.relying_parties[0] as Record<string, any>;
    expect(rp.status).toBe("ACTIVE");
    expect(rp.registered_at).toBe("2026-11-01T00:00:00.000Z");
    expect(rp.status_history.map((h: any) => h.status)).toEqual(["ACTIVE", "REVOKED", "ACTIVE"]);
    expect(rp.status_history[2].reason).toBe("re-registration (approval OK-2026-11-01)");
    expect(rp.scopes.map((s: any) => s.scope_id)).toEqual(["student-discount-1", "student-discount-2"]);
    expect(Date.parse(rp.scopes[0].valid_until)).toBeLessThanOrEqual(Date.parse("2026-10-01T00:00:00Z")); // eski kapalı
    expect(revoked.relying_parties[0]).not.toHaveProperty("scopes.1"); // kaynak değişmez
  });

  it("ADR-0034: başvuruda client_id verilmez (yayıncı x509_hash hesaplar); dns_name alan adı olmalı", () => {
    expect(() => addRelyingParty(src(), { ...rpApp, client_id: "x509_san_dns:shop.example" }, env)).toThrow(
      /client_id başvuruda verilmez/,
    );
    expect(() => addRelyingParty(src(), { ...rpApp, dns_name: "x509_san_dns:shop.example" }, env)).toThrow(/dns_name/);
    expect(() => addRelyingParty(src(), { ...rpApp, dns_name: "localhost" }, env)).toThrow(/dns_name/);
  });

  it("şema yetkisi: ver, kaldır (kayıt silinmez, bitiş tarihi), tekrar ver", () => {
    let s = setAuthorization(src(), "example-university", "urn:tamga:edu:DiplomaCredential:1", true, env);
    expect(() => setAuthorization(s, "example-university", "urn:tamga:edu:DiplomaCredential:1", true, env)).toThrow(
      /zaten yetkili/,
    );
    s = setAuthorization(s, "example-university", "urn:tamga:edu:StudentCredential:1", false, env);
    const auths = s.issuers[0].schema_authorizations;
    expect(auths).toHaveLength(2);
    expect(auths[0]).toMatchObject({
      vct: "urn:tamga:edu:StudentCredential:1",
      valid_until: "2026-10-01T00:00:00.000Z",
    });
    s = setAuthorization(s, "example-university", "urn:tamga:edu:StudentCredential:1", true, env);
    expect(s.issuers[0].schema_authorizations).toHaveLength(3);
  });

  it("özet eksik kayıt verisini gösterir", () => {
    const lines = summarize(src());
    expect(lines[0]).toMatch(/^kurum\s+example-university\s+ACTIVE\s+EDUCATION\/EAA\/I2\s+1 tür\s+eksik: trade_name/);
  });
});
