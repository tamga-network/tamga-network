/**
 * Tarayıcı Digital Credentials API deneme sayfası (yalnız sandbox vitrini): `navigator.credentials.get({ digital: { requests } })`
 * ile (a) imzalı OpenID4VP (`openid4vp-v1-signed`, OpenID4VP 1.0 Ek A; `expected_origins` = sayfanın kökeni) ve (b) ISO/IEC
 * 18013-7 Ek C (`org-iso-mdoc`; okuyucu imzalı DeviceRequest + HPKE alıcı anahtarı) — yanıt doğrulayıcıya iletilir, sonuç
 * (ACCEPTED / REJECTED, denetimler, sandbox örnek verisinde açıklanan alanlar) sayfada gösterilir.
 *
 *  GET  /dc-api-test                 sayfa
 *  POST /dc-api-test/start           {policy, protocol: "both"|"openid4vp"|"mdoc", origin} → DC API istekleri + sayfa jetonu
 *  GET  /dc-api-test/result/:t       sonuç (sayfa jetonuyla)
 *
 * Sayfanın sunucusu barındırılan doğrulayıcıya bir RP gibi bağlanır (sandbox portalıyla aynı yol, ADR-0017 K1): sunum
 * `POST /presentations` ile RP beyanıyla (doğrulayıcının erişim sertifikası; `Authorization: Bearer <rp-assertion>`) açılır,
 * sonuç ve değerler `GET /presentations/:id(/claims)` ile yine beyanla okunur (değerler bir kez — K3). Tarayıcı yalnız sayfa
 * jetonunu taşır; sunum kimliği ya da durum jetonu sayfaya verilmez. Gerçek ağda sayfa yok: sandbox'taki sayfaya yönlenir.
 */
import type { FastifyInstance } from "fastify";
import { randomBytes } from "node:crypto";
import { createRpAssertion } from "@tamga-network/verifier";
import type { VerifyContext } from "../app.js";
import { langOf } from "../html.js";
import { dcTestPage, DC_TEST_POLICIES } from "../dc-test-page.js";
import { webOrigin } from "./presentations.js";
import { rateLimited } from "../rate-limit.js";

export const DC_TEST_PATH = "/dc-api-test";
const SANDBOX_DC_TEST = "https://verify.sandbox.tamga.network/dc-api-test";
const TTL_MS = 10 * 60_000;
const MAX_PAGES = 5_000;
const PROTOCOLS = { openid4vp: "openid4vp-v1-signed", mdoc: "org-iso-mdoc" } as const;
type Choice = "both" | keyof typeof PROTOCOLS;

interface TestRun {
  presentationId: string;
  createdAt: number;
  result?: Record<string, unknown>;
  claims?: Record<string, unknown> | null;
}

/** Sayfaya gösterilen sonuç: doğrulayıcının kararı + denetimler; değerler yalnız sandbox / yerel geliştirmede (örnek veri). */
export function registerDcTestRoutes(app: FastifyInstance, ctx: VerifyContext) {
  if (!ctx.showcase) {
    app.get(DC_TEST_PATH, async (_req, reply) => reply.redirect(SANDBOX_DC_TEST, 302));
    return;
  }
  const { cfg } = ctx;
  const showValues = cfg.network === "sandbox" || !cfg.publicBase.startsWith("https://");
  const runs = new Map<string, TestRun>();
  const gc = () => {
    const now = Date.now();
    for (const [k, v] of runs) if (now - v.createdAt > TTL_MS) runs.delete(k);
    while (runs.size >= MAX_PAGES) runs.delete(runs.keys().next().value!);
  };
  /** RP beyanı (≤ 60 sn, tek kullanımlık jti) — her doğrulayıcı çağrısında yeni. */
  const bearer = async () => `Bearer ${await createRpAssertion(ctx.signer, cfg.publicBase)}`;
  const pageOrigin = new URL(cfg.publicBase).origin;

  app.get(DC_TEST_PATH, async (req, reply) =>
    reply
      .type("text/html")
      .header("x-robots-tag", "noindex, nofollow")
      .send(dcTestPage(langOf(req.headers["accept-language"]), { showValues })),
  );

  app.post(`${DC_TEST_PATH}/start`, async (req, reply) => {
    // adres başına sınır: sunumlar doğrulayıcının kendi beyanıyla açılır (tek ortak RP kovası) — tek istemci tüketemesin
    if (rateLimited(ctx.limits.presentations, `dc-test:${req.ip ?? ""}`, reply)) return reply;
    if (!String(req.headers["content-type"] ?? "").startsWith("application/json"))
      return reply.code(415).send({ error: "invalid_request", reason: "JSON expected" });
    const b = (req.body ?? {}) as { policy?: unknown; protocol?: unknown; origin?: unknown };
    const policy = typeof b.policy === "string" && DC_TEST_POLICIES.includes(b.policy) ? b.policy : null;
    if (!policy) return reply.code(400).send({ error: "invalid_request", reason: "unknown test policy" });
    const choice: Choice = b.protocol === "openid4vp" || b.protocol === "mdoc" ? b.protocol : "both";
    // expected_origins / Ek C dökümü bu kökene bağlanır; yalnız bu sayfanın kendi kökeni (başka site isteği kullanamaz)
    const origin = webOrigin(b.origin);
    const hdr = req.headers.origin;
    if (!origin || origin !== pageOrigin || (typeof hdr === "string" && hdr !== origin))
      return reply.code(400).send({ error: "invalid_request", reason: `origin must be ${pageOrigin}` });
    const r = await app.inject({
      method: "POST",
      url: "/presentations",
      headers: { accept: "application/json", "content-type": "application/json", authorization: await bearer() },
      payload: { policy_id: policy, dc_api_origin: origin },
    });
    const j = r.json() as {
      presentation_id?: string;
      expires_at?: string;
      dc_api_requests?: Array<{ protocol: string; data: unknown }>;
      dc_mdoc_response_uri?: string;
      error?: string;
    };
    if (r.statusCode !== 200 || !j.presentation_id)
      return reply.code(502).send({ error: "verifier_error", reason: j.error ?? `HTTP ${r.statusCode}` });
    const all = j.dc_api_requests ?? [];
    const requests = choice === "both" ? all : all.filter((x) => x.protocol === PROTOCOLS[choice]);
    if (!requests.length)
      return reply.code(400).send({
        error: "invalid_request",
        reason:
          choice === "mdoc"
            ? "this policy has no org-iso-mdoc request (it needs a single mdoc credential)"
            : "no request for this protocol",
      });
    gc();
    const t = randomBytes(18).toString("base64url");
    runs.set(t, { presentationId: j.presentation_id, createdAt: Date.now() });
    return {
      t,
      expires_at: j.expires_at,
      requests,
      response_uris: {
        [PROTOCOLS.openid4vp]: `${cfg.publicBase}/vp/response`,
        ...(j.dc_mdoc_response_uri ? { [PROTOCOLS.mdoc]: j.dc_mdoc_response_uri } : {}),
      },
    };
  });

  app.get(`${DC_TEST_PATH}/result/:t`, async (req, reply) => {
    const run = runs.get((req.params as { t: string }).t);
    if (!run || Date.now() - run.createdAt > TTL_MS) return reply.code(404).send({ error: "not_found" });
    const id = encodeURIComponent(run.presentationId);
    if (!run.result) {
      const r = await app.inject({
        method: "GET",
        url: `/presentations/${id}`,
        headers: { authorization: await bearer() },
      });
      if (r.statusCode !== 200)
        return reply.code(502).send({ error: "verifier_error", reason: `HTTP ${r.statusCode}` });
      const j = r.json() as Record<string, unknown>;
      if (j.state === "PENDING" || !j.outcome) return { state: "PENDING" };
      run.result = j;
      // değerler bir kez ve kısa süre (K3) — sayfa bu deneme için bellekte tutar; gerçek ağda değer gösterilmez
      if (showValues) {
        const c = await app.inject({
          method: "GET",
          url: `/presentations/${id}/claims`,
          headers: { authorization: await bearer() },
        });
        run.claims =
          c.statusCode === 200 ? ((c.json() as { claims?: Record<string, unknown> | null }).claims ?? null) : null;
      }
    }
    const r = run.result;
    const trace = ctx.presentations.get(run.presentationId)?.trace.map((x) => x.step) ?? [];
    return {
      state: "DONE",
      outcome: r.outcome,
      failed_step: r.failed_step ?? null,
      failed_reason: r.failed_reason ?? null,
      checks: r.checks_performed ?? [],
      disclosed: r.disclosed_claims ?? [],
      ...(showValues ? { claims: run.claims ?? null } : {}),
      trace,
    };
  });
}
