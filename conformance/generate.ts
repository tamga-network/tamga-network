/**
 * conformance/generate.ts — vektör üreteci.
 * Girdi: apps/trust-publisher/dist-test (test listesi; imzalı), ops/pki (dev sertifikalar + issuer anahtarı — S-1),
 *        packages/schemas/dist/index.json (vct, content_hash).
 * Çıktı: conformance/vectors/trust/basic.json, conformance/vectors/sd-jwt/diploma-basic.json
 */
import { mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { X509Certificate } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { exportJWK, generateKeyPair } from "jose";
import { computeSchemaId, pemToDer, certFingerprintSha256Hex, x509HashClientId } from "@tamga-network/core";
import { loadTrustSet, ListTrustSource } from "@tamga-network/trust";
import { issueSdJwtVc, presentSdJwtVc, pemIssuerSigner, verifySdJwtVc } from "@tamga-network/sd-jwt";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "..");
const DIST = resolve(ROOT, "apps", "trust-publisher", "dist-test"); // test listesi (npm run trust:test-fixtures)
const PKI = resolve(ROOT, "ops", "pki");
const OUT = resolve(here, "vectors");
const rj = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const NOW_ISO = "2026-09-24T14:00:00Z";
const NOW = Math.floor(new Date(NOW_ISO).getTime() / 1000);

async function trustVectors() {
  const nationalListJws: Record<string, string> = {};
  for (const f of readdirSync(DIST)) {
    const m = /^tl-([a-z]{2})\.jws$/.exec(f);
    if (m) nationalListJws[m[1].toUpperCase()] = readFileSync(resolve(DIST, f), "utf8");
  }
  const keys = rj(resolve(DIST, "keys", "root-fingerprints.json"));
  const rootFps = (keys.lotl_signing_keys as Array<{ fingerprint_sha256: string }>).map((k) => k.fingerprint_sha256);
  const lotlJws = readFileSync(resolve(DIST, "lotl.jws"), "utf8");
  const anchorsJsonl = readFileSync(resolve(DIST, "anchors.jsonl"), "utf8");
  // Vektör içinde 'now' sabit; anchors tazelik sınırı vektör üretim anına göre geniş tutulur (anchorMaxAgeMs)
  const { store, report } = await loadTrustSet({
    lotlJws,
    nationalListJws,
    anchorsJsonl,
    rootFingerprints: rootFps,
    now: new Date(NOW_ISO),
    ...({ anchorMaxAgeMs: 365 * 86400_000 } as object),
  });
  const ts = new ListTrustSource(store, () => new Date(NOW_ISO));
  const tl = rj(resolve(DIST, "tl-tr.json"));
  const issuer = tl.issuers[0];
  const schemaD = computeSchemaId("urn:tamga:edu:DiplomaCredential:1");
  const schemaS = computeSchemaId("urn:tamga:edu:StudentCredential:1");
  const unknownSchema = computeSchemaId("urn:tamga:health:Nope:1");
  const sec = (s: string) => Math.floor(new Date(s).getTime() / 1000);
  const iatOk = sec("2026-10-01T00:00:00Z"),
    iatBefore = sec("2026-01-01T00:00:00Z");
  const cases = [
    {
      name: "issuer ACTIVE, iat geçerlilik içinde",
      q: { op: "isCredentialAcceptable", issuer_id: issuer.issuer_id, iat: iatOk },
    },
    { name: "iat valid_from öncesi", q: { op: "isCredentialAcceptable", issuer_id: issuer.issuer_id, iat: iatBefore } },
    { name: "kayıtsız issuer", q: { op: "isCredentialAcceptable", issuer_id: "0x" + "ab".repeat(32), iat: iatOk } },
    {
      name: "Diploma yetkisi",
      q: { op: "isCredentialSchemaAcceptable", issuer_id: issuer.issuer_id, schema_id: schemaD, iat: iatOk },
    },
    {
      name: "Student yetkisi",
      q: { op: "isCredentialSchemaAcceptable", issuer_id: issuer.issuer_id, schema_id: schemaS, iat: iatOk },
    },
    {
      name: "kayıtsız şema",
      q: { op: "isCredentialSchemaAcceptable", issuer_id: issuer.issuer_id, schema_id: unknownSchema, iat: iatOk },
    },
    { name: "TR tanır", q: { op: "isRecognizedBy", state: "TR", issuer_id: issuer.issuer_id } },
    { name: "AZ tanımaz (rezerve)", q: { op: "isRecognizedBy", state: "AZ", issuer_id: issuer.issuer_id } },
    { name: "Diploma content_hash", q: { op: "schemaContentHash", schema_id: schemaD } },
    {
      name: "wallet provider anahtarı",
      q: { op: "isWalletProviderKey", fingerprint: keys.lotl_signing_keys[0].fingerprint_sha256 },
    },
  ].map((c) => ({ ...c, expect: run(ts, c.q) }));
  const vec = {
    vector: "trust/basic",
    version: 1,
    generated_at: new Date().toISOString(),
    now: NOW_ISO,
    note: "Kişisel veri yok. anchors tazelik sınırı koşucuda 365 gün (vektör zamanı sabit).",
    input: {
      lotl_jws: lotlJws,
      national_lists_jws: nationalListJws,
      anchors_jsonl: anchorsJsonl,
      root_fingerprints: rootFps,
      anchor_max_age_ms: 365 * 86400_000,
    },
    expect_report: { healthy: report.healthy, lotlVersion: report.lotlVersion },
    cases,
  };
  mkdirSync(resolve(OUT, "trust"), { recursive: true });
  writeFileSync(resolve(OUT, "trust", "basic.json"), JSON.stringify(vec, null, 2) + "\n");
  return cases.length;
}
export function run(ts: ListTrustSource, q: Record<string, unknown>): unknown {
  switch (q.op) {
    case "isCredentialAcceptable":
      return ts.isCredentialAcceptable(q.issuer_id as string, q.iat as number);
    case "isCredentialSchemaAcceptable":
      return ts.isCredentialSchemaAcceptable(q.issuer_id as string, q.schema_id as string, q.iat as number);
    case "isRecognizedBy":
      return ts.isRecognizedBy(q.state as string, q.issuer_id as string);
    case "schemaContentHash":
      return ts.schemaContentHash(q.schema_id as string);
    case "isWalletProviderKey":
      return ts.isWalletProviderKey(q.fingerprint as string);
    default:
      throw new Error(`bilinmeyen op ${String(q.op)}`);
  }
}

async function sdJwtVectors() {
  const leafPem = readFileSync(resolve(PKI, "issuer-bilgi.cert.pem"), "utf8");
  const keyPem = readFileSync(resolve(PKI, "issuer-bilgi.pkcs8.pem"), "utf8");
  const rootPem = readFileSync(resolve(PKI, "root-ca.cert.pem"), "utf8");
  const signer = await pemIssuerSigner(keyPem, leafPem);
  // Belge, imza sertifikası geçerliyken verilmiş olmalı (A3): vektör zamanı sabit tarihten, sertifika daha yeniyse ondan 2 gün sonrası
  const leafFrom = Math.floor(new Date(new X509Certificate(leafPem).validFrom).getTime() / 1000);
  const SD_NOW = Math.max(NOW, leafFrom + 2 * 86400);
  const SD_NOW_ISO = new Date(SD_NOW * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
  const schemas = rj(resolve(ROOT, "packages", "schemas", "dist", "index.json")) as Array<{
    vct: string;
    content_hash: string;
  }>;
  const diploma = schemas.find((s) => s.vct === "urn:tamga:edu:DiplomaCredential:1")!;
  const hk = await generateKeyPair("ES256", { extractable: true });
  const holderJwk = await exportJWK(hk.publicKey);
  // ADR-0034: doğrulayıcının OpenID4VP istemci kimliği x509_hash (rp-verify erişim sertifikasından)
  const AUD = x509HashClientId(pemToDer(readFileSync(resolve(ROOT, "ops", "pki", "rp-verify.cert.pem"), "utf8"))),
    NONCE = "conf-nonce-0001";
  const issued = await issueSdJwtVc({
    signer,
    iss: "https://issuer.tamga.network/bilgi",
    vct: diploma.vct,
    vctIntegrity: diploma.content_hash,
    iat: SD_NOW - 86400,
    cnfJwk: holderJwk,
    status: { status_list: { idx: 48213, uri: "https://status.tamga.network/3f9a2c" } },
    claims: {
      family_name: "Örnek",
      given_name: "Vektör",
      birth_date: "2001-01-01",
      awarding_body_name: { "tr-TR": "İstanbul Bilgi Üniversitesi" },
      awarding_body_id: "TR-UNI-BILGI",
      awarding_body_country: "TR",
      qualification_title: { "tr-TR": "Bilgisayar Mühendisliği Lisans" },
      eqf_level: 6,
      isced_f_code: "0613",
      awarding_date: "2026-06-20",
      is_graduate: true,
      grade: "3.00",
    },
    sdPolicy: { birth_date: "always", grade: "always", family_name: "always", given_name: "always" },
  });
  const presentation = await presentSdJwtVc({
    combined: issued.combined,
    discloseClaims: ["is_graduate", "eqf_level", "family_name", "given_name"],
    holderKey: hk.privateKey,
    aud: AUD,
    nonce: NONCE,
    iat: SD_NOW,
  });
  const verify = await verifySdJwtVc(presentation, {
    aud: AUD,
    nonce: NONCE,
    stateCode: "TR",
    now: SD_NOW,
    rootCertsDer: [pemToDer(rootPem)],
  });
  if (!verify.ok) throw new Error("üretilen vektör doğrulanamadı: " + verify.reason);
  const vec = {
    vector: "sd-jwt/diploma-basic",
    version: 1,
    generated_at: new Date().toISOString(),
    now: SD_NOW_ISO,
    note: "Sahte kişi verisi. Özel anahtar yok. root_cert_pem = TR National Root CA (geliştirme), leaf = İstanbul Bilgi Üniversitesi.",
    root_cert_pem: rootPem,
    leaf_fingerprint_sha256: certFingerprintSha256Hex(pemToDer(leafPem)),
    holder_public_jwk: holderJwk,
    issued_combined: issued.combined,
    presentation,
    aud: AUD,
    nonce: NONCE,
    state_code: "TR",
    expect: {
      ok: true,
      issuer_id: verify.issuerId,
      disclosed_claim_names: [...verify.disclosedClaimNames].sort(),
      hidden_claims: ["grade", "birth_date"],
      vct: diploma.vct,
      checks: ["A1", "A2", "A3", "A4", "A5", "A6"],
    },
    negative: [
      { name: "KB-JWT yok", input: issued.combined, expect_failed_step: "A1" },
      { name: "yanlış nonce", input: presentation, nonce: "wrong", expect_failed_step: "A6" },
      { name: "iat penceresi dışı (+301s)", input: presentation, now_offset_sec: 301, expect_failed_step: "A6" },
      {
        name: "sunulmayan disclosure eklenmiş (eşleşmeyen digest)",
        input: (() => {
          const p = presentation.split("~");
          p.splice(
            1,
            0,
            Buffer.from(JSON.stringify(["c2FsdHNhbHRzYWx0c2FsdA", "grade", "4.00"])).toString("base64url"),
          );
          return p.join("~");
        })(),
        expect_failed_step: "A5",
      },
    ],
  };
  mkdirSync(resolve(OUT, "sd-jwt"), { recursive: true });
  writeFileSync(resolve(OUT, "sd-jwt", "diploma-basic.json"), JSON.stringify(vec, null, 2) + "\n");
  return 1 + vec.negative.length;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  (async () => {
    if (!existsSync(resolve(DIST, "lotl.jws"))) throw new Error("önce npm run setup");
    const t = await trustVectors();
    const s = await sdJwtVectors();
    writeFileSync(resolve(OUT, "VERSION"), "2\n"); // 2: ADR-0034 — RP kaydında dns_name, client_id x509_hash
    console.log(JSON.stringify({ trust_cases: t, sd_jwt_cases: s, out: OUT }, null, 2));
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
