import { describe, expect, it } from "vitest";
import { toDirectoryEntry, type RawIssuer } from "./directory.js";

const base: RawIssuer = {
  slug: "ornek",
  legal_name: "Örnek Üniversitesi",
  category: "EDUCATION",
  class: "EAA",
  assurance: "I2",
  issuer_url: "https://issuer.tamga.network/ornek",
  issuer_id: "0x" + "ab".repeat(32),
  status: "ACTIVE",
  schema_authorizations: [
    { vct: "urn:tamga:edu:StudentCredential:1", allowed: true, valid_from: "2026-01-01T00:00:00Z", valid_until: null },
    { vct: "urn:tamga:edu:DiplomaCredential:1", allowed: false, valid_from: "2026-01-01T00:00:00Z", valid_until: null },
  ],
};
const NOW = Date.parse("2026-10-12T00:00:00Z");

describe("kurum dizini girdisi", () => {
  it("ADR-0047 K2: revocation_policy_uri ve info_uri https ise girdiye taşınır", () => {
    const e = toDirectoryEntry(
      { ...base, info_uri: "https://ornek.edu.tr", revocation_policy_uri: "https://ornek.edu.tr/iptal" },
      NOW,
    );
    expect(e.revocationPolicyUri).toBe("https://ornek.edu.tr/iptal");
    expect(e.infoUri).toBe("https://ornek.edu.tr");
    expect(e.vcts).toEqual(["urn:tamga:edu:StudentCredential:1"]);
  });

  it("https olmayan bağlantı gösterilmez", () => {
    const e = toDirectoryEntry({ ...base, revocation_policy_uri: "javascript:alert(1)", info_uri: "http://x" }, NOW);
    expect(e.revocationPolicyUri).toBeUndefined();
    expect(e.infoUri).toBeUndefined();
  });
});
