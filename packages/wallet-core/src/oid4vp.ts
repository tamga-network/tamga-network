/**
 * OpenID4VP 1.0 — cüzdan tarafı, Tamga profili (SPEC-PROTO-0002):
 *  PV1 yalnızca DCQL · PV2 client_id kayıtla çözülür (aşırı talep denetimi) · PV3 şifreli yanıt (direct_post.jwt, ECDH-ES/A128GCM)
 *  PV4 origin prefix'i istekte kabul edilmez · PV6 istek nesnesi imzalı, redirect_uri prefix'i reddedilir · PV7 KB-JWT aud = client_id (tam)
 *  PV8 sunum kaydı cihazda · PV9 ≤3 credential, ≤2 credential_sets · PV10 nonce tek kullanımlık (verifier)
 */
import { b64Decode, b64u, utf8 } from "./b64.js";
import { getClaimAtPath } from "@tamga-network/core/sd-structure";
import { decodeJwt, verifyJwt } from "./jws.js";
import type { KeyProvider } from "./keys.js";
import { chooseEnc, encryptJwe, type EncJwk, type JweEnc } from "./jwe.js";
import { certFingerprintHex, p256PointFromCertDer, presentSdJwt } from "./sdjwt.js";
import { WalletError, type Http, readJson } from "./http.js";
import type { StoredCredential } from "./store.js";
import { certAuthorityKeyId, certSanDnsNames } from "./asn1.js";
import { fetchTrustSource, type TrustPins } from "./trustlist.js";
import { MDOC_FORMAT, presentMdoc } from "./mdoc.js";
import { NON_PRESENTABLE_VCTS, PSEUDONYM_FORMAT } from "./pseudonym.js";

export const REQUEST_TYP = "oauth-authz-req+jwt";

export interface DcqlClaim {
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
  meta?: { vct_values?: string[]; doctype_value?: string };
  claims?: DcqlClaim[];
  /** OpenID4VP 1.0 §6.1.1 (HAIP §5: `aki` desteklenmeli) */
  trusted_authorities?: DcqlTrustedAuthority[];
}
export interface DcqlQuery {
  credentials: DcqlCredential[];
  credential_sets?: unknown[];
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
export function verifyRequestObject(jwt: string, expectedClientId?: string, opts: { origin?: string } = {}): VpRequest {
  const d = decodeJwt(jwt);
  if (d.header.typ !== REQUEST_TYP) throw new WalletError("unsupported", `request typ=${String(d.header.typ)}`);
  const x5c = d.header.x5c as string[] | undefined;
  if (!x5c?.length) throw new WalletError("unsupported", "request object unsigned or without x5c (PV6)");
  const leafDer = b64Decode(x5c[0]);
  verifyJwt(jwt, p256PointFromCertDer(leafDer));
  const p = d.payload;
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

// ---- Kayıt çözümü (PV2) — v0: trust.tamga.network/tl-<cc>.json (imzasız görünüm); imzalı liste doğrulaması D5/pilot
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
  requested: string[];
  missing: string[];
  /** D-CRED-5: istenen format; `mso_mdoc` ise sunum DeviceResponse olarak üretilir (yoksa `dc+sd-jwt`). */
  format?: "dc+sd-jwt" | "mso_mdoc";
  /** mso_mdoc: DCQL claim yolu [namespace, element] — açıklamanın namespace'i. */
  namespace?: string;
  /**
   * Sorguyu karşılayan bütün belgeler (ilki = bu eşleşme). Birden çoksa cüzdan kullanıcıya hangisini göndereceğini sorar
   * (ARF OIA_11 — ör. birden çok doğrulanmış e-posta, ADR-0021).
   */
  alternatives?: Match[];
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
/** DCQL → cüzdandaki belgeler: vct eşleşmesi, `trusted_authorities` (aki), `values` koşulları, istenen claim adları. */
export function matchDcql(dcql: DcqlQuery, credentials: StoredCredential[]): { matches: Match[]; unmatched: string[] } {
  const matches: Match[] = [];
  const unmatched: string[] = [];
  for (const q of dcql.credentials) {
    if (q.format === PSEUDONYM_FORMAT) continue; // ADR-0031: takma ad belge değil, ayrı üretilir (pseudonymQueryOf)
    const isMdoc = q.format === MDOC_FORMAT;
    const vcts = q.meta?.vct_values ?? [];
    const docType = q.meta?.doctype_value;
    const cands = credentials
      .filter((c) =>
        NON_PRESENTABLE_VCTS.includes(c.vct) || // PS3: takma ad tohumu hiçbir sorguya önerilmez
        c.revokedLocally ||
        c.status?.value === "revoked" ||
        c.status?.value === "suspended"
          ? false
          : isMdoc
            ? c.vct === docType && c.copies.some((k) => !!k.mdoc) // D-CRED-5: yalnızca mdoc'u olan belge
            : q.format === "dc+sd-jwt" && (vcts.length === 0 || vcts.includes(c.vct)),
      )
      .filter((c) => trustedAuthorityOk(q, c));
    const namespace = isMdoc ? (q.claims?.[0]?.path[0] as string | undefined) : undefined;
    const ok: Match[] = [];
    for (const c of cands) {
      const requested: string[] = [];
      const missing: string[] = [];
      let fits = true;
      for (const cl of q.claims ?? []) {
        // SD-JWT: path [claim] · mdoc: path [namespace, element] (MD1: element adları SD-JWT claim adlarıyla aynı)
        // ADR-0036: SD-JWT yolu iç içe olabilir (["address","country"], ["nationalities", null|i]) → nokta yolu
        const name = isMdoc ? String(cl.path[1]) : dcqlPathToName(cl.path);
        const value = isMdoc ? c.claims[name] : getClaimAtPath(c.claims, name);
        const has = isMdoc ? Object.prototype.hasOwnProperty.call(c.claims, name) : value !== undefined;
        if (cl.values && (!has || !cl.values.some((v) => JSON.stringify(v) === JSON.stringify(value)))) {
          fits = false;
          break;
        }
        if (!has) missing.push(name);
        else requested.push(name);
      }
      if (fits)
        ok.push({
          queryId: q.id,
          credential: c,
          requested,
          missing,
          format: isMdoc ? MDOC_FORMAT : "dc+sd-jwt",
          ...(namespace ? { namespace } : {}),
        });
    }
    if (ok.length) matches.push(ok.length > 1 ? { ...ok[0], alternatives: ok } : ok[0]);
    else unmatched.push(q.id);
  }
  return { matches, unmatched };
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
 * sertifika eşleşmesi imzalayandan denetlenir (HV6). Asıl RP kayıtsızsa `registered: false` — cüzdan isteği reddeder.
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
    overAsk: match.requested.filter((c) => !scopeClaims.includes(c)),
    certMatches: true,
  };
}

export interface RespondInput {
  request: VpRequest;
  matches: Array<{ match: Match; keyRef: string; combined: string; disclose: string[] }>;
  /** ADR-0031: takma ad sunumu (`presentPseudonym` çıktısı) — istekteki takma ad sorgusunun id'siyle */
  pseudonym?: { queryId: string; jwt: string };
  keys: KeyProvider;
  http: Http;
  randomBytes?: (n: number) => Uint8Array;
  now?: number;
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
 * ADR-0034: kopya ayrımı, takma ad ve günlük için kalıcı RP kimliği. Kayıt çözülmüş ve sertifika eşleşmişse asıl RP'nin (aracıda
 * `onBehalf`) kalıcı alan adı (`dns_name`); değilse isteğin client_id'si (kayıtsız RP — takma ad zaten verilmez).
 */
export function stableRpKey(req: VpRequest, rp: RpRecord | null, onBehalf?: RpRecord | null): string {
  const owner = req.onBehalfOf ? onBehalf : rp;
  if (owner?.dns_name && (req.onBehalfOf ? !!rp : rp?.access_cert_fingerprint_sha256 === req.leafFingerprint))
    return owner.dns_name;
  return req.onBehalfOf ?? req.clientId;
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
