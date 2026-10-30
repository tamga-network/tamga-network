/**
 * K11 dış denetim hazırlığı — güven listesi ayrıştırıcıları için özellik (fuzz) ve düşmanca girdi testleri (fast-check):
 *  - ETSI TS 119 612 XML (ADR-0066 / ADR-0036): XXE (dış varlık, parametre varlığı), "milyar kahkaha", DOCTYPE'ın her yazımı,
 *    aşırı iç içelik, çok sayıda öznitelik, bozuk XML, rastgele dize → yalnız `XmlSignatureError` / `LoteParseError`, sınırlı
 *    sürede; ağ ya da dosya erişimi yok. İmzalı listenin her tek karakterlik bozulması ya reddedilir ya da AYNI listeyi verir
 *    (imzasız alanda: XML bildirimi gibi). Sabitlenmemiş imzacının listesi okunmaz.
 *  - ETSI LoTE JSON (`parseLote`): rastgele JSON → sonuç ya da `LoteParseError`.
 *  - Tamga liste şemaları (`Lotl`, `NationalList`, zod): rastgele JSON `safeParse`'ta çökmez.
 *  - Liste JWS başlığı (`verifyJws`): yalnız ES256, beklenen `typ`, sabitlenmiş imzacı; rastgele dize reddedilir.
 * Tekrar: `FC_SEED=<tohum> npx vitest run packages/trust/src/property.test.ts`.
 */
import { beforeAll, describe, expect, it } from "vitest";
import fc from "fast-check";
import { createHash, createPrivateKey, createSign, webcrypto, type KeyObject } from "node:crypto";
import { SignedXml } from "xml-crypto";
import { X509CertificateGenerator, cryptoProvider } from "@peculiar/x509";
import { CompactSign } from "jose";
import { readTrustedListXml } from "./tl-reader.js";
import { parseXml, verifyEnvelopedXmlSignature, XmlSignatureError } from "./xmldsig.js";
import { LoteParseError, parseLote } from "./lote-reader.js";
import { Lotl, NationalList } from "./types.js";
import { verifyJws } from "./jws.js";

cryptoProvider.set(webcrypto as unknown as Crypto);
const seed = process.env.FC_SEED ? Number(process.env.FC_SEED) : undefined;
const RUNS = Number(process.env.FC_RUNS ?? 200);
const params = { numRuns: RUNS, ...(seed !== undefined ? { seed } : {}) };

const EXC = "http://www.w3.org/2001/10/xml-exc-c14n#";
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

let key: KeyObject;
let cryptoKey: CryptoKey;
let certPem: string;
let der: Uint8Array;
let fp: string;
beforeAll(async () => {
  const alg = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" };
  const keys = (await webcrypto.subtle.generateKey(alg, true, ["sign", "verify"])) as CryptoKeyPair;
  const cert = await X509CertificateGenerator.createSelfSigned({
    serialNumber: "01",
    name: "CN=K11 list signer",
    notBefore: new Date(Date.now() - 86400_000),
    notAfter: new Date(Date.now() + 30 * 86400_000),
    keys,
    signingAlgorithm: alg,
  });
  key = createPrivateKey({
    key: Buffer.from(await webcrypto.subtle.exportKey("pkcs8", keys.privateKey)),
    format: "der",
    type: "pkcs8",
  });
  cryptoKey = keys.privateKey;
  certPem = cert.toString("pem");
  der = new Uint8Array(cert.rawData);
  fp = createHash("sha256").update(der).digest("hex");
});

const LIST = (svcCert: string) => `<?xml version="1.0" encoding="UTF-8"?>
<TrustServiceStatusList xmlns="http://uri.etsi.org/02231/v2#" Id="tsl" TSLTag="http://uri.etsi.org/19612/TSLTag">
  <SchemeInformation>
    <TSLVersionIdentifier>6</TSLVersionIdentifier>
    <TSLSequenceNumber>7</TSLSequenceNumber>
    <SchemeOperatorName><Name xml:lang="en">Operator</Name></SchemeOperatorName>
    <SchemeTerritory>XX</SchemeTerritory>
    <ListIssueDateTime>2026-10-01T00:00:00Z</ListIssueDateTime>
    <NextUpdate><dateTime>2027-04-01T00:00:00Z</dateTime></NextUpdate>
  </SchemeInformation>
  <TrustServiceProviderList><TrustServiceProvider>
    <TSPInformation><TSPName><Name xml:lang="en">Provider</Name></TSPName></TSPInformation>
    <TSPServices><TSPService><ServiceInformation>
      <ServiceTypeIdentifier>http://uri.etsi.org/TrstSvc/Svctype/EAA/Q</ServiceTypeIdentifier>
      <ServiceName><Name xml:lang="en">QEAA</Name></ServiceName>
      <ServiceDigitalIdentity><DigitalId><X509Certificate>${svcCert}</X509Certificate></DigitalId></ServiceDigitalIdentity>
      <ServiceStatus>http://uri.etsi.org/TrstSvc/TrustedList/Svcstatus/granted</ServiceStatus>
    </ServiceInformation></TSPService></TSPServices>
  </TrustServiceProvider></TrustServiceProviderList>
</TrustServiceStatusList>`;

function sign(xml: string) {
  const sx = new SignedXml({
    privateKey: key,
    publicCert: certPem,
    signatureAlgorithm: ECDSA_SHA256 as never,
    canonicalizationAlgorithm: EXC as never,
  });
  sx.SignatureAlgorithms[ECDSA_SHA256 as never] = EcdsaSha256 as never;
  sx.addReference({
    xpath: "/*",
    transforms: [ENV, EXC] as never,
    digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256",
    isEmptyUri: true,
  });
  sx.computeSignature(xml, { prefix: "ds", location: { reference: "/*", action: "append" } });
  return sx.getSignedXml();
}

/** Yalnız beklenen hata türleri */
const expectListError = (f: () => unknown) => {
  try {
    f();
  } catch (e) {
    expect(e instanceof XmlSignatureError || e instanceof LoteParseError, String(e)).toBe(true);
    return;
  }
  throw new Error("expected a rejection");
};

describe("K11 ETSI XML güven listesi — düşmanca girdi", () => {
  const timed = (f: () => void, ms: number) => {
    const t = performance.now();
    f();
    expect(performance.now() - t).toBeLessThan(ms);
  };

  it.each([
    ["XXE dış varlık (dosya)", '<!DOCTYPE r [<!ENTITY x SYSTEM "file:///etc/passwd">]><r>&x;</r>'],
    ["XXE dış varlık (ağ)", '<!DOCTYPE r [<!ENTITY x SYSTEM "http://127.0.0.1:1/">]><r>&x;</r>'],
    ["parametre varlığı", '<!DOCTYPE r [<!ENTITY % p SYSTEM "http://127.0.0.1:1/e.dtd"> %p;]><r/>'],
    [
      "milyar kahkaha",
      '<!DOCTYPE r [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;"><!ENTITY c "&b;&b;&b;&b;&b;&b;&b;&b;&b;&b;"><!ENTITY d "&c;&c;&c;&c;&c;&c;&c;&c;&c;&c;">]><r>&d;&d;&d;&d;&d;&d;&d;&d;&d;</r>',
    ],
    ["küçük harf doctype", '<!doctype r SYSTEM "http://127.0.0.1:1/x.dtd"><r/>'],
    ["karışık harf ve boşluk", '<?xml version="1.0"?>\n<!DocType r PUBLIC "-//x" "http://127.0.0.1:1/x.dtd"><r/>'],
    ["iç DTD varsayılan öznitelik", '<!DOCTYPE r [<!ATTLIST r Id CDATA "tsl">]><r/>'],
  ])("%s: DTD reddedilir, varlık çözülmez", (_n, xml) => {
    timed(() => expectListError(() => verifyEnvelopedXmlSignature(xml)), 200);
    timed(() => expectListError(() => readTrustedListXml(xml, new Set([fp]))), 200);
  });

  it("tanımsız varlık başvurusu (DTD'siz) bozuk XML'dir", () => {
    expectListError(() => parseXml("<r>&x;</r>"));
  });

  // Süre sınırı bir başarım ölçütü değil, "sonsuz döngü / üstel patlama yok" bekçisidir: tek başına ~1 sn sürer; tam paket
  // paralel koşarken (yük altında) 3 sn aşılabildi (3,2 sn ölçüldü) — sınır 6 sn (test zaman aşımı vitest.config 20 sn)
  it("100 000 düzey iç içe öğe ve 50 000 öznitelik: çökme yok, 6 sn içinde ret (imza yok)", () => {
    const deep = "<a>".repeat(100_000) + "</a>".repeat(100_000);
    timed(() => expectListError(() => readTrustedListXml(deep, new Set([fp]))), 6000);
    const attrs = Array.from({ length: 50_000 }, (_, i) => `a${i}="1"`).join(" ");
    timed(() => expectListError(() => readTrustedListXml(`<r ${attrs}/>`, new Set([fp]))), 6000);
  });

  it("rastgele dize ve rastgele XML benzeri metin: yalnız XmlSignatureError / LoteParseError", () => {
    const xmlish = fc
      .array(
        fc.constantFrom(
          "<",
          ">",
          "/",
          "a",
          "ds:",
          "Signature",
          '="',
          "&",
          ";",
          "<!--",
          "-->",
          "<![CDATA[",
          "]]>",
          " ",
          "x",
        ),
        {
          maxLength: 40,
        },
      )
      .map((a) => a.join(""));
    fc.assert(
      fc.property(fc.oneof(fc.string(), xmlish), (s) => {
        expectListError(() => readTrustedListXml(s, new Set([fp])));
      }),
      params,
    );
  });

  it("imzalı listenin tek karakterlik her bozulması: ret ya da aynı liste", () => {
    const signed = sign(LIST(Buffer.from(der).toString("base64")));
    const ref = readTrustedListXml(signed, new Set([fp])).list;
    const chars = fc.constantFrom("A", "0", " ", "<", ">", "&", '"', "x", "/", "\n");
    fc.assert(
      fc.property(fc.nat(), chars, fc.constantFrom("replace", "insert", "delete"), (pos, ch, op) => {
        const i = pos % signed.length;
        const m =
          op === "replace"
            ? signed.slice(0, i) + ch + signed.slice(i + 1)
            : op === "insert"
              ? signed.slice(0, i) + ch + signed.slice(i)
              : signed.slice(0, i) + signed.slice(i + 1);
        if (m === signed) return;
        let got;
        try {
          got = readTrustedListXml(m, new Set([fp])).list;
        } catch (e) {
          expect(e instanceof XmlSignatureError || e instanceof LoteParseError, String(e)).toBe(true);
          return;
        }
        expect(got).toEqual(ref);
      }),
      { ...params, numRuns: Math.max(100, RUNS) },
    );
  });

  it("sabitlenmemiş imzacının (geçerli imzalı) listesi okunmaz", () => {
    const signed = sign(LIST(Buffer.from(der).toString("base64")));
    expect(() => readTrustedListXml(signed, new Set(["00".repeat(32)]))).toThrow(/pinned/);
  });
});

describe("K11 LoTE JSON ve Tamga liste şemaları — rastgele girdi", () => {
  const loteLike = fc.record(
    {
      LoTE: fc.oneof(
        fc.jsonValue({ maxDepth: 3 }),
        fc.record(
          {
            ListAndSchemeInformation: fc.oneof(
              fc.jsonValue({ maxDepth: 2 }),
              fc.record(
                {
                  LoTEVersionIdentifier: fc.oneof(fc.constant(1), fc.jsonValue({ maxDepth: 0 })),
                  LoTESequenceNumber: fc.oneof(fc.nat(), fc.jsonValue({ maxDepth: 0 })),
                  ListIssueDateTime: fc.oneof(fc.constant("2026-10-01T00:00:00Z"), fc.string()),
                  NextUpdate: fc.oneof(fc.constant("2027-01-01T00:00:00Z"), fc.string()),
                  SchemeTerritory: fc.oneof(fc.constant("XX"), fc.jsonValue({ maxDepth: 0 })),
                  SchemeOperatorName: fc.jsonValue({ maxDepth: 2 }),
                },
                { requiredKeys: [] },
              ),
            ),
            TrustedEntitiesList: fc.oneof(
              fc.jsonValue({ maxDepth: 2 }),
              fc.array(
                fc.record(
                  {
                    TrustedEntityInformation: fc.jsonValue({ maxDepth: 2 }),
                    TrustedEntityServices: fc.oneof(
                      fc.jsonValue({ maxDepth: 2 }),
                      fc.array(
                        fc.record({
                          ServiceInformation: fc.record(
                            {
                              ServiceTypeIdentifier: fc.jsonValue({ maxDepth: 0 }),
                              ServiceStatus: fc.jsonValue({ maxDepth: 0 }),
                              ServiceName: fc.jsonValue({ maxDepth: 2 }),
                              ServiceDigitalIdentity: fc.record({
                                X509Certificates: fc.oneof(
                                  fc.jsonValue({ maxDepth: 1 }),
                                  fc.array(fc.record({ val: fc.oneof(fc.base64String(), fc.string()) })),
                                ),
                              }),
                              ServiceSupplyPoints: fc.jsonValue({ maxDepth: 1 }),
                            },
                            { requiredKeys: [] },
                          ),
                        }),
                      ),
                    ),
                  },
                  { requiredKeys: [] },
                ),
                { maxLength: 3 },
              ),
            ),
          },
          { requiredKeys: [] },
        ),
      ),
    },
    { requiredKeys: [] },
  );

  it("parseLote: sonuç ya da LoteParseError", () => {
    fc.assert(
      fc.property(fc.oneof(fc.jsonValue({ maxDepth: 4 }), loteLike), (j) => {
        try {
          const l = parseLote(j);
          expect(Number.isInteger(l.sequence) && l.sequence >= 0).toBe(true);
          expect(l.territory.length).toBeGreaterThan(0);
        } catch (e) {
          expect(e, String(e)).toBeInstanceOf(LoteParseError);
        }
      }),
      { ...params, numRuns: RUNS * 2 },
    );
  });

  it("Lotl / NationalList şeması: rastgele JSON safeParse'ta çökmez", () => {
    fc.assert(
      fc.property(fc.jsonValue({ maxDepth: 5 }), (j) => {
        expect(typeof Lotl.safeParse(j).success).toBe("boolean");
        expect(typeof NationalList.safeParse(j).success).toBe("boolean");
      }),
      params,
    );
  });
});

describe("K11 liste JWS başlığı — özellikler", () => {
  const jws = (header: Record<string, unknown>, payload: unknown = { a: 1 }) =>
    new CompactSign(new TextEncoder().encode(JSON.stringify(payload)))
      .setProtectedHeader({ alg: "ES256", ...header } as never)
      .sign(cryptoKey);
  const x5c = () => [Buffer.from(der).toString("base64")];

  it("geçerli: ES256 + tamga-tl+jwt + sabitlenmiş imzacı", async () => {
    const r = await verifyJws(await jws({ typ: "tamga-tl+jwt", x5c: x5c() }), new Set([fp]));
    expect(r.signerFingerprint).toBe(fp);
  });

  it("alg ES256 dışı başlık (imza geçerli olsa da) reddedilir", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(fc.constantFrom("none", "HS256", "ES384", "RS256", "EdDSA", "es256"), fc.string()),
        async (alg) => {
          fc.pre(alg !== "ES256");
          const good = await jws({ typ: "tamga-tl+jwt", x5c: x5c() });
          const [, p, s] = good.split(".");
          const h = Buffer.from(JSON.stringify({ alg, typ: "tamga-tl+jwt", x5c: x5c() })).toString("base64url");
          await expect(verifyJws(`${h}.${p}.${s}`, new Set([fp]))).rejects.toThrow();
        },
      ),
      { ...params, numRuns: 50 },
    );
  });

  it("typ farklıysa, x5c yoksa ya da imzacı sabitlenmemişse reddedilir", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ maxLength: 20 }), async (typ) => {
        fc.pre(typ !== "tamga-tl+jwt");
        await expect(verifyJws(await jws({ typ, x5c: x5c() }), new Set([fp]))).rejects.toThrow(/typ/);
      }),
      { ...params, numRuns: 30 },
    );
    await expect(verifyJws(await jws({ typ: "tamga-tl+jwt" }), new Set([fp]))).rejects.toThrow(/x5c/);
    await expect(verifyJws(await jws({ typ: "tamga-tl+jwt", x5c: x5c() }), new Set(["ab"]))).rejects.toThrow(
      /not registered/,
    );
    // dış (JAdES) liste: sabitlenmiş imzacı zorunlu
    await expect(verifyJws(await jws({ x5c: x5c() }), null, { typ: null })).rejects.toThrow(/pinned/);
  });

  it("rastgele dize reddedilir", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.string(),
          fc.array(fc.base64String(), { minLength: 3, maxLength: 3 }).map((p) => p.join(".")),
        ),
        async (s) => {
          await expect(verifyJws(s, new Set([fp]))).rejects.toThrow();
        },
      ),
      { ...params, numRuns: 100 },
    );
  });
});
