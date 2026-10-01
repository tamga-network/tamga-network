/**
 * P4-2 uçtan uca: cüzdan (HardwareKeyProvider + sahte Android donanımı) → meydan okuma → birim anahtarı donanımda, anahtar
 * kanıtı zinciri (test kökü) → sağlayıcı doğrular → birim StrongBox → anahtar kanıtında (KA) iso_18045_moderate.
 * Kanıt geçersizse (başka paket) cüzdan kanıtsız yeniden kaydolur → software / iso_18045_basic.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { webcrypto } from "node:crypto";
import { decodeJwt } from "jose";
import {
  X509CertificateGenerator,
  Extension,
  cryptoProvider,
  X509Certificate,
  BasicConstraintsExtension,
} from "@peculiar/x509";
import { AsnConvert, OctetString } from "@peculiar/asn1-schema";
import {
  AttestationApplicationId,
  AttestationPackageInfo,
  AuthorizationList,
  KeyDescription,
  RootOfTrust,
  SecurityLevel,
  VerifiedBootState,
  id_ce_keyDescription,
} from "@peculiar/asn1-android";
import { buildWalletProviderApp } from "../src/app.js";
import {
  HardwareKeyProvider,
  MemoryKeyStore,
  SoftwareKeyProvider,
  UNIT_REF,
  b64,
  b64Decode,
  registerUnit,
  requestKeyAttestation,
  type Http,
  type NativeKeyBackend,
} from "@tamga-network/wallet-core";

cryptoProvider.set(webcrypto as unknown as Crypto);
const crypto = webcrypto as unknown as Crypto;
const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;
const ROOT = resolve(import.meta.dirname, "../../..");
const PKI = resolve(ROOT, "ops/pki");
const ready = existsSync(resolve(PKI, "wallet-provider.pkcs8.pem"));
const BASE = "http://wp.local";

let testRoot: { cert: X509Certificate; key: CryptoKeyPair };

/** Sahte Android Keystore: anahtar üretir; challenge verilirse test köküyle imzalı anahtar kanıtı zinciri döner. */
function fakeAndroid(pkg: string): NativeKeyBackend {
  const keys = new Map<string, CryptoKeyPair>();
  const coords = async (k: CryptoKeyPair) => {
    const raw = new Uint8Array(await crypto.subtle.exportKey("raw", k.publicKey));
    return { x: b64(raw.subarray(1, 33)), y: b64(raw.subarray(33, 65)) };
  };
  return {
    info: async () => ({ storage: "strongbox", platform: "android" }),
    async generate(ref, challenge) {
      const k = (await crypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
      keys.set(ref, k);
      let attestation: string[] | undefined;
      if (challenge) {
        const appId = new AttestationApplicationId({
          packageInfos: [new AttestationPackageInfo({ packageName: new OctetString(Buffer.from(pkg)), version: 1 })],
          signatureDigests: [],
        });
        const kd = new KeyDescription({
          attestationVersion: 200,
          attestationSecurityLevel: SecurityLevel.strongBox,
          keymasterVersion: 200,
          keymasterSecurityLevel: SecurityLevel.strongBox,
          attestationChallenge: new OctetString(b64Decode(challenge)),
          uniqueId: new OctetString(new Uint8Array()),
          softwareEnforced: new AuthorizationList({
            attestationApplicationId: new OctetString(AsnConvert.serialize(appId)),
          }),
          teeEnforced: new AuthorizationList({
            rootOfTrust: new RootOfTrust({
              verifiedBootKey: new OctetString(new Uint8Array(32)),
              deviceLocked: true,
              verifiedBootState: VerifiedBootState.verified,
              verifiedBootHash: new OctetString(new Uint8Array(32)),
            }),
          }),
        });
        const leaf = await X509CertificateGenerator.create({
          serialNumber: "10",
          subject: "CN=Android Keystore Key",
          issuer: testRoot.cert.subject,
          notBefore: new Date(Date.now() - 3600_000),
          notAfter: new Date(Date.now() + 86400_000),
          signingAlgorithm: ALG,
          publicKey: k.publicKey,
          signingKey: testRoot.key.privateKey,
          extensions: [new Extension(id_ce_keyDescription, false, AsnConvert.serialize(kd))],
        });
        attestation = [b64(new Uint8Array(leaf.rawData)), b64(new Uint8Array(testRoot.cert.rawData))];
      }
      return { ...(await coords(k)), storage: "strongbox", ...(attestation ? { attestation } : {}) };
    },
    publicKey: async (ref) => (keys.has(ref) ? coords(keys.get(ref)!) : null),
    sign: async (ref, dataB64) =>
      b64(new Uint8Array(await crypto.subtle.sign(ALG, keys.get(ref)!.privateKey, new Uint8Array(b64Decode(dataB64))))),
    delete: async (ref) => void keys.delete(ref),
  };
}

describe.skipIf(!ready)("P4-2 cihaz kanıtıyla birim kaydı", () => {
  let app: Awaited<ReturnType<typeof buildWalletProviderApp>>;
  beforeAll(async () => {
    const key = (await crypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
    const cert = await X509CertificateGenerator.createSelfSigned({
      serialNumber: "01",
      name: "CN=Test Android Attestation Root",
      notBefore: new Date(Date.now() - 86400_000),
      notAfter: new Date(Date.now() + 365 * 86400_000),
      signingAlgorithm: ALG,
      keys: key,
      extensions: [new BasicConstraintsExtension(true, 2, true)],
    });
    testRoot = { cert, key };
    app = await buildWalletProviderApp(
      {
        publicBase: BASE,
        port: 0,
        pkiDir: PKI,
        certName: "wallet-provider",
        wuaTtlDays: 30,
        solutions: [{ solution_id: "tamga-wallet-expo", min_version: "0.1.0" }],
        dataDir: null,
        device: { androidPackage: "network.tamga.wallet", appleAppId: null, allowDevelopment: false },
      },
      { deviceRoots: { android: [cert], apple: [] } },
    );
  });
  const http: Http = async (url, init) => {
    const r = await app.inject({
      method: init?.method ?? "GET",
      url: url.slice(BASE.length),
      headers: init?.headers,
      payload: init?.body,
    });
    return { status: r.statusCode, text: async () => r.body };
  };
  async function enrol(pkg: string) {
    const keys = new HardwareKeyProvider(fakeAndroid(pkg), new SoftwareKeyProvider(new MemoryKeyStore()), {
      platform: "android 15",
    });
    const reg = await registerUnit({
      providerBase: BASE,
      keys,
      http,
      appVersion: "0.1.0",
      platform: "android 15",
      deviceEvidence: async () => {
        const chain = keys.keyEvidence(UNIT_REF);
        return chain ? { platform: "android", key_attestation: chain } : undefined;
      },
    });
    const holder = await keys.generate("holder-1");
    const ka = await requestKeyAttestation({ providerBase: BASE, keys, http, jwks: [holder] });
    return { reg, ka: decodeJwt(ka) as { key_storage: string[] } };
  }

  it("doğru uygulama → StrongBox, KA iso_18045_moderate", async () => {
    const { reg, ka } = await enrol("network.tamga.wallet");
    expect(reg.keyStorage).toBe("strongbox");
    expect(ka.key_storage).toEqual(["iso_18045_moderate"]);
  });

  it("başka uygulamanın kanıtı → reddedilir, kanıtsız yeniden kayıt → software, KA iso_18045_basic", async () => {
    const { reg, ka } = await enrol("com.other.app");
    expect(reg.keyStorage).toBe("software");
    expect(ka.key_storage).toEqual(["iso_18045_basic"]);
  });

  it("meydan okuma tek kullanımlık", async () => {
    const c = await app.inject({ method: "POST", url: "/units/challenge" });
    expect(c.json().challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});
