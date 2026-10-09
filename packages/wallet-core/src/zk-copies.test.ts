/**
 * ADR-0044 — ZK kopyaları (cüzdan tarafı): zamanlama (pencere + rastgele gecikme, kopya yoksa hemen), seçim, alınan kopyanın
 * denetimi (aynı kurum sertifikası, tür, cihaz anahtarı, durum listesi yok, ≤ 24 saat). Uçtan uca yenileme (belirteç değişimi,
 * iptal sonrası red) kimlik servisinin testinde (operatör deposu).
 */
import { describe, expect, it } from "vitest";
import { randomBytes, webcrypto } from "node:crypto";
import { X509CertificateGenerator } from "@peculiar/x509";
import { issueMdoc, p256 } from "@tamga-network/mdoc";
import {
  ZK_COPY_VCT,
  ZK_REFRESH_JITTER_SEC,
  ZK_REFRESH_WINDOW_SEC,
  b64u,
  certFingerprintHex,
  checkZkCopy,
  newState,
  scheduleZkRefreshes,
  selectZkCopy,
  validZkCopies,
  zkCopiesDue,
  type PublicJwk,
  type StoredCredential,
  type ZkCopy,
} from "./index.js";

const NOW = 1_800_000_000;
const NO_KEY: PublicJwk = { kty: "EC", crv: "P-256", x: "", y: "" };
const copy = (keyRef: string, validUntil: number, validFrom = validUntil - 24 * 3600): ZkCopy => ({
  keyRef,
  cnf: NO_KEY,
  mdoc: "x",
  validFrom,
  validUntil,
});
const cred = (copies: ZkCopy[], extra: Partial<StoredCredential> = {}): StoredCredential => ({
  id: "id1",
  vct: "urn:tamga:id:IdentityAttestation:1",
  typeName: "Kimlik",
  issuer: "https://id.example",
  issuerId: "0x1",
  leafFingerprint: "f",
  iat: 1,
  claims: {},
  disclosureNames: [],
  copies: [],
  receivedAt: 1,
  zk: {
    docType: ZK_COPY_VCT,
    configurationId: ZK_COPY_VCT,
    token: "t",
    tokenEndpoint: "https://id.example/token",
    dpopRef: "d",
    dpopJwk: NO_KEY,
    copies,
  },
  ...extra,
});

describe("ADR-0044 — ZK kopyası zamanlaması ve seçimi", () => {
  it("geçerli kopya yoksa hemen; pencere dışında değil; pencere içinde bitişten önce rastgele", () => {
    const empty = scheduleZkRefreshes({ ...newState("w"), credentials: [cred([])] }, NOW, () => 0.9);
    expect(empty.due).toEqual(["id1"]);
    expect(empty.state.credentials[0].zk?.dueAt).toBe(NOW);
    const fresh = cred([copy("a", NOW + 20 * 3600)]);
    expect(zkCopiesDue(fresh, NOW)).toBe(false);
    const s = scheduleZkRefreshes({ ...newState("w"), credentials: [fresh] }, NOW, () => 0.5);
    expect(s.due).toEqual([]);
    expect(s.state.credentials[0].zk?.dueAt).toBeUndefined();
    const ending = cred([copy("a", NOW + 3 * 3600)]);
    expect(zkCopiesDue(ending, NOW)).toBe(true);
    const sch = scheduleZkRefreshes({ ...newState("w"), credentials: [ending] }, NOW, () => 0.999);
    const dueAt = sch.state.credentials[0].zk!.dueAt!;
    expect(dueAt).toBeGreaterThanOrEqual(NOW);
    expect(dueAt).toBeLessThan(NOW + 3 * 3600 - 30 * 60); // bitişten en az 30 dk önce
    expect(dueAt - NOW).toBeLessThanOrEqual(ZK_REFRESH_JITTER_SEC);
    expect(ZK_REFRESH_WINDOW_SEC).toBeGreaterThan(ZK_REFRESH_JITTER_SEC);
  });
  it("iptal/askıdaki ya da yerelde iptal edilen belgede ZK kopyası yenilenmez (ZC2)", () => {
    for (const extra of [
      { status: { value: "revoked" as const, checkedAt: NOW } },
      { status: { value: "suspended" as const, checkedAt: NOW } },
      { revokedLocally: true },
    ]) {
      const c = cred([], extra);
      expect(zkCopiesDue(c, NOW)).toBe(false);
      expect(scheduleZkRefreshes({ ...newState("w"), credentials: [c] }, NOW).due).toEqual([]);
    }
  });
  it("seçim: süresi dolan ya da bitişine 2 dk'dan az kalan kullanılmaz; en geç biten seçilir", () => {
    const c = cred([copy("old", NOW + 60), copy("mid", NOW + 3600), copy("new", NOW + 7200)]);
    expect(validZkCopies(c, NOW).map((k) => k.keyRef)).toEqual(["mid", "new"]);
    expect(selectZkCopy(c, NOW)?.keyRef).toBe("new");
    expect(selectZkCopy(cred([copy("x", NOW - 1)]), NOW)).toBeNull();
    expect(selectZkCopy(cred([copy("future", NOW + 7200, NOW + 3600)]), NOW)).toBeNull();
  });
});

describe("ADR-0044 — alınan ZK kopyasının denetimi (checkZkCopy)", async () => {
  const subtle = webcrypto.subtle;
  const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;
  const issuerSk = p256.utils.randomSecretKey();
  const issuerPub = p256.getPublicKey(issuerSk, false);
  const signer = (await subtle.generateKey(ALG, false, ["sign", "verify"])) as CryptoKeyPair;
  const cert = await X509CertificateGenerator.create({
    serialNumber: "07",
    subject: "CN=Tamga ZK Copy Test Issuer,O=Tamga Network Test,C=TR",
    issuer: "CN=Tamga ZK Copy Test Root,O=Tamga Network Test,C=TR",
    notBefore: new Date((NOW - 86400) * 1000),
    notAfter: new Date((NOW + 365 * 86400) * 1000),
    publicKey: await subtle.importKey("raw", issuerPub, ALG, true, ["verify"]),
    signingKey: signer.privateKey,
    signingAlgorithm: ALG,
  });
  const leaf = new Uint8Array(cert.rawData);
  const fp = certFingerprintHex(leaf);
  const devicePub = p256.getPublicKey(p256.utils.randomSecretKey(), false);
  const cnf: PublicJwk = {
    kty: "EC",
    crv: "P-256",
    x: b64u(devicePub.subarray(1, 33)),
    y: b64u(devicePub.subarray(33)),
  };
  const make = (o: { validity?: number; status?: boolean; docType?: string; device?: Uint8Array } = {}) =>
    b64u(
      issueMdoc({
        docType: o.docType ?? ZK_COPY_VCT,
        namespaces: { "tamga.id.1": { age_over_18: true } },
        deviceKeyRaw: o.device ?? devicePub,
        issuerSk,
        x5chain: [leaf],
        signed: NOW - 60,
        validFrom: NOW - 60,
        validUntil: NOW - 60 + (o.validity ?? 24 * 3600),
        randomBytes: (n) => new Uint8Array(randomBytes(n)),
        ...(o.status ? { status: { idx: 1, uri: "https://id.example/status/x" } } : {}),
      }).issuerSigned,
    );
  const ctx = { docType: ZK_COPY_VCT, cnf, leafFingerprint: fp, now: NOW };
  it("geçerli kopya: geçerlilik penceresi döner", () => {
    expect(checkZkCopy(make(), ctx)).toEqual({ validFrom: NOW - 60, validUntil: NOW - 60 + 24 * 3600 });
  });
  it("başka kurum (MD3), başka tür, başka cihaz anahtarı (MD2), durum listesi ya da 24 saatten uzun geçerlilik (ZC1) → red", () => {
    expect(() => checkZkCopy(make(), { ...ctx, leafFingerprint: "00" })).toThrow(/MD3/);
    expect(() => checkZkCopy(make({ docType: "urn:tamga:id:IdentityAttestation:1" }), ctx)).toThrow(/docType/);
    expect(() => checkZkCopy(make({ device: p256.getPublicKey(p256.utils.randomSecretKey(), false) }), ctx)).toThrow(
      /MD2/,
    );
    expect(() => checkZkCopy(make({ status: true }), ctx)).toThrow(/status list/);
    expect(() => checkZkCopy(make({ validity: 25 * 3600 }), ctx)).toThrow(/24 hours/);
  });
});
