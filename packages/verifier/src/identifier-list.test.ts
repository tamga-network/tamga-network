/**
 * Doğrulayıcının D adımı — Attestation Revocation List (tanımlayıcı listesi; CIR 2024/2979 Ek II; ARF VCR_12). Status List ile
 * aynı ilkeler: ön çekim önbelleği (D2), kurumun kayıtlı iptal anahtarı (D3, S11), tazelik (D4), listede = iptal (D6).
 */
import { describe, expect, it, beforeAll } from "vitest";
import { createHash, webcrypto } from "node:crypto";
import { X509CertificateGenerator, cryptoProvider } from "@peculiar/x509";
import { signIdentifierListToken } from "@tamga-network/mdoc";
import { externalStatusScope, stepD, type VerifyCtx } from "./steps.js";
import {
  MemoryStatusCache,
  PrefetchStatusCache,
  isBinaryStatusContentType,
  isNonPublicAddress,
  statusHostsOf,
  statusBodyForCache,
  type StatusCache,
} from "./status-cache.js";

cryptoProvider.set(webcrypto as unknown as Crypto);
const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;
const URI = "https://status.example/il/1";
const NOW = Math.floor(Date.now() / 1000);

async function statusKey() {
  const keys = (await webcrypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
  const cert = await X509CertificateGenerator.createSelfSigned({
    serialNumber: "02",
    name: "CN=Test status signer",
    notBefore: new Date(Date.now() - 86400_000),
    notAfter: new Date(Date.now() + 86400_000),
    keys,
    signingAlgorithm: ALG,
  });
  const der = new Uint8Array(cert.rawData);
  const d = ((await webcrypto.subtle.exportKey("jwk", keys.privateKey)) as { d: string }).d;
  return { der, sk: new Uint8Array(Buffer.from(d, "base64url")), fp: createHash("sha256").update(der).digest("hex") };
}

describe("D — tanımlayıcı listesi (Attestation Revocation List)", () => {
  let key: Awaited<ReturnType<typeof statusKey>>;
  let stranger: Awaited<ReturnType<typeof statusKey>>;
  beforeAll(async () => {
    key = await statusKey();
    stranger = await statusKey();
  });
  const revokedId = "11".repeat(16);
  const token = (k = key, o: { iat?: number; exp?: number } = {}) =>
    "b64u:" +
    Buffer.from(
      signIdentifierListToken({
        uri: URI,
        identifiers: [Buffer.from(revokedId, "hex")],
        sk: k.sk,
        x5chain: [k.der],
        iat: o.iat ?? NOW - 30,
        exp: o.exp ?? NOW + 3600,
      }),
    ).toString("base64url");
  function ctx(id: string, cached?: string): VerifyCtx {
    const cache = new MemoryStatusCache();
    if (cached) cache.set(URI, cached);
    return {
      input: { statusCache: cache, policy: { freshness: { max_status_token_age_sec: 6 * 3600 } } },
      now: NOW,
      done: [],
      skipped: [],
      a: { format: "mso_mdoc", identifierList: { id, uri: URI } },
      issuerRec: { delegate_keys: [{ purpose: "status_list", fingerprint_sha256: key.fp, status: "ACTIVE" }] },
    } as unknown as VerifyCtx;
  }

  it("listede olmayan belge VALID; listedeki belge REJECTED (D6)", async () => {
    const ok = ctx("22".repeat(16), token());
    expect(await stepD(ok)).toBeUndefined();
    expect(ok.status.value).toBe("VALID");
    expect(ok.done).toEqual(["D1", "D2", "D3", "D4", "D6"]);
    expect(ok.skipped).toEqual(["D5"]);
    const bad = ctx(revokedId, token());
    expect(await stepD(bad)).toMatchObject({ kind: "reject", step: "D6" });
    expect(bad.status.value).toBe("INVALID");
  });

  it("önbellekte yok → DOĞRULANAMADI (D2); bayat → DOĞRULANAMADI (D4); kayıtsız imzacı → RED (D3)", async () => {
    expect(await stepD(ctx("22".repeat(16)))).toMatchObject({ kind: "indeterminate", step: "D2" });
    expect(await stepD(ctx("22".repeat(16), token(key, { exp: NOW - 1 })))).toMatchObject({
      kind: "indeterminate",
      step: "D4",
    });
    expect(await stepD(ctx("22".repeat(16), token(key, { iat: NOW - 7 * 3600 })))).toMatchObject({
      kind: "indeterminate",
      step: "D4",
    });
    expect(await stepD(ctx("22".repeat(16), token(stranger)))).toMatchObject({ kind: "reject", step: "D3" });
  });
});

describe("tanımlayıcı listesi: ikili gövde, bozuk önbellek, ön çekim kümesine ekleme", () => {
  let key: Awaited<ReturnType<typeof statusKey>>;
  beforeAll(async () => {
    key = await statusKey();
  });
  const cwt = () =>
    signIdentifierListToken({
      uri: URI,
      identifiers: [Buffer.from("11".repeat(16), "hex")],
      sk: key.sk,
      x5chain: [key.der],
      iat: NOW - 30,
      exp: NOW + 3600,
    });
  const ctxWith = (cache: StatusCache, id = "22".repeat(16)) =>
    ({
      input: { statusCache: cache, policy: { freshness: { max_status_token_age_sec: 6 * 3600 } } },
      now: NOW,
      done: [],
      skipped: [],
      a: { format: "mso_mdoc", identifierList: { id, uri: URI } },
      issuerRec: {
        issuer_id: "0x" + "ab".repeat(32),
        issuer_url: "https://issuer.example/acme",
        status_list_base: "https://status.example/il",
        delegate_keys: [{ purpose: "status_list", fingerprint_sha256: key.fp, status: "ACTIVE" }],
      },
    }) as unknown as VerifyCtx;

  it("gövde türe göre saklanır: içerik türü ne olursa olsun tanımlayıcı listesi bayt kalır", async () => {
    const bytes = cwt();
    for (const ct of ["application/cwt", "application/cbor", "application/octet-stream", "text/plain", null]) {
      const stored = statusBodyForCache(bytes, "identifier_list", ct);
      const cache = new MemoryStatusCache();
      cache.set(URI, stored);
      const c = ctxWith(cache);
      expect(await stepD(c)).toBeUndefined();
      expect(c.status.value).toBe("VALID");
    }
    // tür bilinmiyorsa: ikili içerik türleri ve +cwt/+cbor sonekleri bayt; geçersiz UTF-8 gövde de bayt
    for (const ct of [
      "application/cwt",
      "application/cbor",
      "application/octet-stream",
      "application/identifierlist+cwt; charset=binary",
      "application/x+cbor",
    ])
      expect(statusBodyForCache(bytes, undefined, ct)).toMatch(/^b64u:/);
    expect(statusBodyForCache(bytes, undefined, "text/plain")).toMatch(/^b64u:/); // CBOR baytları geçerli UTF-8 değil
    expect(statusBodyForCache(new TextEncoder().encode(" a.b.c \n"), "status_list", "application/cwt")).toBe("a.b.c");
    expect(isBinaryStatusContentType("text/plain")).toBe(false);
  });

  it("bozuk önbellek değeri (UTF-8 diye çözülmüş CWT, geçersiz base64url, CBOR değil) DOĞRULANAMADI (D4), RED değil", async () => {
    const bytes = cwt();
    const mangled = new TextDecoder().decode(bytes); // eski davranış: ikili gövde metin diye saklanırdı
    for (const bad of [
      mangled,
      "b64u:" + Buffer.from(new TextEncoder().encode(mangled)).toString("base64url"),
      "b64u:not base64url!",
      "b64u:" + Buffer.from(bytes).toString("base64"), // standart base64 (+ /) kabul edilmez
      "b64u:" + Buffer.from("plain text, not CBOR").toString("base64url"),
      "b64u:" + Buffer.from([0x83, 0x01, 0x02]).toString("base64url"), // CBOR ama COSE_Sign1 değil
    ]) {
      const cache = new MemoryStatusCache();
      cache.set(URI, bad);
      const r = await stepD(ctxWith(cache));
      expect(r, bad.slice(0, 20)).toMatchObject({ kind: "indeterminate", step: "D4", why: "STATUS_UNREACHABLE" });
    }
  });

  it("önbellekte olmayan liste ön çekim kümesine eklenir ve doğrulamanın dışında çekilir; sonraki doğrulama önbellekten", async () => {
    const calls: Array<[string, string | undefined]> = [];
    const bytes = cwt();
    const cache = new PrefetchStatusCache(
      async (u, kind) => {
        calls.push([u, kind]);
        return u === URI ? statusBodyForCache(bytes, kind, "application/octet-stream") : null;
      },
      { resolveHost: async () => ["93.184.216.34"] },
    );
    const first = await stepD(ctxWith(cache));
    expect(first).toMatchObject({ kind: "indeterminate", step: "D2" });
    await new Promise((r) => setTimeout(r, 5));
    expect(calls).toEqual([[URI, "identifier_list"]]);
    expect(cache.learnedRefs()).toEqual([{ uri: URI, kind: "identifier_list" }]);
    const second = ctxWith(cache);
    expect(await stepD(second)).toBeUndefined();
    expect(second.status.value).toBe("VALID");
    // periyodik ön çekim öğrenilen adresi türüyle yeniden çeker; ikinci "want" yeni çekim başlatmaz
    cache.want(URI, "identifier_list");
    expect(await cache.refresh(["https://status.example/sl/1"])).toEqual({
      ok: 1,
      failed: ["https://status.example/sl/1"],
    });
    expect(calls.slice(1)).toEqual([
      ["https://status.example/sl/1", undefined],
      [URI, "identifier_list"],
    ]);
    // yalnız https adresleri öğrenilir
    cache.want("file:///etc/passwd", "identifier_list", { issuer: "x", hosts: ["etc"] });
    expect(cache.learnedRefs()).toHaveLength(1);
  });
});

describe("tanımlayıcı listesi öğrenme sınırları (0.5.2: SSRF, kurumun iptal sunucuları, kurum başına üst sınır)", () => {
  const scope = { issuer: "0xa", hosts: ["status.example"] };
  const fetched: string[] = [];
  const make = (resolve: (h: string) => Promise<string[]> = async () => ["93.184.216.34"], maxPerIssuer?: number) => {
    fetched.length = 0;
    return new PrefetchStatusCache(
      async (u) => {
        fetched.push(u);
        return "b64u:AA";
      },
      { resolveHost: resolve, ...(maxPerIssuer ? { maxPerIssuer } : {}) },
    );
  };
  const tick = () => new Promise((r) => setTimeout(r, 5));

  it("kurum kaydından iptal sunucuları: status_list_base + issuer_url alan adı", () => {
    expect(
      statusHostsOf({ status_list_base: "https://Status.Example/il", issuer_url: "https://issuer.example/acme" }),
    ).toEqual(["status.example", "issuer.example"]);
    expect(statusHostsOf({ status_list_base: "", issuer_url: "" })).toEqual([]); // dış kurum (ADR-0036): öğrenilmez
    expect(statusHostsOf(null)).toEqual([]);
  });

  it("yalnız https ve yalnız kurumun bildirdiği sunucu; kapsam yoksa öğrenilmez", async () => {
    const c = make();
    c.want("http://status.example/il/1", "identifier_list", scope);
    c.want("https://evil.example/il/1", "identifier_list", scope);
    c.want("https://status.example.evil.example/il/1", "identifier_list", scope);
    c.want("https://user:pw@status.example/il/1", "identifier_list", scope);
    c.want("https://status.example/il/1", "identifier_list");
    c.want("https://status.example/il/1", "identifier_list", { issuer: "0xa", hosts: [] });
    await tick();
    expect(c.learnedRefs()).toEqual([]);
    expect(fetched).toEqual([]);
    c.want("https://status.example/il/1", "identifier_list", scope);
    await tick();
    expect(fetched).toEqual(["https://status.example/il/1"]);
  });

  it("IP yazılmış özel / geri döngü / bağlantı-yerel adres öğrenilmez (kurum bildirmiş olsa bile)", async () => {
    const c = make();
    for (const host of [
      "127.0.0.1",
      "10.0.0.5",
      "169.254.169.254",
      "192.168.1.1",
      "[::1]",
      "[fd00::1]",
      "[::ffff:127.0.0.1]",
    ]) {
      c.want(`https://${host}/il/1`, "identifier_list", { issuer: "0xa", hosts: [host] });
    }
    c.want("https://localhost/il/1", "identifier_list", { issuer: "0xa", hosts: ["localhost"] });
    await tick();
    expect(c.learnedRefs()).toEqual([]);
    expect(fetched).toEqual([]);
    // yerel geliştirme (allowLocal): yerel http kabul
    c.want("http://localhost:4001/il/1", "identifier_list", { issuer: "0xa", hosts: ["localhost"], allowLocal: true });
    await tick();
    expect(fetched).toEqual(["http://localhost:4001/il/1"]);
  });

  it("alan adı özel adrese çözülüyorsa ya da çözülemiyorsa çekilmez (ilk görüşte ve ön çekim turunda)", async () => {
    for (const resolve of [
      async () => ["10.1.2.3"],
      async () => ["93.184.216.34", "127.0.0.1"],
      async () => [],
      async () => Promise.reject(new Error("NXDOMAIN")),
    ]) {
      const c = make(resolve);
      c.want("https://status.example/il/1", "identifier_list", scope);
      await tick();
      expect(fetched).toEqual([]);
      await c.refresh([]);
      expect(fetched).toEqual([]);
    }
  });

  it("üst sınır kurum başına: bir kurumun belgeleri başka kurumun listesini dışarıda bırakmaz", async () => {
    const c = make(undefined, 2);
    for (let i = 0; i < 5; i++) c.want(`https://status.example/il/${i}`, "identifier_list", scope);
    c.want("https://other.example/il/1", "identifier_list", { issuer: "0xb", hosts: ["other.example"] });
    await tick();
    expect(c.learnedRefs().map((r) => r.uri)).toEqual([
      "https://status.example/il/0",
      "https://status.example/il/1",
      "https://other.example/il/1",
    ]);
  });

  it("SSRF denetimi: özel / ayrılmış aralıklar", () => {
    for (const ip of [
      "0.0.0.0",
      "10.0.0.1",
      "100.64.0.1",
      "127.0.0.1",
      "169.254.1.1",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.0.1",
      "224.0.0.1",
      "::",
      "::1",
      "fc00::1",
      "fe80::1",
      "::ffff:10.0.0.1",
      "::ffff:7f00:1",
    ])
      expect(isNonPublicAddress(ip), ip).toBe(true);
    for (const ip of ["93.184.216.34", "8.8.8.8", "172.32.0.1", "2001:4860:4860::8888", "status.example"])
      expect(isNonPublicAddress(ip), ip).toBe(false);
  });

  it("D adımı kurumun kaydıyla öğrenir; dış kurum (iptal sunucusu bildirilmemiş) öğrenilmez", async () => {
    const wanted: unknown[] = [];
    const cache = { get: () => null, want: (...a: unknown[]) => wanted.push(a) };
    const base = {
      input: { statusCache: cache, policy: { freshness: { max_status_token_age_sec: 3600 } } },
      now: NOW,
      done: [],
      skipped: [],
      a: { format: "mso_mdoc", identifierList: { id: "22".repeat(16), uri: URI } },
    };
    await stepD({
      ...base,
      issuerRec: {
        issuer_id: "0xa",
        issuer_url: "https://issuer.example",
        status_list_base: "https://status.example/il",
      },
    } as unknown as VerifyCtx);
    expect(wanted).toEqual([[URI, "identifier_list", { issuer: "0xa", hosts: ["status.example", "issuer.example"] }]]);
    wanted.length = 0;
    expect(await stepD({ ...base, issuerRec: null } as unknown as VerifyCtx)).toMatchObject({ step: "D2" });
    expect(wanted).toEqual([]);
  });

  it("0.5.2: dış kurum — dış listenin iptal sunucuları; yoksa belge imzacısının SAN alan adları; ikisi de yoksa öğrenilmez", async () => {
    const wanted: unknown[][] = [];
    const cache = { get: () => null, want: (...a: unknown[]) => wanted.push(a) };
    const ext = (status_hosts: string[]) => ({
      input: { statusCache: cache, policy: { freshness: { max_status_token_age_sec: 3600 } } },
      now: NOW,
      done: [],
      skipped: [],
      a: {
        format: "mso_mdoc",
        identifierList: { id: "22".repeat(16), uri: URI },
        leafDnsNames: ["*.pid.example.eu", "10.0.0.1", "localhost", "pid.example.eu"],
      },
      // dış kurum kaydı (trust-source externalIssuerRecord): issuer_url ve status_list_base boş
      issuerRec: { issuer_id: "0xext", issuer_url: "", status_list_base: "" },
      ext: { tri: "YES", status_hosts },
    });
    await stepD(ext(["status.pid.example.eu"]) as unknown as VerifyCtx);
    expect(wanted.pop()).toEqual([URI, "identifier_list", { issuer: "0xext", hosts: ["status.pid.example.eu"] }]);
    await stepD(ext([]) as unknown as VerifyCtx);
    expect(wanted.pop()).toEqual([URI, "identifier_list", { issuer: "0xext", hosts: [], domains: ["pid.example.eu"] }]);
  });

  it("externalStatusScope + acceptableUri: SAN alan adı ve alt alan adları; kardeş, sonek taklidi, tek etiket ve IP yok", () => {
    expect(externalStatusScope({ status_hosts: ["A.example"] }, ["pid.example"])).toEqual({ hosts: ["a.example"] });
    const s = {
      issuer: "0xext",
      ...externalStatusScope({ status_hosts: [] }, ["*.Pid.Example.eu", "eu", "1.2.3.4", "x.local"]),
    };
    expect(s.domains).toEqual(["pid.example.eu"]);
    const ok = (u: string) => PrefetchStatusCache.acceptableUri(u, s);
    expect(ok("https://pid.example.eu/il/1")).toBe(true);
    expect(ok("https://status.pid.example.eu/il/1")).toBe(true);
    expect(ok("https://example.eu/il/1")).toBe(false); // üst alan adı değil
    expect(ok("https://other.example.eu/il/1")).toBe(false); // kardeş
    expect(ok("https://evilpid.example.eu/il/1")).toBe(false); // sonek taklidi
    expect(ok("http://pid.example.eu/il/1")).toBe(false);
    // SAN'ı da olmayan dış kurum: kapsam boş, adres öğrenilmez
    expect(
      PrefetchStatusCache.acceptableUri(URI, { issuer: "0xext", ...externalStatusScope({ status_hosts: [] }, []) }),
    ).toBe(false);
  });
});
