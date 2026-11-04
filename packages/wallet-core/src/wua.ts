/**
 * Wallet Unit Attestation / Wallet Instance Attestation — cüzdan tarafının GENEL kısmı (SPEC-CRED-0001 §4, ADR-0025; AB TS3,
 * OAuth Attestation-Based Client Authentication). Her cüzdan için aynıdır:
 *  - `WuaRecord`: cüzdan sağlayıcıdan alınmış kanıt (JWT, x5c = güven listesindeki sağlayıcı sertifikası) ve PoP anahtarının adı.
 *  - İhraçta token isteğine iki başlık: OAuth-Client-Attestation (WUA/WIA) + OAuth-Client-Attestation-PoP
 *    (`clientAttestationPop`, örnek anahtarıyla, aud = credential_issuer).
 *  - WIA iptal listesi denetimi (`wiaStatusRef`, `wiaStatusByList`, `wiaRevokedByList`): imzacı güven listesindeki bir cüzdan
 *    sağlayıcı olmalı. Durum biti kapalı güvenli okunur (kontrol 2026-11-03, K11): 0 geçerli, 1 iptal, 2 askıda, 3 (tanımsız)
 *    iptal sayılır — sıfır dışı her değer "geçerli değil"dir; yalnız iptal (1/3) yerel silmenin dayanağıdır (askı geçicidir).
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
  return (await wiaStatusByList(p)) === "revoked";
}

/** WIA'nın imzalı listedeki durumu (`wiaStatusInList`); girişi yoksa (eski WUA) "valid". Hata kuralları `wiaRevokedByList` ile aynı. */
export async function wiaStatusByList(p: {
  wua: WuaRecord;
  http: Http;
  trust: Pick<TrustSource, "isWalletProviderKey">;
  now?: number;
}): Promise<WiaListStatus> {
  const ref = wiaStatusRef(p.wua);
  if (!ref) return "valid";
  const r = await p.http(ref.uri, { method: "GET" });
  if (r.status !== 200) throw new WalletError("network", `wallet status list: HTTP ${r.status}`);
  const list = parseStatusToken((await r.text()).trim(), ref.uri, p.now ?? Math.floor(Date.now() / 1000));
  if (p.trust.isWalletProviderKey(list.signerFingerprint) !== "YES")
    throw new WalletError("trust_error", "wallet status list: signer is not a registered wallet provider");
  return wiaStatusInList(list, ref.idx);
}

/** WIA'nın durum listesindeki okuması: `valid` (0) · `suspended` (2, geçici; WIA kullanılmaz) · `revoked` (1 ve tanımsız 3). */
export type WiaListStatus = "valid" | "suspended" | "revoked";

/**
 * WIA girişinin imzası doğrulanmış listedeki durumu — kapalı güvenli (kontrol 2026-11-03, K11; TS 119 472 / IETF Token Status List):
 * yalnız 0 geçerlidir; 1 iptal, 2 askıda, 3 (uygulamaya özgü / tanımsız) iptal sayılır (belge durumuyla aynı kural,
 * `credentialStatusFrom`). İmzalı liste girişten kısaysa giriş yok (sağlayıcının listesi yeniden kuruldu): iptal değil — bunu ancak
 * listenin kayıtlı imzacısı söyleyebilir; o imzacı zaten biti 0 da yazabilir, güvence azalmaz. Sınır listenin bit genişliğine göre
 * hesaplanır (`8 / bits`: 1 bit → bayt başına 8 giriş, 2 bit → 4, 4 bit → 2, 8 bit → 1): sabit "×4" 1 bitlik listede son yarıdaki iptal edilmiş girişleri "iptal
 * değil" okurdu.
 */
export function wiaStatusInList(list: Pick<StatusList, "bits" | "bytes">, idx: number): WiaListStatus {
  const perByte = 8 / list.bits;
  if (idx >= list.bytes.length * perByte) return "valid";
  const v = statusBitAt(list as StatusList, idx);
  if (v === 0) return "valid";
  if (v === 2) return "suspended";
  return "revoked";
}

/** WIA girişi listede İPTAL mi (1 ya da tanımsız 3) — yerel silmenin dayanağı. Askı (2) iptal değildir; `wiaValidInList` ile bakın. */
export function wiaRevokedInList(list: Pick<StatusList, "bits" | "bytes">, idx: number): boolean {
  return wiaStatusInList(list, idx) === "revoked";
}

/** WIA girişi listede GEÇERLİ mi (yalnız 0): sıfır dışı her değerde WIA kullanılmaz (kapalı güvenli). */
export function wiaValidInList(list: Pick<StatusList, "bits" | "bytes">, idx: number): boolean {
  return wiaStatusInList(list, idx) === "valid";
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
