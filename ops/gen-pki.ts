/**
 * ops/gen-pki.ts — PKI üretimi: geliştirme (varsayılan), sandbox ve gerçek ağ (üretim) kipleri
 *
 * Üç ayrı anahtar seti — hiçbiri diğeriyle anahtar paylaşmaz:
 *   - GELİŞTİRME (varsayılan, `npm run pki`): `ops/pki/` — her bilgisayarda rastgele üretilen yerel anahtarlar; testler ve yerel
 *     servisler bunlarla çalışır. Gerçek ağın anahtarları DEĞİLDİR; klasörün tamamı gitignore.
 *   - SANDBOX (`--profile=sandbox`): `ops/pki-sandbox/` — aşağıda.
 *   - ÜRETİM (`--prod-dir <klasör>` ya da `--prod` + `TAMGA_PROD_PKI_DIR`): gerçek ağın PKI'sı depoların DIŞINDA, operatörün
 *     bilgisayarındaki gizli klasörde durur (kök CA özel anahtarı yalnız orada). Bu kip yalnız EKSİK yaprakları üretir; kökü
 *     yeniden üretmez, `--force` kabul etmez, anahtarı olmayan (iptal edilmiş kurumların yalnız sertifikası kalan) kayıtları
 *     yeniden üretmez ve test cüzdan sağlayıcısını (`wallet-provider`, ADR-0042) hiç üretmez.
 *
 * Geliştirme kipi üretir (P-256, ES256):
 *   1. TR National Root CA (provisional operator: Tamga)  — self-signed, çevrimdışı kök muadili
 *   2. Örnek üniversite issuer sertifikası (dosya adı tarihsel: `issuer-bilgi`) — kökçe imzalı yaprak; konu adı yalnız örnek
 *      kurum ("Ornek Universitesi (DEV)"): geliştirme sertifikaları ve uyum vektörleri gerçek bir kurumu belge veren gibi göstermez
 *   2b. Örnek üniversite status list anahtarı (K1: credential anahtarından ayrı)
 *   3. Tamga Trust List signing cert (TLSO)                — self-signed; lotl/tl/anchors imzalar
 *   4. Test cüzdan sağlayıcı sertifikası                   — self-signed; WUA imzalar. YALNIZ TEST: ağın kendi testleri ve
 *      liste fixture'ları WIA/WUA doğrulamasını bununla dener; hiçbir gerçek cüzdanın sertifikası değildir (ADR-0042 K5: ağ
 *      cüzdan sağlayıcı işletmez; gerçek cüzdan sağlayıcının anahtarını cüzdan kendisi üretir, ağ yalnız sertifikasını listeler)
 *   5. Referans verifier erişim sertifikası (rp-verify)    — kökçe imzalı; SAN dns verify.tamga.network; istek nesnesini imzalar
 *
 * Sandbox (ADR-0038, SB1): `--profile=sandbox` ayrı bir test kökü ve yaprakları `ops/pki-sandbox/`'a üretir; gerçek PKI ile
 * hiçbir anahtar paylaşılmaz. Konu adları "… (TEST)"; örnek kurumlar `istanbul-bilgi`, `bubilet`, `paribu-cineverse` (gerçek
 * kurum adları gerçekçi bir deneme için; İstanbul Bilgi Üniversitesi pilot ortak, diğerleriyle ilişki ya da anlaşma yok; belgeler
 * test anahtarıyla imzalı ve geçersiz).
 * Kip: eksik olan sertifikalar üretilir, var olanlar KORUNUR (issuer_id değişmez); tamamını yenilemek için --force; yalnız
 * birkaç yaprağın sertifikasını aynı anahtarla yeniden imzalamak için --reissue=<ad,ad> (üretim kipinde yok).
 * Sapma S-1 (09-DEMO-KURGU §6): issuer özel anahtarı burada dosyada; pilotta üniversite KMS'inde.
 * Çıktı: <klasör>/*.cert.pem, *.pkcs8.pem, pki.json (parmak izleri, id'ler). `ops/pki/` tamamen gitignore (geliştirme anahtarları
 * makineye özeldir); `ops/pki-sandbox/` sertifikaları ve pki.json depoda izlenir (cüzdandaki sandbox pin'i).
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
  Extension,
  Name,
} from "@peculiar/x509";
import { webcrypto } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { resolve, dirname, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { computeCaId, computeIssuerId, computeRpId, certFingerprintSha256Hex, pemToDer } from "@tamga-network/core";

cryptoProvider.set(webcrypto as unknown as Crypto);
const crypto = webcrypto as unknown as Crypto;

const here = dirname(fileURLToPath(import.meta.url));
const PROFILE = (process.argv.find((a) => a.startsWith("--profile="))?.slice(10) ?? "network") as "network" | "sandbox";
if (PROFILE !== "network" && PROFILE !== "sandbox") throw new Error(`bilinmeyen profil: ${PROFILE}`);
const FORCE = process.argv.includes("--force");
// Yalnız adı verilen yaprakların sertifikası yeniden imzalanır; ANAHTAR AYNI kalır (sunucudaki anahtar paketi değişmez), seri
// numarası yeni ve rastgele (RFC 5280 §4.1.2.2: aynı makamda tekrar yok). Ör. konu adına organizationIdentifier eklemek için.
const REISSUE = new Set(
  (process.argv.find((a) => a.startsWith("--reissue="))?.slice(10) ?? "").split(",").filter(Boolean),
);
const die = (m: string): never => {
  console.error(m);
  process.exit(2);
};

// Üretim kipi: klasör açıkça verilir (`--prod-dir <klasör>` ya da `--prod` + TAMGA_PROD_PKI_DIR); varsayılan yol YOK — gerçek
// kökle imzalamak bilinçli bir iştir. Klasör var olmalı ve kök sertifikası + özel anahtarı içinde olmalı.
const prodDirArg = (() => {
  const i = process.argv.indexOf("--prod-dir");
  return i > 0 ? (process.argv[i + 1] ?? die("--prod-dir <klasör> gerekli")) : undefined;
})();
const PROD = prodDirArg !== undefined || process.argv.includes("--prod");
const insideRepo = (d: string) => {
  const r = relative(resolve(here, ".."), d);
  return !r.startsWith("..") && !isAbsolute(r);
};
function prodDir(): string {
  const d =
    prodDirArg ??
    process.env.TAMGA_PROD_PKI_DIR ??
    die(
      "Üretim PKI klasörü verilmedi: --prod-dir <klasör> ya da TAMGA_PROD_PKI_DIR=<klasör> (gerçek ağın PKI'sı depo dışında, operatörün gizli klasöründe).",
    );
  const abs = resolve(d);
  if (PROFILE !== "network") die("--prod / --prod-dir yalnız gerçek ağ profiliyle (sandbox'ın kendi klasörü var)");
  if (FORCE)
    die("Üretim kipinde --force yok: gerçek anahtarlar yeniden üretilmez (cüzdan pin'leri ve liste kayıtları bozulur)");
  if (insideRepo(abs)) die(`Üretim PKI klasörü depo içinde olamaz: ${abs}`);
  if (!existsSync(resolve(abs, "root-ca.cert.pem")) || !existsSync(resolve(abs, "root-ca.pkcs8.pem")))
    die(
      `Üretim PKI klasöründe kök yok (root-ca.cert.pem + root-ca.pkcs8.pem): ${abs}\nYeni bir gerçek kök bu araçla üretilmez (bütün cüzdanların yeniden sabitlenmesi gerekir).`,
    );
  return abs;
}
const outDir = PROD ? prodDir() : resolve(here, PROFILE === "sandbox" ? "pki-sandbox" : "pki");
mkdirSync(outDir, { recursive: true });

const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;
const STATE = "TR";

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
  /** Yalnız sertifikası tutulan kayıtta (üretim kipinde iptal edilmiş kurumlar) yok */
  privateKey?: CryptoKey;
  created: boolean;
}
async function load(name: string): Promise<Item> {
  const cert = new X509Certificate(readFileSync(resolve(outDir, `${name}.cert.pem`), "utf8"));
  const keyFile = resolve(outDir, `${name}.pkcs8.pem`);
  return {
    name,
    cert,
    privateKey: existsSync(keyFile) ? await loadKey(readFileSync(keyFile, "utf8")) : undefined,
    created: false,
  };
}
type Reuse = { keys: CryptoKeyPair; serialHex: string };
async function ensure(
  name: string,
  make: (reuse?: Reuse) => Promise<{ cert: X509Certificate; privateKey: CryptoKey }>,
): Promise<Item> {
  if (!FORCE && REISSUE.has(name) && exists(name)) {
    if (PROD) die("Üretim kipinde --reissue yok (gerçek sertifikalar pki-issue.ts ile, CSR'dan)");
    const old = await load(name);
    const kp = {
      privateKey: old.privateKey ?? die(`${name}: özel anahtar yok`),
      publicKey: await old.cert.publicKey.export(ALG, ["verify"], crypto),
    };
    // pozitif tamsayı: ilk bayt 0x7f'i aşmasın
    const rnd = crypto.getRandomValues(new Uint8Array(8));
    rnd[0] = (rnd[0] & 0x7f) | 0x10;
    const { cert } = await make({ keys: kp, serialHex: Buffer.from(rnd).toString("hex") });
    writeFileSync(resolve(outDir, `${name}.cert.pem`), cert.toString("pem") + "\n");
    return { name, cert, privateKey: kp.privateKey, created: true };
  }
  if (!FORCE && exists(name)) return load(name);
  // Üretim kipi: sertifikası olup anahtarı olmayan kayıt üzerine yazılmaz (anahtar başka yerde ya da kayıt iptal edilmiş)
  if (PROD && existsSync(resolve(outDir, `${name}.cert.pem`)))
    die(`Üretim PKI: ${name}.cert.pem var ama özel anahtarı yok — üzerine yazılmaz (anahtarı geri koyun).`);
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
  const rootKey = () => root.privateKey ?? die("kök CA özel anahtarı yok — yeni sertifika imzalanamaz");
  const signedByRoot =
    (serialNo: number, subject: string, extra?: (pub: CryptoKey) => Promise<unknown[]>) => async (reuse?: Reuse) => {
      const kp = reuse?.keys ?? (await keys());
      const cert = await X509CertificateGenerator.create({
        serialNumber: reuse?.serialHex ?? serial(serialNo),
        subject,
        issuer: root.cert.subject,
        notBefore,
        notAfter: years(2),
        signingAlgorithm: ALG,
        publicKey: kp.publicKey,
        signingKey: rootKey(),
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

  // Üretim kipinde iptal edilmiş ilk örnek kurumlar (Bilgi, Bubilet; gerçek listede REVOKED): yalnız sertifikaları kalır (kayıt
  // defteri ve geçmiş belgeler onları anar); asla yeniden üretilmez, özel anahtarları yoktur. Geliştirme kipinde test anahtarı.
  const devOrCertOnly = async (name: string, make: Make): Promise<Item[]> => {
    if (!PROD) return [await ensure(name, make)];
    if (existsSync(resolve(outDir, `${name}.cert.pem`))) return [await load(name)];
    console.warn(`[uyarı] üretim PKI: ${name}.cert.pem yok (iptal edilmiş kayıt; yeniden üretilmez)`);
    return [];
  };
  const items: Item[] = [
    root,
    ...(await devOrCertOnly(
      "issuer-bilgi",
      signedByRoot(1001, "CN=Ornek Universitesi (DEV), OU=Ogrenci Isleri, O=Ornek Universitesi (DEV), C=TR"),
    )),
    ...(await devOrCertOnly(
      "issuer-bilgi-status",
      signedByRoot(1002, "CN=Ornek Universitesi (DEV) - Status List, OU=Status, O=Ornek Universitesi (DEV), C=TR"),
    )),
    await ensure(
      "tl-signer-1",
      selfSigned(2, "CN=Tamga Trust List Signer 1 (provisional TLSO), O=Tamga Network, C=TR"),
    ),
    // ADR-0042 K5: YALNIZ GELİŞTİRME/TEST — genel "test cüzdan sağlayıcısı" (ağın testleri, liste fixture'ları ve platform
    // testleri WIA/WUA doğrulamasını bununla dener). Gerçek ağ listesinde YOKTUR (TAMGA-WP-1 `wua_signing_certs: []`); üretim
    // kipinde hiç üretilmez. Dosya adı uyumluluk için `wallet-provider` kalır.
    ...(PROD
      ? []
      : [
          await ensure("wallet-provider", selfSigned(3, "CN=Test Wallet Provider (WUA), O=Test Wallet Provider, C=TR")),
        ]),
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
    ...(await devOrCertOnly("issuer-bubilet", signedByRoot(1201, "CN=Bubilet, OU=Bilet Satisi, O=Bubilet, C=TR"))),
    ...(await devOrCertOnly(
      "issuer-bubilet-status",
      signedByRoot(1202, "CN=Bubilet - Status List, OU=Status, O=Bubilet, C=TR"),
    )),
    // 7) ADR-0011 K3: kurum issuer'ı kimlik attestation'ını SUNUM olarak ister → RP erişim sertifikası (SAN issuer.tamga.network; client_id = x509_hash, ADR-0034)
    ...(await devOrCertOnly(
      "rp-issuer-bilgi",
      signedByRoot(2002, "CN=issuer.tamga.network, O=Ornek Universitesi (DEV) - kimlik eslestirme, C=TR", async () => [
        new SubjectAlternativeNameExtension([{ type: "dns", value: "issuer.tamga.network" }]),
      ]),
    )),
  ];

  await finish(root, items, notBefore);
}

type Make = (reuse?: Reuse) => Promise<{ cert: X509Certificate; privateKey: CryptoKey }>;
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
    await ensure("wallet-provider", selfSigned(3, "CN=Test Wallet Provider (TEST), O=Tamga Network Sandbox, C=TR")),
    await ensure("registrar-1", selfSigned(4, "CN=Tamga Sandbox Registrar (TEST), O=Tamga Network Sandbox, C=TR")),
    await ensure(
      "rp-verify",
      signedByRoot(
        2001,
        // ADR-0026 K3: kurum kimlik no (organizationIdentifier) = kayıt sertifikasının `sub`'ı (registry-sandbox TR-VKN
        // TR0000000004). Yoksa cüzdan kayıt sertifikasını bu sertifikaya bağlayamaz ve isteği reddeder (2026-10-09, --reissue).
        "CN=verify.sandbox.tamga.network, O=Tamga Sandbox Dogrulama (TEST), 2.5.4.97=VATTR-0000000004, C=TR",
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
        // ADR-0026 K3: organizationIdentifier = kayıt sertifikasının `sub`'ı (registry-sandbox TR-VKN TR0000000005)
        "CN=issuer.sandbox.tamga.network, O=Istanbul Bilgi Universitesi - kimlik eslestirme (TEST), 2.5.4.97=VATTR-0000000005, C=TR",
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
    // ADR-0041 K4: test kurumları ara sertifika makamı — kökçe burada (kök anahtarının durduğu bilgisayarda) imzalanır; yol uzunluğu
    // 0 (yalnız yaprak verir), yalnız sertifika imzalar, ad kısıtı: yalnız `C=TR, OU=Tamga Sandbox Test Institutions` altındaki
    // konu adları (RFC 5280 §4.2.1.10, directoryName). Anahtarı sandbox sunucusuna gider (kök anahtarı gitmez); sunucuda liste
    // yayıncısı (`sandbox-institution add`) test kurumlarının yaprak sertifikalarını bununla verir.
    // Süre 1 yıl. YENİLEME: süre dolmadan bu bilgisayarda `ops/pki-sandbox/test-institutions-ca.*` silinip
    // `npx tsx ops/gen-pki.ts --profile=sandbox` çalıştırılır, paket sunucuya yüklenir (upload.ps1 -WithSandboxPki) ve sandbox
    // yeniden başlatılır; kök ve diğer anahtarlar değişmez (cüzdan pin'i aynı). Eski makamın yaprakları gece sıfırlamasıyla zaten silinir.
    await ensure("test-institutions-ca", async () => {
      const kp = await keys();
      const cert = await X509CertificateGenerator.create({
        serialNumber: serial(3001),
        subject: "CN=Tamga Sandbox Test Institutions CA (TEST), O=Tamga Network Sandbox, C=TR",
        issuer: root.cert.subject,
        notBefore: new Date(),
        notAfter: years(1),
        signingAlgorithm: ALG,
        publicKey: kp.publicKey,
        signingKey: root.privateKey ?? die("sandbox kök özel anahtarı yok"),
        extensions: [
          new BasicConstraintsExtension(true, 0, true),
          new KeyUsagesExtension(KeyUsageFlags.keyCertSign, true),
          await SubjectKeyIdentifierExtension.create(kp.publicKey),
          await AuthorityKeyIdentifierExtension.create(root.cert.publicKey),
          nameConstraintsDirName(TEST_INSTITUTIONS_SUBTREE),
        ] as never,
      });
      return { cert, privateKey: kp.privateKey };
    }),
  ];
}

/** ADR-0041: test kurumu yapraklarının konu adı bu ön ekle başlar (liste yayıncısı `sandbox-institutions.ts` ile aynı). */
const TEST_INSTITUTIONS_SUBTREE = "C=TR, OU=Tamga Sandbox Test Institutions";
/** NameConstraints (2.5.29.30, kritik): permittedSubtrees = [ directoryName(prefix) ] — DER elle (ek bağımlılık yok). */
function nameConstraintsDirName(prefix: string): Extension {
  const len = (n: number) => (n < 0x80 ? [n] : n < 0x100 ? [0x81, n] : [0x82, (n >> 8) & 0xff, n & 0xff]);
  const tlv = (tag: number, body: Uint8Array) => new Uint8Array([tag, ...len(body.length), ...body]);
  const name = new Uint8Array(new Name(prefix).toArrayBuffer());
  const der = tlv(0x30, tlv(0xa0, tlv(0x30, tlv(0xa4, name)))); // NameConstraints{ [0] GeneralSubtrees{ GeneralSubtree{ [4] Name } } }
  return new Extension("2.5.29.30", true, der);
}

async function finish(root: Item, items: Item[], notBefore: Date) {
  const summary: Record<string, unknown> = {
    generated_at: notBefore.toISOString(),
    profile: PROD ? "production" : PROFILE === "sandbox" ? "sandbox" : "development",
    warning: PROD
      ? "PRODUCTION PKI — kept outside the repositories on the operator's computer (TAMGA_PROD_PKI_DIR); the root CA private key never leaves it. Private keys on disk (sapma S-1; pilot: KMS). Never use for development or tests."
      : PROFILE === "sandbox"
        ? "SANDBOX (TEST) PKI — ADR-0038. Never in a real list; never trusted by a real wallet or verifier."
        : "DEVELOPMENT PKI — random keys generated on this machine for local services and tests. Not the production keys; never in a real list. wallet-provider is a test key (ADR-0042).",
  };
  const prev = existsSync(resolve(outDir, "pki.json"))
    ? (JSON.parse(readFileSync(resolve(outDir, "pki.json"), "utf8")) as Record<string, unknown>)
    : {};
  if (!FORCE && prev.generated_at) summary.generated_at = prev.generated_at;
  for (const it of items) {
    const der = new Uint8Array(it.cert.rawData);
    // yeniden kullanılan sertifikanın önceki üretim zamanı korunur (setup izlenen pki.json'u boşuna değiştirmesin)
    const prevCreated = (prev[it.name] as { created_at?: string; fingerprint_sha256?: string } | undefined) ?? {};
    const fp = certFingerprintSha256Hex(der);
    const createdAt = it.created
      ? notBefore.toISOString()
      : prevCreated.fingerprint_sha256 === fp
        ? prevCreated.created_at
        : undefined;
    summary[it.name] = {
      subject: it.cert.subject,
      fingerprint_sha256: fp,
      not_after: it.cert.notAfter.toISOString(),
      ...(createdAt ? { created_at: createdAt } : {}),
    };
  }
  const der = (n: string) => pemToDer(readFileSync(resolve(outDir, `${n}.cert.pem`), "utf8"));
  const has = (n: string) => items.some((i) => i.name === n);
  summary.ids =
    PROFILE === "sandbox"
      ? Object.fromEntries(
          items.map((it) => [
            it.name,
            it === root || it.name.endsWith("-ca")
              ? computeCaId(STATE, der(it.name))
              : it.name.startsWith("rp-")
                ? computeRpId(STATE, der(it.name))
                : computeIssuerId(STATE, der(it.name)),
          ]),
        )
      : {
          ca_id: computeCaId(STATE, der("root-ca")),
          ...(has("issuer-bilgi") ? { issuer_id_bilgi: computeIssuerId(STATE, der("issuer-bilgi")) } : {}),
          rp_id_verify: computeRpId(STATE, der("rp-verify")),
          issuer_id_id: computeIssuerId(STATE, der("issuer-id")),
          issuer_id_id_review: computeIssuerId(STATE, der("issuer-id-review")),
          ...(has("issuer-bubilet") ? { issuer_id_bubilet: computeIssuerId(STATE, der("issuer-bubilet")) } : {}),
          ...(has("rp-issuer-bilgi") ? { rp_id_issuer_bilgi: computeRpId(STATE, der("rp-issuer-bilgi")) } : {}),
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
