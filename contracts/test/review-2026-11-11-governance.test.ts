/**
 * Kontrat denetimi 2026-11-11 — Governance bulguları, süreç içi Hardhat zincirinde (her biri düzeltmeden önce kırmızı görüldü):
 *   - Y1 : yükseltme önerisi yeni implementasyonun kod özetini sabitler; aynı adrese başka kod konursa (CREATE2 +
 *          SELFDESTRUCT, Shanghai kuralları) yürütme `UpgradeImplementationChanged` ile düşer.
 *   - Y2 : `initialize` sıfır devlet kodunu reddeder. İki üyeden birinin çekilmesiyle yönetişimin kilitlenmesi AÇIK
 *          (kapatılmış kararlara dokunur: ADR-0002 #5, şartname §1 — karar taslağı ADR-0076, Proposed); test bugünkü davranışı
 *          kayda geçirir.
 *   - O2 : öneri yükleri zincirden okunur (`getSchemaPayload`, `upgradePayloadOf`, `removalReasonOf`).
 * Kayıt kontratlarının bulguları: review-2026-11-11-registries.test.ts.
 */
import { expect } from "chai";
import { network } from "hardhat";

import { deployTrustLayer, stateCode } from "../scripts/lib/deploy.js";
import {
  AZ,
  DAY,
  KZ,
  SchemaTier,
  ZERO,
  ethers,
  id,
  loadFixture,
  networkHelpers,
  type Fixture,
} from "./helpers/fixture.js";

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
const networkSchema = async (f: Fixture, vct: string, validFrom = 0) =>
  proposalId(
    await f
      .as(f.governance, f.trValidator)
      .proposeNetworkSchema({ ...f.schemaRecord(vct, SchemaTier.NETWORK, "0x0000"), validFrom }),
    f,
  );
describe("Kontrat denetimi 2026-11-11 — Governance", function () {
  this.timeout(180_000);

  describe("Y1: yükseltme önerisi implementasyon kodunu sabitler", () => {
    it("oylamadan sonra aynı adrese başka kod konursa yükseltme uygulanmaz (Shanghai: CREATE2 + SELFDESTRUCT)", async () => {
      // Zincirle aynı kurallar: Shanghai'de SELFDESTRUCT kodu siler (Cancun'dan itibaren silmez).
      const c = await network.create({ override: { hardfork: "shanghai" } });
      const e = c.ethers;
      const [deployer, tr, kz, az] = await e.getSigners();
      const d = await deployTrustLayer(
        e,
        deployer,
        [
          { code: "TR", validator: await tr.getAddress() },
          { code: "KZ", validator: await kz.getAddress() },
          { code: "AZ", validator: await az.getAddress() },
        ],
        tr,
      );
      const gov = d.governance as any;
      const factory = (await e.deployContract("MetamorphicFactoryMock")) as any;
      const reviewed = await e.deployContract("ReviewedImplMock");
      const swapped = await e.deployContract("SwappedImplMock");
      const salt = id("impl-v2");
      const reviewedCode = await e.provider.getCode(await reviewed.getAddress());
      const implAddr: string = await factory.deploy.staticCall(salt, reviewedCode);
      await (await factory.deploy(salt, reviewedCode)).wait();
      const reviewedHash = e.keccak256(await e.provider.getCode(implAddr));

      // Öneri incelenen kodla açılır, 2/3 oy alır, kuyruğa girer.
      const target = await d.issuers.getAddress();
      const pid = await proposalIdOf(await gov.connect(tr).proposeProtocolUpgrade(target, implAddr), gov);
      await (await gov.connect(tr).vote(pid, true)).wait();
      await (await gov.connect(kz).vote(pid, true)).wait();
      await (await gov.execute(pid)).wait(); // kuyruk

      // Bekleme sürerken implementasyon kendini siler ve aynı adrese başka kod konur.
      await (await ((await e.getContractAt("ReviewedImplMock", implAddr)) as any).retire()).wait();
      expect(await e.provider.getCode(implAddr)).to.equal("0x");
      await (await factory.deploy(salt, await e.provider.getCode(await swapped.getAddress()))).wait();
      expect(e.keccak256(await e.provider.getCode(implAddr))).to.not.equal(reviewedHash);

      await c.networkHelpers.time.increase(7 * DAY + 1);
      await expect(gov.execute(pid))
        .to.be.revertedWithCustomError(gov, "UpgradeImplementationChanged")
        .withArgs(implAddr);
      // kayıt eski implementasyonda kaldı
      await expect(((await e.getContractAt("SwappedImplMock", target)) as any).backdoor()).to.be.revert(e);
      expect((await gov.upgradePayloadOf(pid)).implCodehash).to.equal(reviewedHash);
    });

    it("kod değişmediyse yükseltme uygulanır; öneri kod özetini ve başlangıç seçicisini taşır", async () => {
      const f = await loadFixture();
      const impl = await ethers.deployContract("IssuerRegistry");
      const pid = await proposalId(
        await f
          .as(f.governance, f.trValidator)
          .proposeProtocolUpgrade(await f.issuers.getAddress(), await impl.getAddress()),
        f,
      );
      const payload = await (f.governance as any).upgradePayloadOf(pid);
      expect(payload.implCodehash).to.equal(ethers.keccak256(await ethers.provider.getCode(await impl.getAddress())));
      expect(payload.initSelector).to.equal("0x00000000");
      await passAndExecute(f, pid);
      await networkHelpers.time.increase(7 * DAY + 1);
      await expect(f.governance.execute(pid)).to.emit(f.governance, "ProposalExecuted").withArgs(pid);
    });
  });

  describe("Y2: kuruluş ve iki üyeli ağ", () => {
    it("initialize sıfır devlet kodunu reddeder", async () => {
      const impl = await ethers.deployContract("Governance");
      const [, v] = await ethers.getSigners();
      const data = impl.interface.encodeFunctionData("initialize", [["0x0000"], [await v.getAddress()]]);
      await expect(
        ethers.deployContract("ERC1967Proxy", [await impl.getAddress(), data]),
      ).to.be.revertedWithCustomError(impl, "ZeroAddress");
      const mixed = impl.interface.encodeFunctionData("initialize", [
        [stateCode(ethers, "TR"), "0x0000"],
        [await v.getAddress(), ethers.Wallet.createRandom().address],
      ]);
      await expect(
        ethers.deployContract("ERC1967Proxy", [await impl.getAddress(), mixed]),
      ).to.be.revertedWithCustomError(impl, "ZeroAddress");
    });

    it("AÇIK (ADR-0076 taslağı): iki üyeden biri çekilince kalan üye hiçbir öneriyi yürütemez", async () => {
      const f = await loadFixture();
      await (await f.as(f.governance, f.azValidator).withdraw()).wait();
      await (await f.as(f.governance, f.kzValidator).withdraw()).wait(); // 2 → 1: bugün serbest (ADR-0002 #5, şartname §1)
      expect(await f.governance.activeMemberCount()).to.equal(1);
      expect(await f.governance.requiredVotes("0x0000")).to.equal(2); // asgari mutlak oy
      const g = f.as(f.governance, f.trValidator);
      const pid = await proposalId(await g.proposeStateAdmission(KZ, await f.stranger.getAddress()), f);
      await (await g.vote(pid, true)).wait();
      await expect(f.governance.execute(pid))
        .to.be.revertedWithCustomError(f.governance, "ThresholdNotMet")
        .withArgs(1, 2);
      // son üye çekilemez de: ağ bu noktadan çıkamaz
      await expect(g.withdraw()).to.be.revertedWithCustomError(f.governance, "LastValidator");
      expect(await f.governance.isActiveMember(AZ)).to.equal(false);
    });
  });

  describe("O2: öneri yükleri zincirden okunur", () => {
    it("ağ şeması yükü, yükseltme başlangıç seçicisi ve çıkarma gerekçesi", async () => {
      const f = await loadFixture();
      const g = f.as(f.governance, f.trValidator) as any;
      const VCT = "urn:tamga:edu:ReadableCredential:1";
      const later = (await f.now()) + 40 * DAY;
      const sp = await networkSchema(f, VCT, later);
      const rec = await g.getSchemaPayload(sp);
      expect(rec.vctURI).to.equal(VCT);
      expect(rec.contentHash).to.equal(id("meta"));
      expect(rec.version).to.equal("1.0.0");
      expect(rec.tier).to.equal(BigInt(SchemaTier.NETWORK));
      expect(Number(rec.validFrom)).to.equal(later);

      const impl = await ethers.deployContract("IssuerRegistry");
      const sel = impl.interface.getFunction("proxiableUUID")!.selector;
      const up = await proposalId(
        await g.proposeProtocolUpgradeAndInit(await f.issuers.getAddress(), await impl.getAddress(), sel),
        f,
      );
      expect((await g.upgradePayloadOf(up)).initSelector).to.equal(sel);

      const rm = await proposalId(await g.proposeStateRemoval(AZ, id("gerekçe")), f);
      expect(await g.removalReasonOf(rm)).to.equal(id("gerekçe"));
      // başka türde öneri için boş döner
      expect(await g.removalReasonOf(sp)).to.equal(ZERO);
      expect((await g.getSchemaPayload(rm)).vctURI).to.equal("");
    });
  });
});
