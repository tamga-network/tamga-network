---
document_id: SPEC-SCHEMA-0002
title: "Education schemas"
status: Active
version: 1.0.0
created: 2026-09-09
last_updated: 2026-10-09
summary: >
  Normatively defines the pilot's two credential types. TamgaStudentCredential: short-lived (90 days), no status list,
  proves student status. TamgaDiplomaCredential: long-lived, uses a status list, proves graduation. For both it gives the
  full JSON Schema, Type Metadata, ELM v3 mapping table, selective disclosure policy, derived boolean claims, an example
  payload and the mapping to the university's student information system (SIS). The scope is deliberately narrow —
  transcripts, micro-credentials and other types are left until after the pilot.
translation_of: SPEC-SCHEMA-0002
source_version: 1.0.0
---

This specification defines Tamga's two education credentials — the student certificate and the diploma — field by field; it
is written for universities, teams integrating a student information system (SIS) and developers who verify these
credentials.

**When to read**

- First read the [Credential formats](/concepts/credential-formats) and [Privacy](/concepts/privacy) pages.
- If you will issue credentials as an institution: [[GUIDE-0003]]; the rules institutions follow are in [[FW-RB-0002]].
- How type definitions are published: [[SPEC-SCHEMA-0001]].

**In brief**

The student certificate says "this person is currently enrolled at this university"; the diploma says "this person graduated
from this programme". For every field it is defined whether the person can choose to show it or not: for example, the diploma
grade is hidden by default and disclosed only if the person wants. The identity number is not put into the credential; the
credential is bound to a key on the person's phone. The diploma is mapped to ELM, the EU's education data model, so it can be
transferred into European systems.

---

# Scope

This specification defines **two** credential types:

| `vct` | Purpose |
|---|---|
| `urn:tamga:edu:StudentCredential:1` | Student status |
| `urn:tamga:edu:DiplomaCredential:1` | Graduation |

**Out of scope (deliberately):** transcripts, course completion, micro-credentials, graduation-soon, disciplinary
certificates. These are left until after the pilot; every new type means pulling more data from the university's student
information system (SIS), and the integration surface is the pilot's most fragile point.

The registry mechanism is in [[SPEC-SCHEMA-0001]]; the international models the schemas rely on are in [[RS-SCHEMA-0001]].

---

# 1. Common basis

Both types derive from `core/TamgaBaseCredential/1.0.0` ([[SPEC-SCHEMA-0001]] §4). The `iss`, `vct`, `vct#integrity`, `iat`
and `cnf` claims inherited from the root type are not repeated here.

## 1.1 Common education fields

Fields present in both types:

| Claim | Type | `sd` | ELM counterpart |
|---|---|---|---|
| `family_name` | string | `always` | `Person.familyName` |
| `given_name` | string | `always` | `Person.givenName` |
| `birth_date` | DateOnly | `always` | `Person.dateOfBirth` |
| `awarding_body_name` | LangString | `allowed` | `Organisation.legalName` |
| `awarding_body_id` | string | `allowed` | `Organisation.identifier` |
| `awarding_body_country` | string (ISO 3166-1 alpha-2) | `allowed` | `Organisation.location.country` |

`awarding_body_id` is the institution's national registration number (in Türkiye, the Council of Higher Education (YÖK)
institution code). It must not be confused with `iss`: `iss` is the cryptographic [[t:issuer]] identity, `awarding_body_id`
the administrative institution identity. They may not be the same institution — a central issuing service may sign on behalf
of a university.

## 1.2 Decision on the identity number

**The Turkish national identity number (TCKN) or any equivalent national identity number does not appear in these
schemas.**

### 1.2.1 What `cnf` proves and what it does not

This distinction is very easy to misunderstand, and because the schema's rationale rests on it, it must be stated clearly
here.

The `cnf` claim and key binding ([[SPEC-CRED-0001]] §3) prove:

> The party presenting the credential controls the private key that was bound to this credential at issuance.

That is, **"the [[t:holder]] at issuance and the holder at presentation are the same"**. What it does not prove:

> The human in front of you is the person named in the credential.

`cnf` binds to a **device key**, not to a **human**. If Ayşe gives her phone and PIN to someone else, that person presents a
diploma with a valid signature and a valid key binding; no step of the verification chain fails.

### 1.2.2 What solves identity matching

The right solution is **a combined presentation**: in the same [[t:OpenID4VP]] request the diploma and the state identity
[[t:credential]] ([[t:PID]]) are presented together, both bound to **the same `cnf` key**. The [[t:verifier]] thus knows the
two credentials belong to the same wallet, and the PID carries the identity. This is the approach of the EUDI ecosystem
([[RS-EIDAS-0001]]).

**There is no PID in the initial stage.** Without state participation this mechanism does not work.

### 1.2.3 The initial-stage limitation (recorded explicitly)

What actually happens in the pilot: the verifier compares the `family_name`, `given_name` and `birth_date` fields in the
credential with an identity document the candidate presents separately.

This is a **procedural**, not a cryptographic, match, and it is weak. But it is exactly what is done with a paper diploma
today — so Tamga introduces no regression here; it only postpones the expected improvement to the state stage.

**This limitation must be communicated clearly to the pilot participants (university and verifier).** → work item in
PM-GTM-0001.

### 1.2.4 Why the identity number is not added

The conclusion from the above: adding the identity number **would not solve** this problem. The person making a fraudulent
presentation would also have the holder's identity number; the procedural match would stay the same.

On the other hand, adding the identity number has a certain cost: it creates a permanent and unique **correlation key**
across the network. Credentials obtained from different issuers and presentations made to different verifiers become linkable
through the same number.

Zero benefit, certain cost → the field is not in the schema.

For the exceptional scenarios that need it (official recognition procedures, public-sector employment), a separate NATIONAL
schema is written — `tr/edu/...` — and there the field is `sd: always`.

---

# 2. TamgaStudentCredential

> **Development stage ([[ADR-0029]]):** optional `credit_points` (programme workload, ECTS) and `enrollment_date` — fields
> mandatory in the EU DC4EU enrolment certificate (EUHEPOE); `tamga.elm_mapping` gives the ELM counterpart of every claim. The
> DiplomaCredential also carries its ELM counterparts (EUHED).

## 2.1 Design decisions

| Topic | Decision | Rationale |
|---|---|---|
| Lifetime | **At most 90 days** (`exp` mandatory) — a ceiling, not a fixed value | Student status changes |
| Status list | **Not used** | [[ADR-0008]] Alt. C — a short lifetime replaces revocation |
| Issuer assurance | **I2** minimum | [[PM-ASSUR-0001]] |
| Freshness | Set by **verifier policy** — §2.1.2 | The risk level depends on the verifier |
| Refresh | When the student wants; with a batch | No automatic refresh (tracking surface) |

**Why no status list:** running a [[t:revocation]] mechanism for a 90-day credential costs more than it gains. Keeping a
[[t:status-list]] index for every student, on the other hand, adds a permanent operational burden for the issuer and a
correlation surface.

### 2.1.1 The stale-credential gap (an accepted and managed risk)

A short lifetime replacing revocation **is not free.** If a student withdraws a day after receiving the credential, they are
left with an "I am an active student" credential valid for 89 more days. No step of the verification chain catches this.

The impact depends on the use case:

| Scenario | Stale-credential risk |
|---|---|
| Student discount (cinema, transport, software licence) | Low — limited financial loss |
| Library/campus access | Low — physical checks exist |
| Exam application, scholarship | Medium |
| Student visa, residence permit | **High** |

This schema is in the NETWORK layer and long-lived; the type used for a cinema discount today may be used for a residence
permit tomorrow. The solution is not to add a status list but **to move freshness to the verifier.**

### 2.1.2 Verifier freshness policy (mechanism)

`default_ttl_days: 90` is a **ceiling.** The issuer may give a shorter `exp` and should do so in high-risk scenarios.

On the verifier side the mechanism is: the presentation request states a **maximum `iat` age**.

> *"I want a `StudentCredential` issued within the last 7 days."*

If the wallet holds no credential meeting this condition, it directs the user to obtain a new one from the issuer. No
revocation infrastructure is needed; the freshness requirement is defined by the party that bears the risk.

Suggested thresholds (to be made normative in [[SPEC-PROTO-0002]]):

| Risk | Maximum `iat` age |
|---|---|
| Low (discount) | 90 days |
| Medium (scholarship, exam) | 14 days |
| High (official procedure) | 24 hours – 7 days |

### 2.1.3 Batch issuance (privacy balance)

The cost of §2.1.2 is frequent refresh. If the wallet goes to the issuer for every freshness need, the university regularly
receives the signal "how often does this person use their credential" — a silent tracking channel.

The solution is **batch issuance**: the wallet obtains several credentials (proposal: 10–12) in a single issuance session and
spends a **different** one for each presentation. The university sees only the moment of the batch issuance, not the
individual uses.

Batch issuance is a feature supported by [[t:OpenID4VCI]]; the protocol details are defined in [[SPEC-PROTO-0001]].

**There is still no automatic refresh.** A batch issuance starts with a user action; the wallet does not refresh by itself in
the background.

## 2.2 Field table

| Claim | Type | Required | `sd` | Description |
|---|---|---|---|---|
| `student_status` | enum | ✓ | `allowed` | `ACTIVE` \| `ON_LEAVE` — §2.2.1 |
| `enrollment_year` | integer | ✓ | `allowed` | Year of enrolment |
| `study_level` | integer (EQF) | ✓ | `allowed` | 5–8 |
| `programme_title` | LangString | ✓ | `allowed` | Programme name |
| `isced_f_code` | string | ✓ | `allowed` | ISCED-F 2013, 2–4 digits — §6.4 |
| `faculty_name` | LangString | — | `allowed` | Faculty |
| `expected_graduation_year` | integer | — | `allowed` | Estimated |
| `is_enrolled` | boolean | ✓ | `allowed` | **Derived** — §2.3 |

### 2.2.1 Why `student_status` does not include `GRADUATED`

The `student_status` enum has **no** `GRADUATED`; its values are only `ACTIVE | ON_LEAVE`.

Rationale: the credential that proves graduation is the `TamgaDiplomaCredential`. Representing the same fact in two types
would be the in-schema form of Weakness 2 in [[PM-SCHEMA-0001]] (fragmentation of meaning) — the verifier would be left
asking "which one do I look at?".

It would also be structurally inconsistent: a person in the `GRADUATED` state **cannot refresh** the credential after 90 days,
because they are no longer a student of that institution. It would carry a permanent fact in a short-lived type.

If a graduate needs proof of "I studied at this institution" (they may have left without a diploma), that is a separate type —
`AttendanceCredential`, outside the pilot scope.

## 2.3 Derived field — `is_enrolled`

An application of the `age_over_NN` pattern in [[RS-SCHEMA-0001]] §4.

`is_enrolled = (student_status == "ACTIVE")`

**Why a separate claim:** a cinema offering a student discount does not need to know the university, the department or the
year of enrolment. All it needs is "is this a student right now?". Because it is a separate boolean claim, the student can
disclose **only that**; the other fields are never presented as [[t:disclosure|disclosures]].

This is the most concrete gain of [[t:selective-disclosure]] and the easiest thing to demonstrate when presenting the pilot.

## 2.4 JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.tamga.network/v1/edu/StudentCredential/1.0.0/schema.json",
  "title": "TamgaStudentCredential",
  "type": "object",
  "required": [
    "iss", "vct", "iat", "exp", "cnf",
    "family_name", "given_name", "birth_date",
    "awarding_body_name", "awarding_body_id", "awarding_body_country",
    "student_status", "enrollment_year", "study_level",
    "programme_title", "isced_f_code", "is_enrolled"
  ],
  "properties": {
    "iss":   { "type": "string", "format": "uri" },
    "vct":   { "const": "urn:tamga:edu:StudentCredential:1" },
    "iat":   { "type": "integer" },
    "exp":   { "type": "integer" },
    "cnf":   { "type": "object" },

    "family_name": { "type": "string", "minLength": 1, "maxLength": 200 },
    "given_name":  { "type": "string", "minLength": 1, "maxLength": 200 },
    "birth_date":  { "$ref": "../../../core/TamgaBaseCredential/1.0.0/schema.json#/$defs/DateOnly" },

    "awarding_body_name":    { "$ref": "../../../core/TamgaBaseCredential/1.0.0/schema.json#/$defs/LangString" },
    "awarding_body_id":      { "type": "string", "minLength": 1, "maxLength": 64 },
    "awarding_body_country": { "type": "string", "pattern": "^[A-Z]{2}$" },

    "student_status": { "enum": ["ACTIVE", "ON_LEAVE"] },
    "enrollment_year": { "type": "integer", "minimum": 1900, "maximum": 2200 },
    "study_level": { "type": "integer", "minimum": 5, "maximum": 8 },
    "programme_title": { "$ref": "../../../core/TamgaBaseCredential/1.0.0/schema.json#/$defs/LangString" },
    "isced_f_code": { "type": "string", "pattern": "^[0-9]{2,4}$" },
    "faculty_name": { "$ref": "../../../core/TamgaBaseCredential/1.0.0/schema.json#/$defs/LangString" },
    "expected_graduation_year": { "type": "integer", "minimum": 1900, "maximum": 2200 },

    "is_enrolled": { "type": "boolean" }
  },
  "additionalProperties": false
}
```

`additionalProperties: false` is deliberate. It prevents the issuer from adding fields that are not in the schema; if there
is a need, a MINOR version is released. Leaving it open would bring Weakness 2 of [[PM-SCHEMA-0001]] (fragmentation of
meaning) back through the back door.

## 2.5 Example content (before disclosure)

```json
{
  "iss": "https://issuer.tamga.network/example-university",
  "vct": "urn:tamga:edu:StudentCredential:1",
  "vct#integrity": "sha256-9Kf2rT8xQm1vB4nL7wZpYc3JdHs0EaXu6GiOoN5RbMk=",
  "iat": 1789000000,
  "exp": 1796776000,
  "cnf": { "jwk": { "kty": "EC", "crv": "P-256", "x": "...", "y": "..." } },

  "family_name": "Yılmaz",
  "given_name": "Ayşe",
  "birth_date": "2003-04-17",

  "awarding_body_name": {
    "tr-TR": "Örnek Üniversitesi",
    "en-US": "Example University"
  },
  "awarding_body_id": "TR-YOK-038",
  "awarding_body_country": "TR",

  "student_status": "ACTIVE",
  "enrollment_year": 2022,
  "study_level": 6,
  "programme_title": {
    "tr-TR": "Bilgisayar Mühendisliği",
    "en-US": "Computer Engineering"
  },
  "isced_f_code": "0613",
  "faculty_name": { "tr-TR": "Mühendislik ve Doğa Bilimleri Fakültesi" },
  "expected_graduation_year": 2026,

  "is_enrolled": true
}
```

In the cinema scenario the only disclosure the student presents is `is_enrolled`. All other fields remain as hashes in the
`_sd` array; the cinema does not even see `family_name`.

---

# 3. TamgaDiplomaCredential

## 3.1 Design decisions

| Topic | Decision | Rationale |
|---|---|---|
| Lifetime | **Unlimited** (no `exp`) | A diploma is permanent |
| Status list | **Used** | [[ADR-0008]] — revocation is a real need |
| Issuer assurance | **I2** minimum | [[PM-ASSUR-0001]] |
| Holder assurance | **T2** minimum recommended at issuance | [[SPEC-CRED-0001]] §3 |

**Why no `exp`:** a diploma has no expiry date. It does not need refreshing, and imposing a refresh obligation would make the
graduate dependent on the university for life.

**Why there is a status list:** revoking a diploma is rare but real — plagiarism detected, enrolment with a forged document, a
disciplinary decision. The difference from the student certificate is that a short lifetime cannot replace revocation.

## 3.2 Field table

| Claim | Type | Required | `sd` | ELM counterpart |
|---|---|---|---|---|
| `qualification_title` | LangString | ✓ | `allowed` | `Qualification.title` |
| `eqf_level` | integer | ✓ | `allowed` | `Qualification.EQFLevel` |
| `nqf_level` | string | — | `allowed` | `Qualification.NQFLevel` (Turkish Qualifications Framework, TYÇ) |
| `isced_f_code` | string | ✓ | `allowed` | `Qualification.ISCEDFCode` |
| `awarding_date` | DateOnly | ✓ | `allowed` | `AwardingProcess.awardingDate` |
| `awarding_body_name` | LangString | ✓ | `allowed` | `Organisation.legalName` |
| `mode_of_study` | enum | — | `allowed` | `LearningAchievement.mode` |
| `credit_points` | number | — | `allowed` | `LearningAchievement.creditReceived` (ECTS) |
| `grade` | string | — | **`always`** | `Assessment.grade` |
| `grading_scheme` | LangString | — | `allowed` | `Assessment.gradingScheme` |
| `thesis_title` | LangString | — | `always` | `LearningAchievement.title` |
| `is_graduate` | boolean | ✓ | `allowed` | **derived** |
| `graduated_before` | integer | — | `allowed` | **derived** |
| `status` | object | ✓ | `never` | — ([[ADR-0008]]) |

## 3.3 Why the grade (`grade`) is `sd: always`

This is the most important design decision of the schema.

An employer asks "did they graduate?"; in most cases it has no right to ask "with what grade?", and in practice no need.
Making the grade `sd: always` forces the issuer to make it **hideable through selective disclosure** — so the graduate can
present the diploma without showing the grade.

With a paper diploma this is impossible: you hand over the document and everything on it is visible. This is Tamga's concrete
advantage, and it does not happen unless it is enforced at schema level.

The same logic applies to `thesis_title`: a thesis title can carry information about a person's interests and sometimes their
political or religious views.

## 3.4 Derived fields

**`is_graduate`** — always `true`. The existence of the diploma implies graduation; but having a separate claim lets the
graduate disclose **only this**. When checking "do they have a diploma?", an employer sees `is_graduate` +
`awarding_body_name`; the programme, grade and date are never disclosed.

**`graduated_before`** — a year value, derived from the year of `awarding_date`. It proves seniority conditions such as
"graduated before 2020" without disclosing the exact graduation date. A direct application of the `age_over_NN` pattern.

The issuer **always** fills in this field; the thresholds at which it is produced are defined in `tamga.derived_claims`.

## 3.5 JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.tamga.network/v1/edu/DiplomaCredential/1.0.0/schema.json",
  "title": "TamgaDiplomaCredential",
  "type": "object",
  "required": [
    "iss", "vct", "iat", "cnf", "status",
    "family_name", "given_name", "birth_date",
    "awarding_body_name", "awarding_body_id", "awarding_body_country",
    "qualification_title", "eqf_level", "isced_f_code", "awarding_date",
    "is_graduate"
  ],
  "properties": {
    "iss": { "type": "string", "format": "uri" },
    "vct": { "const": "urn:tamga:edu:DiplomaCredential:1" },
    "iat": { "type": "integer" },
    "cnf": { "type": "object" },
    "status": {
      "type": "object",
      "required": ["status_list"],
      "properties": {
        "status_list": {
          "type": "object",
          "required": ["idx", "uri"],
          "properties": {
            "idx": { "type": "integer", "minimum": 0 },
            "uri": { "type": "string", "format": "uri" }
          }
        }
      }
    },

    "family_name": { "type": "string", "minLength": 1, "maxLength": 200 },
    "given_name":  { "type": "string", "minLength": 1, "maxLength": 200 },
    "birth_date":  { "$ref": "../../../core/TamgaBaseCredential/1.0.0/schema.json#/$defs/DateOnly" },

    "awarding_body_name":    { "$ref": "../../../core/TamgaBaseCredential/1.0.0/schema.json#/$defs/LangString" },
    "awarding_body_id":      { "type": "string", "minLength": 1, "maxLength": 64 },
    "awarding_body_country": { "type": "string", "pattern": "^[A-Z]{2}$" },

    "qualification_title": { "$ref": "../../../core/TamgaBaseCredential/1.0.0/schema.json#/$defs/LangString" },
    "eqf_level":  { "type": "integer", "minimum": 5, "maximum": 8 },
    "nqf_level":  { "type": "string", "maxLength": 16 },
    "isced_f_code": { "type": "string", "pattern": "^[0-9]{2,4}$" },
    "awarding_date": { "$ref": "../../../core/TamgaBaseCredential/1.0.0/schema.json#/$defs/DateOnly" },

    "mode_of_study": { "enum": ["FULL_TIME", "PART_TIME", "DISTANCE", "BLENDED"] },
    "credit_points": { "type": "number", "minimum": 0, "maximum": 1000 },
    "grade": { "type": "string", "maxLength": 32 },
    "grading_scheme": { "$ref": "../../../core/TamgaBaseCredential/1.0.0/schema.json#/$defs/LangString" },
    "thesis_title": { "$ref": "../../../core/TamgaBaseCredential/1.0.0/schema.json#/$defs/LangString" },

    "is_graduate": { "const": true },
    "graduated_before": { "type": "integer", "minimum": 1900, "maximum": 2200 }
  },
  "additionalProperties": false
}
```

## 3.6 Example content (before disclosure)

```json
{
  "iss": "https://issuer.tamga.network/example-university",
  "vct": "urn:tamga:edu:DiplomaCredential:1",
  "vct#integrity": "sha256-3Qm2pV7yLx0KcW9tRfBnEsA4ZhUgJd1MoI6TvXbCqNw=",
  "iat": 1789000000,
  "cnf": { "jwk": { "kty": "EC", "crv": "P-256", "x": "...", "y": "..." } },
  "status": {
    "status_list": {
      "idx": 48213,
      "uri": "https://status.tamga.network/7f3a9c21"
    }
  },

  "family_name": "Yılmaz",
  "given_name": "Ayşe",
  "birth_date": "2003-04-17",

  "awarding_body_name": {
    "tr-TR": "Örnek Üniversitesi",
    "en-US": "Example University"
  },
  "awarding_body_id": "TR-YOK-038",
  "awarding_body_country": "TR",

  "qualification_title": {
    "tr-TR": "Bilgisayar Mühendisliği Lisans Diploması",
    "en-US": "Bachelor of Science in Computer Engineering"
  },
  "eqf_level": 6,
  "nqf_level": "TYC-6",
  "isced_f_code": "0613",
  "awarding_date": "2026-06-30",

  "mode_of_study": "FULL_TIME",
  "credit_points": 240,
  "grade": "3.42",
  "grading_scheme": { "tr-TR": "4'lük sistem" },
  "thesis_title": { "tr-TR": "Federated Learning ile Gizlilik Korumalı Model Eğitimi" },

  "is_graduate": true,
  "graduated_before": 2027
}
```

## 3.7 The employer scenario — what is disclosed and what is not

Ayşe applies to an employer. The employer is looking for a bachelor's degree.

| Field | Disclosed | Why |
|---|---|---|
| `is_graduate` | ✓ | The question itself |
| `qualification_title` | ✓ | Which field |
| `eqf_level` | ✓ | Level — machine-readable |
| `isced_f_code` | ✓ | Field code — internationally recognised |
| `awarding_body_name` | ✓ | Which institution |
| `awarding_date` | ✓ | Seniority calculation |
| `family_name`, `given_name` | ✓ | The application is named anyway |
| `birth_date` | ✗ | Age discrimination surface |
| `grade` | ✗ | The employer does not need it |
| `thesis_title` | ✗ | Leaks views/interests |
| `credit_points`, `mode_of_study` | ✗ | Irrelevant |

In the presented SD-JWT only the first seven fields appear as disclosures. The rest remain as hashes inside `_sd`, and the
employer cannot even tell whether they exist — because the number of disclosures is not fixed, it is not clear which fields
were hidden either.

The verifier's authority to request these fields is additionally limited by the `RelyingPartyRegistry` scope
([[SPEC-BC-0001]] §4).

---

# 4. ELM mapping table (normative)

Mandatory under [[RS-SCHEMA-0001]] §9. Without this table the schema is one that "looks standards-aligned but is not".

## 4.1 DiplomaCredential ↔ ELM v3

| Tamga claim | ELM v3 path | OBv3 counterpart |
|---|---|---|
| `family_name` | `credentialSubject.familyName` | `credentialSubject.identifier` |
| `given_name` | `credentialSubject.givenName` | — |
| `birth_date` | `credentialSubject.dateOfBirth` | — |
| `qualification_title` | `hasClaim.specifiedBy.title` | `achievement.name` |
| `eqf_level` | `hasClaim.specifiedBy.EQFLevel` | `achievement.alignment[].targetCode` |
| `nqf_level` | `hasClaim.specifiedBy.NQFLevel` | — |
| `isced_f_code` | `hasClaim.specifiedBy.ISCEDFCode` | `achievement.alignment[].targetCode` |
| `awarding_date` | `hasClaim.awardedBy.awardingDate` | `issuanceDate` |
| `awarding_body_name` | `hasClaim.awardedBy.awardingBody.legalName` | `issuer.name` |
| `awarding_body_id` | `hasClaim.awardedBy.awardingBody.identifier` | `issuer.id` |
| `credit_points` | `hasClaim.creditReceived.point` | `achievement.creditsAvailable` |
| `mode_of_study` | `hasClaim.mode` | — |
| `grade` | `hasClaim.provenBy.grade` | `result[].value` |
| `grading_scheme` | `hasClaim.provenBy.gradingScheme` | `resultDescription` |
| `thesis_title` | `hasClaim.title` | `achievement.description` |
| `is_graduate` | *(derived — no ELM counterpart)* | — |
| `graduated_before` | *(derived — no ELM counterpart)* | — |

## 4.2 Checking the flattening rule

The "do not go deeper than two levels" rule of [[RS-SCHEMA-0001]] §9 holds in this schema: `hasClaim.awardedBy.awardingBody.legalName`,
four levels deep in ELM, is the single-level `awarding_body_name` claim in Tamga.

## 4.3 Export

The `mapping.json` file ([[SPEC-SCHEMA-0001]] §1.3) carries this table in machine-readable form. A Tamga diploma is exported
to the EDC (Europass) with this file.

**Loss warning:** the derived claims (`is_graduate`, `graduated_before`) have no ELM counterpart; they are dropped on export.
This is not a bug but expected behaviour — the derived claims belong to Tamga's privacy layer.

---

# 5. Type definitions (Type Metadata)

## 5.1 StudentCredential

```json
{
  "vct": "urn:tamga:edu:StudentCredential:1",
  "name": "Tamga Student Credential",
  "description": "Proves student status at a higher-education institution.",
  "extends": "urn:tamga:core:TamgaBaseCredential:1",
  "extends#integrity": "sha256-Yr9kL2mQ...",
  "schema_uri": "https://schemas.tamga.network/v1/edu/StudentCredential/1.0.0/schema.json",
  "schema_uri#integrity": "sha256-Bn7xW4pT...",
  "display": [
    { "lang": "tr-TR", "name": "Öğrenci Belgesi", "description": "Öğrencilik durumu" },
    { "lang": "en-US", "name": "Student Certificate", "description": "Proof of enrolment" }
  ],
  "claims": [
    { "path": ["birth_date"],    "sd": "always" },
    { "path": ["family_name"],   "sd": "always" },
    { "path": ["given_name"],    "sd": "always" },
    { "path": ["is_enrolled"],   "sd": "allowed",
      "display": [{ "lang": "tr-TR", "label": "Aktif öğrenci" }] },
    { "path": ["programme_title"], "sd": "allowed",
      "display": [{ "lang": "tr-TR", "label": "Program" }] }
  ],
  "tamga": {
    "tier": "NETWORK",
    "issuer_categories": ["EDUCATION"],
    "default_ttl_days": 90,
    "uses_status_list": false,
    "min_issuer_assurance": "I2",
    "derived_claims": ["is_enrolled"],
    "elm_profile": "ELM-3.3/LearningAchievement",
    "status": "ACTIVE"
  }
}
```

## 5.2 DiplomaCredential

```json
{
  "vct": "urn:tamga:edu:DiplomaCredential:1",
  "name": "Tamga Diploma Credential",
  "description": "A graduation credential issued by a higher-education institution.",
  "extends": "urn:tamga:core:TamgaBaseCredential:1",
  "extends#integrity": "sha256-Yr9kL2mQ...",
  "schema_uri": "https://schemas.tamga.network/v1/edu/DiplomaCredential/1.0.0/schema.json",
  "schema_uri#integrity": "sha256-3Qm2pV7y...",
  "display": [
    { "lang": "tr-TR", "name": "Diploma", "description": "Yükseköğretim mezuniyet belgesi" },
    { "lang": "en-US", "name": "Diploma", "description": "Higher education degree" }
  ],
  "claims": [
    { "path": ["birth_date"],   "sd": "always" },
    { "path": ["grade"],        "sd": "always",
      "display": [{ "lang": "tr-TR", "label": "Not ortalaması" }] },
    { "path": ["thesis_title"], "sd": "always" },
    { "path": ["is_graduate"],  "sd": "allowed",
      "display": [{ "lang": "tr-TR", "label": "Mezun" }] },
    { "path": ["eqf_level"],    "sd": "allowed",
      "display": [{ "lang": "tr-TR", "label": "Yeterlilik seviyesi (EQF)" }] },
    { "path": ["status"],       "sd": "never" }
  ],
  "tamga": {
    "tier": "NETWORK",
    "issuer_categories": ["EDUCATION"],
    "default_ttl_days": null,
    "uses_status_list": true,
    "min_issuer_assurance": "I2",
    "derived_claims": ["is_graduate", "graduated_before"],
    "elm_profile": "ELM-3.3/Qualification",
    "status": "ACTIVE"
  }
}
```

---

# 6. SIS integration mapping

The pilot's most fragile point is pulling data from the university's student information system. This section defines the
minimum field set the issuing service ([[ARCH-0003]]) needs.

## 6.1 SIS fields needed for the StudentCredential

| Tamga claim | Typical SIS field | Note |
|---|---|---|
| `family_name`, `given_name` | Student family name/given name | — |
| `birth_date` | Date of birth | — |
| `student_status` | Enrolment status | The SIS enum must be mapped to `ACTIVE`/`ON_LEAVE` |
| `enrollment_year` | Year of enrolment | Can be derived from the student number |
| `study_level` | Programme type → EQF | §6.3 mapping |
| `programme_title` | Programme name | The English name is needed too |
| `isced_f_code` | — | Not in the SIS; derived from the national YÖK table — §6.4 |
| `faculty_name` | Faculty | — |

## 6.2 Additional fields for the DiplomaCredential

`qualification_title`, `awarding_date` (date of the graduation decision), `credit_points` (total ECTS), `grade` (graduation
average), `grading_scheme`, `thesis_title` (if any).

## 6.3 Programme type → EQF mapping (Türkiye)

| Programme | EQF | TYÇ |
|---|---|---|
| Associate degree (ön lisans) | 5 | TYC-5 |
| Bachelor's (lisans) | 6 | TYC-6 |
| Master's (yüksek lisans) | 7 | TYC-7 |
| Doctorate (doktora) | 8 | TYC-8 |

## 6.4 The ISCED-F code — inheriting the national classification

The ISCED-F code is usually **not** a field in universities' SIS. But that does not mean the code cannot be produced —
because in Türkiye the mapping work **has already been done at national level.**

### 6.4.1 The existing national source

In 2020 the Council of Higher Education (YÖK) merged all active, passive and closed associate and bachelor's programmes with
similar content or similar names under single names, according to scientific criteria with reference to the ISCED-F 2013
classification. 17 working commissions with 120 academics from 55 universities took part, and the number of programmes fell
from about 2,230 to 679. YÖK's international unit also published a document containing the ISCED-F 2013 classification of
bachelor's programmes.

**Consequence:** the work item is not "every university produces its own table" but **"the national table is imported and
verified once"**. 200 universities do not do the same work 200 times.

### 6.4.2 Implementation

The mapping table is kept in the `@tamga-network/schemas` package as a **versioned network asset** ([[ARCH-0005]]):

```
tr/isced-f-2013-programs.json   # YÖK programme name → ISCED-F code
```

The issuing service maps the programme name coming from the SIS through this table. For a programme not in the table,
issuance **stops** and goes to an operator — it does not silently produce an empty or guessed code.

An institution-specific exception (a new programme not in the table) is defined in an `overrides` file, which is versioned
too.

### 6.4.3 The real risk: a wrong code

**A wrong code is dangerous, not a missing one.** A diploma is a signed, immutable credential that lives for forty years. The
only way to correct a wrong ISCED-F code is to revoke and re-issue the credential; a correction like on a paper diploma is
not possible.

Mitigation:

1. **The table is a network asset**, not improvised per university (§6.4.2).
2. **Two-stage approval:** the university's student affairs office **and** a Tamga reviewer approve the table before the
   first issuance.
3. **Graded code precision** (§6.4.4) — a more general code where there is doubt.
4. **Sample audit:** code correctness is sampled by hand in the first 100 credentials.

### 6.4.4 Code levels — why 2–4 digits

ISCED-F 2013 has three levels: **2 digits** broad field (10), **3 digits** narrow field (29), **4 digits** detailed field
(80).

The pattern is **`^[0-9]{2,4}$`**; the most detailed level (`^[0-9]{4}$`) is not mandatory.

Rationale: the probability of error is markedly higher at the detailed level, and under §6.4.3 the cost of an error is
permanent. For a programme it is unsure about, the university may give a 3-digit narrow-field code; an employer in Kazakhstan
still gets a usable signal (at the level of "engineering and engineering trades"). For programmes it is sure about, 4 digits
are used.

There is a loss of precision; it is cheaper than the risk of a wrong code.

**Making the field fully optional was rejected** — ISCED-F carries international recognisability ([[SPEC-SCHEMA-0001]]
§8.3). If the field were dropped, the diploma would turn into a text that cannot be read across borders.

### 6.4.5 Pilot work item

→ PM-GTM-0001: *"Importing YÖK's ISCED-F 2013 programme classification, confirming it is current and comparing it with the
pilot university's programme list."*

**Confirmation note:** the source dates from 2020 and may have been updated since. It must be checked against YÖK's current
publication before the pilot.

---

# 7. Invariants

| # | Invariant |
|---|---|
| **E1** | The national identity number does not appear in these two NETWORK schemas (§1.2). |
| **E2** | `grade` and `thesis_title` are always `sd: always` (§3.3). |
| **E3** | `is_graduate` is constant `true`; a diploma with `false` is meaningless. |
| **E4** | The `StudentCredential` carries `exp`; the `DiplomaCredential` does not. |
| **E5** | The `DiplomaCredential` carries `status`; the `StudentCredential` does not. |
| **E6** | `additionalProperties: false` in both schemas. |
| **E7** | `isced_f_code` is mandatory in both schemas; it may have 2, 3 or 4 digits. |
| **E8** | Every `LangString` field contains at least the institution's official language. |
| **E9** | `StudentCredential.exp - iat` ≤ 90 days (ceiling, §2.1.2). |
| **E10** | No NETWORK education schema contains a national identity number field (§1.2). |
| **E11** | For a programme with no counterpart in the mapping table, issuance stops; no guessed code is produced (§6.4.2). |

---

# Security and privacy notes

**The number of disclosures is a side channel.** From the number of disclosures presented, the verifier can infer "how many
fields were hidden". On its own this is harmless, but comparing two presentations can produce correlation. Mitigation: the
wallet must use a consistent disclosure set for repeated presentations to the same verifier.

**Status index correlation.** `status.status_list.idx` is visible in every presentation (`sd: never`) and is fixed. A graduate
who presents the same diploma to two different verifiers can be linked if those two verifiers collude. This is a known SD-JWT
limitation; its solution is batch issuance ([[SPEC-CRED-0001]] §5, expansion stage). **It is an accepted risk in the pilot and must
be communicated clearly to the pilot participants.**

**The status list can leak hidden claims.** Because the `status` block is `sd: never`, both the `idx` and the **list URI** are
visible in every presentation. If the list URI or the criterion by which lists are split carries cohort information, it leaks
`awarding_date` or `programme_title` even when they are hidden.

A concrete example: a URI of the form `.../statuslist/edu-2026-a` gives away the graduation year directly — even if the
graduate has not disclosed `awarding_date`.

That is why [[SPEC-CRED-0003]] §6.3 and §6.4 make two rules **normative**: the list URI is opaque, and lists are not split by
year/department/cohort. The examples in this document (§3.6) follow that rule.

**Why `birth_date` is `sd: always`.** A date of birth combined with a name is very likely a unique identifier. Being
mandatorily hideable guarantees that the graduate can choose not to give it.

---

# Open questions

1. Does the `student_status` enum cover the education systems of all member states? (Does every country have an equivalent of
   `ON_LEAVE`?)
2. When will the `AttendanceCredential` (for people who left without a diploma) be written? Outside the pilot, but demand may
   come.
3. How is a double major / minor diploma represented — two separate credentials, or an array in one credential? Proposal:
   **two separate credentials** (simplicity). Awaiting decision.
4. The relation between a foreign graduate's `awarding_body_country` and nationality — there is no nationality field in the
   schema, deliberately. If needed for recognition, it goes into a NATIONAL schema.
5. Who maintains the ISCED-F mapping table? Proposal: a shared table in the `@tamga-network/schemas` package + per-institution
   overrides.

---

# Related documents

[[SPEC-SCHEMA-0001]] · [[RS-SCHEMA-0001]] · [[ADR-0007]] · [[ADR-0008]] ·
[[SPEC-CRED-0001]] · [[SPEC-CRED-0002]] · [[SPEC-BC-0001]] · [[PM-ASSUR-0001]] ·
PM-GTM-0001 · [[ARCH-0003]]

---

# Status

**In force** — version 1.0.0 (2026-10-02).
