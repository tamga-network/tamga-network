#!/usr/bin/env node
/**
 * Masaüstü ispatçısını derler: rust/ → `tamga-zk-prove` ikilisi → packages/zk/bin/ (gitignore). `@tamga-network/zk/node` ve uçtan uca
 * test bunu kullanır; ikili yoksa test atlanır. Rust (rust-toolchain.toml sürümü) kullanıcı klasöründe yeterli.
 *
 * Windows: upstream `sha2` "asm" özelliği Windows'u desteklemez. Yerel klon (tools/zk-circuit README "Derleme": aynı commit,
 * asm kaldırılmış) varsa derleme ona yönlendirilir; sonuç aynıdır (saf Rust SHA-256). Linux/macOS ve telefon hedefleri git
 * bağımlılığını olduğu gibi kullanır.
 *   node scripts/build-cli.mjs      (ya da: npm run zk:build -w @tamga-network/zk)
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PKG = resolve(fileURLToPath(new URL("..", import.meta.url)));
const RUST = join(PKG, "rust");
const TARGET = process.env.CARGO_TARGET_DIR ?? join(homedir(), "tools", "tzp-target");
const win = process.platform === "win32";
const VENDOR = resolve(PKG, "../../tools/zk-circuit/vendor/longfellow-zk/rust/applications/mdoc_zk/runtime");

const env = { ...process.env, CARGO_TARGET_DIR: TARGET };
env.PATH = [join(homedir(), ".cargo", "bin"), process.env.PATH, win ? join(homedir(), "tools", "w64devkit", "bin") : ""]
  .filter(Boolean)
  .join(win ? ";" : ":");
const args = ["build", "--release", "--features", "cli"];
if (win) {
  // w64devkit (UCRT) ile Rust GNU hedefi: tools/zk-circuit/env.sh ile aynı ayarlar
  Object.assign(env, { CC: "gcc", AR: "ar", RUSTFLAGS: "-C link-self-contained=yes" });
  if (!existsSync(VENDOR)) {
    console.error(`Windows'ta yamalı upstream klonu gerekir: ${VENDOR}\n(tools/zk-circuit/README.md → "Derleme")`);
    process.exit(1);
  }
  args.push(
    "--config",
    `patch.'https://github.com/longfellow-zk/longfellow-zk'.mdoc-zk-runtime.path='${VENDOR.replaceAll("\\", "/")}'`,
  );
}
execFileSync("cargo", args, { cwd: RUST, env, stdio: "inherit" });

const exe = win ? "tamga-zk-prove.exe" : "tamga-zk-prove";
mkdirSync(join(PKG, "bin"), { recursive: true });
copyFileSync(join(TARGET, "release", exe), join(PKG, "bin", exe));
console.log(`✓ bin/${exe}`);
