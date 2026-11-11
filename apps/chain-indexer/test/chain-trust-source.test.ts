/**
 * `ChainTrustSource` kuralları (ADR-0073 K5 / CE5, K2 / CE2; ADR-0074 K5; CMP4) — elle kurulmuş dizinle, zincirsiz:
 * iat anındaki durum ve yarı açık sınırlar, sert iptal, kökün hiç REVOKED olmaması, şema yetki penceresi, tanıma ve engel,
 * D5 araması (adresin son parçası), bayat dizinde UNKNOWN. Zincirle uçtan uca eşdeğerlik: contracts/test/chain-equivalence.test.ts.
 */
import { describe, expect, it } from "vitest";

import { ChainTrustSource, listLevelOf } from "../src/chain-trust-source.js";
import { emptyIndex, type ChainIndex } from "../src/indexer.js";
import { ZERO32, groupIdOf, listLookupIdOf, rpIdOf } from "../src/ids.js";

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
// içerik bağı: zincir listeyle aynı düzeyde (T - 10); testler `content`'i ayrıca dener
const bound = { projectedLevel: T - 10, listLevel: () => T - 10 };
const src = (ix = index(), now = T) => new ChainTrustSource(ix, { now: () => new Date(now * 1000), content: bound });

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

  it("I3: sağlık içeriğe bağlı — içerik bağı yoksa ya da zincir listenin gerisindeyse blok taze olsa da UNKNOWN", () => {
    const at = { now: () => new Date(T * 1000) };
    // blok zamanı taze (T), ama içerik düzeyi verilmedi: zincirin içeriğinin güncel olduğu bilinmiyor
    const unbound = new ChainTrustSource(index(), at);
    expect(unbound.healthProblem()).toBe("content_unbound");
    expect(unbound.isCredentialAcceptable(ISS, 150)).toBe("UNKNOWN");
    expect(unbound.isCredentialSchemaAcceptable(ISS, SCH, 150)).toBe("UNKNOWN");
    expect(unbound.isRecognizedBy("TR", ISS)).toBe("UNKNOWN");
    expect(unbound.statusAnchor(LIST)).toBeNull();
    expect(unbound.issuer(ISS)).toBeNull();
    expect(unbound.freshness().healthy).toBe(false);
    // liste zincire yansıtılan düzeyden ileride (yeniden oynatmadan sonra yeni liste yayımlandı)
    const behind = new ChainTrustSource(index(), {
      ...at,
      content: { projectedLevel: T - 10, listLevel: () => T - 9 },
    });
    expect(behind.healthProblem()).toBe("content_behind");
    expect(behind.isCredentialAcceptable(ISS, 150)).toBe("UNKNOWN");
    // listenin düzeyi bilinmiyor
    const unknown = new ChainTrustSource(index(), { ...at, content: { projectedLevel: T, listLevel: () => null } });
    expect(unknown.isCredentialAcceptable(ISS, 150)).toBe("UNKNOWN");
    // aynı düzey: sağlıklı
    expect(src().healthProblem()).toBeNull();
    expect(src().isCredentialAcceptable(ISS, 150)).toBe("YES");
    // okunamayan kayıt: dizin eksik
    const ix = index();
    ix.errors.push({ set: "rps", id: "0x01", block: 10, error: "UnknownRP" });
    expect(src(ix).healthProblem()).toBe("index_errors");
    expect(src(ix).isCredentialAcceptable(ISS, 150)).toBe("UNKNOWN");
  });

  it("listLevelOf: yüklü listelerin en son yayın anı", () => {
    const national = new Map([
      ["TR", { list: { issued_at: "2026-11-01T00:00:00Z" } }],
      ["KZ", { list: { issued_at: "2026-11-03T00:00:00Z" } }],
    ]);
    expect(listLevelOf({ lotl: { issued_at: "2026-11-02T00:00:00Z" }, national })).toBe(
      Date.parse("2026-11-03T00:00:00Z") / 1000,
    );
    expect(listLevelOf({ national: new Map() })).toBeNull();
  });

  it("I4: sağlıksız kaynak dönem, kök durumu ve ağ düzeyi kayıt da vermez", () => {
    const ix = index();
    const RP = rpIdOf("verify.example");
    ix.rps[RP] = {
      rpId: RP,
      state: "TR",
      nameHash: ZERO32,
      fp: "0x" + "55".repeat(32),
      status: 1,
      registeredAt: 100,
      history: [[100, 1]],
      periods: [{ state: "TR", since: 100 }],
      scopes: [],
      groups: [],
    };
    ix.records["3|0x01"] = {
      kind: 3,
      recordId: "0x01",
      parentId: ZERO32,
      region: "0x0000",
      subtype: 1,
      status: 1,
      validFrom: 0,
      validUntil: 0,
      fingerprint: ZERO32,
      detailsHash: ZERO32,
      flags: "0",
      digests: [],
      history: [[100, 1]],
    };
    expect(src(ix).registrationPeriods("verify.example")).toHaveLength(1);
    expect(src(ix).rootCAStatus(CA)).toBe("ACTIVE");
    expect(src(ix).networkRecords()).toHaveLength(1);
    expect(src(ix).indexSnapshot()).toBe(ix);
    const stale = src(ix, T + 3 * 3600);
    expect(stale.registrationPeriods("verify.example")).toEqual([]);
    expect(stale.rootCAStatus(CA)).toBeNull();
    expect(stale.networkRecords()).toEqual([]);
    expect(stale.indexSnapshot()).toBeNull();
  });

  it("I4: D5 araması (kurum, son parça) ile — iki kurumda aynı son parça yanlış kurumun çapasını döndürmez", () => {
    const ix = index();
    const OTHER = "0x" + "66".repeat(32);
    const LIST2 = "0x" + "77".repeat(32);
    ix.lists[LIST2] = {
      ...ix.lists[LIST],
      listId: LIST2,
      issuerId: OTHER,
      listUri: "https://status.other.example/x/00a1",
      contentHash: "0x" + "cd".repeat(32),
      version: 9,
    };
    const lookup = listLookupIdOf("https://status.example/uni/00a1");
    expect(lookup).toBe(listLookupIdOf("https://status.other.example/x/00a1"));
    // kurum verilmezse belirsiz: çapa yok (eski hâl: son yazılan liste kazanıyordu)
    expect(src(ix).statusAnchor(lookup)).toBeNull();
    expect(src(ix).statusAnchor(lookup, ISS)).toMatchObject({ version: 3, issuer_id: ISS });
    expect(src(ix).statusAnchor(lookup, OTHER)).toMatchObject({ version: 9, issuer_id: OTHER });
    expect(src(ix).statusAnchor(lookup, "0x" + "88".repeat(32))).toBeNull();
    // zincir liste kimliğiyle doğrudan arama değişmedi; yanlış kurumla null
    expect(src(ix).statusAnchor(LIST2)).toMatchObject({ version: 9 });
    expect(src(ix).statusAnchor(LIST2, ISS)).toBeNull();
  });

  it("I4: kapı grubunun kurumu dizinde yoksa grup etkin değildir", () => {
    const mk = (institutionId: string) => {
      const ix = index();
      const RP = rpIdOf("gate.example");
      ix.rps[RP] = {
        rpId: RP,
        state: "TR",
        nameHash: ZERO32,
        fp: "0x" + "55".repeat(32),
        status: 1,
        registeredAt: 100,
        history: [[100, 1]],
        periods: [{ state: "TR", since: 100 }],
        scopes: [],
        groups: [
          {
            groupId: groupIdOf("gate-1"),
            institutionId,
            policyIds: [],
            certFingerprints: [],
            offlineAllowed: false,
            validFrom: 100,
            validUntil: 0,
            labelHash: ZERO32,
          },
        ],
      };
      return src(ix).terminalGroup("gate-1");
    };
    expect(mk(ISS)?.active).toBe(true); // kayıtlı ve ACTIVE kurum
    expect(mk(rpIdOf("gate.example"))?.active).toBe(true); // doğrulayıcının kendisi
    expect(mk("0x" + "99".repeat(32))?.active).toBe(false); // bilinmeyen kurum (eski hâl: etkin sayılıyordu)
  });
});
