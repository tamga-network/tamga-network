/**
 * Cüzdanın kendi belgelerinin iptal durumu (ARF VCR_19). Token Status List (SPEC-CRED-0003) çekilir; imza, liste adresi, 2 bit ve
 * imzacının kurumun güven listesinde kayıtlı iptal anahtarı olması (S11) doğrulanır. Liste tüm kurum belgelerini taşıdığı için
 * çekmek hangi belgenin sorgulandığını açığa vurmaz (sürü mahremiyeti). Her kopyanın kendi indeksi okunur.
 */
import { Unzlib } from "fflate";
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

/** Status token'ı doğrular ve bit dizisini açar. `now` saniye. */
export function parseStatusToken(token: string, expectedUri: string, now: number): StatusList {
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
  if (p.status_list?.bits !== 2 || !p.status_list.lst) throw new Error("status token bits ≠ 2");
  if (p.exp && p.exp < now) throw new Error("status token expired");
  if (p.iat && now - p.iat > (p.ttl ?? 3600) * 24) throw new Error("status token too old");
  return {
    uri: expectedUri,
    bits: 2,
    bytes: unzlibCapped(b64uDecode(p.status_list.lst), MAX_STATUS_LIST_BYTES),
    signerFingerprint: certFingerprintHex(leaf),
    iss: String(p.iss ?? ""),
  };
}

/** 2 bit, LSB önce (draft §4.1). Liste dışı indeks "geçerli" okunmaz. */
export function statusBitAt(list: StatusList, idx: number): 0 | 1 | 2 | 3 {
  if (!Number.isInteger(idx) || idx < 0 || idx >= list.bytes.length * 4) throw new Error("idx outside the list");
  return ((list.bytes[idx >> 2] >> ((idx & 3) * 2)) & 0b11) as 0 | 1 | 2 | 3;
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
