/**
 * ADR-0094 K8 (ADR-0036 K5 alma yönü): cüzdan, imzalı LOTL'da sabitlenmiş bir PID sağlayıcı listesindeki temsili makamdan AB PID
 * alır. Sandbox'ın gerçek imzalı listeleri (`dist-sandbox`) ve temsili makam anahtarları; Tamga listesinde olmayan, dış listeye de
 * bağlanmayan imzacının PID'i alınmaz; tür dış listenin kapsamında değilse alınmaz.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { issueSdJwtVc, pemIssuerSigner } from "@tamga-network/sd-jwt";
import { loadTrustSourceFromDir, pemToDer, type ListTrustSource, type TrustSource } from "@tamga-network/trust";
import { SoftwareKeyProvider, MemoryKeyStore } from "./keys.js";
import { newState, receiveCredentials } from "./store.js";
import { credentialStatusFrom } from "./status.js";
import { certFingerprintHex } from "./sdjwt.js";
import type { RedeemOutput } from "./oid4vci.js";

const ROOT = resolve(import.meta.dirname, "../../..");
const PKI = resolve(ROOT, "ops/pki-sandbox");
const DIST = resolve(ROOT, "apps/trust-publisher/dist-sandbox");
const ready =
  existsSync(resolve(PKI, "pid-tr-issuer.pkcs8.pem")) && existsSync(resolve(DIST, "external/sandbox-pid-tr.jws"));
const key = (n: string) => readFileSync(resolve(PKI, `${n}.pkcs8.pem`), "utf8");
const cert = (n: string) => readFileSync(resolve(PKI, `${n}.cert.pem`), "utf8");
const ISS = "https://issuer.sandbox.tamga.network/pid-tr";

describe.skipIf(!ready)("ADR-0094 K8 — dış PID sağlayıcısından alma", () => {
  let trust: ListTrustSource;
  const keys = new SoftwareKeyProvider(new MemoryKeyStore());

  beforeAll(async () => {
    trust = (
      await loadTrustSourceFromDir(DIST, {
        environment: "sandbox",
        anchorMaxAgeMs: 365 * 86400_000,
        requiredStates: ["TR"],
        versionMemory: "none",
      })
    ).trust;
  });

  async function redeem(signerName: string, vct = "urn:eudi:pid:1"): Promise<RedeemOutput> {
    const now = Math.floor(Date.now() / 1000);
    const copies = [];
    for (let i = 0; i < 2; i++) {
      const ref = `pid-${i}-${Math.random().toString(36).slice(2, 8)}`;
      const cnf = await keys.generate(ref);
      const { combined } = await issueSdJwtVc({
        signer: await pemIssuerSigner(key(signerName), cert(signerName)),
        iss: ISS,
        vct,
        iat: now,
        exp: now + 365 * 86400,
        cnfJwk: cnf as never,
        claims: { given_name: "Aylin", family_name: "Kaya", nationalities: ["TR"], address: { country: "TR" } },
        sdPolicy: {},
        arrayElementSd: ["nationalities"],
        objectMemberSd: ["address"],
      });
      copies.push({ combined, keyRef: ref, cnf });
    }
    return {
      credentialIssuer: ISS,
      vct,
      metadata: { credential_configurations_supported: {} } as never,
      copies,
      issuedAt: now,
    };
  }

  it("listedeki makamın PID'i alınır; kurum kimliği çapa parmak izi", async () => {
    const r = receiveCredentials(newState("t"), await redeem("pid-tr-issuer"), { trust });
    expect(r.credential.copies).toHaveLength(2);
    expect(r.verified.vct).toBe("urn:eudi:pid:1");
    expect(r.verified.vctIntegrity).toBeUndefined();
    expect(r.verified.issuerId).toMatch(/^0x[0-9a-f]{64}$/);
    expect(r.verified.claims.address).toEqual({ country: "TR" });
  });

  it("kendi iptal durumu: imzacı dış listedeki iptal hizmeti (makamın status sertifikası)", async () => {
    const r = receiveCredentials(newState("t"), await redeem("pid-tr-issuer"), { trust });
    const cred = { ...r.credential, copies: r.credential.copies.map((c, i) => ({ ...c, idx: i })) };
    const list = (fp: string, revoked: boolean) => ({
      uri: "https://status.sandbox.tamga.network/x",
      bits: 1 as const,
      bytes: Uint8Array.from([revoked ? 1 : 0]),
      signerFingerprint: fp,
      iss: ISS,
    });
    const statusFp = certFingerprintHex(pemToDer(cert("pid-tr-status")));
    expect(credentialStatusFrom(cred, list(statusFp, false), trust)).toBe("valid");
    expect(credentialStatusFrom(cred, list(statusFp, true), trust)).toBe("revoked");
    // başka imzacı (makamın belge imza anahtarı) iptal listesi imzalayamaz
    expect(credentialStatusFrom(cred, list(certFingerprintHex(pemToDer(cert("pid-tr-issuer"))), true), trust)).toBe(
      "unknown",
    );
  });

  it("başka bir ülke listesinin kullanılamaması PID almayı durdurmaz", async () => {
    const kzDown = Object.assign(Object.create(trust) as TrustSource, {
      resolveIssuerId: () => ({ kind: "none" as const, unavailableStates: ["KZ"] }),
    });
    const r = receiveCredentials(newState("t"), await redeem("pid-tr-issuer"), { trust: kzDown });
    expect(r.verified.vct).toBe("urn:eudi:pid:1");
  });

  it("dış listeye bağlanmayan imzacı (Tamga sandbox kurumu) ret; liste kullanılamıyorsa 'sonra dene'; tür kapsam dışıysa ret", async () => {
    const foreign = await redeem("issuer-gokbilge");
    // Bütün dış listeler yüklüyken: imzacı hiçbir dış listeye bağlanmıyor → ret. (Sandbox LOTL'daki `oidf-test-pid` internetten
    // çekilir — `external-fetch`; temiz kurulumda ve CI'da kopyası yoktur, o zaman doğru yanıt "sonra dene"dir, aşağıda.)
    const allLoaded = Object.assign(Object.create(trust) as TrustSource, { unavailableExternalListFor: () => null });
    expect(() => receiveCredentials(newState("t"), foreign, { trust: allLoaded })).toThrow(/not in the trusted list/);
    const down = Object.assign(Object.create(trust) as TrustSource, {
      externalAnchorCertsDer: () => [],
      unavailableExternalListFor: () => "sandbox-pid-tr",
    });
    expect(() => receiveCredentials(newState("t"), foreign, { trust: down })).toThrow(/try again later/);
    const noScope = Object.assign(Object.create(trust) as TrustSource, {
      externalIssuerByAnchor: (fp: string, vct: string, iat: number) => ({
        ...trust.externalIssuerByAnchor(fp, vct, iat)!,
        tri: "NO" as const,
      }),
    });
    const pid = await redeem("pid-tr-issuer");
    expect(() => receiveCredentials(newState("t"), pid, { trust: noScope })).toThrow(/not authorised/);
  });
});
