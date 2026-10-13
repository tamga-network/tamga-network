/**
 * Cüzdan sağlayıcı komutu (`wallet-provider`, ADR-0042) — kurulum günü W11'in elle JSON düzenlemesi yerine. Araç gerçek süreç
 * olarak geçici klasörde çalışır (gerçek registry/, ops/pki*, dist/ değişmez). Sertifikalar testte üretilir (geliştirme).
 * Kanıtlananlar: sertifika denetimi (P-256, ES256, digitalSignature, CA değil, süre, SB1 "(TEST)", özel anahtar yok), sandbox'a
 * gerçek sertifika ancak gerçek kayıttan sonra, --dry-run yazmaz, iki listede aynı sertifika ve ACTIVE, ikinci çalıştırma
 * değişiklik yapmaz, iki liste derlenince aynı parmak izi, askı/geri dönüş/geri çekme geçmişi (TL2).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { webcrypto, X509Certificate } from "node:crypto";
import {
  X509CertificateGenerator,
  cryptoProvider,
  KeyUsageFlags,
  KeyUsagesExtension,
  BasicConstraintsExtension,
} from "@peculiar/x509";
import { certFingerprintSha256Hex } from "@tamga-network/trust";
import {
  activateWalletProvider,
  inspectWalletProviderCert,
  lineDiff,
  setWalletProviderStatus,
  walletProviderCertName,
} from "../src/wallet-provider-ops.js";
import { RegistryError } from "../src/registry-ops.js";
import * as prettier from "prettier";

cryptoProvider.set(webcrypto as unknown as Crypto);
const subtle = (webcrypto as unknown as Crypto).subtle;

async function makeCert(
  o: {
    curve?: "P-256" | "P-384";
    subject?: string;
    days?: number;
    startDaysAgo?: number;
    ca?: boolean;
    usages?: number;
  } = {},
): Promise<{ pem: string; keyPem: string }> {
  const curve = o.curve ?? "P-256";
  const alg = { name: "ECDSA", namedCurve: curve, hash: curve === "P-256" ? "SHA-256" : "SHA-384" } as const;
  const kp = (await subtle.generateKey(alg, true, ["sign", "verify"])) as CryptoKeyPair;
  const now = Date.now();
  const start = now - (o.startDaysAgo ?? 0) * 86400_000 - 60_000;
  const cert = await X509CertificateGenerator.createSelfSigned({
    serialNumber: "01" + Math.floor(Math.random() * 1e9).toString(16),
    name: o.subject ?? "C=TR, O=Example Operator, CN=Tamga Wallet Provider (TAMGA-WP-1)",
    notBefore: new Date(start),
    notAfter: new Date(start + (o.days ?? 1095) * 86400_000),
    signingAlgorithm: alg,
    keys: kp,
    extensions: [
      new BasicConstraintsExtension(o.ca ?? false, undefined, true),
      new KeyUsagesExtension(o.usages ?? KeyUsageFlags.digitalSignature, true),
    ] as never,
  });
  const pk = Buffer.from(await subtle.exportKey("pkcs8", kp.privateKey)).toString("base64");
  return {
    pem: cert.toString("pem") + "\n",
    keyPem: `-----BEGIN PRIVATE KEY-----\n${pk.match(/.{1,64}/g)!.join("\n")}\n-----END PRIVATE KEY-----\n`,
  };
}
const fp = (pem: string) => certFingerprintSha256Hex(new Uint8Array(new X509Certificate(pem).raw));

describe("cüzdan sağlayıcı kayıt işlemleri (saf)", () => {
  const now = new Date();
  it("ad kuralı: wallet-provider-<provider_id küçük harf>", () => {
    expect(walletProviderCertName("TAMGA-WP-1")).toBe("wallet-provider-tamga-wp-1");
    expect(() => walletProviderCertName("../x")).toThrow(RegistryError);
  });
  it("geçerli P-256 imza sertifikası kabul; parmak izi hesaplanır", async () => {
    const c = await makeCert();
    const info = inspectWalletProviderCert(c.pem, { now, environment: "production" });
    expect(info.fingerprint).toBe(fp(c.pem));
    expect(info.selfSigned).toBe(true);
    expect(info.warnings).toEqual([]);
  });
  it("hatalı sertifikalar reddedilir (eğri, CA/keyCertSign, süre, digitalSignature yok, TEST gerçek ağa, özel anahtar)", async () => {
    const bad = async (
      c: Promise<{ pem: string; keyPem: string }>,
      re: RegExp,
      env: "production" | "sandbox" = "production",
    ) => {
      const { pem } = await c;
      let err: unknown;
      try {
        inspectWalletProviderCert(pem, { now, environment: env });
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(RegistryError);
      expect((err as RegistryError).problems.join("\n")).toMatch(re);
    };
    await bad(makeCert({ curve: "P-384" }), /P-256/);
    await bad(
      makeCert({ ca: true, usages: KeyUsageFlags.digitalSignature | KeyUsageFlags.keyCertSign }),
      /CA olmamalı[\s\S]*keyCertSign/,
    );
    await bad(makeCert({ startDaysAgo: 400, days: 30 }), /süresi dolmuş/);
    await bad(makeCert({ usages: KeyUsageFlags.keyAgreement }), /digitalSignature/);
    await bad(makeCert({ subject: "CN=Wallet Provider (TEST)" }), /SB1/);
    const c = await makeCert();
    expect(() => inspectWalletProviderCert(c.pem + c.keyPem, { now })).toThrow(/özel anahtar/);
    expect(() => inspectWalletProviderCert(c.pem + c.pem, { now })).toThrow(/tek bir PEM/);
    // sandbox'ta test sertifikası SB1'e takılmaz
    expect(() => inspectWalletProviderCert(c.pem, { now, environment: "sandbox" })).not.toThrow();
  });
  it("kısa ömürlü sertifika uyarı verir", async () => {
    const c = await makeCert({ days: 30 });
    expect(inspectWalletProviderCert(c.pem, { now }).warnings[0]).toMatch(/günü kaldı/);
  });
  it("etkinleştirme: RESERVED → ACTIVE, çözümler ACTIVE, geçmiş; ikinci kez değişiklik yok; başka sertifika ve geri çekilmiş kayıt red", () => {
    const src = {
      wallet_providers: [
        {
          provider_id: "WP-X",
          legal_name: "X Ltd",
          wua_signing_certs: [],
          solutions: [{ solution_id: "x", status: "RESERVED" }],
          status: "RESERVED",
        },
      ],
    };
    const o = { certName: "wallet-provider-wp-x", now, environment: "production" as const };
    const a = activateWalletProvider(src, "WP-X", o);
    expect(a.changed).toBe(true);
    const w = a.next.wallet_providers[0];
    expect(w).toMatchObject({ status: "ACTIVE", wua_signing_certs: ["wallet-provider-wp-x"] });
    expect(w.solutions[0].status).toBe("ACTIVE");
    expect(w.status_history).toHaveLength(1);
    expect(src.wallet_providers[0].status).toBe("RESERVED"); // kaynak değişmez
    expect(activateWalletProvider(a.next, "WP-X", o).changed).toBe(false);
    expect(() => activateWalletProvider(a.next, "WP-X", { ...o, certName: "wallet-provider-other" })).toThrow(
      /başka sertifika/,
    );
    const r = setWalletProviderStatus(a.next, "WP-X", "REVOKED", { now });
    expect(r.next.wallet_providers[0].status_history).toHaveLength(2);
    expect(() => activateWalletProvider(r.next, "WP-X", o)).toThrow(/REVOKED/);
    expect(() => setWalletProviderStatus(src, "WP-X", "SUSPENDED", { now })).toThrow(/yalnız ACTIVE/);
  });
  it("satır farkı yalnız değişen satırları işaretler", () => {
    const d = lineDiff("a\nb\nc\nd\ne\nf\ng\n", "a\nb\nc\nX\ne\nf\ng\n", 1);
    expect(d.split("\n")).toEqual(["@@", "  c", "- d", "+ X", "  e"]);
  });
});

const ROOT = resolve(import.meta.dirname, "../../..");
const CLI = resolve(ROOT, "apps/trust-publisher/src/cli.ts");
const TSX = resolve(ROOT, "node_modules/tsx/dist/cli.mjs");
const ready =
  existsSync(resolve(ROOT, "ops/pki/tl-signer-1.pkcs8.pem")) &&
  existsSync(resolve(ROOT, "ops/pki-sandbox/tl-signer-1.pkcs8.pem")) &&
  existsSync(resolve(ROOT, "packages/schemas/dist/index.json"));

describe.skipIf(!ready)("wallet-provider komutu (geçici klasörde)", () => {
  const tmp = mkdtempSync(join(tmpdir(), "tamga-wp-"));
  const PROD_REG = join(tmp, "registry");
  const SB_REG = join(tmp, "registry-sandbox");
  const PROD_PKI = join(tmp, "pki-prod");
  const SB_PKI = join(tmp, "pki-sandbox");
  const CERT = join(tmp, "wp.cert.pem");
  const NAME = "wallet-provider-tamga-wp-1";
  let certPem = "";
  const baseEnv = () => {
    const env: Record<string, string | undefined> = { ...process.env };
    for (const k of ["TAMGA_PROD_PKI_DIR", "TAMGA_NETWORK", "TAMGA_SANDBOX_SELF_DIR", "TAMGA_TP_PROD_DIST"])
      delete env[k];
    return {
      ...env,
      TAMGA_TP_PROD_REGISTRY: PROD_REG,
      TAMGA_TP_SANDBOX_REGISTRY: SB_REG,
      TAMGA_TP_SANDBOX_PKI: SB_PKI,
      TAMGA_TP_REGISTRY: PROD_REG,
      TAMGA_TP_PKI: PROD_PKI,
      TAMGA_TP_DIST: join(tmp, "dist"),
    };
  };
  const run = (args: string[], extraEnv: Record<string, string> = {}) => {
    const r = spawnSync(process.execPath, [TSX, CLI, ...args], {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...baseEnv(), ...extraEnv },
      timeout: 60_000,
    });
    return { code: r.status, out: r.stdout, err: r.stderr };
  };
  const wp = (args: string[]) => run(["wallet-provider", ...args, "--prod-pki", PROD_PKI]);
  const src = (reg: string) => readFileSync(join(reg, "lotl.source.json"), "utf8");
  const entry = (reg: string, id = "TAMGA-WP-1") =>
    JSON.parse(src(reg)).wallet_providers.find((w: { provider_id: string }) => w.provider_id === id);
  const snapshot = () => ({
    prod: src(PROD_REG),
    sb: src(SB_REG),
    certs: [join(PROD_PKI, `${NAME}.cert.pem`), join(SB_PKI, `${NAME}.cert.pem`)].map((f) =>
      existsSync(f) ? readFileSync(f, "utf8") : null,
    ),
  });

  beforeAll(async () => {
    cpSync(resolve(ROOT, "apps/trust-publisher/registry"), PROD_REG, { recursive: true });
    cpSync(resolve(ROOT, "apps/trust-publisher/registry-sandbox"), SB_REG, { recursive: true });
    // Kurulum günü düzeni: kopyalarda TAMGA-WP-1 RESERVED, sertifikasız ve geçmişsiz başlar — testler gerçek kayıt defterinin o
    // anki durumundan (2026-10-13'ten beri ACTIVE) bağımsız. Prettier biçimi korunur (dosya yalnız bu kayıtta değişir).
    for (const reg of [PROD_REG, SB_REG]) {
      const f = join(reg, "lotl.source.json");
      const j = JSON.parse(readFileSync(f, "utf8"));
      const w = j.wallet_providers.find((x: { provider_id: string }) => x.provider_id === "TAMGA-WP-1");
      w.wua_signing_certs = [];
      w.status = "RESERVED";
      for (const s of w.solutions) s.status = "RESERVED";
      delete w.status_history;
      const repoFile = resolve(ROOT, "apps/trust-publisher/registry/lotl.source.json"); // depodaki .prettierrc
      const opts = (await prettier.resolveConfig(repoFile)) ?? {};
      writeFileSync(f, await prettier.format(JSON.stringify(j), { ...opts, filepath: repoFile }));
    }
    cpSync(resolve(ROOT, "ops/pki"), PROD_PKI, { recursive: true });
    cpSync(resolve(ROOT, "ops/pki-sandbox"), SB_PKI, { recursive: true });
    rmSync(join(PROD_PKI, `${NAME}.cert.pem`), { force: true });
    rmSync(join(SB_PKI, `${NAME}.cert.pem`), { force: true });
    certPem = (await makeCert()).pem;
    writeFileSync(CERT, certPem);
  });
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it("başlangıç: TAMGA-WP-1 iki listede RESERVED (list)", () => {
    const r = wp(["list"]);
    expect(r.code, r.err).toBe(0);
    expect(r.out).toMatch(/TAMGA-WP-1\s+RESERVED/);
  });

  it("hatalı sertifika reddedilir, hiçbir dosya yazılmaz (çıkış 2)", async () => {
    const before = snapshot();
    const bad = join(tmp, "bad.cert.pem");
    writeFileSync(bad, (await makeCert({ curve: "P-384" })).pem);
    const r = wp(["activate", "--id", "TAMGA-WP-1", "--cert", bad]);
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/P-256/);
    writeFileSync(bad, (await makeCert({ subject: "CN=Wallet Provider (TEST)" })).pem);
    expect(wp(["activate", "--id", "TAMGA-WP-1", "--cert", bad]).err).toMatch(/SB1/);
    expect(snapshot()).toEqual(before);
  });

  it("gerçek ağın PKI klasörü verilmeden gerçek listeye yazılmaz", () => {
    const r = run(["wallet-provider", "activate", "--id", "TAMGA-WP-1", "--cert", CERT]);
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/PKI klasörü verilmedi/);
  });

  it("sandbox'a gerçek sertifika ancak gerçek kayıttan sonra (ADR-0042, SB1)", () => {
    const before = snapshot();
    const r = wp(["activate", "--id", "TAMGA-WP-1", "--cert", CERT, "--registry", "registry-sandbox"]);
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/önce --registry registry/);
    expect(snapshot()).toEqual(before);
  });

  it("--dry-run farkı basar, hiçbir dosya yazmaz", () => {
    const before = snapshot();
    const r = wp(["activate", "--id", "TAMGA-WP-1", "--cert", CERT, "--dry-run"]);
    expect(r.code, r.err).toBe(0);
    expect(r.out).toMatch(/^- +"status": "RESERVED",$/m);
    expect(r.out).toMatch(/^\+ +"wua_signing_certs": \["wallet-provider-tamga-wp-1"\],$/m);
    expect(r.out).toContain(`sertifika yazılacak: ${join(SB_PKI, `${NAME}.cert.pem`)}`);
    expect(r.out).toMatch(/hiçbir dosya yazılmadı/);
    expect(snapshot()).toEqual(before);
  });

  it("etkinleştirme: iki listede ACTIVE + aynı sertifika; sertifika iki PKI klasöründe; diğer kayıtlar aynı", () => {
    const sbTestBefore = entry(SB_REG, "TAMGA-SANDBOX-TEST-WP");
    const r = wp(["activate", "--id", "TAMGA-WP-1", "--cert", CERT]);
    expect(r.code, r.err).toBe(0);
    expect(r.out).toContain(fp(certPem));
    for (const reg of [PROD_REG, SB_REG]) {
      const w = entry(reg);
      expect(w.status).toBe("ACTIVE");
      expect(w.wua_signing_certs).toEqual([NAME]);
      expect(w.solutions.map((s: { status: string }) => s.status)).toEqual(["ACTIVE"]);
      expect(w.status_history).toEqual([
        expect.objectContaining({ status: "ACTIVE", reason: "signing-certificate-registered" }),
      ]);
      expect(w.legal_name).toBe("BROS İNŞAAT SANAYİ VE DIŞ TİCARET LİMİTED ŞİRKETİ");
    }
    expect(entry(SB_REG).note).toMatch(/same entry and certificate as in the production list/);
    expect(entry(SB_REG, "TAMGA-SANDBOX-TEST-WP")).toEqual(sbTestBefore);
    for (const d of [PROD_PKI, SB_PKI]) expect(fp(readFileSync(join(d, `${NAME}.cert.pem`), "utf8"))).toBe(fp(certPem));
    // depodaki biçim korunur (prettier): yalnız kayıt satırları değişir
    expect(src(PROD_REG)).toMatch(/"anchor_signing_certs": \["tl-signer-1"\]/);
  });

  it("ikinci çalıştırma değişiklik yapmaz (idempotent)", () => {
    const before = snapshot();
    const r = wp(["activate", "--id", "TAMGA-WP-1", "--cert", CERT]);
    expect(r.code, r.err).toBe(0);
    expect(r.out).toMatch(/değişiklik yok/);
    expect(snapshot()).toEqual(before);
  });

  it("aynı ada başka sertifika yazılmaz", async () => {
    const other = join(tmp, "other.cert.pem");
    writeFileSync(other, (await makeCert()).pem);
    const r = wp(["activate", "--id", "TAMGA-WP-1", "--cert", other, "--registry", "registry"]);
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/başka bir sertifika/);
  });

  it("iki liste derlenince (gerçek önce, sandbox sonra) TAMGA-WP-1 ACTIVE ve aynı parmak izi", () => {
    const prodDist = join(tmp, "dist-prod");
    const sbDist = join(tmp, "dist-sb");
    const b1 = run(["build"], { TAMGA_TP_DIST: prodDist });
    expect(b1.code, b1.err).toBe(0);
    const b2 = run(["build"], {
      TAMGA_NETWORK: "sandbox",
      TAMGA_TP_REGISTRY: SB_REG,
      TAMGA_TP_PKI: SB_PKI,
      TAMGA_TP_DIST: sbDist,
      TAMGA_TP_PROD_DIST: prodDist,
    });
    expect(b2.code, b2.err).toBe(0);
    for (const d of [prodDist, sbDist]) {
      const lotl = JSON.parse(readFileSync(join(d, "lotl.json"), "utf8"));
      const w = lotl.wallet_providers.find((x: { provider_id: string }) => x.provider_id === "TAMGA-WP-1");
      expect(w.status).toBe("ACTIVE");
      expect(w.wua_signing_keys.map((k: { fingerprint_sha256: string }) => k.fingerprint_sha256)).toEqual([
        fp(certPem),
      ]);
      expect(readFileSync(join(d, "keys", `${NAME}.cert.pem`), "utf8")).toContain("BEGIN CERTIFICATE");
      expect(readFileSync(join(d, "CHANGELOG.md"), "utf8")).toMatch(/wallet_providers=[^;]*TAMGA-WP-1[,;]/);
    }
  });

  it("askı → yeniden etkinleştirme → geri çekme; geçmiş korunur, geri çekilmiş kayıt etkinleşmez", () => {
    expect(wp(["suspend", "--id", "TAMGA-WP-1", "--reason", "key-review"]).code).toBe(0);
    expect(entry(PROD_REG).status).toBe("SUSPENDED");
    expect(entry(SB_REG).status).toBe("SUSPENDED");
    expect(wp(["suspend", "--id", "TAMGA-WP-1"]).out).toMatch(/değişiklik yok/);
    expect(wp(["activate", "--id", "TAMGA-WP-1", "--cert", CERT]).code).toBe(0);
    expect(entry(PROD_REG).status_history.map((h: { reason: string }) => h.reason)).toEqual([
      "signing-certificate-registered",
      "key-review",
      "reinstated",
    ]);
    const before = snapshot();
    expect(wp(["revoke", "--id", "TAMGA-WP-1", "--dry-run"]).out).toMatch(/^\+ +"status": "REVOKED",$/m);
    expect(snapshot()).toEqual(before);
    expect(wp(["revoke", "--id", "TAMGA-WP-1", "--registry", "registry-sandbox"]).code).toBe(0);
    expect(entry(SB_REG).status).toBe("REVOKED");
    expect(entry(PROD_REG).status).toBe("ACTIVE");
    const r = wp(["activate", "--id", "TAMGA-WP-1", "--cert", CERT, "--registry", "registry-sandbox"]);
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/REVOKED/);
  });

  it("show: kayıt ve sertifika özeti", () => {
    const r = wp(["show", "--id", "TAMGA-WP-1", "--registry", "registry"]);
    expect(r.code, r.err).toBe(0);
    expect(r.out).toContain(`SHA-256 ${fp(certPem)}`);
  });
});
