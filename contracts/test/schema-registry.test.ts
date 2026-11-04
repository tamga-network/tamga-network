/**
 * SPEC-BC-0001 §4 / ADR-0007 — SC1, SC2, SC3 ve iki katmanlı yetki (GV2).
 */
import { expect } from "chai";

import { KZ, TR, ZERO, id, loadFixture, SchemaTier, type Fixture } from "./helpers/fixture.js";

const NATIONAL_VCT = "urn:tamga:tr:edu:YOKDenklikCredential:1";
const NETWORK_VCT = "urn:tamga:edu:DiplomaCredential:1";

describe("SchemaRegistry (SPEC-BC-0001 §4)", function () {
  let f: Fixture;
  beforeEach(async () => {
    f = await loadFixture();
  });

  it("NATIONAL şema oy gerektirmez; schemaId = keccak256(vct)", async () => {
    const sid = await f.registerNationalSchema(TR, f.trDelegate, NATIONAL_VCT, id("meta"));
    expect(sid).to.equal(await f.schemas.schemaIdOf(NATIONAL_VCT));
    expect(await f.schemas.isActiveSchema(sid)).to.equal(true);
    expect((await f.schemas.getSchema(sid)).stateCode).to.equal(TR);
    expect(await f.schemas.getSchemasByState(TR)).to.deep.equal([sid]);
  });

  it("NATIONAL: başka devlet yazamaz", async () => {
    await expect(f.as(f.schemas, f.kzDelegate).registerSchema(f.schemaRecord(NATIONAL_VCT, SchemaTier.NATIONAL, TR)))
      .to.be.revertedWithCustomError(f.schemas, "NotOwnerState")
      .withArgs(TR, await f.kzDelegate.getAddress());
  });

  it("NATIONAL: devlet kodu boş olamaz", async () => {
    await expect(
      f.as(f.schemas, f.trDelegate).registerSchema(f.schemaRecord(NATIONAL_VCT, SchemaTier.NATIONAL, "0x0000")),
    ).to.be.revertedWithCustomError(f.schemas, "NationalTierRequiresState");
  });

  it("GV2: NETWORK şeması doğrudan yazılamaz, Governance gerekir", async () => {
    await expect(
      f.as(f.schemas, f.trDelegate).registerSchema(f.schemaRecord(NETWORK_VCT, SchemaTier.NETWORK, "0x0000")),
    ).to.be.revertedWithCustomError(f.schemas, "NetworkTierRequiresGovernance");
  });

  it("GV2: NETWORK şeması 2/3 oyla Governance üzerinden girer", async () => {
    const rec = f.schemaRecord(NETWORK_VCT, SchemaTier.NETWORK, "0x0000");
    const tx = await f.as(f.governance, f.trValidator).proposeNetworkSchema(rec);
    const rc = await tx.wait();
    const pid = rc!.logs
      .map((l: any) => f.governance.interface.parseLog(l))
      .find((e: any) => e?.name === "ProposalCreated")!.args.id;
    await f.as(f.governance, f.trValidator).vote(pid, true);
    await f.as(f.governance, f.kzValidator).vote(pid, true);
    await f.governance.execute(pid);
    const sid = id(NETWORK_VCT);
    expect(await f.schemas.isActiveSchema(sid)).to.equal(true);
    expect(await f.schemas.getNetworkSchemas()).to.deep.equal([sid]);
  });

  it("NETWORK önerisi NATIONAL kayıtla açılamaz; NETWORK kaydı devlet kodu taşıyamaz", async () => {
    await expect(
      f.as(f.governance, f.trValidator).proposeNetworkSchema(f.schemaRecord(NATIONAL_VCT, SchemaTier.NATIONAL, TR)),
    ).to.be.revertedWithCustomError(f.governance, "NotNetworkTier");
    // NETWORK + stateCode: öneri açılır ama yürütme SchemaRegistry'de düşer (NetworkTierHasNoState)
    const tx = await f
      .as(f.governance, f.trValidator)
      .proposeNetworkSchema(f.schemaRecord(NETWORK_VCT, SchemaTier.NETWORK, TR));
    const rc = await tx.wait();
    const pid = rc!.logs
      .map((l: any) => f.governance.interface.parseLog(l))
      .find((e: any) => e?.name === "ProposalCreated")!.args.id;
    await f.as(f.governance, f.trValidator).vote(pid, true);
    await f.as(f.governance, f.kzValidator).vote(pid, true);
    await expect(f.governance.execute(pid)).to.be.revertedWithCustomError(f.schemas, "NetworkTierHasNoState");
  });

  it("SC1: aynı vct iki kez kaydedilemez", async () => {
    await f.registerNationalSchema(TR, f.trDelegate, NATIONAL_VCT, id("meta"));
    await expect(f.as(f.schemas, f.trDelegate).registerSchema(f.schemaRecord(NATIONAL_VCT, SchemaTier.NATIONAL, TR)))
      .to.be.revertedWithCustomError(f.schemas, "SchemaExists")
      .withArgs(id(NATIONAL_VCT));
  });

  it("boş vct / boş hash / boş sürüm / ACTIVE dışı kayıt reddedilir", async () => {
    const w = f.as(f.schemas, f.trDelegate);
    await expect(w.registerSchema(f.schemaRecord("", SchemaTier.NATIONAL, TR))).to.be.revertedWithCustomError(
      f.schemas,
      "EmptyVctURI",
    );
    await expect(
      w.registerSchema(f.schemaRecord(NATIONAL_VCT, SchemaTier.NATIONAL, TR, ZERO)),
    ).to.be.revertedWithCustomError(f.schemas, "EmptyContentHash");
    await expect(
      w.registerSchema({ ...f.schemaRecord(NATIONAL_VCT, SchemaTier.NATIONAL, TR), version: "" }),
    ).to.be.revertedWithCustomError(f.schemas, "EmptyVersion");
    await expect(
      w.registerSchema({ ...f.schemaRecord(NATIONAL_VCT, SchemaTier.NATIONAL, TR), status: 2 }),
    ).to.be.revertedWithCustomError(f.schemas, "MustRegisterAsActive");
  });

  it("SC3 — EN ÖNEMLİ: DEPRECATED şema yeni ihraca kapalı AMA içerik hash'i hâlâ eşleşir", async () => {
    const hash = id("meta-v1");
    const sid = await f.registerNationalSchema(TR, f.trDelegate, NATIONAL_VCT, hash);
    await f.as(f.schemas, f.trDelegate).deprecateSchema(sid, ZERO);
    expect(await f.schemas.isActiveSchema(sid)).to.equal(false);
    expect(await f.schemas.matchesContentHash(sid, hash)).to.equal(true);
    expect((await f.schemas.getSchema(sid)).contentHash).to.equal(hash); // SC1/SC2: içerik değişmedi
  });

  it("REVOKED şema doğrulanamaz; ikinci revoke AlreadyRevoked", async () => {
    const hash = id("meta-v1");
    const sid = await f.registerNationalSchema(TR, f.trDelegate, NATIONAL_VCT, hash);
    await f.as(f.schemas, f.trDelegate).revokeSchema(sid, "sd:never on national id number");
    expect(await f.schemas.matchesContentHash(sid, hash)).to.equal(false);
    await expect(f.as(f.schemas, f.trDelegate).revokeSchema(sid, "again")).to.be.revertedWithCustomError(
      f.schemas,
      "AlreadyRevoked",
    );
  });

  it("deprecate: kendine halef olamaz, halef ACTIVE olmalı, yalnız ACTIVE şema deprecate edilir", async () => {
    const sid = await f.registerNationalSchema(TR, f.trDelegate, NATIONAL_VCT, id("m"));
    const w = f.as(f.schemas, f.trDelegate);
    await expect(w.deprecateSchema(sid, sid)).to.be.revertedWithCustomError(f.schemas, "SelfSuccession");
    await expect(w.deprecateSchema(sid, id("yok"))).to.be.revertedWithCustomError(f.schemas, "SuccessorNotActive");
    await w.deprecateSchema(sid, ZERO);
    await expect(w.deprecateSchema(sid, ZERO)).to.be.revertedWithCustomError(f.schemas, "NotActive");
  });

  it("yazma yetkisi: NATIONAL şemayı yalnız sahibi devlet, yabancı delege değil", async () => {
    const sid = await f.registerNationalSchema(TR, f.trDelegate, NATIONAL_VCT, id("m"));
    await expect(f.as(f.schemas, f.kzDelegate).deprecateSchema(sid, ZERO)).to.be.revertedWithCustomError(
      f.schemas,
      "NotOwnerState",
    );
    await expect(f.as(f.schemas, f.kzDelegate).revokeSchema(sid, "x")).to.be.revertedWithCustomError(
      f.schemas,
      "NotOwnerState",
    );
  });

  it("yanlış hash eşleşmez; bilinmeyen şema hata verir", async () => {
    const sid = await f.registerNationalSchema(TR, f.trDelegate, NATIONAL_VCT, id("meta"));
    expect(await f.schemas.matchesContentHash(sid, id("baska"))).to.equal(false);
    expect(await f.schemas.matchesContentHash(id("yok"), id("meta"))).to.equal(false);
    expect(await f.schemas.exists(id("yok"))).to.equal(false);
    await expect(f.schemas.getSchema(id("yok"))).to.be.revertedWithCustomError(f.schemas, "UnknownSchema");
  });

  it("KZ kendi NATIONAL şemasını kimseye sormadan kaydeder", async () => {
    const sid = await f.registerNationalSchema(KZ, f.kzDelegate, "urn:tamga:kz:edu:Attestat:1", id("kz"));
    expect(await f.schemas.getSchemasByState(KZ)).to.deep.equal([sid]);
  });
});
