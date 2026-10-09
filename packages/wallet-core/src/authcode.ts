/**
 * OpenID4VCI authorization code akışı — cüzdan tarafı (SPEC-PROTO-0001 v1.2 §12; ADR-0011 K3: cüzdan-başlatmalı ihraç).
 *  PAR + PKCE S256 · istemci kimliği = WUA (OAuth-Client-Attestation + PoP başlıkları PAR ve token'da) · redirect_uri cüzdanın
 *  İki yetkilendirme biçimi: (a) tarayıcı — Tamga kimlik servisi Didit'e yönlendirir, geri dönüş URL'inde code;
 *  (b) satır içi sunum — kurum issuer'ı `Accept: application/json` ile OpenID4VP isteği döner, cüzdan mevcut sunum akışını çalıştırır,
 *      response'daki redirect_uri code taşır. Her iki durumda son adım exchangeCode → obtainCredential.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { b64u, utf8 } from "./b64.js";
import { WalletError, type Http, readJson } from "./http.js";
import type { KeyProvider } from "./keys.js";
import { clientAttestationPop, type WuaRecord } from "./wua.js";
import { fetchIssuerMetadata, obtainCredential, type IssuerMetadata, type RedeemOutput } from "./oid4vci.js";
import { checkIssuerRegistration } from "./wrprc.js";
import { dpopRequest, newDpopSigner } from "./dpop.js";

export const AUTH_CODE_GRANT = "authorization_code";
const form = (o: Record<string, string>) =>
  Object.entries(o)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
const parseQuery = (s: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const kv of s.split("&")) {
    const i = kv.indexOf("=");
    if (i <= 0) continue;
    try {
      out[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, " "));
    } catch {
      throw new WalletError("issuer_error", "callback address malformed (percent-encoding)");
    }
  }
  return out;
};

export interface Pkce {
  verifier: string;
  challenge: string;
}
export function pkce(randomBytes: (n: number) => Uint8Array): Pkce {
  const verifier = b64u(randomBytes(32));
  return { verifier, challenge: b64u(sha256(utf8(verifier))) };
}

export interface AuthServerMetadata {
  issuer: string;
  token_endpoint: string;
  authorization_endpoint?: string;
  pushed_authorization_request_endpoint?: string;
  grant_types_supported?: string[];
  /** RFC 9207: true ise yetki yanıtında `iss` zorunlu */
  authorization_response_iss_parameter_supported?: boolean;
}
export function authServerMetadataUrl(credentialIssuer: string): string {
  const m = /^(https?:\/\/[^/]+)(\/.*)?$/.exec(credentialIssuer.replace(/\/$/, ""));
  if (!m) throw new WalletError("invalid_offer", "credential_issuer is not a URL");
  return `${m[1]}/.well-known/oauth-authorization-server${m[2] ?? ""}`;
}
export async function fetchAuthServerMetadata(credentialIssuer: string, http: Http): Promise<AuthServerMetadata> {
  const r = await http(authServerMetadataUrl(credentialIssuer));
  if (r.status !== 200)
    throw new WalletError("issuer_error", `authorization server metadata could not be fetched (${r.status})`);
  return (await readJson(r, "yetkilendirme sunucusu")) as AuthServerMetadata;
}

export interface AuthStart {
  issuer: string;
  vct: string;
  redirectUri: string;
  state: string;
  pkce: Pkce;
  requestUri: string;
  authorizeUrl: string;
  metadata: IssuerMetadata;
  as: AuthServerMetadata;
}
export interface StartInput {
  issuer: string;
  vct: string;
  redirectUri: string;
  keys: KeyProvider;
  http: Http;
  wua: WuaRecord;
  randomBytes: (n: number) => Uint8Array;
  now?: number;
  metadata?: IssuerMetadata;
  /** ADR-0020: kimliğe bağlı teklifin issuer_state'i */
  issuerState?: string;
  /** ISSU_32: kurumun listedeki sertifika parmak izi(leri) — verilirse imzalı metadata istenir ve doğrulanır */
  signerFingerprints?: string[];
  /** ARF RPRC_22a/23: LOTL kayıt kurumu anahtarları — verilirse metadata'daki issuer_info denetlenir */
  registrarKeys?: string[];
  /**
   * PAR gövdesine eklenen, belge verene özel ek alanlar (ADR-0039: `identity_presentation` — kimlik belgesinin SD-JWT VC + KB-JWT
   * sunumu, aud = belge veren, nonce = belge verenin /nonce ucundan). Standart alanların üzerine yazamaz.
   */
  parExtra?: Record<string, string>;
}

export async function wuaHeaders(p: {
  keys: KeyProvider;
  wua: WuaRecord;
  aud: string;
  now?: number;
  randomBytes?: (n: number) => Uint8Array;
}): Promise<Record<string, string>> {
  return {
    "oauth-client-attestation": p.wua.jwt,
    "oauth-client-attestation-pop": await clientAttestationPop({
      keys: p.keys,
      wua: p.wua,
      aud: p.aud,
      now: p.now,
      randomBytes: p.randomBytes,
    }),
  };
}

/** PAR: cüzdan istediği tipi, redirect_uri'sini ve PKCE meydan okumasını issuer'a iletir; authorize URL'i döner. */
export async function startAuthorized(p: StartInput): Promise<AuthStart> {
  const nowMs = p.now !== undefined ? p.now * 1000 : Date.now(); // p.now saniye; metadata/kayıt denetimi milisaniye
  const md =
    p.metadata ??
    (await fetchIssuerMetadata(p.issuer, p.http, { signerFingerprints: p.signerFingerprints, now: nowMs }));
  if (p.registrarKeys) {
    const reg = checkIssuerRegistration(md as { issuer_info?: unknown }, p.vct, p.registrarKeys, nowMs);
    if (!reg.valid) throw new WalletError("unsupported", `issuer registration: ${reg.reason}`);
  }
  const cfg = md.credential_configurations_supported[p.vct];
  if (!cfg || cfg.format !== "dc+sd-jwt") throw new WalletError("unsupported", `tip desteklenmiyor: ${p.vct}`);
  const as = await fetchAuthServerMetadata(p.issuer, p.http);
  if (!as.pushed_authorization_request_endpoint || !as.authorization_endpoint)
    throw new WalletError("unsupported", "issuer does not support wallet-initiated issuance (PAR)");
  const pk = pkce(p.randomBytes);
  const state = b64u(p.randomBytes(16));
  const headers = {
    "content-type": "application/x-www-form-urlencoded",
    ...(await wuaHeaders({ keys: p.keys, wua: p.wua, aud: p.issuer, now: p.now, randomBytes: p.randomBytes })),
  };
  const r = await p.http(as.pushed_authorization_request_endpoint, {
    method: "POST",
    headers,
    body: form({
      ...(p.parExtra ?? {}),
      client_id: p.wua.sub,
      response_type: "code",
      redirect_uri: p.redirectUri,
      code_challenge: pk.challenge,
      code_challenge_method: "S256",
      state,
      // HAIP §4.3: tür `scope` ile istenir; kapsam ilan etmeyen issuer'da authorization_details
      ...(cfg.scope
        ? { scope: cfg.scope }
        : {
            authorization_details: JSON.stringify([{ type: "openid_credential", credential_configuration_id: p.vct }]),
          }),
      ...(p.issuerState ? { issuer_state: p.issuerState } : {}),
    }),
  });
  const body = (await readJson(r, "yetkilendirme sunucusu")) as {
    request_uri?: string;
    error?: string;
    error_description?: string;
  };
  if (r.status !== 201 || !body.request_uri)
    throw new WalletError(
      body.error === "invalid_client" ? "unsupported" : "issuer_error",
      `PAR reddedildi: ${body.error_description ?? body.error ?? r.status}`,
    );
  const authorizeUrl = `${as.authorization_endpoint}?client_id=${encodeURIComponent(p.wua.sub)}&request_uri=${encodeURIComponent(body.request_uri)}`;
  return {
    issuer: p.issuer,
    vct: p.vct,
    redirectUri: p.redirectUri,
    state,
    pkce: pk,
    requestUri: body.request_uri,
    authorizeUrl,
    metadata: md,
    as,
  };
}

/** (b) Satır içi yetkilendirme: issuer JSON ile OpenID4VP sunum isteği döner (kurum kimlik eşleştirmesi, ADR-0011 K3). */
export async function authorizeInline(start: AuthStart, http: Http): Promise<{ qrPayload: string }> {
  const r = await http(start.authorizeUrl, { headers: { accept: "application/json" } });
  if (r.status !== 200) throw new WalletError("issuer_error", `authorization could not be started (${r.status})`);
  const body = (await readJson(r, "yetkilendirme sunucusu")) as {
    presentation_request?: { qr_payload: string };
    error?: string;
    error_description?: string;
  };
  if (!body.presentation_request?.qr_payload)
    throw new WalletError("unsupported", body.error_description ?? "issuer returned no inline presentation request");
  return { qrPayload: body.presentation_request.qr_payload };
}

export interface Callback {
  code?: string;
  state?: string;
  /** RFC 9207 */
  iss?: string;
  error?: string;
  errorDescription?: string;
}
/** redirect_uri'ye dönen URL (tarayıcı oturumu veya VP response redirect_uri) → code/state/error. */
export function parseCallback(url: string): Callback {
  const q = url.indexOf("?");
  const h = url.indexOf("#");
  const params = {
    ...(q >= 0 ? parseQuery(url.slice(q + 1, h > q ? h : undefined)) : {}),
    ...(h >= 0 ? parseQuery(url.slice(h + 1)) : {}),
  };
  return {
    code: params.code,
    state: params.state,
    iss: params.iss,
    error: params.error,
    errorDescription: params.error_description,
  };
}

export interface CompleteInput {
  start: AuthStart;
  callbackUrl: string;
  keys: KeyProvider;
  http: Http;
  wua: WuaRecord;
  randomBytes: (n: number) => Uint8Array;
  batch?: number;
  now?: number;
  /** ADR-0025: anahtar kanıtı üretici */
  keyAttestor?: (jwks: import("./keys.js").PublicJwk[]) => Promise<string>;
}
/** code → token (PKCE + WUA) → nonce → N proof → credential(lar). */
export async function completeAuthorized(p: CompleteInput): Promise<RedeemOutput> {
  const cb = parseCallback(p.callbackUrl);
  // RFC 9207 (karıştırma saldırısı): yanıt başka bir yetkilendirme sunucusundan gelmiş olmamalı
  if (
    (cb.iss !== undefined || p.start.as.authorization_response_iss_parameter_supported) &&
    cb.iss?.replace(/\/$/, "") !== p.start.as.issuer.replace(/\/$/, "")
  )
    throw new WalletError("issuer_error", "authorization response iss does not match the authorization server");
  if (cb.error)
    throw new WalletError(
      cb.error === "access_denied" ? "unsupported" : "issuer_error",
      cb.errorDescription ?? cb.error,
    );
  if (!cb.code) throw new WalletError("issuer_error", "no code in the callback");
  if (cb.state !== p.start.state) throw new WalletError("issuer_error", "state mismatch (CSRF)");
  const now = p.now ?? Math.floor(Date.now() / 1000);
  // DPoP (RFC 9449): belirteç bu işlemin anahtarına bağlanır; sunucu nonce isterse bir kez yeniden denenir
  const dpop = await newDpopSigner(p.keys, `dpop.${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`);
  const tr = await dpopRequest(
    p.http,
    dpop,
    p.start.as.token_endpoint,
    {
      method: "POST",
      headers: async () => ({
        "content-type": "application/x-www-form-urlencoded",
        ...(await wuaHeaders({ keys: p.keys, wua: p.wua, aud: p.start.issuer, now, randomBytes: p.randomBytes })),
      }),
      body: form({
        grant_type: AUTH_CODE_GRANT,
        code: cb.code,
        code_verifier: p.start.pkce.verifier,
        redirect_uri: p.start.redirectUri,
        client_id: p.wua.sub,
      }),
    },
    { now, randomBytes: p.randomBytes },
  );
  const tok = (await readJson(tr, "yetkilendirme sunucusu")) as {
    access_token?: string;
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };
  if (tr.status !== 200 || !tok.access_token) {
    await p.keys.delete(dpop.ref).catch(() => {});
    throw new WalletError("issuer_error", `token error: ${tok.error_description ?? tok.error ?? tr.status}`);
  }
  return obtainCredential({
    issuer: p.start.issuer,
    vct: p.start.vct,
    metadata: p.start.metadata,
    accessToken: tok.access_token,
    keys: p.keys,
    http: p.http,
    batch: p.batch,
    keyAttestor: p.keyAttestor,
    now,
    dpop,
    randomBytes: p.randomBytes,
    refreshToken: tok.refresh_token,
    tokenEndpoint: p.start.as.token_endpoint,
  });
}
