#!/usr/bin/env bash
# network/testnet/install-besu.sh — Temurin JDK 25 + Hyperledger Besu 26.11.0 on Linux (x64 / aarch64), from the official
# release pages, sha256 pinned (lib.sh). No Docker, no package manager. Nothing is overwritten that already exists.
#
#   bash network/testnet/install-besu.sh                         # → <repo>/tools/{jdk-25,besu-26.11.0,besu} (same layout as Windows)
#   bash network/testnet/install-besu.sh --prefix DIR            # any directory the user can write
#   sudo bash network/testnet/install-besu.sh --system [--user besu]
#        → /opt/tamga-besu/{jdk-25,besu-26.11.0,besu}, root-owned (the service user cannot change the binaries);
#          system user `besu` (no shell, no home login) and /var/lib/tamga-besu (owner besu, 0750) for node data
#   --cache DIR   download cache (default <prefix>/_dl; CI keeps it between runs)
#
# Kurulum: JDK ve Besu resmi kaynaktan indirilir, sha256 sabit değerle karşılaştırılır (uyuşmazsa dosya silinir ve durur),
# açılır; `besu` bağlantısı sürüm klasörünü gösterir (systemd birimi bunu kullanır). Sürüm yükseltmesi: lib.sh'teki sabitler.
set -euo pipefail
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"

PREFIX="$REPO_ROOT/tools"
SYSTEM=0
SVC_USER="besu"
CACHE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --prefix) PREFIX=$2; shift 2 ;;
    --system) SYSTEM=1; PREFIX="/opt/tamga-besu"; shift ;;
    --user) SVC_USER=$2; shift 2 ;;
    --cache) CACHE=$2; shift 2 ;;
    -h | --help) sed -n '2,15p' "$0"; exit 0 ;;
    *) die "unknown option: $1" ;;
  esac
done
CACHE=${CACHE:-$PREFIX/_dl}
need curl sha256sum tar unzip

case "$(uname -m)" in
  x86_64 | amd64) JDK_ARCH=x64; JDK_SHA=$JDK_SHA256_X64 ;;
  aarch64 | arm64) JDK_ARCH=aarch64; JDK_SHA=$JDK_SHA256_AARCH64 ;;
  *) die "unsupported CPU architecture: $(uname -m)" ;;
esac
JDK_FILE="OpenJDK25U-jdk_${JDK_ARCH}_linux_hotspot_${JDK_VERSION_FILE}.tar.gz"
JDK_URL="https://github.com/adoptium/temurin25-binaries/releases/download/${JDK_RELEASE}/${JDK_FILE}"

if [ "$SYSTEM" = 1 ]; then
  [ "$(id -u)" = 0 ] || die "--system needs root (sudo)"
  need useradd install
fi

# fetch <url> <file> <sha256> → path of the verified file in the cache
fetch() {
  local url=$1 file=$2 sha=$3 dest
  mkdir -p "$CACHE"
  dest="$CACHE/$file"
  if [ -f "$dest" ] && printf '%s  %s\n' "$sha" "$dest" | sha256sum -c --status; then
    log "cached: $file"
  else
    log "downloading: $url"
    curl -fSL --retry 3 --retry-delay 5 -o "$dest.part" "$url"
    mv "$dest.part" "$dest"
    if ! printf '%s  %s\n' "$sha" "$dest" | sha256sum -c --status; then
      local got
      got=$(sha256sum "$dest" | cut -d' ' -f1)
      rm -f "$dest"
      die "sha256 MISMATCH: $file (expected $sha, got $got) — file deleted"
    fi
    log "sha256 verified: $file"
  fi
  printf '%s' "$dest"
}

# extract_single <archive> <target-dir> — the archive's single top-level folder becomes <target-dir>
extract_single() {
  local archive=$1 target=$2 tmp inner
  tmp=$(mktemp -d "$PREFIX/_x-XXXXXX")
  case "$archive" in
    *.tar.gz) tar -xzf "$archive" -C "$tmp" ;;
    *.zip) unzip -q "$archive" -d "$tmp" ;;
    *) die "unknown archive type: $archive" ;;
  esac
  mapfile -t inner < <(find "$tmp" -mindepth 1 -maxdepth 1 -type d)
  [ "${#inner[@]}" -eq 1 ] || die "unexpected archive layout: $archive"
  mv "${inner[0]}" "$target"
  rm -rf "$tmp"
}

mkdir -p "$PREFIX"
JDK_DIR="$PREFIX/jdk-25"
BESU_DIR="$PREFIX/besu-$BESU_VERSION"

if [ -x "$JDK_DIR/bin/java" ]; then
  log "JDK 25 present: $JDK_DIR"
else
  jdk_archive=$(fetch "$JDK_URL" "$JDK_FILE" "$JDK_SHA")
  extract_single "$jdk_archive" "$JDK_DIR"
  log "JDK 25 installed: $JDK_DIR"
fi
if [ -x "$BESU_DIR/bin/besu" ]; then
  log "Besu $BESU_VERSION present: $BESU_DIR"
else
  besu_archive=$(fetch "$BESU_URL" "besu-$BESU_VERSION.zip" "$BESU_SHA256")
  extract_single "$besu_archive" "$BESU_DIR"
  log "Besu $BESU_VERSION installed: $BESU_DIR"
fi
ln -sfn "besu-$BESU_VERSION" "$PREFIX/besu"

"$JDK_DIR/bin/java" -version 2>&1 | sed -n '1s/^/[testnet] java: /p' >&2
besu_ver=$(JAVA_HOME="$JDK_DIR" "$PREFIX/besu/bin/besu" --version 2>/dev/null | tail -n 1)
case "$besu_ver" in
  *"$BESU_VERSION"*) log "besu: $besu_ver" ;;
  *) die "besu --version did not report $BESU_VERSION (got: ${besu_ver:-nothing})" ;;
esac

if [ "$SYSTEM" = 1 ]; then
  chown -R root:root "$JDK_DIR" "$BESU_DIR"
  chmod -R go-w "$JDK_DIR" "$BESU_DIR"
  if ! id -u "$SVC_USER" >/dev/null 2>&1; then
    useradd --system --home-dir /var/lib/tamga-besu --no-create-home --shell /usr/sbin/nologin "$SVC_USER"
    log "system user created: $SVC_USER"
  fi
  install -d -o "$SVC_USER" -g "$SVC_USER" -m 0750 /var/lib/tamga-besu
  log "node data directory: /var/lib/tamga-besu (owner $SVC_USER, 0750)"
fi

cat >&2 <<EOF
[testnet] ready. Use with the other scripts:
  export JAVA_HOME=$JDK_DIR
  export TESTNET_BESU_HOME=$PREFIX/besu
EOF
