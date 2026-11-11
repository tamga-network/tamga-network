/**
 * `trust:chain-replay` — planın zincire YÜRÜTÜLMESİ (ADR-0073 K1). Kurallar:
 *   - Önce bütün göç kipli kayıtlarda pencere AÇIK ve önerinin `replayPlanHash`'i bu planın özeti olmalı (CE1); değilse yazım yok.
 *   - Kaldığı yerden sürer: her işlemden önce zincir okunur, işlem zaten yazılmışsa atlanır (idempotent). Durum yazımları
 *     tarihleriyle (doğrulayıcı durumları da listedeki anla, `*RelyingPartyAt`), doğrulayıcı durumları geçmiş uzunluğuyla, dönem
 *     değişiklikleri dönem sayısıyla tanınır.
 *   - Ulusal kayıtlar devletin delegesiyle, ağ düzeyi kayıtlar göç yürütücüsüyle; Governance oyu gereken işlem (ağ şemasının iptali,
 *     doğrulayıcı devri / yeniden kaydı) yalnız oy verenler verildiyse (yerel geliştirme zinciri) yürütülür, yoksa yürütme durur
 *     ve gereken öneri raporlanır (gerçek ağda oy üyelerindir).
 * İlk hatada durur (sonraki işlemler sıraya bağlı olabilir); yeniden çalıştırma kaldığı yerden devam eder.
 */
import { type Contract, type ContractTransactionResponse, type Signer } from "ethers";

import {
  CAStatus,
  IssuerStatus,
  MIGRATING_REGISTRIES,
  MigrationPhase,
  PeriodAction,
  SchemaStatus,
  type TrustContracts,
} from "./contracts.js";
import { ZERO32, bytes2, canonicalJson } from "./ids.js";
import { LOG_CHUNK } from "./indexer.js";
import type { ReplayOp, ReplayPlan, Who } from "./replay-plan.js";

export interface ReplayGovernance {
  /** öneriyi açan üye doğrulayıcısı */
  proposer: Signer;
  /** oy verenler (2/3 için yeterli üye doğrulayıcısı; öneren dahil olabilir) */
  voters: Signer[];
}
export interface ReplaySigners {
  /** devletin delege anahtarı (ulusal kayıtlar; kurumun iptal listesi için de kurum delegesi olarak atanır) */
  state(cc: string): Signer;
  /** göç penceresi önerisinin yetkilendirdiği tek göç yürütücüsü (ağ düzeyi kayıtlar) */
  executor: Signer;
  /** yalnız yerel geliştirme zincirinde: Governance önerilerini oylayıp yürütür */
  governance?: ReplayGovernance;
}

export interface ReplayReport {
  planHash: string;
  total: number;
  written: number;
  skipped: number;
  /** Governance oyu gerektiği için durulan işlem (gerçek ağ) */
  pendingGovernance?: { seq: number; op: string; src: string };
}

const wait = async (p: Promise<ContractTransactionResponse>) => {
  const tx = await p;
  const rc = await tx.wait();
  if (!rc || rc.status !== 1) throw new Error(`replay: işlem başarısız ${tx.hash}`);
  return rc;
};
const as = (c: Contract, s: Signer) => c.connect(s) as Contract;
const num = (x: unknown) => Number(x);
const hasHistory = (h: Array<{ since: bigint; status: bigint }>, since: number, status: number) =>
  h.some((c) => num(c.since) === since && num(c.status) === status);
const eq = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
/** ethers Result (yapı) → düz nesne (bigint → sayı ya da onaltılık metin), karşılaştırma için. */
function plain(v: unknown): unknown {
  if (typeof v === "bigint") return v <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(v) : v.toString();
  if (Array.isArray(v)) {
    const r = v as unknown as { toObject?: () => Record<string, unknown> };
    const keys = Object.keys(r.toObject?.() ?? {});
    if (keys.length && !keys.every((k) => /^\d+$/.test(k)))
      return Object.fromEntries(keys.map((k) => [k, plain((v as unknown as Record<string, unknown>)[k])]));
    return v.map(plain);
  }
  if (typeof v === "string") return v.toLowerCase();
  return v;
}
const lower = (o: unknown) => plain(JSON.parse(JSON.stringify(o, (_k, x) => (typeof x === "bigint" ? Number(x) : x))));

/** Göç penceresi bütün kayıtlarda açık ve bu planın özetiyle mi (CE1)? Değilse neden. */
export async function migrationProblems(c: TrustContracts, planHash: string, executor: string): Promise<string[]> {
  const out: string[] = [];
  for (const name of MIGRATING_REGISTRIES) {
    const reg = c[name];
    const phase = num(await reg.migrationPhase());
    if (phase !== MigrationPhase.OPEN) out.push(`${name}: göç penceresi açık değil (aşama ${phase})`);
    else {
      const st = await reg.migrationState();
      if (String(st.replayPlanHash).toLowerCase() !== planHash.toLowerCase())
        out.push(`${name}: pencerenin plan özeti farklı (${st.replayPlanHash})`);
      if (
        (name === "SchemaRegistry" || name === "NetworkRegistry") &&
        String(st.executor).toLowerCase() !== executor.toLowerCase()
      )
        out.push(`${name}: göç yürütücüsü farklı (${st.executor})`);
    }
  }
  return out;
}

/** Governance önerisini açar, oylar ve yürütür (yalnız oy verenler verildiyse — yerel geliştirme zinciri). */
export async function passProposal(
  c: TrustContracts,
  gov: ReplayGovernance,
  propose: (g: Contract) => Promise<ContractTransactionResponse>,
): Promise<void> {
  const rc = await wait(propose(as(c.Governance, gov.proposer)));
  const ev = rc.logs
    .map((l) => {
      try {
        return c.Governance.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find((e) => e?.name === "ProposalCreated");
  if (!ev) throw new Error("replay: ProposalCreated olayı yok");
  const id = ev.args.id as string;
  for (const v of gov.voters) await wait(as(c.Governance, v).vote(id, true));
  await wait(as(c.Governance, gov.proposer).execute(id));
}

/**
 * Yerel geliştirme zinciri için: bütün göç kipli kayıtlarda pencereyi Governance önerisiyle açar (gerçek ağda bu, üyelerin oyudur;
 * yeniden oynatma aracı açmaz). Açık olan atlanır.
 */
export async function openMigrationWindows(
  c: TrustContracts,
  gov: ReplayGovernance,
  planHash: string,
  executor: string,
  windowSec = 7 * 86400,
): Promise<void> {
  for (const name of MIGRATING_REGISTRIES) {
    if (num(await c[name].migrationPhase()) !== MigrationPhase.NOT_STARTED) continue;
    const reg = await c[name].getAddress();
    await passProposal(c, gov, (g) => g.proposeMigrationOpen(reg, planHash, windowSec, executor));
  }
}

/**
 * Bir olay süzgecinin bütün kayıtları, en çok `LOG_CHUNK` blokluk dilimlerle (düğümlerin `eth_getLogs` aralık sınırı; aralıksız
 * `queryFilter` uzun zincirde reddedilir ya da zaman aşımına uğrar — kontrol 2026-11-10). `fromBlock`: kontratların dağıtım bloğu
 * biliniyorsa oradan (varsayılan 0).
 */
export async function queryFilterPaged(k: Contract, filter: unknown, fromBlock = 0, chunk = LOG_CHUNK) {
  const provider = k.runner?.provider;
  if (!provider) throw new Error("replay: kontratın sağlayıcısı yok");
  const head = await provider.getBlockNumber();
  const out: Awaited<ReturnType<Contract["queryFilter"]>> = [];
  for (let lo = fromBlock; lo <= head; lo += chunk)
    out.push(...(await k.queryFilter(filter as never, lo, Math.min(lo + chunk - 1, head))));
  return out;
}

/** Son-hâl yazımları: olay sayısı (ya da kaydın yazım sayacı) planın sıra numarasına ulaştıysa yazılmış (`ReplayOp.n`). */
async function writes(c: TrustContracts, o: ReplayOp, fromBlock: number): Promise<number | null> {
  const count = async (k: Contract, f: unknown) => (await queryFilterPaged(k, f, fromBlock)).length;
  const rp = c.RelyingPartyRegistry;
  switch (o.op) {
    case "issuerProfile":
      return count(c.IssuerRegistry, c.IssuerRegistry.filters.IssuerProfileSet(o.issuerId));
    case "rpProfile":
      return count(rp, rp.filters.RelyingPartyProfileSet(o.rpId));
    case "rpScope":
      return count(rp, rp.filters.RequestScopeSet(o.rpId, o.scope.scopeHash));
    case "rpGroup":
      return count(rp, rp.filters.TerminalGroupSet(o.rpId, o.group.groupId));
    case "rpCert":
      return count(rp, rp.filters.AccessCertificateUpdated(o.rpId));
    case "recognition":
      // yerel dağıtım betiği kurucular arası tanımayı önceden yazmış olabilir: sayı fazlaysa yazılmış sayılır
      return count(
        c.CrossRecognition,
        c.CrossRecognition.filters.RecognitionSet(bytes2(o.recognizing), bytes2(o.recognized)),
      );
    case "networkRecord":
      return num(await c.NetworkRegistry.revisionOf(o.record.kind, o.record.recordId));
    default:
      return null;
  }
}

/** İşlem zincirde zaten var mı (kaldığı yerden devam). */
async function applied(
  c: TrustContracts,
  o: ReplayOp,
  stateSigner: (cc: string) => Promise<string>,
  fromBlock = 0,
): Promise<boolean> {
  if (o.n !== undefined) {
    if (o.op === "rpScope" || o.op === "rpGroup" || o.op === "rpProfile") {
      const period = ((await c.RelyingPartyRegistry.registrationPeriodsOf(o.rpId)) as unknown[]).length - 1;
      if (o.period < period) return true; // eski dönem: artık yazılamaz, yeni dönem devralmaz (RO3)
    }
    const w = await writes(c, o, fromBlock);
    if (w !== null) return w >= o.n;
  }
  switch (o.op) {
    case "registerRootCA":
      return Boolean(await c.RootCARegistry.exists(o.caId));
    case "rootCAStatus":
      return hasHistory(await c.RootCARegistry.rootCAStatusHistoryOf(o.caId), o.at, CAStatus[o.status]);
    case "rootCARollover":
      return (
        (await queryFilterPaged(c.RootCARegistry, c.RootCARegistry.filters.RootCARollingOver(o.caId), fromBlock))
          .length > 0
      );
    case "registerSchema":
      return Boolean(await c.SchemaRegistry.exists(o.schemaId));
    case "addSchemaHash":
      return ((await c.SchemaRegistry.contentHashesOf(o.schemaId)) as string[]).some(
        (h) => h.toLowerCase() === o.contentHash,
      );
    case "schemaStatus":
      return ((await c.SchemaRegistry.schemaStatusHistoryOf(o.schemaId)) as Array<{ status: bigint }>).some(
        (h) => num(h.status) === SchemaStatus[o.status],
      );
    case "registerIssuer":
      return String(await c.IssuerRegistry.stateOf(o.issuerId)) !== "0x0000";
    case "issuerStatus":
      return hasHistory(
        await c.IssuerRegistry.issuerStatusHistoryOf(o.issuerId),
        o.at,
        o.status === "RETIRED" ? IssuerStatus.REVOKED : IssuerStatus[o.status],
      );
    case "issuerInvalidatesFrom": {
      const cur = num(await c.IssuerRegistry.invalidatesFromOf(o.issuerId));
      return cur !== 0 && cur <= o.invalidatesFrom;
    }
    case "renewIssuer":
      return num((await c.IssuerRegistry.getIssuer(o.issuerId)).validUntil) >= o.validUntil;
    case "issuerProfile":
      return eq(lower(await c.IssuerRegistry.issuerProfileOf(o.issuerId)), lower(o.profile));
    case "schemaAuth": {
      const cur = await c.IssuerRegistry.schemaAuthOf(o.issuerId, o.schemaId);
      const past = (await c.IssuerRegistry.schemaAuthHistoryOf(o.issuerId, o.schemaId)) as Array<{
        since: bigint;
        until: bigint;
      }>;
      const all = [{ since: cur.since as bigint, until: cur.until as bigint }, ...past];
      return o.allowed ? all.some((w) => num(w.since) === o.at) : all.some((w) => num(w.until) === o.at);
    }
    case "issuerDelegates": {
      const me = await stateSigner((o.who as { state: string }).state);
      return ((await c.IssuerRegistry.issuerDelegatesOf(o.issuerId)) as string[]).some(
        (a) => a.toLowerCase() === me.toLowerCase(),
      );
    }
    case "registerList":
      return ((await c.StatusListRegistry.getListsByIssuer(o.issuerId)) as string[]).some(
        (x) => x.toLowerCase() === o.listId,
      );
    case "publishList":
      return num((await c.StatusListRegistry.getListAnchor(o.listId)).version) >= o.version;
    case "recognition":
      return num((await c.CrossRecognition.getPolicy(bytes2(o.recognizing), bytes2(o.recognized))).mode) === o.mode;
    case "registerRP":
      return ((await c.RelyingPartyRegistry.relyingPartyStatusHistoryOf(o.rpId)) as unknown[]).length > 0;
    case "rpStatus":
      return ((await c.RelyingPartyRegistry.relyingPartyStatusHistoryOf(o.rpId)) as unknown[]).length >= o.historyLen;
    case "rpCert":
      return (
        String((await c.RelyingPartyRegistry.getRelyingParty(o.rpId)).accessCertFingerprint).toLowerCase() === o.fp
      );
    case "rpPeriod":
      return ((await c.RelyingPartyRegistry.registrationPeriodsOf(o.rpId)) as unknown[]).length > o.period;
    case "rpScope":
    case "rpGroup":
    case "rpProfile": {
      const period = ((await c.RelyingPartyRegistry.registrationPeriodsOf(o.rpId)) as unknown[]).length - 1;
      if (o.period < period) return true; // eski dönem: artık yazılamaz, yeni dönem devralmaz (RO3)
      if (o.op === "rpProfile")
        return eq(lower(await c.RelyingPartyRegistry.relyingPartyProfileOf(o.rpId)), lower(o.profile));
      if (o.op === "rpScope")
        return ((await c.RelyingPartyRegistry.requestScopesOf(o.rpId)) as unknown[]).some((s) =>
          eq(lower(s), lower(o.scope)),
        );
      const [owner, g] = await c.RelyingPartyRegistry.terminalGroupOf(o.group.groupId);
      return String(owner).toLowerCase() === o.rpId && eq(lower(g), lower(o.group));
    }
    case "networkRecord":
      return eq(lower(await c.NetworkRegistry.getRecord(o.record.kind, o.record.recordId)), lower(o.record));
  }
}

/** Tek işlemi yazar. Governance işlemi oy verenler yoksa `false` döner (durulur). */
async function apply(c: TrustContracts, o: ReplayOp, s: ReplaySigners): Promise<boolean> {
  const who = (w: Who) => (w.role === "state" ? s.state(w.state) : s.executor);
  const signer = o.who.role === "governance" ? null : who(o.who);
  const at = o.at;
  switch (o.op) {
    case "registerRootCA":
      await wait(
        as(c.RootCARegistry, signer!).registerRootCA({
          caId: ZERO32,
          stateCode: bytes2(o.state),
          certFingerprint: o.fp,
          subjectHash: o.subjectHash,
          certURI: "",
          crlURI: "",
          status: CAStatus.ACTIVE,
          validFrom: o.validFrom,
          validUntil: o.validUntil,
          registeredAt: at,
        }),
      );
      return true;
    case "rootCAStatus": {
      const r = as(c.RootCARegistry, signer!);
      if (o.status === "SUSPENDED") await wait(r.suspendRootCAAt(o.caId, at));
      else if (o.status === "ACTIVE") await wait(r.reinstateRootCAAt(o.caId, at));
      else if (o.status === "RETIRED") await wait(r.retireRootCAAt(o.caId, ZERO32, at));
      else await wait(r.revokeRootCAAt(o.caId, o.reasonHash, at));
      return true;
    }
    case "rootCARollover":
      await wait(as(c.RootCARegistry, signer!).announceRootCARollover(o.caId, o.successor));
      return true;
    case "registerSchema":
      await wait(
        as(c.SchemaRegistry, signer!).registerSchema({
          vctURI: o.vct,
          contentHash: o.contentHash,
          version: "1",
          tier: o.tier,
          stateCode: o.tier === 1 ? bytes2(o.state) : "0x0000",
          status: SchemaStatus.ACTIVE,
          validFrom: at,
          supersededBy: ZERO32,
        }),
      );
      return true;
    case "addSchemaHash":
      await wait(as(c.SchemaRegistry, signer!).addSchemaContentHash(o.schemaId, o.contentHash));
      return true;
    case "schemaStatus":
      if (o.who.role === "governance") {
        if (!s.governance) return false;
        await passProposal(c, s.governance, (g) => g.proposeNetworkSchemaRevocation(o.schemaId, o.reasonHash));
      } else if (o.status === "DEPRECATED")
        await wait(as(c.SchemaRegistry, signer!).deprecateSchemaAt(o.schemaId, ZERO32, at));
      else await wait(as(c.SchemaRegistry, signer!).revokeSchemaAt(o.schemaId, o.reasonHash, at));
      return true;
    case "registerIssuer":
      await wait(
        as(c.IssuerRegistry, signer!).registerIssuer({
          issuerId: ZERO32,
          stateCode: bytes2(o.state),
          nameHash: o.nameHash,
          category: o.category,
          assurance: o.assurance,
          certFingerprint: o.fp,
          parentCA: o.parentCA,
          metadataURI: "",
          status: IssuerStatus.ACTIVE,
          validFrom: o.validFrom,
          validUntil: o.validUntil,
          successorId: ZERO32,
          registeredAt: at,
          revokedAt: 0,
        }),
      );
      return true;
    case "issuerStatus": {
      const r = as(c.IssuerRegistry, signer!);
      if (o.status === "SUSPENDED") await wait(r.suspendIssuerAt(o.issuerId, at));
      else if (o.status === "ACTIVE") await wait(r.reinstateIssuerAt(o.issuerId, at));
      else if (o.status === "RETIRED") await wait(r.retireIssuer(o.issuerId, o.successor ?? ZERO32, at));
      else await wait(r.revokeIssuerAt(o.issuerId, o.successor ?? ZERO32, at));
      return true;
    }
    case "issuerInvalidatesFrom":
      await wait(as(c.IssuerRegistry, signer!).setIssuerInvalidatesFrom(o.issuerId, o.invalidatesFrom));
      return true;
    case "renewIssuer":
      await wait(as(c.IssuerRegistry, signer!).renewIssuer(o.issuerId, o.validUntil));
      return true;
    case "issuerProfile":
      await wait(as(c.IssuerRegistry, signer!).setIssuerProfile(o.issuerId, o.profile));
      return true;
    case "schemaAuth":
      await wait(as(c.IssuerRegistry, signer!).setSchemaAuthorizationAt(o.issuerId, o.schemaId, o.allowed, at));
      return true;
    case "issuerDelegates": {
      const cur = (await c.IssuerRegistry.issuerDelegatesOf(o.issuerId)) as string[];
      const me = await signer!.getAddress();
      await wait(as(c.IssuerRegistry, signer!).setIssuerDelegates(o.issuerId, [...cur, me]));
      return true;
    }
    case "registerList":
      await wait(as(c.StatusListRegistry, signer!).registerList(o.issuerId, o.listUri, o.size, o.bits));
      return true;
    case "publishList":
      await wait(as(c.StatusListRegistry, signer!).publishList(o.listId, o.contentHash, o.version, at));
      return true;
    case "recognition":
      await wait(
        as(c.CrossRecognition, signer!).setRecognition(bytes2(o.recognizing), bytes2(o.recognized), o.mode, []),
      );
      return true;
    case "registerRP":
      await wait(
        as(c.RelyingPartyRegistry, signer!).registerRelyingParty({
          rpId: o.rpId,
          stateCode: bytes2(o.state),
          nameHash: o.nameHash,
          accessCertFingerprint: o.fp,
          status: 1,
          registeredAt: at,
        }),
      );
      return true;
    case "rpStatus": {
      // Listedeki an; ancak bir dönem değişikliği (yürütme anıyla yazılır, ADR-0075 açık soru 3) bundan sonraysa geçmiş sıralı
      // kalsın diye o dönemin başlangıcı (yeni dönemin listedeki geçmişi o aralıkta zaten zincirde farklıdır; eşdeğerlik sormaz).
      const h = (await c.RelyingPartyRegistry.relyingPartyStatusHistoryOf(o.rpId)) as Array<{ since: bigint }>;
      const t = Math.max(at, h.length ? num(h[h.length - 1].since) : 0);
      const r = as(c.RelyingPartyRegistry, signer!);
      if (o.status === "SUSPENDED") await wait(r.suspendRelyingPartyAt(o.rpId, t));
      else if (o.status === "ACTIVE") await wait(r.reinstateRelyingPartyAt(o.rpId, t));
      else await wait(r.revokeRelyingPartyAt(o.rpId, t));
      return true;
    }
    case "rpCert":
      await wait(as(c.RelyingPartyRegistry, signer!).updateAccessCertificate(o.rpId, o.fp));
      return true;
    case "rpScope":
      await wait(as(c.RelyingPartyRegistry, signer!).setRequestScope(o.rpId, o.scope));
      return true;
    case "rpGroup":
      await wait(as(c.RelyingPartyRegistry, signer!).setTerminalGroup(o.rpId, o.group));
      return true;
    case "rpProfile":
      await wait(as(c.RelyingPartyRegistry, signer!).setRelyingPartyProfile(o.rpId, o.profile));
      return true;
    case "rpPeriod": {
      if (!s.governance) return false;
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
      await passProposal(c, s.governance, (g) =>
        o.action === "REASSIGNMENT"
          ? g.proposeRelyingPartyReassignment(reg, stageId)
          : g.proposeRelyingPartyReRegistration(reg, stageId),
      );
      return true;
    }
    case "networkRecord":
      await wait(as(c.NetworkRegistry, signer!).writeRecord(o.record, at));
      return true;
  }
}

/** Hata nesnesindeki geri alma verisi (ethers sarmalarının farklı katmanları). */
function revertData(e: unknown): string | undefined {
  const x = e as { data?: unknown; error?: { data?: unknown }; info?: { error?: { data?: unknown } } };
  for (const d of [x?.data, x?.error?.data, x?.info?.error?.data])
    if (typeof d === "string" && /^0x[0-9a-f]*$/i.test(d)) return d;
  return undefined;
}

/**
 * Başarısız işlemin nedeni (teşhis için): özel hata kontrat ABI'lerinden çözülür; veri boşsa işlem gaz sınırı olmadan
 * yeniden denenir (eth_call) — o hâlde geçiyorsa neden gaz sınırıdır, değilse veri taşımayan geri almadır.
 */
async function explainFailure(c: TrustContracts, e: unknown): Promise<string> {
  const data = revertData(e);
  if (data && data.length >= 10) {
    for (const k of Object.values(c)) {
      try {
        const p = k.interface.parseError(data);
        if (p) return ` [${p.name}(${p.args.map((a) => String(a)).join(", ")})]`;
      } catch {
        /* başka kontratın hatası */
      }
    }
    return ` [bilinmeyen hata ${data.slice(0, 10)}]`;
  }
  const tx = (e as { payload?: { params?: unknown[] } })?.payload?.params?.[0] as Record<string, unknown> | undefined;
  const runner = Object.values(c)[0]?.runner;
  if (!tx || !runner?.provider) return " [geri alma verisi yok]";
  try {
    await runner.provider.call({ from: String(tx.from), to: String(tx.to), data: String(tx.data) });
    return ` [geri alma verisi yok; gaz sınırı olmadan geçiyor → gaz sınırı ${Number(tx.gas)} yetmedi]`;
  } catch (e2) {
    const d2 = revertData(e2);
    return d2 && d2.length >= 10
      ? await explainFailure(c, e2)
      : " [geri alma verisi yok; gaz sınırı olmadan da geri alınıyor]";
  }
}

/**
 * Planı yürütür. Pencere ve plan özeti denetlenir (CE1); zincirde olan işlem atlanır. `onProgress` her işlemden sonra çağrılır.
 */
export async function executeReplay(
  plan: ReplayPlan,
  c: TrustContracts,
  s: ReplaySigners,
  opts: {
    onProgress?: (o: ReplayOp, written: boolean) => void;
    /** olay sayımlarının başladığı blok (kontratların dağıtım bloğu; varsayılan 0) */
    logsFromBlock?: number;
  } = {},
): Promise<ReplayReport> {
  const problems = await migrationProblems(c, plan.hash, await s.executor.getAddress());
  if (problems.length) throw new Error(`replay: göç penceresi hazır değil — ${problems.join("; ")}`);
  const stateAddr = new Map<string, string>();
  const stateSigner = async (cc: string) => {
    if (!stateAddr.has(cc)) stateAddr.set(cc, await s.state(cc).getAddress());
    return stateAddr.get(cc)!;
  };
  let written = 0;
  let skipped = 0;
  for (const o of plan.ops) {
    if (await applied(c, o, stateSigner, opts.logsFromBlock ?? 0)) {
      skipped++;
      opts.onProgress?.(o, false);
      continue;
    }
    let ok: boolean;
    try {
      ok = await apply(c, o, s);
    } catch (e) {
      const why = await explainFailure(c, e);
      throw new Error(`replay: işlem #${o.seq} ${o.op} (${o.src}) başarısız${why} — ${(e as Error).message}`);
    }
    if (!ok)
      return {
        planHash: plan.hash,
        total: plan.ops.length,
        written,
        skipped,
        pendingGovernance: { seq: o.seq, op: o.op, src: o.src },
      };
    written++;
    opts.onProgress?.(o, true);
  }
  return { planHash: plan.hash, total: plan.ops.length, written, skipped };
}
