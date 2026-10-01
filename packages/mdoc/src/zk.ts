/**
 * Sıfır bilgi ispatlı mdoc sunumu (ADR-0032; AB TS13 §5): DeviceResponse içinde `Document` yerine `ZkDocument`.
 *
 *   ZkDocument      = { "documentData": #6.24(bstr .cbor ZkDocumentData), "proof": bstr }
 *   ZkDocumentData  = { "docType", "zkSystemId", "timestamp", ? "issuerSigned": ZkNameSpaces, ? "msoX5chain": COSE_X509 }
 *   ZkNameSpaces    = { + NameSpace => [ + { "elementIdentifier", "elementValue" } ] }
 *
 * Tamga profili: `zkSystemId` = kabul edilen devrenin kimliği (Longfellow `combined_hash`, onaltılık; imzalı listede
 * `zk_circuits[].circuit_id`); `timestamp` = ispatın "şimdi"si (ISO 8601, saniye, `Z`); `msoX5chain` = kurum yaprak sertifikası
 * (DER, tek bstr) ya da zincir (bstr dizisi). İspat kurum imzasını, docType'ı, açıklanan değerleri ve cihaz imzasını (oturum
 * dökümüne bağlı) bağlar; belge, MSO, cihaz anahtarı ve durum listesi indeksi doğrulayıcıya gitmez (ZK3, ZK4).
 */
import { decode, decodeEmbedded, encode, encodeEmbedded, type CborValue } from "./cbor.js";

export interface ZkDisclosed {
  namespace: string;
  elements: Record<string, CborValue>;
}
export interface ZkDocumentInput {
  docType: string;
  zkSystemId: string;
  timestamp: string;
  disclosed: ZkDisclosed;
  msoX5chain: Uint8Array[];
  proof: Uint8Array;
}
export interface ZkDocumentParsed extends ZkDocumentInput {
  /** Açıklanan her öğenin değerinin CBOR kodlaması (doğrulayıcı devreye bu baytları verir). */
  elementCbor: Record<string, Uint8Array>;
}

export function buildZkDeviceResponse(d: ZkDocumentInput): Uint8Array {
  const items = Object.entries(d.disclosed.elements).map(
    ([k, v]) =>
      new Map<string, CborValue>([
        ["elementIdentifier", k],
        ["elementValue", v],
      ]),
  );
  const data = new Map<string, CborValue>([
    ["docType", d.docType],
    ["zkSystemId", d.zkSystemId],
    ["timestamp", d.timestamp],
    ["issuerSigned", new Map<CborValue, CborValue>([[d.disclosed.namespace, items]])],
    ["msoX5chain", d.msoX5chain.length === 1 ? d.msoX5chain[0] : d.msoX5chain],
  ]);
  const zkDoc = new Map<string, CborValue>([
    ["documentData", encodeEmbedded(data)],
    ["proof", d.proof],
  ]);
  return encode(
    new Map<string, CborValue>([
      ["version", "1.0"],
      ["zkDocuments", [zkDoc]],
      ["status", 0],
    ]),
  );
}

/** Tek ZkDocument'lı DeviceResponse'u çözer; tek ad alanı (ZK6) ve en az bir açıklanan öğe zorunlu. */
export function parseZkDeviceResponse(bytes: Uint8Array): ZkDocumentParsed {
  const r = decode(bytes);
  if (!(r instanceof Map)) throw new Error("DeviceResponse is not a map");
  if (r.get("status") !== 0) throw new Error(`DeviceResponse status ${String(r.get("status"))}`);
  if (r.has("documents")) throw new Error("DeviceResponse carries plain documents; expected zkDocuments only");
  const docs = r.get("zkDocuments");
  if (!Array.isArray(docs) || docs.length !== 1) throw new Error("DeviceResponse: expected a single zkDocument");
  const doc = docs[0];
  if (!(doc instanceof Map)) throw new Error("zkDocument is not a map");
  const proof = doc.get("proof");
  if (!(proof instanceof Uint8Array)) throw new Error("zkDocument: proof missing");
  const data = decodeEmbedded(doc.get("documentData") as CborValue);
  if (!(data instanceof Map)) throw new Error("ZkDocumentData is not a map");
  const s = (k: string) => {
    const v = data.get(k);
    if (typeof v !== "string") throw new Error(`ZkDocumentData.${k} missing`);
    return v;
  };
  const ns = data.get("issuerSigned");
  if (!(ns instanceof Map) || ns.size !== 1)
    throw new Error("ZkDocumentData.issuerSigned: exactly one namespace expected");
  const [[namespace, list]] = [...ns.entries()];
  if (typeof namespace !== "string" || !Array.isArray(list) || !list.length)
    throw new Error("ZkDocumentData.issuerSigned: no disclosed elements");
  const elements: Record<string, CborValue> = {};
  const elementCbor: Record<string, Uint8Array> = {};
  for (const it of list) {
    if (!(it instanceof Map)) throw new Error("ZkSignedItem is not a map");
    const id = it.get("elementIdentifier");
    if (typeof id !== "string" || !it.has("elementValue")) throw new Error("ZkSignedItem incomplete");
    if (Object.prototype.hasOwnProperty.call(elements, id)) throw new Error(`duplicate element ${id}`);
    elements[id] = it.get("elementValue") as CborValue;
    elementCbor[id] = encode(elements[id]);
  }
  const x5 = data.get("msoX5chain");
  const msoX5chain =
    x5 instanceof Uint8Array
      ? [x5]
      : Array.isArray(x5) && x5.every((c) => c instanceof Uint8Array)
        ? (x5 as Uint8Array[])
        : [];
  if (!msoX5chain.length) throw new Error("ZkDocumentData.msoX5chain missing");
  return {
    docType: s("docType"),
    zkSystemId: s("zkSystemId"),
    timestamp: s("timestamp"),
    disclosed: { namespace, elements },
    elementCbor,
    msoX5chain,
    proof,
  };
}
