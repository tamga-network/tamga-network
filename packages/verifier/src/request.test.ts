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
import { CompactEncrypt, importJWK } from "jose";
import { createPresentationRequest, decryptPresentationResponse, pemRpSigner, responseKidOf } from "./request.js";

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

describe("DC API açıkken iki istek nesnesi (0.6.0)", () => {
  const seal = async (body: unknown, jwk: Record<string, unknown>) =>
    new CompactEncrypt(new TextEncoder().encode(JSON.stringify(body)))
      .setProtectedHeader({ alg: "ECDH-ES", enc: "A128GCM", kid: String(jwk.kid) })
      .encrypt(await importJWK(jwk as never, "ECDH-ES"));

  it("QR nesnesi direct_post.jwt + response_uri; DC nesnesi dc_api.jwt + expected_origins; anahtar ayrı, nonce/state ortak", async () => {
    const signer = await pemRpSigner(leafKeyPem, leafPem);
    const pr = await createPresentationRequest({
      signer,
      dcql,
      responseUri: "https://rp.example.test/vp/response",
      requestUriBase: "https://rp.example.test/vp/req",
      dcApi: { expectedOrigins: ["https://shop.example"] },
    });
    const qr = payloadOf(pr.requestJwt);
    expect(qr.response_mode).toBe("direct_post.jwt");
    expect(qr.response_uri).toBe("https://rp.example.test/vp/response");
    expect(qr.expected_origins).toBeUndefined();
    const dc = payloadOf(pr.dcApiRequest!.data.request);
    expect(pr.dcApi!.requestJwt).toBe(pr.dcApiRequest!.data.request);
    expect(dc.response_mode).toBe("dc_api.jwt");
    expect(dc.expected_origins).toEqual(["https://shop.example"]);
    expect(dc.response_uri).toBeUndefined();
    expect([dc.nonce, dc.state]).toEqual([qr.nonce, qr.state]);
    expect(qr.client_metadata.jwks.keys[0].kid).toBe(`enc-${pr.presentationId}`);
    expect(dc.client_metadata.jwks.keys[0].kid).toBe(`enc-dc-${pr.presentationId}`);
    expect(dc.client_metadata.jwks.keys[0].x).not.toBe(qr.client_metadata.jwks.keys[0].x);

    const body = { vp_token: { q: ["x"] }, state: pr.state };
    const viaQr = await decryptPresentationResponse(
      await seal(body, pr.encPublicJwk),
      pr,
      "https://rp.example.test/vp/response",
    );
    expect(viaQr.path).toBe("cross_device");
    expect(viaQr.binding).toEqual({
      responseUri: "https://rp.example.test/vp/response",
      encJwkThumbprint: pr.encJwkThumbprint,
    });
    const viaDc = await decryptPresentationResponse(await seal(body, pr.dcApi!.encPublicJwk), pr, "unused");
    expect(viaDc.path).toBe("dc_api");
    expect(viaDc.binding).toEqual({ origin: "https://shop.example", encJwkThumbprint: pr.dcApi!.encJwkThumbprint });
    // yolun kid'i öteki yolun anahtarıyla şifrelenmiş yanıtı açmaz
    const forged = await seal(body, { ...pr.encPublicJwk, kid: `enc-dc-${pr.presentationId}` });
    expect(responseKidOf(forged)).toEqual({ presentationId: pr.presentationId, path: "dc_api" });
    await expect(decryptPresentationResponse(forged, pr, "x")).rejects.toThrow();
  });

  it("DC API olmadan tek nesne; DC kid'li yanıt reddedilir", async () => {
    const signer = await pemRpSigner(leafKeyPem, leafPem);
    const pr = await createPresentationRequest({
      signer,
      dcql,
      responseUri: "https://rp.example.test/vp/response",
      requestUriBase: "https://rp.example.test/vp/req",
    });
    expect(pr.dcApi).toBeUndefined();
    expect(pr.dcApiRequest).toBeUndefined();
    const forged = await seal({ vp_token: { q: ["x"] } }, { ...pr.encPublicJwk, kid: `enc-dc-${pr.presentationId}` });
    await expect(decryptPresentationResponse(forged, pr, "x")).rejects.toThrow(/no Digital Credentials API/);
  });
});
