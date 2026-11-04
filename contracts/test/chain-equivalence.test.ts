/**
 * ADR-0009 K7 / ADR-0073 K6 (CE6) / ADR-0015 K3–K5 — zincir–liste eşdeğerliği, süreç içi Hardhat zincirinde (CI'da koşar):
 *   1) birkaç sürümlük imzalı liste arşivi (apps/chain-indexer/test/fixture.ts: askı, yumuşak ve sert iptal, kök emekliliği,
 *      şema sürümü, yetki pencereleri, doğrulayıcı kapsamı, kapı grubu, iptal sonrası yeniden kayıt, DEVİR) doğrulanır ve planlanır;
 *   2) göç penceresi Governance oyuyla açılır (plan özetiyle), `trust:chain-replay` yürütücüsü planı kontratlara yazar;
 *      ikinci koşu hiçbir şey yazmaz, yarıda kalan koşu kaldığı yerden sürer;
 *   3) olay tabanlı indeksleyici zinciri okur → `ChainTrustSource`;
 *   4) aynı sorular `TrustSource(list)`, `TrustSource(chain)` ve doğrudan kontrat okumasına (sabitlenmiş blok) sorulur:
 *      C1/C2/C3/D5'te fark YOK; öteki farklar yalnız belgelenmiş bilinen farklar (ADR-0075 devir).
 * Zincir istemcisi (ethers) uygulamalardadır; saf TS paketlerine zincir bağımlılığı girmez (ADR-0015 K1).
 */
import { expect } from "chai";

import { addressesFrom, connectTrustContracts } from "../../apps/chain-indexer/src/contracts.js";
import { ChainIndexer } from "../../apps/chain-indexer/src/indexer.js";
import { ChainTrustSource } from "../../apps/chain-indexer/src/chain-trust-source.js";
import { compareSources } from "../../apps/chain-indexer/src/equivalence.js";
import { providerFromEip1193 } from "../../apps/chain-indexer/src/local-dev.js";
import { executeReplay, openMigrationWindows } from "../../apps/chain-indexer/src/replay-exec.js";
import { buildReplayPlan } from "../../apps/chain-indexer/src/replay-plan.js";
import { listSourceFromArchive, verifyArchive } from "../../apps/chain-indexer/src/replay-archive.js";
import { buildFixture } from "../../apps/chain-indexer/test/fixture.js";
import { deployTrustLayer, stateCode } from "../scripts/lib/deploy.js";
import { conn, ethers } from "./helpers/fixture.js";

describe("ADR-0073 K6 — zincir–liste eşdeğerliği (yeniden oynatma + indeksleyici)", function () {
  this.timeout(600_000);

  it("arşiv yeniden oynatılır; C1/C2/C3/D5'te liste, indeks ve kontrat aynı cevabı verir", async () => {
    const [deployer, trV, kzV, azV, trD, kzD, executor] = await ethers.getSigners();
    const d = await deployTrustLayer(
      ethers,
      deployer,
      [
        { code: "TR", validator: await trV.getAddress() },
        { code: "KZ", validator: await kzV.getAddress() },
        { code: "AZ", validator: await azV.getAddress() },
      ],
      trV,
    );
    await (
      await (d.governance.connect(trV) as any).setDelegateKeys(stateCode(ethers, "TR"), [await trD.getAddress()])
    ).wait();
    await (
      await (d.governance.connect(kzV) as any).setDelegateKeys(stateCode(ethers, "KZ"), [await kzD.getAddress()])
    ).wait();

    // uygulamaların ethers'ı ile aynı sağlayıcı (süreç içi zincirin EIP-1193 arayüzü)
    const provider = providerFromEip1193(conn.provider as any);
    const c = connectTrustContracts(addressesFrom({ contracts: d.addresses }), provider);
    const signer = (a: { getAddress(): Promise<string> }) => a.getAddress().then((x) => provider.getSigner(x));
    const s = {
      state: (() => {
        const m = new Map<string, any>();
        return Object.assign((cc: string) => m.get(cc), { m });
      })(),
      executor: await signer(executor),
      governance: { proposer: await signer(trV), voters: [await signer(trV), await signer(kzV)] },
    };
    s.state.m.set("TR", await signer(trD));
    s.state.m.set("KZ", await signer(kzD));

    const now = (await provider.getBlock("latest"))!.timestamp;
    const f = await buildFixture(now);
    await verifyArchive(f.archive);
    const plan = buildReplayPlan(f.archive);

    // pencere açılmadan yazım yok (CE1)
    let refused = false;
    await executeReplay(plan, c, s).catch(() => (refused = true));
    expect(refused).to.equal(true);
    await openMigrationWindows(c, s.governance, plan.hash, await s.executor.getAddress());

    // yarıda kalan koşu: ilk üçte bir, sonra tamamı → kalan yazılır; üçüncü koşu hiçbir şey yazmaz
    const third = Math.floor(plan.ops.length / 3);
    const r1 = await executeReplay({ ...plan, ops: plan.ops.slice(0, third) }, c, s);
    expect(r1.written).to.equal(third);
    const r2 = await executeReplay(plan, c, s);
    expect(r2.pendingGovernance).to.equal(undefined);
    expect(r2.skipped).to.equal(third);
    expect(r2.written).to.equal(plan.ops.length - third);
    const r3 = await executeReplay(plan, c, s);
    expect(r3.written).to.equal(0);

    // indeksleyici + iki kaynak
    const indexer = new ChainIndexer(provider, c);
    const block = await indexer.sync();
    const chain = new ChainTrustSource(indexer.index, { now: () => f.now, dnsNames: [...f.dnsNames, f.devirDns] });
    const { store, source: list } = await listSourceFromArchive(f.archive, f.now);
    const report = await compareSources(store, list, chain, { contracts: c, blockTag: block });

    console.log(
      `      eşdeğerlik: ${report.total} soru ${JSON.stringify(report.questions)}; fark ${report.differences.length} ` +
        `(karar farkı ${report.decisionDifferences}, beklenmeyen ${report.unexpected}); plan ${plan.ops.length} işlem`,
    );
    for (const x of report.differences) console.log(`      fark ${x.category} ${x.question}: ${JSON.stringify(x)}`);
    expect(report.questions.C1).to.be.greaterThan(50);
    // sorular iki yönlü: kabul ve ret cevapları birlikte (sınır anları yarı açık aralıkların iki yanını yoklar)
    for (const k of ["C1", "C2", "C3"] as const) {
      expect(report.answers[k].YES, k).to.be.greaterThan(0);
      expect(report.answers[k].NO, k).to.be.greaterThan(0);
    }
    expect(report.decisionDifferences, JSON.stringify(report.differences)).to.equal(0);
    expect(report.unexpected, JSON.stringify(report.differences)).to.equal(0);
    // bilinen fark (ADR-0075 sonucu): devirden sonra eski ülke listesindeki kayıt kapanmadığı için liste belirsiz sayar
    expect(report.differences.map((x) => `${x.category}:${x.question}`)).to.deep.equal([`relying_party:${f.devirDns}`]);
    // indeks artımlıdır: yeni blok yoksa değişmez
    expect(await indexer.sync()).to.equal(block);
  });
});
