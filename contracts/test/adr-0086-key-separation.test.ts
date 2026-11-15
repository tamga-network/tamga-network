/**
 * ADR-0086 — yönetişim (oy) anahtarı ile düğüm (uzlaşma) anahtarının ayrılması, süreç içi Hardhat zincirinde:
 *   - KG1: üye kaydında iki adres; ikisi farklı; bir adres tek devlette tek rolde (`ValidatorInUse`, `KeyInUse`);
 *   - KG2: düğüm anahtarının zincirde yetkisi yok (öneri, oy, delege listesi, çıkış → `NotGovernor`);
 *   - KG3: düğüm adresini üye kendi yönetişim anahtarıyla değiştirir (oy yok); bırakılan adres başka devlete geçmez;
 *   - KG4: yönetişim anahtarı yalnız Governance oyuyla değişir (2/3, asgari 2) ve değişen üyenin bugünkü anahtarla verdiği
 *          destek oyu şarttır; eski anahtarın yetkisi ve açık önerilerdeki oyları düşer; yürütmede yeniden denetlenir;
 *   - KG5: iki üyeli ağda anahtar değişikliği iki üyenin oyunu ister (ADR-0076 ile uyum).
 */
import { expect } from "chai";
import type { Signer } from "ethers";

import { deployTrustLayer, stateCode } from "../scripts/lib/deploy.js";
import { AZ, KZ, TR, ZERO, ethers, id, loadFixture, nodeOf, type Fixture } from "./helpers/fixture.js";

const UZ = stateCode(ethers, "UZ");

async function proposalId(tx: any, f: { governance: any }): Promise<string> {
  const rc = await (await tx).wait();
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

describe("ADR-0086 — yönetişim ve düğüm anahtarı ayrımı", function () {
  let f: Fixture;
  let trNodeSigner: Signer;
  let spare: Signer;
  let spare2: Signer;

  beforeEach(async () => {
    f = await loadFixture();
    const s = await ethers.getSigners();
    trNodeSigner = s[17]; // fikstürde TR'nin düğüm adresi
    spare = s[12];
    spare2 = s[13];
    expect(await trNodeSigner.getAddress()).to.equal(f.trNode);
  });

  describe("KG1 — üye kaydında iki adres", () => {
    it("getMember iki adresi ve bağlanma anını taşır; StateAdmitted ikisini de yayar", async () => {
      const m = await f.governance.getMember(TR);
      expect(m.validatorAddress).to.equal(f.trNode);
      expect(m.governanceAddress).to.equal(await f.trGov.getAddress());
      expect(m.governanceSince).to.equal(m.joinedAt);
      const fresh = await spare.getAddress();
      const pid = await proposalId(
        (f.as(f.governance, f.trGov) as any).proposeStateAdmission(UZ, nodeOf(fresh), fresh),
        f,
      );
      expect((await f.governance.getProposal(pid)).governanceAddress).to.equal(fresh);
      await (await f.as(f.governance, f.kzGov).vote(pid, true)).wait();
      await (await f.as(f.governance, f.trGov).vote(pid, true)).wait();
      await expect(f.governance.execute(pid)).to.emit(f.governance, "StateAdmitted").withArgs(UZ, nodeOf(fresh), fresh);
    });

    it("düğüm = yönetişim reddedilir; öteki rolde kullanılmış adres reddedilir", async () => {
      const fresh = await spare.getAddress();
      const g = f.as(f.governance, f.trGov) as any;
      await expect(g.proposeStateAdmission(UZ, fresh, fresh)).to.be.revertedWithCustomError(f.governance, "KeyInUse");
      // KZ'nin yönetişim anahtarı UZ'nin düğüm adresi olamaz (rol çaprazı)
      await expect(g.proposeStateAdmission(UZ, await f.kzGov.getAddress(), fresh))
        .to.be.revertedWithCustomError(f.governance, "KeyInUse")
        .withArgs(await f.kzGov.getAddress(), KZ);
      // KZ'nin düğüm adresi UZ'nin yönetişim anahtarı olamaz
      await expect(g.proposeStateAdmission(UZ, nodeOf(fresh), f.kzNode))
        .to.be.revertedWithCustomError(f.governance, "KeyInUse")
        .withArgs(f.kzNode, KZ);
      await expect(g.proposeStateAdmission(UZ, ethers.ZeroAddress, fresh)).to.be.revertedWithCustomError(
        f.governance,
        "ZeroAddress",
      );
    });

    it("initialize: düğüm = yönetişim ve eksik yönetişim listesi reddedilir", async () => {
      const impl = await ethers.deployContract("Governance");
      const a = await spare.getAddress();
      const b = await spare2.getAddress();
      const same = impl.interface.encodeFunctionData("initialize", [
        [TR, KZ],
        [a, nodeOf(b)],
        [a, b],
      ]);
      await expect(
        ethers.deployContract("ERC1967Proxy", [await impl.getAddress(), same]),
      ).to.be.revertedWithCustomError(impl, "KeyInUse");
      // aynı yönetişim anahtarı iki kurucuya
      const twice = impl.interface.encodeFunctionData("initialize", [
        [TR, KZ],
        [nodeOf(a), nodeOf(b)],
        [a, a],
      ]);
      await expect(
        ethers.deployContract("ERC1967Proxy", [await impl.getAddress(), twice]),
      ).to.be.revertedWithCustomError(impl, "KeyInUse");
    });
  });

  describe("KG2/KG3 — düğüm anahtarının zincirde yetkisi yok; üye kendisi değiştirir", () => {
    it("düğüm anahtarı öneri açamaz, oy veremez, delege yazamaz, çekilemez", async () => {
      const n = f.as(f.governance, trNodeSigner) as any;
      await expect(n.proposeStateRemoval(AZ, id("x"))).to.be.revertedWithCustomError(f.governance, "NotGovernor");
      const pid = await proposalId((f.as(f.governance, f.kzGov) as any).proposeStateRemoval(AZ, id("x")), f);
      await expect(n.vote(pid, true)).to.be.revertedWithCustomError(f.governance, "NotGovernor");
      await expect(n.retractVote(pid)).to.be.revertedWithCustomError(f.governance, "NotGovernor");
      await expect(n.setDelegateKeys(TR, [])).to.be.revertedWithCustomError(f.governance, "NotGovernor");
      await expect(n.withdraw()).to.be.revertedWithCustomError(f.governance, "NotGovernor");
      await expect(n.setValidatorAddress(TR, nodeOf("0x" + "11".repeat(20)))).to.be.revertedWithCustomError(
        f.governance,
        "NotGovernor",
      );
    });

    it("yönetişim anahtarı düğüm adresini oy olmadan değiştirir; eski adres başka devlete geçmez", async () => {
      const newNode = nodeOf(await spare.getAddress());
      await expect((f.as(f.governance, f.trGov) as any).setValidatorAddress(TR, newNode))
        .to.emit(f.governance, "ValidatorAddressChanged")
        .withArgs(TR, f.trNode, newNode);
      expect((await f.governance.getMember(TR)).validatorAddress).to.equal(newNode);
      // yetki değişmedi: TR yine yönetişim anahtarıyla öneri açar
      await proposalId((f.as(f.governance, f.trGov) as any).proposeStateRemoval(AZ, id("y")), f);
      // bırakılan düğüm adresi başka bir devlete verilemez
      const fresh = await spare2.getAddress();
      await expect((f.as(f.governance, f.kzGov) as any).proposeStateAdmission(UZ, f.trNode, fresh))
        .to.be.revertedWithCustomError(f.governance, "ValidatorInUse")
        .withArgs(f.trNode, TR);
    });

    it("başka devletin üyeliği, başka devletin düğümü, yönetişim adresi, aynı adres ve sıfır reddedilir", async () => {
      const tr = f.as(f.governance, f.trGov) as any;
      await expect(tr.setValidatorAddress(KZ, nodeOf("0x" + "22".repeat(20)))).to.be.revertedWithCustomError(
        f.governance,
        "NotGovernor",
      );
      await expect(tr.setValidatorAddress(TR, f.kzNode))
        .to.be.revertedWithCustomError(f.governance, "ValidatorInUse")
        .withArgs(f.kzNode, KZ);
      await expect(tr.setValidatorAddress(TR, await f.trGov.getAddress())).to.be.revertedWithCustomError(
        f.governance,
        "KeyInUse",
      );
      await expect(tr.setValidatorAddress(TR, await f.kzGov.getAddress())).to.be.revertedWithCustomError(
        f.governance,
        "KeyInUse",
      );
      await expect(tr.setValidatorAddress(TR, f.trNode)).to.be.revertedWithCustomError(f.governance, "ValidatorInUse");
      await expect(tr.setValidatorAddress(TR, ethers.ZeroAddress)).to.be.revertedWithCustomError(
        f.governance,
        "ZeroAddress",
      );
      await expect(tr.setValidatorAddress(UZ, nodeOf("0x" + "33".repeat(20)))).to.be.revertedWithCustomError(
        f.governance,
        "UnknownMember",
      );
    });
  });

  describe("KG4 — yönetişim anahtarı yalnız oyla ve üyenin kendi oyuyla değişir", () => {
    it("öneri → 2/3 oy (değişen üyenin oyu sayılır) → eski anahtar yetkisiz, yeni anahtar oy verir", async () => {
      const oldKey = await f.trGov.getAddress();
      const newKey = await spare.getAddress();
      const pid = await proposalId((f.as(f.governance, f.kzGov) as any).proposeGovernanceKeyChange(TR, newKey), f);
      const p = await f.governance.getProposal(pid);
      expect(p.kind).to.equal(6); // GOVERNANCE_KEY_CHANGE
      expect(p.stateCode).to.equal(TR);
      expect(p.governanceAddress).to.equal(newKey);
      // tek oy yetmez (eşik 2)
      await (await f.as(f.governance, f.trGov).vote(pid, true)).wait();
      await expect(f.governance.execute(pid)).to.be.revertedWithCustomError(f.governance, "ThresholdNotMet");
      await (await f.as(f.governance, f.kzGov).vote(pid, true)).wait();
      await expect(f.governance.execute(pid))
        .to.emit(f.governance, "GovernanceAddressChanged")
        .withArgs(TR, oldKey, newKey);
      const m = await f.governance.getMember(TR);
      expect(m.governanceAddress).to.equal(newKey);
      expect(m.validatorAddress).to.equal(f.trNode); // düğüm değişmedi
      // eski anahtar artık hiçbir şey yapamaz
      const old = f.as(f.governance, f.trGov) as any;
      await expect(old.proposeStateRemoval(AZ, id("z"))).to.be.revertedWithCustomError(f.governance, "NotGovernor");
      await expect(old.setDelegateKeys(TR, [])).to.be.revertedWithCustomError(f.governance, "NotGovernor");
      await expect(old.withdraw()).to.be.revertedWithCustomError(f.governance, "NotGovernor");
      // yeni anahtar delege listesini yazar ve öneri açar
      await (await (f.as(f.governance, spare) as any).setDelegateKeys(TR, [await f.trDelegate.getAddress()])).wait();
      await proposalId((f.as(f.governance, spare) as any).proposeStateRemoval(AZ, id("z")), f);
      // bırakılan anahtar başka devlete verilemez
      await expect(
        (f.as(f.governance, f.kzGov) as any).proposeStateAdmission(UZ, nodeOf(oldKey), oldKey),
      ).to.be.revertedWithCustomError(f.governance, "KeyInUse");
    });

    it("KG4: öteki üyeler bir devletin anahtarını onun oyu olmadan değiştiremez (eşik dolsa da)", async () => {
      const pid = await proposalId(
        (f.as(f.governance, f.kzGov) as any).proposeGovernanceKeyChange(TR, await spare.getAddress()),
        f,
      );
      await (await f.as(f.governance, f.kzGov).vote(pid, true)).wait();
      await (await f.as(f.governance, f.azGov).vote(pid, true)).wait();
      expect(await f.governance.countedForVotes(pid)).to.equal(2); // eşik (2) doldu
      await expect(f.governance.execute(pid))
        .to.be.revertedWithCustomError(f.governance, "KeyChangeNeedsOwnVote")
        .withArgs(TR);
      // TR "hayır" derse de yürümez; "evet" derse yürür
      await (await f.as(f.governance, f.trGov).vote(pid, false)).wait();
      await expect(f.governance.execute(pid)).to.be.revertedWithCustomError(f.governance, "KeyChangeNeedsOwnVote");
      await (await f.as(f.governance, f.trGov).vote(pid, true)).wait();
      await (await f.governance.execute(pid)).wait();
      expect((await f.governance.getMember(TR)).governanceAddress).to.equal(await spare.getAddress());
    });

    it("eski anahtarla verilmiş açık oylar sayılmaz; üye yeni anahtarla yeniden oy verir", async () => {
      const newKey = await spare.getAddress();
      // açık öneri: AZ çıkarma — TR ve KZ oy verdi (2 sayılır)
      const open = await proposalId((f.as(f.governance, f.kzGov) as any).proposeStateRemoval(AZ, id("o")), f);
      await (await f.as(f.governance, f.trGov).vote(open, true)).wait();
      await (await f.as(f.governance, f.kzGov).vote(open, true)).wait();
      expect(await f.governance.countedForVotes(open)).to.equal(2);
      // TR anahtarını değiştir (TR + KZ + AZ oyu)
      const ch = await proposalId((f.as(f.governance, f.kzGov) as any).proposeGovernanceKeyChange(TR, newKey), f);
      for (const g of [f.trGov, f.kzGov, f.azGov]) await (await f.as(f.governance, g).vote(ch, true)).wait();
      await (await f.governance.execute(ch)).wait();
      // TR'nin eski anahtarla verdiği oy artık sayılmaz
      expect(await f.governance.countedForVotes(open)).to.equal(1);
      await (await (f.as(f.governance, spare) as any).vote(open, true)).wait();
      expect(await f.governance.countedForVotes(open)).to.equal(2);
    });

    it("yürütmede yeniden denetim: arada başka devlete bağlanan anahtar reddedilir", async () => {
      const x = await spare.getAddress();
      const tr = f.as(f.governance, f.trGov) as any;
      const p1 = await proposalId(tr.proposeGovernanceKeyChange(TR, x), f);
      const p2 = await proposalId(tr.proposeGovernanceKeyChange(KZ, x), f);
      // üç üye de oy verir: p1'den sonra TR'nin eski anahtarla verdiği oy p2'de sayılmaz, KZ + AZ eşiği yine doldurur
      for (const p of [p1, p2])
        for (const g of [f.trGov, f.kzGov, f.azGov]) await (await f.as(f.governance, g).vote(p, true)).wait();
      await (await f.governance.execute(p1)).wait();
      await expect(f.governance.execute(p2)).to.be.revertedWithCustomError(f.governance, "KeyInUse").withArgs(x, TR);
    });

    it("öneri denetimleri: üye değil, aynı anahtar, başka devletin anahtarı, düğüm adresi, sıfır", async () => {
      const kz = f.as(f.governance, f.kzGov) as any;
      await expect(kz.proposeGovernanceKeyChange(UZ, await spare.getAddress())).to.be.revertedWithCustomError(
        f.governance,
        "UnknownMember",
      );
      await expect(kz.proposeGovernanceKeyChange(TR, await f.trGov.getAddress())).to.be.revertedWithCustomError(
        f.governance,
        "KeyInUse",
      );
      await expect(kz.proposeGovernanceKeyChange(TR, await f.azGov.getAddress()))
        .to.be.revertedWithCustomError(f.governance, "KeyInUse")
        .withArgs(await f.azGov.getAddress(), AZ);
      await expect(kz.proposeGovernanceKeyChange(TR, f.trNode)).to.be.revertedWithCustomError(f.governance, "KeyInUse");
      await expect(kz.proposeGovernanceKeyChange(TR, ethers.ZeroAddress)).to.be.revertedWithCustomError(
        f.governance,
        "ZeroAddress",
      );
      // düğüm anahtarı anahtar değişikliği öneremez
      await expect(
        (f.as(f.governance, trNodeSigner) as any).proposeGovernanceKeyChange(TR, await spare.getAddress()),
      ).to.be.revertedWithCustomError(f.governance, "NotGovernor");
    });
  });

  describe("KG5 — iki üyeli ağ (ADR-0076)", () => {
    it("anahtar değişikliği iki üyenin oyunu ister; değişen üye kendi önerisini açabilir", async () => {
      const s = await ethers.getSigners();
      const [deployer, aGov, bGov, newKey] = [s[0], s[14], s[15], s[16]];
      const d = await deployTrustLayer(
        ethers,
        deployer,
        [
          { code: "TR", validator: nodeOf(await aGov.getAddress()), governance: await aGov.getAddress() },
          { code: "KZ", validator: nodeOf(await bGov.getAddress()), governance: await bGov.getAddress() },
        ],
        aGov,
      );
      const g = d.governance as any;
      const pid = await proposalId(g.connect(aGov).proposeGovernanceKeyChange(TR, await newKey.getAddress()), d);
      await (await g.connect(aGov).vote(pid, true)).wait();
      // yalnız değişen üyenin oyu: 1 < 2 (öteki üye kabul etmeden anahtar değişmez)
      await expect(g.execute(pid)).to.be.revertedWithCustomError(g, "ThresholdNotMet").withArgs(1, 2);
      await (await g.connect(bGov).vote(pid, true)).wait();
      await (await g.execute(pid)).wait();
      expect((await g.getMember(TR)).governanceAddress).to.equal(await newKey.getAddress());
      // ADR-0076 GC1 yeni anahtarla da geçerli: iki üyeli ağda tek taraflı çıkış yok
      await expect(g.connect(newKey).withdraw()).to.be.revertedWithCustomError(g, "TooFewMembers");
      expect(await g.requiredVotes(ZERO.slice(0, 6))).to.equal(2);
    });
  });
});
