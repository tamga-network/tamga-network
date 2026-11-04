/**
 * SPEC-BC-0001 §6 + ADR-0073 K4 (CE4) — doğrulayıcı kayıtları: kimlik `rpId = keccak256(utf8(dns_name))` (sertifika
 * yenilenince değişmez), sertifika parmak izi güncelleme (tek sahip), askıdan dönüş, öğe öğe istek kapsamı ve aşırı istek
 * denetimi (`mayRequest`).
 */
import { expect } from "chai";

import { DAY, TR, ZERO, id, loadFixture, networkHelpers, type Fixture } from "./helpers/fixture.js";

const SD_JWT = 0;
const MDOC = 1;

describe("RelyingPartyRegistry (SPEC-BC-0001 §6, ADR-0073 K4)", function () {
  let f: Fixture;
  const RP = id("verify.example.org"); // keccak256(utf8(dns_name)) — kayıt kurumu hesaplar
  const DIPLOMA = id("urn:tamga:tr:edu:DiplomaCredential:1");
  const SERVICE = id("hiring");
  const attrs = (...paths: string[]) => paths.map((p) => id(p)).sort();
  beforeEach(async () => {
    f = await loadFixture();
  });

  const rp = (over: Record<string, unknown> = {}) => ({
    rpId: RP,
    stateCode: TR,
    nameHash: id("Example Employer"),
    accessCertFingerprint: id("RP-ACCESS-CERT"),
    status: 1,
    registeredAt: 0,
    ...over,
  });
  const scope = (over: Record<string, unknown> = {}) => ({
    scopeHash: id("diploma-check"),
    serviceHash: SERVICE,
    schemaId: DIPLOMA,
    format: SD_JWT,
    namespaceHash: ZERO,
    attributes: attrs("degree", "institution", "graduation_year"),
    validFrom: 0,
    validUntil: 0,
    detailsHash: id("purpose-block"),
    ...over,
  });

  it("CE4: kimlik verilen rpId'dir; sertifika yenilenince değişmez, eski parmak izi serbest kalır", async () => {
    const w = f.as(f.relyingParties, f.trDelegate);
    await expect(w.registerRelyingParty(rp())).to.emit(f.relyingParties, "RelyingPartyRegistered").withArgs(RP, TR);
    expect(await f.relyingParties.rpIdOfCertificate(id("RP-ACCESS-CERT"))).to.equal(RP);
    await expect(w.updateAccessCertificate(RP, id("RP-ACCESS-CERT-2")))
      .to.emit(f.relyingParties, "AccessCertificateUpdated")
      .withArgs(RP, id("RP-ACCESS-CERT"), id("RP-ACCESS-CERT-2"));
    expect((await f.relyingParties.getRelyingParty(RP)).accessCertFingerprint).to.equal(id("RP-ACCESS-CERT-2"));
    expect(await f.relyingParties.rpIdOfCertificate(id("RP-ACCESS-CERT"))).to.equal(ZERO);
    expect(await f.relyingParties.isValidRelyingParty(RP)).to.equal(true);
    expect(await f.relyingParties.getRelyingPartiesByState(TR)).to.deep.equal([RP]);
  });

  it("bir parmak izi aynı anda yalnız bir doğrulayıcıya ait; boş kimlik ve ACTIVE dışı kayıt reddedilir", async () => {
    const w = f.as(f.relyingParties, f.trDelegate);
    await (await w.registerRelyingParty(rp())).wait();
    await expect(w.registerRelyingParty(rp())).to.be.revertedWithCustomError(f.relyingParties, "RPExists").withArgs(RP);
    const other = id("other.example.org");
    await expect(w.registerRelyingParty(rp({ rpId: other })))
      .to.be.revertedWithCustomError(f.relyingParties, "CertificateInUse")
      .withArgs(id("RP-ACCESS-CERT"), RP);
    await (await w.registerRelyingParty(rp({ rpId: other, accessCertFingerprint: id("OTHER-CERT") }))).wait();
    await expect(w.updateAccessCertificate(other, id("RP-ACCESS-CERT"))).to.be.revertedWithCustomError(
      f.relyingParties,
      "CertificateInUse",
    );
    await expect(
      w.registerRelyingParty(rp({ rpId: ZERO, accessCertFingerprint: id("z") })),
    ).to.be.revertedWithCustomError(f.relyingParties, "EmptyRpId");
    await expect(
      w.registerRelyingParty(rp({ rpId: id("x.example"), accessCertFingerprint: id("x"), status: 2 })),
    ).to.be.revertedWithCustomError(f.relyingParties, "MustRegisterAsActive");
  });

  it("N1: yalnız sahibi devlet yazar", async () => {
    await expect(f.as(f.relyingParties, f.kzDelegate).registerRelyingParty(rp()))
      .to.be.revertedWithCustomError(f.relyingParties, "NotOwnerState")
      .withArgs(TR, await f.kzDelegate.getAddress());
    await (await f.as(f.relyingParties, f.trDelegate).registerRelyingParty(rp())).wait();
    await expect(f.as(f.relyingParties, f.stranger).setRequestScope(RP, scope())).to.be.revertedWithCustomError(
      f.relyingParties,
      "NotOwnerState",
    );
    await expect(
      f.as(f.relyingParties, f.kzDelegate).updateAccessCertificate(RP, id("hijack")),
    ).to.be.revertedWithCustomError(f.relyingParties, "NotOwnerState");
  });

  it("mayRequest: hizmet + tür + biçim + ad alanı + öğe eşleşmeli; listede olmayan öğe istenemez", async () => {
    const w = f.as(f.relyingParties, f.trDelegate);
    await (await w.registerRelyingParty(rp())).wait();
    await expect(w.setRequestScope(RP, scope())).to.emit(f.relyingParties, "RequestScopeSet");
    const ask = (svc: string, sch: string, fmt: number, ns: string, a: string) =>
      f.relyingParties.mayRequest(RP, svc, sch, fmt, ns, id(a));
    expect(await ask(SERVICE, DIPLOMA, SD_JWT, ZERO, "degree")).to.equal(true);
    expect(await ask(SERVICE, DIPLOMA, SD_JWT, ZERO, "graduation_year")).to.equal(true);
    expect(await ask(SERVICE, DIPLOMA, SD_JWT, ZERO, "birth_place")).to.equal(false); // aşırı istek
    expect(await ask(id("marketing"), DIPLOMA, SD_JWT, ZERO, "degree")).to.equal(false); // başka hizmet
    expect(await ask(SERVICE, DIPLOMA, MDOC, ZERO, "degree")).to.equal(false); // başka biçim
    expect(await ask(SERVICE, id("other-vct"), SD_JWT, ZERO, "degree")).to.equal(false);
    // mdoc kapsamı ad alanıyla
    const ns = id("org.iso.18013.5.1");
    await (
      await w.setRequestScope(
        RP,
        scope({ scopeHash: id("mdl"), format: MDOC, namespaceHash: ns, attributes: attrs("age_over_18") }),
      )
    ).wait();
    expect(await ask(SERVICE, DIPLOMA, MDOC, ns, "age_over_18")).to.equal(true);
    expect(await ask(SERVICE, DIPLOMA, MDOC, ZERO, "age_over_18")).to.equal(false);
    expect((await f.relyingParties.requestScopesOf(RP)).length).to.equal(2);
  });

  it("kapsam aynı scopeHash ile güncellenir; geri çekilen kapsam silinmez, aralığı kapanır (yarı açık)", async () => {
    const w = f.as(f.relyingParties, f.trDelegate);
    await (await w.registerRelyingParty(rp())).wait();
    await (await w.setRequestScope(RP, scope())).wait();
    await (await w.setRequestScope(RP, scope({ attributes: attrs("degree") }))).wait();
    const list = await f.relyingParties.requestScopesOf(RP);
    expect(list.length).to.equal(1);
    expect(list[0].attributes).to.deep.equal(attrs("degree"));
    await expect(w.closeRequestScope(RP, id("diploma-check"), 0)).to.emit(f.relyingParties, "RequestScopeClosed");
    expect(await f.relyingParties.mayRequest(RP, SERVICE, DIPLOMA, SD_JWT, ZERO, id("degree"))).to.equal(false);
    expect((await f.relyingParties.requestScopesOf(RP)).length).to.equal(1); // kayıt kalır
    await expect(w.closeRequestScope(RP, id("diploma-check"), 0)).to.be.revertedWithCustomError(
      f.relyingParties,
      "InvalidScope",
    ); // genişlemez / ikinci kapanış yok
    await expect(w.closeRequestScope(RP, id("yok"), 0)).to.be.revertedWithCustomError(f.relyingParties, "UnknownScope");
  });

  it("geçerlilik aralığı: başlamadan ve bittikten sonra istenemez", async () => {
    const w = f.as(f.relyingParties, f.trDelegate);
    await (await w.registerRelyingParty(rp())).wait();
    const t = await f.now();
    await (await w.setRequestScope(RP, scope({ validFrom: t + DAY, validUntil: t + 2 * DAY }))).wait();
    const ok = () => f.relyingParties.mayRequest(RP, SERVICE, DIPLOMA, SD_JWT, ZERO, id("degree"));
    expect(await ok()).to.equal(false);
    await networkHelpers.time.increaseTo(t + DAY);
    expect(await ok()).to.equal(true);
    await networkHelpers.time.increaseTo(t + 2 * DAY);
    expect(await ok()).to.equal(false);
  });

  it("kapsam doğrulaması: sırasız/yinelenen öğe, boş öğe listesi, 64 öğe ve 32 kapsam tavanı", async () => {
    const w = f.as(f.relyingParties, f.trDelegate);
    await (await w.registerRelyingParty(rp())).wait();
    const sorted = attrs("a", "b");
    await expect(w.setRequestScope(RP, scope({ attributes: [sorted[1], sorted[0]] }))).to.be.revertedWithCustomError(
      f.relyingParties,
      "AttributesNotSorted",
    );
    await expect(w.setRequestScope(RP, scope({ attributes: [sorted[0], sorted[0]] }))).to.be.revertedWithCustomError(
      f.relyingParties,
      "AttributesNotSorted",
    );
    await expect(w.setRequestScope(RP, scope({ attributes: [] }))).to.be.revertedWithCustomError(
      f.relyingParties,
      "InvalidScope",
    );
    const many = Array.from({ length: 65 }, (_, i) => id(`p${i}`)).sort();
    await expect(w.setRequestScope(RP, scope({ attributes: many })))
      .to.be.revertedWithCustomError(f.relyingParties, "TooManyAttributes")
      .withArgs(65, 64);
    for (let i = 0; i < 32; i++) await (await w.setRequestScope(RP, scope({ scopeHash: id(`s${i}`) }))).wait();
    await expect(w.setRequestScope(RP, scope({ scopeHash: id("s32") })))
      .to.be.revertedWithCustomError(f.relyingParties, "TooManyScopes")
      .withArgs(33, 32);
  });

  it("askı → dönüş (ADR-0073 K4); REVOKED kesin: askı, dönüş, kapsam ve sertifika yazılamaz", async () => {
    const w = f.as(f.relyingParties, f.trDelegate);
    await (await w.registerRelyingParty(rp())).wait();
    await (await w.setRequestScope(RP, scope())).wait();
    const ok = () => f.relyingParties.mayRequest(RP, SERVICE, DIPLOMA, SD_JWT, ZERO, id("degree"));
    await (await w.suspendRelyingParty(RP)).wait();
    expect(await f.relyingParties.isValidRelyingParty(RP)).to.equal(false);
    expect(await ok()).to.equal(false);
    await expect(w.reinstateRelyingParty(RP)).to.emit(f.relyingParties, "RelyingPartyReinstated").withArgs(RP);
    expect(await ok()).to.equal(true);
    await expect(w.reinstateRelyingParty(RP)).to.be.revertedWithCustomError(
      f.relyingParties,
      "RelyingPartyNotSuspended",
    );
    await (await w.revokeRelyingParty(RP)).wait();
    expect((await f.relyingParties.getRelyingParty(RP)).status).to.equal(3);
    await expect(w.suspendRelyingParty(RP)).to.be.revertedWithCustomError(f.relyingParties, "RelyingPartyNotActive");
    await expect(w.reinstateRelyingParty(RP)).to.be.revertedWithCustomError(
      f.relyingParties,
      "RelyingPartyNotSuspended",
    );
    await expect(w.revokeRelyingParty(RP)).to.be.revertedWithCustomError(f.relyingParties, "AlreadyRevoked");
    await expect(w.setRequestScope(RP, scope())).to.be.revertedWithCustomError(
      f.relyingParties,
      "RelyingPartyNotActive",
    );
    await expect(w.updateAccessCertificate(RP, id("n"))).to.be.revertedWithCustomError(
      f.relyingParties,
      "RelyingPartyNotActive",
    );
    await expect(f.relyingParties.getRelyingParty(id("yok"))).to.be.revertedWithCustomError(
      f.relyingParties,
      "UnknownRP",
    );
    expect(await f.relyingParties.isValidRelyingParty(id("yok"))).to.equal(false);
  });
});
