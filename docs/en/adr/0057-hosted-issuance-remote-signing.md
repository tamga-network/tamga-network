---
document_id: ADR-0057
title: "The institution's signing key in hosted issuance: remote signing (CSC API)"
status: Proposed
version: 1.0.0
created: 2026-10-20
last_updated: 2026-10-20
summary: >
  An institution that uses the hosted issuing service keeps its credential and status list signing keys: the key lives in the
  institution's HSM or with a trust service provider of its choice, and the service requests each signature through the Cloud
  Signature Consortium API v2 (`signatures/signHash`). Only the SHA-256 digest of the data to be signed is sent; no credential
  content and no personal data. The returned signature is verified locally against the institution's certificate in the trust
  list. On the production network the institution's key is never read from a file (PM-GOV G1, deviation S-1). Proposed —
  awaiting project management approval.
domain: Identity
related: ["[[ADR-0016]]", "[[ADR-0020]]", "[[ADR-0050]]", "[[SPEC-ID-0002]]", "[[SPEC-PROTO-0001]]"]
translation_of: ADR-0057
source_version: 1.0.0
---

# Context

- The hosted issuing service ([[ADR-0016]]) signs credentials on behalf of the institution and **with the institution's key**.
  The project rule is explicit: in hosted services the signing key never sits with the network operator (PM-GOV G1). Today the
  sandbox institutions' keys are test keys stored as files on the server (deviation S-1); the production network has no
  institution yet.
- The institution onboarding guides say "the keys are generated in the institution's KMS/HSM; only a certificate signing
  request (CSR) is sent". But there was no defined way for the service to use such a key: the code only read file keys. For the
  first institution this is a blocker.
- The institution can also run its own issuing service (`@tamga-network/issuer`); that path already keeps the key with the
  institution but requires running an OpenID4VCI server. The hosted path must keep the key with the institution as well.
- In the EU the established interface for remote signatures and seals is the Cloud Signature Consortium API (CSC API v2,
  aligned with ETSI TS 119 432). Qualified trust service providers and HSM products offer it.

# Proposed decision

## K1 — The institution's key stays with the institution; signing is remote

In the hosted service, the institution's credential signing key and status list signing key ([[ADR-0050]] K1) are generated
and kept in the institution's HSM or with the trust service provider the institution contracts. The service requests signatures
through **CSC API v2**:

1. an access token with OAuth 2.0 client credentials (`client_credentials`, `scope=service`);
2. `credentials/authorize` — authorisation (SAD) for one signature, bound to the digest to be signed;
3. `signatures/signHash` — `hashAlgorithmOID` SHA-256 (2.16.840.1.101.3.4.2.1), `signAlgo` ecdsa-with-SHA256
   (1.2.840.10045.4.3.2).

The key remains P-256 ([[SPEC-ID-0002]]); the certificate is issued by the root certificate authority on the institution's CSR
and enters the trust list (unchanged).

## K2 — Only a digest is sent

The service sends only the SHA-256 digest of the data to be signed (the JWS signing input or the COSE structure). Credential
content, personal data and the person's key never reach the remote signing service; the service does not learn to whom a
credential was issued.

## K3 — The returned signature is verified locally

The service verifies every signature with the public key of the institution's certificate in the trust list. A signature that
does not verify (wrong key, corrupt answer) is not used; no credential is issued. If the signing service is unreachable, no
credential is issued and the person retries later (as when the authentic source is unreachable, [[ADR-0020]]).

## K4 — No file keys on the production network

On the production network the institution's key is never read from a file on the service host; the configuration refuses it
and the institution is not started. File keys are only for local development, tests and the sandbox (sandbox test keys,
[[ADR-0038]]).

## K5 — Secrets and limits

The client secret of the remote signing service (and the signing PIN, if the service requires one) live in the service host's
secret environment; they are never written into the tenant file or the repository. Service addresses are HTTPS only. The
institution can withdraw the signing authorisation at any time (by disabling the client in its service); this immediately stops
the service from issuing on its behalf.

# Rationale / alternatives

| Option | Result | Why |
|---|---|---|
| Keep the institution's key as a file on the service host | rejected | PM-GOV G1 |
| A cloud provider's own key service (single provider) | rejected (on its own) | Ties the institution to one provider; the CSC interface is provider-neutral |
| A Tamga-specific signing endpoint run by the institution | rejected | Would be a new, non-standard contract; CSC already exists |
| **Remote signing with CSC API v2 (digest only)** | **proposed** | The established EU interface; the same path when moving to the qualified class |
| The institution runs its own issuing service | kept | Remains the second path ([[ADR-0016]]) |

# Proposed rules (moved to the binding table if accepted)

| Code | Rule |
|---|---|
| RS1 | In the hosted service, the institution's credential and status list signing keys stay with the institution or its trust service provider; the service requests signatures through CSC API v2. |
| RS2 | Only the SHA-256 digest of the data to be signed is sent to the remote signing service; no credential content and no personal data. |
| RS3 | The service verifies every remote signature with the institution's certificate in the trust list; no credential is issued with a signature that does not verify. |
| RS4 | On the production network the institution's key is never read from a file on the service host. |

# Open questions (project management)

1. Accepting CSC API v2 as the single remote signing interface of the hosted service.
2. Which remote signing service for the first institution (its own HSM or a trust service provider) — together with the
   institution.
3. Signing all copies of a credential in one request (CSC multi-hash) instead of one request per signature — if speed requires.

# Status

**Proposed — 2026-10-20.** Awaiting project management approval. The implementation is ready and tested (the `csc:` key
reference in the hosted service); refusing file keys on the production network is PM-GOV G1 itself and applies independently of
this decision.
