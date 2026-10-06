#!/usr/bin/env node
/**
 * Android yerel kütüphanesi: rust/ → android/src/main/jniLibs/<abi>/libtamga_zk_prover.so (gitignore; paket yayınına girer).
 * Gerekenler: Android NDK (ANDROID_NDK_HOME), `cargo install cargo-ndk`, hedefler:
 *   rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android
 * Mağaza derlemesi öncesi bir kez (ya da Rust kaynağı değişince) çalıştırılır; Expo Go bu modülü yüklemez (ZK5: olağan yol).
 *   node scripts/build-android.mjs      (ya da: npm run zk:android -w @tamga-network/zk)
 */
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PKG = resolve(fileURLToPath(new URL("..", import.meta.url)));
if (!process.env.ANDROID_NDK_HOME) {
  console.error("ANDROID_NDK_HOME tanımlı değil (Android NDK gerekir).");
  process.exit(1);
}
execFileSync(
  "cargo",
  [
    "ndk",
    ...["-t", "arm64-v8a", "-t", "armeabi-v7a", "-t", "x86_64"],
    "--platform",
    "28", // Android 9 (WA-ADR-0004: minSdk 28)
    "-o",
    join(PKG, "android", "src", "main", "jniLibs"),
    "build",
    "--release",
  ],
  { cwd: join(PKG, "rust"), stdio: "inherit" },
);
console.log("✓ android/src/main/jniLibs/*/libtamga_zk_prover.so");
