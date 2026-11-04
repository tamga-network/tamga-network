#!/usr/bin/env bash
# network/testnet/node.sh — start / stop / status / logs of the nodes written by make-network.sh.
#
#   bash network/testnet/node.sh start|stop|restart|status|logs <n|all>
#
# TESTNET_MODE=process (default): each node is a background JVM of the current user; PID in node<n>/besu.pid, log in
#   node<n>/besu.log. TESTNET_HEAP (default 768m) sets -Xmx.
# TESTNET_MODE=systemd: `systemctl start|stop besu@node<n>` (unit network/testnet/besu@.service; data in /var/lib/tamga-besu,
#   needs root); logs from the journal.
# `start` waits until the node's JSON-RPC answers (TESTNET_START_TIMEOUT, default 120 s).
#
# Düğüm işletimi: süreç kipinde her düğüm kullanıcının arka plan JVM'i; systemd kipinde besu@node<n> birimi. Başlatma, düğümün
# JSON-RPC'si yanıt verene dek bekler; durdurma önce SIGTERM (Besu veritabanını kapatır), 60 sn sonra SIGKILL.
set -euo pipefail
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

MODE=${TESTNET_MODE:-process}
HEAP=${TESTNET_HEAP:-768m}
START_TIMEOUT=${TESTNET_START_TIMEOUT:-120}
case "$MODE" in process | systemd) ;; *) die "TESTNET_MODE=process|systemd" ;; esac
need curl jq

cmd=${1:-}
which=${2:-}
if [ -z "$cmd" ] || [ -z "$which" ]; then
  sed -n '2,12p' "$0"
  exit 2
fi
load_network
TOTAL=$(node_count)
if [ "$which" = all ]; then
  mapfile -t NODES < <(seq 1 "$TOTAL")
else
  if ! [[ "$which" =~ ^[1-9][0-9]*$ ]] || [ "$which" -gt "$TOTAL" ]; then die "node must be 1..$TOTAL or all"; fi
  NODES=("$which")
fi

port_busy() { ss -H -ltn "sport = :$1" 2>/dev/null | grep -q .; }

start_node() {
  local n=$1 d url pid log
  d=$(node_dir "$n")
  url=$(rpc_url "$n")
  log="$d/besu.log"
  if [ "$MODE" = systemd ]; then
    systemctl start "besu@node$n"
  else
    if pid=$(node_pid "$n"); then
      log "node $n already running (PID $pid)"
      return 0
    fi
    local p
    for p in "${TESTNET_RPC_PORTS[$((n - 1))]}" "${TESTNET_P2P_PORTS[$((n - 1))]}"; do
      if port_busy "$p"; then die "node $n: port $p is in use"; fi
    done
    printf '\n===== start %s =====\n' "$(date -u +%FT%TZ)" >>"$log"
    # setsid: own session, survives the calling shell; the start script execs the JVM, so $! is the java PID
    JAVA_HOME="$TESTNET_JAVA_HOME" BESU_OPTS="-Xms256m -Xmx$HEAP" \
      setsid nohup "$TESTNET_BESU_HOME/bin/besu" --config-file="$d/besu.toml" </dev/null >>"$log" 2>&1 &
    pid=$!
    sleep 1
    if [ "$(cat "/proc/$pid/comm" 2>/dev/null)" != java ]; then
      local child
      child=$(pgrep -P "$pid" java || true)
      if [ -n "$child" ]; then pid=$child; fi
    fi
    printf '%s\n' "$pid" >"$d/besu.pid"
    log "node $n started (PID $pid, RPC $url, log $log)"
  fi
  local start now
  start=$(date +%s)
  while [ "$(block_number "$url")" -lt 0 ]; do
    now=$(($(date +%s) - start))
    if [ "$MODE" = process ] && ! kill -0 "$(cat "$d/besu.pid")" 2>/dev/null; then
      tail -n 40 "$log" >&2 || true
      die "node $n exited — log: $log"
    fi
    if [ "$now" -ge "$START_TIMEOUT" ]; then
      if [ "$MODE" = process ]; then tail -n 40 "$log" >&2 || true; else journalctl -u "besu@node$n" -n 40 --no-pager >&2 || true; fi
      die "node $n: JSON-RPC not up after ${START_TIMEOUT}s"
    fi
    sleep 1
  done
  log "node $n: JSON-RPC up after $(($(date +%s) - start))s (block $(block_number "$url"))"
}

stop_node() {
  local n=$1 pid i
  if [ "$MODE" = systemd ]; then
    systemctl stop "besu@node$n"
    log "node $n stopped (systemd)"
    return 0
  fi
  if ! pid=$(node_pid "$n"); then
    log "node $n not running"
    rm -f "$(node_dir "$n")/besu.pid"
    return 0
  fi
  pkill -TERM -P "$pid" 2>/dev/null || true # in case the start script did not exec the JVM
  kill -TERM "$pid" 2>/dev/null || true
  for ((i = 0; i < 60; i++)); do
    kill -0 "$pid" 2>/dev/null || break
    sleep 1
  done
  if kill -0 "$pid" 2>/dev/null; then
    log "node $n did not stop in 60s — SIGKILL"
    kill -KILL "$pid" 2>/dev/null || true
  fi
  rm -f "$(node_dir "$n")/besu.pid"
  log "node $n stopped (PID $pid)"
}

status_node() {
  local n=$1 url b state="stopped" pid=""
  url=$(rpc_url "$n")
  if [ "$MODE" = systemd ]; then
    state=$(systemctl is-active "besu@node$n" 2>/dev/null || true)
  elif pid=$(node_pid "$n"); then
    state="running PID $pid"
  fi
  b=$(block_number "$url")
  if [ "$b" -ge 0 ]; then
    printf 'node %s %s (%s) | %s | RPC %s | block %s | peers %s | validators %s\n' "$n" "$(node_state "$n")" \
      "0x$(node_address "$n")" "$state" "$url" "$b" "$(peer_count "$url")" "$(validators "$url" | tr ',' '\n' | grep -c .)"
  else
    printf 'node %s %s (%s) | %s | RPC %s | no answer\n' "$n" "$(node_state "$n")" "0x$(node_address "$n")" "$state" "$url"
  fi
}

case "$cmd" in
  start) for n in "${NODES[@]}"; do start_node "$n"; done ;;
  stop) for n in "${NODES[@]}"; do stop_node "$n"; done ;;
  restart) for n in "${NODES[@]}"; do stop_node "$n"; start_node "$n"; done ;;
  status) for n in "${NODES[@]}"; do status_node "$n"; done ;;
  logs)
    for n in "${NODES[@]}"; do
      printf '===== node %s =====\n' "$n"
      if [ "$MODE" = systemd ]; then journalctl -u "besu@node$n" -n 100 --no-pager; else tail -n 100 "$(node_dir "$n")/besu.log"; fi
    done
    ;;
  *) die "unknown command: $cmd (start|stop|restart|status|logs)" ;;
esac
