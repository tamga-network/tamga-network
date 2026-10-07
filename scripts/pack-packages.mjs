#!/usr/bin/env node
/**
 * npm yayın hazırlığı (D14, D-OSS-2). Geliştirme paketleri TS kaynağıyla tüketir (exports → src/*.ts); yayın için:
 *   1) tsc -b tsconfig.build.json → packages/<ad>/lib/ (.js + .d.ts + map)
 *   2) .publish/<ad>/ : lib/, README.md, LICENSE + yayın package.json'ı (exports → lib, iç bağımlılık ^sürüm, private yok)
 *   3) denetim: lib'deki çıplak import'lar dependencies'te mi; yasak dosya (pem, .env, test) yok; postinstall yok (P1)
 *   4) npm pack → .publish/tarballs/*.tgz
 * Kaynak depo dosyaları DEĞİŞMEZ. Yayın (npm publish) bu betiğin işi değil — CI (release.yml) ve proje yönetiminin onayıyla.
 * @tamga-network/zk (ADR-0032 Aşama 2): derlenmiş yerel kütüphaneler depoda yoktur (gitignore) ve pakete girmek ZORUNDADIR —
 *   Android `.so` (üç ABI) eksikse paketleme BAŞARISIZ olur (`npm run zk:android -w @tamga-network/zk`, NDK gerekir). iOS
 *   xcframework (`npm run zk:ios`, macOS gerekir) yoksa `ios/` pakete girmez ve paketteki expo-module.config.json yalnız
 *   "android" der (iOS uygulaması derlenebilir kalır; ZK5: olağan sunum); xcframework varsa iOS kendiliğinden eklenir. Paketlenen
 *   yerel dosyaların SHA-256 özetleri `lib/native-checksums.json`'a yazılır; smoke-packages.mjs kurulumdan sonra denetler.
 * Kullanım: node scripts/pack-packages.mjs [--no-build]   ·   yalnız bazı paketler: TAMGA_PACK_PACKAGES="core trust" (boş = hepsi)
 */
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const ALL_PKGS = ["core", "mdoc", "schemas", "sd-jwt", "trust", "issuer", "verifier", "wallet-core", "zk"];
const SEL = (process.env.TAMGA_PACK_PACKAGES ?? "").split(/\s+/).filter(Boolean);
for (const s of SEL) if (!ALL_PKGS.includes(s)) throw new Error(`TAMGA_PACK_PACKAGES: bilinmeyen paket "${s}"`);
const PKGS = SEL.length ? ALL_PKGS.filter((p) => SEL.includes(p)) : ALL_PKGS;
// ADR-0032 Aşama 2: @tamga-network/zk yerel modülü (Expo) — derlenmiş Android/iOS kütüphaneleri pakete bu yollarla girer.
const NATIVE = ["android", "ios", "expo-module.config.json"];
const ZK_ANDROID_ABIS = ["arm64-v8a", "armeabi-v7a", "x86_64"];
const zkSo = (abi) => `android/src/main/jniLibs/${abi}/libtamga_zk_prover.so`;
const ZK_XCFRAMEWORK = "ios/TamgaZkProver.xcframework";
const sha256File = (f) => createHash("sha256").update(readFileSync(f)).digest("hex");
const OUT = join(ROOT, ".publish");
const errors = [];

if (!process.argv.includes("--no-build")) {
  console.log("== derleme (tsc -b)");
  execSync("npx tsc -b tsconfig.build.json", { cwd: ROOT, stdio: "inherit" });
}
rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, "tarballs"), { recursive: true });

const versions = Object.fromEntries(
  ALL_PKGS.map((p) => {
    const j = JSON.parse(readFileSync(join(ROOT, "packages", p, "package.json"), "utf8"));
    return [j.name, j.version];
  }),
);
const walk = (d) =>
  readdirSync(d).flatMap((f) => {
    const q = join(d, f);
    return statSync(q).isDirectory() ? walk(q) : [q];
  });
const toLib = (src, ext) => src.replace(/^\.\/src\//, "./lib/").replace(/\.ts$/, ext);

for (const p of PKGS) {
  const dir = join(ROOT, "packages", p);
  const src = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  const dest = join(OUT, p);
  mkdirSync(dest, { recursive: true });
  if (!existsSync(join(dir, "lib"))) {
    errors.push(`${src.name}: lib/ yok (derleme başarısız?)`);
    continue;
  }
  cpSync(join(dir, "lib"), join(dest, "lib"), { recursive: true, filter: (f) => !f.endsWith(".tsbuildinfo") });
  // Derlenmeyen çalışma zamanı dosyaları (ADR-0032: ZK doğrulayıcı WASM, manifest, devreler) src → lib aynı yolla; test
  // fikstürleri (`fixtures/`) yayına girmez.
  for (const f of walk(join(dir, "src"))) {
    const rel = relative(join(dir, "src"), f).replaceAll("\\", "/");
    if (/\.ts$/.test(rel) || /(^|\/)fixtures\//.test(rel)) continue;
    if (!/\.(wasm|zst|json)$/.test(rel)) continue;
    mkdirSync(join(dest, "lib", rel, ".."), { recursive: true });
    cpSync(f, join(dest, "lib", rel));
  }
  let native = NATIVE.filter((n) => existsSync(join(dir, n)));
  if (p === "zk") {
    // Android .so zorunlu: eksikse paket telefonda hiç ispat üretemezdi (sessizce "desteklenmiyor" yerine yayın durur)
    const missing = ZK_ANDROID_ABIS.map(zkSo).filter((f) => !existsSync(join(dir, f)));
    if (missing.length)
      errors.push(
        `${src.name}: yerel Android kütüphanesi eksik (${missing.join(", ")}) — önce: npm run zk:android -w @tamga-network/zk`,
      );
    // iOS: xcframework yoksa ios/ dışarıda kalır, modül yalnız Android'de bağlanır (podspec olmayan çerçeveyi istemesin)
    if (!existsSync(join(dir, ZK_XCFRAMEWORK))) {
      native = native.filter((n) => n !== "ios");
      console.log(`  ${src.name}: ${ZK_XCFRAMEWORK} yok → iOS pakete girmiyor (platforms: android)`);
    }
  }
  for (const n of native)
    cpSync(join(dir, n), join(dest, n), { recursive: true, filter: (f) => !/[\\/]build[\\/]/.test(f) });
  if (p === "zk" && native.includes("expo-module.config.json")) {
    const cfg = JSON.parse(readFileSync(join(dir, "expo-module.config.json"), "utf8"));
    cfg.platforms = native.includes("ios") ? ["apple", "android"] : ["android"];
    writeFileSync(join(dest, "expo-module.config.json"), JSON.stringify(cfg, null, 2) + "\n");
    // Paketlenen yerel ikililerin özetleri (smoke-packages.mjs kurulumdan sonra denetler; kullanıcı da karşılaştırabilir)
    const files = {};
    for (const n of native.filter((x) => x !== "expo-module.config.json"))
      for (const f of walk(join(dest, n))) {
        const rel = relative(dest, f).replaceAll("\\", "/");
        if (/\.(so|a|dylib)$/.test(rel) || rel.includes(".xcframework/")) files[rel] = sha256File(f);
      }
    writeFileSync(
      join(dest, "lib", "native-checksums.json"),
      JSON.stringify({ note: "SHA-256 of the packed native prover libraries (ADR-0032)", files }, null, 2) + "\n",
    );
  }
  cpSync(join(ROOT, "LICENSE"), join(dest, "LICENSE"));
  if (existsSync(join(dir, "README.md"))) cpSync(join(dir, "README.md"), join(dest, "README.md"));
  else
    writeFileSync(
      join(dest, "README.md"),
      `# ${src.name}\n\n${src.description ?? ""}\n\nBelgeler: https://docs.tamga.network · Kaynak: https://github.com/tamga-network/tamga-network (${src.repository?.directory ?? ""})\n`,
    );

  // exports: "./src/x.ts" → { types, default } (lib)
  const exportsOut = {};
  for (const [k, v] of Object.entries(src.exports ?? { ".": src.main })) {
    const s = typeof v === "string" ? v : v.default;
    exportsOut[k] = { types: toLib(s, ".d.ts"), default: toLib(s, ".js") };
  }
  exportsOut["./package.json"] = "./package.json";
  const deps = {};
  for (const [n, r] of Object.entries(src.dependencies ?? {})) {
    if (n.startsWith("@tamga-network/")) {
      if (!versions[n]) errors.push(`${src.name}: iç bağımlılık ${n} yayın listesinde yok`);
      deps[n] = `^${versions[n]}`;
    } else deps[n] = r;
  }
  if (src.scripts?.postinstall || src.scripts?.install || src.scripts?.preinstall)
    errors.push(`${src.name}: install/postinstall betiği yasak (ARCH-0005 P1)`);
  const out = {
    name: src.name,
    version: src.version,
    description: src.description,
    license: src.license,
    type: "module",
    main: exportsOut["."].default,
    types: exportsOut["."].types,
    exports: exportsOut,
    files: ["lib", "README.md", "LICENSE", ...native],
    sideEffects: src.sideEffects ?? false,
    engines: { node: ">=22" },
    dependencies: deps,
    ...(src.peerDependencies ? { peerDependencies: src.peerDependencies } : {}),
    ...(src.peerDependenciesMeta ? { peerDependenciesMeta: src.peerDependenciesMeta } : {}),
    repository: src.repository,
    homepage: src.homepage,
    publishConfig: src.publishConfig ?? { access: "public", provenance: true },
  };
  writeFileSync(join(dest, "package.json"), JSON.stringify(out, null, 2) + "\n");

  // denetim: çıplak import'lar tanımlı mı; yasak dosya yok mu
  const builtins = new Set(builtinModules.flatMap((m) => [m, `node:${m}`]));
  for (const f of walk(join(dest, "lib"))) {
    const rel = relative(dest, f).replace(/\\/g, "/");
    if (/\.(pem|key)$|(^|\/)\.env|\.test\.|\.tsbuildinfo$/.test(rel)) errors.push(`${src.name}: yasak dosya ${rel}`);
    if (!f.endsWith(".js")) continue;
    for (const m of readFileSync(f, "utf8").matchAll(
      /(?:^|[\s;])(?:import|export)\s[^'"]*?from\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/gm,
    )) {
      const spec = m[1] ?? m[2];
      if (!spec || spec.startsWith(".") || builtins.has(spec)) continue;
      const base = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
      if (base !== src.name && !deps[base] && !src.peerDependencies?.[base])
        errors.push(`${src.name}: ${rel} "${spec}" içe aktarıyor ama dependencies'te yok`);
    }
  }
  execSync(`npm pack --silent --pack-destination "${join(OUT, "tarballs")}"`, {
    cwd: dest,
    stdio: ["ignore", "pipe", "inherit"],
  });
  console.log(
    `✓ ${src.name}@${src.version} — exports: ${Object.keys(exportsOut)
      .filter((k) => k !== "./package.json")
      .join(", ")}`,
  );
}

if (errors.length) {
  console.error("\n✗ Yayın hazırlığı başarısız:\n  - " + errors.join("\n  - "));
  process.exit(1);
}
console.log(
  `\n${PKGS.length} paket hazır → .publish/ (tarball: .publish/tarballs). Sıradaki: node scripts/smoke-packages.mjs`,
);
