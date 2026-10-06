---
document_id: GUIDE-0001
title: "Add “Sign in with Tamga”"
status: Active
version: 1.0.0
created: 2026-09-27
last_updated: 2026-10-06
summary: >
  Adding sign-up and sign-in with Tamga to a website: the `@tamga-network/verifier/web` kit on the page (QR code / open the
  wallet on the phone), fetching the result from the verifier on the server and opening a session, and passkey sign-in without
  the phone after sign-up. Working example in the
  sandbox: verify.sandbox.tamga.network/sample-site (apps/verify/src/routes/site.ts).
translation_of: GUIDE-0001
source_version: 1.0.0
---

# Add "Sign in with Tamga" to your website

This guide is for developers who want to add sign-up and sign-in with a wallet that follows the network's rules (e.g. Tamga Wallet) to a website. Tamga's hosted
[[t:verifier]] (Tamga Verify) does the verification; you are left with a page kit and a few server endpoints.

**When to read:** when you want password-free sign-up and sign-in with a phone on your site. Take a look at [[GUIDE-0000]]
first. If you would rather do the whole verification on your own server, go to [[GUIDE-0002]].

**To try it:** the working sample site is on the test network: `https://verify.sandbox.tamga.network/sample-site` (once the
sandbox is live; addresses and the test wallet setting are in [[GUIDE-0013]]). Tamga Verify on the real network has no sample site.

## How it works

1. **Sign-up (once).** Your site starts a request with a *policy* (e.g. "given name, family name" + [[t:pseudonym]]). On a
   computer a QR code appears; on a phone, an "Open in your wallet" button. In the wallet the person sees **only these
   fields** and the line "a pseudonym for this site", and approves.
2. **Verification.** The verifier checks the [[t:credential]]: signature, [[t:trust-list]], [[t:revocation]],
   [[t:holder-binding]]. Your page watches the result; on `ACCEPTED` it sends the presentation identifier (`presentation_id`)
   to **your own server**. Your server fetches the approved fields from the verifier, opens the account and sets a session
   cookie.
3. **Passkey (recommended).** Straight after sign-up: "Add a passkey to this device". Later sign-ins use Face ID or a
   fingerprint: the wallet does not open, **no field is shared**, and the passkey belongs to your site only.
4. **A new device or no passkey.** "Sign in with Tamga" asks only for the pseudonym, never for a credential field; a passkey is
   then added again.

**The account key is the pseudonym** ([[ADR-0031]]). The pseudonym belongs to your site only: another site sees a different
value for the same person, so sites cannot match people. When the person verifies their identity again on a new phone, the same
pseudonym comes back; the account is not lost.

## 1. Server: you open the presentation

Every call you make to the hosted verifier carries a short-lived signed statement (`Authorization: Bearer …`, at most
60 seconds, single use). You sign the statement with **the key of the [[t:access-certificate]]** in your site's trust list
entry; there is no separate password ([[ADR-0017]]).

```ts
import { createRpAssertion, pemRpSigner } from "@tamga-network/verifier";
const rp = await pemRpSigner(RP_KEY_PEM, RP_CERT_PEM); // client_id = x509_hash (from the certificate)
const auth = async () => ({ authorization: `Bearer ${await createRpAssertion(rp, VERIFIER)}` });

// POST /tamga/start { policy }  → to the page: { presentation_id, qr_payload, expires_at, status_token }
const r = await fetch(`${VERIFIER}/presentations`, { method: "POST",
  headers: { ...(await auth()), "content-type": "application/json", accept: "application/json" },
  body: JSON.stringify({ policy_id: policy }) }).then((x) => x.json());
```

The client identifier ([[t:x509_hash]]) is computed from your certificate. The pseudonym, on the other hand, is bound to your
site's registered domain name; it does not change when you renew the certificate ([[ADR-0034]]).

The wallet's consent screen shows **your site's registered name** (with the note "intermediary verifier: verify.tamga.network").
The fields you ask for are checked against the scope of your registration.

## 2. The page

The verifier serves the page kit; add it with a `<script>` tag:

```html
<script src="https://verify.tamga.network/tamga-verifier.js"></script>
<div id="tamga"></div>
<script>
  TamgaVerifier.mount(document.getElementById("tamga"), {
    verifier: "https://verify.tamga.network",
    policy: "site-signup", // "site-signin" for sign-in
    start: () => fetch("/tamga/start", { method: "POST", headers: { "content-type": "application/json" },
                                          body: JSON.stringify({ policy: "site-signup" }) }).then((r) => r.json()),
    onResult: (presentationId) =>
      fetch("/oturum", { method: "POST", headers: { "content-type": "application/json" },
                         body: JSON.stringify({ presentation_id: presentationId }) }).then(() => location.reload()),
  });
</script>
```

The same interface from npm: `import { mount, passkey } from "@tamga-network/verifier/web"`.

The kit **does not verify** and **sees no values**: it only watches the state with `status_token`; the decision and the
values are on your server. `onError` shows the INDETERMINATE state separately: "cannot be verified right now, try again" —
this does not mean the credential is invalid.

## 3. Server: opening the session

```ts
// POST /oturum { presentation_id }  — accept JSON only (CSRF); Origin must be the same site
const r = await fetch(`${VERIFIER}/presentations/${id}`, { headers: await auth() }).then((x) => x.json());
if (r.outcome !== "ACCEPTED") return res.status(400).send();       // INDETERMINATE → "try again"
const { claims } = await fetch(`${VERIFIER}/presentations/${id}/claims`, { headers: await auth() }).then((x) => x.json());
// the values are given ONCE (a second read returns 410) and are deleted 5 min after the result — process them at once
const hesapAnahtari = hmacSha256(SITE_SIRRI, claims.pseudonym); // the pseudonym is yours alone; still store it keyed with a site secret
```

Only the site that opened the presentation can fetch the result and the values; anyone else who knows the presentation
identifier gets `404`.

What to watch for, as implemented in the sample site (`apps/verify/src/routes/site.ts`):

- **Single use:** one presentation opens one session.
- **Policy check:** accept only presentations made with your own site policies.
- **Account key:** `claims.pseudonym`. The verifier has already checked the signature, the `aud`/[[t:nonce]] values and the
  [[t:WIA]]. Site policies never ask for a digest of the identity credential or an identity number. By default there is one
  pseudonym (one account) per person; if your registration has `pseudonyms: "multiple"`, a person can open several pseudonyms.
  The "one account per person" limit rests on a real wallet: the WIA limits it, and a strict proof will come with
  zero-knowledge proofs.
- **Cookie:** `HttpOnly; SameSite=Lax; Secure`; keep the session lifetime on the server; for CSRF, JSON only + an Origin check.
- **No personal data in logs** (including names, keys and passkey identifiers).

## 4. Passkey (WebAuthn)

Use a WebAuthn library on the server (the sample site uses `@simplewebauthn/server`): `options` + `verify` endpoints for
registration and sign-in; `attestation: "none"`, `residentKey: "required"`, `userVerification: "required"`. On the page:

```js
const o = await post("/passkey/register/options");     // while signed in
await post("/passkey/register/verify", await TamgaVerifier.passkey.create(o));
// sign-in: const { flow, options } = await post("/passkey/login/options");
//          await post("/passkey/login/verify", { flow, response: await TamgaVerifier.passkey.get(options) });
```

WebAuthn **does not work on an IP address**: you need `localhost` or an HTTPS domain name (rpID = the page's domain).

## 5. Before going to production

- Your site needs a **verifier entry** in the Tamga trust list; the fields you ask for cannot exceed its scope.
- In production the hosted verifier rejects requests without a statement (`TAMGA_VERIFY_REQUIRE_RP_AUTH=1`). In demo/LAN mode
  the old path without a statement still works, with a `Deprecation` header. If you prefer, do the whole verification on your
  own server: [[GUIDE-0002]].
- Policy names and field sets are agreed with Tamga (e.g. only "over 18" → `age-over-18-mdoc`).

## Rules

The rules behind the behaviour in this guide:

| Code | What it says |
|---|---|
| [[SPEC-API-0001]] AP6 | a request cannot exceed the scope of the verifier's registration |
| [[ADR-0017]] HV1–HV4 | the result and the values are given only to the site that opened the presentation, once |
| [[ADR-0017]] HV6 | with an intermediary verifier, the actual site is what the screen and the scope are based on |
| [[SPEC-API-0001]] step P1 | the verifier checks the pseudonym signature, the `aud`/`nonce` values and the WIA |
| [[ADR-0031]] PS4 | site sign-in policies never ask for an identity number or a digest of the identity credential |
