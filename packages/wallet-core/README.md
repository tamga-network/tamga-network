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

## New in 0.8.4

All additions are optional; without them the behaviour is that of 0.8.3.

- **Final identity confirmation** (ADR-0080): `completeAuthorized({ …, confirmIdentity })` — when the identity service sends a
  masked summary (initials, birth year), the function is called before the credential is requested; return `true` when the
  person confirms. `false` → nothing is requested, error `identity_rejected`.

- **Copies in proximity and wallet to wallet** (wallet rules §4.1). Every session still uses a new copy. The core now reports
  the copy state and makes the decision; the refresh call and the warning screen are the app's:
  - `proximityCopies(credential)` → `{ total, remaining, low, exhausted, refreshable }`;
    `planProximityCopy(credential, { online })` adds `action` (`present` · `refresh_first` · `reuse_with_warning` ·
    `unavailable`) and `refreshInBackground`.
  - `presentProximity` / `presentToPerson`: the consent view carries `copies` (before the session), the result carries `copies`
    (after) and `reused`.
  - `reuseLastCopy: true` — pass it only after the person accepted the warning that this presentation can be linked to the
    previous one. When no unused copy is left, the last copy is reused (always the same copy) and the log entry is marked
    `reused: true`. Without the option nothing is presented, as before (`PROXIMITY_NO_COPY_REASON`).
  - `beforeSend(marked)` — called once after the response is built and before it is sent, with the state in which the copy is
    marked as used. Save that state there; if the hook throws, nothing is sent. Same contract as `respond({ beforeSend })`.
- **Earlier sharing with a verifier** (WL6): `sharedBefore(state, rpKey, requested, { vct })` reads the presentation log on the
  device and returns the fields shared with that verifier before (names and dates, no values), which of the requested fields
  were shared before (`again`) and which are requested for the first time (`firstTime`). `rpKey` is the verifier's persistent
  identity (`VpRequest.rpKey`). Proximity readers and wallet-to-wallet peers have no persistent identity, so nothing is returned
  for them.

## New in 0.8.3

- Correction to the 0.8.2 note below: `fetchRpRecord` loads the LOTL and **one** national list (`stateCode`). The cross-country
  name rule (ADR-0075) compares records across the lists that are loaded, so with a single list the wallet cannot see an
  ambiguity with another country's list. The rule now lives inside the trust source (`@tamga-network/trust`) and takes effect
  for callers that load several national lists; nothing changes for a wallet that loads one.
- Pass `signerTrust` to `checkRegistrationCerts` and do not send data while `registration_binding_unverified` is flagged. Mark copies inside `respond({ beforeSend })`. http offers, http `redirect_uri` and local Digital Credentials API origins need `allowLocalDevHost: true`. `parsePassGrant` takes `signerFingerprint`, `cnf` and `trust`. Load the list once and use `rpRecordOf` / `registrarKeysOf`. `HardwareKeyProvider` operations and `delete` can throw (`isHardwareUnavailable`). TS10 export defaults to 600,000 iterations.

## New in 0.8.2

- `fetchRpRecord` with an `x509_hash:` client identifier also applies the cross-country name rule (ADR-0075) — see the 0.8.3
  correction above: this has an effect only when several national lists are loaded, which `fetchRpRecord` does not do.

## New in 0.8.1

- `startAuthorized` reports `registrationStatusUnknown: true` when the issuer's registration certificate status could not be
  checked (no list, no unexpired cached copy): show the person a warning (ADR-0068 WRS4). A revoked certificate still throws.
- Registration-certificate scope for mdoc compares namespace + element: an element of the same name in another namespace counts
  as over-asking (OpenID4VP and proximity); a path without a namespace (`[element]`) grants nothing for an mdoc registration.
- `wiaStatusInList` computes the list bound as `8 / bits`, so 4- and 8-bit lists no longer throw for entries past the list.

## Breaking in 0.8.0

- WIA status bits read fail closed: `wiaRevokedInList` / `wiaRevokedByList` also treat the undefined value 3 as revoked; new
  `wiaStatusInList` / `wiaStatusByList` return `valid | suspended | revoked` and `wiaValidInList` is true only for 0. Use a WIA
  only when it is `valid`; delete it locally only when it is `revoked` (suspension is temporary). See the CHANGELOG section
  "Breaking / behaviour changes in 0.8.0".
- `fetchRegistrationStatuses` never replaces a cached status list with an older one (`iat`); `StatusList.iat` is exposed.

## New in 0.7.4

- Registration certificate status (ETSI TS 119 475; Tamga ADR-0068): `fetchRegistrationStatuses(refs, http, registrarKeys, {
cache, offline })` fetches each registrar status list once (signer must be a list registrar key, `exp` required, unexpired
  cached copy used offline) and returns a lookup you pass to `checkRegistrationCerts`, `checkIssuerRegistration` and
  `checkProximityRegistration` (`presentProximity` option `registrationStatuses`). A revoked certificate makes the request
  invalid; an unchecked status adds the flag `registration_status_unknown` (show it as a warning). Helpers:
  `registrationStatusRefs`, `wrprcStatusRef`, `MemoryRegistrationStatusCache`.
- SD-JWT VC over the Digital Credentials API binds the KB-JWT to `aud = "origin:<origin>"`; `checkDcqlShape` throws `WalletError`
  on malformed queries. See the CHANGELOG "Breaking / behaviour changes in 0.7.4".

## Status

Published on npm as the `0.8.4` test release; the stable `1.0.0` comes when everything is ready. In test releases the API
may change. Every release is built from this repository by GitHub Actions and carries npm provenance (verifiable link to
the source commit).

## Links

- Working examples, run in CI against the real packages: [`examples/`](https://github.com/tamga-network/tamga-network/tree/main/examples)
- Integration guides and specifications: [docs.tamga.network](https://docs.tamga.network/guides/)
- Code: Apache-2.0 · Documentation: CC BY 4.0
