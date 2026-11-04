/**
 * Katılım aracı: init (yanıt → başvuru), keys (anahtar + CSR, üzerine yazmama, parola), kurulum denetimi (sahte HTTP/DNS; sorgu ucu
 * yalnız geçersiz istekle), liste denetimi (test listesi, gömülü olmayan pinlerle), MCP sunucusu (kök sınırı, özel anahtar dönmez).
 */
import { afterAll, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  buildApplications,
  checkMetadataChain,
  csrExpectations,
  csrSpkiSha256,
  generateKeyAndCsr,
  generateKeys,
  inspectCsr,
  installationChecks,
  listingChecks,
  privateKeySpkiSha256,
  sandboxGuide,
  validateProfile,
  type Answers,
  type Dns,
  type Http,
} from "./index.js";
import { createServer, TOOLS } from "./mcp.js";

const tmp = mkdtempSync(join(tmpdir(), "tamga-onboard-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const answers = (over: Partial<Answers> = {}): Answers => ({
  role: "issuer",
  slug: "example-college",
  legal_name: "Example College",
  identifier: { scheme: "TR-VKN", value: "TR1234567890" },
  postal_address: { street_address: "Example Street 1", locality: "Istanbul", country: "TR" },
  contact: { support_uri: "https://example.edu.tr/support", email: "info@example.edu.tr" },
  domain: "example.edu.tr",
  vcts: ["urn:tamga:edu:StudentCredential:1", "urn:tamga:edu:DiplomaCredential:1"],
  identity_matching: { privacy_policy_uri: "https://example.edu.tr/privacy" },
  lookup_url: "https://sis.example.edu.tr/tamga/lookup",
  isced_f_codes: ["0613"],
  ...over,
});

describe("init — yanıtlardan başvuru", () => {
  it("barındırılan belge veren: kurum + kimlik eşleştirme başvurusu, iki anahtar, RP anahtarı operatörde", () => {
    const b = buildApplications(answers());
    expect(b.problems).toEqual([]);
    expect(b.issuer).toMatchObject({ slug: "example-college", cert: "issuer-example-college", class: "EAA" });
    expect(b.issuer!.issuer_url).toBeUndefined(); // barındırılan adresi operatör atar
    expect(b.rp).toMatchObject({ dns_name: "tamga.example.edu.tr", access_cert: "rp-issuer-example-college" });
    expect(b.rp!.scopes[0]).toMatchObject({
      scope_id: "example-college-identity-matching-1",
      claims: ["personal_administrative_number", "birthdate"],
    });
    expect(b.profile!.keys.map((k) => k.name)).toEqual(["issuer-example-college", "issuer-example-college-status"]);
    expect(b.profile!.operator_keys).toEqual(["rp-issuer-example-college"]);
    expect(b.issuer!.supervisory_authority.name).toMatch(/KVKK/);
    expect(validateProfile(b.profile!)).toEqual([]);
  });
  it("kendi servisi: issuer_url + status_list_base zorunlu, kimlik eşleştirme kaydı yok", () => {
    expect(buildApplications(answers({ hosting: "own" })).problems.join()).toMatch(/issuer_url ve status_list_base/);
    const b = buildApplications(
      answers({
        hosting: "own",
        issuer_url: "https://issuer.example.edu.tr",
        status_list_base: "https://status.example.edu.tr/",
        identity_matching: undefined,
      }),
    );
    expect(b.problems).toEqual([]);
    expect(b.rp).toBeUndefined();
  });
  it("doğrulayıcı: tek erişim anahtarı", () => {
    const b = buildApplications(
      answers({
        role: "verifier",
        slug: "example-hotel",
        legal_name: "Example Hotel",
        domain: "hotel.example.com",
        contact: { support_uri: "https://hotel.example.com/help" },
        vcts: undefined,
        identity_matching: undefined,
        lookup_url: undefined,
        isced_f_codes: undefined,
        service_description: { "en-US": "Hotel check-in", "tr-TR": "Otel girişi" },
        is_public_sector_body: false,
        scopes: [
          {
            scope_id: "age-check-1",
            purpose: "Age check",
            vct: "urn:tamga:id:IdentityAttestation:1",
            claims: ["age_over_18"],
            privacy_policy_uri: "https://hotel.example.com/privacy",
          },
        ],
      }),
    );
    expect(b.problems).toEqual([]);
    expect(b.profile!.keys).toEqual([{ name: "rp-example-hotel", purpose: "access" }]);
  });
  it("kişi bilgisi alanı, bozuk ISCED-F, yakılmış alan adı reddedilir", () => {
    const withName = { ...answers(), signatory: "Ad Soyad" } as unknown as Answers;
    expect(buildApplications(withName).problems.join()).toMatch(/bilinmeyen alan: signatory/);
    expect(buildApplications(answers({ isced_f_codes: ["613"] })).problems.join()).toMatch(/ISCED-F/);
    const burned = answers({
      identity_matching: { dns_name: "issuer.tamga.network", privacy_policy_uri: "https://x.tr/p" },
    });
    expect(buildApplications(burned).problems.join()).toMatch(/kendi alan adı/);
  });
});

describe("keys — anahtar ve CSR", () => {
  const b = buildApplications(answers());
  const apps = { issuer: b.issuer, rp: b.rp };
  it("CSR konusu ADR-0050 alanlarını taşır; denetim geçer; yanlış kurum no yakalanır", async () => {
    const [e] = csrExpectations(b.profile!.keys, apps);
    const g = await generateKeyAndCsr(e);
    expect(g.subject).toContain("2.5.4.97=VATTR-1234567890");
    expect((await inspectCsr(g.csrPem, e)).problems).toEqual([]);
    expect((await inspectCsr(g.csrPem, { ...e, orgId: "VATTR-9999999999" })).problems.join()).toMatch(
      /organizationIdentifier/,
    );
    expect(await csrSpkiSha256(g.csrPem)).toBe(g.spkiSha256);
    expect(privateKeySpkiSha256(g.privateKeyPem)).toBe(g.spkiSha256);
  });
  it("erişim CSR'ında SAN: alan adı + destek adresi (ADR-0058 AC1)", async () => {
    const v = buildApplications(
      answers({
        role: "verifier",
        slug: "example-shop",
        domain: "shop.example.com",
        contact: { support_uri: "https://shop.example.com/help" },
        vcts: undefined,
        identity_matching: undefined,
        lookup_url: undefined,
        isced_f_codes: undefined,
        service_description: { "en-US": "Shop" },
        is_public_sector_body: false,
        scopes: [
          {
            scope_id: "student-discount-1",
            purpose: "Student discount",
            vct: "urn:tamga:edu:StudentCredential:1",
            claims: ["is_enrolled"],
            privacy_policy_uri: "https://shop.example.com/privacy",
          },
        ],
      }),
    );
    const [e] = csrExpectations(v.profile!.keys, { rp: v.rp });
    const g = await generateKeyAndCsr(e);
    expect((await inspectCsr(g.csrPem, e)).problems).toEqual([]);
    expect((await inspectCsr(g.csrPem, { ...e, dns: "other.example.com" })).problems.join()).toMatch(/SAN/);
  });
  it("parolalı anahtar yalnız parolayla açılır", async () => {
    const [e] = csrExpectations(b.profile!.keys, apps);
    const g = await generateKeyAndCsr(e, { passphrase: "örnek-parola" });
    expect(g.privateKeyPem).toContain("ENCRYPTED PRIVATE KEY");
    expect(() => privateKeySpkiSha256(g.privateKeyPem)).toThrow();
    expect(privateKeySpkiSha256(g.privateKeyPem, "örnek-parola")).toBe(g.spkiSha256);
  });
  it("klasöre yazar, .gitignore koyar, ikinci kez üzerine yazmaz", async () => {
    const dir = join(tmp, "keys-dir");
    mkdirSync(dir);
    const r = await generateKeys(dir, b.profile!, apps);
    expect(r.written.map((w) => w.name)).toEqual(["issuer-example-college", "issuer-example-college-status"]);
    expect(readFileSync(join(dir, "keys", ".gitignore"), "utf8")).toContain("*.key.pem");
    await expect(generateKeys(dir, b.profile!, apps)).rejects.toThrow(/üzerine yazılmaz/);
  });
});

/** Sahte HTTP: adres → yanıt. */
const fakeHttp =
  (routes: Record<string, (init?: Parameters<Http>[1]) => { status: number; text?: string; ct?: string }>): Http =>
  async (url, init) => {
    const r = routes[url]?.(init) ?? { status: 404 };
    return { status: r.status, text: r.text ?? "", contentType: r.ct ?? "application/json" };
  };
const dns = (txt: string[][] = []): Dns => ({ lookup: async () => ["192.0.2.1"], resolveTxt: async () => txt });

describe("check — kurulum (yalnız okur)", () => {
  const dir = join(tmp, "inst");
  const b = buildApplications(answers());
  mkdirSync(dir);
  writeFileSync(join(dir, "onboarding.json"), JSON.stringify({ ...b.profile, dns_txt: "tamga-verify=abc" }));
  writeFileSync(join(dir, "example-college.issuer.json"), JSON.stringify(b.issuer));
  writeFileSync(join(dir, "example-college.rp.json"), JSON.stringify(b.rp));
  const page = () => ({ status: 200, text: "ok", ct: "text/html" });
  const base = {
    "https://example.edu.tr/support": page,
    "https://example.edu.tr/privacy": page,
  };

  it("sorgu ucu imzasız isteği reddediyorsa geçer; anahtar yoksa K1 kalır; TXT teyidi", async () => {
    const http = fakeHttp({
      ...base,
      "https://sis.example.edu.tr/tamga/lookup": (i) =>
        i?.method === "POST" ? { status: i.body === "{}" ? 400 : 401 } : { status: 405 },
    });
    const rows = await installationChecks({ dir }, { http, dns: dns([["tamga-verify=abc"]]) });
    const by = (id: string) => rows.filter((r) => r.id === id);
    expect(by("A1")[0].result).toBe("pass");
    expect(by("A2")[0].result).toBe("pass");
    expect(by("K1").every((r) => r.result === "fail")).toBe(true); // keys çalıştırılmadı
    expect(by("N1")[0].result).toBe("pass");
    expect(by("N2")[0].result).toBe("pass");
    expect(by("U1")[0].result).toBe("pass");
    expect(by("Q1")[0].result).toBe("pass");
  });
  it("imzasız isteğe 2xx dönen sorgu ucu KALIR; TXT yoksa KALIR", async () => {
    const http = fakeHttp({ ...base, "https://sis.example.edu.tr/tamga/lookup": () => ({ status: 200, text: "{}" }) });
    const rows = await installationChecks({ dir }, { http, dns: dns([["başka"]]) });
    expect(rows.find((r) => r.id === "Q1")!.result).toBe("fail");
    expect(rows.find((r) => r.id === "N2")!.result).toBe("fail");
  });
  it("keys sonrası anahtar ↔ CSR eşleşir; çevrimdışı ağ denetimi yok", async () => {
    await generateKeys(dir, b.profile!, { issuer: b.issuer, rp: b.rp });
    const rows = await installationChecks({ dir, offline: true }, { http: fakeHttp({}) });
    const k1 = rows.filter((r) => r.id === "K1");
    expect(k1).toHaveLength(2);
    expect(k1.every((r) => r.result !== "fail")).toBe(true);
    expect(rows.some((r) => r.id === "N1" || r.id === "Q1")).toBe(false);
  });
  it("CSR başka anahtarın ise kalır", async () => {
    const other = await generateKeyAndCsr(csrExpectations(b.profile!.keys, { issuer: b.issuer })[1]);
    writeFileSync(join(dir, "keys", "issuer-example-college.csr.pem"), other.csrPem);
    const rows = await installationChecks({ dir, offline: true }, { http: fakeHttp({}) });
    expect(rows.find((r) => r.check.startsWith("issuer-example-college:"))!.detail).toMatch(/bu özel anahtarın değil/);
  });
});

const ROOT = resolve(import.meta.dirname, "../../..");
const DIST = resolve(ROOT, "apps/trust-publisher/dist-test");
const ready = existsSync(resolve(DIST, "lotl.jws"));

describe.skipIf(!ready)("check — liste (test listesi)", () => {
  const TRUST = "https://trust.test";
  const pins = () =>
    (
      JSON.parse(readFileSync(resolve(DIST, "keys/root-fingerprints.json"), "utf8")) as {
        lotl_signing_keys: Array<{ fingerprint_sha256: string }>;
      }
    ).lotl_signing_keys.map((k) => k.fingerprint_sha256);
  const http: Http = async (url) => {
    const p = url.startsWith(TRUST) ? resolve(DIST, url.slice(TRUST.length + 1)) : "";
    return p && existsSync(p)
      ? { status: 200, text: readFileSync(p, "utf8"), contentType: "application/jwt" }
      : { status: 404, text: "", contentType: "" };
  };
  const o = { environment: "production" as const, trustBase: TRUST, anchorMaxAgeHours: 1e6, services: false };

  it("listedeki kurum: imza + pin, ACTIVE, yetkiler", async () => {
    const rows = await listingChecks(http, {
      ...o,
      pins: pins(),
      slug: "example-university",
      expectVcts: ["urn:tamga:edu:DiplomaCredential:1"],
    });
    expect(rows.find((r) => r.id === "L1")!.result).not.toBe("fail");
    expect(rows.find((r) => r.id === "L2")!.result).toBe("pass");
    expect(rows.find((r) => r.id === "L4")!.result).toBe("pass");
  });
  it("listede olmayan kurum KALIR; yanlış pin listeyi reddeder (gömülü gerçek ağ pini test listesini kabul etmez)", async () => {
    const missing = await listingChecks(http, { ...o, pins: pins(), slug: "example-college" });
    expect(missing.find((r) => r.id === "L2")!.result).toBe("fail");
    const wrongPin = await listingChecks(http, { ...o, slug: "example-university" });
    expect(wrongPin).toHaveLength(1);
    expect(wrongPin[0]).toMatchObject({ id: "L1", result: "fail" });
  });
});

describe("meta veri zinciri", () => {
  it("JWT olmayan ve x5c'siz girdiyi reddeder", () => {
    expect(checkMetadataChain("abc", "00", undefined).ok).toBe(false);
    const noX5c = `${Buffer.from('{"alg":"ES256"}').toString("base64url")}.e30.AA`;
    expect(checkMetadataChain(noX5c, "00", undefined).detail).toBe("x5c yok");
  });
});

describe("sandbox", () => {
  it("makine arayüzü yok: adres ve adımlar", () => {
    const g = sandboxGuide();
    expect(g.url).toBe("https://sandbox.tamga.network/institutions/new");
    expect(g.steps.length).toBeGreaterThan(3);
  });
});

describe("MCP sunucusu", () => {
  const root = join(tmp, "mcp-root");
  mkdirSync(root);
  const connect = async () => {
    const server = createServer({ root, http: fakeHttp({}), dns: dns(), env: { ONBOARD_PASS: "örnek" } });
    const client = new Client({ name: "test", version: "1" });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(a), client.connect(b)]);
    return client;
  };
  const call = async (client: Client, name: string, args: Record<string, unknown>) => {
    const r = (await client.callTool({ name, arguments: args })) as {
      isError?: boolean;
      content: Array<{ text: string }>;
    };
    return { isError: !!r.isError, text: r.content[0].text };
  };

  it("araçlar listelenir", async () => {
    const c = await connect();
    const { tools } = await c.listTools();
    expect(tools.map((t) => t.name)).toEqual(TOOLS.map((t) => t.name));
    expect(tools.map((t) => t.name)).toEqual(
      expect.arrayContaining(["validate_application", "generate_keys_and_csr", "check_installation", "check_listing"]),
    );
  });
  it("başvuru → anahtar: özel anahtar içeriği yanıtta yok; kök dışı yol reddedilir", async () => {
    const c = await connect();
    const created = await call(c, "create_application", { answers: answers(), out_dir: "college" });
    expect(created.isError).toBe(false);
    expect(JSON.parse(created.text).written).toBe(true);
    const keys = await call(c, "generate_keys_and_csr", { dir: "college", passphrase_env: "ONBOARD_PASS" });
    expect(keys.isError).toBe(false);
    expect(keys.text).not.toMatch(/PRIVATE KEY/);
    expect(JSON.parse(keys.text).keys).toHaveLength(2);
    expect(readFileSync(join(root, "college", "keys", "issuer-example-college.key.pem"), "utf8")).toContain(
      "ENCRYPTED PRIVATE KEY",
    );
    const outside = await call(c, "check_installation", { dir: "../.." });
    expect(outside).toMatchObject({ isError: true, text: "path is outside the server root" });
    const inst = await call(c, "check_installation", { dir: "college", offline: true, passphrase_env: "ONBOARD_PASS" });
    const body = JSON.parse(inst.text);
    expect(body.untrusted_data_notice).toMatch(/untrusted/);
    expect(body.rows.filter((r: { id: string }) => r.id === "K1")).toHaveLength(2);
  });
  it("validate_application ve hatalı girdi", async () => {
    const c = await connect();
    const v = await call(c, "validate_application", { application: { slug: "x" } });
    expect(JSON.parse(v.text).problems.length).toBeGreaterThan(0);
    expect((await call(c, "check_listing", {})).isError).toBe(true);
    expect((await call(c, "nope", {})).isError).toBe(true);
  });
});

const PKI = resolve(ROOT, "ops/pki");
describe.skipIf(!existsSync(resolve(PKI, "root-ca.pkcs8.pem")))(
  "operatör uyumu — pki-issue aracın CSR'ını kabul eder",
  () => {
    const run = async (args: string[]) => {
      const { spawnSync } = await import("node:child_process");
      const r = spawnSync(
        process.execPath,
        [resolve(ROOT, "node_modules/tsx/dist/cli.mjs"), "ops/pki-issue.ts", ...args],
        {
          cwd: ROOT,
          encoding: "utf8",
        },
      );
      return { status: r.status, out: `${r.stdout}${r.stderr}` };
    };
    it("--prod: CSR konusundaki kurum no ile verilir; aynı --org-id kabul, farklısı ret (ADR-0050)", async () => {
      const pki = join(tmp, "pki");
      mkdirSync(pki);
      for (const f of ["root-ca.cert.pem", "root-ca.pkcs8.pem"])
        writeFileSync(join(pki, f), readFileSync(resolve(PKI, f)));
      const b = buildApplications(answers());
      const [e, s] = csrExpectations(b.profile!.keys, { issuer: b.issuer });
      const csr1 = join(tmp, "c1.csr.pem");
      const csr2 = join(tmp, "c2.csr.pem");
      writeFileSync(csr1, (await generateKeyAndCsr(e)).csrPem);
      writeFileSync(csr2, (await generateKeyAndCsr(s)).csrPem);
      const ok = await run(["--prod", "--pki-dir", pki, "--name", e.name, "--csr", csr1]);
      expect(ok.status, ok.out).toBe(0);
      expect(ok.out).toContain("2.5.4.97=VATTR-1234567890");
      const same = await run([
        "--prod",
        "--pki-dir",
        pki,
        "--name",
        s.name,
        "--csr",
        csr2,
        "--org-id",
        "VATTR-1234567890",
      ]);
      expect(same.status, same.out).toBe(0);
      const diff = await run([
        "--prod",
        "--pki-dir",
        pki,
        "--name",
        "issuer-x-y",
        "--csr",
        csr2,
        "--org-id",
        "VATTR-9999999999",
      ]);
      expect(diff.status).toBe(2);
      expect(diff.out).toMatch(/aynı değil/);
    }, 60_000);
  },
);
