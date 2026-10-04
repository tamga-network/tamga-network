---
document_id: ADR-0035
title: "Positioning"
status: Active
version: 1.0.0
created: 2026-10-01
last_updated: 2026-10-04
summary: >
  Tamga is positioned in three layers: (1) the base — all credentials, protocols and trust lists follow EU (eIDAS 2.0 / EUDI)
  standards; (2) Tamga Network — a light trust federation for the Turkic world: it collects country lists and introduces them to
  each other, recognises every wallet that follows its rules, and gains a governance body and a ledger as states join; (3) products
  and services — Tamga Wallet (the network's first and reference wallet, working in any compatible environment) and services for
  institutions (Institution Console, Tamga Verify, integration, support).
domain: Governance
translation_of: ADR-0035
source_version: 1.0.0
---

> **Partly changed by [[ADR-0037]] (2026-10-02):** the services of the third layer moved outside the network, to a separate
> company; Tamga Network is only a network and sells no services. The base (EU compliance), the federation layer and PO1–PO4 still apply.

# Context

It emerged that TÜBİTAK BİLGEM has an EU-compatible wallet and a test environment. This information comes from a single source and
its official status is unknown. But the direction is clear: a state-backed wallet and person identification data ([[t:PID]]) path is
forming in Türkiye. The analysis is in private documents (2026-10-01).

Two misunderstandings needed clearing up:

1. **"[[t:EUDI-Wallet]]" is a legal title.** It means a wallet provided or recognised by an EU member state and certified under EU
   rules. A wallet from an organisation outside the EU (Tamga Wallet as well as the TÜBİTAK wallet) cannot hold this title today,
   nor use the EU Trust Mark. What it can be is **EU-compatible**: speaking the same standards and proving it through testing.
2. **EU compatibility is not an alternative to the paths but their common ground.** There is no choice between "an EU-compatible
   wallet + services" and "Tamga Network". The network is a layer placed on top of the EU standards.

Three paths were considered:

- **Path 1:** an EU-compatible wallet and services only.
- **Path 2:** first a heavy, EU-like network and institution.
- **Path 3:** a layered structure.

# Decision

**Path 3: three layers, each able to stand on its own.**

1. **Base: EU compatibility.** Credential formats ([[t:SD-JWT-VC]], ISO [[t:mdoc]]), protocols ([[t:OpenID4VCI]]/VP, [[t:HAIP]]),
   the trust model ([[t:LOTL]] → country lists, [[t:ETSI]] formats) and the registration model follow EU standards. Even if the
   network never grows, this layer is valuable on its own.
2. **Tamga Network: a light [[t:federation]].**
   - The network **does not select wallets, it recognises them.** Any [[t:wallet-provider]] that follows the published rules
     ([[t:ARF]], [[t:rulebook]]s) and passes the conformance tests can be listed.
   - The network's real job is **to collect country lists and introduce them to each other.** Today Tamga operates the Türkiye list
     on an interim basis. When the state, or an institution it authorises, publishes its own list, the Tamga LOTL points to that
     list's address and signer. For wallets and [[t:verifier]]s only the address changes (the ADR-0009 hand-over goal). The same
     applies to every Turkic state.
   - No heavy institution is set up on day one. Today Tamga is the interim operator. When one or two states are willing to join, a
     governance body (council or foundation) is formed, the lists are handed over and the ledger arrives (ADR-0009: at least two
     independent operators).
3. **Products and services.**
   - **Tamga Wallet:** the network's first and reference wallet, but not locked to the network; it works in any EU-compatible
     environment. It makes no claim to be a national identity wallet. Its strengths are [[t:pseudonym]]s, zero-knowledge proofs
     ([[t:ZK]]), tickets and credentials of the Turkic world.
   - **Services** (Institution Console, Tamga Verify, institutions' self-registration, a test environment, integration and SDK
     support, consulting, the provisional identity service) are offered **on top of the standards**. An institution issues its
     credential to whichever compatible wallet the person chooses; verification works whichever compatible wallet it comes from.
   - The services are not separate software: they are the running services offered to institutions. The separation is at the level
     of brand, contract and responsibility.

# Invariants

| Code | Rule |
|---|---|
| PO1 | Tamga's credential, protocol and trust list formats do not depart from EU standards; every Tamga-specific addition uses a standard extension point and does not break standard clients. |
| PO2 | Tamga Network recognises a wallet not by its name but by the published rules and conformance tests; any wallet provider that follows the rules can be listed. |
| PO3 | The state roles Tamga holds on an interim basis (list operator, registrar, root CA, provisional identity provider) are designed to be handed over; on hand-over only the address and signer change on the credential, wallet and verifier side. |
| PO4 | In public texts Tamga Wallet is not presented as an "EUDI Wallet" or a "national wallet"; the correct wording is "EU-compatible wallet", backed by conformance test results. |

# Rationale / alternatives

| Option | Result | Why |
|---|---|---|
| Path 1: EU-compatible wallet + services only | rejected (as the main direction) | Fastest revenue, but little differentiation, and it shrinks when the state wallet arrives. Path 3 already includes it. |
| Path 2: heavy network and institution first | rejected | Without states it stays without revenue for years; an early institution is costly. |
| **Path 3: layered** | **accepted** | Matches the architecture exactly; services and the wallet bring revenue now, the network grows over time, and when the state wallet and lists arrive the value is not lost — the federation's value grows. |

**Known tension:** the EU deliberately separates roles. An institution that runs the list and also sells services has a conflict of
interest. One team is enough today, but later the network's governance (council or foundation) and the service company must
separate. Public communication already shows this separation through names and documents.

# Consequences

- **Federation gate.** Country lists with external signers, reading the ETSI format and recognising external wallet providers are
  opened by a separate ADR ([[ADR-0036]]).
- **EU identity.** Verification of EU identity (PID) and driving licence ([[t:mDL]]) types is added ([[ADR-0036]]).
- **Wallet and console.** A "institutions I shared with" screen is added to the wallet; self-registration for verifying institutions
  comes to the Institution Console (design now, build after the store release).
- **Public communication.** The site, whitepaper and presentations are organised around the three layers. The ARF and the developer
  docs are simplified according to this positioning.

# Status

**Accepted — 2026-10-01** (project management approval; the verbatim quote is in the private approval record). The third layer
("products and services") was changed by [[ADR-0037]]: Tamga Network is only a network and sells no services; commercial
services sit outside the network. PO1–PO4 remain in force.
