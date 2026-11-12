/**
 * SPEC-BC-0001 §0 / §1 — egemenlik koda gömülüdür (N1), yönetişim eşikleri (GV1, GV3, GV4), review R5–R7.
 */
import { expect } from "chai";

import { AZ, KZ, TR, ZERO, id, loadFixture, networkHelpers, type Fixture } from "./helpers/fixture.js";

describe("Governance / egemenlik (SPEC-BC-0001 §0–§1)", function () {
  let f: Fixture;
  beforeEach(async () => {
    f = await loadFixture();
  });

  const kzIssuerAttempt = async (who: any) => {
    const t = await f.now();
    return f.as(f.issuers, who).registerIssuer({
      issuerId: ZERO,
      stateCode: KZ,
      nameHash: ZERO,
      category: 0,
      assurance: 0,
      certFingerprint: id("KZ-UNI"),
      parentCA: f.trCA,
      metadataURI: "",
      status: 1,
      validFrom: t,
      validUntil: t + 365 * 86400,
      successorId: ZERO,
      registeredAt: 0,
      revokedAt: 0,
    });
  };

  const removeTR = async () => {
    const tx = await f.as(f.governance, f.kzValidator).proposeStateRemoval(TR, id("test"));
    const rc = await tx.wait();
    const ev = rc!.logs
      .map((l: any) => f.governance.interface.parseLog(l))
      .find((e: any) => e?.name === "ProposalCreated");
    const pid = ev!.args.id as string;
    await f.as(f.governance, f.kzValidator).vote(pid, true);
    await f.as(f.governance, f.azValidator).vote(pid, true);
    return pid;
  };

  it("N1: Türkiye'nin delege anahtarı Kazakistan namespace'ine yazamaz", async () => {
    await expect(kzIssuerAttempt(f.trDelegate))
      .to.be.revertedWithCustomError(f.issuers, "NotOwnerState")
      .withArgs(KZ, await f.trDelegate.getAddress());
  });

  it("N1: delege olmayan hiç kimse yazamaz", async () => {
    await expect(f.as(f.issuers, f.stranger).suspendIssuer(f.uniIssuer))
      .to.be.revertedWithCustomError(f.issuers, "NotOwnerState")
      .withArgs(TR, await f.stranger.getAddress());
  });

  it("R1: issuer operasyon anahtarı ULUSAL kayda yazamaz", async () => {
    await expect(f.as(f.issuers, f.uniOperator).suspendIssuer(f.uniIssuer))
      .to.be.revertedWithCustomError(f.issuers, "NotOwnerState")
      .withArgs(TR, await f.uniOperator.getAddress());
  });

  it("GV1: çıkarılan devlet yazma yetkisini kaybeder, kayıtlar durur", async () => {
    expect(await f.issuers.isValidIssuer(f.uniIssuer)).to.equal(true);
    const pid = await removeTR();
    await f.governance.execute(pid);
    expect(await f.governance.isActiveMember(TR)).to.equal(false);
    expect(await f.governance.isDelegateOf(await f.trDelegate.getAddress(), TR)).to.equal(false);
    // G1: kayıt SİLİNMEDİ
    expect((await f.issuers.getIssuer(f.uniIssuer)).certFingerprint).to.equal(id("BILGI-CERT"));
    // ve çıkarılan devletin kurumunun eski belgeleri kabul edilebilir kalır (ADR-0002 #4)
    expect(await f.issuers.isCredentialAcceptable(f.uniIssuer, await f.now())).to.equal(true);
  });

  it("GV3 (R6): tek oy yetmez — KZ tek başına TR'yi atamaz", async () => {
    const tx = await f.as(f.governance, f.kzValidator).proposeStateRemoval(TR, id("test"));
    const rc = await tx.wait();
    const pid = rc!.logs
      .map((l: any) => f.governance.interface.parseLog(l))
      .find((e: any) => e?.name === "ProposalCreated")!.args.id;
    await f.as(f.governance, f.kzValidator).vote(pid, true);
    await expect(f.governance.execute(pid))
      .to.be.revertedWithCustomError(f.governance, "ThresholdNotMet")
      .withArgs(1, 2);
  });

  it("GV3: requiredVotes = max(ceil(2n/3), 2)", async () => {
    expect(await f.governance.requiredVotes("0x0000")).to.equal(2); // n=3 → 2
    expect(await f.governance.requiredVotes(TR)).to.equal(2); // TR hariç n=2 → ceil(4/3)=2
  });

  it("GV4 (R7): çıkarılan devlet yeniden kabul edilebilir; eski delege düşer", async () => {
    await f.governance.execute(await removeTR());
    const newValidator = await f.stranger.getAddress();
    const tx = await f.as(f.governance, f.kzValidator).proposeStateAdmission(TR, newValidator);
    const rc = await tx.wait();
    const pid = rc!.logs
      .map((l: any) => f.governance.interface.parseLog(l))
      .find((e: any) => e?.name === "ProposalCreated")!.args.id;
    await f.as(f.governance, f.kzValidator).vote(pid, true);
    await f.as(f.governance, f.azValidator).vote(pid, true);
    await f.governance.execute(pid);
    expect(await f.governance.isActiveMember(TR)).to.equal(true);
    expect((await f.governance.getMember(TR)).validatorAddress).to.equal(newValidator);
    expect(await f.governance.isDelegateOf(await f.trDelegate.getAddress(), TR)).to.equal(false);
  });

  it("ADR-0002: çıkarma oylamasında çıkarılanın oyu sayılmaz", async () => {
    const tx = await f.as(f.governance, f.kzValidator).proposeStateRemoval(TR, id("test"));
    const rc = await tx.wait();
    const pid = rc!.logs
      .map((l: any) => f.governance.interface.parseLog(l))
      .find((e: any) => e?.name === "ProposalCreated")!.args.id;
    await expect(f.as(f.governance, f.trValidator).vote(pid, false)).to.be.revertedWithCustomError(
      f.governance,
      "NotValidator",
    );
  });

  it("validator olmayan öneri veremez, oy kullanamaz", async () => {
    await expect(
      f.as(f.governance, f.trDelegate).proposeStateAdmission(AZ, await f.stranger.getAddress()),
    ).to.be.revertedWithCustomError(f.governance, "NotValidator");
    await expect(f.as(f.governance, f.stranger).vote(ZERO, true)).to.be.revertedWithCustomError(
      f.governance,
      "NotValidator",
    );
  });

  it("R5: setSchemaRegistry bir kez — ikinci çağrı reddedilir", async () => {
    await expect(
      f.as(f.governance, f.trValidator).setSchemaRegistry(await f.schemas.getAddress()),
    ).to.be.revertedWithCustomError(f.governance, "SchemaRegistryAlreadySet");
  });

  it("delege anahtarını yalnız o devletin validator'ı değiştirir (MAX_DELEGATES=16)", async () => {
    await expect(f.as(f.governance, f.kzValidator).setDelegateKeys(TR, [])).to.be.revertedWithCustomError(
      f.governance,
      "NotValidator",
    );
    const many = Array.from({ length: 17 }, (_, i) => "0x" + (i + 1).toString(16).padStart(40, "0"));
    await expect(f.as(f.governance, f.trValidator).setDelegateKeys(TR, many)).to.be.revertedWithCustomError(
      f.governance,
      "TooManyDelegates",
    );
  });

  it("withdraw: tek taraflı çıkış, oy gerekmez (3 → 2); iki üyeli ağda çıkış reddedilir (ADR-0076 GC1)", async () => {
    await f.as(f.governance, f.azValidator).withdraw();
    expect(await f.governance.isActiveMember(AZ)).to.equal(false);
    expect(await f.governance.activeMemberCount()).to.equal(2);
    for (const v of [f.kzValidator, f.trValidator]) {
      await expect(f.as(f.governance, v).withdraw())
        .to.be.revertedWithCustomError(f.governance, "TooFewMembers")
        .withArgs(2, 3);
    }
    expect(await f.governance.activeMemberCount()).to.equal(2);
  });

  it("öneri süresi (30 gün) geçince yürütülemez", async () => {
    const pid = await removeTR();
    await networkHelpers.time.increase(31 * 86400);
    await expect(f.governance.execute(pid)).to.be.revertedWithCustomError(f.governance, "ProposalExpired");
  });
});
