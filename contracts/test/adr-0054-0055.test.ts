/**
 * ADR-0054 — şema ad alanları (NS1), devletler arası bağ (NS2), kota kapsamı (NS3).
 * ADR-0055 — yükseltme kuyruğu ve bekleme süresi (GE1), parametresiz başlangıç seçicisi (GE2), türü belli kayıt yönetimi
 * önerileri (GE3).
 */
import { expect } from "chai";

import {
  DAY,
  IssuerAssurance,
  IssuerCategory,
  KZ,
  RecognitionMode,
  SchemaStatus,
  SchemaTier,
  TR,
  ZERO,
  ethers,
  id,
  loadFixture,
  networkHelpers,
  type Fixture,
} from "./helpers/fixture.js";

const NETWORK_VCT = "urn:tamga:edu:DiplomaCredential:1";
const WEEK = 7 * DAY;

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

async function passWithTwo(f: Fixture, pid: string) {
  await (await f.as(f.governance, f.trValidator).vote(pid, true)).wait();
  await (await f.as(f.governance, f.kzValidator).vote(pid, true)).wait();
}

describe("ADR-0054 — ad alanı, devletler arası bağ, kota", function () {
  let f: Fixture;
  beforeEach(async () => {
    f = await loadFixture();
  });

  it("NS1 / F-11: ağ şeması oylanırken bir devlet aynı adı ulusal olarak kapamaz; ağ şeması yürütülür", async () => {
    const pid = await proposalId(
      await f
        .as(f.governance, f.trValidator)
        .proposeNetworkSchema(f.schemaRecord(NETWORK_VCT, SchemaTier.NETWORK, "0x0000")),
      f,
    );
    await expect(f.as(f.schemas, f.trDelegate).registerSchema(f.schemaRecord(NETWORK_VCT, SchemaTier.NATIONAL, TR)))
      .to.be.revertedWithCustomError(f.schemas, "NationalVctOutsideNamespace")
      .withArgs(TR);
    await passWithTwo(f, pid);
    await expect(f.governance.execute(pid)).to.emit(f.governance, "ProposalExecuted");
    const s = await f.schemas.getSchema(id(NETWORK_VCT));
    expect(s.tier).to.equal(SchemaTier.NETWORK);
  });

  it("NS1: ulusal vct yalnız kendi devlet koduyla ve tam biçimde", async () => {
    const w = f.as(f.schemas, f.trDelegate);
    const bad = [
      "urn:tamga:kz:edu:Attestat:1", // başka devletin ad alanı
      "urn:tamga:TR:edu:X:1", // büyük harf
      "urn:tamga:tr:edu:X", // eksik bölüm
      "urn:tamga:tr:edu:X:1:extra", // fazla bölüm
      "urn:tamga:tr:edu::1", // boş bölüm
      "urn:tamga:tr:edu:X:", // boş son bölüm
      "urn:eudi:pid:tr:1", // başka şema
      "https://schemas.tamga.network/v1/tr/edu/X/1.0.0",
    ];
    for (const vct of bad) {
      await expect(w.registerSchema(f.schemaRecord(vct, SchemaTier.NATIONAL, TR)), vct)
        .to.be.revertedWithCustomError(f.schemas, "NationalVctOutsideNamespace")
        .withArgs(TR);
    }
    await expect(
      w.registerSchema(f.schemaRecord("urn:tamga:tr:edu:YOKDenklikCredential:1", SchemaTier.NATIONAL, TR)),
    ).to.emit(f.schemas, "SchemaRegistered");
  });

  it("NS1: devlet-özel biçimdeki vct ağ şeması olarak önerilemez (öneri anında reddedilir)", async () => {
    await expect(
      f
        .as(f.governance, f.trValidator)
        .proposeNetworkSchema(f.schemaRecord("urn:tamga:tr:edu:DiplomaCredential:1", SchemaTier.NETWORK, "0x0000")),
    ).to.be.revertedWithCustomError(f.governance, "NetworkVctInNationalNamespace");
    // AB türü ve iki harfli alan adlı ağ türü (dört bölüm) ağ şeması olabilir
    await expect(
      f
        .as(f.governance, f.trValidator)
        .proposeNetworkSchema(f.schemaRecord("urn:tamga:id:IdentityAttestation:1", SchemaTier.NETWORK, "0x0000")),
    ).to.emit(f.governance, "ProposalCreated");
    await expect(
      f
        .as(f.governance, f.trValidator)
        .proposeNetworkSchema(f.schemaRecord("urn:eudi:pid:1", SchemaTier.NETWORK, "0x0000")),
    ).to.emit(f.governance, "ProposalCreated");
  });

  it("NS2 / F-12: kurum başka devletin kök sertifikasına bağlanamaz", async () => {
    const kzCA = await f.registerCA(KZ, f.kzDelegate, id("kz-root"));
    await expect(f.registerIssuer(TR, f.trDelegate, kzCA, id("tr-uni-2"), IssuerCategory.EDUCATION, IssuerAssurance.I2))
      .to.be.revertedWithCustomError(f.issuers, "CrossStateReference")
      .withArgs(kzCA, KZ);
  });

  it("NS2 / F-12: halef başka devletin kurumu olamaz; aynı devletin kurumu olabilir", async () => {
    const kzCA = await f.registerCA(KZ, f.kzDelegate, id("kz-root"));
    const kzUni = await f.registerIssuer(
      KZ,
      f.kzDelegate,
      kzCA,
      id("kz-uni"),
      IssuerCategory.EDUCATION,
      IssuerAssurance.I2,
    );
    await expect(f.as(f.issuers, f.trDelegate).revokeIssuer(f.uniIssuer, kzUni))
      .to.be.revertedWithCustomError(f.issuers, "CrossStateReference")
      .withArgs(kzUni, KZ);
    const trUni2 = await f.registerIssuer(
      TR,
      f.trDelegate,
      f.trCA,
      id("tr-uni-2"),
      IssuerCategory.EDUCATION,
      IssuerAssurance.I2,
    );
    await expect(f.as(f.issuers, f.trDelegate).revokeIssuer(f.uniIssuer, trUni2)).to.emit(f.issuers, "IssuerRevoked");
  });

  it("NS3 / F-10: kurum başına günde en çok 8 yeni liste; ertesi gün yeniden açılır", async () => {
    const w = f.as(f.statusLists, f.uniOperator);
    const max = Number(await f.statusLists.MAX_LIST_REGISTRATIONS_PER_ISSUER_PER_DAY());
    expect(max).to.equal(8);
    for (let i = 0; i < max; i++) {
      await (await w.registerList(f.uniIssuer, `https://status.example/l${i}`, 100_000, 2)).wait();
    }
    expect(await f.statusLists.listRegistrationsToday(f.uniIssuer)).to.equal(max);
    await expect(w.registerList(f.uniIssuer, "https://status.example/l-over", 100_000, 2))
      .to.be.revertedWithCustomError(f.statusLists, "ListRegistrationQuotaExceeded")
      .withArgs(f.uniIssuer, max);
    await networkHelpers.time.increase(DAY);
    await expect(w.registerList(f.uniIssuer, "https://status.example/l-next", 100_000, 2)).to.emit(
      f.statusLists,
      "ListRegistered",
    );
  });
});

describe("ADR-0055 — yükseltme kuyruğu ve kayıt yönetimi önerileri", function () {
  let f: Fixture;
  beforeEach(async () => {
    f = await loadFixture();
  });

  async function upgradeProposal(initSelector?: string) {
    const newImpl = await ethers.deployContract("IssuerRegistry");
    const g = f.as(f.governance, f.trValidator);
    const tx = initSelector
      ? await g.proposeProtocolUpgradeAndInit(await f.issuers.getAddress(), await newImpl.getAddress(), initSelector)
      : await g.proposeProtocolUpgrade(await f.issuers.getAddress(), await newImpl.getAddress());
    return { pid: await proposalId(tx, f), newImpl };
  }

  const implOf = async (proxy: string) => {
    const slot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
    return ethers.getAddress("0x" + (await ethers.provider.getStorage(proxy, slot)).slice(26));
  };

  it("GE1: eşik dolunca kuyruğa alınır; 7 gün dolmadan uygulanamaz; sonra uygulanır", async () => {
    const { pid, newImpl } = await upgradeProposal();
    await passWithTwo(f, pid);
    await expect(f.governance.execute(pid)).to.emit(f.governance, "ProposalQueued");
    const eta = await f.governance.executableAt(pid);
    expect(eta).to.not.equal(0n);
    await expect(f.governance.execute(pid))
      .to.be.revertedWithCustomError(f.governance, "UpgradeNotReady")
      .withArgs(pid, eta);
    expect(await implOf(await f.issuers.getAddress())).to.not.equal(await newImpl.getAddress());
    await networkHelpers.time.increaseTo(Number(eta));
    await expect(f.governance.execute(pid)).to.emit(f.governance, "ProposalExecuted").withArgs(pid);
    expect(await implOf(await f.issuers.getAddress())).to.equal(await newImpl.getAddress());
  });

  it("GE1: bekleme sırasında çekilen üyenin oyu sayılmaz (eşik yeniden sayılır)", async () => {
    const { pid } = await upgradeProposal();
    await passWithTwo(f, pid);
    await (await f.governance.execute(pid)).wait(); // kuyruk
    await (await f.as(f.governance, f.kzValidator).withdraw()).wait(); // KZ katılmıyor, çekiliyor
    await networkHelpers.time.increase(WEEK);
    await expect(f.governance.execute(pid)).to.be.revertedWithCustomError(f.governance, "ThresholdNotMet");
  });

  it("GE1: kuyruktaki öneri oylama süresi dolsa da uygulanır; eta + 30 günden sonra süresi dolar", async () => {
    const a = await upgradeProposal();
    await passWithTwo(f, a.pid);
    await networkHelpers.time.increase(29 * DAY); // oylama süresinin sonuna yakın
    await (await f.governance.execute(a.pid)).wait(); // kuyruk
    await networkHelpers.time.increase(WEEK); // TTL (30 gün) geçti, kuyrukta olduğu için uygulanır
    await expect(f.governance.execute(a.pid)).to.emit(f.governance, "ProposalExecuted");

    const b = await upgradeProposal();
    await passWithTwo(f, b.pid);
    await (await f.governance.execute(b.pid)).wait();
    await networkHelpers.time.increase(WEEK + 31 * DAY);
    await expect(f.governance.execute(b.pid)).to.be.revertedWithCustomError(f.governance, "ProposalExpired");
  });

  it("GE2: başlangıç seçicisi yükseltmeyle aynı işlemde çağrılır; geçersiz seçici bütün yürütmeyi geri alır", async () => {
    // parametresiz bir fonksiyon (burada salt okunur sabit) — çağrı yolunun kanıtı
    const sel = f.issuers.interface.getFunction("MAX_DELEGATES")!.selector;
    const ok = await upgradeProposal(sel);
    await passWithTwo(f, ok.pid);
    await (await f.governance.execute(ok.pid)).wait();
    await networkHelpers.time.increase(WEEK);
    await expect(f.governance.execute(ok.pid)).to.emit(f.governance, "ProposalExecuted");
    expect(await implOf(await f.issuers.getAddress())).to.equal(await ok.newImpl.getAddress());

    const bad = await upgradeProposal("0xdeadbeef");
    await passWithTwo(f, bad.pid);
    await (await f.governance.execute(bad.pid)).wait();
    await networkHelpers.time.increase(WEEK);
    await expect(f.governance.execute(bad.pid)).to.be.revert(ethers);
    expect((await f.governance.getProposal(bad.pid)).status).to.equal(1); // OPEN kaldı
  });

  it("GE3: liste çapası yazıcısı ve eşiği Governance önerisiyle yönetilir", async () => {
    const [, , , , , , , , a1, a2] = await ethers.getSigners();
    const impl = await ethers.deployContract("TrustListAnchorRegistry");
    const data = impl.interface.encodeFunctionData("initialize", [
      await f.governance.getAddress(),
      [await a1.getAddress()],
      1,
    ]);
    const proxy = await ethers.deployContract("ERC1967Proxy", [await impl.getAddress(), data]);
    const reg = await ethers.getContractAt("TrustListAnchorRegistry", await proxy.getAddress());

    const g = f.as(f.governance, f.trValidator);
    const p1 = await proposalId(await g.proposeAnchorerChange(await reg.getAddress(), await a2.getAddress(), true), f);
    await passWithTwo(f, p1);
    await expect(f.governance.execute(p1))
      .to.emit(reg, "AnchorerSet")
      .withArgs(await a2.getAddress(), true);
    expect(await reg.anchorerCount()).to.equal(2);

    const p2 = await proposalId(await g.proposeAnchorThreshold(await reg.getAddress(), 2), f);
    await passWithTwo(f, p2);
    await expect(f.governance.execute(p2)).to.emit(reg, "RequiredConfirmationsSet").withArgs(2);
    const payload = await f.governance.getAdminPayload(p2);
    expect(payload.required).to.equal(2);
  });

  it("GE3: kurucular arası tanıma Governance önerisiyle bir kez kurulur", async () => {
    const g = f.as(f.governance, f.trValidator);
    const pid = await proposalId(await g.proposeFounderRecognition(await f.recognition.getAddress(), [TR, KZ]), f);
    await passWithTwo(f, pid);
    await expect(f.governance.execute(pid)).to.emit(f.recognition, "RecognitionSet");
    expect((await f.recognition.getPolicy(KZ, TR)).mode).to.equal(RecognitionMode.FULL);
    const again = await proposalId(await g.proposeFounderRecognition(await f.recognition.getAddress(), [TR, KZ]), f);
    await passWithTwo(f, again);
    await expect(f.governance.execute(again)).to.be.revertedWithCustomError(f.recognition, "AlreadyBootstrapped");
  });

  it("GE3: ağ şeması Governance önerisiyle kullanımdan kalkar ve iptal edilir", async () => {
    const g = f.as(f.governance, f.trValidator);
    const reg = await proposalId(
      await g.proposeNetworkSchema(f.schemaRecord(NETWORK_VCT, SchemaTier.NETWORK, "0x0000")),
      f,
    );
    await passWithTwo(f, reg);
    await (await f.governance.execute(reg)).wait();
    const sid = id(NETWORK_VCT);

    const dep = await proposalId(await g.proposeNetworkSchemaDeprecation(sid, ZERO), f);
    await passWithTwo(f, dep);
    await expect(f.governance.execute(dep)).to.emit(f.schemas, "SchemaDeprecated");
    expect((await f.schemas.getSchema(sid)).status).to.equal(SchemaStatus.DEPRECATED);

    const rev = await proposalId(await g.proposeNetworkSchemaRevocation(sid, "ele gecirildi"), f);
    await passWithTwo(f, rev);
    await expect(f.governance.execute(rev)).to.emit(f.schemas, "SchemaRevoked");
    expect((await f.schemas.getSchema(sid)).status).to.equal(SchemaStatus.REVOKED);
  });

  it("GE3: yönetim önerisinin hedefi sıfır, Governance ya da kodsuz adres olamaz; yalnız validator önerir", async () => {
    const g = f.as(f.governance, f.trValidator);
    for (const t of [ethers.ZeroAddress, await f.governance.getAddress(), await f.stranger.getAddress()]) {
      await expect(g.proposeAnchorThreshold(t, 2)).to.be.revertedWithCustomError(f.governance, "InvalidAdminTarget");
    }
    await expect(
      f.as(f.governance, f.stranger).proposeAnchorThreshold(await f.recognition.getAddress(), 2),
    ).to.be.revertedWithCustomError(f.governance, "NotValidator");
    await expect(g.proposeFounderRecognition(await f.recognition.getAddress(), [TR])).to.be.revertedWithCustomError(
      f.governance,
      "FounderMismatch",
    );
  });
});
