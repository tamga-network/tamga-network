/**
 * ADR-0067 çekim dalları durum makinesi (`BranchSet`, `BranchRegistry`) — Değişiklik notu 2026-10-29: sabit 429 yerine yumuşak
 * sınırda atma, ortak dal bütçesi, `state` özetiyle arama, çözme öncesi kilit ve çözme sonrası yeniden bakış.
 * Dal üretimi sahte (`mint`): imza yok, hızlı; gerçek `createRequestBranch` `request.test.ts`'te ve uygulama testlerinde.
 */
import { randomBytes } from "node:crypto";
import { describe, it, expect } from "vitest";
import { BranchRegistry, BranchSet, BRANCH_LIMITS, type BranchLimits } from "./branches.js";
import type { KeyLike, RequestBranch, RequestContent } from "./request.js";

const T0 = 1_000_000;

function harness(
  o: { limits?: Partial<BranchLimits>; registry?: BranchRegistry; id?: string; expiresAt?: number } = {},
) {
  let now = T0;
  const minted: RequestBranch[] = [];
  const walletNonces: Array<string | undefined> = [];
  let gate: Promise<void> | undefined;
  const registry = o.registry ?? new BranchRegistry();
  const set = new BranchSet({
    registry,
    presentationId: o.id ?? "prs_test",
    expiresAt: o.expiresAt ?? T0 + 300,
    content: {} as RequestContent,
    limits: o.limits,
    clock: () => now,
    mint: async (walletNonce) => {
      walletNonces.push(walletNonce);
      if (gate) await gate;
      const rb: RequestBranch = {
        branchId: randomBytes(6).toString("base64url"),
        nonce: randomBytes(24).toString("base64url"),
        state: randomBytes(16).toString("base64url"),
        requestJwt: "jwt." + minted.length,
        encPrivateKey: {} as KeyLike,
        encPublicJwk: {},
        encJwkThumbprint: new Uint8Array(32),
        createdAt: now,
      };
      minted.push(rb);
      return rb;
    },
  });
  return {
    set,
    registry,
    minted,
    walletNonces,
    tick: (s: number) => (now += s),
    hold: () => {
      let release!: () => void;
      gate = new Promise<void>((r) => (release = r));
      return () => {
        gate = undefined;
        release();
      };
    },
    fetchOk: async (walletNonce?: unknown) => {
      const f = await set.fetch(walletNonce);
      if (!f.ok) throw new Error("fetch refused: " + f.reason);
      return f;
    },
  };
}

describe("BranchSet — çekim (RQ1) ve sıkıştırılmış dal", () => {
  it("her çekim yeni dal; imzalı nesne döner ama saklanmaz; dal state'in kendisini değil özetini tutar; wallet_nonce iletilir", async () => {
    const h = harness();
    const f1 = await h.fetchOk();
    const f2 = await h.fetchOk("wn-1");
    expect(f1.requestJwt).toBe("jwt.0");
    expect(f2.branch.index).toBe(2);
    expect(h.walletNonces).toEqual([undefined, "wn-1"]);
    expect(h.set.fetchCount).toBe(2);
    for (const b of h.set.list()) {
      const r = b as unknown as Record<string, unknown>;
      expect(r.state).toBeUndefined();
      expect(r.requestJwt).toBeUndefined();
      expect(r.encPublicJwk).toBeUndefined();
      expect(b.stateHash).toHaveLength(32);
    }
    expect(h.set.stateMatches(f1.branch, h.minted[0].state)).toBe(true);
    expect(h.set.stateMatches(f1.branch, h.minted[1].state)).toBe(false);
  });

  it("tamamlanmış ya da süresi geçmiş sunumda dal açılmaz", async () => {
    const h = harness();
    await h.fetchOk();
    h.tick(301);
    expect(await h.set.fetch()).toEqual({ ok: false, reason: "expired" });
    const g = harness();
    g.set.consume();
    expect(await g.set.fetch()).toEqual({ ok: false, reason: "closed" });
  });

  it("imzalanırken sunum tamamlanırsa dal eklenmez", async () => {
    const h = harness();
    const release = h.hold();
    const pending = h.set.fetch();
    h.set.consume();
    release();
    expect(await pending).toEqual({ ok: false, reason: "closed" });
    expect(h.registry.size).toBe(0);
  });
});

describe("BranchSet — RQ5 Değişiklik notu 2026-10-29: sabit 429 yok, sınırlı bellek", () => {
  it("saldırgan yumuşak sınırı doldurur → gerçek cüzdanın sonraki çekimi 429 almaz; genç ve hiç yanıt almamış dal atılmaz", async () => {
    const h = harness();
    for (let i = 0; i < BRANCH_LIMITS.softCap; i++) await h.fetchOk(); // saldırgan
    const real = await h.fetchOk(); // gerçek cüzdan
    expect(real.evicted).toBeUndefined();
    expect(h.set.list()).toHaveLength(BRANCH_LIMITS.softCap + 1);
    expect(h.set.get(real.branch.branchId)).toBe(real.branch);
  });

  it("yumuşak sınırda önce kapanmış, sonra minAgeSec'ten yaşlı ve hiç yanıt almamış en eski dal atılır; işlenmekte olan dal atılmaz", async () => {
    const h = harness({ limits: { softCap: 3, hardCap: 6, minAgeSec: 60 } });
    const a = await h.fetchOk();
    const b = await h.fetchOk();
    const c = await h.fetchOk();
    h.set.failedAttempt(b.branch); // b yanıt aldı (çözülmüş, başarısız)
    h.set.decline(c.branch); // c kapandı (çok çekimli: yalnız dal)
    const d = await h.fetchOk();
    expect(d.evicted?.branchId).toBe(c.branch.branchId); // önce kapanmış
    // a genç: atılmaz, büyür
    const e = await h.fetchOk();
    expect(e.evicted).toBeUndefined();
    h.tick(61);
    expect(h.set.begin(a.branch)).toBe("ok"); // a'ya yanıt geliyor
    const f = await h.fetchOk();
    // a işlenmekte → atlanır; b yanıt almış → atlanmaz; d en eski yaşlı ve yanıtsız
    expect(f.evicted?.branchId).toBe(d.branch.branchId);
    expect(h.set.get(a.branch.branchId)).toBe(a.branch);
    h.set.end(a.branch);
  });

  it("sert tavanda yaş koşulu düşer: önce başarısız yanıt almış dal, sonra en eski; 429 yalnız bütün dallar işlenmekteyken (pratikte yok)", async () => {
    const h = harness({ limits: { softCap: 2, hardCap: 3, minAgeSec: 600 } });
    const a = await h.fetchOk();
    const b = await h.fetchOk();
    await h.fetchOk();
    h.set.failedAttempt(b.branch);
    const d = await h.fetchOk();
    expect(d.evicted?.branchId).toBe(b.branch.branchId);
    const e = await h.fetchOk();
    expect(e.evicted?.branchId).toBe(a.branch.branchId);
    expect(h.set.list()).toHaveLength(3);
    expect(h.set.fetchCount).toBe(5);
  });

  it("ortak bütçe: doluysa önce süresi geçmiş / tamamlanmış sunumların dalları, sonra yaşlı yanıtsız dal; hepsi işlenmekteyse capacity (503)", async () => {
    const registry = new BranchRegistry({ maxBranches: 2 });
    const old = harness({ registry, id: "prs_old", expiresAt: T0 + 10 });
    await old.fetchOk();
    const live = harness({ registry, id: "prs_live" });
    await live.fetchOk();
    expect(registry.size).toBe(2);
    // sahte saat iki kümede ayrı: canlı kümenin saatini ilerlet → eski sunumun süresi geçti
    live.tick(20);
    await live.fetchOk();
    expect(registry.size).toBe(2);
    expect(old.set.list()).toHaveLength(0);
    // ikisi de canlı ve genç: bütçe doluyken üçüncü katman (yaş yok) en eskiyi atar
    const third = harness({ registry, id: "prs_third" });
    await third.fetchOk();
    expect(registry.size).toBe(2);
    // tek dallık bütçe, dal işlenmekte → yer açılamaz
    const tiny = new BranchRegistry({ maxBranches: 1 });
    const t = harness({ registry: tiny });
    const only = await t.fetchOk();
    expect(t.set.begin(only.branch)).toBe("ok");
    const u = harness({ registry: tiny, id: "prs_u" });
    expect(await u.set.fetch()).toEqual({ ok: false, reason: "capacity" });
    t.set.end(only.branch);
    expect((await u.set.fetch()).ok).toBe(true);
  });
});

describe("BranchRegistry.byState — özetle arama, sabit süreli eşitlik", () => {
  it("doğru state dalı bulur; yanlış, farklı uzunlukta, dize olmayan ya da çok uzun girdi bulmaz", async () => {
    const h = harness();
    const f = await h.fetchOk();
    const st = h.minted[0].state;
    expect(h.registry.byState(st, T0)?.branch).toBe(f.branch);
    expect(h.registry.byState(st, T0)?.set).toBe(h.set);
    expect(h.registry.byState(st.slice(0, -1) + (st.endsWith("A") ? "B" : "A"), T0)).toBeUndefined();
    expect(h.registry.byState(st + "x", T0)).toBeUndefined();
    expect(h.registry.byState(undefined, T0)).toBeUndefined();
    expect(h.registry.byState(42, T0)).toBeUndefined();
    expect(h.registry.byState("", T0)).toBeUndefined();
    expect(h.registry.byState("a".repeat(10_000), T0)).toBeUndefined();
    expect(h.set.stateMatches(f.branch, "kısa")).toBe(false); // farklı uzunluk hata atmaz
    expect(h.set.stateMatches(f.branch, 1 as unknown as string)).toBe(false);
  });

  it("tamamlanmış, süresi geçmiş ya da bellekten atılmış sunumun dalı bulunmaz; 10 000 dal arasında arama doğrusal değil (Map)", async () => {
    const h = harness();
    await h.fetchOk();
    const st = h.minted[0].state;
    expect(h.registry.byState(st, T0 + 301)).toBeUndefined();
    h.set.dispose();
    expect(h.registry.byState(st, T0)).toBeUndefined();
    const g = harness();
    await g.fetchOk();
    g.set.consume();
    expect(g.registry.byState(g.minted[0].state, T0)).toBeUndefined();
    // büyük kayıt: arama süresi dal sayısından bağımsız (doğrusal tarama yok)
    const registry = new BranchRegistry({ maxBranches: 20_000 });
    const sets = Array.from({ length: 1000 }, (_, i) => harness({ registry, id: `prs_${i}` }));
    for (const s of sets) for (let k = 0; k < 10; k++) await s.fetchOk();
    expect(registry.size).toBe(10_000);
    const target = sets[999].minted[9].state;
    const t0 = performance.now();
    for (let i = 0; i < 1000; i++) registry.byState(target, T0);
    expect(performance.now() - t0).toBeLessThan(200);
    expect(registry.byState(target, T0)?.set).toBe(sets[999].set);
  });
});

describe("BranchSet — yumuşak ret (RQ2), denemeler (RQ4), kilit (PV10)", () => {
  it("tek çekimde ret → sunum REJECTED ve dallar bellekten çıkar; çok çekimde yalnız dal kapanır; ikinci ret değişiklik yapmaz", async () => {
    const one = harness();
    const f = await one.fetchOk();
    expect(one.set.decline(f.branch)).toEqual({ presentationRejected: true, alreadyClosed: false });
    expect(one.set.used).toBe(true);
    expect(one.registry.size).toBe(0);
    const two = harness();
    const a = await two.fetchOk();
    await two.fetchOk();
    expect(two.set.decline(a.branch)).toEqual({ presentationRejected: false, alreadyClosed: false });
    expect(two.set.used).toBe(false);
    expect(a.branch.closed).toBe("declined");
    expect(two.set.decline(a.branch)).toEqual({ presentationRejected: false, alreadyClosed: true });
  });

  it("imzalanmakta olan ikinci çekim varken ret sunumu kapatmaz (gerçek cüzdanın çekimi sürerken sahte ret)", async () => {
    const h = harness();
    const atk = await h.fetchOk();
    const release = h.hold();
    const realFetch = h.set.fetch();
    expect(h.set.decline(atk.branch).presentationRejected).toBe(false);
    release();
    const real = await realFetch;
    expect(real.ok).toBe(true);
    expect(h.set.used).toBe(false);
  });

  it("deneme sınırı dal başına (çok çekimde yalnız dal kapanır), tek çekimde sunum; dalsız yolda (DC API) sunum başına", async () => {
    const h = harness();
    const a = await h.fetchOk();
    await h.fetchOk();
    for (let i = 1; i < BRANCH_LIMITS.maxAttempts; i++) expect(h.set.failedAttempt(a.branch).branchClosed).toBe(false);
    expect(h.set.failedAttempt(a.branch)).toEqual({ n: 5, branchClosed: true, presentationRejected: false });
    expect(h.set.attempts).toBe(5);
    expect(h.set.begin(a.branch)).toBe("closed");
    const s = harness();
    const only = await s.fetchOk();
    for (let i = 1; i < 5; i++) s.set.failedAttempt(only.branch);
    expect(s.set.failedAttempt(only.branch).presentationRejected).toBe(true);
    expect(s.set.used).toBe(true);
    const dc = harness();
    for (let i = 1; i < 5; i++) expect(dc.set.failedAttempt().presentationRejected).toBe(false);
    expect(dc.set.failedAttempt().presentationRejected).toBe(true);
  });

  it("kilit çözmeden önce: işlenirken ikinci yanıt/ret busy; çözme sırasında kapanan dal isOpen ile yakalanır; atılan dal gone", async () => {
    const h = harness({ limits: { softCap: 2, hardCap: 2 } });
    const a = await h.fetchOk();
    const b = await h.fetchOk();
    expect(h.set.begin(a.branch)).toBe("ok");
    expect(h.set.busy).toBe(true);
    expect(h.set.begin(b.branch)).toBe("busy"); // ikinci yanıt
    expect(h.set.begin()).toBe("busy"); // DC API yolu
    // kilit tutulurken sert tavanda yeni çekim işlenen dalı atmaz, ötekini atar
    const c = await h.fetchOk();
    expect(c.evicted?.branchId).toBe(b.branch.branchId);
    expect(h.set.isOpen(a.branch)).toBe(true);
    h.set.end(a.branch);
    expect(h.set.begin(b.branch)).toBe("gone");
    // eski sürüklenme (issuer): dal kilitsiz okunur, arada ret gelir → kilit "closed" verir
    const seen = h.set.get(c.branch.branchId)!;
    h.set.decline(c.branch);
    expect(h.set.begin(seen)).toBe("closed");
    // kilit tutulurken başka yol sunumu tamamlarsa çözme sonrası yeniden bakış yakalar
    const d = await h.fetchOk();
    expect(h.set.begin(d.branch)).toBe("ok");
    h.set.consume();
    expect(h.set.isOpen(d.branch)).toBe(false);
    h.set.end(d.branch);
    expect(h.set.begin(d.branch)).toBe("used");
  });
});
