# Contracts — review package (chain stage)

The Solidity registries are the designed on-chain projection of the signed trust lists (ADR-0051) and, in phase 0, the national
registries (SPEC-BC-0001). **No production chain exists** (ADR-0009 K4: opens with a second independent validator operator).
They hold no funds; the assets are authority and integrity — which state writes which record (sovereignty, N1), who is a
recognised issuer / verifier, which signed list version is anchored, and that no personal data reaches the chain (DP1).

Since 2026-11-04 `contracts/`, `network/`, `docs/ledger/` and this package are in the public repository (ADR-0074 K6).

## Scope

```
contracts/src/base/TamgaRegistryBase.sol        contracts/src/registry/IssuerRegistry.sol
contracts/src/governance/Governance.sol          contracts/src/registry/RelyingPartyRegistry.sol
contracts/src/identity/RootCARegistry.sol        contracts/src/recognition/CrossRecognition.sol
contracts/src/schema/SchemaRegistry.sol          contracts/src/revocation/StatusListRegistry.sol
contracts/src/schema/VctNamespace.sol            contracts/src/anchor/TrustListAnchorRegistry.sol
contracts/src/TrustQueries.sol                   contracts/src/interfaces/*.sol
```

Supporting context: `contracts/scripts/lib/deploy.ts` (deployment order), `contracts/scripts/check-*.mjs`,
`apps/trust-publisher/src/chain/*` (off-chain anchor submitter / checker). Out of scope: OpenZeppelin 5.6.1 (unmodified, pinned),
tests, `contracts/deployments/`. Specification: SPEC-BC-0001 (`docs/ledger/specifications/0001-trust-layer-contracts.md`,
Turkish) and ADR-0002, 0007, 0008, 0009, 0051 … 0055, 0063.

## State of the audit-prep checklist (first internal round 2026-10-19 → now)

| Item | State |
|---|---|
| Slither | ✓ in CI (`contracts-slither`), 0 results (2026-11-04): detector-level exclusions justified in `contracts/slither.config.json`; four false positives excluded inline with a reason (`// slither-disable-next-line`) |
| Compiler warnings | ✓ none (solc 0.8.24, optimizer 200, evm shanghai) |
| Coverage | ✓ ~93 % lines (`npx hardhat test --coverage` from `contracts/`), not gated in CI |
| Invariant / fuzz tests | ✓ `contracts/test/invariants-fuzz.test.ts` (2026-10-29): seeded random action sequences — StatusListRegistry against a shadow model (immutability of `issuerId` / `listURI` / `listSize` / `bitsPerEntry`, strict version increase, non-decreasing `publishedAt`, only the issuer's delegate writes, retired lists frozen, daily quotas 48 / 8, content-hash match only when active and published); TrustListAnchorRegistry (only anchorers write, highest confirmed version never decreases, confirmed anchors immutable, confirmation needs ≥ threshold distinct *current* anchorers, `isListAnchored` true only for the confirmed hash); Governance upgrade delay (implementation slot changes only via a queued proposal after 7 days with a recounted 2/3 threshold; direct `upgradeToAndCall` refused on every proxy) and membership (`activeMemberCount` = number of ACTIVE members, a delegate key belongs to at most one state, a validator address to at most one active state, removal only with ≥ 3 members, last member cannot withdraw). Migration window (2026-11-04, `contracts/test/migration-invariants-fuzz.test.ts`): status history order, ordinary write vs replay, executor powers. 243 contract tests |
| Privacy (DP1) | ✓ ABI-level test `contracts/test/privacy-abi.test.ts` — no write function takes a person / credential field; strings only institutional URIs and versions (reasons are `bytes32` digests since 2026-11-04) |
| Decisions on the 2026-10-19 findings | ✓ ADR-0053 (anchor candidates, `AnchorConflict`), ADR-0054 (namespaces, cross-state binding, quotas), ADR-0055 (upgrade queue + 7 days, typed admin proposals) |
| Spec drift | ✓ SPEC-BC-0001 updated (F-19) |
| Dead code / small events (F-18 remainder) | ☑ 2026-11-04: version step capped (`MAX_VERSION_STEP`, no `2^64-1` freeze), `SchemaNotAuthorized` removed (`CANCELLED` / `ProposalCancelled` re-added on 2026-11-04 for proposal withdrawal), events filled (`SchemaRegistrySet`, `DelegateKeysSet` with keys, `StateRemoved` with a reason digest) |
| Test typing | ☐ contract tests are not type-checked (untyped `BaseContract`) |
| Mutation testing | ☐ none |
| Frozen version | ☐ tag `contracts-audit-1` on the development repository when the engagement is agreed |

## Previous findings (2026-10-19, all closed)

F-01 (high) member counter double-decrement and stale votes → votes recounted from current members at execution · F-02 (high)
a state's validator could take another state's delegate key → a key belongs to one state · F-03 binding to a retired / revoked CA
· F-04 one validator address for two states · F-05 anchor first-writer squatting → candidates (ADR-0053) · F-06 schema
authorisation windows lost on re-grant · F-07 / F-10 quota scope → ADR-0054 · F-11 schema-name squatting, F-12 cross-state
binding → ADR-0054 · F-13 anchorer rotation / threshold → ADR-0053 AC4 · F-14 / F-15 upgrade delay and typed admin → ADR-0055 ·
F-08, F-09, F-16, F-17 small · F-19 spec drift. Full table: internal security record of 2026-10-19 (shared on request).

## Questions for the reviewer

1. Is re-evaluating the threshold at `execute` against current members the right model, or should votes be snapshotted?
2. Is the anchor candidate model (ADR-0053) sufficient against an anchorer who equivocates across versions?
3. Is the 7-day queue (and the 30-day window after it) adequate for an upgrade of Governance itself?
4. Cross-recognition: any path where one state's records change another state's verification results without consent?

Invariant → test catalogue for SPEC-BC-* and ADR-0051 … 0055: [`contracts-invariants.md`](contracts-invariants.md) (generated
with `node scripts/audit-invariant-map.mjs --contracts`).
