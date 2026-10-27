/**
 * Status List ön çekim önbelleğinin denetimli çekimi (0.5.2): yönlendirme elle izlenir ve her adımda adres yeniden denetlenir;
 * bağlantı denetlenen IP'ye sabitlenir (DNS rebinding). Ağ yok: taşıyıcı ve çözücü sahte; son test yerel bir HTTP sunucusuyla
 * `nodeStatusTransport`'un IP sabitlemesini gösterir.
 */
import { describe, it, expect } from "vitest";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import {
  MAX_STATUS_REDIRECTS,
  PrefetchStatusCache,
  nodeStatusTransport,
  pinnedLookup,
  type StatusHttpRequest,
  type StatusHttpResponse,
} from "./status-cache.js";

const URI = "https://status.example/il/1";
const scope = { issuer: "0xa", hosts: ["status.example", "cdn.status.example"] };
const PUBLIC = "93.184.216.34";
const tick = () => new Promise((r) => setTimeout(r, 10));
const body = (s = "list") => new TextEncoder().encode(s);

/** Sahte taşıyıcı: adres → yanıt; her isteği kaydeder. */
function transport(routes: Record<string, StatusHttpResponse>) {
  const calls: StatusHttpRequest[] = [];
  const fn = async (req: StatusHttpRequest): Promise<StatusHttpResponse> => {
    calls.push(req);
    return routes[req.url.href] ?? { status: 404, location: null, contentType: null, body: null };
  };
  return { fn, calls };
}
const redirect = (to: string): StatusHttpResponse => ({ status: 302, location: to, contentType: null, body: null });
const okBody = (): StatusHttpResponse => ({
  status: 200,
  location: null,
  contentType: "application/octet-stream",
  body: body(),
});

describe("denetimli çekim — yönlendirme her adımda yeniden denetlenir (SSRF)", () => {
  it("169.254.169.254'e (bulut meta veri) yönlendirme izlenmez", async () => {
    const t = transport({ [URI]: redirect("https://169.254.169.254/latest/meta-data/") });
    const c = new PrefetchStatusCache(undefined, { transport: t.fn, resolveHost: async () => [PUBLIC] });
    c.want(URI, "identifier_list", scope);
    await tick();
    expect(t.calls.map((r) => r.url.href)).toEqual([URI]);
    expect(c.get(URI)).toBeNull();
  });

  it("kapsam dışı sunucuya, http'ye ve özel adrese çözülen kapsam içi sunucuya yönlendirme izlenmez", async () => {
    for (const [to, resolve] of [
      ["https://evil.example/x", async () => [PUBLIC]],
      ["http://cdn.status.example/x", async () => [PUBLIC]],
      ["https://cdn.status.example/x", async (h: string) => (h === "cdn.status.example" ? ["10.0.0.7"] : [PUBLIC])],
      ["file:///etc/passwd", async () => [PUBLIC]],
    ] as const) {
      const t = transport({ [URI]: redirect(to), [to]: okBody() });
      const c = new PrefetchStatusCache(undefined, { transport: t.fn, resolveHost: resolve });
      c.want(URI, "identifier_list", scope);
      await tick();
      expect(
        t.calls.map((r) => r.url.href),
        to,
      ).toEqual([URI]);
      expect(c.get(URI), to).toBeNull();
    }
  });

  it("kapsam içi yönlendirme izlenir; her adım kendi denetlenen IP'sine sabitlenir", async () => {
    const to = "https://cdn.status.example/il/1";
    const t = transport({ [URI]: redirect("/moved"), "https://status.example/moved": redirect(to), [to]: okBody() });
    const ips: Record<string, string> = { "status.example": PUBLIC, "cdn.status.example": "8.8.4.4" };
    const c = new PrefetchStatusCache(undefined, { transport: t.fn, resolveHost: async (h) => [ips[h]] });
    c.want(URI, "identifier_list", scope);
    await tick();
    expect(t.calls.map((r) => [r.url.href, r.address])).toEqual([
      [URI, PUBLIC],
      ["https://status.example/moved", PUBLIC],
      [to, "8.8.4.4"],
    ]);
    expect(c.get(URI)?.token).toBe(`b64u:${Buffer.from(body()).toString("base64url")}`);
  });

  it(`en çok ${MAX_STATUS_REDIRECTS} yönlendirme`, async () => {
    const hop = (i: number) => `https://status.example/h${i}`;
    const routes: Record<string, StatusHttpResponse> = { [URI]: redirect(hop(1)) };
    for (let i = 1; i <= MAX_STATUS_REDIRECTS + 1; i++) routes[hop(i)] = redirect(hop(i + 1));
    routes[hop(MAX_STATUS_REDIRECTS)] = okBody(); // tam sınırda: kabul
    const t = transport(routes);
    const c = new PrefetchStatusCache(undefined, { transport: t.fn, resolveHost: async () => [PUBLIC] });
    c.want(URI, "identifier_list", scope);
    await tick();
    expect(c.get(URI)).not.toBeNull();
    routes[hop(MAX_STATUS_REDIRECTS)] = redirect(hop(MAX_STATUS_REDIRECTS + 1)); // bir fazlası: ret
    routes[hop(MAX_STATUS_REDIRECTS + 1)] = okBody();
    const t2 = transport(routes);
    const c2 = new PrefetchStatusCache(undefined, { transport: t2.fn, resolveHost: async () => [PUBLIC] });
    c2.want(URI, "identifier_list", scope);
    await tick();
    expect(c2.get(URI)).toBeNull();
    expect(t2.calls).toHaveLength(MAX_STATUS_REDIRECTS + 1);
  });

  it("DNS rebinding: önce genel sonra özel adres dönen ad — bağlantı denetlenen genel IP'ye; sonraki turda özel → istek yok", async () => {
    const answers = [[PUBLIC], ["169.254.169.254"]];
    let n = 0;
    const t = transport({ [URI]: okBody() });
    const c = new PrefetchStatusCache(undefined, {
      transport: t.fn,
      resolveHost: async () => answers[Math.min(n++, answers.length - 1)],
    });
    c.want(URI, "identifier_list", scope);
    await tick();
    // ilk çekim: ad bir kez çözüldü, istek o IP'ye sabitlendi (taşıyıcı adı yeniden çözmez)
    expect(n).toBe(1);
    expect(t.calls.map((r) => r.address)).toEqual([PUBLIC]);
    // ad artık iç ağa çözülüyor: ön çekim turunda istek hiç yapılmaz
    expect((await c.refresh([])).failed).toEqual([URI]);
    expect(t.calls).toHaveLength(1);
  });

  it("çapa günlüğündeki adres: yalnız aynı kökene yönlendirme izlenir", async () => {
    const anchored = "https://status.tamga.example/sl/1";
    const t = transport({
      [anchored]: redirect("https://status.tamga.example/sl/1.jwt"),
      "https://status.tamga.example/sl/1.jwt": { status: 200, location: null, contentType: null, body: body("jwt") },
    });
    const c = new PrefetchStatusCache(undefined, { transport: t.fn });
    expect(await c.refresh([anchored])).toEqual({ ok: 1, failed: [] });
    expect(c.get(anchored)?.token).toBe("jwt");
    const t2 = transport({ [anchored]: redirect("http://169.254.169.254/") });
    const c2 = new PrefetchStatusCache(undefined, { transport: t2.fn });
    expect(await c2.refresh([anchored])).toEqual({ ok: 0, failed: [anchored] });
    expect(t2.calls).toHaveLength(1);
  });
});

describe("nodeStatusTransport — bağlantı denetlenen IP'ye sabitlenir", () => {
  it("çözülemeyen alan adı sabitlenmiş IP'ye bağlanır, Host başlığı alan adı kalır; 3xx izlenmez", async () => {
    const seen: Array<string | undefined> = [];
    const srv = createServer((req, res) => {
      seen.push(req.headers.host);
      if (req.url === "/moved") {
        res.writeHead(302, { location: "https://169.254.169.254/" });
        return res.end();
      }
      res.writeHead(200, { "content-type": "application/statuslist+jwt" });
      res.end("token");
    });
    await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
    const port = (srv.address() as AddressInfo).port;
    try {
      const base = { address: "127.0.0.1", family: 4 as const, accept: "*/*", timeoutMs: 3000, maxBytes: 1024 };
      // `.invalid` hiçbir zaman çözülmez (RFC 6761): yanıt geldiyse bağlantı sabitlenen IP'ye kurulmuştur
      const r = await nodeStatusTransport({ ...base, url: new URL(`http://status.invalid:${port}/sl`) });
      expect(r).toMatchObject({ status: 200, contentType: "application/statuslist+jwt" });
      expect(new TextDecoder().decode(r.body!)).toBe("token");
      const moved = await nodeStatusTransport({ ...base, url: new URL(`http://status.invalid:${port}/moved`) });
      expect(moved).toMatchObject({ status: 302, location: "https://169.254.169.254/", body: null });
      expect(seen).toEqual([`status.invalid:${port}`, `status.invalid:${port}`]);
      // üst sınırı aşan gövde okunmaz
      const big = await nodeStatusTransport({ ...base, maxBytes: 2, url: new URL(`http://status.invalid:${port}/sl`) });
      expect(big.body).toBeNull();
    } finally {
      await new Promise((r) => srv.close(r));
    }
  });

  it("pinnedLookup iki çağrı biçimini de karşılar", () => {
    const l = pinnedLookup("93.184.216.34", 4) as unknown as (h: string, o: unknown, cb: unknown) => void;
    let one: unknown[] = [];
    let all: unknown[] = [];
    l("x.example", {}, (...a: unknown[]) => (one = a));
    l("x.example", { all: true }, (...a: unknown[]) => (all = a));
    expect(one).toEqual([null, "93.184.216.34", 4]);
    expect(all).toEqual([null, [{ address: "93.184.216.34", family: 4 }]]);
  });
});

describe("doğrulama başına çekim (fetchNow) — yalnız açıkça etkinleştirilince (SPEC-CRED-0003 §9.1, T1)", () => {
  const jwtBody = (): StatusHttpResponse => ({
    status: 200,
    location: null,
    contentType: "application/statuslist+jwt",
    body: body("eyJ.list.sig"),
  });

  it("kapsam içi adres beklenerek çekilir ve önbelleğe yazılır; ön çekim kümesine eklenmez", async () => {
    const t = transport({ [URI]: jwtBody() });
    const c = new PrefetchStatusCache(undefined, { transport: t.fn, resolveHost: async () => [PUBLIC] });
    expect(await c.fetchNow(URI, "status_list", scope)).toBe(true);
    expect(c.get(URI)?.token).toBe("eyJ.list.sig");
    expect(t.calls[0].address).toBe(PUBLIC);
    expect(c.learnedRefs()).toEqual([]);
  });

  it("kapsam dışı sunucu, http ve özel adrese çözülen ad çekilmez", async () => {
    for (const [uri, resolve] of [
      ["https://evil.example/il/1", async () => [PUBLIC]],
      ["http://status.example/il/1", async () => [PUBLIC]],
      [URI, async () => ["10.0.0.7"]],
    ] as const) {
      const t = transport({ [uri]: jwtBody() });
      const c = new PrefetchStatusCache(undefined, { transport: t.fn, resolveHost: resolve });
      expect(await c.fetchNow(uri, "status_list", scope), uri).toBe(false);
      expect(t.calls.length, uri).toBe(0);
      expect(c.get(uri), uri).toBeNull();
    }
  });

  it("süre sınırı: yanıt gecikirse beklemez (false), doğrulama DOĞRULANAMADI'ya düşer", async () => {
    const slow = async (): Promise<StatusHttpResponse> => {
      await new Promise((r) => setTimeout(r, 200));
      return jwtBody();
    };
    const c = new PrefetchStatusCache(undefined, { transport: slow, resolveHost: async () => [PUBLIC] });
    const started = Date.now();
    expect(await c.fetchNow(URI, "status_list", scope, 20)).toBe(false);
    expect(Date.now() - started).toBeLessThan(150);
  });
});
