#!/usr/bin/env bash
# Local test certificates for the mTLS RPC proxy — DEVELOPMENT ONLY. Writes to ./dev-certs/ (git-ignored); nothing here is a
# real key. Real deployments: the operator's own server certificate and a dedicated client CA kept outside the repository.
#   bash gen-dev-certs.sh [client-name ...]      (default client: trust-publisher)
set -euo pipefail
cd "$(dirname "$0")"
out=dev-certs
mkdir -p "$out"
days=30
[ -f "$out/clients-ca.key" ] || openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -days "$days" \
  -subj "/CN=Tamga dev RPC client CA" -keyout "$out/clients-ca.key" -out "$out/clients-ca.crt" 2>/dev/null
[ -f "$out/server.key" ] || openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -days "$days" \
  -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" \
  -keyout "$out/server.key" -out "$out/server.crt" 2>/dev/null
for name in "${@:-trust-publisher}"; do
  [ -f "$out/$name.key" ] && continue
  openssl req -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -subj "/CN=$name" \
    -keyout "$out/$name.key" -out "$out/$name.csr" 2>/dev/null
  openssl x509 -req -in "$out/$name.csr" -CA "$out/clients-ca.crt" -CAkey "$out/clients-ca.key" -CAcreateserial \
    -days "$days" -extfile <(printf "extendedKeyUsage=clientAuth") -out "$out/$name.crt" 2>/dev/null
  rm -f "$out/$name.csr"
done
chmod 600 "$out"/*.key
echo "dev certificates in $out/ (CA, server, clients: ${*:-trust-publisher})"
