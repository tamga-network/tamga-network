/**
 * ETSI TS 119 612 (Trusted Lists, XML) okuyucusu — ADR-0036 federasyonunun eski AB biçimi (`format: "etsi-tl-xml"`). Liste
 * önce zarflanmış XML imzasıyla doğrulanır (`xmldsig.ts`), sonra YALNIZ doğrulanmış DOM'dan, LoTE okuyucusuyla aynı modele
 * (`ParsedLote`) çevrilir; böylece güven deposu iki biçimi aynı kurallarla uygular (kapsam FD2, tazelik, geri sarma). Platformdan
 * bağımsız (cüzdanda da çalışır).
 *
 * Okunanlar (TS 119 612 V2.4.1 §5): `SchemeInformation` (TSLVersionIdentifier 5|6, TSLSequenceNumber, TSLType,
 * SchemeOperatorName, SchemeTerritory, ListIssueDateTime, NextUpdate) ve her güven hizmeti sağlayıcısının hizmetleri
 * (ServiceTypeIdentifier, ServiceName, ServiceDigitalIdentity/X509Certificate, ServiceStatus).
 *
 * Hizmet türü → Tamga rolü: `…/Svctype/EAA/Q` (QEAA), `…/Svctype/EAA` (ulusal düzeyde EAA), `…/Svctype/EAA/Pub-EAA` →
 * `eaa_provider` (belge imzalama). Öbür türler (CA/QC, TSA, …) Tamga rolüne karşılık gelmez, yok sayılır. Etkin durumlar:
 * `granted`, `recognisedatnationallevel` (ve eski `undersupervision`, `accredited`); `withdrawn`,
 * `deprecatedatnationallevel` vb. alınmaz.
 */
import { b64ToBytes, LoteParseError, type LoteEntity, type LoteService, type ParsedLote } from "./lote-reader.js";
import { verifyEnvelopedXmlSignature, xmlChild, xmlChildren, xmlText } from "./xmldsig.js";
import type { ExternalEntityKind } from "./types.js";

export const TSL_NS = "http://uri.etsi.org/02231/v2#";
const KNOWN_TSL_VERSIONS = new Set([5, 6]);

const SVC_KIND: Array<[RegExp, ExternalEntityKind]> = [[/\/Svctype\/EAA(\/Q|\/Pub-EAA)?$/i, "eaa_provider"]];
export function tlServiceKind(typeUri: string): ExternalEntityKind | null {
  for (const [re, k] of SVC_KIND) if (re.test(typeUri)) return k;
  return null;
}
const ACTIVE = /\/(granted|recognisedatnationallevel|undersupervision|accredited)$/i;

/* eslint-disable @typescript-eslint/no-explicit-any */
type XNode = any;
const firstName = (el: XNode | undefined): string => {
  if (!el) return "";
  const names = xmlChildren(el, TSL_NS, "Name");
  const en = names.find((n) => n.getAttribute("xml:lang") === "en") ?? names[0];
  return xmlText(en);
};

/** Doğrulanmış TL DOM'unu (`verifyEnvelopedXmlSignature` sonucu) ortak modele çevirir. */
export function parseTrustedListDom(root: XNode): ParsedLote {
  if (root.namespaceURI !== TSL_NS || root.localName !== "TrustServiceStatusList")
    throw new LoteParseError("not an ETSI TS 119 612 trusted list (TrustServiceStatusList)");
  const info = xmlChild(root, TSL_NS, "SchemeInformation");
  if (!info) throw new LoteParseError("SchemeInformation missing");
  const version = Number(xmlText(xmlChild(info, TSL_NS, "TSLVersionIdentifier")));
  if (!KNOWN_TSL_VERSIONS.has(version)) throw new LoteParseError(`unknown TSLVersionIdentifier ${version} (CMP2)`);
  const sequence = Number(xmlText(xmlChild(info, TSL_NS, "TSLSequenceNumber")));
  if (!Number.isInteger(sequence) || sequence < 0) throw new LoteParseError("TSLSequenceNumber invalid");
  const territory = xmlText(xmlChild(info, TSL_NS, "SchemeTerritory"));
  if (!territory) throw new LoteParseError("SchemeTerritory missing");
  const issuedAt = new Date(xmlText(xmlChild(info, TSL_NS, "ListIssueDateTime")));
  const nu = xmlChild(info, TSL_NS, "NextUpdate");
  const nextUpdate = new Date(xmlText(nu && xmlChild(nu, TSL_NS, "dateTime")));
  if (!Number.isFinite(issuedAt.getTime()) || !Number.isFinite(nextUpdate.getTime()))
    throw new LoteParseError("ListIssueDateTime / NextUpdate unreadable (a closed list has no NextUpdate)");
  const entities: LoteEntity[] = [];
  const tspList = xmlChild(root, TSL_NS, "TrustServiceProviderList");
  for (const tsp of tspList ? xmlChildren(tspList, TSL_NS, "TrustServiceProvider") : []) {
    const tspInfo = xmlChild(tsp, TSL_NS, "TSPInformation");
    const services: LoteService[] = [];
    const svcs = xmlChild(tsp, TSL_NS, "TSPServices");
    for (const svc of svcs ? xmlChildren(svcs, TSL_NS, "TSPService") : []) {
      const si = xmlChild(svc, TSL_NS, "ServiceInformation");
      if (!si) continue;
      const typeUri = xmlText(xmlChild(si, TSL_NS, "ServiceTypeIdentifier"));
      const status = xmlText(xmlChild(si, TSL_NS, "ServiceStatus"));
      if (!ACTIVE.test(status)) continue;
      const certs: Uint8Array[] = [];
      const sdi = xmlChild(si, TSL_NS, "ServiceDigitalIdentity");
      for (const did of sdi ? xmlChildren(sdi, TSL_NS, "DigitalId") : []) {
        const c = xmlChild(did, TSL_NS, "X509Certificate");
        if (c) certs.push(b64ToBytes(xmlText(c)));
      }
      const kind = tlServiceKind(typeUri);
      services.push({
        kind,
        role: kind ? "issuance" : "other",
        typeUri,
        name: firstName(xmlChild(si, TSL_NS, "ServiceName")),
        certsDer: certs,
      });
    }
    entities.push({ name: firstName(tspInfo && xmlChild(tspInfo, TSL_NS, "TSPName")), services });
  }
  return {
    sequence,
    territory,
    issuedAt,
    nextUpdate,
    loteType: xmlText(xmlChild(info, TSL_NS, "TSLType")),
    operatorName: firstName(xmlChild(info, TSL_NS, "SchemeOperatorName")),
    entities,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * TL XML'ini doğrular ve çevirir. İmzacı sertifikasının SHA-256 parmak izi `pinnedFingerprints` içinde olmalıdır (LOTL'daki dış
 * liste kaydının `signing_keys`'i — ADR-0036 FD1); değilse liste yüklenmez.
 */
export function readTrustedListXml(
  xml: string,
  pinnedFingerprints: Set<string>,
): { list: ParsedLote; signerFingerprint: string } {
  const v = verifyEnvelopedXmlSignature(xml);
  if (!pinnedFingerprints.has(v.signerFingerprint))
    throw new LoteParseError("trusted list signer is not the pinned signer of this list");
  return { list: parseTrustedListDom(v.root), signerFingerprint: v.signerFingerprint };
}
