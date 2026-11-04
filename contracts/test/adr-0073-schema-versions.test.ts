/**
 * ADR-0073 K3 / CE3 — şema sürüm özetleri yalnız eklenir: `vctURI` ve yazılmış her özet değişmez, yeni sürüm özeti eklenir;
 * `matchesContentHash` herhangi biriyle eşleşir, REVOKED şemada hiçbiriyle. Ağ şemasına ekleme yalnız Governance önerisiyle.
 */
import { expect } from "chai";

import { SchemaTier, TR, ZERO, id, loadFixture, type Fixture } from "./helpers/fixture.js";

const EDU = "urn:tamga:tr:edu:DiplomaCredential:1";
const NET = "urn:tamga:edu:DiplomaCredential:1";

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

async function passAndExecute(f: Fixture, tx: any) {
  const pid = await proposalId(tx, f);
  await (await f.as(f.governance, f.trValidator).vote(pid, true)).wait();
  await (await f.as(f.governance, f.kzValidator).vote(pid, true)).wait();
  return f.governance.execute(pid);
}

describe("ADR-0073 K3 — şema sürüm özetleri (CE3)", function () {
  let f: Fixture;
  let edu: string;
  beforeEach(async () => {
    f = await loadFixture();
    edu = await f.registerNationalSchema(TR, f.trDelegate, EDU, id("v1.0"));
  });

  it("ulusal şemaya o devlet yeni sürüm özeti ekler; eski ve yeni özet eşleşir, ilk özet ve vct değişmez", async () => {
    await expect(f.as(f.schemas, f.trDelegate).addSchemaContentHash(edu, id("v1.1")))
      .to.emit(f.schemas, "SchemaContentHashAdded")
      .withArgs(edu, id("v1.1"));
    expect(await f.schemas.matchesContentHash(edu, id("v1.0"))).to.equal(true);
    expect(await f.schemas.matchesContentHash(edu, id("v1.1"))).to.equal(true);
    expect(await f.schemas.matchesContentHash(edu, id("v2"))).to.equal(false);
    expect(await f.schemas.contentHashesOf(edu)).to.deep.equal([id("v1.0"), id("v1.1")]);
    const rec = await f.schemas.getSchema(edu);
    expect(rec.contentHash).to.equal(id("v1.0"));
    expect(rec.vctURI).to.equal(EDU);
    expect(await f.trustQueries.schemaMatchesContentHash(edu, id("v1.1"))).to.equal(true);
  });

  it("boş, yinelenen (ilk özet dahil) özet ve yabancı devlet reddedilir", async () => {
    const w = f.as(f.schemas, f.trDelegate);
    await expect(w.addSchemaContentHash(edu, ZERO)).to.be.revertedWithCustomError(f.schemas, "EmptyContentHash");
    await expect(w.addSchemaContentHash(edu, id("v1.0")))
      .to.be.revertedWithCustomError(f.schemas, "ContentHashExists")
      .withArgs(edu, id("v1.0"));
    await (await w.addSchemaContentHash(edu, id("v1.1"))).wait();
    await expect(w.addSchemaContentHash(edu, id("v1.1"))).to.be.revertedWithCustomError(f.schemas, "ContentHashExists");
    await expect(f.as(f.schemas, f.kzDelegate).addSchemaContentHash(edu, id("v1.2")))
      .to.be.revertedWithCustomError(f.schemas, "NotOwnerState")
      .withArgs(TR, await f.kzDelegate.getAddress());
  });

  it("DEPRECATED şemaya eklenebilir; REVOKED şemaya eklenemez ve hiçbir özet eşleşmez", async () => {
    const w = f.as(f.schemas, f.trDelegate);
    await (await w.deprecateSchema(edu, ZERO)).wait();
    await (await w.addSchemaContentHash(edu, id("v1.1"))).wait();
    await (await w.revokeSchema(edu, "")).wait();
    await expect(w.addSchemaContentHash(edu, id("v1.2"))).to.be.revertedWithCustomError(f.schemas, "AlreadyRevoked");
    expect(await f.schemas.matchesContentHash(edu, id("v1.0"))).to.equal(false);
    expect(await f.schemas.matchesContentHash(edu, id("v1.1"))).to.equal(false);
  });

  it("şema başına en çok MAX_CONTENT_HASHES sürüm özeti", async () => {
    const max = Number(await f.schemas.MAX_CONTENT_HASHES());
    const w = f.as(f.schemas, f.trDelegate);
    for (let k = 0; k < max; k++) await (await w.addSchemaContentHash(edu, id(`v1.${k + 1}`))).wait();
    await expect(w.addSchemaContentHash(edu, id("fazla")))
      .to.be.revertedWithCustomError(f.schemas, "TooManyContentHashes")
      .withArgs(edu, max);
    expect((await f.schemas.contentHashesOf(edu)).length).to.equal(max + 1);
  });

  it("ağ şemasına yalnız Governance önerisiyle (2/3) eklenir", async () => {
    const g = f.as(f.governance, f.trValidator);
    await (
      await passAndExecute(f, await g.proposeNetworkSchema(f.schemaRecord(NET, SchemaTier.NETWORK, "0x0000")))
    ).wait();
    const net = id(NET);
    await expect(f.as(f.schemas, f.trDelegate).addSchemaContentHash(net, id("n1.1"))).to.be.revertedWithCustomError(
      f.schemas,
      "NetworkTierRequiresGovernance",
    );
    await expect(passAndExecute(f, await g.proposeNetworkSchemaContentHash(net, id("n1.1"))))
      .to.emit(f.schemas, "SchemaContentHashAdded")
      .withArgs(net, id("n1.1"));
    expect(await f.schemas.matchesContentHash(net, id("n1.1"))).to.equal(true);
  });
});
