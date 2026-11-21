/**
 * ADR-0094 uçtan uca: sandbox'ın gerçek imzalı listeleri (`dist-sandbox`: LOTL + ülke listeleri + temsili PID sağlayıcı listeleri
 * `sandbox-pid-tr|az|kz`) ve sandbox PKI'sının temsili makam anahtarlarıyla AB PID (SD-JWT VC `urn:eudi:pid:1`, iç içe `address`,
 * öğe öğe `nationalities`) verilir; Türkiye'deki bir doğrulayıcı politikasıyla doğrulanır. Doğrulayıcı kodu değişmez (ADR-0036 K5).
 * Kanıtlananlar: makam dış sağlayıcı olarak tanınır (sonuçta ülke = listenin `territory`'si); iptal listesi imzacısı listedeki
 * iptal hizmeti sertifikasıdır (D); makamın test kökü Tamga sandbox köküne bağlı değildir (PP3); başka ülkenin makamı da kabul
 * edilir (sandbox'ta karşılıklı tanıma); iptal edilmiş PID RED; liste yüklenemezse DOĞRULANAMADI.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { X509Certificate } from "node:crypto";
import {
  issueSdJwtVc,
  pemIssuerSigner,
  signStatusListToken,
  StatusBitstring,
  MIN_CAPACITY,
  StatusValue,
} from "@tamga-network/sd-jwt";
import { loadTrustSourceFromDir, pemToDer, type ListTrustSource, type TrustSource } from "@tamga-network/trust";
import { SoftwareKeyProvider, MemoryKeyStore, presentSdJwt } from "@tamga-network/wallet-core";
import { epochSeconds } from "@tamga-network/core";
import { verifyPresentation, MemoryStatusCache, type Policy } from "./index.js";

const ROOT = resolve(import.meta.dirname, "../../..");
const PKI = resolve(ROOT, "ops/pki-sandbox");
const DIST = resolve(ROOT, "apps/trust-publisher/dist-sandbox");
const ready =
  ["tr", "kz"].every((c) => existsSync(resolve(PKI, `pid-${c}-issuer.pkcs8.pem`))) &&
  existsSync(resolve(DIST, "external/sandbox-pid-tr.jws"));
const VCT = "urn:eudi:pid:1";
const AUD = "x509_hash:" + "B".repeat(43);
const CLAIMS = ["given_name", "family_name", "birthdate", "nationalities", "personal_administrative_number"];
const policy: Policy = {
  policy_id: "bank-account-opening-pid-test",
  purpose: { "tr-TR": "test" },
  credentials: [{ id: "pid", vct_values: [VCT], required_claims: CLAIMS }],
  trust: { min_issuer_assurance: "I2", allowed_categories: ["IDENTITY"], require_recognition: true, state_code: "TR" },
  freshness: { max_status_token_age_sec: 6 * 3600, max_trust_age_sec: 365 * 86400 },
};
const key = (n: string) => readFileSync(resolve(PKI, `${n}.pkcs8.pem`), "utf8");
const cert = (n: string) => readFileSync(resolve(PKI, `${n}.cert.pem`), "utf8");

describe.skipIf(!ready)("ADR-0094 uçtan uca — temsili ulusal kimlik makamının PID'i", () => {
  let trust: ListTrustSource;
  let rootDer: Uint8Array[];
  const keys = new SoftwareKeyProvider(new MemoryKeyStore());

  beforeAll(async () => {
    const r = await loadTrustSourceFromDir(DIST, {
      environment: "sandbox",
      anchorMaxAgeMs: 365 * 86400_000,
      requiredStates: ["TR"],
      versionMemory: "none",
    });
    expect(r.report.healthy).toBe(true);
    trust = r.trust;
    rootDer = [pemToDer(r.rootCertPem!)];
  });

  async function presentation(cc: string, revoked = false) {
    const now = Math.floor(Date.now() / 1000);
    const iss = `https://issuer.sandbox.tamga.network/pid-${cc}`;
    const uri = `https://status.sandbox.tamga.network/pid-${cc}-e2e`;
    const ref = `k-${cc}-${Math.random().toString(36).slice(2, 8)}`;
    const cnf = await keys.generate(ref);
    const C = cc.toUpperCase();
    const { combined } = await issueSdJwtVc({
      signer: await pemIssuerSigner(key(`pid-${cc}-issuer`), cert(`pid-${cc}-issuer`)),
      iss,
      vct: VCT,
      iat: now,
      exp: now + 365 * 86400,
      cnfJwk: cnf as never,
      status: { status_list: { idx: 11, uri } },
      claims: {
        given_name: "Daniyar",
        family_name: "Ospanov",
        birthdate: "1999-04-18",
        nationalities: [C],
        address: { country: C, locality: "Almaty" },
        personal_administrative_number: "TEST-000000000",
        issuing_authority: `National Identity Authority — ${C} (representative, TEST)`,
        issuing_country: C,
        date_of_expiry: "2031-01-01",
      },
      sdPolicy: { issuing_authority: "never", issuing_country: "never", date_of_expiry: "never" },
      arrayElementSd: ["nationalities"],
      objectMemberSd: ["address"],
    });
    const bs = new StatusBitstring(MIN_CAPACITY);
    if (revoked) bs.set(11, StatusValue.INVALID);
    const cache = new MemoryStatusCache();
    cache.set(
      uri,
      await signStatusListToken({
        signer: await pemIssuerSigner(key(`pid-${cc}-status`), cert(`pid-${cc}-status`)),
        iss,
        uri,
        bitstring: bs,
        iat: now,
        ttlSec: 3600,
      }),
      now,
    );
    const pres = await presentSdJwt({
      combined,
      discloseClaims: CLAIMS,
      keys,
      keyRef: ref,
      aud: AUD,
      nonce: `n-${cc}`,
      iat: now,
    });
    return {
      rp: "none" as const,
      presentation: pres,
      aud: AUD,
      nonce: `n-${cc}`,
      policy,
      policyCredentialId: "pid",
      statusCache: cache,
      rootCertsDer: [...rootDer, ...(trust.externalAnchorCertsDer?.() ?? [])],
      now: epochSeconds(now),
    };
  }

  it("PP3: makamın yaprağı kendi test köküne bağlı, Tamga sandbox köküne değil", () => {
    const leaf = new X509Certificate(cert("pid-tr-issuer"));
    expect(leaf.verify(new X509Certificate(cert("pid-tr-root")).publicKey)).toBe(true);
    expect(leaf.verify(new X509Certificate(cert("root-ca")).publicKey)).toBe(false);
  });

  it("Türkiye makamının PID'i: dış sağlayıcı olarak ACCEPTED, ülke TR", async () => {
    const r = (await verifyPresentation({ ...(await presentation("tr")), trust })).result;
    expect(r.outcome, JSON.stringify([r.failed_step, r.failed_reason])).toBe("ACCEPTED");
    expect(r.issuer?.state_code).toBe("TR");
  });

  it("Kazakistan makamının PID'i TR doğrulayıcısında ACCEPTED (sandbox karşılıklı tanıma)", async () => {
    const r = (await verifyPresentation({ ...(await presentation("kz")), trust })).result;
    expect(r.outcome, JSON.stringify([r.failed_step, r.failed_reason])).toBe("ACCEPTED");
    expect(r.issuer?.state_code).toBe("KZ");
  });

  it("iptal edilmiş PID RED; sağlayıcı listesi kullanılamıyorsa DOĞRULANAMADI", async () => {
    const revoked = (await verifyPresentation({ ...(await presentation("tr", true)), trust })).result;
    expect(revoked.outcome).toBe("REJECTED");
    expect(revoked.failed_step).toMatch(/^D/);
    const base = await presentation("tr");
    const down = Object.assign(Object.create(trust) as TrustSource, {
      externalIssuerByAnchor: () => null,
      unavailableExternalListFor: () => "sandbox-pid-tr",
    });
    expect((await verifyPresentation({ ...base, trust: down })).result.outcome).toBe("INDETERMINATE");
  });
});
