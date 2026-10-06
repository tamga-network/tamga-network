---
document_id: ADR-0042
title: "The network and wallets: the network operates no wallet"
status: Active
version: 1.0.0
created: 2026-10-06
last_updated: 2026-10-06
summary: >
  Tamga Network is an independent network (later a foundation); it does not operate any wallet's app, wallet provider or
  website. The network provides the rules, the trust lists, open packages and shared services (verifier, identity service,
  sandbox) and recognises a wallet only through its entry in the trust list. Tamga Wallet is a separate project and joins the
  network the same way as any wallet. No wallet service runs under the network's domain names; `wallet.tamga.network` and
  `wallet.sandbox.tamga.network`, which used to run there, were removed from the network on 2026-10-06. Tamga Wallet's provider
  is operated by the wallet's operator at `provider.tamgawallet.com`. There is one sandbox and
  it belongs to the network: wallet developers test their wallets there, the wallet operates its own wallet provider and
  registers it in the sandbox list. The network's interfaces and documents do not promote a single wallet.
domain: Governance
translation_of: ADR-0042
source_version: 1.0.0
---

# In short

Tamga Network and Tamga Wallet are two separate structures. The network is the independent body that keeps the rules and the
trust list for the Turkic world (later a foundation). Tamga Wallet is a wallet app that follows those rules; it is the network's
first wallet but not part of the network. This decision draws the line between them: the network does not operate wallets, it
lists them.

# Context

- [[ADR-0035]]: the network recognises wallets by its rules; a wallet is not locked to the network. [[ADR-0037]]: the network is
  only the network; products and services live in other structures.
- Tamga Wallet started inside the network repository; the app moved to its own repository on 2026-10-02. The wallet's back end,
  the **wallet provider** ([[t:wallet-provider]]; unit registration, device attestation, wallet unit attestation WIA and key
  attestation KA — [[ADR-0025]]; remote lock) kept running on the network's server under the network's domain because the wallet
  had no server or domain of its own: `wallet.tamga.network` and, in the sandbox, `wallet.sandbox.tamga.network` ([[ADR-0038]]).
- In the EU model each wallet is operated by the organisation that offers it (Wallet Provider); the trust framework only lists
  wallet providers.
- Some of the network's interfaces and documents hard-coded one wallet's name (such as "Open in Tamga Wallet").

# Decision

**K1 — The network operates no wallet.** Tamga Network does not operate or host any wallet's app, wallet provider, website or
support service. The network's relationship with wallets is the rules ([[SPEC-WALLET-0001]], ARF), the open packages
(`@tamga-network/wallet-core`, `@tamga-network/zk` …) and the wallet provider entry in the trust list (`wallet_providers[]`:
address, signing certificate, solution name). Tamga Wallet enters the list the same way as any wallet; it has no special
position.

**K2 — The network's domain names are for the network's services.** Only the network's services run under `tamga.network` and its
subdomains (list publishing, verifier, identity service, reference issuer service, Institution Console, sandbox, documentation,
website). No wallet service runs under the network's domain. **Transition (done on 2026-10-06):** since nobody uses the system
yet, no transition period was kept; by project management decision `wallet.tamga.network` and `wallet.sandbox.tamga.network`
were removed from the network immediately and the code left the network repository. Tamga Wallet's provider is operated by the
wallet's operator at `https://provider.tamgawallet.com` (not live yet); the address in the trust lists (production and sandbox)
was updated to it.

**K3 — There is one sandbox and it belongs to the network.** The sandbox ([[ADR-0038]]) is the single test environment where
wallet, institution and verifier developers try the network's rules; no separate "wallet sandbox" is set up. In the sandbox too,
the wallet operates its wallet provider: a wallet developer has their provider registered in the sandbox list and tests the wallet
against the sandbox's sample institutions, identity service and verifier. Tamga Wallet's provider is registered in both the
production and the sandbox list. Today registration is done by hand with project management approval; self-registration of wallet
providers (the rest of [[ADR-0038]] K7) needs a separate decision.

**K4 — The network does not promote one wallet.** The network's interfaces, packages and documents refer to the wallet in general
terms ("open in your wallet"); when a wallet's name is needed it comes from the entry data in the trust list. The network's
website may mention Tamga Wallet as "the network's first wallet"; the wallet is promoted on its own website.

**K5 — Test certificates are generic.** The network's own tests and development PKI use a generic "test wallet provider"
certificate. A real wallet provider generates and keeps its key itself; the network only lists its certificate.

**K6 — The network's shared services are open to all.** The identity service ([[ADR-0011]]) and the store review code
([[ADR-0033]]) are network services, open on the same terms to every listed wallet.

# Invariants

| Code | Rule |
|---|---|
| NW1 | The network does not operate any wallet's app, wallet provider or website; it recognises wallets only by their entries in the trust list. |
| NW2 | No wallet service runs under the network's domain names. |
| NW3 | The sandbox is the single test environment; in the sandbox the wallet operates its wallet provider and registers it in the sandbox list. |
| NW4 | The network's interfaces and packages do not hard-code a wallet's name; if needed they take it from the entry data in the trust list. |

# Rationale / alternatives

| Option | Result | Why |
|---|---|---|
| The network keeps operating Tamga Wallet's provider | rejected | Breaks the network's neutrality ([[ADR-0035]]); on transfer to a foundation the wallet's service would stay tied to the network; does not match the EU model. |
| A separate sandbox for the wallet | rejected | The same institutions, verifier and rules would be set up twice; a wallet developer should test the network's real rules in one place. |
| **The network lists, the wallet operates; one sandbox** | **accepted** | Same role split as the EU framework; every wallet enters the same way. |

# Consequences

- The wallet provider's code moved to the Tamga Wallet repository (`provider/`); the copy in the network repository was deleted
  on 2026-10-06. The `tamga-wallet-provider` and `tamga-sandbox-wallet-provider` services on the network server, their nginx
  blocks and DNS records are removed from the network. The Tamga Wallet entry in the trust lists was updated to the wallet's
  operator and the address `https://provider.tamgawallet.com`; the operator supplies its own wallet provider certificate at
  go-live.
- Hard-coded wallet names in the network's interfaces become general wording; the list publisher takes the wallet provider's name
  from the entry data.
- Next work (separate decision): self-registration of wallet providers in the sandbox, and an automatic conformance test where a
  wallet developer gives their address and the sandbox tests the wallet against the rules by itself.

# Status

**Accepted — 2026-10-06** (project management approval; the verbatim quote is in the private approval record). DECISIONS:
D-GOV-9. Changes the part of [[ADR-0038]] where the network runs the sandbox's test wallet provider (K3).
