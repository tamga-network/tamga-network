/**
 * ADR-0051 / SPEC-BC-0001 §15 — liste çapası kaydı: yalnız özet (CH2), eşikli yazıcılar (CH3), monoton sürüm (CH4), onaysız
 * çapa "evet" üretmez (CH1), yönetim yalnız governance, UUPS. ADR-0053: rakip adaylar ve çelişki olayı (AC1–AC4).
 */
import { expect } from "chai";
import type { Signer } from "ethers";

import { ZERO, ethers, id, networkHelpers } from "./helpers/fixture.js";

const listKey = (env: string, file: string) => id(`tamga:trust-list:${env}:${file}`);
const logKey = (env: string) => id(`tamga:anchors:${env}`);
const LOTL = listKey("production", "lotl");
const TL_TR = listKey("production", "tl-tr");
const LOG = logKey("production");

async function deploy(required: number, anchorers: Signer[]) {
  const [gov] = await ethers.getSigners();
  const impl = await ethers.deployContract("TrustListAnchorRegistry");
  const data = impl.interface.encodeFunctionData("initialize", [
    await gov.getAddress(),
    await Promise.all(anchorers.map((a) => a.getAddress())),
    required,
  ]);
  const proxy = await ethers.deployContract("ERC1967Proxy", [await impl.getAddress(), data]);
  const reg = await ethers.getContractAt("TrustListAnchorRegistry", await proxy.getAddress());
  return { reg, gov, as: (s: Signer) => reg.connect(s) as typeof reg };
}

describe("TrustListAnchorRegistry (ADR-0051)", function () {
  let a1: Signer, a2: Signer, a3: Signer, stranger: Signer;
  before(async () => {
    [, a1, a2, a3, stranger] = await ethers.getSigners();
  });

  async function deployTwoOfTwo() {
    return deploy(2, [a1, a2]);
  }
  async function deployOneOfOne() {
    return deploy(1, [a1]);
  }
  async function twoOfTwo() {
    return networkHelpers.loadFixture(deployTwoOfTwo);
  }

  it("kurulum: yazıcı kümesi, eşik; eşik 0 ve >16 reddedilir; governance sıfır olamaz", async () => {
    const { reg } = await twoOfTwo();
    expect(await reg.requiredConfirmations()).to.equal(2);
    expect(await reg.anchorerCount()).to.equal(2);
    expect(await reg.isAnchorer(await a1.getAddress())).to.equal(true);
    expect(await reg.isAnchorer(await stranger.getAddress())).to.equal(false);
    await expect(deploy(0, [a1]))
      .to.be.revertedWithCustomError(reg, "InvalidThreshold")
      .withArgs(0);
    await expect(deploy(17, [a1]))
      .to.be.revertedWithCustomError(reg, "InvalidThreshold")
      .withArgs(17);
    const impl = await ethers.deployContract("TrustListAnchorRegistry");
    const data = impl.interface.encodeFunctionData("initialize", [ethers.ZeroAddress, [], 1]);
    await expect(ethers.deployContract("ERC1967Proxy", [await impl.getAddress(), data])).to.be.revertedWithCustomError(
      impl,
      "ZeroAddress",
    );
  });

  it("CH3: eşik 2 — tek yazıcının çapası ONAYSIZDIR, isListAnchored false; ikinci aynı veri onaylar", async () => {
    const { reg, as } = await twoOfTwo();
    const h = id("lotl.jws v1");
    await expect(as(a1).anchorList(LOTL, 1, h, ZERO, 1_760_000_000))
      .to.emit(reg, "ListAnchorProposed")
      .withArgs(LOTL, 1, h, await a1.getAddress())
      .and.not.to.emit(reg, "ListAnchorConfirmed");
    expect(await reg.isListAnchored(LOTL, 1, h)).to.equal(false);
    expect(await reg.latestListVersion(LOTL)).to.equal(0);
    const pending = await reg.listAnchor(LOTL, 1);
    expect(pending.confirmations).to.equal(1);
    expect(pending.confirmed).to.equal(false);
    expect(await reg.hasConfirmed(LOTL, 1, await a1.getAddress())).to.equal(true);

    await expect(as(a2).anchorList(LOTL, 1, h, ZERO, 1_760_000_000))
      .to.emit(reg, "ListAnchorConfirmed")
      .withArgs(LOTL, 1, h);
    expect(await reg.isListAnchored(LOTL, 1, h)).to.equal(true);
    expect(await reg.latestListVersion(LOTL)).to.equal(1);
    const done = await reg.listAnchor(LOTL, 1);
    expect(done.confirmed).to.equal(true);
    expect(done.confirmedAt).to.not.equal(0n);
    expect(done.previousHash).to.equal(ZERO);
    expect(done.issuedAt).to.equal(1_760_000_000);
  });

  it("AC1/AC3 — çift konuşma: aynı sürüm için farklı özet reddedilmez, rakip aday olur ve AnchorConflict yayar", async () => {
    const { reg, as } = await twoOfTwo();
    const h = id("lotl v1 A");
    await expect(as(a1).anchorList(LOTL, 1, h, ZERO, 100)).not.to.emit(reg, "AnchorConflict");
    await expect(as(a2).anchorList(LOTL, 1, id("lotl v1 B"), ZERO, 100))
      .to.emit(reg, "AnchorConflict")
      .withArgs(LOTL, 1, h, id("lotl v1 B"), await a2.getAddress())
      .and.not.to.emit(reg, "ListAnchorConfirmed");
    expect(await reg.candidateCount(LOTL, 1)).to.equal(2);
    expect(await reg.listCandidateConfirmations(LOTL, 1, h, ZERO, 100)).to.equal(1);
    expect(await reg.listCandidateConfirmations(LOTL, 1, id("lotl v1 B"), ZERO, 100)).to.equal(1);
    // görünüm ilk adayı gösterir; hiçbir aday onaylı değil
    const view = await reg.listAnchor(LOTL, 1);
    expect(view.contentHash).to.equal(h);
    expect(view.confirmed).to.equal(false);
    expect(await reg.isListAnchored(LOTL, 1, h)).to.equal(false);
    expect(await reg.isListAnchored(LOTL, 1, id("lotl v1 B"))).to.equal(false);
  });

  it("AC1 — aynı özet, farklı previousHash ya da issuedAt de ayrı adaydır; bir yazıcı yalnız bir adayı destekler", async () => {
    const { reg, as } = await twoOfTwo();
    const h = id("v1");
    await as(a1).anchorList(LOTL, 1, h, ZERO, 100);
    await expect(as(a2).anchorList(LOTL, 1, h, id("baska prev"), 100)).to.emit(reg, "AnchorConflict");
    expect(await reg.isListAnchored(LOTL, 1, h)).to.equal(false);
    // a1 artık ikinci bir adayı destekleyemez
    await expect(as(a1).anchorList(LOTL, 1, h, id("baska prev"), 100))
      .to.be.revertedWithCustomError(reg, "AlreadyConfirmedBy")
      .withArgs(LOTL, 1, await a1.getAddress());
    expect(await reg.candidateCount(LOTL, 1)).to.equal(2);
  });

  it("F-05 — ilk açanın kilidi yok: yanlış veriyle açılan sürümü dürüst yazıcılar onaylatır (eşiği ilk dolduran kazanır)", async () => {
    const { reg, as, gov } = await twoOfTwo();
    await as(gov).setAnchorer(await a3.getAddress(), true); // 3 yazıcı, eşik 2
    const bad = id("sahte lotl v1");
    const good = id("lotl v1");
    await as(a1).anchorList(LOTL, 1, bad, ZERO, 100); // kötü niyetli ilk açan
    await expect(as(a2).anchorList(LOTL, 1, good, ZERO, 100)).to.emit(reg, "AnchorConflict");
    await expect(as(a3).anchorList(LOTL, 1, good, ZERO, 100))
      .to.emit(reg, "ListAnchorConfirmed")
      .withArgs(LOTL, 1, good);
    expect(await reg.isListAnchored(LOTL, 1, good)).to.equal(true);
    expect(await reg.isListAnchored(LOTL, 1, bad)).to.equal(false);
    const done = await reg.listAnchor(LOTL, 1);
    expect(done.contentHash).to.equal(good);
    expect(done.confirmations).to.equal(2);
    expect(await reg.latestListVersion(LOTL)).to.equal(1);
    // onaydan sonra sürüm kapanır: yeni aday ya da ek destek yok
    await expect(as(a1).anchorList(LOTL, 1, good, ZERO, 100)).to.be.revertedWithCustomError(reg, "AlreadyConfirmed");
  });

  it("F-05 — gelecekteki sürümü önceden kapmak işe yaramaz: dürüst veri yine onaylanır", async () => {
    const { reg, as, gov } = await twoOfTwo();
    await as(gov).setAnchorer(await a3.getAddress(), true);
    await as(a1).anchorList(TL_TR, 9, id("onceden kapilan v9"), ZERO, 9);
    await as(a2).anchorList(TL_TR, 9, id("tl-tr v9"), id("v8"), 9);
    await as(a3).anchorList(TL_TR, 9, id("tl-tr v9"), id("v8"), 9);
    expect(await reg.isListAnchored(TL_TR, 9, id("tl-tr v9"))).to.equal(true);
  });

  it("AC4 — anahtar döndürme iki oy vermez: çıkarılan yazıcının desteği sayılmaz", async () => {
    const { reg, as, gov } = await twoOfTwo();
    const h = id("v1");
    await as(a1).anchorList(LOTL, 1, h, ZERO, 1); // işletmecinin eski anahtarı a1
    await as(gov).setAnchorer(await a1.getAddress(), false); // anahtar döndürülür
    await as(gov).setAnchorer(await a3.getAddress(), true); // aynı işletmecinin yeni anahtarı a3
    await expect(as(a3).anchorList(LOTL, 1, h, ZERO, 1)).not.to.emit(reg, "ListAnchorConfirmed");
    expect(await reg.isListAnchored(LOTL, 1, h)).to.equal(false);
    expect(await reg.listCandidateConfirmations(LOTL, 1, h, ZERO, 1)).to.equal(1);
    // bağımsız ikinci işletmeci (a2) onaylatır
    await expect(as(a2).anchorList(LOTL, 1, h, ZERO, 1)).to.emit(reg, "ListAnchorConfirmed");
  });

  it("AC4 — eşik yazıcı sayısını aşamaz (kurulumda ve sonradan)", async () => {
    const { reg, as, gov } = await twoOfTwo();
    await expect(as(gov).setRequiredConfirmations(3))
      .to.be.revertedWithCustomError(reg, "InvalidThreshold")
      .withArgs(3);
    await expect(deploy(2, [a1]))
      .to.be.revertedWithCustomError(reg, "InvalidThreshold")
      .withArgs(2);
  });

  it("günlük başı da aynı kural: rakip aday, çelişki olayı, eşiği ilk dolduran kazanır", async () => {
    const { reg, as, gov } = await twoOfTwo();
    await as(gov).setAnchorer(await a3.getAddress(), true);
    await as(a1).anchorLogHead(LOG, 4, id("sahte satir"), 14);
    await expect(as(a2).anchorLogHead(LOG, 4, id("satir4"), 14))
      .to.emit(reg, "AnchorConflict")
      .withArgs(LOG, 4, id("sahte satir"), id("satir4"), await a2.getAddress());
    expect(await reg.logCandidateConfirmations(LOG, 4, id("satir4"), 14)).to.equal(1);
    await expect(as(a3).anchorLogHead(LOG, 4, id("satir4"), 14))
      .to.emit(reg, "LogHeadConfirmed")
      .withArgs(LOG, 4, id("satir4"));
    expect(await reg.isLogLineAnchored(LOG, 4, id("satir4"))).to.equal(true);
    expect((await reg.logHead(LOG, 4)).lineHash).to.equal(id("satir4"));
    expect(await reg.latestLogSeq(LOG)).to.equal(4);
  });

  it("aynı yazıcı aynı çapayı iki kez onaylayamaz (eşik tek elden dolmaz)", async () => {
    const { reg, as } = await twoOfTwo();
    const h = id("v1");
    await as(a1).anchorList(LOTL, 1, h, ZERO, 1);
    await expect(as(a1).anchorList(LOTL, 1, h, ZERO, 1))
      .to.be.revertedWithCustomError(reg, "AlreadyConfirmedBy")
      .withArgs(LOTL, 1, await a1.getAddress());
    expect(await reg.isListAnchored(LOTL, 1, h)).to.equal(false);
  });

  it("CH4 — monoton: onaylı en yüksek sürümün altında/eşitinde yeni sürüm açılamaz; sürüm 0 yok; onaylıya ek yazım yok", async () => {
    const { reg, as } = await twoOfTwo();
    const h2 = id("v2");
    await as(a1).anchorList(LOTL, 2, h2, id("v1"), 2);
    await as(a2).anchorList(LOTL, 2, h2, id("v1"), 2);
    expect(await reg.latestListVersion(LOTL)).to.equal(2);
    await expect(as(a1).anchorList(LOTL, 1, id("v1"), ZERO, 1))
      .to.be.revertedWithCustomError(reg, "VersionNotMonotonic")
      .withArgs(2, 1);
    await expect(as(a1).anchorList(LOTL, 0, id("v0"), ZERO, 0)).to.be.revertedWithCustomError(
      reg,
      "VersionNotMonotonic",
    );
    await expect(as(a1).anchorList(LOTL, 2, h2, id("v1"), 2)).to.be.revertedWithCustomError(reg, "AlreadyConfirmed");
    // bekleyen bir eski sürüm (3 onaylanmadan 4 açılabilir); 4 onaylanınca latest 4
    await as(a1).anchorList(LOTL, 3, id("v3"), h2, 3);
    await as(a1).anchorList(LOTL, 4, id("v4"), id("v3"), 4);
    await as(a2).anchorList(LOTL, 4, id("v4"), id("v3"), 4);
    expect(await reg.latestListVersion(LOTL)).to.equal(4);
    expect(await reg.isListAnchored(LOTL, 3, id("v3"))).to.equal(false);
  });

  it("listeler birbirinden bağımsız (lotl, tl-tr; production ≠ sandbox anahtarı)", async () => {
    const { reg, as } = await twoOfTwo();
    await as(a1).anchorList(LOTL, 5, id("lotl5"), ZERO, 5);
    await as(a2).anchorList(LOTL, 5, id("lotl5"), ZERO, 5);
    await as(a1).anchorList(TL_TR, 1, id("tl1"), ZERO, 1);
    await as(a2).anchorList(TL_TR, 1, id("tl1"), ZERO, 1);
    expect(await reg.latestListVersion(LOTL)).to.equal(5);
    expect(await reg.latestListVersion(TL_TR)).to.equal(1);
    expect(await reg.latestListVersion(listKey("sandbox", "lotl"))).to.equal(0);
    expect(await reg.isListAnchored(TL_TR, 1, id("lotl5"))).to.equal(false);
  });

  it("boş özet reddedilir; yabancı yazamaz; governance bile yazıcı değilse yazamaz", async () => {
    const { reg, as, gov } = await twoOfTwo();
    await expect(as(a1).anchorList(LOTL, 1, ZERO, ZERO, 1)).to.be.revertedWithCustomError(reg, "EmptyContentHash");
    await expect(as(stranger).anchorList(LOTL, 1, id("x"), ZERO, 1))
      .to.be.revertedWithCustomError(reg, "NotAnchorer")
      .withArgs(await stranger.getAddress());
    await expect(as(gov).anchorLogHead(LOG, 0, id("x"), 1)).to.be.revertedWithCustomError(reg, "NotAnchorer");
    await expect(as(a1).anchorLogHead(LOG, 0, ZERO, 1)).to.be.revertedWithCustomError(reg, "EmptyContentHash");
  });

  it("çapa günlüğü başı: seq 0 açılabilir, sonra monoton; eşik ve çift konuşma aynı kural", async () => {
    const { reg, as } = await twoOfTwo();
    const l0 = id("line0");
    await as(a1).anchorLogHead(LOG, 0, l0, 10);
    expect(await reg.isLogLineAnchored(LOG, 0, l0)).to.equal(false);
    await expect(as(a2).anchorLogHead(LOG, 0, l0, 10))
      .to.emit(reg, "LogHeadConfirmed")
      .withArgs(LOG, 0, l0);
    expect(await reg.isLogLineAnchored(LOG, 0, l0)).to.equal(true);
    expect(await reg.latestLogSeq(LOG)).to.equal(0);
    // seq 0 onaylandı → tekrar 0 açılamaz
    await expect(as(a1).anchorLogHead(LOG, 0, l0, 10)).to.be.revertedWithCustomError(reg, "AlreadyConfirmed");
    const l7 = id("line7");
    await as(a1).anchorLogHead(LOG, 7, l7, 17);
    await as(a2).anchorLogHead(LOG, 7, l7, 17);
    expect(await reg.latestLogSeq(LOG)).to.equal(7);
    await expect(as(a1).anchorLogHead(LOG, 3, id("line3"), 13))
      .to.be.revertedWithCustomError(reg, "SeqNotMonotonic")
      .withArgs(7, 3);
    const h = await reg.logHead(LOG, 7);
    expect(h.ts).to.equal(17);
    expect(h.confirmed).to.equal(true);
  });

  it("eşik 1 (geliştirme ağı): tek yazıcı hemen onaylar", async () => {
    const { reg, as } = await networkHelpers.loadFixture(deployOneOfOne);
    await expect(as(a1).anchorList(LOTL, 1, id("v1"), ZERO, 1)).to.emit(reg, "ListAnchorConfirmed");
    expect(await reg.isListAnchored(LOTL, 1, id("v1"))).to.equal(true);
  });

  it("yönetim: yazıcı ekleme/çıkarma ve eşik yalnız governance; çıkarılan yazıcı yazamaz; eşik 3 ile üçüncü onay gerekir", async () => {
    const { reg, as, gov } = await twoOfTwo();
    await expect(as(a1).setAnchorer(await a3.getAddress(), true)).to.be.revertedWithCustomError(reg, "NotGovernance");
    await expect(as(a1).setRequiredConfirmations(1)).to.be.revertedWithCustomError(reg, "NotGovernance");
    await expect(as(gov).setAnchorer(await a3.getAddress(), true))
      .to.emit(reg, "AnchorerSet")
      .withArgs(await a3.getAddress(), true);
    expect(await reg.anchorerCount()).to.equal(3);
    await expect(as(gov).setRequiredConfirmations(3)).to.emit(reg, "RequiredConfirmationsSet").withArgs(3);
    await as(a1).anchorList(LOTL, 1, id("v1"), ZERO, 1);
    await as(a2).anchorList(LOTL, 1, id("v1"), ZERO, 1);
    expect(await reg.isListAnchored(LOTL, 1, id("v1"))).to.equal(false);
    await as(a3).anchorList(LOTL, 1, id("v1"), ZERO, 1);
    expect(await reg.isListAnchored(LOTL, 1, id("v1"))).to.equal(true);
    await as(gov).setAnchorer(await a3.getAddress(), false);
    expect(await reg.anchorerCount()).to.equal(2);
    await expect(as(a3).anchorList(LOTL, 2, id("v2"), id("v1"), 2)).to.be.revertedWithCustomError(reg, "NotAnchorer");
    await expect(as(gov).setRequiredConfirmations(0)).to.be.revertedWithCustomError(reg, "InvalidThreshold");
    await expect(as(gov).setAnchorer(ethers.ZeroAddress, true)).to.be.revertedWithCustomError(reg, "ZeroAddress");
  });

  it("UUPS: yalnız governance yükseltir; implementasyon doğrudan initialize edilemez", async () => {
    const { reg, as, gov } = await twoOfTwo();
    const newImpl = await ethers.deployContract("TrustListAnchorRegistry");
    await expect(as(a1).upgradeToAndCall(await newImpl.getAddress(), "0x")).to.be.revertedWithCustomError(
      reg,
      "NotGovernance",
    );
    await as(gov).upgradeToAndCall(await newImpl.getAddress(), "0x");
    expect(await reg.requiredConfirmations()).to.equal(2); // depolama korunur
    await expect(newImpl.initialize(await gov.getAddress(), [], 1)).to.be.revertedWithCustomError(
      newImpl,
      "InvalidInitialization",
    );
  });

  it("CH2 / DP1: ABI'de string ya da bytes alanı yok — yalnız bytes32, tam sayı, adres, bool", () => {
    const impl = ethers.getContractFactory("TrustListAnchorRegistry");
    return impl.then((f) => {
      const walk = (ps: readonly any[]): string[] => ps.flatMap((p) => (p.components ? walk(p.components) : [p.type]));
      for (const fr of f.interface.fragments) {
        if (fr.type !== "function" && fr.type !== "event") continue;
        if ((fr as any).name === "upgradeToAndCall") continue; // OZ UUPS; yalnız governance, boş data
        for (const t of walk((fr as any).inputs ?? [])) {
          expect(
            /^(bytes32|uint8|uint32|uint64|address|bool|address\[\])$/.test(t),
            `${(fr as any).name}: ${t}`,
          ).to.equal(true);
        }
      }
    });
  });
});
