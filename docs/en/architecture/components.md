---
document_id: ARCH-0003
title: "Component architecture"
status: Active
version: 1.0.0
created: 2026-09-09
last_updated: 2026-10-07
summary: >
  Describes the application components that run on top of the ledger. Central finding: because the verification read set grew
  from 3 to 5, the indexer is no longer an optional optimisation but a MANDATORY component; QBFT's instant finality means no reorg
  logic is needed, which simplifies it radically. Also covers the issuer service (student information system adapter, HSM signing,
  status publishing job), the verifier service (unified verification pipeline, mandatory prefetch), schema and status distribution,
  the wallet, trust boundaries between components, an inventory of which key lives where, and a DEGRADATION MATRIX — what keeps
  working when a component goes down.
translation_of: ARCH-0003
source_version: 1.0.0
---

# Scope

> **Today:** Tamga Network runs without a ledger; trust data comes from signed [[t:trust-list]]s and the anchor log
> ([[ADR-0009]], [[SPEC-TRUST-0001]]). This document also describes the components of the ledger stage; in the list stage
> `TrustSource` takes the place of the indexer ([[ADR-0015]]), and the verification pipeline ([[SPEC-API-0001]]) is the same.

[[ARCH-0001]] describes the ledger's **topology**, [[ARCH-0002]] its **setup**. This document defines the application components
that run **on top of** the ledger: what they do, how they connect, which keys they hold and what happens when one goes down.

Physical placement, hardware and operations are in [[ARCH-0004]]. SDK packages are in [[ARCH-0005]].

---

# 1. Component map

```
┌──────────────────────────────────────────────────────────────────┐
│                        LEDGER (ARCH-0001)                        │
│   Governance · RootCA · Schema · Issuer · Recognition · Status   │
└───────────────────────────┬──────────────────────────────────────┘
                            │ event stream (read only)
                            ▼
                  ┌──────────────────────┐
                  │       INDEXER        │  ← MANDATORY (§2)
                  │  event → local view  │
                  └──────┬───────────┬───┘
                         │           │
        ┌────────────────┘           └────────────────┐
        ▼                                             ▼
┌───────────────────┐                       ┌────────────────────┐
│  ISSUER SERVICE   │                       │  VERIFIER SERVICE  │
│  (university)     │                       │  (employer)        │
└────┬─────────┬────┘                       └─────────┬──────────┘
     │         │                                      │
     │         │ publish                        fetch │
     ▼         ▼                                      ▼
 ┌───────┐ ┌────────────────┐            ┌────────────────────────┐
 │  SIS  │ │ status.<issuer>│◀───────────│    prefetch cache      │
 │adapter│ │  (CDN)         │            └────────────────────────┘
 └───────┘ └────────────────┘                         ▲
                                                      │
                            ┌─────────────────────────┘
                            │
                  ┌─────────────────────┐
                  │ schemas.tamga.network│  (static + CDN)
                  └─────────────────────┘

        OpenID4VCI ▲                    ▼ OpenID4VP
               ┌────────────────────────────┐
               │ WALLET (e.g. Tamga Wallet) │
               └────────────────────────────┘
```

**Direction rule:** no application component **has to write** to the ledger — the only exceptions are the issuer service's status
publishing job (`publishList`) and the operator panel's national registry operations. Reads are **always** made from the indexer,
not from RPC.

---

# 2. Indexer — a mandatory component

## 2.1 Why mandatory

Under [[SPEC-BC-0001]] §11.2, verifying a single [[t:credential]] takes **five ledger reads**:

1. `isCredentialAcceptable(issuerId, iat)` — `isValidIssuer`, by contrast, is the issuance question
2. `isCredentialSchemaAcceptable(issuerId, schemaId, iat)`
3. `schemaRegistry.matchesContentHash`
4. `isRecognizedBy`
5. `statusListRegistry.matchesContentHash`

`TrustQueries.verifyAll()` bundles all five into a single call, but it is still one RPC round trip.

If an employer verifies 500 applications a day, that is 500 synchronous RPC calls, each adding directly to verification latency.
Worse: depending on an RPC node ties verification to the ledger's availability.

**Decision:** the indexer is not an optional optimisation. A compliant [[t:verifier]] service **does not query the ledger directly.**

## 2.2 QBFT instant finality — what simplifies the indexer

This is the design's most important simplification and is easily overlooked.

In QBFT a block is **final** the moment it is signed ([[ADR-0001]]). There is **no** probabilistic finality or chain
reorganisation (reorg) as in Nakamoto consensus.

Consequences:

| Needed on a Nakamoto chain | Not needed in Tamga |
|---|---|
| Waiting for N confirmations | Applied as soon as the block arrives |
| Reorg detection and rollback | None |
| Fork choice | None |
| Temporary state for "wobbly" data | None |

The indexer therefore becomes a **simple forward-only projector**: take the event, update the local table, move on. No rollback
logic is written.

**But:** the contracts are upgradeable (UUPS). An upgrade can change the event schema. The indexer must listen for the
`Upgraded(address)` event and, when it sees an unknown implementation, **stop and raise an alarm** — stopping is better than
projecting incorrectly in silence.

## 2.3 Events listened to

| Contract | Event | Projected table |
|---|---|---|
| Governance | `StateAdmitted`, `StateRemoved`, `StateWithdrawn`, `DelegateKeysSet` | `states`, `delegates` |
| RootCARegistry | `RootCARegistered`, `RootCASuspended`, `RootCARevoked` | `root_cas` |
| IssuerRegistry | `IssuerRegistered`, `IssuerSuspended`, `IssuerRevoked`, `IssuerRenewed` | `issuers` |
| IssuerRegistry | `SchemaAuthorizationSet` | `issuer_schema_auth` |
| SchemaRegistry | `SchemaRegistered`, `SchemaDeprecated`, `SchemaRevoked` | `schemas` |
| CrossRecognition | `RecognitionSet`, `IssuerBlocklisted` | `recognition`, `blocklist` |
| StatusListRegistry | `ListRegistered`, `ListPublished`, `ListRetired` | `status_anchors` |
| (all) | `Upgraded` | `contract_versions` + **alarm** |

## 2.4 Data model (summary)

```sql
CREATE TABLE issuers (
  issuer_id        BYTEA PRIMARY KEY,
  state_code       CHAR(2)   NOT NULL,
  category         SMALLINT  NOT NULL,
  assurance        SMALLINT  NOT NULL,
  parent_ca        BYTEA     NOT NULL,
  status           SMALLINT  NOT NULL,
  valid_from       TIMESTAMPTZ NOT NULL,
  valid_until      TIMESTAMPTZ NOT NULL,
  successor_id     BYTEA,
  last_block       BIGINT    NOT NULL
);

CREATE TABLE issuer_schema_auth (
  issuer_id  BYTEA NOT NULL,
  schema_id  BYTEA NOT NULL,
  allowed    BOOLEAN NOT NULL,
  last_block BIGINT NOT NULL,
  PRIMARY KEY (issuer_id, schema_id)
);

CREATE TABLE status_anchors (
  list_id      BYTEA PRIMARY KEY,
  issuer_id    BYTEA NOT NULL,
  list_uri     TEXT  NOT NULL,
  content_hash BYTEA,
  version      BIGINT NOT NULL,
  published_at TIMESTAMPTZ,
  status       SMALLINT NOT NULL,
  last_block   BIGINT NOT NULL
);

-- Single-row progress record
CREATE TABLE sync_state (
  id            SMALLINT PRIMARY KEY DEFAULT 1,
  last_block    BIGINT NOT NULL,
  last_block_at TIMESTAMPTZ NOT NULL,
  healthy       BOOLEAN NOT NULL DEFAULT TRUE,
  halt_reason   TEXT
);
```

**There is no personal data.** The indexer is a mirror of the ledger; the ledger holds no personal data ([[PM-TRUST-0001]]), so
neither does the mirror.

## 2.5 Freshness and staleness

The indexer is a **cache**, so it can go stale.

| Rule | Value |
|---|---|
| Accepted lag | ≤ 3 blocks |
| Stale threshold | `now - last_block_at > 60 s` |
| Behaviour when stale | The verifier returns "COULD NOT VERIFY", not "invalid" |

The last row applies here the same distinction as [[SPEC-CRED-0003]] §7.1 and [[SPEC-SCHEMA-0001]] §7: the difference between
*"this diploma is fake"* and *"I cannot check right now"* is whether a person gets hired.

**High-risk verifications** (official transactions) must be able to bypass the indexer and call `TrustQueries.verifyAll()`
directly. This is an escape hatch, not the default.

---

# 3. Issuer service

## 3.1 Layers

```
┌─────────────────────────────────────────────┐
│  Operator panel (web)                       │  institution staff
├─────────────────────────────────────────────┤
│  API layer — OpenID4VCI endpoints           │  wallets
├─────────────────────────────────────────────┤
│  Credential factory                         │  SD-JWT VC production
│    · disclosure generation (SPEC-CRED-0002) │
│    · schema validation (SPEC-SCHEMA-0001)   │
│    · derived claim computation              │
├──────────────┬──────────────┬───────────────┤
│ SIS adapter  │ Signing      │ Status        │
│ (source data)│ (HSM/KMS)    │ publisher     │
│              │              │ (cron, 1 h)   │
└──────────────┴──────────────┴───────────────┘
```

## 3.2 Student information system adapter

The single point that connects to the university's student information system (SIS). Three modes:

| Mode | When | Note |
|---|---|---|
| **Batch CSV** | Pilot start | Lowest integration risk, **recommended** |
| REST call | If the SIS offers an API | Needs authentication and rate limiting |
| Read-only DB view | If the institution allows | Freshest, but most intrusive |

**Critical rule:** the adapter applies the field mapping in [[SPEC-SCHEMA-0002]] §6 and **stops issuance for a programme with no
match in the mapping** — it does not produce a guessed ISCED-F code. A wrong code cannot be corrected in a signed document that
lives for forty years.

## 3.3 Signing module

- The credential signing key is **in an HSM/KMS** and never leaves it.
- The [[t:status-list]] signing key is **separate** ([[SPEC-CRED-0003]] §3.4) — it signs every hour, so it has to stay online.
- Both chain to the same X.509 hierarchy ([[SPEC-ID-0002]]).

## 3.4 Status publisher

A fixed-interval job ([[SPEC-CRED-0003]] §5.2). Six steps, in a binding order: take pending changes → update the bitstring →
compress → sign → **write to the CDN** → `publishList` (ledger).

**It runs even when nothing has changed.** This is not optional; conditional publishing would leak the timing of a revocation
through the moment of writing to the ledger.

## 3.5 Operator panel

The face used by institution staff. Minimum screens: graduate list and issuance queue, reissuing a single credential,
revocation/suspension, schema authorisation view (read-only — the state grants authorisation, [[SPEC-BC-0001]] §3.4), audit log.

---

# 4. Verifier service

## 4.1 Unified verification pipeline

> **The canonical registry is in [[SPEC-API-0001]] §1.** The list below is a summary view; `A7` and `A8` are added there. The
> code meanings are stable ([[SPEC-API-0001]]/AP1).

The steps of four specifications in a single order. Failure of any step means the credential is rejected; **uncertainty is not
rejection** (§2.5).

```
 A. FORMAT LAYER            → SPEC-CRED-0002 §8
    A1 split on ~, is there a KB-JWT
    A2 alg=ES256, typ=dc+sd-jwt, x5c present
    A3 x5c chain + JWT signature
    A4 _sd_alg = sha-256
    A5 each disclosure: hash FIRST, THEN decode; does it match in _sd
    A6 KB-JWT: signature, aud, nonce, iat, sd_hash

 B. SCHEMA LAYER            → SPEC-SCHEMA-0001 §7
    B1 read vct + vct#integrity
    B2 schemaId = keccak256(vct); registered in the indexer?
    B3 fetch Type Metadata (cache → URL → registry)
    B4 integrity: hash == vct#integrity == ledger contentHash
    B5 extends chain
    B6 JSON Schema conformance

 C. TRUST LAYER             → SPEC-BC-0001 §11.2
    C1 isCredentialAcceptable(issuerId, iat)
    C2 isCredentialSchemaAcceptable(issuerId, schemaId, iat)   ← cannot be skipped
    C3 isRecognizedBy(my state, issuer)

 D. REVOCATION LAYER        → SPEC-CRED-0003 §7
    D1 read status.status_list
    D2 take the Status List Token from the prefetch cache
    D3 token signature + sub match
    D4 freshness (exp / ttl)
    D5 ledger anchor: hash + version
    D6 read idx with bits=2 → anything other than 0x00 is REJECTED

 E. POLICY LAYER            → local
    E1 assurance threshold (e.g. category=EDUCATION && assurance>=I2)
    E2 are the requested claims disclosed
    E3 no RP scope overreach
    E4 audit record
```

## 4.2 Mandatory prefetch

[[SPEC-CRED-0003]] §9.1: the verifier does **not** fetch the Status List Token **per verification**. It uses scheduled batch
prefetching.

Reason: if every verification did `GET <status uri>`, the university would learn from the source IP which employers its graduates
applied to — a new tracking channel that the paper diploma never had.

`@tamga-network/verifier` does this **by default** ([[ARCH-0005]]).

## 4.3 Policy engine

A verification result is not a boolean but a **decision object**:

```json
{
  "outcome": "ACCEPTED | REJECTED | INDETERMINATE",
  "failed_step": "C2",
  "issuer": { "id": "0x…", "category": "EDUCATION", "assurance": "I2" },
  "schema": { "id": "0x…", "version": "1.0.0" },
  "disclosed_claims": ["is_graduate", "eqf_level", "…"],
  "status": { "value": "VALID", "list_version": 8412, "token_age_sec": 1830 },
  "chain_freshness": { "last_block": 918273, "age_sec": 4 },
  "evaluated_at": "2026-09-09T09:12:44Z"
}
```

`INDETERMINATE` is a result **separate** from `REJECTED` and must be shown separately in the user interface.

---

# 5. Schema and status distribution

Both follow the same pattern: **static file + CDN + ledger anchor.**

| | `schemas.tamga.network` | `status.<issuer-domain>` |
|---|---|---|
| Operated by | Foundation (initial stage) | Each issuer separately |
| Content | Type Metadata + JSON Schema | Signed Status List Token |
| Change | New versions only (immutable URL) | A new version every hour |
| Cache | `immutable`, indefinite | `ttl`/`exp` claims decide |
| Application server | No | No (the publishing job is separate) |
| Outage impact | New types cannot be learned | Continues from cache for up to 50 hours |

**Common principle:** neither is on the **critical path** of verification — thanks to the integrity hash they can be cached
indefinitely. This makes their SLOs much cheaper ([[ARCH-0004]]).

---

# 6. Wallet

Every wallet that follows the network's rules has these layers. Example: Tamga Wallet — the network's first wallet; a
company's separate product ([[ADR-0042]]).

| Layer | Responsibility |
|---|---|
| Key | Device secure element (Secure Enclave / StrongBox); never leaves it |
| Store | Local encrypted database — credentials stay on the device |
| Protocol | [[t:OpenID4VCI]] (receiving), [[t:OpenID4VP]] (presenting) |
| Consent screen | The user **sees field by field what they share** |
| Schema cache | Fetched **in bulk** at installation and when a type is added, not at the moment of use |
| Backup | Encrypted on the server; the server cannot decrypt it |

**Why bulk schema fetching:** if the wallet fetched the schema from the server on every presentation, `schemas.tamga.network` would
collect "who used which type of credential when" ([[SPEC-SCHEMA-0001]] security notes). The same logic mirrors the verifier's
prefetch (§4.2).

---

# 7. Trust boundaries

```
    ┌ TRUSTED ──────────────────────────────────┐
    │  ledger · indexer · issuer HSM            │
    └───────────────────────────────────────────┘
              ▲                    ▲
    ══════════╪════════════════════╪══════════════  trust boundary
              │                    │
    ┌ SEMI-TRUSTED ────────┐  ┌ UNTRUSTED ───────┐
    │ CDN (schema, status) │  │ wallet client    │
    │ → verified with the  │  │ verifier input   │
    │   integrity hash     │  │ raw SIS data     │
    └──────────────────────┘  └──────────────────┘
```

| Boundary | How it is crossed | Control |
|---|---|---|
| CDN → verifier | HTTPS + `vct#integrity` / `contentHash` | REJECTED if the hash does not match |
| Wallet → verifier | SD-JWT + KB-JWT | Signature and `sd_hash` |
| SIS → issuer | Institution's internal network | Schema validation + mapping table |
| Indexer → verifier | Local/trusted network | Freshness stamp |

**Why the CDN is only semi-trusted:** it can change content, but that is detected — the hash is inside the credential's signature.
The only thing it can do is **block access**, which produces `INDETERMINATE`, not a false acceptance.

---

# 8. Key inventory

Which component holds which key — the logical counterpart of [[ARCH-0004]] §4.

| Key | Owner | Where | Use | Rotation |
|---|---|---|---|---|
| Validator | Member state | Node HSM | Block signing | Rarely, planned |
| State delegate | Member state | State KMS | National registry writes | Yearly |
| Issuer credential | Issuer | HSM, **offline** | Credential signing | Heavy — affects history |
| Issuer status | Issuer | KMS, **online** | Hourly token signing | Yearly, cheap |
| Issuer delegate (EOA) | Issuer | KMS | `publishList` transaction | Yearly |
| Root CA | Member state | Offline HSM, ceremony | Signing subordinate CAs | Very rarely |
| Wallet device key | User | Secure Enclave | KB-JWT | On device change |
| TLS | Every service | ACME/automation | HTTPS | 90 days |

**Invariant K1:** the credential signing key and the status signing key **can never be the same.** If they were, signing every hour
would require exposing the diploma key in the HSM to a permanently online service.

---

# 9. Degradation matrix

This table summarises the design's resilience.

| Component down | Issuance | Verification | Impact |
|---|---|---|---|
| **RPC node** | ✗ status publishing pauses | ✓ continues from the indexer | Low |
| **Indexer** | ✓ | ⚠ `INDETERMINATE` or direct RPC | Medium |
| **Ledger (all validators)** | ✗ | ⚠ limited, from cache | **Critical** |
| **`schemas.tamga.network`** | ✓ (schema local) | ✓ known types; ✗ new types | Low |
| **`status.<issuer>`** | ✓ | ✓ up to 50 hours (`exp`) | Low |
| **Issuer service** | ✗ that institution | ✓ credentials already issued | Medium (local) |
| **Verifier service** | ✓ | ✗ that verifier | Low (local) |
| **Issuer HSM** | ✗ that institution | ✓ | Medium |
| **Wallet (device lost)** | — | ✗ that user | Recovery: [[SPEC-CRED-0001]] |

**The conclusion to read:** the only real single point of failure is the ledger itself, and with QBFT it tolerates 1 (4 validators)
or 2 (7 validators) node failures. When any other component goes down the system drops to **partial service**; it does not give
wrong answers in silence.

This is what the "content off-chain, anchor on-chain" pattern of [[ADR-0007]] and [[ADR-0008]] buys: when content distribution is
interrupted, the integrity guarantee is not lost; only freshness drops.

---

# 10. Invariants

> **Code distinction:** `CMP*` are this document's **invariants**. The `A1…E4` in §4.1 are the verification pipeline's **step
> codes** and are canonical — used verbatim in [[ARCH-0004]] §5.2 and in the `failed_step` field of [[SPEC-API-0001]]. The two must
> not be confused.

| # | Invariant |
|---|---|
| **CMP1** | The verifier service does not query the ledger directly; it reads from the indexer (§2.1). |
| **CMP2** | The indexer **stops and raises an alarm** when it sees an unknown implementation version (§2.2). |
| **CMP3** | The indexer stores no personal data (§2.4). |
| **CMP4** | A stale indexer produces `INDETERMINATE`, not `REJECTED` (§2.5). |
| **CMP5** | The SIS adapter stops issuance for data with no match in the mapping; it does not guess (§3.2). |
| **CMP6** | Status publishing runs at a fixed interval even when nothing has changed (§3.4). |
| **CMP7** | The verifier does not fetch status per verification; it uses prefetching (§4.2). |
| **CMP8** | The wallet fetches schemas in bulk, not at the moment of use (§6). |
| **K1** | Credential and status signing keys are separate (§8). |
| **CMP9** | A verification result has three values: ACCEPTED / REJECTED / INDETERMINATE. |

---

# Open questions

1. ~~Who operates the indexer~~ — **CLOSED** (2026-09-09, [[PM-GOV-0001]] decision P3). Every verifier runs its own instance; the
   foundation **does not offer a hosted indexer**, it only publishes a reference distribution. Because verification traffic is
   heavier than revocation data, this is a stricter rule than for status hosting.
2. Who sets the threshold for bypassing the indexer in high-risk verification — the verifier or the schema (`tamga` block)?
3. Which component owns the server side of wallet backup? It is not on the map yet; to be defined in [[SPEC-WALLET-0001]].
4. Should the operator panel's national registry operations (`registerIssuer`) live in the issuer service or in a separate state
   console? The second is cleaner but adds a component in the initial stage.

---

# Related documents

[[ARCH-0001]] · [[ARCH-0002]] · [[ARCH-0004]] · [[ARCH-0005]] ·
[[SPEC-BC-0001]] · [[SPEC-CRED-0001]] · [[SPEC-CRED-0002]] · [[SPEC-CRED-0003]] ·
[[SPEC-SCHEMA-0001]] · [[SPEC-SCHEMA-0002]] · [[SPEC-ID-0002]] ·
[[PM-TRUST-0001]] · [[ADR-0001]] · [[ADR-0007]] · [[ADR-0008]]

---

# Status

**In force** — version 1.0.0 (2026-10-02).
