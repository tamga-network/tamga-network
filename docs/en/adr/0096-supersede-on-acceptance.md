---
document_id: ADR-0096
title: "When an identity credential is renewed, the earlier record is revoked once the new credential is reported as added to the wallet"
status: Proposed
review_status: Draft
version: 0.1.0
created: 2026-11-23
last_updated: 2026-11-23
summary: >
  Today, when the identity service issues a new identity credential for the same ID card or passport, it immediately revokes the
  earlier active record (and the driving licence information tied to it, ADR-0039). If the person chooses "Don't add" in the
  wallet's preview, the new credential is deleted and the old one has already become invalid. Proposal: the identity service
  opens the OpenID4VCI notification endpoint; the earlier record is revoked only when the wallet reports credential_accepted; if
  it reports credential_deleted or credential_failure, the new record is revoked and the earlier one stays. If no notification
  arrives, the earlier record is revoked after 24 hours, as today. To be implemented before the store release.
domain: Identity
translation_of: ADR-0096
source_version: 0.1.0
related: ["[[ADR-0039]]", "[[ADR-0059]]", "[[SPEC-PROTO-0001]]", "[[SPEC-ID-0003]]", "[[SPEC-WALLET-0001]]"]
---

# In short

When an identity credential is renewed, the earlier record should be revoked once the new credential has actually been added to
the wallet. The wallet says so with the standard OpenID4VCI notification. If no notification ever arrives, the window is bounded:
after 24 hours today's rule applies.

# Context

The identity service keeps one active identity record per document (same document digest, `doc_hash`): when a new record is
issued, the earlier active record is revoked with reason `re-issuance`, and the driving licence information tied to the earlier
identity is revoked too (ADR-0039). The wallet, however, shows the person a preview before storing a credential (ISSU_11), and
the person can choose "Don't add"; the new credential and its keys are then deleted. Result: a person who declines the new
credential has already lost the old one. Since 2026-11-23 the wallet's text says this explicitly (interim measure). Direction from
project management: revocation of the earlier record is deferred until the person accepts the new credential.

OpenID4VCI 1.0 defines the notification endpoint for this: the credential response carries a `notification_id`; after storing
the credential, or deciding not to, the wallet sends `credential_accepted`, `credential_deleted` or `credential_failure` with the
same access token.

# Proposed decision

- **K1 — Notification endpoint.** The identity service publishes `notification_endpoint` in its metadata; the identity credential
  response carries a `notification_id` (one identifier for all copies of one issuance). The request is authenticated with the
  access token that obtained the credential and the same DPoP key; a request with another token, or with a `notification_id` that
  belongs to another record, is rejected. A notification is processed once.
- **K2 — Revoking the earlier record depends on acceptance.** When a new record is issued, the earlier active record is not
  revoked immediately; it is marked as "pending supersession". When `credential_accepted` arrives, the earlier record is revoked
  with reason `re-issuance` (together with the dependent driving licence information of ADR-0039).
- **K3 — A declined new record.** When `credential_deleted` or `credential_failure` arrives, the new record is revoked (reason:
  `holder-declined`); the earlier record stays active.
- **K4 — No notification.** If no notification arrives within 24 hours, the earlier record is revoked as today. Two active records
  for the same document therefore coexist for at most 24 hours; the single-active-record rule is relaxed only for that window.
- **K5 — Wallet.** If the credential response carries a `notification_id`, the wallet sends the notification after the preview
  decision: `credential_accepted` if stored, `credential_deleted` on "Don't add" or on a copy mismatch. If sending fails it is
  retried; storing the credential does not depend on the notification.
- **K6 — Scope.** Only the identity service's identity credential. Institutions' credentials are not affected.

# Rationale / alternatives

| Option | Status | Why |
|---|---|---|
| Today's rule + explicit text | interim | The person is informed, but declining the new credential still loses the old one |
| Notification endpoint, revoke on acceptance (this proposal) | proposed | Standard OpenID4VCI mechanism; the person's decision reaches the server; the time limit keeps the single-active rule |
| Never revoking the earlier record without a notification | rejected | An attacker could keep two active records for the same document by not notifying |
| Revoking the new record without a notification | rejected | A person who stored the credential and went offline would lose the new credential |

# Proposed rules (moved to the binding table if accepted)

| Code | Rule |
|---|---|
| SA1 | When an identity credential is renewed, the earlier active record is revoked only on a `credential_accepted` notification or when the 24-hour window ends. |
| SA2 | A notification is accepted only with the access token and DPoP key that obtained the credential; it is processed once. |
| SA3 | `credential_deleted` / `credential_failure` revokes the new record and leaves the earlier record active. |

# Status

**Proposed — 2026-11-23.** Written after a review finding (declining a new credential revokes the old identity); project
management approved the direction, the rule details await acceptance. Implementation: identity service (notification endpoint,
pending-supersession record, 24-hour job), wallet core (sending the notification) and wallet (with the next package release).
Before the store release.
