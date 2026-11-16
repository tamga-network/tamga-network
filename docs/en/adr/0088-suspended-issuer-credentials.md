---
document_id: ADR-0088
title: "Credentials of a suspended issuer"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-16
last_updated: 2026-11-16
summary: >
  While an issuer is suspended in the trust list, the credentials it issued are not accepted in verification, regardless of when
  they were issued (C1 REJECTED, reason "issuer suspended"); when the suspension is lifted, credentials issued before it are
  accepted again, credentials issued during it never are. Suspension does not revoke credentials. For a revoked, retired or
  expired issuer the issuance-time rule remains (with `invalidates_from` on compromise). The suspension rule of the EU framework
  (ARF 3.0 §4.6.5, §6.3.3) is adopted; the earlier rule "a suspension only drops credentials issued during it" (ADR-0073 K5)
  changes to that extent. The list source, the chain contract and the indexer give the same answer; the wallet does not delete a
  suspended issuer's credential but shows it with a warning on the card. Accepted: 2026-11-16.
domain: Trust
related: ["[[ADR-0002]]", "[[ADR-0009]]", "[[ADR-0014]]", "[[ADR-0048]]", "[[ADR-0073]]", "[[ADR-0084]]", "[[SPEC-API-0001]]", "[[SPEC-BC-0001]]", "[[SPEC-TRUST-0001]]", "[[FW-TF-0001]]", "[[FW-RB-0001]]", "[[FW-POL-0001]]"]
translation_of: ADR-0088
source_version: 1.0.0
---

# In short

When an issuer was suspended in the trust list, until now only its new issuance stopped; credentials it had issued before kept
being accepted. In the EU framework, credentials of a suspended issuer are not relied upon. With this decision Tamga behaves like
the EU: while the issuer is suspended, none of its credentials is accepted. Suspension is temporary: once the issuer is active
again, the credentials it issued before the suspension are accepted again.

# Context

- **Earlier rule.** C1 (`isCredentialAcceptable`) looks at the credential's `iat` ([[ADR-0009]] D-BC-3): the issuer must have
  been `ACTIVE` at that moment. A later suspension, retirement or removal did not drop earlier credentials; a broad reading of
  [[SPEC-BC-0001]]/GV1 ("removal/exit does not invalidate existing records and credentials") and [[ADR-0073]] K5 ("credentials a
  suspended issuer issued before the suspension stay valid") applied this to suspension as well.
- **EU rule.** ARF 3.0 §4.6.5: an issuer is registered ⇄ suspended → cancelled; credentials of a suspended or cancelled issuer are
  not accepted by relying parties. §6.3.3: on suspension or revocation the issuer's access certificates are revoked; the PID,
  QEAA or PuB-EAA provider becomes "Invalid" in the list and verifiers no longer trust its credentials; the issuer revokes all its
  credentials.
- **Difference.** The same credential was rejected by an EU wallet or verifier but accepted in Tamga; suspension is the tool for
  saying "do not trust this issuer for now" after an incident or an audit finding, and the earlier rule did not serve that.
- **Direction from project management (2026-11-16).** Do as the EU does for suspension: while the issuer is suspended its
  credentials are not accepted. No separate direction was given for revocation or expiry of the registration; this record changes
  only suspension and states the rule for the others explicitly.

# Decision

## K1 — Credentials of a suspended issuer are not accepted

- C1 asks two questions together: (1) could the issuer issue at the credential's `iat` (earlier rule, unchanged) and (2) is the
  issuer suspended **now** (at verification time). If the second is yes, the answer is `NO` — when the credential was issued does
  not matter.
- "Suspended now" is read from the issuer's status history: the issuer is suspended if the last entry whose `since` is at or
  before the verification time is `SUSPENDED`.
- The verifier's result stays in the three-valued model (CMP9): `REJECTED`, `failed_step: "C1"`, `failed_reason: "issuer
  suspended"`. No new result value or step code is added. If the list is stale the result remains `INDETERMINATE` (CMP4).

## K2 — Credentials are accepted again when the suspension ends; suspension is not revocation

- When the issuer is `ACTIVE` again, credentials issued before the suspension are accepted again. A credential issued during the
  suspension (status `SUSPENDED` at `iat`) is never accepted — earlier rule.
- Suspension does not change a credential's status in its status list; the issuer does not revoke its credentials because of the
  suspension. If the reason for the suspension permanently undermines the credentials (for example a leaked signing key), the
  path is that of [[FW-POL-0001]]: revocation of the issuer and of the credentials.

## K3 — Revocation, retirement and expiry: the issuance-time rule remains

| Issuer status | Rule | ARF |
|---|---|---|
| `SUSPENDED` | **Changed:** while suspended all credentials REJECTED; once lifted, the earlier ones accepted | §4.6.5: not accepted — aligned |
| `REVOKED` (soft revocation, removal) | Unchanged: credentials issued before revocation accepted (GV1, [[ADR-0002]] #4) | §4.6.5: not accepted — **deliberate difference** |
| `REVOKED` + `invalidates_from` (compromise) | Unchanged: credentials issued from that moment REJECTED | aligned |
| `RETIRED` (voluntary exit) | Unchanged: earlier credentials accepted | no ARF counterpart |
| Registration expired (`valid_until`) | Unchanged: credentials issued within the period accepted | no ARF counterpart |

Rationale for the difference on revocation: most Tamga credentials (diplomas, study certificates) are permanent, and the closing
of an institution or its exit from the network should not invalidate a credential that was correctly issued in the past; in the
EU the issuer is expected to revoke its credentials one by one in that case, and in Tamga hard revocation (`invalidates_from`)
and credential revocation are used when the same result is needed. When a suspended issuer is revoked, the registration reason
records whether the revocation is soft or hard: a soft revocation makes the credentials from before the suspension acceptable
again.

## K4 — Chain equivalence

The list source ([[SPEC-TRUST-0001]]), the contract (`IssuerRegistry.isCredentialAcceptable`: `false` if the issuer's current
status is `SUSPENDED`) and the indexer's trust source apply the same rule; the equivalence tests prove it ([[ADR-0073]] K6). The
verification decision is still made from the list only ([[ADR-0084]]). The status of issuers in external lists is evaluated by
that list's rules ([[ADR-0036]]); this decision does not change them. Suspension of a root certificate authority is outside the
scope of this decision (unchanged).

## K5 — Wallet

- The wallet does not delete a suspended issuer's credential and does not treat it as revoked; it shows it on the card with an
  "issuer suspended" warning. The warning goes away when the suspension ends.
- No new credential is received from a suspended issuer (C1).
- The credential's display state is computed in the core (`credentialValidity`, state `issuer_suspended`); if the trust list
  cannot be checked, no warning is shown.

# Options considered

| Option | Result | Why |
|---|---|---|
| Earlier rule (suspension only stops new issuance) + rationale note | rejected | Results diverge from EU wallets and verifiers; does not serve the "do not trust for now" purpose |
| Reject on suspension with a separate result value (`SUSPENDED` outcome) | rejected | Breaks the three-valued result model (CMP9) and how records read; the reason field is enough |
| `INDETERMINATE` on suspension | rejected | Suspension is a known state, not "unknown"; the EU says "not accepted" |
| EU behaviour for both suspension and revocation (all credentials rejected on revocation too) | rejected (in this record) | Permanent credentials (diplomas) would fall when an institution closes; project management gave direction only for suspension |
| **Reject on suspension regardless of issuance time, accept once lifted; issuance time on revocation** | **chosen** | EU suspension rule; suspension stays reversible; permanent credentials are protected |

# Invariants

| Code | Rule |
|---|---|
| SI1 | If the issuer is `SUSPENDED` in the trust list at verification time, none of the credentials it issued is accepted (C1 `NO`; verifier result `REJECTED`, reason "issuer suspended"); the credential's issuance time does not change the result. |
| SI2 | Suspension does not revoke credentials: when the issuer is `ACTIVE` again, credentials issued before the suspension are accepted again; a credential issued during the suspension is never accepted. |
| SI3 | For a revoked (`REVOKED`), retired (`RETIRED`) or expired issuer the issuance-time rule remains: earlier credentials are accepted; on compromise, credentials issued from `invalidates_from` are rejected. |
| SI4 | The list source, the chain contract and the chain trust source give the same answer on suspension. |

# Consequences

- `packages/trust`: suspension check in `ListTrustSource.isCredentialAcceptable`; new optional `TrustSource.isIssuerSuspended`.
- `packages/verifier`: C1 reason "issuer suspended".
- `packages/wallet-core`: `credentialValidity` (`issuer_suspended`), suspension message on receipt.
- `contracts/`: `IssuerRegistry.isCredentialAcceptable` returns `false` while suspended; `apps/chain-indexer`: same rule.
- Documents: [[SPEC-API-0001]] §1.1, [[SPEC-BC-0001]] §3.3 and the GV1 note, note on [[ADR-0073]]; framework documents Annex A
  §3.3, revocation policy §3.5, Tamga Rulebook, onboarding §7.

# Status

**Accepted — 2026-11-16** (project management approval; verbatim quote in the private approval record). DECISIONS: D-TRUST-8.
SI1–SI4 are binding.
