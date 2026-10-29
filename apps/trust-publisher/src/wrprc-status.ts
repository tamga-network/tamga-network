/**
 * ADR-0068 — kayıt sertifikası (WRPRC) politikası ve durum listesi (ETSI TS 119 475 V1.2.1 §6.1.3, §6.2.3.9–10, §6.2.6).
 *
 * - Politika (K1): kayıt defterinin `roles.registrar.wrprc` ayarı `policy_id` (OID dizisi) ve `certificate_policy` (politika
 *   belgesinin HTTPS adresi) verir; ayar yoksa sertifikaya bu alanlar ve `status` girmez (gerçek ağ, ad onayına kadar).
 * - Durum listesi (K3): IETF Token Status List, 1 bit (0 geçerli, 1 iptal; TS 119 475 REV-6.2.6.2-04), kayıt kurumu anahtarıyla
 *   imzalı (`statuslist+jwt`, x5c). Durum `dist/wrprc-status.json`'da kalıcıdır; her yayında:
 *     · aynı yol + aynı içerik özeti + bitişi önceki yayından erken değil → aynı indeks (yeniden imzalanan aynı sertifika),
 *     · yeni içerik ya da kısalan bitiş → yeni rastgele indeks, eski indeks İPTAL ("superseded"; REV-6.2.3.9-07),
 *     · yayında artık olmayan sertifika (kayıt/kullanım sona erdi, askıya alındı, kaldırıldı) → İPTAL ("registration_ended").
 *   İptal edilen indeks bir daha kullanılmaz. Elle iptal (`wrprc-revoke`) içeriği engeller: içerik değişene kadar aynı
 *   sertifika yeniden verilmez.
 * - Durum kaybı (0.7.4): durum dosyası yoksa ama daha önce bir durum listesi yayımlanmışsa yayıncı boş durumdan BAŞLAMAZ (iptal
 *   edilmiş indeksler sessizce "geçerli" olurdu); operatör `wrprc-status --reset --reason <gerekçe>` ile yayımlanmış listeden ve
 *   sertifikalardan durumu yeniden kurar (`recoverWrprcState`). Durum her değişiklikte `archive/`'e de yazılır.
 * - Adres değişimi (0.7.4): `status_list_uri` değişince iptal edilmiş girdiler ve engeller yeni listeye İPTAL olarak taşınır
 *   (`migrateWrprcState`); eski liste, ona işaret eden son sertifikanın süresi dolana kadar her yayında yeniden imzalanır.
 * - Elle iptal gerekçesi kapalı kümeden (`WRPRC_REVOCATION_REASONS`) + isteğe bağlı kısa not; not herkese açık CHANGELOG'a
 *   gittiği için e-posta, telefon/kimlik numarası ya da kişi adı gibi görünen metin reddedilir (`revocationNoteProblems`).
 * Kişisel veri yok: kayıtlar kurum ve kullanım kayıtlarıdır (yayın yolları zaten herkese açık).
 */
import { createHash } from "node:crypto";
import { IndexAllocator, StatusBitstring, MIN_CAPACITY, signStatusListToken } from "@tamga-network/sd-jwt";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rec = Record<string, any>;

/** Kayıt defterindeki ayar (`national_lists[].roles.registrar.wrprc`). */
export interface WrprcPolicyConfig {
  policy_id: string[];
  certificate_policy: string;
  /** durum listesinin adresi; yayın kökünün altında `/status/...` */
  status_list_uri: string;
}

/** Durum listesi yayın aralığı (saniye): `ttl` = 1 saat (her heartbeat yeniden imzalar), `exp` = 24 saat (kesinti tamponu). */
export const WRPRC_STATUS_TTL_SEC = 3600;
export const WRPRC_STATUS_EXP_SEC = 86400;
/** ETSI'nin AB politika OID'i (TS 119 475 §6.1.3): "revize eIDAS'a göre AB kayıt kurumunca verildi" anlamı taşır — Tamga kullanmaz. */
export const ETSI_EU_WRPRC_POLICY_OID = "0.4.0.19475.3.1";

const OID_RE = /^(0|1|2)(\.(0|[1-9][0-9]*))+$/;

/** Ayar denetimi; boş dizi = geçerli. `publicBase` = yayın kökü (ör. https://trust.sandbox.tamga.network). */
export function wrprcConfigProblems(cfg: unknown, publicBase: string): string[] {
  const p: string[] = [];
  const c = cfg as Partial<WrprcPolicyConfig> | null;
  if (!c || typeof c !== "object") return ["wrprc: ayar bir nesne olmalı"];
  if (!Array.isArray(c.policy_id) || !c.policy_id.length) p.push("wrprc.policy_id: en az bir OID");
  for (const o of c.policy_id ?? [])
    if (typeof o !== "string" || !OID_RE.test(o)) p.push(`wrprc.policy_id: geçersiz OID ${String(o)}`);
    else if (o === ETSI_EU_WRPRC_POLICY_OID)
      p.push(`wrprc.policy_id: ${o} AB kayıt kurumlarının politikasıdır; Tamga kullanmaz (ADR-0068 K1)`);
  if (typeof c.certificate_policy !== "string" || !/^https:\/\/[^\s]+$/.test(c.certificate_policy))
    p.push("wrprc.certificate_policy: https adresi");
  let u: URL | null = null;
  try {
    u = new URL(String(c.status_list_uri));
  } catch {
    p.push("wrprc.status_list_uri: geçersiz adres");
  }
  if (u) {
    if (u.origin !== new URL(publicBase).origin)
      p.push(`wrprc.status_list_uri: yayın kökünde olmalı (${new URL(publicBase).origin})`);
    if (!/^\/status\/[a-z0-9][a-z0-9/-]*$/.test(u.pathname) || u.search || u.hash)
      p.push("wrprc.status_list_uri: yol /status/<ad> biçiminde (küçük harf, rakam, tire)");
  }
  return p;
}

/** Durum listesinin `dist/` içindeki dosyası (adresin yolu). */
export const statusListFile = (cfg: WrprcPolicyConfig) => new URL(cfg.status_list_uri).pathname.slice(1);

export interface WrprcStatusEntry {
  idx: number;
  /** yayın yolu `wrprc/<rp|issuer>/…` */
  path: string;
  /** içerik özeti (iat, exp, status hariç) */
  digest: string;
  status: "VALID" | "REVOKED";
  issued_at: string;
  /** bu indeksle verilen en geç bitiş (saniye) */
  max_exp: number;
  revoked_at?: string;
  reason?: string;
}
export interface WrprcStatusState {
  list_uri: string;
  bits: 1;
  capacity: number;
  entries: WrprcStatusEntry[];
  /** elle iptal edilmiş içerik: aynı yol + özet yeniden verilmez */
  blocked: Array<{ path: string; digest: string; reason: string; at: string }>;
  /**
   * Adresi değişmiş eski listeler: ona işaret eden sertifikalar (`max_exp`) bitene kadar yeniden imzalanır. Girdileri donmuştur;
   * yalnız elle iptal bunları da iptal eder.
   */
  previous?: Array<{ list_uri: string; capacity: number; entries: WrprcStatusEntry[]; retired_at: string }>;
}

/** Elle iptal gerekçeleri (kapalı küme; herkese açık CHANGELOG'a yazılır). */
export const WRPRC_REVOCATION_REASONS = ["compromised", "superseded", "ceased", "policy_violation", "other"] as const;
export type WrprcRevocationReason = (typeof WRPRC_REVOCATION_REASONS)[number];
/** Notun en uzun hâli (karakter). */
export const WRPRC_NOTE_MAX = 120;

/**
 * Not denetimi (herkese açık metin): e-posta, uzun rakam dizisi (telefon / kimlik / vergi numarası), adres bağlantısı ve kişi adı
 * gibi görünen ardışık iki büyük harfle başlayan sözcük reddedilir. Sezgiseldir — notu kısa ve kişisiz yazın ("kurum isteği").
 */
export function revocationNoteProblems(note: string): string[] {
  const p: string[] = [];
  if (note.length > WRPRC_NOTE_MAX) p.push(`not en çok ${WRPRC_NOTE_MAX} karakter`);
  if (/[\p{Cc}]/u.test(note)) p.push("notta denetim karakteri olamaz");
  if (/\S+@\S+/.test(note)) p.push("notta e-posta adresi olamaz");
  if (/\d[\d\s().-]{6,}\d/.test(note)) p.push("notta telefon ya da kimlik numarası gibi rakam dizisi olamaz");
  if (/https?:\/\/|www\./i.test(note)) p.push("notta adres bağlantısı olamaz");
  if (/\p{Lu}\p{Ll}+\s+\p{Lu}\p{Ll}+/u.test(note)) p.push("notta kişi adı gibi görünen ifade olamaz (Ad Soyad)");
  return p;
}

export const emptyState = (listUri: string): WrprcStatusState => ({
  list_uri: listUri,
  bits: 1,
  capacity: MIN_CAPACITY,
  entries: [],
  blocked: [],
});

function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v as Rec)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((v as Rec)[k])}`)
      .join(",")}}`;
  return JSON.stringify(v);
}
/** Sertifikanın kimliği: içerik (yayın zamanı `iat`, bitiş `exp` ve `status` hariç) — özet sha256 onaltılık. */
export function contentDigest(payload: Rec): string {
  const { iat: _i, exp: _e, status: _s, ...rest } = payload;
  return createHash("sha256").update(canonical(rest)).digest("hex");
}

export interface AssignResult {
  state: WrprcStatusState;
  /** yol → indeks (yalnız verilecek sertifikalar) */
  idxOf: Map<string, number>;
  /** elle iptal edildiği için verilmeyen yollar */
  blocked: string[];
  /** bu yayında iptal edilen girdiler */
  revoked: WrprcStatusEntry[];
}

/**
 * Bu yayının sertifikalarına indeks verir ve artık geçerli olmayanları iptal eder (bkz. dosya başı). `items[].payload.exp`
 * saniye. Durum değiştirilmez; yeni durum döner.
 */
export function assignWrprcStatus(
  prev: WrprcStatusState,
  items: Array<{ path: string; payload: Rec }>,
  now: Date,
): AssignResult {
  const at = now.toISOString();
  const entries = prev.entries.map((e) => ({ ...e }));
  const alloc = new IndexAllocator(
    prev.capacity,
    entries.map((e) => e.idx),
  );
  const idxOf = new Map<string, number>();
  const blocked: string[] = [];
  const keep = new Set<WrprcStatusEntry>();
  for (const it of items) {
    const digest = contentDigest(it.payload);
    if (prev.blocked.some((b) => b.path === it.path && b.digest === digest)) {
      blocked.push(it.path);
      continue;
    }
    const exp = Number(it.payload.exp);
    let e = entries.find((x) => x.status === "VALID" && x.path === it.path && x.digest === digest && exp >= x.max_exp);
    if (e) e.max_exp = Math.max(e.max_exp, exp);
    else {
      e = { idx: alloc.allocate(), path: it.path, digest, status: "VALID", issued_at: at, max_exp: exp };
      entries.push(e);
    }
    keep.add(e);
    idxOf.set(it.path, e.idx);
  }
  const revoked: WrprcStatusEntry[] = [];
  const published = new Set(items.map((i) => i.path));
  for (const e of entries)
    if (e.status === "VALID" && !keep.has(e)) {
      e.status = "REVOKED";
      e.revoked_at = at;
      e.reason = published.has(e.path) && !blocked.includes(e.path) ? "superseded" : "registration_ended";
      revoked.push(e);
    }
  return { state: { ...prev, entries }, idxOf, blocked, revoked };
}

/**
 * Elle iptal (TS 119 475 REV-6.2.3.9-05/06: kayıt kurumunun iptal arayüzü): yolun geçerli sertifikası iptal edilir ve içeriği
 * engellenir; aynı yolun eski listelerdeki (`previous`) geçerli girdileri de iptal edilir. Gerekçe kapalı kümeden
 * (`WRPRC_REVOCATION_REASONS`), not isteğe bağlı ve kişisiz (`revocationNoteProblems`). Geçerli sertifika yoksa hata.
 */
export function revokeWrprc(
  prev: WrprcStatusState,
  path: string,
  reason: string,
  now: Date,
  note?: string,
): { state: WrprcStatusState; entry: WrprcStatusEntry } {
  const code = reason.trim();
  if (!code) throw new Error("wrprc-revoke: gerekçe zorunlu (--reason)");
  if (!(WRPRC_REVOCATION_REASONS as readonly string[]).includes(code))
    throw new Error(`wrprc-revoke: gerekçe şunlardan biri olmalı: ${WRPRC_REVOCATION_REASONS.join(", ")}`);
  const n = note?.trim() ?? "";
  const np = n ? revocationNoteProblems(n) : [];
  if (np.length) throw new Error(`wrprc-revoke: ${np.join("; ")}`);
  const text = n ? `${code} (${n})` : code;
  const entries = prev.entries.map((e) => ({ ...e }));
  const e = entries.find((x) => x.path === path && x.status === "VALID");
  if (!e) throw new Error(`wrprc-revoke: ${path} için geçerli kayıt sertifikası yok`);
  const at = now.toISOString();
  const revoke = (x: WrprcStatusEntry) => {
    x.status = "REVOKED";
    x.revoked_at = at;
    x.reason = `manual: ${text}`;
  };
  revoke(e);
  const previous = prev.previous?.map((l) => ({
    ...l,
    entries: l.entries.map((x) => {
      const c = { ...x };
      if (c.path === path && c.status === "VALID") revoke(c);
      return c;
    }),
  }));
  return {
    state: {
      ...prev,
      entries,
      blocked: [...prev.blocked, { path, digest: e.digest, reason: text, at }],
      ...(previous ? { previous } : {}),
    },
    entry: e,
  };
}

/**
 * Adres değişimi: yeni boş liste; iptal edilmiş girdiler yeni listeye yeni indeksle İPTAL olarak taşınır (tarih ve gerekçe
 * korunur), engeller aynen kalır; eski liste `previous`'a geçer ve sertifikaları bitene kadar yeniden imzalanır.
 */
export function migrateWrprcState(prev: WrprcStatusState, newUri: string, now: Date): WrprcStatusState {
  if (prev.list_uri === newUri) return prev;
  const next = emptyState(newUri);
  const alloc = new IndexAllocator(next.capacity, []);
  for (const e of prev.entries)
    if (e.status === "REVOKED")
      next.entries.push({
        ...e,
        idx: alloc.allocate(),
        reason: `migrated from ${prev.list_uri}: ${e.reason ?? ""}`.trim(),
      });
  return {
    ...next,
    blocked: [...prev.blocked],
    previous: [
      ...(prev.previous ?? []),
      { list_uri: prev.list_uri, capacity: prev.capacity, entries: prev.entries, retired_at: now.toISOString() },
    ],
  };
}

/** Sertifikalarının hepsinin süresi dolmuş eski listeleri bırakır (artık yeniden imzalanmaz). */
export function pruneRetiredLists(state: WrprcStatusState, now: Date): { state: WrprcStatusState; dropped: string[] } {
  if (!state.previous?.length) return { state, dropped: [] };
  const t = Math.floor(now.getTime() / 1000);
  const keep = state.previous.filter((l) => l.entries.some((e) => e.max_exp > t));
  const dropped = state.previous.filter((l) => !keep.includes(l)).map((l) => l.list_uri);
  const { previous: _p, ...rest } = state;
  return { state: keep.length ? { ...rest, previous: keep } : rest, dropped };
}

/**
 * Kayıp durumu yeniden kurar (`wrprc-status --reset`): yayımlanmış durum listesinin bitleri (1 = iptal; yol bilinmez, indeks bir
 * daha kullanılmaz) ve yayımlanmış sertifikalar (yol, indeks, içerik özeti, bitiş) üzerinden. Sertifikası olan ama bit 1 olan
 * indeks iptal sayılır.
 */
export function recoverWrprcState(
  listUri: string,
  publishedBits: { capacity: number; get(i: number): number } | null,
  publishedCerts: Array<{ path: string; payload: Rec }>,
  now: Date,
): WrprcStatusState {
  const at = now.toISOString();
  const s = emptyState(listUri);
  if (publishedBits) s.capacity = Math.max(s.capacity, publishedBits.capacity);
  const byIdx = new Map<number, WrprcStatusEntry>();
  for (const c of publishedCerts) {
    const st = c.payload?.status?.status_list;
    const idx = Number(st?.idx);
    if (st?.uri !== listUri || !Number.isInteger(idx) || idx < 0 || idx >= s.capacity) continue;
    byIdx.set(idx, {
      idx,
      path: c.path,
      digest: contentDigest(c.payload),
      status: "VALID",
      issued_at: at,
      max_exp: Number(c.payload.exp) || 0,
    });
  }
  if (publishedBits)
    for (let i = 0; i < publishedBits.capacity; i++)
      if (publishedBits.get(i) !== 0) {
        const e = byIdx.get(i);
        byIdx.set(i, {
          ...(e ?? { idx: i, path: "(recovered)", digest: "", issued_at: at, max_exp: 0 }),
          status: "REVOKED",
          revoked_at: at,
          reason: "recovered",
        });
      }
  s.entries = [...byIdx.values()].sort((a, b) => a.idx - b.idx);
  return s;
}

/** Durumun bit dizisi (1 bit; iptal = 1). */
export function statusBits(state: WrprcStatusState): StatusBitstring {
  const b = new StatusBitstring(state.capacity, undefined, 1);
  for (const e of state.entries) if (e.status === "REVOKED") b.set(e.idx, 1);
  return b;
}

/** `pemSigner` biçimindeki imzacı (kayıt kurumu anahtarı; x5c = sertifikası). */
export interface PublisherSigner {
  certDer: Uint8Array;
  sign(payload: Uint8Array, header: Record<string, unknown>): Promise<string>;
}

/** Durum listesi belirteci (`statuslist+jwt`, iss = yayın kökü, sub = liste adresi). */
export function signWrprcStatusList(
  state: WrprcStatusState,
  signer: PublisherSigner,
  now: Date,
  iss: string,
): Promise<string> {
  return signStatusListToken({
    signer: { x5c: [signer.certDer], sign: (header, payload) => signer.sign(payload, header) },
    iss,
    uri: state.list_uri,
    bitstring: statusBits(state),
    iat: Math.floor(now.getTime() / 1000),
    ttlSec: WRPRC_STATUS_TTL_SEC,
    expSec: WRPRC_STATUS_EXP_SEC,
  });
}

/** Sertifika yüküne politika ve durum alanları (TS 119 475 Tablo 7; GEN-6.2.6.1-02/04). */
export function withPolicyAndStatus(payload: Rec, cfg: WrprcPolicyConfig, idx: number): Rec {
  return {
    ...payload,
    policy_id: [...cfg.policy_id],
    certificate_policy: cfg.certificate_policy,
    status: { status_list: { idx, uri: cfg.status_list_uri } },
  };
}
