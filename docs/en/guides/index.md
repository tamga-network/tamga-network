---
document_id: GUIDE-0000
title: "Get started"
status: Active
version: 1.0.0
created: 2026-09-27
last_updated: 2026-10-07
summary: >
  An introduction for developers: the four paths in Tamga (verifier, issuer, wallet developer, network/node operator),
  which package to install, which addresses to use, how to set up a local development environment and what is ready today.
translation_of: GUIDE-0000
source_version: 1.0.0
---

# Get started

This page is the first stop for anyone who wants to build something with Tamga: it shows which path fits you, which package
to install and how to try things locally.

**When to read:** on day one, before writing any code. From here you move on to the guide for your role. If you would like a
look at the ideas first, the [Concepts](/concepts/) section is short and plain.

## What does Tamga do?

Institutions issue credentials to people: a diploma, a student certificate, an identity credential, a ticket. Tamga puts these
credentials into the wallet on the person's phone. Anyone who needs to see one (an employer, a website, an event gate) verifies
it in seconds, without asking the institution. Each time, the person shares only the fields that were asked for.

The standards are the same as the EU digital identity wallet: [[t:SD-JWT-VC]] and ISO [[t:mdoc]]
[[t:credential|credentials]], [[t:OpenID4VCI]] for issuance, [[t:OpenID4VP]] for presentation, X.509 for institutional
identity, and signed [[t:trust-list|trust lists]].

This site is for **developers**. Roles, rules and the conditions for taking part are in [Tamga ARF](https://arf.tamga.network/);
the general overview is at [tamga.network](https://tamga.network/en/learn).

## Which path is yours?

| What do you want to do? | Guide | Package |
|---|---|---|
| Add "Sign in with Tamga" to your website | [[GUIDE-0001]] | `@tamga-network/verifier` (+ `/web`) |
| Verify credentials on your server (hiring, campus, age, ticket gate) | [[GUIDE-0002]] | `@tamga-network/verifier`, `@tamga-network/trust` |
| Register your institution as an issuer | [[GUIDE-0007]] | — |
| Register your site as a verifier | [[GUIDE-0008]] | — |
| Issue your institution's credentials to people's wallets | [[GUIDE-0003]] | `@tamga-network/issuer` (+ `/client`) |
| Build a Tamga-compatible wallet | [[GUIDE-0005]], checklist [[GUIDE-0010]] | `@tamga-network/wallet-core` |
| Read trust lists, and later run a network node | [[GUIDE-0006]] | `@tamga-network/trust` |
| Connect your country's trust list to the network | [[GUIDE-0011]] | `apps/trust-publisher` |
| Show that your application follows the rules | [[GUIDE-0009]] | `conformance/` |
| Test end to end without touching the real network (test network) | [[GUIDE-0013]] | `sandbox.tamga.network` |
| See working, tested code for all of the above | [[GUIDE-0004]] | — |
| When something goes wrong | [[GUIDE-0012]] | — |

## Try it locally

You need Node.js 22 and Git. Clone the repository and set up the development environment:

```sh
git clone https://github.com/tamga-network/tamga-network && cd tamga-network
npm install
npm run setup            # development PKI → schema catalogue → trust lists → verification
npm run check            # tests + type check
npx vitest run examples   # four examples, with the real packages
```

`npm run setup` produces a local root certificate, sample institution certificates and signed trust lists (`ops/pki/`; private
keys never enter the repository). You can test your code against these local lists. For the conformance vectors:
`npm run conformance` (`conformance/`).

## Packages

| Package | What it does | Who uses it |
|---|---|---|
| `@tamga-network/core` | digests, identifier derivation (`issuer_id`, `schema_id`), certificate helpers | everyone (indirectly) |
| `@tamga-network/trust` (+ `/core`) | loads and verifies the signed trust lists; one read interface, `TrustSource` | verifier, wallet, issuer |
| `@tamga-network/schemas` | credential type catalogue: type metadata, JSON Schema, integrity digests | issuer, verifier |
| `@tamga-network/sd-jwt` | SD-JWT VC: selective disclosure, holder binding, status list | issuer, verifier |
| `@tamga-network/mdoc` | ISO 18013-5 mdoc: CBOR, COSE, issuance and verification | identity issuer, verifier |
| `@tamga-network/issuer` (+ `/client`) | credential creation, OpenID4VCI; `/client` for the hosted service | issuer |
| `@tamga-network/verifier` (+ `/web`, `/zk`) | verification pipeline, three-valued result, OpenID4VP; `/web` page kit, `/zk` zero-knowledge proofs | verifier, website |
| `@tamga-network/wallet-core` | wallet core: keys, receiving credentials, local checks, presentation (Node + React Native) | wallet developer |
| `@tamga-network/zk` (+ `/node`, `/react-native`) | wallet-side zero-knowledge prover (mdoc, Longfellow); `/react-native` native prover on the phone, `/node` on the desktop | wallet developer |

Every package has its own page in the **SDKs** section. The packages are published on npm as the **0.3.0** test release;
the stable 1.0.0 comes when everything is ready. In test releases the API may change. Each release is built from this repository by GitHub Actions and carries provenance.

## Addresses

| Address | What | Who uses it |
|---|---|---|
| `https://trust.tamga.network` | signed trust lists (`lotl.jws`, `tl-tr.jws`), anchor log, `keys/` | everyone — through `TrustSource` |
| `https://tamga.network/trust-anchor` | root fingerprints (you pin them in your configuration) | everyone |
| `https://schemas.tamga.network/v1/catalogue.json` | credential type catalogue | issuer, verifier, wallet |
| `https://issuer.tamga.network/{institution}` | hosted issuer service (OpenID4VCI + `/api/v1`) | issuer, wallet |
| `https://status.tamga.network/{opaque}` | status lists (Token Status List) | verifier |
| `https://verify.tamga.network` | Tamga Verify: hosted verifier + page kit (`/tamga-verifier.js`) | website, verifier |
| `https://id.tamga.network` | provisional identity credential service | wallet |

## What is ready today?

| Part | Status |
|---|---|
| Packages | 0.3.0 test release on npm; the stable 1.0.0 comes when everything is ready (the API may change in test releases) |
| Hosted verifier | running: the website's server opens the presentation with a signed statement, and the values are given only to it, only once ([[ADR-0017]]); policies are fixed for now |
| Hosted issuer | running: a scoped API key per institution ([[ADR-0016]]) |
| Trust anchor | signed trust lists ([[ADR-0009]]); the Tamga operator registers issuers and verifiers |
| Privacy | a pseudonym per site ([[ADR-0031]]); age verification with a zero-knowledge proof (ZK) — the verifier side is live; the wallet side is wired through `@tamga-network/zk`, the Android native library is ready, iOS is pending ([[ADR-0032]]) |
| Sandbox | live: a single test network with the same rules as the real network, open to everyone; real identity verification with daily/monthly caps ([[GUIDE-0013]]) |
| Ledger (Besu/QBFT) | designed, contracts written; opens once there are at least two independent validator operators ([[GUIDE-0006]]) |

## Rules for every integration

- **Do not log personal data.** Credential field values and the status index never go into logs or audit records
  ([[SPEC-API-0001]] AP3–AP4).
- **Ask only for the fields you need.** Your request cannot go beyond the scope of your trust list entry (AP6).
- **The result has three values:** `ACCEPTED`, `REJECTED`, `INDETERMINATE`. "Cannot be verified right now" does not mean the
  credential is bad (AP2).
- **Read trust data only through `TrustSource`;** do not interpret the list files yourself.
- All the binding rules for your role: [Tamga ARF — Annex B, Tamga Rulebook](https://arf.tamga.network/rulebook).
