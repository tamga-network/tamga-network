/**
 * Wallet Unit Attestation — cüzdan tarafı (SPEC-CRED-0001 §4, DB-16).
 *  Cüzdan örneği bir "örnek anahtarı" üretir (wua.instance, KeyProvider'da), açık anahtarı + kendi beyanını Wallet Provider'a
 *  gönderir; Provider WUA (JWT, x5c = wallet-provider sertifikası) döner. İhraçta token isteğine iki başlık eklenir:
 *  OAuth-Client-Attestation (WUA) + OAuth-Client-Attestation-PoP (örnek anahtarıyla, aud = credential_issuer).
 *  Demo: beyan self-reported (key_storage "software" — S-9/S-14); pilot: App Attest / Play Integrity.
 */
import { randomBytes as nobleRandom } from "@noble/hashes/utils.js";
import { b64u, b64uDecode } from "./b64.js";
import { decodeJwt, signJwt } from "./jws.js";
import type { KeyProvider, KeyStorage, PublicJwk } from "./keys.js";
import { jwkThumbprint } from "./jwe.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { WalletError, type Http, readJson } from "./http.js";
import { lockCodePrehash } from "./lock-code.js";
import { parseStatusToken, statusBitAt } from "./status.js";
import type { TrustSource } from "@tamga-network/trust/core";

export const WUA_TYP = "oauth-client-attestation+jwt";
export const WUA_POP_TYP = "oauth-client-attestation-pop+jwt";
export const WUA_INSTANCE_REF = "wua.instance";

export interface WuaRecord {
  jwt: string;
  sub: string;
  exp: number;
  keyRef: string;
  keyStorage: KeyStorage;
  solutionId: string;
  securityLevel?: string;
  provider: string;
}

export async function requestWua(p: {
  providerBase: string;
  keys: KeyProvider;
  http: Http;
  keyRef?: string;
  solutionId?: string;
  appVersion: string;
  platform: string;
}): Promise<WuaRecord> {
  const ref = p.keyRef ?? WUA_INSTANCE_REF;
  const jwk = (await p.keys.publicKey(ref)) ?? (await p.keys.generate(ref));
  const att = await p.keys.attestation();
  const r = await p.http(`${p.providerBase.replace(/\/$/, "")}/wua`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jwk,
      attestation: {
        storage: att.storage,
        platform: p.platform,
        app_version: p.appVersion,
        solution_id: p.solutionId ?? "tamga-wallet-expo",
      },
    }),
  });
  const body = (await readJson(r, "wallet provider")) as {
    wua?: string;
    exp?: number;
    sub?: string;
    key_storage?: KeyStorage;
    solution_id?: string;
    security_level?: string;
    error?: string;
    error_description?: string;
  };
  if (r.status !== 200 || !body.wua)
    throw new WalletError(
      "issuer_error",
      `WUA could not be obtained: ${body.error_description ?? body.error ?? r.status}`,
    );
  return {
    jwt: body.wua,
    sub: body.sub ?? String(decodeJwt(body.wua).payload.sub),
    exp: body.exp ?? Number(decodeJwt(body.wua).payload.exp),
    keyRef: ref,
    keyStorage: body.key_storage ?? att.storage,
    solutionId: body.solution_id ?? "tamga-wallet-expo",
    securityLevel: body.security_level,
    provider: p.providerBase,
  };
}

/** PoP: {iss = WUA sub, aud = credential_issuer, iat, exp, jti}; örnek anahtarıyla imzalı. */
export async function clientAttestationPop(p: {
  keys: KeyProvider;
  wua: WuaRecord;
  aud: string;
  now?: number;
  randomBytes?: (n: number) => Uint8Array;
}): Promise<string> {
  const now = p.now ?? Math.floor(Date.now() / 1000);
  const jti = b64u((p.randomBytes ?? nobleRandom)(12));
  return signJwt(
    { typ: WUA_POP_TYP },
    { iss: p.wua.sub, aud: p.aud, iat: now, exp: now + 300, jti },
    p.keys,
    p.wua.keyRef,
  );
}
export const wuaExpiringSoon = (w: WuaRecord | undefined, now = Math.floor(Date.now() / 1000), marginSec = 7 * 86400) =>
  !w || w.exp - now < marginSec;

// ---------------------------------------------------------------- ADR-0025 / AB TS3: birim kaydı, WIA, anahtar kanıtı
export const UNIT_REF = "wallet.unit";
export const UNIT_POP_TYP = "tamga-unit-pop+jwt";
export const PROOF_TYP_KA = "openid4vci-proof+jwt";

/**
 * Cüzdan sağlayıcı yolları — TEK yer (cüzdan istemcisi ve sağlayıcı servisi aynı sabitleri kullanır). Adlar proje yönetimi
 * onayıyla (2026-10-04): teknik uçlar `units/` altında (ARF "wallet unit revocation"), kişi sayfası `/lost`.
 */
export const WP_PATHS = {
  challenge: "/units/challenge",
  register: "/units",
  wia: "/wia",
  ka: "/ka",
  /** Birim iptali: cihazdan imzalı kanıtla YA DA (WA-ADR-0002) yalnız kapatma koduyla (`revocation_code`). */
  revoke: "/units/revoke",
  delete: "/units/delete",
  /** WA-ADR-0002 K1: kapatma kodunun ön özetini birime bağlar (imzalı kanıt). */
  revocationCode: "/units/revocation-code",
  /** WA-ADR-0002 K3: birimin durumu (`active` / `revoked`) — imzalı kanıt; WIA girişi harcamaz. */
  status: "/units/status",
  /** WA-ADR-0002 K2: "Telefonumu kaybettim" sayfası (TR/EN); kod girişi → `revoke`. */
  lost: "/lost",
} as const;

const base = (u: string) => u.replace(/\/$/, "");
const thumb = (jwk: PublicJwk) => b64u(jwkThumbprint(jwk));

/** Birim anahtarıyla imzalı tek kullanımlık kanıt (sağlayıcıya). */
async function unitProof(
  p: { providerBase: string; keys: KeyProvider; randomBytes?: (n: number) => Uint8Array; now?: number },
  action: string,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const jwk = (await p.keys.publicKey(UNIT_REF)) ?? (await p.keys.generate(UNIT_REF));
  const now = p.now ?? Math.floor(Date.now() / 1000);
  const header = action === "register" ? { typ: UNIT_POP_TYP, jwk } : { typ: UNIT_POP_TYP, kid: thumb(jwk) };
  return signJwt(
    header,
    { aud: base(p.providerBase), iat: now, jti: b64u((p.randomBytes ?? nobleRandom)(16)), action, ...extra },
    p.keys,
    UNIT_REF,
  );
}

async function postJson(http: Http, url: string, body: unknown) {
  const r = await http(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: (await readJson(r, "wallet provider")) as Record<string, unknown> };
}
const failed = (what: string, b: Record<string, unknown>, status: number) =>
  new WalletError("issuer_error", `${what}: ${String(b.error_description ?? b.error ?? status)}`);

/** Cüzdan birimini sağlayıcıya kaydeder (ilk kurulum; tekrar çağrılabilir). */
export async function registerUnit(p: {
  providerBase: string;
  keys: KeyProvider;
  http: Http;
  appVersion: string;
  platform: string;
  solutionId?: string;
  randomBytes?: (n: number) => Uint8Array;
  /**
   * P4-2 cihaz kanıtı. Verilirse sağlayıcıdan tek kullanımlık meydan okuma alınır; birim anahtarı (yoksa) bu meydan okumayla
   * üretilir (Android anahtar kanıtı) ve dönen kanıt kayıtla gönderilir (Android: key_attestation; iOS: App Attest).
   * Kanıt doğrulanmazsa sağlayıcı reddeder; cüzdan kanıtsız (yazılım seviyesi) yeniden dener.
   */
  deviceEvidence?: (ctx: { challenge: string; unitThumbprint: string }) => Promise<DeviceEvidence | undefined>;
}): Promise<{ unitId: string; keyStorage?: string }> {
  const register = async (withDevice: boolean) => {
    let challenge: string | undefined;
    if (withDevice && p.deviceEvidence) {
      const c = await postJson(p.http, `${base(p.providerBase)}/units/challenge`, {});
      if (c.status === 200 && typeof c.body.challenge === "string") challenge = c.body.challenge;
    }
    if (!(await p.keys.publicKey(UNIT_REF)))
      await p.keys.generate(UNIT_REF, challenge ? b64uDecode(challenge) : undefined);
    const jwk = (await p.keys.publicKey(UNIT_REF))!;
    const evidence =
      challenge && p.deviceEvidence ? await p.deviceEvidence({ challenge, unitThumbprint: thumb(jwk) }) : undefined;
    const proof = await unitProof(p, "register", {
      solution_id: p.solutionId ?? "tamga-wallet-expo",
      app_version: p.appVersion,
      platform: p.platform,
      ...(evidence ? { challenge } : {}),
    });
    return postJson(p.http, `${base(p.providerBase)}/units`, {
      proof,
      ...(evidence ? { device_evidence: evidence } : {}),
    });
  };
  let r = await register(true);
  if (r.status === 400 && r.body.error === "device_attestation_failed") r = await register(false);
  if (r.status !== 201 && r.status !== 200) throw failed("wallet unit registration failed", r.body, r.status);
  return {
    unitId: String(r.body.unit_id),
    ...(typeof r.body.key_storage === "string" ? { keyStorage: r.body.key_storage } : {}),
  };
}

/** P4-2: sağlayıcıya giden cihaz kanıtı (Android anahtar kanıtı zinciri ya da Apple App Attest). */
export type DeviceEvidence =
  | { platform: "android"; key_attestation: string[] }
  | { platform: "ios"; app_attest: { key_id: string; attestation: string } };

/**
 * Tek bir belge işlemi için yeni WIA (< 24 saat): yeni PoP anahtarı + sağlayıcıda yeni iptal girişi (WIA1). Dönen kayıt
 * eski WUA kaydıyla aynı biçimde; token isteğine aynı başlıklarla gider.
 */
export async function requestWia(p: {
  providerBase: string;
  keys: KeyProvider;
  http: Http;
  randomBytes?: (n: number) => Uint8Array;
}): Promise<WuaRecord> {
  const keyRef = `wia.${b64u((p.randomBytes ?? nobleRandom)(9))}`;
  const wiaJwk = await p.keys.generate(keyRef);
  const proof = await unitProof(p, "wia", { wia_jkt: thumb(wiaJwk) });
  const r = await postJson(p.http, `${base(p.providerBase)}/wia`, { proof, wia_jwk: wiaJwk });
  if (r.status !== 200 || typeof r.body.wia !== "string") {
    await p.keys.delete(keyRef).catch(() => {});
    if (r.body.error === "unit_revoked") throw new WalletError("unit_revoked", "This wallet has been revoked.");
    throw failed("WIA could not be obtained", r.body, r.status);
  }
  const claims = decodeJwt(r.body.wia).payload as { sub?: string; exp?: number; wallet_name?: string };
  return {
    jwt: r.body.wia,
    sub: String(claims.sub),
    exp: Number(claims.exp),
    keyRef,
    keyStorage: "software", // WIA depo bilgisi taşımaz; gerçek seviye KA'da
    solutionId: String(claims.wallet_name ?? "tamga-wallet-expo"),
    provider: p.providerBase,
  };
}

/** Belge anahtarları için sağlayıcı imzalı anahtar kanıtı (KA). */
export async function requestKeyAttestation(p: {
  providerBase: string;
  keys: KeyProvider;
  http: Http;
  jwks: PublicJwk[];
  randomBytes?: (n: number) => Uint8Array;
}): Promise<string> {
  const keysHash = b64u(sha256(new TextEncoder().encode(p.jwks.map(thumb).join("."))));
  const proof = await unitProof(p, "ka", { keys_hash: keysHash });
  const r = await postJson(p.http, `${base(p.providerBase)}/ka`, { proof, keys: p.jwks });
  if (r.status !== 200 || typeof r.body.key_attestation !== "string")
    throw failed("key attestation could not be obtained", r.body, r.status);
  return r.body.key_attestation;
}

/** Kullanıcı isteğiyle birimi iptal eder (cihaz devri / satış): bütün WIA girişleri iptal olur. */
export async function revokeUnit(p: {
  providerBase: string;
  keys: KeyProvider;
  http: Http;
  randomBytes?: (n: number) => Uint8Array;
}): Promise<void> {
  const proof = await unitProof(p, "revoke");
  const r = await postJson(p.http, `${base(p.providerBase)}/units/revoke`, { proof });
  if (r.status !== 200) throw failed("wallet revocation failed", r.body, r.status);
}

/**
 * Kişinin silme isteği (Apple 5.1.1(v), Google Play; KVKK md. 7): birim iptal edilir ve sağlayıcıdaki kaydı silinir. Kimlik
 * birim anahtarıyla (PoP). Birim zaten silinmişse (bilinmeyen birim) başarılı sayılır.
 */
export async function deleteUnit(p: {
  providerBase: string;
  keys: KeyProvider;
  http: Http;
  randomBytes?: (n: number) => Uint8Array;
}): Promise<void> {
  const proof = await unitProof(p, "delete");
  const r = await postJson(p.http, `${base(p.providerBase)}/units/delete`, { proof });
  if (r.status === 400 && /unknown unit/.test(String(r.body.error_description ?? ""))) return;
  if (r.status !== 200) throw failed("wallet deletion failed", r.body, r.status);
}

/**
 * WA-ADR-0002 K1: kapatma kodunun ÖN ÖZETİNİ (kodun kendisini değil) birime bağlar; sağlayıcı yavaş özetini tutar, eskisini
 * siler. Kod bu çağrıdan sonra cihazda saklanmaz — çağıran yalnız "oluşturuldu" bilgisini yazar.
 */
export async function registerLockCode(p: {
  providerBase: string;
  keys: KeyProvider;
  http: Http;
  code: string;
  randomBytes?: (n: number) => Uint8Array;
}): Promise<void> {
  const proof = await unitProof(p, "revocation-code", { lock_prehash: lockCodePrehash(p.code) });
  const r = await postJson(p.http, `${base(p.providerBase)}${WP_PATHS.revocationCode}`, { proof });
  if (r.status === 403 && r.body.error === "unit_revoked")
    throw new WalletError("unit_revoked", "This wallet has been revoked.");
  if (r.status !== 200) throw failed("revocation code could not be saved", r.body, r.status);
}

/**
 * WA-ADR-0002 K3 — yalnız İPUCU: birimin sağlayıcıdaki durumu (imzasız JSON). Cüzdan buna dayanarak hiçbir şey SİLMEZ; silme
 * kararı yalnız imzalı iptal listesiyle verilir (`wiaRevokedByList`). Bilinmeyen birim / ağ hatası fırlatılır.
 */
export async function unitStatus(p: {
  providerBase: string;
  keys: KeyProvider;
  http: Http;
  randomBytes?: (n: number) => Uint8Array;
}): Promise<"active" | "revoked"> {
  const proof = await unitProof(p, "status");
  const r = await postJson(p.http, `${base(p.providerBase)}${WP_PATHS.status}`, { proof });
  if (r.status === 200 && (r.body.status === "active" || r.body.status === "revoked")) return r.body.status;
  if (r.status === 403 && r.body.error === "unit_revoked") return "revoked";
  throw failed("wallet status could not be read", r.body, r.status);
}

/** WIA'nın iptal listesi girişi (ADR-0025 `client_status`); eski WUA'da yok. */
export function wiaStatusRef(wua: WuaRecord): { uri: string; idx: number } | undefined {
  const c = decodeJwt(wua.jwt).payload as {
    client_status?: { status?: { status_list?: { uri?: unknown; idx?: unknown } } };
  };
  const sl = c.client_status?.status?.status_list;
  return sl && typeof sl.uri === "string" && typeof sl.idx === "number" ? { uri: sl.uri, idx: sl.idx } : undefined;
}

/**
 * WA-ADR-0002 K3 / RL4 — silmenin TEK dayanağı: sağlayıcının herkese açık, İMZALI WIA iptal listesi (kimlik servisinin
 * denetlediği listenin aynısı). Listeyi çekmek kimliksizdir (hangi girişin arandığı görünmez); imzacı, pin'li güven listesindeki
 * bir cüzdan sağlayıcı anahtarı olmalıdır — TLS'e tek başına güvenilmez. Kendi WIA girişi INVALID ise `true`. Giriş yoksa (eski
 * WUA) `false`; ağ ya da doğrulama hatası fırlatılır (çağıran silmez, sonraki öne gelişte yeniden dener).
 */
export async function wiaRevokedByList(p: {
  wua: WuaRecord;
  http: Http;
  trust: Pick<TrustSource, "isWalletProviderKey">;
  now?: number;
}): Promise<boolean> {
  const ref = wiaStatusRef(p.wua);
  if (!ref) return false;
  const r = await p.http(ref.uri, { method: "GET" });
  if (r.status !== 200) throw new WalletError("network", `wallet status list: HTTP ${r.status}`);
  const list = parseStatusToken((await r.text()).trim(), ref.uri, p.now ?? Math.floor(Date.now() / 1000));
  if (p.trust.isWalletProviderKey(list.signerFingerprint) !== "YES")
    throw new WalletError("trust_error", "wallet status list: signer is not a registered wallet provider");
  return statusBitAt(list, ref.idx) === 1;
}

/** Belge akışlarına verilen KA üretici (obtainCredential). */
export const keyAttestorFor =
  (p: { providerBase: string; keys: KeyProvider; http: Http; randomBytes?: (n: number) => Uint8Array }) =>
  (jwks: PublicJwk[]) =>
    requestKeyAttestation({ ...p, jwks });

/** P4-2 App Attest istemci verisi: meydan okuma + birim anahtarı parmak izi (sağlayıcı aynı biçimle doğrular). */
export const unitClientData = (challenge: string, unitThumbprint: string) =>
  new TextEncoder().encode(`tamga-unit|${challenge}|${unitThumbprint}`);
