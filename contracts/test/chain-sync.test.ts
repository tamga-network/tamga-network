/**
 * ADR-0085 (sürekli projeksiyon) / ADR-0084 (liste kaynak, zincir tanık) — eşdeğerlik testinin SÜREKLİ hâli, süreç içi Hardhat
 * zincirinde (CI'da koşar):
 *   1) liste arşivi göç penceresinde yeniden oynatılır (ADR-0073), pencere Governance oyuyla kapanır;
 *   2) yeni imzalı liste sürümleri yayımlanır — kurum ekleme, askı, iptal, aynı koşuda askı + dönüş (birleştirme), cüzdan
 *      sağlayıcı anahtar değişimi (ağ düzeyi kayıt, Governance oyu), doğrulayıcı erişim sertifikası yenilemesi, iptal listesinin yeni
 *      sürümü, ileri tarihli yetki bitişi (zamanı gelince yazılır);
 *   3) her yayından sonra `planChainSync(önceki, şimdiki)` farkı çıkarır, `executeChainSync` blok anıyla yazar;
 *   4) her adımda aynı sorular imzalı listeye, indeksleyiciye (`ChainTrustSource`) ve doğrudan kontrata sorulur: projeksiyon
 *      gecikmesi aralığı (liste tarihi → zincir tarihi, SP2) ve henüz gelmemiş anlar dışında hiçbir soruda fark yok;
 *   5) aynı farkın yeniden yürütülmesi hiçbir şey yazmaz; değişiklik yokken plan boştur.
 * Gerçek ağa yazma yolu yoktur (SP7); bu test yalnız yerel zincirde.
 */
import { expect } from "chai";
import { computeIdFromFingerprintHex, sha256Tag, utf8 } from "@tamga-network/trust";
import { createHash } from "node:crypto";

import { addressesFrom, connectTrustContracts, MIGRATING_REGISTRIES } from "../../apps/chain-indexer/src/contracts.js";
import { ChainIndexer } from "../../apps/chain-indexer/src/indexer.js";
import { ChainTrustSource, listLevelOf } from "../../apps/chain-indexer/src/chain-trust-source.js";
import { compareSources } from "../../apps/chain-indexer/src/equivalence.js";
import { providerFromEip1193 } from "../../apps/chain-indexer/src/local-dev.js";
import { executeReplay, openMigrationWindows, passProposal } from "../../apps/chain-indexer/src/replay-exec.js";
import { buildReplayPlan } from "../../apps/chain-indexer/src/replay-plan.js";
import { listSourceFromArchive, verifyArchive } from "../../apps/chain-indexer/src/replay-archive.js";
import { executeChainSync, syncProblems } from "../../apps/chain-indexer/src/sync-exec.js";
import { buildFixture } from "../../apps/chain-indexer/test/fixture.js";
import {
  planChainSync,
  sliceArchive,
  syncPointOf,
  type SyncPoint,
} from "../../apps/trust-publisher/src/chain/sync-plan.js";
import { SYNC_LAG_ALARM_SEC } from "../../apps/trust-publisher/src/chain/sync-cli.js";
import { deployTrustLayer, stateCode } from "../scripts/lib/deploy.js";
import { conn, ethers, nodeOf } from "./helpers/fixture.js";

type Obj = Record<string, any>;
const iso = (s: number) => new Date(s * 1000).toISOString();
const fp = (label: string) => createHash("sha256").update(label).digest("hex");
const payload = (jws: string): Obj => JSON.parse(Buffer.from(jws.split(".")[1], "base64url").toString("utf8"));

describe("ADR-0085 — sürekli projeksiyon: her liste yayınından sonra liste = zincir", function () {
  this.timeout(600_000);

  it("göçten sonra ekleme, askı, iptal, anahtar değişimi ve ileri tarihli iş zincire yansır; sorular aynı cevabı verir", async () => {
    const [deployer, trV, kzV, azV, trD, kzD, executor] = await ethers.getSigners();
    const d = await deployTrustLayer(
      ethers,
      deployer,
      [
        { code: "TR", validator: nodeOf(await trV.getAddress()), governance: await trV.getAddress() },
        { code: "KZ", validator: nodeOf(await kzV.getAddress()), governance: await kzV.getAddress() },
        { code: "AZ", validator: nodeOf(await azV.getAddress()), governance: await azV.getAddress() },
      ],
      trV,
    );
    await (
      await (d.governance.connect(trV) as any).setDelegateKeys(stateCode(ethers, "TR"), [await trD.getAddress()])
    ).wait();
    await (
      await (d.governance.connect(kzV) as any).setDelegateKeys(stateCode(ethers, "KZ"), [await kzD.getAddress()])
    ).wait();
    const provider = providerFromEip1193(conn.provider as any);
    const c = connectTrustContracts(addressesFrom({ contracts: d.addresses }), provider);
    const signer = (a: { getAddress(): Promise<string> }) => a.getAddress().then((x) => provider.getSigner(x));
    const states = new Map<string, any>([
      ["TR", await signer(trD)],
      ["KZ", await signer(kzD)],
    ]);
    const s = {
      state: (cc: string) => states.get(cc),
      executor: await signer(executor),
      governance: { proposer: await signer(trV), voters: [await signer(trV), await signer(kzV)] },
    };
    const head = async () => (await provider.getBlock("latest"))!.timestamp;

    // --- 1) göç: arşiv yeniden oynatılır, pencere kapanır
    const f = await buildFixture(await head());
    await verifyArchive(f.archive);
    const replay = buildReplayPlan(f.archive);
    await openMigrationWindows(c, s.governance, replay.hash, await s.executor.getAddress());
    expect((await syncProblems(c)).length).to.be.greaterThan(0); // pencere açıkken sürekli projeksiyon yazmaz
    const r0 = await executeReplay(replay, c, s);
    expect(r0.written).to.equal(replay.ops.length);
    for (const name of MIGRATING_REGISTRIES) {
      const reg = await c[name].getAddress();
      await passProposal(c, s.governance, (g) => g.proposeMigrationClose(reg));
    }
    expect(await syncProblems(c)).to.deep.equal([]);

    // --- yayıncı: arşivin kopyası üzerinde yeni imzalı sürümler
    const arch = { ...f.archive, lotl: [...f.archive.lotl], national: { ...f.archive.national } };
    for (const k of Object.keys(arch.national)) arch.national[k] = [...arch.national[k]];
    const publish = async (file: string, T: number, mutate: (b: Obj) => void) => {
      const list = file === "lotl" ? arch.lotl : arch.national[file];
      const prev = list.at(-1)!;
      const b = payload(prev);
      mutate(b);
      b.version += 1;
      b.issued_at = iso(T);
      b.previous_version_hash = sha256Tag(utf8(prev));
      list.push(await f.sign(b));
    };
    const addAnchor = async (body: Obj, T: number) => {
      const lines = arch.anchorsJsonl.trim().split("\n");
      const prev = lines.at(-1)!;
      lines.push(
        await f.sign({ seq: payload(prev).seq + 1, previous_hash: sha256Tag(utf8(prev)), ts: iso(T), ...body }),
      );
      arch.anchorsJsonl = lines.join("\n") + "\n";
    };
    const issuerOf = (b: Obj, slug: string) => b.issuers.find((i: Obj) => i.slug === slug);
    const setStatus = (rec: Obj, status: string, T: number, reason?: string) => {
      rec.status = status;
      rec.status_history.push({ status, since: iso(T), ...(reason ? { reason } : {}) });
    };

    // --- projeksiyon + sürekli eşdeğerlik
    let point: SyncPoint = syncPointOf(f.archive, replay.planTime);
    const lag: Array<[number, number]> = [];
    const indexer = new ChainIndexer(provider, c);
    const sync = async () => {
      // koşu yayından sonradır: zincir saati yayın anını geçmiş olmalı (yayın anı = son blok + 1)
      await conn.provider.request({ method: "evm_mine", params: [] });
      const T = await head();
      const plan = planChainSync(
        { archive: sliceArchive(arch, point), planTime: point.planTime },
        { archive: arch, planTime: T },
      );
      const report = await executeChainSync(plan.ops, c, s);
      expect(report.complete, JSON.stringify(report)).to.equal(true);
      lag.push(...report.lagWindows);
      expect(report.maxLagSec).to.be.lessThan(SYNC_LAG_ALARM_SEC); // SP2: gecikme alarm sınırının altında
      // aynı fark yeniden: hiçbir şey yazılmaz (kaldığı yerden sürme, SP5)
      const rewritten: string[] = [];
      const again = await executeChainSync(plan.ops, c, s, {
        onProgress: (o, x) => x === "written" && rewritten.push(`${o.op} ${JSON.stringify(o)}`),
      });
      expect(again.written, rewritten.join("\n")).to.equal(0);
      expect(again.skipped).to.equal(plan.ops.length);
      point = plan.to;
      return { plan, report };
    };
    const check = async (what: string) => {
      const block = await indexer.sync();
      const nowSec = (await head()) + 1;
      const now = new Date(nowSec * 1000);
      const { store, source: list } = await listSourceFromArchive(arch, now);
      const chain = new ChainTrustSource(indexer.index, {
        now: () => now,
        dnsNames: [...f.dnsNames, f.devirDns],
        content: { projectedLevel: listLevelOf(store)!, listLevel: () => listLevelOf(store) },
      });
      // henüz gelmemiş anlar sorulmaz: belge `iat`'ı geçmiştir; ileri tarihli kayıt zamanı gelince yazılır (SP3)
      const report = await compareSources(store, list, chain, {
        contracts: c,
        blockTag: block,
        lagWindows: [...lag, [nowSec, Number.MAX_SAFE_INTEGER]],
      });
      console.log(
        `      ${what}: ${report.total} soru; fark ${report.differences.length} (karar ${report.decisionDifferences}); ` +
          `gecikme aralığında sorulmayan ${report.lagSkipped}`,
      );
      expect(report.decisionDifferences, JSON.stringify(report.differences)).to.equal(0);
      expect(report.differences, JSON.stringify(report.differences)).to.deep.equal([]);
      for (const k of ["C1", "C2", "C3"] as const) expect(report.answers[k].YES, k).to.be.greaterThan(0);
      return { report, store };
    };
    await check("göçten sonra");

    // --- 2) kurum ekleme (TR) + ileri tarihli yetki bitişi + iptal listesinin yeni sürümü
    const T1 = (await head()) + 1;
    const NEW = { slug: "inst-five", fp: fp("issuer-inst-five") };
    const newId = computeIdFromFingerprintHex("TR", NEW.fp);
    const until = T1 + 120;
    await publish("tl-tr", T1, (b) => {
      const base = issuerOf(b, "uni-one");
      const diploma = base.schema_authorizations[0].schema_id;
      b.issuers.push({
        ...JSON.parse(JSON.stringify(base)),
        issuer_id: newId,
        slug: NEW.slug,
        legal_name: "Example inst-five",
        cert_fingerprint_sha256: NEW.fp,
        issuer_url: `https://issuer.example/${NEW.slug}`,
        status_list_base: `https://status.example/${NEW.slug}/`,
        status: "ACTIVE",
        valid_from: iso(T1),
        successor_id: null,
        status_history: [{ status: "ACTIVE", since: iso(T1) }],
        schema_authorizations: [{ schema_id: diploma, allowed: true, valid_from: iso(T1), valid_until: iso(until) }],
        is_public_sector_body: false,
      });
    });
    const u1 = issuerOf(payload(arch.national["tl-tr"].at(-1)!), "uni-one");
    await addAnchor(
      {
        kind: "status_list",
        list_id: "0x" + "a1f0".padStart(64, "0"),
        issuer_id: u1.issuer_id,
        list_uri: "https://status.example/uni-one/a1f0",
        content_hash: sha256Tag(utf8("uni-one-a1f0-v4")),
        list_version: 4,
        published_at: iso(T1),
        bits: 2,
        size: 131_072,
      },
      T1,
    );
    const a = await sync();
    expect(a.plan.summary.registerIssuer).to.equal(1);
    expect(a.plan.summary.publishList).to.equal(1);
    expect(a.plan.summary.schemaAuth).to.equal(1); // yalnız açılış: bitiş ileri tarihli (bekleyen iş)
    expect(a.plan.warnings.some((w) => w.includes("ileri tarih"))).to.equal(true);
    expect(Number((await c.IssuerRegistry.getIssuer(newId)).status)).to.equal(1);
    await check("kurum ekleme");

    // --- 3) askı: yeni kurum ve academy-four
    const T2 = (await head()) + 1;
    await publish("tl-tr", T2, (b) => {
      setStatus(issuerOf(b, NEW.slug), "SUSPENDED", T2, "audit");
      setStatus(issuerOf(b, "academy-four"), "SUSPENDED", T2, "audit");
    });
    const b2 = await sync();
    expect(b2.plan.summary.issuerStatus).to.equal(2);
    expect(Number((await c.IssuerRegistry.getIssuer(newId)).status)).to.equal(2);
    await check("askı");

    // --- 4) iptal (academy-four), askıdan dönüş (yeni kurum); KZ'de aynı koşuda askı + dönüş → yazılmaz (SP3)
    const T3 = (await head()) + 1;
    await publish("tl-tr", T3, (b) => {
      setStatus(issuerOf(b, "academy-four"), "REVOKED", T3, "registration ended");
      setStatus(issuerOf(b, NEW.slug), "ACTIVE", T3);
    });
    await publish("tl-kz", T3, (b) => {
      const k = issuerOf(b, "kz-uni");
      setStatus(k, "SUSPENDED", T3 - 1, "check");
      setStatus(k, "ACTIVE", T3);
    });
    const b3 = await sync();
    expect(b3.plan.collapsed).to.be.greaterThan(0);
    expect(b3.report.skipped).to.be.greaterThan(0); // kz-uni zaten ACTIVE: askı + dönüş zincire gitmez
    expect(Number((await c.IssuerRegistry.getIssuer(newId)).status)).to.equal(1);
    await check("iptal + birleştirme");

    // --- 5) anahtar değişimi: cüzdan sağlayıcı WUA anahtarı (ağ düzeyi, Governance oyu) + doğrulayıcı erişim sertifikası
    const T4 = (await head()) + 1;
    const WK3 = fp("wua-key-3");
    await publish("lotl", T4, (b) => {
      const wp = b.wallet_providers[0];
      for (const k of wp.wua_signing_keys) if (k.status === "ACTIVE") k.status = "REVOKED";
      wp.wua_signing_keys.push({ fingerprint_sha256: WK3, status: "ACTIVE", valid_from: iso(T4) });
    });
    const newCert = fp("access-verify-3");
    await publish("tl-tr", T4, (b) => {
      const rp = b.relying_parties.find((r: Obj) => r.dns_name === "verify.example.tr");
      rp.access_cert_fingerprint_sha256 = newCert;
      rp.client_id = `x509_hash:${Buffer.from(newCert, "hex").toString("base64url")}`;
    });
    const b4 = await sync();
    expect(b4.plan.summary.networkRecord).to.be.greaterThan(0);
    expect(b4.plan.summary.rpCert).to.equal(1);
    const { store } = await check("anahtar değişimi");
    expect(store.lotl.wallet_providers[0].wua_signing_keys.some((k) => k.fingerprint_sha256 === WK3)).to.equal(true);

    // --- 6) bekleyen iş: yetki bitişinin zamanı gelir; yeni liste sürümü olmadan (saatlik koşu) yazılır
    await conn.provider.request({ method: "evm_increaseTime", params: [180] });
    await conn.provider.request({ method: "evm_mine", params: [] });
    const b5 = await sync();
    const close = b5.plan.ops[0];
    expect(b5.plan.ops).to.have.length(1);
    expect(close.op === "schemaAuth" && !close.allowed).to.equal(true);
    if (close.op === "schemaAuth")
      expect((await c.IssuerRegistry.schemaAuthOf(newId, close.schemaId)).allowed).to.equal(false);
    await check("ileri tarihli iş");

    // --- 7) değişiklik yok: plan boş
    const b6 = await sync();
    expect(b6.plan.ops).to.deep.equal([]);
    expect(b6.report.written).to.equal(0);
  });
});
