---
document_id: ADR-0033
title: "App store review code"
status: Active
version: 1.0.0
created: 2026-10-01
last_updated: 2026-10-02
summary: >
  Apple and Google reviewers must be able to try Tamga Wallet's identity flow without a real Turkish identity document.
  Decision: a time-limited, single-use review code; once the code is entered, the identity service uses the fake verification
  provider for that session only and issues, with a separate test signer, a test identity credential that passes none of the real
  verifiers' policies. Paths that need no identity (tickets, Tamga Verify, "Sign in with Tamga") can be tried without a code.
domain: Services
translation_of: ADR-0033
source_version: 1.0.0
---

# Plain summary

When a store reviewer opens the app, the identity verification step asks for a real Turkish ID card and a face scan; the reviewer
has neither, and the app is rejected as "could not be tested" (the most common rejection reason for identity apps). Decision: a
short-lived, **single-use code** written into the review notes. Once the code is entered, the identity service uses the fake (demo)
verification instead of the real provider for that session only, and issues a test credential **marked "DEMO" that no real verifier
accepts**. Real users never see this path; the code is spent after one use.

# Context

- Apple App Review and Google Play review require every flow of the app to be testable; where needed a test account or a "demo
  mode" is provided in the review notes.
- Tamga Wallet's identity flow ([[SPEC-ID-0003]] §9) requires a real identity document + liveness + face matching
  ([[t:identity-proofing]]). In production the fake provider is off (`TAMGA_IDV_DIDIT_FAKE` only if explicitly enabled; GT1: in
  production a missing real identity is never treated as present).
- Flows that need no identity can be tried without a code: buying a ticket and showing it at the gate, the Tamga Verify example
  policies, the "Sign in with Tamga" example site (the [[t:pseudonym]] works only with the seed from the identity
  [[t:credential]], so that too depends on the identity flow — §K4).
- A path is needed that does not affect real users, cannot be abused and is traceable.

# Options

| Option | Result | Why |
|---|---|---|
| A. Only identity-free paths in the review notes | not enough | The identity flow is the app's main path; if the reviewer cannot try it, the rejection risk is high. |
| B. A permanent "demo mode" in the app (fake credentials on the device) | rejected | Real users could enable it too; fake credentials might look real; the store may treat it as a "hidden feature". |
| C. A pre-prepared test wallet / device | not feasible | The reviewer installs on their own device; keys are bound to the device (WL1). |
| **D. Time-limited, single-use review code → fake provider + separate test signer** | **accepted** | Only someone with the code can use it; the credential does not pass in the real ecosystem; every use is logged. |

# Decision

## K1 — The code
- The operator generates the code on the server (an `ops` script; not from the console): random, at least 128 bits, in a readable
  form (e.g. 4×5 characters).
- Only a digest of the code is stored (HMAC with a service key); the plain code is never stored or logged.
- Validity: at most 14 days; **single-use** (spent on the first successful identity flow); at most 3 active codes at a time.
- The code is written into the store review notes and shared nowhere else.

## K2 — Effect of the code (that session only)
- The wallet does **not** show an "I have a review code" link at the start of the identity flow; the code is entered into a small
  "Review code" field on the privacy notice screen of the `/authorize` page (the real user flow does not change).
- With a valid code the identity service uses the fake provider for that [[t:PAR]] (`FakeIdvProvider`; ready-made test persons);
  no request goes to the real provider.

## K3 — The test credential does not pass in the real ecosystem
- The credential is signed **not** with the identity service's real key but with a separate test signer. The test signer sits in
  the [[t:trust-list]] as a separate `DEMO` record; only the "review" policies in Tamga Verify accept it.
- The credential carries `verification_method: "review-demo"`; the name fields explicitly contain "DEMO"; `exp` is at most 7 days.
- Institutional [[t:issuer]]s (universities etc.) **do not accept** the test signer's credential for identity matching (trust list
  policy).
- The pseudonym seed is derived with the test signer and from the test key; it never collides with real seeds.

## K4 — What the reviewer can try
With the code: identity verification → identity credential → "Sign in with Tamga" example site (pseudonym) → Tamga Verify "over 18"
example → reset the wallet and delete my data. Without the code: buying a ticket and showing it at the gate, the verification
policies page.

## K5 — Trace
Every use of a code is written to the event log (`review_code.used`; the code id, not the code digest); test credentials are counted
separately and appear in the transparency report as "store review".

# Rationale / alternatives

See the options table. D is the only option that lets the reviewer try every path without changing the real user flow and without
leaking fake credentials into the real ecosystem. The cost: a second signer in the identity service and a `DEMO` record in the trust
list.

# Risks

| Risk | Mitigation |
|---|---|
| The code leaks and someone else uses it | single-use, time-limited, at most 3 active; the test credential does not pass with a real verifier |
| The test credential is mistaken for a real one | separate signer, `DEMO` marking, "DEMO" badge in the wallet, 7 days |
| The store treats it as a "hidden feature" | explained openly in the review notes; the code field is visible on the notice screen, not hidden |
| The fake provider is accidentally opened to everyone in production | there is no path to the fake provider without a code; `TAMGA_IDV_DIDIT_FAKE` stays off in production |

# Invariants

| Code | Rule |
|---|---|
| RV1 | A review code is stored only as a digest, is time-limited (≤ 14 days) and single-use; it is never written to the log in plain form. |
| RV2 | A credential issued with a review code is not signed with the identity service's real signer and passes only the review policies. |
| RV3 | Without a review code the production identity service cannot switch to the fake verification provider. |

# Implementation plan

| Step | Where | Work |
|---|---|---|
| 1 | `apps/id` (operator repository) | code table (digest, expiry, used), `/authorize` code field, provider choice per PAR, test signer |
| 2 | `ops` (operator repository) | `review-code.ts` (create / list / revoke) |
| 3 | `tamga-network` trust list | `DEMO` test signer record; the institution issuers' matching policy excludes it |
| 4 | `apps/verify` | "review" policies (accepting the test signer) |
| 5 | Tamga Wallet (separate repository) | "DEMO" badge (credential `verification_method: review-demo`) |
| 6 | Documentation | SPEC-ID-0003 §9, store review notes |

Estimated effort: 2–3 days (with tests).

## Implementation

- **Code:** `apps/id/src/review.ts` (operator repository) (26 characters Crockford base32 = 130 bits; HMAC digest with a separate sub-key
  derived by HKDF from the document-digest key; active codes compared in constant time); table `review_codes`; operator tool
  `ops/review-code.ts create | list | revoke` (operator repository). The code is spent on the first successful issuance; while a flow is in
  progress it is not given to another session. Limits: 5 failed attempts per PAR, a 15-minute lock after 20 failures in 10 minutes
  service-wide (no IP — G2); nginx rate limit on `/authorize/consent`.
- **Flow:** a collapsed "Review code" detail on the `/authorize` notice page; with a valid code `/review-idv/{session}` (a DEMO
  person specific to the code). The code-less flow and `/fake-idv` do not change (RV3; in production `/fake-idv/` is closed in
  nginx).
- **Signer:** `ops/pki/issuer-id-review` (dev PKI; the certificate in the repository, the private key to the server with
  `upload.ps1 -WithPki`). The trust list record `tamga-id-review` (IDENTITY, [[t:EAA]], **I1**; status list key is the identity
  service's) is a **pending application** in `apps/trust-publisher/registry/pending/`: because [[ADR-0024]] requires the
  institution's identifier and address for new records, it is added with `register issuer` once Tamga's details are entered. Until
  then the review path answers "not enabled" (503).
- **Verification:** Tamga Verify `review-age-over-18` and `review-site-signup` (I1); "Sign up with a DEMO credential" on the example
  site. Every real policy requires I2 → the DEMO credential is REJECTED at E1 (test: `packages/verifier/src/review-demo.test.ts`).
- **Schema:** `review-demo` added to the `verification_method` values (development stage, [[ADR-0029]]); FW-RB-0003 (Identity
  Rulebook) is written accordingly.
- **Wallet:** a "DEMO — app review credential" card in the credential details.

# Resolved questions (project management, 2026-10-01)

1. Option D **accepted**.
2. The code field is **on the identity service's notice (consent) page**.
3. The test credential is valid for **7 days**.

# Status

**Accepted — 2026-10-01** (approved by project management: all three questions accepted). Implementation: the plan above.
