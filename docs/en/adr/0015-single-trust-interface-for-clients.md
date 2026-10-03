---
document_id: ADR-0015
title: "Single trust interface"
status: Active
version: 1.0.0
created: 2026-09-27
last_updated: 2026-10-02
summary: >
  Services ask trust questions through one interface (`TrustSource`, @tamga-network/trust); the wallet cannot use that
  package in React Native, so it repeats the same list verification inside `wallet-core`. Decision: the verification core
  of `@tamga-network/trust` is split into a platform-independent subpath (plain TS, no node:fs, no jose); every client,
  including the wallet, uses the same interface. In the chain stage the chain source (`ChainTrustSource`) sits behind the
  same interface. This document writes the migration plan; it does not implement it.
domain: Trust
translation_of: ADR-0015
source_version: 1.0.0
---

# Context

When the working infrastructure was set up (2026-09-27) the goal was: clients connect neither to the beta nor to the chain
directly, but to a common identity/trust interface. In Tamga this interface **already exists**: `TrustSource` ([[ADR-0009]]
K3, BT4) — signed [[t:trust-list]]s in phase B (`ListTrustSource`), the chain in phase 0 (`ChainTrustSource`). The beta is
not a database but a set of signed list files; clients (the wallet) never connect to a database, they talk to services over
standard protocols ([[t:OpenID4VCI]]/VP).

The only deviation found is on the wallet side. `@tamga-network/trust` depends on `node:fs`, `jose` and `zod`, so it is not
used in Expo/React Native; while closing S-13 the same verification was written again in `wallet-core`. Places that
interpret the list outside the interface today:

| File | What it does |
|---|---|
| `packages/wallet-core/src/trustlist.ts` | `lotl.jws` + `tl-<cc>.jws` signature verification, `next_update`, rollback (a separate implementation) |
| `packages/wallet-core/src/directory.ts` | reads raw `issuers[]` fields (`issuer_url`, `schema_authorizations`, `category`) to build the institution directory |
| `packages/wallet-core/src/oid4vp.ts` (`fetchRpRecord`) | picks the RP entry from `relying_parties[]` |

Services (`apps/verify`, `apps/issuer` (operator repository), `apps/id`) go through the interface (they read the file and pass it to
`loadTrustSet`).

Risk: the two verification implementations drift apart over time (e.g. the TL12 checkpoint, new fields); in the chain stage
the wallet cannot switch to the chain source because it is tied to the list format.

# Decision

1. **K1 — Portable core.** The verification logic of `@tamga-network/trust` (JWS verification, list rules, `TrustStore`,
   `TrustSource` queries) moves to a subpath that needs no `node:fs`/`jose`/`zod`: `@tamga-network/trust/core` (signatures
   with `@noble/curves`, schema validation by hand or lightweight). The existing Node entry point (`fs.ts`,
   `guardedReload`) stays on the main path.
2. **K2 — Client source.** Instead of `trustlist.ts`/`directory.ts`/`fetchRpRecord`, `wallet-core` uses an
   `HttpListTrustSource` from `trust/core` (fetches over HTTP, verifies against an embedded pin); the institution directory
   and the [[t:RP]] entry come from `TrustSource` queries (`issuers()`, `relyingParty()`).
3. **K3 — Same interface in the chain stage.** `ChainTrustSource` is used directly in services; in the wallet it sits behind
   the same interface (a list mirror or a light indexer) instead of direct RPC — the wallet code does not change.

# Rationale / alternatives

- **Keep today's state:** least work, but against the spirit of BT4, and the wallet would need a separate overhaul when
  moving to the chain.
- **Node polyfills in the wallet:** `jose`/`zod` partly work in React Native, but `node:fs` and bundle size are problems;
  fragile.
- **A separate "identity service" (a server-side trust proxy):** having the wallet ask every trust question to a Tamga
  server creates traceability (which institution it asked about and when) — against the privacy principle; rejected.

# Invariants

| # | Invariant |
|---|---|
| **TS1** | Every client and service asks trust questions only through the `TrustSource` interface; the list/chain format is not interpreted outside the interface (BT4 extended to clients). |
| **TS2** | List verification rules live in one implementation (`trust/core`); no other package keeps a copy. |
| **TS3** | A client makes no call to Tamga that could be linked to the user in order to answer a trust question; lists are fetched in bulk. |

# Migration plan

1. Extract the `trust/core` subpath; the existing `trust` tests and the `conformance/` vectors pass on both entry points.
2. `HttpListTrustSource` + embedded pin; move the `wallet-core` tests (`trustlist.test.ts`, 7 tests) to the new source.
3. Switch `directory.ts` and `fetchRpRecord` to `TrustSource` queries; remove the old `trustlist.ts`.
4. Metro iOS bundle trial (size, `@noble/*` compatibility); device test.
5. Chain stage: the same contract tests with `ChainTrustSource`.

# Status

**Accepted — 2026-09-27.** DECISIONS: D-TRUST-1.

Implementation: the migration plan above.
