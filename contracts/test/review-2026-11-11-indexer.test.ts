/**
 * Kod incelemesi 2026-11-11 — indeksleyici bulguları, süreç içi Hardhat zincirinde:
 *   - X1 : `errors` alanı olmayan (eski biçim) dizin sürdürülebilir (eski hâl: "retry is not iterable");
 *   - X2 : yeni blok yokken de bekleyen hatalar yeniden denenir.
 */
import { expect } from "chai";

import { addressesFrom, connectTrustContracts } from "../../apps/chain-indexer/src/contracts.js";
import { ChainIndexer, type ChainIndex } from "../../apps/chain-indexer/src/indexer.js";
import { providerFromEip1193 } from "../../apps/chain-indexer/src/local-dev.js";
import { TR, conn, id, loadFixture, type Fixture } from "./helpers/fixture.js";

describe("Kod incelemesi 2026-11-11 — indeksleyici bulguları", function () {
  this.timeout(120_000);

  describe("eski biçim dizin ve bekleyen hatalar", () => {
    const rp = (rpId: string, cert: string) => ({
      rpId,
      stateCode: TR,
      nameHash: id("Example Verifier"),
      accessCertFingerprint: id(cert),
      status: 1,
      registeredAt: 0,
    });
    const parts = (f: Fixture) => {
      const provider = providerFromEip1193(conn.provider as any);
      return { provider, c: connectTrustContracts(addressesFrom({ contracts: f.addresses }), provider) };
    };
    const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

    it("X1: `errors` alanı olmayan (eski biçim) dizin sürdürülür; okunamayan kayıt yine `errors`'a yazılır", async () => {
      const f = await loadFixture();
      const { provider, c } = parts(f);
      const first = new ChainIndexer(provider, c);
      await first.sync();
      const old = clone(first.toJSON()) as Partial<ChainIndex>;
      delete old.errors; // eski `toJSON` çıktısı
      const RPID = id("verify.example.tr");
      await (await f.as(f.relyingParties, f.trDelegate).registerRelyingParty(rp(RPID, "CERT-1"))).wait();

      const resumed = new ChainIndexer(provider, c, clone(old) as ChainIndex);
      const head = await provider.getBlockNumber();
      expect(await resumed.sync()).to.equal(head);
      expect(resumed.index.errors).to.deep.equal([]);
      expect(resumed.index.rps[RPID].status).to.equal(1);

      // aynı eski dizin, okuması geri dönen kayıtla: hata yolu da eksik alanla çalışır
      const faulty = new Proxy(c.RelyingPartyRegistry, {
        get(t, k, r) {
          if (k === "getRelyingParty") return (_: string, o: unknown) => t.getRelyingParty(id("yok"), o);
          return Reflect.get(t, k, r);
        },
      });
      const broken = new ChainIndexer(provider, { ...c, RelyingPartyRegistry: faulty }, clone(old) as ChainIndex);
      expect(await broken.sync()).to.equal(head);
      expect(broken.index.errors).to.have.length(1);
      expect(broken.index.errors[0]).to.include({ set: "rps", id: RPID });
    });

    it("X2: yeni blok olmasa da bekleyen hatalar yeniden denenir (dizinin kendi bloğunda)", async () => {
      const f = await loadFixture();
      const { provider, c } = parts(f);
      const RPID = id("verify.example.tr");
      await (await f.as(f.relyingParties, f.trDelegate).registerRelyingParty(rp(RPID, "CERT-1"))).wait();
      let failing = true;
      const tags: unknown[] = [];
      const faulty = new Proxy(c.RelyingPartyRegistry, {
        get(t, k, r) {
          if (k === "getRelyingParty")
            return (x: string, o: { blockTag: number }) => {
              tags.push(o.blockTag);
              return t.getRelyingParty(failing ? id("yok") : x, o);
            };
          return Reflect.get(t, k, r);
        },
      });
      const ix = new ChainIndexer(provider, { ...c, RelyingPartyRegistry: faulty });
      const head = await ix.sync();
      expect(ix.index.errors).to.have.length(1);
      expect(ix.index.rps[RPID]).to.equal(undefined);

      // geçici okuma hatası düzeldi; zincirde yeni blok YOK
      failing = false;
      expect(await provider.getBlockNumber()).to.equal(head);
      expect(await ix.sync()).to.equal(head);
      expect(ix.index.errors).to.deep.equal([]);
      expect(ix.index.rps[RPID].status).to.equal(1);
      expect(ix.index.meta.block).to.equal(head);
      expect(tags.at(-1)).to.equal(head); // okuma dizinin sabitlendiği bloktan

      // hata yokken yeni bloksuz koşu hiçbir şey okumaz
      const n = tags.length;
      expect(await ix.sync()).to.equal(head);
      expect(tags.length).to.equal(n);
    });
  });
});
