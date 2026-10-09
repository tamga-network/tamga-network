# Changelog — tamga-network

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The documents (docs, ARF) are 1.0.0 until the public
announcement; changes before it are folded into this release. The `@tamga-network/*` packages are versioned separately: they
are published on npm as the `0.4.0` test release (the API may change in test releases); the stable `1.0.0` comes when
everything is ready.

## [1.0.0] — 2026-10-04

First release of the Tamga Network documentation set and reference implementation.

### 2026-10-09 — packages: 0.4.0 test release

The nine packages move to `0.4.0` together (`sdk_version` = `@tamga-network/verifier@0.4.0`). Interface changes, so callers
must update:

- Identity credential attribute names follow the EU PID encoding (ADR-0045): SD-JWT VC `birthdate` and `nationalities[]`;
  mdoc `birth_date` (full-date) and `nationality` (array). Credentials and requests with the old names no longer match.
- ZK presentation only with the short-lived ZK copy (ADR-0044): new type `urn:tamga:id:ShortLivedIdentityAttestation:1`; the
  verifier accepts it without `accept_unrevocable_zk`; `wallet-core` refreshes ZK copies (`refreshZkCopies`) and matches
  `mso_mdoc_zk` only with them. `Match.zk.copyKeyRef`, `matchDcql(…, { now })`, `StoredCredential.zk` are new;
  `matchClaimValue(match, name)` gives the value to show for a requested field in either format.
- New: `@tamga-network/core/pid` subpath; `@tamga-network/mdoc` depends on `@tamga-network/core`; `sd-jwt`
  `arrayElementSd`; `issuer` `issuerMetadata({ mdocConfigurations })`.
- Details in the two entries below.

### 2026-10-09 — ZK presentation only with short-lived copies (ADR-0044 implemented)

- New catalogue type `urn:tamga:id:ShortLivedIdentityAttestation:1` (ISO mdoc only, namespace `tamga.id.1`, only
  `age_over_18`): the ZK copy of the identity credential. Type rule: valid for at most 24 hours, no revocation list entry
  (EU ARF VCR_01). The Longfellow proof binds the docType, so the type is the short-validity marker (ADR-0044 K1).
  `@tamga-network/schemas`: `ZK_COPY_VCT`, `isShortLivedType`.
- `@tamga-network/verifier`: a ZK presentation whose proven type is short-lived is accepted without
  `accept_unrevocable_zk` (`status.value = NOT_APPLICABLE`, reason: short validity); an unmarked ZK presentation still needs
  the flag (ZC4). Tamga Verify's `age-over-18-zk` policy asks for the ZK copy type; `accept_unrevocable_zk: true` was removed.
  The trust lists authorise the identity service for the new type and give Tamga Verify an `age-over-18-zk-1` scope.
- `@tamga-network/wallet-core`: the identity service's `refresh_token` (identity credential only) becomes a ZK copy binding
  (`StoredCredential.zk`); `refreshZkCopies` (refresh token grant with DPoP + WIA → a batch of 3 copies, each checked: same
  issuer certificate, type, device key, no status, ≤ 24 hours), `scheduleZkRefreshes` (window 8 hours before expiry, random
  delay up to 6 hours), `selectZkCopy`; DCQL `mso_mdoc_zk` matches only a valid ZK copy and the proof is made with it — the
  main credential's mdoc is never used for ZK (ZC1). `removeCredential` also returns the ZK keys.
- `@tamga-network/issuer`: `issuerMetadata({ mdocConfigurations })` announces `mso_mdoc` configurations (`doctype`,
  `cose_key`, COSE `-7`).
- Specifications: SPEC-PROTO-0001 §4.2 (ZK copy token), SPEC-WALLET-0001 §4.5, SPEC-API-0001 D1, Identity Rulebook §6.1, Tamga
  Rulebook RB-AP-ID-11, ARF L5, guides and concept pages. Real Longfellow fixtures for the ZK copy (`zk-copy.cbor`).

### 2026-10-09 — identity credential: EU PID attribute names (ADR-0045)

- ADR-0045 (accepted): the identity credential (`urn:tamga:id:IdentityAttestation:1`) uses the EU PID names and encodings of
  Implementing Regulation (EU) 2026/1731. SD-JWT VC: `birthdate` (was `birth_date`) and `nationalities`, an array whose elements
  are disclosed one by one (was the single-valued `nationality`). mdoc (namespace `tamga.id.1`): `birth_date` encoded as
  `full-date` (#6.1004) and an array-valued `nationality`. `age_over_18` stays (it is not in the EU PID set). Type, docType and
  namespace are unchanged. Development stage (ADR-0029): fixed in place, no compatibility shim — wallets obtain the identity
  credential again.
- `@tamga-network/core/pid`: the EU PID name table (mdoc identifier ↔ SD-JWT VC claim name). `@tamga-network/mdoc`:
  `toPidMdocElements` and `plainElementValue`. `@tamga-network/sd-jwt`: `arrayElementSd` issues array elements as separate
  disclosures (RFC 9901 §4.2.2); `@tamga-network/issuer` reads it from the Type Metadata (`path: [name, null]`) and
  `identityMatchKeys` reads `birthdate`. `@tamga-network/verifier`: mdoc element names are mapped to the catalogue names for the
  schema check (B6) and the scope checks (AP6, E3); `full-date`/`tdate` values come out as strings. `@tamga-network/wallet-core`:
  mdoc and proximity requests match the credential's SD-JWT claims through the same table (MD1); the driving licence
  prerequisite discloses `birthdate`.
- Trust lists: the institutions' identity matching scope asks for `birthdate`. Identity Rulebook §1, §6, §9 and SPEC-ID-0003 §9
  updated; the EU PID mdoc schema used for external credentials now names `family_name_birth` / `given_name_birth` as in
  Table 6. Conformance vectors version 4 (new `sd-jwt/identity-pid-names`).
- Tamga Rulebook RB-GEN-05: debug logs are kept for at most 1 day (was 7 days).

### 2026-10-09 — packages: 0.3.1 test release (patch)

- `@tamga-network/sd-jwt` `verifyStatusListToken`: the `iat + 2 × ttl` staleness rule is removed. The limit is the token's
  `exp` plus the policy's `max_status_token_age_sec` (SPEC-CRED-0003 §8.1; draft-20 `ttl` is a refresh hint). The 6-hour
  outage buffer of the network's status lists now reaches verifiers on 0.3.1. An optional `maxAgeSec` sets an age limit for
  callers without a policy. A newer anchor that cannot be fetched still gives INDETERMINATE (D5).
- `signStatusListToken` takes an optional `expSec` (`exp − iat`, at least `2 × ttl`; default `2 × ttl` as before).
- `@tamga-network/verifier`: a missing `accept_unrevocable_zk` now means `false` (ADR-0044 ZC4) — a ZK presentation is
  INDETERMINATE (D1) unless the policy explicitly sets `true`. Policies that accept ZK presentations must now say so.
  Tamga Verify's `age-over-18-zk` sets it explicitly and `/policies` shows the flag for ZK policies.
- `@tamga-network/wallet-core`: on `invalid_nonce` from the credential endpoint (OpenID4VCI 1.0 §8.3.1.2) the wallet fetches
  a fresh `c_nonce` from the nonce endpoint, re-signs the proofs and retries once. The keys and the key attestation are reused.
- The other packages (`core`, `mdoc`, `schemas`, `trust`, `issuer`, `zk`) only move to 0.3.1 with the set; their code is
  unchanged. `sdk_version` is `@tamga-network/verifier@0.3.1`.

### 2026-10-09 — revocation lists: decisions on noise, `exp`, hosted service; ZK short-lived copies

- Status list (SPEC-CRED-0003): the 1% initial-noise rule is removed (it had no observable effect). The publication interval
  stays short (2 minutes; `ttl` = the interval) and `exp` becomes `iat + 6 hours` — `ttl` is the draft-20 refresh hint, `exp`
  the absolute limit, matching the 6-hour maximum token age of verifier policies. The network's services sign with the new
  `exp`; `@tamga-network/sd-jwt` 0.3.0 still treats a token as stale after `2 × ttl`, so the outage buffer reaches verifiers
  with the next patch release. Hosted status service (§10.2): key separation and key location described as they are; the
  revocation list endpoints keep no access log. The ARF, trust framework and rulebooks say "a revocation takes effect within
  a few minutes" instead of the 60/90-minute pilot values.
- ADR-0044 (accepted): a ZK presentation uses only short-lived ZK copies (≤ 24 hours, no revocation list entry), refreshed
  silently and not re-issued once the main credential is revoked or suspended — the EU ARF's short-lived attestation path.
  ADR-0023 AR4 gets a narrow exception for the ZK copy token. Implementation pending (next minor package release).

### 2026-10-09 — standards alignment (OpenID4VCI 1.0 Final, OpenID4VP 1.0, HAIP 1.0); packages: 0.3.0 test release

Wire format changes (breaking for test-release users; update issuer, wallet and wallet provider together):

- Key attestation JWT `typ` is `key-attestation+jwt` (OpenID4VCI 1.0 Final Annex D.1); the draft value
  `keyattestation+jwt` is rejected.
- The token response no longer carries `c_nonce` / `c_nonce_expires_in`; the nonce endpoint returns only `c_nonce` with
  `Cache-Control: no-store`. `wallet-core` takes the nonce only from the issuer's `nonce_endpoint` (required).
- The credential response no longer carries `notification_id` (no notification endpoint is offered).
- Credential endpoint errors follow OpenID4VCI 1.0 §8.3.1.2: `unknown_credential_configuration` for a configuration the
  issuer does not offer, `invalid_nonce` for an unknown, expired or consumed `c_nonce` (`ProofCheck.invalidNonce`),
  `credential_request_denied` when the type is no longer authorised in the trust list.
- `sd-jwt`: disclosures are serialised with the issuer convention of SPEC-CRED-0002 §3.5 (`", "` / `": "` separators,
  non-ASCII escaped as `\uXXXX`); verification is unchanged (the string is hashed as it is). The specification's example
  values are now a test.
- ZK presentations: the `status.reason` text no longer claims the credential is short-lived.

Documentation:

- OpenID4VCI profile: examples use an example institution and `vct` URNs as configuration identifiers and scopes; nonce
  lifetime 5 minutes without `c_nonce_expires_in`; deferred issuance (HTTP 202 + `transaction_id` + `interval`, DPoP) and the
  notification endpoint are documented as not offered today, with the Final semantics of `credential_deleted`; PAR uses
  `scope`; error table aligned with Final.
- OpenID4VP profile: response encryption `A128GCM` or `A256GCM` (HAIP §5); browser Digital Credentials API and ISO 18013-5
  proximity status updated. ADR-0013: SessionTranscript follows the OpenID4VP 1.0 Final handovers.
- Status list: Token Status List draft-20 (the EU reference in CIR 2026/1731), draft-21 noted; today's publication interval,
  `exp`, initial noise and hosted-service key/log described as they are, with open topics for decision.
- SD-JWT VC / schema catalogue: `schema_uri#integrity` documented as a Tamga extension. Concept page: `tx_code` is mandatory in
  the pre-authorized flow. ADR-0032: implementation note on ZK and revocation.
- Conformance vectors (version 3) use an example institution; the development PKI's example university leaf is named
  "Ornek Universitesi (DEV)".
- The `@tamga-network/*` packages are versioned `0.3.0` (test release); `sdk_version` is `@tamga-network/verifier@0.3.0`.

### 2026-10-09 — sandbox registration certificates

- Sandbox: the access certificates of `verify.sandbox.tamga.network` and `issuer.sandbox.tamga.network` now carry the
  organisation identifier (`organizationIdentifier`, EN 319 412-1) that their registration certificates name as `sub`
  (ADR-0026 K3). Without it a wallet cannot bind the registration certificate to the request and refuses it; every sandbox
  verification scenario that sends a registration certificate was affected. Same keys, new certificates (new `x509_hash`
  client identifiers); pseudonyms are unaffected (they follow the stable domain name, ADR-0034).
- List publisher: a registration certificate is no longer issued when the signing access certificate's organisation
  identifier does not match its `sub` (or `intermediary.sub`); the publisher warns instead.
- `ops/gen-pki.ts --reissue=<name,…>` re-signs selected leaf certificates with their existing keys (not in production mode).

### 2026-10-09 — API reference and repository layout

- docs.tamga.network/api is part of the docs site (same theme, navigation and search, English and Turkish): an overview of
  every public HTTP interface and one reference page per API, generated from the OpenAPI 3.1 files at build time. The YAML
  files stay downloadable under /api/.
- New OpenAPI definitions for the public registries: trust lists, status lists, schema catalogue. The Tamga Verify definition
  matches the service (`spec_version`, `sdk_version`, `freshness`, `status.reason`, QR image and page kit endpoints).
- The public repository contains only what is needed to build and test the packages and services and to build the two sites;
  the root documents are in English.

### 2026-10-08 — packages: 0.2.0 test release

- The `@tamga-network/*` packages are versioned `0.2.0` (test release); later test rounds are `0.2.x`/`0.3.0`, and `1.0.0`
  comes when everything is ready. The verification result's `sdk_version` is `@tamga-network/verifier@0.2.0`.

### 2026-10-08 — no age limit

- The network sets no age limit, neither for listed wallets nor for the identity service; the condition is identity
  verification with a valid identity document, and each issuer decides eligibility for its own credentials.

### 2026-10-07 — hardening

- Packages: externally signed lists with JAdES `crit` load (federation); an array element request discloses only that
  element; expired credentials fail at step A7; status lists have size limits, a required `exp` and a bound on future `iat`;
  WUA/WIA `exp` is required; list version memory and `previous_version_hash` check; stricter intermediate certificate checks;
  only active ZK circuits are accepted; stricter mdoc and COSE handling.
- Protocol: intermediary rule checked in the wallet in both directions; pass token `iat`/`exp` bounds; a ZK infrastructure
  failure is INDETERMINATE and WASM runs in a separate worker; PAR `redirect_uri` allowlist; request object `exp`/`aud`
  checks; size limits; `release.yml` input injection closed.
- Services: only referenced certificates are published under `keys/`; result details only with the status token; rate limits
  (429 + `Retry-After`); sandbox PKI and lists in setup and CI.

### Documentation

- Tamga ARF 1.0: the Architecture and Reference Framework, Annex A — Trust Framework, Annex B — Tamga Rulebook with the
  credential-type rulebooks (Education, Identity, Event Ticket), Annex D — Definitions, Annex E — References, and the
  supporting pages Reading path, Roles and Onboarding.
- Developer docs in English and Turkish: guides (including the sandbox test network), concepts, specifications (credential
  format, SD-JWT VC, OpenID4VCI, OpenID4VP, verification pipeline and API, trust lists, status list, X.509 institutional
  identity, identity proofing, schema catalogue, wallet rules), decision records and a glossary.
- Sandbox: real identity verification steps, open to everyone with daily/monthly caps, and institution test accounts.

### Packages (`@tamga-network/*`, 0.2.0 test release)

- `core`, `trust`, `schemas`, `sd-jwt`, `mdoc`, `issuer` (+ `/client`), `verifier` (+ `/web`, `/zk`), `wallet-core`, `zk`.
- `zk`: wallet-side zero-knowledge proofs (Longfellow ZK) for mdoc — `/node` desktop prover, `/react-native` module (Android
  libraries for arm64-v8a, armeabi-v7a, x86_64; iOS pending). Its proofs pass `verifier/zk` end to end.
- `wallet-core`: wallet-generic parts only (WUA/WIA types, client attestation PoP, WIA status checks); DCQL `claim_sets` and
  `credential_sets`; a credential is never presented with missing claims (`matchDcql` returns `gaps`); key access policy
  (phone lock for credential keys, non-interactive signing for background flows); separate pass keys.
- `schemas`: `urn:tamga:id:DrivingLicenceAttestation:1` — verified driving licence information (not an official driving
  licence or mDL; the always-visible `not_official_licence` claim says so).
- `trust`: optional `test_institution` on sandbox issuer entries.
- `verifier/web`: "Open in your wallet" button.

### Services

- Trust list publisher (`trust.tamga.network`), reference verifier (Tamga Verify, `verify.tamga.network`), sandbox test network
  (`sandbox.tamga.network`).
- The network operates no wallet: the wallet provider service left this repository; trust lists keep a reserved entry for
  Tamga Wallet's provider until it supplies its certificate.
