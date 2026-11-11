/**
 * Bağımsız kontrol 2026-11-10 — zincir bulguları (kontrat + indeksleyici), süreç içi Hardhat zincirinde:
 *   - I1 : `stagePeriodChange` yalnız kayıtlı kimlik için; indeksleyici sabitleme olaylarına tepki vermez — yetkisiz bir hesabın
 *          sabitlemesi imleci durduramaz (eski hâl: `getRelyingParty` UnknownRP ile her `sync` düşüyordu);
 *   - I1b: `NetworkRegistry.stageRecord` dizine hayalet kayıt (tür 0) yazdırmaz;
 *   - I2 : olaylar dilimlerle okunur, imleç dilim dilim ilerler; küçük dilimle kurulan dizin tek dilimle kurulanla aynıdır;
 *   - I4 : sürdürülen dizin başka zincire / başka adrese / daha kısa zincire bağlanamaz;
 *   - tek kaydın okuması geri dönerse imleç durmaz, kayıt `errors`'a yazılır ve kaynak UNKNOWN verir;
 *   - C3 : çapa günlüğü sırası bir adımda en çok MAX_VERSION_STEP artar;
 *   - C4 : şema geçerlilik başlangıcı kip dışında geçmişe çekilemez;
 *   - C5 : Governance → SchemaRegistry bağı kurulumda doğrulanır.
 */
import { expect } from "chai";

import { addressesFrom, connectTrustContracts } from "../../apps/chain-indexer/src/contracts.js";
import { ChainTrustSource } from "../../apps/chain-indexer/src/chain-trust-source.js";
import { ChainIndexer, type ChainIndex } from "../../apps/chain-indexer/src/indexer.js";
import { providerFromEip1193 } from "../../apps/chain-indexer/src/local-dev.js";
import { assertSchemaRegistryBound } from "../scripts/lib/deploy.js";
import {
  DAY,
  KZ,
  SchemaTier,
  TR,
  ZERO,
  conn,
  ethers,
  id,
  loadFixture,
  networkHelpers,
  type Fixture,
} from "./helpers/fixture.js";

const record = (over: Record<string, unknown> = {}) => ({
  kind: 3,
  recordId: id("phantom-circuit"),
  parentId: ZERO,
  region: "0x0000",
  subtype: 1,
  status: 1,
  validFrom: 0,
  validUntil: 0,
  fingerprint: id("f"),
  detailsHash: ZERO,
  flags: 0,
  digests: [],
  ...over,
});
const periodChange = (rpId: string) => ({
  action: 1,
  rpId,
  fromState: TR,
  toState: KZ,
  nameHash: id("n"),
  accessCertFingerprint: id("c"),
  reasonHash: id("r"),
});
const rp = (rpId: string, cert: string) => ({
  rpId,
  stateCode: TR,
  nameHash: id("Example Verifier"),
  accessCertFingerprint: id(cert),
  status: 1,
  registeredAt: 0,
});

function indexerOf(f: Fixture, index?: ChainIndex) {
  const provider = providerFromEip1193(conn.provider as any);
  const c = connectTrustContracts(addressesFrom({ contracts: f.addresses }), provider);
  return { provider, c, ix: new ChainIndexer(provider, c, index) };
}
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

describe("Kontrol 2026-11-10 — zincir bulguları", function () {
  this.timeout(120_000);

  it("I1: kayıtsız kimlik için dönem değişikliği sabitlenemez; kayıtlı kimlik için herkes sabitleyebilir (ADR-0075)", async () => {
    const f = await loadFixture();
    const reg = f.as(f.relyingParties, f.stranger);
    await expect(reg.stagePeriodChange(periodChange(id("no-such-verifier.example"))))
      .to.be.revertedWithCustomError(f.relyingParties, "UnknownRP")
      .withArgs(id("no-such-verifier.example"));
    const RPID = id("verify.example.tr");
    await (await f.as(f.relyingParties, f.trDelegate).registerRelyingParty(rp(RPID, "CERT-1"))).wait();
    await expect(reg.stagePeriodChange(periodChange(RPID))).to.emit(f.relyingParties, "PeriodChangeStaged");
  });

  it("I1/I1b: yetkisiz sabitleme olayları indeksi durdurmaz ve dizine hayalet kayıt yazmaz", async () => {
    const f = await loadFixture();
    const RPID = id("verify.example.tr");
    await (await f.as(f.relyingParties, f.trDelegate).registerRelyingParty(rp(RPID, "CERT-1"))).wait();
    const { provider, ix } = indexerOf(f);
    await ix.sync();
    const before = clone(ix.index);

    // (a) rolü olmayan hesap ağ düzeyi kayıt sabitler: kayıt yazılmadı → dizinde yok
    await (await f.as(f.networkRegistry, f.stranger).stageRecord(record())).wait();
    // (b) rolü olmayan hesap kayıtlı kimlik için dönem değişikliği sabitler: kayıt değişmedi
    await (await f.as(f.relyingParties, f.stranger).stagePeriodChange(periodChange(RPID))).wait();

    const head = await provider.getBlockNumber();
    expect(await ix.sync()).to.equal(head);
    expect(ix.index.meta.block).to.equal(head);
    expect(ix.index.errors).to.deep.equal([]);
    expect(ix.index.records).to.deep.equal(before.records);
    expect(Object.keys(ix.index.records)).to.have.length(0);
    expect(ix.index.rps).to.deep.equal(before.rps);
  });

  it("okuması geri dönen kayıt imleci durdurmaz: `errors`'a yazılır, kaynak UNKNOWN verir, sonraki koşu yeniden dener", async () => {
    const f = await loadFixture();
    const { provider, c } = indexerOf(f);
    const RPID = id("verify.example.tr");
    await (await f.as(f.relyingParties, f.trDelegate).registerRelyingParty(rp(RPID, "CERT-1"))).wait();
    // doğrulayıcı okuması geri dönen bir kontrat görünümü (ör. bozuk kayıt): yalnız `getRelyingParty` UnknownRP verir
    let broken = true;
    const real = c.RelyingPartyRegistry;
    const faulty = new Proxy(real, {
      get(t, k, r) {
        if (k === "getRelyingParty" && broken) return (_: string, o: unknown) => t.getRelyingParty(id("yok"), o);
        return Reflect.get(t, k, r);
      },
    });
    const ix = new ChainIndexer(provider, { ...c, RelyingPartyRegistry: faulty });
    const head = await provider.getBlockNumber();
    expect(await ix.sync()).to.equal(head);
    expect(ix.index.meta.block).to.equal(head);
    expect(ix.index.errors).to.have.length(1);
    expect(ix.index.errors[0]).to.include({ set: "rps", id: RPID });
    expect(ix.index.errors[0].error).to.match(/UnknownRP/);
    // kurum kaydı okundu (tek bozuk kayıt ötekileri engellemez), ama kaynak bütünüyle UNKNOWN (eksik dizin)
    expect(Object.keys(ix.index.issuers)).to.have.length(1);
    const now = (await provider.getBlock(head))!.timestamp;
    const src = (index: ChainIndex) =>
      new ChainTrustSource(index, {
        now: () => new Date(now * 1000),
        content: { projectedLevel: now, listLevel: () => now },
      });
    expect(src(ix.index).healthProblem()).to.equal("index_errors");
    expect(src(ix.index).isCredentialAcceptable(f.uniIssuer, now)).to.equal("UNKNOWN");
    // okuma düzelince sonraki koşu kaydı yeniden dener (yeni blok gerekir) ve hata silinir
    broken = false;
    await (await f.as(f.relyingParties, f.trDelegate).suspendRelyingParty(RPID)).wait();
    await ix.sync();
    expect(ix.index.errors).to.deep.equal([]);
    expect(ix.index.rps[RPID].status).to.equal(2);
    expect(src(ix.index).healthProblem()).to.equal(null);
  });

  it("I2: olaylar dilimlerle okunur; imleç dilim dilim ilerler ve sonuç tek dilimle aynıdır", async () => {
    const f = await loadFixture();
    for (let k = 0; k < 4; k++)
      await (
        await f.as(f.relyingParties, f.trDelegate).registerRelyingParty(rp(id(`v${k}.example.tr`), `CERT-${k}`))
      ).wait();
    const one = indexerOf(f);
    const head = await one.ix.sync();
    // sağlayıcının gördüğü her olay isteği en çok 3 blokluk olmalı
    const small = indexerOf(f);
    const ranges: Array<[number, number]> = [];
    const getLogs = small.provider.getLogs.bind(small.provider);
    small.provider.getLogs = async (filter: any) => {
      ranges.push([Number(filter.fromBlock), Number(filter.toBlock)]);
      return getLogs(filter);
    };
    const cursor: number[] = [];
    const getBlock = small.provider.getBlock.bind(small.provider);
    small.provider.getBlock = async (b: any) => {
      cursor.push(small.ix.index.meta.block);
      return getBlock(b);
    };
    expect(await small.ix.sync(undefined, 3)).to.equal(head);
    expect(ranges.length).to.be.greaterThan(7);
    for (const [lo, hi] of ranges) expect(hi - lo).to.be.lessThan(3);
    // imleç ara dilimlerde ilerledi (tek atlayışta değil)
    expect(new Set(cursor).size).to.be.greaterThan(2);
    const strip = (x: ChainIndex) => clone(x);
    expect(strip(small.ix.index)).to.deep.equal(strip(one.ix.index));
    // yarıda kalan koşu: ilk yarı, sonra tamamı → aynı dizin
    const half = indexerOf(f);
    await half.ix.sync(Math.floor(head / 2), 3);
    expect(half.ix.index.meta.block).to.equal(Math.floor(head / 2));
    await half.ix.sync(undefined, 3);
    expect(strip(half.ix.index)).to.deep.equal(strip(one.ix.index));
  });

  it("I4: sürdürülen dizin başka zincire, başka kontrat adresine ya da daha kısa zincire bağlanamaz", async () => {
    const f = await loadFixture();
    const a = indexerOf(f);
    await a.ix.sync();
    const saved = clone(a.ix.index);
    // aynı dizin sürdürülebilir
    await indexerOf(f, clone(saved)).ix.sync();

    const otherChain = clone(saved);
    otherChain.meta.chainId = 4242;
    let err = "";
    await indexerOf(f, otherChain)
      .ix.sync()
      .catch((e) => (err = e.message));
    expect(err).to.match(/başka zincirin/);

    const otherAddr = clone(saved);
    otherAddr.meta.addresses.IssuerRegistry = "0x" + "12".repeat(20);
    err = "";
    await indexerOf(f, otherAddr)
      .ix.sync()
      .catch((e) => (err = e.message));
    expect(err).to.match(/IssuerRegistry adresinden/);

    const ahead = clone(saved);
    ahead.meta.block = saved.meta.block + 1000;
    delete ahead.meta.blockHash;
    err = "";
    await indexerOf(f, ahead)
      .ix.sync()
      .catch((e) => (err = e.message));
    expect(err).to.match(/zincir dizinden kısa/);

    const otherHash = clone(saved);
    otherHash.meta.blockHash = "0x" + "ab".repeat(32);
    err = "";
    await indexerOf(f, otherHash)
      .ix.sync()
      .catch((e) => (err = e.message));
    expect(err).to.match(/özeti dizindekiyle aynı değil/);
  });

  it("C3: çapa günlüğü sırası bir adımda en çok MAX_VERSION_STEP artar (2^64-1 ile dondurma yok)", async () => {
    const [gov, a1] = await ethers.getSigners();
    const impl = await ethers.deployContract("TrustListAnchorRegistry");
    const data = impl.interface.encodeFunctionData("initialize", [await gov.getAddress(), [await a1.getAddress()], 1]);
    const proxy = await ethers.deployContract("ERC1967Proxy", [await impl.getAddress(), data]);
    const reg = (await ethers.getContractAt("TrustListAnchorRegistry", await proxy.getAddress())).connect(a1) as any;
    const LOG = id("tamga:anchors:production");
    const step = BigInt(await reg.MAX_VERSION_STEP());
    await expect(reg.anchorLogHead(LOG, 2n ** 64n - 1n, id("x"), 1))
      .to.be.revertedWithCustomError(reg, "VersionStepTooLarge")
      .withArgs(0, 2n ** 64n - 1n);
    await expect(reg.anchorLogHead(LOG, step + 1n, id("x"), 1)).to.be.revertedWithCustomError(
      reg,
      "VersionStepTooLarge",
    );
    await (await reg.anchorLogHead(LOG, 0, id("satir0"), 1)).wait();
    await (await reg.anchorLogHead(LOG, step, id("satirN"), 2)).wait(); // sınırın kendisi geçerli
    await expect(reg.anchorLogHead(LOG, 2n * step + 1n, id("y"), 3))
      .to.be.revertedWithCustomError(reg, "VersionStepTooLarge")
      .withArgs(step, 2n * step + 1n);
    await (await reg.anchorLogHead(LOG, step + 1n, id("satirN1"), 3)).wait();
  });

  it("C4: şema geçerlilik başlangıcı kip dışında geçmişe çekilemez (ileri tarih ve 0 geçerli)", async () => {
    const f = await loadFixture();
    const now = await f.now();
    const schemas = f.as(f.schemas, f.trDelegate);
    const rec = (vct: string, validFrom: number) => ({
      ...f.schemaRecord(vct, SchemaTier.NATIONAL, TR, id(vct)),
      validFrom,
    });
    await expect(schemas.registerSchema(rec("urn:tamga:tr:edu:Past:1", now - 1000)))
      .to.be.revertedWithCustomError(f.schemas, "PastDateOutsideMigration")
      .withArgs(now - 1000);
    await (await schemas.registerSchema(rec("urn:tamga:tr:edu:Now:1", 0))).wait();
    await (await schemas.registerSchema(rec("urn:tamga:tr:edu:Future:1", now + 100_000))).wait();
    expect(Number((await f.schemas.getSchema(id("urn:tamga:tr:edu:Future:1"))).validFrom)).to.equal(now + 100_000);
  });

  describe("C1: oy değiştirme ve geri çekme (öneri yürütülene kadar)", () => {
    const pidOf = async (tx: any, f: Fixture): Promise<string> => {
      const rc = await tx.wait();
      for (const l of rc.logs) {
        try {
          const e = f.governance.interface.parseLog(l);
          if (e?.name === "ProposalCreated") return e.args.id;
        } catch {
          /* başka kontrat */
        }
      }
      throw new Error("ProposalCreated yok");
    };
    const upgrade = async (f: Fixture) => {
      const impl = await ethers.deployContract("IssuerRegistry");
      const tx = await f
        .as(f.governance, f.trValidator)
        .proposeProtocolUpgrade(await f.issuers.getAddress(), await impl.getAddress());
      return pidOf(tx, f);
    };

    it("oy çevrilir (sayaçlar taşınır), aynı yönde ikinci oy reddedilir, geri çekilen oy sayılmaz", async () => {
      const f = await loadFixture();
      const g = (s: any) => f.as(f.governance, s);
      const pid = await pidOf(await g(f.trValidator).proposeAnchorThreshold(await f.issuers.getAddress(), 1), f);
      await (await g(f.trValidator).vote(pid, true)).wait();
      await (await g(f.kzValidator).vote(pid, true)).wait();
      await expect(g(f.kzValidator).vote(pid, true)).to.be.revertedWithCustomError(f.governance, "AlreadyVoted");
      expect(Number(await f.governance.countedForVotes(pid))).to.equal(2);
      // KZ fikir değiştirir: destek → karşı
      await expect(g(f.kzValidator).vote(pid, false))
        .to.emit(f.governance, "Voted")
        .withArgs(pid, await f.kzValidator.getAddress(), false);
      let p = await f.governance.getProposal(pid);
      expect([Number(p.forVotes), Number(p.againstVotes)]).to.deep.equal([1, 1]);
      expect(Number(await f.governance.countedForVotes(pid))).to.equal(1);
      await expect(f.governance.execute(pid)).to.be.revertedWithCustomError(f.governance, "ThresholdNotMet");
      // KZ oyunu bütünüyle geri çeker; ikinci geri çekme reddedilir; yeniden oy verebilir
      await expect(g(f.kzValidator).retractVote(pid))
        .to.emit(f.governance, "VoteRetracted")
        .withArgs(pid, await f.kzValidator.getAddress());
      p = await f.governance.getProposal(pid);
      expect([Number(p.forVotes), Number(p.againstVotes)]).to.deep.equal([1, 0]);
      await expect(g(f.kzValidator).retractVote(pid)).to.be.revertedWithCustomError(f.governance, "NoVote");
      await expect(g(f.stranger).retractVote(pid)).to.be.revertedWithCustomError(f.governance, "NotValidator");
      await (await g(f.kzValidator).vote(pid, true)).wait();
      expect(Number(await f.governance.countedForVotes(pid))).to.equal(2);
    });

    it("yürütülmüş, geri çekilmiş ve süresi dolmuş öneride oy değişmez", async () => {
      const f = await loadFixture();
      const g = (s: any) => f.as(f.governance, s);
      const a = await pidOf(await g(f.trValidator).proposeStateAdmission("0x555a", await f.stranger.getAddress()), f);
      await (await g(f.trValidator).vote(a, true)).wait();
      await (await g(f.kzValidator).vote(a, true)).wait();
      await (await f.governance.execute(a)).wait();
      await expect(g(f.kzValidator).retractVote(a)).to.be.revertedWithCustomError(f.governance, "ProposalNotOpen");
      await expect(g(f.kzValidator).vote(a, false)).to.be.revertedWithCustomError(f.governance, "ProposalNotOpen");
      const b = await pidOf(await g(f.trValidator).proposeAnchorThreshold(await f.issuers.getAddress(), 1), f);
      await (await g(f.kzValidator).vote(b, true)).wait();
      await networkHelpers.time.increase(30 * DAY);
      await expect(g(f.kzValidator).retractVote(b)).to.be.revertedWithCustomError(f.governance, "ProposalExpired");
      await expect(g(f.kzValidator).vote(b, false)).to.be.revertedWithCustomError(f.governance, "ProposalExpired");
      await expect(g(f.trValidator).retractVote(id("yok"))).to.be.revertedWithCustomError(
        f.governance,
        "UnknownProposal",
      );
    });

    it("kuyruktaki yükseltme: bekleme süresinde geri çekilen oyla eşik düşer, yükseltme uygulanmaz; oy dönünce uygulanır", async () => {
      const f = await loadFixture();
      const g = (s: any) => f.as(f.governance, s);
      const pid = await upgrade(f);
      await (await g(f.trValidator).vote(pid, true)).wait();
      await (await g(f.kzValidator).vote(pid, true)).wait();
      await (await f.governance.execute(pid)).wait(); // kuyruk
      const eta = Number(await f.governance.executableAt(pid));
      expect(eta).to.be.greaterThan(0);
      // bekleme süresinde (oylama süresi geçmiş olsa da) KZ oyunu geri çeker
      await networkHelpers.time.increaseTo(eta - 100);
      await (await g(f.kzValidator).retractVote(pid)).wait();
      await networkHelpers.time.increaseTo(eta);
      await expect(f.governance.execute(pid)).to.be.revertedWithCustomError(f.governance, "ThresholdNotMet");
      // AZ kuyruktayken ilk kez oy verir → eşik yeniden dolar
      await (await g(f.azValidator).vote(pid, true)).wait();
      await expect(f.governance.execute(pid)).to.emit(f.governance, "ProposalExecuted").withArgs(pid);
      await expect(g(f.azValidator).retractVote(pid)).to.be.revertedWithCustomError(f.governance, "ProposalNotOpen");
    });

    it("çıkarma oylamasında çıkarılan üye oy çeviremez / veremez (ADR-0002)", async () => {
      const f = await loadFixture();
      const g = (s: any) => f.as(f.governance, s);
      const pid = await pidOf(await g(f.trValidator).proposeStateRemoval(KZ, id("gerekce")), f);
      await expect(g(f.kzValidator).vote(pid, false)).to.be.revertedWithCustomError(f.governance, "NotValidator");
      await expect(g(f.kzValidator).retractVote(pid)).to.be.revertedWithCustomError(f.governance, "NoVote");
    });
  });

  it("C5: Governance → SchemaRegistry bağı beklenen kayıtta değilse kurulum denetimi durur", async () => {
    const f = await loadFixture();
    await assertSchemaRegistryBound(f.governance, await f.schemas.getAddress());
    let err = "";
    await assertSchemaRegistryBound(f.governance, await f.issuers.getAddress()).catch((e) => (err = e.message));
    expect(err).to.match(/dağıtım geçersiz/);
  });
});
