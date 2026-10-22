/**
 * Wallet Unit Attestation / Wallet Instance Attestation — cüzdan tarafının GENEL kısmı (SPEC-CRED-0001 §4, ADR-0025; AB TS3,
 * OAuth Attestation-Based Client Authentication). Her cüzdan için aynıdır:
 *  - `WuaRecord`: cüzdan sağlayıcıdan alınmış kanıt (JWT, x5c = güven listesindeki sağlayıcı sertifikası) ve PoP anahtarının adı.
 *  - İhraçta token isteğine iki başlık: OAuth-Client-Attestation (WUA/WIA) + OAuth-Client-Attestation-PoP
 *    (`clientAttestationPop`, örnek anahtarıyla, aud = credential_issuer).
 *  - WIA iptal listesi denetimi (`wiaStatusRef`, `wiaRevokedByList`): imzacı güven listesindeki bir cüzdan sağlayıcı olmalı.
 * Kanıtın sağlayıcıdan NASIL alındığı (kayıt, WIA/KA uçları, iptal, kapatma kodu) her cüzdanın kendi sağlayıcı protokolüdür; bu
 * paketin parçası değildir (ağın ADR-0042) — çağıran `WuaRecord`'u ve `keyAttestor`'u kendisi verir.
 */
import { randomBytes as nobleRandom } from "@noble/hashes/utils.js";
import { b64u } from "./b64.js";
import { decodeJwt, signJwt } from "./jws.js";
import type { KeyProvider, KeyStorage } from "./keys.js";
import { WalletError, type Http } from "./http.js";
import { parseStatusToken, statusBitAt, type StatusList } from "./status.js";
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

/** WIA'nın iptal listesi girişi (ADR-0025 `client_status`); eski WUA'da yok. */
export function wiaStatusRef(wua: WuaRecord): { uri: string; idx: number } | undefined {
  const c = decodeJwt(wua.jwt).payload as {
    client_status?: { status?: { status_list?: { uri?: unknown; idx?: unknown } } };
  };
  const sl = c.client_status?.status?.status_list;
  return sl && typeof sl.uri === "string" && typeof sl.idx === "number" ? { uri: sl.uri, idx: sl.idx } : undefined;
}

/**
 * WIA'nın iptal edilip edilmediği — cüzdanın yerel veriyi silme gibi kararlarının TEK dayanağı olması gereken kaynak: sağlayıcının
 * herkese açık, İMZALI WIA iptal listesi (belge veren kurumların denetlediği listenin aynısı). Listeyi çekmek kimliksizdir
 * (hangi girişin arandığı görünmez); imzacı, pin'li güven listesindeki bir cüzdan sağlayıcı anahtarı olmalıdır — TLS'e tek
 * başına güvenilmez. Kendi WIA girişi INVALID ise `true`. Giriş yoksa (eski WUA) `false`; ağ ya da doğrulama hatası fırlatılır
 * (çağıran silmez, sonra yeniden dener).
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
  return wiaRevokedInList(list, ref.idx);
}

/**
 * WIA girişi imzası doğrulanmış listede INVALID mi. İmzalı liste girişten kısaysa giriş yok (sağlayıcının listesi yeniden
 * kuruldu): iptal değil — bunu ancak listenin kayıtlı imzacısı söyleyebilir; o imzacı zaten biti 0 da yazabilir, güvence
 * azalmaz. Sınır listenin bit genişliğine göre hesaplanır (1 bit → bayt başına 8 giriş, 2 bit → 4): sabit "×4" 1 bitlik
 * listede son yarıdaki iptal edilmiş girişleri "iptal değil" okurdu.
 */
export function wiaRevokedInList(list: Pick<StatusList, "bits" | "bytes">, idx: number): boolean {
  const perByte = 8 / (list.bits === 1 ? 1 : 2);
  if (idx >= list.bytes.length * perByte) return false;
  return statusBitAt(list as StatusList, idx) === 1;
}

/**
 * ADR-0060 (ATCA §10.3): yenileme belirteci istemci örneği anahtarına bağlıdır. Yenilemede o anahtarın WIA'sı gerekir: cüzdanın
 * elindeki WIA aynı anahtarlıysa o; değilse `wuaForInstance` ile sağlayıcıdan bu anahtara taze WIA istenir. Bağda anahtar yoksa
 * (eski bağ) elindeki WIA. Alınamazsa `null` (tur atlanır, belirteç harcanmaz).
 */
export async function wuaForBinding(p: {
  wua: WuaRecord;
  instanceKeyRef?: string;
  wuaForInstance?: (keyRef: string) => Promise<WuaRecord>;
}): Promise<WuaRecord | null> {
  if (!p.instanceKeyRef || p.wua.keyRef === p.instanceKeyRef) return p.wua;
  if (!p.wuaForInstance) return null;
  try {
    const w = await p.wuaForInstance(p.instanceKeyRef);
    return w.keyRef === p.instanceKeyRef ? w : null;
  } catch {
    return null;
  }
}
