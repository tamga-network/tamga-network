---
document_id: ADR-0060
title: "Refresh token bound to the client instance key"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-22
last_updated: 2026-10-22
summary: >
  The refresh token (silent refresh of institution credentials, ADR-0023, and the identity service's ZK copy token, ADR-0044) is
  no longer bound to the DPoP key but to the `cnf` key of the client attestation (WIA) used at issuance — the client instance key
  (OAuth 2.0 Attestation-Based Client Authentication §10.3; RFC 9449 §5). A refresh needs a fresh WIA for that key; the DPoP key
  may change and the new access token is bound to the new DPoP key. The wallet keeps using a new WIA key for every operation
  (ADR-0025 K6: institutions cannot link the wallet); it keeps the WIA key of the operation that returned a refresh token with the
  credential and, when refreshing, asks the provider for a fresh WIA for that key. Changes the "bound to the DPoP key" rule of
  ADR-0023 and ADR-0044 K3. Accepted: 2026-10-22.
domain: Protocol
related: ["[[ADR-0023]]", "[[ADR-0025]]", "[[ADR-0044]]", "[[SPEC-PROTO-0001]]", "[[SPEC-WALLET-0001]]"]
translation_of: ADR-0060
source_version: 1.0.0
---

# Context

- **Standard.** RFC 9449 §5: the refresh token of an authenticated client is not bound to the DPoP key but to the client; the
  DPoP key may change on refresh. OAuth 2.0 Attestation-Based Client Authentication (draft -07) §10.3: for a client authenticated
  with a client attestation, the authorisation server binds the refresh token to the **client instance key** (the attestation's
  `cnf`); a refresh with another instance key is refused.
- **Until now.** In Tamga the refresh token was bound to the DPoP key used at issuance ([[ADR-0023]], [[ADR-0044]] K3); the WIA
  is obtained with a new key for every operation ([[ADR-0025]] K6), which is why the binding was put on the DPoP key.
- **OpenID conformance self-test (2026-10-21, finding G12).** The FAPI 2.0 `refresh-token` module refreshes with a new DPoP key and
  the same client attestation (must succeed), then with an attestation for another instance key and the old DPoP key (must be
  refused). Our binding gave the opposite result in both.

# Decision

## K1 — Binding to the client instance key
The refresh token is bound to the RFC 7638 thumbprint of the `cnf.jwk` of the client attestation (WIA) of the operation that
issued it. The WIA presented on refresh must carry the same `cnf` key; otherwise `invalid_grant`. A DPoP proof is still required
(the key may change); the new access token is bound to the new DPoP key.

## K2 — The wallet keeps the instance key with the credential
The WIA is still obtained with a new key for every operation (ADR-0025 K6). The WIA key used in the operation that returned a
refresh token is written into the credential's refresh binding (`instanceKeyRef`) and not deleted; on refresh the wallet asks the
provider for a fresh (< 24 h) WIA **for that key**. The key is shown only to the institution that issued the credential; other
institutions see other keys (unlinkability is kept). When the credential is deleted the key is deleted too (unless another
binding or the wallet's current WIA uses it).

## K3 — Scope
The institution issuer's refresh token ([[ADR-0023]]) and the identity service's ZK copy token ([[ADR-0044]] K3). Old (DPoP-bound)
tokens stop working (development phase, [[ADR-0029]]); the wallet gets a new one with the next issuance.

# Options considered

- **Keep the DPoP binding.** Not required by the standard; two suite checks keep failing.
- **DPoP or instance key (either).** Does not meet ATCA §10.3's "refuse another instance key".
- **One persistent instance key for the wallet.** Every institution would see the same key — against ADR-0025 K6 (linkability).
- **Chosen:** an instance key per credential — the standard binding plus unlinkability across institutions.

# Invariants

| Code | Rule |
|---|---|
| RT1 | The refresh token is bound to the client instance key (thumbprint of the WIA `cnf` at issuance); a refresh needs a WIA for the same key. |
| RT2 | A DPoP proof is required on refresh; the new access token is bound to that request's DPoP key. |
| RT3 | The wallet uses a refresh binding's instance key only with the institution that issued that credential; other operations use a new WIA key. |

# Implementation

- `@tamga-network/issuer` 0.7.2: `clientInstanceJkt`. wallet-core 0.7.2: `RefreshBinding.instanceKeyRef`,
  `ZkCopyBinding.instanceKeyRef`, `wuaForBinding`, `autoRefreshCredential` / `refreshZkCopies` `wuaForInstance`,
  `instanceKeysInUse`; `removeCredential` also deletes the binding's key.
- Platform: institution issuer `refresh_tokens.instance_jkt` (schema step 11) and the instance-key check on refresh; identity
  service `ijk` in the ZK token.
- Wallet (Tamga Wallet): provider protocol `requestWia({ keyRef })` (WIA for an existing key); bound keys are not deleted when the
  WIA changes.
- Specification: [[SPEC-PROTO-0001]] §4.1–4.2.

# Status

**Accepted — 2026-10-22.** Approved by project management (OpenID conformance self-test finding G12). DECISIONS: D-PROTO-4.
