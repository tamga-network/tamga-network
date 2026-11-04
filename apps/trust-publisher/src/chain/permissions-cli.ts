/**
 * `npm run trust:chain-permissions -- render|check` (ADR-0052 K3). Ayrıntı: permissions.ts.
 *
 *   render [--out <dosya>] [--nodes <klasör>] [--operator <CC>] [--block <n>] [--deployment <dosya>]
 *   check  [--file <dosya>] [--node-rpc <url>] (+ render seçenekleri; --file yoksa beklenen liste zincirden çizilir)
 *
 * Ortam: TAMGA_CHAIN_RPC_URL (zincir okuma) · TAMGA_CHAIN_DEPLOYMENT (dağıtım dosyası; yerelde chainId'den
 * contracts/deployments/<ağ>.json) · TAMGA_CHAIN_NODE_RPC (check: düğümün yerel yönetim ucu, varsayılan http://127.0.0.1:8545).
 * Bayrak TAMGA_CHAIN_ENABLED=0 iken yalnız yerel geliştirme zincirleri (31337, 31338) okunur — üretim zinciri yok (ADR-0009 K4).
 * Çıkış: 0 tamam · 2 kullanım / bayrak · 3 fark ya da reddedilen bildirim.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JsonRpcProvider } from "ethers";

import { UNCACHED_PROVIDER, addressesFrom, connectTrustContracts } from "../../../chain-indexer/src/contracts.js";
import { LOCAL_CHAIN_IDS } from "../../../chain-indexer/src/local-dev.js";
import {
  diffPermissions,
  ethersPermissionsReader,
  nodeAllowlists,
  parsePermissionsToml,
  readPermissionsState,
  renderPermissions,
  type RenderedPermissions,
} from "./permissions.js";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const DEPLOYMENT_OF: Record<number, string> = { 31337: "localhost.json", 31338: "besuDev.json" };
export const DEFAULT_NODES_DIR = resolve(REPO, "network", "permissions", "nodes");

const opt = (args: string[], name: string) => {
  const k = args.indexOf(name);
  return k >= 0 ? args[k + 1] : undefined;
};

/** Klasördeki bildirimler (`*.json`, ad sırasıyla). Klasör yoksa boş. */
export function readDeclarations(dir: string): Array<{ file: string; decl: unknown }> {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((file) => {
      try {
        return { file, decl: JSON.parse(readFileSync(resolve(dir, file), "utf8")) as unknown };
      } catch {
        return { file, decl: null };
      }
    });
}

async function renderFromChain(
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<{ r: RenderedPermissions; chainId: number; block: number } | { error: string }> {
  const rpc = opt(args, "--rpc") ?? env.TAMGA_CHAIN_RPC_URL;
  if (!rpc || !/^https?:\/\//.test(rpc)) return { error: "TAMGA_CHAIN_RPC_URL gerekir (http/https)" };
  const provider = new JsonRpcProvider(rpc, undefined, UNCACHED_PROVIDER);
  const chainId = Number((await provider.getNetwork()).chainId);
  if (env.TAMGA_CHAIN_ENABLED !== "1" && !LOCAL_CHAIN_IDS.has(chainId))
    return { error: `TAMGA_CHAIN_ENABLED=0 — yalnız yerel geliştirme zinciri okunur (chainId ${chainId})` };
  const depFile =
    opt(args, "--deployment") ??
    env.TAMGA_CHAIN_DEPLOYMENT ??
    (DEPLOYMENT_OF[chainId] ? resolve(REPO, "contracts", "deployments", DEPLOYMENT_OF[chainId]) : undefined);
  if (!depFile || !existsSync(depFile))
    return { error: `dağıtım dosyası yok (${depFile ?? "TAMGA_CHAIN_DEPLOYMENT"})` };
  const dep = JSON.parse(readFileSync(depFile, "utf8")) as { contracts: Record<string, string> };
  const anchor = dep.contracts.TrustListAnchorRegistry;
  if (!anchor) return { error: "dağıtım dosyasında TrustListAnchorRegistry yok" };
  const reader = ethersPermissionsReader(connectTrustContracts(addressesFrom(dep), provider), anchor, provider);
  const b = opt(args, "--block");
  const state = await readPermissionsState(reader, b !== undefined ? Number(b) : undefined);
  const op = opt(args, "--operator");
  if (op !== undefined && !/^[A-Z]{2}$/.test(op)) return { error: "--operator iki büyük harf (devlet kodu)" };
  const r = renderPermissions(state, readDeclarations(resolve(opt(args, "--nodes") ?? DEFAULT_NODES_DIR)), op ?? null);
  return { r, chainId, block: state.block };
}

export async function chainPermissionsCommand(args: string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const sub = args[0];
  if (sub === "render") {
    const x = await renderFromChain(args, env);
    if ("error" in x) {
      console.error(`chain-permissions: ${x.error}`);
      return 2;
    }
    const out = opt(args, "--out");
    if (out) writeFileSync(out, x.r.toml, "utf8");
    console.log(
      JSON.stringify(
        {
          chainId: x.chainId,
          block: x.block,
          sha256: x.r.sha256,
          shared_sha256: x.r.sharedSha256,
          accounts: x.r.accounts.length,
          nodes: x.r.nodes.length,
          rejected: x.r.match.rejected,
          missing_validator_nodes: x.r.match.missing,
          ...(out ? { written: out } : {}),
        },
        null,
        2,
      ),
    );
    if (!out) process.stdout.write(x.r.toml);
    return x.r.match.rejected.length ? 3 : 0;
  }
  if (sub === "check") {
    const nodeRpc = opt(args, "--node-rpc") ?? env.TAMGA_CHAIN_NODE_RPC ?? "http://127.0.0.1:8545";
    let expected: { accounts: string[]; nodes: string[] };
    let source: string;
    const file = opt(args, "--file");
    if (file) {
      expected = parsePermissionsToml(readFileSync(file, "utf8"));
      source = file;
    } else {
      const x = await renderFromChain(args, env);
      if ("error" in x) {
        console.error(`chain-permissions: ${x.error}`);
        return 2;
      }
      expected = { accounts: x.r.accounts, nodes: x.r.nodes };
      source = `chain@${x.block} sha256 ${x.r.sha256}`;
    }
    const actual = await nodeAllowlists(nodeRpc);
    const diff = diffPermissions(expected, actual);
    console.log(JSON.stringify({ node: nodeRpc, expected: source, ...diff }, null, 2));
    if (!diff.equal) console.error("chain-permissions: düğümün izin listesi farklı — işletme olayı (ADR-0052 LP3)");
    return diff.equal ? 0 : 3;
  }
  console.error("kullanım: chain-permissions render [--out <dosya>] | check [--file <dosya>] [--node-rpc <url>]");
  return 2;
}
