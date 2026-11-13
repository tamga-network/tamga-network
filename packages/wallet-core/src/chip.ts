/**
 * Kimlik belgesi çipi — cüzdan tarafı taşıyıcı (ADR-0083; SPEC-ID-0003 IDP3).
 *
 * KAPALI: kimlik servisinde çip yolu anahtarı açılmadan kullanılmaz; hukuki görüş olumlu gelmeden ne sandbox'ta ne gerçek ağda
 * açılır (ADR-0083 K11, CV7). Mağaza derlemelerinde çip okuma bulunmaz; kod yalnız yerel testlerde sahte belge verisiyle çalışır.
 *
 * Cüzdan çip verisini YORUMLAMAZ (CV4): NFC ile okunan ICAO 9303 veri gruplarını (SOD, DG1, DG2; varsa DG11, DG14, DG15, etkin
 * doğrulama imzası, CardAccess) olduğu gibi kimlik servisine taşır. Doğrulama (pasif doğrulama, kopya denetimi) yalnız kimlik
 * servisinde yapılır (CV1). Çip erişim anahtarı (MRZ/CAN) bu modüle hiç girmez. Hiçbir alan günlüğe ya da hata iletisine konmaz.
 *
 * Akış: kimlik servisi tarayıcı akışında cüzdanı `<yetkilendirme sunucusu>/chip/read?r=<PAR kimliği>.<tutamaç>&c=<sınama>` adresine
 * yönlendirir → cüzdan `chipReadRequestOf` ile adresi denetler → çipi okur (etkin doğrulamada `challenge` 8 baytı çipe imzalatır) →
 * `submitChipRead` ham veriyi `/chip/submit`'e gönderir → yanıttaki `next` (aynı kökende) tarayıcıda açılır.
 */
import { b64u, b64uDecode } from "./b64.js";
import { WalletError, type Http, readJson } from "./http.js";
import type { KeyProvider } from "./keys.js";
import type { WuaRecord } from "./wua.js";
import { wuaHeaders } from "./authcode.js";

/** PAR alanı: cüzdan çip okuyabiliyorsa PAR gövdesine `chip_reader=icao9303` ekler (`startAuthorized({ parExtra })`). */
export const CHIP_READER_PARAM = "chip_reader";
/** `chip_reader` değeri: ICAO Doc 9303 eMRTD okuyucusu. */
export const CHIP_READER_ICAO9303 = "icao9303";

export const CHIP_READ_PATH = "/chip/read";
export const CHIP_SUBMIT_PATH = "/chip/submit";
/** Etkin doğrulama (AA) sınamasının uzunluğu (ICAO 9303-11: INTERNAL AUTHENTICATE, 8 bayt). */
export const CHIP_AA_CHALLENGE_BYTES = 8;

export interface ChipReadRequest {
  /** `/chip/submit` adresi (yetkilendirme sunucusuyla aynı kök ve yol öneki) */
  submitUrl: string;
  /** `r` değeri olduğu gibi (`<PAR kimliği>.<tutamaç>`); cüzdan için opaktır, gönderimde aynen geri verilir */
  handle: string;
  /** etkin doğrulama sınaması (8 bayt); çip AA destekliyorsa INTERNAL AUTHENTICATE ile imzalatılır */
  challenge: Uint8Array;
  /** cüzdan kanıtının (WIA PoP) `aud` değeri: yetkilendirme sunucusu (kimlik servisinin `issuer` değeri) */
  aud: string;
}

/** Çipten okunan ham veri — cüzdan hiçbirini ayrıştırmaz ya da değiştirmez (CV4). */
export interface ChipReadPayload {
  /** EF.SOD (belge güvenlik nesnesi) */
  sod: Uint8Array;
  /** EF.DG1 (MRZ bilgisi) */
  dg1: Uint8Array;
  /** EF.DG2 (yüz fotoğrafı) */
  dg2: Uint8Array;
  /** EF.DG11 (ek kişi bilgisi); yoksa kimlik servisi bu belge için çip yolunu kapatır (fotoğraf yolu) */
  dg11?: Uint8Array;
  /** EF.DG14 (çip doğrulama açık anahtarı ve güvenlik bilgileri) */
  dg14?: Uint8Array;
  /** EF.DG15 (etkin doğrulama açık anahtarı) */
  dg15?: Uint8Array;
  /** INTERNAL AUTHENTICATE yanıtı (çipin `challenge` üzerindeki imzası) */
  aaSignature?: Uint8Array;
  /** EF.CardAccess */
  cardAccess?: Uint8Array;
}

const originOf = (u: string) => /^(https?:\/\/[^/?#]+)/i.exec(u)?.[1].toLowerCase();
const trimSlash = (u: string) => u.replace(/\/+$/, "");
const HANDLE = /^[A-Za-z0-9_-]{1,128}\.[A-Za-z0-9_-]{16,128}$/;
const CHALLENGE = /^[A-Za-z0-9_-]{11}$/; // 8 bayt base64url, dolgusuz

function readQuery(q: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const kv of q.split("&")) {
    const i = kv.indexOf("=");
    if (i <= 0) continue;
    let k: string, v: string;
    try {
      k = decodeURIComponent(kv.slice(0, i));
      v = decodeURIComponent(kv.slice(i + 1));
    } catch {
      return new Map();
    }
    // aynı ad iki kez gelirse adres belirsizdir: reddedilir
    if (out.has(k)) out.set(k, "\u0000");
    else out.set(k, v);
  }
  return out;
}

/**
 * Kimlik servisinin çip okuma adresini ayrıştırır: `<yetkilendirme sunucusu>/chip/read?r=<PAR kimliği>.<tutamaç>&c=<sınama>`.
 * Adres yetkilendirme sunucusuyla aynı kökende ve tam `/chip/read` yolunda değilse ya da `r`/`c` biçimi uymuyorsa `undefined`
 * (bu bir çip okuma isteği değildir; cüzdan adresi açmaz). `authorizationServer`: kimlik servisinin `issuer` değeri (`start.issuer`).
 */
export function chipReadRequestOf(url: string, authorizationServer: string): ChipReadRequest | undefined {
  const base = trimSlash(authorizationServer);
  const baseOrigin = originOf(base);
  if (!baseOrigin || originOf(url) !== baseOrigin) return undefined;
  const rest = url.slice(baseOrigin.length);
  const hashAt = rest.indexOf("#");
  const noHash = hashAt >= 0 ? rest.slice(0, hashAt) : rest;
  const qAt = noHash.indexOf("?");
  const path = qAt >= 0 ? noHash.slice(0, qAt) : noHash;
  const basePath = base.slice(baseOrigin.length);
  if (path !== `${basePath}${CHIP_READ_PATH}`) return undefined;
  const q = readQuery(qAt >= 0 ? noHash.slice(qAt + 1) : "");
  const handle = q.get("r");
  const c = q.get("c");
  if (!handle || !HANDLE.test(handle) || !c || !CHALLENGE.test(c)) return undefined;
  const challenge = b64uDecode(c);
  if (challenge.length !== CHIP_AA_CHALLENGE_BYTES) return undefined;
  return { submitUrl: `${baseOrigin}${basePath}${CHIP_SUBMIT_PATH}`, handle, challenge, aud: base };
}

export interface SubmitChipReadInput {
  request: ChipReadRequest;
  payload: ChipReadPayload;
  keys: KeyProvider;
  /** akışı başlatan cüzdan örneğinin WIA'sı (PAR'dakiyle aynı — `start.wua ?? wua`) */
  wua: WuaRecord;
  http: Http;
  randomBytes: (n: number) => Uint8Array;
  /** saniye */
  now?: number;
}

/**
 * Ham çip verisini kimlik servisine gönderir (`POST /chip/submit`, gövde JSON, ikili alanlar base64url). Başlıklarda cüzdan kanıtı
 * (WIA + PoP, aud = yetkilendirme sunucusu). Yanıt 200 `{ next }`: tarayıcıda açılacak adres; aynı kökende değilse hata.
 */
export async function submitChipRead(p: SubmitChipReadInput): Promise<{ next: string }> {
  const { request: rq, payload: d } = p;
  const body: Record<string, string> = {
    handle: rq.handle,
    sod: b64u(d.sod),
    dg1: b64u(d.dg1),
    dg2: b64u(d.dg2),
    ...(d.dg11 ? { dg11: b64u(d.dg11) } : {}),
    ...(d.dg14 ? { dg14: b64u(d.dg14) } : {}),
    ...(d.dg15 ? { dg15: b64u(d.dg15) } : {}),
    ...(d.aaSignature ? { aa_signature: b64u(d.aaSignature) } : {}),
    ...(d.cardAccess ? { card_access: b64u(d.cardAccess) } : {}),
  };
  const headers = {
    "content-type": "application/json",
    ...(await wuaHeaders({ keys: p.keys, wua: p.wua, aud: rq.aud, now: p.now, randomBytes: p.randomBytes })),
  };
  const r = await p.http(rq.submitUrl, { method: "POST", headers, body: JSON.stringify(body) });
  const res = (await readJson(r, "chip submit").catch(() => ({}))) as { next?: unknown; error?: unknown };
  if (r.status !== 200) {
    // yalnız sunucunun hata kodu (kısa, harf/rakam); gönderilen veriden hiçbir şey iletiye girmez
    const code = typeof res.error === "string" && /^[a-z0-9_]{1,64}$/.test(res.error) ? res.error : String(r.status);
    throw new WalletError("issuer_error", `chip submit error: ${code}`);
  }
  if (typeof res.next !== "string" || originOf(res.next) !== originOf(rq.submitUrl))
    throw new WalletError("issuer_error", "chip submit: next address is not on the authorization server");
  return { next: res.next };
}
