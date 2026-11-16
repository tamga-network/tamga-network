/** ADR-0089 — kimlik belgesi yenilemesinin zamanlaması ve mdoc yapılandırması keşfi (saf işlevler; uçtan uca test operatör deposunda). */
import { describe, it, expect } from "vitest";
import { identityRenewable, identityRenewalDue, scheduleIdentityRenewals } from "./identity-renewal.js";
import { mdocCompanionConfigId, type IssuerMetadata } from "./oid4vci.js";
import { IDENTITY_VCT } from "./directory.js";
import { newState, type StoredCredential } from "./store.js";

const now = 1_800_000_000;
const DAY = 86400;
const jwk = { kty: "EC", crv: "P-256", x: "x", y: "y" } as const;
const cred = (extra: Partial<StoredCredential> = {}): StoredCredential => ({
  id: "c1",
  vct: IDENTITY_VCT,
  typeName: "Kimlik",
  issuer: "https://id.example",
  issuerId: "0x1",
  leafFingerprint: "aa",
  iat: now - DAY,
  exp: now + 20 * DAY,
  claims: { date_of_expiry: "2030-01-01" },
  disclosureNames: [],
  copies: Array.from({ length: 10 }, (_, i) => ({ keyRef: `k${i}`, cnf: jwk, combined: "x", usedBy: [] })),
  receivedAt: now - DAY,
  refresh: { token: "t", tokenEndpoint: "https://id.example/token", dpopRef: "d", dpopJwk: jwk },
  ...extra,
});

describe("ADR-0089 K4: kimlik belgesi yenileme zamanı", () => {
  it("eşikler: 2 kullanılmamış kopya ya da teknik bitişe 7 gün; idari bitiş ve iptal yenilemeyi kapatır", () => {
    expect(identityRenewalDue(cred(), now)).toBe(false);
    expect(identityRenewalDue(cred({ exp: now + 6 * DAY }), now)).toBe(true);
    expect(identityRenewalDue(cred({ exp: now - DAY }), now)).toBe(true); // süresi dolmuş kopyalar da yenilenir
    const used = cred({ copies: cred().copies.map((k, i) => (i < 8 ? { ...k, usedBy: ["rp"] } : k)) });
    expect(identityRenewalDue(used, now)).toBe(true);
    expect(identityRenewable(cred({ claims: { date_of_expiry: "2020-01-01" } }), now)).toBe(false);
    expect(identityRenewable(cred({ revokedLocally: true }), now)).toBe(false);
    expect(identityRenewable(cred({ refresh: undefined }), now)).toBe(false);
    expect(identityRenewable(cred({ vct: "urn:tamga:edu:StudentCard:1" }), now)).toBe(false);
  });

  it("rastgele gecikme teknik bitişten önce biter; zamanı gelenler döner", () => {
    const st = { ...newState("w"), credentials: [cred({ exp: now + 6 * DAY })] };
    const a = scheduleIdentityRenewals(st, now, () => 0.999);
    const due = a.state.credentials[0].renewDueAt!;
    expect(due).toBeGreaterThan(now);
    expect(due).toBeLessThanOrEqual(now + 6 * 3600);
    expect(a.due).toEqual([]);
    expect(scheduleIdentityRenewals(a.state, due).due).toEqual(["c1"]);
  });
});

describe("ADR-0089 K1: mdoc yapılandırması keşfi", () => {
  const md = (extra: IssuerMetadata["credential_configurations_supported"]): IssuerMetadata => ({
    credential_issuer: "https://id.example",
    credential_endpoint: "https://id.example/credential",
    credential_configurations_supported: {
      [IDENTITY_VCT]: { format: "dc+sd-jwt", vct: IDENTITY_VCT, scope: IDENTITY_VCT },
      ...extra,
    },
  });
  it("aynı doctype ve aynı kapsamlı mso_mdoc yapılandırması bulunur; ZK kopyası (başka doctype) bulunmaz", () => {
    expect(
      mdocCompanionConfigId(
        md({ "x:mdoc": { format: "mso_mdoc", doctype: IDENTITY_VCT, scope: IDENTITY_VCT } }),
        IDENTITY_VCT,
      ),
    ).toBe("x:mdoc");
    expect(
      mdocCompanionConfigId(
        md({ zk: { format: "mso_mdoc", doctype: "urn:tamga:id:ShortLivedIdentityAttestation:1" } }),
        IDENTITY_VCT,
      ),
    ).toBeUndefined();
    // başka kapsamdaki yapılandırma aynı yetkiyle alınamaz
    expect(
      mdocCompanionConfigId(md({ other: { format: "mso_mdoc", doctype: IDENTITY_VCT, scope: "s" } }), IDENTITY_VCT),
    ).toBeUndefined();
  });
});
