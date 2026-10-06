/**
 * Sunum uçları: istek oluştur → istek nesnesi → şifreli yanıt → sonuç (JSON + HTML).
 * ADR-0017 (D-API-2): sunumu açan RP'ye bağlı (K2); sonuç ve değerler yalnızca o RP'ye, RP beyanıyla (K1); değerler bir kez ve
 * ≤ 5 dk (K3); tarayıcı yalnızca durum jetonuyla durum görür (K4); aracı istekte `tamga_on_behalf_of` (K7). Demo kipinde
 * (`requireRpAuth` kapalı) beyansız eski yol `Deprecation` başlığıyla çalışır (K6).
 */
import type { FastifyInstance, FastifyReply } from "fastify";
import { timingSafeEqual } from "node:crypto";
import QRCode from "qrcode";
import {
  createPresentationRequest,
  decryptResponse,
  dcqlFromPolicy,
  policyScopeViolations,
  registrationScopesFor,
  SPEC_VERSION,
  PSEUDONYM_QUERY_ID,
  verifyPresentation,
  verifyPseudonym,
  type Policy,
  type VerificationResult,
} from "@tamga-network/verifier";
import type { VerifyContext } from "../app.js";
import type { Presentation } from "../state.js";
import { findPolicy } from "../policies.js";
import { registrationCertsFor } from "../wrprc.js";
import { checkPage, expiredPage, langOf, notFoundPage, pendingPage, resultPage } from "../html.js";

export function registerPresentationRoutes(app: FastifyInstance, ctx: VerifyContext) {
  const { cfg, presentations } = ctx;
  const nowSec = () => Math.floor(Date.now() / 1000);

  /** Beyan varsa doğrular: RP client_id · beyan yoksa null · beyan geçersizse false (401 gönderilmiştir). */
  const callerOf = async (authorization: string | undefined, reply: FastifyReply): Promise<string | null | false> => {
    if (!authorization) return null;
    try {
      return await ctx.rpAuth(authorization);
    } catch (e) {
      reply.code(401).send({ error: "invalid_rp_assertion", error_description: (e as Error).message });
      return false;
    }
  };
  /** Sonuç/değer okuma izni: sunumu açan RP (HV1/HV2); RP'siz eski sunum yalnızca demo kipinde. Varlık sızdırılmaz (404). */
  const mayRead = async (p: Presentation, authorization: string | undefined, reply: FastifyReply): Promise<boolean> => {
    const who = await callerOf(authorization, reply);
    if (who === false) return false;
    if (who === null) {
      if (p.owner || cfg.requireRpAuth) {
        reply.code(404).send({ error: "not_found" });
        return false;
      }
      reply.header("deprecation", "true");
      return true;
    }
    if (who !== (p.owner ?? cfg.clientId)) {
      reply.code(404).send({ error: "not_found" });
      return false;
    }
    return true;
  };

  // 4.1 Sunum isteği başlat
  app.post("/presentations", async (req, reply) => {
    const body = req.body as { policy_id?: string; dc_api_origin?: unknown };
    const policy = findPolicy(body.policy_id, ctx.policies);
    if (!policy) return reply.code(400).send({ error: "unknown_policy" });
    // Digital Credentials API: sayfa kökeni verildiyse istek tarayıcı yoluna göre (dc_api.jwt + expected_origins) kurulur
    let dcApiOrigin: string | undefined;
    if (body.dc_api_origin !== undefined) {
      dcApiOrigin = webOrigin(body.dc_api_origin);
      if (!dcApiOrigin) return reply.code(400).send({ error: "invalid_request", error_description: "dc_api_origin" });
    }
    const who = await callerOf(req.headers.authorization, reply);
    if (who === false) return reply;
    // Beyansız istek: sıkı kipte sunum doğrulayıcının KENDİ RP kaydına bağlanır (K5 örüntüsü, /sample-site/start gibi) — ana
    // sayfadaki "QR üret" ve cüzdanın başlattığı kontrol / geçiş kartı akışları (ADR-0012 B/C). Sonuç ve değerler hiçbir dış
    // çağırana verilmez (sahibi doğrulayıcının kendisi; HV1/HV2 değişmez); kişi yalnızca kendi kontrol bağlantısını gösterir.
    let owner = who ?? undefined;
    if (who === null) {
      if (cfg.requireRpAuth) owner = cfg.clientId;
      else reply.header("deprecation", "true"); // K6: beyansız eski yol yalnızca demo kipinde
    }
    const made = await createPresentation(ctx, policy, owner, dcApiOrigin);
    if ("error" in made) return reply.code(400).send(made);
    const p = made.p;
    if (String(req.headers.accept ?? "").includes("application/json"))
      return {
        presentation_id: p.req.presentationId,
        request_uri: p.req.requestUri,
        qr_payload: p.req.qrPayload,
        expires_at: new Date(p.req.expiresAt * 1000).toISOString(),
        status_token: p.statusToken,
        ...(p.req.dcApiRequest ? { dc_api_request: p.req.dcApiRequest } : {}),
      };
    return reply.redirect(`/p/${p.req.presentationId}`);
  });

  // İstek nesnesi
  app.get("/vp/req/:id", async (req, reply) => {
    const p = presentations.get((req.params as { id: string }).id);
    if (!p || p.req.expiresAt < nowSec()) return reply.code(404).send("not found");
    p.trace.push({ t: Date.now(), step: "Wallet fetched the request object" });
    return reply.type("application/oauth-authz-req+jwt").send(p.req.requestJwt);
  });

  // Şifreli yanıt → doğrulama
  app.post("/vp/response", async (req, reply) => {
    const jwe = (req.body as { response?: string }).response;
    if (!jwe) return reply.code(400).send({ error: "invalid_request" });
    const pid = presentationIdOf(jwe);
    const p = presentations.get(pid);
    if (!p) return reply.code(400).send({ error: "invalid_request", error_description: "bilinmeyen sunum" });
    if (p.used)
      return reply.code(400).send({ error: "invalid_request", error_description: "nonce already used (PV10)" });
    if (p.req.expiresAt < nowSec())
      return reply.code(400).send({ error: "invalid_request", error_description: "request expired" });
    // Çözülemeyen (bozuk/yabancı) yanıt sunumu TÜKETMEZ: sunum kimliği QR'da açık olduğundan, aksi hâlde yakındaki biri
    // anlamsız bir gövdeyle gerçek kullanıcının sunumunu "reddedildi"ye düşürebilirdi.
    let dec: Awaited<ReturnType<typeof decryptResponse>>;
    try {
      dec = await decryptResponse(jwe, p.req.encPrivateKey);
    } catch {
      return reply.code(400).send({ error: "invalid_request", error_description: "response could not be decrypted" });
    }
    if (p.used)
      return reply.code(400).send({ error: "invalid_request", error_description: "nonce already used (PV10)" });
    p.used = true; // çözümden sonra ve await olmadan: eşzamanlı iki yanıttan yalnızca biri işlenir
    try {
      p.trace.push({
        t: Date.now(),
        step: `Response decrypted (JWE ECDH-ES/${jweEnc(jwe)}${p.dcApiOrigin ? ", via browser Digital Credentials API" : ""})`,
        detail: `state ${dec.state === p.req.state ? "matched" : "MISMATCH"}`,
      });
      if (dec.state !== p.req.state) throw new Error("state mismatch");
      const pc = p.policy.credentials[0];
      const pres = pc ? dec.vp_token[pc.id]?.[0] : undefined;
      if (pc && !pres) throw new Error(`${pc.id} missing in vp_token`);
      // ADR-0031: yalnız takma adla giriş (belge yok) — sonuç takma ad denetiminden
      let out = !pc
        ? { result: pseudonymOnlyResult(pid, ctx), claims: {} as Record<string, unknown> | null }
        : await verifyPresentation({
            presentation: pres!,
            aud: cfg.clientId,
            nonce: p.req.nonce,
            // D-CRED-5: format politikadan; mdoc SessionTranscript'i için bu isteğin response_uri'si
            format: pc.format,
            ...(p.dcApiOrigin ? { origin: p.dcApiOrigin } : { responseUri: `${cfg.publicBase}/vp/response` }),
            encJwkThumbprint: p.req.encJwkThumbprint,
            policy: p.policy,
            policyCredentialId: pc.id,
            trust: ctx.trust(),
            statusCache: ctx.statusCache,
            rootCertsDer: ctx.rootDer(),
            rp: ctx.trust().relyingParty(cfg.clientId),
            allowLocalIssuerUrls: !cfg.publicBase.startsWith("https://"), // yalnız yerel geliştirme
            now: nowSec(),
            verificationId: `vrf_${pid.slice(4)}`,
            audit: (e) => ctx.audit(e),
            zk: ctx.zk, // ADR-0032: mso_mdoc_zk için arka uç (yerel varsa o, yoksa WASM)
          });
      // ADR-0031 PS5: takma ad — imza, aud, nonce, site, iptal edilmemiş cüzdan örneği (WIA). Değer yalnız claims'e (HV3).
      if (p.policy.pseudonym && out.result.outcome === "ACCEPTED") {
        const tok = dec.vp_token[PSEUDONYM_QUERY_ID]?.[0];
        const ps = tok
          ? await verifyPseudonym({
              token: tok,
              aud: cfg.clientId,
              nonce: p.req.nonce,
              // ADR-0034: takma ad sitenin kalıcı kimliğine (alan adı) bağlı; client_id sertifika yenilenince değişir
              rpKey: ctx.trust().relyingParty(p.owner ?? cfg.clientId)?.dns_name ?? p.owner ?? cfg.clientId,
              trust: ctx.trust(),
              now: nowSec(),
            })
          : { ok: false as const, reason: "pseudonym missing in vp_token", indeterminate: false };
        p.trace.push({
          t: Date.now(),
          step: ps.ok
            ? "Site pseudonym verified (signature, audience, nonce, wallet instance)"
            : "Site pseudonym rejected",
          detail: ps.ok ? undefined : ps.reason,
        });
        if (ps.ok) out = { ...out, claims: { ...(out.claims ?? {}), pseudonym: ps.pseudonym } };
        else
          out = {
            result: {
              ...out.result,
              outcome: ps.indeterminate ? "INDETERMINATE" : "REJECTED",
              failed_step: ps.indeterminate ? null : "P1",
              failed_reason: ps.indeterminate ? null : ps.reason,
              indeterminate_reason: ps.indeterminate ? "INDEXER_STALE" : null,
            },
            claims: null,
          };
        if (!pc)
          ctx.audit({
            verification_id: out.result.verification_id,
            outcome: out.result.outcome,
            failed_step: out.result.failed_step,
            disclosed: [],
            ts: nowSec(),
          });
      }
      p.result = out.result;
      p.claims = out.claims;
      p.resultAt = Date.now();
      p.trace.push({
        t: Date.now(),
        step: `Verification: ${out.result.outcome}`,
        detail: out.result.failed_step
          ? `${out.result.failed_step}: ${out.result.failed_reason}`
          : `${out.result.checks_performed.length} checks passed`,
      });
      const extra: Record<string, unknown> = {};
      if (out.result.outcome === "ACCEPTED") {
        extra.show_url = `${cfg.publicBase}/p/${pid}?show=${p.showKey}`; // ADR-0012 C: kontrol görünümü, 5 dk
        if (p.policy.proximity && pres) {
          // ADR-0012 B: politika geçiş kartı istiyorsa kabulde pass_grant ver (kişisel veri yok). a3/WL13: cüzdan ayrı kart
          // anahtarı kanıtı (`pass_key`) gönderdiyse kart ona bağlanır; yoksa holder anahtarına. Kanıt geçersizse kart
          // VERİLMEZ ama sunum kabulü bozulmaz: yanıtta `pass: { issued: false, reason }`.
          let g: Awaited<ReturnType<typeof ctx.passes.issue>> | null = null;
          try {
            g = await ctx.passes.issue({
              presentation: pres,
              presentationId: pid,
              policy: p.policy.proximity,
              ...(typeof dec.pass_key === "string" ? { passKey: { jws: dec.pass_key, nonce: p.req.nonce } } : {}),
            });
          } catch {
            extra.pass = { issued: false, reason: "invalid_pass_key" };
            p.trace.push({ t: Date.now(), step: "Access pass not issued", detail: "invalid pass_key proof" });
          }
          if (g) {
            extra.pass_grant = g.jws;
            extra.pass = { issued: true };
            p.trace.push({
              t: Date.now(),
              step: "Access pass issued (pass_grant)",
              detail: `${g.record.passId} · group ${g.record.terminalGroup} · ${p.policy.proximity.valid_days} days`,
            });
            ctx.audit({ event: "pass.issued", pass_id: g.record.passId, terminal_group: g.record.terminalGroup });
          }
        }
      }
      return { redirect_uri: `${cfg.publicBase}/p/${pid}`, ...extra };
    } catch (e) {
      p.trace.push({ t: Date.now(), step: "Response could not be processed", detail: (e as Error).message });
      p.result = rejectedResult(pid, (e as Error).message, ctx);
      p.resultAt = Date.now();
      return reply.code(400).send({ error: "invalid_request" }); // AP5: doğrulama SONUCU değil, istek biçimi hatası
    }
  });

  // 4.2 / 4.3
  app.get("/presentations/:id", async (req, reply) => {
    const p = presentations.get((req.params as { id: string }).id);
    if (!p) return reply.code(404).send({ error: "not_found" });
    const st = (req.query as { st?: string }).st ?? (req.headers["x-tamga-status-token"] as string | undefined);
    if (st !== undefined && !req.headers.authorization) {
      if (!sameSecret(st, p.statusToken)) return reply.code(404).send({ error: "not_found" });
      return statusView(p); // K4: tarayıcı yalnızca durumu görür
    }
    if (!(await mayRead(p, req.headers.authorization, reply))) return reply;
    return p.result ?? { state: "PENDING" };
  });
  app.get("/presentations/:id/claims", async (req, reply) => {
    const p = presentations.get((req.params as { id: string }).id);
    if (!p) return reply.code(404).send({ error: "not_found" });
    if (!(await mayRead(p, req.headers.authorization, reply))) return reply;
    if (!p.result) return { claims: null };
    const c = presentations.takeClaims(p);
    if (c === "gone") return reply.code(410).send({ error: "claims_gone" }); // K3: bir kez, ≤ 5 dk
    return { claims: c };
  });

  // HTML: bekleme / sonuç / kontrol görünümü
  app.get("/p/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const p = presentations.get(id);
    if (!p)
      return reply
        .code(404)
        .type("text/html")
        .send(notFoundPage(langOf(req.headers["accept-language"])));
    reply.type("text/html");
    const lang = langOf(req.headers["accept-language"]);
    if (!p.result) return pendingPage(lang, p, id, await QRCode.toDataURL(p.req.qrPayload, { margin: 1, width: 280 }));
    const key = (req.query as { show?: string }).show;
    if (key !== undefined) {
      if (!presentations.showAllowed(p, key)) return reply.code(410).send(expiredPage(lang));
      return checkPage(lang, p, p.result, id, ctx.trust().relyingParty(cfg.clientId)?.dns_name ?? cfg.clientId);
    }
    return resultPage(lang, p, p.result, id, !cfg.requireRpAuth && !p.owner);
  });
}

/**
 * Sunum oluştur (HTTP ucu ve örnek site ortak). `owner`: sunumu açan RP; kapsam denetimi onun kaydına göre (AP6/K2);
 * aracıysak istek nesnesi `tamga_on_behalf_of` taşır (K7).
 */
export async function createPresentation(
  ctx: VerifyContext,
  policy: Policy,
  owner?: string,
  dcApiOrigin?: string,
): Promise<{ p: Presentation } | { error: string; detail?: unknown }> {
  const { cfg } = ctx;
  const rpRec = ctx.trust().relyingParty(owner ?? cfg.clientId);
  const viol = policyScopeViolations(policy, rpRec);
  if (viol.length) return { error: "policy_exceeds_scope", detail: viol }; // AP6
  const pr = await createPresentationRequest({
    signer: ctx.signer,
    // ADR-0032: ZK sorgusu imzalı listedeki etkin devreleri önerir (ZK2)
    dcql: dcqlFromPolicy(policy, { zkCircuits: ctx.trust().zkCircuits?.() ?? [] }),
    responseUri: `${cfg.publicBase}/vp/response`,
    requestUriBase: `${cfg.publicBase}/vp/req`,
    purpose: policy.purpose["en-US"],
    onBehalfOf: owner,
    passGrantOffered: !!policy.proximity, // a3/WL13: cüzdan geçiş kartı için ayrı anahtar hazırlar
    // ADR-0026 K4: kullanımın kayıt sertifikası (varsa) verifier_info ile
    registrationCerts: registrationCertsFor(cfg.trustDist, owner ?? cfg.clientId, registrationScopesFor(policy, rpRec)),
    ...(dcApiOrigin ? { dcApi: { expectedOrigins: [dcApiOrigin] } } : {}),
  });
  const p = ctx.presentations.create(
    pr,
    policy,
    {
      t: Date.now(),
      step: "Signed request object created (JAR, ES256, x5c=rp-verify)",
      detail: `client_id ${cfg.clientId}${owner && owner !== cfg.clientId ? ` · adına: ${owner}` : ""} · nonce ${pr.nonce.slice(0, 8)}… · DCQL ${policy.credentials.map((c) => c.id).join(",")}`,
    },
    owner,
  );
  if (dcApiOrigin) p.dcApiOrigin = dcApiOrigin;
  return { p };
}

/** Sayfa kökeni: yalnız https (yerel geliştirmede http://localhost); yol/sorgu yok. */
function webOrigin(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  try {
    const u = new URL(v);
    const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
    if (u.origin !== v || (u.protocol !== "https:" && !(local && u.protocol === "http:"))) return undefined;
    return u.origin;
  } catch {
    return undefined;
  }
}

/** K4: tarayıcıya giden durum — değer yok, alan adı yok. */
function statusView(p: Presentation) {
  if (!p.result) return { state: "PENDING" };
  return {
    state: "DONE",
    outcome: p.result.outcome,
    failed_reason: p.result.outcome === "ACCEPTED" ? null : p.result.failed_reason,
    indeterminate_reason: p.result.indeterminate_reason,
  };
}

function sameSecret(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** JWE başlığındaki kid = enc-<presentationId>. */
function presentationIdOf(jwe: string): string {
  try {
    const h = JSON.parse(Buffer.from(jwe.split(".")[0], "base64url").toString("utf8")) as { kid?: string };
    return (h.kid ?? "").replace(/^enc-/, "");
  } catch {
    return "";
  }
}

/** ADR-0031: belgesiz (yalnız takma adlı) sunumun sonuç iskeleti — takma ad denetimi P1 ile tamamlar; değer yok (AP3). */
function pseudonymOnlyResult(pid: string, ctx: VerifyContext): VerificationResult {
  const f = ctx.trust().freshness();
  return {
    verification_id: `vrf_${pid.slice(4)}`,
    outcome: "ACCEPTED",
    failed_step: null,
    failed_reason: null,
    indeterminate_reason: null,
    spec_version: SPEC_VERSION,
    sdk_version: "@tamga-network/verifier@1.0.0",
    checks_performed: ["P1"],
    checks_skipped: [],
    issuer: null,
    schema: null,
    disclosed_claims: [],
    status: { value: "NOT_APPLICABLE", list_version: null, token_age_sec: null },
    freshness: { trust_source: f.source, trust_version: f.version, trust_age_sec: f.ageSec },
    evaluated_at: new Date().toISOString(),
  };
}

function rejectedResult(pid: string, reason: string, ctx: VerifyContext): VerificationResult {
  const f = ctx.trust().freshness();
  return {
    verification_id: `vrf_${pid.slice(4)}`,
    outcome: "REJECTED",
    failed_step: "A1",
    failed_reason: reason,
    indeterminate_reason: null,
    spec_version: SPEC_VERSION,
    sdk_version: "@tamga-network/verifier@1.0.0",
    checks_performed: [],
    checks_skipped: [],
    issuer: null,
    schema: null,
    disclosed_claims: [],
    status: { value: "UNKNOWN", list_version: null, token_age_sec: null },
    freshness: { trust_source: f.source, trust_version: f.version, trust_age_sec: f.ageSec },
    evaluated_at: new Date().toISOString(),
  };
}

/** JWE korumalı başlığındaki içerik şifrelemesi (günlük için; doğrulama decryptResponse içinde). */
function jweEnc(jwe: string): string {
  try {
    return String(JSON.parse(Buffer.from(jwe.split(".")[0], "base64url").toString()).enc);
  } catch {
    return "?";
  }
}
