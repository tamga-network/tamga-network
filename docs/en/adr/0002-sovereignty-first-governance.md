---
document_id: ADR-0002
title: "Sovereignty-first governance"
status: Active
version: 1.0.0
created: 2026-08-05
last_updated: 2026-10-02
summary: >
  Tamga Network splits governance into three SOVEREIGNTY-FIRST layers: (1) network membership (a new state becoming a
  validator) is voted by a validator majority (2/3); (2) national registries (issuers, relying parties) are ONLY under the
  authority of the state concerned, with no outside vote (enforced in code by onlyOwnerState); (3) cross-border recognition
  is decided unilaterally by each state. Removing a state does not invalidate its citizens' credentials; the right to exit
  (withdraw) is guaranteed in code. The model follows the eIDAS LOTL precedent. It refines the "founding consortium +
  on-chain voting" wording of PM-BC-0001 and is implemented by SPEC-BC-0001.
domain: Governance
translation_of: ADR-0002
source_version: 1.0.0
---

# ADR-0002 — Sovereignty-first governance

**Status:** Accepted
**Date:** 2026-08-05
**Decided by:** Tamga Network project management
**Source:** `docs/tamga-network-guven-katmani-kontratlari-v2.md` (architecture decision draft) — this ADR formalises the
governance section of that draft.

---

# Context

[[PM-BC-0001]] left governance broadly as "founding consortium + on-chain voting". A critical question required this to be
refined:

> **Why should Türkiye wait for Kazakhstan's vote when it makes one of its own institutions (e.g. the Ministry of
> Education) an issuer?**

It should not. Otherwise this would be an unacceptable **violation of sovereignty** and the biggest obstacle to adoption.
The precedent is clear: under [[t:eIDAS]] every member state publishes its own Trusted List independently; the EU only
aggregates the lists ([[t:LOTL]]). No state votes on which institutions another state makes [[t:issuer|issuers]]. Mutual
recognition is an **agreement or a choice**, not something voted institution by institution.

---

# Decision

Governance is split into three layers; in each layer a **different** actor decides:

| Layer | Subject | Who decides | Threshold |
|--------|------|-------------|------|
| **1 — Network membership** | A new state becoming a validator / being removed / protocol upgrades | Validator majority (existing states) | **2/3** |
| **2 — National registries** | Its own issuers, its own relying parties | **Only the state concerned** | NO vote (`onlyOwnerState`) |
| **3 — Cross-border recognition** | "Do I accept credentials from country X?" | Each state, for itself | Unilateral |

## Sub-decisions
1. **Layer 1 thresholds:** admitting a new state **2/3**; removing a state **2/3** (the removed state's vote is not counted);
   protocol upgrade **2/3**. (2/3 was chosen over unanimity: it prevents a single state from vetoing or locking growth;
   it is still a heavy decision.)
2. **Layer 2 — sovereignty in code:** every state has a **namespace** (`TR:issuer:*`, `KZ:rp:*` …) and **only that
   state's authorised key** can write to it. This is enforced in the contract by the `onlyOwnerState(stateCode)`
   modifier; it does not depend on good faith.
3. **Layer 3 — default recognition policy:** **FULL among founding members** (they fully recognise each other from the
   start); **NONE for later joiners** (opt-in) — states open up at the pace of their own legislation. This avoids the
   "all or nothing" trap.
4. **Removal ≠ destroying credentials:** removing a state only means "can no longer write new records or produce blocks".
   The [[t:credential|credentials]] in its citizens' wallets do not become invalid; their fate depends on the other
   states' layer 3 recognition decisions.
5. **Right to exit:** a state can leave unilaterally with `withdraw()`; no vote is needed. Guaranteed in code.
6. **Cross-border jurisdiction (home-state sovereignty):** a citizen's [[t:pseudonym]] can be opened ONLY by their own
   state's guardian threshold + their own court; no other state can do so. Detailed in [[PM-ID-0002]] (accountable
   disclosure); consistent with the principle "disclosure = home-state sovereignty" in [[PM-ID-0001]].

---

# Rationale

1. **Adoptability.** No state joins a network with the risk that "my internal institutional decisions depend on others'
   votes" or "if I am ever expelled, my citizens' identities become worthless". Sovereignty guarantees are a precondition
   for participation.
2. **Precedent (eIDAS/LOTL).** This is exactly the EU's working model; proven, not theoretical.
3. **Gradual integration.** Unilateral recognition lets each state open up at its own pace; it removes the need for full
   alignment in the early days.
4. **Guaranteed in code.** `onlyOwnerState` + `withdraw` turn sovereignty from a promise into an engineering guarantee.

---

# Consequences

**Positive:**
- A strong incentive to adopt (sovereignty + exit + durable credentials).
- The governance contract's scope shrinks → simpler, smaller attack surface.
- Conceptually aligned with eIDAS → easier interoperability.

**Cost / caveats:**
- Managing the cross-recognition matrix (every state × every state × category) is an operational burden; the wallet and
  [[t:verifier]] UX must hide it.
- The "founders FULL" default requires the founding set to be chosen carefully.
- Home-state jurisdiction may be limited in cross-border crime scenarios (inter-state agreements may be needed in the
  future — open topic in [[PM-ID-0002]]).

---

# Alternatives considered

- **Everything by common vote (full consortium):** rejected — violates sovereignty in layers 2/3; would not be adopted.
- **No common vote at all (fully independent):** rejected — the composition of the network (who is a validator) would be
  uncontrolled; "who sits at the table" must be a joint decision.
- **Unanimity (layer 1):** rejected — a single state could lock growth; 2/3 preferred.
- **Default recognition FULL (everyone):** rejected — legislative and sovereignty risk; founders FULL + later joiners NONE
  preferred.

---

# Related documents

- [[PM-BC-0001]] — the "founding consortium + on-chain voting" wording is refined by this ADR.
- [[ADR-0001]] — the engine (Besu/QBFT); layer 1 votes coincide with the QBFT validator set.
- [[SPEC-BC-0001]] — the contract implementation of this model (Governance, Registry, Recognition).
- [[ARCH-0001]] — the phased validator model (namespaces and voting in phase 0).
- [[PM-ID-0001]] / [[PM-ID-0002]] — home-state sovereignty and accountable disclosure.

---

# Status

The governance model is decided. Implementation details (contract interfaces, threshold parameters) are in
[[SPEC-BC-0001]]; guardian composition and cross-border jurisdiction will be deepened in [[PM-ID-0002]] + [[PM-GOV-0001]]
(planned).
