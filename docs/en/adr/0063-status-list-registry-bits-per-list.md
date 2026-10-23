---
document_id: ADR-0063
title: "The on-chain status list registry accepts the list's own bit size"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-23
last_updated: 2026-10-23
summary: >
  The on-chain status list anchor contract (`StatusListRegistry`) so far accepted only `bitsPerEntry = 2`, while ADR-0048 ties
  the bit size to the credential type (identity service types 1, institution lists 2). Because the chain is a projection of the
  signed lists (ADR-0051), the contract accepts the list's own `bits` value: 1, 2, 4 or 8, as allowed by IETF Token Status List.
  The value is written once at registration, never changes and is emitted in the registration event. The contract does not know
  the credential type; no type, schema or bit content is written to the chain. The Tamga profile (1 or 2) stays in the publisher
  and the verifier. Changes SPEC-BC-0001 L3. There is no production chain (ADR-0009 K4); the change applies to the local
  development and test chain. Accepted: 2026-10-23.
domain: Trust
related: ["[[ADR-0008]]", "[[ADR-0009]]", "[[ADR-0048]]", "[[ADR-0051]]", "[[SPEC-BC-0001]]", "[[SPEC-CRED-0003]]"]
translation_of: ADR-0063
source_version: 1.0.0
---

# In short

The identity service's status lists use 1 bit per entry, institution lists 2 bits. The on-chain registry contract accepted only
2 bits, so identity lists could never be registered on chain. The contract now records the list's own bit size (1, 2, 4 or 8, as
the standard allows). Only the list's address, hash, version and size go to the chain; there is no personal data.

# Context

- **ADR-0048 K1–K2.** The bit size of a status list depends on the type: the identity service's types (identity credential,
  driving licence information, contact credentials) use `bits = 1`, institution lists `bits = 2` ([[SPEC-CRED-0003]] §3.3).
  The packages publish this way since 0.6.0.
- **Contract.** `StatusListRegistry.registerList` rejected any list with `bitsPerEntry != REQUIRED_BITS (2)` with
  `InvalidBitsPerEntry` ([[SPEC-BC-0001]] §7, L3 "`bitsPerEntry == 2`"). When the list history is replayed into the contracts in
  Phase 0 ([[ADR-0009]] K7), the identity service's lists could not have been registered.
- **The chain is a projection** ([[ADR-0051]]): the signed list is the source, the chain follows it. A contract imposing a bit
  size different from the signed list contradicts this principle.
- **Standard.** IETF Token Status List allows 1, 2, 4 and 8 for `bits`. The network will later carry issuers of other states
  as well (TDT-first); the contract should not be locked to the two values of today's Tamga profile.

# Decision

## K1 — The list's own bit size

- `registerList` accepts **1, 2, 4 or 8** as `bitsPerEntry`; any other value is rejected with `InvalidBitsPerEntry`. The
  `REQUIRED_BITS` constant is removed and replaced by the pure read `isAllowedBits(uint8)`.
- The value equals `status_list.bits` in the signed token of the registered list. It is written once at registration;
  `publishList` takes no bit size and a new version cannot change it (if the bit size must change, a new list is opened, S9).
- The `ListRegistered` event also carries the bit size: `ListRegistered(listId, issuerId, listURI, listSize, bitsPerEntry)`.

## K2 — Type information does not go on chain

- The contract neither knows nor asks for the credential type, the schema or `suspension_allowed`. The rule "the identity
  service's list must use 1 bit" ([[ADR-0048]]/SU1) belongs to the publisher and the verifier; the chain only records how the
  list describes itself.
- There is no status bit, index, credential hash or personal data on chain ([[ADR-0008]], DP1); this decision does not change that.

## K3 — Projection and verification

- The trust list publisher's projection module derives the registration parameters from the signed token
  (`statusListRegistrationOf`: `sub` → address, `status_list.bits` → bit size, inflated bytes × 8 / bits → capacity,
  `sha256(jws)` → hash). A non-standard bit size is an error.
- The Tamga profile does not change: Tamga publishers publish only 1 or 2, the Tamga verifier reads only these
  ([[SPEC-CRED-0003]] §3.3). The contract accepting 4 and 8 adds no new value to the Tamga profile.

## K4 — Implementation

- `contracts/src/revocation/StatusListRegistry.sol`, `IStatusListRegistry.sol`, contract tests; the projection helper in
  `apps/trust-publisher` and its test. The storage layout does not change (a constant takes no storage). There is no production
  chain ([[ADR-0009]] K4); the change applies to the local development and test chain; per the development-phase rule there is no
  migration code ([[ADR-0029]]).

# Options considered

| Option | Result | Why |
|---|---|---|
| Keep `REQUIRED_BITS = 2`, do not register identity lists on chain | rejected | The projection stays incomplete; identity lists would have no anchor in Phase 0 |
| Accept only 1 and 2 (Tamga profile) | rejected | The profile rule lives in the publisher and the verifier; the contract also serves other states of the network, and the standard says 1, 2, 4, 8 |
| Check the bit size per credential type in the contract | rejected | Puts type information on chain; the contract cannot link a schema to a list (lists are per type, but the type name is not on chain) |
| **The list's own bit size, within the standard's set** | **chosen** | The chain follows the signed list; the record does not change; no personal data |

# Invariants

| Code | Rule |
|---|---|
| BL1 | The on-chain status list record holds the list's own `bits` value; the value is 1, 2, 4 or 8, is written once at registration and does not change for the life of the list. |
| BL2 | No credential type, schema, status bit or personal data is written to the status list record; the per-type bit rule is enforced by the publisher and the verifier. |

# Consequences

- [[SPEC-BC-0001]] §7.1 (`bitsPerEntry` comment, `isAllowedBits`), §7.4 and §13 L3; [[SPEC-CRED-0003]] §4 contract interface.
- Code: `contracts/`, `apps/trust-publisher/src/chain/projection.ts`.

# Status

**Accepted — 2026-10-23.** Within project management's general conformance approval ("let us be compatible with EU standards,
close our gaps, do it the way it should be done"): a correction aligning the contract with [[ADR-0048]] and [[ADR-0051]].
DECISIONS: D-BC-11. Changes [[SPEC-BC-0001]] L3; BL1–BL2 are binding.
