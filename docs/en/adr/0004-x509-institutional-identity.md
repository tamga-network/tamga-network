---
document_id: ADR-0004
title: "Institutional identity: X.509"
status: Active
version: 1.0.0
created: 2026-08-06
last_updated: 2026-10-02
summary: >
  Institutional (entity) identity is established with X.509 certificates instead of a did:tamga entity profile. The chain
  of trust rests on national root authorities (Root CAs); an institution's identity on the ledger is anchored as
  issuerId = keccak256(stateCode, certFingerprint). Citizens are NOT given a global identifier — personal relationships use
  pairwise pseudonyms (the SPEC-ID-0001 pseudonym profile is kept). Chain accounts are EVM addresses in every case
  (unchanged). Rationale: the institutional side is already certified and readable by regulators, and there is a legal
  counterpart in payment and audit scenarios. The did:tamga entity profile is SUPERSEDED; the pseudonym profile and the
  value layer (ADR-0003) are not affected. Full X.509 method specification → SPEC-ID-0002.
domain: Trust
translation_of: ADR-0004
source_version: 1.0.0
---

# ADR-0004 — Institutional identity: X.509

**Status:** Accepted
**Date:** 2026-08-06
**Decided by:** Tamga Network project management
**Source:** `docs/tamga-network-cuzdan-odeme-agent.md` (X.509 input draft; considered in [[PM-AUTH-0001]] as an argument in
favour of X.509). This ADR closes [[DECISIONS]] D-ID-1.

---

# Context

[[SPEC-ID-0001]] built identification on two profiles: **Entity** (`did:tamga:<state>:<id>`, an institutional identity
registered on the ledger) and **[[t:pseudonym|Pseudonym]]** (`did:tamga:p:<key>`, self-certifying, pairwise).
[[DECISIONS]] D-ID-1 tracked, as the highest-priority open decision, whether the entity side should move to **X.509
certificates**. Project management's working papers argued for X.509; the decision was taken.

---

# Decision

**Institutional/entity identity = X.509 certificate. The did:tamga entity profile is SUPERSEDED.**

The three layers ([[PM-AUTH-0001]] §Three layers) become:

| Layer | Identifier (new) | Changed? |
|---|---|---|
| **A. Chain account** | EVM address (secp256k1) | No — Besu EVM, always was |
| **B. Institutional identity** | **X.509 certificate** + on-ledger `issuerId = keccak256(stateCode, certFingerprint)` | **Yes** — instead of did:tamga entity |
| **C. Personal identity** | Credential (SD-JWT VC) + **pairwise pseudonym** | No — the pseudonym profile is kept |

**Principles:**

1. **The chain of trust rests on national root authorities.** Each member state's Root CA is anchored on the ledger
   ([[t:trust-anchor]]); an institution's certificate can be verified up to this root. `issuerId` is bound to the
   institution's certificate fingerprint + state code ([[SPEC-BC-0001]] Issuer Registry, `onlyOwnerState`: only its own
   state registers an institution).

2. **Citizens are not given a global identifier.** A fixed global ID would string together a person's health, education,
   logistics and payment activity. Personal relationships use **pairwise pseudonyms** — different in each relationship and
   unlinkable ([[SPEC-ID-0001]] pseudonym profile + [[PM-ID-0002]] accountable disclosure).

3. **Chain transactions use EVM addresses** — separate from the identity [[t:credential]] ([[ADR-0003]] key-domain
   separation). The X.509 decision does not affect layer A.

---

# Rationale

1. **The institutional side is already certified.** In payment and institutional flows the counterparty is usually an
   institution (bank, customs broker, port, insurer) — all of them already have X.509 certificates and regulatory
   registrations. Verifying a licensed institution is solved with existing infrastructure in the X.509 world; the DID world
   would need a recognition regime from scratch.

2. **Readable by regulators.** "Identity verified with a qualified certificate" has a legal counterpart; "verified with a
   DID" does not. Since audit burden in payments is heavier than in identity, this advantage matters ([[PM-AUTH-0001]]).

3. **[[t:eIDAS]]/[[t:QSCD]] alignment.** Qualified certificates and QSCDs are already X.509-based; aligned with the
   "compatible but independent" principle ([[PM-PH-0001]]).

4. **No effect on the value layer.** Since X.509 does not affect layer A (EVM), it takes nothing away from payment or agent
   capability ([[ADR-0003]] remains valid).

---

# Consequences

**Changed:**
- The `did:tamga:<state>:<id>` entity profile is **not used**; institutional identity is X.509 + `issuerId` fingerprint.
- [[SPEC-BC-0002]] guardian `entityId` and the **court-token signature chain** are bound to X.509 (court and guardian
  signatures are verified with the certificate chain). The §7 item "track x509" is **closed**.
- The entity section of [[SPEC-ID-0001]] is superseded; **SPEC-ID-0002 (X.509 method specification)** is to be written:
  Root CA anchoring, certificate→issuerId mapping, root rollover, chain validation.

**Unchanged:**
- The pseudonym profile ([[SPEC-ID-0001]]), accountable disclosure ([[SPEC-BC-0002]] escrow), the EVM account model, the
  value layer hooks ([[ADR-0003]]), governance ([[ADR-0002]]).

**New open topics:** anchoring national Root CAs on the ledger + root rollover → SPEC-ID-0002 / RS-X509 (planned). Is a
bridge to institutions' existing `did:web` identities needed (interop)? → SPEC-ID-0002.

---

# Relations

- [[SPEC-ID-0001]] — entity profile superseded; pseudonym kept.
- [[SPEC-BC-0001]] — Issuer Registry (issuerId = certFingerprint, onlyOwnerState).
- [[SPEC-BC-0002]] — guardian entityId + court token bound to the X.509 signature chain.
- [[ADR-0002]] — state namespace / onlyOwnerState (Root CA ownership).
- [[ADR-0003]] — value layer (independent of X.509, kept).
- [[PM-AUTH-0001]] — three layers + rationale of regulator readability.
- SPEC-ID-0002 — the full X.509 method specification.

The X.509 decision was taken on 2026-08-06; D-ID-1 is closed. Entity identity moved to X.509; the pseudonym and value
layers are kept. The full method specification ([[SPEC-ID-0001]] revision / SPEC-ID-0002) is follow-up work.
