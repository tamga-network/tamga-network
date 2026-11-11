/**
 * ADR-0009 K7 / ADR-0073 K6 (CE6) / ADR-0015 K3–K5 — zincir–liste eşdeğerliği, süreç içi Hardhat zincirinde (CI'da koşar):
 *   1) birkaç sürümlük imzalı liste arşivi (apps/chain-indexer/test/fixture.ts: askı, yumuşak ve sert iptal, kök emekliliği,
 *      şema sürümü, yetki pencereleri, doğrulayıcı kapsamı, kapı grubu, geçmiş tarihli doğrulayıcı durumları, iptal sonrası yeniden
 *      kayıt, DEVİR, kurum halefi, NetworkRegistry'nin bütün kayıt türleri) doğrulanır ve planlanır;
 *   2) göç penceresi Governance oyuyla açılır (plan özetiyle), `trust:chain-replay` yürütücüsü planı kontratlara yazar;
 *      ikinci koşu hiçbir şey yazmaz, yarıda kalan koşu kaldığı yerden sürer;
 *   3) olay tabanlı indeksleyici zinciri okur → `ChainTrustSource`;
 *   4) aynı sorular `TrustSource(list)`, `TrustSource(chain)` ve doğrudan kontrat okumasına (sabitlenmiş blok) sorulur:
 *      hiçbir soruda fark YOK (ADR-0075 devrinde eski listedeki kayıt REVOKED olduğundan bilinen fark da kalmadı).
 * Zincir istemcisi (ethers) uygulamalardadır; saf TS paketlerine zincir bağımlılığı girmez (ADR-0015 K1).
 */
import { expect } from "chai";

import { addressesFrom, connectTrustContracts } from "../../apps/chain-indexer/src/contracts.js";
import { ChainIndexer } from "../../apps/chain-indexer/src/indexer.js";
import { ChainTrustSource, listLevelOf } from "../../apps/chain-indexer/src/chain-trust-source.js";
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
    // ethers'ın 250 ms istek önbelleği kapalı olmalı: aynı çağrı verisiyle art arda yazımda (dönem 0 ve yeniden kayıttan sonra
    // dönem 1 kayıt verisi) bayat gaz tahmini hızlı makinede işlemi gazsız bırakıyordu (CI 2026-11-04, işlem #62)
    expect(provider._getOption("cacheTimeout")).to.equal(-1);
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

    // Kod incelemesi 2026-11-11: olay sayımı (kontrat, olay) başına zinciri BİR KEZ tarar — sıra numaralı her işlemde baştan değil.
    // Küçük dilimle koşulur; hiçbir blok aynı (adres, olay) için iki kez istenmez ve sonuç değişmez.
    const asked = new Map<string, Array<[number, number]>>();
    const getLogs = provider.getLogs.bind(provider);
    provider.getLogs = async (filter: any) => {
      const key = `${String(filter.address).toLowerCase()}|${filter.topics?.[0]}`;
      asked.set(key, [...(asked.get(key) ?? []), [Number(filter.fromBlock), Number(filter.toBlock)]]);
      return getLogs(filter);
    };
    const CHUNK = 25;
    const r4 = await executeReplay(plan, c, s, { logChunk: CHUNK });
    provider.getLogs = getLogs;
    expect(r4.written).to.equal(0);
    expect(r4.skipped).to.equal(plan.ops.length);
    const chainHead = await provider.getBlockNumber();
    const counted = plan.ops.filter((o) => o.n !== undefined).length;
    expect(counted).to.be.greaterThan(asked.size); // aynı olayı soran birden çok işlem var
    expect(asked.size).to.be.greaterThan(0);
    let requests = 0;
    for (const [key, ranges] of asked) {
      requests += ranges.length;
      let next = 0;
      for (const [lo, hi] of ranges) {
        expect(lo, key).to.equal(next); // aralıklar ardışık: örtüşme ve yeniden tarama yok
        expect(hi - lo, key).to.be.lessThan(CHUNK);
        next = hi + 1;
      }
      expect(next - 1, key).to.equal(chainHead);
    }
    expect(requests).to.equal(asked.size * Math.ceil((chainHead + 1) / CHUNK));

    // indeksleyici + iki kaynak
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
    expect(report.differences, JSON.stringify(report.differences)).to.deep.equal([]);
    // her soru türünden en az bir soru: geçmiş an (tarihli doğrulayıcı durumu), halef, ağ düzeyi kayıtların her türü
    for (const k of [
      "relying_party",
      "rp_status_at",
      "rp_scopes",
      "terminal_group",
      "wallet_key",
      "issuer_successor",
      "zk_circuit",
      "external_list",
      "eaa_category",
      "list_signer",
      "list_operator",
      "state_slot",
      "role_slot",
      "catalogue",
    ] as const)
      expect(report.questions[k], k).to.be.greaterThan(0);
    // devredilen ad: liste ve zincir yeni sahibinde ACTIVE (eski listede REVOKED, belirsiz değil)
    expect(list.relyingPartyByDnsName(f.devirDns)?.status).to.equal("ACTIVE");
    expect(chain.relyingPartyByDnsName(f.devirDns)?.status).to.equal("ACTIVE");
    // kurum halefi zincirde
    expect(
      Object.values(indexer.index.issuers).filter((i) => i.successor && !/^0x0+$/.test(i.successor)),
    ).to.have.length(1);
    // indeks artımlıdır: yeni blok yoksa değişmez
    expect(await indexer.sync()).to.equal(block);

    // TERS GEÇİŞ (kontrol 2026-11-10): zincirde listede olmayan etkin kayıt ve farklı kayıt alanı farktır. Dizinin kopyasına
    // fazladan kurum / yetki / doğrulayıcı / iptal listesi eklenir ve bir kurumun parmak izi değiştirilir.
    const tampered = JSON.parse(JSON.stringify(indexer.index)) as typeof indexer.index;
    const some = Object.values(tampered.issuers)[0];
    const extraIssuer = "0x" + "e1".repeat(32);
    tampered.issuers[extraIssuer] = { ...some, issuerId: extraIssuer, auth: {} };
    const schemaId = Object.keys(tampered.schemas)[0];
    const unauthorized = Object.values(tampered.issuers).find((i) => i.issuerId !== extraIssuer && !i.auth[schemaId])!;
    unauthorized.auth[schemaId] = [[1, 0]];
    const someRp = Object.values(tampered.rps)[0];
    const extraRp = "0x" + "e2".repeat(32);
    tampered.rps[extraRp] = { ...someRp, rpId: extraRp, groups: [], history: [[1, 1]], status: 1 };
    const someList = Object.values(tampered.lists)[0];
    const extraList = "0x" + "e3".repeat(32);
    tampered.lists[extraList] = { ...someList, listId: extraList, listUri: "https://status.example/extra/ffff" };
    const changed = Object.values(tampered.issuers).find((i) => store.issuers.has(i.issuerId))!;
    changed.fp = "0x" + "e4".repeat(32);
    const chain2 = new ChainTrustSource(tampered, {
      now: () => f.now,
      dnsNames: [...f.dnsNames, f.devirDns],
      content: { projectedLevel: plan.planTime, listLevel: () => listLevelOf(store) },
    });
    const report2 = await compareSources(store, list, chain2, { plan });
    const of = (cat: string) => report2.differences.filter((x) => x.category === cat).map((x) => x.question);
    expect(of("chain_only").some((x) => x.startsWith("kurum 0xe1e1"))).to.equal(true);
    expect(of("chain_only").some((x) => x.startsWith("yetki "))).to.equal(true);
    expect(of("chain_only").some((x) => x.startsWith("doğrulayıcı 0xe2e2"))).to.equal(true);
    expect(of("chain_only").some((x) => x.startsWith("iptal listesi 0xe3e3"))).to.equal(true);
    expect(of("record_fields").some((x) => x.endsWith("cert_fingerprint"))).to.equal(true);
    expect(of("plan_set").sort()).to.deep.equal(["auth", "issuers", "lists", "rps"]);
    expect(report2.decisionDifferences).to.be.greaterThan(3); // göç kapanmaz (CE6)
    // içerik bağı yoksa kaynak cevap vermez: bütün kararlar UNKNOWN, ters geçiş dizini okuyamaz
    const unbound = new ChainTrustSource(indexer.index, { now: () => f.now });
    expect(unbound.isCredentialAcceptable(some.issuerId, plan.planTime)).to.equal("UNKNOWN");
    expect(unbound.indexSnapshot()).to.equal(null);
  });
});
