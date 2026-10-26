/**
 * ADR-0012 B: turnike/terminal uçları. Terminaller (kapılar) bu servisi çağırır → jti tekrar listesi kapılar arasında ortaktır (K3).
 * ADR-0065: kapı kimliğini gösterir — `POST /terminal/verify` yalnız grubuna bağlı terminal anahtarıyla (`Authorization: Bearer`);
 * anahtarsız istek jetona dokunmaz (tek kullanımlık bilet QR'ı fotoğraflayan onu tüketemez — TK1). Anahtarlar yönetici ucundan
 * verilir/iptal edilir (TK2); sunucuda yalnız özet (TK3).
 */
import type { FastifyInstance } from "fastify";
import type { VerifyContext } from "../app.js";
import { langOf, noTerminalPage, terminalPage } from "../html.js";
import { CAMPUS_GROUP } from "../policies.js";
import { rateLimitHook } from "../rate-limit.js";

const DEFAULT_GROUP = CAMPUS_GROUP;

const GROUP_RE = /^[a-z0-9-]{1,40}$/;

export function registerTerminalRoutes(app: FastifyInstance, ctx: VerifyContext) {
  // Kapı politikası (proximity) olmayan ağda (bugün gerçek ağ) kapı yüzü kapalıdır; sayaç ve yönetici uçları kalır.
  const hasGates = ctx.policies.some((p) => p.proximity);
  const knownGroups = () =>
    new Set(ctx.policies.map((p) => p.proximity?.terminal_group).filter((g): g is string => typeof g === "string"));
  app.post("/terminal/verify", { preHandler: rateLimitHook(ctx.limits.terminal) }, async (req, reply) => {
    if (!hasGates) return reply.code(404).send({ ok: false, reason: "no terminal groups on this network" });
    // ADR-0065 TK1: önce terminal kimliği — anahtarsız istek jetonu okumaz, tüketmez, sayaçlara girmez
    const term = ctx.terminalKeys.authenticate(req.headers.authorization);
    if (!term) {
      ctx.audit({ event: "terminal.unauthorized" }); // adres ve jeton yazılmaz
      return reply
        .code(401)
        .header("www-authenticate", 'Bearer realm="tamga-terminal"')
        .send({ ok: false, reason: "terminal key required" });
    }
    const b = req.body as { token?: string; terminal_group?: string };
    if (!b.token) return reply.code(400).send({ ok: false, reason: "token required" });
    // grup anahtardan gelir; gövdede verilmişse aynı olmalı (başka grubun kapısı gibi davranılamaz)
    const group = term.terminalGroup;
    if (b.terminal_group !== undefined && b.terminal_group !== group)
      return reply.code(403).send({ ok: false, reason: "terminal key is not for this terminal group" });
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

  // ADR-0065 TK2: terminal anahtarları — işletmeci (Kurum Konsolu, iç adres) verir ve iptal eder; yalnız yönetici belirteciyle.
  // Liste özet taşımaz; anahtar yalnız verme yanıtında bir kez görünür.
  app.get("/terminal/keys", async (req, reply) => {
    if (!ctx.isAdmin(req.headers["x-admin-token"])) return reply.code(404).send("not found");
    return { keys: ctx.terminalKeys.list() };
  });
  app.post("/terminal/keys", async (req, reply) => {
    if (!ctx.isAdmin(req.headers["x-admin-token"])) return reply.code(404).send("not found");
    const b = (req.body ?? {}) as { terminal_group?: unknown; label?: unknown };
    const group = typeof b.terminal_group === "string" ? b.terminal_group : "";
    if (!GROUP_RE.test(group) || !knownGroups().has(group))
      return reply.code(400).send({ error: "invalid_request", error_description: "unknown terminal group" });
    const label = typeof b.label === "string" ? b.label : undefined;
    const k = ctx.terminalKeys.issue(group, label);
    ctx.audit({ event: "terminal.key_issued", terminal_group: group, key_id: k.id });
    return reply.code(201).send({ id: k.id, terminal_group: group, key: k.key });
  });
  app.delete<{ Params: { id: string } }>("/terminal/keys/:id", async (req, reply) => {
    if (!ctx.isAdmin(req.headers["x-admin-token"])) return reply.code(404).send("not found");
    const ok = ctx.terminalKeys.revoke(req.params.id);
    if (ok) ctx.audit({ event: "terminal.key_revoked", key_id: req.params.id });
    return ok ? { ok: true } : reply.code(404).send({ error: "not_found" });
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
    if (!hasGates)
      return reply
        .code(404)
        .type("text/html")
        .send(noTerminalPage(langOf(req.headers["accept-language"])));
    const group = (req.query as { group?: string }).group ?? DEFAULT_GROUP;
    // grup kimliği biçimi (politikalardaki terminal_group: bilgi-campus, bubilet-gate …) — başka her şey reddedilir (K1)
    if (!GROUP_RE.test(group)) return reply.code(400).type("text/plain").send("invalid terminal group");
    return reply.type("text/html").send(terminalPage(langOf(req.headers["accept-language"]), group));
  });
}
