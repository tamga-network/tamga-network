---
document_id: ADR-0037
title: "Tamga Network is only a network"
status: Active
version: 1.0.0
created: 2026-10-02
last_updated: 2026-10-02
summary: >
  Tamga Network is a network: it runs the rules, the trust lists, the schema catalogue, the open packages and the reference
  services the network needs; it does not sell services. Commercial services (integration, support, contracted hosting,
  consulting, connectors) belong to companies outside the network. Tamga Wallet is the network's first wallet but a separate
  product. This decision changes the third layer of ADR-0035 ("products and services").
domain: Governance
translation_of: ADR-0037
source_version: 1.0.0
---

# In brief

Tamga Network is a network, not a company. It writes the rules, publishes the trust lists and runs open code and reference
services that anyone can use. None of these are sold. Any company that wants to offer paid integration, support or consulting
to institutions does so outside the network, under its own name; the network's rules are the same for all of them.

# Context

[[ADR-0035]] positioned Tamga in three layers: EU compatibility as the base, Tamga Network as a light [[t:federation]], and
"products and services" as the third layer (Tamga Wallet and services for institutions). The same record noted a known tension:
in the EU model, the body that runs the list selling services is a conflict of interest, and network governance and the service
company should separate over time.

That separation has now been made. The work is split into three structures: Tamga Network (the network), Tamga Wallet (the
wallet product) and, outside the network, a company that provides services for EU–Türkiye compatibility. The network's own
documents should no longer describe selling services.

# Decision

**K1 — Tamga Network is only a network.** The network's job:

- rules: Tamga ARF, the Trust Framework, the Tamga Rulebook and the credential-type rulebooks;
- trust: national [[t:trust-list|trust lists]], the [[t:LOTL]], registration and approval, federation (external lists);
- shared data: the schema catalogue;
- open code: the `@tamga-network/*` packages and the conformance tests;
- reference services: the trust list publisher, the registration tool, hosted issuance and the Institution Console, Tamga
  Verify, the provisional identity service. These exist so that the network works, can be tried out and institutions can join;
  they are not sold.

**K2 — The network sells no services.** Integration, support, contracted hosting and service-level commitments, consulting,
connectors and similar commercial services are offered by companies outside the network, under their own names. One of these
companies is the one founded by the Tamga team; the network does not treat it differently from the others.

**K3 — The third layer of ADR-0035 changes.** Instead of "products and services": **what sits on top of the network** — wallets
that follow the network's rules (the first is Tamga Wallet) and service providers. They are not part of the network; they are
its participants or users.

**K4 — Tamga Wallet is a separate product.** It is the network's first and reference wallet; it evolves in its own repository
with its own decision series and follows the network's rules like any other wallet.

# Invariants

| Code | Rule |
|---|---|
| PO5 | Tamga Network does not sell services; the network's documents and sites contain no pricing, sales or commercial-service wording. Commercial services are offered outside the network, under the provider's name. |
| PO6 | The network's reference services and registration process are open to all participants on the same terms; no service provider, including the Tamga team's company, gets priority or privileges. |

# Rationale and alternatives

| Option | Outcome | Why |
|---|---|---|
| Services stay inside the network (ADR-0035 as written) | rejected | In the EU model, the party running the list selling services is a conflict of interest; it makes it harder for states and other companies to trust the network. |
| **The network is only a network; services outside** | **accepted** | The network stays neutral and is easier to hand over to a foundation or to states; commercial work continues with the same team but through a separate company. |

# Consequences

- The third layer of [[ADR-0035]] changes with this decision; PO1–PO4 remain in force.
- The positioning section (§1.5) and the governance section (§8.3) of the Tamga ARF main document are updated accordingly.
- tamga.network speaks in the network's voice: the "Join the network" page describes participation, without sales language.
- Commercial services are described in the company's own documents and site (its own decision series).

# Status

**Accepted — 2026-10-02** (project management approval; the verbatim quote is in the private approval record).
