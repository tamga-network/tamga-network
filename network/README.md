# network/ — Besu network configuration

> **Status: preparation.** No production chain today; it is set up at the chain stage (ADR-0009 threshold: a second independent
> validator operator). The tools and examples here are tried on local development networks.

Run configuration of Tamga Network's permissioned Besu/QBFT network: genesis, QBFT settings, local permissioning, node
definitions. Step-by-step setup: ARCH-0002 (`docs/ledger/architecture/0002-besu-network-setup-step-by-step.md`); permissioning
decision: ADR-0052 (local `permissions_config.toml`, generated from chain state — never edited by hand).

```text
network/
├── genesis/       genesis.json (chain ID, QBFT config, validator set)          — planned
├── qbft/          QBFT parameters (block time, epoch)                           — planned
├── permissions/   node declarations (schema, examples, nodes/) — input of `npm run trust:chain-permissions -- render|check`
├── rpc-proxy/     JSON-RPC behind mutual TLS: nginx example + method filter (eth/net/web3 only)
└── dev/           local development networks, produced by scripts/besu-dev.ps1 (git-ignored):
                   genesis.json, keys/, data/ (single validator) and perm/ (two-node permissioned network)
```

## Local development networks (no Docker)

- **Single validator:** `npm run chain:besu:init|start|status|stop|reset` (Windows, `scripts/besu-dev.ps1`): chainId 31338, RPC
  `127.0.0.1:8546`; deploy the contracts with `npm run chain:besu:deploy`.
- **Two-node permissioned network** (ADR-0052): `scripts/besu-dev.ps1 -Init|-Start [-Node 2]|-Apply|-Status|-Stop|-Reset
  -Permissioned` — both permissioning flags on, the allowlists rendered from the chain (`-Apply`), validator added and removed by
  QBFT vote (`apps/trust-publisher/scripts/besu-permissions-smoke.ts`). ARCH-0002 "Yerel izinli ağ".

Linux/macOS steps: ARCH-0002 "Local development network". Besu runs directly on JDK 25.

## Phases (ARCH-0001 §3)

- **Phase 0:** opens only with the written acceptance of at least two **independent** validator operators; before that, phase B
  signed lists (ADR-0009 K4). A single-operator chain is not set up.
- **Phase 1:** state nodes join by QBFT vote.
- **Phase 2:** institutions run full (non-signing) nodes.
