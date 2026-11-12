#!/usr/bin/env bash
# network/testnet/bootstrap-governance.sh — GUIDE-0018 path C: sets up the contracts and Governance of a test/staging network
# written by make-network.sh --keys generate (chain id 31339) with the GENERATED keys of the key map <dir>/keys/keys.json
# (tamga-chain-keys/1) — never with Hardhat's public test keys. Every step is logged and idempotent: a re-run skips what is done.
#
#   1 network      the nodes answer, blocks grow, the QBFT set has N validators, the chain id is the test/staging id
#   2 contracts    contracts/scripts/deploy-network.ts: founders TR + KZ and their delegates, founder recognition by Governance
#                  vote, list anchor registry administered by Governance (anchorers and threshold from the key map)
#                  → <dir>/deployment.json (skipped when the deployment answers on the chain)
#   3 governance   the other genesis validators' states admitted by 2/3 vote; each sets its delegate key with its validator
#   4 permissions  on every node of --nodes: trust:chain-permissions render (from its own node) → load → check; shared_sha256
#                  equal (LP3); the deployer is no longer listed (ADR-0052 K2); an unlisted account refused, a delegate mined
#   5 anchoring    trust:chain-submit once per anchorer (threshold of the key map) → trust:chain-check YES for every list
#   6 replay       (optional) migration windows opened by vote → permissions rendered again: the executor of the open window is
#                  listed (ADR-0052, note of 2026-11-05) → sample list archive replayed with the key map → equivalence
#   7 summary      <dir>/bootstrap-summary.md + .json (also appended to $GITHUB_STEP_SUMMARY)
#
#   bash network/testnet/bootstrap-governance.sh [--nodes "1 2 3 4"] [--rpc-node 1] [--no-replay] [--start] [--only permissions]
#     --nodes      nodes whose JSON-RPC answers on this host and whose permissions file this run writes (default: every genesis
#                  validator — all nodes on one host). One node per server (make-network.sh --hosts): on the server that holds
#                  the whole make-network output run the full bootstrap with --nodes <its node>; copy deployment.json and nodes/
#                  to the other servers and run there: --only permissions --nodes <its node>
#     --rpc-node   the node used for deploying, voting and anchoring (default: the first of --nodes)
#     --no-replay  skip step 6
#     --start      start the nodes of --nodes first (node.sh start; TESTNET_MODE=process|systemd)
#     --only permissions   step 4 only (no keys needed)
# Environment: TESTNET_DIR (network directory, default network/testnet/run), TAMGA_CHAIN_KEYS (key map, default
# <dir>/keys/keys.json), TESTNET_MODE (process|systemd). Prerequisites (repository root): npm ci && npm run setup &&
# npm run contracts:install && npm run contracts:compile.
# Only the test/staging chain id is accepted; there is no production path here (ADR-0009 K4; production keys live in HSMs).
#
# Yol C kurulumu: üretilmiş anahtarlarla kontratlar → Governance kabulü → izin listesi her düğümde zincirden → liste çapası →
# (isteğe bağlı) göç penceresi + yeniden oynatma + eşdeğerlik → özet. Her adım günlüklü ve yeniden çalıştırılabilir.
set -euo pipefail
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

NODES_ARG=""
RPC_NODE=""
REPLAY=1
START=0
ONLY=""
while [ $# -gt 0 ]; do
  case "$1" in
    --nodes) NODES_ARG=$2; shift 2 ;;
    --rpc-node) RPC_NODE=$2; shift 2 ;;
    --no-replay) REPLAY=0; shift ;;
    --start) START=1; shift ;;
    --only) ONLY=$2; shift 2 ;;
    -h | --help) sed -n '2,30p' "$0"; exit 0 ;;
    *) die "unknown option: $1" ;;
  esac
done
case "$ONLY" in "" | permissions) ;; *) die "--only permissions" ;; esac
need node jq curl
load_network
cd "$REPO_ROOT"

[ "$TESTNET_KEYS" = generate ] ||
  die "bootstrap-governance.sh needs make-network.sh --keys generate (path B with the public test keys: deploy-and-wire.sh)"
[ "$TESTNET_CHAIN_ID" = "$STAGING_CHAIN_ID" ] || die "chain id $TESTNET_CHAIN_ID is not the test/staging id $STAGING_CHAIN_ID"
[ -f "$REPO_ROOT/node_modules/tsx/dist/cli.mjs" ] || die "root packages missing — npm ci"

N=$TESTNET_VALIDATORS
if [ -n "$NODES_ARG" ]; then read -r -a NODES <<<"$NODES_ARG"; else mapfile -t NODES < <(seq 1 "$N"); fi
for n in "${NODES[@]}"; do
  if ! [[ "$n" =~ ^[1-9][0-9]*$ ]] || [ "$n" -gt "$(node_count)" ]; then die "--nodes: bad node $n"; fi
done
RPC_NODE=${RPC_NODE:-${NODES[0]}}
URL=$(rpc_url "$RPC_NODE")
DEPLOYMENT="$TESTNET_DIR/deployment.json"
NODES_DIR="$TESTNET_DIR/nodes" # declarations of the admitted members — input of trust:chain-permissions render
DIST=${TAMGA_TP_DIST:-$REPO_ROOT/apps/trust-publisher/dist}
MODE=${TESTNET_MODE:-process}
NODE_SH=(bash "$TESTNET_LIB_DIR/node.sh")
HELPER=(node "$TESTNET_LIB_DIR/testnet.mjs")
KEYMAP=${TAMGA_CHAIN_KEYS:-$TESTNET_DIR/keys/keys.json}
if [ "$ONLY" != permissions ]; then
  [ -f "$KEYMAP" ] || die "no key map $KEYMAP (make-network.sh --keys generate writes it for a network of two or more validators)"
  KEYMAP="$(cd "$(dirname "$KEYMAP")" && pwd)/$(basename "$KEYMAP")" # absolute: npm --prefix changes the directory
  KEYDIR=$(dirname "$KEYMAP")
  [ -d "$REPO_ROOT/contracts/node_modules" ] || die "contract packages missing — npm run contracts:install && npm run contracts:compile"
  [ -f "$DIST/lotl.jws" ] || die "no signed lists in $DIST — npm run setup"
fi
export TAMGA_CHAIN_KEYS="$KEYMAP" TAMGA_CHAIN_DEPLOYMENT="$DEPLOYMENT"

SUMMARY=()
row() { SUMMARY+=("| $1 | $2 |"); }
CURRENT=""
T0=$(date +%s)
phase() {
  CURRENT=$1
  step "$1"
}

write_summary() {
  local status=$1 md="$TESTNET_DIR/bootstrap-summary.md"
  {
    printf '## Tamga test network, path C — Governance bootstrap with generated keys (chain %s, %s mode) — %s\n\n' \
      "$TESTNET_CHAIN_ID" "$MODE" "$status"
    printf '| | |\n|---|---|\n'
    printf '%s\n' "${SUMMARY[@]}"
    printf '| duration | %s s |\n' "$(($(date +%s) - T0))"
    [ "$status" = PASSED ] || printf '\n**Failed at:** %s\n' "$CURRENT"
  } >"$md"
  printf '%s\n' "${SUMMARY[@]}" | sed -n 's/^| \(.*\) | \(.*\) |$/\1\t\2/p' |
    jq -R 'split("\t") | {(.[0]): .[1]}' | jq -s --arg s "$status" --arg at "$CURRENT" 'add + {status: $s, failed_at: (if $s == "PASSED" then null else $at end)}' \
      >"$TESTNET_DIR/bootstrap-summary.json" || true
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then cat "$md" >>"$GITHUB_STEP_SUMMARY"; fi
  cat "$md" >&2
}

on_exit() {
  local rc=$?
  if [ "$rc" = 0 ]; then
    write_summary PASSED
  else
    log "FAILED during: $CURRENT (exit $rc)"
    for n in "${NODES[@]}"; do
      printf '\n----- node %s: last log lines -----\n' "$n" >&2
      if [ "$MODE" = systemd ]; then
        journalctl -u "besu@node$n" -n 30 --no-pager >&2 || true
      elif [ -f "$(node_dir "$n")/besu.log" ]; then tail -n 30 "$(node_dir "$n")/besu.log" >&2 || true; fi
    done
    write_summary FAILED || true
  fi
}
trap on_exit EXIT

# --- helpers ----------------------------------------------------------------------------------------------------------------
all_peered() {
  local n want=$1
  shift
  for n in "$@"; do [ "$(peer_count "$(rpc_url "$n")")" -ge "$want" ] || return 1; done
}

# the permissions file belongs to the node's user (Besu rewrites it on perm_reloadPermissionsFromFile; systemd: user besu)
install_for_node() {
  cp "$1" "$2"
  if [ "$(id -u)" = 0 ]; then chown --reference="$(dirname "$2")" "$2"; fi
}

# render (from the node's own JSON-RPC) → install → reload → check, on every node of --nodes; LP3 across them
apply_permissions() {
  local n url rendered out shared first=""
  for n in "${NODES[@]}"; do
    url=$(rpc_url "$n")
    if [ "$n" != "$RPC_NODE" ]; then
      wait_for "node $n synced with node $RPC_NODE" 180 synced "$n" "$RPC_NODE" || die "node $n not synced"
    fi
    rendered="$(node_dir "$n")/permissions_config.rendered.toml"
    if ! out=$(TAMGA_CHAIN_ENABLED=1 TAMGA_CHAIN_RPC_URL="$url" trust_cli chain-permissions render --nodes "$NODES_DIR" \
      --deployment "$DEPLOYMENT" --out "$rendered"); then
      printf '%s\n' "$out" >&2
      die "node $n: render failed or rejected a declaration"
    fi
    out=$(jq -cs 'last' <<<"$out") # the report is the last JSON value on stdout
    [ "$(jq '.missing_validator_nodes | length' <<<"$out")" = 0 ] || die "node $n: active validator without declaration: $out"
    install_for_node "$rendered" "$(node_dir "$n")/permissions_config.toml"
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
    PERM_FILE=$rendered
  done
  PERM_SHARED=$first
  wait_for "nodes still peered after the reload" 60 all_peered $((${#NODES[@]} - 1)) "${NODES[@]}" || die "peers lost after reload"
  blocks_advance "$URL" 2 60 || die "no blocks after the permissions reload"
}
listed() { grep -qi "${1#0x}" "$PERM_FILE"; }

main_pid() {
  if [ "$MODE" = systemd ]; then systemctl show -p MainPID --value "besu@node$1" 2>/dev/null; else node_pid "$1" || true; fi
}

# =========================================================================================================================
phase "1/7 network"
if [ "$START" = 1 ]; then for n in "${NODES[@]}"; do "${NODE_SH[@]}" start "$n"; done; fi
chain=$(hex_to_dec "$(rpc_call "$URL" eth_chainId)") || die "node $RPC_NODE does not answer ($URL)"
[ "$chain" = "$STAGING_CHAIN_ID" ] || die "the node reports chain id $chain — this script runs only on the test/staging id $STAGING_CHAIN_ID"
blocks_advance "$URL" 2 60 || die "no blocks"
[ "$(validators "$URL" | tr ',' '\n' | grep -c .)" = "$N" ] || die "the QBFT validator set is not $N"
wait_for "the nodes of --nodes peer with each other" 120 all_peered $((${#NODES[@]} - 1)) "${NODES[@]}" || die "nodes did not peer"
row "network" "chain $chain, $N validators, nodes here: ${NODES[*]} ($MODE mode)"
if [ "$ONLY" != permissions ]; then
  km=$("${HELPER[@]}" check-keymap --keys "$KEYMAP") || die "key map invalid: $KEYMAP"
  log "key map: $km"
  row "key map" "$(jq -r '"\(.states | length) states (founders \([.states[] | select(.founder) | .code] | join(", "))), \(.anchor.anchorers | length) anchorers (threshold \(.anchor.threshold)), executor \(.migration_executor[0:10])…"' <<<"$km")"
fi

if [ "$ONLY" != permissions ]; then
  # =======================================================================================================================
  phase "2/7 contracts: deploy-network.ts → besuStaging"
  gov_code() { rpc_call "$URL" eth_getCode "[\"$(jq -r .contracts.Governance "$DEPLOYMENT")\",\"latest\"]" 2>/dev/null; }
  if [ -f "$DEPLOYMENT" ] && [ "$(jq -r .chainId "$DEPLOYMENT")" = "$chain" ] && [ "$(gov_code)" != '"0x"' ] && [ -n "$(gov_code)" ]; then
    log "already deployed: Governance $(jq -r .contracts.Governance "$DEPLOYMENT") answers — skipped"
    row "contracts" "already deployed ($(jq '.contracts | length' "$DEPLOYMENT") contracts) — skipped"
  else
    TAMGA_CHAIN_RPC_URL="$URL" npm --prefix "$REPO_ROOT/contracts" run -s deploy:network 2>&1 | tee "$TESTNET_DIR/deploy.log" >&2
    cp "$REPO_ROOT/contracts/deployments/besuStaging.json" "$DEPLOYMENT"
    [ "$(jq -r .chainId "$DEPLOYMENT")" = "$chain" ] || die "deployment file is for another chain"
    row "contracts" "$(jq '.contracts | length' "$DEPLOYMENT") deployed by $(jq -r '.deployer[0:10]' "$DEPLOYMENT")… (founders $(jq -r '[.founders[].code] | join(", ")' "$DEPLOYMENT"); founder recognition: $(jq -r .founderRecognition "$DEPLOYMENT"); anchor threshold $(jq -r .anchor.requiredConfirmations "$DEPLOYMENT") of $(jq '.anchor.anchorers | length' "$DEPLOYMENT"), admin Governance)"
  fi

  # =======================================================================================================================
  phase "3/7 Governance: admit the other genesis validators' states"
  admitted=()
  for ((n = 1; n <= N; n++)); do
    st=$(node_state "$n")
    if [ "$(jq -r --arg c "$st" '.states[] | select(.code == $c) | .founder' "$KEYMAP")" = true ]; then continue; fi
    r=$("${HELPER[@]}" admit --rpc "$URL" --deployment "$DEPLOYMENT" --state "$st" --keys "$KEYMAP") ||
      die "admission of $st failed: ${r:-}"
    log "admission: $r"
    admitted+=("$st$(jq -r 'if .already then " (already)" else " (\(.votes) votes, \(.required) required)" end' <<<"$r")")
  done
  members=$(for ((n = 1; n <= N; n++)); do node_state "$n"; done | paste -sd, -)
  row "Governance members" "$N ($members); admitted by vote: ${admitted[*]:-none}"
fi
mkdir -p "$NODES_DIR"
for ((n = 1; n <= N; n++)); do cp "$TESTNET_DIR"/declarations/*-node"$n".json "$NODES_DIR"/ 2>/dev/null || true; done

# =========================================================================================================================
phase "4/7 permissions from the chain on every node (render → load → check, LP3)"
[ -f "$DEPLOYMENT" ] || die "no $DEPLOYMENT (copy it from the server that ran the full bootstrap)"
apply_permissions
row "permissions (accounts / nodes / shared_sha256, equal on ${#NODES[@]} nodes)" "$PERM_ACCOUNTS / $PERM_NODES / \`${PERM_SHARED:0:16}…\`"
if [ "$ONLY" != permissions ]; then
  deployer=$(jq -r .deployer "$DEPLOYMENT")
  if listed "$deployer"; then die "the deployer $deployer is still listed after rendering from the chain (ADR-0052 K2)"; fi
  ACC=$("${HELPER[@]}" accounts --rpc "$URL" --keys "$KEYMAP") || die "account permissioning: ${ACC:-}"
  log "accounts: $ACC"
  row "account permissioning" "deployer no longer listed; random unlisted key refused (\"$(jq -r .unlisted.refused <<<"$ACC" | cut -c1-50)\"), founder delegate mined"
fi

if [ "$ONLY" != permissions ]; then
  # =======================================================================================================================
  phase "5/7 anchoring: trust:chain-submit per anchorer + trust:chain-check"
  REGISTRY=$(jq -r .anchor.registry "$DEPLOYMENT")
  THRESHOLD=$(jq -r .anchor.threshold "$KEYMAP")
  written=0
  i=0
  while read -r kf; do
    kf=${kf%$'\r'}
    i=$((i + 1))
    [ "$i" -le "$THRESHOLD" ] || break
    case "$kf" in /*) ;; *) kf="$KEYDIR/$kf" ;; esac
    if ! TAMGA_CHAIN_ENABLED=1 TAMGA_CHAIN_RPC_URL="$URL" TAMGA_CHAIN_ANCHOR_REGISTRY="$REGISTRY" \
      TAMGA_CHAIN_ANCHORER_KEY="$(tr -d '[:space:]' <"$kf")" trust_cli chain-submit >"$TESTNET_DIR/chain-submit-$i.json"; then
      cat "$TESTNET_DIR/chain-submit-$i.json" >&2
      die "chain-submit (anchorer $i) failed"
    fi
    s=$(jq -cs 'last' "$TESTNET_DIR/chain-submit-$i.json")
    [ "$(jq -r .conflicts <<<"$s")" = 0 ] || die "chain-submit (anchorer $i): conflicts"
    written=$((written + $(jq -r .written <<<"$s")))
    log "anchorer $i: $(jq -r .written <<<"$s") writes"
  done < <(jq -r '.anchor.anchorers[].key' "$KEYMAP")
  checked=0
  for f in "$DIST"/lotl.jws "$DIST"/tl-*.jws; do
    [ -f "$f" ] || continue
    r=$(TAMGA_CHAIN_ENABLED=1 TAMGA_CHAIN_RPC_URL="$URL" TAMGA_CHAIN_ANCHOR_REGISTRY="$REGISTRY" trust_cli chain-check "$f") ||
      die "chain-check $(basename "$f"): $r"
    r=$(jq -cs 'last' <<<"$r")
    [ "$(jq -r .anchored <<<"$r")" = YES ] || die "chain-check $(basename "$f"): $(jq -c . <<<"$r")"
    checked=$((checked + 1))
  done
  log "anchoring: $written writes by $THRESHOLD anchorers; $checked lists anchored (YES)"
  row "anchoring" "$written writes by $THRESHOLD anchorers (threshold $THRESHOLD); chain-check YES for $checked lists"

  # =======================================================================================================================
  if [ "$REPLAY" = 1 ]; then
    phase "6/7 replay: migration windows → permissions with the executor → replay + equivalence"
    ARCHIVE="$TESTNET_DIR/replay-archive"
    SMOKE="$REPO_ROOT/apps/chain-indexer/scripts/besu-smoke.ts"
    if [ -f "$TESTNET_DIR/replay.json" ] &&
      jq -se 'last | .equivalence.decisionDifferences == 0 and .equivalence.unexpected == 0' "$TESTNET_DIR/replay.json" >/dev/null 2>&1; then
      log "replay already done and equivalent — skipped"
      row "replay" "already done — skipped"
    else
      t=$(date +%s)
      if ! tsx_run "$SMOKE" "$URL" --archive-dir "$ARCHIVE" --open-only >"$TESTNET_DIR/replay-open.json" 2>"$TESTNET_DIR/replay.log"; then
        tail -n 40 "$TESTNET_DIR/replay.log" >&2
        die "opening the migration windows failed"
      fi
      executor=$(jq -r .migration_executor.address "$KEYMAP")
      log "migration windows open (plan $(jq -rs 'last | .replayPlanHash' "$TESTNET_DIR/replay-open.json"), executor $executor)"
      apply_permissions
      listed "$executor" || die "the migration executor $executor is not listed while its window is open"
      row "migration window" "open by Governance vote; executor listed on ${#NODES[@]} nodes (accounts $PERM_ACCOUNTS)"
      if ! tsx_run "$SMOKE" "$URL" --archive-dir "$ARCHIVE" >"$TESTNET_DIR/replay.json" 2>>"$TESTNET_DIR/replay.log"; then
        tail -n 40 "$TESTNET_DIR/replay.log" >&2
        die "replay / equivalence failed (report: $TESTNET_DIR/replay.json)"
      fi
      REP=$(jq -s 'last' "$TESTNET_DIR/replay.json")
      eq_dec=$(jq -r '.equivalence.decisionDifferences' <<<"$REP")
      eq_unexp=$(jq -r '.equivalence.unexpected' <<<"$REP")
      if [ "$eq_dec" != 0 ] || [ "$eq_unexp" != 0 ]; then die "equivalence: $eq_dec decision differences, $eq_unexp unexpected"; fi
      row "replay" "$(jq -r '"\(.report.written) written, \(.report.skipped) skipped of \(.operations)"' <<<"$REP"), $(($(date +%s) - t)) s"
      row "equivalence (questions / decision differences / unexpected / known differences)" \
        "$(jq -r '.equivalence.total' <<<"$REP") / $eq_dec / $eq_unexp / $(jq -r '.equivalence.differences | length' <<<"$REP")"
    fi
  else
    phase "6/7 replay: skipped (--no-replay)"
    row "replay" "skipped (--no-replay)"
  fi
fi

# =========================================================================================================================
phase "7/7 summary"
row "final block" "$(block_number "$URL")"
row "validators" "$(validators "$URL" | tr ',' '\n' | grep -c .)"
res=""
for n in "${NODES[@]}"; do
  pid=$(main_pid "$n")
  if [ -n "$pid" ] && [ "$pid" != 0 ] && read -r rss cpu < <(ps -o rss= -o times= -p "$pid" 2>/dev/null); then
    res="$res node $n: $((rss / 1024)) MiB RSS, ${cpu} s CPU;"
  fi
done
row "resources" "${res# }"
