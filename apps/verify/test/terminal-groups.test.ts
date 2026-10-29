/**
 * ADR-0069 — kapı gruplarının kurumu imzalı listeden (`terminal_groups[]`) ve kuruma daraltılmış terminal anahtarı yönetimi:
 *  TG2 kurum belirteci yalnız kendi gruplarının anahtarlarını görür / verir / iptal eder; başka kurumun anahtarı 404
 *  TG3 listede geri çekilmiş grubun ya da başka kuruma geçmiş grubun anahtarı kapıda geçmez; izinli politika yoksa anahtar verilmez
 *  ADR-0065 korunur: listede olmayan grup için işletmeci anahtar verir; ortam anahtarları çalışır
 */
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildVerifyApp } from "../src/app.js";
import type { VerifyConfig } from "../src/config.js";
import { institutionToken, TerminalKeyRegistry } from "../src/terminal-keys.js";
import { passPolicyGate } from "../src/routes/terminal.js";

const ROOT = resolve(import.meta.dirname, "../../..");
const PKI = resolve(ROOT, "ops/pki");
const DIST = resolve(ROOT, "apps/trust-publisher/dist-test"); // test listesi: bilgi-campus (bilgi), bubilet-gate (bubilet)
const ready = existsSync(resolve(PKI, "rp-verify.pkcs8.pem")) && existsSync(resolve(DIST, "lotl.jws"));
const ADMIN = "tg-admin-token";

describe("ADR-0069 kurum belirteci (birim)", () => {
  it("kurum belirteci yönetici belirtecinden türetilir; kuruma ve belirtece bağlı", () => {
    const a = institutionToken(ADMIN, "bubilet");
    expect(a).toBe(institutionToken(ADMIN, "bubilet"));
    expect(a).not.toBe(institutionToken(ADMIN, "bilgi"));
    expect(a).not.toBe(institutionToken("baska", "bubilet"));
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
  it("anahtar kaydı kurumu ve son kullanımı taşır; özet dışarı çıkmaz", () => {
    const reg = new TerminalKeyRegistry(null);
    const k = reg.issue("bubilet-gate", "kapı", 100, "bubilet");
    expect(reg.authenticate(`Bearer ${k.key}`, 200)).toEqual({
      id: k.id,
      terminalGroup: "bubilet-gate",
      owner: "bubilet",
    });
    const info = reg.get(k.id)!;
    expect(info).toMatchObject({ owner: "bubilet", lastUsedAt: 200, createdAt: 100, source: "issued" });
    expect(JSON.stringify(info)).not.toContain("hash");
    expect(reg.get("yok")).toBeNull();
  });
  it("kapalı kalma: listede görülen grup iz bırakır (dosyada kalır); listesizken verilen sahipsiz anahtar kuruma bağlanır", () => {
    const file = join(tmpdir(), `tamga-tk-${process.pid}-${Date.now()}.json`);
    const reg = new TerminalKeyRegistry(file, "g-env:env-key-00001");
    const a = reg.issue("g1", "önce", 100);
    const b = reg.issue("g1", "iptal", 100);
    reg.revoke(b.id, 101);
    expect(reg.wasListed("g1")).toBe(false);
    reg.markListed("g1");
    expect(reg.adoptOwner("g1", "kurum-a")).toBe(1); // iptal edilmiş kayıt bağlanmaz
    expect(reg.adoptOwner("g1", "kurum-b")).toBe(0); // sahibi olan değişmez
    expect(reg.adoptOwner("g-env", "kurum-a")).toBe(0); // ortam anahtarı dosyada değil, değişmez
    const again = new TerminalKeyRegistry(file);
    expect(again.wasListed("g1")).toBe(true);
    expect(again.get(a.id)?.owner).toBe("kurum-a");
    expect(again.get(b.id)?.owner).toBeUndefined();
  });
  it("TG3 kapıda politika: izinli politika denetimi; kimliksiz eski kart yalnız gruba bağlı bütün politikalar izinliyse", () => {
    const pols = [
      { policy_id: "p1", proximity: { terminal_group: "g" } },
      { policy_id: "p2", proximity: { terminal_group: "g" } },
      { policy_id: "p3" },
    ];
    expect(passPolicyGate(pols, "g", undefined)).toBeUndefined();
    const only1 = passPolicyGate(pols, "g", ["p1"])!;
    expect([only1("p1"), only1("p2"), only1(undefined)]).toEqual([true, false, false]);
    const both = passPolicyGate(pols, "g", ["p1", "p2"])!;
    expect([both("p2"), both("p3"), both(undefined)]).toEqual([true, false, true]);
    expect(passPolicyGate(pols, "baska", ["p1"])!(undefined)).toBe(false);
  });
});

describe.skipIf(!ready)("ADR-0069 kapı grupları — Tamga Verify", () => {
  const cfg: VerifyConfig = {
    publicBase: "http://verify.local",
    port: 0,
    clientId: "",
    pkiDir: PKI,
    trustDist: DIST,
    stateCode: "TR",
    trustReloadSec: 60,
    statusPrefetchSec: 60,
    dataDir: join(tmpdir(), "tamga-verify-tg-" + process.pid),
    requireRpAuth: false,
    terminalKeys: "bubilet-gate:test-gate-key-0001",
  };
  let app: Awaited<ReturnType<typeof buildVerifyApp>>;
  const before = process.env.TAMGA_ADMIN_TOKEN;
  beforeAll(async () => {
    process.env.TAMGA_ADMIN_TOKEN = ADMIN;
    app = await buildVerifyApp(cfg, { showcase: true, fetchText: async () => null });
  });
  afterAll(() => {
    if (before === undefined) delete process.env.TAMGA_ADMIN_TOKEN;
    else process.env.TAMGA_ADMIN_TOKEN = before;
  });
  const inst = (id: string, token = institutionToken(ADMIN, id)) => ({
    "x-tamga-institution": id,
    "x-institution-token": token,
  });
  const operator = { "x-admin-token": ADMIN };
  const keys = async (headers: Record<string, string>) => app.inject({ method: "GET", url: "/terminal/keys", headers });
  const issue = (headers: Record<string, string>, terminal_group: string, label?: string) =>
    app.inject({ method: "POST", url: "/terminal/keys", headers, payload: { terminal_group, label } });
  const gate = (key: string) =>
    app.inject({
      method: "POST",
      url: "/terminal/verify",
      headers: { authorization: `Bearer ${key}` },
      payload: { token: "bozuk" },
    });

  it("liste okuması: grup kurumu ve politikası imzalı listeden", () => {
    const g = app.trust().terminalGroup?.("bubilet-gate");
    expect(g).toMatchObject({ active: true, rp_dns_name: "verify.tamga.network" });
    expect(g?.group).toMatchObject({ institution_id: "bubilet", allowed_policies: ["event-ticket"] });
  });

  it("TG2: yanlış ya da başka kurumun belirteci 404; kurum yalnız kendi gruplarını ve anahtarlarını görür", async () => {
    expect((await keys(inst("bubilet", institutionToken("yanlis", "bubilet")))).statusCode).toBe(404);
    expect(
      (await keys({ "x-tamga-institution": "bubilet", "x-institution-token": institutionToken(ADMIN, "bilgi") }))
        .statusCode,
    ).toBe(404);
    const r = await keys(inst("bubilet"));
    expect(r.statusCode).toBe(200);
    const j = r.json() as { keys: Array<Record<string, unknown>>; groups: Array<Record<string, unknown>> };
    expect(j.groups.map((g) => g.group_id)).toEqual(["bubilet-gate"]);
    expect(j.groups[0]).toMatchObject({ listed: true, active: true, institution_id: "bubilet" });
    // ortam anahtarı da grubun kurumuna görünür (sahibi listeden)
    expect(j.keys.every((k) => k.owner === "bubilet")).toBe(true);
    expect(j.keys.some((k) => k.source === "env")).toBe(true);
    // başka kurum bubilet grubunu da anahtarlarını da görmez
    const other = (await keys(inst("bilgi"))).json() as { keys: unknown[]; groups: unknown[] };
    expect(other.keys).toEqual([]);
    expect(other.groups).toEqual([]);
  });

  it("TG2: kurum kendi grubu için anahtar alır (bir kez), başka grubun / listede olmayan grubun anahtarını alamaz", async () => {
    const made = await issue(inst("bubilet"), "bubilet-gate", "Salon A kapısı");
    expect(made.statusCode).toBe(201);
    const k = made.json() as { id: string; key: string; owner: string };
    expect(k.owner).toBe("bubilet");
    expect(k.key).toMatch(/^tk_/);
    expect((await issue(inst("bilgi"), "bubilet-gate")).statusCode).toBe(403);
    // kampüs grubu bu ağda politikada var ama test listesinde kayıtlı değil → kurum alamaz, işletmeci alır (ADR-0065)
    const campus = app.trust().terminalGroup?.("istanbul-bilgi-campus");
    expect(campus ?? null).toBeNull();
    expect((await issue(inst("bilgi"), "istanbul-bilgi-campus")).statusCode).toBe(403);
    const op = await issue(operator, "istanbul-bilgi-campus", "işletmeci");
    expect(op.statusCode).toBe(201);
    expect(op.json().owner).toBeUndefined();
    // verilen anahtar kapıda çalışır; liste yalnız özetsiz kayıt ve son kullanım
    expect((await gate(k.key)).statusCode).toBe(200);
    const list = (await keys(inst("bubilet"))).json() as { keys: Array<Record<string, unknown>> };
    const mine = list.keys.find((x) => x.id === k.id)!;
    expect(mine).toMatchObject({ label: "Salon A kapısı", owner: "bubilet", source: "issued" });
    expect(typeof mine.lastUsedAt).toBe("number");
    expect(JSON.stringify(list)).not.toContain(k.key);
    // kurum işletmecinin listede olmayan gruba verdiği anahtarı görmez
    expect(list.keys.some((x) => x.id === op.json().id)).toBe(false);
  });

  it("TG2: başka kurum iptal edemez (404, varlığı açığa çıkmaz); sahibi iptal eder → kapıda 401; denetim kaydında anahtar yok", async () => {
    const k = (await issue(inst("bubilet"), "bubilet-gate", "iptal denemesi")).json() as { id: string; key: string };
    const del = (headers: Record<string, string>, id: string) =>
      app.inject({ method: "DELETE", url: `/terminal/keys/${id}`, headers });
    expect((await del(inst("bilgi"), k.id)).statusCode).toBe(404);
    expect((await gate(k.key)).statusCode).toBe(200);
    expect((await del(inst("bubilet"), "env-1")).statusCode).toBe(404); // ortam anahtarı iptal edilemez
    expect((await del(inst("bubilet"), k.id)).json()).toEqual({ ok: true });
    expect((await gate(k.key)).statusCode).toBe(401);
    const audit = (await app.inject({ url: "/audit?n=100", headers: operator })).body;
    expect(audit).toContain("terminal.key_issued");
    expect(audit).toContain("institution:bubilet");
    expect(audit).not.toContain(k.key);
    const file = readFileSync(join(cfg.dataDir, "terminal-keys.json"), "utf8");
    expect(file).not.toContain(k.key);
  });

  it("TG3: listede geri çekilen grup → kapıda 403, yeni anahtar 409; başka kuruma geçen grup → 403; izinli politika yoksa 409", async () => {
    const k = (await issue(inst("bubilet"), "bubilet-gate")).json() as { key: string };
    const ts = app.trust() as unknown as { terminalGroup: (g: string) => unknown };
    const orig = ts.terminalGroup.bind(ts) as (g: string) => {
      group: Record<string, unknown>;
      rp_dns_name: string;
      active: boolean;
    } | null;
    const swap = (f: (a: NonNullable<ReturnType<typeof orig>>) => unknown) => {
      ts.terminalGroup = (g: string) => {
        const a = orig(g);
        return a && g === "bubilet-gate" ? f(a) : a;
      };
    };
    try {
      swap((a) => ({ ...a, active: false }));
      const w = await gate(k.key);
      expect(w.statusCode).toBe(403);
      expect(w.json().reason).toMatch(/not active/);
      expect((await gate("test-gate-key-0001")).statusCode).toBe(403); // ortam anahtarı da
      expect((await issue(operator, "bubilet-gate")).statusCode).toBe(409);
      swap((a) => ({ ...a, group: { ...a.group, institution_id: "baska-kurum" } }));
      expect((await gate(k.key)).statusCode).toBe(403);
      expect((await gate("test-gate-key-0001")).statusCode).toBe(200); // kurumsuz ortam anahtarı: sahibi listeden
      swap((a) => ({ ...a, group: { ...a.group, allowed_policies: ["baska-politika"] } }));
      const np = await issue(inst("bubilet"), "bubilet-gate");
      expect(np.statusCode).toBe(409);
      expect(np.json().error_description).toMatch(/policy/);
    } finally {
      ts.terminalGroup = orig;
    }
    expect((await gate(k.key)).statusCode).toBe(200);
  });
  it("kapalı kalma: liste bayatken sahibi olan anahtar ve listede görülmüş grubun anahtarı 403; hiç listelenmemiş grup ADR-0065", async () => {
    const k = (await issue(inst("bubilet"), "bubilet-gate", "bayat")).json() as { key: string };
    const op = (await issue(operator, "istanbul-bilgi-campus", "listesiz")).json() as { id: string; key: string };
    const ts = app.trust() as unknown as { freshness: () => { healthy: boolean } };
    const orig = ts.freshness.bind(ts);
    ts.freshness = () => ({ ...orig(), healthy: false });
    try {
      const w = await gate(k.key);
      expect(w.statusCode).toBe(403);
      expect(w.json().reason).toMatch(/cannot be confirmed/);
      expect((await gate("test-gate-key-0001")).statusCode).toBe(403); // sahipsiz ortam anahtarı, ama grup listede görülmüştü
      expect((await gate(op.key)).statusCode).toBe(200); // hiç listelenmemiş grup, sahipsiz anahtar: ADR-0065 yolu
      expect((await issue(operator, "bubilet-gate")).statusCode).toBe(409);
      expect((await issue(inst("bubilet"), "bubilet-gate")).statusCode).toBe(409);
    } finally {
      ts.freshness = orig;
    }
    expect((await gate(k.key)).statusCode).toBe(200);
  });

  it("kapalı kalma: sağlıklı listede grup yoksa (listeden çıkmış) 403; listesizken verilen anahtar grup listeye girince kuruma bağlanır", async () => {
    const op = (await issue(operator, "istanbul-bilgi-campus", "sonra listelenecek")).json() as {
      id: string;
      key: string;
    };
    type Ans = { group: Record<string, unknown>; rp_dns_name: string; active: boolean } | null;
    const ts = app.trust() as unknown as { terminalGroup: (g: string) => Ans };
    const orig = ts.terminalGroup.bind(ts);
    const campus = (institution_id: string): Ans => ({
      group: {
        group_id: "istanbul-bilgi-campus",
        institution_id,
        allowed_policies: ["campus-access"],
        valid_from: "2026-01-01T00:00:00Z",
      },
      rp_dns_name: "verify.tamga.network",
      active: true,
    });
    try {
      // grup listeden çıktı (liste sağlıklı)
      ts.terminalGroup = (g) => (g === "bubilet-gate" ? null : orig(g));
      const gone = await gate("test-gate-key-0001");
      expect(gone.statusCode).toBe(403);
      expect(gone.json().reason).toMatch(/not in the trust list/);
      expect((await issue(operator, "bubilet-gate")).statusCode).toBe(409);
      // kampüs grubu listeye kurumla girdi → işletmecinin verdiği sahipsiz anahtar kuruma bağlanır
      ts.terminalGroup = (g) => (g === "istanbul-bilgi-campus" ? campus("bilgi") : orig(g));
      expect((await gate(op.key)).statusCode).toBe(200);
      const seen = (await keys(inst("bilgi"))).json() as { keys: Array<Record<string, unknown>> };
      expect(seen.keys.find((x) => x.id === op.id)).toMatchObject({ owner: "bilgi" });
      // grup başka kuruma geçerse bağlanan anahtar geçmez
      ts.terminalGroup = (g) => (g === "istanbul-bilgi-campus" ? campus("baska-kurum") : orig(g));
      expect((await gate(op.key)).statusCode).toBe(403);
      // ve listeden tamamen çıkarsa da geçmez (sahibi var + grup listede görüldü)
      ts.terminalGroup = (g) => (g === "istanbul-bilgi-campus" ? null : orig(g));
      expect((await gate(op.key)).statusCode).toBe(403);
    } finally {
      ts.terminalGroup = orig;
    }
  });
});
