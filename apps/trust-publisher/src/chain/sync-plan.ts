/**
 * Sürekli projeksiyon — SAF PLANLAYICI (ADR-0085 SP1–SP3; ADR-0074 PJ1; ADR-0084 LS1). Son yansıtılan imzalı liste seti ile
 * şimdiki set arasındaki farkı zincir işlemlerine çevirir. Ağ erişimi yok; aynı girdi → aynı plan.
 *
 * Yöntem: yeniden oynatma plan motoru (apps/chain-indexer/src/replay-plan.ts) iki kez çalışır — önceki set (son yansıtılan
 * sürümlere kadar olan arşiv, o koşunun anıyla) ve şimdiki set (bütün arşiv, bu koşunun anıyla). Şimdiki planda olup öncekinde
 * olmayan işlemler farktır: plan(şimdi) − plan(önce). Böylece göç (bir kez) ve sürekli projeksiyon aynı eşlemeyi kullanır; bir
 * kaydın zincirdeki karşılığı iki yolda farklı olamaz. Kişisel veri ve serbest metin bu modülden geçmez (PJ2: plan motoru yalnız
 * özet yazar).
 *
 * Fark işlemleri iki kuralla sadeleşir:
 *   - SP3 birleştirme: göç penceresi dışında zincir tarihi blok anıdır (ADR-0073 CE1). Aynı kayda aynı koşuda düşen ara durumlar
 *     (askı → dönüş, yetki aç → kapa, aynı kayıt verisinin iki sürümü, aynı iptal listesinin birden çok sürümü) aynı anda yazılacağı
 *     için sıfır uzunlukta pencere olurdu; yalnız son hâl yazılır. Liste tarihinin en erkeni `listedFrom`'da tutulur (gecikme
 *     aralığı SP2 bundan ölçülür).
 *   - SP3 bekleyen iş: plan "şimdi"si koşu anıdır; listede ileri tarihli kayıt (ör. yetki bitişi) bugün yazılmaz, zamanı gelince
 *     sonraki koşunun farkında çıkar (öncekinin anında yoktu, şimdikinde var).
 */
import {
  buildReplayPlan,
  ordinalKey,
  type ArchiveSet,
  type PlanOptions,
  type ReplayOp,
} from "../../../chain-indexer/src/replay-plan.js";
import { canonicalJson } from "../../../chain-indexer/src/ids.js";

export const CHAIN_SYNC_FORMAT = "tamga-chain-sync-plan/1";

/** Zincir işlemi: yeniden oynatma işleminin aynısı + birleştirilen ara durumların en erken liste tarihi. */
export type ChainOp = ReplayOp & { listedFrom?: number };

/** Projeksiyon noktası: hangi liste sürümlerine ve çapa günlüğünün hangi satırına kadar yansıtıldı, hangi anda. */
export interface SyncPoint {
  /** "lotl" / "tl-tr" → son yansıtılan sürüm */
  versions: Record<string, number>;
  /** çapa günlüğünün son yansıtılan satırı (yoksa -1) */
  anchorSeq: number;
  /** o koşunun plan anı (epoch saniye) */
  planTime: number;
}

export interface SyncInput {
  archive: ArchiveSet;
  planTime: number;
}

export interface ChainSyncPlan {
  format: typeof CHAIN_SYNC_FORMAT;
  environment: "production" | "sandbox";
  from: SyncPoint | null;
  to: SyncPoint;
  /** yazılacak işlemler (birleştirilmiş, bağımlılık sırasıyla) */
  ops: ChainOp[];
  /** birleştirme (SP3) yüzünden yazılmayan ara işlem sayısı */
  collapsed: number;
  /** imzalı listelerin düzeyi: yansıtılan setin en son liste yayını (epoch saniye) — `ChainTrustSource` içerik bağı */
  level: number;
  /** yalnız bu farkta görünen plan uyarıları */
  warnings: string[];
  summary: Record<string, number>;
}

function payload<T>(jws: string): T {
  const p = jws.trim().split(".");
  if (p.length !== 3) throw new Error("chain-sync: JWS compact biçimi değil");
  return JSON.parse(Buffer.from(p[1], "base64url").toString("utf8")) as T;
}
const versionOf = (jws: string) => Number(payload<{ version: unknown }>(jws).version);
const issuedAtOf = (jws: string) =>
  Math.floor(Date.parse(String(payload<{ issued_at: unknown }>(jws).issued_at)) / 1000);
const anchorLines = (jsonl: string) => jsonl.split(/\r?\n/).filter((l) => l.trim());

/** Arşivin şimdiki noktası (son sürümler, son çapa satırı) — başarılı koşudan sonra durum dosyasına yazılır. */
export function syncPointOf(archive: ArchiveSet, planTime: number): SyncPoint {
  const versions: Record<string, number> = {};
  if (archive.lotl.length) versions.lotl = versionOf(archive.lotl.at(-1)!);
  for (const [file, list] of Object.entries(archive.national))
    if (list.length) versions[file] = versionOf(list.at(-1)!);
  const lines = anchorLines(archive.anchorsJsonl);
  const anchorSeq = lines.length ? Number(payload<{ seq: unknown }>(lines.at(-1)!).seq) : -1;
  return { versions, anchorSeq, planTime };
}

/** Arşivi bir projeksiyon noktasına keser (o noktadan sonraki sürümler ve çapa satırları çıkar). */
export function sliceArchive(archive: ArchiveSet, point: SyncPoint): ArchiveSet {
  const upTo = (list: string[], file: string) =>
    point.versions[file] === undefined ? [] : list.filter((j) => versionOf(j) <= point.versions[file]);
  const national: Record<string, string[]> = {};
  for (const [file, list] of Object.entries(archive.national)) {
    const kept = upTo(list, file);
    if (kept.length) national[file] = kept;
  }
  const lines = anchorLines(archive.anchorsJsonl).filter(
    (l) => Number(payload<{ seq: unknown }>(l).seq) <= point.anchorSeq,
  );
  return {
    ...archive,
    lotl: upTo(archive.lotl, "lotl"),
    national,
    anchorsJsonl: lines.join("\n") + (lines.length ? "\n" : ""),
  };
}

/** İşlemin kimliği (sıra numaraları ve kaynak etiketi hariç): iki plandaki aynı işlem aynı kimliği taşır. */
function identity(o: ReplayOp): string {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { seq, n, src, ...body } = o;
  return canonicalJson(body);
}

/** Birleştirme anahtarı (SP3): aynı anahtarlı işlemlerden yalnız sonuncusu yazılır; null → her işlem kalır. */
function collapseKey(o: ReplayOp, period: number): string | null {
  switch (o.op) {
    case "rootCAStatus":
      return `root|${o.caId}`;
    case "issuerStatus":
      return `issuer|${o.issuerId}`;
    case "rpStatus":
      // dönem değişikliğinden (devir / yeniden kayıt) önceki ve sonraki durumlar ayrı tutulur
      return `rp|${o.rpId}|${period}`;
    case "schemaAuth":
      return `auth|${o.issuerId}|${o.schemaId}`;
    case "schemaStatus":
      return `schema|${o.schemaId}`;
    case "renewIssuer":
      return `renew|${o.issuerId}`;
    case "publishList":
      return `publish|${o.listId}`;
    default:
      return ordinalKey(o); // kayıt verisi, kapsam, kapı grubu, sertifika, tanıma, ağ düzeyi kayıt: son hâl
  }
}

/** SP3: ara durumları birleştirir; kalan işlem son durumun yerinde, en erken liste tarihi `listedFrom`'da. */
export function collapseOps(ops: ReplayOp[]): { ops: ChainOp[]; collapsed: number } {
  const periods = new Map<string, number>();
  const keys: Array<string | null> = [];
  for (const o of ops) {
    if (o.op === "rpPeriod") periods.set(o.rpId, (periods.get(o.rpId) ?? 0) + 1);
    keys.push(collapseKey(o, o.op === "rpStatus" ? (periods.get(o.rpId) ?? 0) : 0));
  }
  const last = new Map<string, number>();
  const earliest = new Map<string, number>();
  keys.forEach((k, i) => {
    if (k === null) return;
    last.set(k, i);
    earliest.set(k, Math.min(earliest.get(k) ?? Infinity, ops[i].at));
  });
  const out: ChainOp[] = [];
  ops.forEach((o, i) => {
    const k = keys[i];
    if (k !== null && last.get(k) !== i) return;
    const from = k !== null ? earliest.get(k)! : o.at;
    out.push({ ...o, ...(from < o.at ? { listedFrom: from } : {}) });
  });
  return { ops: out.map((o, k) => ({ ...o, seq: k })), collapsed: ops.length - out.length };
}

/**
 * `planChainSync(önceki, şimdiki)` → zincir işlemleri. `prev` null ise bütün set yeni sayılır (yalnız deneme: gerçek akışta
 * başlangıç noktası göçün planıdır, ADR-0085 SP7).
 */
export function planChainSync(prev: SyncInput | null, next: SyncInput, opts: PlanOptions = {}): ChainSyncPlan {
  const p1 = prev ? buildReplayPlan(prev.archive, { ...opts, planTime: prev.planTime }) : null;
  const p2 = buildReplayPlan(next.archive, { ...opts, planTime: next.planTime });
  const seen = new Map<string, number>();
  for (const o of p1?.ops ?? []) seen.set(identity(o), (seen.get(identity(o)) ?? 0) + 1);
  const fresh: ReplayOp[] = [];
  for (const o of p2.ops) {
    const k = identity(o);
    const c = seen.get(k) ?? 0;
    if (c > 0) seen.set(k, c - 1);
    else fresh.push(o);
  }
  const { ops, collapsed } = collapseOps(fresh);
  const old = new Set(p1?.warnings ?? []);
  const summary: Record<string, number> = {};
  for (const o of ops) summary[o.op] = (summary[o.op] ?? 0) + 1;
  const files = [...next.archive.lotl.slice(-1), ...Object.values(next.archive.national).map((l) => l.at(-1)!)];
  return {
    format: CHAIN_SYNC_FORMAT,
    environment: next.archive.environment,
    from: prev ? syncPointOf(prev.archive, prev.planTime) : null,
    to: syncPointOf(next.archive, next.planTime),
    ops,
    collapsed,
    level: Math.max(0, ...files.filter(Boolean).map(issuedAtOf)),
    warnings: p2.warnings.filter((w) => !old.has(w)),
    summary,
  };
}
