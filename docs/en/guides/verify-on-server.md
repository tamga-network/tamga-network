---
document_id: GUIDE-0002
title: "Verify on your server"
status: Active
version: 1.0.0
created: 2026-09-27
last_updated: 2026-10-07
summary: >
  Verifying Tamga credentials on your own server: loading the trust source, prefetching status lists, policy → signed
  OpenID4VP request, decrypting the encrypted response and the canonical verification pipeline (T0 + A–E). Reference
  implementation: apps/verify.
translation_of: GUIDE-0002
source_version: 1.0.0
---

# Verify credentials on your server

This guide is for developers who want to verify Tamga [[t:credential|credentials]] **on their own server**, without going
through the hosted [[t:verifier]]: hiring, campus access, age checks, ticket gates.

**When to read:** when you want credential values never to pass through an intermediary, or you want to run verification on
your own infrastructure. For a faster start, use the hosted verifier: [[GUIDE-0001]]. Working code: [[GUIDE-0004]] §2.

## How it works

1. Your server describes what it wants with a **policy** (e.g. "diploma: name, programme, graduation year") and produces a
   signed request. The request is shown as a QR code or a link; it contains no personal data.
2. The person sees the request in the wallet and approves; the wallet sends the answer to your server, **encrypted**.
3. Your server decrypts the answer and runs the verification pipeline: signature, [[t:trust-list]], [[t:revocation]] status,
   validity period, [[t:holder-binding]] and policy.
4. The result is one of three values: accepted, rejected, or "cannot be verified right now".

`@tamga-network/verifier` implements the whole pipeline ([[SPEC-API-0001]], steps T0 + A–E). The reference verifier
`apps/verify` (verify.tamga.network) uses the same library; every step below runs there.

## Preparation

1. **Verifier registration.** You have a verifier entry in the Tamga trust list: your permanent identifier is your domain name
   (`dns_name`), your client identifier has the form [[t:x509_hash|x509_hash:…]] (the list publisher computes it from your
   [[t:access-certificate]]), and your X.509 certificate and the scope of the fields you may ask for are registered too. If
   your request goes beyond that scope, the wallet refuses it.
2. **Trust source.** Load the trust lists with `@tamga-network/trust`: `loadTrustSourceFromDir(dist)`, or regular download +
   reload (`guardedReload`). Ask every trust question of `TrustSource` only.
3. **Prefetch the status lists.** `new PrefetchStatusCache()` + a regular `refresh(uris)`. Nothing goes over the network at the
   moment of verification.

## Flow

```ts
import { dcqlFromPolicy, createPresentationRequest, decryptResponse, verifyPresentation, pemRpSigner,
         PrefetchStatusCache, type Policy } from "@tamga-network/verifier";

const policy: Policy = { policy_id: "ise-alim", /* credentials, trust, freshness */ } as Policy;
const signer = await pemRpSigner(RP_KEY_PEM, RP_CERT_PEM); // client_id = x509_hash (from the certificate)
// 1) request: shown as a QR code / deep link (no personal data; request_uri only)
const req = await createPresentationRequest({ signer, dcql: dcqlFromPolicy(policy),
  responseUri: "https://ornek.com.tr/vp/response", requestUriBase: "https://ornek.com.tr/vp/req" });
// 2) the wallet POSTs the encrypted response to response_uri → decrypt
const resp = await decryptResponse(jweBody, req.encPrivateKey); // key created with the request; match it with req.state
// 3) verify (SD-JWT; for mdoc use format: "mso_mdoc" + responseUri)
const { result, claims } = await verifyPresentation({ presentation: resp.vp_token["diploma"][0], aud: signer.clientId, nonce: req.nonce,
  policy, policyCredentialId: "diploma", trust, statusCache, rootCertsDer, rp: trust.relyingParty(signer.clientId) });
```

Field names and signatures are defined in the package types; the full working example is
`apps/verify/src/routes/presentations.ts`.

The client identifier has the `x509_hash` form (HAIP 1.0 §5); `pemRpSigner(key, certificate)` computes it from the
certificate ([[ADR-0034]]). When you renew the certificate, the new certificate goes into the trust list first, then your
server switches to it.

## Reading the result

| `outcome` | Meaning | Tell the user |
|---|---|---|
| `ACCEPTED` | every step passed | use only the approved fields in `claims` |
| `REJECTED` | the credential is invalid (signature, revocation, validity, binding, policy) — `failed_step` says where it failed | "The credential was not accepted" |
| `INDETERMINATE` | an infrastructure or freshness problem (e.g. `STATUS_STALE` in steps D2/D4/D5) — the credential is not bad | "Cannot be verified right now, please try again" |

`checks_performed` / `checks_skipped` may be kept for audit; **do not keep personal data**. The clock-skew tolerance is set
with `policy.freshness.max_clock_skew_sec` (default 120 s).

## Checklist

- The [[t:nonce]] is single-use; the same response is never processed twice.
- The policy asks only for the fields it needs; for age a single [[t:mdoc]] field such as `age_over_18` is enough.
- [[t:status-list|Status list]] prefetching and trust list refreshing must be running. If they are not, results become
  `INDETERMINATE` — which is the correct behaviour.

## In depth: age verification with a zero-knowledge proof (`mso_mdoc_zk`)

You can ask "is this person over 18?" without seeing the credential, the date of birth, the institution's signature or the
device key ([[ADR-0032]]). The wallet produces a proof with [[t:Longfellow-ZK]]; all you learn is "`age_over_18 = true` in the
identity credential of a registered institution". Two presentations by the same person cannot be linked.

```ts
const policy: Policy = {
  policy_id: "age-over-18-zk",
  purpose: { "en-US": "Over-18 check — yes/no only" },
  credentials: [{
    id: "identity", vct_values: ["urn:tamga:id:IdentityAttestation:1"],
    format: "mso_mdoc_zk", namespace: "tamga.id.1",
    required_claims: ["age_over_18"], constraints: { age_over_18: true }, // equality only
    accept_unrevocable_zk: true, // knowingly accept a ZK presentation whose revocation cannot be checked (ZK4)
  }],
  trust: { ... }, freshness: { ... },
};
// Request: the accepted circuits come from the signed list (ZK2)
const dcql = dcqlFromPolicy(policy, { zkCircuits: trust.zkCircuits?.() ?? [] });
// Response: vp_token.identity[0] = base64url(DeviceResponse{ zkDocuments })
const { result } = await verifyPresentation({ presentation, format: "mso_mdoc_zk", responseUri, aud, nonce,
  policy, policyCredentialId: "identity", trust, statusCache, rootCertsDer });
```

- **Verification runs on the bundled WebAssembly;** no Rust or native build is needed. One verification takes about 3 s on a
  desktop.
- **A native backend for very high volume:** from the `packages/verifier/zk` source, `cargo build --release --locked
  --features native --bin tamga-zk-verify` (Rust 1.98.1, Linux/macOS), then `new NativeZkBackend({ binPath })` or, from the
  environment, `zkBackendFromEnv()` (`TAMGA_ZK_NATIVE_BIN`) → `VerifyInput.zk`. A verification takes about 0.2–0.3 s; if the
  binary does not respond, it falls back to WASM.
- **New step `Z1`:** is the circuit in the signed list, was only the requested element disclosed, is the timestamp fresh, is
  the proof valid? The institution signature, the device signature and the validity are checked inside the proof
  (`checks_skipped`: A4–A7). No revocation status comes with it (`status.value: NOT_APPLICABLE`, the reason in
  `status.reason`). The identity credential presented with ZK is valid for 2 years today and its revocation is not
  visible; choose this path only where revocation does not change the outcome (for example an age check).
- **`accept_unrevocable_zk`:** a policy that uses `mso_mdoc_zk` must state it explicitly. `true` accepts a presentation whose
  revocation cannot be checked; with `false` every ZK presentation returns `INDETERMINATE` (step `D1`, `STATUS_UNREACHABLE`) —
  if a revocation check is required, use the classic `mso_mdoc` policy.
- **Fallback:** if the wallet does not support ZK, your query will not match; ask the same question with the classic
  `mso_mdoc` policy (`age-over-18-mdoc`). Wallet side: `@tamga-network/zk` (Android native library ready, iOS pending); a
  wallet without a prover uses the classic path (ZK5).

## Rules

| Code | What it says |
|---|---|
| [[SPEC-API-0001]] AP2 | `INDETERMINATE` is never put in the same bucket as `REJECTED` |
| [[SPEC-API-0001]] AP3–AP4 | results and records carry no field values and no status index |
| [[SPEC-API-0001]] AP6 | a request cannot exceed the scope of the verifier's registration |
| Single trust interface | trust data is read only through `TrustSource` |
| [[SPEC-CRED-0003]] S12 | no status list is fetched per verification; batch prefetching is used |
| [[SPEC-PROTO-0002]] PV10 | the `nonce` is single-use |
| [[ADR-0032]] ZK2, ZK5 | only circuits in the signed list are accepted; without ZK, the classic path |
