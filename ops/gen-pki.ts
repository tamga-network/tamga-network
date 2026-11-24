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
 *   5b. TS 119 612 XML liste imzacısı (tl-xml-signer-1, ADR-0066 K4) — kökçe imzalı yaprak, ETSI TS 119 612 §5.7.1 profili:
 *      konu C + O (= SchemeOperatorName), basicConstraints CA=false, keyUsage digitalSignature + nonRepudiation (kritik), SKI + AKI,
 *      extendedKeyUsage id-tsl-kp-tslSigning (0.4.0.2231.3.0). Yalnız XML listesini imzalar; JSON listeleri `tl-signer-1` imzalar.
 *      Gerçek ağda: `TAMGA_PROD_PKI_DIR=<gizli klasör> npx tsx ops/gen-pki.ts --prod` eksik olan bu yaprağı üretir (proje yönetimi
 *      onayıyla; ops/README.md "XML liste imzacısı").
 *   5c. Erişim sertifikası makamı (access-ca-1, ADR-0087 K2) — kökçe imzalı ara makam: yol uzunluğu 0, keyUsage keyCertSign +
 *      cRLSign (kritik), SKI + AKI, CRL dağıtım noktası = kökün CRL'i. Yalnız erişim sertifikası (WRPAC) verir ve onların CRL'ini
 *      imzalar; anahtarı liste yayıncısında durur (kök çevrim dışı kalır). Erişim sertifikalarında (rp-*) CRL dağıtım noktası
 *      uzantısı (2.5.29.31) verenin CRL adresini gösterir: tek dağıtım noktası, iki ad — `http://crl.<ağ>/<makam>.crl` ve aynı yolun
 *      `https` adresi (ADR-0090; `ops/crl-dp.ts`).
 *   5d. Kökün CRL'i (`--root-crl`, ADR-0087 K4): `root-ca.crl` kökün anahtarıyla, kökün durduğu bilgisayarda imzalanır; nextUpdate
 *      365 gün, CRL numarası saniye cinsinden zaman (tekdüze), var olan kopyanın iptalleri korunur, `--revoke <seri>:<gerekçe>`
 *      (virgülle birden çok) yenilerini ekler. Yayıncı bu kopyayı denetleyip `crl.<ağ>/root-ca.crl` olarak yayımlar (ADR-0090).
 *   6. Tamga Wallet sağlayıcı sertifikası (wallet-provider-tamga-wp-1) — üretilmez: depodaki `ops/pki-sandbox/` kopyasından
 *      yalnız kamu sertifikası alınır (gerçek ve sandbox listesinde aynı sertifika; anahtarı ağda yok, ADR-0042)
 *
 * Sandbox (ADR-0038, SB1): `--profile=sandbox` ayrı bir test kökü ve yaprakları `ops/pki-sandbox/`'a üretir; gerçek PKI ile
 * hiçbir anahtar paylaşılmaz. Konu adları "… (TEST)"; örnek kurumlar kurgusaldır (2026-11-19 adları: Ulubilim Üniversitesi, Kervanyolu
 * Etkinlik, Işıkperde Sineması; 2026-11-04'e kadar gerçek kurum adları taşıyordu; belgeler test anahtarıyla imzalı ve geçersiz).
 * Dosya adları tarihsel (`issuer-example-university` …): anahtarlar sunucuda bu adlarla durur; görünen ad konu adında ve listede.
 * Kip: eksik olan sertifikalar üretilir, var olanlar KORUNUR (issuer_id değişmez); tamamını yenilemek için --force; yalnız
 * birkaç yaprağın sertifikasını aynı anahtarla yeniden imzalamak için --reissue=<ad,ad> (üretim kipinde yok).
 * Kurum sertifika profili (ADR-0050, ETSI TS 119 412-6 V1.2.1 / EN 319 412-3): belge veren yapraklarında (belge + iptal listesi
 * imzası) konu alanında `organizationIdentifier` (2.5.4.97 = kayıt sertifikasının `sub`'ı, ör. VATTR-<VKN>), `O` = resmî ad, `C`;
 * anahtar kullanımı kritik ve yalnız digitalSignature; SKI + AKI. Sandbox yaprakları bu profille (2026-10-13 --reissue ile aynı
 * anahtar); geliştirme yaprakları kimlik numarası taşımaz (yerel, rastgele). Gerçek ağda kurum sertifikası `pki-issue.ts --prod
 * --org-id` ile verilir; bu araç üretim kipinde kimlik numarasız bir kurum yaprağı üretirse uyarır.
 * Sapma S-1 (09-DEMO-KURGU §2): issuer özel anahtarı burada dosyada; pilotta üniversite KMS'inde.
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
  ExtendedKeyUsageExtension,
  X509Crl,
  X509CrlGenerator,
  X509CrlReason,
  X509Certificate,
  Extension,
  Name,
} from "@peculiar/x509";
import { webcrypto } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import { resolve, dirname, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { cdpExtension, crlHttpUri } from "./crl-dp.js";
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
/** ADR-0093 K5: sandbox'ta TR dışındaki temsili ülke listelerinde kayıtlı kurumlar (pki.json kimlikleri için). */
const SANDBOX_ISSUER_STATES: Record<string, string> = { "issuer-gunesli": "AZ", "issuer-dalaqala": "KZ" };
/** ADR-0090: CRL ayrı alan adında (`crl.tamga.network` / `crl.sandbox.tamga.network`), `http` + `https`. */
const TRUST_BASE = PROFILE === "sandbox" ? "https://trust.sandbox.tamga.network" : "https://trust.tamga.network";
/** RFC 5280 §4.2.1.13 + ADR-0090 K3: tek dağıtım noktası, iki ad (önce http, sonra https); kritik değil. */
const cdp = (ca: string) => cdpExtension(crlHttpUri(TRUST_BASE, ca));

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

  if (PROFILE === "sandbox") {
    await finish(root, await sandboxItems(root, signedByRoot, selfSigned), notBefore);
    if (process.argv.includes("--root-crl")) await writeRootCrl(root);
    return;
  }

  // Sınama döneminin örnek kurumları (dosya adları tarihseldir): gerçek ağın listesinden 2026-11-11'de çıkarıldı. Üretim kipinde
  // asla üretilmezler ve özel anahtarları yoktur; eski sertifika dosyası duruyorsa yalnız okunur (arşivdeki eski liste sürümleri
  // onları anar). Geliştirme kipinde bunlar yerel test anahtarlarıdır (testlerin örnek üniversitesi ve örnek bilet kurumu).
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
    // testleri WIA/WUA doğrulamasını bununla dener). Gerçek ağ listesinde YOKTUR (TAMGA-WP-1 kendi sertifikasını anar, aşağıda); üretim
    // kipinde hiç üretilmez. Dosya adı uyumluluk için `wallet-provider` kalır.
    ...(PROD
      ? []
      : [
          await ensure("wallet-provider", selfSigned(3, "CN=Test Wallet Provider (WUA), O=Test Wallet Provider, C=TR")),
        ]),
    // ADR-0042: Tamga Wallet sağlayıcısının (TAMGA-WP-1) WUA imza sertifikası. Gerçek ağda ve sandbox'ta AYNI kamu sertifikası
    // (özel anahtarı cüzdan sağlayıcıdadır, ağda hiç yoktur); depoda `ops/pki-sandbox/`'ta izlenir. Geliştirme kipi oradan
    // yalnız sertifikayı kopyalar: kayıt defteri onu anar ve sandbox listesi (SB1 istisnası) gerçek ağ listesindeki parmak izinin
    // aynısını ister — geliştirmede farklı bir sertifika `trust:build:sandbox`'ı durdururdu. Sandbox kopyası yoksa (ör. eski
    // klon) "(DEV)" konu adlı, kendinden imzalı bir yer tutucu üretilir. Üretim kipinde dokunulmaz (sertifika operatör klasöründe).
    ...(PROD ? [] : [await devWalletProviderCert("wallet-provider-tamga-wp-1", selfSigned)]),
    // ADR-0026 K1: kayıt kurumu anahtarı (WRPRC imzası) — liste imza anahtarından ayrı; LOTL roles.registrar.signing_keys
    await ensure(
      "registrar-1",
      selfSigned(4, "CN=Tamga Registrar 1 (provisional TR registrar), O=Tamga Network, C=TR"),
    ),
    // ADR-0066 K4: TS 119 612 XML liste imzacısı (§5.7.1) — O = gerçek ağın SchemeOperatorName'i ("Tamga Network")
    await ensure(
      "tl-xml-signer-1",
      tlXmlSigner(root, 4001, "CN=Tamga Network Trusted List Signer 1, O=Tamga Network, C=TR"),
    ),
    // 5) Referans verifier erişim sertifikası — SAN verify.tamga.network (kayıt dns_name); client_id = x509_hash(bu sertifika) (ADR-0034)
    await ensure(
      "rp-verify",
      // ADR-0058 K1/K2: CN ticari ad; SAN alan adı + iletişim (kayıttaki destek adresi ve kurumsal e-posta)
      signedByRoot(2001, "CN=Tamga Verify, O=Tamga Dogrulama Servisi, C=TR", async () => [
        new SubjectAlternativeNameExtension([
          { type: "dns", value: "verify.tamga.network" },
          { type: "url", value: "https://tamga.network" },
          { type: "email", value: "info@tamga.network" },
        ]),
        cdp("root-ca"), // ADR-0087 K3: veren kök (geçişte); yeni erişim sertifikaları access-ca-1'den
      ]),
    ),
    // ADR-0087 K2: erişim sertifikası makamı (çevrim içi ara makam; CRL'i yayıncı imzalar)
    await ensure("access-ca-1", accessCa(root, 5001, "CN=Tamga Access CA 1, O=Tamga Network, C=TR")),
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
    ...(await devOrCertOnly(
      "issuer-bubilet",
      signedByRoot(1201, "CN=Ornek Etkinlik (DEV), OU=Bilet Satisi, O=Ornek Etkinlik (DEV), C=TR"),
    )),
    ...(await devOrCertOnly(
      "issuer-bubilet-status",
      signedByRoot(1202, "CN=Ornek Etkinlik (DEV) - Status List, OU=Status, O=Ornek Etkinlik (DEV), C=TR"),
    )),
    // 7) ADR-0011 K3: kurum issuer'ı kimlik attestation'ını SUNUM olarak ister → RP erişim sertifikası (SAN issuer.tamga.network; client_id = x509_hash, ADR-0034)
    ...(await devOrCertOnly(
      "rp-issuer-bilgi",
      signedByRoot(2002, "CN=issuer.tamga.network, O=Ornek Universitesi (DEV) - kimlik eslestirme, C=TR", async () => [
        new SubjectAlternativeNameExtension([{ type: "dns", value: "issuer.tamga.network" }]),
        cdp("root-ca"),
      ]),
    )),
  ];

  await finish(root, items, notBefore);
  if (process.argv.includes("--root-crl")) await writeRootCrl(root);
}

/** Geliştirme kipi: gerçek cüzdan sağlayıcı sertifikasını (yalnız kamu sertifikası) depodaki sandbox kopyasından alır. */
async function devWalletProviderCert(name: string, selfSigned: (n: number, name: string) => Make): Promise<Item> {
  const tracked = resolve(here, "pki-sandbox", `${name}.cert.pem`);
  const local = resolve(outDir, `${name}.cert.pem`);
  if (existsSync(tracked)) {
    const pem = readFileSync(tracked, "utf8");
    const same = existsSync(local) && readFileSync(local, "utf8") === pem;
    if (!same) {
      writeFileSync(local, pem);
      rmSync(resolve(outDir, `${name}.pkcs8.pem`), { force: true }); // eski yer tutucunun anahtarı kalmasın
    }
    return { ...(await load(name)), created: !same };
  }
  if (existsSync(local) && !existsSync(resolve(outDir, `${name}.pkcs8.pem`))) return load(name);
  return ensure(name, selfSigned(5, "CN=Tamga Wallet Provider TAMGA-WP-1 (DEV stand-in), O=Development Only, C=TR"));
}

type Make = (reuse?: Reuse) => Promise<{ cert: X509Certificate; privateKey: CryptoKey }>;
type SignedByRoot = (serialNo: number, subject: string, extra?: (pub: CryptoKey) => Promise<unknown[]>) => Make;

/** Sandbox (ADR-0038): gerçek ağla aynı dosya adları (servis ayarları değişmesin), test konu adları, sandbox SAN'ı. */
async function sandboxItems(root: Item, signedByRoot: SignedByRoot, selfSigned: (n: number, name: string) => Make) {
  // ADR-0087 K3: erişim sertifikası (rp-*) verenin CRL'ini gösterir
  const san = (host: string) => async () => [
    new SubjectAlternativeNameExtension([{ type: "dns", value: host }]),
    cdp("root-ca"),
  ];
  // ADR-0087 K2: erişim sertifikası makamı (anahtarı sandbox sunucusundaki yayıncıya gider; kök anahtarı gitmez)
  const accessCa1 = await ensure(
    "access-ca-1",
    accessCa(root, 5001, "CN=Tamga Sandbox Access CA (TEST), O=Tamga Network Sandbox, C=TR"),
  );
  /**
   * ADR-0087 K2: yeni erişim sertifikaları makamdan verilir (kökten değil); CRL dağıtım noktası makamın CRL'i. SAN: kayıttaki
   * `dns_name` (ADR-0034) + kayıttaki destek adresi (ADR-0058 K2).
   */
  const byAccessCa =
    (serialNo: number, subject: string, dns: string): Make =>
    async (reuse?: Reuse) => {
      const kp = reuse?.keys ?? (await keys());
      const cert = await X509CertificateGenerator.create({
        serialNumber: reuse?.serialHex ?? serial(serialNo),
        subject,
        issuer: accessCa1.cert.subject,
        notBefore: new Date(),
        notAfter: years(2),
        signingAlgorithm: ALG,
        publicKey: kp.publicKey,
        signingKey: accessCa1.privateKey ?? die("access-ca-1 özel anahtarı yok — erişim sertifikası imzalanamaz"),
        extensions: (await leafExt(kp.publicKey, [
          await AuthorityKeyIdentifierExtension.create(accessCa1.cert.publicKey),
          new SubjectAlternativeNameExtension([
            { type: "dns", value: dns },
            { type: "url", value: "https://sandbox.tamga.network" },
          ]),
          cdp("access-ca-1"),
        ])) as never,
      });
      return { cert, privateKey: kp.privateKey };
    };
  // 2026-11-19 (proje yönetimi onayı): sandbox kurgusal doğrulayıcıları. Alan adları `.example` (RFC 2606; hiçbir
  // zaman gerçek site olamaz). ADR-0058 K1: CN ticari ad. ADR-0026 K3: organizationIdentifier = registry-sandbox TR-VKN
  // TR0000000013…TR0000000019.
  const verifiers: Array<[string, number, string, string, string]> = [
    ["rp-bitbahce", 2101, "Bitbahçe Yazılım (TEST)", "0000000013", "bitbahce.example"],
    ["rp-sikkebank", 2102, "Sikke Bank (TEST)", "0000000014", "sikkebank.example"],
    ["rp-sayfalik", 2103, "Sayfalık Kütüphanesi (TEST)", "0000000015", "sayfalik.example"],
    ["rp-kampuskart", 2104, "Kampüskart İndirim Mağazası (TEST)", "0000000016", "kampuskart.example"],
    ["rp-yolgezer", 2105, "Yolgezer Araç Kiralama (TEST)", "0000000017", "yolgezer.example"],
    ["rp-gecekonak", 2106, "Gecekonak Otel (TEST)", "0000000018", "gecekonak.example"],
    ["rp-kampusyuva", 2107, "Kampüsyuva Öğrenci Yurdu (TEST)", "0000000019", "kampusyuva.example"],
  ];
  const verifierItems: Item[] = [];
  for (const [name, no, org, vkn, dns] of verifiers)
    verifierItems.push(await ensure(name, byAccessCa(no, `CN=${org}, O=${org}, 2.5.4.97=VATTR-${vkn}, C=TR`, dns)));
  return [
    root,
    await ensure(
      "tl-signer-1",
      selfSigned(2, "CN=Tamga Sandbox Trust List Signer (TEST), O=Tamga Network Sandbox, C=TR"),
    ),
    await ensure("wallet-provider", selfSigned(3, "CN=Test Wallet Provider (TEST), O=Tamga Network Sandbox, C=TR")),
    await ensure("registrar-1", selfSigned(4, "CN=Tamga Sandbox Registrar (TEST), O=Tamga Network Sandbox, C=TR")),
    // ADR-0093 K3: temsili AZ ve KZ listelerinin kendi imzacıları (TL7; kökün altında değil, tl-signer-1 ile aynı desen)
    await ensure(
      "tl-signer-az-1",
      selfSigned(
        6,
        "CN=Tamga Sandbox Trust List Signer - AZ representative slot (TEST), O=Tamga Network Sandbox, C=TR",
      ),
    ),
    await ensure(
      "tl-signer-kz-1",
      selfSigned(
        7,
        "CN=Tamga Sandbox Trust List Signer - KZ representative slot (TEST), O=Tamga Network Sandbox, C=TR",
      ),
    ),
    // ADR-0066 K4: TS 119 612 XML liste imzacısı (§5.7.1) — O = sandbox listesinin SchemeOperatorName'i
    await ensure(
      "tl-xml-signer-1",
      tlXmlSigner(root, 4001, "CN=Tamga Sandbox Trusted List Signer (TEST), O=Tamga Network Sandbox (TEST), C=TR"),
    ),
    await ensure(
      "rp-verify",
      signedByRoot(
        2001,
        // ADR-0026 K3: kurum kimlik no (organizationIdentifier) = kayıt sertifikasının `sub`'ı (registry-sandbox TR-VKN
        // TR0000000004). Yoksa cüzdan kayıt sertifikasını bu sertifikaya bağlayamaz ve isteği reddeder (2026-10-09, --reissue).
        // ADR-0058 K1/K2 (2026-10-21, --reissue): CN ticari ad; SAN alan adı + kayıttaki destek adresi + kurumsal e-posta
        // CL67 (2026-11-24, AU23): O = kayıttaki legal_name (AB cüzdanları adı O'dan okur; --reissue)
        "CN=Tamga Sandbox Verify (TEST), O=Tamga Sandbox Verification (TEST), 2.5.4.97=VATTR-0000000004, C=TR",
        async () => [
          new SubjectAlternativeNameExtension([
            { type: "dns", value: "verify.sandbox.tamga.network" },
            { type: "url", value: "https://sandbox.tamga.network" },
            { type: "email", value: "info@tamga.network" },
          ]),
          cdp("root-ca"),
        ],
      ),
    ),
    accessCa1,
    ...verifierItems,
    await ensure(
      "issuer-id",
      // ADR-0050: organizationIdentifier = kayıt sertifikasının `sub`'ı (registry-sandbox tamga-id TR-VKN TR0000000002)
      signedByRoot(
        1101,
        "CN=Tamga Sandbox Kimlik (TEST), OU=Identity, O=Tamga Network Sandbox, 2.5.4.97=VATTR-0000000002, C=TR",
      ),
    ),
    await ensure(
      "issuer-id-status",
      signedByRoot(
        1102,
        "CN=Tamga Sandbox Kimlik - Status List (TEST), OU=Status, O=Tamga Network Sandbox, 2.5.4.97=VATTR-0000000002, C=TR",
      ),
    ),
    // ADR-0033: mağaza inceleme kodu provası sandbox'ta — DEMO imzacısı gerçek ağdakiyle aynı dosya adı, I1 kaydı registry-sandbox'ta
    await ensure(
      "issuer-id-review",
      signedByRoot(
        1103,
        // ADR-0050: registry-sandbox tamga-id-review TR-VKN TR0000000007
        "CN=Tamga Sandbox Kimlik - Magaza Incelemesi DEMO (TEST), OU=Review, O=Tamga Network Sandbox, 2.5.4.97=VATTR-0000000007, C=TR",
      ),
    ),
    // Örnek kurumlar: kurgusal adlar (2026-11-04, proje yönetimi onayı: gerçek kurum adları sandbox'tan çıkarıldı). Seri
    // numaraları önceki örnek kurumların (1001/1002/2002/1201/1202 ilk set; 1011/1012/2012/1211/1212/1301/1302 gerçek adlı set,
    // ikisi de kaldırıldı) numaralarını yeniden kullanmaz (RFC 5280 §4.1.2.2).
    await ensure(
      "issuer-example-university",
      signedByRoot(
        1021,
        // ADR-0050: registry-sandbox ulubilim TR-VKN TR0000000001
        "CN=Ulubilim Üniversitesi (TEST), OU=Öğrenci İşleri, O=Ulubilim Üniversitesi (TEST), 2.5.4.97=VATTR-0000000001, C=TR",
      ),
    ),
    await ensure(
      "issuer-example-university-status",
      signedByRoot(
        1022,
        "CN=Ulubilim Üniversitesi - Status List (TEST), OU=Status, O=Ulubilim Üniversitesi (TEST), 2.5.4.97=VATTR-0000000001, C=TR",
      ),
    ),
    await ensure(
      "rp-issuer-example-university",
      signedByRoot(
        2022,
        // ADR-0026 K3: organizationIdentifier = kayıt sertifikasının `sub`'ı (registry-sandbox TR-VKN TR0000000005)
        // CL67 (2026-11-24, AU23): O = kayıttaki legal_name (--reissue)
        "CN=issuer.sandbox.tamga.network, O=Ulubilim Üniversitesi — identity matching at issuance (TEST), 2.5.4.97=VATTR-0000000005, C=TR",
        san("issuer.sandbox.tamga.network"),
      ),
    ),
    // ADR-0050: registry-sandbox kervanyolu TR-VKN TR0000000003
    await ensure(
      "issuer-example-events",
      signedByRoot(
        1221,
        "CN=Kervanyolu Etkinlik (TEST), OU=Bilet Satışı, O=Kervanyolu Etkinlik (TEST), 2.5.4.97=VATTR-0000000003, C=TR",
      ),
    ),
    await ensure(
      "issuer-example-events-status",
      signedByRoot(
        1222,
        "CN=Kervanyolu Etkinlik - Status List (TEST), OU=Status, O=Kervanyolu Etkinlik (TEST), 2.5.4.97=VATTR-0000000003, C=TR",
      ),
    ),
    await ensure(
      "issuer-example-cinema",
      // ADR-0050: registry-sandbox isikperde TR-VKN TR0000000006
      signedByRoot(
        1311,
        "CN=Işıkperde Sineması (TEST), OU=Bilet Satışı, O=Işıkperde Sineması (TEST), 2.5.4.97=VATTR-0000000006, C=TR",
      ),
    ),
    await ensure(
      "issuer-example-cinema-status",
      signedByRoot(
        1312,
        "CN=Işıkperde Sineması - Status List (TEST), OU=Status, O=Işıkperde Sineması (TEST), 2.5.4.97=VATTR-0000000006, C=TR",
      ),
    ),
    // 2026-11-19 sandbox gösterim ağı (proje yönetimi onayı): yeni kurgusal kurumlar; dosya adı = kiracı slug'ı.
    // ADR-0050: registry-sandbox TR-VKN TR0000000008…TR0000000012.
    await ensure(
      "issuer-gokbilge",
      signedByRoot(
        1031,
        "CN=Gökbilge Teknik Üniversitesi (TEST), OU=Öğrenci İşleri, O=Gökbilge Teknik Üniversitesi (TEST), 2.5.4.97=VATTR-0000000008, C=TR",
      ),
    ),
    await ensure(
      "issuer-gokbilge-status",
      signedByRoot(
        1032,
        "CN=Gökbilge Teknik Üniversitesi - Status List (TEST), OU=Status, O=Gökbilge Teknik Üniversitesi (TEST), 2.5.4.97=VATTR-0000000008, C=TR",
      ),
    ),
    await ensure(
      "issuer-akcinar",
      signedByRoot(
        1041,
        "CN=Akçınar Sağlık Bilimleri Üniversitesi (TEST), OU=Öğrenci İşleri, O=Akçınar Sağlık Bilimleri Üniversitesi (TEST), 2.5.4.97=VATTR-0000000009, C=TR",
      ),
    ),
    await ensure(
      "issuer-akcinar-status",
      signedByRoot(
        1042,
        "CN=Akçınar Sağlık Bilimleri Üniversitesi - Status List (TEST), OU=Status, O=Akçınar Sağlık Bilimleri Üniversitesi (TEST), 2.5.4.97=VATTR-0000000009, C=TR",
      ),
    ),
    await ensure(
      "issuer-uzakyol",
      signedByRoot(
        1051,
        "CN=Uzakyol Açıköğretim Üniversitesi (TEST), OU=Öğrenci İşleri, O=Uzakyol Açıköğretim Üniversitesi (TEST), 2.5.4.97=VATTR-0000000010, C=TR",
      ),
    ),
    await ensure(
      "issuer-uzakyol-status",
      signedByRoot(
        1052,
        "CN=Uzakyol Açıköğretim Üniversitesi - Status List (TEST), OU=Status, O=Uzakyol Açıköğretim Üniversitesi (TEST), 2.5.4.97=VATTR-0000000010, C=TR",
      ),
    ),
    await ensure(
      "issuer-gokkapi",
      signedByRoot(
        1231,
        "CN=Gökkapı Arena (TEST), OU=Bilet Satışı, O=Gökkapı Arena (TEST), 2.5.4.97=VATTR-0000000011, C=TR",
      ),
    ),
    await ensure(
      "issuer-gokkapi-status",
      signedByRoot(
        1232,
        "CN=Gökkapı Arena - Status List (TEST), OU=Status, O=Gökkapı Arena (TEST), 2.5.4.97=VATTR-0000000011, C=TR",
      ),
    ),
    await ensure(
      "issuer-kopruyaka",
      signedByRoot(
        1241,
        "CN=Köprüyaka Kongre Merkezi (TEST), OU=Bilet Satışı, O=Köprüyaka Kongre Merkezi (TEST), 2.5.4.97=VATTR-0000000012, C=TR",
      ),
    ),
    await ensure(
      "issuer-kopruyaka-status",
      signedByRoot(
        1242,
        "CN=Köprüyaka Kongre Merkezi - Status List (TEST), OU=Status, O=Köprüyaka Kongre Merkezi (TEST), 2.5.4.97=VATTR-0000000012, C=TR",
      ),
    ),
    // ADR-0095 K2: iletişim belgesinin kaynak kurumları (yalnız sandbox; registry-sandbox TR-VKN TR0000000020 / TR0000000021)
    await ensure(
      "issuer-sinyalnet",
      signedByRoot(
        1401,
        "CN=Sinyalnet Mobil (TEST), OU=Abone Hizmetleri, O=Sinyalnet Mobil (TEST), 2.5.4.97=VATTR-0000000020, C=TR",
      ),
    ),
    await ensure(
      "issuer-sinyalnet-status",
      signedByRoot(
        1402,
        "CN=Sinyalnet Mobil - Status List (TEST), OU=Status, O=Sinyalnet Mobil (TEST), 2.5.4.97=VATTR-0000000020, C=TR",
      ),
    ),
    await ensure(
      "issuer-postakus",
      signedByRoot(
        1411,
        "CN=Postakuş (TEST), OU=Kullanıcı Hizmetleri, O=Postakuş (TEST), 2.5.4.97=VATTR-0000000021, C=TR",
      ),
    ),
    await ensure(
      "issuer-postakus-status",
      signedByRoot(
        1412,
        "CN=Postakuş - Status List (TEST), OU=Status, O=Postakuş (TEST), 2.5.4.97=VATTR-0000000021, C=TR",
      ),
    ),
    // ADR-0093 K5: temsili ülkelerin kurgusal üniversiteleri (Günəşli — AZ, Dalaqala — KZ); kendi ülke listelerinde kayıtlı
    await ensure(
      "issuer-gunesli",
      signedByRoot(
        1061,
        "CN=Günəşli Texniki Universiteti (TEST), OU=Tələbə işləri, O=Günəşli Texniki Universiteti (TEST), 2.5.4.97=VATAZ-1000000001, C=AZ",
      ),
    ),
    await ensure(
      "issuer-gunesli-status",
      signedByRoot(
        1062,
        "CN=Günəşli Texniki Universiteti - Status List (TEST), OU=Status, O=Günəşli Texniki Universiteti (TEST), 2.5.4.97=VATAZ-1000000001, C=AZ",
      ),
    ),
    await ensure(
      "issuer-dalaqala",
      signedByRoot(
        1071,
        "CN=Dalaqala Universiteti (TEST), OU=Studentter isteri, O=Dalaqala Universiteti (TEST), 2.5.4.97=VATKZ-100000000001, C=KZ",
      ),
    ),
    await ensure(
      "issuer-dalaqala-status",
      signedByRoot(
        1072,
        "CN=Dalaqala Universiteti - Status List (TEST), OU=Status, O=Dalaqala Universiteti (TEST), 2.5.4.97=VATKZ-100000000001, C=KZ",
      ),
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
    ...(await pidAuthorityItems()),
  ];
}

/**
 * ADR-0094 (yalnız sandbox): temsili ulusal kimlik makamları (adlar `apps/trust-publisher/registry-sandbox/pid-providers.source.json`
 * ile aynı). Her makamın kendi test kökü (Tamga sandbox köküne BAĞLANMAZ — PP3),
 * PID imza yaprağı ve iptal listesi yaprağı. Kök, makamın sağlayıcı listesini (ETSI TS 119 602 LoTE, `ops/sandbox-pid-lote.ts`)
 * imzalar ve listede hizmet sertifikası olarak görünür. Kök özel anahtarı sunucuya gitmez (`upload.ps1` dışarıda bırakır); yapraklar
 * sandbox kurumlarınınki gibi sunucuda (S-1). Adlar `pid-<cc>-*`: `issuer-` öneki yok (Tamga kurum profili ADR-0050 uygulanmaz).
 */
const PID_AUTHORITIES: Array<[cc: string, serialBase: number, name: string]> = [
  ["tr", 7100, "Ulusal Kimlik Makamı — Türkiye (temsili)"],
  ["az", 7200, "Ulusal Kimlik Makamı — Azerbaycan (temsili)"],
  ["kz", 7300, "Ulusal Kimlik Makamı — Kazakistan (temsili)"],
];
async function pidAuthorityItems(): Promise<Item[]> {
  const out: Item[] = [];
  for (const [cc, base, name] of PID_AUTHORITIES) {
    const C = cc.toUpperCase();
    const org = `${name} (TEST)`;
    const pidRoot = await ensure(`pid-${cc}-root`, async () => {
      const kp = await keys();
      const cert = await X509CertificateGenerator.createSelfSigned({
        serialNumber: serial(base + 1),
        name: `CN=${org} Test Root, O=${org}, OU=Tamga Network Sandbox, C=${C}`,
        notBefore: new Date(),
        notAfter: years(5),
        signingAlgorithm: ALG,
        keys: kp,
        extensions: [
          new BasicConstraintsExtension(true, 0, true),
          new KeyUsagesExtension(
            KeyUsageFlags.keyCertSign | KeyUsageFlags.cRLSign | KeyUsageFlags.digitalSignature,
            true,
          ),
          await SubjectKeyIdentifierExtension.create(kp.publicKey),
        ],
      });
      return { cert, privateKey: kp.privateKey };
    });
    const leaf =
      (no: number, cn: string): Make =>
      async (reuse?: Reuse) => {
        const kp = reuse?.keys ?? (await keys());
        const cert = await X509CertificateGenerator.create({
          serialNumber: reuse?.serialHex ?? serial(no),
          subject: `CN=${cn}, O=${org}, OU=Tamga Network Sandbox, C=${C}`,
          issuer: pidRoot.cert.subject,
          notBefore: new Date(),
          notAfter: years(2),
          signingAlgorithm: ALG,
          publicKey: kp.publicKey,
          signingKey: pidRoot.privateKey ?? die(`pid-${cc}-root özel anahtarı yok — yaprak imzalanamaz`),
          extensions: (await leafExt(kp.publicKey, [
            await AuthorityKeyIdentifierExtension.create(pidRoot.cert.publicKey),
          ])) as never,
        });
        return { cert, privateKey: kp.privateKey };
      };
    // K3: sağlayıcı listesinin kendi imzacısı — kendinden imzalı (ülke listesi ve LOTL imzacılarından ayrı); anahtarı sunucuya gider,
    // liste yayıncısı listeyi her yayında yeniden imzalar (kök anahtarı gerekmez)
    const listSigner = await ensure(`pid-${cc}-list-signer`, async () => {
      const kp = await keys();
      const cert = await X509CertificateGenerator.createSelfSigned({
        serialNumber: serial(base + 4),
        name: `CN=${org} PID Provider List Signer, O=Tamga Network Sandbox (TEST), C=${C}`,
        notBefore: new Date(),
        notAfter: years(2),
        signingAlgorithm: ALG,
        keys: kp,
        extensions: [
          new KeyUsagesExtension(KeyUsageFlags.digitalSignature, true),
          await SubjectKeyIdentifierExtension.create(kp.publicKey),
        ],
      });
      return { cert, privateKey: kp.privateKey };
    });
    out.push(
      pidRoot,
      await ensure(`pid-${cc}-issuer`, leaf(base + 2, `${org} PID Issuer`)),
      await ensure(`pid-${cc}-status`, leaf(base + 3, `${org} PID Status List`)),
      listSigner,
    );
  }
  return out;
}

/**
 * ADR-0066 K4 — ETSI TS 119 612 V2.4.1 §5.7.1 liste imzacısı: kökçe imzalı yaprak; konu C + O; basicConstraints CA=false (kritik);
 * keyUsage digitalSignature + nonRepudiation (kritik, başka bit yok); SKI; AKI = kökün SKI'si; extendedKeyUsage id-tsl-kp-tslSigning
 * (0.4.0.2231.3.0). Süre 2 yıl. Liste yayıncısı (`tlSignerProblems`) aynı profili denetler.
 */
function tlXmlSigner(root: Item, serialNo: number, subject: string): Make {
  return async (reuse?: Reuse) => {
    const kp = reuse?.keys ?? (await keys());
    const cert = await X509CertificateGenerator.create({
      serialNumber: reuse?.serialHex ?? serial(serialNo),
      subject,
      issuer: root.cert.subject,
      notBefore: new Date(),
      notAfter: years(2),
      signingAlgorithm: ALG,
      publicKey: kp.publicKey,
      signingKey: root.privateKey ?? die("kök CA özel anahtarı yok — XML liste imzacısı imzalanamaz"),
      extensions: [
        new BasicConstraintsExtension(false, undefined, true),
        new KeyUsagesExtension(KeyUsageFlags.digitalSignature | KeyUsageFlags.nonRepudiation, true),
        await SubjectKeyIdentifierExtension.create(kp.publicKey),
        await AuthorityKeyIdentifierExtension.create(root.cert.publicKey),
        new ExtendedKeyUsageExtension(["0.4.0.2231.3.0"], false),
      ] as never,
    });
    return { cert, privateKey: kp.privateKey };
  };
}

/**
 * ADR-0087 K2 — erişim sertifikası makamı: kökçe imzalı ara makam; basicConstraints CA, yol uzunluğu 0 (kritik); keyUsage
 * keyCertSign + cRLSign (kritik); SKI; AKI = kökün SKI'si; CRL dağıtım noktası = kökün CRL'i. Süre 3 yıl.
 */
function accessCa(root: Item, serialNo: number, subject: string): Make {
  return async (reuse?: Reuse) => {
    const kp = reuse?.keys ?? (await keys());
    const cert = await X509CertificateGenerator.create({
      serialNumber: reuse?.serialHex ?? serial(serialNo),
      subject,
      issuer: root.cert.subject,
      notBefore: new Date(),
      notAfter: years(3),
      signingAlgorithm: ALG,
      publicKey: kp.publicKey,
      signingKey: root.privateKey ?? die("kök CA özel anahtarı yok — erişim sertifikası makamı imzalanamaz"),
      extensions: [
        new BasicConstraintsExtension(true, 0, true),
        new KeyUsagesExtension(KeyUsageFlags.keyCertSign | KeyUsageFlags.cRLSign, true),
        await SubjectKeyIdentifierExtension.create(kp.publicKey),
        await AuthorityKeyIdentifierExtension.create(root.cert.publicKey),
        cdp("root-ca"),
      ] as never,
    });
    return { cert, privateKey: kp.privateKey };
  };
}

/**
 * ADR-0087 K4 — kökün CRL'i (`--root-crl`): kökün anahtarıyla imzalanır (kökün durduğu bilgisayarda); var olan `root-ca.crl`'in
 * iptalleri korunur, `--revoke <seri>:<gerekçe>[,…]` eklenir (gerekçe: key_compromise | ca_compromise | superseded |
 * cessation_of_operation | privilege_withdrawn). CRL numarası = saniye cinsinden zaman (durum dosyası gerekmeden tekdüze);
 * nextUpdate 365 gün. AKI + CRLNumber.
 */
async function writeRootCrl(root: Item) {
  const key = root.privateKey ?? die("--root-crl: kök CA özel anahtarı yok (kökün durduğu bilgisayarda çalıştırın)");
  const file = resolve(outDir, "root-ca.crl");
  const reasons: Record<string, X509CrlReason> = {
    key_compromise: X509CrlReason.keyCompromise,
    ca_compromise: X509CrlReason.cACompromise,
    superseded: X509CrlReason.superseded,
    cessation_of_operation: X509CrlReason.cessationOfOperation,
    privilege_withdrawn: X509CrlReason.privilegeWithdrawn,
  };
  const entries = new Map<string, { serialNumber: string; revocationDate: Date; reason?: X509CrlReason }>();
  if (existsSync(file))
    for (const e of new X509Crl(new Uint8Array(readFileSync(file))).entries)
      entries.set(e.serialNumber.toLowerCase(), {
        serialNumber: e.serialNumber,
        revocationDate: e.revocationDate,
        reason: e.reason,
      });
  const revokeArg = process.argv.find((a) => a.startsWith("--revoke="))?.slice(9) ?? "";
  for (const item of revokeArg.split(",").filter(Boolean)) {
    const [sn, why] = item.split(":");
    if (!/^[0-9a-fA-F]{2,64}$/.test(sn ?? "") || !(why in reasons))
      die(`--revoke: <onaltılık seri>:<${Object.keys(reasons).join("|")}> biçiminde (${item})`);
    if (!entries.has(sn.toLowerCase()))
      entries.set(sn.toLowerCase(), { serialNumber: sn, revocationDate: new Date(), reason: reasons[why] });
  }
  const now = new Date();
  const n = Math.floor(now.getTime() / 1000);
  let hex = n.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  let num = Buffer.from(hex, "hex");
  if (num[0] & 0x80) num = Buffer.concat([Buffer.from([0]), num]);
  const ski = root.cert.getExtension(SubjectKeyIdentifierExtension)?.keyId;
  const crl = await X509CrlGenerator.create({
    issuer: root.cert.subjectName,
    thisUpdate: now,
    nextUpdate: new Date(now.getTime() + 365 * 86400_000),
    signingAlgorithm: ALG,
    signingKey: key,
    extensions: [
      ski
        ? new AuthorityKeyIdentifierExtension(ski)
        : await AuthorityKeyIdentifierExtension.create(root.cert.publicKey),
      new Extension("2.5.29.20", false, new Uint8Array([0x02, num.length, ...num])),
    ],
    entries: [...entries.values()],
  });
  writeFileSync(file, new Uint8Array(crl.rawData));
  console.log(`root-ca.crl: ${entries.size} iptal, CRL #${n}, nextUpdate ${crl.nextUpdate?.toISOString()}`);
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
          // ADR-0094: temsili PID makamları dış sağlayıcıdır (Tamga kimliği yok)
          items
            .filter((it) => !it.name.startsWith("pid-"))
            .map((it) => [
              it.name,
              it === root || /-ca(-\d+)?$/.test(it.name)
                ? computeCaId(STATE, der(it.name))
                : it.name.startsWith("rp-")
                  ? computeRpId(STATE, der(it.name))
                  : // ADR-0093: temsili ülkelerin kurumları kendi ülke koduyla (liste yayıncısının hesapladığı kimlikle aynı)
                    computeIssuerId(SANDBOX_ISSUER_STATES[it.name.replace(/-status$/, "")] ?? STATE, der(it.name)),
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
  // ADR-0050 (CP1, CP2): kurum yapraklarının profili — sandbox'ta eksik alan hatadır, üretimde uyarı (kimlik numarası kayda girince
  // `pki-issue.ts --prod --org-id` ile yenilenir), geliştirmede kimlik numarası beklenmez.
  for (const it of items.filter((i) => i.name.startsWith("issuer-"))) {
    const problems = institutionProfileProblems(it.cert, PROFILE === "sandbox" || PROD);
    if (!problems.length) continue;
    const msg = `ADR-0050: ${it.name} kurum sertifika profiline uymuyor — ${problems.join("; ")}`;
    if (PROFILE === "sandbox") die(msg);
    if (PROD || problems.some((p) => !p.startsWith("organizationIdentifier"))) console.warn(`[uyarı] ${msg}`);
  }
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
/** ADR-0050 K2: kurum (belge veren) sertifika profili denetimi; sorun listesi döner (boşsa uyar). */
function institutionProfileProblems(cert: X509Certificate, needOrgId: boolean): string[] {
  const out: string[] = [];
  if (needOrgId && !/(^|, )2\.5\.4\.97=(VAT|NTR|LEI)[A-Z]{2}-/.test(cert.subject))
    out.push("organizationIdentifier (2.5.4.97) yok");
  if (!/(^|, )O=/.test(cert.subject) || !/(^|, )C=/.test(cert.subject)) out.push("O ya da C yok");
  const ku = cert.getExtension(KeyUsagesExtension);
  if (!ku || !ku.critical || ku.usages !== KeyUsageFlags.digitalSignature)
    out.push("anahtar kullanımı kritik ve yalnız digitalSignature değil");
  if (!cert.getExtension(SubjectKeyIdentifierExtension)) out.push("SKI yok");
  if (!cert.getExtension(AuthorityKeyIdentifierExtension)) out.push("AKI yok");
  return out;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
