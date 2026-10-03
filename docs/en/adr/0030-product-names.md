---
document_id: ADR-0030
title: "Product names"
status: Active
version: 1.0.0
created: 2026-09-30
last_updated: 2026-10-02
summary: >
  The product names users see are fixed: the wallet app is Tamga Wallet, website sign-in is "Sign in with Tamga" (Turkish "Tamga
  ile giriş yap"), the hosted verifier is Tamga Verify. "TamgaID" is not used as a product name. Replaces the sentence in D-OSS-2
  that the user-facing brand ("Sign in with TamgaID") would not change.
domain: Governance
translation_of: ADR-0030
source_version: 1.0.0
---

# Context

When D-OSS-2 (2026-09-27) set the npm scope to `@tamga-network`, it referred to the user-facing brand as "Sign in with TamgaID".
The same name also appeared on the site as the name of the wallet. However:

- The wallet app has been called **Tamga Wallet** from the start (store name, package id `network.tamga.wallet`).
- `id.tamga.network` and the `tamga-id` tenant are a separate service: the provisional identity [[t:attestation]] service
  ([[ADR-0011]]).
- The wallet does not carry identity only: institutional credentials, tickets and, later, payment and asset functions may live in
  the same app. Calling the product "ID" limits it to identity.

One name standing for three different things (wallet, sign-in, identity service) confuses users and institutions.

# Decision

Three user-facing product names are fixed: the wallet **Tamga Wallet**, web sign-in **"Sign in with Tamga"**, the hosted
[[t:verifier]] **Tamga Verify**. "TamgaID" is not used as a product name.

# Invariants

| Code | Rule |
|---|---|
| PN1 | The wallet app is called **Tamga Wallet** everywhere (tk: Tamga Wallet). |
| PN2 | The website sign-in button and flow are **"Sign in with Tamga"** / "Sign up with Tamga" (tr "Tamga ile giriş yap" / "Tamga ile kayıt ol"; tk "Tamga bilen gir" / "Tamga bilen hasaba dur"). The button's appearance is on the brand page (`tamga.network/brand`). |
| PN3 | The hosted verifier (intermediary verifier, [[ADR-0017]]; `verify.tamga.network`) is called **Tamga Verify**. |
| PN4 | "TamgaID" is not used as a product name. Code and data identifiers (`tamga-id` tenant, `id.tamga.network`, `urn:tamga:id:*`) do not change; they are addresses, not names. |

# Rationale / alternatives

| Option | Result | Why |
|---|---|---|
| Naming the wallet TamgaID | rejected | It sounds good for "Sign in with Tamga", but the name loses its meaning once the wallet's payment and asset functions arrive. |
| "Sign in with TamgaID", wallet Tamga Wallet | rejected | Two names for one product; confused with the identity service. |
| **Wallet Tamga Wallet, sign-in "Sign in with Tamga", verifier Tamga Verify** | **accepted** | One product, one name; the sign-in button carries the brand without limiting the product. |

# Consequences

- "TamgaID" is not used on the site, in the documentation, on the verify pages, in examples or in the glossary.
- The brand sentence in D-OSS-2 is changed by this ADR (DECISIONS §9b).
- Package names do not change (`@tamga-network/verifier`, `/web`).

# Status

**Accepted — 2026-09-30.** Approved by project management.
