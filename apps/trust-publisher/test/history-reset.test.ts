/**
 * Sandbox geçmiş temizliği (ADR-0038 K5, `history-reset`): arşivde her listenin yalnız son sürümü kalır, CHANGELOG yeniden başlar,
 * yayımlanmayan iptal girdilerinin yolu adsızlaşır; güncel listeler, sürüm zinciri (TL2), durum bitleri ve geçerli kayıt
 * sertifikaları değişmez; tekrar çalıştırma değişiklik yapmaz; gerçek ağda reddedilir.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { StatusBitstring } from "@tamga-network/sd-jwt";
import { sha256Tag, utf8 } from "@tamga-network/trust";
import { HISTORY_RESET_MARK, changelogIsReset, planArchivePrune } from "../src/history-reset.js";
import {
  RETIRED_PATH,
  assignWrprcStatus,
  emptyState,
  redactRetiredWrprcPaths,
  statusBits,
} from "../src/wrprc-status.js";

const ROOT = resolve(import.meta.dirname, "../../..");
const APP = resolve(ROOT, "apps/trust-publisher");
const CLI = resolve(APP, "src/cli.ts");
const TSX = resolve(ROOT, "node_modules/tsx/dist/cli.mjs");
const URI = "https://trust.sandbox.tamga.network/status/wrprc/1";

describe("history-reset birim", () => {
  it("arşiv planı: her taban + uzantı için en yüksek sürüm kalır; durum kopyaları silinir; çapa arşivlerine dokunulmaz", () => {
    const files = [
      "lotl.v0001.jws",
      "lotl.v0002.jws",
      "tl-tr.v0001.jws",
      "tl-tr.v0010.jws",
      "tl-tr.v0009.xml",
      "tl-tr.v0010.xml",
      "lote-issuers.v0003.jws",
      "lote-issuers.v0004.jws",
      "wrprc-status.20261104T100000Z.json",
      "wrprc-status.20261104T110000Z.json",
      "anchors-0000000-0000500.jsonl",
      "anchors-0000000-0000500-1793793496172.jsonl",
    ];
    const p = planArchivePrune(files);
    expect(p.kept).toEqual(["lote-issuers.v0004.jws", "lotl.v0002.jws", "tl-tr.v0010.jws", "tl-tr.v0010.xml"]);
    expect(p.remove).toEqual([
      "lote-issuers.v0003.jws",
      "lotl.v0001.jws",
      "tl-tr.v0001.jws",
      "tl-tr.v0009.xml",
      "wrprc-status.20261104T100000Z.json",
      "wrprc-status.20261104T110000Z.json",
    ]);
    expect(planArchivePrune(p.kept).remove).toEqual([]);
  });

  it("CHANGELOG: yalnız temizlik satırı varsa 'temizlenmiş' sayılır", () => {
    const h = "# trust.tamga.network — Changelog (public)\n\n";
    expect(changelogIsReset(`${h}- 2026-11-04T12:00:00.000Z — ${HISTORY_RESET_MARK}: x\n`)).toBe(true);
    expect(changelogIsReset(`${h}- 2026-11-04T12:00:00.000Z — ${HISTORY_RESET_MARK}: x\n- t — build: lotl v2\n`)).toBe(
      false,
    );
    expect(changelogIsReset(h)).toBe(false);
  });

  it("durum: yayımlanmayan iptal girdisinin yolu adsızlaşır; indeks, bit ve geçerli girdiler aynı kalır", () => {
    const it0 = (path: string) => ({ path, payload: { name: "X", iat: 1, exp: 1_900_000_000 } });
    const t = new Date("2026-11-01T00:00:00Z");
    const a = assignWrprcStatus(emptyState(URI), [it0("wrprc/issuer/old-name.jwt"), it0("wrprc/issuer/keep.jwt")], t);
    const b = assignWrprcStatus(a.state, [it0("wrprc/issuer/keep.jwt")], t); // old-name kalktı → iptal
    const before = statusBits(b.state).bytes;
    const r = redactRetiredWrprcPaths(b.state, new Set(["wrprc/issuer/keep.jwt"]));
    expect(r.redacted).toBe(1);
    expect(JSON.stringify(r.state)).not.toMatch(/old-name/);
    const old = r.state.entries.find((e) => e.status === "REVOKED")!;
    expect(old.path).toBe(RETIRED_PATH);
    expect(old.reason).toBe("registration_ended");
    expect(statusBits(r.state).bytes).toEqual(before);
    expect(r.state.entries.find((e) => e.status === "VALID")).toEqual(
      b.state.entries.find((e) => e.status === "VALID"),
    );
    // tekrar: değişiklik yok; yeni yayında iptal indeksi yeniden verilmez, geçerli girdi aynı indeksi korur
    expect(redactRetiredWrprcPaths(r.state, new Set(["wrprc/issuer/keep.jwt"])).redacted).toBe(0);
    const c = assignWrprcStatus(r.state, [it0("wrprc/issuer/keep.jwt"), it0("wrprc/issuer/new.jwt")], t);
    expect(c.idxOf.get("wrprc/issuer/keep.jwt")).toBe(b.idxOf.get("wrprc/issuer/keep.jwt"));
    expect(c.idxOf.get("wrprc/issuer/new.jwt")).not.toBe(old.idx);
  });
});

const SB_PKI = resolve(ROOT, "ops/pki-sandbox");
const ready =
  existsSync(resolve(SB_PKI, "registrar-1.pkcs8.pem")) && existsSync(resolve(ROOT, "packages/schemas/dist/index.json"));

describe.skipIf(!ready)("history-reset uçtan uca (sandbox kayıt defteri, geçici klasör)", { timeout: 300_000 }, () => {
  const tmp = mkdtempSync(join(tmpdir(), "tamga-sandbox-history-"));
  const REG = join(tmp, "registry");
  const DIST = join(tmp, "dist-sandbox");
  const run = (args: string[], env: Record<string, string> = {}) => {
    const r = spawnSync(process.execPath, [TSX, CLI, ...args], {
      cwd: ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        TAMGA_NETWORK: "sandbox",
        TAMGA_TP_REGISTRY: REG,
        TAMGA_TP_DIST: DIST,
        TAMGA_TP_PKI: SB_PKI,
        ...env,
      },
      timeout: 90_000,
    });
    return { code: r.status, out: r.stdout, err: r.stderr };
  };
  const ok = (args: string[]) => {
    const r = run(args);
    if (r.code !== 0) throw new Error(r.err || r.out);
    return r.out;
  };
  const read = (f: string) => readFileSync(join(DIST, f), "utf8");
  const payload = (f: string) => JSON.parse(Buffer.from(read(f).trim().split(".")[1], "base64url").toString());
  const bits = () => StatusBitstring.fromLst(payload("status/wrprc/1").status_list.lst, 100_000, 1);
  const OLD = "job-application-1"; // "eski ad" yerine: kullanım sona erince kayıt sertifikası yayından kalkar (registration_ended)

  beforeAll(() => {
    cpSync(resolve(APP, "registry-sandbox"), REG, { recursive: true });
    mkdirSync(DIST);
    ok(["build"]);
    ok(["build"]);
    ok(["end-use", "verify.sandbox.tamga.network", OLD]);
    ok(["build"]);
  }, 300_000);
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it("gerekçe zorunlu ve kişisiz; gerçek ağ kayıt defteriyle reddedilir", () => {
    expect(run(["history-reset"]).err).toMatch(/gerekçe zorunlu/);
    expect(run(["history-reset", "--reason", "Ali Veli istedi"]).err).toMatch(/kişi adı/);
    const prod = run(["history-reset", "--reason", "x"], { TAMGA_TP_REGISTRY: resolve(APP, "registry") });
    expect(prod.code).not.toBe(0);
    expect(prod.err).toMatch(/yalnız sandbox/);
  });

  it("geçmiş temizlenir; güncel listeler, bitler ve geçerli sertifikalar aynı; tekrar çalıştırma değişiklik yapmaz; sonraki sürüm zincire bağlanır", () => {
    const st0 = JSON.parse(read("wrprc-status.json"));
    const old = st0.entries.find((e: { path: string }) => e.path.endsWith(`/${OLD}.jwt`));
    expect(old.status).toBe("REVOKED");
    expect(read("CHANGELOG.md")).toContain(OLD);
    expect(readdirSync(join(DIST, "archive")).filter((f) => /^tl-tr\.v\d+\.jws$/.test(f)).length).toBeGreaterThan(1);
    const lotl0 = read("lotl.jws"),
      tl0 = read("tl-tr.jws"),
      v0 = JSON.parse(read("tl-tr.json")).version as number;
    const valid = "wrprc/issuer/example-university.jwt";
    const cert0 = read(valid);
    const validIdx = payload(valid).status.status_list.idx as number;
    expect(bits().get(old.idx)).toBe(1);
    expect(bits().get(validIdx)).toBe(0);

    const out = ok(["history-reset", "--reason", "sandbox example names renamed"]);
    expect(out).toMatch(/redacted/);
    // güncel listeler aynı (cüzdan ve doğrulayıcı sürüm belleği bozulmaz)
    expect(read("lotl.jws")).toBe(lotl0);
    expect(read("tl-tr.jws")).toBe(tl0);
    // arşiv: listelerin yalnız son sürümü + tek durum kopyası; eski ad yok
    const arch = readdirSync(join(DIST, "archive"));
    expect(arch.filter((f) => /^tl-tr\.v\d+\.jws$/.test(f))).toEqual([`tl-tr.v${String(v0).padStart(4, "0")}.jws`]);
    expect(arch.filter((f) => f.startsWith("wrprc-status.")).length).toBe(1);
    for (const f of arch) expect(readFileSync(join(DIST, "archive", f), "utf8"), f).not.toContain(`/${OLD}.jwt`);
    // durum: yol adsız, bitler aynı, geçerli sertifika aynı dosya ve aynı indeks
    expect(read("wrprc-status.json")).not.toContain(OLD);
    expect(bits().get(old.idx)).toBe(1);
    expect(bits().get(validIdx)).toBe(0);
    expect(read(valid)).toBe(cert0);
    // CHANGELOG yalnız temizlik satırı
    const cl = read("CHANGELOG.md");
    expect(cl).not.toContain(OLD);
    expect(changelogIsReset(cl)).toBe(true);
    // tekrar: değişiklik yok
    const snap = () => [read("CHANGELOG.md"), read("wrprc-status.json"), readdirSync(join(DIST, "archive")).join(",")];
    const s1 = snap();
    expect(ok(["history-reset", "--reason", "again"])).toMatch(/değişiklik yok/);
    expect(snap()).toEqual(s1);
    // sonraki derleme: sürüm +1, önceki özet = korunan güncel liste; doğrulama sağlıklı; iptal kalıcı
    ok(["build"]);
    const tl1 = JSON.parse(read("tl-tr.json"));
    expect(tl1.version).toBe(v0 + 1);
    expect(tl1.previous_version_hash).toBe(sha256Tag(utf8(tl0)));
    expect(bits().get(old.idx)).toBe(1);
    expect(payload(valid).status.status_list.idx).toBe(validIdx);
    const v = run(["verify"]);
    expect(v.code, v.err).toBe(0);
  });
});
