---
document_id: ADR-0053
title: "Competing candidates in the list anchor registry"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-19
last_updated: 2026-10-19
summary: >
  In the list anchor registry (TrustListAnchorRegistry) the writer who first opens a version can no longer lock that version's
  data. Different data for the same version is not rejected; it is recorded as a separate candidate and emits a conflict event
  (`AnchorConflict`). A version is confirmed when a candidate is the first to be supported by threshold-many distinct anchorers
  that are still authorised; after that it is closed and never changes. Each anchorer supports only one candidate per version; a
  removed anchorer's support no longer counts, so a key rotation does not give one operator two votes; the threshold cannot be set
  above the number of anchorers. Amends the last item of ADR-0051 K3 and CH4; CH1–CH3 and CH5 stay as they are. Accepted: 2026-10-19.
domain: Trust
related: ["[[ADR-0009]]", "[[ADR-0051]]", "[[ADR-0052]]", "[[SPEC-BC-0001]]", "[[SPEC-TRUST-0001]]"]
translation_of: ADR-0053
source_version: 1.0.0
---

# In short

A list version's digest on the chain is confirmed when several independent operators submit the same digest. Under the old rule
the writer who opened a version first decided its data: if it opened the version with wrong data, the honest writers' correct digest
was rejected and the version could never be confirmed. Under the new rule every different digest is a separate candidate; the first
candidate to reach the threshold wins, and every conflict is written to the chain as an event anyone can see.

# Context

- [[ADR-0051]] K3: an anchor is confirmed when threshold-many distinct writers submit exactly the same data; a writer that submits
  a different digest for an opened version is rejected with `AnchorMismatch`, and this is "tracked through events". CH4 makes it
  binding.
- The 2026-10-19 contract security round (F-05) found two problems:
  1. **First-opener lock.** A single writer can open a `(listKey, version)` pair with wrong data (future versions too, in advance).
     The honest writers' correct data is rejected with `AnchorMismatch`; the version can never be confirmed and nothing clears it.
     The verifier sees `UNKNOWN` instead of the `NO` alarm. The threshold ≥ 2 rule ([[ADR-0009]] K4) stops a single operator from
     producing a confirmed anchor, but it does not stop a single operator from **blocking** confirmation.
  2. **No trace.** The rejection is a `revert`, so nothing remains on the chain; the "tracked through events" wording in K3 has no
     counterpart in the code.
- The same round (F-13) showed two small edge cases: a removed writer's earlier confirmation keeps counting (a single operator that
  rotates its key can confirm the same version twice), and the threshold can be set above the number of writers (no anchor can be
  confirmed).
- There is no chain today ([[ADR-0009]] K4); the contract is preparation code. The change is made before the chain is switched on.
- On 2026-10-19 project management approved the security round's recommendation: different candidates for the same version are kept
  apart, the first to reach the threshold wins, and the conflict is recorded as an event.

# Decision

## K1 — Competing candidates

- Each different set of data `(contentHash, previousHash, issuedAt)` / `(lineHash, ts)` submitted for a `(listKey, version)` or
  `(logKey, seq)` is a separate **candidate**. Different data for an opened version is not rejected; it is recorded as a new
  candidate.
- Each writer can support only **one** candidate per version (a second submission is rejected with `AlreadyConfirmedBy`). A writer
  can therefore never support two different candidates.
- The monotonicity rule still applies when a version is first opened: a new version opens above the highest **confirmed** version
  (first half of [[ADR-0051]] CH4). A competing candidate can be added to a version that is opened but not yet confirmed.

## K2 — Confirmation: the first candidate to reach the threshold

- A candidate is confirmed when it is supported by threshold-many **distinct writers that are still authorised**. At that moment
  the version closes: the record carries the winning candidate's data, no further candidate can be added, and the confirmed record
  never changes and is never deleted (second half of [[ADR-0051]] CH4, unchanged).
- Before confirmation the `listAnchor` / `logHead` view shows the candidate that opened the version; each candidate's current
  support is read through separate views (`listCandidateConfirmations`, `logCandidateConfirmations`, `candidateCount`). An
  unconfirmed candidate never produces `YES` in any query.

## K3 — Conflict event

Every second and later different candidate for a version emits `AnchorConflict(key, versionOrSeq, firstHash, submittedHash,
anchorer)`. The event is the equivocation alarm: operators and the indexer watch it; when the list publisher
(`trust:chain-submit`) sees a different pending candidate it still submits the digest it has verified itself and reports a conflict
warning. On conflict the signed list prevails ([[ADR-0051]] CH1, unchanged).

## K4 — When the writer set changes

- A removed writer's support does not count for any candidate; support is recounted from the currently authorised writers on every
  submission. An operator that rotates its key (old key out, new key in) cannot give two valid supports to the same version.
- The threshold cannot be set above the number of writers (at initialisation and in `setRequiredConfirmations`). Removing writers
  can bring the count below the threshold; that is a governance decision and is visible through events (`AnchorerSet`).
- A production threshold of at least 2 stays a deployment discipline ([[ADR-0051]] K3, unchanged).

# Options considered

| Option | Result | Why |
|---|---|---|
| Old rule (the first opener decides the data, different data `revert`s) | rejected | A single writer locks a version for good; no trace remains |
| Letting governance delete a pending candidate | rejected | A delete power is a new attack surface and needs a Governance vote; the competing-candidate model makes deletion unnecessary |
| Punishing the opener of a conflicting first candidate (removing the writer automatically) | rejected | A faulty but honest writer would be removed too; removal is a Governance decision |
| Letting a writer support several candidates | rejected | A single operator could hide equivocation inside itself by supporting two digests |
| Storing the support count at confirmation time and never recounting | rejected | Key rotation gives one operator two votes (F-13) |

# Invariants

| Code | Rule |
|---|---|
| AC1 | Different data for an opened anchor version is not rejected but recorded as a separate candidate; each writer supports only one candidate per version. |
| AC2 | A version is confirmed when a candidate is the first to be supported by threshold-many distinct writers that are still authorised; after that it closes, and the confirmed record never changes and is never deleted. |
| AC3 | Every second and later different candidate for a version emits a conflict event (`AnchorConflict`) on the chain. |
| AC4 | A removed writer's support does not count; the threshold cannot be set above the number of writers. |

# Consequences

- `contracts/src/anchor/TrustListAnchorRegistry.sol`: candidate records, conflict event, candidate views; storage layout append-only
  (`__gap` reduced; the `contracts:storage-check` baseline updated). The `AnchorMismatch` error is gone.
- `apps/trust-publisher` `chain-submit`: a **different** pending candidate on the chain is no longer `CONFLICT` (do not write) but
  "submit our own digest and warn" (`CONTEST`); a confirmed different digest stays `CONFLICT`. `chain-check` is unchanged (it only
  looks at the confirmed record).
- The last item of [[ADR-0051]] K3 and CH4 were updated with a reference to this ADR; [[SPEC-BC-0001]] §15 version note.
- DECISIONS: **D-BC-8**.

# Status

**Accepted — 2026-10-19.** With project management approval. DECISIONS: D-BC-8. Amends the last item of [[ADR-0051]] K3 and CH4;
AC1–AC4 are binding.
