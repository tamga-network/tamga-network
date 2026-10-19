/**
 * Zincir istemcisi — liste çapası kaydına (TrustListAnchorRegistry, ADR-0051) okuma/yazma. İki uygulama:
 *   - MemoryChainClient: ağ yok; dry-run ve testler (kontratın onay/eşik ve rakip aday kuralını basitçe taklit eder, ADR-0053).
 *   - EthersChainClient: JSON-RPC (ethers v6); yalnız TAMGA_CHAIN_ENABLED=1 iken kurulur (CH5).
 * ABI kopyası abi/trust-list-anchor-registry.json — contracts/scripts/export-abi.mjs üretir; `contracts:check` farkı yakalar.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Contract, JsonRpcProvider, NonceManager, Wallet, type InterfaceAbi, type Signer } from "ethers";

import { ZERO32 } from "./projection.js";

export interface ChainListAnchor {
  version: number;
  contentHash: string;
  previousHash: string;
  issuedAt: number;
  confirmations: number;
  confirmed: boolean;
}

export interface ChainClient {
  /** Zincir kimliği ve kayıt adresi (rapor için) */
  describe(): Promise<{ chainId: number; registry: string; requiredConfirmations: number }>;
  latestListVersion(listKey: string): Promise<number>;
  listAnchor(listKey: string, version: number): Promise<ChainListAnchor | null>;
  isListAnchored(listKey: string, version: number, contentHash: string): Promise<boolean>;
  latestLogSeq(logKey: string): Promise<number>;
  logHead(logKey: string, seq: number): Promise<{ lineHash: string; ts: number; confirmed: boolean } | null>;
  anchorList(a: {
    listKey: string;
    version: number;
    contentHash: string;
    previousHash: string;
    issuedAt: number;
  }): Promise<string>;
  anchorLogHead(h: { logKey: string; seq: number; lineHash: string; ts: number }): Promise<string>;
}

export const ABI_FILE = resolve(dirname(fileURLToPath(import.meta.url)), "abi", "trust-list-anchor-registry.json");
export function loadAbi(): InterfaceAbi {
  return (JSON.parse(readFileSync(ABI_FILE, "utf8")) as { abi: InterfaceAbi }).abi;
}

// -----------------------------------------------------------------------------------------------------------------
// Bellek içi (dry-run / test)
// -----------------------------------------------------------------------------------------------------------------

export class MemoryChainClient implements ChainClient {
  readonly writes: Array<{ kind: "list" | "log"; [k: string]: unknown }> = [];
  private lists = new Map<string, Map<number, ChainListAnchor>>();
  private logs = new Map<string, Map<number, { lineHash: string; ts: number; confirmed: boolean }>>();
  /** ADR-0053: "<anahtar>:<sürüm>" → aday verisi → destek sayısı */
  private candidates = new Map<string, Map<string, number>>();
  constructor(
    readonly required = 1,
    readonly chainId = 0,
  ) {}

  /** Test/dry-run başlangıç durumu: zincirde zaten onaylı bir sürüm. */
  seedList(listKey: string, a: Omit<ChainListAnchor, "confirmations" | "confirmed">) {
    const m = this.lists.get(listKey) ?? new Map();
    m.set(a.version, { ...a, confirmations: this.required, confirmed: true });
    this.lists.set(listKey, m);
  }
  seedLog(logKey: string, seq: number, lineHash: string, ts: number) {
    const m = this.logs.get(logKey) ?? new Map();
    m.set(seq, { lineHash, ts, confirmed: true });
    this.logs.set(logKey, m);
  }

  async describe() {
    return { chainId: this.chainId, registry: "memory", requiredConfirmations: this.required };
  }
  async latestListVersion(listKey: string) {
    let v = 0;
    for (const [ver, a] of this.lists.get(listKey) ?? []) if (a.confirmed && ver > v) v = ver;
    return v;
  }
  async listAnchor(listKey: string, version: number) {
    return this.lists.get(listKey)?.get(version) ?? null;
  }
  async isListAnchored(listKey: string, version: number, contentHash: string) {
    const a = await this.listAnchor(listKey, version);
    return !!a && a.confirmed && a.contentHash === contentHash && contentHash !== ZERO32;
  }
  async latestLogSeq(logKey: string) {
    let s = 0;
    for (const [seq, h] of this.logs.get(logKey) ?? []) if (h.confirmed && seq > s) s = seq;
    return s;
  }
  async logHead(logKey: string, seq: number) {
    return this.logs.get(logKey)?.get(seq) ?? null;
  }
  async anchorList(a: {
    listKey: string;
    version: number;
    contentHash: string;
    previousHash: string;
    issuedAt: number;
  }) {
    this.writes.push({ kind: "list", ...a });
    const m = this.lists.get(a.listKey) ?? new Map<number, ChainListAnchor>();
    const cur = m.get(a.version);
    if (cur?.confirmed) throw new Error("AlreadyConfirmed");
    const n = this.support(`${a.listKey}:${a.version}`, `${a.contentHash}|${a.previousHash}|${a.issuedAt}`);
    const data = { version: a.version, contentHash: a.contentHash, previousHash: a.previousHash, issuedAt: a.issuedAt };
    const same =
      cur && cur.contentHash === a.contentHash && cur.previousHash === a.previousHash && cur.issuedAt === a.issuedAt;
    // görünüm ilk adayı gösterir; eşiği ilk dolduran aday kazanır
    if (!cur || n >= this.required) m.set(a.version, { ...data, confirmations: n, confirmed: n >= this.required });
    else if (same) cur.confirmations = n;
    this.lists.set(a.listKey, m);
    return `memory:list:${a.version}`;
  }
  async anchorLogHead(h: { logKey: string; seq: number; lineHash: string; ts: number }) {
    this.writes.push({ kind: "log", ...h });
    const m = this.logs.get(h.logKey) ?? new Map<number, { lineHash: string; ts: number; confirmed: boolean }>();
    const cur = m.get(h.seq);
    if (cur?.confirmed) throw new Error("AlreadyConfirmed");
    const n = this.support(`${h.logKey}:${h.seq}`, `${h.lineHash}|${h.ts}`);
    if (!cur || n >= this.required) m.set(h.seq, { lineHash: h.lineHash, ts: h.ts, confirmed: n >= this.required });
    this.logs.set(h.logKey, m);
    return `memory:log:${h.seq}`;
  }
  /** Rakip aday sayısı (> 1 → çelişki, ADR-0053). */
  candidateCount(key: string, versionOrSeq: number) {
    return this.candidates.get(`${key}:${versionOrSeq}`)?.size ?? 0;
  }
  private support(id: string, data: string) {
    const c = this.candidates.get(id) ?? new Map<string, number>();
    const n = (c.get(data) ?? 0) + 1;
    c.set(data, n);
    this.candidates.set(id, c);
    return n;
  }
}

// -----------------------------------------------------------------------------------------------------------------
// JSON-RPC (ethers)
// -----------------------------------------------------------------------------------------------------------------

export interface EthersClientOptions {
  rpcUrl: string;
  registry: string;
  /** Yazıcı anahtarı (hex); yoksa yalnız okuma. Ortamdan gelir, depoda durmaz. */
  anchorerKey?: string;
}

export class EthersChainClient implements ChainClient {
  private readonly provider: JsonRpcProvider;
  private readonly reader: Contract;
  private readonly writer: Contract | null;
  constructor(readonly opts: EthersClientOptions) {
    if (!/^https?:\/\//.test(opts.rpcUrl)) throw new Error("chain: TAMGA_CHAIN_RPC_URL http(s) olmalı");
    if (!/^0x[0-9a-fA-F]{40}$/.test(opts.registry)) throw new Error("chain: TAMGA_CHAIN_ANCHOR_REGISTRY adres değil");
    this.provider = new JsonRpcProvider(opts.rpcUrl);
    const abi = loadAbi();
    this.reader = new Contract(opts.registry, abi, this.provider);
    // NonceManager: ardışık yazımlarda (liste + liste + günlük başı) nonce yerelde sayılır; aksi hâlde anında madencilik yapan
    // düğümde ikinci işlem "nonce too low" ile düşer.
    const signer: Signer | null = opts.anchorerKey
      ? new NonceManager(new Wallet(opts.anchorerKey, this.provider))
      : null;
    this.writer = signer ? new Contract(opts.registry, abi, signer) : null;
  }
  async describe() {
    const [net, req] = await Promise.all([this.provider.getNetwork(), this.reader.requiredConfirmations()]);
    return { chainId: Number(net.chainId), registry: this.opts.registry, requiredConfirmations: Number(req) };
  }
  async latestListVersion(listKey: string) {
    return Number(await this.reader.latestListVersion(listKey));
  }
  async listAnchor(listKey: string, version: number) {
    const a = await this.reader.listAnchor(listKey, version);
    if (Number(a.confirmations) === 0) return null;
    return {
      version: Number(a.version),
      contentHash: String(a.contentHash),
      previousHash: String(a.previousHash),
      issuedAt: Number(a.issuedAt),
      confirmations: Number(a.confirmations),
      confirmed: Boolean(a.confirmed),
    };
  }
  async isListAnchored(listKey: string, version: number, contentHash: string) {
    return Boolean(await this.reader.isListAnchored(listKey, version, contentHash));
  }
  async latestLogSeq(logKey: string) {
    return Number(await this.reader.latestLogSeq(logKey));
  }
  async logHead(logKey: string, seq: number) {
    const h = await this.reader.logHead(logKey, seq);
    if (Number(h.confirmations) === 0) return null;
    return { lineHash: String(h.lineHash), ts: Number(h.ts), confirmed: Boolean(h.confirmed) };
  }
  private w(): Contract {
    if (!this.writer) throw new Error("chain: yazıcı anahtarı yok (TAMGA_CHAIN_ANCHORER_KEY) — yalnız okuma");
    return this.writer;
  }
  async anchorList(a: {
    listKey: string;
    version: number;
    contentHash: string;
    previousHash: string;
    issuedAt: number;
  }) {
    const tx = await this.w().anchorList(a.listKey, a.version, a.contentHash, a.previousHash, a.issuedAt);
    await tx.wait();
    return String(tx.hash);
  }
  async anchorLogHead(h: { logKey: string; seq: number; lineHash: string; ts: number }) {
    const tx = await this.w().anchorLogHead(h.logKey, h.seq, h.lineHash, h.ts);
    await tx.wait();
    return String(tx.hash);
  }
}
