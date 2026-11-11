/**
 * 2026-10-19 kontrat güvenlik turu — bulgu düzeltmelerinin regresyon testleri (rapor: çalışma alanı docs/security/
 * 2026-10-19-contracts/). Her test, düzeltmeden önce başarısız olan senaryoyu kurar.
 */
import { expect } from "chai";

import {
  AZ,
  KZ,
  RecognitionMode,
  TR,
  ethers,
  id,
  loadFixture,
  networkHelpers,
  type Fixture,
} from "./helpers/fixture.js";

const UZ = "0x555a";
const EDU = "urn:tamga:tr:edu:DiplomaCredential:1"; // ulusal (TR) şema — ADR-0054 NS1

describe("Güvenlik turu 2026-10-19 — regresyonlar", function () {
  let f: Fixture;
  beforeEach(async () => {
    f = await loadFixture();
  });

  const proposalId = async (tx: any) => {
    const rc = await (await tx).wait();
    const ev = rc!.logs
      .map((l: any) => f.governance.interface.parseLog(l))
      .find((e: any) => e?.name === "ProposalCreated");
    return ev!.args.id as string;
  };

  describe("Governance", () => {
    it("F-01: çıkarma önerisi açıkken hedef çekilirse yürütme reddedilir; üye sayacı iki kez düşmez (GV3)", async () => {
      const pid = await proposalId(f.as(f.governance, f.kzValidator).proposeStateRemoval(TR, id("x")));
      await f.as(f.governance, f.kzValidator).vote(pid, true);
      await f.as(f.governance, f.azValidator).vote(pid, true);
      await f.as(f.governance, f.trValidator).withdraw();
      expect(await f.governance.activeMemberCount()).to.equal(2);
      await expect(f.governance.execute(pid)).to.be.revertedWithCustomError(f.governance, "UnknownMember");
      expect(await f.governance.activeMemberCount()).to.equal(2);
    });

    it("F-01: aynı devlet için iki çıkarma önerisi — ikincisi yürütülemez", async () => {
      const p1 = await proposalId(f.as(f.governance, f.kzValidator).proposeStateRemoval(TR, id("x")));
      const p2 = await proposalId(f.as(f.governance, f.azValidator).proposeStateRemoval(TR, id("y")));
      for (const p of [p1, p2]) {
        await f.as(f.governance, f.kzValidator).vote(p, true);
        await f.as(f.governance, f.azValidator).vote(p, true);
      }
      await f.governance.execute(p1);
      expect(await f.governance.activeMemberCount()).to.equal(2);
      await expect(f.governance.execute(p2)).to.be.revertedWithCustomError(f.governance, "UnknownMember");
      expect(await f.governance.activeMemberCount()).to.equal(2);
    });

    it("F-01: çekilen üyenin eski oyu eşiği dolduramaz (oylar yürütmede yeniden sayılır)", async () => {
      const [, , , , , , , , newValidator] = await ethers.getSigners();
      const pid = await proposalId(
        f.as(f.governance, f.trValidator).proposeStateAdmission(UZ, await newValidator.getAddress()),
      );
      await f.as(f.governance, f.trValidator).vote(pid, true);
      await f.as(f.governance, f.kzValidator).vote(pid, true);
      expect(await f.governance.countedForVotes(pid)).to.equal(2);
      await f.as(f.governance, f.kzValidator).withdraw();
      expect(await f.governance.countedForVotes(pid)).to.equal(1);
      await expect(f.governance.execute(pid))
        .to.be.revertedWithCustomError(f.governance, "ThresholdNotMet")
        .withArgs(1, 2);
    });

    it("F-01: GV3 — iki üye kalınca çıkarma yürütülemez (çekilenin oyu sayılmaz)", async () => {
      const pid = await proposalId(f.as(f.governance, f.trValidator).proposeStateRemoval(AZ, id("x")));
      await f.as(f.governance, f.trValidator).vote(pid, true);
      await f.as(f.governance, f.kzValidator).vote(pid, true);
      await f.as(f.governance, f.kzValidator).withdraw(); // geriye TR + AZ (hedef)
      await expect(f.governance.execute(pid)).to.be.revertedWithCustomError(f.governance, "ThresholdNotMet");
      expect((await f.governance.getMember(AZ)).status).to.equal(1); // ACTIVE
    });

    it("F-02: bir devletin validator'ı başka devletin delege anahtarını kendine yazamaz (N1)", async () => {
      const kzKey = await f.kzDelegate.getAddress();
      await expect(f.as(f.governance, f.trValidator).setDelegateKeys(TR, [kzKey]))
        .to.be.revertedWithCustomError(f.governance, "DelegateKeyInUse")
        .withArgs(kzKey, KZ);
      expect(await f.governance.isDelegateOf(kzKey, KZ)).to.equal(true);
    });

    it("F-02: anahtar devirde eski devletin listesi yeni sahibinin eşlemesini silmez", async () => {
      const key = await f.trDelegate.getAddress();
      await f.as(f.governance, f.trValidator).setDelegateKeys(TR, []); // TR bıraktı
      await f.as(f.governance, f.kzValidator).setDelegateKeys(KZ, [key]); // KZ aldı
      await f.as(f.governance, f.trValidator).setDelegateKeys(TR, []); // TR listesini yeniden sıfırlar
      expect(await f.governance.isDelegateOf(key, KZ)).to.equal(true);
    });

    it("F-04: başka devletin validator adresiyle kabul önerisi açılmaz", async () => {
      const kzV = await f.kzValidator.getAddress();
      await expect(f.as(f.governance, f.trValidator).proposeStateAdmission(UZ, kzV))
        .to.be.revertedWithCustomError(f.governance, "ValidatorInUse")
        .withArgs(kzV, KZ);
    });

    it("F-04: initialize aynı validator'ı iki kurucuya veremez", async () => {
      const impl = await ethers.deployContract("Governance");
      const v = await f.trValidator.getAddress();
      const data = impl.interface.encodeFunctionData("initialize", [
        [TR, KZ],
        [v, v],
      ]);
      await expect(
        ethers.deployContract("ERC1967Proxy", [await impl.getAddress(), data]),
      ).to.be.revertedWithCustomError(impl, "ValidatorInUse");
    });
  });

  describe("IssuerRegistry / TrustQueries", () => {
    const registerUnder = async (caId: string, fp: string) => f.registerIssuer(TR, f.trDelegate, caId, id(fp), 2, 1);

    it("F-03: CA3 — RETIRED ya da SUSPENDED kök CA'ya yeni issuer bağlanamaz", async () => {
      const retired = await f.registerCA(TR, f.trDelegate, id("TR-ROOT-OLD"));
      await f.as(f.rootCAs, f.trDelegate).retireRootCA(retired, f.trCA);
      await expect(registerUnder(retired, "NEW-1"))
        .to.be.revertedWithCustomError(f.issuers, "RootCANotActive")
        .withArgs(retired);
      const suspended = await f.registerCA(TR, f.trDelegate, id("TR-ROOT-SUSP"));
      await f.as(f.rootCAs, f.trDelegate).suspendRootCA(suspended);
      await expect(registerUnder(suspended, "NEW-2")).to.be.revertedWithCustomError(f.issuers, "RootCANotActive");
      await registerUnder(f.trCA, "NEW-3"); // ACTIVE CA: kabul
    });

    it("F-06: I3 — yetki geri alınıp yeniden verilince ilk penceredeki belge hâlâ kabul", async () => {
      const edu = await f.registerNationalSchema(TR, f.trDelegate, EDU, id("edu"));
      await f.as(f.issuers, f.trDelegate).setSchemaAuthorization(f.uniIssuer, edu, true);
      const iatFirst = await f.now();
      await networkHelpers.time.increase(10);
      await f.as(f.issuers, f.trDelegate).setSchemaAuthorization(f.uniIssuer, edu, false);
      await networkHelpers.time.increase(100);
      const iatGap = await f.now();
      await networkHelpers.time.increase(100);
      await f.as(f.issuers, f.trDelegate).setSchemaAuthorization(f.uniIssuer, edu, true);
      const iatSecond = await f.now();

      expect(await f.issuers.isCredentialSchemaAcceptable(f.uniIssuer, edu, iatFirst)).to.equal(true);
      expect(await f.issuers.isCredentialSchemaAcceptable(f.uniIssuer, edu, iatGap)).to.equal(false);
      expect(await f.issuers.isCredentialSchemaAcceptable(f.uniIssuer, edu, iatSecond)).to.equal(true);
      const history = await f.issuers.schemaAuthHistoryOf(f.uniIssuer, edu);
      expect(history.length).to.equal(1);
    });

    it("kayıtsız şemayla sorgu revert etmez, false döner", async () => {
      const ghost = id("urn:tamga:none:Ghost:1");
      // kontrat denetimi 2026-11-11 (D1): yetki kayıtsız şemaya verilemez; sorgu yine revert etmez
      await expect(f.as(f.issuers, f.trDelegate).setSchemaAuthorization(f.uniIssuer, ghost, true))
        .to.be.revertedWithCustomError(f.schemas, "UnknownSchema")
        .withArgs(ghost);
      expect(await f.issuers.isCredentialSchemaAcceptable(f.uniIssuer, ghost, await f.now())).to.equal(false);
    });

    it("reinstateIssuer olay yayar (indeksleyici askıdan dönüşü görür)", async () => {
      await f.as(f.issuers, f.trDelegate).suspendIssuer(f.uniIssuer);
      await expect(f.as(f.issuers, f.trDelegate).reinstateIssuer(f.uniIssuer))
        .to.emit(f.issuers, "IssuerReinstated")
        .withArgs(f.uniIssuer);
      expect(await f.issuers.isOperational(f.uniIssuer)).to.equal(true);
    });

    it("issuer kendisinin halefi olamaz (I4: listesi donardı)", async () => {
      await expect(f.as(f.issuers, f.trDelegate).revokeIssuer(f.uniIssuer, f.uniIssuer))
        .to.be.revertedWithCustomError(f.issuers, "InvalidSuccessor")
        .withArgs(f.uniIssuer);
    });

    it("verifyAll: başka issuer'ın güncel listesiyle ok üretilemez", async () => {
      const other = await registerUnder(f.trCA, "OTHER-UNI");
      await f.as(f.issuers, f.trDelegate).setIssuerDelegates(other, [await f.uniOperator.getAddress()]);
      const uri = "https://status.other.example/sl/1";
      const otherList = await f.statusLists.listIdOf(other, uri);
      await f.as(f.statusLists, f.uniOperator).registerList(other, uri, 100_000, 2);
      await f.as(f.statusLists, f.uniOperator).publishList(otherList, id("other-token"), 1, 0);

      const schemaHash = id("meta");
      const schemaId = await f.registerNationalSchema(TR, f.trDelegate, EDU, schemaHash);
      await f.as(f.issuers, f.trDelegate).setSchemaAuthorization(f.uniIssuer, schemaId, true);
      await f.as(f.recognition, f.kzDelegate).setRecognition(KZ, TR, RecognitionMode.FULL, []);
      const iat = await f.now();
      const [ok, r] = await f.trustQueries.verifyAll(
        f.uniIssuer,
        iat,
        schemaId,
        schemaHash,
        KZ,
        otherList,
        id("other-token"),
      );
      expect(ok).to.equal(false);
      expect(r[4]).to.equal(false);
    });
  });

  it("CrossRecognition.bootstrapFounders yalnız bir kez", async () => {
    const gov = await f.governance.getAddress();
    await networkHelpers.impersonateAccount(gov);
    await networkHelpers.setBalance(gov, 10n ** 18n);
    const govSigner = await ethers.getSigner(gov);
    await f.as(f.recognition, govSigner).bootstrapFounders([TR, KZ]);
    await expect(f.as(f.recognition, govSigner).bootstrapFounders([TR, KZ])).to.be.revertedWithCustomError(
      f.recognition,
      "AlreadyBootstrapped",
    );
    await networkHelpers.stopImpersonatingAccount(gov);
  });
});
