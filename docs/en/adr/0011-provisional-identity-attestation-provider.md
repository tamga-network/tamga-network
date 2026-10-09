---
document_id: ADR-0011
title: "Provisional identity attestation provider"
status: Active
version: 1.0.0
created: 2026-09-25
last_updated: 2026-10-09
summary: >
  As long as there is no PID Provider appointed by the state, Tamga issues an identity attestation it signs itself
  (urn:tamga:id:IdentityAttestation:1) to people it has verified by remote identity verification (Didit: document +
  liveness + face match; later NFC chip reading). This is not a PID but an EAA issued by Tamga as an issuer; it is
  superseded when a state PID arrives. Institutions (universities) take this attestation as a presentation when issuing
  documents and match it against their own records. The identity proofing integration lives in Tamga's identity service,
  not at the university; Tamga becomes the data controller for this data under the Turkish data protection law (KVKK). TL8
  is kept (pid_providers[] empty), IDP3 is reworded.
domain: Identity
translation_of: ADR-0011
source_version: 1.0.0
---

# ADR-0011 — Tamga provisional identity attestation provider

**Status:** **Accepted (2026-09-25).** Open points decided: (1) the national ID number (TCKN) is carried in the attestation,
with selective disclosure; (2) validity 2 years; (3) NFC is not a separate type but `document_chip_verified` in the same
type; (4) the KVKK privacy notice + explicit consent are shown on the identity service's `/authorize` page. DECISIONS §0
**D-ID-6**; SPEC-PROTO-0001, SPEC-ID-0003, SPEC-TRUST-0001 and FW-TF-0001/FW-RB-0001 updated in the same session.
Implementation: `apps/id` (operator repository), `@tamga-network/wallet-core` authcode/directory, `@tamga-network/issuer` authcode,
wallet screens; tests 11/11 + scene 2b over real HTTP.

# Context

In Türkiye and the member states of the Organization of Turkic States there is no **[[t:PID]] Provider** appointed in the
[[t:eIDAS]] sense (the state body that gives identity data to the wallet). The current design (D-ID-2, SPEC-ID-0003/IDP3)
does [[t:identity-proofing]] **at each institution's own [[t:issuer]]**: the student logs into a portal, and Didit runs
there if needed. This depends on institutional integration (student information system/portal), and the person is
verified again at every institution. Direction from project management (2026-09-25): until the state appoints a provider,
**Tamga** performs identity verification; the person goes to an institution with the identity document in their wallet,
the institution matches it with its record and issues the document. The student-system QR and e-mail routes remain as
options.

This is the [[t:ARF]] pattern of **issuing an [[t:EAA]] on presentation of a PID** (an EAA Provider verifies the PID and
matches it with its own record); the only difference is that the PID is provided temporarily by Tamga rather than the
state.

# Decision

## K1 — Role: "Provisional Identity Attestation Provider", not a PID Provider
- Tamga operates an **identity attestation service** at `id.tamga.network`; in the trust list under `issuers[]`
  (`category: IDENTITY`, `class: QUALIFIED` → **`class: EAA`, `assurance: I2`** by [[ADR-0022]], 2026-09-29;
  `assurance_basis: "provisional-operator; ETSI TS 119 461 Substantial (remote) / High (NFC)"`,
  `operator.status: provisional`).
- `pid_providers[]` **stays empty** (TL8 kept): when a state PID arrives, the Tamga attestation is superseded (`successor`
  field), and institutions' matching code does not change (same claim set).
- In legal texts the document is called **"Tamga Identity Attestation (provisional)"**; it is not called "PID" or "identity
  card". The product name (e.g. "Tamga Wallet") is free at marketing level.

## K2 — Credential type `urn:tamga:id:IdentityAttestation:1`
The claim set is derived from the EU PID Rulebook (CIR 2024/2977), reduced:

| Claim | Mandatory | Selective disclosure | Note |
|---|---|---|---|
| `given_name`, `family_name` | ✓ | ✓ | from the document (MRZ/OCR; chip if NFC) |
| `birthdate` | ✓ | ✓ | (2026-10-09, [[ADR-0045]]: formerly `birth_date`; `birth_date` in mdoc) |
| `nationalities` | ✓ | ✓ | array of ISO 3166-1 alpha-2 codes (2026-10-09, [[ADR-0045]]: formerly the single-valued `nationality`) |
| `personal_administrative_number` | ✓ | ✓ | **TCKN** (TR) / national ID number — for institutional matching; disclosed only to RPs with a registered scope |
| `document_type`, `document_number` (hash) | ✓ | ✓ | document number only as SHA-256 |
| `issuing_country` | ✓ | ✓ | |
| `document_chip_verified` | ✓ | ✓ | `true` if verified via NFC (a fact; not a LoA — PR7 kept) |
| `age_over_18` | ○ | ✓ | derived |
| `iat`, `exp` (≤ 2 years), `status` | ✓ | — | revocation: Token Status List |

No photo/portrait (v1). There is no holder assurance level as a claim; the type's precondition is **T2** (remote) or
**T3-like** (NFC + liveness; legally T3 = qualified/mobile signature, PM-ASSUR). `document_chip_verified` carries this as a
fact.

## K3 — Identity proofing flow (wallet-initiated)
1. Wallet → `id.tamga.network` ([[t:OpenID4VCI]] **authorization code**; SPEC-PROTO-0001): the authorisation page opens a
   Didit session (document + passive liveness + face match; NFC optional).
2. Didit decision (polling `GET /v3/session/{id}/decision/` primary; webhook `https://id.tamga.network/idv/webhook`
   secondary, `status.updated`) → if **Approved**, the attestation is issued (10 copies, [[t:WUA]] mandatory, PR11).
3. Getting a document from an institution: the wallet picks the institution from the trust list directory → the
   institution's issuer requests an **IdentityAttestation presentation** in the authorization code flow ([[t:OpenID4VP]],
   [[t:DCQL]]: `personal_administrative_number`, `given_name`, `family_name`, `birthdate`) → matches it with the record →
   issues the document. If there is no match, no document is issued; no personal data is logged (AP3/AP4).
4. The pre-authorised routes (student-system screen QR, e-mail + SMS tx_code) **stay as they are**; an institution may offer
   both.

## K4 — Data controllership and retention (KVKK)
- Tamga is the **data controller** for identity proofing data; the privacy notice + explicit consent text is shown in the
  wallet before handing over to Didit.
- Stored at Tamga: the attestation record (opaque `subject_ref`, `iat/exp`, status `idx`, hash of the document number,
  `document_chip_verified`, Didit `session_id`); **document images, selfies and raw MRZ data are not stored at Tamga**
  (they follow Didit's retention policy; ≤ 30 days requested in the contract). Erasure request: revoke the attestation +
  delete the record.
- The role "Identity Attestation Provider" and its responsibilities are added to FW-TF-0001 §6; issuance/revocation counts
  enter the quarterly transparency report (no persons).
- The earlier statement "Tamga sees no personal data" is narrowed: **Tamga sees identity proofing data; it does not see the
  content of education/sector documents** (issuers belong to the institutions, G1).

## K5 — Affected rules (reworded)
| Rule | Before | After |
|---|---|---|
| SPEC-ID-0003/**IDP3** | IDV integration only on the issuer side | IDV integration only in **the Tamga identity attestation service**; institutional issuers, the wallet and verifiers do not talk to the IDV provider |
| SPEC-TRUST-0001/**TL8** | Tamga does not issue PIDs; `pid_providers[]` empty | Unchanged; plus: the Tamga identity attestation is an `issuers[]` entry and is superseded when a state PID arrives |
| SPEC-SCHEMA-0002 E series ("no identity number") | for education schemas | Unchanged; the identity number exists **only** in the `IdentityAttestation` type, with selective disclosure |
| SPEC-PROTO-0001 | pre-authorised only | + authorization code; new PR rule: identity matching when getting a document from an institution is done by an IdentityAttestation presentation |
| PM-ASSUR-0001 binding table | remote verification = at the institution | remote verification = Tamga attestation; the institution counts "attestation presentation + record match" as T2 |

## K6 — Security limits
- WUA mandatory at attestation issuance; `software` accepted in the demo (S-9/S-14), `secure_enclave` in the pilot.
- No second active attestation is issued for the same document-number hash (duplicate enrolment); re-issuance revokes the
  old one.
- Institutional matching: at least `personal_administrative_number` + `birthdate`; name matching normalised (Turkish
  characters).
- Didit "In Review" → no attestation, the user waits; "Declined" → retry after 24 hours; 3 rejections → manual handling.

# Rationale
A person is verified once and goes to every institution with the same attestation; institutions can work without a student
information system integration; the ARF pattern (issuing an EAA on presentation of a PID) is applied one-to-one, and when a
state PID arrives only the signer changes. The price: Tamga becomes a data controller and a type carrying an identity
number exists; both are limited in K4/K2.

# Alternatives considered
- **A — Identity proofing at each institution's issuer (IDP3 as before):** Tamga sees no data, but institutional
  integration is required and the person goes through KYC again at every institution (the 500/month quota multiplies with
  the number of institutions). **Rejected (2026-09-25).**
- **C — Wait for the state PID:** no date. The migration path is kept in K1.
- **B' — Attestation without TCKN (name + date of birth):** ambiguous matching (namesakes), more institutional
  rejections. Rejected; TCKN with selective disclosure, and only for authorised scopes.

# Consequences
- New service `apps/id` (operator repository) (`id.tamga.network`): Didit session, decision, webhook, OpenID4VCI issuer
  (authorization code), attestation record, status list. A **single** Didit webhook target:
  `https://id.tamga.network/idv/webhook` (not one per institution).
- Wallet: a "Verify my identity" flow (in-app browser), an institution directory (from the trust list), attestation
  presentation when getting a document from an institution (OpenID4VP within issuance).
- Institutional issuer: authorization code + IdentityAttestation request + record matching; the portal's student login
  **is removed** (the staff panel remains in the demo).
- Specification/framework updates per K5; DB-21 becomes part of this ADR; DB-22 is closed.
- Demo: Didit **sandbox** (no real identity, GT1); presentation scene 3 "portal login" → "verify my identity in the wallet +
  choose the university".

# Open points — DECIDED on acceptance (2026-09-25)
1. Should `personal_administrative_number` (TCKN) be carried in the attestation? (Proposal: yes, with selective
   disclosure; K2.)
2. Attestation validity: 1 year or 2 years? (Proposal: 2 years; earlier if the document expires.)
3. When NFC is added: not a separate type (`…:IdentityAttestation:1` + `document_chip_verified`) but the same type —
   confirmed.
4. In the demo a fake TCKN is generated for the sandbox profile; `students.json` is updated accordingly.
