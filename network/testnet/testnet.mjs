// Tamga Network test network — chain-side helpers of deploy-and-wire.sh (Node >= 22, ethers from the repository root).
// TEST NETWORK ONLY: chainId 31337/31338 and Hardhat's PUBLIC test accounts (mnemonic "test … junk"); refuses any other chain.
//
//   node network/testnet/testnet.mjs check-keys --dir <testnet dir>
//       every dev-key node: key → address and public key match the files written by make-network.sh
//   node network/testnet/testnet.mjs admit --rpc <url> --deployment <file> --state XA --validator-index 6 --voters 1,2
//       Governance: proposeStateAdmission (first voter) → vote(true) by every voter → execute; prints a JSON report
//   node network/testnet/testnet.mjs accounts --rpc <url> [--unlisted 9] [--listed 3]
//       local permissioning: the unlisted account's transaction is refused by the node, the listed one is mined
//
// Zincir tarafı yardımcılar: anahtar denetimi, Governance'a devlet kabulü (öneri → oylar → yürütme), hesap izni kanıtı.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Contract, HDNodeWallet, JsonRpcProvider, SigningKey, computeAddress, hexlify, toUtf8Bytes } from "ethers";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MNEMONIC = "test test test test test test test test test test test junk";
const LOCAL_CHAIN_IDS = new Set([31337, 31338]);
const TX = { type: 0, gasPrice: 0n }; // zeroBaseFee + min-gas-price=0 (genesis)

const opts = (argv) => {
  const o = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) o[argv[i].slice(2)] = argv[++i];
  return o;
};
const devWallet = (i) => HDNodeWallet.fromPhrase(MNEMONIC, undefined, `m/44'/60'/0'/0/${i}`);
const ACTIVE = 1n; // Governance.MemberStatus.ACTIVE

async function connect(rpc) {
  if (!rpc) throw new Error("--rpc required");
  const provider = new JsonRpcProvider(rpc, undefined, { cacheTimeout: -1 });
  provider.pollingInterval = 500;
  const chainId = Number((await provider.getNetwork()).chainId);
  if (!LOCAL_CHAIN_IDS.has(chainId)) throw new Error(`test network only (chainId ${chainId})`);
  return provider;
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
    const sk = new SigningKey(key);
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

async function admit({ rpc, deployment, state, "validator-index": vi, voters }) {
  if (!/^[A-Z]{2}$/.test(state ?? "")) throw new Error("--state: two upper-case letters");
  const provider = await connect(rpc);
  const dep = JSON.parse(readFileSync(deployment, "utf8"));
  const { abi } = JSON.parse(readFileSync(resolve(REPO, "apps/chain-indexer/src/abi/governance.json"), "utf8"));
  const gov = new Contract(dep.contracts.Governance, abi, provider);
  const code = hexlify(toUtf8Bytes(state));
  const validator = devWallet(Number(vi)).address;
  const signers = String(voters)
    .split(",")
    .map((i) => devWallet(Number(i)).connect(provider));
  if (await gov.isActiveMember(code)) {
    console.log(JSON.stringify({ state, validator, already: true }));
    return 0;
  }
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
  const member = await gov.getMember(code);
  const ok = member.status === ACTIVE && member.validatorAddress.toLowerCase() === validator.toLowerCase();
  console.log(
    JSON.stringify({
      state,
      validator,
      proposal: id,
      votes: signers.length,
      required,
      executedInBlock: ex.blockNumber,
      members: Number(await gov.activeMemberCount()),
      ok,
    }),
  );
  provider.destroy();
  return ok ? 0 : 1;
}

async function accounts({ rpc, unlisted = "9", listed = "3" }) {
  const provider = await connect(rpc);
  const send = async (i) => {
    const w = devWallet(Number(i)).connect(provider);
    const tx = await w.sendTransaction({ to: w.address, value: 0n, gasLimit: 21_000n, ...TX });
    const rc = await tx.wait();
    return { status: rc?.status, block: rc?.blockNumber };
  };
  let refused;
  try {
    await send(unlisted);
    refused = null;
  } catch (e) {
    refused = e.error?.message ?? e.info?.error?.message ?? e.shortMessage ?? e.message;
  }
  const mined = await send(listed);
  const out = { unlisted: { account: Number(unlisted), refused }, listed: { account: Number(listed), ...mined } };
  console.log(JSON.stringify(out));
  provider.destroy();
  return refused && mined.status === 1 ? 0 : 1;
}

const [cmd, ...rest] = process.argv.slice(2);
const o = opts(rest);
let code;
try {
  if (cmd === "check-keys") code = checkKeys(o);
  else if (cmd === "admit") code = await admit(o);
  else if (cmd === "accounts") code = await accounts(o);
  else {
    console.error("usage: testnet.mjs check-keys | admit | accounts (see the header)");
    code = 2;
  }
} catch (e) {
  console.error(`testnet.mjs ${cmd}: ${e.message}`);
  code = 1;
}
process.exit(code);
