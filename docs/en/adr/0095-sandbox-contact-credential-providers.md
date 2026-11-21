---
document_id: ADR-0095
title: "The source of contact credentials in the sandbox: the operator issues the phone credential, the e-mail provider the e-mail credential"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-21
last_updated: 2026-11-21
summary: >
  Today the verified e-mail and phone credentials (urn:tamga:contact:EmailAddress:1, PhoneNumber:1) are issued only by the Tamga
  identity service, with a one-time code (ADR-0021, FW-RB-0005). In the sandbox two fictional institutions issue the same types
  from their own records: Sinyalnet Mobil (a mobile operator) issues the phone number credential to its subscriber, Postakuş (an
  e-mail service) the e-mail credential to its user. Proof of possession is not a one-time code but signing in to the
  institution's own account (in the sandbox the person is chosen from a list). Format, validity, status and privacy rules are the
  same as ADR-0021. The real network does not change. Accepted: 2026-11-21.
domain: Credentials
translation_of: ADR-0095
source_version: 1.0.0
related: ["[[ADR-0021]]", "[[ADR-0038]]", "[[ADR-0093]]", "[[FW-RB-0005]]", "[[ADR-0010]]"]
---

# In short

The operator knows best whom a phone number belongs to, and the e-mail service knows best whom an e-mail address belongs to. In
Tamga today only Tamga's identity service issues these two credentials, by sending the person a code and checking it. This
decision proposes to show in the sandbox that the credential can also come from its actual source: the fictional operator
Sinyalnet Mobil issues a phone number credential to its subscriber, and the fictional e-mail service Postakuş issues an e-mail
credential to its user. The real network does not change.

# Context

- **ADR-0021.** Two contact credentials are defined: `urn:tamga:contact:EmailAddress:1` (`email`) and
  `urn:tamga:contact:PhoneNumber:1` (`phone_number`, E.164). Possession is proven with a one-time code (CT1); data is kept in memory
  only during the flow (CT2); the credential carries no identity data and no `category` (CT3). The rulebook ([[FW-RB-0005]]) names
  the issuer as "the Tamga Network identity service only".
- **The EU framework.** eIDAS 2.0 and the ARF define no separate type for contact data; it can come from any provider as a
  non-qualified EAA. In the browser e-mail verification draft the e-mail provider signs the address ([[ADR-0021]] Context). The
  actual source is therefore the operator and the e-mail service.
- **Sandbox demonstration network.** The name list (project management approval, 2026-11-19) has two institutions: Sinyalnet Mobil
  (`sinyalnet`, phone number credential) and Postakuş (`postakus`, e-mail credential). Both were postponed because "the issuer
  service needs code". The fictional people's numbers are in the `+44 7700 900xxx` range reserved for fiction and their e-mail
  addresses are at `@ornek.example`: codes cannot be sent to them.

# Decision

## K1 — Sandbox only

The decision is for the sandbox only ([[ADR-0038]]). In the real network the contact credential is still issued only by the Tamga
identity service; everything ADR-0021 and the rulebook say for the real network stays as it is.

## K2 — Two fictional source institutions

| Institution | Address | Issues | To whom |
|---|---|---|---|
| Sinyalnet Mobil | `sinyalnet` | `urn:tamga:contact:PhoneNumber:1` | its subscriber, for the registered number |
| Postakuş | `postakus` | `urn:tamga:contact:EmailAddress:1` | its user, for the registered address |

Both are issuer records in the TR national list: `category: OTHER` (the closed set has no telecom or e-mail category; a new
category is a separate decision), `class: EAA`, `assurance: I1` (no identity proofing). The schema authorisation covers only their
own type. The "(TEST)" mark is added by the system (SB4).

## K3 — Proof of possession: the institution's own account

The source institution sends the person no code; the person signs in to the institution's own account and the institution writes
the registered number or address into the credential. The person cannot have another number or address written. In the sandbox
there is no sign-in: the person is chosen from a list, as on the sandbox's fake identity page; the institution's record comes from
the fictional people's file. CT1 (proof by code) stays as it is for the identity service; for a source institution the proof is
the institution's own record.

## K4 — Format and rules as in ADR-0021

Type, attributes, SD-JWT VC only, validity at most 1 year, status list, no `category` claim (CT3), no number or address in logs
(CT2) all apply unchanged. For the verifier and the wallet the credential is no different from the one the identity service
issues; only the issuer differs, and the verification result shows the institution's name.

## K5 — Code

The hosted issuer opens the contact types to sandbox tenants: the tenant setting names the type and the record field
(`phone_number` / `email`), and the person's record is matched from the fictional people's file. The identity service's code flow
does not change.

# Rationale / alternatives

- **Proof by code in the sandbox too — rejected.** Codes cannot be sent to fictional addresses; a test inbox that can receive them
  (`email-relay`) does not show who the source is either.
- **Source institutions in the real network too — outside this decision.** A real operator's participation, the legal position
  and the category question (telecom) are a separate decision; the sandbox trial feeds into it.
- **A new category (`TELECOM`) — not now.** Adding a value to the closed set needs a separate ADR; `OTHER` is enough for the sandbox.

# Invariants

| Code | Rule |
|---|---|
| CS1 | A source institution's contact credential is issued only in the sandbox; in the real network only the identity service issues contact credentials. |
| CS2 | A source institution writes into the credential only the number or address in its own record; the person cannot have another value written. |
| CS3 | A source institution's credential follows ADR-0021's format, validity, status and privacy rules (CT2, CT3). |

# Open questions — settled on acceptance (2026-11-21)

1. Category `OTHER`; a telecom category is a separate decision if a real operator wants to join.
2. All 74 fictional people are Sinyalnet subscribers and Postakuş users.

# Status

**Accepted — 2026-11-21** (project management approval). CS1–CS3 are binding.
Implementation order: sandbox PKI (two institution
certificates) → two records in the TR sandbox list → contact types in the hosted issuer → portal page.
