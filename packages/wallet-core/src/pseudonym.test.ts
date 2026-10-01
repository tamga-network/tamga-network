/**
 * ADR-0031 — site başına takma ad: türetme (kararlı, site başına ilişkisiz), sıra seçimi (tek / çok, silinen sıra kullanılmaz),
 * sunum JWT'si (başlıktaki anahtarla doğrulanır), tohum belgesinin alınması (tür, imzacı, cnf), PS3 (tohum hiçbir sorguya önerilmez).
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { issueSdJwtVc, pemIssuerSigner } from "@tamga-network/sd-jwt";
import {
  activePseudonyms,
  b64u,
  choosePseudonymIndex,
  deletePseudonym,
  derivePseudonym,
  jwkThumbprint,
  matchDcql,
  MemoryKeyStore,
  newState,
  nextPseudonymIndex,
  presentPseudonym,
  pseudonymQueryOf,
  PSEUDONYM_FORMAT,
  PSEUDONYM_SEED_VCT,
  readPseudonymSeed,
  recordPseudonymUse,
  renamePseudonym,
  SoftwareKeyProvider,
  verifyJwt,
  type PublicJwk,
  type RedeemOutput,
  type StoredCredential,
} from "./index.js";

const SEED = b64u(new Uint8Array(32).fill(7));
const SITE_A = "x509_san_dns:a.example";
const SITE_B = "x509_san_dns:b.example";

describe("ADR-0031 türetme", () => {
  it("aynı tohum + site + sıra → aynı takma ad; başka site ya da sıra → farklı; takma ad = RFC 7638 parmak izi", () => {
    const a0 = derivePseudonym(SEED, SITE_A, 0);
    expect(derivePseudonym(SEED, SITE_A, 0).pseudonym).toBe(a0.pseudonym);
    expect(derivePseudonym(SEED, SITE_B, 0).pseudonym).not.toBe(a0.pseudonym);
    expect(derivePseudonym(SEED, SITE_A, 1).pseudonym).not.toBe(a0.pseudonym);
    expect(derivePseudonym(b64u(new Uint8Array(32).fill(8)), SITE_A, 0).pseudonym).not.toBe(a0.pseudonym);
    expect(a0.pseudonym).toBe(b64u(jwkThumbprint(a0.jwk)));
    expect(() => derivePseudonym("kısa", SITE_A, 0)).toThrow();
  });

  it("sunum JWT'si başlıktaki anahtarla doğrulanır; aud / nonce / rp / WIA taşır; kişi verisi yok", () => {
    const { jwt, pseudonym } = presentPseudonym({
      seed: SEED,
      rpKey: SITE_A,
      index: 0,
      aud: SITE_A,
      nonce: "n1",
      wia: "wia.jwt.x",
      wiaPop: "pop.jwt.x",
      now: 100,
    });
    const d = verifyJwt(jwt, derivePseudonym(SEED, SITE_A, 0).jwk);
    expect(d.header).toMatchObject({ typ: "tamga-pseudonym+jwt", alg: "ES256" });
    expect(b64u(jwkThumbprint(d.header.jwk as PublicJwk))).toBe(pseudonym);
    expect(d.payload).toEqual({
      aud: SITE_A,
      nonce: "n1",
      iat: 100,
      rp: SITE_A,
      wia: "wia.jwt.x",
      wia_pop: "pop.jwt.x",
    });
  });
});

describe("ADR-0031 sıra ve kayıt", () => {
  it("tek kip: ilk kullanımda sıra 0, sonra hep aynı; silinince yeni sıra (eski bir daha türetilmez)", () => {
    let st = newState("w");
    expect(choosePseudonymIndex(st, SITE_A, "single")).toEqual({ index: 0, isNew: true });
    st = recordPseudonymUse(st, { rpKey: SITE_A, index: 0, pseudonym: "p0", siteName: "A" }, 1);
    expect(choosePseudonymIndex(st, SITE_A, "single")).toEqual({ index: 0, isNew: false });
    expect(st.events?.at(-1)).toMatchObject({ kind: "pseudonym_created", typeName: "A" });
    expect(JSON.stringify(st.events)).not.toContain("p0"); // değer günlükte yok
    st = renamePseudonym(st, SITE_A, 0, "  iş hesabım ");
    expect(activePseudonyms(st, SITE_A)[0].label).toBe("iş hesabım");
    st = deletePseudonym(st, SITE_A, 0, 2);
    expect(activePseudonyms(st, SITE_A)).toEqual([]);
    expect(nextPseudonymIndex(st, SITE_A)).toBe(1);
    expect(choosePseudonymIndex(st, SITE_A, "single")).toEqual({ index: 1, isNew: true });
  });

  it("çok kip: yeni takma ad istenirse sonraki sıra; olmayan sıra seçilemez", () => {
    let st = recordPseudonymUse(newState("w"), { rpKey: SITE_A, index: 0, pseudonym: "p0" }, 1);
    expect(choosePseudonymIndex(st, SITE_A, "multiple", "new")).toEqual({ index: 1, isNew: true });
    st = recordPseudonymUse(st, { rpKey: SITE_A, index: 1, pseudonym: "p1" }, 2);
    expect(choosePseudonymIndex(st, SITE_A, "multiple", 0)).toEqual({ index: 0, isNew: false });
    expect(() => choosePseudonymIndex(st, SITE_A, "multiple", 5)).toThrow();
    expect(choosePseudonymIndex(st, SITE_B, "multiple")).toEqual({ index: 0, isNew: true });
  });
});

describe("ADR-0031 DCQL", () => {
  it("takma ad sorgusu belge sorgusu sayılmaz; tohum türü hiçbir sorguya önerilmez (PS3)", () => {
    const seedCred = {
      id: "s",
      vct: PSEUDONYM_SEED_VCT,
      copies: [{ keyRef: "k", cnf: {}, combined: "c", usedBy: [] }],
      claims: { pseudonym_seed: SEED },
    } as unknown as StoredCredential;
    const dcql = {
      credentials: [
        { id: "any", format: "dc+sd-jwt", meta: { vct_values: [] }, claims: [] },
        { id: "pseudonym", format: PSEUDONYM_FORMAT, meta: { mode: "multiple" } },
      ],
    };
    const r = matchDcql(dcql as never, [seedCred]);
    expect(r.matches).toEqual([]);
    expect(r.unmatched).toEqual(["any"]);
    expect(pseudonymQueryOf(dcql as never)).toEqual({ id: "pseudonym", mode: "multiple" });
    expect(pseudonymQueryOf({ credentials: [] })).toBeNull();
  });
});

const PKI = resolve(import.meta.dirname, "../../../ops/pki");
describe.skipIf(!existsSync(resolve(PKI, "issuer-id.pkcs8.pem")))("ADR-0031 tohum belgesi", () => {
  it("kimlik belgesinin imzacısından, kopya 0'ın anahtarına bağlı tohum kabul; başka imzacı / tür / anahtar RED", async () => {
    const keys = new SoftwareKeyProvider(new MemoryKeyStore(), { platform: "test" });
    const cnf = await keys.generate("c.0");
    const other = await keys.generate("c.x");
    const sign = (name: string) =>
      pemIssuerSigner(
        readFileSync(resolve(PKI, `${name}.pkcs8.pem`), "utf8"),
        readFileSync(resolve(PKI, `${name}.cert.pem`), "utf8"),
      );
    const idSigner = await sign("issuer-id");
    const mk = async (o: { vct?: string; signer?: typeof idSigner; cnfJwk?: PublicJwk } = {}) =>
      (
        await issueSdJwtVc({
          signer: o.signer ?? idSigner,
          iss: "https://id.tamga.network",
          vct: o.vct ?? PSEUDONYM_SEED_VCT,
          vctIntegrity: "sha256-x",
          iat: 10,
          exp: 4_000_000_000,
          cnfJwk: (o.cnfJwk ?? cnf) as never,
          claims: { pseudonym_seed: SEED },
          sdPolicy: { pseudonym_seed: "never" },
        })
      ).combined;
    const out = (seed: string) =>
      ({ copies: [{ combined: "", keyRef: "c.0", cnf }], pseudonymSeed: seed }) as unknown as RedeemOutput;
    const idLeaf = (await import("./sdjwt.js")).verifyIssuedSdJwt(await mk(), { now: 20 });
    if (!idLeaf.ok) throw new Error(idLeaf.reason);
    const identity = { leafFingerprint: idLeaf.leafFingerprint };
    const bilgi = await mk({ signer: await sign("issuer-bilgi") });
    const wrongType = await mk({ vct: "urn:tamga:id:IdentityAttestation:1" });
    const wrongKey = await mk({ cnfJwk: other });
    expect(readPseudonymSeed(out(await mk()), identity, { now: 20 })).toBe(SEED);
    expect(() => readPseudonymSeed(out(bilgi), identity, { now: 20 })).toThrow(/identity issuer/);
    expect(() => readPseudonymSeed(out(wrongType), identity, { now: 20 })).toThrow(/wrong type/);
    expect(() => readPseudonymSeed(out(wrongKey), identity, { now: 20 })).toThrow(/rejected/);
    expect(() => readPseudonymSeed({ copies: [] } as unknown as RedeemOutput, identity)).toThrow(/no pseudonym seed/);
  });
});
