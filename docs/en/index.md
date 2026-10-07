---
layout: home
title: Tamga Developer Docs
hero:
  name: Tamga Docs
  text: Add verifiable credentials to your product
  tagline: Verify a diploma, a student certificate, an identity credential or a ticket in seconds — or issue them to people's wallets. Built on the EU digital identity standards (OpenID4VC, SD-JWT VC, ISO mdoc), with open-source packages.
  actions:
    - theme: brand
      text: Get started
      link: /guides/
    - theme: alt
      text: Concepts
      link: /concepts/
    - theme: alt
      text: API reference
      link: /api/
      target: _self
features:
  - icon: ✓
    title: Verify credentials
    details: Add "Sign in with Tamga" to your website, or verify diplomas, identity, age and tickets on your own server.
    link: /guides/sign-in-with-tamga
    linkText: Verification guide
  - icon: ⬇
    title: Issue credentials
    details: Issue your institution's credentials to people's wallets — with the hosted service or your own server.
    link: /guides/issue-credentials
    linkText: Issuance guide
  - icon: ▣
    title: Build a wallet
    details: Build a Tamga-compatible wallet; receive credentials, store them and present them with selective disclosure.
    link: /guides/build-a-wallet
    linkText: Wallet guide
  - icon: ⛓
    title: Read trust lists
    details: Pin the signed trust lists to your root key; country lists and a shared ledger come later.
    link: /guides/read-trust-lists
    linkText: Trust list guide
---

<div class="tg-home">

## Verify in five minutes

Two packages are enough to verify a diploma on your own server: the [[t:trust-list]] reader and the [[t:verifier]] pipeline.

```sh
npm install @tamga-network/verifier @tamga-network/trust
```

```ts
import { fetchListTrustSource, verifyJws } from "@tamga-network/trust";
import { createPresentationRequest, dcqlFromPolicy } from "@tamga-network/verifier";

// 1. Load the trust lists (root fingerprint: tamga.network/trust-anchor)
const { source: trust } = await fetchListTrustSource("https://trust.tamga.network", http, {
  rootFingerprints: [ROOT_FINGERPRINT],
  verifyJws,
});

// 2. Create a signed request → show it as a QR code
const req = await createPresentationRequest({ signer, dcql: dcqlFromPolicy(DIPLOMA_POLICY), responseUri, requestUriBase });
show(req.qrPayload);
```

The full, tested example: [Code examples](/guides/code-examples). With Tamga Verify (the hosted verifier) you need no server
code at all: [Add "Sign in with Tamga" to a website](/guides/sign-in-with-tamga).

## Explore

<div class="tg-cards">

<a class="tg-card" href="/concepts/">
<strong>Concepts</strong>
<span>Trust lists, credential formats, issuance and presentation, privacy, revocation — short and plain.</span>
</a>

<a class="tg-card" href="/packages/">
<strong>SDKs</strong>
<span>Nine <code>@tamga-network/*</code> packages for Node and React Native. Version 1.0.0; on npm with the go-live announcement.</span>
</a>

<a class="tg-card" href="/api/" target="_self">
<strong>API reference</strong>
<span>Endpoints of the hosted issuance and verification services.</span>
</a>

<a class="tg-card" href="/specifications/">
<strong>Specifications</strong>
<span>The binding rules: formats, protocols, trust lists, the verification pipeline.</span>
</a>

</div>

## Environments

| Address | What |
|---|---|
| `trust.tamga.network` | Signed trust lists |
| `schemas.tamga.network` | Credential type catalogue |
| `issuer.tamga.network/{institution}` | Hosted issuer service |
| `verify.tamga.network` | Tamga Verify — hosted verifier and page kit |
| `status.tamga.network` | Status lists (revocation) |
| `console.tamga.network` | Institution Console — the management screen for issuers |
| `id.tamga.network` | Identity service — provisional identity credential (until a state PID exists) |
| `docs.tamga.network` | These docs |
| `arf.tamga.network` | Tamga ARF — framework and rules |

All addresses and what they do: [tamga.network/network](https://tamga.network/en/network).

Roles, participation rules and the trust framework: [Tamga ARF](https://arf.tamga.network/). Licence: documentation
CC BY 4.0, code Apache-2.0.

</div>
