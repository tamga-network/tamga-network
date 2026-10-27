/**
 * Yalnız sandbox (ADR-0038, ADR-0036): OpenID uyum öz-testi için test PID sağlayıcısının dış listesi. OpenID Foundation uyum
 * aracı AB PID'ini (`urn:eudi:pid:1`, SD-JWT VC) kendi test anahtarıyla imzalar; sandbox doğrulayıcısı bu belgeyi yalnız imzalı bir
 * dış listede (ETSI TS 119 602 LoTE, JAdES compact) kayıtlı sağlayıcıdan kabul eder.
 *
 *   npx tsx ops/sandbox-oidf-lote.ts <test-pki-klasörü> [sıra-numarası]
 *
 * Klasörde `oidf-test-root.cert.pem` + `oidf-test-root.pkcs8.pem` (liste imzacısı ve PID hizmetinin çapası) ve
 * `oidf-test-pid-issuer.cert.pem` (aracın PID imzacısı yaprağı) bulunur; özel anahtar depoya girmez. Sıra numarası
 * (`LoTESequenceNumber`) her yeniden üretimde artırılır (geri sarma denetimi; varsayılan 2).
 *
 * İptal hizmeti (2026-10-27): araç her testte belgeye kendi sunduğu bir Status List adresi koyar
 * (`https://demo.certification.openid.net/test/a/<takma-ad>/statuslists/…`) ve listeyi belgeyle AYNI anahtarla (PID yaprağı, x5c)
 * imzalar. Dış kurumda iptal listesi imzacısı listedeki iptal hizmeti sertifikasıdır (ADR-0036 K5 D) — bu yüzden yaprak
 * `…/PID/Revocation` hizmeti olarak, aracın alan adı da iki hizmetin erişim noktası (ServiceSupplyPoints) olarak yazılır; doğrulayıcı
 * listeyi yalnız o alan adından çeker. Çıktı: `apps/trust-publisher/registry-sandbox/external-src/oidf-test-pid.jws` (imzalı, kişisel veri ve anahtar
 * yok) ve imzacının parmak izi (LOTL işaretçisindeki `signing_keys`). Liste yayıncısı dosyayı `dist-sandbox/external-src/`'e
 * kopyalar, `external-fetch` oradan çeker ve doğrular.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CompactSign, importPKCS8 } from "jose";
import { pemToDer } from "@tamga-network/core";

const dir = process.argv[2];
if (!dir) throw new Error("kullanım: tsx ops/sandbox-oidf-lote.ts <test-pki-klasörü>");
const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "..", "apps", "trust-publisher", "registry-sandbox", "external-src", "oidf-test-pid.jws");
const rootPem = readFileSync(resolve(dir, "oidf-test-root.cert.pem"), "utf8");
const rootDer = pemToDer(rootPem);
const key = await importPKCS8(readFileSync(resolve(dir, "oidf-test-root.pkcs8.pem"), "utf8"), "ES256");
const leafDer = pemToDer(readFileSync(resolve(dir, "oidf-test-pid-issuer.cert.pem"), "utf8"));
const sequence = Number(process.argv[3] ?? 2);
if (!Number.isInteger(sequence) || sequence < 1) throw new Error("sıra numarası pozitif tam sayı olmalı");
/**
 * Test aracının barındırılan demosu (yalnız https). Yerel kurulum (`localhost.emobix.co.uk`) 127.0.0.1'e çözülür; doğrulayıcının
 * SSRF denetimi oraya istek atmaz, bu yüzden yazılmaz.
 */
const SUPPLY_POINTS = [{ uriValue: "https://demo.certification.openid.net/" }];
const b64 = (b: Uint8Array) => Buffer.from(b).toString("base64");
const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
const now = new Date();
const name = "OIDF Conformance Test PID Issuer (TEST)";
const lote = {
  LoTE: {
    ListAndSchemeInformation: {
      LoTEVersionIdentifier: 1,
      LoTESequenceNumber: sequence,
      LoTEType: "http://uri.etsi.org/19602/LoTEType/test",
      SchemeOperatorName: [{ lang: "en", value: "Tamga Network Sandbox (TEST) — OpenID conformance self-test" }],
      SchemeTerritory: "EU",
      ListIssueDateTime: iso(now),
      NextUpdate: iso(new Date(now.getTime() + 180 * 86_400_000)),
    },
    TrustedEntitiesList: [
      {
        TrustedEntityInformation: { TEName: [{ lang: "en", value: name }] },
        TrustedEntityServices: [
          {
            ServiceInformation: {
              ServiceTypeIdentifier: "http://uri.etsi.org/19602/SvcType/PID/Issuance",
              ServiceName: [{ lang: "en", value: name }],
              ServiceDigitalIdentity: { X509Certificates: [{ val: b64(rootDer) }] },
              ServiceSupplyPoints: SUPPLY_POINTS,
            },
          },
          {
            ServiceInformation: {
              ServiceTypeIdentifier: "http://uri.etsi.org/19602/SvcType/PID/Revocation",
              ServiceName: [{ lang: "en", value: `${name} — status lists` }],
              ServiceDigitalIdentity: { X509Certificates: [{ val: b64(leafDer) }] },
              ServiceSupplyPoints: SUPPLY_POINTS,
            },
          },
        ],
      },
    ],
  },
};
const jws = await new CompactSign(new TextEncoder().encode(JSON.stringify(lote)))
  .setProtectedHeader({
    alg: "ES256",
    cty: "application/json",
    x5c: [b64(rootDer)],
    "x5t#S256": createHash("sha256").update(rootDer).digest("base64url"),
    sigT: iso(now),
    crit: ["sigT"],
  })
  .sign(key, { crit: { sigT: true } });
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, jws + "\n");
console.log(JSON.stringify({ out, signer_fingerprint_sha256: createHash("sha256").update(rootDer).digest("hex") }));
