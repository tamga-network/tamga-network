---
title: Presentation (OpenID4VP)
---

# Presentation

A [[t:verifier]] (a website, an employer, a gate) asks the wallet for a credential; the person approves; the verifier
computes the result locally, without asking the source. The protocol is **[[t:OpenID4VP]] 1.0** (the EU profile
[[t:HAIP]] 1.0) and the query language is **[[t:DCQL]]**.

## The request

- The request is **signed**. The verifier is identified by the fingerprint of its [[t:access-certificate]]
  ([[t:x509_hash|client_id = x509_hash:…]]); the wallet checks the signature, the certificate and the verifier's entry in the
  [[t:trust-list]], and shows the person the registered purpose and the requested fields.
- A verifier may only ask for fields within the scope of its entry in the trust list.
- The response is **encrypted** with the verifier's key.

## Channels

| Channel | When | Status |
|---|---|---|
| QR code / link (`openid4vp://`) | a website or kiosk on another device | live |
| Digital Credentials API | a website in the browser on the same phone (the browser opens the wallet) | verifier ready; no wallet connection yet |
| ISO 18013-5 proximity (BLE) | a gate, turnstile or counter — in person | implemented; device testing pending (until then a short-lived pass) |

## Verification and three outcomes

The verifier checks, in order, the signature, the issuer's authorisation in the trust list, the [[t:holder-binding]], the
validity period and the revocation status. The result has **three values**:

| Outcome | Meaning |
|---|---|
| `ACCEPTED` | the credential is valid |
| `REJECTED` | the credential is invalid; the failing step is reported |
| `INDETERMINATE` | cannot be verified right now (e.g. the status list is stale) — it does **not** mean the credential is bad |

```ts
import { verifyPresentation } from "@tamga-network/verifier";

const { result, claims } = await verifyPresentation({
  presentation, aud, nonce, policy, policyCredentialId: "diploma", trust, statusCache, // full example: Code examples
});
if (result.outcome === "ACCEPTED") {
  // claims: only the fields the policy asked for. Log field names only, never values.
}
```

## Your own server or the hosted one?

- **Tamga Verify** (`verify.tamga.network`): the hosted verifier and page kit; the result is given only to your server, and
  only once. Guide: [[GUIDE-0001]].
- **Your own server:** [`@tamga-network/verifier`](/packages/verifier). Guide: [[GUIDE-0002]].

## Details

- Protocol: [[SPEC-PROTO-0002]], verification pipeline: [[SPEC-API-0001]]
