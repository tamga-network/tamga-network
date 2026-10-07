/**
 * OpenID4VCI authorization code akışı — sunucu tarafı saf yardımcılar (SPEC-PROTO-0001 v1.2 §12, ADR-0011 K3).
 *  PAR (RFC 9126) + PKCE S256 (RFC 7636) zorunlu · istemci kimliği = Wallet Unit Attestation (`sub`) — client_secret yok
 *  istenen vct: `scope` (HAIP §4.3; kapsam değeri = vct) ya da authorization_details · code tek kullanımlık, ≤ 60 s ·
 *  redirect_uri PAR'da bağlanır, /authorize'da değiştirilemez · yetki yanıtında `iss` (RFC 9207; HAIP → FAPI2)
 *  Kimlik ispatı yetkilendirme sunucusunda: Tamga kimlik servisinde IDV (Didit), kurum issuer'ında IdentityAttestation SUNUMU.
 */
import { createHash, randomBytes } from "node:crypto";

export const AUTH_CODE_GRANT = "authorization_code";
export const PAR_TTL_SEC = 600; // cüzdan → tarayıcı/sunum → dönüş: 10 dk
export const AUTH_CODE_TTL_SEC = 60;

const opaque = (n = 24) => randomBytes(n).toString("base64url");

export interface ParRequest {
  requestUri: string; // urn:ietf:params:oauth:request_uri:<opak>
  clientId: string; // WIA sub — cüzdan çözümünün ortak değeri (HAIP 1.0 §4.4.1, ADR-0034)
  redirectUri: string;
  codeChallenge: string; // S256
  vct: string; // scope ya da authorization_details[0].credential_configuration_id
  state?: string;
  /** RFC 9207: yetki yanıtına eklenen yetkilendirme sunucusu kimliği (AS metadata `issuer`) */
  issuer?: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
  /** akış durumu: yetkilendirme başladı mı, kimlik eşleşti mi (subjectRef opak) */
  subjectRef?: string;
  binding?: string;
  claims?: Record<string, unknown>;
  code?: string;
  codeExpiresAt?: number;
  codeUsed?: boolean;
  walletAttestation?: { solution_id: string; key_storage: string };
  /** ADR-0020: kimliğe bağlı teklifin kimliği (OpenID4VCI issuer_state) */
  issuerState?: string;
  ext?: Record<string, string>; // sunucuya özel (ör. IDV oturum kimliği, VP presentation id) — kişisel veri yok
}

export interface ParInput {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod?: string;
  authorizationDetails?: unknown;
  /** HAIP §4.3: kapsam; Tamga'da kapsam değeri belge türünün vct'sidir (metadata `scope`) */
  scope?: string;
  state?: string;
  /** RFC 9207: AS kimliği; verilirse yetki yanıtlarına `iss` eklenir */
  issuer?: string;
  now?: number;
  walletAttestation?: ParRequest["walletAttestation"];
  /** ADR-0020: teklifteki issuer_state (kimliğe bağlı teklif) */
  issuerState?: string;
  /**
   * İzinli dönüş adresleri (RFC 9126 §2.4 / RFC 9700 §4.1: tam dize eşleşmesi). Dizi ya da istemciye göre (`clientId` → liste)
   * işlev; verilirse ve liste dönerse `redirectUri` listede olmalıdır. Verilmezse yalnız biçim/şema denetimi yapılır.
   */
  allowedRedirectUris?: readonly string[] | ((clientId: string) => readonly string[] | null | undefined);
}
export type ParError = "invalid_request" | "invalid_redirect_uri" | "unsupported_code_challenge";

/** PAR isteğini doğrular ve kaydı üretir (çağıran saklar). */
export function createPar(
  i: ParInput,
): { ok: true; par: ParRequest } | { ok: false; error: ParError; description: string } {
  const now = i.now ?? Math.floor(Date.now() / 1000);
  if (!i.codeChallenge || !/^[A-Za-z0-9_-]{43,128}$/.test(i.codeChallenge))
    return { ok: false, error: "invalid_request", description: "code_challenge missing or malformed" };
  if ((i.codeChallengeMethod ?? "S256") !== "S256")
    return { ok: false, error: "unsupported_code_challenge", description: "only S256 is supported" };
  if (!i.redirectUri || !/^[a-z][a-z0-9+.-]*:\/\//i.test(i.redirectUri))
    return { ok: false, error: "invalid_redirect_uri", description: "redirect_uri must be of the form scheme://…" };
  // Tarayıcıda kod çalıştırabilen şemalar dönüş adresi olamaz (bağlantı olarak gösterilirse XSS)
  if (/^(javascript|data|vbscript|file|blob):/i.test(i.redirectUri.trim()))
    return { ok: false, error: "invalid_redirect_uri", description: "this redirect_uri scheme is not accepted" };
  const allow = typeof i.allowedRedirectUris === "function" ? i.allowedRedirectUris(i.clientId) : i.allowedRedirectUris;
  if (allow && !allow.includes(i.redirectUri))
    return { ok: false, error: "invalid_redirect_uri", description: "redirect_uri is not registered for this client" };
  const ad = Array.isArray(i.authorizationDetails)
    ? (i.authorizationDetails as Array<{ type?: string; credential_configuration_id?: string }>)
    : undefined;
  const adVct = ad?.find((a) => a.type === "openid_credential")?.credential_configuration_id;
  const scopes = typeof i.scope === "string" ? i.scope.split(" ").filter(Boolean) : [];
  if (scopes.length > 1)
    return { ok: false, error: "invalid_request", description: "one credential type per request (scope)" };
  const vct = scopes[0] ?? adVct;
  if (!vct)
    return {
      ok: false,
      error: "invalid_request",
      description: "scope or authorization_details[openid_credential].credential_configuration_id required",
    };
  if (scopes[0] && adVct && adVct !== scopes[0])
    return { ok: false, error: "invalid_request", description: "scope and authorization_details disagree" };
  return {
    ok: true,
    par: {
      requestUri: `urn:ietf:params:oauth:request_uri:${opaque(16)}`,
      clientId: i.clientId,
      redirectUri: i.redirectUri,
      codeChallenge: i.codeChallenge,
      vct,
      state: i.state,
      ...(i.issuer ? { issuer: i.issuer } : {}),
      createdAt: now,
      expiresAt: now + PAR_TTL_SEC,
      used: false,
      walletAttestation: i.walletAttestation,
      ...(typeof i.issuerState === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(i.issuerState)
        ? { issuerState: i.issuerState }
        : {}),
    },
  };
}

/** Kimlik eşleşmesi tamamlandı → tek kullanımlık code. */
export function mintCode(
  par: ParRequest,
  subjectRef: string,
  binding: string,
  now = Math.floor(Date.now() / 1000),
  claims?: Record<string, unknown>,
): string {
  par.subjectRef = subjectRef;
  par.binding = binding;
  if (claims) par.claims = claims;
  par.code = opaque();
  par.codeExpiresAt = now + AUTH_CODE_TTL_SEC;
  par.codeUsed = false;
  return par.code;
}
/** Yetki yanıtının ortak kuyruğu: state + RFC 9207 `iss` (başarılı ve hatalı yanıtta). */
const tail = (par: ParRequest) =>
  `${par.state ? `&state=${encodeURIComponent(par.state)}` : ""}${par.issuer ? `&iss=${encodeURIComponent(par.issuer)}` : ""}`;
const sep = (par: ParRequest) => (par.redirectUri.includes("?") ? "&" : "?");
export const callbackUrl = (par: ParRequest, code: string) =>
  `${par.redirectUri}${sep(par)}code=${encodeURIComponent(code)}${tail(par)}`;
export const errorCallbackUrl = (par: ParRequest, error: string, description: string) =>
  `${par.redirectUri}${sep(par)}error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(description)}${tail(par)}`;

export type CodeError = "invalid_grant" | "invalid_request";
/**
 * Token isteği: code + code_verifier + redirect_uri + istemci (aynı WUA sub). RFC 6749 §4.1.3: PAR'da dönüş adresi verildiyse
 * token isteğinde de aynısı ZORUNLU; istemci kimliği her zaman zorunlu (başka bir cüzdan çalınmış kodu kullanamaz).
 */
export function redeemCode(
  par: ParRequest | undefined,
  p: { code: string; codeVerifier?: string; redirectUri?: string; clientId: string; now?: number },
):
  | { ok: true; accessToken: string; cNonce: string; expiresIn: number }
  | { ok: false; error: CodeError; description: string } {
  const now = p.now ?? Math.floor(Date.now() / 1000);
  if (!par || par.code !== p.code) return { ok: false, error: "invalid_grant", description: "code bilinmiyor" };
  if (par.codeUsed) return { ok: false, error: "invalid_grant", description: "code already used" };
  if (!par.codeExpiresAt || now > par.codeExpiresAt)
    return { ok: false, error: "invalid_grant", description: "code expired" };
  if (par.redirectUri && p.redirectUri !== par.redirectUri)
    return { ok: false, error: "invalid_grant", description: "redirect_uri missing or does not match the PAR" };
  if (!p.clientId || p.clientId !== par.clientId)
    return { ok: false, error: "invalid_grant", description: "client (WUA) does not match the PAR" };
  if (!p.codeVerifier) return { ok: false, error: "invalid_request", description: "code_verifier required (PKCE)" };
  const challenge = createHash("sha256").update(p.codeVerifier, "ascii").digest("base64url");
  if (challenge !== par.codeChallenge) {
    par.codeUsed = true;
    return { ok: false, error: "invalid_grant", description: "PKCE verification failed" };
  }
  par.codeUsed = true;
  par.used = true;
  return { ok: true, accessToken: opaque(), cNonce: opaque(16), expiresIn: 300 };
}

/** Bir sunum gövdesinden (verifier claims çıktısı) kurumun eşleştirme anahtarlarını çıkarır; kişisel veri döndürür — çağıran LOGLAMAZ. */
export function identityMatchKeys(claims: Record<string, unknown>): {
  pan?: string;
  birthDate?: string;
  givenName?: string;
  familyName?: string;
} {
  return {
    pan: claims.personal_administrative_number as string | undefined,
    birthDate: claims.birth_date as string | undefined,
    givenName: claims.given_name as string | undefined,
    familyName: claims.family_name as string | undefined,
  };
}
/** Türkçe karakter/duyarsız ad karşılaştırması (ADR-0011 K6). */
export const normName = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/İ/g, "I")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
