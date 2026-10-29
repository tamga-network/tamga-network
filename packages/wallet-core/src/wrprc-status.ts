/**
 * ADR-0068 K5 — kayıt sertifikasının (WRPRC) iptal durumu (ETSI TS 119 475 V1.2.1 GEN-6.2.6.1-04, REV-6.2.6.2; ARF RPRC_17,
 * §6.6.3.3 "not revoked"). Sertifikanın `status.status_list {idx, uri}` girdisi kayıt kurumunun Token Status List'inde okunur.
 *
 * - İmzacı: listeyi imzalayan sertifika LOTL'deki kayıt kurumu anahtarlarından biri olmalı (`registrarKeys`, kayıt sertifikasının
 *   kendi imzacısıyla aynı küme; ARF RPACANot_03b). Değilse liste yok sayılır.
 * - Önbellek / çevrimdışı: doğrulanmış her liste belirteci önbelleğe yazılır; ağ yoksa ya da liste alınamazsa önbellekteki kopya
 *   SÜRESİ (`exp`) DOLMADIYSA kullanılır. Süresi dolmuş kopya kullanılmaz.
 * - Sonuç: `valid` (bit 0), `revoked` (0 dışı her değer; ETSI yalnız geçerli/iptal tanımlar → güvenli taraf), `unknown` (liste yok,
 *   doğrulanamadı ya da indeks liste dışında). Kural (wrprc.ts): `revoked` → istek geçersiz (WRC4, veri gitmez);
 *   `unknown` → onay ekranında uyarı (`registration_status_unknown`), geçerli sayılmaz ama tek başına ret değildir (ARF RPRC_17:
 *   uyarı + karar cüzdan sağlayıcının).
 */
import { parseStatusToken, statusBitAt, type StatusList } from "./status.js";
import type { Http } from "./http.js";
import { millisOrNow, type EpochMillis } from "@tamga-network/core/time";

export type RegistrationStatus = "valid" | "revoked" | "unknown";
export interface WrprcStatusRef {
  uri: string;
  idx: number;
}
/** Önceden çekilmiş durumlar: `fetchRegistrationStatuses`'ın sonucu; kayıt sertifikası denetimlerine verilir. */
export type RegistrationStatusLookup = (ref: WrprcStatusRef) => RegistrationStatus;

/** Sertifika yükündeki durum girdisi (`status.status_list`); yoksa ya da biçimi bozuksa null. */
export function wrprcStatusRef(payload: unknown): WrprcStatusRef | null {
  const sl = (payload as { status?: { status_list?: { idx?: unknown; uri?: unknown } } } | null)?.status?.status_list;
  if (!sl) return null;
  // TS 119 475 GEN-6.2.6.1-04 "idx: a numeric string" — IETF Token Status List sayı yazar; ikisi de okunur
  const idx = typeof sl.idx === "string" && /^(0|[1-9][0-9]{0,8})$/.test(sl.idx) ? Number(sl.idx) : sl.idx;
  if (typeof idx !== "number" || !Number.isInteger(idx) || idx < 0) return null;
  if (typeof sl.uri !== "string" || !/^https:\/\/[^\s]+$/.test(sl.uri)) return null;
  return { uri: sl.uri, idx };
}
/** Sertifikada durum alanı var ama okunamıyor mu (bozuk girdi ret sebebidir). */
export function hasMalformedStatus(payload: unknown): boolean {
  const s = (payload as { status?: unknown } | null)?.status;
  return s !== undefined && wrprcStatusRef(payload) === null;
}

/** Liste belirteçleri önbelleği (uygulama kalıcı yapabilir: `entries()` / kurucuya verilen kayıtlar). */
export interface RegistrationStatusCache {
  get(uri: string): string | undefined;
  set(uri: string, token: string): void;
}
export class MemoryRegistrationStatusCache implements RegistrationStatusCache {
  private m: Map<string, string>;
  constructor(entries: Iterable<[string, string]> = []) {
    this.m = new Map(entries);
  }
  get(uri: string) {
    return this.m.get(uri);
  }
  set(uri: string, token: string) {
    this.m.set(uri, token);
  }
  entries(): Array<[string, string]> {
    return [...this.m.entries()];
  }
}

function verifiedList(token: string, uri: string, nowSec: number, registrarKeys: string[]): StatusList | null {
  try {
    // ADR-0068 K3: kayıt sertifikası durum listesi `exp` taşımak zorunda (süresiz liste reddedilir → "unknown")
    const l = parseStatusToken(token.trim(), uri, nowSec, { requireExp: true });
    return registrarKeys.includes(l.signerFingerprint) ? l : null;
  } catch {
    return null;
  }
}

/**
 * Durum listelerini çeker (adres başına bir istek; liste bütün kayıt sertifikalarını taşıdığı için hangi doğrulayıcıya
 * bakıldığını açığa vurmaz). `offline: true` → yalnız önbellek.
 */
export async function fetchRegistrationStatuses(
  refs: Array<WrprcStatusRef | null | undefined>,
  http: Http,
  registrarKeys: string[],
  opts: { cache?: RegistrationStatusCache; nowMs?: EpochMillis; offline?: boolean } = {},
): Promise<RegistrationStatusLookup> {
  const nowSec = Math.floor(millisOrNow(opts.nowMs) / 1000);
  const lists = new Map<string, StatusList>();
  for (const uri of new Set(refs.filter((r): r is WrprcStatusRef => !!r).map((r) => r.uri))) {
    let list: StatusList | null = null;
    if (!opts.offline) {
      try {
        const r = await http(uri, { method: "GET", headers: { accept: "application/statuslist+jwt" } });
        if (r.status === 200) {
          const token = await r.text();
          list = verifiedList(token, uri, nowSec, registrarKeys);
          if (list) opts.cache?.set(uri, token.trim());
        }
      } catch {
        // ağ yok → önbellek
      }
    }
    if (!list) {
      const cached = opts.cache?.get(uri);
      if (cached) list = verifiedList(cached, uri, nowSec, registrarKeys);
    }
    if (list) lists.set(uri, list);
  }
  return (ref) => {
    const list = lists.get(ref.uri);
    if (!list) return "unknown";
    try {
      return statusBitAt(list, ref.idx) === 0 ? "valid" : "revoked";
    } catch {
      return "unknown";
    }
  };
}
