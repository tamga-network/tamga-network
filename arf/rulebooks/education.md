---
title: "Education Rulebook"
translation_of: FW-RB-0002
source_version: 1.0.0
outline: [2, 3]
---

# Education Rulebook

<div class="arf-meta">

**Document** FW-RB-0002 · **Version** 1.0.0 · **Status** Active · **Updated** 2026-10-02 · **Licence** CC BY 4.0
Official English translation of the Turkish source text; in case of conflict the Turkish text prevails.

</div>

The rulebook for the two shared credential types in education (student certificate, diploma): type identifiers, data model
summary and selective disclosure policy, who may issue, the [[t:identity-proofing]] level before issuance, validity and
[[t:revocation]], presentation and verification policy, semantic basis (ELM v3 / ISCED-F / EQF), [[t:trust-anchor]] and versioning. It
branches from the Tamga [[t:rulebook|Rulebook]] ([[FW-RB-0001]]) and is written on the pattern of the EUDI [[t:ARF]] Annex 3 rulebooks; the
technical schema is in [[SPEC-SCHEMA-0002]], and this annex gathers the rules an institution needs to read.

## 0. Scope

This rulebook covers two credential types:

| Type                | `vct`                               | Catalogue                                              |
| ------------------- | ----------------------------------- | ------------------------------------------------------ |
| Student certificate | `urn:tamga:edu:StudentCredential:1` | `schemas.tamga.network/v1/edu/StudentCredential/1.0.0` |
| Diploma             | `urn:tamga:edu:DiplomaCredential:1` | `schemas.tamga.network/v1/edu/DiplomaCredential/1.0.0` |

Both extend the root type `urn:tamga:core:TamgaBaseCredential:1`. The technical definition (JSON Schema, type definition, ELM
mapping) is in **[[SPEC-SCHEMA-0002]]**; in a conflict that document prevails. Following the ARF Annex 3 pattern, this rulebook
answers: who issues, to whom, with which identity proofing, for how long it is valid, how it is revoked, how it is presented and
verified.

Terminology: in EU terms these credentials are non-qualified **[[t:EAA]]**; the Tamga class follows the [[t:issuer]]'s registration:
EAA, qualified or public.

## 1. Data model (summary)

### 1.1 Common attributes (root type)

| Attribute                                                               | Type                | Selective disclosure | Note                                                                 |
| ----------------------------------------------------------------------- | ------------------- | -------------------- | -------------------------------------------------------------------- |
| `family_name`, `given_name`                                             | string              | `always`             | Person                                                               |
| `birth_date`                                                            | date                | `always`             | **Not disclosed** in the employer scenario (age discrimination risk) |
| `awarding_body_name`                                                    | multilingual string | `allowed`            | The institution's official name                                      |
| `awarding_body_id`                                                      | string              | `allowed`            | Institution identifier (not `issuer_id`; the ELM identifier)         |
| `awarding_body_country`                                                 | ISO 3166-1 alpha-2  | `allowed`            |                                                                      |
| `cnf`                                                                   | JWK                 | —                    | Binding to the wallet key (mandatory)                                |
| `vct`, `vct#integrity`, `iss`, `iat`, (`exp`), (`status`), (`category`) | —                   | —                    | Transport profile                                                    |

**Forbidden:** a national identity number (TCKN etc.) in any attribute; there is no photo attribute (face matching is done with
the identity credential or [[t:PID]]).

### 1.2 Student certificate — additional attributes

`student_status` (`ACTIVE | ON_LEAVE`; no graduates), `enrollment_year`, `study_level` (EQF 5–8), `programme_title`
(multilingual string), `isced_f_code` (2–4 digits, mandatory), `faculty_name`, `expected_graduation_year`, `is_enrolled`
(derived, `true`). All `allowed`. `exp` is **mandatory** and `exp − iat` is at most 90 days. There is **no** `status`.

### 1.3 Diploma — additional attributes

`qualification_title`, `eqf_level`, `nqf_level` (TYÇ), `isced_f_code`, `awarding_date`, `mode_of_study`, `credit_points` (ECTS),
**`grade` (`always`)**, `grading_scheme`, **`thesis_title` (`always`)**, `is_graduate` (derived, fixed `true`),
`graduated_before` (derived). There is **no** `exp`; `status` ([[t:status-list]], IETF Token Status List) is **mandatory**.

### 1.4 Selective disclosure policy

| Attribute                                                          | Default                          | Rule                                               |
| ------------------------------------------------------------------ | -------------------------------- | -------------------------------------------------- |
| `grade`, `thesis_title`, `birth_date`, `family_name`, `given_name` | Hidden (`always`)                | Not disclosed without the user's explicit approval |
| Other attributes                                                   | Disclosed on request (`allowed`) | Must be in the verifier's scope                    |
| `status`, `cnf`, `vct`, `iss`, `iat`                               | Always visible (`never`)         | Not personal data                                  |

The employer's "degree confirmation" scenario: `is_graduate`, `qualification_title`, `eqf_level`, `isced_f_code`,
`awarding_body_name`, `awarding_date` are disclosed; `birth_date`, `grade` and `thesis_title` are not.

## 2. Who may issue

| Requirement               | Student certificate                                                                                                                                                    | Diploma           |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Issuer category           | `EDUCATION`                                                                                                                                                            | `EDUCATION`       |
| Minimum accreditation     | I2 (contracted)                                                                                                                                                        | I2; **I3 SHOULD** |
| Credential type authority | This `vct` in `schema_authorizations` (a time-windowed allow-list)                                                                                                     | the same          |
| Legal authority           | The authority to award diplomas and student certificates lies outside the network (the Council of Higher Education); the registrar **records it, it does not approve** | the same          |
| Authentic source          | The institution's student information system or its contracted connection                                                                                              | the same          |
| Key                       | Under the institution's control; in an HSM or e-seal at I3                                                                                                             | the same          |

An institution cannot authorise itself; authority comes with the registrar's entry.

## 3. To whom it is issued

- **Student certificate:** a student whose enrolment status is `ACTIVE` or `ON_LEAVE`. No student certificate is issued to a
  graduate; graduation is the diploma type.
- **Diploma:** a person who has completed the graduation process. The person applies; issuing on behalf of a third person
  (parent, proxy) requires proof of representation (RB-AP-12).
- **One active set of copies** (10 copies) per student; on re-issuance the old set is revoked.

## 4. Identity proofing before issuance

The level is not written into the [[t:credential]]; it is a precondition of the type.

| Type                | Minimum level | Accepted paths                                                                                                                                             |
| ------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Student certificate | **T1**        | Offer by e-mail and transaction code by SMS; offer on the student information system screen                                                                |
| Diploma             | **T2**        | Offer in the student information system after multi-factor sign-in; the institution's registration desk (in person); licensed remote identity verification |
| Further option      | T3            | Qualified electronic or mobile signature — only through the authorisation code flow or in person; **forbidden** with the pre-authorised flow               |

A **diploma is never issued** with e-mail and SMS alone.

## 5. Validity, renewal, revocation

| Topic                 | Student certificate                                                                                                                        | Diploma                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Validity              | At most 90 days; before expiry the copies in the wallet refresh themselves with a refresh token and the institution reads its record again | Unlimited (no `exp`)                                                                                                                         |
| Revocation list       | None — the short life replaces revocation; a credential that has not expired but is no longer accurate is an accepted risk                 | **Mandatory**; `status.status_list {uri, idx}`                                                                                               |
| Reasons to revoke     | — (not re-issued)                                                                                                                          | Annulment of the diploma (forgery, court decision), an incorrect credential (by re-issuing), withdrawal of consent, a reported device breach |
| Suspension            | —                                                                                                                                          | `SUSPENDED` (2-bit value) — during a review                                                                                                  |
| Publication interval  | —                                                                                                                                          | Fixed interval (60 minutes in the pilot; 2 minutes in today's trial operation); no urgent publication; a revocation takes effect within 90 minutes at most                         |
| Institution suspended | No new credentials; existing ones remain valid until they expire                                                                           | No new credentials; earlier diplomas remain valid according to their issue date                                                              |
| Certificate renewal   | Earlier credentials are verified against the old `issuer_id` entry                                                                         | the same                                                                                                                                     |

## 6. Presentation rules

- Only [[t:OpenID4VP]] and [[t:DCQL]]; signed request; encrypted response.
- Always the same copy per [[t:verifier]]; the attributes disclosed to the same verifier for the same type are consistent.
- A verifier's scope is a subset of this type's attributes; for a verifier asking for `grade`, `thesis_title` or `birth_date`, the
  wallet shows an **over-asking warning**; if these attributes are not in the scope, the request is rejected.
- In person: the access pass is used for campus access; once the ISO/IEC 18013-5 proximity flow arrives, it replaces it.

**Example DCQL (degree confirmation):**

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

## 7. Verification policy (for verifiers)

Verification uses the canonical pipeline of the specification (RB-RP-03). Type-specific rules:

| Policy                                         | Required                                                                                                                                                                                                                                                             |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `job-application-degree` (degree confirmation) | `vct = DiplomaCredential:1`; the issuer is in the `EDUCATION` category and authorised for this type; class at least I2 (**I3 SHOULD**); not revoked; `is_graduate = true`, `eqf_level ≥ 6`; there is no holder assurance attribute — the diploma type is bound at T2 |
| `student-discount`                             | `vct = StudentCredential:1`; issuer at least I2; not expired; only `is_enrolled = true`                                                                                                                                                                              |
| `campus-access`                                | The same as `student-discount`, plus an access pass registration; time-limited consent of at most 6 months                                                                                                                                                           |
| High risk (public sector, banks)               | All of the above, plus face matching with the identity credential or PID (the verifier's responsibility)                                                                                                                                                             |

The policy names are those of the reference verifier. The result has three values; `INDETERMINATE` is not acceptance; the user
is told "cannot be verified", not "invalid".

## 8. Semantic basis and export

- The ELM v3 and Europass mapping is normative; ISCED-F 2013 (2–4 digits), EQF 5–8, TYÇ `nqf_level`.
- No JSON-LD carrier is used.
- The programme-to-ISCED-F mapping table is provided by the institution; without a match no credential is issued.

## 9. Trust anchor

The verifier checks the issuer against the `tl-tr › issuers[]` entry (`issuer_id` = the fingerprint of the leaf certificate) and
the type against the `lotl › schemas[]` entry and the catalogue `content_hash`; root fingerprints are on
`tamga.network/trust-anchor`.

## 10. Versioning and change

- The type's major version is in the URN (`…:1`); adding or removing an attribute means a new major version and a new section in
  the rulebook.
- Minor and patch versions (display, description) are published with a new `metadata_url` and `content_hash` under the same URN;
  the catalogue marks the current version; a published file never changes.
- A type in `DEPRECATED` status remains verifiable.
- This rulebook is updated at the same time as any version change of [[SPEC-SCHEMA-0002]].

## 11. Open topics

- Making I3 accreditation mandatory for diplomas after the pilot.
- Export in ELM JSON-LD format for EU education interoperability.
- Carrying an optional trust anchor pointer (`trust_anchor`) in the credential.

## References

The decisions, specifications and standards this document rests on are listed in Annex E.

## Status

**Active** — version 1.0.0 (2 October 2026).
