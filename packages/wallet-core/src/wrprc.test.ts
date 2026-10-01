/** ADR-0026 K5: kayıt sertifikası — imza/kayıt kurumu, süre, erişim sertifikasıyla bağ, istenen alanlar. */
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
  checkIssuerRegistration,
  checkRegistrationCerts,
  verifyRequestObject,
  type Match,
  type StoredCredential,
} from "./index.js";

cryptoProvider.set(webcrypto as unknown as Crypto);
const crypto = webcrypto as unknown as Crypto;
const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;
const NOW = Date.UTC(2026, 9, 1);
const nowSec = NOW / 1000;

interface Party {
  key: CryptoKey;
  der: Uint8Array;
  b64: string;
  fp: string;
}
async function party(subject: string, dns?: string): Promise<Party> {
  const kp = (await crypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
  const cert = await X509CertificateGenerator.createSelfSigned({
    serialNumber: "0" + Math.floor(Math.random() * 1e6),
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

let registrar: Party, other: Party, shop: Party;
beforeAll(async () => {
  registrar = await party("CN=Registrar (test)");
  other = await party("CN=Not a registrar");
  shop = await party("CN=shop.example, O=Shop, 2.5.4.97=VATTR-1234567890", "shop.example");
});

const wrprc = (signer: Party, payload: Record<string, unknown>) =>
  new SignJWT(payload as never)
    .setProtectedHeader({ alg: "ES256", typ: "rc-wrp+jwt", x5c: [signer.b64], iat: nowSec } as never)
    .sign(signer.key);
const basePayload = {
  name: "Shop",
  sub: "VATTR-1234567890",
  country: "TR",
  registry_uri: "https://trust.example/tl-tr.jws",
  entitlements: ["https://uri.etsi.org/19475/Entitlement/Service_Provider"],
  privacy_policy: "https://shop.example/privacy",
  credentials: [
    {
      format: "dc+sd-jwt",
      meta: { vct_values: ["urn:tamga:edu:StudentCredential:1"] },
      claim: [{ path: ["is_enrolled"] }],
    },
  ],
  iat: nowSec - 10,
  exp: nowSec + 86400,
};

async function request(verifierInfo?: unknown[]) {
  const enc = await generateKeyPair("ECDH-ES", { crv: "P-256", extractable: true });
  const jwk = { ...(await exportJWK(enc.publicKey)), use: "enc" } as JWK;
  const jwt = await new SignJWT({
    client_id: `x509_hash:${createHash("sha256").update(Buffer.from(shop.b64, "base64")).digest("base64url")}`,
    response_type: "vp_token",
    response_mode: "direct_post.jwt",
    response_uri: "https://shop.example/vp/response",
    nonce: "n".repeat(24),
    dcql_query: {
      credentials: [
        { id: "student", format: "dc+sd-jwt", meta: { vct_values: ["urn:tamga:edu:StudentCredential:1"] } },
      ],
    },
    client_metadata: { jwks: { keys: [jwk] } },
    ...(verifierInfo ? { verifier_info: verifierInfo } : {}),
  })
    .setProtectedHeader({ alg: "ES256", typ: "oauth-authz-req+jwt", x5c: [shop.b64] })
    .sign(shop.key);
  return verifyRequestObject(jwt);
}
const match = (requested: string[]): Match => ({
  queryId: "student",
  credential: { vct: "urn:tamga:edu:StudentCredential:1" } as StoredCredential,
  requested,
  missing: [],
});

describe("kayıt sertifikası doğrulaması (ADR-0026)", () => {
  it("yoksa: present=false, valid", async () => {
    expect(checkRegistrationCerts(await request(), [registrar.fp], match(["is_enrolled"]), NOW)).toEqual({
      present: false,
      valid: true,
    });
  });

  it("geçerli: izin verilen alanlar, ticari ad ve gizlilik politikası", async () => {
    const req = await request([
      { format: "registration_cert", data: await wrprc(registrar, basePayload), credential_ids: ["student"] },
    ]);
    const r = checkRegistrationCerts(req, [registrar.fp], match(["is_enrolled"]), NOW);
    expect(r).toMatchObject({ present: true, valid: true, allowedClaims: ["is_enrolled"], tradeName: "Shop" });
    expect(r.privacyPolicy).toBe("https://shop.example/privacy");
  });

  it("kayıt kurumu listede değil → geçersiz (WRC4)", async () => {
    const req = await request([{ format: "registration_cert", data: await wrprc(other, basePayload) }]);
    expect(checkRegistrationCerts(req, [registrar.fp], match([]), NOW)).toMatchObject({ valid: false });
  });

  it("süresi dolmuş → geçersiz", async () => {
    const req = await request([
      { format: "registration_cert", data: await wrprc(registrar, { ...basePayload, exp: nowSec - 1 }) },
    ]);
    expect(checkRegistrationCerts(req, [registrar.fp], match([]), NOW).reason).toMatch(/expired/);
  });

  it("başka kurumun sertifikası (sub ≠ organizationIdentifier) → geçersiz", async () => {
    const req = await request([
      { format: "registration_cert", data: await wrprc(registrar, { ...basePayload, sub: "VATTR-9999999999" }) },
    ]);
    expect(checkRegistrationCerts(req, [registrar.fp], match([]), NOW).reason).toMatch(/does not belong/);
  });

  it("imza bozuk → geçersiz", async () => {
    const good = await wrprc(registrar, basePayload);
    const [h, , s] = good.split(".");
    const forged = `${h}.${Buffer.from(JSON.stringify({ ...basePayload, name: "Evil" })).toString("base64url")}.${s}`;
    const req = await request([{ format: "registration_cert", data: forged }]);
    expect(checkRegistrationCerts(req, [registrar.fp], match([]), NOW)).toMatchObject({ valid: false });
  });

  it("başka sorguya bağlı sertifika bu belge için alan izni vermez", async () => {
    const req = await request([
      { format: "registration_cert", data: await wrprc(registrar, basePayload), credential_ids: ["diploma"] },
    ]);
    const r = checkRegistrationCerts(req, [registrar.fp], match(["is_enrolled"]), NOW);
    expect(r.valid).toBe(true);
    expect(r.allowedClaims).toBeUndefined();
  });
});

describe("belge verenin kayıt bilgisi (RPRC_22a/23, ETSI 472-3 §4.2.3)", () => {
  const issuerPayload = {
    name: "Uni",
    sub: "VATTR-1",
    country: "TR",
    registry_uri: "https://trust.example/tl-tr.jws",
    entitlements: ["https://uri.etsi.org/19475/Entitlement/Non_Q_EAA_Provider"],
    provides_attestations: [{ format: "dc+sd-jwt", meta: { vct_values: ["urn:tamga:edu:DiplomaCredential:1"] } }],
    iat: nowSec - 10,
    exp: nowSec + 86400,
  };
  const dataset = (vct: string) => ({
    format: "registrar_dataset",
    data: {
      identifier: [],
      srvDescription: [],
      registryURI: "u",
      providesAttestations: [{ format: "dc+sd-jwt", meta: { vct_values: [vct] } }],
    },
  });
  it("issuer_info yok → present=false", () => {
    expect(checkIssuerRegistration({}, "x", [registrar.fp], NOW)).toEqual({ present: false, valid: true });
  });
  it("kayıtlı tür + geçerli sertifika → geçerli", async () => {
    const md = {
      issuer_info: [
        dataset("urn:tamga:edu:DiplomaCredential:1"),
        { format: "registration_cert", data: await wrprc(registrar, issuerPayload) },
      ],
    };
    expect(checkIssuerRegistration(md, "urn:tamga:edu:DiplomaCredential:1", [registrar.fp], NOW)).toEqual({
      present: true,
      valid: true,
    });
  });
  it("kayıtlı olmadığı tür → geçersiz (RPRC_23)", () => {
    const md = { issuer_info: [dataset("urn:tamga:edu:DiplomaCredential:1")] };
    expect(checkIssuerRegistration(md, "urn:tamga:edu:StudentCredential:1", [registrar.fp], NOW).reason).toMatch(
      /not registered/,
    );
  });
  it("sertifika kayıt kurumu dışından ya da türü kapsamıyor → geçersiz", async () => {
    const other1 = {
      issuer_info: [dataset("v"), { format: "registration_cert", data: await wrprc(other, issuerPayload) }],
    };
    expect(checkIssuerRegistration(other1, "v", [registrar.fp], NOW).valid).toBe(false);
    const narrow = {
      issuer_info: [dataset("v"), { format: "registration_cert", data: await wrprc(registrar, issuerPayload) }],
    };
    expect(checkIssuerRegistration(narrow, "v", [registrar.fp], NOW).reason).toMatch(/does not cover/);
  });
});
