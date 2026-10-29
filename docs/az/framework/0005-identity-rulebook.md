---
document_id: FW-RB-0003
title: "Identity Rulebook"
status: Active
version: 1.0.0
created: 2026-09-27
last_updated: 2026-10-23
summary: >
  Tamga-nın şəxsiyyət xidmətinin verdiyi şəxsi rəqəmsal sənədlərin rulebook-u (Tamga Rulebook-dan törəyir), Aİ Attestation Rulebook şablonunun bölmə strukturu ilə: Tamga şəxsiyyət sənədi (`urn:tamga:id:IdentityAttestation:1`; SD-JWT VC + ISO/IEC 18013-5 mdoc), onun ZK nüsxəsi (`urn:tamga:id:ShortLivedIdentityAttestation:1`), psevdonim toxumu (`urn:tamga:id:PseudonymSeed:1`) və sürücülük vəsiqəsi məlumatı (`urn:tamga:id:DrivingLicenceAttestation:1`; rəsmi sürücülük vəsiqəsi deyil). Atributlar və metaməlumatlar, hüquqi kateqoriya, format üzrə kodlaşdırma, istifadə, etibar lövbərləri, etibarlılıq və ləğv, Aİ ilə uyğunluq. Şəxsiyyət sənədi PID deyil; kvalifikasiyalı olmayan EAA-dır və Aİ PID adlarından və kodlaşdırmasından istifadə edir.
translation_of: FW-RB-0003
source_version: "1.0.0"
---

| Versiya | Tarix | Təsvir |
|---|---|---|
| 1.0.0 | 2026-10-16 | Tamga ARF 1.0-ın aktual mətni; Aİ Attestation Rulebook şablonunun (versiya 1.5) bölmə strukturunda. |

**Sxem sahibi:** Tamga Network (hazırda müvəqqəti operator). **Rəy və təkliflər:** <https://github.com/tamga-network/tamga-network/issues>

---

# 1. Giriş

## 1.1 Əhatə dairəsi və məqsəd

Bu [[t:rulebook]] Tamga Network şəxsiyyət xidmətinin (`id.tamga.network`) verdiyi dörd növ şəxsi rəqəmsal sənədi müəyyən edir:

| Növ | `vct` / docType | Format | Kataloq |
|---|---|---|---|
| Tamga Şəxsiyyət Sənədi | `urn:tamga:id:IdentityAttestation:1` | [[t:SD-JWT-VC]] + [[t:mdoc]] (ad fəzası `tamga.id.1`) | `schemas.tamga.network/v1/id/IdentityAttestation/1.0.0` |
| ZK nüsxəsi (yalnız sıfır biliklə sübutlu təqdimat) | `urn:tamga:id:ShortLivedIdentityAttestation:1` | yalnız mdoc (ad fəzası `tamga.id.1`) | `schemas.tamga.network/v1/id/ShortLivedIdentityAttestation/1.0.0` · [[ADR-0044]] |
| Psevdonim toxumu (göstərilə bilməz) | `urn:tamga:id:PseudonymSeed:1` | yalnız SD-JWT VC | `schemas.tamga.network/v1/id/PseudonymSeed/1.0.0` · [[ADR-0031]] |
| Sürücülük vəsiqəsi məlumatı | `urn:tamga:id:DrivingLicenceAttestation:1` | yalnız SD-JWT VC | `schemas.tamga.network/v1/id/DrivingLicenceAttestation/1.0.0` · [[ADR-0039]] |

**Məqsəd.** Dövlət tərəfindən təyin edilmiş [[t:PID]] provayderi olmadığı halda şəxsin kimliyini bir dəfə məsafədən yoxlayıb onu rəqəmsal cüzdanında
seçici paylaşımlı, cihaza bağlı rəqəmsal sənəd kimi daşımasını təmin etmək: qurumlar şəxsi öz qeydləri ilə uyğunlaşdırır, saytlar
yaşı və ya "etibarlı şəxsiyyət sənədi varmı" sualını soruşur, şəxs yalnız lazım olanı açır.

**Status.** Şəxsiyyət sənədi **PID deyil**: Tamga-nın müvəqqəti olaraq verdiyi, kvalifikasiyalı olmayan **[[t:EAA]]**-dır
([[ADR-0011]], [[ADR-0022]]); [[t:trust-list|etibar siyahısında]] `pid_providers[]` boş qalır. Dövlət provayderi təyin edildikdə yeni rəqəmsal sənəd
verilmir və qeyd varisə ötürülür (§4.7). Sürücülük vəsiqəsi məlumatı **rəsmi sürücülük vəsiqəsi deyil, [[t:mDL]] deyil** (§4.8).

Texniki tərif [[SPEC-ID-0003]] §9-da və sxem kataloqundadır; ziddiyyət olduqda onlar üstündür. Bu rulebook yeni qayda qoymur;
[[ADR-0011]], [[ADR-0013]], [[ADR-0039]], [[ADR-0044]], [[ADR-0045]], [[SPEC-ID-0003]] və Tamga Rulebook-un (Əlavə B) RB-AP-ID
qaydalarını Aİ şablonunun quruluşunda bir yerə toplayır.

## 1.2 Sənədin strukturu

Bölmə 2 atributları və metaməlumatları formatdan asılı olmayaraq müəyyən edir; Bölmə 3 format üzrə kodlaşdırmanı (ISO/IEC 18013-5, SD-JWT VC,
W3C VCDM); Bölmə 4 istifadəni, rəqəmsal sənədin verilmə şərtlərini və yoxlayan tərəfin öhdəliklərini; Bölmə 5 etibar lövbərlərini; Bölmə 6
etibarlılığı və ləğvi; Bölmə 7 Aİ ilə uyğunluğu və qərar gözləyən məqamları.

## 1.3 Açar sözlər

**MUST**, **MUST NOT**, **SHOULD** və **MAY** RFC 2119 mənasındadır (Tamga Rulebook §0). Kiçik hərflə yazılan "tələb olunur" xarici
sənədin qoyduğu şərti ifadə edir.

## 1.4 Terminlər

Terminlər Əlavə D-dədir; Aİ terminləri ARF Annex 1-dəki mənadadır.

---

# 2. Atributlar və metaməlumatlar

## 2.0 Aİ tələbləri və bu sənəddəki qarşılıqları

ARF Topic 12-nin kvalifikasiyalı olmayan EAA üçün qoyduğu tələblər (eIDAS 2.0 Əlavə V-ə istinadla):

| Tələb | Qarşılıq |
|---|---|
| EAA olduğunun göstəricisi (ARB_12) | §2.1 — `category` yazılmır; ETSI TS 119 472-1 V1.2.1 EAA-5.2.2.1-01 qaydasına görə kvalifikasiyalı olmayan EAA-nın göstəricisi məhz bu yoxluqdur; şablonun `eaa:eu:non-qualified` dəyəri istifadə olunmur ([[ADR-0047]] K6) |
| Sənədi verənin kimliyi, Əlavə V b (ARB_15) | `iss` (sənədi verənin ünvanı) və imza başlığındakı `x5c` yarpaq sertifikatı (qurumun adı, ölkə); `issuer_id` sertifikatın barmaq izidir (§2.5, §5) |
| Subyektin kimliyi, Əlavə V c (ARB_17) | Şəxsiyyət sənədi: `family_name`, `given_name`, `birthdate`, `personal_administrative_number`. Sürücülük vəsiqəsi məlumatı: `family_name`, `given_name`, `birth_date`. ZK nüsxəsi və psevdonim toxumu qəsdən subyektin kimliyini daşımır (§2.2) |
| Etibarlılığın başlanğıcı və sonu, Əlavə V e (ARB_19) | SD-JWT VC `iat`, `exp`; mdoc `validityInfo` (`validFrom`, `validUntil`) |
| Etibar lövbərinin yeri, Əlavə V h (ARB_21) | Rəqəmsal sənəddə ayrıca sahə yoxdur və əlavə edilmir; yer sənədi verənin sertifikat zənciri və Tamga etibar siyahılarıdır (§5); etibar lövbərlərinin yeganə mənbəyi siyahılardır ([[ADR-0047]] K7) |

## 2.1 Giriş və hüquqi kateqoriya

Şəxsiyyət sənədi Aİ PID-in atribut adlarından və kodlaşdırmasından istifadə edir (İcra Reqlamenti (Aİ) 2026/1731; [[ADR-0045]]); növ və ad
fəzası Tamga-ya məxsusdur. Şəxsi sahələrin hamısı seçici paylaşımlıdır; portret, ünvan, sənəd təsviri və təminat səviyyəsi
([[t:LoA]]) sahəsi yoxdur. Milli şəxsiyyət nömrəsi yalnız bu növdə olur (RB-AP-ID-04, RB-SCH-04).

**Hüquqi kateqoriya (`category`).** Aİ Attestation Rulebook şablonu (1.5) və ETSI TS 119 472-1 QEAA və PuB-EAA üçün `category`
atributunu müəyyən edir (`urn:etsi:esi:eaa:eu:qualified`, `urn:etsi:esi:eaa:eu:pub`; ARF mətnindəki köhnə adı
`attestation_legal_category`, ARB_25). Tamga bu addan öz dəyərləri ilə (`urn:tamga:eaa:qualified`, `urn:tamga:eaa:pub`) yalnız qeydiyyat
sinfi kvalifikasiyalı və ya dövlət olan sənədi verən qurumda istifadə edir (RB-AP-14). Şəxsiyyət xidməti kvalifikasiyalı olmayan EAA / I2 sinfindədir
([[ADR-0022]]); bu rulebook-dakı dörd növdən heç biri `category` daşıya bilməz (**MUST NOT**) (RB-AP-ID-04). ETSI TS 119 472-1
(EAA-5.2.2.1-01) kvalifikasiyalı olmayan, dövlət mənbəli olmayan EAA-da `category` olmamasını tələb edir; rəqəmsal sənədin kvalifikasiyalı olmayan EAA
olduğu bu yoxluqdan və sənədi verənin etibar siyahısındakı sinfindən anlaşılır.

## 2.2 Məcburi atributlar

**Şəxsiyyət sənədi (`IdentityAttestation`)**

| Məlumat identifikatoru | Tərif | Məlumat növü | Nümunə dəyər |
|---|---|---|---|
| `family_name` | Soyadı | mətn (1–200) | `Yılmaz` |
| `given_name` | Adı | mətn (1–200) | `Ayşe` |
| `birthdate` | Doğum tarixi | tarix (YYYY-MM-DD) | `1990-04-12` |
| `nationalities` | Vətəndaşlıqlar; məlum deyilsə `QU`, vətəndaşlığı olmayan şəxs üçün `QS` | ISO 3166-1 alpha-2 massivi (ən azı bir element) | `["TR"]` |
| `personal_administrative_number` | Milli şəxsiyyət nömrəsi; yalnız bu növdə | mətn (5–32) | `12345678901` |
| `document_type` | Yoxlanılan sənədin növü | `ID_CARD` \| `PASSPORT` \| `RESIDENCE_PERMIT` \| `DRIVING_LICENSE` | `ID_CARD` |
| `document_number_hash` | Sənəd nömrəsinin açarlı heşi (HMAC-SHA256; açar yalnız şəxsiyyət xidmətindədir); nömrənin özü yoxdur və heşdən bərpa edilə bilməz | `sha256-…` | `sha256-q1…` |
| `issuing_country` | Aİ PID mənasında rəqəmsal sənədi verən provayderin ölkəsi; hazırda dəyər skan edilən şəxsiyyət vəsiqəsini verən ölkədir (§4.6) | ISO 3166-1 alpha-2 | `TR` |
| `document_chip_verified` | NFC çipi oxunubmu (fakt; səviyyə deyil) | boolean | `true` |
| `verification_method` | Kimliyin yoxlanılması üsulu; `review-demo` yalnız tətbiq mağazasının yoxlaması üçün verilən sınaq sənədində | `remote-document-liveness-face` \| `remote-nfc-liveness-face` \| `in-person` \| `review-demo` | `remote-document-liveness-face` |

**ZK nüsxəsi (`ShortLivedIdentityAttestation`)**

| Məlumat identifikatoru | Tərif | Məlumat növü | Nümunə dəyər |
|---|---|---|---|
| `age_over_18` | 18 yaşdan böyükdürmü; yalnız ZK ilə sübut edilə bilən element | boolean | `true` |
| `age_over_15` | 15 yaşdan böyükdürmü; yalnız ZK ilə sübut edilə bilən element ([[ADR-0064]]) | boolean | `true` |

**Psevdonim toxumu (`PseudonymSeed`)**

| Məlumat identifikatoru | Tərif | Məlumat növü | Nümunə dəyər |
|---|---|---|---|
| `pseudonym_seed` | Sayt üzrə psevdonim törətmək üçün toxum; şəxsin dəyişməz kimliyindən ayrı açarla törədilir, saxlanılmır (RB-AP-ID-07) | base64url, 43 simvol | `Qm9…` |

**Sürücülük vəsiqəsi məlumatları rəqəmsal sənədi (`DrivingLicenceAttestation`)**

| Məlumat identifikatoru | Təsvir | Məlumat tipi | Nümunə dəyər |
|---|---|---|---|
| `family_name` | Soyad | mətn (1–200) | `Yılmaz` |
| `given_name` | Ad | mətn (1–200) | `Ayşe` |
| `issuing_country` | Kartı verən ölkə | ISO 3166-1 alpha-2 | `TR` |
| `document_number_hash` | Kart nömrəsinin açarlı heşi | `sha256-…` | `sha256-Zx…` |
| `driving_privileges` | Kateqoriyalar: `[{ category, issue_date?, expiry_date? }]`; Aİ 2006/126 kateqoriya kodları, milli əlavələr olduğu kimi (1–32 element) | obyekt massivi | `[{"category":"B","issue_date":"2010-06-01"}]` |
| `licence_expiry_date` | Kartın bitmə tarixi | tarix | `2034-06-01` |
| `verified_at` | Kartın yoxlandığı gün | tarix | `2026-10-11` |
| `verification_method` | Yoxlama üsulu | `remote-document-liveness-face` | `remote-document-liveness-face` |
| `not_official_licence` | Bu rəqəmsal sənədin rəsmi sürücülük vəsiqəsi olmadığının açıq göstəricisi; həmişə `true` | sabit `true` | `true` |

`driving_privileges[].category` rəqəmsal sənəddə sürücülük vəsiqəsinin kateqoriyasını bildirir; §2.1-dəki hüquqi kateqoriya ilə əlaqəsi yoxdur.

## 2.3 İxtiyari atributlar

| Növ | Məlumat identifikatoru | Tərif | Məlumat növü | Nümunə dəyər |
|---|---|---|---|---|
| Şəxsiyyət sənədi | `age_over_18` | Doğum tarixindən törədilir; yaşın yoxlanılmasında yalnız bu sahə açılır. Aİ PID toplusunda yoxdur; ISO/IEC 18013-5 adı ilə Tamga sahəsidir ([[ADR-0045]] K3) | boolean | `true` |
| Şəxsiyyət sənədi | `age_over_15` | Doğum tarixindən eyni qayda ilə törədilir; ISO/IEC 18013-5 `age_over_NN` nümunəsi. Şəxsiyyət sənədinin yaş həddləri qapalı çoxluqdur (15, 18); yeni hədd yalnız ADR ilə əlavə edilir ([[ADR-0064]] K2) | boolean | `true` |
| Sürücülük vəsiqəsi məlumatı | `birth_date` | Kartda varsa doğum tarixi (ISO/IEC 18013-5 mDL adı) | tarix | `1990-04-12` |
| Sürücülük vəsiqəsi məlumatı | `licence_issue_date` | Kartın verilmə tarixi (varsa) | tarix | `2024-06-01` |
| Sürücülük vəsiqəsi məlumatı | `age_over_18` | Törədilmiş | boolean | `true` |

## 2.4 Şərti atributlar

Yoxdur.

## 2.5 Məcburi metaməlumatlar

| Məlumat identifikatoru | Tərif | Məlumat növü | Nümunə dəyər |
|---|---|---|---|
| `iss` | Sənədi verənin ünvanı (şəxsiyyət xidməti) | URI | `https://id.tamga.network` |
| `vct` | Növ (SD-JWT VC); mdoc-da docType eyni dəyərdir | URN | `urn:tamga:id:IdentityAttestation:1` |
| `vct#integrity` | Növ tərifinin kataloqdakı heşi (RB-SCH-01) | `sha256-…` | `sha256-…` |
| `iat` | Verildiyi an; mdoc-da `validityInfo.signed` | NumericDate | `1791763200` |
| `exp` | Etibarlılığın sonu; mdoc-da `validityInfo.validUntil` (§6.1) | NumericDate | `1854835200` |
| `cnf` | Rəqəmsal cüzdanın cihaz açarı (holder bağlantısı); mdoc-da `deviceKeyInfo` | JWK | — |
| `status` | Ləğv siyahısına istinad `status_list {idx, uri}`; ZK nüsxəsində və psevdonim toxumunda yoxdur (§6.2) | obyekt | `{"status_list":{"idx":48213,"uri":"https://status.tamga.network/7f3a9c21"}}` |

Sənədi verənin kimliyi (Əlavə V b) imza başlığındadır: `x5c` (yarpaq + aralıq sertifikat, kök istisna olmaqla).

## 2.6 İxtiyari metaməlumatlar

Yoxdur. `nbf` hazırda yazılmır (§7.2).

## 2.7 Şərti metaməlumatlar

`category` bu növlərdə yoxdur (§2.1).

---

# 3. Kodlaşdırma

## 3.1 ISO/IEC 18013-5 (mdoc)

**Yaxın məsafə (proximity) təhlili (ARB_02).** Şəxsiyyətin üz-üzə, internetsiz göstərilməsi tələb oluna bilər (qurumda qeydiyyat masası, girişdə yaş
yoxlaması); buna görə şəxsiyyət sənədi ISO/IEC 18013-5 mdoc kimi də verilir ([[ADR-0013]]). Sürücülük vəsiqəsi məlumatı rəsmi
yoxlamada istifadə edilmədiyi üçün mdoc kimi verilmir ([[ADR-0039]]); psevdonim toxumu ümumiyyətlə göstərilmir. ZK nüsxəsi yalnız mdoc-dur.

| Növ | docType | Ad fəzası |
|---|---|---|
| Şəxsiyyət sənədi | `urn:tamga:id:IdentityAttestation:1` | `tamga.id.1` |
| ZK nüsxəsi | `urn:tamga:id:ShortLivedIdentityAttestation:1` | `tamga.id.1` |

Kodlaşdırma qaydaları: `tstr`, `uint`, `bool` və `full-date` RFC 8610 / RFC 8943 mənasındadır; `full-date` = #6.1004(tstr). `tstr`
UTF-8-dir. Element dəyərləri tarix istisna olmaqla SD-JWT VC-dəkilərlə eynidir. MSO-da `digestAlgorithm` SHA-256, `validityInfo`
(`signed`, `validFrom`, `validUntil`; `tdate`, saniyə kəsri yoxdur, saat qurşağı `Z`), `deviceKeyInfo` və ləğv siyahısına istinad
`status.status_list {idx, uri}` (SD-JWT nüsxəsi ilə eyni bit; ünvan eyni siyahının CWT təqdimatıdır — `application/statuslist+cwt`,
[[ADR-0048]] K3, paketlər 0.6.0) yer alır. İmza ES256 (COSE), `x5chain` eyni sənədi verən qurumun
sertifikatıdır.

| Məlumat identifikatoru | Element identifikatoru | Kodlaşdırma | Ad sahəsi |
|---|---|---|---|
| `family_name` | `family_name` | tstr | `tamga.id.1` |
| `given_name` | `given_name` | tstr | `tamga.id.1` |
| `birthdate` | `birth_date` | full-date | `tamga.id.1` |
| `nationalities` | `nationality` | [+ tstr] (alpha-2 massivi) | `tamga.id.1` |
| `personal_administrative_number` | `personal_administrative_number` | tstr | `tamga.id.1` |
| `document_type` | `document_type` | tstr | `tamga.id.1` |
| `document_number_hash` | `document_number_hash` | tstr | `tamga.id.1` |
| `issuing_country` | `issuing_country` | tstr | `tamga.id.1` |
| `document_chip_verified` | `document_chip_verified` | bool | `tamga.id.1` |
| `verification_method` | `verification_method` | tstr | `tamga.id.1` |
| `age_over_18` | `age_over_18` | bool | `tamga.id.1` |
| `age_over_15` | `age_over_15` | bool | `tamga.id.1` |

Ad və kodlaşdırma Aİ PID Cədvəl 6-ya əsaslanır ([[ADR-0045]] K2); ad cədvəli açıq paketlərdədir (`@tamga-network/core/pid`). Ad sahəsi
`tamga.id.1` Tamga-ya məxsus ad sahəsidir (ARB_10): sənəd PID olmadığı üçün `eu.europa.ec.eudi.pid.1` istifadə olunmur.

**Nümunə (şəxsiyyət sənədi, yalnız yaş üçün açılan elementlər):**

```text
docType: "urn:tamga:id:IdentityAttestation:1"
nameSpaces: { "tamga.id.1": [ { elementIdentifier: "age_over_18", elementValue: true } ] }
MSO.validityInfo: { signed: 2026-10-11T08:00:00Z, validFrom: 2026-10-11T08:00:00Z, validUntil: 2028-10-10T08:00:00Z }
MSO.status: { status_list: { idx: 48213, uri: "https://status.tamga.network/7f3a9c21" } }
```

## 3.2 SD-JWT VC

Sənədlər [[t:SD-JWT-VC]] kimi, HAIP 1.0-ın SD-JWT VC profilinə uyğun verilir (ARB_01b): başlıqda `alg` ES256, `typ`
`dc+sd-jwt`, `x5c`; `_sd_alg` sha-256; saxta həş (decoy) yoxdur. `vct` URN formatındadır (`urn:tamga:<alan>:<Tür>:<ana sürüm>`) və
şəbəkədə unikaldır (ARB_05); növ təsviri (Type Metadata) kataloqdan gəlir və `vct#integrity` məcburidir (ARB_31, RB-SCH-01).

"Seçici paylaşım" sütunu Type Metadata-dakı `sd` dəyəridir: **MUST** = `always`, **MAY** = `allowed`, **MUST NOT** = `never`
(ARB_30). Massiv elementləri ayrı-ayrılıqda açıqlanır (`nationalities` üçün `path: ["nationalities", null]`, RFC 9901 §4.2.2).

**Şəxsiyyət sənədi — IANA-da qeydiyyatlı adlar**

| Məlumat identifikatoru | Claim adı | Kodlaşdırma | Mənbə | Seçici paylaşım |
|---|---|---|---|---|
| `family_name` | `family_name` | string | OpenID Connect Core §5.1 | MUST |
| `given_name` | `given_name` | string | OpenID Connect Core §5.1 | MUST |
| `birthdate` | `birthdate` | string, YYYY-MM-DD | OpenID Connect Core §5.1 | MUST |
| `nationalities` | `nationalities` | string massivi (alpha-2), hər element ayrıca | OpenID Connect for Identity Assurance §4.1 | MUST (hər element) |

**Şəxsiyyət sənədi — Aİ PID adları və Tamga-ya məxsus adlar**

| Məlumat identifikatoru | Claim adı | Kodlaşdırma | Qeyd | Seçici paylaşım |
|---|---|---|---|---|
| `personal_administrative_number` | `personal_administrative_number` | string | Aİ PID adı | MUST |
| `issuing_country` | `issuing_country` | string (alpha-2) | Aİ PID adı (§4.6) | MUST |
| `document_type` | `document_type` | string (çoxluq) | Tamga-ya məxsus | MUST |
| `document_number_hash` | `document_number_hash` | string `sha256-…` | Tamga-ya məxsus | MUST |
| `document_chip_verified` | `document_chip_verified` | boolean | Tamga-ya məxsus | MUST |
| `verification_method` | `verification_method` | string (çoxluq) | Tamga-ya məxsus | MUST |
| `age_over_18` | `age_over_18` | boolean | ISO/IEC 18013-5 adı | MUST |
| `age_over_15` | `age_over_15` | boolean | ISO/IEC 18013-5 adı ([[ADR-0064]]) | MUST |
| `iss`, `vct`, `vct#integrity`, `iat`, `exp`, `cnf`, `status` | eyni | — | daşıma profili | MUST NOT |

**Psevdonim toxumu**

| Məlumat identifikatoru | Claim adı | Kodlaşdırma | Qeyd | Seçici paylaşım |
|---|---|---|---|---|
| `pseudonym_seed` | `pseudonym_seed` | string (base64url) | Tamga-ya məxsus; heç bir yoxlayan tərəfin əhatə dairəsinə daxil deyil | MUST NOT (sənəd heç vaxt təqdim olunmur) |

**Sürücülük vəsiqəsi məlumatları rəqəmsal sənədi**

| Məlumat identifikatoru | Claim adı | Kodlaşdırma | Qeyd | Seçici paylaşım |
|---|---|---|---|---|
| `family_name`, `given_name` | eyni | string | OpenID Connect Core §5.1 | MUST |
| `birth_date` | `birth_date` | string, YYYY-MM-DD | ISO/IEC 18013-5 mDL adı ([[ADR-0045]] K4) | MUST |
| `issuing_country` | `issuing_country` | string (alpha-2) | ISO/IEC 18013-5 mDL adı | MUST |
| `document_number_hash` | eyni | string `sha256-…` | Tamga-ya məxsus | MUST |
| `driving_privileges` | eyni | obyekt massivi | ISO/IEC 18013-5 mDL adı; rəsmi mDL ad sahəsi istifadə olunmur (RB-AP-ID-08) | MUST |
| `licence_issue_date`, `licence_expiry_date` | eyni | string, YYYY-MM-DD | Tamga-ya məxsus | MUST |
| `verification_method`, `age_over_18` | eyni | string / boolean | — | MUST |
| `verified_at` | eyni | string, YYYY-MM-DD | Tamga-ya məxsus | MUST NOT |
| `not_official_licence` | eyni | sabit `true` | Tamga-ya məxsus; hər təqdimatda görünür | MUST NOT |

**Nümunə (şəxsiyyət sənədi; JWT claim toplusu, açıqlamalar dekodlaşdırılmış halda):**

```json
{
  "iss": "https://id.tamga.network",
  "vct": "urn:tamga:id:IdentityAttestation:1",
  "vct#integrity": "sha256-…",
  "iat": 1791763200,
  "exp": 1854835200,
  "cnf": { "jwk": { "kty": "EC", "crv": "P-256", "x": "…", "y": "…" } },
  "status": { "status_list": { "idx": 48213, "uri": "https://status.tamga.network/7f3a9c21" } },
  "family_name": "Yılmaz",
  "given_name": "Ayşe",
  "birthdate": "1990-04-12",
  "nationalities": ["TR"],
  "personal_administrative_number": "12345678901",
  "document_type": "ID_CARD",
  "document_number_hash": "sha256-…",
  "issuing_country": "TR",
  "document_chip_verified": false,
  "verification_method": "remote-document-liveness-face",
  "age_over_18": true,
  "age_over_15": true
}
```

Verilən sənəddə şəxs sahələrinin hər biri ayrıca açıqlamadır (disclosure); `nationalities` massivinin hər elementi də ayrıca
açıqlamadır. Kodlaşdırılmış sənəd və açıqlama nümunələri uyğunluq vektorlarındadır (`conformance/vectors/sd-jwt`).

## 3.3 W3C VCDM

İstifadə olunmur: Tamga JSON-LD daşıyıcısından istifadə etmir.

---

# 4. İstifadə

## 4.1 İstifadə ssenariləri və yoxlayan tərəfin tələb etdiyi sahələr

| İstifadə | Tələb olunan sahələr | Qayda |
|---|---|---|
| Yaşın yoxlanılması | `age_over_18` və ya `age_over_15` (tək hədd) | Başqa sahə tələb olunmur; iki hədd birlikdə istənilmir, yaş aralığını üzə çıxarır ([[ADR-0064]] K3); brauzerdə mdoc ilə, istənilərsə ZK nüsxəsi ilə sıfır bilikli sübut |
| Qurumda qeydin uyğunlaşdırılması (sənəd verilməzdən əvvəl) | `personal_administrative_number`, `birthdate`, `given_name`, `family_name` | Qurumun sənəd vermə xidməti yalnız qeydiyyatdakı əhatə dairəsi ilə və tam yoxlama xəttindən keçirərək qəbul edir; uyğunlaşdırma açarlarını saxlamır və loglamır (RB-RP-ID-01) |
| "Etibarlı Tamga şəxsiyyəti varmı" | heç biri | İstinad siyasəti `event-tamga-id` |
| Veb sayta qeydiyyat və giriş ("Tamga ilə daxil ol") | qeydiyyatda `given_name`, `family_name`; girişdə heç biri | Hesab açarı hər sayt üçün ayrıca psevdonimdir; `document_number_hash` və şəxsiyyət nömrəsi tələb olunmur (RB-RP-13) |
| Yüksək riskli əməliyyat | əhatə dairəsinə görə | Üz uyğunlaşdırması lazımdırsa, bu, yoxlayan tərəfin məsuliyyətidir; sənəd portret daşımır (RB-RP-11) |
| Sürücülük vəsiqəsi kateqoriyası məlumatı | `driving_privileges` və lazım olanlar | Rəsmi yoxlama və rəsmi əməliyyatlarda istifadə olunmur; ekranda "rəsmi sürücülük vəsiqəsini əvəz etmir" yazılır (§4.8) |

**PID tələbi (ARB_27).** Bu növləri qəbul edən yoxlayan tərəfin əlavə olaraq PID tələb etməsi lazım deyil. Dövlət PID-i tətbiq olunduqda qurumların
şəxsi uyğunlaşdırmaq üçün PID-i də qəbul etməsi ayrıca qərarla açılır.

## 4.2 Sənəd vermə siyasəti

| Şərt | Şəxsiyyət sənədi, ZK nüsxəsi, psevdonim toxumu | Sürücülük vəsiqəsi məlumatı |
|---|---|---|
| Sənədi verən qurum | Yalnız şəxsiyyət xidməti (`id.tamga.network`); qurumlar bu növləri verə bilməz | eyni |
| Kateqoriya · sinif | `IDENTITY` · `EAA` · I2 ([[ADR-0022]]) | eyni |
| Növ səlahiyyəti | Yalnız şəxsiyyət xidmətinin qeydiyyatında (icazə siyahısı) | eyni |
| Açar | Şəxsiyyət xidmətinin sənəd imza açarı; ləğv siyahısı açarı ayrıdır (RB-AP-03) | eyni |
| İlkin şərt | Şəxsiyyətin doğrulanması (§4.3); ZK nüsxəsi və toxum yalnız şəxsiyyət sənədi ilə birlikdə və ya onun yeniləmə tokeni ilə | Rəqəmsal cüzdandakı **aktiv Tamga şəxsiyyət sənədi** təqdim olunur (ad, soyad, doğum tarixi); kartdakı ad və doğum tarixi onunla uyğun gəlməlidir (RB-AP-ID-09) |
| Nüsxələr | Şəxsiyyət sənədi 10 nüsxə, hər biri ayrı cihaz açarına; hər yoxlayan tərəf üçün ayrı nüsxə (ARF metod D). ZK nüsxəsi kiçik paketlər şəklində (ən çoxu 3) | 10 nüsxə |
| Rəqəmsal cüzdan | Sənəd verilməzdən əvvəl cüzdan instansiyası sübutu (WIA) və açar sübutu (KA) `wallet_providers[]` siyahısına əsasən yoxlanılır (RB-AP-10) | eyni |
| Tətbiq mağazası yoxlaması | Ayrıca test imzalayıcısı `tamga-id-review` (I1; `verification_method: review-demo`, ən çoxu 7 gün); yalnız birdəfəlik yoxlama kodu ilə; I2 tələb edən heç bir siyasətdə keçərli deyil | — |
| Daxili açıqlama siyasəti | Daşımır ([[ADR-0046]] K1) | Daşımır |

## 4.3 Rəqəmsal sənəd verilməzdən əvvəl şəxsiyyətin yoxlanılması (yoxlayan tərəf — sənədi verən qurum)

| Yol | Səviyyə | Qeyd |
|---|---|---|
| Məsafədən: sənəd, canlılıq yoxlaması və üz uyğunlaşdırması | **T2** (ETSI TS 119 461 Substantial) | `verification_method: remote-document-liveness-face` |
| Məsafədən və NFC çip | T2; `document_chip_verified: true` | Texniki cəhətdən yüksəkdir; hüquqi baxımdan T3 kvalifikasiyalı elektron imzadır |
| Üz-üzə | T2 | `in-person` |

Qaydalar: şəxsiyyətin doğrulanması yalnız şəxsiyyət xidmətində aparılır; qurum [[t:issuer|sənədi verənləri]], rəqəmsal cüzdan və yoxlayan tərəflər məsafədən
şəxsiyyət doğrulama provayderi ilə əlaqə qurmur (RB-AP-ID-01). Doğrulama başlamazdan əvvəl **məlumatlandırma mətni göstərilir və açıq razılıq alınır**
(RB-AP-ID-02). Provayderin qərarı həmişə provayderin qərar son nöqtəsindən təsdiqlənir; bildiriş (webhook) yalnız işə salıcıdır.
Provayderdə fasilə səviyyəni aşağı salmır, sənəd vermə dayanır. Səviyyə sənədə yazılmır (RB-AP-14).

**Yaş həddi yoxdur** ([[ADR-0043]]): şəxsiyyət rəqəmsal sənədi üçün minimum yaş tələb olunmur; şərt yoxlayan tərəfin etibarlı şəxsiyyət sənədi ilə
şəxsiyyəti yoxlamasıdır. Uşaqlar üçün valideyn razılığı axını hüquqi araşdırmadan sonra ayrıca qərarla həll ediləcək.

## 4.4 Məlumatların qorunması

- Tamga bu məlumatlar üçün **məlumat nəzarətçisidir**.
- Rəqəmsal sənəd verildikdən sonra şəxsi sahələr saxlanılmır; daimi qeyd yalnız qeyri-şəffaf `subject_ref`, sənəd nömrəsinin heşi, müddət və ləğv
  siyahısındakı mövqelərdir. Sənədin təsviri, selfi, video və OCR xam məlumatları Tamga-da ümumiyyətlə saxlanılmır (RB-AP-ID-03).
- Silinmə tələbi rəqəmsal sənədi ləğv edir.
- Eyni sənəd nömrəsi üçün ikinci aktiv şəxsiyyət rəqəmsal sənədi verilmir; yoxlayan tərəfin təkrar yoxlaması əvvəlkini ləğv edir (RB-AP-ID-05).

## 4.5 Təqdimat və yoxlayan tərəfin öhdəlikləri

- Təqdimat yalnız [[t:OpenID4VP]] və [[t:DCQL]] ilə, imzalanmış sorğu və şifrələnmiş cavabla həyata keçirilir (RB-RP-02); yoxlayan tərəf formatı DCQL ilə
  seçir (məs. brauzerdə yaşın yoxlanılması mdoc üzərindən yalnız `age_over_18`). Yaxın məsafədə ISO/IEC 18013-5 axını istifadə olunur.
- Yoxlama kanonik xətdən keçir: etibar mənbəyinin aktuallığı, sonra imza, sənədi verən qurum, növ səlahiyyəti, ləğv və rəqəmsal cüzdan bağlantısı
  (RB-RP-03). Sənədi verən qurum etibar siyahısında `IDENTITY` kateqoriyasında və bu növ üçün səlahiyyətli görünməlidir.
- Şəxsiyyət nömrəsi tələb edən yoxlayan tərəfin qeydiyyatında bu sahə açıq şəkildə olmalıdır; rəqəmsal cüzdan əhatə dairəsindən kənar sorğu barədə xəbərdarlıq edir.
- Nəticə üç dəyərlidir; `INDETERMINATE` qəbul demək deyil (RB-RP-05).
- ZK nüsxəsi: sübut növü bağladığı üçün yoxlayan tərəf qısa ömrü görür və ləğv yoxlaması gözləmir (`status: NOT_APPLICABLE`, əsaslandırma
  qısa ömürdür). Bu növü daşımayan (işarəsiz) ZK təqdimatı yalnız siyasət bunu açıq şəkildə qəbul edirsə qəbul olunur (RB-AP-ID-11, [[ADR-0044]]).
- **[[t:pseudonym|Psevdonim]] toxumu** heç bir yoxlayan tərəfin əhatə dairəsinə daxil deyil; rəqəmsal cüzdan ondan hər sayt üçün ayrıca psevdonim törədir (RB-AP-ID-07).
- Əməliyyat məlumatları (ARF Topic 20, ödəniş) bu növlərdə müəyyən edilməyib.

## 4.6 Aİ PID və mDL ilə əlaqə

Tamga yoxlayan tərəfləri Aİ-nin şəxsiyyət sənədini (PID) və ISO sürücülük vəsiqəsini ([[t:mDL]]) **xarici növ** kimi tanıyır:

| Növ | Format |
|---|---|
| `urn:eudi:pid:1` | SD-JWT VC |
| `eu.europa.ec.eudi.pid.1` | mdoc |
| `org.iso.18013.5.1.mDL` | mdoc |

- **Tanınma şərti.** Xarici növ yalnız sənədi verən qurum bu növə zəmanət verən xarici siyahının (Əlavə A §6.1) əhatəsindədirsə qəbul edilir.
  Bu gün siyahılar siyahısında xarici siyahı yoxdur; hər xarici siyahı ayrıca qərarla əlavə olunur.
- **İç-içə [[t:selective-disclosure]].** Aİ PID-də ünvan obyektdir, vətəndaşlıqlar isə massivdir. Şəxs yalnız lazım olanı aça bilər:
  məsələn, ünvanın yalnız şəhərini və ya vətəndaşlıqlardan birini. Yoxlayan tərəfin əhatə yoxlaması sahənin özünə və ya üst sahəsinə görə
  aparılır.
- **Yaş.** Aİ PID-də yaş sahəsi yoxdur; Aİ-də yaş üçün ayrıca yaş təsdiqi sənədi istifadə olunur. mDL-də `age_over_18` kimi yaş elementləri
  var. Tamga şəxsiyyət sənədi eyni `age_over_NN` nümunəsini izləyir; hədd çoxluğu qapalıdır: bu gün 15 və 18 ([[ADR-0064]]).

| Tamga şəxsiyyət rəqəmsal sənədi (SD-JWT VC) | Tamga şəxsiyyət rəqəmsal sənədi (mdoc, `tamga.id.1`) | Aİ PID (SD-JWT VC) | Aİ PID (mdoc) |
|---|---|---|---|
| `given_name` | `given_name` | `given_name` | `given_name` |
| `family_name` | `family_name` | `family_name` | `family_name` |
| `birthdate` | `birth_date` (full-date) | `birthdate` | `birth_date` (full-date) |
| `nationalities` (massiv) | `nationality` (massiv) | `nationalities` (massiv) | `nationality` (massiv) |
| `personal_administrative_number` | `personal_administrative_number` | `personal_administrative_number` | `personal_administrative_number` |
| `issuing_country` (rəqəmsal sənədi verən ölkə) | `issuing_country` | `issuing_country` (PID provayderinin ölkəsi) | `issuing_country` |
| `age_over_18` | `age_over_18` | — (yoxlayan tərəf üçün ayrıca yaş təsdiqi rəqəmsal sənədi) | — |
| `age_over_15` | `age_over_15` | — (yoxlayan tərəf üçün ayrıca yaş təsdiqi rəqəmsal sənədi) | — |
| `document_type`, `document_number_hash`, `document_chip_verified`, `verification_method` | eyni | qarşılığı yoxdur (Tamga-ya xasdır) | qarşılığı yoxdur |

> **`issuing_country` (2026-10-11, layihə rəhbərliyinin qərarı).** Sahənin mənası Aİ PID-dəki mənadır: sənədi verən şəxsiyyət
> provayderinin ölkəsi (İcra Reqlamenti (Aİ) 2026/1731). Bu gün sənədi Tamga-nın şəxsiyyət xidməti skan edilmiş şəxsiyyət sənədinə
> əsaslanaraq özü verdiyi üçün dəyər **skan edilmiş şəxsiyyət sənədini verən ölkəni** əks etdirir. Dövlətin PID provayderi PID verdikdə
> sahə Aİ mənasını daşıyır və sənədlər sahəni Aİ-nin tərifi ilə izah edir. Kod və sxem bu gün dəyişmir.

## 4.7 Ötürmə — dövlət PID provayderi

Dövlət PID provayderi təyin etdikdə: şəxsiyyət xidmətinin qeydi `successor_id` ilə ötürülür, yeni sənəd verilmir; verilmiş sənədlər
müddəti bitənədək etibarlı qalır (RB-AP-ID-06). Yoxlayan tərəf siyasətləri dövlət PID-ini üstün tutacaq şəkildə yenilənir; bu növ
`DEPRECATED` olur, lakin yoxlanıla bilən qalır.

## 4.8 Sürücülük vəsiqəsi məlumatları rəqəmsal sənədi — əlavə qaydalar

Şəxsin fiziki sürücülük vəsiqəsi kartı məsafədən yoxlanılır (sənəd + canlılıq + üz uyğunlaşdırması) və kartdakı kateqoriyalar və tarixlər
rəqəmsal sənəd kimi verilir ([[ADR-0039]]). **Rəsmi sürücülük vəsiqəsi deyil, mDL deyil;** yol hərəkəti nəzarətində və rəsmi işlərdə
istifadə olunmur. Sənəd bunu həmişə açıq `not_official_licence` sahəsi, görünən adı ("Sürücülük vəsiqəsi məlumatı — rəsmi sürücülük
vəsiqəsini əvəz etmir") və kartı ilə bildirir; yoxlayan tərəfin ekranları eyni ifadəni göstərir (RB-AP-ID-08).

| Mövzu | Qayda |
|---|---|
| Uyğunluq | Kartdakı ad və doğum tarixi şəxsiyyət sənədi ilə uyğun gəlmirsə, kart sürücülük vəsiqəsi deyilsə, müddəti keçibsə və ya kateqoriyalar oxuna bilmirsə, sənəd verilmir (RB-AP-ID-09) |
| Yoxdur | Milli şəxsiyyət nömrəsi, məhdudiyyət və sağlamlıq kodları (12-ci sahə; `has_restrictions` faktı da yoxdur), foto, imza, ünvan; provayderin qeyd sahələri oxunmur |
| Məlumatların qorunması | Tamga məlumat nəzarətçisidir; məlumatlandırma və açıq razılıq sürücülük vəsiqəsinə xasdır; fərdi sahələr verildikdən sonra saxlanılmır; provayderə ad və doğum tarixi göndərilmir, uyğunlaşdırma şəxsiyyət xidmətində açarlı heş ilə aparılır |
| Səlahiyyətli orqan | Ölkənin səlahiyyətli orqanı rəqəmsal sürücülük vəsiqəsi verməyə başladıqda Tamga həmin ölkə üçün bu növü yenidən vermir; qeyd `successor` ilə rəsmi növə işarə edir (RB-AP-ID-10) |
| Hüquq | Fiziki şəxslərə verilmə açılmazdan əvvəl hüquqi yoxlama; sandbox bunu gözləmir |

## 4.9 Cihaza bağlılıq

Dörd növün hamısı **cihaza bağlıdır** (ARB_34): hər nüsxə rəqəmsal cüzdanın təhlükəsiz aparatdakı ayrıca açarına bağlanır (`cnf` /
`deviceKeyInfo`; RB-AP-09, RB-WP-01). `cryptographically_bound_to` atributu istifadə olunmur: sürücülük vəsiqəsi məlumatının şəxsiyyət sənədinə
bağlılığı sənədin verilməsi anındakı təqdimatla qurulur və ləğvlə davam etdirilir (§6.2), sənəddə kriptoqrafik bağ yoxdur.

---

# 5. Etibar lövbərləri

Bu növlər kvalifikasiyalı olmayan EAA-dır; etibar lövbəri Aİ-nin etibarlı siyahısından deyil, Tamga-nın imzalı etibar siyahılarından götürülür
(ARB_26):

1. Yoxlayan tərəf siyahılar siyahısını (`https://trust.tamga.network/lotl.jws`) və milli siyahını (`tl-tr.jws`) əvvəlcədən yükləyir və
   onların imzalarını kök sertifikatlara görə yoxlayır. Kök barmaq izləri `tamga.network/trust-anchor` səhifəsində, `keys/root-fingerprints.json`-da
   və Trust Framework-də eyni dəyərlərlə dərc olunur (RB-OP-06).
2. Sənədin `x5c` zənciri (mdoc-da `x5chain`) milli kökə zəncirlənir; `issuer_id` yarpaq sertifikatın barmaq izindən törədilir,
   `iss`-dən deyil (RB-AP-01, RB-RP-04).
3. `tl-tr › issuers[]` qeydi sənədi verən qurumu, onun kateqoriyasını (`IDENTITY`), sinfini və bu növ üzrə zaman pəncərəli səlahiyyətini verir; yoxlama
   sənədin verildiyi ana (`iat`) görə aparılır (RB-RP-03).
4. Növ `lotl › schemas[]` qeydi və katalogdakı `content_hash` (= `vct#integrity`) ilə yoxlanılır.

Rəqəmsal cüzdan sənədi qəbul edərkən eyni qeydlə sənədi verən qurumun bu növü verməyə səlahiyyətli olduğunu yoxlayır. Xarici növlərin (§4.6) etibar lövbəri
yalnız xarici siyahıdan gəlir.

---

# 6. Etibarlılıq və ləğv

## 6.1 Etibarlılıq siyasəti

| Növ | Etibarlılıq |
|---|---|
| Şəxsiyyət sənədi | `exp` = verildiyi an + 730 gün (ən çoxu 2 il); müddəti bitdikdə yenidən yoxlama |
| ZK nüsxəsi | Ən çoxu 24 saat və əsas sənədin bitmə vaxtını keçmir (RB-AP-ID-11) |
| Psevdonim toxumu | 730 gün; şəxsiyyət sənədi ilə birlikdə yenilənir |
| Sürücülük vəsiqəsi məlumatı | `exp` = kartın bitmə tarixi ilə yoxlamadan 1 il sonrakı tarixdən hansı daha tezdirsə; avtomatik yeniləmə müddəti uzatmır (RB-AP-ID-09) |
| Sınaq sənədi (`review-demo`) | Ən çoxu 7 gün |

## 6.2 Ləğv

| Növ | Ləğv edilə bilərmi | Mexanizm |
|---|---|---|
| Şəxsiyyət sənədi | **Bəli, məcburi** | Token Status List (Aİ-nin Attestation Status List-i); mdoc və SD-JWT nüsxələri eyni biti daşıyır (mdoc nüsxəsi siyahının CWT təqdimatını oxuyur) |
| ZK nüsxəsi | Xeyr — qısa ömür ləğvi əvəz edir (ARF VCR_01); əsas sənəd ləğv edilibsə, yeni nüsxə verilmir, ləğv ZK təqdimatında ən geci 24 saata qüvvəyə minir | — |
| Psevdonim toxumu | Ləğv siyahısı yoxdur; təqdim olunmur | — |
| Sürücülük vəsiqəsi məlumatı | **Bəli, məcburi** | Token Status List |

- **Ləğv siyahısının ünvanı (ARB_24a):** hər sənəddə `status.status_list.uri`; şəxsiyyət xidmətinin siyahıları `https://status.tamga.network/`
  altındadır. Ünvan qeyri-şəffafdır, qurumu, ili və ya qrupu kodlaşdırmır (RB-AP-18).
- **Dərc:** sabit intervalla (bu gün 2 dəqiqə), dəyişiklik olmasa belə; siyahı 6 saat etibarlıdır; interval xaricində dərc yoxdur (RB-AP-17,
  [[SPEC-CRED-0003]] §5). Ləğv bir neçə dəqiqəyə qüvvəyə minir (RB-GEN-10).
- **Dəyərlər:** `bits = 1` — etibarlı və ya ləğv edilmiş. Şəxsiyyət xidmətinin növlərində **dayandırma yoxdur**, ləğv daimidir (Aİ PID qaydası;
  RB-AP-ID-13, [[ADR-0048]] K1). Paketlərin 0.6.0 versiyasınadək siyahılar `bits = 2` formatında dərc olunur, lakin dayandırma dəyəri yazılmır.
- **Ləğv şərtləri:** Ləğv Siyasətindədir ([[FW-POL-0001]] §3). Şəxsiyyət sənədi üçün: şəxsin silinmə tələbi, eyni sənədlə yenidən
  yoxlama, sənədin itdiyi və ya oğurlandığı barədə bildiriş, səhv sənəd, razılığın geri götürülməsi. Sürücülük vəsiqəsi məlumatı üçün əlavə olaraq:
  eyni kartla yenidən yoxlama, cüzdan vahidinin ləğvi və bağlı şəxsiyyət sənədinin ləğvi, yenidən verilməsi və ya silinməsi (zəncirvari;
  RB-AP-ID-10).
- **Attestation Revocation List** (Aİ-nin ikinci mexanizmi) bu gün dərc olunmur (§7.2).

---

# 7. Uyğunluq

## 7.1 Aİ çərçivəsi ilə əlaqə

- Bu rulebook Aİ Attestation Rulebook şablonunun (1.5) bölmə strukturunu izləyir (ARB_29). Şablonun Topic 12 tələbləri ilə uyğunlaşdırma Tamga
  Rulebook §11-dədir.
- Şəxsiyyət sənədi Aİ PID-inin atribut adlarını və kodlaşdırmasını istifadə edir (İcra Reqlamenti (Aİ) 2026/1731; [[ADR-0045]]), lakin PID deyil;
  PID Rulebook-un PID provayderinə xas tələbləri (növ `eu.europa.ec.eudi.pid.1`, `urn:eudi:pid:` ad sahəsi, portret) tətbiq edilmir.
- Sürücülük vəsiqəsi məlumatı Aİ mDL Rulebook-unun əhatəsinə daxil deyil: rəsmi mDL yalnız ISO/IEC 18013-5 və rəsmi ad sahəsi ilə verilir;
  Tamga bu ad sahəsindən istifadə etmir (RB-AP-ID-08).
- Bu növlər Tamga Rulebook-un bütün qaydalarını miras alır; növə xas qaydalar RB-AP-ID-01…13 və RB-RP-ID-01-dədir.

## 7.2 Məlum fərqlər və qərar gözləyən məsələlər

| Mövzu | Vəziyyət |
|---|---|
| Kvalifikasiyalı olmayan EAA göstəricisi (ARB_12) | **Qərar (2026-10-12, [[ADR-0047]] K6):** Aİ şablonu `category` üçün `eaa:eu:non-qualified` dəyərini təklif edir; ETSI TS 119 472-1 V1.2.1 EAA-5.2.2.1-01 isə kvalifikasiyalı olmayan EAA-da `category` olmamasını tələb edir. Tamga ETSI-ni izləyir; şablonun dəyəri istifadə olunmur |
| Etibar lövbərinin yeri sənəddə (ARB_21) | **Qərar (2026-10-12, [[ADR-0047]] K7):** sənədə yer sahəsi əlavə edilmir; yer §5-dəki siyahılardır. Sənəddəki yer sənədi verən qurumun öz bəyanatı olardı; yoxlayan tərəf lövbəri yalnız özünün seçdiyi, imzası sabitlənmiş siyahıdan götürür |
| `nbf` (ETSI TS 119 472-1 texniki etibarlılığın başlanğıcı) | Bu gün yazılmır; etibarlılığın başlanğıcı `iat`-dır. Əlavə edilməsi icra işidir |
| Attestation Revocation List | Tamga-nın sənədi verən qurumları Status List dərc edir (Aİ VCR_11-ə görə biri kifayətdir); yoxlayan tərəf və rəqəmsal cüzdan nüvəsi identifikator siyahısını da yoxlayır (paketlər 0.5.0; [[FW-POL-0001]] §8) |

---

# 8. Mənbələr

Aİ Attestation Rulebook şablonu və PID / mDL rulebook-ları (Aİ attestation rulebook kataloqu), ARF Annex 2 Topic 7, 10 və 12,
İcra Reqlamenti (Aİ) 2026/1731, ETSI TS 119 472-1, ISO/IEC 18013-5, SD-JWT VC, HAIP 1.0, IETF Token Status List. Bu sənədin
əsaslandığı Tamga qərarları və spesifikasiyaları Əlavə E-də sadalanır.

# Status

**Qüvvədədir** — versiya 1.0.0 (2026-10-16).
