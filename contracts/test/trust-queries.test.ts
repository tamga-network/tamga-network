/**
 * SPEC-BC-0001 §11.2 — doğrulayıcı okuma seti (5 soru) ve `verifyAll`. İhraç soruları doğrulamada KULLANILMAZ (I2).
 */
import { expect } from "chai";

import { KZ, RecognitionMode, TR, ZERO, id, loadFixture, type Fixture } from "./helpers/fixture.js";

const EDU = "urn:tamga:tr:edu:DiplomaCredential:1"; // ulusal (TR) şema — ADR-0054 NS1
const URI = "https://status.example-university.example/v1/sl/7f3a9c21";

describe("TrustQueries (SPEC-BC-0001 §11.2)", function () {
  let f: Fixture;
  let schemaId: string;
  let listId: string;
  const schemaHash = id("type-metadata");
  const listHash = id("status-list-token");

  beforeEach(async () => {
    f = await loadFixture();
    schemaId = await f.registerNationalSchema(TR, f.trDelegate, EDU, schemaHash);
    await f.as(f.issuers, f.trDelegate).setSchemaAuthorization(f.uniIssuer, schemaId, true);
    listId = await f.statusLists.listIdOf(f.uniIssuer, URI);
    await f.as(f.statusLists, f.uniOperator).registerList(f.uniIssuer, URI, 100_000, 2);
    await f.as(f.statusLists, f.uniOperator).publishList(listId, listHash, 1, 0);
    await f.as(f.recognition, f.kzDelegate).setRecognition(KZ, TR, RecognitionMode.FULL, []);
  });

  it("beş soru da YES → ok", async () => {
    const iat = await f.now();
    const [ok, r] = await f.trustQueries.verifyAll(f.uniIssuer, iat, schemaId, schemaHash, KZ, listId, listHash);
    expect(ok).to.equal(true);
    expect([...r]).to.deep.equal([true, true, true, true, true]);
    expect(await f.trustQueries.isCredentialAcceptable(f.uniIssuer, iat)).to.equal(true);
    expect(await f.trustQueries.isCredentialSchemaAcceptable(f.uniIssuer, schemaId, iat)).to.equal(true);
    expect(await f.trustQueries.schemaMatchesContentHash(schemaId, schemaHash)).to.equal(true);
    expect(await f.trustQueries.isRecognizedBy(KZ, f.uniIssuer)).to.equal(true);
    expect(await f.trustQueries.statusListMatchesContentHash(listId, listHash)).to.equal(true);
  });

  it("tek bir soru NO ise ok=false ve hangi soru görünür", async () => {
    const iat = await f.now();
    let [ok, r] = await f.trustQueries.verifyAll(f.uniIssuer, iat, schemaId, id("baska"), KZ, listId, listHash);
    expect(ok).to.equal(false);
    expect(r[2]).to.equal(false);
    [ok, r] = await f.trustQueries.verifyAll(f.uniIssuer, iat, schemaId, schemaHash, "0x415a", listId, listHash); // AZ tanımıyor
    expect(ok).to.equal(false);
    expect(r[3]).to.equal(false);
    [ok, r] = await f.trustQueries.verifyAll(f.uniIssuer, iat, schemaId, schemaHash, KZ, listId, id("eski-token"));
    expect(ok).to.equal(false);
    expect(r[4]).to.equal(false);
  });

  it("I2: geçmiş belge, issuer sonradan REVOKED olsa da doğrulanır; iptal sonrası tarihli red", async () => {
    const iat = await f.now();
    await f.as(f.issuers, f.trDelegate).revokeIssuer(f.uniIssuer, ZERO);
    expect(await f.issuers.isValidIssuer(f.uniIssuer)).to.equal(false); // ihraç sorusu — doğrulamada kullanılmaz
    const [ok] = await f.trustQueries.verifyAll(f.uniIssuer, iat, schemaId, schemaHash, KZ, listId, listHash);
    expect(ok).to.equal(true);
    const [ok2, r2] = await f.trustQueries.verifyAll(
      f.uniIssuer,
      (await f.now()) + 1,
      schemaId,
      schemaHash,
      KZ,
      listId,
      listHash,
    );
    expect(ok2).to.equal(false);
    expect(r2[0]).to.equal(false);
  });

  it("yükseltilemez ve durumsuz: registry adresleri sabit; sıfır adres reddedilir", async () => {
    expect(await f.trustQueries.issuers()).to.equal(await f.issuers.getAddress());
    expect(await f.trustQueries.statusLists()).to.equal(await f.statusLists.getAddress());
    const { ethers } = await import("./helpers/fixture.js");
    await expect(
      ethers.deployContract("TrustQueries", [
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
      ]),
    ).to.be.revertedWithCustomError(f.trustQueries, "ZeroAddress");
  });
});
