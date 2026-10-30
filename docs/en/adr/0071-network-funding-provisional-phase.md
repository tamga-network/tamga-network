---
document_id: ADR-0071
title: "Funding the network in the provisional phase: no service fees; the foundation is funded by grants and state or member contributions"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-30
last_updated: 2026-10-30
summary: >
  In the provisional phase (until the foundation is established and its governance body decides) Tamga Network charges no
  participant — issuing institution, verifier, wallet provider or individual — for registration, issuance, verification or list
  services. Once established, the foundation is funded by grants, unconditional donations and state or member contributions; until
  then the provisional operator covers the costs. A financial contribution has no effect on a registration decision, a place in the
  list or a governance vote. The earlier commercial direction that institutions would pay an annual fee is withdrawn. Accepted:
  2026-10-30.
domain: Governance
related: ["[[ADR-0035]]", "[[ADR-0037]]", "[[ADR-0070]]", "[[FW-TF-0001]]"]
translation_of: ADR-0071
source_version: 1.0.0
---

# In short

The network takes money from no one: not from institutions, verifiers, wallets or individuals. Once the foundation exists, the
network lives on grants and state or member contributions; until then the company that provisionally runs the network pays the
costs. Whoever contributes money gains no privilege in the list or in decisions.

# Context

- [[ADR-0037]] (D-GOV-8): Tamga Network is only a network and sells no services; commercial services are offered by companies
  outside the network.
- An older commercial direction (D-GTM-1, details in the operator's private records) foresaw an annual fee charged to issuing
  institutions. It contradicted the principle that the network sells no services and the network's path to a non-profit
  foundation.
- [[FW-TF-0001]] §5.5: free for individuals; the institution fee was to be set "at the end of the pilot" (decision pending).
- Direction of project management: in the provisional phase the network charges no fees; the foundation is funded by grants and
  state or member contributions; the earlier fee clause is withdrawn.

# Decision

## K1 — No fees
In the provisional phase the network charges no participant (issuing institution, verifier, wallet provider, individual) for list
registration, issuance, verification, the identity service or list services. For individuals the network is always free.

## K2 — Funding
Once established, the foundation is funded by grants, unconditional donations and state or member contributions. Until the
foundation exists, the provisional operator ([[ADR-0070]]) covers the network's costs; this gives it no privilege in the network.

## K3 — Contributions give no privilege
A financial contribution (grant, donation, state or member contribution, the provisional operator covering costs) has no effect
on a registration decision, a place in the trust list, the participation gates or a governance vote.

## K4 — Commercial services outside the network
Paid services such as integration, hosting, support or consulting are offered by companies outside the network in their own name
([[ADR-0037]]); a registration decision of the network cannot depend on buying them.

## K5 — Earlier direction
The earlier commercial direction that institutions would pay an annual fee (the revenue model part of D-GTM-1) is withdrawn by this
decision. Reconsidering fees requires a decision of the governance body and a new ADR.

# Options considered

| Option | Result | Why |
|---|---|---|
| Annual fee from issuing institutions (earlier direction) | rejected | The network sells no services ([[ADR-0037]]); non-profit foundation; neutrality |
| Fee per verification | rejected | Hinders the network effect; in the EU verification does not depend on a network fee |
| Leaving the fee decision to the end of the pilot | rejected | Uncertainty in talks with institutions; the contradiction would remain |
| **No fees; grants and state or member contributions; contributions give no privilege** | **chosen** | Consistent with neutrality and the foundation model; a clear and lasting principle |

# Invariants

| Code | Rule |
|---|---|
| FN1 | In the provisional phase the network charges no participant for list registration, issuance, verification, the identity service or list services; for individuals the network is always free. |
| FN2 | A financial contribution (grant, donation, state or member contribution, the provisional operator covering costs) has no effect on a registration decision, a place in the trust list, the participation gates or a governance vote. |

# Consequences

- Documents: [[FW-TF-0001]] §5.5 was rewritten with this decision; the fee clause in the operator's private commercial records was
  withdrawn.
- No code change (no component of the network charges fees).

# Status

**Accepted — 2026-10-30.** With the approval of project management (verbatim quote in the private approval record). DECISIONS:
D-GOV-11; the revenue model part of D-GTM-1 is withdrawn. FN1–FN2 are binding.
