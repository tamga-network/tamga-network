/**
 * Yalnız sandbox (ADR-0038, ADR-0036): OpenID uyum öz-testi için test PID sağlayıcısının dış listesi. OpenID Foundation uyum
 * aracı AB PID'ini (`urn:eudi:pid:1`, SD-JWT VC) kendi test anahtarıyla imzalar; sandbox doğrulayıcısı bu belgeyi yalnız imzalı bir
 * dış listede (ETSI TS 119 602 LoTE, JAdES compact) kayıtlı sağlayıcıdan kabul eder.
 *
 *   npx tsx ops/sandbox-oidf-lote.ts <test-pki-klasörü>
 *
 * Klasörde `oidf-test-root.cert.pem` + `oidf-test-root.pkcs8.pem` (liste imzacısı ve PID hizmetinin çapası) bulunur; özel anahtar
 * depoya girmez. Çıktı: `apps/trust-publisher/registry-sandbox/external-src/oidf-test-pid.jws` (imzalı, kişisel veri ve anahtar
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
const b64 = (b: Uint8Array) => Buffer.from(b).toString("base64");
const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");
const now = new Date();
const name = "OIDF Conformance Test PID Issuer (TEST)";
const lote = {
  LoTE: {
    ListAndSchemeInformation: {
      LoTEVersionIdentifier: 1,
      LoTESequenceNumber: 1,
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
