---
document_id: SPEC-SCHEMA-0002
title: "Təhsil sxemləri"
status: Active
version: 1.0.0
created: 2026-09-09
last_updated: 2026-10-16
summary: >
  Pilotun iki rəqəmsal sənəd tipini normativ şəkildə müəyyən edir. TamgaStudentCredential: qısamüddətli (90 gün), ləğv siyahısından istifadə etmir, tələbəlik statusunu sübut edir. TamgaDiplomaCredential: uzunmüddətli, ləğv siyahısından istifadə edir, məzuniyyəti sübut edir. Hər ikisi üçün tam JSON Schema, Type Metadata, ELM v3 uyğunluq cədvəli, seçici paylaşım siyasəti, törəmə boolean claim-lər, nümunə payload və universitetin tələbə məlumat sistemi (OBS) üzrə sahə uyğunluğu verilir. Əhatə dairəsi qəsdən dar saxlanılıb — transkript, mikro-credential və digər tiplər pilotdan sonraya saxlanılıb.
translation_of: SPEC-SCHEMA-0002
source_version: "1.0.0"
---

Bu spesifikasiya Tamga-dakı iki təhsil sənədini — tələbə sənədini və diplomu — sahə-sahə müəyyən edir; universitetlər, tələbə
məlumat sistemi (OBS) inteqrasiyası aparan komandalar və bu sənədləri yoxlayan tərtibatçılar üçündür.

**Nə vaxt oxunmalıdır**

- Əvvəlcə [Sənəd formatları](/concepts/credential-formats) və [Məxfilik](/concepts/privacy) səhifələrini oxuyun.
- Qurum olaraq sənəd verəcəksinizsə: [[GUIDE-0003]]; qurumların əməl edəcəyi qaydalar [[FW-RB-0002]]-dədir.
- Tip təriflərinin necə dərc edildiyi: [[SPEC-SCHEMA-0001]].

**Qısaca**

Tələbə sənədi "bu şəxs hazırda bu universitetdə qeydiyyatdadır" deyir; diplom isə "bu şəxs bu proqramı bitirib" deyir. Hər sahə üçün
şəxsin onu göstərib-göstərməməyi seçə bilib-bilməyəcəyi müəyyəndir: məsələn, diplom qiyməti defolt olaraq gizlidir və yalnız
şəxs istədikdə açılır. Şəxsiyyət nömrəsi sənədə daxil edilmir; sənəd şəxsin telefonundakı açara bağlanır. Diplom Aİ-nin təhsil
məlumat modeli olan ELM ilə uyğunlaşdırılır; beləliklə, Avropadakı sistemlərə ötürülə bilər.

---

# Əhatə dairəsi

Bu spesifikasiya **iki** sənəd tipini müəyyən edir:

| `vct` | Məqsəd |
|---|---|
| `urn:tamga:edu:StudentCredential:1` | Tələbəlik statusu |
| `urn:tamga:edu:DiplomaCredential:1` | Məzuniyyət |

**Əhatədən kənar (qəsdən):** transkript, kursun tamamlanması, mikro-credential,
tezliklə-məzun, intizam sənədi. Bunlar pilotdan sonraya saxlanıldı; hər yeni
tip universitetin tələbə məlumat sistemindən (OBS) əlavə məlumat çəkmək deməkdir və
pilotun ən həssas nöqtəsi inteqrasiya səthidir.

Reyestr mexanizmi [[SPEC-SCHEMA-0001]]-də, sxemlərin əsaslandığı
beynəlxalq modellər [[RS-SCHEMA-0001]]-dədir.

---

# 1. Ümumi əsas

Hər iki tip `core/TamgaBaseCredential/1.0.0`-dan törəyir
([[SPEC-SCHEMA-0001]] §4). Kök tipdən gələn `iss`, `vct`, `vct#integrity`,
`iat`, `cnf` claim-ləri burada təkrarlanmır.

## 1.1 Ümumi təhsil sahələri

Hər iki tipdə mövcud olan sahələr:

| Claim | Tip | `sd` | ELM qarşılığı |
|---|---|---|---|
| `family_name` | string | `always` | `Person.familyName` |
| `given_name` | string | `always` | `Person.givenName` |
| `birth_date` | DateOnly | `always` | `Person.dateOfBirth` |
| `awarding_body_name` | LangString | `allowed` | `Organisation.legalName` |
| `awarding_body_id` | string | `allowed` | `Organisation.identifier` |
| `awarding_body_country` | string (ISO 3166-1 alpha-2) | `allowed` | `Organisation.location.country` |

`awarding_body_id` qurumun milli qeydiyyat nömrəsidir (Türkiyədə YÖK qurum
kodu). `iss` ilə qarışdırılmamalıdır: `iss` kriptoqrafik [[t:issuer|sənədi verən qurumun]] identifikatorudur,
`awarding_body_id` isə inzibati qurum identifikatorudur. Bunlar eyni qurum olmaya bilər — bir
universitet adına mərkəzləşdirilmiş sənəd verən xidmət imzalaya bilər.

## 1.2 Şəxsiyyət nömrəsi ilə bağlı qərar

**TCKN və ya ona ekvivalent milli şəxsiyyət nömrəsi bu sxemlərdə yer almır.**

### 1.2.1 `cnf` nəyi sübut edir, nəyi sübut etmir

Bu fərq asanlıqla yanlış başa düşülə bilər və sxemin əsaslandırması ona söykəndiyi
üçün burada aydın yazılmalıdır.

`cnf` claim-i və key binding ([[SPEC-CRED-0001]] §3) bunu sübut edir:

> Sənədi təqdim edən tərəf sənəd verilərkən bu sənədə bağlanmış şəxsi açarı
> idarə edir.

Yəni **"sənədi alan [[t:holder|sənəd sahibi]] ilə sənədi təqdim edən sənəd sahibi eynidir"**. Sübut etmədiyi isə:

> Qarşınızdakı insan sənəddə adı keçən şəxsdir.

`cnf` bir **insana** deyil, bir **cihaz açarına** bağlayır. Ayşə telefonunu və
PIN-ini başqasına verərsə, həmin şəxs etibarlı imzalı və etibarlı key-binding-li
diplom təqdim edir; yoxlama zəncirinin heç bir addımı xəta vermir.

### 1.2.2 Şəxsiyyət uyğunlaşdırmasını nə həll edir

Düzgün həll **birləşmiş təqdimatdır**: eyni [[t:OpenID4VP]] sorğusunda diplom və dövlət
şəxsiyyət [[t:credential|sənədi]] ([[t:PID]]) birlikdə təqdim olunur, hər ikisi **eyni `cnf` açarına**
bağlıdır. Beləliklə, [[t:verifier|yoxlayan tərəf]] iki sənədin eyni rəqəmsal cüzdana aid olduğunu bilir və
şəxsiyyəti PID daşıyır. EUDI ekosisteminin yanaşması budur ([[RS-EIDAS-0001]]).

**İlk mərhələdə PID yoxdur.** Dövlət iştirakı olmadan bu mexanizm işləmir.

### 1.2.3 İlk mərhələnin məhdudiyyəti (açıq şəkildə qeydə alınıb)

Pilotda faktiki olaraq baş verən budur: yoxlayan tərəf sənəddəki `family_name`,
`given_name` və `birth_date` sahələrini namizədin ayrıca təqdim etdiyi şəxsiyyət
sənədi ilə müqayisə edir.

Bu, kriptoqrafik deyil, **prosedur** xarakterli uyğunlaşdırmadır və zəifdir. Lakin
bu gün kağız diplomla edilənin eynisidir — yəni Tamga bu məsələdə
gerilik gətirmir, sadəcə gözlənilən təkmilləşməni dövlət mərhələsinə təxirə salır.

**Bu məhdudiyyət pilot iştirakçılarına (universitet və yoxlayan tərəf) açıq şəkildə
bildirilməlidir.** → PM-GTM-0001 iş bəndi.

### 1.2.4 Şəxsiyyət nömrəsinin əlavə edilməməsinin əsaslandırması

Yuxarıdakılardan çıxan nəticə: şəxsiyyət nömrəsini əlavə etmək bu problemi **həll etməzdi.**
Saxta təqdimat edən şəxsin əlində sənəd sahibinin şəxsiyyət nömrəsi də olardı;
prosedur uyğunlaşdırması eyni qalardı.

Bunun əksinə, şəxsiyyət nömrəsini əlavə etməyin qəti bir dəyəri var: şəbəkə üzrə
daimi və unikal **korrelyasiya açarı** yaradır. Müxtəlif sənəd verənlərdən
alınmış sənədlər, müxtəlif yoxlayan tərəflərə edilmiş təqdimatlar eyni nömrə üzərindən
birləşdirilə bilən hala gəlir.

Sıfır fayda, qəti dəyər → sahə sxemdə yoxdur.

Ehtiyac duyulan istisna ssenarilər (rəsmi ekvivalentlik prosedurları, dövlət qulluğuna qəbul) üçün
ayrıca NATIONAL sxem yazılır — `tr/edu/...` — və orada sahə `sd: always`
olur.

---

# 2. TamgaStudentCredential

> **İnkişaf mərhələsi ([[ADR-0029]]):** isteğe bağlı `credit_points` (proqramın iş yükü, AKTS) və `enrollment_date` (qeydiyyat tarixi) — Aİ DC4EU qeydiyyat sənədində (EUHEPOE) məcburi sahələr; `tamga.elm_mapping` hər claim-in ELM qarşılığını verir. DiplomaCredential da ELM qarşılıqlarını daşıyır (EUHED).

## 2.1 Dizayn qərarları

| Mövzu | Qərar | Əsaslandırma |
|---|---|---|
| Müddət | **Ən çox 90 gün** (`exp` məcburi) — sabit deyil, yuxarı həddir | Tələbəlik statusu dəyişkəndir |
| Ləğv siyahısı | **İstifadə edilmir** | [[ADR-0008]] Alt. C — qısa müddət ləğvi əvəz edir |
| Sənədi verən qurumun assurance səviyyəsi | Minimum **I2** | [[PM-ASSUR-0001]] |
| Təzəlik | **Yoxlayan tərəfin siyasəti** müəyyən edir — §2.1.2 | Risk səviyyəsi yoxlayan tərəfə görə dəyişir |
| Yeniləmə | Tələbə istədikdə; batch ilə | Avtomatik yeniləmə yoxdur (izləmə səthi) |

**Ləğv siyahısı niyə yoxdur:** 90 günlük sənəddə [[t:revocation|ləğv]] mexanizmini işlətmək
qazandırdığından çox xərc gətirir. Bunun əksinə, hər tələbə üçün [[t:status-list|ləğv siyahısı]]
indeksi saxlamaq sənədi verən quruma daimi əməliyyat yükü və korrelyasiya səthi əlavə edir.

### 2.1.1 Köhnəlmiş sənəd boşluğu (qəbul edilmiş və idarə olunan risk)

Qısa müddətin ləğvi əvəz etməsi **bədəlsiz deyil.** Tələbə sənədi
aldıqdan bir gün sonra qeydiyyatını ləğv etdirərsə, əlində daha 89 gün etibarlı
"aktiv tələbəyəm" sənədi qalır. Yoxlama zəncirinin heç bir addımı bunu
aşkar etmir.

Təsiri istifadə ssenarisinə görə dəyişir:

| Ssenari | Köhnəlmiş sənəd riski |
|---|---|
| Tələbə endirimi (kino, nəqliyyat, proqram lisenziyası) | Aşağı — maliyyə itkisi məhduddur |
| Kitabxana/kampus girişi | Aşağı — fiziki nəzarət var |
| İmtahan müraciəti, təqaüd | Orta |
| Tələbə vizası, yaşayış icazəsi | **Yüksək** |

Bu sxem NETWORK qatındadır və uzunömürlüdür; bu gün kino endirimi üçün
istifadə edilən tip sabah yaşayış icazəsi üçün istifadə oluna bilər. Həll ləğv siyahısı əlavə etmək
deyil, **təzəliyi yoxlayan tərəfə keçirməkdir.**

### 2.1.2 Yoxlayan tərəfin təzəlik siyasəti (mexanizm)

`default_ttl_days: 90` **yuxarı həddir.** Sənədi verən qurum daha qısa `exp` verə bilər və
yüksək riskli ssenarilərdə verməlidir.

Yoxlayan tərəfdə mexanizm belədir: təqdimat sorğusunda **maksimum `iat` yaşı**
göstərilir.

> *"Son 7 gün ərzində verilmiş `StudentCredential` istəyirəm."*

Rəqəmsal cüzdanda bu şərtə cavab verən sənəd yoxdursa, istifadəçini sənədi verən qurumdan yeni
sənəd almağa yönləndirir. Ləğv infrastrukturu tələb olunmur; təzəlik tələbi riski
üzərinə götürən tərəfdə müəyyən edilir.

Tövsiyə olunan hədlər ([[SPEC-PROTO-0002]]-də normativləşəcək):

| Risk | Maksimum `iat` yaşı |
|---|---|
| Aşağı (endirim) | 90 gün |
| Orta (təqaüd, imtahan) | 14 gün |
| Yüksək (rəsmi əməliyyat) | 24 saat – 7 gün |

### 2.1.3 Toplu sənəd verilməsi (məxfilik balansı)

§2.1.2-nin bədəli tez-tez yeniləmədir. Rəqəmsal cüzdan hər təzəlik ehtiyacında sənədi verən quruma
müraciət edərsə, universitet "bu şəxs sənədindən nə qədər tez-tez istifadə edir" siqnalını
mütəmadi olaraq alır — səssiz izləmə kanalı.

Həll **[[t:batch-issuance|toplu sənəd verilməsidir]]**: rəqəmsal cüzdan bir sənəd alma sessiyasında bir neçə
(tövsiyə: 10–12) sənəd alır, hər təqdimatda onlardan **fərqli** birini istifadə edir. Universitet
yalnız toplu alım anını görür, ayrı-ayrı istifadələri görmür.

Batch issuance [[t:OpenID4VCI]]-nin dəstəklədiyi xüsusiyyətdir; protokol təfərrüatları
[[SPEC-PROTO-0001]]-də müəyyən ediləcək.

**Avtomatik yeniləmə yenə də yoxdur.** Batch alımı istifadəçi əməliyyatı ilə başlayır;
rəqəmsal cüzdan arxa planda özbaşına yeniləmə etmir.

## 2.2 Sahələr cədvəli

| Claim | Tip | Məcburi | `sd` | İzah |
|---|---|---|---|---|
| `student_status` | enum | ✓ | `allowed` | `ACTIVE` \| `ON_LEAVE` — §2.2.1 |
| `enrollment_year` | integer | ✓ | `allowed` | Qəbul ili |
| `study_level` | integer (EQF) | ✓ | `allowed` | 5–8 |
| `programme_title` | LangString | ✓ | `allowed` | Proqramın adı |
| `isced_f_code` | string | ✓ | `allowed` | ISCED-F 2013, 2–4 rəqəm — §6.4 |
| `faculty_name` | LangString | — | `allowed` | Fakültə |
| `expected_graduation_year` | integer | — | `allowed` | Təxmini |
| `credit_points` | number | — | `allowed` | Proqramın iş yükü (AKTS, 0–1000); Aİ qeydiyyat sənədi (EUHEPOE) |
| `enrollment_date` | date | — | `allowed` | Qeydiyyat tarixi (`YYYY-MM-DD`); Aİ qeydiyyat sənədi (EUHEPOE). `enrollment_year` məcburi olaraq qalır |
| `is_enrolled` | boolean | ✓ | `allowed` | **Törəmə** — §2.3 |

### 2.2.1 `student_status` niyə `GRADUATED` ehtiva etmir

`student_status` enum-unda `GRADUATED` **yoxdur**; dəyərlər yalnız bunlardır: `ACTIVE | ON_LEAVE`.

Əsaslandırma: məzun olmanı sübut edən rəqəmsal sənəd `TamgaDiplomaCredential`-dır. Eyni faktı
iki tipdə təqdim etmək [[PM-SCHEMA-0001]] Zəiflik 2-nin (məna parçalanması)
sxem daxilindəki formasıdır — yoxlayan tərəf "hansına baxım" sualı ilə qalır.

Bundan əlavə, struktur baxımından da uyğunsuz olardı: `GRADUATED` statusunda olan şəxs 90 gün sonra
rəqəmsal sənədi **yeniləyə bilməz**, çünki artıq həmin qurumun tələbəsi deyil. Yəni qısa
ömürlü tip daimi faktı daşıyardı.

Məzunun "bu qurumda oxumuşam" sübutuna ehtiyacı varsa (diplom almadan ayrılmış
ola bilər), bu ayrıca tipdir — `AttendanceCredential`, pilot əhatəsindən kənardadır.

## 2.3 Törəmə sahə — `is_enrolled`

[[RS-SCHEMA-0001]] §4-dəki `age_over_NN` şablonunun tətbiqi.

`is_enrolled = (student_status == "ACTIVE")`

**Niyə ayrıca claim:** Tələbə endirimi tələb edən kinoteatr universiteti,
ixtisası və qəbul ilini bilmək məcburiyyətində deyil. Yeganə ehtiyacı "hazırda tələbədirmi"
məlumatıdır. Ayrıca boolean claim olduğu üçün tələbə **yalnız onu**
açıqlaya bilər; digər sahələr [[t:disclosure]] kimi heç təqdim edilmir.

Bu, [[t:selective-disclosure]]-ın ən konkret qazancıdır və pilotu izah edərkən ən asan
göstərilən şeydir.

## 2.4 JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.tamga.network/v1/edu/StudentCredential/1.0.0/schema.json",
  "title": "TamgaStudentCredential",
  "type": "object",
  "required": [
    "iss", "vct", "vct#integrity", "iat", "exp", "cnf",
    "family_name", "given_name", "birth_date",
    "awarding_body_name", "awarding_body_id", "awarding_body_country",
    "student_status", "enrollment_year", "study_level",
    "programme_title", "isced_f_code", "is_enrolled"
  ],
  "properties": {
    "iss":   { "type": "string", "format": "uri" },
    "vct":   { "const": "urn:tamga:edu:StudentCredential:1" },
    "vct#integrity": { "type": "string", "pattern": "^sha256-" },
    "iat":   { "type": "integer" },
    "exp":   { "type": "integer" },
    "cnf":   { "type": "object" },
    "category": { "enum": ["urn:tamga:eaa:pub", "urn:tamga:eaa:qualified"] },

    "family_name": { "type": "string", "minLength": 1, "maxLength": 200 },
    "given_name":  { "type": "string", "minLength": 1, "maxLength": 200 },
    "birth_date":  { "$ref": "../../../core/TamgaBaseCredential/1.0.0/schema.json#/$defs/DateOnly" },

    "awarding_body_name":    { "$ref": "../../../core/TamgaBaseCredential/1.0.0/schema.json#/$defs/LangString" },
    "awarding_body_id":      { "type": "string", "minLength": 1, "maxLength": 64 },
    "awarding_body_country": { "type": "string", "pattern": "^[A-Z]{2}$" },

    "student_status": { "enum": ["ACTIVE", "ON_LEAVE"] },
    "enrollment_year": { "type": "integer", "minimum": 1900, "maximum": 2200 },
    "study_level": { "type": "integer", "minimum": 5, "maximum": 8 },
    "programme_title": { "$ref": "../../../core/TamgaBaseCredential/1.0.0/schema.json#/$defs/LangString" },
    "isced_f_code": { "type": "string", "pattern": "^[0-9]{2,4}$" },
    "faculty_name": { "$ref": "../../../core/TamgaBaseCredential/1.0.0/schema.json#/$defs/LangString" },
    "expected_graduation_year": { "type": "integer", "minimum": 1900, "maximum": 2200 },
    "credit_points": { "type": "number", "minimum": 0, "maximum": 1000 },
    "enrollment_date": { "$ref": "../../../core/TamgaBaseCredential/1.0.0/schema.json#/$defs/DateOnly" },

    "is_enrolled": { "type": "boolean" }
  },
  "additionalProperties": false
}
```

`additionalProperties: false` şüurlu seçimdir. Sənədi verən qurumun sxemdə olmayan sahə
əlavə etməsinin qarşısı alınır; ehtiyac olarsa MINOR versiya buraxılır. Sərbəst buraxmaq
[[PM-SCHEMA-0001]] Zəiflik 2-ni (məna parçalanması) arxa qapıdan geri gətirər.

## 2.5 Nümunə məzmun (açıqlamadan əvvəl)

```json
{
  "iss": "https://issuer.tamga.network/example-university",
  "vct": "urn:tamga:edu:StudentCredential:1",
  "vct#integrity": "sha256-9Kf2rT8xQm1vB4nL7wZpYc3JdHs0EaXu6GiOoN5RbMk=",
  "iat": 1789000000,
  "exp": 1796776000,
  "cnf": { "jwk": { "kty": "EC", "crv": "P-256", "x": "...", "y": "..." } },

  "family_name": "Yılmaz",
  "given_name": "Ayşe",
  "birth_date": "2003-04-17",

  "awarding_body_name": {
    "tr-TR": "Örnek Üniversitesi",
    "en-US": "Example University"
  },
  "awarding_body_id": "TR-YOK-038",
  "awarding_body_country": "TR",

  "student_status": "ACTIVE",
  "enrollment_year": 2022,
  "study_level": 6,
  "programme_title": {
    "tr-TR": "Bilgisayar Mühendisliği",
    "en-US": "Computer Engineering"
  },
  "isced_f_code": "0613",
  "faculty_name": { "tr-TR": "Mühendislik ve Doğa Bilimleri Fakültesi" },
  "expected_graduation_year": 2026,
  "credit_points": 240,
  "enrollment_date": "2022-09-19",

  "is_enrolled": true
}
```

Kinoteatr ssenarisində tələbənin təqdim etdiyi yeganə disclosure `is_enrolled`-dır. Qalan
bütün sahələr `_sd` massivində hash kimi qalır; kinoteatr `family_name`-ni belə
görmür.

---

# 3. TamgaDiplomaCredential

## 3.1 Dizayn qərarları

| Mövzu | Qərar | Əsaslandırma |
|---|---|---|
| Ömür | **Müddətsiz** (`exp` yoxdur) | Diplom daimidir |
| Ləğv siyahısı | **İstifadə olunur** | [[ADR-0008]] — ləğv real ehtiyacdır |
| Sənədi verən qurumun assurance səviyyəsi | Minimum **I2** | [[PM-ASSUR-0001]] |
| Sənəd sahibinin assurance səviyyəsi | Sənəd verilərkən minimum **T2** tövsiyə olunur | [[SPEC-CRED-0001]] §3 |

**`exp` niyə yoxdur:** Diplomun istifadə müddəti yoxdur. Onun yenilənməsi
tələb olunmur və yeniləmə məcburiyyəti qoymaq məzunu ömürlük universitetdən asılı
vəziyyətə salar.

**Ləğv siyahısı niyə var:** Diplomun ləğvi nadir, lakin real haldır — plagiatın aşkarlanması,
saxta sənədlə qəbul, intizam qərarı. Tələbə sənədindən fərqi odur ki, qısa ömür
ləğvi əvəz edə bilmir.

> **İnkişaf mərhələsi ([[ADR-0029]], [[ADR-0048]] K2):** paketlərin 0.6.0 versiyasında diplomun Type Metadata-sına
> `tamga.suspension_allowed: true` əlavə edildi; metadata və buna görə də `vct#integrity` xülasəsi dəyişdi. 0.6.0-dan əvvəl verilmiş
> (sınaq) diplomlar yeni xülasəyə uyğun gəlmir, yoxlamada rədd edilir və **yenidən verilməlidir**: qurum diplomu yenidən verir, məzun
> onu rəqəmsal cüzdanına yenidən əlavə edir. Keçid kodu yazılmır (ADR-0029); beta-dan sonra dərc edilmiş sxem dəyişmir, yeni versiya buraxılır.

## 3.2 Sahələr cədvəli

| Claim | Tip | Məcburi | `sd` | ELM qarşılığı |
|---|---|---|---|---|
| `qualification_title` | LangString | ✓ | `allowed` | `Qualification.title` |
| `eqf_level` | integer | ✓ | `allowed` | `Qualification.EQFLevel` |
| `nqf_level` | string | — | `allowed` | `Qualification.NQFLevel` (TYÇ) |
| `isced_f_code` | string | ✓ | `allowed` | `Qualification.ISCEDFCode` |
| `awarding_date` | DateOnly | ✓ | `allowed` | `AwardingProcess.awardingDate` |
| `awarding_body_name` | LangString | ✓ | `allowed` | `Organisation.legalName` |
| `mode_of_study` | enum | — | `allowed` | `LearningAchievement.mode` |
| `credit_points` | number | — | `allowed` | `LearningAchievement.creditReceived` (ECTS) |
| `grade` | string | — | **`always`** | `Assessment.grade` |
| `grading_scheme` | LangString | — | `allowed` | `Assessment.gradingScheme` |
| `thesis_title` | LangString | — | `always` | `LearningAchievement.title` |
| `is_graduate` | boolean | ✓ | `allowed` | **törəmə** |
| `graduated_before` | integer | — | `allowed` | **törəmə** |
| `status` | object | ✓ | `never` | — ([[ADR-0008]]) |

## 3.3 Qiymət (`grade`) niyə `sd: always`

Bu, sxemin ən vacib dizayn qərarıdır.

İşəgötürən "məzundurmu" sualını verir; "hansı balla məzun olub" sualını verməyə əksər
hallarda haqqı yoxdur və praktikada buna ehtiyacı da yoxdur. Qiyməti `sd: always`
etmək sənədi verən qurumun onu **məcburi olaraq** selective disclosure ilə gizlədilə bilən etməsini
təmin edir — yəni məzun diplomu qiymətini göstərmədən təqdim edə bilər.

Kağız diplomda bu mümkün deyil: sənədi təqdim edirsiniz, üzərindəki hər şey görünür.
Tamga-nın konkret üstünlüyü budur və sxem səviyyəsində məcburi edilməsə, reallaşmır.

Eyni məntiq `thesis_title` üçün də keçərlidir: dissertasiya mövzusu şəxsin maraq dairəsi
və bəzən siyasi/dini baxışları haqqında məlumat daşıya bilər.

## 3.4 Törəmə sahələr

**`is_graduate`** — həmişə `true`. Diplomun mövcudluğu məzun olmanı nəzərdə tutur;
lakin ayrıca claim olması məzunun **yalnız bunu** açıqlaya bilməsini təmin edir.
İşəgötürən "diplomu varmı" yoxlamasında `is_graduate` + `awarding_body_name`
görür; proqram, qiymət, tarix heç açılmır.

**`graduated_before`** — il dəyəri. `awarding_date`-in ilindən törədilir.
"2020-dən əvvəl məzun olub" kimi staj şərtlərini dəqiq məzun olma tarixini açıqlamadan
sübut edir. `age_over_NN` şablonunun birbaşa tətbiqi.

Sənədi verən qurum bu sahəni **həmişə** doldurur; hansı hədlərdə yaradılacağı
`tamga.derived_claims` daxilində müəyyən edilib.

## 3.5 JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.tamga.network/v1/edu/DiplomaCredential/1.0.0/schema.json",
  "title": "TamgaDiplomaCredential",
  "type": "object",
  "required": [
    "iss", "vct", "iat", "cnf", "status",
    "family_name", "given_name", "birth_date",
    "awarding_body_name", "awarding_body_id", "awarding_body_country",
    "qualification_title", "eqf_level", "isced_f_code", "awarding_date",
    "is_graduate"
  ],
  "properties": {
    "iss": { "type": "string", "format": "uri" },
    "vct": { "const": "urn:tamga:edu:DiplomaCredential:1" },
    "iat": { "type": "integer" },
    "cnf": { "type": "object" },
    "status": {
      "type": "object",
      "required": ["status_list"],
      "properties": {
        "status_list": {
          "type": "object",
          "required": ["idx", "uri"],
          "properties": {
            "idx": { "type": "integer", "minimum": 0 },
            "uri": { "type": "string", "format": "uri" }
          }
        }
      }
    },

    "family_name": { "type": "string", "minLength": 1, "maxLength": 200 },
    "given_name":  { "type": "string", "minLength": 1, "maxLength": 200 },
    "birth_date":  { "$ref": "../../../core/TamgaBaseCredential/1.0.0/schema.json#/$defs/DateOnly" },

    "awarding_body_name":    { "$ref": "../../../core/TamgaBaseCredential/1.0.0/schema.json#/$defs/LangString" },
    "awarding_body_id":      { "type": "string", "minLength": 1, "maxLength": 64 },
    "awarding_body_country": { "type": "string", "pattern": "^[A-Z]{2}$" },

    "qualification_title": { "$ref": "../../../core/TamgaBaseCredential/1.0.0/schema.json#/$defs/LangString" },
    "eqf_level":  { "type": "integer", "minimum": 5, "maximum": 8 },
    "nqf_level":  { "type": "string", "maxLength": 16 },
    "isced_f_code": { "type": "string", "pattern": "^[0-9]{2,4}$" },
    "awarding_date": { "$ref": "../../../core/TamgaBaseCredential/1.0.0/schema.json#/$defs/DateOnly" },

    "mode_of_study": { "enum": ["FULL_TIME", "PART_TIME", "DISTANCE", "BLENDED"] },
    "credit_points": { "type": "number", "minimum": 0, "maximum": 1000 },
    "grade": { "type": "string", "maxLength": 32 },
    "grading_scheme": { "$ref": "../../../core/TamgaBaseCredential/1.0.0/schema.json#/$defs/LangString" },
    "thesis_title": { "$ref": "../../../core/TamgaBaseCredential/1.0.0/schema.json#/$defs/LangString" },

    "is_graduate": { "const": true },
    "graduated_before": { "type": "integer", "minimum": 1900, "maximum": 2200 }
  },
  "additionalProperties": false
}
```

## 3.6 Nümunə məzmun (açıqlamadan əvvəl)

```json
{
  "iss": "https://issuer.tamga.network/example-university",
  "vct": "urn:tamga:edu:DiplomaCredential:1",
  "vct#integrity": "sha256-3Qm2pV7yLx0KcW9tRfBnEsA4ZhUgJd1MoI6TvXbCqNw=",
  "iat": 1789000000,
  "cnf": { "jwk": { "kty": "EC", "crv": "P-256", "x": "...", "y": "..." } },
  "status": {
    "status_list": {
      "idx": 48213,
      "uri": "https://status.tamga.network/7f3a9c21"
    }
  },

  "family_name": "Yılmaz",
  "given_name": "Ayşe",
  "birth_date": "2003-04-17",

  "awarding_body_name": {
    "tr-TR": "Örnek Üniversitesi",
    "en-US": "Example University"
  },
  "awarding_body_id": "TR-YOK-038",
  "awarding_body_country": "TR",

  "qualification_title": {
    "tr-TR": "Bilgisayar Mühendisliği Lisans Diploması",
    "en-US": "Bachelor of Science in Computer Engineering"
  },
  "eqf_level": 6,
  "nqf_level": "TYC-6",
  "isced_f_code": "0613",
  "awarding_date": "2026-06-30",

  "mode_of_study": "FULL_TIME",
  "credit_points": 240,
  "grade": "3.42",
  "grading_scheme": { "tr-TR": "4'lük sistem" },
  "thesis_title": { "tr-TR": "Federated Learning ile Gizlilik Korumalı Model Eğitimi" },

  "is_graduate": true,
  "graduated_before": 2027
}
```

## 3.7 İşəgötürən ssenarisi — nə açılır, nə açılmır

Ayşə işəgötürənə müraciət edir. İşəgötürən bakalavr diplomu axtarır.

| Sahə | Açılırmı | Səbəb |
|---|---|---|
| `is_graduate` | ✓ | Sualın özü |
| `qualification_title` | ✓ | Hansı ixtisas |
| `eqf_level` | ✓ | Səviyyə — maşın tərəfindən oxunan |
| `isced_f_code` | ✓ | Sahə kodu — beynəlxalq səviyyədə tanınır |
| `awarding_body_name` | ✓ | Hansı qurum |
| `awarding_date` | ✓ | Stajın hesablanması |
| `family_name`, `given_name` | ✓ | Müraciət onsuz da ad ilə edilir |
| `birth_date` | ✗ | Yaş ayrı-seçkiliyi riski |
| `grade` | ✗ | İşəgötürənin ehtiyacı yoxdur |
| `thesis_title` | ✗ | Baxışları/maraq dairəsini sızdırır |
| `credit_points`, `mode_of_study` | ✗ | Əlaqəsizdir |

Təqdim edilən SD-JWT-də yalnız ilk yeddi sahə disclosure kimi yer alır. Qalanlar
`_sd` daxilində hash kimi qalır və işəgötürən onların mövcudluğunu belə ayırd edə bilmir —
disclosure sayı sabit olmadığı üçün hansı sahələrin gizlədildiyi də bəlli
olmur.

Yoxlayan tərəfin bu sahələri tələb etmək səlahiyyəti əlavə olaraq `RelyingPartyRegistry` scope-u ilə
məhdudlaşdırılır ([[SPEC-BC-0001]] §4).

---

# 4. ELM Uyğunlaşdırma Cədvəli (Normativ)

[[RS-SCHEMA-0001]] §9-a əsasən məcburidir. Bu cədvəl olmadan sxem "standarta uyğun
görünən, amma uyğun olmayan" sxemdir.

## 4.1 DiplomaCredential ↔ ELM v3

| Tamga claim | ELM v3 yolu | OBv3 qarşılığı |
|---|---|---|
| `family_name` | `credentialSubject.familyName` | `credentialSubject.identifier` |
| `given_name` | `credentialSubject.givenName` | — |
| `birth_date` | `credentialSubject.dateOfBirth` | — |
| `qualification_title` | `hasClaim.specifiedBy.title` | `achievement.name` |
| `eqf_level` | `hasClaim.specifiedBy.EQFLevel` | `achievement.alignment[].targetCode` |
| `nqf_level` | `hasClaim.specifiedBy.NQFLevel` | — |
| `isced_f_code` | `hasClaim.specifiedBy.ISCEDFCode` | `achievement.alignment[].targetCode` |
| `awarding_date` | `hasClaim.awardedBy.awardingDate` | `issuanceDate` |
| `awarding_body_name` | `hasClaim.awardedBy.awardingBody.legalName` | `issuer.name` |
| `awarding_body_id` | `hasClaim.awardedBy.awardingBody.identifier` | `issuer.id` |
| `credit_points` | `hasClaim.creditReceived.point` | `achievement.creditsAvailable` |
| `mode_of_study` | `hasClaim.mode` | — |
| `grade` | `hasClaim.provenBy.grade` | `result[].value` |
| `grading_scheme` | `hasClaim.provenBy.gradingScheme` | `resultDescription` |
| `thesis_title` | `hasClaim.title` | `achievement.description` |
| `is_graduate` | *(törəmə — ELM qarşılığı yoxdur)* | — |
| `graduated_before` | *(törəmə — ELM qarşılığı yoxdur)* | — |

## 4.2 Düzləşdirmə qaydasının yoxlanması

[[RS-SCHEMA-0001]] §9-dakı "iki səviyyədən dərinə getmə" qaydası bu sxemdə ödənilir:
ELM-də dörd səviyyə dərinlikdə olan `hasClaim.awardedBy.awardingBody.legalName`
Tamga-da tək səviyyəli `awarding_body_name` claim-idir.

## 4.3 İxrac

`mapping.json` faylı ([[SPEC-SCHEMA-0001]] §1.3) bu cədvəli maşın tərəfindən oxunan
formada daşıyır. Tamga diplomunun EDC-yə (Europass) ixracı bu
faylla həyata keçirilir.

**İtki xəbərdarlığı:** Törəmə claim-lərin (`is_graduate`, `graduated_before`)
ELM qarşılığı yoxdur; ixrac zamanı düşürlər. Bu, xəta deyil, gözlənilən
davranışdır — törəmə claim-lər Tamga-nın məxfilik qatına aiddir.

---

# 5. Tip təsvirləri (Type Metadata)

## 5.1 StudentCredential

```json
{
  "vct": "urn:tamga:edu:StudentCredential:1",
  "name": "Tamga Student Credential",
  "description": "Proves student status at a higher-education institution.",
  "extends": "urn:tamga:core:TamgaBaseCredential:1",
  "extends#integrity": "sha256-Yr9kL2mQ...",
  "schema_uri": "https://schemas.tamga.network/v1/edu/StudentCredential/1.0.0/schema.json",
  "schema_uri#integrity": "sha256-Bn7xW4pT...",
  "display": [
    { "lang": "tr-TR", "name": "Öğrenci Belgesi", "description": "Öğrencilik durumu" },
    { "lang": "en-US", "name": "Student Certificate", "description": "Proof of enrolment" }
  ],
  "claims": [
    { "path": ["birth_date"],    "sd": "always" },
    { "path": ["family_name"],   "sd": "always" },
    { "path": ["given_name"],    "sd": "always" },
    { "path": ["is_enrolled"],   "sd": "allowed",
      "display": [{ "lang": "tr-TR", "label": "Aktif öğrenci" }] },
    { "path": ["programme_title"], "sd": "allowed",
      "display": [{ "lang": "tr-TR", "label": "Program" }] }
  ],
  "tamga": {
    "tier": "NETWORK",
    "issuer_categories": ["EDUCATION"],
    "default_ttl_days": 90,
    "uses_status_list": false,
    "min_issuer_assurance": "I2",
    "derived_claims": ["is_enrolled"],
    "elm_profile": "ELM-3.3/LearningAchievement",
    "status": "ACTIVE"
  }
}
```

## 5.2 DiplomaCredential

```json
{
  "vct": "urn:tamga:edu:DiplomaCredential:1",
  "name": "Tamga Diploma Credential",
  "description": "A graduation credential issued by a higher-education institution.",
  "extends": "urn:tamga:core:TamgaBaseCredential:1",
  "extends#integrity": "sha256-Yr9kL2mQ...",
  "schema_uri": "https://schemas.tamga.network/v1/edu/DiplomaCredential/1.0.0/schema.json",
  "schema_uri#integrity": "sha256-3Qm2pV7y...",
  "display": [
    { "lang": "tr-TR", "name": "Diploma", "description": "Yükseköğretim mezuniyet belgesi" },
    { "lang": "en-US", "name": "Diploma", "description": "Higher education degree" }
  ],
  "claims": [
    { "path": ["birth_date"],   "sd": "always" },
    { "path": ["grade"],        "sd": "always",
      "display": [{ "lang": "tr-TR", "label": "Not ortalaması" }] },
    { "path": ["thesis_title"], "sd": "always" },
    { "path": ["is_graduate"],  "sd": "allowed",
      "display": [{ "lang": "tr-TR", "label": "Mezun" }] },
    { "path": ["eqf_level"],    "sd": "allowed",
      "display": [{ "lang": "tr-TR", "label": "Yeterlilik seviyesi (EQF)" }] },
    { "path": ["status"],       "sd": "never" }
  ],
  "tamga": {
    "tier": "NETWORK",
    "issuer_categories": ["EDUCATION"],
    "default_ttl_days": null,
    "uses_status_list": true,
    "min_issuer_assurance": "I2",
    "derived_claims": ["is_graduate", "graduated_before"],
    "elm_profile": "ELM-3.3/Qualification",
    "status": "ACTIVE"
  }
}
```

---

# 6. OBS İnteqrasiya Uyğunlaşdırması

Pilotun ən həssas nöqtəsi universitetin tələbə məlumat sistemindən məlumat
çəkməkdir. Bu bölmə sənədi verən xidmətin ([[ARCH-0003]]) ehtiyac duyduğu minimal
sahələr toplusunu müəyyən edir.

## 6.1 StudentCredential üçün tələb olunan OBS sahələri

| Tamga claim | Tipik OBS sahəsi | Qeyd |
|---|---|---|
| `family_name`, `given_name` | Tələbənin adı/soyadı | — |
| `birth_date` | Doğum tarixi | — |
| `student_status` | Qeydiyyat statusu | OBS enum-u `ACTIVE`/`ON_LEAVE`-ə uyğunlaşdırılmalıdır |
| `enrollment_year` | Qəbul ili | Tələbə nömrəsindən törədilə bilər |
| `study_level` | Proqram növü → EQF | §6.3 uyğunlaşdırma |
| `programme_title` | Proqramın adı | İngiliscə adı da tələb olunur |
| `isced_f_code` | — | OBS-də yoxdur; milli YÖK cədvəlindən törədilir — §6.4 |
| `faculty_name` | Fakültə | — |

## 6.2 DiplomaCredential üçün əlavə sahələr

`qualification_title`, `awarding_date` (məzun olma qərarının tarixi),
`credit_points` (ümumi AKTS), `grade` (məzun olma üzrə orta bal),
`grading_scheme`, `thesis_title` (varsa).

## 6.3 Proqram növü → EQF uyğunlaşdırması (Türkiyə)

| Proqram | EQF | TYÇ |
|---|---|---|
| Subbakalavr (ön lisans) | 5 | TYC-5 |
| Bakalavr | 6 | TYC-6 |
| Magistr | 7 | TYC-7 |
| Doktorantura | 8 | TYC-8 |

## 6.4 ISCED-F kodu — milli təsnifatın götürülməsi

ISCED-F kodu universitetlərin OBS-lərində sahə kimi adətən **olmur.**
Lakin bu, kodun yaradıla bilməyəcəyi demək deyil — çünki uyğunlaşdırma işi Türkiyədə
**milli səviyyədə artıq görülüb.**

### 6.4.1 Mövcud milli mənbə

YÖK 2020-ci ildə ali təhsil sistemindəki oxşar məzmunlu və ya oxşar adlı bütün
aktiv, passiv və bağlanmış subbakalavr və bakalavr proqramlarını ISCED-F 2013
təsnifatını əsas götürərək elmi meyarlar üzrə vahid ad altında
birləşdirib. Prosesdə 55 universitetdən 120 akademikin iştirak etdiyi 17 işçi
komissiya fəaliyyət göstərib, proqramların sayı təxminən 2 230-dan 679-a enib. YÖK-ün
beynəlxalq bölməsi bundan əlavə bakalavr proqramlarının ISCED-F 2013 təsnifatını
əks etdirən sənəd dərc edib.

**Nəticə:** iş bəndi "hər universitet öz cədvəlini hazırlayır" deyil, **"milli
cədvəl bir dəfə idxal edilir və yoxlanılır"**dır. 200 universitet eyni işi 200 dəfə
görmür.

### 6.4.2 Tətbiq

Uyğunlaşdırma cədvəli `@tamga-network/schemas` paketində **versiyalaşdırılmış şəbəkə aktivi** kimi
saxlanılır ([[ARCH-0005]]):

```
tr/isced-f-2013-programs.json   # YÖK programme name → ISCED-F code
```

Sənədi verən xidmət OBS-dən gələn proqram adını bu cədvəllə uyğunlaşdırır. Cədvəldə
olmayan proqram üçün sənədin verilməsi **dayanır** və məsələ operatora ötürülür — xidmət səssizcə boş və ya
təxmini kod yaratmır.

Qurum səviyyəsində istisna (cədvəldə olmayan yeni proqram) `overrides` faylı ilə
müəyyən edilir və o da versiyalaşdırılır.

### 6.4.3 Əsl risk: yanlış kod

**Təhlükəli olan kodun olmaması deyil, yanlış koddur.** Diplom imzalanmış, dəyişməz və
qırx il qüvvədə qalan sənəddir. Yanlış ISCED-F kodunu düzəltməyin yeganə yolu
sənədi ləğv edib yenidən verməkdir; kağız diplomdakı kimi düzəliş
mümkün deyil.

Riskin azaldılması:

1. **Cədvəl şəbəkə aktividir**, hər universitet üçün ayrıca improvizasiya deyil (§6.4.2).
2. **İkimərhələli təsdiq:** cədvəli ilk rəqəmsal sənəd verilməzdən əvvəl universitetin tələbə işləri şöbəsi **və** bir Tamga
   rəyçisi təsdiq edir.
3. **Pilləli kod icazəsi** (§6.4.4) — əmin olunmayan yerdə daha ümumi kod.
4. **Seçmə yoxlama:** ilk 100 rəqəmsal sənəddə kodun düzgünlüyü əl ilə seçmə qaydada yoxlanılır.

### 6.4.4 Kod pilləsi — niyə 2–4 rəqəm

ISCED-F 2013 üç pillədən ibarətdir: **2 rəqəm** geniş sahə (10 ədəd), **3 rəqəm** dar
sahə (29 ədəd), **4 rəqəm** təfərrüatlı sahə (80 ədəd).

Şablon **`^[0-9]{2,4}$`**-dir; ən təfərrüatlı pillə (`^[0-9]{4}$`) məcburi deyil.

Əsaslandırma: təfərrüatlı pillədə səhv ehtimalı nəzərəçarpacaq dərəcədə yüksəkdir və §6.4.3
müddəasına görə səhvin bədəli daimidir. Universitet əmin olmadığı proqram üçün 3 rəqəmli dar
sahə kodu verə bilər; Qazaxıstandakı işəgötürən yenə də istifadəyə yararlı siqnal
alır ("mühəndislik və mühəndislik peşələri" səviyyəsində). Əmin olunan
proqramlarda 4 rəqəm istifadə olunur.

Dəqiqlik itkisi var; lakin bu, yanlış kod riskindən ucuzdur.

**Sahəni tamamilə ixtiyari etmək rədd edilmişdir** — ISCED-F beynəlxalq
tanınmanın daşıyıcısıdır ([[SPEC-SCHEMA-0001]] §8.3). Sahə çıxarılarsa, diplom
sərhədlərdən kənarda oxunmayan bir mətnə çevrilir.

### 6.4.5 Pilot iş bəndi

→ PM-GTM-0001: *"YÖK ISCED-F 2013 proqram təsnifatının idxalı,
aktuallığının təsdiqi və pilot universitetin proqram siyahısı ilə
müqayisəsi."*

**Təsdiq qeydi:** Mənbə 2020-ci ilə aiddir və sonradan yenilənmiş ola bilər.
Pilotdan əvvəl YÖK-ün aktual nəşri əsasında yoxlanılmalıdır.

---

# 7. İnvariantlar

| # | İnvariant |
|---|---|
| **E1** | Milli şəxsiyyət nömrəsi bu iki NETWORK sxemində yer almır (§1.2). |
| **E2** | `grade` və `thesis_title` həmişə `sd: always`-dir (§3.3). |
| **E3** | `is_graduate` sabit `true`-dir; `false` diplom mənasızdır. |
| **E4** | `StudentCredential` `exp` daşıyır; `DiplomaCredential` daşımır. |
| **E5** | `DiplomaCredential` `status` daşıyır; `StudentCredential` daşımır. |
| **E6** | Hər iki sxemdə `additionalProperties: false`. |
| **E7** | `isced_f_code` hər iki sxemdə məcburidir; 2, 3 və ya 4 rəqəmli ola bilər. |
| **E8** | Hər `LangString` sahəsi ən azı qurumun rəsmi dilini ehtiva edir. |
| **E9** | `StudentCredential.exp - iat` ≤ 90 gün (yuxarı hədd, §2.1.2). |
| **E10** | Heç bir NETWORK təhsil sxemi milli şəxsiyyət nömrəsi sahəsini ehtiva etmir (§1.2). |
| **E11** | Uyğunluq cədvəlində qarşılığı olmayan proqram üçün rəqəmsal sənədin verilməsi dayanır; təxmini kod yaradılmır (§6.4.2). |

---

# Təhlükəsizlik və məxfilik qeydləri

**Disclosure sayı yan kanaldır.** Yoxlayan tərəf təqdim olunan disclosure sayından
"neçə sahənin gizlədildiyi" məlumatını çıxara bilər. Tək başına zərərsizdir, lakin iki
təqdimatın müqayisəsi ilə korrelyasiya yarada bilər. Azaltma: rəqəmsal cüzdan eyni
yoxlayan tərəfə edilən təkrar təqdimatlarda ardıcıl disclosure dəstindən istifadə etməlidir (SHOULD).

**Status index korrelyasiyası.** `status.status_list.idx` hər təqdimatda görünür
(`sd: never`) və sabitdir. Eyni diplomu iki fərqli yoxlayan tərəfə təqdim edən məzun,
həmin iki yoxlayan tərəf əməkdaşlıq edərsə, eyniləşdirilə bilər. Bu, məlum SD-JWT
məhdudiyyətidir; həlli batch issuance-dir ([[SPEC-CRED-0001]] §5, genişlənmə mərhələsi).
**Pilotda qəbul edilmiş riskdir və pilot iştirakçılarına açıq şəkildə bildirilməlidir.**

**Ləğv siyahısı gizlədilmiş claim-ləri sızdıra bilər.** `status` bloku
`sd: never` olduğu üçün həm `idx`, həm də **siyahı URI-si** hər təqdimatda görünür.
Siyahı URI-si və ya siyahının bölünmə meyarı kohort məlumatı daşıyırsa,
`awarding_date` və ya `programme_title` gizlədilmiş olsa belə, bu məlumatlar sızır.

Konkret nümunə: `.../statuslist/edu-2026-a` formatındakı URI məzun olma ilini
birbaşa üzə çıxarır — məzun `awarding_date`-i açıqlamamış olsa belə.

Buna görə [[SPEC-CRED-0003]] §6.3 və §6.4 iki qaydanı **normativ** edir:
siyahı URI-si qeyri-şəffafdır (opaque) və siyahılar il/fakültə/kohort meyarı ilə bölünmür. Bu
sənəddəki nümunələr (§3.6) həmin qaydaya uyğundur.

**`birth_date` niyə `sd: always`.** Doğum tarixi adla birləşdikdə
yüksək ehtimalla unikal identifikatordur. Onun məcburi olaraq gizlədilə bilən
olması məzunun onu verməməyi seçə bilməsini təmin edir.

---

# Açıq məsələlər

1. `student_status` enum-u bütün üzv dövlətlərin təhsil sistemlərini əhatə edirmi?
   (`ON_LEAVE` qarşılığı hər ölkədə varmı?)
2. `AttendanceCredential` (diplom almadan təhsili tərk edənlər üçün) nə vaxt
   yazılacaq? Pilotdan kənardır, lakin tələb yarana bilər.
3. İkili ixtisas / əlavə ixtisas diplomu necə təqdim olunur — iki ayrı rəqəmsal sənəd,
   yoxsa bir sənəddə massiv? Təklif: **iki ayrı rəqəmsal sənəd** (sadəlik).
   Qərar gözlənilir.
4. Xarici vətəndaş olan məzunun `awarding_body_country` ilə vətəndaşlıq əlaqəsi —
   sxemdə vətəndaşlıq sahəsi yoxdur, bu, şüurlu seçimdir. Ekvivalentlik ssenarisində lazım olarsa, NATIONAL
   sxemə.
5. ISCED-F uyğunluq cədvəlinə kim baxır? Təklif: `@tamga-network/schemas` paketində
   ümumi cədvəl + quruma görə üstələmə (override).

---

# Əlaqəli sənədlər

[[SPEC-SCHEMA-0001]] · [[RS-SCHEMA-0001]] · [[ADR-0007]] · [[ADR-0008]] ·
[[SPEC-CRED-0001]] · [[SPEC-CRED-0002]] · [[SPEC-BC-0001]] · [[PM-ASSUR-0001]] ·
PM-GTM-0001 · [[ARCH-0003]]

---

# Status

**Qüvvədədir** — versiya 1.0.0 (2026-10-02).

