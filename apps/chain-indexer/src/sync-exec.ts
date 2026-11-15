/**
 * Sürekli projeksiyon — fark işlemlerinin zincire YÜRÜTÜLMESİ (ADR-0085 SP2, SP4–SP7; ADR-0084 LS4). Göç yürütücüsünden
 * (replay-exec.ts) farkları:
 *   - Yalnız göç penceresi KAPALIYKEN çalışır (göç bitmiş olmalı; açık ya da hiç açılmamış pencerede yazım yok — CE1).
 *   - Tarihler blok anıdır: durum, kayıt ve yetki yazımları tarihsiz (`…At(…, 0)`) çağrılır; geçmiş tarih yalnız kontratın kip
 *     dışında da kabul ettiği iki alanda kalır: sert iptal (`invalidatesFrom`, CE2) ve iptal listesi yayın anı (L1b).
 *   - "Zincirde var mı" sorusu tarihle değil son hâlle cevaplanır (işlemler birleştirilmiştir, SP3): kurum askıdaysa askı yazılmaz,
 *     kayıt verisi aynıysa yazılmaz. Böylece yarıda kalan koşu aynı farkla yeniden çalıştırılabilir (SP5).
 *   - Ağ düzeyi kayıtlar ve ağ şemaları Governance önerisiyle (PJ3): kayıt sahneye konur, öneri açılır; oy verenler verilmediyse
 *     öneri bekler, öteki işlemler sürer (SP4).
 *   - Bir işlem düşerse koşu durmaz; düşen işlem raporlanır ve koşu "eksik" sayılır (durum ilerlemez, fark sonraki koşuda yine
 *     denenir — SP5). Yazım bütçesi aşılırsa kalan işlemler sonraki koşuya kalır (SP6).
 */
import { type Contract, type ContractTransactionResponse, type Signer } from "ethers";

import {
  CAStatus,
  IssuerStatus,
  MIGRATING_REGISTRIES,
  MigrationPhase,
  PeriodAction,
  RPStatus,
  SchemaStatus,
  type TrustContracts,
} from "./contracts.js";
import { ZERO32, bytes2, canonicalJson } from "./ids.js";
import { passProposal, type ReplaySigners } from "./replay-exec.js";
import type { ReplayOp } from "./replay-plan.js";

/** Planlayıcının işlemi (apps/trust-publisher/src/chain/sync-plan.ts `ChainOp`). */
export type SyncOp = ReplayOp & { listedFrom?: number };

export const DEFAULT_MAX_WRITES = 500;

export interface SyncReport {
  total: number;
  written: number;
  skipped: number;
  /** bütçe (SP6) yüzünden sonraki koşuya kalan işlem */
  deferred: number;
  /** düşen işlemler (koşu eksik; SP5) */
  failed: Array<{ seq: number; op: string; src: string; reason: string }>;
  /** Governance oyu bekleyen işlemler (SP4) */
  pendingGovernance: Array<{ seq: number; op: string; src: string }>;
  /** gecikme aralıkları `[liste tarihi, zincir tarihi)` (SP2) */
  lagWindows: Array<[number, number]>;
  /** en büyük gecikme (saniye): zincir tarihi − liste tarihi */
  maxLagSec: number;
  complete: boolean;
}

const as = (c: Contract, s: Signer) => c.connect(s) as Contract;
const num = (x: unknown) => Number(x);
const eq = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
/**
 * Karşılaştırma için düz değer: ethers `Result` (adlı yapı) → nesne, bigint → sayı, metin → küçük harf, iç içe. JSON'a çevirip geri
 * okumak `Result`'ın alan adlarını düşürür (dizi olur) ve kayıt verisi hiç eşit çıkmaz — bu yüzden doğrudan gezilir.
 */
function plain(v: unknown): unknown {
  if (typeof v === "bigint") return v <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(v) : v.toString();
  if (Array.isArray(v)) {
    const r = v as unknown as { toObject?: () => Record<string, unknown> };
    let keys: string[] = [];
    try {
      keys = Object.keys(r.toObject?.() ?? {});
    } catch {
      keys = []; // adsız dizi
    }
    if (keys.length && !keys.every((k) => /^\d+$/.test(k)))
      return Object.fromEntries(keys.map((k) => [k, plain((v as unknown as Record<string, unknown>)[k])]));
    return v.map(plain);
  }
  if (v && typeof v === "object")
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, plain(x)]));
  if (typeof v === "string") return v.toLowerCase();
  return v;
}
const lower = plain;

/** Göç penceresi bütün kayıtlarda kapalı mı? Değilse neden (sürekli projeksiyon göçten sonra başlar). */
export async function syncProblems(c: TrustContracts): Promise<string[]> {
  const out: string[] = [];
  for (const name of MIGRATING_REGISTRIES) {
    const phase = num(await c[name].migrationPhase());
    if (phase === MigrationPhase.OPEN) out.push(`${name}: göç penceresi açık — önce göç biter (CE1)`);
    else if (phase === MigrationPhase.NOT_STARTED) out.push(`${name}: göç yapılmamış — önce trust:chain-replay`);
  }
  return out;
}

/** İşlemin hedef hâli zincirde zaten var mı (son hâl; tarih aranmaz). */
async function applied(c: TrustContracts, o: SyncOp, me: (cc: string) => Promise<string>): Promise<boolean> {
  const rp = c.RelyingPartyRegistry;
  switch (o.op) {
    case "registerRootCA":
      return Boolean(await c.RootCARegistry.exists(o.caId));
    case "rootCAStatus":
      return num((await c.RootCARegistry.getRootCA(o.caId)).status) === CAStatus[o.status];
    case "rootCARollover":
      return (await c.RootCARegistry.queryFilter(c.RootCARegistry.filters.RootCARollingOver(o.caId))).length > 0;
    case "registerSchema":
      return Boolean(await c.SchemaRegistry.exists(o.schemaId));
    case "addSchemaHash":
      return ((await c.SchemaRegistry.contentHashesOf(o.schemaId)) as string[]).some(
        (h) => h.toLowerCase() === o.contentHash.toLowerCase(),
      );
    case "schemaStatus":
      return num((await c.SchemaRegistry.getSchema(o.schemaId)).status) === SchemaStatus[o.status];
    case "registerIssuer":
      return String(await c.IssuerRegistry.stateOf(o.issuerId)) !== "0x0000";
    case "issuerStatus":
      return (
        num((await c.IssuerRegistry.getIssuer(o.issuerId)).status) ===
        (o.status === "RETIRED" ? IssuerStatus.REVOKED : IssuerStatus[o.status])
      );
    case "issuerInvalidatesFrom": {
      const cur = num(await c.IssuerRegistry.invalidatesFromOf(o.issuerId));
      return cur !== 0 && cur <= o.invalidatesFrom;
    }
    case "renewIssuer":
      return num((await c.IssuerRegistry.getIssuer(o.issuerId)).validUntil) >= o.validUntil;
    case "issuerProfile":
      return eq(lower(await c.IssuerRegistry.issuerProfileOf(o.issuerId)), lower(o.profile));
    case "schemaAuth":
      return Boolean((await c.IssuerRegistry.schemaAuthOf(o.issuerId, o.schemaId)).allowed) === o.allowed;
    case "issuerDelegates": {
      const a = await me((o.who as { state: string }).state);
      return ((await c.IssuerRegistry.issuerDelegatesOf(o.issuerId)) as string[]).some(
        (x) => x.toLowerCase() === a.toLowerCase(),
      );
    }
    case "registerList":
      return ((await c.StatusListRegistry.getListsByIssuer(o.issuerId)) as string[]).some(
        (x) => x.toLowerCase() === o.listId.toLowerCase(),
      );
    case "publishList":
      return num((await c.StatusListRegistry.getListAnchor(o.listId)).version) >= o.version;
    case "recognition":
      return num((await c.CrossRecognition.getPolicy(bytes2(o.recognizing), bytes2(o.recognized))).mode) === o.mode;
    case "registerRP":
      return ((await rp.relyingPartyStatusHistoryOf(o.rpId)) as unknown[]).length > 0;
    case "rpStatus":
      return num((await rp.getRelyingParty(o.rpId)).status) === RPStatus[o.status];
    case "rpCert":
      return String((await rp.getRelyingParty(o.rpId)).accessCertFingerprint).toLowerCase() === o.fp.toLowerCase();
    case "rpPeriod": {
      const r = await rp.getRelyingParty(o.rpId);
      return String(r.stateCode).toLowerCase() === bytes2(o.toState) && num(r.status) === RPStatus.ACTIVE;
    }
    case "rpProfile":
      return eq(lower(await rp.relyingPartyProfileOf(o.rpId)), lower(o.profile));
    case "rpScope":
      return ((await rp.requestScopesOf(o.rpId)) as unknown[]).some((s) => eq(lower(s), lower(o.scope)));
    case "rpGroup": {
      const [owner, g] = await rp.terminalGroupOf(o.group.groupId);
      return String(owner).toLowerCase() === o.rpId.toLowerCase() && eq(lower(g), lower(o.group));
    }
    case "networkRecord": {
      // `flags` uint256: planda metin, zincirde bigint — ikisi de onluk metne
      const norm = (x: unknown) => {
        const r = lower(x) as Record<string, unknown>;
        return { ...r, flags: BigInt(r.flags as string | number).toString() };
      };
      return eq(norm(await c.NetworkRegistry.getRecord(o.record.kind, o.record.recordId)), norm(o.record));
    }
  }
}

type Sent = { ts: number } | "pending";

/** Tek işlemi blok anıyla yazar. Dönen: yazıldığı bloğun anı ya da Governance oyu bekliyor. */
async function apply(c: TrustContracts, o: SyncOp, s: ReplaySigners): Promise<Sent> {
  const signer = o.who.role === "state" ? s.state(o.who.state) : s.executor;
  let ts = 0;
  const wait = async (p: Promise<ContractTransactionResponse>) => {
    const tx = await p;
    const rc = await tx.wait();
    if (!rc || rc.status !== 1) throw new Error(`chain-sync: işlem başarısız ${tx.hash}`);
    const b = await rc.getBlock();
    ts = Math.max(ts, b.timestamp);
    return rc;
  };
  /** Governance önerisi (PJ3): oy verenler yoksa öneri bekler (gerçek ağda oy üyelerindir). */
  const governance = async (propose: (g: Contract) => Promise<ContractTransactionResponse>): Promise<Sent> => {
    if (!s.governance) return "pending";
    await passProposal(c, s.governance, propose);
    const b = await c.Governance.runner!.provider!.getBlock("latest");
    return { ts: b!.timestamp };
  };
  const done = (): Sent => ({ ts });
  switch (o.op) {
    case "registerRootCA": {
      const now = num((await c.RootCARegistry.runner!.provider!.getBlock("latest"))!.timestamp);
      await wait(
        as(c.RootCARegistry, signer).registerRootCA({
          caId: ZERO32,
          stateCode: bytes2(o.state),
          certFingerprint: o.fp,
          subjectHash: o.subjectHash,
          certURI: "",
          crlURI: "",
          status: CAStatus.ACTIVE,
          validFrom: o.validFrom > now + 1 ? o.validFrom : 0, // geçmiş başlangıç kip dışında blok anı (PastDateOutsideMigration)
          validUntil: o.validUntil,
          registeredAt: 0,
        }),
      );
      return done();
    }
    case "rootCAStatus": {
      const r = as(c.RootCARegistry, signer);
      if (o.status === "SUSPENDED") await wait(r.suspendRootCAAt(o.caId, 0));
      else if (o.status === "ACTIVE") await wait(r.reinstateRootCAAt(o.caId, 0));
      else if (o.status === "RETIRED") await wait(r.retireRootCAAt(o.caId, ZERO32, 0));
      else await wait(r.revokeRootCAAt(o.caId, o.reasonHash, 0));
      return done();
    }
    case "rootCARollover":
      await wait(as(c.RootCARegistry, signer).announceRootCARollover(o.caId, o.successor));
      return done();
    case "registerSchema": {
      const rec = {
        vctURI: o.vct,
        contentHash: o.contentHash,
        version: "1",
        tier: o.tier,
        stateCode: o.tier === 1 ? bytes2(o.state) : "0x0000",
        status: SchemaStatus.ACTIVE,
        validFrom: 0,
        supersededBy: ZERO32,
      };
      if (o.tier === 0) return governance((g) => g.proposeNetworkSchema(rec));
      await wait(as(c.SchemaRegistry, signer).registerSchema(rec));
      return done();
    }
    case "addSchemaHash": {
      if (o.who.role !== "state")
        return governance((g) => g.proposeNetworkSchemaContentHash(o.schemaId, o.contentHash));
      await wait(as(c.SchemaRegistry, signer).addSchemaContentHash(o.schemaId, o.contentHash));
      return done();
    }
    case "schemaStatus":
      if (o.who.role !== "state")
        return governance((g) =>
          o.status === "DEPRECATED"
            ? g.proposeNetworkSchemaDeprecation(o.schemaId, ZERO32)
            : g.proposeNetworkSchemaRevocation(o.schemaId, o.reasonHash),
        );
      if (o.status === "DEPRECATED") await wait(as(c.SchemaRegistry, signer).deprecateSchemaAt(o.schemaId, ZERO32, 0));
      else await wait(as(c.SchemaRegistry, signer).revokeSchemaAt(o.schemaId, o.reasonHash, 0));
      return done();
    case "registerIssuer": {
      const now = num((await c.IssuerRegistry.runner!.provider!.getBlock("latest"))!.timestamp);
      await wait(
        as(c.IssuerRegistry, signer).registerIssuer({
          issuerId: ZERO32,
          stateCode: bytes2(o.state),
          nameHash: o.nameHash,
          category: o.category,
          assurance: o.assurance,
          certFingerprint: o.fp,
          parentCA: o.parentCA,
          metadataURI: "",
          status: IssuerStatus.ACTIVE,
          validFrom: o.validFrom > now + 1 ? o.validFrom : 0,
          validUntil: o.validUntil,
          successorId: ZERO32,
          registeredAt: 0,
          revokedAt: 0,
        }),
      );
      return done();
    }
    case "issuerStatus": {
      const r = as(c.IssuerRegistry, signer);
      if (o.status === "SUSPENDED") await wait(r.suspendIssuerAt(o.issuerId, 0));
      else if (o.status === "ACTIVE") await wait(r.reinstateIssuerAt(o.issuerId, 0));
      else if (o.status === "RETIRED") await wait(r.retireIssuer(o.issuerId, o.successor ?? ZERO32, 0));
      else await wait(r.revokeIssuerAt(o.issuerId, o.successor ?? ZERO32, 0));
      return done();
    }
    case "issuerInvalidatesFrom":
      await wait(as(c.IssuerRegistry, signer).setIssuerInvalidatesFrom(o.issuerId, o.invalidatesFrom));
      return done();
    case "renewIssuer":
      await wait(as(c.IssuerRegistry, signer).renewIssuer(o.issuerId, o.validUntil));
      return done();
    case "issuerProfile":
      await wait(as(c.IssuerRegistry, signer).setIssuerProfile(o.issuerId, o.profile));
      return done();
    case "schemaAuth":
      await wait(as(c.IssuerRegistry, signer).setSchemaAuthorization(o.issuerId, o.schemaId, o.allowed));
      return done();
    case "issuerDelegates": {
      const cur = (await c.IssuerRegistry.issuerDelegatesOf(o.issuerId)) as string[];
      await wait(as(c.IssuerRegistry, signer).setIssuerDelegates(o.issuerId, [...cur, await signer.getAddress()]));
      return done();
    }
    case "registerList":
      await wait(as(c.StatusListRegistry, signer).registerList(o.issuerId, o.listUri, o.size, o.bits));
      return done();
    case "publishList": {
      // yayın anı listedeki an (kip dışında da geçmiş kabul edilir, L1b); zincirdeki son yayından eskiyse blok anı
      const last = num((await c.StatusListRegistry.getListAnchor(o.listId)).publishedAt);
      await wait(
        as(c.StatusListRegistry, signer).publishList(o.listId, o.contentHash, o.version, o.at >= last ? o.at : 0),
      );
      return done();
    }
    case "recognition":
      await wait(
        as(c.CrossRecognition, signer).setRecognition(bytes2(o.recognizing), bytes2(o.recognized), o.mode, []),
      );
      return done();
    case "registerRP":
      await wait(
        as(c.RelyingPartyRegistry, signer).registerRelyingParty({
          rpId: o.rpId,
          stateCode: bytes2(o.state),
          nameHash: o.nameHash,
          accessCertFingerprint: o.fp,
          status: 1,
          registeredAt: 0,
        }),
      );
      return done();
    case "rpStatus": {
      const r = as(c.RelyingPartyRegistry, signer);
      if (o.status === "SUSPENDED") await wait(r.suspendRelyingPartyAt(o.rpId, 0));
      else if (o.status === "ACTIVE") await wait(r.reinstateRelyingPartyAt(o.rpId, 0));
      else await wait(r.revokeRelyingPartyAt(o.rpId, 0));
      return done();
    }
    case "rpCert":
      await wait(as(c.RelyingPartyRegistry, signer).updateAccessCertificate(o.rpId, o.fp));
      return done();
    case "rpScope":
      await wait(as(c.RelyingPartyRegistry, signer).setRequestScope(o.rpId, o.scope));
      return done();
    case "rpGroup":
      await wait(as(c.RelyingPartyRegistry, signer).setTerminalGroup(o.rpId, o.group));
      return done();
    case "rpProfile":
      await wait(as(c.RelyingPartyRegistry, signer).setRelyingPartyProfile(o.rpId, o.profile));
      return done();
    case "rpPeriod": {
      if (!s.governance) return "pending";
      const change = {
        action: PeriodAction[o.action],
        rpId: o.rpId,
        fromState: bytes2(o.fromState),
        toState: bytes2(o.toState),
        nameHash: o.nameHash,
        accessCertFingerprint: o.fp,
        reasonHash: o.reasonHash,
      };
      const reg = await c.RelyingPartyRegistry.getAddress();
      const stageId = (await c.RelyingPartyRegistry.periodChangeIdOf(change)) as string;
      await wait(as(c.RelyingPartyRegistry, s.executor).stagePeriodChange(change));
      return governance((g) =>
        o.action === "REASSIGNMENT"
          ? g.proposeRelyingPartyReassignment(reg, stageId)
          : g.proposeRelyingPartyReRegistration(reg, stageId),
      );
    }
    case "networkRecord": {
      // PJ3: kayıt sahneye konur (herkes koyabilir; içerik özetiyle), yalnız Governance oyu yazar
      const reg = await c.NetworkRegistry.getAddress();
      const stageId = (await c.NetworkRegistry.stageIdOf(o.record)) as string;
      await wait(as(c.NetworkRegistry, s.executor).stageRecord(o.record));
      return governance((g) => g.proposeNetworkRecord(reg, stageId));
    }
  }
}

/** Gecikmenin ölçüldüğü liste tarihi (kayıtta geçerlilik başlangıcı da: zincirde blok anından başlar). */
function listedAt(o: SyncOp): number | null {
  const from = o.listedFrom ?? o.at;
  switch (o.op) {
    case "registerRootCA":
    case "registerIssuer":
      return Math.min(from, o.validFrom);
    case "rootCAStatus":
    case "issuerStatus":
    case "rpStatus":
    case "registerRP":
    case "registerSchema":
    case "schemaStatus":
    case "schemaAuth":
    case "rpPeriod":
      return from;
    default:
      return null; // tarihsiz son hâl yazımı ya da tarihi listedeki gibi yazılan alan (iptal listesi yayını, sert iptal)
  }
}

/**
 * Fark işlemlerini yürütür. Göç penceresi kapalı olmalı (syncProblems). Zincirde olan işlem atlanır; bütçeyi aşan işlem sonraki
 * koşuya kalır; düşen işlem raporlanır, koşu sürer.
 */
export async function executeChainSync(
  ops: SyncOp[],
  c: TrustContracts,
  s: ReplaySigners,
  opts: {
    maxWrites?: number;
    onProgress?: (o: SyncOp, result: "written" | "skipped" | "deferred" | "failed") => void;
  } = {},
): Promise<SyncReport> {
  const problems = await syncProblems(c);
  if (problems.length) throw new Error(`chain-sync: zincir hazır değil — ${problems.join("; ")}`);
  const budget = opts.maxWrites ?? DEFAULT_MAX_WRITES;
  const addr = new Map<string, string>();
  const me = async (cc: string) => {
    if (!addr.has(cc)) addr.set(cc, await s.state(cc).getAddress());
    return addr.get(cc)!;
  };
  const r: SyncReport = {
    total: ops.length,
    written: 0,
    skipped: 0,
    deferred: 0,
    failed: [],
    pendingGovernance: [],
    lagWindows: [],
    maxLagSec: 0,
    complete: false,
  };
  for (const o of ops) {
    let isApplied: boolean;
    try {
      isApplied = await applied(c, o, me);
    } catch (e) {
      r.failed.push({ seq: o.seq, op: o.op, src: o.src, reason: (e as Error).message.slice(0, 200) });
      opts.onProgress?.(o, "failed");
      continue;
    }
    if (isApplied) {
      r.skipped++;
      // birleştirilmiş ara durumlar (SP3): zincirde hiç olmadılar — listedeki ilk ara an ile son hâlin anı arası gecikme aralığı
      if (o.listedFrom !== undefined && o.listedFrom < o.at) r.lagWindows.push([o.listedFrom, o.at]);
      opts.onProgress?.(o, "skipped");
      continue;
    }
    if (r.written >= budget) {
      r.deferred++;
      opts.onProgress?.(o, "deferred");
      continue;
    }
    try {
      const sent = await apply(c, o, s);
      if (sent === "pending") {
        r.pendingGovernance.push({ seq: o.seq, op: o.op, src: o.src });
        continue;
      }
      r.written++;
      const t = listedAt(o);
      if (t !== null && sent.ts > t) {
        r.lagWindows.push([t, sent.ts]);
        r.maxLagSec = Math.max(r.maxLagSec, sent.ts - t);
      }
      opts.onProgress?.(o, "written");
    } catch (e) {
      r.failed.push({ seq: o.seq, op: o.op, src: o.src, reason: (e as Error).message.slice(0, 200) });
      opts.onProgress?.(o, "failed");
    }
  }
  r.complete = !r.failed.length && !r.pendingGovernance.length && !r.deferred;
  return r;
}
