/**
 * Cüzdandan cüzdana gösterme ve doğrulama — protokol çekirdeği (AB ARF Konu 30; Tamga Wallet WA-ADR-0007'nin "kodun yeri"
 * kararı: protokol ağın paketinde, kipler, sınırlar ve ekranlar cüzdanda). ISO/IEC 18013-5: QR tanışma + BLE; gösteren telefon
 * mdoc peripheral server (`ProximityTransport`), doğrulayan telefon mdoc reader / central client (`CentralTransport`).
 *
 * Hangi türün ve alanların gösterilebileceği CÜZDANIN kararıdır (`W2wProfile`): çekirdek yalnız profilin izin listesindeki
 * alanları ister, kabul eder ve gösterir (savunma derinliği). Doğrulayan taraf gelen belgeyi bir doğrulayıcı gibi denetler: belge
 * verenin imzası, MSO bütünlüğü ve süresi, oturuma bağlı cihaz imzası, imzalı güven listesinde o tarihte etkinlik ve tür yetkisi,
 * iptal durumu — Attestation Status List ya da Attestation Revocation List (AB ARF VCR_10: cüzdan iki mekanizmayı da destekler;
 * liste bütün olarak indirilir, hangi girişe bakıldığı görünmez; imzacı kurumun kayıtlı iptal anahtarı olmalı — S11). Dönüş
 * yalnız alan değerleri, belge verenin adı ve sonuçtur; girdi baytları iş bitince sıfırlanır (W2W_21, OIA_16).
 *
 * Sunum teklifi (AB TS9 v1.1 STS9_12–18, 28, 29, 34; 0.6.0): gösteren, izin listesindeki ve belgesinde bulunan alanları QR'daki
 * DeviceEngagement'a (`-1`) teklif olarak koyar. Doğrulayan yalnız teklifin alt kümesini isteyebilir; gösteren teklif dışı ya da
 * saklama niyetli (`IntentToRetain = true`) isteği kişiye göstermeden, HİÇ alan göndermeden `DeviceResponse.status = 10` ile keser
 * ve yanıtı isteğin alınışından sabit bir süre sonra gönderir (yanıt süresi belgenin içeriğine bağlı değildir).
 *
 * Gösteren tarafında gömülü açıklama politikası kısıtlı belge (ağın ADR-0046'sı) cüzdandan cüzdana gösterilmez: kayıt
 * sertifikası olmadığı için kural değerlendirilemez ve karşı taraf bir doğrulayıcı değil, bir kişidir.
 */
import {
  BleReassembler,
  DEVICE_RESPONSE_STATUS,
  bleChunks,
  deviceResponseStatus,
  hasIntentToRetain,
  isSubsetOfOffer,
  parseDeviceResponse,
  parseEngagement,
  readerReceive,
  readerStart,
  verifyDeviceAuth,
  verifyIdentifierListToken,
  verifyIssuerSigned,
  type PresentationOffer,
} from "@tamga-network/mdoc";
import { epochSeconds } from "@tamga-network/core/time";
import { b64Decode, b64u, b64uToUtf8 } from "./b64.js";
import { mdocElementValues, mdocIssuerKeys } from "./mdoc.js";
import { certFingerprintHex, computeIssuerId, computeSchemaId, p256PointFromCertDer } from "./sdjwt.js";
import { parseStatusBody, parseStatusToken, statusBitAt } from "./status.js";
import { presentProximity, type ProximityTransport } from "./proximity.js";
import { offlineDisclosurePolicy } from "./disclosure-policy.js";
import type { KeyProvider } from "./keys.js";
import type { WalletState } from "./store.js";

/** Cüzdanın cüzdandan cüzdana kararı: tek mdoc türü, ad alanı ve gösterilebilecek alanlar (sıra = ekrandaki sıra). */
export interface W2wProfile {
  docType: string;
  namespace: string;
  allowed: readonly string[];
  /** mdoc öğe adı → belgedeki (SD-JWT) claim adı; yoksa aynı ad */
  claimNameOf?: (element: string) => string;
}

/** Doğrulayan (okuyucu) tarafı: gösterenin hizmet UUID'sini tarar, bağlanır, Client2Server'a yazar, Server2Client'ı dinler. */
export interface CentralTransport {
  /** Tarar ve bağlanır; bildirimler açılıp State karakteristiğine 0x01 (başla) yazılınca çözülür. */
  connect(serviceUuid: string): Promise<void>;
  /** Tek GATT parçası (başlık baytı dahil) → Client2Server. */
  send(chunk: Uint8Array): Promise<void>;
  /** State'e 0x02 (bitir) yazar ve bağlantıyı kapatır; taramayı durdurur. */
  stop(): Promise<void>;
  onChunk(cb: (chunk: Uint8Array) => void): () => void;
  onMtu?(cb: (mtu: number) => void): () => void;
  onClose?(cb: (reason: string) => void): () => void;
}

/** Güven kaynağından gereken sorgular (`ListTrustSource` bunları sağlar). */
export interface W2wTrust {
  isCredentialAcceptable(issuerId: string, iat: number): "YES" | "NO" | "UNKNOWN";
  isCredentialSchemaAcceptable(issuerId: string, schemaId: string, iat: number): "YES" | "NO" | "UNKNOWN";
  issuer(issuerId: string): {
    legal_name: string;
    delegate_keys?: Array<{ purpose: string; fingerprint_sha256: string; status?: string }>;
  } | null;
}

export type W2wFieldValue = string | boolean | string[];
export interface W2wField {
  name: string;
  value: W2wFieldValue;
}

export type W2wInvalidReason =
  | "malformed"
  | "doc_type"
  | "issuer_signature"
  | "expired"
  | "device_signature"
  | "untrusted_issuer"
  | "not_authorized"
  | "revoked"
  | "suspended"
  | "nothing_disclosed"
  /** iptal listesi kurumun kayıtlı iptal anahtarıyla imzalanmamış, imzası ya da adresi tutmuyor, indeks liste dışında (ağın D3/D6) */
  | "status_invalid";

/**
 * Doğrulanamadı nedenleri: güven listesi yok / güncel değil; iptal listesi alınamadı, süresi geçmiş ya da okunamadı, kurumun iptal
 * anahtarı listede kayıtlı değil (ağın doğrulayıcısında D2/D3/D4 `INDETERMINATE`). Belge hakkında bir şey söylemez — yeşil değil.
 */
export type W2wIndeterminateReason = "trust_unavailable" | "trust_unknown" | "status_unavailable";

export type W2wVerdict =
  /** `revocation`: `checked` = iptal listesi denetlendi; `not_applicable` = belge iptal listesi taşımıyor */
  | { kind: "valid"; issuerName: string; fields: W2wField[]; revocation: "checked" | "not_applicable" }
  | { kind: "invalid"; reason: W2wInvalidReason }
  | { kind: "indeterminate"; reason: W2wIndeterminateReason };

export type W2wVerifierOutcome =
  | { outcome: "response"; deviceResponse: Uint8Array; transcript: Uint8Array }
  | { outcome: "declined" }
  /** TS9 STS9_34: gösteren isteği belge göndermeden kesti (`status` 10: teklif dışı ya da saklama niyetli istek) */
  | { outcome: "refused"; status: number }
  | { outcome: "error"; reason: string };

/** TS9: QR'daki teklifte bu profilin türü için teklif edilen ve izin listesinde olan alanlar (sıra izin listesinin). */
export function w2wOfferedElements(p: W2wProfile, offer: PresentationOffer | undefined): string[] | null {
  if (!offer) return null;
  const doc = offer.docs.find((d) => d.docType === p.docType);
  const ids = new Set(doc?.nameSpaces[p.namespace] ?? []);
  return p.allowed.filter((e) => ids.has(e));
}
/**
 * Doğrulayan: QR'ı okuyup gösterenin teklifini verir (`offered` = teklif edilen izinli alanlar; teklif yoksa `null` → izin
 * listesinden serbest seçim, STS9_28). QR bir cihaz tanıtımı değilse ya da teklif bozuksa hata.
 */
export function readW2wOffer(p: W2wProfile, qr: string): { offered: string[] | null } {
  const e = parseEngagement(qr.trim());
  return { offered: w2wOfferedElements(p, e.offer) };
}

const allowedSet = (p: W2wProfile) => new Set<string>(p.allowed);
/** Doğrulayanın seçimi izin listesinin dışına çıkamaz; boş seçim istek değildir; tekrar yok. */
export const w2wValidSelection = (p: W2wProfile, elements: readonly string[]): boolean =>
  elements.length > 0 && elements.every((e) => allowedSet(p).has(e)) && new Set(elements).size === elements.length;

/** İstek → izinli / gönderilemez ayrımı (sıra korunur, tekrar atılır). */
export function w2wSplitRequested(
  p: W2wProfile,
  requested: readonly string[],
): { allowed: string[]; blocked: string[] } {
  const ok = allowedSet(p);
  const allowed: string[] = [];
  const blocked: string[] = [];
  for (const e of requested) {
    if (ok.has(e)) {
      if (!allowed.includes(e)) allowed.push(e);
    } else if (!blocked.includes(e)) blocked.push(e);
  }
  return { allowed, blocked };
}

/** ISO 18013-5 istek öğesi: yalnız izinli alanlar, saklama niyeti hep `false` (W2W_21, STS9_29). */
export function buildW2wRequest(p: W2wProfile, elements: readonly string[]) {
  if (!w2wValidSelection(p, elements)) throw new Error("selection outside the allow-list");
  return [{ docType: p.docType, nameSpaces: { [p.namespace]: Object.fromEntries(elements.map((e) => [e, false])) } }];
}

/** QR'ın bir ISO 18013-5 cihaz tanıtımı olup olmadığı (kamera ekranı yalnız bunları kabul eder). */
export const isEngagementQr = (s: string) => /^mdoc:[A-Za-z0-9_-]+$/.test(s.trim());

/** Doğrulayan cüzdan: QR → oturum (ECDH, oturum dökümü, AES-GCM) → istek → BLE parçaları → şifreli yanıt. */
export async function runW2wVerifier(p: {
  profile: W2wProfile;
  transport: CentralTransport;
  qr: string;
  elements: readonly string[];
  randomBytes?: (n: number) => Uint8Array;
  /** bağlanma + yanıt için toplam süre (varsayılan 2 dk; kişi onay veriyor) */
  timeoutMs?: number;
  onConnected?: () => void;
}): Promise<W2wVerifierOutcome> {
  let started: ReturnType<typeof readerStart>;
  try {
    // TS9 STS9_28: teklif varsa yalnız teklifteki alanlar istenir (teklif dışı seçim isteğe girmez)
    const offered = w2wOfferedElements(p.profile, parseEngagement(p.qr.trim()).offer);
    const elements = offered ? p.elements.filter((e) => offered.includes(e)) : [...p.elements];
    if (!elements.length) return { outcome: "error", reason: "none of the selected fields is offered" };
    started = readerStart(p.qr.trim(), buildW2wRequest(p.profile, elements), { randomBytes: p.randomBytes });
  } catch (e) {
    return { outcome: "error", reason: `engagement: ${(e as Error).message}` };
  }
  const { session, establishment } = started;
  if (!session.bleServiceUuid) return { outcome: "error", reason: "engagement has no BLE option" };
  let mtu = 23;
  const reasm = new BleReassembler();
  let resolveMsg: (m: Uint8Array) => void = () => {};
  let rejectMsg: (e: Error) => void = () => {};
  const message = new Promise<Uint8Array>((res, rej) => {
    resolveMsg = res;
    rejectMsg = rej;
  });
  const offMtu = p.transport.onMtu?.((m) => (mtu = m));
  const offChunk = p.transport.onChunk((c) => {
    try {
      const m = reasm.push(c);
      if (m) resolveMsg(m);
    } catch (e) {
      rejectMsg(e as Error);
    }
  });
  const offClose = p.transport.onClose?.((reason) => rejectMsg(new Error(reason)));
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>(
    (_, rej) => (timer = setTimeout(() => rej(new Error("timeout")), p.timeoutMs ?? 120_000)),
  );
  try {
    await Promise.race([p.transport.connect(session.bleServiceUuid), timeout]);
    p.onConnected?.();
    for (const c of bleChunks(establishment, Math.max(20, mtu - 3))) await p.transport.send(c);
    const msg = await Promise.race([message, timeout]);
    const r = readerReceive(session, msg);
    msg.fill(0);
    if (!r.deviceResponse) return { outcome: "declined" };
    let st: { status: number; documents: number };
    try {
      st = deviceResponseStatus(r.deviceResponse);
    } catch {
      st = { status: 0, documents: 1 }; // çözülemeyen yanıt: doğrulamada "bozuk" çıkar
    }
    if (st.status !== 0 && st.documents === 0) {
      r.deviceResponse.fill(0);
      return { outcome: "refused", status: st.status };
    }
    return { outcome: "response", deviceResponse: r.deviceResponse, transcript: session.transcript };
  } catch (e) {
    return { outcome: "error", reason: (e as Error).message };
  } finally {
    clearTimeout(timer);
    offChunk();
    offMtu?.();
    offClose?.();
    session.keys.skReader.fill(0);
    session.keys.skDevice.fill(0);
    await p.transport.stop().catch(() => undefined);
  }
}

const display = (v: unknown): W2wFieldValue =>
  typeof v === "boolean" ? v : Array.isArray(v) ? v.map((x) => String(x)) : String(v ?? "");
const statusKeysOf = (issuer: ReturnType<W2wTrust["issuer"]>) =>
  (issuer?.delegate_keys ?? [])
    .filter((k) => k.purpose === "status_list" && (k.status ?? "ACTIVE") === "ACTIVE")
    .map((k) => k.fingerprint_sha256);
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

type RevocationOutcome = { kind: "ok"; checked: boolean } | { kind: "stop"; verdict: W2wVerdict };
const unavailable: RevocationOutcome = {
  kind: "stop",
  verdict: { kind: "indeterminate", reason: "status_unavailable" },
};
const statusInvalid: RevocationOutcome = { kind: "stop", verdict: { kind: "invalid", reason: "status_invalid" } };
/** Status List belirtecinin başlığındaki imzacı (yaprak) parmak izi; okunamazsa `null`. İmza burada denetlenmez. */
function statusTokenSigner(token: string): string | null {
  try {
    const h = JSON.parse(b64uToUtf8(token.split(".")[0])) as { x5c?: unknown };
    const x5c = Array.isArray(h.x5c) && typeof h.x5c[0] === "string" ? h.x5c[0] : null;
    return x5c ? certFingerprintHex(b64Decode(x5c)) : null;
  } catch {
    return null;
  }
}

function bitOutcome(list: ReturnType<typeof parseStatusToken>, idx: number): RevocationOutcome {
  let bit: number;
  try {
    bit = statusBitAt(list, idx);
  } catch {
    return statusInvalid; // D6: indeks liste dışında
  }
  if (bit === 1 || bit === 3) return { kind: "stop", verdict: { kind: "invalid", reason: "revoked" } };
  if (bit === 2) return { kind: "stop", verdict: { kind: "invalid", reason: "suspended" } };
  return { kind: "ok", checked: true };
}

/**
 * İptal denetimi — ağın doğrulayıcısının D adımlarıyla aynı üç değer: denetlendi / belge iptal listesi taşımıyor (`ok`);
 * GEÇERSİZ (iptal, askı, yanlış imzacı, bozuk imza ya da adres, indeks dışı); DOĞRULANAMADI (liste yok, bayat, okunamıyor).
 */
async function w2wRevocation(
  v: { status?: { uri: string; idx: number }; identifierList?: { uri: string; id: Uint8Array } },
  keys: string[],
  ctx: {
    fetchStatus?: (uri: string) => Promise<string | null>;
    fetchStatusBytes?: (uri: string) => Promise<Uint8Array | null>;
    fetchIdentifierList?: (uri: string) => Promise<Uint8Array | null>;
  },
  now: number,
): Promise<RevocationOutcome> {
  if (v.status && ctx.fetchStatusBytes) {
    // ADR-0048 K3: mdoc kopyasının listesi CWT gösterimidir (ikili); eski kopyalar JWT adresini gösterebilir — gövde hangisiyse
    if (!keys.length) return unavailable;
    const body = await ctx.fetchStatusBytes(v.status.uri).catch(() => null);
    if (!body?.length) return unavailable;
    let list: ReturnType<typeof parseStatusBody>;
    try {
      list = parseStatusBody(body, v.status.uri, now);
    } catch (e) {
      // süresi geçmiş / okunamıyor / çok eski → tazelik (D4); imza, adres, biçim → geçersiz (D3)
      return /^D4:|expired|too old|too large|unreadable|status token header/.test((e as Error).message)
        ? unavailable
        : statusInvalid;
    }
    if (!keys.includes(list.signerFingerprint)) return statusInvalid; // S11
    return bitOutcome(list, v.status.idx);
  }
  if (v.status) {
    if (!ctx.fetchStatus || !keys.length) return unavailable;
    const token = (await ctx.fetchStatus(v.status.uri).catch(() => null))?.trim();
    if (!token) return unavailable;
    const signer = statusTokenSigner(token);
    if (!signer) return unavailable; // okunamayan gövde (ör. ağ geçidi sayfası): altyapı sorunu
    if (!keys.includes(signer)) return statusInvalid; // S11: kurumun kayıtlı iptal anahtarı değil
    let list: ReturnType<typeof parseStatusToken>;
    try {
      list = parseStatusToken(token, v.status.uri, now);
    } catch (e) {
      // süresi geçmiş / çok eski → tazelik (D4); imza, adres, biçim → geçersiz (D3)
      return /expired|too old|too large/.test((e as Error).message) ? unavailable : statusInvalid;
    }
    return bitOutcome(list, v.status.idx);
  }
  if (v.identifierList) {
    if (!ctx.fetchIdentifierList || !keys.length) return unavailable;
    const bytes = await ctx.fetchIdentifierList(v.identifierList.uri).catch(() => null);
    if (!bytes) return unavailable;
    let list: ReturnType<typeof verifyIdentifierListToken>;
    try {
      list = verifyIdentifierListToken(bytes, { uri: v.identifierList.uri, now, publicKeyOf: p256PointFromCertDer });
    } catch (e) {
      // ağın kuralı: `D4:` (okunamıyor, süresi geçmiş) → doğrulanamadı; imza / adres → geçersiz
      return (e as Error).message.startsWith("D4:") ? unavailable : statusInvalid;
    }
    if (!keys.includes(certFingerprintHex(list.leafDer))) return statusInvalid;
    if (list.identifiers.has(hex(v.identifierList.id)))
      return { kind: "stop", verdict: { kind: "invalid", reason: "revoked" } };
    return { kind: "ok", checked: true };
  }
  return { kind: "ok", checked: false };
}

/**
 * Gelen DeviceResponse'u doğrular. `requested`: doğrulayanın istediği alanlar — yanıtta fazlası olsa da yalnız istenen ve
 * izinli alanlar gösterilir. `now` saniye. İptal: belge Status List taşıyorsa `fetchStatusBytes` (gövde baytları; CWT ya da
 * JWT gösterimi — 0.6.0, ADR-0048 K3: mdoc kopyası CWT adresini gösterir) ya da yalnız JWT okuyan eski `fetchStatus` (metin),
 * Revocation List taşıyorsa `fetchIdentifierList` (application/identifierlist+cwt baytları). Ağın doğrulayıcısıyla aynı anlam
 * (0.5.2): imzacı kurumun kayıtlı iptal anahtarı değil ya da imza / adres / indeks tutmuyor → GEÇERSİZ (`status_invalid`);
 * liste alınamadı (ağ yok, çekici yok), süresi geçmiş, okunamadı ya da kurumun iptal anahtarı kayıtlı değil → DOĞRULANAMADI
 * (`status_unavailable`), hiçbir zaman "geçerli". Girdi baytları dönüşte sıfırlanır.
 */
export async function verifyW2wResponse(
  deviceResponse: Uint8Array,
  transcript: Uint8Array,
  ctx: {
    profile: W2wProfile;
    trust: W2wTrust | null;
    requested: readonly string[];
    now?: number;
    fetchStatus?: (uri: string) => Promise<string | null>;
    /** 0.6.0: liste gövdesi bayt olarak (CWT ya da JWT); verilirse `fetchStatus` yerine kullanılır */
    fetchStatusBytes?: (uri: string) => Promise<Uint8Array | null>;
    fetchIdentifierList?: (uri: string) => Promise<Uint8Array | null>;
    stateCode?: string;
  },
): Promise<W2wVerdict> {
  const now = ctx.now ?? Math.floor(Date.now() / 1000);
  const { docType, namespace } = ctx.profile;
  try {
    let parsed: ReturnType<typeof parseDeviceResponse>;
    try {
      parsed = parseDeviceResponse(deviceResponse);
    } catch {
      return { kind: "invalid", reason: "malformed" };
    }
    if (parsed.docType !== docType) return { kind: "invalid", reason: "doc_type" };
    const issuerSignedB64 = b64u(parsed.issuerSigned);
    let leaf: Uint8Array;
    let issuerKey: Uint8Array;
    try {
      const k = mdocIssuerKeys(issuerSignedB64);
      leaf = k.x5chain[0];
      issuerKey = k.key;
    } catch {
      return { kind: "invalid", reason: "issuer_signature" };
    }
    const v = verifyIssuerSigned(parsed.issuerSigned, {
      issuerPubRaw: issuerKey,
      now: epochSeconds(now),
      expectedDocType: docType,
      clockSkewSec: 120,
    });
    if (!v.valid || !v.deviceKeyRaw)
      return {
        kind: "invalid",
        reason: /expired|not yet valid/.test(v.reason ?? "")
          ? "expired"
          : /^status entry malformed/.test(v.reason ?? "")
            ? "status_invalid"
            : "issuer_signature",
      };
    if (!verifyDeviceAuth(parsed.deviceSignature, transcript, docType, v.deviceKeyRaw))
      return { kind: "invalid", reason: "device_signature" };

    // belge veren: imzalı güven listesinde, belgenin verildiği anda (C1) ve bu tür için (C2)
    if (!ctx.trust) return { kind: "indeterminate", reason: "trust_unavailable" };
    const issuerId = computeIssuerId(ctx.stateCode ?? "TR", leaf);
    const iat = v.signedEpoch ?? now;
    const c1 = ctx.trust.isCredentialAcceptable(issuerId, iat);
    const c2 = c1 === "YES" ? ctx.trust.isCredentialSchemaAcceptable(issuerId, computeSchemaId(docType), iat) : c1;
    if (c1 === "NO") return { kind: "invalid", reason: "untrusted_issuer" };
    if (c2 === "NO") return { kind: "invalid", reason: "not_authorized" };
    if (c1 === "UNKNOWN" || c2 === "UNKNOWN") return { kind: "indeterminate", reason: "trust_unknown" };
    const issuer = ctx.trust.issuer(issuerId);
    const keys = statusKeysOf(issuer);

    const rev = await w2wRevocation(v, keys, ctx, now);
    if (rev.kind !== "ok") return rev.verdict;
    const revocation = rev.checked ? "checked" : "not_applicable";

    // yalnız doğrulanmış, istenen ve izinli alanlar; sıra izin listesinin sırası (W2W_20)
    const verified = v.claims?.[namespace] ?? {};
    const values = mdocElementValues(issuerSignedB64)[namespace] ?? {};
    const fields: W2wField[] = ctx.profile.allowed
      .filter((e) => ctx.requested.includes(e) && e in verified)
      .map((name) => ({ name, value: display(values[name]) }));
    if (!fields.length) return { kind: "invalid", reason: "nothing_disclosed" };
    return { kind: "valid", issuerName: issuer?.legal_name ?? "", fields, revocation };
  } finally {
    deviceResponse.fill(0);
    transcript.fill(0);
  }
}

// --- Gösteren ------------------------------------------------------------------------------------------------------------

export interface W2wHolderView {
  docType: string;
  supported: boolean;
  /** gönderilebilecek, belgede bulunan alanlar */
  allowed: string[];
  /** istenen ama hiçbir zaman gönderilmeyen alanlar */
  blocked: string[];
  /** izinli ama belgede olmayan alanlar */
  missing: string[];
  /** doğrulayan cüzdanın gerçek bir cüzdan olduğunun kanıtı — bugün hep "none" (AB ortak yöntemi yok, W2W_23) */
  verifierProof: "none";
}

export interface W2wHolderResult {
  state: WalletState;
  outcome: "sent" | "declined" | "error";
  /** gönderilen alan adları (değerler yok) */
  disclosed: string[];
  /**
   * `unsupported` (tür izinli değil) · `restricted` (belge verenin paylaşım kuralı — ADR-0046) · `not_offered` (istek teklifin
   * alt kümesi değil; status 10) · `intent_to_retain` (saklama niyetli istek; status 10) · taşıyıcı nedeni
   */
  reason?: string;
  /** 0.6.0 (TS9): QR'a konan teklif (alan adları; teklif yoksa yok) */
  offered?: string[];
}

/** TS9 STS9_34: kesme yanıtının, isteğin alınışından sonra gönderildiği sabit süre (ms). */
export const W2W_REJECT_DELAY_MS = 1500;

/** Gösterenin günlüğündeki karşı taraf anahtarı varsayılanı ("bir kişi"; doğrulanmış ad yok). */
export const W2W_PERSON_KEY = "w2w:person";

function relabel(before: WalletState, after: WalletState, key: string): WalletState {
  if (after.presentationLog.length !== before.presentationLog.length + 1) return after;
  const log = after.presentationLog.slice();
  log[log.length - 1] = { ...log[log.length - 1], clientId: key };
  return { ...after, presentationLog: log };
}

/**
 * Gösteren cüzdan: ağın `presentProximity`'sini cüzdandan cüzdana kurallarıyla sarar — yalnız profildeki tür; başka tür ya da
 * paylaşım kuralı kısıtlı belge istenirse kişiye sorulmadan ret; istenenler "gönderilebilir" / "gönderilemez" ayrılır ve kişinin
 * seçimi ne olursa olsun yalnız izinli alanlar gider; günlük girişi "bir kişi" (`personKey`).
 */
export async function presentToPerson(p: {
  profile: W2wProfile;
  transport: ProximityTransport;
  state: WalletState;
  keys: KeyProvider;
  onQr: (qr: string) => void;
  /** kişiye sor: gönderilecek alanlar ya da ret için null */
  approve: (view: W2wHolderView) => Promise<string[] | null>;
  randomBytes?: (n: number) => Uint8Array;
  timeoutMs?: number;
  now?: number;
  personKey?: string;
  /** TS9 teklifi QR'a konsun mu (varsayılan evet; STS9_12 SHOULD) */
  offer?: boolean;
  /** kesme yanıtının sabit süresi (ms; varsayılan `W2W_REJECT_DELAY_MS`) ve testler için bekleme / saat */
  rejectDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  clock?: () => number;
}): Promise<W2wHolderResult> {
  let refused: "unsupported" | "restricted" | undefined;
  const nameOf = p.profile.claimNameOf ?? ((e: string) => e);
  // TS9 STS9_12: teklif = izin listesindeki ve belgede bulunan alanlar (gösterilebilecek belge yoksa teklif yok)
  // presentProximity ile aynı kural: iptal edilmiş VE askıdaki belge teklif edilmez, gösterilmez
  const cred =
    p.state.credentials.find(
      (c) =>
        c.vct === p.profile.docType &&
        !c.revokedLocally &&
        c.status?.value !== "revoked" &&
        c.status?.value !== "suspended" &&
        c.copies.some((k) => !!k.mdoc),
    ) ?? null;
  const offeredElements =
    p.offer === false || !cred || offlineDisclosurePolicy(cred).restricted
      ? []
      : p.profile.allowed.filter((e) => nameOf(e) in cred.claims);
  const offer: PresentationOffer | undefined = offeredElements.length
    ? { version: "1.0", docs: [{ docType: p.profile.docType, nameSpaces: { [p.profile.namespace]: offeredElements } }] }
    : undefined;
  const r = await presentProximity({
    transport: p.transport,
    state: p.state,
    keys: p.keys,
    onQr: p.onQr,
    randomBytes: p.randomBytes,
    timeoutMs: p.timeoutMs,
    now: p.now,
    registrarKeys: false, // karşı taraf bir kişi: kayıt sertifikası kuralı uygulanmaz
    ...(offer ? { engagementOffer: offer } : {}),
    screenRequest: (item) => {
      const items = [item];
      if (hasIntentToRetain(items)) return { status: DEVICE_RESPONSE_STATUS.GENERAL_ERROR, reason: "intent_to_retain" };
      if (offer && !isSubsetOfOffer(items, offer))
        return { status: DEVICE_RESPONSE_STATUS.GENERAL_ERROR, reason: "not_offered" };
      return null;
    },
    rejectDelayMs: p.rejectDelayMs ?? W2W_REJECT_DELAY_MS,
    ...(p.sleep ? { sleep: p.sleep } : {}),
    ...(p.clock ? { clock: p.clock } : {}),
    approve: async (pv) => {
      const { allowed, blocked } = w2wSplitRequested(p.profile, pv.requested);
      const supported = pv.docType === p.profile.docType && !!pv.credential;
      if (!supported) {
        refused = "unsupported";
        return null;
      }
      // ADR-0046 Sonuçlar: kısıtlı belge cüzdandan cüzdana gösterilmez (kural değerlendirilemez, karşı taraf bir kişi)
      if (pv.credential && offlineDisclosurePolicy(pv.credential).restricted) {
        refused = "restricted";
        return null;
      }
      const has = (e: string) => !!pv.credential && nameOf(e) in pv.credential.claims;
      const view: W2wHolderView = {
        docType: pv.docType,
        supported,
        allowed: allowed.filter(has),
        blocked,
        missing: allowed.filter((e) => !has(e)),
        verifierProof: "none",
      };
      if (!view.allowed.length) {
        await p.approve(view); // gönderilebilecek alan yok: ekran yalnız reddi sunar
        return null;
      }
      const chosen = await p.approve(view);
      return chosen ? chosen.filter((e) => allowedSet(p.profile).has(e) && view.allowed.includes(e)) : null;
    },
  });
  const state = r.outcome === "error" ? r.state : relabel(p.state, r.state, p.personKey ?? W2W_PERSON_KEY);
  const disclosed = r.outcome === "sent" ? (state.presentationLog.at(-1)?.disclosed ?? []) : [];
  return {
    state,
    outcome: r.outcome,
    disclosed,
    reason: refused ?? r.reason,
    ...(offer ? { offered: offeredElements } : {}),
  };
}

/**
 * Gösterim sonucunu EN GÜNCEL duruma işler: yalnız bu oturumun günlük girişleri eklenir ve kullanılan kopyanın belgesi değişir
 * (oturum sürerken arka planda yazılan iptal durumu gibi değişiklikler ezilmez).
 */
export function mergeHolderResult(latest: WalletState, before: WalletState, after: WalletState): WalletState {
  const added = after.presentationLog.slice(before.presentationLog.length);
  const changed = new Map(
    after.credentials.filter((c) => !before.credentials.includes(c)).map((c) => [c.id, c] as const),
  );
  return {
    ...latest,
    presentationLog: [...latest.presentationLog, ...added],
    credentials: latest.credentials.map((c) => changed.get(c.id) ?? c),
  };
}

// --- Sahte taşıyıcı (cihazsız testler ve geliştirme denemesi) ------------------------------------------------------------

type Dir = "toReader" | "toHolder";
export interface FakeBleLinkOptions {
  /** ATT MTU (varsayılan 185); parçalama bunun − 3'üyle yapılır. */
  mtu?: number;
  /** Parçayı değiştir (null = düşür) — bozuk / sahte veri testleri. */
  tamper?: (dir: Dir, chunk: Uint8Array) => Uint8Array | null;
  /** Gösterenden okuyucuya giden n'inci parçadan sonra bağlantıyı kopar (kopma testi). */
  dropAfterToReader?: number;
}

/**
 * İki ucu bellekte birbirine bağlı sahte BLE taşıyıcı çifti. Gerçek BLE gibi: okuyucu yalnız yayın yapan hizmet UUID'sine bağlanır,
 * bağlanınca iki uca ATT MTU bildirilir, bir uç durunca öbür uca "bağlantı koptu" gider.
 */
export function fakeBleLink(opts: FakeBleLinkOptions = {}): { holder: ProximityTransport; reader: CentralTransport } {
  const mtu = opts.mtu ?? 185;
  const L = {
    holderChunk: new Set<(c: Uint8Array) => void>(),
    holderMtu: new Set<(m: number) => void>(),
    holderClose: new Set<(r: string) => void>(),
    readerChunk: new Set<(c: Uint8Array) => void>(),
    readerMtu: new Set<(m: number) => void>(),
    readerClose: new Set<(r: string) => void>(),
  };
  let advertising: string | null = null;
  let connected = false;
  let toReaderCount = 0;
  let waiting: { uuid: string; resolve: () => void } | null = null;
  const sub = <T>(set: Set<T>, cb: T) => {
    set.add(cb);
    return () => void set.delete(cb);
  };
  const establish = () => {
    connected = true;
    L.holderMtu.forEach((f) => f(mtu));
    L.readerMtu.forEach((f) => f(mtu));
  };
  const deliver = (dir: Dir, chunk: Uint8Array) => {
    if (!connected) throw new Error("disconnected");
    const c = opts.tamper ? opts.tamper(dir, chunk.slice()) : chunk.slice();
    if (!c) return;
    (dir === "toReader" ? L.readerChunk : L.holderChunk).forEach((f) => f(c));
  };
  const drop = (side: "holder" | "reader", reason: string) => {
    if (!connected) return;
    connected = false;
    (side === "holder" ? L.holderClose : L.readerClose).forEach((f) => f(reason));
  };
  const holder: ProximityTransport = {
    start: async (uuid) => {
      advertising = uuid.toLowerCase();
      if (waiting && waiting.uuid === advertising) {
        const w = waiting;
        waiting = null;
        establish();
        w.resolve();
      }
    },
    send: async (chunk) => {
      await Promise.resolve();
      deliver("toReader", chunk);
      toReaderCount++;
      if (opts.dropAfterToReader !== undefined && toReaderCount >= opts.dropAfterToReader) {
        drop("reader", "disconnected");
        drop("holder", "disconnected");
      }
    },
    stop: async () => {
      advertising = null;
      drop("reader", "disconnected");
    },
    onChunk: (cb) => sub(L.holderChunk, cb),
    onMtu: (cb) => sub(L.holderMtu, cb),
    onClose: (cb) => sub(L.holderClose, cb),
  };
  const reader: CentralTransport = {
    connect: (uuid) =>
      new Promise<void>((resolve) => {
        const u = uuid.toLowerCase();
        if (advertising === u) {
          establish();
          resolve();
        } else waiting = { uuid: u, resolve };
      }),
    send: async (chunk) => {
      await Promise.resolve();
      deliver("toHolder", chunk);
    },
    stop: async () => {
      waiting = null;
      drop("holder", "reader ended");
    },
    onChunk: (cb) => sub(L.readerChunk, cb),
    onMtu: (cb) => sub(L.readerMtu, cb),
    onClose: (cb) => sub(L.readerClose, cb),
  };
  return { holder, reader };
}
