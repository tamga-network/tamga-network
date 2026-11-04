/**
 * `trust:chain-replay` planı (ADR-0073 K1): arşiv doğrulanır (imza, sürüm zinciri, çapa zinciri), plan deterministiktir (aynı
 * arşiv → aynı `replayPlanHash`), tarih taşıyan yazımlar listedeki anı açıkça alır, ağ düzeyi kayıtlar yürütücüyle, ağ şemasının
 * iptali ve doğrulayıcı devri / yeniden kaydı Governance oyuyla planlanır; kişisel veri ve serbest metin plana girmez (PJ2).
 */
import { beforeAll, describe, expect, it } from "vitest";

import { keccakText } from "../src/ids.js";
import { buildReplayPlan, statusListUrisMissingParams, type ReplayPlan } from "../src/replay-plan.js";
import { verifyArchive } from "../src/replay-archive.js";
import { buildFixture, type Fixture } from "./fixture.js";

let f: Fixture;
let plan: ReplayPlan;
beforeAll(async () => {
  f = await buildFixture();
  plan = buildReplayPlan(f.archive);
});

describe("ADR-0073 K1 — yeniden oynatma planı", () => {
  it("arşiv doğrulanır; kurcalanmış sürüm ya da kırık zincir reddedilir", async () => {
    await expect(verifyArchive(f.archive)).resolves.toMatchObject({ lotl: 4, national: { "tl-tr": 7, "tl-kz": 3 } });
    const lotl = [...f.archive.lotl];
    lotl.splice(1, 1); // sürüm boşluğu
    await expect(verifyArchive({ ...f.archive, lotl })).rejects.toThrow(/sürüm boşluğu|zincirli değil/);
    const [h, p, s] = f.archive.national["tl-tr"][2].split(".");
    const bad = [
      h,
      Buffer.from(Buffer.from(p, "base64url").toString().replace("uni-one", "uni-0ne")).toString("base64url"),
      s,
    ].join(".");
    const tr = [...f.archive.national["tl-tr"]];
    tr[2] = bad;
    await expect(verifyArchive({ ...f.archive, national: { ...f.archive.national, "tl-tr": tr } })).rejects.toThrow();
    await expect(verifyArchive({ ...f.archive, environment: "sandbox" })).rejects.toThrow(/ortamı/);
  });

  it("deterministik: aynı arşiv aynı plan özeti; işlemler zaman sırasında", async () => {
    expect(buildReplayPlan(f.archive).hash).toBe(plan.hash);
    expect(plan.hash).toMatch(/^0x[0-9a-f]{64}$/);
    for (let k = 1; k < plan.ops.length; k++) expect(plan.ops[k].at).toBeGreaterThanOrEqual(plan.ops[k - 1].at);
    expect(plan.ops.every((o) => o.at <= plan.planTime)).toBe(true);
    expect(plan.warnings.filter((w) => !/bit sayısı/.test(w))).toEqual([]);
  });

  it("eşleme: askı, yumuşak ve sert iptal, kök emekliliği, şema sürümü, yetki pencereleri, devir ve yeniden kayıt", () => {
    const by = (op: string) => plan.ops.filter((o) => o.op === op);
    expect(by("issuerStatus").map((o) => (o as { status: string }).status)).toEqual(
      expect.arrayContaining(["SUSPENDED", "ACTIVE", "REVOKED", "RETIRED"]),
    );
    expect(by("issuerInvalidatesFrom")).toHaveLength(1);
    expect(by("rootCARollover")).toHaveLength(1);
    expect(by("rootCAStatus").map((o) => (o as { status: string }).status)).toEqual(["RETIRED"]);
    expect(by("addSchemaHash")).toHaveLength(1);
    const st = by("schemaStatus") as Array<{ status: string; who: { role: string } }>;
    expect(st.find((o) => o.status === "REVOKED")?.who.role).toBe("governance"); // ağ şeması: yalnız Governance
    expect(st.find((o) => o.status === "DEPRECATED")?.who.role).toBe("executor");
    const auth = by("schemaAuth") as Array<{ allowed: boolean; at: number }>;
    expect(auth.filter((a) => !a.allowed)).toHaveLength(1);
    const periods = by("rpPeriod") as Array<{ action: string; fromState: string; toState: string }>;
    expect(periods.map((p) => `${p.action}:${p.fromState}->${p.toState}`).sort()).toEqual([
      "REASSIGNMENT:TR->KZ",
      "RE_REGISTRATION:TR->TR",
    ]);
    expect(by("rpCert")).toHaveLength(1);
    expect(by("registerList")).toHaveLength(3);
    expect(by("publishList")).toHaveLength(6);
    expect(by("networkRecord").length).toBeGreaterThanOrEqual(3);
    // tarih taşıyan yazım listedeki anı alır: askı d(60)
    const susp = by("issuerStatus").find((o) => (o as { status: string }).status === "SUSPENDED")!;
    expect(susp.at).toBe(f.base + 60 * 86400);
  });

  it("doğrulayıcı durumu listedeki anla (geçmiş tarihli askı, dönüş, iptal); devirde eski listedeki REVOKED yazılmaz", () => {
    const st = plan.ops.filter((o) => o.op === "rpStatus") as Array<{
      status: string;
      at: number;
      who: { state?: string };
    }>;
    const D = (n: number) => f.base + n * 86400;
    // pause.example.tr: askı d(30), dönüş d(33), iptal d(91); shop: askı d(65), dönüş d(74); gone: iptal d(40)
    expect(st.map((o) => `${o.status}@${(o.at - f.base) / 86400}`).sort()).toEqual(
      ["SUSPENDED@30", "ACTIVE@33", "REVOKED@91", "SUSPENDED@65", "ACTIVE@74", "REVOKED@40"].sort(),
    );
    expect(st.every((o) => o.at <= D(100))).toBe(true);
  });

  it("kurum halefi iptal yazımıyla; iptal listesinin bit sayısı ve boyutu satırdan, yoksa belirteçten, yoksa varsayılan", () => {
    const retired = plan.ops.find((o) => o.op === "issuerStatus" && o.status === "RETIRED") as { successor?: string };
    expect(retired.successor).toMatch(/^0x[0-9a-f]{64}$/);
    const lists = plan.ops.filter((o) => o.op === "registerList") as Array<{
      listUri: string;
      bits: number;
      size: number;
      params: string;
    }>;
    const by = (n: string) => lists.find((l) => l.listUri.endsWith(n))!;
    expect(by("a1f0")).toMatchObject({ bits: 2, size: 131_072, params: "anchor" });
    expect(by("c3d0")).toMatchObject({ bits: 1, size: 262_144, params: "anchor" });
    expect(by("b2e0")).toMatchObject({ bits: 2, size: 100_000, params: "default" });
    expect(plan.warnings.filter((w) => /bit sayısı/.test(w))).toHaveLength(1);
    expect(statusListUrisMissingParams(f.archive)).toEqual([by("b2e0").listUri]);
    const viaToken = buildReplayPlan(f.archive, {
      statusListParams: (u) => (u === by("b2e0").listUri ? { bits: 4, size: 120_000 } : null),
    });
    expect(viaToken.ops.find((o) => o.op === "registerList" && o.listUri.endsWith("b2e0"))).toMatchObject({
      bits: 4,
      size: 120_000,
      params: "token",
    });
    expect(viaToken.hash).not.toBe(plan.hash);
  });

  it("ADR-0074 K3: NetworkRegistry'nin bütün kayıt türleri yürütücüyle; listeden kalkan kayıt RETIRED", () => {
    const recs = plan.ops.filter((o) => o.op === "networkRecord") as Array<{
      who: { role: string };
      record: { kind: number; status: number; recordId: string };
    }>;
    expect(recs.every((o) => o.who.role === "executor")).toBe(true);
    const kinds = new Set(recs.map((o) => o.record.kind));
    for (const k of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) expect(kinds.has(k), `tür ${k}`).toBe(true);
    // eaa kategorisi "legacy" d(75)'te listeden kalkar → RETIRED yazılır
    const legacy = recs.filter((o) => o.record.kind === 5 && o.record.recordId === keccakText("urn:tamga:eaa:legacy"));
    expect(legacy.map((o) => o.record.status)).toEqual([1, 4]);
    // rol slotu ülkeye özgü kimlikle (aynı rol her ülkede); üst kayıt devlet slotu, ondan sonra yazılır
    const roleIdx = plan.ops.findIndex((o) => o.op === "networkRecord" && o.record.kind === 9);
    const slotIdx = plan.ops.findIndex((o) => o.op === "networkRecord" && o.record.kind === 8);
    expect(slotIdx).toBeLessThan(roleIdx);
  });

  it("PJ2: planda ad, alan adı ya da gerekçe metni yok (yalnız özet)", () => {
    const text = JSON.stringify(plan.ops);
    for (const s of [
      "Example",
      "verify.example.tr",
      "key compromise",
      "audit",
      "Purpose of",
      "degree",
      "free text",
      "lists.example",
      "approval-external-1",
      "Legacy category",
    ])
      expect(text, s).not.toContain(s);
  });
});

describe("trust:chain-replay komutu (ağsız)", () => {
  it("bayrak kapalıyken ya da --dry-run ile yalnız plan ve özet basar; bağlantı kurmaz", async () => {
    const { mkdtempSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { writeFixtureDist } = await import("./fixture.js");
    const { chainReplayCommand } = await import("../../trust-publisher/src/chain/replay-cli.js");
    const dist = mkdtempSync(join(tmpdir(), "tamga-replay-"));
    try {
      writeFixtureDist(f, dist);
      const out: string[] = [];
      const log = console.log;
      console.log = (s: string) => out.push(s);
      try {
        const code = await chainReplayCommand([], {
          dist,
          environment: "production",
          env: {},
          fetchText: () => Promise.reject(new Error("ağ yok")),
        });
        expect(code).toBe(0);
      } finally {
        console.log = log;
      }
      const r = JSON.parse(out.join("\n"));
      expect(r.dryRun).toBe(true);
      expect(r.replayPlanHash).toBe(plan.hash);
      expect(r.archive).toMatchObject({ lotl: 4 });
      // sandbox ortamı bekleyen komut gerçek ağ arşivini reddeder (SB2)
      await expect(chainReplayCommand([], { dist, environment: "sandbox", env: {} })).rejects.toThrow(/ortamı/);
    } finally {
      rmSync(dist, { recursive: true, force: true });
    }
  });
});
