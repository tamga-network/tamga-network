---
document_id: ADR-0044
title: "Short-lived copies for ZK presentation"
status: Active
version: 1.0.0
created: 2026-10-09
last_updated: 2026-10-09
summary: >
  A zero-knowledge (ZK) presentation does not disclose the revocation list index, so revocation cannot be checked; the
  identity credential is valid for 2 years and is not silently refreshed. Decision: a ZK presentation uses only short-lived
  mdoc copies issued separately by the identity service, valid for at most 24 hours and carrying no revocation list entry.
  The wallet obtains them in batches and refreshes them without asking the user; if the main credential is revoked or
  suspended the refresh is refused and the last copy expires within 24 hours. This is the EU ARF's short-lived attestation
  path (VCR_01: ≤ 24 hours, no revocation needed; §7.4.3.5.2 limited-time attestations, batch issuance). If the EU later
  chooses another revocation method for ZK, the decision is re-evaluated. Introduces a narrow exception to ADR-0023 AR4.
domain: Identity
related: ["[[ADR-0032]]", "[[ADR-0023]]", "[[ADR-0011]]", "[[ADR-0008]]", "[[SPEC-CRED-0003]]", "[[SPEC-WALLET-0001]]"]
translation_of: ADR-0044
source_version: 1.0.0
---

# In short

When an identity credential is shown with a zero-knowledge proof, the verifier cannot see whether it has been revoked. So only
short-lived copies are shown with ZK: each copy is valid for at most 24 hours and the wallet refreshes them on its own. If the
credential is revoked, the identity service issues no new copy, and the copy still in the wallet expires within a day.

# Context

- [[ADR-0032]] K6: the ZK circuit does not check revocation status; opening the [[t:status-list]] index links two
  presentations. ZK4 says "the validity of a credential presented with ZK is kept short". Today this is not met: the only
  credential that can be presented with ZK is the identity credential (mdoc), valid for 2 years (730 days), and because the
  identity service keeps no person fields it is not silently refreshed ([[ADR-0023]] AR4). When a revoked identity credential
  is shown with ZK the verifier cannot see it; a policy can only accept this knowingly with `accept_unrevocable_zk: true`.
- The EU [[t:ARF]] 3.0 (2026-07-23) recognises two ways to handle revocation (Annex 2, Topic 7, VCR_01 / VCR_01b): **issue
  only short-lived attestations, valid for 24 hours or less, so that revocation is never necessary,** or use a status list /
  revocation list. The 24-hour period comes from ETSI EN 319 411-1 REV-6.2.4-03A ("revocation is processed within 24 hours at
  most"). ARF §7.4.3.5.2 describes issuing many technical copies of the same credential in batches and **limited-time
  attestations** (Topic 10, method B); §5.3 describes re-issuing technical copies with a short technical validity. Re-issuance
  should require no user action as far as possible (ISSU_42).
- The EU has not yet chosen a ZK method (ARF §7.4.3.5.3: "discussions are ongoing"; TS4, TS13, TS14). A private revocation
  proof for ZK is not defined on the EU side.
- Direction from project management: if this is the path the EU recommends or will choose, implement it.

# Options considered

| Option | Outcome | Why |
|---|---|---|
| **A — short-lived copies for ZK (batch + silent refresh)** | **accepted** | The path the EU ARF defines today (VCR_01: ≤ 24 hours, no revocation needed; batch issuance, limited-time attestations). A revoked credential can no longer be shown with ZK after 24 hours at most; the institution's credential and the circuit do not change. |
| B — private non-revocation proof inside ZK (proving non-revocation without opening the index) | later | No scheme is defined in the EU (the revocation part of TS13/TS14 is open); the circuit changes and the institutions' list format may change. If the EU chooses a scheme, this ADR is re-evaluated. |
| C — accept and document (with `accept_unrevocable_zk`) | rejected (except in transition) | A revoked identity credential looks valid with ZK for up to 2 years; the second half of ZK4 is never met. Until A is implemented this is today's behaviour. |
| Make the whole identity credential short-lived | rejected | The identity credential cannot be re-issued without keeping person fields; every refresh would be a new identity verification. |
| 7-day ZK copies | rejected | The ARF threshold for "no revocation needed" is 24 hours; 7 days delays revocation by up to a week. |

# Decision

## K1 — ZK only with a short-lived copy
A ZK presentation ([[ADR-0032]], `mso_mdoc_zk`) is made only with a **ZK copy** issued by the identity service for this
purpose. A ZK copy is a technical copy of the identity credential's mdoc representation:
- its validity (`validFrom` → `validUntil`) is **at most 24 hours**;
- it carries no revocation list entry (`status`) — following ARF VCR_01, short validity replaces revocation;
- it is used only for ZK presentation; classic presentation (`mso_mdoc`, `dc+sd-jwt`) continues with today's copies and with
  the revocation check;
- it carries a marker the verifier can tell from the ZK proof (the credential type the proof binds, or a separate signing
  certificate; chosen in the implementation design, and any new public name goes to project management for approval).

## K2 — Batch and silent refresh
The identity service issues a small batch of ZK copies at first issuance and at every refresh (each copy bound to its own
device key; batch issuance). Shortly before the last copy expires the wallet obtains a new batch without asking the user. The
conditions of [[ADR-0023]] K1 apply: network available, random delay; if the user switches off the setting ("refresh copies
automatically"), ZK copies are not refreshed and ZK presentation is unavailable (classic presentation continues).

## K3 — Refresh path and personal data
- The refresh uses an OpenID4VCI refresh token; the token is bound to the [[t:DPoP]] key from first issuance and to the wallet
  attestation ([[t:WUA]]), is single-use and is rotated on every use ([[ADR-0023]] K2, AR2).
- The identity service **does not keep** person fields ([[ADR-0011]] K4). The minimum fields the ZK copy needs travel inside
  the token, encrypted and signed so that only the identity service can open them; the token stays in the wallet and no record
  is kept on the server.
- The token is bound to the revocation list entry of the main identity credential. On every refresh the identity service
  reads that entry from its own list; if the credential is **revoked or suspended it issues no new copy** and treats the token
  as invalid.
- The refresh request does not say what was shown to which verifier; no personal data and no token are written to the
  identity service's log.

## K4 — Effect of revocation
Once the main credential is revoked no new ZK copy is issued; the last copy in the wallet expires within 24 hours at most. So a
revocation takes effect for ZK presentation within 24 hours at most (for classic presentation within the publication interval,
[[SPEC-CRED-0003]] §5.3).

## K5 — Verifier
The verifier treats a ZK presentation carrying the K1 marker as a "short-lived credential that needs no revocation check"
(`status.value = NOT_APPLICABLE`, reason: short validity); `accept_unrevocable_zk` is needed only for a ZK presentation without
the marker. Until A is implemented today's rule stands: an unmarked ZK presentation is INDETERMINATE unless the policy says
`accept_unrevocable_zk: true`.

## K6 — If the EU path changes
If the EU chooses another revocation method for ZK (for example a private non-revocation proof) or changes the short-validity
threshold, this decision is re-evaluated (option B).

# Invariants

| Code | Rule |
|---|---|
| ZC1 | A ZK presentation is made only with a ZK copy; a ZK copy is valid for at most 24 hours and carries no revocation list entry. |
| ZC2 | If the main identity credential is revoked or suspended, the identity service issues no new ZK copy. |
| ZC3 | Refreshing ZK copies keeps no person fields on the server; the fields stay in the token, in the wallet, in a form only the identity service can open. |
| ZC4 | The verifier treats a ZK presentation without the short-validity marker as INDETERMINATE unless the policy explicitly accepts it. |

# Consequences

- [[ADR-0023]] AR4 narrows: services that keep no person fields do not issue refresh tokens; the only exception is the ZK copy
  token (ZC3).
- [[ADR-0032]] K6 and ZK4 are implemented by this ADR: "short" means at most 24 hours.
- Specifications (with the implementation): [[SPEC-WALLET-0001]] (ZK copy store and refresh), [[SPEC-PROTO-0001]] §4.1 (ZK
  copy token in the identity service), [[SPEC-API-0001]] D1 (short-validity marker), the identity rulebook.
- Code: the identity service (operator repository), `@tamga-network/wallet-core`, `@tamga-network/verifier`, the wallet app.
  The package change goes into the next minor release; the unpublished 0.3.0 packages are not changed.
- Estimated effort: identity service 3–4 days, wallet-core 3–4 days, wallet app 2 days, verifier 1–2 days, specifications +
  tests + conformance vectors 2 days — about 2.5–3 weeks in total.
- Residual risk: from the refresh frequency the identity service learns that the wallet is active (one refresh a day); it does
  not learn what was shown to which verifier. Random delay and the user setting reduce this (the same balance as [[ADR-0023]]
  K6).

# Status

**Accepted — 2026-10-09.** Approved by project management, on the condition that this is the path the EU recommends (K6).
DECISIONS: D-ZK-2.

*Implementation (2026-10-09, packages 0.4.0):* the K1 marker is a separate credential type —
`urn:tamga:id:ShortLivedIdentityAttestation:1` (in the catalogue; type rule ≤ 24 hours, no revocation list; the public name awaits
project management approval and lives in a single constant in the code). Because the Longfellow proof binds the docType, the
verifier sees the type from the proof; no separate signing certificate was needed (the same institution key, MD3). Identity
service: a `refresh_token` in the identity credential's token response (JWE `dir` + A256GCM; linked record, generation counter,
DPoP thumbprint, expiry, only `age_over_18`); on the server only the generation counter in the record; batch of at most 3
copies, validity ≤ 24 hours and ≤ the main credential's expiry ([[SPEC-PROTO-0001]] §4.2). Wallet core: `refreshZkCopies`,
`scheduleZkRefreshes` (window: 8 hours before expiry; random delay at most 6 hours), a ZK query only with a ZK copy
([[SPEC-WALLET-0001]] §4.5). Verifier: a marked ZK presentation is `NOT_APPLICABLE` (reason: short validity), an unmarked one
needs `accept_unrevocable_zk` ([[SPEC-API-0001]] D1); Tamga Verify's `age-over-18-zk` policy asks for the ZK copy type and the
flag was removed.
