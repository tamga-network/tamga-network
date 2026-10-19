# @tamga-network/verifier

The canonical verification pipeline (T0 + A–E) with three outcomes — ACCEPTED, REJECTED (with the failing step), INDETERMINATE ("could not check right now"). Signed OpenID4VP requests, encrypted answers, revocation-list pre-fetching, and the assertion a site uses with the hosted verifier. The `/web` subpath is the page kit (QR code, "open in wallet", passkeys).

## Install

```sh
npm install @tamga-network/verifier
```

## Usage

```ts
import { createPresentationRequest, decryptResponse, verifyPresentation } from "@tamga-network/verifier";

const req = await createPresentationRequest({ signer, dcql, responseUri, requestUriBase }); // req.qrPayload → QR
const answer = await decryptResponse(jweFromWallet, req.encPrivateKey);
const { result, claims } = await verifyPresentation({ presentation: answer.vp_token.diploma[0], aud: signer.clientId,
  nonce: req.nonce, policy, policyCredentialId: "diploma", trust, statusCache, rootCertsDer,
  rp: trust.relyingParty(signer.clientId), audit: (entry) => log(entry) });
```

A complete, tested version: [`examples/02-verify-own-server`](https://github.com/tamga-network/tamga-network/tree/main/examples/02-verify-own-server).


## Secure defaults (0.7.0)

- `verifyPresentation` requires `rp`: the relying party's registration, `null` for an unregistered party (rejected), or `"none"`
  to skip the scope check (E3) deliberately. E4 is reported as performed only when you pass an `audit` function.
- `isYes(output, "age_over_18")` reads a yes/no attribute safely: `true` only for an ACCEPTED result whose value is exactly `true`.
- `PassRegistry.issue({ verified, presentationId, policy })` takes the ACCEPTED output of `verifyPresentation` itself; anything
  else (rejected, hand-made or modified) throws.
- `verifyPseudonym` requires `walletStatusOf` (or `"none"`); the result carries `clientStatus`.
- A credential without a status entry is rejected at D1 when its type uses a status list; the status list signer is pinned to the
  institution's registered status keys.

## Status

Published on npm as the `0.7.0` test release; the stable `1.0.0` comes when everything is ready. In test releases the API
may change. Every release is built from this repository by GitHub Actions and carries npm provenance (verifiable link to
the source commit).

## Links

- Working examples, run in CI against the real packages: [`examples/`](https://github.com/tamga-network/tamga-network/tree/main/examples)
- Integration guides and specifications: [docs.tamga.network](https://docs.tamga.network/guides/)
- Code: Apache-2.0 · Documentation: CC BY 4.0
