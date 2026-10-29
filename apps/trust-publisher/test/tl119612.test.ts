/**
 * ETSI TS 119 612 XML görünümü (ADR-0066; varsayılan kapalı, `TAMGA_TL119612=1`).
 *
 * Denetimler bağımsızdır: (1) şema — ETSI'nin resmî XSD'leri (TS 119 612 V2.4.1 Ek C, `etsi/19612/`) libxml2 (xmllint-wasm) ile;
 * (2) imza — üreteç `@tamga-network/trust`'ın kanonikleştirmesini kullanır, doğrulama hem aynı paketin okuyucusuyla hem de
 * ondan BAĞIMSIZ xml-crypto ile yapılır; (3) XAdES-B-B nitelikleri (SigningTime, SigningCertificateV2, DataObjectFormat) ve
 * TS 119 612 Ek B kısıtları (enveloped + Exclusive C14N, KeyInfo'da tek sertifika); (4) `build` bayrakla üretir, bayraksız
 * üretmez; gerçek ağda §5.7.1'e uymayan imzacı yayını durdurur; (5) depodaki sandbox örneği (fixture) şemaya uyar ve imzası tutar.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { createHash, createPublicKey, createVerify, webcrypto } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { validateXML } from "xmllint-wasm";
import { SignedXml } from "xml-crypto";
import {
  BasicConstraintsExtension,
  ExtendedKeyUsageExtension,
  KeyUsageFlags,
  KeyUsagesExtension,
  SubjectKeyIdentifierExtension,
  X509CertificateGenerator,
  cryptoProvider,
} from "@peculiar/x509";
import { parseXml, readTrustedListXml, verifyEnvelopedXmlSignature } from "@tamga-network/trust";
import {
  OID_TSL_SIGNING,
  buildTrustedListXml,
  hasXml10InvalidChars,
  sanitizeTrustedListInput,
  signTrustedListXml,
  subjectKeyId,
  tamgaUris,
  tl119612Enabled,
  tlSignerProblems,
  trustedListFromTamga,
  hasTslSigningEku,
  xmlSignerSlotProblems,
  type TrustedListInput,
} from "../src/tl119612.js";

cryptoProvider.set(webcrypto as unknown as Crypto);

const ROOT = resolve(import.meta.dirname, "../../..");
const APP = resolve(ROOT, "apps/trust-publisher");
const XSD_DIR = resolve(APP, "etsi/19612");
const SAMPLE = resolve(APP, "test/fixtures/tl119612/tl-tr.sandbox-sample.xml");
const CLI = resolve(APP, "src/cli.ts");
const TSX = resolve(ROOT, "node_modules/tsx/dist/cli.mjs");
const TSL = "http://uri.etsi.org/02231/v2#";
const DS = "http://www.w3.org/2000/09/xmldsig#";
const XADES = "http://uri.etsi.org/01903/v1.3.2#";
const ECDSA_SHA256 = "http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256";

// ---- şema denetimi (resmî XSD'ler; schemaLocation adresleri bellekte yerel dosya adlarına çevrilir, dosyalar değişmez) ----
const XSDS = [
  "19612_xsd.xsd",
  "19612_additionaltypes_xsd.xsd",
  "19612_sie_xsd.xsd",
  "xml.xsd",
  "xmldsig-core-schema.xsd",
  "XAdES01903v132-201601.xsd",
];
const localise = (s: string) =>
  s.replace(/schemaLocation="[^"]*\/([^/"]+\.xsd)"/g, (_m, f: string) => `schemaLocation="${f}"`);
const WRAPPER = `<?xml version="1.0"?><xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
<xsd:import namespace="http://uri.etsi.org/02231/v2#" schemaLocation="19612_xsd.xsd"/>
<xsd:import namespace="http://uri.etsi.org/02231/v2/additionaltypes#" schemaLocation="19612_additionaltypes_xsd.xsd"/>
<xsd:import namespace="http://uri.etsi.org/TrstSvc/SvcInfoExt/eSigDir-1999-93-EC-TrustedList/#" schemaLocation="19612_sie_xsd.xsd"/>
<xsd:import namespace="http://uri.etsi.org/01903/v1.3.2#" schemaLocation="XAdES01903v132-201601.xsd"/>
</xsd:schema>`;
async function schemaErrors(xml: string): Promise<string[]> {
  const r = await validateXML({
    xml: [{ fileName: "tl.xml", contents: xml }],
    schema: [{ fileName: "all.xsd", contents: WRAPPER }],
    preload: XSDS.map((f) => ({ fileName: f, contents: localise(readFileSync(join(XSD_DIR, f), "utf8")) })),
  });
  return r.valid ? [] : r.errors.map((e) => e.rawMessage);
}

// ---- bağımsız imza doğrulaması (xml-crypto; ECDSA için Node crypto ile küçük algoritma, r||s — RFC 4050) ----
class EcdsaSha256Verify {
  getSignature() {
    throw new Error("only verify");
  }
  verifySignature(signedInfo: string, key: Buffer | string, signatureValue: string) {
    return createVerify("sha256")
      .update(signedInfo)
      .verify({ key: createPublicKey(key), dsaEncoding: "ieee-p1363" }, Buffer.from(signatureValue, "base64"));
  }
  getAlgorithmName() {
    return ECDSA_SHA256;
  }
}
function xmlCryptoVerify(xml: string): boolean {
  const doc = parseXml(xml);
  const sigEl = doc.getElementsByTagNameNS(DS, "Signature").item(0);
  const certB64 = doc.getElementsByTagNameNS(DS, "X509Certificate").item(0).textContent.trim();
  const pem = `-----BEGIN CERTIFICATE-----\n${certB64.match(/.{1,64}/g)!.join("\n")}\n-----END CERTIFICATE-----\n`;
  const sx = new SignedXml({ publicCert: pem, getCertFromKeyInfo: () => null });
  sx.SignatureAlgorithms[ECDSA_SHA256 as never] = EcdsaSha256Verify as never;
  sx.loadSignature(sigEl.toString());
  return sx.checkSignature(xml);
}

// ---- test anahtarları ----
interface Key {
  keyPem: string;
  certPem: string;
  der: Uint8Array;
  fp: string;
}
async function makeCert(o: {
  subject: string;
  tslProfile: boolean;
  ca?: boolean;
  issuer?: { keys: CryptoKeyPair; name: string };
}): Promise<Key & { keys: CryptoKeyPair }> {
  const alg = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" };
  const keys = (await webcrypto.subtle.generateKey(alg, true, ["sign", "verify"])) as CryptoKeyPair;
  const extensions = o.tslProfile
    ? [
        new KeyUsagesExtension(KeyUsageFlags.digitalSignature, true),
        new BasicConstraintsExtension(false, undefined, true),
        await SubjectKeyIdentifierExtension.create(keys.publicKey),
        new ExtendedKeyUsageExtension([OID_TSL_SIGNING]),
      ]
    : o.ca
      ? [
          new KeyUsagesExtension(KeyUsageFlags.keyCertSign | KeyUsageFlags.cRLSign, true),
          new BasicConstraintsExtension(true, 0, true),
          await SubjectKeyIdentifierExtension.create(keys.publicKey),
        ]
      : [new KeyUsagesExtension(KeyUsageFlags.digitalSignature, true)];
  const cert = o.issuer
    ? await X509CertificateGenerator.create({
        serialNumber: "02",
        subject: o.subject,
        issuer: o.issuer.name,
        notBefore: new Date(Date.now() - 86400_000),
        notAfter: new Date(Date.now() + 365 * 86400_000),
        publicKey: keys.publicKey,
        signingKey: o.issuer.keys.privateKey,
        signingAlgorithm: alg,
        extensions,
      })
    : await X509CertificateGenerator.createSelfSigned({
        serialNumber: "01",
        name: o.subject,
        notBefore: new Date(Date.now() - 86400_000),
        notAfter: new Date(Date.now() + 365 * 86400_000),
        keys,
        signingAlgorithm: alg,
        extensions,
      });
  const pkcs8 = Buffer.from(await webcrypto.subtle.exportKey("pkcs8", keys.privateKey)).toString("base64");
  const der = new Uint8Array(cert.rawData);
  return {
    keys,
    keyPem: `-----BEGIN PRIVATE KEY-----\n${pkcs8.match(/.{1,64}/g)!.join("\n")}\n-----END PRIVATE KEY-----\n`,
    certPem: cert.toString("pem"),
    der,
    fp: createHash("sha256").update(der).digest("hex"),
  };
}

const iso = (d: number) => new Date(d).toISOString();

describe("ETSI TS 119 612 XML — üreteç ve XAdES-B-B imzası", () => {
  let signer: Key;
  let weakSigner: Key;
  let ca: Key;
  let issuerCert: Key;
  let statusCert: Key;
  let wpCert: Key;
  let input: TrustedListInput;
  let xml: string;
  const now = Date.parse("2026-10-29T10:00:00Z");

  beforeAll(async () => {
    signer = await makeCert({ subject: "CN=TL signer,O=Test Operator,C=XX", tslProfile: true });
    weakSigner = await makeCert({ subject: "CN=Old signer,O=Test Operator,C=XX", tslProfile: false });
    const caK = await makeCert({ subject: "CN=XX Root,O=Test Operator,C=XX", tslProfile: false, ca: true });
    ca = caK;
    const issuer = { keys: caK.keys, name: "CN=XX Root,O=Test Operator,C=XX" };
    issuerCert = await makeCert({
      subject: "CN=Issuer & Co <Test>,O=Örnek Üniversite,C=XX",
      tslProfile: false,
      issuer,
    });
    statusCert = await makeCert({ subject: "CN=Issuer status,O=Örnek Üniversite,C=XX", tslProfile: false, issuer });
    wpCert = await makeCert({ subject: "CN=WUA,O=Wallet Co,C=XX", tslProfile: false });
    const byFp = new Map([issuerCert, statusCert, wpCert, ca].map((k) => [k.fp, k.der]));
    // İmzalı Tamga listesinin biçimi (SPEC-TRUST-0001): yalnız XML görünümünün okuduğu alanlar
    const tl = {
      state_code: "XX",
      version: 42,
      issued_at: iso(now),
      next_update: iso(now + 90 * 86400_000),
      operator: { name: "Test Operator", status: "provisional", on_behalf_of: "XX authority (to be designated)" },
      root_cas: [
        {
          ca_id: "0xca",
          legal_name: "XX National Root CA",
          status: "ACTIVE",
          status_history: [{ status: "ACTIVE", since: "2026-09-24T00:00:00Z" }],
          cert_fingerprint_sha256: ca.fp,
        },
      ],
      issuers: [
        {
          slug: "ornek",
          legal_name: { tr: "Örnek Üniversite", en: "Example University" },
          class: "EAA",
          status: "SUSPENDED",
          status_history: [
            { status: "ACTIVE", since: "2026-09-25T00:00:00Z" },
            { status: "SUSPENDED", since: "2026-10-20T00:00:00Z" },
          ],
          issuer_url: "https://issuer.example/ornek",
          status_list_base: "https://status.example/",
          cert_fingerprint_sha256: issuerCert.fp,
          delegate_keys: [{ fingerprint_sha256: statusCert.fp, purpose: "status_list", status: "ACTIVE" }],
          postal_address: { street_address: "1 Main St", locality: "Capital", postal_code: "00100", country: "XX" },
          contact: { email: "info@example.org" },
        },
        { slug: "pending", legal_name: "Not yet", class: "EAA", status: "RESERVED", cert_fingerprint_sha256: "00" },
      ],
      relying_parties: [{ dns_name: "verify.example", status: "ACTIVE" }],
    };
    const lotl = {
      wallet_providers: [
        {
          provider_id: "WP-1",
          legal_name: "Wallet Co",
          status: "ACTIVE",
          solutions: [{ solution_id: "w", status: "ACTIVE" }],
          wua_signing_keys: [{ fingerprint_sha256: wpCert.fp, status: "ACTIVE" }],
          postal_address: { street_address: "2 Side St", locality: "Capital", country: "XX" },
          contact: { support_uri: "https://wallet.example" },
        },
        { provider_id: "WP-2", legal_name: "Reserved", status: "RESERVED", wua_signing_keys: [] },
      ],
    };
    const r = trustedListFromTamga(tl, lotl, {
      certByFingerprint: (fp) => byFp.get(fp),
      distributionPoint: "https://trust.example/tl-xx.xml",
      operatorContact: {
        postal: { StreetAddress: "3 Operator Rd", Locality: "Capital", Country: "XX" },
        electronic: ["mailto:ops@example.org"],
        info: ["https://operator.example"],
      },
      pointers: [
        {
          location: "https://trust.example/other.xml",
          signerCertsDer: [weakSigner.der],
          tslType: "http://uri.etsi.org/TrstSvc/TrustedList/TSLType/EUlistofthelists",
          operatorName: "European Commission",
          territory: "EU",
          schemeRules: ["http://uri.etsi.org/TrstSvc/TrustedList/schemerules/EUlistofthelists"],
          mimeType: "application/vnd.etsi.tsl+xml",
        },
      ],
    });
    expect(r.problems).toEqual([]);
    input = r.input;
    xml = signTrustedListXml(buildTrustedListXml(input), { keyPem: signer.keyPem, certDer: signer.der }, new Date(now));
  });

  it("varsayılan kapalı: yalnız TAMGA_TL119612=1 açar", () => {
    expect(tl119612Enabled({})).toBe(false);
    expect(tl119612Enabled({ TAMGA_TL119612: "0" })).toBe(false);
    expect(tl119612Enabled({ TAMGA_TL119612: "true" })).toBe(false);
    expect(tl119612Enabled({ TAMGA_TL119612: "1" })).toBe(true);
  });

  it("imzalı liste ETSI'nin resmî XSD'lerine uyar (TS 119 612 V2.4.1 Ek C)", async () => {
    expect(await schemaErrors(xml)).toEqual([]);
  });

  it("şema denetimi gerçekten çalışır: sıra bozulunca hata", async () => {
    const bad = xml
      .replace(/<SchemeTerritory>XX<\/SchemeTerritory>/, "")
      .replace(
        "</StatusDeterminationApproach>",
        "</StatusDeterminationApproach><SchemeTerritory>XX</SchemeTerritory><Bogus/>",
      );
    expect((await schemaErrors(bad)).length).toBeGreaterThan(0);
  });

  it("imza bağımsız uygulamayla (xml-crypto) ve paketin okuyucusuyla doğrulanır", () => {
    expect(xmlCryptoVerify(xml)).toBe(true);
    const v = verifyEnvelopedXmlSignature(xml);
    expect(v.signerFingerprint).toBe(signer.fp);
    const { list } = readTrustedListXml(xml, new Set([signer.fp]));
    expect(list.sequence).toBe(42);
    expect(list.territory).toBe("XX");
    expect(list.operatorName).toBe("Test Operator");
    expect(list.entities.map((e) => e.name)).toEqual(["Test Operator", "Example University", "Wallet Co"]);
  });

  it("değiştirilmiş liste iki doğrulayıcıda da düşer", () => {
    const tampered = xml.replace("Svcstatus/suspended", "Svcstatus/active");
    expect(tampered).not.toBe(xml);
    expect(() => verifyEnvelopedXmlSignature(tampered)).toThrow(/digest mismatch/);
    expect(xmlCryptoVerify(tampered)).toBe(false);
    const signingTime = xml.replace(/<xades:SigningTime>[^<]+/, "<xades:SigningTime>2020-01-01T00:00:00Z");
    expect(() => verifyEnvelopedXmlSignature(signingTime)).toThrow(/digest mismatch/);
  });

  it("Ek B ve XAdES-B-B: enveloped + Exclusive C14N, tek sertifika, SigningTime / SigningCertificateV2 / DataObjectFormat", () => {
    const doc = parseXml(xml);
    const root = doc.documentElement;
    const sig = doc.getElementsByTagNameNS(DS, "Signature").item(0);
    expect(sig.parentNode).toBe(root);
    expect(doc.getElementsByTagNameNS(DS, "CanonicalizationMethod").item(0).getAttribute("Algorithm")).toBe(
      "http://www.w3.org/2001/10/xml-exc-c14n#",
    );
    const refs = doc.getElementsByTagNameNS(DS, "Reference");
    expect(refs.length).toBe(2);
    const whole = refs.item(0);
    expect(whole.getAttribute("URI")).toBe("");
    const transforms = whole.getElementsByTagNameNS(DS, "Transform");
    expect([0, 1].map((k) => transforms.item(k).getAttribute("Algorithm"))).toEqual([
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
      "http://www.w3.org/2001/10/xml-exc-c14n#",
    ]);
    expect(refs.item(1).getAttribute("Type")).toBe("http://uri.etsi.org/01903#SignedProperties");
    expect(doc.getElementsByTagNameNS(DS, "KeyInfo").item(0).getElementsByTagNameNS(DS, "X509Certificate").length).toBe(
      1,
    );
    expect(doc.getElementsByTagNameNS(XADES, "SigningTime").item(0).textContent).toBe("2026-10-29T10:00:00Z");
    const certDigest = doc
      .getElementsByTagNameNS(XADES, "CertDigest")
      .item(0)
      .getElementsByTagNameNS(DS, "DigestValue")
      .item(0).textContent;
    expect(certDigest).toBe(createHash("sha256").update(signer.der).digest("base64"));
    const dof = doc.getElementsByTagNameNS(XADES, "DataObjectFormat").item(0);
    expect(dof.getAttribute("ObjectReference")).toBe(`#${whole.getAttribute("Id")}`);
  });

  it("içerik: aynı sürüm, Tamga URI'leri, AB 'bildirim' URI'si yok; geçmiş SKI ile; RESERVED ve doğrulayıcılar yok", () => {
    const doc = parseXml(xml);
    const text = (ns: string, n: string) =>
      Array.from(
        { length: doc.getElementsByTagNameNS(ns, n).length },
        (_, k) => doc.getElementsByTagNameNS(ns, n).item(k).textContent,
      );
    expect(text(TSL, "TSLSequenceNumber")).toEqual(["42"]);
    expect(text(TSL, "TSLVersionIdentifier")).toEqual(["6"]);
    const u = tamgaUris("XX");
    expect(text(TSL, "TSLType")[0]).toBe(u.tslType);
    expect(xml).not.toMatch(/EUgeneric|Svcstatus\/granted|recognisedatnationallevel|StatusDetn\/EUappropriate/);
    expect(text(TSL, "ServiceTypeIdentifier")).toEqual(
      expect.arrayContaining([
        "http://uri.etsi.org/TrstSvc/Svctype/CA/PKC",
        "http://uri.etsi.org/TrstSvc/Svctype/EAA",
        u.svc.status_list,
        u.svc.wallet_solution,
      ]),
    );
    expect(xml).not.toContain("Not yet");
    expect(xml).not.toContain("Reserved");
    expect(xml).not.toContain("verify.example");
    // askıdaki kurum listede kalır; önceki ACTIVE durumu geçmişte, sertifika değil SKI ile (§5.6.3)
    const hist = doc.getElementsByTagNameNS(TSL, "ServiceHistoryInstance");
    expect(hist.length).toBe(2); // verme + durum listesi hizmeti
    expect(hist.item(0).getElementsByTagNameNS(TSL, "X509Certificate").length).toBe(0);
    expect(hist.item(0).getElementsByTagNameNS(TSL, "X509SKI").item(0).textContent).toBe(
      Buffer.from(subjectKeyId(issuerCert.der)).toString("base64"),
    );
    expect(hist.item(0).getElementsByTagNameNS(TSL, "ServiceStatus").item(0).textContent).toBe(u.status("ACTIVE"));
    expect(text(TSL, "ListIssueDateTime")).toEqual(["2026-10-29T10:00:00Z"]);
    expect(text(TSL, "HistoricalInformationPeriod")).toEqual(["65535"]);
    expect(text(TSL, "SchemeInformationURI")[0]).toContain("https://trust.example/archive/");
  });

  it("§5.3.15: NextUpdate 6 ayı aşamaz; §5.3.2: sıra numarası ≥ 1", () => {
    expect(() =>
      buildTrustedListXml({ ...input, nextUpdate: new Date(input.issuedAt.getTime() + 200 * 86400_000) }),
    ).toThrow(/6 ayı/);
    expect(() => buildTrustedListXml({ ...input, sequence: 0 })).toThrow(/≥ 1/);
  });

  it("§5.7.1 imzacı profili: uygun sertifikada sorun yok; BC/EKU eksik, C/O farklı sertifikada hata", () => {
    expect(tlSignerProblems(signer.der, { territory: "XX", operatorName: "Test Operator" })).toEqual({
      errors: [],
      warnings: [],
    });
    const weak = tlSignerProblems(weakSigner.der, { territory: "TR", operatorName: "Other" });
    expect(weak.errors.join(" ")).toMatch(/C=XX/);
    expect(weak.errors.join(" ")).toMatch(/O=Test Operator/);
    expect(weak.errors.join(" ")).toMatch(/basicConstraints yok/);
    expect(weak.errors.join(" ")).toMatch(/subjectKeyIdentifier yok/);
    expect(weak.warnings.join(" ")).toMatch(/tslSigning/);
    expect(tlSignerProblems(ca.der, { territory: "XX", operatorName: "Test Operator" }).errors.join(" ")).toMatch(
      /CA=true|keyUsage/,
    );
  });

  it("ADR-0066 (0.7.4): XML imzacısı slotun xml_signing_keys'inde etkin, signing_keys'te değil", () => {
    expect(hasTslSigningEku(signer.der)).toBe(true);
    expect(hasTslSigningEku(weakSigner.der)).toBe(false);
    const k = (fp: string, status = "ACTIVE") => ({ fingerprint_sha256: fp, status });
    expect(xmlSignerSlotProblems({ signing_keys: [k("aa")], xml_signing_keys: [k(signer.fp)] }, signer.fp)).toEqual([]);
    expect(xmlSignerSlotProblems({ signing_keys: [k("aa")] }, signer.fp).join(" ")).toMatch(/etkin değil/);
    expect(xmlSignerSlotProblems({ xml_signing_keys: [k(signer.fp, "REVOKED")] }, signer.fp).join(" ")).toMatch(
      /etkin değil/,
    );
    expect(
      xmlSignerSlotProblems({ signing_keys: [k(signer.fp)], xml_signing_keys: [k(signer.fp)] }, signer.fp).join(" "),
    ).toMatch(/JSON imzacısı/);
    expect(xmlSignerSlotProblems(undefined, signer.fp)).toHaveLength(1);
  });

  it("eksik yayın verisi raporlanır (işletmeci adresi, sertifikası bulunmayan kayıt)", () => {
    const r = trustedListFromTamga(
      {
        state_code: "XX",
        version: 1,
        issued_at: iso(now),
        next_update: iso(now + 86400_000),
        operator: { name: "Op" },
        root_cas: [],
        issuers: [{ slug: "x", legal_name: "X", class: "EAA", status: "ACTIVE", cert_fingerprint_sha256: "ab" }],
      },
      { wallet_providers: [] },
      { certByFingerprint: () => undefined, distributionPoint: "https://trust.example/tl-xx.xml" },
    );
    expect(r.problems.join(" ")).toMatch(/işletmeci posta adresi/);
    expect(r.problems.join(" ")).toMatch(/issuer x: ab parmak izli sertifika bulunamadı/);
  });

  it("cüzdan çözümünün zaman çizelgesi çözümün kendi geçmişi; yinelenen geçmiş örneği yok; şemaya uyar", async () => {
    const byFp = new Map([wpCert, ca].map((k) => [k.fp, k.der]));
    const tl = {
      state_code: "XX",
      version: 7,
      issued_at: iso(now),
      next_update: iso(now + 86400_000),
      operator: { name: "Test Operator" },
      root_cas: [
        {
          ca_id: "0xca",
          legal_name: "XX National Root CA",
          status: "ACTIVE",
          // aynı durum iki kez + güncel durumla aynı an: tek değişiklik sayılır, geçmişe yazılmaz
          status_history: [
            { status: "ACTIVE", since: "2026-09-24T00:00:00Z" },
            { status: "ACTIVE", since: "2026-09-30T00:00:00Z" },
          ],
          cert_fingerprint_sha256: ca.fp,
        },
      ],
      issuers: [],
    };
    const provider = (status: string, solutions: unknown[]) => ({
      wallet_providers: [
        {
          provider_id: "WP-1",
          legal_name: "Wallet Co",
          status,
          // sağlayıcının geçmişi: çözümün çizelgesine KOPYALANMAMALI
          status_history: [
            { status: "ACTIVE", since: "2026-01-01T00:00:00Z" },
            { status: "SUSPENDED", since: "2026-03-01T00:00:00Z" },
            { status: "ACTIVE", since: "2026-04-01T00:00:00Z" },
            ...(status === "SUSPENDED" ? [{ status: "SUSPENDED", since: "2026-10-01T00:00:00Z" }] : []),
          ],
          solutions,
          wua_signing_keys: [{ fingerprint_sha256: wpCert.fp, status: "ACTIVE" }],
          postal_address: { street_address: "2 Side St", locality: "Capital", country: "XX" },
          contact: { support_uri: "https://wallet.example" },
        },
      ],
    });
    const opts = {
      certByFingerprint: (fp: string) => byFp.get(fp),
      distributionPoint: "https://trust.example/tl-xx.xml",
      operatorContact: {
        postal: { StreetAddress: "3 Rd", Locality: "Capital", Country: "XX" },
        electronic: ["mailto:o@x.org"],
      },
    };
    const svc = (inp: TrustedListInput, name: string) =>
      inp.tsps.flatMap((t) => t.services).find((x) => x.name === name)!;
    const u = tamgaUris("XX");
    // 1) çözümün kendi geçmişi yok → başlangıç sağlayıcının listeye ilk girdiği an; geçmiş boş (sağlayıcının askısı yok)
    const a = trustedListFromTamga(tl, provider("ACTIVE", [{ solution_id: "w", status: "ACTIVE" }]), opts).input;
    const sa = svc(a, "Wallet Co (w)");
    expect(sa.since).toBe("2026-01-01T00:00:00Z");
    expect(sa.history).toEqual([]);
    // kök CA: art arda aynı durum tek değişiklik, güncel durum geçmişe yinelenmez
    const ra = svc(a, "XX National Root CA");
    expect(ra.since).toBe("2026-09-24T00:00:00Z");
    expect(ra.history).toEqual([]);
    // 2) çözümün kendi geçmişi var → onu kullanır
    const b = trustedListFromTamga(
      tl,
      provider("ACTIVE", [
        {
          solution_id: "w",
          status: "ACTIVE",
          status_history: [
            { status: "SUSPENDED", since: "2026-06-01T00:00:00Z" },
            { status: "ACTIVE", since: "2026-07-01T00:00:00Z" },
          ],
        },
      ]),
      opts,
    ).input;
    const sb = svc(b, "Wallet Co (w)");
    expect(sb.since).toBe("2026-07-01T00:00:00Z");
    expect(sb.history).toEqual([{ statusUri: u.status("SUSPENDED"), since: "2026-06-01T00:00:00Z" }]);
    // 3) sağlayıcı askıda → çözüm askıda, askının başlangıcı sağlayıcınınki; önceki durum çözümün kendi etkin durumu
    const c = trustedListFromTamga(
      tl,
      provider("SUSPENDED", [
        { solution_id: "w", status: "ACTIVE", status_history: [{ status: "ACTIVE", since: "2026-05-01T00:00:00Z" }] },
      ]),
      opts,
    ).input;
    const sc = svc(c, "Wallet Co (w)");
    expect(sc.statusUri).toBe(u.status("SUSPENDED"));
    expect(sc.since).toBe("2026-10-01T00:00:00Z");
    expect(sc.history).toEqual([{ statusUri: u.status("ACTIVE"), since: "2026-05-01T00:00:00Z" }]);
    // XML: her hizmette geçmiş örnekleri benzersiz (tür + durum + başlangıç) ve şema geçerli
    const signed = signTrustedListXml(
      buildTrustedListXml(c),
      { keyPem: signer.keyPem, certDer: signer.der },
      new Date(now),
    );
    expect(await schemaErrors(signed)).toEqual([]);
    const doc = parseXml(signed);
    const services = doc.getElementsByTagNameNS(TSL, "TSPService");
    for (let k = 0; k < services.length; k++) {
      const hs = services.item(k).getElementsByTagNameNS(TSL, "ServiceHistoryInstance");
      const keys = Array.from({ length: hs.length }, (_, j) => {
        const h = hs.item(j);
        return `${h.getElementsByTagNameNS(TSL, "ServiceStatus").item(0).textContent}@${h.getElementsByTagNameNS(TSL, "StatusStartingTime").item(0).textContent}`;
      });
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("XML 1.0'da geçersiz karakter: gerçek ağda ret, sandbox'ta çıkarılır + uyarı; çıktı şemaya uyar", async () => {
    const bad = "Örnek\u0001 Üniversite\uFFFE\uFFFF\u0008"; // C0 denetim + U+FFFE/FFFF
    expect(hasXml10InvalidChars(bad)).toBe(true);
    expect(hasXml10InvalidChars("tab\tcr\rlf\n 𝔘 ok")).toBe(false); // izinli: sekme, CR, LF, BMP dışı
    const dirty: TrustedListInput = {
      ...input,
      tsps: input.tsps.map((t, k) => (k === 1 ? { ...t, name: { tr: bad, en: "Example University" } } : t)),
    };
    // üreteç geçersiz karakterle hiç XML üretmez (son savunma)
    expect(() => buildTrustedListXml(dirty)).toThrow(/geçersiz karakter/);
    expect(() => sanitizeTrustedListInput(dirty, "reject")).toThrow(
      /tsps\[1\]\.name\.tr: .*U\+0001.*U\+FFFE.*U\+FFFF.*U\+0008/,
    );
    const { input: clean, findings } = sanitizeTrustedListInput(dirty, "strip");
    expect(findings).toHaveLength(1);
    expect(findings[0]).not.toContain("Örnek"); // bulgu içeriği tekrar etmez
    expect((clean.tsps[1].name as Record<string, string>).tr).toBe("Örnek Üniversite");
    expect(clean.issuedAt).toBeInstanceOf(Date);
    expect(clean.tsps[1].services[0].certsDer[0]).toBeInstanceOf(Uint8Array);
    const signed = signTrustedListXml(
      buildTrustedListXml(clean),
      { keyPem: signer.keyPem, certDer: signer.der },
      new Date(now),
    );
    expect(await schemaErrors(signed)).toEqual([]);
    expect(sanitizeTrustedListInput(input, "reject").findings).toEqual([]);
  });
});

describe("depodaki sandbox örneği (test/fixtures/tl119612)", () => {
  it("şemaya uyar, imzası iki doğrulayıcıda tutar, sandbox XML imzacısıyla (§5.7.1) imzalı", async () => {
    const sample = readFileSync(SAMPLE, "utf8");
    expect(await schemaErrors(sample)).toEqual([]);
    expect(xmlCryptoVerify(sample)).toBe(true);
    // ADR-0066 K4: ayrı XML imzacısı `tl-xml-signer-1` (sandbox kökünce verilmiş, §5.7.1 profili — hata da uyarı da yok)
    const sandboxSigner = readFileSync(resolve(ROOT, "ops/pki-sandbox/tl-xml-signer-1.cert.pem"), "utf8");
    const signerDer = Buffer.from(sandboxSigner.replace(/-----[^-]+-----|\s+/g, ""), "base64");
    expect(
      tlSignerProblems(new Uint8Array(signerDer), { territory: "TR", operatorName: "Tamga Network Sandbox (TEST)" }),
    ).toEqual({ errors: [], warnings: [] });
    const fp = createHash("sha256").update(signerDer).digest("hex");
    const { list } = readTrustedListXml(sample, new Set([fp]));
    expect(list.territory).toBe("TR");
    expect(sample).toContain("SANDBOX — test network");
    expect(sample).toContain("https://trust.sandbox.tamga.network/tl-tr.xml");
  });
});

// ---- yayıncı: build entegrasyonu ----
const ready =
  existsSync(resolve(ROOT, "ops/pki/tl-signer-1.pkcs8.pem")) &&
  existsSync(resolve(ROOT, "packages/schemas/dist/index.json"));

describe.skipIf(!ready)("trust-publisher build: TS 119 612 XML (bayrak)", () => {
  const tmp = mkdtempSync(join(tmpdir(), "tamga-tl119612-"));
  const REG = join(tmp, "registry");
  const PKI = join(tmp, "pki");
  const run = (dist: string, env: Record<string, string>) => {
    mkdirSync(dist, { recursive: true });
    return spawnSync(process.execPath, [TSX, CLI, "build"], {
      cwd: ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        TAMGA_TP_REGISTRY: REG,
        TAMGA_TP_DIST: dist,
        TAMGA_TP_PKI: PKI,
        TAMGA_TL119612: "",
        ...env,
      },
      timeout: 60_000,
    });
  };
  let signerFp = "";

  beforeAll(async () => {
    cpSync(resolve(APP, "test/fixtures/registry"), REG, { recursive: true });
    cpSync(resolve(ROOT, "ops/pki"), PKI, { recursive: true });
    // §5.7.1'e uygun ayrı imzacı (gerçek ağ adı ve ülke kodu; geçici PKI'da)
    const s = await makeCert({ subject: "CN=Tamga TL XML signer,O=Tamga Network,C=TR", tslProfile: true });
    writeFileSync(join(PKI, "tl-xml-signer-test.cert.pem"), s.certPem);
    writeFileSync(join(PKI, "tl-xml-signer-test.pkcs8.pem"), s.keyPem);
    signerFp = s.fp;
    // yayın verisi (adresler) tamamlanmış kayıt defteri
    const l = JSON.parse(readFileSync(join(REG, "lotl.source.json"), "utf8"));
    l.operator.lote_contact.postal = { StreetAddress: "Test Street 1", Locality: "Ankara", Country: "TR" };
    for (const w of l.wallet_providers) {
      w.postal_address = { street_address: "Test Street 2", locality: "Ankara", country: "TR" };
      w.contact = { support_uri: "https://wallet-provider.test" };
    }
    // ADR-0066 (uygulama notu 0.7.4): XML imzacısı slotun ayrı xml_signing_certs alanında
    l.national_lists.find((n: { state_code: string }) => n.state_code === "TR").xml_signing_certs = [
      "tl-xml-signer-test",
    ];
    writeFileSync(join(REG, "lotl.source.json"), JSON.stringify(l, null, 2));
    const t = JSON.parse(readFileSync(join(REG, "tl-tr.source.json"), "utf8"));
    for (const i of t.issuers) {
      i.postal_address ??= { street_address: "Test Street 3", locality: "Istanbul", country: "TR" };
      i.contact ??= { email: "info@example.org" };
    }
    writeFileSync(join(REG, "tl-tr.source.json"), JSON.stringify(t, null, 2));
  });
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it("bayrak kapalıyken XML üretilmez", () => {
    const dist = join(tmp, "off");
    const r = run(dist, {});
    expect(r.status, r.stderr).toBe(0);
    expect(existsSync(join(dist, "tl-tr.jws"))).toBe(true);
    expect(existsSync(join(dist, "tl-tr.xml"))).toBe(false);
    expect(existsSync(join(dist, "tl-tr.sha2"))).toBe(false);
  });

  it("gerçek ağda §5.7.1'e uymayan imzacı (varsayılan liste imzacısı) XML yayınını durdurur", () => {
    const dist = join(tmp, "weak");
    const r = run(dist, { TAMGA_TL119612: "1" });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/TS 119 612 XML yayınlanmadı/);
    expect(r.stderr).toMatch(/basicConstraints/);
    expect(existsSync(join(dist, "tl-tr.xml"))).toBe(false);
  });

  it("bayrak + uygun imzacı: aynı sürümden imzalı XML, .sha2 özeti, arşiv kopyası, imzacı sertifikası keys/'de", async () => {
    const dist = join(tmp, "on");
    const r = run(dist, { TAMGA_TL119612: "1", TAMGA_TL119612_SIGNER: "tl-xml-signer-test" });
    expect(r.status, r.stderr).toBe(0);
    const xml = readFileSync(join(dist, "tl-tr.xml"), "utf8");
    const tl = JSON.parse(readFileSync(join(dist, "tl-tr.json"), "utf8"));
    expect(readFileSync(join(dist, "tl-tr.sha2"), "utf8").trim()).toBe(
      createHash("sha256")
        .update(readFileSync(join(dist, "tl-tr.xml")))
        .digest("hex"),
    );
    expect(existsSync(join(dist, "archive", `tl-tr.v${String(tl.version).padStart(4, "0")}.xml`))).toBe(true);
    expect(existsSync(join(dist, "keys", "tl-xml-signer-test.cert.pem"))).toBe(true);
    expect(await schemaErrors(xml)).toEqual([]);
    expect(xmlCryptoVerify(xml)).toBe(true);
    const { list } = readTrustedListXml(xml, new Set([signerFp]));
    expect(list.sequence).toBe(tl.version);
    expect(list.issuedAt.toISOString().replace(/\.\d{3}Z$/, "Z")).toBe(tl.issued_at.replace(/\.\d{3}Z$/, "Z"));
    // operatör + belge verenler (REVOKED dahil, geçmişiyle) + cüzdan sağlayıcı; doğrulayıcı yok
    const names = list.entities.map((e) => e.name);
    expect(names[0]).toBe("Tamga Network");
    for (const i of tl.issuers.filter((x: { status: string }) => x.status !== "RESERVED"))
      expect(names).toContain(typeof i.legal_name === "string" ? i.legal_name : Object.values(i.legal_name)[0]);
    expect(xml).toContain("https://trust.tamga.network/tl-tr.xml");
    // ADR-0066 (uygulama notu 0.7.4): LOTL'da XML imzacısı yalnız xml_signing_keys'te; JSON imzacıları ayrı
    const slot = JSON.parse(readFileSync(join(dist, "lotl.json"), "utf8")).national_lists.find(
      (n: { state_code: string }) => n.state_code === "TR",
    );
    expect(slot.xml_signing_keys.map((k: { fingerprint_sha256: string }) => k.fingerprint_sha256)).toEqual([signerFp]);
    expect(slot.signing_keys.map((k: { fingerprint_sha256: string }) => k.fingerprint_sha256)).not.toContain(signerFp);
    // TSP sayısı: işletmeci + listelenebilir belge verenler + cüzdan sağlayıcı — doğrulayıcılar güven hizmeti sağlayıcısı değildir
    const lotl = JSON.parse(readFileSync(join(dist, "lotl.json"), "utf8"));
    const listable = (x: { status: string }) => !["RESERVED", "PROVISIONAL"].includes(x.status);
    expect(list.entities.length).toBe(
      1 + tl.issuers.filter(listable).length + lotl.wallet_providers.filter(listable).length,
    );
  });
  const regVariant = (name: string, edit: (slot: Record<string, unknown>) => void) => {
    const dir = join(tmp, `registry-${name}`);
    cpSync(REG, dir, { recursive: true });
    const l = JSON.parse(readFileSync(join(dir, "lotl.source.json"), "utf8"));
    edit(l.national_lists.find((n: { state_code: string }) => n.state_code === "TR"));
    writeFileSync(join(dir, "lotl.source.json"), JSON.stringify(l, null, 2));
    return dir;
  };

  it("ADR-0066: gerçek ağda imzacı slotun xml_signing_keys'inde değilse XML yayınlanmaz", () => {
    const dist = join(tmp, "noslot");
    const r = run(dist, {
      TAMGA_TP_REGISTRY: regVariant("noslot", (s) => delete s.xml_signing_certs),
      TAMGA_TL119612: "1",
      TAMGA_TL119612_SIGNER: "tl-xml-signer-test",
    });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/xml_signing_keys'inde etkin değil/);
    expect(existsSync(join(dist, "tl-tr.xml"))).toBe(false);
  });

  it("ADR-0066: tslSigning EKU'lu sertifika signing_certs'e (JSON imzacısı) konamaz", () => {
    const dist = join(tmp, "mixed");
    const r = run(dist, {
      TAMGA_TP_REGISTRY: regVariant("mixed", (s) => {
        s.signing_certs = [...(s.signing_certs as string[]), "tl-xml-signer-test"];
        delete s.xml_signing_certs;
      }),
    });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/xml_signing_certs'e konur/);
  });
});
