/**
 * SPEC-BC-0001 §5 / ADR-0002 #3 — tek taraflı tanıma: NONE (opt-in varsayılan), FULL, CATEGORY_LIMITED, blocklist,
 * kurucular arası FULL (bootstrapFounders, yalnız Governance).
 */
import { expect } from "chai";

import {
  AZ,
  IssuerAssurance,
  IssuerCategory,
  KZ,
  RecognitionMode,
  TR,
  ethers,
  id,
  loadFixture,
  networkHelpers,
  type Fixture,
} from "./helpers/fixture.js";

describe("CrossRecognition (SPEC-BC-0001 §5)", function () {
  let f: Fixture;
  beforeEach(async () => {
    f = await loadFixture();
  });

  it("kendi devletinin kurumu her zaman tanınır; başka devlet için varsayılan NONE", async () => {
    expect(await f.recognition.isRecognizedBy(TR, f.uniIssuer)).to.equal(true);
    expect(await f.recognition.isRecognizedBy(KZ, f.uniIssuer)).to.equal(false);
    expect(await f.recognition.isRecognizedBy(KZ, id("bilinmeyen"))).to.equal(false);
  });

  it("FULL tanıma: KZ, TR'nin bütün kurumlarını tanır", async () => {
    await expect(f.as(f.recognition, f.kzDelegate).setRecognition(KZ, TR, RecognitionMode.FULL, []))
      .to.emit(f.recognition, "RecognitionSet")
      .withArgs(KZ, TR, RecognitionMode.FULL);
    expect(await f.recognition.isRecognizedBy(KZ, f.uniIssuer)).to.equal(true);
    const p = await f.recognition.getPolicy(KZ, TR);
    expect(p.mode).to.equal(RecognitionMode.FULL);
    expect(p.updatedAt).to.not.equal(0n);
  });

  it("CATEGORY_LIMITED: yalnız sayılan kategoriler", async () => {
    await f
      .as(f.recognition, f.kzDelegate)
      .setRecognition(KZ, TR, RecognitionMode.CATEGORY_LIMITED, [IssuerCategory.EDUCATION, IssuerCategory.IDENTITY]);
    expect(await f.recognition.isRecognizedBy(KZ, f.uniIssuer)).to.equal(true); // EDUCATION
    const hospital = await f.registerIssuer(
      TR,
      f.trDelegate,
      f.trCA,
      id("HASTANE-CERT"),
      IssuerCategory.HEALTH,
      IssuerAssurance.I2,
    );
    expect(await f.recognition.isRecognizedBy(KZ, hospital)).to.equal(false); // HEALTH tanınmıyor
  });

  it("CATEGORY_LIMITED kategori ister; FULL/NONE kategori kabul etmez; kendini tanıma yok", async () => {
    const w = f.as(f.recognition, f.kzDelegate);
    await expect(w.setRecognition(KZ, TR, RecognitionMode.CATEGORY_LIMITED, [])).to.be.revertedWithCustomError(
      f.recognition,
      "CategoriesRequired",
    );
    await expect(
      w.setRecognition(KZ, TR, RecognitionMode.FULL, [IssuerCategory.EDUCATION]),
    ).to.be.revertedWithCustomError(f.recognition, "CategoriesNotAllowed");
    await expect(w.setRecognition(KZ, KZ, RecognitionMode.FULL, [])).to.be.revertedWithCustomError(
      f.recognition,
      "SelfRecognition",
    );
  });

  it("N1: tanıma politikasını yalnız tanıyan devletin delegesi yazar", async () => {
    await expect(f.as(f.recognition, f.trDelegate).setRecognition(KZ, TR, RecognitionMode.FULL, []))
      .to.be.revertedWithCustomError(f.recognition, "NotOwnerState")
      .withArgs(KZ, await f.trDelegate.getAddress());
    await expect(
      f.as(f.recognition, f.trDelegate).setIssuerBlocklist(KZ, f.uniIssuer, true),
    ).to.be.revertedWithCustomError(f.recognition, "NotOwnerState");
  });

  it("blocklist: genel tanı ama şu kurumu tanıma; kendi devletinde de işler; geri alınabilir", async () => {
    await f.as(f.recognition, f.kzDelegate).setRecognition(KZ, TR, RecognitionMode.FULL, []);
    await expect(f.as(f.recognition, f.kzDelegate).setIssuerBlocklist(KZ, f.uniIssuer, true))
      .to.emit(f.recognition, "IssuerBlocklisted")
      .withArgs(KZ, f.uniIssuer, true);
    expect(await f.recognition.isRecognizedBy(KZ, f.uniIssuer)).to.equal(false);
    await f.as(f.recognition, f.kzDelegate).setIssuerBlocklist(KZ, f.uniIssuer, false);
    expect(await f.recognition.isRecognizedBy(KZ, f.uniIssuer)).to.equal(true);
    await f.as(f.recognition, f.trDelegate).setIssuerBlocklist(TR, f.uniIssuer, true);
    expect(await f.recognition.isRecognizedBy(TR, f.uniIssuer)).to.equal(false);
  });

  it("politika NONE'a geri çekilebilir (tek taraflı)", async () => {
    const w = f.as(f.recognition, f.kzDelegate);
    await w.setRecognition(KZ, TR, RecognitionMode.FULL, []);
    await w.setRecognition(KZ, TR, RecognitionMode.NONE, []);
    expect(await f.recognition.isRecognizedBy(KZ, f.uniIssuer)).to.equal(false);
  });

  it("bootstrapFounders yalnız Governance adresinden; kurucular arası FULL yazar", async () => {
    await expect(f.as(f.recognition, f.trValidator).bootstrapFounders([TR, KZ, AZ])).to.be.revertedWithCustomError(
      f.recognition,
      "NotGovernance",
    );
    // Governance kontratında genel çağrı önerisi yok; testte adresi taklit ederek davranışı doğrularız.
    const gov = await f.governance.getAddress();
    await networkHelpers.impersonateAccount(gov);
    await networkHelpers.setBalance(gov, 10n ** 18n);
    const govSigner = await ethers.getSigner(gov);
    await f.as(f.recognition, govSigner).bootstrapFounders([TR, KZ, AZ]);
    await networkHelpers.stopImpersonatingAccount(gov);
    expect(await f.recognition.isRecognizedBy(KZ, f.uniIssuer)).to.equal(true);
    expect(await f.recognition.isRecognizedBy(AZ, f.uniIssuer)).to.equal(true);
    expect((await f.recognition.getPolicy(TR, TR)).mode).to.equal(RecognitionMode.NONE); // i == j atlanır
  });
});
