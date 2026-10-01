---
title: "Annex C — Attestation Rulebook: Identity"
translation_of: FW-RB-0003
source_version: 0.2.1
outline: [2, 3]
---

# Annex C — Attestation Rulebook: Tamga Identity Attestation

<div class="arf-meta">

**Document** FW-RB-0003 · **Version** 0.1.1 · **Status** Draft · **Updated** 2026-09-27 · **Licence** CC BY 4.0
Official English translation of the Turkish source text; in case of conflict the Turkish text prevails.

</div>

::: warning Draft
This rulebook is a draft awaiting approval. It compiles rules that are already in force ([[ADR-0011]], [[ADR-0013]],
[[SPEC-ID-0003]], [[FW-RB-0001]] RB-AP-ID); it becomes Active once approved.
:::

The attestation rulebook for the identity document Tamga issues as the provisional identity attestation provider
(`urn:tamga:id:IdentityAttestation:1`): who issues it, with which identity proofing, which fields and which
selective-disclosure rule; validity and revocation; the two formats (SD-JWT VC + ISO 18013-5 mdoc); rules for institutions
and verifiers; hand-over to a state PID provider. Written on the pattern of the EUDI ARF PID Rulebook — this document is not a
PID but an EAA.

## 0. Scope and status

| Type | `vct` | `schema_id` | Catalogue |
|---|---|---|---|
| Tamga Identity Attestation | `urn:tamga:id:IdentityAttestation:1` | `keccak256(vct)` | `schemas.tamga.network/v1/id/IdentityAttestation/1.0.0` |
| The same document as mdoc | docType `tamga.id.1` | — | [[ADR-0013]] |

The technical definition is in [[SPEC-ID-0003]] §9 and the schema catalogue; in a conflict they prevail. This rulebook creates
no new rules; it gathers [[ADR-0011]], [[ADR-0013]], [[SPEC-ID-0003]] and the RB-AP-ID rules of [[FW-RB-0001]] in one place,
from the point of view of institutions and verifiers.

**Status:** this document is **not a PID**. While no state-appointed PID provider exists, it is an **EAA** that Tamga issues
provisionally, as a non-qualified EAA (class `EAA`, assurance I2; no `category` claim — [[ADR-0022]]); `pid_providers[]` stays empty in the trusted
list ([[SPEC-TRUST-0001]]/TL8). When a state provider is appointed, new issuance stops and the entry is handed over to the
successor (§8).

## 1. Data model

| Claim | Type | Selective disclosure | Note |
|---|---|---|---|
| `given_name`, `family_name` | string | `always` | |
| `birth_date` | date | `always` | |
| `nationality` | ISO 3166-1 alpha-2 | `always` | |
| `personal_administrative_number` | string | `always` | National identity number; **only in this type** (IDP10) |
| `document_type` | `ID_CARD` \| `PASSPORT` \| `RESIDENCE_PERMIT` \| `DRIVING_LICENSE` | `always` | The document that was verified |
| `document_number_hash` | `sha256-…` | `always` | **Keyed** digest of the document number (HMAC-SHA256; key held only by the identity service) — not the number, and not recoverable from the digest |
| `issuing_country` | ISO 3166-1 alpha-2 | `always` | |
| `document_chip_verified` | boolean | `always` | Whether the NFC chip was read (a fact, not a level) |
| `verification_method` | `remote-document-liveness-face` \| `remote-nfc-liveness-face` \| `in-person` \| `review-demo` | `always` | `review-demo` only in the app-store review DEMO credential ([[ADR-0033]]) |
| `age_over_18` | boolean | `always` | Derived; for age checks only this field is disclosed |
| `status`, `category`, `cnf`, `vct`, `iss`, `iat`, `exp` | — | `never` | Wire profile |

**Not included:** portrait/photo, address, document images, an assurance-level (LoA) claim ([[SPEC-PROTO-0001]]/PR7). All
personal fields are selectively disclosable; a verifier may request only the fields in its registered scope.

## 2. Who issues it

| Requirement | Value |
|---|---|
| Issuer | The Tamga Network identity service (`id.tamga.network`) — the only issuer; institutional issuers cannot issue this type |
| Category / class | `IDENTITY` · `EAA` · I2 ([[ADR-0022]]; may be raised after an independent assessment) |
| Schema authorisation | Only in the identity service's entry (allowlist) |
| Key | The identity service's issuing key; separate status key (RB-AP-03) |
| Role | "Provisional Identity Attestation Provider" — not a PID Provider ([[ADR-0011]] K1) |
| App-store review | A separate DEMO signer `tamga-id-review` (I1; `verification_method: review-demo`, at most 7 days); only with a single-use review code; passes no real policy requiring I2 ([[ADR-0033]] RV1–RV3) |

## 3. Identity proofing before issuance

| Path | Level | Note |
|---|---|---|
| Remote: document + liveness + face match | **T2** (ETSI TS 119 461 Substantial) | `verification_method: remote-document-liveness-face` |
| Remote + NFC chip | T2; `document_chip_verified: true` | Technically high; legally T3 = qualified e-signature (IDP7) |
| In person | T2 | `in-person` |

Rules: identity verification happens only in the identity service; institutional issuers, the wallet and verifiers do not
talk to the provider (IDP3). Before verification starts, an **information notice is shown and explicit consent is obtained**
(IDP11). The provider's decision is always confirmed from its decision endpoint; the webhook is only a trigger (IDP5). A
provider outage does not lower the level; issuance stops (IDP8).

## 4. Data protection

- Tamga is the **data controller** for this data ([[FW-TF-0001]] §3.5).
- Personal fields are not kept after issuance; the permanent record is only an opaque `subject_ref`, the document-number hash,
  validity and status indexes. Document images, selfies, video and raw OCR data are never stored at Tamga (IDP9).
- A deletion request revokes the document.
- No second active attestation is issued for the same document number; re-verification revokes the older one
  ([[ADR-0011]] K6).

## 5. Validity and revocation

| Topic | Rule |
|---|---|
| Validity | `exp` = issuance + 730 days (≤ 2 years); re-verification after expiry |
| Status list | **Mandatory** (Token Status List) |
| Reasons for revocation | the person's deletion request, re-verification with the same document, reported loss/theft of the document, wrong issuance |
| Copies | 10 copies, each on a different device key; a different copy per verifier (WL5) |

## 6. Two formats: SD-JWT VC and mdoc

The same document is issued as SD-JWT VC (primary) and as ISO/IEC 18013-5 mdoc ([[ADR-0013]]):

- Fields, `iat/exp` and the holder key are identical in both formats (MD1, MD2).
- The mdoc signature is ES256 and maps to the same trust anchor (MD3); the result is three-valued (MD4).
- The verifier chooses the format with DCQL; e.g. an age check in a browser asks for `age_over_18` only, through mdoc.

## 7. Presentation and verification rules

| Use | Fields requested | Rule |
|---|---|---|
| Age check | `age_over_18` | No other field is requested |
| Matching records at an institution (before issuing a document) | `personal_administrative_number`, `birth_date`, `given_name`, `family_name` | The institutional issuer receives them only within its registered scope and through the full verification pipeline; it does not store or log matching keys (RB-RP-ID-01, IDP10) |
| "Holds a valid Tamga identity" | none | Reference policy `event-tamga-id` |
| Website sign-up / sign-in ("Sign in with Tamga") | `given_name`, `family_name` at sign-up; none at sign-in | The account key is the per-site pseudonym ([[ADR-0031]]); `document_number_hash` and the national ID number are not requested (RB-RP-13) |
| High-risk transaction | per scope | Face matching, if needed, is the RP's responsibility; the document carries no portrait |

- A verifier requesting the identity number must have that field explicitly in its registration; the wallet flags
  out-of-scope requests (WL8).
- The result is three-valued; `INDETERMINATE` is not acceptance.
- The verifier must see the issuer in the trusted list in the `IDENTITY` category and authorised for this type.
- **Pseudonym seed** ([[ADR-0031]]): together with the identity attestation a separate, non-presentable type
  `urn:tamga:id:PseudonymSeed:1` is issued; the seed is derived with a separate key from the person's stable identifier (in
  Türkiye the national ID number; otherwise country + document type + document number — pseudonyms then change when the document
  is renewed) and is not stored. The wallet derives a per-site pseudonym from it (RB-AP-ID-07).

## 8. Hand-over — state PID provider

When a state appoints a PID provider: the identity service's entry is handed over with `successor_id`, new issuance stops,
and documents already issued stay valid until they expire ([[SPEC-TRUST-0001]]/TL8, RB-AP-ID-06). Verifier policies are
updated to prefer the state PID; this type becomes `DEPRECATED` but stays verifiable.

## 9. Demo and pilot deviations

| # | Deviation | Closure |
|---|---|---|
| S-15 | In the demo the identity provider may run in simulated (FAKE) mode | Real provider in the pilot |
| S-9 | Keys in software in the demo wallet | Secure element in the pilot |

## Related documents

[[FW-ARF-0001]] · [[FW-TF-0001]] · [[FW-RB-0001]] · [[SPEC-ID-0003]] · [[SPEC-PROTO-0001]] · [[SPEC-PROTO-0002]] ·
[[SPEC-CRED-0003]] · [[SPEC-TRUST-0001]] · [[ADR-0011]] · [[ADR-0013]]

## Change history

- **0.2.1 (2026-10-01)** — App-store review DEMO signer and the `review-demo` verification method ([[ADR-0033]]; §1, §2).
- **0.2.0 (2026-10-01)** — Per-site pseudonyms ([[ADR-0031]]): website sign-in use and the pseudonym seed (§7).
- **0.1.1 (2026-09-27)** — Display name "Tamga Identity Attestation"; Tamga's role is still that of a provisional provider (§0).
- **0.1.0 (2026-09-27)** — First draft: a compilation of [[ADR-0011]], [[ADR-0013]], [[SPEC-ID-0003]] §8–9 and the RB-AP-ID
  rules. Awaiting approval.
