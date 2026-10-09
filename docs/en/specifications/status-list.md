---
document_id: SPEC-CRED-0003
title: "Revocation and status list"
status: Active
version: 1.0.0
created: 2026-09-09
last_updated: 2026-10-09
summary: >
  The normative implementation of the [[ADR-0008]] decision. Defines the Tamga profile of the Status List Token (bits=2,
  ES256, X.509 chain, at least 100,000 indices), the fixed-interval, noisy publication cycle, the rewritten
  StatusListRegistry anchor contract, the ten-step verification algorithm, and the caching and freshness policy. Two
  critical privacy rules: indices are allocated at RANDOM (sequential allocation leaks graduation order) and the list URI
  must be OPAQUE (a URI encoding year/faculty/cohort leaks undisclosed claims). Scheduled bulk prefetching is mandatory
  instead of fetching per verification.
translation_of: SPEC-CRED-0003
source_version: 1.0.0
---

This specification defines how the revocation status of a credential is published and verified; it is for issuing
institutions and verifier developers.

**When to read**

- First read the [Revocation and freshness](/concepts/revocation) page.
- Its place in the verification pipeline (D steps): [[SPEC-API-0001]].
- The rationale for the decision: [[ADR-0008]].

**In brief**

The institution gives every credential a random position in a large bit list ([[t:status-list]]). When the credential is
revoked, the value of that bit changes; the list is signed and published at fixed intervals. The verifier downloads the list
in advance and, when the credential is shown, checks its own copy without asking anyone; so the institution cannot learn
where and when the credential was shown. The fingerprint of every publication is written to the anchor log; if the list is
rolled back, the verifier notices.

> Today the anchor is the anchor log of the [[t:trust-list]] publisher (`anchors.jsonl`). The contract interface in §4
> belongs to the chain stage ([[ADR-0009]]).

---

# Scope

This specification defines how, in Tamga, the **revocation status** of a [[t:credential]] ([[t:revocation]]) is published,
anchored and verified.

The decision and its rationale are in [[ADR-0008]] and are not repeated here. In short: the bitstring list is hosted
**off-chain**; only the URI + content hash + version anchor sits on the chain.

**Standards basis:** IETF Token Status List — the Tamga profile follows draft-ietf-oauth-status-list-**20** (2026-04-20),
which the EU fixed in CIR 2026/1731. The current draft is **draft-21** (2026-06-21, in the RFC Editor queue); as long as the
EU reference stays at draft-20, so does Tamga, and the profile is reviewed once the RFC is published.

Out of scope: cryptographic accumulators / [[t:ZK]] revocation (`RS-REVOCATION-0001`, expansion stage).

---

# 1. Model and roles

```
┌─────────────┐  issuance  ┌──────────┐  present  ┌──────────┐
│   Issuer    │──────────▶ │  Holder  │─────────▶ │ Verifier │
│ (university)│            │ (wallet) │           │(employer)│
└──────┬──────┘            └──────────┘           └────┬─────┘
       │ publishes                                     │ fetches
       ▼                                               ▼
┌──────────────────────────┐              ┌────────────────────┐
│  Status List Token       │◀─────────────│  cache /           │
│  status.<issuer-domain>  │              │  prefetch (§9)     │
└──────────┬───────────────┘              └────────────────────┘
           │ hash + version
           ▼
┌──────────────────────────┐
│  StatusListRegistry      │  ← chain (anchor only)
└──────────────────────────┘
```

| Role | Task |
|---|---|
| **Status Provider** | Produces, signs and publishes the Status List Token. By default the issuer itself. |
| **Referenced Token** | The credential whose status is tracked — in Tamga an SD-JWT VC. |
| **Anchor** | The record in the `StatusListRegistry` contract. |

**Terminology note:** the standard says "[[t:relying-party|Relying Party]]"; in Tamga this is the
**[[t:verifier|Verifier]]** (the same concept as [[SPEC-BC-0001]] `RelyingPartyRegistry`).

---

# 2. Credential side (referenced token)

Every Tamga credential that uses a status list carries a `status` claim ([[SPEC-SCHEMA-0001]] §4.2 — mandatory when
`tamga.uses_status_list = true`):

```json
"status": {
  "status_list": {
    "idx": 48213,
    "uri": "https://status.tamga.network/7f3a9c21"
  }
}
```

| Field | Meaning |
|---|---|
| `idx` | This credential's index in the list |
| `uri` | Address of the Status List Token |

**The `status` claim is `sd: "never"`** — it cannot be hidden with [[t:selective-disclosure]] and is visible in every
presentation. The privacy consequences are covered in §6 and §10.

---

# 3. Status List Token

## 3.1 Structure

JWS compact serialization. Header:

```json
{
  "alg": "ES256",
  "kid": "sl-2026-a",
  "typ": "statuslist+jwt",
  "x5c": ["MIIB...", "MIIC..."]
}
```

Body:

```json
{
  "iss": "https://issuer.tamga.network/example-university",
  "sub": "https://status.tamga.network/7f3a9c21",
  "iat": 1789000000,
  "exp": 1789021600,
  "ttl": 120,
  "status_list": {
    "bits": 2,
    "lst": "eNrbuRgAAhcBXQ..."
  }
}
```

| Claim | Requirement | Tamga profile |
|---|---|---|
| `iss` | Mandatory | Issuer identifier; in the same trust chain as the Referenced Token's `iss` |
| `sub` | Mandatory | List URI — **exactly the same** as `uri` in the Referenced Token |
| `iat` | Mandatory | Publication time |
| `exp` | **Mandatory in Tamga** | `iat + 6 hours` (§8.1) |
| `ttl` | **Mandatory in Tamga** | The publication interval (seconds); `120` in the services run by the network (§5.1, §8.1) |
| `status_list.bits` | Mandatory | **Always `2` in Tamga** — §3.3 |
| `status_list.lst` | Mandatory | Compressed byte array, base64url |
| `status_list.aggregation_uri` | Optional | **Recommended in Tamga** — §9.2 |

## 3.2 Serving

```
GET /7f3a9c21 HTTP/1.1
Host: status.tamga.network
Accept: application/statuslist+jwt

HTTP/1.1 200 OK
Content-Type: application/statuslist+jwt
Content-Encoding: gzip

eyJhbGciOiJFUzI1NiIsImtpZCI6InNsLTIwMjYtYSIsInR5cCI6InN0YXR1c2xpc3Qr...
```

- The response body is the **raw JWS compact serialization** — it is not wrapped in a JSON envelope.
- `Content-Encoding: gzip` should be used (`lst` is already compressed, but the base64url form of the JWT benefits from
  gzip).
- The CWT form (`application/statuslist+cwt`) is **not used** in Tamga’s initial stage; it will be considered in the state stage together
  with the mdoc profile ([[ADR-0006]]).

## 3.3 The `bits = 2` decision

The standard allows the values 1, 2, 4 and 8 for `bits`. Tamga **always uses 2**.

| Option | Meaning | Tamga assessment |
|---|---|---|
| `bits = 1` | Only valid/invalid | Suspension cannot be represented |
| **`bits = 2`** | 4 states | **Chosen** |
| `bits = 4` / `8` | 16 / 256 states | Size grows 2–4 times, for no benefit |

Status values and their Tamga meaning:

| Value | Standard name | Tamga meaning |
|---|---|---|
| `0x00` | VALID | Valid |
| `0x01` | INVALID | **Permanent revocation** — irreversible |
| `0x02` | SUSPENDED | **Temporary suspension** — reversible |
| `0x03` | (reserved) | Not used in Tamga |

**Why suspension is needed:** when a plagiarism investigation is opened about a diploma, the institution does not want to
revoke it permanently — it wants to suspend it until the investigation ends. With `bits = 1` the institution would either
revoke it permanently without cause or do nothing. Both are wrong.

**Size cost:** 100,000 indices × 2 bits = 25 KB raw; compressed, typically a few hundred bytes (the list is mostly zeros).
Negligible.

## 3.4 Signing key

The Status List Token is signed with a key **separate** from the credential signing key, but bound to **the same X.509
chain** ([[SPEC-ID-0002]]).

Rationale:

1. **Different frequency of use.** The credential key is used rarely and sits in an HSM. The status key signs at every publication
   interval (every 2 minutes today); it has to sit in an online system. Making them the same would mean exposing the HSM key to a permanently online
   service.
2. **Damage isolation.** If the status key is compromised, the attacker can publish a fake *status* but cannot produce a
   fake *diploma*.
3. **Rotation.** The status key can be rotated yearly; rotating the credential key is a much heavier operation because it
   affects past credentials.

`kid` is always filled in and changes on rotation.

---

# 4. Anchor

## 4.1 What `contentHash` hashes

```
contentHash = SHA-256( ASCII bytes of the JWS compact serialization string )
```

That is, the string **after** `Content-Encoding: gzip` is decoded. The full token, including the dot separators.

**Invariant:** a token with the same version number is always the same bytes. The Status Provider cannot produce different
bytes for the same `version`.

## 4.2 Contract interface

Under [[ADR-0008]] decision 4, `StatusListRegistry.sol` has been **rewritten.** The earlier design that held a bitmap is
void.

```solidity
// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

interface IStatusListRegistry {
    enum ListStatus { NONE, ACTIVE, RETIRED }

    struct ListAnchor {
        bytes32    issuerId;
        string     listURI;       // the sub claim of the Status List Token
        bytes32    contentHash;   // §4.1
        uint32     listSize;      // toplam indeks kapasitesi
        uint8      bitsPerEntry;  // Tamga'da her zaman 2
        uint64     version;       // monoton artan
        uint64     publishedAt;   // time of the latest publication
        ListStatus status;
    }

    /// @notice Tamga profile: the list must have at least this index capacity.
    function MIN_LIST_SIZE() external pure returns (uint32); // 100_000

    event ListRegistered(bytes32 indexed listId, bytes32 indexed issuerId, string listURI, uint32 listSize);
    event ListPublished(bytes32 indexed listId, uint64 version, bytes32 contentHash, uint64 publishedAt);
    event ListRetired(bytes32 indexed listId, string reason);

    error ListExists(bytes32 listId);
    error UnknownList(bytes32 listId);
    error NotListOwner(bytes32 listId, address caller);
    error VersionNotMonotonic(uint64 current, uint64 submitted);
    error PublishedAtNotMonotonic(uint64 current, uint64 submitted);
    error ListSizeTooSmall(uint32 submitted, uint32 minimum);
    error InvalidBitsPerEntry(uint8 submitted);
    error ListNotActive(bytes32 listId);

    /// @notice listId = keccak256(abi.encodePacked(issuerId, bytes(listURI)))
    function listIdOf(bytes32 issuerId, string calldata listURI) external pure returns (bytes32);

    /// @notice Listeyi bir kez kaydeder. onlyIssuer(issuerId).
    function registerList(
        bytes32 issuerId,
        string calldata listURI,
        uint32 listSize,
        uint8 bitsPerEntry
    ) external returns (bytes32 listId);

    /// @notice Called in every publication cycle (§5). version must increase monotonically.
    function publishList(
        bytes32 listId,
        bytes32 contentHash,
        uint64 version,
        uint64 publishedAt
    ) external;

    function retireList(bytes32 listId, string calldata reason) external;

    function getListAnchor(bytes32 listId) external view returns (ListAnchor memory);

    /// @notice Used in verification: does the hash match and is the version fresh enough?
    function matchesContentHash(bytes32 listId, bytes32 hash) external view returns (bool);
}
```

## 4.3 Removed interfaces

The following have been **removed** and must not be added back:

| Removed | Where | Why |
|---|---|---|
| `setRevoked(issuerId, index)` | `StatusListRegistry.sol` | The chain no longer holds bits |
| `setRevokedBatch(...)` | same | same |
| `unsetRevoked(...)` | same | same |
| `getChunk(issuerId, chunkIndex)` | same | same |
| `_setBit(...)` | same | same |
| `IStatusList.isRevoked(issuerId, index)` | `ITrustQueries.sol` | The chain **cannot answer** this question |

The last row is critical. Leaving an interface that asks a question it cannot answer makes the caller read a `false` return
as "not revoked". The interface must go so that compilation fails.

**Knock-on effect:** `CredentialGate.sol` cannot read revocation status from the chain. Under [[ADR-0008]] consequences §3,
on-chain credential gating has to rely on fresh proof supplied by the caller → `SPEC-AGENT-0001`.

---

# 5. Publication cycle

## 5.1 Fixed interval and noise

The Status Provider republishes the list at **fixed intervals**. Default interval: **2 minutes** (the issuance services run
by the network; shorter in the sandbox). `ttl` equals the interval; `exp` is in the order of hours, independent of the
interval (§8.1). The short interval makes a revocation visible within minutes; the long `exp` keeps verification from falling
to COULD NOT VERIFY at once during a status server outage (project management decision, 2026-10-09).

**It is published even if nothing changed.** This is not optional.

Rationale ([[ADR-0008]] §1): if the list were published only when a revocation happens, the mere existence of a
`publishList` transaction on the chain would leak "a revocation happened this hour" to every validator in the network.
Combined with the block timestamp — the date of a disciplinary decision, the day someone left a job — the credential holder
could be narrowed down.

In a fixed cycle the only thing visible from outside is "there is a new version of the list". Which bit changed, or even
whether a bit changed at all, is not visible.

## 5.2 Publication algorithm

```
Every interval T (default 3600 s):

  1. Take pending status changes from the queue (if any; may be empty).
  2. Update the bitstring.
  3. Compress → lst.
  4. Build the token body:
       iat = now, exp = now + 6h, ttl = T, version = previous + 1
  5. Sign with the status key → JWS compact serialization.
  6. contentHash = SHA-256(ASCII bytes of the string)
  7. Write to the CDN / status server.          ← FIRST
  8. publishList(listId, contentHash, version, iat)   ← THEN
```

**The order of steps 7–8 is binding.** In the reverse order a version would exist that is registered on the chain but not
reachable, and every verification would get stuck at §7 step 6.

## 5.3 Interval versus freshness

In the worst case a revocation becomes visible with a delay of one publication interval plus the verifier's prefetch interval
(§9.1). At the default 2-minute interval this is a few minutes.

Today the anchor is the trust list publisher's anchor log and every publication is one line. In the chain stage
([[ADR-0009]]) every publication becomes a transaction; the interval is re-evaluated for chain load at that stage (the
calculation in open topic 1 is for an hourly interval).

**Emergencies:** publishing outside the interval is **not done** — it destroys the privacy benefit of §5.1. If an urgent
revocation is needed, the right tool is not the status list but suspending the [[t:issuer]] certificate ([[SPEC-ID-0002]])
or setting the schema to `REVOKED` ([[SPEC-SCHEMA-0001]] §9.2).

---

# 6. Index allocation — privacy critical

This section is the part of the specification most easily implemented wrongly.

## 6.1 Indices are allocated at RANDOM

The `idx` value is chosen **cryptographically at random** within the list's capacity. A sequential counter is **not used.**

**What sequential allocation leaks:** the `idx` claim is `sd: never` — visible in every presentation. With sequential
allocation a graduate with `idx = 12` is the 12th person to receive a credential on that list. This:

- Reveals the graduation/enrolment **order**
- The `idx` difference between two graduates approximates the time between them
- In small departments it almost singles the person out
- It approximates the date even if the graduate did not disclose `awarding_date`

So information hidden with selective disclosure leaks through the index.

## 6.2 Fill ratio

Random allocation alone is not enough. If the list is mostly empty, the distribution of the filled indices still carries
information.

| Rule | Value |
|---|---|
| Minimum list capacity | **100,000** indices |
| Maximum fill | 80% — beyond that a new list is opened |

A new list holding few credentials is not visible from outside: the bit of a valid credential and the bit of an index never
used are the same (`0x00`), so someone looking from outside cannot see which indices are allocated. Marking unused indices as
"allocated" (initial noise) therefore gives no observable protection and is not used (project management decision,
2026-10-09). Random allocation (§6.1) and the minimum capacity provide the protection.

## 6.3 The list URI must be OPAQUE

**This rule closes a leak caught while this specification was being written.**

The list URI travels in the `status` claim, which is `sd: never` — so **it is seen by the verifier in every
presentation.** The URI itself is therefore a claim.

Forbidden patterns:

| URI | What it leaks |
|---|---|
| `.../sl/edu-2026-a` | **Graduation year** — even if `awarding_date` is hidden |
| `.../sl/muhendislik` | Faculty/department — even if `programme_title` is hidden |
| `.../sl/lisans-2026-guz` | Cohort — both at once |
| `.../sl/tip-fakultesi-2024` | Both + professional information |

**Rule:** the list identifier must be **opaque** — a meaningless, randomly generated string:

```
https://status.tamga.network/7f3a9c21
```

The Status Provider keeps the mapping between this identifier and the cohort **internally**; it never leaves.

## 6.4 How lists are split

When the capacity is full, a new list is opened. Splitting criteria:

| Criterion | Assessment |
|---|---|
| By year / term | **Forbidden** — the same leak as §6.3; even with an opaque URI, membership of the list reveals the year |
| By department / faculty | **Forbidden** — same reason |
| By schema (credential type) | **Unavoidable and harmless** — `vct` is in the clear anyway |
| Next one when capacity is full | **Recommended** |

So the only dividing axis is the credential type; apart from that, a new list is opened only because the old one is full,
and the credentials in it share no common property other than their type.

**Implementation note:** this forbids the natural-looking and operationally easy design "2026 graduates are on list A".
Administrative convenience is not worth a privacy leak.

---

# 7. Verification algorithm (verifier)

Normative. Run for every credential that carries a `status` claim.

```
Ş1.  Does the credential have status.status_list?
     If the schema says tamga.uses_status_list = true and the claim is missing → REJECT.

Ş2.  Take idx and uri. If the uri scheme is not https → REJECT.

Ş3.  Obtain the Status List Token:
     a) Is it in the prefetch cache and fresh (§8)? → use it.
     b) Otherwise GET <uri>, Accept: application/statuslist+jwt
     c) If neither works → "COULD NOT VERIFY" (not REJECT, §7.1)

Ş4.  Verify the token:
     - typ == "statuslist+jwt"
     - signature valid, the x5c chain links to the issuer's X.509 chain
       (SPEC-ID-0002); root anchored in RootCARegistry
     - sub == the uri in the credential  → otherwise REJECT
     - iss in the same trust chain as the credential's iss → otherwise REJECT

Ş5.  Freshness:
     - exp has passed → "COULD NOT VERIFY"
     - iat + ttl < now → the token is stale; refresh or "COULD NOT VERIFY"
       depending on policy
     (the exp/ttl claims decide, not the HTTP cache headers)

Ş6.  CHAIN ANCHOR:
     listId = keccak256(issuerId, sub)
     anchor = StatusListRegistry.getListAnchor(listId)
     - anchor.status == ACTIVE  → otherwise REJECT
     - SHA-256(token bytes) == anchor.contentHash → otherwise REJECT
     - version in the token lower than anchor.version → REJECT (rollback)

Ş7.  Capacity: idx < anchor.listSize → otherwise REJECT

Ş8.  Decompress lst and read the value at position idx with bits=2.

Ş9.  Interpret the value:
     0x00 → VALID
     0x01 → REVOKED      → REJECT
     0x02 → SUSPENDED    → REJECT (shown to the user as "suspended")
     0x03 → unrecognised → REJECT

Ş10. Write the result to the audit log together with the version and iat of the token used.
```

## 7.1 "Invalid" versus "could not verify"

In Ş3(c) and Ş5 the result is **"could not verify", not "invalid"**, and the verifier must show the two **differently** to
the user.

The difference between "this diploma has been revoked" and "I cannot check the revocation status right now" is the
difference between someone being hired or not. The same distinction applies to schema resolution in [[SPEC-SCHEMA-0001]]
§7.

## 7.2 Why Ş6 cannot be skipped

Without the chain anchor the issuer could silently roll back the list on its own server — showing a credential it revoked as
"valid" again. `version` monotonicity and the `contentHash` match prevent this.

---

# 8. Caching and freshness

## 8.1 `ttl` and `exp`

| Claim | Tamga value | Meaning |
|---|---|---|
| `ttl` | the publication interval (`120`) | The verifier may use it for this long without refetching; then it should fetch a fresh one |
| `exp` | `iat + 6 hours` | After this moment the token must not be used at all |

The meaning of the two claims comes from the Token Status List draft (draft-20): `ttl` is the maximum time a consumer may keep
the token cached **before it should fetch a fresh copy** (a refresh hint); `exp` is the moment the token stops being valid
(the absolute limit). Tamga keeps them apart:

- `ttl` = the publication interval. The verifier fetches a fresh token every interval; a revocation shows within minutes
  (§5.3).
- `exp` = `iat + 6 hours`. If the status server goes down, the verifier can keep verifying with the last token for up to 6
  hours; the result does not fall to COULD NOT VERIFY at once.

**Why 6 hours:** it equals the maximum token age of verifier policies (`max_status_token_age_sec`, 21,600 s in the reference
policies); a policy would not use a longer `exp` anyway. `exp` also bounds the window in which an old but signed token can be
replayed: someone controlling the network path can hide a revocation for at most this long (the anchor check, §7 Ş6, narrows
it further for a verifier that knows the current anchor). The earlier 50-hour target would have widened this window for no
benefit.

**Consistency with the anchor:** the anchor is updated at every publication. While the status server is down there is no new
publication and no new anchor; the verifier's token matches the last anchor and is used until `exp`. If the server is up but
the verifier cannot fetch the list, the anchor is newer than the token and the result is COULD NOT VERIFY (§7 Ş6; not a
rollback). So the long `exp` helps only in a real outage and does not hide a revocation from a verifier that knows the
current anchor.

> **Verifier package:** `@tamga-network/sd-jwt` 0.3.0 treats a token as stale after `iat + 2 × ttl` (D4, COULD NOT VERIFY).
> For verifiers on that version the outage buffer takes effect with the next patch release, which leaves the limit to `exp`
> and the policy; until then the behaviour is unchanged (COULD NOT VERIFY within minutes during an outage).

**The claims decide.** The standard requires the verifying party to give precedence to the token's `exp` and `ttl` claims
over HTTP cache headers. The CDN's `Cache-Control` header cannot override this.

## 8.2 Per-schema freshness thresholds

A verifier may be stricter depending on the risk level:

| Risk | Maximum accepted token age |
|---|---|
| Low | up to `exp` (6 hours) |
| Medium | 1 hour |
| High (official transaction) | a few publication intervals (≤ 10 minutes), and `version` exactly matching the chain anchor |

## 8.3 Offline verification

If the chain anchor (Ş6) cannot be read, verification cannot be completed. In offline mode the verifier:

- May continue with the cached token and the last known anchor,
- Must show the user the **time of the last synchronisation**,
- Marks the result as "verified offline".

---

# 9. Privacy

## 9.1 Fetching per verification is forbidden

**This is the most important privacy rule.**

If the verifier does `GET <uri>` at every verification, the Status Provider learns:

> "Right now someone is verifying a credential from my list X."

The source IP gives the verifier away. A university could learn this way which employers its graduates apply to — a new
tracking channel that paper diplomas do not have.

**Rule:** verifiers obtain Status List Tokens through **scheduled bulk prefetching** (recommended: within the `ttl`
interval), not at verification time. Verification is done from the cache.

The `@tamga-network/verifier` SDK makes this behaviour the **default**; fetching per verification must be possible only when
explicitly enabled ([[ARCH-0005]]).

## 9.2 List aggregation

The standard defines an optional aggregation mechanism that lets the issuer publish its list URIs collectively
(`aggregation_uri`).

**Recommended** in Tamga: the verifier can discover and bulk-download all of an issuer's lists from one address. This makes
§9.1 practical.

## 9.3 Herd privacy

The fewer indices a list has, the more distinguishing `idx` is. That is the reason for the minimum capacity of 100,000 in §6.2.

**The small-institution problem:** a vocational school with 300 graduates means 300 filled indices in a list of 100,000.
The list is large but the herd is small. In that case the herd is bounded by the **institution**, not by the list, and there
is no technical fix — the `iss` claim names the institution openly anyway.

Recorded as an accepted limitation.

## 9.4 Unsolved: `idx` correlation

The `idx` + `uri` pair is fixed and `sd: never`. A graduate who presents the same diploma to two different verifiers can be
matched if those two verifiers collude.

This is a known, structural limit of the Token Status List. The fix is **batch issuance**: a separate credential copy with a
different `idx` for each presentation ([[SPEC-CRED-0001]] §5, [[SPEC-SCHEMA-0002]] §2.1.3).

**This is an accepted risk in the initial stage and must be disclosed openly to pilot participants** → PM-GTM-0001.

---

# 10. Operations

## 10.1 Component

| Property | Value |
|---|---|
| Address | `status.<issuer-domain>` |
| Content | Static file (signed token), behind a CDN |
| Writing | Publication job (cron), at a fixed interval (every 2 minutes, §5.1) |
| Key | Status signing key, online, separate from the credential key (§3.4) |
| Availability target | 99.5% — with the `exp` = 6 h buffer not on the critical path during short outages (§8.1) |

It is a separate component for every issuer and is part of the issuer onboarding checklist ([[ARCH-0004]]).

## 10.2 Small institutions and centralisation risk

Running a status server can be heavy for small institutions. Tamga can offer hosting — **but then Tamga sees every
revocation in the network.**

This is a real centralisation point and is governed by policy in [[PM-GOV-0001]] decision P1: the signing key stays with
the institution (the foundation cannot publish a fake status), no access log is kept, the list of hosted issuers is public,
and if they exceed 30% of active issuers the matter goes to the council agenda.

**Operation today (as of 2026-10-09):**

- **Key separation:** every issuer's status key is separate from its credential signing key (S11); it is published in the
  trusted list under `delegate_keys[]` with `purpose: "status_list"` and its own fingerprint. Even a compromised status key
  cannot produce a fake credential (§3.4).
- **Where the key sits:** the only active revocation list on the real network today is the network's provisional identity
  service's own list; there the issuer is the network itself and the key sits with the issuer. No list hosted on behalf of
  another institution is active on the real network. The test institutions' keys in the sandbox stay in the sandbox (test
  keys). When a real institution joins the hosted service, its status key, like its credential signing key, moves to the
  institution's own key management (KMS) (P1.a); this is a precondition of that institution's pilot.
- **Access log:** no access log is kept for the revocation list endpoints (`status.<domain>/…` and the identity service's
  `/status/…` path) (P1.b). The access log of the network's other services contains no IP addresses.

## 10.3 Disaster scenarios

| Scenario | Effect | Recovery |
|---|---|---|
| Status server outage | Continues from cache for up to 6 hours (`exp`, §8.1) | The server comes back |
| Loss of the status key | No new publication possible | New key + `kid` rotation; the same list continues |
| Compromise of the status key | Fake status can be published | Certificate revocation → every token fails at Ş4 → republication with a new key |
| Loss of the list file | Verification stops | The bitstring is regenerated from the issuer database; **the `contentHash` on the chain is kept to verify past versions** |

The last row requires the issuer to keep its revocation queue permanently. The list is a derived product; the source is the
database.

---

# 11. Invariants

| # | Invariant |
|---|---|
| **S1** | There are no revocation bits on the chain; only the anchor. |
| **S2** | `bits` is always `2`. |
| **S3** | `version` increases monotonically; a decreasing version is rejected. |
| **S4** | A publication is registered on the chain **after** it has been written to the CDN (§5.2). |
| **S5** | Published at a fixed interval even if nothing changed (§5.1). |
| **S6** | No publication outside the interval ("emergency"). Only exception: when the service restarts and there is no published token, or it expires in less than one interval, it is republished at once — the content does not change and the timing is not tied to a revocation event, so the information S6 protects (when a revocation happened) does not leak. |
| **S7** | `idx` is allocated at random; no sequential counter (§6.1). |
| **S8** | The list URI is opaque; it encodes no year, department or cohort (§6.3). |
| **S9** | Lists are split by no criterion other than type (§6.4). |
| **S10** | List capacity ≥ 100,000; fill ≤ 80%. |
| **S11** | The status key is separate from the credential signing key (§3.4). The certificate fingerprint of the status key is published in the trust list in the institution entry's `delegate_keys[]` field with `purpose: "status_list"`; at D3 the verifier matches the token signer against this entry (no entry → INDETERMINATE, mismatch → REJECTED). An `idx` outside the list is not read as valid (D6 REJECT). |
| **S12** | The verifier does not fetch per verification; it uses bulk prefetching (§9.1). |
| **S13** | The `exp`/`ttl` claims override HTTP cache headers. |
| **S14** | "Invalid" and "could not verify" are shown to the user differently (§7.1). |

---

# Open topics

1. ~~Chain load of writing to the chain once an hour with `ttl = 3600`~~ — **CLOSED** (2026-09-09, [[ARCH-0004]] §7).
   1,000 issuers = 24,000 transactions a day = **0.28 TPS**; with 2 s blocks, 0.55 transactions per block. Negligible for
   QBFT. Persistent state does not grow either: `publishList` overwrites the existing slots. What actually grows is the
   archive history, ~1.8 GB a year.
2. How is a return from suspension (`0x02`) to valid represented in the verifier's audit log? Is a retrospective "was it
   suspended at that moment" query needed?
3. ~~The 1% initial noise of §6.2~~ — **CLOSED** (2026-10-09): the rule was removed; since a valid bit and an unused index
   are the same (`0x00`), it had no observable effect (§6.2).
4. Should Status List Aggregation be mandatory? Today it is "recommended"; if the verifier side takes prefetching seriously,
   making it mandatory may make sense.
5. Are multiple Status Providers (several lists of one issuer on different servers) supported? Implicitly yes today; should
   it be written explicitly?
6. ~~Publication interval and `exp` buffer~~ — **CLOSED** (2026-10-09): the interval stays short (2 minutes, `ttl` = the
   interval), `exp` = `iat + 6 hours` (§5.1, §8.1).
7. ~~Hosted status service~~ — **CLOSED** (2026-10-09): the policy (P1.a, P1.b) stands; the access log of the revocation list
   endpoints was switched off and where the key sits is described in §10.2.

---

# Related documents

[[ADR-0008]] · [[SPEC-CRED-0001]] · [[SPEC-CRED-0002]] · [[SPEC-SCHEMA-0001]] · [[SPEC-SCHEMA-0002]] · [[SPEC-BC-0001]] ·
[[SPEC-ID-0002]] · [[PM-TRUST-0001]] · [[ARCH-0004]] · [[ARCH-0005]] · [[PM-GOV-0001]] · PM-GTM-0001

---

# Status

**In force** — version 1.0.0 (2026-10-02).
