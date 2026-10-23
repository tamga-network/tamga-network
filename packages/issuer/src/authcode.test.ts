/** SPEC-PROTO-0001 §12 — PAR + PKCE + tek kullanımlık code (cüzdan-başlatmalı ihraç). */
import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { callbackUrl, checkParParams, createPar, errorCallbackUrl, mintCode, redeemCode } from "./authcode.js";
import { epochSeconds } from "@tamga-network/core";

const verifier = "v".repeat(43);
const challenge = createHash("sha256").update(verifier, "ascii").digest("base64url");
const base = {
  clientId: "wua-sub",
  redirectUri: "tamga-wallet://cb",
  codeChallenge: challenge,
  authorizationDetails: [
    { type: "openid_credential", credential_configuration_id: "urn:tamga:id:IdentityAttestation:1" },
  ],
  now: epochSeconds(1000),
  allowedRedirectUris: ["tamga-wallet://cb"] as readonly string[],
};

describe("authcode", () => {
  it("checkParParams: yinelenen parametre, gövdede request_uri, code dışı response_type reddedilir (FAPI 2.0 / RFC 9126)", () => {
    expect(checkParParams({ response_type: "code", state: "s" })).toBeNull();
    expect(checkParParams({ response_type: "code", state: ["a", "b"] })).toMatchObject({ error: "invalid_request" });
    expect(checkParParams({ response_type: "code", request_uri: "urn:x" })).toMatchObject({ error: "invalid_request" });
    for (const rt of ["code id_token", "token", undefined])
      expect(checkParParams({ response_type: rt })).toMatchObject({ error: "unsupported_response_type" });
  });
  it("code_verifier yoksa invalid_grant ve kod yanar (OAuth 2.1 §4.1.3; FAPI2 ensure-pkce-code-verifier-required)", () => {
    const r = createPar(base);
    if (!r.ok) throw new Error("par");
    const code = mintCode(r.par, "subj", "T2", 1000);
    const req = { code, clientId: "wua-sub", redirectUri: base.redirectUri, now: epochSeconds(1001) };
    expect(redeemCode(r.par, req)).toMatchObject({ ok: false, error: "invalid_grant" });
    expect(redeemCode(r.par, { ...req, codeVerifier: verifier })).toMatchObject({
      ok: false,
      error: "invalid_grant",
      reused: true, // RFC 6749 §4.1.2: çağıran o koddan verilenleri geri alır
    });
  });
  it("ADR-0062: eşlik kapsamı yalnız izin listesindeyse ve birincil türle birlikte", () => {
    const b = { ...base, authorizationDetails: undefined };
    const ok = createPar({ ...b, scope: "urn:id:1 urn:zk:1", allowedCompanionScopes: ["urn:zk:1"] });
    expect(ok).toMatchObject({ ok: true, par: { vct: "urn:id:1", companionScopes: ["urn:zk:1"] } });
    expect(createPar({ ...b, scope: "urn:id:1 urn:zk:1" })).toMatchObject({ ok: false, error: "invalid_request" });
    expect(createPar({ ...b, scope: "urn:zk:1", allowedCompanionScopes: ["urn:zk:1"] })).toMatchObject({ ok: false });
    const single = createPar({ ...b, scope: "urn:id:1", allowedCompanionScopes: ["urn:zk:1"] });
    expect(single.ok && single.par.companionScopes).toBeUndefined();
  });
  it("plain PKCE → invalid_request (RFC 7636 §4.4.1)", () => {
    expect(createPar({ ...base, codeChallengeMethod: "plain" })).toMatchObject({ ok: false, error: "invalid_request" });
  });
  it("RFC 9449 §10: dpop_jkt ile PAR DPoP kanıtı farklıysa ret; bağlanan anahtar token isteğinde zorunlu", () => {
    const A = "A".repeat(43);
    const B = "B".repeat(43);
    expect(createPar({ ...base, dpopJkt: A, dpopProofJkt: B })).toMatchObject({
      ok: false,
      error: "invalid_dpop_proof",
    });
    expect(createPar({ ...base, dpopJkt: "kısa" })).toMatchObject({ ok: false, error: "invalid_request" });
    for (const inp of [{ dpopJkt: A }, { dpopProofJkt: A }, { dpopJkt: A, dpopProofJkt: A }]) {
      const r = createPar({ ...base, ...inp });
      if (!r.ok) throw new Error("par");
      expect(r.par.dpopJkt).toBe(A);
      const code = mintCode(r.par, "subj", "T2", 1000);
      const req = {
        code,
        codeVerifier: verifier,
        clientId: "wua-sub",
        redirectUri: base.redirectUri,
        now: epochSeconds(1001),
      };
      expect(redeemCode(r.par, { ...req, dpopJkt: B })).toMatchObject({ ok: false, error: "invalid_grant" });
      expect(redeemCode(r.par, { ...req })).toMatchObject({ ok: false, error: "invalid_grant" });
      expect(redeemCode(r.par, { ...req, dpopJkt: A }).ok).toBe(true);
    }
    // PAR'da DPoP yoksa token anahtarı serbest (ilk bağlama token ucunda)
    const r = createPar(base);
    if (!r.ok) throw new Error("par");
    expect(r.par.dpopJkt).toBeUndefined();
  });
  it("tehlikeli redirect_uri şemaları reddedilir (XSS)", () => {
    for (const u of ["javascript://x/%0aalert(1)", "data://text/html,x", "vbscript://x", "file:///etc"]) {
      const r = createPar({ ...base, redirectUri: u });
      expect(r.ok, u).toBe(false);
    }
    expect(createPar(base).ok).toBe(true);
  });
  it("kodu henüz basılmamış PAR, boş ya da eksik kodla kullanılamaz", () => {
    const r = createPar(base);
    if (!r.ok) throw new Error("par");
    for (const code of ["", undefined as unknown as string])
      expect(
        redeemCode(r.par, {
          code,
          codeVerifier: verifier,
          clientId: "wua-sub",
          redirectUri: base.redirectUri,
          now: epochSeconds(1001),
        }),
      ).toMatchObject({ ok: false, error: "invalid_grant", description: "code bilinmiyor" });
  });
  it("code tek kullanımlık; yanlış PKCE code'u yakar; farklı istemci reddedilir", () => {
    const r = createPar(base);
    if (!r.ok) throw new Error("par");
    const code = mintCode(r.par, "subj", "T2", 1000);
    expect(
      redeemCode(r.par, {
        code,
        codeVerifier: verifier,
        clientId: "başka",
        redirectUri: base.redirectUri,
        now: epochSeconds(1001),
      }).ok,
    ).toBe(false);
    expect(
      redeemCode(r.par, {
        code,
        codeVerifier: "y".repeat(43),
        clientId: "wua-sub",
        redirectUri: base.redirectUri,
        now: epochSeconds(1001),
      }).ok,
    ).toBe(false);
    expect(
      redeemCode(r.par, {
        code,
        codeVerifier: verifier,
        clientId: "wua-sub",
        redirectUri: base.redirectUri,
        now: epochSeconds(1001),
      }).ok,
    ).toBe(false); // yandı
    const r2 = createPar(base);
    if (!r2.ok) throw new Error("par");
    const c2 = mintCode(r2.par, "subj", "T2", 1000);
    expect(
      redeemCode(r2.par, {
        code: c2,
        codeVerifier: verifier,
        clientId: "wua-sub",
        redirectUri: base.redirectUri,
        now: epochSeconds(1001),
      }).ok,
    ).toBe(true);
    expect(
      redeemCode(r2.par, {
        code: c2,
        codeVerifier: verifier,
        clientId: "wua-sub",
        redirectUri: base.redirectUri,
        now: epochSeconds(1002),
      }).ok,
    ).toBe(false);
  });
  it("redirect_uri izin listesi zorunlu ve tam eşleşme (ADR-0056 K2); token isteğinde redirect_uri ve istemci zorunlu", () => {
    expect(createPar({ ...base, allowedRedirectUris: ["tamga-wallet://cb"] }).ok).toBe(true);
    expect(createPar({ ...base, allowedRedirectUris: ["tamga-wallet://other"] })).toMatchObject({
      ok: false,
      error: "invalid_redirect_uri",
    });
    const byClient = (c: string) => (c === "wua-sub" ? ["tamga-wallet://cb"] : []);
    expect(createPar({ ...base, allowedRedirectUris: byClient }).ok).toBe(true);
    expect(createPar({ ...base, clientId: "x", allowedRedirectUris: byClient }).ok).toBe(false);
    // ADR-0056 K2: istemcinin kaydı yoksa, liste boşsa ya da hiç verilmediyse (JavaScript çağıran) ret
    expect(createPar({ ...base, allowedRedirectUris: () => undefined })).toMatchObject({
      ok: false,
      error: "invalid_redirect_uri",
      description: "no redirect_uri is registered for this client",
    });
    expect(createPar({ ...base, allowedRedirectUris: [] }).ok).toBe(false);
    const { allowedRedirectUris: _a, ...noList } = base;
    expect(createPar(noList as unknown as Parameters<typeof createPar>[0]).ok).toBe(false);
    const r = createPar(base);
    if (!r.ok) throw new Error("par");
    const code = mintCode(r.par, "subj", "T2", 1000);
    expect(
      redeemCode(r.par, { code, codeVerifier: verifier, clientId: "wua-sub", now: epochSeconds(1001) }),
    ).toMatchObject({
      ok: false,
      description: expect.stringMatching(/redirect_uri/),
    });
    expect(
      redeemCode(r.par, {
        code,
        codeVerifier: verifier,
        clientId: "",
        redirectUri: base.redirectUri,
        now: epochSeconds(1001),
      }).ok,
    ).toBe(false);
    expect(
      redeemCode(r.par, {
        code,
        codeVerifier: verifier,
        clientId: "wua-sub",
        redirectUri: base.redirectUri,
        now: epochSeconds(1001),
      }).ok,
    ).toBe(true);
  });
  it("HAIP §4.3: tür scope ile istenebilir; scope ile authorization_details çelişirse ya da birden çok scope varsa ret", () => {
    const vct = "urn:tamga:id:IdentityAttestation:1";
    const { authorizationDetails: _ad, ...noAd } = base;
    const s = createPar({ ...noAd, scope: vct });
    expect(s.ok && s.par.vct).toBe(vct);
    expect(createPar({ ...base, scope: vct }).ok).toBe(true);
    expect(createPar({ ...base, scope: "urn:tamga:edu:Diploma:1" }).ok).toBe(false);
    expect(createPar({ ...noAd, scope: `${vct} urn:tamga:edu:Diploma:1` }).ok).toBe(false);
    expect(createPar({ ...noAd }).ok).toBe(false);
  });
  it("RFC 9207: issuer verilirse başarılı ve hatalı yetki yanıtında iss bulunur", () => {
    const r = createPar({ ...base, state: "st", issuer: "https://issuer.tamga.network/bilgi" });
    if (!r.ok) throw new Error("par");
    const ok = new URL(callbackUrl(r.par, "c1"));
    expect(ok.searchParams.get("iss")).toBe("https://issuer.tamga.network/bilgi");
    expect(ok.searchParams.get("state")).toBe("st");
    const err = new URL(errorCallbackUrl(r.par, "access_denied", "x"));
    expect(err.searchParams.get("iss")).toBe("https://issuer.tamga.network/bilgi");
    const plain = createPar(base);
    if (!plain.ok) throw new Error("par");
    expect(callbackUrl(plain.par, "c")).not.toContain("iss=");
  });
});
