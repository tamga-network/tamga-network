---
document_id: ADR-0072
title: "Value layer suspended: the ADR-0003 hooks are a research direction"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-30
last_updated: 2026-10-30
summary: >
  The value layer hooks of ADR-0003 (smart contract accounts, separate key domains and asset recovery, a scope-generic delegation
  registry, credential gating, the token rule) are no longer binding and are suspended as a "research direction". The network
  issues no token and handles no payment or value transfer; the chain code is only a projection of the signed lists (ADR-0051).
  Reopening the value layer requires a decision of the governance body, an independent security review and a new ADR. Accepted:
  2026-10-30.
domain: Governance
related: ["[[ADR-0003]]", "[[ADR-0008]]", "[[ADR-0037]]", "[[ADR-0051]]", "[[ADR-0071]]"]
translation_of: ADR-0072
source_version: 1.0.0
---

# In short

Tamga Network is a trust network; it does not deal in money, tokens or payments. Five design decisions taken earlier for a
"future value layer" are no longer binding; they remain on record only as a direction that may be researched later.

# Context

- [[ADR-0003]] (2026-08-06) set five binding hooks for an authorization/value layer: chain accounts as smart contract wallets,
  separate key domains with user-chosen asset recovery, a scope-generic delegation registry, a generic credential-gating primitive,
  and no own token but token issuance gated by a FINANCE allow list. Decision 4 was narrowed on 2026-09-10 ([[ADR-0008]]: the chain
  cannot see revocation).
- Later decisions changed the shape of the network: the network is only a network and sells no services ([[ADR-0037]]); the chain
  is a projection of the signed lists ([[ADR-0051]]); the network will be a non-profit foundation and charges no fees
  ([[ADR-0071]]). Public texts (the technical paper, the scenarios) already called the value layer a "research direction"; ADR-0003
  still appeared Active.
- Direction of project management: mark ADR-0003 as "suspended — research direction".

# Decision

## K1 — Suspension
The five hooks of [[ADR-0003]] and the decisions resting on them (D-AUTH-0…5, the value layer part of D-STR-1/2) are no longer
binding and are suspended as a research direction. ADR-0003 is not deleted; its status points to this ADR (`Superseded`, the word
of the documentation standard).

## K2 — Today's boundary
The network issues no token and handles no payment, settlement or value transfer; the chain code is only a projection of the signed
lists ([[ADR-0051]]) and needs none of the value layer primitives (smart accounts, delegation, credential gating, token allow
list). Contract drafts in that direction left in the repository are prototypes and are not enabled in production.

## K3 — Reopening
The value layer reopens only with a decision of the governance body (foundation / council), a privacy study (transaction graph),
an independent security review and a new ADR.

## K4 — Wording
Public texts mention the value layer only as a "research direction", stating clearly that it is not part of the first release or
the pilot.

# Options considered

| Option | Result | Why |
|---|---|---|
| Leave ADR-0003 as it is | rejected | An Active decision that contradicts the non-profit network, the free model and the projection chain |
| Withdraw ADR-0003 entirely | rejected | The research work should be kept; the direction may be reassessed later |
| **Suspend: research direction, reopening under conditions** | **chosen** | Consistent with today's decisions; the work stays on record |

# Invariants

| Code | Rule |
|---|---|
| VL1 | The network issues no token and handles no payment, settlement or value transfer; the value layer is not opened without a decision of the governance body, an independent security review and a new ADR. |

# Consequences

- [[ADR-0003]]: status `Superseded` (suspended — research direction), with a note at the top pointing to this ADR.
- No code change; the public texts already say "research direction".

# Status

**Accepted — 2026-10-30.** With the approval of project management (verbatim quote in the private approval record). DECISIONS:
D-AUTH-6. VL1 is binding.
