---
document_id: ADR-0043
title: "No age limit: the EU approach"
status: Active
version: 1.0.0
created: 2026-10-08
last_updated: 2026-10-08
summary: >
  Tamga Network sets no age limit: neither for wallets listed on the network nor for the network's identity service (the
  identity credential). eIDAS 2.0 sets no minimum age for the European Digital Identity Wallet; the network follows the EU
  framework. The condition for using a wallet on the network is identity verification with a valid identity document, not
  age. Wallets on the network follow the same approach unless their own law requires otherwise; the issuer decides
  eligibility for its own credentials (e.g. a student card). A guardian-consent flow for children (GDPR Art. 8, Turkish law)
  and the identity verification provider's limits are recorded as follow-up work.
domain: Identity
translation_of: ADR-0043
source_version: 1.0.0
---

# In short

There is no age limit on Tamga Network. What using the wallet requires is identity verification with a valid identity
document, not a certain age. Who may receive a credential (e.g. a student card) is decided by the institution that issues it.

# Context

- eIDAS 2.0 (Regulation (EU) 2024/1183) sets no minimum age for the European Digital Identity Wallet; member states provide
  the wallet to their citizens. Tamga Network follows the EU framework ([[ADR-0035]]).
- Using a wallet on the network requires identity verification with a valid identity document in the network's identity
  service ([[ADR-0011]], [[SPEC-ID-0003]] §9). Identity documents are issued to minors as well.
- The network's rules, specifications and framework documents have never stated an age limit; "I am over 18" is only
  information a verifier can ask for (`age_over_18`, [[ADR-0032]]), not a condition for using the wallet.

# Decision

**K1 — The network sets no age limit.** There is no minimum age either for wallets listed on the network (as a condition of
entry in the trust list) or for the network's identity service and the identity credential it issues. The condition is
identity verification with a valid identity document.

**K2 — Wallets on the network follow the same approach.** Wallets listed on the network set no age limit unless their own law
requires otherwise. If a wallet's law requires a limit, that limit is the wallet's own rule, not a rule of the network.

**K3 — The issuer decides eligibility for a credential type.** An institution decides from its own records who receives its
credential (e.g. a student card only for an enrolled student). An age-dependent service, as a verifier, asks only for the
information it needs (e.g. `age_over_18`).

# Invariants

| Code | Rule |
|---|---|
| YS1 | The network sets no minimum age for a wallet's entry in the trust list or for the identity service issuing the identity credential. |
| YS2 | The issuer of a credential decides who may receive it; age-dependent checks are done by the verifier asking only for the information it needs. |

# Rationale / alternatives

| Option | Result | Why |
|---|---|---|
| A network-wide age limit of 18 | rejected | Not in the EU framework; excludes credentials that minors use too (students, athletes, events). |
| A network-wide age limit of 13 or 16 | rejected | GDPR Art. 8 is not an age limit but a parental-authorisation rule for consent-based services; setting a limit is a matter for the law where needed, not for the network. |
| **No age limit; the issuer decides eligibility** | **accepted** | Same as the EU approach; the condition is identity verification. |

# Consequences and open items

- No code change today: the identity service and the trust list entry rules did not check age. The identity rulebook
  ([[FW-RB-0003]] §3) and the identity proofing specification ([[SPEC-ID-0003]] §9) refer to this decision.
- **Follow-up — guardian consent:** GDPR Art. 8 requires parental authorisation for consent-based information society services
  offered to a child below 16 (member states may lower this to 13). Under Turkish law KVKK sets no specific age; legal capacity is
  limited below 18. The identity service's notice and explicit-consent flow may need a guardian-consent flow; this is handled by a
  separate decision after legal review and is not implemented today.
- **Follow-up — provider limits:** whether the remote identity verification provider (reference: Didit) has its own limit or
  condition for minors has not yet been confirmed; it will be confirmed and, if needed, added to [[SPEC-ID-0003]].

# Status

**Accepted — 2026-10-08** (project management approval; the verbatim quote is in the private approval record). DECISIONS:
D-ID-10.
