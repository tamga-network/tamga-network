/** Yardımcı uçlar: sağlık, politika listesi, ana sayfa, denetim kaydı, LAN'da güven listesi aynası. */
import type { FastifyInstance } from "fastify";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { policyScopeViolations } from "@tamga-network/verifier";
import type { VerifyContext } from "../app.js";
import { POLICIES, policySummaries } from "../policies.js";
import { policiesPage } from "../html.js";

export function registerMiscRoutes(app: FastifyInstance, ctx: VerifyContext) {
  const { cfg } = ctx;

  app.get("/healthz", async () => ({
    ok: true,
    trust: ctx.trust().freshness(),
    status_cached: ctx.statusCache.uris().length,
    policies: POLICIES.map((p) => p.policy_id),
    presentations: ctx.presentations.size(),
  }));

  /** Cüzdanın "Kontrol ettir" (ADR-0012 C) ekranı için senaryo listesi — kişisel veri yok. */
  app.get("/policies", async () => policySummaries());

  app.get("/", async (_req, reply) => {
    const trust = ctx.trust();
    const rp = trust.relyingParty(cfg.clientId);
    return reply
      .type("text/html")
      .send(
        policiesPage(
          POLICIES,
          rp,
          (p) => policyScopeViolations(p, rp),
          trust.freshness(),
          ctx.statusCache.uris().length,
        ),
      );
  });

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
