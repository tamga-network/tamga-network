/** OpenID4VP cüzdan tarafı: JWE (jose ile çözülür), istek nesnesi doğrulama (jose ile imzalanır), DCQL eşleme, RP scope/aşırı talep. */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { SignJWT, importPKCS8, generateKeyPair, exportJWK, compactDecrypt, type JWK } from "jose";
import {
  encryptJwe,
  verifyRequestObject,
  parseVpUri,
  matchDcql,
  checkRp,
  certHasDnsName,
  utf8,
  b64Decode,
  type StoredCredential,
  type RpRecord,
  parseDcApiRequest,
  DC_API_PROTOCOL,
  selectDcql,
  chooseDcqlOption,
  checkDcqlShape,
  PSEUDONYM_FORMAT,
  type DcqlQuery,
} from "./index.js";

const PKI = resolve(import.meta.dirname, "../../../ops/pki");
const havePki = existsSync(resolve(PKI, "rp-verify.pkcs8.pem"));

describe("JWE ECDH-ES/A128GCM (saf TS) → jose", () => {
  it("jose çözer; farklı anahtarla çözemez", async () => {
    const kp = await generateKeyPair("ECDH-ES", { crv: "P-256", extractable: true });
    const pub = { ...(await exportJWK(kp.publicKey)), use: "enc", kid: "k1" } as JWK;
    const jwe = encryptJwe(utf8(JSON.stringify({ vp_token: { d: ["x~y~"] }, state: "s" })), pub as never);
    expect(jwe.split(".").length).toBe(5);
    expect(jwe.split(".")[1]).toBe("");
    const { plaintext, protectedHeader } = await compactDecrypt(jwe, kp.privateKey);
    expect(JSON.parse(new TextDecoder().decode(plaintext)).state).toBe("s");
    expect(protectedHeader.alg).toBe("ECDH-ES");
    expect(protectedHeader.enc).toBe("A128GCM");
    expect(protectedHeader.kid).toBe("k1");
    const other = await generateKeyPair("ECDH-ES", { crv: "P-256" });
    await expect(compactDecrypt(jwe, other.privateKey)).rejects.toThrow();
  });
});

describe("parseVpUri / DCQL / RP", () => {
  const cred = (vct: string, claims: Record<string, unknown>): StoredCredential => ({
    id: "c",
    vct,
    typeName: "t",
    issuer: "i",
    issuerId: "0x1",
    leafFingerprint: "f",
    iat: 1,
    claims,
    disclosureNames: Object.keys(claims),
    copies: [],
    receivedAt: 1,
  });
  it("QR ayrıştırma", () => {
    const r = parseVpUri(
      "openid4vp://?client_id=x509_san_dns%3Averify.tamga.network&request_uri=https%3A%2F%2Fverify.tamga.network%2Fvp%2Freq%2Fprs_1",
    );
    expect(r.clientId).toBe("x509_san_dns:verify.tamga.network");
    expect(r.requestUri).toContain("/vp/req/prs_1");
    expect(() => parseVpUri("openid4vp://?client_id=x")).toThrow(/request_uri/);
  });
  it("matchDcql: vct + values koşulu; eşleşmeyen sorgu unmatched (nedeniyle)", () => {
    const creds = [
      cred("urn:tamga:edu:StudentCredential:1", { is_enrolled: true, awarding_body_name: "B" }),
      cred("urn:tamga:edu:DiplomaCredential:1", { is_graduate: true, eqf_level: 6, grade: "3" }),
    ];
    const q = {
      credentials: [
        {
          id: "diploma",
          format: "dc+sd-jwt",
          meta: { vct_values: ["urn:tamga:edu:DiplomaCredential:1"] },
          claims: [{ path: ["is_graduate"], values: [true] }, { path: ["eqf_level"] }],
        },
        { id: "x", format: "dc+sd-jwt", meta: { vct_values: ["urn:tamga:edu:Other:1"] }, claims: [] },
      ],
    };
    const m = matchDcql(q, creds);
    expect(m.matches[0].requested).toEqual(["is_graduate", "eqf_level"]);
    expect(m.unmatched).toEqual(["x"]);
    expect(m.gaps).toEqual([{ queryId: "x", reason: "no_credential", claims: [] }]);
    const bad = matchDcql(
      {
        credentials: [
          {
            id: "d",
            format: "dc+sd-jwt",
            meta: { vct_values: ["urn:tamga:edu:DiplomaCredential:1"] },
            claims: [{ path: ["is_graduate"], values: [false] }],
          },
        ],
      },
      creds,
    );
    expect(bad.unmatched).toEqual(["d"]);
    expect(bad.gaps[0]).toMatchObject({ queryId: "d", reason: "values", claims: ["is_graduate"] });
  });
  it("C24 / OpenID4VP §6.4.1: claim_sets yoksa istenen alan belgede yoksa belge sorguyu KARŞILAMAZ (eksik alanla gitmez)", () => {
    const DIP = "urn:tamga:edu:DiplomaCredential:1";
    const q: DcqlQuery = {
      credentials: [
        {
          id: "diploma",
          format: "dc+sd-jwt",
          meta: { vct_values: [DIP] },
          claims: [{ path: ["is_graduate"], values: [true] }, { path: ["eqf_level"] }, { path: ["thesis_title"] }],
        },
      ],
    };
    const dip = cred(DIP, { is_graduate: true, eqf_level: 6 });
    const m = matchDcql(q, [dip]);
    expect(m.matches).toEqual([]);
    expect(m.unmatched).toEqual(["diploma"]);
    // neden: belgede thesis_title yok (cüzdan kullanıcıya bunu söyler)
    expect(m.gaps).toEqual([
      { queryId: "diploma", reason: "missing_claims", claims: ["thesis_title"], credential: dip },
    ]);
    const sel = selectDcql(q, m.matches);
    expect(sel).toMatchObject({ ok: false, missing: ["diploma"] });
    // alan belgede varsa eşleşir ve hepsi gönderilir
    const full = matchDcql(q, [cred(DIP, { is_graduate: true, eqf_level: 6, thesis_title: "T" })]);
    expect(full.matches[0].requested).toEqual(["is_graduate", "eqf_level", "thesis_title"]);
    expect(full.gaps).toEqual([]);
  });
  it("C24: isteğe bağlı alan claim_sets ile istenir — belgede yoksa eşleşir, varsa gönderilir", () => {
    const DIP = "urn:tamga:edu:DiplomaCredential:1";
    const q: DcqlQuery = {
      credentials: [
        {
          id: "diploma",
          format: "dc+sd-jwt",
          meta: { vct_values: [DIP] },
          claims: [
            { id: "g", path: ["is_graduate"], values: [true] },
            { id: "l", path: ["eqf_level"] },
            { id: "t", path: ["thesis_title"] },
          ],
          claim_sets: [
            ["g", "l", "t"],
            ["g", "l"],
          ],
        },
      ],
    };
    expect(matchDcql(q, [cred(DIP, { is_graduate: true, eqf_level: 6 })]).matches[0].requested).toEqual([
      "is_graduate",
      "eqf_level",
    ]);
    expect(
      matchDcql(q, [cred(DIP, { is_graduate: true, eqf_level: 6, thesis_title: "T" })]).matches[0].requested,
    ).toEqual(["is_graduate", "eqf_level", "thesis_title"]);
    // zorunlu alan (her kombinasyonda) yoksa yine eşleşmez; neden en yakın kombinasyondan
    const none = matchDcql(q, [cred(DIP, { is_graduate: true })]);
    expect(none.gaps[0]).toMatchObject({ reason: "missing_claims", claims: ["eqf_level"] });
  });
  it("C24: credential_sets seçenekleriyle — eksik alanlı belge seçenek olmaz, öbür seçenek önerilir", () => {
    const q: DcqlQuery = {
      credentials: [
        {
          id: "p",
          format: "dc+sd-jwt",
          meta: { vct_values: ["urn:tamga:test:Passport:1"] },
          claims: [{ path: ["birth_date"] }],
        },
        {
          id: "i",
          format: "dc+sd-jwt",
          meta: { vct_values: ["urn:tamga:test:IdCard:1"] },
          claims: [{ path: ["birth_date"] }],
        },
      ],
      credential_sets: [{ options: [["p"], ["i"]] }],
    };
    // pasaportta doğum tarihi yok → pasaport seçeneği karşılanamaz; kimlik kartı önerilir
    const creds = [
      cred("urn:tamga:test:Passport:1", {}),
      cred("urn:tamga:test:IdCard:1", { birth_date: "2000-01-01" }),
    ];
    const m = matchDcql(q, creds);
    expect(m.unmatched).toEqual(["p"]);
    expect(selectDcql(q, m.matches)).toMatchObject({
      ok: true,
      queryIds: ["i"],
      sets: [{ satisfiable: [1], chosen: 1 }],
    });
    // ikisinde de yoksa zorunlu küme karşılanamaz; neden her sorgu için ayrı
    const m2 = matchDcql(q, [cred("urn:tamga:test:Passport:1", {})]);
    expect(selectDcql(q, m2.matches)).toMatchObject({ ok: false, missing: ["p"] });
    expect(m2.gaps.map((g) => [g.queryId, g.reason, g.claims])).toEqual([
      ["p", "missing_claims", ["birth_date"]],
      ["i", "no_credential", []],
    ]);
  });
  it("matchDcql: aynı türden birden çok belge → alternatives (OIA_11, kullanıcı seçer)", () => {
    const EMAIL = "urn:tamga:contact:EmailAddress:1";
    const creds = [cred(EMAIL, { email: "a@example.com" }), cred(EMAIL, { email: "b@example.com" })];
    const q = {
      credentials: [{ id: "e", format: "dc+sd-jwt", meta: { vct_values: [EMAIL] }, claims: [{ path: ["email"] }] }],
    };
    const m = matchDcql(q, creds);
    expect(m.matches[0].credential.claims.email).toBe("a@example.com");
    expect(m.matches[0].alternatives?.map((x) => x.credential.claims.email)).toEqual([
      "a@example.com",
      "b@example.com",
    ]);
    expect(matchDcql(q, creds.slice(0, 1)).matches[0].alternatives).toBeUndefined();
  });
  // OpenID4VP 1.0 §6: claim_sets / credential_sets — yalnız seçilen seçenek gider (en az veri), zorunlu / isteğe bağlı ayrımı
  const PASS = "urn:tamga:test:Passport:1",
    IDC = "urn:tamga:test:IdCard:1",
    BILL = "urn:tamga:test:UtilityBill:1";
  const sd = (id: string, vct: string, claims: DcqlQuery["credentials"][number]["claims"] = []) => ({
    id,
    format: "dc+sd-jwt",
    meta: { vct_values: [vct] },
    claims,
  });
  it("claim_sets: karşılanabilen İLK kombinasyon istenir, öbür alanlar gitmez", () => {
    const q: DcqlQuery = {
      credentials: [
        {
          ...sd("addr", IDC, [
            { id: "street", path: ["street"] },
            { id: "city", path: ["city"] },
            { id: "postal", path: ["postal_code"] },
          ]),
          claim_sets: [
            ["street", "city", "postal"],
            ["postal", "city"],
          ],
        },
      ],
    };
    // tam adres varsa birinci seçenek (doğrulayıcının tercihi) — üç alan
    const full = matchDcql(q, [cred(IDC, { street: "S", city: "C", postal_code: "P" })]);
    expect(full.matches[0].requested).toEqual(["street", "city", "postal_code"]);
    // sokak yoksa ikinci seçenek (sokak gönderilmez)
    const part = matchDcql(q, [cred(IDC, { city: "C", postal_code: "P" })]);
    expect(part.matches[0].requested).toEqual(["postal_code", "city"]);
    // hiçbir seçenek karşılanamıyorsa belge eşleşmez
    expect(matchDcql(q, [cred(IDC, { city: "C" })]).unmatched).toEqual(["addr"]);
  });
  it("credential_sets yoksa her sorgu zorunlu; biri eksikse ok=false", () => {
    const q: DcqlQuery = { credentials: [sd("p", PASS), sd("i", IDC)] };
    const both = selectDcql(q, matchDcql(q, [cred(PASS, {}), cred(IDC, {})]).matches);
    expect(both).toMatchObject({ ok: true, sets: [], queryIds: ["p", "i"], missing: [] });
    const one = selectDcql(q, matchDcql(q, [cred(PASS, {})]).matches);
    expect(one).toMatchObject({ ok: false, missing: ["i"] });
  });
  it("credential_sets: 'pasaport YA DA kimlik' — ikisi de varsa yalnız ilki gider; yalnız biri varsa o yeter", () => {
    const q: DcqlQuery = {
      credentials: [sd("p", PASS), sd("i", IDC), sd("b", BILL)],
      credential_sets: [{ options: [["p"], ["i"]] }, { options: [["b"]], required: false }],
    };
    const all = selectDcql(q, matchDcql(q, [cred(PASS, {}), cred(IDC, {}), cred(BILL, {})]).matches);
    expect(all.ok).toBe(true);
    expect(all.sets[0]).toMatchObject({ required: true, satisfiable: [0, 1], chosen: 0 });
    // isteğe bağlı küme varsayılan olarak paylaşılmaz
    expect(all.sets[1]).toMatchObject({ required: false, satisfiable: [0], chosen: null });
    expect(all.queryIds).toEqual(["p"]);
    // yalnız kimlik kartı: istek yine karşılanır (eskiden "eşleşme yok" hatası)
    const idOnly = selectDcql(q, matchDcql(q, [cred(IDC, {})]).matches);
    expect(idOnly).toMatchObject({ ok: true, queryIds: ["i"] });
    // hiçbiri yoksa zorunlu küme karşılanamaz
    const none = selectDcql(q, matchDcql(q, [cred(BILL, {})]).matches);
    expect(none).toMatchObject({ ok: false, missing: ["p"] });
  });
  it("chooseDcqlOption: kullanıcı seçeneği değiştirir / isteğe bağlıyı açar; geçersiz seçim yok sayılır", () => {
    const q: DcqlQuery = {
      credentials: [sd("p", PASS), sd("i", IDC), sd("b", BILL)],
      credential_sets: [{ options: [["p"], ["i"]] }, { options: [["b"]], required: false }],
    };
    const sel = selectDcql(q, matchDcql(q, [cred(PASS, {}), cred(IDC, {}), cred(BILL, {})]).matches);
    expect(chooseDcqlOption(sel, 0, 1).queryIds).toEqual(["i"]);
    expect(chooseDcqlOption(sel, 1, 0).queryIds).toEqual(["p", "b"]);
    expect(chooseDcqlOption(sel, 0, null)).toBe(sel); // zorunlu küme kapatılamaz
    const noBill = selectDcql(q, matchDcql(q, [cred(PASS, {})]).matches);
    expect(chooseDcqlOption(noBill, 1, 0)).toBe(noBill); // belgesi olmayan seçenek seçilemez
  });
  it("takma ad sorgusu belge gerektirmez: kümede karşılanabilir sayılır", () => {
    const q: DcqlQuery = {
      credentials: [sd("p", PASS), { id: "ps", format: PSEUDONYM_FORMAT }],
      credential_sets: [{ options: [["ps"], ["p"]] }],
    };
    expect(selectDcql(q, matchDcql(q, []).matches)).toMatchObject({ ok: true, queryIds: ["ps"] });
  });
  it("checkDcqlShape: bozuk seçenekler reddedilir", () => {
    const ok: DcqlQuery = {
      credentials: [{ ...sd("a", IDC, [{ id: "x", path: ["x"] }]), claim_sets: [["x"]] }],
      credential_sets: [{ options: [["a"]] }],
    };
    expect(() => checkDcqlShape(ok)).not.toThrow();
    const cases: DcqlQuery[] = [
      { credentials: [sd("a", IDC), sd("a", PASS)] }, // aynı id
      { credentials: [{ ...sd("a", IDC, [{ path: ["x"] }]), claim_sets: [["x"]] }] }, // claim id yok
      { credentials: [{ ...sd("a", IDC, [{ id: "x", path: ["x"] }]), claim_sets: [["y"]] }] }, // olmayan claim id
      { credentials: [{ ...sd("a", IDC), claim_sets: [["x"]] }] }, // claims olmadan claim_sets
      { credentials: [sd("a", IDC)], credential_sets: [{ options: [["b"]] }] }, // olmayan sorgu id
      { credentials: [sd("a", IDC)], credential_sets: [{ options: [] }] }, // boş seçenek
      {
        credentials: [
          {
            id: "m",
            format: "mso_mdoc",
            claims: [
              { id: "a", path: ["ns1", "x"] },
              { id: "b", path: ["ns2", "y"] },
            ],
            claim_sets: [["b"], ["a"]],
          },
        ],
      }, // mdoc: iki namespace
    ];
    for (const c of cases) expect(() => checkDcqlShape(c)).toThrow(/invalid dcql_query/);
  });
  it("checkRp: kayıtlı + scope içi / scope dışı / kayıtsız", () => {
    const rp: RpRecord = {
      client_id: `x509_hash:${"A".repeat(43)}`,
      dns_name: "verify.tamga.network",
      legal_name: "V",
      status: "ACTIVE",
      access_cert_fingerprint_sha256: "ab",
      scopes: [
        {
          scope_id: "s",
          purpose: "p",
          vct: "urn:tamga:edu:DiplomaCredential:1",
          claims: ["is_graduate", "eqf_level"],
          valid_from: "2026-01-01T00:00:00Z",
          valid_until: null,
        },
      ],
    };
    const match = {
      queryId: "d",
      credential: cred("urn:tamga:edu:DiplomaCredential:1", { is_graduate: true, eqf_level: 6, grade: "3" }),
      requested: ["is_graduate", "eqf_level", "grade"],
    };
    const req = { leafFingerprint: "ab" } as never;
    const c = checkRp(rp, req, match);
    expect(c.registered && c.active && c.certMatches).toBe(true);
    expect(c.overAsk).toEqual(["grade"]);
    expect(c.purpose).toBe("p");
    expect(checkRp(null, req, match).registered).toBe(false);
    // taklit: kayıtlı client_id, ama istek başka bir sertifikayla imzalanmış → kayıtlı sayılmaz, kayıtlı ad gösterilmez
    const fake = checkRp(rp, { leafFingerprint: "cd" } as never, match);
    expect(fake.registered).toBe(false);
    expect(fake.impersonation).toBe(true);
    expect(fake.legalName).toBeUndefined();
  });
});

describe.skipIf(!havePki)("İstek nesnesi (jose imzalı, rp-verify x5c) → cüzdan doğrular", () => {
  const certPem = readFileSync(resolve(PKI, "rp-verify.cert.pem"), "utf8");
  const keyPem = readFileSync(resolve(PKI, "rp-verify.pkcs8.pem"), "utf8");
  const x5c = certPem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  // ADR-0034 / HAIP 1.0 §5: x509_hash = base64url(SHA-256(yaprak DER))
  const CID = `x509_hash:${Buffer.from(createHash("sha256").update(Buffer.from(x5c, "base64")).digest()).toString("base64url")}`;
  const base = {
    response_type: "vp_token",
    response_mode: "direct_post.jwt",
    response_uri: "https://verify.tamga.network/vp/response",
    nonce: "n".repeat(24),
    state: "st",
    dcql_query: {
      credentials: [
        {
          id: "d",
          format: "dc+sd-jwt",
          meta: { vct_values: ["urn:tamga:edu:DiplomaCredential:1"] },
          claims: [{ path: ["is_graduate"] }],
        },
      ],
    },
    client_metadata: {
      jwks: { keys: [{ kty: "EC", crv: "P-256", x: "A".repeat(43), y: "B".repeat(43), use: "enc" }] },
    },
  };
  const sign = async (payload: Record<string, unknown>, typ = "oauth-authz-req+jwt") =>
    new SignJWT(payload).setProtectedHeader({ alg: "ES256", typ, x5c: [x5c] }).sign(await importPKCS8(keyPem, "ES256"));
  it("geçerli istek: x509_hash yaprak sertifikayla eşleşir (HAIP 1.0 §5); SAN dns kontrolü", async () => {
    const r = verifyRequestObject(await sign({ client_id: CID, ...base }));
    expect(r.clientIdPrefix).toBe("x509_hash");
    expect(r.nonce.length).toBe(24);
    expect(r.dcql.credentials[0].id).toBe("d");
    expect(certHasDnsName(b64Decode(x5c), "verify.tamga.network")).toBe(true);
    expect(certHasDnsName(b64Decode(x5c), "evil.example")).toBe(false);
    expect(r.clientId).toBe(`x509_hash:${Buffer.from(r.leafFingerprint, "hex").toString("base64url")}`);
    // ADR-0034: x509_san_dns artık kabul edilmez; başka sertifikanın özeti reddedilir
    await expect(
      sign({ client_id: "x509_san_dns:verify.tamga.network", ...base }).then((j) => verifyRequestObject(j)),
    ).rejects.toThrow(/x509_hash required/);
    await expect(
      sign({ client_id: `x509_hash:${"A".repeat(43)}`, ...base }).then((j) => verifyRequestObject(j)),
    ).rejects.toThrow(/does not match/);
  });
  it("Digital Credentials API: imzalı istek + çağıran köken expected_origins'te; imzasız protokol, yanlış mod ve QR yolu reddedilir", async () => {
    const { response_uri: _ru, ...noUri } = base;
    const dc = { client_id: CID, ...noUri, response_mode: "dc_api.jwt" };
    const jwt = await sign({ ...dc, expected_origins: ["https://shop.example"] });
    const r = parseDcApiRequest({ protocol: DC_API_PROTOCOL, data: { request: jwt } }, "https://shop.example");
    expect(r.origin).toBe("https://shop.example");
    expect(r.responseUri).toBe("");
    // bazı platformlar data'yı JSON metni olarak verir
    expect(
      parseDcApiRequest({ protocol: DC_API_PROTOCOL, data: JSON.stringify({ request: jwt }) }, "https://shop.example")
        .origin,
    ).toBe("https://shop.example");
    expect(() =>
      parseDcApiRequest({ protocol: DC_API_PROTOCOL, data: { request: jwt } }, "https://evil.example"),
    ).toThrow(/expected_origins/);
    expect(() => parseDcApiRequest({ protocol: "openid4vp-v1-unsigned", data: {} }, "https://shop.example")).toThrow(
      /protocol/,
    );
    expect(() =>
      parseDcApiRequest({ protocol: DC_API_PROTOCOL, data: { request: jwt } }, "http://shop.example"),
    ).toThrow(/origin/);
    // expected_origins yoksa ya da mod direct_post.jwt ise tarayıcı yolunda kabul edilmez
    const noEo = await sign(dc);
    expect(() =>
      parseDcApiRequest({ protocol: DC_API_PROTOCOL, data: { request: noEo } }, "https://shop.example"),
    ).toThrow(/expected_origins/);
    const post = await sign({
      client_id: CID,
      ...base,
      expected_origins: ["https://shop.example"],
    });
    expect(() =>
      parseDcApiRequest({ protocol: DC_API_PROTOCOL, data: { request: post } }, "https://shop.example"),
    ).toThrow(/dc_api.jwt/);
    // tarayıcı isteği QR ile gelirse açık hata
    expect(() => verifyRequestObject(jwt)).toThrow(/browser/);
  });
  it("profil ihlalleri reddedilir: PE (PV1), şifresiz mod (PV3), redirect_uri (PV6), origin (PV4), x509_hash dışı önek", async () => {
    await expect(
      sign({ client_id: CID, ...base, presentation_definition: {} }).then(verifyRequestObject),
    ).rejects.toThrow(/PV1/);
    await expect(
      sign({ client_id: CID, ...base, response_mode: "direct_post" }).then(verifyRequestObject),
    ).rejects.toThrow(/PV3/);
    await expect(sign({ client_id: "redirect_uri:https://x", ...base }).then(verifyRequestObject)).rejects.toThrow(
      /PV6/,
    );
    await expect(sign({ client_id: "origin:https://x", ...base }).then(verifyRequestObject)).rejects.toThrow(/PV4/);
    await expect(sign({ client_id: "x509_san_dns:evil.example", ...base }).then(verifyRequestObject)).rejects.toThrow(
      /x509_hash required/,
    );
    await expect(sign({ client_id: CID, ...base }, "JWT").then(verifyRequestObject)).rejects.toThrow(/typ/);
    // yanıt adresi imzalayan sertifikanın SAN alan adlarından birine ait olmalı (ADR-0034) (veriler başka sunucuya yönlendirilemez); yerel ağ geliştirme istisnası
    await expect(
      sign({ client_id: CID, ...base, response_uri: "https://evil.example/r" }).then(verifyRequestObject),
    ).rejects.toThrow(/response address/);
    const lan = verifyRequestObject(
      await sign({
        client_id: CID,
        ...base,
        response_uri: "http://192.168.1.100:4004/r",
      }),
    );
    expect(lan.responseUri).toContain("192.168.1.100");
  });
});
