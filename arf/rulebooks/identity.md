---
title: "Identity Rulebook"
translation_of: FW-RB-0003
source_version: 1.0.0
outline: [2, 3]
---

# Identity Rulebook

<div class="arf-meta">

**Document** FW-RB-0003 · **Version** 1.0.0 · **Status** Active · **Updated** 2026-10-16 · **Licence** CC BY 4.0
Official English translation of the Turkish source text; in case of conflict the Turkish text prevails.

</div>

The rulebook for the personal credentials issued by Tamga's identity service (branching from the Tamga [[t:rulebook|Rulebook]],
[[FW-RB-0001]]), in the section structure of the EU Attestation Rulebook template: the Tamga identity credential
(`urn:tamga:id:IdentityAttestation:1`; SD-JWT VC + ISO/IEC 18013-5 mdoc), its ZK copy
(`urn:tamga:id:ShortLivedIdentityAttestation:1`), the pseudonym seed (`urn:tamga:id:PseudonymSeed:1`) and the driving licence
information (`urn:tamga:id:DrivingLicenceAttestation:1`; not an official driving licence). Attributes and metadata, legal
category, encoding per format, usage, trust anchors, validity and [[t:revocation]], EU compliance. The identity credential is not
a [[t:PID]]; it is a non-qualified EAA that uses the EU PID attribute names and encoding.

| Version | Date | Description |
| --- | --- | --- |
| 1.0.0 | 2026-10-16 | Current text of Tamga ARF 1.0, in the section structure of the EU Attestation Rulebook template (version 1.5). |

**Scheme owner:** Tamga Network (today the provisional operator). **Feedback:** <https://github.com/tamga-network/tamga-network/issues>

## 1. Introduction

### 1.1 Scope and purpose

This rulebook defines the four personal credential types issued by the Tamga Network identity service (`id.tamga.network`):

| Type | `vct` / docType | Format | Catalogue |
| --- | --- | --- | --- |
| Tamga identity credential | `urn:tamga:id:IdentityAttestation:1` | [[t:SD-JWT-VC]] + [[t:mdoc]] (namespace `tamga.id.1`) | `schemas.tamga.network/v1/id/IdentityAttestation/1.0.0` |
| ZK copy (zero-knowledge presentation only) | `urn:tamga:id:ShortLivedIdentityAttestation:1` | mdoc only (namespace `tamga.id.1`) | `schemas.tamga.network/v1/id/ShortLivedIdentityAttestation/1.0.0` · [[ADR-0044]] |
| Pseudonym seed (never presented) | `urn:tamga:id:PseudonymSeed:1` | SD-JWT VC only | `schemas.tamga.network/v1/id/PseudonymSeed/1.0.0` · [[ADR-0031]] |
| Driving licence information | `urn:tamga:id:DrivingLicenceAttestation:1` | SD-JWT VC only | `schemas.tamga.network/v1/id/DrivingLicenceAttestation/1.0.0` · [[ADR-0039]] |

**Purpose.** While no [[t:PID]] provider has been appointed by a state, a person's identity is verified remotely once and carried
in the wallet as a selectively disclosable, device-bound credential: institutions match the person against their own records,
websites ask for age or "is there a valid identity", and the person discloses only what is needed.

**Status.** The identity credential **is not a PID**: it is a non-qualified **[[t:EAA]]** that Tamga issues on a provisional basis
([[ADR-0011]], [[ADR-0022]]); `pid_providers[]` in the [[t:trust-list]] stays empty. When a state provider is appointed, no new
credentials are issued and the registration is handed over to the successor (§4.7). The driving licence information **is not an
official driving licence and not an [[t:mDL]]** (§4.8).

The technical definition is in [[SPEC-ID-0003]] §9 and in the schema catalogue; in case of conflict they prevail. This rulebook
sets no new rules; it collects [[ADR-0011]], [[ADR-0013]], [[ADR-0039]], [[ADR-0044]], [[ADR-0045]], [[SPEC-ID-0003]] and the
RB-AP-ID rules of the Tamga Rulebook (Annex B) in the order of the EU template.

### 1.2 Document structure

Chapter 2 defines the attributes and metadata independently of the format; Chapter 3 the encoding per format (ISO/IEC 18013-5,
SD-JWT VC, W3C VCDM); Chapter 4 usage, issuance conditions and the verifier's obligations; Chapter 5 trust anchors; Chapter 6
validity and revocation; Chapter 7 EU compliance and open decisions.

### 1.3 Key words

**MUST**, **MUST NOT**, **SHOULD** and **MAY** have their RFC 2119 meaning (Tamga Rulebook §0). Lower-case "must" describes a
requirement set by an external document.

### 1.4 Terminology

Terms are in Annex D; EU terms have their meaning in ARF Annex 1.

## 2. Attributes and metadata

### 2.0 EU requirements and where they are met

| Requirement | Where |
| --- | --- |
| Indication that it is an EAA (ARB_12) | §2.1 — no `category` is written; under ETSI TS 119 472-1 V1.2.1 EAA-5.2.2.1-01 the absence is the indication of a non-qualified EAA; the template's value `eaa:eu:non-qualified` is not used ([[ADR-0047]] K6) |
| Identity of the issuer, Annex V b (ARB_15) | `iss` (the issuer's address) and the `x5c` leaf certificate in the signature header (organisation name, country); `issuer_id` is the certificate fingerprint (§2.5, §5) |
| Identity of the subject, Annex V c (ARB_17) | Identity credential: `family_name`, `given_name`, `birthdate`, `personal_administrative_number`. Driving licence information: `family_name`, `given_name`, `birth_date`. The ZK copy and the pseudonym seed deliberately carry no subject identity (§2.2) |
| Start and end of validity, Annex V e (ARB_19) | SD-JWT VC `iat`, `exp`; mdoc `validityInfo` (`validFrom`, `validUntil`) |
| Location of the trust anchor, Annex V h (ARB_21) | No separate attribute in the credential, and none is added; the location is the issuer's certificate chain and the Tamga trust lists (§5); the lists are the single source of trust anchors ([[ADR-0047]] K7) |

### 2.1 Introduction and legal category

The identity credential uses the attribute names and encoding of the EU PID (Implementing Regulation (EU) 2026/1731;
[[ADR-0045]]); the type and namespace are Tamga's. All personal attributes are selectively disclosable; there is no portrait,
address, document image or assurance level ([[t:LoA]]) attribute. The national identity number exists only in this type
(RB-AP-ID-04, RB-SCH-04).

**Legal category (`category`).** The EU Attestation Rulebook template (1.5) and ETSI TS 119 472-1 define the `category` attribute
for QEAAs and PuB-EAAs (`urn:etsi:esi:eaa:eu:qualified`, `urn:etsi:esi:eaa:eu:pub`; its former name in the ARF text is
`attestation_legal_category`, ARB_25). Tamga uses this name with its own values (`urn:tamga:eaa:qualified`, `urn:tamga:eaa:pub`)
only for issuers whose registered class is qualified or public (RB-AP-14). The identity service is in the non-qualified EAA / I2
class ([[ADR-0022]]); none of the four types in this rulebook carries `category` (**MUST NOT**, RB-AP-ID-04). ETSI TS 119 472-1
(EAA-5.2.2.1-01) requires `category` to be absent in a non-qualified, non-public EAA; that the credential is a non-qualified EAA
follows from this absence and from the issuer's class in the trust list.

### 2.2 Mandatory attributes

**Identity credential (`IdentityAttestation`)**

| Data identifier | Definition | Data type | Example value |
| --- | --- | --- | --- |
| `family_name` | Family name | string (1–200) | `Yılmaz` |
| `given_name` | Given name | string (1–200) | `Ayşe` |
| `birthdate` | Date of birth | date (YYYY-MM-DD) | `1990-04-12` |
| `nationalities` | Nationalities; unknown `QU`, stateless `QS` | array of ISO 3166-1 alpha-2 (at least one) | `["TR"]` |
| `personal_administrative_number` | National identity number; only in this type | string (5–32) | `12345678901` |
| `document_type` | Type of the verified document | `ID_CARD` \| `PASSPORT` \| `RESIDENCE_PERMIT` \| `DRIVING_LICENSE` | `ID_CARD` |
| `document_number_hash` | Keyed digest of the document number (HMAC-SHA256; the key stays in the identity service); the number itself is absent and cannot be recovered | `sha256-…` | `sha256-q1…` |
| `issuing_country` | In the EU PID sense, the country of the provider that issued the credential; today the value is the country that issued the scanned identity document (§4.6) | ISO 3166-1 alpha-2 | `TR` |
| `document_chip_verified` | Whether the NFC chip was read (a fact, not a level) | boolean | `true` |
| `verification_method` | How identity was verified; `review-demo` only in the demo credential issued for app store review | `remote-document-liveness-face` \| `remote-nfc-liveness-face` \| `in-person` \| `review-demo` | `remote-document-liveness-face` |

**ZK copy (`ShortLivedIdentityAttestation`)**

| Data identifier | Definition | Data type | Example value |
| --- | --- | --- | --- |
| `age_over_18` | Whether the person is over 18; the only element that can be proven with ZK | boolean | `true` |

**Pseudonym seed (`PseudonymSeed`)**

| Data identifier | Definition | Data type | Example value |
| --- | --- | --- | --- |
| `pseudonym_seed` | Seed for deriving per-site pseudonyms; derived from the person's stable identity with a separate key, never stored (RB-AP-ID-07) | base64url, 43 characters | `Qm9…` |

**Driving licence information (`DrivingLicenceAttestation`)**

| Data identifier | Definition | Data type | Example value |
| --- | --- | --- | --- |
| `family_name` | Family name | string (1–200) | `Yılmaz` |
| `given_name` | Given name | string (1–200) | `Ayşe` |
| `issuing_country` | Country that issued the card | ISO 3166-1 alpha-2 | `TR` |
| `document_number_hash` | Keyed digest of the card number | `sha256-…` | `sha256-Zx…` |
| `driving_privileges` | Categories: `[{ category, issue_date?, expiry_date? }]`; EU 2006/126 category codes, national additions as printed (1–32 items) | array of objects | `[{"category":"B","issue_date":"2010-06-01"}]` |
| `licence_expiry_date` | Expiry date of the card | date | `2034-06-01` |
| `verified_at` | Day the card was inspected | date | `2026-10-11` |
| `verification_method` | How the card was inspected | `remote-document-liveness-face` | `remote-document-liveness-face` |
| `not_official_licence` | Explicit indication that this is not an official driving licence; always `true` | constant `true` | `true` |

`driving_privileges[].category` is the driving licence category; it has nothing to do with the legal category in §2.1.

### 2.3 Optional attributes

| Type | Data identifier | Definition | Data type | Example value |
| --- | --- | --- | --- | --- |
| Identity credential | `age_over_18` | Derived from the date of birth; in age verification only this attribute is disclosed. Not in the EU PID set; a Tamga attribute with the ISO/IEC 18013-5 name ([[ADR-0045]] K3) | boolean | `true` |
| Driving licence information | `birth_date` | Date of birth if on the card (ISO/IEC 18013-5 mDL name) | date | `1990-04-12` |
| Driving licence information | `licence_issue_date` | Issue date of the card (if present) | date | `2024-06-01` |
| Driving licence information | `age_over_18` | Derived | boolean | `true` |

### 2.4 Conditional attributes

None.

### 2.5 Mandatory metadata

| Data identifier | Definition | Data type | Example value |
| --- | --- | --- | --- |
| `iss` | The issuer's address (identity service) | URI | `https://id.tamga.network` |
| `vct` | Type (SD-JWT VC); the mdoc docType is the same value | URN | `urn:tamga:id:IdentityAttestation:1` |
| `vct#integrity` | Digest of the type definition in the catalogue (RB-SCH-01) | `sha256-…` | `sha256-…` |
| `iat` | Moment of issuance; mdoc `validityInfo.signed` | NumericDate | `1791763200` |
| `exp` | End of validity; mdoc `validityInfo.validUntil` (§6.1) | NumericDate | `1854835200` |
| `cnf` | The wallet's device key (holder binding); mdoc `deviceKeyInfo` | JWK | — |
| `status` | Status list reference `status_list {idx, uri}`; absent in the ZK copy and the pseudonym seed (§6.2) | object | `{"status_list":{"idx":48213,"uri":"https://status.tamga.network/7f3a9c21"}}` |

The identity of the issuer (Annex V b) is in the signature header: `x5c` (leaf + intermediate certificate, root excluded).

### 2.6 Optional metadata

None. `nbf` is not written today (§7.2).

### 2.7 Conditional metadata

`category` is absent in these types (§2.1).

## 3. Encoding

### 3.1 ISO/IEC 18013-5 (mdoc)

**Proximity analysis (ARB_02).** Identity may need to be shown in person and offline (an institution's registration desk, an age
check at a door); the identity credential is therefore also issued as an ISO/IEC 18013-5 mdoc ([[ADR-0013]]). The driving licence
information is not used in official checks and is not issued as an mdoc ([[ADR-0039]]); the pseudonym seed is never presented. The
ZK copy is mdoc only.

| Type | docType | Namespace |
| --- | --- | --- |
| Identity credential | `urn:tamga:id:IdentityAttestation:1` | `tamga.id.1` |
| ZK copy | `urn:tamga:id:ShortLivedIdentityAttestation:1` | `tamga.id.1` |

Encoding rules: `tstr`, `uint`, `bool` and `full-date` as in RFC 8610 / RFC 8943; `full-date` = #6.1004(tstr). `tstr` is UTF-8.
Element values are the same as in the SD-JWT VC except for dates. The MSO carries `digestAlgorithm` SHA-256, `validityInfo`
(`signed`, `validFrom`, `validUntil`; `tdate`, no fractional seconds, time zone `Z`), `deviceKeyInfo` and the status list reference
`status.status_list {idx, uri}` (the same bit as the SD-JWT copy; the address is the CWT representation of the same list —
`application/statuslist+cwt`, [[ADR-0048]] K3, packages 0.6.0). The signature is ES256 (COSE); `x5chain` is the same issuer
certificate.

| Data identifier | Element identifier | Encoding | Namespace |
| --- | --- | --- | --- |
| `family_name` | `family_name` | tstr | `tamga.id.1` |
| `given_name` | `given_name` | tstr | `tamga.id.1` |
| `birthdate` | `birth_date` | full-date | `tamga.id.1` |
| `nationalities` | `nationality` | [+ tstr] (array of alpha-2) | `tamga.id.1` |
| `personal_administrative_number` | `personal_administrative_number` | tstr | `tamga.id.1` |
| `document_type` | `document_type` | tstr | `tamga.id.1` |
| `document_number_hash` | `document_number_hash` | tstr | `tamga.id.1` |
| `issuing_country` | `issuing_country` | tstr | `tamga.id.1` |
| `document_chip_verified` | `document_chip_verified` | bool | `tamga.id.1` |
| `verification_method` | `verification_method` | tstr | `tamga.id.1` |
| `age_over_18` | `age_over_18` | bool | `tamga.id.1` |

Names and encoding follow EU PID Table 6 ([[ADR-0045]] K2); the name table is in the open packages (`@tamga-network/core/pid`).
The namespace `tamga.id.1` is a Tamga-specific namespace (ARB_10): the credential is not a PID, so `eu.europa.ec.eudi.pid.1` is not
used.

**Example (identity credential, elements disclosed for age only):**

```text
docType: "urn:tamga:id:IdentityAttestation:1"
nameSpaces: { "tamga.id.1": [ { elementIdentifier: "age_over_18", elementValue: true } ] }
MSO.validityInfo: { signed: 2026-10-11T08:00:00Z, validFrom: 2026-10-11T08:00:00Z, validUntil: 2028-10-10T08:00:00Z }
MSO.status: { status_list: { idx: 48213, uri: "https://status.tamga.network/7f3a9c21" } }
```

### 3.2 SD-JWT VC

The credentials are issued as [[t:SD-JWT-VC]] following the SD-JWT VC profile of HAIP 1.0 (ARB_01b): header `alg` ES256, `typ`
`dc+sd-jwt`, `x5c`; `_sd_alg` sha-256; no decoy digests. `vct` is a URN (`urn:tamga:<domain>:<Type>:<major>`) and unique in the
network (ARB_05); the type definition (Type Metadata) comes from the catalogue and `vct#integrity` is mandatory (ARB_31,
RB-SCH-01).

The "Disclosable" column is the `sd` value in the Type Metadata: **MUST** = `always`, **MAY** = `allowed`, **MUST NOT** = `never`
(ARB_30). Array elements are disclosed one by one (`path: ["nationalities", null]` for `nationalities`, RFC 9901 §4.2.2).

**Identity credential — IANA-registered names**

| Data identifier | Claim name | Encoding | Reference | Disclosable |
| --- | --- | --- | --- | --- |
| `family_name` | `family_name` | string | OpenID Connect Core §5.1 | MUST |
| `given_name` | `given_name` | string | OpenID Connect Core §5.1 | MUST |
| `birthdate` | `birthdate` | string, YYYY-MM-DD | OpenID Connect Core §5.1 | MUST |
| `nationalities` | `nationalities` | array of strings (alpha-2), each element separately | OpenID Connect for Identity Assurance §4.1 | MUST (each element) |

**Identity credential — EU PID names and Tamga-specific names**

| Data identifier | Claim name | Encoding | Notes | Disclosable |
| --- | --- | --- | --- | --- |
| `personal_administrative_number` | `personal_administrative_number` | string | EU PID name | MUST |
| `issuing_country` | `issuing_country` | string (alpha-2) | EU PID name (§4.6) | MUST |
| `document_type` | `document_type` | string (set) | Tamga-specific | MUST |
| `document_number_hash` | `document_number_hash` | string `sha256-…` | Tamga-specific | MUST |
| `document_chip_verified` | `document_chip_verified` | boolean | Tamga-specific | MUST |
| `verification_method` | `verification_method` | string (set) | Tamga-specific | MUST |
| `age_over_18` | `age_over_18` | boolean | ISO/IEC 18013-5 name | MUST |
| `iss`, `vct`, `vct#integrity`, `iat`, `exp`, `cnf`, `status` | same | — | transport profile | MUST NOT |

**Pseudonym seed**

| Data identifier | Claim name | Encoding | Notes | Disclosable |
| --- | --- | --- | --- | --- |
| `pseudonym_seed` | `pseudonym_seed` | string (base64url) | Tamga-specific; never in any verifier's scope | MUST NOT (the credential is never presented) |

**Driving licence information**

| Data identifier | Claim name | Encoding | Notes | Disclosable |
| --- | --- | --- | --- | --- |
| `family_name`, `given_name` | same | string | OpenID Connect Core §5.1 | MUST |
| `birth_date` | `birth_date` | string, YYYY-MM-DD | ISO/IEC 18013-5 mDL name ([[ADR-0045]] K4) | MUST |
| `issuing_country` | `issuing_country` | string (alpha-2) | ISO/IEC 18013-5 mDL name | MUST |
| `document_number_hash` | same | string `sha256-…` | Tamga-specific | MUST |
| `driving_privileges` | same | array of objects | ISO/IEC 18013-5 mDL name; the official mDL namespace is not used (RB-AP-ID-08) | MUST |
| `licence_issue_date`, `licence_expiry_date` | same | string, YYYY-MM-DD | Tamga-specific | MUST |
| `verification_method`, `age_over_18` | same | string / boolean | — | MUST |
| `verified_at` | same | string, YYYY-MM-DD | Tamga-specific | MUST NOT |
| `not_official_licence` | same | constant `true` | Tamga-specific; visible in every presentation | MUST NOT |

**Example (identity credential; the JWT claim set with disclosures resolved):**

```json
{
  "iss": "https://id.tamga.network",
  "vct": "urn:tamga:id:IdentityAttestation:1",
  "vct#integrity": "sha256-…",
  "iat": 1791763200,
  "exp": 1854835200,
  "cnf": { "jwk": { "kty": "EC", "crv": "P-256", "x": "…", "y": "…" } },
  "status": { "status_list": { "idx": 48213, "uri": "https://status.tamga.network/7f3a9c21" } },
  "family_name": "Yılmaz",
  "given_name": "Ayşe",
  "birthdate": "1990-04-12",
  "nationalities": ["TR"],
  "personal_administrative_number": "12345678901",
  "document_type": "ID_CARD",
  "document_number_hash": "sha256-…",
  "issuing_country": "TR",
  "document_chip_verified": false,
  "verification_method": "remote-document-liveness-face",
  "age_over_18": true
}
```

In the issued credential each personal attribute is a separate disclosure; each element of the `nationalities` array is a separate
disclosure too. Encoded credentials and disclosure examples are in the conformance vectors (`conformance/vectors/sd-jwt`).

### 3.3 W3C VCDM

Not used: Tamga does not use a JSON-LD carrier.

## 4. Usage

### 4.1 Use cases and the attributes a verifier asks for

| Use | Attributes requested | Rule |
| --- | --- | --- |
| Age verification | `age_over_18` | No other attribute is requested; in the browser via mdoc, optionally a zero-knowledge proof with the ZK copy |
| Matching at an institution (before issuance) | `personal_administrative_number`, `birthdate`, `given_name`, `family_name` | The institution's issuance service receives them only within its registered scope and through the full verification pipeline; it does not store or log the matching keys (RB-RP-ID-01) |
| "Is there a valid Tamga identity" | none | Reference policy `event-tamga-id` |
| Sign-up and sign-in on a website ("Sign in with Tamga") | at sign-up `given_name`, `family_name`; at sign-in none | The account key is a per-site pseudonym; `document_number_hash` and the identity number are not requested (RB-RP-13) |
| High-risk transaction | per its scope | If face matching is needed it is the verifier's responsibility; the credential carries no portrait (RB-RP-11) |
| Driving licence categories | `driving_privileges` and what is needed | Not used in official checks or official procedures; the screen says "does not replace an official driving licence" (§4.8) |

**Requesting a PID (ARB_27).** A verifier that accepts these types does not need to request a PID as well. Accepting a state PID
for matching, once one exists, is opened by a separate decision.

### 4.2 Issuance policy

| Requirement | Identity credential, ZK copy, pseudonym seed | Driving licence information |
| --- | --- | --- |
| Issuer | Only the identity service (`id.tamga.network`); institutions cannot issue these types | same |
| Category · class | `IDENTITY` · `EAA` · I2 ([[ADR-0022]]) | same |
| Type authorisation | Only in the identity service's registration (allow-list) | same |
| Key | The identity service's credential signing key; the status list key is separate (RB-AP-03) | same |
| Prerequisite | Identity proofing (§4.3); the ZK copy and the seed only together with the identity credential or with its refresh token | The wallet presents an **active Tamga identity credential** (given name, family name, date of birth); the name and date of birth on the card must match it (RB-AP-ID-09) |
| Copies | Identity credential: 10 copies, each bound to a separate device key; a separate copy per verifier (ARF method D). ZK copy in small batches (at most 3) | 10 copies |
| Wallet | Before issuance the wallet instance attestation (WIA) and key attestation (KA) are verified against `wallet_providers[]` (RB-AP-10) | same |
| App store review | Separate demo signer `tamga-id-review` (I1; `verification_method: review-demo`, at most 7 days); only with a single-use review code; passes no policy that requires I2 | — |
| Embedded disclosure policy | Not carried ([[ADR-0046]] K1) | Not carried |

### 4.3 Identity proofing before issuance

| Route | Level | Note |
| --- | --- | --- |
| Remote: document, liveness and face matching | **T2** (ETSI TS 119 461 Substantial) | `verification_method: remote-document-liveness-face` |
| Remote with NFC chip | T2; `document_chip_verified: true` | Technically high; legally T3 is a qualified electronic signature |
| In person | T2 | `in-person` |

Rules: identity proofing happens only in the identity service; institutional [[t:issuer|issuers]], wallets and verifiers do not talk
to the remote identity proofing provider (RB-AP-ID-01). Before proofing starts, **the privacy notice is shown and explicit consent
is obtained** (RB-AP-ID-02). The provider's decision is always confirmed at the provider's decision endpoint; a notification
(webhook) is only a trigger. A provider outage does not lower the level; issuance stops. The level is not written into the
credential (RB-AP-14).

**There is no age limit** ([[ADR-0043]]): no minimum age is required for the identity credential; the requirement is identity
proofing with a valid identity document. A parental consent flow for children is handled by a separate decision after legal
review.

### 4.4 Data protection

- Tamga is the **data controller** for this data.
- Personal attributes are not kept after issuance; the only persistent record is an opaque `subject_ref`, the document number
  digest, the validity period and the status list positions. Document images, selfies, video and raw OCR data are never stored by
  Tamga (RB-AP-ID-03).
- An erasure request revokes the credential.
- No second active identity credential is issued for the same document number; re-verification revokes the old one (RB-AP-ID-05).

### 4.5 Presentation and the verifier's obligations

- Presentation only with [[t:OpenID4VP]] and [[t:DCQL]], a signed request and an encrypted response (RB-RP-02); the verifier
  chooses the format with DCQL (for example, age verification in the browser asks for `age_over_18` only, via mdoc). In proximity the
  ISO/IEC 18013-5 flow is used.
- Verification goes through the canonical pipeline: freshness of the trust source, then signature, issuer, type authorisation,
  revocation and wallet binding (RB-RP-03). The issuer must appear in the trust list in the `IDENTITY` category and authorised for
  this type.
- A verifier that asks for the identity number must have this attribute explicitly in its registration; the wallet warns about
  out-of-scope requests.
- The result has three values; `INDETERMINATE` is not acceptance (RB-RP-05).
- ZK copy: the proof binds the type, so the verifier sees the short lifetime and expects no revocation check (`status:
  NOT_APPLICABLE`, reason: short-lived). A ZK presentation without this type (unmarked) is accepted only if the policy explicitly
  allows it (RB-AP-ID-11, [[ADR-0044]]).
- The **[[t:pseudonym]] seed** is in no verifier's scope; the wallet derives per-site pseudonyms from it (RB-AP-ID-07).
- Transactional data (ARF Topic 20, payments) is not defined for these types.

### 4.6 Relation to the EU PID and mDL

Tamga verifiers recognise the EU person identification data (PID) and the ISO driving licence ([[t:mDL]]) as **external types**:

| Type | Format |
| --- | --- |
| `urn:eudi:pid:1` | SD-JWT VC |
| `eu.europa.ec.eudi.pid.1` | mdoc |
| `org.iso.18013.5.1.mDL` | mdoc |

- **Recognition condition.** An external type is accepted only if its issuer is in scope of an external list that vouches for that
  type (Annex A §6.1). Today the list of lists contains no external list; each one is added by a separate decision.
- **Nested [[t:selective-disclosure]].** In the EU PID the address is an object and the nationalities are an array. The person can
  disclose only what is needed: for example only the city of the address, or one of the nationalities. The verifier's scope check
  applies to the attribute itself or to its parent.
- **Age.** The EU PID has no age attribute; in the EU a separate age verification credential is used for age. The mDL has age
  elements such as `age_over_18`.

| Tamga identity credential (SD-JWT VC) | Tamga identity credential (mdoc, `tamga.id.1`) | EU PID (SD-JWT VC) | EU PID (mdoc) |
| --- | --- | --- | --- |
| `given_name` | `given_name` | `given_name` | `given_name` |
| `family_name` | `family_name` | `family_name` | `family_name` |
| `birthdate` | `birth_date` (full-date) | `birthdate` | `birth_date` (full-date) |
| `nationalities` (array) | `nationality` (array) | `nationalities` (array) | `nationality` (array) |
| `personal_administrative_number` | `personal_administrative_number` | `personal_administrative_number` | `personal_administrative_number` |
| `issuing_country` (country that issued the document) | `issuing_country` | `issuing_country` (country of the PID provider) | `issuing_country` |
| `age_over_18` | `age_over_18` | — (separate age verification credential) | — |
| `document_type`, `document_number_hash`, `document_chip_verified`, `verification_method` | same | no equivalent (Tamga-specific) | no equivalent |

> **`issuing_country` (2026-10-11, project management decision).** The attribute has its EU PID meaning: the country of the
> identity provider that issued the credential (Implementing Regulation (EU) 2026/1731). Because today Tamga's identity service
> issues the credential itself on the basis of a scanned identity document, the value **reflects the country that issued the
> scanned document**. When a state PID provider issues PIDs, the attribute carries the EU meaning and the documents describe it with
> the EU definition. Code and schema do not change today.

### 4.7 Hand-over — state PID provider

When a state appoints a PID provider: the identity service's registration is handed over with `successor_id` and no new credentials
are issued; credentials already issued remain valid until they expire (RB-AP-ID-06). Verifier policies are updated to prefer the
state PID; this type becomes `DEPRECATED` but stays verifiable.

### 4.8 Driving licence information — additional rules

The person's physical driving licence card is inspected remotely (document + liveness + face matching) and the categories and dates
on the card are issued as a credential ([[ADR-0039]]). **It is not an official driving licence and not an mDL;** it is not used in
traffic checks or official procedures. The credential always says so, with the explicit `not_official_licence` attribute, its
display name ("Driving licence information — does not replace an official driving licence") and its card; verifier screens show
the same statement (RB-AP-ID-08).

| Topic | Rule |
| --- | --- |
| Matching | If the name and date of birth on the card do not match the identity credential, the card is not a driving licence, it has expired or the categories cannot be read, no credential is issued (RB-AP-ID-09) |
| Absent | National identity number, restriction and health codes (field 12; not even a `has_restrictions` fact), photo, signature, address; the provider's note fields are not read |
| Data protection | Tamga is the data controller; the privacy notice and explicit consent are specific to the driving licence; personal attributes are not kept after issuance; name and date of birth are not sent to the provider, matching is done in the identity service with a keyed digest |
| Competent authority | Once a country's competent authority starts issuing digital driving licences, Tamga stops issuing this type for that country; the registration points to the official type with `successor` (RB-AP-ID-10) |
| Law | Legal review before issuance to real people is opened; the sandbox does not wait for it |

### 4.9 Device binding

All four types are **device-bound** (ARB_34): each copy is bound to a separate key in the wallet's secure hardware (`cnf` /
`deviceKeyInfo`; RB-AP-09, RB-WP-01). The `cryptographically_bound_to` attribute is not used: the link between the driving licence
information and the identity credential is established by the presentation at issuance and kept by revocation (§6.2); there is no
cryptographic binding in the credential.

## 5. Trust anchors

These types are non-qualified EAAs; the trust anchor comes from Tamga's signed trust lists, not from the EU trusted list (ARB_26):

1. The verifier fetches in advance the list of lists (`https://trust.tamga.network/lotl.jws`) and the national list (`tl-tr.jws`)
   and verifies their signatures against the root certificates. The root fingerprints are published with the same values on the
   `tamga.network/trust-anchor` page, in `keys/root-fingerprints.json` and in the Trust Framework (RB-OP-06).
2. The credential's `x5c` chain (`x5chain` in mdoc) chains to the national root; `issuer_id` is derived from the fingerprint of the
   leaf certificate, not from `iss` (RB-AP-01, RB-RP-04).
3. The `tl-tr › issuers[]` entry gives the issuer, its category (`IDENTITY`), its class and its time-windowed authorisation for this
   type; the check uses the moment of issuance (`iat`) (RB-RP-03).
4. The type is verified with the `lotl › schemas[]` entry and the `content_hash` in the catalogue (= `vct#integrity`).

At issuance the wallet checks against the same entry that the issuer is authorised to issue this type. The trust anchor of external
types (§4.6) comes only from the external list.

## 6. Validity and revocation

### 6.1 Validity policy

| Type | Validity |
| --- | --- |
| Identity credential | `exp` = moment of issuance + 730 days (at most 2 years); re-verification when it expires |
| ZK copy | At most 24 hours and never beyond the main credential's expiry (RB-AP-ID-11) |
| Pseudonym seed | 730 days; renewed together with the identity credential |
| Driving licence information | `exp` = the earlier of the card's expiry and 1 year after the inspection; automatic renewal does not extend it (RB-AP-ID-09) |
| Demo credential (`review-demo`) | At most 7 days |

### 6.2 Revocation

| Type | Revocable | Mechanism |
| --- | --- | --- |
| Identity credential | **Yes, mandatory** | Token Status List (the EU Attestation Status List); the mdoc and SD-JWT copies carry the same bit (the mdoc copy reads the CWT representation of the list) |
| ZK copy | No — the short lifetime replaces revocation (ARF VCR_01); if the main credential is revoked no new copy is issued, and revocation takes effect for ZK presentations within 24 hours at most | — |
| Pseudonym seed | No status list; never presented | — |
| Driving licence information | **Yes, mandatory** | Token Status List |

- **Status list address (ARB_24a):** `status.status_list.uri` in each credential; the identity service's lists are under
  `https://status.tamga.network/`. The address is opaque and encodes no institution, year or group (RB-AP-18).
- **Publication:** at a fixed interval (today 2 minutes), even without changes; a list is valid for 6 hours; there is no
  out-of-cycle publication (RB-AP-17, [[SPEC-CRED-0003]] §5). Revocation takes effect within minutes (RB-GEN-10).
- **Values:** `bits = 1` — valid or revoked. The identity service's types have **no suspension**, and revocation is permanent (the
  EU PID rule; RB-AP-ID-13, [[ADR-0048]] K1). Until release 0.6.0 of the packages the lists are published as `bits = 2`, but no
  suspension value is written.
- **Revocation conditions:** in the Revocation Policy ([[FW-POL-0001]] §3). For the identity credential: the person's erasure
  request, re-verification with the same document, a report that the document was lost or stolen, an incorrect credential,
  withdrawal of consent. For the driving licence information in addition: re-verification with the same card, revocation of the
  wallet unit, and revocation, re-issuance or deletion of the linked identity credential (chained; RB-AP-ID-10).
- **Attestation Revocation List** (the EU's second mechanism) is not published today (§7.2).

## 7. Compliance

### 7.1 Relation to the EU framework

- This rulebook follows the section structure of the EU Attestation Rulebook template (1.5) (ARB_29). The mapping of the template to
  the Topic 12 requirements is in Tamga Rulebook §11.
- The identity credential uses the attribute names and encoding of the EU PID (Implementing Regulation (EU) 2026/1731;
  [[ADR-0045]]) but is not a PID; the PID Rulebook's requirements specific to PID providers (type `eu.europa.ec.eudi.pid.1`, the
  `urn:eudi:pid:` namespace, portrait) do not apply.
- The driving licence information is outside the scope of the EU mDL Rulebook: an official mDL is issued only with ISO/IEC 18013-5
  and the official namespace; Tamga does not use that namespace (RB-AP-ID-08).
- These types inherit all rules of the Tamga Rulebook; the type-specific rules are RB-AP-ID-01…13 and RB-RP-ID-01.

### 7.2 Known differences and open decisions

| Topic | Status |
| --- | --- |
| Indication of a non-qualified EAA (ARB_12) | **Decision (2026-10-12, [[ADR-0047]] K6):** the EU template suggests the `category` value `eaa:eu:non-qualified`; ETSI TS 119 472-1 V1.2.1 EAA-5.2.2.1-01 requires `category` to be absent in a non-qualified EAA. Tamga follows ETSI; the template's value is not used |
| Trust anchor location in the credential (ARB_21) | **Decision (2026-10-12, [[ADR-0047]] K7):** no location attribute is added; the location is the lists in §5. A location in the credential would be the issuer's own claim; a verifier takes the anchor only from a list it chose itself, with a pinned signature |
| `nbf` (ETSI TS 119 472-1 technical start of validity) | Not written today; validity starts at `iat`. Adding it is implementation work |
| Attestation Revocation List | Tamga issuers publish the Status List (one is enough under EU VCR_11); the verifier and the wallet core also verify the identifier list (packages 0.5.0; [[FW-POL-0001]] §8) |

## 8. References

The EU Attestation Rulebook template and the PID and mDL rulebooks (the EU attestation rulebooks catalogue), ARF Annex 2 Topics 7,
10 and 12, Implementing Regulation (EU) 2026/1731, ETSI TS 119 472-1, ISO/IEC 18013-5, SD-JWT VC, HAIP 1.0, IETF Token Status List.
The Tamga decisions and specifications this document rests on are listed in Annex E.

## Status

**Active** — version 1.0.0 (16 October 2026).
