/**
 * ISO/IEC 18013-7 Ek C — cüzdan tarafı: tarayıcı Digital Credentials API'sinin `org-iso-mdoc` isteği (Safari / iOS 26 ve
 * Chrome'un mdoc yolu). İstek OpenID4VP isteğiyle AYNI onay yoluna girer: `VpRequest`'e çevrilir (`parseDcApiRequest`), sonra
 * `matchDcql` → `checkRp` (onay belgesi, ADR-0056 K8) → kayıt sertifikası / paylaşım kuralı (`checkRegistrationCerts`,
 * `disclosurePolicyFor`) → `respond`.
 *
 *  - Kimlik (PV6'nın karşılığı): her istek öğesi okuyucu imzası (`readerAuth`, ISO/IEC 18013-5 §9.1.4) taşımalı; imza BU
 *    oturumun dökümüyle (SessionTranscript = [null, null, ["dcapi", SHA-256(CBOR([EncryptionInfo_b64, origin]))]]) doğrulanır.
 *    İmzalayan yaprak sertifika `client_id` = `x509_hash:<SHA-256(yaprak)>` olur — OpenID4VP isteğindeki gibi güven listesindeki
 *    RP kaydıyla eşleşir (`checkRp`: parmak izi, ACTIVE, kapsam). İmzasız istek reddedilir.
 *  - Kayıt sertifikası (ADR-0026 K5 / ADR-0056 K10): `requestInfo.euWrprc` (CBOR, `rc-wrp+cwt`); bağ okuyucu sertifikasıyla.
 *  - Yanıt: seçici açıklanmış DeviceResponse (cihaz imzası aynı döküm üzerinde; anahtar KeyProvider'dan çıkmaz) doğrulayıcının
 *    HPKE anahtarına şifrelenir → `{ response: base64url(EncryptedResponse) }` (`RespondOutput.dcApiResponse`; POST yok).
 *  - Tamga profili: tek belge isteği (DocRequest), tek ad alanı; saklama niyeti (`intentToRetain`) onay ekranına gösterilir.
 */
import { ORG_ISO_MDOC, parseAnnexCRequest, sealAnnexCResponse, verifyReaderAuth } from "@tamga-network/mdoc";
import { sha256 } from "@noble/hashes/sha2.js";
import { b64u } from "./b64.js";
import { WalletError } from "./http.js";
import { certFingerprintHex, p256PointFromCertDer } from "./sdjwt.js";
import { MDOC_FORMAT } from "./mdoc.js";
import type { DcqlQuery, VpRequest } from "./oid4vp.js";

export const DC_API_MDOC_PROTOCOL = ORG_ISO_MDOC;

/** Ek C oturumu (VpRequest.annexC): yanıtı şifrelemek ve cihaz imzası için; doğrulayıcıya yalnız şifreli yanıt gider. */
export interface AnnexCSession {
  /** doğrulayıcının HPKE alıcı anahtarı (65 bayt, 04||X||Y) */
  recipientPublicKey: Uint8Array;
  /** SessionTranscript CBOR baytları (dcapi handover; köken dahil) */
  sessionTranscript: Uint8Array;
  /** istek öğesinin ISO/IEC 18013-5 DocType'ı ve ad alanı */
  docType: string;
  namespace: string;
  /** okuyucunun saklamak istediği öğeler (intentToRetain = true); onay ekranında gösterilir */
  intentToRetain: string[];
  /** `requestInfo.euWrprc` — CBOR kayıt sertifikası (rc-wrp+cwt), varsa */
  registrationCwt?: Uint8Array;
}

/** Ek C DCQL sorgu kimliği (istekte kimlik yok; vp_token anahtarı yerine yerel ad). */
export const ANNEX_C_QUERY_ID = "mdoc";

const ORIGIN_RE = /^https:\/\/[^/\s]+$/;
const LOCAL_ORIGIN_RE = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/**
 * `{ protocol: "org-iso-mdoc", data: { deviceRequest, encryptionInfo } }` + çağıran köken → onay yolunun `VpRequest`'i.
 * Bozuk istek, imzasız (readerAuth'suz) istek, başka oturumun okuyucu imzası, çok belgeli / çok ad alanlı istek reddedilir.
 */
export function parseDcApiMdocRequest(data: unknown, origin: string): VpRequest {
  if (!ORIGIN_RE.test(origin) && !LOCAL_ORIGIN_RE.test(origin))
    throw new WalletError("unsupported", "invalid calling origin");
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      throw new WalletError("unsupported", "request data is not JSON");
    }
  }
  let parsed: ReturnType<typeof parseAnnexCRequest>;
  try {
    parsed = parseAnnexCRequest(data, origin);
  } catch (e) {
    throw new WalletError("unsupported", `invalid org-iso-mdoc request: ${(e as Error).message}`);
  }
  const { items, recipientPublicKey, nonce, sessionTranscript } = parsed;
  // Tamga profili (PV9'un mdoc karşılığı): tek DocRequest; doğrulayıcı tek mdoc belgesi ister
  if (items.length !== 1)
    throw new WalletError("unsupported", "org-iso-mdoc request must ask for exactly one document");
  const item = items[0];
  const nss = Object.entries(item.nameSpaces).filter(([, els]) => Object.keys(els).length);
  if (nss.length !== 1) throw new WalletError("unsupported", "org-iso-mdoc request must use exactly one namespace");
  const [namespace, els] = nss[0];
  // PV6: kim olduğu bilinmeyen doğrulayıcıya sunum yok — okuyucu imzası bu oturumun dökümüyle doğrulanmalı
  if (!item.readerAuth)
    throw new WalletError("unsupported", "org-iso-mdoc request without reader authentication (PV6)");
  const reader = verifyReaderAuth(item.readerAuth, sessionTranscript, item.itemsRequestBytes, p256PointFromCertDer);
  if (!reader) throw new WalletError("unsupported", "org-iso-mdoc reader authentication invalid for this session");
  const leafDer = reader.chainDer[0];
  const clientIdValue = b64u(sha256(leafDer));
  const clientId = `x509_hash:${clientIdValue}`;
  const dcql: DcqlQuery = {
    credentials: [
      {
        id: ANNEX_C_QUERY_ID,
        format: MDOC_FORMAT,
        meta: { doctype_value: item.docType },
        claims: Object.keys(els).map((el) => ({ path: [namespace, el] })),
      },
    ],
  };
  const pub = recipientPublicKey;
  const euWrprc = item.requestInfo?.euWrprc;
  const annexC: AnnexCSession = {
    recipientPublicKey: pub,
    sessionTranscript,
    docType: item.docType,
    namespace,
    intentToRetain: Object.entries(els)
      .filter(([, keep]) => keep)
      .map(([el]) => el),
    ...(euWrprc instanceof Uint8Array ? { registrationCwt: euWrprc } : {}),
  };
  return {
    clientId,
    clientIdPrefix: "x509_hash",
    clientIdValue,
    responseUri: "",
    // onay belgesinin bağı (ADR-0056 K8) ve günlük için; oturumun asıl bağı SessionTranscript'tedir
    nonce: b64u(nonce),
    dcql,
    // Ek C'de JWE yok: HPKE alıcı anahtarı JWK biçiminde (yalnız tür uyumu; yanıt `annexC` ile şifrelenir)
    encJwk: { kty: "EC", crv: "P-256", x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)) },
    enc: "A128GCM",
    leafFingerprint: certFingerprintHex(leafDer),
    leafDer,
    chainDer: reader.chainDer,
    payload: {},
    rpKey: clientId,
    origin,
    annexC,
  };
}

/**
 * Ek C yanıtı: cihaz imzalı DeviceResponse (`deviceResponse`, aynı dökümle üretilmiş) → HPKE şifreli `credential.data` gövdesi.
 */
export function sealDcApiMdocResponse(
  deviceResponse: Uint8Array,
  s: Pick<AnnexCSession, "recipientPublicKey" | "sessionTranscript">,
  randomBytes?: (n: number) => Uint8Array,
): { response: string } {
  return sealAnnexCResponse(deviceResponse, {
    recipientPublicKey: s.recipientPublicKey,
    sessionTranscript: s.sessionTranscript,
    randomBytes,
  });
}
