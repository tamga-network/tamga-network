---
title: "Event Ticket Rulebook"
translation_of: FW-RB-0004
source_version: 1.0.0
outline: [2, 3]
---

# Event Ticket Rulebook

<div class="arf-meta">

**Document** FW-RB-0004 · **Version** 1.0.0 · **Status** Active · **Updated** 2026-10-02 · **Licence** CC BY 4.0
Official English translation of the Turkish source text; in case of conflict the Turkish text prevails.

</div>

The rulebook for the event ticket (`urn:tamga:tkt:EventTicket:1`), branching from the Tamga [[t:rulebook|Rulebook]] ([[FW-RB-0001]]): a
device-bound credential, single-use at the gate, that carries no personal data. Who issues it, which attributes, validity and
[[t:revocation]], single use at the gate with an access pass, transfer (re-issuance) and the verification policy.

## 0. Scope

| Type         | `vct`                         | Catalogue                                        |
| ------------ | ----------------------------- | ------------------------------------------------ |
| Event ticket | `urn:tamga:tkt:EventTicket:1` | `schemas.tamga.network/v1/tkt/EventTicket/1.0.0` |

The ticket **carries no personal data**: it proves the ticket, not the person; it is bound to a device key (`cnf`) and has no
identity attributes. If identity is needed at the gate (for example a named ticket), that is a separate presentation (the
identity credential, Identity Rulebook).

## 1. Data model

| Attribute                                   | Type              | Selective disclosure | Note                                                                                                |
| ------------------------------------------- | ----------------- | -------------------- | --------------------------------------------------------------------------------------------------- |
| `event_id`                                  | string            | `always`             | Event code                                                                                          |
| `event_name`                                | string            | `always`             |                                                                                                     |
| `event_start`, `event_end`                  | date-time         | `always`             |                                                                                                     |
| `venue_name`                                | string            | `always`             | Venue                                                                                               |
| `organizer_name`                            | string            | `always`             | Organiser                                                                                           |
| `ticket_class`                              | string            | `always`             | e.g. STANDARD, VIP, STUDENT                                                                         |
| `seat`                                      | string (optional) | `always`             | Seat                                                                                                |
| `ticket_no_hash`                            | `sha256-…`        | `always`             | Digest of the seller's ticket number; the seller matches it with its own records                    |
| `gate`                                      | object            | `never`              | The verifier (`verifier_client_id`), terminal group and policy from which the gate pass is obtained |
| `status`, `cnf`, `vct`, `iss`, `iat`, `exp` | —                 | `never`              | Transport profile                                                                                   |

## 2. Who issues it

| Requirement               | Value                                                             |
| ------------------------- | ----------------------------------------------------------------- |
| Issuer                    | The ticket seller or organiser (e.g. a ticketing platform)        |
| Category                  | `EVENTS`                                                          |
| Minimum accreditation     | I2                                                                |
| Credential type authority | An allow-list entry for this `vct`                                |
| Identity proofing         | Not required (T0) — the ticket is bound to a device, not a person |

Note: the type definition of `EventTicket:1` (an immutable file) lists the [[t:issuer]] category `OTHER`; registrations are in the
`EVENTS` category under [[ADR-0014]]. The correction in the definition comes with `EventTicket:2` (published files never change,
RB-SCH-02).

## 3. Validity, revocation and transfer

| Topic           | Rule                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Validity        | `exp` = end of the event + 1 day; at most 400 days (sales up to a year ahead)                                            |
| Copies          | **One copy per seat**                                                                                                    |
| Revocation list | Mandatory: revocation **and** the "used" bit at the gate                                                                 |
| Revocation      | refund, event cancelled, incorrect sale                                                                                  |
| Transfer        | A ticket is **not passed on**; a transfer means the seller revokes the old ticket and issues a new one to the new device |

## 4. Single use at the gate

1. **Registration:** the person presents the ticket once to the gate's [[t:verifier]] (`gate.verifier_client_id`, [[t:OpenID4VP]]); the
   verifier returns a pass grant (`pass_grant`).
2. **At the gate:** the wallet shows a 60-second signed pass token **without personal data** as a QR code; the terminal can
   verify it offline.
3. **Single entry:** on entry the bit in the revocation list is set to "used"; because the revocation list is published at a
   fixed interval, the gates in the same terminal group keep a **shared "used" list** that stops a second entry within the
   interval.
4. Since the organiser is both issuer and verifier, unlinkability is meaningless for this type; this is an accepted situation.
5. A terminal is defined only under a registered verifier (`terminal_groups[]`).
6. The access pass does not ask for a PIN at every display: this rests on a **time-limited consent with a defined scope** given
   by the person; consent can be withdrawn at any time and every display is recorded in the wallet (Annex A §3.7; wallet rules
   in [[SPEC-WALLET-0001]]).

## 5. Verification policy

| Policy                     | Required                                                                                                                                                                            |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `event-ticket` (reference) | `vct = EventTicket:1`; issuer in the `EVENTS` category and authorised for this type, at least I2; not revoked and not used; attributes requested only `event_id` and `ticket_class` |

The gate does not ask for the person's name, date of birth or contact details. The result has three values; `INDETERMINATE`
is not an entry.

## References

The decisions, specifications and standards this document rests on are listed in Annex E.

## Status

**Active** — version 1.0.0 (2 October 2026).
