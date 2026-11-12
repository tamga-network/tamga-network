/**
 * Kontrat denetimi 2026-11-11 — Governance bulguları, süreç içi Hardhat zincirinde (her biri düzeltmeden önce kırmızı görüldü):
 *   - Y1 : yükseltme önerisi yeni implementasyonun kod özetini sabitler; adresteki kod değişirse yürütme
 *          `UpgradeImplementationChanged` ile düşer. Zincir Cancun kural setindedir (ADR-0077): bulgunun dayandığı yol
 *          (CREATE2 + SELFDESTRUCT ile aynı adrese başka kod) EIP-6780 ile kapalıdır; bu da ayrıca sınanır.
 *   - Y2 : `initialize` sıfır devlet kodunu ve tek kurucuyu reddeder (ADR-0076 GC4). İki üyeli ağda tek taraflı çıkış reddedilir (`TooFewMembers`,
 *          ADR-0076 GC1): tek üye kalsaydı yönetişim kalıcı kilitlenirdi. Çıkmak isteyen üye üçüncü üyenin kabulünden
 *          sonra çekilir.
 *   - O2 : öneri yükleri zincirden okunur (`getSchemaPayload`, `upgradePayloadOf`, `removalReasonOf`).
 * Kayıt kontratlarının bulguları: review-2026-11-11-registries.test.ts.
 */
import { expect } from "chai";

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
const UZ = stateCode(ethers, "UZ");
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
    /** Üç kuruculu ağ + CREATE2 fabrikasıyla dağıtılmış "incelenen" implementasyon; öneri oylanmış ve kuyruğa alınmıştır. */
    async function queuedUpgrade() {
      const [deployer, tr, kz, az] = await ethers.getSigners();
      const d = await deployTrustLayer(
        ethers,
        deployer,
        [
          { code: "TR", validator: await tr.getAddress() },
          { code: "KZ", validator: await kz.getAddress() },
          { code: "AZ", validator: await az.getAddress() },
        ],
        tr,
      );
      const gov = d.governance as any;
      const factory = (await ethers.deployContract("MetamorphicFactoryMock")) as any;
      const reviewed = await ethers.deployContract("ReviewedImplMock");
      const swapped = await ethers.deployContract("SwappedImplMock");
      const salt = id("impl-v2");
      const reviewedCode = await ethers.provider.getCode(await reviewed.getAddress());
      const swappedCode = await ethers.provider.getCode(await swapped.getAddress());
      const implAddr: string = await factory.deploy.staticCall(salt, reviewedCode);
      await (await factory.deploy(salt, reviewedCode)).wait();
      const reviewedHash = ethers.keccak256(await ethers.provider.getCode(implAddr));

      // Öneri incelenen kodla açılır, 2/3 oy alır, kuyruğa girer.
      const target = await d.issuers.getAddress();
      const pid = await proposalIdOf(await gov.connect(tr).proposeProtocolUpgrade(target, implAddr), gov);
      await (await gov.connect(tr).vote(pid, true)).wait();
      await (await gov.connect(kz).vote(pid, true)).wait();
      await (await gov.execute(pid)).wait(); // kuyruk
      return { gov, factory, salt, implAddr, reviewedCode, swappedCode, reviewedHash, target, pid };
    }

    it("oylamadan sonra implementasyon adresindeki kod değişirse yükseltme uygulanmaz (kod özeti denetimi)", async () => {
      // Denetimin kendisi kural setinden bağımsızdır. Cancun'da (ADR-0077) kodu zincir içinden değiştirmenin bilinen yolu
      // kalmadığı için kod burada test düğümünün kancasıyla (`hardhat_setCode`) değiştirilir.
      const q = await queuedUpgrade();
      await networkHelpers.setCode(q.implAddr, q.swappedCode);
      expect(ethers.keccak256(await ethers.provider.getCode(q.implAddr))).to.not.equal(q.reviewedHash);

      await networkHelpers.time.increase(7 * DAY + 1);
      await expect(q.gov.execute(q.pid))
        .to.be.revertedWithCustomError(q.gov, "UpgradeImplementationChanged")
        .withArgs(q.implAddr);
      // kayıt eski implementasyonda kaldı; öneri oylanan kodun özetini taşımayı sürdürür
      await expect(((await ethers.getContractAt("SwappedImplMock", q.target)) as any).backdoor()).to.be.revert(ethers);
      expect((await q.gov.upgradePayloadOf(q.pid)).implCodehash).to.equal(q.reviewedHash);
    });

    it("kuyruğa alınmadan önce de kod değişmişse öneri kuyruğa girmez", async () => {
      const f = await loadFixture();
      const impl = await ethers.deployContract("IssuerRegistry");
      const implAddr = await impl.getAddress();
      const pid = await proposalId(
        await f.as(f.governance, f.trValidator).proposeProtocolUpgrade(await f.issuers.getAddress(), implAddr),
        f,
      );
      await pass(f, pid);
      const other = await ethers.deployContract("SchemaRegistry");
      await networkHelpers.setCode(implAddr, await ethers.provider.getCode(await other.getAddress()));
      await expect(f.governance.execute(pid))
        .to.be.revertedWithCustomError(f.governance, "UpgradeImplementationChanged")
        .withArgs(implAddr);
      expect(await f.governance.executableAt(pid)).to.equal(0);
    });

    it("Cancun (ADR-0077): SELFDESTRUCT kodu silmez; aynı adrese başka kod konamaz (EIP-6780)", async () => {
      // Shanghai'de bu yol açıktı: implementasyon kendini siler, aynı tuzla (CREATE2) aynı adrese başka kod konurdu.
      const q = await queuedUpgrade();
      await (await ((await ethers.getContractAt("ReviewedImplMock", q.implAddr)) as any).retire()).wait();
      expect(await ethers.provider.getCode(q.implAddr)).to.equal(q.reviewedCode); // kod yerinde
      // adres dolu: aynı tuzla yeniden dağıtım çarpışır
      await expect(q.factory.deploy(q.salt, q.swappedCode)).to.be.revert(ethers);
      expect(ethers.keccak256(await ethers.provider.getCode(q.implAddr))).to.equal(q.reviewedHash);

      // kod değişmediği için kod özeti denetimi geçer: bekleme dolunca yükseltme uygulanır
      await networkHelpers.time.increase(7 * DAY + 1);
      await expect(q.gov.execute(q.pid)).to.emit(q.gov, "ProposalExecuted").withArgs(q.pid);
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
      const data = impl.interface.encodeFunctionData("initialize", [
        ["0x0000", stateCode(ethers, "KZ")],
        [await v.getAddress(), ethers.Wallet.createRandom().address],
      ]);
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

    it("ADR-0076 GC1: üç üyeden biri çekilir (3 → 2); iki üyeli ağda çıkış reddedilir, yönetişim çalışmaya devam eder", async () => {
      const f = await loadFixture();
      await expect(f.as(f.governance, f.azValidator).withdraw()) // 3 → 2: serbest, oy gerekmez (ADR-0002 #5)
        .to.emit(f.governance, "StateWithdrawn")
        .withArgs(AZ);
      expect(await f.governance.activeMemberCount()).to.equal(2);
      // 2 → 1: iki üyeden hiçbiri tek taraflı çekilemez
      for (const v of [f.kzValidator, f.trValidator]) {
        await expect(f.as(f.governance, v).withdraw())
          .to.be.revertedWithCustomError(f.governance, "TooFewMembers")
          .withArgs(2, 3);
      }
      expect(await f.governance.activeMemberCount()).to.equal(2);
      expect(await f.governance.requiredVotes("0x0000")).to.equal(2); // asgari mutlak oy: iki üye birlikte karar alır
    });

    it("ADR-0076 GC1: iki üyeli ağda çıkmak isteyen üye, üçüncü üyenin kabulünden sonra çekilir", async () => {
      const f = await loadFixture();
      await (await f.as(f.governance, f.azValidator).withdraw()).wait(); // geriye TR + KZ
      const tr = f.as(f.governance, f.trValidator);
      const kz = f.as(f.governance, f.kzValidator);
      await expect(kz.withdraw()).to.be.revertedWithCustomError(f.governance, "TooFewMembers");
      // üçüncü üye iki üyenin oyuyla kabul edilir
      const pid = await proposalId(await tr.proposeStateAdmission(UZ, await f.stranger.getAddress()), f);
      await (await tr.vote(pid, true)).wait();
      await (await kz.vote(pid, true)).wait();
      await (await f.governance.execute(pid)).wait();
      expect(await f.governance.activeMemberCount()).to.equal(3);
      // şimdi çıkış serbest; kalan iki üye yönetişimi sürdürür
      await expect(kz.withdraw()).to.emit(f.governance, "StateWithdrawn").withArgs(KZ);
      expect(await f.governance.activeMemberCount()).to.equal(2);
      expect(await f.governance.isActiveMember(KZ)).to.equal(false);
      const again = await proposalId(await tr.proposeStateAdmission(KZ, await f.kzValidator.getAddress()), f);
      await (await tr.vote(again, true)).wait();
      await (await f.as(f.governance, f.stranger).vote(again, true)).wait();
      await expect(f.governance.execute(again)).to.emit(f.governance, "ProposalExecuted").withArgs(again);
    });

    it("ADR-0076 GC4: kuruluş en az iki kurucu ister; tek kurucu ve boş liste reddedilir", async () => {
      const impl = await ethers.deployContract("Governance");
      const [, v, w] = await ethers.getSigners();
      const cases: [string[], string[]][] = [
        [[], []],
        [[stateCode(ethers, "TR")], [await v.getAddress()]],
        [[stateCode(ethers, "TR"), KZ], [await v.getAddress()]], // uzunluklar tutmuyor
      ];
      for (const [codes, validators] of cases) {
        const data = impl.interface.encodeFunctionData("initialize", [codes, validators]);
        await expect(
          ethers.deployContract("ERC1967Proxy", [await impl.getAddress(), data]),
        ).to.be.revertedWithCustomError(impl, "FounderMismatch");
      }
      // iki kurucu: kuruluş geçer, ağ ilk bloktan karar alabilir (asgari mutlak oy 2)
      const data = impl.interface.encodeFunctionData("initialize", [
        [stateCode(ethers, "TR"), KZ],
        [await v.getAddress(), await w.getAddress()],
      ]);
      const proxy = await ethers.deployContract("ERC1967Proxy", [await impl.getAddress(), data]);
      const g = impl.attach(await proxy.getAddress()) as any;
      expect(await g.activeMemberCount()).to.equal(2);
      expect(await g.requiredVotes("0x0000")).to.equal(2);
      // iki kuruculu ağda hiçbiri tek taraflı çekilemez (GC1)
      await expect(g.connect(v).withdraw()).to.be.revertedWithCustomError(impl, "TooFewMembers").withArgs(2, 3);
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
