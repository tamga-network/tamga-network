---
document_id: ADR-0032
title: "Zero-knowledge proofs (ZK)"
status: Active
version: 1.0.0
created: 2026-10-01
last_updated: 2026-10-07
summary: >
  WITHOUT CHANGING the institutions' ES256-signed mdoc credentials, the wallet produces zero-knowledge proofs about them with
  Longfellow ZK (first predicate: over 18). The verifier sees only the proven attribute and the issuer; two presentations cannot
  be linked. Accepted circuits are published by digest in the signed trust list; transport is OpenID4VP DCQL `mso_mdoc_zk`
  (EU TS13) and/or the Digital Credentials API; if a proof cannot be produced, the batch-copy method is the fallback. Based on
  the Z5 Stage 1 desktop conformance measurement (`tools/zk-circuit/`).
domain: Identity
translation_of: ADR-0032
source_version: 1.0.0
---

# Plain summary

1. Issuing institutions change nothing; credentials are signed as today.
2. The wallet proves a statement such as "I am over 18" without showing the date of birth or the credential.
3. Two presentations by the same person cannot be linked; the limit on credential copies goes away.
4. The method is Longfellow ZK, which Europe has adopted for age verification; only reviewed circuits pinned by their digest are
   valid.
5. If a proof cannot be made (an old phone, a verifier without support), the batch-copy method continues.

# Context

- Unlinkability is also achieved with batch copies: 10 copies of the identity [[t:credential]], a sticky copy per [[t:verifier]]
  (WL5) and the `age_over_18` attribute ([[ADR-0012]], [[ADR-0013]]). This is the EU's current method; copies run out and are
  refreshed, and the [[t:issuer]] signature is visible in every copy.
- On 2026-09-28 project management set the direction (backlog Z5): zk-SNARKs in the wallet, institutional credentials unchanged;
  BBS is not pursued (it requires institutions to change keys; it is not on the EU's approved algorithm list).
- [[t:Longfellow-ZK]]: Google's open-source (Apache-2.0) [[t:mdoc]]/ECDSA proof system; moved to an independent foundation in
  2026-09 (`github.com/longfellow-zk/longfellow-zk`), passed three independent security reviews; the EU age-verification profile
  and TS13 are built on it. It needs no trusted setup. Circuit version 8 binds the docType into the proof; **it does not bind the
  namespace** (Stage 1 measurement).
- **Z5 Stage 1 — a real proof (2026-10-01, `tools/zk-circuit/`):** an `age_over_18 = true` proof was produced and verified over the
  Tamga identity credential (`urn:tamga:id:IdentityAttestation:1`, namespace `tamga.id.1`, `status` in the MSO, bytewise CBOR
  ordering); no change to the credential was needed. Desktop (CPU-specific build, median of 5 runs): proving **518 ms**,
  verification **211 ms**, proof **~343 KB**, proving memory ~92 MB; the circuit (v8, 1 attribute) is deterministic, id
  `5a893815…3c9291`. In a generic x86-64 build proving takes 3.6 s / verification 1.4 s (PCLMUL/AVX2 off) — mobile builds must enable
  the target CPU features. Negative tests: tampered value, wrong institution key, another session/[[t:nonce]], another verifier,
  "true" from a "false" credential, another docType, corrupted proof → all REJECTED. **The namespace is not bound to the proof**
  (verification with another namespace ACCEPTED): at v8 runtime the namespace is used only in a pre-check.

# Decision

## K1 — Proof system (project management: accepted, 2026-10-01)
Longfellow ZK (`longfellow-libzk-v1`), circuit version ≥ 8. Reference implementation Google Rust (`rust/applications/mdoc_zk`);
ISRG `zk-cred-longfellow` in cross-testing as a second implementation.

## K2 — Accepted circuits
The verifier accepts only circuit digests (`combined_hash`, per number of attributes) published in the signed [[t:trust-list]]
(`lotl.jws`). A circuit update = a list update (no ADR needed; announced in the CHANGELOG).

## K3 — First predicate and scope (project management: over-18 first, 2026-10-01)
The first predicate is `age_over_18 = true` in the identity credential. Then: `age_over_21`, `nationality`, enrolment / graduation
in education credentials (equality predicates). Ranges and "any accredited institution" (hiding the institution) are not yet in
Longfellow — out of scope.

## K4 — Transport
[[t:OpenID4VP]] [[t:DCQL]] `format: "mso_mdoc_zk"` (EU TS13 request) and the Digital Credentials API (EU age-verification
profile). A proof is ~350 KB: it cannot be carried in a QR code; for proximity (BLE) a decision follows measurement.

## K5 — Fallback
If the wallet cannot produce a proof or the verifier does not request `mso_mdoc_zk`, the `mso_mdoc` / `dc+sd-jwt` presentation
(batch copies + WL5) continues unchanged. Batch copies are not removed.

## K6 — Revocation status
The circuit does not check revocation status; opening the [[t:status-list]] index would bring linkability back. Interim solution:
credentials presented with ZK are short-lived (silent refresh, [[ADR-0023]]); private revocation proof gets a separate ADR once the
revocation scheme of EU TS13 is settled. The policy chooses explicitly: `accept_unrevocable_zk: true` knowingly accepts a ZK
presentation whose revocation cannot be checked (the result carries `status.value = NOT_APPLICABLE` and `status.reason`); with
`false` the outcome is INDETERMINATE (step D1, `STATUS_UNREACHABLE`).

*Implementation note (2026-10-09):* "short-lived" is defined by [[ADR-0044]]: a ZK presentation uses only ZK copies that are
valid for at most 24 hours, carry no revocation list entry and are refreshed silently; no new copy is issued if the main
credential is revoked or suspended. Implemented (packages 0.4.0): the ZK copy is a separate type
(`urn:tamga:id:ShortLivedIdentityAttestation:1`), the verifier recognises it from the proof and expects no revocation check;
`accept_unrevocable_zk: true` only makes sense for a ZK presentation that is not a short-lived copy (unmarked).

## K7 — Device binding
The proof contains the device key's ES256 signature over the SessionTranscript and hides the device public key; the key stays in
secure hardware (Secure Enclave / StrongBox) and the signing flow does not change.

## K8 — The namespace is not bound: unique attribute names
A Longfellow v8 proof binds the institution key, the docType, the attribute name and the value; it does not bind the namespace.
The verifier learns "in this institution's credential of this type, some namespace has `age_over_18 = true`". Therefore, within a
credential type, an attribute name appears in only one namespace; the schema catalogue (`packages/schemas`) checks this at build
time.

## K9 — Build
Mobile and server builds use the target CPU's GF(2^128) multiplication instructions (x86-64: PCLMULQDQ; ARM: PMULL/NEON); otherwise
proving is ~7× slower (measured).

# Rationale / alternatives

| Option | Result | Why |
|---|---|---|
| **Longfellow ZK (this ADR)** | **accepted** | Institutional credentials unchanged; same as the EU age-verification profile and TS13; no trusted setup; independently reviewed |
| BBS / BBS# signatures | rejected | Institution keys and signature format change; not on the EU's approved mechanism list (direction of 2026-09-28) |
| Microsoft Crescent | watch | ZK over existing JWT/mdoc; not the EU profile |
| Batch copies only | fallback (K5) | Works, but copies run out and the institution's signature is the same in every presentation |

# Invariants

| Code | Rule |
|---|---|
| ZK1 | The format and signature of the institutional credential are not changed for ZK presentation; ZK lives only in the wallet and the verifier. |
| ZK2 | The verifier accepts only circuit digests published in the signed trust list with status ACTIVE; an unknown or inactive circuit = REJECTED. |
| ZK3 | A ZK presentation proves only the attributes requested in DCQL; no attribute outside the proof reaches the verifier. |
| ZK4 | A ZK presentation does not reveal the status list index; credentials presented with ZK are kept short-lived (K6). |
| ZK5 | If ZK is not supported, the presentation follows the classic rules (including WL5); a proof failure is shown to the user as "cannot be shown this way right now" and leaks no data. |
| ZK6 | Within a credential type an attribute name appears in only one namespace (K8). |

# Implementation plan

| Stage | Work | Prerequisite |
|---|---|---|
| 1 | ✅ Real proof + verification on the desktop, measurements, negative tests, Node bridge prototype (2026-10-01) | — |
| 2a | ✅ `@tamga-network/zk`: prover package — core (DCQL → claims, circuit selection and ZK2 check, ZkDocument), desktop prover (`/node`, Rust child process), phone module scaffold (`/react-native`, Expo; Rust C ABI / JNI); end-to-end test: the package's proof passes the network verifier (2026-10-06) | Stages 1, 3 |
| 2b | Building the phone libraries and on-device measurement: Android ✅ (2026-10-07; arm64-v8a, armeabi-v7a, x86_64), iOS xcframework pending (macOS); on-device measurement with the store build | macOS (iOS) |
| 2c | ✅ Wallet wiring (2026-10-06): `wallet-core` matches `mso_mdoc_zk` queries like mdoc, hands the usual device-signed response to a prover hook (`RespondInput.zk`) and puts only the proof in the vp_token; without a prover ZK queries are not offered and the classic option in `credential_sets` is chosen (ZK5). Tamga Wallet wires the hook with `@tamga-network/zk`; proving stays off until the phone libraries and circuit files arrive (2b) | 2b; store build (Z1) |
| 3 | ✅ `@tamga-network/verifier`: `mso_mdoc_zk` verification (bundled WASM, `/zk`); circuit digests in the trust list (`lotl.zk_circuits`); policy `format: "mso_mdoc_zk"`; Tamga Verify `age-over-18-zk` (2026-10-01) | Stage 1 |
| 4 | Transport (DCQL + DC API), cross-testing with the EU reference verifier; updates to `/docs/selective-disclosure` and SPEC-WALLET-0001 | Stage 3 |

## Prover package (Stage 2)

Proof generation is an open network package (`@tamga-network/zk`), not part of one wallet: every wallet that follows the network's
rules uses the same prover ([[ADR-0035]]). The package has three entry points: a pure-TS core (React Native safe) turns a DCQL
`mso_mdoc_zk` query into the claims to prove, picks the circuit from the trust list and checks its bytes against the hash (ZK2), and
wraps the proof as a TS13 `ZkDocument`; `/react-native` is the on-device prover (Expo module `TamgaZk`, Rust core over a C ABI — JNI on
Android); `/node` runs the same Rust code on the desktop as a child process (tests, conformance runs). The Rust core is pinned to the
same upstream commit as the verifier. The wallet first produces the usual device-signed DeviceResponse for the session (hardware key
and phone lock — WL11 unchanged); the prover takes that response as input and only the proof reaches the verifier. Without a prover
(`available() === false`) the presentation goes the usual way (ZK5). Circuit files may ship with the app or be downloaded; either way
they are checked against the hash in the list.

## Verifier (Stage 3)

The verifier compiles only Longfellow's VERIFICATION code to WebAssembly (`packages/verifier/zk`, pinned upstream commit
`d5e6be77`; the C dependency `zstd` is patched with a pure-Rust shim, the upstream code is untouched; the build is reproducible,
`npm run zk:build -- --check`). The WASM is 889 KB with no external dependencies; verification takes ~3 s on the desktop (0.2 s with
a native build — K9; if speed is needed, a native backend via `VerifyInput.zk`). Format `mso_mdoc_zk` (TS13 ZkDocument), step `Z1`
([[SPEC-API-0001]]), circuits in `lotl.zk_circuits` ([[SPEC-TRUST-0001]]). Tests use a real proof fixture
(`scripts/zk-fixtures.ts`); no Rust needed. An infrastructure failure on the verifier side (circuit file missing, WASM cannot be
loaded) is not the presentation's fault: the outcome is INDETERMINATE (`SDK_VERSION_MISMATCH`), not REJECTED. The wallet side
supports the "prefer" mode (ZK + classic option via DCQL `credential_sets`; Stage 2c: a wallet without a prover picks the classic
option); Tamga Verify currently offers the ZK and classic policies separately, so ZK5 = the verifier asks again with the classic
policy (`age-over-18-mdoc`).

## Native backend (K9)

A `tamga-zk-verify` binary built from the same Rust source with `--features native` (the WASM output does not change;
`rust-toolchain.toml` pinned to 1.98.1). `NativeZkBackend` runs the binary as a long-lived subprocess (framed stdin/stdout; no
network/file access); if the binary is missing, crashes or times out, the request falls back to WASM and an error never counts as
"valid"; the circuit digest (ZK2) is checked on the Node side on both paths. Tamga Verify uses it via `TAMGA_ZK_NATIVE_BIN`; on the
server it is built in `deploy.sh` step 4b (only when the source changes). Measurement (desktop, full pipeline): native median
289 ms; WASM ~4 s under the same load.

# Resolved questions (project management, 2026-10-01)

1. **Longfellow ZK accepted as the proof system** (K1).
2. **Setup:** user-level tools (Rust + a portable compiler) were enough; no administrator installation was needed.
3. **First predicate:** "over 18" only; enrolment in a later round.

# Status

**Accepted — 2026-10-01** (approved by project management: proof system Longfellow, first predicate `age_over_18`). Stage 1 desktop
trial and Stage 3 (verifier) done; Stages 2a/2c done, in 2b the Android native library was built (2026-10-07), the iOS
xcframework and on-device measurement are pending (store build, Z1). Experiment: `tools/zk-circuit/README.md`.
