/**
 * ISO/IEC 18013-5 yakın alan sunumu (P4-3) — taşıyıcıdan bağımsız protokol çekirdeği (saf TS; RN/Hermes ve Node).
 *  - Cihaz tanıtımı (DeviceEngagement, §8.2.1.1): QR "mdoc:" + base64url(DeviceEngagement); geçici EDeviceKey + BLE UUID.
 *  - Oturum kurulumu (§9.1.1): SessionEstablishment { eReaderKey, data }; SessionTranscript = [DeviceEngagementBytes,
 *    EReaderKeyBytes, Handover=null (QR)]. SKReader / SKDevice = HKDF-SHA256(ECDH Z, salt = SHA-256(SessionTranscriptBytes)).
 *  - Şifreleme (§9.1.1.5): AES-256-GCM, IV = kimlik (okuyucu 0…0, cihaz 0…01; 8 bayt) ‖ ileti sayacı (4 bayt, 1'den).
 *  - SessionData { data | status } — status 20 = oturum sonu.
 *  - BLE (§8.3.3.1.1): GATT karakteristikleri; ileti parçaları ilk bayt 0x01 (devamı var) / 0x00 (son).
 * Cihaz imzası (DeviceAuth) `deviceSignAsync(sessionTranscript(...))` ile, holder anahtarı cihazdan çıkmadan.
 *  - Okuyucu kimliği (§9.1.4, 0.6.0): DocRequest `readerAuth` = ayrık yüklü COSE_Sign1, yük ReaderAuthenticationBytes =
 *    #6.24(["ReaderAuthentication", SessionTranscript, ItemsRequestBytes]), okuyucu sertifika zinciri korumasız başlıkta (x5chain).
 *  - Sunum teklifi (AB TS9 v1.1 STS9_12–18, 0.6.0): DeviceEngagement'ın `-1` anahtarında `PresentationOffer`
 *    `{0: "1.0", 1: [{0: DocType, 1: {NameSpace: [DataElementIdentifier, …]}}, …]}` — cüzdandan cüzdana gösterende hangi alanların
 *    istenebileceği. Teklifi bilmeyen okuyucu anahtarı yok sayar.
 *  - `requestInfo` (§8.3.2.1.2.1, 0.6.0): ItemsRequest'in isteğe bağlı haritası; AB'de `euWrprc` = CBOR kayıt sertifikası
 *    (Uygulama Tüzüğü (AB) 2024/2979 Ek, 2026/1731 ile: ISO/IEC 18013-5-REQ-04…07; ağın ADR-0026 K5'i).
 */
import { gcm } from "@noble/ciphers/aes.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { randomBytes as nobleRandom } from "@noble/hashes/utils.js";
import { p256 } from "@noble/curves/nist.js";
import { CborTag, decode, encode, encodeEmbedded, type CborValue } from "./cbor.js";
import { coseKeyFromPoint, coseSign1, coseVerify1, parseCoseSign1, pointFromCoseKey } from "./cose.js";

export const CIPHER_SUITE_1 = 1;
/** Kabul edilen DeviceEngagement sürümleri (biz "1.0" üretiriz). */
export const DEVICE_ENGAGEMENT_VERSIONS: ReadonlySet<string> = new Set(["1.0", "1.1"]);
export const SESSION_STATUS_END = 20;
/** ISO 18013-5 §8.3.3.1.1.4 mdoc peripheral server mode karakteristikleri */
export const BLE_STATE_UUID = "00000001-A123-48CE-896B-4C76973373E6";
export const BLE_CLIENT2SERVER_UUID = "00000002-A123-48CE-896B-4C76973373E6";
export const BLE_SERVER2CLIENT_UUID = "00000003-A123-48CE-896B-4C76973373E6";
export const BLE_STATE_START = 0x01;
export const BLE_STATE_END = 0x02;

const utf8 = (s: string) => new TextEncoder().encode(s);
const b64u = (b: Uint8Array) => {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const b64uDecode = (s: string) => {
  const t = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(t + "=".repeat((4 - (t.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};
const uuidBytes = (u: string) =>
  Uint8Array.from(
    u
      .replace(/-/g, "")
      .match(/../g)!
      .map((h) => parseInt(h, 16)),
  );
export const uuidString = (b: Uint8Array) => {
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`.toUpperCase();
};

// ------------------------------------------------------------------ oturum anahtarları ve şifreleme
interface Keys {
  skReader: Uint8Array;
  skDevice: Uint8Array;
}
/** SessionTranscript (dizi) CBOR baytları — DeviceAuth bunu kullanır. */
export function sessionTranscript(deviceEngagementBytes: Uint8Array, eReaderKeyBytes: Uint8Array): Uint8Array {
  return encode([new CborTag(24, deviceEngagementBytes), new CborTag(24, eReaderKeyBytes), null]);
}
function deriveKeys(sk: Uint8Array, peerPoint: Uint8Array, transcript: Uint8Array): Keys {
  const z = p256.getSharedSecret(sk, peerPoint, true).subarray(1); // x koordinatı (32 bayt)
  const salt = sha256(encode(new CborTag(24, transcript))); // SessionTranscriptBytes = #6.24(bstr .cbor ST)
  return {
    skReader: hkdf(sha256, z, salt, utf8("SKReader"), 32),
    skDevice: hkdf(sha256, z, salt, utf8("SKDevice"), 32),
  };
}
function iv(identifier: 0 | 1, counter: number): Uint8Array {
  const out = new Uint8Array(12);
  out[7] = identifier;
  new DataView(out.buffer).setUint32(8, counter);
  return out;
}
const seal = (key: Uint8Array, id: 0 | 1, counter: number, plain: Uint8Array) =>
  gcm(key, iv(id, counter)).encrypt(plain);
const open = (key: Uint8Array, id: 0 | 1, counter: number, ct: Uint8Array) => gcm(key, iv(id, counter)).decrypt(ct);

// ------------------------------------------------------------------ sunum teklifi (AB TS9 v1.1, STS9_12–18)
/** TS9 `PresentationOffer` — bu belgede sürüm "1.0". */
export const PRESENTATION_OFFER_VERSION = "1.0";
const DE_OFFER_KEY = -1;
export interface OfferedDocument {
  docType: string;
  /** ad alanı → teklif edilen öğe tanımlayıcıları */
  nameSpaces: Record<string, string[]>;
}
export interface PresentationOffer {
  version: string;
  docs: OfferedDocument[];
}
export function encodePresentationOffer(o: PresentationOffer): CborValue {
  return new Map<number, CborValue>([
    [0, o.version],
    [
      1,
      o.docs.map(
        (d) =>
          new Map<number, CborValue>([
            [0, d.docType],
            [1, new Map<string, CborValue>(Object.entries(d.nameSpaces).map(([ns, ids]) => [ns, [...ids]]))],
          ]),
      ),
    ],
  ]);
}
/** Teklifi okur; biçimi bozuksa hata (okuyucu bozuk teklifi yok saymaz — gösteren kısıt koymak istedi). */
export function decodePresentationOffer(v: unknown): PresentationOffer {
  if (!(v instanceof Map)) throw new Error("PresentationOffer: not a map");
  const version = v.get(0);
  const docs = v.get(1);
  if (typeof version !== "string" || !Array.isArray(docs)) throw new Error("PresentationOffer: version/docs");
  return {
    version,
    docs: docs.map((d) => {
      if (!(d instanceof Map) || typeof d.get(0) !== "string" || !(d.get(1) instanceof Map))
        throw new Error("PresentationOffer: DocOffer");
      const nameSpaces: Record<string, string[]> = {};
      for (const [ns, ids] of d.get(1) as Map<unknown, unknown>) {
        if (typeof ns !== "string" || !Array.isArray(ids) || !ids.every((x) => typeof x === "string"))
          throw new Error("PresentationOffer: namespace entries");
        nameSpaces[ns] = ids as string[];
      }
      return { docType: d.get(0) as string, nameSpaces };
    }),
  };
}
/**
 * İstek teklifin alt kümesi mi (STS9_28/34): her istenen belge türü teklifte, her istenen öğe o türün o ad alanında teklif edilmiş.
 * Saklama niyetine bakmaz (`hasIntentToRetain`).
 */
export function isSubsetOfOffer(items: ItemsRequest[], offer: PresentationOffer): boolean {
  return items.every((it) => {
    const doc = offer.docs.find((d) => d.docType === it.docType);
    if (!doc) return false;
    return Object.entries(it.nameSpaces).every(([ns, els]) =>
      Object.keys(els).every((e) => (doc.nameSpaces[ns] ?? []).includes(e)),
    );
  });
}
/** İstekte saklama niyeti (IntentToRetain) `true` olan bir öğe var mı (STS9_29/34). */
export const hasIntentToRetain = (items: ItemsRequest[]) =>
  items.some((it) => Object.values(it.nameSpaces).some((els) => Object.values(els).some((v) => v === true)));

// ------------------------------------------------------------------ cihaz tanıtımı (mdoc tarafı)
export interface HolderEngagement {
  /** QR içeriği: "mdoc:" + base64url(DeviceEngagement) */
  qr: string;
  /** DeviceEngagement CBOR baytları (SessionTranscript'te #6.24 ile) */
  deviceEngagementBytes: Uint8Array;
  /** BLE hizmet UUID'si (mdoc peripheral server mode) */
  bleServiceUuid: string;
  eDeviceSk: Uint8Array;
}
export function createEngagement(
  opts: { randomBytes?: (n: number) => Uint8Array; offer?: PresentationOffer } = {},
): HolderEngagement {
  const rnd = opts.randomBytes ?? nobleRandom;
  let eDeviceSk: Uint8Array;
  do eDeviceSk = rnd(32);
  while (!p256.utils.isValidSecretKey(eDeviceSk));
  const uuid = rnd(16);
  uuid[6] = (uuid[6] & 0x0f) | 0x40; // UUID v4
  uuid[8] = (uuid[8] & 0x3f) | 0x80;
  const eDeviceKeyBytes = encode(coseKeyFromPoint(p256.getPublicKey(eDeviceSk, false)));
  const bleOptions = new Map<number, CborValue>([
    [0, true], // peripheral server mode
    [1, false], // central client mode
    [10, uuid], // peripheral server mode UUID
  ]);
  const de = new Map<number, CborValue>([
    [0, "1.0"],
    [1, [CIPHER_SUITE_1, new CborTag(24, eDeviceKeyBytes)]],
    [2, [[2, 1, bleOptions]]], // DeviceRetrievalMethods: BLE (type 2, version 1)
  ]);
  if (opts.offer) de.set(DE_OFFER_KEY, encodePresentationOffer(opts.offer)); // TS9 STS9_12
  const deviceEngagementBytes = encode(de);
  return {
    qr: `mdoc:${b64u(deviceEngagementBytes)}`,
    deviceEngagementBytes,
    bleServiceUuid: uuidString(uuid),
    eDeviceSk,
  };
}

/** Okuyucu: QR → DeviceEngagement (EDeviceKey noktası, BLE UUID). */
export function parseEngagement(qr: string): {
  deviceEngagementBytes: Uint8Array;
  eDevicePoint: Uint8Array;
  bleServiceUuid?: string;
  /** TS9 sunum teklifi (DeviceEngagement[-1]); yoksa yok */
  offer?: PresentationOffer;
} {
  if (!qr.startsWith("mdoc:")) throw new Error("engagement: not an mdoc QR");
  const deviceEngagementBytes = b64uDecode(qr.slice(5));
  const de = decode(deviceEngagementBytes);
  // ISO 18013-5: DeviceEngagement "1.0"; "1.1" ek alanlar (ör. yetenekler) taşır — okuduğumuz alanlar iki sürümde aynı
  if (!(de instanceof Map) || !DEVICE_ENGAGEMENT_VERSIONS.has(de.get(0) as string))
    throw new Error("engagement: version");
  const sec = de.get(1);
  if (!Array.isArray(sec) || sec[0] !== CIPHER_SUITE_1 || !(sec[1] instanceof CborTag) || sec[1].tag !== 24)
    throw new Error("engagement: security");
  const eDevicePoint = pointFromCoseKey(decode(sec[1].value as Uint8Array));
  let bleServiceUuid: string | undefined;
  const methods = de.get(2);
  if (Array.isArray(methods))
    for (const m of methods)
      if (Array.isArray(m) && m[0] === 2 && m[2] instanceof Map && m[2].get(10) instanceof Uint8Array)
        bleServiceUuid = uuidString(m[2].get(10) as Uint8Array);
  const rawOffer = de.get(DE_OFFER_KEY);
  const offer = rawOffer === undefined ? undefined : decodePresentationOffer(rawOffer);
  return {
    deviceEngagementBytes,
    eDevicePoint,
    ...(bleServiceUuid ? { bleServiceUuid } : {}),
    ...(offer ? { offer } : {}),
  };
}

// ------------------------------------------------------------------ istek (okuyucu) / yanıt (mdoc)
/** ISO 18013-5 §8.3.2.1.2.1 `RequestInfo`; AB alanı `euWrprc` (CBOR kayıt sertifikası, `rc-wrp+cwt`). */
export interface RequestInfo {
  euWrprc?: Uint8Array;
  [key: string]: CborValue | undefined;
}
export interface ItemsRequest {
  docType: string;
  /** ad alanı → öğe → saklama niyeti (intentToRetain) */
  nameSpaces: Record<string, Record<string, boolean>>;
  requestInfo?: RequestInfo;
}
/** Çözülmüş istek öğesi: imzalı baytlar (okuyucu kimliği bunlar üzerinde doğrulanır) ve varsa `readerAuth`. */
export interface DecodedItemsRequest extends ItemsRequest {
  /** ItemsRequest CBOR baytları (#6.24 içindeki bstr) */
  itemsRequestBytes: Uint8Array;
  /** ReaderAuth (COSE_Sign1, ayrık yük); okuyucu kimliğini doğrulamadıysa yok */
  readerAuth?: Uint8Array;
}
function itemsRequestCbor(it: ItemsRequest): Uint8Array {
  const m = new Map<string, CborValue>([
    ["docType", it.docType],
    [
      "nameSpaces",
      new Map<string, CborValue>(
        Object.entries(it.nameSpaces).map(([ns, els]) => [ns, new Map<string, CborValue>(Object.entries(els))]),
      ),
    ],
  ]);
  const info = Object.entries(it.requestInfo ?? {}).filter(([, v]) => v !== undefined) as Array<[string, CborValue]>;
  if (info.length) m.set("requestInfo", new Map<string, CborValue>(info));
  return encode(m);
}
/**
 * DeviceRequest. `readerAuthFor` verilirse her istek öğesi okuyucu imzası taşır (imza ItemsRequestBytes üzerindedir; okuyucu
 * oturumunda `readerStart` bunu oturum dökümüyle kurar).
 */
export function encodeDeviceRequest(
  items: ItemsRequest[],
  readerAuthFor?: (itemsRequestBytes: Uint8Array) => Uint8Array,
): Uint8Array {
  return encode(
    new Map<string, CborValue>([
      ["version", "1.0"],
      [
        "docRequests",
        items.map((it) => {
          const bytes = itemsRequestCbor(it);
          const dr = new Map<string, CborValue>([["itemsRequest", new CborTag(24, bytes)]]);
          if (readerAuthFor) dr.set("readerAuth", decode(readerAuthFor(bytes)));
          return dr;
        }),
      ],
    ]),
  );
}

// ------------------------------------------------------------------ okuyucu kimliği (ReaderAuth, §9.1.4)
/** ReaderAuthenticationBytes = #6.24(bstr .cbor ["ReaderAuthentication", SessionTranscript, ItemsRequestBytes]). */
export function readerAuthBytes(sessionTranscriptBytes: Uint8Array, itemsRequestBytes: Uint8Array): Uint8Array {
  return encode(
    encodeEmbedded(["ReaderAuthentication", decode(sessionTranscriptBytes), new CborTag(24, itemsRequestBytes)]),
  );
}
/** Okuyucu: ReaderAuth (ayrık yüklü COSE_Sign1; okuyucu sertifika zinciri korumasız başlıkta `x5chain`). */
export function signReaderAuth(
  sessionTranscriptBytes: Uint8Array,
  itemsRequestBytes: Uint8Array,
  key: { sk: Uint8Array; x5chain: Uint8Array[] },
): Uint8Array {
  return coseSign1(readerAuthBytes(sessionTranscriptBytes, itemsRequestBytes), {
    sk: key.sk,
    x5chain: key.x5chain,
    detached: true,
  });
}
/**
 * mdoc: okuyucu imzasını bu oturumun dökümüyle doğrular. Geçerse okuyucu zinciri (yaprak ilk) döner; güven kararı (zincir, kayıt)
 * çağıranındır. İmza bozuk, yük ekli ya da zincir yoksa `null`.
 */
export function verifyReaderAuth(
  readerAuth: Uint8Array,
  sessionTranscriptBytes: Uint8Array,
  itemsRequestBytes: Uint8Array,
  publicKeyOf: (leafDer: Uint8Array) => Uint8Array,
): { chainDer: Uint8Array[] } | null {
  try {
    const parsed = parseCoseSign1(readerAuth);
    if (parsed.payload !== null || !parsed.x5chain.length) return null;
    const ok = coseVerify1(
      readerAuth,
      publicKeyOf(parsed.x5chain[0]),
      new Uint8Array(0),
      readerAuthBytes(sessionTranscriptBytes, itemsRequestBytes),
    );
    return ok ? { chainDer: parsed.x5chain } : null;
  } catch {
    return null;
  }
}

export function decodeDeviceRequest(bytes: Uint8Array): DecodedItemsRequest[] {
  const r = decode(bytes);
  if (!(r instanceof Map) || r.get("version") !== "1.0") throw new Error("DeviceRequest: version");
  const docs = r.get("docRequests");
  if (!Array.isArray(docs)) throw new Error("DeviceRequest: docRequests");
  return docs.map((d) => {
    const tag = d instanceof Map ? d.get("itemsRequest") : undefined;
    if (!(tag instanceof CborTag) || tag.tag !== 24 || !(tag.value instanceof Uint8Array))
      throw new Error("DeviceRequest: itemsRequest");
    const itemsRequestBytes = tag.value;
    const ir = decode(itemsRequestBytes);
    if (!(ir instanceof Map) || typeof ir.get("docType") !== "string") throw new Error("DeviceRequest: docType");
    const nsm = ir.get("nameSpaces");
    const nameSpaces: ItemsRequest["nameSpaces"] = {};
    if (nsm instanceof Map)
      for (const [ns, els] of nsm)
        if (typeof ns === "string" && els instanceof Map)
          nameSpaces[ns] = Object.fromEntries([...els].map(([k, v]) => [String(k), v === true]));
    const ri = ir.get("requestInfo");
    let requestInfo: RequestInfo | undefined;
    if (ri instanceof Map) {
      requestInfo = {};
      for (const [k, v] of ri) if (typeof k === "string") requestInfo[k] = v;
      if (requestInfo.euWrprc !== undefined && !(requestInfo.euWrprc instanceof Uint8Array))
        throw new Error("DeviceRequest: requestInfo.euWrprc is not a byte string");
    }
    const ra = (d as Map<string, CborValue>).get("readerAuth");
    return {
      docType: ir.get("docType") as string,
      nameSpaces,
      itemsRequestBytes,
      ...(requestInfo ? { requestInfo } : {}),
      ...(ra !== undefined && ra !== null ? { readerAuth: encode(ra) } : {}),
    };
  });
}

// ------------------------------------------------------------------ oturumlar
export interface HolderSession {
  keys: Keys;
  /** DeviceAuth için SessionTranscript (dizi CBOR) */
  transcript: Uint8Array;
  request: DecodedItemsRequest[];
  sendCounter: number;
}
/** mdoc: okuyucunun ilk iletisi (SessionEstablishment) → oturum + çözülmüş istek. */
export function holderReceiveEstablishment(engagement: HolderEngagement, bytes: Uint8Array): HolderSession {
  const m = decode(bytes);
  if (!(m instanceof Map)) throw new Error("SessionEstablishment: not a map");
  const ek = m.get("eReaderKey");
  const data = m.get("data");
  if (!(ek instanceof CborTag) || ek.tag !== 24 || !(data instanceof Uint8Array))
    throw new Error("SessionEstablishment: eReaderKey/data");
  const eReaderKeyBytes = ek.value as Uint8Array;
  const transcript = sessionTranscript(engagement.deviceEngagementBytes, eReaderKeyBytes);
  const keys = deriveKeys(engagement.eDeviceSk, pointFromCoseKey(decode(eReaderKeyBytes)), transcript);
  const plain = open(keys.skReader, 0, 1, data);
  return { keys, transcript, request: decodeDeviceRequest(plain), sendCounter: 0 };
}
/** mdoc: DeviceResponse → SessionData (SKDevice ile şifreli). `end` true ise status 20 de eklenir. */
export function holderSendResponse(s: HolderSession, deviceResponse: Uint8Array, end = true): Uint8Array {
  s.sendCounter++;
  const m = new Map<string, CborValue>([["data", seal(s.keys.skDevice, 1, s.sendCounter, deviceResponse)]]);
  if (end) m.set("status", SESSION_STATUS_END);
  return encode(m);
}
/** mdoc: kişi reddetti → yalnız oturum sonu. */
export const sessionEnd = () => encode(new Map<string, CborValue>([["status", SESSION_STATUS_END]]));

export interface ReaderSession {
  keys: Keys;
  transcript: Uint8Array;
  receiveCounter: number;
  bleServiceUuid?: string;
  /** TS9: gösterenin teklifi (QR'daki DeviceEngagement[-1]) */
  offer?: PresentationOffer;
}
/**
 * Okuyucu: QR + istek → SessionEstablishment baytları ve oturum. `readerAuth` verilirse istek okuyucunun erişim sertifikasıyla
 * imzalanır (§9.1.4; kayıt sertifikası `requestInfo.euWrprc` ile birlikte — ADR-0026 K5).
 */
export function readerStart(
  qr: string,
  items: ItemsRequest[],
  opts: { randomBytes?: (n: number) => Uint8Array; readerAuth?: { sk: Uint8Array; x5chain: Uint8Array[] } } = {},
): { session: ReaderSession; establishment: Uint8Array } {
  const e = parseEngagement(qr);
  const rnd = opts.randomBytes ?? nobleRandom;
  let sk: Uint8Array;
  do sk = rnd(32);
  while (!p256.utils.isValidSecretKey(sk));
  const eReaderKeyBytes = encode(coseKeyFromPoint(p256.getPublicKey(sk, false)));
  const transcript = sessionTranscript(e.deviceEngagementBytes, eReaderKeyBytes);
  const keys = deriveKeys(sk, e.eDevicePoint, transcript);
  const establishment = encode(
    new Map<string, CborValue>([
      ["eReaderKey", new CborTag(24, eReaderKeyBytes)],
      [
        "data",
        seal(
          keys.skReader,
          0,
          1,
          encodeDeviceRequest(
            items,
            opts.readerAuth ? (b) => signReaderAuth(transcript, b, opts.readerAuth!) : undefined,
          ),
        ),
      ],
    ]),
  );
  return {
    session: {
      keys,
      transcript,
      receiveCounter: 0,
      ...(e.bleServiceUuid ? { bleServiceUuid: e.bleServiceUuid } : {}),
      ...(e.offer ? { offer: e.offer } : {}),
    },
    establishment,
  };
}
/** Okuyucu: SessionData → DeviceResponse (yoksa null: kişi reddetti) ve oturum sonu mu. */
export function readerReceive(
  s: ReaderSession,
  bytes: Uint8Array,
): { deviceResponse: Uint8Array | null; ended: boolean } {
  const m = decode(bytes);
  if (!(m instanceof Map)) throw new Error("SessionData: not a map");
  const data = m.get("data");
  let deviceResponse: Uint8Array | null = null;
  if (data instanceof Uint8Array) {
    s.receiveCounter++;
    deviceResponse = open(s.keys.skDevice, 1, s.receiveCounter, data);
  }
  return { deviceResponse, ended: m.get("status") === SESSION_STATUS_END };
}

// ------------------------------------------------------------------ BLE parçalama (§8.3.3.1.1.6)
/** İleti → GATT yazma parçaları: ilk bayt 0x01 (devamı var) / 0x00 (son); `mtu` = ATT MTU − 3. */
export function bleChunks(message: Uint8Array, mtu: number): Uint8Array[] {
  const size = Math.max(1, mtu - 1);
  const out: Uint8Array[] = [];
  for (let i = 0; i < message.length || i === 0; i += size) {
    const part = message.subarray(i, i + size);
    const last = i + size >= message.length;
    out.push(Uint8Array.from([last ? 0x00 : 0x01, ...part]));
    if (last) break;
  }
  return out;
}
/** Parçaları birleştirir; ileti tamamlanınca döndürür. Aşırı büyük ileti (varsayılan 1 MB) reddedilir. */
export class BleReassembler {
  private parts: Uint8Array[] = [];
  private size = 0;
  constructor(private max = 1024 * 1024) {}
  push(chunk: Uint8Array): Uint8Array | null {
    if (!chunk.length || (chunk[0] !== 0x00 && chunk[0] !== 0x01)) throw new Error("BLE: bad chunk header");
    this.size += chunk.length - 1;
    if (this.size > this.max) throw new Error("BLE: message too large");
    this.parts.push(chunk.subarray(1));
    if (chunk[0] === 0x01) return null;
    const out = new Uint8Array(this.size);
    let o = 0;
    for (const p of this.parts) {
      out.set(p, o);
      o += p.length;
    }
    this.parts = [];
    this.size = 0;
    return out;
  }
}

export { uuidBytes };
