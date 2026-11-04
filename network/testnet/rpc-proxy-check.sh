#!/usr/bin/env bash
# network/testnet/rpc-proxy-check.sh — the RPC protection of ADR-0052 K5 / LP5 in front of a running test node:
#   1. filter.mjs (network/rpc-proxy) on 127.0.0.1:<filter-port> → the node's local JSON-RPC: eth/net/web3 pass,
#      admin_/perm_/qbft_/debug_/txpool_ and the signing eth_ methods are refused (403), a batch with one refused call too;
#   2. nginx with mutual TLS (nginx.conf.example, placeholders filled with local test certificates from gen-dev-certs.sh):
#      without a client certificate 400, TLS 1.2 refused, with one: eth_blockNumber 200, admin_peers / perm_ / qbft_ 403;
#   3. the node's JSON-RPC port does not answer on the host's non-loopback address.
#
#   bash network/testnet/rpc-proxy-check.sh [--upstream http://127.0.0.1:8546] [--filter-port 8555] [--tls-port 8443]
#                                           [--no-nginx]
# TESTNET_REQUIRE_NGINX=1 → missing nginx is an error (CI). Writes <testnet dir>/rpc-proxy.json. Exit 0 = all as expected.
#
# RPC koruması denetimi: süzgeç önde (yalnız eth/net/web3), nginx mTLS (istemci sertifikasız 400), düğümün RPC'si dış adreste kapalı.
set -euo pipefail
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

UPSTREAM=""
FILTER_PORT=8555
TLS_PORT=8443
NGINX=1
while [ $# -gt 0 ]; do
  case "$1" in
    --upstream) UPSTREAM=$2; shift 2 ;;
    --filter-port) FILTER_PORT=$2; shift 2 ;;
    --tls-port) TLS_PORT=$2; shift 2 ;;
    --no-nginx) NGINX=0; shift ;;
    -h | --help) sed -n '2,13p' "$0"; exit 0 ;;
    *) die "unknown option: $1" ;;
  esac
done
need curl jq node openssl
if [ -z "$UPSTREAM" ]; then
  load_network
  UPSTREAM=$(rpc_url 1)
fi
mkdir -p "$TESTNET_DIR"
PROXY_DIR="$REPO_ROOT/network/rpc-proxy"
WORK=$(mktemp -d "$TESTNET_DIR/_rpcproxy-XXXXXX")
FILTER_PID=""
NGINX_CONF=""
cleanup() {
  if [ -n "$FILTER_PID" ]; then kill "$FILTER_PID" 2>/dev/null || true; fi
  if [ -n "$NGINX_CONF" ] && [ -f "$WORK/nginx/nginx.pid" ]; then
    "$NGINX_BIN" -p "$WORK/nginx" -c "$NGINX_CONF" -e "$WORK/nginx/error.log" -s stop 2>/dev/null || true
  fi
  rm -rf "$WORK"
}
trap cleanup EXIT

FAILS=0
RESULTS=()
# expect <label> <expected-status> <actual-status>
expect() {
  local ok=true
  if [ "$2" != "$3" ]; then
    ok=false
    FAILS=$((FAILS + 1))
    log "FAIL $1: expected $2, got $3"
  else
    log "ok   $1: $3"
  fi
  RESULTS+=("$(jq -cn --arg c "$1" --arg e "$2" --arg a "$3" --argjson ok "$ok" '{check: $c, expected: $e, got: $a, ok: $ok}')")
}
body() { jq -cn --arg m "$1" '{jsonrpc: "2.0", id: 1, method: $m, params: []}'; }
# post <url> <json> [curl options…] → HTTP status ("000" = no connection / TLS refused)
post() {
  local url=$1 data=$2
  shift 2
  curl -s -o "$WORK/last.json" -w '%{http_code}' --max-time 10 -H 'content-type: application/json' --data "$data" "$@" "$url" || true
}

ALLOWED=(eth_blockNumber eth_chainId eth_getBlockByNumber net_version net_peerCount web3_clientVersion)
REFUSED=(admin_peers admin_nodeInfo admin_addPeer perm_getNodesAllowlist perm_getAccountsAllowlist perm_reloadPermissionsFromFile
  qbft_getValidatorsByBlockNumber qbft_proposeValidatorVote debug_traceBlockByNumber txpool_besuStatistics
  eth_sendTransaction eth_accounts eth_sign miner_start)

# --- 1. method filter -----------------------------------------------------------------------------------------------------
step "rpc-proxy: filter.mjs 127.0.0.1:$FILTER_PORT -> $UPSTREAM"
TAMGA_RPC_FILTER_LISTEN="127.0.0.1:$FILTER_PORT" TAMGA_RPC_FILTER_UPSTREAM="$UPSTREAM" \
  node "$PROXY_DIR/filter.mjs" >"$WORK/filter.log" 2>&1 &
FILTER_PID=$!
FILTER="http://127.0.0.1:$FILTER_PORT/"
filter_up() { [ "$(post "$FILTER" "$(body eth_blockNumber)")" = 200 ]; }
wait_for "filter answers" 20 filter_up || {
  cat "$WORK/filter.log" >&2
  die "filter.mjs did not start"
}
for m in "${ALLOWED[@]}"; do
  params='[]'
  [ "$m" = eth_getBlockByNumber ] && params='["latest",false]'
  st=$(post "$FILTER" "$(jq -cn --arg m "$m" --argjson p "$params" '{jsonrpc: "2.0", id: 1, method: $m, params: $p}')")
  if [ "$st" = 200 ] && ! jq -e 'has("result")' "$WORK/last.json" >/dev/null 2>&1; then st="200-without-result"; fi
  expect "filter $m" 200 "$st"
done
for m in "${REFUSED[@]}"; do expect "filter $m" 403 "$(post "$FILTER" "$(body "$m")")"; done
expect "filter batch [eth_blockNumber, admin_peers]" 403 \
  "$(post "$FILTER" '[{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber"},{"jsonrpc":"2.0","id":2,"method":"admin_peers"}]')"
expect "filter GET /" 405 "$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$FILTER" || true)"
expect "filter text/plain" 415 "$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -H 'content-type: text/plain' --data "$(body eth_blockNumber)" "$FILTER" || true)"

# --- 2. nginx with mutual TLS --------------------------------------------------------------------------------------------
NGINX_BIN=$(command -v nginx || true)
[ -z "$NGINX_BIN" ] && [ -x /usr/sbin/nginx ] && NGINX_BIN=/usr/sbin/nginx
if [ "$NGINX" = 1 ] && [ -z "$NGINX_BIN" ]; then
  [ "${TESTNET_REQUIRE_NGINX:-0}" = 1 ] && die "nginx not installed (TESTNET_REQUIRE_NGINX=1)"
  log "nginx not installed — mTLS part skipped (install nginx, or --no-nginx to silence)"
  NGINX=0
fi
if [ "$NGINX" = 1 ]; then
  step "rpc-proxy: nginx mTLS 127.0.0.1:$TLS_PORT -> filter"
  bash "$PROXY_DIR/gen-dev-certs.sh" trust-publisher >&2
  CERTS="$PROXY_DIR/dev-certs"
  mkdir -p "$WORK/nginx/tmp"
  nver=$("$NGINX_BIN" -v 2>&1 | sed -n 's#.*nginx/\([0-9.]*\).*#\1#p')
  # `http2 on;` needs nginx >= 1.25.1 (Ubuntu 24.04 ships 1.24): dropped for older versions, the rest of the example is used as is
  drop_http2=""
  if [ "$(printf '%s\n%s\n' "$nver" 1.25.1 | sort -V | head -n 1)" != 1.25.1 ]; then drop_http2='/^[[:space:]]*http2 on;/d'; fi
  sed -e "s#listen 8443 ssl;#listen 127.0.0.1:$TLS_PORT ssl;#" -e '/listen \[::\]:8443 ssl;/d' \
    -e "s#/etc/tamga/rpc-proxy/#$CERTS/#g" -e 's#<operator-domain>#localhost#' \
    -e "s#proxy_pass http://127.0.0.1:8550;#proxy_pass http://127.0.0.1:$FILTER_PORT;#" \
    ${drop_http2:+-e "$drop_http2"} "$PROXY_DIR/nginx.conf.example" >"$WORK/nginx/rpc.conf"
  grep -q "listen 127.0.0.1:$TLS_PORT ssl;" "$WORK/nginx/rpc.conf" || die "nginx.conf.example changed: listen line not found"
  grep -q "proxy_pass http://127.0.0.1:$FILTER_PORT;" "$WORK/nginx/rpc.conf" || die "nginx.conf.example changed: proxy_pass not found"
  T="$WORK/nginx/tmp"
  NGINX_CONF="$WORK/nginx/nginx.conf"
  cat >"$NGINX_CONF" <<EOF
pid $WORK/nginx/nginx.pid;
error_log $WORK/nginx/error.log warn;
events {}
http {
  access_log off;
  client_body_temp_path $T/body;
  proxy_temp_path $T/proxy;
  fastcgi_temp_path $T/fastcgi;
  uwsgi_temp_path $T/uwsgi;
  scgi_temp_path $T/scgi;
  include $WORK/nginx/rpc.conf;
}
EOF
  "$NGINX_BIN" -t -q -p "$WORK/nginx" -c "$NGINX_CONF" -e "$WORK/nginx/error.log" || {
    cat "$WORK/nginx/error.log" >&2 || true
    die "nginx -t failed"
  }
  "$NGINX_BIN" -p "$WORK/nginx" -c "$NGINX_CONF" -e "$WORK/nginx/error.log"
  TLS="https://localhost:$TLS_PORT/"
  CA=(--cacert "$CERTS/server.crt")
  CLIENT=(--cert "$CERTS/trust-publisher.crt" --key "$CERTS/trust-publisher.key")
  tls_up() { [ "$(post "$TLS" "$(body eth_blockNumber)" "${CA[@]}" "${CLIENT[@]}")" = 200 ]; }
  wait_for "nginx answers" 20 tls_up || {
    cat "$WORK/nginx/error.log" >&2 || true
    die "nginx did not start"
  }
  expect "mTLS without client certificate" 400 "$(post "$TLS" "$(body eth_blockNumber)" "${CA[@]}")"
  expect "mTLS TLS 1.2 refused" 000 "$(post "$TLS" "$(body eth_blockNumber)" "${CA[@]}" "${CLIENT[@]}" --tls-max 1.2)"
  expect "mTLS eth_blockNumber" 200 "$(post "$TLS" "$(body eth_blockNumber)" "${CA[@]}" "${CLIENT[@]}")"
  for m in admin_peers perm_getNodesAllowlist qbft_getValidatorsByBlockNumber debug_traceBlockByNumber; do
    expect "mTLS $m" 403 "$(post "$TLS" "$(body "$m")" "${CA[@]}" "${CLIENT[@]}")"
  done
  expect "mTLS GET /" 403 "$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "${CA[@]}" "${CLIENT[@]}" "$TLS" || true)"
fi

# --- 3. the node's JSON-RPC is not reachable on a non-loopback address ---------------------------------------------------
ext_ip=$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -E '^[0-9]+\.' | grep -v '^127\.' | head -n 1 || true)
if [ -n "$ext_ip" ]; then
  port=${UPSTREAM##*:}
  port=${port%%/*}
  expect "node RPC on $ext_ip:$port (not loopback)" 000 \
    "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 -H 'content-type: application/json' --data "$(body eth_blockNumber)" "http://$ext_ip:$port/" || true)"
else
  log "no non-loopback IPv4 address — external reachability check skipped"
fi

printf '%s\n' "${RESULTS[@]}" | jq -s --argjson fails "$FAILS" --argjson nginx "$NGINX" \
  '{checks: length, failed: $fails, nginx_mtls: ($nginx == 1), results: .}' >"$TESTNET_DIR/rpc-proxy.json"
log "rpc-proxy: $(jq -r '"\(.checks) checks, \(.failed) failed"' "$TESTNET_DIR/rpc-proxy.json") (report: $TESTNET_DIR/rpc-proxy.json)"
[ "$FAILS" = 0 ]
