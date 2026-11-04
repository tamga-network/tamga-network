#!/usr/bin/env bash
# network/testnet/make-network.sh — writes a permissioned N-validator QBFT network (ADR-0052) into one directory:
# genesis, node keys, static peers, the start-up permissions file and one besu.toml per node.
#
#   bash network/testnet/make-network.sh [--validators 4] [--extra 1] [--keys dev|generate] [--chain-id 31338]
#                                        [--dir DIR] [--besu-home DIR] [--java-home DIR] [--hosts "ip1 ip2 …"]
#                                        [--block-period 2] [--force]
#
#   --validators N  genesis validators (default 4: QBFT 3f+1 → one faulty validator tolerated)
#   --extra E       further nodes that start as full nodes and are voted in later (default 1; deploy-and-wire.sh uses it)
#   --keys dev      (default) node keys = Hardhat's PUBLIC test accounts #1 #2 #6 #7 #8 — so the QBFT validator address =
#                   the Governance validator address = the enode address (ADR-0052 K2) with the repository's local deploy
#                   script. TEST ONLY: everybody knows these keys.
#   --keys generate fresh random keys (`besu operator generate-blockchain-config`) — for test servers; Governance then has to
#                   be set up with those addresses (deploy-and-wire.sh refuses this mode)
#   --hosts         one IP per node (real test servers, one node per host): P2P listens on that IP, ports 30303 / RPC 8545.
#                   Without it: every node on 127.0.0.1 with its own ports (node n: RPC 8545+n, P2P 30312+n).
#   --dir           output (default network/testnet/run, git-ignored; systemd layout: /var/lib/tamga-besu)
#
# Ağ dosyaları: <dir>/genesis.json · network.env (öteki betikler okur) · declarations/ (düğüm bildirimleri,
# tamga-node-declaration/1) · node<n>/{key,key.pub,address,state,besu.toml,static-nodes.json,permissions_config.toml}.
# JSON-RPC yalnız 127.0.0.1; P2P yalnız düğümün kendi IP'sinde (p2p-interface — p2p-host yalnız ilan edilen adrestir); keşif kapalı.
set -euo pipefail
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

N=4
E=1
KEYS=dev
CHAIN_ID=$DEFAULT_CHAIN_ID
HOSTS=""
BLOCK_PERIOD=2
FORCE=0
BESU_HOME=${TESTNET_BESU_HOME:-$REPO_ROOT/tools/besu}
# Not the generic JAVA_HOME: CI runners (and many servers) point it at an older JDK; Besu 26.x needs 25.
JAVA_DIR=${TESTNET_JAVA_HOME:-$REPO_ROOT/tools/jdk-25}
while [ $# -gt 0 ]; do
  case "$1" in
    --validators) N=$2; shift 2 ;;
    --extra) E=$2; shift 2 ;;
    --keys) KEYS=$2; shift 2 ;;
    --chain-id) CHAIN_ID=$2; shift 2 ;;
    --dir) TESTNET_DIR=$2; shift 2 ;;
    --besu-home) BESU_HOME=$2; shift 2 ;;
    --java-home) JAVA_DIR=$2; shift 2 ;;
    --hosts) HOSTS=$2; shift 2 ;;
    --block-period) BLOCK_PERIOD=$2; shift 2 ;;
    --force) FORCE=1; shift ;;
    -h | --help) sed -n '2,24p' "$0"; exit 0 ;;
    *) die "unknown option: $1" ;;
  esac
done
need jq
[[ "$N" =~ ^[1-9][0-9]*$ ]] || die "--validators must be >= 1"
[[ "$E" =~ ^[0-9]+$ ]] || die "--extra must be >= 0"
[[ "$CHAIN_ID" =~ ^[0-9]+$ ]] || die "--chain-id must be a number"
[[ "$BLOCK_PERIOD" =~ ^[1-9][0-9]*$ ]] || die "--block-period must be >= 1"
case "$KEYS" in dev | generate) ;; *) die "--keys dev|generate" ;; esac
TOTAL=$((N + E))
[ -x "$BESU_HOME/bin/besu" ] || die "Besu not found in $BESU_HOME — run install-besu.sh (or --besu-home / TESTNET_BESU_HOME)"
[ -x "$JAVA_DIR/bin/java" ] || die "JDK 25 not found in $JAVA_DIR — run install-besu.sh (or --java-home / TESTNET_JAVA_HOME)"
BESU_HOME=$(cd "$BESU_HOME" && pwd)
JAVA_DIR=$(cd "$JAVA_DIR" && pwd)
besu() { JAVA_HOME="$JAVA_DIR" "$BESU_HOME/bin/besu" "$@"; }

# Test states: two founders as in contracts/scripts/deploy-dev.ts, then user-assigned ISO 3166 codes (XA…) — deliberately no
# real state is implied by the test network.
STATES=(TR KZ XA XB XC XD XE XF XG XH XI XJ)
[ "$TOTAL" -le "${#STATES[@]}" ] || die "at most ${#STATES[@]} nodes"

# Hardhat's public test accounts (mnemonic "test … junk") — the same table as scripts/besu-dev.ps1 (#1, #2) and
# contracts/scripts/deploy-dev.ts. #0 deployer, #3/#4 TR/KZ delegates, #5 spare anchorer, #9 the "unlisted" account.
DEV_INDEX=(1 2 6 7 8)
declare -A DEV_KEY=(
  [1]=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
  [2]=0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
  [6]=0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e
  [7]=0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356
  [8]=0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97
)
declare -A DEV_PUB=(
  [1]=ba5734d8f7091719471e7f7ed6b9df170dc70cc661ca05e688601ad984f068b0d67351e5f06073092499336ab0839ef8a521afd334e53807205fa2f08eec74f4
  [2]=9d9031e97dd78ff8c15aa86939de9b1e791066a0224e331bc962a2099a7b1f0464b8bbafe1535f2301c72c2cb3535b172da30b02686ab0393d348614f157fbdb
  [6]=9a4ab212cb92775d227af4237c20b81f4221e9361d29007dfc16c79186b577cb6ba3f1b582ad0b5572c93f47e7506d66df7f2af05fa1828de0e511aac7b97828
  [7]=01f2bf1fa920e77a43c7aec2587d0b3814093420cc59a9b3ad66dd5734dda7be6f8b7de790eac3a720fd8e4bcb9eae9434f843d3cec111d9e07adeddeae090f2
  [8]=931e7fda8da226f799f791eefc9afebcd7ae2b1b19a03c5eaa8d72122d9fe74d887a3962ff861190b531ab31ee82f0d7f255dfe3ab73ca627bd70ab3d1cbb417
)
declare -A DEV_ADDR=(
  [1]=70997970c51812dc3a010c7d01b50e0d17dc79c8
  [2]=3c44cdddb6a900fa2b585dd299e03d12fa4293bc
  [6]=976ea74026e726554db657fa54763abd0c3a0aa9
  [7]=14dc79964da2c08b23698b3d3cc7ca32193d9955
  [8]=23618e81e3f5cdf7f54c3d65f7fbc0abf5b21e8f
)
# accounts allowed before the contracts exist (ADR-0052 K2 "start-up"): deployer #0 and the TR/KZ delegates #3/#4 of the local
# deploy script; the validators' own addresses are added below
BOOT_ACCOUNTS=(f39fd6e51aad88f6f4ce6ab8827279cfffb92266 90f79bf6eb2c4f870365e785982e1f101e93b906 15d34aaf54267db7d7c367839aaf71a00a2c6a65)
ALLOC_ACCOUNTS=(f39fd6e51aad88f6f4ce6ab8827279cfffb92266 70997970c51812dc3a010c7d01b50e0d17dc79c8
  3c44cdddb6a900fa2b585dd299e03d12fa4293bc 90f79bf6eb2c4f870365e785982e1f101e93b906 15d34aaf54267db7d7c367839aaf71a00a2c6a65
  9965507d1a55bcc2695c58ba16fb37d819b0a4dc 976ea74026e726554db657fa54763abd0c3a0aa9 14dc79964da2c08b23698b3d3cc7ca32193d9955
  23618e81e3f5cdf7f54c3d65f7fbc0abf5b21e8f a0ee7a142d267c1f36714e4a8f75612f20a79720)
if [ "$KEYS" = dev ]; then
  [ "$TOTAL" -le "${#DEV_INDEX[@]}" ] || die "--keys dev supports at most ${#DEV_INDEX[@]} nodes (validators + extra)"
  [ "$CHAIN_ID" = "$DEFAULT_CHAIN_ID" ] || log "WARNING: chain id $CHAIN_ID — deploy-and-wire.sh works only with $DEFAULT_CHAIN_ID"
fi

# --- addresses and ports ------------------------------------------------------------------------------------------------
read -r -a HOST_LIST <<<"$HOSTS"
IPS=()
RPC_PORTS=()
P2P_PORTS=()
for ((n = 1; n <= TOTAL; n++)); do
  if [ "${#HOST_LIST[@]}" -gt 0 ]; then
    [ "${#HOST_LIST[@]}" -eq "$TOTAL" ] || die "--hosts needs exactly $TOTAL addresses"
    IPS+=("${HOST_LIST[$((n - 1))]}")
    RPC_PORTS+=(8545)
    P2P_PORTS+=(30303)
  else
    IPS+=(127.0.0.1)
    RPC_PORTS+=($((8545 + n)))
    P2P_PORTS+=($((30312 + n)))
  fi
done

if [ -e "$TESTNET_DIR/network.env" ] && [ "$FORCE" != 1 ]; then
  die "$TESTNET_DIR already holds a network (stop it and use --force to overwrite; data is deleted)"
fi
if [ "$FORCE" = 1 ] && [ -d "$TESTNET_DIR" ]; then
  for f in "$TESTNET_DIR"/node*/besu.pid; do
    if [ -f "$f" ] && kill -0 "$(cat "$f")" 2>/dev/null; then die "a node is still running ($f) — node.sh stop all first"; fi
  done
  rm -rf "$TESTNET_DIR"
fi
mkdir -p "$TESTNET_DIR/declarations"
TESTNET_DIR=$(cd "$TESTNET_DIR" && pwd)
umask 077
step "network: $N validators + $E extra, keys=$KEYS, chainId $CHAIN_ID, dir $TESTNET_DIR"

work=$(mktemp -d "$TESTNET_DIR/_gen-XXXXXX")
qbft_genesis_json() {
  # the genesis body shared by both key modes (same values as the local development chain, ARCH-0002)
  local alloc
  alloc=$(printf '%s\n' "${ALLOC_ACCOUNTS[@]}" | jq -R . | jq -s 'map({key: ., value: {balance: "0x3635C9ADC5DEA00000"}}) | from_entries')
  jq -n --argjson chainId "$CHAIN_ID" --argjson period "$BLOCK_PERIOD" --argjson alloc "$alloc" '{
    config: {
      chainId: $chainId, berlinBlock: 0, londonBlock: 0, shanghaiTime: 0, zeroBaseFee: true,
      qbft: { blockperiodseconds: $period, epochlength: 30000, requesttimeoutseconds: ($period * 2) }
    },
    nonce: "0x0", timestamp: "0x0", gasLimit: "0x1fffffffffffff", difficulty: "0x1",
    mixHash: "0x63746963616c2062797a616e74696e65206661756c7420746f6c6572616e6365",
    coinbase: "0x0000000000000000000000000000000000000000",
    alloc: $alloc
  }'
}

# --- node keys ----------------------------------------------------------------------------------------------------------
for ((n = 1; n <= TOTAL; n++)); do mkdir -p "$TESTNET_DIR/node$n"; done
if [ "$KEYS" = dev ]; then
  for ((n = 1; n <= TOTAL; n++)); do
    i=${DEV_INDEX[$((n - 1))]}
    d="$TESTNET_DIR/node$n"
    printf '%s' "${DEV_KEY[$i]}" >"$d/key"
    printf '%s\n' "${DEV_PUB[$i]}" >"$d/key.pub"
    printf '%s\n' "${DEV_ADDR[$i]}" >"$d/address"
    printf '%s\n' "$i" >"$d/dev-index"
  done
  qbft_genesis_json >"$work/genesis.base.json"
else
  # besu operator generate-blockchain-config: keys for every node (genesis validators + extra nodes)
  jq -n --argjson g "$(qbft_genesis_json)" --argjson count "$TOTAL" \
    '{genesis: $g, blockchain: {nodes: {generate: true, count: $count}}}' >"$work/qbft-config.json"
  besu operator generate-blockchain-config --config-file="$work/qbft-config.json" --to="$work/out" \
    --private-key-file-name=key >"$work/generate.log" 2>&1 || {
    cat "$work/generate.log" >&2
    die "besu operator generate-blockchain-config failed"
  }
  mapfile -t keydirs < <(find "$work/out/keys" -mindepth 1 -maxdepth 1 -type d | sort)
  [ "${#keydirs[@]}" -eq "$TOTAL" ] || die "expected $TOTAL generated keys, got ${#keydirs[@]}"
  for ((n = 1; n <= TOTAL; n++)); do
    kd=${keydirs[$((n - 1))]}
    d="$TESTNET_DIR/node$n"
    cp "$kd/key" "$d/key"
    tr -d '\n' <"$kd/key.pub" | sed 's/^0x//' >"$d/key.pub"
    printf '\n' >>"$d/key.pub"
    basename "$kd" | sed 's/^0x//' | tr '[:upper:]' '[:lower:]' >"$d/address"
  done
  # generated genesis (its extraData lists all generated keys — replaced below by the genesis validators only)
  jq 'del(.extraData)' "$work/out/genesis.json" >"$work/genesis.base.json"
fi
for ((n = 1; n <= TOTAL; n++)); do
  d="$TESTNET_DIR/node$n"
  printf '%s\n' "${STATES[$((n - 1))]}" >"$d/state"
  chmod 600 "$d/key"
  [[ "$(cat "$d/key.pub")" =~ ^[0-9a-f]{128}$ ]] || die "node $n: bad public key"
  [[ "$(cat "$d/address")" =~ ^[0-9a-f]{40}$ ]] || die "node $n: bad address"
done

# --- genesis: QBFT extraData = the first N nodes (besu rlp encode, as scripts/besu-dev.ps1) ------------------------------
for ((n = 1; n <= N; n++)); do cat "$TESTNET_DIR/node$n/address"; done | jq -R . | jq -s . >"$work/validators.json"
besu rlp encode --from="$work/validators.json" --to="$work/extra.txt" --type=QBFT_EXTRA_DATA >"$work/rlp.log" 2>&1 || {
  cat "$work/rlp.log" >&2
  die "besu rlp encode failed"
}
extra=$(tr -d '[:space:]' <"$work/extra.txt")
[[ "$extra" =~ ^0x[0-9a-f]+$ ]] || die "unexpected extraData: $extra"
jq --arg x "$extra" '. + {extraData: $x}' "$work/genesis.base.json" >"$TESTNET_DIR/genesis.json"
log "genesis: $TESTNET_DIR/genesis.json (validators: $(jq -r 'join(", ")' "$work/validators.json"))"
rm -rf "$work"

enode() { printf 'enode://%s@%s:%s' "$(cat "$TESTNET_DIR/node$1/key.pub")" "${IPS[$(($1 - 1))]}" "${P2P_PORTS[$(($1 - 1))]}"; }

# --- per node: declaration, static peers, start-up permissions file, besu.toml -----------------------------------------
for ((n = 1; n <= TOTAL; n++)); do
  d="$TESTNET_DIR/node$n"
  state=${STATES[$((n - 1))]}
  # node declaration (network/permissions schema); enters the allowlist only when Governance has this validator address
  jq -n --arg s "$state" --arg k "$(cat "$d/key.pub")" --arg ip "${IPS[$((n - 1))]}" --argjson port "${P2P_PORTS[$((n - 1))]}" \
    '{format: "tamga-node-declaration/1", state: $s, role: "validator", node_public_key: $k, ip: $ip, p2p_port: $port,
      contact: "noc@example.org"}' >"$TESTNET_DIR/declarations/${state,,}-node$n.json"
  # static peers: every genesis validator except the node itself (no discovery)
  for ((m = 1; m <= N; m++)); do [ "$m" = "$n" ] || enode "$m"; printf '\n'; done | sed '/^$/d' | jq -R . | jq -s . >"$d/static-nodes.json"
  # start-up permissions file (before the contracts): genesis validators' nodes and accounts + deployer and delegates.
  # Replaced by `trust:chain-permissions render` (deploy-and-wire.sh) as soon as the contracts exist.
  {
    printf '# START-UP (before the contracts) — replaced by trust:chain-permissions render (ADR-0052 K3)\n'
    printf 'accounts-allowlist=[\n'
    { printf '%s\n' "${BOOT_ACCOUNTS[@]}"; for ((m = 1; m <= N; m++)); do cat "$TESTNET_DIR/node$m/address"; done; } |
      sort -u | sed 's/^/  "0x/; s/$/",/'
    printf ']\nnodes-allowlist=[\n'
    for ((m = 1; m <= N; m++)); do printf '  "%s",\n' "$(enode "$m")"; done
    printf ']\n'
  } >"$d/permissions_config.toml"
  cat >"$d/besu.toml" <<EOF
# node $n ($state) — written by network/testnet/make-network.sh; TEST NETWORK
data-path="$d/db"
genesis-file="$TESTNET_DIR/genesis.json"
node-private-key-file="$d/key"
sync-mode="FULL"
p2p-host="${IPS[$((n - 1))]}"
p2p-interface="${IPS[$((n - 1))]}"
p2p-port=${P2P_PORTS[$((n - 1))]}
discovery-enabled=false
static-nodes-file="$d/static-nodes.json"
rpc-http-enabled=true
rpc-http-host="127.0.0.1"
rpc-http-port=${RPC_PORTS[$((n - 1))]}
rpc-http-api=["ETH","NET","WEB3","QBFT","PERM","ADMIN"]
host-allowlist=["localhost","127.0.0.1"]
metrics-enabled=false
min-gas-price=0
color-enabled=false
permissions-nodes-config-file-enabled=true
permissions-nodes-config-file="$d/permissions_config.toml"
permissions-accounts-config-file-enabled=true
permissions-accounts-config-file="$d/permissions_config.toml"
EOF
done

{
  printf '# written by make-network.sh — read by node.sh, deploy-and-wire.sh\n'
  printf 'TESTNET_CHAIN_ID=%s\nTESTNET_VALIDATORS=%s\nTESTNET_EXTRA=%s\nTESTNET_KEYS=%s\n' "$CHAIN_ID" "$N" "$E" "$KEYS"
  printf 'TESTNET_BLOCK_PERIOD=%s\n' "$BLOCK_PERIOD"
  printf 'TESTNET_BESU_HOME=%q\nTESTNET_JAVA_HOME=%q\n' "$BESU_HOME" "$JAVA_DIR"
  printf 'TESTNET_IPS=(%s)\nTESTNET_RPC_PORTS=(%s)\nTESTNET_P2P_PORTS=(%s)\n' "${IPS[*]}" "${RPC_PORTS[*]}" "${P2P_PORTS[*]}"
} >"$TESTNET_DIR/network.env"
chmod 644 "$TESTNET_DIR/genesis.json" "$TESTNET_DIR/network.env"

for ((n = 1; n <= TOTAL; n++)); do
  role="genesis validator"
  [ "$n" -le "$N" ] || role="extra node (full node; voted in by deploy-and-wire.sh)"
  log "node $n ${STATES[$((n - 1))]} 0x$(cat "$TESTNET_DIR/node$n/address") RPC 127.0.0.1:${RPC_PORTS[$((n - 1))]} P2P ${IPS[$((n - 1))]}:${P2P_PORTS[$((n - 1))]} — $role"
done
log "next: bash network/testnet/node.sh start all   (or: deploy-and-wire.sh, which starts the nodes itself)"
