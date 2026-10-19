---
document_id: ADR-0055
title: "Governance: upgrade delay and registry administration proposals"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-19
last_updated: 2026-10-19
summary: >
  Two gaps in the Governance contract are closed. (1) A protocol upgrade accepted by a 2/3 vote is not applied at once: it is first
  queued, waits 7 days, and is then applied with the threshold recounted. A state that disagrees can withdraw unilaterally in that
  time. The upgrade can optionally call the new version's parameterless initialiser in the same transaction (only a 4-byte function
  selector; no free-form data). (2) Registry administration that Governance manages but could not call until now (list anchor writers
  and threshold, recognition among founders, deprecating and revoking a network schema) can be done through typed proposals with a
  2/3 vote. No generic "execute any call" proposal is created. ADR-0051 open item 3 is closed. Accepted: 2026-10-19.
domain: Trust
related: ["[[ADR-0002]]", "[[ADR-0009]]", "[[ADR-0051]]", "[[ADR-0053]]", "[[SPEC-BC-0001]]"]
translation_of: ADR-0055
source_version: 1.0.0
---

# In short

The strongest operation that changes the network's rules is a contract upgrade. This decision puts a one-week wait in front of
it: the vote passes, the upgrade is queued, everyone sees what will happen, and a state that disagrees can leave the network in that
time if it wishes. It also makes a few administrative operations that Governance should hold, but could not call, open to a vote.

# Context

- [[SPEC-BC-0001]] §1 and §9: a protocol upgrade needs a 2/3 vote; the authority lies with Governance (UUPS). The 2026-10-19 security
  round (F-14) showed two gaps: an upgrade can be applied in the same transaction as soon as the threshold is reached (no delay), and
  because the upgrade is called with empty initialisation data, a new version with an initialiser (`reinitializer`) cannot be
  activated in the same transaction; a separate call is needed, and someone else can make that call first.
- [[ADR-0002]] #5: every state can withdraw unilaterally, without a vote. Without a delay this right does not work in practice against
  an upgrade: the change takes effect the moment the vote passes.
- [[ADR-0051]] open item 3 and security round F-15: managing the list anchor writers and threshold (`setAnchorer`,
  `setRequiredConfirmations`), recognition among founders (`CrossRecognition.bootstrapFounders`) and deprecating or revoking a network
  schema (`SchemaRegistry.deprecateSchema` / `revokeSchema`, NETWORK tier) can only be called from the `governance` address. When that
  address is the Governance proxy, Governance has no way to call them.
- The chain has no free-form `bytes` fields ([[SPEC-BC-0001]]/DP1; ABI test): a generic "call data" proposal would break that rule.
- On 2026-10-19 project management approved the security round's recommendations; for upgrades the conventional safe choice (a
  proposal delay) was asked for.

# Decision

## K1 — Upgrade queue and delay

- When a `PROTOCOL_UPGRADE` proposal reaches the threshold, the first `execute` call **queues** it (`ProposalQueued(id, eta)`) instead
  of applying it.
- It can be applied at the earliest at `eta = queue time + 7 days` (`UPGRADE_DELAY`) and at the latest at `eta + 30 days`; after that
  the proposal counts as expired. At application time the threshold is **recounted** from today's ACTIVE members ([[SPEC-BC-0001]]
  GV3); votes of members that withdrew during the wait do not count.
- A queued proposal can complete its wait and be applied even if the voting period (`PROPOSAL_TTL`) has run out.
- Membership (admission, removal), network schema registration and the administration proposals of K3 get no delay (today's
  behaviour).

## K2 — Initialisation call with the upgrade

`proposeProtocolUpgradeAndInit(target, newImplementation, initSelector)`: the upgrade calls the new version's **parameterless**
initialiser in the same transaction through `upgradeToAndCall`. The proposal carries only the 4-byte function selector; the
initial values are in the new version's code, and that code is what is voted on. There is no free-form data field (DP1).
`proposeProtocolUpgrade` stays as the upgrade without an initialisation call.

## K3 — Typed registry administration proposals

New proposal kind `REGISTRY_ADMIN`; each operation has its own typed proposal function. All of them are executed with a 2/3 vote:

| Proposal | Called on execution |
|---|---|
| `proposeAnchorerChange(registry, anchorer, allowed)` | `TrustListAnchorRegistry.setAnchorer` |
| `proposeAnchorThreshold(registry, required)` | `TrustListAnchorRegistry.setRequiredConfirmations` |
| `proposeFounderRecognition(registry, founders)` | `CrossRecognition.bootstrapFounders` |
| `proposeNetworkSchemaDeprecation(schemaId, supersededBy)` | `SchemaRegistry.deprecateSchema` (the bound schema registry) |
| `proposeNetworkSchemaRevocation(schemaId, reason)` | `SchemaRegistry.revokeSchema` (the bound schema registry) |

The target address cannot be zero, Governance itself or an address without code. No generic "execute call" proposal is created.

# Options considered

| Option | Result | Why |
|---|---|---|
| No delay (today) | rejected | The withdrawal right does not work against an upgrade; no time to notice a faulty upgrade |
| A separate timelock contract (OpenZeppelin TimelockController) | rejected | A new authority holder and a new contract; a queue inside Governance gives the same result |
| Applying the delay to every proposal | rejected | Membership and network schema decisions have no delay in ADR-0002; changing that is a separate decision |
| A 2-day / 14-day delay | rejected | 2 days is not a reaction time for state institutions; 14 days needlessly delays an urgent fix. 7 days is common practice |
| Free-form initialisation data (`bytes`) with the upgrade | rejected | Opens a free-form data field on the chain (DP1); a parameterless initialiser does the same job |
| A generic "execute call" proposal (target + `bytes`) | rejected | Breaks DP1 and makes it harder to read what is being voted on; the needed operations are few and known |

# Invariants

| Code | Rule |
|---|---|
| GE1 | A protocol upgrade is queued when it reaches the threshold and is applied at the earliest 7 days later, with the threshold recounted from the ACTIVE members at that time. |
| GE2 | The initialisation call made with an upgrade is only a parameterless function selector; Governance proposals carry no free-form data (`bytes`). |
| GE3 | Governance's registry administration is done only through typed proposals with a 2/3 vote; there is no generic call proposal. |

# Consequences

- `contracts/src/governance/Governance.sol` and `IGovernance.sol`: queue, `UPGRADE_DELAY`, `proposeProtocolUpgradeAndInit`,
  `REGISTRY_ADMIN` proposals, `ProposalQueued` event; storage layout append-only. Values are only appended to `ProposalKind`.
- [[SPEC-BC-0001]] §1 and §9 version note; [[ADR-0051]] open item 3 closed.
- DECISIONS: **D-BC-10**.

# Status

**Accepted — 2026-10-19.** With project management approval. DECISIONS: D-BC-10. GE1–GE3 are binding; the vote thresholds of
[[ADR-0002]] do not change.
