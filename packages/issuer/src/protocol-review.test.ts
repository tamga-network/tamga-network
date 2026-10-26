/**
 * Protokol incelemesi düzeltmeleri (SPEC-PROTO-0001 §2, §13; ADR-0059 notu): AS metadata'da ön yetkili akış seçimi, belge verenin
 * görünümü güven listesinden, token hata kodları standart, PR6 istek başına anahtar ayrımı, 401 `WWW-Authenticate: DPoP`.
 */
import { describe, expect, it } from "vitest";
import {
  PRE_AUTH_GRANT,
  authServerMetadata,
  distinctCnfKeys,
  dpopChallenge,
  issuerDisplayFrom,
  issuerMetadata,
  tokenErrorResponse,
} from "./index.js";

describe("AS metadata: ön yetkili akış", () => {
  it("varsayılan (kurum): pre-authorized grant, anonim erişim bayrağı ve `none` yöntemi ilan edilir", () => {
    const m = authServerMetadata("https://issuer.example/x", { authorizationCode: true, refreshToken: true });
    expect(m.grant_types_supported).toEqual([PRE_AUTH_GRANT, "authorization_code", "refresh_token"]);
    expect(m["pre-authorized_grant_anonymous_access_supported"]).toBe(true);
    expect(m.token_endpoint_auth_methods_supported).toEqual(["none", "attest_jwt_client_auth"]);
  });
  it("preAuthorized: false (kimlik servisi, IDP7): grant yok, anonim erişim bayrağı yok, yalnız attest_jwt_client_auth", () => {
    const m = authServerMetadata("https://id.example", {
      authorizationCode: true,
      refreshToken: true,
      preAuthorized: false,
    });
    expect(m.grant_types_supported).toEqual(["authorization_code", "refresh_token"]);
    expect("pre-authorized_grant_anonymous_access_supported" in m).toBe(false);
    expect(m.token_endpoint_auth_methods_supported).toEqual(["attest_jwt_client_auth"]);
    const noAuthz = authServerMetadata("https://id.example", { preAuthorized: false });
    expect(noAuthz.grant_types_supported).toEqual([]);
    expect(noAuthz.token_endpoint_auth_methods_supported).toEqual(["attest_jwt_client_auth"]);
  });
});

describe("belge verenin görünümü (OpenID4VCI §12.2.4 display)", () => {
  it("issuerDisplayFrom: kayıtlı ad yerelsiz; hizmet açıklaması dilleri kendi locale'iyle; BCP 47 olmayan anahtar atlanır", () => {
    expect(
      issuerDisplayFrom({
        legalName: "Örnek Üniversitesi",
        serviceDescription: { tr: "Diploma ve öğrenci belgesi", "en-US": "Diplomas and student cards", "x y": "bozuk" },
        names: { "en-US": "Example University" },
      }),
    ).toEqual([
      { name: "Örnek Üniversitesi" },
      { name: "Örnek Üniversitesi", locale: "tr", description: "Diploma ve öğrenci belgesi" },
      { name: "Example University", locale: "en-US", description: "Diplomas and student cards" },
    ]);
  });
  it("issuerMetadata: display verilen görünümdür; verilmezse belge türünün adı ve sabit tr-TR YAZILMAZ", () => {
    const vcts = [{ vct: "urn:tamga:edu:StudentCredential:1", name: "Öğrenci Belgesi", display: [] }];
    const given = issuerMetadata({
      credentialIssuer: "https://issuer.example/x",
      authorizedVcts: vcts,
      issuerDisplay: issuerDisplayFrom({ legalName: "Kurum A.Ş." }),
    }) as { display: Array<{ name: string; locale?: string }> };
    expect(given.display).toEqual([{ name: "Kurum A.Ş." }]);
    const fallback = issuerMetadata({ credentialIssuer: "https://issuer.example/x", authorizedVcts: vcts }) as {
      display: Array<{ name: string; locale?: string }>;
    };
    expect(fallback.display[0].name).not.toBe("Öğrenci Belgesi");
    expect(fallback.display[0].locale).toBeUndefined();
  });
});

describe("hata kodları ve 401", () => {
  it("tokenErrorResponse: teklif / PIN nedenleri invalid_grant, eksik tx_code invalid_request; neden error_description'da", () => {
    expect(tokenErrorResponse("offer_used")).toEqual({ error: "invalid_grant", error_description: "offer_used" });
    expect(tokenErrorResponse("offer_expired")).toEqual({ error: "invalid_grant", error_description: "offer_expired" });
    expect(tokenErrorResponse("tx_code_mismatch").error).toBe("invalid_grant");
    expect(tokenErrorResponse("too_many_attempts").error).toBe("invalid_grant");
    expect(tokenErrorResponse("invalid_grant").error).toBe("invalid_grant");
    expect(tokenErrorResponse("invalid_request")).toEqual({
      error: "invalid_request",
      error_description: "invalid_request",
    });
  });
  it("distinctCnfKeys (PR6, istek başına): aynı anahtar iki kez → false", () => {
    const a = { x: "ax", y: "ay" };
    const b = { x: "bx", y: "by" };
    expect(distinctCnfKeys([a, b])).toBe(true);
    expect(distinctCnfKeys([a, b, { ...a }])).toBe(false);
    expect(distinctCnfKeys([])).toBe(true);
  });
  it("dpopChallenge (RFC 9449 §7.1): DPoP şeması, error, algs=ES256; açıklamadaki tırnak ve satır sonu temizlenir", () => {
    expect(dpopChallenge("invalid_token")).toBe('DPoP error="invalid_token", algs="ES256"');
    expect(dpopChallenge("invalid_dpop_proof", 'bad "x"\nproof')).toBe(
      'DPoP error="invalid_dpop_proof", error_description="bad  x  proof", algs="ES256"',
    );
  });
});
