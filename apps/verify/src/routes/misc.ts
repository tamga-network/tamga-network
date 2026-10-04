/** Yardımcı uçlar: sağlık, politika listesi, ana sayfa, denetim kaydı, LAN'da güven listesi aynası. */
import type { FastifyInstance } from "fastify";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { policyScopeViolations } from "@tamga-network/verifier";
import type { VerifyContext } from "../app.js";
import { isReviewPolicy, policySummaries } from "../policies.js";
import { appReviewPage, homePage, langOf, policiesPage } from "../html.js";
import { sandboxUrl } from "../config.js";

export function registerMiscRoutes(app: FastifyInstance, ctx: VerifyContext) {
  const { cfg } = ctx;

  app.get("/healthz", async () => ({
    ok: true,
    trust: ctx.trust().freshness(),
    status_cached: ctx.statusCache.uris().length,
    policies: ctx.policies.map((p) => p.policy_id),
    presentations: ctx.presentations.size(),
  }));

  /** Cüzdanın "Kontrol ettir" (ADR-0012 C) ekranı için senaryo listesi — kişisel veri yok. */
  app.get("/policies", async () => policySummaries(ctx.policies));

  app.get("/", async (req, reply) => {
    const trust = ctx.trust();
    const rp = trust.relyingParty(cfg.clientId);
    // Gerçek ağ: deneme paneli yok — Tamga Verify nedir + geliştirici bağlantıları + "denemek için sandbox" (2026-10-04)
    if (!ctx.showcase) {
      const lang = langOf(req.headers["accept-language"]);
      return reply
        .type("text/html")
        .send(homePage(lang, rp, trust.freshness(), ctx.statusCache.uris().length, sandboxUrl(cfg.sandboxLive, lang)));
    }
    return reply
      .type("text/html")
      .send(
        policiesPage(
          ctx.policies,
          rp,
          (p) => policyScopeViolations(p, rp),
          trust.freshness(),
          ctx.statusCache.uris().length,
        ),
      );
  });

  // ADR-0033: mağaza inceleyicisi için doğrudan bağlantı (ana sayfadan bağlanmaz; noindex)
  app.get("/app-review", async (req, reply) =>
    reply
      .type("text/html")
      .header("x-robots-tag", "noindex, nofollow")
      .send(appReviewPage(langOf(req.headers["accept-language"]), ctx.policies.filter(isReviewPolicy))),
  );

  app.get("/audit", async (req, reply) => {
    if (!ctx.isAdmin(req.headers["x-admin-token"])) return reply.code(404).send("not found");
    return ctx.auditTail(100);
  });

  // Geliştirme kolaylığı: LAN demosunda trust.tamga.network yokken liste dosyalarını buradan sun (TAMGA_VERIFY_SERVE_TRUST=1).
  if (process.env.TAMGA_VERIFY_SERVE_TRUST === "1") {
    app.get("/trust/*", async (req, reply) => {
      const rel = (req.params as { "*": string })["*"];
      if (!/^[a-z0-9_./-]+$/i.test(rel) || rel.includes("..")) return reply.code(400).send("bad path");
      try {
        const body = readFileSync(resolve(cfg.trustDist, rel), "utf8");
        const type = rel.endsWith(".json")
          ? "application/json"
          : rel.endsWith(".jws")
            ? "application/jose"
            : "text/plain";
        return reply.type(type).send(body);
      } catch {
        return reply.code(404).send("not found");
      }
    });
  }
}
