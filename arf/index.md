---
title: Tamga ARF
aside: false
---

# Tamga ARF

<span class="arf-release">Release 1.0 · 2 October 2026</span>

**The Architecture and Reference Framework of Tamga Network** — a digital trust infrastructure for the Turkic world,
compatible with [[t:eIDAS]] 2.0 and the European Digital Identity Wallet ecosystem. Tamga [[t:ARF]] describes who takes part, under
which rules and on which architecture: use cases, roles, the architecture, the data model, the trust model, security and
governance, and the binding rules for every participant.

It follows the structure of the EU ARF: one main document and five annexes (Annex C holds three rulebooks). The binding rules live in one main [[t:rulebook]],
the **Tamga Rulebook**, and each [[t:credential]] type has its own rulebook that branches from it.

## Documents

| Document                                              | Version | For                                                                                         |
| ----------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------- |
| [Architecture and Reference Framework](/architecture) | 1.0.0   | everyone — start here                                                                       |
| [Annex A — Trust Framework](/trust-framework)         | 1.0.0   | regulators, states, institutions: governance, onboarding, compliance, agreements, hand-over |
| [Annex B — Tamga Rulebook](/rulebook)                 | 1.0.0   | every participant: the common, numbered rules per role                                      |
| Annex C — Rulebooks                                   |         | credential-type rules that branch from the Tamga Rulebook:                                  |
| · [Education Rulebook](/rulebooks/education)          | 1.0.0   | universities and verifiers: student certificate and diploma                                 |
| · [Identity Rulebook](/rulebooks/identity)            | 1.0.0   | institutions and verifiers: the provisional identity credential                             |
| · [Event Ticket Rulebook](/rulebooks/event-ticket)    | 1.0.0   | ticket sellers and gates                                                                    |
| [Annex D — Definitions](/definitions)                 | 1.0.0   | terms and abbreviations                                                                     |
| [Annex E — References](/references)                   | 1.0.0   | standards, Tamga documents and the source of every rule                                     |
| [Reading path](/reading-path)                         | 1.0.0   | what to read, in which order, for your role                                                 |
| [Roles](/roles)                                       | 1.0.0   | each role in detail: what it does, its rules, what it needs                                 |
| [Onboarding](/onboarding)                             | 1.0.0   | the steps of joining, suspension and exit                                                   |

## How to read

The [Reading path](/reading-path) shows, for each role, which parts of the framework to read first and which developer
documents to read next. The [developer documentation](https://docs.tamga.network) has integration guides, code examples and
the specifications behind this framework.

## Where it sits

| Layer                  | In the EU                                | In Tamga                                                     |
| ---------------------- | ---------------------------------------- | ------------------------------------------------------------ |
| Law and governance     | eIDAS 2.0 and implementing regulations   | Annex A — Trust Framework                                    |
| Architecture and roles | EU ARF                                   | The main document                                            |
| Participant rules      | EU ARF Annex 2 (high-level requirements) | Annex B — Tamga Rulebook                                     |
| Credential type rules  | Attestation rulebooks                    | Annex C — Rulebooks                                          |
| Technical standards    | ETSI, IETF, OpenID, ISO                  | Tamga specifications (docs.tamga.network), listed in Annex E |

## Language and status

Tamga ARF is published in English and [Turkish](/tr/). The Turkish text is the source; the English text is its official
translation, and the two are always at the same version.

## Releases

- **1.0 (2 October 2026)** — first release.

Documentation CC BY 4.0 · Code Apache-2.0.
