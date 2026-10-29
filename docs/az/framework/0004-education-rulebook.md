---
document_id: FW-RB-0002
title: "Education Rulebook"
status: Active
version: 1.0.0
created: 2026-09-24
last_updated: 2026-10-16
summary: >
  Təhsil sahəsindəki iki ümumi rəqəmsal sənəd növünün (tələbə sənədi, diplom) rulebook-u, Aİ Attestation Rulebook şablonunun bölmə strukturu ilə: atributlar və metaməlumatlar, hüquqi kateqoriya, SD-JWT VC kodlaşdırması və seçici paylaşım, istifadə və sənəd vermə şərtləri, autentifikasiya səviyyəsi, yoxlama siyasətləri, etibar lövbərləri, etibarlılıq və ləğv, semantik əsas (ELM v3 / ISCED-F / EQF) və Aİ ilə uyğunluq. Tamga Rulebook-dan ([[FW-RB-0001]]) törəyir; texniki sxem SPEC-SCHEMA-0002 sənədindədir.
translation_of: FW-RB-0002
source_version: "1.0.0"
---

| Versiya | Tarix | Təsvir |
|---|---|---|
| 1.0.0 | 2026-10-16 | Tamga ARF 1.0-ın aktual mətni; Aİ Attestation Rulebook şablonunun (versiya 1.5) bölmə strukturunda. |

**Sxemin sahibi:** Tamga Network. Tamga Network (yaradılacaq fond) adından müvəqqəti operator: BROS İNŞAAT SANAYİ VE DIŞ TİCARET LİMİTED ŞİRKETİ. **Rəy:** <https://github.com/tamga-network/tamga-network/issues>

---

# 1. Giriş

## 1.1 Əhatə dairəsi və məqsəd

Bu [[t:rulebook]] iki rəqəmsal sənəd növünü əhatə edir:

| Növ | `vct` | Kataloq |
|---|---|---|
| Tələbə sənədi | `urn:tamga:edu:StudentCredential:1` | `schemas.tamga.network/v1/edu/StudentCredential/1.0.0` |
| Diplom | `urn:tamga:edu:DiplomaCredential:1` | `schemas.tamga.network/v1/edu/DiplomaCredential/1.0.0` |

Hər ikisi `urn:tamga:core:TamgaBaseCredential:1` kök növünü genişləndirir. **Məqsəd:** ali təhsil müəssisəsinin tələbəlik və məzun olma
məlumatını şəxsin rəqəmsal cüzdanına seçici paylaşımlı və yoxlanıla bilən rəqəmsal sənəd kimi verməsidir; işəgötürən, endirim edən tərəf və ya kampus
qapısı yalnız lazım olan sahəni görür.

Aİ baxımından bu sənədlər kvalifikasiyalı olmayan **[[t:EAA]]** sayılır; Tamga sinfi [[t:issuer|sənədi verən qurumun]] qeydiyyatına əsasən EAA, kvalifikasiyalı və ya dövlət sinfidir.
Texniki tərif (JSON Schema, növ tərifi, ELM uyğunlaşdırması) **[[SPEC-SCHEMA-0002]]** sənədindədir; ziddiyyət olduqda həmin sənəd üstünlük təşkil edir.

## 1.2 Sənədin strukturu

Bölmə 2 atributları və metaməlumatları formatdan asılı olmayaraq müəyyən edir; Bölmə 3 kodlaşdırmanı; Bölmə 4 istifadəni, sənəd vermə şərtlərini
və yoxlama siyasətlərini; Bölmə 5 etibar lövbərlərini; Bölmə 6 etibarlılığı və ləğvi; Bölmə 7 Aİ ilə uyğunluğu və qərar gözləyən
məqamları; Bölmə 8 semantik əsası və versiyalaşdırmanı.

## 1.3 Açar sözlər

**MUST**, **MUST NOT**, **SHOULD** və **MAY** RFC 2119 mənasındadır (Tamga Rulebook §0).

## 1.4 Terminlər

Terminlər Əlavə D-dədir; Aİ terminləri ARF Annex 1-dəki mənadadır.

---

# 2. Atributlar və metaməlumatlar

## 2.0 Aİ tələbləri və bu sənəddəki qarşılıqları

| Tələb | Qarşılıq |
|---|---|
| EAA olduğunun göstəricisi (ARB_12) | §2.1 — kvalifikasiyalı və ya dövlət sinfindəki sənədi verən qurumda `category`; kvalifikasiyalı olmayan EAA-da `category` yazılmır və şablonun `eaa:eu:non-qualified` dəyəri istifadə olunmur (ETSI TS 119 472-1 V1.2.1 EAA-5.2.2.1-01; [[ADR-0047]] K6) |
| Sənədi verən qurumun kimliyi, Əlavə V b (ARB_15) | `iss` və imza başlığındakı `x5c` son (leaf) sertifikatı; həmçinin `awarding_body_name`, `awarding_body_id`, `awarding_body_country` |
| Subyektin şəxsiyyəti, Əlavə V c (ARB_17) | `family_name`, `given_name`, `birth_date`; milli şəxsiyyət nömrəsi qəsdən daxil edilmir (RB-SCH-04) |
| Etibarlılığın başlanğıcı və sonu, Əlavə V e (ARB_19) | `iat`, `exp`; diplomda `exp` yoxdur (müddətsiz sənəd) |
| Etibar lövbərinin yeri, Əlavə V h (ARB_21) | Sənəddə ayrıca sahə yoxdur və əlavə edilmir; yer sənədi verən qurumun sertifikat zənciri və Tamga etibar siyahılarıdır, etibar lövbərlərinin yeganə mənbəyi siyahılardır (§5; [[ADR-0047]] K7) |

## 2.1 Giriş və hüquqi kateqoriya

Sahələr Avropa Öyrənmə Modeli (ELM v3) və Europass ilə uyğunlaşdırılır (§8); şəxsi sahələr seçici paylaşımlıdır. **Qadağandır:** milli şəxsiyyət
nömrəsi (TCKN və s.) heç bir sahədə yer almır; foto sahəsi yoxdur (üz uyğunlaşdırması şəxsiyyət sənədi və ya [[t:PID]] ilə aparılır).

**Hüquqi kateqoriya (`category`).** Aİ şablonundakı (1.5) və ETSI TS 119 472-1-dəki `category` atributu (ARF mətnində köhnə adı
`attestation_legal_category`, ARB_25) Tamga-da öz dəyərləri ilə istifadə olunur: `urn:tamga:eaa:qualified` və ya `urn:tamga:eaa:pub`.
Sənədi verən qurum bu sahəni **MUST** yalnız qeydiyyat sinfi kvalifikasiyalı və ya dövlət olduqda və qeydiyyatdakı dəyərlə yazsın; I1–I2 sinfində isə **MUST
NOT** (RB-AP-14). Kvalifikasiyalı olmayan EAA-da sahənin olmaması ETSI TS 119 472-1 (EAA-5.2.2.1-01) qaydasına uyğun göstəricidir.

## 2.2 Məcburi atributlar

| Məlumat identifikatoru | Tərif | Məlumat növü | Nümunə dəyər | Tələbə | Diplom |
|---|---|---|---|---|---|
| `family_name` | Soyad | mətn (1–200) | `Yılmaz` | ✓ | ✓ |
| `given_name` | Ad | mətn (1–200) | `Ayşe` | ✓ | ✓ |
| `birth_date` | Doğum tarixi | tarix (YYYY-MM-DD) | `2001-03-09` | ✓ | ✓ |
| `awarding_body_name` | Qurumun rəsmi adı | çoxdilli mətn | `{"tr-TR":"Örnek Üniversitesi"}` | ✓ | ✓ |
| `awarding_body_id` | Qurum identifikatoru (ELM; `issuer_id` deyil) | mətn (1–64) | `TR-ORNEK-UNI` | ✓ | ✓ |
| `awarding_body_country` | Qurumun ölkəsi | ISO 3166-1 alpha-2 | `TR` | ✓ | ✓ |
| `isced_f_code` | Sahə kodu (ISCED-F 2013, 2–4 rəqəm) | mətn | `0613` | ✓ | ✓ |
| `student_status` | Qeydiyyat statusu; məzun dəyərini daxil etmir | `ACTIVE` \| `ON_LEAVE` | `ACTIVE` | ✓ | — |
| `enrollment_year` | Qeydiyyat ili | tam ədəd | `2022` | ✓ | — |
| `study_level` | Səviyyə (EQF 5–8) | tam ədəd | `6` | ✓ | — |
| `programme_title` | Proqramın adı | çoxdilli mətn | `{"tr-TR":"Bilgisayar Mühendisliği"}` | ✓ | — |
| `is_enrolled` | Törəmə: qeydiyyatda olan tələbə (`true`) | boolean | `true` | ✓ | — |
| `qualification_title` | Kvalifikasiyanın adı | çoxdilli mətn | `{"tr-TR":"Lisans"}` | — | ✓ |
| `eqf_level` | Avropa Kvalifikasiyalar Çərçivəsi səviyyəsi (5–8) | tam ədəd | `6` | — | ✓ |
| `awarding_date` | Məzun olma tarixi | tarix | `2026-06-30` | — | ✓ |
| `is_graduate` | Törəmə, sabit `true` | sabit `true` | `true` | — | ✓ |

## 2.3 İxtiyari atributlar

| Məlumat identifikatoru | Tərif | Məlumat növü | Nümunə dəyər | Tələbə | Diplom |
|---|---|---|---|---|---|
| `faculty_name` | Fakültə | çoxdilli mətn | `{"tr-TR":"Mühendislik Fakültesi"}` | ✓ | — |
| `expected_graduation_year` | Gözlənilən məzun olma ili | tam ədəd | `2026` | ✓ | — |
| `enrollment_date` | Qeydiyyat tarixi | tarix | `2022-09-19` | ✓ | — |
| `credit_points` | ECTS krediti | ədəd (0–1000) | `240` | ✓ | ✓ |
| `nqf_level` | Milli kvalifikasiya səviyyəsi (TYÇ) | mətn (≤ 16) | `6` | — | ✓ |
| `mode_of_study` | Təhsil forması | `FULL_TIME` \| `PART_TIME` \| `DISTANCE` \| `BLENDED` | `FULL_TIME` | — | ✓ |
| `grade` | Qiymət | mətn (≤ 32) | `3.41` | — | ✓ |
| `grading_scheme` | Qiymətləndirmə sistemi | çoxdilli mətn | `{"tr-TR":"4'lük sistem"}` | — | ✓ |
| `thesis_title` | Dissertasiyanın adı | çoxdilli mətn | `{"tr-TR":"…"}` | — | ✓ |
| `graduated_before` | Törəmə: bu ildən əvvəl məzun olub | tam ədəd | `2027` | — | ✓ |

## 2.4 Şərti atributlar

Yoxdur.

## 2.5 Məcburi metaməlumatlar

| Məlumat identifikatoru | Tərif | Məlumat növü | Nümunə dəyər | Tələbə | Diplom |
|---|---|---|---|---|---|
| `iss` | Sənədi verən qurumun ünvanı | URI | `https://issuer.tamga.network/ornek-uni` | ✓ | ✓ |
| `vct`, `vct#integrity` | Növ və növ tərifinin həşi | URN, `sha256-…` | `urn:tamga:edu:DiplomaCredential:1` | ✓ | ✓ |
| `iat` | Verilmə anı | NumericDate | `1782777600` | ✓ | ✓ |
| `cnf` | Rəqəmsal cüzdanın cihaz açarı | JWK | — | ✓ | ✓ |
| `exp` | Etibarlılığın sonu; `exp − iat` ≤ 90 gün | NumericDate | `1790553600` | ✓ | — |
| `status` | Ləğv siyahısına istinad `status_list {idx, uri}` | obyekt | `{"status_list":{"idx":9921,"uri":"https://status.tamga.network/2b8e01d4"}}` | — | ✓ |

## 2.6 İxtiyari metaməlumatlar

Yoxdur. Tələbə sənədində `status`, diplomda isə `exp` **yoxdur** (§6).

## 2.7 Şərti metaməlumatlar

| Məlumat identifikatoru | Şərt | Məlumat növü | Nümunə dəyər |
|---|---|---|---|
| `category` | Yalnız qeydiyyat sinfi kvalifikasiyalı və ya dövlət olan sənədi verən qurumda, qeydiyyatdakı dəyərlə (§2.1) | `urn:tamga:eaa:qualified` \| `urn:tamga:eaa:pub` | `urn:tamga:eaa:pub` |

---

# 3. Kodlaşdırma

## 3.1 ISO/IEC 18013-5 (mdoc)

**Yaxın məsafə təhlili (ARB_02).** Təhsil sənədlərinin internetsiz, üzbəüz təqdim edilməsinə hazırda ehtiyac yoxdur: kampusa giriş üçün
giriş kartı istifadə olunur ([[ADR-0012]]); məzun olmanın təsdiqi onlayn həyata keçirilir. Buna görə bu növlər mdoc kimi verilmir. ISO/IEC 18013-5
yaxın məsafə axını kampus istifadəsinə açıldıqda bu təhlil yenilənir.

## 3.2 SD-JWT VC

Rəqəmsal sənədlər [[t:SD-JWT-VC]] kimi, HAIP 1.0-ın SD-JWT VC profilinə uyğun verilir (ARB_01b): başlıqda `alg` ES256, `typ`
`dc+sd-jwt`, `x5c`; `_sd_alg` sha-256. `vct` şəbəkədə unikaldır (ARB_05); növ tərifi kataloqdan gəlir, `vct#integrity` məcburidir
(RB-SCH-01). "Seçici paylaşım" sütunu Type Metadata-dakı `sd` dəyəridir: **MUST** = `always`, **MAY** = `allowed`, **MUST NOT** =
`never` (ARB_30). İstinad sənəd vermə xidməti `allowed` sahələrini də ayrıca açıqlama kimi verir.

| Məlumat identifikatoru | Claim adı | Kodlaşdırma | Mənbə / qeyd | Seçici paylaşım |
|---|---|---|---|---|
| `family_name`, `given_name` | eyni | string | OpenID Connect Core §5.1 (IANA) | MUST |
| `birth_date` | `birth_date` | string, YYYY-MM-DD | ELM `dateOfBirth`; Tamga-ya xas ad | MUST |
| `grade`, `thesis_title` | eyni | string / çoxdilli obyekt | Tamga-ya xas (ELM uyğunlaşdırması) | MUST |
| `awarding_body_name`, `awarding_body_id`, `awarding_body_country` | eyni | çoxdilli obyekt / string | Tamga-ya xas (ELM uyğunlaşdırması) | MAY |
| Tələbə: `student_status`, `enrollment_year`, `study_level`, `programme_title`, `isced_f_code`, `faculty_name`, `expected_graduation_year`, `credit_points`, `enrollment_date`, `is_enrolled` | eyni | §2-dəki növlər | Tamga-ya xas (ELM uyğunlaşdırması) | MAY |
| Diplom: `qualification_title`, `eqf_level`, `nqf_level`, `isced_f_code`, `awarding_date`, `mode_of_study`, `credit_points`, `grading_scheme`, `is_graduate`, `graduated_before` | eyni | §2-dəki növlər | Tamga-ya xas (ELM uyğunlaşdırması) | MAY |
| `iss`, `vct`, `vct#integrity`, `iat`, `exp`, `cnf`, `status`, `category` | eyni | — | daşıma profili | MUST NOT |

Çoxdilli mətn dil teqindən (`tr-TR`, `en-US` …) mətnə uyğunlaşdıran obyektdir (ən azı bir dil; hər ümumi sxem ən azı `tr-TR` və
`en-US` üzrə göstərmə məlumatı daşıyır, RB-SCH-03).

**Defolt məxfilik.** `grade`, `thesis_title`, `birth_date`, `family_name`, `given_name` şəxs açıq razılıq vermədən açılmır. İşəgötürənin
"məzun olmanın təsdiqi" ssenarisində `is_graduate`, `qualification_title`, `eqf_level`, `isced_f_code`, `awarding_body_name`,
`awarding_date` açılır; `birth_date`, `grade` və `thesis_title` açılmır.

**Nümunə (diplom; JWT claim toplusu, açıqlamalar açılmış şəkildə):**

```json
{
  "iss": "https://issuer.tamga.network/ornek-uni",
  "vct": "urn:tamga:edu:DiplomaCredential:1",
  "vct#integrity": "sha256-…",
  "iat": 1782777600,
  "cnf": { "jwk": { "kty": "EC", "crv": "P-256", "x": "…", "y": "…" } },
  "status": { "status_list": { "idx": 9921, "uri": "https://status.tamga.network/2b8e01d4" } },
  "family_name": "Yılmaz",
  "given_name": "Ayşe",
  "birth_date": "2001-03-09",
  "awarding_body_name": { "tr-TR": "Örnek Üniversitesi", "en-US": "Example University" },
  "awarding_body_id": "TR-ORNEK-UNI",
  "awarding_body_country": "TR",
  "qualification_title": { "tr-TR": "Lisans", "en-US": "Bachelor's degree" },
  "eqf_level": 6,
  "isced_f_code": "0613",
  "awarding_date": "2026-06-30",
  "is_graduate": true
}
```

Kodlaşdırılmış sənəd və açıqlama nümunələri uyğunluq vektorlarındadır (`conformance/vectors/sd-jwt`).

## 3.3 W3C VCDM

İstifadə olunmur: JSON-LD daşıyıcısı istifadə edilmir. Aİ təhsil sahəsində qarşılıqlı uyğunluq üçün ELM JSON-LD ixracı açıq məsələdir
(§7.2).

---

# 4. İstifadə

## 4.1 İstifadə halları

İşə müraciətdə məzun olmanın təsdiqi, tələbə endirimi, kampusa giriş; yüksək riskli əməliyyatlarda (dövlət, bank) şəxsiyyət sənədi ilə
birlikdə. **PID tələb edilməsi (ARB_27):** yoxlayan tərəfin əlavə olaraq PID tələb etməsinə ehtiyac yoxdur; üz uyğunlaşdırması tələb olunan yüksək riskli əməliyyatda
şəxsiyyət sənədi və ya PID yoxlayan tərəfin məsuliyyətindədir (RB-RP-11).

## 4.2 Sənəd vermə siyasəti: kim verir

| Şərt | Tələbə sənədi | Diplom |
|---|---|---|
| Sənədi verən qurumun kateqoriyası | `EDUCATION` | `EDUCATION` |
| Minimum akkreditasiya | I2 (müqaviləli) | I2; **I3 SHOULD** |
| Sənəd növü üzrə səlahiyyət | `schema_authorizations` daxilində bu `vct` (zaman pəncərəli icazə siyahısı) | eyni |
| Hüquqi səlahiyyət | Diplom və tələbə sənədi vermək səlahiyyəti şəbəkədən kənardadır (YÖK); qeydiyyat qurumu bunu **qeydə alır, təsdiqləmir** | eyni |
| Səlahiyyətli mənbə | Qurumun tələbə informasiya sistemi (OBS) və ya onun müqaviləli bağlantısı | eyni |
| Açar | Qurumun nəzarətində; I3-də HSM və ya e-Möhür | eyni |

Qurum özünə səlahiyyət verə bilməz; səlahiyyət qeydiyyat qurumunun qeydi ilə yaranır.

## 4.3 Sənəd kimə verilir

- **Tələbə sənədi:** qeydiyyat statusu `ACTIVE` və ya `ON_LEAVE` olan tələbəyə. Məzun olmuş şəxsə tələbə sənədi verilmir; məzunluq diplom
  növünə aiddir.
- **Diplom:** məzunluq prosesini başa vurmuş şəxsə. Müraciəti şəxsin özü edir; üçüncü şəxs (valideyn, nümayəndə) adından sənəd verilməsi üçün təmsilçilik
  səlahiyyətinin sübutu tələb olunur (RB-AP-12).
- Hər tələbəyə **bir aktiv nüsxə dəsti** (10 nüsxə) düşür; sənəd yenidən verildikdə köhnə dəst ləğv edilir.
- Sənəd verilməzdən əvvəl cüzdan nümunəsinin sübutu (WIA) və açar sübutu (KA) `wallet_providers[]` siyahısına əsasən yoxlanılır (RB-AP-10).

## 4.4 Rəqəmsal sənəd verilməzdən əvvəl şəxsiyyətin yoxlanılması

Səviyyə [[t:credential|sənədə]] yazılmır; növün ilkin şərtidir.

| Növ | Minimum səviyyə | Qəbul edilən yollar |
|---|---|---|
| Tələbə rəqəmsal sənədi | **T1** | e-poçt ilə təklif və SMS ilə əməliyyat kodu; OBS ekranında təklif |
| Diplom | **T2** | OBS-də çoxfaktorlu girişlə təklif; qurumun qeydiyyat masası (üzbəüz); lisenziyalı məsafədən şəxsiyyət yoxlaması |
| Əlavə seçim | T3 | Kvalifikasiyalı elektron imza və ya mobil imza — yalnız avtorizasiya kodu axını ilə və ya üzbəüz; əvvəlcədən avtorizasiya edilmiş axınla **qadağandır** |

Yalnız e-poçt və SMS ilə **diplom verilmir**.

## 4.5 Təqdimat qaydaları

- Yalnız [[t:OpenID4VP]] və [[t:DCQL]]; imzalı sorğu; şifrələnmiş cavab (RB-RP-02).
- Hər [[t:verifier|yoxlayan tərəf]] üçün həmişə eyni nüsxə; eyni yoxlayan tərəf və eyni növ üçün açılan sahələr ardıcıldır (RB-WP-05).
- Yoxlayan tərəfin əhatə dairəsi bu növün sahələrinin alt çoxluğudur; `grade`, `thesis_title` və ya `birth_date` istəyən yoxlayan tərəfə
  qarşı cüzdan **həddən artıq sorğu xəbərdarlığı** göstərir; bu sahələr əhatə dairəsində yoxdursa, sorğu rədd edilir.
- **Daxili açıqlama siyasəti** ([[ADR-0046]]): qurum bu növlərin yalnız müəyyən yoxlayan tərəflərə göstərilməsini istəyirsə, qaydanı
  imzalı təqdimat məlumatında (metadata) dərc edir; qayda sənədə daxil edilmir. Cüzdan qaydanı sənədi alarkən saxlayır, təqdimat zamanı qiymətləndirir;
  qayda ödənilmirsə, ayrıca xəbərdarlıq göstərir, defolt seçim paylaşmamaqdır (RB-AP-26, RB-WP-14).
- Yaxın məsafə: kampusa giriş üçün giriş kartından istifadə olunur; ISO/IEC 18013-5 yaxın məsafə axını əlçatan olduqda ona keçilir (§3.1).
- Əməliyyat məlumatları (ARF Topic 20) bu növlərdə müəyyən edilməyib.

**Nümunə DCQL (məzunluğun təsdiqi):**

```json
{
  "credentials": [
    {
      "id": "diploma",
      "format": "dc+sd-jwt",
      "meta": { "vct_values": ["urn:tamga:edu:DiplomaCredential:1"] },
      "claims": [
        { "path": ["is_graduate"] },
        { "path": ["qualification_title"] },
        { "path": ["eqf_level"] },
        { "path": ["isced_f_code"] },
        { "path": ["awarding_body_name"] },
        { "path": ["awarding_date"] }
      ]
    }
  ]
}
```

## 4.6 Yoxlama siyasəti (yoxlayan tərəfin öhdəlikləri)

Yoxlama spesifikasiyadakı kanonik ardıcıllıqla aparılır (RB-RP-03): etibar mənbəyinin aktuallığı, imza, sənədi verən qurum, növ üzrə səlahiyyət, ləğv, cüzdan
bağlılığı. Növə xas qaydalar:

| Siyasət | Tələb olunur |
|---|---|
| `job-application-degree` (məzunluğun təsdiqi) | `vct = DiplomaCredential:1`; sənədi verən qurum `EDUCATION` kateqoriyasındadır və bu növ üçün səlahiyyətlidir; sinif ən azı I2 (**I3 SHOULD**); ləğv edilməyib; `is_graduate = true`, `eqf_level ≥ 6`; sənəd sahibinin təminat sahəsi yoxdur — diplom növü T2 ilə bağlanıb |
| `student-discount` | `vct = StudentCredential:1`; sənədi verən qurum ən azı I2; müddəti bitməyib; yalnız `is_enrolled = true` |
| `campus-access` | `student-discount` ilə eyni və giriş kartı qeydi; müddətli razılıq ən çoxu 6 ay |
| Yüksək riskli (dövlət, bank) | Yuxarıdakılar və şəxsiyyət sənədi və ya PID ilə üz uyğunlaşdırması (yoxlayan tərəfin məsuliyyəti) |

Siyasət adları istinad yoxlayan tərəfdə olduğu kimidir. Nəticə üç dəyərlidir; `INDETERMINATE` qəbul demək deyil; istifadəçiyə "yoxlanıla bilmədi"
deyilir, "etibarsız" deyilmir.

## 4.7 Cihaza bağlılıq

Hər iki növ **cihaza bağlıdır** (ARB_34): hər nüsxə cüzdanın təhlükəsiz aparat təminatındakı ayrıca açarına bağlanır (`cnf`; RB-AP-09).
`cryptographically_bound_to` istifadə olunmur.

---

# 5. Etibar lövbərləri

Kvalifikasiyalı olmayan EAA üçün etibar lövbəri Tamga-nın imzalı etibar siyahılarından götürülür (ARB_26):

1. Yoxlayan tərəf siyahıların siyahısını (`https://trust.tamga.network/lotl.jws`) və milli siyahını (`tl-tr.jws`) əvvəlcədən yükləyir və
   onların imzalarını kök sertifikatlara əsasən yoxlayır; kök barmaq izləri `tamga.network/trust-anchor` səhifəsində və Trust Framework-də
   eyni dəyərlərlə dərc olunur (RB-OP-06).
2. Sənədin `x5c` zənciri milli kökə bağlanır; `issuer_id` son (yarpaq) sertifikatın barmaq izidir (RB-AP-01, RB-RP-04).
3. `tl-tr › issuers[]` qeydi qurumun kateqoriyasını (`EDUCATION`), sinfini və bu növ üzrə zaman pəncərəli səlahiyyətini verir; yoxlama
   sənədin `iat` dəyərinə əsasən aparılır.
4. Növ `lotl › schemas[]` qeydindən və kataloqdakı `content_hash` dəyərindən (= `vct#integrity`) yoxlanılır.

Cüzdan sənədi alarkən eyni qeyd vasitəsilə qurumun bu növü verməyə səlahiyyətli olduğunu yoxlayır.

---

# 6. Etibarlılıq və ləğv

## 6.1 Etibarlılıq siyasəti

| Mövzu | Tələbə sənədi | Diplom |
|---|---|---|
| Etibarlılıq | Ən çoxu 90 gün; müddəti bitməzdən əvvəl cüzdandakı nüsxələr yeniləmə tokeni ilə avtomatik yenilənir ([[ADR-0023]]), qurum qeydi yenidən oxuyur | Müddətsiz (`exp` yoxdur) |
| Qurumun fəaliyyəti dayandırılıbsa | Yeni sənəd verilmir; mövcud sənədlər müddəti bitənədək etibarlıdır | Yeni sənəd verilmir; köhnə diplomlar verildikləri tarixə görə etibarlıdır |
| Sertifikatın yenilənməsi | Köhnə sənədlər köhnə `issuer_id` qeydi ilə yoxlanılır | eyni |

## 6.2 Ləğv

| Mövzu | Tələbə sənədi | Diplom |
|---|---|---|
| Ləğv edilə bilərmi | Xeyr — qısa ömür (≤ 90 gün) ləğvi əvəz edir; müddəti bitməmiş, lakin artıq düzgün olmayan sənəd qəbul edilmiş riskdir | **Bəli, məcburidir** — Token Status List (Aİ-nin Attestation Status List-i), `status.status_list {uri, idx}` |
| Ləğv şərtləri | — (yenidən verilmir) | Diplomun ləğvi (saxtakarlıq, məhkəmə qərarı), səhv sənəd (yenidən verilməklə), razılığın geri götürülməsi, cihazın təhlükəsizliyinin pozulması barədə bildiriş, şəxsin "sənədiniz bir cüzdana əlavə edildi" bildirişinə etirazı, paylaşım qaydasının dəyişməsi — təfərrüat [[FW-POL-0001]] §3 |
| Dayandırma | — | `SUSPENDED` (2 bitlik dəyər) — araşdırma müddətində; sxem `suspension_allowed: true` daşıyır ([[ADR-0048]] K2) |
| Dərc | — | Sabit interval (hazırda 2 dəqiqə), dəyişiklik olmasa belə; siyahı 6 saat etibarlıdır; təcili dərc yoxdur; ləğv bir neçə dəqiqəyə qüvvəyə minir |
| Siyahı ünvanı (ARB_24a) | — | Sənəddəki `status.status_list.uri`; şəbəkənin yerləşdirdiyi sənəd vermə xidmətində `https://status.tamga.network/` altında, öz xidmətini idarə edən qurumda isə qurumun status serverində; ünvan qeyri-şəffafdır (RB-AP-18) |

---

# 7. Uyğunluq

## 7.1 Aİ çərçivəsi ilə əlaqə

- Bu rulebook Aİ Attestation Rulebook şablonunun (1.5) bölmə strukturunu izləyir (ARB_29); Topic 12 uyğunlaşdırması Tamga Rulebook §11-dədir.
- Sahələr ELM v3 və DC4EU təhsil profilləri ilə uyğunlaşdırılır (ARB_07, ARB_08); uyğunlaşdırma növün təsvirindədir (§8).
- Bu növlər Tamga Rulebook-un bütün qaydalarını miras alır.

## 7.2 Məlum fərqlər və qərar gözləyən məsələlər

| Mövzu | Vəziyyət |
|---|---|
| Diplom üçün I3 akkreditasiyasının məcburi olması | **Təxirə salınmış qərar** ([[ADR-0047]] K9): hazırda minimum I2, I3 **SHOULD**. Tətikləyici (hansı əvvəl baş verərsə): təhsil pilotunun yekun hesabatı, pilot tərəfdaşından başqa ilk qurumun diplom müraciəti və ya hər hansı dövlətin təhsil orqanının şəbəkəyə qoşulması |
| ELM JSON-LD ixracı | Aİ təhsil sahəsində qarşılıqlı fəaliyyət üçün açıq məsələ |
| Etibar lövbərinin yerinin sənəddə göstərilməsi (ARB_21) | **Qərar (2026-10-12, [[ADR-0047]] K7):** sənədə sahə əlavə edilmir; sənəddəki yer sənədi verən qurumun öz bəyanatı olardı və yoxlayan tərəf lövbəri yalnız özünün seçdiyi siyahıdan götürür |
| Kvalifikasiyalı olmayan EAA göstəricisi (ARB_12) | **Qərar (2026-10-12, [[ADR-0047]] K6):** yazılmır; ETSI TS 119 472-1 V1.2.1 EAA-5.2.2.1-01 kvalifikasiyalı olmayan EAA-da `category` olmamasını tələb edir |
| `nbf` və diplomda `exp` | ETSI TS 119 472-1 hər ikisini tələb edir; Tamga hazırda `nbf` yazmır və diplom müddətsizdir |
| Attestation Revocation List | Tamga-da sənədi verən qurumlar Status List dərc edir (Aİ VCR_11-ə görə biri kifayətdir); yoxlayan tərəf və cüzdan nüvəsi identifikator siyahısını da yoxlayır (paketlər 0.5.0; [[FW-POL-0001]] §8) |

---

# 8. Semantik əsas və versiyalaşdırma

- ELM v3 və Europass uyğunlaşdırması normativdir; ISCED-F 2013 (2–4 rəqəmli), EQF 5–8, TYÇ `nqf_level`.
- Proqramın ISCED-F uyğunlaşdırma cədvəlini qurum təqdim edir; qarşılığı yoxdursa, sənəd verilmir (RB-AP-13).
- Növün əsas versiyası URN-dədir (`…:1`); sahə əlavə edilməsi və ya çıxarılması yeni əsas versiya və rulebook-da yeni bölmə deməkdir.
- Kiçik (minor) və yamaq (patch) versiyalar (görüntüləmə, izah) yeni `metadata_url` və `content_hash` ilə, eyni URN altında dərc olunur; kataloq aktual
  versiyanı işarələyir; dərc edilmiş fayl dəyişmir (RB-SCH-02).
- `DEPRECATED` statusundakı növ yoxlanıla bilən qalır.
- Bu rulebook [[SPEC-SCHEMA-0002]] versiyasını dəyişdikdə eyni zamanda yenilənir.

---

# 9. Mənbələr

Aİ Attestation Rulebook şablonu, ARF Annex 2 Topic 7, 10 və 12, ETSI TS 119 472-1, SD-JWT VC, HAIP 1.0, IETF Token Status List,
ELM v3. Bu sənədin əsaslandığı Tamga qərarları və spesifikasiyaları Əlavə E-də sadalanır.

# Status

**Qüvvədədir** — versiya 1.0.0 (2026-10-16).
