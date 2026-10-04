/**
 * Geçiş kartı (ADR-0012 B yolu; WL12–WL14): kayıtlı RP'nin verdiği `pass_grant` cüzdanda saklanır; gösterimde cüzdan
 * kopya anahtarıyla 60 sn ömürlü, kişisel veri içermeyen `tamga-pass+jwt` jetonu üretir. QR = kompakt JWS.
 * Faz 1'de (ISO 18013-5) bu modül emekliye ayrılır; ekran aynı kalır.
 */
import { b64u } from "./b64.js";
import { decodeJwt, signJwt } from "./jws.js";
import type { KeyProvider } from "./keys.js";

export const PASS_TOKEN_TYP = "tamga-pass+jwt";
export const PASS_GRANT_TYP = "tamga-pass-grant+jwt";
export const PASS_TOKEN_TTL_SEC = 60;

export interface PassGrant {
  passId: string;
  rpClientId: string;
  rpName: string;
  terminalGroup: string;
  credentialId: string;
  keyRef: string;
  cnfKid: string;
  validUntil: number; // epoch sn
  grantJws: string; // RP imzalı; terminal tarafı doğrular
  issuedAt: number;
  /** Tek kullanımlık (bilet): ilk GEÇ'te tüketilir; ekran bunu söyler. */
  singleUse?: boolean;
}

/** RP'den gelen grant JWS'ini çözer (imza doğrulaması terminalin işi; cüzdan JWE/TLS kanalından aldı). */
export function parsePassGrant(
  jws: string,
  ctx: { rpClientId: string; rpName: string; credentialId: string; keyRef: string },
): PassGrant {
  const d = decodeJwt(jws);
  if (d.header.typ !== PASS_GRANT_TYP) throw new Error("pass_grant: unexpected typ");
  const p = d.payload as {
    pass_id?: string;
    cnf_kid?: string;
    terminal_group?: string;
    exp?: number;
    aud?: string;
    iat?: number;
    single_use?: boolean;
  };
  if (!p.pass_id || !p.cnf_kid || !p.terminal_group || !p.exp) throw new Error("pass_grant: fields missing");
  return {
    ...(p.single_use ? { singleUse: true } : {}),
    passId: p.pass_id,
    // ADR-0034: kart jetonunun aud'u grant'taki aud (RP'nin kalıcı alan adı); yoksa isteğin RP kimliği
    rpClientId: typeof p.aud === "string" && p.aud ? p.aud : ctx.rpClientId,
    rpName: ctx.rpName,
    terminalGroup: p.terminal_group,
    credentialId: ctx.credentialId,
    keyRef: ctx.keyRef,
    cnfKid: p.cnf_kid,
    validUntil: p.exp,
    grantJws: jws,
    issuedAt: p.iat ?? Math.floor(Date.now() / 1000),
  };
}

/**
 * Geçiş kartı anahtarı (a3 / WL13): kart jetonu belge anahtarıyla DEĞİL, ayrı bir donanım anahtarıyla imzalanır — `device_unlocked`
 * politikası (yalnız kilit açıkken erişilebilir; biyometri koşulu yok). Jeton kişisel veri taşımaz, kayıt onayla yapıldı; kartın
 * 60 sn'lik yenilemeleri istem çıkarmaz. Cüzdan, istek nesnesi `pass_grant_offered: true` dediğinde anahtarı üretir, yanıt
 * yüküne `pass_key` (bu anahtarla imzalı, nonce'a bağlı sahiplik kanıtı) koyar; RP grant'ı bu anahtara bağlar.
 */
export const PASS_KEY_TYP = "tamga-pass-key+jwt";
const PASS_KEY_PREFIX = "pass.";
export const newPassKeyRef = (randomBytes: (n: number) => Uint8Array) => PASS_KEY_PREFIX + b64u(randomBytes(9));
/** Kart anahtarı mı (silinebilir) — belge kopyası anahtarı değil (eski kayıtlarda kart kopya anahtarına bağlıydı). */
export const isPassKeyRef = (ref: string) => ref.startsWith(PASS_KEY_PREFIX);
/** Sahiplik kanıtı: başlıkta açık anahtar (jwk), gövdede aud = RP client_id, nonce = isteğin nonce'u. */
export async function makePassKeyProof(p: {
  keys: KeyProvider;
  ref: string;
  clientId: string;
  nonce: string;
  nowSec?: number;
}): Promise<string> {
  const jwk = await p.keys.publicKey(p.ref);
  if (!jwk) throw new Error(`pass key not found: ${p.ref}`);
  return signJwt(
    { typ: PASS_KEY_TYP, jwk },
    { aud: p.clientId, nonce: p.nonce, iat: p.nowSec ?? Math.floor(Date.now() / 1000) },
    p.keys,
    p.ref,
  );
}

/** WL12: yalnızca iss/aud/iat/exp/jti; belge içeriği yok. */
export async function mintPassToken(
  grant: PassGrant,
  keys: KeyProvider,
  randomBytes: (n: number) => Uint8Array,
  nowSec = Math.floor(Date.now() / 1000),
): Promise<{ token: string; exp: number }> {
  if (nowSec > grant.validUntil) throw new Error("The access pass has expired; register with the institution again.");
  const exp = nowSec + PASS_TOKEN_TTL_SEC;
  const token = await signJwt(
    { typ: PASS_TOKEN_TYP, kid: grant.cnfKid },
    { iss: grant.passId, aud: grant.rpClientId, iat: nowSec, exp, jti: b64u(randomBytes(12)) },
    keys,
    grant.keyRef,
  );
  return { token, exp };
}
