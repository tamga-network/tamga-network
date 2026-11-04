# network/testnet — multi-node Besu test network on Linux

> **Test network only.** The production chain stays off (ADR-0009 K4). These scripts set up the chain layer on Linux the way
> ARCH-0002 describes it — several QBFT validators, local permissioning rendered from the chain (ADR-0052), RPC protection — so
> that it can be tried end to end while the chainless system runs. The same scripts are the starting point for test servers.

| File | What |
|---|---|
| `install-besu.sh` | Temurin JDK 25 + Besu 26.11.0 from the official release pages, sha256-pinned (`lib.sh`); `--prefix DIR` or `--system` (`/opt/tamga-besu`, root-owned, service user `besu`, data in `/var/lib/tamga-besu`) |
| `make-network.sh` | N-validator QBFT network (default 4 + 1 extra node): keys, genesis (`extraData` by `besu rlp encode`), static peers, start-up permissions file, node declarations, one `besu.toml` per node |
| `node.sh` | `start / stop / restart / status / logs <n\|all>`; `TESTNET_MODE=process` (background JVMs) or `systemd` (`besu@node<n>`) |
| `besu@.service` | systemd unit template with hardening (own user, read-only system, only its data directory writable, no capabilities, syscall filter) |
| `deploy-and-wire.sh` | the end-to-end test (below) |
| `rpc-proxy-check.sh` | `network/rpc-proxy` in front of a node: method filter + nginx mutual TLS |
| `testnet.mjs` | chain-side helpers (Governance admission, account permissioning, key check) — test chain and public test keys only |
| `lib.sh` | shared helpers and the pinned versions |

## Quick start

Linux x64/aarch64 with `bash curl jq unzip tar ss openssl`, Node ≥ 22, optional `nginx` (mTLS check). From the repository root:

```bash
npm ci && npm run setup && npm run contracts:install && npm run contracts:compile
bash network/testnet/install-besu.sh            # → tools/jdk-25, tools/besu-26.11.0, tools/besu
bash network/testnet/make-network.sh            # → network/testnet/run/ (git-ignored)
bash network/testnet/deploy-and-wire.sh         # starts the nodes, runs every check, stops them; --keep leaves them running
bash network/testnet/node.sh status all
```

`deploy-and-wire.sh` proves, in this order:

1. 4 validators produce blocks, every node peers with the 3 others; JSON-RPC **and P2P** listen on 127.0.0.1 only
   (`p2p-interface` is set — Besu's default interface is 0.0.0.0; `p2p-host` is only the advertised address).
2. Contracts are deployed (`contracts/scripts/deploy-dev.ts`, founders TR + KZ).
3. Signed list archive → contracts → index → equivalence `TrustSource(list)` vs `TrustSource(chain)`
   (`apps/chain-indexer/scripts/besu-smoke.ts`): no decision difference allowed.
4. `trust:chain-submit` anchors `apps/trust-publisher/dist`; `trust:chain-check` answers YES for every list.
5. The other genesis validators' states (`XA`, `XB`) are admitted in Governance by 2/3 vote.
6. Every node renders its permissions file **from its own node**, reloads it (`perm_reloadPermissionsFromFile`) and checks it;
   all `shared_sha256` equal (LP3). An unlisted account's transaction is refused, a listed delegate's is mined.
7. Node 5 (`XC`) is admitted, allow-listed, synced, voted into the QBFT set (it proposes blocks), voted out and stopped.
8. One validator stopped → blocks continue; a second stopped → blocks stop; both restarted → blocks resume.
9. RPC protection: `eth/net/web3` pass, `admin_/perm_/qbft_/debug_/txpool_` and signing methods → 403; nginx without a client
   certificate → 400, TLS 1.2 refused; the node's RPC port does not answer on the host's external address.
10. Summary: `run/summary.md` / `summary.json` (and the GitHub Actions job summary).

Steps 2–4 run on the start-up permissions file: rendering from the chain needs every QBFT validator to be a Governance member
(ADR-0052 K2), and the local deploy script creates two founders — rendered earlier, it would cut validators 3 and 4 off and stop
the chain. The replay also runs while Governance has its two founders, because the local replay signs Governance votes with the
founders' test keys.

## Chain id and keys

Chain id **31338**, the same as the local Besu development chain (`scripts/besu-dev.ps1`): the repository's tools recognise
only 31337/31338 as local chains (deployment file `contracts/deployments/besuDev.json`, test signers, rendering permissions while
`TAMGA_CHAIN_ENABLED=0`), so a separate id would need changes outside this folder. Do not run the Windows development chain and
this network on the same machine at the same time (same deployment file, same ports 8546/8547).

`--keys dev` (default) uses Hardhat's **public** test accounts #1 #2 #6 #7 #8 as node keys, so that the QBFT validator address
equals the Governance validator address and the enode address. Everybody knows these keys: 127.0.0.1 and test servers only.
`--keys generate` creates fresh keys with `besu operator generate-blockchain-config` (test servers); Governance must then be set up
with those addresses, so `deploy-and-wire.sh` refuses this mode. Test state codes are user-assigned ISO codes (`XA`…) — no real
state is implied.

## Ports (all on 127.0.0.1)

| Node | JSON-RPC | P2P | Role |
|---|---|---|---|
| n = 1…5 | 8545 + n | 30312 + n | 1–4 genesis validators (TR, KZ, XA, XB); 5 extra node (XC) |
| filter | 8555 | | `network/rpc-proxy/filter.mjs` |
| nginx | 8443 | | mutual TLS, local test certificates (`network/rpc-proxy/gen-dev-certs.sh`) |

With `--hosts "ip1 ip2 …"` (one node per server) P2P listens on that IP, port 30303, JSON-RPC 127.0.0.1:8545.

## Test server with systemd

```bash
sudo bash network/testnet/install-besu.sh --system
sudo bash network/testnet/make-network.sh --dir /var/lib/tamga-besu --besu-home /opt/tamga-besu/besu \
     --java-home /opt/tamga-besu/jdk-25 --keys generate --hosts "192.0.2.10 192.0.2.11 192.0.2.12 192.0.2.13" --extra 0
sudo chown -R besu:besu /var/lib/tamga-besu
sudo install -m 0644 network/testnet/besu@.service /etc/systemd/system/ && sudo systemctl daemon-reload
sudo systemctl enable --now besu@node1                     # on server 1; node2 on server 2, …
sudo TESTNET_DIR=/var/lib/tamga-besu TESTNET_MODE=systemd bash network/testnet/node.sh status 1
```

`make-network.sh` writes every node's key in one place; on real test servers each node directory is then copied to its server
(only its own `key`). For the production network each operator generates the key on its own hardware (ARCH-0002 §2).
The firewall opens the P2P port to the allow-listed peers only; JSON-RPC leaves the host only through `network/rpc-proxy`.

## Requirements per node

| | Estimate (to be replaced by the values measured in CI) |
|---|---|
| Memory | ~1 GiB RSS with `-Xmx768m` (`TESTNET_HEAP`); systemd unit `-Xmx1g` |
| CPU | < 0.5 core when idle (2 s blocks, empty chain); startup ~10–20 s of one core |
| Disk | < 100 MiB for a test run |
| Whole test (5 nodes on one host) | 2 vCPU / 7 GiB (GitHub private runner) is the lower limit; 4 vCPU / 16 GiB comfortable |

CI: `.github/workflows/testnet.yml` (manual, weekly, and on changes to `contracts/`, `apps/chain-indexer/`,
`apps/trust-publisher/src/chain/`, `network/`).

---

## Türkçe özet

Linux'ta çok düğümlü Besu test ağı. **Yalnız test:** üretim zinciri kapalı (ADR-0009 K4). Amaç, zincirsiz canlı sistem çalışırken
zincir katmanını gerçekçi bir Linux ortamında kurup sınamak; aynı betikler ileride test sunucularına kurulumun başlangıcıdır.

- `install-besu.sh` — JDK 25 + Besu 26.11.0 resmi kaynaktan, sha256 sabit; `--system` ile `/opt/tamga-besu` + `besu` kullanıcısı.
- `make-network.sh` — 4 doğrulayıcılı (QBFT'de 1 hata toleransı) + 1 ek düğümlü izinli ağ: anahtarlar, genesis, statik eşler,
  başlangıç izin dosyası, düğüm bildirimleri, düğüm başına `besu.toml` (RPC ve P2P yalnız 127.0.0.1; `p2p-interface` ayarlı).
- `node.sh` — düğüm başlat/durdur/durum/günlük; süreç ya da systemd kipi. `besu@.service` — sıkılaştırılmış systemd birimi.
- `deploy-and-wire.sh` — uçtan uca sınama: blok üretimi → kontratlar → liste arşivinin yeniden oynatılması ve eşdeğerlik →
  çapa (`chain-submit` / `chain-check`) → Governance'a öteki doğrulayıcıların devletlerinin kabulü → her düğümde izin listesi
  kendi düğümünden (paylaşılan özetler aynı) ve izinsiz hesabın reddi → 5. düğümün oyla eklenip çıkarılması → 1 doğrulayıcı
  dururken bloklar sürer, 2 dururken durur, yeniden başlayınca devam eder → RPC koruması (süzgeç + nginx mTLS) → özet.
- Zincir kimliği 31338 (yerel geliştirme zinciriyle aynı; depodaki araçlar yalnız 31337/31338'i yerel tanır). Anahtarlar
  Hardhat'in herkesçe bilinen test hesapları — yalnız test; test sunucusunda `--keys generate`.
- Kaynak gereksinimi şimdilik **tahmin**; CI'da ölçülen değerler (özetteki "resources" satırı) gelince tablo güncellenir.
