---
document_id: GUIDE-0006
title: "Read trust lists"
status: Active
version: 1.0.0
created: 2026-09-27
last_updated: 2026-10-03
summary: >
  Using Tamga's trust anchor: reading the signed trust lists with TrustSource, pinning the root fingerprint, freshness and
  three-valued answers; where registration is covered; and, once the ledger stage (Besu/QBFT) opens, configuration for node and
  validator operators, the contracts and what the switch means for your application.
translation_of: GUIDE-0006
source_version: 1.0.0
---

# Trust lists and the network

This guide is for developers who read Tamga's [[t:trust-list|trust lists]] in their own application, and for operators who
will run a network node later.

**When to read:** when you are writing a [[t:verifier]], a wallet or an [[t:issuer]] service and need to answer "who is this
institution, and may it issue this credential?". The short version: [Trust lists and federation](/concepts/trust-lists).

## How it works

In Tamga, three questions are answered by the **[[t:trust-anchor]]**: who is this institution, may it issue this credential,
and what may this verifier ask for?

- **Today** the anchor is the **signed trust lists**, signed by the Tamga operator and downloadable by anyone.
- **Later**, once at least two independent validator operators take part, the same entries move to a permissioned Besu/QBFT
  ledger ([[ADR-0009]]).

Your application uses the same interface in both cases: **`TrustSource`**. Your code does not change on the day of the switch.

## 1. Reading the trust lists

```ts
import { fetchListTrustSource, verifyJws } from "@tamga-network/trust";

const { source } = await fetchListTrustSource(
  "https://trust.tamga.network",
  async (url) => {
    const r = await fetch(url);
    return { status: r.status, text: () => r.text() };
  },
  { rootFingerprints: PINNED_ROOTS, verifyJws }, // root fingerprints fixed in your configuration
);

source.issuers();                                // registered institutions
source.relyingPartyByDnsName("example.com"); // a verifier's entry (by its permanent domain name) and the fields it may ask for
source.relyingParty("x509_hash:…"); // the same entry, by the request's client_id
source.isCredentialAcceptable(issuerId, iat);    // "YES" | "NO" | "UNKNOWN" — as of the credential's issuance date
```

Working example: [[GUIDE-0004]] §4 (`examples/04-check-institution`). For React Native or the browser, use
`@tamga-network/trust/core` (no Node APIs; the signature verifier is passed in — [[ADR-0015]]).

A verifier entry's permanent identifier is its domain name (`dns_name`); the client identifier is the [[t:x509_hash]] value
computed from the certificate ([[ADR-0034]]). That is why there are two ways to read it: `relyingPartyByDnsName()` and
`relyingParty()`.

## 2. Root pinning and freshness

- **Pin the root.** Take the `rootFingerprints` value once from `tamga.network/trust-anchor` and write it into your
  configuration. Trusting the address you download the list from is not enough; the signature must chain to the root you
  pinned.
- **Freshness.** If the list is past its `next_update` date or cannot be downloaded, answers become `UNKNOWN` and verification
  returns `INDETERMINATE` — never `ACCEPTED`, never `REJECTED`.
- **Unknown format version.** Stop and raise an alarm; do not accept it.
- **Caching.** Prefetch the lists and the [[t:status-list|status lists]]; do not go to the network at verification time.

## 3. Published files

| File | What |
|---|---|
| `lotl.jws` | List of Trusted Lists: country lists, credential types, wallet providers, operator |
| `tl-tr.jws` | Türkiye list: root certificates, issuers (with their authorisations), verifiers (with their scopes) |
| `anchors.jsonl` | hourly signed anchor log (status list and schema digests are anchored here) |
| `keys/root-fingerprints.json` | root fingerprints (the same as on the `tamga.network/trust-anchor` page) |
| `CHANGELOG.md` | who changed what, and when |

Format: [[SPEC-TRUST-0001]]. The lists are versioned and each carries the digest of the previous one; no line is deleted; they
are re-signed at least every 90 days.

## 4. Registration

Issuers and verifiers are added to the list by the registrar (today Tamga, provisionally); changes are published within 24
hours. The application file, the certificate signing request and the mandatory registration data are covered in separate
guides:

- As an issuer: [[GUIDE-0007]]
- As a verifier: [[GUIDE-0008]]

`TrustSource` carries the status history of every entry; the entry of an ended authorisation is not deleted, so credentials
issued earlier still verify correctly.

## 5. In depth: the ledger stage

::: warning Not open yet
The ledger opens with the written acceptance of at least two independent validator operators ([[ADR-0009]] K4). This section
describes the configuration for that day and what it means for your application; today it is a development configuration.
:::

**Nothing changes for your application.** The ledger implementation of `TrustSource` gives the same answers to the same
questions; this is tested with the conformance vectors (`conformance/`). Institution identifiers (`issuer_id`, `ca_id`) and
credential types (`vct`) do not change. A new source address and the contract addresses are added to your configuration.

**Network.** Hyperledger Besu, QBFT consensus, a permissioned network (only permitted nodes connect). No personal data, no
credential and no credential digest is **ever written** to the ledger; it carries only the trust entries. Status lists stay
off the ledger ([[ADR-0008]]).

**Contracts** (`contracts/`, Solidity + Foundry):

| Contract | What it holds |
|---|---|
| `Governance` | membership and voting (states, 2/3) |
| `RootCARegistry` | national root certificates |
| `IssuerRegistry` | institutions, status history, credential type authorisations |
| `RelyingPartyRegistry` | verifiers and their scopes |
| `SchemaRegistry` | credential types and integrity digests |
| `StatusListRegistry` | anchors of status list publications (not the bits) |
| `CrossRecognition` | recognition between countries |
| `TrustQueries` | the single read surface (the ledger side of TrustSource) |

```sh
cd contracts && forge build && forge test   # requires Foundry
```

**For node and validator operators:**

| Role | What it does | Requirement |
|---|---|---|
| Validator | proposes and signs blocks | an independent institution, written acceptance, key in an HSM |
| Full node | validates and reads the chain; does not sign | an entry in the permission list |

The setup steps (genesis, QBFT settings, permission list, node definitions) are in [[ARCH-0002]]; the network topology and
the phase model in [[ARCH-0001]]. During the switch, the list archive is replayed into contract calls; the switch is not
complete until both implementations pass the same conformance vectors.

## Rules

| Code | What it says |
|---|---|
| Single trust interface | trust data is read only through `TrustSource`; list files are never interpreted by hand |
| Stale list | if the list is stale or cannot be downloaded, the answer is `UNKNOWN` and the result `INDETERMINATE` |
| [[ARCH-0003]] CMP2 | stop and raise an alarm on an unknown format version |
| [[SPEC-BC-0001]] DP1 | no contract stores personal data, credential content or a credential digest |

## Related

- Format: [[SPEC-TRUST-0001]] · Ledger data schema: [[SPEC-BC-0001]] · Institutional identity: [[SPEC-ID-0002]]
- Rules: [Tamga ARF — Architecture §3 and §8](https://arf.tamga.network/architecture)
