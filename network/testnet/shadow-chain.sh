#!/usr/bin/env bash
# network/testnet/shadow-chain.sh — "shadow chain" on ONE Linux server (GUIDE-0018 "Gölge zincir"; ADR-0084 K6 step 2, test network):
# an N-validator Besu QBFT test chain (chain id 31339, generated keys) onto which the REAL network's signed lists are projected.
# The real network is only READ (public signed lists over HTTPS); nothing is ever written to it. The signed lists stay the source,
# the shadow chain only witnesses them (ADR-0084 LS1); production stays without a chain (ADR-0009 K4).
#
#   bash network/testnet/shadow-chain.sh setup  [--validators 4] [--source https://trust.tamga.network] [--mode process|systemd]
#                                               [--expect-root <fp,…>] [--dry-run]
#   bash network/testnet/shadow-chain.sh sync   [--source …] [--expect-root <fp,…>] [--dry-run]     # hourly (cron / systemd timer)
#   bash network/testnet/shadow-chain.sh report                                                    # summary of the last runs
#
# setup — once, idempotent (a re-run skips what is done):
#   1 tools      install-besu.sh (JDK 25 + Besu, sha256 pinned; --mode systemd: --system, needs root)
#   2 network    make-network.sh --validators N --extra 0 --keys generate (chain id 31339; key map <dir>/keys/keys.json)
#   3 nodes      node.sh start all
#   4 lists      apps/chain-indexer/scripts/mirror-lists.ts: the real network's signed lists + archive → <dir>/replay-archive
#                (read only; verified: signatures, version chain, anchor chain)
#   5 bootstrap  bootstrap-governance.sh with those lists: contracts, Governance (governance keys, ADR-0086), permissions from the
#                chain on every node, list anchoring by both anchorers, migration window by vote + replay of the REAL archive +
#                equivalence (list = chain); the replay writes the continuous-projection start point (chain-sync.json, ADR-0085)
#   6 report     <dir>/shadow-report.json + .md (mirror, bootstrap summary, equivalence, chain health)
# sync — after every publication of the real network (hourly is enough): mirror again (new versions only) → trust:chain-sync
#   (continuous projection, ADR-0085) → trust:chain-submit by each anchorer of the key map → trust:chain-health → report.
#   A failed step raises an alarm in the report and in the exit code; it never touches the real network.
#
# --dry-run prints every command instead of running it and checks the arguments only (no tools, no network) — runnable anywhere,
# also in CI (`testnet` workflow, lint job). Environment: TESTNET_DIR (default network/testnet/shadow), TESTNET_MODE.
# Prerequisites (repository root, not in --dry-run): npm ci && npm run contracts:install && npm run contracts:compile.
#
# Gölge zincir: tek Linux sunucuda N doğrulayıcılı test zinciri; canlı ağın imzalı listeleri yalnız OKUNUR (HTTPS GET), test
# zincirine yansıtılır; canlı ağa hiçbir şey yazılmaz. Kurulum bir kez (`setup`), eşitleme saatte bir (`sync`), özet (`report`).
set -euo pipefail
SHADOW_DIR=${TESTNET_DIR:-} # lib.sh sets its own default (run/); the shadow chain has its own (shadow/)
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

CMD=${1:-}
[ $# -gt 0 ] && shift
N=4
SOURCE="https://trust.tamga.network"
MODE=${TESTNET_MODE:-process}
EXPECT_ROOT=""
DRY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --validators) N=$2; shift 2 ;;
    --source) SOURCE=$2; shift 2 ;;
    --mode) MODE=$2; shift 2 ;;
    --expect-root) EXPECT_ROOT=$2; shift 2 ;;
    --dry-run) DRY=1; shift ;;
    -h | --help) sed -n '2,32p' "$0"; exit 0 ;;
    *) die "unknown option: $1" ;;
  esac
done
case "$CMD" in setup | sync | report) ;; *) die "usage: shadow-chain.sh setup|sync|report [options] (--help)" ;; esac
if ! [[ "$N" =~ ^[0-9]+$ ]] || [ "$N" -lt 4 ]; then
  die "--validators must be >= 4 (QBFT 3f+1: one faulty validator tolerated)"
fi
case "$MODE" in process | systemd) ;; *) die "--mode process|systemd" ;; esac
if ! [[ "$SOURCE" =~ ^https://[A-Za-z0-9.-]+(:[0-9]+)?$ ]]; then
  die "--source must be https://<host> (the real network is read over HTTPS only)"
fi
if [ -n "$EXPECT_ROOT" ] && ! [[ "$EXPECT_ROOT" =~ ^[0-9a-fA-F]{64}(,[0-9a-fA-F]{64})*$ ]]; then
  die "--expect-root: sha256 hex, comma separated"
fi

export TESTNET_DIR="${SHADOW_DIR:-$TESTNET_LIB_DIR/shadow}"
export TESTNET_MODE="$MODE"
ARCHIVE="$TESTNET_DIR/replay-archive"
# the publisher's commands read the mirrored lists as their output folder; environment "production" (no registry here)
export TAMGA_TP_DIST="$ARCHIVE" TAMGA_TP_REGISTRY="$TESTNET_DIR/no-registry"
KEYMAP="$TESTNET_DIR/keys/keys.json"
DEPLOYMENT="$TESTNET_DIR/deployment.json"
REPORT_JSON="$TESTNET_DIR/shadow-report.json"
REPORT_MD="$TESTNET_DIR/shadow-report.md"
STEPS=()

# run <description> <command…> — executes, or in --dry-run prints the command
run() {
  local what=$1
  shift
  if [ "$DRY" = 1 ]; then
    printf '[dry-run] %-34s %s\n' "$what" "$*"
    STEPS+=("$what")
    return 0
  fi
  log "$what: $*"
  "$@"
}

mirror_args() {
  local a=(--base "$SOURCE" --out "$ARCHIVE" --environment production)
  [ -z "$EXPECT_ROOT" ] || a+=(--expect-root "$EXPECT_ROOT")
  printf '%s\n' "${a[@]}"
}

chain_env() {
  # the test chain only: RPC of node 1, key map and deployment of this directory; the flag is on for these commands only
  local rpc
  rpc="http://127.0.0.1:$(sed -n 's/^TESTNET_RPC_PORTS=(\([0-9]*\).*/\1/p' "$TESTNET_DIR/network.env")"
  printf 'TAMGA_CHAIN_ENABLED=1\nTAMGA_CHAIN_RPC_URL=%s\nTAMGA_CHAIN_KEYS=%s\nTAMGA_CHAIN_DEPLOYMENT=%s\nTAMGA_TP_DIST=%s\n' \
    "$rpc" "$KEYMAP" "$DEPLOYMENT" "$ARCHIVE"
  [ ! -f "$DEPLOYMENT" ] || printf 'TAMGA_CHAIN_ANCHOR_REGISTRY=%s\n' "$(jq -r .anchor.registry "$DEPLOYMENT")"
}

with_chain_env() {
  local -a envs=()
  local line
  while IFS= read -r line; do envs+=("$line"); done < <(chain_env)
  env "${envs[@]}" "$@"
}

write_report() {
  local phase=$1 status=$2 health=${3:-} sync=${4:-}
  mkdir -p "$TESTNET_DIR"
  jq -n --arg phase "$phase" --arg status "$status" --arg at "$(date -u +%FT%TZ)" --arg source "$SOURCE" \
    --argjson mirror "$(cat "$TESTNET_DIR/mirror.json" 2>/dev/null || echo null)" \
    --argjson bootstrap "$(cat "$TESTNET_DIR/bootstrap-summary.json" 2>/dev/null || echo null)" \
    --argjson replay "$(jq -s 'last' "$TESTNET_DIR/replay.json" 2>/dev/null || echo null)" \
    --argjson health "${health:-null}" --argjson sync "${sync:-null}" \
    '{format: "tamga-shadow-report/1", phase: $phase, status: $status, at: $at, source: $source,
      mirror: (if $mirror then {lists: $mirror.lists, anchorLines: $mirror.anchorLines, downloaded: $mirror.downloaded} else null end),
      equivalence: (if $replay then $replay.equivalence else null end),
      bootstrap: $bootstrap, sync: $sync, health: $health}' >"$REPORT_JSON"
  {
    printf '## Shadow chain (%s) — %s — %s\n\n' "$SOURCE" "$phase" "$status"
    printf '| | |\n|---|---|\n'
    jq -r '"| lists mirrored | \(.mirror.lists // {} | to_entries | map("\(.key) v\(.value.current)") | join(", ")) |",
           "| equivalence (questions / decision differences / unexpected) | \(.equivalence.total // "–") / \(.equivalence.decisionDifferences // "–") / \(.equivalence.unexpected // "–") |",
           "| continuous projection | \(.sync.report.written // .sync.operations // "–") written, complete: \(.sync.report.complete // "–") |",
           "| chain health | \(.health.status // "–") \(.health.alarms // [] | map(.code) | join(" ")) |"' "$REPORT_JSON"
  } >"$REPORT_MD"
  cat "$REPORT_MD" >&2
}

# ==========================================================================================================================
if [ "$CMD" = setup ]; then
  if [ "$DRY" = 0 ]; then
    need node jq curl
    [ -d "$REPO_ROOT/node_modules" ] || die "npm ci first (repository root)"
    [ -d "$REPO_ROOT/contracts/node_modules" ] || die "npm run contracts:install && npm run contracts:compile first"
  fi
  step "1/6 tools"
  if [ "$MODE" = systemd ]; then
    run "install JDK 25 + Besu (system)" bash "$TESTNET_LIB_DIR/install-besu.sh" --system
  else
    run "install JDK 25 + Besu" bash "$TESTNET_LIB_DIR/install-besu.sh"
  fi
  step "2/6 network ($N validators, generated keys, chain id $STAGING_CHAIN_ID)"
  if [ "$DRY" = 0 ] && [ -f "$TESTNET_DIR/network.env" ]; then
    log "network exists in $TESTNET_DIR — skipped"
  else
    besu_home=()
    [ "$MODE" != systemd ] || besu_home=(--besu-home /opt/tamga-besu/besu --java-home /opt/tamga-besu/jdk-25)
    run "write the network" bash "$TESTNET_LIB_DIR/make-network.sh" --validators "$N" --extra 0 --keys generate \
      --chain-id "$STAGING_CHAIN_ID" --dir "$TESTNET_DIR" "${besu_home[@]}"
  fi
  step "3/6 nodes"
  run "start the nodes" bash "$TESTNET_LIB_DIR/node.sh" start all
  step "4/6 the real network's signed lists (read only)"
  mapfile -t margs < <(mirror_args)
  if [ "$DRY" = 1 ]; then
    run "mirror the signed lists" tsx_run "$REPO_ROOT/apps/chain-indexer/scripts/mirror-lists.ts" "${margs[@]}"
  else
    mkdir -p "$ARCHIVE"
    tsx_run "$REPO_ROOT/apps/chain-indexer/scripts/mirror-lists.ts" "${margs[@]}" >"$TESTNET_DIR/mirror.json" ||
      die "mirroring the signed lists failed"
    log "mirror: $(jq -c '{lists, anchorLines, downloaded}' "$TESTNET_DIR/mirror.json")"
  fi
  step "5/6 bootstrap with the real lists (contracts, Governance, permissions, anchoring, migration + replay + equivalence)"
  run "bootstrap" bash "$TESTNET_LIB_DIR/bootstrap-governance.sh"
  step "6/6 report"
  if [ "$DRY" = 1 ]; then
    run "chain health" trust_cli chain-health
    printf '[dry-run] %d steps; nothing was executed\n' "${#STEPS[@]}"
    exit 0
  fi
  health=$(with_chain_env node "$REPO_ROOT/node_modules/tsx/dist/cli.mjs" "$REPO_ROOT/apps/trust-publisher/src/cli.ts" chain-health) || true
  write_report setup "$(jq -r '.status // "error"' <<<"${health:-null}")" "$health"
  exit 0
fi

# ==========================================================================================================================
if [ "$CMD" = sync ]; then
  if [ "$DRY" = 0 ]; then
    need node jq curl
    load_network
    [ -f "$DEPLOYMENT" ] || die "no $DEPLOYMENT — run: shadow-chain.sh setup"
    [ -f "$ARCHIVE/chain-sync.json" ] || die "no continuous-projection start point ($ARCHIVE/chain-sync.json) — setup's replay did not finish equivalent"
  fi
  mapfile -t margs < <(mirror_args)
  rc=0
  if [ "$DRY" = 1 ]; then
    run "mirror new versions" tsx_run "$REPO_ROOT/apps/chain-indexer/scripts/mirror-lists.ts" "${margs[@]}"
    run "continuous projection" trust_cli chain-sync
    run "anchoring (each anchorer)" trust_cli chain-submit
    run "chain health" trust_cli chain-health
    printf '[dry-run] %d steps; nothing was executed\n' "${#STEPS[@]}"
    exit 0
  fi
  tsx_run "$REPO_ROOT/apps/chain-indexer/scripts/mirror-lists.ts" "${margs[@]}" >"$TESTNET_DIR/mirror.json" || {
    log "ALARM: mirroring failed — the shadow chain is not updated this run"
    rc=5
  }
  sync=""
  if [ "$rc" = 0 ]; then
    sync=$(with_chain_env node "$REPO_ROOT/node_modules/tsx/dist/cli.mjs" "$REPO_ROOT/apps/trust-publisher/src/cli.ts" chain-sync) ||
      rc=5
    i=0
    while read -r kf; do
      kf=${kf%$'\r'}
      case "$kf" in /*) ;; *) kf="$TESTNET_DIR/keys/$kf" ;; esac
      i=$((i + 1))
      with_chain_env env "TAMGA_CHAIN_ANCHORER_KEY=$(tr -d '[:space:]' <"$kf")" node "$REPO_ROOT/node_modules/tsx/dist/cli.mjs" \
        "$REPO_ROOT/apps/trust-publisher/src/cli.ts" chain-submit >"$TESTNET_DIR/chain-submit-$i.json" || rc=5
    done < <(jq -r '.anchor.anchorers[].key' "$KEYMAP")
  fi
  health=$(with_chain_env node "$REPO_ROOT/node_modules/tsx/dist/cli.mjs" "$REPO_ROOT/apps/trust-publisher/src/cli.ts" chain-health) ||
    rc=5
  write_report sync "$(jq -r '.status // "error"' <<<"${health:-null}")" "$health" "$(jq -s 'last' <<<"${sync:-null}" 2>/dev/null || echo null)"
  exit "$rc"
fi

# ==========================================================================================================================
[ -f "$REPORT_MD" ] || die "no report yet in $TESTNET_DIR (setup first)"
cat "$REPORT_MD"
