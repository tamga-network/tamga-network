/**
 * "Paylaştığım kurumlar" (ARF DASH_02/03, RP listesi): cihazdaki sunum günlüğünü doğrulayıcıya göre gruplar. Anahtar, günlükte
 * yazılan kalıcı RP anahtarıdır (ADR-0034: doğrulanmış kayıtta alan adı; aksi hâlde istemci kimliği; yüz yüze okuyucular
 * "proximity"). Yalnız alan ADLARI ve tarihler — değer yoktur (WL4). Ağ erişimi yok; kurum adı ve kayıt durumu ekranda ayrıca
 * güven listesinden okunur.
 */
import type { PresentationLogEntry, WalletEvent, WalletState } from "./store.js";
import { activePseudonyms, type PseudonymEntry } from "./pseudonym.js";

/** Yüz yüze (ISO 18013-5 BLE) sunumların günlükteki anahtarı. */
export const PROXIMITY_RP_KEY = "proximity";

export interface SharedParty {
  /** Günlükteki kalıcı RP anahtarı */
  key: string;
  /** Anahtar çıplak bir alan adıysa (ADR-0034 `dns_name`) o alan adı */
  domain?: string;
  /** Bu doğrulayıcıya yapılan sunumlar (gönderilen, reddedilen, başarısız) — yeniden eskiye */
  shares: PresentationLogEntry[];
  /** Gönderilen sunum sayısı */
  sentCount: number;
  /** Son gönderilen sunumun zamanı */
  lastSharedAt?: number;
  /** Son herhangi bir olayın zamanı (sıralama için) */
  lastActivityAt: number;
  /** Gönderilen sunumlarda açıklanan alan adlarının birleşimi */
  fields: string[];
  /** Bu sitedeki etkin takma adlar (ADR-0031) */
  pseudonyms: PseudonymEntry[];
  /** Bu doğrulayıcıyla ilgili silme talepleri ve veri koruma kurumu bildirimleri (TS7 / TS8) — yeniden eskiye */
  requests: WalletEvent[];
}

const isDomain = (k: string) => k !== PROXIMITY_RP_KEY && !k.includes(":") && k.includes(".");

/** Günlüğü doğrulayıcıya göre gruplar; son etkinliği en yeni olan önce. */
export function sharedWith(state: WalletState): SharedParty[] {
  const by = new Map<string, SharedParty>();
  const party = (key: string): SharedParty => {
    let p = by.get(key);
    if (!p) {
      p = {
        key,
        domain: isDomain(key) ? key : undefined,
        shares: [],
        sentCount: 0,
        lastActivityAt: 0,
        fields: [],
        pseudonyms: [],
        requests: [],
      };
      by.set(key, p);
    }
    return p;
  };
  for (const e of state.presentationLog) {
    const p = party(e.clientId);
    p.shares.push(e);
    p.lastActivityAt = Math.max(p.lastActivityAt, e.ts);
    if (e.outcome === "sent") {
      p.sentCount++;
      p.lastSharedAt = Math.max(p.lastSharedAt ?? 0, e.ts);
      for (const f of e.disclosed) if (!p.fields.includes(f)) p.fields.push(f);
    }
  }
  for (const e of state.events ?? []) {
    if ((e.kind === "deletion_request" || e.kind === "dpa_report") && e.clientId) {
      const p = party(e.clientId);
      p.requests.push(e);
      p.lastActivityAt = Math.max(p.lastActivityAt, e.ts);
    }
  }
  for (const rpKey of new Set((state.pseudonyms ?? []).map((x) => x.rpKey))) {
    const active = activePseudonyms(state, rpKey);
    if (!active.length) continue;
    const p = party(rpKey);
    p.pseudonyms = active;
    p.lastActivityAt = Math.max(p.lastActivityAt, ...active.map((x) => x.lastUsedAt ?? x.createdAt));
  }
  const out = [...by.values()];
  for (const p of out) {
    p.shares.sort((a, b) => b.ts - a.ts);
    p.requests.sort((a, b) => b.ts - a.ts);
  }
  return out.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
}
