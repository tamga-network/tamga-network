# Security Policy

## Reporting

Email **security@tamga.network**. Please do not open a public issue. We reply within 72 hours and follow coordinated
disclosure with a 90-day window.

## Scope

- This repository: the `@tamga-network/*` packages, `apps/` and the trust list format.
- The running services: `trust.tamga.network`, `schemas.tamga.network`, `status.tamga.network`, `issuer.tamga.network`,
  `verify.tamga.network`, `id.tamga.network`, `console.tamga.network` and the sandbox test network
  (`sandbox.tamga.network`, `*.sandbox.tamga.network`).

Out of scope: wallets listed on the network (including Tamga Wallet and its provider service) — please report those to the
wallet's operator.

## Known limitations before the pilot

These are deliberate and recorded; there is no need to report them, but a finding that shows their impact is welcome.

- Institution signing keys are held in Tamga's development environment; in the pilot they move to the institution's own KMS
  or HSM.
- The trust list is published with a single signing key; a rolling second key is added before the pilot.
- In this stage the trust anchor rests on a single operator's signature: the public anchor log makes a rollback visible but
  does not prevent it.
- While the status server is up, a revocation reaches verifiers within a few minutes (2-minute publication interval plus
  the verifier's prefetch interval); a status list token is valid for 6 hours.
- The revocation of an identity credential presented with a zero-knowledge proof cannot be checked in the presentation.
  The decision is short-lived copies valid for at most 24 hours (ADR-0044); until that is implemented, verifiers accept such
  a presentation only when their policy explicitly sets `accept_unrevocable_zk`.
- Presentations of the same credential can be linked if verifiers collude; zero-knowledge age proofs are live on the
  verifier side and arrive on the wallet side with the phone builds.
- No independent security audit has been performed yet.

Keys under `ops/pki/` are for development only and are never used in production.

## Supply chain

The packages have no `postinstall` scripts. npm releases are published only from CI, with OIDC trusted publishing and
provenance. Dependency advisories are tracked with `npm audit`.
