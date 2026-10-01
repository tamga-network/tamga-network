/**
 * Deney (üretimde kullanılmaz): @tamga-network/verifier'ın Longfellow ZK doğrulamasını nasıl çağırabileceğinin prototipi.
 *
 * İlke: doğrulayıcı cüzdandan yalnız İSPATI alır. SessionTranscript'i kendi oturum bilgisinden (client_id, nonce,
 * response_uri) kendisi hesaplar; issuer açık anahtarını güven listesinden, devreyi imzalı listede yayınlanan özetle
 * (circuitSha256) eşleşen dosyadan alır. Sonra derlenmiş tamga-zk doğrulayıcısını çağırır (üretimde: napi/WASM modülü).
 *
 *   npx tsx experiments/zk-longfellow/bridge.ts      (tamga-network kökünden; önce gen-fixtures + tamga-zk prove)
 */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { oid4vpSessionTranscript } from "@tamga-network/mdoc";

const run = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const BIN = process.env.TAMGA_ZK_BIN ?? join(homedir(), "tools", "lf-target-native", "release", "tamga-zk.exe");

export interface ZkAgeRequest {
  /** Doğrulayıcının kendi oturumu (istekte gönderdiği değerler) — cüzdandan ALINMAZ. */
  session: { clientId: string; nonce: string; responseUri: string };
  /** Güven listesinden: belgeyi veren kurumun P-256 açık anahtarı (0x… onaltılık x, y). */
  issuer: { pkx: string; pky: string };
  docType: string;
  namespace: string;
  /** Doğrulama anı (ISO 8601, saniye hassasiyeti). */
  now: string;
  /** İmzalı listede yayınlanan kabul edilen devre: dosya + SHA-256. */
  circuit: { path: string; sha256: string };
}

export async function verifyAgeOver18Zk(proof: Uint8Array, req: ZkAgeRequest): Promise<{ valid: boolean; ms: number }> {
  const circuit = readFileSync(req.circuit.path);
  if (createHash("sha256").update(circuit).digest("hex") !== req.circuit.sha256)
    throw new Error("devre güven listesindeki özetle eşleşmiyor");
  const dir = mkdtempSync(join(tmpdir(), "tamga-zk-"));
  try {
    const transcript = oid4vpSessionTranscript(req.session.clientId, req.session.nonce, req.session.responseUri);
    writeFileSync(join(dir, "t.bin"), transcript);
    writeFileSync(join(dir, "p.bin"), proof);
    writeFileSync(
      join(dir, "m.json"),
      JSON.stringify({
        docType: req.docType,
        namespace: req.namespace,
        attribute: "age_over_18",
        valueCborHex: "f5",
        now: req.now,
        ...req.issuer,
      }),
    );
    const t0 = performance.now();
    try {
      await run(BIN, ["verify", req.circuit.path, join(dir, "t.bin"), join(dir, "m.json"), join(dir, "p.bin")]);
      return { valid: true, ms: Math.round(performance.now() - t0) };
    } catch {
      return { valid: false, ms: Math.round(performance.now() - t0) };
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---- Örnek: gen-fixtures çıktısı + cüzdanın ürettiği ispat (out/tamga/proof.bin)
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = join(HERE, "out");
  const meta = JSON.parse(readFileSync(join(out, "tamga", "meta.json"), "utf8"));
  const circuitPath = join(out, "circuit-v8-1.zst");
  const req: ZkAgeRequest = {
    session: meta.session,
    issuer: { pkx: meta.pkx, pky: meta.pky },
    docType: meta.docType,
    namespace: meta.namespace,
    now: meta.now,
    circuit: { path: circuitPath, sha256: createHash("sha256").update(readFileSync(circuitPath)).digest("hex") },
  };
  const proof = readFileSync(join(out, "tamga", "proof.bin"));
  console.log("geçerli ispat          →", await verifyAgeOver18Zk(proof, req));
  console.log(
    "başka nonce            →",
    await verifyAgeOver18Zk(proof, { ...req, session: { ...req.session, nonce: "n-baska" } }),
  );
  console.log(
    "başka doğrulayıcı      →",
    await verifyAgeOver18Zk(proof, { ...req, session: { ...req.session, clientId: "x509_san_dns:evil.example" } }),
  );
}
