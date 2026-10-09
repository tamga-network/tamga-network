---
title: "Identity Rulebook"
translation_of: FW-RB-0003
source_version: 1.0.0
outline: [2, 3]
---

# Identity Rulebook

<div class="arf-meta">

**Document** FW-RB-0003 · **Version** 1.0.0 · **Status** Active · **Updated** 2026-10-09 · **Licence** CC BY 4.0
Official English translation of the Turkish source text; in case of conflict the Turkish text prevails.

</div>

The rulebook for the identity credential Tamga issues as the provisional identity credential provider
(`urn:tamga:id:IdentityAttestation:1`), branching from the Tamga [[t:rulebook|Rulebook]] ([[FW-RB-0001]]): who issues it, with which [[t:identity-proofing]], which attributes and which
selective disclosure rule; validity and [[t:revocation]]; the two formats ([[t:SD-JWT-VC]] + ISO 18013-5 [[t:mdoc]]); rules for institutions
and verifiers; hand-over to a state [[t:PID]] provider. Written on the pattern of the EUDI [[t:ARF]] PID Rulebook — this document is not a
PID but an [[t:EAA]]. §10: the driving licence information the same service issues
(`urn:tamga:id:DrivingLicenceAttestation:1`) — not an official driving licence.

## 0. Scope and status

| Type                                       | `vct`                                                                         | Catalogue                                                                        |
| ------------------------------------------ | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Tamga identity credential                  | `urn:tamga:id:IdentityAttestation:1`                                          | `schemas.tamga.network/v1/id/IdentityAttestation/1.0.0`                          |
| The same credential as mdoc                | docType = `vct`, namespace `tamga.id.1`                                       | [[ADR-0013]]                                                                     |
| ZK copy (zero-knowledge presentation only) | `urn:tamga:id:ShortLivedIdentityAttestation:1` (mdoc, namespace `tamga.id.1`) | `schemas.tamga.network/v1/id/ShortLivedIdentityAttestation/1.0.0` · [[ADR-0044]] |

The technical definition is in [[SPEC-ID-0003]] §9 and the schema catalogue; in a conflict they prevail. This rulebook creates
no new rules; it gathers [[ADR-0011]], [[ADR-0013]], [[SPEC-ID-0003]] and the RB-AP-ID rules of Annex B in one place,
from the point of view of institutions and verifiers.

**Status:** this document is **not a PID**. While no state-appointed PID provider exists, it is an **EAA** that Tamga issues
provisionally, as a non-qualified EAA; `pid_providers[]` stays empty in the trusted
list. When a state provider is appointed, issuance stops and the entry is handed over to the
successor (§8).

## 1. Data model

| Attribute                                               | Type                                                                                          | Selective disclosure              | Note                                                                                                                                               |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `given_name`, `family_name`                             | string                                                                                        | `always`                          |                                                                                                                                                    |
| `birthdate`                                             | date (YYYY-MM-DD)                                                                             | `always`                          | EU PID name; `birth_date` (full-date) in mdoc — [[ADR-0045]]                                                                                       |
| `nationalities`                                         | array of ISO 3166-1 alpha-2 codes                                                             | `always`, each element separately | EU PID name; `nationality` (array) in mdoc; `QU` if unknown, `QS` if stateless                                                                     |
| `personal_administrative_number`                        | string                                                                                        | `always`                          | National identity number; **only in this type**                                                                                                    |
| `document_type`                                         | `ID_CARD` \| `PASSPORT` \| `RESIDENCE_PERMIT` \| `DRIVING_LICENSE`                            | `always`                          | The document that was verified                                                                                                                     |
| `document_number_hash`                                  | `sha256-…`                                                                                    | `always`                          | **Keyed** digest of the document number (HMAC-SHA256; key held only by the identity service) — not the number, and not recoverable from the digest |
| `issuing_country`                                       | ISO 3166-1 alpha-2                                                                            | `always`                          | The country that issued the inspected identity document (in the EU PID the same name is the PID provider's country — §9)                           |
| `document_chip_verified`                                | boolean                                                                                       | `always`                          | Whether the NFC chip was read (a fact, not a level)                                                                                                |
| `verification_method`                                   | `remote-document-liveness-face` \| `remote-nfc-liveness-face` \| `in-person` \| `review-demo` | `always`                          | `review-demo` only in the test credential issued for app store review                                                                              |
| `age_over_18`                                           | boolean                                                                                       | `always`                          | Derived; for age checks only this attribute is disclosed                                                                                           |
| `status`, `category`, `cnf`, `vct`, `iss`, `iat`, `exp` | —                                                                                             | `never`                           | Transport profile                                                                                                                                  |

**Not included:** portrait/photo, address, document images, an assurance level ([[t:LoA]]) attribute. All
personal attributes are selectively disclosable; a [[t:verifier]] may request only the attributes in its registered scope.

## 2. Who issues it

| Requirement               | Value                                                                                                                                                                       |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Issuer                    | The Tamga Network identity service (`id.tamga.network`) — the only issuer; institutions cannot issue this type                                                              |
| Category / class          | `IDENTITY` · `EAA` · I2                                                                                                                                                     |
| Credential type authority | Only in the identity service's entry (allow-list)                                                                                                                           |
| Key                       | The identity service's credential signing key; a separate revocation list key (RB-AP-03)                                                                                    |
| Role                      | Provisional identity credential provider — not a PID Provider                                                                                                               |
| App store review          | A separate test signer `tamga-id-review` (I1; `verification_method: review-demo`, at most 7 days); issued only with a single-use review code; passes no policy requiring I2 |

## 3. Identity proofing before issuance

| Path                                     | Level                                | Note                                                             |
| ---------------------------------------- | ------------------------------------ | ---------------------------------------------------------------- |
| Remote: document + liveness + face match | **T2** (ETSI TS 119 461 Substantial) | `verification_method: remote-document-liveness-face`             |
| Remote + NFC chip                        | T2; `document_chip_verified: true`   | Technically high; legally T3 is a qualified electronic signature |
| In person                                | T2                                   | `in-person`                                                      |

Rules: identity verification happens only in the identity service; institutional issuers, the wallet and verifiers do not
talk to the provider. Before verification starts, an **information notice is shown and explicit consent is obtained**.
The provider's decision is always confirmed from its decision endpoint; the webhook is only a trigger. A
provider outage does not lower the level; issuance stops.

**There is no age limit** (2026-10-08, [[ADR-0043]]): no minimum age is required for the identity credential; the condition is
identity verification with a valid identity document. A guardian-consent flow for children is handled by a separate decision
after legal review.

## 4. Data protection

- Tamga is the **data controller** for this data.
- Personal attributes are not kept after issuance; the permanent record is only an opaque `subject_ref`, the document number
  digest, the validity period and the revocation list positions. Document images, selfies, video and raw OCR data are never stored at Tamga.
- An erasure request revokes the credential.
- No second active identity credential is issued for the same document number; re-verification revokes the older one.

## 5. Validity and revocation

| Topic                  | Rule                                                                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Validity               | `exp` = issuance + 730 days (≤ 2 years); re-verification after expiry                                                               |
| Revocation list        | **Mandatory** (Token Status List)                                                                                                   |
| Reasons for revocation | the person's deletion request, re-verification with the same document, reported loss/theft of the document, an incorrect credential |
| Copies                 | 10 copies, each on a different device key; a different copy per verifier                                                            |

## 6. Two formats: SD-JWT VC and mdoc

The same credential is issued as SD-JWT VC (primary) and as ISO/IEC 18013-5 mdoc:

- The data, `iat/exp` and the [[t:holder]] key are identical in both formats. The name and encoding in each format follow the EU PID
  table ([[ADR-0045]]): SD-JWT VC `birthdate`, `nationalities` ↔ mdoc `birth_date` (full-date, #6.1004), `nationality` (array); the
  other names are the same.
- The mdoc signature is ES256 and maps to the same [[t:trust-anchor]]; the result is three-valued.
- The verifier chooses the format with [[t:DCQL]]; e.g. an age check in a browser asks for `age_over_18` only, through mdoc.

### 6.1 Zero-knowledge proofs: ZK copies ([[ADR-0044]])

A presentation with [[t:ZK]] does not disclose the position in the revocation list. So with ZK it is not the main identity
credential that is shown but a **short-lived ZK copy** issued separately by the identity service:

| Topic      | Rule                                                                                                                                                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Type       | `urn:tamga:id:ShortLivedIdentityAttestation:1`; mdoc only, only in ZK presentations                                                                                                                                                                                      |
| Content    | Only elements that can be proven with ZK (today `age_over_18`)                                                                                                                                                                                                           |
| Validity   | At most 24 hours, never beyond the main credential's expiry; no revocation list entry — short validity replaces revocation (EU ARF VCR_01)                                                                                                                               |
| Issuance   | In small batches with the refresh token that comes with the identity credential; the wallet refreshes them without asking the user. The token holds only the minimum elements, in a form only the identity service can open; no person fields on the server              |
| Revocation | No new copy is issued while the main credential is revoked or suspended; revocation takes effect for ZK within 24 hours at most                                                                                                                                          |
| Verifier   | Because the proof binds the type, the verifier sees that it is short-lived and expects no revocation check (`status: NOT_APPLICABLE`, reason: short validity). It accepts a ZK presentation that is not of this type (unmarked) only if its policy explicitly accepts it |

The rules are in the Tamga Rulebook, RB-AP-ID-11.

## 7. Presentation and verification rules

| Use                                                              | Attributes requested                                                       | Rule                                                                                                                                                                              |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Age check                                                        | `age_over_18`                                                              | No other attribute is requested                                                                                                                                                   |
| Matching records at an institution (before issuing a credential) | `personal_administrative_number`, `birthdate`, `given_name`, `family_name` | The institution's issuing service receives them only within its registered scope and through the full verification pipeline; it does not store or log matching keys (RB-RP-ID-01) |
| "Holds a valid Tamga identity"                                   | none                                                                       | Reference policy `event-tamga-id`                                                                                                                                                 |
| Website sign-up / sign-in ("Sign in with Tamga")                 | `given_name`, `family_name` at sign-up; none at sign-in                    | The account key is the per-site pseudonym; `document_number_hash` and the national ID number are not requested (RB-RP-13)                                                         |
| High-risk transaction                                            | per scope                                                                  | Face matching, if needed, is the verifier's responsibility; the credential carries no portrait                                                                                    |

- A verifier requesting the identity number must have that attribute explicitly in its registration; the wallet flags
  out-of-scope requests.
- The result is three-valued; `INDETERMINATE` is not acceptance.
- The verifier must see the [[t:issuer]] in the trusted list in the `IDENTITY` category and authorised for this type.
- **[[t:pseudonym|Pseudonym]] seed**: together with the identity credential a separate type that cannot be presented,
  `urn:tamga:id:PseudonymSeed:1` is issued; the seed is derived with a separate key from the person's stable identifier (in
  Türkiye the national ID number; otherwise country + document type + document number — pseudonyms then change when the document
  is renewed) and is not stored. The wallet derives a per-site pseudonym from it (RB-AP-ID-07).

## 8. Hand-over — state PID provider

When a state appoints a PID provider: the identity service's entry is handed over with `successor_id`, new issuance stops,
and credentials already issued stay valid until they expire. Verifier policies are
updated to prefer the state PID; this type becomes `DEPRECATED` but stays verifiable.

## 9. EU personal identification data (PID) and driving licence (mDL)

Tamga verifiers recognise the EU PID and the ISO driving licence ([[t:mDL]]) as **external types**:

| Type                      | Format    |
| ------------------------- | --------- |
| `urn:eudi:pid:1`          | SD-JWT VC |
| `eu.europa.ec.eudi.pid.1` | mdoc      |
| `org.iso.18013.5.1.mDL`   | mdoc      |

- **Recognition condition.** An external type is accepted only if its issuer is in the scope of an external list (Annex A §6.1)
  that vouches for that type. Today the list of lists contains no external list; each one is added by a separate decision.
- **Nested [[t:selective-disclosure]].** In the EU PID the address is an object and nationalities are an array. The person can reveal
  only what is needed: for example only the city of the address, or one of the nationalities. The verifier's scope check applies
  to the attribute itself or to its parent.
- **Age.** The EU PID has no age attributes; in the EU a separate age verification [[t:credential]] is used for age. The mDL carries age
  elements such as `age_over_18`.

The Tamga identity credential uses the EU PID names and encoding (Implementing Regulation (EU) 2026/1731; [[ADR-0045]]). The
type and namespace are Tamga's (the credential is not a PID):

| Tamga identity credential (SD-JWT VC)                                                    | Tamga identity credential (mdoc, `tamga.id.1`) | EU PID (SD-JWT VC)                              | EU PID (mdoc)                    |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------- | -------------------------------- |
| `given_name`                                                                             | `given_name`                                   | `given_name`                                    | `given_name`                     |
| `family_name`                                                                            | `family_name`                                  | `family_name`                                   | `family_name`                    |
| `birthdate`                                                                              | `birth_date` (full-date)                       | `birthdate`                                     | `birth_date` (full-date)         |
| `nationalities` (array)                                                                  | `nationality` (array)                          | `nationalities` (array)                         | `nationality` (array)            |
| `personal_administrative_number`                                                         | `personal_administrative_number`               | `personal_administrative_number`                | `personal_administrative_number` |
| `issuing_country` (country that issued the document)                                     | `issuing_country`                              | `issuing_country` (country of the PID provider) | `issuing_country`                |
| `age_over_18`                                                                            | `age_over_18`                                  | — (separate age verification credential)        | —                                |
| `document_type`, `document_number_hash`, `document_chip_verified`, `verification_method` | the same                                       | no equivalent (Tamga-specific)                  | no equivalent                    |

The name `issuing_country` is the same but its meaning differs: in the Tamga credential it is the country that issued the
inspected identity document, in the EU PID the country of the PID provider.

When a state PID is available (§8), institutions may also accept the PID instead of the Tamga identity credential to match a
person; this is enabled by a separate decision.

## 10. Driving licence information (`urn:tamga:id:DrivingLicenceAttestation:1`)

The identity service's second personal credential ([[ADR-0039]]): the person's physical driving licence card is inspected
remotely (document + liveness + face match) and the categories and dates on the card are issued as a credential. **It is not an
official driving licence and not an [[t:mDL]];** it is not used in traffic checks or official procedures. The credential says so
through the always-visible `not_official_licence` claim, its display name ("Driving licence information — not a substitute for an
official driving licence") and its card; verifier screens show the same statement.

| Topic               | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Catalogue           | `schemas.tamga.network/v1/id/DrivingLicenceAttestation/1.0.0`; SD-JWT VC only (no mdoc)                                                                                                                                                                                                                                                                                                                                                    |
| Issuer              | The identity service only (`IDENTITY` · `EAA` · I2); institutions cannot issue it; no `category` claim                                                                                                                                                                                                                                                                                                                                     |
| Prerequisite        | The **active Tamga identity credential** in the wallet is presented (given name, family name, date of birth only); the name and date of birth on the card must match it. No credential if they do not match, if the card is not a driving licence, if it has expired or if the categories cannot be read                                                                                                                                   |
| Attributes          | `given_name`, `family_name`, `birth_date` (if present), `issuing_country`, `document_number_hash` (keyed digest), `driving_privileges` (`[{ category, issue_date?, expiry_date? }]`; EU 2006/126 category codes, national additions as they are), `licence_issue_date` (if present), `licence_expiry_date`, `verified_at` (day), `verification_method`, `age_over_18`, `not_official_licence` (always `true`, not selectively disclosable) |
| Not included        | National ID number, restriction and health codes (field 12; no `has_restrictions` fact either), photo, signature, address; the provider's note fields are never read                                                                                                                                                                                                                                                                       |
| Validity            | `exp` = the earlier of the card's expiry and one year after inspection; automatic refresh does not extend it                                                                                                                                                                                                                                                                                                                               |
| Revocation          | Revocation list mandatory. Reasons: the person's request, an erasure request, re-verification with the same card (the old one), wallet unit revocation, **revocation, re-issuance or erasure of the linked identity credential** (cascade)                                                                                                                                                                                                 |
| Data protection     | Tamga is the controller; notice and explicit consent are specific to the driving licence; personal attributes are not kept after issuance; name and date of birth are not sent to the provider — matching happens at the identity service with a keyed digest                                                                                                                                                                              |
| Competent authority | Once a country's competent authority starts issuing digital driving licences, Tamga no longer issues this type for that country; the entry points to the official type via `successor` (the `org.iso.18013.5.1.mDL` of §9 is already recognised as an external type)                                                                                                                                                                       |
| Law                 | Legal review before issuance to real people is switched on; the sandbox does not wait for it                                                                                                                                                                                                                                                                                                                                               |

The rules are RB-AP-ID-08…10 in the Tamga Rulebook; the source is [[ADR-0039]] DL1–DL5.

## References

The decisions, specifications and standards this document rests on are listed in Annex E.

## Status

**Active** — version 1.0.0 (2 October 2026).
