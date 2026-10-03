---
document_id: ADR-0016
title: "Access to hosted issuance"
status: Active
version: 1.0.0
created: 2026-09-27
last_updated: 2026-10-02
summary: >
  The operator endpoints of the hosted issuance service (`/{slug}/admin/*`) are reachable today only from the server itself
  (127.0.0.1) and protected by a single shared admin key. So that an external institution (ticket seller, university system)
  can call offers/tickets/revocations from its own server with `@tamga-network/issuer/client`, a separate, tenant-bound,
  scoped API surface is decided.
domain: Services
translation_of: ADR-0016
source_version: 1.0.0
---

# Context

- The nginx `issuer.` block closes the `/{slug}/admin/` path with `allow 127.0.0.1; deny all`; the application expects
  `x-admin-token` (a single token shared by all tenants). This is right for the demo portal (same server).
- With D10/D14 a client was written for external institutions ([[t:issuer]]s) (`@tamga-network/issuer/client`:
  `createOffer`, `sellTicket`, `revoke`…); in production there is no safe way to reach these endpoints from outside. Giving
  the shared admin key to institutions would let one tenant revoke another tenant's credentials.

# Decision

1. **K1 — Separate surface:** `/{slug}/api/v1/*` (offers, tickets, revocations). `/{slug}/admin/*` stays internal
   (127.0.0.1).
2. **K2 — Tenant API key:** one or more keys per institution; `Authorization: Bearer tmg_<slug>_<random>`. The server stores
   only the **digest** (SHA-256); the key is shown once, at creation. A key is bound to a `slug` and a **scope**
   (`offers:write`, `tickets:write`, `revocations:write`); it is invalid on another tenant's path.
3. **K3 — Rotation and revocation:** keys have an expiry date (suggested 90 days); two keys may be valid at the same time
   (seamless rotation); revocation takes effect immediately.
4. **K4 — Limits:** a rate limit per key and a request size limit; the audit record holds the key identifier (digest
   prefix) and the event name — no personal data and never the key itself (PR14/AP3).
5. **K5 — Pilot option:** for institutional integrations such as a university, mTLS (the institution's X.509 certificate,
   matching its entry in the [[t:trust-list]]) can be made mandatory in addition to K2.
6. **K6 — Client:** `createIssuerClient({ baseUrl, slug, apiKey })`; `adminToken` remains for internal use only.

# Rationale / alternatives

- **Exposing the shared admin key:** no authorisation between tenants → rejected.
- **OAuth 2.0 client credentials:** correct, but needs an extra authorisation server; heavy for the first institutions. K2
  can move to OAuth later.
- **mTLS only:** strong, but certificate management is a barrier for small sellers; K5 is kept as an option.

# Invariants

| # | Rule |
|---|---|
| HA1 | External access only with a tenant-bound, scoped API key; the shared admin key is never exposed. |
| HA2 | The server stores an API key only as its digest; logs and audit records never contain the key itself. |
| HA3 | A key is valid only on its own `slug`'s paths and for operations within its scope. |

# Status

**Accepted — 2026-09-27.** DECISIONS: D-API-1. Note: K5 (mTLS) will be assessed in the pilot university integration.

Implementation: API routes and key store in `apps/issuer` (operator repository), the nginx `api/v1` block, the `apiKey` option in
`issuer/client`, the institution guide (docs site).
