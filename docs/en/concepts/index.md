---
title: Concepts
---

# Concepts

Six ideas you need to work with Tamga. Each page takes a few minutes to read; the details and the binding rules are in the
specifications.

<div class="tg-cards">

<a class="tg-card" href="/concepts/trust-lists">
<strong>Trust lists and federation</strong>
<span>How does a verifier know that the institution behind a credential is real? Signed lists and a single root key.</span>
</a>

<a class="tg-card" href="/concepts/federation">
<strong>Federation</strong>
<span>Each country keeps its own list; Tamga brings the lists together and introduces them to each other. One anchor, many lists.</span>
</a>

<a class="tg-card" href="/concepts/credential-formats">
<strong>Credential formats</strong>
<span>SD-JWT VC and ISO mdoc: one credential, two formats — one for the internet, one for in person.</span>
</a>

<a class="tg-card" href="/concepts/issuance">
<strong>Issuance</strong>
<span>From the institution to the wallet: a QR offer or a request from the wallet, identity matching, wallet attestation (OpenID4VCI).</span>
</a>

<a class="tg-card" href="/concepts/presentation">
<strong>Presentation</strong>
<span>From the wallet to the verifier: a signed request, only the requested fields, three outcomes (OpenID4VP).</span>
</a>

<a class="tg-card" href="/concepts/privacy">
<strong>Privacy</strong>
<span>Selective disclosure, one copy per verifier, a pseudonym per site, age with a zero-knowledge proof.</span>
</a>

<a class="tg-card" href="/concepts/revocation">
<strong>Revocation and freshness</strong>
<span>Status lists, prefetching and the "cannot be verified right now" outcome.</span>
</a>

</div>

## Tamga in one paragraph

Institutions (a university, a hospital, a ticket seller) issue digital credentials to people; the credential lives in the
wallet on the person's phone. When an employer, a website or a gate asks for it, the person shows only the fields that are
needed; the [[t:verifier]] checks the signature, the institution's entry in the [[t:trust-list]] and the revocation status in
seconds, without asking the source. The formats and protocols are the same as the EU digital identity wallet
([[t:eIDAS]] 2.0 / [[t:EUDI-Wallet]]); any wallet and verifier that follows Tamga's rules works on the network.
