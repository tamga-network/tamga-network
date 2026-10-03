---
title: Architecture Decision Records (ADR)
---

# Architecture decision records (ADR)

An ADR is the permanent record of a decision that has been taken in Tamga Network and has become binding: what the problem
was, which options were considered, what was decided and what follows from it. A closed decision changes only through a new
ADR; the old record is not deleted but marked as superseded.

<AdrTable />

## Structure of an ADR

| Section | Content |
|---|---|
| Context | The situation and constraints that call for the decision |
| Decision | Numbered decision items (K1, K2, …) |
| Options considered | Alternatives, their pros and cons, why they were not chosen |
| Consequences | Affected documents, code and operations |
| Invariants | Binding rules that follow from the decision (e.g. `ADR-0017/HV1`); collected on the [binding rules page](/rules) |
| Status | Proposed → Accepted → (if needed) Superseded; date of acceptance |

## Process

1. It is written as a proposal (status: Proposed).
2. Project management accepts it; the date is recorded and the decision is entered in the [decision register](https://github.com/tamga-network/tamga-network/blob/main/DECISIONS.md) under a `D-*` code.
3. The affected specifications and [Tamga ARF](https://arf.tamga.network/) documents are updated in the same piece of work.
