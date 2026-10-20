---
document_id: ADR-0056
title: "Paket API-lərində təhlükəsiz defolt dəyərlər"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-19
last_updated: 2026-10-19
summary: >
  `@tamga-network/*` paketlərinin 0.7.0 versiyasında təhlükəsizlik yoxlamasından yan keçən defolt dəyərlər aradan qaldırılır: etibar lövbəri, qayıdış ünvanı icazə siyahısı, ləğv sorğusu və yoxlayan tərəfin qeydiyyatı məcburi giriş parametridir (bilərəkdən ötürmək üçün açıq `"none"` dəyəri); DPoP token və resurs son nöqtəsi üçün iki ayrı funksiya; ləğv siyahısını imzalayan sabitlənir; cihaz açarı olmayan mdoc etibarsızdır; rəqəmsal cüzdan yalnız `checkRp` təsdiqi ilə təqdimat edir; keçid kartı yalnız yoxlama axınının qəbul nəticəsindən verilir; qeydiyyat sertifikatı olmayan sorğu bu gündən rədd edilir (ADR-0026 K5-in 2028-ə qədərki xəbərdarlıq keçidinin əvəzinə); E4 yalnız audit qeydi yazıldıqda "yerinə yetirildi" sayılır; saniyə və millisaniyə tiplə ayrılır. Həmçinin: tipi ləğv siyahısından istifadə edən, lakin ləğv qeydi daşımayan rəqəmsal sənəd rədd edilir, etibar siyahısının geriyə sarma qorunması defolt olaraq aktivdir, saat sürüşməsi seçimləri 600 san ilə məhdudlaşır. Qəbul: 2026-10-19.
domain: Trust
related: ["[[ADR-0012]]", "[[ADR-0017]]", "[[ADR-0025]]", "[[ADR-0026]]", "[[ADR-0029]]", "[[ADR-0031]]", "[[ADR-0048]]", "[[SPEC-API-0001]]", "[[SPEC-CRED-0003]]", "[[SPEC-PROTO-0001]]", "[[SPEC-PROTO-0002]]", "[[SPEC-WALLET-0001]]"]
translation_of: ADR-0056
source_version: "1.0.0"
---

# Qısaca

Paketlərimizdən istifadə edən tərtibatçı hansısa seçimi unutduqda nəticə "yoxlama aparılmadı, amma keçdi" olmamalıdır. 2026-10-19
təhlükəsizlik turu paket API-lərində bunun on iki yerdə mümkün olduğunu göstərdi (məs., etibar kökü verilmədikdə rəqəmsal sənəd zəncirsiz qəbul
edilirdi). Bu qərar həmin defolt dəyərləri aradan qaldırır: yoxlamadan yan keçmək istəyən bunu açıq şəkildə yazır (`"none"`), unutmaq isə artıq rədd deməkdir.
Dəyişikliklər uyğunluğu pozandır və 0.7.0 versiyası ilə birlikdə gəlir; inkişaf mərhələsində geriyə uyğunluq qatı yazılmır ([[ADR-0029]]).

# Kontekst

- 2026-10-19 təhlükəsizlik turu (API-dən yanlış istifadə təhlili) uyğunluğu pozmadan edilə bilən düzəlişləri dərhal etdi (boş gözlənilən
  dəyərlər, siyasətin təzəlik hədləri, lokal ünvan uyğunluğu, A6/B4 hesabatı) və defolt dəyəri dəyişən 12 təklifi qərara buraxdı.
- Bunlardan ikisi bağlanmış qərarlarla ziddiyyət təşkil edir: [[ADR-0026]] K5 (2026-10-13 dəyişikliyi) qeydiyyat sertifikatı olmayan sorğuda
  2028-08-11-ə qədər xəbərdarlıq + "Paylaşma" nəzərdə tutur; [[SPEC-API-0001]] E4-ü ("audit qeydi yazıldı") hər nəticədə yerinə yetirilmiş kimi göstərir.
  Bu ADR hər ikisini dəyişir; digər bəndlər spesifikasiyaların artıq tələb etdiyini kodda məcburi edir.
- İstifadəçi tərəfi: Tamga Wallet mağazaya çıxmayıb (yalnız sandbox və cihaz testləri), yoxlayan tərəfdə canlı RP sayı azdır;
  uyğunluğu pozan dəyişiklik üçün ən ucuz an indidir.

# Qərar

Hər bənddə "verilməməsi" JavaScript ilə çağıranın sahəni ümumiyyətlə verməməsini də əhatə edir: tip yoxlaması olmayan çağıran da rəddi görür.

## K1 — `verifySdJwtVc`: etibar lövbəri məcburidir
`rootCertsDer: Uint8Array[] | "none"` məcburidir. Boş massiv və ya verilməməsi A3-də rədd (`rootCertsDer missing`). `"none"`
zəncir yoxlamasını bilərəkdən ötürür (`anchorFingerprint: null`); yalnız imzalayanı ayrıca yoxlayan çağıran üçündür (məs., şəxsiyyət xidmətinin
özünün verdiyi rəqəmsal sənədi `issuerId` ilə tanıması).

## K2 — `createPar`: qayıdış ünvanı icazə siyahısı məcburidir
`allowedRedirectUris` (massiv və ya `clientId → liste` funksiyası) məcburidir; siyahı boşdursa və ya funksiya bu müştəri üçün siyahı
qaytarmırsa `invalid_redirect_uri` ("no redirect_uri is registered for this client"). Yalnız format yoxlaması ilə kifayətlənən yol qalmır.

## K3 — Ləğv sorğusu məcburidir
`verifyWalletAttestation` və `verifyKeyAttestation` (`verifyKaProof`, `verifyAttestationProof`) `statusOf`, `verifyPseudonym`
`walletStatusOf` qəbul edir: `StatusValueOf | "none"`, məcburi. `"none"` ləğvi bilərəkdən yoxlamır. Nəticələrdə yeni sahə
`statusChecked: boolean` (WIA və KA); `PseudonymResult` uğurlu nəticə `clientStatus` (`VALID` | `NOT_CHECKED` | `NOT_APPLICABLE`) daşıyır.

## K4 — `verifyPresentation`: yoxlayan tərəfin qeydiyyatı məcburidir
`rp: RelyingParty | null | "none"` məcburidir. Verilməməsi E3-də rədd; `null` qeydiyyatsız RP (rədd, əvvəlki kimi); `"none"` əhatə dairəsi
yoxlamasını (E3) bilərəkdən ötürür və E3 `checks_skipped` daxilində görünür (qeydiyyatlı RP-si olmayan, öz serverində yoxlama aparan).

## K5 — DPoP: iki son nöqtə, iki funksiya
`verifyDpop` aradan qaldırılır. Token son nöqtəsi `verifyTokenDpop` (bağlanacaq `jkt` dəyərini qaytarır); resurs son nöqtəsi `verifyResourceDpop` (`accessToken`
və ona bağlı `jkt` məcburidir; `ath` və açar uyğunluğu həmişə yoxlanılır).

## K6 — Ləğv siyahısını imzalayan sabitlənir
`verifyStatusListToken`, `verifyStatusListCwt`, `verifyStatusListAny` dördüncü giriş parametri kimi `{ expectedSignerFingerprints }`
qəbul edir (məcburi): imzalayan sertifikatın SHA-256 barmaq izləri və ya barmaq izini qiymətləndirən funksiya. Uyğun gəlməyən imzalayan imza
yoxlamasından əvvəl `D3: status token signer is not an expected signer`. Yoxlayan tərəf qurumun etibar siyahısındakı ləğv açarını,
cüzdan provayderi yoxlayıcısı (`WalletStatusChecker`) isə siyahıdakı provayder açarını verir.

## K7 — `verifyIssuerSigned`: cihaz açarı məcburidir
MSO `deviceKeyInfo.deviceKey` daşımayan rəqəmsal sənəd `valid: false` ("deviceKey missing"): şəxsə bağlana bilməyən rəqəmsal sənəd etibarlı sayılmır.

## K8 — Rəqəmsal cüzdan yalnız `checkRp` təsdiqi ilə təqdimat edir
`checkRp` maneə yaradan vəziyyət yoxdursa (saxtalaşdırma yoxdur; qeydiyyatlıdırsa ACTIVE; vasitəçi sorğuda iki qeydiyyat və [[ADR-0017]] K7 əlaqəsi) nəticəyə
`approval: ApprovedRequest` qoyur. `respond` bu təsdiqi məcburi qəbul edir; təsdiq sorğunun `client_id`, `nonce`, cavab ünvanı/mənşə,
imzalayan sertifikat və `onBehalfOf` sahələrinə bağlıdır və əl ilə qurula bilməz (proses daxili reyestr). Qeydiyyatsız yoxlayan tərəfə xəbərdarlıqla
paylaşım ([[SPEC-PROTO-0002]] PV2) təsdiqlidir; qeydiyyat sertifikatı qaydası K10-dadır.

## K9 — Keçid kartı yalnız qəbul nəticəsindən
`PassRegistry.issue({ verified, … })` bu prosesdə `verifyPresentation` tərəfindən qaytarılan, nəticəsi `ACCEPTED` olan çıxışı qəbul edir; kart
açarı (`pass_key` yoxdursa) yoxlanılmış təqdimatdan oxunur. Rədd, yoxlanıla bilmədi, əl ilə qurulmuş, kopyalanmış və ya sonradan
dəyişdirilmiş çıxış xəta verir. `presentation` giriş parametri aradan qalxır.

## K10 — Qeydiyyat sertifikatı olmayan sorğu rədd edilir
[[ADR-0026]] K5-in 2026-10-13 dəyişikliyindəki "xəbərdarlıq + defolt Paylaşma, 2028-08-11-dən sonra rədd" keçidi aradan qaldırılır:
məsafədən və yaxın məsafədə qeydiyyat sertifikatı olmayan sorğu bu gündən `valid: false`, `reason: "registration_missing"`; rəqəmsal cüzdan şəxsdən
soruşmadan dayanır. `WRPRC_REQUIRED_FROM` sabiti və `missingRegistrationPolicy` funksiyasının zaman giriş parametri aradan qalxır. Cüzdandan cüzdana yaxın
məsafə (TS9; qarşı tərəfdə oxuyucu sertifikatı yoxdur) dəyişmir. Bunun ilkin şərti: canlı yoxlayan tərəflərin qeydiyyatlarına identifikasiya nömrəsi
daxil edilir və nəşr edən hər istifadə üçün qeydiyyat sertifikatı yaradır ([[ADR-0026]] K4).

## K11 — E4 yalnız audit qeydi yazıldıqda
`verifyPresentation` E4-ü yalnız `audit` funksiyası verildikdə və çağırıldıqda `checks_performed` sahəsinə yazır; verilmədikdə E4
`checks_skipped` sahəsindədir. Nəticə formatı dəyişmir (sahə eynidir, yeri dəyişir). [[SPEC-API-0001]] AP9 (E4 rədd üçün də işləyir) audit
qeydi yeri olan yoxlayan tərəf üçün keçərlidir; host edilən yoxlayan tərəf həmişə verir.

## K12 — Saniyə və millisaniyə tiplə ayrılır
`@tamga-network/core` `EpochSeconds` və `EpochMillis` tiplərini, həmçinin `epochSeconds`, `epochMillis`, `nowSeconds`, `nowMillis`,
`secondsToMillis`, `millisToSeconds` köməkçilərini təqdim edir (RN üçün `@tamga-network/core/time`). Qəbul qərarı verən funksiyalar
`now` dəyərini saniyə tipi ilə (yoxlama, WIA/KA, DPoP, PAR, ləğv siyahısı, mdoc, psevdonim, keçid kartı), rəqəmsal cüzdanın qeydiyyat sertifikatı,
`checkRp`, açıqlama siyasəti və yoxlayan tərəfin əhatə dairəsi köməkçiləri isə millisaniyə tipi ilə qəbul edir; yanlış vahid kompilyasiyada xəta və
icra zamanı `RangeError` (saniyə `< 1e11`, millisaniyə `≥ 1e11`).

## K13 — Əlavə təhlükəsiz defolt dəyərlər
- Sxemində `uses_status_list: true` olan tipin ləğv qeydi daşımayan rəqəmsal sənədi D1-də rədd edilir (`usesStatusList` köməkçisi,
  `@tamga-network/schemas`).
- Etibar siyahısının geriyə sarma qorunması (TL2) defolt olaraq aktivdir: `versionMemory` verilməyən yükləmə proses daxili yaddaşdan (şəbəkə və LOTL kök
  barmaq izləri üzrə) istifadə edir; `versionMemory: "none"` onu söndürür; davamlı qorunma üçün davamlı yaddaş verilir.
- Saat sürüşməsi seçimləri (`maxSkewSec`, `clockSkewSec`, `maxClockSkewSec`) ən çoxu `MAX_CLOCK_SKEW_SEC` = 600 san; bundan yuxarı və ya
  mənfi dəyər `RangeError` (siyasətin `max_clock_skew_sec` həddi ilə eyni).

## K14 — Yeni açıq adlar
Layihə rəhbərliyinin təsdiqi ilə: `"none"` (açıq ötürmə dəyəri), `statusChecked`, `clientStatus` (`PseudonymResult`), `StatusCheck`,
`expectedSignerFingerprints`, `StatusTokenVerifyOptions`, `verifyTokenDpop`, `verifyResourceDpop`, `DpopCommonOptions`,
`ApprovedRequest`, `approval`, `verified` (`PassRegistry.issue`), `isYes`, `usesStatusList`, `EpochSeconds`, `EpochMillis`,
`epochSeconds`, `epochMillis`, `nowSeconds`, `nowMillis`, `secondsToMillis`, `millisToSeconds`, `secondsOrNow`, `millisOrNow`,
`MAX_CLOCK_SKEW_SEC`, `clockSkewOption`, `resetDefaultListVersionMemory`, alt yol `@tamga-network/core/time`.

# Nəzərdən keçirilmiş variantlar

| Seçim | Qərar | Əsaslandırma |
|---|---|---|
| Köhnə davranışı saxlayıb xəbərdarlıq yazmaq (0.6.0 qeydləri) | rədd | Xəbərdarlığı oxumayan inteqrator yenə açıq buraxır; yanlış istifadə səssiz qalır |
| Məcburi giriş parametri, istisna yolu yoxdur | rədd | Test, uyğunluq aləti və öz rəqəmsal sənədini tanıyan xidmət üçün şüurlu ötürmə lazımdır |
| Məcburi giriş parametri + açıq `"none"` | **qəbul** | Ötürmə kodda görünür, nəzərdən keçirmədə aşkarlanır; unutmaq rədd deməkdir |
| K10: 2028-ə qədər xəbərdarlıq (ADR-0026 K5) | rədd | Xəbərdarlıq + Paylaşma qərarı şəxsə buraxır; qeydiyyatsız istifadəyə qapı açıq qalır; rəqəmsal cüzdan hələ mağazada deyil |
| K8/K9: formal tip (yalnız TypeScript) | rədd | JavaScript ilə çağıran və əl ilə qurulmuş obyekt keçərdi; proses daxili reyestr saxtalaşdırıla bilməz |

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| MR1 | Qəbul qərarına təsir edən təhlükəsizlik giriş parametri (etibar lövbəri, qayıdış ünvanı siyahısı, ləğv sorğusu, RP qeydiyyatı, ləğv siyahısını imzalayan) verilmədikdə funksiya rədd edir; ötürmək yalnız açıq `"none"` dəyəri ilə mümkündür. |
| MR2 | Ləğv statusunu yoxlamayan uğurlu nəticə bunu açıq şəkildə daşıyır (`statusChecked: false`, `clientStatus: "NOT_CHECKED"`). |
| MR3 | Rəqəmsal cüzdan `checkRp` tərəfindən bu sorğuya bağlı verilmiş təsdiq olmadan təqdimat cavabı göndərmir. |
| MR4 | Keçid kartı yalnız yoxlama axınının qəbul nəticəsindən və yoxlanılmış təqdimatın açarına verilir. |
| MR5 | Qeydiyyat sertifikatı olmayan sorğu (cüzdandan cüzdana yaxın məsafə istisna olmaqla) rədd edilir. |
| MR6 | E4 yalnız audit qeydi yazıldıqda `checks_performed` sahəsindədir. |
| MR7 | Zaman giriş parametrləri vahidi ilə işarələnir; yanlış vahid xəta verir, səssizcə şərh edilmir. |
| MR8 | Tipi ləğv siyahısından istifadə edən rəqəmsal sənəddə ləğv qeydi yoxdursa, yoxlama rədd edir. |

# Nəticələr

- Paketlər 0.7.0 (npm nəşri layihə rəhbərliyi tərəfindən): `core`, `sd-jwt`, `mdoc`, `trust`, `schemas`, `issuer`, `verifier`, `wallet-core`.
  CHANGELOG "Unreleased" bölməsi 0.7.0 qeydləridir; paket README-ləri və `docs/packages/*` yenilənir.
- [[SPEC-API-0001]] (A3 kök, E3 `rp`, E4, D1 ləğv qeydi, D3 imzalayan, `isYes`), [[SPEC-CRED-0003]] (imzalayanın sabitlənməsi), [[SPEC-PROTO-0001]]
  (PAR icazə siyahısı, DPoP iki son nöqtə), [[SPEC-WALLET-0001]] və [[SPEC-PROTO-0002]] (K8, K10), [[ADR-0026]] dəyişiklik qeydi.
- Uyğunluq vektorları versiya 6: ləğv siyahısında "gözlənilməyən imzalayan" neqativ halı; icraçı imzalayanı sabitləyir.
- İstehlakçılar eyni versiyada yenilənir: istinad yoxlayan tərəfi, siyahı nəşr edəni, şəxsiyyət xidməti və qurum issuer-i, Tamga Wallet və
  cüzdan provayderi (paket nüsxələri).
- İstismar ilkin şərti (K10): canlı yoxlayan tərəflərin qeydiyyat sertifikatları dərc edilmədən yenilənmiş rəqəmsal cüzdan onlara təqdimat etmir.
- Dəyişməyən qərarlar: D-PROTO-1, D-PRIV-1 (psevdonim), D-PROX-1 (keçid kartı), D-CRED-7 (WIA/KA), D-API-2.

# Status

**Accepted — 2026-10-19.** Layihə rəhbərliyinin təsdiqi ilə (təhlükəsizlik turu 2026-10-19, 12 təklif və yeni adlar). DECISIONS: D-API-3.
Əvəz etdiyi: [[ADR-0026]] K5-in 2026-10-13 dəyişikliyindəki 2028-08-11-ə qədərki xəbərdarlıq keçidi (K10) və [[SPEC-API-0001]] E4
hesabatı (K11).
