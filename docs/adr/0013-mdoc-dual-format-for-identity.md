---
document_id: ADR-0013
title: Kimlik Attestation'ı için mdoc Çift Formatı (SD-JWT VC + ISO 18013-5)
category: ADR
domain: Credential
status: Active
review_status: Completed
version: 1.0.1
created: 2026-09-26
last_updated: 2026-09-30
authors:
  - Tamga Network Engineering
language: tr
document_type: adr
audience:
  - engineers
  - architects
  - operators
  - ai-agents
tags:
  - adr
  - credential
  - mdoc
  - iso-18013-5
  - iso-18013-7
  - cbor
  - cose
  - digital-credentials-api
  - dual-format
keywords:
  - mdoc mobile document ISO 18013-5
  - CBOR COSE_Sign1 MobileSecurityObject
  - dual format SD-JWT VC and mdoc
  - Safari Digital Credentials API mdoc-only
  - device key binding SessionTranscript 18013-7
  - selective disclosure IssuerSignedItem digests
summary: >
  Tamga kimlik attestation'ı ([[ADR-0011]]) bugün yalnızca SD-JWT VC. Bu ADR, aynı belgenin aynı alanlarla ayrıca
  ISO/IEC 18013-5 mdoc (CBOR + COSE) olarak da ihraç edilmesini karara bağlar. Gerekçe: Safari/iOS'un tarayıcı Digital
  Credentials API'si yalnızca mdoc kabul eder ve ARF kimlik (PID) için mdoc'u zorunlu tutar; yakın alan (ISO 18013-5,
  Faz 1 Bluetooth) mdoc taşır. SD-JWT VC birincil format olarak kalır; mdoc paralel, opt-in, aynı `cnf`/holder anahtarına
  bağlı ikinci temsildir. Uygulama `@tamga-network/mdoc` (saf @noble, RN uyumlu). **Kabul: 2026-09-26 → D-CRED-5.**
priority: High
---
> **Sürüm notu 1.0.1 (2026-09-30) — ürün adı:** TamgaID → Tamga Wallet / “Tamga ile giriş yap” (proje yönetimi kararı; anlam değişmedi).

# Bağlam

[[ADR-0006]] credential formatı olarak SD-JWT VC'yi seçti; tüm belgelerimiz (öğrenci, diploma, kimlik, bilet) bu formatta.
[[ADR-0011]] Tamga geçici kimlik attestation'ını (`urn:tamga:id:IdentityAttestation:1`) tanımladı — yine SD-JWT VC.
[[SPEC-CRED-0001]] §1 mdoc'u baştan **ikincil format ("2. faz")** olarak planlamıştı; bu ADR onu kimlik belgesi için öne çeker
(kapatılmış bir kararı değiştirmez, planlı olanı etkinleştirir).

İki dış gerçek bizi ikinci bir formata itiyor:

1. **Tarayıcı Digital Credentials API'si.** Chrome 141 OpenID4VP + hem SD-JWT VC hem mdoc kabul eder; **Safari 26 / iOS 26
   yalnızca mdoc** kabul eder (`2026-09-25-konusma-web-giris-tarayici-api-passkey.md` §2). "Tamga ile giriş yap" (D11) tarayıcı
   API'sine geçtiğinde iPhone Safari kullanıcıları için mdoc şart.
2. **eIDAS 2.0 / ARF.** ARF, kişisel kimlik verisi (PID) için mdoc'u (ISO 18013-5) zorunlu, SD-JWT VC'yi opsiyonel tutar.
   Yakın alan sunumu (turnike, kapı — [[ADR-0012]] Faz 1 Bluetooth) da ISO 18013-5 mdoc taşır. Tamga PID vermez ama kimlik
   attestation'ı PID'in geçici muadilidir; AB emsaliyle hizalanmak için mdoc gerekir.

Proje yönetiminin yönü (2026-09-26): turnike ve bilet akışları EUDI ile aynı olsun; mdoc biçimi kurulur. mdoc formatın kendisidir
(CBOR + COSE); Bluetooth taşıması ayrıdır ve Apple Developer hesabı + native modül ister (Faz 1). Bu ADR yalnızca **formatı**
kapsar; taşıma [[ADR-0012]] Faz 1'de.

# Karar

1. **Kimlik attestation'ı çift formatta ihraç edilir:** SD-JWT VC (birincil, değişmez) + ISO 18013-5 mdoc (paralel, opt-in).
   Aynı alanlar, aynı `iat/exp`, **aynı holder anahtarı** (SD-JWT `cnf.jwk` = mdoc `deviceKey`), ayrı issuer imzaları
   (SD-JWT: JOSE/ES256; mdoc: COSE_Sign1/ES256). İki belge tek ihraç akışında üretilir; cüzdan ikisini de saklar.
2. **docType** = `urn:tamga:id:IdentityAttestation:1` (vct ile aynı URN); **namespace** = `tamga.id.1`. Alan adları SD-JWT
   claim adlarıyla birebir (`given_name`, `family_name`, `document_number_hash`, `age_over_18`, …).
3. **Doğrulama formatı DCQL ile seçilir:** doğrulayıcı isteğinde `format: dc+sd-jwt` ya da `mso_mdoc` belirtir; kanal (QR /
   derin bağlantı / DC API) aynı kalır. Doğrulayıcı mdoc'ta: issuerAuth COSE imzasını x5chain→güven listesi ([[SPEC-TRUST-0001]])
   ile, alan digest'lerini MSO ile, cihaz imzasını SessionTranscript üzerinde doğrular.
4. **CBOR determinizmi:** RFC 8949 §4.2.1 (bytewise). ISO 18013-5 RFC 7049 §3.9 (uzunluk-önce) atıfını pilot tam-interop
   maddesi olarak işaretleriz; tüm ekosistem tek kütüphane (`@tamga-network/mdoc`) kullandığından digest tutarlılığı sağlanır.
5. **SessionTranscript:** demo'da OpenID4VP nonce+client_id+response_uri'den deterministik özet; **pilotta ISO 18013-7
   Annex B (OID4VPHandover)**. Sapma olarak işaretlenir.
6. **Kapsam:** yalnızca kimlik attestation'ı. Öğrenci/diploma/bilet SD-JWT VC kalır (mdoc'a gerek yok; tarayıcı girişi ve PID
   emsali yalnızca kimlik için geçerli). İhtiyaç doğarsa aynı mekanizma genişletilir.

# Gerekçe / alternatifler

- **Yalnızca SD-JWT VC (bugünkü hâl):** Safari tarayıcı girişi imkânsız, ARF PID emsaliyle hizasız. Reddedildi.
- **mdoc'a tam geçiş (SD-JWT VC'yi bırak):** mevcut issuer/verifier/cüzdan hattını ve OpenID4VP prof-ilimizi ([[SPEC-PROTO-0002]])
   kırar; SD-JWT VC web/uzaktan için daha yalın. Reddedildi.
- **Çift format (seçilen):** AB'nin kimlik için yaptığı da bu. Bedeli: ikinci ihraç + doğrulama kodu ve testleri; kazancı:
   Safari DC API + ARF hizası + Faz 1 Bluetooth hazırlığı. `@tamga-network/mdoc` bağımsız, saf @noble; ek çalışma zamanı bağımlılığı yok.

# Değişmezler

| # | Değişmez |
|---|---|
| **MD1** | mdoc yalnızca SD-JWT VC'nin ikinci temsilidir; SD-JWT VC birincil kalır (ADR-0006 değişmez). Bir tipin mdoc'u varsa alanları, `iat/exp` ve holder anahtarı SD-JWT ile birebir aynıdır. |
| **MD2** | mdoc `deviceKey` = SD-JWT `cnf.jwk` (aynı holder anahtarı, aynı cihaz bağlaması). Ayrı anahtar üretilmez. |
| **MD3** | mdoc issuerAuth (COSE_Sign1) yalnızca ES256; issuer sertifikası x5chain'de taşınır ve [[SPEC-TRUST-0001]] güven listesiyle (issuer_id) eşlenir — SD-JWT ile aynı güven çapası. |
| **MD4** | Doğrulama üç değerli sonucu ([[SPEC-API-0001]]) korur; digest uyuşmazlığı/süre/iptal REJECTED, altyapı erişilemezliği INDETERMINATE. Sonuç nesnesinde ham CBOR ve açıklanmayan alan bulunmaz. |
| **MD5** | mdoc kişisel veri değerini yalnızca IssuerSignedItem içinde taşır; MSO, çapa günlüğü ve loglar yalnızca digest/anahtar/tarih içerir (DP1/AP3 korunur). |

# Sonuçlar

- **Yeni paket** `@tamga-network/mdoc` (CBOR + COSE_Sign1 + MSO ihraç/açıklama/doğrulama + cihaz kimlik doğrulaması; 15 test).
- **Uygulama (D12 faz 2):** `apps/id` ikinci format ihracı; `@tamga-network/wallet-core` mdoc saklama + sunum;
  `@tamga-network/verifier` + `apps/verify` mdoc doğrulama yolu; DCQL `mso_mdoc`; [[SPEC-CRED-0001]] / [[SPEC-PROTO-0002]] sürüm
  güncellemesi; FW-ARF satırı. Sahne 15 (kimlik → mdoc → seçici açıklama → doğrulama).
- **DECISIONS:** D-CRED-5 + INVARIANTS MD1–MD5.

# Durum

**Accepted — 2026-09-26.** DECISIONS: D-CRED-5.
Taslak 2026-09-26 (Proposed, paket + 15 test); aynı gün kabul ve D12 faz 2 uygulaması. ADR-0006'yı değiştirmez, genişletir.
