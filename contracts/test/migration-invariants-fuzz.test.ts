/**
 * Göç kipi (ADR-0073 K1, CE1) için değişmez / fuzz testleri — kontrat güvenlik turu 2026-11-04.
 * Tohumlu sözde rastgele işlem dizileri her adımda bir GÖLGE MODELE karşı denetlenir (tekrar:
 * `TAMGA_FUZZ_SEED=<n> TAMGA_FUZZ_STEPS=<n> npm run contracts:test`).
 *
 *   1) Geçmiş sırası + olağan yazım / yeniden oynatma çakışması (IssuerRegistry): pencere açıkken yalnız sahibi devletin
 *      delegesi, açık tarihle (0 değil), blok zamanından ileri olmayan ve son değişiklikten geri olmayan tarihle ve geçerli
 *      geçişle yazar. Değişmezler: geçmiş `since` sırasıyla azalmaz; son pencere bugünkü durumdur; günlük kota sayılmaz;
 *      olağan (tarihsiz) yazım reddedilir; "şimdi" tarihli acil yazımdan sonra daha eski yeniden oynatma reddedilir.
 *   2) Göç yürütücüsünün yetkileri (SchemaRegistry, NetworkRegistry, IssuerRegistry): yürütücü yalnız pencere açıkken ağ
 *      şemasını kaydeder, sürüm özeti ekler, deprecate eder ve ağ kaydı yazar; ağ şemasını HİÇBİR ZAMAN iptal edemez ve ulusal
 *      kayda yazamaz. Değişmezler: yürütücü dizisinden sonra hiçbir ağ şeması REVOKED değil; ağ kaydının yazım sayacı her
 *      başarılı yazımda tam bir artar; pencere kapandıktan sonra yürütücünün bütün yazımları reddedilir.
 */
import { expect } from "chai";
import type { Signer } from "ethers";

import {
  DAY,
  IssuerAssurance,
  IssuerCategory,
  SchemaTier,
  Status,
  TR,
  ZERO,
  ethers,
  id,
  loadFixture,
  networkHelpers,
  type Fixture,
} from "./helpers/fixture.js";

const SEEDS = process.env.TAMGA_FUZZ_SEED ? [Number(process.env.TAMGA_FUZZ_SEED)] : [21, 22, 23];
const STEPS = Number(process.env.TAMGA_FUZZ_STEPS ?? 60);
const PLAN = id("replay-plan-fuzz");

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

async function proposalId(tx: any, f: Fixture): Promise<string> {
  const rc = await tx.wait();
  return rc!.logs
    .map((l: any) => {
      try {
        return f.governance.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find((e: any) => e?.name === "ProposalCreated")!.args.id;
}

async function govern(f: Fixture, tx: Promise<any>) {
  const pid = await proposalId(await tx, f);
  await (await f.as(f.governance, f.trValidator).vote(pid, true)).wait();
  await (await f.as(f.governance, f.kzValidator).vote(pid, true)).wait();
  await (await f.governance.execute(pid)).wait();
}

async function openMigration(f: Fixture, registry: any, window: number, executor: string) {
  const g = f.as(f.governance, f.trValidator);
  await govern(f, g.proposeMigrationOpen(await registry.getAddress(), PLAN, window, executor));
}

describe("göç kipi değişmez / fuzz — geçmiş sırası, olağan yazım ve yeniden oynatma (gölge model)", function () {
  this.timeout(600_000);
  for (const seed of SEEDS) {
    it(`tohum ${seed}: ${STEPS} tarihli / tarihsiz yazım modelle aynı sonuçlanır, geçmiş sıralı kalır`, async () => {
      const f: Fixture = await loadFixture();
      const r = rng(seed);
      await openMigration(f, f.issuers, 30 * DAY, await f.stranger.getAddress());
      const start = await latestTs();
      const t0 = start - 20 * DAY;
      const fp = id(`FUZZ-${seed}`);
      await (
        await f.as(f.issuers, f.trDelegate).registerIssuer({
          issuerId: ZERO,
          stateCode: TR,
          nameHash: id("Fuzz Institute"),
          category: IssuerCategory.EDUCATION,
          assurance: IssuerAssurance.I2,
          certFingerprint: fp,
          parentCA: f.trCA,
          metadataURI: "",
          status: Status.ACTIVE,
          validFrom: t0 - DAY,
          validUntil: start + 365 * DAY,
          successorId: ZERO,
          registeredAt: t0,
          revokedAt: 0,
        })
      ).wait();
      const who = ethers.keccak256(ethers.concat([TR, fp]));

      const m = { status: Status.ACTIVE as Status, last: t0, changes: 1 };
      const actors: Array<[string, Signer]> = [
        ["state", f.trDelegate],
        ["state", f.trDelegate],
        ["state", f.trDelegate],
        ["other", f.kzDelegate],
        ["executor", f.stranger],
      ];
      let ok = 0;
      let rejected = 0;
      for (let step = 0; step < STEPS; step++) {
        const now = await latestTs();
        const [who_, signer] = r.pick(actors);
        const kind = r.pick(["suspend", "reinstate", "revoke", "suspend", "reinstate"] as const);
        // tarih: 0 (olağan yazım), son değişiklikten geri, son değişiklik ile şimdi arası, tam "şimdi", gelecek
        const dateKind = r.pick(["zero", "back", "forward", "forward", "now", "future"] as const);
        const at =
          dateKind === "zero"
            ? 0
            : dateKind === "back"
              ? m.last - 1 - r.int(DAY)
              : dateKind === "forward"
                ? Math.min(now, m.last + r.int(Math.max(1, Math.floor((now - m.last) / 4))))
                : dateKind === "now"
                  ? now
                  : now + 1000 + r.int(DAY);
        const w = f.as(f.issuers, signer);
        const call =
          kind === "suspend"
            ? () => w.suspendIssuerAt(who, at)
            : kind === "reinstate"
              ? () => w.reinstateIssuerAt(who, at)
              : () => w.revokeIssuerAt(who, ZERO, at);
        const transition =
          (kind === "suspend" && m.status === Status.ACTIVE) ||
          (kind === "reinstate" && m.status === Status.SUSPENDED) ||
          (kind === "revoke" && m.status !== Status.REVOKED);
        const expected = who_ === "state" && transition && at !== 0 && at >= m.last && at <= now; // at ≤ en son blok < sonraki blok
        const quotaBefore = await f.issuers.writeCountToday(TR);
        const got = await attempt(call);
        expect(got, `adım ${step}: ${kind} ${who_} ${dateKind} at=${at} last=${m.last} now=${now}`).to.equal(expected);
        if (got) {
          ok++;
          m.status = kind === "suspend" ? Status.SUSPENDED : kind === "reinstate" ? Status.ACTIVE : Status.REVOKED;
          m.last = at;
          m.changes++;
        } else rejected++;
        // CE1: pencere açıkken kota sayılmaz (aynı UTC günü içinde karşılaştırılır)
        if (Math.floor((await latestTs()) / DAY) === Math.floor(now / DAY)) {
          expect(await f.issuers.writeCountToday(TR)).to.equal(quotaBefore);
        }
        // değişmezler
        const h = await f.issuers.issuerStatusHistoryOf(who);
        expect(h.length).to.equal(m.changes);
        for (let k = 1; k < h.length; k++) expect(h[k].since >= h[k - 1].since, `geçmiş sırası ${k}`).to.equal(true);
        expect(Number(h[h.length - 1].status)).to.equal(m.status);
        expect(Number((await f.issuers.getIssuer(who)).status)).to.equal(m.status);
        if (r.next() < 0.3) await networkHelpers.time.increase(1 + r.int(3600));
      }
      // acil (şimdi tarihli) yazımdan sonra daha eski yeniden oynatma yazılamaz
      if (m.status !== Status.REVOKED) {
        const now = await latestTs();
        await (await f.as(f.issuers, f.trDelegate).revokeIssuerAt(who, ZERO, now)).wait();
        await expect(f.as(f.issuers, f.trDelegate).revokeIssuerAt(who, ZERO, now - 1)).to.be.reverted;
      }
      expect(ok + rejected).to.equal(STEPS);
      expect(ok, "en az bir yazım geçmeli (dizi anlamlı)").to.be.greaterThan(0);
    });
  }
});

describe("göç kipi değişmez / fuzz — göç yürütücüsünün yetkileri", function () {
  this.timeout(600_000);
  for (const seed of SEEDS) {
    it(`tohum ${seed}: yürütücü yalnız izinli ağ yazımlarını, yalnız pencere açıkken yapar; ağ şeması hiç iptal edilmez`, async () => {
      const f: Fixture = await loadFixture();
      const r = rng(seed * 7 + 1);
      const exec = f.stranger;
      const execAddr = await exec.getAddress();
      for (const reg of [f.schemas, f.networkRegistry, f.issuers] as any[])
        await openMigration(f, reg, 10 * DAY, execAddr);
      const deadline = Number((await f.schemas.migrationState()).deadline);

      const VCTS = Array.from({ length: 4 }, (_, i) => `urn:tamga:fuzz:Type${seed}x${i}:1`);
      const registered = new Set<string>();
      const deprecated = new Set<string>();
      const hashes = new Map<string, number>();
      const PROVIDERS = Array.from({ length: 3 }, (_, i) => id(`provider-${seed}-${i}`));
      const revision = new Map<string, number>();
      let target = ZERO;
      let closedJumped = false;

      for (let step = 0; step < STEPS; step++) {
        if (!closedJumped && step > STEPS * 0.7) {
          await networkHelpers.time.increaseTo(deadline + DAY); // süre doldu → kesin kapalı
          closedJumped = true;
        } else if (r.next() < 0.3) await networkHelpers.time.increase(1 + r.int(3600));
        const now = await latestTs();
        const open = now + 1 <= deadline; // sonraki blok en erken now + 1; pencere sonu sıçramayla uzak tutulur
        const op = r.pick([
          "register",
          "addHash",
          "deprecate",
          "revoke",
          "revokeAt",
          "writeRecord",
          "national",
          "registerNational",
        ] as const);
        const vct = r.pick(VCTS);
        const sid = id(vct);
        let expected = false;
        let call: () => Promise<any>;
        const s = f.as(f.schemas, exec);
        if (op === "register") {
          expected = open && !registered.has(sid);
          // pencerede başlangıç açıkça verilir (kontrat denetimi 2026-11-12, D6)
          call = () =>
            s.registerSchema({ ...f.schemaRecord(vct, SchemaTier.NETWORK, "0x0000", id(`h0-${vct}`)), validFrom: now });
        } else if (op === "addHash") {
          const n = hashes.get(sid) ?? 0;
          expected = open && registered.has(sid) && n < 32;
          call = () => s.addSchemaContentHash(sid, id(`h${n + 1}-${vct}`));
        } else if (op === "deprecate") {
          // pencerede tarihsiz yazım yalnız Governance'a açık; yürütücü tarihle deprecate eder
          expected = open && registered.has(sid) && !deprecated.has(sid);
          call = () => s.deprecateSchemaAt(sid, ZERO, now);
        } else if (op === "revoke") {
          expected = false; // ağ şemasının iptali yalnız Governance
          call = () => s.revokeSchema(sid, id("x"));
        } else if (op === "revokeAt") {
          expected = false;
          call = () => s.revokeSchemaAt(sid, id("x"), now);
        } else if (op === "writeRecord") {
          target = r.pick(PROVIDERS);
          const st = r.pick([1, 2, 3]); // ACTIVE, SUSPENDED, REVOKED
          expected = open; // at = son blok zamanı: hiçbir zaman ileri değil, kaydın son anından geri değil
          const rec = {
            kind: 1,
            recordId: target,
            parentId: ZERO,
            region: "0x0000",
            subtype: 0,
            status: st,
            validFrom: 0,
            validUntil: 0,
            fingerprint: ZERO,
            detailsHash: id(`d-${step}`),
            flags: 0,
            digests: [],
          };
          call = () => f.as(f.networkRegistry, exec).writeRecord(rec, now);
        } else if (op === "national") {
          expected = false; // yürütücü ulusal kayda yazamaz (N1)
          call = () => f.as(f.issuers, exec).suspendIssuerAt(f.uniIssuer, now);
        } else {
          expected = false;
          call = () =>
            s.registerSchema(f.schemaRecord(`urn:tamga:tr:edu:Fuzz${seed}x${step}:1`, SchemaTier.NATIONAL, TR));
        }
        const got = await attempt(call);
        expect(got, `adım ${step}: ${op} open=${open}`).to.equal(expected);
        if (got) {
          if (op === "register") registered.add(sid);
          if (op === "addHash") hashes.set(sid, (hashes.get(sid) ?? 0) + 1);
          if (op === "deprecate") deprecated.add(sid);
          if (op === "writeRecord") revision.set(target, (revision.get(target) ?? 0) + 1);
        }
        // değişmez: ağ kaydının yazım sayacı her başarılı yazımda tam bir artar (başarısız yazım sayacı değiştirmez)
        for (const p of PROVIDERS) {
          expect(Number(await f.networkRegistry.revisionOf(1, p)), `sayaç ${p}`).to.equal(revision.get(p) ?? 0);
        }
        // değişmez: hiçbir ağ şeması iptal edilmemiş
        for (const v of VCTS) {
          const h = await f.schemas.schemaStatusHistoryOf(id(v));
          expect(
            h.some((c: any) => Number(c.status) === 3),
            `${v} REVOKED olmamalı`,
          ).to.equal(false);
        }
      }
      // pencere kapandıktan sonra yürütücünün hiçbir yazımı geçmez
      expect(await f.schemas.isMigrationOpen()).to.equal(false);
      expect(await f.networkRegistry.isMigrationOpen()).to.equal(false);
      // sıçrama gerçekten yapıldı ve kapanmadan önce en az bir yazım geçti
      expect(closedJumped).to.equal(true);
      expect(registered.size + revision.size).to.be.greaterThan(0);
    });
  }
});
