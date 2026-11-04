#!/usr/bin/env bash
# network/testnet/deploy-and-wire.sh — end-to-end test of the multi-node permissioned QBFT network written by make-network.sh
# (--keys dev, chainId 31338, all nodes on 127.0.0.1). Starts the genesis validators and then proves, step by step:
#
#    1  network: N validators produce blocks, every node peers with the others, JSON-RPC and P2P listen on 127.0.0.1 only
#    2  contracts: contracts/scripts/deploy-dev.ts (founders TR + KZ) → contracts/deployments/besuDev.json
#    3  replay + equivalence: signed list archive → contracts → index → TrustSource(list) vs TrustSource(chain)
#       (apps/chain-indexer/scripts/besu-smoke.ts; ADR-0073 K1/K6)
#    4  anchoring: trust:chain-submit (apps/trust-publisher/dist) and trust:chain-check → YES for every list
#    5  Governance: the other genesis validators' states (XA, XB, …) admitted by 2/3 vote — QBFT validator = Governance member
#    6  permissions: on every node trust:chain-permissions render (from its own node) → perm_reloadPermissionsFromFile → check;
#       all shared_sha256 equal (LP3); an unlisted account's transaction is refused, a listed delegate's is mined
#    7  validator vote: node N+1 (state XC) admitted, allow-listed, synced, voted into the QBFT set (it proposes blocks) and
#       voted out again; then stopped
#    8  fault tolerance: f = ⌊(N−1)/3⌋ validators stopped → blocks continue; one more stopped → blocks stop; restarted → resume
#    9  RPC protection: network/testnet/rpc-proxy-check.sh (filter.mjs + nginx mTLS)
#   10  summary: blocks, nodes, equivalence questions/differences, fault tolerance, memory/CPU/disk per node
#
#   bash network/testnet/deploy-and-wire.sh [--keep] [--no-nginx]
#     --keep  leave the nodes running at the end (default: stopped)
# Prerequisites (repository root): npm ci && npm run setup && npm run contracts:install && npm run contracts:compile
# Output: <testnet dir>/summary.md + summary.json (also appended to $GITHUB_STEP_SUMMARY in GitHub Actions).
#
# Uçtan uca sınama: ağ → kontratlar → yeniden oynatma + eşdeğerlik → çapa → Governance kabulü → izin listesi (her düğüm kendi
# düğümünden üretir, paylaşılan özetler aynı) → doğrulayıcı ekleme/çıkarma oyu → bir hata toleransı → RPC koruması → özet.
set -euo pipefail
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

KEEP=0
PROXY_ARGS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --keep) KEEP=1; shift ;;
    --no-nginx) PROXY_ARGS+=(--no-nginx); shift ;;
    -h | --help) sed -n '2,26p' "$0"; exit 0 ;;
    *) die "unknown option: $1" ;;
  esac
done
need node jq curl ss awk
load_network
cd "$REPO_ROOT"

SYNC_TIMEOUT=${TESTNET_SYNC_TIMEOUT:-180}
RESUME_TIMEOUT=${TESTNET_RESUME_TIMEOUT:-300}
N=$TESTNET_VALIDATORS
E=$TESTNET_EXTRA
TOTAL=$(node_count)
URL1=$(rpc_url 1)
DEPLOYMENT="$REPO_ROOT/contracts/deployments/besuDev.json"
DIST=${TAMGA_TP_DIST:-$REPO_ROOT/apps/trust-publisher/dist}
NODES_DIR="$TESTNET_DIR/nodes" # declarations of the admitted members — input of trust:chain-permissions render
NODE_SH=(bash "$TESTNET_LIB_DIR/node.sh")
HELPER=(node "$TESTNET_LIB_DIR/testnet.mjs")
# Hardhat public test account #0 (deployer and list anchorer of the local deploy script) — NOT a secret
ANCHORER_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

[ "$TESTNET_KEYS" = dev ] || die "deploy-and-wire.sh needs make-network.sh --keys dev (Governance addresses = node keys)"
[ "$TESTNET_CHAIN_ID" = "$DEFAULT_CHAIN_ID" ] || die "deploy-and-wire.sh needs chainId $DEFAULT_CHAIN_ID"
[ "${TESTNET_IPS[0]}" = 127.0.0.1 ] || die "deploy-and-wire.sh runs all nodes on 127.0.0.1 (make-network.sh without --hosts)"
[ -f "$REPO_ROOT/node_modules/tsx/dist/cli.mjs" ] || die "root packages missing — npm ci"
[ -d "$REPO_ROOT/contracts/node_modules" ] || die "contract packages missing — npm run contracts:install && npm run contracts:compile"
[ -f "$DIST/lotl.jws" ] || die "no signed lists in $DIST — npm run setup"

SUMMARY=()
row() { SUMMARY+=("| $1 | $2 |"); }
CURRENT=""
T0=$(date +%s)
phase() {
  CURRENT=$1
  step "$1"
}

write_summary() {
  local status=$1 md="$TESTNET_DIR/summary.md"
  {
    printf '## Tamga test network (Besu %s, QBFT) — %s\n\n' "$BESU_VERSION" "$status"
    printf '| | |\n|---|---|\n'
    printf '%s\n' "${SUMMARY[@]}"
    printf '| duration | %s s |\n' "$(($(date +%s) - T0))"
    [ "$status" = PASSED ] || printf '\n**Failed at:** %s\n' "$CURRENT"
  } >"$md"
  printf '%s\n' "${SUMMARY[@]}" | sed -n 's/^| \(.*\) | \(.*\) |$/\1\t\2/p' |
    jq -R 'split("\t") | {(.[0]): .[1]}' | jq -s --arg s "$status" --arg at "$CURRENT" 'add + {status: $s, failed_at: (if $s == "PASSED" then null else $at end)}' \
      >"$TESTNET_DIR/summary.json" || true
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then cat "$md" >>"$GITHUB_STEP_SUMMARY"; fi
  cat "$md" >&2
}

on_exit() {
  local rc=$?
  if [ "$rc" = 0 ]; then
    write_summary PASSED
  else
    log "FAILED during: $CURRENT (exit $rc)"
    for ((n = 1; n <= TOTAL; n++)); do
      [ -f "$(node_dir "$n")/besu.log" ] || continue
      printf '\n----- node %s: last log lines -----\n' "$n" >&2
      tail -n 30 "$(node_dir "$n")/besu.log" >&2 || true
    done
    write_summary FAILED || true
  fi
  if [ "$KEEP" != 1 ]; then "${NODE_SH[@]}" stop all >/dev/null 2>&1 || true; fi
}
trap on_exit EXIT

# --- helpers ----------------------------------------------------------------------------------------------------------------
running_nodes() {
  local n
  for ((n = 1; n <= TOTAL; n++)); do if node_pid "$n" >/dev/null; then printf '%s\n' "$n"; fi; done
}

# JSON-RPC and P2P sockets of every running node on 127.0.0.1 only (the Windows run found p2p-interface defaulting to 0.0.0.0)
assert_loopback_only() {
  local n pid lines line addr bad=0 count=0
  while read -r n; do
    pid=$(node_pid "$n")
    lines=$(ss -H -ltnup 2>/dev/null | grep "pid=$pid," || true)
    if [ -z "$lines" ]; then
      log "node $n: no listening socket found for PID $pid"
      bad=1
      continue
    fi
    while read -r line; do
      addr=$(awk '{print $5}' <<<"$line")
      count=$((count + 1))
      case "$addr" in
        127.0.0.1:* | "[::ffff:127.0.0.1]:"*) ;;
        *)
          log "node $n listens on $addr — NOT loopback"
          bad=1
          ;;
      esac
    done <<<"$lines"
  done < <(running_nodes)
  [ "$bad" = 0 ] || return 1
  log "listening sockets: $count, all on 127.0.0.1"
  LISTEN_COUNT=$count
}

all_peered() {
  local n want=$1
  shift
  for n in "$@"; do [ "$(peer_count "$(rpc_url "$n")")" -ge "$want" ] || return 1; done
}

# validator set on every running node: contains / lacks <address>
set_has() {
  local n
  while read -r n; do [[ ",$(validators "$(rpc_url "$n")")," == *",$1,"* ]] || return 1; done < <(running_nodes)
}
set_lacks() {
  local n
  while read -r n; do [[ ",$(validators "$(rpc_url "$n")")," != *",$1,"* ]] || return 1; done < <(running_nodes)
}

proposed_blocks() {
  local r
  r=$(rpc_call "$URL1" qbft_getSignerMetrics 2>/dev/null) || {
    printf 0
    return 0
  }
  r=$(jq -r --arg a "$1" '[.[] | select((.address | ascii_downcase) == $a) | .proposedBlockCount][0] // "0x0"' <<<"$r")
  hex_to_dec "$r"
}
has_proposed() { [ "$(proposed_blocks "$1")" -gt 0 ]; }

dev_index() { cat "$(node_dir "$1")/dev-index"; }

# render (from the node's own JSON-RPC) → copy → reload → check, on each given node; LP3 across them
apply_permissions() {
  local n url rendered out shared first=""
  for n in "$@"; do
    url=$(rpc_url "$n")
    if [ "$n" != 1 ]; then wait_for "node $n synced with node 1" "$SYNC_TIMEOUT" synced "$n" 1 || die "node $n not synced"; fi
    rendered="$(node_dir "$n")/permissions_config.rendered.toml"
    if ! out=$(TAMGA_CHAIN_RPC_URL="$url" trust_cli chain-permissions render --nodes "$NODES_DIR" --deployment "$DEPLOYMENT" --out "$rendered"); then
      printf '%s\n' "$out" >&2
      die "node $n: render failed or rejected a declaration"
    fi
    out=$(jq -cs 'last' <<<"$out") # the report is the last JSON value on stdout
    [ "$(jq '.missing_validator_nodes | length' <<<"$out")" = 0 ] || die "node $n: active validator without declaration: $out"
    cp "$rendered" "$(node_dir "$n")/permissions_config.toml"
    rpc_call "$url" perm_reloadPermissionsFromFile >/dev/null || die "node $n: perm_reloadPermissionsFromFile failed"
    if ! trust_cli chain-permissions check --file "$rendered" --node-rpc "$url" >"$(node_dir "$n")/permissions-check.json"; then
      cat "$(node_dir "$n")/permissions-check.json" >&2
      die "node $n: the node's allowlists differ from the rendered file"
    fi
    shared=$(jq -r .shared_sha256 <<<"$out")
    first=${first:-$shared}
    [ "$shared" = "$first" ] || die "LP3: node $n shared_sha256 $shared differs from $first"
    log "node $n: block $(jq -r .block <<<"$out") | accounts $(jq -r .accounts <<<"$out") | nodes $(jq -r .nodes <<<"$out") | shared_sha256 $shared | check equal"
    PERM_ACCOUNTS=$(jq -r .accounts <<<"$out")
    PERM_NODES=$(jq -r .nodes <<<"$out")
  done
  PERM_SHARED=$first
}

qbft_vote() { # qbft_vote <address> <true|false> <node…>
  local a=$1 v=$2 n
  shift 2
  for n in "$@"; do rpc_call "$(rpc_url "$n")" qbft_proposeValidatorVote "[\"$a\",$v]" >/dev/null || die "node $n: vote failed"; done
}
qbft_discard() {
  local a=$1 n
  shift
  for n in "$@"; do rpc_call "$(rpc_url "$n")" qbft_discardValidatorVote "[\"$a\"]" >/dev/null || true; done
}

# =========================================================================================================================
phase "1/10 network: start $N validators"
"${HELPER[@]}" check-keys --dir "$TESTNET_DIR" >/dev/null || die "node keys do not match the Hardhat test accounts"
for ((n = 1; n <= N; n++)); do "${NODE_SH[@]}" start "$n"; done
[ "$(hex_to_dec "$(rpc_call "$URL1" eth_chainId)")" = "$TESTNET_CHAIN_ID" ] || die "unexpected chainId"
mapfile -t GENESIS_NODES < <(seq 1 "$N")
wait_for "every validator peers with the $((N - 1)) others" 120 all_peered $((N - 1)) "${GENESIS_NODES[@]}" || die "nodes did not peer"
blocks_advance "$URL1" 3 60 || die "no blocks"
[ "$(validators "$URL1" | tr ',' '\n' | grep -c .)" = "$N" ] || die "validator set is not $N"
assert_loopback_only || die "a node listens on a non-loopback address"
row "validators (genesis)" "$N, every node with $((N - 1)) peers"
row "listening sockets" "${LISTEN_COUNT} (JSON-RPC + P2P), all 127.0.0.1"

# =========================================================================================================================
phase "2/10 contracts: deploy-dev.ts → besuDev"
TAMGA_BESU_RPC="$URL1" npm --prefix "$REPO_ROOT/contracts" run -s deploy:besu 2>&1 | tee "$TESTNET_DIR/deploy.log" >&2
[ -f "$DEPLOYMENT" ] || die "no deployment file"
[ "$(jq -r .chainId "$DEPLOYMENT")" = "$TESTNET_CHAIN_ID" ] || die "deployment file is for another chain"
cp "$DEPLOYMENT" "$TESTNET_DIR/deployment.json"
row "contracts" "$(jq '.contracts | length' "$DEPLOYMENT") (founders $(jq -r '[.founders[].code] | join(", ")' "$DEPLOYMENT"))"

# =========================================================================================================================
phase "3/10 replay + equivalence (signed list archive → contracts → index)"
t=$(date +%s)
if ! tsx_run "$REPO_ROOT/apps/chain-indexer/scripts/besu-smoke.ts" "$URL1" >"$TESTNET_DIR/replay.json" 2>"$TESTNET_DIR/replay.log"; then
  tail -n 40 "$TESTNET_DIR/replay.log" >&2
  die "replay / equivalence failed (report: $TESTNET_DIR/replay.json)"
fi
REPLAY=$(jq -s 'last' "$TESTNET_DIR/replay.json")
EQ_TOTAL=$(jq -r '.equivalence.total' <<<"$REPLAY")
EQ_DEC=$(jq -r '.equivalence.decisionDifferences' <<<"$REPLAY")
EQ_UNEXP=$(jq -r '.equivalence.unexpected' <<<"$REPLAY")
EQ_DIFF=$(jq -r '.equivalence.differences | length' <<<"$REPLAY")
if [ "$EQ_DEC" != 0 ] || [ "$EQ_UNEXP" != 0 ]; then die "equivalence: $EQ_DEC decision differences, $EQ_UNEXP unexpected"; fi
log "replay: $(jq -r .operations <<<"$REPLAY") operations in $(($(date +%s) - t)) s; equivalence $EQ_TOTAL questions, $EQ_DIFF known differences"
row "replay" "$(jq -r .operations <<<"$REPLAY") operations, $(($(date +%s) - t)) s"
row "equivalence (questions / decision differences / unexpected / known differences)" "$EQ_TOTAL / $EQ_DEC / $EQ_UNEXP / $EQ_DIFF"

# =========================================================================================================================
phase "4/10 anchoring: trust:chain-submit + trust:chain-check"
REGISTRY=$(jq -r '.anchor.registry' "$DEPLOYMENT")
if ! TAMGA_CHAIN_ENABLED=1 TAMGA_CHAIN_RPC_URL="$URL1" TAMGA_CHAIN_ANCHOR_REGISTRY="$REGISTRY" \
  TAMGA_CHAIN_ANCHORER_KEY="$ANCHORER_KEY" trust_cli chain-submit >"$TESTNET_DIR/chain-submit.json"; then
  cat "$TESTNET_DIR/chain-submit.json" >&2
  die "chain-submit failed"
fi
SUBMIT=$(jq -cs 'last' "$TESTNET_DIR/chain-submit.json")
[ "$(jq -r .conflicts <<<"$SUBMIT")" = 0 ] || die "chain-submit: conflicts"
WRITTEN=$(jq -r .written <<<"$SUBMIT")
[ "$WRITTEN" -ge 1 ] || die "chain-submit wrote nothing"
checked=0
for f in "$DIST"/lotl.jws "$DIST"/tl-*.jws; do
  [ -f "$f" ] || continue
  r=$(TAMGA_CHAIN_ENABLED=1 TAMGA_CHAIN_RPC_URL="$URL1" TAMGA_CHAIN_ANCHOR_REGISTRY="$REGISTRY" trust_cli chain-check "$f") ||
    die "chain-check $(basename "$f"): $r"
  r=$(jq -cs 'last' <<<"$r")
  [ "$(jq -r .anchored <<<"$r")" = YES ] || die "chain-check $(basename "$f"): $(jq -c . <<<"$r")"
  checked=$((checked + 1))
done
log "anchoring: $WRITTEN writes, $checked lists anchored (YES)"
row "anchoring" "$WRITTEN writes; chain-check YES for $checked lists"

# =========================================================================================================================
phase "5/10 Governance: admit the other genesis validators' states"
mkdir -p "$NODES_DIR"
rm -f "$NODES_DIR"/*.json
voters=$(dev_index 1),$(dev_index 2)
for ((n = 3; n <= N; n++)); do
  r=$("${HELPER[@]}" admit --rpc "$URL1" --deployment "$DEPLOYMENT" --state "$(node_state "$n")" \
    --validator-index "$(dev_index "$n")" --voters "$voters") || die "admission of $(node_state "$n") failed: ${r:-}"
  log "admitted: $r"
  voters="$voters,$(dev_index "$n")"
done
for ((n = 1; n <= N; n++)); do cp "$TESTNET_DIR"/declarations/*-node"$n".json "$NODES_DIR"/; done
row "Governance members" "$N ($(for ((n = 1; n <= N; n++)); do node_state "$n"; done | paste -sd, -))"

# =========================================================================================================================
phase "6/10 permissions from the chain on every node (render → reload → check, LP3)"
apply_permissions "${GENESIS_NODES[@]}"
wait_for "validators still peered after the reload" 60 all_peered $((N - 1)) "${GENESIS_NODES[@]}" || die "peers lost after reload"
blocks_advance "$URL1" 2 60 || die "no blocks after the permissions reload"
ACC=$("${HELPER[@]}" accounts --rpc "$URL1") || die "account permissioning: $ACC"
log "accounts: $ACC"
row "permissions (accounts / nodes / shared_sha256, equal on $N nodes)" "$PERM_ACCOUNTS / $PERM_NODES / \`${PERM_SHARED:0:16}…\`"
row "account permissioning" "unlisted #9 refused (\"$(jq -r .unlisted.refused <<<"$ACC" | cut -c1-60)\"), delegate #3 mined"

# =========================================================================================================================
if [ "$E" -ge 1 ]; then
  X=$((N + 1))
  ADDR_X="0x$(node_address "$X")"
  phase "7/10 validator vote: node $X ($(node_state "$X")) in and out"
  r=$("${HELPER[@]}" admit --rpc "$URL1" --deployment "$DEPLOYMENT" --state "$(node_state "$X")" \
    --validator-index "$(dev_index "$X")" --voters "$voters") || die "admission of $(node_state "$X") failed"
  log "admitted: $r"
  cp "$TESTNET_DIR"/declarations/*-node"$X".json "$NODES_DIR"/
  # the joining operator's first file, drawn through node 1 (its own node is not synced yet); redrawn from its own node below
  TAMGA_CHAIN_RPC_URL="$URL1" trust_cli chain-permissions render --nodes "$NODES_DIR" --deployment "$DEPLOYMENT" \
    --out "$(node_dir "$X")/permissions_config.toml" >/dev/null || die "render for node $X failed"
  apply_permissions "${GENESIS_NODES[@]}"
  "${NODE_SH[@]}" start "$X"
  wait_for "node $X synced with node 1" "$SYNC_TIMEOUT" synced "$X" 1 || die "node $X did not sync"
  wait_for "node $X peers with the $N validators" 120 all_peered "$N" "$X" || die "node $X did not peer"
  mapfile -t ALL_NODES < <(seq 1 "$X")
  apply_permissions "${ALL_NODES[@]}"
  row "joining node" "node $X synced and allow-listed on $X nodes (shared_sha256 equal)"

  need_add=$((N / 2 + 1))
  mapfile -t VOTERS < <(seq 1 "$need_add")
  t=$(date +%s)
  qbft_vote "$ADDR_X" true "${VOTERS[@]}"
  wait_for "$ADDR_X in the validator set on every node" 180 set_has "$ADDR_X" || die "add vote did not pass"
  qbft_discard "$ADDR_X" "${VOTERS[@]}"
  add_s=$(($(date +%s) - t))
  wait_for "node $X proposes a block" 120 has_proposed "$ADDR_X" || die "node $X never proposed a block"
  blocks_advance "$URL1" 3 60 || die "no blocks with $X validators"
  log "vote add: $need_add of $N votes, ${add_s}s; node $X proposed $(proposed_blocks "$ADDR_X") blocks"
  row "QBFT vote add" "$need_add of $N votes → $X validators in ${add_s} s; node $X proposed $(proposed_blocks "$ADDR_X") blocks"

  need_rm=$((X / 2 + 1))
  mapfile -t VOTERS < <(seq 1 "$need_rm")
  t=$(date +%s)
  qbft_vote "$ADDR_X" false "${VOTERS[@]}"
  wait_for "$ADDR_X out of the validator set on every node" 180 set_lacks "$ADDR_X" || die "remove vote did not pass"
  qbft_discard "$ADDR_X" "${VOTERS[@]}"
  rm_s=$(($(date +%s) - t))
  blocks_advance "$URL1" 3 60 || die "no blocks after the removal"
  "${NODE_SH[@]}" stop "$X"
  [ "$(validators "$URL1" | tr ',' '\n' | grep -c .)" = "$N" ] || die "validator set is not back to $N"
  row "QBFT vote remove" "$need_rm of $X votes → $N validators in ${rm_s} s; node $X stopped"
else
  phase "7/10 validator vote: skipped (--extra 0)"
  row "QBFT vote add/remove" "skipped (no extra node)"
fi

# =========================================================================================================================
F=$(((N - 1) / 3))
if [ "$F" -ge 1 ]; then
  phase "8/10 fault tolerance: f = $F of $N"
  STOPPED=()
  for ((k = 0; k < F; k++)); do
    "${NODE_SH[@]}" stop $((N - k))
    STOPPED+=($((N - k)))
  done
  blocks_advance "$URL1" 3 90 || die "blocks stopped with $F validator(s) down — expected to continue"
  b_ok=$(block_number "$URL1")
  log "with $((N - F)) of $N validators: blocks continue (block $b_ok)"
  extra_stop=$((N - F))
  "${NODE_SH[@]}" stop "$extra_stop"
  STOPPED+=("$extra_stop")
  sleep $((TESTNET_BLOCK_PERIOD * 5))
  b0=$(block_number "$URL1")
  sleep 20
  b1=$(block_number "$URL1")
  [ "$b1" = "$b0" ] || die "blocks continued with $((N - F - 1)) of $N validators ($b0 → $b1) — expected to stop"
  log "with $((N - F - 1)) of $N validators: no block in 20 s (block $b0)"
  t=$(date +%s)
  for ((k = ${#STOPPED[@]} - 1; k >= 0; k--)); do "${NODE_SH[@]}" start "${STOPPED[$k]}"; done
  blocks_advance "$URL1" 3 "$RESUME_TIMEOUT" || die "blocks did not resume after the restart"
  resume_s=$(($(date +%s) - t))
  for n in "${STOPPED[@]}"; do wait_for "node $n synced again" "$SYNC_TIMEOUT" synced "$n" 1 || die "node $n did not resync"; done
  log "restarted: blocks resumed after ${resume_s}s"
  row "fault tolerance" "$F down → blocks continue; $((F + 1)) down → stopped (block $b0, 20 s); restart → resumed in ${resume_s} s"
else
  phase "8/10 fault tolerance: skipped (N = $N < 4)"
  row "fault tolerance" "skipped (fewer than 4 validators)"
fi

# =========================================================================================================================
phase "9/10 RPC protection (filter.mjs + nginx mTLS)"
bash "$TESTNET_LIB_DIR/rpc-proxy-check.sh" --upstream "$URL1" "${PROXY_ARGS[@]}" || die "RPC protection check failed"
row "RPC protection" "$(jq -r '"\(.checks) checks passed; nginx mTLS tested: \(.nginx_mtls)"' "$TESTNET_DIR/rpc-proxy.json")"

# =========================================================================================================================
phase "10/10 summary"
assert_loopback_only || die "a node listens on a non-loopback address"
"${NODE_SH[@]}" status all >&2 || true
row "final block" "$(block_number "$URL1")"
row "validators (final)" "$(validators "$URL1" | tr ',' '\n' | grep -c .)"
row "block period" "$TESTNET_BLOCK_PERIOD s"
res=""
while read -r n; do
  pid=$(node_pid "$n")
  read -r rss cpu < <(ps -o rss= -o times= -p "$pid")
  disk=$(du -sk "$(node_dir "$n")/db" | cut -f1)
  res="$res node $n: $((rss / 1024)) MiB RSS, ${cpu} s CPU, $((disk / 1024)) MiB disk;"
done < <(running_nodes)
row "resources (measured, heap -Xmx${TESTNET_HEAP:-768m})" "${res# }"
row "host" "$(nproc) CPU, $(awk '/MemTotal/ {printf "%d MiB", $2/1024}' /proc/meminfo) RAM"
