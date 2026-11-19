/**
 * Denetim turu D (2026-11-18) — doğrulama hattı: bozuk `status` girişi D1 RED (D1-1), bilinmeyen politika belge kimliği A1 (D1-12),
 * iptal edilmiş tür B2'de durur (D3-1), süresi dolmuş tek iptal anahtarı STATUS_STALE (D3-18), politika saat payı iptal listesi
 * imza denetimine (D3) iletilir (D1-8). Dev PKI + test listesi (`npm run setup`). Kişisel veri yok (örnek kişi kurgusaldır).
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
} from "@tamga-network/sd-jwt";
import { loadTrustSourceFromDir, pemToDer, x509HashClientId, type ListTrustSource } from "@tamga-network/trust";
import { SoftwareKeyProvider, MemoryKeyStore, presentSdJwt } from "@tamga-network/wallet-core";
import { epochSeconds } from "@tamga-network/core";
import { verifyPresentation, MemoryStatusCache, type Policy } from "./index.js";

const ROOT = resolve(import.meta.dirname, "../../..");
const PKI = resolve(ROOT, "ops/pki");
const DIST = resolve(ROOT, "apps/trust-publisher/dist-test");
const DEV_DIST = { anchorMaxAgeMs: 365 * 86400_000 };
const ready = existsSync(resolve(PKI, "issuer-bilgi.pkcs8.pem")) && existsSync(resolve(DIST, "lotl.jws"));
const AUD = existsSync(resolve(PKI, "rp-verify.cert.pem"))
  ? x509HashClientId(pemToDer(readFileSync(resolve(PKI, "rp-verify.cert.pem"), "utf8")))
  : "";
const ISS = "https://issuer.tamga.network/example-university";
const VCT = "urn:tamga:edu:DiplomaCredential:1";
const REQUIRED = ["is_graduate", "eqf_level", "qualification_title", "awarding_body_name"];
const policy: Policy = {
  policy_id: "td",
  purpose: { "tr-TR": "test" },
  credentials: [{ id: "diploma", vct_values: [VCT], required_claims: REQUIRED }],
  trust: { min_issuer_assurance: "I2", allowed_categories: ["EDUCATION"], require_recognition: true, state_code: "TR" },
  freshness: { max_status_token_age_sec: 6 * 3600, max_trust_age_sec: 86400 },
};

describe.skipIf(!ready)("denetim turu D — verifyPresentation (dev PKI + dist)", () => {
  let trust: ListTrustSource;
  let rootDer: Uint8Array[];
  const keys = new SoftwareKeyProvider(new MemoryKeyStore());
  const catalogue = JSON.parse(readFileSync(resolve(ROOT, "packages/schemas/dist/index.json"), "utf8")) as Array<{
    vct: string;
    content_hash: string;
  }>;
  const integ = catalogue.find((c) => c.vct === VCT)!.content_hash;
  const STATUS_URI = "https://status.tamga.network/abcdef0123456789";
  const claims = {
    family_name: "Yılmaz",
    given_name: "Ayşe",
    birth_date: "2001-05-05",
    awarding_body_name: { "tr-TR": "Örnek Üniversitesi" },
    awarding_body_id: "example-university",
    awarding_body_country: "TR",
    qualification_title: { "tr-TR": "Bilgisayar Mühendisliği Lisans" },
    eqf_level: 6,
    isced_f_code: "0613",
    awarding_date: "2025-06-30",
    is_graduate: true,
    graduated_before: 2026,
  };
  beforeAll(async () => {
    const r = await loadTrustSourceFromDir(DIST, DEV_DIST);
    trust = r.trust;
    rootDer = [pemToDer(r.rootCertPem!)];
  });
  async function presentation(now: number, status: unknown = { status_list: { idx: 4242, uri: STATUS_URI } }) {
    const ref = `k-d-${now}-${Math.random().toString(36).slice(2, 8)}`;
    const cnf = await keys.generate(ref);
    const r = await issueSdJwtVc({
      signer: await pemIssuerSigner(
        readFileSync(resolve(PKI, "issuer-bilgi.pkcs8.pem"), "utf8"),
        readFileSync(resolve(PKI, "issuer-bilgi.cert.pem"), "utf8"),
      ),
      iss: ISS,
      vct: VCT,
      vctIntegrity: integ,
      iat: now,
      cnfJwk: cnf as never,
      status: status as never,
      claims,
      sdPolicy: { grade: "always" },
    });
    return presentSdJwt({
      combined: r.combined,
      discloseClaims: REQUIRED,
      keys,
      keyRef: ref,
      aud: AUD,
      nonce: "n-d",
      iat: now,
    });
  }
  async function cacheWith(tokIat: number, fetchedAt = tokIat) {
    const signer = await pemIssuerSigner(
      readFileSync(resolve(PKI, "issuer-bilgi-status.pkcs8.pem"), "utf8"),
      readFileSync(resolve(PKI, "issuer-bilgi-status.cert.pem"), "utf8"),
    );
    const tok = await signStatusListToken({
      signer,
      iss: ISS,
      uri: STATUS_URI,
      bitstring: new StatusBitstring(MIN_CAPACITY),
      iat: tokIat,
      ttlSec: 120,
      expSec: 6 * 3600,
    });
    const c = new MemoryStatusCache();
    c.set(STATUS_URI, tok, fetchedAt);
    return c;
  }
  const input = (presentation: string, now: number, statusCache: MemoryStatusCache) => ({
    presentation,
    aud: AUD,
    nonce: "n-d",
    policy,
    policyCredentialId: "diploma",
    trust,
    statusCache,
    rootCertsDer: rootDer,
    rp: "none" as const,
    now: epochSeconds(now),
  });

  it("D1-1: imzalı ama bozuk `status` girişi D1 RED (status entry malformed) — DOĞRULANAMADI değil", async () => {
    const now = Math.floor(Date.now() / 1000);
    for (const bad of [{ status_list: { idx: "x", uri: STATUS_URI } }, { other: 1 }, "x"]) {
      const r = (await verifyPresentation(input(await presentation(now, bad), now, await cacheWith(now)))).result;
      expect(r, JSON.stringify(bad)).toMatchObject({ outcome: "REJECTED", failed_step: "D1" });
      expect(r.failed_reason).toMatch(/^status entry malformed/);
    }
  });

  it("D1-12: politikada olmayan `policyCredentialId` A adımından önce A1 RED (E2 değil)", async () => {
    const now = Math.floor(Date.now() / 1000);
    const r = (
      await verifyPresentation({
        ...input(await presentation(now), now, await cacheWith(now)),
        policyCredentialId: "yok",
      })
    ).result;
    expect(r).toMatchObject({ outcome: "REJECTED", failed_step: "A1" });
    expect(r.failed_reason).toMatch(/policyCredentialId/);
    expect(r.checks_performed.filter((s) => s.startsWith("A") || s.startsWith("E"))).not.toContain("A3");
  });

  it("D3-1: türün kaydı REVOKED ise B2 RED (C2'ye inmez); DEPRECATED türde B2 geçer", async () => {
    const now = Math.floor(Date.now() / 1000);
    const pres = await presentation(now);
    const withSchemaStatus = (status: string): ListTrustSource => {
      const t: ListTrustSource = Object.create(trust);
      t.schema = (id: string) => {
        const rec = trust.schema(id);
        return rec ? ({ ...rec, status } as typeof rec) : rec;
      };
      return t;
    };
    const revoked = (
      await verifyPresentation({ ...input(pres, now, await cacheWith(now)), trust: withSchemaStatus("REVOKED") })
    ).result;
    expect(revoked).toMatchObject({ outcome: "REJECTED", failed_step: "B2", failed_reason: "schema revoked" });
    expect(revoked.schema?.status).toBe("REVOKED");
    expect(revoked.checks_performed).not.toContain("C2");
    const deprecated = (
      await verifyPresentation({ ...input(pres, now, await cacheWith(now)), trust: withSchemaStatus("DEPRECATED") })
    ).result;
    expect(deprecated.checks_performed).toContain("B2");
  });

  it("D3-18: kurumun tek iptal anahtarının süresi dolmuşsa D3 DOĞRULANAMADI, neden STATUS_STALE (UNREACHABLE değil)", async () => {
    const now = Math.floor(Date.now() / 1000);
    const pres = await presentation(now);
    const t: ListTrustSource = Object.create(trust);
    const iso = (s: number) => new Date(s * 1000).toISOString();
    t.issuer = (id: string) => {
      const rec = trust.issuer(id);
      return rec
        ? { ...rec, delegate_keys: (rec.delegate_keys ?? []).map((k) => ({ ...k, valid_to: iso(now - 3600) })) }
        : rec;
    };
    const r = (await verifyPresentation({ ...input(pres, now, await cacheWith(now)), trust: t })).result;
    expect(r).toMatchObject({ outcome: "INDETERMINATE", failed_step: "D3", indeterminate_reason: "STATUS_STALE" });
  });

  it("D1-8: politikanın saat payı (`max_clock_skew_sec`) iptal listesinin `iat` denetimine iletilir", async () => {
    const now = Math.floor(Date.now() / 1000);
    const pres = await presentation(now);
    const ahead = await cacheWith(now + 400, now); // liste saati 400 sn ileride (kütüphane varsayılanı 300 sn)
    const wide = { ...policy, freshness: { ...policy.freshness, max_clock_skew_sec: 600 } };
    const ok = (await verifyPresentation({ ...input(pres, now, ahead), policy: wide })).result;
    expect(ok.outcome, ok.failed_reason ?? "").toBe("ACCEPTED");
    const narrow = { ...policy, freshness: { ...policy.freshness, max_clock_skew_sec: 60 } };
    const near = await cacheWith(now + 200, now); // 200 sn ileride: varsayılan payın içinde, politikanın 60 sn'sinin dışında
    const r = (await verifyPresentation({ ...input(pres, now, near), policy: narrow })).result;
    expect(r).toMatchObject({ outcome: "REJECTED", failed_step: "D3" });
  });
});
