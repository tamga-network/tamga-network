/** ADR-0039 cüzdan yardımcıları: tür ilanı, PAR için kimlik sunumu (yalnız 3 alan, aud/nonce), ret nedenleri, sınıf dizisi. */
import { describe, it, expect } from "vitest";
import { sha256 } from "@noble/hashes/sha2.js";
import { b64u, b64uToUtf8, utf8 } from "./b64.js";
import { MemoryKeyStore, SoftwareKeyProvider } from "./keys.js";
import { decodeJwt } from "./jws.js";
import { decodeDisclosure, splitCombined } from "./sdjwt.js";
import {
  DRIVING_IDENTITY_CLAIMS,
  drivingDenyReason,
  drivingOffered,
  drivingPrivilegesOf,
  identityPresentationForIssuer,
} from "./driving.js";
import { DRIVING_LICENCE_VCT, IDENTITY_VCT } from "./directory.js";
import type { IssuerMetadata } from "./oid4vci.js";
import type { StoredCredential } from "./store.js";
import type { Http } from "./http.js";

const ID = "https://id.example";
const md = (types: Record<string, { format: string }>): IssuerMetadata => ({
  credential_issuer: ID,
  credential_endpoint: `${ID}/credential`,
  credential_configurations_supported: types,
});

/** İmzasız ama yapısal olarak geçerli SD-JWT: presentSdJwt imza doğrulamaz, disclosure seçer ve KB-JWT imzalar. */
function fakeIdentitySdJwt(claims: Record<string, unknown>) {
  const disclosures = Object.entries(claims).map(([k, v]) =>
    b64u(utf8(JSON.stringify([b64u(new Uint8Array(16).fill(7)), k, v]))),
  );
  const payload = {
    iss: ID,
    vct: IDENTITY_VCT,
    _sd_alg: "sha-256",
    _sd: disclosures.map((d) => b64u(sha256(utf8(d)))),
  };
  const jwt = `${b64u(utf8(JSON.stringify({ alg: "ES256", typ: "dc+sd-jwt" })))}.${b64u(utf8(JSON.stringify(payload)))}.sig`;
  return [jwt, ...disclosures, ""].join("~");
}
const identity = (combined: string, keyRef: string): StoredCredential => ({
  id: "id-1",
  vct: IDENTITY_VCT,
  typeName: "Identity",
  issuer: ID,
  issuerId: "0x1",
  leafFingerprint: "ff",
  iat: 1,
  claims: {},
  disclosureNames: ["given_name", "family_name", "birthdate", "nationalities", "personal_administrative_number"],
  copies: [{ combined, keyRef, cnf: { kty: "EC", crv: "P-256", x: "", y: "" }, usedBy: [] }],
  receivedAt: 1,
});

describe("drivingOffered", () => {
  it("yalnız metadata türü dc+sd-jwt olarak ilan ederse", () => {
    expect(drivingOffered(md({ [DRIVING_LICENCE_VCT]: { format: "dc+sd-jwt" } }))).toBe(true);
    expect(drivingOffered(md({ [IDENTITY_VCT]: { format: "dc+sd-jwt" } }))).toBe(false);
    expect(drivingOffered(md({ [DRIVING_LICENCE_VCT]: { format: "mso_mdoc" } }))).toBe(false);
  });
});

describe("identityPresentationForIssuer", () => {
  it("nonce alır; yalnız ad, soyad, doğum tarihini açar; KB-JWT aud = servis, nonce = servisin verdiği", async () => {
    const keys = new SoftwareKeyProvider(new MemoryKeyStore());
    await keys.generate("k0");
    const calls: string[] = [];
    const http: Http = async (url) => {
      calls.push(url);
      return { status: 200, text: async () => JSON.stringify({ c_nonce: "n-123" }) };
    };
    const combined = fakeIdentitySdJwt({
      given_name: "Ad",
      family_name: "Soyad",
      birthdate: "2000-01-01",
      nationalities: ["TR"],
      personal_administrative_number: "12345678901",
    });
    const vp = await identityPresentationForIssuer({
      issuer: `${ID}/`,
      identity: identity(combined, "k0"),
      keys,
      http,
    });
    expect(calls).toEqual([`${ID}/nonce`]);
    const parts = splitCombined(vp);
    const names = parts.disclosures.map((d) => decodeDisclosure(d).name).sort();
    expect(names).toEqual([...DRIVING_IDENTITY_CLAIMS].sort());
    const kb = decodeJwt(parts.kb);
    expect(kb.header.typ).toBe("kb+jwt");
    expect(kb.payload.aud).toBe(ID);
    expect(kb.payload.nonce).toBe("n-123");
    expect(typeof kb.payload.sd_hash).toBe("string");
    // kimlik numarası sunumda yok (IDP10)
    expect(vp).not.toContain(b64u(utf8("12345678901")).slice(0, 8));
    expect(b64uToUtf8(parts.jwt.split(".")[1])).toContain(IDENTITY_VCT);
  });
  it("kimlik belgesi yoksa, iptal edilmişse ya da başka servistense sunum üretmez", async () => {
    const keys = new SoftwareKeyProvider(new MemoryKeyStore());
    const http: Http = async () => {
      throw new Error("should not be called");
    };
    await expect(identityPresentationForIssuer({ issuer: ID, identity: undefined, keys, http })).rejects.toThrow(
      /identity credential is required/,
    );
    const c = identity(fakeIdentitySdJwt({ given_name: "A" }), "k0");
    await expect(
      identityPresentationForIssuer({ issuer: ID, identity: { ...c, revokedLocally: true }, keys, http }),
    ).rejects.toThrow(/identity credential is required/);
    await expect(
      identityPresentationForIssuer({ issuer: ID, identity: { ...c, issuer: "https://other.example" }, keys, http }),
    ).rejects.toThrow(/another identity service/);
  });
  it("nonce alınamazsa issuer_error", async () => {
    const keys = new SoftwareKeyProvider(new MemoryKeyStore());
    await keys.generate("k0");
    const http: Http = async () => ({ status: 503, text: async () => "" });
    const c = identity(fakeIdentitySdJwt({ given_name: "A", family_name: "B", birthdate: "2000-01-01" }), "k0");
    await expect(identityPresentationForIssuer({ issuer: ID, identity: c, keys, http })).rejects.toThrow(/nonce/);
  });
});

describe("drivingDenyReason", () => {
  it("servisin açıklamalarını neden koduna çevirir", () => {
    const cases: Array<[string, string]> = [
      ["the document shown is not a readable driving licence", "not_driving_licence"],
      ["the driving licence has expired", "expired"],
      ["the driving licence categories could not be read; the credential is not issued", "categories_unreadable"],
      ["all driving licence categories on the card have expired", "categories_expired"],
      ["the name on the card could not be read", "name_unreadable"],
      ["the card does not match the identity credential in the wallet", "identity_mismatch"],
      ["the identity credential in the wallet is no longer active", "identity_inactive"],
      ["the identity credential is not active", "identity_inactive"],
      ["PAR reddedildi: identity_presentation required (SD-JWT VC + KB-JWT ...)", "identity_inactive"],
      ["nonce unknown or expired", "identity_inactive"],
      ["manual review required; please try again later", "review"],
      ["consent not given", "consent"],
      ["identity verification failed (DECLINED)", "verification_failed"],
    ];
    for (const [d, r] of cases) expect(drivingDenyReason(d), d).toBe(r);
    expect(drivingDenyReason("something else")).toBeUndefined();
    expect(drivingDenyReason(undefined)).toBeUndefined();
  });
});

describe("drivingPrivilegesOf", () => {
  it("geçerli öğeleri alır, bozukları atar, kategoriye göre sıralar", () => {
    expect(
      drivingPrivilegesOf({
        driving_privileges: [
          { category: "B", issue_date: "2020-01-02", expiry_date: "2030-01-02" },
          { category: "A2", expiry_date: "bad" },
          { category: "lower" },
          "x",
          null,
        ],
      }),
    ).toEqual([{ category: "A2" }, { category: "B", issue_date: "2020-01-02", expiry_date: "2030-01-02" }]);
    expect(drivingPrivilegesOf({})).toEqual([]);
    expect(drivingPrivilegesOf(undefined)).toEqual([]);
  });
});
