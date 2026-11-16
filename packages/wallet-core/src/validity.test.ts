/**
 * İleri tarihli belge (ARF 4.6.6 "Issued") ve askıdaki kurumun belgesi (ADR-0088) — cüzdanın gösterim durumu.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { JWK } from "jose";
import { issueSdJwtVc, pemIssuerSigner, verifySdJwtVc } from "@tamga-network/sd-jwt";
import { epochSeconds, pemToDer } from "@tamga-network/core";
import { SoftwareKeyProvider, MemoryKeyStore } from "./keys.js";
import { verifyIssuedSdJwt, presentSdJwt } from "./sdjwt.js";
import { credentialValidity, isNotYetValid } from "./validity.js";
import { matchDcql } from "./oid4vp.js";
import type { StoredCredential } from "./store.js";

const PKI = resolve(import.meta.dirname, "../../../ops/pki");
const havePki = existsSync(resolve(PKI, "issuer-bilgi.pkcs8.pem"));
const NOW = 1_800_000_000;
const DAY = 86400;

const cred = (over: Partial<StoredCredential> = {}): StoredCredential => ({
  id: "c1",
  vct: "urn:tamga:tkt:EventTicket:1",
  typeName: "Bilet",
  issuer: "https://issuer.example",
  issuerId: "0x" + "11".repeat(32),
  leafFingerprint: "00",
  iat: NOW - DAY,
  exp: NOW + 30 * DAY,
  claims: {},
  disclosureNames: [],
  copies: [{ keyRef: "k", cnf: { kty: "EC", crv: "P-256", x: "x", y: "y" }, combined: "a~", usedBy: [] }],
  receivedAt: NOW - DAY,
  ...over,
});

describe("credentialValidity", () => {
  it("ileri tarihli belge: not_yet_valid, sunulamaz; başlangıçtan sonra valid", () => {
    const c = cred({ nbf: NOW + 7 * DAY });
    expect(credentialValidity(c, { now: NOW })).toEqual({
      state: "not_yet_valid",
      validFrom: NOW + 7 * DAY,
      validUntil: NOW + 30 * DAY,
      presentable: false,
    });
    expect(credentialValidity(c, { now: NOW + 7 * DAY }).state).toBe("valid");
    // saat payı: 60 sn içindeki başlangıç geçerli sayılır
    expect(isNotYetValid(cred({ nbf: NOW + 30 }), NOW)).toBe(false);
    expect(isNotYetValid(cred({ nbf: NOW + 61 }), NOW)).toBe(true);
  });
  it("ADR-0088: kurum askıdaysa issuer_suspended (silinmez); askı kalkınca valid; trust yoksa ya da UNKNOWN ise gösterilmez", () => {
    const c = cred();
    expect(credentialValidity(c, { now: NOW, trust: { isIssuerSuspended: () => "YES" } })).toMatchObject({
      state: "issuer_suspended",
      presentable: false,
    });
    expect(credentialValidity(c, { now: NOW, trust: { isIssuerSuspended: () => "NO" } }).state).toBe("valid");
    expect(credentialValidity(c, { now: NOW, trust: { isIssuerSuspended: () => "UNKNOWN" } }).state).toBe("valid");
    expect(credentialValidity(c, { now: NOW }).state).toBe("valid");
  });
  it("öncelik: revoked → expired → issuer_suspended → suspended → not_yet_valid", () => {
    const susp = { isIssuerSuspended: () => "YES" as const };
    expect(credentialValidity(cred({ revokedLocally: true, nbf: NOW + DAY }), { now: NOW, trust: susp }).state).toBe(
      "revoked",
    );
    expect(credentialValidity(cred({ exp: NOW - 1 }), { now: NOW, trust: susp }).state).toBe("expired");
    expect(
      credentialValidity(cred({ status: { value: "suspended", checkedAt: NOW } }), { now: NOW, trust: susp }).state,
    ).toBe("issuer_suspended");
    expect(
      credentialValidity(cred({ status: { value: "suspended", checkedAt: NOW }, nbf: NOW + DAY }), { now: NOW }).state,
    ).toBe("suspended");
  });
  it("sunum seçimi (DCQL): henüz geçerli olmayan belge önerilmez", () => {
    const dcql = { credentials: [{ id: "t", format: "dc+sd-jwt", meta: { vct_values: [cred().vct] } }] };
    expect(matchDcql(dcql as never, [cred({ nbf: NOW + DAY })], { now: NOW }).matches).toHaveLength(0);
    expect(matchDcql(dcql as never, [cred({ nbf: NOW - DAY })], { now: NOW }).matches).toHaveLength(1);
  });
});

describe.skipIf(!havePki)("ileri tarihli SD-JWT VC (dev PKI)", () => {
  const leafPem = readFileSync(resolve(PKI, "issuer-bilgi.cert.pem"), "utf8");
  const keyPem = readFileSync(resolve(PKI, "issuer-bilgi.pkcs8.pem"), "utf8");
  const rootPem = readFileSync(resolve(PKI, "root-ca.cert.pem"), "utf8");
  const issue = async (cnf: JWK, iat: number, nbf?: number, exp?: number) =>
    issueSdJwtVc({
      signer: await pemIssuerSigner(keyPem, leafPem),
      iss: "https://issuer.tamga.network/example-university",
      vct: "urn:tamga:edu:DiplomaCredential:1",
      vctIntegrity: "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
      iat,
      ...(nbf !== undefined ? { nbf } : {}),
      ...(exp !== undefined ? { exp } : {}),
      cnfJwk: cnf,
      claims: { family_name: "Yılmaz", is_graduate: true },
      sdPolicy: {},
    });

  it("cüzdan ileri tarihli belgeyi reddetmez (notYetValid); doğrulayıcı başlangıca kadar A7'de reddeder", async () => {
    const keys = new SoftwareKeyProvider(new MemoryKeyStore());
    const now = Math.floor(Date.now() / 1000);
    const cnf = await keys.generate("f.0");
    const issued = await issue(cnf as JWK, now, now + 7 * DAY);
    const v = verifyIssuedSdJwt(issued.combined, { expectedCnf: cnf, now });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.nbf).toBe(now + 7 * DAY);
    expect(v.notYetValid).toBe(true);
    expect(v.checks).toContain("A5");
    // başlangıç anında artık geçerli
    const later = verifyIssuedSdJwt(issued.combined, { expectedCnf: cnf, now: now + 7 * DAY });
    expect(later.ok && later.notYetValid).toBe(false);
    // doğrulayıcı (referans): başlangıçtan önce RED (A7), sonra kabul
    const AUD = "x509_san_dns:verify.tamga.network";
    const pres = await presentSdJwt({
      combined: issued.combined,
      discloseClaims: ["is_graduate"],
      keys,
      keyRef: "f.0",
      aud: AUD,
      nonce: "n",
      iat: now,
    });
    const opts = { aud: AUD, nonce: "n", stateCode: "TR", rootCertsDer: [pemToDer(rootPem)] };
    const early = await verifySdJwtVc(pres, { ...opts, now: epochSeconds(now) });
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.failedStep).toBe("A7");
  });
  it("bozuk ya da tutarsız nbf: belge verende hata; cüzdanda nbf ≥ exp ret", async () => {
    const keys = new SoftwareKeyProvider(new MemoryKeyStore());
    const cnf = (await keys.generate("f.1")) as JWK;
    await expect(issue(cnf, NOW, NOW - 1)).rejects.toThrow(/nbf/);
    await expect(issue(cnf, NOW, NOW + DAY, NOW + DAY)).rejects.toThrow(/nbf/);
    const ok = await issue(cnf, NOW, NOW, NOW + DAY);
    expect(ok.payload.nbf).toBe(NOW);
    const v = verifyIssuedSdJwt(ok.combined, { now: NOW });
    expect(v.ok && v.notYetValid).toBe(false);
  });
});
