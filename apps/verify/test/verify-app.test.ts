/**
 * Referans verifier uçtan uca (in-process): politika → QR → cüzdan (wallet-core) istek nesnesini alır, doğrular, RP kaydıyla
 * aşırı talep kontrolü yapar, KB-JWT'li sunumu JWE ile POST eder → verifier T0+A–E → ACCEPTED; ikinci gönderim PV10 ile reddedilir.
 * Belge: dev PKI ile @tamga-network/sd-jwt; status token: sahte fetch ile ön çekim önbelleğine (S12).
 */
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { issueSdJwtVc, pemIssuerSigner } from "@tamga-network/sd-jwt";
import { signStatusListToken, StatusBitstring, MIN_CAPACITY } from "@tamga-network/issuer";
import {
  SoftwareKeyProvider,
  MemoryKeyStore,
  parseVpUri,
  fetchRequestObject,
  verifyRequestObject,
  matchDcql,
  parseDcApiRequest,
  checkRp,
  respond,
  newState,
  receiveCredentials,
  encryptJwe,
  utf8,
  jwkToPoint,
  presentPseudonym,
  pseudonymQueryOf,
  clientAttestationPop,
  derivePseudonym,
  stableRpKey,
  makePassKeyProof,
  type Http,
  type RpRecord,
} from "@tamga-network/wallet-core";
import { SignJWT, importPKCS8 } from "jose";
import { derToB64 } from "@tamga-network/core";
import { createHash, createPrivateKey, generateKeyPairSync, randomBytes, sign as cryptoSign } from "node:crypto";
import { pemToDer } from "@tamga-network/core";
import { issueMdoc, encode as cborEncode, type CborValue } from "@tamga-network/mdoc";
import { createPresentationRequest, createRpAssertion, dcqlFromPolicy, pemRpSigner } from "@tamga-network/verifier";
import { buildVerifyApp } from "../src/app.js";
import { jsLit } from "../src/html.js";
import type { VerifyConfig } from "../src/config.js";

const ROOT = resolve(import.meta.dirname, "../../..");
const PKI = resolve(ROOT, "ops/pki");
const DIST = resolve(ROOT, "apps/trust-publisher/dist-test"); // test listesi (test/fixtures/registry; npm run setup)
const ready = existsSync(resolve(PKI, "rp-verify.pkcs8.pem")) && existsSync(resolve(DIST, "lotl.jws"));
const BASE = "http://verify.local";

describe.skipIf(!ready)("apps/verify e2e", () => {
  const cfg: VerifyConfig = {
    publicBase: BASE,
    port: 0,
    clientId: "", // ADR-0034: app imzacının sertifikasından (x509_hash) doldurur
    pkiDir: PKI,
    trustDist: DIST,
    stateCode: "TR",
    trustReloadSec: 60,
    statusPrefetchSec: 60,
    dataDir: join(tmpdir(), "tamga-verify-test-" + process.pid),
    requireRpAuth: false,
  };
  const ISS = "https://issuer.tamga.network/bilgi";
  const VCT = "urn:tamga:edu:DiplomaCredential:1";
  const STATUS_URI = "https://status.tamga.network/feedfacefeedface";
  let app: Awaited<ReturnType<typeof buildVerifyApp>>;
  let statusTok = "";
  const keys = new SoftwareKeyProvider(new MemoryKeyStore());
  beforeAll(async () => {
    const now = Math.floor(Date.now() / 1000);
    const st = await pemIssuerSigner(
      readFileSync(resolve(PKI, "issuer-bilgi-status.pkcs8.pem"), "utf8"),
      readFileSync(resolve(PKI, "issuer-bilgi-status.cert.pem"), "utf8"),
    );
    statusTok = await signStatusListToken({
      signer: st,
      iss: ISS,
      uri: STATUS_URI,
      bitstring: new StatusBitstring(MIN_CAPACITY),
      iat: now,
      ttlSec: 3600,
    });
    // Senaryo politikaları (kampüs, işe alım …) yalnız sandbox vitrininde; test listesi gerçek ağ biçimli → vitrin açıkça açılır
    app = await buildVerifyApp(cfg, { showcase: true, fetchText: async (u) => (u === STATUS_URI ? statusTok : null) });
    await app.statusCache.refresh([STATUS_URI]); // ön çekim (S12)
  });
  const http: Http = async (url, init) => {
    if (!url.startsWith(BASE)) throw new Error("host: " + url);
    const r = await app.inject({
      method: init?.method ?? "GET",
      url: url.slice(BASE.length),
      headers: init?.headers,
      payload: init?.body,
    });
    return { status: r.statusCode, text: async () => r.body };
  };

  it("QR → istek → sunum → ACCEPTED; tekrar gönderim reddedilir (PV10); claims ayrı uçta (AP3)", async () => {
    // cüzdanda diploma
    const now = Math.floor(Date.now() / 1000);
    const catalogue = JSON.parse(readFileSync(resolve(ROOT, "packages/schemas/dist/index.json"), "utf8")) as Array<{
      vct: string;
      content_hash: string;
    }>;
    const signer = await pemIssuerSigner(
      readFileSync(resolve(PKI, "issuer-bilgi.pkcs8.pem"), "utf8"),
      readFileSync(resolve(PKI, "issuer-bilgi.cert.pem"), "utf8"),
    );
    const cnf = await keys.generate("w.0");
    const issued = await issueSdJwtVc({
      signer,
      iss: ISS,
      vct: VCT,
      vctIntegrity: catalogue.find((c) => c.vct === VCT)!.content_hash,
      iat: now,
      cnfJwk: cnf as never,
      status: { status_list: { idx: 5, uri: STATUS_URI } },
      claims: {
        family_name: "Yılmaz",
        given_name: "Ayşe",
        birth_date: "2001-05-05",
        awarding_body_name: { "tr-TR": "Bilgi" },
        awarding_body_id: "bilgi",
        awarding_body_country: "TR",
        qualification_title: { "tr-TR": "Bilgisayar Müh." },
        eqf_level: 6,
        isced_f_code: "0613",
        awarding_date: "2025-06-30",
        grade: "3.4",
        is_graduate: true,
        graduated_before: 2026,
      },
      sdPolicy: { grade: "always" },
    });
    const r = receiveCredentials(
      newState("w"),
      {
        credentialIssuer: ISS,
        vct: VCT,
        issuedAt: now,
        copies: [{ combined: issued.combined, keyRef: "w.0", cnf }],
        metadata: {
          credential_issuer: ISS,
          credential_endpoint: ISS + "/credential",
          credential_configurations_supported: { [VCT]: { format: "dc+sd-jwt" } },
        },
      },
      { now },
    );
    // verifier: politika → QR
    const created = (
      await app.inject({
        method: "POST",
        url: "/presentations",
        headers: { accept: "application/json", "content-type": "application/json" },
        payload: { policy_id: "job-application-degree" },
      })
    ).json() as { presentation_id: string; qr_payload: string };
    expect(created.qr_payload).toContain("request_uri=");
    // cüzdan: istek nesnesi
    const uri = parseVpUri(created.qr_payload);
    const req = verifyRequestObject(await fetchRequestObject(uri.requestUri, http), uri.clientId);
    expect(req.responseUri).toBe(`${BASE}/vp/response`);
    const { matches } = matchDcql(req.dcql, r.state.credentials);
    expect(matches.length).toBe(1);
    const rpRec = app.trust().relyingParty(req.clientId) as unknown as RpRecord;
    const chk = checkRp(rpRec, req, matches[0]);
    expect(chk.registered && chk.active && chk.certMatches).toBe(true);
    expect(chk.overAsk).toEqual([]);
    // sunum → JWE → POST
    const copy = matches[0].credential.copies[0];
    const out = await respond({
      request: req,
      matches: [{ match: matches[0], keyRef: copy.keyRef, combined: copy.combined, disclose: matches[0].requested }],
      keys,
      http,
      now,
    });
    expect(out.status).toBe(200);
    expect(out.redirectUri).toContain(`/p/${created.presentation_id}`);
    const res = (await app.inject({ method: "GET", url: `/presentations/${created.presentation_id}` })).json() as {
      outcome: string;
      failed_step: string | null;
      failed_reason: string | null;
      disclosed_claims: string[];
    };
    expect(res.failed_reason).toBeNull();
    expect(res.outcome).toBe("ACCEPTED");
    expect(res.disclosed_claims).toEqual(expect.arrayContaining(["is_graduate", "eqf_level"]));
    expect(JSON.stringify(res)).not.toContain("Yılmaz");
    const cl = (
      await app.inject({ method: "GET", url: `/presentations/${created.presentation_id}/claims` })
    ).json() as { claims: Record<string, unknown> };
    expect(cl.claims.eqf_level).toBe(6);
    // tekrar (aynı nonce) → 400 (PV10)
    const again = await app.inject({
      method: "POST",
      url: "/vp/response",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload:
        "response=eyJhbGciOiJFQ0RILUVTIiwiZW5jIjoiQTEyOEdDTSIsImtpZCI6ImVuYy0" + created.presentation_id + "In0..a.b.c",
    });
    expect(again.statusCode).toBe(400);
    // HTML ekranı
    const html = await app.inject({ method: "GET", url: `/p/${created.presentation_id}` });
    expect(html.body).toContain("ACCEPTED");
    expect(html.body).toContain("What happened in the background");
  });

  it("a3/WL13: geçersiz pass_key → sunum yine ACCEPTED, geçiş kartı verilmez; geçerli kanıtla kart verilir", async () => {
    const now = Math.floor(Date.now() / 1000);
    const SVCT = "urn:tamga:edu:StudentCredential:1";
    const catalogue = JSON.parse(readFileSync(resolve(ROOT, "packages/schemas/dist/index.json"), "utf8")) as Array<{
      vct: string;
      content_hash: string;
    }>;
    const signer = await pemIssuerSigner(
      readFileSync(resolve(PKI, "issuer-bilgi.pkcs8.pem"), "utf8"),
      readFileSync(resolve(PKI, "issuer-bilgi.cert.pem"), "utf8"),
    );
    const run = async (passKey: (nonce: string, clientId: string) => Promise<string>, ref: string) => {
      const cnf = await keys.generate(ref);
      const issued = await issueSdJwtVc({
        signer,
        iss: ISS,
        vct: SVCT,
        vctIntegrity: catalogue.find((c) => c.vct === SVCT)!.content_hash,
        iat: now,
        exp: now + 86400 * 30,
        cnfJwk: cnf as never,
        claims: {
          family_name: "Yılmaz",
          given_name: "Ayşe",
          birth_date: "2001-05-05",
          awarding_body_name: { "tr-TR": "Bilgi" },
          awarding_body_id: "bilgi",
          awarding_body_country: "TR",
          student_status: "ACTIVE",
          enrollment_year: 2022,
          study_level: 6,
          programme_title: { "tr-TR": "Bilgisayar Müh." },
          isced_f_code: "0613",
          is_enrolled: true,
        },
        sdPolicy: {},
      });
      const st = receiveCredentials(
        newState("w"),
        {
          credentialIssuer: ISS,
          vct: SVCT,
          issuedAt: now,
          copies: [{ combined: issued.combined, keyRef: ref, cnf }],
          metadata: {
            credential_issuer: ISS,
            credential_endpoint: ISS + "/credential",
            credential_configurations_supported: { [SVCT]: { format: "dc+sd-jwt" } },
          },
        },
        { now },
      );
      const created = (
        await app.inject({
          method: "POST",
          url: "/presentations",
          headers: { accept: "application/json", "content-type": "application/json" },
          payload: { policy_id: "campus-access" },
        })
      ).json() as { presentation_id: string; qr_payload: string };
      const uri = parseVpUri(created.qr_payload);
      const req = verifyRequestObject(await fetchRequestObject(uri.requestUri, http), uri.clientId);
      expect(req.passGrantOffered).toBe(true);
      const { matches } = matchDcql(req.dcql, st.state.credentials);
      const copy = matches[0].credential.copies[0];
      const out = await respond({
        request: req,
        matches: [{ match: matches[0], keyRef: copy.keyRef, combined: copy.combined, disclose: matches[0].requested }],
        passKey: await passKey(req.nonce, req.clientId),
        keys,
        http,
        now,
      });
      const res = (await app.inject({ method: "GET", url: `/presentations/${created.presentation_id}` })).json() as {
        outcome: string;
        failed_reason: string | null;
      };
      return { out, outcome: res.outcome, reason: res.failed_reason };
    };
    const bad = await run(async () => "not.a.proof", "wl13.s0");
    expect(bad.reason).toBeNull();
    expect(bad.out.status).toBe(200);
    expect(bad.outcome).toBe("ACCEPTED");
    expect(bad.out.passGrant).toBeUndefined();
    await keys.generate("pass.t1");
    const good = await run((nonce, clientId) => makePassKeyProof({ keys, ref: "pass.t1", clientId, nonce }), "wl13.s1");
    expect(good.out.status).toBe(200);
    expect(good.out.passGrant).toBeTruthy();
  });

  it("D11 + ADR-0031: site-signup → takma adla hesap; site-signin → yalnız takma ad; başka siteye türetilmiş / eksik takma ad → RED; kit + QR PNG", async () => {
    const ID_ISS = "https://id.tamga.network";
    const ID_VCT = "urn:tamga:id:IdentityAttestation:1";
    const ID_STATUS = "https://id.tamga.network/status/feedfacefeedface";
    const now = Math.floor(Date.now() / 1000);
    // kimlik servisinin status listesi (sahte fetch) → ön çekim
    const st = await pemIssuerSigner(
      readFileSync(resolve(PKI, "issuer-id-status.pkcs8.pem"), "utf8"),
      readFileSync(resolve(PKI, "issuer-id-status.cert.pem"), "utf8"),
    );
    const idStatusTok = await signStatusListToken({
      signer: st,
      iss: ID_ISS,
      uri: ID_STATUS,
      bitstring: new StatusBitstring(MIN_CAPACITY),
      iat: now,
      ttlSec: 3600,
    });
    const app2 = await buildVerifyApp(cfg, {
      showcase: true,
      fetchText: async (u) => (u === ID_STATUS ? idStatusTok : u === STATUS_URI ? statusTok : null),
    });
    await app2.statusCache.refresh([ID_STATUS]);
    const http2: Http = async (url, init) => {
      const r = await app2.inject({
        method: init?.method ?? "GET",
        url: url.slice(BASE.length),
        headers: init?.headers,
        payload: init?.body,
      });
      return { status: r.statusCode, text: async () => r.body };
    };
    // cüzdanda kimlik belgesi (apps/id'nin verdiği biçimde)
    const catalogue = JSON.parse(readFileSync(resolve(ROOT, "packages/schemas/dist/index.json"), "utf8")) as Array<{
      vct: string;
      content_hash: string;
    }>;
    const signer = await pemIssuerSigner(
      readFileSync(resolve(PKI, "issuer-id.pkcs8.pem"), "utf8"),
      readFileSync(resolve(PKI, "issuer-id.cert.pem"), "utf8"),
    );
    const cnf = await keys.generate("w.id");
    const issued = await issueSdJwtVc({
      signer,
      iss: ID_ISS,
      vct: ID_VCT,
      vctIntegrity: catalogue.find((c) => c.vct === ID_VCT)!.content_hash,
      iat: now,
      exp: now + 365 * 86400,
      cnfJwk: cnf as never,
      status: { status_list: { idx: 7, uri: ID_STATUS } },
      claims: {
        family_name: "Yılmaz",
        given_name: "Ayşe",
        birth_date: "2001-05-05",
        nationality: "TR",
        personal_administrative_number: "10000000147", // TCKN sağlama toplamını geçmez (gerçek numara biçiminde değil)
        document_type: "ID_CARD",
        document_number_hash: "sha256-abc123",
        issuing_country: "TR",
        // (ADR-0031: site politikaları bu alanı artık istemez)
        document_chip_verified: false,
        verification_method: "remote-document-liveness-face",
        age_over_18: true,
      },
      sdPolicy: {
        family_name: "always",
        given_name: "always",
        birth_date: "always",
        nationality: "always",
        personal_administrative_number: "always",
        document_type: "always",
        document_number_hash: "always",
        issuing_country: "always",
        document_chip_verified: "always",
        verification_method: "always",
        age_over_18: "always",
      },
    });
    const wallet = receiveCredentials(
      newState("w2"),
      {
        credentialIssuer: ID_ISS,
        vct: ID_VCT,
        issuedAt: now,
        copies: [{ combined: issued.combined, keyRef: "w.id", cnf }],
        metadata: {
          credential_issuer: ID_ISS,
          credential_endpoint: ID_ISS + "/credential",
          credential_configurations_supported: { [ID_VCT]: { format: "dc+sd-jwt" } },
        },
      },
      { now },
    ).state;

    // ADR-0031: cüzdanın takma ad tohumu (kimlik servisinin verdiği) + cüzdan örneği kanıtı (WIA, dev PKI'nin test cüzdan sağlayıcısı)
    const seed = Buffer.from(randomBytes(32)).toString("base64url");
    const wiaKey = "w.wia";
    const wiaJwk = await keys.generate(wiaKey);
    const wiaSub = Buffer.from(
      createHash("sha256")
        .update(JSON.stringify({ crv: "P-256", kty: "EC", x: wiaJwk.x, y: wiaJwk.y }))
        .digest(),
    ).toString("base64url");
    const wia = await new SignJWT({
      sub: wiaSub,
      cnf: { jwk: wiaJwk },
      wallet_name: "test-wallet",
      wallet_version: "0.1.0",
      client_status: { status: { status_list: { idx: 3, uri: "https://wallet-provider.test/status/wia" } } },
    })
      .setProtectedHeader({
        alg: "ES256",
        typ: "oauth-client-attestation+jwt",
        x5c: [derToB64(pemToDer(readFileSync(resolve(PKI, "wallet-provider.cert.pem"), "utf8")))],
      })
      .setIssuer("https://wallet-provider.test")
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(await importPKCS8(readFileSync(resolve(PKI, "wallet-provider.pkcs8.pem"), "utf8"), "ES256"));
    const wiaRec = {
      jwt: wia,
      sub: wiaSub,
      exp: now + 3600,
      keyRef: wiaKey,
      keyStorage: "software" as const,
      solutionId: "test-wallet",
      provider: "test",
    };
    const seen: string[] = [];

    // site kiti + politika ile sunum; cüzdan yalnızca istenen alanları + bu siteye özel takma adı gönderir
    const present = async (policy: string, o: { rpOverride?: string; noPseudonym?: boolean; expect?: string } = {}) => {
      const created = (
        await app2.inject({
          method: "POST",
          url: "/presentations",
          headers: { accept: "application/json", "content-type": "application/json" },
          payload: { policy_id: policy },
        })
      ).json() as { presentation_id: string; qr_payload: string };
      const png = await app2.inject({ method: "GET", url: `/presentations/${created.presentation_id}/qr.png` });
      expect(png.headers["content-type"]).toContain("image/png");
      const uri = parseVpUri(created.qr_payload);
      const req = verifyRequestObject(await fetchRequestObject(uri.requestUri, http2), uri.clientId);
      const { matches, unmatched } = matchDcql(req.dcql, wallet.credentials);
      expect(unmatched).toEqual([]); // takma ad sorgusu belge sorgusu sayılmaz
      expect(matches.length).toBe(policy === "site-signin" ? 0 : 1);
      if (matches[0]) {
        const chk = checkRp(app2.trust().relyingParty(req.clientId) as unknown as RpRecord, req, matches[0]);
        expect(chk.overAsk).toEqual([]);
      }
      const pq = pseudonymQueryOf(req.dcql);
      expect(pq).toEqual({ id: "pseudonym", mode: "single" });
      const ps = presentPseudonym({
        seed,
        // ADR-0034: cüzdan takma adı sitenin kalıcı kimliğinden (kayıttaki dns_name) türetir
        rpKey: o.rpOverride ?? stableRpKey(req, app2.trust().relyingParty(req.clientId) as unknown as RpRecord),
        index: 0,
        aud: req.clientId,
        nonce: req.nonce,
        wia,
        wiaPop: await clientAttestationPop({ keys, wua: wiaRec, aud: req.clientId }),
        now,
      });
      seen.push(ps.pseudonym);
      const copy = matches[0]?.credential.copies[0];
      const out = await respond({
        request: req,
        matches: matches[0]
          ? [{ match: matches[0], keyRef: copy!.keyRef, combined: copy!.combined, disclose: matches[0].requested }]
          : [],
        ...(o.noPseudonym ? {} : { pseudonym: { queryId: pq!.id, jwt: ps.jwt } }),
        keys,
        http: http2,
        now,
      });
      expect(out.status).toBe(200);
      const res = (await app2.inject({ method: "GET", url: `/presentations/${created.presentation_id}` })).json() as {
        outcome: string;
        failed_reason: string | null;
        disclosed_claims: string[];
      };
      if (o.expect) {
        expect(res.outcome).toBe(o.expect);
        return { id: created.presentation_id, disclosed: res.disclosed_claims, res };
      }
      expect(res.failed_reason).toBeNull();
      expect(res.outcome).toBe("ACCEPTED");
      return { id: created.presentation_id, disclosed: res.disclosed_claims, res };
    };
    const session = (id: string) =>
      app2.inject({
        method: "POST",
        url: "/sample-site/session",
        headers: { "content-type": "application/json" },
        payload: { presentation_id: id },
      });

    const kitRes = await app2.inject({ method: "GET", url: "/tamga-verifier.js" });
    expect(kitRes.headers["content-type"]).toContain("javascript");
    expect(kitRes.body).toContain("TamgaVerifier"); // @tamga-network/verifier/web paketlenmiş (mount, start, passkey)
    expect(kitRes.body).toContain("credentials.create");
    expect((await app2.inject({ method: "GET", url: "/sample-site" })).body).toContain("Sign up with Tamga");

    // giriş: hesap yok → 404
    const login0 = await present("site-signin");
    expect(login0.disclosed).toEqual([]); // hiçbir belge alanı açıklanmadı — yalnız takma ad (PS4)
    expect((await session(login0.id)).statusCode).toBe(404);

    // kayıt: ad + soyad + anahtar → hesap + çerez
    const signup = await present("site-signup");
    expect(signup.disclosed.sort()).toEqual(["family_name", "given_name"]); // belge özeti / TCKN yok (PS4)
    const s1 = await session(signup.id);
    expect(s1.statusCode).toBe(200);
    expect(s1.json()).toMatchObject({ ok: true, new: true, name: "Ayşe Yılmaz" });
    const cookie = String(s1.headers["set-cookie"]).split(";")[0];
    expect((await app2.inject({ method: "GET", url: "/sample-site", headers: { cookie } })).body).toContain("Welcome");
    // Y3 CSRF: form gönderimi ve başka siteden Origin reddedilir (sunum tüketilmeden önce)
    const csrfLogin = await present("site-signin");
    const form = await app2.inject({
      method: "POST",
      url: "/sample-site/session",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: `presentation_id=${csrfLogin.id}`,
    });
    expect(form.statusCode).toBe(403);
    const cross = await app2.inject({
      method: "POST",
      url: "/sample-site/session",
      headers: { "content-type": "application/json", origin: "https://kotu-site.example", host: "verify.local" },
      payload: { presentation_id: csrfLogin.id },
    });
    expect(cross.statusCode).toBe(403);
    // aynı sunumla ikinci oturum → 400
    expect((await session(signup.id)).statusCode).toBe(400);

    // giriş: mevcut hesap
    const login = await present("site-signin");
    const s2 = await session(login.id);
    expect(s2.json()).toMatchObject({ ok: true, new: false });
    // doğrulanmamış sunum → 400
    expect((await session("prs_yok")).statusCode).toBe(400);
    // ADR-0031: başka bir site için türetilmiş takma ad → RED (P1); takma adsız yanıt → RED; oturum açılmaz
    const other = await present("site-signin", { rpOverride: "baska-site.example", expect: "REJECTED" });
    expect((other.res as { failed_step?: string }).failed_step).toBe("P1");
    expect((await session(other.id)).statusCode).toBe(400);
    const none = await present("site-signin", { noPseudonym: true, expect: "REJECTED" });
    expect((await session(none.id)).statusCode).toBe(400);
    // aynı site → aynı takma ad; başka site → farklı (siteler eşleştiremez)
    expect(new Set(seen.slice(0, 3)).size).toBe(1);
    expect(derivePseudonym(seed, "baska-site.example", 0).pseudonym).not.toBe(seen[0]);
    // denetim kaydında kişisel veri yok
    process.env.TAMGA_ADMIN_TOKEN = "t";
    const audit = (await app2.inject({ method: "GET", url: "/audit", headers: { "x-admin-token": "t" } })).body;
    expect(audit).toContain("site.signup");
    expect(audit).not.toContain("Yılmaz");
    expect(audit).not.toContain("abc123");
    expect(audit).not.toContain(seen[0]); // takma ad değeri denetim kaydına yazılmaz

    // ---- D11 adım 2: passkey. Yazılım doğrulayıcı (P-256, "none" attestation) — tarayıcının yaptığını taklit eder.
    const ORIGIN = "http://localhost:4004";
    const pk = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const jwk = pk.publicKey.export({ format: "jwk" }) as { x: string; y: string };
    const credId = randomBytes(16);
    const b64u = (b: Uint8Array | Buffer) => Buffer.from(b).toString("base64url");
    const rpIdHash = createHash("sha256").update("localhost").digest();
    const u32 = (n: number) => Buffer.from([n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
    const clientData = (type: string, challenge: string) =>
      Buffer.from(JSON.stringify({ type, challenge, origin: ORIGIN, crossOrigin: false }));
    const post = (url: string, payload: unknown, headers: Record<string, string> = {}) =>
      app2.inject({
        method: "POST",
        url,
        // passkey uçları aynı site denetimi ister (Origin = Host, JSON)
        headers: { "content-type": "application/json", origin: ORIGIN, host: new URL(ORIGIN).host, ...headers },
        payload: payload as object,
      });

    // oturumsuz passkey kaydı → 401; IP adresinden → 400 (WebAuthn güvenli bağlam)
    expect((await post("/sample-site/passkey/register/options", {})).statusCode).toBe(401);
    // başka siteden (Origin ≠ Host) ya da JSON olmayan istek → 403
    expect((await post("/sample-site/passkey/login/options", {}, { origin: "https://evil.example" })).statusCode).toBe(
      403,
    );
    const cookie2 = String(s2.headers["set-cookie"]).split(";")[0];
    expect(
      (
        await post(
          "/sample-site/passkey/register/options",
          {},
          { cookie: cookie2, origin: "http://192.168.1.100:4004", host: "192.168.1.100:4004" },
        )
      ).statusCode,
    ).toBe(400);

    const regOpt = (await post("/sample-site/passkey/register/options", {}, { cookie: cookie2 })).json() as {
      challenge: string;
      rp: { id: string };
      user: { id: string; name: string };
    };
    expect(regOpt.rp.id).toBe("localhost");
    expect(JSON.stringify(regOpt)).not.toContain("abc123"); // user.id rastgele; belge değeri yok
    const coseKey = new Map<CborValue, CborValue>([
      [1, 2],
      [3, -7],
      [-1, 1],
      [-2, new Uint8Array(Buffer.from(jwk.x, "base64url"))],
      [-3, new Uint8Array(Buffer.from(jwk.y, "base64url"))],
    ]);
    const authDataReg = Buffer.concat([
      rpIdHash,
      Buffer.from([0x45]), // UP | UV | AT
      u32(0),
      Buffer.alloc(16), // aaguid (none)
      Buffer.from([0, credId.length]),
      credId,
      Buffer.from(cborEncode(coseKey)),
    ]);
    const attObj = cborEncode(
      new Map<CborValue, CborValue>([
        ["fmt", "none"],
        ["attStmt", new Map()],
        ["authData", new Uint8Array(authDataReg)],
      ]),
    );
    const reg = await post(
      "/sample-site/passkey/register/verify",
      {
        id: b64u(credId),
        rawId: b64u(credId),
        type: "public-key",
        clientExtensionResults: {},
        response: {
          clientDataJSON: b64u(clientData("webauthn.create", regOpt.challenge)),
          attestationObject: b64u(attObj),
          transports: ["internal"],
        },
      },
      { cookie: cookie2 },
    );
    expect(reg.json()).toMatchObject({ ok: true, passkeys: 1 });
    expect((await app2.inject({ method: "GET", url: "/sample-site", headers: { cookie: cookie2 } })).body).toContain(
      "1 passkey",
    );

    // passkey ile giriş: çerezsiz, sunumsuz — yalnızca imza
    const assert = async (counter: number, tamper = false) => {
      const o = (await post("/sample-site/passkey/login/options", {})).json() as {
        flow: string;
        options: { challenge: string };
      };
      const authData = Buffer.concat([rpIdHash, Buffer.from([0x05]), u32(counter)]);
      const cd = clientData("webauthn.get", o.options.challenge);
      const sig = cryptoSign(
        "sha256",
        Buffer.concat([authData, createHash("sha256").update(cd).digest()]),
        pk.privateKey,
      );
      if (tamper) sig[sig.length - 1] ^= 1;
      return post("/sample-site/passkey/login/verify", {
        flow: o.flow,
        response: {
          id: b64u(credId),
          rawId: b64u(credId),
          type: "public-key",
          clientExtensionResults: {},
          response: { clientDataJSON: b64u(cd), authenticatorData: b64u(authData), signature: b64u(sig) },
        },
      });
    };
    const pl = await assert(1);
    expect(pl.statusCode).toBe(200);
    expect(pl.json()).toMatchObject({ ok: true, name: "Ayşe Yılmaz" });
    const cookie3 = String(pl.headers["set-cookie"]).split(";")[0];
    expect((await app2.inject({ method: "GET", url: "/sample-site", headers: { cookie: cookie3 } })).body).toContain(
      "Welcome",
    );
    // bozuk imza → 401; aynı akış (challenge) ikinci kez → 400
    expect((await assert(2, true)).statusCode).toBe(401);
    const o2 = (await post("/sample-site/passkey/login/options", {})).json() as { flow: string };
    expect((await post("/sample-site/passkey/login/verify", { flow: o2.flow })).statusCode).toBe(400);
    expect((await post("/sample-site/passkey/login/verify", { flow: o2.flow, response: { id: "x" } })).statusCode).toBe(
      400,
    );
    const audit2 = (await app2.inject({ method: "GET", url: "/audit", headers: { "x-admin-token": "t" } })).body;
    expect(audit2).toContain("site.passkey.register");
    expect(audit2).not.toContain(b64u(credId)); // kimlik bilgisi kimliği loglanmaz
  });

  it("K1: turnike sayfası yansıyan XSS — geçersiz grup 400, betiğe gömülen değer </script> kapatamaz", async () => {
    const bad = await app.inject({
      method: "GET",
      url: "/terminal?group=%3C%2Fscript%3E%3Cscript%3Ealert(1)%3C%2Fscript%3E",
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.body).not.toContain("<script>alert");
    const ok = await app.inject({ method: "GET", url: "/terminal?group=bubilet-gate" });
    expect(ok.statusCode).toBe(200);
    expect(ok.body).toContain('terminal_group:"bubilet-gate"');
    expect(jsLit("</script><script>x")).not.toContain("</");
    expect(jsLit("a b")).toBe('"a\\u2028b"');
  });

  it("D12 / D-CRED-5: kimlik mdoc'u (ISO 18013-5) → yalnızca age_over_18 açıklanır → ACCEPTED; başka oturuma tekrar ve sahte cihaz imzası A6'da RED", async () => {
    const ID_ISS = "https://id.tamga.network";
    const ID_VCT = "urn:tamga:id:IdentityAttestation:1";
    const ID_STATUS = "https://id.tamga.network/status/feedfacefeedface";
    const NS = "tamga.id.1";
    const now = Math.floor(Date.now() / 1000);
    const st = await pemIssuerSigner(
      readFileSync(resolve(PKI, "issuer-id-status.pkcs8.pem"), "utf8"),
      readFileSync(resolve(PKI, "issuer-id-status.cert.pem"), "utf8"),
    );
    const idStatusTok = await signStatusListToken({
      signer: st,
      iss: ID_ISS,
      uri: ID_STATUS,
      bitstring: new StatusBitstring(MIN_CAPACITY),
      iat: now,
      ttlSec: 3600,
    });
    const app3 = await buildVerifyApp(cfg, {
      showcase: true,
      fetchText: async (u) => (u === ID_STATUS ? idStatusTok : null),
    });
    await app3.statusCache.refresh([ID_STATUS]);
    const http3: Http = async (url, init) => {
      const r = await app3.inject({
        method: init?.method ?? "GET",
        url: url.slice(BASE.length),
        headers: init?.headers,
        payload: init?.body,
      });
      return { status: r.statusCode, text: async () => r.body };
    };
    // apps/id'nin yaptığı gibi: aynı alanlar + aynı holder anahtarı → SD-JWT + mdoc (MD1/MD2), aynı issuer sertifikası (MD3)
    const idKeyPem = readFileSync(resolve(PKI, "issuer-id.pkcs8.pem"), "utf8");
    const idCertPem = readFileSync(resolve(PKI, "issuer-id.cert.pem"), "utf8");
    const signer = await pemIssuerSigner(idKeyPem, idCertPem);
    const catalogue = JSON.parse(readFileSync(resolve(ROOT, "packages/schemas/dist/index.json"), "utf8")) as Array<{
      vct: string;
      content_hash: string;
    }>;
    const claims = {
      family_name: "Yılmaz",
      given_name: "Ayşe",
      birth_date: "2001-05-05",
      nationality: "TR",
      personal_administrative_number: "10000000147", // TCKN sağlama toplamını geçmez (gerçek numara biçiminde değil)
      document_type: "ID_CARD",
      document_number_hash: "sha256-abc123",
      issuing_country: "TR",
      document_chip_verified: false,
      verification_method: "remote-document-liveness-face",
      age_over_18: true,
    };
    const cnf = await keys.generate("w.mdoc");
    const exp = now + 365 * 86400;
    const sd = await issueSdJwtVc({
      signer,
      iss: ID_ISS,
      vct: ID_VCT,
      vctIntegrity: catalogue.find((c) => c.vct === ID_VCT)!.content_hash,
      iat: now,
      exp,
      cnfJwk: cnf as never,
      status: { status_list: { idx: 9, uri: ID_STATUS } },
      claims,
      sdPolicy: Object.fromEntries(Object.keys(claims).map((k) => [k, "always" as const])),
    });
    const d = (createPrivateKey(idKeyPem).export({ format: "jwk" }) as { d: string }).d;
    const mdoc = issueMdoc({
      docType: ID_VCT,
      namespaces: { [NS]: claims as Record<string, CborValue> },
      deviceKeyRaw: jwkToPoint(cnf),
      issuerSk: new Uint8Array(Buffer.from(d, "base64url")),
      x5chain: [pemToDer(idCertPem)],
      signed: now,
      validFrom: now,
      validUntil: exp,
      randomBytes: (n) => new Uint8Array(Array.from({ length: n }, () => Math.floor(Math.random() * 256))),
      status: { idx: 9, uri: ID_STATUS },
    });
    const wallet = receiveCredentials(
      newState("w3"),
      {
        credentialIssuer: ID_ISS,
        vct: ID_VCT,
        issuedAt: now,
        copies: [
          {
            combined: sd.combined,
            keyRef: "w.mdoc",
            cnf,
            mdoc: Buffer.from(mdoc.issuerSigned).toString("base64url"),
          },
        ],
        metadata: {
          credential_issuer: ID_ISS,
          credential_endpoint: ID_ISS + "/credential",
          credential_configurations_supported: { [ID_VCT]: { format: "dc+sd-jwt" } },
        },
      },
      { now },
    ).state; // çapraz doğrulama (MD1–MD3) burada geçti
    expect(wallet.credentials[0].copies[0].mdoc).toBeTruthy();

    const open = async () => {
      const created = (
        await app3.inject({
          method: "POST",
          url: "/presentations",
          headers: { accept: "application/json", "content-type": "application/json" },
          payload: { policy_id: "age-over-18-mdoc" },
        })
      ).json() as { presentation_id: string; qr_payload: string };
      const uri = parseVpUri(created.qr_payload);
      const req = verifyRequestObject(await fetchRequestObject(uri.requestUri, http3), uri.clientId);
      return { id: created.presentation_id, req };
    };
    const result = async (id: string) =>
      (await app3.inject({ method: "GET", url: `/presentations/${id}` })).json() as {
        outcome: string;
        failed_step: string | null;
        failed_reason: string | null;
        disclosed_claims: string[];
        checks_skipped: string[];
      };

    // 1) mutlu yol: DCQL mso_mdoc → cüzdan eşleşir → DeviceResponse → ACCEPTED
    const s1 = await open();
    expect(s1.req.dcql.credentials[0].format).toBe("mso_mdoc");
    const { matches } = matchDcql(s1.req.dcql, wallet.credentials);
    expect(matches.length).toBe(1);
    expect(matches[0].format).toBe("mso_mdoc");
    expect(matches[0].requested).toEqual(["age_over_18"]);
    const rpRec = app3.trust().relyingParty(s1.req.clientId) as unknown as RpRecord;
    expect(checkRp(rpRec, s1.req, matches[0]).overAsk).toEqual([]);
    const out = await respond({
      request: s1.req,
      matches: [{ match: matches[0], keyRef: "w.mdoc", combined: sd.combined, disclose: matches[0].requested }],
      keys,
      http: http3,
      now,
    });
    expect(out.status).toBe(200);
    const r1 = await result(s1.id);
    expect(r1.failed_reason).toBeNull();
    expect(r1.outcome).toBe("ACCEPTED");
    expect(r1.disclosed_claims).toEqual(["age_over_18"]); // ad, doğum tarihi, TCKN açıklanmadı
    expect(r1.checks_skipped).toEqual(expect.arrayContaining(["B4", "C4"])); // mdoc: vct#integrity ve kategori sinyali yok
    const cl = (await app3.inject({ method: "GET", url: `/presentations/${s1.id}/claims` })).json() as {
      claims: Record<string, unknown>;
    };
    expect(cl.claims).toEqual({ age_over_18: true });
    expect(JSON.stringify(r1)).not.toContain("Yılmaz"); // AP3 / MD4

    // 2) aynı DeviceResponse başka oturuma (farklı nonce) → SessionTranscript uyuşmaz → A6
    const s2 = await open();
    const replay = encryptJwe(utf8(JSON.stringify({ vp_token: out.vpToken, state: s2.req.state })), s2.req.encJwk);
    await app3.inject({
      method: "POST",
      url: "/vp/response",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: `response=${encodeURIComponent(replay)}`,
    });
    const r2 = await result(s2.id);
    expect(r2.outcome).toBe("REJECTED");
    expect(r2.failed_step).toBe("A6");

    // 3) belgeyi kopyalayan, cihaz anahtarı olmayan kişi: kendi anahtarıyla imzalar → A6
    const thief = new SoftwareKeyProvider(new MemoryKeyStore());
    await thief.generate("w.mdoc");
    const s3 = await open();
    const m3 = matchDcql(s3.req.dcql, wallet.credentials).matches[0];
    await respond({
      request: s3.req,
      matches: [{ match: m3, keyRef: "w.mdoc", combined: sd.combined, disclose: m3.requested }],
      keys: thief,
      http: http3,
      now,
    });
    const r3 = await result(s3.id);
    expect(r3.outcome).toBe("REJECTED");
    expect(r3.failed_step).toBe("A6");

    // 3b) ADR-0032: sıfır bilgi ispatı isteği — DCQL mso_mdoc_zk + imzalı listedeki devre; bugünkü cüzdan ZK üretemez → eşleşmez
    // (ZK5: doğrulayıcı age-over-18-mdoc'a döner); ZkDocument olmayan yanıt A1'de reddedilir. Gerçek ispatla doğrulama:
    // packages/verifier/src/zk/zk.test.ts (fikstür).
    const zkCreated = (
      await app3.inject({
        method: "POST",
        url: "/presentations",
        headers: { accept: "application/json", "content-type": "application/json" },
        payload: { policy_id: "age-over-18-zk" },
      })
    ).json() as { presentation_id: string; qr_payload: string };
    const zkUri = parseVpUri(zkCreated.qr_payload);
    const zkReq = verifyRequestObject(await fetchRequestObject(zkUri.requestUri, http3), zkUri.clientId);
    const zq = zkReq.dcql.credentials[0] as unknown as {
      format: string;
      meta: { doctype_value: string; zk_system_type: Array<{ system: string; params: { circuit_hash: string } }> };
    };
    expect(zq.format).toBe("mso_mdoc_zk");
    expect(zq.meta.zk_system_type[0].system).toBe("longfellow-libzk-v1");
    expect(zq.meta.zk_system_type[0].params.circuit_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(matchDcql(zkReq.dcql, wallet.credentials).matches).toEqual([]);
    const notZk = encryptJwe(
      utf8(JSON.stringify({ vp_token: { identity: out.vpToken.identity }, state: zkReq.state })),
      zkReq.encJwk,
    );
    await app3.inject({
      method: "POST",
      url: "/vp/response",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: `response=${encodeURIComponent(notZk)}`,
    });
    const rz = await result(zkCreated.presentation_id);
    expect(rz.outcome).toBe("REJECTED");
    expect(rz.failed_step).toBe("A1");

    // 4) tarayıcı Digital Credentials API'si (OpenID4VP 1.0 Ek A): istek sayfaya, yanıt sayfadan doğrulayıcıya
    const SITE = "https://shop.example";
    const openDc = async () =>
      (
        await app3.inject({
          method: "POST",
          url: "/presentations",
          headers: { accept: "application/json", "content-type": "application/json" },
          payload: { policy_id: "age-over-18-mdoc", dc_api_origin: SITE },
        })
      ).json() as {
        presentation_id: string;
        dc_api_request: { protocol: string; data: { request: string } };
      };
    const d1 = await openDc();
    expect(d1.dc_api_request.protocol).toBe("openid4vp-v1-signed");
    // başka bir site aynı isteği kendi sayfasında kullanamaz (expected_origins)
    expect(() => parseDcApiRequest(d1.dc_api_request, "https://evil.example")).toThrow(/expected_origins/);
    const dreq = parseDcApiRequest(d1.dc_api_request, SITE);
    expect(dreq.responseUri).toBe("");
    const dm = matchDcql(dreq.dcql, wallet.credentials).matches[0];
    const dout = await respond({
      request: dreq,
      matches: [{ match: dm, keyRef: "w.mdoc", combined: sd.combined, disclose: dm.requested }],
      keys,
      http: async () => {
        throw new Error("DC API response must not be POSTed by the wallet");
      },
      now,
    });
    // sayfa yanıtı doğrulayıcıya iletir (basit form POST — ön uçuş yok)
    await app3.inject({
      method: "POST",
      url: "/vp/response",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: `response=${encodeURIComponent(dout.dcApiResponse!.response)}`,
    });
    const rd = await result(d1.presentation_id);
    expect(rd.failed_reason).toBeNull();
    expect(rd.outcome).toBe("ACCEPTED");
    expect(rd.disclosed_claims).toEqual(["age_over_18"]);

    // 5) DC API oturumuna QR akışının (OpenID4VPHandover) imzası → oturum özeti uyuşmaz → A6
    const d2 = await openDc();
    const d2req = parseDcApiRequest(d2.dc_api_request, SITE);
    const wrong = await respond({
      request: { ...d2req, origin: undefined, responseUri: `${BASE}/vp/response` },
      matches: [{ match: dm, keyRef: "w.mdoc", combined: sd.combined, disclose: dm.requested }],
      keys,
      http: http3,
      now,
    });
    expect(wrong.status).toBe(200);
    const rw = await result(d2.presentation_id);
    expect(rw.outcome).toBe("REJECTED");
    expect(rw.failed_step).toBe("A6");
    expect(
      (
        await app3.inject({
          method: "POST",
          url: "/presentations",
          headers: { accept: "application/json", "content-type": "application/json" },
          payload: { policy_id: "age-over-18-mdoc", dc_api_origin: "https://x.example/path" },
        })
      ).statusCode,
    ).toBe(400);
  });

  it("ADR-0017: sıkı kip — RP beyanı, sahiplik, durum jetonu, değerler bir kez; sayfada değer yok; örnek site sunucudan başlatır", async () => {
    const strict = await buildVerifyApp(
      { ...cfg, requireRpAuth: true, dataDir: join(tmpdir(), "tamga-verify-strict-" + process.pid) },
      { showcase: true, fetchText: async (u) => (u === STATUS_URI ? statusTok : null) },
    );
    await strict.statusCache.refresh([STATUS_URI]);
    const httpS: Http = async (url, init) => {
      const r = await strict.inject({
        method: init?.method ?? "GET",
        url: url.slice(BASE.length),
        headers: init?.headers,
        payload: init?.body,
      });
      return { status: r.statusCode, text: async () => r.body };
    };
    const rpSigner = await pemRpSigner(
      readFileSync(resolve(PKI, "rp-verify.pkcs8.pem"), "utf8"),
      readFileSync(resolve(PKI, "rp-verify.cert.pem"), "utf8"),
    );
    const bearer = async () => `Bearer ${await createRpAssertion(rpSigner, BASE)}`;
    const json = { accept: "application/json", "content-type": "application/json" };
    const open = (headers: Record<string, string>) =>
      strict.inject({
        method: "POST",
        url: "/presentations",
        headers,
        payload: { policy_id: "job-application-degree" },
      });

    // beyansız: sunum doğrulayıcının kendi kaydına bağlanır (K5 örüntüsü) — sonuç/değer hiçbir dış çağırana verilmez
    const none = await open(json);
    expect(none.statusCode).toBe(200);
    const selfId = (none.json() as { presentation_id: string }).presentation_id;
    expect((await strict.inject({ method: "GET", url: `/presentations/${selfId}` })).statusCode).toBe(404);
    expect((await strict.inject({ method: "GET", url: `/presentations/${selfId}/claims` })).statusCode).toBe(404);
    // beyanla 200 + status_token; aynı beyan tekrar 401 (jti)
    const auth = await bearer();
    const made = await open({ ...json, authorization: auth });
    expect(made.statusCode).toBe(200);
    const created = made.json() as { presentation_id: string; qr_payload: string; status_token: string };
    expect(created.status_token.length).toBeGreaterThan(16);
    expect((await open({ ...json, authorization: auth })).statusCode).toBe(401);

    const id = created.presentation_id;
    expect((await strict.inject({ method: "GET", url: `/presentations/${id}` })).statusCode).toBe(404);
    expect((await strict.inject({ method: "GET", url: `/presentations/${id}?st=yanlis` })).statusCode).toBe(404);
    expect(
      (await strict.inject({ method: "GET", url: `/presentations/${id}?st=${created.status_token}` })).json(),
    ).toEqual({ state: "PENDING" });
    // HV1/HV2: /p/:id — kimliği bilen ama jetonu olmayan yalnız nötr durumu görür (QR, durum jetonu, iz yok); jetonla tam sayfa
    const anon = await strict.inject({ method: "GET", url: `/p/${id}` });
    expect(anon.statusCode).toBe(200);
    expect(anon.headers["x-robots-tag"]).toContain("noindex");
    expect(anon.body).not.toContain(created.status_token);
    expect(anon.body).not.toContain('class="qr"');
    const withSt = await strict.inject({ method: "GET", url: `/p/${id}?st=${created.status_token}` });
    expect(withSt.body).toContain('class="qr"');
    expect((await strict.inject({ method: "GET", url: `/p/${id}?st=yanlis` })).body).not.toContain('class="qr"');
    // QR'daki kimliği bilen biri çözülemeyen bir yanıtla sunumu tüketemez
    const fakeHdr = Buffer.from(JSON.stringify({ alg: "ECDH-ES", enc: "A128GCM", kid: `enc-${id}` })).toString(
      "base64url",
    );
    const junk = await strict.inject({
      method: "POST",
      url: "/vp/response",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: `response=${fakeHdr}..AAAA.AAAA.AAAA`,
    });
    expect(junk.statusCode).toBe(400);
    expect(
      (await strict.inject({ method: "GET", url: `/presentations/${id}?st=${created.status_token}` })).json(),
    ).toEqual({ state: "PENDING" });

    // cüzdan: diploma sun
    const now = Math.floor(Date.now() / 1000);
    const catalogue = JSON.parse(readFileSync(resolve(ROOT, "packages/schemas/dist/index.json"), "utf8")) as Array<{
      vct: string;
      content_hash: string;
    }>;
    const signer = await pemIssuerSigner(
      readFileSync(resolve(PKI, "issuer-bilgi.pkcs8.pem"), "utf8"),
      readFileSync(resolve(PKI, "issuer-bilgi.cert.pem"), "utf8"),
    );
    const cnf = await keys.generate("s.0");
    const issued = await issueSdJwtVc({
      signer,
      iss: ISS,
      vct: VCT,
      vctIntegrity: catalogue.find((c) => c.vct === VCT)!.content_hash,
      iat: now,
      cnfJwk: cnf as never,
      status: { status_list: { idx: 7, uri: STATUS_URI } },
      claims: {
        family_name: "Yılmaz",
        given_name: "Ayşe",
        birth_date: "2001-05-05",
        awarding_body_name: { "tr-TR": "Bilgi" },
        awarding_body_id: "bilgi",
        awarding_body_country: "TR",
        qualification_title: { "tr-TR": "Bilgisayar Müh." },
        eqf_level: 6,
        isced_f_code: "0613",
        awarding_date: "2025-06-30",
        grade: "3.4",
        is_graduate: true,
        graduated_before: 2026,
      },
      sdPolicy: { grade: "always" },
    });
    const w = receiveCredentials(
      newState("s"),
      {
        credentialIssuer: ISS,
        vct: VCT,
        issuedAt: now,
        copies: [{ combined: issued.combined, keyRef: "s.0", cnf }],
        metadata: {
          credential_issuer: ISS,
          credential_endpoint: ISS + "/credential",
          credential_configurations_supported: { [VCT]: { format: "dc+sd-jwt" } },
        },
      },
      { now },
    );
    const uri = parseVpUri(created.qr_payload);
    const req = verifyRequestObject(await fetchRequestObject(uri.requestUri, httpS), uri.clientId);
    expect(req.onBehalfOf).toBeUndefined(); // sahibi doğrulayıcının kendisi → aracı değil
    const { matches } = matchDcql(req.dcql, w.state.credentials);
    const copy = matches[0].credential.copies[0];
    await respond({
      request: req,
      matches: [{ match: matches[0], keyRef: copy.keyRef, combined: copy.combined, disclose: matches[0].requested }],
      keys,
      http: httpS,
      now,
    });

    // durum jetonu: yalnızca sonuç türü (alan adı yok — K4)
    const view = (
      await strict.inject({ method: "GET", url: `/presentations/${id}?st=${created.status_token}` })
    ).json() as Record<string, unknown>;
    expect(view.outcome).toBe("ACCEPTED");
    expect(view).not.toHaveProperty("disclosed_claims");
    // değerler: beyansız 404; beyanla bir kez; ikinci okuma 410 (K3)
    expect((await strict.inject({ method: "GET", url: `/presentations/${id}/claims` })).statusCode).toBe(404);
    const read = async () =>
      strict.inject({ method: "GET", url: `/presentations/${id}/claims`, headers: { authorization: await bearer() } });
    expect(((await read()).json() as { claims: Record<string, unknown> }).claims.eqf_level).toBe(6);
    expect((await read()).statusCode).toBe(410);
    // sayfa değer göstermez (HV4); jetonsuz bakan sonucu da görmez (HV1/HV2), jetonla sonuç (değersiz) görünür
    const doneAnon = (await strict.inject({ method: "GET", url: `/p/${id}` })).body;
    expect(doneAnon).not.toContain("Yılmaz");
    expect(doneAnon).not.toContain('class="result ACCEPTED"');
    expect(doneAnon).not.toContain("What happened in the background");
    const doneSt = (await strict.inject({ method: "GET", url: `/p/${id}?st=${created.status_token}` })).body;
    expect(doneSt).toContain('class="result ACCEPTED"');
    expect(doneSt).not.toContain("Yılmaz");
    // form yolu: sunumu açan sayfa jetonla yönlenir
    const form = await strict.inject({
      method: "POST",
      url: "/presentations",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: "policy_id=job-application-degree",
    });
    expect(form.statusCode).toBe(302);
    expect(form.headers.location).toMatch(/^\/p\/[^?]+\?st=.+/);
    expect((await strict.inject({ method: "GET", url: form.headers.location as string })).body).toContain('class="qr"');

    // örnek site: sunumu sunucu açar (K5); site dışı politika 400
    const start = (policy: string) =>
      strict.inject({
        method: "POST",
        url: "/sample-site/start",
        headers: { "content-type": "application/json" },
        payload: { policy },
      });
    const st = await start("site-signup");
    expect(st.statusCode).toBe(200);
    expect((st.json() as { status_token?: string }).status_token).toBeTruthy();
    expect((await start("job-application-degree")).statusCode).toBe(400);
  });

  it("ADR-0017 K7: aracı istekte cüzdan asıl RP'yi gösterir, kapsamı onun kaydından alır; kopya asıl RP'ye göre ayrılır", async () => {
    const rpSigner = await pemRpSigner(
      readFileSync(resolve(PKI, "rp-verify.pkcs8.pem"), "utf8"),
      readFileSync(resolve(PKI, "rp-verify.cert.pem"), "utf8"),
    );
    const SITE = `x509_hash:${"S".repeat(43)}`; // ADR-0034
    const pr = await createPresentationRequest({
      signer: rpSigner,
      dcql: dcqlFromPolicy({
        policy_id: "t",
        purpose: { "tr-TR": "t" },
        credentials: [{ id: "diploma", format: "dc+sd-jwt", vct_values: [VCT], required_claims: ["is_graduate"] }],
      } as never),
      responseUri: `${BASE}/vp/response`,
      requestUriBase: `${BASE}/vp/req`,
      onBehalfOf: SITE,
    });
    const req = verifyRequestObject(pr.requestJwt, cfg.clientId);
    expect(req.onBehalfOf).toBe(SITE);
    expect(req.rpKey).toBe(SITE); // kayıt çözülmeden önce asıl sitenin client_id'si
    // K7: aracı ilişkisi iki kayıtta da yazılı (aracı asıl siteyi, site aracıyı listeler)
    const listed = app.trust().relyingParty(cfg.clientId) as unknown as RpRecord;
    const inter = { ...listed, served_relying_parties: ["site.example"] } as RpRecord;
    const match = { queryId: "diploma", credential: { vct: VCT } as never, requested: ["is_graduate"] };
    const site = {
      ...inter,
      client_id: SITE,
      dns_name: "site.example",
      legal_name: "Örnek Site A.Ş.",
      uses_intermediaries: [listed.dns_name],
      scopes: [{ ...inter.scopes[0], vct: VCT, claims: ["is_graduate"] }],
    } as RpRecord;
    const ok = checkRp(inter, req, match, Date.now(), site);
    expect(ok.legalName).toBe("Örnek Site A.Ş.");
    expect(ok.via).toBe(inter.legal_name);
    expect(ok.certMatches).toBe(true);
    expect(ok.overAsk).toEqual([]);
    expect(checkRp(inter, req, match, Date.now(), null).registered).toBe(false); // asıl RP kayıtsız → reddedilir (HV6)
    // WL5 + ADR-0034: kopya ve takma ad aracıya değil asıl sitenin kalıcı alan adına göre
    expect(stableRpKey(req, inter, site)).toBe("site.example");
  });

  it("AP6: scope'u aşan politika 400", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/presentations",
      headers: { accept: "application/json", "content-type": "application/json" },
      payload: { policy_id: "yok" },
    });
    expect(r.statusCode).toBe(400);
  });

  it("kapı sayaçları: yalnız sayı ve neden; yönetici belirteci olmadan 404", async () => {
    const before = process.env.TAMGA_ADMIN_TOKEN;
    process.env.TAMGA_ADMIN_TOKEN = "stats-token";
    try {
      const v = await app.inject({
        method: "POST",
        url: "/terminal/verify",
        payload: { token: "bozuk", terminal_group: "bilgi-campus" },
      });
      expect(v.json().ok).toBe(false);
      expect((await app.inject({ method: "GET", url: "/stats/gates?group=bilgi-campus" })).statusCode).toBe(404);
      const r = await app.inject({
        method: "GET",
        url: "/stats/gates?group=bilgi-campus,<x>&days=7",
        headers: { "x-admin-token": "stats-token" },
      });
      const j = r.json() as {
        groups: string[];
        rows: Array<{ group: string; rejected: number; reasons: Record<string, number> }>;
      };
      expect(j.groups).toEqual(["bilgi-campus"]); // geçersiz grup adı atıldı
      const row = j.rows.find((x) => x.group === "bilgi-campus")!;
      expect(row.rejected).toBeGreaterThanOrEqual(1);
      expect(row.reasons["token unreadable"]).toBeGreaterThanOrEqual(1);
      expect(JSON.stringify(j)).not.toMatch(/pass_id|passId/);
    } finally {
      if (before === undefined) delete process.env.TAMGA_ADMIN_TOKEN;
      else process.env.TAMGA_ADMIN_TOKEN = before;
    }
  });
});
