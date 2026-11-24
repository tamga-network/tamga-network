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

/** Serbest uzantılı sertifika (B5 kenar durumları). */
async function cert(opts: {
  subject: string;
  issuer?: { cert: Cert; name: string };
  extensions: import("@peculiar/x509").Extension[];
  notAfter?: Date;
}): Promise<Cert> {
  const keys = (await crypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
  const c = opts.issuer
    ? await X509CertificateGenerator.create({
        serialNumber: "03",
        subject: opts.subject,
        issuer: opts.issuer.name,
        notBefore: new Date("2026-01-01"),
        notAfter: opts.notAfter ?? new Date("2030-01-01"),
        signingAlgorithm: ALG,
        publicKey: keys.publicKey,
        signingKey: opts.issuer.cert.keys.privateKey,
        extensions: opts.extensions,
      })
    : await X509CertificateGenerator.createSelfSigned({
        serialNumber: "03",
        name: opts.subject,
        notBefore: new Date("2026-01-01"),
        notAfter: opts.notAfter ?? new Date("2036-01-01"),
        signingAlgorithm: ALG,
        keys,
        extensions: opts.extensions,
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
  it("ara CA'lı üçlü zincir geçer; pathLen=0 CA ara CA veremez; süresi dolmuş ara CA ret", async () => {
    const root = await cert({
      subject: "CN=Root R (test)",
      extensions: [
        new BasicConstraintsExtension(true, 1, true),
        new KeyUsagesExtension(KeyUsageFlags.keyCertSign, true),
      ],
    });
    const mid = await cert({
      subject: "CN=Mid R (test)",
      issuer: { cert: root, name: "CN=Root R (test)" },
      extensions: [
        new BasicConstraintsExtension(true, 0, true),
        new KeyUsagesExtension(KeyUsageFlags.keyCertSign, true),
      ],
    });
    const s3 = await leaf(mid, "CN=Mid R (test)");
    expect(registrarSigned([s3.der, mid.der, root.der], [fp(root.der)], nowSec)).toBe(true);
    // pathLen=0 olan regCa altında ara CA → ara CA'nın altındaki yaprak ret
    const mid0 = await cert({
      subject: "CN=Mid0 (test)",
      issuer: { cert: regCa, name: "CN=Registrar CA (test)" },
      extensions: [
        new BasicConstraintsExtension(true, 0, true),
        new KeyUsagesExtension(KeyUsageFlags.keyCertSign, true),
      ],
    });
    const s0 = await leaf(mid0, "CN=Mid0 (test)");
    expect(registrarSigned([s0.der, mid0.der, regCa.der], [fp(regCa.der)], nowSec)).toBe(false);
    const midOld = await cert({
      subject: "CN=Mid old (test)",
      issuer: { cert: root, name: "CN=Root R (test)" },
      extensions: [
        new BasicConstraintsExtension(true, 0, true),
        new KeyUsagesExtension(KeyUsageFlags.keyCertSign, true),
      ],
      notAfter: new Date("2026-06-01"),
    });
    const sOld = await leaf(midOld, "CN=Mid old (test)");
    expect(registrarSigned([sOld.der, midOld.der, root.der], [fp(root.der)], nowSec)).toBe(false);
  });
  it("anahtar kullanımı olmayan cA=TRUE sabit imzacı yaprak türetemez; listedeki CA doğrudan imzacı olamaz; tanınmayan kritik uzantı ret", async () => {
    // varsayılan ayarlı kendinden imzalı "imzacı": cA=TRUE, keyUsage yok (B1)
    const bare = await cert({
      subject: "CN=Bare (test)",
      extensions: [new BasicConstraintsExtension(true, undefined, true)],
    });
    const child = await leaf(bare, "CN=Bare (test)");
    expect(registrarSigned([child.der, bare.der], [fp(bare.der)], nowSec)).toBe(false);
    // listedeki CA (keyCertSign, digitalSignature yok) doğrudan imzacı olarak (B3)
    expect(registrarSigned([regCa.der], [fp(regCa.der)], nowSec)).toBe(false);
    // tanınmayan kritik uzantı (ör. 1.2.3.4 kritik) → certUsage fırlatır → ret (B2)
    const { Extension } = await import("@peculiar/x509");
    const odd = await cert({
      subject: "CN=Odd CA (test)",
      extensions: [
        new BasicConstraintsExtension(true, 0, true),
        new KeyUsagesExtension(KeyUsageFlags.keyCertSign, true),
        new Extension("1.2.3.4", true, new Uint8Array([0x05, 0x00])),
      ],
    });
    expect(() => certUsage(odd.der)).toThrow(/critical/);
    const sOdd = await leaf(odd, "CN=Odd CA (test)");
    expect(registrarSigned([sOdd.der, odd.der], [fp(odd.der)], nowSec)).toBe(false);
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
