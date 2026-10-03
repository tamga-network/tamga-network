---
document_id: ADR-0028
title: "Health credentials"
status: Proposed
version: 1.0.0
created: 2026-09-29
last_updated: 2026-10-02
summary: >
  Three complementary credentials for health professionals:
  (1) practice licence — authentic source the Ministry of Health; a test institution in the pilot;
  (2) professional chamber membership — Turkish Medical Association / provincial medical chambers;
  (3) staff appointment — a hospital or clinic issues it to its own staff with unit, title and start date.
  Another institution requests them as a verifier when hiring (a verified CV). The credentials carry no health data and no
  national ID number. The patient side (EU Health ID, e-prescription) is out of scope, for later. Type names are proposals.
domain: Credentials
translation_of: ADR-0028
source_version: 1.0.0
---

# Context

Project management chose universities and health as the first sectors. In health the first goal is to give credentials to
physicians and health staff; institutions act as [[t:issuer]]s, other institutions as [[t:verifier]]s.

Around the world a physician's authority is proven not by one document but by **several, each issued by the owner of that
piece of information**:

| Country / region | Method |
|---|---|
| EU | Licence from a national authority; diplomas recognised automatically (2005/36/EC); a barred physician is reported through the IMI alert system |
| USA | State licence + NPI + board certification; the hiring hospital verifies at the primary source ("credentialing"), then grants clinical privileges ("privileging") |
| United Kingdom | GMC registration; the NHS's verifiable "Digital Staff Passport" carried pre-employment checks between employers (closed in 2025; the model continues) |

A physician credential is **not yet defined** for the [[t:EUDI-Wallet]]. The EHDS (Regulation 2025/327) empowers the Commission
to adopt implementing acts for authenticating health professionals. The only defined health use of the EU wallet is the
patient-side e-prescription "Health ID" ([[t:mdoc]]; the prescription itself does not go into the wallet).

[[t:authentic-source]]s in Türkiye:

| Information | Authentic source |
|---|---|
| Right to practise, specialty | Ministry of Health |
| Chamber membership | Turkish Medical Association / provincial medical chambers (professional bodies with public-institution status) |
| Employment, unit, title | The employing health institution |

Under [[ADR-0020]] each credential reads its information from its own source; Tamga does not store it.

# Proposed decision

## K1 — Three credentials, three sources

| # | Credential | Issuer | Trust list class | Type name (PROPOSAL, §6) |
|---|---|---|---|---|
| 1 | **Practice licence** | Ministry of Health. In the pilot a test institution "Ministry of Health (test)"; in real participation the same type with the real record | `PUB` / `HEALTH` | `urn:tamga:health:PractitionerLicence:1` |
| 2 | **Chamber membership** | Turkish Medical Association or a provincial chamber, to its own members | `PUB` (public-institution status) or `EAA` / `HEALTH` | `urn:tamga:health:ProfessionalMembership:1` |
| 3 | **Staff appointment** | Hospital / clinic / health group, to its own staff | `EAA` / `HEALTH` | `urn:tamga:work:EmploymentCredential:1` (sector-neutral) |

None is issued by Tamga; Tamga operates the hosted issuance service.

## K2 — Fields (proposal)

**Practice licence:**
- `family_name`, `given_name`,
- `profession`: ISCO-08 code + name; e.g. 2211 physician, 2261 dentist, 2262 pharmacist, 2221 nurse,
- `specialty` (if any; the ministry's list of specialties),
- `registration_number` (professional registration number; with [[t:selective-disclosure]]),
- `licence_status` (`ACTIVE` | `RESTRICTED`),
- `authority_name`, `issued_date`.

**Chamber membership:**
- `family_name`, `given_name`, `profession`,
- `chamber_name`,
- `membership_number` (selective disclosure),
- `membership_status`, `member_since`.

**Staff appointment (sector-neutral):**
- `family_name`, `given_name`,
- `employer_name`, `employer_id` (from the [[t:trust-list]] identifier),
- `job_title`, `department`, `start_date`, `end_date` (on leaving),
- `employment_type` (`FULL_TIME` | `PART_TIME` | `CONSULTANT` …).
- Optional in health: `clinical_privileges` (the equivalent of US "privileging").

**None of them carries:** national ID number (IDP10), address, salary, health data.

## K3 — Lifecycle

- All three carry **revocation and suspension** (Token Status List, 2 bits). The equivalent of the EU IMI alert is the ministry
  suspending or revoking the practice licence. The verifier sees this immediately.
- **On leaving, the staff appointment** is either revoked or reissued with `end_date`. The latter is recommended: it remains as
  proof of employment history.
- Automatic copy refresh ([[ADR-0023]]) is enabled for all three.

## K4 — Verifier: hiring and assignment

- The institution hiring or assigning a physician registers in the trust list as a verifier: intended use "Hiring and assignment
  verification"; the requested fields come from the three credentials.
- The physician sends all three with a single consent. This works like a verified CV; the hospital does not re-check everything
  from scratch.
- The [[t:registration-certificate]] ([[ADR-0026]]) shows that the verifier is registered for this purpose.

## K5 — Disclosure policy (EDP)

- An optional embedded disclosure policy for the practice licence (ETSI TS 119 472-3 §4.2.5): "only to verifiers whose
  registration certificate carries a healthcare-provider entitlement".
- The wallet warns on a non-matching request; the person still decides (ARF EDP_07).
- ETSI does not define concrete JSON names, so the Tamga profile is fixed on acceptance.

## K6 — Out of scope (later)

- The patient Health ID (EU e-prescription pilot, mdoc) and the e-Nabız / e-Reçete link: only if the Ministry of Health joins as
  an issuer.
- No credential is issued for the health institution itself: the institution is recognised by its trust list record and its
  registration certificate ([[ADR-0024]], [[ADR-0026]]).

# Rationale / alternatives

| Option | Result | Why |
|---|---|---|
| One "physician credential" (licence + chamber + employer together) | rejected | The information sits with different sources; when one changes (employer) everything must be reissued; no single institution owns it all |
| Tamga issuing the physician credential | rejected | The authentic source is the institution ([[ADR-0020]]) |
| Making the staff appointment health-specific | not proposed | Universities and companies have the same need; a sector-neutral type is reused |
| **Three credentials, each from its own source; the hiring institution as verifier** | **proposal** | Matches practice worldwide; fits the EU model |

# Proposed rules (moved to the binding table if accepted)

| Code | Rule |
|---|---|
| HC1 | Health credentials carry no health data (diagnosis, prescription, test result, treatment) and no national ID number. |
| HC2 | The practice licence is issued only by an institution authorised for this type in the trust list; Tamga does not issue it. |
| HC3 | Health credentials carry revocation and suspension status; a suspended credential is invalid in verification. |

# Open questions (project management)

1. **Type names:** the proposals in §K1 or the alternatives — `MedicalLicence`, `ChamberMembership` (all professional chambers),
   `StaffAppointment` (health-specific appointment).
2. The class of the chamber credential: `PUB` or `EAA`?
3. Pilot set-up: "Ministry of Health (test)", a medical chamber, a private hospital — test tenants.

# Status

**Proposed — 2026-09-30.** Set-up and issuing institutions written on project management's guidance; type names pending decision.
