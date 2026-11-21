/**
 * ADR-0093 uçtan uca: sandbox'ın gerçek imzalı listeleri (`dist-sandbox`: LOTL + tl-tr + temsili tl-az / tl-kz) ve sandbox PKI'sının
 * kurum anahtarlarıyla diploma verilir, Türkiye'deki bir doğrulayıcı politikasıyla (`require_recognition`, TR) doğrulanır.
 * Kanıtlananlar: kurum kimliği kendi ülke listesinden (sonuçta `issuer.state_code` KZ / AZ), TR'nin tanımasıyla ACCEPTED; tanıma
 * yoksa C3 RED; kurumun ülke listesi yüklenemezse INDETERMINATE (C1); iptal edilmiş Kazak diploması D adımında RED.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
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
import { computeIssuerId, epochSeconds } from "@tamga-network/core";
import { verifyPresentation, MemoryStatusCache, type Policy } from "./index.js";

const ROOT = resolve(import.meta.dirname, "../../..");
const PKI = resolve(ROOT, "ops/pki-sandbox");
const DIST = resolve(ROOT, "apps/trust-publisher/dist-sandbox");
const ready =
  existsSync(resolve(PKI, "issuer-dalaqala.pkcs8.pem")) &&
  existsSync(resolve(PKI, "issuer-gunesli.pkcs8.pem")) &&
  existsSync(resolve(DIST, "tl-kz.jws")) &&
  existsSync(resolve(ROOT, "packages/schemas/dist/index.json"));
const VCT = "urn:tamga:edu:DiplomaCredential:1";
const AUD = "x509_hash:" + "B".repeat(43);
const policy: Policy = {
  policy_id: "job-application-degree-test",
  purpose: { "tr-TR": "test" },
  credentials: [
    {
      id: "diploma",
      vct_values: [VCT],
      required_claims: ["is_graduate", "qualification_title", "eqf_level", "awarding_body_name"],
      constraints: { is_graduate: true, eqf_level: { min: 6 } },
    },
  ],
  trust: { min_issuer_assurance: "I2", allowed_categories: ["EDUCATION"], require_recognition: true, state_code: "TR" },
  freshness: { max_status_token_age_sec: 6 * 3600, max_trust_age_sec: 365 * 86400 },
};
const key = (n: string) => readFileSync(resolve(PKI, `${n}.pkcs8.pem`), "utf8");
const cert = (n: string) => readFileSync(resolve(PKI, `${n}.cert.pem`), "utf8");

describe.skipIf(!ready)("ADR-0093 uçtan uca — temsili ülke listesindeki kurumun diploması", () => {
  let trust: ListTrustSource;
  let rootDer: Uint8Array[];
  const keys = new SoftwareKeyProvider(new MemoryKeyStore());
  const integ = (
    JSON.parse(readFileSync(resolve(ROOT, "packages/schemas/dist/index.json"), "utf8")) as Array<{
      vct: string;
      content_hash: string;
    }>
  ).find((c) => c.vct === VCT)!.content_hash;

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

  async function presentation(slug: string, cc: string, revoked = false) {
    const now = Math.floor(Date.now() / 1000);
    const iss = `https://issuer.sandbox.tamga.network/${slug}`;
    const uri = `https://status.sandbox.tamga.network/${slug}-e2e`;
    const ref = `k-${slug}-${Math.random().toString(36).slice(2, 8)}`;
    const cnf = await keys.generate(ref);
    const { combined } = await issueSdJwtVc({
      signer: await pemIssuerSigner(key(`issuer-${slug}`), cert(`issuer-${slug}`)),
      iss,
      vct: VCT,
      vctIntegrity: integ,
      iat: now,
      cnfJwk: cnf as never,
      status: { status_list: { idx: 7, uri } },
      claims: {
        family_name: "Ospanov",
        given_name: "Daniyar",
        birth_date: "1999-04-18",
        awarding_body_name: { "tr-TR": `${slug} (TEST)` },
        awarding_body_id: slug,
        awarding_body_country: cc,
        qualification_title: { "tr-TR": "Hukuk Lisans Diploması" },
        eqf_level: 6,
        isced_f_code: "0421",
        awarding_date: "2021-06-28",
        grade: "3.67",
        is_graduate: true,
        graduated_before: 2022,
      },
      sdPolicy: { grade: "always" },
    });
    const bs = new StatusBitstring(MIN_CAPACITY);
    if (revoked) bs.set(7, StatusValue.INVALID);
    const cache = new MemoryStatusCache();
    cache.set(
      uri,
      await signStatusListToken({
        signer: await pemIssuerSigner(key(`issuer-${slug}-status`), cert(`issuer-${slug}-status`)),
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
      discloseClaims: ["is_graduate", "eqf_level", "qualification_title", "awarding_body_name"],
      keys,
      keyRef: ref,
      aud: AUD,
      nonce: `n-${slug}`,
      iat: now,
    });
    return {
      rp: "none" as const,
      presentation: pres,
      aud: AUD,
      nonce: `n-${slug}`,
      policy,
      policyCredentialId: "diploma",
      statusCache: cache,
      rootCertsDer: rootDer,
      now: epochSeconds(now),
    };
  }

  it("Kazak diploması (Dalaqala, tl-kz): TR tanır → ACCEPTED, kurum kimliği KZ ile", async () => {
    const r = (await verifyPresentation({ ...(await presentation("dalaqala", "KZ")), trust })).result;
    expect(r.outcome, JSON.stringify([r.failed_step, r.failed_reason])).toBe("ACCEPTED");
    expect(r.issuer?.state_code).toBe("KZ");
    expect(r.issuer?.issuer_id).toBe(computeIssuerId("KZ", pemToDer(cert("issuer-dalaqala"))));
  });

  it("Azerbaycan diploması (Günəşli, tl-az): ACCEPTED, kurum kimliği AZ ile", async () => {
    const r = (await verifyPresentation({ ...(await presentation("gunesli", "AZ")), trust })).result;
    expect(r.outcome, JSON.stringify([r.failed_step, r.failed_reason])).toBe("ACCEPTED");
    expect(r.issuer?.state_code).toBe("AZ");
  });

  it("tanıma yoksa C3 RED; KZ listesi kullanılamıyorsa DOĞRULANAMADI; iptal edilmiş diploma RED", async () => {
    const base = await presentation("dalaqala", "KZ");
    const noRecognition = Object.assign(Object.create(trust) as TrustSource, { isRecognizedBy: () => "NO" as const });
    expect((await verifyPresentation({ ...base, trust: noRecognition })).result).toMatchObject({
      outcome: "REJECTED",
      failed_step: "C3",
    });
    const kzDown = Object.assign(Object.create(trust) as TrustSource, {
      resolveIssuerId: () => ({ kind: "none" as const, unavailableStates: ["KZ"] }),
    });
    expect((await verifyPresentation({ ...base, trust: kzDown })).result).toMatchObject({
      outcome: "INDETERMINATE",
      failed_step: "C1",
    });
    const revoked = (await verifyPresentation({ ...(await presentation("dalaqala", "KZ", true)), trust })).result;
    expect(revoked.outcome).toBe("REJECTED");
    expect(revoked.failed_step).toMatch(/^D/);
  });
});
