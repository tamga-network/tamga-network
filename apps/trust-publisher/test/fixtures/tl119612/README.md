# TS 119 612 XML örneği (sandbox)

`tl-tr.sandbox-sample.xml`: sandbox kayıt defterinden (`registry-sandbox/`) ve sandbox PKI'sından (`ops/pki-sandbox/`, test
anahtarları) üretilmiş, XAdES-B-B imzalı örnek liste (ADR-0066). Sandbox'ta yayımlanan listeyle aynı biçimdedir
(`trust.sandbox.tamga.network/tl-tr.xml`); içindeki bütün kurumlar sandbox'ın herkese açık test kayıtlarıdır, adresler "Sandbox (TEST)"
yer tutucusudur, kişisel veri yoktur. İmzacı ayrı XML imza sertifikası `tl-xml-signer-1` (sandbox kökünce verilmiş, TS 119 612 §5.7.1
profili: C/O, basicConstraints CA=false, keyUsage digitalSignature + nonRepudiation, SKI/AKI, EKU 0.4.0.2231.3.0).

Yeniden üretmek (depo kökünden; geçici klasöre):

```sh
TAMGA_TL119612=1 TAMGA_TL119612_SIGNER=tl-xml-signer-1 TAMGA_TP_REGISTRY=apps/trust-publisher/registry-sandbox TAMGA_TP_PKI=ops/pki-sandbox \
  TAMGA_TP_DIST=<geçici klasör> npx tsx apps/trust-publisher/src/cli.ts build
cp <geçici klasör>/tl-tr.xml apps/trust-publisher/test/fixtures/tl119612/tl-tr.sandbox-sample.xml
cp ops/pki-sandbox/tl-xml-signer-1.cert.pem apps/trust-publisher/test/fixtures/tl119612/
```

Test (`test/tl119612.test.ts`) örneği ETSI XSD'lerine ve iki bağımsız imza doğrulayıcısına karşı denetler, imzacının §5.7.1
profilini doğrular. İmzacı sertifikasının sabit kopyası `tl-xml-signer-1.cert.pem` örnekle birlikte durur: CI özel anahtarı
olmayan klonda sandbox PKI'sını yeniden ürettiği için test `ops/pki-sandbox/` yerine bu kopyaya bakar. 2026-10-29'da örnek ve canlı sandbox listesi AB'nin DSS doğrulayıcısında da denendi: biçim XAdES-BASELINE-B,
başvurular ve imza sağlam; imzacı AB'de güven çapası olmadığından sonuç INDETERMINATE / NO_CERTIFICATE_CHAIN_FOUND (beklenen).
