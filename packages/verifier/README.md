# @tamga-network/verifier

The canonical verification pipeline (T0 + A–E) with three outcomes — ACCEPTED, REJECTED (with the failing step), INDETERMINATE ("could not check right now"). Signed OpenID4VP requests, encrypted answers, revocation-list pre-fetching, and the assertion a site uses with the hosted verifier. The `/web` subpath is the page kit (QR code, "open in wallet", passkeys).

## Install

```sh
npm install @tamga-network/verifier
```

## Usage

```ts
import { BranchRegistry, BranchSet, createPresentationRequest, openPresentationResponse, responseKidOf,
  verifyPresentation } from "@tamga-network/verifier";

const registry = new BranchRegistry(); // one per process: state lookup + branch memory budget
const content = { signer, dcql, responseUri, registrationCert };
const req = await createPresentationRequest({ ...content, requestUriBase, initialRequestObject: false }); // req.qrPayload → QR
const branches = new BranchSet({ registry, presentationId: req.presentationId, expiresAt: req.expiresAt, content });

// GET|POST /vp/req/:id — every fetch gets its own request object (fresh state, nonce, encryption key)
const f = await branches.fetch(walletNonce); // f.ok → send f.requestJwt

// POST /vp/response with `response` — lock BEFORE decrypting, check again after
const branch = branches.get(responseKidOf(jwe)!.branchId!);
if (branch && branches.begin(branch) === "ok") try {
  const opened = await openPresentationResponse(jwe, req, responseUri, (id) => (id === branch.branchId ? branch : undefined));
  if (opened.kind === "response" && branches.isOpen(branch) && branches.stateMatches(branch, opened.response.state)) {
    const { result, claims } = await verifyPresentation({ presentation: opened.response.vp_token.diploma[0],
      aud: signer.clientId, nonce: branch.nonce, policy, policyCredentialId: "diploma", trust, statusCache, rootCertsDer,
      rp: trust.relyingParty(signer.clientId), audit: (entry) => log(entry) });
    if (result.checks_performed.includes("A6")) branches.consume(); else branches.failedAttempt(branch);
  }
} finally { branches.end(branch); }

// POST /vp/response with `error` + `state` (the person declined) — closes only that branch
const hit = registry.byState(state);
if (hit && !hit.set.busy) hit.set.decline(hit.branch); // { presentationRejected } — true only with a single fetch
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

## New in 0.7.4

- Access passes carry their gate policy: `PassPolicy.policy_id` → `PassRecord.policyId`; `PassRegistry.verifyToken(token, { terminalGroup, policyAllowed })` refuses a pass from a policy that is not allowed, before it is consumed (the gate checks the trust list's `allowed_policies`).
- `registrationScopesFor` matches the presentation format (`dc+sd-jwt`, `mso_mdoc`, `mso_mdoc_zk`). See the CHANGELOG section "Breaking / behaviour changes in 0.7.4".
- **Request branches (ADR-0067).** `BranchSet` / `BranchRegistry` is the verifier-side state machine for `request_uri`: every
  fetch is a new branch (fresh 128-bit `state`, `nonce`, ephemeral encryption key; POST `wallet_nonce` echoed); a decline closes
  only its own branch (the presentation is REJECTED only after a single fetch); attempts count per branch; the single-use lock
  (`begin` / `end`) is taken before decrypting and `isOpen` re-checks after. Branches keep no signed object and only the hash of
  `state` (looked up by hash, compared in constant time). There is no fixed branch limit: past a soft limit (10) the oldest
  never-answered branch older than 120 s is evicted, at the hard ceiling (32) regardless of age, never a branch whose response is
  being processed; `BranchRegistry` caps branches across presentations (20,000). Rate-limit fetches per client address, not per
  presentation.
- `createPresentationRequest({ …, initialRequestObject: false })` returns a `PresentationSession` without the shared
  cross-device request object (`requestJwt`, `encPrivateKey`, `encPublicJwk`, `encJwkThumbprint`): one signature and one key
  generation less per presentation. The default (`true`) is kept for 0.7.x compatibility and is deprecated.
- `openPresentationResponse` / `decryptPresentationResponse` accept any branch with `branchId`, `encPrivateKey`,
  `encJwkThumbprint` (`BranchKeys`), so `BranchSet` branches work directly; with `initialRequestObject: false`, a response
  whose `kid` names no branch is rejected.

### Migrating from one shared request object (0.7.3 and earlier)

1. Open presentations with `initialRequestObject: false` and create one `BranchSet` per presentation (one `BranchRegistry` per
   process).
2. Serve `GET` and `POST /vp/req/:id` with `branches.fetch(walletNonce)`; never serve `req.requestJwt`. Rate-limit this route per
   client address.
3. On a response: find the branch from the JWE `kid` (`responseKidOf`), call `begin(branch)` before decrypting, check `isOpen` and
   `stateMatches` after, use `branch.nonce` for `verifyPresentation`, and `consume()` only once A6 has passed (otherwise
   `failedAttempt(branch)`). Do not delete the pending presentation before decrypting: an undecryptable answer must change
   nothing.
4. On a decline (`error` + `state`): `registry.byState(state)` → `decline(branch)`; answer 200 and store no reason.
5. When you drop a presentation from memory, call `branches.dispose()`.

## Status

Published on npm as the `0.7.4` test release; the stable `1.0.0` comes when everything is ready. In test releases the API
may change. Every release is built from this repository by GitHub Actions and carries npm provenance (verifiable link to
the source commit).

## Links

- Working examples, run in CI against the real packages: [`examples/`](https://github.com/tamga-network/tamga-network/tree/main/examples)
- Integration guides and specifications: [docs.tamga.network](https://docs.tamga.network/guides/)
- Code: Apache-2.0 · Documentation: CC BY 4.0
