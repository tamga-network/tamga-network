/**
 * ADR-0032 Aşama 3 — sıfır bilgi ispatı doğrulama arka ucu. Varsayılan: paketle gelen Longfellow WASM doğrulayıcısı
 * (`longfellow-verifier.wasm`, `scripts/zk-build.mjs`); her işletim sisteminde çalışır, Rust gerektirmez. Hız gereken sunucu
 * aynı arayüzle yerel (native) bir arka uç takabilir (`VerifyInput.zk`): `NativeZkBackend` paketin Rust kaynağından
 * (`zk/`, `--features native`) derlenen `tamga-zk-verify` ikilisini uzun ömürlü alt süreç olarak çalıştırır (WASM ~3 s →
 * yerel ~0,2 s); ikili yoksa, çökerse ya da süre aşılırsa o istek WASM ile doğrulanır.
 *
 * Güvenlik (Trail of Bits bulgusu #1, ZK2): devre dosyası ilk kullanımda bir kez özetlenir; özet imzalı güven listesindeki
 * `sha256` ile eşleşmezse devre kullanılmaz (her iki arka uçta da). WASM dosyası da manifestteki özetle denetlenir.
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Longfellow `MdocVerifierErrorCode` + Tamga kodları. */
export const ZK_CODES: Record<number, string> = {
  0: "valid",
  1: "circuit parsing failure",
  2: "proof too small",
  3: "proof parsing failure",
  4: "signature parsing failure",
  5: "proof does not verify",
  6: "null input",
  7: "invalid input",
  8: "arguments too small",
  9: "attribute number mismatch",
  10: "invalid circuit version",
  11: "unsupported attribute value",
  100: "malformed verifier input",
  101: "unknown circuit",
};

export interface ZkAttribute {
  namespace: string;
  id: string;
  /** Açıklanan değerin CBOR kodlaması (ör. true = 0xf5). */
  cbor: Uint8Array;
}
export interface ZkVerifyArgs {
  /** Longfellow `combined_hash` (onaltılık) — imzalı listedeki `circuit_id`. */
  circuitId: string;
  /** İmzalı listedeki devre dosyası özeti. */
  circuitSha256: string;
  /** Kurum P-256 açık anahtarı ("0x…" onaltılık x ve y). */
  pkx: string;
  pky: string;
  transcript: Uint8Array;
  /** İspatın "şimdi"si (ZkDocumentData.timestamp). */
  timestamp: string;
  docType: string;
  attributes: ZkAttribute[];
  proof: Uint8Array;
}
export interface ZkBackend {
  /** 0 = geçerli; diğerleri ZK_CODES. Atılan hata = işlenemedi (çağıran RED sayar). */
  verify(a: ZkVerifyArgs): Promise<number>;
}

interface WasmExports {
  memory: WebAssembly.Memory;
  tz_alloc(len: number): number;
  tz_free(ptr: number, len: number): void;
  tz_verify(ptr: number, len: number): number;
}

const HERE = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const sha256 = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const enc = new TextEncoder();

function field(b: Uint8Array): Uint8Array {
  const out = new Uint8Array(4 + b.length);
  new DataView(out.buffer).setUint32(0, b.length, true);
  out.set(b, 4);
  return out;
}
function u32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return b;
}
function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Devre dosyaları: ilk kullanımda okunur, imzalı listedeki özetle denetlenir (ZK2), sonra bellekte tutulur. */
class CircuitStore {
  private circuits = new Map<string, Uint8Array>(); // circuit_id → doğrulanmış devre baytları
  constructor(private circuitDir?: string) {}

  get(id: string, sha: string): Uint8Array {
    const have = this.circuits.get(id);
    if (have) return have;
    if (!/^[0-9a-f]{64}$/.test(id)) throw new Error("circuit id is not a 64-hex value");
    const path = this.circuitDir ? `${this.circuitDir}/${id}.zst` : HERE(`./circuits/${id}.zst`);
    const bytes = new Uint8Array(readFileSync(path));
    if (sha256(bytes) !== sha) throw new Error("circuit file does not match the trusted list (ZK2)");
    this.circuits.set(id, bytes);
    return bytes;
  }
}

/** Doğrulayıcı tamponu — WASM `tz_verify` ve yerel `tamga-zk-verify` aynı biçimi okur (bkz. zk/src/lib.rs). */
function encodeInput(a: ZkVerifyArgs, circuit: Uint8Array): Uint8Array {
  return concat([
    field(Uint8Array.from(Buffer.from(a.circuitId, "hex"))),
    field(circuit),
    field(enc.encode(a.pkx)),
    field(enc.encode(a.pky)),
    field(a.transcript),
    field(enc.encode(a.timestamp)),
    field(enc.encode(a.docType)),
    field(a.proof),
    field(u32(a.attributes.length)),
    ...a.attributes.flatMap((x) => [field(enc.encode(x.namespace)), field(enc.encode(x.id)), field(x.cbor)]),
  ]);
}

/** Paketle gelen WASM doğrulayıcısı. `circuitDir` verilmezse paketteki `zk/circuits/`. */
export class WasmZkBackend implements ZkBackend {
  private mod: WebAssembly.Module | null = null;
  private inst: WasmExports | null = null;
  private circuits: CircuitStore;

  constructor(private opts: { wasmPath?: string; circuitDir?: string; expectedWasmSha256?: string | null } = {}) {
    this.circuits = new CircuitStore(opts.circuitDir);
  }

  private exports(): WasmExports {
    if (this.inst) return this.inst;
    if (!this.mod) {
      const bytes = readFileSync(this.opts.wasmPath ?? HERE("./longfellow-verifier.wasm"));
      const expected =
        this.opts.expectedWasmSha256 === undefined
          ? (JSON.parse(readFileSync(HERE("./manifest.json"), "utf8")) as { wasm: { sha256: string } }).wasm.sha256
          : this.opts.expectedWasmSha256;
      if (expected && sha256(bytes) !== expected) throw new Error("ZK verifier wasm does not match its manifest");
      this.mod = new WebAssembly.Module(bytes);
    }
    // Rust panic = WASM tuzağı; tuzaktan sonra örnek atılır (bellek tutarsız olabilir), sonraki çağrı yeniden kurar.
    this.inst = new WebAssembly.Instance(this.mod, {}).exports as unknown as WasmExports;
    return this.inst;
  }

  async verify(a: ZkVerifyArgs): Promise<number> {
    const input = encodeInput(a, this.circuits.get(a.circuitId, a.circuitSha256));
    const x = this.exports();
    try {
      const p = x.tz_alloc(input.length);
      new Uint8Array(x.memory.buffer, p, input.length).set(input);
      const code = x.tz_verify(p, input.length);
      x.tz_free(p, input.length);
      return code;
    } catch (e) {
      this.inst = null;
      throw e;
    }
  }
}

let shared: WasmZkBackend | null = null;
/** Süreç başına tek WASM arka ucu (devreler bir kez özetlenir). */
export const defaultZkBackend = (): ZkBackend => (shared ??= new WasmZkBackend());

/**
 * Yerel (native) arka uç: `tamga-zk-verify` ikilisini bir kez başlatır, istekleri sırayla gönderir (stdin: u32 LE uzunluk +
 * tampon; stdout: i32 LE kod). İkili ağa ve dosyaya erişmez; boş ortamla başlar, verify servisinin systemd kısıtlarını
 * devralır. Sağlamlık: ikili yoksa, başlamazsa, çökerse ya da `timeoutMs` aşılırsa o istek `fallback`le (WASM) doğrulanır ve
 * yerel arka uç `cooldownMs` boyunca denenmez. Hiçbir hata "geçerli" sayılmaz: kod yalnız ikilinin ya da WASM'ın yanıtıdır.
 */
export class NativeZkBackend implements ZkBackend {
  private child: ChildProcessWithoutNullStreams | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private disabledUntil = 0;
  private circuits: CircuitStore;
  private readonly fallback: ZkBackend;
  private readonly timeoutMs: number;
  private readonly cooldownMs: number;
  /** Son isteği hangi arka uç doğruladı (gözlem ve test için). */
  lastBackend: "native" | "fallback" | null = null;

  constructor(
    private opts: {
      binPath: string;
      circuitDir?: string;
      fallback?: ZkBackend;
      timeoutMs?: number;
      cooldownMs?: number;
      onWarn?: (msg: string) => void;
    },
  ) {
    this.circuits = new CircuitStore(opts.circuitDir);
    this.fallback = opts.fallback ?? defaultZkBackend();
    this.timeoutMs = opts.timeoutMs ?? 10_000;
    this.cooldownMs = opts.cooldownMs ?? 60_000;
  }

  verify(a: ZkVerifyArgs): Promise<number> {
    // Alt süreç istekleri tek tek işler; yanıtlar istek sırasıyla eşleşsin diye kuyruk.
    const run = this.queue.then(() => this.verifyOne(a));
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** Alt süreci kapatır (servis kapanırken ya da testte). */
  close(): void {
    this.child?.kill();
    this.child = null;
  }

  private async verifyOne(a: ZkVerifyArgs): Promise<number> {
    const input = encodeInput(a, this.circuits.get(a.circuitId, a.circuitSha256)); // ZK2: iki yolda da burada
    if (Date.now() >= this.disabledUntil) {
      try {
        const code = await this.ask(input);
        this.lastBackend = "native";
        return code;
      } catch (e) {
        this.close();
        this.disabledUntil = Date.now() + this.cooldownMs;
        this.opts.onWarn?.(`native ZK verifier unavailable (${(e as Error).message}); using WASM`);
      }
    }
    this.lastBackend = "fallback";
    return this.fallback.verify(a);
  }

  private start(): ChildProcessWithoutNullStreams {
    if (this.child) return this.child;
    if (!existsSync(this.opts.binPath)) throw new Error("binary not found");
    const child = spawn(this.opts.binPath, [], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true, env: {} });
    child.on("exit", () => {
      if (this.child === child) this.child = null;
    });
    child.on("error", () => undefined); // başlatma hatası ask() içinde ele alınır
    child.stderr.resume(); // ikili stderr'e yazmaz; tampon dolmasın
    this.child = child;
    return child;
  }

  private ask(input: Uint8Array): Promise<number> {
    return new Promise((resolve, reject) => {
      let child: ChildProcessWithoutNullStreams;
      try {
        child = this.start();
      } catch (e) {
        reject(e as Error);
        return;
      }
      let got = Buffer.alloc(0);
      const finish = (err: Error | null, code?: number) => {
        clearTimeout(timer);
        child.stdout.off("data", onData);
        child.off("exit", onExit);
        child.off("error", onError);
        if (err) reject(err);
        else resolve(code as number);
      };
      const onData = (d: Buffer) => {
        got = Buffer.concat([got, d]);
        if (got.length >= 4) finish(null, got.readInt32LE(0));
      };
      const onExit = () => finish(new Error("process exited"));
      const onError = (e: Error) => finish(e);
      const timer = setTimeout(() => finish(new Error("timeout")), this.timeoutMs);
      child.stdout.on("data", onData);
      child.once("exit", onExit);
      child.once("error", onError);
      child.stdin.write(Buffer.concat([Buffer.from(u32(input.length)), Buffer.from(input)]));
    });
  }
}

/**
 * Ortamdan arka uç: `TAMGA_ZK_NATIVE_BIN` verilmişse yerel (yoksa/başlamazsa WASM'a düşer), verilmemişse WASM.
 * Servisler bunu bir kez çağırıp `VerifyInput.zk` olarak geçirir.
 */
export function zkBackendFromEnv(
  env: Record<string, string | undefined> = process.env,
  onWarn?: (msg: string) => void,
): ZkBackend {
  const bin = env.TAMGA_ZK_NATIVE_BIN?.trim();
  return bin ? new NativeZkBackend({ binPath: bin, onWarn }) : defaultZkBackend();
}
