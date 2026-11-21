/**
 * Sandbox kurgusal doğrulayıcıları (2026-11-19) kendi erişim sertifikalarıyla (ADR-0087 K2: erişim sertifikası
 * makamından) RP beyanı imzalar; sandbox doğrulayıcısı aracıdır ve isteği onların adına açar (ADR-0017 K7, `tamga_on_behalf_of`).
 * Uçtan uca: beyan → istek nesnesi → cüzdan çekirdeği asıl RP'nin kayıtlı adını çözer (aracı ilişkisi iki kayıtta yazılı) →
 * sonucu yalnız sunumu açan RP okur (HV1). Kayıt kapsamını aşan politika açılmaz (AP6).
 */
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { X509Certificate } from "node:crypto";
import { createRpAssertion, pemRpSigner, policyScopeViolations } from "@tamga-network/verifier";
import { checkRp, parseVpUri, rpRecordOf, verifyRequestObject, type RpRecord } from "@tamga-network/wallet-core";
import { certFingerprintSha256Hex, epochMillis, pemToDer } from "@tamga-network/core";
import { buildVerifyApp } from "../src/app.js";
import { POLICIES } from "../src/policies.js";
import type { VerifyConfig } from "../src/config.js";

const ROOT = resolve(import.meta.dirname, "../../..");
const DIST = resolve(ROOT, "apps/trust-publisher/dist-sandbox");
const PKI = resolve(ROOT, "ops/pki-sandbox");
const SOURCE = JSON.parse(
  readFileSync(resolve(ROOT, "apps/trust-publisher/registry-sandbox/tl-tr.source.json"), "utf8"),
) as { relying_parties: Array<{ access_cert: string; legal_name: string; dns_name: string }> };
const BASE = "http://localhost:4104";
const LOCAL = { allowLocalDevHost: true };

/** Kurgusal doğrulayıcı → sandbox portalındaki senaryosunun politikası */
const CASES: Array<[string, string]> = [
  ["rp-bitbahce", "job-application-degree"],
  ["rp-sikkebank", "bank-account-opening"],
  ["rp-sayfalik", "library-membership"],
  ["rp-kampuskart", "student-discount"],
  ["rp-yolgezer", "car-rental-driving-21"],
  ["rp-gecekonak", "hotel-check-in"],
  ["rp-kampusyuva", "dormitory-application"],
  // ADR-0094: PID ile seçenek senaryoları (kayıtta ayrı kullanım)
  ["rp-sikkebank", "bank-account-opening-pid"],
  ["rp-gecekonak", "hotel-check-in-pid"],
];
const ready =
  CASES.every(([n]) => existsSync(resolve(PKI, `${n}.pkcs8.pem`))) &&
  existsSync(resolve(PKI, "rp-verify.pkcs8.pem")) &&
  existsSync(resolve(DIST, "lotl.jws"));

const signerOf = (name: string) =>
  pemRpSigner(
    readFileSync(resolve(PKI, `${name}.pkcs8.pem`), "utf8"),
    readFileSync(resolve(PKI, `${name}.cert.pem`), "utf8"),
  );

describe.skipIf(!ready)("sandbox kurgusal doğrulayıcılar (aracı istek, ADR-0017 K7)", () => {
  let app: Awaited<ReturnType<typeof buildVerifyApp>>;
  beforeAll(async () => {
    const cfg: VerifyConfig = {
      publicBase: BASE,
      port: 0,
      clientId: "",
      pkiDir: PKI,
      trustDist: DIST,
      stateCode: "TR",
      trustReloadSec: 60,
      statusPrefetchSec: 60,
      dataDir: join(tmpdir(), "tamga-verify-sbrp-" + process.pid + "-" + Math.random().toString(36).slice(2)),
      requireRpAuth: true,
      network: "sandbox",
    };
    app = await buildVerifyApp(cfg);
  });
  afterAll(async () => {
    await app?.close();
  });

  it("her kaydın erişim sertifikası listede, aracıyı listeler; aracı onları listeler", () => {
    const verify = rpRecordOf(app.trust(), "verify.sandbox.tamga.network")!;
    for (const [name] of CASES) {
      const src = SOURCE.relying_parties.find((r) => r.access_cert === name)!;
      const rec = rpRecordOf(app.trust(), src.dns_name)!;
      expect(rec, name).toBeTruthy();
      expect(rec.status).toBe("ACTIVE");
      expect(rec.uses_intermediaries).toEqual(["verify.sandbox.tamga.network"]);
      expect(verify.served_relying_parties).toContain(src.dns_name);
    }
  });

  for (const [name, policyId] of CASES)
    it(`${name}: ${policyId} — cüzdan asıl RP'yi gösterir, sonucu yalnız o okur`, async () => {
      const owner = await signerOf(name);
      const ownerAuth = async () => `Bearer ${await createRpAssertion(owner, BASE)}`;
      const made = await app.inject({
        method: "POST",
        url: "/presentations",
        headers: { accept: "application/json", "content-type": "application/json", authorization: await ownerAuth() },
        payload: { policy_id: policyId },
      });
      expect(made.statusCode, made.body).toBe(200);
      const { presentation_id, qr_payload } = made.json() as { presentation_id: string; qr_payload: string };

      // cüzdan: istek nesnesi aracının (rp-verify) imzasıyla, asıl RP `tamga_on_behalf_of`'ta
      const uri = parseVpUri(qr_payload, LOCAL);
      const fetched = await app.inject({ method: "GET", url: new URL(uri.requestUri).pathname });
      expect(fetched.statusCode).toBe(200);
      const req = verifyRequestObject(fetched.body.trim(), uri.clientId, LOCAL);
      expect(req.onBehalfOf).toBe(owner.clientId);
      const signerRec = rpRecordOf(app.trust(), req.clientId) as RpRecord;
      const ownerRec = rpRecordOf(app.trust(), req.onBehalfOf!) as RpRecord;
      const pc = POLICIES.find((p) => p.policy_id === policyId)!.credentials[0];
      const match = { queryId: pc.id, credential: { vct: pc.vct_values[0] } as never, requested: pc.required_claims };
      const chk = checkRp(signerRec, req, match, epochMillis(Date.now()), ownerRec);
      const src = SOURCE.relying_parties.find((r) => r.access_cert === name)!;
      expect(chk.registered).toBe(true);
      expect(chk.legalName).toBe(src.legal_name);
      expect(chk.via).toBe(signerRec.legal_name);
      expect(chk.overAsk).toEqual([]);

      // HV1: sonucu yalnız sunumu açan RP okur — doğrulayıcının kendi kaydının beyanı bile 404 alır
      const verifyAuth = `Bearer ${await createRpAssertion(await signerOf("rp-verify"), BASE)}`;
      const other = await app.inject({
        method: "GET",
        url: `/presentations/${presentation_id}`,
        headers: { authorization: verifyAuth },
      });
      expect(other.statusCode).toBe(404);
      const mine = await app.inject({
        method: "GET",
        url: `/presentations/${presentation_id}`,
        headers: { authorization: await ownerAuth() },
      });
      expect(mine.statusCode).toBe(200);
      expect((mine.json() as { state: string }).state).toBe("PENDING");
    });

  it("AP6: kaydının kapsamı dışındaki politika açılmaz (kütüphane banka hesabı isteyemez)", async () => {
    const owner = await signerOf("rp-sayfalik");
    const r = await app.inject({
      method: "POST",
      url: "/presentations",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${await createRpAssertion(owner, BASE)}`,
      },
      payload: { policy_id: "bank-account-opening" },
    });
    expect(r.statusCode).toBe(400);
    expect((r.json() as { error: string }).error).toBe("policy_exceeds_scope");
  });
});

/**
 * Anahtarsız (özel anahtar ve üretilmiş liste gerekmez; CI'da da koşar): kaynak kayıt ↔ izlenen sertifika ↔ politika tutarlılığı.
 * Yukarıdaki uçtan uca denetimin varsaydığı her şey burada dosyalardan doğrulanır.
 */
describe("sandbox kurgusal doğrulayıcılar — kayıt, sertifika ve politika tutarlılığı (anahtarsız)", () => {
  const SRC = JSON.parse(
    readFileSync(resolve(ROOT, "apps/trust-publisher/registry-sandbox/tl-tr.source.json"), "utf8"),
  ) as {
    relying_parties: Array<
      Record<string, unknown> & {
        access_cert: string;
        dns_name: string;
        identifiers?: Array<{ scheme: string; value: string }>;
        uses_intermediaries?: string[];
        served_relying_parties?: string[];
        scopes: Array<{ vct: string; claims: string[]; valid_from: string; valid_until?: string }>;
      }
    >;
  };
  const PKI_JSON = JSON.parse(readFileSync(resolve(PKI, "pki.json"), "utf8")) as Record<
    string,
    { fingerprint_sha256?: string }
  >;
  const accessCa = new X509Certificate(readFileSync(resolve(PKI, "access-ca-1.cert.pem")));
  const verify = SRC.relying_parties.find((r) => r.access_cert === "rp-verify")!;

  for (const [name, policyId] of CASES)
    it(`${name}: sertifika kayıtla, kapsam politikayla tutarlı`, () => {
      const rec = SRC.relying_parties.find((r) => r.access_cert === name)!;
      expect(rec, name).toBeTruthy();
      const pem = readFileSync(resolve(PKI, `${name}.cert.pem`), "utf8");
      const x = new X509Certificate(pem);
      expect(x.verify(accessCa.publicKey), "erişim sertifikası makamınca imzalı (ADR-0087 K2)").toBe(true);
      expect(x.issuer).toBe(accessCa.subject);
      expect(x.subjectAltName?.split(", ")).toContain(`DNS:${rec.dns_name}`);
      expect(rec.dns_name).toMatch(/\.example$/);
      const vkn = rec.identifiers?.find((i) => i.scheme === "TR-VKN")?.value.replace(/^TR/, "");
      expect(x.subject).toMatch(new RegExp(`=VATTR-${vkn}$`, "m")); // organizationIdentifier (2.5.4.97)
      expect(x.subject).toContain("(TEST)");
      expect(certFingerprintSha256Hex(pemToDer(pem))).toBe(PKI_JSON[name]?.fingerprint_sha256);
      // ADR-0017 K7: aracı ilişkisi iki kayıtta
      expect(rec.uses_intermediaries).toEqual([verify.dns_name]);
      expect(verify.served_relying_parties).toContain(rec.dns_name);
      // AP6: politika kaydın kapsamında; aşırı istek yok
      const policy = POLICIES.find((p) => p.policy_id === policyId)!;
      expect(policyScopeViolations(policy, { ...rec, status: "ACTIVE" } as never)).toEqual([]);
    });

  it("aracının hizmet verdiği her RP kayıtlı ve aracıyı listeliyor (tek taraflı beyan yok)", () => {
    for (const dns of verify.served_relying_parties ?? []) {
      const rec = SRC.relying_parties.find((r) => r.dns_name === dns);
      expect(rec?.uses_intermediaries, dns).toContain(verify.dns_name);
    }
  });
});
