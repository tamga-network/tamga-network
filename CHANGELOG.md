# Changelog — tamga-network

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Packages follow SemVer; they are published on npm as a
pre-release (`0.x`), so their interfaces may still change before `1.0`.

## [Unreleased]

### Changed

- `wallet-core`: DCQL options (OpenID4VP 1.0 §6). `claim_sets` — only the first combination the wallet can satisfy is
  requested; other claims are not disclosed. `credential_sets` — new `selectDcql` / `chooseDcqlOption`: one option per
  required set (verifier's order, user may switch), optional sets are not shared unless the user opts in, queries outside the
  chosen options are not presented. `checkDcqlShape` rejects malformed queries (duplicate ids, missing claim ids, unknown ids).
  Previously both structures were ignored: every listed credential and claim was treated as required.
- `wallet-core`: a credential is never presented with missing claims (OpenID4VP 1.0 §6.4.1; SPEC-PROTO-0002 1.1.0, PV12).
  Without `claim_sets`, a credential that lacks any requested claim no longer satisfies the query (previously it was sent
  without the missing claim). `matchDcql` returns `gaps` — why each unmatched query failed (`no_credential`,
  `missing_claims` with the claim names, `values`) — so the wallet can tell the user. `Match.missing` is removed. Verifiers
  ask for a claim the credential may not carry with `claim_sets`.

## [1.0.0] — 2026-10-02

First release of the Tamga Network documentation set and reference implementation.

### Documentation

- Tamga ARF 1.0: the Architecture and Reference Framework, Annex A — Trust Framework, Annex B — Tamga Rulebook with the
  credential-type rulebooks (Education, Identity, Event Ticket), Annex D — Definitions, Annex E — References.
- Developer docs in English and Turkish: guides, concepts, specifications (credential format, SD-JWT VC, OpenID4VCI,
  OpenID4VP, verification pipeline and API, trust lists, status list, X.509 institutional identity, identity proofing,
  schema catalogue, wallet rules), architecture decisions (ADR-0001 … ADR-0036) and a glossary.

### Packages (`@tamga-network/*`, pre-release `0.x`)

- `core`, `trust`, `schemas`, `sd-jwt`, `mdoc`, `issuer` (+ `/client`), `verifier` (+ `/web`, `/zk`), `wallet-core`.

### Services

- Trust list publisher (`trust.tamga.network`), reference verifier (Tamga Verify, `verify.tamga.network`), wallet provider
  (`wallet.tamga.network`; moves to the Tamga Wallet repository).
