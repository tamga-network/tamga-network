/**
 * OpenID4VP istek nesnesi (JAR) üretimi ve şifreli yanıt çözme — verifier tarafı (SPEC-PROTO-0002 §3, §5.3).
 *  İmza ES256, typ oauth-authz-req+jwt, x5c = RP erişim sertifikası + varsa ara sertifikalar (kök hariç; CIR 2025/848 ve ETSI
 *  TS 119 472-2 REDIRECTS_RO-02), korumalı başlıkta `iat` (REDIRECTS_RO-03; gövdede de); client_id `x509_hash:` +
 *  base64url(SHA-256(yaprak DER)) (OpenID4VP 1.0 §5.9.3, HAIP 1.0 §5; ADR-0034) — sertifikadan hesaplanır, elle verilmez.
 *  Yanıt: JWE ECDH-ES/A128GCM ya da A256GCM (HAIP §5: doğrulayıcı ikisini de ilan eder ve kabul eder) → { vp_token, state }.
 *  Şifreleme anahtarı sunum başına efemer (jose, P-256).
 *  ADR-0067 (çekim dalları): `request_uri` her çekildiğinde `createRequestBranch` YENİ bir istek nesnesi üretir — taze `state`
 *  (128 bit; QR'da ve adreslerde yok), taze `nonce`, taze efemer şifreleme anahtarı (HAIP §5 "ephemeral keys per Authorization
 *  Request"); `request_uri_method=post` ile gelen `wallet_nonce` nesneye geri yazılır (OpenID4VP 1.0 §5.10). Yanıtın `kid`'i dalı
 *  da adlandırır (`enc-<sunum>.<dal>`); şifreli hata yanıtı (`error` + `state`, §8.3.1) `openPresentationResponse` ile ayrı döner.
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
import { randomBytes, X509Certificate } from "node:crypto";
import { derToB64, pemToDer, x509HashClientId } from "@tamga-network/core";
import type { DcqlQuery } from "./policy.js";

export const REQUEST_TYP = "oauth-authz-req+jwt";
/** HAIP §5: doğrulayıcının ilan ettiği ve kabul ettiği içerik şifrelemeleri */
export const RESPONSE_ENC = ["A128GCM", "A256GCM"] as const;

export interface RpSigner {
  clientId: string;
  leafDer: Uint8Array;
  /** Yaprağı veren ara sertifikalar (yapraktan köke doğru; KÖK DAHİL DEĞİL) — istek nesnesinin x5c'sine yapraktan sonra girer. */
  chainDer?: Uint8Array[];
  key: KeyLike;
}

const PEM_CERT = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g;
/** Kendinden imzalı (kök) sertifika mı — x5c'ye girmez (REDIRECTS_RO-02). */
function selfSigned(der: Uint8Array): boolean {
  try {
    const c = new X509Certificate(der);
    return c.issuer === c.subject && c.verify(c.publicKey);
  } catch {
    return false;
  }
}

/**
 * ADR-0034: `clientId` erişim sertifikasından (`x509_hash`) hesaplanır; listedeki kaydın `client_id`'siyle aynıdır.
 * `certPem` tek sertifika ya da zincir dosyası olabilir (ilki yaprak, sonrakiler ara sertifikalar); `intermediatePems` ek ara
 * sertifikalardır. Yaprak kökçe doğrudan verilmediyse ara sertifikalar x5c'ye girer (REDIRECTS_RO-02); kendinden imzalı kök atılır.
 */
export async function pemRpSigner(
  privateKeyPem: string,
  certPem: string,
  intermediatePems: string[] = [],
): Promise<RpSigner> {
  const blocks = certPem.match(PEM_CERT) ?? [certPem];
  const leafDer = pemToDer(blocks[0]);
  const chainDer = [...blocks.slice(1), ...intermediatePems.flatMap((p) => p.match(PEM_CERT) ?? [p])]
    .map(pemToDer)
    .filter((d) => !selfSigned(d));
  return {
    clientId: x509HashClientId(leafDer),
    leafDer,
    ...(chainDer.length ? { chainDer } : {}),
    key: (await importPKCS8(privateKeyPem, "ES256")) as KeyLike,
  };
}

/**
 * ADR-0067 K1: `request_uri`'nin bir çekimi — kendi istek nesnesi, `state`'i, `nonce`'u ve efemer şifreleme anahtarı. Cüzdanın
 * yanıtı (sunum ya da ret) yalnız kendi dalını etkiler; `state` yalnız bu dalın istek nesnesinde geçer.
 */
export interface RequestBranch {
  /** Dal kimliği (sunum içinde benzersiz, gizli değil): şifreleme anahtarının `kid`'inde `enc-<sunum>.<dal>`. */
  branchId: string;
  nonce: string;
  state: string;
  requestJwt: string;
  encPrivateKey: KeyLike;
  encPublicJwk: JWK;
  /** RFC 7638 SHA-256 parmak izi (mdoc SessionTranscript — OpenID4VP 1.0 Ek B.2.6.1). */
  encJwkThumbprint: Uint8Array;
  /** Çekim zamanı (sn). */
  createdAt: number;
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
  /**
   * `dcApi` verildiyse: `navigator.credentials.get({ digital: { requests: [dcApiRequest] } })` girdisi. `requestJwt` (QR /
   * "cüzdanda aç", `request_uri` ile alınan) HER ZAMAN cihazlar arası nesnedir (`direct_post.jwt` + `response_uri`); DC API'nin
   * nesnesi ayrıdır (`dc_api.jwt` + `expected_origins`) ve kendi şifreleme anahtarını taşır (`dcApi`).
   */
  dcApiRequest?: { protocol: "openid4vp-v1-signed"; data: { request: string } };
  /**
   * 0.6.0: aynı sunumun ikinci istek nesnesi (tarayıcı DC API yolu). Nonce ve state ortaktır (tek kullanım iki yol için
   * birdir); şifreleme anahtarı ayrıdır — yanıtın hangi anahtarla açıldığı yolu belirler (`decryptPresentationResponse`).
   */
  dcApi?: {
    requestJwt: string;
    expectedOrigins: string[];
    encPrivateKey: KeyLike;
    encPublicJwk: JWK;
    encJwkThumbprint: Uint8Array;
  };
}

/** Yanıtın geldiği yol: cihazlar arası (QR / bağlantı, `direct_post.jwt`) ya da tarayıcı DC API'si (`dc_api.jwt`). */
export type ResponsePath = "cross_device" | "dc_api";

/**
 * Şifreleme anahtarının `kid`'i: cihazlar arası `enc-<sunum>` (çekim dalında `enc-<sunum>.<dal>`, ADR-0067), DC API
 * `enc-dc-<sunum>` (sunum kimliği `prs_` ile başlar; base64url kimliklerde `.` yoktur).
 */
export const encKid = (presentationId: string, path: ResponsePath = "cross_device", branchId?: string) =>
  path === "dc_api" ? `enc-dc-${presentationId}` : `enc-${presentationId}${branchId ? `.${branchId}` : ""}`;

/** JWE başlığındaki `kid`'den sunum kimliği, yol ve (varsa) çekim dalı (`kid` yoksa ya da biçim dışıysa `null`). */
export function responseKidOf(jwe: string): { presentationId: string; path: ResponsePath; branchId?: string } | null {
  try {
    const h = JSON.parse(Buffer.from(jwe.split(".")[0], "base64url").toString("utf8")) as { kid?: unknown };
    const kid = typeof h.kid === "string" ? h.kid : "";
    if (kid.startsWith("enc-dc-")) return { presentationId: kid.slice(7), path: "dc_api" };
    if (kid.startsWith("enc-")) {
      const rest = kid.slice(4);
      const dot = rest.indexOf(".");
      if (dot < 0) return { presentationId: rest, path: "cross_device" };
      const branchId = rest.slice(dot + 1);
      if (!branchId || branchId.includes(".")) return null;
      return { presentationId: rest.slice(0, dot), path: "cross_device", branchId };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * OpenID4VP 1.0 §5.1 `vp_formats_supported`: yalnız bu isteğin DCQL sorgusunda geçen biçimler ilan edilir (cüzdan ilan edilen ama
 * istenmeyen bir biçime göre karar vermesin; sorgu ile metadata aynı şeyi söyler). Takma ad sorgusu (`tamga-pseudonym`) bir sunum
 * biçimi değildir. Sorguda hiçbir sunum biçimi yoksa (yalnız takma ad) alan zorunlu olduğu için `dc+sd-jwt` yazılır.
 */
export function vpFormatsFor(dcql: DcqlQuery): Record<string, Record<string, unknown>> {
  const used = new Set(dcql.credentials.map((c) => c.format));
  const out: Record<string, Record<string, unknown>> = {};
  if (used.has("dc+sd-jwt") || ![...used].some((f) => f === "mso_mdoc" || f === "mso_mdoc_zk"))
    out["dc+sd-jwt"] = { "sd-jwt_alg_values": ["ES256"], "kb-jwt_alg_values": ["ES256"] };
  if (used.has("mso_mdoc")) out.mso_mdoc = { issuerauth_alg_values: [-7], deviceauth_alg_values: [-7] }; // COSE ES256
  // ADR-0032: sıfır bilgi ispatlı mdoc (AB TS13); kabul edilen devreler DCQL `meta.zk_system_type`'ta
  if (used.has("mso_mdoc_zk")) out.mso_mdoc_zk = { issuerauth_alg_values: [-7] };
  return out;
}

/** İstek nesnesinin sunum boyunca aynı kalan içeriği (her çekim dalı aynı içerikle yeniden imzalanır). */
export interface RequestContent {
  signer: RpSigner;
  dcql: DcqlQuery;
  responseUri: string;
  /** ADR-0017 K7 */
  onBehalfOf?: string;
  /** ADR-0026 K4 (`verifier_info`) */
  registrationCert?: string;
  /** ADR-0012 B */
  passGrantOffered?: boolean;
}

/** ES256 / `oauth-authz-req+jwt` istek nesnesi (JAR) — ilk istek, DC API nesnesi ve çekim dalları ortak. */
function signRequestObject(
  c: Omit<RequestContent, "responseUri">,
  v: { mode: Record<string, unknown>; jwk: JWK; nonce: string; state: string; now: number; expiresAt: number },
  extra: Record<string, unknown> = {},
): Promise<string> {
  return (
    new SignJWT({
      client_id: c.signer.clientId,
      response_type: "vp_token",
      ...v.mode,
      nonce: v.nonce,
      state: v.state,
      dcql_query: c.dcql,
      client_metadata: {
        jwks: { keys: [v.jwk] },
        encrypted_response_enc_values_supported: [...RESPONSE_ENC],
        vp_formats_supported: vpFormatsFor(c.dcql),
      },
      ...(c.registrationCert ? { verifier_info: [{ format: "registration_cert", data: c.registrationCert }] } : {}),
      ...(c.onBehalfOf && c.onBehalfOf !== c.signer.clientId ? { tamga_on_behalf_of: c.onBehalfOf } : {}),
      ...(c.passGrantOffered ? { pass_grant_offered: true } : {}),
      ...extra,
    })
      // REDIRECTS_RO-02/03: x5c yaprak + ara sertifikalar (kök hariç); iat korumalı başlıkta da
      .setProtectedHeader({
        alg: "ES256",
        typ: REQUEST_TYP,
        x5c: [c.signer.leafDer, ...(c.signer.chainDer ?? [])].map(derToB64),
        iat: v.now,
      })
      .setIssuedAt(v.now)
      .setExpirationTime(v.expiresAt)
      .setAudience("https://self-issued.me/v2")
      .sign(c.signer.key)
  );
}

/** Efemer yanıt şifreleme anahtarı (P-256, ECDH-ES) + RFC 7638 parmak izi. */
async function newEncKey(kid: string) {
  const k = await generateKeyPair("ECDH-ES", { crv: "P-256", extractable: true });
  const jwk = { ...(await exportJWK(k.publicKey)), use: "enc", alg: "ECDH-ES", kid } as JWK;
  const thumb = new Uint8Array(Buffer.from(await calculateJwkThumbprint(jwk, "sha256"), "base64url"));
  return { privateKey: k.privateKey as KeyLike, jwk, thumb };
}

/** `wallet_nonce` (OpenID4VP 1.0 §5.10): görünür ASCII, en çok 256 karakter; bunun dışındaki değer geri yazılmaz. */
export function acceptableWalletNonce(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 && v.length <= 256 && /^[\x21-\x7e]+$/.test(v) ? v : undefined;
}

/**
 * ADR-0067 K1: `request_uri`'nin bir çekimi için yeni istek nesnesi. Her çağrı taze `state` (128 bit), taze `nonce` (192 bit) ve
 * taze efemer şifreleme anahtarı üretir (HAIP §5); içerik (DCQL, kayıt sertifikası, `response_uri`) sunumunkiyle aynıdır, `exp`
 * sunumun bitişidir. `walletNonce` verildiyse (cüzdan `request_uri_method=post` ile çekti) nesnede `wallet_nonce` olarak döner
 * (OpenID4VP 1.0 §5.10). `branchId` verilmezse rastgele üretilir.
 */
export async function createRequestBranch(
  c: RequestContent & {
    presentationId: string;
    expiresAt: number;
    now?: number;
    walletNonce?: string;
    branchId?: string;
  },
): Promise<RequestBranch> {
  const now = c.now ?? Math.floor(Date.now() / 1000);
  const branchId = c.branchId ?? randomBytes(6).toString("base64url");
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(branchId)) throw new Error("branchId must be base64url (1–32 characters)");
  const nonce = randomBytes(24).toString("base64url"); // ≥128 bit, tek kullanımlık (PV10)
  const state = randomBytes(16).toString("base64url"); // 128 bit gizli değer (ADR-0067 FB1)
  const enc = await newEncKey(encKid(c.presentationId, "cross_device", branchId));
  const walletNonce = acceptableWalletNonce(c.walletNonce);
  const requestJwt = await signRequestObject(
    c,
    {
      mode: { response_mode: "direct_post.jwt", response_uri: c.responseUri },
      jwk: enc.jwk,
      nonce,
      state,
      now,
      expiresAt: c.expiresAt,
    },
    walletNonce ? { wallet_nonce: walletNonce } : {},
  );
  return {
    branchId,
    nonce,
    state,
    requestJwt,
    encPrivateKey: enc.privateKey,
    encPublicJwk: enc.jwk,
    encJwkThumbprint: enc.thumb,
    createdAt: now,
  };
}

export async function createPresentationRequest(p: {
  signer: RpSigner;
  dcql: DcqlQuery;
  responseUri: string;
  requestUriBase: string;
  ttlSec?: number;
  now?: number;
  /** ADR-0017 K7: aracı doğrulayıcı bir RP adına istiyorsa asıl RP'nin client_id'si (cüzdan onu gösterir). */
  onBehalfOf?: string;
  /**
   * ADR-0026 K4: isteğin kullanımının kayıt sertifikası (WRPRC, rc-wrp+jwt) → `verifier_info` (OpenID4VP 1.0 §5.1; ETSI TS 119
   * 472-2 RO-13…16, ARF RPRC_19): istek başına TEK sertifika, `format: "registration_cert"`, `data` = WRPRC JWT'nin kendisi,
   * `credential_ids` YOK (sertifika isteğin bütün sorgularını kapsar). RO-16'daki "base64url" JWT'nin kompakt serileştirmesi olarak
   * okunur (JWT zaten base64url bölümlerden oluşur; AB referans uygulaması ve Alman rehberi JWT'yi olduğu gibi koyar).
   * İsteğin amacı (kullanıcıya gösterilen "ne için") bu sertifikanın `purpose` alanıdır (ETSI TS 119 475 intended use); istek
   * nesnesinde ayrı bir `purpose` parametresi YOKTUR — OpenID4VP 1.0 §5.1'de tanımlı değildir (2026-10-27, OpenID öz-testi U1).
   */
  registrationCert?: string;
  /**
   * Tarayıcı Digital Credentials API'si (OpenID4VP 1.0 Ek A): İKİNCİ bir istek nesnesi üretilir — yanıt sayfaya döner
   * (`dc_api.jwt`, response_uri yok); `expected_origins` imzalı istekte, başka bir sitenin isteği yeniden kullanmasını engeller
   * (Ek A.2). `requestJwt` (QR / bağlantı) cihazlar arası kalır: DC API açıkken de telefondaki cüzdan QR'dan tamamlayabilir.
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
  const state = randomBytes(16).toString("base64url"); // 128 bit (ADR-0067 FB1)
  const enc = await newEncKey(encKid(presentationId, "cross_device"));
  const encPublicJwk = enc.jwk;
  const expiresAt = now + (p.ttlSec ?? 300);
  // İki yol, iki nesne (0.6.0): QR / bağlantının nesnesi cihazlar arası (`direct_post.jwt` + response_uri) — telefondaki
  // cüzdan yanıtı oraya gönderir; DC API'nin nesnesi tarayıcıya (`dc_api.jwt` + expected_origins, response_uri yok; Ek A)
  const sign = (mode: Record<string, unknown>, jwk: JWK) =>
    signRequestObject(p, { mode, jwk, nonce, state, now, expiresAt });
  const requestJwt = await sign({ response_mode: "direct_post.jwt", response_uri: p.responseUri }, encPublicJwk);
  const dc = p.dcApi ? await newEncKey(encKid(presentationId, "dc_api")) : undefined;
  const dcRequestJwt =
    p.dcApi && dc
      ? await sign({ response_mode: "dc_api.jwt", expected_origins: p.dcApi.expectedOrigins }, dc.jwk)
      : undefined;
  const requestUri = `${p.requestUriBase.replace(/\/$/, "")}/${presentationId}`;
  const qrPayload = `openid4vp://?client_id=${encodeURIComponent(p.signer.clientId)}&request_uri=${encodeURIComponent(requestUri)}`;
  return {
    presentationId,
    nonce,
    state,
    requestJwt,
    requestUri,
    qrPayload,
    encPrivateKey: enc.privateKey,
    encPublicJwk,
    encJwkThumbprint: enc.thumb,
    expiresAt,
    dcql: p.dcql,
    ...(p.dcApi && dc && dcRequestJwt
      ? {
          dcApiRequest: { protocol: "openid4vp-v1-signed" as const, data: { request: dcRequestJwt } },
          dcApi: {
            requestJwt: dcRequestJwt,
            expectedOrigins: [...p.dcApi.expectedOrigins],
            encPrivateKey: dc.privateKey,
            encPublicJwk: dc.jwk,
            encJwkThumbprint: dc.thumb,
          },
        }
      : {}),
  };
}

export interface DecryptedResponse {
  vp_token: Record<string, string[]>;
  state?: string;
  /** a3/WL13: geçiş kartı anahtarının sahiplik kanıtı (tamga-pass-key+jwt); `PassRegistry.issue` doğrular */
  pass_key?: string;
}
/** JWE'yi profil içinde (ECDH-ES + A128GCM/A256GCM) çözer ve gövdeyi nesne olarak döner; içerik denetimi çağıranda. */
async function openJweObject(jwe: string, encPrivateKey: KeyLike): Promise<Record<string, unknown>> {
  const { plaintext, protectedHeader } = await compactDecrypt(jwe, encPrivateKey, {
    keyManagementAlgorithms: ["ECDH-ES"],
    contentEncryptionAlgorithms: [...RESPONSE_ENC],
  });
  if (protectedHeader.alg !== "ECDH-ES" || !(RESPONSE_ENC as readonly string[]).includes(String(protectedHeader.enc)))
    throw new Error("JWE alg/enc outside the profile");
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    throw new Error("response body is not JSON");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("response body is not an object");
  return body as Record<string, unknown>;
}

/**
 * Şifreli hata yanıtı mı (OpenID4VP 1.0 §8.3.1: `direct_post.jwt`'de hata yanıtı şifreli de gelebilir): `vp_token` yok, `error`
 * boş olmayan dize. Döner `{ error, state }` ya da `null`. `error_description` okunmaz (PV5).
 */
function errorBodyOf(body: Record<string, unknown>): { error: string; state?: string } | null {
  if (body.vp_token !== undefined || typeof body.error !== "string" || !body.error) return null;
  if (body.state !== undefined && typeof body.state !== "string") throw new Error("state must be a string");
  return { error: body.error.slice(0, 64), ...(typeof body.state === "string" ? { state: body.state } : {}) };
}

export async function decryptResponse(jwe: string, encPrivateKey: KeyLike): Promise<DecryptedResponse> {
  return checkResponseBody(await openJweObject(jwe, encPrivateKey));
}

function checkResponseBody(raw: Record<string, unknown>): DecryptedResponse {
  const body = raw as unknown as DecryptedResponse;
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

/**
 * 0.6.0: sunumun yanıtını YOLUNA göre açar. Yol `kid`'den seçilir ama belirleyen anahtardır: cihazlar arası yanıt yalnız
 * cihazlar arası anahtarla, DC API yanıtı yalnız DC API anahtarıyla açılır — bir yolun anahtarıyla şifrelenmiş yanıt öteki
 * yolun kurallarıyla (mdoc SessionTranscript: `responseUri` ya da `origin`) doğrulanamaz. Dönen `binding`, `verifyPresentation`'a
 * olduğu gibi verilir (`responseUri` | `origin` + `encJwkThumbprint`).
 */
export async function decryptPresentationResponse(
  jwe: string,
  req: PresentationRequest,
  responseUri: string,
  branches?: (branchId: string) => RequestBranch | undefined,
): Promise<{
  response: DecryptedResponse;
  path: ResponsePath;
  binding: ResponseBinding;
  /** ADR-0067: yanıtın geldiği çekim dalı (cihazlar arası yolda `kid` dalı adlandırdıysa). */
  branch?: RequestBranch;
}> {
  const opened = await openPresentationResponse(jwe, req, responseUri, branches);
  if (opened.kind === "error") throw new Error("the wallet sent an error response, not a presentation");
  const { kind: _kind, ...rest } = opened;
  return rest;
}

export type ResponseBinding =
  { responseUri: string; encJwkThumbprint: Uint8Array } | { origin: string; encJwkThumbprint: Uint8Array };

/**
 * ADR-0067: yanıtı açar ve şifreli hata yanıtını (OpenID4VP 1.0 §8.3.1) sunumdan ayırır — `kind: "error"` (ret; `state`'i çağıran
 * dalın `state`'iyle karşılaştırır) ya da `kind: "response"`. `kid` bir çekim dalını adlandırıyorsa yanıt YALNIZ o dalın anahtarıyla
 * açılır (`branches` verilmeli; bilinmeyen dal hata); dal adı yoksa ilk istek nesnesinin anahtarıyla.
 */
export async function openPresentationResponse(
  jwe: string,
  req: PresentationRequest,
  responseUri: string,
  branches?: (branchId: string) => RequestBranch | undefined,
): Promise<
  ({ kind: "response"; response: DecryptedResponse } | { kind: "error"; error: string; state?: string }) & {
    path: ResponsePath;
    binding: ResponseBinding;
    branch?: RequestBranch;
  }
> {
  const kid = responseKidOf(jwe);
  if (kid && kid.presentationId !== req.presentationId) throw new Error("response is for another presentation");
  let key: KeyLike;
  let path: ResponsePath = "cross_device";
  let binding: ResponseBinding;
  let branch: RequestBranch | undefined;
  if (kid?.path === "dc_api") {
    if (!req.dcApi) throw new Error("this presentation has no Digital Credentials API request");
    key = req.dcApi.encPrivateKey;
    path = "dc_api";
    binding = { origin: req.dcApi.expectedOrigins[0], encJwkThumbprint: req.dcApi.encJwkThumbprint };
  } else if (kid?.branchId !== undefined) {
    branch = branches?.(kid.branchId);
    if (!branch || branch.branchId !== kid.branchId) throw new Error("unknown request branch");
    key = branch.encPrivateKey;
    binding = { responseUri, encJwkThumbprint: branch.encJwkThumbprint };
  } else {
    key = req.encPrivateKey;
    binding = { responseUri, encJwkThumbprint: req.encJwkThumbprint };
  }
  const raw = await openJweObject(jwe, key);
  const err = errorBodyOf(raw);
  const base = { path, binding, ...(branch ? { branch } : {}) };
  if (err) return { kind: "error", ...err, ...base };
  return { kind: "response", response: checkResponseBody(raw), ...base };
}
