/**
 * ADR-0073 K1 (CE1) — tek seferlik göç kipi; K5 (CE5) — C1/C2 belgenin `iat` anındaki duruma göre, yarı açık sınırlar,
 * askıdaki kurumun askıdan önceki belgeleri geçerli; iki sınır hatası (bir saniyelik `<=`, emekli kök) düzeltildi.
 * Son bölüm: rastgele durum dizisinde kontratın C1 cevabı imzalı listenin kuralıyla (TrustSource `statusAt`) aynı.
 */
import { expect } from "chai";

import {
  CAStatus,
  DAY,
  IssuerAssurance,
  IssuerCategory,
  SchemaTier,
  Status,
  TR,
  ZERO,
  ethers,
  id,
  loadFixture,
  networkHelpers,
  type Fixture,
} from "./helpers/fixture.js";

const PLAN = id("replay-plan-v1");
const EDU = "urn:tamga:tr:edu:DiplomaCredential:1";
const NET_VCT = "urn:tamga:edu:TranscriptCredential:1";

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

async function pass(f: Fixture, pid: string) {
  await (await f.as(f.governance, f.trValidator).vote(pid, true)).wait();
  await (await f.as(f.governance, f.kzValidator).vote(pid, true)).wait();
}

/** Governance önerisiyle kipi açar (2/3) ve yürütür. */
async function openMigration(f: Fixture, registry: any, window = 7 * DAY, executor?: string) {
  const g = f.as(f.governance, f.trValidator);
  const pid = await proposalId(
    await g.proposeMigrationOpen(await registry.getAddress(), PLAN, window, executor ?? ethers.ZeroAddress),
    f,
  );
  await pass(f, pid);
  await (await f.governance.execute(pid)).wait();
  return pid;
}

async function closeMigration(f: Fixture, registry: any) {
  const pid = await proposalId(
    await f.as(f.governance, f.trValidator).proposeMigrationClose(await registry.getAddress()),
    f,
  );
  await pass(f, pid);
  return f.governance.execute(pid);
}

const Phase = { NOT_STARTED: 0n, OPEN: 1n, CLOSED: 2n };

describe("ADR-0073 K1 — göç kipi (CE1)", function () {
  let f: Fixture;
  beforeEach(async () => {
    f = await loadFixture();
  });

  it("yalnız Governance açar; öneri 30 günden uzun pencere ya da boş plan özeti taşıyamaz", async () => {
    const t = (await f.now()) + DAY;
    await expect(f.as(f.issuers, f.stranger).openMigration(PLAN, t, ethers.ZeroAddress))
      .to.be.revertedWithCustomError(f.issuers, "NotGovernance")
      .withArgs(await f.stranger.getAddress());
    const g = f.as(f.governance, f.trValidator);
    const reg = await f.issuers.getAddress();
    await expect(g.proposeMigrationOpen(reg, PLAN, 30 * DAY + 1, ethers.ZeroAddress)).to.be.revertedWithCustomError(
      f.governance,
      "InvalidMigrationProposal",
    );
    await expect(g.proposeMigrationOpen(reg, ZERO, DAY, ethers.ZeroAddress)).to.be.revertedWithCustomError(
      f.governance,
      "InvalidMigrationProposal",
    );
    await expect(g.proposeMigrationOpen(reg, PLAN, 0, ethers.ZeroAddress)).to.be.revertedWithCustomError(
      f.governance,
      "InvalidMigrationProposal",
    );
    expect(await f.issuers.migrationPhase()).to.equal(Phase.NOT_STARTED);
  });

  it("öneriyle bir kez açılır; pencere yürütme anından sayılır; ikinci açılış reddedilir", async () => {
    await openMigration(f, f.issuers, 5 * DAY);
    const t = await f.now();
    expect(await f.issuers.migrationPhase()).to.equal(Phase.OPEN);
    const st = await f.issuers.migrationState();
    expect(st.openedAt).to.equal(BigInt(t));
    expect(st.deadline).to.equal(BigInt(t + 5 * DAY));
    expect(st.replayPlanHash).to.equal(PLAN);
    // ikinci açılış: öneri geçer ama kayıt reddeder (yürütme bütünüyle geri alınır)
    const pid = await proposalId(
      await f
        .as(f.governance, f.trValidator)
        .proposeMigrationOpen(await f.issuers.getAddress(), PLAN, DAY, ethers.ZeroAddress),
      f,
    );
    await pass(f, pid);
    await expect(f.governance.execute(pid)).to.be.revertedWithCustomError(f.issuers, "MigrationAlreadyStarted");
    // diğer kayıtlar etkilenmez: kip kayıt başınadır
    expect(await f.rootCAs.migrationPhase()).to.equal(Phase.NOT_STARTED);
  });

  it("uzatma yalnız açıkken ve açılıştan en çok 30 güne kadar", async () => {
    await openMigration(f, f.issuers, 5 * DAY);
    const { openedAt } = await f.issuers.migrationState();
    const g = f.as(f.governance, f.trValidator);
    const reg = await f.issuers.getAddress();
    const tooLate = await proposalId(await g.proposeMigrationExtend(reg, openedAt + BigInt(30 * DAY) + 1n), f);
    await pass(f, tooLate);
    await expect(f.governance.execute(tooLate)).to.be.revertedWithCustomError(f.issuers, "InvalidMigrationDeadline");
    const ok = await proposalId(await g.proposeMigrationExtend(reg, openedAt + BigInt(30 * DAY)), f);
    await pass(f, ok);
    await expect(f.governance.execute(ok))
      .to.emit(f.issuers, "MigrationExtended")
      .withArgs(openedAt + BigInt(30 * DAY));
  });

  it("süre dolunca kendiliğinden kapanmış sayılır; tarihli yazım ve uzatma durur; yeniden açılamaz", async () => {
    await openMigration(f, f.issuers, DAY);
    await networkHelpers.time.increase(DAY + 1);
    expect(await f.issuers.migrationPhase()).to.equal(Phase.CLOSED);
    expect(await f.issuers.isMigrationOpen()).to.equal(false);
    const past = (await f.now()) - 3600;
    await expect(f.as(f.issuers, f.trDelegate).suspendIssuerAt(f.uniIssuer, past))
      .to.be.revertedWithCustomError(f.issuers, "PastDateOutsideMigration")
      .withArgs(past);
    // kapanış önerisi ham durumu da CLOSED yapar; sonra hiçbir öneri açamaz
    await (await closeMigration(f, f.issuers)).wait();
    expect((await f.issuers.migrationState()).storedPhase).to.equal(Phase.CLOSED);
    const pid = await proposalId(
      await f
        .as(f.governance, f.trValidator)
        .proposeMigrationOpen(await f.issuers.getAddress(), PLAN, DAY, ethers.ZeroAddress),
      f,
    );
    await pass(f, pid);
    await expect(f.governance.execute(pid)).to.be.revertedWithCustomError(f.issuers, "MigrationAlreadyStarted");
  });

  it("kapanış önerisiyle kesin kapanır: uzatma ve yeniden açma reddedilir", async () => {
    await openMigration(f, f.issuers, 10 * DAY);
    await expect(closeMigration(f, f.issuers)).to.emit(f.issuers, "MigrationClosed");
    expect(await f.issuers.migrationPhase()).to.equal(Phase.CLOSED);
    const pid = await proposalId(
      await f
        .as(f.governance, f.trValidator)
        .proposeMigrationExtend(await f.issuers.getAddress(), (await f.now()) + DAY),
      f,
    );
    await pass(f, pid);
    await expect(f.governance.execute(pid)).to.be.revertedWithCustomError(f.issuers, "MigrationNotOpen");
  });

  it("yükseltme kapanmış kipi sıfırlayamaz: durum değişirse yükseltme bütünüyle geri alınır", async () => {
    await openMigration(f, f.issuers, DAY);
    await (await closeMigration(f, f.issuers)).wait();
    const before = await f.issuers.migrationState();
    const bad = await ethers.deployContract("MigrationResetMock");
    const sel = bad.interface.getFunction("resetMigration")!.selector;
    const g = f.as(f.governance, f.trValidator);
    const pid = await proposalId(
      await g.proposeProtocolUpgradeAndInit(await f.issuers.getAddress(), await bad.getAddress(), sel),
      f,
    );
    await pass(f, pid);
    await (await f.governance.execute(pid)).wait(); // kuyruk (GE1)
    await networkHelpers.time.increase(7 * DAY);
    await expect(f.governance.execute(pid))
      .to.be.revertedWithCustomError(f.governance, "MigrationStateChanged")
      .withArgs(await f.issuers.getAddress());
    expect(await f.issuers.migrationState()).to.deep.equal(before);
    // durumu koruyan sıradan yükseltme geçer
    const good = await ethers.deployContract("IssuerRegistry");
    const pid2 = await proposalId(
      await g.proposeProtocolUpgrade(await f.issuers.getAddress(), await good.getAddress()),
      f,
    );
    await pass(f, pid2);
    await (await f.governance.execute(pid2)).wait();
    await networkHelpers.time.increase(7 * DAY);
    await expect(f.governance.execute(pid2)).to.emit(f.governance, "ProposalExecuted");
    expect(await f.issuers.migrationPhase()).to.equal(Phase.CLOSED);
  });

  it("kip dışında açık tarih reddedilir; kayıt anı da verilemez", async () => {
    const past = (await f.now()) - 100;
    await expect(f.as(f.issuers, f.trDelegate).suspendIssuerAt(f.uniIssuer, past)).to.be.revertedWithCustomError(
      f.issuers,
      "PastDateOutsideMigration",
    );
    await expect(f.as(f.rootCAs, f.trDelegate).retireRootCAAt(f.trCA, ZERO, past)).to.be.revertedWithCustomError(
      f.rootCAs,
      "PastDateOutsideMigration",
    );
    const t = await f.now();
    await expect(
      f.as(f.rootCAs, f.trDelegate).registerRootCA({
        caId: ZERO,
        stateCode: TR,
        certFingerprint: id("CA-X"),
        subjectHash: id("s"),
        certURI: "",
        crlURI: "",
        status: CAStatus.ACTIVE,
        validFrom: t,
        validUntil: t + DAY,
        registeredAt: past,
      }),
    ).to.be.revertedWithCustomError(f.rootCAs, "PastDateOutsideMigration");
    // at = 0 → blok zamanı (kip gerekmez)
    await expect(f.as(f.issuers, f.trDelegate).suspendIssuerAt(f.uniIssuer, 0)).to.emit(f.issuers, "IssuerSuspended");
  });

  it("kip açıkken: geçmiş tarih yazılır, gelecek tarih ve sıra dışı tarih reddedilir, kota sayılmaz", async () => {
    await openMigration(f, f.issuers, 7 * DAY);
    const now = await f.now();
    const w = f.as(f.issuers, f.trDelegate);
    await expect(w.suspendIssuerAt(f.uniIssuer, now + 1000))
      .to.be.revertedWithCustomError(f.issuers, "DateInFuture")
      .withArgs(now + 1000);
    const before = await f.issuers.writeCountToday(TR);
    // fikstür kurumu kip dışında kaydedildi (ilk pencere since = 0); geçmiş tarihli askı ve dönüş
    await expect(w.suspendIssuerAt(f.uniIssuer, now - 500))
      .to.emit(f.issuers, "IssuerStatusChanged")
      .withArgs(f.uniIssuer, Status.SUSPENDED, now - 500);
    await expect(w.reinstateIssuerAt(f.uniIssuer, now - 600)).to.be.revertedWithCustomError(
      f.issuers,
      "StatusOutOfOrder",
    );
    await (await w.reinstateIssuerAt(f.uniIssuer, now - 400)).wait();
    expect(await f.issuers.writeCountToday(TR)).to.equal(before); // CE1: kip açıkken kota uygulanmaz
    expect(await f.issuers.issuerStatusAt(f.uniIssuer, now - 450)).to.equal(Status.SUSPENDED);
    expect(await f.issuers.issuerStatusAt(f.uniIssuer, now - 400)).to.equal(Status.ACTIVE);
    const h = await f.issuers.issuerStatusHistoryOf(f.uniIssuer);
    expect(h.map((c: any) => [Number(c.since), Number(c.status)])).to.deep.equal([
      [0, Status.ACTIVE],
      [now - 500, Status.SUSPENDED],
      [now - 400, Status.ACTIVE],
    ]);
  });

  it("göçte kayıt anı listedeki ilk durum anıdır: ondan önceki iat ret (liste: statusAt boş → NO)", async () => {
    await openMigration(f, f.issuers, 7 * DAY);
    const now = await f.now();
    const t0 = now - 10 * DAY;
    await (
      await f.as(f.issuers, f.trDelegate).registerIssuer({
        issuerId: ZERO,
        stateCode: TR,
        nameHash: id("Old Institute"),
        category: IssuerCategory.EDUCATION,
        assurance: IssuerAssurance.I2,
        certFingerprint: id("OLD-CERT"),
        parentCA: f.trCA,
        metadataURI: "",
        status: Status.ACTIVE,
        validFrom: t0 - DAY,
        validUntil: now + 365 * DAY,
        successorId: ZERO,
        registeredAt: t0,
        revokedAt: 0,
      })
    ).wait();
    const oldId = ethers.keccak256(ethers.concat([TR, id("OLD-CERT")]));
    expect((await f.issuers.getIssuer(oldId)).registeredAt).to.equal(BigInt(t0));
    expect(await f.issuers.issuerStatusAt(oldId, t0 - 1)).to.equal(Status.NONE);
    // kök fikstürde kip dışında kaydedildi (ilk pencere since = 0) → C1 yalnız kurumun durumuna bağlı
    expect(await f.issuers.isCredentialAcceptable(oldId, t0 - 1)).to.equal(false);
    expect(await f.issuers.isCredentialAcceptable(oldId, t0)).to.equal(true);
  });

  it("ağ şemasını kip açıkken tek göç yürütücüsü yazar; kip kapanınca yazamaz", async () => {
    const exec = f.stranger;
    const rec = f.schemaRecord(NET_VCT, SchemaTier.NETWORK, "0x0000");
    await expect(f.as(f.schemas, exec).registerSchema(rec)).to.be.revertedWithCustomError(
      f.schemas,
      "NetworkTierRequiresGovernance",
    );
    await openMigration(f, f.schemas, DAY, await exec.getAddress());
    await expect(f.as(f.schemas, exec).registerSchema(rec)).to.emit(f.schemas, "SchemaRegistered");
    // yürütücü ulusal şemaya yazamaz (egemenlik N1)
    await expect(
      f.as(f.schemas, exec).registerSchema(f.schemaRecord(EDU, SchemaTier.NATIONAL, TR)),
    ).to.be.revertedWithCustomError(f.schemas, "NotOwnerState");
    await (await closeMigration(f, f.schemas)).wait();
    await expect(f.as(f.schemas, exec).deprecateSchema(id(NET_VCT), ZERO)).to.be.revertedWithCustomError(
      f.schemas,
      "NetworkTierRequiresGovernance",
    );
  });

  it("StatusListRegistry: kip açıkken günlük yayın kotası uygulanmaz, sürüm ve yayın anı kuralları sürer", async () => {
    const op = f.as(f.statusLists, f.uniOperator);
    const uri = "https://status.example/l/9";
    await (await op.registerList(f.uniIssuer, uri, 100_000, 2)).wait();
    const listId = await f.statusLists.listIdOf(f.uniIssuer, uri);
    await openMigration(f, f.statusLists, DAY);
    const start = (await f.now()) - 60 * DAY;
    for (let v = 1; v <= 50; v++) {
      await (await op.publishList(listId, id(`v${v}`), v, start + v * 3600)).wait();
    }
    expect(await f.statusLists.publishCountToday(listId)).to.equal(0n);
    await expect(op.publishList(listId, id("v51"), 51, start)).to.be.revertedWithCustomError(
      f.statusLists,
      "PublishedAtNotMonotonic",
    );
  });
});

describe("ADR-0073 K5 — iat anındaki durum, yarı açık sınırlar (CE5)", function () {
  let f: Fixture;
  beforeEach(async () => {
    f = await loadFixture();
  });

  it("iptal anı sınırı: iat < revokedAt kabul, iat = revokedAt ret (bir saniyelik fark kapandı)", async () => {
    await networkHelpers.time.increase(100);
    await (await f.as(f.issuers, f.trDelegate).revokeIssuer(f.uniIssuer, ZERO)).wait();
    const revokedAt = Number((await f.issuers.getIssuer(f.uniIssuer)).revokedAt);
    expect(await f.issuers.isCredentialAcceptable(f.uniIssuer, revokedAt - 1)).to.equal(true);
    expect(await f.issuers.isCredentialAcceptable(f.uniIssuer, revokedAt)).to.equal(false);
  });

  it("listedeki RETIRED: yumuşak iptal + IssuerRetired; önceki belgeler geçerli", async () => {
    await networkHelpers.time.increase(100);
    const before = (await f.now()) - 1;
    await expect(f.as(f.issuers, f.trDelegate).retireIssuer(f.uniIssuer, ZERO, 0))
      .to.emit(f.issuers, "IssuerRetired")
      .withArgs(f.uniIssuer, ZERO);
    expect((await f.issuers.getIssuer(f.uniIssuer)).status).to.equal(Status.REVOKED);
    expect(await f.issuers.isCredentialAcceptable(f.uniIssuer, before)).to.equal(true);
    expect(await f.issuers.isCredentialAcceptable(f.uniIssuer, await f.now())).to.equal(false);
  });

  it("şema yetkisi sınırı: iat < until kabul, iat = until ret", async () => {
    const edu = await f.registerNationalSchema(TR, f.trDelegate, EDU, id("edu"));
    await (await f.as(f.issuers, f.trDelegate).setSchemaAuthorization(f.uniIssuer, edu, true)).wait();
    await networkHelpers.time.increase(100);
    await (await f.as(f.issuers, f.trDelegate).setSchemaAuthorization(f.uniIssuer, edu, false)).wait();
    const until = Number((await f.issuers.schemaAuthOf(f.uniIssuer, edu)).until);
    expect(await f.issuers.isCredentialSchemaAcceptable(f.uniIssuer, edu, until - 1)).to.equal(true);
    expect(await f.issuers.isCredentialSchemaAcceptable(f.uniIssuer, edu, until)).to.equal(false);
  });

  it("emekli kök: emeklilikten ÖNCE verilmiş belge kabul, sonra verilmiş ret (önceden ikisi de kabuldü)", async () => {
    await networkHelpers.time.increase(100);
    const before = await f.now();
    await networkHelpers.time.increase(10);
    await (await f.as(f.rootCAs, f.trDelegate).retireRootCA(f.trCA, ZERO)).wait();
    const retiredAt = await f.now();
    expect(await f.rootCAs.isChainAcceptable(f.trCA)).to.equal(true); // bugünkü soru: rotasyon operasyonu sürdürür
    expect(await f.issuers.isCredentialAcceptable(f.uniIssuer, before)).to.equal(true);
    expect(await f.issuers.isCredentialAcceptable(f.uniIssuer, retiredAt)).to.equal(false);
    expect(await f.rootCAs.rootCAStatusAt(f.trCA, retiredAt)).to.equal(CAStatus.RETIRED);
  });

  it("askıdaki kök: askıdan önceki belge kabul, askı süresinde ret; bir kez REVOKED kök bütün altını düşürür (CA2)", async () => {
    await networkHelpers.time.increase(100);
    const before = await f.now();
    await networkHelpers.time.increase(10);
    await (await f.as(f.rootCAs, f.trDelegate).suspendRootCA(f.trCA)).wait();
    const during = await f.now();
    expect(await f.issuers.isCredentialAcceptable(f.uniIssuer, before)).to.equal(true);
    expect(await f.issuers.isCredentialAcceptable(f.uniIssuer, during)).to.equal(false);
    await (await f.as(f.rootCAs, f.trDelegate).revokeRootCA(f.trCA, "")).wait();
    expect(await f.issuers.isCredentialAcceptable(f.uniIssuer, before)).to.equal(false);
  });

  it("ROLLING_OVER eşlemesi: kök ACTIVE kalır, halef olayla yayılır", async () => {
    const next = await f.registerCA(TR, f.trDelegate, id("TR-ROOT-CA-2"));
    await expect(f.as(f.rootCAs, f.trDelegate).announceRootCARollover(f.trCA, next))
      .to.emit(f.rootCAs, "RootCARollingOver")
      .withArgs(f.trCA, next);
    expect((await f.rootCAs.getRootCA(f.trCA)).status).to.equal(CAStatus.ACTIVE);
    await expect(f.as(f.rootCAs, f.trDelegate).announceRootCARollover(f.trCA, f.trCA)).to.be.revertedWithCustomError(
      f.rootCAs,
      "UnknownCA",
    );
  });

  it("şema DEPRECATED: önce verilmiş belge C2'de kabul, sonra verilmiş ret; REVOKED hepsini düşürür", async () => {
    const edu = await f.registerNationalSchema(TR, f.trDelegate, EDU, id("edu"));
    await (await f.as(f.issuers, f.trDelegate).setSchemaAuthorization(f.uniIssuer, edu, true)).wait();
    await networkHelpers.time.increase(100);
    const before = await f.now();
    await networkHelpers.time.increase(10);
    await (await f.as(f.schemas, f.trDelegate).deprecateSchema(edu, ZERO)).wait();
    const after = await f.now();
    expect(await f.issuers.isCredentialSchemaAcceptable(f.uniIssuer, edu, before)).to.equal(true);
    expect(await f.issuers.isCredentialSchemaAcceptable(f.uniIssuer, edu, after)).to.equal(false);
    await (await f.as(f.schemas, f.trDelegate).revokeSchema(edu, "")).wait();
    expect(await f.issuers.isCredentialSchemaAcceptable(f.uniIssuer, edu, before)).to.equal(false);
  });
});

/** Liste kuralı (packages/trust TrustSource): statusAt = since ≤ iat olan son değişiklik. */
function listStatusAt(history: Array<[number, number]>, iat: number): number {
  let cur = 0;
  for (const [since, st] of history) if (since <= iat) cur = st;
  return cur;
}

describe("ADR-0073 K2 — sert iptal `invalidatesFrom` (CE2)", function () {
  let f: Fixture;
  beforeEach(async () => {
    f = await loadFixture();
  });

  it("yalnız REVOKED kurumda, validFrom ≤ tarih ≤ revokedAt; o andan itibaren verilen belge düşer", async () => {
    const vf = Number((await f.issuers.getIssuer(f.uniIssuer)).validFrom);
    const w = f.as(f.issuers, f.trDelegate);
    await expect(w.setIssuerInvalidatesFrom(f.uniIssuer, vf + 10))
      .to.be.revertedWithCustomError(f.issuers, "InvalidInvalidatesFrom")
      .withArgs(vf + 10); // henüz iptal yok
    await networkHelpers.time.increase(1000);
    await (await w.revokeIssuer(f.uniIssuer, ZERO)).wait();
    const revokedAt = Number((await f.issuers.getIssuer(f.uniIssuer)).revokedAt);
    await expect(w.setIssuerInvalidatesFrom(f.uniIssuer, vf - 1)).to.be.revertedWithCustomError(
      f.issuers,
      "InvalidInvalidatesFrom",
    );
    await expect(w.setIssuerInvalidatesFrom(f.uniIssuer, revokedAt + 1)).to.be.revertedWithCustomError(
      f.issuers,
      "InvalidInvalidatesFrom",
    );
    // kip dışında da yazılır (CE2 istisnası): ele geçirilme sonradan anlaşılır
    await expect(w.setIssuerInvalidatesFrom(f.uniIssuer, vf + 500))
      .to.emit(f.issuers, "IssuerInvalidatedFrom")
      .withArgs(f.uniIssuer, vf + 500);
    expect(await f.issuers.invalidatesFromOf(f.uniIssuer)).to.equal(BigInt(vf + 500));
    expect(await f.issuers.isCredentialAcceptable(f.uniIssuer, vf + 499)).to.equal(true);
    expect(await f.issuers.isCredentialAcceptable(f.uniIssuer, vf + 500)).to.equal(false);
    expect(await f.issuers.isCredentialAcceptable(f.uniIssuer, revokedAt - 1)).to.equal(false);
  });

  it("yazılan tarih silinmez, yalnız geriye çekilir; yabancı devlet yazamaz", async () => {
    const vf = Number((await f.issuers.getIssuer(f.uniIssuer)).validFrom);
    const w = f.as(f.issuers, f.trDelegate);
    await networkHelpers.time.increase(1000);
    await (await w.revokeIssuer(f.uniIssuer, ZERO)).wait();
    await (await w.setIssuerInvalidatesFrom(f.uniIssuer, vf + 500)).wait();
    await expect(w.setIssuerInvalidatesFrom(f.uniIssuer, vf + 500)).to.be.revertedWithCustomError(
      f.issuers,
      "InvalidInvalidatesFrom",
    );
    await expect(w.setIssuerInvalidatesFrom(f.uniIssuer, vf + 600)).to.be.revertedWithCustomError(
      f.issuers,
      "InvalidInvalidatesFrom",
    );
    await (await w.setIssuerInvalidatesFrom(f.uniIssuer, vf + 100)).wait();
    expect(await f.issuers.isCredentialAcceptable(f.uniIssuer, vf + 100)).to.equal(false);
    expect(await f.issuers.isCredentialAcceptable(f.uniIssuer, vf + 99)).to.equal(true);
    await expect(
      f.as(f.issuers, f.kzDelegate).setIssuerInvalidatesFrom(f.uniIssuer, vf + 50),
    ).to.be.revertedWithCustomError(f.issuers, "NotOwnerState");
  });
});

describe("ADR-0073 K6 öncüsü — kontrat C1 = liste kuralı (rastgele tarihli durum dizisi)", function () {
  this.timeout(300_000);
  const SEEDS = process.env.TAMGA_FUZZ_SEED ? [Number(process.env.TAMGA_FUZZ_SEED)] : [11, 12, 13];
  for (const seed of SEEDS) {
    it(`tohum ${seed}: her sorguda kontrat ve liste kuralı aynı cevabı verir`, async () => {
      const f: Fixture = await loadFixture();
      let a = seed >>> 0;
      const rnd = () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      await openMigration(f, f.issuers, 30 * DAY);
      const now = await f.now();
      const w = f.as(f.issuers, f.trDelegate);
      // göçte kaydedilen kurum: geçerlilik 30 gün önce başlar, ilk durum anı t0 (liste: status_history[0].since)
      const t0 = now - 25 * DAY;
      await (
        await w.registerIssuer({
          issuerId: ZERO,
          stateCode: TR,
          nameHash: id("Replay Institute"),
          category: IssuerCategory.EDUCATION,
          assurance: IssuerAssurance.I2,
          certFingerprint: id(`REPLAY-${seed}`),
          parentCA: f.trCA,
          metadataURI: "",
          status: Status.ACTIVE,
          validFrom: now - 30 * DAY,
          validUntil: now + 365 * DAY,
          successorId: ZERO,
          registeredAt: t0,
          revokedAt: 0,
        })
      ).wait();
      const who = ethers.keccak256(ethers.concat([TR, id(`REPLAY-${seed}`)]));
      const history: Array<[number, number]> = [[t0, Status.ACTIVE]];
      let status = Status.ACTIVE;
      let t = t0;
      let inv = 0;
      for (let step = 0; step < 12 && status !== Status.REVOKED; step++) {
        t += 1 + Math.floor(rnd() * DAY);
        if (t >= now) break;
        const op = rnd();
        let ok = false;
        if (status === Status.ACTIVE && op < 0.5) {
          await (await w.suspendIssuerAt(who, t)).wait();
          status = Status.SUSPENDED;
          ok = true;
        } else if (status === Status.SUSPENDED && op < 0.7) {
          await (await w.reinstateIssuerAt(who, t)).wait();
          status = Status.ACTIVE;
          ok = true;
        } else if (op > 0.9) {
          await (await w.revokeIssuerAt(who, ZERO, t)).wait();
          status = Status.REVOKED;
          ok = true;
          if (rnd() < 0.6) {
            // ele geçirilme: sert iptal tarihi [validFrom, revokedAt] içinde
            const vf = now - 30 * DAY;
            inv = vf + Math.floor(rnd() * (t - vf + 1));
            await (await w.setIssuerInvalidatesFrom(who, inv)).wait();
          }
        }
        if (ok) history.push([t, status]);
      }
      const i = await f.issuers.getIssuer(who);
      const lo = Number(i.validFrom);
      const probes = new Set<number>();
      for (const [since] of history) [since - 1, since, since + 1].forEach((x) => probes.add(x));
      if (inv) [inv - 1, inv, inv + 1].forEach((x) => probes.add(x));
      for (let k = 0; k < 20; k++) probes.add(now - Math.floor(rnd() * 32 * DAY));
      for (const iat of probes) {
        // TrustSource.isCredentialAcceptable: pencere, iat anındaki durum ACTIVE, invalidates_from ≤ iat → NO
        const model =
          iat >= lo &&
          iat <= Number(i.validUntil) &&
          listStatusAt(history, iat) === Status.ACTIVE &&
          !(inv && inv <= iat);
        expect(await f.issuers.isCredentialAcceptable(who, iat), `iat ${iat}`).to.equal(model);
      }
    });
  }
});
