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
  declineRequest,
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
/** Test cüzdanı yerel adrese (verify.local) karşı koşar: wallet-core S11 yerel ağ istisnası açıkça açılır. */
const LAN = { allowLocalDevHost: true } as const;
import { SignJWT, importPKCS8 } from "jose";
import { derToB64 } from "@tamga-network/core";
import { createHash, createPrivateKey, generateKeyPairSync, randomBytes, sign as cryptoSign } from "node:crypto";
import { pemToDer } from "@tamga-network/core";
import {
  buildDeviceResponse,
  deviceSignAsync,
  discloseMdoc,
  issueMdoc,
  encode as cborEncode,
  parseAnnexCRequest,
  sealAnnexCResponse,
  toPidMdocElements,
  type CborValue,
} from "@tamga-network/mdoc";
import { createPresentationRequest, createRpAssertion, dcqlFromPolicy, pemRpSigner } from "@tamga-network/verifier";
import { buildVerifyApp } from "../src/app.js";
import { jsLit } from "../src/html.js";
import type { VerifyConfig } from "../src/config.js";
import { epochMillis } from "@tamga-network/core";
import {
  checkRp as checkRpForTest,
  type Match as MatchForTest,
  type VpRequest as VpRequestForTest,
} from "@tamga-network/wallet-core";
/** ADR-0056 K8: testte `respond` için `checkRp` onayı (kayıtsız doğrulayıcı: engelleyici durum yok). */
const testApproval = (req: VpRequestForTest) =>
  checkRpForTest(null, req, { requested: [] } as unknown as MatchForTest).approval!;

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
    const req = verifyRequestObject(await fetchRequestObject(uri.requestUri, http), uri.clientId, LAN);
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
      approval: testApproval(req),
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
    // 0.6.0: kit DC API'yi varsayılan açtı (dc_api_origin) ama tarayıcı kullanamıyor (Safari + yalnız SD-JWT politikası →
    // org-iso-mdoc yok, düğme çıkmaz): görünen tek yol QR — nesne cihazlar arası, telefondaki cüzdan tamamlar
    const withDc = (
      await app.inject({
        method: "POST",
        url: "/presentations",
        headers: { accept: "application/json", "content-type": "application/json" },
        payload: { policy_id: "job-application-degree", dc_api_origin: "https://shop.example" },
      })
    ).json() as { presentation_id: string; qr_payload: string; dc_api_requests: Array<{ protocol: string }> };
    expect(withDc.dc_api_requests.map((x) => x.protocol)).toEqual(["openid4vp-v1-signed"]);
    const uri2 = parseVpUri(withDc.qr_payload);
    const req2 = verifyRequestObject(await fetchRequestObject(uri2.requestUri, http), uri2.clientId, LAN);
    expect(req2.responseUri).toBe(`${BASE}/vp/response`);
    const m2 = matchDcql(req2.dcql, r.state.credentials).matches[0];
    const out2 = await respond({
      approval: testApproval(req2),
      request: req2,
      matches: [{ match: m2, keyRef: copy.keyRef, combined: copy.combined, disclose: m2.requested }],
      keys,
      http,
      now,
    });
    expect(out2.status).toBe(200);
    const res2 = (await app.inject({ method: "GET", url: `/presentations/${withDc.presentation_id}` })).json() as {
      outcome: string;
      failed_reason: string | null;
    };
    expect(res2.failed_reason).toBeNull();
    expect(res2.outcome).toBe("ACCEPTED");
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
      const req = verifyRequestObject(await fetchRequestObject(uri.requestUri, http), uri.clientId, LAN);
      expect(req.passGrantOffered).toBe(true);
      const { matches } = matchDcql(req.dcql, st.state.credentials);
      const copy = matches[0].credential.copies[0];
      const out = await respond({
        approval: testApproval(req),
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
    // ADR-0031 PS5: WIA iptal listesi (test cüzdan sağlayıcısının imzası; giriş 3 geçerli) — doğrulayıcı takma adla girişte denetler
    const WIA_STATUS = "https://wallet-provider.test/status/wia";
    const wps = await pemIssuerSigner(
      readFileSync(resolve(PKI, "wallet-provider.pkcs8.pem"), "utf8"),
      readFileSync(resolve(PKI, "wallet-provider.cert.pem"), "utf8"),
    );
    const wiaList = (bits: StatusBitstring) =>
      signStatusListToken({
        signer: wps,
        iss: "https://wallet-provider.test",
        uri: WIA_STATUS,
        bitstring: bits,
        iat: now,
        ttlSec: 3600,
      });
    const wiaStatusTok = await wiaList(new StatusBitstring(MIN_CAPACITY));
    let app2 = await buildVerifyApp(cfg, {
      showcase: true,
      fetchText: async (u) =>
        u === ID_STATUS ? idStatusTok : u === STATUS_URI ? statusTok : u === WIA_STATUS ? wiaStatusTok : null,
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
        birthdate: "2001-05-05",
        nationalities: ["TR"],
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
        birthdate: "always",
        nationalities: "always",
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
      const req = verifyRequestObject(await fetchRequestObject(uri.requestUri, http2), uri.clientId, LAN);
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
        approval: testApproval(req),
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
    // ADR-0031 PS5 (güvenlik turu 2026-10-19): cüzdan birimi iptal edildiyse (kayıp telefon) takma adla giriş kabul edilmez
    const revokedBits = new StatusBitstring(MIN_CAPACITY);
    revokedBits.set(3, 1);
    const revokedTok = await wiaList(revokedBits);
    app2 = await buildVerifyApp(cfg, {
      showcase: true,
      fetchText: async (u) => (u === WIA_STATUS ? revokedTok : u === STATUS_URI ? statusTok : null),
    });
    const revoked = await present("site-signin", { expect: "REJECTED" });
    expect(revoked.res.failed_reason).toMatch(/revoked|status/i);
  });

  it("SPEC-PROTO-0002 §10: cüzdan reddi (error+state) sunumu kapatır, neden saklanmaz; başarısız denemeler sunumu açık bırakır, 5'te kapanır", async () => {
    const open = async () => {
      const created = (
        await app.inject({
          method: "POST",
          url: "/presentations",
          headers: { accept: "application/json", "content-type": "application/json" },
          payload: { policy_id: "job-application-degree" },
        })
      ).json() as { presentation_id: string; qr_payload: string };
      const uri = parseVpUri(created.qr_payload);
      return {
        id: created.presentation_id,
        req: verifyRequestObject(await fetchRequestObject(uri.requestUri, http), uri.clientId, LAN),
      };
    };
    const status = async (id: string) =>
      (await app.inject({ method: "GET", url: `/presentations/${id}` })).json() as Record<string, unknown>;
    // 1) wallet-core declineRequest → doğrulayıcı sunumu kapatır; sonuç REJECTED, adım yok, cüzdanın açıklaması yok
    const d = await open();
    const dec = await declineRequest(d.req, http);
    expect(dec.status).toBe(200);
    expect(dec.redirectUri).toContain(`/p/${d.id}`);
    const rd = await status(d.id);
    expect(rd.outcome).toBe("REJECTED");
    expect(rd.failed_step).toBeNull();
    expect(rd.failed_reason).toBe("the wallet declined");
    // kapandı: ikinci red ve şifreli yanıt 400 (PV10); bilinmeyen state 400
    expect((await declineRequest(d.req, http)).status).toBe(400);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/vp/response",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          payload: "error=access_denied&state=yok",
        })
      ).statusCode,
    ).toBe(400);
    // 2) çözülemeyen yanıtlar: sunum açık kalır (PENDING, attempts artar), beşincide REJECTED ile kapanır
    const a = await open();
    const junk =
      Buffer.from(JSON.stringify({ alg: "ECDH-ES", enc: "A128GCM", kid: `enc-${a.id}` })).toString("base64url") +
      ".x.y.z.w";
    for (let i = 1; i <= 4; i++) {
      const r = await app.inject({
        method: "POST",
        url: "/vp/response",
        headers: { "content-type": "application/json" },
        payload: { response: junk },
      });
      expect(r.statusCode).toBe(400);
      const s = await status(a.id);
      expect(s.state).toBe("PENDING");
      expect(s.attempts).toBe(i);
    }
    await app.inject({
      method: "POST",
      url: "/vp/response",
      headers: { "content-type": "application/json" },
      payload: { response: junk },
    });
    const closed = await status(a.id);
    expect(closed.outcome).toBe("REJECTED");
    expect(String(closed.failed_reason)).toMatch(/too many failed responses/);
    // state uyuşmazlığı da sunumu kapatmaz
    const b = await open();
    const wrongState = encryptJwe(
      utf8(JSON.stringify({ vp_token: { diploma: ["x~"] }, state: "baska" })),
      b.req.encJwk,
    );
    const ws = await app.inject({
      method: "POST",
      url: "/vp/response",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: `response=${encodeURIComponent(wrongState)}`,
    });
    expect(ws.statusCode).toBe(400);
    expect((await status(b.id)).state).toBe("PENDING");
    expect(((await status(b.id)).last_attempt as { failed_reason: string }).failed_reason).toBe("state mismatch");
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
      birthdate: "2001-05-05",
      nationalities: ["TR"],
      personal_administrative_number: "10000000147", // TCKN sağlama toplamını geçmez (gerçek numara biçiminde değil)
      document_type: "ID_CARD",
      document_number_hash: "sha256-abc123",
      issuing_country: "TR",
      document_chip_verified: false,
      verification_method: "remote-document-liveness-face",
      age_over_18: true,
      age_over_15: true, // ADR-0064: ikinci eşik; 18 politikası yalnız age_over_18'i açar
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
      namespaces: { [NS]: toPidMdocElements(claims) }, // ADR-0045: AB PID mdoc kodlaması
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

    const open = async (policy_id = "age-over-18-mdoc") => {
      const created = (
        await app3.inject({
          method: "POST",
          url: "/presentations",
          headers: { accept: "application/json", "content-type": "application/json" },
          payload: { policy_id },
        })
      ).json() as { presentation_id: string; qr_payload: string };
      const uri = parseVpUri(created.qr_payload);
      const req = verifyRequestObject(await fetchRequestObject(uri.requestUri, http3), uri.clientId, LAN);
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
      approval: testApproval(s1.req),
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

    // 1b) ADR-0064: age-over-15-mdoc → yalnız age_over_15 istenir ve açılır (tek eşik, YE2); 18 ve doğum tarihi açılmaz
    const s15 = await open("age-over-15-mdoc");
    const m15 = matchDcql(s15.req.dcql, wallet.credentials).matches;
    expect(m15.length).toBe(1);
    expect(m15[0].requested).toEqual(["age_over_15"]);
    expect(
      checkRp(app3.trust().relyingParty(s15.req.clientId) as unknown as RpRecord, s15.req, m15[0]).overAsk,
    ).toEqual([]);
    const o15 = await respond({
      approval: testApproval(s15.req),
      request: s15.req,
      matches: [{ match: m15[0], keyRef: "w.mdoc", combined: sd.combined, disclose: m15[0].requested }],
      keys,
      http: http3,
      now,
    });
    expect(o15.status).toBe(200);
    const r15 = await result(s15.id);
    expect(r15.outcome, r15.failed_reason ?? "").toBe("ACCEPTED");
    expect(r15.disclosed_claims).toEqual(["age_over_15"]);
    const cl15 = (await app3.inject({ method: "GET", url: `/presentations/${s15.id}/claims` })).json() as {
      claims: Record<string, unknown>;
    };
    expect(cl15.claims).toEqual({ age_over_15: true });

    // 2) aynı DeviceResponse başka oturuma (farklı nonce) → SessionTranscript uyuşmaz → A6
    const s2 = await open();
    const replay = encryptJwe(utf8(JSON.stringify({ vp_token: out.vpToken, state: s2.req.state })), s2.req.encJwk);
    await app3.inject({
      method: "POST",
      url: "/vp/response",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: `response=${encodeURIComponent(replay)}`,
    });
    // sahiplik kanıtına ulaşmayan yanıt sunumu TÜKETMEZ: durum PENDING, son deneme A6; gerçek cüzdan hâlâ yanıtlayabilir
    const r2 = (await result(s2.id)) as unknown as {
      state: string;
      attempts: number;
      last_attempt: { failed_step: string | null };
    };
    expect(r2.state).toBe("PENDING");
    expect(r2.attempts).toBe(1);
    expect(r2.last_attempt.failed_step).toBe("A6");
    const m2 = matchDcql(s2.req.dcql, wallet.credentials).matches[0];
    await respond({
      approval: testApproval(s2.req),
      request: s2.req,
      matches: [{ match: m2, keyRef: "w.mdoc", combined: sd.combined, disclose: m2.requested }],
      keys,
      http: http3,
      now,
    });
    expect((await result(s2.id)).outcome).toBe("ACCEPTED");

    // 3) belgeyi kopyalayan, cihaz anahtarı olmayan kişi: kendi anahtarıyla imzalar → A6
    const thief = new SoftwareKeyProvider(new MemoryKeyStore());
    await thief.generate("w.mdoc");
    const s3 = await open();
    const m3 = matchDcql(s3.req.dcql, wallet.credentials).matches[0];
    // doğrulayıcı A6 reddine 400 döner (sunum tüketilmedi); cüzdan çekirdeği bunu hata olarak görür
    await expect(
      respond({
        approval: testApproval(s3.req),
        request: s3.req,
        matches: [{ match: m3, keyRef: "w.mdoc", combined: sd.combined, disclose: m3.requested }],
        keys: thief,
        http: http3,
        now,
      }),
    ).rejects.toThrow(/verifier response 400/);
    const r3 = (await result(s3.id)) as unknown as { state: string; last_attempt: { failed_step: string | null } };
    expect(r3.state).toBe("PENDING"); // A6 reddi sunumu kapatmaz
    expect(r3.last_attempt.failed_step).toBe("A6");

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
    const zkReq = verifyRequestObject(await fetchRequestObject(zkUri.requestUri, http3), zkUri.clientId, LAN);
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
    const rz = (await result(zkCreated.presentation_id)) as unknown as {
      state: string;
      last_attempt: { failed_step: string | null };
    };
    expect(rz.state).toBe("PENDING"); // A1 reddi sunumu kapatmaz
    expect(rz.last_attempt.failed_step).toBe("A1");

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
      approval: testApproval(dreq),
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

    // 4b) DC API açıkken QR / "cüzdanda aç" yolu çalışır: request_uri'deki nesne cihazlar arası (direct_post.jwt + response_uri),
    // DC API'nin nesnesi ayrı (dc_api.jwt + expected_origins); iki yolun anahtarı farklı, nonce/state ortak
    const openBoth = async () => {
      const c = (
        await app3.inject({
          method: "POST",
          url: "/presentations",
          headers: { accept: "application/json", "content-type": "application/json" },
          payload: { policy_id: "age-over-18-mdoc", dc_api_origin: SITE },
        })
      ).json() as {
        presentation_id: string;
        qr_payload: string;
        dc_api_request: { protocol: string; data: { request: string } };
      };
      const uri = parseVpUri(c.qr_payload);
      const qrJwt = await fetchRequestObject(uri.requestUri, http3);
      expect(qrJwt).not.toBe(c.dc_api_request.data.request);
      return {
        id: c.presentation_id,
        qr: verifyRequestObject(qrJwt, uri.clientId, LAN),
        dc: parseDcApiRequest(c.dc_api_request, SITE),
      };
    };
    const answer = (request: Parameters<typeof respond>[0]["request"], http: Http) =>
      respond({
        approval: testApproval(request),
        request,
        matches: [{ match: dm, keyRef: "w.mdoc", combined: sd.combined, disclose: dm.requested }],
        keys,
        http,
        now,
      });
    const postJwe = (jwe: string) =>
      app3.inject({
        method: "POST",
        url: "/vp/response",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        payload: `response=${encodeURIComponent(jwe)}`,
      });
    const noPost: Http = async () => {
      throw new Error("DC API response must not be POSTed by the wallet");
    };
    // yanıtı göndermeden yakalar (QR yolunun JWE'si test içinde başka anahtarla yeniden şifrelenecek)
    const noPostCapture: Http = async () => ({ status: 200, text: async () => "{}" });
    const b1 = await openBoth();
    expect(b1.qr.responseUri).toBe(`${BASE}/vp/response`);
    expect(b1.qr.origin).toBeUndefined();
    expect(b1.dc.responseUri).toBe("");
    expect(b1.qr.nonce).toBe(b1.dc.nonce);
    expect(b1.qr.state).toBe(b1.dc.state);
    expect(b1.qr.encJwk).not.toEqual(b1.dc.encJwk);
    // DC yanıtı hazır ama gönderilmedi; telefon QR'dan tamamlar → ACCEPTED (cihazlar arası oturum özeti)
    const b1Dc = await answer(b1.dc, noPost);
    const b1Qr = await answer(b1.qr, http3);
    expect(b1Qr.status).toBe(200);
    const rb1 = await result(b1.id);
    expect(rb1.failed_reason).toBeNull();
    expect(rb1.outcome).toBe("ACCEPTED");
    // öteki yolun yanıtı artık düşer (tek kullanım iki yol için bir)
    const late = await postJwe(b1Dc.dcApiResponse!.response);
    expect(late.statusCode).toBe(400);
    expect(late.json().error_description).toMatch(/PV10/);
    expect((await result(b1.id)).outcome).toBe("ACCEPTED");
    // ters sıra: DC API tamamlar → QR yanıtı reddedilir
    const b2 = await openBoth();
    const b2Dc = await answer(b2.dc, noPost);
    expect((await postJwe(b2Dc.dcApiResponse!.response)).statusCode).toBe(200);
    expect((await result(b2.id)).outcome).toBe("ACCEPTED");
    await expect(answer(b2.qr, http3)).rejects.toThrow(/verifier response 400/);
    expect((await result(b2.id)).outcome).toBe("ACCEPTED");
    // yol karıştırma: QR (OpenID4VPHandover) imzalı yanıt DC API anahtarıyla şifrelenirse DC kurallarıyla denetlenir → A6
    const b3 = await openBoth();
    const b3Qr = await answer(b3.qr, noPostCapture);
    const mixed = encryptJwe(utf8(JSON.stringify({ vp_token: b3Qr.vpToken, state: b3.dc.state })), b3.dc.encJwk);
    await postJwe(mixed);
    const rb3 = await result(b3.id);
    expect(rb3.outcome).toBe("REJECTED");
    expect(rb3.failed_step).toBe("A6");

    // 5) DC API oturumuna QR akışının (OpenID4VPHandover) imzası → oturum özeti uyuşmaz → A6
    const d2 = await openDc();
    const d2req = parseDcApiRequest(d2.dc_api_request, SITE);
    const wrong = await respond({
      approval: testApproval({ ...d2req, origin: undefined, responseUri: `${BASE}/vp/response` }),
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

    // 6) ISO/IEC 18013-7 Ek C (`org-iso-mdoc`, Safari / iOS 26): ikinci DC API isteği; HPKE şifreli DeviceResponse; oturum
    // dökümü dcapi handover (EncryptionInfo + köken)
    const openMdocDc = async () =>
      (
        await app3.inject({
          method: "POST",
          url: "/presentations",
          headers: { accept: "application/json", "content-type": "application/json" },
          payload: { policy_id: "age-over-18-mdoc", dc_api_origin: SITE },
        })
      ).json() as {
        presentation_id: string;
        dc_api_requests: Array<{ protocol: string; data: unknown }>;
        dc_mdoc_response_uri: string;
      };
    const c1 = await openMdocDc();
    expect(c1.dc_api_requests.map((r) => r.protocol)).toEqual(["openid4vp-v1-signed", "org-iso-mdoc"]);
    expect(c1.dc_mdoc_response_uri).toBe(`${BASE}/vp/dc-mdoc/${c1.presentation_id}`);
    const annexReq = c1.dc_api_requests[1];
    const walletAnswer = async (origin: string, data: unknown) => {
      const a = parseAnnexCRequest(data, origin);
      expect(a.items[0]).toMatchObject({ docType: ID_VCT, nameSpaces: { "tamga.id.1": { age_over_18: false } } });
      const copy = wallet.credentials[0].copies[0];
      const partial = discloseMdoc(Buffer.from(copy.mdoc!, "base64url"), { "tamga.id.1": ["age_over_18"] });
      const devSig = await deviceSignAsync(a.sessionTranscript, ID_VCT, (tbs) => keys.sign("w.mdoc", tbs));
      const dr = buildDeviceResponse({ docType: ID_VCT, issuerSigned: partial, deviceSignature: devSig });
      return sealAnnexCResponse(dr, a).response;
    };
    const postMdoc = (id: string, response: string) =>
      app3.inject({
        method: "POST",
        url: `/vp/dc-mdoc/${id}`,
        headers: { "content-type": "application/x-www-form-urlencoded" },
        payload: `response=${encodeURIComponent(response)}`,
      });
    // başka kökenin dökümüyle şifrelenmiş yanıt açılmaz → 400, sunum tüketilmez
    expect(
      (await postMdoc(c1.presentation_id, await walletAnswer("https://evil.example", annexReq.data))).statusCode,
    ).toBe(400);
    expect((await postMdoc(c1.presentation_id, "bozuk")).statusCode).toBe(400);
    const ok = await postMdoc(c1.presentation_id, await walletAnswer(SITE, annexReq.data));
    expect(ok.statusCode).toBe(200);
    const rc = await result(c1.presentation_id);
    expect(rc.failed_reason).toBeNull();
    expect(rc.outcome).toBe("ACCEPTED");
    expect(rc.disclosed_claims).toEqual(["age_over_18"]);
    // aynı sunuma ikinci yanıt: tek kullanım (PV10)
    expect((await postMdoc(c1.presentation_id, await walletAnswer(SITE, annexReq.data))).statusCode).toBe(400);
    // başka sunumun Ek C yanıtı bu sunuma: döküm (EncryptionInfo) farklı → açılmaz
    const c2 = await openMdocDc();
    expect((await postMdoc(c2.presentation_id, await walletAnswer(SITE, annexReq.data))).statusCode).toBe(400);
    // 7) wallet-core Ek C (0.7.1): aynı onay yolu — parseDcApiRequest (okuyucu imzası bu dökümle) → matchDcql → checkRp → respond
    // (HPKE şifreli DeviceResponse; POST yok) → sayfa yanıtı doğrulayıcıya iletir → ACCEPTED
    const c3 = await openMdocDc();
    const mdocReq = c3.dc_api_requests.find((r) => r.protocol === "org-iso-mdoc")!;
    expect(() => parseDcApiRequest(mdocReq, "https://evil.example")).toThrow(/invalid for this session/);
    const areq = parseDcApiRequest(mdocReq, SITE);
    expect(areq.annexC?.docType).toBe(ID_VCT);
    // okuyucu imzası doğrulayıcının erişim sertifikasıyla: client_id OpenID4VP isteğindekiyle aynı (aynı RP kaydı)
    expect(areq.clientId).toBe(parseDcApiRequest(c3.dc_api_requests[0], SITE).clientId);
    const am = matchDcql(areq.dcql, wallet.credentials).matches[0];
    expect(am.requested).toEqual(["age_over_18"]);
    const aout = await respond({
      approval: testApproval(areq),
      request: areq,
      matches: [{ match: am, keyRef: "w.mdoc", combined: sd.combined, disclose: am.requested }],
      keys,
      http: noPost,
      now,
    });
    expect(aout.dcApiResponse?.response).toMatch(/^[A-Za-z0-9_-]+$/);
    // onay başka isteğe aitse sunum yok (ADR-0056 K8)
    await expect(
      respond({
        approval: testApproval(parseDcApiRequest(mdocReq, SITE)),
        request: parseDcApiRequest((await openMdocDc()).dc_api_requests[1], SITE),
        matches: [{ match: am, keyRef: "w.mdoc", combined: sd.combined, disclose: am.requested }],
        keys,
        http: noPost,
        now,
      }),
    ).rejects.toThrow(/ADR-0056/);
    const posted = await postMdoc(c3.presentation_id, aout.dcApiResponse!.response);
    expect(posted.statusCode).toBe(200);
    const rc3 = await result(c3.presentation_id);
    expect(rc3.failed_reason).toBeNull();
    expect(rc3.outcome).toBe("ACCEPTED");
    expect(rc3.disclosed_claims).toEqual(["age_over_18"]);
    // aynı yanıt OpenID4VP ucuna gönderilirse açılmaz (yol karışmaz)
    const c4 = await openMdocDc();
    const a4 = parseDcApiRequest(c4.dc_api_requests[1], SITE);
    const o4 = await respond({
      approval: testApproval(a4),
      request: a4,
      matches: [{ match: am, keyRef: "w.mdoc", combined: sd.combined, disclose: am.requested }],
      keys,
      http: noPost,
      now,
    });
    expect((await postJwe(o4.dcApiResponse!.response)).statusCode).toBe(400);

    // 8) /dc-api-test (sandbox deneme sayfası): sayfanın sunucusu RP beyanıyla sunum açar; istekler sayfanın kökenine bağlı;
    // iki protokolün yanıtı da doğrulayıcıya iletilir, sonuç (ve sandbox'ta örnek değerler) sayfa jetonuyla okunur
    const LOCAL = "http://localhost:4004";
    const appL = await buildVerifyApp(
      { ...cfg, publicBase: LOCAL, dataDir: join(tmpdir(), "tamga-verify-dctest-" + process.pid) },
      { showcase: true, fetchText: async (u) => (u === ID_STATUS ? idStatusTok : null) },
    );
    await appL.statusCache.refresh([ID_STATUS]);
    const pageRes = await appL.inject({ method: "GET", url: "/dc-api-test" });
    expect(pageRes.statusCode).toBe(200);
    expect(pageRes.body).toContain("navigator.credentials.get");
    expect(pageRes.headers["x-robots-tag"]).toContain("noindex");
    const startT = (body: Record<string, unknown>, headers: Record<string, string> = {}) =>
      appL.inject({
        method: "POST",
        url: "/dc-api-test/start",
        headers: { "content-type": "application/json", ...headers },
        payload: body,
      });
    expect((await startT({ policy: "age-over-18-mdoc", origin: "https://evil.example" })).statusCode).toBe(400);
    expect(
      (await startT({ policy: "age-over-18-mdoc", origin: LOCAL }, { origin: "https://evil.example" })).statusCode,
    ).toBe(400);
    expect((await startT({ policy: "job-application-degree", origin: LOCAL })).statusCode).toBe(400);
    expect((await startT({ policy: "event-tamga-id", protocol: "mdoc", origin: LOCAL })).statusCode).toBe(400);
    expect(
      (
        await appL.inject({
          method: "POST",
          url: "/dc-api-test/start",
          headers: { "content-type": "text/plain" },
          payload: "x",
        })
      ).statusCode,
    ).toBe(415);
    type Started = {
      t: string;
      requests: Array<{ protocol: string; data: unknown }>;
      response_uris: Record<string, string>;
    };
    const both = (await startT({ policy: "age-over-18-mdoc", protocol: "both", origin: LOCAL })).json() as Started;
    expect(both.requests.map((r) => r.protocol)).toEqual(["openid4vp-v1-signed", "org-iso-mdoc"]);
    expect(both).not.toHaveProperty("presentation_id"); // tarayıcıya yalnız sayfa jetonu
    expect((await appL.inject({ method: "GET", url: `/dc-api-test/result/${both.t}` })).json()).toEqual({
      state: "PENDING",
    });
    const pageResult = async (t: string) =>
      (await appL.inject({ method: "GET", url: `/dc-api-test/result/${t}` })).json() as {
        state: string;
        outcome: string;
        failed_reason: string | null;
        claims?: Record<string, unknown> | null;
        disclosed: string[];
        trace: string[];
      };
    const answerVia = async (st: Started, protocol: string) => {
      const dreq = parseDcApiRequest(
        st.requests.find((r) => r.protocol === protocol)!,
        LOCAL,
      );
      const m = matchDcql(dreq.dcql, wallet.credentials).matches[0];
      const o = await respond({
        approval: testApproval(dreq),
        request: dreq,
        matches: [{ match: m, keyRef: "w.mdoc", combined: sd.combined, disclose: m.requested }],
        keys,
        http: noPost,
        now,
      });
      return appL.inject({
        method: "POST",
        url: st.response_uris[protocol].slice(LOCAL.length),
        headers: { "content-type": "application/x-www-form-urlencoded" },
        payload: `response=${encodeURIComponent(o.dcApiResponse!.response)}`,
      });
    };
    expect((await answerVia(both, "org-iso-mdoc")).statusCode).toBe(200);
    const pr1 = await pageResult(both.t);
    expect(pr1.failed_reason).toBeNull();
    expect(pr1).toMatchObject({ state: "DONE", outcome: "ACCEPTED", disclosed: ["age_over_18"] });
    expect(pr1.claims).toMatchObject({ age_over_18: true }); // yerel/sandbox: örnek değerler gösterilir
    expect(pr1.trace.some((x) => /Annex C/.test(x))).toBe(true);
    expect(await pageResult(both.t)).toEqual(pr1); // değerler doğrulayıcıdan bir kez alındı, sayfa kaydında kalır
    const oid = (await startT({ policy: "age-over-18-mdoc", protocol: "openid4vp", origin: LOCAL })).json() as Started;
    expect(oid.requests.map((r) => r.protocol)).toEqual(["openid4vp-v1-signed"]);
    expect((await answerVia(oid, "openid4vp-v1-signed")).statusCode).toBe(200);
    expect((await pageResult(oid.t)).outcome).toBe("ACCEPTED");
    expect((await appL.inject({ method: "GET", url: "/dc-api-test/result/yok" })).statusCode).toBe(404);
    // örnek site: kit sayfa kökenini verir → DC API istekleri; başka köken 400
    const siteStart = (origin: string) =>
      appL.inject({
        method: "POST",
        url: "/sample-site/start",
        headers: { "content-type": "application/json" },
        payload: { policy: "site-signin", dc_api_origin: origin },
      });
    const ss = (await siteStart(LOCAL)).json() as { dc_api_requests?: Array<{ protocol: string }> };
    expect(ss.dc_api_requests?.map((r) => r.protocol)).toEqual(["openid4vp-v1-signed"]);
    expect((await siteStart("https://evil.example")).statusCode).toBe(400);

    // OpenID4VP isteği olmayan (QR) sunumda Ek C yok
    const plain = (
      await app3.inject({
        method: "POST",
        url: "/presentations",
        headers: { accept: "application/json", "content-type": "application/json" },
        payload: { policy_id: "age-over-18-mdoc" },
      })
    ).json() as Record<string, unknown>;
    expect(plain.dc_api_requests).toBeUndefined();
  });

  it("hız sınırı: beyansız sel ortak kovayı tüketse de doğrulanmış RP kendi kovasından sunum açar", async () => {
    const one = { burst: 1, perMin: 1 };
    const app = await buildVerifyApp(
      { ...cfg, requireRpAuth: true, dataDir: join(tmpdir(), "tamga-verify-rl-" + process.pid) },
      { showcase: true, rateRules: { presentations: one } },
    );
    const rpSigner = await pemRpSigner(
      readFileSync(resolve(PKI, "rp-verify.pkcs8.pem"), "utf8"),
      readFileSync(resolve(PKI, "rp-verify.cert.pem"), "utf8"),
    );
    const open = (headers: Record<string, string>) =>
      app.inject({
        method: "POST",
        url: "/presentations",
        headers: { accept: "application/json", "content-type": "application/json", ...headers },
        payload: { policy_id: "job-application-degree" },
      });
    const first = await open({});
    expect(first.statusCode, first.body).toBe(200);
    expect((await open({})).statusCode).toBe(429); // beyansız ortak kova doldu
    const rp = () => createRpAssertion(rpSigner, BASE).then((a) => ({ authorization: `Bearer ${a}` }));
    expect((await open(await rp())).statusCode).toBe(200); // RP'nin kendi kovası
    expect((await open(await rp())).statusCode).toBe(429); // RP'nin kovası da sınırlı
    expect((await open({ authorization: "Bearer bozuk" })).statusCode).toBe(401); // geçersiz beyan jeton harcamaz
    await app.close();
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
    // beyansız istek yalnız doğrulayıcının kendi kökenine DC API isteği alır (başka site doğrulayıcı adına imzalı istek alamaz)
    const dcOpen = (origin: string, headers: Record<string, string> = json) =>
      strict.inject({
        method: "POST",
        url: "/presentations",
        headers,
        payload: { policy_id: "age-over-18-mdoc", dc_api_origin: origin },
      });
    expect((await dcOpen("https://evil.example")).statusCode).toBe(400);
    expect((await dcOpen("https://shop.example", { ...json, authorization: await bearer() })).statusCode).toBe(200);
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
    ).toMatchObject({ state: "PENDING" });
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
    ).toMatchObject({ state: "PENDING" });

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
    const req = verifyRequestObject(await fetchRequestObject(uri.requestUri, httpS), uri.clientId, LAN);
    expect(req.onBehalfOf).toBeUndefined(); // sahibi doğrulayıcının kendisi → aracı değil
    const { matches } = matchDcql(req.dcql, w.state.credentials);
    const copy = matches[0].credential.copies[0];
    await respond({
      approval: testApproval(req),
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
    const req = verifyRequestObject(pr.requestJwt, cfg.clientId, LAN);
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
    const ok = checkRp(inter, req, match, epochMillis(Date.now()), site);
    expect(ok.legalName).toBe("Örnek Site A.Ş.");
    expect(ok.via).toBe(inter.legal_name);
    expect(ok.certMatches).toBe(true);
    expect(ok.overAsk).toEqual([]);
    expect(checkRp(inter, req, match, epochMillis(Date.now()), null).registered).toBe(false); // asıl RP kayıtsız → reddedilir (HV6)
    // WL5 + ADR-0034: kopya ve takma ad aracıya değil asıl sitenin kalıcı alan adına göre
    expect(stableRpKey(req, inter, site)).toBe("site.example");
  });

  it("ADR-0017 K7/HV6: E3 sunumu açan RP'nin kapsamıyla — aracının kapsamında olup asıl RP'ninkinde olmayan alan RED", async () => {
    const ID_ISS = "https://id.tamga.network";
    const ID_VCT = "urn:tamga:id:IdentityAttestation:1";
    const ID_STATUS = "https://id.tamga.network/status/feedfacefeedface";
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
    const catalogue = JSON.parse(readFileSync(resolve(ROOT, "packages/schemas/dist/index.json"), "utf8")) as Array<{
      vct: string;
      content_hash: string;
    }>;
    const cnf = await keys.generate("w.e3");
    const issued = await issueSdJwtVc({
      signer: await pemIssuerSigner(
        readFileSync(resolve(PKI, "issuer-id.pkcs8.pem"), "utf8"),
        readFileSync(resolve(PKI, "issuer-id.cert.pem"), "utf8"),
      ),
      iss: ID_ISS,
      vct: ID_VCT,
      vctIntegrity: catalogue.find((c) => c.vct === ID_VCT)!.content_hash,
      iat: now,
      exp: now + 365 * 86400,
      cnfJwk: cnf as never,
      status: { status_list: { idx: 9, uri: ID_STATUS } },
      claims: { family_name: "Yılmaz", given_name: "Ayşe", age_over_18: true },
      sdPolicy: { family_name: "always", given_name: "always", age_over_18: "always" },
    });
    const wallet = receiveCredentials(
      newState("w3"),
      {
        credentialIssuer: ID_ISS,
        vct: ID_VCT,
        issuedAt: now,
        copies: [{ combined: issued.combined, keyRef: "w.e3", cnf }],
        metadata: {
          credential_issuer: ID_ISS,
          credential_endpoint: ID_ISS + "/credential",
          credential_configurations_supported: { [ID_VCT]: { format: "dc+sd-jwt" } },
        },
      },
      { now },
    ).state;
    // Asıl RP: test listesindeki ikinci kayıt (kimlik kapsamı: kimlik no, doğum tarihi, ad, soyad — `age_over_18` YOK);
    // doğrulayıcının kendi kaydında `age_over_18` var
    const owner = await pemRpSigner(
      readFileSync(resolve(PKI, "rp-issuer-bilgi.pkcs8.pem"), "utf8"),
      readFileSync(resolve(PKI, "rp-issuer-bilgi.cert.pem"), "utf8"),
    );
    const ownerAuth = async () => `Bearer ${await createRpAssertion(owner, BASE)}`;
    const run = async (disclose: string[]) => {
      const made = await app3.inject({
        method: "POST",
        url: "/presentations",
        headers: { accept: "application/json", "content-type": "application/json", authorization: await ownerAuth() },
        payload: { policy_id: "event-tamga-id" }, // alan istemez: politika her iki kapsamda
      });
      expect(made.statusCode).toBe(200);
      const { presentation_id, qr_payload } = made.json() as { presentation_id: string; qr_payload: string };
      const uri = parseVpUri(qr_payload);
      const req = verifyRequestObject(await fetchRequestObject(uri.requestUri, http3), uri.clientId, LAN);
      expect(req.onBehalfOf).toBe(owner.clientId);
      const { matches } = matchDcql(req.dcql, wallet.credentials);
      const copy = matches[0].credential.copies[0];
      // Bu test doğrulayıcı tarafını sınar (fazla açıklayan bir cüzdan): Tamga cüzdanı K7 ilişkisi iki kayıtta yazılı değilse
      // aracı isteği reddeder (ADR-0056 K8 onayı çıkmaz) — burada aracı bilgisini yok sayan bir cüzdan gibi yanıtlanır
      const direct = { ...req, onBehalfOf: undefined };
      await respond({
        approval: testApproval(direct),
        request: direct,
        matches: [{ match: matches[0], keyRef: copy.keyRef, combined: copy.combined, disclose }],
        keys,
        http: http3,
        now,
      });
      const res = await app3.inject({
        method: "GET",
        url: `/presentations/${presentation_id}`,
        headers: { authorization: await ownerAuth() },
      });
      return res.json() as { outcome: string; failed_step: string | null };
    };
    expect((await run([])).outcome).toBe("ACCEPTED");
    // aracının (doğrulayıcının) kapsamında ama asıl RP'nin kapsamında değil → asıl RP'ye gitmez
    expect(await run(["age_over_18"])).toMatchObject({ outcome: "REJECTED", failed_step: "E3" });
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
