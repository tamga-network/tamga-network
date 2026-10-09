# Tamga Network

Tamga Network is a not-for-profit digital trust network for Türkiye and the Turkic world, built on the EU digital identity
profiles (eIDAS 2.0 / EUDI). Institutions issue credentials to a person's wallet, the person shares only the fields that are
asked for, and a verifier checks the credential in seconds without contacting the issuer. Trust is anchored in signed,
versioned trust lists (ETSI TS 119 612 model) and a public anchor log; no personal data is ever written to them.

This repository holds the open-source `@tamga-network/*` packages, the reference verifier, the trust list publisher and the
sources of the documentation and framework sites.

| | |
|---|---|
| Website | [tamga.network](https://tamga.network) |
| Developer docs | [docs.tamga.network](https://docs.tamga.network) · API reference: [docs.tamga.network/api](https://docs.tamga.network/api/) |
| Architecture and Reference Framework | [arf.tamga.network](https://arf.tamga.network) |
| Sandbox test network | [sandbox.tamga.network](https://sandbox.tamga.network) |
| Security | [SECURITY.md](SECURITY.md) · security@tamga.network |

## Packages

Published on npm as the **0.4.0 test release** — the API may change until the stable 1.0.0.

| Package | What it does |
|---|---|
| `@tamga-network/core` | Shared building blocks: digests, identifiers, certificate helpers |
| `@tamga-network/trust` | Loads and verifies the signed trust lists; one read interface, `TrustSource` |
| `@tamga-network/schemas` | Credential type catalogue: type metadata, JSON Schema, integrity digests |
| `@tamga-network/sd-jwt` | SD-JWT VC: selective disclosure, key binding, status list |
| `@tamga-network/mdoc` | ISO/IEC 18013-5 mdoc: CBOR, COSE, issuance and verification |
| `@tamga-network/issuer` | Issuance (OpenID4VCI) and status list publishing; `/client` for the hosted issuer |
| `@tamga-network/verifier` | Verification pipeline and OpenID4VP; `/web` page kit, `/zk` zero-knowledge proof verification |
| `@tamga-network/wallet-core` | Wallet core for Node and React Native: keys, receiving, local checks, presentation |
| `@tamga-network/zk` | Wallet-side zero-knowledge prover for mdoc (Longfellow ZK) |

```sh
npm install @tamga-network/verifier @tamga-network/trust
```

## Repository layout

```
packages/      the @tamga-network/* packages
apps/          verify (reference verifier, verify.tamga.network) · trust-publisher (trust.tamga.network)
examples/      four runnable examples, run with the test suite
conformance/   conformance vectors
tools/         zk-circuit: reproducible build of the zero-knowledge circuits referenced in the trust list
docs/          sources of docs.tamga.network (guides, concepts, specifications, decision records, API)
arf/           sources of arf.tamga.network
ops/           development PKI generator, sandbox certificates, brand assets
```

## Build and test

Requires Node.js 22 or later.

```sh
npm install
npm run setup       # development PKI, schema catalogue and trust lists (local only; keys never leave your machine)
npm test            # unit, integration, conformance and example tests
npm run typecheck
npm run docs:dev    # local preview of docs.tamga.network
```

## Contributing and license

See [CONTRIBUTING.md](CONTRIBUTING.md). Code is licensed under Apache-2.0 ([LICENSE](LICENSE)); documentation under
CC BY 4.0 ([LICENSE-docs](LICENSE-docs)). Release notes: [CHANGELOG.md](CHANGELOG.md).
