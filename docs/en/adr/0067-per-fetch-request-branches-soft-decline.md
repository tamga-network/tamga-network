---
document_id: ADR-0067
title: "Each fetch of the request object is its own branch; a decline closes only its own branch"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-29
last_updated: 2026-10-29
summary: >
  In OpenID4VP 1.0 the wallet's error response (a decline) is not signed and may be sent unencrypted; the only thing that ties it
  to a presentation is `state`. In Tamga, `state` was in the request object, and anyone could fetch the request object from the
  address in the QR code: someone who saw the QR could send a forged decline and turn the real person's presentation into
  "declined". Decision: every fetch of the `request_uri` (GET or POST) opens a separate request branch — a newly signed request
  object with a fresh 128-bit `state`, a fresh `nonce` and a fresh ephemeral encryption key (a stricter fulfilment of HAIP §5
  "ephemeral keys per Authorization Request"); with a POST fetch, `wallet_nonce` is echoed. A decline (encrypted or not) closes only
  its own branch; the presentation as a whole becomes REJECTED only if it has exactly one branch and that branch is closed,
  otherwise it stays open until it expires and the first valid presentation wins. An undecryptable response does not count as an
  attempt; at most 10 branches per presentation. Signed declines were rejected (non-standard, against the ARF RPA_11 privacy
  principle). Accepted: 2026-10-29 (project management approval).
domain: Protocol
related: ["[[ADR-0017]]", "[[ADR-0034]]", "[[ADR-0012]]", "[[SPEC-PROTO-0002]]", "[[SPEC-PROTO-0001]]", "[[SPEC-API-0001]]"]
translation_of: ADR-0067
source_version: 1.0.0
---

# In short

When you choose "show with Tamga Wallet" on a site, the QR code on the screen carries an address from which the wallet downloads
the request. Anyone who sees the QR can open that address. Until now everyone received the same request; someone who knew the
session code inside it (`state`) could send a forged "the person declined" answer and break the real person's transaction. Now the
address produces a new request each time it is opened: everyone who opens it gets their own session code. A forged decline closes
only the forger's own copy; the real person's wallet can still complete the transaction.

# Context

- **Standard.** OpenID4VP 1.0 Final does not authenticate error responses: §8.2 describes the response endpoint's answer, §8.3.1
  says that with `direct_post.jwt` an error response MAY be sent unencrypted; §14.5 (session fixation) and the security
  considerations define no signature or proof of possession for error responses. Only `state` binds an error response to a
  presentation.
- **The gap in Tamga.** [[SPEC-PROTO-0002]] §10.1 (2026-10-24) closed the presentation on a decline. `state` was in the signed
  request object; the request object was fetched from the QR's `request_uri` without authentication and every fetch returned the
  same object. Anyone who saw the QR (a bystander, a camera, a shared screen) could fetch it and send `error=access_denied&state=…`,
  turning the real person's presentation into REJECTED (denial of service; no personal data leaks). The same pattern existed in the
  inline identity presentation of the institution's issuance service ([[SPEC-PROTO-0001]] §11.2). In addition, because the
  presentation id is visible in the QR, five meaningless undecryptable responses could close the presentation via the attempt limit.
- **State of play in the EU (2026-10).** The EU reference verifier, Credo and walt.id accept the first (possibly forged) decline
  and close the session for good. There is no EU solution for this; but the standard defines ephemeral keys per authorization
  request (HAIP §5) and the `request_uri` POST method (`wallet_nonce`, OpenID4VP 1.0 §5.10).
- **Direction from project management.** Look at how European implementations do it and at what the standard says it should be;
  if the proposed design is the right way, implement it.

# Decision

## K1 — Each fetch is a branch
Every fetch of the `request_uri` (GET; or POST with `request_uri_method=post`) opens a **request branch**: a newly signed request
object with the same content (client identifier, DCQL, registration certificate, `response_uri`, expiry); a **fresh `state`**
(≥ 128 random bits, secret: not in the QR, not in the `request_uri` path and not in the `response_uri` path), a **fresh `nonce`**
and a **fresh ephemeral response encryption key**. The key id names the branch (`enc-<presentation>.<branch>`). The first request
object created when the presentation is opened is never served. With a POST fetch the wallet's `wallet_nonce` is echoed in the
request object (§5.10; `wallet_metadata` is not read); GET keeps working. This is a stricter fulfilment of HAIP §5's "ephemeral
keys per Authorization Request".

## K2 — Soft decline
The wallet's error response (OpenID4VP 1.0 §8.4) — unencrypted form or encrypted JWE (§8.3.1), both handled the same — closes
**only the branch** its `state` belongs to. The presentation as a whole becomes REJECTED **only if it has exactly one branch and
that branch is closed** (no reason is stored, PV5). If there are several fetches, the presentation stays open until it expires;
**the first valid presentation** (a response that passes proof of possession, §10.1) wins. A presentation sent to a closed branch is
not accepted. The response endpoint answers a decline with 200 (§8.2); the decline's `redirect_uri` carries nothing that grants
access to data or to the result (no status token, no check-view key, no authorization code). In the institution's inline identity
presentation, a decline in a multi-branch presentation gets 200 with an empty body; in a single-branch one the wallet receives the
`access_denied` redirect (as today).

## K3 — Attempts are per branch; undecryptable responses do not count
Responses that fail before proof of possession but were decrypted with the branch's key (state mismatch, empty `vp_token`, A1–A6)
are attempts on that branch; at 5 only that branch closes (in a single-branch presentation the presentation becomes REJECTED). A
response that cannot be decrypted with any branch key (no or unknown branch in `kid`, garbage body) does not touch the presentation
and is not counted: only whoever received the request object can encrypt to it.

## K4 — Limits
At most 10 branches per presentation; the next fetch gets 429 and existing branches are unaffected. No branch is opened for a closed
or expired presentation (404). Endpoint and per-presentation rate limits stay as they are. The number of declines is bounded by the
number of branches.

## K5 — The browser path (DC API) is separate
The Digital Credentials API path (`dc_api.jwt`, ISO/IEC 18013-7 Annex C) has no `request_uri`; the request object goes to the page
that opened the presentation and the answer returns to the page. The DC API object is not a branch: a decline cannot be sent with its
`state` (the decline returns through the DC API's own error path), and the attempt limit on this path is per presentation. The
binding of this path does not change (origin + `nonce` + key, [[SPEC-PROTO-0002]] §7).

## K6 — The status API does not change
The `GET /presentations/{id}` contract stays the same (`PENDING` + `attempts` + `last_attempt`; result). Branch information is
internal (the trace shows "fetch n"; no `state`, no `nonce`).

# Options considered

| Option | Result | Why |
|---|---|---|
| The first decline closes the presentation (EU reference verifier, Credo, walt.id) | rejected | Anyone who sees the QR can break the real person's transaction |
| Signed decline (the wallet signs the decline with a device key) | rejected | Non-standard; ties the decline to the person's device in the verifier's eyes — conflicts with ARF RPA_11 (the verifier should learn nothing when the person declines) and PV5; which credential's key would sign is unanswered |
| A decline never closes the presentation | rejected | In the usual single-wallet flow the relying party would wait until expiry after the person said "no"; poor experience |
| **Each fetch a separate branch + soft decline (+ branch and rate limits)** | **chosen** | Within the standard; a forged decline closes only the forger's own branch; in the usual flow (one fetch) a decline shows immediately; the OpenID conformance scenario "request fetched twice" completes on the second branch |
| Decline only with `request_uri_method=post` + `wallet_nonce` | rejected (on its own) | Most wallets use GET; the attacker's own fetch also carries a `wallet_nonce`. POST is supported, but the protection comes from branches |

# Residual risk

If an attacker fetches the QR **before** the real wallet and declines immediately, the presentation has a single branch and becomes
REJECTED. Like the fact that someone who sees the QR can also answer with their own credential, this is a known limit of the
cross-device flow (OpenID4VP 1.0 §14); the relying party opens a new presentation. The QR should be shown only to the person and the
presentation lifetime kept short (5 min).

# Invariants

| Code | Rule |
|---|---|
| RQ1 | Every fetch of the `request_uri` (GET or POST) opens a new request branch: a newly signed request object with a fresh `state` (≥ 128 bits; not in the QR, nor in the `request_uri` or `response_uri` paths), a fresh `nonce` and a fresh ephemeral encryption key; the first object created when the presentation is opened is not served. With a POST fetch `wallet_nonce` is echoed; GET is supported. |
| RQ2 | A wallet error response (unencrypted or encrypted) closes only the branch its `state` belongs to; the presentation becomes REJECTED only if it has exactly one branch and that branch is closed, otherwise it stays open until it expires and the first valid presentation wins. A presentation sent to a closed branch is not accepted. |
| RQ3 | The answer to a decline is 200 (OpenID4VP 1.0 §8.2); the decline's `redirect_uri` carries no status token, check-view key, authorization code or any other value that grants access to data. |
| RQ4 | A response that cannot be decrypted with any branch key does not touch the presentation and does not count as an attempt; a decrypted response that does not reach proof of possession is an attempt on its own branch only (the branch closes at 5). |
| RQ5 | At most 10 request branches per presentation; beyond that 429 and existing branches are unaffected; no branch is opened for a closed or expired presentation. |
| RQ6 | The request object of the Digital Credentials API path is not a branch: a decline with its `state` is not accepted, and the attempt limit on this path is per presentation. |

# Consequences

- Code: `@tamga-network/verifier` (`createRequestBranch`, `openPresentationResponse`; `responseKidOf` reads the branch; `state` 128
  bits; packages at 0.7.4 in source, not published to npm); Tamga Verify (`apps/verify`: `GET|POST /vp/req/{id}`, branches, soft
  decline); the institution's issuance service (inline identity presentation, `/{slug}/vp/req/{id}` GET|POST). The wallet core does
  not change (it fetches with GET and sends declines unencrypted).
- Documents: [[SPEC-PROTO-0002]] §3, §10.1, PV15; the server-side verification guide (checklist).
- OpenID conformance: in the verifier test plan, "request fetched twice" and the happy flow should be run again.

# Status

**Accepted — 2026-10-29.** With project management approval. DECISIONS: D-PROTO-5.
