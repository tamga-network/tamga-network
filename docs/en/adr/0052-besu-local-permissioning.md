---
document_id: ADR-0052
title: "Besu local permissioning"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-19
last_updated: 2026-10-19
summary: >
  Hyperledger Besu 25.6.0 removed onchain permissioning and Tessera-based privacy (both deprecated in 24.12). Once the chain is
  switched on, which nodes may connect and which accounts may send transactions is set by the local `permissions_config.toml` file
  (node and account allowlists) on every validator and RPC node. The lists are not written by hand: they are derived from the
  on-chain contract state (Governance, IssuerRegistry, TrustListAnchorRegistry); every operator renders and applies the file itself,
  all validators carry the same lists, and drift is checked (`trust:chain-permissions`). The actual write authorization stays in the
  contracts (namespace, delegates, writer threshold). A node's JSON-RPC endpoint is never exposed to the internet; external access
  goes through a reverse proxy with mTLS. Replaces the onchain permissioning contract assumption in SPEC-BC-0001 §12.1, ARCH-0001
  and ARCH-0002; no ADR decision changes. Accepted: 2026-10-19.
domain: Trust
related: ["[[ADR-0001]]", "[[ADR-0002]]", "[[ADR-0009]]", "[[ADR-0051]]", "[[SPEC-BC-0001]]", "[[ARCH-0001]]", "[[ARCH-0002]]", "[[PM-BC-0001]]", "[[PM-TRUST-0001]]"]
translation_of: ADR-0052
source_version: 1.0.0
---

# In short

The chain is a permissioned network: only approved nodes connect, only approved accounts send transactions. Our documents planned
to do this with Besu's onchain permissioning contract; Besu removed that feature in 25.6.0. This decision chooses Besu's remaining
path instead: the same permissions file on every node. Nobody writes the file by hand; it is rendered from the chain's own records,
so the single answer to "who is permitted" is still the on-chain governance.

# Context

- [[ADR-0001]] sets up the network as a **permissioned**, independent Besu/QBFT network; it does not choose the permissioning
  mechanism. The mechanism was only written in specification and architecture documents: [[SPEC-BC-0001]] §12.1 ("Account
  permission — Besu onchain permissioning — only registered delegate keys can send transactions"), [[ARCH-0001]] §6 ("node/account
  permissioning (allowlist contract)"), [[ARCH-0002]] §6 ("an on-chain permissioning contract is preferred"), its security note
  ("the permissioning contract's admin key must be multi-signature") and open point 3 ("proposal: on-chain, manageable"). No ADR
  binds it.
- Besu deprecated onchain permissioning and Tessera-based privacy in 24.12; **25.6.0 removed both** (release notes, "Sunset
  features"). The remaining mechanism is **local permissioning**: a `permissions_config.toml` in each node's data directory with
  `nodes-allowlist` (enode URLs) and `accounts-allowlist` (account addresses); enabled with `--permissions-nodes-config-file-enabled`
  and `--permissions-accounts-config-file-enabled`; updated at runtime with the `perm_*` JSON-RPC methods, or by editing the file and
  calling `perm_reloadPermissionsFromFile`.
- According to the Besu documentation, local account rules **are not enforced in blocks produced by other nodes**, and identical
  lists on all nodes are recommended but not enforced. If one validator's list differs, a block it produces may carry a transaction
  from an account the others would reject. Consistency is therefore the operators' job.
- There is no chain today ([[ADR-0009]] K4); the chain is a projection of the signed lists ([[ADR-0051]]). The decision makes the
  documents match the real Besu before phase 0 preparation. Privacy groups (Tessera) were never used in the design and are not
  needed: no personal data, credential or credential digest goes on the chain ([[PM-TRUST-0001]], [[SPEC-BC-0001]]/DP1).
- On 2026-10-19 project management gave the direction: the finding is applied to all documents and the old assumption is removed
  from the living documents.

# Decision

## K1 — Local permissioning

Every validator and every RPC/full node enables node and account permissioning with a local `permissions_config.toml` (both flags
on). No onchain permissioning contract is written or used. Tessera and privacy groups are not used (absent from Besu; not needed by
the design).

## K2 — Single source of truth: the chain's own state

The allowlists are not written by hand; they are derived from the on-chain contract state:

| List | Content | Source |
|---|---|---|
| Account | Validator addresses of active member states | `Governance` (admission, removal, withdrawal) |
| Account | Delegate keys of active member states | `Governance.delegateKeysOf` |
| Account | Delegate keys of operational institutions (status list anchor publishing) | `IssuerRegistry` |
| Account | Trust list anchor writers | `TrustListAnchorRegistry` ([[ADR-0051]] K3) |
| Node | Validator nodes: the address derived from the enode ID is an active validator address in `Governance` | `Governance` + the operator's node declaration (`host:port` only) |
| Node | An operator's own RPC/full nodes | Only in the file of that operator's nodes; not in other operators' lists |

- Adding or removing an account is the corresponding on-chain transaction (Governance vote, the state's own namespace, the writer
  set); the permissions file follows it. A validator that is not active in Governance, or an account with no authorization in any
  contract, does not enter the list.
- The network address of validator nodes (`host:port`) is not written to the chain (infrastructure data; the contract ABI has no
  free text). The operator's declaration lives in the network configuration (`network/permissions/`); the tool checks that every
  enode matches a validator address in Governance and rejects any that does not. A wrong address only breaks the connection; it
  grants no authority.
- Bootstrap: the founding validators in the genesis (`extraData`) and the deployment account form the first file; once the contracts
  are deployed and Governance is initialized, the file is re-rendered from the chain and the deployment account leaves the list.

## K3 — Tool and consistency check

- `trust:chain-permissions` (in the list publisher, next to the chain commands): `render` reads the chain state, produces a
  deterministic (sorted, de-duplicated) `permissions_config.toml` and prints the file's sha256 digest; `check` compares a node's
  active lists (`perm_getNodesAllowlist`, `perm_getAccountsAllowlist`, from the node's local admin endpoint) with the rendered file
  and reports the difference.
- Every operator renders the file **itself** and applies it to its own nodes; it does not copy someone else's file. Operators compare
  the digests; a difference between validators is an operational incident and is reported until resolved.
- The contracts have no read views enumerating these sets today (member list, writer list, institution delegate list); they are
  added together with the tool (with a [[SPEC-BC-0001]] version note). The tool is phase 0 preparation work; it is written together
  with the Besu development network and the indexer ([[ADR-0051]] open point 4).

## K4 — Authorization stays in the contracts

The actual write authorization is in the contracts: namespace (`onlyOwnerState`, [[SPEC-BC-0001]]/N1), state and institution
delegates (R1, R2), the Governance 2/3 vote, the trust list anchor writer threshold ([[ADR-0051]]/CH3). The allowlist is a second
line of defence (unknown accounts, spam, resource exhaustion; gas is free, GA1). An error in the allowlist does not widen contract
authorization.

## K5 — RPC is not exposed

- A node's JSON-RPC and WebSocket endpoints (8545/8546) listen only on the node's internal network. External access goes through an
  nginx (or equivalent) reverse proxy with **mutual TLS (mTLS)**, only for defined clients (list publisher, indexer, verifier read
  path); only the read and transaction namespaces (`ETH`, `NET`, `WEB3`) are exposed.
- The `PERM`, `ADMIN`, `QBFT`, `DEBUG` and `TXPOOL` namespaces are used only from the node itself (localhost).
- The P2P port (30303) is open in the firewall only to allowlisted peers; the node allowlist is the second layer.

## K6 — What it replaces

The [[SPEC-BC-0001]] §12.1 "Besu onchain permissioning" row; [[ARCH-0001]] §6 "allowlist contract"; [[ARCH-0002]] §6 "an on-chain
permissioning contract is preferred", the "permissioning contract admin key" in the security note, and open point 3. These
statements are removed from the living documents. No ADR decision changes: [[ADR-0001]]'s permissioned network decision stands as
is; only the mechanism changes.

# Options considered

| Option | Result | Why |
|---|---|---|
| Pin Besu to a release before 25.6 | rejected | Depending on a removed feature stops security updates |
| Write our own permissioning rules as a Besu plugin | rejected (for now) | A separate Java code base, audit and release burden; authorization is already in the contracts. Revisited if the number of states grows |
| A shared permissions file kept by hand in the repository | rejected | A second source of truth; can drift from Governance |
| A separate operator list signed by the operators | rejected | The approved set is already in Governance; keeping the same data in a second place adds drift risk |
| No account permissioning, contract authorization only | rejected | With free gas anyone could send transactions; spam and resource exhaustion |
| Tessera privacy groups | rejected | Removed from Besu; no personal data on the chain (DP1) |

# Invariants

| Code | Rule |
|---|---|
| LP1 | Permissioning on chain nodes is local (`permissions_config.toml`, node and account allowlists enabled); no onchain permissioning contract and no Tessera privacy groups are used. |
| LP2 | The allowlists are derived from the on-chain contract state; a validator not active in Governance, or an account with no authorization in any contract, does not enter the list; there are no manual additions. |
| LP3 | All validators carry the same account list and the same validator node list; a difference is an operational incident and is reported until resolved. |
| LP4 | Write authorization is enforced in the contracts; the allowlist does not widen it and does not replace it. |
| LP5 | A node's JSON-RPC endpoint is not exposed to the internet; external access only through a reverse proxy with mTLS and only with the read/transaction namespaces; `PERM`, `ADMIN`, `QBFT` only locally. |

# Consequences

- [[SPEC-BC-0001]] §12.1 and the §15 version note; [[ARCH-0001]] §6; [[ARCH-0002]] §6, security notes, open point 3 closed;
  `network/README.md` planned layout (`permissions/`).
- Phase 0 preparation work: `trust:chain-permissions` (render + check), set-enumerating read views in the contracts, reverse proxy +
  mTLS configuration, trying local permissioning on the Besu development network.
- Unchanged decisions: D-BC-0 (Besu/QBFT), D-BC-6 (chain threshold), D-BC-7 (chain projection), D-TRUST-0, D-GOV-0.

# Status

**Accepted — 2026-10-19.** With project management approval. DECISIONS: D-NET-6. Replaces: [[SPEC-BC-0001]] §12.1, [[ARCH-0001]] §6,
[[ARCH-0002]] §6 and open point 3 (the onchain permissioning contract assumption); it supersedes no ADR.
