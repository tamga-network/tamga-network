/**
 * Sandbox test kurumları (ADR-0041, TI1/TI2/TI5) — liste yayıncısının sandbox'a özel kayıt yolu.
 *  - Yaprak sertifikalar (belge + iptal listesi) sandbox'ın test kurumları ara sertifika makamınca (`test-institutions-ca`,
 *    yol uzunluğu 0) kısa süreli verilir; sandbox kökünün özel anahtarı gerekmez ve sunucuda yoktur (TI1).
 *  - Anahtarlar ve kayıtlar `TAMGA_SANDBOX_SELF_DIR` klasöründe durur (sandbox veri klasörünün içinde; gece sıfırlaması siler —
 *    TI5). Kayıtlar listeye `test_institution: true` ile girer (TI2); gerçek ağın kayıt defterinde bu yol kapalıdır.
 *  - Saf yardımcılar burada; dosya yazımı, kilit ve listenin imzalanması `cli.ts`'te (`sandbox-institution add`).
 */
import {
  X509CertificateGenerator,
  X509Certificate as PX509,
  cryptoProvider,
  KeyUsageFlags,
  KeyUsagesExtension,
  BasicConstraintsExtension,
  SubjectKeyIdentifierExtension,
  AuthorityKeyIdentifierExtension,
} from "@peculiar/x509";
import { webcrypto, X509Certificate, randomBytes } from "node:crypto";

cryptoProvider.set(webcrypto as unknown as Crypto);
const subtle = (webcrypto as unknown as Crypto).subtle;
const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;

/** ADR-0041 K7: aynı anda en çok bu kadar test kurumu (liste yayıncısı da denetler). */
export const MAX_TEST_INSTITUTIONS = 30;
/** ADR-0041 K4: test kurumu sertifikası en çok 30 gün (gece sıfırlaması zaten siler). */
export const TEST_CERT_DAYS = 30;
export const TEST_CA = "test-institutions-ca";
const SLUG = /^t-[a-z0-9]{6,12}$/;
// ADR-0041: Aşama 1 eğitim (öğrenci belgesi, diploma); aşama 2 etkinlik bileti
export const TEST_KINDS = {
  education: {
    category: "EDUCATION",
    vcts: ["urn:tamga:edu:StudentCredential:1", "urn:tamga:edu:DiplomaCredential:1"],
  },
} as const;
export type TestKind = keyof typeof TEST_KINDS;

export interface TestInstitutionRequest {
  slug: string;
  /** Görünen ad (kullanıcının yazdığı uydurma ad + " (TEST)") */
  name: string;
  kind: TestKind;
  issuer_url: string;
  status_list_base: string;
}

/** Sertifika konusuna girecek ASCII ad: Türkçe harfler sadeleşir, ayraç ve tırnak atılır, en çok 48 karakter. */
export function asciiName(name: string): string {
  const map: Record<string, string> = {
    ı: "i",
    İ: "I",
    ğ: "g",
    Ğ: "G",
    ş: "s",
    Ş: "S",
    ç: "c",
    Ç: "C",
    ö: "o",
    Ö: "O",
    ü: "u",
    Ü: "U",
    ə: "e",
    Ə: "E",
  };
  const s = name
    .replace(/\(TEST\)/gi, "")
    .replace(/[ıİğĞşŞçÇöÖüÜəƏ]/g, (c) => map[c] ?? c)
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/[,=+<>#;"\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48)
    .trim();
  return s || "Test Institution";
}

export function validateRequest(r: Partial<TestInstitutionRequest>): string[] {
  const p: string[] = [];
  if (!SLUG.test(String(r.slug ?? ""))) p.push("slug: t-<6–12 küçük harf/rakam>");
  if (!r.name || r.name.length < 3 || r.name.length > 80 || !/\(TEST\)$/.test(r.name))
    p.push('name: 3–80 karakter ve "(TEST)" ile biter (TI2)');
  if (!r.kind || !(r.kind in TEST_KINDS)) p.push(`kind: ${Object.keys(TEST_KINDS).join(" | ")}`);
  for (const k of ["issuer_url", "status_list_base"] as const)
    if (!/^https?:\/\//.test(String(r[k] ?? ""))) p.push(`${k}: http(s) adres`);
  return p;
}

async function pkcs8Pem(k: CryptoKey) {
  const der = Buffer.from(await subtle.exportKey("pkcs8", k));
  return `-----BEGIN PRIVATE KEY-----\n${der
    .toString("base64")
    .match(/.{1,64}/g)!
    .join("\n")}\n-----END PRIVATE KEY-----\n`;
}
async function importKey(pem: string) {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  return subtle.importKey("pkcs8", Buffer.from(b64, "base64"), ALG, false, ["sign"]);
}

/**
 * Ara makamla bir yaprak sertifika: konu "(TEST)" taşır (SB1 denetimi), yalnız dijital imza, AKI = ara makamın SKI'si.
 * Dönen PEM'ler çağıranca `<selfDir>/pki/` altına yazılır.
 */
export async function issueLeaf(
  ca: { certPem: string; keyPem: string },
  subject: string,
  now = new Date(),
): Promise<{ certPem: string; keyPem: string }> {
  if (!/\(TEST\)/.test(subject)) throw new Error("SB1: test kurumu sertifikası (TEST) taşımalı");
  const caCert = new PX509(ca.certPem);
  const caKey = await importKey(ca.keyPem);
  const kp = (await subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
  const cert = await X509CertificateGenerator.create({
    serialNumber: "7" + randomBytes(8).toString("hex"),
    subject,
    issuer: caCert.subject,
    notBefore: new Date(now.getTime() - 60_000),
    notAfter: new Date(now.getTime() + TEST_CERT_DAYS * 86400_000),
    signingAlgorithm: ALG,
    publicKey: kp.publicKey,
    signingKey: caKey,
    extensions: [
      new BasicConstraintsExtension(false, undefined, true),
      new KeyUsagesExtension(KeyUsageFlags.digitalSignature, true),
      await SubjectKeyIdentifierExtension.create(kp.publicKey),
      await AuthorityKeyIdentifierExtension.create(caCert.publicKey),
    ] as never,
  });
  return { certPem: cert.toString("pem") + "\n", keyPem: await pkcs8Pem(kp.privateKey) };
}

/** TI1: sertifika test kurumları ara makamınca imzalanmış mı (yayıncı listeye almadan önce denetler). */
export function issuedByTestCa(leafPem: string, caPem: string): boolean {
  try {
    const leaf = new X509Certificate(leafPem);
    const ca = new X509Certificate(caPem);
    return leaf.issuer === ca.subject && leaf.verify(ca.publicKey) && /\(TEST\)/.test(leaf.subject);
  } catch {
    return false;
  }
}

/** Kaynak kaydı (liste yayıncısının `issuers[]` biçimi; `cert` = `self:<ad>` → test kurumu klasöründen). */
export function testInstitutionSource(r: TestInstitutionRequest, now: Date): Record<string, unknown> {
  const k = TEST_KINDS[r.kind];
  const iso = now.toISOString();
  return {
    cert: `self:issuer-${r.slug}`,
    status_cert: `self:issuer-${r.slug}-status`,
    parent_ca: "root-ca",
    slug: r.slug,
    legal_name: r.name,
    category: k.category,
    assurance: "I2",
    class: "EAA",
    test_institution: true,
    assurance_basis:
      "Sandbox test institution opened by self-service (ADR-0041). Not verified; made-up data only; deleted at the nightly reset. Credentials are signed with test keys and are not valid anywhere.",
    issuer_url: r.issuer_url,
    status_list_base: r.status_list_base,
    status: "ACTIVE",
    valid_from: iso,
    valid_until: new Date(now.getTime() + TEST_CERT_DAYS * 86400_000).toISOString(),
    successor_id: null,
    status_history: [{ status: "ACTIVE", since: iso, reason: "sandbox-self-service" }],
    schema_authorizations: k.vcts.map((vct) => ({ vct, allowed: true, valid_from: iso, valid_until: null })),
    authentic_source: { name: "Sandbox test institution registry", mode: "PORTAL_DB" },
    trade_name: r.name,
    identifiers: [{ scheme: "TR-VKN", value: "TR0000000000", note: "sandbox test value" }],
    postal_address: { street_address: "Sandbox (test) — no real address", locality: "Istanbul", country: "TR" },
    contact: { support_uri: "https://sandbox.tamga.network" },
    supervisory_authority: {
      name: "Kişisel Verileri Koruma Kurumu (KVKK)",
      country: "TR",
      info_uri: "https://www.kvkk.gov.tr",
      form_uri: "https://www.kvkk.gov.tr",
    },
  };
}

/** Ara makamın ad kısıtı (gen-pki.ts ile aynı): yaprak konu adları bu ön ekle başlar. */
export const TEST_INSTITUTIONS_SUBTREE = "C=TR, OU=Tamga Sandbox Test Institutions";
/** Sertifika konu adları (belge + iptal listesi) — ad kısıtı ön ekiyle başlar (RDN sırası C, OU, O, CN). */
export const subjects = (name: string) => {
  const n = asciiName(name);
  return {
    credential: `${TEST_INSTITUTIONS_SUBTREE}, O=${n} (TEST), CN=${n} (TEST)`,
    status: `${TEST_INSTITUTIONS_SUBTREE}, O=${n} (TEST), CN=${n} - Status List (TEST)`,
  };
};
