---
document_id: ADR-0008
title: "Where the status list lives"
status: Active
version: 1.0.0
created: 2026-09-09
last_updated: 2026-10-02
summary: >
  Code and specification contradicted each other in the repository: SPEC-CRED-0001 §5 said "list off-chain, pointer
  on-chain" while StatusListRegistry.sol kept the bitmap on the ledger (_setBit, getChunk). This ADR resolves the
  contradiction. Decision: the bitstring list is off-chain, hosted by the issuer as a signed Status List Token; the ledger
  holds only an anchor of URI + content hash + version + size. The main reason is privacy: writing every revocation to the
  ledger would leak the MOMENT of revocation to every validator of a permissioned network and, combined with the block
  timestamp, narrow down the holder. StatusListRegistry.sol will be rewritten.
domain: Credentials
translation_of: ADR-0008
source_version: 1.0.0
---

# ADR-0008 — Status list placement

**Status: Accepted** ✅ (2026-09-09)

---

# Context

## The contradiction found

A repository audit on 2026-09-09 found that the [[t:revocation]] mechanism was defined **in two places in two different
ways**:

**[[SPEC-CRED-0001]] §5 says:**

> The list is off-chain (hosted by the [[t:issuer]], signed/versioned); the ledger holds only URI + hash + version +
> bitmap.

(The "+ bitmap" at the end of the sentence is already inconsistent in itself — if the list is off-chain, what is the bitmap
doing on the ledger?)

**`contracts/src/revocation/StatusListRegistry.sol`, however, does this:**

```solidity
function setRevoked(bytes32 issuerId, uint256 index) public onlyIssuer(issuerId)
function setRevokedBatch(bytes32 issuerId, uint256[] calldata indexes) external
function getChunk(bytes32 issuerId, uint256 chunkIndex) external view returns (uint256)
function _setBit(bytes32 issuerId, uint256 index, bool value) private
```

So the bitmap is **on the ledger**, in 256-bit chunks. Every revocation is a ledger transaction.

Both cannot be true at the same time. This ADR resolves the contradiction.

## Why now

This is a design split that went unnoticed when the code was written, and it stems from **two different readings** of the
[[SPEC-BC-0001]] decision "approach B (bitstring)". "Bitstring" defines the data structure; it does not define **where it
lives**. The decision log recorded that a bitstring was chosen; the placement question was never asked.

---

# Decision

## Decision 1 — The bitstring list lives off-chain

The revocation list is published by the issuer as a **signed [[t:status-list|Status List]] Token** under the IETF Token
Status List (draft-ietf-oauth-status-list):

```
https://status.<issuer-domain>/v1/statuslist/<listId>
```

The token is signed with a key bound to the **same chain of trust** as the issuer's [[t:credential]] signing key
([[SPEC-ID-0002]] X.509). Its content is a compressed bitstring.

## Decision 2 — The ledger holds only an anchor

The `StatusListRegistry` contract holds:

```
listId        = keccak256(issuerId, listURI)
issuerId      bytes32
listURI       string
contentHash   bytes32     // hash of the published Status List Token
listSize      uint256     // min 100,000 (privacy floor kept)
version       uint64      // increases with every publication
publishedAt   uint64
status        {ACTIVE, RETIRED}
```

There is **not a single bit** of revocation data on the ledger.

## Decision 3 — The publication cycle is fixed and noisy

The issuer republishes the list **at fixed intervals** (suggested: 1 hour) — whether or not anything was revoked in that
interval. `contentHash` and `version` are updated on the ledger with every publication.

This is **mandatory** to keep the privacy benefit of decision 1. If we published only when something was revoked, the
ledger update itself would leak "a revocation happened at this hour" — bringing back exactly the problem we are avoiding.

## Decision 4 — `StatusListRegistry.sol` will be rewritten

The `_setBit`, `getChunk`, `setRevoked`, `setRevokedBatch` and `unsetRevoked` functions are **removed.** They are replaced
by `publishList(...)` and `getListAnchor(...)`.

The `IStatusList.isRevoked(issuerId, index)` interface in `ITrustQueries.sol` is also **removed** — the ledger can no
longer answer that question, and leaving an interface that looks as if it could is dangerous.

## Decision 5 — Verification flow

The [[t:verifier]]:

1. Takes `listURI` + `index` from the credential's `status` claim.
2. Downloads the Status List Token (or takes it from cache).
3. Verifies the token's signature.
4. Compares the token's hash with the `contentHash` on the ledger.
5. Checks that `version` is fresh enough (policy: e.g. within the last 24 hours).
6. Reads `index` in the bitstring.

Step 4 is critical: it prevents the issuer from silently rolling back the list on its own server (showing a revoked
document as "valid").

---

# Rationale

## 1. Privacy — this is the main reason

The most serious problem of an on-chain bitmap is not gas but **leaking the moment of revocation**.

In a permissioned network every transaction is visible to every validator and carries a block timestamp. When
`setRevoked(issuerId, 4711)` is written to the ledger, every state in the network learns:

> "University X revoked the document at index 4711 on 14 March 2027 at 10:42."

On its own this does not say whom the index belongs to. But correlation narrows it down:

- When a university revokes a diploma by a disciplinary decision, the date of that decision is usually known or public.
- An employee's credential is revoked on the day they leave an institution. The leaving date matches the ledger stamp.
- A bulk revocation (a department closing) shows up on the ledger as a distinct cluster.

Off-chain + fixed-interval publication closes this: the only thing visible from outside is "a new version of the list
was published". Which bit changed — even whether any bit changed — is not visible.

This applies the same logic as the [[PM-TRUST-0001]] principle "even a linkable hash is risky", in the time dimension.

## 2. Standards alignment

[[ADR-0006]] delegated revocation to the **Token Status List**. That standard's architecture is already "the issuer
publishes a token, the verifier fetches it". Putting the bitmap on the ledger would take the standard's data structure and
abandon its transport model — half-alignment. Half-alignment breaks working with external wallets and external verifiers.

## 3. Cost and scale

Even if gas is free on a permissioned network, ledger state is kept on every validator's disk forever.

Rough size: a 100,000-index list for a single university = a 12.5 KB bitmap. ~200 higher-education institutions in
Türkiye → 2.5 MB. At Turkic-world scale, thousands of issuers × list growth → tens of MB of permanent state, plus one
transaction and one block per revocation.

Off-chain, the same data is served from a CDN and consumes zero ledger state.

## 4. Balance of scalability and freshness

An off-chain list can be cached aggressively on the verifier side. An on-chain read requires going to an RPC node every
time — and verification is the most frequent operation in the network.

## 5. The same pattern as [[ADR-0007]]

The schema registry uses the same pattern: **content off-chain, anchor on-chain.** Using two different patterns would
split both the code and the mental model for no reason. One pattern: *the ledger says which version of an outside
document is valid.*

---

# Alternatives considered

## A — Bitmap entirely on the ledger (the existing code) — rejected

- **Pro:** a single source; the verifier makes no extra HTTP call; revocation data survives even if the issuer's server
  goes down.
- **Con:** leaks the moment of revocation (§1), permanent state cost, deviation from the standard, RPC dependency.

Rejected. Its only real advantage — the "issuer server goes down" scenario — is covered sufficiently by decision 5 step 4 +
caching.

## B — Cryptographic accumulator / ZK revocation — deferred

Revocation with a Merkle/RSA accumulator or a ZK membership proof is the strongest solution for privacy (the verifier
does not even reveal which index it is checking).

Not rejected but **deferred.** Reason: no mature library or wallet support, alignment with the ES256 base of
[[ADR-0006]] needs further research, and it would complicate the pilot unnecessarily. `RS-REVOCATION-0001` will assess it
for phase 2.

## C — Short-lived credentials (no revocation) — partly adopted

The way to remove revocation altogether is to make credentials very short-lived and renew them continuously.

- For a **student certificate** this is the right answer: 30-day TTL, never on a revocation list.
- For a **diploma** it is wrong: a diploma is permanent; renewing it continuously burdens the issuer and gives the issuer
  a "this person is still active" signal with every renewal (tracking surface).

**Adopted:** a mix. A per-schema TTL policy is defined in [[SPEC-SCHEMA-0002]]; short-lived types do not use a status list.

## D — Hybrid: urgent revocations on the ledger, normal ones off-chain — rejected

"Write critical revocations to the ledger immediately" sounds attractive but produces the worst privacy outcome: the
revocation written to the ledger is **exactly the most sensitive one**. It does not reduce the leak; it concentrates it.

---

# Consequences

## Binding

1. `StatusListRegistry.sol` is **rewritten** (decision 4). The existing bitmap logic is removed.
2. `ITrustQueries.sol` → `IStatusList.isRevoked` is **removed.**
3. The `CredentialRevoked` check in `CredentialGate.sol` must be rethought, since it can no longer read from the ledger.
   On-chain credential gating ([[ADR-0003]] decision 4) can no longer see revocation status **directly**; the revocation
   check has to rely on fresh evidence presented by the caller. This narrows a consequence of [[ADR-0003]] and will be
   addressed in `SPEC-AGENT-0001`.
4. The "+ bitmap" wording in [[SPEC-CRED-0001]] §5 is corrected.
5. [[SPEC-CRED-0003]] writes this decision down normatively: token format, publication cycle, caching policy, freshness
   threshold.
6. `status.<issuer-domain>` is an operated component for every issuer — it enters the [[ARCH-0004]] inventory and the
   issuer onboarding checklist.

## Accepted trade-offs

- **Operational load on the issuer.** Every issuer now has to run a status server. Tamga may offer hosting to small
  institutions — but then Tamga sees every revocation. This is a point of centralisation and should be handled as a policy
  in [[PM-GOV-0001]].
- **Freshness window.** Fixed-interval publication means a delay of up to one publication interval (1 hour) in the worst
  case. For scenarios that need immediate revocation, the decision 3 interval can be shortened per schema.
- **Extra network call.** The verifier makes one more HTTP request during verification. With caching this is negligible
  in practice.

---

# Relations

**Corrects:** [[SPEC-CRED-0001]] §5 (contradiction) · `StatusListRegistry.sol`
**Builds on:** [[ADR-0006]] · [[PM-TRUST-0001]]
**Implemented by:** [[SPEC-CRED-0003]] · [[SPEC-BC-0001]] (rewrite)
**Narrows:** [[ADR-0003]] decision 4 (revocation visibility for credential gating)
**Sibling decision:** [[ADR-0007]] (the same off-chain content + on-chain anchor pattern)
**Defers:** `RS-REVOCATION-0001` (accumulator/ZK, phase 2)

---

# Status

**Accepted** ✅ — 2026-09-09. Recorded in [[DECISIONS]] as `D-REV-1`, with the related lines in the D-NET/D-CRED sections
updated.
