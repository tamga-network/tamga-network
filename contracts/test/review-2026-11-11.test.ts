/**
 * Kod incelemesi 2026-11-11 — kontrat bulgusu, süreç içi Hardhat zincirinde:
 *   - G1 : NETWORK_SCHEMA önerisinin `validFrom`'u oylama sürerken geçmişte kalırsa yürütme düşmez; başlangıç yürütme anıdır
 *          (eski hâl: `PastDateOutsideMigration` ile öneri hiç yürütülemiyordu). İleri tarih ve göç kipindeki geçmiş tarih aynen
 *          yazılır.
 */
import { expect } from "chai";

import { DAY, SchemaTier, TR, ethers, id, loadFixture, networkHelpers, type Fixture } from "./helpers/fixture.js";

const PLAN = id("plan-2026-11-11");

async function proposalId(tx: any, f: Fixture): Promise<string> {
  const rc = await tx.wait();
  for (const l of rc.logs) {
    try {
      const e = f.governance.interface.parseLog(l);
      if (e?.name === "ProposalCreated") return e.args.id;
    } catch {
      /* başka kontrat */
    }
  }
  throw new Error("ProposalCreated yok");
}
async function pass(f: Fixture, pid: string) {
  await (await f.as(f.governance, f.trValidator).vote(pid, true)).wait();
  await (await f.as(f.governance, f.kzValidator).vote(pid, true)).wait();
}
const blockTime = async (rc: any) => Number((await ethers.provider.getBlock(rc.blockNumber))!.timestamp);

describe("Kod incelemesi 2026-11-11 — kontrat bulgusu", function () {
  this.timeout(120_000);

  describe("G1: NETWORK_SCHEMA önerisi — başlangıç yürütme anına göre", () => {
    const propose = async (f: Fixture, vct: string, validFrom: number) =>
      proposalId(
        await f
          .as(f.governance, f.trValidator)
          .proposeNetworkSchema({ ...f.schemaRecord(vct, SchemaTier.NETWORK, "0x0000"), validFrom }),
        f,
      );

    it("validFrom = öneri anı: oylama sürerken geçmişte kalır, yürütme yine geçer ve başlangıç yürütme anıdır", async () => {
      const f = await loadFixture();
      const VCT = "urn:tamga:edu:NowCredential:1";
      const t = await f.now();
      const pid = await propose(f, VCT, t);
      await pass(f, pid);
      await networkHelpers.time.increase(3 * DAY); // oylama günler sürer
      const rc = await (await f.governance.execute(pid)).wait();
      const s = await f.schemas.getSchema(id(VCT));
      const at = await blockTime(rc);
      expect(Number(s.validFrom)).to.equal(at);
      expect(Number(s.validFrom)).to.be.greaterThan(t);
      expect(await f.schemas.isActiveSchema(id(VCT))).to.equal(true);
      // kip dışında ilk pencere başlangıçsızdır (öteki kayıtlarla aynı)
      expect(await f.schemas.isSchemaAcceptableAt(id(VCT), at)).to.equal(true);
    });

    it("oylama sırasında geçecek yakın tarih de yürütmeyi kilitlemez", async () => {
      const f = await loadFixture();
      const VCT = "urn:tamga:edu:SoonCredential:1";
      const pid = await propose(f, VCT, (await f.now()) + DAY);
      await pass(f, pid);
      await networkHelpers.time.increase(2 * DAY);
      const rc = await (await f.governance.execute(pid)).wait();
      expect(Number((await f.schemas.getSchema(id(VCT))).validFrom)).to.equal(await blockTime(rc));
    });

    it("yürütmede hâlâ ileride olan tarih aynen yazılır; 0 blok zamanıdır", async () => {
      const f = await loadFixture();
      const FUTURE = "urn:tamga:edu:FutureCredential:1";
      const ZERO_VCT = "urn:tamga:edu:ZeroCredential:1";
      const later = (await f.now()) + 20 * DAY;
      const p1 = await propose(f, FUTURE, later);
      const p2 = await propose(f, ZERO_VCT, 0);
      await pass(f, p1);
      await pass(f, p2);
      await networkHelpers.time.increase(DAY);
      await (await f.governance.execute(p1)).wait();
      const rc = await (await f.governance.execute(p2)).wait();
      expect(Number((await f.schemas.getSchema(id(FUTURE))).validFrom)).to.equal(later);
      expect(await f.schemas.isActiveSchema(id(FUTURE))).to.equal(false); // başlangıcı gelmedi
      expect(Number((await f.schemas.getSchema(id(ZERO_VCT))).validFrom)).to.equal(await blockTime(rc));
    });

    it("göç kipinde geçmiş tarih aynen yazılır (ADR-0073 K1: listedeki ilk durum anı)", async () => {
      const f = await loadFixture();
      const VCT = "urn:tamga:edu:MigratedCredential:1";
      const g = f.as(f.governance, f.trValidator);
      const open = await proposalId(
        await g.proposeMigrationOpen(await f.schemas.getAddress(), PLAN, 7 * DAY, ethers.ZeroAddress),
        f,
      );
      await pass(f, open);
      await (await f.governance.execute(open)).wait();
      const past = (await f.now()) - 10 * DAY;
      const pid = await propose(f, VCT, past);
      await pass(f, pid);
      await (await f.governance.execute(pid)).wait();
      expect(Number((await f.schemas.getSchema(id(VCT))).validFrom)).to.equal(past);
      expect(await f.schemas.isSchemaAcceptableAt(id(VCT), past)).to.equal(true);
      expect(await f.schemas.isSchemaAcceptableAt(id(VCT), past - 1)).to.equal(false);
    });

    it("ulusal kayıtta kural değişmedi: kip dışında geçmiş tarih yine reddedilir", async () => {
      const f = await loadFixture();
      const VCT = "urn:tamga:tr:edu:PastCredential:1";
      const past = (await f.now()) - 1000;
      await expect(
        f
          .as(f.schemas, f.trDelegate)
          .registerSchema({ ...f.schemaRecord(VCT, SchemaTier.NATIONAL, TR), validFrom: past }),
      )
        .to.be.revertedWithCustomError(f.schemas, "PastDateOutsideMigration")
        .withArgs(past);
    });
  });
});
