---
document_id: ADR-0054
title: "On-chain schema namespaces, cross-state references and quota scope"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-19
last_updated: 2026-10-19
summary: >
  Three contract rules are settled. (1) Network and national schema names cannot collide: a national schema's `vct` must use the
  state-specific form of ADR-0010 (`urn:tamga:<cc>:<domain>:<Type>:<major>`, `<cc>` being the lower-case code of the registering
  state); a network schema cannot use that form. A state can therefore not take the name of a network schema that is being voted on
  as its own national schema. (2) An issuer attaches only to a root certificate of its own state and can only name a successor from
  its own state. (3) Quotas: the per-state daily write cap is counted separately in each registry contract; the status list publish
  cap is per list, and new list registrations per issuer per day are limited. SPEC-BC-0001 §2–§4, §7 and §12.2 are updated to these
  rules. Accepted: 2026-10-19.
domain: Trust
related: ["[[ADR-0002]]", "[[ADR-0007]]", "[[ADR-0008]]", "[[ADR-0010]]", "[[ADR-0051]]", "[[SPEC-BC-0001]]", "[[SPEC-SCHEMA-0001]]", "[[SPEC-CRED-0003]]"]
translation_of: ADR-0054
source_version: 1.0.0
---

# In short

Three rule gaps that the security round left open in the chain contracts are closed. Network and state schema names live in
separate namespaces; an issuer cannot attach to another state's root certificate or institution; and what the quota counters count
is the same in the specification and in the code.

# Context

- **Schema name squatting (F-11).** `schemaId = keccak256(vct)` is a single, shared namespace ([[ADR-0010]], [[SPEC-SCHEMA-0001]]
  §5.1). While a network schema is being voted on in Governance, a delegate of any state can register the same `vct` as its own
  national schema; from then on the network schema's execution always fails with `SchemaExists`, and the squatting state owns a
  record that looks like the network schema. [[ADR-0010]] already separates the two namespaces: network type
  `urn:tamga:<domain>:<Type>:<major>`, state-specific type `urn:tamga:<cc>:<domain>:<Type>:<major>`. The contract did not check
  this.
- **Cross-state references (F-12).** An issuer could attach to another state's root certificate (that state's suspension or
  revocation then controls the issuer's first verification step), and an issuer from another state could be named as successor (that
  issuer's keys can then publish and retire the predecessor's status lists). The specification was silent.
- **Quota scope (F-07 remainder, F-10).** Specification §12.2 says "10 000 writes per state per day" and "48 publications per issuer
  per day". The code keeps the first counter separately in each registry contract; it keeps the second per list and does not limit
  new list registrations, so the cap can be bypassed by opening new lists. A 48-per-issuer cap would in turn stop a large issuer with
  several lists from publishing hourly.
- On 2026-10-19 project management approved the security round's recommendations.

# Decision

## K1 — Schema namespaces are separate

- **National schema** (`NATIONAL`): `vctURI` has exactly the form `urn:tamga:<cc>:<domain>:<Type>:<major>` — `<cc>` is the code of the
  registering state (ISO 3166-1 alpha-2, lower case; `TR` → `tr`), followed by three non-empty segments. A registration that does not
  fit is rejected (`NationalVctOutsideNamespace`).
- **Network schema** (`NETWORK`): `vctURI` **cannot** be in the state-specific form (with any two-letter code)
  (`NetworkVctInNationalNamespace`); Governance applies the same check when the proposal is made, so such a proposal is never opened.
  No other form is required for a network schema (EU types, for example, can be registered as network schemas).
- Because the two namespaces are disjoint, a national registration can never take a network schema's name; there is no need to
  reserve names when a proposal is opened.

## K2 — An issuer attaches only to its own state

- `registerIssuer`: the issuer's root certificate (`parentCA`) must be a record of the issuer's own state.
- `revokeIssuer`: the named successor (`successorId`) must be an issuer of the same state.
- Both are rejected with `CrossStateReference`. A state's records are affected only by that state's keys ([[SPEC-BC-0001]] N1,
  [[ADR-0002]] Layer 2).

## K3 — Quota scope

- **Daily writes per state** (`MAX_WRITES_PER_STATE_PER_DAY = 10 000`): each registry contract keeps its own counter; a state's total
  national writes per day are bounded by the number of registry contracts (five today). A shared cross-contract counter would need
  extra calls and shared state; the spam bound that is the goal stays linear with a per-contract counter.
- **Status list publication** (`MAX_PUBLISH_PER_DAY = 48`): a daily cap **per list** (24 hourly publications + a retry margin).
- **New list registration:** at most 8 per issuer per day (`MAX_LIST_REGISTRATIONS_PER_ISSUER_PER_DAY`). The publish cap can then not
  be bypassed by opening new lists, and an issuer with several lists can still publish each of them hourly. Exceeding it is rejected
  with `ListRegistrationQuotaExceeded`.

# Options considered

| Option | Result | Why |
|---|---|---|
| Reserving the name when a network schema proposal is opened | rejected | Does not stop squatting before the proposal (well-known names can be taken in advance); releasing the reservation of an expired proposal needs extra state and cleanup |
| Adding the tier or state code to `schemaId` | rejected | `schemaId = keccak256(vct)` does not change ([[ADR-0010]]); verifiers and the catalogue use the same identifier |
| Enforcing the national form but leaving the network form free (no check on network schemas) | rejected | A network schema registered in the state-specific form would make the namespaces collide again |
| An "approved" cross-state exception (consent of the other state) | rejected (for now) | No real use case today; a consent flow opens a new authorisation path. A separate ADR if needed |
| 48 publications per issuer (the old specification text) | rejected | Stops an issuer with several lists from publishing hourly |
| A shared per-state counter across contracts | rejected | Extra calls and shared state; the spam bound holds with per-contract counters too |

# Invariants

| Code | Rule |
|---|---|
| NS1 | A national schema's `vct` has the form `urn:tamga:<cc>:<domain>:<Type>:<major>` with `<cc>` the registering state's code; a network schema's `vct` cannot have this form. |
| NS2 | An issuer's root certificate and its successor belong to the issuer's own state. |
| NS3 | The per-state daily write cap is counted separately in each registry contract; the status list publish cap is per list; new list registrations per issuer per day are limited. |

# Consequences

- `contracts/src/schema/VctNamespace.sol` (form check, shared by Governance and SchemaRegistry); `SchemaRegistry`,
  `Governance.proposeNetworkSchema`, `IssuerRegistry.registerIssuer` / `revokeIssuer`, `StatusListRegistry.registerList`; tests.
  Storage layout append-only.
- [[SPEC-BC-0001]] §3.1, §4.3, §4.4, §7, §12.2 and §13 are updated with a version note.
- DECISIONS: **D-BC-9**.

# Status

**Accepted — 2026-10-19.** With project management approval. DECISIONS: D-BC-9. NS1–NS3 are binding; the `vct` form of
[[ADR-0010]] becomes mandatory in the contract, no ADR decision changes.
