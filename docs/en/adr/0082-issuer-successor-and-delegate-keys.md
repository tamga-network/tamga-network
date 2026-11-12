---
document_id: ADR-0082
title: "Correctable issuer successor and per-state delegate keys"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-12
last_updated: 2026-11-12
summary: >
  Two findings left from the contract scan touch closed rules, so they are closed by this decision. (1) The successor, which
  determines who publishes the status lists of a closed issuer, was written in a single step with the revocation and could never
  be changed: a mistyped successor was permanent, and the lists froze when the issuer was revoked without a successor or when
  the successor itself was closed. Decision: the issuer's state corrects, changes or removes the successor of its revoked issuer
  afterwards, under the same rules. (2) A delegate key could belong to one state only; a state could block another state's
  delegate assignment by writing the key that state was about to use into its own list first. Decision: the delegate mapping is
  kept per state; one state's list neither touches nor blocks another state's authority. Squatting on a relying party
  identifier can already be corrected through ADR-0075. Accepted (2026-11-12).
domain: Blockchain
related: ["[[SPEC-BC-0001]]", "[[ADR-0002]]", "[[ADR-0054]]", "[[ADR-0073]]", "[[ADR-0075]]"]
translation_of: ADR-0082
source_version: 1.0.0
---

# In short

The on-chain records had two small gaps with lasting consequences. First: when an issuer is closed, the information "from now
on this issuer publishes its status lists" (the successor) was written once and could not be corrected if it was wrong. Second:
a state could register the transaction key another state wanted to use, before that state did, and so block that state's key
assignment. This decision closes both: the successor can be corrected afterwards; each state's key list concerns only that
state. There is no running chain ([[ADR-0009]] K4); the change is made in the source and the chain starts with this version.

# Context

- **Successor.** [[SPEC-BC-0001]] §3 and I4: the status list of a `REVOKED` issuer is published by its successor; the successor
  chain has a single level. The successor was written only in the `revokeIssuer` / `revokeIssuerAt` / `retireIssuer` call;
  once the issuer is revoked the same call fails with `AlreadyRevoked`. The result, verified from the code (contract review
  2026-11-12, finding D4):
  - a successor written with the wrong identifier is permanent: the keys of the wrong issuer manage the predecessor's lists;
  - a revocation without a successor freezes the lists: a forged or erroneous credential of the closed issuer can no longer be
    revoked;
  - if the successor is closed later (the chain has a single level), the predecessor's lists freeze again.
- **Delegate key.** [[SPEC-BC-0001]] N1: "a key can belong to one state only" (`DelegateKeyInUse`). The rule was introduced in
  the 2026-10-19 security round to stop a state from dropping another state's authority by writing that state's key into its own
  list (theft); the mapping was single-valued (key → state). The same rule could be used the other way round (finding D5): if a
  state sees another state's delegate assignment transaction and writes the same key into its own list first, the other state's
  transaction fails. Generating a key is cheap, but the blocking can be repeated on every attempt, and a blocked state cannot
  write to its national records. The contract cannot know who holds a key.
- **Relying party identifier.** The other half of the same finding (squatting on `rpId`) is closed by [[ADR-0075]]: the record
  of the state that registered first is reassigned to the real owner by a Governance vote (2/3). For the access certificate
  fingerprint and the terminal group identifier, squatting is overcome only with a new certificate or identifier; both are in
  the state's own hands, and the records show who wrote them.

# Options

Successor:

| Option | What | Outcome |
|---|---|---|
| **(a) The state writes the successor afterwards** | A separate call that corrects, changes or removes the successor of a revoked issuer; the rules are the same as at revocation | **chosen** |
| (b) Two-step assignment | The successor issuer's key accepts the assignment | not chosen: issuer keys cannot write to national records (R1); both issuers belong to the same state, so acceptance adds no assurance |
| (c) Following the successor chain | When the successor is closed, its own successor is authorised | not chosen: does not correct a wrong entry; the chain of authority grows (I4, single level) |

Delegate key:

| Option | What | Outcome |
|---|---|---|
| **(a) Per-state mapping** | The mapping is kept by the pair (key, state); one state's list does not touch or block another's | **chosen** |
| (b) Acceptance by the key | The assigned key accepts with a separate transaction | not chosen: an extra transaction per delegate and extra code in Governance (little byte headroom); (a) gives the same result with less code |
| (c) Do nothing | The blocking state is visible on chain; the remedy is a removal vote | not chosen: the blocked state cannot write records until the vote concludes |

# Decision (2026-11-12)

(a) for the successor, (a) for the delegate key. The binding rules are IS1–IS2 and DK1–DK2 below.

# Invariants

| Code | Rule |
|---|---|
| IS1 | Only the issuer's state writes the successor of a revoked (`REVOKED`) issuer afterwards: it corrects, changes or removes it (`setIssuerSuccessor`). The successor follows the rules of revocation: an issuer of the same state that is `ACTIVE` at that moment, not the issuer itself ([[ADR-0054]] NS2); zero removes the successor. The call is refused for an issuer that is not revoked (`IssuerNotRevoked`): the successor comes with the revocation. |
| IS2 | The successor determines only the authority to publish the status list ([[SPEC-BC-0001]] I4); it does not change the acceptance of credentials (C1/C2), the issuer's status history or the moment of revocation. The successor chain stays at a single level: if the successor is closed, the state writes a new one. Every change is visible on chain as an event (`IssuerSuccessorSet`). |
| DK1 | The delegate key mapping is per state. A state writing or emptying its delegate list changes only that state's mapping; it cannot block another state's delegate assignment or drop its authority. `DelegateKeyInUse` is removed. |
| DK2 | N1 holds as before: only a state's delegate writes to that state's records. A key may appear in the lists of several states; each state is responsible for its own list (a state that writes another state's key into its list has given that key authority over its own records only). The single-state rule for the validator address (`ValidatorInUse`) is unchanged. |

Names (public ABI; following the existing naming pattern):

| Place | Name |
|---|---|
| `IssuerRegistry` function | `setIssuerSuccessor(bytes32 issuerId, bytes32 successorId)` |
| `IssuerRegistry` event | `IssuerSuccessorSet(bytes32 indexed issuerId, bytes32 successorId)` |
| `IssuerRegistry` error | `IssuerNotRevoked(bytes32 issuerId)` |
| `Governance` error (removed) | `DelegateKeyInUse(address key, bytes2 ownerState)` |

# Consequences

- `IssuerRegistry`: a new function, event and error; the successor check is in an internal function shared with revocation. The
  storage layout does not change. The chain indexer re-reads the record on issuer events, so it sees a successor change without
  extra code.
- `Governance`: `_isDelegate` (key → state → yes/no) replaces `_delegateToState` (key → state) in the same slot. Since there is
  no running chain, the storage baseline was rewritten with this version; with a deployed version the slot would not be retyped,
  a new variable would be added instead. The signatures of `isDelegateOf` and `delegateKeysOf` do not change. The runtime code
  became smaller.
- [[SPEC-BC-0001]] N1, §1, §3 and I4 were updated.
- Tests: `contracts/test/review-2026-11-12.test.ts` (revocation without a successor, correcting a wrong successor, a closed
  successor, the rules; the state that writes first cannot block the other, the lists do not touch each other),
  `security-round-2026-10-19.test.ts` (F-02).
- Remaining limit (deliberate): a relying party's access certificate fingerprint and a terminal group identifier are unique in
  the network and belong to whoever writes them first. A squatted value is replaced with a new one; for the domain name
  identifier the path is [[ADR-0075]].

# Status

**Accepted — 2026-11-12.** Approved by project management (2026-11-12). DECISIONS: D-BC-16. IS1–IS2 and DK1–DK2 are binding.
Implementation: `IssuerRegistry.setIssuerSuccessor`, `Governance.setDelegateKeys` ([[SPEC-BC-0001]] version notes).
