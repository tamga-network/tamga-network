---
document_id: ADR-0013
title: "Şəxsiyyət sənədi üçün mdoc"
status: Active
version: 1.0.0
created: 2026-09-26
last_updated: 2026-10-09
summary: >
  Tamga şəxsiyyət attestasiyası ([[ADR-0011]]) bu gün yalnız SD-JWT VC formatındadır. Bu ADR eyni rəqəmsal sənədin eyni sahələrlə əlavə olaraq ISO/IEC 18013-5 mdoc (CBOR + COSE) kimi də verilməsini qərara alır. Əsaslandırma: Safari/iOS-un brauzer Digital Credentials API-si yalnız mdoc qəbul edir və ARF şəxsiyyət (PID) üçün mdoc-u məcburi sayır; yaxın məsafədən təqdimat (ISO 18013-5, Faza 1 Bluetooth) mdoc daşıyır. SD-JWT VC əsas format olaraq qalır; mdoc paralel, opt-in, eyni `cnf`/holder açarına bağlı ikinci təmsil formasıdır. İcra: `@tamga-network/mdoc` (saf @noble, RN ilə uyğun). **Qəbul: 2026-09-26 → D-CRED-5.**
domain: Identity
translation_of: ADR-0013
source_version: "1.0.0"
---

# Kontekst

[[ADR-0006]] [[t:credential]] formatı kimi [[t:SD-JWT-VC]] seçimini etdi; bütün rəqəmsal sənədlərimiz (tələbə, diplom, şəxsiyyət, bilet) bu formatdadır.
[[ADR-0011]] Tamga müvəqqəti şəxsiyyət [[t:attestation]] (`urn:tamga:id:IdentityAttestation:1`) tipini müəyyən etdi — yenə SD-JWT VC.
[[SPEC-CRED-0001]] §1 [[t:mdoc]] formatını əvvəldən **ikinci dərəcəli format ("2-ci faza")** kimi planlaşdırmışdı; bu ADR onu şəxsiyyət sənədi üçün önə çəkir
(bağlanmış qərarı dəyişmir, planlaşdırılanı aktivləşdirir).

İki xarici reallıq bizi ikinci formata yönəldir:

1. **Brauzer Digital Credentials API-si.** Chrome 141 OpenID4VP + həm SD-JWT VC, həm də mdoc qəbul edir; **Safari 26 / iOS 26
   yalnız mdoc** qəbul edir. "Tamga ilə daxil ol" (D11) brauzer
   API-sinə keçdikdə iPhone Safari istifadəçiləri üçün mdoc mütləqdir.
2. **eIDAS 2.0 / ARF.** [[t:ARF]] fərdi şəxsiyyət məlumatları ([[t:PID]]) üçün mdoc-u (ISO 18013-5) məcburi, SD-JWT VC-ni isə opsional sayır.
   Yaxın məsafədən təqdimat (turniket, qapı — [[ADR-0012]] Faza 1 Bluetooth) da ISO 18013-5 mdoc daşıyır. Tamga PID vermir, lakin şəxsiyyət
   attestasiyası PID-in müvəqqəti ekvivalentidir; Aİ presedenti ilə uyğunlaşmaq üçün mdoc lazımdır.

Layihə rəhbərliyinin istiqaməti (2026-09-26): turniket və bilet axınları EUDI ilə eyni olsun; mdoc formatı qurulur. mdoc formatın özüdür
(CBOR + COSE); Bluetooth nəqli ayrıdır və Apple Developer hesabı + native modul tələb edir (Faza 1). Bu ADR yalnız **formatı**
əhatə edir; nəqli [[ADR-0012]] Faza 1-dədir.

# Qərar

1. **Şəxsiyyət attestasiyası ikili formatda verilir:** SD-JWT VC (əsas, dəyişməz) + ISO 18013-5 mdoc (paralel, opt-in).
   Eyni sahələr, eyni `iat/exp`, **eyni [[t:holder]] açarı** (SD-JWT `cnf.jwk` = mdoc `deviceKey`), ayrı [[t:issuer]] imzaları
   (SD-JWT: JOSE/ES256; mdoc: COSE_Sign1/ES256). Hər iki rəqəmsal sənəd vahid vermə axınında yaradılır; rəqəmsal cüzdan hər ikisini saxlayır.
2. **docType** = `urn:tamga:id:IdentityAttestation:1` (vct ilə eyni URN); **namespace** = `tamga.id.1`. Sahə adları SD-JWT
   claim adları ilə tam eynidir (`given_name`, `family_name`, `document_number_hash`, `age_over_18`, …). *Dəyişdi (2026-10-09,
   [[ADR-0045]]):* iki format eyni məlumatı daşıyır; ad və kodlaşdırma hər formatda Aİ PID cədvəlinə əsaslanır (İcra Reqlamenti (Aİ)
   2026/1731) — SD-JWT `birthdate` / `nationalities` ↔ mdoc `birth_date` (full-date) / `nationality` (massiv); digər adlar eynidir.
3. **Yoxlama formatı [[t:DCQL]] ilə seçilir:** [[t:verifier]] sorğusunda `format: dc+sd-jwt` və ya `mso_mdoc` göstərir; kanal (QR /
   dərin keçid / DC API) eyni qalır. Yoxlayan tərəf mdoc-da: issuerAuth COSE imzasını x5chain→[[t:trust-list]] ([[SPEC-TRUST-0001]])
   ilə, sahə digest-lərini MSO ilə, cihaz imzasını isə SessionTranscript üzərində yoxlayır.
4. **CBOR determinizmi:** RFC 8949 §4.2.1 (bytewise). ISO 18013-5-in RFC 7049 §3.9 (əvvəlcə uzunluq) istinadını pilot tam-interop
   bəndi kimi qeyd edirik; bütün ekosistem vahid kitabxanadan (`@tamga-network/mdoc`) istifadə etdiyi üçün digest uyğunluğu təmin olunur.
5. **SessionTranscript:** [[t:OpenID4VP]] 1.0 Final Əlavə B.2.6-dakı handover-lər: yönləndirməli axında `OpenID4VPHandover`
   (B.2.6.1 — client_id, [[t:nonce]], cavabın şifrələndiyi açarın JWK barmaq izi, response_uri), brauzer Digital Credentials
   API-sində `OpenID4VPDCAPIHandover` (B.2.6.2 — origin, nonce, JWK barmaq izi). Yaxın məsafədə (Bluetooth) ISO 18013-5 sessiyasının
   SessionTranscript-i istifadə olunur. *İcra qeydi (2026-10-09):* ilkin mətn demo üçün deterministik xülasə, pilot üçün isə ISO 18013-7
   Əlavə B nəzərdə tuturdu; icra birbaşa OpenID4VP 1.0 Final formatına keçdi, bu məsələdə kənarlaşma qalmadı.
6. **Əhatə dairəsi:** yalnız şəxsiyyət attestasiyası. Tələbə/diplom/bilet SD-JWT VC olaraq qalır (mdoc-a ehtiyac yoxdur; brauzer girişi və PID
   presedenti yalnız şəxsiyyət üçün keçərlidir). Ehtiyac yaranarsa, eyni mexanizm genişləndirilir.

# Əsaslandırma / alternativlər

- **Yalnız SD-JWT VC (hazırkı vəziyyət):** Safari brauzer girişi mümkün deyil, ARF PID presedenti ilə uyğun deyil. Rədd edildi.
- **mdoc-a tam keçid (SD-JWT VC-dən imtina):** mövcud sənədi verən qurum / yoxlayan tərəf / rəqəmsal cüzdan xəttini və OpenID4VP profilimizi ([[SPEC-PROTO-0002]])
   pozur; SD-JWT VC veb/məsafədən istifadə üçün daha sadədir. Rədd edildi.
- **İkili format (seçilən):** Aİ-nin şəxsiyyət üçün etdiyi də budur. Qiyməti: ikinci vermə + yoxlama kodu və testləri; qazancı:
   Safari DC API + ARF uyğunluğu + Faza 1 Bluetooth hazırlığı. `@tamga-network/mdoc` müstəqildir, saf @noble; əlavə icra mühiti asılılığı yoxdur.

# Dəyişməzlər

| # | İnvariant |
|---|---|
| **MD1** | mdoc yalnız SD-JWT VC-nin ikinci təmsil formasıdır; SD-JWT VC əsas olaraq qalır (ADR-0006 dəyişmir). Bir tipin mdoc-u varsa, onun sahələri (məlumat; ad və kodlaşdırma formata görə Aİ PID cədvəlindən — [[ADR-0045]]), `iat/exp` və sənəd sahibinin açarı SD-JWT ilə tam eynidir. |
| **MD2** | mdoc `deviceKey` = SD-JWT `cnf.jwk` (eyni sənəd sahibi açarı, eyni cihaz bağlaması). Ayrı açar yaradılmır. |
| **MD3** | mdoc issuerAuth (COSE_Sign1) yalnız ES256; sənədi verən qurumun sertifikatı x5chain-də daşınır və [[SPEC-TRUST-0001]] etibar siyahısı ilə (issuer_id) uyğunlaşdırılır — SD-JWT ilə eyni etibar lövbəri. |
| **MD4** | Yoxlama üç qiymətli nəticəni ([[SPEC-API-0001]]) qoruyur; digest uyğunsuzluğu/müddət/ləğv REJECTED, infrastrukturun əlçatmazlığı INDETERMINATE. Nəticə obyektində xam CBOR və açıqlanmayan sahə olmur. |
| **MD5** | mdoc fərdi məlumatların dəyərini yalnız IssuerSignedItem daxilində daşıyır; MSO, lövbər jurnalı və loglar yalnız digest/açar/tarix ehtiva edir (DP1/AP3 qorunur). |

# Nəticələr

- **Yeni paket** `@tamga-network/mdoc` (CBOR + COSE_Sign1 + MSO vermə/açıqlama/yoxlama + cihaz [[t:identity-proofing|autentifikasiyası]]; 15 test).
- **İcra (D12 faza 2):** `apps/id` ikinci formatın verilməsi; `@tamga-network/wallet-core` mdoc saxlama + təqdimat;
  `@tamga-network/verifier` + `apps/verify` mdoc yoxlama yolu; DCQL `mso_mdoc`; [[SPEC-CRED-0001]] / [[SPEC-PROTO-0002]] versiya
  yeniləməsi; FW-ARF sətri. Səhnə 15 (şəxsiyyət → mdoc → [[t:selective-disclosure]] → yoxlama).
- **DECISIONS:** D-CRED-5 + INVARIANTS MD1–MD5.

# Status

**Accepted — 2026-09-26.** DECISIONS: D-CRED-5.
Layihə 2026-09-26 (Proposed, paket + 15 test); həmin gün qəbul və D12 faza 2 icrası. ADR-0006-nı dəyişmir, genişləndirir.

2026-10-09: K2 və MD1-dəki ad qaydası [[ADR-0045]] ilə dəyişdi (Aİ PID kodlaşdırması, D-ID-11).
