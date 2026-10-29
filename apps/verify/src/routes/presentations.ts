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
  createMdocDcApiRequest,
  createPresentationRequest,
  decryptPresentationResponse,
  responseKidOf,
  openMdocDcApiResponse,
  dcqlFromPolicy,
  policyScopeViolations,
  registrationScopesFor,
  SDK_VERSION,
  SPEC_VERSION,
  PSEUDONYM_QUERY_ID,
  verifyPresentation,
  verifyPseudonym,
  type Policy,
  type VerificationResult,
} from "@tamga-network/verifier";
import type { VerifyContext } from "../app.js";
import { MAX_RESPONSE_ATTEMPTS, type Presentation } from "../state.js";
import { findPolicy, statusFetchOnDemandFor } from "../policies.js";
import { registrationCertFor, registrationCwtFor } from "../wrprc.js";
import { rateLimited } from "../rate-limit.js";
import { nowSeconds } from "@tamga-network/core/time";
import { checkPage, expiredPage, langOf, notFoundPage, pendingPage, resultPage, statusOnlyPage } from "../html.js";

export function registerPresentationRoutes(app: FastifyInstance, ctx: VerifyContext) {
  const { cfg, presentations } = ctx;
  const nowSec = nowSeconds;

  /** Beyan varsa doğrular: RP client_id · beyan yoksa null · beyan geçersizse false (401 gönderilmiştir). */
  /**
   * OpenID4VP 1.0 §8.2: yanıt ucunun cüzdana döndürdüğü TEK alan `redirect_uri`'dir (ek alan yok; OpenID öz-testi 2026-10-27, U2).
   * Kabulde yüz yüze kontrol görünümünün anahtarı (ADR-0012 C, sonuçtan sonra 5 dk) da bu adrese girer: "Kontrol ettir"de cüzdan
   * adresi QR olarak gösterir. Adres yalnızca şifreli yanıtı gönderen cüzdana gider — eski `show_url` alanıyla aynı alıcı.
   */
  const walletRedirectUri = (p: Presentation, pid: string, outcome: string) =>
    `${cfg.publicBase}/p/${pid}?st=${encodeURIComponent(p.statusToken)}` +
    (outcome === "ACCEPTED" ? `&show=${encodeURIComponent(p.showKey)}` : "");
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

  /** HTML sayfası için sahip denetimi: geçerli RP beyanı sunumu açan RP'ninse (hata yanıtı göndermez). */
  const isOwner = async (p: Presentation, authorization: string | undefined): Promise<boolean> => {
    if (!authorization || !p.owner) return false;
    try {
      return (await ctx.rpAuth(authorization)) === p.owner;
    } catch {
      return false;
    }
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
    // Hız sınırı kovası: doğrulanmış RP'nin kendi kovası; beyansız istekler ortak kova (vekil arkasında adres yok). Tek bir
    // istemcinin beyansız seli RP'lerin sunum açmasını durduramaz (güvenlik turu 2026-10-19).
    if (rateLimited(ctx.limits.presentations, who ? `rp:${who}` : (req.ip ?? ""), reply)) return reply;
    // Beyansız istek: sıkı kipte sunum doğrulayıcının KENDİ RP kaydına bağlanır (K5 örüntüsü, /sample-site/start gibi) — ana
    // sayfadaki "QR üret" ve cüzdanın başlattığı kontrol / geçiş kartı akışları (ADR-0012 B/C). Sonuç ve değerler hiçbir dış
    // çağırana verilmez (sahibi doğrulayıcının kendisi; HV1/HV2 değişmez); kişi yalnızca kendi kontrol bağlantısını gösterir.
    let owner = who ?? undefined;
    if (who === null) {
      if (cfg.requireRpAuth) owner = cfg.clientId;
      else reply.header("deprecation", "true"); // K6: beyansız eski yol yalnızca demo kipinde
    }
    // Beyansız sunum doğrulayıcının kendi kaydıyla imzalanır: DC API kökeni (expected_origins / Ek C dökümü) yalnız
    // doğrulayıcının kendi sayfasının kökeni olabilir — yoksa herhangi bir site, doğrulayıcının adıyla imzalı bir isteği kendi
    // sayfasında kullanır (cüzdan isteği doğrulayıcıya ait sanar; güvenlik incelemesi 2026-10-21)
    if (dcApiOrigin && cfg.requireRpAuth && who === null && dcApiOrigin !== new URL(cfg.publicBase).origin)
      return reply.code(400).send({
        error: "invalid_request",
        error_description: "dc_api_origin requires an RP assertion unless it is this verifier's own origin",
      });
    const made = await createPresentation(ctx, policy, owner, dcApiOrigin);
    if ("error" in made) return reply.code(400).send(made);
    const p = made.p;
    if (String(req.headers.accept ?? "").includes("application/json")) return startedJson(p, cfg.publicBase);
    // Sunumu açan sayfa durum jetonunu taşır: sıkı kipte /p/:id ayrıntıları yalnızca jetonla gösterir (HV1/HV2)
    return reply.redirect(`/p/${p.req.presentationId}?st=${encodeURIComponent(p.statusToken)}`);
  });

  // İstek nesnesi
  app.get("/vp/req/:id", async (req, reply) => {
    const p = presentations.get((req.params as { id: string }).id);
    if (!p || p.req.expiresAt < nowSec()) return reply.code(404).send("not found");
    p.trace.push({ t: Date.now(), step: "Wallet fetched the request object" });
    return reply.type("application/oauth-authz-req+jwt").send(p.req.requestJwt);
  });

  /**
   * Sahiplik kanıtına (A6 / Z1; yalnız takma adlı sunumda P1) ULAŞMADAN başarısız olan yanıt: sunum tüketilmez, deneme sayılır;
   * sınır dolunca sunum REJECTED ile kapanır. Yanıt 400 `invalid_request` (AP5: doğrulama sonucu değil, istek hatası).
   */
  const failedAttempt = (p: Presentation, pid: string, reply: FastifyReply, step: string | null, reason: string) => {
    p.attempts += 1;
    p.lastAttempt = { failed_step: step, failed_reason: reason, at: Date.now() };
    p.trace.push({
      t: Date.now(),
      step: `Response not accepted (attempt ${p.attempts}/${MAX_RESPONSE_ATTEMPTS}; presentation stays open)`,
      detail: step ? `${step}: ${reason}` : reason,
    });
    if (p.attempts >= MAX_RESPONSE_ATTEMPTS) {
      p.used = true;
      p.result = rejectedResult(pid, `too many failed responses (${p.attempts}); last: ${reason}`, ctx, step);
      p.resultAt = Date.now();
      p.trace.push({ t: Date.now(), step: "Presentation closed: response attempt limit reached" });
    }
    return reply.code(400).send({ error: "invalid_request", error_description: reason });
  };
  /** Sonuç sahiplik kanıtından geçti mi: SD-JWT KB-JWT / mdoc cihaz imzası (A6), ZK ispatı (Z1), yalnız takma ad (P1). */
  const holderBound = (r: VerificationResult) => r.checks_performed.some((s) => s === "A6" || s === "Z1" || s === "P1");

  // Şifreli yanıt → doğrulama · ya da OpenID4VP 1.0 §8.4 hata yanıtı (`error` + `state`: kişi reddetti, PV5)
  app.post("/vp/response", async (req, reply) => {
    const body = req.body as { response?: string; error?: string; state?: string };
    if (!body.response && typeof body.error === "string") {
      // Şifresiz hata yanıtı `kid` taşımaz; sunum `state` ile bulunur. Neden SAKLANMAZ (PV5): doğrulayıcı yalnız "vermedi"yi öğrenir;
      // `error_description` okunmaz. Sunum kapanır — aynı isteğe bir daha yanıt verilemez.
      if (typeof body.state !== "string" || !body.state)
        return reply.code(400).send({ error: "invalid_request", error_description: "state missing" });
      const p = presentations.byState(body.state);
      if (!p || p.req.expiresAt < nowSec())
        return reply.code(400).send({ error: "invalid_request", error_description: "bilinmeyen sunum" });
      const pid = p.req.presentationId;
      if (rateLimited(ctx.limits.vpResponse, `p:${pid}`, reply)) return reply;
      // Bir yanıt doğrulanırken gelen ret sonucu çeviremez: kabul tek yönlü durum değişikliğidir (PV10, §10.1). `state` istek
      // nesnesinde açık olduğundan ret yalnız cüzdandan gelmeyebilir; doğrulama bitince sunum ya tamamlanır ya açık kalır.
      if (p.busy)
        return reply.code(400).send({ error: "invalid_request", error_description: "a response is being processed" });
      p.used = true;
      p.result = rejectedResult(
        pid,
        body.error === "access_denied" ? "the wallet declined" : `wallet error: ${body.error.slice(0, 64)}`,
        ctx,
        null,
      );
      p.resultAt = Date.now();
      p.trace.push({ t: Date.now(), step: "Wallet returned an error response; no reason is stored (PV5)" });
      return { redirect_uri: `${cfg.publicBase}/p/${pid}?st=${encodeURIComponent(p.statusToken)}` };
    }
    const jwe = body.response;
    if (!jwe) return reply.code(400).send({ error: "invalid_request" });
    const pid = responseKidOf(jwe)?.presentationId ?? "";
    const p = presentations.get(pid);
    if (!p) return reply.code(400).send({ error: "invalid_request", error_description: "bilinmeyen sunum" });
    if (p.used)
      return reply.code(400).send({ error: "invalid_request", error_description: "nonce already used (PV10)" });
    if (p.req.expiresAt < nowSec())
      return reply.code(400).send({ error: "invalid_request", error_description: "request expired" });
    // Hız sınırı sunum başına (çözme işinden önce): bilinmeyen kimlikler jeton harcamaz, bir sunuma yönelik sel başka
    // kişilerin yanıtını durdurmaz (güvenlik turu 2026-10-19)
    if (rateLimited(ctx.limits.vpResponse, `p:${pid}`, reply)) return reply;
    // Aynı sunuma eşzamanlı ikinci yanıt doğrulama bitmeden işlenmez (tek kullanım, PV10; iki yol dahil)
    if (p.busy)
      return reply.code(400).send({ error: "invalid_request", error_description: "a response is being processed" });
    p.busy = true;
    try {
      return await handleEncryptedResponse(p, pid, jwe, reply);
    } finally {
      p.busy = false;
    }
  });
  async function handleEncryptedResponse(p: Presentation, pid: string, jwe: string, reply: FastifyReply) {
    // Sunum yalnız sahiplik kanıtı geçince TÜKETİLİR (SPEC-PROTO-0002 §10): çözülemeyen gövde, state uyuşmazlığı, boş vp_token ve
    // A1–A6 başarısızlığı sunumu kapatmaz (deneme sayılır, `failedAttempt`); sunum kimliği QR'da açık olduğundan aksi hâlde
    // yakındaki biri anlamsız bir gövdeyle gerçek kullanıcının sunumunu "reddedildi"ye düşürebilirdi.
    // 0.6.0: iki yol, iki anahtar — QR / bağlantının yanıtı cihazlar arası (response_uri), sayfanın ilettiği yanıt DC API
    // (köken) kurallarıyla doğrulanır; hangisi önce gelirse sunumu tamamlar, öteki tek kullanım kuralıyla düşer (PV10)
    let opened: Awaited<ReturnType<typeof decryptPresentationResponse>>;
    try {
      opened = await decryptPresentationResponse(jwe, p.req, `${cfg.publicBase}/vp/response`);
    } catch {
      return failedAttempt(p, pid, reply, null, "response could not be decrypted");
    }
    if (p.used)
      return reply.code(400).send({ error: "invalid_request", error_description: "nonce already used (PV10)" });
    const dec = opened.response;
    try {
      p.trace.push({
        t: Date.now(),
        step: `Response decrypted (JWE ECDH-ES/${jweEnc(jwe)}${opened.path === "dc_api" ? ", via browser Digital Credentials API" : ", cross-device"})`,
        detail: `state ${dec.state === p.req.state ? "matched" : dec.state === undefined && opened.path === "dc_api" ? "absent (DC API)" : "MISMATCH"}`,
      });
      // OpenID4VP 1.0 Ek A.2: `state` DC API için tanımlı değil — cüzdan yanıtta göndermeyebilir (doğrulayıcı bekleyemez). Bu yolda
      // sunuma bağlama yanıt şifrelemesinin anahtarı (`kid`), `nonce` ve köken (`expected_origins` / SessionTranscript) ile yapılır.
      // Gönderildiyse yine eşleşmeli. Cihazlar arası yolda `state` zorunlu kalır (eudi-dev denemesi 2026-10-29, K2).
      const stateOk = dec.state === p.req.state || (opened.path === "dc_api" && dec.state === undefined);
      if (!stateOk) return failedAttempt(p, pid, reply, null, "state mismatch");
      const pc = p.policy.credentials[0];
      const pres = pc ? dec.vp_token[pc.id]?.[0] : undefined;
      if (pc && !pres) return failedAttempt(p, pid, reply, null, `${pc.id} missing in vp_token`);
      // ADR-0031: yalnız takma adla giriş (belge yok) — sonuç takma ad denetiminden
      let out = !pc
        ? { result: pseudonymOnlyResult(pid, ctx), claims: {} as Record<string, unknown> | null }
        : await verifyPresentation({
            presentation: pres!,
            // OpenID4VP 1.0 Ek A.4: DC API'de sunumun hedefi `origin:` + köken — imzalı istekte de (SPEC-PROTO-0002 §7.1);
            // cihazlar arası yolda client identifier (PV7)
            aud: opened.path === "dc_api" && p.dcApiOrigin ? `origin:${p.dcApiOrigin}` : cfg.clientId,
            nonce: p.req.nonce,
            // D-CRED-5: format politikadan; mdoc SessionTranscript'i yanıtın geldiği yola göre (response_uri ya da köken)
            format: pc.format,
            ...opened.binding,
            policy: p.policy,
            policyCredentialId: pc.id,
            trust: ctx.trust(),
            statusCache: ctx.statusCache,
            rootCertsDer: ctx.rootDer(),
            // E3 (AP6, ADR-0017 K7/HV6): açıklanan alanlar sunumu açan (asıl) RP'nin kayıtlı kapsamıyla sınırlı — aracının değil
            rp: ctx.trust().relyingParty(p.owner ?? cfg.clientId),
            allowLocalIssuerUrls: !cfg.publicBase.startsWith("https://"), // yalnız yerel geliştirme
            // SPEC-CRED-0003 §9.1 / T1: yalnız sandbox'taki OpenID uyum öz-testi politikası (test aracının liste adresi her testte yeni)
            ...(statusFetchOnDemandFor(cfg.network, p.policy) ? { statusFetchOnDemand: { timeoutMs: 4000 } } : {}),
            now: nowSec(),
            verificationId: `vrf_${pid.slice(4)}`,
            audit: (e) => ctx.audit(e),
            zk: ctx.zk, // ADR-0032: mso_mdoc_zk için arka uç (yerel varsa o, yoksa WASM)
          });
      // doğrulama sürerken sunum başka yoldan kapandıysa (ör. Ek C yanıtı) bu yanıt sonucu ezmez (tek yönlü durum, PV10)
      if (p.used)
        return reply.code(400).send({ error: "invalid_request", error_description: "nonce already used (PV10)" });
      // Sahiplik kanıtına ulaşmayan sonuç (A1–A6 / Z1 reddi ya da doğrulayıcı tarafı ZK eksiği) sunumu tüketmez
      if (!holderBound(out.result))
        return failedAttempt(p, pid, reply, out.result.failed_step, out.result.failed_reason ?? out.result.outcome);
      p.used = true; // sahiplik kanıtı geçti: sunum bu yanıtla tamamlanır (B–E sonucu ne olursa olsun; PV10)
      // ADR-0056 K9: geçiş kartı yalnız verifyPresentation'ın kendi kabul çıktısından (aşağıda `out` yeniden kurulabilir)
      const verified = out;
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
              walletStatusOf: ctx.walletStatusOf, // ADR-0031 PS5: iptal edilmemiş cüzdan
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
        if (p.policy.proximity && pres) {
          // ADR-0012 B: politika geçiş kartı istiyorsa kabulde pass_grant ver (kişisel veri yok). a3/WL13: cüzdan ayrı kart
          // anahtarı kanıtı (`pass_key`) gönderdiyse kart ona bağlanır; yoksa holder anahtarına. Kanıt geçersizse kart
          // VERİLMEZ ama sunum kabulü bozulmaz: yanıtta `pass: { issued: false, reason }`.
          let g: Awaited<ReturnType<typeof ctx.passes.issue>> | null = null;
          try {
            g = await ctx.passes.issue({
              verified,
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
      // Aynı cihaz akışı: cüzdan bu adresi tarayıcıda açar; durum jetonu (ve kabulde kontrol görünümü anahtarı) yalnızca bu
      // yanıtla (şifreli yanıtı gönderen cüzdana) gider
      return { redirect_uri: walletRedirectUri(p, pid, out.result.outcome), ...extra };
    } catch (e) {
      // beklenmeyen hata (bozuk gövde vb.): sahiplik kanıtına ulaşmadıysa deneme; ulaştıysa sunum kapanır
      if (!p.used) return failedAttempt(p, pid, reply, null, (e as Error).message);
      p.trace.push({ t: Date.now(), step: "Response could not be processed", detail: (e as Error).message });
      p.result = rejectedResult(pid, (e as Error).message, ctx);
      p.resultAt = Date.now();
      return reply.code(400).send({ error: "invalid_request" }); // AP5: doğrulama SONUCU değil, istek biçimi hatası
    }
  }

  // ISO/IEC 18013-7 Ek C (`org-iso-mdoc`): sayfanın ilettiği HPKE şifreli DeviceResponse → doğrulama (sunum kimliği adreste;
  // şifreli yanıtta kimlik yok). Açılamayan yanıt sunumu tüketmez (/vp/response ile aynı kural).
  app.post("/vp/dc-mdoc/:id", async (req, reply) => {
    const pid = (req.params as { id: string }).id;
    const p = presentations.get(pid);
    if (!p || !p.mdocDc)
      return reply.code(400).send({ error: "invalid_request", error_description: "bilinmeyen sunum" });
    if (p.used)
      return reply.code(400).send({ error: "invalid_request", error_description: "nonce already used (PV10)" });
    if (p.req.expiresAt < nowSec())
      return reply.code(400).send({ error: "invalid_request", error_description: "request expired" });
    if (rateLimited(ctx.limits.vpResponse, `p:${pid}`, reply)) return reply;
    const response = (req.body as { response?: unknown } | undefined)?.response;
    if (p.busy)
      return reply.code(400).send({ error: "invalid_request", error_description: "a response is being processed" });
    let opened: ReturnType<typeof openMdocDcApiResponse>;
    try {
      opened = openMdocDcApiResponse(response, p.mdocDc);
    } catch {
      return failedAttempt(p, pid, reply, null, "response could not be decrypted");
    }
    p.trace.push({
      t: Date.now(),
      step: "Response decrypted (HPKE P-256/AES-128-GCM, ISO/IEC 18013-7 Annex C, via browser Digital Credentials API)",
    });
    if ("refused" in opened) {
      // cüzdan belge vermedi (ISO 18013-5 DeviceResponse status): kişinin reddi — sunum kapanır, neden saklanmaz (PV5)
      p.used = true;
      p.result = rejectedResult(pid, "the wallet returned no document", ctx, null);
      p.resultAt = Date.now();
      p.trace.push({ t: Date.now(), step: "Wallet declined" });
      return { redirect_uri: `${cfg.publicBase}/p/${pid}?st=${encodeURIComponent(p.statusToken)}` };
    }
    p.busy = true;
    let out: Awaited<ReturnType<typeof verifyPresentation>>;
    try {
      out = await verifyPresentation({
        presentation: opened.presentation,
        aud: cfg.clientId,
        nonce: p.req.nonce,
        format: "mso_mdoc",
        sessionTranscript: p.mdocDc.sessionTranscript,
        policy: p.policy,
        policyCredentialId: p.mdocDc.policyCredentialId,
        trust: ctx.trust(),
        statusCache: ctx.statusCache,
        rootCertsDer: ctx.rootDer(),
        rp: ctx.trust().relyingParty(p.owner ?? cfg.clientId), // E3: asıl RP'nin kapsamı (ADR-0017 K7/HV6)
        allowLocalIssuerUrls: !cfg.publicBase.startsWith("https://"),
        now: nowSec(),
        verificationId: `vrf_${pid.slice(4)}`,
        audit: (e) => ctx.audit(e),
      });
    } finally {
      p.busy = false;
    }
    if (p.used)
      return reply.code(400).send({ error: "invalid_request", error_description: "nonce already used (PV10)" });
    // sahiplik kanıtına (cihaz imzası, A6) ulaşmayan yanıt sunumu tüketmez (/vp/response ile aynı kural)
    if (!holderBound(out.result))
      return failedAttempt(p, pid, reply, out.result.failed_step, out.result.failed_reason ?? out.result.outcome);
    p.used = true;
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
    return { redirect_uri: walletRedirectUri(p, pid, out.result.outcome) };
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
    return p.result ?? pendingView(p);
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
    const q = req.query as { show?: string; st?: string };
    // ADR-0012 C: kontrol görünümü kendi anahtarıyla (5 dk). Anahtar cüzdanın `redirect_uri`'sinde durum jetonuyla birlikte gelir:
    // süresi geçince adres durum jetonuyla olağan sonuç sayfasına düşer; jetonsuz eski anahtar 410
    if (q.show !== undefined && p.result) {
      if (presentations.showAllowed(p, q.show))
        return checkPage(lang, p, p.result, id, ctx.trust().relyingParty(cfg.clientId)?.dns_name ?? cfg.clientId);
      if (q.st === undefined || !sameSecret(q.st, p.statusToken)) return reply.code(410).send(expiredPage(lang));
    }
    // ADR-0017 HV1/HV2: sahibi olan sunumda ayrıntı (QR + durum jetonlu bekleme, sonuç, iz) yalnızca durum jetonuyla ya da
    // sahibin beyanıyla; sunum kimliği QR'da açık olduğundan kimliği bilen herkes yalnızca nötr durumu görür
    const full =
      !p.owner ||
      (q.st !== undefined && sameSecret(q.st, p.statusToken)) ||
      (await isOwner(p, req.headers.authorization));
    if (!full) return statusOnlyPage(lang, !!p.result);
    if (!p.result) return pendingPage(lang, p, id, await QRCode.toDataURL(p.req.qrPayload, { margin: 1, width: 280 }));
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
    onBehalfOf: owner,
    passGrantOffered: !!policy.proximity, // a3/WL13: cüzdan geçiş kartı için ayrı anahtar hazırlar
    // ADR-0026 K4: isteğin kullanımının kayıt sertifikası (varsa; istek başına tek — RPRC_19) verifier_info ile
    registrationCert: registrationCertFor(cfg.trustDist, owner ?? cfg.clientId, registrationScopesFor(policy, rpRec)),
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
  if (dcApiOrigin) {
    p.dcApiOrigin = dcApiOrigin;
    // ISO/IEC 18013-7 Ek C: tek mdoc belgesi isteyen, takma adsız ve geçiş kartsız politikada ikinci DC API isteği
    if (
      policy.credentials.length === 1 &&
      policy.credentials[0].format === "mso_mdoc" &&
      !policy.pseudonym &&
      !policy.proximity
    ) {
      const mdocDc = createMdocDcApiRequest({
        policy,
        origin: dcApiOrigin,
        readerAuth: ctx.readerAuth,
        registrationCwt: registrationCwtFor(cfg.trustDist, owner ?? cfg.clientId, registrationScopesFor(policy, rpRec)),
      });
      if (mdocDc) p.mdocDc = mdocDc;
    }
  }
  return { p };
}

/**
 * Açılan sunumun JSON yanıtı (`POST /presentations` ve örnek site `/sample-site/start` ortak). Sayfa kökeniyle açıldıysa DC API
 * istekleri: OpenID4VP (`openid4vp-v1-signed`) ve politika tek mdoc belgesi istiyorsa ISO/IEC 18013-7 Ek C (`org-iso-mdoc`).
 */
export function startedJson(p: Presentation, publicBase: string) {
  return {
    presentation_id: p.req.presentationId,
    request_uri: p.req.requestUri,
    qr_payload: p.req.qrPayload,
    expires_at: new Date(p.req.expiresAt * 1000).toISOString(),
    status_token: p.statusToken,
    ...(p.req.dcApiRequest ? { dc_api_request: p.req.dcApiRequest } : {}),
    // 0.6.0: tarayıcı protokolü seçer — OpenID4VP (Chrome/Edge) ya da ISO/IEC 18013-7 Ek C (Safari / iOS 26)
    ...(p.req.dcApiRequest
      ? {
          dc_api_requests: [p.req.dcApiRequest, ...(p.mdocDc ? [p.mdocDc.dcApiRequest] : [])],
          ...(p.mdocDc ? { dc_mdoc_response_uri: `${publicBase}/vp/dc-mdoc/${p.req.presentationId}` } : {}),
        }
      : {}),
  };
}

/** Sayfa kökeni: yalnız https (yerel geliştirmede http://localhost); yol/sorgu yok. */
export function webOrigin(v: unknown): string | undefined {
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

/**
 * Bekleyen sunumun durumu: sunum açık; sahiplik kanıtına ulaşmadan başarısız olan yanıtlar sayılır ve sonuncusu gösterilir (RP
 * "cüzdan yanlış/eski bir yanıt gönderdi"yi görür; sunum yine de tamamlanabilir). Değer yok, kişisel veri yok.
 */
function pendingView(p: Presentation) {
  return {
    state: "PENDING",
    attempts: p.attempts,
    ...(p.lastAttempt
      ? { last_attempt: { failed_step: p.lastAttempt.failed_step, failed_reason: p.lastAttempt.failed_reason } }
      : {}),
  };
}

/** K4: tarayıcıya giden durum — değer yok, alan adı yok. */
function statusView(p: Presentation) {
  if (!p.result) return { state: "PENDING", attempts: p.attempts };
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
    sdk_version: SDK_VERSION,
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

/** Doğrulama hattına girmeyen ret (istek biçimi, kişinin reddi, deneme sınırı). `step` null: adım yok (cüzdan reddetti). */
function rejectedResult(
  pid: string,
  reason: string,
  ctx: VerifyContext,
  step: VerificationResult["failed_step"] | string | null = "A1",
): VerificationResult {
  const f = ctx.trust().freshness();
  return {
    verification_id: `vrf_${pid.slice(4)}`,
    outcome: "REJECTED",
    failed_step: step as VerificationResult["failed_step"],
    failed_reason: reason,
    indeterminate_reason: null,
    spec_version: SPEC_VERSION,
    sdk_version: SDK_VERSION,
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
