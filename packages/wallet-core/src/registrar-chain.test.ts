/** ADR-0097 K2: kayıt kurumu güveni — sabit imzacı YA DA listedeki kayıt kurumu CA'sına zincir (ETSI TS 119 602 Ek G). */
import { describe, it, expect, beforeAll } from "vitest";
import { webcrypto, createHash } from "node:crypto";
import {
  X509CertificateGenerator,
  cryptoProvider,
  BasicConstraintsExtension,
  KeyUsageFlags,
  KeyUsagesExtension,
} from "@peculiar/x509";
import { SignJWT } from "jose";
import { registrarSigned, verifyWrprc } from "./wrprc.js";
import { certUsage, certValidity } from "./asn1.js";
import { epochMillis } from "@tamga-network/core";

cryptoProvider.set(webcrypto as unknown as Crypto);
const crypto = webcrypto as unknown as Crypto;
const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;
const NOW = Date.UTC(2026, 10, 24);
const nowSec = NOW / 1000;
const fp = (d: Uint8Array) => createHash("sha256").update(d).digest("hex");
const b64 = (d: Uint8Array) => Buffer.from(d).toString("base64");

interface Cert {
  keys: CryptoKeyPair;
  der: Uint8Array;
}
async function ca(name: string): Promise<Cert> {
  const keys = (await crypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
  const c = await X509CertificateGenerator.createSelfSigned({
    serialNumber: "01",
    name,
    notBefore: new Date("2026-01-01"),
    notAfter: new Date("2036-01-01"),
    signingAlgorithm: ALG,
    keys,
    extensions: [new BasicConstraintsExtension(true, 0, true), new KeyUsagesExtension(KeyUsageFlags.keyCertSign, true)],
  });
  return { keys, der: new Uint8Array(c.rawData) };
}
async function leaf(issuer: Cert, issuerName: string, notAfter = new Date("2027-11-24")): Promise<Cert> {
  const keys = (await crypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
  const c = await X509CertificateGenerator.create({
    serialNumber: "02",
    subject: "CN=Registrar signer (test)",
    issuer: issuerName,
    notBefore: new Date("2026-01-01"),
    notAfter,
    signingAlgorithm: ALG,
    publicKey: keys.publicKey,
    signingKey: issuer.keys.privateKey,
    extensions: [new KeyUsagesExtension(KeyUsageFlags.digitalSignature, true)],
  });
  return { keys, der: new Uint8Array(c.rawData) };
}

let regCa: Cert, strangerCa: Cert, signer: Cert, expired: Cert, strangerSigner: Cert;
beforeAll(async () => {
  regCa = await ca("CN=Registrar CA (test)");
  strangerCa = await ca("CN=Stranger CA (test)");
  signer = await leaf(regCa, "CN=Registrar CA (test)");
  expired = await leaf(regCa, "CN=Registrar CA (test)", new Date("2026-06-01"));
  strangerSigner = await leaf(strangerCa, "CN=Stranger CA (test)");
});

describe("registrarSigned (ADR-0097 K2)", () => {
  it("sabit imzacı (bugünkü yol) geçer", () => {
    expect(registrarSigned([signer.der], [fp(signer.der)], nowSec)).toBe(true);
  });
  it("listedeki kayıt kurumu CA'sına zincir geçer; CA x5c'de yoksa ya da yalnız yaprak varsa geçmez", () => {
    expect(registrarSigned([signer.der, regCa.der], [fp(regCa.der)], nowSec)).toBe(true);
    expect(registrarSigned([signer.der], [fp(regCa.der)], nowSec)).toBe(false);
  });
  it("listede olmayan CA, sahte zincir ve süresi dolmuş yaprak reddedilir", () => {
    expect(registrarSigned([strangerSigner.der, strangerCa.der], [fp(regCa.der)], nowSec)).toBe(false);
    expect(registrarSigned([strangerSigner.der, regCa.der], [fp(regCa.der)], nowSec)).toBe(false);
    expect(registrarSigned([expired.der, regCa.der], [fp(regCa.der)], nowSec)).toBe(false);
    expect(registrarSigned([signer.der, regCa.der], [], nowSec)).toBe(false);
  });
  it("CA olmayan imzacı yeni yaprak türetemez (süresi dolmuş imzacı da); yaprak CA olamaz; uzun zincir reddedilir", async () => {
    // imzacı S (CA değil) altında yaprak L: [L, S, CA] — S listedeki CA'ya zincirli ama CA değil
    const fromSigner = await leaf(signer, "CN=Registrar signer (test)");
    expect(registrarSigned([fromSigner.der, signer.der, regCa.der], [fp(regCa.der)], nowSec)).toBe(false);
    const fromExpired = await leaf(expired, "CN=Registrar signer (test)");
    expect(registrarSigned([fromExpired.der, expired.der, regCa.der], [fp(regCa.der)], nowSec)).toBe(false);
    // sabit imzacı (CA değil) da çapa olarak yeni yaprak türetemez
    expect(registrarSigned([fromSigner.der, signer.der], [fp(signer.der)], nowSec)).toBe(false);
    // yaprak CA ise ret
    const subCa = await ca("CN=Sub CA (test)");
    expect(registrarSigned([subCa.der, regCa.der], [fp(regCa.der)], nowSec)).toBe(false);
    // 5 sertifikalık zincir ret (üst sınır 4)
    expect(registrarSigned([signer.der, regCa.der, regCa.der, regCa.der, regCa.der], [fp(regCa.der)], nowSec)).toBe(
      false,
    );
  });
  it("certUsage: CA ve yaprak uzantıları okunur", () => {
    expect(certUsage(regCa.der)).toMatchObject({ ca: true, pathLen: 0 });
    expect(certUsage(signer.der).ca).toBe(false);
  });
  it("certValidity sertifikanın aralığını okur", () => {
    expect(certValidity(signer.der)).toEqual({
      notBefore: Date.UTC(2026, 0, 1) / 1000,
      notAfter: Date.UTC(2027, 10, 24) / 1000,
    });
  });
  it("verifyWrprc: CA zinciriyle imzalanmış kayıt sertifikası kabul; serviceIdentifier okunur", async () => {
    const jwt = await new SignJWT({
      sub: "VATTR-1",
      serviceIdentifier: "hiring",
      iat: nowSec,
      exp: nowSec + 3600,
    } as never)
      .setProtectedHeader({ alg: "ES256", typ: "rc-wrp+jwt", x5c: [b64(signer.der), b64(regCa.der)] } as never)
      .sign(signer.keys.privateKey);
    const ok = verifyWrprc(jwt, [fp(regCa.der)], epochMillis(NOW));
    expect(ok).toMatchObject({ ok: true, payload: { serviceIdentifier: "hiring" } });
    expect(verifyWrprc(jwt, [fp(strangerCa.der)], epochMillis(NOW))).toMatchObject({ ok: false });
  });
});
