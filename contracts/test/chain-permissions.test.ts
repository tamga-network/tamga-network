/**
 * ADR-0052 K2/K3 (LP2, LP3) — `trust:chain-permissions render` gerçek kontrat durumundan (süreç içi Hardhat zinciri, C33 (2)):
 *   - hesap listesi = aktif validator'lar + aktif devletlerin delegeleri + çalışır durumdaki kurumların delegeleri + liste çapası
 *     yazıcıları; yetkisiz hesap yok;
 *   - düğüm listesi = bildirimi Governance'taki validator adresiyle eşleşen validator düğümleri; eşleşmeyen reddedilir;
 *   - belirleyicilik: aynı zincir durumu (aynı blok ya da durum değişmeden ilerleyen bloklar, farklı okuma sırası) → bayt bayt
 *     aynı dosya ve özet; durum değişince (kurum askısı, devlet çıkarılması, yazıcı kaldırma) liste onu izler.
 */
import { expect } from "chai";
import { HDNodeWallet } from "ethers";

import { connectTrustContracts } from "../../apps/chain-indexer/src/contracts.js";
import { providerFromEip1193 } from "../../apps/chain-indexer/src/local-dev.js";
import {
  ethersPermissionsReader,
  parsePermissionsToml,
  readPermissionsState,
  renderPermissions,
} from "../../apps/trust-publisher/src/chain/permissions.js";
import { AZ, conn, ethers, id, loadFixture, networkHelpers, type Fixture } from "./helpers/fixture.js";

const MNEMONIC = "test test test test test test test test test test test junk";
const pubOf = (i: number) =>
  HDNodeWallet.fromPhrase(MNEMONIC, undefined, `m/44'/60'/0'/0/${i}`).signingKey.publicKey.slice(4);
const decl = (state: string, i: number, port: number, role = "validator") => ({
  format: "tamga-node-declaration/1",
  state,
  role,
  node_public_key: pubOf(i),
  ip: "127.0.0.1",
  p2p_port: port,
  contact: "noc@example.org",
});

describe("ADR-0052 — trust:chain-permissions render (kontrat durumundan)", function () {
  let f: Fixture;
  let anchorAddr: string;
  let anchorers: string[];

  beforeEach(async () => {
    f = await loadFixture();
    const signers = await ethers.getSigners();
    const [gov, a1] = [signers[0], signers[10]]; // #10: başka rolü olmayan yazıcı
    const impl = await ethers.deployContract("TrustListAnchorRegistry");
    anchorers = [await gov.getAddress(), await a1.getAddress()];
    const data = impl.interface.encodeFunctionData("initialize", [await gov.getAddress(), anchorers, 1]);
    const proxy = await ethers.deployContract("ERC1967Proxy", [await impl.getAddress(), data]);
    anchorAddr = await proxy.getAddress();
  });

  const reader = () => {
    const provider = providerFromEip1193(conn.provider as any);
    const c = connectTrustContracts(f.addresses as any, provider);
    return ethersPermissionsReader(c, anchorAddr, provider);
  };
  // fikstür: #1 TR, #2 KZ, #3 AZ validator; #4 TR delegesi, #5 KZ delegesi, #6 üniversite delegesi, #7 yabancı
  const declarations = () => [
    { file: "az.json", decl: decl("AZ", 3, 30305) },
    { file: "kz.json", decl: decl("KZ", 2, 30304) },
    { file: "tr.json", decl: decl("TR", 1, 30303) },
    { file: "tr-rpc.json", decl: decl("TR", 8, 30310, "rpc") },
    { file: "kz-wrong.json", decl: { ...decl("KZ", 9, 30399), state: "KZ" } }, // #9 KZ validator'ı değil
  ];

  it("hesaplar: validator + devlet delegesi + kurum delegesi + yazıcı; yabancı yok; düğümler eşleşmeyle", async () => {
    const st = await readPermissionsState(reader());
    const r = renderPermissions(st, declarations(), "TR");
    const addr = async (s: { getAddress(): Promise<string> }) => (await s.getAddress()).toLowerCase();
    const expected = [
      await addr(f.trValidator),
      await addr(f.kzValidator),
      await addr(f.azValidator),
      await addr(f.trDelegate),
      await addr(f.kzDelegate),
      await addr(f.uniOperator),
      ...anchorers.map((a) => a.toLowerCase()),
    ];
    expect(r.accounts).to.deep.equal([...new Set(expected)].sort());
    expect(r.accounts).to.not.include(await addr(f.stranger));
    expect(st.accounts.get(await addr(f.uniOperator))).to.deep.equal(new Set(["issuer-delegate"]));
    // düğümler: üç validator + TR'nin kendi RPC düğümü; #9 reddedildi
    expect(r.nodes).to.have.length(4);
    expect(r.nodes.some((n) => n.endsWith(":30310"))).to.equal(true);
    expect(r.match.rejected.map((x) => x.file)).to.deep.equal(["kz-wrong.json"]);
    expect(r.match.missing).to.deep.equal([]);
    // biçim: sıralı, küçük harf, LF, sonda satır sonu; okuyucu geri okur
    expect(r.toml).to.not.include("\r");
    expect(r.toml.endsWith("]\n")).to.equal(true);
    for (const x of [...r.accounts, ...r.nodes]) expect(x).to.equal(x.toLowerCase());
    expect([...r.accounts].sort()).to.deep.equal(r.accounts);
    const back = parsePermissionsToml(r.toml);
    expect(back.accounts).to.deep.equal(r.accounts);
    expect(back.nodes).to.deep.equal(r.nodes);
    // başka işletmeci (KZ) kendi dosyasında TR'nin RPC düğümünü taşımaz; paylaşılan özet aynı (LP3)
    const kz = renderPermissions(st, declarations(), "KZ");
    expect(kz.nodes).to.have.length(3);
    expect(kz.sharedSha256).to.equal(r.sharedSha256);
    expect(kz.sha256).to.not.equal(r.sha256);
  });

  it("belirleyicilik: aynı durum → bayt bayt aynı dosya (blok ilerlese, bildirim sırası değişse de)", async () => {
    const a = renderPermissions(await readPermissionsState(reader()), declarations(), "TR");
    await networkHelpers.mine(5);
    const b = renderPermissions(await readPermissionsState(reader()), [...declarations()].reverse(), "TR");
    expect(b.toml).to.equal(a.toml);
    expect(b.sha256).to.equal(a.sha256);
    // sabitlenmiş blokta okuma: sonradan değişen durum eski bloğun çıktısını değiştirmez
    const block = await ethers.provider.getBlockNumber();
    await (await f.as(f.issuers, f.trDelegate).suspendIssuer(f.uniIssuer)).wait();
    const pinned = renderPermissions(await readPermissionsState(reader(), block), declarations(), "TR");
    expect(pinned.sha256).to.equal(a.sha256);
  });

  it("liste zinciri izler: kurum askısı, yazıcı kaldırma ve devlet çıkarılması", async () => {
    const uni = (await f.uniOperator.getAddress()).toLowerCase();
    const azV = (await f.azValidator.getAddress()).toLowerCase();
    await (await f.as(f.issuers, f.trDelegate).suspendIssuer(f.uniIssuer)).wait();
    let r = renderPermissions(await readPermissionsState(reader()), declarations(), null);
    expect(r.accounts).to.not.include(uni);

    const [gov] = await ethers.getSigners();
    const anchor: any = await ethers.getContractAt("TrustListAnchorRegistry", anchorAddr);
    await (await anchor.connect(gov).setAnchorer(anchorers[1], false)).wait();
    r = renderPermissions(await readPermissionsState(reader()), declarations(), null);
    expect(r.accounts).to.not.include(anchorers[1].toLowerCase());

    const rc = await (await f.as(f.governance, f.kzValidator).proposeStateRemoval(AZ, id("gerekçe"))).wait();
    const pid = rc!.logs
      .map((l: any) => {
        try {
          return f.governance.interface.parseLog(l);
        } catch {
          return null;
        }
      })
      .find((e: any) => e?.name === "ProposalCreated")!.args.id;
    await (await f.as(f.governance, f.kzValidator).vote(pid, true)).wait();
    await (await f.as(f.governance, f.trValidator).vote(pid, true)).wait();
    await (await (f.governance as any).execute(pid)).wait();
    r = renderPermissions(await readPermissionsState(reader()), declarations(), null);
    expect(r.accounts).to.not.include(azV);
    // AZ düğüm bildirimi artık eşleşmez → reddedilir, düğüm listesinden çıkar
    expect(r.match.rejected.map((x) => x.file)).to.include("az.json");
    expect(r.nodes.some((n) => n.endsWith(":30305"))).to.equal(false);
  });
});
