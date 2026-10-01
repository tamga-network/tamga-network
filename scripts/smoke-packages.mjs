#!/usr/bin/env node
/**
 * Yayın dumanı testi: .publish/tarballs/*.tgz geçici bir projeye kurulur (monorepo bağları YOK), her exports girişi düz Node
 * ile içe aktarılır ve TypeScript (NodeNext) tipleri çözümlenir. Kaynak koda ya da tsconfig paths'e gizli bağımlılık kalmışsa
 * burada düşer. İnternet gerekir (dış bağımlılıklar npm'den). Kullanım: node scripts/pack-packages.mjs && node scripts/smoke-packages.mjs
 */
import { execSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const TGZ = join(ROOT, ".publish", "tarballs");
const tarballs = readdirSync(TGZ).filter((f) => f.endsWith(".tgz"));
if (!tarballs.length) throw new Error("tarball yok — önce node scripts/pack-packages.mjs");

const dir = mkdtempSync(join(tmpdir(), "tamga-smoke-"));
const sh = (cmd) => execSync(cmd, { cwd: dir, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
try {
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "tamga-smoke", private: true, type: "module" }));
  console.log(`== ${tarballs.length} paket kuruluyor (${dir})`);
  sh(
    `npm install --no-audit --no-fund --loglevel=error ${tarballs.map((t) => `"${join(TGZ, t)}"`).join(" ")} typescript@5 @types/node@22`,
  );

  // her paketin her exports girişi
  const entries = [];
  for (const p of readdirSync(join(ROOT, ".publish")).filter((d) => d !== "tarballs")) {
    const pj = JSON.parse(readFileSync(join(ROOT, ".publish", p, "package.json"), "utf8"));
    for (const k of Object.keys(pj.exports))
      if (k !== "./package.json") entries.push(k === "." ? pj.name : `${pj.name}/${k.slice(2)}`);
  }
  // 1) çalışma zamanı: düz Node (koşul yok) ile içe aktar, en az bir dışa aktarım olmalı
  const js = entries
    .map((e, i) => `import * as m${i} from "${e}"; if (!Object.keys(m${i}).length) throw new Error("boş: ${e}");`)
    .join("\n");
  writeFileSync(
    join(dir, "smoke.mjs"),
    js + `\nconsole.log("çalışma zamanı: ${entries.length} giriş içe aktarıldı");\n`,
  );
  console.log(sh("node smoke.mjs").trim());
  // 2) tipler: NodeNext çözümlemesiyle her giriş
  writeFileSync(
    join(dir, "smoke.ts"),
    entries.map((e, i) => `import * as t${i} from "${e}";\nvoid t${i};`).join("\n") + "\n",
  );
  writeFileSync(
    join(dir, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
        target: "ES2022",
        strict: true,
        noEmit: true,
        lib: ["ES2022", "DOM"],
        types: ["node"],
      },
      files: ["smoke.ts"],
    }),
  );
  sh("npx tsc -p tsconfig.json");
  console.log(`tipler: ${entries.length} giriş NodeNext ile çözüldü (skipLibCheck KAPALI)`);
  console.log("✓ duman testi geçti: " + entries.join(", "));
} catch (e) {
  console.error(
    "✗ duman testi başarısız:\n" + (e.stdout ?? "") + (e.stderr ?? "") + (e.stdout || e.stderr ? "" : e.message),
  );
  process.exitCode = 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
