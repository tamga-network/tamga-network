# Changelog — tamga-network

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The `@tamga-network/*` packages are versioned together and
published on npm as test releases; `0.7.1` is the current one on npm (the API may change until the stable `1.0.0`). The documents
(docs, Tamga ARF) stay at 1.0.0 until the public announcement; their changes are folded into that release (last entry).

## 0.7.2 — unreleased

- Fixes after a code review of ADR-0059…0062. wallet-core: `startAuthorized` adds the ZK copy companion scope only when the
  authorization server lists it in `scopes_supported` (a server without it would reject the PAR); when a refresh or ZK copy
  binding ends with `invalid_grant`, `removedKeyRefs` also carries the binding's instance key unless the wallet's WIA or
  another binding still uses it (no orphaned keys); `removeCredential` computes the keys in use once. issuer: `createPar`
  accepts a companion scope when the credential type comes from `authorization_details` (RFC 9396 §3.1).
- **ADR-0064 accepted (2026-10-23): `age_over_15` in the identity credential.** schemas: the identity credential and its ZK copy
  carry `age_over_15` next to `age_over_18` (ISO/IEC 18013-5 `age_over_NN` pattern; the threshold set is closed, {15, 18}, and
  changes only by ADR); selectively disclosable, derived at issuance, not required. The Longfellow circuit proves equality, so the
  same circuit proves `age_over_15 = true` (end-to-end test with the desktop prover). Tamga Verify: `age-over-15-mdoc` and
  `age-over-15-zk` policies, trust list scopes `age-over-15-1` and `age-over-15-zk-1`, a 15+ option on the browser test page.
  Credentials issued earlier get the attribute when they are issued again (no migration).
- **ADR-0063 accepted (2026-10-23): the on-chain status list registry accepts the list's own bit size.** `StatusListRegistry`
  takes `bitsPerEntry` 1, 2, 4 or 8 (IETF Token Status List) instead of always 2, so identity service lists (`bits = 1`, ADR-0048)
  can be anchored; the value is written once and emitted in `ListRegistered`. trust-publisher: `statusListRegistrationOf` derives
  the registration parameters from a signed status list token. No production chain (local development and test only).
- **ADR-0062 accepted (2026-10-23): the ZK copy refresh token only when the ZK copy scope is requested.** issuer
  `createPar({ allowedCompanionScopes })` accepts a companion scope next to one credential type (`ParRequest.companionScopes`);
  wallet-core `startAuthorized` requests the ZK copy scope with the identity credential when the issuer declares ZK copies
  (`companionScopes`). A refresh token is then for the scope it was granted for (RFC 6749 §6).
- issuer: `issuerMetadata` follows OpenID4VCI 1.0 (Final) §12.2.4 — credential configurations carry their display only in
  `credential_metadata.display` (the legacy top-level `display` is gone) and display entries use `locale` (the type metadata's
  `lang` is translated by the new `credentialDisplay`). Wallet-core already read `credential_metadata.display` and `locale`.
  Only the OpenID4VCI issuer metadata changes: SD-JWT VC Type Metadata (vct documents, `display[].lang`, `claims[].display[].lang`)
  and the credentials themselves keep `lang`, as SD-JWT VC defines.
- **ADR-0060 accepted (2026-10-22): refresh token bound to the client instance key.** issuer `clientInstanceJkt` (RFC 7638
  thumbprint of the client attestation's `cnf`). wallet-core: refresh and ZK copy bindings keep `instanceKeyRef` (the WIA key of
  the issuance); `autoRefreshCredential` / `refreshZkCopies` take `wuaForInstance` to get a fresh WIA for that key
  (`wuaForBinding`); the DPoP key may change on refresh (RFC 9449 §5, attestation-based client authentication §10.3).
  `removeCredential` also deletes the binding's key unless it is in use (`instanceKeysInUse`).
- **ADR-0061 accepted (2026-10-22): pseudonym seed as a separate credential configuration.** wallet-core `obtainCredential`
  requests `urn:tamga:id:PseudonymSeed:1` with the same access token after the identity credential (single proof with the first
  copy's key) when the issuer declares it; the credential response no longer carries a non-standard `pseudonym_seed` field.
- **ADR-0059 accepted (2026-10-21): several credential requests per access token.** The access token can be used for more than
  one credential request within its lifetime (≤ 5 minutes), as OpenID4VCI 1.0 §8 allows and the EU reference issuer does: only
  the configuration the token covers, at most 10 copies per token in total (`MAX_COPIES_PER_ACCESS_TOKEN`,
  `withinAccessTokenAllowance` in issuer), every request with the token's DPoP key. The ZK copy token and tickets stay one
  package.
- issuer: `authServerMetadata` now publishes `client_attestation_signing_alg_values_supported` and
  `client_attestation_pop_signing_alg_values_supported` (`["ES256"]`), which draft-ietf-oauth-attestation-based-client-auth-07
  §10.1 requires whenever `token_endpoint_auth_methods_supported` includes `attest_jwt_client_auth` (OpenID conformance
  self-test, issuer metadata check).
- issuer: **DPoP binding at PAR (RFC 9449 §10).** `createPar` takes `dpopJkt` (the `dpop_jkt` form parameter) and
  `dpopProofJkt` (the key of a verified DPoP proof on the PAR request); if both are present they must match
  (`invalid_dpop_proof`). The bound key is kept on the PAR record (`ParRequest.dpopJkt`) and `redeemCode({ dpopJkt })` refuses a
  token request signed with another DPoP key (`invalid_grant`).
- issuer: new `checkParParams` — a PAR body with a repeated parameter or a `request_uri` is refused (`invalid_request`, RFC 9126
  §2.1), and only `response_type=code` is accepted (`unsupported_response_type`, FAPI 2.0). A `plain` PKCE method now answers
  `invalid_request` (RFC 7636 §4.4.1) instead of the non-standard `unsupported_code_challenge`.
- issuer: DPoP `htu` is compared after RFC 3986 §6.2.2–6.2.3 normalisation (`normalizeHtu`: case of scheme and host, default
  port, query and fragment ignored; RFC 9449 §4.3). `redeemCode` answers a missing `code_verifier` with `invalid_grant` and burns
  the code (OAuth 2.1 §4.1.3), and flags a reused code (`reused: true`) so the caller revokes tokens issued from it (RFC 6749
  §4.1.2).
- issuer: new `unlinkableTimeClaims(now, exp, { acceptableAt })` and `certsValidAt` — credential `iat`/`exp` (and mdoc validity)
  rounded down to the hour so copies and verifiers cannot correlate them by the issuance instant (RFC 9901 §10.1); `iat` stays
  exact only when the rounded instant would precede the signing certificate or the issuer's listing.

## 0.7.1 — 2026-10-21

- **Wallet side of ISO/IEC 18013-7 Annex C (`org-iso-mdoc`) in wallet-core.** `parseDcApiRequest` now also accepts the
  browser's `org-iso-mdoc` request (`parseDcApiMdocRequest`): it parses `DeviceRequest` + `EncryptionInfo`, builds the
  SessionTranscript with the `dcapi` handover for the calling origin, and requires reader authentication (`readerAuth`) valid for
  that transcript — an unsigned request, or one signed for another origin, is refused (PV6). The reader certificate becomes the
  request's `x509_hash` client identifier, so the request goes through the same `matchDcql` → `checkRp` (approval, ADR-0056 K8)
  → registration certificate → disclosure policy path as OpenID4VP. The registration certificate travels in
  `requestInfo.euWrprc` (CBOR, `rc-wrp+cwt`) and is bound to the reader certificate (`checkRegistrationCerts`; new
  `hasRegistrationCert`; ADR-0056 K10 still refuses a request without one). `respond` answers with the selectively disclosed,
  device-signed `DeviceResponse`, HPKE-encrypted to the verifier (`dcApiResponse`, no POST). One document and one namespace per
  request (Tamga profile). mdoc: `DeviceRequest` version `1.1` is read as well.
- verifier: the Annex C request carries the relying party's registration certificate (`createMdocDcApiRequest({ registrationCwt })`;
  the reference verifier reads the publisher's `.cwt` next to the JWT). Interop tests: wallet-core ↔ verifier for both browser
  protocols, origin binding and single use.
- Reference verifier: **Digital Credentials API test page** `/dc-api-test` (sandbox only; the real network redirects to
  verify.sandbox.tamga.network/dc-api-test). It calls `navigator.credentials.get` with `openid4vp-v1-signed`, `org-iso-mdoc` or
  both, forwards the encrypted answer to the verifier and shows the outcome, the checks, the trace and (sandbox sample data only)
  the disclosed values; the page's server opens the request with an RP assertion like any relying party. A browser without the API
  gets a "not supported in this browser" message. `/sample-site/start` accepts `dc_api_origin` (only the site's own origin) and
  returns the DC API requests, so the sample site's "Share from this device" button works.
- **Per-site pseudonym bound to the registered domain (ADR-0031 K2).** wallet-core `derivePseudonym` / `presentPseudonym` now
  refuse a site key that is a client identifier (`x509_hash:…`, `x509_san_dns:…` or any other prefixed value): the site is the
  relying party's registered `dns_name` from the trusted list, which wallets obtain with `stableRpKey` after `checkRp`. A
  verifier's access certificate can be reissued (new `client_id`) without changing anyone's pseudonym on that site; a test covers
  the whole path (signed request → registration → pseudonym) across a reissue with the same registration. `recordPseudonymUse`
  refreshes the stored value on every use. verifier `verifyPseudonym` rejects an expected site in client-identifier form.
- **ADR-0058 accepted (2026-10-21): access certificate profile (ETSI TS 119 411-8).** The network's verifier access certificates
  (production and sandbox) were reissued with the same key: `CN` is the trade name, the SAN carries the registered domain name, the
  support address and an organisational email. Their `client_id` changed, their registration (`dns_name`) and the pseudonyms at
  those sites did not. `pki-issue`: `--contact-uri` is required for production access certificates, new `--contact-email`, and
  `--key` + `--replace` for a same-key reissue. The publisher warns when an ACTIVE production verifier's certificate has no SAN
  contact. The identity service certificate gets `organizationIdentifier` at the foundation handover (prepared, not done).
- wallet-core: `ts8ReportAttachment(state, entry, lookup)` — the machine-readable attachment for a report to a data protection
  authority (EU TS8, RPT_DPA_04): the reported request's single record in the TS10 transaction log format (claim names, never
  values), with the same `transactionIdentifier` as in `ts10TransactionLog`.
- `pki-issue`: `--contact-uri` writes the relying party's support address into the access certificate's SAN and `--service-id`
  writes a service identifier into `OU` (ETSI TS 119 411-8 §6.6.1; ADR-0058, proposed). Both optional; a production access
  certificate without `--contact-uri` gets a warning.
- Wallet specification §5.4.1: item-by-item mapping of per-site pseudonyms to the EU pseudonym rules (ARF Topic 11, PA_01–PA_31),
  with the open points. ADR-0058 (proposed): access certificate profile and the timing of the identity service certificate change.
- Documentation in Azerbaijani: docs.tamga.network/az/ and arf.tamga.network/az/ (machine translation, awaiting a native
  speaker's review; every translated page carries a short notice). Generated pages (release notes, binding rules, packages,
  API reference) and the ARF change page are English only; their `/az/` addresses link to the English page.
- Institution onboarding: a new working example, `examples/05-institution-source` — the institution's lookup endpoint for the
  hosted issuing service (it checks the signed request against the trust list: an agreed, ACTIVE relying-party record, `aud`,
  lifetime, single use; it returns only the fields the document type needs and never the national ID number). Tested against the
  hosted service end to end.
- Example 02 (verify on your own server) now attaches the verifier's registration certificate to every request
  (`registrationScope`, read from `trust.tamga.network/wrprc/index.json`); since 0.7.0 Tamga Wallet refuses requests without one.
  The "Verify on your server" guide has the same step.
- Registry tool: a `REVOKED` entry is final and a `RETIRED` one can only become `REVOKED` (same rule as the registry
  contracts); `ACTIVE` is reached again only from `SUSPENDED`. `pki-issue --prod` requires `--dns` and `--org-id` for access
  certificates.
- Institution source contract: `isced_f_code` is required (null means no mapping: no credential is issued, E11).
- ADR-0057 (accepted 2026-10-20): in hosted issuance the institution's signing key stays with the institution; signatures are requested
  through the Cloud Signature Consortium API v2 with the digest only.
- Production trusted list: the network's own verifier (`verify.tamga.network`) and identity service (`tamga-id`) now carry their
  registration data (the tax number of the provisional operator, marked `provisional` until the foundation is established;
  postal address; data protection authority complaint route), so registration certificates are published for them
  (`trust.tamga.network/wrprc/`). The verifier's access certificate was reissued with the same key and carries
  `organizationIdentifier` (ADR-0026 K3); its `client_id` changed, its registration (`dns_name`) did not. Revoked records no
  longer produce registration-data warnings.

## 0.7.0 — 2026-10-20

Misuse-resistant package defaults (ADR-0056). Code written against 0.6.0 has to pass the new required security inputs
(or an explicit `"none"`); see the breaking changes below.

### Breaking changes — misuse-resistant defaults (ADR-0056)

A security input that affects the acceptance decision is now required; forgetting it is a rejection, and skipping a check
deliberately is written explicitly as `"none"`. No compatibility layer (development stage, ADR-0029).

- `sd-jwt`: `verifySdJwtVc` requires `rootCertsDer` (trust anchors, or `"none"` to skip the chain check deliberately); an empty
  or missing value fails at A3.
- `issuer`: `createPar` requires `allowedRedirectUris`; a client without registered redirect addresses is rejected
  (`invalid_redirect_uri`).
- `trust` / `issuer` / `verifier`: `verifyWalletAttestation`, `verifyKeyAttestation` (`verifyKaProof`,
  `verifyAttestationProof`) require `statusOf` and `verifyPseudonym` requires `walletStatusOf` (a status check, or `"none"`).
  New result field `statusChecked`; a successful `PseudonymResult` carries `clientStatus`.
- `verifier`: `verifyPresentation` requires `rp` (the relying party's registration, `null` for an unregistered party, or
  `"none"` to skip E3 deliberately); omission is rejected at E3.
- `issuer`: `verifyDpop` is replaced by `verifyTokenDpop` (token endpoint) and `verifyResourceDpop` (resource endpoints; access
  token and bound key required).
- `sd-jwt`: `verifyStatusListToken`, `verifyStatusListCwt` and `verifyStatusListAny` require a fourth argument
  `{ expectedSignerFingerprints }`; an unexpected signer fails with `D3` before the signature check. The verifier pins the
  institution's registered status keys; `WalletStatusChecker` pins the wallet provider keys of the trusted list.
- `mdoc`: `verifyIssuerSigned` returns `valid: false` when the MSO has no device key.
- `wallet-core`: `respond` requires the `approval` that `checkRp` returns for the same request (`ApprovedRequest`; bound to
  `client_id`, nonce, response address/origin, signing certificate and intermediary). No approval for impersonation, an inactive
  registration or an unverified intermediary.
- `verifier`: `PassRegistry.issue({ verified, … })` takes the ACCEPTED output of `verifyPresentation` (in-process registry); the
  `presentation` input is removed.
- `wallet-core`: a request without a registration certificate is rejected (`registration_missing`), remote and in proximity —
  the warning-until-2028 transition of ADR-0026 K5 is removed; `WRPRC_REQUIRED_FROM` and the time argument of
  `missingRegistrationPolicy` are removed. Wallet-to-wallet proximity is unchanged.
- `verifier`: E4 is in `checks_performed` only when an `audit` function was given; otherwise it is in `checks_skipped`.
- `core`: `EpochSeconds` / `EpochMillis` with `epochSeconds`, `epochMillis`, `nowSeconds`, `nowMillis`, `secondsToMillis`,
  `millisToSeconds`, `secondsOrNow`, `millisOrNow` (subpath `@tamga-network/core/time` for React Native). Acceptance functions take
  `now` in seconds; the wallet's registration certificate checks, `checkRp`, the disclosure policy and the verifier's scope helpers
  in milliseconds. The wrong unit is a compile error and a `RangeError` at run time.
- `verifier` / `schemas`: a credential without a status entry is rejected at D1 when its type uses a status list
  (`usesStatusList`).
- `trust`: rollback protection (TL2) is on by default — loads without `versionMemory` use an in-process memory per network and root
  fingerprints (`versionMemory: "none"` turns it off; `resetDefaultListVersionMemory` for tests).
- Clock skew options (`maxSkewSec`, `clockSkewSec`, `maxClockSkewSec`) are capped at `MAX_CLOCK_SKEW_SEC` = 600 s.
- New: `isYes(output, claim)` — reads a yes/no attribute safely (true only for an ACCEPTED result with the value exactly `true`).
- Conformance vectors version 6: the status list vectors add an "unexpected signer" negative case; the runner pins the signer.

### Trust list publisher (`apps/trust-publisher`)

- Chain projection (ADR-0051, accepted 2026-10-19; **off by default**, no production chain exists): `npm run trust:chain-submit` writes only the
  digests of the signed trust lists (`sha256(<file>.jws)`, version, previous digest, issue time) and of the anchor log's latest
  line to a trust list anchor registry contract; `chain-check` tells a verifier whether a list digest is anchored
  (`YES` / `NO` / `UNKNOWN`). The signed lists remain the source of truth: on conflict the list prevails and the chain answer
  is never required for verification. Feature flag `TAMGA_CHAIN_ENABLED` (default `0`): while off nothing connects to a chain;
  `--dry-run` prints the plan. An anchor counts only once the registry's confirmation threshold of distinct writers has
  submitted identical data (production threshold ≥ 2). New dependency `ethers` (app only, not in the published packages).
  The command is `chain-submit`, not `chain-anchor`: one writer's submission is a vote, and the name stays clear of the hourly
  anchor log command `trust:anchor`.
- Competing anchor candidates (ADR-0053): the first writer to open a list version can no longer lock it. When the registry holds
  a different, not yet confirmed digest for a version, `chain-submit` now submits its own verified digest as a competing candidate
  (decision `CONTEST`, reported as `contested` with a warning on stderr) instead of skipping it; the first candidate to reach the
  threshold wins and every conflict is an on-chain event. A confirmed different digest is still `CONFLICT` (exit code 3).

- `npm run trust:wallet-provider -- list|show|check|activate|suspend|revoke` manages `wallet_providers[]` in the production
  and sandbox registries. `activate` checks the provider's signing certificate against the wallet attestation policy (EC
  P-256, ecdsa-with-SHA256, `digitalSignature`, not a CA, within its validity) and the ETSI TS 119 412-6 §5 profile: the
  subject's `organizationIdentifier` equals the one derived from the entry's `identifiers[]` (e.g. `TR-VKN` → `VATTR-…`) and
  the qcStatements carry the QcType `id-etsi-qct-wal`. `check` runs the same checks without writing (signing key rollover).
- Tamga Wallet's provider `TAMGA-WP-1` is `ACTIVE` in the production and the sandbox trust lists (certificate
  `wallet-provider-tamga-wp-1`).

### Packages

- `sd-jwt`: `verifySdJwtVc` option `skipValidityPeriod` — skips A7 (`exp`/`nbf`) for proofs of possession that are not
  acceptance decisions (the identity service's erasure request accepts an expired credential, whose record is still held).
- `issuer`: `redeemCode` rejects a request without a code, or a PAR that has no code yet, as an unknown code (`invalid_grant`).
- `wallet-core`: fixed `wiaRevokedByList` — the "entry beyond the list" bound assumed 2-bit status lists; on a 1-bit list a
  revoked WIA entry in the upper half of the last bytes read as "not revoked". The bound now follows the list's `bits`
  (new `wiaRevokedInList`).
- `wallet-core`: proximity presentation (`presentProximity`) and the wallet-to-wallet holder (`presentToPerson`) no longer offer
  a suspended credential — the same rule as the remote presentation (`matchDcql`).
- `verifier`: documented that the mdoc A3 step anchors the `x5chain` leaf directly (anchor itself or signed by the anchor; no
  intermediates) — conformant with ISO/IEC 18013-5 Annex B (document signer issued directly by the IACA). SPEC-API-0001 A3 row.
- Misuse guards (security review 2026-10-19). Checks that compared against an expected value now fail when the expected value
  is empty or missing instead of comparing against it: `sd-jwt` `verifySdJwtVc` with a KB-JWT (expected `aud`/`nonce`),
  `issuer` `verifyProofJwt` (`credential_issuer`/`c_nonce`), `verifyKaProof` and `verifyAttestationProof` (`nonce`),
  `verifyDpop` with `jkt: ""` (a token record without its bound key), `verifier` pass-key proof and `verifyPseudonym`.
  `verifier` `verifyPresentation` returns INDETERMINATE at T0 when the policy's freshness limits are missing or not finite
  non-negative numbers (or `max_clock_skew_sec` > 600) — before, a missing limit silently disabled the trust-list and status
  token age checks. `allowLocalIssuerUrls` compares the host name exactly (`http://localhost.example.org` is not local).
  `wallet-core` `missingRegistrationPolicy` throws when given seconds instead of milliseconds (with seconds the 2028 rejection
  date was never reached). Reported steps match what ran: `verifySdJwtVc` lists A6 only when a KB-JWT was verified, and
  `verifyIssuedSdJwt` lists B4 only when the catalogue knows the type.

### Reference verifier (`apps/verify`)

- Fixed: the scope check E3 now uses the registration of the relying party that opened the presentation. Before, a presentation
  opened on behalf of another relying party was checked against the verifier's own (wider) registration, so a wallet that
  disclosed more than asked could pass that party an attribute outside its registered scope (ADR-0017 K7/HV6, AP6).
- The control view key (`?show=`) is compared in constant time.
- Rate limits no longer share one bucket behind the reverse proxy (which does not pass client addresses): opening a
  presentation counts against the authenticated relying party's own bucket (unauthenticated requests share one), and the
  wallet response endpoints (`/vp/response`, `/vp/dc-mdoc/:id`) count per presentation after the cheap lookups. Before, one
  client within the proxy's per-address allowance could exhaust the shared bucket and block every relying party.
- Fixed: sign-in with a site pseudonym now checks that the wallet unit is not revoked (the WIA's `client_status` list,
  signed by a wallet provider in the trusted list), as ADR-0031 PS5 requires. Before, the hosted verifier checked the WIA's
  signature but not its revocation, so a wallet unit closed after a lost phone could still sign in to sites.

### Documents

- ADR-0056 (accepted 2026-10-19): misuse-resistant package defaults (above). ADR-0026 K5: a request without a registration
  certificate is rejected from today (the transition until 2028-08-11 is removed). SPEC-API-0001: E3 needs the RP registration
  (`"none"` skips), E4 only with an audit sink, D1 rejects a missing status entry for status-list types, D3 pins the signer;
  SPEC-CRED-0003 signer pinning; SPEC-PROTO-0001 PAR allowlist and the two DPoP functions; SPEC-PROTO-0002 / SPEC-WALLET-0001
  wallet approval and registration rule. Tamga ARF RB-WP-19 updated.
- ADR-0052 (accepted 2026-10-19): Besu 25.6.0 removed onchain permissioning and Tessera privacy, so the chain stage uses Besu
  local permissioning — a `permissions_config.toml` (node and account allowlists) on every node, derived from the on-chain
  contract state, identical on all validators and checked for drift; a node's JSON-RPC endpoint is never exposed to the internet
  (reverse proxy with mTLS). The onchain permissioning contract assumption is removed from the chain-stage documents.
- Status list verification step Ş5 and verification step D4: `ttl` is a refresh hint; the token stays usable until `exp` and the
  policy's `max_status_token_age_sec` (as in §8.1 and in the code). PR13: a redirect address outside the allowlist is rejected
  with `invalid_request` (RFC 9126 §2.1), as the services answer.

### Fixed before release (code review 2026-10-20)

- `verifier`: `verifyPresentation` with `rp: null` (unregistered relying party) is now always rejected at E3, as SPEC-API-0001
  specifies. Before, a presentation that disclosed no claims passed E3 with an unregistered party (an empty scope has no
  overrun).
- `wallet-core` / `trust`: `TrustPins.versionMemory` carries a persistent "last seen" list version memory (TL2) to every helper
  that loads the trusted list (`fetchTrustSource`, `fetchRpRecord`, `fetchRegistrarKeys`, the issuer directory). Without it the
  rollback protection is in-process only and resets when the app restarts. `@tamga-network/trust/core` now exports
  `ListVersionMemory`, `ListMark` and `MemoryListVersionMemory`.

## 0.6.0 — 2026-10-13

EU alignment (ADR-0048, ADR-0049, ADR-0026 K5, EU TS9, ISO/IEC 18013-7 Annex C). Credentials issued with earlier packages —
identity credentials and diplomas — have to be issued again (new status lists; the diploma's Type Metadata changed, ADR-0029).

- `sd-jwt`, `mdoc`: status lists with 1 or 2 bits per entry (the identity service publishes `bits = 1`, institutions
  `bits = 2`); the CWT form of the same list (`application/statuslist+cwt`) for mdoc copies; `verifyStatusListAny`.
- `schemas`: `suspension_allowed` (diploma only); the verifier rejects a suspension value in a type without suspension.
- `mdoc`: reader authentication (`signReaderAuth`, `verifyReaderAuth`), `requestInfo` with the CBOR registration certificate
  (`euWrprc`), the EU TS9 presentation offer, status-only `DeviceResponse`, HPKE and ISO/IEC 18013-7 Annex C.
- `verifier`, `apps/verify`: browser verification through the Digital Credentials API by default (Annex C for Apple WebKit, QR
  as a fallback on desktop); the cross-device and the DC API requests are separate objects with their own keys.
- `wallet-core`: a request without a registration certificate carries a warning and defaults to "don't share" (refused after
  2028-08-11); proximity readers are verified against the trust list's anchors (`readerTrust`, **breaking**); wallet-to-wallet
  presentations follow the TS9 offer; new log events and log retention.
- `trust`: `walletProviderListing` for the "Listed on Tamga Network" indicator (ADR-0049).
- `issuer`: `keyStorageStatus` policy for key attestations.
- Conformance vectors version 5 (status lists in JWT and CWT).

## 0.5.2 — 2026-10-13

Security fixes and EU format alignment (0.5.1 was not published). **Breaking:** `registrationCert` (one per request) and the
wallet attestation result (`clientStatus`).

- Security: an embedded disclosure policy is evaluated only when the access certificate is anchored in the trust list;
  trust anchors may be certificates (`TrustAnchor`); status list fetching only over `https`, on hosts the issuer declares, never
  to private addresses, redirects re-checked and connections pinned (SSRF, DNS rebinding); external issuers' identifier list
  hosts come from the external list or the document signer certificate.
- EU format: `iat` in the request object header and the chain without the root (TS 119 472-2); one registration certificate per
  request; every OAuth client attestation (draft -07) is read as a wallet instance attestation; `vc+sd-jwt` accepted for
  external types; DCQL `trusted_authorities` with `etsi_tl`.
- Hardening: wallet status lists under 10,000 entries are refused (CIR 2026/1731).
- Fixes: wallet-to-wallet revocation checks have three outcomes; mdoc clock tolerance only at `validFrom`; an unreadable mdoc
  `status` entry invalidates the credential; the revocation maintenance period is compared with a tolerance.

## 0.5.0 — 2026-10-12

- Embedded disclosure policy (ADR-0046): `core/disclosure-policy`, published by the issuer in its metadata, stored and
  evaluated offline by `wallet-core`; never sent to the verifier.
- Issuer preferences for wallet attestations (EU ARF WUA_05a, WUA_32, ISSU_12c): `issuerAttestationPrefs`,
  `capToRevocationMaintenance`.
- EU trusted lists in the XML format (ETSI TS 119 612): `readTrustedListXml` with platform-independent XMLDSig; external
  `etsi-tl-xml` lists also in the wallet. New dependency `@xmldom/xmldom`.
- Attestation Revocation List (identifier list, CWT) verified in step D and in the wallet.
- Wallet-to-wallet protocol in `wallet-core`; the registration certificate carries `service_id`; optional
  `revocation_policy_uri` for institutions (ADR-0047).

## 0.4.0 — 2026-10-12

- Identity credential attribute names follow the EU PID encoding (ADR-0045): `birthdate`, `nationalities[]` (SD-JWT VC);
  `birth_date`, `nationality` (mdoc). New `core/pid` subpath.
- Zero-knowledge presentations only with the short-lived ZK copy `urn:tamga:id:ShortLivedIdentityAttestation:1` (≤ 24 hours,
  no revocation entry, refreshed by `wallet-core`; ADR-0044).
- `mdoc` `verifyIssuerSigned({ clockSkewSec })`; `issuer` `issuerMetadata({ mdocConfigurations })`.

## 0.3.1 — 2026-10-09

- `sd-jwt`: a status list token is valid until its `exp` plus the policy's maximum age (the 6-hour outage buffer of the
  network's lists); `signStatusListToken({ expSec })`.
- `verifier`: a missing `accept_unrevocable_zk` means `false`.
- `wallet-core`: on `invalid_nonce` the wallet fetches a fresh nonce and retries once.

## 0.3.0 — 2026-10-09

Alignment with OpenID4VCI 1.0 Final, OpenID4VP 1.0 and HAIP 1.0: key attestation `typ` `key-attestation+jwt`; the nonce only
from the nonce endpoint; no `notification_id`; OpenID4VCI 1.0 error codes; SD-JWT disclosure serialisation as specified.

## 0.2.0 — 2026-10-08

The nine packages as a set: `core`, `trust`, `schemas`, `sd-jwt`, `mdoc`, `issuer` (+ `/client`), `verifier` (+ `/web`,
`/zk`), `wallet-core`, `zk` (wallet-side Longfellow ZK prover: `/node`, `/react-native`).

## 0.1.0 — 2026-09-28

First publication of the package names on npm.

## Documentation 1.0.0 — 2026-10-16

The current state of the documentation set; changes before the public announcement are made in this release.

- Tamga ARF 1.0 (arf.tamga.network, English and Turkish): the main document; Annex A — Trust Framework; Annex B — Tamga
  Rulebook; Annex C — the Education, Identity, Event Ticket and Contact Rulebooks in the EU Attestation Rulebook template;
  Annex D — Definitions; Annex E — References; the Revocation Policy and the Wallet Attestation Policy (mapped to ETSI TS
  119 471); Reading path, Roles and Onboarding.
- Developer documentation (docs.tamga.network, English and Turkish): guides (including the sandbox), concepts,
  specifications, decision records ADR-0001 … ADR-0050, the API reference generated from the OpenAPI files, and a glossary.
- Services: trust lists (`trust.tamga.network`), the reference verifier Tamga Verify (`verify.tamga.network`) and the
  sandbox test network (`sandbox.tamga.network`). The network operates no wallet (ADR-0042); it lists wallet providers, and
  Tamga Wallet's provider is listed as `ACTIVE`.
