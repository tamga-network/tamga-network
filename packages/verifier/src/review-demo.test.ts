/**
 * ADR-0033 RV2: mağaza incelemesi DEMO imzacısının (`tamga-id-review`, güven listesinde I1) belgesi gerçek politikalarda (I2)
 * E1'de REDDEDİLİR; yalnız I1 kabul eden inceleme politikasında geçer. Sunum mdoc'tur (2026-11-04): inceleme politikası
 * `review-age-over-18`, doğrulayıcının kayıtlı 18 yaş kullanımı (`age-over-18-1`, yalnız `mso_mdoc`) ile aynı biçimde sorar. Güven listesi kaydı, kimlik servisinin kaydından
 * türetilip I1 yapılarak teste eklenir (kayıt listeye kurumun kimlik numarası girilince eklenecek — ADR-0024).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPrivateKey, randomBytes } from "node:crypto";
import { pemIssuerSigner } from "@tamga-network/sd-jwt";
import { issueMdoc, toPidMdocElements } from "@tamga-network/mdoc";
import { signStatusListToken, StatusBitstring, MIN_CAPACITY } from "@tamga-network/sd-jwt";
import {
  certFingerprintSha256Hex,
  computeIssuerId,
  loadTrustSourceFromDir,
  pemToDer,
  type ListTrustSource,
} from "@tamga-network/trust";
import { SoftwareKeyProvider, MemoryKeyStore, jwkToPoint, presentMdoc } from "@tamga-network/wallet-core";
import { verifyPresentation, MemoryStatusCache, type Policy } from "./index.js";
import { epochSeconds } from "@tamga-network/core";

const ROOT = resolve(import.meta.dirname, "../../..");
const PKI = resolve(ROOT, "ops/pki");
const DIST = resolve(ROOT, "apps/trust-publisher/dist-test"); // test listesi (test/fixtures/registry; npm run setup)
const ready =
  existsSync(resolve(PKI, "issuer-id-review.pkcs8.pem")) &&
  existsSync(resolve(PKI, "issuer-id-status.pkcs8.pem")) &&
  existsSync(resolve(DIST, "lotl.jws"));
const ISS = "https://id.tamga.network";
const VCT = "urn:tamga:id:IdentityAttestation:1";
const STATUS_URI = "https://id.tamga.network/status/0123456789abcdef";
const AUD = "x509_hash:test-review";
const RESPONSE_URI = "https://verify.test/response";
const NS = "tamga.id.1";

const policyWith = (min: "I1" | "I2"): Policy => ({
  policy_id: `age-${min}`,
  purpose: { "en-US": "test" },
  credentials: [
    {
      id: "identity",
      vct_values: [VCT],
      format: "mso_mdoc",
      namespace: NS,
      required_claims: ["age_over_18"],
      constraints: { age_over_18: true },
    },
  ],
  trust: { min_issuer_assurance: min, allowed_categories: ["IDENTITY"], require_recognition: true, state_code: "TR" },
  freshness: { max_status_token_age_sec: 6 * 3600, max_trust_age_sec: 86400 },
});

describe.skipIf(!ready)("ADR-0033: DEMO inceleme belgesi gerçek politikada geçmez", () => {
  let trust: ListTrustSource;
  let rootDer: Uint8Array[];
  const keys = new SoftwareKeyProvider(new MemoryKeyStore());
  beforeAll(async () => {
    const r = await loadTrustSourceFromDir(DIST);
    trust = r.trust;
    rootDer = [pemToDer(r.rootCertPem!)];
    // Güven listesine DEMO kaydını ekle: kimlik servisinin kaydı + ayrı sertifika + I1 (registry/pending'deki başvuruyla aynı)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const store = (trust as any).store;
    const idCert = pemToDer(readFileSync(resolve(PKI, "issuer-id.cert.pem"), "utf8"));
    const reviewCert = pemToDer(readFileSync(resolve(PKI, "issuer-id-review.cert.pem"), "utf8"));
    const idRec = store.issuers.get(computeIssuerId("TR", idCert));
    const reviewId = computeIssuerId("TR", reviewCert);
    const rec = {
      ...idRec,
      issuer_id: reviewId,
      slug: "tamga-id-review",
      legal_name: "Tamga Network — Identity Service, App Store Review (DEMO)",
      assurance: "I1",
      cert_fingerprint_sha256: certFingerprintSha256Hex(reviewCert),
    };
    store.issuers.set(reviewId, rec);
    store.issuer_schema_auth.set(reviewId, store.issuer_schema_auth.get(idRec.issuer_id));
    for (const [, v] of store.national)
      if (v.list.issuers.some((x: { slug: string }) => x.slug === "tamga-id")) v.list.issuers.push(rec);
  });

  async function present(now: number) {
    const reviewCertDer = pemToDer(readFileSync(resolve(PKI, "issuer-id-review.cert.pem"), "utf8"));
    const jwk = createPrivateKey(readFileSync(resolve(PKI, "issuer-id-review.pkcs8.pem"), "utf8")).export({
      format: "jwk",
    }) as { d: string };
    const ref = `r-${now}-${Math.random().toString(36).slice(2, 8)}`;
    const cnf = await keys.generate(ref);
    // kimlik servisinin kopya başına mdoc'u gibi (D-CRED-5): aynı alanlar, AB PID öğe adları, deviceKey = kopyanın anahtarı
    const issued = issueMdoc({
      docType: VCT,
      namespaces: {
        [NS]: toPidMdocElements({
          family_name: "App Reviewer",
          given_name: "DEMO",
          birthdate: "1990-01-01",
          nationalities: ["TR"],
          personal_administrative_number: "DEMO-TEST01",
          issuing_country: "TR",
          age_over_18: true,
        }),
      },
      deviceKeyRaw: jwkToPoint(cnf as never),
      issuerSk: new Uint8Array(Buffer.from(jwk.d, "base64url")),
      x5chain: [reviewCertDer],
      signed: now,
      validFrom: now,
      validUntil: now + 7 * 86400,
      randomBytes: (n) => new Uint8Array(randomBytes(n)),
      status: { idx: 3, uri: STATUS_URI },
    });
    const pres = await presentMdoc({
      mdocB64u: Buffer.from(issued.issuerSigned).toString("base64url"),
      docType: VCT,
      namespace: NS,
      disclose: ["age_over_18"],
      clientId: AUD,
      nonce: "n-review",
      responseUri: RESPONSE_URI,
      keys,
      keyRef: ref,
    });
    const st = await pemIssuerSigner(
      readFileSync(resolve(PKI, "issuer-id-status.pkcs8.pem"), "utf8"),
      readFileSync(resolve(PKI, "issuer-id-status.cert.pem"), "utf8"),
    );
    const cache = new MemoryStatusCache();
    cache.set(
      STATUS_URI,
      await signStatusListToken({
        signer: st,
        iss: ISS,
        uri: STATUS_URI,
        bitstring: new StatusBitstring(MIN_CAPACITY),
        iat: now,
        ttlSec: 3600,
      }),
      now,
    );
    return { pres, cache };
  }

  it("I2 isteyen gerçek politika (ör. age-over-18) → REJECTED, E1 (kurum seviyesi I1)", async () => {
    const now = Math.floor(Date.now() / 1000);
    const { pres, cache } = await present(now);
    const out = await verifyPresentation({
      rp: "none",
      presentation: pres,
      format: "mso_mdoc",
      responseUri: RESPONSE_URI,
      aud: AUD,
      nonce: "n-review",
      policy: policyWith("I2"),
      policyCredentialId: "identity",
      trust,
      statusCache: cache,
      rootCertsDer: rootDer,
      now: epochSeconds(now),
    });
    expect(out.result.outcome).toBe("REJECTED");
    expect(out.result.failed_step).toBe("E1");
  });

  it("I1 kabul eden inceleme politikası (review-age-over-18) → ACCEPTED", async () => {
    const now = Math.floor(Date.now() / 1000);
    const { pres, cache } = await present(now);
    const out = await verifyPresentation({
      rp: "none",
      presentation: pres,
      format: "mso_mdoc",
      responseUri: RESPONSE_URI,
      aud: AUD,
      nonce: "n-review",
      policy: policyWith("I1"),
      policyCredentialId: "identity",
      trust,
      statusCache: cache,
      rootCertsDer: rootDer,
      now: epochSeconds(now),
    });
    expect(out.result.outcome).toBe("ACCEPTED");
    expect(out.result.issuer?.assurance).toBe("I1");
  });
});
