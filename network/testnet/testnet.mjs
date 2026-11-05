// Tamga Network test network — chain-side helpers of deploy-and-wire.sh and bootstrap-governance.sh (Node >= 22, ethers from the
// repository root). TEST NETWORKS ONLY:
//   dev keys (default): chainId 31337/31338 and Hardhat's PUBLIC test accounts (mnemonic "test … junk") — path B
//   --keys <map>      : chainId 31339 and the key map written by make-network.sh --keys generate (tamga-chain-keys/1; the
//                       reference loader is apps/chain-indexer/src/chain-keys.ts) — path C
// Any other chain is refused.
//
//   node network/testnet/testnet.mjs check-keys --dir <testnet dir>
//       every node: key → address and public key match the files written by make-network.sh (dev keys: = Hardhat account #i)
//   node network/testnet/testnet.mjs check-keymap --keys <map>
//       the key map: format, purpose "test", chainId 31339, every key file (exists, mode 0600, key → address)
//   node network/testnet/testnet.mjs admit --rpc <url> --deployment <file> --state XA --validator-index 6 --voters 1,2
//   node network/testnet/testnet.mjs admit --rpc <url> --deployment <file> --state XA --keys <map>
//       Governance: proposeStateAdmission (first voter) → vote(true) by every voter → execute; prints a JSON report.
//       With --keys: the validator comes from the map, the voters are the validators of every state of the map that is an active
//       member on the chain, and the admitted state's delegate key is then set by its own validator (setDelegateKeys).
//       Idempotent: an active member is not proposed again; a delegate already set is not written again.
//   node network/testnet/testnet.mjs accounts --rpc <url> [--unlisted 9] [--listed 3]
//   node network/testnet/testnet.mjs accounts --rpc <url> --keys <map>
//       local permissioning: the unlisted account's transaction is refused by the node, the listed one is mined
//       (--keys: unlisted = a fresh random key, listed = the first founder's delegate)
//
// Zincir tarafı yardımcılar: anahtar denetimi, Governance'a devlet kabulü (öneri → oylar → yürütme), hesap izni kanıtı. Herkesçe
// bilinen Hardhat anahtarları yalnız 31337/31338'de; yol C (31339) yalnız anahtar haritasıyla.
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Contract,
  HDNodeWallet,
  JsonRpcProvider,
  SigningKey,
  Wallet,
  computeAddress,
  hexlify,
  toUtf8Bytes,
} from "ethers";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MNEMONIC = "test test test test test test test test test test test junk";
const LOCAL_CHAIN_IDS = new Set([31337, 31338]); // = apps/chain-indexer/src/local-dev.ts
const STAGING_CHAIN_IDS = new Set([31339]); // = apps/chain-indexer/src/chain-keys.ts
const TX = { type: 0, gasPrice: 0n }; // zeroBaseFee + min-gas-price=0 (genesis)

const opts = (argv) => {
  const o = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) o[argv[i].slice(2)] = argv[++i];
  return o;
};
const devWallet = (i) => HDNodeWallet.fromPhrase(MNEMONIC, undefined, `m/44'/60'/0'/0/${i}`);
const ACTIVE = 1n; // Governance.MemberStatus.ACTIVE
const code2 = (cc) => hexlify(toUtf8Bytes(cc));

async function connect(rpc, keys = null) {
  if (!rpc) throw new Error("--rpc required");
  const provider = new JsonRpcProvider(rpc, undefined, { cacheTimeout: -1 });
  provider.pollingInterval = 500;
  const chainId = Number((await provider.getNetwork()).chainId);
  if (keys) {
    if (!STAGING_CHAIN_IDS.has(chainId) || chainId !== keys.map.chainId)
      throw new Error(`key map only on its test/staging chain (chainId ${chainId}, map ${keys.map.chainId})`);
  } else if (!LOCAL_CHAIN_IDS.has(chainId))
    throw new Error(`public test keys only on a local chain (chainId ${chainId})`);
  return provider;
}

// Key map (tamga-chain-keys/1) — the same rules as apps/chain-indexer/src/chain-keys.ts (loadChainKeys)
function loadKeyMap(file) {
  if (!file || !existsSync(file)) throw new Error(`key map not found: ${file}`);
  const map = JSON.parse(readFileSync(file, "utf8"));
  const dir = dirname(resolve(file));
  const errs = [];
  if (map.format !== "tamga-chain-keys/1") errs.push(`format ${map.format}`);
  if (map.purpose !== "test") errs.push(`purpose ${map.purpose} (test only — production keys live in HSMs)`);
  if (!STAGING_CHAIN_IDS.has(map.chainId)) errs.push(`chainId ${map.chainId} is not a test/staging chain id`);
  const pks = new Map();
  const seen = new Map();
  const check = (ref, role) => {
    if (!ref?.key || !/^0x[0-9a-fA-F]{40}$/.test(ref?.address ?? ""))
      return errs.push(`${role}: address or key missing`);
    const p = isAbsolute(ref.key) ? ref.key : resolve(dir, ref.key);
    if (!existsSync(p)) return errs.push(`${role}: no key file ${ref.key}`);
    if (process.platform !== "win32" && (statSync(p).mode & 0o077) !== 0) errs.push(`${role}: ${ref.key} is not 0600`);
    const raw = readFileSync(p, "utf8").trim();
    if (!/^(0x)?[0-9a-fA-F]{64}$/.test(raw)) return errs.push(`${role}: ${ref.key} is not a private key`);
    const pk = raw.startsWith("0x") ? raw : `0x${raw}`;
    const a = computeAddress(new SigningKey(pk)).toLowerCase();
    if (a !== ref.address.toLowerCase()) errs.push(`${role}: the key does not belong to ${ref.address}`);
    if (seen.has(a) && seen.get(a) !== role) errs.push(`${role}: same address as ${seen.get(a)}`);
    seen.set(a, role);
    pks.set(a, pk);
  };
  check(map.deployer, "deployer");
  check(map.migration_executor, "migration_executor");
  (map.anchor?.anchorers ?? []).forEach((a, i) => check(a, `anchorer[${i}]`));
  const t = map.anchor?.threshold;
  if (!Number.isInteger(t) || t < 1 || t > (map.anchor?.anchorers ?? []).length) errs.push(`anchor.threshold ${t}`);
  if (!(map.states ?? []).some((x) => x.founder)) errs.push("states: no founder");
  for (const x of map.states ?? []) {
    if (!/^[A-Z]{2}$/.test(x.code ?? "")) errs.push(`states: bad code ${x.code}`);
    check(x.validator, `${x.code}.validator`);
    check(x.delegate, `${x.code}.delegate`);
  }
  if (errs.length) throw new Error(`key map ${file}: ${errs.join("; ")}`);
  const wallet = (ref, provider) => new Wallet(pks.get(ref.address.toLowerCase()), provider);
  const state = (cc) => {
    const x = map.states.find((y) => y.code === cc);
    if (!x) throw new Error(`${cc} is not in the key map`);
    return x;
  };
  return { file, map, wallet, state };
}

function checkKeys({ dir }) {
  if (!dir) throw new Error("--dir required");
  const env = readFileSync(resolve(dir, "network.env"), "utf8");
  const total = Number(/TESTNET_VALIDATORS=(\d+)/.exec(env)[1]) + Number(/TESTNET_EXTRA=(\d+)/.exec(env)[1]);
  const out = [];
  for (let n = 1; n <= total; n++) {
    const d = resolve(dir, `node${n}`);
    const key = readFileSync(resolve(d, "key"), "utf8").trim();
    const pub = readFileSync(resolve(d, "key.pub"), "utf8").trim();
    const address = readFileSync(resolve(d, "address"), "utf8").trim();
    const sk = new SigningKey(key.startsWith("0x") ? key : `0x${key}`);
    const ok = sk.publicKey.slice(4) === pub && computeAddress(sk).slice(2).toLowerCase() === address;
    let devIndex = null;
    try {
      devIndex = Number(readFileSync(resolve(d, "dev-index"), "utf8"));
      if (devWallet(devIndex).privateKey !== key) throw new Error(`node ${n}: key is not Hardhat account #${devIndex}`);
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    out.push({ node: n, address: `0x${address}`, devIndex, ok });
  }
  console.log(JSON.stringify(out));
  return out.every((x) => x.ok) ? 0 : 1;
}

function checkKeyMap({ keys }) {
  const k = loadKeyMap(keys);
  console.log(
    JSON.stringify({
      chainId: k.map.chainId,
      deployer: k.map.deployer.address,
      migration_executor: k.map.migration_executor.address,
      anchor: { threshold: k.map.anchor.threshold, anchorers: k.map.anchor.anchorers.map((a) => a.address) },
      states: k.map.states.map((x) => ({
        code: x.code,
        founder: x.founder,
        node: x.node,
        validator: x.validator.address,
      })),
    }),
  );
  return 0;
}

async function admit({ rpc, deployment, state, "validator-index": vi, voters, keys: keysFile }) {
  if (!/^[A-Z]{2}$/.test(state ?? "")) throw new Error("--state: two upper-case letters");
  const keys = keysFile ? loadKeyMap(keysFile) : null;
  const provider = await connect(rpc, keys);
  const dep = JSON.parse(readFileSync(deployment, "utf8"));
  const { abi } = JSON.parse(readFileSync(resolve(REPO, "apps/chain-indexer/src/abi/governance.json"), "utf8"));
  const gov = new Contract(dep.contracts.Governance, abi, provider);
  const code = code2(state);
  let validator;
  let signers;
  if (keys) {
    validator = keys.state(state).validator.address;
    signers = [];
    for (const x of keys.map.states)
      if (x.code !== state && (await gov.isActiveMember(code2(x.code))))
        signers.push(keys.wallet(x.validator, provider));
  } else {
    validator = devWallet(Number(vi)).address;
    signers = String(voters)
      .split(",")
      .map((i) => devWallet(Number(i)).connect(provider));
  }
  const report = { state, validator };
  if (await gov.isActiveMember(code)) {
    report.already = true;
  } else {
    const required = Number(await gov.requiredVotes("0x0000"));
    if (signers.length < required) throw new Error(`${signers.length} voters, ${required} votes required`);
    const rc = await (await gov.connect(signers[0]).proposeStateAdmission(code, validator, TX)).wait();
    const created = rc.logs
      .map((l) => {
        try {
          return gov.interface.parseLog(l);
        } catch {
          return null;
        }
      })
      .find((e) => e?.name === "ProposalCreated");
    if (!created) throw new Error("ProposalCreated event not found");
    const id = created.args[0];
    for (const s of signers) await (await gov.connect(s).vote(id, true, TX)).wait();
    const ex = await (await gov.connect(signers[0]).execute(id, TX)).wait();
    Object.assign(report, { proposal: id, votes: signers.length, required, executedInBlock: ex.blockNumber });
  }
  const member = await gov.getMember(code);
  let ok = member.status === ACTIVE && member.validatorAddress.toLowerCase() === validator.toLowerCase();
  if (keys && ok) {
    // the state's delegate key — set by the state's own validator (Governance.setDelegateKeys), as on the real network
    const delegate = keys.state(state).delegate.address;
    const has = async () => (await gov.delegateKeysOf(code)).some((a) => a.toLowerCase() === delegate.toLowerCase());
    if (!(await has())) {
      const v = keys.wallet(keys.state(state).validator, provider);
      await (await gov.connect(v).setDelegateKeys(code, [delegate], TX)).wait();
      report.delegateSet = delegate;
    } else report.delegate = delegate;
    ok = await has();
  }
  console.log(JSON.stringify({ ...report, members: Number(await gov.activeMemberCount()), ok }));
  provider.destroy();
  return ok ? 0 : 1;
}

async function accounts({ rpc, unlisted = "9", listed = "3", keys: keysFile }) {
  const keys = keysFile ? loadKeyMap(keysFile) : null;
  const provider = await connect(rpc, keys);
  const u = keys ? Wallet.createRandom().connect(provider) : devWallet(Number(unlisted)).connect(provider);
  const l = keys
    ? keys.wallet(keys.map.states.find((x) => x.founder).delegate, provider)
    : devWallet(Number(listed)).connect(provider);
  const send = async (w) => {
    const tx = await w.sendTransaction({ to: w.address, value: 0n, gasLimit: 21_000n, ...TX });
    const rc = await tx.wait();
    return { status: rc?.status, block: rc?.blockNumber };
  };
  let refused;
  try {
    await send(u);
    refused = null;
  } catch (e) {
    refused = e.error?.message ?? e.info?.error?.message ?? e.shortMessage ?? e.message;
  }
  const mined = await send(l);
  const out = {
    unlisted: { account: keys ? u.address : Number(unlisted), refused },
    listed: { account: keys ? l.address : Number(listed), ...mined },
  };
  console.log(JSON.stringify(out));
  provider.destroy();
  return refused && mined.status === 1 ? 0 : 1;
}

const [cmd, ...rest] = process.argv.slice(2);
const o = opts(rest);
let code;
try {
  if (cmd === "check-keys") code = checkKeys(o);
  else if (cmd === "check-keymap") code = checkKeyMap(o);
  else if (cmd === "admit") code = await admit(o);
  else if (cmd === "accounts") code = await accounts(o);
  else {
    console.error("usage: testnet.mjs check-keys | check-keymap | admit | accounts (see the header)");
    code = 2;
  }
} catch (e) {
  console.error(`testnet.mjs ${cmd}: ${e.message}`);
  code = 1;
}
process.exit(code);
