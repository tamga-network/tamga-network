---
document_id: SPEC-SCHEMA-0003
title: "Sector schemas"
status: Active
version: 1.0.0
created: 2026-09-09
last_updated: 2026-10-02
summary: >
  Defines the schema skeletons of the verticals beyond education and the CONDITIONS FOR OPENING a sector. The central thesis:
  the approach that works in education cannot be copied to other sectors as it is — in health a wrong selective disclosure
  decision causes irreversible harm, for driving licences even the format differs (mdoc, not SD-JWT), and for legal entities
  the subject is not a human. The document therefore first sets a SECTOR OPENING CHECKLIST (seven conditions), then gives the
  skeletons of five verticals. In the initial stage only the `org` skeleton is written; health, driving licence, travel and trade are
  left to later stages, and this document records their early decisions without writing their schemas.
translation_of: SPEC-SCHEMA-0003
source_version: 1.0.0
---

# In brief

This document gathers the early decisions that must be taken before the sectors beyond education (legal entities, health,
driving licences, travel, trade) are opened, and the conditions for opening a sector. It is written for institutions that want
to propose a new credential type and for schema authors.

**When to read**

- First read the [Credential formats](/concepts/credential-formats) concept page and the schema catalogue
  ([[SPEC-SCHEMA-0001]]).
- For a fully written example, see the education schemas: [[SPEC-SCHEMA-0002]].
- When proposing a new sector, start with the checklist in §1.

**Plain explanation**

This document is a skeleton: it does not write schemas. Every sector has its own risks; health data is far more sensitive
than a diploma, a driving licence is carried in a different format (mdoc), and trade documents can change hands. So that the
decisions taken in education are not copied to these sectors as they are, the reference standard, the restrictive early
decisions and the opening condition of each sector are written down now. Today only the legal-entity skeleton applies.

---

# Scope

This document is a **skeleton.** The education schemas are written in full in [[SPEC-SCHEMA-0002]]; the ones here are not
written — the early decisions, reference standards and opening conditions are recorded.

**Why it is written now:** when these verticals open tomorrow, the decisions taken today in education must **not be
copied** to them. Writing down what must not be copied now is cheaper than fixing it later.

---

# 1. Sector opening checklist (normative)

Before a new `domain` ([[SPEC-SCHEMA-0001]] §1.2) is opened, **all seven conditions** must be met. If any one is missing, the
domain is not opened.

> The `SG*` codes are **opening conditions**, not invariants; but because they appear in the [[INVARIANTS]] index they are
> named uniquely.

| # | Condition | Why |
|---|---|---|
| **SG1** | An international reference model has been chosen and justified by research such as [[RS-SCHEMA-0001]] | Inventing from scratch kills recognisability |
| **SG2** | The carrier format has been decided (SD-JWT VC / mdoc / mixed) | If the format changes later, the whole schema is rewritten |
| **SG3** | A set of derived boolean claims has been defined | The `age_over_NN` pattern cannot be added later ([[RS-SCHEMA-0001]] §4) |
| **SG4** | The selective disclosure policy (fields that will be `sd: always`) has been set | A wrong `never` requires `REVOKED` + re-issuance |
| **SG5** | TTL and status list use have been decided | [[SPEC-CRED-0003]] Alt. C — short lifetime or revocation |
| **SG6** | The minimum issuer category and assurance level have been set | Prevents category overreach ([[ADR-0007]] K6) |
| **SG7** | A sector-specific legal review has been done | Health, finance and identity data are subject to additional legislation |

**Invariant SK1:** while any of the seven conditions is missing, no domain is opened at the NETWORK layer. For NATIONAL
schemas the same list applies, under that state's own governance.

## 1.1 Risk asymmetry

Sectors are not equal. The cost of a mistake:

| Sector | Example of a wrong decision | Cost |
|---|---|---|
| Education | Grade set to `allowed` | Annoying, fixable |
| Legal entity | Too broad an authority scope | Financial loss, can be limited by contract |
| **Health** | Diagnosis field set to `sd: never` | **Irreversible** — disclosure of health data |
| Driving licence/identity | Portrait field disclosed unnecessarily | Biometric disclosure, permanent |
| Trade | Wrong party identification | Legal dispute |

**Consequence:** the checklist (§1) hardens per sector. In health, SG4 and SG7 require an independent expert review; in
education an internal review is enough.

---

# 2. `org` — Legal entity and authority (initial-stage skeleton)

The **only** additional vertical to be written in the initial stage.

## 2.1 Reference model: GLEIF vLEI

Following [[RS-SCHEMA-0001]] §6, the three layers of vLEI are inherited:

| vLEI layer | Tamga schema | What it proves |
|---|---|---|
| Legal Entity vLEI | `TamgaLegalEntityCredential` | "This legal entity exists and is this one" |
| **OOR** (Official Organizational Role) | `TamgaOfficialRoleCredential` | "This person is an official representative" (signing authority) |
| **ECR** (Engagement Context Role) | `TamgaContextRoleCredential` | "This person is authorised in this context" (procurement manager) |

## 2.2 Why this trio is right

Writing a single "employee card" schema is tempting but wrong. There are three different questions:

- *Is this company real?* → LE
- *Can this person bind the company?* → OOR
- *Can this person do this job?* → ECR

A logistics company's driver is an ECR; its authorised signatory is an OOR. Squeezing them into the same schema means the
[[t:verifier]] cannot answer the question "can this person sign a contract?".

## 2.3 Early decisions

| Topic | Decision |
|---|---|
| **The subject is not a human** (for LE) | `cnf` is not the legal entity's device key but the key of its **authorised representative** — structurally different from education |
| Format | SD-JWT VC |
| Derived claims | `can_sign_contracts`, `spend_limit_above` (threshold-based) |
| `sd: always` | Personal name fields, fee/limit values |
| TTL | OOR/ECR: **90 days** (roles change) · LE: 1 year |
| Status list | **Yes** for all three — role revocation is a real need |
| Institution category | `GOVERNMENT` (trade registry) or `OTHER` (the company itself, I1) |

**Point to note:** a company may give its own employee an ECR (level I1), but it **cannot give itself** the LE credential —
the trade registry issues that. A legal-entity record in which the entity declares its own existence makes the record itself
meaningless.

## 2.4 The vLEI carrier difference

vLEI uses the ACDC/KERI carrier; Tamga uses SD-JWT VC. The flattening logic in [[RS-SCHEMA-0001]] §9 applies here too:
**the semantics are inherited, the carrier is not**, and a two-way mapping table is mandatory.

---

# 3. `health` — Health (expansion stage)

## 3.1 Reference: FHIR + IPS

[[RS-SCHEMA-0001]] §5. Precedent pattern: **the credential carries the FHIR resource, it does not redefine FHIR** (SMART
Health Cards and WHO GDHCN used the same pattern).

## 3.2 Early decisions — all in the restrictive direction

| Topic | Decision | Rationale |
|---|---|---|
| Selective disclosure | **Mandatory and the default** — almost every field `sd: always` | When an insurer asks "is this person vaccinated?", it must not see the whole immunisation history |
| Derived claims | **The primary interface** — `is_vaccinated_for(X)`, `has_no_allergy_to(Y)` | The raw FHIR resource must be the exception, not the rule |
| Presentation of the raw resource | Only to **healthcare-provider** verifiers | Enforced by the RP scope |
| Institution assurance | **I3 minimum** | An institution issuing health credentials must be accredited |
| Status list | Yes, short `ttl` | Test results age quickly |
| Reflection on the chain | **None** — even the schema record must reveal nothing beyond the domain name | [[PM-TRUST-0001]] |

## 3.3 Red line

**Invariant SK2:** in the `health` domain no field may be `sd: "never"` — except the protocol claims (`iss`, `vct`, `cnf`,
`status`, `iat`).

[[SPEC-SCHEMA-0001]]/D6 already forbade `never` (no [[t:selective-disclosure]]) for personal data; in health this becomes a
rule without exceptions. Marking a diagnosis field `never` by mistake means the diagnosis goes to every verifier in **all**
credentials issued with that schema, and it cannot be undone.

## 3.4 Opening condition

In health, SG7 (legal review) must be **independent**. The special-category personal data regime of the Turkish data
protection law (KVKK) and the related health legislation bring obligations the education schemas do not have. Without this
review, the `health` domain is not opened.

---

# 4. `id` — Driving licence and identity (state stage)

## 4.1 The format difference — the most important point

[[t:mDL]] uses **[[t:mdoc]]/CBOR/COSE**, not SD-JWT ([[RS-SCHEMA-0001]] §4). [[ADR-0006]] has already accepted mdoc as a
secondary format.

**Invariant SK3:** an mDL is **not converted** into an [[t:SD-JWT-VC]]. Converting it stops it being an mDL and destroys its
international recognisability — the whole value of the mDL is that it can be read across borders.

Consequence: when the `id` domain opens, the wallet, the verifier and the SDK must support **both formats at once**. This is
the largest engineering item of the state stage.

## 4.2 Inherited pattern

`age_over_NN` ([[RS-SCHEMA-0001]] §4) has already entered all Tamga schemas as a principle. When the `id` domain opens, the
**source** of this pattern is inherited too: the `org.iso.18013.5.1` namespace and data elements are used as they are.

## 4.3 Early decisions

| Topic | Decision |
|---|---|
| Format | mdoc (ISO/IEC 18013-5), 18013-7 for online use |
| Portrait | `sd: always`; it also requires **separate consent** (biometric) |
| Institution | Only `GOVERNMENT` + `I3` |
| Proximity presentation | BLE/NFC — out of scope of [[SPEC-PROTO-0002]], a separate profile is needed |
| Cost of the standard | **The ISO text is paid** — a budget item ([[RS-SCHEMA-0001]] §4) |

## 4.4 The PID link

When the `id` domain opens, the initial-stage limitation in [[SPEC-SCHEMA-0002]] §1.2.3 closes: with a combined presentation
(diploma + [[t:PID]], the same `cnf`), identity matching becomes cryptographic. This is the most important gain of the `id`
domain **for education too**.

---

# 5. `travel` — Travel (expansion stage)

Reference: **ICAO DTC**. The digital derivative of the logical data structure on the passport chip; it has two components,
virtual and physical.

**Early decision:** Tamga **does not issue** DTCs — passport issuance is a state monopoly. In the tourism module (the
`turkistantour.com` context) and border-crossing scenarios Tamga is in the **verifier** role.

This is structurally different from the other verticals and should not be taken up before the `id` domain has matured.

---

# 6. `log` — Trade and logistics (expansion stage)

Reference: **UN/CEFACT** data models + **MLETR** (the model law on electronic transferable records).

## 6.1 Structural difference: transferability

This vertical brings a requirement opposite to Tamga's whole design.

Documents such as bills of lading must be **transferable** — as the goods change hands, so does the document. But Tamga's core
security property is that a credential is **non-transferable** ([[SPEC-CRED-0001]] §3, [[SPEC-WALLET-0001]]/WL1).

**Invariant SK4:** transferable trade documents **cannot be** a normal [[t:credential]] derived from `TamgaBaseCredential`.
A separate primitive is needed — probably an on-chain ownership record + the credential used only as proof of ownership.

This is not a schema design problem but an **architectural** one, and it needs a separate ADR before the `log` domain opens.

## 6.2 The vLEI link

The parties to trade documents are legal entities; the `org` schemas in §2 are a prerequisite. `log` cannot open before `org`
has matured.

---

# 7. Cross-sector rules

| Rule | Scope |
|---|---|
| Derived boolean claims are mandatory in every domain | [[RS-SCHEMA-0001]] §4 |
| Multilingual support is built in from the start | [[SPEC-SCHEMA-0001]] §8 |
| A two-way mapping table is mandatory | [[RS-SCHEMA-0001]] §9 |
| No nesting deeper than two levels | [[SPEC-CRED-0002]]/C11 |
| The identity number does not appear in NETWORK schemas | [[SPEC-SCHEMA-0002]] §1.2 |
| The list URI is opaque, the index random | [[SPEC-CRED-0003]] §6 |

The last two rows are especially important: in the `health` and `id` domains adding an identity number will be far more
tempting (on legislative grounds). If a decision is needed, it is taken with a NATIONAL schema; it does not enter the NETWORK
schema.

---

# 8. Phase map

| Domain | Phase | Prerequisite |
|---|---|---|
| `edu` | **0 — written** | — |
| `org` | **0 — skeleton** | §1 checklist (SG1–SG7) |
| `id` | 1 | State participation + mdoc support + ISO text |
| `health` | 2 | Independent legal review (§3.4) |
| `travel` | 2 | `id` matured |
| `log` | 2 | `org` matured + transferability ADR (§6.1) |
| `fin` | 2 | Separate work — not covered in this document |

---

# 9. Invariants

| # | Invariant |
|---|---|
| **SK1** | No domain is opened before the seven-condition checklist is complete. |
| **SK2** | In the `health` domain no personal data field may be `sd: "never"`. |
| **SK3** | An mDL is not converted into an SD-JWT VC; it stays an mdoc. |
| **SK4** | Transferable trade documents cannot be normal credentials; a separate primitive is needed. |
| **SK5** | A legal entity cannot issue its own LE credential to itself. |
| **SK6** | The identity number appears in no NETWORK schema — whatever the domain. |

---

# Security and privacy notes

**Even the domain name carries information.** A credential from the `health` domain in a user's wallet is a signal even when
it is not presented — the type name is visible in the presentation list. The wallet design must let the user hide their
credential types → open question in [[SPEC-WALLET-0001]].

**Sector expansion puts pressure on the verifier side.** Every new domain means a new format and new policies in the verifier
SDK. The `id` domain bringing mdoc (breaking the single-format assumption of [[SPEC-CRED-0002]]) is the largest break.

**The checklist is a brake, and it should be.** Making it easy to open a new vertical makes it easy to write bad schemas. The
friction of §1 is deliberate.

---

# Open questions

1. The `fin` domain is not covered in this document. Finance sits at the intersection of `org` and `id` and probably carries
   the heaviest regulatory load. It needs separate research.
2. The transferability problem in §6.1 awaits an ADR. An on-chain ownership record, or a separate MLETR-compliant primitive?
3. When the `id` domain opens, the "single format" assumption of [[SPEC-CRED-0002]] breaks. When will that document's mdoc
   section be written?
4. We said the `org` skeleton would be written in the initial stage, but it is not in the pilot scope. When and on which trigger will it
   become a full schema? → [[PM-GTM-0001]]
5. Who audits the application of the §1 checklist? In the initial stage the foundation's technical board; in the state stage the council
   ([[PM-GOV-0001]]).

---

# Related documents

[[RS-SCHEMA-0001]] · [[SPEC-SCHEMA-0001]] · [[SPEC-SCHEMA-0002]] ·
[[SPEC-CRED-0001]] · [[SPEC-CRED-0002]] · [[SPEC-CRED-0003]] ·
[[SPEC-WALLET-0001]] · [[ADR-0006]] · [[ADR-0007]] · [[PM-TRUST-0001]] ·
[[PM-GOV-0001]] · [[PM-GTM-0001]] · [[INVARIANTS]]

---

# Status

**In force** — version 1.0.0 (2026-10-02).
