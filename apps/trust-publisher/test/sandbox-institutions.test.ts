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
  sb1Problem,
  sharedWalletProviderFps,
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

describe("SB1 — ortak cüzdan sağlayıcı istisnası (ADR-0042)", () => {
  const reg = { wallet_providers: [{ provider_id: "WP-1" }, { provider_id: "WP-2" }] };
  const pub = {
    wallet_providers: [
      { provider_id: "WP-1", wua_signing_keys: [{ fingerprint_sha256: "AA11" }] },
      { provider_id: "WP-2", wua_signing_keys: [] },
      { provider_id: "WP-X", wua_signing_keys: [{ fingerprint_sha256: "ff" }] }, // kayıt defterinde yok → sayılmaz
    ],
  };
  const shared = sharedWalletProviderFps(reg, pub);
  const base = { name: "wp", environment: "sandbox" as const, shared };

  it("parmak izleri yalnız gerçek kayıt defterindeki sağlayıcılar için, küçük harfle", () => {
    expect([...shared.keys()]).toEqual(["WP-1", "WP-2"]);
    expect([...shared.get("WP-1")!]).toEqual(["aa11"]);
    expect(shared.get("WP-2")!.size).toBe(0);
    expect(sharedWalletProviderFps(reg, undefined).get("WP-1")!.size).toBe(0);
  });

  it("sandbox'ta gerçek sertifika yalnız gerçek ağda yayınlanmış AYNI sertifikaysa kabul", () => {
    expect(sb1Problem({ ...base, isTest: false, fingerprint: "aa11", sharedWalletProvider: "WP-1" })).toBeNull();
    expect(sb1Problem({ ...base, isTest: false, fingerprint: "bb22", sharedWalletProvider: "WP-1" })).toMatch(
      /SB1.*yayınlanmamış/,
    );
    expect(sb1Problem({ ...base, isTest: false, fingerprint: "aa11", sharedWalletProvider: "WP-2" })).toMatch(
      /anahtarı yok/,
    );
    expect(sb1Problem({ ...base, isTest: false, fingerprint: "aa11", sharedWalletProvider: "WP-9" })).toMatch(
      /karıştırılamaz/,
    );
    expect(sb1Problem({ ...base, isTest: false, fingerprint: "aa11" })).toMatch(/karıştırılamaz/);
  });

  it("temel kural değişmez: test sertifikası sandbox'ta, gerçek sertifika gerçek ağda", () => {
    expect(sb1Problem({ ...base, isTest: true, fingerprint: "x" })).toBeNull();
    expect(sb1Problem({ ...base, environment: "production", isTest: false, fingerprint: "x" })).toBeNull();
    expect(
      sb1Problem({ ...base, environment: "production", isTest: true, fingerprint: "x", sharedWalletProvider: "WP-1" }),
    ).toMatch(/karıştırılamaz/);
  });
});
