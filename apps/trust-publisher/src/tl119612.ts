/**
 * ETSI TS 119 612 (Trusted Lists, XML) görünümü — ADR-0066 (Accepted 2026-10-29; D-TRUST-6).
 *
 * Tamga'nın imzalı ülke listesi (`tl-<cc>.json` / `.jws`) ve LOTL'u, AYNI sürümden (TSLSequenceNumber = liste `version`)
 * TS 119 612 V2.4.1 XML'ine çevrilir ve XAdES-B-B zarflanmış imzayla (EN 319 132-1; TS 119 612 §5.7, Ek B) imzalanır.
 * Yetkili kaynak her zaman Tamga JSON listesidir (BT4); XML yalnız bir görünümdür (LoTE ile aynı ilke, `lote.ts`).
 *
 * Varsayılan KAPALI: yalnız `TAMGA_TL119612=1` iken `build` üretir (TX5). Sandbox'ta açık (2026-10-29, imzacı `tl-xml-signer-1`);
 * gerçek ağda posta adresleri ve üretim XML imza sertifikası tamamlanınca proje yönetimi onayıyla.
 *
 * Profil (AB dışı işletmeci, TS 119 612 §5.3.3/5.3.8/5.3.9/5.5.4: "a URI defined on purpose"): liste türü, durum belirleme
 * yaklaşımı, kural ve hizmet durumu URI'leri Tamga URI kökündendir (`TAMGA_TL_ROOT`); "üye devletçe bildirilmiş / nitelikli"
 * anlamı taşıyan ETSI URI'leri (EUgeneric, granted, recognisedatnationallevel, …) KULLANILMAZ. Hizmet türü URI'leri, işlevi
 * birebir anlatan bir ETSI türü varsa ETSI'nindir (CA/PKC, EAA; cüzdan çözümü için TS 119 602 türü), yoksa Tamga kökündendir.
 * Bir devlet slotu devraldığında URI'ler (`uris`) slot başına değiştirilebilir; kayıtlar ve kimlikler değişmez (D-GOV-5).
 */
import { createHash, createPrivateKey, sign as nodeSign } from "node:crypto";
import {
  X509Certificate as PX509,
  BasicConstraintsExtension,
  ExtendedKeyUsageExtension,
  KeyUsageFlags,
  KeyUsagesExtension,
  SubjectKeyIdentifierExtension,
} from "@peculiar/x509";
import { canonicalizeXml, parseXml, verifyEnvelopedXmlSignature } from "@tamga-network/trust";

export const TL119612_FLAG = "TAMGA_TL119612";
/** Bayrak: yalnız "1" açar (varsayılan kapalı). */
export const tl119612Enabled = (env: NodeJS.ProcessEnv = process.env) => env[TL119612_FLAG] === "1";

/** Tamga URI kökü (adlar onaylandı 2026-10-29; LoTE kökü `https://trust.tamga.network/lote` ile aynı düzen). Açıklama sayfası:
 * docs.tamga.network/concepts/etsi-trusted-list (nginx `/tl/` → o sayfa). */
export const TAMGA_TL_ROOT = "https://trust.tamga.network/tl";
export const TSL_NS = "http://uri.etsi.org/02231/v2#";
const TSLX_NS = "http://uri.etsi.org/02231/v2/additionaltypes#";
const DS_NS = "http://www.w3.org/2000/09/xmldsig#";
const XADES_NS = "http://uri.etsi.org/01903/v1.3.2#";
const TSL_TAG = "http://uri.etsi.org/19612/TSLTag";
/** TS 119 612 V2.3.1+ (V2.4.1, 2025-08) */
export const TSL_VERSION = 6;
const EXC_C14N = "http://www.w3.org/2001/10/xml-exc-c14n#";
const ENVELOPED = "http://www.w3.org/2000/09/xmldsig#enveloped-signature";
const SHA256 = "http://www.w3.org/2001/04/xmlenc#sha256";
/** TS 119 612 §5.7.1: id-tsl-kp-tslSigning */
export const OID_TSL_SIGNING = "0.4.0.2231.3.0";

const ETSI_SVC = "http://uri.etsi.org/TrstSvc/Svctype";
const LOTE_SVC = "http://uri.etsi.org/19602/SvcType";

// ---- Model -------------------------------------------------------------------------------------------------------------

/** Çok dilli ad: düz metin (xml:lang="en") ya da dil → metin. */
export type Names = string | Record<string, string>;
export interface TlAddress {
  street: string;
  locality: string;
  postalCode?: string;
  country: string;
  /** mailto:, tel: ya da https: */
  electronic: string[];
}
export interface TlService {
  typeUri: string;
  name: Names;
  certsDer: Uint8Array[];
  statusUri: string;
  /** Mevcut durumun başlangıcı (ISO 8601) */
  since: string;
  /** Önceki durumlar, YENİDEN ESKİYE (TS 119 612 §5.5.10) */
  history: Array<{ statusUri: string; since: string }>;
  supplyPoints?: string[];
}
export interface TlTsp {
  name: Names;
  tradeName?: Names;
  address: TlAddress;
  infoUris: string[];
  services: TlService[];
}
export interface TlPointer {
  location: string;
  signerCertsDer: Uint8Array[];
  tslType: string;
  operatorName: Names;
  territory?: string;
  schemeRules?: string[];
  /** TS 119 612 §6.2, ör. application/vnd.etsi.tsl+xml */
  mimeType: string;
}
export interface TrustedListInput {
  /** Kök öğenin Id'si (xsd:ID) */
  id: string;
  sequence: number;
  territory: string;
  tslType: string;
  statusDetermination: string;
  schemeRules: string[];
  schemeInfo: string[];
  operatorName: Names;
  operatorAddress: TlAddress;
  schemeName: Names;
  legalNotice: string;
  issuedAt: Date;
  nextUpdate: Date;
  distributionPoints: string[];
  pointers?: TlPointer[];
  tsps: TlTsp[];
}

// ---- XML yazımı -----------------------------------------------------------------------------------------------------

/**
 * XML 1.0 §2.2'de izinli olmayan karakterler: C0 denetim karakterleri (sekme, CR, LF hariç), tek başına vekil (surrogate) yarıları,
 * U+FFFE ve U+FFFF. Bunlar kaçışla da yazılamaz (`&#x1;` de geçersiz) — liste ya reddedilir ya da karakter çıkarılır.
 */
const XML10_INVALID = /[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu;
export const hasXml10InvalidChars = (s: string) => new RegExp(XML10_INVALID.source, "u").test(s);
export const stripXml10InvalidChars = (s: string) => s.replace(XML10_INVALID, "");
const escText = (s: string) => {
  // son savunma hattı: modelde geçersiz karakter kalmışsa XML hiç üretilmez (bkz. sanitizeTrustedListInput)
  if (hasXml10InvalidChars(s))
    throw new Error("XML 1.0'da geçersiz karakter (sanitizeTrustedListInput ile denetleyin)");
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
};
const escAttr = (s: string) => escText(s).replace(/"/g, "&quot;");
/** ETSI: saniye hassasiyetli UTC */
export const isoSec = (d: Date | string) => new Date(d).toISOString().replace(/\.\d{3}Z$/, "Z");
const b64 = (der: Uint8Array) => Buffer.from(der).toString("base64");

function names(tag: string, n: Names): string {
  const entries = typeof n === "string" ? [["en", n]] : Object.entries(n).filter(([, v]) => v);
  if (!entries.length) throw new Error(`${tag}: boş ad`);
  return `<${tag}>${entries.map(([l, v]) => `<Name xml:lang="${escAttr(l.split("-")[0])}">${escText(v)}</Name>`).join("")}</${tag}>`;
}
const uriList = (tag: string, uris: string[]) =>
  `<${tag}>${uris.map((u) => `<URI xml:lang="en">${escText(u)}</URI>`).join("")}</${tag}>`;
function address(tag: string, a: TlAddress): string {
  return (
    `<${tag}><PostalAddresses><PostalAddress xml:lang="en">` +
    `<StreetAddress>${escText(a.street)}</StreetAddress><Locality>${escText(a.locality)}</Locality>` +
    (a.postalCode ? `<PostalCode>${escText(a.postalCode)}</PostalCode>` : "") +
    `<CountryName>${escText(a.country)}</CountryName></PostalAddress></PostalAddresses>` +
    `${uriList("ElectronicAddress", a.electronic)}</${tag}>`
  );
}
const digitalIds = (tag: string, certs: Uint8Array[]) =>
  `<${tag}>${certs.map((c) => `<DigitalId><X509Certificate>${b64(c)}</X509Certificate></DigitalId>`).join("")}</${tag}>`;

/** RFC 5280 §4.2.1.2 yöntem 1 yedeği; varsa sertifikanın kendi SKI'si. TS 119 612 §5.6.3: geçmişte sertifika değil SKI. */
export function subjectKeyId(der: Uint8Array): Uint8Array {
  const c = new PX509(new Uint8Array(der));
  const ext = c.getExtension(SubjectKeyIdentifierExtension);
  if (ext) return new Uint8Array(Buffer.from(ext.keyId, "hex"));
  // SubjectPublicKeyInfo ::= SEQUENCE { algorithm, subjectPublicKey BIT STRING } → BIT STRING içeriği (ilk bayt hariç)
  const spki = new Uint8Array(c.publicKey.rawData);
  const tlv = (off: number) => {
    let len = spki[off + 1];
    let p = off + 2;
    if (len & 0x80) {
      const n = len & 0x7f;
      len = 0;
      for (let k = 0; k < n; k++) len = len * 256 + spki[p++];
    }
    return { start: p, end: p + len };
  };
  const outer = tlv(0);
  const alg = tlv(outer.start);
  const bits = tlv(alg.end);
  if (spki[alg.end] !== 0x03) throw new Error("subjectPublicKeyInfo: BIT STRING yok");
  return new Uint8Array(
    createHash("sha1")
      .update(spki.subarray(bits.start + 1, bits.end))
      .digest(),
  );
}

function service(s: TlService): string {
  const hist = s.history.length
    ? `<ServiceHistory>${s.history
        .map(
          (h) =>
            `<ServiceHistoryInstance><ServiceTypeIdentifier>${escText(s.typeUri)}</ServiceTypeIdentifier>` +
            `${names("ServiceName", s.name)}<ServiceDigitalIdentity>${s.certsDer
              .map((c) => `<DigitalId><X509SKI>${b64(subjectKeyId(c))}</X509SKI></DigitalId>`)
              .join("")}</ServiceDigitalIdentity>` +
            `<ServiceStatus>${escText(h.statusUri)}</ServiceStatus><StatusStartingTime>${isoSec(h.since)}</StatusStartingTime>` +
            `</ServiceHistoryInstance>`,
        )
        .join("")}</ServiceHistory>`
    : "";
  return (
    `<TSPService><ServiceInformation>` +
    `<ServiceTypeIdentifier>${escText(s.typeUri)}</ServiceTypeIdentifier>${names("ServiceName", s.name)}` +
    `${digitalIds("ServiceDigitalIdentity", s.certsDer)}` +
    `<ServiceStatus>${escText(s.statusUri)}</ServiceStatus><StatusStartingTime>${isoSec(s.since)}</StatusStartingTime>` +
    (s.supplyPoints?.length
      ? `<ServiceSupplyPoints>${s.supplyPoints.map((p) => `<ServiceSupplyPoint>${escText(p)}</ServiceSupplyPoint>`).join("")}</ServiceSupplyPoints>`
      : "") +
    `</ServiceInformation>${hist}</TSPService>`
  );
}

function pointer(p: TlPointer): string {
  const other = (inner: string) => `<OtherInformation>${inner}</OtherInformation>`;
  return (
    `<OtherTSLPointer><ServiceDigitalIdentities>${p.signerCertsDer
      .map((c) => digitalIds("ServiceDigitalIdentity", [c]))
      .join("")}</ServiceDigitalIdentities>` +
    `<TSLLocation>${escText(p.location)}</TSLLocation><AdditionalInformation>` +
    other(`<TSLType>${escText(p.tslType)}</TSLType>`) +
    (p.territory ? other(`<SchemeTerritory>${escText(p.territory)}</SchemeTerritory>`) : "") +
    other(`<tslx:MimeType>${escText(p.mimeType)}</tslx:MimeType>`) +
    other(names("SchemeOperatorName", p.operatorName)) +
    (p.schemeRules?.length ? other(uriList("SchemeTypeCommunityRules", p.schemeRules)) : "") +
    `</AdditionalInformation></OtherTSLPointer>`
  );
}

/**
 * Modeldeki bütün metinlerde XML 1.0'da geçersiz karakter arar. `reject` (gerçek ağ): bulursa hata — kayıt defteri düzeltilmeli.
 * `strip` (sandbox): karakteri çıkarır, yerini bulgu olarak döndürür (çağıran uyarı yazar). Bulgu metni yer + kod noktasıdır,
 * içeriği tekrar etmez.
 */
export function sanitizeTrustedListInput(
  input: TrustedListInput,
  mode: "reject" | "strip",
): { input: TrustedListInput; findings: string[] } {
  const findings: string[] = [];
  const walk = (v: unknown, at: string): unknown => {
    if (typeof v === "string") {
      if (!hasXml10InvalidChars(v)) return v;
      const cps = [...v]
        .filter((c) => hasXml10InvalidChars(c))
        .map((c) => `U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`);
      findings.push(`${at}: XML 1.0'da geçersiz karakter (${[...new Set(cps)].join(", ")})`);
      return stripXml10InvalidChars(v);
    }
    if (v instanceof Uint8Array || v instanceof Date || v === null || typeof v !== "object") return v;
    if (Array.isArray(v)) return v.map((x, k) => walk(x, `${at}[${k}]`));
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, walk(x, at ? `${at}.${k}` : k)]),
    );
  };
  const cleaned = walk(input, "") as TrustedListInput;
  if (findings.length && mode === "reject") throw new Error(`TS 119 612 XML: ${findings.join("; ")}`);
  return { input: cleaned, findings };
}

/** İmzasız TS 119 612 XML'i (Ek B, şema sırası 19612_xsd.xsd). */
export function buildTrustedListXml(i: TrustedListInput): string {
  if (!/^[A-Za-z_][\w.-]*$/.test(i.id)) throw new Error(`Id xsd:ID değil: ${i.id}`);
  if (!Number.isInteger(i.sequence) || i.sequence < 1) throw new Error("TSLSequenceNumber ≥ 1 olmalı (§5.3.2)");
  const sixMonths = 183 * 86400_000;
  if (i.nextUpdate.getTime() - i.issuedAt.getTime() > sixMonths)
    throw new Error("NextUpdate − ListIssueDateTime 6 ayı aşamaz (§5.3.15)");
  const si =
    `<SchemeInformation><TSLVersionIdentifier>${TSL_VERSION}</TSLVersionIdentifier>` +
    `<TSLSequenceNumber>${i.sequence}</TSLSequenceNumber><TSLType>${escText(i.tslType)}</TSLType>` +
    names("SchemeOperatorName", i.operatorName) +
    address("SchemeOperatorAddress", i.operatorAddress) +
    names("SchemeName", i.schemeName) +
    uriList("SchemeInformationURI", i.schemeInfo) +
    `<StatusDeterminationApproach>${escText(i.statusDetermination)}</StatusDeterminationApproach>` +
    uriList("SchemeTypeCommunityRules", i.schemeRules) +
    `<SchemeTerritory>${escText(i.territory)}</SchemeTerritory>` +
    `<PolicyOrLegalNotice><TSLLegalNotice xml:lang="en">${escText(i.legalNotice)}</TSLLegalNotice></PolicyOrLegalNotice>` +
    // §5.3.12: geçmiş hiç silinmez (Tamga TL2 ile aynı)
    `<HistoricalInformationPeriod>65535</HistoricalInformationPeriod>` +
    (i.pointers?.length ? `<PointersToOtherTSL>${i.pointers.map(pointer).join("")}</PointersToOtherTSL>` : "") +
    `<ListIssueDateTime>${isoSec(i.issuedAt)}</ListIssueDateTime>` +
    `<NextUpdate><dateTime>${isoSec(i.nextUpdate)}</dateTime></NextUpdate>` +
    (i.distributionPoints.length
      ? `<DistributionPoints>${i.distributionPoints.map((u) => `<URI>${escText(u)}</URI>`).join("")}</DistributionPoints>`
      : "") +
    `</SchemeInformation>`;
  const tsps = i.tsps.filter((t) => t.services.length);
  const list = tsps.length
    ? `<TrustServiceProviderList>${tsps
        .map(
          (t) =>
            `<TrustServiceProvider><TSPInformation>${names("TSPName", t.name)}` +
            (t.tradeName ? names("TSPTradeName", t.tradeName) : "") +
            address("TSPAddress", t.address) +
            uriList("TSPInformationURI", t.infoUris) +
            `</TSPInformation><TSPServices>${t.services.map(service).join("")}</TSPServices></TrustServiceProvider>`,
        )
        .join("")}</TrustServiceProviderList>`
    : "";
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<TrustServiceStatusList xmlns="${TSL_NS}" xmlns:tslx="${TSLX_NS}" Id="${escAttr(i.id)}" TSLTag="${TSL_TAG}">` +
    si +
    list +
    `</TrustServiceStatusList>\n`
  );
}

// ---- XAdES-B-B imzası -------------------------------------------------------------------------------------------------

export interface TlSigner {
  /** PKCS#8 PEM */
  keyPem: string;
  certDer: Uint8Array;
}

function signatureMethod(keyPem: string): { uri: string; hash: "sha256" | "sha384" | "sha512"; ec: boolean } {
  const k = createPrivateKey(keyPem);
  if (k.asymmetricKeyType === "ec") {
    const curve = k.asymmetricKeyDetails?.namedCurve;
    const hash = curve === "secp384r1" ? "sha384" : curve === "secp521r1" ? "sha512" : "sha256";
    if (!["prime256v1", "secp384r1", "secp521r1"].includes(String(curve)))
      throw new Error(`desteklenmeyen EC eğrisi ${curve}`);
    return { uri: `http://www.w3.org/2001/04/xmldsig-more#ecdsa-${hash}`, hash, ec: true };
  }
  if (k.asymmetricKeyType === "rsa")
    return { uri: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256", hash: "sha256", ec: false };
  throw new Error(`desteklenmeyen anahtar türü ${k.asymmetricKeyType}`);
}

/**
 * TS 119 612 Ek B / EN 319 132-1 XAdES-B-B zarflanmış imza: SignedInfo'da bütün belge (URI="", enveloped-signature +
 * Exclusive C14N) ve SignedProperties başvurusu; KeyInfo'da YALNIZ imzacı sertifikası (§5.7.1); imzalı nitelikler
 * SigningTime, SigningCertificateV2 (sertifika SHA-256 özeti), DataObjectFormat (text/xml). Kanonikleştirme
 * `@tamga-network/trust`'ınkidir; çıktı imzadan hemen sonra aynı paketin doğrulayıcısıyla denetlenir.
 */
export function signTrustedListXml(unsignedXml: string, signer: TlSigner, signingTime: Date): string {
  const end = "</TrustServiceStatusList>";
  const at = unsignedXml.lastIndexOf(end);
  if (at < 0) throw new Error("TrustServiceStatusList kapanışı yok");
  const m = signatureMethod(signer.keyPem);
  const sid = `id-${createHash("sha256").update(unsignedXml).digest("hex").slice(0, 32)}`;
  const certDigest = createHash("sha256").update(signer.certDer).digest("base64");
  const signedProps =
    `<xades:SignedProperties Id="xades-${sid}"><xades:SignedSignatureProperties>` +
    `<xades:SigningTime>${isoSec(signingTime)}</xades:SigningTime>` +
    `<xades:SigningCertificateV2><xades:Cert><xades:CertDigest><ds:DigestMethod Algorithm="${SHA256}"/>` +
    `<ds:DigestValue>${certDigest}</ds:DigestValue></xades:CertDigest></xades:Cert></xades:SigningCertificateV2>` +
    `</xades:SignedSignatureProperties><xades:SignedDataObjectProperties>` +
    `<xades:DataObjectFormat ObjectReference="#${sid}-ref0"><xades:MimeType>text/xml</xades:MimeType></xades:DataObjectFormat>` +
    `</xades:SignedDataObjectProperties></xades:SignedProperties>`;
  const signedInfo = (docDigest: string, spDigest: string) =>
    `<ds:SignedInfo><ds:CanonicalizationMethod Algorithm="${EXC_C14N}"/><ds:SignatureMethod Algorithm="${m.uri}"/>` +
    `<ds:Reference Id="${sid}-ref0" URI=""><ds:Transforms><ds:Transform Algorithm="${ENVELOPED}"/>` +
    `<ds:Transform Algorithm="${EXC_C14N}"/></ds:Transforms><ds:DigestMethod Algorithm="${SHA256}"/>` +
    `<ds:DigestValue>${docDigest}</ds:DigestValue></ds:Reference>` +
    `<ds:Reference Type="http://uri.etsi.org/01903#SignedProperties" URI="#xades-${sid}"><ds:Transforms>` +
    `<ds:Transform Algorithm="${EXC_C14N}"/></ds:Transforms><ds:DigestMethod Algorithm="${SHA256}"/>` +
    `<ds:DigestValue>${spDigest}</ds:DigestValue></ds:Reference></ds:SignedInfo>`;
  const assemble = (si: string, sv: string) =>
    unsignedXml.slice(0, at) +
    `<ds:Signature xmlns:ds="${DS_NS}" Id="${sid}">${si}<ds:SignatureValue Id="${sid}-sigvalue">${sv}</ds:SignatureValue>` +
    `<ds:KeyInfo><ds:X509Data><ds:X509Certificate>${b64(signer.certDer)}</ds:X509Certificate></ds:X509Data></ds:KeyInfo>` +
    `<ds:Object><xades:QualifyingProperties xmlns:xades="${XADES_NS}" Target="#${sid}">${signedProps}` +
    `</xades:QualifyingProperties></ds:Object></ds:Signature>` +
    unsignedXml.slice(at);

  // 1) özetler: son belgenin DOM'u üzerinden (doğrulayıcının yaptığıyla aynı — imza öğesi hariç bütün belge; SignedProperties)
  const draft = parseXml(assemble(signedInfo("", ""), ""));
  const root = draft.documentElement;
  const sig = Array.from({ length: root.childNodes.length }, (_, k) => root.childNodes.item(k)).find(
    (n) => n.namespaceURI === DS_NS && n.localName === "Signature",
  );
  const spEl = draft.getElementsByTagNameNS(XADES_NS, "SignedProperties").item(0);
  const digest = (s: string) => createHash("sha256").update(Buffer.from(s, "utf8")).digest("base64");
  const docDigest = digest(canonicalizeXml(root, { exclusive: true, exclude: sig }));
  const spDigest = digest(canonicalizeXml(spEl, { exclusive: true }));
  // 2) SignedInfo'nun kanonik biçimi imzalanır
  const withDigests = parseXml(assemble(signedInfo(docDigest, spDigest), ""));
  const siEl = withDigests.getElementsByTagNameNS(DS_NS, "SignedInfo").item(0);
  const octets = Buffer.from(canonicalizeXml(siEl, { exclusive: true }), "utf8");
  const value = nodeSign(m.hash, octets, m.ec ? { key: signer.keyPem, dsaEncoding: "ieee-p1363" } : signer.keyPem);
  const signed = assemble(signedInfo(docDigest, spDigest), value.toString("base64"));
  // 3) kendi kendini denetleme (bozuk imzalı liste yayınlanmaz)
  verifyEnvelopedXmlSignature(signed);
  return signed;
}

// ---- İmzacı sertifikası profili (TS 119 612 §5.7.1) ----------------------------------------------------------------

/** errors: §5.7.1 "shall" ihlali · warnings: "should" ihlali ya da TS 119 312 önerisi. */
export function tlSignerProblems(
  der: Uint8Array,
  expect: { territory: string; operatorName: Names },
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const c = new PX509(new Uint8Array(der));
  const subj = c.subjectName;
  const C = subj.getField("C")[0];
  const O = subj.getField("O");
  if (C !== expect.territory) errors.push(`konu C=${C ?? "-"} ≠ SchemeTerritory ${expect.territory}`);
  const opNames = typeof expect.operatorName === "string" ? [expect.operatorName] : Object.values(expect.operatorName);
  if (!O.some((o) => opNames.includes(o)))
    errors.push(`konu O=${O.join("|") || "-"} SchemeOperatorName ile aynı değil`);
  const ku = c.getExtension(KeyUsagesExtension);
  const allowed = KeyUsageFlags.digitalSignature | KeyUsageFlags.nonRepudiation;
  if (!ku || !(ku.usages & allowed) || ku.usages & ~allowed)
    errors.push("keyUsage yalnız digitalSignature ve/veya nonRepudiation olmalı");
  const bc = c.getExtension(BasicConstraintsExtension);
  if (!bc) errors.push("basicConstraints yok (CA=false olmalı)");
  else if (bc.ca) errors.push("basicConstraints CA=true");
  if (!c.getExtension(SubjectKeyIdentifierExtension)) errors.push("subjectKeyIdentifier yok");
  const eku = c.getExtension(ExtendedKeyUsageExtension);
  if (!eku || !eku.usages.map(String).includes(OID_TSL_SIGNING))
    warnings.push(`extendedKeyUsage id-tsl-kp-tslSigning (${OID_TSL_SIGNING}) yok (§5.7.1 "should")`);
  const now = Date.now();
  if (c.notAfter.getTime() < now || c.notBefore.getTime() > now) errors.push("sertifika geçerlilik süresi dışında");
  return { errors, warnings };
}

// ---- Tamga listesinden model ------------------------------------------------------------------------------------------

export interface TamgaUris {
  tslType: string;
  statusDetermination: string;
  schemeRules: string[];
  schemeInfo: string[];
  status: (tamgaStatus: string) => string;
  svc: { root_ca: string; EAA: string; PUB: string; QUALIFIED: string; status_list: string; wallet_solution: string };
}

/** Tamga URI kökünden slot URI'leri (ADR-0066 K2). Devlet slotu devralınca bu küme slot başına değiştirilir. */
export function tamgaUris(cc: string, root = TAMGA_TL_ROOT): TamgaUris {
  return {
    tslType: `${root}/TSLType/${cc}list`,
    statusDetermination: `${root}/StatusDetn/${cc}determination`,
    schemeRules: ["https://arf.tamga.network/trust-framework", `${root}/schemerules/${cc}`],
    // bilgi sayfası; önceki yayınlar (arşiv) adresi yayın yerinden türetilir (trustedListFromTamga)
    schemeInfo: [`${root}/`],
    status: (s) => {
      if (!STATUS_URI_SEGMENT[s]) throw new Error(`TL'de gösterilmeyen durum: ${s}`);
      return `${root}/Svcstatus/${STATUS_URI_SEGMENT[s]}`;
    },
    svc: {
      // CA/PKC: nitelikli olmayan sertifika veren hizmet (TS 119 612 §5.5.1.2 a) — kök CA'nın işlevi birebir
      root_ca: `${ETSI_SVC}/CA/PKC`,
      // EAA: nitelikli olmayan EAA verme (§5.5.1.2 n)
      EAA: `${ETSI_SVC}/EAA`,
      // Tamga sınıfları (PuB-EAA / QEAA KARŞILIĞI, AB anlamında nitelikli değil) — ETSI URI'si iddia taşıyacağı için Tamga kökü
      PUB: `${root}/Svctype/EAA/Pub-EAA`,
      QUALIFIED: `${root}/Svctype/EAA/Q`,
      status_list: `${root}/Svctype/EAA/StatusList`,
      // TS 119 602 cüzdan çözümü türü (LoTE ile aynı; TS 119 612'de karşılığı yok)
      wallet_solution: `${LOTE_SVC}/WalletSolution/Issuance`,
    },
  };
}
/** Tamga durumu → URI son parçası; RESERVED / PROVISIONAL hizmet değildir, listelenmez. */
const STATUS_URI_SEGMENT: Record<string, string> = {
  ACTIVE: "active",
  SUSPENDED: "suspended",
  REVOKED: "revoked",
  RETIRED: "retired",
  ROLLING_OVER: "rollingover",
  DEPRECATED: "deprecated",
};
export const tlListable = (status: string) => status in STATUS_URI_SEGMENT;

/* eslint-disable @typescript-eslint/no-explicit-any */
type Rec = Record<string, any>;
const PLACEHOLDER = "(not published)";

/**
 * Kaydın durum zaman çizelgesi (§5.5.4–5.5.5, §5.6): güncel durum ve başlangıcı, önceki durumlar yeniden eskiye (§5.5.10).
 * Aynı durumun art arda gelen girdileri tek değişiklik sayılır (başlangıcı ilk girdi); güncel durumla aynı ya da ondan sonraki
 * zamanlı girdi geçmişe yazılmaz — böylece güncel bilgiyi tekrarlayan geçmiş örneği (yinelenen ServiceHistoryInstance) çıkmaz.
 */
function statusOf(rec: Rec, uris: TamgaUris, fallbackSince: string) {
  const h: Array<{ status: string; since: string }> = Array.isArray(rec.status_history) ? rec.status_history : [];
  const asc = [...h]
    .filter((x) => x?.since && x?.status)
    .sort((a, b) => (a.since < b.since ? -1 : a.since > b.since ? 1 : 0));
  const runs: Array<{ status: string; since: string }> = [];
  for (const x of asc) if (runs[runs.length - 1]?.status !== x.status) runs.push({ status: x.status, since: x.since });
  const last = runs[runs.length - 1];
  const cur = last && last.status === rec.status ? last : undefined;
  const since = cur?.since ?? last?.since ?? fallbackSince;
  return {
    statusUri: uris.status(rec.status),
    since,
    history: runs
      .filter((x) => x !== cur && x.since < since && tlListable(x.status))
      .reverse()
      .map((x) => ({ statusUri: uris.status(x.status), since: x.since })),
  };
}

/** Sağlayıcının listede ilk ACTIVE olduğu an (yoksa undefined). */
function providerListedSince(w: Rec): string | undefined {
  const h: Array<{ status: string; since: string }> = Array.isArray(w.status_history) ? w.status_history : [];
  return h
    .filter((x) => x?.status === "ACTIVE" && x.since)
    .map((x) => x.since)
    .sort()[0];
}

function addressOf(rec: Rec, cc: string, fallbackUri: string | undefined, problems: string[], who: string): TlAddress {
  const a = rec.postal_address ?? {};
  const c = rec.contact ?? {};
  const electronic = [
    ...(c.email ? [`mailto:${c.email}`] : []),
    ...(c.support_uri ? [c.support_uri] : []),
    ...(c.phone ? [`tel:${String(c.phone).replace(/\s+/g, "")}`] : []),
  ];
  if (!electronic.length && fallbackUri) electronic.push(fallbackUri);
  if (!a.street_address || !a.locality) problems.push(`${who}: posta adresi eksik (StreetAddress/Locality zorunlu)`);
  if (!electronic.length) problems.push(`${who}: elektronik adres yok`);
  return {
    street: a.street_address ?? PLACEHOLDER,
    locality: a.locality ?? PLACEHOLDER,
    ...(a.postal_code ? { postalCode: a.postal_code } : {}),
    country: a.country ?? cc,
    electronic: electronic.length ? electronic : ["https://tamga.network"],
  };
}

export interface FromTamgaOptions {
  /** SHA-256 parmak izi (küçük harf onaltılık) → sertifika DER; yayıncı PKI'dan doldurur */
  certByFingerprint: (fp: string) => Uint8Array | undefined;
  uris?: TamgaUris;
  /** XML'in yayın adresi (ör. https://trust.tamga.network/tl-tr.xml) */
  distributionPoint: string;
  /** Tamga işletmecisinin iletişimi (lotl `operator.lote_contact`) */
  operatorContact?: { postal: Rec; electronic: string[]; info?: string[] };
  pointers?: TlPointer[];
}

/**
 * İmzalı Tamga ülke listesi (`tl`) + LOTL (`lotl`) → TS 119 612 modeli. Aynı sürüm: TSLSequenceNumber = `tl.version`,
 * ListIssueDateTime = `tl.issued_at`, NextUpdate = min(`tl.next_update`, +6 ay). Kayıtlar silinmez (TL2): etkin olmayan
 * hizmet, Tamga durum URI'siyle ve geçmişiyle listede kalır. RESERVED / PROVISIONAL ya da sertifikası olmayan kayıt yok sayılır.
 * Doğrulayıcılar (relying_parties) güven hizmeti sağlayıcısı değildir, TL'ye girmez (kayıtları JSON listesinde ve kayıt
 * sertifikalarında). `problems`: yayına engel olabilecek veri eksikleri (üretimde hata, sandbox'ta uyarı — çağıran karar verir).
 */
export function trustedListFromTamga(
  tl: Rec,
  lotl: Rec,
  o: FromTamgaOptions,
): { input: TrustedListInput; problems: string[] } {
  const cc: string = tl.state_code;
  const uris = o.uris ?? tamgaUris(cc);
  const problems: string[] = [];
  const der = (fp: string, who: string) => {
    const d = o.certByFingerprint(String(fp).toLowerCase());
    if (!d) problems.push(`${who}: ${fp} parmak izli sertifika bulunamadı`);
    return d;
  };
  const issuedAt = new Date(tl.issued_at);
  const nextUpdate = new Date(Math.min(new Date(tl.next_update).getTime(), issuedAt.getTime() + 180 * 86400_000));
  const op = tl.operator ?? {};
  const oc = o.operatorContact;
  const opAddr: TlAddress = {
    street: oc?.postal?.StreetAddress ?? PLACEHOLDER,
    locality: oc?.postal?.Locality ?? PLACEHOLDER,
    ...(oc?.postal?.PostalCode ? { postalCode: oc.postal.PostalCode } : {}),
    country: oc?.postal?.Country ?? cc,
    electronic: oc?.electronic?.length ? oc.electronic : ["https://tamga.network"],
  };
  if (!oc?.postal?.Locality || /to be published|not published/i.test(String(oc?.postal?.StreetAddress)))
    problems.push("işletmeci posta adresi yayımlanmamış (lotl operator.lote_contact)");

  const tsps: TlTsp[] = [];
  // 1) işletmeci: ulusal kök CA(lar)
  const caServices: TlService[] = [];
  for (const r of (tl.root_cas ?? []) as Rec[]) {
    if (!tlListable(r.status)) continue;
    const d = r.cert_pem
      ? new Uint8Array(Buffer.from(String(r.cert_pem).replace(/-----[^-]+-----|\s+/g, ""), "base64"))
      : der(r.cert_fingerprint_sha256, `root_ca ${r.ca_id}`);
    if (!d) continue;
    caServices.push({
      typeUri: uris.svc.root_ca,
      name: r.legal_name ?? `${cc} national root CA`,
      certsDer: [d],
      ...statusOf(r, uris, tl.issued_at),
    });
  }
  tsps.push({
    name: op.name,
    address: opAddr,
    infoUris: oc?.info?.length ? oc.info : ["https://tamga.network"],
    services: caServices,
  });
  // 2) belge verenler
  for (const i of (tl.issuers ?? []) as Rec[]) {
    if (!tlListable(i.status)) continue;
    const who = `issuer ${i.slug}`;
    const d = der(i.cert_fingerprint_sha256, who);
    if (!d) continue;
    const st = statusOf(i, uris, tl.issued_at);
    const typeUri = uris.svc[(i.class as "EAA" | "PUB" | "QUALIFIED") ?? "EAA"] ?? uris.svc.EAA;
    const services: TlService[] = [
      {
        typeUri,
        name: `${i.slug} — attestation issuance`,
        certsDer: [d],
        ...st,
        ...(i.issuer_url ? { supplyPoints: [i.issuer_url] } : {}),
      },
    ];
    for (const k of (i.delegate_keys ?? []) as Rec[]) {
      if (k.purpose !== "status_list") continue;
      const sd = der(k.fingerprint_sha256, `${who} status_list`);
      if (sd)
        services.push({
          typeUri: uris.svc.status_list,
          name: `${i.slug} — status list`,
          certsDer: [sd],
          ...st,
          ...(i.status_list_base ? { supplyPoints: [i.status_list_base] } : {}),
        });
    }
    tsps.push({
      name: i.legal_name,
      ...(i.trade_name && i.trade_name !== i.legal_name ? { tradeName: i.trade_name } : {}),
      address: addressOf(i, cc, i.issuer_url, problems, who),
      infoUris: [i.info_uri ?? i.issuer_url].filter(Boolean),
      services,
    });
  }
  // 3) cüzdan sağlayıcılar (LOTL; ağ cüzdan işletmez, listeler — ADR-0042)
  for (const w of (lotl.wallet_providers ?? []) as Rec[]) {
    if (!tlListable(w.status)) continue;
    const certs = ((w.wua_signing_keys ?? []) as Rec[])
      .map((k) => der(k.fingerprint_sha256, `wallet_provider ${w.provider_id}`))
      .filter((x): x is Uint8Array => !!x);
    if (!certs.length) continue;
    const services = ((w.solutions ?? []) as Rec[])
      .filter((s) => tlListable(s.status))
      .map((s) => {
        // hizmet = cüzdan çözümü: zaman çizelgesi çözümün KENDİ geçmişi (sağlayıcınınki değil). Çözümün durumu sağlayıcınınkinden
        // "daha etkin" olamaz: sağlayıcı etkin değilse onun güncel durumu, başladığı anla çözümün çizelgesine eklenir.
        const own: Rec[] = Array.isArray(s.status_history) ? s.status_history : [];
        let rec: Rec = { status: s.status, status_history: own };
        if (w.status !== "ACTIVE") {
          const pSince = statusOf(w, uris, tl.issued_at).since;
          rec = { status: w.status, status_history: [...own, { status: w.status, since: pSince }] };
        }
        return {
          typeUri: uris.svc.wallet_solution,
          name: `${w.legal_name} (${s.solution_id})`,
          certsDer: certs,
          // çözümün kendi geçmişi yoksa başlangıcı sağlayıcının listeye ilk girdiği an (yayın zamanı her yayında değişirdi)
          ...statusOf(rec, uris, providerListedSince(w) ?? tl.issued_at),
        };
      });
    tsps.push({
      name: w.legal_name,
      address: addressOf(w, cc, undefined, problems, `wallet_provider ${w.provider_id}`),
      infoUris: [w.info_uri ?? "https://tamga.network"],
      services,
    });
  }
  const input: TrustedListInput = {
    id: `tl-${cc.toLowerCase()}`,
    sequence: tl.version,
    territory: cc,
    tslType: uris.tslType,
    statusDetermination: uris.statusDetermination,
    schemeRules: uris.schemeRules,
    schemeInfo: [...uris.schemeInfo, new URL("archive/", o.distributionPoint).href],
    operatorName: op.name,
    operatorAddress: opAddr,
    schemeName:
      `${cc}: Tamga Trust Framework trusted list — provisional operator ${op.name}` +
      (op.on_behalf_of ? `, on behalf of: ${op.on_behalf_of}` : ""),
    legalNotice:
      `Projection of the Tamga signed trusted list tl-${cc.toLowerCase()} version ${tl.version}, which remains authoritative. ` +
      "Services are approved under the Tamga Trust Framework; this is not a list notified under Regulation (EU) No 910/2014 " +
      "and no listed service is a qualified trust service in the sense of that Regulation." +
      (tl.environment === "sandbox" ? " SANDBOX — test network, not valid in the Tamga Network." : ""),
    issuedAt,
    nextUpdate,
    distributionPoints: [o.distributionPoint],
    ...(o.pointers?.length ? { pointers: o.pointers } : {}),
    tsps,
  };
  return { input, problems };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
