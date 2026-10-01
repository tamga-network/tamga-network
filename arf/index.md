---
title: Tamga ARF
aside: false
---

# Tamga ARF

<span class="arf-release">Release 0.7 · 1 October 2026</span>

**The Architecture and Reference Framework of Tamga Network** — a digital trust infrastructure for the Turkic world,
compatible with eIDAS 2.0 and the European Digital Identity Wallet ecosystem. Tamga ARF describes who takes part, under
which rules and on which architecture: use cases, roles, the architecture, the data model, the trust model, security and
governance, and the binding rules for every participant.

It follows the structure of the EU ARF: one main document and five annexes.

## Documents

| Document | Version | For |
|---|---|---|
| [Architecture and Reference Framework](/architecture) | 0.3.0 | everyone — start here |
| [Annex A — Trust Framework](/annex-a-trust-framework) | 0.3.0 | regulators, states, institutions: governance, onboarding, compliance, agreements, hand-over |
| [Annex B — Participant Rules](/annex-b-participant-rules) | 0.4.0 | every participant: numbered rules per role |
| [Annex C — Education](/annex-c-education) | 0.2.0 | universities and verifiers: student certificate and diploma |
| [Annex C — Identity](/annex-c-identity) | 0.3.0 · draft | institutions and verifiers: the provisional identity credential |
| [Annex C — Event ticket](/annex-c-event-ticket) | 0.2.0 · draft | ticket sellers and gates |
| [Annex D — Definitions](/annex-d-definitions) | 0.1.0 | terms and abbreviations |
| [Annex E — References](/annex-e-references) | 0.1.0 | standards, Tamga documents and the source of every rule |

## How to read

- **Institution or integrator:** the [main document](/architecture), chapters 2–6 → [Annex B](/annex-b-participant-rules)
  for your role → the Annex C rules for your credential type.
- **Regulator or state:** [Annex A](/annex-a-trust-framework) → the main document, chapters 6 and 8.
- **Developer:** the [developer documentation](https://docs.tamga.network) has integration guides, code examples and the
  specifications behind this framework.

## Where it sits

| Layer | In the EU | In Tamga |
|---|---|---|
| Law and governance | eIDAS 2.0 and implementing regulations | Annex A — Trust Framework |
| Architecture and roles | EU ARF | The main document |
| Participant rules | EU ARF Annex 2 (high-level requirements) | Annex B — Participant Rules |
| Credential type rules | Attestation rulebooks | Annex C |
| Technical standards | ETSI, IETF, OpenID, ISO | Tamga specifications (docs.tamga.network), listed in Annex E |

## Language and status

Tamga ARF is published in English and [Turkish](/tr/). The Turkish text is the source; the English text is its official
translation of the same version, and a release is not published while the two differ. Items still marked **PROPOSAL** are
listed in Annex A, section 9.

## Releases

Every release stays online, frozen as published; choose one from the version menu. [What changed between releases →](/changes)

- **0.7 (1 October 2026)** — Restructured on the model of the EU ARF, written for people to read; the federation model
  and positioning; new Annex D (Definitions) and Annex E (References), which now holds the rule sources.
- **0.6 (1 October 2026)** — App-store review access for the identity credential.
- **0.5 (1 October 2026)** — HAIP 1.0 alignment: verifier client identifier `x509_hash`.
- **0.4 (1 October 2026)** — Per-site pseudonyms.
- **0.3 (27 September 2026)** — Attestation rulebooks for the identity credential and event tickets (drafts).
- **0.2 (27 September 2026)** — Own site, English and Turkish, three annexes.
- **0.1 (24 September 2026)** — First version of the framework (Turkish).

Documentation CC BY 4.0 · Code Apache-2.0.
