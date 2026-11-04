/**
 * `ChainTrustSource` kuralları (ADR-0073 K5 / CE5, K2 / CE2; ADR-0074 K5; CMP4) — elle kurulmuş dizinle, zincirsiz:
 * iat anındaki durum ve yarı açık sınırlar, sert iptal, kökün hiç REVOKED olmaması, şema yetki penceresi, tanıma ve engel,
 * D5 araması (adresin son parçası), bayat dizinde UNKNOWN. Zincirle uçtan uca eşdeğerlik: contracts/test/chain-equivalence.test.ts.
 */
import { describe, expect, it } from "vitest";

import { ChainTrustSource } from "../src/chain-trust-source.js";
import { emptyIndex, type ChainIndex } from "../src/indexer.js";
import { ZERO32, listLookupIdOf, rpIdOf } from "../src/ids.js";

const T = 1_800_000_000;
const ISS = "0x" + "11".repeat(32);
const CA = "0x" + "22".repeat(32);
const SCH = "0x" + "33".repeat(32);
const LIST = "0x" + "44".repeat(32);
function index(): ChainIndex {
  const ix = emptyIndex();
  ix.meta = { chainId: 31337, block: 10, blockTimestamp: T, addresses: {} };
  ix.rootCAs[CA] = {
    caId: CA,
    state: "TR",
    fp: ZERO32,
    validFrom: 0,
    validUntil: T * 2,
    status: 1,
    history: [[100, 1]],
  };
  ix.issuers[ISS] = {
    issuerId: ISS,
    state: "TR",
    category: 2,
    assurance: 1,
    fp: ZERO32,
    parentCA: CA,
    validFrom: 50,
    validUntil: T * 2,
    status: 1,
    history: [
      [100, 1],
      [200, 2],
      [300, 1],
    ],
    invalidatesFrom: 0,
    auth: { [SCH]: [[100, 400]] },
    profile: { issuerClass: 3, publicSector: false, entitlements: 0, registrationHash: ZERO32 },
  };
  ix.schemas[SCH] = { schemaId: SCH, vct: "urn:x", tier: 0, state: "", status: 1, history: [[100, 1]], hashes: [] };
  ix.lists[LIST] = {
    listId: LIST,
    issuerId: ISS,
    listUri: "https://status.example/uni/00a1",
    contentHash: "0x" + "ab".repeat(32),
    version: 3,
    publishedAt: 500,
    bits: 2,
    size: 100000,
    status: 1,
  };
  ix.recognition.KZ = { TR: { mode: 2, categories: [2] } };
  return ix;
}
const src = (ix = index(), now = T) => new ChainTrustSource(ix, { now: () => new Date(now * 1000) });

describe("ChainTrustSource — kontrat okuma kuralları", () => {
  it("C1: iat anındaki durum, yarı açık; askıdan önceki belge kabul, askıda ret, dönüşten sonra kabul", () => {
    const s = src();
    expect([99, 100, 199, 200, 299, 300].map((t) => s.isCredentialAcceptable(ISS, t))).toEqual([
      "NO",
      "YES",
      "YES",
      "NO",
      "NO",
      "YES",
    ]);
    expect(s.isCredentialAcceptable("0x" + "99".repeat(32), 150)).toBe("NO");
  });
  it("C1: sert iptal (iat ≥ invalidatesFrom ret) ve kök bir kez REVOKED olunca bütün altı düşer", () => {
    const ix = index();
    ix.issuers[ISS].invalidatesFrom = 150;
    expect(src(ix).isCredentialAcceptable(ISS, 149)).toBe("YES");
    expect(src(ix).isCredentialAcceptable(ISS, 150)).toBe("NO");
    const ix2 = index();
    ix2.rootCAs[CA].history.push([900, 4]);
    expect(src(ix2).isCredentialAcceptable(ISS, 150)).toBe("NO");
  });
  it("C2: yetki penceresi [since, until) ve şema iat anında ACTIVE, hiç REVOKED değil", () => {
    const s = src();
    expect([99, 100, 399, 400].map((t) => s.isCredentialSchemaAcceptable(ISS, SCH, t))).toEqual([
      "NO",
      "YES",
      "YES",
      "NO",
    ]);
    const ix = index();
    ix.schemas[SCH].history.push([350, 2]); // DEPRECATED: önceki belge kabul, sonraki ret
    expect(src(ix).isCredentialSchemaAcceptable(ISS, SCH, 349)).toBe("YES");
    expect(src(ix).isCredentialSchemaAcceptable(ISS, SCH, 350)).toBe("NO");
    ix.schemas[SCH].history.push([360, 3]);
    expect(src(ix).isCredentialSchemaAcceptable(ISS, SCH, 120)).toBe("NO");
  });
  it("C3: kendi devleti, kategori sınırlı tanıma, engel", () => {
    const ix = index();
    expect(src(ix).isRecognizedBy("TR", ISS)).toBe("YES");
    expect(src(ix).isRecognizedBy("KZ", ISS)).toBe("YES");
    expect(src(ix).isRecognizedBy("AZ", ISS)).toBe("NO");
    ix.issuers[ISS].category = 3;
    expect(src(ix).isRecognizedBy("KZ", ISS)).toBe("NO");
    ix.blocklist.TR = [ISS];
    expect(src(ix).isRecognizedBy("TR", ISS)).toBe("NO");
  });
  it("D5: doğrulayıcının araması (adresin son parçası) → çapa; sürüm ve özet", () => {
    const a = src().statusAnchor(listLookupIdOf("https://status.example/uni/00a1"));
    expect(a).toMatchObject({
      version: 3,
      content_hash: "sha256:" + "ab".repeat(32),
      list_uri: "https://status.example/uni/00a1",
    });
    expect(src().statusAnchor("0x" + "0".repeat(64))).toBeNull();
  });
  it("CMP4: bayat ya da senkronlanmamış dizin → UNKNOWN / boş", () => {
    const stale = src(index(), T + 3 * 3600);
    expect(stale.isCredentialAcceptable(ISS, 150)).toBe("UNKNOWN");
    expect(stale.statusAnchor(LIST)).toBeNull();
    expect(stale.freshness()).toMatchObject({ source: "chain", healthy: false });
    expect(src(emptyIndex()).isRecognizedBy("TR", ISS)).toBe("UNKNOWN");
    expect(src().relyingPartyByDnsName("nope.example")).toBeNull();
    expect(rpIdOf("A.Example")).toBe(rpIdOf("a.example"));
  });
});
