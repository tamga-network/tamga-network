import { describe, it, expect, beforeAll } from "vitest";
import { webcrypto } from "node:crypto";
import {
  X509CertificateGenerator,
  cryptoProvider,
  KeyUsageFlags,
  KeyUsagesExtension,
  BasicConstraintsExtension,
} from "@peculiar/x509";
import { exportJWK, generateKeyPair, type JWK } from "jose";
import type { SigningKey } from "./issue.js";
import { computeIssuerId, b64u } from "@tamga-network/core";
import {
  issueSdJwtVc,
  presentSdJwtVc,
  verifySdJwtVc,
  digestOf,
  decodeDisclosure,
  splitCombined,
  makeDisclosure,
  type IssuerSigner,
} from "./index.js";
import { CompactSign } from "jose";

cryptoProvider.set(webcrypto as unknown as Crypto);
const crypto = webcrypto as unknown as Crypto;
const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;

let rootDer: Uint8Array, signer: IssuerSigner, leafDer: Uint8Array, holder: { priv: SigningKey; jwk: JWK };
const NOW = 1790000000,
  AUD = "x509_san_dns:verify.tamga.network",
  NONCE = "n-123";

beforeAll(async () => {
  const rootKeys = (await crypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
  const root = await X509CertificateGenerator.createSelfSigned({
    serialNumber: "01",
    name: "CN=TR Root (test)",
    notBefore: new Date(0),
    notAfter: new Date("2099-01-01"),
    signingAlgorithm: ALG,
    keys: rootKeys,
    extensions: [new BasicConstraintsExtension(true, 1, true), new KeyUsagesExtension(KeyUsageFlags.keyCertSign, true)],
  });
  const leafKeys = (await crypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
  const leaf = await X509CertificateGenerator.create({
    serialNumber: "02",
    subject: "CN=Bilgi (test)",
    issuer: root.subject,
    notBefore: new Date(0),
    notAfter: new Date("2099-01-01"),
    signingAlgorithm: ALG,
    publicKey: leafKeys.publicKey,
    signingKey: rootKeys.privateKey,
    extensions: [new KeyUsagesExtension(KeyUsageFlags.digitalSignature, true)],
  });
  rootDer = new Uint8Array(root.rawData);
  leafDer = new Uint8Array(leaf.rawData);
  signer = {
    x5c: [leafDer],
    sign: (h, p) => new CompactSign(p).setProtectedHeader(h as never).sign(leafKeys.privateKey),
  };
  const hk = await generateKeyPair("ES256");
  holder = { priv: hk.privateKey, jwk: await exportJWK(hk.publicKey) };
});

async function issueDiploma() {
  return issueSdJwtVc({
    signer,
    iss: "https://issuer.tamga.network/bilgi",
    vct: "urn:tamga:edu:DiplomaCredential:1",
    vctIntegrity: "sha256-r+Pdm2xQrKxuuX9WwXGwntrJ7PtDjCbZ5pysOj3u6KA=",
    iat: NOW - 1000,
    cnfJwk: holder.jwk,
    status: { status_list: { idx: 48213, uri: "https://status.tamga.network/3f9a" } },
    claims: {
      family_name: "Yılmaz",
      given_name: "Ayşe",
      birth_date: "2002-05-14",
      qualification_title: { "tr-TR": "Bilgisayar Mühendisliği Lisans" },
      eqf_level: 6,
      isced_f_code: "0613",
      awarding_date: "2026-06-20",
      is_graduate: true,
      grade: "3.41",
    },
    sdPolicy: {
      birth_date: "always",
      grade: "always",
      family_name: "always",
      given_name: "always",
      is_graduate: "allowed",
      eqf_level: "allowed",
    },
  });
}

describe("@tamga-network/sd-jwt — SPEC-CRED-0002", () => {
  it("ihraç: başlık/gövde kuralları (C1, C2, C5, C6, C7, C13, C16)", async () => {
    const out = await issueDiploma();
    const { jwt, disclosures, kb } = splitCombined(out.combined);
    expect(kb).toBe("");
    expect(disclosures.length).toBe(9);
    expect(out.payload._sd_alg).toBe("sha-256");
    expect([...(out.payload._sd as string[])].sort()).toEqual(out.payload._sd);
    expect((out.payload._sd as string[]).length).toBe(9); // decoy yok
    expect(out.payload.cnf).toBeTruthy();
    const header = JSON.parse(Buffer.from(jwt.split(".")[0], "base64url").toString());
    expect(header.typ).toBe("dc+sd-jwt");
    expect(header.alg).toBe("ES256");
    expect(header.x5c.length).toBe(1);
  });
  it("digest disclosure DİZESİNİN hash'idir; çözüp yeniden serileştirme farklı sonuç verir (C4/C14)", async () => {
    const out = await issueDiploma();
    const d = out.disclosures[0];
    expect(digestOf(d.disclosure)).toBe(d.digest);
    const re = b64u(JSON.stringify(JSON.parse(Buffer.from(d.disclosure, "base64url").toString()), null, 1));
    expect(digestOf(re)).not.toBe(d.digest);
  });
  it("sunum + doğrulama: seçili alanlar açılır, gizli alanlar görünmez, KB-JWT doğrulanır", async () => {
    const out = await issueDiploma();
    const pres = await presentSdJwtVc({
      combined: out.combined,
      discloseClaims: ["is_graduate", "eqf_level", "family_name", "given_name"],
      holderKey: holder.priv,
      aud: AUD,
      nonce: NONCE,
      iat: NOW,
    });
    const r = await verifySdJwtVc(pres, { aud: AUD, nonce: NONCE, stateCode: "TR", now: NOW, rootCertsDer: [rootDer] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.disclosedClaimNames.sort()).toEqual(["eqf_level", "family_name", "given_name", "is_graduate"]);
    expect(r.claims.grade).toBeUndefined();
    expect(r.claims.birth_date).toBeUndefined();
    expect(r.issuerId).toBe(computeIssuerId("TR", leafDer));
    expect(r.checksPerformed).toEqual(["A1", "A2", "A3", "A4", "A5", "A6"]);
  });
  it("KB-JWT yoksa A1 RED (C8); yanlış nonce A6; aud uyuşmazlığı A6; iat penceresi A6 (C17)", async () => {
    const out = await issueDiploma();
    const noKb = await verifySdJwtVc(out.combined, { aud: AUD, nonce: NONCE, stateCode: "TR", now: NOW });
    expect(noKb.ok).toBe(false);
    if (!noKb.ok) expect(noKb.failedStep).toBe("A1");
    const pres = await presentSdJwtVc({
      combined: out.combined,
      discloseClaims: ["is_graduate"],
      holderKey: holder.priv,
      aud: AUD,
      nonce: NONCE,
      iat: NOW,
    });
    const wn = await verifySdJwtVc(pres, { aud: AUD, nonce: "other", stateCode: "TR", now: NOW });
    expect(wn.ok).toBe(false);
    if (!wn.ok) expect(wn.failedStep).toBe("A6");
    const wa = await verifySdJwtVc(pres, { aud: "x509_san_dns:evil", nonce: NONCE, stateCode: "TR", now: NOW });
    expect(wa.ok).toBe(false);
    if (!wa.ok) expect(wa.failedStep).toBe("A6");
    const late = await verifySdJwtVc(pres, { aud: AUD, nonce: NONCE, stateCode: "TR", now: NOW + 301 });
    expect(late.ok).toBe(false);
    if (!late.ok) expect(late.failedStep).toBe("A6");
  });
  it("kurcalanmış disclosure (değer değişti) → A5 RED (C10); ekran görüntüsü/kopya KB üretemez", async () => {
    const out = await issueDiploma();
    const pres = await presentSdJwtVc({
      combined: out.combined,
      discloseClaims: ["eqf_level"],
      holderKey: holder.priv,
      aud: AUD,
      nonce: NONCE,
      iat: NOW,
    });
    const { jwt, disclosures, kb } = splitCombined(pres);
    const dec = decodeDisclosure(disclosures[0]);
    const forged = b64u(JSON.stringify([dec.salt, dec.name, 8]));
    const tampered = [jwt, forged, ""].join("~") + kb;
    const r = await verifySdJwtVc(tampered, { aud: AUD, nonce: NONCE, stateCode: "TR", now: NOW });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failedStep).toBe("A5");
    // başka anahtarla KB üret → A6
    const other = await generateKeyPair("ES256");
    const pres2 = await presentSdJwtVc({
      combined: out.combined,
      discloseClaims: ["eqf_level"],
      holderKey: other.privateKey,
      aud: AUD,
      nonce: NONCE,
      iat: NOW,
    });
    const r2 = await verifySdJwtVc(pres2, { aud: AUD, nonce: NONCE, stateCode: "TR", now: NOW });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.failedStep).toBe("A6");
  });
  it("yanlış typ (vc+sd-jwt) varsayılan RED, bayrakla kabul (T2/§5.1.1); kök zinciri tutmuyorsa A3", async () => {
    const out = await issueDiploma();
    const pres = await presentSdJwtVc({
      combined: out.combined,
      discloseClaims: [],
      holderKey: holder.priv,
      aud: AUD,
      nonce: NONCE,
      iat: NOW,
    });
    const otherRootKeys = (await crypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
    const otherRoot = await X509CertificateGenerator.createSelfSigned({
      serialNumber: "09",
      name: "CN=Other Root",
      notBefore: new Date(0),
      notAfter: new Date("2099-01-01"),
      signingAlgorithm: ALG,
      keys: otherRootKeys,
    });
    const r = await verifySdJwtVc(pres, {
      aud: AUD,
      nonce: NONCE,
      stateCode: "TR",
      now: NOW,
      rootCertsDer: [new Uint8Array(otherRoot.rawData)],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failedStep).toBe("A3");
  });

  /** Kütüphanenin reddettiği biçimleri (başka bir ihraççının üretebileceği) elle kurar: payload + disclosure'lar, aynı imzacı. */
  async function craft(
    payload: Record<string, unknown>,
    disclosed: Array<[string, unknown]>,
    s: IssuerSigner = signer,
  ) {
    const ds = disclosed.map(([n, v]) => makeDisclosure(n, v));
    const body = { ...payload, _sd_alg: "sha-256", _sd: ds.map((d) => d.digest).sort() };
    const header = { alg: "ES256", typ: "dc+sd-jwt", x5c: s.x5c.map((d) => Buffer.from(d).toString("base64")) };
    const jwt = await s.sign(header, new TextEncoder().encode(JSON.stringify(body)));
    return [jwt, ...ds.map((d) => d.disclosure), ""].join("~");
  }
  const basePayload = () => ({
    iss: "https://issuer.tamga.network/bilgi",
    vct: "urn:tamga:edu:DiplomaCredential:1",
    "vct#integrity": "sha256-x",
    iat: NOW - 1000,
    cnf: { jwk: holder.jwk },
  });
  const present = (combined: string, discloseClaims: string[]) =>
    presentSdJwtVc({ combined, discloseClaims, holderKey: holder.priv, aud: AUD, nonce: NONCE, iat: NOW });
  const check = (pres: string) =>
    verifySdJwtVc(pres, { aud: AUD, nonce: NONCE, stateCode: "TR", now: NOW, rootCertsDer: [rootDer] });

  it("seçici açıklanamaz adlar disclosure olarak gelirse A5 RED (status, cnf, __proto__ …)", async () => {
    for (const name of ["status", "__proto__", "_sd", "iat", "category"]) {
      const c = await craft(basePayload(), [
        [name, { x: 1 }],
        ["is_graduate", true],
      ]);
      const r = await check(await present(c, [name, "is_graduate"]));
      expect(r.ok, name).toBe(false);
      if (!r.ok) expect(r.failedStep, name).toBe("A5");
    }
  });
  it("iat yoksa A3; nbf gelecekteyse RED; sertifika iat anında geçersizse A3", async () => {
    const { iat: _iat, ...noIat } = basePayload();
    const r1 = await check(await present(await craft(noIat, [["is_graduate", true]]), ["is_graduate"]));
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.failedStep).toBe("A3");
    const r2 = await check(
      await present(await craft({ ...basePayload(), nbf: NOW + 600 }, [["is_graduate", true]]), ["is_graduate"]),
    );
    expect(r2.ok).toBe(false);
    const r3 = await check(
      await present(await craft({ ...basePayload(), iat: -10 }, [["is_graduate", true]]), ["is_graduate"]),
    );
    expect(r3.ok).toBe(false);
    if (!r3.ok) expect(r3.failedStep).toBe("A3");
    const ok = await check(await present(await craft(basePayload(), [["is_graduate", true]]), ["is_graduate"]));
    expect(ok.ok).toBe(true);
  });
});
