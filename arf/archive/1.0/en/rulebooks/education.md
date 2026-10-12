---
title: "Education Rulebook"
translation_of: FW-RB-0002
source_version: 1.0.0
outline: [2, 3]
---

# Education Rulebook

<div class="arf-meta">

**Document** FW-RB-0002 · **Version** 1.0.0 · **Status** Active · **Updated** 2026-10-11 · **Licence** CC BY 4.0
Official English translation of the Turkish source text; in case of conflict the Turkish text prevails.

</div>

The rulebook for the two common credential types in education (student certificate, diploma), in the section structure of the EU
Attestation Rulebook template: attributes and metadata, legal category, SD-JWT VC encoding and selective disclosure, usage and
issuance conditions, identity proofing level, verification policies, trust anchors, validity and [[t:revocation]], semantic basis
(ELM v3 / ISCED-F / EQF) and EU compliance. It branches from the Tamga [[t:rulebook|Rulebook]] ([[FW-RB-0001]]); the technical
schema is in SPEC-SCHEMA-0002.

| Version | Date | Description |
| --- | --- | --- |
| 1.0.0 | 2026-10-02 | First release (Tamga ARF 1.0). 2026-10-11: moved to the section structure of the EU Attestation Rulebook template (version 1.5); legal category, encoding table, trust anchors and revocation sections added. The rules did not change; the version stayed the same. |

**Scheme owner:** Tamga Network (today the provisional operator). **Feedback:** <https://github.com/tamga-network/tamga-network/issues>

## 1. Introduction

### 1.1 Scope and purpose

This rulebook covers two credential types:

| Type | `vct` | Catalogue |
| --- | --- | --- |
| Student certificate | `urn:tamga:edu:StudentCredential:1` | `schemas.tamga.network/v1/edu/StudentCredential/1.0.0` |
| Diploma | `urn:tamga:edu:DiplomaCredential:1` | `schemas.tamga.network/v1/edu/DiplomaCredential/1.0.0` |

Both extend the root type `urn:tamga:core:TamgaBaseCredential:1`. **Purpose:** a higher education institution issues enrolment
and graduation information to the person's wallet as a selectively disclosable, verifiable credential; an employer, a discount
provider or a campus gate sees only the attribute it needs.

These credentials are non-qualified **[[t:EAA]]s** in EU terms; the Tamga class follows the [[t:issuer]]'s registration (EAA,
qualified or public). The technical definition (JSON Schema, type definition, ELM mapping) is in **[[SPEC-SCHEMA-0002]]**; in
case of conflict that document prevails.

### 1.2 Document structure

Chapter 2 defines the attributes and metadata independently of the format; Chapter 3 the encoding; Chapter 4 usage, issuance
conditions and verification policies; Chapter 5 trust anchors; Chapter 6 validity and revocation; Chapter 7 EU compliance and open
decisions; Chapter 8 the semantic basis and versioning.

### 1.3 Key words

**MUST**, **MUST NOT**, **SHOULD** and **MAY** have their RFC 2119 meaning (Tamga Rulebook §0).

### 1.4 Terminology

Terms are in Annex D; EU terms have their meaning in ARF Annex 1.

## 2. Attributes and metadata

### 2.0 EU requirements and where they are met

| Requirement | Where |
| --- | --- |
| Indication that it is an EAA (ARB_12) | §2.1 — `category` for issuers in the qualified or public class; no `category` in a non-qualified EAA (ETSI rule) |
| Identity of the issuer, Annex V b (ARB_15) | `iss` and the `x5c` leaf certificate in the signature header; also `awarding_body_name`, `awarding_body_id`, `awarding_body_country` |
| Identity of the subject, Annex V c (ARB_17) | `family_name`, `given_name`, `birth_date`; deliberately no national identity number (RB-SCH-04) |
| Start and end of validity, Annex V e (ARB_19) | `iat`, `exp`; the diploma has no `exp` (a credential without expiry) |
| Location of the trust anchor, Annex V h (ARB_21) | No separate attribute; the location is the issuer's certificate chain and the Tamga trust lists (§5; open decision, §7.2) |

### 2.1 Introduction and legal category

The attributes are mapped to the European Learning Model (ELM v3) and Europass (§8); personal attributes are selectively
disclosable. **Forbidden:** a national identity number (TCKN etc.) appears in no attribute; there is no photo attribute (face
matching is done with the identity credential or a [[t:PID]]).

**Legal category (`category`).** The `category` attribute of the EU template (1.5) and ETSI TS 119 472-1 (its former name in the
ARF text is `attestation_legal_category`, ARB_25) is used in Tamga with Tamga values: `urn:tamga:eaa:qualified` or
`urn:tamga:eaa:pub`. The issuer **MUST** write it only if its registered class is qualified or public, with the registered value;
in classes I1–I2 it **MUST NOT** (RB-AP-14). In a non-qualified EAA the absence of the attribute is the indication, in line with
ETSI TS 119 472-1 (EAA-5.2.2.1-01).

### 2.2 Mandatory attributes

| Data identifier | Definition | Data type | Example value | Student | Diploma |
| --- | --- | --- | --- | --- | --- |
| `family_name` | Family name | string (1–200) | `Yılmaz` | ✓ | ✓ |
| `given_name` | Given name | string (1–200) | `Ayşe` | ✓ | ✓ |
| `birth_date` | Date of birth | date (YYYY-MM-DD) | `2001-03-09` | ✓ | ✓ |
| `awarding_body_name` | Official name of the institution | multilingual string | `{"en-US":"Example University"}` | ✓ | ✓ |
| `awarding_body_id` | Institution identifier (ELM; not the `issuer_id`) | string (1–64) | `TR-ORNEK-UNI` | ✓ | ✓ |
| `awarding_body_country` | Country of the institution | ISO 3166-1 alpha-2 | `TR` | ✓ | ✓ |
| `isced_f_code` | Field code (ISCED-F 2013, 2–4 digits) | string | `0613` | ✓ | ✓ |
| `student_status` | Enrolment status; never "graduated" | `ACTIVE` \| `ON_LEAVE` | `ACTIVE` | ✓ | — |
| `enrollment_year` | Year of enrolment | integer | `2022` | ✓ | — |
| `study_level` | Level (EQF 5–8) | integer | `6` | ✓ | — |
| `programme_title` | Programme name | multilingual string | `{"en-US":"Computer Engineering"}` | ✓ | — |
| `is_enrolled` | Derived: enrolled student (`true`) | boolean | `true` | ✓ | — |
| `qualification_title` | Name of the qualification | multilingual string | `{"en-US":"Bachelor's degree"}` | — | ✓ |
| `eqf_level` | European Qualifications Framework level (5–8) | integer | `6` | — | ✓ |
| `awarding_date` | Date of graduation | date | `2026-06-30` | — | ✓ |
| `is_graduate` | Derived, constant `true` | constant `true` | `true` | — | ✓ |

### 2.3 Optional attributes

| Data identifier | Definition | Data type | Example value | Student | Diploma |
| --- | --- | --- | --- | --- | --- |
| `faculty_name` | Faculty | multilingual string | `{"en-US":"Faculty of Engineering"}` | ✓ | — |
| `expected_graduation_year` | Expected year of graduation | integer | `2026` | ✓ | — |
| `enrollment_date` | Date of enrolment | date | `2022-09-19` | ✓ | — |
| `credit_points` | ECTS credits | number (0–1000) | `240` | ✓ | ✓ |
| `nqf_level` | National qualifications level (TYÇ) | string (≤ 16) | `6` | — | ✓ |
| `mode_of_study` | Mode of study | `FULL_TIME` \| `PART_TIME` \| `DISTANCE` \| `BLENDED` | `FULL_TIME` | — | ✓ |
| `grade` | Grade | string (≤ 32) | `3.41` | — | ✓ |
| `grading_scheme` | Grading scheme | multilingual string | `{"en-US":"4-point scale"}` | — | ✓ |
| `thesis_title` | Thesis title | multilingual string | `{"en-US":"…"}` | — | ✓ |
| `graduated_before` | Derived: graduated before this year | integer | `2027` | — | ✓ |

### 2.4 Conditional attributes

None.

### 2.5 Mandatory metadata

| Data identifier | Definition | Data type | Example value | Student | Diploma |
| --- | --- | --- | --- | --- | --- |
| `iss` | The issuer's address | URI | `https://issuer.tamga.network/ornek-uni` | ✓ | ✓ |
| `vct`, `vct#integrity` | Type and digest of the type definition | URN, `sha256-…` | `urn:tamga:edu:DiplomaCredential:1` | ✓ | ✓ |
| `iat` | Moment of issuance | NumericDate | `1782777600` | ✓ | ✓ |
| `cnf` | The wallet's device key | JWK | — | ✓ | ✓ |
| `exp` | End of validity; `exp − iat` ≤ 90 days | NumericDate | `1790553600` | ✓ | — |
| `status` | Status list reference `status_list {idx, uri}` | object | `{"status_list":{"idx":9921,"uri":"https://status.tamga.network/2b8e01d4"}}` | — | ✓ |

### 2.6 Optional metadata

None. The student certificate has **no** `status` and the diploma **no** `exp` (§6).

### 2.7 Conditional metadata

| Data identifier | Condition | Data type | Example value |
| --- | --- | --- | --- |
| `category` | Only for issuers whose registered class is qualified or public, with the registered value (§2.1) | `urn:tamga:eaa:qualified` \| `urn:tamga:eaa:pub` | `urn:tamga:eaa:pub` |

## 3. Encoding

### 3.1 ISO/IEC 18013-5 (mdoc)

**Proximity analysis (ARB_02).** There is no need today to present education credentials in person and offline: campus entry uses
the access pass ([[ADR-0012]]); graduation checks are online. These types are therefore not issued as mdoc. The analysis is redone
when the ISO/IEC 18013-5 proximity flow is opened for campus use.

### 3.2 SD-JWT VC

The credentials are issued as [[t:SD-JWT-VC]] following the SD-JWT VC profile of HAIP 1.0 (ARB_01b): header `alg` ES256, `typ`
`dc+sd-jwt`, `x5c`; `_sd_alg` sha-256. `vct` is unique in the network (ARB_05); the type definition comes from the catalogue and
`vct#integrity` is mandatory (RB-SCH-01). The "Disclosable" column is the `sd` value in the Type Metadata: **MUST** = `always`,
**MAY** = `allowed`, **MUST NOT** = `never` (ARB_30). The reference issuance service also issues the `allowed` attributes as
separate disclosures.

| Data identifier | Claim name | Encoding | Reference / notes | Disclosable |
| --- | --- | --- | --- | --- |
| `family_name`, `given_name` | same | string | OpenID Connect Core §5.1 (IANA) | MUST |
| `birth_date` | `birth_date` | string, YYYY-MM-DD | ELM `dateOfBirth`; Tamga-specific name | MUST |
| `grade`, `thesis_title` | same | string / multilingual object | Tamga-specific (ELM mapping) | MUST |
| `awarding_body_name`, `awarding_body_id`, `awarding_body_country` | same | multilingual object / string | Tamga-specific (ELM mapping) | MAY |
| Student: `student_status`, `enrollment_year`, `study_level`, `programme_title`, `isced_f_code`, `faculty_name`, `expected_graduation_year`, `credit_points`, `enrollment_date`, `is_enrolled` | same | types in §2 | Tamga-specific (ELM mapping) | MAY |
| Diploma: `qualification_title`, `eqf_level`, `nqf_level`, `isced_f_code`, `awarding_date`, `mode_of_study`, `credit_points`, `grading_scheme`, `is_graduate`, `graduated_before` | same | types in §2 | Tamga-specific (ELM mapping) | MAY |
| `iss`, `vct`, `vct#integrity`, `iat`, `exp`, `cnf`, `status`, `category` | same | — | transport profile | MUST NOT |

A multilingual string is an object from a language tag (`tr-TR`, `en-US` …) to text (at least one language; every common schema
carries at least `tr-TR` and `en-US` display information, RB-SCH-03).

**Hidden by default.** `grade`, `thesis_title`, `birth_date`, `family_name` and `given_name` are not disclosed without the person's
explicit approval. In the employer's "graduation check" scenario `is_graduate`, `qualification_title`, `eqf_level`, `isced_f_code`,
`awarding_body_name` and `awarding_date` are disclosed; `birth_date`, `grade` and `thesis_title` are not.

**Example (diploma; the JWT claim set with disclosures resolved):**

```json
{
  "iss": "https://issuer.tamga.network/ornek-uni",
  "vct": "urn:tamga:edu:DiplomaCredential:1",
  "vct#integrity": "sha256-…",
  "iat": 1782777600,
  "cnf": { "jwk": { "kty": "EC", "crv": "P-256", "x": "…", "y": "…" } },
  "status": { "status_list": { "idx": 9921, "uri": "https://status.tamga.network/2b8e01d4" } },
  "family_name": "Yılmaz",
  "given_name": "Ayşe",
  "birth_date": "2001-03-09",
  "awarding_body_name": { "tr-TR": "Örnek Üniversitesi", "en-US": "Example University" },
  "awarding_body_id": "TR-ORNEK-UNI",
  "awarding_body_country": "TR",
  "qualification_title": { "tr-TR": "Lisans", "en-US": "Bachelor's degree" },
  "eqf_level": 6,
  "isced_f_code": "0613",
  "awarding_date": "2026-06-30",
  "is_graduate": true
}
```

Encoded credentials and disclosure examples are in the conformance vectors (`conformance/vectors/sd-jwt`).

### 3.3 W3C VCDM

Not used: no JSON-LD carrier is used. ELM JSON-LD export for EU education interoperability is an open topic (§7.2).

## 4. Usage

### 4.1 Use cases

Graduation check in a job application, student discount, campus entry; together with the identity credential for high-risk
transactions (public sector, banks). **Requesting a PID (ARB_27):** the verifier does not need to request a PID as well; in a
high-risk transaction that needs face matching, the identity credential or a PID is the verifier's responsibility (RB-RP-11).

### 4.2 Issuance policy: who issues

| Requirement | Student certificate | Diploma |
| --- | --- | --- |
| Issuer category | `EDUCATION` | `EDUCATION` |
| Minimum accreditation | I2 (under contract) | I2; **I3 SHOULD** |
| Type authorisation | This `vct` in `schema_authorizations` (time-windowed allow-list) | same |
| Legal authority | The authority to issue diplomas and student certificates lies outside the network (YÖK); the registrar **records it, does not approve it** | same |
| Authentic source | The institution's student information system (OBS) or its contracted connection | same |
| Key | Under the institution's control; at I3 in an HSM or e-seal | same |

An institution cannot authorise itself; authorisation comes with the registrar's entry.

### 4.3 To whom credentials are issued

- **Student certificate:** a student whose enrolment status is `ACTIVE` or `ON_LEAVE`. A graduate gets no student certificate;
  graduation is the diploma type.
- **Diploma:** a person whose graduation process is complete. The person applies in person; issuing on behalf of a third party
  (parent, attorney) requires proof of representation (RB-AP-12).
- **One active copy set** (10 copies) per student; on re-issuance the old set is revoked.
- Before issuance the wallet instance attestation (WIA) and key attestation (KA) are verified against `wallet_providers[]`
  (RB-AP-10).

### 4.4 Identity proofing before issuance

The level is not written into the [[t:credential]]; it is a prerequisite of the type.

| Type | Minimum level | Accepted routes |
| --- | --- | --- |
| Student certificate | **T1** | offer by email and transaction code by SMS; offer on the OBS screen |
| Diploma | **T2** | offer after multi-factor sign-in to OBS; the institution's registration desk (in person); licensed remote identity proofing |
| Additional option | T3 | Qualified electronic signature or mobile signature — only with the authorisation code flow or in person; **forbidden** with the pre-authorised flow |

**No diploma is issued** with email and SMS alone.

### 4.5 Presentation rules

- Only [[t:OpenID4VP]] and [[t:DCQL]]; signed request; encrypted response (RB-RP-02).
- Always the same copy per [[t:verifier]]; the disclosed attributes for the same verifier and the same type are consistent
  (RB-WP-05).
- The verifier's scope is a subset of this type's attributes; for a verifier asking for `grade`, `thesis_title` or `birth_date`
  the wallet shows an **over-asking warning**; if these attributes are not in scope the request is rejected.
- **Embedded disclosure policy** ([[ADR-0046]]): if the institution wants these types to be shown only to certain verifiers, it
  publishes the rule in its signed metadata; the rule is not put into the credential. The wallet stores the rule when it receives the
  credential and evaluates it at presentation; if the rule does not match it shows a separate warning, and the default choice is not
  to share (RB-AP-26, RB-WP-14).
- Proximity: campus entry uses the access pass; when the ISO/IEC 18013-5 proximity flow arrives it will be used (§3.1).
- Transactional data (ARF Topic 20) is not defined for these types.

**Example DCQL (graduation check):**

```json
{
  "credentials": [
    {
      "id": "diploma",
      "format": "dc+sd-jwt",
      "meta": { "vct_values": ["urn:tamga:edu:DiplomaCredential:1"] },
      "claims": [
        { "path": ["is_graduate"] },
        { "path": ["qualification_title"] },
        { "path": ["eqf_level"] },
        { "path": ["isced_f_code"] },
        { "path": ["awarding_body_name"] },
        { "path": ["awarding_date"] }
      ]
    }
  ]
}
```

### 4.6 Verification policy (the verifier's obligations)

Verification follows the canonical pipeline in the specification (RB-RP-03): freshness of the trust source, signature, issuer, type
authorisation, revocation, wallet binding. Type-specific rules:

| Policy | Required |
| --- | --- |
| `job-application-degree` (graduation check) | `vct = DiplomaCredential:1`; issuer in the `EDUCATION` category and authorised for this type; class at least I2 (**I3 SHOULD**); not revoked; `is_graduate = true`, `eqf_level ≥ 6`; there is no holder assurance attribute — the diploma type is bound with T2 |
| `student-discount` | `vct = StudentCredential:1`; issuer at least I2; not expired; only `is_enrolled = true` |
| `campus-access` | Same as `student-discount` plus the access pass registration; time-limited consent of at most 6 months |
| High-risk (public sector, banks) | The above plus face matching with the identity credential or a PID (the verifier's responsibility) |

Policy names are those of the reference verifier. The result has three values; `INDETERMINATE` is not acceptance; the user is told
"could not be verified", not "invalid".

### 4.7 Device binding

Both types are **device-bound** (ARB_34): each copy is bound to a separate key in the wallet's secure hardware (`cnf`; RB-AP-09).
`cryptographically_bound_to` is not used.

## 5. Trust anchors

For a non-qualified EAA the trust anchor comes from Tamga's signed trust lists (ARB_26):

1. The verifier fetches in advance the list of lists (`https://trust.tamga.network/lotl.jws`) and the national list (`tl-tr.jws`)
   and verifies their signatures against the root certificates; the root fingerprints are published with the same values on the
   `tamga.network/trust-anchor` page and in the Trust Framework (RB-OP-06).
2. The credential's `x5c` chain chains to the national root; `issuer_id` is the fingerprint of the leaf certificate (RB-AP-01,
   RB-RP-04).
3. The `tl-tr › issuers[]` entry gives the institution's category (`EDUCATION`), its class and its time-windowed authorisation for
   this type; the check uses the credential's `iat`.
4. The type is verified with the `lotl › schemas[]` entry and the `content_hash` in the catalogue (= `vct#integrity`).

At issuance the wallet checks against the same entry that the institution is authorised to issue this type.

## 6. Validity and revocation

### 6.1 Validity policy

| Topic | Student certificate | Diploma |
| --- | --- | --- |
| Validity | At most 90 days; before expiry the copies in the wallet refresh themselves with a refresh token ([[ADR-0023]]) and the institution re-reads its record | No expiry (no `exp`) |
| Institution suspended | No new credentials; existing credentials stay valid until they expire | No new credentials; old diplomas stay valid according to their date of issuance |
| Certificate renewal | Old credentials are verified with the old `issuer_id` entry | same |

### 6.2 Revocation

| Topic | Student certificate | Diploma |
| --- | --- | --- |
| Revocable | No — the short lifetime (≤ 90 days) replaces revocation; an unexpired credential that is no longer accurate is an accepted risk | **Yes, mandatory** — Token Status List (the EU Attestation Status List), `status.status_list {uri, idx}` |
| Revocation conditions | — (not re-issued) | Revocation of the diploma (forgery, court decision), incorrect credential (by re-issuance), withdrawal of consent, report of a device breach, the person's objection to the "your credential was added to a wallet" notice, a change of the disclosure rule — details in [[FW-POL-0001]] §3 |
| Suspension | — | `SUSPENDED` (2-bit value) — during a review |
| Publication | — | Fixed interval (today 2 minutes), even without changes; a list is valid for 6 hours; no emergency publication; revocation takes effect within minutes |
| List address (ARB_24a) | — | `status.status_list.uri` in the credential; under `https://status.tamga.network/` for the issuance service hosted by the network, on the institution's status server for an institution running its own service; the address is opaque (RB-AP-18) |

## 7. Compliance

### 7.1 Relation to the EU framework

- This rulebook follows the section structure of the EU Attestation Rulebook template (1.5) (ARB_29); the Topic 12 mapping is in
  Tamga Rulebook §11.
- The attributes are mapped to ELM v3 and the DC4EU education profiles (ARB_07, ARB_08); the mapping is in the type definition
  (§8).
- These types inherit all rules of the Tamga Rulebook.

### 7.2 Known differences and open decisions

| Topic | Status |
| --- | --- |
| Making I3 accreditation mandatory for the diploma | **Open decision** after the pilot |
| ELM JSON-LD export | Open topic for EU education interoperability |
| Trust anchor location in the credential (ARB_21) | Carrying an optional trust anchor pointer (`trust_anchor`) in the credential is an **open decision** |
| Indication of a non-qualified EAA (ARB_12) | The EU template's `eaa:eu:non-qualified` value conflicts with the ETSI rule; adopting it is an **open decision** |
| `nbf` and `exp` in the diploma | ETSI TS 119 472-1 requires both; Tamga does not write `nbf` today and the diploma has no expiry |
| Attestation Revocation List | Only the Status List is published today |

## 8. Semantic basis and versioning

- The ELM v3 and Europass mapping is normative; ISCED-F 2013 (2–4 digits), EQF 5–8, TYÇ `nqf_level`.
- The ISCED-F mapping table of the programme is provided by the institution; without a match no credential is issued (RB-AP-13).
- The major version of the type is in the URN (`…:1`); adding or removing an attribute means a new major version and a new section
  in the rulebook.
- Minor and patch versions (display, description) are published with a new `metadata_url` and `content_hash` under the same URN;
  the catalogue marks the current version; a published file never changes (RB-SCH-02).
- A type in `DEPRECATED` status stays verifiable.
- This rulebook is updated at the same time as [[SPEC-SCHEMA-0002]] changes version.

## 9. References

The EU Attestation Rulebook template, ARF Annex 2 Topics 7, 10 and 12, ETSI TS 119 472-1, SD-JWT VC, HAIP 1.0, IETF Token Status
List, ELM v3. The Tamga decisions and specifications this document rests on are listed in Annex E.

## Status

**Active** — version 1.0.0 (2 October 2026; moved to the EU template structure on 11 October 2026).
