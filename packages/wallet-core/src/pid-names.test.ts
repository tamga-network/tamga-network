/**
 * ADR-0045 — kimlik belgesinin AB PID adları: SD-JWT VC `birthdate` / `nationalities[]`, mdoc `birth_date` (full-date) /
 * `nationality` (dizi). Cüzdan mdoc sorgusunu belgenin SD-JWT claim'leriyle eşler (MD1), kapsam denetimi SD-JWT adlarıyla.
 */
import { describe, expect, it } from "vitest";
import { matchDcql, matchClaimValue, checkRp, type RpRecord, type StoredCredential } from "./index.js";

const VCT = "urn:tamga:id:IdentityAttestation:1";
const NS = "tamga.id.1";
const identity: StoredCredential = {
  id: "id1",
  vct: VCT,
  typeName: "Kimlik",
  issuer: "i",
  issuerId: "0x1",
  leafFingerprint: "f",
  iat: 1,
  claims: { given_name: "Ayşe", birthdate: "2002-05-14", nationalities: ["TR"], age_over_18: true },
  disclosureNames: ["given_name", "birthdate", "nationalities", "nationalities[0]", "age_over_18"],
  copies: [{ keyRef: "k", cnf: { kty: "EC", crv: "P-256", x: "", y: "" }, combined: "", usedBy: [], mdoc: "x" }],
  receivedAt: 1,
};

describe("ADR-0045 — mdoc öğesi ↔ SD-JWT claim adı", () => {
  it("mdoc sorgusu `birth_date` ve `nationality` öğelerini belgenin `birthdate` / `nationalities` claim'leriyle karşılar", () => {
    const r = matchDcql(
      {
        credentials: [
          {
            id: "m",
            format: "mso_mdoc",
            meta: { doctype_value: VCT },
            claims: [{ path: [NS, "birth_date"] }, { path: [NS, "nationality"], values: [["TR"]] }],
          },
        ],
      },
      [identity],
    );
    expect(r.unmatched).toEqual([]);
    expect(r.matches[0].requested).toEqual(["birth_date", "nationality"]);
    // onay ekranında gösterilecek değerler belgenin SD-JWT claim'lerinden
    expect(matchClaimValue(r.matches[0], "birth_date")).toBe("2002-05-14");
    expect(matchClaimValue(r.matches[0], "nationality")).toEqual(["TR"]);
  });
  it("SD-JWT sorgusu yeni adlarla; eski `birth_date` adı SD-JWT'de artık yok (missing_claims)", () => {
    const sd = (path: string[]) => ({ id: "s", format: "dc+sd-jwt", meta: { vct_values: [VCT] }, claims: [{ path }] });
    expect(matchDcql({ credentials: [sd(["birthdate"])] }, [identity]).unmatched).toEqual([]);
    const old = matchDcql({ credentials: [sd(["birth_date"])] }, [identity]);
    expect(old.gaps[0]).toMatchObject({ reason: "missing_claims", claims: ["birth_date"] });
  });
  it("kapsam denetimi: RP kaydı SD-JWT adıyla (`birthdate`); mdoc isteğindeki `birth_date` kapsam içinde sayılır", () => {
    const rp: RpRecord = {
      client_id: `x509_hash:${"A".repeat(43)}`,
      dns_name: "verify.example",
      legal_name: "V",
      status: "ACTIVE",
      access_cert_fingerprint_sha256: "ab",
      scopes: [
        {
          scope_id: "s",
          purpose: "p",
          vct: VCT,
          claims: ["birthdate"],
          valid_from: "2026-01-01T00:00:00Z",
          valid_until: null,
        },
      ],
    };
    const req = { leafFingerprint: "ab" } as never;
    const mdoc = {
      queryId: "m",
      credential: identity,
      requested: ["birth_date", "given_name"],
      format: "mso_mdoc" as const,
    };
    expect(checkRp(rp, req, mdoc).overAsk).toEqual(["given_name"]);
    const sdjwt = { queryId: "s", credential: identity, requested: ["birthdate"] };
    expect(checkRp(rp, req, sdjwt).overAsk).toEqual([]);
  });
});
