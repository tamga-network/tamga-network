/**
 * Kontrat denetimi 2026-11-12 — taramadan kalan üç bulgu ve yükseltme sonrası oy sayımı, süreç içi Hardhat zincirinde:
 *   - D4 (ADR-0082 IS1): iptal edilmiş kurumun halefi sonradan düzeltilir, değiştirilir, kaldırılır (`setIssuerSuccessor`);
 *        önce halef iptalle tek adımda yazılıyor ve bir daha değişmiyordu.
 *   - D5 (ADR-0082 DK1): delege anahtarı eşlemesi devlet başınadır — bir devlet başka devletin (kullanacağı) anahtarını önce
 *        kendi listesine yazarak onu kilitleyemez; kendi listesini yazmak ya da boşaltmak ötekinin yetkisine dokunmaz.
 *        Doğrulayıcı kimliğinin (rpId) kapılması ADR-0075 ile düzeltilir (adr-0075-relying-party-periods.test.ts).
 *   - D6 (ADR-0073 CE1 uygulama notu): göç penceresi açıkken kayıt başlangıcı (`validFrom`) da açıkça verilir; tarihsiz kayıt
 *        (kök, kurum, şema) `DateRequiredDuringMigration` ile reddedilir. Governance tarihsiz yazar.
 *   - Oy zamanı: oy zamanı kaydı olmayan (0) oylar sayılmaz; üye oyunu aynı yönde yeniden verince sayılır. Oy zamanını
 *        tutmayan bir Governance sürümünden yükseltmede açık öneriler ve kuyruktaki yükseltmeler böyle sürer (kilitlenme yok).
 */
import { expect } from "chai";

import { stateCode } from "../scripts/lib/deploy.js";
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

const PLAN = id("plan-2026-11-12-contracts");
const UZ = stateCode(ethers, "UZ");

async function proposalId(tx: any, f: Fixture): Promise<string> {
  const rc = await tx.wait();
  for (const l of rc.logs) {
    try {
      const e = (f.governance as any).interface.parseLog(l);
      if (e?.name === "ProposalCreated") return e.args.id;
    } catch {
      /* başka kontrat */
    }
  }
  throw new Error("ProposalCreated yok");
}
async function pass(f: Fixture, pid: string) {
  await (await f.as(f.governance, f.trValidator).vote(pid, true)).wait();
  await (await f.as(f.governance, f.kzValidator).vote(pid, true)).wait();
}
async function openMigration(f: Fixture, registry: any, executor = ethers.ZeroAddress) {
  const pid = await proposalId(
    await f.as(f.governance, f.trValidator).proposeMigrationOpen(await registry.getAddress(), PLAN, 7 * DAY, executor),
    f,
  );
  await pass(f, pid);
  await (await f.governance.execute(pid)).wait();
}

describe("Kontrat denetimi 2026-11-12", function () {
  this.timeout(180_000);

  describe("D4: iptal edilmiş kurumun halefi sonradan yazılır (ADR-0082 IS1)", () => {
    const URI = "https://status.example/lists/1";
    async function setup() {
      const f = await loadFixture();
      const issuers = f.as(f.issuers, f.trDelegate);
      const heir = await f.registerIssuer(
        TR,
        f.trDelegate,
        f.trCA,
        id("HEIR"),
        IssuerCategory.EDUCATION,
        IssuerAssurance.I2,
      );
      const other = await f.registerIssuer(
        TR,
        f.trDelegate,
        f.trCA,
        id("OTHER"),
        IssuerCategory.EDUCATION,
        IssuerAssurance.I2,
      );
      const [, , , , , , , , heirKey, otherKey] = await ethers.getSigners();
      await (await issuers.setIssuerDelegates(heir, [await heirKey.getAddress()])).wait();
      await (await issuers.setIssuerDelegates(other, [await otherKey.getAddress()])).wait();
      await (await f.as(f.statusLists, f.uniOperator).registerList(f.uniIssuer, URI, 100_000, 2)).wait();
      const listId = await f.statusLists.listIdOf(f.uniIssuer, URI);
      await (await f.as(f.statusLists, f.uniOperator).publishList(listId, id("v1"), 1, 0)).wait();
      return { f, issuers, heir, other, heirKey, otherKey, listId };
    }

    it("halefsiz iptalde liste donmaz: devlet halefi sonradan atar, halefin anahtarı yayımlar", async () => {
      const { f, issuers, heir, heirKey, listId } = await setup();
      await (await issuers.revokeIssuer(f.uniIssuer, ZERO)).wait();
      // halef yok: ne kapatılan kurumun ne başka kurumun anahtarı yayımlayabilir
      await expect(f.as(f.statusLists, heirKey).publishList(listId, id("v2"), 2, 0)).to.be.revertedWithCustomError(
        f.statusLists,
        "NotIssuerDelegate",
      );
      await expect(issuers.setIssuerSuccessor(f.uniIssuer, heir))
        .to.emit(f.issuers, "IssuerSuccessorSet")
        .withArgs(f.uniIssuer, heir);
      expect((await f.issuers.getIssuer(f.uniIssuer)).successorId).to.equal(heir);
      await (await f.as(f.statusLists, heirKey).publishList(listId, id("v2"), 2, 0)).wait();
      expect((await f.statusLists.getListAnchor(listId)).version).to.equal(2n);
    });

    it("yanlış yazılan halef düzeltilir: eski halefin anahtarı yetkisini yitirir; halef kaldırılabilir", async () => {
      const { f, issuers, heir, other, heirKey, otherKey, listId } = await setup();
      await (await issuers.revokeIssuer(f.uniIssuer, other)).wait(); // yanlış kurum
      await (await f.as(f.statusLists, otherKey).publishList(listId, id("v2"), 2, 0)).wait();
      await (await issuers.setIssuerSuccessor(f.uniIssuer, heir)).wait();
      await expect(f.as(f.statusLists, otherKey).publishList(listId, id("v3"), 3, 0)).to.be.revertedWithCustomError(
        f.statusLists,
        "NotIssuerDelegate",
      );
      await (await f.as(f.statusLists, heirKey).publishList(listId, id("v3"), 3, 0)).wait();
      // halef de kapanırsa (zincir tek seviyedir) devlet yenisini atar
      await (await issuers.revokeIssuer(heir, ZERO)).wait();
      await expect(f.as(f.statusLists, heirKey).publishList(listId, id("v4"), 4, 0)).to.be.revertedWithCustomError(
        f.statusLists,
        "NotIssuerDelegate",
      );
      await (await issuers.setIssuerSuccessor(f.uniIssuer, other)).wait();
      await (await f.as(f.statusLists, otherKey).publishList(listId, id("v4"), 4, 0)).wait();
      // kaldırma
      await (await issuers.setIssuerSuccessor(f.uniIssuer, ZERO)).wait();
      expect((await f.issuers.getIssuer(f.uniIssuer)).successorId).to.equal(ZERO);
      await expect(f.as(f.statusLists, otherKey).publishList(listId, id("v5"), 5, 0)).to.be.revertedWithCustomError(
        f.statusLists,
        "NotIssuerDelegate",
      );
    });

    it("kurallar iptaldekiyle aynı: yalnız kurumun devleti, yalnız iptal edilmiş kurum, aynı devletin ACTIVE kurumu", async () => {
      const { f, issuers, heir, other } = await setup();
      // iptal edilmemiş kurumda halef yazılmaz (halef iptalle birlikte gelir)
      await expect(issuers.setIssuerSuccessor(f.uniIssuer, heir))
        .to.be.revertedWithCustomError(f.issuers, "IssuerNotRevoked")
        .withArgs(f.uniIssuer);
      await (await issuers.revokeIssuer(f.uniIssuer, ZERO)).wait();
      await expect(f.as(f.issuers, f.kzDelegate).setIssuerSuccessor(f.uniIssuer, heir)).to.be.revertedWithCustomError(
        f.issuers,
        "NotOwnerState",
      );
      await expect(f.as(f.issuers, f.uniOperator).setIssuerSuccessor(f.uniIssuer, heir)).to.be.revertedWithCustomError(
        f.issuers,
        "NotOwnerState",
      );
      await expect(issuers.setIssuerSuccessor(f.uniIssuer, f.uniIssuer)).to.be.revertedWithCustomError(
        f.issuers,
        "InvalidSuccessor",
      );
      await expect(issuers.setIssuerSuccessor(id("yok"), heir)).to.be.revertedWithCustomError(
        f.issuers,
        "UnknownIssuer",
      );
      await expect(issuers.setIssuerSuccessor(f.uniIssuer, id("yok"))).to.be.revertedWithCustomError(
        f.issuers,
        "SuccessorNotActive",
      );
      await (await issuers.suspendIssuer(other)).wait();
      await expect(issuers.setIssuerSuccessor(f.uniIssuer, other)).to.be.revertedWithCustomError(
        f.issuers,
        "SuccessorNotActive",
      );
      // başka devletin kurumu halef olamaz (ADR-0054 NS2)
      const kzCA = await f.registerCA(KZ, f.kzDelegate, id("KZ-ROOT-CA-1"));
      const kzIssuer = await f.registerIssuer(
        KZ,
        f.kzDelegate,
        kzCA,
        id("KZ-UNI"),
        IssuerCategory.EDUCATION,
        IssuerAssurance.I2,
      );
      await expect(issuers.setIssuerSuccessor(f.uniIssuer, kzIssuer)).to.be.revertedWithCustomError(
        f.issuers,
        "CrossStateReference",
      );
      // belgelerin kabulü halefe bakmaz: iptalden önce verilmiş belge geçerli kalır
      const before = (await f.issuers.getIssuer(f.uniIssuer)).revokedAt - 1n;
      await (await issuers.setIssuerSuccessor(f.uniIssuer, heir)).wait();
      expect(await f.issuers.isCredentialAcceptable(f.uniIssuer, before)).to.equal(true);
    });
  });

  describe("D5: delege anahtarı kapılamaz (ADR-0082 DK1)", () => {
    it("başka devlet anahtarı önce yazsa da devlet kendi delegesini atar; listeler birbirine dokunmaz", async () => {
      const f = await loadFixture();
      const [, , , , , , , , fresh] = await ethers.getSigners();
      const key = await fresh.getAddress();
      const gov = f.governance as any;
      // KZ, TR'nin kullanacağı anahtarı önce kendi listesine yazar (önden koşma)
      await (await f.as(gov, f.kzValidator).setDelegateKeys(KZ, [await f.kzDelegate.getAddress(), key])).wait();
      // TR yine de atar (önce: DelegateKeyInUse ile düşerdi)
      await (await f.as(gov, f.trValidator).setDelegateKeys(TR, [await f.trDelegate.getAddress(), key])).wait();
      expect(await gov.isDelegateOf(key, TR)).to.equal(true);
      await (await f.as(f.rootCAs, fresh).updateCrlURI(f.trCA, "https://pki.example/tr.crl")).wait();
      // KZ listesini boşaltır: TR'nin eşlemesi durur
      await (await f.as(gov, f.kzValidator).setDelegateKeys(KZ, [])).wait();
      expect(await gov.isDelegateOf(key, KZ)).to.equal(false);
      expect(await gov.isDelegateOf(key, TR)).to.equal(true);
      expect(await gov.delegateKeysOf(TR)).to.deep.equal([await f.trDelegate.getAddress(), key]);
    });

    it("çalma yok: başka devletin anahtarını listesine yazan devlet o devletin yetkisini almaz, düşürmez", async () => {
      const f = await loadFixture();
      const gov = f.governance as any;
      const kzKey = await f.kzDelegate.getAddress();
      await (await f.as(gov, f.trValidator).setDelegateKeys(TR, [await f.trDelegate.getAddress(), kzKey])).wait();
      expect(await gov.isDelegateOf(kzKey, KZ)).to.equal(true); // KZ'nin yetkisi yerinde
      // TR'nin kendi delegesi KZ adına yazamaz (N1)
      await expect(f.registerCA(KZ, f.trDelegate, id("KZ-ROOT-BY-TR"))).to.be.revertedWithCustomError(
        f.rootCAs,
        "NotOwnerState",
      );
      // TR listesini değiştirince yalnız TR'nin eşlemesi düşer
      await (await f.as(gov, f.trValidator).setDelegateKeys(TR, [])).wait();
      expect(await gov.isDelegateOf(kzKey, TR)).to.equal(false);
      expect(await gov.isDelegateOf(kzKey, KZ)).to.equal(true);
      expect(await gov.isDelegateOf(await f.trDelegate.getAddress(), TR)).to.equal(false);
      // üye olmayan / sıfır devlet kodu için delege yok
      expect(await gov.isDelegateOf(kzKey, UZ)).to.equal(false);
      expect(await gov.isDelegateOf(kzKey, "0x0000")).to.equal(false);
    });
  });

  describe("D6: göç penceresinde başlangıç da açıkça verilir (ADR-0073 CE1)", () => {
    it("kök ve kurum: registeredAt verilip validFrom boş bırakılamaz; açık tarihle yazılır", async () => {
      const f = await loadFixture();
      await openMigration(f, f.rootCAs);
      await openMigration(f, f.issuers);
      const t = await f.now();
      const past = t - 100 * DAY;
      const ca = (validFrom: number) => ({
        caId: ZERO,
        stateCode: TR,
        certFingerprint: id("TR-ROOT-REPLAYED"),
        subjectHash: id("subject"),
        certURI: "https://pki.example/root.der",
        crlURI: "",
        status: CAStatus.ACTIVE,
        validFrom,
        validUntil: t + 3650 * DAY,
        registeredAt: past,
      });
      await expect(f.as(f.rootCAs, f.trDelegate).registerRootCA(ca(0))).to.be.revertedWithCustomError(
        f.rootCAs,
        "DateRequiredDuringMigration",
      );
      await (await f.as(f.rootCAs, f.trDelegate).registerRootCA(ca(past))).wait();
      const caId = await f.rootCAs.caIdOf(TR, id("TR-ROOT-REPLAYED"));
      const issuer = (validFrom: number) => ({
        issuerId: ZERO,
        stateCode: TR,
        nameHash: id("Replayed University"),
        category: IssuerCategory.EDUCATION,
        assurance: IssuerAssurance.I2,
        certFingerprint: id("REPLAYED-CERT"),
        parentCA: caId,
        metadataURI: "",
        status: Status.ACTIVE,
        validFrom,
        validUntil: t + 365 * DAY,
        successorId: ZERO,
        registeredAt: past,
        revokedAt: 0,
      });
      await expect(f.as(f.issuers, f.trDelegate).registerIssuer(issuer(0))).to.be.revertedWithCustomError(
        f.issuers,
        "DateRequiredDuringMigration",
      );
      await (await f.as(f.issuers, f.trDelegate).registerIssuer(issuer(past))).wait();
      const issuerId = ethers.keccak256(ethers.concat([TR, id("REPLAYED-CERT")]));
      // başlangıç geçmişte: o andan beri verilmiş belge kabul edilir (tarihsiz yazılsaydı başlangıç bugün olur, hepsi düşerdi)
      expect(await f.issuers.isCredentialAcceptable(issuerId, past + DAY)).to.equal(true);
    });

    it("şema: pencere açıkken tarihsiz ulusal şema kaydı reddedilir; Governance tarihsiz yazar", async () => {
      const f = await loadFixture();
      await openMigration(f, f.schemas);
      const t = await f.now();
      const rec = f.schemaRecord("urn:tamga:tr:edu:Replayed:1", SchemaTier.NATIONAL, TR);
      await expect(f.as(f.schemas, f.trDelegate).registerSchema(rec)).to.be.revertedWithCustomError(
        f.schemas,
        "DateRequiredDuringMigration",
      );
      await (await f.as(f.schemas, f.trDelegate).registerSchema({ ...rec, validFrom: t - 30 * DAY })).wait();
      expect(await f.schemas.isSchemaAcceptableAt(id("urn:tamga:tr:edu:Replayed:1"), t - 10 * DAY)).to.equal(true);
      // Governance (kipin yöneticisi) pencere açıkken de tarihsiz ağ şeması kaydeder
      const pid = await proposalId(
        await f
          .as(f.governance, f.trValidator)
          .proposeNetworkSchema(f.schemaRecord("urn:tamga:edu:Voted:1", SchemaTier.NETWORK, "0x0000")),
        f,
      );
      await pass(f, pid);
      await (await f.governance.execute(pid)).wait();
      expect(await f.schemas.isActiveSchema(id("urn:tamga:edu:Voted:1"))).to.equal(true);
    });

    it("pencere kapalıyken davranış değişmez: tarihsiz kayıt blok zamanıyla yazılır", async () => {
      const f = await loadFixture();
      const sid = await f.registerNationalSchema(TR, f.trDelegate, "urn:tamga:tr:edu:Plain:1", id("meta"));
      expect(await f.schemas.isActiveSchema(sid)).to.equal(true);
      await f.registerCA(TR, f.trDelegate, id("TR-ROOT-CA-2"));
    });
  });

  describe("oy zamanı kaydı olmayan oylar (yükseltme sonrası durum)", () => {
    /** `_votedAt[pid][voter]` yuvası — storage-layout/Governance.json: `_votedAt` slot 15. */
    const VOTED_AT_SLOT = 15n;
    async function clearVoteTime(f: Fixture, pid: string, voter: string) {
      const coder = ethers.AbiCoder.defaultAbiCoder();
      const inner = ethers.keccak256(coder.encode(["bytes32", "uint256"], [pid, VOTED_AT_SLOT]));
      const slot = ethers.keccak256(coder.encode(["address", "bytes32"], [voter, inner]));
      await networkHelpers.setStorageAt(await f.governance.getAddress(), slot, 0);
    }

    it("açık öneri: zamanı 0 olan oylar sayılmaz, üyeler aynı yönde yeniden oy verince öneri yürür", async () => {
      const f = await loadFixture();
      const [, , , , , , , , newValidator] = await ethers.getSigners();
      const gov = f.governance as any;
      const pid = await proposalId(
        await f.as(gov, f.trValidator).proposeStateAdmission(UZ, await newValidator.getAddress()),
        f,
      );
      await pass(f, pid);
      expect(await gov.countedForVotes(pid)).to.equal(2);
      // oy zamanını tutmayan sürümden yükseltilmiş gibi: oylar duruyor, zamanları yok
      await clearVoteTime(f, pid, await f.trValidator.getAddress());
      await clearVoteTime(f, pid, await f.kzValidator.getAddress());
      expect(await gov.countedForVotes(pid)).to.equal(0);
      await expect(gov.execute(pid)).to.be.revertedWithCustomError(gov, "ThresholdNotMet").withArgs(0, 2);
      // kilit değil: aynı yönde yeniden oy kabul edilir (AlreadyVoted yok), ham sayaç şişmez
      await pass(f, pid);
      expect(await gov.countedForVotes(pid)).to.equal(2);
      expect((await gov.getProposal(pid)).forVotes).to.equal(2n);
      await (await gov.execute(pid)).wait();
      expect(await gov.isActiveMember(UZ)).to.equal(true);
    });

    it("kuyruktaki yükseltme: oylar uygulama penceresi boyunca yeniden verilebilir, sonra uygulanır", async () => {
      const f = await loadFixture();
      const gov = f.governance as any;
      const impl = await ethers.deployContract("IssuerRegistry");
      const pid = await proposalId(
        await f.as(gov, f.trValidator).proposeProtocolUpgrade(await f.issuers.getAddress(), await impl.getAddress()),
        f,
      );
      await pass(f, pid);
      await (await gov.execute(pid)).wait(); // kuyruk
      await clearVoteTime(f, pid, await f.trValidator.getAddress());
      await clearVoteTime(f, pid, await f.kzValidator.getAddress());
      await networkHelpers.time.increase(7 * DAY + 1);
      await expect(gov.execute(pid)).to.be.revertedWithCustomError(gov, "ThresholdNotMet");
      await pass(f, pid); // bekleme süresi dolduktan sonra da (eta + 30 gün içinde) oy verilebilir
      await (await gov.execute(pid)).wait();
      expect((await gov.getProposal(pid)).status).to.equal(2n); // EXECUTED
    });
  });
});
