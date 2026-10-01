---
title: Architecture and Reference Framework
translation_of: FW-ARF-0001
source_version: 0.2.1
outline: [2, 3]
---

# Tamga ARF — Architecture and Reference Framework

<div class="arf-meta">

**Document** FW-ARF-0001 · **Version** 0.2.0 · **Status** Active · **Updated** 2026-09-27 · **Licence** CC BY 4.0
Official English translation of the Turkish source text; in case of conflict the Turkish text prevails.

</div>

::: info What changed in 0.2.0
Tamga ARF is now published on its own site, in English and Turkish, with three annexes: **A** Trust Framework,
**B** Participant Rules, **C** Attestation Rulebooks ([[ADR-0018]]). §4 lists the current components and service addresses
(`@tamga-network/mdoc`, `trust/core`, the identity service, the hosted issuing API and the hosted verifier).
:::

## 0. What this document is and how to read it

**Tamga ARF** is the **single architectural reference** for an institution, regulator or integrator joining the Tamga
Network ecosystem. It does for Tamga what the European Commission's ARF does for the EUDI ecosystem: roles, the trust model,
interfaces and lifecycles are defined here; technical detail is left to the relevant specification.

| Layer | In the EU | In Tamga |
|---|---|---|
| Law / governance | eIDAS 2.0 + implementing regulations (CIRs) | [[FW-TF-0001]] Tamga Trust Framework — Annex A |
| Architecture + roles | ARF v3.0.0 | **this document** |
| Participant rules | ARF Annex 2 (High-Level Requirements) | [[FW-RB-0001]] Participant Rules — Annex B |
| Document-type rules | Attestation rulebooks | [[FW-RB-0002]] (education) and more — Annex C |
| Technical standards | ETSI / IETF / OpenID | Tamga SPEC-* profiles |

Developer documentation (integration guides, code examples, specifications) is at
[docs.tamga.network](https://docs.tamga.network).

Reading order: §1 (principles) → §2 (roles) → §3 (trust model) → §4 (architecture) → §6 (flows).
When you see a rule, the `DOC-ID/CODE` reference next to it is the binding source.

## 1. Scope and principles

### 1.1 What

Tamga Network is a **digital trust infrastructure for the Turkic world**: documents that institutions (universities,
chambers, public bodies) give to people (diplomas, student certificates, memberships) are issued as **electronic attestations
of attributes (EAA)**, carried in the person's wallet, and verified by third parties in seconds without asking the source
([[PM-PH-0001]]).

Tamga is not a blockchain. A ledger is **one possible carrier** of the trust register, and it is set up only when there
is more than one independent signer ([[ADR-0009]]).

### 1.2 Seven principles

| # | Principle | Source |
|---|---|---|
| P1 | **Sovereignty first:** each state is the sole author of its own national registers; network membership by a 2/3 vote; cross-border recognition is unilateral | [[ADR-0002]], [[SPEC-BC-0001]]/N1 |
| P2 | **No personal data in any shared register:** not on a ledger, not in a list, not in the anchor log, not in logs — not even a credential hash | [[PM-TRUST-0001]], [[SPEC-BC-0001]]/DP1 |
| P3 | **Compatible but independent:** the eIDAS/ARF/ETSI technical layer as is; the legal and governance layer written for the Turkic world | [[PM-PH-0001]] |
| P4 | **OTS-first:** no identifier, role name or structure assumes "Tamga is the only operator"; Tamga is a provisional stand-in everywhere (OTS = Organization of Turkic States) | [[ADR-0009]] K5, D-GOV-5 |
| P5 | **A ledger is a choice of signers, not of storage:** the trust anchor today is signed lists; a ledger only with ≥ 2 independent validator operators | [[ADR-0009]] K1–K4 |
| P6 | **Holder binding without exception:** every document is bound to a key in the device's secure element; it cannot be copied or transferred | [[SPEC-CRED-0002]]/C8, C16; [[SPEC-WALLET-0001]]/WL1 |
| P7 | **Designed to be handed over:** every soft power has a measurable hand-over threshold (tripwire) | [[PM-GOV-0001]]/G6 |

### 1.3 Out of scope (this version)

ISO 18013-5 proximity **transport** (BLE/NFC — phase 1; the mdoc **format** is used for identity, [[ADR-0013]]), PID
issuance (Tamga does not issue PID; the state slot is reserved), a value/payment layer ([[ADR-0003]] hooks kept),
guardian escrow ([[SPEC-BC-0002]]), agent delegation ([[SPEC-AGENT-0001]]), the W3C VCDM/JSON-LD carrier (D-SCHEMA-3).

## 2. Ecosystem roles

The role set is taken from the EUDI ARF. For each role the table gives its Tamga counterpart, who holds it in phase B and
what happens at hand-over. Every national list has a **slot** for each of these roles ([[ADR-0009]] K5.2).

| Role (ARF) | Definition | Phase B (today) | Phase 1 (a state has joined) | Source |
|---|---|---|---|---|
| **Trusted List Scheme Operator (TLSO)** | Compiles, signs and publishes the national trusted list | Tamga (`operator.status: provisional`, `on_behalf_of: TR national authority`) | National authority | [[ADR-0009]] K2, K5 |
| **Registrar** | **Registers** providers and relying parties (does not license them; legal authority sits outside the ecosystem) | Tamga (as stand-in) | State registrar | [[ADR-0002]] |
| **National Root CA** | Root of institutional X.509 certificates | "TR National Root CA (provisional operator: Tamga)" — `ca_id` does not change at hand-over | State root or qualified trust service provider | [[SPEC-ID-0002]]/XC1; [[ADR-0009]] K5.4 |
| **PID Provider** | Provider of person identification data (LoA High) | **Empty slot** (`pid_providers: []`, BT8) | State | [[PM-ID-0001]] |
| **Attestation Provider (Issuer)** | Institution issuing EAAs; class PUB / QUALIFIED / EAA | University (I2; "DEMO" label in the demo) | Institutions + public bodies (PUB) | [[ADR-0010]] K5; [[PM-ASSUR-0001]] axis B |
| **Authentic Source** | Where an attribute comes from (student information system, company register, civil registry) | The university's student information system (demo: portal database) | Same + public sources | — |
| **Wallet Provider** | Provides the wallet solution, signs the Wallet Unit Attestation (WUA) | Tamga (`wallet_providers[]`) | Tamga + certified third parties | [[SPEC-CRED-0001]] §4 |
| **Relying Party (Verifier)** | Requests and verifies documents; registered, with a scope | Employer, career centre (`verify.tamga.network` as reference) | Same | [[SPEC-BC-0001]] RP register; [[SPEC-PROTO-0002]] |
| **Intermediary verifier** | Requests and verifies presentations on behalf of an RP; the wallet shows the actual RP and checks the scope against the actual RP's registration | `verify.tamga.network` (hosted); results only with the RP's assertion, read once | Same | [[ADR-0017]] HV1–HV6 |
| **Access CA / Registration Certificate Provider** | RP access certificates and scope registration | Tamga (as stand-in) | State | — |
| **Registration authority (T2 producer)** | Verifies a person's identity in person or through a licensed remote service (specific to the bootstrap phase) | University registration desk / remote identity verification provider | Taken over by the PID Provider | [[PM-ASSUR-0001]]; [[SPEC-ID-0003]] |
| **Holder / User** | The person carrying documents in their wallet | Student, graduate | Citizen | [[SPEC-WALLET-0001]] |
| **Validator Operator** | Independent institution running a ledger node | **None** (phase B) | ≥ 2 independent operators → phase 0 | [[ADR-0009]] K4 |

**Separation rule:** Tamga holds no signing key in any service it hosts ([[PM-GOV-0001]]/G1). Even when the issuing service
runs at Tamga, the credential key belongs to the institution (the demo deviation S-1 is declared openly).

## 3. Trust model

### 3.1 The trust anchor: where it is and who signs it

```
                  Phase B (today)                          Phase 0+ (≥ 2 independent validators)
   ┌──────────────────────────────────┐          ┌─────────────────────────────────────┐
   │ trust.tamga.network              │          │ Besu / QBFT ledger                  │
   │  lotl.jws      ← LOTL + NETWORK  │  replay  │  Governance · SchemaRegistry        │
   │  tl-tr.jws     ← national list   │ ───────▶ │  RootCARegistry · IssuerRegistry    │
   │  anchors.jsonl ← hourly anchor   │          │  RelyingPartyRegistry · StatusList  │
   │  keys/         ← root prints     │          │  CrossRecognition                   │
   └──────────────────────────────────┘          └─────────────────────────────────────┘
              signers: 1 (Tamga, provisional)             signers: N (states / institutions)
```

- Lists are **versioned and hash-chained**: `version` is monotonic, `previous_version_hash` is carried, nothing is deleted;
  `next_update` ≤ 90 days; changes are published within 24 hours; ≥ 2 overlapping signing certificates
  ([[ADR-0009]] K2; ETSI TS 119 612 model).
- The **anchor log** (`anchors.jsonl`) is signed hourly; status-list publications and schema `content_hash` values are
  anchored in it. It is the phase-B counterpart of the ledger's `publishList` call.
- **Root fingerprints** are in `keys/root-fingerprints.json` and on the `tamga.network/trust-anchor` page; the same values
  appear in the Trust Framework and the contract annexes (the counterpart of an official gazette).
- **One read interface:** no component interprets the list files directly; everything reads through the `TrustSource`
  interface (list or ledger implementation) — including the wallet, via `@tamga-network/trust/core` (BT4,
  [[ARCH-0003]]/CMP1, [[ADR-0015]]). Moving to a ledger only swaps the implementation; documents, wallet and verification
  pipeline stay the same.

**Honest limit:** in phase B the anchor rests on a single operator signature. If the operator and an issuer act together,
"saying different things to different people" is possible; the public log, transparency reports and audits deter it but do
not make it impossible ([[ADR-0009]] K3, "known weakening"; pilot notice item 6).

### 3.2 Identifiers (independent of domain names, unchanged at hand-over)

| Identifier | Formula | Note | Source |
|---|---|---|---|
| `ca_id` | `keccak256(state_code ‖ root_fingerprint)` | From the root certificate fingerprint | [[SPEC-BC-0001]]/CA1 |
| `issuer_id` | `keccak256(state_code ‖ SHA-256(leafCert))` | A new certificate gives a new `issuer_id` + `successor_id` | [[SPEC-ID-0002]]/XC2, [[SPEC-CRED-0002]]/C15 |
| `vct` (type identifier) | `urn:tamga:<domain>:<Type>:<major>` — in phase 1 `urn:tamga:<cc>:…` | Type Metadata is resolved **from the catalogue**; `vct#integrity` is mandatory | [[ADR-0010]] K1–K4 |
| `schema_id` | `keccak256(vct)` | | [[ADR-0010]] |
| `category` (claim) | `urn:tamga:eaa:pub` \| `urn:tamga:eaa:qualified` | Only PUB / QUALIFIED issuers; I1–I2 omit it; the verifier cross-checks it against the register (C4) | [[ADR-0010]] K5 |
| Status list URI | `https://status.tamga.network/{opaque}` | Does not encode the institution, year or cohort | [[SPEC-CRED-0003]]/S8 |
| RP `client_id` | `x509_san_dns:<domain>` | | [[SPEC-PROTO-0002]] |
| Person | **No global identifier** — a `cnf` key per document, a different copy per verifier | | [[SPEC-ID-0002]]/XC4, [[SPEC-WALLET-0001]]/WL5 |

A domain name is the **address of a service**, not an identity (D-NAME-1). If an institution moves to its own domain, the
`issuer_url` in its list entry changes; the `issuer_id` and its documents do not.

### 3.3 Assurance levels — two axes

| Axis | Levels | Where it is carried | Source |
|---|---|---|---|
| **A — Holder / identity proofing** | T0 anonymous · T1 low (bank / mobile operator) · T2 substantial (document + liveness **or** registration desk) · T3 high (qualified e-signature / mobile signature) — 1:1 with eIDAS Low/Substantial/High | **Nowhere** in the credential; the level is a **precondition of the document type** (a diploma is bound at T2+); the binding path is in the issuer's audit record | [[PM-ASSUR-0001]] axis A; [[SPEC-PROTO-0001]]/PR7 |
| **B — Issuer accreditation** | I1 registered · I2 contracted · I3 accredited (HSM, audit, insurance) | In the trusted list (`assurance`, `class`); for QUALIFIED/PUB also `category` in the credential | [[PM-ASSUR-0001]] axis B; [[ADR-0010]] K5 |
| **W — Wallet security level** | W1 software (not supported) · W2 device secure element (minimum) · W3 certified WSCD | Declared in the WUA; the issuer checks it before issuing | [[SPEC-WALLET-0001]]/WL3; ETSI TS 119 471 REQ-EAASP-4.2.1.2 |

A verifier's decision is a **"type × issuer class"** policy; the verifier does not see a separate `holder_assurance` field
(the eIDAS model). A high-risk verifier additionally asks for an identity document or PID.

### 3.4 Wallet Unit Attestation (WUA)

Each wallet instance carries a WUA signed by the Wallet Provider: wallet version, key held in hardware, PIN/biometrics
active. Before issuing, the issuer checks the WUA against `lotl › wallet_providers[]` and checks the WSCD level
([[SPEC-CRED-0001]] §4). No document is issued to a software-key wallet (W1) in the pilot; the demo deviation S-9 is
declared openly.

## 4. High-level architecture

### 4.1 Components

```
┌─────────────────────────────── TAMGA-NETWORK (open source) ─────────────────────────────┐
│ trust-publisher (CLI)  →  trust.tamga.network   lotl.jws · tl-tr.jws · anchors.jsonl     │
│ @tamga-network/schemas  →  schemas.tamga.network  v1/catalogue.json · Type Metadata      │
│ @tamga-network/trust (+ /core)  →  TrustSource(list | ledger) — one interface, wallet too │
│ @tamga-network/core · sd-jwt · mdoc · issuer (+ /client) · verifier (+ /web) · wallet-core │
│ apps/wallet (Expo) · apps/verify (verify.tamga.network) · apps/wallet-provider (WUA)     │
│ examples/ (tested code examples) · conformance/ · contracts/ + network/ (phase 0)        │
└──────────────────────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────── TAMGA-PLATFORM (operator) ───────────────────────────────┐
│ apps/issuer  issuer.tamga.network/{slug}  OpenID4VCI · status publisher · /api/v1 (key)  │
│ console.tamga.network  Institution Console (invitation + passkey; ADR-0019) · PostgreSQL │
│ apps/id      id.tamga.network  provisional identity attestation service (ADR-0011)        │
│ status.tamga.network/{opaque}  Status List Tokens · tenants/{slug}.json · ops/            │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

Library vs. service: the **issuer library is open** (`@tamga-network/issuer`), the **hosted issuing service is run by the
operator**. An institution may write its own issuing service, or connect its own systems to the hosted service with a
tenant-bound API key ([[ADR-0016]]); the rule set is the same ([[FW-RB-0001]] RB-AP). Package catalogue: [[ARCH-0005]] §1.

### 4.2 Service addresses (one server, one root domain)

| Address | Service | Tenant |
|---|---|---|
| `tamga.network` | public site, general documentation (`/docs`), root fingerprints (`/trust-anchor`) | — |
| `docs.tamga.network` | developer documentation: guides, code examples, specifications, ADRs | — |
| `arf.tamga.network` | **Tamga ARF** — this document and its annexes (English + Turkish) | — |
| `trust.tamga.network` | trusted lists, anchor log, `keys/`, `CHANGELOG.md` | — |
| `schemas.tamga.network` | catalogue `v1/catalogue.json`, Type Metadata, JSON Schema (immutable files) | — |
| `issuer.tamga.network/{slug}` | OpenID4VCI (metadata at `/.well-known/openid-credential-issuer/{slug}`) | institution |
| `status.tamga.network/{opaque}` | Status List Tokens | — (opaque) |
| `console.tamga.network` | Institution Console: issued credentials, sample register, API keys, users ([[ADR-0019]]) | institution (from session) |
| `verify.tamga.network` | reference and hosted verifier (intermediary; [[ADR-0017]]) | — |
| `wallet.tamga.network` | Wallet Provider metadata, WUA keys, Trust Mark | — |
| `id.tamga.network` | provisional identity attestation service ([[ADR-0011]]) | — |

Source: D-NAME-1 v1.1, [[ADR-0018]].

### 4.3 Direction rules

1. **Only** the `trust-publisher` writes to the trusted list; issuers send anchoring **requests**.
2. A verifier does not query the ledger or list directly; it reads from its `TrustSource` cache; a stale source →
   `INDETERMINATE` ([[ARCH-0003]]/CMP1, CMP4).
3. A verifier does not fetch status per verification; it pre-fetches in bulk ([[SPEC-CRED-0003]]/S12). The wallet fetches
   schemas in bulk and makes no request to the schema server at presentation time ([[SPEC-WALLET-0001]]/WL9).
4. No Tamga infrastructure logs IP addresses; logs carry no claim values and no `idx`
   ([[PM-GOV-0001]]/G2, [[SPEC-API-0001]]/AP3–AP4).

## 5. Data model

### 5.1 The document (EAA) — Tamga profile of SD-JWT VC

| Property | Value | Source |
|---|---|---|
| Format | IETF SD-JWT VC; `typ = dc+sd-jwt` | [[SPEC-CRED-0002]]/C13 |
| Signature | ES256 (P-256); `x5c` mandatory (root excluded) | C1, C7 |
| Holder binding | `cnf` mandatory; KB-JWT mandatory at presentation; KB-JWT `iat` ± 300 s | C8, C16, C17 |
| Selective disclosure | `_sd` + disclosures, `sha-256`, salt ≥ 128 bits, no decoys, at most 2 levels | C2–C6, C11 |
| Type | `vct` URN + `vct#integrity` | [[ADR-0010]] |
| Category | `category` only for PUB/QUALIFIED | [[ADR-0010]] K5 |
| Status | `status.status_list {uri, idx}` (Token Status List, bits = 2) | [[SPEC-CRED-0003]] |
| Copies | batch of 10; each copy on a different device key; one sticky copy per verifier | [[SPEC-PROTO-0001]]/PR6, [[SPEC-WALLET-0001]]/WL5 |
| Forbidden content | No national identity number in any NETWORK schema | [[SPEC-SCHEMA-0002]]/E1, [[SPEC-SCHEMA-0003]]/SK6 |
| Second representation (identity only) | ISO 18013-5 mdoc: MSO + digests, COSE_Sign1 issuerAuth (x5chain), `deviceKey` = `cnf`, MSO `status` | [[ADR-0013]] MD1–MD5; [[SPEC-PROTO-0002]] §4.5, PV11 |

### 5.2 Type definition — Type Metadata + JSON Schema

For each type: Type Metadata (`vct`, `name`, `display` for at least `tr-TR` + `en-US`, `claims` with the selective
disclosure policy, `extends`) + JSON Schema (`additionalProperties: false`). A published file never changes;
`content_hash = vct#integrity = SHA-256(published bytes)`; the catalogue maps `vct → metadata_url + content_hash`
([[SPEC-SCHEMA-0001]]/D1–D7). Type versioning: major in the URN; minor/patch get a new `metadata_url` + hash.

### 5.3 Trusted-list entries

`lotl`: `national_lists[]` (OTS slots, roles, `signing_keys`, `recognition`), `schemas[]` (NETWORK types),
`wallet_providers[]`, `catalogue`, `operator`.
`tl-<cc>`: `root_cas[]`, `issuers[]` (`issuer_id`, `slug`, `class`, `assurance`, `category`, time-windowed
`schema_authorizations[]`, `status_history[]`, `successor_id`), `relying_parties[]` (`client_id`, `scope[]`, `status`).
Every field maps to a ledger contract record (migration plan).

### 5.4 Status list

IETF Token Status List; list capacity ≥ 100,000, fill ≤ 80 %; random `idx`; opaque URI; lists are split by nothing but
type; published at a fixed interval even without changes; no "urgent" publication; the status key is separate from the
credential key ([[SPEC-CRED-0003]]/S2–S11). Pilot interval 60 min (demo 2 min, deviation S-2); target for a revocation to
take effect at the verifier ≤ 90 min.

## 6. Flows

### 6.1 Institution onboarding

1. The institution applies → the Registrar verifies the legal entity and the authorised signatory (I2: company register +
   signatory; I3: + HSM, audit, insurance) → Trust Framework agreement ([[FW-TF-0001]] §5).
2. Certificate request (P-256) → National Root CA (provisional) issues the leaf certificate → `issuer_id` is derived; the
   status key gets a separate certificate (K1).
3. The TLSO adds the `tl-tr` entry: class, assurance, `schema_authorizations` (allowlist, closed by default —
   [[SPEC-BC-0001]]/I1), `issuer_url`, `slug`; the list is re-signed; a `CHANGELOG` line; ≤ 24 hours.
4. Tenant configuration — no code per institution (D-NAME-1 §3). If the institution uses the hosted service from its own
   systems, it receives a scoped API key ([[ADR-0016]]).

### 6.2 Issuance (OpenID4VCI, pre-authorised + tx_code)

```
Person ──(portal / student-system session or e-mail)──▶ Issuer: creates an offer (single use, 5 min / 72 h)
Wallet ◀── QR / link (credential_offer_uri) ── on screen or by e-mail
Wallet ──▶ /{slug}/token  (pre-authorized_code + tx_code — via a different channel; 3 attempts)
Wallet ──▶ /{slug}/nonce → c_nonce
Wallet ──▶ /{slug}/credential  (proofs.jwt × 10, each a different device key; WUA)
Issuer: check WUA → validate schema → sign SD-JWT VC × 10 → allocate status idx → record (PR7)
Person ◀── notice "your document was added to a wallet; if this was not you …"
```

Source: [[SPEC-PROTO-0001]] PR1–PR10; identity proofing paths [[SPEC-ID-0003]].

**Identity proofing rule:** the issuer ensures the level the type requires **before** issuing (student certificate T1;
diploma T2+). T3 only through the authorisation-code flow or in person; LoA High is never given through online
pre-authorised issuance (ETSI TS 119 472-3 GEN-REQ-4.1).

### 6.3 Presentation (OpenID4VP, DCQL, cross-device)

```
Verifier ──▶ signed request object (client_id = x509_san_dns:…, DCQL, nonce, response_mode = direct_post.jwt)
Wallet: resolve the RP registration via TrustSource (scope) → show the requested fields → warn on over-asking
        → PIN / Face ID → choose the sticky copy → KB-JWT (nonce, aud, sd_hash) → encrypted response
Verifier: T0 + A–E pipeline → ACCEPTED | REJECTED | INDETERMINATE + checks_performed / skipped
```

Source: [[SPEC-PROTO-0002]] PV1–PV10; [[SPEC-WALLET-0001]] §5.

**Hosted verifier (intermediary):** an RP that does not want to run its own verifier uses `verify.tamga.network`. The RP's
server opens the presentation with a short-lived assertion signed by its trusted-list key; approved values are given only
to that RP and only once; the browser sees only the status; the wallet shows the actual RP's name ([[ADR-0017]] HV1–HV6).

### 6.4 The canonical verification pipeline (T0 + A–E)

| Step | What | Result |
|---|---|---|
| **T0** | Freshness of the trust source (`freshness.healthy`) | stale → INDETERMINATE |
| **A** | Structure: `~` parsing, KB-JWT present, `x5c` chain → root anchor (`ca_id`), `issuer_id` from the leaf fingerprint, disclosure digests, KB-JWT `nonce/aud/sd_hash/iat` | |
| **B** | Type: `vct` + `vct#integrity` match the catalogue/cache; JSON Schema | |
| **C** | Trust: `C1 isCredentialAcceptable(issuer_id, iat)`, `C2` schema authorisation (cannot be skipped, AP8), `C3` recognition, `C4` `category` ↔ register class | |
| **D** | Status: pre-fetched status list, the `idx` bit, list anchor (`contentHash`, `version`) | |
| **E** | Policy: type × issuer class, RP scope ⊇ requested fields (AP6), audit record (E4, for rejections too) | |

Three-valued result ([[ARCH-0003]]/CMP9): **INDETERMINATE** is never put in the same bucket as REJECTED (AP2); people are
shown "invalid" and "could not be verified" differently ([[SPEC-CRED-0003]]/S14). Time rule: `C1/C2` look at the
document's `iat` — documents of an institution that has since closed stay valid (D-BC-3, [[SPEC-API-0001]]/AP11).

### 6.5 Revocation and suspension

| Event | Mechanism | Effect |
|---|---|---|
| Document revocation | The issuer sets the `idx` bit to REVOKED → next fixed-interval publication → anchor | REJECTED at verifiers within ≤ 90 min |
| Institution suspended (SUSPENDED) | List entry `status_history` | New issuance stops; older documents stay valid by `iat` |
| Institution revoked (REVOKED) | List entry + `successor_id` | A successor may publish the status list ([[SPEC-BC-0001]]/I4) |
| Certificate rotation | New `issuer_id` + `successor_id` | Older documents verify against the older entry |
| Wallet unit compromise | WUA revocation (Wallet Provider) | Issuers refuse new issuance; verifiers per policy |

### 6.6 Device change and recovery

Keys never leave the device; a backup carries only the document list and encrypted documents; on a new device documents are
**issued again** ([[SPEC-WALLET-0001]]/WL1–WL2, WL10). Tamga holds no recovery key. The person can create a password-protected move file in the EU TS10 format: the list of credentials and the transaction log, no keys and no credential values ([[ADR-0027]]).

## 7. Lifecycles

| Entity | States | Rule |
|---|---|---|
| Issuer entry | `ACTIVE → SUSPENDED → ACTIVE` · `→ REVOKED (+successor)` · `→ RETIRED` | History is never deleted; ETSI `granted/withdrawn` projection ([[SPEC-ID-0002]] §8.1) |
| Root CA | `ACTIVE → RETIRED` (operation and older documents continue) · `→ REVOKED` (documents fall) | [[SPEC-BC-0001]]/CA2 |
| Schema (type) | `ACTIVE → DEPRECATED` (stays verifiable) | SC3; `vct`/hash never updated (SC1) |
| Schema authorisation | time window `[from, to)` | C2 by `iat` (I3) |
| Document | issued → (suspended) → revoked · expiry (`exp`, student certificate ≤ 90 days) | E4, E9 |
| Wallet solution / unit | Solution: certified → suspended → revoked; Unit: active → revoked | Separate state machines (ARF §4.6; open item) |
| RP entry | `ACTIVE → SUSPENDED → REVOKED`; scope can be updated | AP6 |
| List version | monotonic; past `next_update` every answer is UNKNOWN | BT2, BT5 |

## 8. Phases and transition

| Phase | Trust anchor | Validators | Governed by | Entry condition |
|---|---|---|---|---|
| **B — ledger-free beta** (today) | Signed lists + anchor log | — | Tamga (provisional TLSO/Registrar) | ADR-0009 accepted (2026-09-24) |
| **0 — bootstrap** | Besu / QBFT | ≥ 2 independent operators | Foundation technical board | Written validator acceptance; replay + equivalence test passed |
| **1 — states join** | Ledger | States (equal votes) | Council (2/3) | First state validator in production |
| **2 — institutional growth** | Ledger | + institutions | Council | D-GOV-2 thresholds |

**Transition contract (phase B → 0):** the list archive is replayed into ledger calls; `TrustSource(list)` and
`TrustSource(chain)` give the same answer to the same conformance vectors (`conformance/`); `ca_id` / `issuer_id` / `vct`
do not change; hand-over changes only the `operator` field ([[ADR-0009]] K5, K7).

## 9. Standards alignment map

| Component | Standard | Tamga profile | State |
|---|---|---|---|
| Trusted list | ETSI TS 119 612 (+ 119 602 LoTE) | Phase-B lists; ETSI XML projection | ✅ / projection planned |
| Institutional identity | X.509 RFC 5280; ETSI EN 319 401 | [[SPEC-ID-0002]] | ✅ |
| EAA provider policy | ETSI TS 119 471 | [[FW-RB-0001]] RB-AP; WUA/WSCD pre-check ([[SPEC-PROTO-0001]] §11.1) | ✅ |
| Document format | IETF SD-JWT VC; ETSI TS 119 472-1 | [[SPEC-CRED-0002]]; `category` | ✅ |
| Issuance | OpenID4VCI 1.0 (HAIP); ETSI TS 119 472-3 | [[SPEC-PROTO-0001]] | ✅ |
| Presentation | OpenID4VP 1.0, DCQL | [[SPEC-PROTO-0002]] | ✅ |
| Revocation | IETF Token Status List; CIR 2024/2977 Art. 3 | [[SPEC-CRED-0003]] | ✅ |
| Identity proofing | ETSI TS 119 461; CIR 2025/1566 | [[SPEC-ID-0003]] (T1–T3 mapping) | ✅ |
| Wallet | ARF WSCD, CIR 2024/2979 | [[SPEC-WALLET-0001]] | ✅ |
| Type catalogue / rulebooks | ARF §5.5, Annex 2 Topic 12, PID Rulebook pattern | [[SPEC-SCHEMA-0001]]/0002 + [[FW-RB-0002]] | ✅ |
| mdoc format | ISO/IEC 18013-5 (MSO, COSE), 18013-7 (OpenID4VP) | [[ADR-0013]]: dual format for identity; `@tamga-network/mdoc` | ✅ (identity) |
| Proximity transport | ISO/IEC 18013-5 BLE/NFC | Phase-B bridges: [[ADR-0012]] (pass card B, reverse-initiated OpenID4VP C) → phase 1 BLE | 🟡 |
| Education semantics | ELM v3 / Europass, ISCED-F, EQF | [[RS-SCHEMA-0001]], [[SPEC-SCHEMA-0002]] | ✅ |

## 10. Security and privacy principles (summary)

1. No personal data in shared registers (P2); no claim values and no `idx` in logs.
2. Issuer unlinkability: batches of 10, one sticky copy per verifier (per-RP unlinkability); **issuer linkability remains a
   residual risk** (it awaits zero-knowledge proofs; stated openly).
3. Status publication is noisy and fixed-interval; the time of a revocation does not leak.
4. Every presentation needs PIN/biometrics; over-asking is flagged; the presentation log stays on the device (only the person's password-protected export, EU TS10).
5. No IP logging; schema/status statistics only in aggregate, buckets ≥ 50.
6. Key separation: credential (offline / HSM) ≠ status (online) ≠ list signature.
7. Supply chain: no `postinstall` in packages; releases only from CI with OIDC and provenance ([[ARCH-0005]]/P1–P3).

## 11. Known limits and residual risks

| # | Limit | Where it is declared |
|---|---|---|
| L1 | The phase-B anchor rests on a single operator signature | Pilot limits notice, items 5–6 |
| L2 | A revocation takes effect after up to ~90 min | Notice item 7 |
| L3 | Issuer linkability (if the same issuer and different verifiers collude) | Whitepaper, "residual risk" |
| L4 | Demo: keys in software (S-9), issuer key at Tamga (S-1) | Deviation register — closed in the pilot |
| L5 | No state machine yet at wallet-solution level | Open item |
| L6 | "Approved transfer" on device change is an open design question | Open item |

## Related documents

[[FW-TF-0001]] · [[FW-RB-0001]] · [[FW-RB-0002]] · [[PM-PH-0001]] · [[ARCH-0001]] · [[ARCH-0003]] · [[ARCH-0005]] ·
[[ADR-0002]] · [[ADR-0009]] · [[ADR-0010]] · [[SPEC-ID-0002]] · [[SPEC-ID-0003]] · [[SPEC-CRED-0002]] · [[SPEC-CRED-0003]] ·
[[SPEC-SCHEMA-0001]] · [[SPEC-SCHEMA-0002]] · [[SPEC-PROTO-0001]] · [[SPEC-PROTO-0002]] · [[SPEC-API-0001]] ·
[[SPEC-WALLET-0001]] · [[PM-ASSUR-0001]] · [[PM-GOV-0001]] · [[DECISIONS]] · [[INVARIANTS]] · [[GLOSSARY]]

## Change history

- **0.2.0 (2026-09-27)** — Tamga ARF 0.2 ([[ADR-0018]]): own site, English + Turkish, annexes A/B/C; §4.1 components and
  §4.2 service addresses updated; §6.3 hosted verifier.
- **0.1.3 (2026-09-27)** — ADR-0015/0016/0017: intermediary verifier role (§2); one trust interface including the wallet (§3.1).
- **0.1.2 (2026-09-26)** — [[ADR-0013]]: identity attestation in two formats (SD-JWT VC + ISO 18013-5 mdoc).
- **0.1.0 (2026-09-24)** — First version, accepted 2026-09-24 (D-GOV-6).
