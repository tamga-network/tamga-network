---
document_id: ADR-0023
title: "Automatic copy refresh"
status: Active
version: 1.0.0
created: 2026-09-29
last_updated: 2026-10-02
summary: >
  The wallet renews institution credentials whose copies are running low or that are about to expire without asking the
  user: with an OpenID4VCI refresh token (bound to DPoP and the wallet attestation, single-use, rotated), at the thresholds
  the institution announces (credential_reuse_policy), while the app is in the foreground and after a random delay. For
  identity and contact credentials, whose personal fields are not kept, renewal remains a user action. Changes
  SPEC-WALLET-0001/WL7 (ARF ISSU_42, ISSU_45, ISSU_63).
domain: Wallet
translation_of: ADR-0023
source_version: 1.0.0
---

# Context

[[SPEC-WALLET-0001]]/WL7 says "there is no automatic renewal". The reason: if the wallet goes to the institution in the
background, the institution learns how often the credential is used ([[SPEC-SCHEMA-0002]] §2.1).

The EU [[t:ARF]] 3.0 points the other way: re-issuance **should require user action as little as possible** (ISSU_42). With
the single-use batch method, the wallet should request a new batch when it falls below a lower threshold (ISSU_45). Wallet
and institution should support the re-issuance features of [[t:OpenID4VCI]] (ISSU_63).

Since 2026-09-29 Tamga institutions announce the thresholds in their metadata (`credential_reuse_policy`: batches of 10,
when 2 copies remain, 7 days before expiry). Project management approved the same behaviour as the EU.

Constraint: silent renewal requires the institution to be able to sign again without asking the user.
- **Institution credentials** (student, diploma): the institution reads the attributes again from its own
  [[t:authentic-source]].
- **Identity credential** ([[ADR-0011]] K4) and **contact credentials** ([[ADR-0021]] K3): the service does not keep the
  personal fields after issuance. Renewing them silently would require storing personal data. They are therefore out of
  scope.

# Decision

## K1 — When

The wallet renews an institution credential when one of these happens:
- the number of unused copies falls to the institution's `reissue_trigger_unused` value (Tamga: 2),
- the time left until the credential's expiry falls to `reissue_trigger_lifetime_left` (Tamga: 7 days).

Renewal happens only when all of these hold: the app is in the foreground, unlocked, and online. After the threshold is
crossed a **random delay** (0–6 hours) is applied, so that the moment of renewal cannot be linked to the moment of a
presentation.

## K2 — How: the refresh token

- On first issuance the institution returns a `refresh_token` in the token response (OpenID4VCI 1.0, RFC 6749 §6).
- The token is **bound to the [[t:DPoP]] key** created for that credential (RFC 9449 §5). The wallet keeps this key for the
  life of the credential; each logical credential has its own key.
- The wallet attestation ([[t:WUA]]) is presented again with each renewal.
- The token is single-use and is replaced by a new one at each use (rotation). Its lifetime never exceeds the credential's
  maximum validity.
- A renewal returns a new batch (10 copies, new keys); old unused copies are deleted.

## K3 — What the institution does

- It **reads the attributes again** from the authentic source. If a field has changed, the wallet shows it to the user
  (ARF ISSU_59).
- If the record no longer exists in the source (graduation, deregistration), the renewal is rejected and the token is
  revoked.
- The validity of the new batch follows the rule of the type (student certificate ≤ 90 days). This way a student
  certificate refreshes itself for as long as the person remains a student.

## K4 — Out of scope: identity and contact credentials, tickets

Identity and contact credentials receive no refresh token. They are renewed by user action (verifying the identity or the
address again). Tickets are single-use and are not renewed. For these credentials the wallet warns, as today, when copies
run low.

## K5 — User setting

Settings has an "Automatically renew copies" option. It is on by default. When it is off, today's behaviour applies (warning
+ manual renewal).

## K6 — Privacy balance

Residual risk: from the renewal frequency the institution can roughly infer how many **new** [[t:verifier]]s the credential
was shown to (one request every 8 new verifiers). Mitigations:
- the same copy for the same verifier (WL5); repeated presentations do not consume copies,
- the random delay,
- the renewal request does not contain which verifier the credential was presented to,
- the user setting.

This is the same balance as the EU model. Project management accepted it.

# Options considered

| Option | Result | Why |
|---|---|---|
| No automatic renewal (WL7 as it is) | rejected | Conflicts with ARF ISSU_42/45; once copies run out the user cannot show the credential to a new verifier |
| Silent renewal with a new identity presentation | rejected | Each renewal would mean an identity presentation = user consent and PIN; it cannot be silent |
| The identity service stores personal fields encrypted | rejected | Conflicts with ADR-0011 K4 and the data minimisation principle |
| **Refresh token (bound to DPoP + WUA)** | **accepted** | The standard OpenID4VCI path; the institution asks the authentic source again |

# Invariants

| Code | Rule |
|---|---|
| AR1 | Silent renewal happens only for credentials that have a refresh token, at the threshold announced by the institution, while the app is in the foreground and unlocked, and after a random delay. |
| AR2 | The refresh token is bound to the credential-specific DPoP key, is single-use and changes at each use; the wallet attestation is verified at each renewal. |
| AR3 | On renewal the institution reads the attributes again from the authentic source; if there is no record in the source, no credential is issued and the token is revoked. |
| AR4 | Services that do not store personal fields (identity, contact) issue no refresh token. |

# Consequences

- [[SPEC-WALLET-0001]]/WL7 is reworded: "Renewal without user action happens only under the AR1–AR4 conditions."
- [[SPEC-PROTO-0001]]: `refresh_token` at the token endpoint (the institution's [[t:issuer]]); `grant_type=refresh_token`
  (DPoP + WUA); token revocation.
- `apps/issuer` (operator repository): refresh token store (as digests), re-reading from the authentic source.
- `wallet-core`: per-credential DPoP key + refresh token storage; threshold check. Wallet: background renewal, setting,
  notification of changed fields.

# Status

**Accepted — 2026-09-29.** With project management approval. DECISIONS: D-WALLET-1. Implementation queued.
