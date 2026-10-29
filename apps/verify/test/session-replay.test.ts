/**
 * OpenID4VP oturum ve tekrar saldırısı kabul testleri (su.engineering, "OpenID4VP replay protection" — sekiz durum). İmza
 * geçerliliği sunumun DOĞRU oturuma bağlandığını kanıtlamaz: protokol sunumu doğrulayıcının `client_id`'sine (KB-JWT `aud`, PV7) ve
 * isteğin `nonce`'una bağlar; uygulama kabul edilen sonucu doğru sunuma ayrıca bağlar ve kabulü tek yönlü, tek koşullu durum
 * değişikliği olarak yapar (PV10; SPEC-PROTO-0002 §10.1). Her `it` listedeki bir durumu (1–8) ya da onun Tamga'daki karşılığını sınar.
 *
 * Kurulum `verify-app.test.ts` ile aynı: dev PKI, test güven listesi (`npm run setup`), sahte status getirme (S12).
 */
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createPrivateKey } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, it, expect, beforeAll } from "vitest";
import { issueSdJwtVc, pemIssuerSigner } from "@tamga-network/sd-jwt";
import { signStatusListToken, StatusBitstring, MIN_CAPACITY } from "@tamga-network/issuer";
import { pemToDer } from "@tamga-network/core";
import { createRpAssertion, pemRpSigner } from "@tamga-network/verifier";
import { issueMdoc, toPidMdocElements } from "@tamga-network/mdoc";
import {
  SoftwareKeyProvider,
  MemoryKeyStore,
  parseVpUri,
  fetchRequestObject,
  verifyRequestObject,
  parseDcApiRequest,
  matchDcql,
  respond,
  declineRequest,
  newState,
  receiveCredentials,
  encryptJwe,
  utf8,
  jwkToPoint,
  checkRp,
  type Http,
  type Match,
  type VpRequest,
  type WalletState,
} from "@tamga-network/wallet-core";
import { buildVerifyApp } from "../src/app.js";
import type { VerifyConfig } from "../src/config.js";

const LAN = { allowLocalDevHost: true } as const;
const ROOT = resolve(import.meta.dirname, "../../..");
const PKI = resolve(ROOT, "ops/pki");
const DIST = resolve(ROOT, "apps/trust-publisher/dist-test");
const ready = existsSync(resolve(PKI, "rp-verify.pkcs8.pem")) && existsSync(resolve(DIST, "lotl.jws"));
const BASE = "http://verify.local";
const SITE = "https://shop.example";

/** ADR-0056 K8: `respond` için `checkRp` onayı (kayıtsız doğrulayıcı: engelleyici durum yok). */
const approvalFor = (req: VpRequest) => checkRp(null, req, { requested: [] } as unknown as Match).approval!;

describe.skipIf(!ready)("apps/verify — sekiz OpenID4VP oturum/tekrar durumu (su.engineering)", () => {
  const ISS = "https://issuer.tamga.network/bilgi";
  const VCT = "urn:tamga:edu:DiplomaCredential:1";
  const STATUS_URI = "https://status.tamga.network/feedfacefeedface";
  const ID_ISS = "https://id.tamga.network";
  const ID_VCT = "urn:tamga:id:IdentityAttestation:1";
  const ID_STATUS = "https://id.tamga.network/status/feedfacefeedface";
  const cfg: VerifyConfig = {
    publicBase: BASE,
    port: 0,
    clientId: "",
    pkiDir: PKI,
    trustDist: DIST,
    stateCode: "TR",
    trustReloadSec: 60,
    statusPrefetchSec: 60,
    dataDir: join(tmpdir(), "tamga-verify-replay-" + process.pid),
    requireRpAuth: false,
  };
  const keys = new SoftwareKeyProvider(new MemoryKeyStore());
  let app: Awaited<ReturnType<typeof buildVerifyApp>>;
  let wallet: WalletState;
  let mdocWallet: WalletState;
  let combined = "";
  let mdocCombined = "";
  const statusToks: Record<string, string> = {};

  const http =
    (a: typeof app): Http =>
    async (url, init) => {
      if (!url.startsWith(BASE)) throw new Error("host: " + url);
      const r = await a.inject({
        method: init?.method ?? "GET",
        url: url.slice(BASE.length),
        headers: init?.headers,
        payload: init?.body,
      });
      return { status: r.statusCode, text: async () => r.body };
    };
  /** Yanıtı göndermeden yakalar: cüzdan çekirdeği JWE'yi üretir, test istediği yere (istediği zaman) gönderir. */
  let captured = "";
  const capture: Http = async (_url, init) => {
    captured = decodeURIComponent(String(init?.body ?? "").replace(/^response=/, ""));
    return { status: 200, text: async () => "{}" };
  };
  const postJwe = (a: typeof app, jwe: string) =>
    a.inject({
      method: "POST",
      url: "/vp/response",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: `response=${encodeURIComponent(jwe)}`,
    });
  const postDecline = (a: typeof app, state: string | undefined) =>
    a.inject({
      method: "POST",
      url: "/vp/response",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: `error=access_denied&state=${encodeURIComponent(state ?? "")}`,
    });
  const open = async (a: typeof app, policy_id = "job-application-degree", extra: Record<string, unknown> = {}) => {
    const created = (
      await a.inject({
        method: "POST",
        url: "/presentations",
        headers: { accept: "application/json", "content-type": "application/json" },
        payload: { policy_id, ...extra },
      })
    ).json() as {
      presentation_id: string;
      qr_payload: string;
      status_token: string;
      dc_api_request?: { protocol: string; data: { request: string } };
    };
    const uri = parseVpUri(created.qr_payload);
    const req = verifyRequestObject(await fetchRequestObject(uri.requestUri, http(a)), uri.clientId, LAN);
    return { id: created.presentation_id, st: created.status_token, req, dc: created.dc_api_request };
  };
  /** Cüzdanın geçerli yanıtı (JWE) — gönderilmez. `disclose` verilmezse istenen bütün alanlar. */
  const answer = async (req: VpRequest, opt: { disclose?: string[]; w?: WalletState; c?: string } = {}) => {
    const m = matchDcql(req.dcql, (opt.w ?? wallet).credentials).matches[0];
    const copy = m.credential.copies[0];
    const out = await respond({
      approval: approvalFor(req),
      request: req,
      matches: [
        { match: m, keyRef: copy.keyRef, combined: opt.c ?? copy.combined, disclose: opt.disclose ?? m.requested },
      ],
      keys,
      http: capture,
      now: Math.floor(Date.now() / 1000),
    });
    return { jwe: out.dcApiResponse?.response ?? captured, vpToken: out.vpToken };
  };
  type Res = {
    state?: string;
    outcome?: string;
    failed_step?: string | null;
    failed_reason?: string | null;
    attempts?: number;
    last_attempt?: { failed_step: string | null; failed_reason: string };
    disclosed_claims?: string[];
    verification_id?: string;
  };
  const result = async (a: typeof app, id: string) =>
    (await a.inject({ method: "GET", url: `/presentations/${id}` })).json() as Res;

  beforeAll(async () => {
    const now = Math.floor(Date.now() / 1000);
    for (const [kind, iss, uri] of [
      ["issuer-bilgi-status", ISS, STATUS_URI],
      ["issuer-id-status", ID_ISS, ID_STATUS],
    ] as const) {
      const st = await pemIssuerSigner(
        readFileSync(resolve(PKI, `${kind}.pkcs8.pem`), "utf8"),
        readFileSync(resolve(PKI, `${kind}.cert.pem`), "utf8"),
      );
      statusToks[uri] = await signStatusListToken({
        signer: st,
        iss,
        uri,
        bitstring: new StatusBitstring(MIN_CAPACITY),
        iat: now,
        ttlSec: 3600,
      });
    }
    app = await buildVerifyApp(cfg, { showcase: true, fetchText: async (u) => statusToks[u] ?? null });
    await app.statusCache.refresh([STATUS_URI, ID_STATUS]);
    const catalogue = JSON.parse(readFileSync(resolve(ROOT, "packages/schemas/dist/index.json"), "utf8")) as Array<{
      vct: string;
      content_hash: string;
    }>;
    // diploma (SD-JWT VC)
    const signer = await pemIssuerSigner(
      readFileSync(resolve(PKI, "issuer-bilgi.pkcs8.pem"), "utf8"),
      readFileSync(resolve(PKI, "issuer-bilgi.cert.pem"), "utf8"),
    );
    const cnf = await keys.generate("r.0");
    const issued = await issueSdJwtVc({
      signer,
      iss: ISS,
      vct: VCT,
      vctIntegrity: catalogue.find((c) => c.vct === VCT)!.content_hash,
      iat: now,
      cnfJwk: cnf as never,
      status: { status_list: { idx: 11, uri: STATUS_URI } },
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
    combined = issued.combined;
    const meta = (iss: string, vct: string) => ({
      credential_issuer: iss,
      credential_endpoint: iss + "/credential",
      credential_configurations_supported: { [vct]: { format: "dc+sd-jwt" } },
    });
    wallet = receiveCredentials(
      newState("r"),
      {
        credentialIssuer: ISS,
        vct: VCT,
        issuedAt: now,
        copies: [{ combined, keyRef: "r.0", cnf }],
        metadata: meta(ISS, VCT),
      },
      { now },
    ).state;
    // kimlik belgesi (SD-JWT + aynı anahtarlı mdoc; DC API köken testi için)
    const idKeyPem = readFileSync(resolve(PKI, "issuer-id.pkcs8.pem"), "utf8");
    const idCertPem = readFileSync(resolve(PKI, "issuer-id.cert.pem"), "utf8");
    const claims = {
      family_name: "Yılmaz",
      given_name: "Ayşe",
      birthdate: "2001-05-05",
      nationalities: ["TR"],
      personal_administrative_number: "10000000147",
      document_type: "ID_CARD",
      document_number_hash: "sha256-abc123",
      issuing_country: "TR",
      document_chip_verified: false,
      verification_method: "remote-document-liveness-face",
      age_over_18: true,
      age_over_15: true,
    };
    const icnf = await keys.generate("r.mdoc");
    const exp = now + 365 * 86400;
    const sd = await issueSdJwtVc({
      signer: await pemIssuerSigner(idKeyPem, idCertPem),
      iss: ID_ISS,
      vct: ID_VCT,
      vctIntegrity: catalogue.find((c) => c.vct === ID_VCT)!.content_hash,
      iat: now,
      exp,
      cnfJwk: icnf as never,
      status: { status_list: { idx: 12, uri: ID_STATUS } },
      claims,
      sdPolicy: Object.fromEntries(Object.keys(claims).map((k) => [k, "always" as const])),
    });
    mdocCombined = sd.combined;
    const d = (createPrivateKey(idKeyPem).export({ format: "jwk" }) as { d: string }).d;
    const mdoc = issueMdoc({
      docType: ID_VCT,
      namespaces: { "tamga.id.1": toPidMdocElements(claims) },
      deviceKeyRaw: jwkToPoint(icnf),
      issuerSk: new Uint8Array(Buffer.from(d, "base64url")),
      x5chain: [pemToDer(idCertPem)],
      signed: now,
      validFrom: now,
      validUntil: exp,
      randomBytes: (n) => new Uint8Array(Array.from({ length: n }, () => Math.floor(Math.random() * 256))),
      status: { idx: 12, uri: ID_STATUS },
    });
    mdocWallet = receiveCredentials(
      newState("r2"),
      {
        credentialIssuer: ID_ISS,
        vct: ID_VCT,
        issuedAt: now,
        copies: [
          {
            combined: sd.combined,
            keyRef: "r.mdoc",
            cnf: icnf,
            mdoc: Buffer.from(mdoc.issuerSigned).toString("base64url"),
          },
        ],
        metadata: meta(ID_ISS, ID_VCT),
      },
      { now },
    ).state;
  });

  it("(1) eski yanıt yeni denemeye → RED (KB-JWT nonce, A6), yeni deneme açık kalır; aynı yanıt aynı sunuma tekrar → PV10", async () => {
    const a = await open(app);
    const old = await answer(a.req);
    expect((await postJwe(app, old.jwe)).statusCode).toBe(200);
    expect((await result(app, a.id)).outcome).toBe("ACCEPTED");
    // aynı JWE aynı sunuma ikinci kez: tek kullanım (PV10); sonuç değişmez
    const again = await postJwe(app, old.jwe);
    expect(again.statusCode).toBe(400);
    expect(again.json().error_description).toMatch(/PV10/);
    expect((await result(app, a.id)).outcome).toBe("ACCEPTED");
    // eski sunumun vp_token'ı yeni denemenin anahtarıyla ve state'iyle yeniden şifrelenir: KB-JWT nonce eski isteğin → A6
    const b = await open(app);
    const replay = encryptJwe(utf8(JSON.stringify({ vp_token: old.vpToken, state: b.req.state })), b.req.encJwk);
    expect((await postJwe(app, replay)).statusCode).toBe(400);
    const rb = await result(app, b.id);
    expect(rb.state).toBe("PENDING"); // sahiplik kanıtına ulaşmayan yanıt sunumu tüketmez (§10.1)
    expect(rb.last_attempt?.failed_step).toBe("A6");
    // eski sunumun JWE'si (başka sunumun `kid`'i) yeni sunumu etkilemez; gerçek cüzdan yeni denemeyi tamamlar
    expect((await postJwe(app, (await answer(b.req)).jwe)).statusCode).toBe(200);
    expect((await result(app, b.id)).outcome).toBe("ACCEPTED");
  });

  it("(2) başka doğrulayıcıya üretilmiş kanıt (KB-JWT aud) → A6'da RED, sunum tüketilmez; başka sunumun anahtarına şifreli yanıt çözülmez", async () => {
    const a = await open(app);
    // cüzdan aynı belgeyi başka bir doğrulayıcının isteğine (başka client_id, aynı nonce) sundu; saldırgan bunu buraya taşır
    const forOther = await answer({ ...a.req, clientId: "x509_hash:QmFza2FEb2dydWxheWljaQ" });
    const moved = encryptJwe(utf8(JSON.stringify({ vp_token: forOther.vpToken, state: a.req.state })), a.req.encJwk);
    expect((await postJwe(app, moved)).statusCode).toBe(400);
    const ra = await result(app, a.id);
    expect(ra.state).toBe("PENDING");
    expect(ra.last_attempt?.failed_step).toBe("A6");
    expect(ra.last_attempt?.failed_reason).toMatch(/aud/i);
    // a için üretilmiş geçerli yanıt b'nin anahtarına şifrelenirse (kid b) b'de çözülür ama state a'nın → deneme, b açık kalır
    const b = await open(app);
    const forA = await answer(a.req);
    const toB = encryptJwe(utf8(JSON.stringify({ vp_token: forA.vpToken, state: a.req.state })), b.req.encJwk);
    expect((await postJwe(app, toB)).statusCode).toBe(400);
    const rb = await result(app, b.id);
    expect(rb.state).toBe("PENDING");
    expect(rb.last_attempt?.failed_reason).toBe("state mismatch");
    const forB = await answer(b.req);
    // doğru yere giden yanıt kabul edilir
    expect((await postJwe(app, forA.jwe)).statusCode).toBe(200);
    expect((await result(app, a.id)).outcome).toBe("ACCEPTED");
    expect((await postJwe(app, forB.jwe)).statusCode).toBe(200);
    expect((await result(app, b.id)).outcome).toBe("ACCEPTED");
  });

  it("(3) aynı geçerli yanıt eşzamanlı iki kez → tek kabul; sonuç tek ve değişmez", async () => {
    const a = await open(app);
    const { jwe } = await answer(a.req);
    const rs = await Promise.all([postJwe(app, jwe), postJwe(app, jwe), postJwe(app, jwe)]);
    expect(rs.map((r) => r.statusCode).sort()).toEqual([200, 400, 400]);
    const r = await result(app, a.id);
    expect(r.outcome).toBe("ACCEPTED");
    // kaybedenler deneme sayılmaz (sunum tamamlandı; sonuç kabul)
    expect(rs.filter((x) => x.statusCode === 400).map((x) => x.json().error_description)).toEqual(
      expect.arrayContaining([expect.stringMatching(/being processed|PV10/)]),
    );
  });

  it("(3b) doğrulama sürerken gelen ret (error+state) sonucu çevirmez — tek yönlü durum (pending → accepted)", async () => {
    const a = await open(app);
    const { jwe } = await answer(a.req);
    const p = app.presentations.get(a.id)!;
    const inflight = postJwe(app, jwe);
    // yanıt doğrulanırken (busy) ret gelir: state istek nesnesinde açık olduğundan yalnız cüzdan değil, nesneyi okuyan herkes gönderebilir
    for (let i = 0; i < 200 && !p.busy; i++) await new Promise((r) => setImmediate(r));
    expect(p.busy).toBe(true);
    const decline = await postDecline(app, a.req.state);
    expect(decline.statusCode).toBe(400);
    expect((await inflight).statusCode).toBe(200);
    const r = await result(app, a.id);
    expect(r.outcome).toBe("ACCEPTED");
    // kabulden sonra ret de 400 (sunum kapalı; byState yalnız bekleyenleri bulur)
    expect((await postDecline(app, a.req.state)).statusCode).toBe(400);
    expect((await result(app, a.id)).outcome).toBe("ACCEPTED");
  });

  it("(4) başka oturum / başka RP sonucu ister → 404 (HV2); başka sunumun durum jetonu işe yaramaz; örnek site sunumu bir kez kullanır", async () => {
    const strict = await buildVerifyApp(
      { ...cfg, requireRpAuth: true, dataDir: join(tmpdir(), "tamga-verify-replay-strict-" + process.pid) },
      { showcase: true, fetchText: async (u) => statusToks[u] ?? null },
    );
    await strict.statusCache.refresh([STATUS_URI]);
    const signerOf = (n: string) =>
      pemRpSigner(
        readFileSync(resolve(PKI, `${n}.pkcs8.pem`), "utf8"),
        readFileSync(resolve(PKI, `${n}.cert.pem`), "utf8"),
      );
    const owner = await signerOf("rp-verify");
    const other = await signerOf("rp-issuer-bilgi"); // listede kayıtlı başka bir RP
    const bearer = async (s: typeof owner) => `Bearer ${await createRpAssertion(s, BASE)}`;
    const openS = async () => {
      const r = await strict.inject({
        method: "POST",
        url: "/presentations",
        headers: { accept: "application/json", "content-type": "application/json", authorization: await bearer(owner) },
        payload: { policy_id: "job-application-degree" },
      });
      expect(r.statusCode).toBe(200);
      const c = r.json() as { presentation_id: string; qr_payload: string; status_token: string };
      const uri = parseVpUri(c.qr_payload);
      return {
        id: c.presentation_id,
        st: c.status_token,
        req: verifyRequestObject(await fetchRequestObject(uri.requestUri, http(strict)), uri.clientId, LAN),
      };
    };
    const a = await openS();
    const b = await openS();
    expect((await postJwe(strict, (await answer(a.req)).jwe)).statusCode).toBe(200);
    // sahibi okur
    const mine = await strict.inject({
      method: "GET",
      url: `/presentations/${a.id}`,
      headers: { authorization: await bearer(owner) },
    });
    expect(mine.json().outcome).toBe("ACCEPTED");
    // başka RP (geçerli beyanla) → 404, varlık sızmaz; değerler de 404
    for (const url of [`/presentations/${a.id}`, `/presentations/${a.id}/claims`]) {
      const r = await strict.inject({ method: "GET", url, headers: { authorization: await bearer(other) } });
      expect(r.statusCode).toBe(404);
      expect(r.json()).toEqual({ error: "not_found" });
    }
    // beyansız → 404; başka sunumun (b) durum jetonu a'yı göstermez
    expect((await strict.inject({ method: "GET", url: `/presentations/${a.id}` })).statusCode).toBe(404);
    expect((await strict.inject({ method: "GET", url: `/presentations/${a.id}?st=${b.st}` })).statusCode).toBe(404);
    expect((await strict.inject({ method: "GET", url: `/presentations/${a.id}?st=${a.st}` })).json()).toMatchObject({
      state: "DONE",
      outcome: "ACCEPTED",
    });
    const page = await strict.inject({ method: "GET", url: `/p/${a.id}?st=${b.st}` });
    expect(page.body).not.toContain('class="result big');
    // başarı adresine (redirect_uri) ulaşmak bir şey kanıtlamaz: kanıt sunucudaki sonuçtadır — b hâlâ PENDING
    expect((await strict.inject({ method: "GET", url: `/presentations/${b.id}?st=${b.st}` })).json()).toMatchObject({
      state: "PENDING",
    });
    // örnek site (D11): kabul edilmiş bir sunumla yalnız BİR oturum; başka amaçlı ya da başka RP'nin sunumu oturum açmaz
    const site = (id: string) =>
      app.inject({
        method: "POST",
        url: "/sample-site/session",
        headers: { "content-type": "application/json" },
        payload: { presentation_id: id },
      });
    const job = await open(app);
    expect((await postJwe(app, (await answer(job.req)).jwe)).statusCode).toBe(200);
    const s = await site(job.id);
    expect(s.statusCode).toBe(400);
    expect(s.json().reason).toMatch(/site girişi için değil/);
  });

  it("(5) süresi dolmuş deneme → RED (yanıt, ret ve istek nesnesi); yeni deneme mümkün", async () => {
    const a = await open(app);
    const { jwe } = await answer(a.req);
    const p = app.presentations.get(a.id)!;
    p.req.expiresAt = Math.floor(Date.now() / 1000) - 1; // istek süresi geçti
    const late = await postJwe(app, jwe);
    expect(late.statusCode).toBe(400);
    expect(late.json().error_description).toMatch(/expired/);
    expect((await postDecline(app, a.req.state)).statusCode).toBe(400);
    expect((await app.inject({ method: "GET", url: `/vp/req/${a.id}` })).statusCode).toBe(404);
    // süresi geçen sunum kabul edilmedi, tüketilmedi; sonuç yok (RP `expires_at`'i başlangıçta aldı)
    expect(p.result).toBeUndefined();
    expect(p.attempts).toBe(0);
    // yeni deneme baştan: yeni nonce, yeni anahtar → kabul
    const b = await open(app);
    expect(b.req.nonce).not.toBe(a.req.nonce);
    expect((await postJwe(app, (await answer(b.req)).jwe)).statusCode).toBe(200);
    expect((await result(app, b.id)).outcome).toBe("ACCEPTED");
  });

  it("(6) önce bozuk girdi → deneme sayılır, sunum açık; state/nonce iki oturum arasında takas edilirse RED; sonra geçerli yanıt kabul", async () => {
    const a = await open(app);
    const b = await open(app);
    // bozuk gövde (çözülemez)
    const junk =
      Buffer.from(JSON.stringify({ alg: "ECDH-ES", enc: "A128GCM", kid: `enc-${a.id}` })).toString("base64url") +
      ".x.y.z.w";
    expect((await postJwe(app, junk)).statusCode).toBe(400);
    // gövdesiz / anlamsız istek: sunuma dokunmaz
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/vp/response",
          headers: { "content-type": "application/json" },
          payload: {},
        })
      ).statusCode,
    ).toBe(400);
    // b'nin geçerli vp_token'ı (b'nin nonce'u) a'nın state'i ve anahtarıyla → KB-JWT nonce uyuşmaz → A6
    const forB = await answer(b.req);
    const swapNonce = encryptJwe(utf8(JSON.stringify({ vp_token: forB.vpToken, state: a.req.state })), a.req.encJwk);
    expect((await postJwe(app, swapNonce)).statusCode).toBe(400);
    // a'nın geçerli vp_token'ı b'nin state'iyle a'nın anahtarına → state uyuşmaz
    const forA = await answer(a.req);
    const swapState = encryptJwe(utf8(JSON.stringify({ vp_token: forA.vpToken, state: b.req.state })), a.req.encJwk);
    expect((await postJwe(app, swapState)).statusCode).toBe(400);
    const ra = await result(app, a.id);
    expect(ra.state).toBe("PENDING");
    expect(ra.attempts).toBe(3);
    expect(ra.last_attempt?.failed_reason).toBe("state mismatch");
    // b bunlardan etkilenmedi
    expect((await result(app, b.id)).attempts).toBe(0);
    // geçerli yanıtlar sonra gelir ve kabul edilir (hata politikası: bozuk girdi sunumu düşürmez, 5'te kapanır — §10.1)
    expect((await postJwe(app, forA.jwe)).statusCode).toBe(200);
    expect((await postJwe(app, forB.jwe)).statusCode).toBe(200);
    expect((await result(app, a.id)).outcome).toBe("ACCEPTED");
    expect((await result(app, b.id)).outcome).toBe("ACCEPTED");
  });

  it("(7) kabul ile RP'nin hesap güncellemesi arasında kesinti → sonuç tekrar okunabilir (idempotent); değerler bir kez (HV3); yeni sunum mümkün", async () => {
    const a = await open(app);
    const { jwe } = await answer(a.req);
    const posted = await postJwe(app, jwe);
    expect(posted.statusCode).toBe(200);
    // kabul tek adımda yazıldı (sonuç + tüketildi); RP'nin yeniden denemesi aynı sonucu görür
    const r1 = await result(app, a.id);
    const r2 = await result(app, a.id);
    expect(r1.outcome).toBe("ACCEPTED");
    expect(r2).toEqual(r1);
    // cüzdan yanıtı alamadığını sanıp yeniden gönderir: sonuç değişmez, ikinci kabul yok
    expect((await postJwe(app, jwe)).statusCode).toBe(400);
    expect(await result(app, a.id)).toEqual(r1);
    // değerler bir kez: RP okuyup çökerse ikinci okuma 410 (gizlilik tercihi, ADR-0017 K3) — RP yeni sunum açar
    expect((await app.inject({ method: "GET", url: `/presentations/${a.id}/claims` })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: `/presentations/${a.id}/claims` })).statusCode).toBe(410);
    const b = await open(app);
    expect((await postJwe(app, (await answer(b.req)).jwe)).statusCode).toBe(200);
    expect((await result(app, b.id)).outcome).toBe("ACCEPTED");
    expect((await result(app, b.id)).verification_id).not.toBe(r1.verification_id);
  });

  it("(8) eksik alanlı belge → çıkarım yok: istenen alan açıklanmadıysa RED, değerlerde o alan yok", async () => {
    const a = await open(app);
    const m = matchDcql(a.req.dcql, wallet.credentials).matches[0];
    expect(m.requested).toEqual(expect.arrayContaining(["eqf_level", "is_graduate"]));
    const { jwe } = await answer(a.req, { disclose: m.requested.filter((c) => c !== "eqf_level") });
    await postJwe(app, jwe);
    const r = await result(app, a.id);
    expect(r.outcome).toBe("REJECTED");
    expect(r.failed_step).toMatch(/^E/);
    expect(r.failed_reason).toMatch(/eqf_level/);
    expect(r.disclosed_claims ?? []).not.toContain("eqf_level");
    const cl = (await app.inject({ method: "GET", url: `/presentations/${a.id}/claims` })).json() as {
      claims: Record<string, unknown> | null;
    };
    expect(cl.claims?.eqf_level).toBeUndefined();
  });

  it("DC API kökeni: başka sitenin sayfası isteği kullanamaz (expected_origins); başka köken için imzalanmış mdoc yanıtı A6", async () => {
    const a = await open(app, "age-over-18-mdoc", { dc_api_origin: SITE });
    expect(a.dc?.protocol).toBe("openid4vp-v1-signed");
    expect(() => parseDcApiRequest(a.dc!, "https://evil.example")).toThrow(/expected_origins/);
    const dreq = parseDcApiRequest(a.dc!, SITE);
    // kötü niyetli sayfa cüzdan çekirdeğini atlayıp kendi kökeniyle imzalatır: mdoc SessionTranscript (köken) uyuşmaz → A6
    const evil = await answer({ ...dreq, origin: "https://evil.example" }, { w: mdocWallet, c: mdocCombined });
    expect((await postJwe(app, evil.jwe)).statusCode).toBe(400);
    const ra = await result(app, a.id);
    expect(ra.state).toBe("PENDING");
    expect(ra.last_attempt?.failed_step).toBe("A6");
    // doğru kökenle → kabul; aynı yanıt ikinci kez → PV10
    const good = await answer(dreq, { w: mdocWallet, c: mdocCombined });
    expect((await postJwe(app, good.jwe)).statusCode).toBe(200);
    expect((await result(app, a.id)).outcome).toBe("ACCEPTED");
    expect((await postJwe(app, good.jwe)).statusCode).toBe(400);
  });

  it("ret (error+state) sonrası yanıt → 400; ret yalnız bekleyen sunumu kapatır, neden saklanmaz (PV5)", async () => {
    const a = await open(app);
    const { jwe } = await answer(a.req);
    const dec = await declineRequest(a.req, http(app));
    expect(dec.status).toBe(200);
    const r = await result(app, a.id);
    expect(r.outcome).toBe("REJECTED");
    expect(r.failed_reason).toBe("the wallet declined");
    const late = await postJwe(app, jwe);
    expect(late.statusCode).toBe(400);
    expect((await result(app, a.id)).outcome).toBe("REJECTED");
  });
});
