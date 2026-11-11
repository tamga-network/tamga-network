---
document_id: GUIDE-0018
title: "Setting up a chain test network: Hyperledger Besu step by step"
status: Active
version: 1.0.0
created: 2026-11-05
last_updated: 2026-11-05
summary: >
  A step-by-step guide, from scratch, for anyone who wants to test the chain layer while the chainless live system runs: terms
  (node, validator, QBFT and 3f+1, genesis, chainId, enode, static peers, permissioned network, RPC and P2P, Governance, anchor,
  replay, equivalence), three paths (one Windows computer, four validators on one Linux machine, a real server layout with
  systemd), measured requirements, what the network files and the besu.toml fields mean, deploying the contracts, rendering the
  permission list from the chain, anchoring the lists on the chain, replaying the history and the equivalence test, validator
  add and remove votes, a fault test, RPC protection, monitoring, reset, troubleshooting and the automated test on GitHub.
translation_of: GUIDE-0018
source_version: 1.0.0
---

# Setting up a chain test network: Hyperledger Besu step by step

This guide is for anyone who wants to set up and try Tamga's [[t:ledger]] (Hyperledger Besu, QBFT) **on their own computer or test
servers**. It assumes no prior knowledge: every term is explained where it first appears and every command says what it does. All
commands are scripts in the public repository; the measurements in this guide come from a real run of those scripts on GitHub
Actions.

::: danger The chain is off in production today
Tamga's trust rests today on signed [[t:trust-list|trust lists]]; there is **no** production chain ([[ADR-0009]] K4,
[[ADR-0051]]). The network you set up with this guide is a **test network**:

- it has no connection to the live system (signed lists, verification, wallet, sandbox); it neither slows it down nor changes it;
- its chain id is 31338 in paths A and B (the local development id; the repository's tools recognise only 31337 and 31338 as
  "local chains") and 31339 in path C (the test/staging id);
- the node keys (paths A and B) are publicly known test keys: for `127.0.0.1` or a closed test network only; in path C every key is
  freshly generated but all of them sit on one machine: a test network only as well.

How the two modes (chainless and chain) relate, what the chain adds and how the two stay in sync: [[GUIDE-0016]].
:::

**When to read:**
- If you want to see the chain layer with your own eyes and try its setup and operation.
- If your state or institution is considering running a validator later, before or alongside the handbook ([[GUIDE-0015]]): the
  handbook describes the steps **on the real network**, this guide how to try the same steps **on a test network**.
- First (optional): the [Shared ledger (chain)](/concepts/ledger) concept.

## Terms

This section is enough to read the rest of the guide.

| Term | What it means |
|---|---|
| Blockchain / ledger | A data structure that several computers keep together and in which a record, once added, cannot be changed. Records are ordered in blocks; each block carries the digest of the previous one. In Tamga: the "shared ledger" |
| Node | The program that runs a copy of the ledger, and the machine it runs on. Tamga's node program is Hyperledger Besu (written in Java, a single JVM process) |
| Validator | A node that proposes and signs blocks. A full node validates and reads the chain but does not sign blocks |
| QBFT | Besu's consensus method. Validators vote on every block; a block is final once more than two thirds of the validators accept it and is never rolled back |
| 3f+1 | QBFT's resilience rule: a network of n validators tolerates at most f = ⌊(n−1)/3⌋ validators being down or misbehaving. See the table below |
| Genesis | The chain's first block and starting settings (`genesis.json`): chain id, block time, first validators, starting balances. It must be byte for byte the same on every node; if it changes, a separate chain results |
| chainId | The chain's numeric identity. Every signed transaction carries it, so a transaction signed for one chain is not valid on another. Test network: `31338` (paths A and B), `31339` (path C) |
| `extraData` | A genesis field; in QBFT it carries the list of the first validator addresses in RLP (Ethereum's binary encoding) |
| enode | A node's network address: `enode://<128-character public key>@<IP>:<P2P port>`. The public key is the node's identity; its address is derived from that key |
| Bootnode / static nodes | The nodes a freshly started node connects to first. In Tamga discovery is off; each node reads the peers it connects to from `static-nodes.json` |
| Permissioned network | A network where only listed nodes can connect (`nodes-allowlist`) and only listed accounts can send transactions (`accounts-allowlist`). Both lists are in a local file on every node: `permissions_config.toml` ([[ADR-0052]]) |
| Account | A 20-byte address (`0x…`) derived from a key pair; that key signs transactions. The node key is an account too: a validator's address is its node key's address |
| P2P | The connection over which nodes exchange blocks and votes (default port 30303, TCP). Opened outside only to the other validators |
| RPC (JSON-RPC) | The HTTP interface through which a program queries a node or sends it transactions (default port 8545). Management methods (`admin_`, `perm_`, `qbft_`) are used only from the node itself; they are never exposed, or only through the protected proxy |
| Contract (smart contract) | A program that runs on the chain. Tamga's contracts hold the chain counterpart of the trust entries (Governance, institutions, verifiers, credential types, status list anchors, list anchors…) |
| Governance | The contract that holds membership and network decisions: states are members, decisions are taken by a 2/3 vote. A state's validator address is written here; the permission list is rendered from here |
| Anchor | Writing the digest of some data to the chain. In Tamga the digest of every signed list version is written to the list anchor registry (`trust:chain-submit`); this digest shows the list has not been changed afterwards |
| Replay | Transferring the whole history of the signed lists to the contracts once, with the dates in the lists (`trust:chain-replay`, [[ADR-0073]]) |
| Equivalence test | Asking the same questions of the signed list and of the chain and comparing the answers. Not a single difference in an accept or reject answer is allowed |

**3f+1 table.** f = ⌊(n−1)/3⌋ (⌊ ⌋: round down). To produce blocks at least n − f validators must be online.

| Validators (n) | Faults tolerated (f) | At least online to produce blocks |
|---|---|---|
| 1 | 0 | 1 |
| 2 | 0 | 2 |
| 4 | 1 | 3 |
| 5 | 1 | 4 |
| 7 | 2 | 5 |
| 10 | 3 | 7 |

That is why the test network has **4 validators**: the smallest network that tolerates one fault. This was measured: with one of
4 validators stopped, blocks continued; with a second stopped, they stopped; restarted, they resumed (§ Fault test).

**Voting threshold.** In QBFT, more than half of the current validators (⌊n/2⌋ + 1) vote to add or remove a validator: 3 votes
with 4 validators, 3 votes with 5. This is a separate vote from the 2/3 vote in Governance (§ Adding and removing validators).

## Three paths

| | Path A — Windows, one computer | Path B — 4 validators on one Linux machine | Path C — real server layout |
|---|---|---|---|
| For | A first look at the contracts, the permission list and voting | Trying the whole multi-node network end to end | Trying the installation on test servers |
| Nodes | 1 (not permissioned) or 2 (permissioned mode) | 4 validators + 1 extra node, all on `127.0.0.1` | 1 node per server |
| Scripts | `scripts/besu-dev.ps1` (`npm run chain:besu:*`) | `network/testnet/*.sh` (process mode) | `network/testnet/*.sh` + `besu@.service` (systemd mode) |
| Keys | Generated locally (single node) or Hardhat test accounts | Hardhat test accounts (`--keys dev`) | Freshly generated (`--keys generate`), with a key map |
| Tried on | Windows 11, PowerShell 5.1 | Ubuntu 24.04 (GitHub Actions, weekly) | Ubuntu 24.04 (GitHub Actions: single-validator `systemd` job; 4 validators with generated keys, `staging` job) |

What they share: the same Besu version (26.11.0), the same Java version (JDK 25), the same genesis settings, the same contracts and
the same tools. Moving from path A to B does not mean learning anything again.

### Requirements

**Software:**

| | Path A | Paths B and C |
|---|---|---|
| Operating system | Windows 10/11 | Linux x64 or aarch64 |
| Node.js | 22 or later | 22 or later |
| Commands | PowerShell 5.1, Git | `bash curl jq unzip tar ss openssl sha256sum setsid pgrep`; `nginx` to try the RPC protection |
| Java and Besu | the script downloads them | the script downloads them |

You do not install Java and Besu by hand: the scripts download **Temurin JDK 25** and **Besu 26.11.0** from the official release
pages, compare the sha256 digest with the fixed value in the repository (on a mismatch they delete the file and stop) and unpack
them. No Docker.

**Hardware (measured).** Path B's run on GitHub Actions (Ubuntu 24.04, 4 CPUs, 16 GB memory; 4 validators + 1 extra node on the same
machine; Java heap `-Xmx768m` per node):

| Measurement | Value |
|---|---|
| Memory (per node, RSS) | 505–568 MiB |
| CPU (per node, over the whole run) | 10–37 s of CPU time; very low while idling and producing blocks |
| Disk (per node) | 74–76 MiB (at 404 blocks) |
| Node start-up | JSON-RPC answers within 2–3 s |
| The whole end-to-end test | 921 s (616 s of it the 111-operation replay) |

For planning (inferred from the measurement): allow about 0.6 GB of memory per node; path B's 5 nodes together hold about 3 GB,
plus the operating system and the Node.js tools. In path C
the systemd unit uses `-Xmx1g`. The server recommendation for the real network is separate: [[GUIDE-0015]] §1.

## Path A — one Windows computer

All commands from the repository root, in PowerShell. First prepare the repository and the packages:

```powershell
git clone https://github.com/tamga-network/tamga-network; cd tamga-network
npm install
npm run setup                 # local PKI + signed local lists (apps/trust-publisher/dist) — anchoring uses them
npm run contracts:install     # contract dependencies (contracts/)
npm run contracts:compile
```

### A1. Single-node network (not permissioned)

```powershell
npm run chain:besu:init     # downloads JDK 25 + Besu (tools/), generates the genesis and a validator key (network/dev/)
npm run chain:besu:start    # starts the node: RPC 127.0.0.1:8546, P2P 127.0.0.1:30313; waits for the first block
npm run chain:besu:status   # chainId, block number, validators
npm run chain:besu:deploy   # deploys the contracts → contracts/deployments/besuDev.json
npm run chain:besu:stop     # stops (chain data stays)
npm run chain:besu:reset    # stops and deletes the chain data; genesis and key stay
```

What `init` does:
1. Downloads JDK 25 and Besu into `tools/_dl/`, checks the sha256, unpacks them as `tools/jdk-25` and `tools/besu-26.11.0`.
2. Generates one validator key and the genesis with Besu's own tool (`besu operator generate-blockchain-config`):
   `network/dev/keys/key` (private key; generated on this computer, never enters the repository) and `network/dev/genesis.json`.
3. Overwrites nothing: to regenerate, delete `network/dev/genesis.json` and `network/dev/keys/`.

`start` runs the node in the background and returns once the block number starts to grow. The log is in
`network/dev/data/besu.log`. This single node produces blocks on its own (1 validator, f = 0); it is enough to try the contracts,
anchoring and replay.

Port 8545 is deliberately not used (it is reserved for Hardhat's local node); Besu is on 8546.

### A2. Two-node permissioned network

A separate local network (`network/dev/perm/`) to see the permission list and validator voting. The two node keys are Hardhat's
publicly known test accounts #1 (TR) and #2 (KZ); so the validator address, the validator address in Governance and the enode
address are the same — the real network's matching rule ([[ADR-0052]] K2) is tried in its real form.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\besu-dev.ps1 -Init -Permissioned           # genesis, two keys, two node declarations
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\besu-dev.ps1 -Start -Permissioned          # node 1: RPC 8546, P2P 30313
npm run chain:besu:deploy                                                                              # contracts
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\besu-dev.ps1 -Apply -Permissioned          # permission list from the chain
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\besu-dev.ps1 -Start -Permissioned -Node 2  # node 2: RPC 8547, P2P 30314
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\besu-dev.ps1 -Apply -Permissioned          # again, on both nodes
npx tsx apps/trust-publisher/scripts/besu-permissions-smoke.ts accounts      # unlisted account refused, delegate writes
npx tsx apps/trust-publisher/scripts/besu-permissions-smoke.ts vote-add      # node 2 becomes a validator
npx tsx apps/trust-publisher/scripts/besu-permissions-smoke.ts vote-remove   # and is removed
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\besu-dev.ps1 -Status -Permissioned
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\besu-dev.ps1 -Stop -Permissioned
```

| Step | What happens |
|---|---|
| `-Init -Permissioned` | One founding validator in the genesis (node 1); two node keys; two node declarations (`network/dev/perm/nodes/`) |
| `-Start -Permissioned` | Node 1 starts with the **start-up permissions file**: before the contracts exist, it lists node 1 and the local deployment's accounts (#0–#4) |
| `-Apply -Permissioned` | Renders the permission list from the chain for every running node, has the node load it and checks it; with two nodes running, each first waits until it is in sync (`-SyncTimeout <s>`, default 180) |
| `-Start … -Node 2` | Node 2 starts as a full node, connected to node 1 as a static peer |
| `accounts` | The transaction of an account not on the list (#9) is refused by the node ("Sender account not authorized to send transactions"); the listed state delegate's (#3) is mined |
| `vote-add` / `vote-remove` | Node 2 enters and leaves the validator set by QBFT vote (with 2 validators the majority is 2 votes) |

The single-node network and the permissioned mode **do not run at the same time** (same ports).

## Path B — 4 validators on one Linux machine

All commands from the repository root. The scripts are described in detail in the repository's `network/testnet/README.md`.

### B1. Preparation

```bash
git clone https://github.com/tamga-network/tamga-network && cd tamga-network
npm ci && npm run setup && npm run contracts:install && npm run contracts:compile
```

### B2. Installing Java and Besu

```bash
bash network/testnet/install-besu.sh       # → tools/jdk-25, tools/besu-26.11.0, tools/besu (link)
```

The script picks the right JDK archive for the CPU architecture (x64 or aarch64), downloads it, checks the sha256, unpacks it, and
finally checks the output of `java -version` and `besu --version`. It does not download again what is present. Options:
`--prefix <dir>` (install elsewhere), `--cache <dir>` (download cache), `--system` (path C).

::: warning The JAVA_HOME trap
The scripts do **not** use the generic `JAVA_HOME` variable; they take the JDK from `TESTNET_JAVA_HOME` (default `tools/jdk-25`).
The reason was found on GitHub Actions: there (and on many servers) `JAVA_HOME` points to an older JDK (17), while Besu 26.x needs
Java 25 and does not start with an older JDK. To use a JDK 25 you installed yourself: `--java-home <dir>` or
`TESTNET_JAVA_HOME=<dir>`.
:::

### B3. Creating the network

```bash
bash network/testnet/make-network.sh       # default: 4 validators + 1 extra node → network/testnet/run/
```

| Option | Default | What |
|---|---|---|
| `--validators N` | 4 | Validators in the genesis |
| `--extra E` | 1 | Extra nodes that start as full nodes and can be voted in as validators later |
| `--keys dev\|generate` | `dev` | `dev`: Hardhat's publicly known test accounts #1 #2 #6 #7 #8 (at most 5 nodes). `generate`: fresh random keys |
| `--chain-id` | 31338 | Chain id (the end-to-end test works only with 31338; with `--keys generate` the default is 31339) |
| `--block-period` | 2 | Block time (seconds) |
| `--hosts "ip1 ip2 …"` | — | One node per server (path C) |
| `--dir`, `--besu-home`, `--java-home` | `network/testnet/run`, `tools/besu`, `tools/jdk-25` | Directories |
| `--force` | — | Deletes the existing network (with its data) and writes it again; refuses while a node is running |

**How the keys and the genesis are made.** With `--keys dev` each node's key is a fixed test account; with `--keys generate`
Besu's tool (`besu operator generate-blockchain-config`) generates fresh keys. Then the addresses of the first N nodes are written
into the genesis `extraData` with Besu's RLP tool (`besu rlp encode --type=QBFT_EXTRA_DATA`): that is the genesis validator set.
Extra nodes are not validators in the genesis; they are voted in.

Test states: node 1 `TR`, node 2 `KZ` (the two founders of the local deploy script), nodes 3–5 `XA`, `XB`, `XC`. `XA`… are ISO 3166
user-assigned codes; they stand for no real state.

**Files written** (`network/testnet/run/`, not in the repository):

| File | What |
|---|---|
| `genesis.json` | The genesis shared by all nodes |
| `network.env` | Network settings (validator count, ports, Java and Besu paths); the other scripts read it |
| `declarations/<cc>-node<n>.json` | Each node's declaration (`tamga-node-declaration/1`: state, role, public key, IP, P2P port, operations contact) |
| `node<n>/key` | The node's private key (mode `600`) |
| `node<n>/key.pub`, `node<n>/address` | Public key (enode identity) and the address derived from it (validator address) |
| `node<n>/state` | The node's test state code |
| `node<n>/static-nodes.json` | Peers to connect to: the enodes of the other genesis validators |
| `node<n>/permissions_config.toml` | Start-up permissions file: the genesis validators' nodes and accounts + the local deployment's accounts (deployer #0, TR and KZ delegates #3, #4). Replaced by the file rendered from the chain once the contracts exist |
| `node<n>/besu.toml` | All of the node's settings (below) |

**Genesis fields:**

| Field | Value | Meaning |
|---|---|---|
| `config.chainId` | 31338 | Chain id |
| `config.berlinBlock`, `londonBlock`, `shanghaiTime` | 0 | Ethereum rule versions active from the first block (the contracts are compiled for `shanghai`) |
| `config.zeroBaseFee` | `true` | No transaction fee (permissioned network; nobody buys space with fees) |
| `config.qbft.blockperiodseconds` | 2 | Time between two blocks |
| `config.qbft.epochlength` | 30000 | Block interval after which pending votes are reset |
| `config.qbft.requesttimeoutseconds` | 4 | Time before moving to a new round if no proposal arrives (twice the block time) |
| `gasLimit` | `0x1fffffffffffff` | Per-block transaction capacity limit (high) |
| `difficulty`, `mixHash`, `nonce`, `coinbase` | fixed | Fixed values QBFT expects (no mining) |
| `alloc` | 10 test accounts | Starting balance for Hardhat's test accounts (test only) |
| `extraData` | RLP | The genesis validators' addresses |

**`besu.toml` fields** (on every node; values for node 1):

| Field | Value | Meaning |
|---|---|---|
| `data-path` | `run/node1/db` | Directory of the chain data |
| `genesis-file` | `run/genesis.json` | The shared genesis |
| `node-private-key-file` | `run/node1/key` | Node key (the validator address is derived from it) |
| `sync-mode` | `FULL` | Sync by validating every block from the start |
| `p2p-host` | `127.0.0.1` | The address **advertised** to other nodes (the address in the enode) |
| `p2p-interface` | `127.0.0.1` | The interface P2P **listens** on. If not set, Besu listens on `0.0.0.0` (all interfaces); `p2p-host` does not change that |
| `p2p-port` | 30313 | P2P port |
| `discovery-enabled` | `false` | Peer discovery off; peers come only from the static list |
| `static-nodes-file` | `run/node1/static-nodes.json` | Static peers |
| `rpc-http-enabled` | `true` | JSON-RPC on |
| `rpc-http-host` | `127.0.0.1` | JSON-RPC only from this machine |
| `rpc-http-port` | 8546 | JSON-RPC port |
| `rpc-http-api` | `ETH, NET, WEB3, QBFT, PERM, ADMIN` | Enabled method groups; `QBFT` for votes, `PERM` to load the permission list, `ADMIN` to see peers — all only on `127.0.0.1` |
| `host-allowlist` | `localhost`, `127.0.0.1` | JSON-RPC accepts only these `Host` headers |
| `metrics-enabled` | `false` | Metrics endpoint off (on a real node it is opened on the local interface only, [[GUIDE-0015]] §8) |
| `min-gas-price` | 0 | Free transactions accepted |
| `color-enabled` | `false` | No colour codes in the log |
| `permissions-nodes-config-file-enabled` | `true` | Node allowlist on |
| `permissions-accounts-config-file-enabled` | `true` | Account allowlist on |
| `permissions-nodes-config-file`, `permissions-accounts-config-file` | `run/node1/permissions_config.toml` | Both lists in the same file |

### B4. Starting, stopping, status

```bash
bash network/testnet/node.sh start all        # or: start 1, start 2 …
bash network/testnet/node.sh status all
bash network/testnet/node.sh logs 1           # last 100 lines
bash network/testnet/node.sh stop all
```

`start` runs the node in the background (process id in `node<n>/besu.pid`, log in `node<n>/besu.log`) and waits until JSON-RPC
answers (`TESTNET_START_TIMEOUT`, default 120 s). It does not start if a port is in use. `stop` first sends SIGTERM (Besu closes its
database cleanly), and SIGKILL if the node has not stopped within 60 s. The Java heap is set with `TESTNET_HEAP` (default `768m`).

`status` prints one line per node: state code, address, running or not, RPC address, block number, peer count, validator count.

| Node | JSON-RPC | P2P | Role |
|---|---|---|---|
| 1 | 127.0.0.1:8546 | 127.0.0.1:30313 | genesis validator (TR) |
| 2 | 127.0.0.1:8547 | 127.0.0.1:30314 | genesis validator (KZ) |
| 3 | 127.0.0.1:8548 | 127.0.0.1:30315 | genesis validator (XA) |
| 4 | 127.0.0.1:8549 | 127.0.0.1:30316 | genesis validator (XB) |
| 5 | 127.0.0.1:8550 | 127.0.0.1:30317 | extra node (XC); voted in as a validator |

Rule: node n's RPC port is 8545 + n, its P2P port 30312 + n. This network and the Windows local network use the same chain id and
the same deployment file: do not run both on the same machine.

### B5. End-to-end test in one command

The script that does all the steps of the sections below in order, checks each one and writes a summary at the end:

```bash
bash network/testnet/deploy-and-wire.sh            # starts the nodes, tests, stops them at the end
bash network/testnet/deploy-and-wire.sh --keep     # leaves the nodes running at the end (to continue by hand)
```

| # | Step | Measured result (GitHub Actions) |
|---|---|---|
| 1 | 4 validators start, each peers with the other 3; JSON-RPC and P2P only on `127.0.0.1` | 4 validators, 3 peers on every node; 8 listening sockets, all `127.0.0.1` |
| 2 | Contracts deployed (founders TR, KZ) | 10 contracts |
| 3 | Signed list archive replayed into the contracts; equivalence test | 111 operations; 557 questions, 0 decision differences |
| 4 | Lists anchored (`trust:chain-submit`), each list checked (`trust:chain-check`) | 3 writes; YES for 2 lists |
| 5 | The other genesis validators' states (XA, XB) admitted to Governance by 2/3 vote | 4 members |
| 6 | Every node renders the permission list **from its own node**, loads and checks it; shared digests equal; unlisted account refused | 7 accounts, 4 nodes, same digest on 4 nodes; #9 refused, #3 written |
| 7 | Node 5 admitted, allow-listed, synced, voted in as a validator (proposes a block), voted out | 3 of 4 votes → 5 validators in 9 s, node 5 proposed a block; 3 of 5 votes → back to 4 in 10 s |
| 8 | One validator stopped: blocks continue; a second stopped: they stop; restarted: they resume | 1 stopped → continued; 2 stopped → no block for 20 s; restart → resumed in 66 s |
| 9 | RPC protection (method filter + nginx mutual TLS) | 32 checks passed, nginx mTLS tested |
| 10 | Summary | `run/summary.md`, `run/summary.json` |

If a step does not give the expected result, the script stops, prints the last log lines and writes the step where it stopped
into the summary.

## Path C — real server layout (systemd)

Installation on test servers: one node per server, the node runs as a system service.

### C1. On every server: Java, Besu and the service user

```bash
sudo bash network/testnet/install-besu.sh --system
```

With `--system`:
- JDK and Besu are installed under `/opt/tamga-besu/` and are **owned by root** (the service user cannot change the programs);
- a system user `besu` is created (no shell, cannot log in);
- `/var/lib/tamga-besu` (owner `besu`, mode `0750`) is prepared for node data.

### C2. On one machine: the network files

```bash
sudo bash network/testnet/make-network.sh --dir /var/lib/tamga-besu --besu-home /opt/tamga-besu/besu \
     --java-home /opt/tamga-besu/jdk-25 --keys generate --hosts "192.0.2.10 192.0.2.11 192.0.2.12 192.0.2.13" --extra 0
```

- `--keys generate`: the keys are fresh, not the publicly known test keys.
- `--hosts`: one IP per node (nodes 1, 2, … in order). In this mode P2P listens on that IP on every node, port 30303; JSON-RPC on
  `127.0.0.1:8545`. The address must be directly on the server's network interface; in a cloud where the internal and external
  addresses differ, `besu.toml` is corrected so that `p2p-interface` is the internal and `p2p-host` the external address.
- `192.0.2.x` are documentation example addresses; write your own.

The script writes all keys on one machine. Then **only its own** directory is copied to each server: `genesis.json`, `network.env`
and `node<n>/` (under `/var/lib/tamga-besu/`, same paths). The other nodes' `key` files do not go to that server. On the real
network this step is different: every operator generates its key **on its own hardware** and shares only the public key
([[GUIDE-0015]] §3).

### C3. On every server: the service

```bash
sudo chown -R besu:besu /var/lib/tamga-besu
sudo install -m 0644 network/testnet/besu@.service /etc/systemd/system/ && sudo systemctl daemon-reload
sudo systemctl enable --now besu@node1                      # on server 1; besu@node2 on server 2, …
sudo TESTNET_DIR=/var/lib/tamga-besu TESTNET_MODE=systemd bash network/testnet/node.sh status 1
journalctl -u besu@node1 -n 100 --no-pager                  # log
```

`besu@.service` is a template: the instance `besu@node1` runs with `/var/lib/tamga-besu/node1/besu.toml`. The unit:

| Setting | What it gives |
|---|---|
| `User=besu`, `UMask=0077` | The node runs as an unprivileged user; files it writes are readable only by it |
| `ReadWritePaths=/var/lib/tamga-besu/%i`, `ProtectSystem=strict`, `ProtectHome=true` | It can write only its own data directory; the rest of the system is read-only |
| `NoNewPrivileges`, empty `CapabilityBoundingSet`, `SystemCallFilter=@system-service` | No privilege escalation, no capabilities, only ordinary system calls |
| `RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX AF_NETLINK` | Only network and local sockets |
| `KillSignal=SIGTERM`, `TimeoutStopSec=120` | Besu has time to close its database |
| `Restart=on-failure` | Restarts 10 s after a crash |

`MemoryDenyWriteExecute` is deliberately not set: Java's compiler (JIT) needs writable and executable memory. In the systemd job on
GitHub Actions (one validator, generated key) the node ran as the `besu` user, produced 6 blocks in 12 seconds, both listening
sockets were on `127.0.0.1`, and the `systemd-analyze security` score was **1.5 OK** (0 is the strictest, 10 the most exposed).

### C4. Firewall

| Port | Open to |
|---|---|
| P2P (30303/TCP) | Only the other validators' IP addresses. Discovery is off, so UDP is not needed |
| JSON-RPC (8545) | Closed outside; the node listens only on `127.0.0.1` anyway. Outside clients only through the RPC proxy (§ RPC protection) |
| RPC proxy (8443/TCP, optional) | Only clients that were given a client certificate |

Example (ufw, on server 1):

```bash
sudo ufw default deny incoming
sudo ufw allow from 192.0.2.11 to any port 30303 proto tcp
sudo ufw allow from 192.0.2.12 to any port 30303 proto tcp
sudo ufw allow from 192.0.2.13 to any port 30303 proto tcp
```

Add the rule for your management access (SSH) **before** these. As an extra layer, the unit has `IPAddressDeny=any` and
`IPAddressAllow=localhost <peer addresses>` lines ready, as comments.

### C5. Contracts and Governance with the generated keys

With `--keys generate`, `make-network.sh` also writes a **key map** next to the node keys: `keys/keys.json`, and for every role a
freshly generated key in its own file (mode `0600`): the deployer, the migration executor, two list anchorers and one delegate per
state; a state's validator key is its node key. The chain id is **31339**: the repository's tools treat it neither as a local chain
(no public test key, no sandbox set) nor as the real network.

::: warning Test and staging networks only
On the real network nobody holds every key: each state generates its validator key on its own hardware and keeps its signing keys
in an HSM ([[GUIDE-0015]] §3). The key map exists because on a test network one person plays every state. Every tool that reads it
refuses it unless `purpose` is `test`, the chain id is 31339 and every key file is `0600` and belongs to its address.
:::

On the machine that ran `make-network.sh` (one node per server: server 1, which still holds the whole output):

```bash
sudo env "PATH=$PATH" TESTNET_DIR=/var/lib/tamga-besu TESTNET_MODE=systemd \
     bash network/testnet/bootstrap-governance.sh --nodes 1
```

With all nodes on one machine, without `--nodes`; in process mode without `sudo` and the `TESTNET_*` variables:

```bash
bash network/testnet/make-network.sh --keys generate
bash network/testnet/node.sh start all
bash network/testnet/bootstrap-governance.sh
```

The script, step by step; every step is logged and a re-run skips what is already done:

| Step | What happens |
|---|---|
| 1. Network | The nodes answer, blocks grow, the QBFT set has 4 validators. A chain id other than 31339 is refused |
| 2. Contracts | `contracts/scripts/deploy-network.ts` (Hardhat network `besuStaging`): founders TR and KZ with their delegates; recognition between the founders by a Governance vote (`proposeFounderRecognition`, [[ADR-0055]] K3); the list anchor registry administered by the Governance contract, 2 anchorers, threshold 2. Addresses: `deployment.json` |
| 3. Governance | XA and XB admitted by 2/3 vote; each state sets its delegate with its own validator |
| 4. Permission list | Rendered from the chain on every node, loaded and checked; `shared_sha256` equal; the deployer drops out of the list; a random unlisted key is refused, a delegate's transaction is mined |
| 5. Anchoring | `trust:chain-submit` with the first anchorer, the second confirms; `trust:chain-check` answers YES for every list |
| 6. Replay | The migration window is opened by vote; the permission list is rendered again and now contains the window's executor; the sample archive is replayed with the key map; equivalence test. `--no-replay` skips this step |
| 7. Summary | `bootstrap-summary.md` and `.json` in the network directory |

Then on every other server, the permission list of its own node. Copy `deployment.json` and the `nodes/` folder from server 1
first; no key is needed:

```bash
sudo env "PATH=$PATH" TESTNET_DIR=/var/lib/tamga-besu TESTNET_MODE=systemd \
     bash network/testnet/bootstrap-governance.sh --only permissions --nodes 2
```

| Variable | What |
|---|---|
| `TAMGA_CHAIN_KEYS` | The key map (default: `keys/keys.json` in the network directory) |
| `TAMGA_CHAIN_DEPLOYMENT` | The deployment file (the script sets it: `deployment.json` in the network directory) |

The `staging` job on GitHub runs these steps from scratch with 4 validators under systemd (§ Automated test on GitHub).

## Deploying the contracts

The contracts are deployed once, to any validator of the network; the blocks spread to all nodes.

```bash
npm run chain:besu:deploy                                          # paths A and B: to 127.0.0.1:8546
TAMGA_BESU_RPC=http://127.0.0.1:8547 npm run chain:besu:deploy     # to another node
```

The deploy script (`contracts/scripts/deploy-dev.ts`) sets up Tamga's contracts, writes two founding states to Governance (TR and
KZ; validators Hardhat accounts #1 and #2, delegates #3 and #4) and saves the addresses to `contracts/deployments/besuDev.json`. The
list anchor registry's address is in this file's `anchor.registry` field. Besu processes a transaction only in the next block
(2 s); the script waits for the block at every step.

In path C the contracts are deployed with the generated keys by `contracts/scripts/deploy-network.ts`
(`bootstrap-governance.sh` step 2, § C5); the Hardhat test accounts are not used there.

The contracts' source code, tests and specification are in the repository (`contracts/`, Hardhat; Solidity).

## Rendering and applying the permission list from the chain

The permission list is **not written by hand** ([[ADR-0052]] LP2): every operator renders it from the contract state on the chain,
with the same tool. So all validators have the same list, and the only way to add an account to it is a governance transaction on
the chain.

| List | Source |
|---|---|
| Accounts | Validator addresses and delegates of the active members in Governance, delegates of operational institutions, list anchorers, the executor of an open migration window |
| Nodes | Nodes whose declaration (`declarations/…json`) matches an active validator address in Governance |

**All validators must be in Governance first.** The local deployment sets up only TR and KZ; if the list is rendered from the chain
while the validators of XA and XB (nodes 3 and 4) are not in Governance, those two nodes drop off the list, and with 2 of 4
validators cut off the chain stops. In path B, admit the two states first (propose → votes → execute; test network only, with the
test keys):

```bash
DEP=contracts/deployments/besuDev.json
node network/testnet/testnet.mjs admit --rpc http://127.0.0.1:8546 --deployment $DEP --state XA --validator-index 6 --voters 1,2
node network/testnet/testnet.mjs admit --rpc http://127.0.0.1:8546 --deployment $DEP --state XB --validator-index 7 --voters 1,2,6
mkdir -p network/testnet/run/nodes
cp network/testnet/run/declarations/{tr-node1,kz-node2,xa-node3,xb-node4}.json network/testnet/run/nodes/
```

Then on every node: render → copy → load → check.

```bash
for n in 1 2 3 4; do
  d=network/testnet/run/node$n; url=http://127.0.0.1:$((8545 + n))
  TAMGA_CHAIN_RPC_URL=$url npm run -s trust:chain-permissions -- render --nodes network/testnet/run/nodes \
    --deployment $DEP --out $d/permissions_config.rendered.toml
  cp $d/permissions_config.rendered.toml $d/permissions_config.toml
  curl -s -H 'content-type: application/json' \
    --data '{"jsonrpc":"2.0","id":1,"method":"perm_reloadPermissionsFromFile","params":[]}' $url
  npm run -s trust:chain-permissions -- check --file $d/permissions_config.rendered.toml --node-rpc $url
done
```

- `render` reads from each node's **own** JSON-RPC and prints a report: block, account and node counts, `sha256` (the file's
  digest) and `shared_sha256` (the digest without the operator's own read nodes). **`shared_sha256` must be the same on all
  validators** (LP3). If a node is not yet in sync it renders at an old block and the digest differs: wait for it to sync first.
- `perm_reloadPermissionsFromFile` makes the node re-read the file; the node is not restarted.
- Besu rewrites the file in its own format when it loads it (comments are lost). So the rendering stays in
  `permissions_config.rendered.toml`, and `check` compares the file with the list in the node's memory **by meaning**.
- Exit code 3: a declaration was refused (the address derived from its public key is not the validator address in Governance) or
  `check` found a difference.

To see account permissioning work:

```bash
node network/testnet/testnet.mjs accounts --rpc http://127.0.0.1:8546   # #9 refused, #3 mined
```

In path A, `besu-dev.ps1 -Apply -Permissioned` does all of these steps.

## Anchoring the lists on the chain

Writing the digest of the chainless system's signed lists (`lotl.jws`, `tl-<cc>.jws`) and of the anchor log to the list anchor
registry on the chain. On the test network what is anchored are the **local** lists made by `npm run setup`
(`apps/trust-publisher/dist/`); the live system's lists are not touched.

```bash
export TAMGA_CHAIN_ENABLED=1
export TAMGA_CHAIN_RPC_URL=http://127.0.0.1:8546
export TAMGA_CHAIN_ANCHOR_REGISTRY=$(jq -r .anchor.registry contracts/deployments/besuDev.json)
# Hardhat test account #0 — a publicly known test key, test network only
export TAMGA_CHAIN_ANCHORER_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
npm run trust:chain-submit -- --dry-run                                  # prints the plan, writes nothing
npm run trust:chain-submit                                               # writes the digests
npm run trust:chain-check -- apps/trust-publisher/dist/lotl.jws          # YES / NO / UNKNOWN
npm run trust:chain-check -- apps/trust-publisher/dist/tl-tr.jws
```

In PowerShell (path A) the same variables are set as `$env:TAMGA_CHAIN_ENABLED = "1"`; the registry address:
`(Get-Content contracts\deployments\besuDev.json -Raw | ConvertFrom-Json).anchor.registry`.

| Variable | What |
|---|---|
| `TAMGA_CHAIN_ENABLED` | Without `1` nothing connects to the chain and nothing is written (default `0`, also `0` on the live system) |
| `TAMGA_CHAIN_RPC_URL` | The node's JSON-RPC address |
| `TAMGA_CHAIN_ANCHOR_REGISTRY` | The list anchor registry's address |
| `TAMGA_CHAIN_ANCHORER_KEY` | The anchorer key (`chain-submit` only) |

- An unhealthy set (broken signature or version chain) is not anchored.
- The same version with the same digest is not written twice (`SKIP`); a different digest gives `CONFLICT`, is not written, and the
  command ends with an error code.
- `chain-check` answers: **YES** (the digest is confirmed on the chain), **NO** (a different digest is confirmed on the chain: a
  sign of equivocation), **UNKNOWN** (chain off, unreachable or threshold not met). This check never makes a verification result
  worse.
- In paths A and B the anchorer threshold is 1, in path C 2 (two anchorers); on the real network an anchor is not confirmed until at least 2 independent
  anchorers send the same digest ([[ADR-0051]] CH3).

Institutions' status list anchors also enter the list record on the chain; for that the anchor line carries the list's bit count
and size (`trust:anchor --token <token file>`, [[SPEC-TRUST-0001]] §5).

With the flag on, registration certificate status list and list view lines (`registration_status`, `list_view`) are also
written to the anchor log. On the test network this is fine; on the real network the chain is opened only once every consumer
that reads the list runs a loader of at least `@tamga-network/trust` **0.8.1** — an older loader stops on an unknown line type
(2026-11-05).

## Replaying the history and the equivalence test

When the chain opens one day, the whole history of the signed lists is replayed into the contracts once, with the dates in the
lists (`trust:chain-replay`, [[ADR-0073]]); at the end the equivalence test runs. The script that tries this on the test network
with a sample archive:

```bash
npx tsx apps/chain-indexer/scripts/besu-smoke.ts http://127.0.0.1:8546
```

The script makes a sample list archive by the chain's clock, writes it to a temporary directory and runs `trust:chain-replay` with
it: it verifies the archive (signatures, version chain, anchor chain), makes a deterministic replay plan and its digest, opens the
migration window on the local chain by Governance vote, writes the operations, indexes the chain and runs the equivalence test. In
the test the same questions are asked of the list and of the chain — was this institution valid at that date, could it issue this
credential type, does this country recognise that institution, what is the digest of this list version — for every recorded moment
and every boundary moment (one second before, exactly then, one second after).

| Exit code | Meaning |
|---|---|
| 0 | Equivalent |
| 2 | Gate or configuration missing |
| 3 | Equivalence difference: the migration does not close |
| 4 | Waiting for a Governance vote |

Measured result (path B, GitHub Actions): 111 operations written in 616 seconds; 557 questions asked, **0 decision differences**. To
see the plan without connecting to the chain at all: `npm run trust:chain-replay -- --dry-run`.

In path B run the replay **before** the permission list is rendered from the chain: the local replay signs Governance votes with the
founders' test keys, and `deploy-and-wire.sh` follows the same order.

::: warning The migration window closes by itself
When its time is up the window closes **regardless** of the equivalence test result and can never be opened again ([[ADR-0073]]
K1). If the replay is unfinished or the test found a difference, nothing can be corrected in a closed mode: the contracts are
**redeployed** and the replay starts over. So keep the window short (time the replay on a trial chain first), run the equivalence
test before the deadline, and once it passes without a difference **close the window early** with a Governance proposal
(`proposeMigrationClose`) instead of waiting.
:::

## Adding and removing validators

The validator set changes by QBFT vote. The order matters:

1. **Governance:** the state is admitted as a member (with its validator address, 2/3 vote).
2. **Permission list:** rendered again on every node; the new node enters the list.
3. **Sync:** the new node starts as a full node, peers and catches up to the latest block (`eth_syncing` = `false`).
4. **QBFT vote:** more than half of the current validators call `qbft_proposeValidatorVote(<address>, true)` **on their own node**.
   The votes go into blocks; once the majority is reached, the set changes.
5. **Clearing the vote:** once the set has changed, every voter calls `qbft_discardValidatorVote(<address>)` (no pending vote left).

A small helper (bash):

```bash
rpc() { curl -s -H 'content-type: application/json' \
  --data "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"$2\",\"params\":${3:-[]}}" "$1" | jq -c .result; }
```

Adding node 5 (XC, address `0x23618e81e3f5cdf7f54c3d65f7fbc0abf5b21e8f`) in path B:

```bash
X=0x23618e81e3f5cdf7f54c3d65f7fbc0abf5b21e8f
node network/testnet/testnet.mjs admit --rpc http://127.0.0.1:8546 --deployment $DEP --state XC --validator-index 8 --voters 1,2,6,7
cp network/testnet/run/declarations/xc-node5.json network/testnet/run/nodes/
# the new node's first file, through node 1 (its own node is not in sync yet)
TAMGA_CHAIN_RPC_URL=http://127.0.0.1:8546 npm run -s trust:chain-permissions -- render --nodes network/testnet/run/nodes \
  --deployment $DEP --out network/testnet/run/node5/permissions_config.toml
# render and load the permission list again on nodes 1–4 (the loop in the previous section), then:
bash network/testnet/node.sh start 5
rpc http://127.0.0.1:8550 eth_syncing                                   # wait until false
# once node 5 is in sync, render the permission list again on all 5 nodes (loop with n = 1…5)
for n in 1 2 3; do rpc http://127.0.0.1:$((8545 + n)) qbft_proposeValidatorVote "[\"$X\",true]"; done
rpc http://127.0.0.1:8546 qbft_getValidatorsByBlockNumber '["latest"]'  # once there are 5 addresses:
for n in 1 2 3; do rpc http://127.0.0.1:$((8545 + n)) qbft_discardValidatorVote "[\"$X\"]"; done
rpc http://127.0.0.1:8546 qbft_getSignerMetrics                          # blocks proposed by node 5
```

Removing: with 5 validators ⌊5/2⌋ + 1 = 3 votes, this time with `false`; once the set is back to 4, the votes are cleared and the node
is stopped.

```bash
for n in 1 2 3; do rpc http://127.0.0.1:$((8545 + n)) qbft_proposeValidatorVote "[\"$X\",false]"; done
rpc http://127.0.0.1:8546 qbft_getValidatorsByBlockNumber '["latest"]'  # once there are 4 addresses:
for n in 1 2 3; do rpc http://127.0.0.1:$((8545 + n)) qbft_discardValidatorVote "[\"$X\"]"; done
bash network/testnet/node.sh stop 5
```

Measured result: the addition completed with 3 of 4 votes in 9 seconds and node 5 proposed a block; the removal completed with 3 of
5 votes in 10 seconds. The set must be the same on every node. In path A the same is done with `besu-permissions-smoke.ts vote-add`
and `vote-remove`; in path C each server votes on its own `127.0.0.1:8545`. The steps on the real network, with a table:
[[GUIDE-0015]] §6 and §10.

## Fault test

See for yourself that the 4-validator network tolerates one fault (path B):

```bash
bash network/testnet/node.sh stop 4
bash network/testnet/node.sh status all     # a few times: the block number keeps growing (3 validators are enough)
bash network/testnet/node.sh stop 3
bash network/testnet/node.sh status all     # the block number stops (2 validators are not enough)
bash network/testnet/node.sh start 3 && bash network/testnet/node.sh start 4
bash network/testnet/node.sh status all     # blocks flow again; the stopped nodes fetch the missing blocks
```

Nothing is lost while blocks are stopped: the chain only does not advance. When enough validators are back, the QBFT round starts
again. Measured result: blocks resumed **66 seconds** after the two nodes were restarted (the wait comes from QBFT's round timeouts
growing one after another). A stopped validator's data is not deleted; when it starts it syncs from where it stopped.

## RPC protection

The node's JSON-RPC endpoint is never exposed to the internet ([[ADR-0052]] LP5). Programs that must read from outside (the list
publisher, the indexer, a verifier's read path) go only through a proxy with mutual TLS (mTLS: the client shows a certificate too)
and reach only the `eth_`, `net_`, `web3_` methods:

```text
client --TLS 1.3 + client certificate--> nginx :8443 --> method filter 127.0.0.1 --> Besu 127.0.0.1
```

The script that tries the whole layer on the test network:

```bash
bash network/testnet/rpc-proxy-check.sh --upstream http://127.0.0.1:8546     # without nginx: --no-nginx
```

| Check | Expected |
|---|---|
| `eth_blockNumber`, `eth_chainId`, `eth_getBlockByNumber`, `net_version`, `net_peerCount`, `web3_clientVersion` through the filter | 200 |
| `admin_*`, `perm_*`, `qbft_*`, `debug_*`, `txpool_*`, `eth_sendTransaction`, `eth_accounts`, `eth_sign`, `miner_start` through the filter | 403 |
| A batch with a single forbidden call | 403 (all of it) |
| nginx without a client certificate | 400 |
| nginx with TLS 1.2 | connection refused |
| The node's RPC port on the machine's external address | no answer |

The script runs the filter on `127.0.0.1:8555`, makes temporary local test certificates for nginx (`network/rpc-proxy/dev-certs/`,
not in the repository) and shuts both down when it is done. Measured result: 32 checks passed. To run the filter by hand:

```bash
TAMGA_RPC_FILTER_LISTEN=127.0.0.1:8555 TAMGA_RPC_FILTER_UPSTREAM=http://127.0.0.1:8546 node network/rpc-proxy/filter.mjs
```

The filter's default port is 8550; in path B that is node 5's RPC port, so the test network uses 8555. Examples of the nginx
configuration and the systemd unit for a real server: `network/rpc-proxy/` and [[GUIDE-0015]] §7.

## Monitoring

| What | How | Healthy |
|---|---|---|
| Block height | `rpc <url> eth_blockNumber` or `node.sh status all` | Grows every 2 seconds; at most 1–2 blocks apart between nodes |
| Sync | `rpc <url> eth_syncing` | `false` |
| Peer count | `rpc <url> net_peerCount` | validator count − 1 or more |
| Validator set | `rpc <url> qbft_getValidatorsByBlockNumber '["latest"]'` | The same on every node |
| Block proposals | `rpc <url> qbft_getSignerMetrics` | Each validator's proposed block count grows |
| Permission list | `trust:chain-permissions check` | Exit 0; `shared_sha256` the same on every validator |
| Listening addresses | `ss -ltnp` | JSON-RPC only on `127.0.0.1`; P2P only on the expected interface |
| Anchor status | The `chain` field of the verification service's `/healthz` answer | `anchored`: `YES` |

**The `/healthz` `chain` field.** The verification service (`apps/verify`) shows on its health page whether the lists it has loaded
are confirmed as anchored on the chain. While the flag is off (as on the live system today) the answer is `UNKNOWN` and nothing
connects to the chain. To try it on the test network, start the service with the variables from the anchoring section (no anchorer
key needed):

```bash
TAMGA_CHAIN_ENABLED=1 TAMGA_CHAIN_RPC_URL=http://127.0.0.1:8546 \
  TAMGA_CHAIN_ANCHOR_REGISTRY=$(jq -r .anchor.registry contracts/deployments/besuDev.json) npm run verify
curl -s http://localhost:4004/healthz | jq .chain     # enabled, anchored (YES/NO/UNKNOWN), reason, lists[]
```

This field is informational: it never changes a verification result or the `ok` field; `NO` is only an alarm ([[ADR-0051]] CH1).

The real network's list of checks for a joining node (sync, permission list, set, RPC, clock): [[GUIDE-0015]] §8; the onboarding tool
`tamga-onboard node check` runs the same checks read-only.

## Reset and clean-up

| What | Path A | Path B | Path C |
|---|---|---|---|
| Stop | `npm run chain:besu:stop` · permissioned: `-Stop -Permissioned` | `node.sh stop all` | `sudo systemctl stop besu@node<n>` |
| Delete the chain data (settings stay) | `npm run chain:besu:reset` · permissioned: `-Reset -Permissioned` (permissions files go too) | stop the nodes, then `rm -rf network/testnet/run/node*/db` | stop, then delete `/var/lib/tamga-besu/node<n>/db` |
| Rewrite the network (keys and genesis included) | delete `network/dev/`, then `chain:besu:init` | `make-network.sh --force` | `make-network.sh --force` with the same `--dir` |
| Remove everything | delete `network/dev/`, `tools/jdk-25`, `tools/besu-*` | delete `network/testnet/run/`, `tools/` | `systemctl disable besu@node<n>`, the unit, `/opt/tamga-besu`, `/var/lib/tamga-besu`, the `besu` user |

After the chain data is deleted, deploy the contracts again: `contracts/deployments/besuDev.json` is overwritten by the new
deployment. Downloaded archives stay in `tools/_dl/`; they are not downloaded again on a reinstall.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Besu does not start; a Java version error in the log | An older JDK is used (the generic `JAVA_HOME` points to JDK 17) | JDK 25: the scripts use `TESTNET_JAVA_HOME` (default `tools/jdk-25`); pass another JDK 25 with `--java-home` |
| The node also listens on an external address | `p2p-interface` not set; Besu's default is `0.0.0.0`. `p2p-host` is only the advertised address | Put `p2p-interface` in `besu.toml`; check with `ss -ltnp` |
| The permission list differs between nodes (`shared_sha256` differs) | The node rendered before it was in sync (old block), or one did not load it | Wait until `eth_syncing` is `false` and render again; between operators compare with the same `--block` |
| The chain stopped after the permission list was rendered | Some validators are not in Governance; they dropped off the list | Admit all validators' states to Governance first, then render (§ Permission list) |
| "Sender account not authorized to send transactions" | The account is not on the permission list | May be the correct behaviour; otherwise render and load the permission list again |
| No peers; "Bootnode(s) not in nodes-allowlist" | Something is missing from the node list | Declaration + `render` + load; a static peer reconnects in about 1 minute |
| `render` exit 3 | The public key in the declaration does not match the validator address in Governance | Compare the declaration with the Governance entry |
| `node.sh start`: port in use | An earlier node, or the Windows local network, on the same port | `node.sh status all`; stop the leftover process |
| Windows: `chain:besu:stop` does not stop the node | `besu.bat` is a `cmd.exe`; the actual process is its `java.exe` child | The script writes the `java.exe` process id to `besu.pid` and stops that; for leftovers `Get-Process java` |
| Windows: the genesis or TOML is not read | The file was written with a BOM (an invisible mark at the start); PowerShell 5.1's `Set-Content`/`Out-File` do this | UTF-8 without BOM and LF line endings; the scripts write that way |
| Windows: `besu` from Git Bash gives "Argument list too long" | A Windows script started from bash | `besu.bat` from PowerShell (the script does this) |
| ethers "could not coalesce error" | The node's actual error text is nested | The actual text is in `error.error.message` |

## Automated test on GitHub

The repository's `testnet` workflow (`.github/workflows/testnet.yml`) sets up and tests path B and path C's systemd layout from
scratch every time, on a clean Ubuntu 24.04 machine.

| Job | What it does |
|---|---|
| `lint` | Checks all scripts with `bash -n` and `shellcheck` |
| `network` | Installs JDK 25 + Besu, prepares the packages and signed lists, compiles the contracts, writes the 4-validator + 1-extra-node network and runs `deploy-and-wire.sh` (nginx required). Node logs, permissions files and reports are kept for 14 days |
| `systemd` | The `--system` installation, one validator with a generated key, `systemd-analyze verify`, the node running as the `besu` user, block growth, listening only on `127.0.0.1` and the `systemd-analyze security` score |
| `staging` | Path C on one machine: the `--system` installation, 4 validators with generated keys under systemd (heap `-Xmx640m` through a unit drop-in), `bootstrap-governance.sh` end to end (§ C5), then a second run that must write nothing |

**When it runs:** every Monday (04:23 UTC); when `contracts/`, `apps/chain-indexer/`, `apps/trust-publisher/src/chain/`,
`network/testnet/`, `network/rpc-proxy/`, `network/permissions/` or the workflow itself changes; and by hand. To trigger it by hand,
on GitHub: repository → **Actions** → **testnet** → **Run workflow**; or with the GitHub command-line tool:

```bash
gh workflow run testnet.yml
gh run list --workflow testnet.yml          # recent runs
gh run view <run number> --log              # the whole log
```

**Where the summary is:** on the run's page, in the job summary: the `network` job's summary is the table given as "measured
result" in this guide (validator and peer counts, contracts, replay, equivalence, anchoring, permission list, votes, fault test, RPC
protection, resource use, duration); the `systemd` job's summary gives the unit's user, block growth, sockets and security score; the `staging` job's summary is the
table of `bootstrap-governance.sh` (contracts, Governance members, permission list, anchoring, migration window, replay and
equivalence) and the result of the second run.
The measurements in this guide are from the run of 2026-11-05.

## Shadow chain

Later, on a separate small test server, the live network's real signed lists may also be anchored to a test chain after every
publication (a "shadow chain"): the chainless system stays the source, the shadow chain only follows it and shows how the two modes
behave together over a long time. Today there is **no** such chain. Project management decided to proceed first with the automated
test on GitHub; the separate test server is set up once its purchase is decided. It is set up with path C's scripts.

## Rules

| Code | What it says |
|---|---|
| [[ADR-0009]] K4 | The shared ledger is not set up without the written acceptance of at least two independent operators; a test network is outside this rule because it is not production |
| [[ADR-0051]] CH1, CH5 | The chain is a projection of the list; on a conflict the list prevails. While the flag is off nothing connects to the chain |
| [[ADR-0052]] LP1–LP5 | Local permissioning; the list is rendered from the chain, never written by hand; the same on all validators; authority is in the contracts; RPC is not exposed to the internet |
| [[ADR-0073]] | The history is replayed once; the migration does not close while an accept/reject difference remains in the equivalence test |
| [[ADR-0074]] K7 | Sandbox lists are not written to the production chain |

Concept: [Shared ledger (chain)](/concepts/ledger). Steps on the real network: [[GUIDE-0015]]. The two modes: [[GUIDE-0016]]. Running
the national list while the chain is on: [[GUIDE-0017]] §8.
