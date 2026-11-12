---
document_id: ADR-0073
title: "Making chain–list equivalence achievable: migration mode, hard revocation, schema versions, relying party identity, status mapping"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-04
last_updated: 2026-11-12
summary: >
  ADR-0009 K7 ties the move from signed lists to the chain to a replay of the list history into the contracts and an equivalence
  test. With today's contracts that history cannot be replayed faithfully: dates come from block time, there is no hard
  revocation, a schema has a single content digest, the relying party identity is bound to its certificate and cannot return from
  suspension, the status sets and boundaries differ, and daily quotas stop bulk writing. Decision: a one-time migration mode in
  every registry contract, opened once by Governance and never reopened after it closes (past dates only up to block time, no
  quotas); hard revocation via `invalidatesFrom`; schema version digests as an append-only array; `rpId = keccak256(dns_name)`,
  certificate update, return from suspension and fine-grained scopes (as digests); a status mapping table and evaluation by the
  status at the credential's `iat` with half-open intervals. The replay command is `trust:chain-replay`. Accepted
  (2026-11-04): credentials a suspended issuer issued before the suspension stay valid; the migration window is at most 30 days.
domain: Trust
related: ["[[ADR-0009]]", "[[ADR-0010]]", "[[ADR-0015]]", "[[ADR-0029]]", "[[ADR-0034]]", "[[ADR-0046]]", "[[ADR-0051]]", "[[ADR-0053]]", "[[ADR-0054]]", "[[ADR-0055]]", "[[ADR-0063]]", "[[ADR-0074]]", "[[SPEC-BC-0001]]", "[[SPEC-TRUST-0001]]"]
translation_of: ADR-0073
source_version: 1.0.0
---

# In short

When the chain is switched on, the full history of the lists will be copied into the contracts once, and the chain will not go
live until it is shown to give the same answer as the lists to every question ([[ADR-0009]] K7). Today's contracts cannot do that
copy: they cannot write past dates, cannot say "compromised — ignore everything after this date", do not know several versions of
one schema, treat a relying party as someone new when its certificate is renewed, and count statuses differently from the lists.
This proposal adds those abilities to the contracts and allows history to be written only once, in a controlled window.

# Context

- [[ADR-0009]] K7: the move is a replay of the list version archive into contract calls plus an equivalence test; for every recorded
  `(issuer_id, schema_id, iat, list_id, version)` query, `TrustSource(list)` and `TrustSource(chain)` must give the same C1/C2/C3/D5
  answer; an ACCEPTED/REJECTED difference means the move is not complete ([[SPEC-TRUST-0001]]/TL10).
- [[ADR-0051]] made the chain a projection of the signed lists and today anchors only list digests; writing to the registry
  contracts was left to the phase 0 replay. The scope of the projection is in [[ADR-0074]].
- On 2026-11-04 the contracts, the list format and `TrustSource` were compared. Differences that block the replay or equivalence:

| Gap | List today | Contract today | Result |
|---|---|---|---|
| F1 Dates | `status_history[].since`, `valid_from`, schema authorisation `valid_from`/`valid_until`, `registered_at` in the signed list | `revokedAt`, authorisation window `since`/`until`, `registeredAt` = `block.timestamp` | History takes the date of the replay day; old credentials are rejected in C1/C2 |
| F2 Hard revocation | `REVOKED` + `invalidates_from`: credentials issued after that moment fail | Soft revocation only (`revokedAt`) | Later credentials of a compromised issuer are accepted on chain |
| F3 Schema versions | `content_hash` + `content_hashes` ([[ADR-0010]] K4) | One `contentHash`, never written again (SC1) | Credentials issued with an older version fail the integrity check on chain |
| F4 Relying party | Permanent identity `dns_name` ([[ADR-0034]] CI3/CI4); certificate renewed; return from suspension; scope = type, element paths, format, namespace, service id, validity | `rpId = keccak256(state ‖ certificate digest)`, certificate fixed, no return from suspension, coarse `bytes32` scopes | A certificate renewal creates a new relying party; fine scopes and over-asking checks are impossible on chain |
| F5 Statuses | 8 values (`ACTIVE`, `SUSPENDED`, `REVOKED`, `RETIRED`, `ROLLING_OVER`, `RESERVED`, `PROVISIONAL`, `DEPRECATED`); C1/C2 look at the status at the credential's `iat`; a change applies from its `since` | 4–5-valued enums; C1 looks at the current status (all credentials of a suspended issuer rejected, later credentials of a retired root accepted); closed boundaries (`iat <= revokedAt`, `iat <= until`) | Different answers to the same question; a one-second difference at the boundary |
| F10 Quotas | — | Daily writes per state, 48 publications per list per day, 8 list registrations per issuer per day ([[ADR-0054]]/NS3) | History accumulated over months takes days or weeks, or never finishes |

  The sandbox anchor log that is reset every night (F9) and records that exist in the lists but have no counterpart on chain
  (F6–F8) are in [[ADR-0074]].
- **Project management direction (2026-11-04):** chain scope "everything on chain"; for moving history, propose a one-time
  migration mode, hard revocation, append-only schema version digests and a permanent relying party identity. The replay command
  name is approved: `trust:chain-replay`.

# Decision

## K1 — One-time migration mode (F1, F10)

- Every registry contract (`RootCARegistry`, `IssuerRegistry`, `SchemaRegistry`, `RelyingPartyRegistry`, `StatusListRegistry`,
  `CrossRecognition` and the network-level registry of [[ADR-0074]]) carries a three-stage migration state: **not started → open →
  closed**. Transitions only go forward; there is no way back from "closed" and no upgrade can reset this state ([[ADR-0055]] GE2:
  an upgrade only calls a parameterless initialiser selector).
- **Governance** opens the mode **once** through a typed proposal (2/3, [[ADR-0055]]). The proposal carries the digest of the
  replay plan (`replayPlanHash` = SHA-256 of the plan generated deterministically from the public archive); anyone can regenerate
  the plan from the archive and compare it with the events on chain. Closing is also a Governance proposal and rests on the
  equivalence report in K6.
- **The window is at most 30 days** (counted from opening). Governance may extend it only while the mode is open and within this
  cap. When the time runs out the mode counts as **closed** by itself; this closing is final too.
- While the mode is open, writes that carry a date take it **explicitly** (moment of a status change, authorisation window, start of
  validity, registration time, status list publication time). Rules: no date may be later than `block.timestamp`; a record's history
  is written in time order (a date earlier than the previous one is rejected); written history does not change.
- Who writes: national records still through that state's delegate keys (sovereignty and [[SPEC-BC-0001]]/N1 unchanged);
  network-level records (network schemas, [[ADR-0074]] K3) through the **migration executor** address authorised by the opening
  proposal — **a single migration executor**, no separate Governance vote per record — and only while the mode is open.
- The replay starts from the **first archived version** of the production archive.
- While the mode is open, the daily quotas of [[ADR-0054]]/NS3 are **not applied** (F10); when it closes, the quotas return as before.
- While the mode is not open (not started or closed) today's rule holds: dates are `block.timestamp`. The only exception is the
  hard revocation date in K2.
- The replay command **`trust:chain-replay`** (`apps/trust-publisher`) verifies the production archive (`archive/` list versions,
  anchor log archives and checkpoints) and produces the deterministic plan and its digest; the default `--dry-run` only prints the
  plan. Writing happens with `TAMGA_CHAIN_ENABLED` on and the migration mode open; the command resumes where it stopped (skips what
  is already on chain) and runs the K6 test at the end.

**The window closes regardless of equivalence (note 2026-11-11).** The contract does not know the equivalence report: when the
time is up the mode closes — even if the replay is unfinished or the K6 test found a difference — and it can never be opened again.
History that is missing or wrong in a closed mode cannot be corrected; the only way is to **redeploy** the contracts and replay from
the start. Therefore: the window is opened only as **short** as the work needs (the replay is timed beforehand on a trial chain),
the K6 test is run before the deadline, and once it passes without a difference the mode is **closed early** by a Governance
proposal instead of waiting; if the test finds a difference it is fixed while the mode is open, or the deployment is treated as
void. An open window is the time during which the executor key can write dated history; it is not kept open longer than needed.

## K2 — Hard revocation: `invalidatesFrom` (F2)

> Clarification (2026-11-11): `invalidatesFrom` is written only for a revoked (`REVOKED`) issuer and does not undo the revocation;
> it only narrows the set of accepted credentials. It is the single field that accepts a past date outside the migration mode. The
> schema record's validity start also accepted a past date outside the mode until this date; it now goes through the same rule as
> the other records, which makes the "single field" statement below true.

- The issuer record carries `invalidatesFrom` (0 = none). A compromise revocation writes this date; condition: `validFrom ≤
  invalidatesFrom ≤ revokedAt`. The date may be in the past (compromise is discovered later); it is the only field that can carry a
  past date outside the migration mode, and it is bounded by the issuer's own validity.
- C1: a credential with `iat ≥ invalidatesFrom` fails (in the list `invalidates_from ≤ iat` → NO, today's `TrustSource` rule).
- Once written, the date is never removed; it can only be moved earlier (the revocation widens, never narrows).
- Revoking a root CA already invalidates everything beneath it (CA2); unchanged.

## K3 — Schema version digests as an append-only array (F3)

- The schema record keeps its first `contentHash` and also carries an append-only array of version digests. A new version digest
  is added by the state for a national schema and by a Governance proposal (in the migration mode, by the migration executor) for a
  network schema. `matchesContentHash` matches any digest in the array; a `REVOKED` schema matches none.
- The list format is SRI (`sha256-<base64>`); on chain the same SHA-256 bytes are written as `bytes32`.
- [[SPEC-BC-0001]] SC1 narrows to: "`vctURI` and every written content digest are never updated or removed; a new version digest may
  be added." Published schema metadata still never changes (D1); this is the chain counterpart of [[ADR-0010]] K4.

## K4 — Relying party identity, certificate, return from suspension, fine scopes (F4)

- **Identity:** `rpId = keccak256(utf8(dns_name))`. It does not change when the certificate is renewed ([[ADR-0034]] CI3/CI4). The
  ABI carries no domain name text; the registrar computes the digest and the indexer and the K6 test check the formula. The contract
  still records the state code for sovereignty. Because identifiers follow the chain formula, the list's `rp_id` moves to the same
  formula; today's embedded disclosure policies ([[ADR-0046]]) are rewritten under the
  development-phase rule ([[ADR-0029]]).
- **Certificate:** the access certificate fingerprint can be updated; the old and new fingerprints are emitted in an event and the
  history stays. A fingerprint belongs to only one relying party at a time.
- **Return from suspension:** `SUSPENDED → ACTIVE` is added (as for issuers and root CAs). `REVOKED` is final.
- **Fine scope:** every use is a scope record; free text as a digest:

| List field | On chain |
|---|---|
| `scope_id` | `keccak256(scope_id)` |
| `service_id` (else `scope_id`) | `keccak256(service_id)` |
| `vct` | `schemaId = keccak256(vct)` |
| `format` | closed set, in order: `dc+sd-jwt`, `mso_mdoc`, `mso_mdoc_zk` (append only) |
| `mdoc_namespace` | `keccak256(mdoc_namespace)` or 0 |
| `claims[]` | sorted array of element path digests (`keccak256(utf8(path))`) |
| `valid_from`, `valid_until` | date interval (explicit date in the migration mode) |
| `purpose`, `purpose_localized`, `privacy_policy_uri` | one detail digest (SHA-256 of the scope entry's canonical JSON) |

  Read: "may this relying party, in this service, for this type, in this format, request this element now". ABI field names are
  chosen so they do not collide with the forbidden roots of the personal data check (`claim`, `credential`, `holder`…), e.g.
  "element"/`attribute`. The coarse `allowedScopes` goes away; this closes [[SPEC-BC-0001]] §14 open issue 3.

## K5 — Status mapping and the status at `iat` (F5)

- The contract evaluates C1/C2/C3 by the status at the credential's `iat`: issuer, root CA and schema status are kept as append-only
  status windows (schema authorisation history already works this way). Intervals are **half-open**: a change applies from its start
  moment, `[start, end)`. The boundaries `iat <= revokedAt` and `iat <= until` thereby match the list (`iat < …`).
- Mapping:

| List status | Root CA | Issuer | Schema | Relying party | Note |
|---|---|---|---|---|---|
| `ACTIVE` | `ACTIVE` | `ACTIVE` | `ACTIVE` | `ACTIVE` | |
| `ROLLING_OVER` | `ACTIVE` + successor event | — | — | — | The list treats it as active in C1 |
| `SUSPENDED` | `SUSPENDED` | `SUSPENDED` | — | `SUSPENDED` | Only credentials issued during the suspension fail; those issued before stay valid (list rule) |
| `RETIRED` | `RETIRED` | `REVOKED`, soft (`revokedAt` = `since`) | — | `REVOKED` | Earlier credentials stay valid (GV1) |
| `REVOKED` | `REVOKED` | `REVOKED`; K2 if `invalidates_from` | `REVOKED` | `REVOKED` | |
| `DEPRECATED` | — | — | `DEPRECATED` | — | SC3 |
| `RESERVED`, `PROVISIONAL` | no record written | no record written | no record written | no record written | Empty slot; slot status in [[ADR-0074]] K3 |

  "—" is a value the list does not use for that record type; the publisher does not publish it and the replay stops if it sees it.
- No values are added to the contract enums; where the distinction matters, the list status travels in the event.

## K6 — Equivalence test and closing the migration

- At the end, `trust:chain-replay` compares the two sources on the same query set: `conformance/vectors/trust` plus every recorded
  `(issuer_id, schema_id, iat, list_id, version)` for every list version in the archive; also boundary moments (`since − 1`,
  `since`, `since + 1`) and scope queries. The read side is the `ChainTrustSource` of [[ADR-0074]] K5.
- Acceptance: no ACCEPTED/REJECTED difference in the C1/C2/C3/D5 answers. If there is one, the migration does not close; the report
  goes into the public transparency report.
- After closing, the chain is still a projection ([[ADR-0051]] CH1); whether phase 0 makes the chain the source is a separate decision.

# Rationale / alternatives

| Option | Result | Why |
|---|---|---|
| Contracts always accept explicit dates | rejected | If a delegate key is compromised, history is silently rewritten; dates can be trusted only in a controlled, one-time window |
| Do not replay history; the chain starts on the day it opens | rejected | Old credentials are rejected on chain; [[ADR-0009]] K7 and TL10 are not met |
| A separate "history" contract for the migration, then a move | rejected | Two sources, two read paths; equivalence proven twice |
| Raise the quotas during the migration (instead of lifting them) | rejected | The size of history is not known in advance; the window is one-time and Governance-approved, so quota protection is not needed |
| A new `schemaId` for every schema version | rejected | Breaks the `schema_id = keccak256(vct)` formula; the major version is in the `vct`, minor versions in the digest array ([[ADR-0010]]) |
| Keep `rpId` bound to the certificate and keep a mapping table | rejected | Pseudonyms, copy separation and the disclosure policy are already bound to `dns_name` ([[ADR-0034]] CI4); two identities mean two truths |
| One digest for all element paths in a scope | rejected | "May this element be requested" cannot be asked on chain; a digest per element enables the over-asking check |
| Leave the contract's C1 on the current status | rejected | Different answer from the list; the [[ADR-0009]] K7 test does not pass |

# Invariants

| Code | Rule |
|---|---|
| CE1 | The migration mode is opened once in every registry contract by a Governance proposal; the window is at most 30 days and closes by itself when the time runs out; once closed it cannot be reopened by any path (including upgrade). While it is open past dates may be written, but no date may be later than block time, the order per record is kept and the daily quotas are not applied; while it is not open, dates are block time (except CE2). |
| CE2 | The hard revocation date (`invalidatesFrom`) lies between the issuer's start of validity and the revocation moment; once written it is not removed and can only be moved earlier; a credential whose `iat` is equal to or later than this date is not accepted. |
| CE3 | A schema's `vctURI` and every written content digest are never changed or removed; a new version digest is only appended. |
| CE4 | A relying party's chain and list identity is `keccak256(dns_name)`; renewing the access certificate does not change the identity. |
| CE5 | The contract evaluates C1/C2/C3 by the status at the credential's `iat`, with half-open intervals (credentials a suspended issuer issued before the suspension stay valid); list statuses are written to the contract by the mapping table. |
| CE6 | The migration does not close until the `trust:chain-replay` equivalence test shows no ACCEPTED/REJECTED difference in the C1/C2/C3/D5 answers. |

# Decisions on the open questions (2026-11-04)

1. **Old credentials of a suspended issuer:** the list rule. A credential issued before the suspension is valid; only credentials
   issued during the suspension fail (K5). [[SPEC-BC-0001]] §3.3 follows this.
2. **Network-level writes in the migration:** a single migration executor authorised by the opening proposal writes them (K1).
3. **Migration time cap:** at most 30 days; Governance extends only while the mode is open and within the cap; when the time runs out
   the mode counts as closed by itself (K1, CE1).
4. **The list's `rp_id`:** becomes `keccak256(dns_name)` (K4); today's embedded disclosure policies are rewritten ([[ADR-0029]]).
5. **Start of the replay:** the first archived version of the production archive (K1).
6. Caps for scopes and element arrays are set with an initial value in the implementation and reviewed with field data.

# Consequences

- Contracts (together with [[ADR-0074]]): migration state and Governance proposals; status windows and half-open
  boundaries for issuers, root CAs and schemas; `invalidatesFrom`; schema version digests; relying party identity, certificate
  update, return from suspension and scope records; the `privacy-abi` test covers the new fields. Struct fields are only appended
  (UUPS storage layout).
- `apps/trust-publisher`: `trust:chain-replay` (plan, digest, dry run, resume, equivalence test); list `rp_id` computation (K4).
- Documents: [[SPEC-BC-0001]] §3.3, §4.4 SC1, §6, §12.2, §13, §14 and [[SPEC-TRUST-0001]] §7 change; the sentence
  "the existing eight contracts do not change" in [[ADR-0051]] K2 is then changed by this ADR and [[ADR-0074]].
- The chain stays off in production ([[ADR-0009]] K4, [[ADR-0051]] CH5); this decision only makes the move possible.

# Implementation note (2026-11-04, contract security round)

The decision is unchanged; with project management's approval the limits in the implementation were made explicit:

- **CE1 "cannot be reopened by any means (including an upgrade)"** is protected in the contracts by three layers: (1) a registry
  contract cannot be upgraded while its migration window is open; (2) Governance compares the target's migration state before and
  after every upgrade and reverts the upgrade if it changed; (3) upgrade review — the repository check (`check-upgrade-safety`)
  verifies the pinned digest of the migration-mode source, the namespace slot, and that no other source touches that slot or writes
  raw storage. The comparison at upgrade time alone is not enough: a new implementation could carry a function that writes the
  migration state later. The limit therefore **also relies on upgrade review**.
- **K1 single migration executor** writes network schema registrations, version digests and deprecations; revoking a network schema
  (which is permanent) is done only by a Governance proposal. Because a revoked schema is rejected for every `iat`, the moment of
  revocation does not change equivalence (CE6).
- **K1 "while the mode is open, dated writes take the date explicitly"** is enforced in the contracts: while the window is open, an
  undated (block-time) ordinary write is rejected except from Governance; an urgent write is made with an explicit date (now). The
  replay and that day's operations therefore do not race silently in the same record's history. The quota exemption (CE1) still
  applies to the whole mode.

# Implementation note (2026-11-12, contract review)

The decision is unchanged. K1's "the date explicitly" rule also covers the **start** of a record: while the window is open, the
start of validity (`validFrom`) cannot be left empty when a root, an issuer or a schema is registered; an undated start is rejected
except from Governance (`DateRequiredDuringMigration`). Before, the registration time could be given explicitly while the start
was left empty: the start silently became the block time, could not be corrected afterwards, and every credential the record had
issued before that moment was rejected (equivalence, CE6, would break for that record); schema registration also let an undated
ordinary write through while the window was open. The replay (`trust:chain-replay`) already writes the start explicitly; with
the window closed the behaviour is the same. [[SPEC-BC-0001]] §16.1.

# Status

**Accepted — 2026-11-04.** With project management's approval (verbatim quote in the private approval record): credentials a
suspended issuer issued before the suspension stay valid; the remaining open questions as proposed. The command name
`trust:chain-replay` is approved. DECISIONS: D-BC-12. CE1–CE6 are binding. Implementation in the contracts is in progress
([[SPEC-BC-0001]] version notes).
