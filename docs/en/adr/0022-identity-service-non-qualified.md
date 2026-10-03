---
document_id: ADR-0022
title: "Class of the identity service"
status: Active
version: 1.0.0
created: 2026-09-29
last_updated: 2026-10-02
summary: >
  The Tamga identity service is registered in the trust list as a non-qualified EAA / I2 instead of QUALIFIED / I3; the
  identity credential carries no `category` claim. In the EU "qualified" is a legal title that requires an independent
  conformity assessment and supervision by a supervisory body; Tamga does not meet it yet. It can be raised again after an
  independent assessment. Changes the class line of ADR-0011.
domain: Identity
translation_of: ADR-0022
source_version: 1.0.0
---

# Context

[[ADR-0011]] registered the Tamga identity service in the [[t:trust-list]] as `class: QUALIFIED`, `assurance: I3`; the
identity credential carries `category: urn:tamga:eaa:qualified`, and the schema requires it as a fixed value.

The EU gap analysis (2026-09-29) and the code comparison of 27 September (finding K5) showed:

- In [[t:eIDAS]] 2.0 "qualified" ([[t:QEAA]] / [[t:QTSP]]) is a legal title. It requires an audit by an independent
  conformity assessment body and supervision by the supervisory body.
- [[FW-TF-0001]] ties I3 to the condition of an "independent assessment".
- Tamga is at the same time the list operator, the registrar and the identity service. It registered itself in the highest
  class; there is no independent assessment. The remote identity verification provider's conformity with ETSI TS 119 461 is
  at the level of a declaration.

When talking to the EU side this reads as an overstated claim; it carries legal and reputational risk.

# Decision

## K1 — Class and assurance

The Tamga identity service is registered in the trust list as **`class: EAA`** (non-qualified electronic attestation of
attributes, [[t:EAA]]) and **`assurance: I2`**.

## K2 — No category in the credential

The identity credential (`urn:tamga:id:IdentityAttestation:1`) carries no `category` claim ([[ADR-0010]] K5: the category is
only for PUB / QUALIFIED [[t:issuer]]s). The minimum issuer assurance in the schema metadata goes down from I3 to I2.

## K3 — Policies that use it

Policies that request the identity credential (institutions' identity matching, sample sites) require a minimum issuer
assurance of **I2**.

Identity verification itself does not change:
- document + liveness + face matching,
- optional NFC chip reading,
- HMAC document digest.

Only the label in the trust list is brought in line with reality.

## K4 — Raising it again

Once an independent conformity assessment (within ETSI TS 119 461 / TS 119 471) is done and the [[FW-TF-0001]] I3 conditions
are met, the class is raised by a new ADR.

## K5 — In-place correction before the pilot

The schema 1.0.0 metadata is corrected in place because we are before the pilot (the same one-time exception as the
English correction of 2026-09-29). Existing test identity credentials are re-issued. In the pilot the D1 immutability rule
applies unchanged.

# Options considered

| Option | Result | Why |
|---|---|---|
| Staying at QUALIFIED / I3 | rejected | No independent assessment; the claim of "qualified" in the EU sense cannot be met |
| QUALIFIED, I2 | rejected | The class name is still confused with the EU legal title |
| **EAA, I2** | **accepted** | Describes the real situation; in the EU a non-qualified EAA can be issued by anyone |
| EAA, I1 | rejected | Identity verification and key management meet the I2 conditions |

# Invariants

| Code | Rule |
|---|---|
| IDC1 | A service operated by Tamga itself is not registered in the trust list as QUALIFIED or I3 without an independent conformity assessment. |
| IDC2 | The identity credential carries no `category` claim; until the class is raised, no policy requires I3 for the identity credential. |

# Consequences

- `apps/trust-publisher/registry/tl-tr.source.json`: `tamga-id` → `class: EAA`, `assurance: I2`.
- `packages/schemas`: the IdentityAttestation `category` field is removed, `min_issuer_assurance: I2` (1.0.0 in place).
- `apps/id` (operator repository): no `category` is written into the identity credential. `apps/issuer`: identity matching policy
  I2.
- The class line of [[ADR-0011]], [[SPEC-ID-0003]], [[FW-RB-0001]] RB-AP-ID-04 and the Identity Rulebook are updated.

# Status

**Accepted — 2026-09-29.** With project management approval. DECISIONS: D-ID-7.
