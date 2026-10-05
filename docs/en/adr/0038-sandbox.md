---
document_id: ADR-0038
title: "Sandbox: the test network"
status: Active
version: 1.0.0
created: 2026-10-03
last_updated: 2026-10-04
summary: >
  Tamga Network runs a test network that is completely separate from the real network: sandbox.tamga.network. It has its
  own test root certificate, its own trust list, example institutions, fake people and example credentials of every type.
  Wallet developers, institutions and verifiers try the whole flow end to end there. No wallet or verifier of the real
  network trusts the sandbox; the sandbox holds no real personal data and its data can be reset at any time.
domain: Trust
translation_of: ADR-0038
source_version: 1.0.0
---

> **Partly changed by [[ADR-0040]] and [[ADR-0041]] (2026-10-04):** real identity verification steps can be tried in the
> sandbox only with an invitation code and with minimal data (K4 and SB3 changed); institutions can open their own test
> institution and try it in the Institution Console, which runs again in the sandbox ("no console" in K1 and institutions'
> self-registration in K7 changed). The other points stay in force.

# In brief

Before a wallet, an institution or a verifier joins the network, it wants to try everything. Today that means either
setting up a local test environment on one's own computer or using the real services. There are also no institutions with
an official agreement yet; end-to-end testing needs example institutions and example credentials.

This decision opens a separate test network next to the network: sandbox.tamga.network. Everything there behaves like the
real thing; only the trust root, the keys, the lists and the data are separate and fake.

# Context

- [[ADR-0037]] says the network runs reference services "so that the network works, can be tried out and institutions can
  join". A test network falls within that definition; it is not sold and is open to everyone on the same terms.
- Joining the network depends on [[t:conformance]] (Tamga ARF, Trust Framework §4.3). The most natural way to test
  conformance is an environment that behaves like the real network but never touches it.
- In the EU, too, wallets and verifiers are tested in environments separate from the real trusted lists and at
  interoperability events.
- Today's local development environment (development PKI, local trust lists) runs on a single computer only; a wallet on a
  phone, another institution's server or a verifier cannot reach it.

# Decision

**K1 — A separate test network.** Tamga Network runs a test network separate from the real network. Its address is
`sandbox.tamga.network` (landing page and guide); the services inside sit on sub-names of that address in the same layout
as the real network: `trust.sandbox`, `issuer.sandbox`, `status.sandbox`, `verify.sandbox`, `wallet.sandbox`, `id.sandbox`
(`….sandbox.tamga.network`). The services therefore behave as in the real network; a wallet or verifier switches by changing
only the domain. The institution console does not run in the sandbox: example institutions, people and permissions come from
seed data.

**K2 — Complete separation.** The sandbox has its own test root certificate, its own signing keys and its own list of
trusted lists ([[t:LOTL]]). The sandbox list marks itself clearly as "test". The real network's root signs nothing in the
sandbox; the sandbox root appears in no list of the real network. Wallets and verifiers of the real network do not trust
the sandbox; a wallet connects to the sandbox only when explicitly switched in a developer setting, and shows it on screen.

**K3 — Visible marking.** Every credential issued in the sandbox carries that it is a test credential (the test
institution's name and the test list); sandbox pages and wallet screens show a "Sandbox · test" mark. A sandbox credential
cannot be used in a real transaction, because a real verifier does not recognise its root.

**K4 — Fake data only.** The institutions, people and credentials in the sandbox are examples. No real personal data is
entered; identity verification uses a fake provider. The example people's identity numbers are clearly fake.

**K5 — Resettable.** Sandbox data returns to its initial state whenever needed, and regularly on its own. Nothing in the
sandbox is expected to persist.

**K6 — Content.** The sandbox contains at least: test lists and the anchor log; at least one example institution per
credential type (education, identity, event ticket, contact credentials); example people; a test verifier and example
verification pages ("Sign in with Tamga", age check, diploma check, ticket gate); a test wallet provider; a usage guide.
The example institutions may carry real institution names to make the tests realistic. In that case every sandbox page and
the usage guide state clearly that the names are used only to make the test environment realistic, that there is no
relationship or agreement with these institutions, and that the credentials are signed with a test key and are therefore not
valid anywhere; the institutions' logos are not used.

**K7 — Later steps need their own decision.** External participants adding their own institutions, verifiers or wallet
providers to the sandbox list themselves (self-service registration), and a conformance service that tests wallets
automatically and reports, are later stages; each is decided separately before it opens.

# Invariants

| Code | Rule |
|---|---|
| SB1 | The sandbox root certificate and the sandbox list signers appear in no list of the real network; the real network's root and signing keys sign nothing in the sandbox. |
| SB2 | The sandbox list of trusted lists marks itself as test; a wallet or verifier configured for the real network does not accept the sandbox list. |
| SB3 | In the sandbox, identity verification uses a fake provider by default and example identity numbers have an invalid form; a real person's data enters only through the invited path of [[ADR-0040]] and within its limits (the real identity and document numbers are not written into the credential, the provider session is deleted once the credential is issued, everything is deleted at the nightly reset). |
| SB4 | Every credential issued in the sandbox and every screen connected to the sandbox visibly states that it is a test. |
| SB5 | Sandbox data can be reset at any time; no process connected to the sandbox assumes persistence. |

# Rationale and alternatives

| Option | Outcome | Why |
|---|---|---|
| Local development environment only | rejected | A wallet on a phone, other institutions' servers and verifiers cannot reach it; no end-to-end testing. |
| "Test" institutions in the real network | rejected | Test credentials would be valid at real verifiers; the trust list would be polluted. |
| **Test network with its own root and lists** | **accepted** | Behaves like the real network but cannot mix with it by any path; everyone tests in the same environment. |
| Paths under one address (`sandbox.tamga.network/issuer/…`) | rejected | The services are written to run at the root of their address (page links, redirects, cookies, well-known addresses); a path prefix needs separate adaptation in every service and behaves differently from the real network. |
| **One sub-name per service under `sandbox.tamga.network`** | **accepted** | Same layout as the real network; service code does not change. |

# Consequences

- The sandbox runs the real network's services (list publisher, issuer, verifier, wallet provider, identity service) with
  separate settings, separate keys and a separate database. There is no institution console in the sandbox; example
  institutions, people and permissions are set up from seed data and return to their initial state at every reset.
- Tamga Wallet and any wallet that follows the network's rules can switch to the sandbox in a developer setting; the sandbox
  root is kept separately inside the wallet and never mixes with the real root.
- A "Sandbox" guide is added to the developer docs, a short explanation to Learn, and a note to the ARF stating that the test
  network is not part of the real network.
- Automated wallet analysis and conformance reports are handled separately later.

# Status

**Accepted — 2026-10-03** (project management approval; the verbatim quote is in the private approval record). K4 and SB3
changed with [[ADR-0040]] (invited real identity verification); "no institution console" in K1 and institutions'
self-registration in K7 changed with [[ADR-0041]] (institution test accounts) (2026-10-04).
