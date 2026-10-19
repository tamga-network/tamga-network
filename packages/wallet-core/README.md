# @tamga-network/wallet-core

The wallet core, for Node and React Native (Hermes): device keys per credential copy (software or secure hardware), OpenID4VCI receiving, local verification, OpenID4VP presenting with selective disclosure — by QR, from the browser (Digital Credentials API) or in person (ISO 18013-5) — a separate copy per verifier, pass tokens, the signed trust lists and the EU wallet migration file. Pure TypeScript, no Node APIs.

## Install

```sh
npm install @tamga-network/wallet-core
```


## Secure defaults (0.7.0)

- `respond` requires the `approval` that `checkRp` returns for the same request (no approval for impersonation, an inactive
  registration or an unverified intermediary); it cannot be built by hand.
- A request without a registration certificate is rejected (`registration_missing`), remote and in proximity; wallet-to-wallet
  is unchanged.
- `checkRp`, the registration certificate checks and the disclosure policy take `now` as `EpochMillis` (`@tamga-network/core/time`).

## Status

Published on npm as the `0.6.0` test release; the stable `1.0.0` comes when everything is ready. In test releases the API
may change. Every release is built from this repository by GitHub Actions and carries npm provenance (verifiable link to
the source commit).

## Links

- Working examples, run in CI against the real packages: [`examples/`](https://github.com/tamga-network/tamga-network/tree/main/examples)
- Integration guides and specifications: [docs.tamga.network](https://docs.tamga.network/guides/)
- Code: Apache-2.0 · Documentation: CC BY 4.0
