/**
 * İkinci inceleme turu (2026-11-11) — Tamga Verify servis yüzeyi: `/claims` yalnız istenen alanlar (AP3/AP4), doğrulanamayan
 * denemeler RED'e dönüşmez (AP2), denetim kaydı dönen sonuçla aynı (E4/AP9), cüzdan hata kodu sabit listeden, örnek sitede oturum
 * başlatan tarayıcıya bağlı, hız sınırları. `fastify.inject` ile ağsız; dev PKI + test listesi (`npm run setup`).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { issueSdJwtVc, pemIssuerSigner } from "@tamga-network/sd-jwt";
import { signStatusListToken, StatusBitstring, MIN_CAPACITY } from "@tamga-network/issuer";
import {
  SoftwareKeyProvider,
  MemoryKeyStore,
  parseVpUri,
  fetchRequestObject,
  verifyRequestObject,
  matchDcql,
  respond,
  newState,
  receiveCredentials,
  checkRp,
  type Http,
  type Match,
  type VpRequest,
  type WalletState,
} from "@tamga-network/wallet-core";
import { buildVerifyApp } from "../src/app.js";
import { clientKeyOf } from "../src/rate-limit.js";
import { MAX_RESPONSE_ATTEMPTS } from "../src/state.js";
import type { VerifyConfig } from "../src/config.js";

const LAN = { allowLocalDevHost: true } as const;
const ROOT = resolve(import.meta.dirname, "../../..");
const PKI = resolve(ROOT, "ops/pki");
const DIST = resolve(ROOT, "apps/trust-publisher/dist-test");
const ready = existsSync(resolve(PKI, "rp-verify.pkcs8.pem")) && existsSync(resolve(DIST, "lotl.jws"));
const BASE = "http://verify.local";
const approvalFor = (req: VpRequest) => checkRp(null, req, { requested: [] } as unknown as Match).approval!;

describe("clientKeyOf (OWASP-3: vekil arkasında istemci anahtarı)", () => {
  const req = (ip: string, headers: Record<string, unknown> = {}) => ({ ip, headers });
  it("başlık yapılandırılmamışsa bağlantı adresi; yapılandırılmışsa YALNIZ yerel vekilden gelen istekte başlık değeri", () => {
    expect(clientKeyOf(req("127.0.0.1", { "x-client-key": "a" }), undefined)).toBe("127.0.0.1");
    expect(clientKeyOf(req("127.0.0.1", { "x-client-key": "a" }), "x-client-key")).toBe("h:a");
    expect(clientKeyOf(req("::1", { "x-client-key": "b" }), "X-Client-Key")).toBe("h:b");
    // doğrudan (vekilsiz) gelen istek başlığı kendi yazabilir: yok sayılır
    expect(clientKeyOf(req("203.0.113.9", { "x-client-key": "a" }), "x-client-key")).toBe("203.0.113.9");
    // başlık yoksa, boşsa, çok uzunsa ya da birden çoksa bağlantı adresi
    expect(clientKeyOf(req("127.0.0.1"), "x-client-key")).toBe("127.0.0.1");
    expect(clientKeyOf(req("127.0.0.1", { "x-client-key": "" }), "x-client-key")).toBe("127.0.0.1");
    expect(clientKeyOf(req("127.0.0.1", { "x-client-key": "k".repeat(200) }), "x-client-key")).toBe("127.0.0.1");
    expect(clientKeyOf(req("127.0.0.1", { "x-client-key": ["a", "b"] }), "x-client-key")).toBe("127.0.0.1");
  });
});

describe.skipIf(!ready)("apps/verify — ikinci inceleme", () => {
  const ISS = "https://issuer.tamga.network/example-university";
  const VCT = "urn:tamga:edu:DiplomaCredential:1";
  const STATUS_URI = "https://status.tamga.network/feedfacefeedface";
  const IDX = 4242;
  const cfg = (extra: Partial<VerifyConfig> = {}): VerifyConfig => ({
    publicBase: BASE,
    port: 0,
    clientId: "",
    pkiDir: PKI,
    trustDist: DIST,
    stateCode: "TR",
    trustReloadSec: 60,
    statusPrefetchSec: 60,
    dataDir: join(tmpdir(), `tamga-verify-2r-${process.pid}-${Math.random().toString(36).slice(2, 8)}`),
    requireRpAuth: false,
    ...extra,
  });
  const keys = new SoftwareKeyProvider(new MemoryKeyStore());
  type App = Awaited<ReturnType<typeof buildVerifyApp>>;
  let app: App;
  let wallet: WalletState;
  let statusTok = "";
  const prevAdmin = process.env.TAMGA_ADMIN_TOKEN;

  const http =
    (a: App): Http =>
    async (url, init) => {
      const r = await a.inject({
        method: init?.method ?? "GET",
        url: url.slice(BASE.length),
        headers: init?.headers,
        payload: init?.body,
      });
      return { status: r.statusCode, text: async () => r.body };
    };
  let captured = "";
  const capture: Http = async (_url, init) => {
    captured = decodeURIComponent(String(init?.body ?? "").replace(/^response=/, ""));
    return { status: 200, text: async () => "{}" };
  };
  const postJwe = (a: App, jwe: string) =>
    a.inject({
      method: "POST",
      url: "/vp/response",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: `response=${encodeURIComponent(jwe)}`,
    });
  const postError = (a: App, error: string, state: string | undefined) =>
    a.inject({
      method: "POST",
      url: "/vp/response",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: `error=${encodeURIComponent(error)}&state=${encodeURIComponent(state ?? "")}`,
    });
  const open = async (a: App, policy_id = "job-application-degree") => {
    const created = (
      await a.inject({
        method: "POST",
        url: "/presentations",
        headers: { accept: "application/json", "content-type": "application/json" },
        payload: { policy_id },
      })
    ).json() as { presentation_id: string; qr_payload: string; status_token: string };
    const uri = parseVpUri(created.qr_payload);
    const req = verifyRequestObject(await fetchRequestObject(uri.requestUri, http(a)), uri.clientId, LAN);
    return { id: created.presentation_id, st: created.status_token, req };
  };
  const answer = async (req: VpRequest, disclose?: string[]) => {
    const m = matchDcql(req.dcql, wallet.credentials).matches[0];
    const copy = m.credential.copies[0];
    await respond({
      approval: approvalFor(req),
      request: req,
      matches: [{ match: m, keyRef: copy.keyRef, combined: copy.combined, disclose: disclose ?? m.requested }],
      keys,
      http: capture,
      now: Math.floor(Date.now() / 1000),
    });
    return captured;
  };
  type Res = Record<string, unknown> & {
    outcome?: string;
    failed_step?: string | null;
    failed_reason?: string | null;
    indeterminate_reason?: string | null;
    checks_performed?: string[];
    verification_id?: string;
    last_attempt?: Record<string, unknown>;
  };
  const result = async (a: App, id: string) =>
    (await a.inject({ method: "GET", url: `/presentations/${id}` })).json() as Res;
  const auditOf = async (a: App) =>
    (await a.inject({ method: "GET", url: "/audit", headers: { "x-admin-token": "t-2r" } })).json() as Array<
      Record<string, unknown>
    >;

  beforeAll(async () => {
    process.env.TAMGA_ADMIN_TOKEN = "t-2r";
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
    app = await buildVerifyApp(cfg(), {
      showcase: true,
      fetchText: async (u) => (u === STATUS_URI ? statusTok : null),
    });
    await app.statusCache.refresh([STATUS_URI]);
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
      status: { status_list: { idx: IDX, uri: STATUS_URI } },
      claims: {
        family_name: "Yılmaz",
        given_name: "Ayşe",
        birth_date: "2001-05-05",
        awarding_body_name: { "tr-TR": "Örnek Üniversitesi" },
        awarding_body_id: "example-university",
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
    wallet = receiveCredentials(
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
    ).state;
  });
  afterAll(() => {
    if (prevAdmin === undefined) delete process.env.TAMGA_ADMIN_TOKEN;
    else process.env.TAMGA_ADMIN_TOKEN = prevAdmin;
  });

  it("AP4/AP3: `/presentations/:id/claims` yalnız istenen alanları verir — iptal sırası (idx), `cnf`, `iss`, `iat`, `vct` yok", async () => {
    const a = await open(app);
    expect((await postJwe(app, await answer(a.req))).statusCode).toBe(200);
    const res = await result(app, a.id);
    expect(res.outcome, String(res.failed_reason)).toBe("ACCEPTED");
    const body = (await app.inject({ method: "GET", url: `/presentations/${a.id}/claims` })).body;
    const { claims } = JSON.parse(body) as { claims: Record<string, unknown> };
    const requested = app.presentations.get(a.id)!.policy.credentials[0].required_claims;
    expect(Object.keys(claims).sort()).toEqual([...requested].sort());
    expect(claims.eqf_level).toBe(6);
    expect(body).not.toContain(String(IDX));
    expect(body).not.toMatch(/"idx"|"status"|"cnf"|"jwk"|"iss"|"iat"|"vct/);
  });

  it("AP2: sahiplik kanıtından önceki DOĞRULANAMADI denemeler sınırda sunumu REJECTED yapmaz — INDETERMINATE ve nedeni korunur", async () => {
    const a = await open(app);
    const jwe = await answer(a.req);
    // güven kaynağı bayat (T0): doğrulayıcının eksiği, belgenin değil
    const trust = app.trust() as unknown as { freshness: () => Record<string, unknown> };
    const orig = trust.freshness.bind(trust);
    trust.freshness = () => ({ ...orig(), healthy: false });
    try {
      for (let i = 1; i <= MAX_RESPONSE_ATTEMPTS; i++) {
        expect((await postJwe(app, jwe)).statusCode).toBe(400);
        if (i === 1) {
          const pending = await result(app, a.id);
          expect(pending.state).toBe("PENDING");
          expect(pending.last_attempt).toMatchObject({
            failed_step: "T0",
            outcome: "INDETERMINATE",
            indeterminate_reason: "INDEXER_STALE",
          });
        }
      }
    } finally {
      delete (trust as { freshness?: unknown }).freshness;
    }
    const res = await result(app, a.id);
    expect(res).toMatchObject({
      outcome: "INDETERMINATE",
      indeterminate_reason: "INDEXER_STALE",
      failed_step: "T0",
    });
    // tarayıcının durum görünümü de aynı ayrımı taşır
    const st = (await app.inject({ method: "GET", url: `/presentations/${a.id}?st=${a.st}` })).json() as Res;
    expect(st).toMatchObject({ state: "DONE", outcome: "INDETERMINATE", indeterminate_reason: "INDEXER_STALE" });
    // denetim kaydındaki son satır dönen sonuçla aynı
    const last = (await auditOf(app)).filter((e) => e.verification_id === res.verification_id).pop();
    expect(last).toMatchObject({ outcome: "INDETERMINATE", failed_step: "T0" });
  });

  it("E4/AP9: doğrulama hattına girmeyen ret (cüzdan reddi) de denetim kaydına düşer ve sonuçta E4 görünür", async () => {
    const a = await open(app);
    expect((await postError(app, "access_denied", a.req.state)).statusCode).toBe(200);
    const res = await result(app, a.id);
    expect(res).toMatchObject({ outcome: "REJECTED", failed_reason: "the wallet declined" });
    expect(res.checks_performed).toContain("E4");
    const rows = (await auditOf(app)).filter((e) => e.verification_id === res.verification_id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ outcome: "REJECTED", failed_step: null, disclosed: [] });
  });

  it("OWASP-7: cüzdan hata yanıtındaki `error` yalnız bilinen OpenID4VP kodlarıyla kayda geçer; serbest metin geçmez", async () => {
    const known = await open(app);
    expect((await postError(app, "invalid_scope", known.req.state)).statusCode).toBe(200);
    expect((await result(app, known.id)).failed_reason).toBe("wallet error: invalid_scope");
    for (const junk of ["<script>alert(1)</script>", "Ayşe Yılmaz 10000000147", "x".repeat(60)]) {
      const p = await open(app);
      expect((await postError(app, junk, p.req.state)).statusCode).toBe(200);
      const res = await result(app, p.id);
      expect(res.outcome).toBe("REJECTED");
      expect(res.failed_reason).toBe("wallet error");
      const page = (await app.inject({ method: "GET", url: `/p/${p.id}?st=${p.st}` })).body;
      expect(page).not.toContain("alert(1)");
      expect(page).not.toContain("10000000147");
    }
  });

  it("OWASP-2: örnek sitede oturum yalnız sunumu BAŞLATAN tarayıcıda açılır — akış çerezi yoksa ya da başka tarayıcınınsa ret", async () => {
    const start = (cookie?: string) =>
      app.inject({
        method: "POST",
        url: "/sample-site/start",
        headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
        payload: { policy: "site-signin" },
      });
    const session = (payload: Record<string, unknown>, cookie?: string) =>
      app.inject({
        method: "POST",
        url: "/sample-site/session",
        headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
        payload,
      });
    const flowCookie = (r: Awaited<ReturnType<typeof start>>) => {
      const raw = ([] as string[]).concat((r.headers["set-cookie"] as string | string[] | undefined) ?? []);
      const c = raw.find((x) => x.startsWith("tamga_site_flow="));
      return c ? { pair: c.split(";")[0], raw: c } : undefined;
    };
    const victim = await start();
    expect(victim.statusCode).toBe(200);
    const vc = flowCookie(victim)!;
    expect(vc.raw).toMatch(/HttpOnly/);
    expect(vc.raw).toMatch(/SameSite=Lax/);
    const vid = (victim.json() as { presentation_id: string }).presentation_id;
    // sunum kimliği QR'da açıktır: kimliği bilen başka tarayıcı (çerezsiz ya da kendi çereziyle) oturum açamaz
    const noCookie = await session({ presentation_id: vid });
    expect(noCookie.statusCode).toBe(403);
    const attacker = await start();
    const ac = flowCookie(attacker)!;
    expect(ac.pair).not.toBe(vc.pair);
    const stolen = await session({ presentation_id: vid }, ac.pair);
    expect(stolen.statusCode).toBe(403);
    expect(app.presentations.get(vid)!.consumedBySite).toBeUndefined(); // kurbanın sunumu tüketilmedi
    // başlatan tarayıcı: akış denetimini geçer (sunum henüz doğrulanmadı → 400, 403 değil); kimlik gövdede olmasa da çerezden çözülür
    expect((await session({ presentation_id: vid }, vc.pair)).statusCode).toBe(400);
    expect((await session({}, vc.pair)).statusCode).toBe(400);
    // aynı tarayıcının ikinci başlatması aynı akışa eklenir (çerez değişmez), ikisi de onundur
    const again = await start(vc.pair);
    expect(flowCookie(again)?.pair ?? vc.pair).toBe(vc.pair);
    const vid2 = (again.json() as { presentation_id: string }).presentation_id;
    expect((await session({ presentation_id: vid2 }, vc.pair)).statusCode).toBe(400);
    expect((await session({ presentation_id: vid }, vc.pair)).statusCode).toBe(400);
  });

  it("OWASP-6 / OWASP-3: `/sample-site/start` hız sınırlı; vekilin verdiği istemci anahtarıyla kovalar ayrılır", async () => {
    const limited = await buildVerifyApp(cfg({ clientKeyHeader: "x-tamga-client-key" }), {
      showcase: true,
      fetchText: async () => null,
      rateRules: { siteStart: { burst: 2, perMin: 1 }, presentations: { burst: 2, perMin: 1 } },
    });
    const start = (key: string) =>
      limited.inject({
        method: "POST",
        url: "/sample-site/start",
        headers: { "content-type": "application/json", "x-tamga-client-key": key },
        payload: { policy: "site-signin" },
      });
    expect((await start("a")).statusCode).toBe(200);
    expect((await start("a")).statusCode).toBe(200);
    const third = await start("a");
    expect(third.statusCode).toBe(429);
    expect(third.headers["retry-after"]).toBeDefined();
    expect((await start("b")).statusCode).toBe(200); // başka istemci etkilenmez
    // beyansız POST /presentations: tek ortak kova yerine istemci başına
    const openAs = (key: string) =>
      limited.inject({
        method: "POST",
        url: "/presentations",
        headers: { accept: "application/json", "content-type": "application/json", "x-tamga-client-key": key },
        payload: { policy_id: "job-application-degree" },
      });
    expect((await openAs("a")).statusCode).toBe(200);
    expect((await openAs("a")).statusCode).toBe(200);
    expect((await openAs("a")).statusCode).toBe(429);
    expect((await openAs("b")).statusCode).toBe(200);
    await limited.close();
  });
});
