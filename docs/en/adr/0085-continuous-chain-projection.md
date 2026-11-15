---
document_id: ADR-0085
title: "Continuous projection to the chain"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-15
last_updated: 2026-11-15
summary: >
  Sets how every change in the signed lists reaches the chain after the migration window has closed. After every list publication
  and every anchor line, the publisher turns the difference between the last projected list and the current list (an issuer added,
  a status change, an authorisation window, a status list version, a key change, a network-level record…) into chain operations
  using the same mapping as the migration, and writes them. The chain date is the block time; the lag between the list date and the
  chain date is not counted as an equivalence difference, and raises an alarm beyond two hours. Intermediate states within one run
  are merged; a future-dated record is written once its time has come. Network-level records go through Governance votes. If a chain
  write fails, list publication does not stop; the difference is retried on the next run and an alarm is raised. Writes happen only
  with the flag on, after the migration, and only to a local or test chain; there is no write path to the real network. Accepted
  (2026-11-15).
domain: Trust
related: ["[[ADR-0009]]", "[[ADR-0051]]", "[[ADR-0053]]", "[[ADR-0054]]", "[[ADR-0055]]", "[[ADR-0073]]", "[[ADR-0074]]", "[[ADR-0075]]", "[[ADR-0084]]", "[[SPEC-BC-0001]]", "[[SPEC-TRUST-0001]]"]
translation_of: ADR-0085
source_version: 1.0.0
---

# In short

If the chain is the list's witness ([[ADR-0084]]), every change in the list must also show on the chain. Until now the list's history
could reach the chain only once, during the migration; afterwards a new issuer, a suspension or a key change did not go to the chain.
This decision sets up a synchronisation run after every publication: the previous list is compared with the new one and the difference
is written to the chain. The chain may fall behind or fail to write in this job; in that case the list is still published, the
synchronisation is retried later and the operator is warned.

# Context

- [[ADR-0074]] PJ1: every record in the lists that affects a trust decision maps to a record on the chain. [[ADR-0073]]: the list
  history is written to the chain once, in a migration window that stays open for at most 30 days, with the list's dates; once the
  window closes the date is the block time (CE1). [[ADR-0051]] K4: list digests (`chain-submit`) are written after every
  publication — but this job was not tied to a scheduler.
- Finding of the chain layer audit (2026-11-15): there was no tool writing the changes after the window closed to the chain. That is
  why the trust source reading the chain was bound to the content level, so that it would not look "healthy" with a chain standing
  still ([[ADR-0074]] K5 note). The tool's design needed answers to four questions: the date difference, the voting flow of
  network-level records, the write quota, and future-dated records.
- **Project management's direction (2026-11-15):** the chain code should move forward and the structure be built so that no process
  from scratch is needed on the day of the move; in today's EU model no chain-related process runs ([[ADR-0084]]). This decision
  implements that direction: the tool is written and stays switched off.

# Decision

## K1 — The difference: with the migration's mapping

After every list publication (new list version) and every anchor line (hourly line, status list line) the publisher performs a
synchronisation run. The run builds, with the same plan engine, the plan of the signed list archive at the last projected point and
the plan of the current archive, and writes **the operations that are in the current plan but not in the previous one**. The plan
engine is the migration's engine ([[ADR-0073]] K1, `trust:chain-replay`): a record's chain counterpart cannot differ between the
migration and continuous projection. The difference covers all the records of [[ADR-0074]] PJ1: root certificate, issuer
(registration, status, hard revocation, validity extension, registration data, schema authorisation windows, successor), schema and
version digests, relying party (registration, status, certificate, scope, terminal group, registration data, reassignment and
re-registration), recognition, status list registration and version, network-level records (wallet provider and its keys, ZK
circuit, external list, credential category, list signer, operator, slot, catalogue). No personal data or free text goes to the chain
(PJ2); the sandbox is not written to the real chain (PJ4).

## K2 — Date: block time; lag is not counted as a difference

- Outside the migration window the chain date is the block time ([[ADR-0073]] CE1): status, registration and authorisation writes are
  made without a date; even if a past moment is written in the list, the chain does not write that moment. The two fields the contract
  accepts a past date for outside the window too are written with the list's moment: hard revocation (`invalidatesFrom`, CE2) and the
  publication moment of a status list.
- The interval between the moment in the list and the moment of the chain write is the **projection lag**. The continuous equivalence
  test does not ask about moments in that interval (a credential's `iat`, a relying party's status at a past moment); for every
  question outside the interval the list and the chain must give the same answer. Moments that have not yet come are not asked
  either (a credential's `iat` is in the past).
- Lag is measured from publication to chain, not from the list date to publication, and its target is one hour (the hourly anchor
  cadence). **A lag above two hours raises an alarm.** Because the chain makes no decision ([[ADR-0084]] LS2), lag does not change any
  credential's verification.

## K3 — Merging and pending work

- Intermediate states falling on the same record in the same run (suspension and reinstatement, opening and closing of the same
  authorisation window, two versions of registration data, several versions of the same status list) would be zero-length windows at
  the same block time; only the **final state** is written. The interval of an intermediate state that never existed on the chain is
  also a lag interval (K2).
- A future-dated record (e.g. the end of a schema authorisation) cannot be written to the chain today (`DateInFuture`). The run's plan
  time is the run itself; a record whose time has not come is not written in this run, and appears in the difference — and is written
  — in the first run after its time has come, even if no new list version is published, after the hourly line. No separate queue file
  is kept; pending work derives from the plan itself.

## K4 — Network-level records through Governance votes

Network-level records and network schemas ([[ADR-0074]] PJ3) are written outside the window only through Governance votes: the run
stages the record and opens the typed proposal; the proposal proceeds with the other operators' votes ([[ADR-0055]]). The tool does not
bypass the vote. A record awaiting a vote is reported and makes the run "incomplete"; it does not hold back writing national records.
Relying party reassignment and re-registration after revocation take the same route ([[ADR-0075]]).

## K5 — A failed write does not stop the list; the difference is retried

- A chain write error (chain unreachable, transaction reverted, quota full, vote pending) does not stop list publication and does not
  change the result of the publication command ([[ADR-0084]] LS4); it raises an alarm.
- Only a **complete** run (the whole difference written) advances the projection point. After an incomplete run the point stays put;
  the same difference is retried on the next run. Execution resumes where it left off: before every operation the final state on the
  chain is checked and what is already written is skipped; if the same difference were executed twice, the second execution writes
  nothing.
- The projection point (last projected list versions, anchor line, plan time) is kept in a state file in the publisher's output
  folder; it is not written to the chain separately (no contract change). The content level of the trust source reading the chain
  comes from this point.

## K6 — Write budget and quota

A run writes at most a set number of operations (default 500); the rest is left for the next run and the run counts as incomplete.
Because merging (K3) writes at most one publication per status list per run, the daily publication cap per list ([[ADR-0054]] NS3:
48) is not exceeded at the hourly cadence. If the quota still fills up the operation reverts, the run counts as incomplete and the
difference is retried on the next run (K5).

## K7 — When it runs, where it writes

- Only while `TAMGA_CHAIN_ENABLED=1`. With the flag off, synchronisation and the post-publication hook do nothing: no connection to the
  chain, no file written, no output ([[ADR-0051]] CH5).
- The starting point is the migration: the migration finishes without differences ([[ADR-0073]] CE6) and writes the point; without a
  point, synchronisation does not write. While the migration window is open or has never been opened, synchronisation does not write
  (writing in an open window belongs to the migration).
- The same hook also submits the list digests after synchronisation (`chain-submit`, [[ADR-0051]] K4); the two do not wait for each
  other, and if one fails the other is still attempted.
- Writes go only to the local development chain and to a test chain. **There is no write path to the real network:** until the real
  network's key path (hardware key vault) and the conditions of [[ADR-0084]] LS6 are decided, the tool only prints the plan on the real
  network.

# Decisions on the open questions (2026-11-15)

1. **Date difference:** chain date is block time; the lag interval is not asked about in equivalence; target one hour, alarm at two
   hours (K2).
2. **Network-level records:** through Governance proposals; the tool opens the proposal, the vote belongs to the operators; national
   records are not held back (K4).
3. **Quota:** write budget per run; one publication per status list per run; when the quota is full, the next run (K6).
4. **Future-dated records:** in the first run once their time has come, without a separate queue (K3).
5. **Publishing the projection level:** no new field is written to the chain; the level is in the state file and the run report (K5).
6. **Independent writer mode** (the second operator downloading the list from the public address, verifying it itself and casting its
   own vote): outside this decision; separate work together with the second operator.

# Rationale / alternatives

| Option | Result | Why |
|---|---|---|
| **Difference = plan(now) − plan(before), with the migration's plan engine** | **chosen** | One mapping; migration and continuous projection write the same record the same way; the plan is pure and deterministic, testable without a network |
| Writing a separate "change → operation" mapping | rejected | A second mapping can diverge from the migration; equivalence must be proven twice |
| Writing the list's date to the chain (outside the window too) | rejected | [[ADR-0073]] CE1: if a delegate key is compromised, history is silently rewritten; because the chain makes no decision, the lag is harmless |
| Writing all intermediate states | rejected | Zero-length windows at the same block time; waste of operations and quota; does not reduce the difference with the list |
| Stopping list publication when a write fails | rejected | [[ADR-0084]] LS4: the source does not stop because of the witness |
| Writing the projection level to the chain (new contract field) | rejected (for now) | Not needed because the chain makes no decision; cost of a contract change and an upgrade |
| Writing network-level records with the migration executor outside the window too | rejected | [[ADR-0074]] PJ3; a single key writing network records defeats the second-operator gate |

# Invariants

| Code | Rule |
|---|---|
| SP1 | After the migration window closes, after every list publication and anchor line the difference between the last projected point and the current list is turned into chain operations with the migration's plan engine; the difference covers all trust records in the lists and contains no personal data or free text. |
| SP2 | Outside the window the chain date is the block time (except hard revocation and status list publication moment); the interval between list date and chain date is not asked about in equivalence; a lag from publication to chain above two hours raises an alarm. |
| SP3 | Of the intermediate states falling on the same record in the same run, only the final state is written; a future-dated record is written in the first run after its time has come. |
| SP4 | Network-level records and network schemas are written outside the window only through Governance votes; the tool does not bypass the vote; a record awaiting a vote does not hold back national records. |
| SP5 | A chain write error does not stop list publication and does not change the result of the publication command; it raises an alarm. Only a complete run advances the projection point; the difference of an incomplete run is retried on the next run; execution resumes where it left off by checking the final state on the chain. |
| SP6 | A run does not exceed the write budget and writes at most one publication per status list; the rest is left for the next run. |
| SP7 | Continuous projection runs only while `TAMGA_CHAIN_ENABLED=1`, after the migration has finished without differences and the migration window has closed; with the flag off it does nothing. Writes go only to the local development and test chains; no write path to the real network is built until the real network's key path and the conditions of [[ADR-0084]] LS6 are decided. |

# Consequences

- `apps/trust-publisher`: pure planner (`planChainSync`), the synchronisation command and the post-publication hook (after the build,
  heartbeat and anchor commands; no effect with the flag off). The migration command writes the starting point when it finishes
  without differences.
- `apps/chain-indexer`: executor outside the window (block time, final-state check, Governance route, budget); optional plan time for
  the plan engine; lag intervals for the equivalence test.
- Tests: planner and hook without a network; continuous equivalence on the local chain (migration → issuer added, suspension,
  revocation, merging, key change, future-dated work; list = chain at every step).
- No contract change. The chain stays off in production ([[ADR-0009]] K4, [[ADR-0084]] LS6).
- The command and state file names await project management's approval (proposed names in the code).

# Status

**Accepted — 2026-11-15.** With project management's approval (2026-11-15; implementation of the same decision as [[ADR-0084]]).
DECISIONS: D-BC-18. SP1–SP7 are binding.
