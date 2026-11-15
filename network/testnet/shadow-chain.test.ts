/**
 * network/testnet/shadow-chain.sh — kuru çalıştırma (`--dry-run`): araç, ağ ve zincir olmadan her adımın komutunu basar ve yalnız
 * bağımsız değişkenleri denetler; gerçek ağ yalnız HTTPS ile okunur, en az 4 doğrulayıcı. Windows'ta atlanır (`bash` WSL olabilir).
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const script = fileURLToPath(new URL("./shadow-chain.sh", import.meta.url));
const run = (...args: string[]) =>
  spawnSync("bash", [script, ...args], { encoding: "utf8", env: { ...process.env, TESTNET_DIR: "" } });

describe.skipIf(process.platform === "win32")("shadow-chain.sh — kuru çalıştırma", () => {
  it("setup: altı adımın komutları basılır, hiçbiri çalışmaz", () => {
    const r = run("setup", "--dry-run", "--validators", "5");
    expect(r.status, r.stderr).toBe(0);
    for (const s of [
      "install-besu.sh",
      "make-network.sh --validators 5 --extra 0 --keys generate --chain-id 31339",
      "node.sh start all",
      "mirror-lists.ts --base https://trust.tamga.network",
      "bootstrap-governance.sh",
      "chain-health",
    ])
      expect(r.stdout).toContain(s);
    expect(r.stdout).toMatch(/nothing was executed/);
  });

  it("sync: yansıtma, sürekli projeksiyon, çapa, sağlık", () => {
    const r = run("sync", "--dry-run");
    expect(r.status, r.stderr).toBe(0);
    for (const s of ["mirror-lists.ts", "chain-sync", "chain-submit", "chain-health"]) expect(r.stdout).toContain(s);
  });

  it("bağımsız değişken denetimi: http kaynak, 4'ten az doğrulayıcı, bilinmeyen alt komut reddedilir", () => {
    expect(run("setup", "--dry-run", "--source", "http://trust.example").stderr).toMatch(/https/);
    expect(run("setup", "--dry-run", "--validators", "3").stderr).toMatch(/>= 4/);
    expect(run("nope").status).toBe(1);
  });
});
