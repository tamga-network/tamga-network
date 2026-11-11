/**
 * network/testnet/make-network.sh — `--keys dev` (Hardhat's PUBLIC test keys) is refused together with non-loopback `--hosts`
 * (review 2026-11-10): a network reachable from other machines must not run on keys everybody knows. The refusal happens before
 * any tool (jq, Besu, JDK) is needed, so the test runs on a bare machine. Skipped on Windows (`bash` there may be WSL).
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const script = fileURLToPath(new URL("./make-network.sh", import.meta.url));
const run = (...args: string[]) => spawnSync("bash", [script, ...args], { encoding: "utf8" });

describe.skipIf(process.platform === "win32")("make-network.sh — public test keys stay on loopback", () => {
  it("--keys dev with a non-loopback host is refused (also when dev is the default)", () => {
    for (const args of [
      ["--keys", "dev", "--hosts", "10.0.0.1 10.0.0.2 10.0.0.3 10.0.0.4 10.0.0.5"],
      ["--hosts", "127.0.0.1 127.0.0.2 127.0.0.3 127.0.0.4 203.0.113.7"],
      ["--validators", "1", "--extra", "0", "--hosts", "0.0.0.0"],
    ]) {
      const r = run(...args);
      expect(r.status, args.join(" ")).toBe(1);
      expect(r.stderr).toMatch(/--keys dev uses the public test keys and is refused with a non-loopback host/);
    }
  });

  it("loopback hosts and --keys generate pass this check (they stop later, at the tool checks)", () => {
    for (const args of [
      ["--keys", "dev", "--hosts", "127.0.0.1 ::1 localhost", "--besu-home", "/nonexistent"],
      ["--keys", "generate", "--hosts", "10.0.0.1", "--besu-home", "/nonexistent"],
    ]) {
      const r = run(...args);
      expect(r.status).not.toBe(0);
      expect(r.stderr).not.toMatch(/refused with a non-loopback host/);
    }
  });
});
