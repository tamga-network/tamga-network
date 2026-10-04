/**
 * ops/gen-pki.ts — Geliştirme PKI'sı (DEMO / DEV ONLY)
 *
 * Üretir (P-256, ES256):
 *   1. TR National Root CA (provisional operator: Tamga)  — self-signed, çevrimdışı kök muadili
 *   2. İstanbul Bilgi Üniversitesi issuer sertifikası — kökçe imzalı yaprak
 *   2b. Bilgi status list anahtarı (K1: credential anahtarından ayrı)
 *   3. Tamga Trust List signing cert (TLSO)                — self-signed; lotl/tl/anchors imzalar
 *   4. Tamga Wallet Provider cert                          — self-signed; WUA imzalar
 *   5. Referans verifier erişim sertifikası (rp-verify)    — kökçe imzalı; SAN dns verify.tamga.network; istek nesnesini imzalar
 *
 * Sandbox (ADR-0038, SB1): `--profile=sandbox` ayrı bir test kökü ve yaprakları `ops/pki-sandbox/`'a üretir; gerçek PKI ile
 * hiçbir anahtar paylaşılmaz. Konu adları "… (TEST)"; örnek kurumlar `istanbul-bilgi`, `bubilet`, `paribu-cineverse` (gerçek
 * kurum adları yalnız gerçekçi bir deneme için; kurumlarla ilişki ya da anlaşma yok, belgeler test anahtarıyla imzalı ve geçersiz).
 * Kip: eksik olan sertifikalar üretilir, var olanlar KORUNUR (issuer_id değişmez); tamamını yenilemek için --force.
 * Sapma S-1 (09-DEMO-KURGU §6): issuer özel anahtarı burada dosyada; pilotta üniversite KMS'inde.
 * Çıktı: ops/pki/*.cert.pem, *.pkcs8.pem (gitignore), ops/pki/pki.json (parmak izleri, id'ler).
 */
import {
  X509CertificateGenerator,
  cryptoProvider,
  KeyUsageFlags,
  KeyUsagesExtension,
  BasicConstraintsExtension,
  SubjectKeyIdentifierExtension,
  AuthorityKeyIdentifierExtension,
  SubjectAlternativeNameExtension,
  X509Certificate,
} from "@peculiar/x509";
import { webcrypto } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { computeCaId, computeIssuerId, computeRpId, certFingerprintSha256Hex, pemToDer } from "@tamga-network/core";

cryptoProvider.set(webcrypto as unknown as Crypto);
const crypto = webcrypto as unknown as Crypto;

const here = dirname(fileURLToPath(import.meta.url));
const PROFILE = (process.argv.find((a) => a.startsWith("--profile="))?.slice(10) ?? "network") as "network" | "sandbox";
if (PROFILE !== "network" && PROFILE !== "sandbox") throw new Error(`bilinmeyen profil: ${PROFILE}`);
const outDir = resolve(here, PROFILE === "sandbox" ? "pki-sandbox" : "pki");
mkdirSync(outDir, { recursive: true });

const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;
const STATE = "TR";
const FORCE = process.argv.includes("--force");

const keys = () => crypto.subtle.generateKey(ALG, true, ["sign", "verify"]) as Promise<CryptoKeyPair>;
async function pkcs8Pem(k: CryptoKey) {
  const der = new Uint8Array(await crypto.subtle.exportKey("pkcs8", k));
  return `-----BEGIN PRIVATE KEY-----\n${Buffer.from(der)
    .toString("base64")
    .match(/.{1,64}/g)!
    .join("\n")}\n-----END PRIVATE KEY-----\n`;
}
async function loadKey(pem: string) {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  return crypto.subtle.importKey("pkcs8", Buffer.from(b64, "base64"), ALG, true, ["sign"]);
}
function years(n: number) {
  const d = new Date();
  d.setFullYear(d.getFullYear() + n);
  return d;
}
const serial = (n: number) => n.toString(16).padStart(4, "0");
const exists = (name: string) =>
  existsSync(resolve(outDir, `${name}.cert.pem`)) && existsSync(resolve(outDir, `${name}.pkcs8.pem`));

interface Item {
  name: string;
  cert: X509Certificate;
  privateKey: CryptoKey;
  created: boolean;
}
async function load(name: string): Promise<Item> {
  const cert = new X509Certificate(readFileSync(resolve(outDir, `${name}.cert.pem`), "utf8"));
  return {
    name,
    cert,
    privateKey: await loadKey(readFileSync(resolve(outDir, `${name}.pkcs8.pem`), "utf8")),
    created: false,
  };
}
async function ensure(
  name: string,
  make: () => Promise<{ cert: X509Certificate; privateKey: CryptoKey }>,
): Promise<Item> {
  if (!FORCE && exists(name)) return load(name);
  const { cert, privateKey } = await make();
  writeFileSync(resolve(outDir, `${name}.cert.pem`), cert.toString("pem") + "\n");
  writeFileSync(resolve(outDir, `${name}.pkcs8.pem`), await pkcs8Pem(privateKey));
  return { name, cert, privateKey, created: true };
}
const leafExt = async (pub: CryptoKey, extra: unknown[] = []) => [
  new BasicConstraintsExtension(false, undefined, true),
  new KeyUsagesExtension(KeyUsageFlags.digitalSignature, true),
  await SubjectKeyIdentifierExtension.create(pub),
  ...extra,
];

async function main() {
  const notBefore = new Date();

  // 1) Root CA
  const root = await ensure("root-ca", async () => {
    const kp = await keys();
    const cert = await X509CertificateGenerator.createSelfSigned({
      serialNumber: serial(1),
      name:
        PROFILE === "sandbox"
          ? "CN=Tamga Sandbox Root CA (TEST), O=Tamga Network Sandbox, C=TR"
          : "CN=TR National Root CA (provisional operator: Tamga), O=Tamga Trust Framework, C=TR",
      notBefore,
      notAfter: years(10),
      signingAlgorithm: ALG,
      keys: kp,
      extensions: [
        new BasicConstraintsExtension(true, 1, true),
        new KeyUsagesExtension(KeyUsageFlags.keyCertSign | KeyUsageFlags.cRLSign, true),
        await SubjectKeyIdentifierExtension.create(kp.publicKey),
      ],
    });
    return { cert, privateKey: kp.privateKey };
  });
  const signedByRoot =
    (serialNo: number, subject: string, extra?: (pub: CryptoKey) => Promise<unknown[]>) => async () => {
      const kp = await keys();
      const cert = await X509CertificateGenerator.create({
        serialNumber: serial(serialNo),
        subject,
        issuer: root.cert.subject,
        notBefore,
        notAfter: years(2),
        signingAlgorithm: ALG,
        publicKey: kp.publicKey,
        signingKey: root.privateKey,
        // RFC 5280 §4.2.1.1: kökçe imzalı sertifikada AKI zorunlu (= kökün SKI'si); OpenID4VP DCQL `trusted_authorities` (aki)
        // eşleşmesi bu alanla yapılır (HAIP §5). Var olan sertifikalar korunur; yeni üretilenler AKI taşır.
        extensions: (await leafExt(kp.publicKey, [
          await AuthorityKeyIdentifierExtension.create(root.cert.publicKey),
          ...(extra ? await extra(kp.publicKey) : []),
        ])) as never,
      });
      return { cert, privateKey: kp.privateKey };
    };
  const selfSigned = (serialNo: number, name: string) => async () => {
    const kp = await keys();
    const cert = await X509CertificateGenerator.createSelfSigned({
      serialNumber: serial(serialNo),
      name,
      notBefore,
      notAfter: years(2),
      signingAlgorithm: ALG,
      keys: kp,
      extensions: [
        new KeyUsagesExtension(KeyUsageFlags.digitalSignature, true),
        await SubjectKeyIdentifierExtension.create(kp.publicKey),
      ],
    });
    return { cert, privateKey: kp.privateKey };
  };

  if (PROFILE === "sandbox") return finish(root, await sandboxItems(root, signedByRoot, selfSigned), notBefore);

  const items: Item[] = [
    root,
    await ensure(
      "issuer-bilgi",
      signedByRoot(1001, "CN=Istanbul Bilgi Universitesi, OU=Ogrenci Isleri, O=Istanbul Bilgi Universitesi, C=TR"),
    ),
    await ensure(
      "issuer-bilgi-status",
      signedByRoot(
        1002,
        "CN=Istanbul Bilgi Universitesi - Status List, OU=Status, O=Istanbul Bilgi Universitesi, C=TR",
      ),
    ),
    await ensure(
      "tl-signer-1",
      selfSigned(2, "CN=Tamga Trust List Signer 1 (provisional TLSO), O=Tamga Network, C=TR"),
    ),
    await ensure("wallet-provider", selfSigned(3, "CN=Tamga Wallet Provider (WUA), O=Tamga Network, C=TR")),
    // ADR-0026 K1: kayıt kurumu anahtarı (WRPRC imzası) — liste imza anahtarından ayrı; LOTL roles.registrar.signing_keys
    await ensure(
      "registrar-1",
      selfSigned(4, "CN=Tamga Registrar 1 (provisional TR registrar), O=Tamga Network, C=TR"),
    ),
    // 5) Referans verifier erişim sertifikası — SAN verify.tamga.network (kayıt dns_name); client_id = x509_hash(bu sertifika) (ADR-0034)
    await ensure(
      "rp-verify",
      signedByRoot(2001, "CN=verify.tamga.network, O=Tamga Dogrulama Servisi, C=TR", async () => [
        new SubjectAlternativeNameExtension([{ type: "dns", value: "verify.tamga.network" }]),
      ]),
    ),
    // 6) ADR-0011: Tamga geçici kimlik attestation servisi (id.tamga.network) — credential + status imza sertifikaları (K1 ayrımı)
    await ensure("issuer-id", signedByRoot(1101, "CN=Tamga Kimlik Servisi, OU=Identity, O=Tamga Network, C=TR")),
    await ensure(
      "issuer-id-status",
      signedByRoot(1102, "CN=Tamga Kimlik Servisi - Status List, OU=Status, O=Tamga Network, C=TR"),
    ),
    // 6b) ADR-0033: mağaza incelemesi deneme imzacısı — gerçek kimlik servisi imzacısından AYRI (RV2); güven listesinde I1
    await ensure(
      "issuer-id-review",
      signedByRoot(1103, "CN=Tamga Kimlik Servisi - Magaza Incelemesi (DEMO), OU=Review, O=Tamga Network, C=TR"),
    ),
    // 8) D10: bilet satıcısı — operatör modeli: Tamga barındırır, satıcı güven listesinde issuer (credential + status)
    await ensure("issuer-bubilet", signedByRoot(1201, "CN=Bubilet, OU=Bilet Satisi, O=Bubilet, C=TR")),
    await ensure("issuer-bubilet-status", signedByRoot(1202, "CN=Bubilet - Status List, OU=Status, O=Bubilet, C=TR")),
    // 7) ADR-0011 K3: kurum issuer'ı kimlik attestation'ını SUNUM olarak ister → RP erişim sertifikası (SAN issuer.tamga.network; client_id = x509_hash, ADR-0034)
    await ensure(
      "rp-issuer-bilgi",
      signedByRoot(
        2002,
        "CN=issuer.tamga.network, O=Istanbul Bilgi Universitesi - kimlik eslestirme, C=TR",
        async () => [new SubjectAlternativeNameExtension([{ type: "dns", value: "issuer.tamga.network" }])],
      ),
    ),
  ];

  await finish(root, items, notBefore);
}

type Make = () => Promise<{ cert: X509Certificate; privateKey: CryptoKey }>;
type SignedByRoot = (serialNo: number, subject: string, extra?: (pub: CryptoKey) => Promise<unknown[]>) => Make;

/** Sandbox (ADR-0038): gerçek ağla aynı dosya adları (servis ayarları değişmesin), test konu adları, sandbox SAN'ı. */
async function sandboxItems(root: Item, signedByRoot: SignedByRoot, selfSigned: (n: number, name: string) => Make) {
  const san = (host: string) => async () => [new SubjectAlternativeNameExtension([{ type: "dns", value: host }])];
  return [
    root,
    await ensure(
      "tl-signer-1",
      selfSigned(2, "CN=Tamga Sandbox Trust List Signer (TEST), O=Tamga Network Sandbox, C=TR"),
    ),
    await ensure(
      "wallet-provider",
      selfSigned(3, "CN=Tamga Sandbox Wallet Provider (TEST), O=Tamga Network Sandbox, C=TR"),
    ),
    await ensure("registrar-1", selfSigned(4, "CN=Tamga Sandbox Registrar (TEST), O=Tamga Network Sandbox, C=TR")),
    await ensure(
      "rp-verify",
      signedByRoot(
        2001,
        "CN=verify.sandbox.tamga.network, O=Tamga Sandbox Dogrulama (TEST), C=TR",
        san("verify.sandbox.tamga.network"),
      ),
    ),
    await ensure(
      "issuer-id",
      signedByRoot(1101, "CN=Tamga Sandbox Kimlik (TEST), OU=Identity, O=Tamga Network Sandbox, C=TR"),
    ),
    await ensure(
      "issuer-id-status",
      signedByRoot(1102, "CN=Tamga Sandbox Kimlik - Status List (TEST), OU=Status, O=Tamga Network Sandbox, C=TR"),
    ),
    // ADR-0033: mağaza inceleme kodu provası sandbox'ta — DEMO imzacısı gerçek ağdakiyle aynı dosya adı, I1 kaydı registry-sandbox'ta
    await ensure(
      "issuer-id-review",
      signedByRoot(
        1103,
        "CN=Tamga Sandbox Kimlik - Magaza Incelemesi DEMO (TEST), OU=Review, O=Tamga Network Sandbox, C=TR",
      ),
    ),
    // Örnek kurumlar: gerçek kurum adları yalnız gerçekçi deneme için (ilişki/anlaşma yok); seri numaraları ilk örnek
    // kurumların (1001/1002/2002/1201/1202, kaldırıldı) numaralarını yeniden kullanmaz.
    await ensure(
      "issuer-istanbul-bilgi",
      signedByRoot(
        1011,
        "CN=Istanbul Bilgi Universitesi (TEST), OU=Ogrenci Isleri, O=Istanbul Bilgi Universitesi (TEST), C=TR",
      ),
    ),
    await ensure(
      "issuer-istanbul-bilgi-status",
      signedByRoot(
        1012,
        "CN=Istanbul Bilgi Universitesi - Status List (TEST), OU=Status, O=Istanbul Bilgi Universitesi (TEST), C=TR",
      ),
    ),
    await ensure(
      "rp-issuer-istanbul-bilgi",
      signedByRoot(
        2012,
        "CN=issuer.sandbox.tamga.network, O=Istanbul Bilgi Universitesi - kimlik eslestirme (TEST), C=TR",
        san("issuer.sandbox.tamga.network"),
      ),
    ),
    await ensure("issuer-bubilet", signedByRoot(1211, "CN=Bubilet (TEST), OU=Bilet Satisi, O=Bubilet (TEST), C=TR")),
    await ensure(
      "issuer-bubilet-status",
      signedByRoot(1212, "CN=Bubilet - Status List (TEST), OU=Status, O=Bubilet (TEST), C=TR"),
    ),
    await ensure(
      "issuer-paribu-cineverse",
      signedByRoot(1301, "CN=Paribu Cineverse (TEST), OU=Bilet Satisi, O=Paribu Cineverse (TEST), C=TR"),
    ),
    await ensure(
      "issuer-paribu-cineverse-status",
      signedByRoot(1302, "CN=Paribu Cineverse - Status List (TEST), OU=Status, O=Paribu Cineverse (TEST), C=TR"),
    ),
  ];
}

async function finish(root: Item, items: Item[], notBefore: Date) {
  const summary: Record<string, unknown> = {
    generated_at: notBefore.toISOString(),
    profile: PROFILE,
    warning:
      PROFILE === "sandbox"
        ? "SANDBOX (TEST) PKI — ADR-0038. Never in a real list; never trusted by a real wallet or verifier."
        : "DEV/DEMO PKI — private keys on disk (sapma S-1). Never use in pilot.",
  };
  const prev = existsSync(resolve(outDir, "pki.json"))
    ? (JSON.parse(readFileSync(resolve(outDir, "pki.json"), "utf8")) as Record<string, unknown>)
    : {};
  if (!FORCE && prev.generated_at) summary.generated_at = prev.generated_at;
  for (const it of items) {
    const der = new Uint8Array(it.cert.rawData);
    summary[it.name] = {
      subject: it.cert.subject,
      fingerprint_sha256: certFingerprintSha256Hex(der),
      not_after: it.cert.notAfter.toISOString(),
      ...(it.created ? { created_at: notBefore.toISOString() } : {}),
    };
  }
  const der = (n: string) => pemToDer(readFileSync(resolve(outDir, `${n}.cert.pem`), "utf8"));
  summary.ids =
    PROFILE === "sandbox"
      ? Object.fromEntries(
          items.map((it) => [
            it.name,
            it === root
              ? computeCaId(STATE, der(it.name))
              : it.name.startsWith("rp-")
                ? computeRpId(STATE, der(it.name))
                : computeIssuerId(STATE, der(it.name)),
          ]),
        )
      : {
          ca_id: computeCaId(STATE, der("root-ca")),
          issuer_id_bilgi: computeIssuerId(STATE, der("issuer-bilgi")),
          rp_id_verify: computeRpId(STATE, der("rp-verify")),
          issuer_id_id: computeIssuerId(STATE, der("issuer-id")),
          issuer_id_id_review: computeIssuerId(STATE, der("issuer-id-review")),
          issuer_id_bubilet: computeIssuerId(STATE, der("issuer-bubilet")),
          rp_id_issuer_bilgi: computeRpId(STATE, der("rp-issuer-bilgi")),
          note: "issuer_id = keccak256(utf8(stateCode) || SHA-256(leafCertDER)); zincire geçişte abi.encodePacked ile aynı bayt dizisi doğrulanacak (05-MIGRATION).",
        };
  writeFileSync(resolve(outDir, "pki.json"), JSON.stringify(summary, null, 2) + "\n");
  console.log(
    `PKI: ${
      items
        .filter((i) => i.created)
        .map((i) => i.name)
        .join(", ") || "değişiklik yok"
    } üretildi; ${items.filter((i) => !i.created).length} mevcut korundu.`,
  );
  console.log(JSON.stringify(summary.ids, null, 2));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
