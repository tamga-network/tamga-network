# Known limitations, accepted risks, test results and previous reviews

## 1. Deliberate deviations still open

The project keeps a deviation register (codes `S-n`); open items as of 2026-10-29:

| Code | Limitation | Planned resolution |
|---|---|---|
| S-1 | In the **sandbox** (test network) the institutions' signing keys are held by the operator. On the real network the hosted issuer refuses file keys; institutions sign with their own KMS / HSM | institution KMS / HSM at onboarding |
| S-4 | The authentic source of institution data is an example registry in the institution console (sandbox) | the institution's own query endpoint (`docs/api/institution-source.openapi.yaml`) with the first institution |
| S-6 | Trust lists are signed with a single signing certificate | ≥ 2 certificates with rolling replacement, with a second operator / HSM (ETSI TS 119 612 A.2) |
| S-8 | **No independent security audit yet** | this package |
| S-14 | Wallet provider verifies Android key attestation; iOS App Attest and Play Integrity wait for store accounts | before store release |
| S-16 | Proximity pass (event entry) does not ask for PIN / biometrics at every use; consent is time-limited (≤ 6 months) and every use is logged | re-evaluated with pilot data |
| S-19 | Pass registration request is started by the wallet | relying party starts it (desk / page QR) in the pilot |

Closed deviations (for context): software-only holder keys outside development builds (S-9), unencrypted wallet store (S-11),
byte-search SAN check (S-12), wallet not verifying list signatures (S-13), fake identity verification on the real network (S-15),
site accounts keyed by credential hash (S-17).

## 2. Accepted risks (by design, documented)

- **Single list operator.** The anchor log makes a rewritten history visible but cannot prevent equivocation by the one operator
  (see `SECURITY.md`). A permissioned chain is designed to remove this once a second independent operator exists (not running).
- **Revocation latency.** Status lists are republished every few minutes; a token is valid up to 6 hours; verifiers prefetch.
- **ZK presentations** cannot check revocation in the presentation; mitigated by short-lived ZK copies (≤ 24 h, ADR-0044) and the
  verifier policy flag `accept_unrevocable_zk`.
- **Linkability under verifier collusion** for presentations of the same credential copy (mitigated by batches of copies, one key
  per copy, and per-site pseudonyms).
- **Own XMLDSig implementation** for ETSI TS 119 612 lists (no third-party XML security library): narrow profile (C14N 1.0 /
  exclusive C14N, enveloped transform, RSA 2048–4096 / ECDSA P-256/384/521, SHA-2), DTD refused, signer pinned before any
  digest work. Tests sign with an independent implementation. Review requested.
- **Own strict CBOR codec** (no third-party CBOR library on the verifier path).

## 3. External conformance self-tests

These are self-tests with public tools, **not certifications**.

**OpenID Foundation conformance suite — issuer** (plan `oid4vci-1_0-issuer-haip-test-plan`, sandbox identity-attestation
service, three rounds 2026-10-21 → 23): final run of 63 modules — **no failures**; 2 warnings (metadata tests 01–02: the suite's
schema does not know the standard ETSI TS 119 472-3 `credential_reuse_policy` fields and cannot be allow-listed — a tool
limitation, reported to the suite maintainers 2026-10-27); 4 review items (screenshots uploaded); 4 skipped as expected
(encrypted responses not offered; one refresh-token scope outside the tool's grant). Earlier rounds found and fixed: missing
client-proof signing algorithms in AS metadata, `iat`/`exp` precision, `dpop_jkt` mismatch accepted at PAR, CBC TLS suites,
token reuse semantics (ADR-0059), `unknown_credential_identifier`, authorisation-code reuse revocation, DPoP `htu`
normalisation, refresh-token binding (ADR-0060), PKCE verifier required.

**OpenID Foundation conformance suite — verifier** (plan `oid4vp-1final-verifier-haip-test-plan`, `sd_jwt_vc` +
`direct_post.jwt`, 14 modules, 2026-10-27): first round **no failures**; two warnings (an extra `purpose` parameter in the
request object, an extra `show_url` key in the response-endpoint answer) fixed the same day. A second round has **not been run
yet** (as of 2026-10-29); its result is unknown until it runs. Request branches (ADR-0067) changed the request object since the
first round.

**eudi-dev 3.5.0** (independent open-source EU test wallet, strict ARF mode, 2026-10-29): five real defects found and fixed the
same day — registration-certificate use entries lacked `format` (mdoc / ZK requests counted as over-asking), `state` required on
the DC API path, wrong `aud` for SD-JWT over the DC API (`origin:` + page origin, Annex A.4), JAdES `sigT` instead of `iat` in
LoTE signatures, base64url-wrapped registration certificate not read; one small EN 319 412-1 identifier syntax fix. One gap
found that blocked strict EU wallets: registration certificates without `policy_id` / `certificate_policy` / `status` — since
resolved by ADR-0068 (sandbox): in strict mode 12 of the 13 sandbox requests now pass; the 13th (`site-signup`) uses Tamga's
pseudonym extension, which the EU wallet does not know. The strict-mode run was against the sandbox; the real network's
registration certificates carry the same policy and status fields since 2026-10-29 (ADR-0068 implementation note), but the suite
has not been run against it. A weekly CI job re-runs the suite against the sandbox.

## 4. Previous internal reviews (summary)

| Date | Scope | Result |
|---|---|---|
| 2026-10-19 | Contracts (entry points, spec compliance, upgrades, maturity, audit prep; Slither added to CI) | 19 findings (2 high, 4 medium) — all fixed or decided by ADR-0053/0054/0055; Slither 60 results: 4 fixed, 56 justified exclusions, 0 open |
| 2026-10-19 | Dependencies and services (supply chain, insecure defaults, OWASP, API sharp edges) | shared rate-limit DoS, pseudonym login of a revoked wallet, sandbox result access without RP assertion, 8 API misuse sharp edges → fixed; ADR-0056 made security inputs mandatory |
| 2026-10-20 | Code review of the whole trust path | E3 accepted an unregistered RP when no claims were disclosed; wallet rollback memory not persistent; certificate-less request bypass in the app → fixed with tests |
| 2026-10-21 | Annex C, DC API, pseudonyms, PKI tooling | unsigned callers could choose any DC API origin (phishing in the verifier's name) → fixed; retention intent not shown; origin from client header; unlimited test endpoint → fixed |
| 2026-10-23 → 26 | Pre-release round (code ×2, security, protocol, wallet, infrastructure, documentation) | ~110 findings (0 critical, 2 high), all fixed or decided (ADR-0059 … 0065) |
| 2026-10-29 | Property / fuzz tests (this package) | 3 hardening fixes: `__proto__` key in SD payload changed the result's prototype; wallet read 4/8-bit status lists as 2-bit (could read a neighbour's bit); malformed DCQL caused `TypeError` instead of a clean rejection, claim paths not validated |

## 5. Open questions for the reviewer

1. Is the per-fetch branch model (ADR-0067) a sound answer to unauthenticated OpenID4VP error responses, or is there a cheaper
   attack on branch eviction (soft cap 10 / hard ceiling 32 branches, eviction of unanswered branches, per-IP fetch limit;
   residual risk in ADR-0067 "Eviction")?
2. XMLDSig: is our profile (and reading data only from the verified DOM) sufficient against signature-wrapping and
   canonicalisation-confusion attacks?
3. Trust-list rollback: is version memory + anchor log adequate for clients that run for a long time without persistent storage?
4. Status lists: are the bounds (5 MiB token, 2.5 MB inflated for the verifier, 16 MiB for the wallet) appropriate, and is the
   handling of application-specific values (fail closed) correct everywhere?
5. Registration certificates: any way for a registered RP to get claims outside its registered use (DCQL `claim_sets`,
   `credential_sets`, mdoc namespaces)?
