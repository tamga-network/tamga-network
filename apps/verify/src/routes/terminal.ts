/** ADR-0012 B: turnike/terminal uçları. Terminaller (kapılar) bu servisi çağırır → jti tekrar listesi kapılar arasında ortaktır (K3). */
import type { FastifyInstance } from "fastify";
import type { VerifyContext } from "../app.js";
import { langOf, terminalPage } from "../html.js";
import { CAMPUS_GROUP } from "../policies.js";

const DEFAULT_GROUP = CAMPUS_GROUP;

const GROUP_RE = /^[a-z0-9-]{1,40}$/;

export function registerTerminalRoutes(app: FastifyInstance, ctx: VerifyContext) {
  app.post("/terminal/verify", async (req, reply) => {
    const b = req.body as { token?: string; terminal_group?: string };
    if (!b.token) return reply.code(400).send({ ok: false, reason: "token required" });
    const group = b.terminal_group ?? DEFAULT_GROUP;
    if (typeof group !== "string" || !GROUP_RE.test(group))
      return reply.code(400).send({ ok: false, reason: "invalid terminal group" });
    const r = await ctx.passes.verifyToken(String(b.token).trim(), { terminalGroup: group });
    ctx.gateStats.record(group, r.ok, r.reason);
    ctx.audit({
      event: r.ok ? "pass.accepted" : "pass.rejected",
      terminal_group: group,
      reason: r.reason ?? null,
      pass_id: r.passId ?? null,
    });
    return r;
  });

  // Operatör görünümü: kayıtlı kart sayısı ve kimlikleri herkese açık olmamalı (yalnız yönetici belirteciyle)
  app.get("/terminal/passes", async (req, reply) => {
    if (!ctx.isAdmin(req.headers["x-admin-token"])) return reply.code(404).send("not found");
    return {
      passes: ctx.passes.list().map((p) => ({
        pass_id: p.passId,
        terminal_group: p.terminalGroup,
        valid_until: new Date(p.validUntil * 1000).toISOString(),
      })),
    };
  });

  // Kurum konsolu için kapı sayaçları (yönetici belirteci; kişisel veri yok): ?group=a,b&days=14 (0 = tüm geçmiş)
  app.get("/stats/gates", async (req, reply) => {
    if (!ctx.isAdmin(req.headers["x-admin-token"])) return reply.code(404).send("not found");
    const q = req.query as { group?: string; days?: string };
    const groups = (q.group ?? "").split(",").filter((g) => GROUP_RE.test(g));
    const n = Number(q.days ?? 14);
    const days = Number.isInteger(n) && n >= 0 ? Math.min(n, 36500) : 14;
    return { days, groups, rows: ctx.gateStats.query(groups, days) };
  });

  app.get("/terminal", async (req, reply) => {
    const group = (req.query as { group?: string }).group ?? DEFAULT_GROUP;
    // grup kimliği biçimi (politikalardaki terminal_group: bilgi-campus, bubilet-gate …) — başka her şey reddedilir (K1)
    if (!GROUP_RE.test(group)) return reply.code(400).type("text/plain").send("invalid terminal group");
    return reply.type("text/html").send(terminalPage(langOf(req.headers["accept-language"]), group));
  });
}
