---
document_id: ADR-0075
title: "Ownership of the verifier domain-name identity and re-registration after revocation"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-04
last_updated: 2026-11-04
summary: >
  ADR-0073 K4 made the verifier identity `rpId = keccak256(dns_name)`. In the contract this identity belongs to the state that
  registers it first; another state can capture the identity of a verifier whose domain it does not own by registering it first,
  and a revoked identity can never be registered again. Proposal: (a) a typed Governance dispute / transfer proposal (2/3) changes
  the owner of the identity; re-registration after revocation opens only by a Governance vote. Alternative (b): off-chain DNS proof
  of domain ownership + Governance approval. Recommended: (a). Accepted (2026-11-04): (a), as recommended; a new period keeps
  the old history, and the list is updated under the same rule.
domain: Trust
related: ["[[ADR-0002]]", "[[ADR-0034]]", "[[ADR-0054]]", "[[ADR-0055]]", "[[ADR-0073]]", "[[ADR-0074]]", "[[SPEC-BC-0001]]"]
translation_of: ADR-0075
source_version: 1.0.0
---

# In short

A verifier's identity in the network is now derived from its domain name. Today the contract assigns that identity on a
"first come, first served" basis: if one state registers the domain of an institution in another country first, that institution
cannot register with its own domain. And once a verifier is revoked, the same domain can never be registered again. This proposal
gives both cases a way out: in a dispute and after revocation, the decision goes to the network's joint vote (2/3).

# Context

- [[ADR-0073]] K4 / CE4: the verifier's chain and list identity is `keccak256(dns_name)`; renewing the access certificate does not
  change it. The contract keeps the state code separately for sovereignty.
- 2026-11-04 contract security round (MEDIUM, decision needed): `RelyingPartyRegistry.registerRelyingParty` writes the identity
  with the calling state's delegate key under a **first registration** rule. The contract cannot know that the domain belongs to
  that state (the ABI carries no domain text, [[ADR-0074]] PJ2). Consequences:
  - **Capture:** state A can register first the identity derived from the domain of an institution in state B; B's registration
    is rejected with `RPExists`. The sovereignty rule ([[SPEC-BC-0001]]/N1) only says "write with your own state code"; it does
    not say which state an identity falls to.
  - **Permanent revocation:** `REVOKED` is final (K4); the record is not deleted and the same identity can never be registered
    again. If the domain changes hands, or the revocation was a mistake, that domain can no longer become a verifier in the network.
- Today the registration authority checks domain ownership in its own registration process ([[ADR-0024]], [[ADR-0026]]); there is
  no counterpart on chain and no dispute path. Code does not change before the rule does; this ADR proposes that rule.

# Options

| Option | What | Pros | Cons |
|---|---|---|---|
| **(a) Governance dispute / transfer proposal** | A typed Governance proposal ([[ADR-0055]] GE3, 2/3) changes the owning state of a verifier identity (capture) or reopens a revoked identity for registration. The old record and its history are not deleted; the new record is added as a new period. Out of scope: the identity itself and its formula (CE4) do not change. | Stays within the existing trust model (2/3 among states); no off-chain dependency; no single state can capture or reclaim an identity alone | Every dispute is a voting round; weighing the evidence is left to the members |
| **(b) DNS proof + Governance approval** | When registering (or transferring), domain ownership is checked off chain with a DNS proof (e.g. a verification record published in the domain); Governance approves based on the proof | Ownership rests on objective evidence | The proof is off chain; the check itself depends on an operator and a tool; DNS can be hijacked temporarily; a Governance approval is still needed |
| Do nothing | "First come, first served" and permanent revocation stay | No code change | Capture and the permanent lock stay unresolved |

# Recommendation

**(a).** Rationale: which state an identity falls to is a network-level decision, and the network's common gate is Governance
([[ADR-0002]]); a DNS proof (b) can be attached to the proposal as supporting evidence but is not enough on its own. Proposed rules:

1. The owning state of a verifier identity changes only by a typed Governance proposal (2/3); the proposal carries the identity,
   the old and new state codes and a reason digest (no free text, [[ADR-0074]] PJ2).
2. `REVOKED` stays final for a verifier record; **re-registration** of the same identity opens only by a Governance vote and
   starts a new registration period. The history and events of the revoked period are kept.
3. A transfer or re-registration is written to the signed list under the same rule (chain–list equivalence, [[ADR-0073]] CE6).
4. Function, proposal and event names are approved on acceptance.

# Decision (2026-11-04)

**(a) accepted as recommended.** The binding rules are RO1–RO5 below; the names follow the table.

# Invariants

| Code | Rule |
|---|---|
| RO1 | The owning state of a verifier identity (`rpId = keccak256(dns_name)`) changes only by a typed Governance **reassignment** proposal (2/3). The proposal carries the digest (`stageId`) of content first staged in the registry; the content holds the identity, the old and new state codes, the new period's name digest and access certificate fingerprint, and a reason digest (no free text, [[ADR-0074]] PJ2). Reassignment applies only to a record that is not revoked, and only to another active member state. |
| RO2 | `REVOKED` stays final for a period. **Re-registration** of the same identity opens only by a typed Governance re-registration proposal (2/3) and only for a revoked record (same or another active member state). |
| RO3 | Reassignment and re-registration start a new **registration period** (ACTIVE, from the time of execution). The record is not deleted; the status history and the period list are append-only; the old period's events and records are kept. The new period does not inherit the old period's scopes, registration data or terminal groups; the old period's open terminal groups are closed. Point-in-time reads (`relyingPartyAt`, `isRelyingPartyAcceptableAt`) answer for the period in force at that time. |
| RO4 | If another period was added to the record after staging, the proposal is stale and is not written; the proposal type must match the staged content's type. |
| RO5 | The signed list follows the same rule: a `dns_name` is never registered twice, whatever its status; an ownership change or a re-registration after revocation happens only through an explicit operation approved by project management. Re-registration is added to the same record as a new period (`status_history` → `ACTIVE`, with the approval record in the reason); old uses stay closed. Writing to the production registry also passes the `TAMGA_CONFIRM_PROD` gate. |

Names (public ABI; following the existing naming pattern — `proposeNetworkRecord` / `stageRecord` / `commitStaged`):

| Where | Name |
|---|---|
| `Governance` proposal functions | `proposeRelyingPartyReassignment(registry, stageId)`, `proposeRelyingPartyReRegistration(registry, stageId)` |
| `Governance` registry admin actions (`AdminAction`, appended) | `REASSIGN_RELYING_PARTY`, `REREGISTER_RELYING_PARTY` |
| `RelyingPartyRegistry` writes | `stagePeriodChange(PeriodChange)` (anyone; stores only), `commitPeriodChange(stageId, PeriodAction)` (Governance only) |
| `RelyingPartyRegistry` reads | `periodChangeIdOf`, `stagedPeriodChangeOf`, `registrationPeriodsOf`, `relyingPartyAt(rpId, t)`, `isRelyingPartyAcceptableAt(rpId, t)`, `relyingPartyStatusHistoryOf` |
| Types | `PeriodAction {NONE, REASSIGNMENT, RE_REGISTRATION}`, `PeriodChange`, `RegistrationPeriod` |
| Events | `PeriodChangeStaged`, `RelyingPartyReassigned`, `RelyingPartyReRegistered` |
| Errors | `UnknownPeriodChange`, `InvalidPeriodChange`, `StalePeriodChange` |
| List publisher | `register rp <application> --approval <approval record>` (re-registration after revocation) |

# Decisions on the open questions (2026-11-04)

1. **Option:** (a). A DNS proof (b) is supporting evidence that can be attached to the proposal; it can be part of the reason digest.
2. **Names:** the table above (following the existing naming pattern).
3. **Migration window:** a period change is written only by a Governance vote, also while the window is open; its date is the time
   of execution (never backdated), and history replayed in the window stays in the earlier period.

# Consequences

- `RelyingPartyRegistry` and `Governance`: a new typed proposal and a transfer / re-registration path that only Governance can call;
  a registration period counter; storage layout only appended to.
- [[SPEC-BC-0001]] §6 and §16; the list publisher's registration tool and the `TrustSource` equivalence test.
- The registration authority keeps checking domain ownership before registering; in a dispute the path is a Governance proposal. On
  the `TrustSource` side, the same `dns_name` appearing in more than one national list is treated today as fail-closed (ambiguous);
  closing the record in the old list after a reassignment is handled separately with the list equivalence test.

# Status

**Accepted — 2026-11-04.** Approved by project management (verbatim quote in the private approval record): option (a), as
recommended. DECISIONS: D-BC-14. RO1–RO5 are binding. Implementation: `RelyingPartyRegistry`, `Governance`, the list publisher's
registration tool ([[SPEC-BC-0001]] version note).
