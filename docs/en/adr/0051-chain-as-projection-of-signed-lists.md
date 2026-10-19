---
document_id: ADR-0051
title: "The chain is a projection of the signed lists"
status: Proposed
review_status: Draft
version: 0.1.0
created: 2026-10-17
last_updated: 2026-10-17
summary: >
  The chain code is written before a production chain exists and is wired to the chainless design: the signed trust lists
  (lotl, tl-<cc>) and the anchor log remain the source; the chain is their projection. Only the digest of a list version
  (version, content hash, previous hash, issue time) and the digest of the anchor log's latest line are written to the chain —
  no content, no records, no credentials, no personal data. An anchor counts as confirmed only once a threshold of independent
  writers has submitted identical data; in production the threshold is at least 2 (the second-operator gate, ADR-0009 K4). The
  chain's answer is never required for verification; on conflict the signed list prevails. The feature flag is off by default.
  The contracts compile and are tested with Hardhat; there is no production chain.
domain: Trust
related: ["[[ADR-0001]]", "[[ADR-0002]]", "[[ADR-0007]]", "[[ADR-0008]]", "[[ADR-0009]]", "[[SPEC-BC-0001]]", "[[SPEC-TRUST-0001]]", "[[PM-TRUST-0001]]", "[[ARCH-0003]]", "[[FW-ARF-0001]]"]
translation_of: ADR-0051
source_version: 0.1.0
---

# In short

Today the network's trust lives in signed lists; there is no chain. This decision says the chain code is written now and **wired**
to those lists: the chain becomes a second register that stores the digests of the lists. Whatever the lists say is what holds;
the chain only testifies that "this list version was published at this time with this digest" — and that testimony counts only
when several independent operators say the same thing.

# Context

- [[ADR-0009]] sets up the chain when **at least two independent validator operators** have accepted in writing (K4); until then
  the trust anchor is the signed, versioned, hash-chained lists plus the hourly anchor log (K2). The move is a replay of the
  list archive into the contracts plus an equivalence test (K7). There is no second operator today, nor a list of candidates.
- The contracts ([[SPEC-BC-0001]]) had never been compiled before 2026-10-17. On 2026-10-17 project management set the direction:
  the operator decision is postponed; the chain code is written **now**, compiled, tested and **integrated** with the chainless
  design; it stays off in production.
- The form of the integration was an open decision: (a) replay the lists' content into the contracts now, (b) write only the
  lists' digests to the chain, (c) write nothing and only compile. (a) is the work of phase 0 — it needs the states' delegate
  keys, validators and a governance vote ([[ADR-0009]] K7). (c) does not tie the code to the design. This ADR proposes (b): the
  smallest and least risky projection, and groundwork for (a) later.
- The "double-speak" weakness ([[ADR-0009]] K3; pilot limitations notice item 6): a single operator could hand two verifiers two
  different lists; the public log deters this but cannot make it impossible. Having several independent writers put the same
  list digest on the chain is the first step towards closing this gap — and it only has value if the second writer is truly
  independent.
- The personal-data boundary does not change: no credential, credential digest or person is written to the chain
  ([[PM-TRUST-0001]], [[SPEC-BC-0001]]/DP1, [[SPEC-TRUST-0001]]/TL11).

# Proposed decision

## K1 — Projection principle

The chain is a **projection** of the signed trust lists and the anchor log; it is not the source. Until the phase 0 acceptance
(replay + equivalence, [[ADR-0009]] K7):

1. The verification pipeline (A–E) and `TrustSource` read only from the signed lists; the chain is **required** at no step.
2. The chain's answer is three-valued: `YES` (a confirmed anchor equals the list's digest), `NO` (a confirmed **different**
   digest exists for the same version — a double-speak signal), `UNKNOWN` (flag off, chain unreachable or no anchor yet).
   `UNKNOWN` never worsens a result; `NO` does not change the verification result, it raises an operator alarm and goes into the
   transparency report.
3. On conflict the signed list prevails; the chain record is not corrected, a new version is written next to it (no deletion).

## K2 — What is written to the chain

A new contract, the **trust list anchor registry** (proposed name `TrustListAnchorRegistry`; the name is subject to project
management approval), holds two kinds of record and nothing else:

| Record | Fields | Source |
|---|---|---|
| List version | `listKey = keccak256("tamga:trust-list:<environment>:<file>")` (e.g. `production:lotl`, `production:tl-tr`), `version`, `contentHash = sha256(<file>.jws)` (= the next version's `previous_version_hash`), `previousHash`, `issuedAt` | `lotl.jws`, `tl-<cc>.jws` ([[SPEC-TRUST-0001]] §3–§4) |
| Anchor log head | `logKey = keccak256("tamga:anchors:<environment>")`, `seq`, `lineHash = sha256(line JWS)`, `ts` | last line of `anchors.jsonl` ([[SPEC-TRUST-0001]] §5); the line chain binds the whole log |

All fields are `bytes32` and integers; the contract has no `string`/`bytes` field. List content, issuer/verifier/schema records,
credentials, credential digests or personal data are **not written** (DP1, TL11). The existing eight contracts
([[SPEC-BC-0001]] §1–§7, §11) are unchanged; writing to them is the phase 0 replay.

## K3 — Who writes: thresholded writers

- Write permission belongs to **anchorer** addresses; the set and the confirmation threshold are managed by the `governance`
  address (the Governance proxy in phase 0; the deploying account in today's dev deployment).
- A `(listKey, version)` or `(logKey, seq)` anchor becomes **confirmed** once **threshold-many distinct writers** have submitted
  exactly the same data. An unconfirmed anchor never yields `YES`. In production the threshold is **≥ 2**: a single operator
  cannot produce a confirmed anchor — the contract counterpart of [[ADR-0009]] K4 ("second independent operator"). On the
  development network the threshold is 1.
- A writer submitting a **different digest** for an already opened version is rejected (`AnchorMismatch`); the event is a
  double-speak signal and is tracked from the events. The version per list increases monotonically; a confirmed record is never
  changed (append only, no deletion).

## K4 — When it is written; the flag

- The list publisher (`apps/trust-publisher`) reads its own `dist/` output with the `chain-anchor` command, first verifies it with
  the loader (signature, hash chain, freshness — an unhealthy set is not anchored), then submits only the digests: after every
  list publication and every hourly anchor line (heartbeat cadence). If the chain already has the same version with the same
  digest it skips; if a different digest exists it does not write and reports `CONFLICT` (K1.3).
- The feature flag `TAMGA_CHAIN_ENABLED` defaults to `0`: while off, no chain connection is opened and nothing is written.
  `--dry-run` prints what would be anchored without connecting. The writer key and the RPC address come from the environment /
  `.env`; the repository holds placeholders.
- In production the flag is **not switched on** without the second operator and a threshold ≥ 2.

## K5 — How a verifier uses it

`chain-check`: computes the digest of the signed list (`.jws`) it holds, compares it with the confirmed anchor on the chain and
returns the three-valued answer of K1.2. It is extra assurance; it is not a mandatory step and never will be. Wiring it into the
verifier application (a line on the health page) is separate work once the flag is on.

## K6 — Toolchain and transition

- The contracts compile and are tested with **Hardhat** (TypeScript tests); Foundry was removed (same language as the repository's
  tooling; forge is not available on the development machines). The local development chain is the Hardhat node; a Besu/QBFT
  single-validator development network (Docker) is separate work.
- The move to phase 0 is [[ADR-0009]] K7 and is unchanged by this ADR: the list archive is replayed into the contracts and the
  equivalence test passes; the trust list anchor registry keeps working after that day (lists are still published in phase 0 —
  as the chain's projection, [[ARCH-0003]] SEV1).

# Options considered

| Option | Outcome | Why |
|---|---|---|
| Write nothing; compile + test only | rejected | Does not tie the code to the design; contrary to the "integrate it" direction |
| Replay the list content into the contracts now (phase 0 replay instead of K2) | deferred | Needs the states' delegate keys, validators and a governance vote; a single operator replaying into its own chain produces no trust (ADR-0009 F1). The replay tool remains phase 0 work |
| Anchor every line of the anchor log separately | rejected (the head suffices) | Lines are hash-chained; the digest of the last line binds the whole log. The hourly cadence stays the same |
| Write digests to a public chain (L2) | rejected | D-BC-0 Besu/QBFT is fixed ([[ADR-0001]]); sovereignty and the personal-data boundary cannot be enforced on an external chain |
| Single writer, no threshold | rejected | A single operator's chain yields no more trust than a signed list (ADR-0009 F1); a threshold ≥ 2 carries the gate into code |
| Also anchor status list and schema digests separately | rejected (for now) | The existing `StatusListRegistry`/`SchemaRegistry` do that in phase 0; today the anchor log head binds all of them |

# Proposed rules (moved to the binding table if accepted)

| Code | Rule |
|---|---|
| CH1 | The chain is a projection of the signed lists and the anchor log; on conflict the signed list prevails; the chain's answer is not required for verification and `UNKNOWN` never worsens a result. |
| CH2 | Only the digest of a list version and of an anchor log line (hash, version/sequence, time) is written to the trust list anchor registry; no list content, record, credential, credential digest or personal data. |
| CH3 | An anchor is confirmed only once threshold-many distinct authorised writers have submitted exactly the same data; in production the threshold is at least 2. |
| CH4 | The version per list increases monotonically; a different digest for an opened version is rejected and tracked as a double-speak signal; a confirmed record is neither deleted nor changed. |
| CH5 | While `TAMGA_CHAIN_ENABLED` is off, nothing connects to or writes to the chain; in production the flag is not switched on without a second independent operator and a threshold ≥ 2. |

# Consequences

- `contracts/src/anchor/TrustListAnchorRegistry.sol` + tests; `contracts/` Hardhat project; the dev deployment also sets up the
  registry.
- `apps/trust-publisher`: `chain-anchor` (projection, flag, dry run) and `chain-check` (verifier side); ABI copy in
  `src/chain/abi/` (exported from the contract build; `contracts:check` catches drift).
- [[SPEC-BC-0001]] §15 (marked as proposed) and the [[SPEC-TRUST-0001]] §7 row; [[FW-ARF-0001]] §8.1 status note ("code ready,
  off in production"). On acceptance, DECISIONS **D-BC-7**; version notes.
- Unchanged decisions: D-BC-0 (Besu/QBFT), D-BC-6 (chain threshold), D-TRUST-0, D-REV-1/2, D-SCHEMA-1, the [[ADR-0009]] K7
  transition.

# Open points (awaiting decision)

1. Contract and command names (`TrustListAnchorRegistry`, `chain-anchor`, `chain-check`).
2. The exact production threshold (proposal 2) and who the second writer will be — together with the second-operator candidate.
3. A generic "execute call" proposal in `Governance`, so that the writer set/threshold and `CrossRecognition.bootstrapFounders`
   can be managed through Governance (today both can only be called directly from the `governance` address; the Governance
   contract cannot do that).
4. A Besu/QBFT single-validator development network (Docker) and `ChainTrustSource` + indexer (the phase 0 read path).
5. Moving `contracts/` into the public repository (today in `.publicignore`).

# Status

**Proposed — 2026-10-17.** Prepared on project management's direction of 2026-10-17 ("the chain code is written now, integrated
with the chainless design, off in production"); acceptance rests with project management. If accepted, DECISIONS: D-BC-7.
