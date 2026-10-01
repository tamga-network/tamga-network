---
title: "Annex A — Trust Framework"
translation_of: FW-TF-0001
source_version: 0.2.0
outline: [2, 3]
---

# Annex A — Tamga Trust Framework

<div class="arf-meta">

**Document** FW-TF-0001 · **Version** 0.2.0 · **Status** Active · **Updated** 2026-09-27 · **Licence** CC BY 4.0
Official English translation of the Turkish source text; in case of conflict the Turkish text prevails.

</div>

The governance framework of the Tamga ecosystem, structured on the World Bank's five-layer model for digital wallet trust
frameworks: **Strategy** (vision, principles, legal context, risk, governing bodies), **Technology** (pointing to the ARF),
**Scheme rules** (roles, onboarding gates, lifecycle, assurance), **Compliance** (regime, ISO 17000 roles, conformity
testing, supervision, sanctions, incident response) and **Agreements** (contract set, SLAs, liability, termination,
succession). It is the Turkic-world counterpart of the eIDAS 2.0 + implementing-regulation layer and is the "asset to be
handed over" when a state takes over. Tamga's role today is that of a founding stand-in.

## 0. Status, scope, how to read

This document is the **Tamga Trust Framework** (TTF). It has three jobs:

1. To tell **institutions** how to join the ecosystem, which obligations they take on and which assurances they receive.
2. To show **regulators and Organization of Turkic States (OTS) member states** that the structure is isomorphic with
   eIDAS 2.0, yet designed for the Turkic world in terms of sovereignty and hand-over.
3. To be the asset delivered **at hand-over**: root fingerprints, registers, rules, contract templates and the change log
   are bound to this document ([[ADR-0009]] K5.5).

Each layer distinguishes "in Tamga today" from "at hand-over". Items whose source is a decision carry a `DOC-ID/CODE`
reference; items without a source are marked **PROPOSAL** and are not binding until approved.

**Order of precedence:** ADR/DECISIONS > SPEC > this document > Participant Rules > contract templates. In a conflict the
higher source prevails and this document is corrected.

## 1. Layer 1 — Strategy

### 1.1 Vision

A shared trust infrastructure in which the member and observer states of the Organization of Turkic States, their
institutions and their citizens can **verify each other's documents without asking the source**; each state remains the
sole sovereign of its own registers, with no authority above them ([[PM-PH-0001]], [[ADR-0002]]). Positioning:
"compatible but independent".

### 1.2 Principles

The seven principles of the ARF ([[FW-ARF-0001]] §1.2 — sovereignty, no personal data, compatible-but-independent,
OTS-first, ledger = choice of signers, holder binding, designed to be handed over) are also the principles of this
framework. Two principles specific to governance:

| # | Principle | Source |
|---|---|---|
| G-A | **Registration ≠ authorisation.** The Registrar registers, it does not license; an institution's legal authority to award diplomas (higher-education authority, ministry, chamber) is granted outside the ecosystem; the network only holds the in-network **scope** | D-SCHEMA-2 |
| G-B | **Soft power is limited too.** Every power that code cannot limit (hosting, domain names, logs, statistics) is limited by policy + a measurable tripwire + transparency reporting | [[PM-GOV-0001]]/G6, G8 |

### 1.3 Scope

| Dimension | Phase B (today) | Target |
|---|---|---|
| Jurisdiction | Türkiye (TR national list active) | OTS members (AZ, KZ, KG, UZ) + observers (HU, TM); slots reserved |
| Document types | `urn:tamga:edu:*` (student certificate, diploma) | Sector schemas (via the [[SPEC-SCHEMA-0003]] checklist SG1–SG7) |
| Participants | A university (issuer), employers (RP), Tamga (wallet provider, TLSO) | Chambers, professional bodies, public bodies (PUB), banks |
| Person identification data (PID) | **Out of scope** — Tamga does not issue PID | State PID Provider (phase 1) |

### 1.4 Legal context

| Topic | Basis in Türkiye | In this framework |
|---|---|---|
| Personal data | Law No. 6698 (KVKK); data-controller registry (VERBİS); information notice, explicit consent, DPIA | Participation agreement annexes; pilot gate |
| Electronic signature / seal | Law No. 5070 (e-signature); list of qualified providers; qualified e-signature / e-seal | T3 identity proofing path; e-seal for I3 |
| International recognition | eIDAS 2.0 Art. 14 (third-country agreements); ETSI TS 119 612 support for non-EU lists | Technical alignment target + ETSI list projection ([[SPEC-ID-0002]] §8.1) |
| Higher education | Higher-education legislation (authority to award diplomas) | Authority outside the ecosystem; network scope separate (G-A) |
| Jurisdiction / disputes | Home-state principle | §5.8 |

**PROPOSAL (requires legal review):** a review of this framework and its contract annexes by a lawyer, against the
personal data and e-signature laws, is added to the pilot gate.

### 1.5 Risk approach

Risks are handled at ecosystem level and proportionately. A Tamga Risk Register (`FW-RISK-0001`, planned) will be derived
from the ARF risk lists. The residual risks declared openly today are in [[FW-ARF-0001]] §11 (single-operator anchor,
revocation delay, issuer linkability).

### 1.6 Governing bodies and powers

| Phase | Body | Powers | Source |
|---|---|---|---|
| **B / 0 (today)** | Foundation management | Day-to-day operation, infrastructure, TLSO/Registrar stand-in, SDK releases | [[PM-GOV-0001]] |
| | Foundation technical board | Specification changes, ADR approval, NETWORK schemas | same |
| | (none) | Council — no member state yet; named a "temporary anomaly" | same |
| **1+** | Council (member states) | Admission/removal of members 2/3, NETWORK schemas 2/3, protocol upgrades 2/3, the policies of this document | [[ADR-0002]], [[SPEC-BC-0001]] GV1–GV4 |
| | Each state | Its own national list/registers (`onlyOwnerState`), Registrar, TLSO, Root CA | [[ADR-0002]] |
| | Foundation | Operation (until handed over) | |

**Tripwires (measurable hand-over thresholds):** hosted issuers > 30 % → on the council's agenda; ≥ 4 state validators →
foundation validators are handed over; first state validator in production → the council is formed ([[PM-GOV-0001]]).
Ledger start threshold: ≥ 2 independent validator operators ([[ADR-0009]] K4).

### 1.7 Transparency

A quarterly transparency report (G8): list versions and changes, share of hosted issuers, schema usage counters (buckets ≥
50, G4), incidents, audit findings. `CHANGELOG.md` is public at `trust.tamga.network`.

## 2. Layer 2 — Technology

The technical reference is **[[FW-ARF-0001]]**; this layer lists only the requirements governance places on technology.

### 2.1 Mandatory standards and profiles

SD-JWT VC + the Tamga wire profile ([[SPEC-CRED-0002]]) · Tamga profiles of OpenID4VCI/VP ([[SPEC-PROTO-0001]],
[[SPEC-PROTO-0002]]) · X.509 institutional identity ([[SPEC-ID-0002]]) · Token Status List ([[SPEC-CRED-0003]]) · Type
Metadata + JSON Schema catalogue ([[SPEC-SCHEMA-0001]]) · trusted-list format ([[SPEC-TRUST-0001]]) · canonical verification
pipeline ([[SPEC-API-0001]]) · wallet ([[SPEC-WALLET-0001]]) · identity proofing ([[SPEC-ID-0003]]).

### 2.2 Assurance model (governance view)

| Axis | Level | Measured by | Recorded in |
|---|---|---|---|
| Holder (T0–T3, eIDAS Low/Substantial/High) | Binding path | Issuer / registration authority | Issuer audit record (PR7); precondition of the type |
| Issuer (I1–I3) | Accreditation | Registrar + (I3) independent assessment | Trusted list `assurance`, `class` |
| Wallet (W1–W3) | WSCD level | Wallet Provider (WUA) | `wallet_providers[]` |

Outward naming uses eIDAS terms (Low/Substantial/High; EAA / QEAA-equivalent / PuB). People are not shown numbers
([[PM-ASSUR-0001]]).

### 2.3 Key protection requirements

| Key | Requirement |
|---|---|
| List signing key (TLSO) | ≥ 2 overlapping certificates; KMS/HSM; rotation announced ≥ 30 days ahead, the new key signed with the old (BT3) |
| Root CA | Offline ceremony (two people, minutes); fingerprint on a permanent page |
| Issuer credential key | Under the institution's control; HSM at I3; **never at Tamga** (G1, BT7; demo deviation S-1 declared) |
| Status key | Separate, online (K1, S11) |
| Holder key | Device secure element; not exportable; not derived from a seed (WL1) |
| RP access certificate | Access CA; `client_id = x509_san_dns:` |

### 2.4 Certification approach

Phases B/0: **light conformity** — the `conformance/` vectors + commitment tests are mandatory before release
([[ARCH-0005]]/P7). Phase 1: independent conformity assessment bodies (CAB) and national certification (§4.2).

## 3. Layer 3 — Scheme rules

### 3.1 Roles and responsibilities

Role definitions are in [[FW-ARF-0001]] §2; the binding rules for each role are in [[FW-RB-0001]]. This section defines
the **gates** of participation and the lifecycle.

### 3.2 Onboarding gates

Gates are designed as automatic conformity checks; no registration happens before they are passed.

#### Attestation Provider (Issuer)

| Level | Gate | What it gives |
|---|---|---|
| **I1 — Registered** | Domain ownership (DNS challenge); contact; technical conformity (metadata + test issuance against the conformance vectors) | Listed with `class: EAA`, `assurance: I1`; shown as "not accredited" to verifiers |
| **I2 — Contracted** | I1 + legal entity (company register / founding law) + confirmation of the authorised signatory + **Participation Agreement** (§5.1) + X.509 certificate + personal-data annexes | `assurance: I2` |
| **I3 — Accredited** | I2 + keys in an HSM (or a qualified e-seal) + audit/logging duties + incident-notification SLA + annual review + suspension procedure + liability insurance | `assurance: I3`, `class: QUALIFIED`; `category: urn:tamga:eaa:qualified` in the credential |
| **PUB** | A public body / on behalf of an authentic source; registered by that state's Registrar | `class: PUB`; `category: urn:tamga:eaa:pub` (phase 1) |

An institution uses the hosted issuing service from its own systems with a **tenant-bound, scoped API key**; the key is
stored only as a hash and rotates every 90 days ([[ADR-0016]] HA1–HA3).

Schema authorisation is independent of the gate: a **per-type allowlist**, closed by default ([[SPEC-BC-0001]]/I1),
granted according to the "who may issue" section of the attestation rulebook.

#### Relying Party

Registration form (legal entity, purpose, fields to be requested) → **scope** allocation (claims that may be requested;
data-minimisation review) → access certificate → `relying_parties[]` entry. An RP cannot request fields beyond its scope
([[SPEC-API-0001]]/AP6); the wallet shows the scope to the person. An RP may run its own verifier or use the hosted verifier
(intermediary); in the latter case results and values are given only to the RP that proves itself with its signed
assertion, and only once ([[ADR-0017]]).

#### Wallet Provider

Wallet-solution declaration (platforms, WSCD level, PIN/biometrics, backup model conforming to WL1–WL11) → WUA signing key
→ `lotl › wallet_providers[]`. Phase 1: a list of certified solutions (counterpart of CIR 2025/849).

#### Authentic Source

Named in the issuer's agreement; data processing agreement (§5.1); mapping table (ISCED-F etc.) and the rule "no
counterpart → issuance stops" ([[SPEC-SCHEMA-0002]]/E11, [[ARCH-0003]]/CMP5).

### 3.3 Lifecycle rules

- **Suspension:** an incident, audit finding or breach of contract → `SUSPENDED` (new issuance stops, older documents stay
  valid by `iat`) → remedy → `ACTIVE`.
- **Removal:** `REVOKED` (+ `successor_id` if there is a successor); `withdrawn` in the ETSI projection; history is never
  deleted; the successor may publish the status list.
- **Key / certificate renewal:** new `issuer_id` + `successor_id`; older documents verify against the older entry; the
  Registrar is notified ≥ 30 days ahead.
- **Voluntary exit:** notice + 90 days; the status list is frozen at its last version by the successor or the TLSO
  ([[SPEC-BC-0001]]/GV1: existing documents are not invalidated).
- **A state joining/leaving:** membership by 2/3; leaving does not invalidate existing entries (GV1); re-admission is
  possible (GV4).

### 3.4 Identity proofing and document type

Each attestation rulebook defines the minimum binding level the type requires (education: student certificate T1, diploma
T2; [[FW-RB-0002]] §4). The issuer ensures this level before issuing; the level is not written into the credential. Paths
and provider integration: [[SPEC-ID-0003]].

### 3.5 Identity attestation provider (provisional; [[ADR-0011]], D-ID-6)

Until a state-appointed PID provider exists, **Tamga Network** takes this role *provisionally*: after remote identity
verification (document + liveness + face; NFC may be added) it issues an `Identity Document (Tamga, provisional)` to the
wallet. Rules: (1) this document is not a PID but an EAA; when a state provider is appointed it is handed over by
succession (§5.7); (2) Tamga is the **data controller** for this data — information notice and explicit consent before
issuance; images/selfies are not stored by Tamga; retention is limited to the document's validity; a deletion request
revokes the document; (3) the identity number is carried only in this type and only selectively disclosable; (4)
institutions receive the document only through **presentation**, within their registered scope, to match it with their own
records; they do not keep matching keys; (5) the provider agreement refers to ETSI TS 119 461; (6) the quarterly
transparency report includes issuance/revocation counts (no persons). Technical profile: [[SPEC-ID-0003]] §9.

### 3.6 Data protection rules

Role-based responsibility: issuer/authentic source = data controller; Tamga in an issuing service it hosts = data processor
(by contract); **in the identity attestation service = data controller (§3.5)**; wallet provider = no access to data on the
device; RP = controller of the claims it receives. There is no personal data in shared registers (P2). Rights of the
person: presentation log on the device, a complaint flow in the wallet (PROPOSAL), withdrawal of consent → revocation of
the document ([[PM-GTM-0001]]/GT7).

### 3.7 Proximity presentation and the pass card ([[ADR-0012]], D-PROX-1)

**Principle:** the party that wants to be convinced generates the challenge (nonce). In a proximity presentation where the
wallet shows a QR code, either a second channel is opened (target: ISO/IEC 18013-5, phase 1) or the QR carries only a
**short-lived reference** (C: reverse-initiated OpenID4VP) or a **signed token without personal data** (B: pass card, 60 s).
Rules: (1) a terminal is defined only under a registered Relying Party (`terminal_groups[]`); (2) the pass token does not
identify the person, the RP matches the person in its own records; (3) not asking for consent at the gate rests on
**time-limited, scoped** consent that the person can withdraw at any time; (4) every display is recorded in the wallet; (5)
for single-use attestations (tickets) gates keep a shared used-list; (6) bridge paths are versioned and retired when ISO
18013-5 arrives.

## 4. Layer 4 — Compliance

### 4.1 Choice of regime — hybrid

| Class | Regime | Meaning |
|---|---|---|
| I3 / QUALIFIED | **Ex ante** | Conformity assessment (technical + organisational) before registration, annual audit |
| I2 | **Ex post** | Self-declaration + conformance vectors; audit on complaint/incident; annual self-assessment |
| I1 | Self-declaration | Technical conformity test; "not accredited" label |
| Wallet Provider | Ex ante (phase 1) | Solution certificate; in phase B self-declaration + WUA |
| RP | Ex post | On a complaint of scope violation / over-asking |

The same as the EUDI hybrid model (qualified = ex ante, advanced = ex post).

### 4.2 ISO/IEC 17000 roles

| Role | Phase B / 0 | Phase 1+ |
|---|---|---|
| Scheme owner | Tamga (founding stand-in) | Council |
| Accreditation body | Tamga (provisional) | National accreditation body |
| Conformity assessment body (CAB) | — (self-declaration + conformance vectors) | Independent CABs |
| Scheme participant | Issuer, RP, Wallet Provider, Authentic Source | same |

### 4.3 Conformity tools

- `conformance/` vectors (trust + sd-jwt; versioned; no personal data, no private keys).
- Commitment tests: stale list → UNKNOWN, unknown format → stop, signature error → stop ([[ARCH-0005]]/P7).
- A reference verifier (`verify.tamga.network`) and a reference deployment — RPs run their own indexer/verifier or use the
  hosted verifier; Tamga offers no hosted indexer (G3).

### 4.4 Continuous supervision

Transparency report (G8), tripwire measurements (G6), list `CHANGELOG`, incident register, independent audit (annually from
phase 1; including CDN/log configuration — verifying P2).

### 4.5 Sanctions ladder

| Step | What | Record |
|---|---|---|
| 1 | Warning + remedy period (30 days) | Incident register |
| 2 | Narrowing schema authorisation (closing the allowlist for a type) | `schema_authorizations` window closes |
| 3 | **Suspension** (`SUSPENDED`) | List + CHANGELOG |
| 4 | **Removal** (`REVOKED`, successor appointed) — ETSI `withdrawn` | List + CHANGELOG + transparency report |
| 5 | Termination of the agreement; legal remedies | §5 |

Removal does **not** invalidate older documents (the `iat` rule); only new issuance stops, and if no successor is named the
status list is frozen. There are no fines in this framework (PROPOSAL: by council decision in phase 1).

### 4.6 Incident response

| Incident | Class | Response |
|---|---|---|
| Issuer credential key leaked | SEV1 | Issuer `SUSPENDED`; certificate revoked; affected documents REVOKED in the status list; re-issuance plan; notification |
| Suspected list signing key compromise | SEV1 | Switch to the second overlapping certificate; root fingerprint page + transparency notice |
| Wallet solution vulnerability | SEV1/2 | Staged: WUA revocation per version (solution) or per unit; issuers refuse new issuance |
| Status publication missed 2 cycles | SEV2 | Verifiers produce INDETERMINATE; operator intervention |
| Schema CDN 5xx | SEV3 | Cache (`vct#integrity`) keeps verification going |

Source: [[ARCH-0004]] SEV1–3; counterpart of CIR 2025/847. A personal data breach → notification to the data protection
authority within 72 hours.

### 4.7 Disputes

Disputes between participants go first to the scheme owner (phase B: Tamga technical board), then to the jurisdiction
named in the agreement. Between states: the council; there is no higher authority at network level
([[SPEC-BC-0002]]/GD8). Complaints by persons: the issuer + the data protection authority.

## 5. Layer 5 — Agreements

### 5.1 Contract set (templates held by the operator; published summaries here)

| Agreement | Parties | Content |
|---|---|---|
| **Participation Agreement (Issuer)** | Institution ↔ Tamga (scheme owner) | Scope, class/assurance, schema authorisations, key management (G1), status publication duty, identity proofing levels, notices, personal-data annexes, SLA, liability, termination, succession |
| **Hosting Annex** | Institution ↔ Tamga | Issuing service at Tamga: the key stays with the institution, logging regime, the list of hosted issuers is public, tripwire |
| **RP Terms of Use** | RP ↔ Tamga | Scope, data minimisation, no over-asking, no logging of `idx`/claims, nonce, handling of INDETERMINATE, registration |
| **Wallet Provider Agreement** | WP ↔ Tamga | WUA, WSCD, update/revocation SLA, no recovery keys held |
| **Data Processing Agreement** | Issuer ↔ Authentic Source / Tamga (processor) | Data security; mapping table; retention |
| **Phase 0/B Limits Notice (v2)** | Pilot participants | 8 items: no ledger, single-operator anchor, revocation ≤ 90 min, synthetic-data stage, voluntariness, withdrawal of consent… ([[ADR-0009]] K6; G7) |
| **Succession Agreement** | Tamga ↔ escrow agent / council | Domain name, roots, list archive, key hand-over |

### 5.2 Service levels (SLA)

| Service | Target |
|---|---|
| `trust.` list availability | 99.9 % monthly; `next_update` ≤ 90 days; changes ≤ 24 h |
| Anchor log | hourly; ≤ 1 missed cycle |
| `schemas.` | 99.9 %; published files never change |
| Issuer status publication | fixed interval (pilot 60 min); 2 missed cycles = SEV2 |
| Incident notification | SEV1 ≤ 4 hours; SEV2 ≤ 24 hours |
| Register change (Registrar) | ≤ 5 working days |

### 5.3 Allocation of liability

| Who | Liable for | Relation to assurance |
|---|---|---|
| Issuer | Accuracy of the document content; identity proofing at the level the type requires; timely revocation | "Presumption of accuracy" for I3/QUALIFIED documents; at I1 the RP carries the burden of proof |
| Authentic Source | Accuracy of the source data | Towards the issuer, by contract |
| Wallet Provider | Accuracy of the WUA declaration; key protection at the declared level | If a W2/W3 declaration is wrong, liability lies with the WP |
| Relying Party | Applying its policy correctly; not treating INDETERMINATE as acceptance; staying within its scope | For high-risk transactions, additional identity checks are the RP's duty |
| Tamga (TLSO/Registrar stand-in) | List integrity, cadence, register accuracy, transparency | Limited except for intent / gross negligence (pilot notice) |
| Holder | PIN/device security; objecting to an "added to a wallet" notice | — |

### 5.4 Confidentiality and intellectual property

Code Apache-2.0, documentation CC BY 4.0; the schema repository is open and mirrored; use of the "Tamga" mark and the Trust
Mark is subject to agreement; tenant data is confidential.

### 5.5 Fees

**Free for people** (as in eIDAS 2.0). The fee structure for institutions is set in the participation agreement at the end
of the pilot; the pilot is free of charge (D-GTM-1, D-WEB-7).

### 5.6 Termination and exit

Voluntary exit as in §3.3; on termination the status list is frozen or passes to a successor; existing documents are not
invalidated; personal data retention follows data protection law.

### 5.7 Hand-over (succession)

The domain name is held in the name of the foundation's legal entity, with transfer lock + DNSSEC and ≥ 10 years of
renewal; on liquidation or hand-over to a state, the domain name, roots, list archive and key escrow pass to the council or
the escrow agent.

### 5.8 Jurisdiction

Home-state principle: courts of Istanbul for institution ↔ Tamga agreements (PROPOSAL); the council between states; the
person's own state for personal rights.

## 6. Interoperability (three levels)

| Level | In Tamga |
|---|---|
| 1. Portability | SD-JWT VC + OpenID4VC; an EUDI wallet can technically process a Tamga document |
| 2. Trust | Trusted list (ETSI 119 612 semantics); XML projection; root fingerprints; cross-recognition field |
| 3. Legal recognition | Between states: unilateral recognition ([[ADR-0002]]); with the EU: an eIDAS Art. 14 agreement (long term) |

## 7. Hand-over plan — to OTS member states

| Step | What is handed over | How |
|---|---|---|
| 1 | National list operation (TLSO) | The `operator` field changes; `ca_id` / `issuer_id` / `vct` fixed; a state-owned signing certificate is added in overlap |
| 2 | Registrar | Registration authority passes to the state; Tamga can no longer register |
| 3 | National Root CA | The name "TR National Root CA (provisional operator: Tamga)" stays, the operator changes; or the state's root is added by `RETIRED/ACTIVE` rotation |
| 4 | PID Provider slot | Filled by the state; T2/T3 production moves to PID |
| 5 | Ledger | ≥ 2 independent validators → phase 0; state validators → phase 1; replay + equivalence |
| 6 | This document | Owned by the council; version 1.0 |

Hand-over invalidates no document, entry or identifier.

## 8. Change management of this document

- Versioning: semver; MAJOR = participant obligations change (re-signing required), MINOR = new rule/role, PATCH =
  correction.
- Every change is tied to an ADR or a DECISIONS entry; PROPOSAL items lose the label as they are approved and are recorded in
  the change history.
- Publication: **`arf.tamga.network`** (Tamga ARF Annex A; English + Turkish, Turkish source — [[ADR-0018]]); the
  `operator.trust_framework` URL in the trusted lists carries a versioned link.

## 9. Items awaiting approval (PROPOSAL list)

| # | Item | Section | Related decision |
|---|---|---|---|
| P-1 | Hybrid compliance regime (I3 ex ante, I2 ex post) | §4.1 | DB-12 |
| P-2 | ISO 17000 role mapping | §4.2 | DB-12 |
| P-3 | Liability allocation table | §5.3 | DB-12 |
| P-4 | Sanctions ladder, remedy periods, SLA figures | §4.5, §5.2 | DB-12 |
| P-5 | Data-protection complaint flow in the wallet | §3.6 | open |
| P-6 | Legal review gate | §1.4 | — |
| P-7 | Jurisdiction | §5.8 | legal |

With the acceptance of D-GOV-6 (2026-09-24), items P-1 to P-7 are in force as **v0.1 framework rules**; the figures are
revised with pilot data through the change history.

## Related documents

[[FW-ARF-0001]] · [[FW-RB-0001]] · [[FW-RB-0002]] · [[PM-GOV-0001]] · [[PM-ASSUR-0001]] · [[PM-GTM-0001]] · [[ADR-0002]] ·
[[ADR-0005]] · [[ADR-0009]] · [[ADR-0010]] · [[SPEC-BC-0001]] · [[SPEC-ID-0002]] · [[SPEC-ID-0003]] · [[SPEC-CRED-0003]] ·
[[ARCH-0004]] · [[ARCH-0005]] · World Bank, *Digital Wallets: Trust Frameworks — Governing the Ecosystem* (2026)

## Change history

- **0.2.0 (2026-09-27)** — Annex A of Tamga ARF, English + Turkish ([[ADR-0018]]); §3.2 hosted issuing API ([[ADR-0016]])
  and hosted verifier ([[ADR-0017]]); §5.5 fee wording; §3.7 order corrected.
- **0.1.0 (2026-09-24)** — First version, accepted 2026-09-24 (D-GOV-6).
