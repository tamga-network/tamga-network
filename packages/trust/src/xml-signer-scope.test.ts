/**
 * K5 (ADR-0066): ETSI XML güven listesi imzacısı (EKU id-tsl-kp-tslSigning, TS 119 612 §5.7.1) JSON listelerini (`tamga-tl+jwt`)
 * imzalayamaz — slotun `signing_keys`'inde dursa da JSON yükleyicisi bu sertifikayla imzalı LOTL'ü ve ülke listesini reddeder.
 */
import { describe, expect, it } from "vitest";
import { createHash, webcrypto } from "node:crypto";
import {
  ExtendedKeyUsageExtension,
  KeyUsageFlags,
  KeyUsagesExtension,
  X509CertificateGenerator,
  cryptoProvider,
} from "@peculiar/x509";
import { certExtendedKeyUsages, OID_TSL_SIGNING_EKU } from "./x509-names.js";
import { loadTrustSet, pemSigner, signJson } from "./jws.js";

cryptoProvider.set(webcrypto as unknown as Crypto);

async function signerWith(eku: string[] | null) {
  const alg = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" };
  const keys = (await webcrypto.subtle.generateKey(alg, true, ["sign", "verify"])) as CryptoKeyPair;
  const cert = await X509CertificateGenerator.createSelfSigned({
    serialNumber: "01",
    name: "CN=Signer,O=Test Operator,C=XX",
    notBefore: new Date(Date.now() - 86400_000),
    notAfter: new Date(Date.now() + 86400_000),
    keys,
    signingAlgorithm: alg,
    extensions: [
      new KeyUsagesExtension(KeyUsageFlags.digitalSignature, true),
      ...(eku ? [new ExtendedKeyUsageExtension(eku)] : []),
    ],
  });
  const pkcs8 = Buffer.from(await webcrypto.subtle.exportKey("pkcs8", keys.privateKey)).toString("base64");
  const keyPem = `-----BEGIN PRIVATE KEY-----\n${pkcs8.match(/.{1,64}/g)!.join("\n")}\n-----END PRIVATE KEY-----\n`;
  const der = new Uint8Array(cert.rawData);
  return {
    der,
    fp: createHash("sha256").update(der).digest("hex"),
    signer: await pemSigner(keyPem, cert.toString("pem")),
  };
}

describe("K5: XML liste imzacısı JSON listesini imzalayamaz", () => {
  it("certExtendedKeyUsages: EKU amaçlarını okur; uzantı yoksa boş", async () => {
    const xml = await signerWith([OID_TSL_SIGNING_EKU, "1.3.6.1.5.5.7.3.4"]);
    expect(certExtendedKeyUsages(xml.der)).toEqual([OID_TSL_SIGNING_EKU, "1.3.6.1.5.5.7.3.4"]);
    expect(certExtendedKeyUsages((await signerWith(null)).der)).toEqual([]);
  });

  it("tslSigning EKU'lu sertifikayla imzalı LOTL reddedilir; EKU'suz imzacı bu denetimden geçer", async () => {
    const payload = { list_format_version: "x" };
    const xml = await signerWith([OID_TSL_SIGNING_EKU]);
    await expect(
      loadTrustSet({
        lotlJws: await signJson(xml.signer, payload),
        rootFingerprints: [xml.fp],
        nationalListJws: {},
        anchorsJsonl: "",
      }),
    ).rejects.toThrow(/ETSI XML trusted-list signer/);
    const json = await signerWith(null);
    // EKU denetiminden geçer, sonra (bilerek bozuk) LOTL içeriğinde başka bir nedenle durur
    await expect(
      loadTrustSet({
        lotlJws: await signJson(json.signer, payload),
        rootFingerprints: [json.fp],
        nationalListJws: {},
        anchorsJsonl: "",
      }),
    ).rejects.not.toThrow(/ETSI XML trusted-list signer/);
  });
});
