---
document_id: ADR-0039
title: "Verified driving licence information"
status: Active
version: 1.0.0
created: 2026-10-03
last_updated: 2026-10-04
summary: >
  The Tamga identity service inspects a person's physical driving licence with its remote identity verification provider
  (document + liveness + face match) and issues the driving information printed on the card (categories, validity, issuing
  country) as a non-qualified EAA: `urn:tamga:id:DrivingLicenceAttestation:1`, display name "Driving licence information".
  This credential is not an official driving licence and not a mobile driving licence (mDL): it is not valid in traffic checks
  and says so plainly on the card. The prerequisite is the identity credential in the wallet; SD-JWT VC only; no national ID
  number, restriction or health information; validity is the card's expiry or one year. Once a competent authority starts
  issuing digital driving licences, new issuance stops.
domain: Credentials
translation_of: ADR-0039
source_version: 1.0.0
---

# In brief

In car rental, car sharing, courier work and driver hiring the other side asks: "does this person hold a valid driving
licence, and for which categories?" Today it does so by taking a photo of the card. With this decision the person has the card
verified once by the Tamga identity service and carries the result in the wallet. The credential says: "on this date this
person showed a genuine-looking driving licence card that matched their face; the card listed these categories and this
validity". It is not the driving licence itself.

# Context

- Project management (2026-10-03) put the driving licence into the pre-store scope and asked for it to be issued the same way
  as the identity credential, through the remote identity verification provider. Since it is a new credential type, this
  decision was written first; acceptance was tied to confirming that the provider reads the categories.
- **In the EU a digital driving licence is an official document.** An [[t:mDL]] (ISO/IEC 18013-5 mobile driving licence) can
  only be issued by the authority competent to issue driving licences. The EU's new driving licence directive (2025) ties the
  digital driving licence to the competent authority of the member state and defines it for carriage in the
  [[t:EUDI-Wallet]]. In Türkiye driving licences are issued by the General Directorate of Population and Citizenship Affairs.
  Tamga is none of these authorities.
- [[ADR-0011]] and [[ADR-0022]] define the Tamga identity service as a provisional issuer that operates until the state
  appoints a provider (`class: EAA`, `assurance: I2`). Under [[ADR-0021]] the same service also issues email and phone
  credentials. Driving information falls within the same role: **a non-qualified [[t:EAA]]**, the kind anyone may issue.
- **Provider finding (2026-10-04).** The remote identity verification provider's field definitions were checked: the driving
  licence is a separate document type (`document_type = DL`); the card yields the document number, issuing country, issue and
  expiry dates, an "expired" fact and **per-category validity dates** (`dl_class_code_<category>_from` / `_to`; AM, A1, A2, A,
  B1, B, BE, C1, C1E, C, CE, D1, D1E, D, DE and national additions F, G, M …). There is no separate field for restriction codes;
  there is a free-text `_notes` field per category, and that field is **never read**. Which document types are accepted is
  configured per flow at the provider (`documents_allowed`), so a separate flow is defined for driving licences.
- Inspecting the card shows that the card is genuine and that the person is its holder. **It does not show whether the
  licence is currently suspended or revoked:** Tamga has no access to the official register. The credential carries this
  limit openly.

# Decision

## K1 — What it is, and what it is not

The credential is **verified driving licence information** as of the moment the card was inspected. It is not an official
driving licence, not an mDL, and is not used in traffic checks or official procedures. It says so plainly in four places:

- The display name and description in the schema metadata: "Driving licence information — not a substitute for an official
  driving licence."
- A claim inside the credential that is always visible (never selectively disclosed): `not_official_licence: true`, with the
  display label **"Not an official driving licence."** (Turkish: "Resmî sürücü belgesi yerine geçmez."). Every verifier sees it.
- The same statement on the front of the card in the wallet.
- On verifier screens (Tamga Verify, sample sites), next to the result, the same statement.

The card does not look like an official driving licence: no EU driving licence pattern, flag, crescent and star, state coat
of arms or "T.C.".

## K2 — Type name

Project management (2026-10-04) chose option A:

| | Value |
|---|---|
| [[t:vct]] | `urn:tamga:id:DrivingLicenceAttestation:1` (same family as the identity service's other types) |
| Display name | **"Driving licence information"** / **"Sürücü belgesi bilgisi"** |
| Catalogue path | `id/DrivingLicenceAttestation/1.0.0` |

ISO and EU names are not used: the `org.iso.18013.5.1.mDL` docType and the `org.iso.18013.5.1` namespace belong to the
competent authority alone; using them would lead people to mistake the credential for an official mDL. Product and store texts
do not say "driving licence" on its own, "digital driving licence" or "mobile driving licence". The other names considered
(`DrivingLicenceCheck`, `DrivingEntitlementInfo`, a `mobility:` domain) are in the Rationale.

## K3 — Fields (minimum personal data)

| Claim | Required | Selective disclosure | Note |
|---|---|---|---|
| `given_name`, `family_name` | ✓ | ✓ | from the card; lets the verifier match the person |
| `birth_date` | ○ | ✓ | from the card; `age_over_18` derived |
| `driving_privileges` | ✓ | ✓ (array as a whole) | `[{ category, issue_date?, expiry_date? }]`; `category` as printed on the card (`B`, `A2`, `C1E` …; EU 2006/126 codes, national additions as they are). Named like the ISO 18013-5 data element; the structure is Tamga's. In the development stage the array is a single disclosable claim; per-category disclosure is for a later version |
| `issuing_country` | ✓ | ✓ | ISO 3166-1 alpha-2 |
| `licence_issue_date` (○), `licence_expiry_date` (✓) | | ✓ | the card's own dates |
| `document_number_hash` | ✓ | ✓ | keyed hash of the document number (HMAC-SHA256; as in the identity credential); not the number itself |
| `verified_at` | ✓ | — | day the card was inspected (date, no time) |
| `verification_method` | ✓ | ✓ | `remote-document-liveness-face` |
| `not_official_licence` | ✓ | — | always `true`; the K1 statement |
| `iat`, `exp`, `status` | ✓ | — | K5 |

**None of these:**

- National ID number (TCKN): printed on newer Turkish cards, but carried only in the identity credential
  ([[SPEC-ID-0003]]/IDP10).
- Restriction and additional codes (field 12 of the card): some are **health information** such as glasses or hearing aids
  (special category under KVKK art. 6). The codes are not carried, and neither is a `has_restrictions` fact (project
  management, 2026-10-04). The provider's `_notes` fields are never read.
- Photo, signature, address, place of birth, issuing office.

There is no `category` claim (not qualified, not a public-body credential; same as [[ADR-0022]] K2).

## K4 — Flow: the identity credential is the prerequisite

The flow uses the same protocol as the identity credential ([[t:OpenID4VCI]] authorization code + PAR, [[t:WIA]] required); the
prerequisite is the **Tamga identity credential** in the wallet (project management, 2026-10-04: option B):

1. In the wallet the person chooses "Add credential → Driving licence information". The wallet adds a **presentation of the
   identity credential** to the PAR request (`identity_presentation`: [[t:SD-JWT-VC]] + [[t:KB-JWT]], `aud` = the identity
   service, `nonce` from the service's `/nonce` endpoint, single use; only `given_name`, `family_name`, `birth_date` are
   disclosed). The two parties are already in the same OpenID4VCI session; no separate OpenID4VP request/response round is opened.
2. The identity service verifies the presentation: its own signature, an active (not revoked, not expired) identity credential,
   only the three claims. It keeps no personal attributes; the flow record holds only a keyed **match digest** (given name +
   family name + date of birth) and the id of the linked identity record.
3. In the browser a driving-licence-specific notice and explicit consent page opens (the K1 statement is there too). At the
   provider a **separate flow that accepts only driving licences** starts: document + liveness + face match.
4. Result: if the name and date of birth on the card match the same digest (Turkish characters and case normalised), the
   credential is issued. If not, it is not issued and the person is told why. If the card is not a driving licence, is expired,
   or **the categories cannot be read, the credential is not issued** (no category-less credential; project management,
   2026-10-04).
5. If the provider's decision is "review" or "declined", the identity credential's rules apply unchanged ([[ADR-0011]] K6).

Requiring the identity credential means the person's face is matched against two documents in two separate sessions and ties
the credential to the identity in the person's wallet. The cost is a second provider session (Rationale, option B). The app
store review code ([[ADR-0033]]) is not used for this type.

## K5 — Lifecycle

- `exp` = the earlier of the card's expiry date and **1 year** after the day the card was inspected. Since Tamga cannot see a
  later suspension of the card, the credential is refreshed by re-verification once a year.
- The credential carries a [[t:status-list]] entry. Tamga revokes it: at the person's request, on an erasure request
  (`/erasure`), when a new credential is issued for the same document number hash (the old one), when the wallet unit is
  revoked ([[ADR-0025]]) and **when the linked identity credential is revoked or re-issued** (cascade: the driving licence
  information record is linked to the identity record). Erasure of the identity credential erases the linked credential too.
- Automatic copy refresh ([[ADR-0023]]) is on; refresh does not re-inspect the card and does not extend the validity.

## K6 — Format

[[t:SD-JWT-VC]] only. No [[t:mdoc]] representation (project management, 2026-10-04): [[ADR-0013]] reserved the second format
for the identity credential; a "driving licence" mdoc presented in person (ISO 18013-5) increases the risk of it being taken for
an official document by official mDL readers.

## K7 — Trust list and schema

- The type is added to the Tamga identity service's [[t:trust-list]] entry (`class: EAA`, `assurance: I2`), in the real
  network's and the sandbox's lists.
- The schema is corrected in place during the development stage ([[ADR-0029]] K1): first version `1.0.0`, changed on the same
  path until field names are settled; test credentials are re-issued.
- In the sandbox ([[ADR-0038]]) the same type is issued with the fake provider and sample people; some sample people have a
  made-up driving licence (one of them expired).
- The driving licence flow at the provider is configured by a setting; if it is not configured, the type is not announced in
  the metadata and requests are rejected (same pattern as [[ADR-0021]] K5).

## K8 — When a competent authority arrives

Under the TDT-first principle (D-GOV-5) this type is provisional:

- Once a member state's competent authority starts issuing digital driving licences (an official mDL or its SD-JWT VC
  counterpart), Tamga's new issuance for that country stops. The trust list entry points to the official type via
  `successor`; credentials already issued stay valid until they expire.
- The official credential comes with its own type (ISO/EU docType); the Tamga type is neither converted into it nor handed
  over. If the authority wishes, it may use the issuing service Tamga hosts with `on_behalf_of`; the type is still the
  official one.
- During the transition verifiers may ask for both types ([[t:DCQL]] `credential_sets`: the official type or the Tamga type).

## K9 — Store and law

- **Impression of a state app:** store texts, screenshots and in-app texts do not say "driving licence" on its own, "digital
  driving licence" or "official"; the card carries the K1 statement. The Google "Government apps" declaration stays **no**.
- **Identity documents and face data:** notice and explicit consent before handing over to the provider (as in the identity
  flow, with a driving-licence-specific text).
- **KVKK:** Tamga is the controller for this data; the notice and explicit consent text covers the driving licence. No health
  information is collected (K3).
- **Legal review:** **before** issuance to real people is switched on, a lawyer assesses the risk of the credential being taken
  as an imitation of, or used instead of, an official document (forgery provisions of the Turkish Penal Code, the Highway
  Traffic Law) and the liability of verifiers who hand over a vehicle on the basis of this credential. The sandbox and the
  development environment do not wait for this review.
- The verifier's registered purpose is stated (e.g. "driving information check before car rental"); the
  [[t:registration-certificate]] ([[ADR-0026]]) carries it.
- **Cost and quota:** each driving licence issuance is a second provider session; accepted, the monthly quota is monitored.

# Rationale / alternatives

| Option | Outcome | Why |
|---|---|---|
| Issue with the official mDL docType (`org.iso.18013.5.1.mDL`) | rejected | Only the competent authority may issue it; counts as imitating an official document; highest store and legal risk |
| Type name B `DrivingLicenceCheck`, C `DrivingEntitlementInfo`, D `mobility:` domain | rejected | A matches the family's naming and is familiar to readers; "attestation" signals it is not an official document |
| A — Separate flow, no prerequisite (driving licence session only) | rejected | Shorter; but the credential is not tied to the identity in the wallet and is issued to people without an identity credential |
| **B — Separate flow, identity credential presentation required** | **accepted** | Strong person and identity binding; identity fields from a single source; the credential carries only driving information |
| C — Do identity verification with the driving licence and issue both at once | rejected | The identity credential's prerequisite and fields would depend on the driving licence; the two lifecycles get mixed |
| Add driving information to the identity credential | rejected | Everyone should have the identity credential; driving information needs its own lifecycle and limits |
| Ask for the presentation in a separate OpenID4VP round | rejected | Wallet and service are already in the same OpenID4VCI session; the presentation travels in the PAR (same pattern as the erasure request), no extra round or second browser hand-over |
| Issue a category-less credential when categories cannot be read | rejected | The value of the credential lies in the categories; a category-less credential would mislead |
| Wait for the state's digital driving licence | rejected (for now) | No date; K8 keeps the path open |

# Invariants

| Code | Rule |
|---|---|
| **DL1** | Tamga's driving licence information credential does not use the official mDL docType or namespace; its metadata, its `not_official_licence` claim, its card and the verification result state that it is not a substitute for an official driving licence. |
| **DL2** | The credential carries no national ID number, restriction or health code, photo or address; the document number appears only as a keyed hash; the provider's note fields are never read. |
| **DL3** | The credential's validity does not exceed the card's expiry date or one year from the day the card was inspected; automatic refresh does not extend it. |
| **DL4** | Once a country's competent authority starts issuing digital driving licences, Tamga no longer issues this type for that country. |
| **DL5** | The credential is issued only upon presentation of an active Tamga identity credential from the wallet and only if the name and date of birth on the card match that identity; it is not issued if the categories cannot be read or the card has expired; when the linked identity credential is revoked, re-issued or erased, this credential is revoked or erased too. |

# Consequences

- `packages/schemas`: new type (development stage, `1.0.0`); K1 statement in display name and description; the
  `not_official_licence` claim.
- Identity service (operator repository): identity presentation check at the PAR, a provider flow specific to driving licences
  (separate flow ID), mapping that reads category and date fields, match digest, issuance of the new type (SD-JWT VC only),
  revocation linked to the identity record; erasure covers this type too.
- Trust list: new type in the identity service's entry (real network + sandbox).
- Wallet: "Add credential" menu, identity presentation in the PAR, card statement, field labels; store texts and privacy policy.
- Tamga Verify and sample sites: a "car rental" sample verification; K1 statement on the result screen (next step).
- Framework documents: new type and DL rules in the Identity Rulebook.

# Open questions (project management)

1. **Namesake risk.** The card is matched to the identity credential only by **given name + family name + date of birth** (K4).
   Two people with the same name and date of birth could bind each other's card to their own identity; the face match, done in
   two separate sessions against two separate documents, is the real barrier, but there is no direct link between the identity
   and the card. Option: fold the **national ID number** printed on Turkish cards into the match digest (HMAC) only, without
   writing it into the credential — the number on the identity credential and the number on the card must give the same digest;
   the number is stored nowhere and never enters the credential (DL2 holds). Cards without a national ID number (other countries)
   keep today's matching. Decision pending; no code change made.

# Status

**Accepted — 2026-10-04.** By project management approval: type name A, identity credential prerequisite (B), no credential
when categories cannot be read, no restriction fact, no mdoc, legal review before real issuance, second provider session
accepted. Implementation started once the provider was confirmed to read the categories. DECISIONS: D-ID-8.
