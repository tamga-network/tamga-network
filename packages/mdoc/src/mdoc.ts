/**
 * ISO/IEC 18013-5 mdoc — minimal profil: IssuerSigned (nameSpaces + issuerAuth) ihracı, seçici açıklama, doğrulama.
 * Selektif açıklama mekanizması: issuer TÜM alanların IssuerSignedItem'ını verir; MSO her alanın digest'ini taşır. Cüzdan
 * sunumda yalnızca seçtiği IssuerSignedItem'ları koyar; doğrulayıcı digest'lerle bütünlüğü ve MSO imzasını denetler.
 * Cihaz bağlaması: MSO deviceKey (holder açık anahtarı) + DeviceAuth (COSE_Sign1) SessionTranscript üzerinde.
 * Kapsam dışı: BLE/NFC taşıması, tam 18013-7 Annex B SessionTranscript (demo'da deterministik özet; pilot notu).
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { p256 } from "@noble/curves/nist.js";
import { encode, decode, CborTag, encodeEmbedded, type CborValue } from "./cbor.js";
import { coseSign1, coseSign1Async, coseVerify1, parseCoseSign1, coseKeyFromPoint, pointFromCoseKey } from "./cose.js";

const MSO_VERSION = "1.0";
const DIGEST_ALG = "SHA-256";

export interface IssueMdocInput {
  docType: string;
  /** { namespace: { elementIdentifier: value } } — value CBOR'a kodlanabilir olmalı (string/number/bool/bstr/tdate). */
  namespaces: Record<string, Record<string, CborValue>>;
  deviceKeyRaw: Uint8Array; // holder açık anahtarı (65 bayt uncompressed) — cihaz bağlaması
  issuerSk: Uint8Array; // issuer özel anahtarı (32 bayt)
  x5chain: Uint8Array[]; // issuer sertifika zinciri (DER)
  signed: number; // epoch sn
  validFrom: number;
  validUntil: number;
  randomBytes: (n: number) => Uint8Array;
  /** IETF Token Status List — mdoc profili: MSO'da `status.status_list {idx, uri}` (SD-JWT kopyasıyla aynı bit). */
  status?: { idx: number; uri: string };
}

/** tdate: RFC 8949 tag 0 (tstr, RFC 3339). */
const tdate = (epoch: number): CborTag =>
  new CborTag(0, new Date(epoch * 1000).toISOString().replace(/\.\d{3}Z$/, "Z"));

/** IssuerSignedItem'ı #6.24(bstr) olarak kodla; digest = SHA-256(bu baytların tamamı, tag dahil). */
function issuerSignedItemBytes(digestID: number, id: string, value: CborValue, random: Uint8Array): Uint8Array {
  const item = new Map<string, CborValue>([
    ["digestID", digestID],
    ["random", random],
    ["elementIdentifier", id],
    ["elementValue", value],
  ]);
  return encode(encodeEmbedded(item)); // tag 24 sarmalı; digest ve nameSpaces bu baytları taşır
}

export interface IssuedMdoc {
  issuerSigned: Uint8Array; // encode(IssuerSigned): { nameSpaces, issuerAuth }
  docType: string;
}

export function issueMdoc(input: IssueMdocInput): IssuedMdoc {
  const nameSpaces = new Map<string, CborValue>();
  const valueDigests = new Map<string, CborValue>();
  let nextId = 0;
  for (const [ns, elems] of Object.entries(input.namespaces)) {
    const items: CborValue[] = [];
    const digests = new Map<number, CborValue>();
    for (const [id, value] of Object.entries(elems)) {
      const digestID = nextId++;
      const random = input.randomBytes(16);
      const bytes = issuerSignedItemBytes(digestID, id, value, random);
      items.push(decode(bytes)); // CborTag (tag24) olarak sakla
      digests.set(digestID, sha256(bytes));
    }
    nameSpaces.set(ns, items);
    valueDigests.set(ns, digests);
  }
  const mso = new Map<string, CborValue>([
    ["version", MSO_VERSION],
    ["digestAlgorithm", DIGEST_ALG],
    ["valueDigests", valueDigests],
    ["deviceKeyInfo", new Map<string, CborValue>([["deviceKey", coseKeyFromPoint(input.deviceKeyRaw)]])],
    ["docType", input.docType],
    [
      "validityInfo",
      new Map<string, CborValue>([
        ["signed", tdate(input.signed)],
        ["validFrom", tdate(input.validFrom)],
        ["validUntil", tdate(input.validUntil)],
      ]),
    ],
  ]);
  if (input.status)
    mso.set(
      "status",
      new Map<string, CborValue>([
        [
          "status_list",
          new Map<string, CborValue>([
            ["idx", input.status.idx],
            ["uri", input.status.uri],
          ]),
        ],
      ]),
    );
  const issuerAuth = coseSign1(encode(encodeEmbedded(mso)), { sk: input.issuerSk, x5chain: input.x5chain });
  const issuerSigned = new Map<string, CborValue>([
    ["nameSpaces", nameSpaces],
    ["issuerAuth", decode(issuerAuth)],
  ]);
  return { issuerSigned: encode(issuerSigned), docType: input.docType };
}

/** Seçici açıklama: yalnızca istenen (namespace, elementIdentifier) alanlarını tutan yeni IssuerSigned üretir. */
export function discloseMdoc(issuerSigned: Uint8Array, disclose: Record<string, string[]>): Uint8Array {
  const m = decode(issuerSigned);
  if (!(m instanceof Map)) throw new Error("mdoc: IssuerSigned is not a map");
  const ns = m.get("nameSpaces");
  if (!(ns instanceof Map)) throw new Error("mdoc: nameSpaces missing");
  const filtered = new Map<string, CborValue>();
  for (const [namespace, ids] of Object.entries(disclose)) {
    const items = ns.get(namespace);
    if (!Array.isArray(items)) continue;
    const keep = items.filter((it) => ids.includes(readItemId(it)));
    if (keep.length) filtered.set(namespace, keep);
  }
  return encode(
    new Map<CborValue, CborValue>([
      ["nameSpaces", filtered],
      ["issuerAuth", m.get("issuerAuth")!],
    ]),
  );
}

function readItemId(item: CborValue): string {
  // item: CborTag(24, bstr) → decode → Map
  const inner = item instanceof CborTag && item.value instanceof Uint8Array ? decode(item.value) : null;
  const id = inner instanceof Map ? inner.get("elementIdentifier") : null;
  return typeof id === "string" ? id : "";
}

export interface MdocVerifyResult {
  valid: boolean;
  reason?: string;
  docType?: string;
  deviceKeyRaw?: Uint8Array;
  claims?: Record<string, Record<string, CborValue>>;
  validity?: { signed: string; validFrom: string; validUntil: string };
  /** validityInfo.signed (epoch sn) — SD-JWT `iat` muadili; C1/C2 zaman-bağımlı güven sorgusu bununla yapılır. */
  signedEpoch?: number;
  status?: { idx: number; uri: string };
  x5chain?: Uint8Array[];
}

/**
 * IssuerSigned doğrulaması: issuerAuth imzası (issuer açık anahtarıyla), açıklanan her alanın digest'i MSO ile eşleşir,
 * docType tutar, geçerlilik penceresi. `issuerPubRaw`: doğrulayıcı x5chain'den (güven listesiyle eşleyerek) çıkarır.
 */
export function verifyIssuerSigned(
  issuerSigned: Uint8Array,
  opts: { issuerPubRaw: Uint8Array; now?: number; expectedDocType?: string },
): MdocVerifyResult {
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  let m: CborValue;
  try {
    m = decode(issuerSigned);
  } catch {
    return { valid: false, reason: "IssuerSigned could not be decoded" };
  }
  if (!(m instanceof Map)) return { valid: false, reason: "IssuerSigned is not a map" };
  const issuerAuthV = m.get("issuerAuth");
  const nsV = m.get("nameSpaces");
  if (issuerAuthV === undefined || !(nsV instanceof Map))
    return { valid: false, reason: "issuerAuth/nameSpaces missing" };
  const issuerAuth = encode(issuerAuthV);
  let parsed: ReturnType<typeof parseCoseSign1>;
  let msoTag: CborValue;
  try {
    if (!coseVerify1(issuerAuth, opts.issuerPubRaw)) return { valid: false, reason: "issuerAuth signature invalid" };
    parsed = parseCoseSign1(issuerAuth);
    if (!parsed.payload) return { valid: false, reason: "issuerAuth payload missing (MSO must be attached)" };
    msoTag = decode(parsed.payload);
  } catch (e) {
    return { valid: false, reason: `issuerAuth unreadable: ${(e as Error).message}` };
  }
  let mso: CborValue | null = null;
  try {
    mso = msoTag instanceof CborTag && msoTag.value instanceof Uint8Array ? decode(msoTag.value) : null;
  } catch {
    mso = null;
  }
  if (!(mso instanceof Map)) return { valid: false, reason: "MSO could not be decoded" };
  if (mso.get("digestAlgorithm") !== DIGEST_ALG) return { valid: false, reason: "digestAlgorithm is not SHA-256" };
  const docType = mso.get("docType");
  if (typeof docType !== "string") return { valid: false, reason: "docType missing" };
  if (opts.expectedDocType && docType !== opts.expectedDocType)
    return { valid: false, reason: `unexpected docType (${docType})` };

  // geçerlilik
  const vi = mso.get("validityInfo");
  const readDate = (t: CborValue) =>
    t instanceof CborTag && typeof t.value === "string" ? Date.parse(t.value) / 1000 : NaN;
  if (!(vi instanceof Map)) return { valid: false, reason: "validityInfo missing" };
  const vs = readDate(vi.get("signed") as CborValue);
  const vf = readDate(vi.get("validFrom") as CborValue);
  const vu = readDate(vi.get("validUntil") as CborValue);
  // okunamayan tarih geçerli sayılmaz (fail-closed): NaN ile her karşılaştırma false olur ve kontrol sessizce geçerdi
  if (!Number.isFinite(vs) || !Number.isFinite(vf) || !Number.isFinite(vu))
    return { valid: false, reason: "validityInfo dates unreadable" };
  if (now < vf) return { valid: false, reason: "document not yet valid" };
  if (now > vu) return { valid: false, reason: "document expired" };

  // digest bütünlüğü — açıklanan her alan MSO'daki digest ile eşleşmeli
  const valueDigests = mso.get("valueDigests");
  if (!(valueDigests instanceof Map)) return { valid: false, reason: "valueDigests missing" };
  const claims: Record<string, Record<string, CborValue>> = {};
  for (const [ns, items] of nsV.entries()) {
    if (typeof ns !== "string" || !Array.isArray(items)) continue;
    const nsDigests = valueDigests.get(ns);
    if (!(nsDigests instanceof Map)) return { valid: false, reason: `namespace digest missing: ${ns}` };
    claims[ns] = {};
    for (const item of items) {
      if (!(item instanceof CborTag) || !(item.value instanceof Uint8Array))
        return { valid: false, reason: "IssuerSignedItem is not tag 24" };
      const bytes = encode(item);
      let inner: CborValue;
      try {
        inner = decode(item.value);
      } catch (e) {
        return { valid: false, reason: `IssuerSignedItem could not be decoded: ${(e as Error).message}` };
      }
      if (!(inner instanceof Map)) return { valid: false, reason: "IssuerSignedItem is not a map" };
      const digestID = inner.get("digestID");
      const expected = typeof digestID === "number" ? nsDigests.get(digestID) : undefined;
      if (!(expected instanceof Uint8Array))
        return { valid: false, reason: `digest missing: ${ns}/${String(digestID)}` };
      const actual = sha256(bytes);
      if (!eqBytes(actual, expected)) return { valid: false, reason: `digest mismatch: ${ns}/${String(digestID)}` };
      const id = inner.get("elementIdentifier");
      if (typeof id !== "string") return { valid: false, reason: "elementIdentifier missing" };
      if (RESERVED_IDS.has(id)) return { valid: false, reason: `reserved elementIdentifier: ${id}` };
      claims[ns][id] = inner.get("elementValue") as CborValue;
    }
  }

  const dki = mso.get("deviceKeyInfo");
  const deviceKey = dki instanceof Map ? dki.get("deviceKey") : undefined;
  let deviceKeyRaw: Uint8Array | undefined;
  try {
    deviceKeyRaw = deviceKey ? pointFromCoseKey(deviceKey as CborValue) : undefined;
  } catch {
    return { valid: false, reason: "deviceKey unreadable" };
  }

  const st = mso.get("status");
  const sl = st instanceof Map ? st.get("status_list") : undefined;
  const status =
    sl instanceof Map && typeof sl.get("idx") === "number" && typeof sl.get("uri") === "string"
      ? { idx: sl.get("idx") as number, uri: sl.get("uri") as string }
      : undefined;
  return {
    valid: true,
    docType,
    deviceKeyRaw,
    claims,
    signedEpoch: Math.floor(vs),
    status,
    validity: {
      signed: String((vi.get("signed") as CborTag)?.value ?? ""),
      validFrom: String((vi.get("validFrom") as CborTag)?.value ?? ""),
      validUntil: String((vi.get("validUntil") as CborTag)?.value ?? ""),
    },
    x5chain: parsed.x5chain,
  };
}

/** Nesne prototipi adları alan adı olamaz (doğrulayıcı alanları düz nesneye yerleştirir). */
const RESERVED_IDS = new Set(["__proto__", "constructor", "prototype"]);

function eqBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

// ---------- Cihaz kimlik doğrulaması (holder binding) — ISO 18013-5 §9.1.3, OpenID4VP 1.0 Ek B.2.6
/**
 * DeviceAuthenticationBytes = #6.24(bstr .cbor ["DeviceAuthentication", SessionTranscript, DocType, DeviceNameSpacesBytes]).
 * SessionTranscript dizinin kendisidir (`sessionTranscript` = onun CBOR baytları). DeviceNameSpaces boş (Tamga profili).
 * Cihaz imzası bu baytlar üzerinde AYRIK yükle (payload nil) COSE_Sign1'dir.
 */
export function deviceAuthBytes(sessionTranscript: Uint8Array, docType: string): Uint8Array {
  const emptyDeviceNameSpaces = encodeEmbedded(new Map<CborValue, CborValue>());
  return encode(encodeEmbedded(["DeviceAuthentication", decode(sessionTranscript), docType, emptyDeviceNameSpaces]));
}

export function deviceSign(sessionTranscript: Uint8Array, docType: string, deviceSk: Uint8Array): Uint8Array {
  return coseSign1(deviceAuthBytes(sessionTranscript, docType), { sk: deviceSk, detached: true });
}

export function verifyDeviceAuth(
  deviceSignature: Uint8Array,
  sessionTranscript: Uint8Array,
  docType: string,
  deviceKeyRaw: Uint8Array,
): boolean {
  // Ayrık yük: DeviceAuthenticationBytes'ı doğrulayan bu isteğin SessionTranscript'inden kendisi kurar
  try {
    const parsed = parseCoseSign1(deviceSignature);
    if (parsed.payload !== null) return false; // ISO 18013-5: deviceSignature yükü nil olmalı
    return coseVerify1(deviceSignature, deviceKeyRaw, new Uint8Array(0), deviceAuthBytes(sessionTranscript, docType));
  } catch {
    return false; // bozuk COSE yapısı = geçersiz imza (istisna yukarı taşmaz)
  }
}

/** Cihaz imzası, harici imzalayıcıyla (cüzdan KeyProvider: anahtar cihazdan çıkmaz). */
export function deviceSignAsync(
  sessionTranscript: Uint8Array,
  docType: string,
  sign: (tbs: Uint8Array) => Promise<Uint8Array>,
): Promise<Uint8Array> {
  return coseSign1Async(deviceAuthBytes(sessionTranscript, docType), { sign, detached: true });
}

// ---------- DeviceResponse (ISO 18013-5 §8.3.2.1.2.2) — OpenID4VP `vp_token` içinde base64url olarak taşınır (18013-7)
/**
 * DeviceResponse = { version: "1.0", documents: [ { docType, issuerSigned, deviceSigned: { nameSpaces: #6.24({}),
 * deviceAuth: { deviceSignature: COSE_Sign1 } } } ], status: 0 }. Tek belge (Tamga profili: sorgu başına bir belge).
 */
export function buildDeviceResponse(input: {
  docType: string;
  issuerSigned: Uint8Array; // (seçici açıklanmış) encode(IssuerSigned)
  deviceSignature: Uint8Array; // encode(COSE_Sign1)
}): Uint8Array {
  const doc = new Map<string, CborValue>([
    ["docType", input.docType],
    ["issuerSigned", decode(input.issuerSigned)],
    [
      "deviceSigned",
      new Map<string, CborValue>([
        ["nameSpaces", encodeEmbedded(new Map<CborValue, CborValue>())],
        ["deviceAuth", new Map<string, CborValue>([["deviceSignature", decode(input.deviceSignature)]])],
      ]),
    ],
  ]);
  return encode(
    new Map<string, CborValue>([
      ["version", "1.0"],
      ["documents", [doc]],
      ["status", 0],
    ]),
  );
}

export function parseDeviceResponse(bytes: Uint8Array): {
  docType: string;
  issuerSigned: Uint8Array;
  deviceSignature: Uint8Array;
} {
  const r = decode(bytes);
  if (!(r instanceof Map)) throw new Error("DeviceResponse is not a map");
  if (r.get("status") !== 0) throw new Error(`DeviceResponse status ${String(r.get("status"))}`);
  const docs = r.get("documents");
  if (!Array.isArray(docs) || docs.length !== 1) throw new Error("DeviceResponse: expected a single document");
  const doc = docs[0];
  if (!(doc instanceof Map)) throw new Error("DeviceResponse: document is not a map");
  const docType = doc.get("docType");
  const issuerSigned = doc.get("issuerSigned");
  const ds = doc.get("deviceSigned");
  const auth = ds instanceof Map ? ds.get("deviceAuth") : undefined;
  const sig = auth instanceof Map ? auth.get("deviceSignature") : undefined;
  if (typeof docType !== "string" || issuerSigned === undefined || sig === undefined)
    throw new Error("DeviceResponse: docType/issuerSigned/deviceSignature missing");
  return { docType, issuerSigned: encode(issuerSigned), deviceSignature: encode(sig) };
}

/**
 * OpenID4VP 1.0 Ek B.2.6.1 SessionTranscript (yönlendirmeli akış):
 *   SessionTranscript = [null, null, ["OpenID4VPHandover", sha256(cbor([client_id, nonce, jwkThumbprint, response_uri]))]]
 * `jwkThumbprint` = yanıt şifreliyse doğrulayıcının şifreleme anahtarının SHA-256 JWK parmak izi (RFC 7638), değilse null.
 * Dönüş: SessionTranscript'in CBOR baytları.
 */
export function oid4vpSessionTranscript(
  clientId: string,
  nonce: string,
  responseUri: string,
  jwkThumbprint: Uint8Array | null = null,
): Uint8Array {
  const infoHash = sha256(encode([clientId, nonce, jwkThumbprint, responseUri]));
  return encode([null, null, ["OpenID4VPHandover", infoHash]]);
}

/**
 * OpenID4VP 1.0 Ek B.2.6.2 SessionTranscript (tarayıcı Digital Credentials API'si):
 *   SessionTranscript = [null, null, ["OpenID4VPDCAPIHandover", sha256(cbor([origin, nonce, jwkThumbprint]))]]
 * `origin` = isteği yapan sayfanın kökeni (tarayıcı/işletim sistemi verir); `jwkThumbprint` şifreli yanıtta anahtar parmak izi.
 */
export function dcApiSessionTranscript(
  origin: string,
  nonce: string,
  jwkThumbprint: Uint8Array | null = null,
): Uint8Array {
  const infoHash = sha256(encode([origin, nonce, jwkThumbprint]));
  return encode([null, null, ["OpenID4VPDCAPIHandover", infoHash]]);
}

export { pointFromCoseKey, coseKeyFromPoint };
export { p256 };
