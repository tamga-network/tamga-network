/**
 * Yükleyici — lotl → tl-<cc> → anchors zincirini doğrular ve `TrustStore`'a yansıtır.
 *
 * Kurallar:
 *  - CMP2: bilinmeyen `list_format_version` → DUR (hata), sessiz yanlış yansıtma yok.
 *  - BT5/CMP4: `next_update` geçmiş → yükleme başarılı ama `freshness.healthy=false`.
 *  - lotl imzacısı: `rootFingerprints` (ilan sayfası / keys/root-fingerprints.json).
 *  - tl-<cc> imzacısı: lotl.national_lists[cc].signing_keys (ACTIVE olanlar).
 *  - anchors satırları: lotl.anchor_signing_keys; her satır önceki satırın sha256'sını taşır.
 *  - TL1: liste aşamasında operatör "provisional" ise `on_behalf_of` boş olamaz.
 *  - TL2 (geri sarma): `versionMemory` verilirse (kalıcı "son görülen" kaydı) lotl ve tl-<cc> için daha eski sürüm reddedilir;
 *    aynı sürüm farklı içerikle gelirse reddedilir; bir sonraki sürümde `previous_version_hash` son görülen JWS'in özetiyle
 *    (`sha256Tag(jws)`) eşleşmelidir. Verilmezse bu denetim yapılmaz (önceki davranış). Dış listelerde (`LoTESequenceNumber`)
 *    sıra belleği depodan BAĞIMSIZDIR: verilen `versionMemory`, yoksa süreç içi varsayılan bellek — her yeniden yüklemede yeni
 *    depo kurulsa da eski sıra numaralı liste reddedilir.
 * ADR-0015 (D-TRUST-1): kurallar TEK gerçeklemede ve platformdan bağımsızdır; imza doğrulama `JwsVerifier` olarak verilir
 * (Node: jose — `loadTrustSet`; cüzdan/React Native: saf TS doğrulayıcı). Bu dosya jose/node:fs içe aktarmaz.
 */
import { Anchor, Lotl, NationalList, KNOWN_FORMAT_VERSIONS } from "./types.js";
import { sha256Tag, utf8 } from "./portable-hash.js";
import { TrustStore, activeFps } from "./store.js";
import { parseLote } from "./lote-reader.js";

/**
 * İmza doğrulayıcı: izinli parmak izleri (null = yalnızca kendi x5c'si) ile JWS'i doğrular, yükü döndürür.
 * `opts.typ`: beklenen `typ`; verilmezse Tamga liste türü (`tamga-tl+jwt`). `null` = `typ` denetlenmez (ADR-0036: dış
 * işletmecilerin JAdES imzalı listeleri; imzacı yine sabitlenmiş parmak iziyle sınırlı).
 */
export type JwsVerifier = <T = unknown>(
  jws: string,
  allowedFingerprints: Set<string> | null,
  opts?: { typ?: string | null },
) => Promise<{ payload: T; signerFingerprint: string; raw: string }>;

/** Bir listenin son kabul edilen sürümü ve JWS özeti (`sha256:<hex>`, yayıncının `previous_version_hash` biçimi). */
export interface ListMark {
  version: number;
  hash: string;
}
/**
 * TL2: "son görülen" sürüm belleği — çağıran kalıcı kılar (dosya, veritabanı, cüzdan deposu). Anahtarlar: `lotl`,
 * `tl-<CC>` (ör. `tl-TR`), `ext:<list_id>` (dış liste; `version` = LoTESequenceNumber). `set` yalnız başarılı yüklemede çağrılır.
 */
export interface ListVersionMemory {
  get(key: string): ListMark | null | undefined;
  set(key: string, mark: ListMark): void;
}
/** Bellek içi `ListVersionMemory` (süreç ömrü; testler ve tek süreçli servisler için). */
export class MemoryListVersionMemory implements ListVersionMemory {
  private m = new Map<string, ListMark>();
  get(key: string) {
    return this.m.get(key) ?? null;
  }
  set(key: string, mark: ListMark) {
    this.m.set(key, mark);
  }
}
/** Dış listelerin varsayılan sıra belleği (süreç içi; `versionMemory` verilmezse). */
const defaultExternalMemory = new MemoryListVersionMemory();

/** TL2: yeni sürümü son görülenle karşılaştırır; sorun varsa hata iletisi döner. */
function rollbackProblem(
  label: string,
  last: ListMark | null | undefined,
  next: { version: number; hash: string; previous_version_hash: string | null },
): string | null {
  if (!last) return null;
  if (next.version < last.version)
    return `TL2: ${label} version ${next.version} older than last seen ${last.version} (rollback)`;
  if (next.version === last.version)
    return next.hash === last.hash ? null : `TL2: ${label} version ${next.version} seen before with different content`;
  if (next.version === last.version + 1 && next.previous_version_hash !== last.hash)
    return `TL2: ${label} previous_version_hash does not match the last seen version`;
  return null;
}

/** TL1: liste aşamasında operatör vekildir; kimin adına çalıştığı boş bırakılamaz. */
function checkOperator(label: string, op: { status: string; on_behalf_of?: string }) {
  if (op.status === "provisional" && !op.on_behalf_of?.trim())
    throw new Error(`TL1: ${label} operator is provisional but on_behalf_of is empty — DURDU`);
}

export interface TrustSetInput {
  lotlJws: string;
  nationalListJws: Record<string, string>; // state_code → jws
  anchorsJsonl: string; // satırlar JWS
  rootFingerprints: string[]; // lotl imzacı parmak izleri (hex)
  now?: Date;
  /** İstemci (cüzdan): çapa günlüğünü yükleme — RP/kurum sorguları için gerekmez; tazelik yalnızca listelerden. */
  skipAnchors?: boolean;
  /** Yalnızca bu devletlerin ulusal listeleri beklenir (ör. ["TR"]); verilmezse tüm ACTIVE listeler. */
  states?: string[];
  /** Çapa günlüğünün son satırı bundan eskiyse liste bayat sayılır (varsayılan 2 saat — saatlik kadans). */
  anchorMaxAgeMs?: number;
  /**
   * ADR-0036: dış listeler (list_id → JWS). Eksik ya da doğrulanamayan dış liste Tamga listelerinin tazeliğini BOZMAZ: o listeye
   * bağlı sorular UNKNOWN döner (TrustSource). Verilmezse dış liste yüklenmez.
   */
  externalListJws?: Record<string, string>;
  /** ADR-0038 SB2: beklenen ağ (varsayılan "production"); listedeki `environment` farklıysa yükleme DURUR. */
  environment?: "production" | "sandbox";
  /** TL2: kalıcı "son görülen" sürüm belleği (bkz. `ListVersionMemory`); verilmezse lotl/tl için geri sarma denetimi yok. */
  versionMemory?: ListVersionMemory;
}

export interface LoadReport {
  lotlVersion: number;
  nationalVersions: Record<string, number>;
  anchorsSeq: number;
  /** Bu yüklemede doğrulanan satır sayısı (kontrol noktası dahil); arşivdekiler sayılmaz. */
  anchorsLoaded: number;
  /** TL12: günlük kontrol noktasıyla başlıyorsa arşiv bilgisi; tam geçmiş için `archive.file` okunur. */
  checkpoint: { file: string; sha256: string; seq_from: number; seq_to: number; lines: number } | null;
  healthy: boolean;
  warnings: string[];
}

export async function loadTrustSetWith(
  input: TrustSetInput,
  verifyJws: JwsVerifier,
): Promise<{ store: TrustStore; report: LoadReport }> {
  const now = input.now ?? new Date();
  const warnings: string[] = [];

  // 1) LOTL
  const lotlV = await verifyJws<unknown>(input.lotlJws, new Set(input.rootFingerprints));
  const lotlRaw = lotlV.payload as { list_format_version?: string };
  if (!KNOWN_FORMAT_VERSIONS.has(String(lotlRaw.list_format_version))) {
    throw new Error(`CMP2: bilinmeyen list_format_version=${lotlRaw.list_format_version} — DURDU`);
  }
  const lotl: Lotl = Lotl.parse(lotlV.payload);
  const expectedEnv = input.environment ?? "production";
  if ((lotl.environment ?? "production") !== expectedEnv)
    throw new Error(`SB2: lotl environment=${lotl.environment ?? "production"}, beklenen ${expectedEnv} — DURDU`);
  checkOperator("lotl", lotl.operator);
  const mem = input.versionMemory;
  const marks: Array<[string, ListMark]> = [];
  const lotlMark = { version: lotl.version, hash: sha256Tag(utf8(lotlV.raw)) };
  const lotlProblem = rollbackProblem("lotl", mem?.get("lotl"), {
    ...lotlMark,
    previous_version_hash: lotl.previous_version_hash,
  });
  if (lotlProblem) throw new Error(`${lotlProblem} — DURDU`);
  marks.push(["lotl", lotlMark]);
  let healthy = true;
  if (new Date(lotl.next_update) < now) {
    healthy = false;
    warnings.push(`lotl next_update passed (${lotl.next_update})`);
  }

  const store = new TrustStore();
  store.applyLotl(lotl, lotlV.raw, now);

  // 2) Ulusal listeler
  const nationalVersions: Record<string, number> = {};
  for (const ptr of lotl.national_lists) {
    if (ptr.status !== "ACTIVE") continue;
    if (input.states && !input.states.includes(ptr.state_code)) continue;
    const jws = input.nationalListJws[ptr.state_code];
    if (!jws) {
      warnings.push(`tl-${ptr.state_code.toLowerCase()} verilmedi`);
      healthy = false;
      continue;
    }
    const fps = activeFps(ptr.signing_keys, now);
    if (fps.size === 0) throw new Error(`lotl: no active signing key for ${ptr.state_code}`);
    const v = await verifyJws<unknown>(jws, fps);
    const raw = v.payload as { list_format_version?: string; state_code?: string };
    if (!KNOWN_FORMAT_VERSIONS.has(String(raw.list_format_version)))
      throw new Error(`CMP2: tl-${ptr.state_code} bilinmeyen format — DURDU`);
    const tl: NationalList = NationalList.parse(v.payload);
    if ((tl.environment ?? "production") !== expectedEnv)
      throw new Error(
        `SB2: tl-${ptr.state_code} environment=${tl.environment ?? "production"}, beklenen ${expectedEnv} — DURDU`,
      );
    if (tl.state_code !== ptr.state_code)
      throw new Error(`tl state_code mismatch: ${tl.state_code} ≠ ${ptr.state_code}`);
    checkOperator(`tl-${tl.state_code}`, tl.operator);
    const key = `tl-${tl.state_code}`;
    const tlMark = { version: tl.version, hash: sha256Tag(utf8(v.raw)) };
    const tlProblem = rollbackProblem(key, mem?.get(key), {
      ...tlMark,
      previous_version_hash: tl.previous_version_hash,
    });
    if (tlProblem) throw new Error(`${tlProblem} — DURDU`);
    marks.push([key, tlMark]);
    if (new Date(tl.next_update) < now) {
      healthy = false;
      warnings.push(`tl-${tl.state_code} next_update passed`);
    }
    store.applyNationalList(tl, v.raw);
    nationalVersions[tl.state_code] = tl.version;
  }

  // 2b) ADR-0036 dış listeler — imzacı LOTL'da sabitlenmiş parmak izi; kapsam dışı kayıtlar alınmaz (FD2)
  if (input.externalListJws)
    warnings.push(...(await applyExternalListsWith(store, input.externalListJws, verifyJws, now, mem)));

  // 3) Çapa günlüğü — hash zinciri + imza (istemci atlayabilir)
  const anchorFps = activeFps(lotl.anchor_signing_keys, now);
  const lines = input.skipAnchors ? [] : input.anchorsJsonl.split(/\r?\n/).filter((l) => l.trim().length > 0);
  let prevHash: string | null = null;
  let expectedSeq = 0;
  let lastTs: Date | null = null;
  let checkpoint: Anchor | null = null;
  for (const [i, line] of lines.entries()) {
    const v = await verifyJws<unknown>(line, anchorFps);
    const a: Anchor = Anchor.parse(v.payload);
    if (i === 0 && a.kind === "checkpoint") {
      // TL12: imzalı kontrol noktası — önceki satırlar arşivde; zincir buradan devam eder
      if (a.seq !== a.archive.seq_to + 1)
        throw new Error(`anchors: checkpoint seq inconsistent (${a.seq} ≠ ${a.archive.seq_to + 1})`);
      // TL12: yükleyicinin başladığı kontrol noktası anlık durumu taşımak ZORUNDA; yoksa arşiv öncesi çapalar kaybolur
      if (!a.state) throw new Error("anchors: leading checkpoint carries no state snapshot (TL12) — re-archive");
      store.restoreSnapshot(a.state);
      checkpoint = a;
      expectedSeq = a.seq;
      prevHash = a.previous_hash;
    }
    if (a.seq !== expectedSeq) throw new Error(`anchors: seq out of order (expected ${expectedSeq}, got ${a.seq})`);
    if (a.previous_hash !== prevHash) throw new Error(`anchors: hash chain broken (seq ${a.seq})`);
    if (a.kind !== "checkpoint") store.applyAnchor(a);
    prevHash = sha256Tag(utf8(line));
    expectedSeq++;
    lastTs = new Date(a.ts);
  }
  // Saatlik kadans: son satır 2 saatten eskiyse bayat (S5 mantığı; yayın aralığı kısaltılan ortamlarda `anchorMaxAgeMs` ile)
  const maxAgeMs = input.anchorMaxAgeMs ?? 2 * 3600 * 1000;
  if (!input.skipAnchors && (!lastTs || now.getTime() - lastTs.getTime() > maxAgeMs)) {
    healthy = false;
    warnings.push("anchors stale or empty");
  }

  const deadlines = [new Date(lotl.next_update).getTime()];
  for (const { list } of store.national.values()) deadlines.push(new Date(list.next_update).getTime());
  if (!input.skipAnchors && lastTs) deadlines.push(lastTs.getTime() + maxAgeMs);
  store.setFreshness({
    source: "list",
    healthy,
    lotlVersion: lotl.version,
    anchorsSeq: expectedSeq - 1,
    loadedAt: now,
    staleAfter: new Date(Math.min(...deadlines)),
  });
  // TL2: bellek yalnız bütün yükleme başarılıysa ilerler
  if (mem) for (const [k, m] of marks) mem.set(k, m);
  return {
    store,
    report: {
      lotlVersion: lotl.version,
      nationalVersions,
      anchorsSeq: expectedSeq - 1,
      anchorsLoaded: lines.length,
      checkpoint: checkpoint && checkpoint.kind === "checkpoint" ? checkpoint.archive : null,
      healthy,
      warnings,
    },
  };
}

/**
 * ADR-0036: LOTL'daki ETKİN dış listeleri (`external_lists`) verilen JWS'lerle doğrular ve depoya uygular. Her liste bağımsızdır:
 * biri doğrulanamazsa yalnız o yüklenmez (uyarı); Tamga listelerinin tazeliği etkilenmez. Geri sarma: son görülen
 * `LoTESequenceNumber`'dan küçük sıra numaralı liste yüklenmez; bellek `memory` (yoksa süreç içi varsayılan) — depo her
 * yüklemede yeni kurulsa da bellek kalır.
 */
export async function applyExternalListsWith(
  store: TrustStore,
  externalListJws: Record<string, string>,
  verifyJws: JwsVerifier,
  now: Date,
  memory: ListVersionMemory = defaultExternalMemory,
): Promise<string[]> {
  const warnings: string[] = [];
  for (const ptr of store.lotl.external_lists ?? []) {
    if (ptr.status !== "ACTIVE") continue;
    if (ptr.format !== "etsi-lote-json") {
      warnings.push(`external ${ptr.list_id}: format ${ptr.format} not supported by this reader — not loaded`);
      continue;
    }
    const jws = externalListJws[ptr.list_id];
    if (!jws) {
      warnings.push(`external ${ptr.list_id}: not provided`);
      continue;
    }
    try {
      const fps = activeFps(ptr.signing_keys, now);
      if (fps.size === 0) throw new Error("no active signing key");
      const v = await verifyJws<unknown>(jws, fps, { typ: null });
      const lote = parseLote(v.payload);
      if (lote.territory !== ptr.territory) throw new Error(`territory mismatch: ${lote.territory} ≠ ${ptr.territory}`);
      const key = `ext:${ptr.list_id}`;
      const prev = store.external_lists.get(ptr.list_id);
      const last = memory.get(key);
      const lastSeq = Math.max(prev?.sequence ?? -1, last?.version ?? -1);
      if (lote.sequence < lastSeq)
        throw new Error(`sequence ${lote.sequence} older than the last seen list (${lastSeq}, rollback)`);
      warnings.push(...store.applyExternalList(ptr, lote));
      memory.set(key, { version: lote.sequence, hash: sha256Tag(utf8(v.raw)) });
      if (lote.nextUpdate < now)
        warnings.push(`external ${ptr.list_id}: NextUpdate passed — its entries answer UNKNOWN`);
    } catch (e) {
      warnings.push(`external ${ptr.list_id}: ${(e as Error).message} — not loaded`);
    }
  }
  return warnings;
}
