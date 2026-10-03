---
title: "Identity Rulebook"
translation_of: FW-RB-0003
source_version: 1.0.0
outline: [2, 3]
---

# Identity Rulebook

<div class="arf-meta">

**Document** FW-RB-0003 · **Version** 1.0.0 · **Status** Active · **Updated** 2026-10-02 · **Licence** CC BY 4.0
Official English translation of the Turkish source text; in case of conflict the Turkish text prevails.

</div>

The rulebook for the identity credential Tamga issues as the provisional identity credential provider
(`urn:tamga:id:IdentityAttestation:1`), branching from the Tamga [[t:rulebook|Rulebook]] ([[FW-RB-0001]]): who issues it, with which [[t:identity-proofing]], which attributes and which
selective disclosure rule; validity and [[t:revocation]]; the two formats ([[t:SD-JWT-VC]] + ISO 18013-5 [[t:mdoc]]); rules for institutions
and verifiers; hand-over to a state [[t:PID]] provider. Written on the pattern of the EUDI [[t:ARF]] PID Rulebook — this document is not a
PID but an [[t:EAA]].

## 0. Scope and status

| Type                        | `vct`                                | Catalogue                                               |
| --------------------------- | ------------------------------------ | ------------------------------------------------------- |
| Tamga identity credential   | `urn:tamga:id:IdentityAttestation:1` | `schemas.tamga.network/v1/id/IdentityAttestation/1.0.0` |
| The same credential as mdoc | docType `tamga.id.1`                 | [[ADR-0013]]                                            |

The technical definition is in [[SPEC-ID-0003]] §9 and the schema catalogue; in a conflict they prevail. This rulebook creates
no new rules; it gathers [[ADR-0011]], [[ADR-0013]], [[SPEC-ID-0003]] and the RB-AP-ID rules of Annex B in one place,
from the point of view of institutions and verifiers.

**Status:** this document is **not a PID**. While no state-appointed PID provider exists, it is an **EAA** that Tamga issues
provisionally, as a non-qualified EAA; `pid_providers[]` stays empty in the trusted
list. When a state provider is appointed, issuance stops and the entry is handed over to the
successor (§8).

## 1. Data model

| Attribute                                               | Type                                                                                          | Selective disclosure | Note                                                                                                                                               |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `given_name`, `family_name`                             | string                                                                                        | `always`             |                                                                                                                                                    |
| `birth_date`                                            | date                                                                                          | `always`             |                                                                                                                                                    |
| `nationality`                                           | ISO 3166-1 alpha-2                                                                            | `always`             |                                                                                                                                                    |
| `personal_administrative_number`                        | string                                                                                        | `always`             | National identity number; **only in this type**                                                                                                    |
| `document_type`                                         | `ID_CARD` \| `PASSPORT` \| `RESIDENCE_PERMIT` \| `DRIVING_LICENSE`                            | `always`             | The document that was verified                                                                                                                     |
| `document_number_hash`                                  | `sha256-…`                                                                                    | `always`             | **Keyed** digest of the document number (HMAC-SHA256; key held only by the identity service) — not the number, and not recoverable from the digest |
| `issuing_country`                                       | ISO 3166-1 alpha-2                                                                            | `always`             |                                                                                                                                                    |
| `document_chip_verified`                                | boolean                                                                                       | `always`             | Whether the NFC chip was read (a fact, not a level)                                                                                                |
| `verification_method`                                   | `remote-document-liveness-face` \| `remote-nfc-liveness-face` \| `in-person` \| `review-demo` | `always`             | `review-demo` only in the test credential issued for app store review                                                                              |
| `age_over_18`                                           | boolean                                                                                       | `always`             | Derived; for age checks only this attribute is disclosed                                                                                           |
| `status`, `category`, `cnf`, `vct`, `iss`, `iat`, `exp` | —                                                                                             | `never`              | Transport profile                                                                                                                                  |

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

- Attributes, `iat/exp` and the [[t:holder]] key are identical in both formats.
- The mdoc signature is ES256 and maps to the same [[t:trust-anchor]]; the result is three-valued.
- The verifier chooses the format with [[t:DCQL]]; e.g. an age check in a browser asks for `age_over_18` only, through mdoc.

## 7. Presentation and verification rules

| Use                                                              | Attributes requested                                                        | Rule                                                                                                                                                                              |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Age check                                                        | `age_over_18`                                                               | No other attribute is requested                                                                                                                                                   |
| Matching records at an institution (before issuing a credential) | `personal_administrative_number`, `birth_date`, `given_name`, `family_name` | The institution's issuing service receives them only within its registered scope and through the full verification pipeline; it does not store or log matching keys (RB-RP-ID-01) |
| "Holds a valid Tamga identity"                                   | none                                                                        | Reference policy `event-tamga-id`                                                                                                                                                 |
| Website sign-up / sign-in ("Sign in with Tamga")                 | `given_name`, `family_name` at sign-up; none at sign-in                     | The account key is the per-site pseudonym; `document_number_hash` and the national ID number are not requested (RB-RP-13)                                                         |
| High-risk transaction                                            | per scope                                                                   | Face matching, if needed, is the verifier's responsibility; the credential carries no portrait                                                                                    |

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

The attribute names of the Tamga identity credential are unchanged. EU PID equivalents:

| Tamga identity credential                                                                | EU PID (SD-JWT VC)                       | EU PID (mdoc)                    |
| ---------------------------------------------------------------------------------------- | ---------------------------------------- | -------------------------------- |
| `given_name`                                                                             | `given_name`                             | `given_name`                     |
| `family_name`                                                                            | `family_name`                            | `family_name`                    |
| `birth_date`                                                                             | `birthdate`                              | `birth_date`                     |
| `nationality` (single value)                                                             | `nationalities` (array)                  | `nationality` (array)            |
| `personal_administrative_number`                                                         | `personal_administrative_number`         | `personal_administrative_number` |
| `issuing_country`                                                                        | `issuing_country`                        | `issuing_country`                |
| `age_over_18`                                                                            | — (separate age verification credential) | —                                |
| `document_type`, `document_number_hash`, `document_chip_verified`, `verification_method` | no equivalent (Tamga-specific)           | no equivalent                    |

When a state PID is available (§8), institutions may also accept the PID instead of the Tamga identity credential to match a
person; this is enabled by a separate decision.

## References

The decisions, specifications and standards this document rests on are listed in Annex E.

## Status

**Active** — version 1.0.0 (2 October 2026).
