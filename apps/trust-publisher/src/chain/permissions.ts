/**
 * `trust:chain-permissions` (ADR-0052 K2/K3; LP1–LP3) — Besu yerel izin listesi zincirin kendi durumundan.
 *
 *   render  Zinciri SABİTLENMİŞ bir blokta okur (Governance, IssuerRegistry, TrustListAnchorRegistry, göç pencereleri) ve
 *           belirleyici bir `permissions_config.toml` üretir: `accounts-allowlist` (validator'lar, devlet delegeleri, çalışır
 *           durumdaki kurumların delegeleri, liste çapası yazıcıları, açık göç penceresinin yürütücüsü) ve `nodes-allowlist`
 *           (bildirimi Governance'la eşleşen validator düğümleri + `--operator` verildiyse işletmecinin kendi RPC düğümleri).
 *           Sıralı, tekrarsız, küçük harf, LF; blok numarası ya da zaman dosyaya girmez → aynı zincir durumu bayt bayt aynı dosya.
 *           İki özet basılır: `sha256` (dosya) ve `shared_sha256` (işletmecinin kendi RPC düğümleri hariç — validator'lar
 *           arasında karşılaştırılan özet, LP3).
 *   check   Düğümün yürürlükteki listelerini (`perm_getAccountsAllowlist`, `perm_getNodesAllowlist`) beklenen dosyayla
 *           karşılaştırır. Yalnız düğümün kendi yönetim ucundan (loopback); `PERM` ad alanı dışarı açılmaz (LP5).
 * Elle ekleme yoktur (LP2): komutun "ek hesap" seçeneği yok. Yetki kontratlardadır (LP4).
 */
import { createHash } from "node:crypto";
import { Contract, type ContractRunner } from "ethers";

import { MIGRATING_REGISTRIES, type TrustContracts } from "../../../chain-indexer/src/contracts.js";
import { loadAbi } from "./client.js";
import { matchDeclarations, normalizeEnode, type DeclarationMatch, type ValidatorMember } from "./node-declaration.js";

/** Governance.MemberStatus (SPEC-BC-0001 §1; değerler yalnız sona eklenir) */
const MEMBER_ACTIVE = 1;

export type AccountReason = "validator" | "state-delegate" | "issuer-delegate" | "anchorer" | "migration-executor";

/** Zincirden okunan izin kümeleri — tek bir blokta. */
export interface PermissionsChainState {
  chainId: number;
  block: number;
  /** dosya başlığına yazılan kontrat adresleri (bilgi; sıralı ad → adres) */
  contracts: Record<string, string>;
  members: ValidatorMember[];
  accounts: Map<string, Set<AccountReason>>;
}

/** Okuma arayüzü: testlerde sahte, gerçekte ethers (`readPermissionsState`). */
export interface PermissionsReader {
  chainId(): Promise<number>;
  blockNumber(): Promise<number>;
  contracts(): Record<string, string>;
  memberCodes(block: number): Promise<string[]>;
  member(code: string, block: number): Promise<{ validator: string; status: number }>;
  stateDelegates(code: string, block: number): Promise<string[]>;
  issuersOf(code: string, block: number): Promise<string[]>;
  issuerOperational(issuerId: string, block: number): Promise<boolean>;
  issuerDelegates(issuerId: string, block: number): Promise<string[]>;
  anchorers(block: number): Promise<string[]>;
  /** göç penceresi AÇIK kayıtların yürütücüleri (ADR-0073 K1) */
  migrationExecutors(block: number): Promise<string[]>;
}

/** bytes2 (0x5452) → "TR" */
export const codeOf = (b2: string) => Buffer.from(b2.replace(/^0x/, ""), "hex").toString("latin1");
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

export async function readPermissionsState(r: PermissionsReader, block?: number): Promise<PermissionsChainState> {
  const chainId = await r.chainId();
  const b = block ?? (await r.blockNumber());
  const accounts = new Map<string, Set<AccountReason>>();
  const add = (a: string, why: AccountReason) => {
    const k = a.toLowerCase();
    if (k === ZERO_ADDR) return;
    const s = accounts.get(k) ?? new Set<AccountReason>();
    s.add(why);
    accounts.set(k, s);
  };
  const members: ValidatorMember[] = [];
  for (const code of await r.memberCodes(b)) {
    const m = await r.member(code, b);
    const active = m.status === MEMBER_ACTIVE;
    members.push({ code, validator: m.validator.toLowerCase(), active });
    if (active) {
      add(m.validator, "validator");
      // Governance.isDelegateOf yalnız AKTİF üyede doğru — askıdaki devletin delegesi yazamaz
      for (const k of await r.stateDelegates(code, b)) add(k, "state-delegate");
    }
    // Kurum delegeleri: StatusListRegistry yalnız isIssuerDelegate + isOperational'a bakar (devletin üyelik durumuna değil);
    // kontrat yetkisi neyse liste o (LP2)
    for (const id of await r.issuersOf(code, b))
      if (await r.issuerOperational(id, b)) for (const k of await r.issuerDelegates(id, b)) add(k, "issuer-delegate");
  }
  for (const a of await r.anchorers(b)) add(a, "anchorer");
  for (const a of await r.migrationExecutors(b)) add(a, "migration-executor");
  members.sort((x, y) => (x.code < y.code ? -1 : x.code > y.code ? 1 : 0));
  return { chainId, block: b, contracts: r.contracts(), members, accounts };
}

export interface RenderedPermissions {
  toml: string;
  sha256: string;
  /** işletmecinin kendi RPC düğümleri hariç dosyanın özeti — validator'lar arasında aynı olmalı (LP3) */
  sharedSha256: string;
  accounts: string[];
  nodes: string[];
  match: DeclarationMatch;
}

const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const sorted = (xs: Iterable<string>) => [...new Set(xs)].sort();

function tomlArray(key: string, xs: string[]): string {
  if (xs.length === 0) return `${key}=[]\n`;
  return `${key}=[\n${xs.map((x) => `  "${x}",`).join("\n")}\n]\n`;
}

function tomlOf(state: PermissionsChainState, accounts: string[], nodes: string[]): string {
  const contracts = Object.keys(state.contracts)
    .sort()
    .map((k) => `${k} ${state.contracts[k].toLowerCase()}`);
  return (
    "# Tamga Network — Besu yerel izin listesi (ADR-0052). ELLE DÜZENLENMEZ: npm run trust:chain-permissions -- render\n" +
    `# chainId ${state.chainId}\n` +
    contracts.map((c) => `# ${c}\n`).join("") +
    tomlArray("accounts-allowlist", accounts) +
    tomlArray("nodes-allowlist", nodes)
  );
}

/**
 * Belirleyici çizim. `declarations`: `network/permissions/nodes/*.json` içeriği; `operator`: bu dosyayı üreten işletmecinin devlet
 * kodu (yalnız onun `rpc` düğümleri eklenir) ya da null.
 */
export function renderPermissions(
  state: PermissionsChainState,
  declarations: Array<{ file: string; decl: unknown }>,
  operator: string | null = null,
): RenderedPermissions {
  const match = matchDeclarations(declarations, state.members, operator);
  const accounts = sorted(state.accounts.keys());
  const shared = sorted(match.validatorNodes.map(normalizeEnode));
  const nodes = sorted([...shared, ...match.ownNodes.map(normalizeEnode)]);
  const toml = tomlOf(state, accounts, nodes);
  const sharedToml = tomlOf(state, accounts, shared);
  return { toml, sha256: sha(toml), sharedSha256: sha(sharedToml), accounts, nodes, match };
}

/**
 * Bu aracın ürettiği biçimi okur (yorumlar, `key=[ "…", … ]`, çok satırlı diziler). Genel bir TOML okuyucusu değildir: başka
 * anahtar ya da biçim → hata (elle düzenlenmiş dosya fark olarak görünmeli, sessizce okunmamalı).
 */
export function parsePermissionsToml(text: string): { accounts: string[]; nodes: string[] } {
  const body = text
    .split(/\r?\n/)
    .filter((l) => !/^\s*#/.test(l))
    .join("\n");
  // Karakter karakter okunur: dizi tırnak DIŞINDAKİ ilk `]` ile biter. Düzenli ifadeyle `[^\]]*` okumak IPv6 adresli enode'u
  // (`enode://…@[2001:db8::1]:30303`) adresin köşeli parantezinde kesiyordu (kontrol 2026-11-10).
  const out: Record<string, string[]> = {};
  const ws = /\s/;
  let i = 0;
  const skipWs = () => {
    while (i < body.length && ws.test(body[i])) i++;
  };
  for (skipWs(); i < body.length; skipWs()) {
    const km = /^([a-z-]+)\s*=/.exec(body.slice(i));
    if (!km) throw new Error("izin dosyası: tanınmayan içerik");
    const key = km[1];
    if (key !== "accounts-allowlist" && key !== "nodes-allowlist")
      throw new Error(`izin dosyası: beklenmeyen anahtar ${key}`);
    if (key in out) throw new Error(`izin dosyası: yinelenen anahtar ${key}`);
    i += key.length;
    skipWs();
    if (body[i] !== "=") throw new Error("izin dosyası: tanınmayan içerik");
    i++;
    skipWs();
    if (body[i] !== "[") throw new Error("izin dosyası: tanınmayan içerik");
    i++;
    const items: string[] = [];
    for (;;) {
      skipWs();
      if (i >= body.length) throw new Error("izin dosyası: kapanmamış dizi");
      if (body[i] === "]") {
        i++;
        break;
      }
      if (body[i] !== '"') {
        const bad = /^[^,\]\s]*/.exec(body.slice(i))![0];
        throw new Error(`izin dosyası: tırnaksız değer ${bad}`);
      }
      const end = body.indexOf('"', i + 1);
      if (end < 0) throw new Error("izin dosyası: kapanmamış tırnak");
      const value = body.slice(i + 1, end);
      if (/[\\\n]/.test(value)) throw new Error("izin dosyası: değerde kaçış ya da satır sonu");
      items.push(value);
      i = end + 1;
      skipWs();
      if (body[i] === ",") i++;
      else if (i >= body.length) throw new Error("izin dosyası: kapanmamış dizi");
      else if (body[i] !== "]") throw new Error("izin dosyası: tanınmayan içerik");
    }
    out[key] = items;
  }
  return { accounts: out["accounts-allowlist"] ?? [], nodes: out["nodes-allowlist"] ?? [] };
}

export interface PermissionsDiff {
  equal: boolean;
  accounts: { missingOnNode: string[]; extraOnNode: string[] };
  nodes: { missingOnNode: string[]; extraOnNode: string[] };
}

export function diffPermissions(
  expected: { accounts: string[]; nodes: string[] },
  actual: { accounts: string[]; nodes: string[] },
): PermissionsDiff {
  const d = (e: string[], a: string[], norm: (s: string) => string) => {
    const E = new Set(e.map(norm));
    const A = new Set(a.map(norm));
    return {
      missingOnNode: sorted([...E].filter((x) => !A.has(x))),
      extraOnNode: sorted([...A].filter((x) => !E.has(x))),
    };
  };
  const accounts = d(expected.accounts, actual.accounts, (s) => s.trim().toLowerCase());
  const nodes = d(expected.nodes, actual.nodes, normalizeEnode);
  const equal = [accounts, nodes].every((x) => x.missingOnNode.length === 0 && x.extraOnNode.length === 0);
  return { equal, accounts, nodes };
}

/** Yönetim ucu yalnız düğümün kendisinde (LP5): loopback dışı adres reddedilir. */
export function assertLoopbackRpc(url: string): void {
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol)) throw new Error("chain-permissions: düğüm yönetim ucu http(s) olmalı");
  const h = u.hostname.replace(/^\[|\]$/g, "");
  if (!(h === "127.0.0.1" || h === "localhost" || h === "::1"))
    throw new Error(
      `chain-permissions: düğüm yönetim ucu yalnız loopback (127.0.0.1) — ${h} reddedildi (PERM ad alanı dışarı açılmaz, ADR-0052 LP5)`,
    );
}

/** Düğümden yürürlükteki listeler (`perm_getAccountsAllowlist`, `perm_getNodesAllowlist`). */
export async function nodeAllowlists(
  nodeRpc: string,
  rpc: (url: string, method: string) => Promise<unknown> = jsonRpc,
): Promise<{ accounts: string[]; nodes: string[] }> {
  assertLoopbackRpc(nodeRpc);
  const [accounts, nodes] = await Promise.all([
    rpc(nodeRpc, "perm_getAccountsAllowlist"),
    rpc(nodeRpc, "perm_getNodesAllowlist"),
  ]);
  if (!Array.isArray(accounts) || !Array.isArray(nodes)) throw new Error("chain-permissions: düğüm liste döndürmedi");
  return { accounts: accounts.map(String), nodes: nodes.map(String) };
}

export async function jsonRpc(url: string, method: string, params: unknown[] = []): Promise<unknown> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(10_000),
  });
  const j = (await r.json()) as { result?: unknown; error?: { message?: string } };
  if (j.error) throw new Error(`${method}: ${j.error.message ?? "hata"}`);
  return j.result;
}

/** ethers okuyucu: dağıtım dosyasındaki adreslerle (chain-indexer bağlantısı + liste çapası kaydı). */
export function ethersPermissionsReader(
  trust: TrustContracts,
  anchorRegistry: string,
  runner: ContractRunner & { getBlockNumber(): Promise<number>; getNetwork(): Promise<{ chainId: bigint }> },
): PermissionsReader {
  const anchor = new Contract(anchorRegistry, loadAbi(), runner);
  const at = (block: number) => ({ blockTag: block });
  const contracts: Record<string, string> = {
    Governance: String(trust.Governance.target),
    IssuerRegistry: String(trust.IssuerRegistry.target),
    TrustListAnchorRegistry: anchorRegistry,
  };
  return {
    chainId: async () => Number((await runner.getNetwork()).chainId),
    blockNumber: () => runner.getBlockNumber(),
    contracts: () => contracts,
    memberCodes: async (b) => ((await trust.Governance.memberList(at(b))) as string[]).map(codeOf),
    member: async (code, b) => {
      const m = await trust.Governance.getMember(stateBytes(code), at(b));
      return { validator: String(m.validatorAddress), status: Number(m.status) };
    },
    stateDelegates: async (code, b) =>
      ((await trust.Governance.delegateKeysOf(stateBytes(code), at(b))) as string[]).map(String),
    issuersOf: async (code, b) =>
      ((await trust.IssuerRegistry.getIssuersByState(stateBytes(code), at(b))) as string[]).map(String),
    issuerOperational: async (id, b) => Boolean(await trust.IssuerRegistry.isOperational(id, at(b))),
    issuerDelegates: async (id, b) =>
      ((await trust.IssuerRegistry.issuerDelegatesOf(id, at(b))) as string[]).map(String),
    anchorers: async (b) => ((await anchor.anchorers(at(b))) as string[]).map(String),
    migrationExecutors: async (b) => {
      const out: string[] = [];
      for (const name of MIGRATING_REGISTRIES) {
        const c = trust[name];
        if (!(await c.isMigrationOpen(at(b)))) continue;
        const s = await c.migrationState(at(b));
        out.push(String(s.executor ?? s[4]));
      }
      return out;
    },
  };
}

export const stateBytes = (code: string) => "0x" + Buffer.from(code, "latin1").toString("hex");
