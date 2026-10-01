/**
 * Cihaz kanıtı doğrulayıcısı (P4-2). Gerçek cihaz kanıtı burada üretilemediği için test, platformların yapısıyla aynı sentetik
 * zincirleri kendi test kökünden üretir; üretimde kökler `roots/` (Google, Apple). Gerçek cihazla doğrulama mağaza derlemesinde.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { webcrypto, createHash } from "node:crypto";
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
import { encode as cborEncode } from "@tamga-network/mdoc";
import {
  officialRoots,
  unitClientData,
  verifyAndroidKeyAttestation,
  verifyAppAttest,
} from "../src/device-attestation.js";

cryptoProvider.set(webcrypto as unknown as Crypto);
const crypto = webcrypto as unknown as Crypto;
const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;
const NOW = new Date("2026-10-01T00:00:00Z");
const sha256 = (b: Uint8Array | string) => new Uint8Array(createHash("sha256").update(b).digest());
const b64 = (b: ArrayBuffer | Uint8Array) =>
  Buffer.from(b instanceof Uint8Array ? b : new Uint8Array(b)).toString("base64");

let root: { cert: X509Certificate; key: CryptoKeyPair };
let other: { cert: X509Certificate; key: CryptoKeyPair };
async function ca(name: string) {
  const key = (await crypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
  const cert = await X509CertificateGenerator.createSelfSigned({
    serialNumber: "01",
    name,
    notBefore: new Date("2025-01-01"),
    notAfter: new Date("2035-01-01"),
    signingAlgorithm: ALG,
    keys: key,
    extensions: [new BasicConstraintsExtension(true, 2, true)],
  });
  return { cert, key };
}
beforeAll(async () => {
  root = await ca("CN=Test Attestation Root");
  other = await ca("CN=Untrusted Root");
});

async function leaf(issuer: { cert: X509Certificate; key: CryptoKeyPair }, exts: Extension[]) {
  const key = (await crypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
  const cert = await X509CertificateGenerator.create({
    serialNumber: "02",
    subject: "CN=Android Keystore Key",
    issuer: issuer.cert.subject,
    notBefore: new Date("2026-01-01"),
    notAfter: new Date("2027-01-01"),
    signingAlgorithm: ALG,
    publicKey: key.publicKey,
    signingKey: issuer.key.privateKey,
    extensions: exts,
  });
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key.publicKey));
  return { cert, raw };
}

// ------------------------------------------------------------------ Android
function keyDescription(o: { challenge: Uint8Array; level?: SecurityLevel; boot?: VerifiedBootState; pkg?: string }) {
  const appId = new AttestationApplicationId({
    packageInfos: [
      new AttestationPackageInfo({
        packageName: new OctetString(Buffer.from(o.pkg ?? "network.tamga.wallet")),
        version: 1,
      }),
    ],
    signatureDigests: [new OctetString(sha256("signing-cert"))],
  });
  const kd = new KeyDescription({
    attestationVersion: 200,
    attestationSecurityLevel: o.level ?? SecurityLevel.strongBox,
    keymasterVersion: 200,
    keymasterSecurityLevel: o.level ?? SecurityLevel.strongBox,
    attestationChallenge: new OctetString(o.challenge),
    uniqueId: new OctetString(new Uint8Array()),
    softwareEnforced: new AuthorizationList({ attestationApplicationId: new OctetString(AsnConvert.serialize(appId)) }),
    teeEnforced: new AuthorizationList({
      rootOfTrust: new RootOfTrust({
        verifiedBootKey: new OctetString(new Uint8Array(32)),
        deviceLocked: true,
        verifiedBootState: o.boot ?? VerifiedBootState.verified,
        verifiedBootHash: new OctetString(new Uint8Array(32)),
      }),
    }),
  });
  return new Extension(id_ce_keyDescription, false, AsnConvert.serialize(kd));
}

describe("Android anahtar kanıtı", () => {
  const challenge = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  it("StrongBox, doğrulanmış açılış, doğru paket → strongbox", async () => {
    const l = await leaf(root, [keyDescription({ challenge })]);
    const r = await verifyAndroidKeyAttestation([b64(l.cert.rawData), b64(root.cert.rawData)], {
      challenge,
      packageName: "network.tamga.wallet",
      expectedKey: l.raw,
      roots: [root.cert],
      now: NOW,
    });
    expect(r).toMatchObject({ ok: true, storage: "strongbox" });
  });
  it("TEE → tee", async () => {
    const l = await leaf(root, [keyDescription({ challenge, level: SecurityLevel.trustedEnvironment })]);
    const r = await verifyAndroidKeyAttestation([b64(l.cert.rawData)], {
      challenge,
      packageName: "network.tamga.wallet",
      expectedKey: l.raw,
      roots: [root.cert],
      now: NOW,
    });
    expect(r).toMatchObject({ ok: true, storage: "tee" });
  });
  it("red: güvenilmeyen kök, yanlış meydan okuma, yazılım anahtarı, açılış, paket, başka anahtar", async () => {
    const base = { packageName: "network.tamga.wallet", roots: [root.cert], now: NOW };
    const untrusted = await leaf(other, [keyDescription({ challenge })]);
    expect(
      (
        await verifyAndroidKeyAttestation([b64(untrusted.cert.rawData)], {
          ...base,
          challenge,
          expectedKey: untrusted.raw,
        })
      ).reason,
    ).toMatch(/trusted root/);
    const l = await leaf(root, [keyDescription({ challenge })]);
    expect(
      (
        await verifyAndroidKeyAttestation([b64(l.cert.rawData)], {
          ...base,
          challenge: new Uint8Array([9]),
          expectedKey: l.raw,
        })
      ).reason,
    ).toMatch(/challenge/);
    const sw = await leaf(root, [keyDescription({ challenge, level: SecurityLevel.software })]);
    expect(
      (await verifyAndroidKeyAttestation([b64(sw.cert.rawData)], { ...base, challenge, expectedKey: sw.raw })).reason,
    ).toMatch(/secure hardware/);
    const unl = await leaf(root, [keyDescription({ challenge, boot: VerifiedBootState.unverified })]);
    expect(
      (await verifyAndroidKeyAttestation([b64(unl.cert.rawData)], { ...base, challenge, expectedKey: unl.raw })).reason,
    ).toMatch(/verified boot/);
    const pkg = await leaf(root, [keyDescription({ challenge, pkg: "com.evil.app" })]);
    expect(
      (await verifyAndroidKeyAttestation([b64(pkg.cert.rawData)], { ...base, challenge, expectedKey: pkg.raw })).reason,
    ).toMatch(/package/);
    expect(
      (await verifyAndroidKeyAttestation([b64(l.cert.rawData)], { ...base, challenge, expectedKey: pkg.raw })).reason,
    ).toMatch(/not the unit key/);
  });
});

// ------------------------------------------------------------------ Apple App Attest
const APP_ID = "TEAMID1234.network.tamga.wallet";
async function appAttest(o: {
  clientData: Uint8Array;
  appId?: string;
  counter?: number;
  aaguid?: Uint8Array;
  issuer?: typeof root;
}) {
  // yaprak anahtarı önce üretilir (keyId = SHA-256(ham açık anahtar)); nonce uzantısı authData'ya bağlı
  const key = (await crypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key.publicKey));
  const keyId = sha256(raw);
  const aaguid = o.aaguid ?? new Uint8Array([...Buffer.from("appattest"), 0, 0, 0, 0, 0, 0, 0]);
  const counter = new Uint8Array(4);
  new DataView(counter.buffer).setUint32(0, o.counter ?? 0);
  const credLen = new Uint8Array([0, keyId.length]);
  const authData = new Uint8Array([...sha256(o.appId ?? APP_ID), 0x40, ...counter, ...aaguid, ...credLen, ...keyId]);
  const nonce = sha256(new Uint8Array([...authData, ...sha256(o.clientData)]));
  const nonceExt = new Uint8Array([0x30, 0x24, 0xa1, 0x22, 0x04, 0x20, ...nonce]);
  const issuer = o.issuer ?? root;
  const cert = await X509CertificateGenerator.create({
    serialNumber: "03",
    subject: "CN=App Attest Key",
    issuer: issuer.cert.subject,
    notBefore: new Date("2026-01-01"),
    notAfter: new Date("2027-01-01"),
    signingAlgorithm: ALG,
    publicKey: key.publicKey,
    signingKey: issuer.key.privateKey,
    extensions: [new Extension("1.2.840.113635.100.8.2", false, nonceExt)],
  });
  const att = new Map<string, unknown>([
    ["fmt", "apple-appattest"],
    [
      "attStmt",
      new Map<string, unknown>([
        ["x5c", [new Uint8Array(cert.rawData), new Uint8Array(issuer.cert.rawData)]],
        ["receipt", new Uint8Array([1])],
      ]),
    ],
    ["authData", authData],
  ]);
  return { keyIdB64: b64(keyId), attestationB64: b64(cborEncode(att as never)) };
}

describe("Apple App Attest", () => {
  const clientData = unitClientData("meydan-okuma", "birim-parmak-izi");
  it("geçerli üretim kanıtı → secure_enclave", async () => {
    const a = await appAttest({ clientData });
    expect(await verifyAppAttest({ ...a, clientData, appId: APP_ID, roots: [root.cert], now: NOW })).toMatchObject({
      ok: true,
      storage: "secure_enclave",
    });
  });
  it("red: başka istemci verisi, başka uygulama, sayaç, geliştirme ortamı, güvenilmeyen kök", async () => {
    const base = { clientData, appId: APP_ID, roots: [root.cert], now: NOW };
    const a = await appAttest({ clientData });
    expect((await verifyAppAttest({ ...a, ...base, clientData: unitClientData("x", "y") })).reason).toMatch(/nonce/);
    expect(
      (await verifyAppAttest({ ...(await appAttest({ clientData, appId: "OTHER.app" })), ...base })).reason,
    ).toMatch(/app id/);
    expect((await verifyAppAttest({ ...(await appAttest({ clientData, counter: 1 })), ...base })).reason).toMatch(
      /counter/,
    );
    const dev = await appAttest({ clientData, aaguid: new Uint8Array(Buffer.from("appattestdevelop")) });
    expect((await verifyAppAttest({ ...dev, ...base })).reason).toMatch(/environment/);
    expect((await verifyAppAttest({ ...dev, ...base, allowDevelopment: true })).ok).toBe(true);
    expect((await verifyAppAttest({ ...(await appAttest({ clientData, issuer: other })), ...base })).reason).toMatch(
      /trusted root/,
    );
  });
});

describe("resmî kökler", () => {
  it("Google (2) ve Apple (1) kökleri yüklü", () => {
    const r = officialRoots();
    expect(r.android.length).toBeGreaterThanOrEqual(2);
    expect(r.apple[0].subject).toContain("Apple App Attestation Root CA");
  });
});
