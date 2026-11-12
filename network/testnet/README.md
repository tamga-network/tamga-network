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
| `deploy-and-wire.sh` | the end-to-end test with the public test keys (below) |
| `bootstrap-governance.sh` | path C: contracts + Governance with **generated** keys (key map), permissions, anchoring, replay (below) |
| `rpc-proxy-check.sh` | `network/rpc-proxy` in front of a node: method filter + nginx mutual TLS |
| `testnet.mjs` | chain-side helpers (Governance admission, account permissioning, key and key-map check) — public test keys on 31337/31338, the key map on 31339; nothing else |
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

| Keys | Chain id | Used by | Who knows the keys |
|---|---|---|---|
| `--keys dev` (default) | **31338** (local Besu development id) | `deploy-and-wire.sh`, path B | everybody: Hardhat's public test accounts #1 #2 #6 #7 #8 as node keys |
| `--keys generate` | **31339** (test/staging id) | `bootstrap-governance.sh`, path C | only the machine that ran `make-network.sh` |

The repository's tools tell the two apart by chain id: 31337/31338 are "local chains" (test mnemonic, deployment file
`contracts/deployments/besuDev.json`, sandbox set allowed); 31339 is neither local nor the real network — its keys come only from the
key map (`TAMGA_CHAIN_KEYS`), the deployment file from `TAMGA_CHAIN_DEPLOYMENT`, and the sandbox set is refused (ADR-0074 K7). Any
other id is the real network: replay needs `TAMGA_CONFIRM_PROD` there and stops, because production keys are not configured here.
`make-network.sh` refuses `--keys generate` with 31337/31338 and `--keys dev` with 31339. Do not run the Windows development chain
and a path B network on the same machine at the same time (same deployment file, same ports 8546/8547).

With `--keys dev` the QBFT validator address equals the Governance validator address and the enode address. Test state codes are
user-assigned ISO codes (`XA`…) — no real state is implied.

### Key map (`--keys generate`) — test and staging networks only

> **Production keys never take this form.** On the real network every state generates its validator key on its own hardware and
> keeps its signing keys in an HSM (ARCH-0002 §2, GUIDE-0015); nobody holds another state's key. The key map exists because on a
> test network one person plays every state.

`make-network.sh --keys generate` writes, next to the node keys, `<dir>/keys/` (mode 0700, every file 0600):

| File | Role |
|---|---|
| `deployer.key` | deploys the contracts; allowed only by the start-up permissions file and drops out once the list is rendered from the chain (ADR-0052 K2) |
| `migration-executor.key` | the executor named by the migration-window vote (ADR-0073); listed while a window is open |
| `anchorer-1.key`, `anchorer-2.key` | list anchorers; threshold 2 (ADR-0051 K3) |
| `delegate-<cc>.key` | one delegate per state, set by the state's own validator (`setDelegateKeys`) |
| `keys.json` | the key map (`tamga-chain-keys/1`), below |

```json
{
  "format": "tamga-chain-keys/1",
  "purpose": "test",
  "chainId": 31339,
  "deployer": { "address": "0x…", "key": "deployer.key" },
  "migration_executor": { "address": "0x…", "key": "migration-executor.key" },
  "anchor": { "threshold": 2, "anchorers": [{ "address": "0x…", "key": "anchorer-1.key" }, { "address": "0x…", "key": "anchorer-2.key" }] },
  "states": [
    { "code": "TR", "founder": true, "genesis_validator": true, "node": 1,
      "validator": { "address": "0x…", "key": "../node1/key" }, "delegate": { "address": "0x…", "key": "delegate-tr.key" } }
  ]
}
```

Key paths are relative to `keys.json`; a validator's key is its node key (QBFT validator = Governance validator, ADR-0052 K2).
Every reader (`apps/chain-indexer/src/chain-keys.ts`, `testnet.mjs`) refuses a map whose `purpose` is not `test`, whose chain id is
not 31339, whose key file is missing, readable by others or belongs to another address. Environment variable: `TAMGA_CHAIN_KEYS`
(path of the map; default `<dir>/keys/keys.json` in `bootstrap-governance.sh`). The first two genesis states (TR, KZ) are the
founders; the others are admitted by 2/3 vote. Governance needs at least two founders (ADR-0076 GC4): a map with fewer than
two founders is refused, and `make-network.sh --keys generate --validators 1` writes no key map (such a network is for node-level
checks only). The genesis is Cancun (`shanghaiTime: 0`, `cancunTime: 0`; ADR-0077).

## Ports (all on 127.0.0.1)

| Node | JSON-RPC | P2P | Role |
|---|---|---|---|
| n = 1…5 | 8545 + n | 30312 + n | 1–4 genesis validators (TR, KZ, XA, XB); 5 extra node (XC) |
| filter | 8555 | | `network/rpc-proxy/filter.mjs` |
| nginx | 8443 | | mutual TLS, local test certificates (`network/rpc-proxy/gen-dev-certs.sh`) |

With `--hosts "ip1 ip2 …"` (one node per server) P2P listens on that IP, port 30303, JSON-RPC 127.0.0.1:8545.

## Path C: generated keys and Governance (`bootstrap-governance.sh`)

```bash
bash network/testnet/make-network.sh --keys generate            # chain 31339, node + role keys, keys/keys.json
bash network/testnet/node.sh start all
bash network/testnet/bootstrap-governance.sh                    # --no-replay skips step 6; a re-run continues where it stopped
```

`bootstrap-governance.sh`, step by step (each logged; a re-run skips what is done):

1. The nodes answer, blocks grow, the QBFT set has N validators, the chain id is 31339 (anything else is refused).
2. Contracts: `contracts/scripts/deploy-network.ts` (`npm --prefix contracts run deploy:network`, Hardhat network `besuStaging`)
   with the key map — founders TR + KZ and their delegates, founder recognition by **Governance vote** (`proposeFounderRecognition`,
   ADR-0055 K3), list anchor registry administered by the Governance contract, anchorers and threshold 2 from the map →
   `contracts/deployments/besuStaging.json`, copied to `<dir>/deployment.json`.
3. Governance: the other genesis states (XA, XB) admitted by 2/3 vote; each sets its delegate with its own validator.
4. Permissions from the chain on every node: render (from its own node) → load → check; `shared_sha256` equal; the deployer is no
   longer listed; a random unlisted key is refused, a delegate's transaction is mined.
5. Anchoring: `trust:chain-submit` once per anchorer (the second confirms) → `trust:chain-check` YES for every list.
6. Replay (optional): migration windows opened by vote (`trust:chain-replay --open-only`) → permissions rendered again: the
   executor of the open window is now listed → the sample archive (`apps/chain-indexer/scripts/besu-smoke.ts --archive-dir`) is
   replayed with the key map → equivalence, no decision difference allowed.
7. Summary: `<dir>/bootstrap-summary.md` / `.json` (and the GitHub Actions job summary).

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

`make-network.sh` writes every key in one place; each node directory is then copied to its server (only its own `key`; `keys/`
stays on the machine that ran `make-network.sh`). Governance with one node per server, on that machine (server 1):

```bash
sudo env "PATH=$PATH" TESTNET_DIR=/var/lib/tamga-besu TESTNET_MODE=systemd bash network/testnet/bootstrap-governance.sh --nodes 1
# then copy deployment.json and nodes/ to every other server and run there (no keys needed):
sudo env "PATH=$PATH" TESTNET_DIR=/var/lib/tamga-besu TESTNET_MODE=systemd \
     bash network/testnet/bootstrap-governance.sh --only permissions --nodes 2
```

Run as root under systemd: the permissions file is handed to the node's user (Besu rewrites it when it loads it). For the
production network each operator generates the key on its own hardware (ARCH-0002 §2). The firewall opens the P2P port to the
allow-listed peers only; JSON-RPC leaves the host only through `network/rpc-proxy`.

## Requirements per node

Measured in CI (GitHub Actions, 2026-11-05: ubuntu-24.04, 4 CPU / 16 GiB; 4 validators + 1 extra node on one host, heap
`-Xmx768m`, 2 s blocks; `deploy-and-wire.sh` summary, "resources" and "host" rows):

| | Measured |
|---|---|
| Memory | 505–568 MiB RSS per node (`TESTNET_HEAP`, default `768m`); systemd unit `-Xmx1g` |
| CPU | 10–37 s of CPU time per node over the whole run (921 s); JSON-RPC up 2–3 s after start |
| Disk | 74–76 MiB per node at block 404 |
| Whole test (5 nodes on one host) | 921 s, of which 616 s replay (111 operations); plan ~0.6 GiB memory per node (5 nodes ≈ 3 GiB) |
| systemd unit | `systemd-analyze security`: 1.5 OK (one validator, generated key) |

CI: `.github/workflows/testnet.yml` (manual, weekly, and on changes to `contracts/`, `apps/chain-indexer/`,
`apps/trust-publisher/src/chain/`, `network/`): `lint`, `network` (path B, `deploy-and-wire.sh`), `systemd` (one validator, unit
hardening) and `staging` (path C: 4 validators under systemd with generated keys, heap `-Xmx640m` through a unit drop-in,
`bootstrap-governance.sh` end to end, then a second run that must write nothing).

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
- Zincir kimliği: `--keys dev` 31338 (yerel geliştirme zinciriyle aynı; anahtarlar Hardhat'in herkesçe bilinen test hesapları);
  `--keys generate` 31339 (test/staging; düğüm ve rol anahtarları yeni üretilir, `keys/keys.json` anahtar haritası — yalnız test,
  üretim anahtarları HSM'de).
- `bootstrap-governance.sh` (yol C) — üretilmiş anahtarlarla: kontratlar (`deploy-network.ts`, kurucular arası tanıma Governance
  oyuyla) → öteki devletlerin 2/3 oyla kabulü → her düğümde izin listesi zincirden (dağıtan listeden düşer) → iki yazıcıyla çapa
  (eşik 2) → göç penceresi oyla açılır, yürütücü izin listesine girer → yeniden oynatma + eşdeğerlik → özet. Her adım günlüklü;
  yeniden çalıştırma kaldığı yerden sürer.
- Kaynak gereksinimi CI'da ölçüldü (2026-11-05, 4 CPU / 16 GiB, yığın `-Xmx768m`): düğüm başına 505–568 MiB bellek, 74–76 MiB
  disk (404 blok), 10–37 sn işlemci zamanı; uçtan uca sınama 921 sn. Adım adım anlatım: GUIDE-0018 (`docs/guides/chain-testnet.md`).
