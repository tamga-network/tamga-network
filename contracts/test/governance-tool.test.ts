/**
 * `trust:chain-gov` çekirdeği (apps/trust-publisher/src/chain/governance.ts) süreç içi Hardhat zincirinde:
 *   - durum: üyeler iki adresle (düğüm + yönetişim), eşik, açık öneriler;
 *   - öneri → oy → yürütme (kabul), anahtar değişikliği ve üyenin kendi oyu şartı (ADR-0086 KG4) — kontrat reddi gönderimden önce
 *     `staticCall` ile görünür;
 *   - yükseltme kuyruğu: eşik dolunca kuyruğa alınır, bekleme süresi bitene kadar "waiting-delay", sonra "ready" (ADR-0055 GE1);
 *   - yeniden oy: anahtar değişikliğinden sonra açık önerilerde sayılmayan son oy aynı yönde yeniden verilir; sayılan oy "counted";
 *   - kuru çalıştırma (`dryRun`) işlem göndermez.
 */
import { expect } from "chai";

import {
  governanceContract,
  proposal,
  proposalCall,
  reasonHash,
  revertReason,
  revote,
  send,
  status,
  walletGovernanceSigner,
} from "../../apps/trust-publisher/src/chain/governance.js";
import { AZ, DAY, KZ, TR, ethers, loadFixture, networkHelpers, nodeOf, type Fixture } from "./helpers/fixture.js";

describe("trust:chain-gov — yönetişim komut aracının çekirdeği", function () {
  let f: Fixture;
  let gov: any;
  const p = () => ethers.provider as any;
  const as = (cc: string, s: any) => walletGovernanceSigner("local-dev", cc, s);
  const resolve = (v: string) => (f.addresses as Record<string, string>)[v] ?? v;

  beforeEach(async () => {
    f = await loadFixture();
    gov = governanceContract(f.addresses.Governance, p());
  });

  it("durum: üyeler iki adresle, eşik ve boş öneri listesi", async () => {
    const st = await status(gov, p());
    expect(st.activeMembers).to.equal(3);
    expect(st.requiredVotes).to.equal(2);
    const tr = st.members.find((m) => m.state === "TR")!;
    expect(tr.status).to.equal("ACTIVE");
    expect(tr.node).to.equal(f.trNode);
    expect(tr.governance).to.equal(await f.trGov.getAddress());
    expect(st.proposals).to.deep.equal([]);
  });

  it("öneri → oy → yürütme: yeni üye kabulü; sayılan oy ve hazır olma durumu", async () => {
    const fresh = await (await ethers.getSigners())[12].getAddress();
    const c = proposalCall("admit", { state: "UZ", node: nodeOf(fresh), governance: fresh }, resolve);
    const r = await send(gov, as("TR", f.trGov), p(), c.fn, c.args);
    expect(r.sent).to.equal(true);
    const pid = r.proposalId!;
    let v = await proposal(gov, pid, (await p().getBlock("latest")).timestamp);
    expect(v.kind).to.equal("STATE_ADMISSION");
    expect(v.state).to.equal("UZ");
    expect(v.governance).to.equal(fresh);
    expect(v.readiness).to.equal("below-threshold");
    await send(gov, as("TR", f.trGov), p(), "vote", [pid, true]);
    await send(gov, as("KZ", f.kzGov), p(), "vote", [pid, true]);
    v = await proposal(gov, pid, (await p().getBlock("latest")).timestamp);
    expect(v.counted).to.equal(2);
    expect(v.readiness).to.equal("ready");
    expect((await status(gov, p())).proposals.map((x) => x.id)).to.deep.equal([pid]);
    await send(gov, as("AZ", f.azGov), p(), "execute", [pid]);
    const st = await status(gov, p(), { all: true });
    expect(st.activeMembers).to.equal(4);
    expect(st.proposals.find((x) => x.id === pid)!.status).to.equal("EXECUTED");
    expect((await status(gov, p())).proposals).to.deep.equal([]); // yalnız açıklar
  });

  it("kuru çalıştırma göndermez; kontrat reddi gönderimden önce görünür (KeyChangeNeedsOwnVote)", async () => {
    const newKey = await (await ethers.getSigners())[12].getAddress();
    const c = proposalCall("key-change", { state: "TR", governance: newKey }, resolve);
    const before = await p().getBlockNumber();
    const dry = await send(gov, as("KZ", f.kzGov), p(), c.fn, c.args, { dryRun: true });
    expect(dry.sent).to.equal(false);
    expect(dry.data).to.match(/^0x/);
    expect(await p().getBlockNumber()).to.equal(before);
    const pid = (await send(gov, as("KZ", f.kzGov), p(), c.fn, c.args)).proposalId!;
    await send(gov, as("KZ", f.kzGov), p(), "vote", [pid, true]);
    await send(gov, as("AZ", f.azGov), p(), "vote", [pid, true]);
    let reason = "";
    try {
      await send(gov, as("KZ", f.kzGov), p(), "execute", [pid]);
    } catch (e) {
      reason = revertReason(gov, e);
    }
    expect(reason).to.match(/^KeyChangeNeedsOwnVote/);
    expect((await gov.getMember(TR)).governanceAddress).to.equal(await f.trGov.getAddress());
  });

  it("yeniden oy: anahtar değişikliğinden sonra sayılmayan son oy yeni anahtarla aynı yönde verilir", async () => {
    const signers = await ethers.getSigners();
    const newKey = signers[12];
    // açık öneri: AZ çıkarma — TR ve KZ "evet"
    const rm = proposalCall("remove", { state: "AZ", reason: "sınama gerekçesi" }, resolve);
    expect(rm.args[1]).to.equal(reasonHash("sınama gerekçesi"));
    const open = (await send(gov, as("KZ", f.kzGov), p(), rm.fn, rm.args)).proposalId!;
    await send(gov, as("TR", f.trGov), p(), "vote", [open, true]);
    await send(gov, as("KZ", f.kzGov), p(), "vote", [open, true]);
    // TR anahtarını değiştir (TR'nin kendi oyu dahil üç oy)
    const kc = proposalCall("key-change", { state: "TR", governance: await newKey.getAddress() }, resolve);
    const ch = (await send(gov, as("TR", f.trGov), p(), kc.fn, kc.args)).proposalId!;
    for (const [cc, s] of [
      ["TR", f.trGov],
      ["KZ", f.kzGov],
      ["AZ", f.azGov],
    ] as const)
      await send(gov, as(cc, s), p(), "vote", [ch, true]);
    await send(gov, as("TR", f.trGov), p(), "execute", [ch]);
    expect(Number(await gov.countedForVotes(open))).to.equal(1);
    // kuru çalıştırma: ne yapacağını söyler, göndermez
    const dry = await revote(gov, as("TR", newKey), p(), { dryRun: true });
    expect(dry.state).to.equal("TR");
    expect(dry.results).to.deep.equal([{ id: open, support: true, action: "would-revote" }]);
    expect(Number(await gov.countedForVotes(open))).to.equal(1);
    const r = await revote(gov, as("TR", newKey), p());
    expect(r.results.map((x) => x.action)).to.deep.equal(["revoted"]);
    expect(Number(await gov.countedForVotes(open))).to.equal(2);
    // KZ'nin oyu zaten sayılıyor
    const kz = await revote(gov, as("KZ", f.kzGov), p());
    expect(kz.results).to.deep.equal([{ id: open, support: true, action: "counted" }]);
    // eski anahtar artık etkin üyenin anahtarı değil
    let err = "";
    try {
      await revote(gov, as("TR", f.trGov), p());
    } catch (e) {
      err = (e as Error).message;
    }
    expect(err).to.match(/NotGovernor/);
  });

  it("yükseltme kuyruğu: eşik dolunca kuyruk, bekleme bitene kadar waiting-delay, sonra uygulanır", async () => {
    const impl = await ethers.deployContract("IssuerRegistry");
    const c = proposalCall("upgrade", { target: "IssuerRegistry", impl: await impl.getAddress() }, resolve);
    expect(c.fn).to.equal("proposeProtocolUpgrade");
    const pid = (await send(gov, as("TR", f.trGov), p(), c.fn, c.args)).proposalId!;
    await send(gov, as("TR", f.trGov), p(), "vote", [pid, true]);
    await send(gov, as("KZ", f.kzGov), p(), "vote", [pid, true]);
    let v = await proposal(gov, pid, (await p().getBlock("latest")).timestamp);
    expect(v.readiness).to.equal("queue");
    await send(gov, as("TR", f.trGov), p(), "execute", [pid]); // kuyruğa alır
    const st = await status(gov, p());
    expect(st.upgradeQueue).to.have.length(1);
    expect(st.upgradeQueue[0].readiness).to.equal("waiting-delay");
    expect(st.upgradeQueue[0].target).to.equal(f.addresses.IssuerRegistry);
    await networkHelpers.time.increase(7 * DAY + 1);
    v = await proposal(gov, pid, (await p().getBlock("latest")).timestamp);
    expect(v.readiness).to.equal("ready");
    await send(gov, as("KZ", f.kzGov), p(), "execute", [pid]);
    v = await proposal(gov, pid, (await p().getBlock("latest")).timestamp);
    expect(v.status).to.equal("EXECUTED");
  });

  it("düğüm adresi ve delege anahtarı: yönetişim anahtarıyla, oy yok", async () => {
    const newNode = nodeOf(await (await ethers.getSigners())[13].getAddress());
    await send(gov, as("TR", f.trGov), p(), "setValidatorAddress", [TR, newNode]);
    expect((await gov.getMember(TR)).validatorAddress).to.equal(newNode);
    await send(gov, as("KZ", f.kzGov), p(), "setDelegateKeys", [KZ, []]);
    expect(await gov.delegateKeysOf(KZ)).to.deep.equal([]);
    expect(Number(await gov.activeMemberCount())).to.equal(3);
    void AZ;
  });
});
