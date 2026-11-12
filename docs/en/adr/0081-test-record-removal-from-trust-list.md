---
document_id: ADR-0081
title: "Removing test records from the list"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-12
last_updated: 2026-11-12
summary: >
  A record is never deleted from the trust list (SPEC-TRUST-0001 TL2): when an institution's record is closed its status changes
  and its history stays in the list. This decision defines a single, narrow exception to the rule: records that were entered for
  testing before institutions joined, that never issued a credential to a real person and never received a real presentation, may
  be removed in the period before the first participant institution enters the list, with the reason written to the public
  changelog. Once the first participant institution enters the list the exception closes; testing is done only in the sandbox.
  The signed list versions that carry the removed records stay in the archive. The exception has been used once (2026-11-11).
domain: Trust
related: ["[[SPEC-TRUST-0001]]", "[[ADR-0009]]", "[[ADR-0038]]", "[[ADR-0041]]"]
translation_of: ADR-0081
source_version: 1.0.0
---

# In short

The trust list works like a register: even when an institution leaves the network its line is not deleted, it is marked as
closed. That way the credentials the institution issued in the past are still assessed correctly today. Before the network
opened to real institutions, a few records were entered in the list for testing. They never issued a credential to a real person;
leaving them in the list misled readers. This decision says that only such test records may be removed, and only until the first
real institution joins. The record of a real institution is never deleted.

# Context

- [[SPEC-TRUST-0001]]/TL2: list versions only increase, every version carries the digest of the previous one, and no line or
  record is deleted; a status change is appended to `status_history`. The reason: verification looks at the status at the moment
  the credential was issued; if an institution's record is deleted, its earlier credentials can no longer be assessed.
- **Fact.** On 2026-11-11 records left over from the test period before institutions joined were removed from the real network's
  national list (list version 241): two issuer records, one relying party record and two terminal groups belonging to two test
  institutions. The records were already `REVOKED` and had never been used by a real institution. The removal was written to the
  public changelog in a line without names; the earlier list versions remain in the archive.
- Until now this exception existed only as a note in SPEC-TRUST-0001 §4; it was not tied to a decision. An exception whose limits
  are not written down can later be cited as a precedent for the record of a real institution.
- There is a separate network for testing ([[ADR-0038]]); institutions open their test institutions there and those records are
  removed there every night ([[ADR-0041]]). There is no longer any need to enter test records in the real network's list.

## The removal path in the publisher (current behaviour)

On every publication the list publisher compares the new list with the **signed** version of the previous publication. If an
issuer, relying party, terminal group, root CA or schema of the previous version is missing from the new list (or a scope, schema
authorization or status history row is missing from a record that stays in the list), **publication stops**. The purpose is that
a record deleted from the source file by mistake does not silently disappear from publication.

The only way for the publication to go through is an approved removal entry written explicitly in the registry
(`removals.json`). The entry carries the list name, the date of the decision, the number of the signed version before the removal (implementation note below), the **counts** of the removed records by kind, and
a short reason. It carries no names or identifiers. If the counts do not exactly match the difference the publisher computes,
publication still stops; the entry lets through only the approved removal and nothing more. When the list is published, the
reason, the counts and the decision date are written to the public changelog as a single line; earlier versions stay in the
archive.

The `--reason` of the status commands (for example `status <slug> REVOKED --reason …`) is for a **status change**, not for a
removal: the record stays in the list and the reason goes into `status_history`. The reason for a removal comes from the approved
removal entry, not from the command line. This check is not applied in the sandbox (test institutions are removed there every
night).

# Decision

- **K1 — The general rule does not change.** The record of a real institution is not deleted. If an institution leaves, closes
  or is removed from the network, the status of its record changes (`SUSPENDED`, `REVOKED`, `RETIRED`) and its history stays in
  the list. The same holds for root CA and schema records.
- **K2 — The exception is narrow: test records only.** A record that may be removed meets **all** of these conditions: (i) it
  was entered for testing, before institutions joined; (ii) it never issued a credential to a real person (if it is an issuer
  record) and never received a real presentation (if it is a relying party record or a terminal group); (iii) the removal is
  done before the first participant institution enters the real network's list. The removal is done by decision of project
  management and its reason is written to the public changelog; the line carries no names or identifiers.
- **K3 — The exception closes by itself.** After the publication in which the first participant institution enters the real
  network's list, no record is removed from the real network's list. Testing is done only in the sandbox; no test record is
  entered in the real network's list. *Participant institution:* an issuer or relying party that was not entered for testing and
  is not a service of the network's own provisional operator.
- **K4 — The archive stays.** The signed list versions that carry the removed records stay in the archive and are not changed.
  The version number and the digest chain are not broken by a removal: the version in which the removal is made also carries the
  digest of the previous one. Anyone can see from the archive in which versions a record was present.
- **K5 — One use so far.** The exception has been used once (2026-11-11, the fact above). This decision ties that use to a record
  and writes down its limits.

# Options considered

| Option | Result | Why |
|---|---|---|
| **Narrow, time-limited exception: test records only, until the first participant institution** | **accepted** | The general rule is not broken; the condition and the end of the exception are written down; the reason is public; the archive stays |
| No exception: test records stay in the list as `REVOKED` forever | rejected | The list is public; records that were never institutions read like participants of the network and mislead. There are no credentials that require the records to be kept |
| Open-ended exception: a test record may be removed at any time | rejected | The boundary of "test record" stretches over time; it keeps the habit of testing in the real network alive. With the sandbox there is no need |
| Leaving the exception as a note in the specification only | rejected | An exception not tied to a decision becomes a precedent; its condition and end stay undefined |

# Invariants

| Code | Rule |
|---|---|
| RR1 | No record is deleted from the real network's trust list: when an issuer, relying party, terminal group, root CA or schema record is closed, its status changes and its history stays in the list ([[SPEC-TRUST-0001]]/TL2). There is no exception for the record of a real institution. |
| RR2 | Only a test record may be removed from the list: a record that was entered for testing before institutions joined, that never issued a credential to a real person and never received a real presentation. The removal is done by decision of project management; its reason, the record counts and the decision date are written to the public changelog in a line that carries no names or identifiers. The publisher does not publish a list with fewer records without an approved removal entry whose counts match exactly. |
| RR3 | The exception closes with the publication in which the first participant institution (an issuer or relying party that was not entered for testing and is not a service of the network's own provisional operator) enters the real network's list; after that no record is removed from the real network's list. Testing is done only in the sandbox; no test record is entered in the real network's list. |
| RR4 | The signed list versions that carry the removed records stay in the archive and are not changed; a removal does not break the version number or the digest chain. |

# Consequences

- The code does not change with this decision: the publisher's check and the approved removal entry, as they are today, cover the
  machine-checked part of RR2 and RR4 (exact counts, a line without names, the archive).
- The publisher cannot know by itself whether a record is a "test record" or whether the first participant institution has
  entered the list; the condition of RR2 and the closing of RR3 are enforced at decision level. After the first participant
  institution enters the list, no new removal entry is written to the real network's registry. Enforcing the closing by machine
  in the publisher is taken up together with the first institution's onboarding.
- **Implementation note (2026-11-12, second review; the decision is unchanged) — a removal entry is bound to one transition.**
  The approved removal entry also carries the version transition it is valid for: the number of the signed list version before
  the removal (`previous_version`, required) and optionally the digest of that version's signed file
  (`previous_version_hash`). The publisher accepts the entry only when the previously published version is that one; once the
  list is published the version moves on and the entry no longer applies. Before, an entry matched on the list name and the
  counts only: it would also have let through a later removal of the same number of **other** records and written the old
  reason to the changelog, so the "only the approved removal" condition of RR2 was not fully machine-checked. The entry of the
  2026-11-11 use is bound to the transition from version 240 to 241. In the same round the machine-checked part of RR1 grew:
  in a record that stays in the list a history row cannot be changed (for example the date from which a revocation invalidates
  credentials cannot be moved forward), a closed schema authorization cannot be reopened, and the removal of a delegate key or
  of a LOTL record (national list entry, wallet provider, external list) is counted too ([[SPEC-TRUST-0001]] version note,
  TL2).
- [[SPEC-TRUST-0001]] §4 and TL2 refer to this decision.
- On the move to the chain ([[ADR-0009]]) the archive versions are replayed in order. The removed test records are present in
  the archive versions; how the replay handles them is checked in the equivalence test ([[SPEC-TRUST-0001]]/TL10).

# Status

**Accepted — 2026-11-12.** Approved by project management (2026-11-12). DECISIONS: D-TRUST-7. RR1–RR4 are binding.
