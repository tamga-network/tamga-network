# Changelog — tamga-network

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The `@tamga-network/*` packages are versioned together and
published on npm as test releases; `0.6.0` is the current one (the API may change until the stable `1.0.0`). The documents
(docs, Tamga ARF) stay at 1.0.0 until the public announcement; their changes are folded into that release (last entry).

## Unreleased

### Trust list publisher (`apps/trust-publisher`)

- Chain projection (proposed decision ADR-0051; **off by default**, no production chain exists): `chain-anchor` writes only the
  digests of the signed trust lists (`sha256(<file>.jws)`, version, previous digest, issue time) and of the anchor log's latest
  line to a trust list anchor registry contract; `chain-check` tells a verifier whether a list digest is anchored
  (`YES` / `NO` / `UNKNOWN`). The signed lists remain the source of truth: on conflict the list prevails and the chain answer
  is never required for verification. Feature flag `TAMGA_CHAIN_ENABLED` (default `0`): while off nothing connects to a chain;
  `--dry-run` prints the plan. An anchor counts only once the registry's confirmation threshold of distinct writers has
  submitted identical data (production threshold ≥ 2). New dependency `ethers` (app only, not in the published packages).

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

### Reference verifier (`apps/verify`)

- Fixed: the scope check E3 now uses the registration of the relying party that opened the presentation. Before, a presentation
  opened on behalf of another relying party was checked against the verifier's own (wider) registration, so a wallet that
  disclosed more than asked could pass that party an attribute outside its registered scope (ADR-0017 K7/HV6, AP6).
- The control view key (`?show=`) is compared in constant time.

### Documents

- Status list verification step Ş5 and verification step D4: `ttl` is a refresh hint; the token stays usable until `exp` and the
  policy's `max_status_token_age_sec` (as in §8.1 and in the code). PR13: a redirect address outside the allowlist is rejected
  with `invalid_request` (RFC 9126 §2.1), as the services answer.

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
