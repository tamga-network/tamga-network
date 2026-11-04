# contracts/ — Tamga Network trust layer

Solidity registries for the chain stage of Tamga Network (Hardhat 3, TypeScript tests, solc 0.8.24, OpenZeppelin 5.6, UUPS
proxies). Specification: `docs/ledger/specifications/0001-trust-layer-contracts.md` (SPEC-BC-0001).

> **Status:** compiled and tested; **no production chain exists**. A Besu/QBFT chain opens only with a second independent
> validator operator (ADR-0009 K4). Today the trust anchor is the signed trust lists and the anchor log; the chain is their
> projection (ADR-0051, ADR-0073, ADR-0074).

## Commands (from the repository root)

```bash
npm run contracts:install        # pinned dependencies (contracts/package-lock.json)
npm run contracts:compile
npm run contracts:test           # mocha + ethers on the in-process Hardhat network
npm run contracts:check          # UUPS safety (static) + storage layout baseline + exported ABI is current
npm run contracts:storage-check  # storage layout comparison only (storage-layout/)
npm run contracts:slither        # static analysis (needs slither-analyzer + solc 0.8.24, see scripts/slither.mjs)
```

Local chains: `npm run contracts:node` + `npm run contracts:deploy:dev` (Hardhat node, `deployments/localhost.json`), or the
Docker-free Besu QBFT dev network `npm run chain:besu:init|start|deploy|status|stop|reset` (Windows script
`scripts/besu-dev.ps1`, chainId 31338, RPC `127.0.0.1:8546`; other platforms: ARCH-0002). Accounts are Hardhat's public test
mnemonic — local only. Deployment records (`deployments/`), build output and the dev network's keys and data are git-ignored.

## Layout

```
src/base/TamgaRegistryBase.sol          sovereignty, daily quota, UUPS authorisation
src/base/MigrationWindow.sol            one-time migration window (ADR-0073 K1), ERC-7201 storage
src/base/StatusHistory.sol              append-only status windows, half-open (ADR-0073 K5)
src/governance/Governance.sol           membership, 2/3 votes, typed proposals, upgrade queue (SPEC-BC-0001 §1)
src/identity/RootCARegistry.sol         national root CA anchors (§2)
src/registry/IssuerRegistry.sol         issuers and schema authorisation windows (§3)
src/schema/SchemaRegistry.sol           schema anchors, network and national tiers (§4)
src/recognition/CrossRecognition.sol    unilateral recognition (§5)
src/registry/RelyingPartyRegistry.sol   relying parties and request scopes (§6)
src/revocation/StatusListRegistry.sol   status list anchors — no bitmap, no isRevoked (§7)
src/anchor/TrustListAnchorRegistry.sol  signed list version + anchor log head (§15)
src/network/NetworkRegistry.sol         network-level records: wallet providers, ZK circuits, external lists … (§16.5)
src/TrustQueries.sol                    verifier facade (§11.2)
scripts/                                deployment, ABI export, UUPS and storage layout checks, Slither runner
storage-layout/                         storage layout baseline (update only after a reviewed layout change)
test/                                   unit, property and invariant tests (test/mocks: test-only contracts)
```

## Rules that the tests enforce

- **No personal data on chain** (DP1): `test/privacy-abi.test.ts` rejects ABI fields with personal or credential meaning, new
  `string` fields and free `bytes`. There is no `isRevoked`: revocation lives in the off-chain status list (ADR-0008).
- **Sovereignty** (N1): a national record is written only by that state's delegate keys; network-level records only through
  Governance proposals.
- **Upgrades** (§9): storage layout only grows; `contracts:check` fails on a reordered, removed or retyped slot. No contract is
  deployed yet, so the baselines in `storage-layout/` are updated with `npm --prefix contracts run storage:update` after a
  reviewed layout change; **the snapshots are frozen at the first production deployment** and from then on change only with a
  published upgrade.
- **Migration window** (ADR-0073 K1): no registry upgrade while a window is open; `contracts:check` pins
  `MigrationWindow.sol` (source digest, ERC-7201 slot; `node scripts/check-upgrade-safety.mjs --update-pin` after a reviewed
  change) and refuses inline assembly anywhere else.
- **Static analysis:** `npm run contracts:slither` must report 0 results; a false positive is excluded inline
  (`// slither-disable-next-line <detector>`) with a reason.
- Shared errors live in `src/interfaces/ITamgaErrors.sol` (declaring one error in two interfaces breaks compilation).

## Licence

Apache-2.0 (repository `LICENSE`).
