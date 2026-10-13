/**
 * İstek nesnesi biçimi (ETSI TS 119 472-2 REDIRECTS_RO-02/03): ara sertifikalı erişim sertifikasında x5c = yaprak + ara sertifika
 * (kök hariç), korumalı başlıkta `iat`. Sertifikalar test içinde üretilir (kişisel veri yok).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { webcrypto } from "node:crypto";
import {
  X509CertificateGenerator,
  cryptoProvider,
  BasicConstraintsExtension,
  KeyUsagesExtension,
  KeyUsageFlags,
  type X509Certificate,
} from "@peculiar/x509";
import { x509HashClientId } from "@tamga-network/core";
import { createPresentationRequest, pemRpSigner } from "./request.js";

cryptoProvider.set(webcrypto as unknown as Crypto);
const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;
const dayMs = 86400_000;

let rootPem: string, caPem: string, leafPem: string, leafKeyPem: string;
let caDerB64: string, leafDerB64: string;

async function pkcs8Pem(k: CryptoKey) {
  const b64 = Buffer.from(await webcrypto.subtle.exportKey("pkcs8", k)).toString("base64");
  return `-----BEGIN PRIVATE KEY-----\n${b64.match(/.{1,64}/g)!.join("\n")}\n-----END PRIVATE KEY-----\n`;
}
const b64 = (c: X509Certificate) => Buffer.from(c.rawData).toString("base64");

beforeAll(async () => {
  const gen = async () => (await webcrypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
  const rootKeys = await gen();
  const caKeys = await gen();
  const leafKeys = await gen();
  const notBefore = new Date(Date.now() - dayMs);
  const notAfter = new Date(Date.now() + dayMs);
  const root = await X509CertificateGenerator.createSelfSigned({
    serialNumber: "01",
    name: "CN=Test Root, C=TR",
    notBefore,
    notAfter,
    signingAlgorithm: ALG,
    keys: rootKeys,
    extensions: [new BasicConstraintsExtension(true, 1, true), new KeyUsagesExtension(KeyUsageFlags.keyCertSign, true)],
  });
  const ca = await X509CertificateGenerator.create({
    serialNumber: "02",
    subject: "CN=Test Intermediate CA, C=TR",
    issuer: root.subject,
    notBefore,
    notAfter,
    signingAlgorithm: ALG,
    publicKey: caKeys.publicKey,
    signingKey: rootKeys.privateKey,
    extensions: [new BasicConstraintsExtension(true, 0, true), new KeyUsagesExtension(KeyUsageFlags.keyCertSign, true)],
  });
  const leaf = await X509CertificateGenerator.create({
    serialNumber: "03",
    subject: "CN=Test RP (TEST), C=TR",
    issuer: ca.subject,
    notBefore,
    notAfter,
    signingAlgorithm: ALG,
    publicKey: leafKeys.publicKey,
    signingKey: caKeys.privateKey,
    extensions: [new KeyUsagesExtension(KeyUsageFlags.digitalSignature, true)],
  });
  rootPem = root.toString("pem");
  caPem = ca.toString("pem");
  leafPem = leaf.toString("pem");
  leafKeyPem = await pkcs8Pem(leafKeys.privateKey);
  caDerB64 = b64(ca);
  leafDerB64 = b64(leaf);
});

const headerOf = (jwt: string) => JSON.parse(Buffer.from(jwt.split(".")[0], "base64url").toString("utf8"));
const payloadOf = (jwt: string) => JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));
const dcql = { credentials: [{ id: "q", format: "dc+sd-jwt", meta: { vct_values: ["urn:x:1"] } }] } as never;

describe("istek nesnesi x5c ve başlık iat (REDIRECTS_RO-02/03)", () => {
  it("zincir dosyası (yaprak + ara + kök): x5c = yaprak + ara, kök atılır; client_id yalnız yapraktan", async () => {
    const signer = await pemRpSigner(leafKeyPem, `${leafPem}\n${caPem}\n${rootPem}\n`);
    expect(signer.clientId).toBe(x509HashClientId(Buffer.from(leafDerB64, "base64")));
    expect(signer.chainDer).toHaveLength(1);
    const now = 1_800_000_000;
    const pr = await createPresentationRequest({
      signer,
      dcql,
      responseUri: "https://rp.example.test/vp/response",
      requestUriBase: "https://rp.example.test/vp/req",
      now,
    });
    const h = headerOf(pr.requestJwt);
    expect(h.x5c).toEqual([leafDerB64, caDerB64]);
    expect(h.iat).toBe(now);
    // OpenID uyum öz-testi (V4): gövdede `aud` (OpenID4VP 1.0 §5, statik yapılandırma) ve `iat`; başlıktaki `iat` de kalır
    expect(payloadOf(pr.requestJwt).iat).toBe(now);
    expect(payloadOf(pr.requestJwt).aud).toBe("https://self-issued.me/v2");
    expect(payloadOf(pr.requestJwt).exp).toBe(now + 300);
    expect(payloadOf(pr.requestJwt).verifier_info).toBeUndefined(); // kayıt sertifikası yoksa alan yok
  });

  it("ara sertifika ayrı verilebilir; kök ayrı verilse de x5c'ye girmez", async () => {
    const signer = await pemRpSigner(leafKeyPem, leafPem, [caPem, rootPem]);
    const pr = await createPresentationRequest({
      signer,
      dcql,
      responseUri: "https://rp.example.test/vp/response",
      requestUriBase: "https://rp.example.test/vp/req",
    });
    expect(headerOf(pr.requestJwt).x5c).toEqual([leafDerB64, caDerB64]);
  });
});
