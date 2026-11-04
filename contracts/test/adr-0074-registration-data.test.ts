/**
 * ADR-0074 K2 (PJ1, PJ2) — ulusal listelerin kayıt verisi zincirde yalnız özet / bool / bit maskesi / rpId dizisi olarak:
 * kurum sınıfı ve kayıt + işletim özetleri; doğrulayıcı kayıt verisi; kapı grupları (ADR-0069 TG1: grup ağda tek, kuruma ve en
 * az bir politikaya bağlı; geri çekilen grup silinmez, aralığı kapanır).
 */
import { expect } from "chai";

import { DAY, TR, ZERO, id, loadFixture, networkHelpers, type Fixture } from "./helpers/fixture.js";

const PUB = 1;
const MULTIPLE = 2;

describe("ADR-0074 K2 — kayıt verisi ve kapı grupları", function () {
  let f: Fixture;
  const RP = id("gate.example.org");
  const RP2 = id("other.example.org");
  beforeEach(async () => {
    f = await loadFixture();
    const w = f.as(f.relyingParties, f.trDelegate);
    const base = { stateCode: TR, nameHash: id("n"), status: 1, registeredAt: 0 };
    await (await w.registerRelyingParty({ ...base, rpId: RP, accessCertFingerprint: id("c1") })).wait();
    await (await w.registerRelyingParty({ ...base, rpId: RP2, accessCertFingerprint: id("c2") })).wait();
  });

  it("kurum profili: sınıf, kamu kurumu, yetki maskesi, kayıt ve işletim özetleri; yalnız sahibi devlet", async () => {
    const profile = {
      issuerClass: PUB,
      publicSector: true,
      entitlements: 0b101,
      registrationHash: id("registration-block"),
      operationsHash: id("operations-block"),
    };
    await expect(f.as(f.issuers, f.kzDelegate).setIssuerProfile(f.uniIssuer, profile)).to.be.revertedWithCustomError(
      f.issuers,
      "NotOwnerState",
    );
    await expect(f.as(f.issuers, f.trDelegate).setIssuerProfile(f.uniIssuer, profile))
      .to.emit(f.issuers, "IssuerProfileSet")
      .withArgs(f.uniIssuer, PUB, id("registration-block"), id("operations-block"));
    const p = await f.issuers.issuerProfileOf(f.uniIssuer);
    expect([Number(p.issuerClass), p.publicSector, Number(p.entitlements)]).to.deep.equal([PUB, true, 5]);
  });

  it("doğrulayıcı profili: aracı ve hizmet verilen doğrulayıcılar rpId dizisi, takma ad politikası; tavan 32", async () => {
    const w = f.as(f.relyingParties, f.trDelegate);
    const profile = {
      publicSector: false,
      entitlements: 1,
      aliasPolicy: MULTIPLE,
      registrationHash: id("rp-registration"),
      intermediaries: [RP2],
      servedParties: [],
    };
    await expect(w.setRelyingPartyProfile(RP, profile))
      .to.emit(f.relyingParties, "RelyingPartyProfileSet")
      .withArgs(RP, id("rp-registration"));
    const p = await f.relyingParties.relyingPartyProfileOf(RP);
    expect(p.intermediaries).to.deep.equal([RP2]);
    expect(Number(p.aliasPolicy)).to.equal(MULTIPLE);
    const many = Array.from({ length: 33 }, (_, i) => id(`rp${i}`));
    await expect(w.setRelyingPartyProfile(RP, { ...profile, servedParties: many }))
      .to.be.revertedWithCustomError(f.relyingParties, "TooManyEntries")
      .withArgs(33, 32);
  });

  const group = (over: Record<string, unknown> = {}) => ({
    groupId: id("main-gate"),
    institutionId: id("institution"),
    policyIds: [id("entry-18")],
    certFingerprints: [id("gate-cert-1")],
    offlineAllowed: false,
    validFrom: 0,
    validUntil: 0,
    labelHash: id("label"),
    ...over,
  });

  it("kapı grubu: kuruma ve en az bir politikaya bağlı; grup kimliği ağda tek (TG1)", async () => {
    const w = f.as(f.relyingParties, f.trDelegate);
    await expect(w.setTerminalGroup(RP, group({ policyIds: [] }))).to.be.revertedWithCustomError(
      f.relyingParties,
      "InvalidTerminalGroup",
    );
    await expect(w.setTerminalGroup(RP, group({ institutionId: ZERO }))).to.be.revertedWithCustomError(
      f.relyingParties,
      "InvalidTerminalGroup",
    );
    await expect(w.setTerminalGroup(RP, group())).to.emit(f.relyingParties, "TerminalGroupSet");
    await expect(w.setTerminalGroup(RP2, group()))
      .to.be.revertedWithCustomError(f.relyingParties, "TerminalGroupOwnedByOther")
      .withArgs(id("main-gate"), RP);
    expect(await f.relyingParties.terminalGroupsOf(RP)).to.deep.equal([id("main-gate")]);
    expect(await f.relyingParties.isActiveTerminalCertificate(id("main-gate"), id("gate-cert-1"))).to.equal(true);
    expect(await f.relyingParties.isActiveTerminalCertificate(id("main-gate"), id("başka"))).to.equal(false);
    // güncelleme aynı sahipte serbest
    await (await w.setTerminalGroup(RP, group({ certFingerprints: [id("gate-cert-2")] }))).wait();
    expect(await f.relyingParties.isActiveTerminalCertificate(id("main-gate"), id("gate-cert-1"))).to.equal(false);
    // yabancı devlet yazamaz
    await expect(f.as(f.relyingParties, f.kzDelegate).setTerminalGroup(RP, group())).to.be.revertedWithCustomError(
      f.relyingParties,
      "NotOwnerState",
    );
  });

  it("geri çekilen grup silinmez, aralığı kapanır; doğrulayıcı askıdayken kapı geçmez", async () => {
    const w = f.as(f.relyingParties, f.trDelegate);
    await (await w.setTerminalGroup(RP, group())).wait();
    await (await w.suspendRelyingParty(RP)).wait();
    expect(await f.relyingParties.isActiveTerminalCertificate(id("main-gate"), id("gate-cert-1"))).to.equal(false);
    await (await w.reinstateRelyingParty(RP)).wait();
    await networkHelpers.time.increase(DAY);
    await expect(w.closeTerminalGroup(RP, id("main-gate"), 0)).to.emit(f.relyingParties, "TerminalGroupClosed");
    expect(await f.relyingParties.isActiveTerminalCertificate(id("main-gate"), id("gate-cert-1"))).to.equal(false);
    const [owner, g] = await f.relyingParties.terminalGroupOf(id("main-gate"));
    expect(owner).to.equal(RP);
    expect(g.validUntil).to.not.equal(0n);
    await expect(w.closeTerminalGroup(RP, id("main-gate"), 0)).to.be.revertedWithCustomError(
      f.relyingParties,
      "InvalidTerminalGroup",
    );
    await expect(w.closeTerminalGroup(RP2, id("main-gate"), 0)).to.be.revertedWithCustomError(
      f.relyingParties,
      "UnknownTerminalGroup",
    );
  });
});
