/**
 * SPEC-BC-0001 §9 — UUPS brick koruması (D-BC-2): yükseltme yalnız Governance'tan; implementasyon doğrudan initialize
 * edilemez; `proxiableUUID` bütün yükseltilebilir kontratlarda; Governance önerisi UUPS uyumlu olmayan hedefi açmaz.
 * Eski script/check-upgrade-safety.sh'in davranışsal karşılığı (statik denetim: scripts/check-upgrade-safety.mjs).
 */
import { expect } from "chai";

import { TR, ethers, loadFixture, networkHelpers, type Fixture } from "./helpers/fixture.js";

const UUPS_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const UPGRADEABLE = [
  "Governance",
  "RootCARegistry",
  "SchemaRegistry",
  "IssuerRegistry",
  "RelyingPartyRegistry",
  "CrossRecognition",
  "StatusListRegistry",
  "TrustListAnchorRegistry",
  "NetworkRegistry",
] as const;

describe("UUPS yükseltme güvenliği (SPEC-BC-0001 §9)", function () {
  let f: Fixture;
  beforeEach(async () => {
    f = await loadFixture();
  });

  for (const name of UPGRADEABLE) {
    it(`${name}: implementasyon proxiableUUID döner ve doğrudan initialize edilemez`, async () => {
      const impl = await ethers.deployContract(name);
      expect(await impl.proxiableUUID()).to.equal(UUPS_SLOT);
      const init = impl.interface.getFunction("initialize")!;
      const args = init.inputs.map((i) => {
        if (i.baseType === "array") return [];
        if (i.type === "address") return ethers.ZeroAddress;
        return 0;
      });
      await expect(impl.initialize(...args)).to.be.revertedWithCustomError(impl, "InvalidInitialization");
    });
  }

  it("registry: Governance dışından upgradeToAndCall reddedilir (NotGovernance)", async () => {
    const newImpl = await ethers.deployContract("IssuerRegistry");
    await expect(
      f.as(f.issuers, f.trDelegate).upgradeToAndCall(await newImpl.getAddress(), "0x"),
    ).to.be.revertedWithCustomError(f.issuers, "NotGovernance");
    await expect(
      f.as(f.issuers, f.deployer).upgradeToAndCall(await newImpl.getAddress(), "0x"),
    ).to.be.revertedWithCustomError(f.issuers, "NotGovernance");
  });

  it("Governance: kendisi dışından yükseltilemez; proxy ikinci kez initialize edilemez", async () => {
    const newImpl = await ethers.deployContract("Governance");
    await expect(
      f.as(f.governance, f.trValidator).upgradeToAndCall(await newImpl.getAddress(), "0x"),
    ).to.be.revertedWithCustomError(f.governance, "NotGovernance");
    await expect(
      f.as(f.governance, f.trValidator).initialize([TR], [await f.trValidator.getAddress()]),
    ).to.be.revertedWithCustomError(f.governance, "InvalidInitialization");
  });

  it("brick koruması 3: UUPS uyumlu olmayan hedefle öneri açılmaz", async () => {
    const notProxiable = await ethers.deployContract("TrustQueries", [
      await f.issuers.getAddress(),
      await f.schemas.getAddress(),
      await f.recognition.getAddress(),
      await f.statusLists.getAddress(),
    ]);
    await expect(
      f
        .as(f.governance, f.trValidator)
        .proposeProtocolUpgrade(await f.issuers.getAddress(), await notProxiable.getAddress()),
    )
      .to.be.revertedWithCustomError(f.governance, "UpgradeTargetNotProxiable")
      .withArgs(await notProxiable.getAddress());
  });

  it("2/3 oyla protokol yükseltmesi: proxy yeni implementasyona geçer, depolama korunur", async () => {
    const newImpl = await ethers.deployContract("IssuerRegistry");
    const tx = await f
      .as(f.governance, f.trValidator)
      .proposeProtocolUpgrade(await f.issuers.getAddress(), await newImpl.getAddress());
    const rc = await tx.wait();
    const pid = rc!.logs
      .map((l: any) => f.governance.interface.parseLog(l))
      .find((e: any) => e?.name === "ProposalCreated")!.args.id;
    await f.as(f.governance, f.trValidator).vote(pid, true);
    await f.as(f.governance, f.kzValidator).vote(pid, true);
    // ADR-0055 GE1: eşik dolunca önce kuyruğa alınır, 7 gün sonra uygulanır
    await expect(f.governance.execute(pid)).to.emit(f.governance, "ProposalQueued");
    await networkHelpers.time.increase(7 * 24 * 3600);
    await expect(f.governance.execute(pid)).to.emit(f.governance, "ProposalExecuted").withArgs(pid);
    // ERC1967 implementasyon slotu yeni adresi gösterir
    const slot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
    const stored = await ethers.provider.getStorage(await f.issuers.getAddress(), slot);
    expect(ethers.getAddress("0x" + stored.slice(26))).to.equal(await newImpl.getAddress());
    // depolama korunur: kayıt hâlâ orada
    expect((await f.issuers.getIssuer(f.uniIssuer)).stateCode).to.equal(TR);
  });
});
