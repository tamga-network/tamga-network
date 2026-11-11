/**
 * GUIDE-0018 yol C — test/staging ağı kurulumu (scripts/lib/network-setup.ts, scripts/deploy-network.ts) süreç içi zincirde,
 * zincir kimliği 31339 ile:
 *   1) anahtar haritası (`tamga-chain-keys/1`, apps/chain-indexer/src/chain-keys.ts) doğrulanır; yerel kimlik (31338), yanlış amaç,
 *      başka adrese ait anahtar ve eşik > yazıcı sayısı reddedilir;
 *   2) kurulum: kurucular TR + KZ, delegeleri, kurucular arası FULL tanıma GOVERNANCE OYUYLA (ADR-0055 K3), liste çapası kaydının
 *      yöneticisi Governance kontratı (eşik değişikliği yalnız oyla), eşik 2 / iki yazıcı;
 *   3) öteki devletler (XA, XB) 2/3 oyla kabul edilir;
 *   4) yeniden oynatma imzacıları haritadan (`keyMapSigners`: delegeler, göç yürütücüsü, Governance = aktif üyelerin doğrulayıcıları)
 *      → göç penceresi oyla açılır → plan yazılır → eşdeğerlik: karar farkı yok.
 * Süreç içi zincirin hesapları Hardhat test anımsatıcısıdır; burada yalnız haritanın biçimini ve kurulum sırasını sınar (gerçek
 * test ağında anahtarlar make-network.sh --keys generate ile üretilir).
 */
import { expect } from "chai";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HDNodeWallet } from "ethers";
import { network } from "hardhat";

import { keyMapSigners, loadChainKeys } from "../../apps/chain-indexer/src/chain-keys.js";
import { addressesFrom, connectTrustContracts } from "../../apps/chain-indexer/src/contracts.js";
import { ChainIndexer } from "../../apps/chain-indexer/src/indexer.js";
import { ChainTrustSource, listLevelOf } from "../../apps/chain-indexer/src/chain-trust-source.js";
import { compareSources } from "../../apps/chain-indexer/src/equivalence.js";
import { providerFromEip1193 } from "../../apps/chain-indexer/src/local-dev.js";
import { executeReplay, openMigrationWindows } from "../../apps/chain-indexer/src/replay-exec.js";
import { buildReplayPlan } from "../../apps/chain-indexer/src/replay-plan.js";
import { listSourceFromArchive, verifyArchive } from "../../apps/chain-indexer/src/replay-archive.js";
import { buildFixture } from "../../apps/chain-indexer/test/fixture.js";
import { stateCode } from "../scripts/lib/deploy.js";
import { passGovernanceProposal, setupStagingNetwork } from "../scripts/lib/network-setup.js";

const sconn = await network.create({ override: { chainId: 31339 } });
const { ethers } = sconn;
const MNEMONIC = "test test test test test test test test test test test junk";
const hd = (i: number) => HDNodeWallet.fromPhrase(MNEMONIC, undefined, `m/44'/60'/0'/0/${i}`);

// rol → süreç içi hesap sırası
const ROLE = {
  deployer: 0,
  TR: 1,
  KZ: 2,
  XA: 3,
  XB: 4,
  trD: 5,
  kzD: 6,
  xaD: 7,
  xbD: 8,
  executor: 9,
  anc1: 10,
  anc2: 11,
};

function writeKeyMap(over: Record<string, unknown> = {}, keyOf: (i: number) => string = (i) => hd(i).privateKey) {
  const dir = mkdtempSync(join(tmpdir(), "tamga-keys-"));
  const ref = (i: number, name: string) => {
    writeFileSync(join(dir, name), keyOf(i), { mode: 0o600 });
    return { address: hd(i).address, key: name };
  };
  const state = (code: string, v: number, dl: number, node: number, founder: boolean) => ({
    code,
    founder,
    genesis_validator: true,
    node,
    validator: ref(v, `validator-${code.toLowerCase()}.key`),
    delegate: ref(dl, `delegate-${code.toLowerCase()}.key`),
  });
  const map = {
    format: "tamga-chain-keys/1",
    purpose: "test",
    chainId: 31339,
    deployer: ref(ROLE.deployer, "deployer.key"),
    migration_executor: ref(ROLE.executor, "migration-executor.key"),
    anchor: { threshold: 2, anchorers: [ref(ROLE.anc1, "anchorer-1.key"), ref(ROLE.anc2, "anchorer-2.key")] },
    states: [
      state("TR", ROLE.TR, ROLE.trD, 1, true),
      state("KZ", ROLE.KZ, ROLE.kzD, 2, true),
      state("XA", ROLE.XA, ROLE.xaD, 3, false),
      state("XB", ROLE.XB, ROLE.xbD, 4, false),
    ],
    ...over,
  };
  const file = join(dir, "keys.json");
  writeFileSync(file, JSON.stringify(map, null, 2));
  return file;
}

describe("GUIDE-0018 yol C — test/staging kurulumu (anahtar haritası, Governance, yeniden oynatma)", function () {
  this.timeout(600_000);

  it("anahtar haritası: yerel kimlik, yanlış amaç, başkasının anahtarı ve eşik > yazıcı reddedilir", () => {
    expect(() => loadChainKeys(writeKeyMap({ chainId: 31338 }))).to.throw(/yerel geliştirme/);
    expect(() => loadChainKeys(writeKeyMap({ chainId: 1 }))).to.throw(/test\/staging/);
    expect(() => loadChainKeys(writeKeyMap({ purpose: "production" }))).to.throw(/purpose/);
    expect(() => loadChainKeys(writeKeyMap({}, (i) => hd(i === ROLE.executor ? 12 : i).privateKey))).to.throw(
      /migration_executor: anahtar/,
    );
    expect(() => loadChainKeys(writeKeyMap({ anchor: { threshold: 3, anchorers: [] } }))).to.throw(/threshold/);
    expect(loadChainKeys(writeKeyMap()).map.states).to.have.length(4);
  });

  it("kurulum → kabul → harita imzacılarıyla yeniden oynatma → eşdeğerlik", async () => {
    const keys = loadChainKeys(writeKeyMap());
    const s = await ethers.getSigners();
    const chainId = Number((await ethers.provider.getNetwork()).chainId);
    expect(chainId).to.equal(31339);

    const d = await setupStagingNetwork(ethers, {
      deployer: s[ROLE.deployer],
      founders: [
        { code: "TR", validator: s[ROLE.TR], delegate: await s[ROLE.trD].getAddress() },
        { code: "KZ", validator: s[ROLE.KZ], delegate: await s[ROLE.kzD].getAddress() },
      ],
      anchorers: [await s[ROLE.anc1].getAddress(), await s[ROLE.anc2].getAddress()],
      threshold: 2,
    });
    const gov = d.trust.governance as any;
    const TR = stateCode(ethers, "TR");
    const KZ = stateCode(ethers, "KZ");
    expect(d.founderRecognition).to.equal("governance");
    expect(Number((await (d.trust.recognition as any).getPolicy(TR, KZ)).mode)).to.equal(1); // FULL
    expect(Number((await (d.trust.recognition as any).getPolicy(KZ, TR)).mode)).to.equal(1);
    expect(await gov.delegateKeysOf(TR)).to.deep.equal([await s[ROLE.trD].getAddress()]);
    const anchor = await ethers.getContractAt("TrustListAnchorRegistry", d.anchorRegistry);
    expect(await anchor.governance()).to.equal(d.trust.addresses.Governance);
    expect(Number(await anchor.requiredConfirmations())).to.equal(2);
    expect(await anchor.anchorers()).to.have.length(2);

    // öteki devletler 2/3 oyla
    const voters = [s[ROLE.TR], s[ROLE.KZ]];
    for (const [code, v, dl] of [
      ["XA", ROLE.XA, ROLE.xaD],
      ["XB", ROLE.XB, ROLE.xbD],
    ] as const) {
      const cc = stateCode(ethers, code);
      const va = await s[v].getAddress();
      await passGovernanceProposal(d.trust.governance, voters, (g) => g.proposeStateAdmission(cc, va));
      expect(await gov.isActiveMember(cc)).to.equal(true);
      await (await gov.connect(s[v]).setDelegateKeys(cc, [await s[dl].getAddress()])).wait();
      voters.push(s[v]);
    }
    expect(Number(await gov.activeMemberCount())).to.equal(4);

    // yeniden oynatma: imzacılar haritadan
    const provider = providerFromEip1193(sconn.provider as any);
    const c = connectTrustContracts(addressesFrom({ contracts: d.trust.addresses }), provider);
    const signers = await keyMapSigners(provider, keys, d.trust.addresses.Governance);
    expect(signers.governance!.voters).to.have.length(4);
    expect(await signers.executor.getAddress()).to.equal(hd(ROLE.executor).address);
    expect(await signers.state("TR").getAddress()).to.equal(hd(ROLE.trD).address);

    const now = (await provider.getBlock("latest"))!.timestamp;
    const f = await buildFixture(now);
    await verifyArchive(f.archive);
    const plan = buildReplayPlan(f.archive);
    await openMigrationWindows(c, signers.governance!, plan.hash, await signers.executor.getAddress());
    // göç penceresi açıkken yürütücü izin listesine girer (ADR-0052 K2 notu 2026-11-05): kayıtlarda okunur
    expect(String((await c.NetworkRegistry.migrationState()).executor)).to.equal(hd(ROLE.executor).address);
    const r = await executeReplay(plan, c, signers);
    expect(r.pendingGovernance).to.equal(undefined);
    expect(r.written + r.skipped).to.equal(plan.ops.length);

    const indexer = new ChainIndexer(provider, c);
    const block = await indexer.sync();
    const { store, source: list } = await listSourceFromArchive(f.archive, f.now);
    const chain = new ChainTrustSource(indexer.index, {
      now: () => f.now,
      dnsNames: [...f.dnsNames, f.devirDns],
      content: { projectedLevel: plan.planTime, listLevel: () => listLevelOf(store) },
    });
    const report = await compareSources(store, list, chain, { contracts: c, blockTag: block, plan });
    console.log(
      `      yol C eşdeğerliği: ${report.total} soru; karar farkı ${report.decisionDifferences}, beklenmeyen ${report.unexpected}; plan ${plan.ops.length} işlem`,
    );
    expect(report.decisionDifferences, JSON.stringify(report.differences)).to.equal(0);
    expect(report.unexpected, JSON.stringify(report.differences)).to.equal(0);

    // liste çapası kaydının yöneticisi Governance: eşik yalnız oyla değişir (ADR-0055 K3)
    let refused = false;
    await (anchor.connect(s[ROLE.deployer]) as any).setRequiredConfirmations(1).catch(() => (refused = true));
    expect(refused).to.equal(true);
    await passGovernanceProposal(d.trust.governance, voters, (g) => g.proposeAnchorThreshold(d.anchorRegistry, 1));
    expect(Number(await anchor.requiredConfirmations())).to.equal(1);
  });
});
