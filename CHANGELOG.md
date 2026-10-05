# Changelog — tamga-network

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Packages follow SemVer; they are published on npm as a
pre-release (`0.x`), so their interfaces may still change before `1.0`.

## [1.0.0] — 2026-10-04

First release of the Tamga Network documentation set and reference implementation.

### Documentation

- Tamga ARF 1.0: the Architecture and Reference Framework, Annex A — Trust Framework, Annex B — Tamga Rulebook with the
  credential-type rulebooks (Education, Identity, Event Ticket), Annex D — Definitions, Annex E — References, and the
  supporting pages Reading path, Roles and Onboarding.
- Developer docs in English and Turkish: guides (including the sandbox test network), concepts, specifications (credential
  format, SD-JWT VC, OpenID4VCI, OpenID4VP, verification pipeline and API, trust lists, status list, X.509 institutional
  identity, identity proofing, schema catalogue, wallet rules), architecture decisions (ADR-0001 … ADR-0041) and a glossary.
- Driving licence information (ADR-0039, D-ID-8): Identity Rulebook §10, Tamga Rulebook RB-AP-ID-08…10, SPEC-ID-0003 §9.3,
  credential types table.
- Sandbox (2026-10-04): invited real identity verification steps (ADR-0040, D-ID-9; RI1–RI6; `ADR-0038/SB3` rewritten) and
  institution test accounts (ADR-0041, D-TRUST-4; TI1–TI6); SPEC-TRUST-0001 §4 optional `issuers[].test_institution` (sandbox
  list only); Sandbox guide §8–§9; list publisher `sandbox-institution add` (sandbox intermediate CA `test-institutions-ca`).

### Packages (`@tamga-network/*`, pre-release `0.x`)

- `core`, `trust`, `schemas`, `sd-jwt`, `mdoc`, `issuer` (+ `/client`), `verifier` (+ `/web`, `/zk`), `wallet-core`.
- `trust`: optional `test_institution` on trusted list issuer entries (ADR-0041 TI2).
- `wallet-core`: revocation code for remote wallet closure (Tamga Wallet WA-ADR-0002). `generateLockCode` (4×5 characters,
  30-letter unambiguous alphabet, ≈ 98 bit), `normalizeLockCode` / `isLockCode` / `formatLockCode`, `lockCodePrehash`
  (domain-separated SHA-256 — the only thing the wallet provider ever receives). `registerLockCode` binds the pre-hash to the
  wallet unit; `wiaRevokedByList` reads the wallet's own entry from the provider's **signed** WIA status list (signer must be a
  wallet provider key in the pinned trusted list) — the only input a wallet may wipe itself on; `unitStatus` is a hint only.
  `WP_PATHS` names every wallet-provider route in one place. `WalletError` code `unit_revoked`; `WalletState.lockCode` and
  `settings.localNotifications` fields.
- `schemas`: `urn:tamga:id:DrivingLicenceAttestation:1` — verified driving licence information issued by the identity service
  (ADR-0039). Not an official driving licence or mDL: the always-visible `not_official_licence` claim and the display name say so.
  Claims: names, `birth_date`, `issuing_country`, `document_number_hash`, `driving_privileges[]` (category + dates), card
  issue/expiry dates, `verified_at`, `verification_method`, `age_over_18`. No national ID number, restriction or health codes,
  photo or address. SD-JWT VC only; status list; validity at most one year. Trust lists (real + sandbox): the identity service
  is authorised for the type.
- `wallet-core`: `DRIVING_LICENCE_VCT`; `startAuthorized({ parExtra })` adds issuer-specific PAR fields (the identity
  presentation `identity_presentation` that the driving licence flow requires).
- `wallet-core`: DCQL options (OpenID4VP 1.0 §6). `claim_sets` — only the first combination the wallet can satisfy is
  requested; other claims are not disclosed. `credential_sets` — `selectDcql` / `chooseDcqlOption`: one option per
  required set (verifier's order, user may switch), optional sets are not shared unless the user opts in, queries outside the
  chosen options are not presented. `checkDcqlShape` rejects malformed queries (duplicate ids, missing claim ids, unknown ids).
- `wallet-core`: a credential is never presented with missing claims (OpenID4VP 1.0 §6.4.1; SPEC-PROTO-0002 PV12).
  Without `claim_sets`, a credential that lacks any requested claim does not satisfy the query. `matchDcql` returns `gaps` —
  why each unmatched query failed (`no_credential`, `missing_claims` with the claim names, `values`) — so the wallet can tell
  the user. Verifiers ask for a claim the credential may not carry with `claim_sets`.
- `wallet-core`: key access policy (`KeyPolicy`): `user_auth` credential keys are bound to the phone lock (device biometrics or
  passcode, one prompt per presentation); `device_unlocked` protocol keys (unit, WIA, DPoP, pass) need only an unlocked phone.
  `sign(…, { interactive: false })` / `HardwareKeyProvider.quiet()` never prompt and fail with `auth_required` — background
  flows (copy refresh, pass refresh) skip silently. Native `ERR_KEY_INVALIDATED` maps to `key_invalidated`. Passes get their
  own key: `newPassKeyRef` / `makePassKeyProof` (`pass_key`, bound to the request nonce); the verifier binds the grant to it.
  Silent copy refresh tries a non-interactive signature with a credential-policy key before contacting the institution, so a
  single-use refresh token is never spent when the phone lock is needed; if a later step fails, the rotated token and the
  DPoP key are kept.
- Reference verifier: an invalid `pass_key` proof no longer rejects the presentation; the pass is simply not issued
  (`pass: { issued: false, reason }`).
- Wallet rules (SPEC-WALLET-0001): WL11 and §2.3 state how presentations are verified on secure hardware (phone lock) and on
  the software-key path, and when the app PIN is the fallback.

### Services

- Trust list publisher (`trust.tamga.network`), reference verifier (Tamga Verify, `verify.tamga.network`), wallet provider
  (`wallet.tamga.network`; moves to the Tamga Wallet repository), sandbox test network (`sandbox.tamga.network`).
- `wallet-provider`: `POST /units/revocation-code` (scrypt slow hash of the pre-hash, bound to the unit; the previous code
  stops working; a hash already bound to another unit is refused with 409), `POST /units/status`, and `POST /units/revoke`
  also accepts a `revocation_code` instead of a signed proof. `GET|POST /lost` — the "I lost my phone" page (TR/EN, no scripts,
  `no-store`, not frameable; form bodies parsed only on this route): code + irreversible confirmation → unit and all its WIA
  entries revoked. Unknown and malformed codes get the same answer after the same slow hash and a minimum response time; no
  global attempt counter (it would let one source lock everyone out), instead a cap on concurrent slow hashes (503 +
  Retry-After); nothing about the code or the caller is logged. Metadata advertises the endpoints.
- `wallet-provider`: device attestation never blocks registration — an unverifiable attestation registers the unit at
  software level and the response says why (`attestation`, `reason`); the invalid-attestation counter is not exposed on
  `/healthz`. Optional Play Integrity: the token is sent to Google only when the Android key attestation of the same request
  verified; the token and decode calls, including reading the bodies, share one 5 s budget; a malformed service account file
  or unusable private key disables Play Integrity at start-up with one fixed log line that prints no content. For an
  `invalid` attestation the response carries only the reason code.
