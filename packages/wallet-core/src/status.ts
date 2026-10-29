/**
 * Cüzdanın kendi belgelerinin iptal durumu (ARF VCR_19). Token Status List (SPEC-CRED-0003) çekilir; imza, liste adresi, bit sayısı
 * (1 ya da 2; ADR-0048: kimlik servisinin türleri 1) ve
 * imzacının kurumun güven listesinde kayıtlı iptal anahtarı olması (S11) doğrulanır. Liste tüm kurum belgelerini taşıdığı için
 * çekmek hangi belgenin sorgulandığını açığa vurmaz (sürü mahremiyeti). Her kopyanın kendi indeksi okunur.
 */
import { Unzlib } from "fflate";
import { parseStatusListCwt, looksLikeStatusListCwt } from "@tamga-network/mdoc";
import type { TrustSource } from "@tamga-network/trust/core";
import { b64Decode, b64uDecode } from "./b64.js";
import { verifyJwt } from "./jws.js";
import { certFingerprintHex, p256PointFromCertDer } from "./sdjwt.js";
import type { Http } from "./http.js";
import type { StoredCredential, WalletState } from "./store.js";

export type CredentialStatus = "valid" | "suspended" | "revoked" | "unknown";
export interface StatusCheck {
  value: CredentialStatus;
  checkedAt: number;
}

export interface StatusList {
  uri: string;
  bits: number;
  bytes: Uint8Array;
  signerFingerprint: string;
  iss: string;
}

/** Status token ve açılmış bit dizisi üst sınırları (bellek tüketme / sıkıştırma bombası). 16 MiB = 64 milyon belge. */
const MAX_STATUS_TOKEN_CHARS = 2 * 1024 * 1024;
const MAX_STATUS_LIST_BYTES = 16 * 1024 * 1024;

/** zlib açma, çıktı üst sınırıyla: girdi küçük parçalarla verilir, sınır aşılınca durur. */
function unzlibCapped(data: Uint8Array, max: number): Uint8Array {
  const chunks: Uint8Array[] = [];
  let n = 0;
  const z = new Unzlib((chunk) => {
    n += chunk.length;
    if (n > max) throw new Error("status list too large");
    chunks.push(chunk);
  });
  const STEP = 4096;
  for (let i = 0; i < data.length; i += STEP) z.push(data.subarray(i, i + STEP), i + STEP >= data.length);
  if (!data.length) z.push(data, true);
  const out = new Uint8Array(n);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

/**
 * Status token'ı doğrular ve bit dizisini açar. `now` saniye. `requireExp`: `exp` zorunlu (ADR-0068 K3 — kayıt sertifikası durum
 * listesi `exp`'siz kabul edilmez; süresiz bir liste eski bir "geçerli" görüntüsünün sonsuza dek kullanılmasına izin verirdi).
 */
export function parseStatusToken(
  token: string,
  expectedUri: string,
  now: number,
  opts: { requireExp?: boolean } = {},
): StatusList {
  if (token.length > MAX_STATUS_TOKEN_CHARS) throw new Error("status token too large");
  const [h] = token.split(".");
  const header = JSON.parse(new TextDecoder().decode(b64uDecode(h))) as { typ?: string; x5c?: string[] };
  if (header.typ !== "statuslist+jwt" || !header.x5c?.length) throw new Error("status token header");
  const leaf = b64Decode(header.x5c[0]);
  const d = verifyJwt(token, p256PointFromCertDer(leaf));
  const p = d.payload as {
    sub?: string;
    iss?: string;
    iat?: number;
    exp?: number;
    ttl?: number;
    status_list?: { bits?: number; lst?: string };
  };
  if (p.sub !== expectedUri) throw new Error("status token sub ≠ list uri");
  const bits = p.status_list?.bits;
  if ((bits !== 1 && bits !== 2) || !p.status_list?.lst) throw new Error("status token bits not 1 or 2");
  if (opts.requireExp && typeof p.exp !== "number") throw new Error("status token has no exp");
  if (p.exp && p.exp < now) throw new Error("status token expired");
  if (p.iat && now - p.iat > (p.ttl ?? 3600) * 24) throw new Error("status token too old");
  return {
    uri: expectedUri,
    bits,
    bytes: unzlibCapped(b64uDecode(p.status_list.lst), MAX_STATUS_LIST_BYTES),
    signerFingerprint: certFingerprintHex(leaf),
    iss: String(p.iss ?? ""),
  };
}

/**
 * Status List'in CWT gösterimi (ADR-0048 K3; mdoc kopyasının MSO'su buna işaret eder): COSE_Sign1 imzası, `typ`, adres, süre ve
 * bit sayısı `@tamga-network/mdoc` ile; sıkıştırma burada üst sınırla açılır. `iss` yoktur (imzacı bağı S11 ile kurulur).
 * Hata iletileri ağın adım önekleriyle başlar (`D3:` imza/adres, `D4:` süresi geçmiş ya da okunamıyor, `D6:` bits).
 */
export function parseStatusCwt(bytes: Uint8Array, expectedUri: string, now: number): StatusList {
  if (bytes.length > MAX_STATUS_TOKEN_CHARS) throw new Error("D3: status token too large");
  const c = parseStatusListCwt(bytes, { uri: expectedUri, now, publicKeyOf: p256PointFromCertDer });
  if (c.ttl !== undefined && now - c.iat > c.ttl * 24) throw new Error("D4: status token too old");
  let out: Uint8Array;
  try {
    out = unzlibCapped(c.lst, MAX_STATUS_LIST_BYTES);
  } catch (e) {
    throw new Error(`D6: ${(e as Error).message}`);
  }
  return { uri: expectedUri, bits: c.bits, bytes: out, signerFingerprint: certFingerprintHex(c.leafDer), iss: "" };
}

/** Gövde hangi gösterimse (CWT baytları ya da JWT metni) onu doğrular. */
export function parseStatusBody(body: Uint8Array, expectedUri: string, now: number): StatusList {
  if (looksLikeStatusListCwt(body)) return parseStatusCwt(body, expectedUri, now);
  return parseStatusToken(new TextDecoder().decode(body).trim(), expectedUri, now);
}

/**
 * `bits` bitlik değer, LSB önce (draft §4.1). Liste dışı indeks "geçerli" okunmaz. CWT gösterimi 4 ve 8 bitlik listeyi de taşır
 * (`parseStatusListCwt`); eskiden 1 dışındaki her değer 2 bit okunuyordu — 8 bitlik listede başka belgenin bitleri okunurdu (K11
 * özellik testi). Şimdi bit sayısı kadar okunur; 3'ten büyük değer (uygulamaya özel) 3 döner: çağıranlar 3'ü geçersiz sayar.
 */
export function statusBitAt(list: StatusList, idx: number): 0 | 1 | 2 | 3 {
  const bits = list.bits;
  if (bits !== 1 && bits !== 2 && bits !== 4 && bits !== 8) throw new Error("status list bits not 1, 2, 4 or 8");
  const perByte = 8 / bits;
  if (!Number.isInteger(idx) || idx < 0 || idx >= list.bytes.length * perByte) throw new Error("idx outside the list");
  const v = (list.bytes[Math.floor(idx / perByte)] >> ((idx % perByte) * bits)) & ((1 << bits) - 1);
  return (v > 3 ? 3 : v) as 0 | 1 | 2 | 3;
}

/** Belgenin durumu: kopyalardan biri iptalse belge iptal (aynı mantıksal belge), askıdaysa askıda. */
export function credentialStatusFrom(cred: StoredCredential, list: StatusList, trust: TrustSource): CredentialStatus {
  const keys = (trust.issuer(cred.issuerId)?.delegate_keys ?? [])
    .filter((k) => k.purpose === "status_list" && (k.status ?? "ACTIVE") === "ACTIVE")
    .map((k) => k.fingerprint_sha256);
  if (!keys.includes(list.signerFingerprint)) return "unknown"; // S11: imzacı kurumun kayıtlı iptal anahtarı değil
  let suspended = false;
  for (const c of cred.copies) {
    if (c.idx === undefined) continue;
    const v = statusBitAt(list, c.idx);
    // 3 (uygulamaya özgü / tanımsız) iptal sayılır: doğrulayıcı 0 ve 2 dışındaki her değeri reddeder (fail-closed)
    if (v === 1 || v === 3) return "revoked";
    if (v === 2) suspended = true;
  }
  return suspended ? "suspended" : "valid";
}

/**
 * Bütün belgelerin durumunu yeniler. Liste başına tek istek; ağ/doğrulama hatasında önceki sonuç korunur ("unknown" yazılmaz,
 * iptal edilmiş bir belge çevrimdışıyken yeniden "geçerli" görünmez).
 */
export async function refreshCredentialStatuses(
  state: WalletState,
  http: Http,
  trust: TrustSource,
  now = Math.floor(Date.now() / 1000),
): Promise<WalletState> {
  const uris = [...new Set(state.credentials.map((c) => c.statusUri).filter((u): u is string => !!u))];
  const lists = new Map<string, StatusList>();
  for (const uri of uris) {
    try {
      const r = await http(uri, { method: "GET", headers: { accept: "application/statuslist+jwt" } });
      if (r.status !== 200) continue;
      lists.set(uri, parseStatusToken((await r.text()).trim(), uri, now));
    } catch {
      // ağ yok ya da liste doğrulanamadı → bu tur atlanır
    }
  }
  let changed = false;
  const credentials = state.credentials.map((c) => {
    const list = c.statusUri ? lists.get(c.statusUri) : undefined;
    if (!list) return c;
    let value: CredentialStatus;
    try {
      value = credentialStatusFrom(c, list, trust);
    } catch {
      return c;
    }
    if (value === "unknown") return c;
    changed = true;
    return { ...c, status: { value, checkedAt: now } };
  });
  return changed ? { ...state, credentials } : state;
}
