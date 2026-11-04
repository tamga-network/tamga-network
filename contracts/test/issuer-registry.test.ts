/**
 * SPEC-BC-0001 §3 — allowlist (I1), yumuşak iptal (I2), yetki penceresi (I3), kategori aşımı (PM-SCHEMA-0001 Zafiyet 1),
 * review R1–R3, CA2/CA3.
 */
import { expect } from "chai";

import {
  DAY,
  IssuerAssurance,
  IssuerCategory,
  TR,
  ZERO,
  id,
  loadFixture,
  networkHelpers,
  type Fixture,
} from "./helpers/fixture.js";

const EDU = "urn:tamga:tr:edu:DiplomaCredential:1"; // ulusal (TR) şema — ADR-0054 NS1
const HEALTH = "urn:tamga:tr:health:VaccinationCredential:1";

describe("IssuerRegistry (SPEC-BC-0001 §3)", function () {
  let f: Fixture;
  beforeEach(async () => {
    f = await loadFixture();
  });

  it("PM-SCHEMA-0001 Zafiyet 1: kategori aşımı engellenir — EDUCATION kurumu sağlık şemasına yetkili değil", async () => {
    const edu = await f.registerNationalSchema(TR, f.trDelegate, EDU, id("edu"));
    const health = await f.registerNationalSchema(TR, f.trDelegate, HEALTH, id("health"));
    await f.as(f.issuers, f.trDelegate).setSchemaAuthorization(f.uniIssuer, edu, true);
    expect(await f.issuers.isValidIssuer(f.uniIssuer)).to.equal(true);
    expect(await f.issuers.isAuthorizedForSchema(f.uniIssuer, edu)).to.equal(true);
    expect(await f.issuers.isAuthorizedForSchema(f.uniIssuer, health)).to.equal(false);
  });

  it("I1: yetki varsayılanı false", async () => {
    const edu = await f.registerNationalSchema(TR, f.trDelegate, EDU, id("edu"));
    expect(await f.issuers.isAuthorizedForSchema(f.uniIssuer, edu)).to.equal(false);
    expect(await f.issuers.isCredentialSchemaAcceptable(f.uniIssuer, edu, await f.now())).to.equal(false);
  });

  it("DEPRECATED şema ile YENİ ihraç yapılamaz (3. koşul)", async () => {
    const edu = await f.registerNationalSchema(TR, f.trDelegate, EDU, id("edu"));
    await f.as(f.issuers, f.trDelegate).setSchemaAuthorization(f.uniIssuer, edu, true);
    await f.as(f.schemas, f.trDelegate).deprecateSchema(edu, ZERO);
    expect(await f.issuers.isAuthorizedForSchema(f.uniIssuer, edu)).to.equal(false);
  });

  it("yetki geri alınabilir ve listeden düşer; yalnız sahibi devlet yazar", async () => {
    const edu = await f.registerNationalSchema(TR, f.trDelegate, EDU, id("edu"));
    const w = f.as(f.issuers, f.trDelegate);
    await w.setSchemaAuthorization(f.uniIssuer, edu, true);
    expect(await f.issuers.authorizedSchemasOf(f.uniIssuer)).to.deep.equal([edu]);
    await w.setSchemaAuthorization(f.uniIssuer, edu, false);
    expect(await f.issuers.authorizedSchemasOf(f.uniIssuer)).to.deep.equal([]);
    expect(await f.issuers.isAuthorizedForSchema(f.uniIssuer, edu)).to.equal(false);
    await expect(
      f.as(f.issuers, f.kzDelegate).setSchemaAuthorization(f.uniIssuer, edu, true),
    ).to.be.revertedWithCustomError(f.issuers, "NotOwnerState");
  });

  it("§3.3 yumuşak iptal: REVOKED issuer yeni belge veremez; kayıt ve halef durur", async () => {
    const successor = await f.registerIssuer(
      TR,
      f.trDelegate,
      f.trCA,
      id("YOK-CERT"),
      IssuerCategory.GOVERNMENT,
      IssuerAssurance.I3,
    );
    await f.as(f.issuers, f.trDelegate).revokeIssuer(f.uniIssuer, successor);
    expect(await f.issuers.isValidIssuer(f.uniIssuer)).to.equal(false);
    const i = await f.issuers.getIssuer(f.uniIssuer);
    expect(i.successorId).to.equal(successor);
    expect(i.certFingerprint).to.equal(id("BILGI-CERT"));
    expect(i.revokedAt).to.not.equal(0n);
    await expect(f.as(f.issuers, f.trDelegate).revokeIssuer(f.uniIssuer, ZERO)).to.be.revertedWithCustomError(
      f.issuers,
      "AlreadyRevoked",
    );
  });

  it("halef ACTIVE olmalı", async () => {
    await expect(f.as(f.issuers, f.trDelegate).revokeIssuer(f.uniIssuer, id("yok"))).to.be.revertedWithCustomError(
      f.issuers,
      "SuccessorNotActive",
    );
  });

  it("R1 — yumuşak iptalin gerçek testi: iptalden ÖNCE verilen kabul, SONRA verilen (sahte tarihli) red", async () => {
    const issuedBefore = await f.now();
    await networkHelpers.time.increase(10 * DAY);
    await f.as(f.issuers, f.trDelegate).revokeIssuer(f.uniIssuer, ZERO);
    const revokedAt = await f.now();
    expect(await f.issuers.isValidIssuer(f.uniIssuer)).to.equal(false);
    expect(await f.issuers.isCredentialAcceptable(f.uniIssuer, issuedBefore)).to.equal(true);
    expect(await f.issuers.isCredentialAcceptable(f.uniIssuer, revokedAt + 1)).to.equal(false);
  });

  it("ADR-0073 K5: askıdan ÖNCE verilmiş belge kabul, askı süresinde verilen ret; reinstate sonrası yeni belge kabul", async () => {
    const before = await f.now();
    await networkHelpers.time.increase(10);
    await f.as(f.issuers, f.trDelegate).suspendIssuer(f.uniIssuer);
    const suspendedAt = await f.now();
    expect(await f.issuers.isCredentialAcceptable(f.uniIssuer, before)).to.equal(true); // liste kuralı
    expect(await f.issuers.isCredentialAcceptable(f.uniIssuer, suspendedAt)).to.equal(false); // yarı açık: askı anı ret
    expect(await f.issuers.isOperational(f.uniIssuer)).to.equal(false); // yeni yayın yok
    await networkHelpers.time.increase(10);
    await f.as(f.issuers, f.trDelegate).reinstateIssuer(f.uniIssuer);
    const reinstatedAt = await f.now();
    expect(await f.issuers.isCredentialAcceptable(f.uniIssuer, suspendedAt + 5)).to.equal(false); // askı süresinde
    expect(await f.issuers.isCredentialAcceptable(f.uniIssuer, reinstatedAt)).to.equal(true);
    expect(await f.issuers.isCredentialAcceptable(f.uniIssuer, before)).to.equal(true);
  });

  it("I2: geçerlilik penceresi dışında verilmiş belge kabul edilmez", async () => {
    const i = await f.issuers.getIssuer(f.uniIssuer);
    expect(await f.issuers.isCredentialAcceptable(f.uniIssuer, Number(i.validFrom) - 1)).to.equal(false);
    expect(await f.issuers.isCredentialAcceptable(f.uniIssuer, Number(i.validUntil) + 1)).to.equal(false);
    expect(await f.issuers.isCredentialAcceptable(id("yok"), await f.now())).to.equal(false);
  });

  it("R3 — SC3'ün yetki tarafı: DEPRECATED şemayla önce verilmiş belge hâlâ kabul edilir", async () => {
    const edu = await f.registerNationalSchema(TR, f.trDelegate, EDU, id("edu"));
    await f.as(f.issuers, f.trDelegate).setSchemaAuthorization(f.uniIssuer, edu, true);
    const iat = await f.now();
    await networkHelpers.time.increase(365 * DAY);
    await f.as(f.schemas, f.trDelegate).deprecateSchema(edu, ZERO);
    expect(await f.issuers.isAuthorizedForSchema(f.uniIssuer, edu)).to.equal(false);
    expect(await f.issuers.isCredentialSchemaAcceptable(f.uniIssuer, edu, iat)).to.equal(true);
  });

  it("I3: yetki penceresi — yetkiden önce ve geri alındıktan sonra verilen belgeler reddedilir", async () => {
    const edu = await f.registerNationalSchema(TR, f.trDelegate, EDU, id("edu"));
    const before = await f.now();
    await networkHelpers.time.increase(DAY);
    const w = f.as(f.issuers, f.trDelegate);
    await w.setSchemaAuthorization(f.uniIssuer, edu, true);
    const during = await f.now();
    await networkHelpers.time.increase(DAY);
    await w.setSchemaAuthorization(f.uniIssuer, edu, false);
    const after = (await f.now()) + 1;
    expect(await f.issuers.isCredentialSchemaAcceptable(f.uniIssuer, edu, before)).to.equal(false);
    expect(await f.issuers.isCredentialSchemaAcceptable(f.uniIssuer, edu, during)).to.equal(true);
    expect(await f.issuers.isCredentialSchemaAcceptable(f.uniIssuer, edu, after)).to.equal(false);
    const a = await f.issuers.schemaAuthOf(f.uniIssuer, edu);
    expect(a.allowed).to.equal(false);
    expect(a.until).to.not.equal(0n);
  });

  it("R3: REVOKED şema ise eski belge de reddedilir", async () => {
    const edu = await f.registerNationalSchema(TR, f.trDelegate, EDU, id("edu"));
    await f.as(f.issuers, f.trDelegate).setSchemaAuthorization(f.uniIssuer, edu, true);
    const iat = await f.now();
    await f.as(f.schemas, f.trDelegate).revokeSchema(edu, "yanlis sd:never");
    expect(await f.issuers.isCredentialSchemaAcceptable(f.uniIssuer, edu, iat)).to.equal(false);
  });

  it("R2 / CA2: RETIRED CA — yeni ihraç durur, operasyon sürer, eski belgeler kabul", async () => {
    const iat = await f.now();
    await f.as(f.rootCAs, f.trDelegate).retireRootCA(f.trCA, ZERO);
    expect(await f.issuers.isValidIssuer(f.uniIssuer)).to.equal(false);
    expect(await f.issuers.isOperational(f.uniIssuer)).to.equal(true);
    expect(await f.issuers.isCredentialAcceptable(f.uniIssuer, iat)).to.equal(true);
  });

  it("CA2: REVOKED CA (ele geçirilme) — belgeler düşer, operasyon sürer (iptal yayınlayabilmeli)", async () => {
    const iat = await f.now();
    await f.as(f.rootCAs, f.trDelegate).revokeRootCA(f.trCA, "compromise");
    expect(await f.issuers.isCredentialAcceptable(f.uniIssuer, iat)).to.equal(false);
    expect(await f.issuers.isOperational(f.uniIssuer)).to.equal(true);
    expect((await f.issuers.getIssuer(f.uniIssuer)).parentCA).to.equal(f.trCA);
  });

  it("CA3: yeni issuer yalnız var olan CA'ya bağlanır; kayıt denetimleri", async () => {
    const t = await f.now();
    const base = {
      issuerId: ZERO,
      stateCode: TR,
      nameHash: ZERO,
      category: 0,
      assurance: 0,
      certFingerprint: id("X"),
      parentCA: id("YOK-BOYLE-CA"),
      metadataURI: "",
      status: 1,
      validFrom: t,
      validUntil: t + DAY,
      successorId: ZERO,
      registeredAt: 0,
      revokedAt: 0,
    };
    const w = f.as(f.issuers, f.trDelegate);
    await expect(w.registerIssuer(base))
      .to.be.revertedWithCustomError(f.issuers, "UnknownRootCA")
      .withArgs(base.parentCA);
    await expect(w.registerIssuer({ ...base, parentCA: f.trCA, status: 2 })).to.be.revertedWithCustomError(
      f.issuers,
      "MustRegisterAsActive",
    );
    await expect(w.registerIssuer({ ...base, parentCA: f.trCA, validUntil: t })).to.be.revertedWithCustomError(
      f.issuers,
      "InvalidValidity",
    );
    await expect(w.registerIssuer({ ...base, parentCA: f.trCA, certFingerprint: ZERO })).to.be.revertedWithCustomError(
      f.issuers,
      "EmptyContentHash",
    );
    await expect(w.registerIssuer({ ...base, parentCA: f.trCA, certFingerprint: id("BILGI-CERT") }))
      .to.be.revertedWithCustomError(f.issuers, "IssuerExists")
      .withArgs(f.uniIssuer);
  });

  it("renew: yalnız ileri; delegeler yalnız devlet tarafından (R1), en çok 16", async () => {
    const i = await f.issuers.getIssuer(f.uniIssuer);
    const w = f.as(f.issuers, f.trDelegate);
    await expect(w.renewIssuer(f.uniIssuer, i.validUntil)).to.be.revertedWithCustomError(f.issuers, "InvalidValidity");
    await w.renewIssuer(f.uniIssuer, Number(i.validUntil) + DAY);
    expect((await f.issuers.getIssuer(f.uniIssuer)).validUntil).to.equal(Number(i.validUntil) + DAY);
    await expect(
      f.as(f.issuers, f.uniOperator).setIssuerDelegates(f.uniIssuer, [await f.stranger.getAddress()]),
    ).to.be.revertedWithCustomError(f.issuers, "NotOwnerState");
    const many = Array.from({ length: 17 }, (_, k) => "0x" + (k + 1).toString(16).padStart(40, "0"));
    await expect(w.setIssuerDelegates(f.uniIssuer, many)).to.be.revertedWithCustomError(f.issuers, "TooManyDelegates");
    expect(await f.issuers.isIssuerDelegate(f.uniIssuer, await f.uniOperator.getAddress())).to.equal(true);
    expect(await f.issuers.getIssuersByState(TR)).to.deep.equal([f.uniIssuer]);
    expect(await f.issuers.stateOf(f.uniIssuer)).to.equal(TR);
  });

  it("kota: devlet başına günde 10.000 yazma (writeCountToday sayar)", async () => {
    // kurulumda TR yazmaları: RootCARegistry'de registerRootCA; IssuerRegistry'de registerIssuer + setIssuerDelegates
    // (2026-10-19: kayıt-dışı yazımlar da §3.1 onlyOwnerState gereği kotaya sayılır)
    expect(await f.issuers.writeCountToday(TR)).to.equal(2);
    expect(await f.rootCAs.writeCountToday(TR)).to.equal(1);
    await f.as(f.issuers, f.trDelegate).suspendIssuer(f.uniIssuer);
    expect(await f.issuers.writeCountToday(TR)).to.equal(3);
    expect(await f.issuers.MAX_WRITES_PER_STATE_PER_DAY()).to.equal(10_000);
  });
});
