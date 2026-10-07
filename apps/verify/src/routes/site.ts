/**
 * D11 v1 — "Tamga ile Kayıt Ol / Giriş Yap" örnek sitesi + site kiti.
 *  GET  /tamga-verifier.js        site kiti: `@tamga-network/verifier/web` paketlenmiş hâli (window.TamgaVerifier; <script> ile)
 *  GET  /presentations/:id/qr.png istek QR'ı (kişisel veri yok; yalnızca request_uri)
 *  GET  /demo-site                örnek site: kayıt (site-signup) / giriş (site-signin); oturum çerezi
 *  POST /demo-site/start          {policy} → sunumu SİTE SUNUCUSU açar (ADR-0017 K5: örnek site de RP kuralına uyar)
 *  POST /demo-site/session        {presentation_id} → doğrulanmış sunumun onaylanan alanları (bir kez) → hesap → çerez
 *  POST /demo-site/logout
 * D11 adım 2 — passkey (WebAuthn; ARF Topic 11 "pseudonym" yaklaşımı):
 *  POST /demo-site/passkey/register/options|verify   oturum açıkken bu cihaza passkey ekle
 *  POST /demo-site/passkey/login/options|verify      telefonsuz giriş: yalnızca passkey — belge sunumu YOK, hiçbir alan açıklanmaz
 * Hesap anahtarı (ADR-0031): cüzdanın BU SİTEYE özel takma adı — kimlik belgesinin özeti ya da kimlik numarası siteye hiç gitmez (PS4).
 * Takma ad başka bir sitede farklıdır (siteler eşleştiremez); yeni telefonda kimlik yeniden doğrulanınca aynısı döner (hesap
 * kaybolmaz). Site yine de takma adın site-anahtarlı özetini (`HMAC(siteSırrı, takma ad)`) tutar. Kayıt: ad + soyad + takma ad;
 * giriş: yalnız takma ad; günlük giriş passkey ile (belge sunumu yok). S-17 kapandı (2026-10-01).
 * Güvenli bağlam: WebAuthn IP adresinde çalışmaz — localhost ya da HTTPS alan adı gerekir (rpID = sayfanın alan adı).
 */
import type { FastifyInstance } from "fastify";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { createHmac, randomBytes } from "node:crypto";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
  type WebAuthnCredential,
} from "@simplewebauthn/server";
import QRCode from "qrcode";
import type { VerifyContext } from "../app.js";
import { demoSitePage, langOf } from "../html.js";
import { findPolicy } from "../policies.js";
import { createPresentation } from "./presentations.js";
import { sandboxSampleSiteUrl } from "../config.js";

interface Account {
  /** Site-anahtarlı özet: HMAC(siteSırrı, takma ad) — ham değer saklanmaz. */
  key: string;
  /** WebAuthn user.id (rastgele; kişisel veri değil). */
  userId: string;
  givenName: string;
  familyName: string;
  createdAt: number;
  logins: number;
  passkeys: WebAuthnCredential[];
}
const CHALLENGE_TTL_MS = 5 * 60_000;
const SESSION_COOKIE = "tamga_site_session";
const SESSION_TTL_MS = 60 * 60_000; // çerez Max-Age ile aynı; sunucu tarafında da uygulanır (Y3)
const MAX_PENDING = 10_000; // bekleyen challenge üst sınırı (bellek şişirme — Y3)
// ADR-0033: `review-site-signup` yalnız mağaza incelemesi DEMO belgesini (I1) kabul eden kayıt; giriş yine `site-signin` (takma ad)
const SITE_POLICIES = new Set(["site-signup", "site-signin", "review-site-signup"]);
const SIGNUP_POLICIES = new Set(["site-signup", "review-site-signup"]);
/** ADR-0031: doğrulayıcının claims'e koyduğu site başına takma ad (verifyPseudonym) */
const ACCOUNT_KEY_CLAIM = "pseudonym";

export function registerSiteRoutes(app: FastifyInstance, ctx: VerifyContext) {
  const accounts = new Map<string, Account>(); // demo: bellekte
  const sessions = new Map<string, { key: string; exp: number }>(); // sessionId → hesap + sunucu tarafı son geçerlilik
  // Site sırrı: gerçek sitede kalıcı gizli anahtar (KMS); demo bellekte, süreç başına
  const siteSecret = process.env.TAMGA_DEMO_SITE_SECRET ?? randomBytes(32).toString("base64url");
  const accountKeyOf = (raw: string) => createHmac("sha256", siteSecret).update(raw).digest("base64url");
  const challenges = new Map<string, { challenge: string; exp: number; account?: string }>();
  const putChallenge = (id: string, c: { challenge: string; exp: number; account?: string }) => {
    if (challenges.size >= MAX_PENDING) {
      const now = Date.now();
      for (const [k, v] of challenges) if (v.exp <= now) challenges.delete(k); // süresi dolanları süpür
      if (challenges.size >= MAX_PENDING) challenges.delete(challenges.keys().next().value!); // hâlâ doluysa en eskisi
    }
    challenges.set(id, c);
  };
  // HTTPS'te Secure bayrağı (demo LAN http'de çerez yine çalışsın)
  const secure = ctx.cfg.publicBase.startsWith("https://") ? "; Secure" : "";
  const newSession = (key: string) => {
    const sid = randomBytes(18).toString("base64url");
    if (sessions.size >= MAX_PENDING) {
      const now = Date.now();
      for (const [k, v] of sessions) if (v.exp <= now) sessions.delete(k); // süresi dolan oturumları süpür (Y3)
      if (sessions.size >= MAX_PENDING) sessions.delete(sessions.keys().next().value!);
    }
    sessions.set(sid, { key, exp: Date.now() + SESSION_TTL_MS });
    return `${SESSION_COOKIE}=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600${secure}`;
  };
  /**
   * CSRF (Y3): durum değiştiren site uçları yalnızca JSON kabul eder (CORS yok → başka siteden JSON gönderimi ön uçuşta
   * durur) ve tarayıcı Origin gönderdiyse aynı ana makine olmalı. Origin'siz istemciler (betik, test) kabul edilir.
   */
  const sameSiteJson = (req: { headers: Record<string, unknown> }) => {
    if (!String(req.headers["content-type"] ?? "").startsWith("application/json")) return false;
    const origin = req.headers.origin;
    if (!origin) return true;
    try {
      return new URL(String(origin)).host === String(req.headers.host ?? "");
    } catch {
      return false;
    }
  };
  const takeChallenge = (id: string) => {
    const c = challenges.get(id);
    challenges.delete(id);
    return c && c.exp > Date.now() ? c : undefined;
  };
  // Kit tek kaynaktan: `@tamga-network/verifier/web` → IIFE (window.TamgaVerifier). İlk istekte paketlenir, sonra önbellekte.
  let kit: Promise<string> | null = null;
  const kitJs = () =>
    (kit ??= build({
      stdin: {
        contents: 'import * as T from "@tamga-network/verifier/web"; globalThis.TamgaVerifier = T;',
        resolveDir: dirname(fileURLToPath(import.meta.url)),
        loader: "js",
      },
      bundle: true,
      format: "iife",
      platform: "browser",
      target: "es2020",
      minify: true,
      write: false,
      legalComments: "none",
    }).then((r) => `/* @tamga-network/verifier/web — Apache-2.0 */\n${r.outputFiles[0].text}`));

  app.get("/tamga-verifier.js", async (_req, reply) =>
    reply
      .type("application/javascript")
      .header("cache-control", "public, max-age=300")
      .send(await kitJs()),
  );

  app.get("/presentations/:id/qr.png", async (req, reply) => {
    const p = ctx.presentations.get((req.params as { id: string }).id);
    if (!p) return reply.code(404).send("not found");
    return reply.type("image/png").send(await QRCode.toBuffer(p.req.qrPayload, { margin: 1, width: 440 }));
  });

  // Gerçek ağda örnek site yok (2026-10-04: deneme sandbox'ta) — eski ve yeni adresler sandbox'taki örnek siteye (yayında
  // değilse sandbox rehberine) yönlenir. Site kiti ve QR görüntüsü gerçek siteler için kalır.
  if (!ctx.showcase) {
    const toSandbox = async (
      req: { headers: Record<string, unknown> },
      reply: { redirect: (u: string, c: number) => unknown },
    ) =>
      reply.redirect(
        sandboxSampleSiteUrl(ctx.cfg.sandboxLive, langOf(String(req.headers["accept-language"] ?? ""))),
        302,
      );
    for (const path of ["/sample-site", "/sample-site/*", "/demo-site", "/demo-site/*", "/ornek-site"]) {
      app.get(path, toSandbox as never);
      if (path.endsWith("*")) app.post(path, toSandbox as never);
    }
    return;
  }

  const cookieOf = (req: { headers: Record<string, unknown> }) => {
    const raw = String(req.headers.cookie ?? "");
    const m = new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`).exec(raw);
    return m?.[1];
  };
  const currentAccount = (req: { headers: Record<string, unknown> }) => {
    const sid = cookieOf(req);
    const sess = sid ? sessions.get(sid) : undefined;
    if (!sess) return undefined;
    if (sess.exp <= Date.now()) {
      sessions.delete(sid!);
      return undefined;
    }
    return accounts.get(sess.key);
  };

  // eski adresler
  for (const old of ["/demo-site", "/ornek-site"])
    app.get(old, async (_req, reply) => reply.redirect("/sample-site", 301));
  app.get("/sample-site", async (req, reply) => {
    const acc = currentAccount(req as never);
    return reply.type("text/html").send(
      demoSitePage(
        langOf(req.headers["accept-language"]),
        ctx.cfg.publicBase,
        acc
          ? {
              name: `${acc.givenName} ${acc.familyName}`,
              logins: acc.logins,
              isNew: acc.logins <= 1,
              passkeys: acc.passkeys.length,
            }
          : null,
      ),
    );
  });

  // ADR-0017 K5: sunumu tarayıcı değil site sunucusu açar; örnek sitenin RP'si bu doğrulayıcının kendi kaydıdır
  app.post("/sample-site/start", async (req, reply) => {
    if (!sameSiteJson(req as never))
      return reply.code(403).send({ ok: false, reason: "istek bu siteden gelmeli (JSON)" });
    const policyId = (req.body as { policy?: string }).policy ?? "";
    const policy = SITE_POLICIES.has(policyId) ? findPolicy(policyId, ctx.policies) : undefined;
    if (!policy) return reply.code(400).send({ ok: false, reason: "bu politika site girişi için değil" });
    const made = await createPresentation(ctx, policy, ctx.cfg.clientId);
    if ("error" in made) return reply.code(400).send(made);
    const p = made.p;
    return {
      presentation_id: p.req.presentationId,
      request_uri: p.req.requestUri,
      qr_payload: p.req.qrPayload,
      expires_at: new Date(p.req.expiresAt * 1000).toISOString(),
      status_token: p.statusToken,
    };
  });

  app.post("/sample-site/session", async (req, reply) => {
    if (!sameSiteJson(req as never))
      return reply.code(403).send({ ok: false, reason: "istek bu siteden gelmeli (JSON)" });
    const { presentation_id } = req.body as { presentation_id?: string };
    const p = presentation_id ? ctx.presentations.get(presentation_id) : undefined;
    if (!p || !p.result || p.result.outcome !== "ACCEPTED")
      return reply.code(400).send({ ok: false, reason: "doğrulanmış sunum yok" });
    if (p.consumedBySite) return reply.code(400).send({ ok: false, reason: "sunum zaten kullanıldı" });
    // yalnızca site politikalarıyla yapılmış sunum oturum açar (başka amaçlı sunum kimliği sızsa da kullanılamaz — Y3)
    if (!SITE_POLICIES.has(p.policy.policy_id))
      return reply.code(400).send({ ok: false, reason: "bu sunum site girişi için değil" });
    // HV2: yalnızca bu sitenin (bu doğrulayıcının RP kaydı) açtığı sunum; RP'siz eski sunum yalnızca demo kipinde
    if (p.owner ? p.owner !== ctx.cfg.clientId : ctx.cfg.requireRpAuth)
      return reply.code(400).send({ ok: false, reason: "bu sunum bu site tarafından açılmadı" });
    p.consumedBySite = true; // tek kullanım: aynı sunumla ikinci oturum açılamaz
    const claims = ctx.presentations.takeClaims(p); // HV3: değerler bir kez
    if (!claims || claims === "gone") return reply.code(400).send({ ok: false, reason: "değerler artık alınamaz" });
    const raw = String(claims[ACCOUNT_KEY_CLAIM] ?? "");
    if (!raw) return reply.code(400).send({ ok: false, reason: `hesap anahtarı (${ACCOUNT_KEY_CLAIM}) sunulmadı` });
    const key = accountKeyOf(raw); // ham değer bu satırdan sonra kullanılmaz
    let acc = accounts.get(key);
    const isNew = !acc;
    if (!acc) {
      if (!SIGNUP_POLICIES.has(p.policy.policy_id))
        return reply.code(404).send({ ok: false, reason: "hesap yok — önce kaydolun" });
      acc = {
        key,
        userId: randomBytes(16).toString("base64url"),
        passkeys: [],
        givenName: String(claims.given_name ?? ""),
        familyName: String(claims.family_name ?? ""),
        createdAt: Date.now(),
        logins: 0,
      };
      accounts.set(key, acc);
    }
    acc.logins += 1;
    ctx.audit({ event: isNew ? "site.signup" : "site.login", policy: p.policy.policy_id }); // kişisel veri yok
    reply.header("set-cookie", newSession(key));
    return { ok: true, new: isNew, name: `${acc.givenName} ${acc.familyName}`.trim(), passkeys: acc.passkeys.length };
  });

  // ---- passkey (WebAuthn). rpID/origin sayfanın kendi adresinden; IP adresi reddedilir (tarayıcı da reddeder).
  const rpOf = (req: { headers: Record<string, unknown> }) => {
    const origin = String(req.headers.origin ?? "");
    let host = "";
    try {
      host = new URL(origin).hostname;
    } catch {
      return null;
    }
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host.includes(":")) return null; // IPv4/IPv6: WebAuthn güvenli bağlam dışı
    const allowed = new Set(["localhost", new URL(ctx.cfg.publicBase).hostname]);
    return allowed.has(host) ? { origin, rpID: host } : null;
  };
  const noRp = {
    ok: false,
    reason: "Passkey güvenli bağlam ister: sayfayı localhost ya da HTTPS alan adıyla açın (IP adresinde çalışmaz).",
  };

  app.post("/sample-site/passkey/register/options", async (req, reply) => {
    if (!sameSiteJson(req as never))
      return reply.code(403).send({ ok: false, reason: "istek bu siteden gelmeli (JSON)" });
    const sid = cookieOf(req as never);
    const acc = currentAccount(req as never);
    if (!sid || !acc) return reply.code(401).send({ ok: false, reason: "önce Tamga ile kaydolun ya da giriş yapın" });
    const rp = rpOf(req as never);
    if (!rp) return reply.code(400).send(noRp);
    const options = await generateRegistrationOptions({
      rpName: "ÜyeOl.example",
      rpID: rp.rpID,
      userID: Buffer.from(acc.userId, "base64url"),
      userName: `${acc.givenName} ${acc.familyName}`.trim() || "Tamga kullanıcısı",
      attestationType: "none", // cihaz modeli istenmez (izlenebilirlik yok)
      excludeCredentials: acc.passkeys.map((c) => ({ id: c.id, transports: c.transports })),
      authenticatorSelection: { residentKey: "required", userVerification: "required" },
    });
    putChallenge("reg:" + sid, {
      challenge: options.challenge,
      exp: Date.now() + CHALLENGE_TTL_MS,
      account: acc.key,
    });
    return options;
  });

  app.post("/sample-site/passkey/register/verify", async (req, reply) => {
    if (!sameSiteJson(req as never))
      return reply.code(403).send({ ok: false, reason: "istek bu siteden gelmeli (JSON)" });
    const sid = cookieOf(req as never);
    const acc = currentAccount(req as never);
    const rp = rpOf(req as never);
    if (!sid || !acc) return reply.code(401).send({ ok: false, reason: "oturum yok" });
    if (!rp) return reply.code(400).send(noRp);
    const ch = takeChallenge("reg:" + sid);
    if (!ch || ch.account !== acc.key)
      return reply.code(400).send({ ok: false, reason: "süresi dolmuş istek — tekrar deneyin" });
    try {
      const v = await verifyRegistrationResponse({
        response: req.body as RegistrationResponseJSON,
        expectedChallenge: ch.challenge,
        expectedOrigin: rp.origin,
        expectedRPID: rp.rpID,
        requireUserVerification: true,
      });
      if (!v.verified || !v.registrationInfo)
        return reply.code(400).send({ ok: false, reason: "passkey doğrulanamadı" });
      acc.passkeys.push(v.registrationInfo.credential);
      ctx.audit({ event: "site.passkey.register" }); // kişisel veri / kimlik bilgisi kimliği yok
      return { ok: true, passkeys: acc.passkeys.length };
    } catch (e) {
      req.log.warn({ err: (e as Error).name }, "passkey kaydı doğrulanamadı"); // kişisel veri yok
      return reply.code(400).send({ ok: false, reason: "passkey doğrulanamadı" });
    }
  });

  app.post("/sample-site/passkey/login/options", async (req, reply) => {
    if (!sameSiteJson(req as never))
      return reply.code(403).send({ ok: false, reason: "istek bu siteden gelmeli (JSON)" });
    const rp = rpOf(req as never);
    if (!rp) return reply.code(400).send(noRp);
    // allowCredentials boş: keşfedilebilir passkey — site kullanıcıyı sormadan önce tanımaz
    const options = await generateAuthenticationOptions({ rpID: rp.rpID, userVerification: "required" });
    const flow = randomBytes(16).toString("base64url");
    putChallenge("auth:" + flow, { challenge: options.challenge, exp: Date.now() + CHALLENGE_TTL_MS });
    return { flow, options };
  });

  app.post("/sample-site/passkey/login/verify", async (req, reply) => {
    if (!sameSiteJson(req as never))
      return reply.code(403).send({ ok: false, reason: "istek bu siteden gelmeli (JSON)" });
    const rp = rpOf(req as never);
    if (!rp) return reply.code(400).send(noRp);
    const { flow, response } = req.body as { flow?: string; response?: AuthenticationResponseJSON };
    const ch = flow ? takeChallenge("auth:" + flow) : undefined;
    if (!ch || !response) return reply.code(400).send({ ok: false, reason: "süresi dolmuş istek — tekrar deneyin" });
    let acc: Account | undefined;
    let cred: WebAuthnCredential | undefined;
    for (const a of accounts.values()) {
      cred = a.passkeys.find((c) => c.id === response.id);
      if (cred) {
        acc = a;
        break;
      }
    }
    if (!acc || !cred) return reply.code(404).send({ ok: false, reason: "bu passkey bu sitede kayıtlı değil" });
    try {
      const v = await verifyAuthenticationResponse({
        response,
        expectedChallenge: ch.challenge,
        expectedOrigin: rp.origin,
        expectedRPID: rp.rpID,
        credential: cred,
        requireUserVerification: true,
      });
      if (!v.verified) return reply.code(401).send({ ok: false, reason: "passkey doğrulanamadı" });
      cred.counter = v.authenticationInfo.newCounter;
    } catch (e) {
      req.log.warn({ err: (e as Error).name }, "passkey girişi doğrulanamadı"); // kişisel veri yok
      return reply.code(401).send({ ok: false, reason: "passkey doğrulanamadı" });
    }
    acc.logins += 1;
    ctx.audit({ event: "site.login", method: "passkey" }); // kişisel veri yok
    reply.header("set-cookie", newSession(acc.key));
    return { ok: true, new: false, name: `${acc.givenName} ${acc.familyName}`.trim() };
  });

  app.post("/sample-site/logout", async (req, reply) => {
    const sid = cookieOf(req as never);
    if (sid) sessions.delete(sid);
    reply.header("set-cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
    return reply.redirect("/sample-site");
  });
}
