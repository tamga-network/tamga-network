# network/ — Besu network configuration

> **Status: skeleton.** Not used today; filled in at the chain stage (ADR-0009 threshold: a second independent validator operator).

Run configuration of Tamga Network's permissioned Besu/QBFT network: genesis, QBFT settings, local permissioning, node
definitions. Step-by-step setup: ARCH-0002 (`docs/ledger/architecture/0002-besu-network-setup-step-by-step.md`); permissioning
decision: ADR-0052 (local `permissions_config.toml`, generated from chain state — never edited by hand).

```text
network/
├── genesis/       genesis.json (chain ID, QBFT config, validator set)          — planned
├── qbft/          QBFT parameters (block time, epoch)                           — planned
├── permissions/   validator node declarations (enode + host:port)               — planned
└── dev/           local single-validator dev network, produced by scripts/besu-dev.ps1
                   (genesis.json, keys/, data/ are git-ignored)
```

## Local development network (no Docker)

`npm run chain:besu:init|start|status|stop|reset` (Windows, `scripts/besu-dev.ps1`): one validator, chainId 31338, RPC
`127.0.0.1:8546`; deploy the contracts with `npm run chain:besu:deploy`. Linux/macOS steps: ARCH-0002 "Local development network".
Besu runs directly on JDK 25.

## Phases (ARCH-0001 §3)

- **Phase 0:** opens only with the written acceptance of at least two **independent** validator operators; before that, phase B
  signed lists (ADR-0009 K4). A single-operator chain is not set up.
- **Phase 1:** state nodes join by QBFT vote.
- **Phase 2:** institutions run full (non-signing) nodes.
