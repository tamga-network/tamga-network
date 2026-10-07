/**
 * wallet-core birim testleri: anahtar/imza (jose ile çapraz doğrulama), offer ayrıştırma, metadata URL,
 * ihraç edilmiş SD-JWT VC yerel doğrulama (A1–A5 + cnf) ve sunum → @tamga-network/sd-jwt verifySdJwtVc (referans doğrulayıcı) ile kabul.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { compactVerify, importJWK, type JWK } from "jose";
import { issueSdJwtVc, makeDisclosure, pemIssuerSigner, verifySdJwtVc } from "@tamga-network/sd-jwt";
import { computeIssuerId as coreIssuerId, pemToDer } from "@tamga-network/core";
import {
  SoftwareKeyProvider,
  MemoryKeyStore,
  signJwt,
  verifyJwt,
  decodeJwt,
  parseOffer,
  issuerMetadataUrl,
  verifyIssuedSdJwt,
  presentSdJwt,
  b64u,
  b64uDecode,
  utf8,
  utf8Decode,
  receiveCredentials,
  newState,
  selectCopy,
  markCopyUsed,
  MemoryWalletStore,
  computeIssuerId,
  assertIssuerAuthorized,
  type DirectoryEntry,
  type ReceiveOptions,
} from "./index.js";

const PKI = resolve(import.meta.dirname, "../../../ops/pki");
const havePki = existsSync(resolve(PKI, "issuer-bilgi.pkcs8.pem"));

describe("b64 / utf8", () => {
  it("gidiş-dönüş ve Türkçe karakterler", () => {
    const s = "İstanbul Bilgi Üniversitesi — ğüşöçı 😀";
    expect(utf8Decode(utf8(s))).toBe(s);
    expect(b64uDecode(b64u(utf8(s)))).toEqual(utf8(s));
    expect(b64u(new Uint8Array([0xfb, 0xff, 0xfe]))).toBe("-__-");
  });
});

describe("SoftwareKeyProvider + JWT", () => {
  it("üretir, imzalar; jose doğrular; farklı ref farklı anahtar (PR6)", async () => {
    const keys = new SoftwareKeyProvider(new MemoryKeyStore(), { platform: "test" });
    const a = await keys.generate("c1.0");
    const b = await keys.generate("c1.1");
    expect(a.x).not.toBe(b.x);
    const jwt = await signJwt(
      { typ: "openid4vci-proof+jwt", jwk: a },
      { aud: "https://issuer.tamga.network/bilgi", nonce: "n", iat: 1 },
      keys,
      "c1.0",
    );
    expect(verifyJwt(jwt, a).payload.nonce).toBe("n");
    const { payload } = await compactVerify(jwt, await importJWK(a as JWK, "ES256"));
    expect(JSON.parse(new TextDecoder().decode(payload)).aud).toBe("https://issuer.tamga.network/bilgi");
    expect(() => verifyJwt(jwt, b)).toThrow();
    expect((await keys.attestation()).level).toBe("W1");
    await keys.delete("c1.0");
    expect(await keys.publicKey("c1.0")).toBeNull();
    await expect(keys.sign("c1.0", new Uint8Array(1))).rejects.toThrow();
  });
});

describe("offer ayrıştırma", () => {
  it("deep link, URL, inline JSON", () => {
    expect(
      parseOffer(
        "openid-credential-offer://?credential_offer_uri=https%3A%2F%2Fissuer.tamga.network%2Fbilgi%2Foffers%2Fabc",
      ).offerUri,
    ).toBe("https://issuer.tamga.network/bilgi/offers/abc");
    expect(parseOffer("https://issuer.tamga.network/bilgi/offers/abc").offerUri).toContain("/offers/abc");
    expect(
      parseOffer('{"credential_issuer":"https://i.test/x","credential_configuration_ids":["v"]}').offer
        ?.credential_issuer,
    ).toBe("https://i.test/x");
    expect(() => parseOffer("hello")).toThrow();
    // bozuk girdi → anlaşılır invalid_offer (çökme değil)
    expect(() => parseOffer('{"credential_issuer":"x","credential_configuration_ids":["v"]}')).toThrow(/malformed/);
    expect(() => parseOffer("{nope")).toThrow(/not JSON/);
    expect(() => parseOffer("openid-credential-offer://?credential_offer=%E0%A4%A")).toThrow(/percent/);
    expect(() => parseOffer("openid-credential-offer://?credential_offer_uri=javascript:alert(1)")).toThrow(
      /web address/,
    );
    expect(issuerMetadataUrl("https://issuer.tamga.network/bilgi")).toBe(
      "https://issuer.tamga.network/.well-known/openid-credential-issuer/bilgi",
    );
    expect(issuerMetadataUrl("http://192.168.1.5:4001/bilgi/")).toBe(
      "http://192.168.1.5:4001/.well-known/openid-credential-issuer/bilgi",
    );
  });
});

describe.skipIf(!havePki)("SD-JWT VC yerel doğrulama + sunum (dev PKI)", () => {
  const leafPem = readFileSync(resolve(PKI, "issuer-bilgi.cert.pem"), "utf8");
  const keyPem = readFileSync(resolve(PKI, "issuer-bilgi.pkcs8.pem"), "utf8");
  const rootPem = readFileSync(resolve(PKI, "root-ca.cert.pem"), "utf8");
  const ISS = "https://issuer.tamga.network/bilgi";
  const VCT = "urn:tamga:edu:DiplomaCredential:1";
  const INTEG = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

  async function issueFor(cnf: JWK, now: number) {
    const signer = await pemIssuerSigner(keyPem, leafPem);
    return issueSdJwtVc({
      signer,
      iss: ISS,
      vct: VCT,
      vctIntegrity: INTEG,
      iat: now,
      cnfJwk: cnf,
      status: { status_list: { idx: 7, uri: "https://status.tamga.network/abc" } },
      claims: { family_name: "Yılmaz", given_name: "Ayşe", is_graduate: true, eqf_level: 6, grade: "3.4" },
      sdPolicy: { grade: "always" },
    });
  }

  it("A1–A5 geçer; issuer_id çekirdekle aynı; cnf eşleşmezse RED; sunum referans doğrulayıcıda ACCEPTED", async () => {
    const keys = new SoftwareKeyProvider(new MemoryKeyStore());
    const now = Math.floor(Date.now() / 1000);
    const cnf = await keys.generate("d.0");
    const other = await keys.generate("d.1");
    const issued = await issueFor(cnf as JWK, now);
    const v = verifyIssuedSdJwt(issued.combined, { expectedCnf: cnf, catalogueHash: () => INTEG, now });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.checks).toEqual(["A1", "A2", "A3", "A4", "A5", "B4"]);
    expect(v.claims.given_name).toBe("Ayşe");
    expect(v.claims.grade).toBe("3.4");
    expect(v.issuerId).toBe(coreIssuerId("TR", pemToDer(leafPem)));
    expect(computeIssuerId("TR", pemToDer(leafPem))).toBe(v.issuerId);
    expect(v.status?.status_list.idx).toBe(7);
    // yanlış anahtar / katalog hash / bozuk imza
    expect(verifyIssuedSdJwt(issued.combined, { expectedCnf: other, now }).ok).toBe(false);
    const bad = verifyIssuedSdJwt(issued.combined, { catalogueHash: () => "sha256-zzz", now });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.failedStep).toBe("B4");
    const tampered = issued.combined.replace(
      /^([^~.]+\.[^.]+\.)([A-Za-z0-9_-]{4})/,
      (_m, a, s) => a + (s[0] === "A" ? "B" : "A") + s.slice(1),
    );
    expect(verifyIssuedSdJwt(tampered, { now }).ok).toBe(false);
    // sunum: grade gizli, KB-JWT cüzdan anahtarıyla → referans doğrulayıcı (jose + x509 zincir) kabul eder
    const AUD = "x509_san_dns:verify.tamga.network";
    const pres = await presentSdJwt({
      combined: issued.combined,
      discloseClaims: ["is_graduate", "eqf_level", "family_name"],
      keys,
      keyRef: "d.0",
      aud: AUD,
      nonce: "n1",
      iat: now,
    });
    const ref = await verifySdJwtVc(pres, {
      aud: AUD,
      nonce: "n1",
      stateCode: "TR",
      rootCertsDer: [pemToDer(rootPem)],
      now,
    });
    expect(ref.ok).toBe(true);
    if (!ref.ok) return;
    expect(ref.claims.grade).toBeUndefined();
    expect(ref.claims.family_name).toBe("Yılmaz");
    expect(ref.issuerId).toBe(v.issuerId);
    // yanlış nonce → RED (A6)
    expect((await verifySdJwtVc(pres, { aud: AUD, nonce: "n2", stateCode: "TR", now })).ok).toBe(false);
    expect(decodeJwt(pres.split("~").pop()!).header.typ).toBe("kb+jwt");
  });

  it("depo: receiveCredentials doğrular ve ekler; WL5 yapışkan kopya seçimi", async () => {
    const keys = new SoftwareKeyProvider(new MemoryKeyStore());
    const now = Math.floor(Date.now() / 1000);
    const copies = [];
    for (let i = 0; i < 3; i++) {
      const cnf = await keys.generate(`e.${i}`);
      copies.push({ combined: (await issueFor(cnf as JWK, now)).combined, keyRef: `e.${i}`, cnf });
    }
    const out = {
      credentialIssuer: ISS,
      vct: VCT,
      issuedAt: now,
      copies,
      metadata: {
        credential_issuer: ISS,
        credential_endpoint: ISS + "/credential",
        credential_configurations_supported: {
          [VCT]: { format: "dc+sd-jwt", display: [{ name: "Diploma", locale: "tr-TR" }] },
        },
      },
    };
    const store = new MemoryWalletStore();
    let state = newState("inst-1");
    const r = receiveCredentials(state, out, { now });
    state = r.state;
    await store.save(state);
    expect(r.credential.typeName).toBe("Diploma");
    expect(r.credential.copies.length).toBe(3);
    expect(r.credential.disclosureNames).toContain("grade");
    const c1 = selectCopy(r.credential, "rp-a")!;
    state = markCopyUsed(state, r.credential.id, c1.keyRef, "rp-a");
    const cred = state.credentials[0];
    expect(selectCopy(cred, "rp-a")!.keyRef).toBe(c1.keyRef); // aynı verifier → aynı kopya
    expect(selectCopy(cred, "rp-b")!.keyRef).not.toBe(c1.keyRef); // yeni verifier → yeni kopya
    // kopyalardan biri başka anahtara bağlıysa set reddedilir
    const wrong = { ...out, copies: [{ ...copies[0], cnf: copies[1].cnf }] };
    expect(() => receiveCredentials(newState("x"), wrong, { now })).toThrow(/A3/);
    // isteğe bağlı güven denetimi: iss = teklifin credential_issuer'ı ve kurum listede (C1)
    const id = r.credential.issuerId;
    const trust = (ans: "YES" | "NO" | "UNKNOWN") =>
      ({ isCredentialAcceptable: (x: string) => (x === id ? ans : "NO") }) as unknown as NonNullable<
        ReceiveOptions["trust"]
      >;
    expect(receiveCredentials(newState("x"), out, { now, trust: trust("YES") }).credential.issuerId).toBe(id);
    expect(() => receiveCredentials(newState("x"), out, { now, trust: trust("NO") })).toThrow(/trusted list/);
    expect(() => receiveCredentials(newState("x"), out, { now, trust: trust("UNKNOWN") })).toThrow(/later/);
    const otherIss = { ...out, credentialIssuer: "https://evil.example/x" };
    expect(() => receiveCredentials(newState("x"), otherIss, { now, trust: trust("YES") })).toThrow(
      /credential_issuer/,
    );
  });

  it("seçici açıklanamaz ad disclosure olarak gelirse yerel doğrulama A5 RED (status, iss, __proto__)", async () => {
    const keys = new SoftwareKeyProvider(new MemoryKeyStore());
    const cnf = await keys.generate("n.0");
    const signer = await pemIssuerSigner(keyPem, leafPem);
    const now = Math.floor(Date.now() / 1000);
    for (const name of ["status", "iss", "__proto__"]) {
      const ds = [makeDisclosure(name, { x: 1 }), makeDisclosure("is_graduate", true)];
      const body = { iss: ISS, vct: VCT, "vct#integrity": INTEG, iat: now, cnf: { jwk: cnf }, _sd_alg: "sha-256" };
      const payload = { ...body, _sd: ds.map((d) => d.digest).sort() };
      const header = { alg: "ES256", typ: "dc+sd-jwt", x5c: signer.x5c.map((d) => Buffer.from(d).toString("base64")) };
      const jwt = await signer.sign(header, new TextEncoder().encode(JSON.stringify(payload)));
      const r = verifyIssuedSdJwt([jwt, ...ds.map((d) => d.disclosure), ""].join("~"), { now });
      expect(r.ok, name).toBe(false);
      if (!r.ok) expect(r.failedStep).toBe("A5");
    }
  });
});

describe("alma anı güven denetimi (assertIssuerAuthorized)", () => {
  const entry = (over: Partial<DirectoryEntry> = {}): DirectoryEntry => ({
    slug: "bilgi",
    legalName: "İstanbul Bilgi Üniversitesi",
    category: "EDUCATION",
    klass: "EAA",
    assurance: "I2",
    issuerUrl: "https://issuer.tamga.network/bilgi",
    issuerId: "0x" + "ab".repeat(32),
    status: "ACTIVE",
    vcts: ["urn:tamga:edu:DiplomaCredential:1"],
    isIdentityProvider: false,
    ...over,
  });
  const VCT = "urn:tamga:edu:DiplomaCredential:1";
  it("kayıtlı, ACTIVE ve yetkili issuer kabul", () => {
    expect(assertIssuerAuthorized([entry()], "0x" + "AB".repeat(32), VCT).slug).toBe("bilgi");
  });
  it("listede yok / ACTIVE değil / tip yetkisi yok → trust_error", () => {
    expect(() => assertIssuerAuthorized([entry()], "0x" + "cd".repeat(32), VCT)).toThrow(/not registered/);
    expect(() => assertIssuerAuthorized([entry({ status: "SUSPENDED" })], entry().issuerId, VCT)).toThrow(/SUSPENDED/);
    expect(() => assertIssuerAuthorized([entry({ vcts: [] })], entry().issuerId, VCT)).toThrow(/not authorised/);
  });
});
