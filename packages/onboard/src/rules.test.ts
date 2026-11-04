/**
 * Başvuru kuralları — operatörün kayıt aracıyla EŞİTLİK: aynı başvurular iki kural kümesinden geçer; kayıt aracı reddettiğinde bu paket
 * de sorun bildirmeli, kabul ettiğinde (kurum tarafına özgü katı denetimler dışında) sorun bildirmemeli. Biri değişirse test düşer.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { addIssuer, addRelyingParty, RegistryError } from "../../../apps/trust-publisher/src/registry-ops.js";
import {
  KNOWN_VCTS,
  applicationKind,
  iscedFOk,
  organizationIdentifier,
  validateApplication,
  validateIssuerApplication,
  validateRpApplication,
  vknChecksumOk,
} from "./rules.js";

const EX = resolve(import.meta.dirname, "../../../apps/trust-publisher/registry/examples");
const read = (f: string) => JSON.parse(readFileSync(resolve(EX, f), "utf8"));
// kurum tarafı denetimin (sağlama) uyarısı olmasın diye sağlaması tutan uydurma numara
const VKN = "TR1234567890";
const issuerBase = () => ({
  ...read("issuer-application.example.json"),
  identifiers: [{ scheme: "TR-VKN", value: VKN }],
});
const rpBase = () => ({ ...read("rp-application.example.json"), identifiers: [{ scheme: "TR-VKN", value: VKN }] });
const env = { now: new Date("2026-11-04T00:00:00Z"), certExists: () => true, knownVcts: new Set(KNOWN_VCTS) };
const src = { issuers: [], relying_parties: [], root_cas: [{ cert: "root-ca" }] };
const registryAccepts = (fn: () => unknown) => {
  try {
    fn();
    return true;
  } catch (e) {
    if (e instanceof RegistryError) return false;
    throw e;
  }
};

type Mut = [string, (a: Record<string, unknown>) => void];
const ISSUER_MUTATIONS: Mut[] = [
  ["değişiklik yok", () => {}],
  ["slug bozuk", (a) => (a.slug = "Örnek Kolej")],
  ["legal_name yok", (a) => delete a.legal_name],
  ["kategori kapalı küme dışı", (a) => (a.category = "SCHOOL")],
  ["sınıf yok", (a) => delete a.class],
  ["QUALIFIED + I2", (a) => (a.class = "QUALIFIED")],
  ["cert yok", (a) => delete a.cert],
  ["vcts boş", (a) => (a.vcts = [])],
  ["katalogda olmayan tür", (a) => (a.vcts = ["urn:tamga:edu:Unknown:1"])],
  ["trade_name yok", (a) => delete a.trade_name],
  ["identifiers yok", (a) => delete a.identifiers],
  ["adres eksik", (a) => (a.postal_address = { locality: "Istanbul" })],
  ["iletişim yok", (a) => delete a.contact],
  ["denetim makamı başvuru yolu yok", (a) => (a.supervisory_authority = { name: "KVKK", country: "TR" })],
  ["iptal politikası http", (a) => (a.revocation_policy_uri = "http://example.edu.tr/revocation")],
  ["yer tutucu", (a) => (a.legal_name = "[DOLDURULACAK]")],
];
const RP_MUTATIONS: Mut[] = [
  ["değişiklik yok", () => {}],
  ["client_id verilmiş", (a) => (a.client_id = "x509_hash:abc")],
  ["dns_name bozuk", (a) => (a.dns_name = "Shop Example")],
  ["access_cert yok", (a) => delete a.access_cert],
  ["kullanım yok", (a) => (a.scopes = [])],
  ["kullanımda gizlilik politikası yok", (a) => delete (a.scopes as Record<string, unknown>[])[0].privacy_policy_uri],
  ["kullanım türü katalogda yok", (a) => ((a.scopes as Record<string, unknown>[])[0].vct = "urn:x:y:Z:1")],
  ["service_description yok", (a) => delete a.service_description],
  ["is_public_sector_body yok", (a) => delete a.is_public_sector_body],
  ["entitlements yok", (a) => delete a.entitlements],
];

describe("onboard kuralları ↔ kayıt aracı eşitliği", () => {
  for (const [name, mut] of ISSUER_MUTATIONS)
    it(`belge veren: ${name}`, () => {
      const app = issuerBase();
      mut(app);
      const ours = validateIssuerApplication(app).problems;
      expect(ours.length === 0).toBe(registryAccepts(() => addIssuer(src, app, env)));
    });
  for (const [name, mut] of RP_MUTATIONS)
    it(`doğrulayıcı: ${name}`, () => {
      const app = rpBase();
      mut(app);
      const ours = validateRpApplication(app).problems;
      expect(ours.length === 0).toBe(registryAccepts(() => addRelyingParty(src, app, env)));
    });
});

describe("kurum tarafı ek denetimler (kayıt aracından katı)", () => {
  it("kişi bilgisi alanı başvuruya girmez: bilinmeyen alan reddedilir", () => {
    const app = { ...issuerBase(), signatory_name: "Ad Soyad" };
    expect(validateIssuerApplication(app).problems.join()).toMatch(/bilinmeyen alan: signatory_name/);
    const rp = rpBase();
    (rp.contact as Record<string, unknown>).person = "x";
    expect(validateRpApplication(rp).problems.join()).toMatch(/bilinmeyen alan: contact.person/);
  });
  it("örnek kimlik numarası uyarı, bozuk biçim sorun", () => {
    expect(validateIssuerApplication(read("issuer-application.example.json")).warnings.join()).toMatch(/örnek değer/);
    const bad = { ...issuerBase(), identifiers: [{ scheme: "TR-VKN", value: "TR12345" }] };
    expect(validateIssuerApplication(bad).problems.join()).toMatch(/TR \+ 10 hane/);
  });
  it("https olmayan destek adresi ve sunulamayan tür (PS3)", () => {
    const app = issuerBase();
    app.contact = { support_uri: "http://example.edu.tr" };
    expect(validateIssuerApplication(app).problems.join()).toMatch(/support_uri: https/);
    const rp = rpBase();
    (rp.scopes as Record<string, unknown>[])[0].vct = "urn:tamga:id:PseudonymSeed:1";
    const p = validateRpApplication(rp).problems.join();
    expect(p).toMatch(/PS3/);
  });
  it("PUB sınıfı karar uyarısı", () => {
    expect(validateIssuerApplication({ ...issuerBase(), class: "PUB" }).warnings.join()).toMatch(/proje yönetimi/);
  });
  it("tür tespiti", () => {
    expect(applicationKind(issuerBase())).toBe("issuer");
    expect(applicationKind(rpBase())).toBe("rp");
    expect(validateApplication({}).problems.join()).toMatch(/anlaşılamadı/);
  });
});

describe("yardımcılar", () => {
  it("VKN sağlaması", () => {
    expect(vknChecksumOk("1234567890")).toBe(true);
    expect(vknChecksumOk("1234567891")).toBe(false);
    expect(vknChecksumOk("123")).toBe(false);
  });
  it("organizationIdentifier (ADR-0050)", () => {
    expect(organizationIdentifier({ scheme: "TR-VKN", value: "TR1234567890" })).toBe("VATTR-1234567890");
    expect(organizationIdentifier({ scheme: "TR-MERSIS", value: "TR0123456789012345" })).toBe("NTRTR-0123456789012345");
    expect(organizationIdentifier({ scheme: "TR-VKN", value: "1234567890" })).toBeNull();
  });
  it("ISCED-F 2013 biçimi", () => {
    expect(iscedFOk("0613")).toBe(true);
    expect(iscedFOk("1015")).toBe(true);
    expect(iscedFOk("9999")).toBe(true);
    expect(iscedFOk("1234")).toBe(false);
    expect(iscedFOk("613")).toBe(false);
    expect(iscedFOk(613)).toBe(false);
  });
});
