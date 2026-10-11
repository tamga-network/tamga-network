/** ADR-0046 K1 (EP1): gömülü açıklama politikası metadata'da değer olarak; yalnız kurum belgelerinde; bozuk politika yayınlanmaz. */
import { describe, it, expect } from "vitest";
import { issuerMetadata, disclosurePolicyDigest, EMBEDDED_DISCLOSURE_POLICY_MEMBER } from "./index.js";

const DIPLOMA = "urn:tamga:edu:DiplomaCredential:1";
const POLICY = {
  id: "https://issuer.example/policy/diploma-1",
  type: "authorized_relying_parties",
  relying_parties: [{ rp_id: "VATTR-1234567890", service_id: "hiring" }],
  info_uri: "https://issuer.example/policy/diploma",
};
const md = (vct: string, disclosurePolicy?: unknown) =>
  issuerMetadata({
    credentialIssuer: "https://issuer.example/x",
    authorizedVcts: [{ vct, name: "Diploma", display: [], disclosurePolicy }],
  }) as unknown as {
    credential_configurations_supported: Record<string, { credential_metadata: Record<string, unknown> }>;
  };

describe("issuerMetadata + embedded_disclosure_policy (ADR-0046 K1)", () => {
  it("politika yapılandırmanın credential_metadata'sında, biçim denetiminden geçmiş hâliyle (uzantılar atılır)", () => {
    const m = md(DIPLOMA, { ...POLICY, x_ext: true });
    expect(
      m.credential_configurations_supported[DIPLOMA].credential_metadata[EMBEDDED_DISCLOSURE_POLICY_MEMBER],
    ).toEqual(POLICY);
  });
  it("politika yoksa üye yok", () => {
    expect(md(DIPLOMA).credential_configurations_supported[DIPLOMA].credential_metadata).not.toHaveProperty(
      EMBEDDED_DISCLOSURE_POLICY_MEMBER,
    );
  });
  it("kimlik ve iletişim belgelerinde politika yasak; bozuk politika metadata üretmez", () => {
    expect(() => md("urn:tamga:id:IdentityAttestation:1", POLICY)).toThrow(/institution credentials only/);
    expect(() => md("urn:tamga:contact:EmailAddress:1", POLICY)).toThrow(/institution credentials only/);
    expect(() => md(DIPLOMA, { id: "x", type: "authorized_relying_parties" })).toThrow(/invalid embedded disclosure/);
  });
  it("özet: politika değişince değişir (EP4)", () => {
    const a = disclosurePolicyDigest(POLICY as never);
    expect(a).not.toBe(
      disclosurePolicyDigest({ ...POLICY, relying_parties: [{ rp_id: "VATTR-1234567890" }] } as never),
    );
  });
});
