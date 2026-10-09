import { describe, it, expect, beforeAll } from "vitest";
import { webcrypto } from "node:crypto";
import { X509CertificateGenerator, cryptoProvider, KeyUsageFlags, KeyUsagesExtension } from "@peculiar/x509";
import { CompactSign, SignJWT, exportJWK, generateKeyPair, type JWK } from "jose";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { verifySdJwtVc, presentSdJwtVc, type IssuerSigner } from "@tamga-network/sd-jwt";
import {
  StatusBitstring,
  IndexAllocator,
  StatusValue,
  signStatusListToken,
  verifyStatusListToken,
  createOffer,
  redeemOffer,
  verifyProofJwt,
  issuerMetadata,
  buildCredentials,
  mapGraduateRecord,
  mapStudentRecord,
  PROOF_TYP,
  BATCH_SIZE,
  MIN_CAPACITY,
} from "./index.js";

cryptoProvider.set(webcrypto as unknown as Crypto);
const crypto = webcrypto as unknown as Crypto;
const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;
const here = dirname(fileURLToPath(import.meta.url));
const schemasIndex = JSON.parse(readFileSync(resolve(here, "../../schemas/dist/index.json"), "utf8")) as Array<{
  vct: string;
  content_hash: string;
}>;
const DIPLOMA = schemasIndex.find((s) => s.vct === "urn:tamga:edu:DiplomaCredential:1")!;
const STUDENT = schemasIndex.find((s) => s.vct === "urn:tamga:edu:StudentCredential:1")!;

let credSigner: IssuerSigner, statusSigner: IssuerSigner;
const NOW = 1790000000,
  ISS = "https://issuer.tamga.network/bilgi";
async function selfSigned(cn: string): Promise<IssuerSigner> {
  const keys = (await crypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
  const cert = await X509CertificateGenerator.createSelfSigned({
    serialNumber: "01",
    name: `CN=${cn}`,
    notBefore: new Date(0),
    notAfter: new Date("2099-01-01"),
    signingAlgorithm: ALG,
    keys,
    extensions: [new KeyUsagesExtension(KeyUsageFlags.digitalSignature, true)],
  });
  return {
    x5c: [new Uint8Array(cert.rawData)],
    sign: (h, p) => new CompactSign(p).setProtectedHeader(h as never).sign(keys.privateKey),
  };
}
async function holderKeys(n: number) {
  const ks = [];
  for (let i = 0; i < n; i++) {
    const k = await generateKeyPair("ES256");
    ks.push({ priv: k.privateKey, jwk: (await exportJWK(k.publicKey)) as JWK });
  }
  return ks;
}
beforeAll(async () => {
  credSigner = await selfSigned("Bilgi cred");
  statusSigner = await selfSigned("Bilgi status");
});

describe("status list (SPEC-CRED-0003)", () => {
  it("bits=2 paketleme, deflate gidiş-dönüş, rastgele idx, %80 doluluk", () => {
    const bs = new StatusBitstring(MIN_CAPACITY);
    bs.set(0, StatusValue.INVALID);
    bs.set(1, StatusValue.SUSPENDED);
    bs.set(48213, StatusValue.INVALID);
    expect(bs.bytes[0]).toBe(0b1001);
    const back = StatusBitstring.fromLst(bs.encodeLst());
    expect(back.get(0)).toBe(1);
    expect(back.get(1)).toBe(2);
    expect(back.get(2)).toBe(0);
    expect(back.get(48213)).toBe(1);
    const alloc = new IndexAllocator(MIN_CAPACITY);
    const a = alloc.allocate(),
      b = alloc.allocate();
    expect(a).not.toBe(b);
    const full = new IndexAllocator(
      MIN_CAPACITY,
      Array.from({ length: 80_000 }, (_, i) => i),
    );
    expect(() => full.allocate()).toThrow(/S10/);
  });
  it("token imzalanır ve doğrulanır; sub uyuşmazlığı ve bayatlık reddedilir", async () => {
    const bs = new StatusBitstring();
    bs.set(7, StatusValue.INVALID);
    const uri = "https://status.tamga.network/ab12cd34ef567890";
    const tok = await signStatusListToken({
      signer: statusSigner,
      iss: ISS,
      uri,
      bitstring: bs,
      iat: NOW,
      ttlSec: 3600,
    });
    const v = await verifyStatusListToken(tok, uri, NOW + 100);
    expect(v.bitstring.get(7)).toBe(1);
    expect(v.bitstring.get(8)).toBe(0);
    expect(v.payload.ttl).toBe(3600);
    await expect(verifyStatusListToken(tok, "https://status.tamga.network/other", NOW)).rejects.toThrow(/sub/);
    await expect(verifyStatusListToken(tok, uri, NOW + 3600 * 3)).rejects.toThrow(/D4: status token expired/);
  });
});

describe("OpenID4VCI yardımcıları (SPEC-PROTO-0001)", () => {
  it("offer: on-screen 5 dk, tek kullanımlık, tx_code zorunlu, 3 deneme", () => {
    const o = createOffer({ slug: "bilgi", subjectRef: "s-1", vct: DIPLOMA.vct, klass: "on-screen", now: NOW });
    expect(o.expiresAt - o.createdAt).toBe(300);
    expect(redeemOffer(o, o.preAuthorizedCode, undefined, NOW)).toEqual({ ok: false, error: "invalid_request" });
    expect(redeemOffer(o, o.preAuthorizedCode, "000000" === o.txCode ? "111111" : "000000", NOW)).toEqual({
      ok: false,
      error: "tx_code_mismatch",
    });
    const ok = redeemOffer(o, o.preAuthorizedCode, o.txCode, NOW);
    expect(ok.ok).toBe(true);
    expect(redeemOffer(o, o.preAuthorizedCode, o.txCode, NOW)).toEqual({ ok: false, error: "offer_used" });
    const o2 = createOffer({ slug: "bilgi", subjectRef: "s-1", vct: DIPLOMA.vct, klass: "out-of-band", now: NOW });
    expect(o2.expiresAt - o2.createdAt).toBe(72 * 3600);
    for (let i = 0; i < 3; i++)
      redeemOffer(o2, o2.preAuthorizedCode, "999999" === o2.txCode ? "000001" : "999999", NOW);
    expect(redeemOffer(o2, o2.preAuthorizedCode, o2.txCode, NOW)).toEqual({ ok: false, error: "offer_used" });
    expect(redeemOffer(o, o.preAuthorizedCode, o.txCode, NOW + 400).ok).toBe(false);
  });
  it("proof JWT: typ/alg/jwk/aud/nonce doğrulanır", async () => {
    const [h] = await holderKeys(1);
    const proof = await new SignJWT({ nonce: "c1", iat: NOW })
      .setProtectedHeader({ alg: "ES256", typ: PROOF_TYP, jwk: h.jwk })
      .setAudience(ISS)
      .sign(h.priv);
    expect((await verifyProofJwt(proof, ISS, "c1", NOW)).ok).toBe(true);
    expect((await verifyProofJwt(proof, ISS, "c2", NOW)).ok).toBe(false);
    expect((await verifyProofJwt(proof, "https://evil", "c1", NOW)).ok).toBe(false);
    const meta = issuerMetadata({
      credentialIssuer: ISS,
      authorizedVcts: [{ vct: DIPLOMA.vct, name: "Diploma", display: [] }],
    });
    expect(meta.nonce_endpoint).toBe(`${ISS}/nonce`);
    expect(meta.batch_credential_issuance.batch_size).toBe(BATCH_SIZE);
    expect(Object.keys(meta.credential_configurations_supported)).toEqual([DIPLOMA.vct]);
    // ETSI TS 119 472-3 §4.2.4.2 / ARF ISSU_39–40: tercih yöntem D, yedek yöntem A; paket 10, 2 kalınca yenileme
    const pol = meta.credential_configurations_supported[DIPLOMA.vct].credential_metadata.credential_reuse_policy;
    expect(pol.id).toBe("arf_annex_ii");
    expect(pol.options[0].details).toEqual(["per-relying-party", "once_only"]);
    expect(pol.options[0].reissue_trigger_unused).toBeLessThan(pol.options[0].batch_size);
  });
});

describe("credential fabrikası", () => {
  const body = {
    name_tr: "İstanbul Bilgi Üniversitesi (DEMO)",
    name_en: "Istanbul Bilgi University (DEMO)",
    id: "TR-UNI-DEMO",
    country: "TR",
  };
  it("diploma: şema doğrulanır, batch 10 farklı cnf, status idx, seçici açıklama uçtan uca", async () => {
    const hs = await holderKeys(BATCH_SIZE);
    const claims = mapGraduateRecord(
      {
        family_name: "Yılmaz",
        given_name: "Ayşe",
        birth_date: "2002-05-14",
        qualification_tr: "Bilgisayar Mühendisliği Lisans",
        eqf_level: 6,
        isced_f_code: "0613",
        awarding_date: "2026-06-20",
        grade: "3.41",
      },
      body,
    );
    const alloc = new IndexAllocator(MIN_CAPACITY);
    const creds = await buildCredentials({
      vct: DIPLOMA.vct,
      vctIntegrity: DIPLOMA.content_hash,
      signer: credSigner,
      iss: ISS,
      claims,
      cnfJwks: hs.map((h) => h.jwk),
      iat: NOW,
      statusFor: () => ({ idx: alloc.allocate(), uri: "https://status.tamga.network/ab12" }),
    });
    expect(creds.length).toBe(10);
    expect(new Set(creds.map((c) => c.idx)).size).toBe(10);
    const pres = await presentSdJwtVc({
      combined: creds[3].combined,
      discloseClaims: ["is_graduate", "eqf_level"],
      holderKey: hs[3].priv,
      aud: "x509_san_dns:verify.tamga.network",
      nonce: "n",
      iat: NOW,
    });
    const r = await verifySdJwtVc(pres, {
      aud: "x509_san_dns:verify.tamga.network",
      nonce: "n",
      stateCode: "TR",
      now: NOW,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.claims.grade).toBeUndefined();
      expect(r.claims.is_graduate).toBe(true);
      expect(r.status?.status_list.idx).toBe(creds[3].idx);
    }
  });
  it("şema uyumsuzluğu (bilinmeyen alan) ve ISCED eksikliği ihracı durdurur (E6, CMP5/E11)", async () => {
    const hs = await holderKeys(1);
    const claims = {
      ...mapGraduateRecord(
        {
          family_name: "A",
          given_name: "B",
          birth_date: "2000-01-01",
          qualification_tr: "X",
          eqf_level: 6,
          isced_f_code: "0613",
          awarding_date: "2026-01-01",
        },
        body,
      ),
      extra_field: "x",
    };
    await expect(
      buildCredentials({
        vct: DIPLOMA.vct,
        vctIntegrity: DIPLOMA.content_hash,
        signer: credSigner,
        iss: ISS,
        claims,
        cnfJwks: [hs[0].jwk],
        iat: NOW,
        statusFor: () => ({ idx: 1, uri: "https://status.tamga.network/x" }),
      }),
    ).rejects.toThrow(/schema mismatch/);
    expect(() =>
      mapStudentRecord(
        {
          family_name: "A",
          given_name: "B",
          birth_date: "2000-01-01",
          programme_title_tr: "X",
          isced_f_code: null,
          study_level: 6,
          enrollment_year: 2024,
          student_status: "ACTIVE",
        },
        body,
      ),
    ).toThrow(/ISCED/);
  });
  it("öğrenci belgesi: exp zorunlu ve ≤ 90 gün (E4/E9); aynı anahtarla iki kopya PR6 ihlali", async () => {
    const hs = await holderKeys(1);
    const claims = mapStudentRecord(
      {
        family_name: "A",
        given_name: "B",
        birth_date: "2000-01-01",
        programme_title_tr: "X",
        isced_f_code: "0613",
        study_level: 6,
        enrollment_year: 2024,
        student_status: "ACTIVE",
      },
      body,
    );
    await expect(
      buildCredentials({
        vct: STUDENT.vct,
        vctIntegrity: STUDENT.content_hash,
        signer: credSigner,
        iss: ISS,
        claims,
        cnfJwks: [hs[0].jwk],
        iat: NOW,
      }),
    ).rejects.toThrow(/requires exp/);
    await expect(
      buildCredentials({
        vct: STUDENT.vct,
        vctIntegrity: STUDENT.content_hash,
        signer: credSigner,
        iss: ISS,
        claims,
        cnfJwks: [hs[0].jwk],
        iat: NOW,
        exp: NOW + 91 * 86400,
      }),
    ).rejects.toThrow(/E9/);
    const ok = await buildCredentials({
      vct: STUDENT.vct,
      vctIntegrity: STUDENT.content_hash,
      signer: credSigner,
      iss: ISS,
      claims,
      cnfJwks: [hs[0].jwk],
      iat: NOW,
      exp: NOW + 60 * 86400,
    });
    expect(ok.length).toBe(1);
    await expect(
      buildCredentials({
        vct: STUDENT.vct,
        vctIntegrity: STUDENT.content_hash,
        signer: credSigner,
        iss: ISS,
        claims,
        cnfJwks: [hs[0].jwk, hs[0].jwk],
        iat: NOW,
        exp: NOW + 60 * 86400,
      }),
    ).rejects.toThrow(/PR6/);
  });
});
