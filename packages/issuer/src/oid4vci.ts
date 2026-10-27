/**
 * OpenID4VCI 1.0 — Tamga profili (SPEC-PROTO-0001), sunucu tarafı saf yardımcılar (HTTP yok).
 *  PR1 tx_code zorunlu · PR3 offer tek kullanımlık (on-screen 5 dk; out-of-band ≤72 s, DB-5) · PR4 c_nonce atomik
 *  PR5 ES256 · PR6 batch kopyaları farklı cnf · PR8 hata yanıtlarında kişisel veri yok · PR9 access token ≤ 5 dk
 */
import { randomBytes, randomInt } from "node:crypto";
import { decodeProtectedHeader, importJWK, jwtVerify, type JWK } from "jose";
import {
  EMBEDDED_DISCLOSURE_POLICY_MEMBER,
  acceptsDisclosurePolicy,
  validateDisclosurePolicy,
  type EmbeddedDisclosurePolicy,
} from "@tamga-network/schemas";

/**
 * on-screen: masada QR + PIN (5 dk) · out-of-band: bağlantı + ayrı kanaldan PIN (72 sa) ·
 * identity-bound (ADR-0020): kurumun gönderdiği bağlantı, kişi kimliğini sunar (authorization_code + issuer_state; 7 gün)
 */
export type OfferClass = "on-screen" | "out-of-band" | "identity-bound";
export const OFFER_TTL_SEC: Record<OfferClass, number> = {
  "on-screen": 300,
  "out-of-band": 72 * 3600,
  "identity-bound": 7 * 86400,
};
export const TX_CODE_ATTEMPTS = 3;
export const ACCESS_TOKEN_TTL_SEC = 300; // PR9
/** c_nonce ömrü (SPEC-PROTO-0001 §5: 5 dk — 10 donanım anahtarı + anahtar kanıtı yavaş cihazda da sığsın). Ömür yanıtta
 *  bildirilmez: OpenID4VCI 1.0 Final nonce yanıtı yalnız `c_nonce` taşır (`c_nonce_expires_in` yok). */
export const C_NONCE_TTL_SEC = 300;
export const BATCH_SIZE = 10; // §8
/**
 * ADR-0059 AT2: bir erişim belirteciyle ömrü (≤ 5 dk, PR9) boyunca alınabilecek toplam kopya sayısı — bir toplu ihracın
 * büyüklüğü. Belirteç birden çok belge isteğinde kullanılabilir (OpenID4VCI 1.0 §8; AB referans belge vereni gibi); her istek
 * aynı DPoP anahtarıyla (AT3) ve yalnız belirtecin kapsadığı yapılandırma için (AT1).
 */
export const MAX_COPIES_PER_ACCESS_TOKEN = BATCH_SIZE;
/** ADR-0059 AT2: `used` kopya verilmiş bir belirteçle `requested` kopya daha istenebilir mi. */
export function withinAccessTokenAllowance(
  used: number,
  requested: number,
  max: number = MAX_COPIES_PER_ACCESS_TOKEN,
): boolean {
  return (
    Number.isInteger(used) && Number.isInteger(requested) && used >= 0 && requested >= 1 && used + requested <= max
  );
}
export const PROOF_TYP = "openid4vci-proof+jwt";
export const PRE_AUTH_GRANT = "urn:ietf:params:oauth:grant-type:pre-authorized_code";

const opaque = (n = 24) => randomBytes(n).toString("base64url");
export const newTxCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

export interface Offer {
  id: string;
  slug: string;
  subjectRef: string;
  vct: string;
  klass: OfferClass;
  preAuthorizedCode: string;
  txCode: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
  attempts: number;
  /** ADR-0020: kimliğe bağlı teklif — eşleştirme anahtarlarının anahtarlı özeti (düz T.C. kimlik no yok) */
  bindHash?: string;
}
export function createOffer(p: {
  slug: string;
  subjectRef: string;
  vct: string;
  klass: OfferClass;
  now?: number;
  bindHash?: string;
}): Offer {
  const now = p.now ?? Math.floor(Date.now() / 1000);
  const bound = p.klass === "identity-bound";
  if (bound && !p.bindHash) throw new Error("identity-bound offer requires bindHash");
  return {
    id: opaque(12),
    slug: p.slug,
    subjectRef: p.subjectRef,
    vct: p.vct,
    klass: p.klass,
    // kimliğe bağlı teklifte ön-yetkili kod ve PIN yok — yalnız authorization_code (issuer_state)
    preAuthorizedCode: bound ? "" : opaque(),
    txCode: bound ? "" : newTxCode(),
    ...(bound ? { bindHash: p.bindHash } : {}),
    createdAt: now,
    expiresAt: now + OFFER_TTL_SEC[p.klass],
    used: false,
    attempts: 0,
  };
}
/** Cüzdana giden credential offer nesnesi (kişisel veri yok). */
export function offerObject(o: Offer, credentialIssuer: string) {
  if (o.klass === "identity-bound")
    return {
      credential_issuer: credentialIssuer,
      credential_configuration_ids: [o.vct],
      grants: { authorization_code: { issuer_state: o.id } },
    };
  return {
    credential_issuer: credentialIssuer,
    credential_configuration_ids: [o.vct],
    grants: {
      [PRE_AUTH_GRANT]: {
        "pre-authorized_code": o.preAuthorizedCode,
        tx_code: { length: 6, input_mode: "numeric", description: "6-digit PIN shown by the institution" },
      },
    },
  };
}
export const offerDeepLink = (offerUri: string) =>
  `openid-credential-offer://?credential_offer_uri=${encodeURIComponent(offerUri)}`;

export type TokenError =
  "invalid_grant" | "invalid_request" | "offer_expired" | "offer_used" | "tx_code_mismatch" | "too_many_attempts";
/**
 * Token ucunun OAuth hata gövdesi (RFC 6749 §5.2): `redeemOffer`'ın iç nedenleri standart koda iner — bilinmeyen, kullanılmış ya
 * da süresi dolmuş teklif, yanlış ya da çok denenmiş PIN hepsi `invalid_grant`; eksik `tx_code` `invalid_request` (PR1). Neden
 * `error_description`'da kalır (cüzdan oradan okur; kişisel veri yok — PR8).
 */
export function tokenErrorResponse(e: TokenError): {
  error: "invalid_grant" | "invalid_request";
  error_description: string;
} {
  return { error: e === "invalid_request" ? "invalid_request" : "invalid_grant", error_description: e };
}
/** Token isteği: pre-authorized_code + tx_code → başarı/hata; offer durumunu döndürür (çağıran kaydeder). */
export function redeemOffer(
  o: Offer,
  preAuthorizedCode: string,
  txCode: string | undefined,
  now = Math.floor(Date.now() / 1000),
): { ok: true; accessToken: string; expiresIn: number } | { ok: false; error: TokenError } {
  // kimliğe bağlı teklifin ön-yetkili kodu yoktur: boş kodla eşleşme olmaz (ADR-0020 AS2)
  if (o.klass === "identity-bound" || !o.preAuthorizedCode || !preAuthorizedCode)
    return { ok: false, error: "invalid_grant" };
  if (o.preAuthorizedCode !== preAuthorizedCode) return { ok: false, error: "invalid_grant" };
  if (o.used) return { ok: false, error: "offer_used" };
  if (now > o.expiresAt) return { ok: false, error: "offer_expired" };
  if (o.attempts >= TX_CODE_ATTEMPTS) return { ok: false, error: "too_many_attempts" };
  if (!txCode) return { ok: false, error: "invalid_request" }; // PR1
  if (txCode !== o.txCode) {
    o.attempts++;
    if (o.attempts >= TX_CODE_ATTEMPTS) o.used = true;
    return { ok: false, error: o.used ? "too_many_attempts" : "tx_code_mismatch" };
  }
  o.used = true; // PR3 tek kullanımlık
  // OpenID4VCI 1.0 Final: token yanıtı c_nonce taşımaz — cüzdan nonce ucundan alır (SPEC-PROTO-0001 §4–§5)
  return { ok: true, accessToken: opaque(), expiresIn: ACCESS_TOKEN_TTL_SEC };
}

export type ProofResult = { ok: true; jwk: JWK } | { ok: false; reason: string };
/** proofs.jwt[i] doğrulama: typ, alg, jwk başlıkta, aud = credential_issuer, nonce = c_nonce, iat. */
export async function verifyProofJwt(
  proof: string,
  credentialIssuer: string,
  cNonce: string,
  now = Math.floor(Date.now() / 1000),
): Promise<ProofResult> {
  // Beklenen değerler boşsa (ör. nonce deposu undefined döndü) kanıt kabul edilmez — tekrar oynatmaya kapı açmasın
  if (typeof credentialIssuer !== "string" || !credentialIssuer || typeof cNonce !== "string" || !cNonce)
    return { ok: false, reason: "expected credential_issuer / c_nonce missing" };
  try {
    const h = decodeProtectedHeader(proof);
    if (h.typ !== PROOF_TYP) return { ok: false, reason: "typ" };
    if (h.alg !== "ES256") return { ok: false, reason: "alg (PR5)" };
    if (!h.jwk) return { ok: false, reason: "jwk missing" };
    const key = await importJWK(h.jwk as JWK, "ES256");
    const { payload } = await jwtVerify(proof, key, { audience: credentialIssuer });
    if (payload.nonce !== cNonce) return { ok: false, reason: "nonce" };
    if (typeof payload.iat !== "number" || Math.abs(now - payload.iat) > C_NONCE_TTL_SEC)
      return { ok: false, reason: "iat" };
    const { kty, crv, x, y } = h.jwk as JWK;
    if (kty !== "EC" || crv !== "P-256") return { ok: false, reason: "key is not P-256" };
    return { ok: true, jwk: { kty, crv, x, y } };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}

/**
 * Kopya kullanım politikası — ETSI TS 119 472-3 §4.2.4.2 (`arf_annex_ii`), ARF ISSU_37–40: tercih doğrulayıcı başına ayrı kopya
 * (yöntem D, `per-relying-party`), yedek tek kullanımlık paket (yöntem A, `once_only`). 2 kopya kalınca yeni paket; süre bitimine
 * 7 gün kala yenileme.
 */
export const REUSE_POLICY = {
  id: "arf_annex_ii",
  options: [
    {
      details: ["per-relying-party", "once_only"],
      batch_size: BATCH_SIZE,
      reissue_trigger_unused: 2,
      reissue_trigger_lifetime_left: 7 * 86400,
    },
  ],
} as const;

/**
 * ADR-0046 K1: metadata'ya girecek politika — biçim denetiminden geçmiş hâli (bilinen üyeler). Kimlik ve iletişim türlerinde
 * politika yasak; bozuk politika metadata'yı hiç üretmez (kurumun yanlış ayarı sessizce "politikasız" yayınlanmasın).
 */
export function checkedDisclosurePolicy(vct: string, policy: unknown): EmbeddedDisclosurePolicy {
  if (!acceptsDisclosurePolicy(vct))
    throw new Error(`embedded disclosure policy is not allowed for ${vct} (ADR-0046 K1: institution credentials only)`);
  const v = validateDisclosurePolicy(policy);
  if (!v.ok) throw new Error(`invalid embedded disclosure policy for ${vct}: ${v.errors.join("; ")}`);
  return v.policy;
}

/** Tamga anahtar deposu alt sınırı → kabul edilen ISO 18045 seviyeleri (alt sınır ve üstü) */
export function acceptedKeyStorageLevels(min: "software" | "tee" | "secure_enclave" | "strongbox" | "wscd"): string[] {
  const all = ["iso_18045_basic", "iso_18045_enhanced-basic", "iso_18045_moderate", "iso_18045_high"];
  const from = min === "software" ? 0 : min === "tee" ? 1 : min === "wscd" ? 3 : 2;
  return all.slice(from);
}

/** Issuer metadata — /.well-known/openid-credential-issuer/{slug}. PR2: yalnız yetkili vct'ler. */
export function issuerMetadata(p: {
  credentialIssuer: string;
  /**
   * ADR-0046: `disclosurePolicy` verilirse yapılandırmanın `credential_metadata.embedded_disclosure_policy`'si olur (değer olarak,
   * EP1). Biçimi bozuksa ya da tür politika kabul etmiyorsa (kimlik, iletişim — K1) hata.
   */
  authorizedVcts: Array<{ vct: string; name: string; display: unknown[]; disclosurePolicy?: unknown }>;
  /**
   * ADR-0025 / ISSU_27d: kabul edilen anahtar deposu seviyeleri (ISO 18045); verilirse KA istenir. AB TS3 §2.4 / ARF WUA_32:
   * isteğe bağlı `preferred_key_storage_status_period` (saniye) — KA'nın kalan iptal bakım süresi tercihi.
   */
  keyAttestationsRequired?: {
    key_storage: string[];
    user_authentication: string[];
    preferred_key_storage_status_period?: number;
  };
  /** AB TS3 §2.4 / ARF WUA_32: WIA'nın kalan iptal bakım süresi tercihi (saniye); zincirleme iptal yapan belge veren ilan eder */
  preferredClientStatusPeriod?: number;
  /** ETSI TS 119 472-3 §4.2.3 (ARF RPRC_22): kayıt kurumu veri seti + varsa kayıt sertifikası (`verifier_info` yapısında) */
  issuerInfo?: Array<{ format: string; data: unknown }>;
  /**
   * ISO 18013-5 mdoc yapılandırmaları (`format: mso_mdoc`, `doctype`). ADR-0044: kimlik servisinin ZK kopyası — yalnız yenileme
   * belirteciyle alınır (PAR ile başlatılamaz).
   */
  mdocConfigurations?: Array<{ id: string; doctype: string; display: unknown[] }>;
  /**
   * OpenID4VCI 1.0 §12.2.4 belge verenin görünümü (`display`): kurumun imzalı güven listesindeki kayıtlı adı ve varsa dildeki
   * karşılıkları, her girdi kendi `locale`'iyle (`issuerDisplayFrom`). Verilmezse adsız, yerelsiz tek girdi yazılır — belge
   * türünün adı ya da sabit bir dil kullanılmaz.
   */
  issuerDisplay?: Array<{ name: string; locale?: string }>;
}) {
  const base = p.credentialIssuer;
  const proofTypes = {
    jwt: {
      proof_signing_alg_values_supported: ["ES256"],
      ...(p.keyAttestationsRequired ? { key_attestations_required: p.keyAttestationsRequired } : {}),
    },
    // HAIP §4.5.1 / CIR 2026/1731 TR_KA-4: anahtar kanıtı isteniyorsa `attestation` proof türü de desteklenir
    ...(p.keyAttestationsRequired
      ? {
          attestation: {
            proof_signing_alg_values_supported: ["ES256"],
            key_attestations_required: p.keyAttestationsRequired,
          },
        }
      : {}),
  };
  return {
    credential_issuer: base,
    authorization_servers: [base],
    ...(p.preferredClientStatusPeriod ? { preferred_client_status_period: p.preferredClientStatusPeriod } : {}),
    credential_endpoint: `${base}/credential`,
    nonce_endpoint: `${base}/nonce`,
    batch_credential_issuance: { batch_size: BATCH_SIZE },
    credential_configurations_supported: Object.fromEntries([
      ...p.authorizedVcts.map((c) => [
        c.vct,
        {
          format: "dc+sd-jwt",
          // HAIP §4.1: her yapılandırmanın kapsamı; değer vct (yeni ad yok, tek anlamlı)
          scope: c.vct,
          vct: c.vct,
          cryptographic_binding_methods_supported: ["jwk"],
          credential_signing_alg_values_supported: ["ES256"],
          proof_types_supported: proofTypes,
          // OpenID4VCI 1.0 (Final) §12.2.4: görünüm ve kopya politikası yalnız credential_metadata altında; `locale` (tür
          // metadata'sının `lang`'ı çevrilir)
          credential_metadata: {
            display: credentialDisplay(c.display),
            credential_reuse_policy: REUSE_POLICY,
            ...(c.disclosurePolicy !== undefined && c.disclosurePolicy !== null
              ? { [EMBEDDED_DISCLOSURE_POLICY_MEMBER]: checkedDisclosurePolicy(c.vct, c.disclosurePolicy) }
              : {}),
          },
        },
      ]),
      // OpenID4VCI 1.0 Ek A.2: mso_mdoc yapılandırması (`doctype`; anahtar bağlaması `cose_key`, imza ES256 = COSE -7)
      ...(p.mdocConfigurations ?? []).map((c) => [
        c.id,
        {
          format: "mso_mdoc",
          scope: c.id,
          doctype: c.doctype,
          cryptographic_binding_methods_supported: ["cose_key"],
          credential_signing_alg_values_supported: [-7],
          proof_types_supported: proofTypes,
          credential_metadata: { display: credentialDisplay(c.display) },
        },
      ]),
    ]),
    display: p.issuerDisplay?.length ? oneDisplayPerLocale(p.issuerDisplay) : [{ name: "Credential Issuer" }],
    ...(p.issuerInfo?.length ? { issuer_info: p.issuerInfo } : {}),
  };
}
const LANGUAGE_NAMES = new Intl.DisplayNames(["en"], { type: "language", fallback: "none" });
const REGION_NAMES = new Intl.DisplayNames(["en"], { type: "region", fallback: "none" });
/**
 * OpenID4VCI 1.0 §12.2.4 `locale`: BCP 47 (RFC 5646) etiketi kanonik biçimde (`en-us` → `en-US`, `TR` → `tr`). Biçimi bozuk
 * (`en_US`), dil alt etiketi kayıtsız (`xx`, `und`) ya da bölge alt etiketi bilinmeyen etiket için `undefined` — çağıran o
 * girdiyi yazmaz (OpenID uyum testi `VCIValidateDisplayLocales` FAILURE, `VCIWarnOnNonCanonicalDisplayLocales` WARNING).
 */
function canonicalLocale(tag: unknown): string | undefined {
  if (typeof tag !== "string" || !tag) return undefined;
  try {
    const [canonical] = Intl.getCanonicalLocales(tag);
    if (!canonical) return undefined;
    // `und` (belirsiz dil) Intl.Locale'da dil alt etiketi vermez; .of() geçersiz kodda RangeError atar
    const { language, region } = new Intl.Locale(canonical);
    if (!language || language === "und" || LANGUAGE_NAMES.of(language) === undefined) return undefined;
    if (region && REGION_NAMES.of(region) === undefined) return undefined;
    return canonical;
  } catch {
    return undefined; // RangeError: biçim BCP 47 değil
  }
}
/**
 * §12.2.4: dil başına tek görünüm nesnesi — `locale` kanonikleştirilir, geçersiz `locale`'li girdi düşer, aynı dilin (ve yerelsiz
 * girdinin) yalnız ilki kalır.
 */
function oneDisplayPerLocale<T extends { locale?: unknown }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const d of items) {
    const has = d.locale !== undefined;
    const locale = has ? canonicalLocale(d.locale) : undefined;
    if (has && !locale) continue;
    const key = locale ?? "";
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(has ? { ...d, locale } : d);
  }
  return out;
}
/**
 * Belge verenin görünümü, güven listesindeki kayıttan: `legal_name` yerelsiz (resmî ad, her dilde aynı); `service_description`
 * BCP 47 dil → metin eşlemesiyse her dil için `name` = kayıtlı ad, `locale` = o dil ve `description` = metin. `names` verilirse
 * (dil → yerel ad; ör. kurumun İngilizce adı) `legal_name` yerine o dilin adı yazılır. `locale` değerleri kanonik BCP 47'dir
 * (`tr`, `en-US`; `canonicalLocale`): kayıttaki anahtar kanonik biçime çevrilir, geçersiz anahtar yazılmaz, dil uydurulmaz;
 * aynı dile çıkan iki anahtar tek girdidir.
 */
export function issuerDisplayFrom(p: {
  legalName: string;
  serviceDescription?: Record<string, string>;
  names?: Record<string, string>;
}): Array<{ name: string; locale?: string; description?: string }> {
  const byLocale = new Map<string, { name?: string; description?: string }>();
  const add = (src: Record<string, string> | undefined, field: "name" | "description") => {
    for (const [tag, v] of Object.entries(src ?? {})) {
      const locale = canonicalLocale(tag);
      if (!locale) continue;
      const e = byLocale.get(locale) ?? {};
      if (typeof v === "string" && v && e[field] === undefined) e[field] = v;
      byLocale.set(locale, e);
    }
  };
  add(p.serviceDescription, "description");
  add(p.names, "name");
  const out: Array<{ name: string; locale?: string; description?: string }> = [{ name: p.legalName }];
  for (const [locale, e] of byLocale)
    out.push({ name: e.name ?? p.legalName, locale, ...(e.description ? { description: e.description } : {}) });
  return out;
}
/**
 * SD-JWT VC tür metadata'sının görünümü (`lang`, `name`, `description`, `rendering.simple`) → OpenID4VCI 1.0 §12.2.4 belge görünümü
 * (`name`, `locale`, `description`, `logo`, `background_color`, `background_image`, `text_color`). Tanımsız alan yazılmaz.
 * `locale` kanonik BCP 47; geçersiz dilli girdi düşer, dil başına tek girdi (`oneDisplayPerLocale`).
 */
export function credentialDisplay(display: unknown): Array<Record<string, unknown>> | undefined {
  if (!Array.isArray(display)) return undefined;
  return oneDisplayPerLocale(
    display
      .filter((d): d is Record<string, unknown> => !!d && typeof d === "object")
      .map((d): Record<string, unknown> => ({ ...d, locale: d.locale ?? d.lang })),
  ).map((d) => {
    const simple = ((d.rendering as Record<string, unknown> | undefined)?.simple ?? {}) as Record<string, unknown>;
    const logo = (d.logo ?? simple.logo) as Record<string, unknown> | undefined;
    const locale = d.locale; // kanonik (oneDisplayPerLocale)
    const bg = d.background_color ?? simple.background_color;
    const tc = d.text_color ?? simple.text_color;
    return {
      name: d.name,
      ...(typeof locale === "string" ? { locale } : {}),
      ...(typeof d.description === "string" ? { description: d.description } : {}),
      ...(logo && typeof logo.uri === "string"
        ? { logo: { uri: logo.uri, ...(typeof logo.alt_text === "string" ? { alt_text: logo.alt_text } : {}) } }
        : {}),
      ...(typeof bg === "string" ? { background_color: bg } : {}),
      ...(d.background_image && typeof d.background_image === "object" ? { background_image: d.background_image } : {}),
      ...(typeof tc === "string" ? { text_color: tc } : {}),
    };
  });
}
/** OAuth AS metadata (aynı sunucu) — /.well-known/oauth-authorization-server/{slug} */
export function authServerMetadata(
  credentialIssuer: string,
  opts: {
    authorizationCode?: boolean;
    refreshToken?: boolean;
    scopes?: string[];
    /**
     * Ön yetkili kod akışı sunuluyor mu (varsayılan evet — kurum issuer'ı). Sunulmuyorsa (kimlik servisi: yalnız authorization
     * code, IDP7) grant ilan edilmez, `pre-authorized_grant_anonymous_access_supported` yazılmaz ve `none` kimlik doğrulama
     * yöntemi yoktur (istemci her zaman WIA ile tanınır) — metadata token ucunun davranışıyla aynı şeyi söyler.
     */
    preAuthorized?: boolean;
  } = {},
) {
  const preAuth = opts.preAuthorized !== false;
  const base = {
    issuer: credentialIssuer,
    token_endpoint: `${credentialIssuer}/token`,
    grant_types_supported: [...(preAuth ? [PRE_AUTH_GRANT] : []), ...(opts.refreshToken ? ["refresh_token"] : [])],
    ...(preAuth ? { "pre-authorized_grant_anonymous_access_supported": true } : {}),
    token_endpoint_auth_methods_supported: [...(preAuth ? ["none"] : []), "attest_jwt_client_auth"],
    // draft-ietf-oauth-attestation-based-client-auth-07 §10.1: attest_jwt_client_auth ilan edilince ikisi de ZORUNLU
    // (istemci kanıtı = WIA/WUA ve PoP'u yalnız ES256 ile doğrulanır)
    client_attestation_signing_alg_values_supported: ["ES256"],
    client_attestation_pop_signing_alg_values_supported: ["ES256"],
    dpop_signing_alg_values_supported: ["ES256"], // RFC 9449; belirteç DPoP'a bağlı (HAIP)
  };
  if (!opts.authorizationCode) return base;
  // SPEC-PROTO-0001 v1.2 §12: cüzdan-başlatmalı ihraç — PAR zorunlu, PKCE S256, istemci kimliği WUA (attest_jwt_client_auth)
  return {
    ...base,
    // ADR-0023: kurum belgelerinde sessiz yenileme (DPoP + WUA bağlı yenileme belirteci)
    grant_types_supported: [
      ...(preAuth ? [PRE_AUTH_GRANT] : []),
      "authorization_code",
      ...(opts.refreshToken ? ["refresh_token"] : []),
    ],
    authorization_endpoint: `${credentialIssuer}/authorize`,
    pushed_authorization_request_endpoint: `${credentialIssuer}/par`,
    require_pushed_authorization_requests: true,
    code_challenge_methods_supported: ["S256"],
    response_types_supported: ["code"],
    scopes_supported: opts.scopes,
    authorization_response_iss_parameter_supported: true, // RFC 9207 (HAIP → FAPI2)
  };
}

/**
 * OpenID4VCI 1.0 §12.2.3 imzalı metadata (ISSU_32). Cüzdan `Accept: application/jwt` ile ister. İmzacı kurumun güven
 * listesindeki belge imza sertifikasıdır (x5c); cüzdan parmak izini listedeki kayıtla karşılaştırarak imzacıya güvenir.
 */
export const SIGNED_METADATA_TYP = "openidvci-issuer-metadata+jwt";
export async function signIssuerMetadata(
  metadata: { credential_issuer: string } & Record<string, unknown>,
  signer: { x5c: Uint8Array[]; sign(h: Record<string, unknown>, p: Uint8Array): Promise<string> },
  opts: { now?: number; ttlSec?: number } = {},
): Promise<string> {
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  const payload = {
    ...metadata,
    iss: metadata.credential_issuer,
    sub: metadata.credential_issuer,
    iat: now,
    exp: now + (opts.ttlSec ?? 86400),
  };
  return signer.sign(
    { alg: "ES256", typ: SIGNED_METADATA_TYP, x5c: signer.x5c.map((d) => Buffer.from(d).toString("base64")) },
    new TextEncoder().encode(JSON.stringify(payload)),
  );
}

/**
 * ETSI TS 119 472-3 §4.2.3 `issuer_info`: `registrar_dataset` (kimlik, hizmet açıklaması, kayıt kurumu, verebildiği türler —
 * imzalı güven listesindeki kayıttan) ve varsa `registration_cert` (ADR-0026 WRPRC).
 */
export function issuerInfoFrom(p: {
  record: Record<string, unknown>;
  registryUri: string;
  registrationCert?: string;
  now?: number;
}): Array<{ format: string; data: unknown }> {
  const r = p.record as {
    issuer_id?: string;
    legal_name?: string;
    identifiers?: Array<{ scheme: string; value: string }>;
    service_description?: Record<string, string>;
    schema_authorizations?: Array<{ vct: string; allowed: boolean; valid_until: string | null }>;
  };
  const now = p.now ?? Date.now();
  const ids = r.identifiers?.length
    ? r.identifiers.map((i) => ({
        type: i.scheme === "TR-VKN" ? "http://data.europa.eu/eudi/id/TIN" : `urn:tamga:id:${i.scheme}`,
        identifier: i.value,
      }))
    : [{ type: "urn:tamga:issuer_id", identifier: String(r.issuer_id) }];
  const desc = Object.entries(r.service_description ?? {}).map(([lang, value]) => ({ lang, value }));
  const vcts = (r.schema_authorizations ?? [])
    .filter((a) => a.allowed && (!a.valid_until || new Date(a.valid_until).getTime() > now))
    .map((a) => a.vct);
  return [
    {
      format: "registrar_dataset",
      data: {
        identifier: ids,
        srvDescription: desc.length ? desc : [{ lang: "en", value: String(r.legal_name ?? "") }],
        registryURI: p.registryUri,
        providesAttestations: vcts.map((v) => ({ format: "dc+sd-jwt", meta: { vct_values: [v] } })),
      },
    },
    ...(p.registrationCert ? [{ format: "registration_cert", data: p.registrationCert }] : []),
  ];
}
