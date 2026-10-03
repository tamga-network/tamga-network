---
title: Trust lists and federation
---

# Trust lists and federation

A diploma arrives signed, but the signature alone does not answer the question "is the signer really a university?". The
answer is in the **[[t:trust-list]]**: a signed, versioned list that shows which institutions ([[t:issuer|issuers]]) may issue which
credential types, which [[t:verifier|verifiers]] are registered and which [[t:wallet-provider|wallet providers]] are recognised.

## Two levels

| List | What it contains | Address |
|---|---|---|
| **List of Trusted Lists (LOTL)** | The addresses of the country lists and the certificates that sign them, wallet providers, the schema catalogue, shared settings | `https://trust.tamga.network/lotl.jws` |
| **Country list** | That country's issuers, verifiers and root certificates | `https://trust.tamga.network/tl-tr.jws` |

This is the EU trust model: the European Commission publishes a [[t:LOTL]] and each member state publishes its own list. The
formats map to the [[t:ETSI]] standards.

## A single root key

A wallet or a verifier trusts only **one thing** up front: the fingerprint of the root that signs the LOTL (the
[[t:trust-anchor]]). You pin the fingerprint in your configuration (`https://tamga.network/trust-anchor`); the list tells you
the rest. Do not interpret the list yourself — the `TrustSource` interface checks the signature, the version chain and the
freshness, and gives you the entries.

```ts
import { fetchListTrustSource, verifyJws } from "@tamga-network/trust";

const { source } = await fetchListTrustSource("https://trust.tamga.network", http, {
  rootFingerprints: ["<fingerprint from the trust-anchor page>"],
  verifyJws,
});
const issuer = source.issuer(issuerId); // institution entry: authorised credential types, level, status
```

## Today and tomorrow

- **Today:** Tamga publishes the Türkiye list on behalf of the national authority, provisionally
  (`operator.status: provisional`). The Tamga operator registers issuers and verifiers.
- **Hand-over:** when the state, or a body it authorises, publishes its own list, the LOTL points to that list's address and
  signer. Credentials, wallets and verifiers do not change; institution identifiers (`issuer_id`) are derived from the
  certificate, so they stay the same.
- **[[t:federation|Federation]]:** every Turkic state can run its own list; the LOTL brings them together and introduces them
  to each other. Mutual recognition (for example of EU lists) comes in through the same door. A ledger becomes the shared record
  of these entries once at least two independent operators take part.

## Details

- List format and cadence: [[SPEC-TRUST-0001]]
- Institutional identity (X.509): [[SPEC-ID-0002]]
- Federation: [Federation](/concepts/federation) · connecting a country list: [[GUIDE-0011]]
- Guide: [[GUIDE-0006]]
- Positioning decision: [[ADR-0035]]
