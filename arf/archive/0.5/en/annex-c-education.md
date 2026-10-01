---
title: "Annex C — Attestation Rulebook: Education"
translation_of: FW-RB-0002
source_version: 0.1.1
outline: [2, 3]
---

# Annex C — Attestation Rulebook: Education (Student Certificate and Diploma)

<div class="arf-meta">

**Document** FW-RB-0002 · **Version** 0.1.1 · **Status** Active · **Updated** 2026-09-27 · **Licence** CC BY 4.0
Official English translation of the Turkish source text; in case of conflict the Turkish text prevails.

</div>

The attestation rulebook for the two NETWORK types in education (student certificate, diploma): type identifiers, data model
summary and selective-disclosure policy, who may issue, identity proofing level before issuance, validity and revocation,
presentation and verification policy, semantic basis (ELM v3 / ISCED-F / EQF), trust anchor and versioning. Written on the
pattern of the EUDI ARF attestation rulebooks; the technical schema is in [[SPEC-SCHEMA-0002]], this annex gathers the
rules an institution needs to read.

## 0. Scope

This rulebook covers two types:

| Type | `vct` | `schema_id` | Catalogue |
|---|---|---|---|
| Student certificate | `urn:tamga:edu:StudentCredential:1` | `keccak256(vct)` | `schemas.tamga.network/v1/edu/StudentCredential/1.0.0` |
| Diploma | `urn:tamga:edu:DiplomaCredential:1` | `keccak256(vct)` | `schemas.tamga.network/v1/edu/DiplomaCredential/1.0.0` |

Both extend the root type `urn:tamga:core:TamgaBaseCredential:1` ([[SPEC-SCHEMA-0001]]/D4). The technical definition (JSON
Schema, Type Metadata, ELM mapping) is in **[[SPEC-SCHEMA-0002]]**; in a conflict that document prevails. This rulebook
answers the questions of an ARF attestation rulebook: who issues, to whom, with which identity proofing, for how long, how it
is revoked, how it is presented and verified.

Terminology: in EU terms these documents are non-qualified **EAAs**; the Tamga class follows the issuer's registration —
EAA / QUALIFIED / PUB ([[ADR-0010]] K5).

## 1. Data model (summary)

### 1.1 Common claims (root type)

| Claim | Type | Selective disclosure | Note |
|---|---|---|---|
| `family_name`, `given_name` | string | `always` | Person |
| `birth_date` | DateOnly | `always` | **Not disclosed** in the employer scenario (age-discrimination surface) |
| `awarding_body_name` | LangString | `allowed` | Official name of the institution |
| `awarding_body_id` | string | `allowed` | Institution identifier (not `issuer_id`; ELM identifier) |
| `awarding_body_country` | ISO 3166-1 alpha-2 | `allowed` | |
| `cnf` | JWK | — | Holder binding (mandatory) |
| `vct`, `vct#integrity`, `iss`, `iat`, (`exp`), (`status`), (`category`) | — | — | Wire profile |

**Forbidden:** a national identity number in any field ([[SPEC-SCHEMA-0002]]/E1, E10); no photo claim (face matching is
done with an identity document / PID).

### 1.2 Student certificate — additional claims

`student_status` (`ACTIVE | ON_LEAVE`; never graduates), `enrollment_year`, `study_level` (EQF 5–8), `programme_title`
(LangString), `isced_f_code` (2–4 digits, mandatory), `faculty_name`, `expected_graduation_year`, `is_enrolled` (derived,
`true`). All `allowed`. `exp` is **mandatory**, `exp − iat ≤ 90 days` (E4, E9). **No** `status` (E5).

### 1.3 Diploma — additional claims

`qualification_title`, `eqf_level`, `nqf_level` (national qualifications framework), `isced_f_code`, `awarding_date`,
`mode_of_study`, `credit_points` (ECTS), **`grade` (`always`)**, `grading_scheme`, **`thesis_title` (`always`)**,
`is_graduate` (derived, always `true` — E3), `graduated_before` (derived). **No** `exp`; `status` (Token Status List) is
**mandatory** (E4, E5).

### 1.4 Selective-disclosure policy (for institutions)

| Field | Default at presentation | Rule |
|---|---|---|
| `grade`, `thesis_title`, `birth_date`, `family_name`, `given_name` | Hidden (`always`) | Not disclosed without the person's explicit approval |
| Other fields | Disclosed if requested (`allowed`) | Must be within the RP's scope |
| `status`, `cnf`, `vct`, `iss`, `iat` | Always visible (`never`) | Not personal data |

The employer "proof of graduation" scenario discloses `is_graduate`, `qualification_title`, `eqf_level`, `isced_f_code`,
`awarding_body_name`, `awarding_date`; it does not disclose `birth_date`, `grade` or `thesis_title`
([[SPEC-SCHEMA-0002]] §3.7).

## 2. Who may issue

| Requirement | Student certificate | Diploma |
|---|---|---|
| Issuer category | `EDUCATION` | `EDUCATION` |
| Minimum accreditation | I2 (contracted) | I2; **I3 SHOULD** (I3 MUST after the pilot — PROPOSAL) |
| Schema authorisation | This `vct` in `schema_authorizations` (time-windowed allowlist) | same |
| Legal authority | The authority to award diplomas / student certificates is outside the ecosystem (higher-education authority); the Registrar **records it, it does not grant it** | same |
| Authentic Source | The institution's student information system or its contracted adapter; in the demo the portal database (S-4) | same |
| Key | Under the institution's control (G1); HSM / e-seal at I3 | same |

An institution cannot authorise itself; authorisation comes with the Registrar's entry ([[FW-RB-0001]] RB-REG-04).

## 3. To whom it is issued

- **Student certificate:** a student whose enrolment status is `ACTIVE` or `ON_LEAVE`. Graduates do not get a student
  certificate; graduation = the diploma type.
- **Diploma:** a person whose graduation process is complete. The subject applies; issuance on behalf of a third person
  (parent/proxy) requires proof of representation (RB-AP-12).
- **One active set of copies** per student (batch of 10); re-issuance revokes the older set.

## 4. Identity proofing before issuance (binding level)

The level is not written into the credential; it is a precondition of the type ([[SPEC-PROTO-0001]]/PR7; the eIDAS model).

| Type | Minimum level | Accepted paths (phase B) | Source |
|---|---|---|---|
| Student certificate | **T1** | e-mail offer + SMS `tx_code`; offer on the student-system screen (`on-screen`) | issuance binding note |
| Diploma | **T2** | offer on the student-system screen with MFA; the institution's registration desk (in person); **licensed remote identity verification** (document + liveness + face match — [[SPEC-ID-0003]]) | same; ETSI TS 119 461 |
| (phase 0+) | T3 option | Qualified e-signature / mobile-signature challenge — only through the authorisation-code flow or in person; **forbidden** with pre-authorised issuance | ETSI TS 119 472-3 GEN-REQ-4.1 |

A diploma is **never issued** with e-mail + SMS alone. Because the portal login in the demo is simulated, the diploma T2
condition is recorded as deviation S-10 (PROPOSAL) and is closed in the pilot through remote verification or the
registration desk.

## 5. Validity, renewal, revocation

| Topic | Student certificate | Diploma |
|---|---|---|
| Validity | `exp ≤ iat + 90 days` (E9); before expiry the wallet refreshes copies automatically with a refresh token; the institution re-reads its record ([[ADR-0023]]; WL7) | Unlimited (no `exp`) |
| Status list | None (E5) — the short lifetime replaces revocation; the "stale document gap" is an accepted risk | **Mandatory** (E5); `status.status_list {uri, idx}` |
| Reasons for revocation | — (not re-issued) | Diploma annulment (fraud, court decision), wrong issuance (with re-issuance), withdrawal of consent (GT7), reported device compromise |
| Suspension | — | `SUSPENDED` (a bits = 2 value) — during a review |
| Publication cadence | — | Fixed interval (pilot 60 min; demo 2 min); no urgent publication; revocation effective within ≤ 90 min |
| Institution suspended | New issuance stops; existing documents valid until `exp` | New issuance stops; older diplomas valid by `iat` (C1) |
| Certificate rotation | Older documents verify against the older `issuer_id` entry | same |

## 6. Presentation rules

- OpenID4VP + DCQL only; signed request; encrypted response ([[SPEC-PROTO-0002]]).
- One sticky copy per verifier; a consistent disclosure set for the same verifier + `vct` (WL5, WL6).
- An RP's scope is a subset of this type's claims; for an RP requesting `grade` / `thesis_title` / `birth_date`, the wallet
  shows an **over-asking warning** (WL8); if these fields are not in the scope, the request is refused.
- Proximity: a pass-card bridge for campus access ([[ADR-0012]] B); ISO 18013-5 proximity transport in phase 1.

**Example DCQL (proof of graduation):**

```json
{
  "credentials": [{
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
  }]
}
```

## 7. Verification policy (for RPs)

Canonical pipeline T0 + A–E ([[SPEC-API-0001]]). Type-specific `E` steps:

| Policy | Required |
|---|---|
| `job-application-degree` (proof of graduation for hiring) | `vct = DiplomaCredential:1`; issuer in the `EDUCATION` category and authorised for this type; class ≥ I2 (**I3 SHOULD**); status active; `is_graduate = true`, `eqf_level ≥ 6`; **no holder field** — the diploma type is bound at T2 |
| `student-discount` (student discount) | `vct = StudentCredential:1`; issuer ≥ I2; `exp` not passed; only `is_enrolled = true` |
| `campus-access` (campus access) | Same as `student-discount` + pass-card registration ([[ADR-0012]] B); time-limited consent ≤ 6 months |
| High risk (public sector, banks) | The above + face matching against an identity document / PID (the RP's responsibility) |

Policy names are those of the reference verifier. The result is three-valued; `INDETERMINATE` is not acceptance; the person
is told "could not be verified", not "invalid".

## 8. Semantic basis and export

- The ELM v3 / Europass mapping is normative ([[SPEC-SCHEMA-0002]] §4); ISCED-F 2013 (2–4 digits), EQF 5–8, national
  `nqf_level` ([[RS-SCHEMA-0001]]).
- No JSON-LD carrier (D-SCHEMA-3); an **output bridge** for EU education interoperability (ELM JSON-LD export) is an open
  question.
- The institution provides the programme → ISCED-F mapping table; without a counterpart, issuance stops (E11).

## 9. Trust anchor

The verifier checks the issuer against its `tl-tr › issuers[]` entry (`issuer_id` = leaf certificate fingerprint) and the
type against `lotl › schemas[]` + the catalogue `content_hash`; root fingerprints are at `tamga.network/trust-anchor`. As
in the PID rulebook, a document **may** carry an optional `trust_anchor` pointer (PROPOSAL).

## 10. Versioning and change

- The type's major version is in the URN (`…:1`); adding or removing claims → new major → new rulebook section.
- Minor/patch (display, descriptions) → new `metadata_url` + `content_hash`, same URN; the catalogue marks the current one;
  a published file never changes.
- A `DEPRECATED` type stays verifiable.
- This rulebook is updated in the same session as a version increase of [[SPEC-SCHEMA-0002]].

## 11. Demo and pilot deviations (for these types)

| # | Deviation | Closure |
|---|---|---|
| S-1 | Issuer key in Tamga's development PKI | KMS/HSM at the institution |
| S-2 | Status interval 2 min | 60 min |
| S-4 | Authentic Source = portal database | Student-system / CSV adapter |
| S-10 (PROPOSAL) | In the demo the diploma is issued without T2 identity proofing (simulated student login) | Remote verification / registration desk ([[SPEC-ID-0003]]) |

## Related documents

[[FW-ARF-0001]] · [[FW-TF-0001]] · [[FW-RB-0001]] · [[SPEC-SCHEMA-0001]] · [[SPEC-SCHEMA-0002]] · [[SPEC-CRED-0002]] ·
[[SPEC-CRED-0003]] · [[SPEC-PROTO-0001]] · [[SPEC-PROTO-0002]] · [[SPEC-API-0001]] · [[SPEC-WALLET-0001]] · [[SPEC-ID-0003]] ·
[[RS-SCHEMA-0001]] · [[ADR-0010]]

## Change history

- **0.1.1 (2026-09-27)** — Annex C of Tamga ARF ([[ADR-0018]]); §7 policy names aligned with the reference verifier; §6
  proximity.
- **0.1.0 (2026-09-24)** — First version, accepted 2026-09-24 (D-GOV-6).
