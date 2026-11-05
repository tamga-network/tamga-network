# shellcheck shell=bash
# shellcheck disable=SC2034  # constants used by the scripts that source this file
# network/testnet/lib.sh — shared helpers of the Linux multi-node Besu test network scripts (sourced, not run).
# Ortak yardımcılar: günlük, RPC çağrısı (curl + jq), blok/doğrulayıcı okuma, bekleme döngüleri, ağ ayarlarının yüklenmesi.

# --- Pinned versions (upgrade: version + URL + sha256 change together; same pins as scripts/besu-dev.ps1) -------------------
BESU_VERSION="26.11.0"
BESU_URL="https://github.com/besu-eth/besu/releases/download/${BESU_VERSION}/besu-${BESU_VERSION}.zip"
BESU_SHA256="a3c947c33afc7eb7e1c1688c7122334d6258bfdca0fec64fedbe0d007b5978d1"
JDK_RELEASE="jdk-25.0.5%2B8"
JDK_VERSION_FILE="25.0.5_8"
# Temurin publishes <file>.sha256.txt next to every archive; the values below were taken from there (2026-11-05)
JDK_SHA256_X64="68982529869257d0ee6b824ec5aa270ff8b118bb438670da0b97ebdab178d7fb"
JDK_SHA256_AARCH64="bb5b2ded252f21c6090cf780b0a408ad0d83bbb557e702955643557f13231880"

# Test chain id: the same as the local Besu development chain (31338). The repository's tools recognise only 31337/31338 as
# local chains (deployment file, test signers, permission rendering without TAMGA_CHAIN_ENABLED); see README "Chain id".
DEFAULT_CHAIN_ID=31338
# Test/staging chain id (GUIDE-0018 path C, make-network.sh --keys generate, bootstrap-governance.sh): a separate id so that the
# generated keys never share a chain id with the public test keys. The tools treat it neither as a local chain (no test mnemonic,
# no sandbox set) nor as the real network (keys come from the key map, TAMGA_CHAIN_KEYS) — apps/chain-indexer/src/chain-keys.ts.
STAGING_CHAIN_ID=31339

TESTNET_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$TESTNET_LIB_DIR/../.." && pwd)"
TESTNET_DIR="${TESTNET_DIR:-$TESTNET_LIB_DIR/run}"

log() { printf '[testnet %s] %s\n' "$(date -u +%H:%M:%S)" "$*" >&2; }
step() { printf '\n[testnet %s] ===== %s =====\n' "$(date -u +%H:%M:%S)" "$*" >&2; }
die() {
  log "HATA / ERROR: $*"
  exit 1
}
need() {
  local c
  for c in "$@"; do command -v "$c" >/dev/null 2>&1 || die "required command missing: $c"; done
}

# Loads $TESTNET_DIR/network.env written by make-network.sh
load_network() {
  [ -f "$TESTNET_DIR/network.env" ] || die "no network in $TESTNET_DIR — run make-network.sh first"
  # shellcheck source=/dev/null
  . "$TESTNET_DIR/network.env"
}

node_dir() { printf '%s/node%s' "$TESTNET_DIR" "$1"; }
rpc_url() { printf 'http://127.0.0.1:%s' "${TESTNET_RPC_PORTS[$(($1 - 1))]}"; }
node_count() { printf '%s' $((TESTNET_VALIDATORS + TESTNET_EXTRA)); }
node_address() { cat "$(node_dir "$1")/address"; }
node_state() { cat "$(node_dir "$1")/state"; }

# rpc_call <url> <method> [params-json] → prints the JSON result; exit 1 = unreachable, 2 = JSON-RPC error (message on stderr)
rpc_call() {
  local url=$1 method=$2 params=${3:-[]} body out
  body=$(jq -cn --arg m "$method" --argjson p "$params" '{jsonrpc:"2.0",id:1,method:$m,params:$p}')
  out=$(curl -sS --max-time 10 -H 'content-type: application/json' --data "$body" "$url" 2>/dev/null) || return 1
  if ! jq -e . >/dev/null 2>&1 <<<"$out"; then return 1; fi
  if jq -e 'has("error")' >/dev/null <<<"$out"; then
    printf '%s: %s\n' "$method" "$(jq -r '.error.message // .error' <<<"$out")" >&2
    return 2
  fi
  jq -c '.result' <<<"$out"
}

hex_to_dec() {
  local h=${1//\"/}
  h=${h#0x}
  printf '%d' "$((16#${h:-0}))"
}

# block_number <url> → decimal block number, -1 if the node does not answer
block_number() {
  local r
  r=$(rpc_call "$1" eth_blockNumber 2>/dev/null) || {
    printf '%s' -1
    return 0
  }
  hex_to_dec "$r"
}

peer_count() {
  local r
  r=$(rpc_call "$1" net_peerCount 2>/dev/null) || {
    printf '%s' -1
    return 0
  }
  hex_to_dec "$r"
}

# validators <url> → sorted, comma-separated, lower-case validator addresses at the latest block
validators() {
  rpc_call "$1" qbft_getValidatorsByBlockNumber '["latest"]' | jq -r '[.[] | ascii_downcase] | sort | join(",")'
}

# wait_for <description> <timeout-seconds> <command...> — polls every second until the command succeeds
wait_for() {
  local what=$1 timeout=$2 start now last=-10
  shift 2
  start=$(date +%s)
  while true; do
    if "$@"; then return 0; fi
    now=$(($(date +%s) - start))
    if [ "$now" -ge "$timeout" ]; then
      log "timed out after ${timeout}s: $what"
      return 1
    fi
    if [ $((now - last)) -ge 15 ]; then
      log "waiting (${now}s): $what"
      last=$now
    fi
    sleep 1
  done
}

# blocks_advance <url> <n> <timeout> — true when the chain grows by n blocks within the timeout
blocks_advance() {
  local url=$1 n=$2 timeout=$3 b0
  b0=$(block_number "$url")
  [ "$b0" -ge 0 ] || return 1
  wait_for "block $b0 -> $((b0 + n)) on $url" "$timeout" block_at_least "$url" $((b0 + n))
}
block_at_least() { [ "$(block_number "$1")" -ge "$2" ]; }

# synced <n> <ref-n> — node n is not syncing and at most one block behind node ref-n
synced() {
  local u r b rb s
  u=$(rpc_url "$1")
  r=$(rpc_url "$2")
  b=$(block_number "$u")
  rb=$(block_number "$r")
  s=$(rpc_call "$u" eth_syncing 2>/dev/null) || return 1
  [ "$b" -ge 0 ] && [ "$rb" -ge 0 ] && [ $((rb - b)) -le 1 ] && [ "$s" = "false" ]
}

node_pid() {
  local f
  f="$(node_dir "$1")/besu.pid"
  [ -f "$f" ] || return 1
  local p
  p=$(cat "$f")
  [ -n "$p" ] && kill -0 "$p" 2>/dev/null && printf '%s' "$p"
}

# Repository's TypeScript CLIs without npm noise (same entry points as the npm scripts)
tsx_run() { node "$REPO_ROOT/node_modules/tsx/dist/cli.mjs" "$@"; }
trust_cli() { tsx_run "$REPO_ROOT/apps/trust-publisher/src/cli.ts" "$@"; }
