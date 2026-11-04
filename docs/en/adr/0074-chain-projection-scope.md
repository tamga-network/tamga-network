---
document_id: ADR-0074
title: "Projection scope 0.8: every trust record in the signed lists on chain"
status: Proposed
review_status: Draft
version: 1.0.0
created: 2026-11-04
last_updated: 2026-11-04
summary: >
  Proposes to which contract, with which field and event, the records that are in the signed lists but have no counterpart on chain
  are projected (terminal groups, the registration certificate status list, XML and LoTE views, list signers, wallet providers, ZK
  circuits, external lists, credential categories, the list operator, issuer class and registration data). Boundary: no personal
  data and no free text go on chain; registration details only as a digest (`bytes32`) and the existing `metadataURI` pattern; no new
  `string` field. Network-level records are written by Governance proposal. The registration certificate status list and the list
  views enter the anchor log as new line types. The read path `ChainTrustSource` + indexer lives under `apps/`. The sandbox is not
  written to the chain. `contracts/` goes into the public repository. New names await approval. Proposal; acceptance rests with
  project management.
domain: Trust
related: ["[[ADR-0009]]", "[[ADR-0015]]", "[[ADR-0024]]", "[[ADR-0032]]", "[[ADR-0036]]", "[[ADR-0038]]", "[[ADR-0051]]", "[[ADR-0055]]", "[[ADR-0066]]", "[[ADR-0068]]", "[[ADR-0069]]", "[[ADR-0070]]", "[[ADR-0073]]", "[[SPEC-BC-0001]]", "[[SPEC-TRUST-0001]]"]
translation_of: ADR-0074
source_version: 1.0.0
---

# In short

The chain is a second register of the signed lists; whatever the lists say, the chain must say too. Today part of the lists
(terminal groups, wallet providers, external lists, the revocation list of registration certificates, the list operator and
registration details) is not on chain at all. This proposal says where and how each of them is written on chain. Personal details
and descriptive text do not go to the chain; a short "fingerprint"-like digest is written instead and the text itself stays in the
signed list. It is proposed for the 0.8 package line.

# Context

- [[ADR-0051]] made the chain a projection of the signed lists (CH1) and today it writes only the digest of the list versions and
  of the anchor log head; writing to the registry contracts was left to the phase 0 replay. [[ADR-0073]] makes that replay achievable.
- [[SPEC-TRUST-0001]] §7 maps list fields to contract calls; for `wallet_providers[]` and `zk_circuits[]` it says "not on chain yet —
  ADR candidate". Left out of the mapping in the 2026-11-04 comparison:
  - **F6:** terminal groups ([[ADR-0069]]), the registration certificate status list ([[ADR-0068]]), the ETSI XML view and
    `xml_signing_keys` ([[ADR-0066]]), LoTE views are not on chain.
  - **F7:** the LOTL's wallet providers, ZK circuits ([[ADR-0032]]), external lists ([[ADR-0036]]) and `eaa_categories` are missing.
  - **F8:** the list operator `operator {name, status, on_behalf_of}` ([[ADR-0070]]), registration data ([[ADR-0024]]), issuer class
    (`class`) and `revocation_policy_uri` are not on chain; the contract only has `nameHash` and `metadataURI`.
  - **F9:** the sandbox ([[ADR-0038]]) anchor log and lists are reset every night; on chain versions and sequence numbers only go
    forward and are never deleted ([[ADR-0051]]/CH4).
- [[ADR-0051]] open issues 4 (`ChainTrustSource` + indexer) and 5 (`contracts/` into the public repository) are in this proposal.
- **Project management direction (2026-11-04):** scope "everything on chain" — terminal groups, the registration certificate status
  list, wallet providers, external lists, ZK circuits, credential categories and registration details included. Boundary: no personal
  data and no free text on chain; registration details as a digest or an address. Openness: the guide, the PDF, the documentation
  concept page and `contracts/` are public.

# Proposed decision

## K1 — Scope principle and data boundary

- Every record in the signed lists (LOTL, national lists, anchor log) that affects a trust decision maps to a contract record or an
  anchor on chain. The list stays the source; on conflict the list prevails ([[ADR-0051]] CH1).
- Only identifier digests, fingerprints, closed-set values, numbers, dates, state codes and addresses are written to the chain. Free
  text (name, trade name, description, purpose, note, label, reason) and registration details (tax number and other identifiers,
  postal address, contact, policy and information addresses, supervisory authority) are written only as a **detail digest**: the
  SHA-256 of the canonical JSON (RFC 8785) of the relevant field block in the signed list. Where a pointer to the whole record is
  needed, the existing `metadataURI` field is used.
- ABI: new fields are `bytes32`, integers, `bool`, `bytes2` or `address`; there is no new `string` field and no free `bytes`; the
  allow list of the `privacy-abi` test does not grow. Only fields needed for a query or for equivalence are added to a contract;
  struct fields are appended (UUPS storage layout, `__gap`).
- Never: identity, credential, credential digest, revocation bit, pseudonym, device or wallet instance identifier (DP1, TL11).

## K2 — National lists (F6, F8)

| List field | Contract | On chain |
|---|---|---|
| `issuers[].class` | `IssuerRegistry` | closed set `PUB`, `QUALIFIED`, `EAA` (append only) |
| `issuers[]` registration data ([[ADR-0024]]: `trade_name`, `identifiers`, `postal_address`, `info_uri`, `contact`, `service_description`, `supervisory_authority`) | `IssuerRegistry` | registration data digest; `is_public_sector_body` → `bool`; `entitlements` → closed-set bit mask |
| `issuers[]` operational addresses (`issuer_url`, `status_list_base`, `revocation_policy_uri`), `assurance_basis`, `authentic_source`, `delegate_keys` | `IssuerRegistry` | detail digest (list `delegate_keys` are signing key fingerprints; not confused with chain delegate addresses) |
| `relying_parties[]` registration data | `RelyingPartyRegistry` | registration data digest, `bool`, bit mask (same rule) |
| `relying_parties[].uses_intermediaries`, `served_relying_parties` | `RelyingPartyRegistry` | arrays of `rpId` ([[ADR-0073]] K4) |
| `relying_parties[].pseudonyms` | `RelyingPartyRegistry` | closed set `single`, `multiple` |
| `relying_parties[].terminal_groups[]` ([[ADR-0069]]) | `RelyingPartyRegistry` | group record: `keccak256(group_id)` (unique across the network, TG1), institution link (`issuerId` or `rpId`), policy identifier digests, terminal certificate fingerprints, `offline_allowed`, validity interval; `label` → digest. A withdrawn group is not deleted; its interval closes |
| `root_cas[]`, `issuers[]`, `relying_parties[]` `legal_name` | existing `nameHash` | unchanged |
| `operator` (in every list) | network-level record (K3) | list operator record |

## K3 — LOTL and network-level records (F6, F7, F8)

- A **new network-level registry contract** is proposed for the LOTL's network-level content (proposed name `NetworkRegistry`,
  **awaiting approval**). Writes only through typed Governance proposals (2/3, [[ADR-0055]]/GE3) or, in the migration mode, through
  the migration executor ([[ADR-0073]] K1).

| LOTL field | On chain |
|---|---|
| `wallet_providers[]` | provider record: `keccak256(provider_id)`, name digest, status windows; WUA signing keys: fingerprint + validity + status. Query: "is this fingerprint currently the WUA key of a listed provider" |
| `zk_circuits[]` | circuit record: `circuit_id`, system (`keccak256("longfellow-libzk-v1")`), version, attribute count, SHA-256 of the circuit file, status; `note` is not written |
| `external_lists[]` | external list record: `keccak256(list_id)`, territory (`bytes2`; country code or `EU`), format (closed set `etsi-lote-json`, `etsi-tl-xml`), pinned signer fingerprints, operator name digest, status; scope: role bit mask, type digests (`vct` / docType), category, assurance, class, recognising states, minimum key storage; approval (`approval`) date and digest (FD4); `list_url` → detail digest |
| `eaa_categories` | category record: `keccak256(code)` + label digest |
| `anchor_signing_keys`, `national_lists[].signing_keys`, `national_lists[].xml_signing_keys` ([[ADR-0066]]) | signer record: list key or state code, purpose (closed set: anchor, JSON list, XML list), fingerprint, validity, status |
| `national_lists[]` slots (`status`, `membership`, `roles`) | slot record: state code, slot status (including `RESERVED`, `PROVISIONAL`), membership type (closed set); role slots: role digest, status, operator digest. Membership and recognition stay in the existing Governance and `CrossRecognition` |
| `operator` (LOTL and every national list) | list operator record: list key (`listKey`), name digest, status (`provisional`, `designated`), `on_behalf_of` digest. A handover changes only this record ([[ADR-0070]]/OP3, [[ADR-0009]] K5) |
| `catalogue.url` | detail digest |
| `pid_providers[]` | empty in the list phase (TL8); once filled, same shape as the wallet provider record |

## K4 — New line types in the anchor log (F6)

The registration certificate status list and the list views are not in the anchor log today. Two new line types are proposed
(**names awaiting approval**):

| Line type (proposed name) | Fields | On chain |
|---|---|---|
| `registration_status` (alternative `wrprc_status`) | `list_uri` (opaque, S8), `content_hash` (SHA-256 of the signed list), `list_version` (the publisher's monotonic counter per list), `published_at` | `anchorList` in the list anchor registry; key `keccak256("tamga:registration-status:<environment>:<n>")` |
| `list_view` | `file` (e.g. `tl-tr.xml`), `format` (`etsi-tl-xml`, `etsi-lote-json`), `source_file` (`lotl`, `tl-<cc>`), `source_version`, `content_hash` (SHA-256 of the file = `.sha2`) | `anchorList`; key `keccak256("tamga:trust-list-view:<environment>:<file>")`, version = version of the source list ([[ADR-0066]] K1: a view is not a separate list) |

- The checkpoint `state` carries these lines too (TL12). No contract change is needed; new key namespaces suffice.
- If a view contradicts its source, the source (JSON list) prevails.
- The loader stops at an unknown line type; hence the order: first the package version that knows the new types, then the new lines.

## K5 — Read path: `ChainTrustSource` and the indexer

- The indexer and `ChainTrustSource` live in a new application: `apps/chain-indexer/` (proposed name, **awaiting approval**). The
  indexer reads contract events and turns records into the in-memory list shape; `ChainTrustSource` implements the same
  `TrustSource` interface ([[ADR-0015]] K3): C1/C2/C3 from contract reads at a pinned block (`TrustQueries`), records from the
  index. If the index is stale or the chain unreachable, the answer is `UNKNOWN` (CMP4).
- `@tamga-network/trust/core` stays light ([[ADR-0015]] K1); no chain client dependency goes there. If third parties need a separate
  package, the proposed name is `@tamga-network/chain` (**awaiting approval**). The list publisher's `trust:chain-check` stays where
  it is.
- The equivalence test of [[ADR-0073]] K6 uses this read path.

## K6 — `contracts/` into the public repository

- Following project management's openness decision (2026-11-04), `contracts/` goes into the public repository.
- **Implementation step:** remove the `contracts/` line and the contract part of the external auditor package
  (`docs/audit/contracts.md`, `docs/audit/contracts-invariants.md`) from `.publicignore`; rerun the public publication check; confirm
  that `contracts/` contains no keys, `.env` or deployment record; keep the README in English and short.

## K7 — The sandbox is not written to the chain (F9)

- Sandbox lists and the sandbox anchor log are not anchored to or replayed into the production chain. `trust:chain-submit` and
  `trust:chain-replay` reject an `environment: sandbox` set on the production chain.
- The sandbox can only be tried on the local development chain; that chain is reset together with the sandbox reset.

# Rationale / alternatives

| Option | Result | Why |
|---|---|---|
| List digests only (today's [[ADR-0051]] K2) | rejected | Against the "everything on chain" direction; no record-level query and no equivalence |
| Write detail text on chain in clear | rejected | Personal data and free text boundary (DP1, TL11); cannot be deleted from a chain |
| Write no details at all | rejected | Whether a detail in the list changed cannot be checked from the chain; a digest makes that possible |
| Spread network-level records over the existing contracts | rejected (proposal) | Wallet providers, ZK circuits, external lists and signers belong to the network, not to any state; one Governance gate |
| Anchor views with a separate version counter | rejected | [[ADR-0066]] K1: a view is a second form of the same publication |
| Anchor the sandbox too | rejected | The nightly reset conflicts with CH4; the test network does not mix into the trust record of the real network |
| Put `ChainTrustSource` in `trust/core` | rejected | The wallet and browser core does not carry a chain client ([[ADR-0015]] K1) |

# Proposed rules (moved into a binding table if accepted)

| Code | Rule |
|---|---|
| PJ1 | Every record in the signed lists that affects a trust decision maps to a record or an anchor on chain; the list stays the source and prevails on conflict. |
| PJ2 | No personal data and no free text are written to the chain; registration details are represented only by a canonical JSON digest and the existing `metadataURI`; no new `string` field and no free `bytes` are added. |
| PJ3 | Network-level records (wallet provider, ZK circuit, external list, credential category, list signer, list operator, slot) are written only by Governance proposal or, in the migration mode, by the migration executor. |
| PJ4 | Sandbox lists and the sandbox anchor log are not written to or replayed into the production chain. |
| PJ5 | List views and the registration certificate status list enter the anchor log as lines and are anchored on chain with the version of their source; if a view contradicts its source, the source prevails. |

# Open questions (for project management)

1. **Name:** is the new network-level contract `NetworkRegistry` (proposal), or should the records be spread over separate contracts
   by type?
2. **Name:** anchor log line types `registration_status` (or `wrprc_status`) and `list_view`.
3. **Name:** `apps/chain-indexer/`; if needed, the package `@tamga-network/chain`.
4. **Openness:** the decision names `contracts/`. Should the Besu network files (`network/`) and the chain phase documents also be public?
5. **Detail digest format:** RFC 8785 canonical JSON + SHA-256 (proposal); the field block boundaries are fixed in a table during
   implementation.
6. **Sandbox:** should the sandbox later get its own resettable test chain? Proposal: no, only the local development chain.

# Consequences

- Contracts (after acceptance, together with [[ADR-0073]]): new fields and terminal groups in `IssuerRegistry` and
  `RelyingPartyRegistry`, the new network-level contract, Governance proposal types, the `privacy-abi` test covering the new
  contract; the sentence "the existing eight contracts do not change" in [[ADR-0051]] K2 is then changed.
- `@tamga-network/trust`: new anchor line types, checkpoint `state`; `apps/trust-publisher`: the projection plan covers the new
  records and the environment check; `apps/chain-indexer/` (subject to name approval).
- Documents: [[SPEC-BC-0001]] (§3, §6, a new section, §13, §15) and [[SPEC-TRUST-0001]] §5 and §7 change after acceptance.
- The chain stays off in production ([[ADR-0009]] K4, [[ADR-0051]] CH5).

# Status

**Proposed — 2026-11-04.** Written on project management's 2026-11-04 direction ("everything on chain", "all open"); acceptance rests
with project management. New names (`NetworkRegistry`, `registration_status`, `list_view`, `apps/chain-indexer/`,
`@tamga-network/chain`) await approval. If accepted, it receives a D-BC code in DECISIONS and rules PJ1–PJ5 become binding.
