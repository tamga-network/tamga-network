/**
 * ADR-0068 — kayıt sertifikası politikası ve durum listesi: indeks verme (aynı içerik aynı indeks, değişen içerik ve kalkan kayıt
 * iptal, iptal edilen indeks bir daha kullanılmaz), elle iptal (içerik engeli), ayar denetimi, imzalı Token Status List; sandbox
 * kayıt defteriyle uçtan uca `build` → `wrprc-revoke` → `heartbeat`.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { compactVerify, decodeProtectedHeader, importX509 } from "jose";
import { StatusBitstring } from "@tamga-network/sd-jwt";
import {
  ETSI_EU_WRPRC_POLICY_OID,
  assignWrprcStatus,
  contentDigest,
  emptyState,
  migrateWrprcState,
  pruneRetiredLists,
  recoverWrprcState,
  revocationNoteProblems,
  revokeWrprc,
  signWrprcStatusList,
  statusBits,
  wrprcConfigProblems,
} from "../src/wrprc-status.js";

const URI = "https://trust.sandbox.tamga.network/status/wrprc/1";
const BASE = "https://trust.sandbox.tamga.network";
const t0 = new Date("2026-10-29T00:00:00Z");
const item = (path: string, extra: Record<string, unknown> = {}, exp = 1_900_000_000) => ({
  path,
  payload: { name: "Shop", sub: "VATTR-1", iat: 1, exp, ...extra },
});

describe("ADR-0068 indeks verme", () => {
  it("aynı içerik yeniden yayında aynı indeksi alır (iat farklı olsa da)", () => {
    const a = assignWrprcStatus(emptyState(URI), [item("wrprc/rp/a/x.jwt")], t0);
    const b = assignWrprcStatus(
      a.state,
      [{ ...item("wrprc/rp/a/x.jwt"), payload: { ...item("x").payload, iat: 99 } }],
      t0,
    );
    expect(b.idxOf.get("wrprc/rp/a/x.jwt")).toBe(a.idxOf.get("wrprc/rp/a/x.jwt"));
    expect(b.revoked).toEqual([]);
    expect(b.state.entries).toHaveLength(1);
  });

  it("içerik değişince yeni indeks, eskisi iptal (superseded); kısalan bitiş de değişikliktir", () => {
    const a = assignWrprcStatus(emptyState(URI), [item("p")], t0);
    const b = assignWrprcStatus(a.state, [item("p", { purpose: [{ lang: "en", value: "yeni" }] })], t0);
    expect(b.idxOf.get("p")).not.toBe(a.idxOf.get("p"));
    expect(b.revoked.map((e) => [e.idx, e.reason])).toEqual([[a.idxOf.get("p"), "superseded"]]);
    const c = assignWrprcStatus(b.state, [item("p", { purpose: [{ lang: "en", value: "yeni" }] }, 1_800_000_000)], t0);
    expect(c.idxOf.get("p")).not.toBe(b.idxOf.get("p"));
    expect(c.revoked[0].reason).toBe("superseded");
    // daha geç bitiş (yenileme) aynı indeksi korur
    const d = assignWrprcStatus(c.state, [item("p", { purpose: [{ lang: "en", value: "yeni" }] }, 1_850_000_000)], t0);
    expect(d.idxOf.get("p")).toBe(c.idxOf.get("p"));
  });

  it("yayından kalkan sertifika iptal (registration_ended); iptal edilen indeks yeniden verilmez", () => {
    const a = assignWrprcStatus(emptyState(URI), [item("p"), item("q")], t0);
    const b = assignWrprcStatus(a.state, [item("q")], t0);
    expect(b.revoked.map((e) => e.reason)).toEqual(["registration_ended"]);
    // kayıt geri gelirse (aynı içerik) YENİ indeks: iptal edilen bit geri alınmaz
    const c = assignWrprcStatus(b.state, [item("p"), item("q")], t0);
    expect(c.idxOf.get("p")).not.toBe(a.idxOf.get("p"));
    const used = c.state.entries.map((e) => e.idx);
    expect(new Set(used).size).toBe(used.length);
  });

  it("elle iptal: gerekçe zorunlu, içerik engellenir, değişince yeniden verilir", () => {
    const a = assignWrprcStatus(emptyState(URI), [item("p")], t0);
    expect(() => revokeWrprc(a.state, "p", " ", t0)).toThrow(/gerekçe/);
    expect(() => revokeWrprc(a.state, "yok", "other", t0)).toThrow(/geçerli/);
    const r = revokeWrprc(a.state, "p", "ceased", t0, "kurum isteği");
    expect(r.entry.reason).toBe("manual: ceased (kurum isteği)");
    const b = assignWrprcStatus(r.state, [item("p")], t0);
    expect(b.blocked).toEqual(["p"]);
    expect(b.idxOf.has("p")).toBe(false);
    const c = assignWrprcStatus(b.state, [item("p", { name: "Shop 2" })], t0);
    expect(c.idxOf.has("p")).toBe(true);
  });

  it("elle iptal gerekçesi kapalı kümeden; not kişisiz ve kısa (e-posta, numara, bağlantı, Ad Soyad reddedilir)", () => {
    const a = assignWrprcStatus(emptyState(URI), [item("p")], t0);
    expect(() => revokeWrprc(a.state, "p", "kurum isteği", t0)).toThrow(/compromised, superseded, ceased/);
    for (const bad of [
      "ali@ornek.com tarafından",
      "tel 0532 123 45 67",
      "TCKN 12345678901",
      "bkz. https://x.y",
      "Ayşe Yılmaz istedi",
    ])
      expect(() => revokeWrprc(a.state, "p", "other", t0, bad), bad).toThrow(/wrprc-revoke:/);
    expect(revocationNoteProblems("x".repeat(121))).not.toEqual([]);
    expect(revocationNoteProblems("kurum isteği, anahtar değişimi")).toEqual([]);
    expect(revokeWrprc(a.state, "p", "compromised", t0).entry.reason).toBe("manual: compromised");
  });

  it("adres değişimi: iptaller ve engeller yeni listeye İPTAL olarak taşınır; eski liste sertifikaları bitene kadar kalır", () => {
    const NEW = "https://trust.sandbox.tamga.network/status/wrprc/2";
    const a = assignWrprcStatus(emptyState(URI), [item("p", {}, 2_000_000_000), item("q"), item("r")], t0);
    const b = assignWrprcStatus(a.state, [item("p", {}, 2_000_000_000), item("r")], t0); // q kalktı → iptal
    const c = revokeWrprc(b.state, "r", "policy_violation", t0).state; // r elle iptal + engel
    const m = migrateWrprcState(c, NEW, t0);
    expect(m.list_uri).toBe(NEW);
    expect(m.entries.every((e) => e.status === "REVOKED")).toBe(true);
    expect(m.entries.map((e) => e.path).sort()).toEqual(["q", "r"]);
    expect(m.entries.every((e) => /^migrated from /.test(e.reason ?? ""))).toBe(true);
    expect(m.blocked.map((x) => x.path)).toEqual(["r"]);
    expect(m.previous?.map((l) => l.list_uri)).toEqual([URI]);
    // yeni listede p yeni indeksle verilir; r hâlâ engelli
    const d = assignWrprcStatus(m, [item("p", {}, 2_000_000_000), item("r")], t0);
    expect(d.idxOf.has("p")).toBe(true);
    expect(d.blocked).toEqual(["r"]);
    // elle iptal eski listedeki aynı yolu da iptal eder
    const e = revokeWrprc(d.state, "p", "compromised", t0).state;
    expect(e.previous![0].entries.find((x) => x.path === "p")?.status).toBe("REVOKED");
    // eski liste: son sertifika bitene kadar kalır, sonra bırakılır
    expect(pruneRetiredLists(e, new Date("2030-01-01T00:00:00Z")).state.previous).toHaveLength(1);
    const gone = pruneRetiredLists(e, new Date("2034-01-01T00:00:00Z"));
    expect(gone.dropped).toEqual([URI]);
    expect(gone.state.previous).toBeUndefined();
  });

  it("kayıp durum yeniden kurulur: yayımlanmış bitler (iptal) + yayımlanmış sertifikalar (geçerli); iptal indeksi geri gelmez", () => {
    const a = assignWrprcStatus(emptyState(URI), [item("p"), item("q")], t0);
    const b = assignWrprcStatus(a.state, [item("q")], t0); // p iptal
    const bits = statusBits(b.state);
    const qIdx = b.idxOf.get("q")!;
    const pIdx = a.idxOf.get("p")!;
    const qPayload = { ...item("q").payload, status: { status_list: { idx: qIdx, uri: URI } } };
    const r = recoverWrprcState(URI, bits, [{ path: "q", payload: qPayload }], t0);
    expect(r.entries.find((e) => e.idx === pIdx)).toMatchObject({ status: "REVOKED", path: "(recovered)" });
    expect(r.entries.find((e) => e.idx === qIdx)).toMatchObject({ status: "VALID", path: "q" });
    // yeniden kurulan durumla yeniden yayın: q aynı indeksi korur, p'nin biti 1 kalır
    const c = assignWrprcStatus(r, [item("q")], t0);
    expect(c.idxOf.get("q")).toBe(qIdx);
    expect(statusBits(c.state).get(pIdx)).toBe(1);
  });

  it("bit dizisi: iptal = 1, geçerli = 0", () => {
    const a = assignWrprcStatus(emptyState(URI), [item("p"), item("q")], t0);
    const b = assignWrprcStatus(a.state, [item("q")], t0);
    const bits = statusBits(b.state);
    expect(bits.get(a.idxOf.get("p")!)).toBe(1);
    expect(bits.get(a.idxOf.get("q")!)).toBe(0);
  });

  it("içerik özeti iat/exp/status'u saymaz, politika alanlarını sayar", () => {
    const p = { name: "x", iat: 1, exp: 2, status: { status_list: { idx: 1, uri: URI } } };
    expect(contentDigest(p)).toBe(contentDigest({ name: "x", iat: 5, exp: 9 }));
    expect(contentDigest({ name: "x", policy_id: ["2.25.1"] })).not.toBe(contentDigest({ name: "x" }));
  });
});

describe("ADR-0068 ayar denetimi", () => {
  const ok = {
    policy_id: ["2.25.12345"],
    certificate_policy: "https://arf.tamga.network/policies/x",
    status_list_uri: URI,
  };
  it("geçerli ayar", () => expect(wrprcConfigProblems(ok, BASE)).toEqual([]));
  it("ETSI'nin AB OID'i, geçersiz OID, http adres, başka köken, yanlış yol reddedilir", () => {
    expect(wrprcConfigProblems({ ...ok, policy_id: [ETSI_EU_WRPRC_POLICY_OID] }, BASE).join()).toMatch(/AB kayıt/);
    expect(wrprcConfigProblems({ ...ok, policy_id: ["2.25.01"] }, BASE).join()).toMatch(/geçersiz OID/);
    expect(wrprcConfigProblems({ ...ok, certificate_policy: "http://x" }, BASE).join()).toMatch(/https/);
    expect(wrprcConfigProblems({ ...ok, status_list_uri: "https://evil.example/status/a" }, BASE).join()).toMatch(
      /kökünde/,
    );
    expect(wrprcConfigProblems({ ...ok, status_list_uri: `${BASE}/wrprc/1` }, BASE).join()).toMatch(/\/status\//);
  });
});

const ROOT = resolve(import.meta.dirname, "../../..");
const APP = resolve(ROOT, "apps/trust-publisher");
const CLI = resolve(APP, "src/cli.ts");
const TSX = resolve(ROOT, "node_modules/tsx/dist/cli.mjs");
const SB_PKI = resolve(ROOT, "ops/pki-sandbox");
const ready =
  existsSync(resolve(SB_PKI, "registrar-1.pkcs8.pem")) && existsSync(resolve(ROOT, "packages/schemas/dist/index.json"));

describe.skipIf(!ready)("ADR-0068 uçtan uca (sandbox kayıt defteri)", () => {
  const tmp = mkdtempSync(join(tmpdir(), "tamga-wrprc-status-"));
  const REG = join(tmp, "registry");
  const DIST = join(tmp, "dist");
  const run = (...args: string[]) => {
    const r = spawnSync(process.execPath, [TSX, CLI, ...args], {
      cwd: ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        TAMGA_NETWORK: "sandbox",
        TAMGA_TP_REGISTRY: REG,
        TAMGA_TP_DIST: DIST,
        TAMGA_TP_PKI: SB_PKI,
      },
      timeout: 60_000,
    });
    if (r.status !== 0) throw new Error(r.stderr || r.stdout);
    return r.stdout;
  };
  const payload = (p: string) =>
    JSON.parse(Buffer.from(readFileSync(join(DIST, p), "utf8").split(".")[1], "base64url").toString());
  const listBits = async () => {
    const tok = readFileSync(join(DIST, "status/wrprc/1"), "utf8");
    const h = decodeProtectedHeader(tok) as { typ: string; x5c: string[] };
    const reg = readFileSync(join(SB_PKI, "registrar-1.cert.pem"), "utf8").replace(/\s+/g, "");
    expect(h.typ).toBe("statuslist+jwt");
    expect(reg).toContain(h.x5c[0].slice(0, 200)); // kayıt kurumu anahtarıyla
    const pem = `-----BEGIN CERTIFICATE-----\n${h.x5c[0]}\n-----END CERTIFICATE-----`;
    const { payload: pl } = await compactVerify(tok, await importX509(pem, "ES256"));
    const p = JSON.parse(new TextDecoder().decode(pl));
    expect(p.sub).toBe(URI);
    expect(p.exp - p.iat).toBe(86400);
    return { p, bits: StatusBitstring.fromLst(p.status_list.lst, 100_000, 1) };
  };

  beforeAll(() => {
    cpSync(resolve(APP, "registry-sandbox"), REG, { recursive: true });
    mkdirSync(DIST);
    run("build");
  }, 120_000);
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it("her kayıt sertifikası policy_id, certificate_policy ve status taşır; LOTL'e ayar girmez", async () => {
    const idx = JSON.parse(readFileSync(join(DIST, "wrprc/index.json"), "utf8")).items as Array<{ path: string }>;
    expect(idx.length).toBeGreaterThan(10);
    const seen = new Set<number>();
    const { bits } = await listBits();
    for (const it of idx) {
      const p = payload(it.path);
      expect(p.policy_id).toEqual(["2.25.220506472418443381081254370400837050484"]);
      expect(p.certificate_policy).toBe("https://arf.tamga.network/policies/registration-certificate");
      expect(p.status.status_list.uri).toBe(URI);
      expect(seen.has(p.status.status_list.idx)).toBe(false);
      seen.add(p.status.status_list.idx);
      expect(bits.get(p.status.status_list.idx)).toBe(0);
    }
    expect(readFileSync(join(DIST, "lotl.json"), "utf8")).not.toMatch(/status_list_uri|certificate_policy/);
  });

  it("yeniden yayın aynı indeksleri korur; elle iptal biti 1 yapar ve sertifika yeniden verilmez; heartbeat yeniden imzalar", async () => {
    const path = "wrprc/issuer/istanbul-bilgi.jwt";
    const idx = payload(path).status.status_list.idx;
    run("build");
    expect(payload(path).status.status_list.idx).toBe(idx);
    expect(() => run("wrprc-revoke", path, "--reason", "test")).toThrow(/compromised/);
    run("wrprc-revoke", path, "--reason", "other", "--note", "test");
    expect((await listBits()).bits.get(idx)).toBe(1);
    run("build");
    expect(existsSync(join(DIST, path))).toBe(false);
    expect(readFileSync(join(DIST, "CHANGELOG.md"), "utf8")).toMatch(
      new RegExp(`idx ${idx} .*REVOKED — manual: other \\(test\\)`),
    );
    const before = (await listBits()).p.iat;
    await new Promise((r) => setTimeout(r, 1100));
    run("heartbeat");
    const after = await listBits();
    expect(after.p.iat).toBeGreaterThan(before);
    expect(after.bits.get(idx)).toBe(1);
    // durum arşivi: her değişiklikte bir kopya
    expect(readdirSync(join(DIST, "archive")).some((f) => /^wrprc-status\..+\.json$/.test(f))).toBe(true);
  }, 180_000);

  it("durum dosyası kaybolursa build boş durumdan BAŞLAMAZ; --reset gerekçeyle yayımlanmış listeden yeniden kurar (iptal korunur)", async () => {
    const path = "wrprc/issuer/istanbul-bilgi.jwt";
    const revokedIdx = JSON.parse(readFileSync(join(DIST, "wrprc-status.json"), "utf8")).entries.find(
      (e: { path: string; status: string }) => e.path === path && e.status === "REVOKED",
    ).idx as number;
    rmSync(join(DIST, "wrprc-status.json"));
    expect(() => run("build")).toThrow(/boş durumdan başlanmaz/);
    expect(() => run("wrprc-status", "--reset")).toThrow(/gerekçe zorunlu/);
    expect(() => run("wrprc-status", "--reset", "--reason", "Ali Veli sildi")).toThrow(/kişi adı/);
    run("wrprc-status", "--reset", "--reason", "durum dosyası diskten silindi");
    expect((await listBits()).bits.get(revokedIdx)).toBe(1);
    expect(readFileSync(join(DIST, "CHANGELOG.md"), "utf8")).toMatch(
      /wrprc-status: RESET — durum dosyası diskten silindi/,
    );
    expect(() => run("wrprc-status", "--reset", "--reason", "ikinci kez")).toThrow(/zaten var/);
    run("build");
    expect((await listBits()).bits.get(revokedIdx)).toBe(1);
  }, 180_000);

  it("imza: belirteç kayıt kurumu sertifikasıyla imzalı (signWrprcStatusList birim)", async () => {
    const st = assignWrprcStatus(emptyState(URI), [item("p")], t0).state;
    let header: Record<string, unknown> = {};
    const tok = await signWrprcStatusList(
      st,
      {
        certDer: new Uint8Array([1, 2, 3]),
        sign: async (payload, h) => {
          header = h;
          return `h.${Buffer.from(payload).toString("base64url")}.s`;
        },
      },
      t0,
      BASE,
    );
    expect(header.typ).toBe("statuslist+jwt");
    expect(header.x5c).toEqual(["AQID"]);
    expect(JSON.parse(Buffer.from(tok.split(".")[1], "base64url").toString()).iss).toBe(BASE);
  });
});
