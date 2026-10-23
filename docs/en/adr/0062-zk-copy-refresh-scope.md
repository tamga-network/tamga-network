---
document_id: ADR-0062
title: "ZK copy refresh token only when the ZK copy scope is requested"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-23
last_updated: 2026-10-23
summary: >
  The identity service no longer issues the ZK copy refresh token (ADR-0044 K3) with every identity credential authorisation but
  only when the wallet requests the ZK copy scope (`urn:tamga:id:ShortLivedIdentityAttestation:1`) next to the identity credential's
  scope. The refresh token is then for the scope it was issued for (RFC 6749 §6): a token obtained with the identity credential
  scope would be of no use for obtaining the identity credential again, so it is not issued. The scope can only be requested
  together with the identity credential. The Tamga wallet requests it automatically when the service declares ZK copies; its
  behaviour does not change. Narrows ADR-0044 K3. Accepted: 2026-10-23.
domain: Protocol
related: ["[[ADR-0044]]", "[[ADR-0060]]", "[[SPEC-PROTO-0001]]"]
translation_of: ADR-0062
source_version: 1.0.0
---

# Context

- **ADR-0044 K3.** When the identity credential is issued, the token response carries a `refresh_token`; it does not renew the
  identity credential, it only obtains short-lived ZK copies (the identity service does not keep person fields — ADR-0011 K4).
- **Standard.** RFC 6749 §6: if the refresh request carries no scope, the new access token is treated as having the scope
  originally granted. A refresh token obtained with the identity credential scope is expected to yield the identity credential;
  ours can only yield ZK copies, so it cannot meet that expectation.
- **OpenID conformance self-test (round 3, finding G20).** The FAPI 2.0 `refresh-token` module requests the identity credential
  with the refreshed access token; it was refused with `this access token is only for ZK copies`.

# Decision

## K1 — When the scope is requested
The identity service issues the ZK copy refresh token only if the authorisation (PAR `scope`) contains the ZK copy scope next to the
identity credential scope. The scope cannot be requested with another type or on its own (`invalid_scope` / `invalid_request`).
The access token obtained with the refresh token has the ZK copy scope (`scope` in the response).

## K2 — Wallet
When the service metadata declares a ZK copy configuration (`mso_mdoc`, `doctype` = ZK copy), the wallet also requests its `scope`
in the identity credential request. The Tamga wallet's behaviour (identity credential + ZK copy binding) does not change.

## K3 — Unchanged
The rest of ADR-0044 (ZC1–ZC3, generation counter, two-phase rotation) and ADR-0060 (client instance key binding) as they are.

# Options considered

- **Always issue the token, `scope` = ZK copy in the response.** In line with RFC 6749 §5.1, but the refresh token is for a scope
  that was not requested; a client assumes it can renew the identity credential scope.
- **Re-issue the identity credential on refresh.** Person fields are not kept (ADR-0011 K4); impossible and not wanted.
- **Chosen:** the token only when the ZK copy scope is requested explicitly — the refresh token is for the scope it was issued for.

# Invariants

| Code | Rule |
|---|---|
| ZS1 | The identity service issues the ZK copy refresh token only when the authorisation contains the ZK copy scope together with the identity credential scope. |

# Implementation

- `@tamga-network/issuer` 0.7.2: `createPar({ allowedCompanionScopes })` → `ParRequest.companionScopes`. wallet-core 0.7.2:
  `companionScopes`, `startAuthorized` adds the ZK copy scope for the identity credential.
- Identity service: companion scope at PAR (ZK copy only, only with the identity credential), the token only when the scope is
  present; AS `scopes_supported` includes the ZK copy scope.
- Specification: [[SPEC-PROTO-0001]] §4.2.

# Status

**Accepted — 2026-10-23.** Within project management's general conformance approval ("let us be compatible with EU standards,
close our gaps, do it the way it should be done"): a fix that narrows ADR-0044 K3 in line with the standard; the Tamga wallet's
behaviour did not change. DECISIONS: D-ZK-3.
