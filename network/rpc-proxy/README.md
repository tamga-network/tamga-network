# network/rpc-proxy — Besu JSON-RPC behind mutual TLS

ADR-0052 K5 / LP5: the node's JSON-RPC port listens on 127.0.0.1 only. Outside clients (trust list publisher, indexer, verifier
read path) reach it through nginx with a **mandatory client certificate**, and only the `ETH`, `NET` and `WEB3` namespaces pass.
`PERM`, `ADMIN`, `QBFT`, `DEBUG`, `TXPOOL` are used from the node itself (localhost) only.

```text
client --TLS 1.3 + client cert--> nginx :8443 --> filter.mjs 127.0.0.1:8550 --> Besu 127.0.0.1:8545
```

| File | What |
|---|---|
| `nginx.conf.example` | TLS 1.3, `ssl_verify_client on` with the operator's own client CA, POST `/` only, 256 KiB body limit, per-client rate limit, no access log |
| `filter.mjs` | Method filter (Node ≥ 22, no dependencies): parses the JSON-RPC body (single call or batch), passes `eth_*`/`net_*`/`web3_*` except the signing/mining/subscription methods, refuses the whole batch if one call is refused; logs only refusal counts |
| `rpc-filter.service.example` | systemd unit for the filter (unprivileged user, loopback only) |
| `gen-dev-certs.sh` | Local test CA, server and client certificates in `dev-certs/` (git-ignored) — development only |

nginx cannot read the request body without njs; a small separate filter keeps the nginx configuration plain and the rule
testable (`filter.test.ts`). Placeholders (`<operator-domain>`, certificate paths) are filled in by each operator; no real
certificate, key or address belongs in this repository.

Local try (with `scripts/besu-dev.ps1 -Start` running on 8546):

```bash
TAMGA_RPC_FILTER_UPSTREAM=http://127.0.0.1:8546 node network/rpc-proxy/filter.mjs &
curl -s -X POST -H 'content-type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"admin_peers"}' http://127.0.0.1:8550   # 403
curl -s -X POST -H 'content-type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber"}' http://127.0.0.1:8550  # 200
```
