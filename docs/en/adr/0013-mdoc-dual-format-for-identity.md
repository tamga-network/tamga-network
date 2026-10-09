---
document_id: ADR-0013
title: "mdoc for the identity credential"
status: Active
version: 1.0.0
created: 2026-09-26
last_updated: 2026-10-09
summary: >
  The Tamga identity attestation ([[ADR-0011]]) is issued today only as an SD-JWT VC. This ADR decides that the same
  credential, with the same fields, is also issued as an ISO/IEC 18013-5 mdoc (CBOR + COSE). Reason: the browser Digital
  Credentials API in Safari/iOS accepts only mdoc, and the ARF requires mdoc for identity (PID); proximity presentation
  (ISO 18013-5, Bluetooth in phase 1) carries mdoc. SD-JWT VC stays the primary format; mdoc is a parallel, opt-in second
  representation bound to the same `cnf`/holder key. Implementation: `@tamga-network/mdoc` (pure @noble, React Native
  compatible). **Accepted: 2026-09-26 → D-CRED-5.**
domain: Identity
translation_of: ADR-0013
source_version: 1.0.0
---

# Context

[[ADR-0006]] chose [[t:SD-JWT-VC]] as the [[t:credential]] format; all our credentials (student, diploma, identity, ticket)
use it. [[ADR-0011]] defined the Tamga provisional identity [[t:attestation]] (`urn:tamga:id:IdentityAttestation:1`) — again an
SD-JWT VC. [[SPEC-CRED-0001]] §1 had planned [[t:mdoc]] from the start as a **secondary format ("phase 2")**; this ADR brings it
forward for the identity credential (it does not change a closed decision; it activates a planned one).

Two external facts push us towards a second format:

1. **The browser Digital Credentials API.** Chrome 141 accepts OpenID4VP with both SD-JWT VC and mdoc; **Safari 26 / iOS 26
   accepts only mdoc**. Once "Sign in with Tamga" (D11) moves to
   the browser API, mdoc is required for iPhone Safari users.
2. **eIDAS 2.0 / ARF.** The [[t:ARF]] makes mdoc (ISO 18013-5) mandatory for person identification data ([[t:PID]]) and
   SD-JWT VC optional. Proximity presentation (turnstile, door — [[ADR-0012]] phase 1 Bluetooth) also carries ISO 18013-5
   mdoc. Tamga does not issue PID, but its identity attestation is the provisional equivalent of a PID; aligning with the EU
   precedent requires mdoc.

Direction from project management (2026-09-26): turnstile and ticket flows should match EUDI; the mdoc format is built. mdoc is
the format itself (CBOR + COSE); Bluetooth transport is separate and needs an Apple Developer account and a native module
(phase 1). This ADR covers only the **format**; transport is in [[ADR-0012]] phase 1.

# Decision

1. **The identity attestation is issued in two formats:** SD-JWT VC (primary, unchanged) + ISO 18013-5 mdoc (parallel,
   opt-in). Same fields, same `iat/exp`, **the same [[t:holder]] key** (SD-JWT `cnf.jwk` = mdoc `deviceKey`), separate
   [[t:issuer]] signatures (SD-JWT: JOSE/ES256; mdoc: COSE_Sign1/ES256). Both credentials are produced in one issuance flow;
   the wallet stores both.
2. **docType** = `urn:tamga:id:IdentityAttestation:1` (the same URN as the vct); **namespace** = `tamga.id.1`. Element names
   match the SD-JWT claim names one to one (`given_name`, `family_name`, `document_number_hash`, `age_over_18`, …). *Changed
   (2026-10-09, [[ADR-0045]]):* the two formats carry the same data; the name and encoding in each format follow the EU PID table
   (Implementing Regulation (EU) 2026/1731) — SD-JWT `birthdate` / `nationalities` ↔ mdoc `birth_date` (full-date) /
   `nationality` (array); the other names are the same.
3. **The verification format is chosen with [[t:DCQL]]:** the [[t:verifier]] states `format: dc+sd-jwt` or `mso_mdoc` in its
   request; the channel (QR / deep link / DC API) stays the same. For mdoc the verifier checks the issuerAuth COSE signature
   via x5chain → [[t:trust-list]] ([[SPEC-TRUST-0001]]), the element digests via the MSO, and the device signature over the
   SessionTranscript.
4. **CBOR determinism:** RFC 8949 §4.2.1 (bytewise). We mark the ISO 18013-5 reference to RFC 7049 §3.9 (length-first) as a
   full-interoperability item for the pilot; since the whole ecosystem uses one library (`@tamga-network/mdoc`), digest
   consistency is ensured.
5. **SessionTranscript:** the handovers of [[t:OpenID4VP]] 1.0 Final Annex B.2.6: `OpenID4VPHandover` in the redirect flow
   (B.2.6.1 — client_id, [[t:nonce]], the JWK thumbprint of the key the response is encrypted to, response_uri) and
   `OpenID4VPDCAPIHandover` in the browser Digital Credentials API (B.2.6.2 — origin, nonce, JWK thumbprint). Proximity
   (Bluetooth) uses the ISO 18013-5 session SessionTranscript. *Implementation note (2026-10-09):* the original text planned a
   deterministic digest for the demo and ISO 18013-7 Annex B for the pilot; the implementation moved straight to the OpenID4VP
   1.0 Final form, so no deviation remains here.
6. **Scope:** only the identity attestation. Student certificate, diploma and ticket stay SD-JWT VC (no need for mdoc; browser
   sign-in and the PID precedent apply only to identity). The same mechanism is extended if a need arises.

# Rationale / alternatives

- **SD-JWT VC only (today):** browser sign-in on Safari is impossible, and there is no alignment with the ARF PID precedent.
  Rejected.
- **Full switch to mdoc (drop SD-JWT VC):** breaks the existing issuer/verifier/wallet pipeline and our OpenID4VP profile
  ([[SPEC-PROTO-0002]]); SD-JWT VC is simpler for web and remote use. Rejected.
- **Two formats (chosen):** this is what the EU does for identity. Cost: a second issuance and verification path plus tests;
  gain: Safari DC API, ARF alignment and readiness for phase 1 Bluetooth. `@tamga-network/mdoc` is standalone, pure @noble;
  no additional runtime dependency.

# Invariants

| # | Invariant |
|---|---|
| **MD1** | mdoc is only a second representation of the SD-JWT VC; SD-JWT VC remains primary (ADR-0006 unchanged). If a type has an mdoc, its fields (the data; name and encoding per format from the EU PID table — [[ADR-0045]]), `iat/exp` and holder key are identical to the SD-JWT. |
| **MD2** | mdoc `deviceKey` = SD-JWT `cnf.jwk` (the same holder key, the same device binding). No separate key is generated. |
| **MD3** | mdoc issuerAuth (COSE_Sign1) is ES256 only; the issuer certificate is carried in x5chain and matched against the [[SPEC-TRUST-0001]] trust list (issuer_id) — the same trust anchor as SD-JWT. |
| **MD4** | Verification keeps the three-valued result ([[SPEC-API-0001]]); digest mismatch/expiry/revocation is REJECTED, infrastructure unavailability is INDETERMINATE. The result object contains no raw CBOR and no undisclosed element. |
| **MD5** | mdoc carries personal data values only inside IssuerSignedItem; the MSO, the anchor log and logs contain only digests/keys/dates (DP1/AP3 preserved). |

# Consequences

- **New package** `@tamga-network/mdoc` (CBOR + COSE_Sign1 + MSO issuance/disclosure/verification + device authentication;
  15 tests).
- **Implementation (D12 phase 2):** second-format issuance in `apps/id`; mdoc storage and presentation in
  `@tamga-network/wallet-core`; an mdoc verification path in `@tamga-network/verifier` + `apps/verify`; DCQL `mso_mdoc`;
  version updates of [[SPEC-CRED-0001]] / [[SPEC-PROTO-0002]]; an FW-ARF row. Scene 15 (identity → mdoc →
  [[t:selective-disclosure]] → verification).
- **DECISIONS:** D-CRED-5 + INVARIANTS MD1–MD5.

# Status

**Accepted — 2026-09-26.** DECISIONS: D-CRED-5.
Drafted 2026-09-26 (Proposed, package + 15 tests); accepted the same day and implemented in D12 phase 2. Extends ADR-0006
without changing it.

2026-10-09: the naming rule in K2 and MD1 changed with [[ADR-0045]] (EU PID encoding, D-ID-11).
