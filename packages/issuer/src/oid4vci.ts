/**
 * OpenID4VCI 1.0 — Tamga profili (SPEC-PROTO-0001), sunucu tarafı saf yardımcılar (HTTP yok).
 *  PR1 tx_code zorunlu · PR3 offer tek kullanımlık (on-screen 5 dk; out-of-band ≤72 s, DB-5) · PR4 c_nonce atomik
 *  PR5 ES256 · PR6 batch kopyaları farklı cnf · PR8 hata yanıtlarında kişisel veri yok · PR9 access token ≤ 5 dk
 */
import { randomBytes, randomInt } from "node:crypto";
import { decodeProtectedHeader, importJWK, jwtVerify, type JWK } from "jose";

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

/** Tamga anahtar deposu alt sınırı → kabul edilen ISO 18045 seviyeleri (alt sınır ve üstü) */
export function acceptedKeyStorageLevels(min: "software" | "tee" | "secure_enclave" | "strongbox" | "wscd"): string[] {
  const all = ["iso_18045_basic", "iso_18045_enhanced-basic", "iso_18045_moderate", "iso_18045_high"];
  const from = min === "software" ? 0 : min === "tee" ? 1 : min === "wscd" ? 3 : 2;
  return all.slice(from);
}

/** Issuer metadata — /.well-known/openid-credential-issuer/{slug}. PR2: yalnız yetkili vct'ler. */
export function issuerMetadata(p: {
  credentialIssuer: string;
  authorizedVcts: Array<{ vct: string; name: string; display: unknown[] }>;
  /** ADR-0025 / ISSU_27d: kabul edilen anahtar deposu seviyeleri (ISO 18045); verilirse KA istenir */
  keyAttestationsRequired?: { key_storage: string[]; user_authentication: string[] };
  /** ETSI TS 119 472-3 §4.2.3 (ARF RPRC_22): kayıt kurumu veri seti + varsa kayıt sertifikası (`verifier_info` yapısında) */
  issuerInfo?: Array<{ format: string; data: unknown }>;
  /**
   * ISO 18013-5 mdoc yapılandırmaları (`format: mso_mdoc`, `doctype`). ADR-0044: kimlik servisinin ZK kopyası — yalnız yenileme
   * belirteciyle alınır (PAR ile başlatılamaz).
   */
  mdocConfigurations?: Array<{ id: string; doctype: string; display: unknown[] }>;
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
          // OpenID4VCI 1.0: görünüm ve kopya politikası credential_metadata altında (üst düzey display eski cüzdanlar için)
          credential_metadata: { display: c.display, credential_reuse_policy: REUSE_POLICY },
          display: c.display,
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
          credential_metadata: { display: c.display },
          display: c.display,
        },
      ]),
    ]),
    display: [{ name: p.authorizedVcts[0]?.name ?? "Tamga Issuer", locale: "tr-TR" }],
    ...(p.issuerInfo?.length ? { issuer_info: p.issuerInfo } : {}),
  };
}
/** OAuth AS metadata (aynı sunucu) — /.well-known/oauth-authorization-server/{slug} */
export function authServerMetadata(
  credentialIssuer: string,
  opts: { authorizationCode?: boolean; refreshToken?: boolean; scopes?: string[] } = {},
) {
  const base = {
    issuer: credentialIssuer,
    token_endpoint: `${credentialIssuer}/token`,
    grant_types_supported: [PRE_AUTH_GRANT, ...(opts.refreshToken ? ["refresh_token"] : [])],
    "pre-authorized_grant_anonymous_access_supported": true,
    token_endpoint_auth_methods_supported: ["none", "attest_jwt_client_auth"],
    dpop_signing_alg_values_supported: ["ES256"], // RFC 9449; belirteç DPoP'a bağlı (HAIP)
  };
  if (!opts.authorizationCode) return base;
  // SPEC-PROTO-0001 v1.2 §12: cüzdan-başlatmalı ihraç — PAR zorunlu, PKCE S256, istemci kimliği WUA (attest_jwt_client_auth)
  return {
    ...base,
    // ADR-0023: kurum belgelerinde sessiz yenileme (DPoP + WUA bağlı yenileme belirteci)
    grant_types_supported: [PRE_AUTH_GRANT, "authorization_code", ...(opts.refreshToken ? ["refresh_token"] : [])],
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
