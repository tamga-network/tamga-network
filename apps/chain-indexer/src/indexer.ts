/**
 * Olay tabanlı indeksleyici (SPEC-BC-0001 §11.2; ADR-0074 K5). Kontrat olaylarını bloklar boyunca okur, değişen kayıtları
 * (kurum, kök sertifika, şema, doğrulayıcı, iptal listesi çapası, tanıma, ağ düzeyi kayıt) bulur ve onları SABİTLENMİŞ bloktaki
 * kontrat okumalarıyla bellekteki dizine yazar. Doğrulama dizinden yapılır; zincir her doğrulamada sorgulanmaz (§11.2).
 *
 *   - Olaylar keşif ve değişiklik işaretidir (`IssuerStatusChanged`, `SchemaAuthorizationWindow`, `ListPublished`, …); kaydın
 *     tamamı (durum geçmişi, yetki pencereleri, kapsamlar, dönemler) aynı bloktaki okumadan gelir — olay ile okuma aynı bloğa
 *     sabitlendiği için dizin tutarlıdır.
 *   - `sync()` artımlıdır: son indekslenen bloktan sonraki olaylar okunur, yalnız değişen kayıtlar yeniden okunur.
 *   - Dizin düz JSON'dur (`toJSON` / `fromJSON`): bellekte ya da basit bir dosyada saklanabilir.
 * Kişisel veri yoktur: zincirde olmayan şey dizinde de yoktur (PJ2; ad ve kayıt verisi yalnız özet).
 */
import type { Contract, Log, LogDescription, Provider } from "ethers";

import { RecordKind, type RegistryName, type TrustContracts } from "./contracts.js";
import { stateOf } from "./ids.js";

export type Hist = Array<[since: number, status: number]>;
export interface IxRootCA {
  caId: string;
  state: string;
  fp: string;
  validFrom: number;
  validUntil: number;
  status: number;
  history: Hist;
  successor?: string;
}
export interface IxIssuer {
  issuerId: string;
  state: string;
  category: number;
  assurance: number;
  fp: string;
  parentCA: string;
  validFrom: number;
  validUntil: number;
  status: number;
  history: Hist;
  invalidatesFrom: number;
  /** halef kurum (iptalde; yoksa sıfır) */
  successor?: string;
  /** schemaId → [since, until) pencereleri (until 0 = açık) */
  auth: Record<string, Array<[number, number]>>;
  profile: { issuerClass: number; publicSector: boolean; entitlements: number; registrationHash: string };
}
export interface IxSchema {
  schemaId: string;
  vct: string;
  tier: number;
  state: string;
  status: number;
  history: Hist;
  hashes: string[];
}
export interface IxScope {
  scopeHash: string;
  serviceHash: string;
  schemaId: string;
  format: number;
  namespaceHash: string;
  attributes: string[];
  validFrom: number;
  validUntil: number;
  detailsHash: string;
}
export interface IxGroup {
  groupId: string;
  institutionId: string;
  policyIds: string[];
  certFingerprints: string[];
  offlineAllowed: boolean;
  validFrom: number;
  validUntil: number;
  labelHash: string;
}
export interface IxRP {
  rpId: string;
  state: string;
  nameHash: string;
  fp: string;
  status: number;
  registeredAt: number;
  history: Hist;
  periods: Array<{ state: string; since: number }>;
  scopes: IxScope[];
  groups: IxGroup[];
}
export interface IxList {
  listId: string;
  issuerId: string;
  listUri: string;
  contentHash: string;
  version: number;
  publishedAt: number;
  bits: number;
  size: number;
  status: number;
}
export interface IxRecord {
  kind: number;
  recordId: string;
  parentId: string;
  region: string;
  subtype: number;
  status: number;
  validFrom: number;
  validUntil: number;
  fingerprint: string;
  detailsHash: string;
  /** uint256 — onaltılık değil, ondalık metin (bit alanları 2^53'ü aşabilir) */
  flags: string;
  digests: string[];
  history: Hist;
}
export interface ChainIndex {
  meta: { chainId: number; block: number; blockTimestamp: number; addresses: Record<string, string> };
  rootCAs: Record<string, IxRootCA>;
  issuers: Record<string, IxIssuer>;
  schemas: Record<string, IxSchema>;
  rps: Record<string, IxRP>;
  /** sertifika parmak izi (bytes32) → rpId */
  certOwner: Record<string, string>;
  lists: Record<string, IxList>;
  /** tanıyan devlet → tanınan devlet → { mode, categories } */
  recognition: Record<string, Record<string, { mode: number; categories: number[] }>>;
  blocklist: Record<string, string[]>;
  records: Record<string, IxRecord>;
}

export const emptyIndex = (): ChainIndex => ({
  meta: { chainId: 0, block: -1, blockTimestamp: 0, addresses: {} },
  rootCAs: {},
  issuers: {},
  schemas: {},
  rps: {},
  certOwner: {},
  lists: {},
  recognition: {},
  blocklist: {},
  records: {},
});

const N = (x: unknown) => Number(x);
const H = (x: unknown) => String(x).toLowerCase();
const hist = (h: Array<{ since: bigint; status: bigint }>): Hist => h.map((c) => [N(c.since), N(c.status)]);

/** Kayıt başına hangi alanların yeniden okunacağı (olaylardan). */
interface Touched {
  rootCAs: Set<string>;
  issuers: Set<string>;
  auth: Set<string>; // issuerId|schemaId
  schemas: Set<string>;
  rps: Set<string>;
  groups: Set<string>; // groupId
  lists: Set<string>;
  recognition: Set<string>; // a|b
  /** state|issuerId → son olaydaki engel (görünüm yok; olaydan) */
  blocklist: Map<string, boolean>;
  records: Set<string>; // kind|recordId
  /** caId → halef (ROLLING_OVER: zincirde ACTIVE + halef olayı, ADR-0073 K5) */
  rollover: Map<string, string>;
}

export class ChainIndexer {
  readonly index: ChainIndex;
  constructor(
    private readonly provider: Provider,
    private readonly c: TrustContracts,
    index?: ChainIndex,
  ) {
    this.index = index ?? emptyIndex();
  }

  /**
   * Son indekslenen bloktan `toBlock`'a (varsayılan: son blok) kadar olayları okur ve değişen kayıtları o bloktaki okumalarla
   * günceller. Dönen: indekslenen blok.
   */
  async sync(toBlock?: number): Promise<number> {
    const head = toBlock ?? (await this.provider.getBlockNumber());
    const from = this.index.meta.block + 1;
    if (head < from) return this.index.meta.block;
    const t: Touched = {
      rootCAs: new Set(),
      issuers: new Set(),
      auth: new Set(),
      schemas: new Set(),
      rps: new Set(),
      groups: new Set(),
      lists: new Set(),
      recognition: new Set(),
      blocklist: new Map(),
      records: new Set(),
      rollover: new Map(),
    };
    for (const name of [
      "RootCARegistry",
      "IssuerRegistry",
      "SchemaRegistry",
      "RelyingPartyRegistry",
      "CrossRecognition",
      "StatusListRegistry",
      "NetworkRegistry",
    ] as RegistryName[])
      for (const ev of await this.events(this.c[name], from, head)) this.mark(name, ev, t);
    const blockTag = head;
    await this.read(t, blockTag);
    const [net, block] = await Promise.all([this.provider.getNetwork(), this.provider.getBlock(head)]);
    this.index.meta = {
      chainId: N(net.chainId),
      block: head,
      blockTimestamp: N(block?.timestamp ?? 0),
      addresses: Object.fromEntries(
        await Promise.all(Object.entries(this.c).map(async ([k, v]) => [k, await v.getAddress()])),
      ),
    };
    return head;
  }

  private async events(c: Contract, from: number, to: number): Promise<LogDescription[]> {
    const logs: Log[] = await this.provider.getLogs({ address: await c.getAddress(), fromBlock: from, toBlock: to });
    const out: LogDescription[] = [];
    for (const l of logs) {
      try {
        const d = c.interface.parseLog(l);
        if (d) out.push(d);
      } catch {
        /* bu ABI'de olmayan olay (ör. proxy yönetimi) */
      }
    }
    return out;
  }

  private mark(name: RegistryName, ev: LogDescription, t: Touched) {
    const a = ev.args as unknown as Record<string, unknown>;
    if (name === "RootCARegistry" && a.caId) {
      t.rootCAs.add(H(a.caId));
      if (ev.name === "RootCARollingOver") t.rollover.set(H(a.caId), H(a.successorCA));
    }
    if (name === "IssuerRegistry" && a.issuerId) {
      t.issuers.add(H(a.issuerId));
      if (a.schemaId) t.auth.add(`${H(a.issuerId)}|${H(a.schemaId)}`);
    }
    if (name === "SchemaRegistry" && a.schemaId) t.schemas.add(H(a.schemaId));
    if (name === "RelyingPartyRegistry") {
      if (a.rpId) t.rps.add(H(a.rpId));
      if (a.groupId) t.groups.add(H(a.groupId));
    }
    if (name === "CrossRecognition") {
      if (ev.name === "RecognitionSet") t.recognition.add(`${H(a.recognizingState)}|${H(a.recognizedState)}`);
      if (ev.name === "IssuerBlocklisted") t.blocklist.set(`${H(a.byState)}|${H(a.issuerId)}`, Boolean(a.blocked));
    }
    if (name === "StatusListRegistry" && a.listId) t.lists.add(H(a.listId));
    if (name === "NetworkRegistry" && a.recordId !== undefined && a.kind !== undefined)
      t.records.add(`${N(a.kind)}|${H(a.recordId)}`);
  }

  private async read(t: Touched, blockTag: number) {
    const o = { blockTag };
    const c = this.c;
    const ix = this.index;
    for (const id of t.rootCAs) {
      const r = await c.RootCARegistry.getRootCA(id, o);
      const prev = ix.rootCAs[id];
      ix.rootCAs[id] = {
        caId: id,
        state: stateOf(r.stateCode),
        fp: H(r.certFingerprint),
        validFrom: N(r.validFrom),
        validUntil: N(r.validUntil),
        status: N(r.status),
        history: hist(await c.RootCARegistry.rootCAStatusHistoryOf(id, o)),
      };
      const successor = t.rollover.get(id) ?? prev?.successor;
      if (successor) ix.rootCAs[id].successor = successor;
    }
    for (const id of t.schemas) {
      const s = await c.SchemaRegistry.getSchema(id, o);
      ix.schemas[id] = {
        schemaId: id,
        vct: String(s.vctURI),
        tier: N(s.tier),
        state: stateOf(s.stateCode),
        status: N(s.status),
        history: hist(await c.SchemaRegistry.schemaStatusHistoryOf(id, o)),
        hashes: ((await c.SchemaRegistry.contentHashesOf(id, o)) as string[]).map(H),
      };
    }
    for (const id of t.issuers) {
      const i = await c.IssuerRegistry.getIssuer(id, o);
      const p = await c.IssuerRegistry.issuerProfileOf(id, o);
      ix.issuers[id] = {
        issuerId: id,
        state: stateOf(i.stateCode),
        category: N(i.category),
        assurance: N(i.assurance),
        fp: H(i.certFingerprint),
        parentCA: H(i.parentCA),
        validFrom: N(i.validFrom),
        validUntil: N(i.validUntil),
        status: N(i.status),
        history: hist(await c.IssuerRegistry.issuerStatusHistoryOf(id, o)),
        invalidatesFrom: N(await c.IssuerRegistry.invalidatesFromOf(id, o)),
        successor: H(i.successorId),
        auth: ix.issuers[id]?.auth ?? {},
        profile: {
          issuerClass: N(p.issuerClass),
          publicSector: Boolean(p.publicSector),
          entitlements: N(p.entitlements),
          registrationHash: H(p.registrationHash),
        },
      };
    }
    for (const key of t.auth) {
      const [issuerId, schemaId] = key.split("|");
      const cur = await c.IssuerRegistry.schemaAuthOf(issuerId, schemaId, o);
      const past = (await c.IssuerRegistry.schemaAuthHistoryOf(issuerId, schemaId, o)) as Array<{
        since: bigint;
        until: bigint;
      }>;
      const w: Array<[number, number]> = past.map((x) => [N(x.since), N(x.until)]);
      if (N(cur.since) !== 0) w.push([N(cur.since), N(cur.until)]);
      if (ix.issuers[issuerId]) ix.issuers[issuerId].auth[schemaId] = w;
    }
    for (const id of new Set([...t.rps])) await this.readRp(id, o);
    for (const gid of t.groups) {
      const [owner] = await c.RelyingPartyRegistry.terminalGroupOf(gid, o);
      const rp = ix.rps[H(owner)];
      if (rp && !t.rps.has(H(owner))) await this.readRp(H(owner), o);
    }
    for (const id of t.lists) {
      const a = await c.StatusListRegistry.getListAnchor(id, o);
      ix.lists[id] = {
        listId: id,
        issuerId: H(a.issuerId),
        listUri: String(a.listURI),
        contentHash: H(a.contentHash),
        version: N(a.version),
        publishedAt: N(a.publishedAt),
        bits: N(a.bitsPerEntry),
        size: N(a.listSize),
        status: N(a.status),
      };
    }
    for (const key of t.recognition) {
      const [a, b] = key.split("|");
      const p = await c.CrossRecognition.getPolicy(a, b, o);
      (ix.recognition[stateOf(a)] ??= {})[stateOf(b)] = {
        mode: N(p.mode),
        categories: (p.categories as bigint[]).map(N),
      };
    }
    for (const [key, blocked] of t.blocklist) {
      const [st, issuerId] = key.split("|");
      const s = stateOf(st);
      const cur = new Set(ix.blocklist[s] ?? []);
      if (blocked) cur.add(issuerId);
      else cur.delete(issuerId);
      ix.blocklist[s] = [...cur];
    }
    for (const key of t.records) {
      const [kind, recordId] = key.split("|");
      const r = await c.NetworkRegistry.getRecord(N(kind), recordId, o);
      ix.records[key] = {
        kind: N(r.kind),
        recordId: H(r.recordId),
        parentId: H(r.parentId),
        region: H(r.region),
        subtype: N(r.subtype),
        status: N(r.status),
        validFrom: N(r.validFrom),
        validUntil: N(r.validUntil),
        fingerprint: H(r.fingerprint),
        detailsHash: H(r.detailsHash),
        flags: BigInt(r.flags).toString(),
        digests: (r.digests as string[]).map(H),
        history: hist(await c.NetworkRegistry.recordStatusHistoryOf(N(kind), recordId, o)),
      };
    }
  }

  private async readRp(id: string, o: { blockTag: number }) {
    const c = this.c.RelyingPartyRegistry;
    const ix = this.index;
    const r = await c.getRelyingParty(id, o);
    const prev = ix.rps[id];
    if (prev && ix.certOwner[prev.fp] === id) delete ix.certOwner[prev.fp];
    const groups: IxGroup[] = [];
    for (const gid of (await c.terminalGroupsOf(id, o)) as string[]) {
      const [, g] = await c.terminalGroupOf(gid, o);
      groups.push({
        groupId: H(g.groupId),
        institutionId: H(g.institutionId),
        policyIds: (g.policyIds as string[]).map(H),
        certFingerprints: (g.certFingerprints as string[]).map(H),
        offlineAllowed: Boolean(g.offlineAllowed),
        validFrom: N(g.validFrom),
        validUntil: N(g.validUntil),
        labelHash: H(g.labelHash),
      });
    }
    ix.rps[id] = {
      rpId: id,
      state: stateOf(r.stateCode),
      nameHash: H(r.nameHash),
      fp: H(r.accessCertFingerprint),
      status: N(r.status),
      registeredAt: N(r.registeredAt),
      history: hist(await c.relyingPartyStatusHistoryOf(id, o)),
      periods: ((await c.registrationPeriodsOf(id, o)) as Array<{ stateCode: string; since: bigint }>).map((p) => ({
        state: stateOf(p.stateCode),
        since: N(p.since),
      })),
      scopes: ((await c.requestScopesOf(id, o)) as Array<Record<string, unknown>>).map((s) => ({
        scopeHash: H(s.scopeHash),
        serviceHash: H(s.serviceHash),
        schemaId: H(s.schemaId),
        format: N(s.format),
        namespaceHash: H(s.namespaceHash),
        attributes: (s.attributes as string[]).map(H),
        validFrom: N(s.validFrom),
        validUntil: N(s.validUntil),
        detailsHash: H(s.detailsHash),
      })),
      groups,
    };
    ix.certOwner[H(r.accessCertFingerprint)] = id;
  }

  toJSON(): ChainIndex {
    return this.index;
  }
}

/** Ağ düzeyi kayıt anahtarı (`<kind>|<recordId>`). */
export const recordKey = (kind: number, recordId: string) => `${kind}|${recordId.toLowerCase()}`;
export const WALLET_PROVIDER_KEY = RecordKind.WALLET_PROVIDER_KEY;
