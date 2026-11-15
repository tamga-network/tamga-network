/**
 * ADR-0087 — erişim sertifikası iptal listesi (CRL): ayar denetimi, iptal planı (askı / iptal / sona erme / yenisiyle değişme,
 * AR3 tutarlılığı), CRL imzası ve profili (v2, AKI, CRLNumber, reasonCode, nextUpdate 24 saat), çevrim dışı kopya denetimi,
 * durum kurtarma; geçici klasörde uçtan uca `build` → `rp-status SUSPENDED` → `heartbeat` → `rp-status ACTIVE` (durur).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  AuthorityKeyIdentifierExtension,
  BasicConstraintsExtension,
  CRLDistributionPointsExtension,
  KeyUsageFlags,
  KeyUsagesExtension,
  SubjectAlternativeNameExtension,
  SubjectKeyIdentifierExtension,
  X509Certificate,
  X509CertificateGenerator,
  X509Crl,
  X509CrlReason,
  cryptoProvider,
} from "@peculiar/x509";
import {
  ACCESS_CRL_NEXT_UPDATE_SEC,
  accessCrlConfigProblems,
  crlNumberOf,
  crlProblems,
  emptyAccessCrlState,
  issuingCaOf,
  planAccessRevocations,
  reasonForRpStatus,
  recoverIssuerState,
  revokeAccessCert,
  signAccessCrl,
  type AccessCrlConfig,
  type RpAccessCertView,
} from "../src/access-crl.js";

cryptoProvider.set(webcrypto as unknown as Crypto);
const crypto = webcrypto as unknown as Crypto;
const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;
const ROOT = resolve(import.meta.dirname, "../../..");
const PKI = resolve(ROOT, "ops/pki");
const BASE = "https://trust.tamga.network";
const CFG: AccessCrlConfig = { issuers: [{ ca: "access-ca-1", uri: `${BASE}/crl/access-ca-1.crl` }] };
const t0 = new Date("2026-11-15T00:00:00Z");
const ready =
  existsSync(resolve(PKI, "access-ca-1.pkcs8.pem")) &&
  existsSync(resolve(PKI, "tl-signer-1.pkcs8.pem")) &&
  existsSync(resolve(ROOT, "packages/schemas/dist/index.json"));

const view = (dns: string, status: string, fp: string, serial = fp.slice(0, 8)): RpAccessCertView => ({
  dns_name: dns,
  status,
  serial,
  fingerprint_sha256: fp,
  not_after: "2028-01-01T00:00:00Z",
  ca: "access-ca-1",
});

describe("ADR-0087 ayar", () => {
  it("yol /crl/<ad>.crl, yayın kökünde; makam adı biçimi; yinelenen makam reddedilir", () => {
    expect(accessCrlConfigProblems(CFG, BASE)).toEqual([]);
    expect(accessCrlConfigProblems({ issuers: [] }, BASE).length).toBe(1);
    expect(
      accessCrlConfigProblems({ issuers: [{ ca: "access-ca-1", uri: "https://crl.tamga.network/crl/a.crl" }] }, BASE),
    ).toEqual([expect.stringMatching(/yayın kökünde/)]);
    expect(accessCrlConfigProblems({ issuers: [{ ca: "access-ca-1", uri: `${BASE}/status/a.crl` }] }, BASE)).toEqual([
      expect.stringMatching(/\/crl\/<ad>\.crl/),
    ]);
    expect(
      accessCrlConfigProblems({ issuers: [CFG.issuers[0], { ca: "access-ca-1", uri: `${BASE}/crl/b.crl` }] }, BASE),
    ).toEqual([expect.stringMatching(/iki kez/)]);
    expect(accessCrlConfigProblems({ issuers: [{ ca: "Root CA", uri: `${BASE}/crl/r.crl` }] }, BASE).length).toBe(1);
  });
});

describe("ADR-0087 iptal planı", () => {
  it("askı ve iptal → privilegeWithdrawn, sona erme → cessationOfOperation; certificateHold yok (K6)", () => {
    expect(reasonForRpStatus("ACTIVE")).toBeNull();
    expect(reasonForRpStatus("SUSPENDED")).toBe("privilege_withdrawn");
    expect(reasonForRpStatus("REVOKED")).toBe("privilege_withdrawn");
    expect(reasonForRpStatus("RETIRED")).toBe("cessation_of_operation");
    const a = planAccessRevocations(emptyAccessCrlState(), CFG, [view("a.example", "ACTIVE", "aa".repeat(32))], t0);
    expect(a.revoked).toEqual([]);
    expect(a.state.issuers[0].known).toHaveLength(1);
    const b = planAccessRevocations(a.state, CFG, [view("a.example", "SUSPENDED", "aa".repeat(32))], t0);
    expect(b.revoked.map((r) => r.reason)).toEqual(["privilege_withdrawn"]);
    expect(b.state.issuers[0].known).toEqual([]);
    // aynı yayın tekrarlanınca ikinci kez iptal edilmez
    expect(planAccessRevocations(b.state, CFG, [view("a.example", "SUSPENDED", "aa".repeat(32))], t0).revoked).toEqual(
      [],
    );
  });

  it("AR3: kayıt yeniden etkin ama sertifika iptal listesinde → sorun (yayın durur); yeni sertifikayla geçer", () => {
    const s = planAccessRevocations(
      emptyAccessCrlState(),
      CFG,
      [view("a.example", "REVOKED", "bb".repeat(32))],
      t0,
    ).state;
    const back = planAccessRevocations(s, CFG, [view("a.example", "ACTIVE", "bb".repeat(32))], t0);
    expect(back.problems).toEqual([expect.stringMatching(/^AR3: a\.example/)]);
    const renewed = planAccessRevocations(s, CFG, [view("a.example", "ACTIVE", "cc".repeat(32))], t0);
    expect(renewed.problems).toEqual([]);
    expect(renewed.state.issuers[0].revoked).toHaveLength(1); // eski iptal listeden çıkmaz
  });

  it("yenisiyle değişen sertifika → superseded; süresi dolmuş eski sertifika iptal edilmez; başka makamın sertifikası karışmaz", () => {
    const a = planAccessRevocations(
      emptyAccessCrlState(),
      CFG,
      [view("a.example", "ACTIVE", "dd".repeat(32)), { ...view("o.example", "SUSPENDED", "ee".repeat(32)), ca: null }],
      t0,
    );
    expect(a.revoked).toEqual([]); // başka makamın (kök) sertifikası bu CRL'e girmez
    const b = planAccessRevocations(a.state, CFG, [view("a.example", "ACTIVE", "ff".repeat(32))], t0);
    expect(b.revoked.map((r) => [r.fingerprint_sha256.slice(0, 2), r.reason])).toEqual([["dd", "superseded"]]);
    const expired = planAccessRevocations(
      a.state,
      CFG,
      [view("a.example", "ACTIVE", "ff".repeat(32))],
      new Date("2030-01-01"),
    );
    expect(expired.revoked).toEqual([]);
  });

  it("elle iptal: kapalı gerekçe kümesi, certificateHold kabul edilmez, iki kez iptal edilmez", () => {
    const s = planAccessRevocations(
      emptyAccessCrlState(),
      CFG,
      [view("a.example", "ACTIVE", "11".repeat(32))],
      t0,
    ).state;
    const k = s.issuers[0].known[0];
    expect(() => revokeAccessCert(s, "access-ca-1", k, "certificate_hold", t0)).toThrow(/certificateHold yok/);
    const r = revokeAccessCert(s, "access-ca-1", k, "key_compromise", t0);
    expect(r.entry.reason).toBe("key_compromise");
    expect(() => revokeAccessCert(r.state, "access-ca-1", k, "key_compromise", t0)).toThrow(/zaten iptal/);
  });
});

describe.skipIf(!ready)("ADR-0087 CRL imzası ve profili", () => {
  const caPem = () => readFileSync(resolve(PKI, "access-ca-1.cert.pem"), "utf8");
  const caKey = () => readFileSync(resolve(PKI, "access-ca-1.pkcs8.pem"), "utf8");
  const entry = {
    serial: "7a01",
    fingerprint_sha256: "aa".repeat(32),
    dns_name: "a.example",
    not_after: "2028-01-01T00:00:00Z",
    revoked_at: "2026-11-14T10:00:00.000Z",
    reason: "privilege_withdrawn" as const,
  };

  it("v2, düzenleyen = makamın konu adı (bayt bayt), AKI = makamın SKI'si, CRLNumber, reasonCode, nextUpdate 24 saat", async () => {
    const der = await signAccessCrl({ caCertPem: caPem(), caKeyPem: caKey(), entries: [entry], crlNumber: 7, now: t0 });
    const crl = new X509Crl(new Uint8Array(der));
    const ca = new X509Certificate(caPem());
    expect(crl.version).toBe(1); // v2
    expect(Buffer.from(crl.issuerName.toArrayBuffer()).equals(Buffer.from(ca.subjectName.toArrayBuffer()))).toBe(true);
    expect(await crl.verify({ publicKey: ca })).toBe(true);
    expect(crlNumberOf(crl)).toBe(7);
    const aki = crl.getExtension(AuthorityKeyIdentifierExtension)!;
    expect(aki.keyId).toBe(ca.getExtension(SubjectKeyIdentifierExtension)!.keyId);
    expect(crl.nextUpdate!.getTime() - crl.thisUpdate.getTime()).toBe(ACCESS_CRL_NEXT_UPDATE_SEC * 1000);
    const e = crl.findRevoked("7a01")!;
    expect(e.reason).toBe(X509CrlReason.privilegeWithdrawn);
    expect(e.revocationDate.toISOString()).toBe(entry.revoked_at);
    expect((await crlProblems(der, caPem(), ["7a01"], t0)).problems).toEqual([]);
  });

  it("denetim: başka makamın anahtarı, süresi dolmuş, eksik seri ve yaklaşan bitiş", async () => {
    const der = await signAccessCrl({ caCertPem: caPem(), caKeyPem: caKey(), entries: [entry], crlNumber: 1, now: t0 });
    const root = readFileSync(resolve(PKI, "root-ca.cert.pem"), "utf8");
    expect((await crlProblems(der, root, [], t0)).problems.join(" ")).toMatch(/konu adı değil.*imzası/s);
    expect((await crlProblems(der, caPem(), [], new Date("2026-11-17T00:00:00Z"))).problems).toEqual([
      expect.stringMatching(/süresi dolmuş/),
    ]);
    expect((await crlProblems(der, caPem(), ["beef"], t0)).problems).toEqual([expect.stringMatching(/seri yok: beef/)]);
    expect((await crlProblems(der, caPem(), [], t0)).warnings).toEqual([expect.stringMatching(/yeniden imzalayın/)]);
  });

  it("durum kurtarma: iptaller ve CRL numarası yayımlanmış CRL'den", async () => {
    const der = await signAccessCrl({
      caCertPem: caPem(),
      caKeyPem: caKey(),
      entries: [entry],
      crlNumber: 41,
      now: t0,
    });
    const s = recoverIssuerState("access-ca-1", CFG.issuers[0].uri, der, t0);
    expect(s.crl_number).toBe(41);
    expect(s.revoked.map((r) => [r.serial.toLowerCase(), r.reason])).toEqual([["7a01", "privilege_withdrawn"]]);
  });
});

describe.skipIf(!ready)("ADR-0087 yayıncı (geçici klasörde)", { timeout: 240_000 }, () => {
  const tmp = mkdtempSync(join(tmpdir(), "tamga-crl-"));
  const REG = join(tmp, "registry");
  const DIST = join(tmp, "dist");
  const TPKI = join(tmp, "pki");
  const CLI = resolve(ROOT, "apps/trust-publisher/src/cli.ts");
  const TSX = resolve(ROOT, "node_modules/tsx/dist/cli.mjs");
  const run = (args: string[], env: Record<string, string> = {}) => {
    const r = spawnSync(process.execPath, [TSX, CLI, ...args], {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, TAMGA_TP_REGISTRY: REG, TAMGA_TP_DIST: DIST, TAMGA_TP_PKI: TPKI, ...env },
      timeout: 90_000,
    });
    return { code: r.status, out: r.stdout, err: r.stderr };
  };
  let dns = "";
  const crl = () => new X509Crl(new Uint8Array(readFileSync(join(DIST, "crl", "access-ca-1.crl"))));

  /** Erişim sertifikası makamının verdiği, CRL dağıtım noktalı yeni doğrulayıcı sertifikası (aynı alan adı). */
  async function issueRp(name: string) {
    const ca = new X509Certificate(readFileSync(join(TPKI, "access-ca-1.cert.pem"), "utf8"));
    const caKey = await crypto.subtle.importKey(
      "pkcs8",
      Buffer.from(
        readFileSync(join(TPKI, "access-ca-1.pkcs8.pem"), "utf8")
          .replace(/-----[^-]+-----/g, "")
          .replace(/\s+/g, ""),
        "base64",
      ),
      ALG,
      false,
      ["sign"],
    );
    const kp = (await crypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
    const cert = await X509CertificateGenerator.create({
      serialNumber: `7${Buffer.from(crypto.getRandomValues(new Uint8Array(8)))
        .toString("hex")
        .slice(1)}`,
      subject: "CN=Crl Test Verify (DEV), O=Crl Test (DEV), C=TR",
      issuer: ca.subjectName,
      notBefore: new Date(Date.now() - 60_000),
      notAfter: new Date(Date.now() + 365 * 86400_000),
      signingAlgorithm: ALG,
      publicKey: kp.publicKey,
      signingKey: caKey,
      extensions: [
        new BasicConstraintsExtension(false, undefined, true),
        new KeyUsagesExtension(KeyUsageFlags.digitalSignature, true),
        await SubjectKeyIdentifierExtension.create(kp.publicKey),
        await AuthorityKeyIdentifierExtension.create(ca.publicKey),
        new SubjectAlternativeNameExtension([
          { type: "dns", value: dns },
          { type: "url", value: "https://tamga.network" },
        ]),
        new CRLDistributionPointsExtension([`${BASE}/crl/access-ca-1.crl`]),
      ],
    });
    writeFileSync(join(TPKI, `${name}.cert.pem`), cert.toString("pem") + "\n");
    return cert;
  }
  const setAccessCert = (name: string) => {
    const f = join(REG, "tl-tr.source.json");
    const s = JSON.parse(readFileSync(f, "utf8"));
    s.relying_parties[0].access_cert = name;
    writeFileSync(f, JSON.stringify(s, null, 2) + "\n");
  };

  beforeAll(async () => {
    cpSync(resolve(ROOT, "apps/trust-publisher/registry"), REG, { recursive: true });
    cpSync(PKI, TPKI, { recursive: true });
    const lf = join(REG, "lotl.source.json");
    const lotl = JSON.parse(readFileSync(lf, "utf8"));
    lotl.national_lists.find((n: { state_code: string }) => n.state_code === "TR").roles.access_ca.crl = CFG;
    writeFileSync(lf, JSON.stringify(lotl, null, 2) + "\n");
    dns = JSON.parse(readFileSync(join(REG, "tl-tr.source.json"), "utf8")).relying_parties[0].dns_name;
    await issueRp("rp-crl-a");
    setAccessCert("rp-crl-a");
  });
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it("ilk yayın: boş CRL imzalı ve makamın sertifikasıyla doğrulanır; ayar LOTL'e girmez", async () => {
    const b = run(["build"]);
    expect(b.code, b.err).toBe(0);
    const c = crl();
    expect(c.entries).toHaveLength(0);
    expect(
      await c.verify({ publicKey: new X509Certificate(readFileSync(join(TPKI, "access-ca-1.cert.pem"), "utf8")) }),
    ).toBe(true);
    expect(readFileSync(join(DIST, "lotl.json"), "utf8")).not.toMatch(/"crl"/);
    expect(
      issuingCaOf(readFileSync(join(TPKI, "rp-crl-a.cert.pem"), "utf8"), [
        { ca: "access-ca-1", certPem: readFileSync(join(TPKI, "access-ca-1.cert.pem"), "utf8") },
      ]),
    ).toBe("access-ca-1");
  });

  it("AR1: doğrulayıcı askıya alınınca erişim sertifikası aynı yayında CRL'de (privilegeWithdrawn); heartbeat numarayı artırır", () => {
    const n0 = crlNumberOf(crl())!;
    const r = run(["rp-status", dns, "SUSPENDED", "--reason", "review"], { TAMGA_CONFIRM_PROD: dns });
    expect(r.code, r.err).toBe(0);
    const c = crl();
    const serial = new X509Certificate(readFileSync(join(TPKI, "rp-crl-a.cert.pem"), "utf8")).serialNumber;
    expect(c.findRevoked(serial)?.reason).toBe(X509CrlReason.privilegeWithdrawn);
    expect(crlNumberOf(c)!).toBeGreaterThan(n0);
    expect(readFileSync(join(DIST, "CHANGELOG.md"), "utf8")).toMatch(
      /access-crl: access-ca-1 serial .* REVOKED — privilege_withdrawn/,
    );
    const n1 = crlNumberOf(c)!;
    expect(run(["heartbeat"]).code).toBe(0);
    expect(crlNumberOf(crl())!).toBe(n1 + 1);
    expect(crl().findRevoked(serial)).not.toBeNull();
  });

  it("AR3: aynı sertifikayla yeniden ACTIVE → yayın durur; yeni sertifikayla geçer, eski iptal kalır", async () => {
    const back = run(["rp-status", dns, "ACTIVE", "--reason", "review closed"], { TAMGA_CONFIRM_PROD: dns });
    expect(back.code).not.toBe(0);
    expect(back.err).toMatch(/AR3/);
    await issueRp("rp-crl-b");
    setAccessCert("rp-crl-b");
    const again = run(["rp-status", dns, "ACTIVE", "--reason", "review closed"], { TAMGA_CONFIRM_PROD: dns });
    expect(again.code, again.err).toBe(0);
    const old = new X509Certificate(readFileSync(join(TPKI, "rp-crl-a.cert.pem"), "utf8")).serialNumber;
    const now = new X509Certificate(readFileSync(join(TPKI, "rp-crl-b.cert.pem"), "utf8")).serialNumber;
    expect(crl().findRevoked(old)).not.toBeNull();
    expect(crl().findRevoked(now)).toBeNull();
  });

  it("elle iptal (crl-revoke): key_compromise; certificateHold reddedilir", () => {
    const hold = run(["crl-revoke", "rp-crl-b", "--reason", "certificate_hold"]);
    expect(hold.code).not.toBe(0);
    const r = run(["crl-revoke", "rp-crl-b", "--reason", "key_compromise"]);
    expect(r.code, r.err).toBe(0);
    const serial = new X509Certificate(readFileSync(join(TPKI, "rp-crl-b.cert.pem"), "utf8")).serialNumber;
    expect(crl().findRevoked(serial)?.reason).toBe(X509CrlReason.keyCompromise);
    expect(run(["build"]).err).toMatch(/AR3/); // kayıt hâlâ ACTIVE: yeni sertifika verilene kadar durur
  });

  it("durum dosyası kaybolursa iptaller yayımlanmış CRL'den kurulur", () => {
    const before = crl().entries.length;
    rmSync(join(DIST, "access-crl-state.json"));
    expect(run(["heartbeat"]).code).toBe(0);
    expect(crl().entries.length).toBe(before);
    expect(readFileSync(join(DIST, "CHANGELOG.md"), "utf8")).toMatch(/state for access-ca-1 recovered/);
  });
});
