---
document_id: ADR-0025
title: "Rəqəmsal cüzdan və açar sübutu"
status: Active
version: 1.0.0
created: 2026-09-29
last_updated: 2026-10-14
summary: >
  Tək, 30 günlük WUA əvəzinə Aİ TS3 modeli: ömrü 24 saatdan qısa olan, hər rəqəmsal sənəd əməliyyatında yeni açarlı və yeni ləğv siyahısı qeydli Wallet Instance Attestation (WIA) + rəqəmsal sənəd açarlarının anbarını təsvir edən key attestation (KA, `key_attestation`). Cüzdan provayderi wallet unit-i qeydiyyata alır, WIA ilə vahid arasındakı uyğunluğu saxlayır, ləğv siyahılarını dərc edir və istifadəçinin istəyi ilə vahidi ləğv edir. Sənədi verən qurumlar WIA və KA-nı, həmçinin onların ləğv statusunu yoxlayır. D-CRED-6-nın formatını dəyişir.
domain: Wallet
translation_of: ADR-0025
source_version: "1.0.0"
---

# Kontekst

Tamga cüzdanı bu gün [[t:wallet-provider|cüzdan provayderindən]] (`wallet.tamga.network`) **30 gün etibarlı olan tək bir [[t:WUA]]** alır. Rəqəmsal sənəd
alarkən hər quruma eyni WUA-nı göstərir (D-CRED-6, SPEC-PROTO-0001 §11.1). Aİ boşluq təhlilində (H1) bu, ən böyük çatışmazlıq
qruplarından biri kimi üzə çıxdı:
- mövzu 9: 22 bənd,
- mövzu 38: 15 bənd,
- VCR_01a/03a/07,
- WIAM_06/10.

Aİ TS3 (v1.5.2) və [[t:ARF]] 3.0-a görə çatışmazlıqlar:

1. **Ömür və əlaqələndirilməzlik.** [[t:WIA]]-nin ömrü 24 saatdan qısa olmalıdır. Eyni WIA birdən çox quruma göstərilməməlidir; əks halda
   qurumlar eyni cüzdanı bir-biri ilə əlaqələndirə bilər.
2. **Key attestation yoxdur.** [[t:credential]] açarlarının hansı anbarda saxlandığını cüzdan provayderi imzalı bir
   `key_attestation` ilə bildirməlidir ([[t:OpenID4VCI]] Əlavə D). Bu gün qurum bunu WUA-dakı bir bəyandan oxuyur.
3. **Ləğv yoxdur.** Cüzdan provayderi WIA və KA üçün [[t:status-list]] dərc etməli, istifadəçinin istəyi ilə [[t:wallet-unit|wallet unit-i]]
   ləğv edə bilməlidir (VCR_07, WURevocation_10). Bunun üçün hansı WIA-nın hansı vahidə aid olduğunu bilməlidir.

Layihə rəhbərliyi H1 planını (P3: bu iş) təsdiqlədi və növbəti işlərə keçilməsini istədi.

# Qərar

## K1 — Wallet unit qeydiyyatı

Cüzdan ilk quraşdırma zamanı cüzdan provayderində bir **vahid açarı** qeydiyyata alır. Bu açar yalnız cüzdanla provayder arasında
istifadə olunur, heç bir quruma göstərilmir. Provayder vahid qeydini saxlayır:
- vahid açarının barmaq izi,
- həll və versiya,
- qeydiyyat vaxtı,
- ləğv statusu,
- vahidə verilmiş WIA ləğv siyahısı qeydləri.

Fərdi məlumatlar saxlanılmır. Vahidlə bağlı sorğular vahid açarı ilə imzalanır.

## K2 — WIA (Wallet Instance Attestation)

- Format: OpenID4VCI 1.0 Əlavə E (`oauth-client-attestation+jwt`), TS3 §2.3.1 sahələri: `sub`, `wallet_name`, `wallet_version`,
  `wallet_link`, `wallet_solution_certification_information`, `client_status {status, exp}`, `cnf.jwk`.
- **Ömür < 24 saat** (Tamga: 23 saat). `client_status.exp` ən azı 31 gün sonra (Tamga: 60 gün).
- **Hər rəqəmsal sənəd əməliyyatında yeni WIA:** yeni PoP (proof of possession) açarı və yeni, əlaqələndirilə bilməyən ləğv siyahısı
  qeydi. Qurum üzrə təkrar istifadə variantından istifadə edilmir; beləliklə provayder cüzdanın neçə qurumla əlaqə saxladığını öyrənmir.
- Provayder ləğv siyahısı qeydi ilə vahid arasındakı uyğunluğu saxlayır; vahid ləğv edildikdə onun bütün qeydləri ləğv olunur.

## K3 — KA (key attestation)

- Format: OpenID4VCI 1.0 Əlavə D (`typ` `key-attestation+jwt`, Final Əlavə D.1; 2026-10-09 düzəliş: əvvəlki mətn layihədəki `keyattestation+jwt` adını çəkirdi), TS3 §2.3.2 sahələri:
  - `attested_keys` (bir paketdəki bütün rəqəmsal sənəd açarları),
  - `key_storage` / `user_authentication` (ISO 18045 səviyyələri),
  - `certification`,
  - `key_storage_status {status, exp}`.
- **Dürüst səviyyə:** bu gün açarlar proqram anbarındadır (S-9). KA `key_storage: ["iso_18045_basic"]` bildirir və sertifikat yoxdur.
  Təhlükəsiz aparat təminatına keçiddə (Z1) səviyyə yüksəlir.
- Ləğv: **növ üzrə ümumi qeyd** (TS3 Variant 1). Proqram anbarı, Secure Enclave və StrongBox-un hər birinin bir qeydi var.
  Vahidin identifikatoru KA-dan çıxarıla bilməz.
- Ötürmə: `jwt` proof-unun başlığında `key_attestation`. Proof `attested_keys[0]` ilə imzalanır; paket tək proof ilə sorğulanır. Hər
  açar yalnız bir KA-da yer alır. KA bir dəfə istifadə olunur.

## K4 — Ləğv siyahıları və istifadəçinin istəyi ilə ləğv

- Provayder iki Token Status List dərc edir (WIA qeydləri və KA növləri). Siyahıları öz açarı ilə imzalayır; bu açar
  [[t:trust-list|etibar siyahısında]] qeydiyyatdadır. WIA siyahısında ən azı 10.000 qeyd olur.
- İstifadəçi cüzdanda "Bu cüzdanı ləğv et" seçimini edə bilər (cihazın ötürülməsi, satış). Vahid və bütün WIA qeydləri ləğv olunur.
- İtirilmiş və ya oğurlanmış cihazdan ləğv istifadəçi hesabı tələb edir (WIAM_06); növbəti mərhələyə saxlanılır. **2026-10-12: [[ADR-0047]] K3
  ilə dəyişdi** — hesab yoxdur; cüzdan provayderi telefonsuz ləğv yolu təqdim edir (quraşdırma zamanı verilən ləğv sirri).

## K5 — Sənədi verən qurumlar

- [[t:PAR]] və token son nöqtələrində WIA yoxlanılır: imza, provayder açarının etibar siyahısında olması, müddət, PoP (`cnf`), `client_status`-in
  ləğv edilməməsi.
- Rəqəmsal sənəd son nöqtəsində, proof başlığında KA varsa, aşağıdakılar yoxlanılır:
  - imza və provayder açarı,
  - proof-un `attested_keys[0]` ilə imzası və [[t:nonce]],
  - `key_storage_status` ləğv edilməyib,
  - `key_storage` səviyyəsi qurumun minimum həddinə cavab verir.

  Rəqəmsal sənədlər `attested_keys`-ə bağlanır.
- Metadata: `proof_types_supported.jwt.key_attestations_required {key_storage, user_authentication}` (ISSU_27d).
- Keçid: KA-sız proof formatı pilotdan əvvələdək qəbul edilir, sonra ləğv olunur.
- Qurumun WUA sahələrindən oxuduğu `key_storage` artıq KA-dan oxunur.

## K6 — Yeniləmə tokeninin bağlılığı

[[ADR-0023]] yeniləmə tokeni bu gün WUA `sub`-una da bağlıdır. Hər əməliyyatda yeni WIA açarı istifadə olunduğu üçün bu bağlılıq rəqəmsal sənədə
xas **[[t:DPoP]] açarı + etibarlı, ləğv edilməmiş WIA** şərtinə çevrilir. AR2-nin "hər yeniləmədə cüzdan təsdiqi yoxlanılır"
qaydası olduğu kimi qüvvədə qalır.

# Nəzərdən keçirilmiş variantlar

| Variant | Nəticə | Səbəb |
|---|---|---|
| Tək 30 günlük WUA | rədd | TS3 ilə uyğun deyil; qurumlar arasında əlaqələndirilə bilər; ləğv yoxdur |
| Qurum üzrə təkrar istifadə olunan WIA qeydi | rədd | Provayder cüzdanın neçə qurumla, hansı tezlikdə əlaqə saxladığını öyrənir |
| Hər KA üçün ayrıca ləğv siyahısı qeydi (Variant 2) | sonra | İstifadəçinin istəyi ilə açar anbarının ləğvi üçün; aparat açarı ilə (Z1) birlikdə |
| **Hər əməliyyatda yeni WIA + növ üzrə KA qeydi** | **qəbul** | Minimum məlumat; TS3-ün icazə verdiyi məxfiliyə ən uyğun variant |

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| WIA1 | WIA-nın ömrü 24 saatdan qısadır; hər rəqəmsal sənəd əməliyyatında yeni PoP açarlı və yeni ləğv siyahısı qeydli WIA istifadə olunur. |
| WIA2 | Cüzdan provayderi vahid qeydində fərdi məlumatlar saxlamır; vahid ləğv edildikdə həmin vahidə verilmiş bütün WIA qeydləri ləğv olunur. |
| WIA3 | KA-dakı açar anbarı səviyyəsi həqiqəti əks etdirir; yoxlanılmamış bəyan KA-ya yazılmır. |
| WIA4 | Sənədi verən qurum ləğv edilmiş WIA və ya KA ilə rəqəmsal sənəd vermir. |

# Nəticələr

- `apps/wallet-provider`:
  - vahid qeydi, `/wia`, `/ka`, `/units/revoke`, `/units/delete`,
  - iki ləğv siyahısı,
  - daimi status faylı.
- `@tamga-network/trust` (`@tamga-network/issuer` yenidən ixrac edir): WIA və KA yoxlanışı, ləğv yoxlanışı. Qurumun sənəd verən xidməti və
  şəxsiyyət xidməti bu formatdan istifadə edir.
- `wallet-core`: vahid açarı, əməliyyat üzrə WIA, KA sorğusu, KA-lı proof. Cüzdan: qeydiyyat, "Bu cüzdanı ləğv et".
- [[SPEC-PROTO-0001]] §11.1 və D-CRED-6 bu qərara əsasən yazılır.
- ARF: mövzu 9, 38 və VCR_01a/03a/07 böyük ölçüdə qarşılanır. WSCD və cihaz sübutu Z1-dədir.

# Tətbiq qeydləri (2026-10-04)

Bu qeydlər qərarı dəyişmir; istinad cüzdanının (Tamga Wallet) və provayderin K1–K3-ü necə tətbiq etdiyini qeydə alır.

1. **Açara giriş siyasəti (WL1/WL11).** Aparat açarları telefonun kilidinə bağlıdır: açar yalnız kilid açıq olduqda
   əlçatandır və istifadəsi cihazın biometriyası, o olmadıqda isə cihaz parolu ilə təsdiqlənir. iOS: Secure Enclave,
   `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`, `.privateKeyUsage` + `.biometryCurrentSet | .or | .devicePasscode`
   (biometriya qeydiyyatda deyilsə, yalnız `.devicePasscode`). Android: StrongBox/TEE, `setUserAuthenticationRequired(true)`,
   `setUserAuthenticationParameters(60 sn, AUTH_BIOMETRIC_STRONG | AUTH_DEVICE_CREDENTIAL)`, `setUnlockedDeviceRequired(true)`,
   `setInvalidatedByBiometricEnrollment(true)` (bu sənəd və [[SPEC-WALLET-0001]] bu bayrağı müəyyən etmədiyi üçün `true` seçildi;
   pəncərəli açarlarda sistem onu tətbiq etmir, kilid götürülərsə açar etibarsız olur). Tətbiqin PIN-i ekran kilidi kimi
   qalır; təqdimat təsdiqi açardan istifadə sorğusudur (tək sorğu; PIN ekranı ilə ikiqat soruşma yoxdur). Kilid qurulmamış telefonda açar
   yaradılmır. Şəxsi təmsil etməyən protokol açarları — vahid açarı (K1), WIA PoP (K2), DPoP və keçid kartı açarı
   (WL13: təsdiq tələb etmir) — yalnız kilid açıq olduqda əlçatandır, lakin istifadəsi sorğu tələb etmir; beləliklə səssiz yeniləmə və kartın
   yenilənməsi şəxsə sorğu göstərmir. Şəxsin başlatmadığı axınlar rəqəmsal sənəd açarını sorğusuz sınayır; təsdiq tələb olunarsa,
   səssizcə ötürür və istifadəçi əməliyyatında yenidən cəhd edir. Miqrasiya kodu yoxdur ([[ADR-0029]]): siyasət dəyişdikdə mövcud test
   cüzdanları yenidən quraşdırılır.
2. **Play Integrity — məcburi deyil.** Android cüzdanı açar sübutu ilə birlikdə Play Integrity (standart API) tokeni
   göndərə bilər; provayder, xidmət hesabı tənzimlənibsə, tokeni Google vasitəsilə deşifrə etdirir və yalnız hökm siniflərini vahidin cihaz qeydinə
   yazır. KA-dakı `key_storage` səviyyəsi Android açar sübutundan gəlir; Play Integrity onu aşağı salmır, onun olmaması qeydiyyata
   mane olmur, xidmət hesabı yoxdursa yoxlama ötürülür. Play Integrity-ni məcburi etmək (qeydiyyatı və ya səviyyəni ona bağlamaq)
   bu qərarın K1/K3-ünü dəyişir və **ayrıca ADR tələb edir**.

# Tətbiq qeydləri (2026-10-13, Aİ-yə uyğunlaşmanın ilk mərhələsi)

Bu qeydlər qərarı dəyişmir; formatı Aİ-nin təsbit etdiyi mətnlərə (İcra Reqlamenti (Aİ) 2024/2979 Əlavə Ib, 2026/1731 ilə; Aİ TS3 1.5.2)
uyğunlaşdırır.

1. **Ümumi müştəri attestasiyası (draft -07).** WIA OpenID4VCI 1.0-ın istinad etdiyi OAuth attestation-based client authentication
   layihəsinin -07 versiyasındakı formatdır. Cüzdan provayderi `iss` və `iat` sahələrini göndərir (-07-də `iss` məcburi idi, -08-də çıxarıldı;
   -12-də `iat` məcburi oldu). Yoxlayan tərəf `iss` sahəsini qəbul edir, lakin məcburi tutmur; attestasiyada `iat` yoxdursa, buna yol verir, **PoP-da
   (`OAuth-Client-Attestation-PoP`) `iat` məcburidir**. Sənədi verən hər qurum `oauth-client-attestation+jwt` attestasiyasını **yalnız bir yolla** WIA
   kimi yoxlayır; köhnə Tamga WUA yolu **çıxarıldı**. Attestasiyada `client_status` (ləğv girişi) varsa, yoxlanılır; yoxdursa, davranış
   sənədi verən qurumun `clientStatus` parametri ilə müəyyən edilir: `optional` (defolt; Aİ-nin ümumi -07 attestasiyası qəbul edilir, ləğv yoxlaması tətbiq edilmir
   deyə işarələnir) və ya `required` (ləğv girişi olmayan attestasiya rədd edilir). Zəncirvari ləğv aparan **şəxsiyyət xidməti `required`
   istifadə edir** ([[ADR-0047]] K1). Tətbiq: paketlərin 0.5.2 versiyası.
2. **WIA `cnf` = rəqəmsal sənədə xas DPoP açarı (TS3 1.5.2).** Rəqəmsal sənəd əməliyyatında WIA-nın `cnf.jwk` sahəsi həmin sənəd üçün token endpoint-də
   istifadə olunan DPoP açarıdır; ayrıca WIA PoP açarı yaradılmır. K6-dakı yeniləmə tokeni bağlantısı eyni açar üzərindən qurulur.
   WIA1 (hər əməliyyatda yeni açar və yeni ləğv girişi) dəyişmir: DPoP açarı da sənədə və əməliyyata xasdır. Tətbiq: 0.6.0.
   **Düzəliş (2026-10-13, tətbiq zamanı):** bu qayda TS3-ün 1.5.1 versiyasında əlavə edildi, **1.5.2-də geri alındı** (TS3 1.5.2
   versiya tarixçəsi: "rolled back the WIA `cnf`/DPoP requirements added in 1.5.1 (Section 2.2.1.1)"). Bugünkü Aİ mətnində və
   İcra Reqlamenti (Aİ) 2026/1731 Əlavə Ib-də WIA `cnf` açarı ilə DPoP açarı arasında bağlılıq tələbi yoxdur (TR-WIA-4.3 yalnız
   PoP-un `cnf` açarı ilə yoxlanılmasını tələb edir). Buna görə qeyd 0.6.0-da **tətbiq edilmədi**; Aİ mətni yenidən tələb etsə, ayrıca
   iş kimi baxılacaq. Mövcud davranış (WIA PoP açarı və DPoP açarı ayrıdır, hər ikisi əməliyyata xasdır) dəyişmir.
3. **Ləğv siyahılarının ölçüsü.** WIA və KA ləğv siyahılarının **hər biri** ən azı 10.000 girişdən ibarətdir (İcra Reqlamenti (Aİ) 2024/2979
   Əlavə Ib; izlənməzlik üçün; KA siyahısı növ üzrə az giriş istifadə etsə də, ölçüsü eyni alt həddə tabedir). Sənədi verən qurum imzası etibarlı olan, lakin
   10.000-dən az girişli siyahıya əsaslanan WIA və ya KA-nı profilə uyğun olmayan siyahı kimi **rədd edir** (müvəqqəti xəta sayılmır).
   Tətbiq: paketlərin 0.5.2 versiyası.

# Status

**Accepted — 2026-09-29.** Layihə rəhbərliyinin təsdiqi ilə (H1 planı, P3). DECISIONS: D-CRED-7.

> **Dəyişiklik (2026-10-06, [[ADR-0042]]):** Cüzdan provayderini rəqəmsal cüzdanı təqdim edən təşkilat idarə edir; şəbəkə cüzdan provayderi idarə etmir,
> onu etibar siyahısında (`wallet_providers[]`) qeyd edir. Kontekst bölməsindəki `wallet.tamga.network` və Nəticələr bölməsindəki `apps/wallet-provider`
> Tamga Wallet-ın cüzdan provayderidir: kodu rəqəmsal cüzdanın repozitorisinə köçürüldü, bu repozitoridəki nüsxə və `wallet.tamga.network`
> 2026-10-06-da şəbəkədən çıxarıldı; provayderi rəqəmsal cüzdanın operatoru `provider.tamgawallet.com` üzərində idarə edir. Qərar (K1–K3, WIA1–WIA4) dəyişmir: WIA və
> KA formatı və onların yoxlanılması (`@tamga-network/trust`) şəbəkənin qaydasıdır və hər cüzdan provayderi üçün eynidir.
>
> **Qeyd (2026-10-13):** ümumi müştəri attestasiyası (-07; `iss` qəbul edilir, lakin məcburi deyil, attestasiyada `iat` yoxdursa, buna yol verilir, PoP-da
> məcburidir), köhnə WUA yolunun çıxarılması və `clientStatus` parametri (`optional` / `required`; şəxsiyyət xidməti `required`), WIA `cnf` =
> rəqəmsal sənədə xas DPoP açarı (TS3 1.5.2-də geri alındı — tətbiq edilmədi, yuxarıdakı düzəlişə baxın), WIA/KA siyahıları ≥ 10.000 — yuxarıdakı "Tətbiq qeydləri (2026-10-13)" bölməsinə baxın. Layihə rəhbərliyinin təsdiqi ilə (Aİ ilə ilk uyğunlaşdırma mərhələsi).
>
> **Qeyd (2026-10-14, K2-də müddət ifadəsi):** K2-dəki "`client_status.exp` … (Tamga: 60 gün)" yalnız **standart müddətdir** (sənədi verən qurum
> üstünlük bildirmədikdə). Sənədi verən qurum [[ADR-0047]] K1-dəki üstünlüyü (`preferred_client_status_period`, KA üçün
> `preferred_key_storage_status_period`) bildirərsə, provayder `client_status.exp` dəyərini (KA-da isə `key_storage_status.exp` dəyərini) həmin müddətə,
> provayderin yuxarı həddinədək verir (Tamga Wallet: 730 gün). 31 günlük alt hədd və qərarın qalan hissəsi dəyişmir.
