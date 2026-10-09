---
document_id: ADR-0013
title: "Kimlik belgesi için mdoc"
status: Active
version: 1.0.0
created: 2026-09-26
last_updated: 2026-10-09
summary: >
  Tamga kimlik attestation'ı ([[ADR-0011]]) bugün yalnızca SD-JWT VC. Bu ADR, aynı belgenin aynı alanlarla ayrıca
  ISO/IEC 18013-5 mdoc (CBOR + COSE) olarak da ihraç edilmesini karara bağlar. Gerekçe: Safari/iOS'un tarayıcı Digital
  Credentials API'si yalnızca mdoc kabul eder ve ARF kimlik (PID) için mdoc'u zorunlu tutar; yakın alan (ISO 18013-5,
  Faz 1 Bluetooth) mdoc taşır. SD-JWT VC birincil format olarak kalır; mdoc paralel, opt-in, aynı `cnf`/holder anahtarına
  bağlı ikinci temsildir. Uygulama `@tamga-network/mdoc` (saf @noble, RN uyumlu). **Kabul: 2026-09-26 → D-CRED-5.**
domain: Identity
---

# Bağlam

[[ADR-0006]] [[t:credential]] formatı olarak [[t:SD-JWT-VC]]'yi seçti; tüm belgelerimiz (öğrenci, diploma, kimlik, bilet) bu formatta.
[[ADR-0011]] Tamga geçici kimlik [[t:attestation]]'ını (`urn:tamga:id:IdentityAttestation:1`) tanımladı — yine SD-JWT VC.
[[SPEC-CRED-0001]] §1 [[t:mdoc]]'u baştan **ikincil format ("2. faz")** olarak planlamıştı; bu ADR onu kimlik belgesi için öne çeker
(kapatılmış bir kararı değiştirmez, planlı olanı etkinleştirir).

İki dış gerçek bizi ikinci bir formata itiyor:

1. **Tarayıcı Digital Credentials API'si.** Chrome 141 OpenID4VP + hem SD-JWT VC hem mdoc kabul eder; **Safari 26 / iOS 26
   yalnızca mdoc** kabul eder. "Tamga ile giriş yap" (D11) tarayıcı
   API'sine geçtiğinde iPhone Safari kullanıcıları için mdoc şart.
2. **eIDAS 2.0 / ARF.** [[t:ARF]], kişisel kimlik verisi ([[t:PID]]) için mdoc'u (ISO 18013-5) zorunlu, SD-JWT VC'yi opsiyonel tutar.
   Yakın alan sunumu (turnike, kapı — [[ADR-0012]] Faz 1 Bluetooth) da ISO 18013-5 mdoc taşır. Tamga PID vermez ama kimlik
   attestation'ı PID'in geçici muadilidir; AB emsaliyle hizalanmak için mdoc gerekir.

Proje yönetiminin yönü (2026-09-26): turnike ve bilet akışları EUDI ile aynı olsun; mdoc biçimi kurulur. mdoc formatın kendisidir
(CBOR + COSE); Bluetooth taşıması ayrıdır ve Apple Developer hesabı + native modül ister (Faz 1). Bu ADR yalnızca **formatı**
kapsar; taşıma [[ADR-0012]] Faz 1'de.

# Karar

1. **Kimlik attestation'ı çift formatta ihraç edilir:** SD-JWT VC (birincil, değişmez) + ISO 18013-5 mdoc (paralel, opt-in).
   Aynı alanlar, aynı `iat/exp`, **aynı [[t:holder]] anahtarı** (SD-JWT `cnf.jwk` = mdoc `deviceKey`), ayrı [[t:issuer]] imzaları
   (SD-JWT: JOSE/ES256; mdoc: COSE_Sign1/ES256). İki belge tek ihraç akışında üretilir; cüzdan ikisini de saklar.
2. **docType** = `urn:tamga:id:IdentityAttestation:1` (vct ile aynı URN); **namespace** = `tamga.id.1`. Alan adları SD-JWT
   claim adlarıyla birebir (`given_name`, `family_name`, `document_number_hash`, `age_over_18`, …). *Değişti (2026-10-09,
   [[ADR-0045]]):* iki biçim aynı veriyi taşır; ad ve kodlama her biçimde AB PID tablosuna göredir (Uygulama Tüzüğü (AB)
   2026/1731) — SD-JWT `birthdate` / `nationalities` ↔ mdoc `birth_date` (full-date) / `nationality` (dizi); öteki adlar aynı.
3. **Doğrulama formatı [[t:DCQL]] ile seçilir:** [[t:verifier]] isteğinde `format: dc+sd-jwt` ya da `mso_mdoc` belirtir; kanal (QR /
   derin bağlantı / DC API) aynı kalır. Doğrulayıcı mdoc'ta: issuerAuth COSE imzasını x5chain→[[t:trust-list]] ([[SPEC-TRUST-0001]])
   ile, alan digest'lerini MSO ile, cihaz imzasını SessionTranscript üzerinde doğrular.
4. **CBOR determinizmi:** RFC 8949 §4.2.1 (bytewise). ISO 18013-5 RFC 7049 §3.9 (uzunluk-önce) atıfını pilot tam-interop
   maddesi olarak işaretleriz; tüm ekosistem tek kütüphane (`@tamga-network/mdoc`) kullandığından digest tutarlılığı sağlanır.
5. **SessionTranscript:** [[t:OpenID4VP]] 1.0 Final Ek B.2.6'daki handover'lar: yönlendirmeli akışta `OpenID4VPHandover`
   (B.2.6.1 — client_id, [[t:nonce]], yanıtın şifrelendiği anahtarın JWK parmak izi, response_uri), tarayıcı Digital Credentials
   API'sinde `OpenID4VPDCAPIHandover` (B.2.6.2 — origin, nonce, JWK parmak izi). Yakın alanda (Bluetooth) ISO 18013-5 oturum
   SessionTranscript'i kullanılır. *Uygulama notu (2026-10-09):* ilk metin demo için deterministik bir özet, pilot için ISO 18013-7
   Ek B öngörüyordu; uygulama doğrudan OpenID4VP 1.0 Final biçimine geçti, bu konuda sapma kalmadı.
6. **Kapsam:** yalnızca kimlik attestation'ı. Öğrenci/diploma/bilet SD-JWT VC kalır (mdoc'a gerek yok; tarayıcı girişi ve PID
   emsali yalnızca kimlik için geçerli). İhtiyaç doğarsa aynı mekanizma genişletilir.

# Gerekçe / alternatifler

- **Yalnızca SD-JWT VC (bugünkü hâl):** Safari tarayıcı girişi imkânsız, ARF PID emsaliyle hizasız. Reddedildi.
- **mdoc'a tam geçiş (SD-JWT VC'yi bırak):** mevcut belge veren / doğrulayıcı / cüzdan hattını ve OpenID4VP prof-ilimizi ([[SPEC-PROTO-0002]])
   kırar; SD-JWT VC web/uzaktan için daha yalın. Reddedildi.
- **Çift format (seçilen):** AB'nin kimlik için yaptığı da bu. Bedeli: ikinci ihraç + doğrulama kodu ve testleri; kazancı:
   Safari DC API + ARF hizası + Faz 1 Bluetooth hazırlığı. `@tamga-network/mdoc` bağımsız, saf @noble; ek çalışma zamanı bağımlılığı yok.

# Değişmezler

| # | Değişmez |
|---|---|
| **MD1** | mdoc yalnızca SD-JWT VC'nin ikinci temsilidir; SD-JWT VC birincil kalır (ADR-0006 değişmez). Bir tipin mdoc'u varsa alanları (veri; ad ve kodlama biçime göre AB PID tablosundan — [[ADR-0045]]), `iat/exp` ve belge sahibi anahtarı SD-JWT ile birebir aynıdır. |
| **MD2** | mdoc `deviceKey` = SD-JWT `cnf.jwk` (aynı belge sahibi anahtarı, aynı cihaz bağlaması). Ayrı anahtar üretilmez. |
| **MD3** | mdoc issuerAuth (COSE_Sign1) yalnızca ES256; belge veren sertifikası x5chain'de taşınır ve [[SPEC-TRUST-0001]] güven listesiyle (issuer_id) eşlenir — SD-JWT ile aynı güven çapası. |
| **MD4** | Doğrulama üç değerli sonucu ([[SPEC-API-0001]]) korur; digest uyuşmazlığı/süre/iptal REJECTED, altyapı erişilemezliği INDETERMINATE. Sonuç nesnesinde ham CBOR ve açıklanmayan alan bulunmaz. |
| **MD5** | mdoc kişisel veri değerini yalnızca IssuerSignedItem içinde taşır; MSO, çapa günlüğü ve loglar yalnızca digest/anahtar/tarih içerir (DP1/AP3 korunur). |

# Sonuçlar

- **Yeni paket** `@tamga-network/mdoc` (CBOR + COSE_Sign1 + MSO ihraç/açıklama/doğrulama + cihaz [[t:identity-proofing|kimlik doğrulaması]]; 15 test).
- **Uygulama (D12 faz 2):** `apps/id` ikinci format ihracı; `@tamga-network/wallet-core` mdoc saklama + sunum;
  `@tamga-network/verifier` + `apps/verify` mdoc doğrulama yolu; DCQL `mso_mdoc`; [[SPEC-CRED-0001]] / [[SPEC-PROTO-0002]] sürüm
  güncellemesi; FW-ARF satırı. Sahne 15 (kimlik → mdoc → [[t:selective-disclosure]] → doğrulama).
- **DECISIONS:** D-CRED-5 + INVARIANTS MD1–MD5.

# Durum

**Accepted — 2026-09-26.** DECISIONS: D-CRED-5.
Taslak 2026-09-26 (Proposed, paket + 15 test); aynı gün kabul ve D12 faz 2 uygulaması. ADR-0006'yı değiştirmez, genişletir.

2026-10-09: K2 ve MD1'deki ad kuralı [[ADR-0045]] ile değişti (AB PID kodlaması, D-ID-11).
