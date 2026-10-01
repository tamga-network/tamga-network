/**
 * ETSI TS 119 602 LoTE izdüşümü (ARF OIA_15b / ISSU_10b / ISSU_28a): kaynakta açıkken `build` üç LoTE üretir; her biri ETSI'nin
 * resmî JSON şemasına uyar (Ek A.1), compact JAdES B ile imzalıdır (x5t#S256 + sigT, §6.8 / Ek E.4), imza sertifikasının C/O
 * alanları SchemeTerritory / SchemeOperatorName ile aynıdır (§6.8.0) ve AB "bildirim" URI'leri kullanılmaz.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { createHash, X509Certificate } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { compactVerify, decodeProtectedHeader, importX509 } from "jose";
import _Ajv from "ajv";
import _addFormats from "ajv-formats";

const ROOT = resolve(import.meta.dirname, "../../..");
const APP = resolve(ROOT, "apps/trust-publisher");
const CLI = resolve(APP, "src/cli.ts");
const TSX = resolve(ROOT, "node_modules/tsx/dist/cli.mjs");
const ready =
  existsSync(resolve(ROOT, "ops/pki/tl-signer-1.pkcs8.pem")) &&
  existsSync(resolve(ROOT, "packages/schemas/dist/index.json"));

// ajv / ajv-formats CJS: varsayılan dışa aktarım ESM'de .default altında olabilir (packages/issuer/src/factory.ts ile aynı)
type AjvCtor = new (o: object) => { addSchema(s: object, k: string): void; compile(s: object): ValidateFn };
type ValidateFn = ((d: unknown) => boolean) & { errors?: unknown };
const Ajv = ((_Ajv as unknown as { default?: AjvCtor }).default ?? _Ajv) as unknown as AjvCtor;
const addFormats = ((_addFormats as unknown as { default?: (a: object) => void }).default ??
  _addFormats) as unknown as (a: object) => void;

const KINDS = ["wallet-providers", "wrpac-providers", "eaa-providers"] as const;

describe.skipIf(!ready)("LoTE izdüşümü (ETSI TS 119 602)", () => {
  const tmp = mkdtempSync(join(tmpdir(), "tamga-lote-"));
  const REG = join(tmp, "registry");
  const DIST = join(tmp, "dist");
  const read = (f: string) => readFileSync(join(DIST, "lote", f), "utf8");

  beforeAll(() => {
    cpSync(resolve(APP, "registry"), REG, { recursive: true });
    const l = JSON.parse(readFileSync(join(REG, "lotl.source.json"), "utf8"));
    l.lote = { ...l.lote, enabled: true };
    writeFileSync(join(REG, "lotl.source.json"), JSON.stringify(l, null, 2));
    mkdirSync(DIST);
    const r = spawnSync(process.execPath, [TSX, CLI, "build"], {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, TAMGA_TP_REGISTRY: REG, TAMGA_TP_DIST: DIST },
      timeout: 60_000,
    });
    if (r.status !== 0) throw new Error(r.stderr);
  });
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it("üç liste üretilir ve ETSI JSON şemasına uyar", () => {
    const ajv = new Ajv({ strict: false, allErrors: true });
    addFormats(ajv);
    ajv.addSchema(JSON.parse(readFileSync(resolve(APP, "etsi/19602/rfcs/rfc7517.json"), "utf8")), "rfcs/rfc7517.json");
    const validate = ajv.compile(JSON.parse(readFileSync(resolve(APP, "etsi/19602/1960201_json_schema.json"), "utf8")));
    for (const k of KINDS) {
      const obj = JSON.parse(read(`${k}.json`));
      expect(validate(obj), `${k}: ${JSON.stringify(validate.errors)}`).toBe(true);
    }
  });

  it("compact JAdES B: imza geçerli, x5t#S256 imza sertifikasına eşit, sigT kritik; yük .json ile aynı", async () => {
    for (const k of KINDS) {
      const jws = read(`${k}.jws`);
      const h = decodeProtectedHeader(jws) as Record<string, unknown> & { x5c: string[] };
      expect(h.alg).toBe("ES256");
      expect(h.crit).toEqual(["sigT"]);
      expect(typeof h.sigT).toBe("string");
      const der = Buffer.from(h.x5c[0], "base64");
      expect(h["x5t#S256"]).toBe(createHash("sha256").update(der).digest("base64url"));
      const pem = `-----BEGIN CERTIFICATE-----\n${h.x5c[0]}\n-----END CERTIFICATE-----`;
      const { payload } = await compactVerify(jws, await importX509(pem, "ES256"), { crit: { sigT: true } });
      const lote = JSON.parse(new TextDecoder().decode(payload));
      expect(lote).toEqual(JSON.parse(read(`${k}.json`)));
      // §6.8.0: sertifika C = SchemeTerritory, O = SchemeOperatorName
      const subject = new X509Certificate(der).subject;
      const info = lote.LoTE.ListAndSchemeInformation;
      expect(subject).toContain(`C=${info.SchemeTerritory}`);
      expect(subject).toContain(`O=${info.SchemeOperatorName[0].value}`);
    }
  });

  it("AB bildirim URI'leri kullanılmaz; hizmet türleri ETSI'ninki (nitelikli olmayan EAA hariç)", () => {
    for (const k of KINDS) {
      const s = read(`${k}.json`);
      expect(s).not.toMatch(
        /uri\.etsi\.org\/19602\/(LoTEType|[A-Za-z]+List\/(StatusDetn|schemerules)|ListOfTrustedEntities)/,
      );
      expect(JSON.parse(s).LoTE.ListAndSchemeInformation.SchemeTerritory).toBe("TR");
    }
    const wp = JSON.parse(read("wallet-providers.json")).LoTE.TrustedEntitiesList;
    expect(wp[0].TrustedEntityServices[0].ServiceInformation.ServiceTypeIdentifier).toBe(
      "http://uri.etsi.org/19602/SvcType/WalletSolution/Issuance",
    );
    const ac = JSON.parse(read("wrpac-providers.json")).LoTE.TrustedEntitiesList;
    expect(ac[0].TrustedEntityServices[0].ServiceInformation.ServiceTypeIdentifier).toBe(
      "http://uri.etsi.org/19602/SvcType/WRPAC/Issuance",
    );
    const eaa = JSON.parse(read("eaa-providers.json")).LoTE.TrustedEntitiesList as Array<{
      TrustedEntityServices: Array<{ ServiceInformation: { ServiceTypeIdentifier: string } }>;
    }>;
    expect(eaa.length).toBeGreaterThanOrEqual(3);
    for (const e of eaa)
      expect(e.TrustedEntityServices.map((x) => x.ServiceInformation.ServiceTypeIdentifier)).toEqual([
        "https://trust.tamga.network/lote/svc-type/EAA/Issuance",
        "https://trust.tamga.network/lote/svc-type/EAA/Revocation",
      ]);
  });

  it("kaynakta kapalıyken üretilmez (yayın onayı)", () => {
    const src = JSON.parse(readFileSync(resolve(APP, "registry/lotl.source.json"), "utf8"));
    expect(src.lote.enabled).toBe(false);
  });
});
