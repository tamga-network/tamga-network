/**
 * OpenID4VP istek nesnesi (JAR) üretimi ve şifreli yanıt çözme — verifier tarafı (SPEC-PROTO-0002 §3, §5.3).
 *  İmza ES256, typ oauth-authz-req+jwt, x5c = RP erişim sertifikası; client_id `x509_hash:` + base64url(SHA-256(yaprak DER))
 *  (OpenID4VP 1.0 §5.9.3, HAIP 1.0 §5; ADR-0034) — sertifikadan hesaplanır, elle verilmez.
 *  Yanıt: JWE ECDH-ES/A128GCM ya da A256GCM (HAIP §5: doğrulayıcı ikisini de ilan eder ve kabul eder) → { vp_token, state }.
 *  Şifreleme anahtarı sunum başına efemer (jose, P-256).
 */
import {
  SignJWT,
  importPKCS8,
  generateKeyPair,
  exportJWK,
  compactDecrypt,
  calculateJwkThumbprint,
  type JWK,
} from "jose";
import type { KeyObject } from "node:crypto";
export type KeyLike = CryptoKey | KeyObject;
import { randomBytes } from "node:crypto";
import { derToB64, pemToDer, x509HashClientId } from "@tamga-network/core";
import type { DcqlQuery } from "./policy.js";

export const REQUEST_TYP = "oauth-authz-req+jwt";
/** HAIP §5: doğrulayıcının ilan ettiği ve kabul ettiği içerik şifrelemeleri */
export const RESPONSE_ENC = ["A128GCM", "A256GCM"] as const;

export interface RpSigner {
  clientId: string;
  leafDer: Uint8Array;
  key: KeyLike;
}
/** ADR-0034: `clientId` erişim sertifikasından (`x509_hash`) hesaplanır; listedeki kaydın `client_id`'siyle aynıdır. */
export async function pemRpSigner(privateKeyPem: string, certPem: string): Promise<RpSigner> {
  const leafDer = pemToDer(certPem);
  return {
    clientId: x509HashClientId(leafDer),
    leafDer,
    key: (await importPKCS8(privateKeyPem, "ES256")) as KeyLike,
  };
}

export interface PresentationRequest {
  presentationId: string;
  nonce: string;
  state: string;
  requestJwt: string;
  requestUri: string;
  qrPayload: string;
  encPrivateKey: KeyLike;
  encPublicJwk: JWK;
  /** RFC 7638 SHA-256 parmak izi (mdoc SessionTranscript — OpenID4VP 1.0 Ek B.2.6.1). */
  encJwkThumbprint: Uint8Array;
  expiresAt: number;
  dcql: DcqlQuery;
  /** `dcApi` verildiyse: `navigator.credentials.get({ digital: { requests: [dcApiRequest] } })` girdisi. */
  dcApiRequest?: { protocol: "openid4vp-v1-signed"; data: { request: string } };
}

export async function createPresentationRequest(p: {
  signer: RpSigner;
  dcql: DcqlQuery;
  responseUri: string;
  requestUriBase: string;
  ttlSec?: number;
  now?: number;
  purpose?: string;
  /** ADR-0017 K7: aracı doğrulayıcı bir RP adına istiyorsa asıl RP'nin client_id'si (cüzdan onu gösterir). */
  onBehalfOf?: string;
  /**
   * ADR-0026 K4: kullanımların kayıt sertifikaları (WRPRC, rc-wrp+jwt) → verifier_info (ETSI TS 119 472-2); `credentialIds`
   * sertifikayı DCQL sorgularına bağlar (OpenID4VP 1.0 §5.1).
   */
  registrationCerts?: Array<{ jwt: string; credentialIds?: string[] }>;
  /**
   * Tarayıcı Digital Credentials API'si (OpenID4VP 1.0 Ek A): yanıt sayfaya döner (`dc_api.jwt`, response_uri yok);
   * `expected_origins` imzalı istekte — başka bir sitenin isteği yeniden kullanmasını engeller (Ek A.2).
   */
  dcApi?: { expectedOrigins: string[] };
  /**
   * ADR-0012 B: politika kabulde geçiş kartı veriyor → istekte `pass_grant_offered: true`; cüzdan kart için ayrı (istemsiz)
   * anahtar üretir ve yanıta `pass_key` sahiplik kanıtı koyar (a3/WL13). Yoksa kart belge anahtarına bağlanır.
   */
  passGrantOffered?: boolean;
}): Promise<PresentationRequest> {
  const now = p.now ?? Math.floor(Date.now() / 1000);
  const presentationId = "prs_" + randomBytes(9).toString("base64url");
  const nonce = randomBytes(24).toString("base64url"); // ≥128 bit, tek kullanımlık (PV10)
  const state = randomBytes(12).toString("base64url");
  const enc = await generateKeyPair("ECDH-ES", { crv: "P-256", extractable: true });
  const encPublicJwk = {
    ...(await exportJWK(enc.publicKey)),
    use: "enc",
    alg: "ECDH-ES",
    kid: `enc-${presentationId}`,
  } as JWK;
  const expiresAt = now + (p.ttlSec ?? 300);
  const requestJwt = await new SignJWT({
    client_id: p.signer.clientId,
    response_type: "vp_token",
    ...(p.dcApi
      ? { response_mode: "dc_api.jwt", expected_origins: p.dcApi.expectedOrigins }
      : { response_mode: "direct_post.jwt", response_uri: p.responseUri }),
    nonce,
    state,
    dcql_query: p.dcql,
    client_metadata: {
      jwks: { keys: [encPublicJwk] },
      encrypted_response_enc_values_supported: [...RESPONSE_ENC],
      vp_formats_supported: {
        "dc+sd-jwt": { "sd-jwt_alg_values": ["ES256"], "kb-jwt_alg_values": ["ES256"] },
        mso_mdoc: { issuerauth_alg_values: [-7], deviceauth_alg_values: [-7] }, // COSE ES256
        // ADR-0032: sıfır bilgi ispatlı mdoc (AB TS13); kabul edilen devreler DCQL `meta.zk_system_type`'ta
        mso_mdoc_zk: { issuerauth_alg_values: [-7] },
      },
    },
    ...(p.purpose ? { purpose: p.purpose } : {}),
    ...(p.registrationCerts?.length
      ? {
          verifier_info: p.registrationCerts.map((r) => ({
            format: "registration_cert",
            data: r.jwt,
            ...(r.credentialIds?.length ? { credential_ids: r.credentialIds } : {}),
          })),
        }
      : {}),
    ...(p.onBehalfOf && p.onBehalfOf !== p.signer.clientId ? { tamga_on_behalf_of: p.onBehalfOf } : {}),
    ...(p.passGrantOffered ? { pass_grant_offered: true } : {}),
  })
    .setProtectedHeader({ alg: "ES256", typ: REQUEST_TYP, x5c: [derToB64(p.signer.leafDer)] })
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .setAudience("https://self-issued.me/v2")
    .sign(p.signer.key);
  const requestUri = `${p.requestUriBase.replace(/\/$/, "")}/${presentationId}`;
  const qrPayload = `openid4vp://?client_id=${encodeURIComponent(p.signer.clientId)}&request_uri=${encodeURIComponent(requestUri)}`;
  return {
    presentationId,
    nonce,
    state,
    requestJwt,
    requestUri,
    qrPayload,
    encPrivateKey: enc.privateKey as KeyLike,
    encPublicJwk,
    encJwkThumbprint: new Uint8Array(Buffer.from(await calculateJwkThumbprint(encPublicJwk, "sha256"), "base64url")),
    expiresAt,
    dcql: p.dcql,
    ...(p.dcApi ? { dcApiRequest: { protocol: "openid4vp-v1-signed" as const, data: { request: requestJwt } } } : {}),
  };
}

export interface DecryptedResponse {
  vp_token: Record<string, string[]>;
  state?: string;
  /** a3/WL13: geçiş kartı anahtarının sahiplik kanıtı (tamga-pass-key+jwt); `PassRegistry.issue` doğrular */
  pass_key?: string;
}
export async function decryptResponse(jwe: string, encPrivateKey: KeyLike): Promise<DecryptedResponse> {
  const { plaintext, protectedHeader } = await compactDecrypt(jwe, encPrivateKey, {
    keyManagementAlgorithms: ["ECDH-ES"],
    contentEncryptionAlgorithms: [...RESPONSE_ENC],
  });
  if (protectedHeader.alg !== "ECDH-ES" || !(RESPONSE_ENC as readonly string[]).includes(String(protectedHeader.enc)))
    throw new Error("JWE alg/enc outside the profile");
  let body: DecryptedResponse;
  try {
    body = JSON.parse(new TextDecoder().decode(plaintext)) as DecryptedResponse;
  } catch {
    throw new Error("response body is not JSON");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("response body is not an object");
  // OpenID4VP 1.0 §8.1 (DCQL): vp_token = { <sorgu kimliği>: [sunum, …] } — her değer boş olmayan dizelerden dizi
  if (!body.vp_token || typeof body.vp_token !== "object" || Array.isArray(body.vp_token))
    throw new Error("vp_token missing");
  for (const [k, v] of Object.entries(body.vp_token))
    if (!Array.isArray(v) || !v.length || v.some((x) => typeof x !== "string" || !x))
      throw new Error(`vp_token.${k} must be a non-empty array of strings`);
  if (body.state !== undefined && typeof body.state !== "string") throw new Error("state must be a string");
  if (body.pass_key !== undefined && typeof body.pass_key !== "string") throw new Error("pass_key must be a string");
  return body;
}
