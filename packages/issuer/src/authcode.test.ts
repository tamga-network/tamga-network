/** SPEC-PROTO-0001 §12 — PAR + PKCE + tek kullanımlık code (cüzdan-başlatmalı ihraç). */
import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { callbackUrl, createPar, errorCallbackUrl, mintCode, redeemCode } from "./authcode.js";

const verifier = "v".repeat(43);
const challenge = createHash("sha256").update(verifier, "ascii").digest("base64url");
const base = {
  clientId: "wua-sub",
  redirectUri: "tamga-wallet://cb",
  codeChallenge: challenge,
  authorizationDetails: [
    { type: "openid_credential", credential_configuration_id: "urn:tamga:id:IdentityAttestation:1" },
  ],
  now: 1000,
};

describe("authcode", () => {
  it("tehlikeli redirect_uri şemaları reddedilir (XSS)", () => {
    for (const u of ["javascript://x/%0aalert(1)", "data://text/html,x", "vbscript://x", "file:///etc"]) {
      const r = createPar({ ...base, redirectUri: u });
      expect(r.ok, u).toBe(false);
    }
    expect(createPar(base).ok).toBe(true);
  });
  it("code tek kullanımlık; yanlış PKCE code'u yakar; farklı istemci reddedilir", () => {
    const r = createPar(base);
    if (!r.ok) throw new Error("par");
    const code = mintCode(r.par, "subj", "T2", 1000);
    expect(
      redeemCode(r.par, { code, codeVerifier: verifier, clientId: "başka", redirectUri: base.redirectUri, now: 1001 })
        .ok,
    ).toBe(false);
    expect(
      redeemCode(r.par, {
        code,
        codeVerifier: "y".repeat(43),
        clientId: "wua-sub",
        redirectUri: base.redirectUri,
        now: 1001,
      }).ok,
    ).toBe(false);
    expect(
      redeemCode(r.par, { code, codeVerifier: verifier, clientId: "wua-sub", redirectUri: base.redirectUri, now: 1001 })
        .ok,
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
        now: 1001,
      }).ok,
    ).toBe(true);
    expect(
      redeemCode(r2.par, {
        code: c2,
        codeVerifier: verifier,
        clientId: "wua-sub",
        redirectUri: base.redirectUri,
        now: 1002,
      }).ok,
    ).toBe(false);
  });
  it("redirect_uri izin listesi (verilirse tam eşleşme); token isteğinde redirect_uri ve istemci zorunlu", () => {
    expect(createPar({ ...base, allowedRedirectUris: ["tamga-wallet://cb"] }).ok).toBe(true);
    expect(createPar({ ...base, allowedRedirectUris: ["tamga-wallet://other"] })).toMatchObject({
      ok: false,
      error: "invalid_redirect_uri",
    });
    const byClient = (c: string) => (c === "wua-sub" ? ["tamga-wallet://cb"] : []);
    expect(createPar({ ...base, allowedRedirectUris: byClient }).ok).toBe(true);
    expect(createPar({ ...base, clientId: "x", allowedRedirectUris: byClient }).ok).toBe(false);
    expect(createPar({ ...base, allowedRedirectUris: () => undefined }).ok).toBe(true); // istemci için liste yok → biçim denetimi
    const r = createPar(base);
    if (!r.ok) throw new Error("par");
    const code = mintCode(r.par, "subj", "T2", 1000);
    expect(redeemCode(r.par, { code, codeVerifier: verifier, clientId: "wua-sub", now: 1001 })).toMatchObject({
      ok: false,
      description: expect.stringMatching(/redirect_uri/),
    });
    expect(
      redeemCode(r.par, { code, codeVerifier: verifier, clientId: "", redirectUri: base.redirectUri, now: 1001 }).ok,
    ).toBe(false);
    expect(
      redeemCode(r.par, { code, codeVerifier: verifier, clientId: "wua-sub", redirectUri: base.redirectUri, now: 1001 })
        .ok,
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
