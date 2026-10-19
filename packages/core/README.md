# @tamga-network/core

Shared building blocks for Tamga: SHA-256 / keccak-256, base64url and PEM helpers, and the identifier derivations every other package uses (`issuer_id`, `ca_id`, `schema_id`).

## Install

```sh
npm install @tamga-network/core
```

## Usage

```ts
import { computeIssuerId, computeSchemaId, certFingerprintSha256Hex, pemToDer } from "@tamga-network/core";

const der = pemToDer(institutionCertPem);
const issuerId = computeIssuerId("TR", der);            // keccak256(state ‖ SHA-256(certificate))
const schemaId = computeSchemaId("urn:tamga:edu:DiplomaCredential:1");
const fingerprint = certFingerprintSha256Hex(der);
```


## Time units (0.7.0)

`EpochSeconds` and `EpochMillis` keep Unix seconds and milliseconds apart: verification functions take `now` with its unit, so
`Date.now()` cannot reach a function that expects seconds (compile error, and a `RangeError` at run time). Create values with
`epochSeconds(n)`, `epochMillis(n)`, `nowSeconds()`, `nowMillis()`; for React Native import from `@tamga-network/core/time`.
Clock skew options are capped at `MAX_CLOCK_SKEW_SEC` (600 s).

## Status

Published on npm as the `0.6.0` test release; the stable `1.0.0` comes when everything is ready. In test releases the API
may change. Every release is built from this repository by GitHub Actions and carries npm provenance (verifiable link to
the source commit).

## Links

- Working examples, run in CI against the real packages: [`examples/`](https://github.com/tamga-network/tamga-network/tree/main/examples)
- Integration guides and specifications: [docs.tamga.network](https://docs.tamga.network/guides/)
- Code: Apache-2.0 · Documentation: CC BY 4.0
