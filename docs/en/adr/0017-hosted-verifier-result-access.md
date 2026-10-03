---
document_id: ADR-0017
title: "Access to verification results"
status: Active
version: 1.0.0
created: 2026-09-27
last_updated: 2026-10-02
summary: >
  The endpoint of the hosted verifier (`verify.tamga.network`) that returns disclosed values
  (`GET /presentations/:id/claims`) currently answers anyone who knows the presentation identifier (a capability URL). Before
  opening it to real sites: the relying party (RP) that opened the presentation proves its identity with a short-lived
  assertion signed by the key registered in the trust list; values are released only to that RP and only once. No new secret
  and no new infrastructure are needed.
domain: Services
translation_of: ADR-0017
source_version: 1.0.0
---

# Context

Internal review Y8 (2026-09-27): `apps/verify/src/routes/presentations.ts`

- `POST /presentations` requires no authentication; anyone can open a presentation with any policy.
- `GET /presentations/:id` returns the result (claim **names**, AP3), `GET /presentations/:id/claims` the disclosed
  **values**. Both require only knowledge of the presentation identifier (72 random bits). The identifier also appears in the
  `/p/:id` page address (browser history, screen sharing, logs).
- Values can be read any number of times; the only time limit is the lifetime of the in-memory record.

This is acceptable for the demo (synthetic data, one site). Once a real site starts using `verify.tamga.network`, anyone who
obtains the identifier could read the person's name or credential fields. The integration guides ([[GUIDE-0001]] §4,
[[GUIDE-0002]]) mark this as "planned"; this ADR sets the design.

Scope: only the **hosted** [[t:verifier]]. It does not affect an [[t:RP]] running `@tamga-network/verifier` on its own server
(the values are already resolved on its own server).

# Decision

**K1 — The RP proves its identity with the key in the [[t:trust-list]].** Every call to the result and value endpoints
carries `Authorization: Bearer <rp-assertion>`. `rp-assertion`: a JWS signed with the private key matching the RP's access
certificate registered in the trust list (`relying_parties[].access_cert_fingerprint_sha256`); `x5c` in the header; payload
`{iss: client_id, aud: <verifier base>, iat, exp ≤ iat+60, jti}`. The verifier checks the signature, the certificate
fingerprint against the `TrustSource.relyingParty(client_id)` entry, `aud`/`exp` and `jti` replay. No new secret, record or
server is needed: the RP already uses this key for signed [[t:OpenID4VP]] requests ([[SPEC-PROTO-0002]]).

**K2 — A presentation is bound to the RP that opened it.** `POST /presentations` requires the same assertion; the policy may
not exceed the RP's registered scope (AP6 — today through the policy table, from now on per RP). The presentation record
carries `client_id`; the result and values are released only to the same `client_id`, anyone else gets `404` (existence is
not leaked).

**K3 — Values are read once and briefly.** `GET /presentations/:id/claims` deletes the values from memory on the first
successful read (the next call gets `410 Gone`); unread values are deleted at most 5 minutes after the result. The result
object (claim names, steps) may be kept longer for audit; it contains no values (AP3).

**K4 — Browser polling never sees values.** The page kit (`@tamga-network/verifier/web`) and `/p/:id` read only the status
(`PENDING | ACCEPTED | REJECTED | INDETERMINATE`); for this a separate, presentation-specific, status-only short-lived token
(`status_token`, in the creation response) is used. Values go only to the RP server, via K1.

**K5 — The demo site follows the rule.** `verify…/demo-site` uses the same path with its own RP entry (in-process); no special
exception.

**K7 — The wallet shows the actual RP (ARF intermediary model).** When the hosted verifier opens a request on behalf of an
RP, the signed request object carries `tamga_on_behalf_of: <RP client_id>`. The wallet resolves that RP's trust list entry;
on the consent screen it shows **the actual RP's registered name** and "intermediary: `<verifier>`"; the scope check (AP6) is
done against the actual RP's entry. A `tamga_on_behalf_of` request that is not registered or does not match the
intermediary's own entry is rejected.

**K6 — Transition.** For one release the old endpoints keep working with a `Deprecation` header; the demo policies
(`site-signup`, `site-signin`, `age-over-18-mdoc`) are bound to the first registered demo RP. In production K1–K4 are
mandatory.

# Rationale / alternatives

| Option | Why not chosen |
|---|---|
| Static API key per site | New secret distribution and storage; no link to the trust list; revocation after a leak needs a separate flow |
| OAuth 2.0 client credentials server | Extra infrastructure and state; K1 gives the same assurance with the existing key |
| mTLS | Heavy nginx/certificate operation on shared hosting; meaningless for the browser side |
| Only lengthening the identifier (e.g. 128 bits) | Does not close the leak paths of a capability URL (history, screen, logs) |
| Keeping no values, pushing only to the RP (webhook) | Requires the RP to run an open endpoint and signature verification; may be added later as an option |

# Invariants

| Code | Rule |
|---|---|
| HV1 | The hosted verifier opens every value-returning endpoint only to an RP whose K1 assertion has been verified. |
| HV2 | An RP other than the `client_id` that created the presentation cannot get the result or values; the response does not leak existence (`404`). |
| HV3 | Values are read at most once and deleted from memory at most 5 minutes after the result. |
| HV4 | No token or address sent to the browser carries the right to read values. |
| HV6 | For a request through an intermediary verifier, the wallet shows the actual RP's registered name and checks the scope against its entry. |
| HV5 | RP assertion: `exp − iat ≤ 60 s`, `jti` replay rejected, the signer certificate fingerprint matches the RP entry in the trust list. |

# Impact
- `apps/verify` (routes + a small `rpAuth` helper), `@tamga-network/verifier/web` (uses only `status_token`),
  [[GUIDE-0001]] / [[GUIDE-0002]] (the server example produces the assertion), [[SPEC-API-0001]] §4.
- The flow of personal data narrows; no new personal data is kept.

# Status

**Accepted — 2026-09-27.** DECISIONS: D-API-2. K7 (showing the actual RP) was added with the acceptance proposal.

Implementation: `apps/verify` (rpAuth, presentation owner, single read, status_token), `@tamga-network/verifier/web`, the
wallet consent screen (K7), guides GUIDE-0001/0002.

**Implementation note.** The K5 pattern also applies to the verifier's own flows: in strict mode, an unasserted
`POST /presentations` (the "Generate QR" button on the home page; the check and pass-card flows started by the wallet,
[[ADR-0012]] B/C) binds the presentation to the verifier's **own** RP entry. The result and values of such a presentation are
never given to any external caller (HV1/HV2 apply unchanged); the person shows the values only through the check link they
chose. Opening a presentation on behalf of another RP requires a K1 assertion.
