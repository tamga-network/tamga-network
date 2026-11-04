/**
 * SPEC-BC-0001/DP1 · PM-TRUST-0001 (D-TRUST-0) · ADR-0008 — zincir kişisel veri, belge ve belge hash'i taşımaz.
 * ABI düzeyinde kanıt: hiçbir yazma fonksiyonu belge/kişi anlamı taşıyan bir alan almaz; `string` alanlar yalnız kurumsal
 * URI, sürüm ve gerekçe metnidir; iptal biti / isRevoked yoktur; Status List çapası yalnız hash + sürüm + zaman taşır.
 */
import { expect } from "chai";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type Param = { name: string; type: string; components?: Param[] };
type Fragment = { type: string; name?: string; inputs?: Param[]; stateMutability?: string };

const ART = join(import.meta.dirname, "..", "artifacts", "src");
const CONTRACTS: Record<string, string> = {
  Governance: "governance/Governance.sol",
  RootCARegistry: "identity/RootCARegistry.sol",
  SchemaRegistry: "schema/SchemaRegistry.sol",
  IssuerRegistry: "registry/IssuerRegistry.sol",
  RelyingPartyRegistry: "registry/RelyingPartyRegistry.sol",
  CrossRecognition: "recognition/CrossRecognition.sol",
  StatusListRegistry: "revocation/StatusListRegistry.sol",
  TrustListAnchorRegistry: "anchor/TrustListAnchorRegistry.sol",
  NetworkRegistry: "network/NetworkRegistry.sol",
  TrustQueries: "TrustQueries.sol",
};
const abiOf = (name: string): Fragment[] =>
  JSON.parse(readFileSync(join(ART, CONTRACTS[name], `${name}.json`), "utf8")).abi;

/** Alan adı kişisel veri / belge içeriği anlamı taşıyor mu? (ad, doğum, kimlik no, belge, claim, holder, subject-DID…) */
const PERSONAL =
  /holder|subject(?!Hash)|person|citizen|birth|given|family|tckn|national_?id|credential(?!Iat)|claim|vc\b|sdjwt|jwt|disclosure|salt|pseudonym|wallet_?id|device/i;
/** İzinli string alanları: kurumsal URI'ler ve sürüm dizgisi. Gerekçe metni 2026-11-04 güvenlik turunda özete döndü. */
const ALLOWED_STRING = /^(certURI|crlURI|metadataURI|listURI|vctURI|version)$/;

function* params(ps: Param[] | undefined, path = ""): Generator<[string, string]> {
  for (const p of ps ?? []) {
    const name = path ? `${path}.${p.name}` : p.name;
    if (p.components) yield* params(p.components, name);
    else yield [name, p.type];
  }
}

describe("DP1 — ABI'de kişisel veri / belge alanı yok", function () {
  for (const name of Object.keys(CONTRACTS)) {
    it(`${name}: yazma ve okuma fonksiyonlarının alan adları kişisel veri anlamı taşımaz`, () => {
      const abi = abiOf(name);
      for (const fr of abi) {
        if (fr.type !== "function" && fr.type !== "event") continue;
        // OpenZeppelin UUPS: `upgradeToAndCall(newImplementation, data)` — `data` yükseltme sonrası initialize çağrısıdır,
        // yalnız Governance 2/3 oyuyla ve boş ("") gönderilir (Governance.execute); kayıt alanı değildir.
        if (fr.name === "upgradeToAndCall") continue;
        for (const [pname, ptype] of params(fr.inputs)) {
          expect(PERSONAL.test(pname), `${name}.${fr.name}(${pname})`).to.equal(false);
          if (ptype === "string") {
            // F-18 (2026-11-04): proposeStateRemoval gerekçeyi özet (bytes32) olarak alır; adsız string istisnası kalktı
            const leaf = pname.split(".").pop()!;
            const ok = ALLOWED_STRING.test(leaf);
            expect(ok, `${name}.${fr.name}(${pname}: string)`).to.equal(true);
          }
          if (ptype === "bytes") expect.fail(`${name}.${fr.name}(${pname}): serbest bytes alanı — içerik taşıyabilir`);
        }
      }
    });
  }

  it("ADR-0008: hiçbir kontratta iptal biti yazan/okuyan fonksiyon yok", () => {
    for (const name of Object.keys(CONTRACTS)) {
      const fns = abiOf(name)
        .filter((fr) => fr.type === "function")
        .map((fr) => fr.name!);
      expect(
        fns.some((n) => /isRevoked|setRevoked|unsetRevoked|getChunk|initStatusList|bitmap/i.test(n)),
        name,
      ).to.equal(false);
    }
  });

  it("StatusListRegistry.publishList yalnız (listId, contentHash, version, publishedAt) alır — belge/indeks yok", () => {
    const pub = abiOf("StatusListRegistry").find((fr) => fr.type === "function" && fr.name === "publishList")!;
    expect(pub.inputs!.map((i) => `${i.name}:${i.type}`)).to.deep.equal([
      "listId:bytes32",
      "contentHash:bytes32",
      "version:uint64",
      "publishedAt:uint64",
    ]);
  });

  it("TrustQueries doğrulama seti belge kimliği değil yalnız issuerId/schemaId/listId + hash + iat alır", () => {
    const v = abiOf("TrustQueries").find((fr) => fr.type === "function" && fr.name === "verifyAll")!;
    const types = v.inputs!.map((i) => i.type);
    expect(types.every((t) => t === "bytes32" || t === "uint64" || t === "bytes2")).to.equal(true);
  });
});
