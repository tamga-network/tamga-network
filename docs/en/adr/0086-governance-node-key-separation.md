---
document_id: ADR-0086
title: "Governance and node key separation"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-15
last_updated: 2026-11-15
summary: >
  On the chain every member state has two separate addresses: the key of the validator node that produces blocks (QBFT) and the
  state's governance (vote) key. All on-chain authority — proposals, votes, the delegate list, withdrawal — rests with the
  governance key only; the node key, which sits on an always-online server, has no authority on the chain and is not on the
  account allowlist. A member changes its node address with its own governance key, without a vote. The governance key changes
  only through a Governance vote (2/3, at least 2) together with a supporting vote cast by the member's current key; the other
  members cannot change a state's key without its consent. In the two-member period a tested backup of the governance key is
  mandatory. Accepted (2026-11-15).
domain: Governance
related: ["[[ADR-0002]]", "[[ADR-0009]]", "[[ADR-0052]]", "[[ADR-0055]]", "[[ADR-0076]]", "[[ADR-0082]]", "[[ADR-0084]]", "[[ADR-0085]]", "[[SPEC-BC-0001]]", "[[ARCH-0002]]"]
translation_of: ADR-0086
source_version: 1.0.0
---

# In short

On the chain a state has two jobs: producing blocks (the validator node) and voting on the network's decisions (governance). Until
now both were done with the same key. The node key lives on a server that is always online; the vote key is used a few times a
year and belongs in a vault. With one key, whoever took over the server would also take over the state's vote and the delegate
list of its national records. This decision separates the two keys: the node key only produces blocks and has no authority on the
chain; all authority rests with the governance key. The node key is changed easily (by the state's own decision); the governance
key changes only with the network's vote and the state's own vote.

# Context

- [[SPEC-BC-0001]] §1: the `Governance` member record held one address (`StateMember.validatorAddress`); proposals, votes, vote
  retraction, proposal cancellation, the delegate key list (`setDelegateKeys`) and withdrawal all came from that address.
  [[ADR-0052]] K2: the account part of the Besu local allowlist lists the same address as "validator".
- [[ARCH-0002]] Step 2 and Open Issue 6 (2026-11-11): "governance and consensus key are the same today; until they are separated
  the node key must be held in an HSM on the real network; the separation is decided by a new decision record before a second
  state joins."
- Chain layer review (2026-11-15): the separation should be made before the first chain is set up; doing it later means a live
  Governance upgrade. [[ADR-0084]] LS6: the real network does not open without a decision record on key separation.
- [[ADR-0076]]: in a two-member network there is no unilateral withdrawal; if one member's vote key is lost, governance locks —
  hence the key backup and test signature rule for the two-member period ([[ARCH-0002]] Step 11).
- **Direction of project management (2026-11-15):** the chain code is completed switched off ([[ADR-0084]] K6); the next tasks are
  carried out. This decision is the first of them.

# Decision

## K1 — Two addresses in the member record

Every member record holds two addresses: the **node address** (`validatorAddress`, the key of the QBFT validator node) and the
**governance address** (`governanceAddress`, the state's vote key). The record also keeps the moment the governance key was bound
to the member (`governanceSince`; written on admission and on a key change). Rules:

- Neither address is zero and the two differ.
- An address is used in one state and one role only: a state's node address cannot be another state's node address
  (`ValidatorInUse`, N1), a governance address cannot be another state's governance address, and no address can be used in the
  other role in any state (`KeyInUse`).
- A released (replaced) address stays bound to its state; it cannot be given to another state. A compromised old key cannot be
  moved to another seat.
- Founders enter at deployment (`initialize`) with two addresses; an admission proposal (`proposeStateAdmission`) carries both.

## K2 — All on-chain authority rests with the governance key

Opening proposals (all kinds), voting and changing a vote, retracting a vote, cancelling a proposal, the delegate key list,
withdrawal and the SchemaRegistry binding are possible only from the member's **current** governance address (`NotGovernor`). The
node key has no authority on the chain: it only produces blocks and determines its place in the QBFT validator set. The node
address is therefore not on the Besu account allowlist; the account list carries the governance addresses of active members
([[ADR-0052]] K2's account list is read with this record). The node allowlist is unchanged: validator nodes whose declaration
matches the node address in Governance are listed. At execution, votes are counted from the members' current governance addresses.

## K3 — The member changes its node key itself

A member changes its node address with its own governance key, without a vote (`setValidatorAddress`, event
`ValidatorAddressChanged`). Reason: the node key is the key most at risk and must be replaced quickly when compromised; it has no
authority on the chain, so changing it is the state's internal matter (like the delegate list). A compromised node key cannot
replace itself. When the address on the chain changes, every operator renders the allowlist again from the chain; the change in
the QBFT validator set is made separately by the validators' own vote (at QBFT level).

## K4 — The governance key changes with the network's vote and the member's own vote

The governance key changes only through a typed Governance proposal (`proposeGovernanceKeyChange`, kind `GOVERNANCE_KEY_CHANGE`,
event `GovernanceAddressChanged`):

- The threshold is the same as for other proposals: 2/3 of active members, at least 2 ([[ADR-0002]], R6).
- **A supporting vote cast with the changing member's current key is also required** (`KeyChangeNeedsOwnVote`). Even when the other
  members reach the threshold, they cannot change a state's key without its consent; if they could, they would take over that
  state's delegate list, i.e. the authority to write its national records (N1).
- Any member may open the proposal (including the member whose key changes).
- It is checked again at execution: the member is still active and the new key is still free (not bound meanwhile to another state
  or the other role).
- After execution the old key loses its authority at once; votes cast with the old key on open proposals are not counted
  (`governanceSince`) and the member votes again with the new key — the same rule as for the old votes of a readmitted member.

**Why a vote, and why not the member's own signature alone.** If the key changed with the member's own signature alone, whoever
stole the governance key could switch it to their own key and lock the real owner out for good; in a two-member network that member
cannot be removed either (removal needs at least two votes besides the target). With the vote requirement a compromised key cannot
change anything alone: the other members confirm the change against a written request that arrives through a separate channel. The
requirement of the member's own vote also prevents a majority from silently taking over a state's seat.

## K5 — Two-member period and key loss

- In a two-member network a key change needs the votes of both members (the changing member and the other member). A lost
  governance key cannot be recovered on the chain in a two-member network: the change needs that key's vote, and the member can be
  neither removed nor withdrawn ([[ADR-0076]]). That is why the backup and test signature rule of [[ARCH-0002]] Step 11 applies to
  the **governance key** and is mandatory in the two-member period: the address of the key restored from the backup must equal the
  **governance address** in Governance, and a test signature must be possible with it. No backup is required for the node key: if
  it is lost, the member writes a new one with its governance key (K3).
- In a network of three or more members the path for a lost key is today's path: the member is removed by the other members' vote
  and readmitted with new addresses (two visible proposals with a reason digest).
- For a compromised key whose backup is at hand, the member and the other members vote on the change proposal at once; since the
  attacker can flip the vote with the same key, the other members disregard the attacker's votes and proposals until the change is
  executed. As the chain makes no decision ([[ADR-0084]] LS2), this period does not affect the verification of any credential.

## K6 — Keeping the keys

The governance key is not on the node server: it sits in a separate vault (on the real network a hardware key store) and is used
only to sign transactions. The node key is on the node server (on the real network a hardware key store is preferred, but the reason
is now block production, not the vote). The real network's key path (hardware key store and remote signer) is a separate decision
record ([[ADR-0084]] LS6).

# Rationale / alternatives

| Option | Result | Why |
|---|---|---|
| **Two addresses; the node has no authority; the node changes itself; governance by vote + own vote** | **chosen** | Taking over the server does not take over the vote; the node key changes quickly; the governance key can neither be captured and locked alone nor seized by a majority |
| One key (today), node key held in an HSM | rejected | An always-online key carries the vote and the national record authority; an HSM protects the signature but does not stop a compromised server from making the HSM sign |
| The member changes its governance key alone | rejected | Whoever steals the key locks the owner out for good; in a two-member network there is no way back |
| Governance key by vote only, without the member's own vote | rejected | A 2/3 majority could switch a state's key to its own and take over its delegate list, i.e. its national records (contrary to N1) |
| The node key also changes only by vote | rejected | Replacing the riskiest key would depend on the speed of the other operators; as the node has no authority on the chain, a vote protects nothing |
| A separate contract (governance key registry) | rejected | Governance's authority check would become an external call on every call; one new mapping and one slot from `__gap` achieve the same |

# Invariants

| Code | Rule |
|---|---|
| KG1 | Every member record holds two addresses: the node (QBFT) address and the governance address; neither is zero and they differ. An address is used in one state and one role only; a released address stays bound to its state and cannot be given to another state. |
| KG2 | All on-chain authority (proposals, votes, vote and proposal retraction, the delegate list, withdrawal, the SchemaRegistry binding) rests with the member's current governance address only; the node address has no authority on the chain and is not on the account allowlist. At execution, votes are counted from the current governance address. |
| KG3 | A member changes its node address with its own governance key, without a vote; the change in the validator set is made at QBFT level by the validators' vote. |
| KG4 | The governance key changes only through a Governance proposal: 2/3 of active members (at least 2) and a supporting vote cast with the changing member's current key are both required; it is checked again at execution; the old key's authority and its votes on open proposals lapse. |
| KG5 | In the two-member period every member keeps a tested backup of its governance key stored in a separate place (the restored key's address equals the governance address in Governance and a test signature is possible); the governance key is not on the node server. |

# Consequences

- `contracts/src/governance/Governance.sol`, `IGovernance.sol`: `governanceAddress` and `governanceSince` in the member record (the
  struct is a mapping value only; members appended), `governanceAddress` in the proposal record, a new mapping `_governanceToState`
  (`__gap` 37 → 36), a new proposal kind `GOVERNANCE_KEY_CHANGE` (appended), `proposeGovernanceKeyChange`, `setValidatorAddress`,
  events `ValidatorAddressChanged`, `GovernanceAddressChanged`, `StateAdmitted` with both addresses; errors `NotGovernor` (replacing
  `NotValidator`), `KeyInUse`, `KeyChangeNeedsOwnVote`. `initialize` and `proposeStateAdmission` take a third argument (the
  governance address). The storage layout check passed; code size Governance 23,872 bytes (headroom 704). No chain is running; the
  baseline was renewed.
- Publisher and tools: the account part of the allowlist lists active members' governance addresses ("governance"), not the node
  address; the key map (`tamga-chain-keys/1`) adds a `governance` key per state; local development rule: governance key = node
  account + 10 (Hardhat test accounts); the test network scripts and the migration and continuous projection signers vote with the
  governance key.
- [[SPEC-BC-0001]] §1, [[ARCH-0002]] Step 2, Step 6, Step 11 and Open Issue 6, and the node handbook (GUIDE-0015) were updated.
- The governance command tool signs with the governance key (with subcommands for a key change and a node address change).

# Status

**Accepted — 2026-11-15.** With the approval of project management (2026-11-15). DECISIONS: D-GOV-13. KG1–KG5 are binding.
