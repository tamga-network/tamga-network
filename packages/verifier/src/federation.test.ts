/**
 * ADR-0036 federasyon + AB PID uyum testleri: sentetik bir dış ETSI TS 119 602 (LoTE) listesi (deneme imzacısı), AB PID
 * kural kitabı biçiminde iç içe seçici açıklamalı bir SD-JWT VC (urn:eudi:pid:1; address{…}, nationalities[]) ve olumsuz
 * durumlar: kapsam dışı tür (FD2), imzacı uyuşmazlığı, bayat liste (UNKNOWN), tanınmayan ülke (C3), kurcalanmış iç içe disclosure,
 * dış cüzdan sağlayıcısı + kapsam anahtar deposu kuralı.
 * Tamga listeleri dev PKI + trust-publisher dist'ten; dış liste test içinde üretilir (kişisel veri yok, anahtarlar atılır).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash, webcrypto } from "node:crypto";
import { CompactSign, SignJWT, exportJWK } from "jose";
import {
  X509CertificateGenerator,
  BasicConstraintsExtension,
  cryptoProvider,
  type X509Certificate,
} from "@peculiar/x509";
import {
  applyExternalListsWith,
  ExternalListPointer,
  loadTrustSourceFromDir,
  pemToDer,
  verifyJws,
  x509HashClientId,
  type ListTrustSource,
  type TrustStore,
} from "@tamga-network/trust";
import { SoftwareKeyProvider, MemoryKeyStore, presentSdJwt } from "@tamga-network/wallet-core";
import { verifyWalletAttestation } from "@tamga-network/issuer";
import { verifyPresentation, MemoryStatusCache, dcqlFromPolicy, type Policy } from "./index.js";

cryptoProvider.set(webcrypto as unknown as Crypto);
const ROOT = resolve(import.meta.dirname, "../../..");
const PKI = resolve(ROOT, "ops/pki");
const DIST = resolve(ROOT, "apps/trust-publisher/dist");
const ready = existsSync(resolve(PKI, "rp-verify.cert.pem")) && existsSync(resolve(DIST, "lotl.jws"));
const AUD = ready ? x509HashClientId(pemToDer(readFileSync(resolve(PKI, "rp-verify.cert.pem"), "utf8"))) : "";
const PID_VCT = "urn:eudi:pid:1";
const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;
const b64 = (u: Uint8Array) => Buffer.from(u).toString("base64");
const b64u = (u: Uint8Array | string) => Buffer.from(u).toString("base64url");
const fp = (der: Uint8Array) => createHash("sha256").update(der).digest("hex");

interface KeyCert {
  keys: CryptoKeyPair;
  cert: X509Certificate;
  der: Uint8Array;
}
const DAY = 86400_000;
async function selfSigned(cn: string, ca: boolean): Promise<KeyCert> {
  const keys = (await webcrypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
  const cert = await X509CertificateGenerator.createSelfSigned({
    serialNumber: "0" + Math.floor(Math.random() * 1e6).toString(16),
    name: `CN=${cn}`,
    notBefore: new Date(Date.now() - DAY),
    notAfter: new Date(Date.now() + 30 * DAY),
    keys,
    signingAlgorithm: ALG,
    extensions: [new BasicConstraintsExtension(ca, undefined, true)],
  });
  return { keys, cert, der: new Uint8Array(cert.rawData) };
}
async function issuedBy(cn: string, ca: KeyCert): Promise<KeyCert> {
  const keys = (await webcrypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
  const cert = await X509CertificateGenerator.create({
    serialNumber: "0" + Math.floor(Math.random() * 1e6).toString(16),
    subject: `CN=${cn}`,
    issuer: ca.cert.subject,
    notBefore: new Date(Date.now() - DAY),
    notAfter: new Date(Date.now() + 30 * DAY),
    publicKey: keys.publicKey,
    signingKey: ca.keys.privateKey,
    signingAlgorithm: ALG,
    extensions: [new BasicConstraintsExtension(false, undefined, true)],
  });
  return { keys, cert, der: new Uint8Array(cert.rawData) };
}

/** ETSI TS 119 602 Ek A.1 biçiminde en küçük LoTE (yalnız okuyucunun kullandığı alanlar + zorunlu başlık). */
function lote(opts: {
  territory: string;
  nextUpdate: Date;
  entities: Array<{ name: string; services: Array<{ type: string; certs: Uint8Array[] }> }>;
  version?: number;
}) {
  const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
  return {
    LoTE: {
      ListAndSchemeInformation: {
        LoTEVersionIdentifier: opts.version ?? 1,
        LoTESequenceNumber: 3,
        LoTEType: "http://uri.etsi.org/19602/LoTEType/test",
        SchemeOperatorName: [{ lang: "en", value: "Test scheme operator" }],
        SchemeTerritory: opts.territory,
        ListIssueDateTime: iso(new Date(Date.now() - 3600_000)),
        NextUpdate: iso(opts.nextUpdate),
      },
      TrustedEntitiesList: opts.entities.map((e) => ({
        TrustedEntityInformation: { TEName: [{ lang: "en", value: e.name }] },
        TrustedEntityServices: e.services.map((s) => ({
          ServiceInformation: {
            ServiceTypeIdentifier: s.type,
            ServiceName: [{ lang: "en", value: e.name }],
            ServiceDigitalIdentity: { X509Certificates: s.certs.map((d) => ({ val: b64(d) })) },
          },
        })),
      })),
    },
  };
}
async function signLote(obj: unknown, signer: KeyCert) {
  return new CompactSign(new TextEncoder().encode(JSON.stringify(obj)))
    .setProtectedHeader({ alg: "ES256", typ: "JOSE", x5c: [b64(signer.der)] })
    .sign(signer.keys.privateKey);
}

/** AB PID kural kitabı biçiminde (iç içe address, dizi nationalities) seçici açıklamalı SD-JWT VC — ihraç biçimi. */
async function issuePid(issuer: KeyCert, cnfJwk: Record<string, unknown>, now: number, tamper = false) {
  const disc = (arr: unknown[]) => {
    const d = b64u(JSON.stringify(arr));
    return { d, h: b64u(createHash("sha256").update(d, "ascii").digest()) };
  };
  const salt = () => b64u(webcrypto.getRandomValues(new Uint8Array(16)));
  const given = disc([salt(), "given_name", "Ayşe"]);
  const family = disc([salt(), "family_name", "Yılmaz"]);
  const birth = disc([salt(), "birthdate", "2001-05-05"]);
  const locality = disc([salt(), "locality", "İstanbul"]);
  const country = disc([salt(), "country", "TR"]);
  const nat = disc([salt(), "TR"]);
  const payload = {
    iss: "https://pid.example.test",
    vct: PID_VCT,
    iat: now - 60,
    exp: now + 30 * 86400,
    cnf: { jwk: cnfJwk },
    _sd_alg: "sha-256",
    _sd: [given.h, family.h, birth.h].sort(),
    address: { _sd: [locality.h, country.h].sort() },
    nationalities: [{ "...": nat.h }],
  };
  const jwt = await new CompactSign(new TextEncoder().encode(JSON.stringify(payload)))
    .setProtectedHeader({ alg: "ES256", typ: "dc+sd-jwt", x5c: [b64(issuer.der)] })
    .sign(issuer.keys.privateKey);
  const extra = tamper ? [disc([salt(), "locality", "Ankara"]).d] : [];
  return [jwt, given.d, family.d, birth.d, locality.d, country.d, nat.d, ...extra, ""].join("~");
}

const policy: Policy = {
  policy_id: "pid-basic",
  purpose: { "en-GB": "Identify the person" },
  credentials: [
    {
      id: "pid",
      vct_values: [PID_VCT],
      required_claims: ["given_name", "address.locality", "nationalities"],
    },
  ],
  trust: { min_issuer_assurance: "I2", allowed_categories: ["IDENTITY"], require_recognition: true, state_code: "TR" },
  freshness: { max_status_token_age_sec: 6 * 3600, max_trust_age_sec: 86400 },
};

describe.skipIf(!ready)("ADR-0036 federasyon — dış LoTE listesi + AB PID", () => {
  let listSigner: KeyCert;
  let otherSigner: KeyCert;
  let pidCa: KeyCert;
  let pidIssuer: KeyCert;
  let walletProvider: KeyCert;
  let ownRoot: Uint8Array[];
  const keys = new SoftwareKeyProvider(new MemoryKeyStore());

  beforeAll(async () => {
    listSigner = await selfSigned("Test LoTE signer", false);
    otherSigner = await selfSigned("Somebody else", false);
    pidCa = await selfSigned("Test PID CA", true);
    pidIssuer = await issuedBy("Test PID signer", pidCa);
    walletProvider = await selfSigned("Test wallet provider", false);
    const r = await loadTrustSourceFromDir(DIST);
    ownRoot = [pemToDer(r.rootCertPem!)];
  });

  /** Tamga dist'ini yükler, LOTL'a test işaretçisini ekler, dış listeyi uygular (yalnız test: LOTL imzası değişmez). */
  async function federated(o: {
    scope?: Record<string, unknown>;
    nextUpdate?: Date;
    signer?: KeyCert;
    pinned?: KeyCert;
    version?: number;
  }) {
    const { trust } = await loadTrustSourceFromDir(DIST);
    const store = (trust as unknown as { store: TrustStore }).store;
    const ptr = ExternalListPointer.parse({
      list_id: "test-pid",
      territory: "TR",
      format: "etsi-lote-json",
      list_url: "https://example.test/lote/pid.jws",
      signing_keys: [{ fingerprint_sha256: fp((o.pinned ?? listSigner).der), status: "ACTIVE" }],
      operator: { name: "Test scheme operator" },
      status: "ACTIVE",
      scope: o.scope ?? {
        entity_kinds: ["pid_provider", "wallet_provider"],
        vct: [PID_VCT],
        category: "IDENTITY",
        assurance: "I3",
        class: "PUB",
        recognized_by: ["TR"],
        min_key_storage: "secure_enclave",
      },
      approval: { approved_at: "2026-10-01T00:00:00Z", ref: "test" },
    });
    store.lotl = { ...store.lotl, external_lists: [ptr] };
    const jws = await signLote(
      lote({
        territory: "TR",
        nextUpdate: o.nextUpdate ?? new Date(Date.now() + 7 * DAY),
        version: o.version,
        entities: [
          {
            name: "Test PID Provider",
            services: [{ type: "http://uri.etsi.org/19602/SvcType/PID/Issuance", certs: [pidCa.der] }],
          },
          {
            name: "Test Wallet Provider",
            services: [
              { type: "http://uri.etsi.org/19602/SvcType/WalletSolution/Issuance", certs: [walletProvider.der] },
            ],
          },
        ],
      }),
      o.signer ?? listSigner,
    );
    const warnings = await applyExternalListsWith(store, { "test-pid": jws }, verifyJws, new Date());
    return { trust: trust as ListTrustSource, warnings };
  }

  async function presentPid(trust: ListTrustSource, tamper = false) {
    const now = Math.floor(Date.now() / 1000);
    const ref = `pid-${Math.random().toString(36).slice(2, 8)}`;
    const cnf = await keys.generate(ref);
    const combined = await issuePid(pidIssuer, cnf as unknown as Record<string, unknown>, now, tamper);
    const nonce = `n-${ref}`;
    const presentation = await presentSdJwt({
      combined,
      discloseClaims: ["given_name", "address.locality", "nationalities"],
      keys,
      keyRef: ref,
      aud: AUD,
      nonce,
    });
    return verifyPresentation({
      presentation,
      aud: AUD,
      nonce,
      policy,
      policyCredentialId: "pid",
      trust,
      statusCache: new MemoryStatusCache(),
      rootCertsDer: [...ownRoot, ...(trust.externalAnchorCertsDer?.() ?? [])],
    });
  }

  it("dış PID sağlayıcısının iç içe alanlı AB PID'i: ACCEPTED; yalnız istenen alt alanlar açılır; kayıt dış liste kapsamından", async () => {
    const { trust, warnings } = await federated({});
    expect(warnings.filter((w) => !/outside scope/.test(w))).toEqual([]);
    const { result, claims } = await presentPid(trust);
    expect(result.outcome, `${result.failed_step} ${result.failed_reason}`).toBe("ACCEPTED");
    expect(result.schema?.status).toBe("EXTERNAL");
    expect(result.issuer?.category).toBe("IDENTITY");
    expect(result.issuer?.assurance).toBe("I3");
    expect(result.disclosed_claims).toEqual(
      expect.arrayContaining(["given_name", "address.locality", "nationalities[0]"]),
    );
    expect(result.disclosed_claims).not.toContain("address.country");
    expect(result.disclosed_claims).not.toContain("family_name");
    expect((claims as { address: Record<string, unknown> }).address).toEqual({ locality: "İstanbul" });
    expect((claims as { nationalities: string[] }).nationalities).toEqual(["TR"]);
  });

  it("DCQL: iç içe yol diziye çevrilir (address.locality → [address, locality])", () => {
    const q = dcqlFromPolicy(policy);
    expect(q.credentials[0].claims.map((c) => c.path)).toEqual([
      ["given_name"],
      ["address", "locality"],
      ["nationalities"],
    ]);
  });

  it("FD2: tür dış listenin kapsamında değilse B2 RED", async () => {
    const { trust } = await federated({
      scope: { entity_kinds: ["pid_provider"], vct: ["urn:eudi:other:1"], category: "IDENTITY", assurance: "I3" },
    });
    const { result } = await presentPid(trust);
    expect(result.outcome).toBe("REJECTED");
    expect(result.failed_step).toBe("B2");
  });

  it("imzacı LOTL'da sabitlenen değilse liste yüklenmez → çapa tanınmaz (A3/B2 RED)", async () => {
    const { trust, warnings } = await federated({ signer: otherSigner });
    expect(warnings.some((w) => /not registered|not loaded/.test(w))).toBe(true);
    expect(trust.externalAnchorCertsDer?.()).toEqual([]);
    const { result } = await presentPid(trust);
    expect(result.outcome).toBe("REJECTED");
  });

  it("bayat dış liste (NextUpdate geçmiş): o listeye bağlı soru UNKNOWN → INDETERMINATE; Tamga listesi sağlıklı kalır", async () => {
    const { trust } = await federated({ nextUpdate: new Date(Date.now() - 60_000) });
    expect(trust.freshness().healthy).toBe(true);
    // bayat listenin çapası kök kümesine girmez; zincir için çapayı elle ekleyip kararın UNKNOWN olduğunu da gösteririz
    expect(trust.externalAnchorCertsDer?.()).toEqual([]);
    expect(trust.externalIssuerByAnchor?.(fp(pidCa.der), PID_VCT, Math.floor(Date.now() / 1000))?.tri).toBe("UNKNOWN");
  });

  it("C3: dış kurumu politikanın ülkesi tanımıyorsa RED", async () => {
    const { trust } = await federated({
      scope: {
        entity_kinds: ["pid_provider"],
        vct: [PID_VCT],
        category: "IDENTITY",
        assurance: "I3",
        recognized_by: ["KZ"],
      },
    });
    const { result } = await presentPid(trust);
    expect(result.outcome).toBe("REJECTED");
    expect(result.failed_step).toBe("C3");
  });

  it("bilinmeyen LoTE sürümü (CMP2) → liste yüklenmez", async () => {
    const { trust, warnings } = await federated({ version: 9 });
    expect(warnings.some((w) => /LoTEVersionIdentifier/.test(w))).toBe(true);
    expect(trust.externalAnchorCertsDer?.()).toEqual([]);
  });

  it("dış cüzdan sağlayıcısı: kapsamdaysa tanınır; kapsam anahtar deposu kuralı kurumunkinden sıkıysa uygulanır", async () => {
    const { trust } = await federated({});
    const wpFp = fp(walletProvider.der);
    expect(trust.isWalletProviderKey(wpFp)).toBe("YES");
    expect(trust.walletProviderMinKeyStorage?.(wpFp)).toBe("secure_enclave");
    const holder = (await webcrypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
    const now = Math.floor(Date.now() / 1000);
    const wua = await new SignJWT({
      iss: "https://wallet.example.test",
      sub: "test-wallet",
      cnf: { jwk: await exportJWK(holder.publicKey) },
      wallet_name: "Test Wallet",
      wallet_version: "1.0",
      solution_id: "test-wallet",
      key_storage: "tee",
      user_auth: "system_biometry",
      iat: now,
      exp: now + 600,
    })
      .setProtectedHeader({ alg: "ES256", typ: "oauth-client-attestation+jwt", x5c: [b64(walletProvider.der)] })
      .sign(walletProvider.keys.privateKey);
    const pop = await new SignJWT({ iss: "test-wallet", aud: "https://issuer.example.test", jti: "j1", iat: now })
      .setProtectedHeader({ alg: "ES256", typ: "oauth-client-attestation-pop+jwt" })
      .sign(holder.privateKey);
    const base = {
      wua,
      pop,
      issuerUrl: "https://issuer.example.test",
      now,
      isProviderKey: (f: string) => trust.isWalletProviderKey(f),
      minKeyStorage: "software" as const,
    };
    const strict = await verifyWalletAttestation({
      ...base,
      minKeyStorageFor: (f) => trust.walletProviderMinKeyStorage?.(f) ?? null,
    });
    expect(strict.ok).toBe(false);
    if (!strict.ok) expect(strict.reason).toMatch(/secure_enclave/);
    const lax = await verifyWalletAttestation(base);
    expect(lax.ok).toBe(true);
    // kapsamda wallet_provider yoksa aynı sertifika tanınmaz (FD2)
    const { trust: t2 } = await federated({
      scope: { entity_kinds: ["pid_provider"], vct: [PID_VCT], category: "IDENTITY", assurance: "I3" },
    });
    expect(t2.isWalletProviderKey(wpFp)).toBe("NO");
  });

  it("kurcalanmış iç içe disclosure (eşleşmeyen) → A5 RED", async () => {
    const { trust } = await federated({});
    const now = Math.floor(Date.now() / 1000);
    const ref = `pidt-${Math.random().toString(36).slice(2, 8)}`;
    const cnf = await keys.generate(ref);
    const combined = await issuePid(pidIssuer, cnf as unknown as Record<string, unknown>, now, true);
    const { verifySdJwtVc } = await import("@tamga-network/sd-jwt");
    const r = await verifySdJwtVc(combined, {
      aud: AUD,
      nonce: "n",
      stateCode: "TR",
      rootCertsDer: [...ownRoot, ...(trust.externalAnchorCertsDer?.() ?? [])],
      requireKb: false,
      allowMissingVctIntegrity: true,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failedStep).toBe("A5");
  });
});
