---
title: API reference
description: The public HTTP interfaces of Tamga Network — Tamga Verify, the hosted issuer, trust lists, status lists and the schema catalogue.
outline: [2, 3]
pageClass: api-page
---

# API reference

<p class="api-lede">Everything Tamga Network exposes over HTTP: the services you call with your own credentials, and the
public registries anyone can download.</p>

Most integrations do not call these endpoints by hand: the `@tamga-network/*` [packages](/packages/) wrap them, check
signatures and follow the rules for you. Use this reference when you want to see exactly what goes over the wire, write a
client in another language, or debug.

## Services

<div class="tg-cards">

<a class="tg-card" href="/api/verify">
<strong>Tamga Verify API</strong>
<span>Ask a person for credentials from your website or service and receive the verified result. The hosted verifier.</span>
</a>

<a class="tg-card" href="/api/issuer">
<strong>Hosted issuer API</strong>
<span>For institutions: offer credentials to people in your records, sell tickets, revoke or suspend.</span>
</a>

<a class="tg-card" href="/api/institution-source">
<strong>Institution source endpoint</strong>
<span>The endpoint <em>you</em> implement so the hosted issuer can read credential data at issuance time.</span>
</a>

</div>

## Public registries

<div class="tg-cards">

<a class="tg-card" href="/api/trust-lists">
<strong>Trust lists</strong>
<span>Signed lists of who may issue and who may ask; root fingerprints, anchor log, archive.</span>
</a>

<a class="tg-card" href="/api/status-lists">
<strong>Status lists</strong>
<span>Revocation status of every credential — one signed bitstring per list, no personal data.</span>
</a>

<a class="tg-card" href="/api/schema-catalogue">
<strong>Schema catalogue</strong>
<span>Credential types: type metadata and JSON Schema for every <code>vct</code>.</span>
</a>

</div>

## At a glance

| API | Base URL | Authentication | Who calls it |
|---|---|---|---|
| [Tamga Verify](/api/verify) | `https://verify.tamga.network` | RP assertion signed with your access certificate | your server (and your page, with a status token) |
| [Hosted issuer](/api/issuer) | `https://issuer.tamga.network/{slug}/api/v1` | scoped API key `tmg_<slug>_…` | the institution's server |
| [Institution source](/api/institution-source) | your URL | signed request from the hosted issuer (you verify it) | the hosted issuer |
| [Trust lists](/api/trust-lists) | `https://trust.tamga.network` | none — public, signed files | everyone, through `TrustSource` |
| [Status lists](/api/status-lists) | `https://status.tamga.network` | none — public, signed tokens | verifiers |
| [Schema catalogue](/api/schema-catalogue) | `https://schemas.tamga.network/v1` | none — public | issuers, verifiers, wallets |

## Environments

Every service has a sandbox twin with the same rules on a separate test network ([[GUIDE-0013]]). The sandbox lists carry
`environment: sandbox`; a loader configured for the real network stops on them, and the other way round.

| Real network | Sandbox |
|---|---|
| `verify.tamga.network` | `verify.sandbox.tamga.network` |
| `issuer.tamga.network` | `issuer.sandbox.tamga.network` |
| `trust.tamga.network` | `trust.sandbox.tamga.network` |
| `status.tamga.network` | `status.sandbox.tamga.network` |
| `id.tamga.network` | `id.sandbox.tamga.network` |
| `schemas.tamga.network` | shared |

## Conventions

- **JSON over HTTPS.** Requests and responses are UTF-8 JSON unless the page says otherwise (signed files are compact JWS:
  `application/jose`, `application/statuslist+jwt`). Times are ISO 8601 in UTC, or Unix seconds where the field says so.
- **No shared secrets for verifiers.** Tamga Verify authenticates your server with a 60-second statement signed by the key of
  your registered access certificate; there is nothing to leak or rotate on our side ([[ADR-0017]]).
- **Errors.** Tamga Verify answers `{ "error", "error_description" }` (OAuth style); the hosted issuer answers RFC 9457
  problem details (`title`, `status`). A missing or foreign resource is always `404` — existence is never revealed.
- **Rate limits.** Over the limit you get `429` with `Retry-After` (seconds). Client addresses are not stored or logged.
- **Three outcomes.** A verification is `ACCEPTED`, `REJECTED` or `INDETERMINATE`. "Could not check right now" is never
  "invalid".
- **No personal data in logs.** Never log credential values, the status index or identity matching keys — on your side
  either ([[SPEC-API-0001]] AP3–AP4).
- **Registries are cacheable.** Trust lists, status lists and the catalogue are static, served with CORS `*` and a short
  cache; always check the signature, not the transport.

## Standard protocol endpoints

Wallets talk to the services with the standard EUDI protocols — [[t:OpenID4VCI]] for issuance and [[t:OpenID4VP]] for
presentation. You do not call these yourself (the wallet and the packages do), but they are listed here so that a wallet
developer knows what to expect. The binding profiles are [[SPEC-PROTO-0001]] and [[SPEC-PROTO-0002]].

### Hosted issuer — `https://issuer.tamga.network`

| Endpoint | Purpose |
|---|---|
| <span class="api-method get">GET</span> `/.well-known/openid-credential-issuer/{slug}` | Credential Issuer Metadata; signed with `Accept: application/jwt` |
| <span class="api-method get">GET</span> `/.well-known/oauth-authorization-server/{slug}` | Authorization server metadata |
| <span class="api-method get">GET</span> `/{slug}/offers/{id}` | Credential offer (the `credential_offer_uri` target; no personal data) |
| <span class="api-method post">POST</span> `/{slug}/par` · <span class="api-method get">GET</span> `/{slug}/authorize` | Pushed authorization request and authorization — identity-bound offers and requests started from the wallet |
| <span class="api-method post">POST</span> `/{slug}/token` | Token (pre-authorized code, authorization code, refresh token); [[t:DPoP]]-bound |
| <span class="api-method post">POST</span> `/{slug}/nonce` | Fresh `c_nonce` for key proofs |
| <span class="api-method post">POST</span> `/{slug}/credential` | Credential issuance (DPoP, key proof, wallet attestation) |
| <span class="api-method get">GET</span> `https://status.tamga.network/{list_id}` | The issuer's [status lists](/api/status-lists) |

### Identity service — `https://id.tamga.network`

The provisional identity attestation provider ([[ADR-0022]]). The same OpenID4VCI endpoints without the `{slug}` segment:
`/.well-known/openid-credential-issuer`, `/.well-known/oauth-authorization-server`, `/par`, `/authorize`, `/token`,
`/nonce`, `/credential`, and the status lists under `/status/{list_id}`. Identity proofing happens inside this service only.

### Tamga Verify — `https://verify.tamga.network`

| Endpoint | Purpose |
|---|---|
| <span class="api-method get">GET</span> `/vp/req/{id}` | Signed request object (`application/oauth-authz-req+jwt`) — the `request_uri` in the QR code |
| <span class="api-method post">POST</span> `/vp/response` | The wallet's encrypted response (`direct_post.jwt`); rate-limited |
| <span class="api-method get">GET</span> `/p/{id}` | The hosted waiting / result page for people (HTML) |

## Machine-readable definitions

Each reference page is generated from an OpenAPI 3.1 file. Import it into any OpenAPI tool to generate a client or send
test requests:

| Definition | File |
|---|---|
| Tamga Verify API | [`hosted-verifier-api.openapi.yaml`](/api/hosted-verifier-api.openapi.yaml) |
| Hosted issuer API | [`tamga-issuer-api.openapi.yaml`](/api/tamga-issuer-api.openapi.yaml) |
| Institution source endpoint | [`institution-source.openapi.yaml`](/api/institution-source.openapi.yaml) |
| Trust lists | [`trust-lists.openapi.yaml`](/api/trust-lists.openapi.yaml) |
| Status lists | [`status-lists.openapi.yaml`](/api/status-lists.openapi.yaml) |
| Schema catalogue | [`schema-catalogue.openapi.yaml`](/api/schema-catalogue.openapi.yaml) |
