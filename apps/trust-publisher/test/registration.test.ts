/** ADR-0024 K5: yeni kayıtta eksik zorunlu alan → hata; eski kayıtta uyarı; tam kayıt temiz. */
import { describe, it, expect } from "vitest";
import { checkRegistrations, issuerEntitlements, pseudonymErrors, rpGaps } from "../src/registration.js";

const fullRp = {
  dns_name: "shop.example",
  registered_at: "2026-10-01T00:00:00Z",
  trade_name: "Shop",
  identifiers: [{ scheme: "TR-VKN", value: "TR1234567890" }],
  postal_address: { street_address: "Örnek Cad. 1", country: "TR" },
  contact: { support_uri: "https://shop.example/help" },
  service_description: { "en-US": "Online shop" },
  is_public_sector_body: false,
  entitlements: ["service_provider"],
  supervisory_authority: { name: "KVKK", country: "TR", form_uri: "https://dpa.example/form" },
  scopes: [{ scope_id: "age-1", privacy_policy_uri: "https://shop.example/privacy" }],
};

describe("katılımcı kayıt verisi (ADR-0024)", () => {
  it("tam kayıt temiz", () => {
    expect(rpGaps(fullRp)).toEqual([]);
    expect(checkRegistrations([fullRp], [])).toEqual({ errors: [], warnings: [] });
  });
  it("yeni kayıtta eksik alan hata, eski kayıtta uyarı", () => {
    const missing = {
      ...fullRp,
      scopes: [{ scope_id: "age-1" }],
      supervisory_authority: { name: "KVKK", country: "TR" },
    };
    expect(rpGaps(missing)).toEqual(["supervisory_authority", "scopes[age-1].privacy_policy_uri"]);
    expect(checkRegistrations([missing], []).errors).toHaveLength(1);
    const old = { ...missing, registered_at: "2026-09-24T00:00:00Z" };
    const r = checkRegistrations([old], []);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
  });
  it("ADR-0031 PS3: takma ad tohumu hiçbir kapsamda olamaz (eski kayıtta da yayın durur); pseudonyms değeri denetlenir", () => {
    const leak = {
      ...fullRp,
      registered_at: "2026-09-24T00:00:00Z",
      scopes: [
        { scope_id: "seed-1", vct: "urn:tamga:id:PseudonymSeed:1", privacy_policy_uri: "https://shop.example/p" },
      ],
    };
    expect(pseudonymErrors(leak)).toHaveLength(1);
    expect(checkRegistrations([leak], []).errors.join()).toMatch(/non-presentable/);
    expect(pseudonymErrors({ ...fullRp, pseudonyms: "many" })).toHaveLength(1);
    expect(pseudonymErrors({ ...fullRp, pseudonyms: "multiple" })).toEqual([]);
  });
  it("belge veren için yetki türü sınıftan", () => {
    expect(issuerEntitlements("EAA")).toEqual(["non_q_eaa_provider"]);
    expect(issuerEntitlements("PUB")).toEqual(["pub_eaa_provider"]);
  });
});
