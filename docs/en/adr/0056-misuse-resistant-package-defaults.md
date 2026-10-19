---
document_id: ADR-0056
title: "Misuse-resistant defaults in the package APIs"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-19
last_updated: 2026-10-19
summary: >
  Version 0.7.0 of the `@tamga-network/*` packages removes the defaults that let a security check be skipped: the trust anchors,
  the redirect address allowlist, the status check and the relying party registration are required inputs (an explicit `"none"`
  skips deliberately); DPoP has separate functions for the token and the resource endpoint; the status list signer is pinned; an
  mdoc without a device key is invalid; the wallet presents only with a `checkRp` approval; an access pass is issued only from an
  accepted result of the verification pipeline; a request without a registration certificate is rejected from today (replacing
  the warning-until-2028 transition of ADR-0026 K5); E4 counts as performed only when the audit record was written; seconds and
  milliseconds are distinct types. In addition: a credential whose type uses a status list but carries no status entry is
  rejected, trusted list rollback protection is on by default, clock skew options are capped at 600 s. Accepted: 2026-10-19.
domain: Trust
related: ["[[ADR-0012]]", "[[ADR-0017]]", "[[ADR-0025]]", "[[ADR-0026]]", "[[ADR-0029]]", "[[ADR-0031]]", "[[ADR-0048]]", "[[SPEC-API-0001]]", "[[SPEC-CRED-0003]]", "[[SPEC-PROTO-0001]]", "[[SPEC-PROTO-0002]]", "[[SPEC-WALLET-0001]]"]
translation_of: ADR-0056
source_version: 1.0.0
---

# In short

When a developer using our packages forgets an option, the result must not be "not checked, but passed". The security review of
2026-10-19 found twelve places in the package APIs where that was possible (for example, without trust anchors a credential was
accepted without a chain check). This decision removes those defaults: whoever wants to skip a check writes it explicitly
(`"none"`); forgetting now means rejection. The changes are breaking and ship with version 0.7.0; no compatibility layer is
written during the development stage ([[ADR-0029]]).

# Context

- The security review of 2026-10-19 (API misuse review) applied the non-breaking fixes at once (empty expected
  values, policy freshness limits, local address matching, A6/B4 reporting) and left twelve default-changing proposals for a decision.
- Two of them contradict closed decisions: [[ADR-0026]] K5 (change of 2026-10-13) provides a warning plus "Don't share" for a request
  without a registration certificate until 2028-08-11; [[SPEC-API-0001]] reported E4 ("audit record written") as performed in every
  result. This ADR changes both; the other items make mandatory in code what the specifications already require.
- On the user side, Tamga Wallet is not in the stores yet (sandbox and device tests only) and few relying parties are live on the
  verifier side; a breaking change is cheapest now.

# Decision

In every item "not given" also covers a JavaScript caller omitting the field: a caller without type checking sees the rejection too.

## K1 — `verifySdJwtVc`: trust anchors required
`rootCertsDer: Uint8Array[] | "none"` is required. An empty array or omission is rejected at A3 (`rootCertsDer missing`). `"none"`
skips the chain check deliberately (`anchorFingerprint: null`); only for a caller that checks the signer otherwise (for example the
identity service recognising its own credential by `issuerId`).

## K2 — `createPar`: redirect address allowlist required
`allowedRedirectUris` (an array or a `clientId → list` function) is required; if the list is empty or the function returns no list
for the client, the request fails with `invalid_redirect_uri` ("no redirect_uri is registered for this client"). There is no
format-check-only path any more.

## K3 — Status check required
`verifyWalletAttestation` and `verifyKeyAttestation` (`verifyKaProof`, `verifyAttestationProof`) take `statusOf`, `verifyPseudonym`
takes `walletStatusOf`: `StatusValueOf | "none"`, required. `"none"` deliberately skips the revocation check. New result field
`statusChecked: boolean` (WIA and KA); a successful `PseudonymResult` carries `clientStatus` (`VALID` | `NOT_CHECKED` | `NOT_APPLICABLE`).

## K4 — `verifyPresentation`: relying party registration required
`rp: RelyingParty | null | "none"` is required. Omission is rejected at E3; `null` is an unregistered relying party (rejected, as
before); `"none"` deliberately skips the scope check (E3), which then appears in `checks_skipped` (a party verifying on its own server
without a registered relying party).

## K5 — DPoP: two endpoints, two functions
`verifyDpop` is removed. The token endpoint uses `verifyTokenDpop` (returns the `jkt` to bind); the resource endpoint uses
`verifyResourceDpop` (`accessToken` and its bound `jkt` are required; `ath` and the key match are always checked).

## K6 — The status list signer is pinned
`verifyStatusListToken`, `verifyStatusListCwt` and `verifyStatusListAny` take `{ expectedSignerFingerprints }` as a fourth, required
argument: the SHA-256 fingerprints of the signer certificate or a function evaluating the fingerprint. A non-matching signer fails
before the signature check with `D3: status token signer is not an expected signer`. The verifier passes the institution's status key
from the trusted list, the wallet provider checker (`WalletStatusChecker`) the provider key from the list.

## K7 — `verifyIssuerSigned`: device key required
A credential whose MSO carries no `deviceKeyInfo.deviceKey` is `valid: false` ("deviceKey missing"): a credential that cannot be
bound to a person is not valid.

## K8 — The wallet presents only with a `checkRp` approval
When there is no blocking condition (no impersonation; ACTIVE if registered; for an intermediary request both registrations and the
[[ADR-0017]] K7 relationship), `checkRp` puts `approval: ApprovedRequest` into its result. `respond` requires that approval; it is
bound to the request's `client_id`, `nonce`, response address/origin, signing certificate and `onBehalfOf`, and cannot be constructed by
hand (in-process registry). Sharing with an unregistered verifier after a warning ([[SPEC-PROTO-0002]] PV2) is approved; the
registration certificate rule is K10.

## K9 — Access passes only from an accepted result
`PassRegistry.issue({ verified, … })` takes the output that `verifyPresentation` returned in this process with outcome `ACCEPTED`; the
pass key (without `pass_key`) is read from the verified presentation. A rejected, indeterminate, hand-made, copied or later modified
output throws. The `presentation` input is removed.

## K10 — A request without a registration certificate is rejected
The "warning plus default Don't share, rejection after 2028-08-11" transition of the 2026-10-13 change to [[ADR-0026]] K5 is removed:
a remote or proximity request without a registration certificate is `valid: false`, `reason: "registration_missing"` from today; the
wallet stops without asking the person. The `WRPRC_REQUIRED_FROM` constant and the time input of `missingRegistrationPolicy` are
removed. Wallet-to-wallet proximity (TS9; the other side has no reader certificate) does not change. Precondition: the registrations of
the live verifiers carry their identification numbers and the publisher issues a registration certificate for every intended use
([[ADR-0026]] K4).

## K11 — E4 only when the audit record was written
`verifyPresentation` writes E4 into `checks_performed` only if an `audit` function was given and called; otherwise E4 is in
`checks_skipped`. The result format does not change (same field, different place). [[SPEC-API-0001]] AP9 (E4 runs for rejections too)
applies to a verifier with an audit sink; the hosted verifier always has one.

## K12 — Seconds and milliseconds are distinct types
`@tamga-network/core` provides the `EpochSeconds` and `EpochMillis` types and the helpers `epochSeconds`, `epochMillis`, `nowSeconds`,
`nowMillis`, `secondsToMillis`, `millisToSeconds` (for React Native `@tamga-network/core/time`). Functions that make acceptance
decisions take `now` as seconds (verification, WIA/KA, DPoP, PAR, status list, mdoc, pseudonym, access pass); the wallet's
registration certificate checks, `checkRp`, the disclosure policy and the verifier's scope helpers take milliseconds. The wrong unit is
a compile error and a runtime `RangeError` (seconds `< 1e11`, milliseconds `≥ 1e11`).

## K13 — Additional safe defaults
- A credential of a type whose schema says `uses_status_list: true` but which carries no status entry is rejected at D1
  (`usesStatusList` helper, `@tamga-network/schemas`).
- Trusted list rollback protection (TL2) is on by default: a load without `versionMemory` uses an in-process memory (per network and
  LOTL root fingerprints); `versionMemory: "none"` turns it off; a persistent memory gives protection across restarts.
- Clock skew options (`maxSkewSec`, `clockSkewSec`, `maxClockSkewSec`) are at most `MAX_CLOCK_SKEW_SEC` = 600 s; a larger or negative
  value is a `RangeError` (the same limit as the policy's `max_clock_skew_sec`).

## K14 — New public names
With project management approval: `"none"` (explicit skip value), `statusChecked`, `clientStatus` (`PseudonymResult`), `StatusCheck`,
`expectedSignerFingerprints`, `StatusTokenVerifyOptions`, `verifyTokenDpop`, `verifyResourceDpop`, `DpopCommonOptions`,
`ApprovedRequest`, `approval`, `verified` (`PassRegistry.issue`), `isYes`, `usesStatusList`, `EpochSeconds`, `EpochMillis`,
`epochSeconds`, `epochMillis`, `nowSeconds`, `nowMillis`, `secondsToMillis`, `millisToSeconds`, `secondsOrNow`, `millisOrNow`,
`MAX_CLOCK_SKEW_SEC`, `clockSkewOption`, `resetDefaultListVersionMemory`, subpath `@tamga-network/core/time`.

# Options considered

| Option | Decision | Reason |
|---|---|---|
| Keep the old behaviour and document a warning (0.6.0 notes) | rejected | An integrator who does not read the warning still leaves it open; misuse stays silent |
| Required input, no escape | rejected | Tests, the conformance tool and a service recognising its own credential need a deliberate skip |
| Required input + explicit `"none"` | **accepted** | The skip is visible in code and caught in review; forgetting is a rejection |
| K10: warning until 2028 (ADR-0026 K5) | rejected | Warning plus Don't share leaves it to the person; unregistered use stays possible; the wallet is not in the stores yet |
| K8/K9: nominal type only (TypeScript) | rejected | A JavaScript caller and a hand-made object would pass; an in-process registry cannot be forged |

# Invariants

| Code | Rule |
|---|---|
| MR1 | If a security input that affects the acceptance decision (trust anchors, redirect allowlist, status check, relying party registration, status list signer) is not given, the function rejects; skipping is possible only with the explicit `"none"` value. |
| MR2 | A successful result that did not check revocation says so explicitly (`statusChecked: false`, `clientStatus: "NOT_CHECKED"`). |
| MR3 | The wallet sends no presentation response without a `checkRp` approval bound to that request. |
| MR4 | An access pass is issued only from an accepted result of the verification pipeline and to the key of the verified presentation. |
| MR5 | A request without a registration certificate (except wallet-to-wallet proximity) is rejected. |
| MR6 | E4 is in `checks_performed` only if the audit record was written. |
| MR7 | Time inputs carry their unit; the wrong unit is an error, never silently interpreted. |
| MR8 | Verification rejects a credential without a status entry when its type uses a status list. |

# Consequences

- Packages 0.7.0 (the npm release is done by project management): `core`, `sd-jwt`, `mdoc`, `trust`, `schemas`, `issuer`, `verifier`,
  `wallet-core`. The CHANGELOG "Unreleased" section is the 0.7.0 release notes; package READMEs and `docs/packages/*` are updated.
- [[SPEC-API-0001]] (A3 anchors, E3 `rp`, E4, D1 status entry, D3 signer, `isYes`), [[SPEC-CRED-0003]] (signer pinning),
  [[SPEC-PROTO-0001]] (PAR allowlist, two DPoP endpoints), [[SPEC-WALLET-0001]] and [[SPEC-PROTO-0002]] (K8, K10), change note on
  [[ADR-0026]].
- Conformance vectors version 6: a "signer is not the expected signer" negative case for status lists; the runner pins the signer.
- Consumers are updated in the same release: the reference verifier, the trust list publisher, the identity service and the
  institution issuer, Tamga Wallet and the wallet provider (vendored packages).
- Operational precondition (K10): until the live verifiers' registration certificates are published, the updated wallet does not
  present to them.
- Unchanged decisions: D-PROTO-1, D-PRIV-1 (pseudonym), D-PROX-1 (access pass), D-CRED-7 (WIA/KA), D-API-2.

# Status

**Accepted — 2026-10-19.** With project management approval (security review of 2026-10-19, twelve proposals and the new names).
DECISIONS: D-API-3. Changes: the transition until 2028-08-11 in the 2026-10-13 change to [[ADR-0026]] K5 (K10) and the E4 reporting of
[[SPEC-API-0001]] (K11).
