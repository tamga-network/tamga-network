/**
 * SPEC-BC-0001 §7 / SPEC-CRED-0003 / ADR-0008 / ADR-0063 — çapa modeli: L1, L1b, L2, L3 (SB1), L4, kota, R2, R4. isRevoked YOKTUR.
 */
import { expect } from "chai";

import {
  DAY,
  IssuerAssurance,
  IssuerCategory,
  TR,
  ZERO,
  id,
  loadFixture,
  networkHelpers,
  type Fixture,
} from "./helpers/fixture.js";

const URI = "https://status.example-university.example/v1/sl/7f3a9c21";

describe("StatusListRegistry (SPEC-BC-0001 §7)", function () {
  let f: Fixture;
  let listId: string;
  beforeEach(async () => {
    f = await loadFixture();
    listId = await f.statusLists.listIdOf(f.uniIssuer, URI);
    await f.as(f.statusLists, f.uniOperator).registerList(f.uniIssuer, URI, 100_000, 2);
  });

  it("L2: 100.000 altı liste açılamaz (sürü mahremiyeti)", async () => {
    await expect(f.as(f.statusLists, f.uniOperator).registerList(f.uniIssuer, URI + "/kucuk", 999, 2))
      .to.be.revertedWithCustomError(f.statusLists, "ListSizeTooSmall")
      .withArgs(999, 100_000);
  });

  it("L3 (ADR-0063 SB1): listenin kendi bits değeri — 1, 2, 4, 8 kabul; diğerleri ret; kayıtta saklanır ve olayda yayılır", async () => {
    const w = f.as(f.statusLists, f.uniOperator);
    for (const bits of [1, 2, 4, 8]) {
      const uri = `${URI}/b${bits}`;
      const lid = await f.statusLists.listIdOf(f.uniIssuer, uri);
      await expect(w.registerList(f.uniIssuer, uri, 100_000, bits))
        .to.emit(f.statusLists, "ListRegistered")
        .withArgs(lid, f.uniIssuer, uri, 100_000, bits);
      expect((await f.statusLists.getListAnchor(lid)).bitsPerEntry).to.equal(bits);
    }
    for (const bits of [0, 3, 5, 16, 255]) {
      await expect(w.registerList(f.uniIssuer, `${URI}/x${bits}`, 100_000, bits))
        .to.be.revertedWithCustomError(f.statusLists, "InvalidBitsPerEntry")
        .withArgs(bits);
    }
    expect(await f.statusLists.isAllowedBits(1)).to.equal(true);
    expect(await f.statusLists.isAllowedBits(3)).to.equal(false);
  });

  it("L3 (SB1): bits yayınla değişmez — publishList bits almaz, kayıttaki değer kalır", async () => {
    const w = f.as(f.statusLists, f.uniOperator);
    const uri = `${URI}/kimlik`;
    const lid = await f.statusLists.listIdOf(f.uniIssuer, uri);
    await w.registerList(f.uniIssuer, uri, 100_000, 1);
    await w.publishList(lid, id("v1"), 1, await f.now());
    expect((await f.statusLists.getListAnchor(lid)).bitsPerEntry).to.equal(1);
  });

  it("L4: aynı liste iki kez açılamaz; boş URI reddedilir", async () => {
    const w = f.as(f.statusLists, f.uniOperator);
    await expect(w.registerList(f.uniIssuer, URI, 100_000, 2)).to.be.revertedWithCustomError(
      f.statusLists,
      "ListExists",
    );
    await expect(w.registerList(f.uniIssuer, "", 100_000, 2)).to.be.revertedWithCustomError(
      f.statusLists,
      "EmptyListURI",
    );
  });

  it("L1 — EN ÖNEMLİ: sürüm geriye gidemez (issuer listeyi geri alamaz)", async () => {
    const w = f.as(f.statusLists, f.uniOperator);
    const t = await f.now();
    await w.publishList(listId, id("v5"), 5, t);
    await expect(w.publishList(listId, id("v4"), 4, t))
      .to.be.revertedWithCustomError(f.statusLists, "VersionNotMonotonic")
      .withArgs(5, 4);
    await expect(w.publishList(listId, id("v5b"), 5, t)).to.be.revertedWithCustomError(
      f.statusLists,
      "VersionNotMonotonic",
    );
  });

  it("yayın ve eşleşme; yayınlanmamış liste hiçbir hash'le eşleşmez (bytes32(0) tuzağı)", async () => {
    expect(await f.statusLists.matchesContentHash(listId, ZERO)).to.equal(false);
    const h = id("token-bytes");
    await expect(f.as(f.statusLists, f.uniOperator).publishList(listId, h, 1, await f.now()))
      .to.emit(f.statusLists, "ListPublished")
      .withArgs(listId, 1, h, (x: bigint) => x > 0n);
    expect(await f.statusLists.matchesContentHash(listId, h)).to.equal(true);
    expect(await f.statusLists.matchesContentHash(listId, id("baska"))).to.equal(false);
    const a = await f.statusLists.getListAnchor(listId);
    expect(a.version).to.equal(1);
    expect(a.listURI).to.equal(URI);
    expect(await f.statusLists.getListsByIssuer(f.uniIssuer)).to.deep.equal([listId]);
    expect(await f.statusLists.publishCountToday(listId)).to.equal(1);
  });

  it("boş içerik hash'i reddedilir; publishedAt=0 blok zamanı sayılır", async () => {
    const w = f.as(f.statusLists, f.uniOperator);
    await expect(w.publishList(listId, ZERO, 1, 0)).to.be.revertedWithCustomError(f.statusLists, "EmptyContentHash");
    await w.publishList(listId, id("v1"), 1, 0);
    expect((await f.statusLists.getListAnchor(listId)).publishedAt).to.equal(await f.now());
  });

  it("R2: askıya alınmış issuer yayın yapamaz", async () => {
    await f.as(f.issuers, f.trDelegate).suspendIssuer(f.uniIssuer);
    await expect(f.as(f.statusLists, f.uniOperator).publishList(listId, id("v1"), 1, await f.now()))
      .to.be.revertedWithCustomError(f.statusLists, "NotIssuerDelegate")
      .withArgs(f.uniIssuer, await f.uniOperator.getAddress());
    await expect(f.as(f.statusLists, f.uniOperator).registerList(f.uniIssuer, URI + "/2", 100_000, 2))
      .to.be.revertedWithCustomError(f.statusLists, "IssuerNotActive")
      .withArgs(f.uniIssuer);
  });

  it("yabancı anahtar yayın yapamaz / liste açamaz", async () => {
    await expect(f.as(f.statusLists, f.stranger).publishList(listId, id("v1"), 1, await f.now()))
      .to.be.revertedWithCustomError(f.statusLists, "NotIssuerDelegate")
      .withArgs(f.uniIssuer, await f.stranger.getAddress());
    await expect(
      f.as(f.statusLists, f.stranger).registerList(f.uniIssuer, URI + "/3", 100_000, 2),
    ).to.be.revertedWithCustomError(f.statusLists, "NotIssuerDelegate");
  });

  it("kota: günde 48 yayın", async () => {
    const w = f.as(f.statusLists, f.uniOperator);
    for (let v = 1; v <= 48; v++) await w.publishList(listId, id(`v${v}`), v, 0);
    await expect(w.publishList(listId, id("49"), 49, 0))
      .to.be.revertedWithCustomError(f.statusLists, "PublishQuotaExceeded")
      .withArgs(listId, 48);
  });

  it("publishedAt gelecekte olamaz (300 s sapma payı)", async () => {
    const future = (await f.now()) + 3600;
    await expect(f.as(f.statusLists, f.uniOperator).publishList(listId, id("v1"), 1, future))
      .to.be.revertedWithCustomError(f.statusLists, "PublishedAtInFuture")
      .withArgs(future);
  });

  it("L1b: yeni sürüm eskisinden önce yayınlanmış gösterilemez; aynı an kabul", async () => {
    await networkHelpers.time.increase(10 * DAY);
    const w = f.as(f.statusLists, f.uniOperator);
    const t = await f.now();
    await w.publishList(listId, id("v1"), 1, t);
    await expect(w.publishList(listId, id("v2"), 2, t - 3600))
      .to.be.revertedWithCustomError(f.statusLists, "PublishedAtNotMonotonic")
      .withArgs(t, t - 3600);
    await w.publishList(listId, id("v2"), 2, t);
  });

  it("R4 / I4: REVOKED issuer'ın listesini HALEFİ yayınlayabilir; eski operatör yayınlayamaz", async () => {
    const yok = await f.registerIssuer(
      TR,
      f.trDelegate,
      f.trCA,
      id("YOK-CERT"),
      IssuerCategory.GOVERNMENT,
      IssuerAssurance.I3,
    );
    const yokOp = f.stranger;
    await f.as(f.issuers, f.trDelegate).setIssuerDelegates(yok, [await yokOp.getAddress()]);
    await f.as(f.issuers, f.trDelegate).revokeIssuer(f.uniIssuer, yok);
    await expect(
      f.as(f.statusLists, f.uniOperator).publishList(listId, id("v1"), 1, await f.now()),
    ).to.be.revertedWithCustomError(f.statusLists, "NotIssuerDelegate");
    await f.as(f.statusLists, yokOp).publishList(listId, id("v1"), 1, await f.now());
    expect((await f.statusLists.getListAnchor(listId)).version).to.equal(1);
    await f.as(f.statusLists, yokOp).retireList(listId, "devir tamam");
    expect(await f.statusLists.matchesContentHash(listId, id("v1"))).to.equal(false); // RETIRED liste eşleşmez
  });

  it("R2: CA rotasyonu (RETIRED) status yayınını DURDURMAZ", async () => {
    await f.as(f.rootCAs, f.trDelegate).retireRootCA(f.trCA, ZERO);
    await f.as(f.statusLists, f.uniOperator).publishList(listId, id("v1"), 1, await f.now());
    expect((await f.statusLists.getListAnchor(listId)).version).to.equal(1);
  });

  it("retire: yalnız ACTIVE liste; ikinci retire ListNotActive; bilinmeyen liste UnknownList", async () => {
    const w = f.as(f.statusLists, f.uniOperator);
    await w.retireList(listId, "kapandi");
    await expect(w.retireList(listId, "yine")).to.be.revertedWithCustomError(f.statusLists, "ListNotActive");
    await expect(w.publishList(listId, id("v1"), 1, 0)).to.be.revertedWithCustomError(f.statusLists, "ListNotActive");
    await expect(f.statusLists.getListAnchor(id("yok"))).to.be.revertedWithCustomError(f.statusLists, "UnknownList");
  });

  it("ADR-0008 / D-REV-2: zincirde isRevoked YOKTUR (ABI düzeyinde)", async () => {
    const names = f.statusLists.interface.fragments
      .filter((fr) => fr.type === "function")
      .map((fr) => (fr as any).name as string);
    expect(names).to.not.include("isRevoked");
    expect(names.some((n) => /revoked|setBit|getChunk/i.test(n))).to.equal(false);
    expect(await f.statusLists.MIN_LIST_SIZE()).to.equal(100_000);
    expect(await f.statusLists.MAX_PUBLISH_PER_DAY()).to.equal(48);
  });
});
