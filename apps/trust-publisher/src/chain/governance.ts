/**
 * Yönetişim işlemleri (SPEC-BC-0001 §1; ADR-0002, ADR-0055, ADR-0073, ADR-0076, ADR-0086) — `trust:chain-gov` komutunun çekirdeği.
 * Komut satırından bağımsızdır: Governance kontratı, sağlayıcı ve imzacı verilir; her işlem düz JSON döndürür (testler süreç içi
 * zincirde aynı fonksiyonları çağırır).
 *
 * İmza soyuttur (`GovernanceSigner`): bugün yalnız yerel geliştirme anahtarı (Hardhat test hesapları, dağıtım dosyasındaki
 * kurucuların yönetişim anahtarı) ve test/staging anahtar haritası (`tamga-chain-keys/1`). Donanım anahtar kasası yolu (HSM /
 * uzaktan imzacı) ayrı karar kaydıyla gelir (ADR-0084 LS6): `hsmGovernanceSigner` bugün açık iletiyle hata verir. Gerçek ağda
 * yazma yolu yoktur (ADR-0085 SP7 ile aynı kapı): komut yalnız okur ve işlemin çağrı verisini basar.
 *
 * Kişisel veri ve serbest metin zincire gitmez (ADR-0074 PJ2): gerekçe metni yalnız SHA-256 özetiyle yazılır.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Contract,
  getAddress,
  hexlify,
  id as keccakText,
  isAddress,
  toUtf8Bytes,
  type ContractRunner,
  type InterfaceAbi,
  type Provider,
  type Signer,
} from "ethers";

const GOV_ABI_FILE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "chain-indexer",
  "src",
  "abi",
  "governance.json",
);
export function governanceAbi(): InterfaceAbi {
  return (JSON.parse(readFileSync(GOV_ABI_FILE, "utf8")) as { abi: InterfaceAbi }).abi;
}
export function governanceContract(address: string, runner: ContractRunner): Contract {
  return new Contract(address, governanceAbi(), runner);
}

/** Governance.ProposalKind (değerler yalnız sona eklenir) */
export const PROPOSAL_KINDS = [
  "NONE",
  "STATE_ADMISSION",
  "STATE_REMOVAL",
  "PROTOCOL_UPGRADE",
  "NETWORK_SCHEMA",
  "REGISTRY_ADMIN",
  "GOVERNANCE_KEY_CHANGE",
] as const;
export const PROPOSAL_STATUSES = ["NONE", "OPEN", "EXECUTED", "CANCELLED"] as const;
export const MEMBER_STATUSES = ["NONE", "ACTIVE", "SUSPENDED", "WITHDRAWN"] as const;
/** Governance.AdminAction (değerler yalnız sona eklenir) */
export const ADMIN_ACTIONS = [
  "NONE",
  "SET_ANCHORER",
  "SET_ANCHOR_THRESHOLD",
  "BOOTSTRAP_FOUNDERS",
  "DEPRECATE_NETWORK_SCHEMA",
  "REVOKE_NETWORK_SCHEMA",
  "OPEN_MIGRATION",
  "EXTEND_MIGRATION",
  "CLOSE_MIGRATION",
  "ADD_NETWORK_SCHEMA_HASH",
  "NETWORK_RECORD",
  "REASSIGN_RELYING_PARTY",
  "REREGISTER_RELYING_PARTY",
] as const;

// -----------------------------------------------------------------------------------------------------------------
// İmzacı (soyut)
// -----------------------------------------------------------------------------------------------------------------

/** Yönetişim anahtarıyla imza. Uygulama yerel anahtar, anahtar haritası ya da (ileride) donanım kasası olabilir. */
export interface GovernanceSigner {
  /** "local-dev" | "key-map" | "hsm" */
  readonly kind: string;
  /** imzacının temsil ettiği devlet (bilgi; yetki zincirde denetlenir) */
  readonly state: string;
  getAddress(): Promise<string>;
  /** sağlayıcıya bağlı ethers imzacısı (donanım kasası uygulaması kendi AbstractSigner'ını döndürür) */
  connect(provider: Provider): Signer;
}

/** ethers imzacısından (yerel anahtar / anahtar haritası) GovernanceSigner. */
export function walletGovernanceSigner(kind: "local-dev" | "key-map", state: string, signer: Signer): GovernanceSigner {
  return {
    kind,
    state,
    getAddress: () => signer.getAddress(),
    connect: (provider) => (signer.provider === provider ? signer : signer.connect(provider)),
  };
}

/** Donanım anahtar kasası yolu — tanımlı değil (ADR-0084 LS6: üretim anahtar yolu ayrı karar kaydı). */
export function hsmGovernanceSigner(state: string): GovernanceSigner {
  throw new Error(
    `chain-gov: ${state} için donanım anahtar kasası (HSM / uzaktan imzacı) yolu henüz tanımlı değil — üretim anahtar yolu ayrı ` +
      `karar kaydıyla gelir (ADR-0084 LS6); bugün yalnız yerel geliştirme ve test/staging anahtar haritası`,
  );
}

// -----------------------------------------------------------------------------------------------------------------
// Yardımcılar
// -----------------------------------------------------------------------------------------------------------------

export const code2 = (cc: string) => {
  if (!/^[A-Z]{2}$/.test(cc)) throw new Error(`chain-gov: devlet kodu iki büyük harf olmalı: ${cc}`);
  return hexlify(toUtf8Bytes(cc));
};
export const ccOf = (b2: string) => Buffer.from(b2.replace(/^0x/, ""), "hex").toString("latin1");
/** Gerekçe metninin özeti (metin zincire gitmez; ADR-0074 PJ2). */
export const reasonHash = (text: string) => `0x${createHash("sha256").update(text, "utf8").digest("hex")}`;
const BYTES32 = /^0x[0-9a-fA-F]{64}$/;
export const bytes32 = (v: string | undefined, name: string) => {
  if (!v || !BYTES32.test(v)) throw new Error(`chain-gov: ${name} 32 baytlık onaltılık değer olmalı (0x + 64)`);
  return v.toLowerCase();
};
export const address = (v: string | undefined, name: string) => {
  if (!v || !isAddress(v)) throw new Error(`chain-gov: ${name} adres olmalı`);
  return getAddress(v);
};
/** "initializeV2()" → seçici; "0x12345678" olduğu gibi. Yalnız parametresiz başlangıç (ADR-0055 GE2). */
export function initSelector(v: string): string {
  if (/^0x[0-9a-fA-F]{8}$/.test(v)) return v.toLowerCase();
  if (!/^[A-Za-z_][A-Za-z0-9_]*\(\)$/.test(v))
    throw new Error(
      "chain-gov: --init yalnız parametresiz imza (ör. initializeV2()) ya da 4 baytlık seçici (ADR-0055 GE2)",
    );
  return keccakText(v).slice(0, 10);
}
const num = (x: unknown) => Number(x as bigint);

// -----------------------------------------------------------------------------------------------------------------
// Öneriler: tür → kontrat çağrısı
// -----------------------------------------------------------------------------------------------------------------

export interface ProposalCall {
  /** komut satırındaki tür adı */
  kind: string;
  fn: string;
  args: unknown[];
}

/**
 * Komut satırı türü + seçenekler → Governance çağrısı (saf; ağ yok). `registry` adları dağıtım dosyasındaki anahtarlardır
 * (`resolveRegistry`). Bilinmeyen tür ya da eksik seçenek → hata.
 */
export function proposalCall(
  kind: string,
  o: Record<string, string | boolean | undefined>,
  resolveRegistry: (nameOrAddress: string) => string,
): ProposalCall {
  const s = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : undefined);
  const reg = () => resolveRegistry(s("registry") ?? "");
  const why = () => {
    if (s("reason-hash")) return bytes32(s("reason-hash"), "--reason-hash");
    if (s("reason")) return reasonHash(s("reason")!);
    throw new Error("chain-gov: --reason <metin> ya da --reason-hash 0x… gerekir (metin zincire gitmez, yalnız özeti)");
  };
  switch (kind) {
    case "admit":
      return {
        kind,
        fn: "proposeStateAdmission",
        args: [code2(s("state") ?? ""), address(s("node"), "--node"), address(s("governance"), "--governance")],
      };
    case "remove":
      return { kind, fn: "proposeStateRemoval", args: [code2(s("state") ?? ""), why()] };
    case "key-change":
      return {
        kind,
        fn: "proposeGovernanceKeyChange",
        args: [code2(s("state") ?? ""), address(s("governance"), "--governance")],
      };
    case "upgrade": {
      const target = resolveRegistry(s("target") ?? "");
      const impl = address(s("impl"), "--impl");
      if (s("init"))
        return { kind, fn: "proposeProtocolUpgradeAndInit", args: [target, impl, initSelector(s("init")!)] };
      return { kind, fn: "proposeProtocolUpgrade", args: [target, impl] };
    }
    case "anchorer": {
      if (!!o.allow === !!o.deny) throw new Error("chain-gov: anchorer için --allow ya da --deny (biri)");
      return { kind, fn: "proposeAnchorerChange", args: [reg(), address(s("anchorer"), "--anchorer"), !!o.allow] };
    }
    case "anchor-threshold": {
      const n = Number(s("required"));
      if (!Number.isInteger(n) || n < 1 || n > 255) throw new Error("chain-gov: --required 1..255");
      return { kind, fn: "proposeAnchorThreshold", args: [reg(), n] };
    }
    case "founder-recognition": {
      const codes = (s("founders") ?? "").split(",").filter(Boolean).map(code2);
      if (codes.length < 2) throw new Error("chain-gov: --founders en az iki devlet (ör. TR,KZ)");
      return { kind, fn: "proposeFounderRecognition", args: [reg(), codes] };
    }
    case "migration-open": {
      const w = Number(s("window"));
      if (!Number.isInteger(w) || w < 1 || w > 30 * 86400)
        throw new Error("chain-gov: --window saniye, 1..2592000 (en çok 30 gün, ADR-0073 K1)");
      return {
        kind,
        fn: "proposeMigrationOpen",
        args: [reg(), bytes32(s("plan-hash"), "--plan-hash"), w, address(s("executor"), "--executor")],
      };
    }
    case "migration-extend": {
      const d = Number(s("deadline"));
      if (!Number.isInteger(d) || d <= 0) throw new Error("chain-gov: --deadline unix saniye");
      return { kind, fn: "proposeMigrationExtend", args: [reg(), d] };
    }
    case "migration-close":
      return { kind, fn: "proposeMigrationClose", args: [reg()] };
    case "schema-deprecate":
      return {
        kind,
        fn: "proposeNetworkSchemaDeprecation",
        args: [
          bytes32(s("schema-id"), "--schema-id"),
          s("superseded-by") ? bytes32(s("superseded-by"), "--superseded-by") : `0x${"0".repeat(64)}`,
        ],
      };
    case "schema-revoke":
      return { kind, fn: "proposeNetworkSchemaRevocation", args: [bytes32(s("schema-id"), "--schema-id"), why()] };
    case "schema-hash":
      return {
        kind,
        fn: "proposeNetworkSchemaContentHash",
        args: [bytes32(s("schema-id"), "--schema-id"), bytes32(s("content-hash"), "--content-hash")],
      };
    case "network-schema": {
      const file = s("file");
      if (!file) throw new Error("chain-gov: network-schema --file <kayıt.json> (SchemaRecord, tier NETWORK = 0)");
      const rec = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
      if (Number(rec.tier) !== 0) throw new Error("chain-gov: ağ şeması kaydında tier 0 (NETWORK) olmalı");
      return { kind, fn: "proposeNetworkSchema", args: [rec] };
    }
    case "network-record":
      return { kind, fn: "proposeNetworkRecord", args: [reg(), bytes32(s("stage-id"), "--stage-id")] };
    case "rp-reassign":
      return { kind, fn: "proposeRelyingPartyReassignment", args: [reg(), bytes32(s("stage-id"), "--stage-id")] };
    case "rp-reregister":
      return { kind, fn: "proposeRelyingPartyReRegistration", args: [reg(), bytes32(s("stage-id"), "--stage-id")] };
    default:
      throw new Error(`chain-gov: bilinmeyen öneri türü ${kind} — ${PROPOSE_KINDS.join(" | ")}`);
  }
}
export const PROPOSE_KINDS = [
  "admit",
  "remove",
  "key-change",
  "upgrade",
  "anchorer",
  "anchor-threshold",
  "founder-recognition",
  "migration-open",
  "migration-extend",
  "migration-close",
  "schema-deprecate",
  "schema-revoke",
  "schema-hash",
  "network-schema",
  "network-record",
  "rp-reassign",
  "rp-reregister",
] as const;

// -----------------------------------------------------------------------------------------------------------------
// Okuma
// -----------------------------------------------------------------------------------------------------------------

export interface MemberView {
  state: string;
  status: (typeof MEMBER_STATUSES)[number];
  node: string;
  governance: string;
  joinedAt: number;
  governanceSince: number;
}

export async function members(gov: Contract): Promise<MemberView[]> {
  const out: MemberView[] = [];
  for (const b of (await gov.memberList()) as string[]) {
    const m = await gov.getMember(b);
    out.push({
      state: ccOf(b),
      status: MEMBER_STATUSES[num(m.status)] ?? "NONE",
      node: String(m.validatorAddress),
      governance: String(m.governanceAddress),
      joinedAt: num(m.joinedAt),
      governanceSince: num(m.governanceSince),
    });
  }
  return out;
}

export interface ProposalView {
  id: string;
  kind: (typeof PROPOSAL_KINDS)[number];
  status: (typeof PROPOSAL_STATUSES)[number];
  proposer: string;
  createdAt: number;
  expiresAt: number;
  forVotes: number;
  againstVotes: number;
  /** yürütmede sayılacak destek (bugünkü etkin üyelerin bugünkü yönetişim anahtarıyla, GV3) */
  counted: number;
  required: number;
  /** kuyruktaki yükseltmenin en erken uygulanma anı (0 = kuyrukta değil) */
  executableAt: number;
  state?: string;
  node?: string;
  governance?: string;
  target?: string;
  newImplementation?: string;
  admin?: { action: string; registry: string; account: string; allowed: boolean; required: number; digest: string };
  removalReasonHash?: string;
  upgrade?: { initSelector: string; implCodehash: string };
  /** şimdi `execute` çağrılsa ne olur (tahmin; kesin karar kontratta) */
  readiness: "ready" | "queue" | "waiting-delay" | "below-threshold" | "expired" | "closed";
}

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

export async function proposal(gov: Contract, pid: string, now: number): Promise<ProposalView> {
  const p = await gov.getProposal(pid);
  const kind = PROPOSAL_KINDS[num(p.kind)] ?? "NONE";
  if (kind === "NONE") throw new Error(`chain-gov: öneri yok: ${pid}`);
  const status = PROPOSAL_STATUSES[num(p.status)] ?? "NONE";
  const excluded = kind === "STATE_REMOVAL" ? String(p.stateCode) : "0x0000";
  const required = num(await gov.requiredVotes(excluded));
  const counted = num(await gov.countedForVotes(pid));
  const executableAt = num(await gov.executableAt(pid));
  const v: ProposalView = {
    id: pid,
    kind,
    status,
    proposer: String(p.proposer),
    createdAt: num(p.createdAt),
    expiresAt: num(p.expiresAt),
    forVotes: num(p.forVotes),
    againstVotes: num(p.againstVotes),
    counted,
    required,
    executableAt,
    readiness: "closed",
  };
  if (kind === "STATE_ADMISSION" || kind === "STATE_REMOVAL" || kind === "GOVERNANCE_KEY_CHANGE")
    v.state = ccOf(String(p.stateCode));
  if (kind === "STATE_ADMISSION") v.node = String(p.validatorAddress);
  if (kind === "STATE_ADMISSION" || kind === "GOVERNANCE_KEY_CHANGE") v.governance = String(p.governanceAddress);
  if (kind === "PROTOCOL_UPGRADE") {
    v.target = String(p.target);
    v.newImplementation = String(p.newImplementation);
    const [sel, codehash] = (await gov.upgradePayloadOf(pid)) as [string, string];
    v.upgrade = { initSelector: String(sel), implCodehash: String(codehash) };
  }
  if (kind === "STATE_REMOVAL") v.removalReasonHash = String(await gov.removalReasonOf(pid));
  if (kind === "REGISTRY_ADMIN") {
    const a = await gov.getAdminPayload(pid);
    v.admin = {
      action: ADMIN_ACTIONS[num(a.action)] ?? "NONE",
      registry: String(a.registry),
      account: String(a.account),
      allowed: Boolean(a.allowed),
      required: num(a.required),
      digest: String(a.digest),
    };
  }
  if (status === "OPEN") {
    if (executableAt > 0) {
      const ttl = 30 * 86400;
      v.readiness =
        now < executableAt
          ? "waiting-delay"
          : now > executableAt + ttl
            ? "expired"
            : counted >= required
              ? "ready"
              : "below-threshold";
    } else if (now > v.expiresAt) v.readiness = "expired";
    else if (counted < required) v.readiness = "below-threshold";
    else v.readiness = kind === "PROTOCOL_UPGRADE" ? "queue" : "ready";
  }
  return v;
}

/** Öneri kimlikleri `ProposalCreated` olaylarından (≤ 2000 blokluk dilimler — Besu sorgu sınırı, indeksleyiciyle aynı). */
export async function proposalIds(gov: Contract, provider: Provider, fromBlock = 0): Promise<string[]> {
  const latest = await provider.getBlockNumber();
  const ids: string[] = [];
  for (let b = fromBlock; b <= latest; b += 2000) {
    const evs = await gov.queryFilter(gov.filters.ProposalCreated(), b, Math.min(latest, b + 1999));
    for (const e of evs) ids.push(String((e as unknown as { args: unknown[] }).args[0]));
  }
  return ids;
}

export async function status(gov: Contract, provider: Provider, opts: { fromBlock?: number; all?: boolean } = {}) {
  const now = (await provider.getBlock("latest"))!.timestamp;
  const list = await members(gov);
  const views: ProposalView[] = [];
  for (const id of await proposalIds(gov, provider, opts.fromBlock ?? 0)) {
    const v = await proposal(gov, id, now);
    if (opts.all || v.status === "OPEN") views.push(v);
  }
  return {
    chainId: Number((await provider.getNetwork()).chainId),
    governance: String(gov.target),
    block: await provider.getBlockNumber(),
    time: now,
    activeMembers: num(await gov.activeMemberCount()),
    requiredVotes: num(await gov.requiredVotes("0x0000")),
    members: list,
    proposals: views,
    upgradeQueue: views
      .filter((v) => v.executableAt > 0 && v.status === "OPEN")
      .map((v) => ({
        id: v.id,
        target: v.target,
        eta: v.executableAt,
        readiness: v.readiness,
        counted: v.counted,
        required: v.required,
      })),
  };
}

// -----------------------------------------------------------------------------------------------------------------
// Yazma
// -----------------------------------------------------------------------------------------------------------------

export interface TxResult {
  fn: string;
  args: unknown[];
  from: string;
  to: string;
  data: string;
  sent: boolean;
  hash?: string;
  block?: number;
  proposalId?: string;
}

const jsonable = (x: unknown): unknown =>
  typeof x === "bigint" ? x.toString() : Array.isArray(x) ? x.map(jsonable) : x;

/**
 * Bir Governance çağrısını hazırlar ve (dryRun değilse) gönderir. Göndermeden önce `staticCall` ile dener: kontratın
 * ret gerekçesi (ör. `KeyChangeNeedsOwnVote`, `ThresholdNotMet`) işlem gönderilmeden görünür.
 */
export async function send(
  gov: Contract,
  signer: GovernanceSigner,
  provider: Provider,
  fn: string,
  args: unknown[],
  opts: { dryRun?: boolean } = {},
): Promise<TxResult> {
  const s = signer.connect(provider);
  const from = await signer.getAddress();
  const c = gov.connect(s) as Contract;
  const data = gov.interface.encodeFunctionData(fn, args);
  const base: TxResult = { fn, args: jsonable(args) as unknown[], from, to: String(gov.target), data, sent: false };
  if (opts.dryRun) return base;
  await c.getFunction(fn).staticCall(...args);
  const tx = await c.getFunction(fn).send(...args);
  const rc = await tx.wait();
  const out: TxResult = { ...base, sent: true, hash: tx.hash, block: rc?.blockNumber };
  for (const l of rc?.logs ?? []) {
    try {
      const e = gov.interface.parseLog(l);
      if (e?.name === "ProposalCreated") out.proposalId = String(e.args[0]);
    } catch {
      /* başka kontrat */
    }
  }
  return out;
}

/** Çağrıyı göndermeden kodlar (zincire bağlanmadan; bayrak kapalıyken de çalışır). */
export function encodeOnly(governance: string, fn: string, args: unknown[], from = ZERO_ADDR): TxResult {
  const iface = new Contract(governance, governanceAbi()).interface;
  return {
    fn,
    args: jsonable(args) as unknown[],
    from,
    to: governance,
    data: iface.encodeFunctionData(fn, args),
    sent: false,
  };
}

/**
 * Yükseltmeden (ya da anahtar değişikliğinden) sonra yeniden oy: imzacının devletinin açık önerilerdeki son oyunu bulur ve
 * sayılmıyorsa aynı yönde yeniden verir. Sayılıp sayılmadığını kontrat söyler: aynı yönde ikinci oy sayılan oyda `AlreadyVoted`
 * ile reddedilir, sayılmayan (eski anahtar, eski dönem ya da depolaması değişmiş) oyda kabul edilir (SPEC-BC-0001 §9).
 */
export async function revote(
  gov: Contract,
  signer: GovernanceSigner,
  provider: Provider,
  opts: { fromBlock?: number; dryRun?: boolean; state?: string } = {},
) {
  const me = (await signer.getAddress()).toLowerCase();
  const now = (await provider.getBlock("latest"))!.timestamp;
  const all = (await members(gov)).filter((m) => m.status === "ACTIVE");
  const myState = all.find((m) => m.governance.toLowerCase() === me)?.state;
  if (!myState) throw new Error(`chain-gov: ${me} etkin bir üyenin bugünkü yönetişim anahtarı değil (NotGovernor)`);
  // Devletin geçmiş yönetişim anahtarları dahil son oy yönü: Voted / VoteRetracted olayları (eski anahtarın oyu da yön verir)
  const latest = await provider.getBlockNumber();
  const last = new Map<string, boolean | null>();
  const keyChanges = await gov.queryFilter(
    gov.filters.GovernanceAddressChanged(code2(myState)),
    opts.fromBlock ?? 0,
    latest,
  );
  const myKeys = new Set([
    me,
    ...keyChanges.map((e) => String((e as unknown as { args: unknown[] }).args[1]).toLowerCase()),
  ]);
  const admitted = await gov.queryFilter(gov.filters.StateAdmitted(code2(myState)), opts.fromBlock ?? 0, latest);
  for (const e of admitted) myKeys.add(String((e as unknown as { args: unknown[] }).args[2]).toLowerCase());
  for (let b = opts.fromBlock ?? 0; b <= latest; b += 2000) {
    const to = Math.min(latest, b + 1999);
    const evs = [
      ...(await gov.queryFilter(gov.filters.Voted(), b, to)),
      ...(await gov.queryFilter(gov.filters.VoteRetracted(), b, to)),
    ].sort((x, y) => x.blockNumber - y.blockNumber || x.index - y.index);
    for (const e of evs) {
      const ev = e as unknown as { fragment: { name: string }; args: unknown[] };
      if (!myKeys.has(String(ev.args[1]).toLowerCase())) continue;
      last.set(String(ev.args[0]), ev.fragment.name === "Voted" ? Boolean(ev.args[2]) : null);
    }
  }
  const results: Array<{ id: string; support: boolean; action: "revoted" | "counted" | "would-revote"; tx?: string }> =
    [];
  for (const [pid, support] of last) {
    if (support === null) continue;
    const v = await proposal(gov, pid, now);
    if (v.status !== "OPEN" || v.readiness === "expired") continue;
    const c = gov.connect(signer.connect(provider)) as Contract;
    try {
      await c.getFunction("vote").staticCall(pid, support);
    } catch (e) {
      if (
        String((e as Error).message).includes("AlreadyVoted") ||
        (e as { revert?: { name?: string } }).revert?.name === "AlreadyVoted"
      ) {
        results.push({ id: pid, support, action: "counted" });
        continue;
      }
      throw e;
    }
    if (opts.dryRun) {
      results.push({ id: pid, support, action: "would-revote" });
      continue;
    }
    const tx = await c.getFunction("vote").send(pid, support);
    await tx.wait();
    results.push({ id: pid, support, action: "revoted", tx: tx.hash });
  }
  return { state: myState, governance: me, results };
}

/** Ret gerekçesini okunur biçime çevirir (kontratın özel hata adı). */
export function revertReason(gov: Contract, e: unknown): string {
  const err = e as {
    data?: string;
    info?: { error?: { data?: string } };
    revert?: { name?: string; args?: unknown[] };
    shortMessage?: string;
    message?: string;
  };
  if (err.revert?.name) return `${err.revert.name}(${(err.revert.args ?? []).map((x) => String(x)).join(", ")})`;
  const data = err.data ?? err.info?.error?.data;
  if (typeof data === "string" && data.startsWith("0x")) {
    try {
      const d = gov.interface.parseError(data);
      if (d) return `${d.name}(${d.args.map((x) => String(x)).join(", ")})`;
    } catch {
      /* çözülemedi */
    }
  }
  return err.shortMessage ?? err.message ?? String(e);
}
