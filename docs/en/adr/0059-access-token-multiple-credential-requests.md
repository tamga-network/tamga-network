---
document_id: ADR-0059
title: "Multiple credential requests within the access token lifetime"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-21
last_updated: 2026-10-21
summary: >
  The issuer's access token is no longer single-use: within its short lifetime (≤ 5 minutes, PR9) it can be used for several
  credential requests — as OpenID4VCI 1.0 §8 allows and the EU reference issuer does. Limits: only the credential configuration
  the token covers, a total of copies per token ≤ the batch size (10), every request with the DPoP key the token is bound to. In
  the identity service a later request with the same token adds copies to the first request's record and does not revoke the
  earlier package; personal fields are deleted when the token expires or the copy allowance is used up. The ZK copy token and
  tickets stay one package. Accepted: 2026-10-21.
domain: Protocol
related: ["[[SPEC-PROTO-0001]]", "[[ADR-0011]]", "[[ADR-0031]]", "[[ADR-0044]]"]
translation_of: ADR-0059
source_version: 1.0.0
---

# Context

- **Standard.** OpenID4VCI 1.0 §8: a credential request carries the access token; several requests with the same token (another
  configuration, more copies, a retry) are **not forbidden**. The EU reference issuer (eudi-srv-issuer) and national PID
  providers accept the token for several requests during its lifetime. HAIP 1.0 and FAPI 2.0 require the token to be
  sender-constrained with DPoP (we do this).
- **Until now.** In Tamga the access token was single-use: deleted after the first successful credential request, a second
  request got `401 invalid_token` ("one token = one package"). In the identity service a second package would have revoked the
  earlier one for the same document (K6 supersede).
- **OpenID conformance self-test (2026-10-21).** The suite's FAPI 2.0 happy flow and its "additional requests" module send
  several credential requests with the same token (with FAPI headers); the single-use token failed both modules (finding G7).

# Decision

## K1 — Several requests within the token lifetime
The access token can be used for several credential requests during its lifetime (≤ 5 minutes, PR9). The lifetime is not
extended.

## K2 — Limits
- Only the credential configuration the token covers (the type in the offer / PAR); another configuration gets
  `invalid_credential_request` or `unknown_credential_configuration`.
- **Total copies issued per token ≤ the batch size** (`MAX_COPIES_PER_ACCESS_TOKEN = BATCH_SIZE = 10`). A request beyond the limit
  is refused (`invalid_token`). The counter is kept in the database in one statement; concurrent requests cannot exceed it
  together.
- Every request with the DPoP key the token is bound to (RFC 9449); another key gets `401 invalid_dpop_proof`.

## K3 — Identity service: copies on the same record
A later request with the same token adds copies to the first request's record (same record identifier, same revocation
tracking); the earlier package is not revoked. One-time steps (review code, invitation, deleting the session at the identity
verification provider, pseudonym seed — [[ADR-0031]]) happen only on the first request. If the record was revoked or erased in
the meantime, the token no longer works.

## K4 — How long personal fields are kept (timing of [[ADR-0011]] K4)
The identity service deletes the personal fields in the authorisation record no longer at the first issuance but **when the
token expires or the copy allowance is used up** (at the latest ≤ 5 minutes + the periodic clean-up interval). The record is still
server-side only and never logged.

## K5 — What stays one package
The ZK copy access token ([[ADR-0044]]) and tickets (one credential per ticket) stay one package.

# Options considered

- **Keep single-use (previous state).** Not against the standard, but two suite modules keep failing and we diverge from EU
  issuers; a retry (network drop) needs a new authorisation.
- **Unlimited reuse.** Unlimited copies and status list index use; rejected.
- **Chosen:** short lifetime + configuration + copy limit + DPoP binding — the same approach as the EU reference issuer.

# Invariants

| Code | Rule |
|---|---|
| AT1 | An access token can request only the credential configuration it covers. |
| AT2 | The total number of copies issued with one access token does not exceed the batch size (10); concurrent requests cannot exceed the counter either. |
| AT3 | Every credential request uses the DPoP key the token is bound to; reuse does not extend the token lifetime (≤ 5 min). |
| AT4 | In the identity service a later request with the same token adds copies to the first request's record; it does not revoke the earlier package; no copies are added to a revoked or erased record. |
| AT5 | The identity service deletes the personal fields in the authorisation record when the token expires or the copy allowance is used up. |

# Implementation

- `@tamga-network/issuer` 0.7.2: `MAX_COPIES_PER_ACCESS_TOKEN`, `withinAccessTokenAllowance`.
- Platform: `credential_grants.copies` counter (schema step 10), `claimGrant(…, copies, max)` / `releaseGrant(…, copies)`; the
  institution issuer and the identity service no longer delete the token after issuance (clean-up at expiry), identity service
  K3–K4.
- Specification: [[SPEC-PROTO-0001]] §7.4.
- Tests: sequential requests with the same token accepted up to the limit, beyond the limit and after expiry refused, another
  DPoP key refused, concurrent requests cannot exceed the limit; in the identity service the same record, the earlier package not
  revoked, personal fields deleted once the allowance is used up.

# Status

**Accepted — 2026-10-21.** Approved by project management (OpenID conformance self-test finding G7; same approach as the EU
reference issuer). DECISIONS: D-PROTO-3.
