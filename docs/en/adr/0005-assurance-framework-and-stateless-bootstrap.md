---
document_id: ADR-0005
title: "Assurance model and stateless bootstrap"
status: Active
version: 1.0.0
created: 2026-09-03
last_updated: 2026-10-02
summary: >
  Fixes Tamga's assurance model as a DECISION: trust is measured on two independent axes — Holder/Wallet Assurance (T0–T3)
  and Issuer Assurance (I1–I3) — and the verifier's decision is their PRODUCT. A stateless bootstrap is also adopted: until
  states join the network, assurance is DERIVED from existing Turkish institutions (e-signature/qualified signature = T3,
  bank/mobile operator = T1, KYC/institution desk = T2). Our own levels map 1:1 to the eIDAS LoA. Detailed rationale →
  PM-ASSUR-0001.
domain: Identity
translation_of: ADR-0005
source_version: 1.0.0
---

# ADR-0005 — Two-axis assurance model and stateless bootstrap

**Status:** Accepted
**Date:** 2026-09-03
**Decided by:** Tamga Network project management
**Source:** `tamga-guven-cercevesi-v0.1.md` (sections B, D) — working note; strategy rationale and the full model →
[[PM-ASSUR-0001]].

---

# Context

[[PM-ID-0001]] §6.2 said that assurance levels would exist and map to the [[t:eIDAS]] [[t:LoA]], but did not define them.
[[PM-PH-0001]] (§Future item 5) said "the infrastructure must also work without a state" but left open *how*. These two
gaps prevented the network from working before states join (phase 0, [[ARCH-0001]]).

This decision closes the gaps and makes the measurement of trust implementable.

---

# Decision

## Decision 1 — Trust is measured on two axes (not one number)

- **Axis A — [[t:holder|Holder]]/Wallet Assurance: T0 (anonymous) → T1 (low) → T2 (substantial) → T3 (high).**
- **Axis B — Issuer Assurance: I1 (registered) → I2 (contracted) → I3 (accredited).**
- **[[t:verifier|Verifier]] decision = axis A × axis B (a product, not a sum).** A high-assurance holder + a
  non-accredited [[t:issuer]] = worthless; an accredited issuer + a T0 holder = worthless.
- **IssuerCategory ≠ Issuer Assurance:** the [[SPEC-BC-0001]] category states the sector, I1–I3 the degree of
  accreditation; they are orthogonal.

## Decision 2 — Stateless bootstrap is adopted

Until states join the network, assurance is **derived** from existing Turkish institutions (derived assurance). No level
requires a state agreement:

- **T3** ← signing a challenge ([[t:nonce]]) with e-signature / qualified electronic signature / mobile signature
  (verified against the national electronic certificate root).
- **T2** ← remote KYC / NFC passport / **institution registration desk** (university or chamber = registration authority).
- **T1** ← bank micro-transfer / mobile line ownership.
- **Issuer I1–I3** ← Tamga accredits temporarily in the Root TAO role.

When a state joins (phase 1) this does not disappear; the **PID Provider** ([[t:PID]]) becomes the default high-LoA source
next to T3, adding a broader base and higher enrolment quality.

## Decision 3 — Our own levels map 1:1 to the eIDAS LoA

T1≈Low, T2≈Substantial, T3≈High. Internally the option to treat enrolment, authenticator and verification dimensions
separately (NIST 800-63 style) is kept; externally a single eIDAS LoA is presented → no loss of EUDI/EBSI interoperability
("compatible but independent", [[PM-PH-0001]]).

## Decision 4 — Assurance decay, and no numbers shown to users

- A level is **lowered** over time or on events (device change → T1, inactivity, expiry of the source
  [[t:credential]], anomalies).
- End users are **not shown numbers** (they see a state); the numbers belong to the verifier's policy engine.

---

# Rationale

- **eIDAS/EBSI precedent:** the two axes combine the eIDAS holder LoA with EBSI's issuer accreditation chain — a proven
  model.
- **Working without states:** "I have no state agreement → I cannot verify anyone" is wrong; with derived assurance up to
  T3 can be produced today. This is the single lever that makes the project viable before states join.
- **Inflation risk:** if level criteria are relaxed, the system becomes meaningless → the criteria are written into the
  formal Trust Framework and made procedurally hard to change (PM-GOV-0001).

---

# Consequences

1. [[PM-ASSUR-0001]] is the full background record of this model (new `assurance/` domain).
2. The verifier policy engine applies the holder **and** issuer thresholds together → parameters of the [[ADR-0003]]
   `requiresCredential` primitive.
3. An **issuer assurance level** field is added to the [[SPEC-BC-0001]] `Issuer` struct (holder assurance is not written to
   the ledger — personal data, [[PM-TRUST-0001]]).
4. [[SPEC-CRED-0001]] [[t:holder-binding]] + [[t:WUA]] are the technical precondition for holder assurance.
5. [[ARCH-0001]] phase 0 is clarified as the stateless bootstrap layer.

---

# Relations

- [[PM-ASSUR-0001]] — full model and rationale.
- [[PM-ID-0001]] — §6.2 becomes concrete here; PID Provider = phase 1 T3.
- [[PM-PH-0001]] — the counterpart of the "works without a state" principle.
- [[SPEC-CRED-0001]] / [[SPEC-BC-0001]] — technical carrier and ledger representation.
- [[ADR-0006]] — credential format (the carrier of this decision).
- PM-GOV-0001 (planned) — level criteria text + TAO accreditation governance.

The two-axis model + stateless bootstrap + eIDAS mapping + decay + presentation principle were accepted on 2026-09-03.
