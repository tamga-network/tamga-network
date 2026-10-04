/**
 * a2 Play Integrity uçtan uca (zorunlu değil): Android birim kaydıyla gelen jeton YALNIZ anahtar kanıtı doğrulandıysa ve servis
 * hesabı ayarlıysa sahte Google üzerinden çözülür (doğrulanmış yol: device-e2e.test.ts). Burada: kanıt doğrulanmadıysa Google'a
 * gidilmez; servis hesabı yoksa jeton yok sayılır. Kayıt hiçbir durumda reddedilmez.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { X509Certificate } from "@peculiar/x509";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { buildWalletProviderApp, UNIT_POP_TYP } from "../src/app.js";
import { PLAY_INTEGRITY_API, _resetTokenCache } from "../src/play-integrity.js";

const ROOT = resolve(import.meta.dirname, "../../..");
const PKI = resolve(ROOT, "ops/pki");
const ready = existsSync(resolve(PKI, "wallet-provider.pkcs8.pem"));
/** "yanlış kök": kanıt zinciri buna bağlanmaz → doğrulama başarısız (geçersiz) */
const rootPem = ready ? readFileSync(resolve(PKI, "wallet-provider.cert.pem"), "utf8") : "";
const BASE = "http://wp.local";
const PKG = "network.tamga.wallet";

const rsa = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const sa = {
  client_email: "wp@test.iam.gserviceaccount.com",
  private_key: rsa.privateKey,
  token_uri: "https://oauth2.example/token",
};

function fakeGoogle(verdicts: string[], hashOf: () => string) {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (u === sa.token_uri)
      return new Response(JSON.stringify({ access_token: "at", expires_in: 3600 }), { status: 200 });
    if (u === `${PLAY_INTEGRITY_API}/${PKG}:decodeIntegrityToken`) {
      expect(JSON.parse(String(init?.body))).toEqual({ integrity_token: "tok-1" });
      return new Response(
        JSON.stringify({
          tokenPayloadExternal: {
            requestDetails: { requestPackageName: PKG, requestHash: hashOf(), timestampMillis: String(Date.now()) },
            appIntegrity: { appRecognitionVerdict: "PLAY_RECOGNIZED", packageName: PKG },
            deviceIntegrity: { deviceRecognitionVerdict: verdicts },
          },
        }),
        { status: 200 },
      );
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
}

const cfg = (playIntegritySa: string | null) => ({
  publicBase: BASE,
  port: 0,
  pkiDir: PKI,
  certName: "wallet-provider",
  wuaTtlDays: 30,
  solutions: [{ solution_id: "tamga-wallet-expo", min_version: "0.1.0" }],
  dataDir: null,
  device: { androidPackage: PKG, appleAppId: null, allowDevelopment: false, playIntegritySa },
});

/** Birim anahtarıyla imzalı kayıt kanıtı (wallet-core `unitProof` ile aynı biçim). */
async function registerBody(challenge: string, play_integrity?: string) {
  const unit = await generateKeyPair("ES256", { extractable: true });
  const jwk = await exportJWK(unit.publicKey);
  const proof = await new SignJWT({
    action: "register",
    solution_id: "tamga-wallet-expo",
    app_version: "0.1.0",
    platform: "android 15",
    challenge,
    jti: randomUUID(),
  })
    .setProtectedHeader({ alg: "ES256", typ: UNIT_POP_TYP, jwk: { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y } })
    .setIssuedAt()
    .setAudience(BASE)
    .sign(unit.privateKey);
  return {
    proof,
    device_evidence: { platform: "android", key_attestation: ["AAAA"], ...(play_integrity ? { play_integrity } : {}) },
  };
}

describe.skipIf(!ready)("a2 Play Integrity — birim kaydında isteğe bağlı hüküm", () => {
  let challenge = "";
  beforeAll(() => _resetTokenCache());

  it("anahtar kanıtı doğrulanmadı (kökler ayarsız / geçersiz zincir): jeton Google'a GİTMEZ, kayıt 201 software", async () => {
    let calls = 0;
    const reasons: string[] = [];
    const google = fakeGoogle(["MEETS_STRONG_INTEGRITY", "MEETS_DEVICE_INTEGRITY"], () => challenge);
    const counting = (async (u: string | URL | Request, i?: RequestInit) => {
      calls++;
      return google(u, i);
    }) as typeof fetch;
    for (const roots of [[], [new X509Certificate(rootPem)]]) {
      const app = await buildWalletProviderApp(cfg(JSON.stringify(sa)), {
        deviceRoots: { android: roots, apple: [] },
        fetch: counting,
      });
      challenge = (await app.inject({ method: "POST", url: "/units/challenge" })).json().challenge;
      const r = await app.inject({ method: "POST", url: "/units", payload: await registerBody(challenge, "tok-1") });
      expect(r.statusCode).toBe(201);
      expect(r.json()).toMatchObject({ key_storage: "software", attestation: "software" });
      expect(r.json().play_integrity).toBeUndefined();
      if (r.json().reason === "invalid") expect(r.json().detail).toBeUndefined(); // sahtecilik şüphesinde yalnız kod
      reasons.push(r.json().reason);
    }
    expect(reasons).toEqual(["not_configured", "invalid"]);
    expect(calls).toBe(0);
  });

  it("servis hesabı yok: jeton yok sayılır, yanıt play_integrity taşımaz", async () => {
    const app = await buildWalletProviderApp(cfg(null), { deviceRoots: { android: [], apple: [] } });
    challenge = (await app.inject({ method: "POST", url: "/units/challenge" })).json().challenge;
    const r = await app.inject({ method: "POST", url: "/units", payload: await registerBody(challenge, "tok-1") });
    expect(r.statusCode).toBe(201);
    expect(r.json().play_integrity).toBeUndefined();
  });
});
