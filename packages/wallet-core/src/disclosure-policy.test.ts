/**
 * ADR-0046 K2/K3 (EP2): gömülü açıklama politikası — metadata'dan saklama ve sunumda değerlendirme. Matris: politika türleri ×
 * kayıt sertifikası var/yok × aracılı istek. Gerçek imzalı istek nesnesi ve kayıt sertifikalarıyla (ağ isteği yok).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { webcrypto, createHash } from "node:crypto";
import {
  X509CertificateGenerator,
  cryptoProvider,
  KeyUsageFlags,
  KeyUsagesExtension,
  SubjectAlternativeNameExtension,
} from "@peculiar/x509";
import { SignJWT, exportJWK, generateKeyPair, type JWK } from "jose";
import {
  checkDisclosurePolicy,
  disclosurePolicyFromMetadata,
  evaluateDisclosurePolicy,
  offlineDisclosurePolicy,
  verifyRequestObject,
  type StoredDisclosurePolicy,
  type IssuerMetadata,
  type StoredCredential,
} from "./index.js";

cryptoProvider.set(webcrypto as unknown as Crypto);
const crypto = webcrypto as unknown as Crypto;
const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;
const NOW = Date.UTC(2026, 9, 11);
const nowSec = NOW / 1000;
const DIPLOMA = "urn:tamga:edu:DiplomaCredential:1";
const SP = "https://uri.etsi.org/19475/Entitlement/Service_Provider";

interface Party {
  key: CryptoKey;
  der: Uint8Array;
  b64: string;
  fp: string;
}
async function party(subject: string, serial: string, dns?: string): Promise<Party> {
  const kp = (await crypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
  const cert = await X509CertificateGenerator.createSelfSigned({
    serialNumber: serial,
    name: subject,
    notBefore: new Date(0),
    notAfter: new Date("2099-01-01"),
    signingAlgorithm: ALG,
    keys: kp,
    extensions: [
      new KeyUsagesExtension(KeyUsageFlags.digitalSignature, true),
      ...(dns ? [new SubjectAlternativeNameExtension([{ type: "dns", value: dns }])] : []),
    ],
  });
  const der = new Uint8Array(cert.rawData);
  return {
    key: kp.privateKey,
    der,
    b64: Buffer.from(der).toString("base64"),
    fp: createHash("sha256").update(der).digest("hex"),
  };
}

let registrar: Party, hr: Party;
beforeAll(async () => {
  registrar = await party("CN=Registrar (test), C=TR", "1001");
  hr = await party("CN=hr.example, O=HR Ltd, 2.5.4.97=VATTR-1234567890, C=TR", "2002", "hr.example");
});

const wrprc = (payload: Record<string, unknown>) =>
  new SignJWT({
    name: "HR",
    country: "TR",
    entitlements: [SP],
    credentials: [{ format: "dc+sd-jwt", meta: { vct_values: [DIPLOMA] }, claim: [{ path: ["is_graduate"] }] }],
    iat: nowSec - 10,
    exp: nowSec + 86400,
    ...payload,
  } as never)
    .setProtectedHeader({ alg: "ES256", typ: "rc-wrp+jwt", x5c: [registrar.b64], iat: nowSec } as never)
    .sign(registrar.key);

async function request(certs: string[] = [], signer?: Party) {
  const by = signer ?? hr;
  const enc = await generateKeyPair("ECDH-ES", { crv: "P-256", extractable: true });
  const jwk = { ...(await exportJWK(enc.publicKey)), use: "enc" } as JWK;
  const jwt = await new SignJWT({
    client_id: `x509_hash:${createHash("sha256").update(by.der).digest("base64url")}`,
    response_type: "vp_token",
    response_mode: "direct_post.jwt",
    response_uri: "https://hr.example/vp/response",
    nonce: "n".repeat(24),
    dcql_query: { credentials: [{ id: "diploma", format: "dc+sd-jwt", meta: { vct_values: [DIPLOMA] } }] },
    client_metadata: { jwks: { keys: [jwk] } },
    exp: Math.floor(Date.now() / 1000) + 300,
    ...(certs.length ? { verifier_info: certs.map((data) => ({ format: "registration_cert", data })) } : {}),
  })
    .setProtectedHeader({ alg: "ES256", typ: "oauth-authz-req+jwt", x5c: [by.b64] })
    .sign(by.key);
  return verifyRequestObject(jwt);
}

const stored = (policy: Record<string, unknown>): StoredDisclosurePolicy => {
  const md = {
    credential_configurations_supported: {
      [DIPLOMA]: { format: "dc+sd-jwt", credential_metadata: { embedded_disclosure_policy: policy } },
    },
  } as unknown as IssuerMetadata;
  return disclosurePolicyFromMetadata(md, DIPLOMA)!;
};
const cred = (p?: StoredDisclosurePolicy) =>
  ({ vct: DIPLOMA, ...(p ? { disclosurePolicy: p } : {}) }) as unknown as StoredCredential;
const ARP = (extra: Record<string, unknown>) => ({
  id: "https://university.example/policy/diploma-1",
  type: "authorized_relying_parties",
  info_uri: "https://university.example/policy/diploma",
  ...extra,
});

describe("saklama (K2, EDP_10)", () => {
  it("politika yoksa kayıt yok; geçerliyse politika + özet; bozuksa değerlendirilemez işareti", () => {
    const md = { credential_configurations_supported: { [DIPLOMA]: { format: "dc+sd-jwt" } } } as never;
    expect(disclosurePolicyFromMetadata(md, DIPLOMA)).toBeUndefined();
    const ok = stored(ARP({ relying_parties: [{ rp_id: "VATTR-1234567890" }] }));
    expect(ok.policy?.type).toBe("authorized_relying_parties");
    expect(ok.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    const bad = stored({ id: "urn:a:b", type: "authorized_relying_parties" });
    expect(bad.malformed).toBe(true);
    expect(bad.policy).toBeUndefined();
    expect(evaluateDisclosurePolicy(bad, null)).toMatchObject({ outcome: "not_evaluable", reason: "malformed_policy" });
  });
});

describe("değerlendirme (K3, EDP_02/03/06)", () => {
  // varsayılan: doğrulayıcı imzalı listede kayıtlı, kaydındaki erişim sertifikası parmak izi isteği imzalayanınki (checkRp eşleşmesi)
  const check = async (policy: Record<string, unknown> | null, certs: string[]) =>
    checkDisclosurePolicy(
      await request(certs),
      [registrar.fp],
      { queryId: "diploma", credential: cred(policy ? stored(policy) : undefined) },
      NOW,
      [],
      [hr.fp],
    );

  it("politika yok ya da none: geçer, kısıt yok", async () => {
    expect(await check(null, [])).toMatchObject({ outcome: "passed", reason: "no_policy", restricted: false });
    expect(await check({ id: "urn:a:none", type: "none" }, [])).toMatchObject({ outcome: "passed", restricted: false });
  });

  it("(a) rp_id + service_id: hizmet kimliği eşleşirse geçer, başka hizmet geçmez", async () => {
    const p = ARP({ relying_parties: [{ rp_id: "VATTR-1234567890", service_id: "hiring" }] });
    const hiring = await wrprc({ sub: "VATTR-1234567890", service_id: "hiring" });
    const other = await wrprc({ sub: "VATTR-1234567890", service_id: "newsletter" });
    const legacy = await wrprc({ sub: "VATTR-1234567890" }); // hizmet kimliği yok → service_id'li öğe eşleşmez (K3)
    expect(await check(p, [hiring])).toMatchObject({ outcome: "passed", matchedBy: "rp", restricted: true });
    expect(await check(p, [other])).toMatchObject({
      outcome: "failed",
      reason: "not_authorized",
      infoUri: "https://university.example/policy/diploma",
      policyId: "https://university.example/policy/diploma-1",
    });
    expect(await check(p, [legacy])).toMatchObject({ outcome: "failed" });
  });

  it("(a) service_id'siz öğe doğrulayıcının bütün kullanımlarını kapsar; başka rp_id geçmez", async () => {
    const p = ARP({ relying_parties: [{ rp_id: "VATTR-1234567890" }] });
    expect(await check(p, [await wrprc({ sub: "VATTR-1234567890", service_id: "x" })])).toMatchObject({
      outcome: "passed",
    });
    const q = ARP({ relying_parties: [{ rp_id: "VATTR-9999999999" }] });
    expect(await check(q, [await wrprc({ sub: "VATTR-1234567890" })])).toMatchObject({ outcome: "failed" });
  });

  it("(b) erişim sertifikasının konu adı (RFC 4514, ORGID)", async () => {
    const p = ARP({ subject_dns: ["C=TR, ORGID=VATTR-1234567890, O=HR Ltd, CN=hr.example"] });
    expect(await check(p, [await wrprc({ sub: "VATTR-1234567890" })])).toMatchObject({
      outcome: "passed",
      matchedBy: "subject_dn",
    });
    const q = ARP({ subject_dns: ["ORGID=VATTR-1234567890, O=HR Ltd, C=TR"] });
    expect(await check(q, [await wrprc({ sub: "VATTR-1234567890" })])).toMatchObject({ outcome: "failed" });
  });

  it("(b) aracılı istekte aracının konu adı eşleşme sayılmaz (EDP_02 notu); (a) aracılanan doğrulayıcıyla geçer", async () => {
    // aracı = hr (isteği imzalayan); aracılanan = VATTR-5555555555
    const via = await wrprc({
      sub: "VATTR-5555555555",
      service_id: "hiring",
      intermediary: { sub: "VATTR-1234567890" },
    });
    const byDn = ARP({ subject_dns: ["CN=hr.example, O=HR Ltd, ORGID=VATTR-1234567890, C=TR"] });
    expect(await check(byDn, [via])).toMatchObject({ outcome: "failed" });
    const byRp = ARP({ relying_parties: [{ rp_id: "VATTR-5555555555", service_id: "hiring" }] });
    expect(await check(byRp, [via])).toMatchObject({ outcome: "passed", matchedBy: "rp" });
    const intermediary = ARP({ relying_parties: [{ rp_id: "VATTR-1234567890" }] });
    expect(await check(intermediary, [via])).toMatchObject({ outcome: "failed" });
  });

  it("(c) yetki türü (TS 119 475 entitlement)", async () => {
    const p = ARP({ entitlements: [SP] });
    expect(await check(p, [await wrprc({ sub: "VATTR-1234567890" })])).toMatchObject({
      outcome: "passed",
      matchedBy: "entitlement",
    });
    const q = ARP({ entitlements: ["https://uri.etsi.org/19475/Entitlement/QEAA_Provider"] });
    expect(await check(q, [await wrprc({ sub: "VATTR-1234567890" })])).toMatchObject({ outcome: "failed" });
  });

  it("güven kökü: kayıt kurumunun kendi sertifikası (EDP_03); kendinden imzalı erişim yaprağı güvene bağlanmaz", async () => {
    const cert = await wrprc({ sub: "VATTR-1234567890" });
    const byRegistrar = {
      id: "urn:x:roots",
      type: "specific_roots_of_trust",
      roots_of_trust: [{ issuer_dn: "C=TR, CN=Registrar (test)", serial_number: "1001" }],
    };
    expect(await check(byRegistrar, [cert])).toMatchObject({ outcome: "passed", matchedBy: "root_of_trust" });
    // isteği gönderenin kendi (kendinden imzalı) erişim sertifikası: ad/seri tutsa da güvene bağlanamaz
    const byAccess = {
      ...byRegistrar,
      roots_of_trust: [{ issuer_dn: "CN=hr.example,O=HR Ltd,ORGID=VATTR-1234567890,C=TR", serial_number: "2002" }],
    };
    expect(await check(byAccess, [cert])).toMatchObject({ outcome: "not_evaluable", reason: "unverified_chain" });
    const wrongSerial = {
      ...byRegistrar,
      roots_of_trust: [{ issuer_dn: "C=TR, CN=Registrar (test)", serial_number: "1002" }],
    };
    expect(await check(wrongSerial, [cert])).toMatchObject({ outcome: "failed", reason: "not_authorized" });
  });

  it("kayıt sertifikası yok ya da geçersiz: değerlendirilemez (başarısız sayılır)", async () => {
    const p = ARP({ relying_parties: [{ rp_id: "VATTR-1234567890" }] });
    expect(await check(p, [])).toMatchObject({ outcome: "not_evaluable", reason: "no_registration_certificate" });
    const forged = await new SignJWT({ sub: "VATTR-1234567890", iat: nowSec } as never)
      .setProtectedHeader({ alg: "ES256", typ: "rc-wrp+jwt", x5c: [hr.b64] } as never)
      .sign(hr.key); // kayıt kurumu değil
    expect(await check(p, [forged])).toMatchObject({ outcome: "not_evaluable" });
  });

  it("yakın mesafe / cüzdandan cüzdana: kısıtlı politika değerlendirilemez, kısıtsız geçer", () => {
    expect(offlineDisclosurePolicy(cred(stored(ARP({ entitlements: [SP] }))))).toMatchObject({
      outcome: "not_evaluable",
      restricted: true,
    });
    expect(offlineDisclosurePolicy(cred())).toMatchObject({ outcome: "passed", restricted: false });
  });
});

describe("güven kökü: imza zinciri doğrulanmış olmalı (EDP_03 atlatma girişimleri)", () => {
  const ROOT = "CN=Policy Root CA, O=Root Org, C=TR";
  const policy = stored({
    id: "urn:x:roots",
    type: "specific_roots_of_trust",
    roots_of_trust: [{ issuer_dn: "C=TR,O=Root Org,CN=Policy Root CA", serial_number: "5a" }],
  });
  const kp = () => crypto.subtle.generateKey(ALG, true, ["sign", "verify"]) as Promise<CryptoKeyPair>;
  const cert = async (o: { subject: string; issuer: string; serial: string; pub: CryptoKey; signer: CryptoKey }) =>
    new Uint8Array(
      (
        await X509CertificateGenerator.create({
          serialNumber: o.serial,
          subject: o.subject,
          issuer: o.issuer,
          notBefore: new Date(0),
          notAfter: new Date("2099-01-01"),
          signingAlgorithm: ALG,
          publicKey: o.pub,
          signingKey: o.signer,
        })
      ).rawData,
    );
  const fp = (der: Uint8Array) => createHash("sha256").update(der).digest("hex");
  // erişim yaprağı kayıtlı parmak iziyle eşleşir (isteğin kayıt sertifikasına bağı kurulu); güven kökü kararı ayrıca sınanır
  const ctx = (wrprcChain: Uint8Array[], accessChain: Uint8Array[], trustAnchors?: string[]) => ({
    registrationCerts: [{ payload: { sub: "VATTR-1234567890" }, chainDer: wrprcChain }],
    accessCertChain: accessChain,
    registeredFingerprints: [fp(accessChain[0])],
    ...(trustAnchors ? { trustAnchors } : {}),
  });

  let rootKp: CryptoKeyPair, root: Uint8Array, regSigner: Uint8Array, accessLeaf: Uint8Array;
  let attackerKp: CryptoKeyPair, leafKp: CryptoKeyPair;
  beforeAll(async () => {
    rootKp = await kp();
    attackerKp = await kp();
    leafKp = await kp();
    root = await cert({ subject: ROOT, issuer: ROOT, serial: "5a", pub: rootKp.publicKey, signer: rootKp.privateKey });
    regSigner = await cert({
      subject: "CN=Registrar signer, C=TR",
      issuer: ROOT,
      serial: "71",
      pub: leafKp.publicKey,
      signer: rootKp.privateKey,
    });
    accessLeaf = await cert({
      subject: "CN=hr.example, O=HR Ltd, 2.5.4.97=VATTR-1234567890, C=TR",
      issuer: ROOT,
      serial: "72",
      pub: leafKp.publicKey,
      signer: rootKp.privateKey,
    });
  });

  it("gerçek zincir: kayıt kurumu sertifikası kökten → geçer; erişim zinciri çapaya bağlıysa geçer", () => {
    expect(evaluateDisclosurePolicy(policy, ctx([regSigner, root], [hr.der]))).toMatchObject({
      outcome: "passed",
      matchedBy: "root_of_trust",
    });
    // erişim zinciri: çapasız değerlendirilemez, kök imzalı listeden çapaysa geçer
    expect(evaluateDisclosurePolicy(policy, ctx([registrar.der], [accessLeaf, root]))).toMatchObject({
      outcome: "not_evaluable",
      reason: "unverified_chain",
    });
    expect(evaluateDisclosurePolicy(policy, ctx([registrar.der], [accessLeaf, root], [fp(root)]))).toMatchObject({
      outcome: "passed",
      matchedBy: "root_of_trust",
    });
  });

  it("x5c'ye eklenmiş kök (yaprağı imzalamamış) geçmez", () => {
    // kayıt kurumu sertifikası kendinden imzalı; kök yalnız sona eklenmiş
    const r = evaluateDisclosurePolicy(policy, ctx([registrar.der, root], [hr.der, root]));
    expect(r.outcome).not.toBe("passed");
    expect(r).toMatchObject({ outcome: "not_evaluable", reason: "unverified_chain" });
    // çapa verilse bile imza zinciri kökten geçmediği için geçmez
    expect(evaluateDisclosurePolicy(policy, ctx([registrar.der, root], [hr.der, root], [fp(root)])).outcome).not.toBe(
      "passed",
    );
  });

  it("kökün adını ve seri numarasını kopyalayan sertifika geçmez", async () => {
    // (1) kendi yaptığı yaprak: veren adı = kök adı, seri = kök serisi (IssuerSerial tutar), kendi anahtarıyla imzalı
    const copiedLeaf = await cert({
      subject: "CN=hr.example, O=HR Ltd, 2.5.4.97=VATTR-1234567890, C=TR",
      issuer: ROOT,
      serial: "5a",
      pub: attackerKp.publicKey,
      signer: attackerKp.privateKey,
    });
    // (2) sahte kök: aynı ad ve seri, saldırganın anahtarı, kendinden imzalı; sahte kökle imzalı yaprak
    const fakeRoot = await cert({
      subject: ROOT,
      issuer: ROOT,
      serial: "5a",
      pub: attackerKp.publicKey,
      signer: attackerKp.privateKey,
    });
    const fakeLeaf = await cert({
      subject: "CN=hr.example, O=HR Ltd, 2.5.4.97=VATTR-1234567890, C=TR",
      issuer: ROOT,
      serial: "73",
      pub: leafKp.publicKey,
      signer: attackerKp.privateKey,
    });
    for (const c of [
      ctx([registrar.der], [copiedLeaf]),
      ctx([registrar.der], [copiedLeaf], [fp(root)]),
      ctx([registrar.der], [fakeLeaf, fakeRoot]),
      ctx([registrar.der], [fakeLeaf, fakeRoot], [fp(root)]),
      ctx([registrar.der, fakeRoot], [hr.der]),
    ]) {
      const r = evaluateDisclosurePolicy(policy, c);
      expect(r.outcome).not.toBe("passed");
      expect(r).toMatchObject({ outcome: "not_evaluable", reason: "unverified_chain" });
    }
  });

  it("konu adı yedeği yok: kayıt kurumu sertifikasının KONU adı + serisi kök öğesi sayılmaz", () => {
    const bySubject = stored({
      id: "urn:x:roots",
      type: "specific_roots_of_trust",
      roots_of_trust: [{ issuer_dn: "C=TR,CN=Registrar signer", serial_number: "71" }],
    });
    expect(evaluateDisclosurePolicy(bySubject, ctx([regSigner, root], [hr.der]))).toMatchObject({
      outcome: "failed",
      reason: "not_authorized",
    });
  });
});

describe("erişim sertifikası çapası: kopyalanmış kayıt sertifikası (0.5.1)", () => {
  const p = ARP({ relying_parties: [{ rp_id: "VATTR-1234567890" }], entitlements: [SP] });
  const ALL = [
    p,
    ARP({ subject_dns: ["C=TR, ORGID=VATTR-1234567890, O=HR Ltd, CN=hr.example"] }),
    {
      id: "urn:x:roots",
      type: "specific_roots_of_trust",
      roots_of_trust: [{ issuer_dn: "C=TR, CN=Registrar (test)", serial_number: "1001" }],
    },
  ];
  const run = async (
    policy: Record<string, unknown>,
    signer: Party,
    o: { registered?: string[]; anchors?: string[]; chain?: Uint8Array[] } = {},
  ) => {
    const req = await request([await wrprc({ sub: "VATTR-1234567890" })], signer);
    return checkDisclosurePolicy(
      o.chain ? { ...req, chainDer: o.chain } : req,
      [registrar.fp],
      { queryId: "diploma", credential: cred(stored(policy)) },
      NOW,
      o.anchors ?? [],
      o.registered ?? [],
    );
  };

  it("gerçek doğrulayıcının herkese açık WRPRC'si + aynı kurum kimliğiyle kendinden imzalı erişim sertifikası: yetkili DEĞİL", async () => {
    // saldırgan: kurum kimliği (ORGID) ve ad kopyalanmış, kendi anahtarı; kayıt sertifikası gerçek (kayıt kurumu imzalı)
    const copy = await party("CN=hr.example, O=HR Ltd, 2.5.4.97=VATTR-1234567890, C=TR", "2002", "hr.example");
    for (const policy of ALL) {
      // çapa yok, kayıt yok
      expect(await run(policy, copy)).toMatchObject({
        outcome: "not_evaluable",
        reason: "untrusted_access_certificate",
      });
      // doğrulayıcının kaydı gerçek sertifikayı sabitliyor: kopya eşleşmez
      expect(await run(policy, copy, { registered: [hr.fp] })).toMatchObject({
        outcome: "not_evaluable",
        reason: "untrusted_access_certificate",
      });
      // listedeki CA parmak izi verilse bile kendinden imzalı kopya o CA'ya bağlanmaz
      expect((await run(policy, copy, { anchors: [hr.fp.replace(/^./, "0")] })).outcome).not.toBe("passed");
    }
  });

  it("kayıtlı parmak izi eşleşirse ya da zincir listedeki CA'ya bağlanırsa değerlendirilir", async () => {
    expect(await run(p, hr, { registered: [hr.fp.toUpperCase()] })).toMatchObject({
      outcome: "passed",
      matchedBy: "rp",
    });
    // erişim sertifikası listedeki bir CA'dan: yaprak + CA x5c'de, CA parmak izi çapa
    const caKp = (await crypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
    const leafKp = (await crypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
    const CA = "CN=Access CA, O=Tamga, C=TR";
    const ca = new Uint8Array(
      (
        await X509CertificateGenerator.createSelfSigned({
          serialNumber: "0a",
          name: CA,
          notBefore: new Date(0),
          notAfter: new Date("2099-01-01"),
          signingAlgorithm: ALG,
          keys: caKp,
        })
      ).rawData,
    );
    const leafCert = await X509CertificateGenerator.create({
      serialNumber: "0b",
      subject: "CN=hr.example, O=HR Ltd, 2.5.4.97=VATTR-1234567890, C=TR",
      issuer: CA,
      notBefore: new Date(0),
      notAfter: new Date("2099-01-01"),
      signingAlgorithm: ALG,
      publicKey: leafKp.publicKey,
      signingKey: caKp.privateKey,
      extensions: [new SubjectAlternativeNameExtension([{ type: "dns", value: "hr.example" }])],
    });
    const leafDer = new Uint8Array(leafCert.rawData);
    const issued: Party = {
      key: leafKp.privateKey,
      der: leafDer,
      b64: Buffer.from(leafDer).toString("base64"),
      fp: createHash("sha256").update(leafDer).digest("hex"),
    };
    const caFp = createHash("sha256").update(ca).digest("hex");
    expect(await run(p, issued, { anchors: [caFp], chain: [leafDer, ca] })).toMatchObject({
      outcome: "passed",
      matchedBy: "rp",
    });
    // aynı zincir, çapa yok → değerlendirilemez
    expect(await run(p, issued, { chain: [leafDer, ca] })).toMatchObject({
      outcome: "not_evaluable",
      reason: "untrusted_access_certificate",
    });
  });
});
