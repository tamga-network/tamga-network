---
document_id: GUIDE-0015
title: "Node operator handbook"
status: Active
version: 1.0.0
created: 2026-11-05
last_updated: 2026-11-05
summary: >
  A preparation handbook for state and operator IT teams that will later run a validator or full node on Tamga's shared ledger
  (Hyperledger Besu, QBFT): the role of the chain, prerequisites, hardware and operating system, JDK 25 and Besu, the node key,
  permissioned mode and the allowlist generated from the chain, the node declaration (tamga-node-declaration/1), joining as a
  validator (Governance admission and QBFT vote), RPC protection (mTLS and method filter), monitoring and health checks, backup
  and key hygiene, exit and handover. The chain is switched off in production today.
translation_of: GUIDE-0015
source_version: 1.0.0
---

# Node operator handbook

This handbook is for IT teams that will later run nodes on Tamga's [[t:ledger|shared ledger]]: member states'
[[t:validator]] nodes and full nodes that read the chain.

::: danger The chain is switched off in production today
Trust in Tamga rests today on signed [[t:trust-list|trust lists]]; there is **no** production chain ([[ADR-0009]] K4,
[[ADR-0051]]). This handbook is for **preparation**: it lets you try the setup on local and test networks and plan your own
infrastructure. The chain opens only when these prerequisites are met:

- at least **two independent operators** accept in writing to run validators (a chain run by one operator gives no more trust
  than a list signed by one operator);
- the cryptographic and operational design has passed an **independent security audit**.

Where a state is named or its code appears in this document, a place is reserved for it; this is not a statement of an agreement
or of talks.
:::

**When to read it:**
- If your institution is considering running a validator or full node, before planning infrastructure.
- First: the [Shared ledger (chain)](/concepts/ledger) concept and [[GUIDE-0006]] §5 (what the chain means for applications).
- The detailed setup flow and tools are in the public repository: `network/` (allowlist, node declarations, RPC protection) and
  `docs/ledger/` (Besu network architecture, contract specification).
- The tool for the steps on the institution's side (key, configuration template, declaration, checks): `tamga-onboard node`
  (§3, §4, §5, §8). Install: `npm install -g @tamga-network/onboard` (or `npx -p @tamga-network/onboard tamga-onboard …`);
  details and running from source in [[GUIDE-0014]] § Installing.

## The role of the chain

The chain is a **projection** of the signed lists and the anchor log, not their source: in a conflict the list wins
([[ADR-0051]]). It adds two things: a list version's digest is confirmed only when a threshold of independent operators submit
the same digest (independent witnessing), and membership, shared credential types and upgrades are decided by a 2/3 vote of the
states (governance in code). No personal data, credential or credential digest is written to the chain; status lists stay off
the chain ([[ADR-0008]]). The sandbox is never written to the chain ([[ADR-0074]] K7).

| Role | What it does | Who |
|---|---|---|
| Validator | proposes and signs blocks; votes in governance | one validator per member state; key in an HSM |
| Full node | validates and reads the chain; does not sign | an operator's own read node (list publisher, indexer, verifier read path) |

Consensus is QBFT: with n validators it tolerates at most f = ⌊(n−1)/3⌋ faults. The target is at least 4 validators (f = 1).

## 1. Hardware and operating system

The exact sizing is measured and published when the chain opens. A starting point for planning:

| | Suggestion |
|---|---|
| Server | a dedicated (virtual or physical) Linux server, LTS distribution; a validator carries no other workload |
| CPU / memory | 4 cores, 8–16 GB memory |
| Disk | SSD, from 200 GB; growth is monitored |
| Network | a fixed IPv4 or IPv6 address (the allowlist takes addresses, not domain names); P2P port (default 30303) open only to peers in the allowlist |
| Time | NTP-synchronised (block timestamps; drift must not exceed 5 seconds) |
| Key | an HSM or an equivalent vault (for a validator) |
| Access | administration only from the institution's management network; with keys, not passwords |

Docker is not needed: Besu is a single JVM process and runs directly as a service (systemd). Using a container is the operator's
own choice.

## 2. JDK 25 and Besu

- **Java 25** (Eclipse Temurin 25 recommended); Besu 26.6 and later require Java 25.
- **Hyperledger Besu** 26.x (local trials used 26.11.0). Besu 25.6.0 removed on-chain permissioning and Tessera privacy; Tamga
  uses neither ([[ADR-0052]]).

```bash
# Compare the downloaded archives' sha256 with the value on the release page, then unpack
sha256sum besu-26.11.0.tar.gz
tar -xzf besu-26.11.0.tar.gz -C /opt && ln -s /opt/besu-26.11.0 /opt/besu
export JAVA_HOME=/opt/jdk-25
/opt/besu/bin/besu --version
```

Run Besu as a separate, unprivileged system user; the data folder (for example `/var/lib/besu`) is open to that user only.

## 3. The node key

Every node has a secp256k1 key. **On a validator, this key's address is the QBFT validator address** and must be the same as the
validator address given to Governance.

```bash
# Besu generates the key if it does not exist; export the public key and the address
/opt/besu/bin/besu --node-private-key-file=/var/lib/besu/key public-key export --to=/var/lib/besu/key.pub
/opt/besu/bin/besu --node-private-key-file=/var/lib/besu/key public-key export-address --to=/var/lib/besu/address
chmod 600 /var/lib/besu/key
```

- Generate the key **on your own hardware**; never send it to anyone. Only the public key (in the declaration) and the address
  (in Governance) are shared.
- For a validator key an HSM or equivalent vault is preferred.
- The keys of the local trial networks are publicly known test keys; never use them on a real node.

### With the tool: `tamga-onboard node init`

The joining tool does the same job; run it **on the node's own machine**:

```bash
tamga-onboard node init --state TR --role validator --ip 192.0.2.10 --interface 10.0.0.10 --out /var/lib/besu
```

| Written | What |
|---|---|
| `key` | the private key (Besu key file format); readable by the owner only, never overwritten |
| `key.pub`, `node.json` | the public key; state code, role, address, interface and ports (read by the declaration and the checks) |
| `besu.toml` | a configuration template following the rules in §4 |

The command prints the enode public key and the validator address (the address to be given to Governance). A folder synced with
OneDrive, Dropbox, Google Drive or iCloud is refused (`--allow-synced` to accept it knowingly); if even one of these files already
exists in the folder, none is written. If the key is in an HSM, `node init` is not used: take the public key from the HSM and
declare it with `node declare --public-key …` (§5). Through an AI assistant the same step is the MCP tool `generate_node_key`; the
private key is never returned in any response and over MCP it is never written to a synced folder.

## 4. Permissioned mode

Which nodes may connect and which accounts may send transactions is decided by the local `permissions_config.toml` on every node
(two lists: `nodes-allowlist`, `accounts-allowlist`). An example `besu.toml` (placeholders `<…>`):

```toml
data-path = "/var/lib/besu/data"
genesis-file = "/etc/besu/genesis.json"          # the network's genesis, published by the operators when the chain opens
node-private-key-file = "/var/lib/besu/key"

p2p-host = "<advertised address>"                # only the advertised address
p2p-interface = "<P2P interface>"                # the interface listened on
p2p-port = 30303
discovery-enabled = false
static-nodes-file = "/etc/besu/static-nodes.json"

permissions-nodes-config-file-enabled = true
permissions-accounts-config-file-enabled = true
permissions-nodes-config-file = "/var/lib/besu/permissions_config.toml"
permissions-accounts-config-file = "/var/lib/besu/permissions_config.toml"

rpc-http-enabled = true
rpc-http-host = "127.0.0.1"                      # from the node itself only
rpc-http-port = 8545
rpc-http-api = ["ETH", "NET", "WEB3", "QBFT", "PERM", "ADMIN"]
host-allowlist = ["localhost", "127.0.0.1"]
```

The `besu.toml` written by `tamga-onboard node init` carries these settings and fixes the following: JSON-RPC only on `127.0.0.1`
(`QBFT`, `PERM`, `ADMIN` for the node's own use; outside only through the proxy in §7), P2P listens only on the internal interface
given with `--interface` and advertises `--ip` (`0.0.0.0` and `::` are refused; without `--interface`, `--ip` is used), discovery
off, both permissioning flags on, WebSocket and GraphQL off.

::: warning Genesis is not generated by the tool
`genesis.json` is neither generated by `node init` nor downloaded by the tool. It comes from the network's operators over the
channel named in the joining correspondence; compare its `sha256` digest **with at least two different operators over another
channel**. If the digest is not the same, do not start the node. Once the node runs, `node check --chain-rpc` also compares the
genesis block (§8, N3). `static-nodes.json` is likewise written with the validator enodes the operators give you.
:::

**The allowlist is never written by hand** (LP2). Each operator generates it from the contract state on the chain, with the tool in
the public repository:

```bash
TAMGA_CHAIN_RPC_URL=http://127.0.0.1:8545 npm run trust:chain-permissions -- render \
  --out /var/lib/besu/permissions_config.rendered.toml [--operator <CC>] [--block <n>]
cp /var/lib/besu/permissions_config.rendered.toml /var/lib/besu/permissions_config.toml
curl -s -X POST -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"perm_reloadPermissionsFromFile","params":[]}' http://127.0.0.1:8545
npm run trust:chain-permissions -- check --file /var/lib/besu/permissions_config.rendered.toml --node-rpc http://127.0.0.1:8545
```

| List | Source |
|---|---|
| Accounts | active members' validator addresses and delegate keys (Governance), delegates of operational issuers, list anchorers, the executor of an open migration window |
| Nodes | validator nodes whose declaration matches an active validator address in Governance; with `--operator`, the operator's own read nodes |

- `render` prints two digests: `sha256` (the file) and `shared_sha256` (without the operator's own read nodes). **All validators
  must have the same `shared_sha256`** (LP3); a difference is an operational incident, and the lists are rendered again at the same
  block (`--block`) and compared.
- Besu rewrites the file in its own format when reloading it (comments are lost). So the rendering is kept in a separate file and
  the check is semantic (`check`); the digest of the file on disk is not compared with the rendering's digest.
- The list is regenerated after every Governance decision (admitting or removing a member, an anchorer change), a delegate
  change, a change in an issuer's status, the opening or closing of a migration window, and a new node declaration.
- The allowlist is a second line of defence; write authority is enforced in the contracts (LP4).

## 5. The node declaration

Each node is introduced by a JSON declaration (format `tamga-node-declaration/1`; schema in the repository at
`network/permissions/schema/node-declaration.schema.json`, examples in `network/permissions/examples/`):

```json
{
  "format": "tamga-node-declaration/1",
  "state": "TR",
  "role": "validator",
  "node_public_key": "<128 lower-case hex characters; no 04 or 0x prefix>",
  "ip": "192.0.2.10",
  "p2p_port": 30303,
  "contact": "noc@example.org"
}
```

| Field | Rule |
|---|---|
| `state` | Governance member code |
| `role` | `validator` (enters every operator's list) or `rpc` (only the declaring operator's own list) |
| `node_public_key` | the `public-key export` output (§3), without prefix |
| `ip`, `p2p_port` | address and P2P port; not a domain name |
| `contact` | the institution's operations mailbox or page — **no personal names** |

The joining tool also writes the declaration (from the `node init` folder):

```bash
tamga-onboard node declare /var/lib/besu --contact noc@example.org     # → tr-validator.json; send it to the operator
```

The contact is the institution's role mailbox or https page; an address that does not look like a role address gets a warning.
Without a node folder (key in an HSM) give `--public-key --state --role --ip --p2p-port` together. The file is never overwritten.
MCP tool: `create_node_declaration`. The private key is never sent.

A `validator` declaration enters the list only if `state` is an active member and the address derived from the public key is that
member's validator address in Governance; otherwise `render` rejects it (exit 3). Two declarations with the same key, or a second
validator for the same state, are rejected. A wrong address or port only breaks connectivity; a declaration grants no authority.
Declarations are not written to the chain; they are kept in the repository under `network/permissions/nodes/`.

## 6. Joining as a validator

The order matters; each step waits for the previous one to finish.

| # | Step | Who | How |
|---|---|---|---|
| 1 | Membership | existing members | the state's admission proposal in Governance (`proposeStateAdmission`, with the validator address) and a 2/3 vote |
| 2 | Delegate keys | new member | the state's delegate keys are written to Governance (`setDelegateKeys`) |
| 3 | Declaration | new member | the §5 declaration is added to the repository |
| 4 | Allowlist | every operator | `render` → load → `check`; `shared_sha256` the same on all validators |
| 5 | Sync | new member | the node peers as a full node and catches up (`eth_syncing` = `false`) |
| 6 | QBFT vote | every existing validator | on its own node, from `127.0.0.1` only: `qbft_proposeValidatorVote("<address>", true)` |
| 7 | Clear the vote | every existing validator | once a majority (> 1/2) of votes is in a block and the set has changed: `qbft_discardValidatorVote("<address>")` |
| 8 | Check | everyone | §8 health check |

The set must be the same on every node: `qbft_getValidatorsByBlockNumber("latest")`. That the new validator proposes blocks is
seen with `qbft_getSignerMetrics`. This is a transfer of voting power, not a network outage: the set is updated while running. In
a two-validator network both must be online for consensus; that is why the target is at least 4 validators.

## 7. RPC protection

The node's JSON-RPC endpoint is not open to the internet (LP5). Outside clients (list publisher, indexer, verifier read path) pass
only through a reverse proxy with mutual TLS and reach only the `ETH`, `NET` and `WEB3` namespaces:

```text
client --TLS 1.3 + client certificate--> nginx :8443 --> method filter 127.0.0.1:8550 --> Besu 127.0.0.1:8545
```

| Part | What |
|---|---|
| nginx (`network/rpc-proxy/nginx.conf.example`) | TLS 1.3, `ssl_verify_client on` (the operator's own client certificate authority), `POST /` only, 256 KiB body limit, per-client rate limit, no access log |
| Method filter (`network/rpc-proxy/filter.mjs`) | Node 22, no dependencies; passes `eth_*`/`net_*`/`web3_*` (except signing, mining and subscription methods); refuses a whole batch if one call is refused; logs only refusal counts |
| systemd unit (`network/rpc-proxy/rpc-filter.service.example`) | the filter as an unprivileged user, loopback only |

`PERM`, `ADMIN`, `QBFT`, `DEBUG`, `TXPOOL` are used from the node itself only. Open the P2P port in the firewall only to the
addresses of peers in the allowlist. A test from outside: `admin_peers` → `403`, `eth_blockNumber` → `200`, no client
certificate → TLS refusal.

## 8. Monitoring and health

| Check | How | Passes when |
|---|---|---|
| In sync | `eth_blockNumber` on your node and a reference node; `eth_syncing` | difference ≤ 2 blocks, `eth_syncing` = `false` |
| Peers | `net_peerCount` | number of validators − 1 or more |
| Allowlist matches the chain | `trust:chain-permissions check` | exit 0; `shared_sha256` the same as on the other validators |
| Declaration matches | `rejected` and `missing_validator_nodes` in the `render` output | your node is in neither |
| In the validator set | `qbft_getValidatorsByBlockNumber("latest")` | your address is there; the set is the same on every node |
| Proposes blocks | `qbft_getSignerMetrics` | proposal count > 0, last proposal within the last 2n blocks |
| RPC on loopback only | `ss -ltnp` and `besu.toml` | 8545 only on `127.0.0.1`; P2P only on the expected interface |
| Only eth/net/web3 outside | through the proxy: `admin_peers`, `perm_getAccountsAllowlist`, `qbft_proposeValidatorVote`, `eth_sendTransaction` | all `403`; `eth_blockNumber` `200` |
| Time | last block timestamp against local time; `timedatectl` | drift ≤ 5 s, NTP-synchronised |

### With the tool: `tamga-onboard node check`

The joining tool checks your running node read-only; only read-only JSON-RPC methods are called (no vote, no allowlist reload,
no peer change, no transaction):

```bash
tamga-onboard node check /var/lib/besu --chain-rpc https://<an endpoint on the network>   --public-rpc https://<external endpoint> --permissions-file /var/lib/besu/permissions_config.rendered.toml --report report.json
```

| Code | Check | Needs |
|---|---|---|
| N1 | The node's local RPC endpoint answers | `--rpc` (default: the port in `besu.toml`, on `127.0.0.1`) |
| N2 | In sync: `eth_syncing` and the block difference to the reference endpoint | `--chain-rpc` (without it only `eth_syncing`) |
| N3 | Same chain: the genesis block equals the reference endpoint's | `--chain-rpc` |
| N4 | Peer count | — |
| N5 | The running key equals `node.json` and the declaration | node folder, `--declaration` |
| N6 | Node and account allowlists equal the rendered file and the reference endpoint | `--permissions-file`, `--chain-rpc` |
| N7 | Your address is in the validator set | validator role |
| N8 | The external endpoint refuses `admin_`, `perm_`, `qbft_`, `debug_`, `txpool_` and `eth_accounts` but answers `eth_blockNumber` and `net_version` | `--public-rpc` (mTLS with `--client-cert`, `--client-key`) |
| N9 | `besu.toml`: interfaces, namespaces, permissioning flags | node folder or `--config` |
| N10 | Clock: drift against the latest block timestamp | — |

Exit `0` all passed or warnings only, `1` a check failed; `--json` and `--report` give a JSON report.

**Address rules.** Addresses are only the ones you type; from files only the local RPC port in `besu.toml` is read. Loopback
(`127.0.0.1`) is allowed by default, because the admin endpoint is there by design. Other local and private networks (RFC 1918,
link-local / cloud metadata endpoint, CGNAT, ULA) need `--allow-private`, also after name resolution; plain http only to loopback
and private addresses; redirects are not followed. The MCP tool `check_node` reaches loopback and private addresses only if their
origin is listed in the server's `TAMGA_ONBOARD_PRIVATE_NODES` environment variable (comma-separated, e.g.
`http://127.0.0.1:8545`); public addresses only over https.

The declaration-match, block-proposal and voting checks in the table above need operator rights; they stay with the operator.

Besu metrics are enabled on the local interface only (`metrics-enabled = true`, `metrics-host = "127.0.0.1"`) and collected from
there by the institution's own monitoring (for example Prometheus). Run the service with automatic restart (systemd
`Restart=on-failure`) and alert when the block height stalls, the peer count drops or `check` finds a difference.

## 9. Backup and key hygiene

| Backed up | Not backed up |
|---|---|
| the node key (encrypted, offline, in a separate place) | chain data (it resyncs from the other nodes) |
| `besu.toml`, genesis, static peers, the declaration | the allowlist file (regenerated from the chain) |

- The key stays on the node with `600` permissions or in an HSM; it never goes into a repository, a chat, a log or a ticket.
- A key change means a new validator address: an address update in Governance, a new declaration, a new allowlist at every
  operator and a QBFT add / remove vote. The contract-level detail of this sequence is settled when the chain opens.
- If you suspect the key has been compromised, stop the node and tell the other operators at once; the address is removed from the
  set by vote.
- No personal data goes into the chain, the allowlist file or the declaration; the contact in the declaration is the institution's
  role address.

## 10. Exit and handover

**Handover** (for example from an operator's validator to the state's own validator): first the new validator is added with the
§6 steps, then the old one is removed. The set never drops below the threshold.

**Exit:**
1. The existing validators vote on their own nodes: `qbft_proposeValidatorVote("<address>", false)`; with n validators,
   ⌊n/2⌋ + 1 votes are needed. Once the set has changed, the pending vote is cleared with `qbft_discardValidatorVote`.
2. The member is removed in Governance (`proposeStateRemoval`, 2/3 vote).
3. Every operator regenerates its allowlist; once the node leaves the list, its peer connections drop at once.
4. The leaving operator securely destroys its node key and delegate keys; its declaration is removed from the repository.

The history on the chain is not deleted; a member that returns joins with a new admission proposal.

## Local trial

You can try the contracts, generating the allowlist from the chain and validator voting on your own computer. From the repository
root (Windows PowerShell):

```powershell
powershell -File scripts\besu-dev.ps1 -Init -Permissioned            # genesis, two keys, two node declarations
powershell -File scripts\besu-dev.ps1 -Start -Permissioned           # node 1 (RPC 8546)
npm run chain:besu:deploy                                            # contracts
powershell -File scripts\besu-dev.ps1 -Apply -Permissioned           # allowlist from the chain: render → load → check
powershell -File scripts\besu-dev.ps1 -Start -Permissioned -Node 2   # node 2 (RPC 8547); then -Apply again
npx tsx apps/trust-publisher/scripts/besu-permissions-smoke.ts vote-add      # node 2 into the validator set
npx tsx apps/trust-publisher/scripts/besu-permissions-smoke.ts vote-remove   # and out again
powershell -File scripts\besu-dev.ps1 -Stop -Permissioned
```

This network's keys are publicly known test keys and it runs on `127.0.0.1` only. The same settings by hand for Linux and macOS:
`docs/ledger/architecture/0002-besu-network-setup-step-by-step.md` in the repository. The RPC filter locally:
`TAMGA_RPC_FILTER_UPSTREAM=http://127.0.0.1:8546 node network/rpc-proxy/filter.mjs`.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "Sender account not authorized to send transactions" | the account is not in the allowlist | may be correct behaviour; otherwise regenerate and load the allowlist |
| No peers, "Bootnode(s) not in nodes-allowlist" | the node list is incomplete | declaration + `render` + load; a static peer reconnects in about a minute |
| `render` exits with 3 | a declaration was rejected or `check` found a difference | does the declaration's public key match the validator address in Governance |
| `shared_sha256` differs | operators rendered at different blocks, or one did not load | render again with the same `--block` and compare |
| The node listens on the wrong interface | `p2p-host` is only the advertised address | listening is set by `p2p-interface` |
| Genesis or TOML cannot be read (Windows) | the file was written with a BOM | UTF-8 without BOM, LF line endings |
| Besu does not start | Java version | JDK 25 and `JAVA_HOME` |

## Rules

| Code | What it says |
|---|---|
| [[ADR-0009]] K4 | The chain opens with the written acceptance of at least two independent operators |
| [[ADR-0051]] | The chain is a projection of the signed lists; in a conflict the list wins |
| [[ADR-0052]] LP1–LP5 | Local permissioning; the list is generated from the chain, never by hand; the same on all validators; authority in the contracts; RPC not open to the internet |
| [[ADR-0074]] K7 | The sandbox is not written to the chain |
| [[ADR-0008]] | Status lists stay off the chain |

Concept: [Shared ledger (chain)](/concepts/ledger). Rules: [Tamga ARF — Architecture](https://arf.tamga.network/architecture).
