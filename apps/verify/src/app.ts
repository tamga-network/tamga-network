/**
 * Referans verifier — verify.tamga.network (SPEC-API-0001 §4 servis yüzeyi + SPEC-PROTO-0002 uçları).
 *  POST /presentations {policy_id} → imzalı istek nesnesi + QR (openid4vp://…&request_uri=…)
 *  GET  /vp/req/:id            → istek nesnesi (application/oauth-authz-req+jwt)
 *  POST /vp/response           → direct_post.jwt (form: response=<JWE>) → çöz → doğrula (T0 + A–E) → yalnız `redirect_uri` (kabulde kontrol görünümü anahtarıyla; + ADR-0012 B pass_grant)
 *  GET  /presentations/:id     → PENDING | sonuç nesnesi (claim DEĞERİ yok — AP3, idx yok — AP4)
 *  GET  /presentations/:id/claims → değerler (ayrı uç, ayrıca yetkilendirilir — demo: aynı oturum)
 *  GET  /p/:id                 → HTML sonuç ekranı (AP2); `?show=<key>` kontrol görünümü (ADR-0012 C, 5 dk)
 *  /terminal…                  → geçiş kartı doğrulama (ADR-0012 B, AP13)
 *  /sample-site, /tamga-verifier.js → web sitesine "Tamga ile Kayıt Ol / Giriş Yap" (D11 v1; routes/site.ts)
 * Güven verisi yalnızca TrustSource (BT4); status yalnızca ön çekim önbelleğinden (S12). Loglarda IP/claim değeri/idx yok.
 * Modüller: policies.ts (politikalar) · state.ts (sunum durumu) · html.ts (görünümler) · routes/*.ts (uçlar).
 */
import Fastify, { type FastifyInstance } from "fastify";
import formbody from "@fastify/formbody";
import { readFileSync } from "node:fs";
import { createHash, createPrivateKey, timingSafeEqual } from "node:crypto";
import { resolve } from "node:path";
import { pemToDer } from "@tamga-network/core";
import { guardedReload, loadTrustSourceFromDir, type TrustSource } from "@tamga-network/trust";
import { WalletStatusChecker } from "@tamga-network/issuer";
import {
  pemRpSigner,
  PrefetchStatusCache,
  PassRegistry,
  filePassStore,
  makeJtiCache,
  verifyRpAssertion,
  type RpSigner,
} from "@tamga-network/verifier";
import type { VerifyConfig } from "./config.js";
import { PresentationStore } from "./state.js";
import { GateStats } from "./stats.js";
import { TerminalKeyRegistry } from "./terminal-keys.js";
import { registerPresentationRoutes } from "./routes/presentations.js";
import { NativeZkBackend, defaultZkBackend, type ZkBackend } from "@tamga-network/verifier/zk";
import { registerTerminalRoutes } from "./routes/terminal.js";
import { registerMiscRoutes } from "./routes/misc.js";
import { registerSiteRoutes } from "./routes/site.js";
import { registerDcTestRoutes } from "./routes/dc-test.js";
import { policiesFor } from "./policies.js";
import { DEFAULT_RATE_RULES, TokenBucketLimiter, type RateRules } from "./rate-limit.js";
import { registerAssetRoutes, sandboxBar } from "./brand.js";
import type { Policy } from "@tamga-network/verifier";

export { POLICIES, policiesFor } from "./policies.js";

/**
 * HTML sayfalarının CSP'si (güvenlik turu K10): satır içi betik ve biçim yok — sayfa betikleri, marka CSS'i ve QR okuyucu
 * kütüphanesi bu servisten `/assets/*` (brand.ts; nonce gerekmez, CDN yok). Yazı tipleri Google Fonts (tamga-ui.css @import —
 * dış CSS dosyası, satır içi değil). QR görseli `data:`. Trusted Types zorunlu: sayfa betikleri DOM'a HTML dizgisi yazmaz.
 * `upgrade-insecure-requests` yok: bütün kaynaklar aynı köken (göreli yol) ya da https, yerel http geliştirmesi bozulmasın.
 */
export const VERIFY_CSP =
  "default-src 'none'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; " +
  "img-src 'self' data:; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; " +
  "require-trusted-types-for 'script'; trusted-types 'none'";

/** Bellekteki denetim kaydı üst sınırı (kayıt yalnızca son olayları gösterir; kalıcı günlük değildir). */
const AUDIT_MAX = 1000;

/** Rota modüllerinin paylaştığı bağlam. */
export interface VerifyContext {
  cfg: VerifyConfig;
  signer: RpSigner;
  /** ADR-0017 K1: `Authorization: Bearer <RP beyanı>` → RP client_id (hata fırlatır). */
  rpAuth: (authorization: string | undefined) => Promise<string>;
  trust: () => TrustSource;
  rootDer: () => Uint8Array[];
  statusCache: PrefetchStatusCache;
  /**
   * ADR-0031 PS5: takma ad sunumundaki WIA'nın iptal durumu (`client_status`; ADR-0025). Liste imzacısı güven listesindeki bir
   * cüzdan sağlayıcı anahtarı olmalı; liste 5 dk önbellekte.
   */
  walletStatusOf: WalletStatusChecker["statusOf"];
  presentations: PresentationStore;
  passes: PassRegistry;
  audit: (e: Record<string, unknown>) => void;
  auditTail: (n: number) => Record<string, unknown>[];
  /** Operatör uçları: `x-admin-token` = TAMGA_ADMIN_TOKEN (sabit zamanlı karşılaştırma); token tanımlı değilse kapalı. */
  isAdmin: (header: string | string[] | undefined) => boolean;
  /** Kapı sayaçları (yalnız sayı; kişi/kart kimliği yok). */
  gateStats: GateStats;
  /** ADR-0065: terminal anahtarları — kapı `/terminal/verify`'ı yalnız grubuna bağlı anahtarla çağırır. */
  terminalKeys: TerminalKeyRegistry;
  /** ADR-0032: ZK doğrulama arka ucu — yerel ikili varsa o, yoksa WASM (`cfg.zkNativeBin`). */
  zk: ZkBackend;
  /**
   * Deneme vitrini (sandbox): kurgusal senaryo politikaları, ana sayfadaki "QR üret" paneli, örnek site ve kapı sayfası.
   * Gerçek ağda kapalı — yalnız genel ve inceleme politikaları (policies.ts `policiesFor`).
   */
  showcase: boolean;
  /** Bu süreçte yüklü politika kümesi. */
  policies: Policy[];
  /** Hız sınırları (bellekte; istemci adresi saklanmaz — rate-limit.ts). */
  limits: Record<keyof RateRules, TokenBucketLimiter>;
  /**
   * ISO/IEC 18013-7 Ek C isteğinin okuyucu imzası (ReaderAuth): doğrulayıcının erişim sertifikası ve ham anahtarı. Test imzacısı
   * verildiyse yok (istek imzasız gider).
   */
  readerAuth?: { sk: Uint8Array; x5chain: Uint8Array[] };
}

/**
 * ISO/IEC 18013-7 Ek C okuyucu imzası (`readerAuth`): erişim sertifikasının anahtarı ve x5chain = yaprak + ara sertifikalar (kök
 * HARİÇ; `pemRpSigner` kendinden imzalı kökü zaten ayıklar — istek nesnesinin x5c'siyle aynı kural, REDIRECTS_RO-02). Cüzdan
 * okuyucu zincirini imzalı listedeki çapaya bu ara sertifikalar üzerinden bağlar.
 */
export function annexCReaderAuth(
  signer: Pick<RpSigner, "leafDer" | "chainDer">,
  privateKeyPem: string,
): VerifyContext["readerAuth"] {
  const d = (createPrivateKey(privateKeyPem).export({ format: "jwk" }) as { d?: string }).d;
  if (!d) return undefined;
  return { sk: new Uint8Array(Buffer.from(d, "base64url")), x5chain: [signer.leafDer, ...(signer.chainDer ?? [])] };
}

export interface VerifyApp extends FastifyInstance {
  reloadTrust: () => Promise<void>;
  prefetchStatus: () => Promise<{ ok: number; failed: string[] }>;
  trust: () => TrustSource;
  statusCache: PrefetchStatusCache;
  presentations: PresentationStore;
}

export async function buildVerifyApp(
  cfg: VerifyConfig,
  opts: {
    fetchText?: (url: string) => Promise<string | null>;
    signer?: RpSigner;
    /** Varsayılan: `cfg.network === "sandbox"`. Testler vitrini gerçek ağ biçimli test listesiyle açabilir. */
    showcase?: boolean;
    /** Hız sınırı kuralları (varsayılan DEFAULT_RATE_RULES); testler küçültür. */
    rateRules?: Partial<RateRules>;
  } = {},
): Promise<VerifyApp> {
  const showcase = opts.showcase ?? cfg.network === "sandbox";
  const policies = policiesFor(showcase ? "sandbox" : "production");
  let trust: TrustSource;
  let rootDer: Uint8Array[] = [];
  const statusCache = new PrefetchStatusCache(opts.fetchText);
  // ADR-0031 PS5 (güvenlik turu 2026-10-19): takma adla giriş iptal edilmiş cüzdandan gelemez — WIA iptal listesi denetlenir.
  // Liste adresi sağlayıcı imzalı WIA'dan gelir (imza önce doğrulanır); imzacı güven listesindeki sağlayıcı anahtarı olmalı.
  const walletStatus = new WalletStatusChecker(
    opts.fetchText ??
      (async (uri) => {
        const r = await fetch(uri, { signal: AbortSignal.timeout(5000) });
        return r.ok ? await r.text() : null;
      }),
    (fp) => trust.isWalletProviderKey(fp),
  );
  const loadTrust = async () => {
    const { trust: t, rootCertPem } = await loadTrustSourceFromDir(cfg.trustDist, { environment: cfg.network });
    trust = t;
    rootDer = rootCertPem ? [pemToDer(rootCertPem)] : [];
  };
  await loadTrust();
  // Periyodik yenileme korumalı: aynı anda tek yükleme, dist değişmediyse atla (çapa günlüğü büyüdükçe yükleme saniyeler sürer)
  const reloadTrust = guardedReload(cfg.trustDist, loadTrust, { seedStamp: true }).reload;
  const anchoredUris = () => {
    const s = (trust as unknown as { store?: { status_anchors: Map<string, { list_uri: string }> } }).store;
    return s ? [...s.status_anchors.values()].map((a) => a.list_uri) : [];
  };
  // Çapa günlüğündeki Status List'ler + doğrulamada görülüp ön çekim kümesine eklenen tanımlayıcı listeleri (çapasız; mdoc
  // `identifier_list` — PrefetchStatusCache.want). İkisi de her turda tazelenir (D4); doğrulama ağ isteğini beklemez (S12).
  const prefetchStatus = () => statusCache.refresh(anchoredUris());
  const signer =
    opts.signer ??
    (await pemRpSigner(
      readFileSync(resolve(cfg.pkiDir, "rp-verify.pkcs8.pem"), "utf8"),
      readFileSync(resolve(cfg.pkiDir, "rp-verify.cert.pem"), "utf8"),
    ));
  // Ek C okuyucu imzası aynı erişim sertifikasıyla (ham anahtar yalnız bu süreçte; dışarı verilmez)
  const readerAuth = opts.signer
    ? undefined
    : annexCReaderAuth(signer, readFileSync(resolve(cfg.pkiDir, "rp-verify.pkcs8.pem"), "utf8"));
  cfg.clientId = signer.clientId; // ADR-0034: x509_hash, sertifikadan
  const audit: Record<string, unknown>[] = [];
  const rpJti = makeJtiCache();
  const zk: ZkBackend = cfg.zkNativeBin
    ? new NativeZkBackend({
        binPath: cfg.zkNativeBin,
        onWarn: (m) => console.warn(`[verify] ${m}`), // yalnız arka uç durumu; kişi verisi yok
      })
    : defaultZkBackend();
  const ctx: VerifyContext = {
    cfg,
    signer,
    ...(readerAuth ? { readerAuth } : {}),
    zk,
    showcase,
    policies,
    limits: Object.fromEntries(
      Object.entries({ ...DEFAULT_RATE_RULES, ...opts.rateRules }).map(([k, r]) => [k, new TokenBucketLimiter(r)]),
    ) as VerifyContext["limits"],
    rpAuth: (authorization) =>
      verifyRpAssertion(authorization, {
        audience: cfg.publicBase,
        relyingParty: (id) => trust.relyingParty(id),
        jti: rpJti,
      }),
    trust: () => trust,
    // ADR-0036: Tamga kökü + tazelik içindeki dış listelerin (federasyon) çapa sertifikaları
    rootDer: () => [...rootDer, ...(trust.externalAnchorCertsDer?.() ?? [])],
    statusCache,
    walletStatusOf: walletStatus.statusOf,
    presentations: new PresentationStore(),
    // ADR-0012 B: geçiş kartı kayıtları + jti tekrar listesi (dosya; tüm kapılar bu servisi çağırdığı için liste ortaktır)
    // ADR-0034: kart jetonunun aud'u kalıcı alan adı (sertifika yenilemesi kartları geçersiz kılmaz)
    passes: new PassRegistry(
      signer,
      filePassStore(resolve(cfg.dataDir, "passes.json")),
      trust!.relyingParty(signer.clientId)?.dns_name ?? new URL(cfg.publicBase).hostname, // loadTrust() yukarıda bekletildi
    ),
    audit: (e) => {
      audit.push({ ts: new Date().toISOString(), ...e });
      if (audit.length > AUDIT_MAX) audit.splice(0, audit.length - AUDIT_MAX); // bellekte sınırlı halka
    },
    auditTail: (n) => audit.slice(-n),
    gateStats: new GateStats(resolve(cfg.dataDir, "gate-stats.json")),
    terminalKeys: new TerminalKeyRegistry(resolve(cfg.dataDir, "terminal-keys.json"), cfg.terminalKeys),
    isAdmin: (header) => {
      const tok = process.env.TAMGA_ADMIN_TOKEN;
      if (!tok || typeof header !== "string") return false;
      const h = (v: string) => createHash("sha256").update(v).digest();
      return timingSafeEqual(h(header), h(tok));
    },
  };

  const app = Fastify({ logger: false }) as unknown as VerifyApp;
  await app.register(formbody);
  Object.assign(app, {
    reloadTrust,
    prefetchStatus,
    trust: () => trust,
    statusCache,
    presentations: ctx.presentations,
  });
  if (zk instanceof NativeZkBackend) app.addHook("onClose", async () => zk.close());
  // HTML yanıtları: sunum ve kapı sayfaları dizine girmez; sandbox'ta her sayfanın üstünde "test" şeridi (ADR-0038 SB4; ağ
  // cfg'den — süreç ortamından değil)
  app.addHook("onSend", async (req, reply, payload) => {
    reply.header("x-content-type-options", "nosniff");
    if (typeof payload !== "string" || !String(reply.getHeader("content-type") ?? "").startsWith("text/html"))
      return payload;
    // K10: tek kaynak — CSP yalnız burada (nginx CSP koymaz; nosniff/XFO/Referrer nginx'te de var, vekil bizimkini gizler)
    reply.header("content-security-policy", VERIFY_CSP);
    reply.header("referrer-policy", "same-origin");
    reply.header("x-frame-options", "DENY");
    const path = req.url.split("?")[0];
    if (path.startsWith("/p/") || path === "/terminal" || path.startsWith("/terminal/"))
      reply.header("x-robots-tag", "noindex, nofollow");
    if (cfg.network !== "sandbox" || !payload.includes("<body>")) return payload;
    return payload.replace(
      "<body>",
      `<body>${sandboxBar(/^<!doctype html><html lang="tr"/i.test(payload) ? "tr" : "en")}`,
    );
  });
  registerAssetRoutes(app);
  registerMiscRoutes(app, ctx);
  registerPresentationRoutes(app, ctx);
  registerTerminalRoutes(app, ctx);
  registerSiteRoutes(app, ctx);
  registerDcTestRoutes(app, ctx);
  return app;
}
