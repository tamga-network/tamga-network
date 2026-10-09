# Changelog — tamga-network

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The documents (docs, ARF) are 1.0.0 until the public
announcement; changes before it are folded into this release. The `@tamga-network/*` packages are versioned separately: they
are published on npm as the `0.2.0` test release (the API may change in test releases); the stable `1.0.0` comes when
everything is ready.

## [1.0.0] — 2026-10-04

First release of the Tamga Network documentation set and reference implementation.

### 2026-10-09 — API reference and repository layout

- docs.tamga.network/api is part of the docs site (same theme, navigation and search, English and Turkish): an overview of
  every public HTTP interface and one reference page per API, generated from the OpenAPI 3.1 files at build time. The YAML
  files stay downloadable under /api/.
- New OpenAPI definitions for the public registries: trust lists, status lists, schema catalogue. The Tamga Verify definition
  matches the service (`spec_version`, `sdk_version`, `freshness`, `status.reason`, QR image and page kit endpoints).
- The public repository contains only what is needed to build and test the packages and services and to build the two sites;
  the root documents are in English.

### 2026-10-08 — packages: 0.2.0 test release

- The `@tamga-network/*` packages are versioned `0.2.0` (test release); later test rounds are `0.2.x`/`0.3.0`, and `1.0.0`
  comes when everything is ready. The verification result's `sdk_version` is `@tamga-network/verifier@0.2.0`.

### 2026-10-08 — no age limit

- The network sets no age limit, neither for listed wallets nor for the identity service; the condition is identity
  verification with a valid identity document, and each issuer decides eligibility for its own credentials.

### 2026-10-07 — hardening

- Packages: externally signed lists with JAdES `crit` load (federation); an array element request discloses only that
  element; expired credentials fail at step A7; status lists have size limits, a required `exp` and a bound on future `iat`;
  WUA/WIA `exp` is required; list version memory and `previous_version_hash` check; stricter intermediate certificate checks;
  only active ZK circuits are accepted; stricter mdoc and COSE handling.
- Protocol: intermediary rule checked in the wallet in both directions; pass token `iat`/`exp` bounds; a ZK infrastructure
  failure is INDETERMINATE and WASM runs in a separate worker; PAR `redirect_uri` allowlist; request object `exp`/`aud`
  checks; size limits; `release.yml` input injection closed.
- Services: only referenced certificates are published under `keys/`; result details only with the status token; rate limits
  (429 + `Retry-After`); sandbox PKI and lists in setup and CI.

### Documentation

- Tamga ARF 1.0: the Architecture and Reference Framework, Annex A — Trust Framework, Annex B — Tamga Rulebook with the
  credential-type rulebooks (Education, Identity, Event Ticket), Annex D — Definitions, Annex E — References, and the
  supporting pages Reading path, Roles and Onboarding.
- Developer docs in English and Turkish: guides (including the sandbox test network), concepts, specifications (credential
  format, SD-JWT VC, OpenID4VCI, OpenID4VP, verification pipeline and API, trust lists, status list, X.509 institutional
  identity, identity proofing, schema catalogue, wallet rules), decision records and a glossary.
- Sandbox: real identity verification steps, open to everyone with daily/monthly caps, and institution test accounts.

### Packages (`@tamga-network/*`, 0.2.0 test release)

- `core`, `trust`, `schemas`, `sd-jwt`, `mdoc`, `issuer` (+ `/client`), `verifier` (+ `/web`, `/zk`), `wallet-core`, `zk`.
- `zk`: wallet-side zero-knowledge proofs (Longfellow ZK) for mdoc — `/node` desktop prover, `/react-native` module (Android
  libraries for arm64-v8a, armeabi-v7a, x86_64; iOS pending). Its proofs pass `verifier/zk` end to end.
- `wallet-core`: wallet-generic parts only (WUA/WIA types, client attestation PoP, WIA status checks); DCQL `claim_sets` and
  `credential_sets`; a credential is never presented with missing claims (`matchDcql` returns `gaps`); key access policy
  (phone lock for credential keys, non-interactive signing for background flows); separate pass keys.
- `schemas`: `urn:tamga:id:DrivingLicenceAttestation:1` — verified driving licence information (not an official driving
  licence or mDL; the always-visible `not_official_licence` claim says so).
- `trust`: optional `test_institution` on sandbox issuer entries.
- `verifier/web`: "Open in your wallet" button.

### Services

- Trust list publisher (`trust.tamga.network`), reference verifier (Tamga Verify, `verify.tamga.network`), sandbox test network
  (`sandbox.tamga.network`).
- The network operates no wallet: the wallet provider service left this repository; trust lists keep a reserved entry for
  Tamga Wallet's provider until it supplies its certificate.
