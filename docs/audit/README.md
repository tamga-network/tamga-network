# Tamga Network — external security review package

This folder is the starting point for an independent security reviewer. It is written for someone who has not seen the project
before and who reads English. It is kept in the repository (rendered on GitHub; the Mermaid diagrams render there) and is not
part of the documentation website.

> Status (2026-10-29): **prepared, no external review has taken place yet.** Everything below was produced by the project's own
> internal reviews and test tooling. Nothing here is a certification.

| File | What it contains |
|---|---|
| [`architecture.md`](architecture.md) | System overview, components, trust model, threat model (actors, assets, trust boundaries) |
| [`data-flows.md`](data-flows.md) | Sequence / flow diagrams (Mermaid): issuance, presentation, Digital Credentials API, trust list publication, status lists, ZK copies, wallet provider attestations |
| [`invariants.md`](invariants.md) | Generated catalogue: every binding invariant code → tests that cite it (heuristic) |
| [`limitations.md`](limitations.md) | Known limitations and accepted risks, external conformance self-test results, summary of previous internal reviews |
| [`build-and-test.md`](build-and-test.md) | How to build, run the test suites (incl. property/fuzz tests), reproduce results |

## 1. Scope

**In scope (this repository, open source, Apache-2.0):**

| Area | Path | Notes |
|---|---|---|
| Shared primitives | `packages/core` | base64url, hashing, identifiers, SD-JWT selective-disclosure structure resolver (shared by verifier and wallet), time types |
| SD-JWT VC | `packages/sd-jwt` | issuance, presentation (KB-JWT), verification steps A1–A7, IETF Token Status List (JWT + CWT) |
| ISO mdoc | `packages/mdoc` | strict CBOR codec, COSE_Sign1, MSO, ISO 18013-5 proximity, ISO 18013-7 Annex C (HPKE), status list CWT, identifier lists |
| Trust | `packages/trust` | signed trust lists (JWS), anchor log, `TrustSource` (the only interpreter of list files), ETSI TS 119 602 LoTE (JSON) and TS 119 612 (XML, own XMLDSig verifier) readers |
| Issuer library | `packages/issuer` | OpenID4VCI 1.0 issuer side: offers, pre-authorised and authorisation-code flows, PAR, DPoP, proof JWT, wallet attestations, signed metadata |
| Verifier library | `packages/verifier` | OpenID4VP 1.0 (DCQL, `direct_post.jwt`, DC API), request objects with per-fetch branches, verification pipeline A–E, status cache, pseudonyms, web helpers, ZK verification |
| Wallet core | `packages/wallet-core` | platform-neutral wallet logic used by wallets on the network: OpenID4VCI/VP client, DCQL matcher, request-object verification, RP checks, registration certificates, status, trust list pinning, proximity |
| ZK prover | `packages/zk` | wallet-side zero-knowledge proof generation for mdoc |
| Reference verifier service | `apps/verify` | hosted verifier (Fastify): presentation API, result access, DC API test page, example site, terminal endpoints |
| Trust list publisher | `apps/trust-publisher` | builds and signs the trust lists, anchor log, LoTE / TL XML projections, registration certificates and their status list |
| Contracts (chain stage, not in production) | `contracts/` | Solidity registries; **not in the public repository** until the chain is opened — package `contracts.md` is shared with the reviewer separately on request |

**Out of scope for this package** (reviewed separately or not yet public): the operator repository (identity-attestation service,
institution issuer service, institution console, sandbox portal, server configuration), wallets listed on the network (including
Tamga Wallet, its provider service and app — separate project and operator), third-party dependencies (pinned, see
`package-lock.json`).

**Version under review.** Packages at source version `0.7.4` (unreleased; npm has `0.7.3`). The commit to review is fixed
with the reviewer and tagged `audit-1` in the repository when the engagement starts; until then use the head of `main`.
Releases are published only from CI with npm provenance (`.github/workflows/release.yml`).

## 2. What we would like you to look at (ranked)

1. **Verification pipeline and its fail-closed behaviour** — `packages/verifier/src/verify.ts`, `steps.ts`, `request.ts`,
   `status-cache.ts`; `packages/sd-jwt/src/verify.ts`; `packages/mdoc/src/mdoc.ts`. Three-valued result (ACCEPTED / REJECTED /
   INDETERMINATE): can an attacker turn a REJECTED into ACCEPTED, or an infrastructure failure into ACCEPTED? Holder binding
   (KB-JWT / DeviceAuth), `nonce` / `aud` / `sd_hash`, replay, presentation-to-request binding, response decryption and
   per-fetch request branches (ADR-0067: forged declines).
2. **Trust list loading and `TrustSource`** — `packages/trust/src/loader.ts`, `jws.ts`, `trust-source.ts`, `store.ts`,
   `xmldsig.ts`, `tl-reader.ts`, `lote-reader.ts`. Signature and signer pinning, rollback protection, freshness, federation of
   external (EU) lists, our own XML canonicalisation and RSA/ECDSA verification (no third-party XMLDSig library), XML signature
   wrapping.
3. **Wallet core decision logic** — `packages/wallet-core/src/oid4vp.ts` (`verifyRequestObject`, `checkRp`, `matchDcql`,
   `respond`), `wrprc.ts` / `wrprc-status.ts` (registration certificates), `trustlist.ts`, `status.ts`, `dc-mdoc.ts`. Can a
   relying party obtain more data than registered, bypass user approval, or redirect the response?
4. **Issuer flows** — `packages/issuer/src/oid4vci.ts`, `authcode.ts`, `dpop.ts`: PAR + DPoP binding, token / refresh token
   binding to the client instance key (ADR-0059, ADR-0060), proof JWT and nonce handling, wallet attestations (ADR-0025,
   ADR-0034), `tx_code` channel separation.
5. **Parsers under hostile input** — CBOR, COSE, SD-JWT disclosures, status list decompression (bombs), ETSI XML (XXE, entity
   expansion), JSON trust lists. Property/fuzz tests exist (see `build-and-test.md`); we would value a reviewer's own fuzzing.
6. **Privacy invariants** — no personal data in logs, trust lists, anchor log, status URIs or the chain (invariants DP1, AP3/AP4,
   PR14); pseudonym derivation (ADR-0031); unlinkability limits.
7. **Reference verifier service** — `apps/verify`: result access (ADR-0017), rate limiting, CSP and HTML output, DC API origin
   handling, terminal endpoints.
8. **Publisher** — `apps/trust-publisher`: correctness of what gets signed, registration certificate status (ADR-0068).
9. **Contracts** (only if the chain stage is in the engagement) — see the separate contracts package.

Questions we already know we cannot answer ourselves are listed in `limitations.md` §5.

## 3. Contact

Security contact and disclosure policy: [`SECURITY.md`](../../SECURITY.md). The reviewer gets read access to the operator
repository and the contracts package on request.
