/** ADR-0046 K3: sertifikadan konu adı, veren adı, seri numarası; güven kökü ve konu adı eşleşmeleri. */
import { describe, it, expect, beforeAll } from "vitest";
import { webcrypto } from "node:crypto";
import { X509CertificateGenerator, cryptoProvider } from "@peculiar/x509";
import { certNames, certMatchesRootOfTrust, certSubjectMatches } from "./x509-names.js";

cryptoProvider.set(webcrypto as unknown as Crypto);
const crypto = webcrypto as unknown as Crypto;
const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;

let root: Uint8Array, leaf: Uint8Array;
beforeAll(async () => {
  const rk = (await crypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
  const lk = (await crypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
  const r = await X509CertificateGenerator.createSelfSigned({
    serialNumber: "0a1b2c",
    name: "CN=Example Root CA, O=Example, C=TR",
    notBefore: new Date(0),
    notAfter: new Date("2099-01-01"),
    signingAlgorithm: ALG,
    keys: rk,
  });
  const l = await X509CertificateGenerator.create({
    serialNumber: "77",
    subject: "CN=verifier.example, O=Example Ltd, 2.5.4.97=VATTR-1234567890, C=TR",
    issuer: r.subject,
    notBefore: new Date(0),
    notAfter: new Date("2099-01-01"),
    signingAlgorithm: ALG,
    publicKey: lk.publicKey,
    signingKey: rk.privateKey,
  });
  root = new Uint8Array(r.rawData);
  leaf = new Uint8Array(l.rawData);
});

describe("certNames", () => {
  it("konu, veren ve seri numarası", () => {
    const n = certNames(leaf);
    expect(n.serialHex).toBe("77");
    expect(n.subject).toEqual([
      { oid: "2.5.4.3", value: "verifier.example" },
      { oid: "2.5.4.10", value: "example ltd" },
      { oid: "2.5.4.97", value: "vattr-1234567890" },
      { oid: "2.5.4.6", value: "tr" },
    ]);
    expect(n.issuer.map((a) => a.oid)).toEqual(["2.5.4.3", "2.5.4.10", "2.5.4.6"]);
    expect(() => certNames(new Uint8Array([1, 2, 3]))).toThrow();
  });
  it("konu adı eşleşmesi (ETSI -07a; ORGID)", () => {
    expect(certSubjectMatches(leaf, "C=TR,ORGID=VATTR-1234567890,O=Example Ltd,CN=verifier.example")).toBe(true);
    expect(certSubjectMatches(leaf, "ORGID=VATTR-1234567890,O=Example Ltd,C=TR")).toBe(false); // CN eksik
  });
  it("güven kökü (ETSI -09): veren adı + seri numarası; kendinden imzalı kökte konu = veren", () => {
    expect(
      certMatchesRootOfTrust(root, { issuer_dn: "C=TR,O=Example,CN=Example Root CA", serial_number: "0A1B2C" }),
    ).toBe(true);
    expect(
      certMatchesRootOfTrust(root, { issuer_dn: "C=TR,O=Example,CN=Example Root CA", serial_number: "0a1b2d" }),
    ).toBe(false);
    // yaprak: IssuerSerial (kökün adı + yaprağın seri numarası)
    expect(certMatchesRootOfTrust(leaf, { issuer_dn: "CN=Example Root CA,O=Example,C=TR", serial_number: "77" })).toBe(
      true,
    );
    expect(certMatchesRootOfTrust(leaf, { issuer_dn: "CN=Other CA", serial_number: "77" })).toBe(false);
  });
});
