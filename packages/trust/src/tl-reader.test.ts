/**
 * ETSI TS 119 612 güven listesi (XML) okuyucusu. İmzalar BAĞIMSIZ bir uygulamayla (xml-crypto, yalnız geliştirme bağımlılığı)
 * üretilir; okuyucunun kanonikleştirmesi ve imza doğrulaması böylece kendi kendine sınanmaz. ECDSA için xml-crypto'ya Node
 * `crypto` ile küçük bir imza algoritması eklenir (r||s, RFC 4050). Gerçek AB listeleri (AB LOTL ve 8 ülke; RSA ve ECDSA) geliştirme
 * sırasında elle doğrulandı; depoya dış dosya konmaz.
 */
import { describe, expect, it, beforeAll } from "vitest";
import { createHash, createSign, generateKeyPairSync, webcrypto, type KeyObject } from "node:crypto";
import { SignedXml } from "xml-crypto";
import { X509CertificateGenerator, cryptoProvider } from "@peculiar/x509";
import { readTrustedListXml, parseTrustedListDom, tlServiceKind } from "./tl-reader.js";
import { certPublicKey, verifyEnvelopedXmlSignature, XmlSignatureError } from "./xmldsig.js";

cryptoProvider.set(webcrypto as unknown as Crypto);

const EXC = "http://www.w3.org/2001/10/xml-exc-c14n#";
const C14N = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
const ENV = "http://www.w3.org/2000/09/xmldsig#enveloped-signature";
const ECDSA_SHA256 = "http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256";

class EcdsaSha256 {
  getSignature(signedInfo: string, privateKey: KeyObject) {
    return createSign("sha256").update(signedInfo).sign({ key: privateKey, dsaEncoding: "ieee-p1363" }, "base64");
  }
  verifySignature() {
    return false;
  }
  getAlgorithmName() {
    return ECDSA_SHA256;
  }
}

interface Signer {
  key: KeyObject;
  certPem: string;
  der: Uint8Array;
  fp: string;
  alg: string;
}
async function signer(kind: "rsa" | "ec", rsaBits = 2048): Promise<Signer> {
  const gen =
    kind === "rsa"
      ? {
          name: "RSASSA-PKCS1-v1_5",
          modulusLength: rsaBits,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: "SHA-256",
        }
      : { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" };
  const keys = (await webcrypto.subtle.generateKey(gen, true, ["sign", "verify"])) as CryptoKeyPair;
  const cert = await X509CertificateGenerator.createSelfSigned({
    serialNumber: "01",
    name: `CN=Test TL signer ${kind}`,
    notBefore: new Date(Date.now() - 86400_000),
    notAfter: new Date(Date.now() + 30 * 86400_000),
    keys,
    signingAlgorithm: gen,
  });
  const pkcs8 = Buffer.from(await webcrypto.subtle.exportKey("pkcs8", keys.privateKey));
  const { createPrivateKey } = await import("node:crypto");
  const der = new Uint8Array(cert.rawData);
  return {
    key: createPrivateKey({ key: pkcs8, format: "der", type: "pkcs8" }),
    certPem: cert.toString("pem"),
    der,
    fp: createHash("sha256").update(der).digest("hex"),
    alg: kind === "rsa" ? "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256" : ECDSA_SHA256,
  };
}

const b64 = (u: Uint8Array) => Buffer.from(u).toString("base64");
/** TS 119 612 V2.4.1 biçiminde en küçük liste: varsayılan ad alanı, xml:lang'lı adlar, karışık hizmet türleri. */
function tl(o: {
  serviceCert: Uint8Array;
  sequence?: number;
  version?: number;
  territory?: string;
  nextUpdate?: string;
}) {
  const svc = (type: string, status: string, name: string) => `
      <TSPService><ServiceInformation>
        <ServiceTypeIdentifier>http://uri.etsi.org/TrstSvc/Svctype/${type}</ServiceTypeIdentifier>
        <ServiceName><Name xml:lang="tr">${name} (tr)</Name><Name xml:lang="en">${name}</Name></ServiceName>
        <ServiceDigitalIdentity><DigitalId><X509Certificate>${b64(o.serviceCert)}</X509Certificate></DigitalId></ServiceDigitalIdentity>
        <ServiceStatus>http://uri.etsi.org/TrstSvc/TrustedList/Svcstatus/${status}</ServiceStatus>
        <StatusStartingTime>2026-01-01T00:00:00Z</StatusStartingTime>
      </ServiceInformation></TSPService>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<TrustServiceStatusList xmlns="http://uri.etsi.org/02231/v2#" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Id="tsl" TSLTag="http://uri.etsi.org/19612/TSLTag">
  <SchemeInformation>
    <TSLVersionIdentifier>${o.version ?? 6}</TSLVersionIdentifier>
    <TSLSequenceNumber>${o.sequence ?? 7}</TSLSequenceNumber>
    <TSLType>http://uri.etsi.org/TrstSvc/TrustedList/TSLType/EUgeneric</TSLType>
    <SchemeOperatorName><Name xml:lang="en">Test &amp; Scheme "Operator"</Name></SchemeOperatorName>
    <SchemeTerritory>${o.territory ?? "XX"}</SchemeTerritory>
    <ListIssueDateTime>2026-10-01T00:00:00Z</ListIssueDateTime>
    <NextUpdate><dateTime>${o.nextUpdate ?? "2027-04-01T00:00:00Z"}</dateTime></NextUpdate>
  </SchemeInformation>
  <TrustServiceProviderList>
    <TrustServiceProvider>
      <TSPInformation><TSPName><Name xml:lang="en">Örnek EAA Sağlayıcısı</Name></TSPName></TSPInformation>
      <TSPServices>${svc("EAA/Q", "granted", "QEAA issuance")}${svc("EAA", "recognisedatnationallevel", "EAA issuance")}${svc(
        "EAA/Pub-EAA",
        "withdrawn",
        "Old Pub-EAA",
      )}${svc("CA/QC", "granted", "Qualified CA")}
      </TSPServices>
    </TrustServiceProvider>
  </TrustServiceProviderList>
</TrustServiceStatusList>`;
}

function sign(xml: string, s: Signer, c14n = EXC) {
  const sx = new SignedXml({
    privateKey: s.key,
    publicCert: s.certPem,
    signatureAlgorithm: s.alg as never,
    canonicalizationAlgorithm: c14n as never,
  });
  sx.SignatureAlgorithms[ECDSA_SHA256 as never] = EcdsaSha256 as never;
  sx.addReference({
    xpath: "/*",
    transforms: [ENV, c14n] as never,
    digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256",
    isEmptyUri: true,
  });
  sx.computeSignature(xml, { prefix: "ds", location: { reference: "/*", action: "append" } });
  return sx.getSignedXml();
}

describe("ETSI TS 119 612 güven listesi okuyucusu (XMLDSig)", () => {
  let rsa: Signer;
  let ec: Signer;
  let serviceCert: Uint8Array;
  beforeAll(async () => {
    rsa = await signer("rsa");
    ec = await signer("ec");
    serviceCert = (await signer("ec")).der;
  });

  it.each([
    ["RSA, Exclusive C14N", "rsa", EXC],
    ["ECDSA P-256, Exclusive C14N", "ec", EXC],
    ["RSA, C14N 1.0", "rsa", C14N],
  ])("%s: imza doğrulanır, liste ortak modele çevrilir", (_n, kind, c14n) => {
    const s = kind === "rsa" ? rsa : ec;
    const { list, signerFingerprint } = readTrustedListXml(sign(tl({ serviceCert }), s, c14n), new Set([s.fp]));
    expect(signerFingerprint).toBe(s.fp);
    expect(list).toMatchObject({ sequence: 7, territory: "XX", operatorName: 'Test & Scheme "Operator"' });
    expect(list.nextUpdate.toISOString()).toBe("2027-04-01T00:00:00.000Z");
    const svcs = list.entities[0].services;
    expect(list.entities[0].name).toBe("Örnek EAA Sağlayıcısı");
    // geri çekilmiş Pub-EAA alınmaz; CA/QC Tamga rolüne karşılık gelmez
    expect(svcs.map((x) => [x.kind, x.name])).toEqual([
      ["eaa_provider", "QEAA issuance"],
      ["eaa_provider", "EAA issuance"],
      [null, "Qualified CA"],
    ]);
    expect(Buffer.from(svcs[0].certsDer[0]).equals(Buffer.from(serviceCert))).toBe(true);
  });

  it("imzacı sabitlenmiş parmak izi değilse yüklenmez", () => {
    expect(() => readTrustedListXml(sign(tl({ serviceCert }), rsa), new Set([ec.fp]))).toThrow(/pinned signer/);
  });

  it("pin denetimi imza doğrulamasından ÖNCE: sabitlenmemiş imzacının bozuk listesi özet/imza hesabına girmez", () => {
    const signed = sign(tl({ serviceCert }), ec);
    const tampered = signed.replace("<TSLSequenceNumber>7<", "<TSLSequenceNumber>8<");
    // sabitlenmiş olsaydı özet hatası verirdi; sabitlenmemişken ilk ve tek hata pin hatasıdır
    expect(() => readTrustedListXml(tampered, new Set([ec.fp]))).toThrow(/digest mismatch/);
    expect(() => readTrustedListXml(tampered, new Set([rsa.fp]))).toThrow(/pinned signer/);
    const sv = /<ds:SignatureValue>([^<]+)</.exec(signed)![1];
    const badSig = signed.replace(sv, (sv[0] === "A" ? "B" : "A") + sv.slice(1));
    expect(() => readTrustedListXml(badSig, new Set([rsa.fp]))).toThrow(/pinned signer/);
    // geri çağrı imzacı sertifikası ve parmak iziyle, hesaplardan önce çağrılır
    const seen: string[] = [];
    expect(() =>
      verifyEnvelopedXmlSignature(tampered, {
        checkSigner: (der, fp) => {
          seen.push(fp, createHash("sha256").update(der).digest("hex"));
          throw new Error("stop");
        },
      }),
    ).toThrow(/^stop$/);
    expect(seen).toEqual([ec.fp, ec.fp]);
  });

  it("RSA anahtar sınırları: modül 2048–4096 bit, açık üs tek ve en çok 2^32+1", async () => {
    const weak = await signer("rsa", 1024);
    expect(() => readTrustedListXml(sign(tl({ serviceCert }), weak), new Set([weak.fp]))).toThrow(
      /RSA modulus of 1024/,
    );
    expect(certPublicKey(rsa.der)).toMatchObject({ kind: "rsa", e: 65537n });
    // el yapımı sertifika iskeleti: yalnız subjectPublicKeyInfo okunur
    const t = (tag: number, ...parts: Uint8Array[]) => {
      const body = Buffer.concat(parts);
      const len =
        body.length < 0x80
          ? [body.length]
          : body.length < 0x100
            ? [0x81, body.length]
            : [0x82, body.length >> 8, body.length & 0xff];
      return new Uint8Array([tag, ...len, ...body]);
    };
    const int = (b: Uint8Array) => t(0x02, b[0] & 0x80 ? new Uint8Array([0, ...b]) : b);
    const rsaCert = (nBytes: number, e: number[]) => {
      const n = new Uint8Array(nBytes).fill(0xab);
      n[0] = 0xc1;
      const spki = t(
        0x30,
        t(0x30, t(0x06, Buffer.from("2a864886f70d010101", "hex")), new Uint8Array([0x05, 0])),
        t(0x03, new Uint8Array([0]), t(0x30, int(n), int(new Uint8Array(e)))),
      );
      const empty = t(0x30);
      const tbs = t(
        0x30,
        t(0xa0, t(0x02, new Uint8Array([2]))),
        t(0x02, new Uint8Array([1])),
        empty,
        empty,
        empty,
        empty,
        spki,
      );
      return t(0x30, tbs, empty, t(0x03, new Uint8Array([0])));
    };
    expect(certPublicKey(rsaCert(256, [1, 0, 1]))).toMatchObject({ kind: "rsa", e: 65537n });
    expect(() => certPublicKey(rsaCert(520, [1, 0, 1]))).toThrow(/RSA modulus of 4160/);
    expect(() => certPublicKey(rsaCert(256, [1, 0, 0, 0, 3]))).toThrow(/exponent/); // 2^32+3
    expect(certPublicKey(rsaCert(256, [1, 0, 0, 0, 1]))).toMatchObject({ e: 2n ** 32n + 1n });
    expect(() => certPublicKey(rsaCert(256, [1, 0, 2]))).toThrow(/exponent/); // çift
    expect(() => certPublicKey(rsaCert(256, [1]))).toThrow(/exponent/);
  });

  it("imzalı içerik değişirse (sıra no, hizmet durumu) özet tutmaz", () => {
    const signed = sign(tl({ serviceCert }), ec);
    for (const bad of [
      signed.replace("<TSLSequenceNumber>7<", "<TSLSequenceNumber>8<"),
      signed.replace("Svcstatus/withdrawn", "Svcstatus/granted"),
    ])
      expect(() => verifyEnvelopedXmlSignature(bad)).toThrow(/digest mismatch/);
  });

  it("imza değeri bozulursa ya da başka anahtarın sertifikası konursa ret", () => {
    const signed = sign(tl({ serviceCert }), rsa);
    const sv = /<ds:SignatureValue>([^<]+)</.exec(signed)![1];
    const flipped = (sv[5] === "A" ? "B" : "A") + "";
    expect(() => verifyEnvelopedXmlSignature(signed.replace(sv, sv.slice(0, 5) + flipped + sv.slice(6)))).toThrow(
      XmlSignatureError,
    );
    const other = b64(ec.der);
    const cert = /<ds:X509Certificate>([^<]+)</.exec(signed)![1];
    expect(() => verifyEnvelopedXmlSignature(signed.replace(cert, other))).toThrow(/not the certificate key|RSA/);
  });

  it("imzanın dışına eklenen ikinci imza, DTD ve imzasız liste reddedilir", () => {
    const signed = sign(tl({ serviceCert }), ec);
    const sigEl = /<ds:Signature[\s\S]*<\/ds:Signature>/.exec(signed)![0];
    expect(() =>
      verifyEnvelopedXmlSignature(signed.replace("</TrustServiceStatusList>", sigEl + "</TrustServiceStatusList>")),
    ).toThrow(/exactly one ds:Signature/);
    expect(() =>
      verifyEnvelopedXmlSignature(
        signed.replace("<TrustServiceStatusList", '<!DOCTYPE x [<!ENTITY a "b">]><TrustServiceStatusList'),
      ),
    ).toThrow(/DTD/);
    expect(() => verifyEnvelopedXmlSignature(tl({ serviceCert }))).toThrow(/exactly one ds:Signature/);
  });

  it("bilinmeyen TSLVersionIdentifier yüklenmez (CMP2); NextUpdate yoksa (kapanmış liste) ret", () => {
    const v = verifyEnvelopedXmlSignature(sign(tl({ serviceCert, version: 7 }), ec));
    expect(() => parseTrustedListDom(v.root)).toThrow(/TSLVersionIdentifier/);
    const closed = verifyEnvelopedXmlSignature(sign(tl({ serviceCert, nextUpdate: "" }), ec));
    expect(() => parseTrustedListDom(closed.root)).toThrow(/NextUpdate/);
  });

  it("hizmet türü eşlemesi", () => {
    expect(tlServiceKind("http://uri.etsi.org/TrstSvc/Svctype/EAA/Q")).toBe("eaa_provider");
    expect(tlServiceKind("http://uri.etsi.org/TrstSvc/Svctype/EAA")).toBe("eaa_provider");
    expect(tlServiceKind("http://uri.etsi.org/TrstSvc/Svctype/EAA/Pub-EAA")).toBe("eaa_provider");
    expect(tlServiceKind("http://uri.etsi.org/TrstSvc/Svctype/EAAValidation")).toBeNull();
    expect(tlServiceKind("http://uri.etsi.org/TrstSvc/Svctype/CA/QC")).toBeNull();
  });
});
