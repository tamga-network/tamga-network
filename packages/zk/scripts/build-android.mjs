#!/usr/bin/env node
/**
 * Android yerel kütüphanesi: rust/ → android/src/main/jniLibs/<abi>/libtamga_zk_prover.so (gitignore; paket yayınına girer).
 * cargo-ndk gerekmez: NDK'nin clang sarmalayıcısı bağlayıcı olarak verilir (Windows'ta cargo-ndk derlenemiyor). Gerekenler:
 *   - Android NDK (ANDROID_NDK_HOME ya da ~/tools/android-ndk-*),
 *   - rustup target add --toolchain <rust-toolchain.toml sürümü> aarch64-linux-android armv7-linux-androideabi x86_64-linux-android
 * AArch64 kripto uzantıları rust/.cargo/config.toml'da (Longfellow ister). Derleyen makinenin yolları (kullanıcı adı dahil:
 * cargo kayıt/git klonları, rustup, depo, hedef klasörü) .so'ya gömülmez: --remap-path-prefix ile nötr öneklere (/cargo, /rustup,
 * /src, /target, ~) yazılır (packages/verifier zk-build ile aynı yöntem). Bu bayraklar CARGO_ENCODED_RUSTFLAGS ile verildiği için
 * config.toml'daki hedef bayrakları cargo'ca okunmaz; betik onları config.toml'dan okuyup ekler (tek kaynak config.toml). Mağaza derlemesi öncesi bir kez (ya da Rust kaynağı
 * değişince) çalıştırılır; Expo Go bu modülü yüklemez (ZK5: olağan yol). İlk derleme 2026-10-06 (NDK r27c, API 28 = Android 9).
 *   node scripts/build-android.mjs      (ya da: npm run zk:android -w @tamga-network/zk)
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PKG = resolve(fileURLToPath(new URL("..", import.meta.url)));
const win = process.platform === "win32";
const API = "28"; // WA-ADR-0004: minSdk 28

function findNdk() {
  if (process.env.ANDROID_NDK_HOME && existsSync(process.env.ANDROID_NDK_HOME)) return process.env.ANDROID_NDK_HOME;
  const tools = join(homedir(), "tools");
  const hit = existsSync(tools) ? readdirSync(tools).find((d) => /^android-ndk-/.test(d)) : undefined;
  if (hit) return join(tools, hit);
  console.error("Android NDK bulunamadı: ANDROID_NDK_HOME verin ya da ~/tools/android-ndk-<sürüm> altına açın.");
  process.exit(1);
}
const host = win ? "windows-x86_64" : process.platform === "darwin" ? "darwin-x86_64" : "linux-x86_64";
const BIN = join(findNdk(), "toolchains", "llvm", "prebuilt", host, "bin");
const clang = (triple) => join(BIN, `${triple}${API}-clang${win ? ".cmd" : ""}`);
const ar = join(BIN, `llvm-ar${win ? ".exe" : ""}`);

const TARGETS = [
  ["arm64-v8a", "aarch64-linux-android", "aarch64-linux-android"],
  ["armeabi-v7a", "armv7-linux-androideabi", "armv7a-linux-androideabi"],
  ["x86_64", "x86_64-linux-android", "x86_64-linux-android"],
];
const TARGET_DIR = process.env.CARGO_TARGET_DIR ?? join(homedir(), "tools", "tzp-android");
const env = {
  ...process.env,
  CARGO_TARGET_DIR: TARGET_DIR,
  PATH: [join(homedir(), ".cargo", "bin"), process.env.PATH].join(win ? ";" : ":"),
};
for (const [, rustTarget, clangTriple] of TARGETS) {
  const key = rustTarget.replace(/-/g, "_");
  env[`CARGO_TARGET_${key.toUpperCase()}_LINKER`] = clang(clangTriple);
  env[`CC_${key}`] = clang(clangTriple);
  env[`AR_${key}`] = ar;
}
/** rust/.cargo/config.toml → [target.<hedef>] rustflags (yoksa boş). */
const CONFIG = readFileSync(join(PKG, "rust", ".cargo", "config.toml"), "utf8");
function configRustflags(rustTarget) {
  const lines = CONFIG.split(/\r?\n/).map((l) => l.trim());
  const at = lines.indexOf(`[target.${rustTarget}]`);
  if (at < 0) return [];
  for (const l of lines.slice(at + 1)) {
    if (l.startsWith("[")) break;
    if (l.startsWith("rustflags")) return JSON.parse(l.slice(l.indexOf("=") + 1));
  }
  return [];
}
// Sonra gelen eşleşme kazanır: genelden (ev klasörü) özele.
const REMAP = [
  [homedir(), "~"],
  [process.env.CARGO_HOME ?? join(homedir(), ".cargo"), "/cargo"],
  [process.env.RUSTUP_HOME ?? join(homedir(), ".rustup"), "/rustup"],
  [TARGET_DIR, "/target"],
  [resolve(PKG, "..", ".."), "/src"],
].map(([from, to]) => `--remap-path-prefix=${from}=${to}`);
for (const [abi, rustTarget] of TARGETS) {
  execFileSync("cargo", ["build", "--release", "--target", rustTarget], {
    cwd: join(PKG, "rust"),
    env: {
      ...env,
      CARGO_ENCODED_RUSTFLAGS: [...configRustflags(rustTarget), ...REMAP].join(String.fromCharCode(0x1f)),
    },
    stdio: "inherit",
  });
  const out = join(PKG, "android", "src", "main", "jniLibs", abi);
  mkdirSync(out, { recursive: true });
  copyFileSync(join(TARGET_DIR, rustTarget, "release", "libtamga_zk_prover.so"), join(out, "libtamga_zk_prover.so"));
  console.log(`✓ jniLibs/${abi}/libtamga_zk_prover.so`);
}
