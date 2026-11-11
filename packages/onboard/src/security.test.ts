/**
 * Katılım aracı — 2026-11-04 ikinci güvenlik turu: yol sınırı ve bağlar (O3/D1/D2), yerel ağa istek (O4), özel anahtar dosyası
 * (O6: Windows izni, bulut eşitleme klasörü, parolasız üretim), MCP parola değişkeni (D3), pin (D4), kayıt sertifikası imzası (D5).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer as createHttpServer, type Server as HttpServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { webcrypto } from "node:crypto";
import * as x509 from "@peculiar/x509";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  buildApplications,
  defaultHttp,
  generateKeys,
  icaclsPath,
  installationChecks,
  isPrivateAddress,
  privateKeyPermissionOk,
  readOnboardingDir,
  syncedFolder,
  verifyRegistrationCert,
  writePrivateKey,
  writeReport,
  type Answers,
  type Http,
} from "./index.js";
import { createServer } from "./mcp.js";

const tmp = mkdtempSync(join(tmpdir(), "tamga-onboard-sec-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const answers: Answers = {
  role: "issuer",
  slug: "example-college",
  legal_name: "Example College",
  identifier: { scheme: "TR-VKN", value: "TR1234567890" },
  postal_address: { street_address: "Example Street 1", locality: "Istanbul", country: "TR" },
  contact: { support_uri: "https://example.edu.tr/support", email: "info@example.edu.tr" },
  domain: "example.edu.tr",
  vcts: ["urn:tamga:edu:StudentCredential:1"],
  identity_matching: { privacy_policy_uri: "https://example.edu.tr/privacy" },
  lookup_url: "https://sis.example.edu.tr/tamga/lookup",
  isced_f_codes: ["0613"],
};
const b = buildApplications(answers);
const apps = { issuer: b.issuer, rp: b.rp };

/** Katılım klasörü yazar (profil isteğe göre değiştirilir). */
const onboardingDir = (name: string, profile: Record<string, unknown> = b.profile as never) => {
  const dir = join(tmp, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "onboarding.json"), JSON.stringify(profile));
  writeFileSync(join(dir, "example-college.issuer.json"), JSON.stringify(b.issuer));
  writeFileSync(join(dir, "example-college.rp.json"), JSON.stringify(b.rp));
  return dir;
};
/** Klasör bağı (Windows: junction — yönetici izni gerekmez). Kurulamazsa false (test atlanır). */
const link = (target: string, path: string) => {
  try {
    symlinkSync(target, path, process.platform === "win32" ? "junction" : "dir");
    return true;
  } catch {
    return false;
  }
};

describe("O3/D1: katılım klasörü — profil denetimi ve dosya adları", () => {
  it("başvuru dosyası adında yol → durur; bozuk profil → durur", () => {
    const evil = onboardingDir("traversal", {
      ...b.profile,
      applications: { issuer: "../../outside.issuer.json" },
    });
    expect(() => readOnboardingDir(evil)).toThrow(/onboarding.json geçersiz: .*başvuru dosyası adı/);
    const badKey = onboardingDir("bad-key", { ...b.profile, keys: [{ name: "../x", purpose: "credential" }] });
    expect(() => readOnboardingDir(badKey)).toThrow(/anahtar adı/);
    const notJson = join(tmp, "not-json");
    mkdirSync(notJson);
    writeFileSync(join(notJson, "onboarding.json"), "{gizli");
    expect(() => readOnboardingDir(notJson)).toThrow("onboarding.json okunamadı (JSON değil)");
    expect(readOnboardingDir(onboardingDir("ok")).issuer?.slug).toBe("example-college");
  });

  it("D2: keys klasörü dışarıyı gösteren bağ (junction/symlink) ise anahtar yazılmaz", async (ctx) => {
    const outside = join(tmp, "outside-keys");
    mkdirSync(outside);
    const dir = onboardingDir("linked");
    if (!link(outside, join(dir, "keys"))) return ctx.skip();
    await expect(generateKeys(dir, b.profile!, apps, { noPassphrase: true })).rejects.toThrow(/dışında/);
    expect(() =>
      installationChecks({ dir, offline: true }, { http: async () => ({ status: 404, text: "", contentType: "" }) }),
    ).rejects.toThrow(/dışında/);
  });
});

describe("O4: yerel ağa istek yok", () => {
  it("özel / loopback / bağlantı-yerel / CGNAT / ULA adresleri", () => {
    for (const ip of ["10.1.2.3", "127.0.0.1", "169.254.169.254", "100.64.0.1", "192.168.1.1", "172.20.0.1", "0.0.0.0"])
      expect(isPrivateAddress(ip), ip).toBe(true);
    for (const ip of ["::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:a00:1", "::"])
      expect(isPrivateAddress(ip), ip).toBe(true);
    for (const ip of ["8.8.8.8", "93.184.215.14", "2606:4700::1111"]) expect(isPrivateAddress(ip), ip).toBe(false);
  });

  let server: HttpServer;
  let port = 0;
  beforeAll(async () => {
    server = createHttpServer((req, res) => {
      if (req.url === "/r") return res.writeHead(302, { location: "/ok" }).end();
      if (req.url === "/loop") return res.writeHead(302, { location: "/loop" }).end();
      if (req.url === "/file") return res.writeHead(302, { location: "file:///etc/passwd" }).end();
      res.writeHead(200, { "content-type": "text/plain" }).end("ok");
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    port = (server.address() as { port: number }).port;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it("https dışı ve yerel adres reddedilir; alan adı çözümü yerel ağa çıkarsa bağlantı kurulmaz", async () => {
    await expect(defaultHttp()("http://example.com/")).rejects.toThrow(/yalnız https/);
    await expect(defaultHttp({ allowHttp: true })(`http://127.0.0.1:${port}/`)).rejects.toThrow(/yerel/);
    await expect(defaultHttp({ allowHttp: true })(`http://localhost:${port}/`)).rejects.toThrow(/yerel/);
    const rebinding = defaultHttp({ allowHttp: true, resolveAll: async () => [{ address: "10.0.0.5", family: 4 }] });
    await expect(rebinding(`http://intranet.example:${port}/`)).rejects.toThrow(/yerel \/ özel ağ adresi okunmaz/);
  });

  it("yönlendirmeler elle izlenir: her adımda şema denetimi, en çok 5", async () => {
    const http: Http = defaultHttp({ allowHttp: true, allowPrivate: true });
    expect((await http(`http://127.0.0.1:${port}/r`)).text).toBe("ok");
    await expect(http(`http://127.0.0.1:${port}/loop`)).rejects.toThrow(/çok fazla yönlendirme/);
    await expect(http(`http://127.0.0.1:${port}/file`)).rejects.toThrow(/yalnız https/);
  });

  it("MCP: dosyalardaki istek adresi kurumun alan adı dışındaysa uyarı (S1)", async () => {
    const issuer = { ...b.issuer, contact: { support_uri: "https://evil.example.net/x" } };
    const rows = await installationChecks(
      { profile: b.profile, issuer, rp: b.rp, offline: true, warnOffDomain: true },
      { http: async () => ({ status: 404, text: "", contentType: "" }) },
    );
    expect(rows.find((r) => r.id === "S1")).toMatchObject({ result: "warn", detail: expect.stringMatching(/evil/) });
    const plain = await installationChecks(
      { profile: b.profile, issuer: b.issuer, rp: b.rp, offline: true, warnOffDomain: true },
      { http: async () => ({ status: 404, text: "", contentType: "" }) },
    );
    expect(plain.some((r) => r.id === "S1")).toBe(false);
  });
});

describe("O6: özel anahtar dosyası", () => {
  it("bulut eşitleme klasörü tanınır; açık onaysız anahtar yazılmaz", async () => {
    const od = join(tmp, "OneDriveSim");
    expect(syncedFolder(join(od, "a", "keys"), { OneDrive: od })).toBe(od);
    expect(syncedFolder("/home/u/Dropbox/tamga/keys", {})).toBe("Dropbox");
    expect(syncedFolder(join(tmp, "plain", "keys"), {})).toBeNull();
    const dir = join(od, "college");
    mkdirSync(dir, { recursive: true });
    const env = { OneDrive: od };
    await expect(generateKeys(dir, b.profile!, apps, { noPassphrase: true, env })).rejects.toThrow(/eşitleme/);
    const r = await generateKeys(dir, b.profile!, apps, { noPassphrase: true, env, allowSynced: true });
    expect(r.warnings.join()).toMatch(/eşitleme/);
  });

  it("Windows'ta parolasız üretim varsayılan değil; parola en az 12 karakter", async () => {
    const dir = join(tmp, "win-pass");
    mkdirSync(dir);
    await expect(generateKeys(dir, b.profile!, apps, { platform: "win32" })).rejects.toThrow(/parolasız/);
    await expect(generateKeys(dir, b.profile!, apps, { passphrase: "kısa" })).rejects.toThrow(/12 karakter/);
  });

  it("icacls tam yoluyla çağrılır (PATH / çalışma klasöründeki sahte icacls.exe çalışmaz)", () => {
    const norm = (p: string) => p.replaceAll("\\", "/");
    expect(norm(icaclsPath({ SystemRoot: "D:/WinNT" }))).toBe("D:/WinNT/System32/icacls.exe");
    expect(norm(icaclsPath({ windir: "C:/Windows" }))).toBe("C:/Windows/System32/icacls.exe");
    expect(norm(icaclsPath({}))).toBe("C:/Windows/System32/icacls.exe");
    expect(icaclsPath({ SystemRoot: "D:/WinNT", PATH: "C:/evil" })).not.toMatch(/evil/);
  });

  it("--report: var olan dosyanın üzerine yazılmaz; anahtar / sertifika gibi görünen hedef reddedilir", () => {
    const dir = join(tmp, "report");
    mkdirSync(dir);
    const ok = join(dir, "check-report.json");
    writeReport(ok, { rows: [] });
    expect(JSON.parse(readFileSync(ok, "utf8"))).toEqual({ rows: [] });
    expect(() => writeReport(ok, { rows: [1] })).toThrow(/zaten var/);
    expect(JSON.parse(readFileSync(ok, "utf8"))).toEqual({ rows: [] });
    // yanlış yazılmış yol özel anahtarı ezmesin: var olan anahtar dosyası (wx) ve anahtar adı taşıyan yeni hedefler
    const key = join(dir, "issuer-x.key.pem");
    writeFileSync(key, "KEY");
    for (const bad of [key, join(dir, "issuer-x.csr.pem"), join(dir, "rapor.txt"), join(dir, "rapor")])
      expect(() => writeReport(bad, {}), bad).toThrow(/\.json uzantılı/);
    for (const bad of ["issuer-x.key.json", "issuer-x.pem.json", "node-key.json", "key.json"])
      expect(() => writeReport(join(dir, bad), {}), bad).toThrow(/anahtar/);
    expect(readFileSync(key, "utf8")).toBe("KEY");
  });

  it.runIf(process.platform === "win32")("Windows: dosya önce boş açılır, izin daraltılır, sonra yazılır", () => {
    const p = join(tmp, "win-key.key.pem");
    writePrivateKey(p, "-----BEGIN PRIVATE KEY-----\nAA\n-----END PRIVATE KEY-----\n");
    expect(privateKeyPermissionOk(p)).toBe(true);
    expect(() => writePrivateKey(p, "x")).toThrow(); // üzerine yazılmaz
  });
});

describe("MCP: parola değişkeni (D3), pin (D4), validate_application (D1), bağlar (D2)", () => {
  const root = join(tmp, "mcp-sec");
  mkdirSync(root);
  const connect = async () => {
    const server = createServer({
      root,
      http: async () => ({ status: 404, text: "", contentType: "" }),
      env: { TAMGA_SHORT: "kısa", AWS_SECRET: "çok-gizli-değer-1234", TAMGA_OK_PASS: "yeterince-uzun-parola" },
    });
    const client = new Client({ name: "test", version: "1" });
    const [a, c] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(a), client.connect(c)]);
    return client;
  };
  const call = async (client: Client, name: string, args: Record<string, unknown>) => {
    const r = (await client.callTool({ name, arguments: args })) as {
      isError?: boolean;
      content: Array<{ text: string }>;
    };
    return { isError: !!r.isError, text: r.content[0].text };
  };

  it("passphrase_env yalnız TAMGA_ önekli ve en az 12 karakter", async () => {
    const c = await connect();
    await call(c, "create_application", { answers, out_dir: "college" });
    expect(await call(c, "generate_keys_and_csr", { dir: "college", passphrase_env: "AWS_SECRET" })).toMatchObject({
      isError: true,
      text: expect.stringMatching(/TAMGA_/),
    });
    expect(await call(c, "generate_keys_and_csr", { dir: "college", passphrase_env: "TAMGA_SHORT" })).toMatchObject({
      isError: true,
      text: expect.stringMatching(/12/),
    });
    expect((await call(c, "generate_keys_and_csr", { dir: "college", passphrase_env: "TAMGA_OK_PASS" })).isError).toBe(
      false,
    );
  });

  it("pin MCP'den değiştirilemez", async () => {
    const c = await connect();
    const r = await call(c, "check_listing", { slug: "x-y-z", pins: ["0".repeat(64)] });
    expect(r).toMatchObject({ isError: true, text: expect.stringMatching(/pins cannot be overridden/) });
  });

  it("validate_application: yalnız *.json; bozuk JSON içeriği yanıta girmez", async () => {
    const c = await connect();
    writeFileSync(join(root, "secret.txt"), "{}");
    writeFileSync(join(root, "broken.json"), '{"gizli-icerik": ');
    expect(await call(c, "validate_application", { path: "secret.txt" })).toMatchObject({
      isError: true,
      text: "path: only *.json files",
    });
    const broken = await call(c, "validate_application", { path: "broken.json" });
    expect(broken).toMatchObject({ isError: true, text: "path: not a readable JSON file" });
    expect(broken.text).not.toMatch(/gizli/);
  });

  it("kök içindeki bağ (junction/symlink) dışarıyı gösteriyorsa reddedilir", async (ctx) => {
    const outside = join(tmp, "mcp-outside");
    mkdirSync(outside, { recursive: true });
    writeFileSync(join(outside, "x.json"), "{}");
    if (!link(outside, join(root, "escape"))) return ctx.skip();
    const c = await connect();
    expect(await call(c, "validate_application", { path: "escape/x.json" })).toMatchObject({
      isError: true,
      text: "path is outside the server root",
    });
  });
});

describe("D5: kayıt sertifikası imzası", () => {
  x509.cryptoProvider.set(webcrypto as unknown as Crypto);
  const subtle = webcrypto.subtle as unknown as SubtleCrypto;
  const alg = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;
  const make = async () => {
    const keys = (await subtle.generateKey(alg, true, ["sign", "verify"])) as CryptoKeyPair;
    const cert = await x509.X509CertificateGenerator.createSelfSigned({
      serialNumber: "01",
      name: "CN=Registrar",
      notBefore: new Date(Date.now() - 1000),
      notAfter: new Date(Date.now() + 86400_000),
      keys,
      signingAlgorithm: alg,
    });
    const fp = Buffer.from(await subtle.digest("SHA-256", cert.rawData)).toString("hex");
    const sign = async (payload: object, typ = "rc-wrp+jwt") => {
      const h = Buffer.from(
        JSON.stringify({ alg: "ES256", typ, x5c: [Buffer.from(cert.rawData).toString("base64")] }),
      ).toString("base64url");
      const p = Buffer.from(JSON.stringify(payload)).toString("base64url");
      const s = await subtle.sign(alg, keys.privateKey, Buffer.from(`${h}.${p}`));
      return `${h}.${p}.${Buffer.from(s).toString("base64url")}`;
    };
    return { fp, sign };
  };

  it("listedeki kayıt kurumunca imzalı ve süresi geçerliyse null; aksi hâlde neden", async () => {
    const reg = await make();
    const other = await make();
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const good = await reg.sign({ sub: "VATTR-1", exp });
    expect(verifyRegistrationCert(good, new Set([reg.fp]))).toBeNull();
    expect(verifyRegistrationCert(good, new Set([other.fp]))).toMatch(/kayıt kurumu değil/);
    const [h, , s] = good.split(".");
    const forged = `${h}.${Buffer.from(JSON.stringify({ sub: "VATTR-2", exp })).toString("base64url")}.${s}`;
    expect(verifyRegistrationCert(forged, new Set([reg.fp]))).toBe("imza geçersiz");
    expect(verifyRegistrationCert(await reg.sign({ exp: 1 }), new Set([reg.fp]))).toBe("süresi dolmuş");
    expect(verifyRegistrationCert(await reg.sign({ exp }, "jwt"), new Set([reg.fp]))).toMatch(/typ/);
    expect(verifyRegistrationCert("abc", new Set([reg.fp]))).toBe("JWT değil");
  });
});
