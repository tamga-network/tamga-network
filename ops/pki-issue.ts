/**
 * ops/pki-issue.ts — yeni katılımcıya (kurum / doğrulayıcı) kök CA imzalı yaprak sertifika (operatör kayıt aracının ilk adımı).
 *
 *   npx tsx ops/pki-issue.ts --prod --name issuer-yeni --csr yeni.csr.pem     pilot: kurum anahtarını kendi tutar, CSR gönderir
 *   npx tsx ops/pki-issue.ts --prod --name rp-shop --csr shop.csr.pem --dns shop.example.com --org-id VATTR-1234567890   doğrulayıcı erişim sertifikası (SAN + kurum kimlik no, ADR-0026)
 *   npx tsx ops/pki-issue.ts --dev --name issuer-yeni --generate --subject "CN=Yeni, O=Yeni, C=TR"   yerel deneme: anahtar dosyada (sapma S-1)
 *
 * Hangi kökle imzalanacağı AÇIKÇA seçilir (varsayılan yok):
 *   --prod                 gerçek ağın kökü: klasör TAMGA_PROD_PKI_DIR (ya da --pki-dir <klasör>); depo dışında, operatörün gizli
 *                          klasöründe (kök CA özel anahtarı yalnız orada). Üretilen sertifika oraya yazılır.
 *   --dev                  depodaki geliştirme PKI'sı (`ops/pki/`, rastgele yerel anahtarlar; gerçek listede geçmez)
 * Çıktı `<klasör>/<name>.cert.pem` (+ `--generate` ile `<name>.pkcs8.pem`). Var olan ad üzerine yazılmaz.
 * Sonra: `npm run trust:register -- issuer|rp <başvuru.json>` (başvurudaki `cert` / `access_cert` = bu ad).
 * Kurallar: yalnız P-256 / ES256; CSR imzası doğrulanır; 2 yıl (en çok 3); seri numarası rastgele; SKI + AKI (kökün SKI'si).
 * Kurum sertifikası (ADR-0050, ETSI TS 119 412-6): `--prod` ile `issuer-*` adında `--org-id` (ya da konu alanında 2.5.4.97) ZORUNLU —
 *   kayıt sertifikasının `sub`'ıyla aynı değer (TR-VKN → VATTR-<VKN>, TR-MERSIS → NTRTR-<MERSİS>); konu alanında O ve C bulunmalı.
 * Erişim sertifikası (ADR-0058, ETSI TS 119 411-8 §6.6.1): `--contact-uri <https://…>` kayıttaki destek adresini SAN'a
 *   `uniformResourceIdentifier` olarak yazar (GEN-6.6.1-07 iletişim bilgisi; `--prod` erişim sertifikasında ZORUNLU, AC1);
 *   `--contact-email <adres>` kayıttaki kurumsal e-postayı `rfc822Name` olarak ekler (kişisel adres yazılmaz); `--service-id
 *   <kimlik>` hizmete bağlı sertifikada hizmet kimliğini `OU`'ya yazar (GEN-6.6.1-08, AB TS5 `serviceIdentifier`).
 * Aynı anahtarla yenileme (ADR-0034 yenileme sırası, ADR-0058): `--key <name.pkcs8.pem>` CSR yerine var olan özel anahtarı kullanır
 *   (açık anahtar ondan; anahtar dosyası değişmez) ve `--replace` var olan `<name>.cert.pem`'i `_yedek-<tarih>/` altına taşıyıp
 *   yenisini yazar; klasörde `pki.json` varsa o adın satırı (konu, parmak izi, bitiş) ve kimliği (`ids`) güncellenir.
 *   ör. `--prod --name rp-verify --key <klasör>/rp-verify.pkcs8.pem --replace --subject "CN=Tamga Verify, O=…, C=TR" --dns
 *   verify.tamga.network --org-id VATTR-… --contact-uri https://tamga.network --contact-email info@tamga.network`
 */
import {
  X509CertificateGenerator,
  Pkcs10CertificateRequest,
  cryptoProvider,
  KeyUsageFlags,
  KeyUsagesExtension,
  BasicConstraintsExtension,
  SubjectKeyIdentifierExtension,
  AuthorityKeyIdentifierExtension,
  SubjectAlternativeNameExtension,
  X509Certificate,
} from "@peculiar/x509";
import { webcrypto, randomBytes } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { certFingerprintSha256Hex, computeIssuerId, computeRpId, pemToDer } from "@tamga-network/core";

cryptoProvider.set(webcrypto as unknown as Crypto);
const crypto = webcrypto as unknown as Crypto;
const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;
const DEV_PKI = resolve(dirname(fileURLToPath(import.meta.url)), "pki");

const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const fail = (m: string): never => {
  console.error(m);
  process.exit(2);
};
const PROD = process.argv.includes("--prod");
const DEV = process.argv.includes("--dev");
if (PROD === DEV)
  fail(
    "Hangi kök? --prod (gerçek ağ; TAMGA_PROD_PKI_DIR ya da --pki-dir <klasör>, depo dışındaki gizli klasör) ya da --dev (depodaki geliştirme PKI'sı ops/pki).",
  );
const PKI = PROD
  ? resolve(
      arg("pki-dir") ??
        process.env.TAMGA_PROD_PKI_DIR ??
        fail("--prod: üretim PKI klasörü verilmedi (TAMGA_PROD_PKI_DIR=<klasör> ya da --pki-dir <klasör>)"),
    )
  : DEV_PKI;
if (PROD && resolve(PKI) === DEV_PKI) fail("--prod ile depodaki ops/pki kullanılmaz (orası geliştirme PKI'sı)");
if (!existsSync(resolve(PKI, "root-ca.cert.pem")) || !existsSync(resolve(PKI, "root-ca.pkcs8.pem")))
  fail(`kök CA bulunamadı (root-ca.cert.pem + root-ca.pkcs8.pem): ${PKI}${DEV ? " — önce npm run pki" : ""}`);
const pemBody = (pem: string) => Buffer.from(pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, ""), "base64");
const toPem = (label: string, der: Uint8Array) =>
  `-----BEGIN ${label}-----\n${Buffer.from(der)
    .toString("base64")
    .match(/.{1,64}/g)!
    .join("\n")}\n-----END ${label}-----\n`;

async function main() {
  const name = arg("name") ?? fail("--name gerekli (ör. issuer-yeni, rp-shop)");
  if (!/^(issuer|rp)-[a-z0-9-]{2,40}$/.test(name)) fail("--name: issuer-<ad> ya da rp-<ad> (küçük harf, rakam, tire)");
  const REPLACE = process.argv.includes("--replace");
  if (existsSync(resolve(PKI, `${name}.cert.pem`)) && !REPLACE)
    fail(
      `zaten var: ${resolve(PKI, `${name}.cert.pem`)} (üzerine yazılmaz; aynı anahtarla yenileme için --key + --replace)`,
    );
  if (REPLACE && !existsSync(resolve(PKI, `${name}.cert.pem`))) fail(`--replace: ${name}.cert.pem yok`);
  const yearsN = Number(arg("years") ?? 2);
  if (!(yearsN >= 1 && yearsN <= 3)) fail("--years 1–3");
  const dns = arg("dns");
  if (dns && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(dns)) fail("--dns geçerli bir alan adı olmalı");
  // ADR-0058 (öneri): erişim sertifikasında iletişim bilgisi (SAN URI) ve hizmete bağlı sertifikada hizmet kimliği (OU)
  const contactUri = arg("contact-uri");
  if (contactUri !== undefined) {
    let u: URL | undefined;
    try {
      u = new URL(contactUri);
    } catch {
      /* aşağıda */
    }
    if (!u || u.protocol !== "https:") fail("--contact-uri: https:// ile başlayan destek adresi olmalı");
  }
  const contactEmail = arg("contact-email");
  if (contactEmail !== undefined && !/^[A-Za-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(contactEmail))
    fail("--contact-email: geçerli bir e-posta adresi olmalı (kurumsal; kişisel adres yazılmaz)");
  const serviceId = arg("service-id");
  if (serviceId !== undefined && !/^[A-Za-z0-9._:-]{1,64}$/.test(serviceId))
    fail("--service-id: harf, rakam, nokta, alt çizgi, iki nokta ya da tire (en çok 64)");
  if ((contactUri !== undefined || contactEmail !== undefined || serviceId !== undefined) && !name.startsWith("rp-"))
    fail("--contact-uri / --contact-email / --service-id yalnız erişim sertifikasında (rp-*)");

  const root = new X509Certificate(readFileSync(resolve(PKI, "root-ca.cert.pem"), "utf8"));
  const rootKey = await crypto.subtle.importKey(
    "pkcs8",
    pemBody(readFileSync(resolve(PKI, "root-ca.pkcs8.pem"), "utf8")),
    ALG,
    false,
    ["sign"],
  );

  let publicKey: CryptoKey;
  let subject: string;
  let privateKey: CryptoKey | undefined;
  const csrFile = arg("csr");
  if (csrFile) {
    const csr = new Pkcs10CertificateRequest(readFileSync(resolve(csrFile), "utf8"));
    if (!(await csr.verify())) fail("CSR imzası geçersiz");
    const alg = csr.publicKey.algorithm as EcKeyAlgorithm;
    if (alg.name !== "ECDSA" || alg.namedCurve !== "P-256") fail("yalnız P-256 (ES256) anahtar kabul edilir");
    publicKey = await csr.publicKey.export(ALG, ["verify"], crypto);
    subject = arg("subject") ?? csr.subject;
  } else if (arg("key")) {
    // aynı anahtarla yenileme: açık anahtar özel anahtardan (JWK x/y); özel anahtar dosyası okunur, değiştirilmez
    subject = arg("subject") ?? fail('--key ile --subject gerekli (ör. "CN=Tamga Verify, O=…, C=TR")');
    const sk = await crypto.subtle.importKey("pkcs8", pemBody(readFileSync(resolve(arg("key")!), "utf8")), ALG, true, [
      "sign",
    ]);
    const { kty, crv, x, y } = await crypto.subtle.exportKey("jwk", sk);
    publicKey = await crypto.subtle.importKey("jwk", { kty, crv, x, y }, ALG, true, ["verify"]);
  } else if (process.argv.includes("--generate")) {
    subject = arg("subject") ?? fail('--generate ile --subject gerekli (ör. "CN=Yeni, O=Yeni, C=TR")');
    const kp = (await crypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
    publicKey = kp.publicKey;
    privateKey = kp.privateKey;
  } else return fail("--csr <dosya>, --key <özel anahtar> ya da --generate gerekli");
  if (REPLACE && privateKey) fail("--replace yalnız aynı anahtarla (--key ya da --csr); yeni anahtar yeni ad ister");
  if (REPLACE) {
    // aynı anahtar gerçekten aynı mı: var olan sertifikanın açık anahtarı ile verilen anahtar (yanlış dosya → ad ile anahtar ayrışır)
    const old = new X509Certificate(readFileSync(resolve(PKI, `${name}.cert.pem`), "utf8"));
    const a = Buffer.from(await crypto.subtle.exportKey("spki", await old.publicKey.export(ALG, ["verify"], crypto)));
    const b = Buffer.from(await crypto.subtle.exportKey("spki", publicKey!));
    if (!a.equals(b))
      fail(`--replace: verilen anahtar ${name}.cert.pem'deki anahtarla aynı değil (yeni anahtar yeni ad ister)`);
  }

  // ADR-0026 K3: kurum kimlik numarası (organizationIdentifier, EN 319 412-1) — kayıt sertifikasının `sub`'ıyla aynı
  const orgId = arg("org-id");
  if (orgId) {
    if (!/^(VAT|NTR|LEI)[A-Z]{2}-[A-Za-z0-9]{1,40}$/.test(orgId))
      fail("--org-id: VATTR-<VKN> ya da NTRTR-<MERSİS> biçiminde");
    if (/2\.5\.4\.97=/.test(subject)) fail("konu alanında zaten organizationIdentifier var");
    subject = `${subject}, 2.5.4.97=${orgId}`;
  }
  if (serviceId !== undefined) {
    if (/(^|,\s*)OU=/.test(subject)) fail("konu alanında zaten OU var (--service-id ile birlikte kullanılmaz)");
    subject = `${subject}, OU=${serviceId}`;
  }
  // ADR-0050 (CP1): gerçek ağda kurum sertifikası kurum kimlik numarasıyla verilir
  if (name.startsWith("issuer-")) {
    if (PROD && !/2\.5\.4\.97=/.test(subject))
      fail("--prod kurum sertifikası (issuer-*): --org-id VATTR-<VKN> ya da NTRTR-<MERSİS> zorunlu (ADR-0050)");
    if (!/(^|,\s*)O=/.test(subject) || !/(^|,\s*)C=/.test(subject))
      fail("kurum sertifikası konu alanında O (resmî ad) ve C (ülke) bulunmalı (ADR-0050)");
  }
  // ADR-0026 K3 + ADR-0034 CI3: gerçek ağda erişim sertifikası (rp-*) kurum kimlik numarasını ve kaydın alan adını (SAN) taşır —
  // yoksa kayıt sertifikası (WRPRC) üretilmez ve yayıncı SAN denetiminde durur; sorun kayıt anında değil burada yakalansın
  if (PROD && name.startsWith("rp-")) {
    if (!dns) fail("--prod erişim sertifikası (rp-*): --dns <kayıttaki dns_name> zorunlu (ADR-0034 CI3)");
    if (!/2\.5\.4\.97=/.test(subject))
      fail("--prod erişim sertifikası (rp-*): --org-id VATTR-<VKN> ya da NTRTR-<MERSİS> zorunlu (ADR-0026 K3)");
    if (contactUri === undefined)
      fail(
        "--prod erişim sertifikası (rp-*): --contact-uri <kayıttaki support_uri> zorunlu (ETSI TS 119 411-8 GEN-6.6.1-07; ADR-0058 AC1)",
      );
  }
  const san = [
    ...(dns ? [{ type: "dns" as const, value: dns }] : []),
    ...(contactUri !== undefined ? [{ type: "url" as const, value: contactUri }] : []),
    ...(contactEmail !== undefined ? [{ type: "email" as const, value: contactEmail }] : []),
  ];
  const notBefore = new Date();
  const notAfter = new Date(notBefore);
  notAfter.setUTCFullYear(notAfter.getUTCFullYear() + yearsN);
  const cert = await X509CertificateGenerator.create({
    // pozitif, 128 bit rastgele (RFC 5280 §4.1.2.2)
    serialNumber: "7" + randomBytes(16).toString("hex").slice(1),
    subject,
    issuer: root.subject,
    notBefore,
    notAfter,
    signingAlgorithm: ALG,
    publicKey,
    signingKey: rootKey,
    extensions: [
      new BasicConstraintsExtension(false, undefined, true),
      new KeyUsagesExtension(KeyUsageFlags.digitalSignature, true),
      await SubjectKeyIdentifierExtension.create(publicKey),
      // RFC 5280 §4.2.1.1 / ADR-0050: AKI = kökün SKI'si (HAIP trusted_authorities `aki` eşleşmesi)
      await AuthorityKeyIdentifierExtension.create(root.publicKey),
      ...(san.length ? [new SubjectAlternativeNameExtension(san)] : []),
    ],
  });
  const certFile = resolve(PKI, `${name}.cert.pem`);
  if (REPLACE) {
    // eski sertifika silinmez: tarihli yedek klasörüne (aynı gün ikinci yenilemede sıra numarası)
    const day = new Date().toISOString().slice(0, 10);
    let dir = resolve(PKI, `_yedek-${day}`);
    for (let n = 2; existsSync(resolve(dir, `${name}.cert.pem`)); n++) dir = resolve(PKI, `_yedek-${day}-${n}`);
    mkdirSync(dir, { recursive: true });
    renameSync(certFile, resolve(dir, `${name}.cert.pem`));
    if (existsSync(resolve(PKI, "pki.json")) && !existsSync(resolve(dir, "pki.json")))
      copyFileSync(resolve(PKI, "pki.json"), resolve(dir, "pki.json"));
    console.log(`eski sertifika yedekte: ${resolve(dir, `${name}.cert.pem`)}`);
  }
  writeFileSync(certFile, cert.toString("pem") + "\n");
  // pki.json (varsa): bu adın satırı ve zincir formülüyle kimliği (gen-pki ile aynı adlandırma)
  const pkiJson = resolve(PKI, "pki.json");
  if (existsSync(pkiJson)) {
    const j = JSON.parse(readFileSync(pkiJson, "utf8")) as Record<string, unknown> & { ids?: Record<string, string> };
    const der = pemToDer(cert.toString("pem"));
    j[name] = {
      subject: new X509Certificate(cert.rawData).subject,
      fingerprint_sha256: certFingerprintSha256Hex(der),
      not_after: notAfter.toISOString(),
      created_at: notBefore.toISOString(),
    };
    const state = String(arg("state") ?? "TR");
    const id = name.startsWith("rp-") ? computeRpId(state, der) : computeIssuerId(state, der);
    const sandboxIds = j.profile === "sandbox";
    const key = sandboxIds
      ? name
      : `${name.startsWith("rp-") ? "rp" : "issuer"}_id_${name.replace(/^(rp|issuer)-/, "").replace(/-/g, "_")}`;
    j.ids = { ...(j.ids ?? {}), [key]: id };
    writeFileSync(pkiJson, JSON.stringify(j, null, 2) + "\n");
    console.log(`pki.json güncellendi: ${name} · ids.${key} = ${id}`);
  }
  if (privateKey)
    writeFileSync(
      resolve(PKI, `${name}.pkcs8.pem`),
      toPem("PRIVATE KEY", new Uint8Array(await crypto.subtle.exportKey("pkcs8", privateKey))),
      { mode: 0o600 }, // özel anahtar yalnız sahibine okunur (POSIX; Windows'ta etkisiz)
    );
  console.log(`${PROD ? "ÜRETİM" : "geliştirme"} PKI: ${resolve(PKI, `${name}.cert.pem`)} — ${subject}`);
  console.log(
    `sha256 ${certFingerprintSha256Hex(pemToDer(cert.toString("pem")))} · ${notAfter.toISOString()} tarihine kadar`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
