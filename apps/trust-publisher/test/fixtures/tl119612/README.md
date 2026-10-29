# TS 119 612 XML örneği (sandbox)

`tl-tr.sandbox-sample.xml`: sandbox kayıt defterinden (`registry-sandbox/`) ve sandbox PKI'sından (`ops/pki-sandbox/`, test
anahtarları) üretilmiş, XAdES-B-B imzalı örnek liste (ADR-0066 taslağı). Yayınlanmış bir liste değildir; içindeki bütün kurumlar
sandbox'ın herkese açık test kayıtlarıdır, kişisel veri yoktur. Sandbox imzacısı TS 119 612 §5.7.1 profiline uymaz (basicConstraints,
EKU, O alanı) — sandbox'ta bu uyarıdır; gerçek ağda yayını durdurur.

Yeniden üretmek (depo kökünden; geçici klasöre):

```sh
TAMGA_TL119612=1 TAMGA_TP_REGISTRY=apps/trust-publisher/registry-sandbox TAMGA_TP_PKI=ops/pki-sandbox \
  TAMGA_TP_DIST=<geçici klasör> npx tsx apps/trust-publisher/src/cli.ts build
cp <geçici klasör>/tl-tr.xml apps/trust-publisher/test/fixtures/tl119612/tl-tr.sandbox-sample.xml
```

Test (`test/tl119612.test.ts`) örneği ETSI XSD'lerine ve iki bağımsız imza doğrulayıcısına karşı denetler. 2026-10-29'da örnek AB'nin
DSS doğrulayıcısında da denendi: biçim XAdES-BASELINE-B, başvurular ve imza sağlam; imzacı AB'de güven çapası olmadığından sonuç
INDETERMINATE / NO_CERTIFICATE_CHAIN_FOUND (beklenen).
