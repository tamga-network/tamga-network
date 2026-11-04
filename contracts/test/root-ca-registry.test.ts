/**
 * SPEC-BC-0001 §2 — ulusal kök CA çapaları: CA1 (parmak izi bir kez), CA2 (RETIRED ≠ REVOKED), CA3, yalnız parmak izi + URI.
 */
import { expect } from "chai";

import { CAStatus, DAY, KZ, TR, ZERO, ethers, id, loadFixture, type Fixture } from "./helpers/fixture.js";

describe("RootCARegistry (SPEC-BC-0001 §2)", function () {
  let f: Fixture;
  beforeEach(async () => {
    f = await loadFixture();
  });

  const ca = async (over: Record<string, unknown> = {}) => {
    const t = await f.now();
    return {
      caId: ZERO,
      stateCode: TR,
      certFingerprint: id("TR-ROOT-CA-2"),
      subjectHash: id("subject"),
      certURI: "https://pki.example/root2.der",
      crlURI: "https://pki.example/root2.crl",
      status: CAStatus.ACTIVE,
      validFrom: 0,
      validUntil: t + 3650 * DAY,
      registeredAt: 0,
      ...over,
    };
  };

  it("kayıt: caId = keccak256(stateCode ‖ fingerprint); validFrom=0 → blok zamanı", async () => {
    const data = await ca();
    await expect(f.as(f.rootCAs, f.trDelegate).registerRootCA(data))
      .to.emit(f.rootCAs, "RootCARegistered")
      .withArgs(await f.rootCAs.caIdOf(TR, data.certFingerprint), TR, data.certFingerprint);
    const caId = await f.rootCAs.caIdOf(TR, data.certFingerprint);
    expect(caId).to.equal(ethers.keccak256(ethers.concat([TR, data.certFingerprint])));
    const rec = await f.rootCAs.getRootCA(caId);
    expect(rec.validFrom).to.equal(await f.now());
    expect(rec.certURI).to.equal(data.certURI);
    expect(await f.rootCAs.isValidRootCA(caId)).to.equal(true);
    expect(await f.rootCAs.isChainAcceptable(caId)).to.equal(true);
    expect(await f.rootCAs.getRootCAsByState(TR)).to.deep.equal([f.trCA, caId]);
  });

  it("N1: başka devletin delegesi ve yabancı yazamaz", async () => {
    await expect(f.as(f.rootCAs, f.kzDelegate).registerRootCA(await ca()))
      .to.be.revertedWithCustomError(f.rootCAs, "NotOwnerState")
      .withArgs(TR, await f.kzDelegate.getAddress());
    await expect(f.as(f.rootCAs, f.stranger).suspendRootCA(f.trCA)).to.be.revertedWithCustomError(
      f.rootCAs,
      "NotOwnerState",
    );
    await (await f.as(f.rootCAs, f.kzDelegate).registerRootCA(await ca({ stateCode: KZ }))).wait(); // KZ kendi kaydını yazar
    expect(await f.rootCAs.getRootCAsByState(KZ)).to.have.length(1);
  });

  it("CA1: aynı parmak izi iki kez kaydedilemez; boş parmak izi reddedilir", async () => {
    await expect(f.as(f.rootCAs, f.trDelegate).registerRootCA(await ca({ certFingerprint: id("TR-ROOT-CA-1") })))
      .to.be.revertedWithCustomError(f.rootCAs, "CAExists")
      .withArgs(f.trCA);
    await expect(
      f.as(f.rootCAs, f.trDelegate).registerRootCA(await ca({ certFingerprint: ZERO })),
    ).to.be.revertedWithCustomError(f.rootCAs, "EmptyFingerprint");
  });

  it("kayıt denetimleri: ACTIVE dışı ve geçersiz süre reddedilir", async () => {
    const w = f.as(f.rootCAs, f.trDelegate);
    await expect(w.registerRootCA(await ca({ status: CAStatus.RETIRED }))).to.be.revertedWithCustomError(
      f.rootCAs,
      "MustRegisterAsActive",
    );
    const t = await f.now();
    await expect(w.registerRootCA(await ca({ validFrom: t, validUntil: t }))).to.be.revertedWithCustomError(
      f.rootCAs,
      "InvalidValidity",
    );
  });

  it("CA2: RETIRED — yeni issuer bağlanamaz (isValidRootCA=false), zincir kabul edilir", async () => {
    await expect(f.as(f.rootCAs, f.trDelegate).retireRootCA(f.trCA, ZERO))
      .to.emit(f.rootCAs, "RootCARetired")
      .withArgs(f.trCA, ZERO);
    expect(await f.rootCAs.isValidRootCA(f.trCA)).to.equal(false);
    expect(await f.rootCAs.isChainAcceptable(f.trCA)).to.equal(true);
    // halef verilmişse ACTIVE olmalı
    const data = await ca();
    await f.as(f.rootCAs, f.trDelegate).registerRootCA(data);
    const ca2 = await f.rootCAs.caIdOf(TR, data.certFingerprint);
    await expect(f.as(f.rootCAs, f.trDelegate).retireRootCA(ca2, id("yok"))).to.be.revertedWithCustomError(
      f.rootCAs,
      "UnknownCA",
    );
  });

  it("CA2: REVOKED — zincir kabul edilmez; ikinci revoke AlreadyRevoked", async () => {
    await expect(f.as(f.rootCAs, f.trDelegate).revokeRootCA(f.trCA, "compromise"))
      .to.emit(f.rootCAs, "RootCARevoked")
      .withArgs(f.trCA, "compromise");
    expect(await f.rootCAs.isValidRootCA(f.trCA)).to.equal(false);
    expect(await f.rootCAs.isChainAcceptable(f.trCA)).to.equal(false);
    await expect(f.as(f.rootCAs, f.trDelegate).revokeRootCA(f.trCA, "x")).to.be.revertedWithCustomError(
      f.rootCAs,
      "AlreadyRevoked",
    );
    expect(await f.rootCAs.exists(f.trCA)).to.equal(true); // kayıt silinmedi
  });

  it("suspend / reinstate yalnız doğru durumdan; kayıt kalır", async () => {
    const w = f.as(f.rootCAs, f.trDelegate);
    await w.suspendRootCA(f.trCA);
    expect(await f.rootCAs.isChainAcceptable(f.trCA)).to.equal(false);
    await expect(w.suspendRootCA(f.trCA)).to.be.revertedWithCustomError(f.rootCAs, "UnknownCA");
    await expect(w.retireRootCA(f.trCA, ZERO)).to.be.revertedWithCustomError(f.rootCAs, "UnknownCA");
    await w.reinstateRootCA(f.trCA);
    expect(await f.rootCAs.isValidRootCA(f.trCA)).to.equal(true);
    await expect(w.reinstateRootCA(f.trCA)).to.be.revertedWithCustomError(f.rootCAs, "UnknownCA");
  });

  it("CRL adresi değişebilir, parmak izi değişemez (CA1); bilinmeyen CA hata", async () => {
    await expect(f.as(f.rootCAs, f.trDelegate).updateCrlURI(f.trCA, "https://pki.example/new.crl"))
      .to.emit(f.rootCAs, "RootCACrlUpdated")
      .withArgs(f.trCA, "https://pki.example/new.crl");
    expect((await f.rootCAs.getRootCA(f.trCA)).certFingerprint).to.equal(id("TR-ROOT-CA-1"));
    await expect(f.rootCAs.getRootCA(id("yok"))).to.be.revertedWithCustomError(f.rootCAs, "UnknownCA");
    expect(await f.rootCAs.exists(id("yok"))).to.equal(false);
    expect(await f.rootCAs.isChainAcceptable(id("yok"))).to.equal(false);
  });
});
