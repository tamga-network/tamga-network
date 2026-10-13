/** ADR-0046 K3: sertifikadan konu adı, veren adı, seri numarası; güven kökü ve konu adı eşleşmeleri. */
import { describe, it, expect, beforeAll } from "vitest";
import { createHash, webcrypto } from "node:crypto";
import { X509CertificateGenerator, cryptoProvider } from "@peculiar/x509";
import {
  anchoredChainCerts,
  certNames,
  certMatchesRootOfTrust,
  certSubjectMatches,
  isSelfSigned,
  verifiedChainPrefix,
  verifyCertSignature,
} from "./x509-names.js";

cryptoProvider.set(webcrypto as unknown as Crypto);
const crypto = webcrypto as unknown as Crypto;
const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;

let root: Uint8Array, leaf: Uint8Array;
beforeAll(async () => {
  const rk = (await crypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
  const lk = (await crypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
  const r = await X509CertificateGenerator.createSelfSigned({
    serialNumber: "0a1b2c",
    name: "CN=Example Root CA, O=Example, C=TR",
    notBefore: new Date(0),
    notAfter: new Date("2099-01-01"),
    signingAlgorithm: ALG,
    keys: rk,
  });
  const l = await X509CertificateGenerator.create({
    serialNumber: "77",
    subject: "CN=verifier.example, O=Example Ltd, 2.5.4.97=VATTR-1234567890, C=TR",
    issuer: r.subject,
    notBefore: new Date(0),
    notAfter: new Date("2099-01-01"),
    signingAlgorithm: ALG,
    publicKey: lk.publicKey,
    signingKey: rk.privateKey,
  });
  root = new Uint8Array(r.rawData);
  leaf = new Uint8Array(l.rawData);
});

describe("certNames", () => {
  it("konu, veren ve seri numarası", () => {
    const n = certNames(leaf);
    expect(n.serialHex).toBe("77");
    expect(n.subject).toEqual([
      { oid: "2.5.4.3", value: "verifier.example" },
      { oid: "2.5.4.10", value: "example ltd" },
      { oid: "2.5.4.97", value: "vattr-1234567890" },
      { oid: "2.5.4.6", value: "tr" },
    ]);
    expect(n.issuer.map((a) => a.oid)).toEqual(["2.5.4.3", "2.5.4.10", "2.5.4.6"]);
    expect(() => certNames(new Uint8Array([1, 2, 3]))).toThrow();
  });
  it("konu adı eşleşmesi (ETSI -07a; ORGID)", () => {
    expect(certSubjectMatches(leaf, "C=TR,ORGID=VATTR-1234567890,O=Example Ltd,CN=verifier.example")).toBe(true);
    expect(certSubjectMatches(leaf, "ORGID=VATTR-1234567890,O=Example Ltd,C=TR")).toBe(false); // CN eksik
  });
  it("güven kökü (ETSI -09): veren adı + seri numarası; kendinden imzalı kökte konu = veren", () => {
    expect(
      certMatchesRootOfTrust(root, { issuer_dn: "C=TR,O=Example,CN=Example Root CA", serial_number: "0A1B2C" }),
    ).toBe(true);
    expect(
      certMatchesRootOfTrust(root, { issuer_dn: "C=TR,O=Example,CN=Example Root CA", serial_number: "0a1b2d" }),
    ).toBe(false);
    // yaprak: IssuerSerial (kökün adı + yaprağın seri numarası)
    expect(certMatchesRootOfTrust(leaf, { issuer_dn: "CN=Example Root CA,O=Example,C=TR", serial_number: "77" })).toBe(
      true,
    );
    expect(certMatchesRootOfTrust(leaf, { issuer_dn: "CN=Other CA", serial_number: "77" })).toBe(false);
  });
});

describe("imza zinciri (ADR-0046 K3 güven kökü)", () => {
  type Alg = RsaHashedKeyGenParams | EcKeyGenParams;
  const algs: Record<string, { gen: Alg & { hash?: string }; sign: Algorithm & Record<string, unknown> }> = {
    ES256: { gen: { name: "ECDSA", namedCurve: "P-256" }, sign: { name: "ECDSA", hash: "SHA-256" } },
    ES384: { gen: { name: "ECDSA", namedCurve: "P-384" }, sign: { name: "ECDSA", hash: "SHA-384" } },
    RS256: {
      gen: {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      sign: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    },
    PS256: {
      gen: { name: "RSA-PSS", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
      sign: { name: "RSA-PSS", hash: "SHA-256", saltLength: 32 },
    },
  };
  const keys = (a: keyof typeof algs) =>
    crypto.subtle.generateKey(algs[a].gen, true, ["sign", "verify"]) as Promise<CryptoKeyPair>;
  const selfSigned = async (name: string, serial: string, kp: CryptoKeyPair, a: keyof typeof algs = "ES256") =>
    new Uint8Array(
      (
        await X509CertificateGenerator.createSelfSigned({
          serialNumber: serial,
          name,
          notBefore: new Date(0),
          notAfter: new Date("2099-01-01"),
          signingAlgorithm: algs[a].sign,
          keys: kp,
        })
      ).rawData,
    );
  const issued = async (
    subject: string,
    serial: string,
    pub: CryptoKey,
    issuerName: string,
    signingKey: CryptoKey,
    a: keyof typeof algs = "ES256",
  ) =>
    new Uint8Array(
      (
        await X509CertificateGenerator.create({
          serialNumber: serial,
          subject,
          issuer: issuerName,
          notBefore: new Date(0),
          notAfter: new Date("2099-01-01"),
          signingAlgorithm: algs[a].sign,
          publicKey: pub,
          signingKey,
        })
      ).rawData,
    );
  const fp = (der: Uint8Array) => createHash("sha256").update(der).digest("hex");
  const ROOT = "CN=Policy Root CA, O=Root Org, C=TR";
  const ROT = { issuer_dn: "C=TR,O=Root Org,CN=Policy Root CA", serial_number: "5a" };

  it.each(Object.keys(algs))(
    "verifyCertSignature %s: doğru imza geçer, bozuk imza ve başka anahtar geçmez",
    async (a) => {
      const alg = a as keyof typeof algs;
      const ca = await keys(alg);
      const other = await keys(alg);
      const leafKp = await keys("ES256");
      const caDer = await selfSigned("CN=CA " + a, "01", ca, alg);
      const otherDer = await selfSigned("CN=CA " + a, "01", other, alg);
      const leafDer = await issued("CN=leaf", "02", leafKp.publicKey, "CN=CA " + a, ca.privateKey, alg);
      expect(verifyCertSignature(leafDer, caDer)).toBe(true);
      expect(isSelfSigned(caDer)).toBe(true);
      expect(verifyCertSignature(leafDer, otherDer)).toBe(false);
      const broken = leafDer.slice();
      broken[broken.length - 3] ^= 0x01;
      expect(verifyCertSignature(broken, caDer)).toBe(false);
      const tbsTampered = leafDer.slice();
      tbsTampered[20] ^= 0x01; // seri numarası baytı
      expect(verifyCertSignature(tbsTampered, caDer)).toBe(false);
    },
  );

  it("verifiedChainPrefix ilk kırılmada durur; eklenmiş kök (imzalamamış) zincire girmez", async () => {
    const rk = await keys("ES256");
    const lk = await keys("ES256");
    const root = await selfSigned(ROOT, "5a", rk);
    const genuineLeaf = await issued("CN=svc", "10", lk.publicKey, ROOT, rk.privateKey);
    const selfLeaf = await selfSigned("CN=svc", "10", lk);
    expect(verifiedChainPrefix([genuineLeaf, root])).toHaveLength(2);
    expect(verifiedChainPrefix([selfLeaf, root])).toHaveLength(1); // ad tutmuyor
    // ad tutuyor ama imza başka anahtarla
    const ak = await keys("ES256");
    const forgedLeaf = await issued("CN=svc", "10", lk.publicKey, ROOT, ak.privateKey);
    expect(verifiedChainPrefix([forgedLeaf, root])).toHaveLength(1);
  });

  it("anchoredChainCerts: güvenilir yaprak + kendinden imzalı veren; çapa; çapasız güvenilmeyen yaprak boş", async () => {
    const rk = await keys("ES256");
    const ik = await keys("ES256");
    const lk = await keys("ES256");
    const root = await selfSigned(ROOT, "5a", rk);
    const inter = await issued("CN=Inter CA, C=TR", "6b", ik.publicKey, ROOT, rk.privateKey);
    const leaf = await issued("CN=svc", "10", lk.publicKey, "CN=Inter CA, C=TR", ik.privateKey);
    const direct = await issued("CN=svc", "11", lk.publicKey, ROOT, rk.privateKey);
    expect(anchoredChainCerts([direct, root], { leafTrusted: true })).toHaveLength(2);
    expect(anchoredChainCerts([direct, root])).toHaveLength(0);
    // ara sertifika kendinden imzalı değil: çapasız yalnız yaprak
    expect(anchoredChainCerts([leaf, inter, root], { leafTrusted: true })).toHaveLength(1);
    expect(anchoredChainCerts([leaf, inter, root], { anchorFingerprints: [fp(root)] })).toHaveLength(3);
    expect(anchoredChainCerts([leaf, inter, root], { anchorFingerprints: [fp(inter).toUpperCase()] })).toHaveLength(2);
    // kopya kök (aynı ad ve seri, başka anahtar) kendi imzaladığı zinciri çapaya bağlayamaz
    const ak = await keys("ES256");
    const fakeRoot = await selfSigned(ROOT, "5a", ak);
    const fakeLeaf = await issued("CN=svc", "12", lk.publicKey, ROOT, ak.privateKey);
    expect(verifiedChainPrefix([fakeLeaf, fakeRoot])).toHaveLength(2);
    expect(anchoredChainCerts([fakeLeaf, fakeRoot], { anchorFingerprints: [fp(root)] })).toHaveLength(0);
    expect(certMatchesRootOfTrust(fakeRoot, ROT)).toBe(true); // ad karşılaştırması tek başına yetmez
  });

  it("anchoredChainCerts: kök x5c'de yok — son sertifikayı listedeki kök sertifikası imzalamışsa çapalanır", async () => {
    const rk = await keys("ES256");
    const ik = await keys("ES256");
    const lk = await keys("ES256");
    const root = await selfSigned(ROOT, "5a", rk);
    const inter = await issued("CN=Inter CA, C=TR", "6b", ik.publicKey, ROOT, rk.privateKey);
    const leaf = await issued("CN=svc", "10", lk.publicKey, "CN=Inter CA, C=TR", ik.privateKey);
    // [yaprak, ara] — kök yok; çapa kök sertifikası: zincir + çapa
    const out = anchoredChainCerts([leaf, inter], { anchorCertificates: [root] });
    expect(out).toHaveLength(3);
    expect(out[2]).toBe(root);
    // yalnız parmak izi verilirse kökü x5c'de olmayan zincir bağlanamaz (anahtar yok)
    expect(anchoredChainCerts([leaf, inter], { anchorFingerprints: [fp(root)] })).toHaveLength(0);
    // doğrudan kökten verilmiş yaprak, x5c yalnız yaprak
    const direct = await issued("CN=svc", "11", lk.publicKey, ROOT, rk.privateKey);
    expect(anchoredChainCerts([direct], { anchorCertificates: [root] })).toHaveLength(2);
    // listede olmayan kök (aynı ad, başka anahtar) çapalamaz
    const ok = await keys("ES256");
    const otherRoot = await selfSigned(ROOT, "5a", ok);
    expect(anchoredChainCerts([leaf, inter], { anchorCertificates: [otherRoot] })).toHaveLength(0);
    // listede olmayan kökün imzaladığı zincir, listedeki kökle bağlanamaz
    const otherInter = await issued("CN=Inter CA, C=TR", "6c", ik.publicKey, ROOT, ok.privateKey);
    expect(anchoredChainCerts([leaf, otherInter], { anchorCertificates: [root] })).toHaveLength(0);
    // çapa sertifikası x5c'de de varsa parmak iziyle eşleşir
    expect(anchoredChainCerts([leaf, inter, root], { anchorCertificates: [root] })).toHaveLength(3);
  });

  it("güven kökü öğesi yalnız VEREN adı + seri numarasıyla eşleşir (konu adı yedeği yok)", async () => {
    const rk = await keys("ES256");
    const lk = await keys("ES256");
    const leaf = await issued("CN=Svc Name, C=TR", "10", lk.publicKey, ROOT, rk.privateKey);
    expect(certMatchesRootOfTrust(leaf, { issuer_dn: "C=TR,CN=Svc Name", serial_number: "10" })).toBe(false);
    expect(certMatchesRootOfTrust(leaf, { issuer_dn: ROT.issuer_dn, serial_number: "10" })).toBe(true);
  });
});
