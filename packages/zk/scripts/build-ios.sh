#!/usr/bin/env bash
# iOS yerel kütüphanesi: rust/ → ios/TamgaZkProver.xcframework (gitignore; paket yayınına girer). Yalnız macOS + Xcode.
# Gerekenler: rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios
#   bash scripts/build-ios.sh      (ya da: npm run zk:ios -w @tamga-network/zk)
set -euo pipefail
PKG="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PKG/rust"
export IPHONEOS_DEPLOYMENT_TARGET=16.4   # WA-ADR-0004
for t in aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios; do
  cargo build --release --target "$t"
done
T="${CARGO_TARGET_DIR:-$PKG/rust/target}"
SIM="$T/universal-ios-sim/release"
mkdir -p "$SIM"
lipo -create "$T/aarch64-apple-ios-sim/release/libtamga_zk_prover.a" "$T/x86_64-apple-ios/release/libtamga_zk_prover.a" \
  -output "$SIM/libtamga_zk_prover.a"
INC="$(mktemp -d)"; cp "$PKG/ios/TamgaZkProver.h" "$INC/"
rm -rf "$PKG/ios/TamgaZkProver.xcframework"
xcodebuild -create-xcframework \
  -library "$T/aarch64-apple-ios/release/libtamga_zk_prover.a" -headers "$INC" \
  -library "$SIM/libtamga_zk_prover.a" -headers "$INC" \
  -output "$PKG/ios/TamgaZkProver.xcframework"
echo "✓ ios/TamgaZkProver.xcframework"
