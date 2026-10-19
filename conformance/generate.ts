/**
 * conformance/generate.ts — vektör üreteci.
 * Girdi: apps/trust-publisher/dist-test (test listesi; imzalı), ops/pki (dev sertifikalar + issuer anahtarı — S-1),
 *        packages/schemas/dist/index.json (vct, content_hash).
 * Çıktı: conformance/vectors/trust/basic.json, conformance/vectors/sd-jwt/diploma-basic.json,
 *        conformance/vectors/sd-jwt/identity-pid-names.json (ADR-0045),
 *        conformance/vectors/status-list/jwt-cwt.json (ADR-0048: bits 1/2, aynı listenin JWT ve CWT gösterimi)
 */
import { mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { X509Certificate } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { exportJWK, generateKeyPair } from "jose";
import {
  computeSchemaId,
  pemToDer,
  certFingerprintSha256Hex,
  x509HashClientId,
  epochSeconds,
} from "@tamga-network/core";
import { loadTrustSet, ListTrustSource } from "@tamga-network/trust";
import {
  issueSdJwtVc,
  presentSdJwtVc,
  pemIssuerSigner,
  verifySdJwtVc,
  MIN_CAPACITY,
  StatusBitstring,
  StatusValue,
  signStatusListCwt,
  signStatusListToken,
  verifyStatusListCwt,
  verifyStatusListToken,
} from "@tamga-network/sd-jwt";

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
  const SD_NOW = epochSeconds(Math.max(NOW, leafFrom + 2 * 86400));
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
    iss: "https://issuer.tamga.network/example-university",
    vct: diploma.vct,
    vctIntegrity: diploma.content_hash,
    iat: SD_NOW - 86400,
    cnfJwk: holderJwk,
    status: { status_list: { idx: 48213, uri: "https://status.tamga.network/3f9a2c" } },
    claims: {
      family_name: "Örnek",
      given_name: "Vektör",
      birth_date: "2001-01-01",
      awarding_body_name: { "tr-TR": "Örnek Üniversitesi" },
      awarding_body_id: "TR-UNI-EXAMPLE",
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
    acceptLegacyVcSdJwtTyp: false, // Tamga türü: yalnız dc+sd-jwt (C13)
  });
  if (!verify.ok) throw new Error("üretilen vektör doğrulanamadı: " + verify.reason);
  // Olumsuz A7: süresi geçmiş belge (exp < now); KB-JWT taze, yalnız süre başarısız olur
  const expired = await issueSdJwtVc({
    signer,
    iss: "https://issuer.tamga.network/example-university",
    vct: diploma.vct,
    vctIntegrity: diploma.content_hash,
    iat: SD_NOW - 86400,
    exp: SD_NOW - 3600,
    cnfJwk: holderJwk,
    claims: { is_graduate: true, eqf_level: 6, awarding_date: "2026-06-20" },
    sdPolicy: {},
  });
  const expiredPresentation = await presentSdJwtVc({
    combined: expired.combined,
    discloseClaims: ["is_graduate"],
    holderKey: hk.privateKey,
    aud: AUD,
    nonce: NONCE,
    iat: SD_NOW,
  });
  const vec = {
    vector: "sd-jwt/diploma-basic",
    version: 1,
    generated_at: new Date().toISOString(),
    now: SD_NOW_ISO,
    note: "Sahte kişi verisi. Özel anahtar yok. root_cert_pem = TR National Root CA (geliştirme), leaf = örnek kurum (Ornek Universitesi, geliştirme PKI'sı).",
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
      checks: ["A1", "A2", "A3", "A4", "A5", "A6", "A7"],
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
      { name: "süresi geçmiş belge (exp)", input: expiredPresentation, expect_failed_step: "A7" },
    ],
  };
  mkdirSync(resolve(OUT, "sd-jwt"), { recursive: true });
  writeFileSync(resolve(OUT, "sd-jwt", "diploma-basic.json"), JSON.stringify(vec, null, 2) + "\n");
  return 1 + vec.negative.length;
}

/**
 * ADR-0045 — kimlik belgesi AB PID adlarıyla (Uygulama Tüzüğü (AB) 2026/1731): `birthdate`, `nationalities` dizisi (her öğe ayrı
 * disclosure, RFC 9901 §4.2.2). Sahte kişi; kimlik numarası sağlamayı geçmez.
 */
async function identityVectors() {
  const leafPem = readFileSync(resolve(PKI, "issuer-id.cert.pem"), "utf8");
  const keyPem = readFileSync(resolve(PKI, "issuer-id.pkcs8.pem"), "utf8");
  const rootPem = readFileSync(resolve(PKI, "root-ca.cert.pem"), "utf8");
  const signer = await pemIssuerSigner(keyPem, leafPem);
  const leafFrom = Math.floor(new Date(new X509Certificate(leafPem).validFrom).getTime() / 1000);
  const SD_NOW = epochSeconds(Math.max(NOW, leafFrom + 2 * 86400));
  const SD_NOW_ISO = new Date(SD_NOW * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
  const schemas = rj(resolve(ROOT, "packages", "schemas", "dist", "index.json")) as Array<{
    vct: string;
    content_hash: string;
  }>;
  const identity = schemas.find((s) => s.vct === "urn:tamga:id:IdentityAttestation:1")!;
  const hk = await generateKeyPair("ES256", { extractable: true });
  const holderJwk = await exportJWK(hk.publicKey);
  const AUD = x509HashClientId(pemToDer(readFileSync(resolve(ROOT, "ops", "pki", "rp-verify.cert.pem"), "utf8"))),
    NONCE = "conf-nonce-0002";
  const claims = {
    family_name: "Örnek",
    given_name: "Vektör",
    birthdate: "2001-01-01",
    nationalities: ["TR", "AZ"],
    personal_administrative_number: "10000000147",
    document_type: "ID_CARD",
    document_number_hash: "sha256-conformance",
    issuing_country: "TR",
    document_chip_verified: false,
    verification_method: "remote-document-liveness-face",
    age_over_18: true,
  };
  const issued = await issueSdJwtVc({
    signer,
    iss: "https://id.tamga.network",
    vct: identity.vct,
    vctIntegrity: identity.content_hash,
    iat: SD_NOW - 86400,
    exp: SD_NOW + 365 * 86400,
    cnfJwk: holderJwk,
    status: { status_list: { idx: 1207, uri: "https://id.tamga.network/status/conformance" } },
    claims,
    sdPolicy: Object.fromEntries(Object.keys(claims).map((k) => [k, "always" as const])),
    arrayElementSd: ["nationalities"],
  });
  const presentation = await presentSdJwtVc({
    combined: issued.combined,
    discloseClaims: ["birthdate", "nationalities[1]"],
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
    acceptLegacyVcSdJwtTyp: false, // Tamga türü: yalnız dc+sd-jwt (C13)
  });
  if (!verify.ok) throw new Error("üretilen kimlik vektörü doğrulanamadı: " + verify.reason);
  const vec = {
    vector: "sd-jwt/identity-pid-names",
    version: 1,
    generated_at: new Date().toISOString(),
    now: SD_NOW_ISO,
    note: "ADR-0045: Tamga kimlik belgesi AB PID adlarıyla (birthdate, nationalities[] — her öğe ayrı disclosure). Sahte kişi verisi; özel anahtar yok.",
    root_cert_pem: rootPem,
    holder_public_jwk: holderJwk,
    issued_combined: issued.combined,
    presentation,
    aud: AUD,
    nonce: NONCE,
    state_code: "TR",
    expect: {
      ok: true,
      issuer_id: verify.issuerId,
      vct: identity.vct,
      disclosed_claim_names: [...verify.disclosedClaimNames].sort(),
      claims: { birthdate: "2001-01-01", nationalities: ["AZ"] },
      hidden_claims: ["given_name", "family_name", "personal_administrative_number", "birth_date", "nationality"],
    },
  };
  mkdirSync(resolve(OUT, "sd-jwt"), { recursive: true });
  writeFileSync(resolve(OUT, "sd-jwt", "identity-pid-names.json"), JSON.stringify(vec, null, 2) + "\n");
  return 1;
}

/**
 * ADR-0048: iptal listesinin iki gösterimi. Kimlik servisinin listesi `bits = 1` (yalnız geçerli / iptal), kurum listesi `bits = 2`
 * (diplomada askı). Her liste JWT (`statuslist+jwt`) ve CWT (`application/statuslist+cwt`) olarak ayrı adreslerde, aynı bitler,
 * aynı imzacı ve aynı `iat`/`exp`/`ttl` ile. Taslağın bits = 1 örneği (`[0xb9, 0xa3]`) sıkıştırılmış hâliyle de verilir.
 */
async function statusListVectors() {
  const certPem = readFileSync(resolve(PKI, "issuer-id-status.cert.pem"), "utf8");
  const keyPem = readFileSync(resolve(PKI, "issuer-id-status.pkcs8.pem"), "utf8");
  const signer = await pemIssuerSigner(keyPem, certPem);
  const from = Math.floor(new Date(new X509Certificate(certPem).validFrom).getTime() / 1000);
  const ST_NOW = epochSeconds(Math.max(NOW, from + 2 * 86400));
  // ADR-0056 K6: iptal listesi doğrulaması imzacıyı sabitler — vektörün imzacısı kimlik servisinin iptal sertifikası
  const signerFp = certFingerprintSha256Hex(pemToDer(certPem));
  const lists = [];
  const plan: Array<[1 | 2, string, Record<number, StatusValue>]> = [
    [1, "identity service (bits = 1)", { 3: StatusValue.INVALID, 1207: StatusValue.INVALID }],
    [2, "institution (bits = 2)", { 3: StatusValue.INVALID, 4: StatusValue.SUSPENDED }],
  ];
  for (const [bits, name, set] of plan) {
    const bs = new StatusBitstring(MIN_CAPACITY, undefined, bits);
    for (const [i, v] of Object.entries(set)) bs.set(Number(i), v);
    const base = { signer, bitstring: bs, iat: ST_NOW - 60, ttlSec: 120, expSec: 6 * 3600 };
    const jwtUri = `https://status.tamga.network/conformance-jwt-${bits}`;
    const cwtUri = `https://status.tamga.network/conformance-cwt-${bits}`;
    const jwt = await signStatusListToken({ ...base, iss: "https://id.tamga.network", uri: jwtUri });
    const cwt = await signStatusListCwt({ ...base, uri: cwtUri });
    const a = await verifyStatusListToken(jwt, jwtUri, ST_NOW, { expectedSignerFingerprints: [signerFp] });
    const b = await verifyStatusListCwt(cwt, cwtUri, ST_NOW, { expectedSignerFingerprints: [signerFp] });
    if ([...a.bitstring.bytes].join() !== [...b.bitstring.bytes].join()) throw new Error("JWT ≠ CWT bitleri");
    const probe = [0, 3, 4, 1207, 99_999];
    lists.push({
      name,
      bits,
      jwt: { uri: jwtUri, token: jwt, content_hash: a.contentHash },
      cwt: { uri: cwtUri, hex: Buffer.from(cwt).toString("hex"), content_hash: b.contentHash },
      expect: {
        signer_fingerprint_sha256: a.leafFingerprintHex,
        iat: a.payload.iat,
        exp: a.payload.exp,
        ttl: a.payload.ttl,
        values: Object.fromEntries(probe.map((i) => [String(i), a.bitstring.get(i)])),
      },
      negative: [
        {
          name: "sub differs from the address",
          uri: "https://status.tamga.network/other",
          now_offset_sec: 0,
          expect: "D3",
        },
        { name: "expired", uri: null, now_offset_sec: 7 * 3600, expect: "D4" },
        // ADR-0056 K6: beklenen imzacı başka bir anahtar → imza geçerli olsa da ret
        {
          name: "signer is not the expected signer",
          uri: null,
          now_offset_sec: 0,
          expected_signer_fingerprint_sha256: "00".repeat(32),
          expect: "D3",
        },
      ],
    });
  }
  const vec = {
    vector: "status-list/jwt-cwt",
    version: 1,
    generated_at: new Date().toISOString(),
    now: new Date(ST_NOW * 1000).toISOString().replace(/\.\d{3}Z$/, "Z"),
    note: "ADR-0048 / IETF draft-ietf-oauth-status-list-20. Kişisel veri yok; özel anahtar yok (yalnız imzacı sertifikası).",
    signer_cert_pem: certPem,
    draft_example: { bits: 1, lst_compressed_hex: "78dadbb918000217015d", bytes_hex: "b9a3" },
    lists,
  };
  mkdirSync(resolve(OUT, "status-list"), { recursive: true });
  writeFileSync(resolve(OUT, "status-list", "jwt-cwt.json"), JSON.stringify(vec, null, 2) + "\n");
  return lists.length;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  (async () => {
    if (!existsSync(resolve(DIST, "lotl.jws"))) throw new Error("önce npm run setup");
    const t = await trustVectors();
    const s = await sdJwtVectors();
    const i = await identityVectors();
    const l = await statusListVectors();
    // 6: ADR-0056 güvenli varsayılanlar (zorunlu güvenlik girdileri, iptal listesi imzacısı sabit); 5: ADR-0048 iptal listesi
    // bits 1/2 ve CWT gösterimi (4: ADR-0045 kimlik belgesi AB PID adları; 3: SPEC-CRED-0002 §3.5 disclosure serileştirme;
    // 2: ADR-0034 dns_name, x509_hash)
    writeFileSync(resolve(OUT, "VERSION"), "6\n");
    console.log(
      JSON.stringify({ trust_cases: t, sd_jwt_cases: s, identity_cases: i, status_lists: l, out: OUT }, null, 2),
    );
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
