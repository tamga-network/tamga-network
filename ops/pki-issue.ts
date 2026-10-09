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
 * Kurallar: yalnız P-256 / ES256; CSR imzası doğrulanır; 2 yıl (en çok 3); seri numarası rastgele.
 */
import {
  X509CertificateGenerator,
  Pkcs10CertificateRequest,
  cryptoProvider,
  KeyUsageFlags,
  KeyUsagesExtension,
  BasicConstraintsExtension,
  SubjectKeyIdentifierExtension,
  SubjectAlternativeNameExtension,
  X509Certificate,
} from "@peculiar/x509";
import { webcrypto, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { certFingerprintSha256Hex, pemToDer } from "@tamga-network/core";

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
  if (existsSync(resolve(PKI, `${name}.cert.pem`)))
    fail(`zaten var: ${resolve(PKI, `${name}.cert.pem`)} (üzerine yazılmaz)`);
  const yearsN = Number(arg("years") ?? 2);
  if (!(yearsN >= 1 && yearsN <= 3)) fail("--years 1–3");
  const dns = arg("dns");
  if (dns && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(dns)) fail("--dns geçerli bir alan adı olmalı");

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
  } else if (process.argv.includes("--generate")) {
    subject = arg("subject") ?? fail('--generate ile --subject gerekli (ör. "CN=Yeni, O=Yeni, C=TR")');
    const kp = (await crypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
    publicKey = kp.publicKey;
    privateKey = kp.privateKey;
  } else return fail("--csr <dosya> ya da --generate gerekli");

  // ADR-0026 K3: kurum kimlik numarası (organizationIdentifier, EN 319 412-1) — kayıt sertifikasının `sub`'ıyla aynı
  const orgId = arg("org-id");
  if (orgId) {
    if (!/^(VAT|NTR|LEI)[A-Z]{2}-[A-Za-z0-9]{1,40}$/.test(orgId))
      fail("--org-id: VATTR-<VKN> ya da NTRTR-<MERSİS> biçiminde");
    if (/2\.5\.4\.97=/.test(subject)) fail("konu alanında zaten organizationIdentifier var");
    subject = `${subject}, 2.5.4.97=${orgId}`;
  }
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
      ...(dns ? [new SubjectAlternativeNameExtension([{ type: "dns", value: dns }])] : []),
    ],
  });
  writeFileSync(resolve(PKI, `${name}.cert.pem`), cert.toString("pem") + "\n");
  if (privateKey)
    writeFileSync(
      resolve(PKI, `${name}.pkcs8.pem`),
      toPem("PRIVATE KEY", new Uint8Array(await crypto.subtle.exportKey("pkcs8", privateKey))),
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
