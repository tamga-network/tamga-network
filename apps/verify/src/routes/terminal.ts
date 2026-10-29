/**
 * ADR-0012 B: turnike/terminal uçları. Terminaller (kapılar) bu servisi çağırır → jti tekrar listesi kapılar arasında ortaktır (K3).
 * ADR-0065: kapı kimliğini gösterir — `POST /terminal/verify` yalnız grubuna bağlı terminal anahtarıyla (`Authorization: Bearer`);
 * anahtarsız istek jetona dokunmaz (tek kullanımlık bilet QR'ı fotoğraflayan onu tüketemez — TK1). Anahtarlar yönetici ucundan
 * verilir/iptal edilir (TK2); sunucuda yalnız özet (TK3).
 * ADR-0069: kapı grubu imzalı listede (`terminal_groups[]`) bir kuruma bağlıysa anahtar o kurum adına verilir; Kurum Konsolu
 * uçları kuruma daraltılmış belirteçle çağırır ve yalnız kendi gruplarını yönetir (TG2). Listede geri çekilmiş grubun anahtarı
 * geçmez (TG3). Grup listede yoksa ADR-0065 yolu aynen (yalnız işletmeci).
 *
 * Kapalı kalma (0.7.4): "liste bayat / okunamıyor" ile "grup listede yok" ayrılır. Sahibi olan anahtar ya da listede bir kez
 * görülmüş grup listede doğrulanamazsa (bayat liste ya da listeden çıkmış grup) kapıda 403 — liste arızası kapıyı açmaz.
 * Listede grubun `allowed_policies`'i kapıda da denetlenir: kartı izinli olmayan politika vermişse jeton tüketilmeden 403.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { VerifyContext } from "../app.js";
import { langOf, noTerminalPage, terminalPage } from "../html.js";
import { CAMPUS_GROUP } from "../policies.js";
import { rateLimitHook } from "../rate-limit.js";
import { institutionToken, type TerminalKeyInfo } from "../terminal-keys.js";
import type { TerminalGroupAnswer } from "@tamga-network/trust";

const DEFAULT_GROUP = CAMPUS_GROUP;

const GROUP_RE = /^[a-z0-9-]{1,40}$/;
const INST_RE = /^[a-z0-9.-]{3,253}$/;

/** Yönetici ucunu çağıran: işletmeci (tam yetki) ya da kuruma daraltılmış belirteçle bir kurum (ADR-0069 TG2). */
type AdminScope = { kind: "operator" } | { kind: "institution"; id: string };
const sameSecret = (a: string, b: string) => {
  const h = (v: string) => createHash("sha256").update(v).digest();
  return timingSafeEqual(h(a), h(b));
};
function adminScope(ctx: VerifyContext, req: FastifyRequest): AdminScope | null {
  if (ctx.isAdmin(req.headers["x-admin-token"])) return { kind: "operator" };
  const admin = process.env.TAMGA_ADMIN_TOKEN;
  const inst = req.headers["x-tamga-institution"];
  const tok = req.headers["x-institution-token"];
  if (!admin || typeof inst !== "string" || typeof tok !== "string" || !INST_RE.test(inst)) return null;
  return sameSecret(tok, institutionToken(admin, inst)) ? { kind: "institution", id: inst } : null;
}

/**
 * ADR-0069 TG3: kapıda kartın politikası grubun imzalı listedeki `allowed_policies`'inde mi? Liste izinli politika vermiyorsa
 * denetim yok (undefined). Politika kimliği olmayan eski kart yalnız bu ağda gruba bağlı BÜTÜN politikalar izinliyse geçer
 * (hangisi vermiş olursa olsun izinli).
 */
export function passPolicyGate(
  policies: ReadonlyArray<{ policy_id: string; proximity?: { terminal_group: string } }>,
  group: string,
  allowedPolicies: readonly string[] | undefined,
): ((policyId: string | undefined) => boolean) | undefined {
  if (!allowedPolicies) return undefined;
  const allowed = new Set(allowedPolicies);
  const mine = policies.filter((p) => p.proximity?.terminal_group === group);
  const legacyOk = mine.length > 0 && mine.every((p) => allowed.has(p.policy_id));
  return (policyId) => (policyId ? allowed.has(policyId) : legacyOk);
}

export function registerTerminalRoutes(app: FastifyInstance, ctx: VerifyContext) {
  // Kapı politikası (proximity) olmayan ağda (bugün gerçek ağ) kapı yüzü kapalıdır; sayaç ve yönetici uçları kalır.
  const hasGates = ctx.policies.some((p) => p.proximity);
  const knownGroups = () =>
    new Set(ctx.policies.map((p) => p.proximity?.terminal_group).filter((g): g is string => typeof g === "string"));
  /**
   * Grubun imzalı listedeki durumu: `listed` (cevap), `not_listed` (liste sağlıklı, grup yok) ya da `unknown` (liste bayat ya da
   * kaynak kapı gruplarını okumuyor). Listede görülen grup iz bırakır; listesizken verilmiş sahipsiz anahtarlar kuruma bağlanır.
   */
  type GroupState = { kind: "listed"; answer: TerminalGroupAnswer } | { kind: "not_listed" } | { kind: "unknown" };
  const groupState = (g: string): GroupState => {
    const ts = ctx.trust();
    if (!ts.terminalGroup || !ts.freshness().healthy) return { kind: "unknown" };
    const answer = ts.terminalGroup(g);
    if (!answer) return { kind: "not_listed" };
    ctx.terminalKeys.markListed(g);
    if (answer.group.institution_id) ctx.terminalKeys.adoptOwner(g, answer.group.institution_id);
    return { kind: "listed", answer };
  };
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
    // ADR-0069 TG3: imzalı listede grup geri çekildiyse ya da başka kuruma geçtiyse anahtar geçmez (grup listede yoksa ADR-0065).
    // Kapalı kalma: sahibi olan anahtar ya da listede görülmüş grup listede doğrulanamazsa (bayat liste / listeden çıkmış) 403.
    const st = groupState(group);
    const bound = !!term.owner || ctx.terminalKeys.wasListed(group);
    if (st.kind !== "listed" && bound) {
      const unknown = st.kind === "unknown";
      ctx.audit({ event: unknown ? "terminal.group_unconfirmed" : "terminal.group_unlisted", terminal_group: group });
      return reply.code(403).send({
        ok: false,
        reason: unknown
          ? "terminal group cannot be confirmed (trust list unavailable)"
          : "terminal group is not in the trust list",
      });
    }
    const listed = st.kind === "listed" ? st.answer : null;
    if (listed && !listed.active) {
      ctx.audit({ event: "terminal.group_inactive", terminal_group: group });
      return reply.code(403).send({ ok: false, reason: "terminal group is not active in the trust list" });
    }
    if (listed && term.owner && listed.group.institution_id && term.owner !== listed.group.institution_id) {
      ctx.audit({ event: "terminal.owner_mismatch", terminal_group: group, key_id: term.id });
      return reply.code(403).send({ ok: false, reason: "terminal key belongs to another institution" });
    }
    const policyAllowed = listed ? passPolicyGate(ctx.policies, group, listed.group.allowed_policies) : undefined;
    const r = await ctx.passes.verifyToken(String(b.token).trim(), {
      terminalGroup: group,
      ...(policyAllowed ? { policyAllowed } : {}),
    });
    if (!r.ok && r.reason === "pass policy not allowed for this terminal group") {
      ctx.audit({ event: "terminal.policy_not_allowed", terminal_group: group });
      return reply.code(403).send(r);
    }
    ctx.gateStats.record(group, r.ok, r.reason);
    ctx.audit({
      event: r.ok ? "pass.accepted" : "pass.rejected",
      terminal_group: group,
      reason: r.reason ?? null,
      pass_id: r.passId ?? null,
    });
    return r;
  });

  // ADR-0065 TK2: terminal anahtarları — işletmeci verir ve iptal eder; yalnız yönetici belirteciyle. Liste özet taşımaz; anahtar
  // yalnız verme yanıtında bir kez görünür. ADR-0069 TG2: kuruma daraltılmış belirteç yalnız o kurumun gruplarını görür ve yönetir.
  const listedGroup = (g: string) => {
    const st = groupState(g);
    return st.kind === "listed" ? st.answer : null;
  };
  const ownerOf = (k: Pick<TerminalKeyInfo, "owner" | "terminalGroup">) =>
    k.owner ?? listedGroup(k.terminalGroup)?.group.institution_id;
  const visible = (scope: AdminScope, owner: string | undefined) => scope.kind === "operator" || owner === scope.id;
  const by = (scope: AdminScope) => (scope.kind === "operator" ? "operator" : `institution:${scope.id}`);
  /** Bu ağın kapı grupları (politikalardan) ve imzalı listedeki kayıtları — konsol verme seçeneklerini buradan kurar. */
  const groupsView = (scope: AdminScope) =>
    [...knownGroups()]
      .map((g) => {
        const l = listedGroup(g);
        return {
          group_id: g,
          listed: !!l,
          active: l ? l.active : true,
          ...(l?.group.institution_id ? { institution_id: l.group.institution_id } : {}),
          ...(l?.group.label ? { label: l.group.label } : {}),
          ...(l?.group.allowed_policies ? { allowed_policies: l.group.allowed_policies } : {}),
        };
      })
      .filter((g) => visible(scope, g.institution_id));
  app.get("/terminal/keys", async (req, reply) => {
    const scope = adminScope(ctx, req);
    if (!scope) return reply.code(404).send("not found");
    const keys = ctx.terminalKeys
      .list()
      .map((k) => {
        const owner = ownerOf(k);
        return { ...k, ...(owner ? { owner } : {}) };
      })
      .filter((k) => visible(scope, k.owner));
    return { keys, groups: groupsView(scope) };
  });
  app.post("/terminal/keys", async (req, reply) => {
    const scope = adminScope(ctx, req);
    if (!scope) return reply.code(404).send("not found");
    const b = (req.body ?? {}) as { terminal_group?: unknown; label?: unknown };
    const group = typeof b.terminal_group === "string" ? b.terminal_group : "";
    if (!GROUP_RE.test(group) || !knownGroups().has(group))
      return reply.code(400).send({ error: "invalid_request", error_description: "unknown terminal group" });
    const st = groupState(group);
    const listed = st.kind === "listed" ? st.answer : null;
    const owner = listed?.group.institution_id;
    // listede görülmüş grup bugün doğrulanamıyorsa (bayat liste / listeden çıkmış) kimseye anahtar verilmez (kapalı kalma)
    if (!listed && ctx.terminalKeys.wasListed(group))
      return reply.code(409).send({
        error: "conflict",
        error_description:
          st.kind === "unknown"
            ? "terminal group cannot be confirmed (trust list unavailable)"
            : "terminal group is not in the trust list",
      });
    // kurum yalnız imzalı listede kendisine bağlı grup için anahtar alır (TG2); işletmeci listede olmayan grup için de (ADR-0065)
    if (scope.kind === "institution" && owner !== scope.id)
      return reply
        .code(403)
        .send({ error: "forbidden", error_description: "terminal group is not registered to this institution" });
    if (listed && !listed.active)
      return reply
        .code(409)
        .send({ error: "conflict", error_description: "terminal group is not active in the trust list" });
    if (listed?.group.allowed_policies) {
      const allowed = new Set(listed.group.allowed_policies);
      if (!ctx.policies.some((p) => p.proximity?.terminal_group === group && allowed.has(p.policy_id)))
        return reply
          .code(409)
          .send({ error: "conflict", error_description: "no gate policy of this group is allowed by the trust list" });
    }
    const label = typeof b.label === "string" ? b.label.trim() || undefined : undefined;
    const k = ctx.terminalKeys.issue(group, label, undefined, owner);
    ctx.audit({ event: "terminal.key_issued", terminal_group: group, key_id: k.id, by: by(scope) });
    return reply.code(201).send({ id: k.id, terminal_group: group, ...(owner ? { owner } : {}), key: k.key });
  });
  app.delete<{ Params: { id: string } }>("/terminal/keys/:id", async (req, reply) => {
    const scope = adminScope(ctx, req);
    if (!scope) return reply.code(404).send("not found");
    const k = ctx.terminalKeys.get(req.params.id);
    // başka kurumun anahtarı yokmuş gibi (varlığı da açığa çıkmaz)
    if (!k || !visible(scope, ownerOf(k))) return reply.code(404).send({ error: "not_found" });
    const ok = ctx.terminalKeys.revoke(req.params.id);
    if (ok) ctx.audit({ event: "terminal.key_revoked", key_id: req.params.id, by: by(scope) });
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
