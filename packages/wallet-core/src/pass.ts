/**
 * Geçiş kartı (ADR-0012 B yolu; WL12–WL14): kayıtlı RP'nin verdiği `pass_grant` cüzdanda saklanır; gösterimde cüzdan
 * kopya anahtarıyla 60 sn ömürlü, kişisel veri içermeyen `tamga-pass+jwt` jetonu üretir. QR = kompakt JWS.
 * Faz 1'de (ISO 18013-5) bu modül emekliye ayrılır; ekran aynı kalır.
 *
 * 0.8.3 (ikinci inceleme): izin saklanmadan önce denetlenir — rıza süresi tavanı (WL13: ≤ 6 ay), `aud` biçimi (ADR-0034 CI5:
 * RP'nin `dns_name`'i) her zaman; iznin imzası, `cnf_kid` ↔ cüzdanın kart anahtarı ve RP'nin güven listesindeki kaydı çağıran
 * girdilerini verdiğinde (`PassGrantChecks`).
 */
import { b64Decode, b64u } from "./b64.js";
import { decodeJwt, signJwt, verifyJwt } from "./jws.js";
import { jwkThumbprint } from "./jwe.js";
import type { KeyProvider, PublicJwk } from "./keys.js";
import { certFingerprintHex, p256PointFromCertDer } from "./sdjwt.js";
import type { TrustSource } from "@tamga-network/trust/core";

export const PASS_TOKEN_TYP = "tamga-pass+jwt";
export const PASS_GRANT_TYP = "tamga-pass-grant+jwt";
export const PASS_TOKEN_TTL_SEC = 60;
/**
 * WL13 / ADR-0012 K8: kayıt anında verilen rızanın azami süresi — 6 ay (en uzun altı takvim ayı = 184 gün). Bundan uzun izin
 * saklanmaz. Tek kullanımlık bilet (ADR-0012 K4: `single_use`, `exp` = etkinlik bitişi) ilk geçişte tükendiği için tavana tabi
 * değildir.
 */
export const PASS_GRANT_MAX_VALIDITY_SEC = 184 * 86400;
/** İznin `iat` / `exp` karşılaştırmalarında saat kayması toleransı (sn) */
const PASS_GRANT_SKEW_SEC = 60;

/**
 * İzin saklanırken görülen, akışı durdurmayan uyarılar. `aud_not_dns_name` (ADR-0034 CI5): kart jetonunun `aud`'u RP'nin kalıcı
 * alan adı değil, `x509_hash:` istemci kimliği — RP erişim sertifikasını yenileyince kart geçmez (RP `audience` vermemiş ya da
 * kayıt çözülememiş). Reddedilmez: eski RP kurulumları bu biçimi üretir.
 */
export type PassGrantWarning = "aud_not_dns_name";

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
  /** 0.8.3: saklama anında görülen uyarılar (yoksa alan yok) */
  warnings?: PassGrantWarning[];
}

/** RP'nin güven listesindeki kaydını sorgulamak için gereken en küçük kaynak (`fetchTrustSource(...).source` bunu karşılar). */
export type PassTrustSource = Pick<TrustSource, "relyingParty" | "relyingPartyByDnsName" | "terminalGroup">;

/** `parsePassGrant` için isteğe bağlı denetim girdileri (0.8.3). Verilen her girdi zorunlu denetime dönüşür. */
export interface PassGrantChecks {
  /** Unix saniyesi (varsayılan şimdi) — süre tavanı ve süre denetimleri */
  now?: number;
  /**
   * İsteği imzalayan erişim sertifikasının SHA-256 parmak izi (`VpRequest.leafFingerprint`). Verilirse iznin imzası başlıktaki
   * `x5c` yaprağıyla doğrulanır ve yaprak bu sertifika olmalıdır — izni sunumu alan RP'nin kendisi imzalamıştır.
   */
  signerFingerprint?: string;
  /**
   * Cüzdanın kart anahtarının açık anahtarı (`keys.publicKey(keyRef)`). Verilirse iznin `cnf_kid`'i bu anahtarın RFC 7638
   * parmak izi olmalıdır — başka bir anahtara bağlanmış izin saklanmaz (jeton zaten terminalde geçmezdi).
   */
  cnf?: PublicJwk;
  /**
   * WL13: imzası doğrulanmış güven kaynağı. Verilirse kartın RP'si (`aud`) listede kayıtlı ve `ACTIVE` olmalı; kapı grubu listede
   * tanımlıysa etkin ve bu RP'ye ait olmalıdır (listede tanımlı olmayan grup kabul edilir: grup kaydı isteğe bağlıdır).
   */
  trust?: PassTrustSource;
}

const DNS_NAME_RE = /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;
const X509_HASH_RE = /^x509_hash:[A-Za-z0-9_-]{43}$/;

/** WL13: kartın RP'si güven listesinde kayıtlı ve etkin mi; kapı grubu (listeliyse) etkin ve o RP'nin mi. Değilse hata. */
function assertPassRpRegistered(trust: PassTrustSource, rpClientId: string, terminalGroup: string): void {
  const rp = (rpClientId.includes(":") ? trust.relyingParty(rpClientId) : trust.relyingPartyByDnsName(rpClientId)) as {
    dns_name?: string;
    status?: string;
  } | null;
  if (!rp || rp.status !== "ACTIVE")
    throw new Error("access pass: the verifier is not registered and active in the trusted list (WL13)");
  const group = trust.terminalGroup?.(terminalGroup);
  if (group && (!group.active || group.rp_dns_name !== rp.dns_name))
    throw new Error("access pass: the terminal group is not active for this verifier in the trusted list (WL13)");
}

/**
 * RP'den gelen grant JWS'ini çözer ve saklanabilir kayda çevirir. Her zaman: tür, zorunlu alanlar, süre (geçmiş `exp` ret),
 * WL13 rıza süresi tavanı (`exp` − `iat` ve `exp` − şimdi ≤ 6 ay; tek kullanımlık bilet hariç) ve `aud` biçimi (ADR-0034 CI5:
 * alan adı; `x509_hash:` uyarıyla; başka biçim ret). `checks` verilirse ayrıca imza, `cnf_kid` ve güven listesi kaydı.
 * `checks` verilmezse imza DOĞRULANMAZ (0.8.2 davranışı: terminal doğrular; cüzdan izni JWE/TLS kanalından aldı) — cüzdan
 * `signerFingerprint` ve `cnf` vermelidir.
 */
export function parsePassGrant(
  jws: string,
  ctx: { rpClientId: string; rpName: string; credentialId: string; keyRef: string },
  checks: PassGrantChecks = {},
): PassGrant {
  const d = decodeJwt(jws);
  if (d.header.typ !== PASS_GRANT_TYP) throw new Error("pass_grant: unexpected typ");
  if (checks.signerFingerprint !== undefined) {
    const x5c = d.header.x5c as unknown;
    const leaf = Array.isArray(x5c) && typeof x5c[0] === "string" ? b64Decode(x5c[0]) : null;
    if (!leaf || certFingerprintHex(leaf) !== checks.signerFingerprint.toLowerCase())
      throw new Error("pass_grant: signer is not the certificate that signed the request");
    try {
      verifyJwt(jws, p256PointFromCertDer(leaf));
    } catch {
      throw new Error("pass_grant: invalid signature");
    }
  }
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
  if (typeof p.exp !== "number" || (p.iat !== undefined && typeof p.iat !== "number"))
    throw new Error("pass_grant: invalid time fields");
  const now = checks.now ?? Math.floor(Date.now() / 1000);
  if (p.exp <= now) throw new Error("pass_grant: expired");
  // WL13: rıza süreli — ileri tarihli `iat` tavanı aşmanın yolu olmasın diye süre hem `iat`'a hem şimdiye göre ölçülür
  const from = Math.min(p.iat ?? now, now);
  if (!p.single_use && p.exp - from > PASS_GRANT_MAX_VALIDITY_SEC + PASS_GRANT_SKEW_SEC)
    throw new Error("pass_grant: consent period longer than 6 months (WL13)");
  if (checks.cnf && p.cnf_kid !== b64u(jwkThumbprint(checks.cnf)))
    throw new Error("pass_grant: cnf_kid is not this wallet's pass key");
  // ADR-0034: kart jetonunun aud'u grant'taki aud (RP'nin kalıcı alan adı); yoksa isteğin RP kimliği
  const rpClientId = typeof p.aud === "string" && p.aud ? p.aud : ctx.rpClientId;
  // CI5: `aud` RP'nin `dns_name`'idir. `x509_hash:` (kalıcı olmayan) biçim uyarıyla saklanır; başka biçim jetona girmez.
  const dnsAud = DNS_NAME_RE.test(rpClientId);
  if (!dnsAud && !X509_HASH_RE.test(rpClientId)) throw new Error("pass_grant: aud is not a domain name (ADR-0034)");
  if (checks.trust) assertPassRpRegistered(checks.trust, rpClientId, p.terminal_group);
  return {
    ...(p.single_use ? { singleUse: true } : {}),
    ...(dnsAud ? {} : { warnings: ["aud_not_dns_name"] as PassGrantWarning[] }),
    passId: p.pass_id,
    rpClientId,
    rpName: ctx.rpName,
    terminalGroup: p.terminal_group,
    credentialId: ctx.credentialId,
    keyRef: ctx.keyRef,
    cnfKid: p.cnf_kid,
    validUntil: p.exp,
    grantJws: jws,
    issuedAt: p.iat ?? now,
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

/**
 * WL12: yalnızca iss/aud/iat/exp/jti; belge içeriği yok. `opts.trust` (0.8.3; WL13): imzası doğrulanmış güven kaynağı verilirse
 * kartın RP'si o anda listede kayıtlı ve etkin değilse jeton ÜRETİLMEZ (listeden çıkan RP'nin kartı `exp`'e kadar sürmez).
 * Çevrimdışı gösterimde kaynak verilmez; kart `validUntil`'e kadar çalışır (ADR-0012 K2: terminal çevrimdışı doğrular).
 */
export async function mintPassToken(
  grant: PassGrant,
  keys: KeyProvider,
  randomBytes: (n: number) => Uint8Array,
  nowSec = Math.floor(Date.now() / 1000),
  opts: { trust?: PassTrustSource } = {},
): Promise<{ token: string; exp: number }> {
  if (nowSec > grant.validUntil) throw new Error("The access pass has expired; register with the institution again.");
  if (opts.trust) assertPassRpRegistered(opts.trust, grant.rpClientId, grant.terminalGroup);
  const exp = nowSec + PASS_TOKEN_TTL_SEC;
  const token = await signJwt(
    { typ: PASS_TOKEN_TYP, kid: grant.cnfKid },
    { iss: grant.passId, aud: grant.rpClientId, iat: nowSec, exp, jti: b64u(randomBytes(12)) },
    keys,
    grant.keyRef,
  );
  return { token, exp };
}
