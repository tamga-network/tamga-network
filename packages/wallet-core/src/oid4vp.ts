/**
 * OpenID4VP 1.0 — cüzdan tarafı, Tamga profili (SPEC-PROTO-0002):
 *  PV1 yalnızca DCQL · PV2 client_id kayıtla çözülür (aşırı talep denetimi) · PV3 şifreli yanıt (direct_post.jwt, ECDH-ES/A128GCM)
 *  PV4 origin prefix'i istekte kabul edilmez · PV6 istek nesnesi imzalı, redirect_uri prefix'i reddedilir · PV7 KB-JWT aud = client_id (tam)
 *  PV8 sunum kaydı cihazda · PV9 ≤3 credential, ≤2 credential_sets · PV10 nonce tek kullanımlık (verifier)
 *  DCQL seçenekleri (OpenID4VP 1.0 §6): `claim_sets` (alan seçenekleri) ve `credential_sets` (belge seçenekleri, zorunlu /
 *  isteğe bağlı) — `matchDcql` + `selectDcql`; yalnız seçilen seçenek gönderilir (en az veri). §6.4.1: istenen alanı olmayan belge
 *  gönderilmez (eksik alanla sunum yok); karşılanamayan sorgunun nedeni `gaps`'te.
 *  ZK (ADR-0032, AB TS13 `mso_mdoc_zk`): eşleşme mdoc gibidir; sunumda olağan cihaz imzalı yanıt üretilir ve çağıranın ispatçısına
 *  (`RespondInput.zk`) verilir, doğrulayıcıya yalnız ispat gider. Çekirdek ispatçıya bağımlı değildir; ispatçı yoksa ZK sorgusu
 *  önerilmez (`matchDcql(..., { zk: false })`, ZK5 — `credential_sets`'te klasik seçenek seçilir).
 */
import { b64Decode, b64u, utf8 } from "./b64.js";
import { getClaimAtPath } from "@tamga-network/core/sd-structure";
import { pidSdJwtName } from "@tamga-network/core/pid";
import { decodeJwt, verifyJwt } from "./jws.js";
import type { KeyProvider } from "./keys.js";
import { chooseEnc, encryptJwe, type EncJwk, type JweEnc } from "./jwe.js";
import { certFingerprintHex, p256PointFromCertDer, presentSdJwt } from "./sdjwt.js";
import { WalletError, type Http, readJson } from "./http.js";
import type { StoredCredential } from "./store.js";
import { certAuthorityKeyId, certSanDnsNames } from "./asn1.js";
import { fetchTrustSource, type TrustPins } from "./trustlist.js";
import {
  MDOC_FORMAT,
  MDOC_ZK_FORMAT,
  buildMdocPresentation,
  mdocElementValues,
  mdocIssuerKeys,
  presentMdoc,
} from "./mdoc.js";
import { selectZkCopy } from "./zk-copies.js";
import { NON_PRESENTABLE_VCTS, PSEUDONYM_FORMAT } from "./pseudonym.js";

export const REQUEST_TYP = "oauth-authz-req+jwt";

export interface DcqlClaim {
  /** `claim_sets` varsa zorunlu (OpenID4VP 1.0 §6.3) */
  id?: string;
  path: Array<string | number | null>;
  values?: unknown[];
}
export interface DcqlTrustedAuthority {
  type: string;
  values: string[];
}
export interface DcqlCredential {
  id: string;
  format: string;
  meta?: {
    vct_values?: string[];
    doctype_value?: string;
    /** ADR-0032 / AB TS13: doğrulayıcının kabul ettiği ZK devreleri (`circuit_hash` = güven listesindeki `circuit_id`) */
    zk_system_type?: Array<{ zkSystemId?: string; system?: string; params?: { circuit_hash?: string } }>;
  };
  claims?: DcqlClaim[];
  /** OpenID4VP 1.0 §6.1.1 (HAIP §5: `aki` desteklenmeli) */
  trusted_authorities?: DcqlTrustedAuthority[];
  /** Alan seçenekleri: `claims` id'lerinin kombinasyonları, doğrulayıcının tercih sırasıyla (§6.1, §6.4.1) */
  claim_sets?: string[][];
}
/** Belge seçenekleri (§6.2): `options` = birlikte karşılayan sorgu id'leri listeleri; `required` yoksa true. */
export interface DcqlCredentialSet {
  options: string[][];
  required?: boolean;
}
export interface DcqlQuery {
  credentials: DcqlCredential[];
  credential_sets?: DcqlCredentialSet[];
}

export interface VpRequest {
  clientId: string;
  /** ADR-0034 / HAIP 1.0 §5: imzalı istekte yalnız `x509_hash` */
  clientIdPrefix: "x509_hash";
  clientIdValue: string;
  responseUri: string;
  nonce: string;
  state?: string;
  dcql: DcqlQuery;
  encJwk: EncJwk;
  /** yanıt şifrelemesi (client_metadata.encrypted_response_enc_values_supported'a göre) */
  enc: JweEnc;
  leafFingerprint: string;
  leafDer: Uint8Array;
  payload: Record<string, unknown>;
  /** ADR-0017 K7: aracı doğrulayıcı bir RP adına istiyorsa asıl RP'nin client_id'si (onay ekranında o gösterilir). */
  onBehalfOf?: string;
  /**
   * Kopya ayrımı (WL5), takma ad (ADR-0031) ve günlük için RP kimliği. İstek doğrulanınca geçici olarak asıl RP'nin client_id'si;
   * kayıt çözülünce `stableRpKey` ile kaydın kalıcı alan adı (`dns_name`) olur — sertifika yenilemesinden etkilenmez (ADR-0034).
   */
  rpKey: string;
  /** Digital Credentials API ile geldiyse isteği yapan sayfanın kökeni (işletim sistemi/tarayıcı verir); yanıt sayfaya döner. */
  origin?: string;
  /** ADR-0012 B: RP kabulde geçiş kartı verecek (`pass_grant_offered`); cüzdan kart anahtarını üretip `pass_key` ekler (a3/WL13). */
  passGrantOffered?: boolean;
}

/** QR: openid4vp://?client_id=…&request_uri=…  (veya doğrudan request_uri URL'i) */
export function parseVpUri(input: string): { clientId?: string; requestUri: string } {
  const s = input.trim();
  if (s.startsWith("http://") || s.startsWith("https://")) return { requestUri: s };
  const q = s.indexOf("?");
  if (q < 0) throw new WalletError("invalid_offer", "presentation request link not recognised");
  const params: Record<string, string> = {};
  for (const kv of s.slice(q + 1).split("&")) {
    const i = kv.indexOf("=");
    if (i > 0) params[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, " "));
  }
  if (!params.request_uri)
    throw new WalletError("invalid_offer", "no request_uri (only signed request objects are accepted, PV6)");
  return { clientId: params.client_id, requestUri: params.request_uri };
}
export async function fetchRequestObject(requestUri: string, http: Http): Promise<string> {
  const r = await http(requestUri, { headers: { accept: "application/oauth-authz-req+jwt" } });
  if (r.status !== 200) throw new WalletError("issuer_error", `request object could not be fetched (${r.status})`);
  return (await r.text()).trim();
}

/**
 * Yerel geliştirme ağı: localhost, genel DNS'te kayıt edilemeyen ayrılmış adlar (.localhost, .test — RFC 6761; .local — mDNS)
 * ya da özel IPv4 (10/8, 172.16/12, 192.168/16, 127/8). Bu adlar internette başkasına ait olamaz.
 */
export function isLocalDevHost(host: string): boolean {
  if (host === "localhost" || /\.(localhost|test|local)$/.test(host)) return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

/** SAN dNSName kontrolü: sertifikanın SubjectAltName uzantısı ayrıştırılır, dNSName'ler tam eşleşir (S-12; `asn1.ts`). */
export function certHasDnsName(der: Uint8Array, dns: string): boolean {
  try {
    return certSanDnsNames(der).includes(dns.toLowerCase());
  } catch {
    return false; // bozuk sertifika → eşleşme yok
  }
}

/** İmzalı istek nesnesini doğrular ve Tamga profili kurallarını uygular. Zincir/kayıt kontrolü çağırana (resolveRp). */
/** OpenID4VP 1.0 §5 (statik yapılandırma): imzalı istek nesnesinin `aud`'ı. */
const REQUEST_AUD = "https://self-issued.me/v2";
/** İstek nesnesi zaman denetimlerinde saat kayması toleransı (sn). */
const REQUEST_CLOCK_SKEW_SEC = 60;

export function verifyRequestObject(
  jwt: string,
  expectedClientId?: string,
  opts: { origin?: string; now?: number } = {},
): VpRequest {
  const d = decodeJwt(jwt);
  if (d.header.typ !== REQUEST_TYP) throw new WalletError("unsupported", `request typ=${String(d.header.typ)}`);
  const x5c = d.header.x5c as string[] | undefined;
  if (!x5c?.length) throw new WalletError("unsupported", "request object unsigned or without x5c (PV6)");
  const leafDer = b64Decode(x5c[0]);
  verifyJwt(jwt, p256PointFromCertDer(leafDer));
  const p = d.payload;
  // RFC 9101 §10.2 / OpenID4VP: istek nesnesi kısa ömürlüdür — süresi geçmiş ya da ileri tarihli istek tekrar oynatılabilirdi
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  if (typeof p.exp !== "number") throw new WalletError("unsupported", "request object without exp");
  if (now > p.exp + REQUEST_CLOCK_SKEW_SEC) throw new WalletError("unsupported", "request object expired");
  if (p.iat !== undefined && (typeof p.iat !== "number" || p.iat > now + REQUEST_CLOCK_SKEW_SEC))
    throw new WalletError("unsupported", "request object issued in the future");
  if (p.aud !== undefined && p.aud !== REQUEST_AUD && !(Array.isArray(p.aud) && p.aud.includes(REQUEST_AUD)))
    throw new WalletError("unsupported", "request object aud is not for wallets");
  const clientId = String(p.client_id ?? "");
  if (expectedClientId && expectedClientId !== clientId)
    throw new WalletError("unsupported", "client_id differs between the QR code and the request object");
  const m = /^(x509_hash|x509_san_dns|redirect_uri|origin|[a-z_]+):(.+)$/.exec(clientId);
  if (!m) throw new WalletError("unsupported", "client_id has no prefix");
  const prefix = m[1],
    value = m[2];
  if (prefix === "redirect_uri") throw new WalletError("unsupported", "redirect_uri client_id reddedilir (PV6)");
  if (prefix === "origin") throw new WalletError("unsupported", "origin prefix not accepted inside a request (PV4)");
  // HAIP 1.0 §5: imzalı istekte doğrulayıcı x509_hash KULLANIR, cüzdan KABUL EDER (ADR-0034). Başka önek desteklenmez.
  if (prefix !== "x509_hash")
    throw new WalletError("unsupported", `unsupported client_id prefix: ${prefix} (x509_hash required)`);
  const leafFingerprint = certFingerprintHex(leafDer);
  // OpenID4VP 1.0 §5.9.3: değer, yaprak sertifikanın DER kodlamasının SHA-256 özeti (base64url)
  const want = Array.from(b64Decode(value), (x) => x.toString(16).padStart(2, "0")).join("");
  if (want !== leafFingerprint) throw new WalletError("unsupported", "x509_hash does not match the leaf certificate");
  if (p.presentation_definition) throw new WalletError("unsupported", "presentation_definition reddedilir (PV1)");
  if (p.response_type !== "vp_token") throw new WalletError("unsupported", "response_type is not vp_token");
  // Digital Credentials API (OpenID4VP 1.0 Ek A): yanıt şifreli olarak sayfaya döner; istek, çağıran kökenin imzalı
  // expected_origins listesinde olmalı — başka bir site bu isteği kendi sayfasında yeniden kullanamaz (Ek A.2).
  const dcApi = opts.origin !== undefined;
  if (dcApi) {
    if (p.response_mode !== "dc_api.jwt")
      throw new WalletError("unsupported", "browser request must use the dc_api.jwt response mode (PV3)");
    const eo = p.expected_origins;
    if (!Array.isArray(eo) || !eo.includes(opts.origin))
      throw new WalletError("unsupported", "calling website is not in the request's expected_origins");
  } else if (p.response_mode === "dc_api.jwt")
    throw new WalletError("unsupported", "this request can only be answered in the browser that made it");
  else if (p.response_mode !== "direct_post.jwt")
    throw new WalletError("unsupported", "unencrypted response mode not accepted (PV3)");
  const dcql = p.dcql_query as DcqlQuery | undefined;
  if (!dcql?.credentials?.length) throw new WalletError("unsupported", "dcql_query missing");
  if (dcql.credentials.length > 3 || (dcql.credential_sets?.length ?? 0) > 2)
    throw new WalletError("unsupported", "request too large (PV9)");
  checkDcqlShape(dcql);
  const jwks = (p.client_metadata as { jwks?: { keys?: EncJwk[] } } | undefined)?.jwks?.keys ?? [];
  const encJwk = jwks.find((k) => k.kty === "EC" && k.crv === "P-256" && (k.use === "enc" || !k.use));
  if (!encJwk) throw new WalletError("unsupported", "client_metadata.jwks has no encryption key (PV3)");
  const enc = chooseEnc(
    (p.client_metadata as { encrypted_response_enc_values_supported?: unknown } | undefined)
      ?.encrypted_response_enc_values_supported,
  );
  if (!enc) throw new WalletError("unsupported", "no supported response encryption (A128GCM / A256GCM)");
  if (typeof p.nonce !== "string" || p.nonce.length < 16) throw new WalletError("unsupported", "weak nonce");
  if (!dcApi && typeof p.response_uri !== "string") throw new WalletError("unsupported", "response_uri missing");
  // Tamga profili (ADR-0034, eski x509_san_dns kuralının devamı): yanıt adresi, isteği imzalayan sertifikanın SAN'ındaki bir alan
  // adına ait olmalı — kayıtlı bir sertifikayla imzalanmış istek verileri başka bir sunucuya yönlendiremez. Yerel geliştirme
  // (localhost / özel ağ IP'si) istisnadır.
  if (!dcApi) {
    let host: string;
    try {
      host = new URL(String(p.response_uri)).hostname.toLowerCase();
    } catch {
      throw new WalletError("unsupported", "invalid response_uri");
    }
    if (!certHasDnsName(leafDer, host) && !isLocalDevHost(host))
      throw new WalletError("unsupported", "response address does not belong to the domain that signed the request");
  }
  const obo = p.tamga_on_behalf_of;
  if (obo !== undefined && (typeof obo !== "string" || !/^x509_hash:[A-Za-z0-9_-]{43}$/.test(obo)))
    throw new WalletError("unsupported", "invalid tamga_on_behalf_of (HV6)");
  const onBehalfOf = typeof obo === "string" && obo !== clientId ? obo : undefined;
  return {
    clientId,
    clientIdPrefix: "x509_hash",
    clientIdValue: value,
    responseUri: dcApi ? "" : String(p.response_uri),
    nonce: p.nonce,
    state: p.state as string | undefined,
    dcql,
    encJwk,
    enc,
    leafFingerprint,
    leafDer,
    payload: p,
    ...(onBehalfOf ? { onBehalfOf } : {}),
    rpKey: onBehalfOf ?? clientId,
    ...(dcApi ? { origin: opts.origin } : {}),
    ...(p.pass_grant_offered === true ? { passGrantOffered: true } : {}),
  };
}

/**
 * Tarayıcının Digital Credentials API isteği (işletim sistemi cüzdana `{protocol, data}` ve çağıran kökeni verir). Yalnız
 * imzalı OpenID4VP kabul edilir (PV6: kim olduğu bilinmeyen doğrulayıcıya sunum yok); `org-iso-mdoc` (ISO 18013-7 Ek C)
 * henüz desteklenmez.
 */
export const DC_API_PROTOCOL = "openid4vp-v1-signed";
export function parseDcApiRequest(req: { protocol?: unknown; data?: unknown }, origin: string): VpRequest {
  if (req.protocol !== DC_API_PROTOCOL)
    throw new WalletError("unsupported", `unsupported protocol: ${String(req.protocol)}`);
  let data = req.data;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      throw new WalletError("unsupported", "request data is not JSON");
    }
  }
  const jwt = (data as { request?: unknown } | null)?.request;
  if (typeof jwt !== "string") throw new WalletError("unsupported", "signed request missing");
  if (!/^https:\/\/[^/]+$/.test(origin) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
    throw new WalletError("unsupported", "invalid calling origin");
  return verifyRequestObject(jwt, undefined, { origin });
}

// ---- Kayıt çözümü (PV2) — imzası doğrulanmış ulusal listeden (`fetchRpRecord` → `fetchTrustSource`, S-13; LOTL imzacı pinleri)
export interface RpScope {
  scope_id: string;
  purpose: string;
  /** Kullanıcıya gösterim için çeviriler (BCP 47 → metin); cüzdan dilini seçer, yoksa `purpose`. */
  purpose_localized?: Record<string, string>;
  vct: string;
  claims: string[];
  valid_from: string;
  valid_until: string | null;
  /** ADR-0024: bu kullanımın gizlilik politikası (ARF RPA_10) */
  privacy_policy_uri?: string;
}
export interface RpRecord {
  /** ADR-0034: `x509_hash:<b64u(SHA-256(erişim sertifikası))>` */
  client_id: string;
  /** ADR-0034: kalıcı kayıt kimliği (erişim sertifikasındaki alan adı) */
  dns_name: string;
  legal_name: string;
  status: string;
  access_cert_fingerprint_sha256: string;
  scopes: RpScope[];
  /** ADR-0024: kullanıcıya görünen ad (ARF RPA_06) */
  trade_name?: string;
  contact?: { support_uri?: string; email?: string; phone?: string };
  /** ADR-0024 / TS8: bağlı olduğu veri koruma kurumu */
  supervisory_authority?: SupervisoryAuthorityInfo;
  /** ADR-0017 K7 / TS6 14–16: RP'nin kullandığı aracı doğrulayıcılar (`dns_name`) */
  uses_intermediaries?: string[];
  /** ADR-0017 K7 / TS6 14–16: aracının hizmet verdiği RP'ler (`dns_name`) */
  served_relying_parties?: string[];
}

/**
 * ADR-0017 K7: aracı ilişkisi İKİ kayıtta da yazılı olmalı — asıl RP aracıyı `uses_intermediaries`'te, aracı asıl RP'yi
 * `served_relying_parties`'te listeler (tek taraflı beyan yetmez: aracı kendi başına bir RP adına konuşamaz). Asıl RP'nin kaydı
 * isteğin `tamga_on_behalf_of` kimliğiyle çözülmüş olmalı.
 */
function intermediaryAllowed(req: VpRequest, signer: RpRecord, onBehalf: RpRecord): boolean {
  return (
    onBehalf.client_id === req.onBehalfOf &&
    !!signer.dns_name &&
    !!onBehalf.dns_name &&
    (onBehalf.uses_intermediaries ?? []).includes(signer.dns_name) &&
    (signer.served_relying_parties ?? []).includes(onBehalf.dns_name)
  );
}
export interface SupervisoryAuthorityInfo {
  name: string;
  country: string;
  email?: string;
  phone?: string;
  form_uri?: string;
  info_uri?: string;
}
/**
 * RP kaydı, İMZASI DOĞRULANMIŞ ulusal listeden (S-13). `pins`: uygulamaya gömülü LOTL imzacı parmak izleri. Liste alınamaz ya da
 * doğrulanamazsa `null` döner → onay ekranı "güven listesinde bulunamadı" uyarısı verir (PV2); sahte kayıt asla "kayıtlı" görünmez.
 */
export async function fetchRpRecord(
  trustBase: string,
  clientId: string,
  http: Http,
  pins: TrustPins,
  stateCode = "tr",
): Promise<RpRecord | null> {
  try {
    const { source } = await fetchTrustSource(trustBase, http, { pins, stateCode });
    // TS1: yalnızca TrustSource sorgusu. ADR-0034: `x509_hash:` istemci kimliğiyle ya da kalıcı alan adıyla (günlükteki kayıtlar
    // ve takma adlar alan adını tutar; sertifika yenilense de kayıt bulunur).
    const rec = clientId.includes(":") ? source.relyingParty(clientId) : source.relyingPartyByDnsName(clientId);
    return (rec as unknown as RpRecord | null) ?? null;
  } catch {
    return null;
  }
}

export interface Match {
  queryId: string;
  credential: StoredCredential;
  /** Gönderilecek alanlar. Belge, istenen alanların hepsine (ya da `claim_sets`'ten bir kombinasyona) sahipse eşleşir (§6.4.1). */
  requested: string[];
  /**
   * D-CRED-5: istenen format; `mso_mdoc` ise sunum DeviceResponse olarak üretilir (yoksa `dc+sd-jwt`). `mso_mdoc_zk` (ADR-0032):
   * belge gösterilmez, yalnız `zk.claims` ispatlanır.
   */
  format?: "dc+sd-jwt" | "mso_mdoc" | "mso_mdoc_zk";
  /** mso_mdoc: DCQL claim yolu [namespace, element] — açıklamanın namespace'i. */
  namespace?: string;
  /**
   * Sorguyu karşılayan bütün belgeler (ilki = bu eşleşme). Birden çoksa cüzdan kullanıcıya hangisini göndereceğini sorar
   * (ARF OIA_11 — ör. birden çok doğrulanmış e-posta, ADR-0021).
   */
  alternatives?: Match[];
  /**
   * ADR-0032: ZK eşleşmesinde ispatlanacak öğeler (sorgudaki sabit değerler) ve doğrulayıcının kabul ettiği devreler. ADR-0044:
   * ispat yalnız ZK kopyasıyla — `copyKeyRef` belgenin `zk.copies`'inden seçilen kopya (ana belgenin kopyaları kullanılmaz).
   */
  zk?: { claims: ZkClaimValue[]; circuits?: string[]; copyKeyRef?: string };
}
/** ZK ile ispatlanan öğe: "bu ad alanında bu öğe şu değerdir" (`@tamga-network/zk` ZkClaim ile aynı biçim). */
export interface ZkClaimValue {
  namespace: string;
  element: string;
  value: boolean | string | number;
}
/** Belgenin (SD-JWT kopyası) x5c zincirindeki sertifikaların AKI'leri, base64url. */
function chainAkis(c: StoredCredential): string[] {
  const combined = c.copies.find((k) => k.combined)?.combined;
  if (!combined) return [];
  try {
    const h = JSON.parse(new TextDecoder().decode(b64Decode(combined.split("~")[0].split(".")[0]))) as {
      x5c?: string[];
    };
    return (h.x5c ?? []).flatMap((x) => {
      const k = certAuthorityKeyId(b64Decode(x));
      return k ? [b64u(k)] : [];
    });
  } catch {
    return [];
  }
}
/**
 * OpenID4VP §6.1.1: `trusted_authorities` verildiyse belge en az bir koşula uymalı. Cüzdan yalnız `aki` tipini değerlendirebilir;
 * değerlendiremediği bir tip (etsi_tl, openid_federation) varsa belge elenmez (doğrulayıcı güveni kendisi denetler).
 */
function trustedAuthorityOk(q: DcqlCredential, c: StoredCredential): boolean {
  const ta = q.trusted_authorities;
  if (!ta?.length) return true;
  if (ta.some((t) => t.type !== "aki")) return true;
  const have = new Set(chainAkis(c));
  return ta.some((t) => t.values.some((v) => have.has(v)));
}
const DCQL_ID = /^[A-Za-z0-9_-]+$/;
const isIdList = (x: unknown): x is string[] =>
  Array.isArray(x) && x.length > 0 && x.every((v) => typeof v === "string" && DCQL_ID.test(v));
/**
 * DCQL'in yapısal kuralları (OpenID4VP 1.0 §6): sorgu id'leri tekil; `claim_sets` yalnız `claims` ile ve her alanın `id`'si
 * varken; `credential_sets` seçenekleri var olan sorgu id'lerine işaret eder. Bozuk istek reddedilir, seçenek tahmin edilmez.
 */
export function checkDcqlShape(dcql: DcqlQuery): void {
  const bad = (why: string): never => {
    throw new WalletError("unsupported", `invalid dcql_query: ${why}`);
  };
  const ids = new Set<string>();
  for (const q of dcql.credentials) {
    if (typeof q.id !== "string" || !DCQL_ID.test(q.id)) bad("credential query id");
    if (ids.has(q.id)) bad(`duplicate credential query id ${q.id}`);
    ids.add(q.id);
    // OpenID4VP 1.0 §6.4.1 / Ek B.3.5: dc+sd-jwt sorgusu türü (`meta.vct_values`) belirtmeli — türsüz sorgu her belgeyle eşleşirdi
    if (
      q.format === "dc+sd-jwt" &&
      !(
        Array.isArray(q.meta?.vct_values) &&
        q.meta.vct_values.length &&
        q.meta.vct_values.every((v) => typeof v === "string" && v)
      )
    )
      bad(`dc+sd-jwt query without meta.vct_values (${q.id})`);
    // mso_mdoc (ve ZK): yol [namespace, element] ve tek namespace — açıklama tek namespace'te yapılır (seçenek başka namespace'e kaçmaz)
    if ((q.format === MDOC_FORMAT || q.format === MDOC_ZK_FORMAT) && q.claims?.length) {
      const ns = q.claims[0].path[0];
      for (const c of q.claims)
        if (c.path.length !== 2 || typeof c.path[0] !== "string" || typeof c.path[1] !== "string" || c.path[0] !== ns)
          bad(`${q.format} claim path must be [namespace, element] in one namespace (${q.id})`);
    }
    // ADR-0032: ZK açıklama değil ispattır — her öğenin tek, sabit bir beklenen değeri olmalı ("age_over_18 = true")
    if (q.format === MDOC_ZK_FORMAT) {
      if (!q.claims?.length) bad(`mso_mdoc_zk query without claims (${q.id})`);
      for (const c of q.claims ?? [])
        if (
          !Array.isArray(c.values) ||
          c.values.length !== 1 ||
          !["boolean", "string", "number"].includes(typeof c.values[0])
        )
          bad(`mso_mdoc_zk claim needs exactly one expected value (${q.id})`);
    }
    if (q.claim_sets === undefined) continue;
    const claims = q.claims ?? [];
    if (!claims.length) bad(`claim_sets without claims (${q.id})`);
    const claimIds = new Set<string>();
    for (const c of claims) {
      if (typeof c.id !== "string" || !DCQL_ID.test(c.id)) bad(`claim id required with claim_sets (${q.id})`);
      else if (claimIds.has(c.id)) bad(`duplicate claim id ${c.id} (${q.id})`);
      else claimIds.add(c.id);
    }
    if (!Array.isArray(q.claim_sets) || !q.claim_sets.length) bad(`empty claim_sets (${q.id})`);
    for (const o of q.claim_sets)
      if (!isIdList(o) || o.some((x) => !claimIds.has(x))) bad(`claim_sets option (${q.id})`);
  }
  if (dcql.credential_sets === undefined) return;
  if (!Array.isArray(dcql.credential_sets) || !dcql.credential_sets.length) bad("empty credential_sets");
  for (const set of dcql.credential_sets) {
    if (!Array.isArray(set?.options) || !set.options.length) bad("credential_sets without options");
    if (set.required !== undefined && typeof set.required !== "boolean") bad("credential_sets.required");
    for (const o of set.options) if (!isIdList(o) || o.some((x) => !ids.has(x))) bad("credential_sets option");
  }
}

/** Bir belge seçenekleri kümesi (`credential_sets` girişi) ve seçim. */
export interface DcqlSetChoice {
  required: boolean;
  options: string[][];
  /** Cüzdandaki belgelerle karşılanabilen seçeneklerin sırası (doğrulayıcının tercih sırası korunur) */
  satisfiable: number[];
  /** Seçilen seçenek; isteğe bağlı kümede `null` = paylaşma (varsayılan, en az veri) */
  chosen: number | null;
}
export interface DcqlSelection {
  /** Bütün zorunlu kısımlar karşılanabiliyor mu */
  ok: boolean;
  /** `credential_sets` girişleri; istekte yoksa boş (her sorgu zorunlu) */
  sets: DcqlSetChoice[];
  /** Gönderilecek sorgu id'leri (seçilen seçeneklerin birleşimi) */
  queryIds: string[];
  /** Karşılanamayan zorunlu sorgu id'leri (hata iletisi için) */
  missing: string[];
}
const selectedIds = (sets: DcqlSetChoice[]): string[] => [
  ...new Set(sets.flatMap((s) => (s.chosen === null ? [] : s.options[s.chosen]))),
];
/**
 * §6.4.2: `credential_sets` yoksa her sorgu istenir. Varsa her zorunlu kümeden bir seçenek karşılanır (cüzdan doğrulayıcının
 * tercih sırasındaki ilk karşılanabilir seçeneği önerir; kullanıcı değiştirebilir); isteğe bağlı kümeler varsayılan olarak
 * paylaşılmaz — kullanıcı açarsa gönderilir. Hiçbir kümede geçmeyen sorgu gönderilmez. Takma ad sorgusu (ADR-0031) belge
 * gerektirmez; karşılanabilir sayılır.
 */
export function selectDcql(dcql: DcqlQuery, matches: Match[]): DcqlSelection {
  const answerable = new Set([
    ...matches.map((m) => m.queryId),
    ...dcql.credentials.filter((q) => q.format === PSEUDONYM_FORMAT).map((q) => q.id),
  ]);
  if (!dcql.credential_sets) {
    const all = dcql.credentials.map((q) => q.id);
    const missing = all.filter((id) => !answerable.has(id));
    return { ok: missing.length === 0, sets: [], queryIds: all, missing };
  }
  const missing: string[] = [];
  const sets = dcql.credential_sets.map((cs): DcqlSetChoice => {
    const required = cs.required !== false;
    const satisfiable = cs.options.flatMap((o, i) => (o.every((id) => answerable.has(id)) ? [i] : []));
    const chosen = required ? (satisfiable[0] ?? null) : null;
    if (required && chosen === null) missing.push(...cs.options[0].filter((id) => !answerable.has(id)));
    return { required, options: cs.options, satisfiable, chosen };
  });
  return { ok: missing.length === 0, sets, queryIds: selectedIds(sets), missing: [...new Set(missing)] };
}
/** Kullanıcı bir kümede başka bir seçenek seçer (ya da isteğe bağlı kümede `null` = paylaşma). Geçersiz seçim yok sayılır. */
export function chooseDcqlOption(sel: DcqlSelection, setIndex: number, option: number | null): DcqlSelection {
  const set = sel.sets[setIndex];
  if (!set) return sel;
  if (option === null ? set.required : !set.satisfiable.includes(option)) return sel;
  const sets = sel.sets.map((x, i) => (i === setIndex ? { ...x, chosen: option } : x));
  return { ...sel, sets, queryIds: selectedIds(sets) };
}

/**
 * Bir sorgu neden karşılanamadı (cüzdan kullanıcıya sade söyler). `no_credential`: uygun türde (ve güvenilir kaynaktan) belge yok ·
 * `missing_claims`: belge var ama istenen alan(lar) belgede yok · `values`: alan var ama değeri istenen koşulu tutmuyor.
 * `claims` ve `credential` sorguya en yakın belge (ve `claim_sets` varsa en yakın kombinasyon) içindir.
 */
export interface DcqlGap {
  queryId: string;
  /**
   * `zk_unavailable` (ADR-0032 ZK5): belge istenen koşulu karşılıyor ama sorgu yalnız sıfır bilgi ispatı istiyor ve cüzdan bu
   * cihazda ispat üretemiyor.
   */
  reason: "no_credential" | "missing_claims" | "values" | "zk_unavailable";
  claims: string[];
  credential?: StoredCredential;
}
export interface DcqlMatchResult {
  matches: Match[];
  unmatched: string[];
  /** `unmatched` sorgularının nedeni (aynı sıra) */
  gaps: DcqlGap[];
}
/**
 * DCQL → cüzdandaki belgeler: vct eşleşmesi, `trusted_authorities` (aki), `values` koşulları, istenen claim adları.
 * OpenID4VP 1.0 §6.4.1: `claim_sets` yoksa istenen alanların HEPSİ belgede olmalı — biri eksikse belge sorguyu karşılamaz (eksik
 * alanla gönderilmez; isteğe bağlı alan isteyen doğrulayıcı `claim_sets` kullanır). `claim_sets` varsa karşılanabilen ilk kombinasyon.
 * `mso_mdoc_zk` (ADR-0032) mdoc gibi eşlenir; yalnız `opts.zk` (cüzdan bu cihazda ispat üretebilir) ise önerilir — değilse sorgu
 * karşılanamaz (`zk_unavailable`) ve `credential_sets`'te klasik seçenek seçilir (ZK5).
 */
export function matchDcql(
  dcql: DcqlQuery,
  credentials: StoredCredential[],
  opts: { zk?: boolean; now?: number } = {},
): DcqlMatchResult {
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  const matches: Match[] = [];
  const unmatched: string[] = [];
  const gaps: DcqlGap[] = [];
  for (const q of dcql.credentials) {
    if (q.format === PSEUDONYM_FORMAT) continue; // ADR-0031: takma ad belge değil, ayrı üretilir (pseudonymQueryOf)
    const isZk = q.format === MDOC_ZK_FORMAT;
    const isMdoc = q.format === MDOC_FORMAT || isZk;
    const vcts = q.meta?.vct_values ?? [];
    const docType = q.meta?.doctype_value;
    const cands = credentials
      .filter((c) =>
        NON_PRESENTABLE_VCTS.includes(c.vct) || // PS3: takma ad tohumu hiçbir sorguya önerilmez
        c.revokedLocally ||
        c.status?.value === "revoked" ||
        c.status?.value === "suspended"
          ? false
          : isZk
            ? c.zk?.docType === docType // ADR-0044 ZC1: ZK yalnız ZK kopyasıyla (ana belgenin mdoc'u ZK'da kullanılmaz)
            : isMdoc
              ? c.vct === docType && c.copies.some((k) => !!k.mdoc) // D-CRED-5: yalnızca mdoc'u olan belge
              : q.format === "dc+sd-jwt" && (vcts.length === 0 || vcts.includes(c.vct)),
      )
      .filter((c) => trustedAuthorityOk(q, c));
    const namespace = isMdoc ? (q.claims?.[0]?.path[0] as string | undefined) : undefined;
    const ok: Match[] = [];
    let closest: DcqlGap | undefined;
    let zkMissing: StoredCredential | undefined;
    for (const c of cands) {
      // ADR-0044: ZK sorgusu belgenin geçerli bir ZK kopyasıyla karşılanır; öğe değerleri kopyanın kendisinden
      const zkCopy = isZk ? selectZkCopy(c, now) : null;
      if (isZk && !zkCopy) {
        zkMissing ??= c;
        continue;
      }
      const zkEls = zkCopy ? (mdocElementValues(zkCopy.mdoc)[namespace ?? ""] ?? {}) : undefined;
      // SD-JWT: path [claim] · mdoc: path [namespace, element]; mdoc öğesinin değeri belgenin SD-JWT claim'inden, ad AB PID
      // tablosuyla (MD1 / ADR-0045: `birth_date` ↔ `birthdate`, `nationality` ↔ `nationalities`)
      // ADR-0036: SD-JWT yolu iç içe olabilir (["address","country"], ["nationalities", null|i]) → nokta yolu
      const evals = (q.claims ?? []).map((cl) => {
        const name = isMdoc ? String(cl.path[1]) : dcqlPathToName(cl.path);
        const sdName = isMdoc ? pidSdJwtName(name) : name;
        const value = zkEls ? zkEls[name] : isMdoc ? c.claims[sdName] : getClaimAtPath(c.claims, name);
        const has = zkEls
          ? Object.prototype.hasOwnProperty.call(zkEls, name)
          : isMdoc
            ? Object.prototype.hasOwnProperty.call(c.claims, sdName)
            : value !== undefined;
        const valueOk = !cl.values || (has && cl.values.some((v) => JSON.stringify(v) === JSON.stringify(value)));
        return { id: cl.id, name, has, valueOk };
      });
      // §6.4.1: claim_sets'ten YALNIZ bir kombinasyon istenir; cüzdan karşılayabildiği ilk seçeneği gönderir (öbürleri gitmez).
      // claim_sets yoksa bütün alanlar tek kombinasyondur.
      const options = q.claim_sets ? q.claim_sets.map((o) => o.map((id) => evals.find((e) => e.id === id)!)) : [evals];
      const option = options.find((o) => o.every((e) => e.has && e.valueOk));
      if (option) {
        ok.push({
          queryId: q.id,
          credential: c,
          requested: option.map((e) => e.name),
          format: isZk ? MDOC_ZK_FORMAT : isMdoc ? MDOC_FORMAT : "dc+sd-jwt",
          ...(namespace ? { namespace } : {}),
          ...(isZk
            ? {
                zk: {
                  ...zkOf(
                    q,
                    namespace ?? "",
                    option.map((e) => e.name),
                  ),
                  copyKeyRef: zkCopy!.keyRef,
                },
              }
            : {}),
        });
        continue;
      }
      // neden karşılanamadı: en az eksik alanlı kombinasyon (eşitse değer koşulu tutmayan alanı az olan)
      for (const o of options) {
        const missing = o.filter((e) => !e.has).map((e) => e.name);
        const gap: DcqlGap = missing.length
          ? { queryId: q.id, reason: "missing_claims", claims: missing, credential: c }
          : { queryId: q.id, reason: "values", claims: o.filter((e) => !e.valueOk).map((e) => e.name), credential: c };
        const rank = (g: DcqlGap) => (g.reason === "values" ? 0 : 1000) + g.claims.length;
        if (!closest || rank(gap) < rank(closest)) closest = gap;
      }
    }
    if (ok.length && isZk && !opts.zk) {
      // ZK5: belge var ama bu cihazda ispat yok — sorgu önerilmez (klasik seçenek varsa o seçilir)
      unmatched.push(q.id);
      gaps.push({ queryId: q.id, reason: "zk_unavailable", claims: ok[0].requested, credential: ok[0].credential });
    } else if (!ok.length && zkMissing && !closest) {
      // ADR-0044: belge var ama geçerli ZK kopyası yok (henüz alınmadı / süresi doldu) — cüzdan yenileyip yeniden deneyebilir
      unmatched.push(q.id);
      gaps.push({
        queryId: q.id,
        reason: "zk_unavailable",
        claims: (q.claims ?? []).map((cl) => String(cl.path[1])),
        credential: zkMissing,
      });
    } else if (ok.length) matches.push(ok.length > 1 ? { ...ok[0], alternatives: ok } : ok[0]);
    else {
      unmatched.push(q.id);
      gaps.push(closest ?? { queryId: q.id, reason: "no_credential", claims: [] });
    }
  }
  return { matches, unmatched, gaps };
}

/** ZK sorgusundan ispatlanacak öğeler (checkDcqlShape her öğenin tek sabit değerini denetledi) ve kabul edilen devreler. */
function zkOf(q: DcqlCredential, namespace: string, names: string[]): NonNullable<Match["zk"]> {
  const claims = names.map((element) => {
    const cl = (q.claims ?? []).find((c) => String(c.path[1]) === element);
    return { namespace, element, value: cl?.values?.[0] as ZkClaimValue["value"] };
  });
  const circuits = (q.meta?.zk_system_type ?? [])
    .map((z) => z.params?.circuit_hash ?? z.zkSystemId)
    .filter((x): x is string => typeof x === "string");
  return { claims, ...(circuits.length ? { circuits } : {}) };
}

export interface RpCheck {
  registered: boolean;
  active: boolean;
  legalName?: string;
  purpose?: string;
  purposeLocalized?: Record<string, string>;
  scopeClaims: string[];
  overAsk: string[];
  certMatches?: boolean;
  /** ADR-0017 K7: istek bir aracı üzerinden geldiyse aracının kayıtlı adı. */
  via?: string;
  /** ADR-0024: ticari ad, kapsamın gizlilik politikası, destek adresi (onay ekranında) */
  tradeName?: string;
  privacyPolicy?: string;
  supportUri?: string;
  /** TS7 / TS8: silme talebi ve şikâyet kanalları */
  contact?: RpRecord["contact"];
  supervisoryAuthority?: SupervisoryAuthorityInfo;
  /**
   * İstek kayıtlı bir RP'nin kimliğini (client_id) kullanıyor ama kayıttaki erişim sertifikasıyla imzalanmamış: taklit girişimi.
   * Bu durumda kayıtlı ad GÖSTERİLMEZ ve paylaşım yapılmaz (cüzdan akışı durdurur).
   */
  impersonation?: boolean;
  /** ADR-0026: istekte doğrulanmış kayıt sertifikası vardı */
  registrationCert?: boolean;
  /** ADR-0026: kayıt sertifikasının bu belge için izin verdiği alanlar (varsa fazla istek bunlara göre de hesaplanır) */
  certClaims?: string[];
}
/**
 * `rp`: isteği imzalayanın (client_id) kaydı. Aracı istekte (`req.onBehalfOf`) `onBehalf` asıl RP'nin kaydıdır: ad ve kapsam ondan,
 * sertifika eşleşmesi imzalayandan denetlenir (HV6). Asıl RP kayıtsızsa ya da aracı ilişkisi iki kayıtta karşılıklı yazılı
 * değilse (ADR-0017 K7: `uses_intermediaries` ↔ `served_relying_parties`) `registered: false` — cüzdan isteği reddeder.
 * İmzalayan sertifika kayıttakiyle eşleşmiyorsa `registered: false`, `impersonation: true` (kayıtlı ad asla gösterilmez).
 */
export function checkRp(
  rp: RpRecord | null,
  req: VpRequest,
  match: Match,
  now = Date.now(),
  onBehalf?: RpRecord | null,
  /** iç kullanım: aracı istekte asıl RP'nin kaydına sertifika karşılaştırması uygulanmaz (imzalayan aracıdır) */
  skipCert = false,
): RpCheck {
  const impostor = (): RpCheck => ({
    registered: false,
    active: false,
    scopeClaims: [],
    overAsk: match.requested,
    certMatches: false,
    impersonation: true,
  });
  if (req.onBehalfOf) {
    if (!rp || !onBehalf) return { registered: false, active: false, scopeClaims: [], overAsk: match.requested };
    if (rp.access_cert_fingerprint_sha256 !== req.leafFingerprint) return impostor();
    // K7: kayıtlarda karşılıklı yazılı olmayan aracı ilişkisi → kayıtsız (asıl RP'nin adı gösterilmez, paylaşım yok)
    if (!intermediaryAllowed(req, rp, onBehalf))
      return { registered: false, active: false, scopeClaims: [], overAsk: match.requested, certMatches: true };
    const inner = checkRp(onBehalf, { ...req, onBehalfOf: undefined }, match, now, undefined, true);
    return {
      ...inner,
      active: inner.active && rp.status === "ACTIVE",
      certMatches: true,
      via: rp.legal_name,
    };
  }
  if (!rp) return { registered: false, active: false, scopeClaims: [], overAsk: match.requested };
  if (!skipCert && rp.access_cert_fingerprint_sha256 !== req.leafFingerprint) return impostor();
  const scopes = rp.scopes.filter(
    (s) =>
      s.vct === match.credential.vct &&
      new Date(s.valid_from).getTime() <= now &&
      (!s.valid_until || now < new Date(s.valid_until).getTime()),
  );
  const scopeClaims = [...new Set(scopes.flatMap((s) => s.claims))];
  return {
    registered: true,
    active: rp.status === "ACTIVE",
    legalName: rp.legal_name,
    tradeName: rp.trade_name,
    purpose: scopes[0]?.purpose,
    purposeLocalized: scopes[0]?.purpose_localized,
    privacyPolicy: scopes[0]?.privacy_policy_uri,
    supportUri: rp.contact?.support_uri,
    contact: rp.contact,
    supervisoryAuthority: rp.supervisory_authority,
    scopeClaims,
    // kapsam adları SD-JWT adlarıdır; Tamga türünün mdoc öğesi AB PID tablosuyla çevrilir (ADR-0045)
    overAsk: match.requested.filter((c) => !scopeClaims.includes(scopeName(match, c))),
    certMatches: true,
  };
}

/**
 * ADR-0032: ZK ispatçısına verilen girdi. `deviceResponse` bu oturumun olağan, cihaz imzalı yanıtıdır (donanım anahtarı ve telefon
 * kilidi — WL11) ve doğrulayıcıya GİTMEZ; ispatçı ondan ZK DeviceResponse (TS13 ZkDocument) üretir.
 */
export interface ZkProveRequest {
  queryId: string;
  deviceResponse: Uint8Array;
  transcript: Uint8Array;
  docType: string;
  namespace: string;
  claims: ZkClaimValue[];
  /** Doğrulayıcının kabul ettiği devreler (DCQL `zk_system_type`); yoksa güven listesindeki her etkin devre */
  circuits?: string[];
  /** Kurumun mdoc imza zinciri (DER, yaprak ilk) ve yaprağın P-256 anahtarı (65 bayt) */
  issuerX5chain: Uint8Array[];
  issuerKey: Uint8Array;
}
/** ZK sunumu yapılamadı (WalletError `unsupported`, `detail`): ispatçı yok (`unavailable`) ya da ispat üretilemedi (ZK5). */
export interface ZkFailureDetail {
  zk: string;
}

export interface RespondInput {
  request: VpRequest;
  matches: Array<{ match: Match; keyRef: string; combined: string; disclose: string[] }>;
  /** ADR-0031: takma ad sunumu (`presentPseudonym` çıktısı) — istekteki takma ad sorgusunun id'siyle */
  pseudonym?: { queryId: string; jwt: string };
  /** a3/WL13: geçiş kartı anahtarının sahiplik kanıtı (`makePassKeyProof`) — RP grant'ı bu anahtara bağlar */
  passKey?: string;
  keys: KeyProvider;
  http: Http;
  randomBytes?: (n: number) => Uint8Array;
  now?: number;
  /**
   * ADR-0032: ZK ispatçısı (cüzdan verir; ör. `@tamga-network/zk` presentZk). Dönen baytlar ZK DeviceResponse'tur ve vp_token'a
   * base64url olarak girer. Çekirdek ispatçıya bağımlı değildir; yoksa ya da hata verirse ZK sunumu yapılmaz.
   */
  zk?: (a: ZkProveRequest) => Promise<Uint8Array>;
}
export interface RespondOutput {
  status: number;
  redirectUri?: string;
  vpToken: Record<string, string[]>;
  passGrant?: string;
  showUrl?: string;
  /** Digital Credentials API: sayfaya dönecek yanıt (cüzdan bunu işletim sistemine verir; POST yok). */
  dcApiResponse?: { response: string };
}
/** Sunumları üretir (KB-JWT aud = client_id, PV7), vp_token'ı JWE ile şifreler (PV3) ve response_uri'ye POST eder. */
export async function respond(p: RespondInput): Promise<RespondOutput> {
  const vpToken: Record<string, string[]> = {};
  for (const m of p.matches) {
    if (m.match.format === MDOC_ZK_FORMAT) {
      vpToken[m.match.queryId] = [await presentZkMatch(p, m)];
      continue;
    }
    if (m.match.format === MDOC_FORMAT) {
      // D-CRED-5: aynı kopyanın mdoc temsili (anahtar referansıyla bulunur; çağıran değişmez)
      const copy = m.match.credential.copies.find((k) => k.keyRef === m.keyRef);
      if (!copy?.mdoc) throw new WalletError("issuer_error", "this copy has no mdoc representation");
      vpToken[m.match.queryId] = [
        await presentMdoc({
          mdocB64u: copy.mdoc,
          docType: m.match.credential.vct,
          namespace: m.match.namespace ?? "",
          disclose: m.disclose,
          clientId: p.request.clientId,
          nonce: p.request.nonce,
          responseUri: p.request.responseUri,
          origin: p.request.origin,
          encJwk: p.request.encJwk,
          keys: p.keys,
          keyRef: m.keyRef,
        }),
      ];
      continue;
    }
    const pres = await presentSdJwt({
      combined: m.combined,
      discloseClaims: m.disclose,
      keys: p.keys,
      keyRef: m.keyRef,
      aud: p.request.clientId,
      nonce: p.request.nonce,
      iat: p.now,
    });
    vpToken[m.match.queryId] = [pres];
  }
  if (p.pseudonym) vpToken[p.pseudonym.queryId] = [p.pseudonym.jwt];
  const payload: Record<string, unknown> = { vp_token: vpToken };
  if (p.request.state) payload.state = p.request.state;
  if (p.passKey) payload.pass_key = p.passKey; // şifreli yük içinde; RP dışında kimse görmez
  const jwe = encryptJwe(utf8(JSON.stringify(payload)), p.request.encJwk, {
    randomBytes: p.randomBytes,
    enc: p.request.enc ?? "A128GCM",
  });
  if (p.request.origin) return { status: 200, vpToken, dcApiResponse: { response: jwe } };
  const r = await p.http(p.request.responseUri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: `response=${encodeURIComponent(jwe)}`,
  });
  if (r.status !== 200) throw new WalletError("issuer_error", `verifier response ${r.status}`);
  let redirectUri: string | undefined;
  let passGrant: string | undefined;
  let showUrl: string | undefined;
  try {
    const j = (await readJson(r, "verifier")) as { redirect_uri?: string; pass_grant?: string; show_url?: string };
    redirectUri = j.redirect_uri;
    passGrant = j.pass_grant;
    showUrl = j.show_url;
  } catch {
    /* boş gövde olabilir */
  }
  return { status: r.status, redirectUri, vpToken, passGrant, showUrl }; // passGrant: ADR-0012 B (geçiş kartı) · showUrl: ADR-0012 C (kontrol görünümü, 5 dk)
}

/**
 * ADR-0032 ZK sunumu: olağan cihaz imzalı DeviceResponse (aynı kopya, aynı imza akışı — WL5, WL11) → ispatçı → base64url(ZK yanıtı).
 * İspatçı yoksa ya da başarısızsa `unsupported` (`detail.zk`); belge asla ispat yerine gönderilmez.
 */
async function presentZkMatch(p: RespondInput, m: RespondInput["matches"][number]): Promise<string> {
  const fail = (zk: string, msg: string) => new WalletError("unsupported", msg, { zk } satisfies ZkFailureDetail);
  if (!p.zk || !m.match.zk) throw fail("unavailable", "zero-knowledge proofs are not available in this wallet (ZK5)");
  // ADR-0044 ZC1: ispat yalnız ZK kopyasıyla (kısa ömürlü, ayrı tür); ana belgenin kopyası ZK'da kullanılmaz
  const ref = m.match.zk.copyKeyRef ?? m.keyRef;
  const copy = m.match.credential.zk?.copies.find((k) => k.keyRef === ref);
  if (!copy) throw fail("no_zk_copy", "no short-lived ZK copy is available for this credential (ADR-0044)");
  const docType = m.match.credential.zk!.docType;
  const namespace = m.match.namespace ?? "";
  const { deviceResponse, transcript } = await buildMdocPresentation({
    mdocB64u: copy.mdoc,
    docType,
    namespace,
    disclose: m.match.zk.claims.map((c) => c.element),
    clientId: p.request.clientId,
    nonce: p.request.nonce,
    responseUri: p.request.responseUri,
    origin: p.request.origin,
    encJwk: p.request.encJwk,
    keys: p.keys,
    keyRef: copy.keyRef,
  });
  const issuer = mdocIssuerKeys(copy.mdoc);
  let out: Uint8Array;
  try {
    out = await p.zk({
      queryId: m.match.queryId,
      deviceResponse,
      transcript,
      docType,
      namespace,
      claims: m.match.zk.claims,
      ...(m.match.zk.circuits ? { circuits: m.match.zk.circuits } : {}),
      issuerX5chain: issuer.x5chain,
      issuerKey: issuer.key,
    });
  } catch (e) {
    const code = (e as { code?: unknown } | null)?.code;
    throw fail(typeof code === "string" ? code : "prove_failed", "the zero-knowledge proof could not be created (ZK5)");
  }
  if (!(out instanceof Uint8Array) || !out.length) throw fail("prove_failed", "the zero-knowledge proof is empty");
  return b64u(out);
}

/**
 * ADR-0034: kopya ayrımı, takma ad ve günlük için kalıcı RP kimliği. Kayıt çözülmüş ve sertifika eşleşmişse asıl RP'nin (aracıda
 * `onBehalf`, yalnız K7 ilişkisi iki kayıtta yazılıysa) kalıcı alan adı (`dns_name`); değilse isteği imzalayanın client_id'si
 * (kayıtsız RP ya da doğrulanmamış aracı — paylaşım zaten yapılmaz).
 */
export function stableRpKey(req: VpRequest, rp: RpRecord | null, onBehalf?: RpRecord | null): string {
  const signerOk = !!rp && rp.access_cert_fingerprint_sha256 === req.leafFingerprint;
  if (req.onBehalfOf) {
    // K7: ilişki doğrulanmadıysa asıl RP'nin kimliği kopya ayrımı / takma ad için KULLANILMAZ
    if (signerOk && onBehalf?.dns_name && intermediaryAllowed(req, rp!, onBehalf)) return onBehalf.dns_name;
    return req.clientId;
  }
  if (signerOk && rp!.dns_name) return rp!.dns_name;
  return req.clientId;
}

/**
 * Eşleşmede istenen alanın değeri (onay ekranında göstermek için): SD-JWT'de yol; mdoc'ta öğe adı AB PID tablosuyla belgenin
 * SD-JWT claim'ine çevrilir (ADR-0045: `birth_date` → `birthdate`); ZK'da ispatlanan sabit değer (ADR-0032/0044).
 */
export function matchClaimValue(match: Match, name: string): unknown {
  if (match.format === MDOC_ZK_FORMAT) return match.zk?.claims.find((c) => c.element === name)?.value;
  if (match.format === MDOC_FORMAT) return match.credential.claims[scopeName(match, name)];
  return getClaimAtPath(match.credential.claims, name);
}

/** Kapsam (RP kaydı) adı: SD-JWT claim adı; Tamga türünün mdoc öğesi AB PID tablosuyla çevrilir (ADR-0045). */
function scopeName(match: Match, name: string): string {
  const mdoc = match.format === MDOC_FORMAT || match.format === MDOC_ZK_FORMAT;
  return mdoc && match.credential.vct.startsWith("urn:tamga:") ? pidSdJwtName(name) : name;
}

/** DCQL claim yolu → nokta yolu: dizgi = alan, sayı = dizi öğesi, null = dizinin tamamı (yolu orada keser). */
export function dcqlPathToName(path: ReadonlyArray<string | number | null>): string {
  let out = "";
  for (const p of path) {
    if (p === null) break;
    if (typeof p === "number") out += `[${p}]`;
    else out += out ? `.${p}` : p;
  }
  return out;
}
