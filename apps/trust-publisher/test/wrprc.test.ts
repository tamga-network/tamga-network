/** ADR-0026: kayıt sertifikası içerikleri yalnız listedeki kayıttan; ≤ 12 ay; kimlik numarası yoksa üretilmez. */
import { describe, it, expect } from "vitest";
import { ENTITLEMENT_URI, buildWrprcPayloads, semanticIdentifier } from "../src/wrprc.js";

const now = new Date("2026-10-01T00:00:00Z");
const nowSec = Math.floor(now.getTime() / 1000);
const reg = {
  identifiers: [{ scheme: "TR-VKN", value: "TR1234567890" }],
  postal_address: { street_address: "Örnek Cad. 1", country: "TR" },
  contact: { support_uri: "https://shop.example/help" },
  supervisory_authority: { name: "KVKK", country: "TR", email: "dpa@example.org" },
};
const rp = {
  rp_id: "0xrp",
  client_id: `x509_hash:${"S".repeat(43)}`,
  dns_name: "shop.example",
  legal_name: "Shop A.Ş.",
  trade_name: "Shop",
  status: "ACTIVE",
  is_public_sector_body: false,
  entitlements: ["service_provider"],
  scopes: [
    {
      scope_id: "discount-1",
      purpose: "Student discount",
      purpose_localized: { "tr-TR": "Öğrenci indirimi" },
      vct: "urn:tamga:edu:StudentCredential:1",
      claims: ["is_enrolled"],
      privacy_policy_uri: "https://shop.example/privacy",
      valid_from: "2026-09-01T00:00:00Z",
      valid_until: "2026-12-01T00:00:00Z",
    },
    {
      scope_id: "old-1",
      purpose: "Expired",
      vct: "urn:tamga:edu:StudentCredential:1",
      claims: [],
      valid_from: "2025-01-01T00:00:00Z",
      valid_until: "2026-01-01T00:00:00Z",
    },
  ],
  ...reg,
};
const issuer = {
  slug: "uni",
  legal_name: "Üniversite",
  status: "ACTIVE",
  valid_until: "2030-01-01T00:00:00Z",
  entitlements: ["non_q_eaa_provider"],
  schema_authorizations: [
    { vct: "urn:tamga:edu:StudentCredential:1", allowed: true, valid_from: "2026-01-01T00:00:00Z", valid_until: null },
    {
      vct: "urn:tamga:edu:DiplomaCredential:1",
      allowed: true,
      valid_from: "2026-01-01T00:00:00Z",
      valid_until: "2026-09-01T00:00:00Z",
    },
  ],
  ...reg,
  identifiers: [{ scheme: "TR-MERSIS", value: "0123456789012345" }],
};

describe("kayıt sertifikası (ADR-0026)", () => {
  it("semantik tanımlayıcı: VKN → VATTR-, MERSİS → NTRTR-, yoksa null", () => {
    expect(semanticIdentifier([{ scheme: "TR-VKN", value: "TR1234567890" }])).toBe("VATTR-1234567890");
    expect(semanticIdentifier([{ scheme: "TR-MERSIS", value: "0123" }])).toBe("NTRTR-0123");
    expect(semanticIdentifier([])).toBeNull();
    expect(semanticIdentifier(undefined)).toBeNull();
  });

  it("doğrulayıcı: yalnız geçerli kullanım; alanlar standarttaki adlarla; exp kullanım bitişiyle sınırlı", () => {
    const { items } = buildWrprcPayloads(
      { relying_parties: [rp], issuers: [] },
      { now, registryUri: "https://t/tl.jws" },
    );
    expect(items).toHaveLength(1);
    const p = items[0].payload;
    expect(items[0].path).toBe("wrprc/rp/0xrp/discount-1.jwt");
    expect(p).toMatchObject({
      name: "Shop",
      sub_ln: "Shop A.Ş.",
      sub: "VATTR-1234567890",
      country: "TR",
      registry_uri: "https://t/tl.jws",
      entitlements: [ENTITLEMENT_URI.service_provider],
      privacy_policy: "https://shop.example/privacy",
      intended_use_id: "discount-1",
      public_body: false,
      supervisory_authority: { email: "dpa@example.org" },
      credentials: [
        {
          format: "dc+sd-jwt",
          meta: { vct_values: ["urn:tamga:edu:StudentCredential:1"] },
          claim: [{ path: ["is_enrolled"] }],
        },
      ],
      iat: nowSec,
      exp: Math.floor(new Date("2026-12-01T00:00:00Z").getTime() / 1000),
    });
    expect(p.purpose).toEqual([
      { lang: "en", value: "Student discount" },
      { lang: "tr-TR", value: "Öğrenci indirimi" },
    ]);
  });

  it("süre en çok 12 ay (WRC3)", () => {
    const long = { ...rp, scopes: [{ ...rp.scopes[0], valid_until: null }] };
    const { items } = buildWrprcPayloads({ relying_parties: [long], issuers: [] }, { now, registryUri: "u" });
    expect(items[0].payload.exp - nowSec).toBe(365 * 86400);
  });

  it("belge veren: yalnız geçerli yetkiler provides_attestations'ta, claim yok", () => {
    const { items } = buildWrprcPayloads({ relying_parties: [], issuers: [issuer] }, { now, registryUri: "u" });
    expect(items[0].path).toBe("wrprc/issuer/uni.jwt");
    expect(items[0].payload.sub).toBe("NTRTR-0123456789012345");
    expect(items[0].payload.provides_attestations).toEqual([
      { format: "dc+sd-jwt", meta: { vct_values: ["urn:tamga:edu:StudentCredential:1"] } },
    ]);
    expect(items[0].payload.entitlements).toEqual([ENTITLEMENT_URI.non_q_eaa_provider]);
  });

  it("kimlik numarası yok ya da kayıt etkin değil → üretilmez", () => {
    const { items, skipped } = buildWrprcPayloads(
      {
        relying_parties: [
          { ...rp, identifiers: [] },
          { ...rp, dns_name: "x.example", status: "SUSPENDED" },
        ],
        issuers: [],
      },
      { now, registryUri: "u" },
    );
    expect(items).toEqual([]);
    expect(skipped).toEqual(["relying_party shop.example: kimlik numarası yok (identifiers)"]);
  });

  it("aracı üzerinden: intermediary {sub, sname}", () => {
    const hub = {
      ...rp,
      client_id: `x509_hash:${"H".repeat(43)}`,
      dns_name: "verify.example",
      trade_name: "Hub",
      identifiers: [{ scheme: "TR-VKN", value: "9" }],
    };
    const { items } = buildWrprcPayloads(
      { relying_parties: [{ ...rp, uses_intermediaries: [hub.dns_name] }, hub], issuers: [] },
      { now, registryUri: "u" },
    );
    expect(items[0].payload.intermediary).toEqual({ sub: "VATTR-9", sname: "Hub" });
  });

  // 2026-10-09 sandbox gerilemesi: erişim sertifikasında organizationIdentifier yoktu → cüzdan bütün istekleri reddetti
  it("K3: erişim sertifikasının organizationIdentifier'ı sub'la aynı değilse üretilmez", () => {
    const run = (orgId: string | null) =>
      buildWrprcPayloads(
        { relying_parties: [rp], issuers: [] },
        { now, registryUri: "u", orgIdOf: (dns) => (dns === "shop.example" ? orgId : undefined) },
      );
    expect(run("VATTR-1234567890").items).toHaveLength(1);
    const none = run(null);
    expect(none.items).toEqual([]);
    expect(none.skipped[0]).toMatch(/organizationIdentifier yok, beklenen VATTR-1234567890/);
    expect(run("VATTR-9999999999").items).toEqual([]);
  });

  it("K3 aracılı: bağ aracının erişim sertifikasıyla (intermediary.sub)", () => {
    const hub = { ...rp, dns_name: "verify.example", identifiers: [{ scheme: "TR-VKN", value: "9" }], scopes: [] };
    const tl = { relying_parties: [{ ...rp, uses_intermediaries: [hub.dns_name] }, hub], issuers: [] };
    const ids: Record<string, string> = { "shop.example": "VATTR-1234567890", "verify.example": "VATTR-9" };
    expect(buildWrprcPayloads(tl, { now, registryUri: "u", orgIdOf: (d) => ids[d] }).items).toHaveLength(1);
    expect(
      buildWrprcPayloads(tl, { now, registryUri: "u", orgIdOf: (d) => (d === "shop.example" ? ids[d] : null) }).items,
    ).toEqual([]);
  });
});
