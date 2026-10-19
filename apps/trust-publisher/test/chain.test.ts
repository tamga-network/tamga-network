/**
 * Zincir projeksiyonu (ADR-0051) — ağsız testler: plan özetleri imzalı dosyadan türetilir (CH2), zincir yalnız özet
 * (ABI'de string/bytes yok), aynı sürüm aynı özet → SKIP, onaylı farklı özet → CONFLICT ve yazma yok (CH1), bekleyen farklı aday →
 * CONTEST ve kendi özetimiz rakip aday (ADR-0053), eski sürüm yazılmaz (CH4),
 * dry-run yazmaz, bayrak kapalıyken hiçbir şey yapılmaz (CH5), doğrulayıcı cevabı üç değerli (K5). Gerçek dist-test seti
 * varsa yükleyici doğrulamasıyla uçtan uca.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Interface } from "ethers";
import { sha256Hex, utf8 } from "@tamga-network/trust";

import { anchorDist, runProjection } from "../src/chain/anchor.js";
import { MemoryChainClient, loadAbi } from "../src/chain/client.js";
import { chainCommand } from "../src/chain/cli.js";
import {
  ZERO32,
  jwsHash,
  listAnchorOf,
  listKeyOf,
  logKeyOf,
  planProjection,
  tagToBytes32,
} from "../src/chain/projection.js";
import { checkListAnchored } from "../src/chain/verify.js";

const ROOT = resolve(import.meta.dirname, "../../..");
const DIST_TEST = resolve(ROOT, "apps/trust-publisher/dist-test");
const ready =
  existsSync(resolve(DIST_TEST, "lotl.jws")) && existsSync(resolve(DIST_TEST, "keys/root-fingerprints.json"));

/** İmzasız ama biçimi doğru JWS (plan imza doğrulamaz; set doğrulaması ayrı adım). */
const fakeJws = (payload: Record<string, unknown>) =>
  `eyJhbGciOiJFUzI1NiJ9.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.c2ln`;
const sha = (s: string) => `sha256:${sha256Hex(utf8(s))}`;

const lotl1 = fakeJws({
  list_type: "lotl",
  version: 1,
  issued_at: "2026-10-17T10:00:00Z",
  previous_version_hash: null,
});
const lotl2 = fakeJws({
  list_type: "lotl",
  version: 2,
  issued_at: "2026-10-18T10:00:00Z",
  previous_version_hash: sha(lotl1),
});
const tlTr1 = fakeJws({ state_code: "TR", version: 1, issued_at: "2026-10-17T10:00:00Z", previous_version_hash: null });
const line0 = fakeJws({ seq: 0, previous_hash: null, ts: "2026-10-17T11:00:00Z", kind: "heartbeat" });
const line1 = fakeJws({ seq: 1, previous_hash: sha(line0), ts: "2026-10-17T12:00:00Z", kind: "heartbeat" });
const set = (lotl = lotl2, anchors = `${line0}\n${line1}\n`) => ({
  environment: "production" as const,
  lotlJws: lotl,
  nationalListJws: { "tl-tr": tlTr1 },
  anchorsJsonl: anchors,
});

describe("chain projeksiyonu — plan (CH2)", () => {
  it("liste özeti = sha256(jws); previous_version_hash → previousHash; sürüm ve issued_at payload'dan", () => {
    const a = listAnchorOf("production", "lotl", lotl2);
    expect(a.contentHash).toBe("0x" + sha256Hex(utf8(lotl2)));
    expect(a.contentHash).toBe(tagToBytes32(sha(lotl2))); // sonraki sürümün previous_version_hash'i ile aynı değer
    expect(a.previousHash).toBe(tagToBytes32(sha(lotl1)));
    expect(a.version).toBe(2);
    expect(a.issuedAt).toBe(Date.parse("2026-10-18T10:00:00Z") / 1000);
    expect(a.listKey).toBe(listKeyOf("production", "lotl"));
    expect(listKeyOf("production", "lotl")).not.toBe(listKeyOf("sandbox", "lotl")); // ortam anahtara girer
  });

  it("plan: lotl + ulusal listeler (sıralı) + günlük başı (son satır); boş günlük → null", () => {
    const p = planProjection(set());
    expect(p.lists.map((l) => l.file)).toEqual(["lotl", "tl-tr"]);
    expect(p.lists[1].previousHash).toBe(ZERO32);
    expect(p.logHead).toEqual({
      logKey: logKeyOf("production"),
      seq: 1,
      lineHash: jwsHash(line1),
      ts: Date.parse("2026-10-17T12:00:00Z") / 1000,
    });
    expect(planProjection(set(lotl2, "")).logHead).toBeNull();
  });

  it("bozuk girdi sessizce geçmez: yanlış özet öneki, sürüm 0, beklenmeyen dosya adı", () => {
    expect(() => tagToBytes32("md5:abc")).toThrow(/özet biçimi/);
    expect(() =>
      listAnchorOf("production", "lotl", fakeJws({ version: 0, issued_at: "2026-01-01T00:00:00Z" })),
    ).toThrow(/sürümü geçersiz/);
    expect(() => planProjection({ ...set(), nationalListJws: { "tl-turkiye": tlTr1 } })).toThrow(/dosya adı/);
  });

  it("plan yalnız özet taşır — hiçbir alan liste içeriğinden gelmez", () => {
    const p = planProjection(set());
    for (const l of p.lists) {
      expect(Object.keys(l).sort()).toEqual(["contentHash", "file", "issuedAt", "listKey", "previousHash", "version"]);
      expect(l.contentHash).toMatch(/^0x[0-9a-f]{64}$/);
    }
  });
});

describe("chain projeksiyonu — kararlar (CH1, CH4) ve dry-run", () => {
  it("boş zincir: her şey ANCHOR; dry-run yazmaz, gerçek koşu yazar ve idempotent ikinci koşu SKIP", async () => {
    const plan = planProjection(set());
    const dry = new MemoryChainClient(1);
    const r0 = await runProjection(dry, plan, { dryRun: true, verified: false });
    expect(r0.decisions.map((d) => d.decision)).toEqual(["ANCHOR", "ANCHOR", "ANCHOR"]);
    expect(r0.written).toBe(0);
    expect(dry.writes).toHaveLength(0);

    const c = new MemoryChainClient(1);
    const r1 = await runProjection(c, plan, { dryRun: false, verified: false });
    expect(r1.written).toBe(3);
    expect(c.writes.filter((w) => w.kind === "list")).toHaveLength(2);
    const r2 = await runProjection(c, plan, { dryRun: false, verified: false });
    expect(r2.decisions.map((d) => d.decision)).toEqual(["SKIP", "SKIP", "SKIP"]);
    expect(r2.written).toBe(0);
  });

  it("CH1: zincirde aynı sürüm için onaylı FARKLI özet → CONFLICT, yazma yok, imzalı liste geçerli", async () => {
    const plan = planProjection(set());
    const c = new MemoryChainClient(1);
    c.seedList(listKeyOf("production", "lotl"), {
      version: 2,
      contentHash: jwsHash(lotl1),
      previousHash: ZERO32,
      issuedAt: 1,
    });
    const r = await runProjection(c, plan, { dryRun: false, verified: false });
    const lotl = r.decisions.find((d) => d.kind === "list" && d.file === "lotl")!;
    expect(lotl.decision).toBe("CONFLICT");
    expect(r.conflicts).toBe(1);
    expect(
      c.writes.some(
        (w) =>
          w.kind === "list" && w.file === undefined && w.version === 2 && w.listKey === listKeyOf("production", "lotl"),
      ),
    ).toBe(false);
    // diğerleri etkilenmez
    expect(r.decisions.find((d) => d.kind === "list" && d.file === "tl-tr")!.decision).toBe("ANCHOR");
  });

  it("CH4: zincirdeki onaylı sürümden eski bir sürüm STALE — geçmiş yeniden yazılmaz", async () => {
    const plan = planProjection(set(lotl1)); // yerelde v1
    const c = new MemoryChainClient(1);
    c.seedList(listKeyOf("production", "lotl"), {
      version: 2,
      contentHash: jwsHash(lotl2),
      previousHash: jwsHash(lotl1),
      issuedAt: 2,
    });
    const r = await runProjection(c, plan, { dryRun: false, verified: false });
    expect(r.decisions.find((d) => d.kind === "list" && d.file === "lotl")!.decision).toBe("STALE");
    expect(c.writes.filter((w) => w.kind === "list")).toHaveLength(1); // yalnız tl-tr
  });

  it("CH3: eşik 2'de tek yazıcının yazımı onaysız kalır; ikinci koşu (ikinci yazıcı) onaylar", async () => {
    const plan = planProjection(set());
    const c = new MemoryChainClient(2);
    await runProjection(c, plan, { dryRun: false, verified: false });
    expect(await c.isListAnchored(listKeyOf("production", "lotl"), 2, jwsHash(lotl2))).toBe(false);
    const r2 = await runProjection(c, plan, { dryRun: false, verified: false }); // ikinci yazıcı gibi
    expect(r2.decisions[0].decision).toBe("ANCHOR");
    expect(r2.decisions[0].reason).toMatch(/bekleyen/);
    expect(await c.isListAnchored(listKeyOf("production", "lotl"), 2, jwsHash(lotl2))).toBe(true);
  });

  it("ADR-0053: zincirde bekleyen FARKLI aday → CONTEST; kendi özetimiz rakip aday olarak gönderilir ve eşiği doldurunca kazanır", async () => {
    const plan = planProjection(set());
    const c = new MemoryChainClient(2);
    const key = listKeyOf("production", "lotl");
    // başka (hatalı ya da kötü niyetli) bir yazıcı sürüm 2'yi yanlış özetle açmış
    await c.anchorList({ listKey: key, version: 2, contentHash: jwsHash(lotl1), previousHash: ZERO32, issuedAt: 1 });
    const r = await runProjection(c, plan, { dryRun: false, verified: false });
    const lotl = r.decisions.find((d) => d.kind === "list" && d.file === "lotl")!;
    expect(lotl.decision).toBe("CONTEST");
    expect(lotl.tx).toBeDefined();
    expect(r.contested).toBe(1);
    expect(r.conflicts).toBe(0);
    expect(c.candidateCount(key, 2)).toBe(2);
    expect(await c.isListAnchored(key, 2, jwsHash(lotl2))).toBe(false); // eşik 2, tek destek
    // ikinci bağımsız yazıcı aynı doğru özeti gönderir → doğru aday onaylanır
    const r2 = await runProjection(c, plan, { dryRun: false, verified: false });
    expect(r2.decisions.find((d) => d.kind === "list" && d.file === "lotl")!.decision).toBe("CONTEST");
    expect(await c.isListAnchored(key, 2, jwsHash(lotl2))).toBe(true);
    expect(await c.isListAnchored(key, 2, jwsHash(lotl1))).toBe(false);
    // onaydan sonra: aynı özet SKIP
    const r3 = await runProjection(c, plan, { dryRun: true, verified: false });
    expect(r3.decisions.find((d) => d.kind === "list" && d.file === "lotl")!.decision).toBe("SKIP");
  });

  it("günlük başı: onaylı farklı özet CONFLICT; ileri seq zincirdeyse STALE", async () => {
    const c = new MemoryChainClient(1);
    c.seedLog(logKeyOf("production"), 1, jwsHash(line0), 5); // seq 1 için yanlış özet
    const r = await runProjection(c, planProjection(set()), { dryRun: false, verified: false });
    expect(r.decisions.find((d) => d.kind === "log")!.decision).toBe("CONFLICT");
    const c2 = new MemoryChainClient(1);
    c2.seedLog(logKeyOf("production"), 9, jwsHash(line1), 9);
    const r2 = await runProjection(c2, planProjection(set()), { dryRun: false, verified: false });
    expect(r2.decisions.find((d) => d.kind === "log")!.decision).toBe("STALE");
  });
});

describe("chain-check — doğrulayıcı tarafı (K5)", () => {
  it("UNKNOWN: istemci yok (bayrak kapalı) / çapa yok / onaysız; YES: aynı özet; NO: farklı özet", async () => {
    expect((await checkListAnchored(null, "production", "lotl", lotl2)).anchored).toBe("UNKNOWN");
    const c = new MemoryChainClient(2);
    expect((await checkListAnchored(c, "production", "lotl", lotl2)).anchored).toBe("UNKNOWN");
    await c.anchorList({ ...listAnchorOf("production", "lotl", lotl2) });
    const pending = await checkListAnchored(c, "production", "lotl", lotl2);
    expect(pending.anchored).toBe("UNKNOWN");
    expect(pending.reason).toMatch(/eşiği/);
    await c.anchorList({ ...listAnchorOf("production", "lotl", lotl2) });
    expect((await checkListAnchored(c, "production", "lotl", lotl2)).anchored).toBe("YES");
    const c3 = new MemoryChainClient(1);
    c3.seedList(listKeyOf("production", "lotl"), {
      version: 2,
      contentHash: jwsHash(lotl1),
      previousHash: ZERO32,
      issuedAt: 1,
    });
    const no = await checkListAnchored(c3, "production", "lotl", lotl2);
    expect(no.anchored).toBe("NO");
    expect(no.chain?.contentHash).toBe(jwsHash(lotl1));
  });

  it("zincir erişilemezse UNKNOWN (hata fırlatmaz, sonucu kötüleştirmez)", async () => {
    const broken = new MemoryChainClient(1);
    broken.listAnchor = async () => {
      throw new Error("ECONNREFUSED");
    };
    const r = await checkListAnchored(broken, "production", "lotl", lotl2);
    expect(r.anchored).toBe("UNKNOWN");
    expect(r.reason).toMatch(/erişilemedi/);
  });
});

describe("CH5 — bayrak ve ABI", () => {
  it("TAMGA_CHAIN_ENABLED yokken chain-submit hiçbir şey yapmaz (çıkış 0, 'disabled'); açıkken eksik ayar hata", async () => {
    const logs: string[] = [];
    const orig = console.log;
    console.log = (s: string) => void logs.push(String(s));
    try {
      const code = await chainCommand("chain-submit", [], { dist: DIST_TEST, environment: "production", env: {} });
      expect(code).toBe(0);
      expect(logs.join("\n")).toMatch(/"disabled"/);
    } finally {
      console.log = orig;
    }
    await expect(
      chainCommand("chain-submit", [], {
        dist: DIST_TEST,
        environment: "production",
        env: { TAMGA_CHAIN_ENABLED: "1" },
      }),
    ).rejects.toThrow(/TAMGA_CHAIN_RPC_URL/);
  });

  it("ABI kopyası (contracts/scripts/export-abi.mjs): yazma fonksiyonları yalnız bytes32/uintN; string ve bytes alanı yok (DP1)", () => {
    const iface = new Interface(loadAbi());
    const names = iface.fragments.filter((f) => f.type === "function").map((f: any) => f.name);
    for (const n of [
      "anchorList",
      "anchorLogHead",
      "isListAnchored",
      "latestListVersion",
      "listAnchor",
      "isLogLineAnchored",
    ])
      expect(names).toContain(n);
    expect(names.some((n: string) => /revoked|credential|holder/i.test(n))).toBe(false);
    const walk = (ps: readonly any[]): string[] => ps.flatMap((p) => (p.components ? walk(p.components) : [p.type]));
    for (const f of iface.fragments) {
      if (f.type !== "function" || (f as any).name === "upgradeToAndCall") continue;
      for (const t of walk((f as any).inputs))
        expect(t, `${(f as any).name}: ${t}`).toMatch(/^(bytes32|uint8|uint64|address|bool|address\[\])$/);
    }
  });
});

describe.skipIf(!ready)("chain projeksiyonu — gerçek test seti (dist-test) ile uçtan uca", () => {
  it("set yükleyiciyle doğrulanır, dry-run planı sağlıklı; gerçek koşu bellek içi zincire yazar, ikinci koşu SKIP", async () => {
    const c = new MemoryChainClient(1);
    // test seti eski olabilir (fixture); saat = lotl issued_at + 1 dk (tazelik kuralı o güne göre). Gerçek koşu kendi saatini kullanır.
    const issuedAt = JSON.parse(
      Buffer.from(readFileSync(resolve(DIST_TEST, "lotl.jws"), "utf8").split(".")[1], "base64url").toString(),
    ).issued_at as string;
    const clock = { now: new Date(Date.parse(issuedAt) + 60_000), anchorMaxAgeMs: 365 * 86_400_000 };
    const dry = await anchorDist(c, DIST_TEST, "production", { dryRun: true, clock });
    expect(dry.verified).toBe(true);
    expect(dry.written).toBe(0);
    expect(dry.decisions.filter((d) => d.kind === "list").map((d: any) => d.file)).toContain("lotl");
    const run = await anchorDist(c, DIST_TEST, "production", { dryRun: false, clock });
    expect(run.written).toBe(run.decisions.length);
    const lotlJws = readFileSync(resolve(DIST_TEST, "lotl.jws"), "utf8");
    expect((await checkListAnchored(c, "production", "lotl", lotlJws)).anchored).toBe("YES");
    const again = await anchorDist(c, DIST_TEST, "production", { dryRun: false, clock });
    expect(again.written).toBe(0);
  });
});
