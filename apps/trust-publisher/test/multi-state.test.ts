/**
 * ADR-0093 (D-TRUST-9) — liste yayıncısında birden çok ülke listesi. Sandbox kayıt defteri geçici klasörde derlenir
 * (TAMGA_TP_REGISTRY / TAMGA_TP_DIST; gerçek registry-sandbox/ ve dist-sandbox/'a dokunulmaz). Kanıtlananlar:
 *  K3  her ülke listesi kendi imzacısıyla, LOTL'dan önce; kimlikler listenin ülke koduyla; AZ/KZ'de doğrulayıcı yok
 *  K4  sandbox'ta TR, AZ, KZ birbirini tanır; yükleyici üç listeyi de yükler, kurumlar kendi ülkesiyle çözülür
 *  K6  LOTL'da ETKİN ama kaynağı olmayan yer → yayın durur
 *  UL1 aynı kurum sertifikası iki ülkede → yayın durur
 *  UL3 gerçek ağda ikinci ülke listesi kaynağı → yayın durur; ülke listesi LOTL imzacısıyla imzalanamaz
 */
import { describe, it, expect, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { computeCaId, computeIssuerId, certFingerprintSha256Hex } from "@tamga-network/core";
import { loadTrustSourceFromDir, pemToDer } from "@tamga-network/trust";

const ROOT = resolve(import.meta.dirname, "../../..");
const CLI = resolve(ROOT, "apps/trust-publisher/src/cli.ts");
const TSX = resolve(ROOT, "node_modules/tsx/dist/cli.mjs");
const SB_PKI = resolve(ROOT, "ops/pki-sandbox");
const ready =
  existsSync(resolve(SB_PKI, "tl-signer-az-1.pkcs8.pem")) &&
  existsSync(resolve(SB_PKI, "tl-signer-kz-1.pkcs8.pem")) &&
  existsSync(resolve(ROOT, "packages/schemas/dist/index.json"));
const der = (n: string) => pemToDer(readFileSync(resolve(SB_PKI, `${n}.cert.pem`), "utf8"));
const x5cFp = (jws: string) =>
  certFingerprintSha256Hex(
    Buffer.from(JSON.parse(Buffer.from(jws.split(".")[0], "base64url").toString("utf8")).x5c[0], "base64"),
  );

describe.skipIf(!ready)("ADR-0093 liste yayıncısı — birden çok ülke listesi", { timeout: 300_000 }, () => {
  const tmp = mkdtempSync(join(tmpdir(), "tamga-tp-ms-"));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));
  let n = 0;
  /** Sandbox kayıt defterinin kopyasında (isteğe bağlı değişiklikle) derler. */
  function build(
    edit: (reg: string) => void = () => {},
    opts: { registry?: string; pki?: string; network?: string } = {},
  ) {
    const dir = join(tmp, `r${++n}`);
    const reg = join(dir, "registry");
    const dist = join(dir, "dist");
    cpSync(opts.registry ?? resolve(ROOT, "apps/trust-publisher/registry-sandbox"), reg, { recursive: true });
    mkdirSync(dist, { recursive: true });
    edit(reg);
    const r = spawnSync(process.execPath, [TSX, CLI, "build"], {
      cwd: ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        TAMGA_NETWORK: opts.network ?? "sandbox",
        TAMGA_TP_REGISTRY: reg,
        TAMGA_TP_DIST: dist,
        TAMGA_TP_PKI: opts.pki ?? SB_PKI,
      },
      timeout: 120_000,
    });
    return { code: r.status, err: r.stderr, dist, reg };
  }
  const readJ = (p: string) => JSON.parse(readFileSync(p, "utf8"));
  const writeJ = (p: string, o: unknown) => writeFileSync(p, JSON.stringify(o, null, 2) + "\n");

  it("K3/K4: üç liste, her biri kendi imzacısıyla; kimlikler ülke koduyla; yükleyici kurumları kendi ülkesiyle çözer", async () => {
    const b = build();
    expect(b.code, b.err).toBe(0);
    for (const cc of ["tr", "az", "kz"]) expect(existsSync(join(b.dist, `tl-${cc}.jws`)), cc).toBe(true);
    expect(x5cFp(readFileSync(join(b.dist, "tl-az.jws"), "utf8"))).toBe(
      certFingerprintSha256Hex(der("tl-signer-az-1")),
    );
    expect(x5cFp(readFileSync(join(b.dist, "tl-kz.jws"), "utf8"))).toBe(
      certFingerprintSha256Hex(der("tl-signer-kz-1")),
    );
    const az = readJ(join(b.dist, "tl-az.json"));
    expect(az.relying_parties).toEqual([]);
    expect(az.operator.on_behalf_of).toMatch(/no participation or endorsement/);
    expect(az.issuers.map((i: { issuer_id: string }) => i.issuer_id)).toEqual([
      computeIssuerId("AZ", der("issuer-gunesli")),
    ]);
    const lotl = readJ(join(b.dist, "lotl.json"));
    const slot = (cc: string) => lotl.national_lists.find((x: { state_code: string }) => x.state_code === cc);
    expect(slot("AZ").roles.national_root_ca.ca_id).toBe(computeCaId("AZ", der("root-ca")));
    expect(slot("TR").roles.national_root_ca.ca_id).toBe(computeCaId("TR", der("root-ca")));
    expect(slot("AZ").roles.registrar.status).toBe("RESERVED");
    expect(slot("TR").recognition.recognizes.sort()).toEqual(["AZ", "KZ", "TR"]);
    const { trust, report } = await loadTrustSourceFromDir(b.dist, {
      environment: "sandbox",
      anchorMaxAgeMs: 365 * 86400_000,
      requiredStates: ["TR"],
    });
    expect(report.healthy).toBe(true);
    const r = trust.resolveIssuerId(certFingerprintSha256Hex(der("issuer-dalaqala")));
    expect(r).toMatchObject({ kind: "found", stateCode: "KZ" });
    if (r.kind !== "found") return;
    expect(trust.isCredentialAcceptable(r.issuerId, Math.floor(Date.now() / 1000))).toBe("YES");
    expect(trust.isRecognizedBy("TR", r.issuerId)).toBe("YES");
  });

  it("K3: ülke listesi doğrulayıcı taşıyamaz; LOTL imzacısıyla imzalanamaz", () => {
    const rp = build((reg) => {
      const tr = readJ(join(reg, "tl-tr.source.json"));
      const az = readJ(join(reg, "tl-az.source.json"));
      writeJ(join(reg, "tl-az.source.json"), { ...az, relying_parties: [tr.relying_parties[0]] });
    });
    expect(rp.code).not.toBe(0);
    expect(rp.err).toMatch(/ADR-0093 K3: tl-az\.source\.json doğrulayıcı kaydı taşıyamaz/);
    const sig = build((reg) => {
      const l = readJ(join(reg, "lotl.source.json"));
      l.national_lists.find((x: { state_code: string }) => x.state_code === "AZ").signing_certs = ["tl-signer-1"];
      writeJ(join(reg, "lotl.source.json"), l);
    });
    expect(sig.code).not.toBe(0);
    expect(sig.err).toMatch(/LOTL imzacısıyla imzalanamaz/);
    expect(existsSync(join(sig.dist, "lotl.jws"))).toBe(false);
  });

  it("K6: LOTL'da ETKİN yerin kaynağı yoksa yayın durur, LOTL yazılmaz", () => {
    const b = build((reg) => rmSync(join(reg, "tl-kz.source.json")));
    expect(b.code).not.toBe(0);
    expect(b.err).toMatch(/ADR-0093 K6: .*KZ/);
    expect(existsSync(join(b.dist, "lotl.jws"))).toBe(false);
    expect(existsSync(join(b.dist, "tl-tr.jws"))).toBe(false);
  });

  it("UL1: aynı kurum sertifikası iki ülkenin listesinde → yayın durur", () => {
    const b = build((reg) => {
      const kz = readJ(join(reg, "tl-kz.source.json"));
      kz.issuers[0].cert = "issuer-gunesli";
      kz.issuers[0].status_cert = "issuer-gunesli-status";
      writeJ(join(reg, "tl-kz.source.json"), kz);
    });
    expect(b.code).not.toBe(0);
    expect(b.err).toMatch(/ADR-0093 UL1/);
    // yarım yayın yok: denetim hiçbir liste yazılmadan önce
    expect(existsSync(join(b.dist, "tl-tr.jws"))).toBe(false);
  });

  it("UL3: gerçek ağ kayıt defterinde ikinci ülke listesi kaynağı → yayın durur", () => {
    const b = build(
      (reg) => {
        const az = readJ(resolve(ROOT, "apps/trust-publisher/registry-sandbox/tl-az.source.json"));
        delete az.environment;
        writeJ(join(reg, "tl-az.source.json"), az);
      },
      {
        registry: resolve(ROOT, "apps/trust-publisher/registry"),
        pki: resolve(ROOT, "ops/pki"),
        network: "production",
      },
    );
    expect(b.code).not.toBe(0);
    expect(b.err).toMatch(/ADR-0093 UL3/);
    expect(existsSync(join(b.dist, "tl-tr.jws"))).toBe(false);
  });
});
