/**
 * Kontrat güvenlik turu 2026-11-04 — düşük / bilgi bulguları:
 *   - göç penceresi açıkken tarihsiz olağan yazım dondurulur (yalnız Governance tarihsiz yazar; ADR-0073 K1 "tarih açıkça");
 *   - kapanmış istek kapsamı ve kapı grubu aynı kimlikle sessizce yeniden açılamaz;
 *   - kapı grubunun kurum bağı aynı devletin kayıtlı kurumu ya da doğrulayıcısıdır (ADR-0054 NS2);
 *   - kip dışında kurum / kök CA geçerlilik başlangıcı geçmişe çekilemez.
 */
import { expect } from "chai";

import {
  CAStatus,
  DAY,
  IssuerAssurance,
  IssuerCategory,
  KZ,
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

async function openMigration(f: Fixture, registry: any, window = 7 * DAY, executor = ethers.ZeroAddress) {
  const pid = await proposalId(
    await f.as(f.governance, f.trValidator).proposeMigrationOpen(await registry.getAddress(), PLAN, window, executor),
    f,
  );
  await pass(f, pid);
  await (await f.governance.execute(pid)).wait();
}

const issuer = (over: Record<string, unknown>) => ({
  issuerId: ZERO,
  stateCode: TR,
  nameHash: id("Institute"),
  category: IssuerCategory.EDUCATION,
  assurance: IssuerAssurance.I2,
  certFingerprint: id("NEW-CERT"),
  parentCA: ZERO,
  metadataURI: "",
  status: Status.ACTIVE,
  validFrom: 0,
  validUntil: 0,
  successorId: ZERO,
  registeredAt: 0,
  revokedAt: 0,
  ...over,
});

describe("güvenlik turu 2026-11-04 — göç penceresinde tarihsiz yazım dondurulur", function () {
  let f: Fixture;
  beforeEach(async () => {
    f = await loadFixture();
  });

  it("devlet delegesi pencerede tarihsiz yazamaz; açık tarihle (şimdi dahil) yazar", async () => {
    await openMigration(f, f.issuers);
    const w = f.as(f.issuers, f.trDelegate);
    await expect(w.suspendIssuer(f.uniIssuer)).to.be.revertedWithCustomError(f.issuers, "DateRequiredDuringMigration");
    await expect(w.suspendIssuerAt(f.uniIssuer, 0)).to.be.revertedWithCustomError(
      f.issuers,
      "DateRequiredDuringMigration",
    );
    const now = await f.now();
    await expect(
      w.registerIssuer(issuer({ parentCA: f.trCA, validUntil: now + 365 * DAY })),
    ).to.be.revertedWithCustomError(f.issuers, "DateRequiredDuringMigration");
    // acil yazım: açık tarih = şimdi
    await expect(w.suspendIssuerAt(f.uniIssuer, now)).to.emit(f.issuers, "IssuerSuspended");
    // kip kapanınca (süre dolunca) tarihsiz yazım yine serbest
    await networkHelpers.time.increase(7 * DAY + 1);
    await expect(w.reinstateIssuer(f.uniIssuer)).to.emit(f.issuers, "IssuerReinstated");
  });

  it("Governance pencerede tarihsiz yazar (ağ şeması deprecate önerisi); iptal listesi yayını tarih ister", async () => {
    const vct = "urn:tamga:edu:TranscriptCredential:1";
    const p1 = await proposalId(
      await f.as(f.governance, f.trValidator).proposeNetworkSchema(f.schemaRecord(vct, SchemaTier.NETWORK, "0x0000")),
      f,
    );
    await pass(f, p1);
    await (await f.governance.execute(p1)).wait();
    await openMigration(f, f.schemas);
    const p2 = await proposalId(
      await f.as(f.governance, f.trValidator).proposeNetworkSchemaDeprecation(id(vct), ZERO),
      f,
    );
    await pass(f, p2);
    await expect(f.governance.execute(p2)).to.emit(f.schemas, "SchemaDeprecated");

    const op = f.as(f.statusLists, f.uniOperator);
    const uri = "https://status.example/l/42";
    await (await op.registerList(f.uniIssuer, uri, 100_000, 2)).wait();
    const listId = await f.statusLists.listIdOf(f.uniIssuer, uri);
    await openMigration(f, f.statusLists);
    await expect(op.publishList(listId, id("v1"), 1, 0)).to.be.revertedWithCustomError(
      f.statusLists,
      "DateRequiredDuringMigration",
    );
    await expect(op.publishList(listId, id("v1"), 1, await f.now())).to.emit(f.statusLists, "ListPublished");
  });
});

describe("güvenlik turu 2026-11-04 — kapsam ve kapı grubu", function () {
  let f: Fixture;
  const RP = id("gate.example.org");
  const RP_KZ = id("kz.example.org");
  beforeEach(async () => {
    f = await loadFixture();
    const base = { nameHash: id("n"), status: 1, registeredAt: 0 };
    await (
      await f
        .as(f.relyingParties, f.trDelegate)
        .registerRelyingParty({ ...base, stateCode: TR, rpId: RP, accessCertFingerprint: id("c1") })
    ).wait();
    await (
      await f
        .as(f.relyingParties, f.kzDelegate)
        .registerRelyingParty({ ...base, stateCode: KZ, rpId: RP_KZ, accessCertFingerprint: id("c2") })
    ).wait();
  });

  const scope = (over: Record<string, unknown> = {}) => ({
    scopeHash: id("diploma-check"),
    serviceHash: id("hiring"),
    schemaId: id("urn:tamga:tr:edu:DiplomaCredential:1"),
    format: 0,
    namespaceHash: ZERO,
    attributes: [id("degree")],
    validFrom: 0,
    validUntil: 0,
    detailsHash: id("purpose"),
    ...over,
  });
  const group = (over: Record<string, unknown> = {}) => ({
    groupId: id("main-gate"),
    institutionId: RP,
    policyIds: [id("entry-18")],
    certFingerprints: [id("gate-cert-1")],
    offlineAllowed: false,
    validFrom: 0,
    validUntil: 0,
    labelHash: id("label"),
    ...over,
  });

  it("kapanmış kapsam aynı kimlikle yeniden açılamaz; açık kapsam güncellenir", async () => {
    const w = f.as(f.relyingParties, f.trDelegate);
    await (await w.setRequestScope(RP, scope())).wait();
    await (await w.setRequestScope(RP, scope({ attributes: [id("degree"), id("year")].sort() }))).wait();
    await (await w.closeRequestScope(RP, id("diploma-check"), 0)).wait();
    await expect(w.setRequestScope(RP, scope()))
      .to.be.revertedWithCustomError(f.relyingParties, "ScopeClosed")
      .withArgs(RP, id("diploma-check"));
    // süresi kendiliğinden dolan kapsam da yeniden açılmaz
    const t = await f.now();
    await (await w.setRequestScope(RP, scope({ scopeHash: id("short"), validUntil: t + DAY }))).wait();
    await networkHelpers.time.increase(DAY);
    await expect(w.setRequestScope(RP, scope({ scopeHash: id("short") }))).to.be.revertedWithCustomError(
      f.relyingParties,
      "ScopeClosed",
    );
    // yeni kimlikle yeni kullanım serbest
    await expect(w.setRequestScope(RP, scope({ scopeHash: id("diploma-check-2") }))).to.emit(
      f.relyingParties,
      "RequestScopeSet",
    );
  });

  it("geri çekilmiş kapı grubu aynı kimlikle yeniden açılamaz", async () => {
    const w = f.as(f.relyingParties, f.trDelegate);
    await (await w.setTerminalGroup(RP, group())).wait();
    await networkHelpers.time.increase(10);
    await (await w.closeTerminalGroup(RP, id("main-gate"), 0)).wait();
    await expect(w.setTerminalGroup(RP, group()))
      .to.be.revertedWithCustomError(f.relyingParties, "TerminalGroupNotOpen")
      .withArgs(id("main-gate"));
    expect(await f.relyingParties.isActiveTerminalCertificate(id("main-gate"), id("gate-cert-1"))).to.equal(false);
  });

  it("kurum bağı: kendisi, aynı devletin doğrulayıcısı ya da kurumu; yabancı ya da bilinmeyen kimlik reddedilir", async () => {
    const w = f.as(f.relyingParties, f.trDelegate);
    await expect(w.setTerminalGroup(RP, group({ institutionId: f.uniIssuer }))).to.emit(
      f.relyingParties,
      "TerminalGroupSet",
    );
    await expect(w.setTerminalGroup(RP, group({ groupId: id("g2"), institutionId: id("yok") })))
      .to.be.revertedWithCustomError(f.relyingParties, "UnknownInstitution")
      .withArgs(id("yok"));
    await expect(
      w.setTerminalGroup(RP, group({ groupId: id("g3"), institutionId: RP_KZ })),
    ).to.be.revertedWithCustomError(f.relyingParties, "UnknownInstitution");
    // KZ kurumu TR doğrulayıcısının kurum bağı olamaz
    const kzCA = await f.registerCA(KZ, f.kzDelegate, id("KZ-ROOT"));
    const kzIssuer = await f.registerIssuer(
      KZ,
      f.kzDelegate,
      kzCA,
      id("KZ-UNI"),
      IssuerCategory.EDUCATION,
      IssuerAssurance.I2,
    );
    await expect(
      w.setTerminalGroup(RP, group({ groupId: id("g4"), institutionId: kzIssuer })),
    ).to.be.revertedWithCustomError(f.relyingParties, "UnknownInstitution");
  });
});

describe("güvenlik turu 2026-11-04 — kip dışında geçerlilik başlangıcı geçmişe çekilemez", function () {
  let f: Fixture;
  beforeEach(async () => {
    f = await loadFixture();
  });

  it("kurum ve kök CA: geçmiş validFrom kip dışında ret, gelecek validFrom serbest, kipte geçmiş serbest", async () => {
    const t = await f.now();
    const w = f.as(f.issuers, f.trDelegate);
    await expect(
      w.registerIssuer(issuer({ parentCA: f.trCA, validFrom: t - DAY, validUntil: t + DAY })),
    ).to.be.revertedWithCustomError(f.issuers, "PastDateOutsideMigration");
    await expect(
      f.as(f.rootCAs, f.trDelegate).registerRootCA({
        caId: ZERO,
        stateCode: TR,
        certFingerprint: id("CA-PAST"),
        subjectHash: id("s"),
        certURI: "",
        crlURI: "",
        status: CAStatus.ACTIVE,
        validFrom: t - DAY,
        validUntil: t + DAY,
        registeredAt: 0,
      }),
    ).to.be.revertedWithCustomError(f.rootCAs, "PastDateOutsideMigration");
    // validFrom = 0 iken validUntil geçmişte olamaz (önceden ham 0 ile karşılaştırılıyordu)
    await expect(w.registerIssuer(issuer({ parentCA: f.trCA, validUntil: t }))).to.be.revertedWithCustomError(
      f.issuers,
      "InvalidValidity",
    );
    await expect(w.registerIssuer(issuer({ parentCA: f.trCA, validFrom: t + DAY, validUntil: t + 2 * DAY }))).to.emit(
      f.issuers,
      "IssuerRegistered",
    );
    await openMigration(f, f.issuers);
    await expect(
      w.registerIssuer(
        issuer({
          parentCA: f.trCA,
          certFingerprint: id("OLD"),
          validFrom: t - DAY,
          validUntil: t + DAY,
          registeredAt: t - 100,
        }),
      ),
    ).to.emit(f.issuers, "IssuerRegistered");
  });
});
