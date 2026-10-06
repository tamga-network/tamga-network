/**
 * @tamga-network/zk/node — masaüstü ispatçısı: Rust `tamga-zk-prove` ikilisini alt süreç olarak çalıştırır (stdin/stdout, ağ yok,
 * dosya yok). Test, uyum denemesi ve geliştirme içindir; telefonda aynı Rust kodu yerel kütüphane olarak çalışır
 * (`@tamga-network/zk/react-native`). İkili: `npm run zk:build -w @tamga-network/zk` (packages/zk/scripts/build-cli.mjs).
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { encodeProveBuffer } from "./present.js";
import { ZkError, type ZkCircuitSource, type ZkProveArgs, type ZkProver } from "./types.js";

const MAX_OUTPUT = 4 * 1024 * 1024;

export class NodeProcessProver implements ZkProver {
  readonly name = "node-process";
  private version?: number;
  constructor(
    private readonly bin: string,
    private readonly timeoutMs = 60_000,
  ) {}

  async available() {
    if (!existsSync(this.bin)) return false;
    try {
      await this.circuitVersion();
      return true;
    } catch {
      return false;
    }
  }

  async circuitVersion() {
    if (this.version !== undefined) return this.version;
    const out = await this.run(["--info"]);
    this.version = (JSON.parse(new TextDecoder().decode(out)) as { circuit_version: number }).circuit_version;
    return this.version;
  }

  async prove(args: ZkProveArgs): Promise<Uint8Array> {
    const req = encodeProveBuffer(args);
    const frame = new Uint8Array(4 + req.length);
    new DataView(frame.buffer).setUint32(0, req.length, true);
    frame.set(req, 4);
    const out = await this.run([], frame);
    if (out.length < 4) throw new ZkError("prove_failed", "prover returned no result");
    const dv = new DataView(out.buffer, out.byteOffset, out.byteLength);
    if (dv.getInt32(0, true) !== 0) throw new ZkError("prove_failed", "the proof could not be created");
    const n = dv.getUint32(4, true);
    return out.slice(8, 8 + n);
  }

  private run(argv: string[], input?: Uint8Array): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const p = spawn(this.bin, argv, { stdio: ["pipe", "pipe", "ignore"], windowsHide: true });
      const chunks: Buffer[] = [];
      let size = 0;
      const timer = setTimeout(() => p.kill(), this.timeoutMs);
      p.stdout.on("data", (c: Buffer) => {
        size += c.length;
        if (size > MAX_OUTPUT) p.kill();
        else chunks.push(c);
      });
      p.on("error", (e) => (clearTimeout(timer), reject(e)));
      p.on("close", () => {
        clearTimeout(timer);
        resolve(new Uint8Array(Buffer.concat(chunks)));
      });
      if (input) p.stdin.end(Buffer.from(input));
      else p.stdin.end();
    });
  }
}

/** Varsayılan ikili yolu: `TAMGA_ZK_PROVE_BIN` ya da derleme betiğinin çıktısı (`packages/zk/bin/`). */
export function defaultProverBin(): string {
  if (process.env.TAMGA_ZK_PROVE_BIN) return process.env.TAMGA_ZK_PROVE_BIN;
  const exe = process.platform === "win32" ? "tamga-zk-prove.exe" : "tamga-zk-prove";
  return join(fileURLToPath(new URL("../bin/", import.meta.url)), exe);
}

/** Klasördeki devre dosyaları (`<circuit_id>.zst`). */
export function fileCircuitSource(dir: string): ZkCircuitSource {
  return {
    get: async (id) => {
      if (!/^[0-9a-f]{64}$/.test(id)) return undefined;
      const p = join(dir, `${id}.zst`);
      return existsSync(p) ? new Uint8Array(readFileSync(p)) : undefined;
    },
  };
}
