/**
 * Tamga Wallet Provider — wallet.tamga.network (D-NAME-1). ADR-0025 / AB TS3:
 *  POST /units            birim kaydı (birim anahtarıyla imzalı kanıt; kişi verisi yok)
 *  POST /wia              24 saatten kısa ömürlü Cüzdan Örneği Kanıtı — her belge işleminde yeni anahtar + yeni iptal girişi
 *  POST /ka               Anahtar Kanıtı (key_attestation) — belge anahtarları + gerçek depo seviyesi
 *  POST /units/revoke     kullanıcı isteğiyle birim iptali (bütün WIA girişleri iptal) — imzalı kanıtla YA DA yalnız kapatma
 *                         koduyla (`revocation_code`; Tamga Wallet WA-ADR-0002, telefonsuz)
 *  POST /units/revocation-code  kapatma kodunun ön özetini birime bağlar (WA-ADR-0002 K1; imzalı kanıt)
 *  POST /units/status     birimin durumu `active` / `revoked` (WA-ADR-0002 K3; imzalı kanıt, WIA girişi harcamaz)
 *  GET|POST /lost         "Telefonumu kaybettim" sayfası (TR/EN; WA-ADR-0002 K2) — kod girişi → iptal
 *  GET  /status/wia|ka    iptal listeleri (Token Status List; imzacı = sağlayıcı anahtarı)
 *  GET  /.well-known/wallet-provider · GET / (Trust Mark sayfası; üretimde ops/pages)
 * Sapma S-9/S-14: anahtarlar yazılım deposunda ve cihaz kanıtı yok — KA bunu dürüstçe `iso_18045_basic` olarak söyler (WIA3).
 * Yol adları tek yerde: wallet-core `WP_PATHS` (proje yönetimi ad onayı 2026-10-04).
 */
import Fastify, { type FastifyInstance } from "fastify";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { X509Certificate } from "@peculiar/x509";
import {
  SignJWT,
  calculateJwkThumbprint,
  decodeProtectedHeader,
  importJWK,
  importPKCS8,
  jwtVerify,
  type JWK,
} from "jose";
import { pemToDer, derToB64, certFingerprintSha256Hex } from "@tamga-network/core";
import { pemIssuerSigner } from "@tamga-network/sd-jwt";
import {
  KA_TYP,
  STORAGE_TO_ISO18045,
  StatusValue,
  WUA_TYP,
  isKeyStorage,
  signStatusListToken,
  type KeyStorage,
} from "@tamga-network/issuer";
import { WP_PATHS } from "@tamga-network/wallet-core";
import type { WpConfig } from "./config.js";
import { WpStore, KA_TYPE_INDEX } from "./store.js";
import {
  ConcurrencyGate,
  HTTP_STATUS,
  LOST_LIMITS,
  LOST_PATH,
  hashEqual,
  lostFormHtml,
  lostResultHtml,
  pickLang,
  prehashOfInput,
  sleep,
  slowHash,
  type LostOutcome,
} from "./lock.js";
import {
  officialRoots,
  unitClientData,
  verifyAndroidKeyAttestation,
  verifyAppAttest,
  type DeviceCheck,
  type DeviceEvidence,
} from "./device-attestation.js";

export const UNIT_POP_TYP = "tamga-unit-pop+jwt";
/** TS3: WIA < 24 saat; client_status ≥ 31 gün sonrasına kadar korunur */
export const WIA_TTL_SEC = 23 * 3600;
export const STATUS_KEEP_SEC = 60 * 86400;
export const KA_TTL_SEC = 3600;
const POP_WINDOW_SEC = 300;

export async function buildWalletProviderApp(
  cfg: WpConfig,
  opts: {
    /** test: cihaz kanıtı kökleri (üretimde roots/ — Google, Apple) */
    deviceRoots?: { android: X509Certificate[]; apple: X509Certificate[] };
    /** test: kod girişi eşzamanlılık sınırı ve en az yanıt süresi (üretimde LOST_LIMITS) */
    lost?: { concurrent?: number; minDelayMs?: number; retryAfterSec?: number };
  } = {},
): Promise<FastifyInstance> {
  const certPem = readFileSync(resolve(cfg.pkiDir, `${cfg.certName}.cert.pem`), "utf8");
  const keyPem = readFileSync(resolve(cfg.pkiDir, `${cfg.certName}.pkcs8.pem`), "utf8");
  const key = await importPKCS8(keyPem, "ES256");
  const statusSigner = await pemIssuerSigner(keyPem, certPem);
  const leafDer = pemToDer(certPem);
  const fp = certFingerprintSha256Hex(leafDer);
  const x5c = [derToB64(leafDer)];
  const store = await WpStore.open(cfg.dataDir);
  const app = Fastify({ logger: false });
  const nowSec = () => Math.floor(Date.now() / 1000);
  const wiaStatusUri = `${cfg.publicBase}/status/wia`;
  const kaStatusUri = `${cfg.publicBase}/status/ka`;
  const certInfo = `${cfg.publicBase}/#certification`;
  const seenJti = new Map<string, number>();

  app.get("/healthz", async () => ({ ok: true, provider: cfg.publicBase, ...store.counts() }));
  app.get("/.well-known/wallet-provider", async () => ({
    provider_id: "TAMGA-WP-1",
    legal_name: "Tamga Network",
    provider: cfg.publicBase,
    unit_registration_endpoint: `${cfg.publicBase}/units`,
    wia_endpoint: `${cfg.publicBase}/wia`,
    key_attestation_endpoint: `${cfg.publicBase}/ka`,
    unit_revocation_endpoint: `${cfg.publicBase}${WP_PATHS.revoke}`,
    unit_deletion_endpoint: `${cfg.publicBase}${WP_PATHS.delete}`,
    // WA-ADR-0002: kapatma kodu (kayıt), birim durumu, telefonsuz kapatma sayfası
    unit_revocation_code_endpoint: `${cfg.publicBase}${WP_PATHS.revocationCode}`,
    unit_status_endpoint: `${cfg.publicBase}${WP_PATHS.status}`,
    lost_phone_page: `${cfg.publicBase}${LOST_PATH}`,
    status_lists: { wia: wiaStatusUri, ka: kaStatusUri },
    signing_cert_fingerprint_sha256: fp,
    solutions: cfg.solutions.map((s) => ({ ...s, status: "ACTIVE" })),
    trust_mark: `${cfg.publicBase}/`,
    certification: "not certified — keys in a software keystore, no device attestation yet (S-9/S-14)",
    options: { wia_status: "fresh unlinkable entry per WIA (no per-issuer reuse)", ka_status: "type-shared index" },
  }));
  app.get("/", async (_req, reply) =>
    reply.type("text/html")
      .send(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Tamga Wallet Provider</title>
<body style="font:16px system-ui;max-width:720px;margin:40px auto;padding:0 16px">${process.env.TAMGA_NETWORK === "sandbox" ? '<p style="background:#B45309;color:#fff;padding:6px 12px;font-weight:600">SANDBOX · TEST — not valid in the real network (ADR-0038)</p>' : ""}<h1>Tamga Wallet — trust mark</h1>
<p>This service issues wallet instance attestations (WIA) and key attestations (KA) for <b>Tamga Wallet</b>, the solution of the wallet provider registered in the Tamga trusted list (<code>lotl › wallet_providers[]</code>). In production this address shows the full page from <code>ops/pages</code>.</p>
<p id="certification"><b>Certification:</b> not certified. Keys are held in a software keystore and devices are not yet attested; key attestations state this as <code>iso_18045_basic</code>.</p>
<p>Signing certificate (SHA-256): <code>${fp}</code></p>
<p><a href="/.well-known/wallet-provider">metadata</a></p></body></html>`),
  );

  /** Birim anahtarıyla imzalı kısa ömürlü kanıt (tek kullanımlık jti). Kayıtta başlıkta jwk, diğerlerinde kid = birim kimliği. */
  async function unitProof(
    token: unknown,
    action: string,
  ): Promise<{ ok: true; unitId: string; jwk: JWK; payload: Record<string, unknown> } | { ok: false; error: string }> {
    if (typeof token !== "string") return { ok: false, error: "proof missing" };
    let h: ReturnType<typeof decodeProtectedHeader>;
    try {
      h = decodeProtectedHeader(token);
    } catch {
      return { ok: false, error: "proof unreadable" };
    }
    if (h.typ !== UNIT_POP_TYP || h.alg !== "ES256") return { ok: false, error: "proof header" };
    let jwk: JWK | undefined;
    if (action === "register") jwk = h.jwk as JWK | undefined;
    else if (typeof h.kid === "string") jwk = store.unit(h.kid)?.jwk;
    if (!jwk || jwk.kty !== "EC" || jwk.crv !== "P-256" || "d" in jwk)
      return { ok: false, error: "unknown unit or bad key" };
    const now = nowSec();
    try {
      const { payload } = await jwtVerify(token, await importJWK(jwk, "ES256"), {
        audience: cfg.publicBase,
        currentDate: new Date(now * 1000),
      });
      if (payload.action !== action) return { ok: false, error: "proof action" };
      if (typeof payload.iat !== "number" || Math.abs(now - payload.iat) > POP_WINDOW_SEC)
        return { ok: false, error: "proof iat outside the window" };
      if (typeof payload.jti !== "string" || seenJti.has(payload.jti)) return { ok: false, error: "proof replayed" };
      seenJti.set(payload.jti, now + POP_WINDOW_SEC);
      if (seenJti.size > 20_000) for (const [k, v] of seenJti) if (v < now) seenJti.delete(k);
      return { ok: true, unitId: await calculateJwkThumbprint(jwk), jwk, payload: payload as Record<string, unknown> };
    } catch (e) {
      return { ok: false, error: `proof: ${(e as Error).message}` };
    }
  }
  const coordOk = (v: unknown) => typeof v === "string" && /^[A-Za-z0-9_-]{43}$/.test(v);
  const isP256 = (j: JWK | undefined): j is JWK =>
    !!j && j.kty === "EC" && j.crv === "P-256" && coordOk(j.x) && coordOk(j.y) && !("d" in j);
  const short = (v: unknown) => v === undefined || (typeof v === "string" && v.length <= 64);

  // P4-2: cihaz kanıtı için tek kullanımlık meydan okuma (5 dk)
  const challenges = new Map<string, number>();
  app.post("/units/challenge", async () => {
    const now = nowSec();
    for (const [k, v] of challenges) if (v < now) challenges.delete(k);
    if (challenges.size > 50_000) challenges.clear();
    const challenge = randomBytes(32).toString("base64url");
    challenges.set(challenge, now + 300);
    return { challenge, expires_in: 300 };
  });
  const roots = opts.deviceRoots ?? officialRoots();
  /** Kanıt doğrulanırsa seviye; yoksa null. Başarısızlık nedeni yanıtta (kişisel veri yok). */
  async function checkDevice(
    ev: DeviceEvidence | undefined,
    challenge: unknown,
    unitId: string,
    jwk: JWK,
  ): Promise<{ result: DeviceCheck | null; error?: string }> {
    if (!ev) return { result: null };
    if (typeof challenge !== "string" || !challenges.has(challenge) || challenges.get(challenge)! < nowSec())
      return { result: null, error: "device challenge unknown or expired" };
    challenges.delete(challenge); // tek kullanımlık
    let r: DeviceCheck;
    if (ev.platform === "android" && Array.isArray(ev.key_attestation)) {
      const raw = new Uint8Array([
        4,
        ...Buffer.from(String(jwk.x), "base64url"),
        ...Buffer.from(String(jwk.y), "base64url"),
      ]);
      r = await verifyAndroidKeyAttestation(ev.key_attestation.map(String).slice(0, 10), {
        challenge: new Uint8Array(Buffer.from(challenge, "base64url")),
        packageName: cfg.device.androidPackage,
        expectedKey: raw,
        roots: roots.android,
        allowUnlocked: cfg.device.allowDevelopment,
      });
    } else if (ev.platform === "ios" && ev.app_attest && cfg.device.appleAppId) {
      r = await verifyAppAttest({
        keyIdB64: String(ev.app_attest.key_id),
        attestationB64: String(ev.app_attest.attestation),
        clientData: unitClientData(challenge, unitId),
        appId: cfg.device.appleAppId,
        roots: roots.apple,
        allowDevelopment: cfg.device.allowDevelopment,
      });
    } else return { result: null, error: "device evidence not supported" };
    return r.ok ? { result: r } : { result: null, error: r.reason };
  }

  app.post("/units", async (req, reply) => {
    const b = (req.body ?? {}) as { proof?: string; device_evidence?: DeviceEvidence };
    const p = await unitProof(b.proof, "register");
    if (!p.ok) return reply.code(400).send({ error: "invalid_request", error_description: p.error });
    const { solution_id = "tamga-wallet-expo", app_version, platform } = p.payload as Record<string, string>;
    if (!short(solution_id) || !short(app_version) || !short(platform))
      return reply.code(400).send({ error: "invalid_request", error_description: "attestation fields" });
    if (!cfg.solutions.some((s) => s.solution_id === solution_id))
      return reply.code(400).send({ error: "invalid_request", error_description: "unknown solution" });
    const existing = store.unit(p.unitId);
    if (existing?.revoked_at) return reply.code(403).send({ error: "unit_revoked" });
    const dev = await checkDevice(b.device_evidence, p.payload.challenge, p.unitId, p.jwk);
    if (dev.error) return reply.code(400).send({ error: "device_attestation_failed", error_description: dev.error });
    if (!existing)
      await store.addUnit(p.unitId, {
        jwk: { kty: "EC", crv: "P-256", x: p.jwk.x, y: p.jwk.y },
        solution_id,
        app_version: app_version ?? "0",
        platform: platform ?? "unknown",
        storage: "software", // S-14: cihaz kanıtı yok → beyan dikkate alınmaz (WIA3)
        created_at: nowSec(),
        wia_idx: [],
      });
    // P4-2: seviye yalnız doğrulanmış platform kanıtından
    if (dev.result) {
      const platform = b.device_evidence!.platform;
      await store.setUnitDevice(p.unitId, dev.result.storage, {
        platform,
        verified_at: nowSec(),
        details: dev.result.details,
      });
    }
    const u = store.unit(p.unitId)!;
    return reply.code(201).send({ unit_id: p.unitId, key_storage: u.storage });
  });

  app.post("/wia", async (req, reply) => {
    const b = (req.body ?? {}) as { proof?: string; wia_jwk?: JWK };
    const p = await unitProof(b.proof, "wia");
    if (!p.ok) return reply.code(400).send({ error: "invalid_request", error_description: p.error });
    const u = store.unit(p.unitId)!;
    if (u.revoked_at) return reply.code(403).send({ error: "unit_revoked" });
    if (!isP256(b.wia_jwk)) return reply.code(400).send({ error: "invalid_request", error_description: "wia_jwk" });
    const wiaJwk: JWK = { kty: "EC", crv: "P-256", x: b.wia_jwk.x, y: b.wia_jwk.y };
    const jkt = await calculateJwkThumbprint(wiaJwk);
    if (p.payload.wia_jkt !== jkt)
      return reply.code(400).send({ error: "invalid_request", error_description: "wia_jkt" });
    const now = nowSec();
    const idx = await store.allocateWia(p.unitId); // yeni, bağlanamaz giriş (WIA1)
    // HAIP 1.0 §4.4.1 (ADR-0034): sub, aynı cüzdan çözümünü kullanan bütün örneklerde ortak değer — örneğe özgü tanımlayıcı
    // taşımaz; PAR'daki client_id bu değerdir. Örneği ayıran tek şey her işlemde yeni cnf anahtarı ve yeni iptal girişidir.
    const sub = u.solution_id;
    const wia = await new SignJWT({
      sub,
      wallet_name: u.solution_id,
      wallet_version: u.app_version,
      wallet_link: `${cfg.publicBase}/`,
      wallet_solution_certification_information: certInfo,
      client_status: { status: { status_list: { idx, uri: wiaStatusUri } }, exp: now + STATUS_KEEP_SEC },
      cnf: { jwk: wiaJwk },
    })
      .setProtectedHeader({ alg: "ES256", typ: WUA_TYP, x5c })
      .setIssuedAt(now)
      .setExpirationTime(now + WIA_TTL_SEC)
      .sign(key);
    return { wia, sub, exp: now + WIA_TTL_SEC };
  });

  app.post("/ka", async (req, reply) => {
    const b = (req.body ?? {}) as { proof?: string; keys?: JWK[] };
    const p = await unitProof(b.proof, "ka");
    if (!p.ok) return reply.code(400).send({ error: "invalid_request", error_description: p.error });
    const u = store.unit(p.unitId)!;
    if (u.revoked_at) return reply.code(403).send({ error: "unit_revoked" });
    const keys = b.keys ?? [];
    if (!Array.isArray(keys) || keys.length < 1 || keys.length > 20 || !keys.every(isP256))
      return reply.code(400).send({ error: "invalid_request", error_description: "keys: 1..20 public P-256 JWKs" });
    const attested = keys.map((k) => ({ kty: "EC", crv: "P-256", x: k.x, y: k.y }));
    const thumbs = await Promise.all(attested.map((k) => calculateJwkThumbprint(k as JWK)));
    const hash = createHash("sha256").update(thumbs.join(".")).digest("base64url");
    if (p.payload.keys_hash !== hash)
      return reply.code(400).send({ error: "invalid_request", error_description: "keys_hash" });
    const storage: KeyStorage = isKeyStorage(u.storage) ? u.storage : "software";
    const now = nowSec();
    const ka = await new SignJWT({
      attested_keys: attested,
      key_storage: [STORAGE_TO_ISO18045[storage]],
      user_authentication: ["iso_18045_basic"], // uygulama PIN/biyometrisi; anahtar kullanımı kullanıcı doğrulamasına bağlı değil (S-9)
      certification: certInfo,
      key_storage_status: {
        status: { status_list: { idx: KA_TYPE_INDEX[storage], uri: kaStatusUri } }, // tür başına ortak giriş (TS3 Seçenek 1)
        exp: now + STATUS_KEEP_SEC,
      },
    })
      .setProtectedHeader({ alg: "ES256", typ: KA_TYP, x5c })
      .setIssuedAt(now)
      .setExpirationTime(now + KA_TTL_SEC)
      .sign(key);
    return { key_attestation: ka };
  });

  // ---------------------------------------------------------------- WA-ADR-0002: uzaktan kapatma (kapatma kodu)
  const lostLimits = { ...LOST_LIMITS, ...opts.lost };
  const gate = new ConcurrencyGate(lostLimits.concurrent);
  /**
   * Kod girişi: her denemede aynı yavaş özet (biçim bozuk olsa da) ve en az sabit yanıt süresi; bulunamayan kod ile biçim
   * hatası aynı sonuç (`unknown`). Genel deneme sayacı YOK (tek kaynak herkesin sayfasını kapatamaz); eşzamanlı scrypt üst
   * sınırı aşılırsa `busy` (503 + Retry-After). Kod, ön özet ve IP günlüğe yazılmaz (RL2).
   */
  async function revokeByCode(input: unknown): Promise<LostOutcome> {
    const started = Date.now();
    if (!gate.take()) return "busy";
    try {
      const { valid, prehash } = prehashOfInput(input);
      const hash = await slowHash(prehash);
      let outcome: LostOutcome = "unknown";
      const hit = store.unitByLockHash(hash);
      if (valid && hit && hit.unit.lock_hash && hashEqual(hit.unit.lock_hash, hash)) {
        if (hit.unit.revoked_at) outcome = "already_revoked";
        else {
          await store.revokeUnit(hit.unitId, nowSec()); // birim + bütün WIA girişleri (ADR-0025 K4, RL3)
          outcome = "revoked";
        }
      }
      await sleep(Math.max(0, lostLimits.minDelayMs - (Date.now() - started)));
      return outcome;
    } finally {
      gate.release();
    }
  }
  const retryAfter = (reply: { header: (k: string, v: string) => unknown }, outcome: LostOutcome) => {
    if (outcome === "busy") reply.header("retry-after", String(lostLimits.retryAfterSec));
  };

  app.post(WP_PATHS.revoke, async (req, reply) => {
    const b = (req.body ?? {}) as { proof?: string; revocation_code?: unknown };
    if (b.revocation_code !== undefined) {
      // telefonsuz: yalnız kod (sayfanın JSON hâli)
      const outcome = await revokeByCode(b.revocation_code);
      reply.header("cache-control", "no-store");
      retryAfter(reply, outcome);
      return reply
        .code(HTTP_STATUS[outcome])
        .send(outcome === "revoked" ? { revoked: true } : { error: outcome === "unknown" ? "code_unknown" : outcome });
    }
    const p = await unitProof(b.proof, "revoke");
    if (!p.ok) return reply.code(400).send({ error: "invalid_request", error_description: p.error });
    const n = await store.revokeUnit(p.unitId, nowSec());
    return { revoked: true, entries: n };
  });

  // K1: kodun ön özeti (43 karakter base64url) → yavaş özet, birime bağlanır; eskisi silinir. İptal edilmiş birim kod alamaz.
  app.post(WP_PATHS.revocationCode, async (req, reply) => {
    const b = (req.body ?? {}) as { proof?: string };
    const p = await unitProof(b.proof, "revocation-code");
    if (!p.ok) return reply.code(400).send({ error: "invalid_request", error_description: p.error });
    const u = store.unit(p.unitId)!;
    if (u.revoked_at) return reply.code(403).send({ error: "unit_revoked" });
    const pre = p.payload.lock_prehash;
    if (typeof pre !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(pre))
      return reply.code(400).send({ error: "invalid_request", error_description: "lock_prehash" });
    if (!(await store.setLockHash(p.unitId, await slowHash(pre))))
      return reply.code(409).send({ error: "code_in_use", error_description: "choose another code" });
    return { saved: true };
  });

  // K3: birim durumu — telefon öne gelişte sorar (en çok 15 dk'da bir); WIA girişi harcamaz
  app.post(WP_PATHS.status, async (req, reply) => {
    const b = (req.body ?? {}) as { proof?: string };
    const p = await unitProof(b.proof, "status");
    if (!p.ok) return reply.code(400).send({ error: "invalid_request", error_description: p.error });
    const u = store.unit(p.unitId)!;
    return { status: u.revoked_at ? "revoked" : "active" };
  });

  // K2: "Telefonumu kaybettim" sayfası (TR/EN). Dış betik yok; önbellek yok; çerçeve içinde açılmaz.
  const pageHeaders = (reply: { header: (k: string, v: string) => unknown }) => {
    reply.header("cache-control", "no-store");
    reply.header("x-frame-options", "DENY");
    reply.header("referrer-policy", "no-referrer");
    reply.header("x-content-type-options", "nosniff");
    reply.header(
      "content-security-policy",
      "default-src 'none'; style-src 'unsafe-inline'; img-src data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    );
  };
  // Form ayrıştırıcı yalnız bu kapsamda (Fastify eklenti sınırı): öbür uçlar form gövdesi kabul etmez.
  await app.register(async (lost) => {
    lost.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_req, body, done) => {
      try {
        done(null, Object.fromEntries(new URLSearchParams(String(body).slice(0, 4096))));
      } catch (e) {
        done(e as Error);
      }
    });
    lost.get(LOST_PATH, async (req, reply) => {
      pageHeaders(reply);
      return reply
        .type("text/html; charset=utf-8")
        .send(lostFormHtml(pickLang(req.query, req.headers["accept-language"])));
    });
    lost.post(LOST_PATH, async (req, reply) => {
      pageHeaders(reply);
      const b = (req.body ?? {}) as { code?: unknown; confirm?: unknown; lang?: unknown };
      const lang = pickLang({ lang: b.lang }, req.headers["accept-language"]);
      if (b.confirm !== "1") return reply.code(400).type("text/html; charset=utf-8").send(lostFormHtml(lang));
      const outcome = await revokeByCode(b.code);
      retryAfter(reply, outcome);
      return reply.code(HTTP_STATUS[outcome]).type("text/html; charset=utf-8").send(lostResultHtml(lang, outcome));
    });
  });

  // Kişinin silme isteği (Apple 5.1.1(v), Google Play; KVKK md. 7): birim iptal + kayıt silinir. Kimlik = birim anahtarı (PoP).
  app.post("/units/delete", async (req, reply) => {
    const b = (req.body ?? {}) as { proof?: string };
    const p = await unitProof(b.proof, "delete");
    if (!p.ok) return reply.code(400).send({ error: "invalid_request", error_description: p.error });
    const n = await store.deleteUnit(p.unitId, nowSec());
    return { deleted: true, revoked_entries: n };
  });

  // İptal listeleri — her istekte taze imza (ttl 1 sa); sorgu hangi girişin arandığını açığa vurmaz (tüm liste)
  const listToken = async (which: "wia" | "ka") => {
    const now = nowSec();
    return signStatusListToken({
      signer: statusSigner,
      iss: cfg.publicBase,
      uri: which === "wia" ? wiaStatusUri : kaStatusUri,
      bitstring: which === "wia" ? store.wiaBits : store.kaBits,
      iat: now,
      ttlSec: 3600,
    });
  };
  app.get("/status/wia", async (_req, reply) => reply.type("application/statuslist+jwt").send(await listToken("wia")));
  app.get("/status/ka", async (_req, reply) => reply.type("application/statuslist+jwt").send(await listToken("ka")));

  // test / operatör: tür iptali (ör. bir anahtar deposu türünde açık bulunursa) — yalnız süreç içi
  app.decorate("revokeKeyStorageType", async (storage: KeyStorage) => store.setKaType(storage, StatusValue.INVALID));
  void randomUUID;
  return app;
}
