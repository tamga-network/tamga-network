---
title: "Reading path"
translation_of: FW-READ-0001
source_version: 1.0.0
outline: [2, 3]
---

# Reading path

<div class="arf-meta">

**Document** FW-READ-0001 · **Version** 1.0.0 · **Status** Active · **Updated** 2026-10-02 · **Licence** CC BY 4.0
Official English translation of the Turkish source text; in case of conflict the Turkish text prevails.

</div>

One table showing the order in which to read Tamga ARF for your role: for an issuing institution, a verifier, a wallet
provider, a state or regulator, an auditor, a software developer and a person — first which parts of the ARF, then which
developer documents.

## 1. How to use it

Tamga ARF consists of a main document and five annexes. You do not need to read everything from start to finish: the table
below shows, for your role, which parts of the framework to read first and which implementation documents to read next. The
implementation documents are on the developer site (docs.tamga.network), with steps, code examples and specifications.

If you do not yet know what a role does and which rules bind it, start with the **Roles** page ([[FW-ROLE-0001]]); if you are
ready to join the network, go to the **Onboarding** page ([[FW-ONB-0001]]).

## 2. Reading order per role

| Role                                                                   | 1. Framework (ARF)                                                                                                                                                             | 2. Implementation (developer documents)                                                                          |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| **Issuing institution** (university, ticket seller, professional body) | Main document §2–§6 → [[FW-ROLE-0001]] "Issuer" → Annex A §3.2 (onboarding gates) and §5.1 (agreements) → Annex B §4 (RB-AP) → the rulebook for your credential type (Annex C) | [[GUIDE-0007]] → [[GUIDE-0003]] → [[GUIDE-0009]]                                                                 |
| **Verifier** (employer, bank, website, gate)                           | Main document §2 and §6 → [[FW-ROLE-0001]] "Verifier" → Annex A §3.2 (verifier registration) → Annex B §7 (RB-RP) → the verification policy in the credential type's rulebook  | [[GUIDE-0008]] → [[GUIDE-0002]] or [[GUIDE-0001]] → [[GUIDE-0006]]                                               |
| **Wallet provider**                                                    | Main document §2, §5, §6 and §7 → [[FW-ROLE-0001]] "Wallet provider" → Annex A §3.2 and §4.3 (conformance tests) → Annex B §6 (RB-WP)                                          | [[GUIDE-0005]] → [[GUIDE-0010]] → [[GUIDE-0009]] → [[SPEC-WALLET-0001]]                                          |
| **State or regulator**                                                 | Annex A (all of it; especially §1.6 governance and §7 hand-over plan) → main document §6 (trust model) and §8 (governance and hand-over) → [[FW-ROLE-0001]] "State"            | [[GUIDE-0011]] → [[SPEC-TRUST-0001]]                                                                             |
| **Authentic source** (student information system, public register)     | [[FW-ROLE-0001]] "Authentic source" → Annex B §5 (RB-AS) → Annex A §3.6 (data protection)                                                                                      | The credential type's schema (e.g. [[SPEC-SCHEMA-0002]])                                                         |
| **Auditor** (conformity assessment, internal audit)                    | Annex A §4 (compliance: regime, roles, tests, supervision, sanctions, incidents) → Annex B (all of it) → Annex E §3 (rule sources)                                             | [[GUIDE-0009]] → the invariants ([[INVARIANTS]])                                                                 |
| **Software developer or integrator**                                   | Main document §4–§6 → your role's section in Annex B                                                                                                                           | The getting-started guides of the developer documentation ([[GUIDE-0000]]) → [[GUIDE-0004]] → the specifications |
| **Person** (holder) or general reader                                  | Main document §1 and §2 → Annex B §8 (RB-H: your rights) → Annex D (definitions)                                                                                               | The learning path on tamga.network                                                                               |

## 3. Quick reference

| Question                                                 | Where                                             |
| -------------------------------------------------------- | ------------------------------------------------- |
| Who does what in the network?                            | [[FW-ROLE-0001]]                                  |
| How do I join, and which documents do I need?            | [[FW-ONB-0001]], Annex A §3.2                     |
| Which rules must I follow?                               | Annex B (per role), Annex C (per credential type) |
| Where does a rule come from?                             | Annex E §3                                        |
| What does a term mean?                                   | Annex D                                           |
| Who governs the network, and how will it be handed over? | Main document §8, Annex A §1.6 and §7             |

## Status

**Active** — version 1.0.0 (2 October 2026).
