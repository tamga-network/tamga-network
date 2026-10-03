---
document_id: ADR-0021
title: "E-mail and phone credentials"
status: Active
version: 1.0.0
created: 2026-09-29
last_updated: 2026-10-02
summary: >
  The Tamga identity service issues two new credential types for an e-mail address and a phone number whose ownership is
  proved with a one-time code: `urn:tamga:contact:EmailAddress:1` and `urn:tamga:contact:PhoneNumber:1`. Non-qualified EAA;
  SD-JWT VC only; a person may add several addresses; Tamga does not keep the address after issuance. Delivery providers are
  chosen by configuration; if none is configured, the type is not announced.
domain: Credentials
translation_of: ADR-0021
source_version: 1.0.0
---

# Context

Sites and institutions today verify a person's e-mail address or phone number by sending their own codes: every site pays
for its own SMS/e-mail, and the person waits for the same kind of code at every sign-up. In Tamga Wallet this proof can be
obtained once and kept; instead of sending a code, the site asks for the credential (the same "verify once, use everywhere"
principle as [[ADR-0011]]).

**EU framework (review, 2026-09-29).** [[t:eIDAS]] 2.0 and the EUDI [[t:ARF]] foresee no separate [[t:PID]] field and no
defined [[t:attestation]] type for e-mail or phone; such information can be issued by any provider as a non-qualified
electronic attestation of attributes ([[t:EAA]]). A similar effort is under way in the browser world (a draft e-mail
verification protocol: proof of an address with an SD-JWT signed by the e-mail provider). This decision does not conflict
with it; in format it follows the same road as [[t:SD-JWT-VC]].

# Decision

## K1 — Two credential types

| vct | Claim | Form |
|---|---|---|
| `urn:tamga:contact:EmailAddress:1` | `email` (lower-cased) | selective disclosure |
| `urn:tamga:contact:PhoneNumber:1` | `phone_number` (E.164, e.g. `+905321234567`) | selective disclosure |

New [[t:vct]] domain `contact` ([[ADR-0010]] URN format). Metadata is in the catalogue, `#integrity` mandatory; validity
1 year, with a [[t:status-list]]. A person may add several addresses; each address is a separate credential.

## K2 — Proof of ownership: a one-time code

The flow is the same as for the identity credential ([[t:OpenID4VCI]] authorization code + [[t:PAR]] + PKCE + [[t:WUA]]):
the wallet opens the Tamga identity service in the browser, the person types the address, a 6-digit code goes out by e-mail
or SMS, and the credential is issued when the correct code is entered.

- The code is valid for 10 minutes, at most 5 attempts; at most 3 sends per flow and at most 5 sends per address per hour.
- The code is held in memory only as a digest; comparison is constant-time.
- No [[t:identity-proofing]] is needed: the credential says only "this address was in the hands of this wallet", not who
  the person is.

## K3 — Data and logs

- The address is held in memory only for the duration of the flow and deleted after issuance. Only a keyed digest of the
  address is written to the database (when the same address is proved again, the old credential is revoked).
- No address, number or code is written to the log (not even masked). On screen the address is shown only masked.

## K4 — Format and category

SD-JWT VC only; no [[t:mdoc]] representation is issued ([[ADR-0013]] is specific to the identity credential). There is no
`category` claim: the credential is not qualified and is not a public-sector attestation.

## K5 — Delivery providers

The provider is chosen by configuration; if none is configured, the type is not announced in the metadata and requests are
rejected.

| Channel | Option | Status |
|---|---|---|
| E-mail | HTTP e-mail API (`resend`) | test and pilot |
| SMS | `email-relay` — the SMS text e-mailed to a test inbox | **test only** |
| SMS | a domestic SMS provider (`netgsm`, approved sender name) | code ready, not enabled before the pilot |
| Both | `log` — code to the console | local development only; start-up error in production |

# Options considered

| Option | Result | Why |
|---|---|---|
| Adding the address to the identity credential | rejected | The identity credential depends on identity proofing; an address changes often and there may be several |
| E-mail + phone in one credential | rejected | Separate proofs, separate life cycles; the person must be able to show just one |
| Making identity proofing a precondition | rejected | Unnecessary data; ownership proof is independent of identity |
| Entering the code in the wallet | later | The browser flow is shared with the identity credential; an in-app screen comes at the product stage |

# Invariants

| Code | Rule |
|---|---|
| CT1 | A contact credential is issued only after the code has been entered correctly; the code is single-use, time-limited and attempt-limited. |
| CT2 | Address, number and code are never written in plain form to logs, event records or the database; only a keyed digest is stored. |
| CT3 | A contact credential carries no identity data (name, Turkish ID number, date of birth) and contains no `category` claim. |
| CT4 | Test delivery paths (`log`, `email-relay`) are not used in an environment open to real users. |

# Consequences

- `packages/schemas`: two types (EmailAddress 1.0.0, PhoneNumber 1.0.0). Trust list: the Tamga identity service is
  authorised for both types.
- `apps/id` (operator repository): address + code screens (English / Turkish), delivery providers, limits; settings
  `TAMGA_CONTACT_*`, `TAMGA_RESEND_API_KEY`, `TAMGA_NETGSM_*`.
- Wallet: Credentials → "Add credential" menu adds a verified e-mail / phone; credential names and field labels are in the
  dictionary.
- The institution ADR (the authentic source is the institution, [[ADR-0020]]) has the institution send the offer e-mail; the
  contact credential lets the person present the address at which the institution can reach them.

# Status

**Accepted — 2026-09-29.** Names and scope approved by project management. DECISIONS: D-CONTACT-1.
