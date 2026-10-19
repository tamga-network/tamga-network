# @tamga-network/trust

Signed trust lists (who may issue which document, since when, and their status) behind one `TrustSource` interface. Verifies the list of lists, the national lists and the public anchor log; answers in three values (YES / NO / UNKNOWN). `@tamga-network/trust/core` is the platform-independent core (React Native too). Wallet unit attestation checks (`verifyWalletAttestation`, WUA/WIA) live here too.

## Install

```sh
npm install @tamga-network/trust
```

## Usage

```ts
import { fetchListTrustSource, verifyJws } from "@tamga-network/trust";

const { source } = await fetchListTrustSource("https://trust.tamga.network", httpGet, {
  rootFingerprints: PINNED_ROOTS, // from tamga.network/trust-anchor, fixed in your configuration
  verifyJws,
});
source.issuers();                                // registered institutions
source.relyingPartyByDnsName("example.com");      // a verifier's registration (permanent domain) and allowed fields
source.relyingParty("x509_hash:…");                // the same record, by the request's client_id (HAIP 1.0)
source.isCredentialAcceptable(issuerId, iat);    // "YES" | "NO" | "UNKNOWN" — judged on the issue date
```

A complete, tested version: [`examples/04-check-institution`](https://github.com/tamga-network/tamga-network/tree/main/examples/04-check-institution).


## Secure defaults (0.7.0)

- `verifyWalletAttestation` requires `statusOf` (or `"none"` to skip the revocation check deliberately); results carry
  `statusChecked`.
- Rollback protection is on by default: a load without `versionMemory` uses an in-process memory per network and root fingerprints;
  pass a persistent memory to keep it across restarts, or `"none"` to turn it off.

## Status

Published on npm as the `0.6.0` test release; the stable `1.0.0` comes when everything is ready. In test releases the API
may change. Every release is built from this repository by GitHub Actions and carries npm provenance (verifiable link to
the source commit).

## Links

- Working examples, run in CI against the real packages: [`examples/`](https://github.com/tamga-network/tamga-network/tree/main/examples)
- Integration guides and specifications: [docs.tamga.network](https://docs.tamga.network/guides/)
- Code: Apache-2.0 · Documentation: CC BY 4.0
