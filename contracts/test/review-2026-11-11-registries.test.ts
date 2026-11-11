/**
 * Kontrat denetimi 2026-11-11 — kayıt kontratı bulguları, süreç içi Hardhat zincirinde (her biri düzeltmeden önce kırmızı görüldü):
 *   - O1 : göç yürütücüsü yalnız kendi yazdığı (yeniden oynatılan) ağ şemasını deprecate eder; Governance'ın kaydettiği ağ
 *          şemasında deprecate yalnız Governance'tadır.
 *   - D1 : C2'nin şema adımı `iat ≥ validFrom` ister; yetki kayıtsız şemaya verilemez.
 *   - D2 : yazıcı çıkarma, yazıcı sayısını eşiğin altına düşürüyorsa reddedilir.
 *   - D3 : göç penceresi açıkken ileri tarihli şema başlangıcı yazılır (durum anı blok zamanıdır).
 * Governance bulguları: review-2026-11-11-governance.test.ts.
 */
import { expect } from "chai";

import { DAY, SchemaStatus, SchemaTier, TR, ZERO, ethers, id, loadFixture, type Fixture } from "./helpers/fixture.js";

const PLAN = id("plan-2026-11-11-contracts");

async function proposalIdOf(tx: any, governance: any): Promise<string> {
  const rc = await tx.wait();
  for (const l of rc.logs) {
    try {
      const e = governance.interface.parseLog(l);
      if (e?.name === "ProposalCreated") return e.args.id;
    } catch {
      /* başka kontrat */
    }
  }
  throw new Error("ProposalCreated yok");
}
const proposalId = (tx: any, f: Fixture) => proposalIdOf(tx, f.governance);
async function pass(f: Fixture, pid: string) {
  await (await f.as(f.governance, f.trValidator).vote(pid, true)).wait();
  await (await f.as(f.governance, f.kzValidator).vote(pid, true)).wait();
}
async function passAndExecute(f: Fixture, pid: string) {
  await pass(f, pid);
  return (await f.governance.execute(pid)).wait();
}
async function openMigration(f: Fixture, registry: any, executor: string, window = 7 * DAY) {
  const pid = await proposalId(
    await f.as(f.governance, f.trValidator).proposeMigrationOpen(await registry.getAddress(), PLAN, window, executor),
    f,
  );
  await passAndExecute(f, pid);
}
const networkSchema = async (f: Fixture, vct: string, validFrom = 0) =>
  proposalId(
    await f
      .as(f.governance, f.trValidator)
      .proposeNetworkSchema({ ...f.schemaRecord(vct, SchemaTier.NETWORK, "0x0000"), validFrom }),
    f,
  );
describe("Kontrat denetimi 2026-11-11 — kayıt kontratları", function () {
  this.timeout(180_000);

  describe("O1: göç yürütücüsü ve ağ şemasının deprecate'i", () => {
    it("Governance'ın kaydettiği ağ şemasını yürütücü geri tarihle öldüremez; Governance deprecate eder", async () => {
      const f = await loadFixture();
      const VCT = "urn:tamga:edu:LiveCredential:1";
      await passAndExecute(f, await networkSchema(f, VCT));
      const sid = id(VCT);
      const issuedAt = await f.now();
      await openMigration(f, f.schemas, await f.stranger.getAddress());

      const ex = f.as(f.schemas, f.stranger);
      await expect(ex.deprecateSchemaAt(sid, ZERO, 1)).to.be.revertedWithCustomError(
        f.schemas,
        "NetworkTierRequiresGovernance",
      );
      await expect(ex.deprecateSchemaAt(sid, ZERO, issuedAt)).to.be.revertedWithCustomError(
        f.schemas,
        "NetworkTierRequiresGovernance",
      );
      expect(await f.schemas.isSchemaAcceptableAt(sid, issuedAt)).to.equal(true);

      const dep = await proposalId(
        await f.as(f.governance, f.trValidator).proposeNetworkSchemaDeprecation(sid, ZERO),
        f,
      );
      await passAndExecute(f, dep);
      expect((await f.schemas.getSchema(sid)).status).to.equal(BigInt(SchemaStatus.DEPRECATED));
      expect(await f.schemas.isSchemaAcceptableAt(sid, issuedAt)).to.equal(true); // öncesi geçerli (SC3)
    });

    it("yürütücü kendi yeniden oynattığı ağ şemasını listedeki tarihle deprecate eder (ADR-0073 K1)", async () => {
      const f = await loadFixture();
      const VCT = "urn:tamga:edu:ReplayedCredential:1";
      await openMigration(f, f.schemas, await f.stranger.getAddress());
      const ex = f.as(f.schemas, f.stranger);
      const t = await f.now();
      await (
        await ex.registerSchema({ ...f.schemaRecord(VCT, SchemaTier.NETWORK, "0x0000"), validFrom: t - 30 * DAY })
      ).wait();
      await (await ex.deprecateSchemaAt(id(VCT), ZERO, t - 10 * DAY)).wait();
      expect(await f.schemas.isSchemaAcceptableAt(id(VCT), t - 20 * DAY)).to.equal(true);
      expect(await f.schemas.isSchemaAcceptableAt(id(VCT), t - 10 * DAY)).to.equal(false);
    });
  });

  describe("D1: şema başlangıcı ve yetki", () => {
    it("C2'nin şema adımı: başlangıcından (validFrom) önce verilmiş belge kabul edilmez", async () => {
      const f = await loadFixture();
      const VCT = "urn:tamga:tr:edu:LaterCredential:1";
      const t = await f.now();
      const from = t + 10 * DAY;
      await (
        await f
          .as(f.schemas, f.trDelegate)
          .registerSchema({ ...f.schemaRecord(VCT, SchemaTier.NATIONAL, TR), validFrom: from })
      ).wait();
      const sid = id(VCT);
      await (await f.as(f.issuers, f.trDelegate).setSchemaAuthorization(f.uniIssuer, sid, true)).wait();
      const authAt = await f.now();
      expect(await f.schemas.isSchemaAcceptableAt(sid, authAt)).to.equal(false);
      expect(await f.schemas.isSchemaAcceptableAt(sid, from - 1)).to.equal(false);
      expect(await f.schemas.isSchemaAcceptableAt(sid, from)).to.equal(true);
      expect(await f.issuers.isCredentialSchemaAcceptable(f.uniIssuer, sid, from - 1)).to.equal(false);
      expect(await f.issuers.isCredentialSchemaAcceptable(f.uniIssuer, sid, from)).to.equal(true);
    });

    it("yetki kayıtsız şemaya verilemez; geri alma kayıt aramaz", async () => {
      const f = await loadFixture();
      const ghost = id("urn:tamga:tr:edu:GhostCredential:1");
      await expect(f.as(f.issuers, f.trDelegate).setSchemaAuthorization(f.uniIssuer, ghost, true))
        .to.be.revertedWithCustomError(f.schemas, "UnknownSchema")
        .withArgs(ghost);
      const sid = await f.registerNationalSchema(TR, f.trDelegate, "urn:tamga:tr:edu:RealCredential:1", id("m"));
      const i = f.as(f.issuers, f.trDelegate);
      await (await i.setSchemaAuthorization(f.uniIssuer, sid, true)).wait();
      await (await i.setSchemaAuthorization(f.uniIssuer, sid, false)).wait();
      expect((await f.issuers.schemaAuthOf(f.uniIssuer, sid)).allowed).to.equal(false);
    });
  });

  describe("D2: liste çapası kaydı — eşik yazıcı sayısını aşamaz", () => {
    it("yazıcı çıkarma eşiğin altına düşürüyorsa reddedilir; önce eşik düşürülür", async () => {
      const [gov, a1, a2] = await ethers.getSigners();
      const impl = await ethers.deployContract("TrustListAnchorRegistry");
      const data = impl.interface.encodeFunctionData("initialize", [
        await gov.getAddress(),
        [await a1.getAddress(), await a2.getAddress()],
        2,
      ]);
      const proxy = await ethers.deployContract("ERC1967Proxy", [await impl.getAddress(), data]);
      const reg = await ethers.getContractAt("TrustListAnchorRegistry", await proxy.getAddress());
      await expect(reg.setAnchorer(await a2.getAddress(), false))
        .to.be.revertedWithCustomError(reg, "InvalidThreshold")
        .withArgs(2);
      expect(await reg.anchorerCount()).to.equal(2);
      await (await reg.setRequiredConfirmations(1)).wait();
      await (await reg.setAnchorer(await a2.getAddress(), false)).wait();
      expect(await reg.anchorerCount()).to.equal(1);
      // son yazıcı da eşik 1 iken çıkarılamaz
      await expect(reg.setAnchorer(await a1.getAddress(), false))
        .to.be.revertedWithCustomError(reg, "InvalidThreshold")
        .withArgs(1);
    });
  });

  describe("D3: göç penceresi açıkken ileri tarihli şema başlangıcı", () => {
    it("ağ şeması önerisi yürür; başlangıç aynen yazılır, durum anı blok zamanıdır", async () => {
      const f = await loadFixture();
      const VCT = "urn:tamga:edu:PlannedCredential:1";
      await openMigration(f, f.schemas, ethers.ZeroAddress);
      const later = (await f.now()) + 20 * DAY;
      const pid = await networkSchema(f, VCT, later);
      await pass(f, pid);
      const rc = await (await f.governance.execute(pid)).wait();
      const at = Number((await ethers.provider.getBlock(rc!.blockNumber))!.timestamp);
      const sid = id(VCT);
      expect(Number((await f.schemas.getSchema(sid)).validFrom)).to.equal(later);
      const h = await f.schemas.schemaStatusHistoryOf(sid);
      expect(Number(h[0].since)).to.equal(at); // hiçbir durum anı blok zamanından ileri değil (CE1)
      expect(await f.schemas.isActiveSchema(sid)).to.equal(false);
      expect(await f.schemas.isSchemaAcceptableAt(sid, later - 1)).to.equal(false);
      expect(await f.schemas.isSchemaAcceptableAt(sid, later)).to.equal(true);
    });

    it("ulusal şemada da aynı; geçmiş tarihli başlangıç listedeki ilk durum anı olarak yazılır (değişmedi)", async () => {
      const f = await loadFixture();
      await openMigration(f, f.schemas, ethers.ZeroAddress);
      const t = await f.now();
      const s = f.as(f.schemas, f.trDelegate);
      const FUT = "urn:tamga:tr:edu:PlannedCredential:1";
      const PAST = "urn:tamga:tr:edu:OldCredential:1";
      await (
        await s.registerSchema({ ...f.schemaRecord(FUT, SchemaTier.NATIONAL, TR), validFrom: t + 5 * DAY })
      ).wait();
      await (
        await s.registerSchema({ ...f.schemaRecord(PAST, SchemaTier.NATIONAL, TR), validFrom: t - 5 * DAY })
      ).wait();
      expect(Number((await f.schemas.getSchema(id(FUT))).validFrom)).to.equal(t + 5 * DAY);
      expect(Number((await f.schemas.schemaStatusHistoryOf(id(PAST)))[0].since)).to.equal(t - 5 * DAY);
      expect(await f.schemas.isSchemaAcceptableAt(id(PAST), t - 5 * DAY)).to.equal(true);
      expect(await f.schemas.isSchemaAcceptableAt(id(PAST), t - 5 * DAY - 1)).to.equal(false);
    });
  });
});
