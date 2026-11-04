---
document_id: ADR-0075
title: "Ownership of the verifier domain-name identity and re-registration after revocation"
status: Proposed
version: 1.0.0
created: 2026-11-04
last_updated: 2026-11-04
summary: >
  ADR-0073 K4 made the verifier identity `rpId = keccak256(dns_name)`. In the contract this identity belongs to the state that
  registers it first; another state can capture the identity of a verifier whose domain it does not own by registering it first,
  and a revoked identity can never be registered again. Proposal: (a) a typed Governance dispute / transfer proposal (2/3) changes
  the owner of the identity; re-registration after revocation opens only by a Governance vote. Alternative (b): off-chain DNS proof
  of domain ownership + Governance approval. Recommended: (a).
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

# Consequences (if accepted)

- `RelyingPartyRegistry` and `Governance`: a new typed proposal and a transfer / re-registration path that only Governance can call;
  a registration period counter; storage layout only appended to.
- [[SPEC-BC-0001]] §6 and §16; the list publisher's registration tool and the `TrustSource` equivalence test.
- Until accepted, contract behaviour does not change; the registration authority keeps checking domain ownership before registering.

# Status

**Proposed — 2026-11-04.** Awaiting project management's decision (finding of the 2026-11-04 contract security round).
