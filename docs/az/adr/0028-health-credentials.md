---
document_id: ADR-0028
title: "Səhiyyə sənədləri"
status: Proposed
version: 1.0.0
created: 2026-09-29
last_updated: 2026-10-30
summary: >
  Tibb işçiləri üçün bir-birini tamamlayan üç rəqəmsal sənəd: (1) peşə fəaliyyəti sənədi — səlahiyyətli mənbə Səhiyyə Nazirliyidir; pilotda sınaq qurumu; (2) peşə palatası üzvlük sənədi — Türkiyə Həkimlər Birliyi / il həkim palataları; (3) qurum vəzifə sənədi — xəstəxana və ya klinika öz əməkdaşına bölmə, vəzifə və işə başlama tarixi ilə verir. Başqa qurum işə qəbul zamanı bunları yoxlayan tərəf kimi tələb edir (yoxlanılmış CV). Sənədlərdə sağlamlıq məlumatları və T.C. şəxsiyyət nömrəsi yoxdur. Pasiyent tərəfi (Aİ Health ID, e-resept) əhatə dairəsindən kənardır, gələcəkdə nəzərdə tutulur. Növ adları təklifdir.
domain: Credentials
translation_of: ADR-0028
source_version: "1.0.0"
---

> **Dayandırılıb (2026-10-30, layihə rəhbərliyinin qərarı).** Bu layihə Proposed olaraq qalır, lakin üzərində işlənmir: ilk sektor
> universitetdir və səhiyyə sənədləri səhiyyə tərəfdaşı və hüquqi yoxlama olmadan götürülmür. Yenidən açılarsa, qəbul ayrıca təsdiq tələb edir.

# Kontekst

Layihə rəhbərliyi ilk sektorlar olaraq universitet və səhiyyəni müəyyən etdi. Səhiyyədə ilk hədəf həkimlərə və tibb işçilərinə
rəqəmsal sənədlər verməkdir; qurumlar [[t:issuer]], digər qurumlar isə [[t:verifier]] olur.

Dünyada həkimin səlahiyyəti bir sənədlə deyil, **hər məlumatı öz sahibinin verdiyi bir neçə sənədlə** sübut olunur:

| Ölkə / region | Üsul |
|---|---|
| Aİ | Milli orqanın lisenziyası; diplom avtomatik tanınır (2005/36/AT); fəaliyyəti qadağan edilmiş həkim IMI xəbərdarlıq sistemi ilə bildirilir |
| ABŞ | Ştat lisenziyası + NPI + ixtisas sənədi; işə götürən xəstəxana "credentialing" ilə ilkin mənbədən yoxlayır, sonra prosedur səlahiyyəti ("privileging") verir |
| Birləşmiş Krallıq | GMC qeydiyyatı; NHS-in yoxlanıla bilən "Digital Staff Passport"u işə qəbul yoxlamalarını qurumlar arasında daşıyırdı (2025-ci ildə bağlandı; model davam edir) |

[[t:EUDI-Wallet|EUDI Wallet-da]] həkim sənədi **hələ müəyyən edilməyib**. EHDS (Reqlament 2025/327) Komissiyaya tibb işçilərinin şəxsiyyətinin
yoxlanılması üçün icra qərarı qəbul etmək səlahiyyəti verir. Aİ rəqəmsal cüzdanının səhiyyədə yeganə müəyyən edilmiş istifadəsi pasiyent tərəfindəki
e-resept "Sağlamlıq Şəxsiyyəti"dir ([[t:mdoc]]; reseptin özü rəqəmsal cüzdana daxil olmur).

Türkiyədə [[t:authentic-source|səlahiyyətli mənbələr]]:

| Məlumat | Səlahiyyətli mənbə |
|---|---|
| Peşə fəaliyyəti səlahiyyəti, ixtisas | Səhiyyə Nazirliyi |
| Peşə palatası üzvlüyü | Türkiyə Həkimlər Birliyi / il həkim palataları (dövlət qurumu statuslu peşə təşkilatı) |
| İş, bölmə, vəzifə | İşəgötürən səhiyyə müəssisəsi |

[[ADR-0020]] əsasında məlumat hər sənəddə öz mənbəyindən oxunur; Tamga onu saxlamır.

# Təklif olunan qərar

## K1 — Üç sənəd, üç mənbə

| # | Sənəd | Verən | Etibar siyahısı sinfi | Növ adı (TƏKLİF, §6) |
|---|---|---|---|---|
| 1 | **Peşə fəaliyyəti sənədi** | Səhiyyə Nazirliyi. Pilotda "Səhiyyə Nazirliyi (sınaq)" sınaq qurumu; real iştirakda eyni növ, real qeydiyyat | `PUB` / `HEALTH` | `urn:tamga:health:PractitionerLicence:1` |
| 2 | **Palata üzvlük sənədi** | THB və ya il həkim palatası, öz üzvlərinə | `PUB` (dövlət qurumu statuslu) və ya `EAA` / `HEALTH` | `urn:tamga:health:ProfessionalMembership:1` |
| 3 | **Qurum vəzifə sənədi** | Xəstəxana / klinika / səhiyyə qrupu, öz əməkdaşlarına | `EAA` / `HEALTH` | `urn:tamga:work:EmploymentCredential:1` (sektordan asılı olmayan) |

Heç biri Tamga tərəfindən verilmir; Tamga yalnız hostinq edilən sənəd vermə xidmətini idarə edir.

## K2 — Sahələr (təklif)

**Peşə fəaliyyəti sənədi:**
- `family_name`, `given_name`,
- `profession`: ISCO-08 kodu + ad; məs. 2211 həkim, 2261 stomatoloq, 2262 əczaçı, 2221 tibb bacısı,
- `specialty` (varsa; nazirliyin ixtisas sahələri siyahısı),
- `registration_number` (peşə qeydiyyat nömrəsi; [[t:selective-disclosure]] ilə),
- `licence_status` (`ACTIVE` | `RESTRICTED`),
- `authority_name`, `issued_date`.

**Palata üzvlük sənədi:**
- `family_name`, `given_name`, `profession`,
- `chamber_name`,
- `membership_number` (selective disclosure),
- `membership_status`, `member_since`.

**Qurum vəzifə sənədi (sektordan asılı olmayan):**
- `family_name`, `given_name`,
- `employer_name`, `employer_id` ([[t:trust-list]] identifikatorundan),
- `job_title`, `department`, `start_date`, `end_date` (işdən çıxdıqda),
- `employment_type` (`FULL_TIME` | `PART_TIME` | `CONSULTANT` …).
- Səhiyyədə istəyə bağlı: `clinical_privileges`, prosedur səlahiyyətləri (ABŞ-dakı "privileging" qarşılığı).

**Heç birində yoxdur:** T.C. şəxsiyyət nömrəsi (IDP10), ünvan, maaş, sağlamlıq məlumatları.

## K3 — Həyat dövrü

- Hər üç sənəd **ləğv və dayandırma** statusunu daşıyır (Token Status List 2 bit). Aİ-dəki IMI xəbərdarlığının qarşılığı nazirliyin peşə fəaliyyəti sənədini
  dayandırması və ya ləğv etməsidir. Yoxlayan tərəf bunu dərhal görür.
- **Qurum vəzifə sənədi işdən çıxdıqda** ya ləğv edilir, ya da `end_date` ilə yenidən verilir. İkincisi tövsiyə olunur: iş təcrübəsinin
  sübutu kimi qalır.
- Nüsxələrin avtomatik yenilənməsi ([[ADR-0023]]) hər üçündə aktivdir.

## K4 — Yoxlayan tərəf: işə qəbul və təyinat

- Həkimi işə götürəcək və ya təyin edəcək qurum etibar siyahısında yoxlayan tərəf kimi qeydiyyatdan keçir: istifadə məqsədi "İşə qəbul və
  təyinatın yoxlanılması"; tələb olunan sahələr üç sənəddən götürülür.
- Həkim bir təsdiqlə üç sənədi birlikdə göndərir. Bu, yoxlanılmış CV kimi işləyir; xəstəxana hər şeyi yenidən
  yoxlamır.
- [[t:registration-certificate]] ([[ADR-0026]]) yoxlayan tərəfin bu məqsədlə qeydiyyatdan keçdiyini göstərir.

## K5 — Açıqlama siyasəti (EDP)

- Peşə fəaliyyəti sənədi üçün istəyə bağlı daxili açıqlama siyasəti (ETSI TS 119 472-3 §4.2.5): "yalnız qeydiyyat
  sertifikatında (registration certificate) səhiyyə xidməti göstərən səlahiyyəti olan yoxlayan tərəflərə".
- Rəqəmsal cüzdan uyğun olmayan sorğuda xəbərdarlıq edir; qərarı yenə də şəxs verir (ARF EDP_07).
- ETSI konkret JSON adlarını müəyyən etmədiyi üçün Tamga profili qəbul zamanı müəyyənləşdirilir.

## K6 — Əhatə dairəsindən kənar (gələcəkdə)

- Pasiyentin Sağlamlıq Şəxsiyyəti (Aİ e-resept pilotu, mdoc) və e-Nabız / e-Reçete inteqrasiyası: yalnız Səhiyyə Nazirliyi sənədi verən qurum kimi
  iştirak edərsə.
- Səhiyyə müəssisəsinin özü üçün sənəd verilmir: müəssisə etibar siyahısındakı qeydiyyatı və qeydiyyat sertifikatı ilə tanınır
  ([[ADR-0024]], [[ADR-0026]]).

# Əsaslandırma / alternativlər

| Variant | Nəticə | Səbəb |
|---|---|---|
| Vahid "həkim sənədi" (lisenziya + palata + iş yeri birlikdə) | rədd | Məlumatlar müxtəlif mənbələrdədir; biri dəyişdikdə (iş yeri) hamısı yenidən verilir; heç bir qurum hamısının sahibi deyil |
| Həkim sənədini Tamga-nın verməsi | rədd | Səlahiyyətli mənbə qurumdadır ([[ADR-0020]]) |
| Vəzifə sənədini səhiyyəyə xas etmək | təklif deyil | Eyni ehtiyac universitet əməkdaşlarında və şirkətlərdə də var; sektordan asılı olmayan növ təkrar istifadə olunur |
| **Üç sənəd, hər biri öz mənbəyindən; işə götürən qurum yoxlayan tərəfdir** | **təklif** | Dünya təcrübəsi ilə eynidir; Aİ modelinə uyğundur |

# Təklif olunan qaydalar (qəbul edilərsə, məcburi cədvələ köçürülür)

| Kod | Qayda |
|---|---|
| HC1 | Səhiyyə sahəsi sənədləri sağlamlıq məlumatlarını (diaqnoz, resept, analiz, müalicə) və T.C. şəxsiyyət nömrəsini daşımır. |
| HC2 | Peşə fəaliyyəti sənədini yalnız etibar siyahısında bu növ üzrə səlahiyyətli qurum verir; Tamga vermir. |
| HC3 | Səhiyyə sahəsi sənədləri ləğv və dayandırma statusunu daşıyır; dayandırılmış sənəd yoxlamada etibarsızdır. |

# Qərar gözləyən suallar (layihə rəhbərliyi)

1. **Növ adları:** §K1-dəki təkliflər və ya alternativləri — `MedicalLicence`, `ChamberMembership` (bütün peşə palataları),
   `StaffAppointment` (səhiyyəyə xas vəzifə).
2. Palata sənədinin sinfi: `PUB`, yoxsa `EAA`?
3. Pilot ssenarisi: "Səhiyyə Nazirliyi (sınaq)", bir həkim palatası, bir özəl xəstəxana — sınaq icarəçiləri.

# Status

**Proposed — 2026-09-30.** Ssenari və sənədi verən qurumlar layihə rəhbərliyinin istiqamətləndirməsi ilə yazılıb; növ adları qərar mərhələsindədir.
