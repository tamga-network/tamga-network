/**
 * @tamga-network/verifier: politika → DCQL, AP6, kanonik hat T0 + A–E — dev PKI + trust-publisher dist (ListTrustSource) ile.
 * Belge @tamga-network/sd-jwt ile ihraç edilir, sunum @tamga-network/wallet-core ile (KB-JWT, saf TS), status token @tamga-network/sd-jwt ile.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { issueSdJwtVc, pemIssuerSigner } from "@tamga-network/sd-jwt";
import { signStatusListToken, StatusBitstring, MIN_CAPACITY, StatusValue } from "@tamga-network/sd-jwt";
import { loadTrustSourceFromDir, pemToDer, x509HashClientId, type ListTrustSource } from "@tamga-network/trust";
import { SoftwareKeyProvider, MemoryKeyStore, presentSdJwt } from "@tamga-network/wallet-core";
import {
  verifyPresentation,
  dcqlFromPolicy,
  policyScopeViolations,
  registrationScopesFor,
  MemoryStatusCache,
  createPresentationRequest,
  decryptResponse,
  pemRpSigner,
  type Policy,
} from "./index.js";
import { encryptJwe, utf8 } from "@tamga-network/wallet-core";

const ROOT = resolve(import.meta.dirname, "../../..");
const PKI = resolve(ROOT, "ops/pki");
const DIST = resolve(ROOT, "apps/trust-publisher/dist");
const ready = existsSync(resolve(PKI, "issuer-bilgi.pkcs8.pem")) && existsSync(resolve(DIST, "lotl.jws"));
const AUD = existsSync(resolve(PKI, "rp-verify.cert.pem"))
  ? x509HashClientId(pemToDer(readFileSync(resolve(PKI, "rp-verify.cert.pem"), "utf8")))
  : ""; // ADR-0034: x509_hash
const ISS = "https://issuer.tamga.network/bilgi";
const VCT = "urn:tamga:edu:DiplomaCredential:1";
const policy: Policy = {
  policy_id: "t",
  purpose: { "tr-TR": "test" },
  credentials: [
    {
      id: "diploma",
      vct_values: [VCT],
      required_claims: ["is_graduate", "eqf_level", "qualification_title", "awarding_body_name"],
      constraints: { is_graduate: true, eqf_level: { min: 6 } },
    },
  ],
  trust: { min_issuer_assurance: "I2", allowed_categories: ["EDUCATION"], require_recognition: true, state_code: "TR" },
  freshness: { max_status_token_age_sec: 6 * 3600, max_trust_age_sec: 86400 },
};

describe("policy", () => {
  it("DCQL: kısıt eşitlik → values; aralık → yalnız path", () => {
    const q = dcqlFromPolicy(policy);
    expect(q.credentials[0].claims.find((c) => c.path[0] === "is_graduate")?.values).toEqual([true]);
    expect(q.credentials[0].claims.find((c) => c.path[0] === "eqf_level")?.values).toBeUndefined();
  });
});

describe.skipIf(!ready)("verifyPresentation (dev PKI + dist)", () => {
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
    awarding_body_name: { "tr-TR": "İstanbul Bilgi Üniversitesi" },
    awarding_body_id: "bilgi",
    awarding_body_country: "TR",
    qualification_title: { "tr-TR": "Bilgisayar Mühendisliği Lisans" },
    eqf_level: 6,
    isced_f_code: "0613",
    awarding_date: "2025-06-30",
    grade: "3.4",
    is_graduate: true,
    graduated_before: 2026,
  };
  beforeAll(async () => {
    const r = await loadTrustSourceFromDir(DIST);
    trust = r.trust;
    rootDer = [pemToDer(r.rootCertPem!)];
  });

  async function issue(idx: number, now: number) {
    const signer = await pemIssuerSigner(
      readFileSync(resolve(PKI, "issuer-bilgi.pkcs8.pem"), "utf8"),
      readFileSync(resolve(PKI, "issuer-bilgi.cert.pem"), "utf8"),
    );
    const ref = `k${idx}-${now}-${Math.random().toString(36).slice(2, 8)}`;
    const cnf = await keys.generate(ref);
    const r = await issueSdJwtVc({
      signer,
      iss: ISS,
      vct: VCT,
      vctIntegrity: integ,
      iat: now,
      cnfJwk: cnf as never,
      status: { status_list: { idx, uri: STATUS_URI } },
      claims,
      sdPolicy: { grade: "always", thesis_title: "always" },
    });
    return { combined: r.combined, ref };
  }
  async function statusToken(now: number, revoked: number[] = [], key = "issuer-bilgi-status") {
    const signer = await pemIssuerSigner(
      readFileSync(resolve(PKI, `${key}.pkcs8.pem`), "utf8"),
      readFileSync(resolve(PKI, `${key}.cert.pem`), "utf8"),
    );
    const bs = new StatusBitstring(MIN_CAPACITY);
    for (const i of revoked) bs.set(i, StatusValue.INVALID);
    return signStatusListToken({ signer, iss: ISS, uri: STATUS_URI, bitstring: bs, iat: now, ttlSec: 3600 });
  }

  it("D3: iptal listesini kurumun kayıtlı iptal anahtarı dışında bir anahtar imzalamışsa RED (S11)", async () => {
    const now = Math.floor(Date.now() / 1000);
    const { combined, ref } = await issue(12, now);
    const cache = new MemoryStatusCache();
    cache.set(STATUS_URI, await statusToken(now, [], "issuer-bilgi"), now); // credential anahtarı ≠ iptal anahtarı
    const pres = await presentSdJwt({
      combined,
      discloseClaims: ["is_graduate", "eqf_level", "qualification_title", "awarding_body_name"],
      keys,
      keyRef: ref,
      aud: AUD,
      nonce: "n-d3",
      iat: now,
    });
    const r = await verifyPresentation({
      presentation: pres,
      aud: AUD,
      nonce: "n-d3",
      policy,
      policyCredentialId: "diploma",
      trust,
      statusCache: cache,
      rootCertsDer: rootDer,
      now,
    });
    expect(r.result.outcome).toBe("REJECTED");
    expect(r.result.failed_step).toBe("D3");
  });
  it("ACCEPTED: tüm adımlar; claim değerleri sonuç nesnesinde yok (AP3); idx yok (AP4)", async () => {
    const now = Math.floor(Date.now() / 1000);
    const { combined, ref } = await issue(11, now);
    const cache = new MemoryStatusCache();
    cache.set(STATUS_URI, await statusToken(now), now);
    const pres = await presentSdJwt({
      combined,
      discloseClaims: ["is_graduate", "eqf_level", "qualification_title", "awarding_body_name"],
      keys,
      keyRef: ref,
      aud: AUD,
      nonce: "n1",
      iat: now,
    });
    const out = await verifyPresentation({
      presentation: pres,
      aud: AUD,
      nonce: "n1",
      policy,
      policyCredentialId: "diploma",
      trust,
      statusCache: cache,
      rootCertsDer: rootDer,
      rp: trust.relyingParty(AUD),
      now,
    });
    expect(out.result.outcome).toBe("ACCEPTED");
    expect(out.result.failed_step).toBeNull();
    expect(out.result.checks_performed).toEqual(
      expect.arrayContaining([
        "T0",
        "A3b",
        "A3d",
        "A6",
        "B4",
        "B6",
        "C1",
        "C2",
        "C3",
        "C4",
        "D3",
        "D4",
        "D6",
        "E1",
        "E2",
        "E3",
        "E4",
      ]),
    );
    expect(out.result.checks_skipped).toEqual(expect.arrayContaining(["A3c", "B5", "D5"]));
    expect(out.result.status.value).toBe("VALID");
    expect(out.result.issuer?.assurance).toBe("I2");
    expect(JSON.stringify(out.result)).not.toContain("Yılmaz");
    expect(JSON.stringify(out.result)).not.toMatch(/"idx"/);
    expect(out.claims?.eqf_level).toBe(6);
    expect(out.claims?.grade).toBeUndefined();
  });

  it("REJECTED: iptal edilmiş (D6); scope aşımı (E3); kısıt (E2); yanlış nonce (A6)", async () => {
    const now = Math.floor(Date.now() / 1000);
    const { combined, ref } = await issue(12, now);
    const rp = trust.relyingParty(AUD);
    const cacheRevoked = new MemoryStatusCache();
    cacheRevoked.set(STATUS_URI, await statusToken(now, [12]), now);
    const pres = await presentSdJwt({
      combined,
      discloseClaims: ["is_graduate", "eqf_level", "qualification_title", "awarding_body_name"],
      keys,
      keyRef: ref,
      aud: AUD,
      nonce: "n2",
      iat: now,
    });
    const r1 = await verifyPresentation({
      presentation: pres,
      aud: AUD,
      nonce: "n2",
      policy,
      policyCredentialId: "diploma",
      trust,
      statusCache: cacheRevoked,
      rootCertsDer: rootDer,
      rp,
      now,
    });
    expect(r1.result.outcome).toBe("REJECTED");
    expect(r1.result.failed_step).toBe("D6");
    expect(r1.result.status.value).toBe("INVALID");
    expect(r1.claims).toBeNull();
    // kök sertifika yapılandırılmamışsa zincir sessizce atlanmaz: DOĞRULANAMADI (fail-closed)
    const r0 = await verifyPresentation({
      presentation: pres,
      aud: AUD,
      nonce: "n2",
      policy,
      policyCredentialId: "diploma",
      trust,
      statusCache: cacheRevoked,
      rootCertsDer: [],
      rp,
      now,
    });
    expect(r0.result.outcome).toBe("INDETERMINATE");
    expect(r0.result.failed_step).toBe("A3");
    const cache = new MemoryStatusCache();
    cache.set(STATUS_URI, await statusToken(now), now);
    const over = await presentSdJwt({
      combined,
      discloseClaims: ["is_graduate", "eqf_level", "qualification_title", "awarding_body_name", "grade"],
      keys,
      keyRef: ref,
      aud: AUD,
      nonce: "n3",
      iat: now,
    });
    const r2 = await verifyPresentation({
      presentation: over,
      aud: AUD,
      nonce: "n3",
      policy,
      policyCredentialId: "diploma",
      trust,
      statusCache: cache,
      rootCertsDer: rootDer,
      rp,
      now,
    });
    expect(r2.result.failed_step).toBe("E3");
    const strict = { ...policy, credentials: [{ ...policy.credentials[0], constraints: { eqf_level: { min: 7 } } }] };
    const r3 = await verifyPresentation({
      presentation: pres,
      aud: AUD,
      nonce: "n2",
      policy: strict,
      policyCredentialId: "diploma",
      trust,
      statusCache: cache,
      rootCertsDer: rootDer,
      rp,
      now,
    });
    expect(r3.result.failed_step).toBe("E2");
    const r4 = await verifyPresentation({
      presentation: pres,
      aud: AUD,
      nonce: "WRONG",
      policy,
      policyCredentialId: "diploma",
      trust,
      statusCache: cache,
      rootCertsDer: rootDer,
      rp,
      now,
    });
    expect(r4.result.failed_step).toBe("A6");
  });

  it("INDETERMINATE: status önbellekte yok (D2) ve bayat token (D4) — REJECTED değil (AP2)", async () => {
    const now = Math.floor(Date.now() / 1000);
    const { combined, ref } = await issue(13, now);
    const pres = await presentSdJwt({
      combined,
      discloseClaims: ["is_graduate", "eqf_level", "qualification_title", "awarding_body_name"],
      keys,
      keyRef: ref,
      aud: AUD,
      nonce: "n5",
      iat: now,
    });
    const r1 = await verifyPresentation({
      presentation: pres,
      aud: AUD,
      nonce: "n5",
      policy,
      policyCredentialId: "diploma",
      trust,
      statusCache: new MemoryStatusCache(),
      rootCertsDer: rootDer,
      rp: trust.relyingParty(AUD),
      now,
    });
    expect(r1.result.outcome).toBe("INDETERMINATE");
    expect(r1.result.indeterminate_reason).toBe("STATUS_UNREACHABLE");
    expect(r1.result.failed_step).toBe("D2");
    const stale = new MemoryStatusCache();
    stale.set(STATUS_URI, await statusToken(now - 5000), now - 5000);
    const r2 = await verifyPresentation({
      presentation: pres,
      aud: AUD,
      nonce: "n5",
      policy: { ...policy, freshness: { max_status_token_age_sec: 60, max_trust_age_sec: 86400 } },
      policyCredentialId: "diploma",
      trust,
      statusCache: stale,
      rootCertsDer: rootDer,
      rp: trust.relyingParty(AUD),
      now,
    });
    expect(r2.result.indeterminate_reason).toBe("STATUS_STALE");
    // ttl×2 aşımı (verifyStatusListToken "D4:" fırlatır) da INDETERMINATE/D4 olmalı — REJECTED/D3 değil
    const veryStale = new MemoryStatusCache();
    veryStale.set(STATUS_URI, await statusToken(now - 3600 * 3), now - 3600 * 3);
    const r3 = await verifyPresentation({
      presentation: pres,
      aud: AUD,
      nonce: "n5",
      policy,
      policyCredentialId: "diploma",
      trust,
      statusCache: veryStale,
      rootCertsDer: rootDer,
      rp: trust.relyingParty(AUD),
      now,
    });
    expect(r3.result.outcome).toBe("INDETERMINATE");
    expect(r3.result.failed_step).toBe("D4");
    expect(r3.result.indeterminate_reason).toBe("STATUS_STALE");
  });

  it("D5: çapadan eski token — önbellek çapadan önce/tolerans içinde çekildiyse INDETERMINATE, açıkça sonra çekildiyse REJECTED; bozuk tarih INDETERMINATE; kayma toleransı (K3)", async () => {
    const now = Math.floor(Date.now() / 1000);
    const { combined, ref } = await issue(14, now);
    const pres = await presentSdJwt({
      combined,
      discloseClaims: ["is_graduate", "eqf_level", "qualification_title", "awarding_body_name"],
      keys,
      keyRef: ref,
      aud: AUD,
      nonce: "n6",
      iat: now,
    });
    // yeni sürüm çapası 300 sn önce yayımlandı (varsayılan saat toleransı 120 sn)
    const anchoredAt = (published_at: string): ListTrustSource => {
      const t: ListTrustSource = Object.create(trust);
      t.statusAnchor = () =>
        ({ content_hash: "0x" + "ab".repeat(32), published_at, version: 7, list_uri: STATUS_URI }) as ReturnType<
          ListTrustSource["statusAnchor"]
        >;
      return t;
    };
    const ANCHOR = new Date((now - 300) * 1000).toISOString();
    const run = async (tokIat: number, fetchedAt: number, published = ANCHOR) => {
      const c = new MemoryStatusCache();
      c.set(STATUS_URI, await statusToken(tokIat), fetchedAt);
      return verifyPresentation({
        presentation: pres,
        aud: AUD,
        nonce: "n6",
        policy,
        policyCredentialId: "diploma",
        trust: anchoredAt(published),
        statusCache: c,
        rootCertsDer: rootDer,
        rp: trust.relyingParty(AUD),
        now,
      });
    };
    // token çapadan çok eski (900 sn önce):
    const lag = await run(now - 900, now - 400); // önbellek çapadan önce → ön çekim gecikmesi
    expect(lag.result.outcome).toBe("INDETERMINATE");
    expect(lag.result.failed_step).toBe("D5");
    expect(lag.result.indeterminate_reason).toBe("STATUS_STALE");
    const skewWin = await run(now - 900, now - 250); // çapadan 50 sn sonra ama tolerans içinde → saat kayması olabilir
    expect(skewWin.result.outcome).toBe("INDETERMINATE");
    const rollback = await run(now - 900, now - 10); // çapadan açıkça sonra çekildi, yine eski → geri sarma
    expect(rollback.result.outcome).toBe("REJECTED");
    expect(rollback.result.failed_step).toBe("D5");
    // token çapadan yalnızca 60 sn eski → tolerans içinde (issuer saati geride olabilir) → RED değil
    const nearAnchor = await run(now - 360, now - 10);
    expect(nearAnchor.result.outcome).not.toBe("REJECTED");
    // Y2: aynı son yol parçası, başka listenin çapası (list_uri farklı) → bu listenin çapası sayılmaz, RED üretmez
    const other: ListTrustSource = Object.create(trust);
    other.statusAnchor = () =>
      ({
        content_hash: "0x" + "cd".repeat(32),
        published_at: ANCHOR,
        version: 9,
        list_uri: "https://status.baska-kurum.example/abcdef0123456789",
      }) as ReturnType<ListTrustSource["statusAnchor"]>;
    const c2 = new MemoryStatusCache();
    c2.set(STATUS_URI, await statusToken(now - 900), now - 10);
    const cross = await verifyPresentation({
      presentation: pres,
      aud: AUD,
      nonce: "n6",
      policy,
      policyCredentialId: "diploma",
      trust: other,
      statusCache: c2,
      rootCertsDer: rootDer,
      rp: trust.relyingParty(AUD),
      now,
    });
    expect(cross.result.outcome).not.toBe("REJECTED");
    // bozuk çapa tarihi → kontrol atlanmaz, INDETERMINATE (fail-closed)
    const broken = await run(now - 900, now - 10, "bozuk-tarih");
    expect(broken.result.outcome).toBe("INDETERMINATE");
    expect(broken.result.failed_step).toBe("D5");
  });

  it("AP6: politika RP scope'unu aşarsa reddedilir; istek nesnesi + JWE gidiş-dönüş", async () => {
    const rp = trust.relyingParty(AUD)!;
    expect(policyScopeViolations(policy, rp)).toEqual([]);
    expect(
      policyScopeViolations(
        { ...policy, credentials: [{ ...policy.credentials[0], required_claims: ["grade"] }] },
        rp,
      )[0],
    ).toContain("grade");
    const signer = await pemRpSigner(
      readFileSync(resolve(PKI, "rp-verify.pkcs8.pem"), "utf8"),
      readFileSync(resolve(PKI, "rp-verify.cert.pem"), "utf8"),
    );
    const pr = await createPresentationRequest({
      signer,
      dcql: dcqlFromPolicy(policy),
      responseUri: "https://verify.tamga.network/vp/response",
      requestUriBase: "https://verify.tamga.network/vp/req",
    });
    expect(pr.qrPayload.startsWith("openid4vp://?client_id=")).toBe(true);
    const jwe = encryptJwe(
      utf8(JSON.stringify({ vp_token: { diploma: ["x~"] }, state: pr.state })),
      pr.encPublicJwk as never,
    );
    const dec = await decryptResponse(jwe, pr.encPrivateKey);
    expect(dec.state).toBe(pr.state);
    expect(dec.vp_token.diploma[0]).toBe("x~");
  });

  it("ADR-0026: kullanım seçimi + verifier_info (registration_cert, credential_ids)", async () => {
    const rp = trust.relyingParty(AUD)!;
    const picks = registrationScopesFor(policy, rp);
    expect(picks).toHaveLength(policy.credentials.length);
    expect(picks[0].queryId).toBe(policy.credentials[0].id);
    expect(
      registrationScopesFor({ ...policy, credentials: [{ ...policy.credentials[0], required_claims: ["grade"] }] }, rp),
    ).toEqual([]);
    const signer = await pemRpSigner(
      readFileSync(resolve(PKI, "rp-verify.pkcs8.pem"), "utf8"),
      readFileSync(resolve(PKI, "rp-verify.cert.pem"), "utf8"),
    );
    const pr = await createPresentationRequest({
      signer,
      dcql: dcqlFromPolicy(policy),
      responseUri: "https://verify.tamga.network/vp/response",
      requestUriBase: "https://verify.tamga.network/vp/req",
      registrationCerts: [{ jwt: "a.b.c", credentialIds: ["diploma"] }],
    });
    const payload = JSON.parse(Buffer.from(pr.requestJwt.split(".")[1], "base64url").toString("utf8"));
    expect(payload.verifier_info).toEqual([
      { format: "registration_cert", data: "a.b.c", credential_ids: ["diploma"] },
    ]);
  });
});
