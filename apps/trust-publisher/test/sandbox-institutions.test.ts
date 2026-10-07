/** ADR-0041: sandbox test kurumu — ara makamla yaprak (TI1), "(TEST)" işareti ve kayıt (TI2), istek denetimi. */
import { describe, it, expect } from "vitest";
import {
  X509CertificateGenerator,
  cryptoProvider,
  BasicConstraintsExtension,
  KeyUsagesExtension,
  KeyUsageFlags,
  SubjectKeyIdentifierExtension,
} from "@peculiar/x509";
import { webcrypto, X509Certificate } from "node:crypto";
import { checkRegistrations } from "../src/registration.js";
import {
  asciiName,
  issueLeaf,
  issuedByTestCa,
  subjects,
  testInstitutionSource,
  validateRequest,
  reservedNamesOf,
} from "../src/sandbox-institutions.js";

cryptoProvider.set(webcrypto as unknown as Crypto);
const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;

async function ca(name: string) {
  const kp = (await webcrypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
  const cert = await X509CertificateGenerator.createSelfSigned({
    serialNumber: "01",
    name,
    notBefore: new Date(Date.now() - 60_000),
    notAfter: new Date(Date.now() + 86400_000),
    signingAlgorithm: ALG,
    keys: kp,
    extensions: [
      new BasicConstraintsExtension(true, 0, true),
      new KeyUsagesExtension(KeyUsageFlags.keyCertSign, true),
      await SubjectKeyIdentifierExtension.create(kp.publicKey),
    ] as never,
  });
  const der = Buffer.from(await webcrypto.subtle.exportKey("pkcs8", kp.privateKey));
  return {
    certPem: cert.toString("pem"),
    keyPem: `-----BEGIN PRIVATE KEY-----\n${der.toString("base64")}\n-----END PRIVATE KEY-----\n`,
  };
}

const req = {
  slug: "t-abc123",
  name: "Deneme Okulu Çağ (TEST)",
  kind: "education" as const,
  issuer_url: "https://issuer.sandbox.tamga.network/t-abc123",
  status_list_base: "https://status.sandbox.tamga.network/",
};

describe("sandbox test kurumları (ADR-0041)", () => {
  it("TI1: yaprak ara makamca imzalı, (TEST) taşır, 30 günü geçmez; başka makamın yaprağı reddedilir", async () => {
    const testCa = await ca("CN=Tamga Sandbox Test Institutions CA (TEST), C=TR");
    const other = await ca("CN=Other CA (TEST), C=TR");
    const leaf = await issueLeaf(testCa, subjects(req.name).credential);
    const x = new X509Certificate(leaf.certPem);
    expect(x.subject).toContain("Deneme Okulu Cag (TEST)");
    expect(x.subject.split("\n").slice(0, 2)).toEqual(["C=TR", "OU=Tamga Sandbox Test Institutions"]); // ad kısıtı ön eki
    expect(x.ca).toBe(false);
    expect(new Date(x.validTo).getTime() - Date.now()).toBeLessThanOrEqual(30 * 86400_000 + 120_000);
    expect(issuedByTestCa(leaf.certPem, testCa.certPem)).toBe(true);
    expect(issuedByTestCa(leaf.certPem, other.certPem)).toBe(false);
    await expect(issueLeaf(testCa, "CN=Gercek Kurum, C=TR")).rejects.toThrow(/SB1/);
  });

  it("TI2: kayıt test_institution işaretli, yalnız eğitim yetkisi, kayıt verisi eksiksiz", () => {
    const rec = testInstitutionSource(req, new Date("2026-10-04T10:00:00Z"));
    expect(rec.test_institution).toBe(true);
    expect(rec.legal_name).toMatch(/\(TEST\)$/);
    expect((rec.schema_authorizations as Array<{ vct: string }>).map((a) => a.vct)).toEqual([
      "urn:tamga:edu:StudentCredential:1",
      "urn:tamga:edu:DiplomaCredential:1",
    ]);
    // ADR-0024: yeni kayıtta eksik zorunlu alan yayını durdururdu
    expect(checkRegistrations([], [rec]).errors).toEqual([]);
  });

  it("istek denetimi: slug biçimi, (TEST) eki, tür", () => {
    expect(validateRequest(req)).toEqual([]);
    expect(validateRequest({ ...req, slug: "istanbul-bilgi" }).length).toBe(1);
    expect(validateRequest({ ...req, name: "Deneme Okulu Çağ" }).length).toBe(1);
    expect(validateRequest({ ...req, kind: "health" as never }).length).toBe(1);
    expect(asciiName('Ç"ağ,=Ş (TEST)')).toBe("C ag S");
  });

  it("K1: resmî kurum sözcüğü / marka adı ve listedeki kurum adına benzeyen ad reddedilir", () => {
    for (const name of [
      "Deneme Üniversitesi (TEST)",
      "Ankara Valiliği (TEST)",
      "T.C. Deneme (TEST)",
      "Sağlık Bakanlığı (TEST)",
      "Tamga Okulu (TEST)",
      "Example University (TEST)",
    ])
      expect(validateRequest({ ...req, name }), name).toHaveLength(1);
    const reserved = reservedNamesOf(
      { issuers: [{ legal_name: "İstanbul Bilgi Okulu" }], relying_parties: [{ trade_name: "Bubilet" }] },
      { issuers: [{ legal_name: { tr: "Örnek Kurs Merkezi" } }] },
    );
    expect(validateRequest({ ...req, name: "Istanbul Bilgi Okulu (TEST)" }, reserved)).toHaveLength(1);
    expect(validateRequest({ ...req, name: "Bubilet Plus (TEST)" }, reserved)).toHaveLength(1);
    expect(validateRequest({ ...req, name: "ornek kurs merkezi (TEST)" }, reserved)).toHaveLength(1);
    expect(validateRequest(req, reserved)).toEqual([]);
  });
});
