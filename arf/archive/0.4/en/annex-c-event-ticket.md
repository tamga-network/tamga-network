---
title: "Annex C — Attestation Rulebook: Event Ticket"
translation_of: FW-RB-0004
source_version: 0.1.0
outline: [2, 3]
---

# Annex C — Attestation Rulebook: Event Ticket

<div class="arf-meta">

**Document** FW-RB-0004 · **Version** 0.1.0 · **Status** Draft · **Updated** 2026-09-27 · **Licence** CC BY 4.0
Official English translation of the Turkish source text; in case of conflict the Turkish text prevails.

</div>

::: warning Draft
This rulebook is a draft awaiting approval. It compiles rules that are already in force ([[ADR-0012]] K1–K5, [[ADR-0014]]
and the schema catalogue); it becomes Active once approved.
:::

The attestation rulebook for the event ticket (`urn:tamga:tkt:EventTicket:1`): a device-bound, single-use document that
carries no personal data. Who issues it, which fields, validity and revocation, single use at the gate with a pass card,
transfer (re-issuance) and the verification policy.

## 0. Scope

| Type | `vct` | `schema_id` | Catalogue |
|---|---|---|---|
| Event ticket | `urn:tamga:tkt:EventTicket:1` | `keccak256(vct)` | `schemas.tamga.network/v1/tkt/EventTicket/1.0.0` |

The ticket **carries no personal data**: it proves the ticket, not the person; it is bound to a device key (`cnf`) and has no
identity fields. If identity is needed at the gate (e.g. a named ticket), that is a separate presentation (the identity
attestation, [[FW-RB-0003]]).

## 1. Data model

| Claim | Type | Selective disclosure | Note |
|---|---|---|---|
| `event_id` | string | `always` | Event code |
| `event_name` | string | `always` | |
| `event_start`, `event_end` | date-time | `always` | |
| `venue_name` | string | `always` | Venue |
| `organizer_name` | string | `always` | Organiser |
| `ticket_class` | string | `always` | e.g. STANDARD, VIP, STUDENT |
| `seat` | string (optional) | `always` | Seat |
| `ticket_no_hash` | `sha256-…` | `always` | Hash of the seller's ticket number; the seller matches it with its own records |
| `gate` | object | `never` | The verifier (`verifier_client_id`), terminal group and policy from which the gate pass is obtained |
| `status`, `cnf`, `vct`, `iss`, `iat`, `exp` | — | `never` | Wire profile |

## 2. Who issues it

| Requirement | Value |
|---|---|
| Issuer | The ticket seller / organiser (e.g. a ticketing platform) |
| Category | `EVENTS` ([[ADR-0014]]; the category is a coarse filter, the real gate is schema authorisation — IC2) |
| Minimum accreditation | I2 |
| Schema authorisation | An allowlist entry for this `vct` |
| Identity proofing | Not required (T0) — the ticket is bound to a device, not a person |

Note: the type definition of `EventTicket:1` (an immutable file) lists the issuer category `OTHER`; registrations are in the
`EVENTS` category under [[ADR-0014]]. The correction in the definition comes with `EventTicket:2` (published files never
change — D1).

## 3. Validity, revocation and transfer

| Topic | Rule |
|---|---|
| Validity | `exp` = end of the event + 1 day; at most 400 days (sales up to a year ahead) |
| Copies | **One copy per seat** ([[ADR-0012]] K4) |
| Status list | Mandatory: revocation **and** the "used" bit at the gate |
| Revocation | refund, event cancelled, wrong sale |
| Transfer | A ticket is **not passed on**; a transfer = the seller revokes the old ticket and issues a new one to the new device |

## 4. Single use at the gate

1. **Registration:** the person presents the ticket once to the gate's verifier (`gate.verifier_client_id`, OpenID4VP); the
   verifier returns a pass grant (`pass_grant`) ([[ADR-0012]] K1-B).
2. **At the gate:** the wallet shows a 60-second signed pass token **without personal data** as a QR code; the terminal can
   verify it offline (K2).
3. **Single entry:** on entry the status bit is set to "used"; because status publication happens at a fixed interval (S6),
   the gates in the same terminal group keep a **shared used-list** that stops a second entry within the interval (K3, K4).
4. Since the organiser is both issuer and verifier, unlinkability is meaningless for this type; this is an accepted situation
   (K4).
5. A terminal is defined only under a registered RP (`terminal_groups[]`, K5).

## 5. Verification policy

| Policy | Required |
|---|---|
| `event-ticket` (reference) | `vct = EventTicket:1`; issuer in the `EVENTS` category and authorised for this type, ≥ I2; status active (not revoked or used); fields requested only `event_id` + `ticket_class` |

The gate does not ask for the person's name, date of birth or contact details. The result is three-valued; `INDETERMINATE`
is not an entry.

## 6. Demo deviations

| # | Deviation | Closure |
|---|---|---|
| S-9 | Keys in software in the demo wallet | Secure element in the pilot |
| S-16 | The pass card does not ask for a PIN at every display (time-limited, scoped consent) | Rule-bound exception — [[SPEC-WALLET-0001]] WL12–WL14 |

## Related documents

[[FW-ARF-0001]] · [[FW-TF-0001]] · [[FW-RB-0001]] · [[FW-RB-0003]] · [[ADR-0012]] · [[ADR-0014]] · [[SPEC-CRED-0003]] ·
[[SPEC-WALLET-0001]]

## Change history

- **0.1.0 (2026-09-27)** — First draft: a compilation of [[ADR-0012]] K1–K5, [[ADR-0014]] and the schema catalogue. Awaiting
  approval.
