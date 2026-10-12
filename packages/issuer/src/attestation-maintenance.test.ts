import { describe, expect, it } from "vitest";
import { capToRevocationMaintenance } from "./key-attestation.js";
import { issuerMetadata } from "./oid4vci.js";

describe("iptal bakım süresi (ISSU_12c, WUA_32; AB TS3 §2.4)", () => {
  it("bitiş WIA ve KA bakım süresinin en erken sonuyla sınırlanır; bilinmiyorsa değişmez", () => {
    expect(capToRevocationMaintenance(2_000, { wiaStatusExp: 1_500, kaStatusExp: 1_800 })).toBe(1_500);
    expect(capToRevocationMaintenance(1_000, { wiaStatusExp: 1_500 })).toBe(1_000);
    expect(capToRevocationMaintenance(2_000, {})).toBe(2_000);
  });

  it("metadata tercihleri ilan eder: preferred_client_status_period üstte, KA tercihi key_attestations_required içinde", () => {
    const md = issuerMetadata({
      credentialIssuer: "https://issuer.example/id",
      authorizedVcts: [{ vct: "urn:tamga:id:IdentityAttestation:1", name: "Kimlik", display: [] }],
      keyAttestationsRequired: {
        key_storage: ["iso_18045_moderate"],
        user_authentication: ["iso_18045_moderate"],
        preferred_key_storage_status_period: 730 * 86400,
      },
      preferredClientStatusPeriod: 730 * 86400,
    }) as Record<string, unknown> & {
      credential_configurations_supported: Record<string, { proof_types_supported: { jwt: Record<string, unknown> } }>;
    };
    expect(md.preferred_client_status_period).toBe(730 * 86400);
    const kar = md.credential_configurations_supported["urn:tamga:id:IdentityAttestation:1"].proof_types_supported.jwt
      .key_attestations_required as Record<string, unknown>;
    expect(kar.preferred_key_storage_status_period).toBe(730 * 86400);
    const plain = issuerMetadata({ credentialIssuer: "https://i", authorizedVcts: [] }) as Record<string, unknown>;
    expect(plain.preferred_client_status_period).toBeUndefined();
  });
});
