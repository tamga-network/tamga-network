---
document_id: GUIDE-0016
title: "Two modes: signed lists and a shared ledger"
status: Active
version: 1.0.0
created: 2026-11-05
last_updated: 2026-11-05
summary: >
  An overview of Tamga Network's two modes side by side: the chainless mode that runs today (signed trust lists as in the EU
  model: LOTL → national lists → institutions, offline verification) and the chain mode that opens later (Hyperledger Besu, QBFT).
  What the chain adds, how the two modes stay in sync (anchor log, list anchor, replay, equivalence test), which one is the
  source, what changes for an institution and for a state, which guide is for whom, and a glossary.
translation_of: GUIDE-0016
source_version: 1.0.0
---

# Two modes: signed lists and a shared ledger

Tamga Network is designed to run in two modes. The **chainless mode** is live today: trust rests on signed
[[t:trust-list|trust lists]], as in the EU digital identity wallet. The **chain mode** adds, next to these lists, a permissioned
[[t:ledger|shared ledger]] (Hyperledger Besu) run jointly by the states. Both modes use the same identifiers, the same rules and
the same questions; neither replaces the other, and they move forward in sync.

This page explains the two modes side by side and points you to the right setup guide.

**When to read:**
- If your institution, company or state is considering joining Tamga, before you decide which part to set up.
- For the short answer to "what changes for us when the chain comes?".
- Before (optional): [Trust lists](/concepts/trust-lists) and [Shared ledger (chain)](/concepts/ledger).

Places are reserved for the states named or coded in this document; this is not a notice of an agreement or of talks.

## In short

| | Chainless mode (today) | Chain mode (later) |
|---|---|---|
| What trust rests on | Signed lists: [[t:LOTL]] → national lists → institutions | The same signed lists + their projection on a shared ledger |
| Who signs | The list operator (today Tamga Network, provisionally) | The list operator; independent operators also witness the list digest |
| Verification | Offline: with the list and status lists downloaded in advance | The same; a chain check is an optional extra |
| Source | The list | Still the list; on conflict the list prevails |
| Status | Live on the real network | Code written and tested; off in production |

## Chainless mode: signed lists

This mode is the same as the EU trust list model (ETSI TS 119 612 and TS 119 602).

```text
Tamga LOTL  (everyone pins the root key once)
├── tl-tr.jws          Türkiye list (today run by Tamga Network on its behalf)
│   ├── national root certificate(s)
│   ├── issuers               + which credential types they may issue
│   └── relying parties       + which fields they may request
├── tl-<cc>.jws        other countries' lists (places reserved)
└── wallet providers, credential type catalogue, external lists
```

1. The **LOTL** (list of trusted lists) states the address of every country list, its signer and what it may vouch for.
2. A **national list** carries that country's root certificates, [[t:issuer|issuers]] and [[t:verifier|verifiers]].
3. An **institution** (university, hospital, ticket seller) signs credentials with the certificate in the list.

Wallets and verifiers download the lists and status lists **in advance**. When a credential arrives they do not ask the
institution or Tamga: they check the signature, the institution's record and the revocation status against their own copy. A list
is valid until its `next_update`; if that date has passed or the list cannot be downloaded, the result is `INDETERMINATE` (cannot
be verified right now), never a wrong "accept" or "reject".

Every list version carries the digest of the previous one; no row is deleted, only the status changes. The list operator also
publishes an hourly signed [[t:anchor-log]]: the digests of status list publications and of credential types are written to it in
order.

**Weak spot:** a single operator signs the list. The public log and audits deter the operator from showing two verifiers two
different lists (equivocation), but they do not make it impossible.

## Chain mode: a shared ledger

The shared ledger is a permissioned blockchain run jointly by the states and independent operators: Hyperledger Besu with QBFT
consensus. It adds two things ([[ADR-0051]], [[ADR-0053]], [[ADR-0055]]):

- **Independent witnessing.** A list version's digest becomes "confirmed" only when a threshold of independent operators submit
  the same digest. A single operator cannot produce a confirmed digest; two different digests show up on the chain, in front of
  everyone, as a conflict event.
- **Governance in code.** Membership, shared credential types and upgrades by a 2/3 vote of the states; a 7-day delay on upgrades.

**Only digests and closed-set values** go on the chain: the list version digest, record digests, fingerprints, dates, states.
Personal data, credentials, credential digests, revocation bits and free text never go on it; status lists stay off the chain
([[ADR-0008]], [[ADR-0074]]).

**When does it open?** When at least two independent operators have accepted in writing to run validators and the design has
passed an independent security audit ([[ADR-0009]] K4). A chain run by one operator produces no more trust than a list signed by
one operator.

## How do the two modes stay in sync?

The two modes say the same thing thanks to four mechanisms.

```text
registry ──trust:build──▶ signed lists (lotl, tl-<cc>) ──▶ public publication
                              │
                              ├──▶ anchor log (hourly signed line, digests)
                              │
                              └──trust:chain-submit──▶ list anchor registry (chain; digests only)
                                                       "confirmed" when a threshold of independent operators submit the same digest
```

### 1. One source: the list

Every change goes into the signed list first. The chain is a **projection** of the list, not its source: on conflict the list
prevails, and the chain's answer is never required for verification ([[ADR-0051]] CH1). This rule still holds after the chain
opens and the migration completes; making the chain the source one day would need a separate decision ([[ADR-0073]] K6).

### 2. The same identifiers

Identifiers are computed with the chain formula from the start, so they are the same in the list and on the chain
([[ADR-0009]], [[ADR-0073]] K4):

| Identifier | Formula |
|---|---|
| Institution (`issuer_id`) | `keccak256(country code, sha256(certificate))` |
| Credential type (`schema_id`) | `keccak256(vct)` |
| Relying party (`rpId`) | `keccak256(dns_name)` |

When the chain opens, no institution's identifier changes and no credential is reissued.

### 3. An anchor on every publication

The list publisher writes the digest of every new list version (version, content digest, previous digest, publication time) and
the digest of the last anchor log line to the list anchor registry on the chain (`trust:chain-submit`). The same digest for the
same version is not written twice; if a different digest arrives for a confirmed version, it is not written and the operator is
told about the conflict. Every trust record in the lists (institution, relying party, credential type, wallet provider, gate
group…) has a counterpart on the chain, as digests and closed-set values only ([[ADR-0074]]).

On the verifier side, `trust:chain-check` asks whether a list's digest is confirmed on the chain: **yes**, **no** (different
digest: a sign of equivocation, raise an alarm) or **unknown** (chain off, unreachable, or the threshold not reached). This check
never makes the verification result worse.

### 4. Replay and equivalence test at the transition

When the chain opens, the whole history of the lists is replayed into the contracts **once** (`trust:chain-replay`), with the
dates from the lists ([[ADR-0073]]):

- The states open a **migration window** by a 2/3 vote. The proposal carries the digest of the replay plan built from the public
  archive; anyone can rebuild the plan and compare.
- The window stays open for at most 30 days and can never be reopened once closed.
- At the end of the replay an **equivalence test** runs: the same questions are asked of the list and of the chain. The questions
  are: was this institution valid at that time, could it issue this credential type at that time, does this country recognise
  that institution, what is the digest of this list version? Every recorded moment and every boundary moment (one second before,
  exactly then, one second after) is asked.
- **If even one accept/reject answer differs, the migration does not close.**

The sandbox (test network) is never written to the chain and never replayed ([[ADR-0074]] K7).

## What changes for whom?

| Who | Chainless mode (today) | When the chain opens |
|---|---|---|
| **Issuing institution** | Registration in the list, institution certificate, issuing | **Nothing.** Same identifier, same certificate, same service; credentials already issued stay valid |
| **Relying party** | Reads trust data from the list through `TrustSource`, pins the root | **Nothing required.** You may add a chain check; the result never gets worse |
| **Wallet** | Downloads the list and status lists in advance | **Nothing** |
| **State** | Runs its own national list or takes over the list run on its behalf | **Keeps** running the list (the list stays the source). In addition runs a validator node, writes the chain counterpart of its national records with its own keys, votes in governance |
| **Network operator** | Signs the LOTL, publishes the anchor log and the lists | In addition writes list digests to the chain and writes network-level records through governance proposals |

In short: **for institutions, relying parties and wallets the two modes are the same.** What changes is the work of states and
operators: the national list is run today as well; when the chain opens, a node is added next to it.

## Which guide for whom?

| What are you doing? | Chainless mode (today) | Chain mode |
|---|---|---|
| Adding "Sign in with Tamga" to your site | [[GUIDE-0001]] | the same |
| Verifying credentials on your own server | [[GUIDE-0002]] | the same; chain check optional ([[GUIDE-0006]] §5) |
| Registering your institution (including the IT steps) | [[GUIDE-0007]], [[GUIDE-0014]] | the same |
| Issuing with the hosted service | [[GUIDE-0003]] | the same |
| Running your own issuance server | [[GUIDE-0003]] § In depth: your own service, working code [[GUIDE-0004]], protocol [[SPEC-PROTO-0001]]; registration and key management are agreed with the network operator | the same |
| Registering as a relying party | [[GUIDE-0008]], [[GUIDE-0014]] | the same |
| Reading trust lists, keeping your own copy | [[GUIDE-0006]] | [[GUIDE-0006]] §5 |
| Connecting your country's list to the network (LOTL entry) | [[GUIDE-0011]] | the same; the list stays the source |
| Operating the national trust list (setup) | [[GUIDE-0017]] | [[GUIDE-0017]] § When the chain is on |
| Running a node or validator | — | [[GUIDE-0015]] (handbook; node key, declaration and checks: `tamga-onboard node`); test network setup: [[GUIDE-0018]] |
| Trying it end to end | [[GUIDE-0013]] (sandbox) | the sandbox is not written to the chain; local development chain: [[GUIDE-0015]] § Local trial |

## Glossary

| Term | Meaning |
|---|---|
| [[t:LOTL]] (List of Trusted Lists) | The list of lists: carries the address, signer and scope of every country list. In Tamga, `lotl.jws` |
| [[t:trust-list]] | A signed list carrying a country's root certificates, issuers and relying parties. In Tamga, `tl-<cc>.jws` |
| [[t:issuer]] | The institution that issues a digital credential to a person: university, hospital, ticket seller |
| [[t:verifier]] | The party that asks a person for a credential and checks it: employer, website, event gate |
| [[t:wallet-unit]] | A single wallet installation on a person's device; the wallet provider gives it attestations |
| [[t:anchor-log]] | An append-only public log, signed hourly by the list operator, that carries digests only |
| Anchor | Writing the digest of some data into a record that cannot be changed; it later shows that the data has not changed |
| [[t:ledger]] | A record kept jointly by several independent operators; in Tamga a permissioned Besu chain |
| Node | A server running a copy of the shared ledger. A full node verifies and reads the chain, it does not sign |
| [[t:validator]] | A node that proposes and signs blocks; in Tamga each member state has one validator |
| enode | A Besu node's network address: the node's public key + IP address + port (`enode://<public key>@<ip>:30303`) |
| QBFT | Besu's consensus method: validators vote on every block; with n validators it tolerates at most ⌊(n−1)/3⌋ faults |
| Genesis | The first block and starting settings of the chain (chain ID, first validators); it must be the same on every node |
| Bootnode | The node a new node first connects to, to learn the addresses of its peers |
| Permissioned network | A network where only nodes on the allowlist can connect and only allowed accounts can send transactions |
| Governance | How network decisions (membership, shared credential types, upgrades, the migration window) are taken; on the chain by a 2/3 vote of the states |
| Projection | Deriving the chain records from the signed lists; the list stays the source |
| Equivalence test | Asking the same questions of the list and of the chain and comparing the answers; if they differ, the transition does not complete |

## Rules

| Code | What it says |
|---|---|
| [[ADR-0009]] K4 | The shared ledger is not set up without the written acceptance of at least two independent operators |
| [[ADR-0051]] CH1 | The chain is a projection of the list; on conflict the list prevails; the chain's answer is not needed for verification |
| [[ADR-0051]] CH2 | Only digests are written to the list anchor; no content, credential or personal data |
| [[ADR-0051]] CH3 | An anchor is confirmed only when a threshold of independent writers submit the same data; in production the threshold is at least 2 |
| [[ADR-0073]] CE6 | The migration does not close while the equivalence test shows any accept/reject difference |
| [[ADR-0074]] PJ4 | Sandbox lists are never written to the production chain |

Rules for the list operator and the shared ledger: [Tamga ARF — Tamga Rulebook, RB-OP](https://arf.tamga.network/rulebook).
