/**
 * ADR-0074 K3 (PJ1–PJ3) — NetworkRegistry: ağ düzeyi kayıtlar yalnız Governance önerisiyle (sabitlenmiş içerik özeti, 2/3)
 * ya da göç kipinde tek göç yürütücüsüyle; durum geçmişi yalnız eklenir; WUA anahtarı sorgusu; serbest metin yalnız özet.
 */
import { expect } from "chai";

import { DAY, ZERO, ethers, id, loadFixture, networkHelpers, type Fixture } from "./helpers/fixture.js";

enum Kind {
  NONE,
  WALLET_PROVIDER,
  WALLET_PROVIDER_KEY,
  ZK_CIRCUIT,
  EXTERNAL_LIST,
  EAA_CATEGORY,
  LIST_SIGNER,
  LIST_OPERATOR,
  STATE_SLOT,
  ROLE_SLOT,
  CATALOGUE,
}
enum St {
  NONE,
  ACTIVE,
  SUSPENDED,
  REVOKED,
  RETIRED,
  RESERVED,
  PROVISIONAL,
  DEPRECATED,
  DESIGNATED,
}

const PROVIDER = id("example-wallet-provider");
const KEY_FP = id("WUA-SIGNING-KEY-1");

const rec = (over: Record<string, unknown> = {}) => ({
  kind: Kind.WALLET_PROVIDER,
  recordId: PROVIDER,
  parentId: ZERO,
  region: "0x0000",
  subtype: 0,
  status: St.ACTIVE,
  validFrom: 0,
  validUntil: 0,
  fingerprint: ZERO,
  detailsHash: id("provider-block"),
  flags: 0,
  digests: [] as string[],
  ...over,
});

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

/** stage → öneri → 2/3 → yürütme */
async function commit(f: Fixture, r: ReturnType<typeof rec>) {
  const reg = f.networkRegistry as any;
  const stageId = await reg.stageIdOf(r);
  await (await reg.connect(f.stranger).stageRecord(r)).wait();
  const pid = await proposalId(
    await f.as(f.governance, f.trValidator).proposeNetworkRecord(await reg.getAddress(), stageId),
    f,
  );
  await (await f.as(f.governance, f.trValidator).vote(pid, true)).wait();
  await (await f.as(f.governance, f.kzValidator).vote(pid, true)).wait();
  return f.governance.execute(pid);
}

describe("NetworkRegistry (ADR-0074 K3)", function () {
  let f: Fixture;
  let reg: any;
  beforeEach(async () => {
    f = await loadFixture();
    reg = f.networkRegistry;
  });

  it("sabitlenen kayıt yalnız Governance önerisiyle yazılır; herkes sabitlenmiş içeriği okuyabilir", async () => {
    const r = rec();
    const stageId = await reg.stageIdOf(r);
    await expect(reg.connect(f.stranger).stageRecord(r))
      .to.emit(reg, "RecordStaged")
      .withArgs(stageId, Kind.WALLET_PROVIDER, PROVIDER);
    expect((await reg.stagedRecord(stageId)).detailsHash).to.equal(id("provider-block"));
    await expect(reg.connect(f.stranger).commitStaged(stageId)).to.be.revertedWithCustomError(reg, "NotGovernance");
    expect(await reg.exists(Kind.WALLET_PROVIDER, PROVIDER)).to.equal(false);
    await (await commit(f, r)).wait();
    expect(await reg.exists(Kind.WALLET_PROVIDER, PROVIDER)).to.equal(true);
    expect(await reg.isActiveRecord(Kind.WALLET_PROVIDER, PROVIDER)).to.equal(true);
    expect(await reg.recordIdsOf(Kind.WALLET_PROVIDER)).to.deep.equal([PROVIDER]);
    expect((await reg.stagedRecord(stageId)).kind).to.equal(0n); // yürütülen sabitleme silinir
    // aynı sabitleme ikinci kez yürütülemez
    const pid = await proposalId(
      await f.as(f.governance, f.trValidator).proposeNetworkRecord(await reg.getAddress(), stageId),
      f,
    );
    await (await f.as(f.governance, f.trValidator).vote(pid, true)).wait();
    await (await f.as(f.governance, f.kzValidator).vote(pid, true)).wait();
    await expect(f.governance.execute(pid)).to.be.revertedWithCustomError(reg, "UnknownStage");
  });

  it("WUA anahtarı: kayıtlı sağlayıcıya bağlı olmalı; sorgu anahtar ve sağlayıcı etkinken evet der", async () => {
    const key = rec({ kind: Kind.WALLET_PROVIDER_KEY, recordId: KEY_FP, parentId: PROVIDER, fingerprint: KEY_FP });
    await expect(commit(f, key)).to.be.revertedWithCustomError(reg, "UnknownParent").withArgs(PROVIDER);
    await (await commit(f, rec())).wait();
    await (await commit(f, key)).wait();
    expect(await reg.isListedProviderKey(KEY_FP)).to.equal(true);
    expect(await reg.isListedProviderKey(id("başka"))).to.equal(false);
    // sağlayıcı askıya alınınca anahtarı da listeli sayılmaz; geçmiş kalır
    await (await commit(f, rec({ status: St.SUSPENDED }))).wait();
    expect(await reg.isListedProviderKey(KEY_FP)).to.equal(false);
    const h = await reg.recordStatusHistoryOf(Kind.WALLET_PROVIDER, PROVIDER);
    expect(h.map((c: any) => Number(c.status))).to.deep.equal([St.ACTIVE, St.SUSPENDED]);
  });

  it("geçerlilik aralığı yarı açık; liste işletmecisi DESIGNATED / PROVISIONAL etkin sayılır", async () => {
    const t = await f.now();
    const key = id("tamga:trust-list:prod:lotl.jws");
    await (
      await commit(f, rec({ kind: Kind.LIST_OPERATOR, recordId: key, status: St.PROVISIONAL, validUntil: t + DAY }))
    ).wait();
    expect(await reg.isActiveRecord(Kind.LIST_OPERATOR, key)).to.equal(true);
    await networkHelpers.time.increaseTo(t + DAY);
    expect(await reg.isActiveRecord(Kind.LIST_OPERATOR, key)).to.equal(false);
    // RESERVED slot kaydı yazılır ama etkin değildir
    const slot = ethers.keccak256(ethers.toUtf8Bytes("tamga:slot:KZ"));
    await (
      await commit(f, rec({ kind: Kind.STATE_SLOT, recordId: slot, region: "0x4b5a", status: St.RESERVED }))
    ).wait();
    expect(await reg.isActiveRecord(Kind.STATE_SLOT, slot)).to.equal(false);
    expect(await reg.recordStatusAt(Kind.STATE_SLOT, slot, await f.now())).to.equal(St.RESERVED);
    // rol slotu yalnız var olan devlet slotuna bağlanır
    await expect(
      commit(f, rec({ kind: Kind.ROLE_SLOT, recordId: id("issuer-role"), parentId: id("yok") })),
    ).to.be.revertedWithCustomError(reg, "UnknownParent");
  });

  it("geçersiz kayıt ve 64'ten fazla özet sabitlenemez", async () => {
    await expect(reg.stageRecord(rec({ kind: Kind.NONE }))).to.be.revertedWithCustomError(reg, "InvalidRecord");
    await expect(reg.stageRecord(rec({ recordId: ZERO }))).to.be.revertedWithCustomError(reg, "InvalidRecord");
    await expect(reg.stageRecord(rec({ status: St.NONE }))).to.be.revertedWithCustomError(reg, "InvalidRecord");
    await expect(reg.stageRecord(rec({ validFrom: 10, validUntil: 10 }))).to.be.revertedWithCustomError(
      reg,
      "InvalidRecord",
    );
    const many = Array.from({ length: 65 }, (_, i) => id(`d${i}`));
    await expect(reg.stageRecord(rec({ kind: Kind.EXTERNAL_LIST, digests: many })))
      .to.be.revertedWithCustomError(reg, "TooManyDigests")
      .withArgs(65, 64);
  });

  it("göç kipinde tek göç yürütücüsü tarihli yazar; kip dışında ve başka hesap yazamaz", async () => {
    const exec = f.stranger;
    await expect(reg.connect(exec).writeRecord(rec(), 0)).to.be.revertedWithCustomError(reg, "NotMigrationWriter");
    const g = f.as(f.governance, f.trValidator);
    const pid = await proposalId(
      await g.proposeMigrationOpen(await reg.getAddress(), id("plan"), 7 * DAY, await exec.getAddress()),
      f,
    );
    await (await f.as(f.governance, f.trValidator).vote(pid, true)).wait();
    await (await f.as(f.governance, f.kzValidator).vote(pid, true)).wait();
    await (await f.governance.execute(pid)).wait();
    const past = (await f.now()) - 30 * DAY;
    await expect(reg.connect(exec).writeRecord(rec(), past))
      .to.emit(reg, "RecordWritten")
      .withArgs(Kind.WALLET_PROVIDER, PROVIDER, St.ACTIVE, past);
    await expect(reg.connect(exec).writeRecord(rec({ status: St.REVOKED }), past - 1)).to.be.revertedWithCustomError(
      reg,
      "StatusOutOfOrder",
    );
    await expect(reg.connect(f.trDelegate).writeRecord(rec(), 0)).to.be.revertedWithCustomError(
      reg,
      "NotMigrationWriter",
    );
    expect(await reg.recordStatusAt(Kind.WALLET_PROVIDER, PROVIDER, past - 1)).to.equal(St.NONE);
    expect(await reg.recordStatusAt(Kind.WALLET_PROVIDER, PROVIDER, past)).to.equal(St.ACTIVE);
  });

  it("yükseltme yalnız Governance'tan", async () => {
    const impl = await ethers.deployContract("NetworkRegistry");
    await expect(
      reg.connect(f.trValidator).upgradeToAndCall(await impl.getAddress(), "0x"),
    ).to.be.revertedWithCustomError(reg, "NotGovernance");
  });
});
