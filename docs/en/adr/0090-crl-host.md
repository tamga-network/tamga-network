---
document_id: ADR-0090
title: "A separate host for CRLs: crl.tamga.network, http and https"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-18
last_updated: 2026-11-18
summary: >
  The access certificate revocation lists (CRL, [[ADR-0087]]) move out from under the trusted-list host to a dedicated host:
  `crl.tamga.network` on the production network, `crl.sandbox.tamga.network` in the sandbox. This host serves the same DER file over
  both `http` and `https`, without redirection; the CRL Distribution Points extension in certificates carries two addresses: first
  `http://`, then `https://`. Rationale: ETSI EN 319 412-2 V2.5.1 GEN-4.3.11-4 requires at least one distribution point to be `http`
  (or `ldap`) and RFC 5280 §8 advises against `https` in the distribution point; the EU reference Android wallet, however, does not
  download a CRL from a certificate that offers only `http`. Because the trusted-list host redirects every request to `https`, both
  schemes can only be served together on a separate host. Replaces the address rule of ADR-0087 K3; the CRL profile, freshness and
  revocation triggers do not change. Accepted: 2026-11-18.
domain: Trust
related: ["[[ADR-0058]]", "[[ADR-0068]]", "[[ADR-0087]]", "[[SPEC-TRUST-0001]]"]
translation_of: ADR-0090
source_version: 1.0.0
---

# In short

The revocation list (CRL) of relying parties' access certificates moves to its own host: `crl.tamga.network`. There the list is
served over both plain (`http`) and encrypted (`https`) connections as the same file, and certificates point to both addresses. The
EU standard requires the first address and the EU reference wallet requires the second; a separate host is the only clean way to
serve both together.

# Context

- [[ADR-0087]] K3 placed the CRL under the trusted-list host without opening a new host (`https://trust.tamga.network/crl/<ca>.crl`)
  and wrote only this `https` address into certificates. It works this way in the sandbox; on the production network the access
  certificate authority has not been set up yet (it comes with the key ceremony).
- **ETSI EN 319 412-2 V2.5.1 (2026-08) GEN-4.3.11-3/-4:** the distribution point shall point to at least one publicly available CRL,
  and at least one of these addresses shall be `http` (RFC 9110) or `ldap` (RFC 4516). TS 119 411-8 ties the certificate profile to
  this document through EN 319 411-1; the legal-person profile (EN 319 412-3) does not change this clause. Today's certificate, which
  offers only `https`, does not meet this clause.
- **RFC 5280 §8:** `https` is not recommended in the distribution point (circular dependency); if used, the server's TLS certificate
  must be verifiable without that CRL. Because the CRL is signed, plain transport does not weaken its integrity.
- **EU reference wallet:** the Android app disables cleartext traffic, and its go-live guide states that CRL checking always fails for
  a certificate that offers only `http` addresses; the platform CRL fetcher tries the addresses in the distribution point in order.
  On iOS, App Transport Security may also block `http` downloads.
- The trusted-list host's server block redirects every `http` request to `https` (together with HSTS); serving the same file over
  both schemes without redirection on that host would mean relaxing the rule for the whole trusted-list host.
- **Direction from project management:** a new subdomain is not avoided when needed; the more correct approach is chosen.

# Decision

## K1 — Address

| Network | Host | Files |
|---|---|---|
| Production | `crl.tamga.network` | `/access-ca-1.crl`, `/root-ca.crl` |
| Sandbox | `crl.sandbox.tamga.network` | `/access-ca-1.crl`, `/root-ca.crl` |

The path is `/<ca>.crl` at the root of the host (lower-case letters, digits, hyphen). Authority names are as in [[ADR-0087]] K2.

## K2 — Two schemes, no redirection

- The host serves the same DER file over `http` and `https`; an `http` request is not redirected to `https`, and the host has no HSTS.
- Response type `application/pkix-crl`, public, CORS open; nothing other than CRLs is published on the host (root and unknown paths
  404).
- The TLS certificate of the `https` side comes from the Web PKI, not from Tamga's access certificate authority or root.
- Requests are not logged (CRL fetches could show who checks which relying party).

## K3 — Distribution point in the certificate

Every access certificate and the access certificate authority's certificate carry a non-critical CRL Distribution Points extension
with a single distribution point; its `fullName` holds two addresses in this order: `http://crl.<network>/<ca>.crl`,
`https://crl.<network>/<ca>.crl`. There is no `cRLIssuer` and no `reasons` (the rest of [[ADR-0087]] K3 stays in force).

## K4 — Transition

- No access certificate has been issued on the production network, so there is no transition there; the first certificate is issued
  under this rule.
- In the sandbox the only certificate carrying a distribution point is the access certificate authority's; it is reissued with the
  same key and the new distribution point (the sandbox access certificates were issued before [[ADR-0087]] and carry no
  distribution point; those issued from now on follow this rule). The old `trust.sandbox.tamga.network/crl/` path is removed
  (development phase: no backward compatibility).
- `roles.access_ca.crl.issuers[].uri` in the configuration registry is the CRL's `http` address (`http://crl.<network>/<ca>.crl`);
  the `https` twin is derived from the same host and path, so both names always point to the same file. The publisher's
  configuration check verifies that the scheme is `http`, the host is the CRL host matching the trusted-list host, and the path is
  `/<name>.crl` at the root of the host.

# Options considered

| Option | Why not chosen |
|---|---|
| Under the trusted-list host, `https` only (ADR-0087 K3) | Does not meet EN 319 412-2 GEN-4.3.11-4; RFC 5280 §8 advises against it. |
| Under the trusted-list host, with a redirection exception for `http` | Relaxes the trusted-list host's HSTS and redirection rule; on an HSTS host, browsers upgrade `http` anyway. |
| `http` only | The EU reference Android wallet does not download a CRL from a certificate that offers only `http`. |
| OCSP | Considered in [[ADR-0087]]: CRL was chosen; OCSP is a later decision. |

# Invariants

| Code | Rule |
|---|---|
| CH1 | The distribution point in the access certificate and the authority certificate carries two addresses: first `http://crl.<network>/<ca>.crl`, then the `https://` address of the same path. |
| CH2 | The CRL host serves the same file over both schemes without redirection and publishes nothing other than CRLs; its `https` certificate does not come from the Tamga PKI. |

# Consequences

- New DNS records: `crl.tamga.network`, `crl.sandbox.tamga.network` (same server).
- The list publisher's configuration check, the PKI tools (`--crl-uri` with two addresses), the server configuration in the operator
  repository and [[SPEC-TRUST-0001]] §2 are updated according to this decision; a reference to this decision is added to [[ADR-0087]]
  K3.
- No change for the Tamga wallet core and verifier: they take trust from the signed list and do not fetch CRLs ([[ADR-0087]] AR5).

# Status

**Accepted — 2026-11-18.**
