/**
 * F-18 kalanı (2026-10-19 güvenlik turu) ve C33 (1) okuma görünümleri — 2026-11-04:
 * sürüm bir adımda en çok MAX_VERSION_STEP artar (`version = 2^64-1` ile liste dondurma yok); kullanılmayan CANCELLED /
 * ProposalCancelled / SchemaNotAuthorized kalktı; ince olaylar dolduruldu (SchemaRegistrySet, DelegateKeysSet anahtarlarla,
 * StateRemoved gerekçe özetiyle); üye, yazıcı ve kurum delege listeleri okunur.
 */
import { expect } from "chai";

import { AZ, KZ, TR, ethers, id, loadFixture, type Fixture } from "./helpers/fixture.js";

async function proposalId(tx: any, f: Fixture): Promise<string> {
  const rc = await (await tx).wait();
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

describe("F-18 kalanı ve C33 (1)", function () {
  let f: Fixture;
  beforeEach(async () => {
    f = await loadFixture();
  });

  it("StatusListRegistry: sürüm bir adımda en çok MAX_VERSION_STEP artar; 2^64-1 ile dondurulamaz", async () => {
    const op = f.as(f.statusLists, f.uniOperator);
    const uri = "https://status.example/l/f18";
    await (await op.registerList(f.uniIssuer, uri, 100_000, 2)).wait();
    const listId = await f.statusLists.listIdOf(f.uniIssuer, uri);
    const step = await f.statusLists.MAX_VERSION_STEP();
    await expect(op.publishList(listId, id("v"), 2n ** 64n - 1n, 0))
      .to.be.revertedWithCustomError(f.statusLists, "VersionStepTooLarge")
      .withArgs(0, 2n ** 64n - 1n);
    await (await op.publishList(listId, id("v1"), step, 0)).wait(); // tam adım serbest
    await expect(op.publishList(listId, id("v2"), 2n * step + 1n, 0)).to.be.revertedWithCustomError(
      f.statusLists,
      "VersionStepTooLarge",
    );
  });

  it("TrustListAnchorRegistry: aynı adım sınırı; yazıcı listesi okunur ve güncel kalır", async () => {
    const [gov, a1, a2] = await ethers.getSigners();
    const impl = await ethers.deployContract("TrustListAnchorRegistry");
    const data = impl.interface.encodeFunctionData("initialize", [
      await gov.getAddress(),
      [await a1.getAddress(), await a2.getAddress()],
      1,
    ]);
    const proxy = await ethers.deployContract("ERC1967Proxy", [await impl.getAddress(), data]);
    const reg: any = await ethers.getContractAt("TrustListAnchorRegistry", await proxy.getAddress());
    expect(await reg.anchorers()).to.deep.equal([await a1.getAddress(), await a2.getAddress()]);
    await (await reg.connect(gov).setAnchorer(await a1.getAddress(), false)).wait();
    expect(await reg.anchorers()).to.deep.equal([await a2.getAddress()]);
    const key = id("tamga:trust-list:production:lotl");
    const step = await reg.MAX_VERSION_STEP();
    await expect(reg.connect(a2).anchorList(key, step + 1n, id("c"), ethers.ZeroHash, 1)).to.be.revertedWithCustomError(
      reg,
      "VersionStepTooLarge",
    );
    await expect(reg.connect(a2).anchorList(key, 73, id("c"), ethers.ZeroHash, 1)).to.emit(reg, "ListAnchorConfirmed");
  });

  it("Governance: üye listesi, delege anahtarları olayda, SchemaRegistry bağı olayı kurulumda yayıldı", async () => {
    expect(await f.governance.memberList()).to.deep.equal([TR, KZ, AZ]);
    const keys = [await f.stranger.getAddress()];
    await expect(f.as(f.governance, f.azValidator).setDelegateKeys(AZ, keys))
      .to.emit(f.governance, "DelegateKeysSet")
      .withArgs(AZ, keys);
    const filter = (f.governance as any).filters.SchemaRegistrySet();
    const logs = await (f.governance as any).queryFilter(filter, 0);
    expect(logs.length).to.equal(1);
    expect(logs[0].args.registry).to.equal(await f.schemas.getAddress());
    expect(await f.issuers.issuerDelegatesOf(f.uniIssuer)).to.deep.equal([await f.uniOperator.getAddress()]);
  });

  it("çıkarma önerisi gerekçeyi özet olarak taşır; StateRemoved özeti yayar", async () => {
    const pid = await proposalId(f.as(f.governance, f.kzValidator).proposeStateRemoval(AZ, id("gerekçe metni")), f);
    await (await f.as(f.governance, f.kzValidator).vote(pid, true)).wait();
    await (await f.as(f.governance, f.trValidator).vote(pid, true)).wait();
    await expect(f.governance.execute(pid)).to.emit(f.governance, "StateRemoved").withArgs(AZ, id("gerekçe metni"));
  });

  it("kullanılmayan ABI öğeleri kalktı (CANCELLED, ProposalCancelled, SchemaNotAuthorized)", async () => {
    expect(f.governance.interface.getEvent("ProposalCancelled" as any)).to.equal(null);
    expect(f.issuers.interface.getError("SchemaNotAuthorized" as any)).to.equal(null);
  });
});
