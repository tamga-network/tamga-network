/**
 * ADR-0075 — doğrulayıcı alan adı kimliğinin (`rpId = keccak256(dns_name)`) sahipliği ve iptal sonrası yeniden kayıt:
 *   - kapma: başka devletin önce kaydettiği kimlik yalnız Governance oyuyla (2/3) gerçek sahibine devredilir;
 *   - iptal edilmiş kimlik yalnız Governance oyuyla yeniden kaydedilir;
 *   - her ikisi yeni bir kayıt dönemi açar; eski dönemin geçmişi ve olayları korunur, `t` anındaki okuma o andaki döneme bakar;
 *   - göç penceresiyle etkileşim (Governance pencerede tarihsiz yazar; geçmiş sıralı kalır).
 */
import { expect } from "chai";

import { AZ, DAY, KZ, TR, ZERO, ethers, id, loadFixture, networkHelpers, type Fixture } from "./helpers/fixture.js";

enum Action {
  NONE,
  REASSIGNMENT,
  RE_REGISTRATION,
}
enum RP {
  NONE,
  ACTIVE,
  SUSPENDED,
  REVOKED,
}

const RPID = id("verify.example.tr"); // keccak256(utf8(dns_name))
const UZ = "0x555a"; // üye olmayan devlet
const SD_JWT = 0;

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

const rp = (over: Record<string, unknown> = {}) => ({
  rpId: RPID,
  stateCode: TR,
  nameHash: id("Example Verifier"),
  accessCertFingerprint: id("CERT-1"),
  status: 1,
  registeredAt: 0,
  ...over,
});

const change = (over: Record<string, unknown> = {}) => ({
  action: Action.REASSIGNMENT,
  rpId: RPID,
  fromState: KZ,
  toState: TR,
  nameHash: id("Example Verifier"),
  accessCertFingerprint: id("CERT-TR"),
  reasonHash: id("dispute-evidence-block"),
  ...over,
});

const scope = (over: Record<string, unknown> = {}) => ({
  scopeHash: id("age-check"),
  serviceHash: id("age-check"),
  schemaId: id("urn:tamga:pid:Pid:1"),
  format: SD_JWT,
  namespaceHash: ZERO,
  attributes: [id("age_over_18")],
  validFrom: 0,
  validUntil: 0,
  detailsHash: id("purpose"),
  ...over,
});

describe("ADR-0075 — doğrulayıcı kimliğinin sahipliği ve kayıt dönemleri", function () {
  let f: Fixture;
  let reg: any;
  beforeEach(async () => {
    f = await loadFixture();
    reg = f.relyingParties;
  });

  /** sabitle → öneri → 2/3 → yürüt */
  async function vote(c: ReturnType<typeof change>, kind: "reassign" | "reregister" = "reassign") {
    const stageId = await reg.periodChangeIdOf(c);
    await expect(reg.connect(f.stranger).stagePeriodChange(c))
      .to.emit(reg, "PeriodChangeStaged")
      .withArgs(stageId, c.rpId, c.action, (await reg.registrationPeriodsOf(c.rpId)).length);
    const g = f.as(f.governance, f.trValidator) as any;
    const target = await reg.getAddress();
    const pid = await proposalId(
      kind === "reassign"
        ? await g.proposeRelyingPartyReassignment(target, stageId)
        : await g.proposeRelyingPartyReRegistration(target, stageId),
      f,
    );
    await (await f.as(f.governance, f.trValidator).vote(pid, true)).wait();
    await (await f.as(f.governance, f.kzValidator).vote(pid, true)).wait();
    return { pid, stageId };
  }

  it("kapma düzeltilir: KZ'nin önce kaydettiği TR kimliği yalnız 2/3 oyla TR'ye geçer; yeni dönem eski kayıtları devralmaz", async () => {
    const kz = f.as(reg, f.kzDelegate);
    await (await kz.registerRelyingParty(rp({ stateCode: KZ, accessCertFingerprint: id("CERT-KZ") }))).wait();
    await (await kz.setRequestScope(RPID, scope())).wait();
    const group = {
      groupId: id("gate-1"),
      institutionId: RPID,
      policyIds: [id("policy-1")],
      certFingerprints: [id("TERMINAL-1")],
      offlineAllowed: false,
      validFrom: 0,
      validUntil: 0,
      labelHash: id("label"),
    };
    await (await kz.setTerminalGroup(RPID, group)).wait();
    const t0 = await f.now();
    // gerçek sahip kendi alan adıyla kayıt olamıyor
    await expect(f.as(reg, f.trDelegate).registerRelyingParty(rp())).to.be.revertedWithCustomError(reg, "RPExists");

    // tek devlet tek başına devredemez: yalnız Governance yazar, eşik dolmadan yürütülmez
    await expect(reg.connect(f.stranger).commitPeriodChange(ZERO, Action.REASSIGNMENT)).to.be.revertedWithCustomError(
      reg,
      "NotGovernance",
    );
    const c = change();
    const stageId = await reg.periodChangeIdOf(c);
    await (await reg.connect(f.stranger).stagePeriodChange(c)).wait();
    const pid1 = await proposalId(
      await (f.as(f.governance, f.trValidator) as any).proposeRelyingPartyReassignment(await reg.getAddress(), stageId),
      f,
    );
    await (await f.as(f.governance, f.trValidator).vote(pid1, true)).wait();
    await expect(f.governance.execute(pid1)).to.be.revertedWithCustomError(f.governance, "ThresholdNotMet");
    await (await f.as(f.governance, f.kzValidator).vote(pid1, true)).wait();

    await networkHelpers.time.increase(60);
    await expect(f.governance.execute(pid1))
      .to.emit(reg, "RelyingPartyReassigned")
      .withArgs(RPID, KZ, TR, 1, c.reasonHash);
    const t1 = await f.now();

    const r = await reg.getRelyingParty(RPID);
    expect(r.stateCode).to.equal(TR);
    expect(r.accessCertFingerprint).to.equal(id("CERT-TR"));
    expect(r.status).to.equal(RP.ACTIVE);
    expect(await reg.rpIdOfCertificate(id("CERT-KZ"))).to.equal(ZERO);
    expect(await reg.rpIdOfCertificate(id("CERT-TR"))).to.equal(RPID);
    expect(await reg.getRelyingPartiesByState(TR)).to.deep.equal([RPID]);
    expect(await reg.getRelyingPartiesByState(KZ)).to.deep.equal([RPID]); // geçmiş: yalnız eklenir

    // dönemler ve geçmiş
    const periods = await reg.registrationPeriodsOf(RPID);
    expect(periods.map((p: any) => p.stateCode)).to.deep.equal([KZ, TR]);
    expect(Number(periods[1].since)).to.equal(t1);
    expect(await reg.relyingPartyAt(RPID, t0)).to.deep.equal([BigInt(RP.ACTIVE), KZ, 0n]);
    expect(await reg.relyingPartyAt(RPID, t1)).to.deep.equal([BigInt(RP.ACTIVE), TR, 1n]);

    // yeni dönem eski sahibin kapsamlarını, kayıt verisini ve kapı gruplarını devralmaz; eski grup kapanır
    expect(await reg.requestScopesOf(RPID)).to.have.length(0);
    expect(
      await reg.mayRequest(RPID, id("age-check"), id("urn:tamga:pid:Pid:1"), SD_JWT, ZERO, id("age_over_18")),
    ).to.equal(false);
    expect(await reg.terminalGroupsOf(RPID)).to.have.length(0);
    const [owner, g] = await reg.terminalGroupOf(id("gate-1"));
    expect(owner).to.equal(RPID);
    expect(Number(g.validUntil)).to.equal(t1);
    expect(await reg.isActiveTerminalCertificate(id("gate-1"), id("TERMINAL-1"))).to.equal(false);

    // yazma yetkisi yeni sahipte; eski sahip yazamaz
    await expect(kz.suspendRelyingParty(RPID)).to.be.revertedWithCustomError(reg, "NotOwnerState");
    await (await f.as(reg, f.trDelegate).setRequestScope(RPID, scope())).wait(); // aynı kapsam kimliği yeni dönemde serbest
    expect(await reg.requestScopesOf(RPID)).to.have.length(1);
    // eski dönemin kapanmış grubu yeni dönemde yeniden açılamaz
    await expect(f.as(reg, f.trDelegate).setTerminalGroup(RPID, group)).to.be.revertedWithCustomError(
      reg,
      "TerminalGroupNotOpen",
    );
  });

  it("iptal sonrası yeniden kayıt yalnız oyla; yeni dönem başlar, eski dönemin geçmişi korunur (iat anındaki dönem)", async () => {
    const tr = f.as(reg, f.trDelegate);
    await (await tr.registerRelyingParty(rp())).wait();
    const t0 = await f.now();
    await networkHelpers.time.increase(DAY);
    await (await tr.revokeRelyingParty(RPID)).wait();
    const t1 = await f.now();
    // iptal kesin: aynı kimlik olağan yolla yeniden kaydedilemez, yeniden etkinleşmez
    await expect(tr.registerRelyingParty(rp({ accessCertFingerprint: id("CERT-2") }))).to.be.revertedWithCustomError(
      reg,
      "RPExists",
    );
    await expect(tr.reinstateRelyingParty(RPID)).to.be.revertedWithCustomError(reg, "RelyingPartyNotSuspended");

    // iptal edilmiş kayıt devredilemez (yol yeniden kayıttır)
    const bad = change({ fromState: TR, toState: KZ });
    const { pid: badPid } = await vote(bad);
    await expect(f.governance.execute(badPid)).to.be.revertedWithCustomError(reg, "InvalidPeriodChange");

    await networkHelpers.time.increase(DAY);
    const c = change({
      action: Action.RE_REGISTRATION,
      fromState: TR,
      toState: TR,
      accessCertFingerprint: id("CERT-2"),
    });
    const { pid } = await vote(c, "reregister");
    await expect(f.governance.execute(pid))
      .to.emit(reg, "RelyingPartyReRegistered")
      .withArgs(RPID, TR, 1, c.reasonHash);
    const t2 = await f.now();

    expect(await reg.isValidRelyingParty(RPID)).to.equal(true);
    const hist = await reg.relyingPartyStatusHistoryOf(RPID);
    expect(hist.map((h: any) => Number(h.status))).to.deep.equal([RP.ACTIVE, RP.REVOKED, RP.ACTIVE]);
    expect(hist.map((h: any) => Number(h.since))).to.deep.equal([t0, t1, t2]);
    expect(await reg.isRelyingPartyAcceptableAt(RPID, t0)).to.equal(true);
    expect(await reg.isRelyingPartyAcceptableAt(RPID, t1)).to.equal(false);
    expect(await reg.isRelyingPartyAcceptableAt(RPID, t2 - 1)).to.equal(false);
    expect(await reg.isRelyingPartyAcceptableAt(RPID, t2)).to.equal(true);
    expect(await reg.isRelyingPartyAcceptableAt(RPID, t0 - 1)).to.equal(false);
    expect(await reg.relyingPartyAt(RPID, t1)).to.deep.equal([BigInt(RP.REVOKED), TR, 0n]);
    expect(await reg.relyingPartyAt(RPID, t2)).to.deep.equal([BigInt(RP.ACTIVE), TR, 1n]);
    expect(await reg.relyingPartyAt(RPID, t0 - 1)).to.deep.equal([0n, "0x0000", 0n]);
    expect(await reg.getRelyingPartiesByState(TR)).to.deep.equal([RPID]); // aynı devlete dönüş: tekrar eklenmez
    expect(await reg.rpIdOfCertificate(id("CERT-1"))).to.equal(ZERO);

    // etkin kayıt "yeniden kaydedilemez"
    const again = change({ action: Action.RE_REGISTRATION, fromState: TR, toState: TR, reasonHash: id("again") });
    const { pid: pid2 } = await vote(again, "reregister");
    await expect(f.governance.execute(pid2)).to.be.revertedWithCustomError(reg, "InvalidPeriodChange");
  });

  it("öneri türü sabitlenen içerikle uyuşmalı; bayat, yanlış sahipli, üye olmayan devlete ve dolu sertifikalı değişiklik yazılmaz", async () => {
    const kz = f.as(reg, f.kzDelegate);
    await (await kz.registerRelyingParty(rp({ stateCode: KZ, accessCertFingerprint: id("CERT-KZ") }))).wait();
    await (
      await f
        .as(reg, f.trDelegate)
        .registerRelyingParty(rp({ rpId: id("other.example.tr"), accessCertFingerprint: id("CERT-OTHER") }))
    ).wait();

    // tür uyuşmazlığı: devir içeriği yeniden kayıt önerisiyle yürütülemez
    const { pid: wrongKind } = await vote(change(), "reregister");
    await expect(f.governance.execute(wrongKind)).to.be.revertedWithCustomError(reg, "UnknownPeriodChange");
    // yanlış eski sahip
    const { pid: wrongFrom } = await vote(change({ fromState: AZ, reasonHash: id("r2") }));
    await expect(f.governance.execute(wrongFrom)).to.be.revertedWithCustomError(reg, "InvalidPeriodChange");
    // üye olmayan devlete
    const { pid: nonMember } = await vote(change({ toState: UZ, reasonHash: id("r3") }));
    await expect(f.governance.execute(nonMember)).to.be.revertedWithCustomError(reg, "InvalidPeriodChange");
    // aynı devlete devir anlamsız
    const { pid: same } = await vote(change({ toState: KZ, reasonHash: id("r4") }));
    await expect(f.governance.execute(same)).to.be.revertedWithCustomError(reg, "InvalidPeriodChange");
    // başka doğrulayıcının sertifikası
    const { pid: cert } = await vote(change({ accessCertFingerprint: id("CERT-OTHER"), reasonHash: id("r5") }));
    await expect(f.governance.execute(cert))
      .to.be.revertedWithCustomError(reg, "CertificateInUse")
      .withArgs(id("CERT-OTHER"), id("other.example.tr"));

    // bayatlık: aynı tabanla sabitlenmiş iki öneriden ilki yürüyünce ikincisi yazılmaz
    const a = await vote(change({ reasonHash: id("first") }));
    const b = await vote(change({ toState: AZ, reasonHash: id("second") }));
    await (await f.governance.execute(a.pid)).wait();
    await expect(f.governance.execute(b.pid))
      .to.be.revertedWithCustomError(reg, "StalePeriodChange")
      .withArgs(b.stageId, 1, 2);
    // yürütülen sabitleme silinir: aynı stageId ikinci kez yürütülemez
    const [staged] = await reg.stagedPeriodChangeOf(a.stageId);
    expect(staged.action).to.equal(Action.NONE);

    // sabitleme denetimi: eksik içerik
    await expect(reg.stagePeriodChange(change({ reasonHash: ZERO }))).to.be.revertedWithCustomError(
      reg,
      "InvalidPeriodChange",
    );
    await expect(reg.stagePeriodChange(change({ action: Action.NONE }))).to.be.revertedWithCustomError(
      reg,
      "InvalidPeriodChange",
    );
    await expect(reg.stagePeriodChange(change({ accessCertFingerprint: ZERO }))).to.be.revertedWithCustomError(
      reg,
      "InvalidPeriodChange",
    );
  });

  it("göç penceresi: Governance pencerede tarihsiz yazar; yeniden oynatılan geçmiş dönem 0'da kalır, yeni dönem bugünden başlar", async () => {
    const plan = id("replay-plan-v1");
    const g = f.as(f.governance, f.trValidator);
    const open = await proposalId(
      await g.proposeMigrationOpen(await reg.getAddress(), plan, 7 * DAY, ethers.ZeroAddress),
      f,
    );
    await (await f.as(f.governance, f.trValidator).vote(open, true)).wait();
    await (await f.as(f.governance, f.kzValidator).vote(open, true)).wait();
    await (await f.governance.execute(open)).wait();
    expect(await reg.isMigrationOpen()).to.equal(true);

    const past = (await f.now()) - 100 * DAY;
    const tr = f.as(reg, f.trDelegate);
    // pencerede tarihsiz kayıt donuk; listedeki tarihle yeniden oynatılır
    await expect(tr.registerRelyingParty(rp())).to.be.revertedWithCustomError(reg, "DateRequiredDuringMigration");
    await (await tr.registerRelyingParty(rp({ registeredAt: past }))).wait();
    await (await tr.revokeRelyingParty(RPID)).wait();
    const tRevoke = await f.now();

    const c = change({
      action: Action.RE_REGISTRATION,
      fromState: TR,
      toState: KZ,
      accessCertFingerprint: id("CERT-KZ"),
    });
    const { pid } = await vote(c, "reregister");
    await expect(f.governance.execute(pid))
      .to.emit(reg, "RelyingPartyReRegistered")
      .withArgs(RPID, KZ, 1, c.reasonHash);
    const tNew = await f.now();

    const periods = await reg.registrationPeriodsOf(RPID);
    expect(Number(periods[0].since)).to.equal(past);
    expect(Number(periods[1].since)).to.equal(tNew);
    expect(await reg.relyingPartyAt(RPID, past)).to.deep.equal([BigInt(RP.ACTIVE), TR, 0n]);
    expect(await reg.relyingPartyAt(RPID, tRevoke)).to.deep.equal([BigInt(RP.REVOKED), TR, 0n]);
    expect(await reg.relyingPartyAt(RPID, tNew)).to.deep.equal([BigInt(RP.ACTIVE), KZ, 1n]);
    expect(await reg.isRelyingPartyAcceptableAt(RPID, past + DAY)).to.equal(true);
    // pencerede de yazma yetkisi yeni dönemin sahibinde
    await expect(f.as(reg, f.trDelegate).suspendRelyingParty(RPID)).to.be.revertedWithCustomError(reg, "NotOwnerState");
  });
});
