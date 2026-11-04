# network/permissions — node declarations

Besu runs with **local permissioning** (ADR-0052): every validator and RPC node has a `permissions_config.toml` with
`accounts-allowlist` and `nodes-allowlist`. The file is never written by hand. Each operator generates it from chain state:

```bash
npm run trust:chain-permissions -- render --out <data-dir>/permissions_config.toml [--operator <CC>]
npm run trust:chain-permissions -- check --node-rpc http://127.0.0.1:8545   # the node's own admin endpoint only
```

| List | Source |
|---|---|
| accounts | active members' validator addresses and delegate keys (`Governance`), delegates of operational issuers (`IssuerRegistry`), list anchorers (`TrustListAnchorRegistry`), the executor of an open migration window |
| nodes | declarations in `nodes/` whose key matches an **active** validator address in `Governance`; with `--operator <CC>`, that operator's own `rpc` nodes |

`render` prints `sha256` (the file) and `shared_sha256` (the file without the operator's own RPC nodes). All validators must have
the same `shared_sha256` (LP3); a difference is an operational incident.

## Declaration format

One JSON file per node in `nodes/` (`<cc>-<name>.json`), schema `schema/node-declaration.schema.json`, examples in `examples/`.

| Field | Rule |
|---|---|
| `format` | `tamga-node-declaration/1` |
| `state` | Governance member code (`TR`, `KZ`, …) |
| `role` | `validator` (in every operator's file) or `rpc` (only in the declaring operator's file) |
| `node_public_key` | enode id: uncompressed secp256k1 public key, 128 lower-case hex characters, no `04` / `0x` prefix |
| `ip`, `p2p_port` | IPv4/IPv6 literal and P2P port (Besu allowlists do not take DNS names by default) |
| `contact` | the institution's operations mailbox or page — **no personal names** |

**Matching rule.** A `validator` declaration enters the node allowlist only if `state` is an active member and the address derived
from `node_public_key` is that member's `validatorAddress` in `Governance` (QBFT validator address = node key address). Otherwise
it is rejected (`render` exits with 3 and lists it). Two declarations with the same key, or a second validator for the same state,
are rejected. A wrong IP or port only breaks connectivity; a declaration never grants authority — authority is in the contracts.

The declarations are not written to the chain (infrastructure data; the contracts carry no free text).
