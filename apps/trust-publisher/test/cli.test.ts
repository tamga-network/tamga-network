/**
 * trust-publisher CLI (güven listesini İMZALAYAN araç) — iç inceleme Y11. Araç gerçek süreç olarak, geçici klasörde çalışır
 * (TAMGA_TP_REGISTRY / TAMGA_TP_DIST); gerçek registry/ ve dist/'e dokunulmaz. Kanıtlananlar (SPEC-TRUST-0001):
 * sağlıklı ilk set, tekdüze sürüm + önceki sürüm özeti zinciri (TL2), arşiv kopyaları, statü değişiminde geçmişin korunması,
 * çapa günlüğü arşivi + tam zincir doğrulaması (TL10/TL12), kurcalanmış liste dosyasının reddi.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { sha256Tag, utf8 } from "@tamga-network/trust";

const ROOT = resolve(import.meta.dirname, "../../..");
const CLI = resolve(ROOT, "apps/trust-publisher/src/cli.ts");
const TSX = resolve(ROOT, "node_modules/tsx/dist/cli.mjs");
const ready =
  existsSync(resolve(ROOT, "ops/pki/tl-signer-1.pkcs8.pem")) &&
  existsSync(resolve(ROOT, "packages/schemas/dist/index.json"));

describe.skipIf(!ready)("trust-publisher CLI (geçici klasörde)", () => {
  const tmp = mkdtempSync(join(tmpdir(), "tamga-tp-"));
  const REG = join(tmp, "registry");
  const DIST = join(tmp, "dist");
  const run = (args: string[], extraEnv: Record<string, string> = {}) => {
    const r = spawnSync(process.execPath, [TSX, CLI, ...args], {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, TAMGA_TP_REGISTRY: REG, TAMGA_TP_DIST: DIST, ...extraEnv },
      timeout: 60_000,
    });
    return { code: r.status, out: r.stdout, err: r.stderr };
  };
  const json = (f: string) => JSON.parse(readFileSync(join(DIST, f), "utf8"));
  const verify = (full = false) => {
    const r = run(full ? ["verify", "--full"] : ["verify"]);
    const start = r.out.indexOf("{");
    return { code: r.code, report: start >= 0 ? JSON.parse(r.out.slice(start)).report : null, err: r.err };
  };

  beforeAll(() => {
    cpSync(resolve(ROOT, "apps/trust-publisher/registry"), REG, { recursive: true });
    mkdirSync(DIST);
  });
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it("ilk derleme: imzalı lotl + tl-tr, sürüm 1, önceki özet yok; doğrulama sağlıklı", () => {
    const b = run(["build"]);
    expect(b.code, b.err).toBe(0);
    for (const f of ["lotl.jws", "tl-tr.jws", "lotl.json", "tl-tr.json", "keys/root-fingerprints.json", "CHANGELOG.md"])
      expect(existsSync(join(DIST, f)), f).toBe(true);
    expect(json("lotl.json").version).toBe(1);
    expect(json("tl-tr.json").previous_version_hash).toBeNull();
    // keys/: yalnız listenin andığı sertifikalar (ADR-0042: gerçek ağda cüzdan sağlayıcı anahtarı yok)
    expect(existsSync(join(DIST, "keys", "tl-signer-1.cert.pem"))).toBe(true);
    expect(existsSync(join(DIST, "keys", "root-ca.cert.pem"))).toBe(true);
    expect(existsSync(join(DIST, "keys", "wallet-provider.cert.pem"))).toBe(false);
    const v = verify();
    expect(v.code).toBe(0);
    expect(v.report.healthy).toBe(true);
  });

  it("TL2: her derleme sürümü bir artırır ve önceki .jws'in özetine zincirlenir; eski sürüm arşivde kalır", () => {
    const prevJws = readFileSync(join(DIST, "tl-tr.jws"), "utf8");
    expect(run(["build"]).code).toBe(0);
    const tl = json("tl-tr.json");
    expect(tl.version).toBe(2);
    expect(tl.previous_version_hash).toBe(sha256Tag(utf8(prevJws)));
    const archived = readdirSync(join(DIST, "archive"));
    expect(archived).toContain("tl-tr.v0001.jws");
    expect(archived).toContain("tl-tr.v0002.jws");
    expect(readFileSync(join(DIST, "archive", "tl-tr.v0001.jws"), "utf8")).toBe(prevJws);
  });

  it("statü değişimi: kayıt güncellenir, status_history silinmez, liste yeniden imzalanır ve sağlıklı kalır", () => {
    const src = JSON.parse(readFileSync(join(REG, "tl-tr.source.json"), "utf8"));
    const slug = src.issuers.find((i: { status: string }) => i.status === "ACTIVE").slug as string;
    const before = src.issuers.find((i: { slug: string }) => i.slug === slug).status_history.length;
    const r = run(["status", slug, "SUSPENDED", "--reason", "test"]);
    expect(r.code, r.err).toBe(0);
    const after = JSON.parse(readFileSync(join(REG, "tl-tr.source.json"), "utf8")).issuers.find(
      (i: { slug: string }) => i.slug === slug,
    );
    expect(after.status).toBe("SUSPENDED");
    expect(after.status_history.length).toBe(before + 1);
    expect(json("tl-tr.json").version).toBe(3);
    const signed = json("tl-tr.json").issuers.find((i: { slug?: string }) => i.slug === slug);
    expect(signed.status).toBe("SUSPENDED");
    expect(verify().report.healthy).toBe(true);
  });

  it("TL10/TL12: çapa günlüğü arşivlenir (imzalı durum kontrol noktası), tam zincir baştan doğrulanır", () => {
    for (let i = 0; i < 4; i++) expect(run(["heartbeat"]).code).toBe(0);
    const a = run(["archive"]);
    expect(a.code, a.err).toBe(0);
    const head = readFileSync(join(DIST, "anchors.jsonl"), "utf8").trim().split("\n");
    expect(head.length).toBeLessThanOrEqual(2); // kontrol noktası (+ varsa sonraki satır)
    expect(readdirSync(join(DIST, "archive")).some((f) => f.startsWith("anchors"))).toBe(true);
    expect(run(["heartbeat"]).code).toBe(0); // arşivden sonra zincir devam eder
    const full = verify(true);
    expect(full.code, full.err).toBe(0);
    expect(full.report.healthy).toBe(true);
  }, 60_000); // alt süreç zinciri: yük altında 20 sn sınırını aşabilir

  it("TL12 sıfırlama: seq 0'dan yeniden başlayan günlüğün arşivi eski arşivi ezmez (ada zaman eki); zincir sağlıklı", () => {
    rmSync(join(DIST, "anchors.jsonl")); // sandbox gece sıfırlaması gibi: günlük gider, arşiv klasörü kalır
    for (let i = 0; i < 2; i++) expect(run(["heartbeat"]).code).toBe(0); // seq 0, 1
    const clash = join(DIST, "archive", "anchors-0000000-0000001.jsonl");
    const old = "eski sıfırlama öncesi arşiv\n";
    writeFileSync(clash, old);
    const a = run(["archive"]);
    expect(a.code, a.err).toBe(0);
    expect(readFileSync(clash, "utf8")).toBe(old); // ezilmedi
    expect(readdirSync(join(DIST, "archive")).some((f) => /^anchors-0000000-0000001-\d+\.jsonl$/.test(f))).toBe(true);
    const full = verify(true);
    expect(full.code, full.err).toBe(0);
    expect(full.report.healthy).toBe(true);
  }, 60_000); // alt süreç zinciri: yük altında 20 sn sınırını aşabilir

  it("kurcalanmış liste: imzalı gövdede tek bayt değişirse doğrulama sağlıksız (çıkış 2 ya da hata)", () => {
    const f = join(DIST, "tl-tr.jws");
    const jws = readFileSync(f, "utf8");
    const [h, p, s] = jws.trim().split(".");
    const body = Buffer.from(p, "base64url").toString("utf8").replace('"SUSPENDED"', '"ACTIVE"');
    writeFileSync(f, [h, Buffer.from(body, "utf8").toString("base64url"), s].join("."));
    const v = verify();
    expect(v.code).not.toBe(0);
    writeFileSync(f, jws);
  });
});
