/**
 * K11 dış denetim hazırlığı — kontratlar için durumlu rastgele (fuzz) ve değişmez testleri. Tohumlu sözde rastgele işlem
 * dizileri (bağımlılık yok; tekrar: `TAMGA_FUZZ_SEED=<n> TAMGA_FUZZ_STEPS=<n> npm run contracts:test`).
 *
 * StatusListRegistry (SPEC-BC-0001 §7, ADR-0063): her adım bir GÖLGE MODELE karşı denetlenir — kontrat, modelin "geçer/ret"
 *   tahminiyle aynı davranmalı. Değişmezler: kayıtta yazılan issuerId / listURI / listSize / bitsPerEntry hiç değişmez (L3/L4);
 *   version kesin artar (L1), publishedAt geri gitmez (L1b); yalnız kurumun yetkili anahtarı yazar; emekli liste yazılamaz;
 *   günlük kotalar (48 yayın / liste, 8 kayıt / kurum) aşılmaz; içerik özeti eşleşmesi yalnız etkin ve yayınlanmış listede.
 * TrustListAnchorRegistry (ADR-0051, ADR-0053): yalnız yetkili yazıcı yazar; onaylı en yüksek sürüm geri gitmez (CH4); onaylı
 *   çapa bir daha değişmez; onay anında aday, o anki yetkili yazıcılardan en az eşik kadar AYRI destekçiye sahiptir (CH3, AC1,
 *   AC4); `isListAnchored` yalnız onaylı özete "evet" der (CH1).
 * Governance (ADR-0055 GE1): rastgele oy / çekilme / zaman / uygulama dizisinde proxy'nin uygulaması yalnız kuyruğa alınmış
 *   ve 7 günü dolmuş, o anki üyelerin 2/3 oyunu taşıyan öneriyle değişir; hiçbir kayıt governance dışından yükseltilemez.
 * Kişisel veri alanı olmaması (DP1) ABI düzeyinde `privacy-abi.test.ts`'te; burada yazma dizileri yalnız özet / sürüm / zaman taşır.
 */
import { expect } from "chai";
import type { Signer } from "ethers";

import { DAY, ZERO, ethers, id, loadFixture, networkHelpers, type Fixture } from "./helpers/fixture.js";

const SEEDS = process.env.TAMGA_FUZZ_SEED ? [Number(process.env.TAMGA_FUZZ_SEED)] : [1, 2, 3];
const STEPS = Number(process.env.TAMGA_FUZZ_STEPS ?? 120);

/** mulberry32 — küçük, tohumlu, tekrarlanabilir */
function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (n: number) => Math.floor(next() * n),
    pick: <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)],
  };
}

async function attempt(f: () => Promise<{ wait: () => Promise<unknown> }>): Promise<boolean> {
  try {
    await (await f()).wait();
    return true;
  } catch {
    return false;
  }
}
const latestTs = async () => (await ethers.provider.getBlock("latest"))!.timestamp;

describe("K11 değişmez / fuzz — StatusListRegistry (gölge model)", function () {
  this.timeout(600_000);
  for (const seed of SEEDS) {
    it(`tohum ${seed}: ${STEPS} rastgele işlem modelle aynı sonuçlanır, değişmezler korunur`, async () => {
      const f: Fixture = await loadFixture();
      const r = rng(seed);
      const actors: Array<[string, Signer]> = [
        ["operator", f.uniOperator],
        ["operator", f.uniOperator],
        ["operator", f.uniOperator], // ağırlık: yetkili yazıcı daha sık
        ["stranger", f.stranger],
        ["stateDelegate", f.trDelegate],
        ["otherState", f.kzDelegate],
        ["deployer", f.deployer],
      ];
      const URIS = Array.from({ length: 6 }, (_, i) => `https://status.example/k11/${seed}/${i}`).concat([""]);
      type M = {
        size: number;
        bits: number;
        version: bigint;
        publishedAt: bigint;
        hash: string;
        active: boolean;
        pubPerDay: Map<number, number>;
      };
      const model = new Map<string, M>();
      const regPerDay = new Map<number, number>();
      let stats = { ok: 0, rejected: 0 };

      for (let step = 0; step < STEPS; step++) {
        const advance = r.pick([0, 0, 0, 60, 3600, DAY]);
        const ts = (await latestTs()) + 1 + advance;
        await networkHelpers.time.setNextBlockTimestamp(ts);
        const day = Math.floor(ts / DAY);
        const [who, signer] = r.pick(actors);
        const w = f.as(f.statusLists, signer);
        const uri = r.pick(URIS);
        const lid = await f.statusLists.listIdOf(f.uniIssuer, uri);
        const m = model.get(uri);
        const op = r.pick(["register", "register", "publish", "publish", "publish", "retire"] as const);
        let expected: boolean;
        let ok: boolean;
        if (op === "register") {
          const size = r.pick([99_999, 100_000, 100_000, 1_000_000, 2 ** 32 - 1]);
          const bits = r.pick([0, 1, 1, 2, 2, 3, 4, 8, 16]);
          expected =
            who === "operator" &&
            uri !== "" &&
            size >= 100_000 &&
            [1, 2, 4, 8].includes(bits) &&
            !m &&
            (regPerDay.get(day) ?? 0) < 8;
          ok = await attempt(() => w.registerList(f.uniIssuer, uri, size, bits));
          if (ok) {
            regPerDay.set(day, (regPerDay.get(day) ?? 0) + 1);
            model.set(uri, {
              size,
              bits,
              version: 0n,
              publishedAt: 0n,
              hash: ZERO,
              active: true,
              pubPerDay: new Map(),
            });
          }
        } else if (op === "publish") {
          const prevV = m?.version ?? 0n;
          const version = BigInt(Math.max(0, Number(prevV) + r.pick([-1, 0, 1, 1, 2, 7])));
          const hash = r.pick([ZERO, id(`h${step}`), id(`h${step}`)]);
          const prevAt = Number(m?.publishedAt ?? 0n);
          const pa = r.pick([0, ts - 1000, ts + 10_000, Math.max(0, prevAt - 100), ts]);
          const eff = pa === 0 ? ts : pa;
          expected =
            !!m &&
            who === "operator" &&
            m.active &&
            hash !== ZERO &&
            version > prevV &&
            pa <= ts + 300 &&
            eff >= prevAt &&
            (m.pubPerDay.get(day) ?? 0) < 48;
          ok = await attempt(() => w.publishList(lid, hash, version, pa));
          if (ok && m) {
            m.version = version;
            m.publishedAt = BigInt(eff);
            m.hash = hash;
            m.pubPerDay.set(day, (m.pubPerDay.get(day) ?? 0) + 1);
          }
        } else {
          expected = !!m && who === "operator" && m.active;
          ok = await attempt(() => w.retireList(lid, id("k11")));
          if (ok && m) m.active = false;
        }
        expect(ok, `adım ${step} (${op}, ${who}, "${uri}")`).to.equal(expected);
        stats = ok ? { ...stats, ok: stats.ok + 1 } : { ...stats, rejected: stats.rejected + 1 };

        // değişmezler: zincir durumu = model
        for (const [u, mm] of model) {
          const l = await f.statusLists.listIdOf(f.uniIssuer, u);
          const a = await f.statusLists.getListAnchor(l);
          expect(a.issuerId).to.equal(f.uniIssuer);
          expect(a.listURI).to.equal(u);
          expect(a.listSize).to.equal(BigInt(mm.size));
          expect(a.bitsPerEntry).to.equal(BigInt(mm.bits));
          expect(a.version).to.equal(mm.version);
          expect(a.publishedAt).to.equal(mm.publishedAt);
          expect(a.contentHash).to.equal(mm.hash);
          expect(a.status).to.equal(mm.active ? 1n : 2n);
          expect(await f.statusLists.matchesContentHash(l, mm.hash)).to.equal(mm.active && mm.version > 0n);
        }
      }
      // dizinin iki yolu da gerçekten denendi
      expect(stats.ok).to.be.greaterThan(5);
      expect(stats.rejected).to.be.greaterThan(5);
    });
  }
});

describe("K11 değişmez / fuzz — TrustListAnchorRegistry (eşik, monotonluk, değişmezlik)", function () {
  this.timeout(600_000);
  for (const seed of SEEDS) {
    it(`tohum ${seed}: ${STEPS} rastgele çapa / yazıcı / eşik işlemi`, async () => {
      const [gov, a1, a2, a3, a4, stranger] = await ethers.getSigners();
      const impl = await ethers.deployContract("TrustListAnchorRegistry");
      const init = [a1, a2, a3];
      const data = impl.interface.encodeFunctionData("initialize", [
        await gov.getAddress(),
        await Promise.all(init.map((s) => s.getAddress())),
        2,
      ]);
      const proxy = await ethers.deployContract("ERC1967Proxy", [await impl.getAddress(), data]);
      const reg = await ethers.getContractAt("TrustListAnchorRegistry", await proxy.getAddress());
      const as = (s: Signer) => reg.connect(s) as typeof reg;
      const r = rng(seed);
      const writers = [a1, a2, a3, a4, stranger];
      const addr = new Map<Signer, string>();
      for (const s of writers) addr.set(s, await s.getAddress());
      const allowed = new Set([a1, a2, a3].map((s) => addr.get(s)!));
      let required = 2;
      const KEYS = [id("tamga:trust-list:test:lotl"), id("tamga:trust-list:test:tl-tr")];
      const HASHES = [id("H1"), id("H2"), id("H3")];
      const latest = new Map<string, bigint>();
      const confirmed = new Map<string, { contentHash: string; previousHash: string; issuedAt: bigint }>();
      /** (anahtar, sürüm, aday verisi) → destekleyen adresler (başarılı çağrılardan) */
      const supporters = new Map<string, Set<string>>();
      let confirmations = 0;

      for (let step = 0; step < STEPS; step++) {
        const roll = r.next();
        if (roll < 0.12) {
          // yönetim: yazıcı ekle / çıkar (governance)
          const s = r.pick([a1, a2, a3, a4, stranger]);
          const on = r.next() < 0.5;
          const caller = r.next() < 0.85 ? gov : stranger;
          const ok = await attempt(() => as(caller).setAnchorer(addr.get(s)!, on));
          // kontrat denetimi 2026-11-11 (D2): çıkarma, yazıcı sayısını eşiğin altına düşürüyorsa reddedilir
          const underflow = !on && allowed.has(addr.get(s)!) && allowed.size <= required;
          expect(ok, "setAnchorer yalnız governance; eşiğin altına düşüren çıkarma ret").to.equal(
            caller === gov && !underflow,
          );
          if (ok) on ? allowed.add(addr.get(s)!) : allowed.delete(addr.get(s)!);
          expect(await reg.anchorerCount()).to.equal(BigInt(allowed.size));
          expect(allowed.size, "yazıcı sayısı eşiğin altına düşmez").to.be.gte(required);
          continue;
        }
        if (roll < 0.2) {
          const want = 1 + r.int(4);
          const ok = await attempt(() => as(gov).setRequiredConfirmations(want));
          expect(ok, `eşik ${want}, yazıcı ${allowed.size}`).to.equal(want <= allowed.size);
          if (ok) required = want;
          continue;
        }
        const s = r.pick(writers);
        const who = addr.get(s)!;
        const key = r.pick(KEYS);
        const v = (latest.get(key) ?? 0n) + BigInt(r.pick([-1, 0, 1, 1, 1, 2]));
        if (v < 0n) continue;
        const hash = r.pick(HASHES);
        const prev = r.pick([ZERO, HASHES[0]]);
        const issuedAt = BigInt(r.pick([1000, 2000]));
        const before = await reg.listAnchor(key, v);
        const ok = await attempt(() => as(s).anchorList(key, v, hash, prev, issuedAt));
        if (!allowed.has(who)) expect(ok, "yetkisiz yazıcı").to.equal(false);
        if (confirmed.has(`${key}:${v}`)) expect(ok, "onaylı çapa yeniden yazılamaz").to.equal(false);
        if (ok) {
          const cand = `${key}:${v}:${hash}:${prev}:${issuedAt}`;
          if (!supporters.has(cand)) supporters.set(cand, new Set());
          supporters.get(cand)!.add(who);
          const after = await reg.listAnchor(key, v);
          if (after.confirmed && !before.confirmed) {
            confirmations++;
            const live = [...supporters.get(cand)!].filter((x) => allowed.has(x)).length;
            expect(live, "onayda canlı ayrı destekçi ≥ eşik").to.be.gte(required);
            expect(after.contentHash).to.equal(hash);
            confirmed.set(`${key}:${v}`, { contentHash: hash, previousHash: prev, issuedAt });
          }
        }
        // değişmezler
        for (const k of KEYS) {
          const now = await reg.latestListVersion(k);
          expect(now >= (latest.get(k) ?? 0n), "CH4: onaylı en yüksek sürüm geri gitmez").to.equal(true);
          latest.set(k, now);
        }
        for (const [kv, c] of confirmed) {
          const [k, vs] = kv.split(":");
          const a = await reg.listAnchor(k, BigInt(vs));
          expect(a.confirmed).to.equal(true);
          expect(a.contentHash).to.equal(c.contentHash);
          expect(a.previousHash).to.equal(c.previousHash);
          expect(a.issuedAt).to.equal(c.issuedAt);
          for (const h of HASHES) expect(await reg.isListAnchored(k, BigInt(vs), h)).to.equal(h === c.contentHash);
        }
      }
      expect(confirmations, "dizi en az bir onay üretmeli").to.be.greaterThan(0);
    });
  }
});

describe("K11 değişmez / fuzz — Governance yükseltme bekleme süresi (GE1)", function () {
  this.timeout(600_000);
  let upgraded = 0;
  after(() => {
    // birden çok tohumla koşulduysa dizilerden en az biri yükseltmeyi gerçekten uygulamış olmalı (yol denenmiş olsun)
    if (SEEDS.length > 1) expect(upgraded, "uygulanan yükseltme").to.be.greaterThan(0);
  });
  const SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const implOf = async (proxy: string) =>
    ethers.getAddress("0x" + (await ethers.provider.getStorage(proxy, SLOT)).slice(26));

  for (const seed of SEEDS) {
    it(`tohum ${seed}: rastgele oy / çekilme / zaman / uygulama — uygulama yalnız kuyruk + 7 gün + eşikle değişir`, async () => {
      const f: Fixture = await loadFixture();
      const r = rng(seed);
      const proxy = await f.issuers.getAddress();
      const validators: Array<[string, Signer]> = [
        ["TR", f.trValidator],
        ["KZ", f.kzValidator],
        ["AZ", f.azValidator],
      ];

      // governance dışından hiçbir kayıt yükseltilemez
      const rogue = await ethers.deployContract("IssuerRegistry");
      for (const c of [
        f.issuers,
        f.statusLists,
        f.rootCAs,
        f.schemas,
        f.relyingParties,
        f.recognition,
        f.networkRegistry,
        f.governance,
      ])
        for (const s of [f.stranger, f.trValidator, f.trDelegate, f.uniOperator])
          expect(
            await attempt(() => (c as any).connect(s).upgradeToAndCall(rogue.getAddress(), "0x")),
            "doğrudan upgradeToAndCall",
          ).to.equal(false);

      const impl = await ethers.deployContract("IssuerRegistry");
      const tx = await f.as(f.governance, f.trValidator).proposeProtocolUpgrade(proxy, await impl.getAddress());
      const rc = await tx.wait();
      const pid = rc!.logs
        .map((l: any) => {
          try {
            return f.governance.interface.parseLog(l);
          } catch {
            return null;
          }
        })
        .find((e: any) => e?.name === "ProposalCreated")!.args.id as string;
      const original = await implOf(proxy);
      const active = new Set(["TR", "KZ", "AZ"]);
      const votedFor = new Set<string>();
      let queuedAt: number | null = null;

      for (let step = 0; step < 60; step++) {
        const roll = r.next();
        if (roll < 0.35) {
          const [st, s] = r.pick(validators);
          const support = r.next() < 0.8;
          if (await attempt(() => f.as(f.governance, s).vote(pid, support))) if (support) votedFor.add(st);
        } else if (roll < 0.42) {
          const [st, s] = r.pick(validators);
          if (active.size > 2 && (await attempt(() => f.as(f.governance, s).withdraw()))) active.delete(st);
        } else if (roll < 0.7) {
          await networkHelpers.time.increase(r.pick([3600, DAY, 3 * DAY, 6 * DAY]));
        } else {
          const ts = (await latestTs()) + 1;
          const caller = r.pick([f.stranger, f.trValidator]);
          const ok = await attempt(() => f.as(f.governance, caller).execute(pid));
          const counted = [...votedFor].filter((s) => active.has(s)).length;
          if (ok && queuedAt === null) {
            expect(await implOf(proxy), "ilk başarılı execute yalnız kuyruğa alır").to.equal(original);
            expect(counted).to.be.gte(2);
            queuedAt = Number(await f.governance.executableAt(pid)) - 7 * DAY;
          } else if (ok) {
            expect(ts, "7 gün dolmadan uygulanamaz").to.be.gte(queuedAt! + 7 * DAY);
            expect(counted, "uygulamada eşik yeniden sayılır").to.be.gte(2);
            expect(await implOf(proxy)).to.equal(await impl.getAddress());
            upgraded++;
            break;
          } else if (queuedAt !== null && ts < queuedAt + 7 * DAY) {
            expect(await implOf(proxy)).to.equal(original);
          }
        }
        if (queuedAt === null || (await latestTs()) < queuedAt + 7 * DAY)
          expect(await implOf(proxy), "erken yükseltme yok").to.equal(original);
      }
    });
  }
});

describe("K11 değişmez / fuzz — Governance üyelik ve egemenlik (GV3, N1, ADR-0002)", function () {
  this.timeout(600_000);
  const memberships: Array<{ seed: number; admissions: number; removals: number }> = [];
  after(() => {
    // birden çok tohumla koşulduysa kabul ve çıkarma yolları gerçekten yürütülmüş olmalı
    if (SEEDS.length > 1) {
      expect(
        memberships.reduce((n, m) => n + m.admissions, 0),
        "yürütülen kabul",
      ).to.be.greaterThan(0);
      expect(
        memberships.reduce((n, m) => n + m.removals, 0),
        "yürütülen çıkarma",
      ).to.be.greaterThan(0);
    }
  });
  for (const seed of SEEDS) {
    it(`tohum ${seed}: rastgele kabul / çıkarma / çekilme / delege anahtarı dizisi`, async () => {
      const f: Fixture = await loadFixture();
      const r = rng(seed);
      const all = await ethers.getSigners();
      const CODES = ["TR", "KZ", "AZ", "UZ", "KG"];
      const code = (c: string) => ethers.hexlify(ethers.toUtf8Bytes(c));
      const validatorPool = [f.trValidator, f.kzValidator, f.azValidator, ...all.slice(8, 12)];
      const keyPool = [f.trDelegate, f.kzDelegate, ...all.slice(12, 16)];
      const keyAddrs = await Promise.all(keyPool.map((s) => s.getAddress()));
      const openProposals: Array<{ pid: string; kind: "admit" | "remove" }> = [];
      const pidOf = (rc: any): string =>
        rc.logs
          .map((l: any) => {
            try {
              return f.governance.interface.parseLog(l);
            } catch {
              return null;
            }
          })
          .find((e: any) => e?.name === "ProposalCreated")!.args.id;
      let removals = 0;
      let admissions = 0;

      const activeCount = async () => {
        let n = 0;
        for (const c of CODES) if ((await f.governance.getMember(code(c))).status === 1n) n++;
        return n;
      };

      // her adımda bütün devlet ve anahtarlar okunur (pahalı): adım sayısı yarı
      const poolAddrs = await Promise.all(validatorPool.map((x) => x.getAddress()));
      // başlangıç: beş üyeli ağ (UZ, KG kabul edilir) — çıkarma yolunun yürüyebilmesi için ≥3 üye gerekir
      for (const [st, v] of [
        ["UZ", poolAddrs[3]],
        ["KG", poolAddrs[4]],
      ] as const) {
        const pid = pidOf(await (await f.as(f.governance, f.trValidator).proposeStateAdmission(code(st), v)).wait());
        await (await f.as(f.governance, f.trValidator).vote(pid, true)).wait();
        await (await f.as(f.governance, f.kzValidator).vote(pid, true)).wait();
        await (await f.as(f.governance, f.azValidator).vote(pid, true)).wait();
        await (await f.governance.execute(pid)).wait();
      }
      expect(await f.governance.activeMemberCount()).to.equal(5n);
      for (let step = 0; step < Math.ceil(STEPS / 2); step++) {
        const roll = r.next();
        const activeCodes: string[] = [];
        // çağıran: çoğunlukla etkin bir üyenin validator'ı (yollar gerçekten yürüsün), bazen rastgele (yetkisiz çağrı)
        const activeVals: Signer[] = [];
        for (const c of CODES) {
          const m = await f.governance.getMember(code(c));
          const i = poolAddrs.indexOf(m.validatorAddress);
          if (m.status === 1n) activeCodes.push(c);
          if (m.status === 1n && i >= 0) activeVals.push(validatorPool[i]);
        }
        const s = r.next() < 0.8 && activeVals.length ? r.pick(activeVals) : r.pick(validatorPool);
        // ağırlıklar: öneri 0.20 · oy 0.45 (çoğu son öneriye) · uygulama 0.15 · çekilme 0.04 · delege 0.10 · zaman 0.06
        const target = () => (r.next() < 0.7 ? openProposals[openProposals.length - 1] : r.pick(openProposals));
        if (roll < 0.1) {
          const st = r.pick(["UZ", "KG", "UZ", "KG", "TR"]);
          const v = await r.pick(validatorPool).getAddress();
          try {
            const rc = await (await f.as(f.governance, s).proposeStateAdmission(code(st), v)).wait();
            openProposals.push({ pid: pidOf(rc), kind: "admit" });
          } catch {
            /* geçersiz öneri: reddedildi */
          }
        } else if (roll < 0.2) {
          try {
            const rc = await (
              await f
                .as(f.governance, s)
                .proposeStateRemoval(
                  code(r.next() < 0.8 && activeCodes.length ? r.pick(activeCodes) : r.pick(CODES)),
                  id("k11"),
                )
            ).wait();
            openProposals.push({ pid: pidOf(rc), kind: "remove" });
          } catch {
            /* reddedildi */
          }
        } else if (roll < 0.65 && openProposals.length) {
          await attempt(() => f.as(f.governance, s).vote(target().pid, r.next() < 0.9));
        } else if (roll < 0.8 && openProposals.length) {
          const p = target();
          const before = await f.governance.activeMemberCount();
          const ok = await attempt(() => f.as(f.governance, f.stranger).execute(p.pid));
          const after = await f.governance.activeMemberCount();
          if (ok && p.kind === "remove" && after < before) {
            removals++;
            // ADR-0002 / F-01: iki üyeli ağda çıkarma imkânsız (çıkarılan oy veremez, eşik en az 2)
            expect(before, "çıkarma yalnız ≥3 üyede").to.be.gte(3n);
          }
          if (ok && p.kind === "admit" && after > before) admissions++;
        } else if (roll < 0.84) {
          const before = await f.governance.activeMemberCount();
          if (before < 4n) continue; // ağ küçülüp kilitlenmesin (dizinin geri kalanı anlamlı kalsın)
          const ok = await attempt(() => f.as(f.governance, s).withdraw());
          if (ok) expect(before, "son üye çekilemez").to.be.gte(2n);
        } else if (roll < 0.94) {
          const n = r.int(3);
          const keys = Array.from({ length: n }, () => r.pick(keyAddrs));
          await attempt(() => f.as(f.governance, s).setDelegateKeys(code(r.pick(CODES)), [...new Set(keys)]));
        } else {
          await networkHelpers.time.increase(r.pick([3600, DAY, 10 * DAY, 31 * DAY]));
        }

        // GV3: sayaç = ACTIVE üye sayısı; en az bir üye
        const cnt = await f.governance.activeMemberCount();
        expect(cnt).to.equal(BigInt(await activeCount()));
        expect(cnt).to.be.gte(1n);
        // N1 / F-02: bir delege anahtarı en çok bir devletin
        for (const k of keyAddrs) {
          let owners = 0;
          for (const c of CODES) if (await f.governance.isDelegateOf(k, code(c))) owners++;
          expect(owners, `anahtar ${k}`).to.be.lte(1);
        }
        // F-04: bir validator adresi en çok bir ETKİN devletin
        const seen = new Set<string>();
        for (const c of CODES) {
          const m = await f.governance.getMember(code(c));
          if (m.status !== 1n) continue;
          expect(seen.has(m.validatorAddress), `validator ${m.validatorAddress}`).to.equal(false);
          seen.add(m.validatorAddress);
        }
      }
      memberships.push({ seed, admissions, removals });
    });
  }
});
