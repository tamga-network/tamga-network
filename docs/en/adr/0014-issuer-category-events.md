---
document_id: ADR-0014
title: "Events category"
status: Active
version: 1.0.0
created: 2026-09-27
last_updated: 2026-10-02
summary: >
  Only EVENTS (event/ticket seller) is added to the closed IssuerCategory set (GOVERNMENT, IDENTITY, EDUCATION, HEALTH,
  FINANCE, LOGISTICS, OTHER); TRANSPORT and TELECOM are not added until a real institution appears. The new value is
  appended to the end of the enum (stable ordinals). The ticket seller `bubilet` moves from OTHER to EVENTS. Closes DB-23.
domain: Credentials
translation_of: ADR-0014
source_version: 1.0.0
---

# Context

`IssuerCategory` is the **closed set** that states an institution's sector ([[SPEC-BC-0001]] §3, the `@tamga-network/trust`
schema, `IIssuerRegistry.sol`); the set was closed as "final" in DECISIONS, so extending it requires an ADR. With D10
(tickets) the first event ticket seller (`bubilet`, operator model) entered the [[t:trust-list]] and, lacking a fitting
category, was given `OTHER` temporarily. Question (DB-23, 2026-09-26): should only **EVENTS** be added, or also
**TRANSPORT** and **TELECOM**, whose labels the wallet already shows on screen?

Project management decision (2026-09-27): the category for ticket [[t:issuer]]s is **events**.

# Decision

1. **K1 — Only EVENTS is added.** Meaning: an institution that issues a ticket or attendance credential granting entry to an
   event such as a concert, sports match, show or fair (ticket seller, organiser, venue). Transport tickets (TRANSPORT) and
   operator credentials (TELECOM) are outside this decision; they are added by their own ADR when a real issuer candidate
   appears.
2. **K2 — Stable ordinals.** The new value is appended to the **end** of the enum:
   `{GOVERNMENT, IDENTITY, EDUCATION, HEALTH, FINANCE, LOGISTICS, OTHER, EVENTS}`. The contract is not deployed yet (chain
   stage), but the append-at-end rule applies to every future extension (ABI/storage compatibility).
3. **K3 — Migration.** The `bubilet` trust list entry moves `OTHER` → `EVENTS` (new list version); the `event-ticket`
   [[t:verifier]] policy is `allowed_categories: ["EVENTS"]`. The wallet label is "Event".
4. **K4 — Schema metadata unchanged.** `issuer_categories: ["OTHER"]` in the `urn:tamga:tkt:EventTicket:1` metadata is
   informative ([[SPEC-SCHEMA-0001]]: the binding check is in the trust layer), and the integrity digest of published
   metadata cannot change (D1, `vct#integrity`). The correction comes with the next schema version (`EventTicket:2`).

# Rationale / alternatives

- **EVENTS + TRANSPORT + TELECOM (rejected):** opening categories without issuers grows the set speculatively; the meaning
  of a category (in transport: card or ticket? in telecom: line ownership?) becomes clear with the first real institution.
- **Leaving it in OTHER (rejected):** the coarse filter loses its meaning; the ticket verifier would have to accept every
  institution in the "other" category. The real gate is still `vct` + schema authorisation, but the category is a second
  line of defence.
- **Naming:** the first proposal was `TICKETING`; on project management's suggestion it is `EVENTS` — the category
  describes the sector, not the sales channel.

# Invariants

| # | Invariant |
|---|---|
| **IC1** | `IssuerCategory` is a closed set; a new value is added only by ADR and appended to the **end** of the enum (ordinals do not change). |
| **IC2** | The category is a coarse filter, not an authorisation: acceptance of an issuer's credential is decided by `vct` + time-windowed schema authorisation ([[SPEC-TRUST-0001]]); the category alone is never a reason to accept. |
| **IC3** | A category change is published in a new trust list version and does not retroactively change the authorisation evaluated against the credential's `iat` (D-BC-3). |

# Consequences

- Code: the `@tamga-network/trust` schema, `IIssuerRegistry.sol`, the trust list source (`bubilet`), the `apps/verify`
  policy, the wallet label/icon mapping (`TICKETING` → `EVENTS`).
- Documents: [[SPEC-BC-0001]] (enum), [[SPEC-ID-0002]] (comment line), the glossary; DB-23 closed.
- Remaining: `issuer_categories: ["EVENTS"]` in `EventTicket:2` (K4).

# Status

**Accepted — 2026-09-27.** DECISIONS: D-CAT-1.
