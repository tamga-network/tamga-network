/**
 * wallet-core birim testleri: anahtar/imza (jose ile çapraz doğrulama), offer ayrıştırma, metadata URL,
 * ihraç edilmiş SD-JWT VC yerel doğrulama (A1–A5 + cnf) ve sunum → @tamga-network/sd-jwt verifySdJwtVc (referans doğrulayıcı) ile kabul.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { createPrivateKey, randomBytes } from "node:crypto";
import { issueMdoc } from "@tamga-network/mdoc";
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
  computeSchemaId,
  assertIssuerAuthorized,
  type DirectoryEntry,
  type ReceiveOptions,
} from "./index.js";
import { epochSeconds } from "@tamga-network/core";

const PKI = resolve(import.meta.dirname, "../../../ops/pki");
const havePki = existsSync(resolve(PKI, "issuer-bilgi.pkcs8.pem"));

describe("b64 / utf8", () => {
  it("gidiş-dönüş ve Türkçe karakterler", () => {
    const s = "Örnek Üniversitesi — ğüşöçı 😀";
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
      { aud: "https://issuer.tamga.network/example-university", nonce: "n", iat: 1 },
      keys,
      "c1.0",
    );
    expect(verifyJwt(jwt, a).payload.nonce).toBe("n");
    const { payload } = await compactVerify(jwt, await importJWK(a as JWK, "ES256"));
    expect(JSON.parse(new TextDecoder().decode(payload)).aud).toBe("https://issuer.tamga.network/example-university");
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
        "openid-credential-offer://?credential_offer_uri=https%3A%2F%2Fissuer.tamga.network%2Fexample-university%2Foffers%2Fabc",
      ).offerUri,
    ).toBe("https://issuer.tamga.network/example-university/offers/abc");
    expect(parseOffer("https://issuer.tamga.network/example-university/offers/abc").offerUri).toContain("/offers/abc");
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
    expect(issuerMetadataUrl("https://issuer.tamga.network/example-university")).toBe(
      "https://issuer.tamga.network/.well-known/openid-credential-issuer/example-university",
    );
    expect(issuerMetadataUrl("http://192.168.1.5:4001/example-university/")).toBe(
      "http://192.168.1.5:4001/.well-known/openid-credential-issuer/example-university",
    );
  });
});

describe("ikinci inceleme 0.8.3 — parseOffer http şemasını varsayılan olarak reddeder", () => {
  const inline = (iss: string) => `{"credential_issuer":"${iss}","credential_configuration_ids":["v"]}`;
  it("http teklif adresi, http `credential_offer_uri` ve http `credential_issuer` reddedilir", () => {
    expect(() => parseOffer("http://issuer.example/offers/abc")).toThrow(/https/);
    expect(() =>
      parseOffer("openid-credential-offer://?credential_offer_uri=http%3A%2F%2Fissuer.example%2Foffers%2Fabc"),
    ).toThrow(/https/);
    expect(() => parseOffer(inline("http://issuer.example/x"))).toThrow(/https/);
    expect(() =>
      parseOffer(
        `openid-credential-offer://?credential_offer=${encodeURIComponent(inline("http://192.168.1.5:4001/x"))}`,
      ),
    ).toThrow(/https/);
  });
  it("`allowLocalDevHost`: yalnız yerel geliştirme adresine http; internetteki ada yine ret", () => {
    const dev = { allowLocalDevHost: true };
    expect(parseOffer("http://192.168.1.5:4001/example-university/offers/abc", dev).offerUri).toContain("/offers/abc");
    expect(parseOffer("http://localhost:4001/offers/abc", dev).offerUri).toContain("/offers/abc");
    expect(parseOffer(inline("http://issuer.test/x"), dev).offer?.credential_issuer).toBe("http://issuer.test/x");
    expect(() => parseOffer("http://issuer.example/offers/abc", dev)).toThrow(/https/);
    expect(() => parseOffer(inline("http://issuer.example/x"), dev)).toThrow(/https/);
    // https her zaman
    expect(parseOffer("https://issuer.tamga.network/offers/abc").offerUri).toContain("/offers/abc");
  });
});

describe.skipIf(!havePki)("SD-JWT VC yerel doğrulama + sunum (dev PKI)", () => {
  const leafPem = readFileSync(resolve(PKI, "issuer-bilgi.cert.pem"), "utf8");
  const keyPem = readFileSync(resolve(PKI, "issuer-bilgi.pkcs8.pem"), "utf8");
  const rootPem = readFileSync(resolve(PKI, "root-ca.cert.pem"), "utf8");
  const ISS = "https://issuer.tamga.network/example-university";
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

  it("toplu kopya tutarlılığı (ARF ISSU_11a/11b, 0.8.9): değer, geçerlilik ya da mdoc kopyası farklıysa paket reddedilir", async () => {
    const keys = new SoftwareKeyProvider(new MemoryKeyStore());
    const now = Math.floor(Date.now() / 1000);
    const signer = await pemIssuerSigner(keyPem, leafPem);
    const BASE = { family_name: "Yılmaz", given_name: "Ayşe", is_graduate: true, eqf_level: 6, grade: "3.4" };
    const issueSd = async (cnf: JWK, o: { claims?: Record<string, unknown>; exp?: number; idx?: number } = {}) =>
      (
        await issueSdJwtVc({
          signer,
          iss: ISS,
          vct: VCT,
          vctIntegrity: INTEG,
          iat: now,
          ...(o.exp !== undefined ? { exp: o.exp } : {}),
          cnfJwk: cnf,
          status: { status_list: { idx: o.idx ?? 7, uri: "https://status.tamga.network/abc" } },
          claims: o.claims ?? BASE,
          sdPolicy: { grade: "always" },
        })
      ).combined;
    // mdoc kopyası aynı kurum anahtarı ve sertifikasıyla; `extra` SD-JWT'de yok (MD1 onu denetlemez)
    const issuerSk = new Uint8Array(Buffer.from(createPrivateKey(keyPem).export({ format: "jwk" }).d!, "base64url"));
    const point = (j: JWK) => new Uint8Array([4, ...Buffer.from(j.x!, "base64url"), ...Buffer.from(j.y!, "base64url")]);
    const issueM = (cnf: JWK, o: { extra?: string; until?: number } = {}) =>
      b64u(
        issueMdoc({
          docType: VCT,
          namespaces: { [VCT]: { family_name: "Yılmaz", extra: o.extra ?? "a" } },
          deviceKeyRaw: point(cnf),
          issuerSk,
          x5chain: [pemToDer(leafPem)],
          signed: now,
          validFrom: now,
          validUntil: o.until ?? now + 3600,
          randomBytes: (n) => new Uint8Array(randomBytes(n)),
        }).issuerSigned,
      );
    const meta = {
      credential_issuer: ISS,
      credential_endpoint: ISS + "/credential",
      credential_configurations_supported: { [VCT]: { format: "dc+sd-jwt" } },
    };
    let n = 0;
    const copy = async (o: { claims?: Record<string, unknown>; exp?: number; extra?: string; until?: number } = {}) => {
      const ref = `t.${n++}`;
      const cnf = await keys.generate(ref);
      return { combined: await issueSd(cnf as JWK, { ...o, idx: n }), keyRef: ref, cnf, mdoc: issueM(cnf as JWK, o) };
    };
    const receive = async (copies: Array<Awaited<ReturnType<typeof copy>>>) =>
      receiveCredentials(
        newState("x"),
        { credentialIssuer: ISS, vct: VCT, issuedAt: now, copies, metadata: meta },
        { now, trust: "none" },
      );
    // tutarlı paket (iptal sırası ve cihaz anahtarı kopyaya özgü) kabul edilir
    expect((await receive([await copy(), await copy(), await copy()])).credential.copies).toHaveLength(3);
    // alan değeri farklı
    await expect(receive([await copy(), await copy({ claims: { ...BASE, grade: "3.5" } })])).rejects.toThrow(
      /field values differ/,
    );
    // teknik geçerlilik farklı
    await expect(receive([await copy({ exp: now + 7200 }), await copy({ exp: now + 7201 })])).rejects.toThrow(
      /validity differs/,
    );
    // mdoc: SD-JWT'de karşılığı olmayan öğe farklı / geçerlilik bitişi farklı
    await expect(receive([await copy(), await copy({ extra: "b" })])).rejects.toThrow(/mdoc values differ/);
    await expect(receive([await copy(), await copy({ until: now + 7200 })])).rejects.toThrow(/mdoc validity differs/);
  });

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
    // güvenlik turu 2026-10-19: katalog türü tanımıyorsa (undefined) B4 yapılmış sayılmaz
    const unknownType = verifyIssuedSdJwt(issued.combined, { expectedCnf: cnf, catalogueHash: () => undefined, now });
    expect(unknownType.ok && unknownType.checks).toEqual(["A1", "A2", "A3", "A4", "A5"]);
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
      now: epochSeconds(now),
    });
    expect(ref.ok).toBe(true);
    if (!ref.ok) return;
    expect(ref.claims.grade).toBeUndefined();
    expect(ref.claims.family_name).toBe("Yılmaz");
    expect(ref.issuerId).toBe(v.issuerId);
    // yanlış nonce → RED (A6)
    expect(
      (
        await verifySdJwtVc(pres, {
          rootCertsDer: "none",
          aud: AUD,
          nonce: "n2",
          stateCode: "TR",
          now: epochSeconds(now),
        })
      ).ok,
    ).toBe(false);
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
    const r = receiveCredentials(state, out, { now, trust: "none" });
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
    expect(() => receiveCredentials(newState("x"), wrong, { now, trust: "none" })).toThrow(/A3/);
    // güven denetimi: iss = teklifin credential_issuer'ı, kurum listede (C1) ve türe yetkili (C2)
    const id = r.credential.issuerId;
    const trust = (ans: "YES" | "NO" | "UNKNOWN", c2: "YES" | "NO" | "UNKNOWN" = "YES") =>
      ({
        isCredentialAcceptable: (x: string) => (x === id ? ans : "NO"),
        isCredentialSchemaAcceptable: (x: string, schemaId: string) =>
          x === id && schemaId === computeSchemaId(VCT) ? c2 : "NO",
      }) as unknown as Exclude<ReceiveOptions["trust"], "none">;
    expect(receiveCredentials(newState("x"), out, { now, trust: trust("YES") }).credential.issuerId).toBe(id);
    expect(() => receiveCredentials(newState("x"), out, { now, trust: trust("NO") })).toThrow(/trusted list/);
    expect(() => receiveCredentials(newState("x"), out, { now, trust: trust("UNKNOWN") })).toThrow(/later/);
    const otherIss = { ...out, credentialIssuer: "https://evil.example/x" };
    expect(() => receiveCredentials(newState("x"), otherIss, { now, trust: trust("YES") })).toThrow(
      /credential_issuer/,
    );
    // C6-K1 (güvenlik incelemesi 2026-11-18): C2 — listede olup bu türe yetkisi olmayan kurumun belgesi alınmaz
    expect(() => receiveCredentials(newState("x"), out, { now, trust: trust("YES", "NO") })).toThrow(/C2/);
    expect(() => receiveCredentials(newState("x"), out, { now, trust: trust("YES", "UNKNOWN") })).toThrow(/later/);
    // ADR-0093 UL1: kurum kimliği güven kaynağından — başka ülkenin listesindeki kurum o ülkenin kimliğiyle alınır
    const kzId = "0x" + "a".repeat(64);
    const fromKz = {
      resolveIssuerId: () => ({ kind: "found" as const, issuerId: kzId, stateCode: "KZ" }),
      isCredentialAcceptable: (x: string) => (x === kzId ? "YES" : "NO"),
      isCredentialSchemaAcceptable: (x: string) => (x === kzId ? "YES" : "NO"),
    } as unknown as Exclude<ReceiveOptions["trust"], "none">;
    expect(receiveCredentials(newState("x"), out, { now, trust: fromKz }).credential.issuerId).toBe(kzId);
    const twice = {
      ...(trust("YES") as object),
      resolveIssuerId: () => ({ kind: "ambiguous" as const, stateCodes: ["AZ", "TR"] }),
    } as unknown as Exclude<ReceiveOptions["trust"], "none">;
    expect(() => receiveCredentials(newState("x"), out, { now, trust: twice })).toThrow(/several national lists/);
    const down = {
      ...(trust("YES") as object),
      resolveIssuerId: () => ({ kind: "none" as const, unavailableStates: ["KZ"] }),
    } as unknown as Exclude<ReceiveOptions["trust"], "none">;
    expect(() => receiveCredentials(newState("x"), out, { now, trust: down })).toThrow(/later/);
    // C6-K1: güven kaynağı verilmezse (JavaScript çağıran dahil) sessiz kabul yok — yalnız açık "none" atlar
    const untyped = receiveCredentials as unknown as (s: unknown, o: unknown, opt?: unknown) => unknown;
    expect(() => untyped(newState("x"), out, { now })).toThrow(/trust source missing/);
    expect(() => untyped(newState("x"), out)).toThrow(/trust source missing/);
    expect(() => untyped(newState("x"), out, { now, trust: {} })).toThrow(/trust source missing/);
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
    slug: "example-university",
    legalName: "Örnek Üniversitesi",
    category: "EDUCATION",
    klass: "EAA",
    assurance: "I2",
    issuerUrl: "https://issuer.tamga.network/example-university",
    issuerId: "0x" + "ab".repeat(32),
    status: "ACTIVE",
    vcts: ["urn:tamga:edu:DiplomaCredential:1"],
    isIdentityProvider: false,
    ...over,
  });
  const VCT = "urn:tamga:edu:DiplomaCredential:1";
  it("kayıtlı, ACTIVE ve yetkili issuer kabul", () => {
    expect(assertIssuerAuthorized([entry()], "0x" + "AB".repeat(32), VCT).slug).toBe("example-university");
  });
  it("listede yok / ACTIVE değil / tip yetkisi yok → trust_error", () => {
    expect(() => assertIssuerAuthorized([entry()], "0x" + "cd".repeat(32), VCT)).toThrow(/not registered/);
    expect(() => assertIssuerAuthorized([entry({ status: "SUSPENDED" })], entry().issuerId, VCT)).toThrow(/SUSPENDED/);
    expect(() => assertIssuerAuthorized([entry({ vcts: [] })], entry().issuerId, VCT)).toThrow(/not authorised/);
  });
});
