/**
 * `trust:chain-gov` — yönetişim komut aracı (SPEC-BC-0001 §1; ADR-0055, ADR-0073, ADR-0076, ADR-0086). Ad önerisi; onay
 * kaydı proje yönetiminde.
 *
 *   chain-gov status [--all] [--from-block <n>]            üyeler (düğüm + yönetişim adresi), eşik, açık öneriler, yükseltme kuyruğu
 *   chain-gov show <öneri>                                  önerinin türü, yükü, sayılan oy / eşik, şimdi yürütülebilir mi
 *   chain-gov queue                                         kuyruktaki yükseltmeler (en erken an, eşik)
 *   chain-gov propose <tür> --as <CC> [seçenekler]          öneri aç; türler: admit · remove · key-change · upgrade · anchorer ·
 *                                                           anchor-threshold · founder-recognition · migration-open|extend|close ·
 *                                                           schema-deprecate|revoke|hash · network-schema · network-record ·
 *                                                           rp-reassign · rp-reregister
 *   chain-gov vote <öneri> --yes|--no --as <CC>             oy ver (ya da oyu öteki yöne çevir)
 *   chain-gov retract <öneri> --as <CC>                     oyu geri çek
 *   chain-gov cancel <öneri> --as <CC>                      kendi önerini geri çek
 *   chain-gov execute <öneri> --as <CC>                     yürüt (yükseltmede ilk çağrı kuyruğa alır, 7 gün sonra uygular)
 *   chain-gov revote --as <CC>                              yükseltme ya da anahtar değişikliğinden sonra: açık önerilerde
 *                                                           sayılmayan son oyu aynı yönde yeniden ver
 *   chain-gov set-node --state <CC> --node <adres>          düğüm (QBFT) adresini değiştir — yönetişim anahtarıyla, oy yok (KG3)
 *   chain-gov set-delegates --state <CC> --keys <a,b,…>     devletin delege anahtarları (devletin iç işi, oy yok)
 *   chain-gov withdraw --as <CC>                            tek taraflı çıkış (iki üyeli ağda reddedilir, ADR-0076)
 * Ortak seçenekler: `--dry-run` (göndermez; çağrı verisini basar — bayrak kapalıyken de çalışır) · `--deployment <dosya>`.
 *
 * Kapılar (ADR-0084 K6, ADR-0085 SP7 ile aynı): bayrak `TAMGA_CHAIN_ENABLED` kapalıyken zincire bağlanılmaz ("disabled"; yalnız
 * `--dry-run` çağrı verisi). Yazma YALNIZ yerel geliştirme zincirine (31337, 31338; Hardhat test anahtarları, dağıtım dosyası) ve
 * test/staging zincirine (31339; `TAMGA_CHAIN_KEYS` anahtar haritası, `TAMGA_CHAIN_DEPLOYMENT`). Gerçek ağda okuma serbest, yazma
 * yolu yok: komut çağrı verisini basar ve durur (donanım anahtar kasası yolu ayrı karar kaydı, `hsmGovernanceSigner`).
 * Çıkış: 0 tamam · 2 kapı / yapılandırma · 3 kontrat reddi (gerekçe JSON'da).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JsonRpcProvider, type Contract } from "ethers";

import { STAGING_CHAIN_IDS, loadChainKeys } from "../../../chain-indexer/src/chain-keys.js";
import { UNCACHED_PROVIDER } from "../../../chain-indexer/src/contracts.js";
import { LOCAL_CHAIN_IDS, devWallets } from "../../../chain-indexer/src/local-dev.js";
import {
  address,
  code2,
  encodeOnly,
  governanceContract,
  hsmGovernanceSigner,
  proposal,
  proposalCall,
  revertReason,
  revote,
  send,
  status,
  walletGovernanceSigner,
  type GovernanceSigner,
} from "./governance.js";

const DEPLOYMENTS = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
  "contracts",
  "deployments",
);
const DEPLOYMENT_OF: Record<number, string> = { 31337: "localhost.json", 31338: "besuDev.json" };
const FLAGS = new Set(["all", "yes", "no", "allow", "deny", "dry-run"]);

export function parseArgs(argv: string[]): { pos: string[]; o: Record<string, string | boolean> } {
  const pos: string[] = [];
  const o: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      pos.push(a);
      continue;
    }
    const k = a.slice(2);
    if (FLAGS.has(k)) o[k] = true;
    else {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith("--")) throw new Error(`chain-gov: --${k} bir değer ister`);
      o[k] = v;
      i++;
    }
  }
  return { pos, o };
}

interface Deployment {
  chainId?: number;
  contracts: Record<string, string>;
}

function loadDeployment(
  o: Record<string, string | boolean>,
  env: NodeJS.ProcessEnv,
  chainId?: number,
): Deployment | null {
  const file =
    (typeof o.deployment === "string" && o.deployment) ||
    env.TAMGA_CHAIN_DEPLOYMENT ||
    (chainId !== undefined && DEPLOYMENT_OF[chainId] ? resolve(DEPLOYMENTS, DEPLOYMENT_OF[chainId]) : "");
  if (!file || !existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8")) as Deployment;
}

const registryResolver = (d: Deployment) => (v: string) => {
  if (/^0x[0-9a-fA-F]{40}$/.test(v)) return address(v, "--registry");
  const a = d.contracts[v];
  if (!a)
    throw new Error(`chain-gov: dağıtım dosyasında ${v} yok (adres ya da ${Object.keys(d.contracts).join(", ")})`);
  return address(a, v);
};

/** İmzacı: yerel zincirde Hardhat test anahtarı (üyenin zincirdeki yönetişim adresi), test zincirinde anahtar haritası. */
async function signerFor(
  gov: Contract,
  provider: JsonRpcProvider,
  chainId: number,
  cc: string,
  env: NodeJS.ProcessEnv,
): Promise<GovernanceSigner | { refused: string }> {
  if (LOCAL_CHAIN_IDS.has(chainId)) {
    const want = String((await gov.getMember(code2(cc))).governanceAddress).toLowerCase();
    for (const w of devWallets(provider))
      if ((await w.getAddress()).toLowerCase() === want) return walletGovernanceSigner("local-dev", cc, w);
    return { refused: `${cc}: yönetişim adresi ${want} yerel test hesaplarından değil` };
  }
  if (STAGING_CHAIN_IDS.has(chainId)) {
    if (!env.TAMGA_CHAIN_KEYS) return { refused: `test/staging zinciri (chainId ${chainId}) TAMGA_CHAIN_KEYS ister` };
    const keys = loadChainKeys(env.TAMGA_CHAIN_KEYS);
    if (keys.map.chainId !== chainId)
      return { refused: `anahtar haritası chainId ${keys.map.chainId}, zincir ${chainId}` };
    return walletGovernanceSigner("key-map", cc, keys.wallet(keys.state(cc).governance, provider));
  }
  try {
    return hsmGovernanceSigner(cc);
  } catch (e) {
    return {
      refused: `gerçek ağda yazma yolu yok (chainId ${chainId}; ADR-0085 SP7, ADR-0084 LS6) — ${(e as Error).message}`,
    };
  }
}

const out = (x: unknown) => console.log(JSON.stringify(x, null, 2));

/** Yazma alt komutu → (imzacı devleti, fonksiyon, bağımsız değişkenler). */
function writeCall(
  sub: string,
  pos: string[],
  o: Record<string, string | boolean>,
  d: Deployment,
): { as: string; fn: string; args: unknown[]; kind?: string } {
  const as = typeof o.as === "string" ? o.as : typeof o.state === "string" ? o.state : "";
  if (!as) throw new Error(`chain-gov ${sub}: --as <CC> (imzalayan devlet) gerekir`);
  const pid = () => {
    const id = pos[0];
    if (!id || !/^0x[0-9a-fA-F]{64}$/.test(id)) throw new Error(`chain-gov ${sub}: öneri kimliği (0x + 64) gerekir`);
    return id;
  };
  switch (sub) {
    case "propose": {
      const c = proposalCall(pos[0] ?? "", o, registryResolver(d));
      return { as, fn: c.fn, args: c.args, kind: c.kind };
    }
    case "vote":
      if (!!o.yes === !!o.no) throw new Error("chain-gov vote: --yes ya da --no (biri)");
      return { as, fn: "vote", args: [pid(), !!o.yes] };
    case "retract":
      return { as, fn: "retractVote", args: [pid()] };
    case "cancel":
      return { as, fn: "cancelProposal", args: [pid()] };
    case "execute":
      return { as, fn: "execute", args: [pid()] };
    case "withdraw":
      return { as, fn: "withdraw", args: [] };
    case "set-node":
      return {
        as,
        fn: "setValidatorAddress",
        args: [code2(String(o.state ?? as)), address(typeof o.node === "string" ? o.node : undefined, "--node")],
      };
    case "set-delegates": {
      const keys = String(o.keys ?? "")
        .split(",")
        .filter(Boolean)
        .map((k) => address(k, "--keys"));
      return { as, fn: "setDelegateKeys", args: [code2(String(o.state ?? as)), keys] };
    }
    default:
      throw new Error(`chain-gov: bilinmeyen alt komut ${sub}`);
  }
}

const WRITE = new Set(["propose", "vote", "retract", "cancel", "execute", "withdraw", "set-node", "set-delegates"]);
const READ = new Set(["status", "show", "queue"]);

export async function chainGovCommand(argv: string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const [sub, ...rest] = argv;
  if (!sub || (!WRITE.has(sub) && !READ.has(sub) && sub !== "revote")) {
    console.error(
      "kullanım: chain-gov status|show <id>|queue|propose <tür>|vote <id> --yes|--no|retract <id>|cancel <id>|execute <id>|" +
        "revote|set-node|set-delegates|withdraw [--as CC] [--dry-run] [--deployment <dosya>]",
    );
    return 2;
  }
  const { pos, o } = parseArgs(rest);
  const dryRun = !!o["dry-run"];
  const enabled = env.TAMGA_CHAIN_ENABLED === "1";

  if (!enabled) {
    // ADR-0084 K6: kapalıyken zincire bağlanılmaz. Yalnız yazma alt komutlarının çağrı verisi (--dry-run) basılabilir.
    if (WRITE.has(sub) && dryRun) {
      const d = loadDeployment(o, env);
      const gov = d?.contracts.Governance ?? (typeof o.governance === "string" ? o.governance : undefined);
      if (!d || !gov) {
        console.error("chain-gov: --dry-run çağrı verisi için --deployment <dosya> (Governance adresi) gerekir");
        return 2;
      }
      const c = writeCall(sub, pos, o, d);
      out({
        chain: "disabled",
        dryRun: true,
        as: c.as,
        kind: c.kind,
        tx: encodeOnly(address(gov, "Governance"), c.fn, c.args),
      });
      return 0;
    }
    out({
      chain: "disabled",
      note: "TAMGA_CHAIN_ENABLED=0 — zincire bağlanılmadı; yazma alt komutları için --dry-run",
    });
    return 0;
  }

  const rpc = env.TAMGA_CHAIN_RPC_URL;
  if (!rpc || !/^https?:\/\//.test(rpc)) {
    console.error("chain-gov: TAMGA_CHAIN_RPC_URL gerekir (http/https)");
    return 2;
  }
  const provider = new JsonRpcProvider(rpc, undefined, UNCACHED_PROVIDER);
  try {
    const chainId = Number((await provider.getNetwork()).chainId);
    const d = loadDeployment(o, env, chainId);
    if (!d?.contracts?.Governance) {
      console.error(
        "chain-gov: dağıtım dosyası yok (--deployment, TAMGA_CHAIN_DEPLOYMENT ya da contracts/deployments/)",
      );
      return 2;
    }
    if (d.chainId !== undefined && d.chainId !== chainId) {
      console.error(`chain-gov: dağıtım dosyası chainId ${d.chainId}, zincir ${chainId}`);
      return 2;
    }
    const gov = governanceContract(d.contracts.Governance, provider);
    const fromBlock = typeof o["from-block"] === "string" ? Number(o["from-block"]) : 0;

    if (sub === "status") {
      out(await status(gov, provider, { fromBlock, all: !!o.all }));
      return 0;
    }
    if (sub === "queue") {
      out({ upgradeQueue: (await status(gov, provider, { fromBlock })).upgradeQueue });
      return 0;
    }
    if (sub === "show") {
      if (!pos[0]) throw new Error("chain-gov show: öneri kimliği gerekir");
      out(await proposal(gov, pos[0], (await provider.getBlock("latest"))!.timestamp));
      return 0;
    }

    const as = typeof o.as === "string" ? o.as : typeof o.state === "string" ? o.state : "";
    if (!as) throw new Error(`chain-gov ${sub}: --as <CC> (imzalayan devlet) gerekir`);
    const signer = await signerFor(gov, provider, chainId, as, env);
    if ("refused" in signer) {
      if (sub !== "revote") {
        const c = writeCall(sub, pos, o, d);
        out({ dryRun: true, refused: signer.refused, tx: encodeOnly(String(gov.target), c.fn, c.args) });
      } else out({ refused: signer.refused });
      console.error(`chain-gov: ${signer.refused} — gönderilmedi`);
      return 2;
    }
    try {
      if (sub === "revote") {
        out(await revote(gov, signer, provider, { fromBlock, dryRun }));
        return 0;
      }
      const c = writeCall(sub, pos, o, d);
      const r = await send(gov, signer, provider, c.fn, c.args, { dryRun });
      out({ chainId, as: c.as, signer: signer.kind, kind: c.kind, tx: r });
      return 0;
    } catch (e) {
      out({ error: "revert", reason: revertReason(gov, e) });
      return 3;
    }
  } finally {
    provider.destroy();
  }
}
