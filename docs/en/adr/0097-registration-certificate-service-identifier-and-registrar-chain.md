---
document_id: ADR-0097
title: "Registration certificate: the EU name of the service identifier (serviceIdentifier) and trust in the registrar by chain"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-24
last_updated: 2026-11-24
summary: >
  Two small changes. (1) The service identifier in the registration certificate (WRPRC) is written with the EU name
  `serviceIdentifier` instead of Tamga's `service_id` (EU TS5 registration data model `services[].serviceIdentifier`; EU reference
  tools read this name). The field in the source registry and the `(rp_id, service_id)` pair of the embedded disclosure policy do
  not change. (2) The wallet accepts the certificate that signs a registration certificate in two ways: its fingerprint is a
  registrar key in the list (today's way), or the x5c holds a verified chain from the leaf to a registrar CA certificate in the
  list, with the leaf inside its validity period (ETSI TS 119 602 Annex G). The same applies to the signer of the registration
  certificate status list. The registrar signer certificate is published under `keys/`. Accepted: 2026-11-24.
domain: Trust
related: ["[[ADR-0026]]", "[[ADR-0046]]", "[[ADR-0068]]", "[[ADR-0029]]", "[[ADR-0091]]", "[[SPEC-TRUST-0001]]", "[[SPEC-WALLET-0001]]"]
translation_of: ADR-0097
source_version: 1.0.0
---

# In short

The registration certificate uses the EU field name (`serviceIdentifier`), and the wallet recognises the registrar's key not only
by pinning each key but also by a chain to a registrar CA in the list. Nothing changes for today's Tamga registrar.

# Context

- ARF RPRC_17a: the wallet checks that the registration certificate and the access certificate carry the same relying party
  identifier and the same service identifier. ETSI TS 119 475 has no field name for the service identifier; the EU TS5
  registration data model uses `services[].serviceIdentifier`. In the OpenID self-test the EU tool read this name and did not
  recognise our `service_id`.
- Today the wallet recognises the registration certificate signer only by fingerprint (LOTL `roles.registrar.signing_keys`). In
  ETSI TS 119 602 Annex G the listed certificates can be used to verify the signature of the registration certificate; a
  country's registrar may issue its signer certificates from a CA. Pinning alone means republishing the list on every signer change.

# Decision

## K1 — The service identifier is named `serviceIdentifier`

- The publisher writes the service identifier into the registration certificate as `serviceIdentifier` (value: the use's
  `service_id`, else `scope_id` — as in [[ADR-0046]]). The old `service_id` payload field is not written and the wallet does not
  read it (development phase, [[ADR-0029]]).
- Unchanged: the `scopes[].service_id` field in the source registry, the `relying_parties[].service_id` item of the embedded
  disclosure policy (matching is now against the certificate's `serviceIdentifier`) and the chain projection.
- Where the service identifier sits in the access certificate is not defined by the EU (ETSI TS 119 411-8 only mentions OU); the
  access certificate side of RPRC_17a waits for the EU.

## K2 — Trust in the registrar: pinned signer or chain

- The wallet (`wallet-core` `registrarSigned`) accepts the signer of a registration certificate (JWT and proximity CWT form) and
  of the registration certificate status list in one of two ways:
  1. **Pinned:** the leaf's SHA-256 fingerprint is in the country's LOTL `roles.registrar.signing_keys` and `ACTIVE`.
  2. **Chain:** in the x5c (at most 4 certificates) every signature from the leaf up to a listed certificate (the same
     `signing_keys`) verifies and names chain; the leaf is not a CA and, if it has key usage, carries `digitalSignature`; every
     certificate above the leaf (the listed CA included) has `cA=TRUE`, `keyCertSign` if key usage is present, and respects
     `pathLen`; every certificate except the anchor is inside its validity period. So a non-CA signer key — an expired signer or
     the pinned signer itself — cannot derive new signers.
- Only registrar keys are anchors; the national list's `root_cas` or any other anchor does not count for registration certificates.
- No new list field: a listed fingerprint may be the signer itself or the registrar CA that issued the signer.

## K3 — Publication

- The publisher publishes the registrar signer certificates named in the LOTL as `keys/<name>.cert.pem` (the fingerprints are
  already in the LOTL).

# Rationale / alternatives

- Name: the EU's own name was chosen. Keeping `service_id` and adapting to EU tools would keep the divergence.
- Trust: chain only (dropping pinning) would break today's registrar; pinning only diverges from the EU model. Both, additively.

# Invariants

| Code | Rule |
|---|---|
| RG1 | The signer of a registration certificate and of its status list is anchored only to the country's active registrar keys in the LOTL (pinned or chain); no other anchor counts. |
| RG2 | On the chain path every certificate above the leaf is a CA (`cA=TRUE`, `keyCertSign`, `pathLen`); every certificate except the anchor is inside its validity period; the chain has at most 4 certificates. |
| RG4 | Only a CA dedicated to registrar signers is listed as a registrar CA (no CA that issues other certificates). |
| RG3 | The service identifier in a registration certificate is carried as `serviceIdentifier`. |

# Consequences

- Residual risk (accepted): a pinned key is withdrawn at once by removing it from the list; a signer recognised by chain stays
  valid until its CA leaves the list or it expires. A country using a registrar CA issues short-lived signer certificates; the
  registration certificates themselves can already be revoked through the status list ([[ADR-0068]]).
- `@tamga-network/wallet-core` and the publisher change (CHANGELOG, next npm release). Registration certificates in the sandbox
  and on the real network are regenerated with the new name at the next publication.

# Status

**Accepted — 2026-11-24** (project management approval). DECISIONS: D-REG-7. RG1–RG4 are binding. Implemented the same day (with CA and validity checks after the security review):
`wallet-core` `registrarSigned`, `certValidity`, `certUsage`; `verifyWrprc`, `verifyWrprcCwt`, status list signer; publisher
`serviceIdentifier` and `keys/` publication; tests.
