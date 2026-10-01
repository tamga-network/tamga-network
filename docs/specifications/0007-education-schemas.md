---
document_id: SPEC-SCHEMA-0002
title: Eğitim Şemaları — TamgaStudentCredential ve TamgaDiplomaCredential
category: Specification
domain: Schema
status: Active
review_status: Draft
version: 2.0.0
created: 2026-09-09
last_updated: 2026-09-24
authors:
  - Tamga Network Engineering
language: tr
document_type: specification
audience:
  - engineers
  - architects
  - ai-agents
tags:
  - schema
  - education
  - diploma
  - student
  - elm
  - selective-disclosure
keywords:
  - TamgaStudentCredential
  - TamgaDiplomaCredential
  - ELM v3 mapping
  - EQF ISCED-F ESCO codes
  - derived boolean claims age_over pattern
  - JSON Schema 2020-12
  - OBS student information system mapping
  - selective disclosure policy
summary: >
  Pilotun iki credential tipini normatif olarak tanımlar. TamgaStudentCredential:
  kısa ömürlü (90 gün), status list kullanmaz, öğrencilik durumunu kanıtlar.
  TamgaDiplomaCredential: uzun ömürlü, status list kullanır, mezuniyeti kanıtlar.
  Her ikisi için tam JSON Schema, Type Metadata, ELM v3 eşleme tablosu, seçici
  açıklama politikası, türetilmiş boolean claim'ler, örnek payload ve
  üniversite öğrenci bilgi sistemi (OBS) alan eşlemesi verilir. Kapsam
  bilinçli olarak dardır — transkript, mikro-credential ve diğer tipler
  pilot sonrasına bırakılmıştır.
priority: Critical
related:
  - SPEC-SCHEMA-0001
  - RS-SCHEMA-0001
  - ADR-0007
  - ADR-0008
  - SPEC-CRED-0001
  - PM-ASSUR-0001
  - PM-GTM-0001
depends_on:
  - SPEC-SCHEMA-0001
  - ADR-0006
---
> **Sürüm notu 2.0.0 (2026-09-24) — ADR-0009 / ADR-0010 senkronu (DECISIONS §10.7):** `vct` değerleri URN (`urn:tamga:edu:StudentCredential:1`, `urn:tamga:edu:DiplomaCredential:1`; kök `urn:tamga:core:TamgaBaseCredential:1`), `extends` URN, `vct#integrity` zorunlu ([[ADR-0010]]); **erratum:** JSON Schema `$ref`'leri `../../core/…` → `../../../core/…` (10 yer; `v1/edu/<Type>/1.0.0/schema.json` konumundan kök tipe üç seviye — `packages/schemas` böyle üretir). E1–E11 değişmedi. Kurum-okunur kurallar: [[FW-RB-0002]].


# Kapsam

Bu spesifikasyon **iki** credential tipini tanımlar:

| `vct` | Amaç |
|---|---|
| `.../v1/edu/StudentCredential/1.0.0` | Öğrencilik durumu |
| `.../v1/edu/DiplomaCredential/1.0.0` | Mezuniyet |

**Kapsam dışı (bilinçli):** transkript, ders tamamlama, mikro-credential,
mezuniyet-yakında, disiplin belgesi. Bunlar pilot sonrasına bırakıldı; her yeni
tip, üniversitenin öğrenci bilgi sisteminden (OBS) ek veri çekmek demektir ve
pilotun en kırılgan noktası entegrasyon yüzeyidir.

Kayıt defteri mekanizması [[SPEC-SCHEMA-0001]]'de, şemaların dayandığı
uluslararası modeller [[RS-SCHEMA-0001]]'dedir.

---

# 1. Ortak Temel

Her iki tip de `core/TamgaBaseCredential/1.0.0`'dan türer
([[SPEC-SCHEMA-0001]] §4). Kök tipten gelen `iss`, `vct`, `vct#integrity`,
`iat`, `cnf` claim'leri burada tekrar edilmez.

## 1.1 Ortak eğitim claim'leri

İki tipte de bulunan alanlar:

| Claim | Tip | `sd` | ELM karşılığı |
|---|---|---|---|
| `family_name` | string | `always` | `Person.familyName` |
| `given_name` | string | `always` | `Person.givenName` |
| `birth_date` | DateOnly | `always` | `Person.dateOfBirth` |
| `awarding_body_name` | LangString | `allowed` | `Organisation.legalName` |
| `awarding_body_id` | string | `allowed` | `Organisation.identifier` |
| `awarding_body_country` | string (ISO 3166-1 alpha-2) | `allowed` | `Organisation.location.country` |

`awarding_body_id`, kurumun ulusal kayıt numarasıdır (Türkiye'de YÖK kurum
kodu). `iss` ile karıştırılmamalıdır: `iss` kriptografik issuer kimliğidir,
`awarding_body_id` idari kurum kimliğidir. Aynı kurum olmayabilirler — bir
üniversite adına merkezî bir issuer servisi imzalıyor olabilir.

## 1.2 Kimlik numarası hakkında karar

**TCKN veya muadili ulusal kimlik numarası bu şemalarda yer almaz.**

### 1.2.1 `cnf` ne kanıtlar, ne kanıtlamaz

Bu ayrım yanlış anlaşılmaya çok müsaittir ve şemanın gerekçesi buna dayandığı
için burada net yazılmalıdır.

`cnf` claim'i ve key binding ([[SPEC-CRED-0001]] §3) şunu kanıtlar:

> Belgeyi sunan taraf, ihraç anında bu belgeye bağlanmış olan özel anahtarı
> kontrol ediyor.

Yani **"ihraçtaki holder ile sunumdaki holder aynı"**. Kanıtlamadığı şey:

> Karşındaki insan, belgede adı geçen kişidir.

`cnf` bir **cihaz anahtarına** bağlar, bir **insana** değil. Ayşe telefonunu ve
PIN'ini bir başkasına verirse, o kişi geçerli imzalı ve geçerli key-binding'li
bir diploma sunar; doğrulama zincirinin hiçbir adımı hata vermez.

### 1.2.2 Kimlik eşleştirmesini ne çözer

Doğru çözüm **birleşik sunumdur**: aynı OpenID4VP isteğinde diploma ve devlet
kimlik credential'ı (PID) birlikte sunulur, ikisi de **aynı `cnf` anahtarına**
bağlıdır. Verifier böylece iki belgenin aynı cüzdana ait olduğunu bilir ve
kimliği PID taşır. EUDI ekosisteminin yaklaşımı budur ([[RS-EIDAS-0001]]).

**Faz 0'da PID yoktur.** Devlet katılımı olmadan bu mekanizma çalışmaz.

### 1.2.3 Faz 0 sınırlaması (açıkça kaydedilmiştir)

Pilotta gerçekte olan şudur: verifier, credential'daki `family_name`,
`given_name` ve `birth_date` alanlarını, adayın ayrıca sunduğu bir kimlik
belgesiyle karşılaştırır.

Bu, kriptografik değil **prosedürel** bir eşleştirmedir ve zayıftır. Ancak
bugün kâğıt diplomayla yapılanın birebir aynısıdır — yani Tamga bu konuda bir
gerileme getirmez, sadece beklenen iyileşmeyi Faz 1'e erteler.

**Bu sınırlama pilot katılımcılarına (üniversite ve verifier) açıkça
bildirilmelidir.** → [[PM-GTM-0001]] iş kalemi.

### 1.2.4 Kimlik numarasının eklenmemesinin gerekçesi

Yukarıdakinden çıkan sonuç: kimlik numarası eklemek bu problemi **çözmezdi.**
Sahte sunum yapan kişinin elinde belgenin sahibinin kimlik numarası da olurdu;
prosedürel eşleştirme aynı kalırdı.

Buna karşılık kimlik numarası eklemenin kesin bir maliyeti vardır: ağ genelinde
kalıcı ve benzersiz bir **korelasyon anahtarı** yaratır. Farklı issuer'lardan
alınmış belgeler, farklı verifier'lara yapılmış sunumlar, aynı numara üzerinden
birleştirilebilir hâle gelir.

Sıfır fayda, kesin maliyet → alan şemada yoktur.

İhtiyaç duyulan istisnai senaryolar (resmî denklik işlemi, kamu istihdamı) için
ayrı bir NATIONAL şema yazılır — `tr/edu/...` — ve orada alan `sd: always`
olur.

---

# 2. TamgaStudentCredential

> **2026-09-30 (geliştirme evresi, [[ADR-0029]]):** isteğe bağlı `credit_points` (program iş yükü, AKTS) ve `enrollment_date` (kayıt tarihi) — AB DC4EU kayıt belgesinde (EUHEPOE) zorunlu alanlar; `tamga.elm_mapping` ile her claim'in ELM karşılığı. Şema 1.0.0 yerinde güncellendi. DiplomaCredential'a da ELM karşılıkları eklendi (EUHED).

## 2.1 Tasarım kararları

| Konu | Karar | Gerekçe |
|---|---|---|
| Ömür | **En fazla 90 gün** (`exp` zorunlu) — tavan, sabit değil | Öğrencilik durumu değişkendir |
| Status list | **Kullanılmaz** | [[ADR-0008]] Alt. C — kısa ömür iptalin yerine geçer |
| Issuer assurance | **I2** asgari | [[PM-ASSUR-0001]] |
| Tazelik | **Verifier politikası** belirler — §2.1.2 | Risk seviyesi verifier'a göre değişir |
| Yenileme | Öğrenci istediğinde; batch ile | Otomatik yenileme yok (takip yüzeyi) |

**Status list neden yok:** 90 günlük bir belgede iptal mekanizması işletmek,
kazandırdığından çok maliyet getirir. Buna karşılık her öğrenci için bir status
index tutmak, issuer'a kalıcı operasyon yükü ve bir korelasyon yüzeyi ekler.

### 2.1.1 Bayat belge açığı (kabul edilmiş ve yönetilen risk)

Kısa ömrün iptalin yerine geçmesi **bedelsiz değildir.** Bir öğrenci belgeyi
aldıktan bir gün sonra kaydını sildirirse, elinde 89 gün daha geçerli bir
"aktif öğrenciyim" belgesi kalır. Doğrulama zincirinin hiçbir adımı bunu
yakalamaz.

Etkisi kullanım senaryosuna göre değişir:

| Senaryo | Bayat belge riski |
|---|---|
| Öğrenci indirimi (sinema, ulaşım, yazılım lisansı) | Düşük — mali kayıp sınırlı |
| Kütüphane/kampüs erişimi | Düşük — fiziksel kontrol var |
| Sınav başvurusu, burs | Orta |
| Öğrenci vizesi, ikamet izni | **Yüksek** |

Bu şema NETWORK katmanındadır ve uzun ömürlüdür; bugün sinema indirimi için
kullanılan tip yarın ikamet izni için kullanılabilir. Çözüm status list eklemek
değil, **tazeliği verifier'a taşımaktır.**

### 2.1.2 Verifier tazelik politikası (mekanizma)

`default_ttl_days: 90` bir **tavandır.** Issuer daha kısa `exp` verebilir ve
yüksek riskli senaryolarda vermelidir.

Verifier tarafında mekanizma şudur: sunum isteğinde **azami `iat` yaşı**
belirtilir.

> *"Son 7 gün içinde ihraç edilmiş bir `StudentCredential` istiyorum."*

Cüzdan bu koşulu sağlayan bir belge taşımıyorsa, kullanıcıyı issuer'dan yeni
belge almaya yönlendirir. İptal altyapısı gerekmez; tazelik gereksinimi riski
üstlenen tarafta tanımlanır.

Önerilen eşikler ([[SPEC-PROTO-0002]]'de normatifleşecek):

| Risk | Azami `iat` yaşı |
|---|---|
| Düşük (indirim) | 90 gün |
| Orta (burs, sınav) | 14 gün |
| Yüksek (resmî işlem) | 24 saat – 7 gün |

### 2.1.3 Batch issuance (mahremiyet dengelemesi)

§2.1.2'nin bedeli, sık yenilemedir. Cüzdan her tazelik ihtiyacında issuer'a
gidiyorsa, üniversite "bu kişi belgesini ne sıklıkla kullanıyor" sinyalini
düzenli alır — sessiz bir takip kanalı.

Çözüm **batch issuance**'tır: cüzdan tek bir ihraç oturumunda birden çok
(öneri: 10–12) belge alır, her sunumda **farklı** bir tanesini harcar. Üniversite
yalnızca toplu alım anını görür, tekil kullanımları görmez.

Batch issuance OpenID4VCI'nin desteklediği bir özelliktir; protokol ayrıntısı
[[SPEC-PROTO-0001]]'de tanımlanacaktır.

**Otomatik yenileme yine yoktur.** Batch alımı kullanıcı eylemiyle başlar;
cüzdan arka planda kendiliğinden yenileme yapmaz.

## 2.2 Claim tablosu

| Claim | Tip | Zorunlu | `sd` | Açıklama |
|---|---|---|---|---|
| `student_status` | enum | ✓ | `allowed` | `ACTIVE` \| `ON_LEAVE` — §2.2.1 |
| `enrollment_year` | integer | ✓ | `allowed` | Kayıt yılı |
| `study_level` | integer (EQF) | ✓ | `allowed` | 5–8 |
| `programme_title` | LangString | ✓ | `allowed` | Program adı |
| `isced_f_code` | string | ✓ | `allowed` | ISCED-F 2013, 2–4 hane — §6.4 |
| `faculty_name` | LangString | — | `allowed` | Fakülte |
| `expected_graduation_year` | integer | — | `allowed` | Tahmini |
| `is_enrolled` | boolean | ✓ | `allowed` | **Türetilmiş** — §2.3 |

### 2.2.1 `student_status` neden `GRADUATED` içermez

Bu şemanın 1.0.0 taslağında enum `ACTIVE | ON_LEAVE | GRADUATED` idi.
`GRADUATED` **kaldırılmıştır.**

Gerekçe: mezuniyeti kanıtlayan belge `TamgaDiplomaCredential`'dır. Aynı olguyu
iki tipte temsil etmek [[PM-SCHEMA-0001]] Zafiyet 2'nin (anlam parçalanması)
şema içi hâlidir — verifier "hangisine bakayım" sorusuyla kalır.

Ayrıca yapısal olarak tutarsızdı: `GRADUATED` durumundaki bir kişi 90 gün sonra
belgeyi **yenileyemez**, çünkü artık o kurumun öğrencisi değildir. Yani kısa
ömürlü bir tipte kalıcı bir olguyu taşıyordu.

Mezunun "bu kurumda okudum" kanıtına ihtiyacı varsa (diploma almadan ayrılmış
olabilir), bu ayrı bir tiptir — `AttendanceCredential`, pilot kapsamı dışında.

## 2.3 Türetilmiş claim — `is_enrolled`

[[RS-SCHEMA-0001]] §4'teki `age_over_NN` deseninin uygulaması.

`is_enrolled = (student_status == "ACTIVE")`

**Neden ayrı bir claim:** Öğrenci indirimi isteyen bir sinema, üniversitesini,
bölümünü ve kayıt yılını bilmek zorunda değildir. Tek ihtiyacı "şu an öğrenci
mi" bilgisidir. Ayrı bir boolean claim olduğu için öğrenci **yalnızca onu**
açıklayabilir; diğer alanlar disclosure olarak hiç sunulmaz.

Bu, seçici açıklamanın en somut kazanımıdır ve pilotu anlatırken en kolay
gösterilen şeydir.

## 2.4 JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.tamga.network/v1/edu/StudentCredential/1.0.0/schema.json",
  "title": "TamgaStudentCredential",
  "type": "object",
  "required": [
    "iss", "vct", "iat", "exp", "cnf",
    "family_name", "given_name", "birth_date",
    "awarding_body_name", "awarding_body_id", "awarding_body_country",
    "student_status", "enrollment_year", "study_level",
    "programme_title", "isced_f_code", "is_enrolled"
  ],
  "properties": {
    "iss":   { "type": "string", "format": "uri" },
    "vct":   { "const": "urn:tamga:edu:StudentCredential:1" },
    "iat":   { "type": "integer" },
    "exp":   { "type": "integer" },
    "cnf":   { "type": "object" },

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

    "is_enrolled": { "type": "boolean" }
  },
  "additionalProperties": false
}
```

`additionalProperties: false` bilinçlidir. Issuer'ın şemaya olmayan alan
eklemesi engellenir; ihtiyaç varsa MINOR sürüm çıkarılır. Serbest bırakmak,
[[PM-SCHEMA-0001]] Zafiyet 2'yi (anlam parçalanması) arka kapıdan geri getirir.

## 2.5 Örnek payload (disclosure öncesi)

```json
{
  "iss": "https://issuer.bilgi.edu.tr",
  "vct": "urn:tamga:edu:StudentCredential:1",
  "vct#integrity": "sha256-9Kf2rT8xQm1vB4nL7wZpYc3JdHs0EaXu6GiOoN5RbMk=",
  "iat": 1789000000,
  "exp": 1796776000,
  "cnf": { "jwk": { "kty": "EC", "crv": "P-256", "x": "...", "y": "..." } },

  "family_name": "Yılmaz",
  "given_name": "Ayşe",
  "birth_date": "2003-04-17",

  "awarding_body_name": {
    "tr-TR": "İstanbul Bilgi Üniversitesi",
    "en-US": "Istanbul Bilgi University"
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

  "is_enrolled": true
}
```

Sinema senaryosunda öğrencinin sunduğu tek disclosure `is_enrolled`'dur. Kalan
tüm alanlar `_sd` dizisinde hash olarak kalır; sinema `family_name`'i bile
görmez.

---

# 3. TamgaDiplomaCredential

## 3.1 Tasarım kararları

| Konu | Karar | Gerekçe |
|---|---|---|
| Ömür | **Süresiz** (`exp` yok) | Diploma kalıcıdır |
| Status list | **Kullanılır** | [[ADR-0008]] — iptal gerçek bir ihtiyaç |
| Issuer assurance | **I2** asgari | [[PM-ASSUR-0001]] |
| Holder assurance | İhraç anında **T2** asgari önerilir | [[SPEC-CRED-0001]] §3 |

**`exp` neden yok:** Diplomanın son kullanma tarihi yoktur. Yenilenmesi
gerekmez ve yenileme zorunluluğu koymak, mezunu ömür boyu üniversiteye bağımlı
kılar.

**Status list neden var:** Diploma iptali nadir ama gerçektir — intihal tespiti,
sahte belge ile kayıt, disiplin kararı. Öğrenci belgesinden farkı, kısa ömrün
iptalin yerine geçememesidir.

## 3.2 Claim tablosu

| Claim | Tip | Zorunlu | `sd` | ELM karşılığı |
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
| `is_graduate` | boolean | ✓ | `allowed` | **türetilmiş** |
| `graduated_before` | integer | — | `allowed` | **türetilmiş** |
| `status` | object | ✓ | `never` | — ([[ADR-0008]]) |

## 3.3 Not (`grade`) neden `sd: always`

Bu, şemanın en önemli tasarım kararıdır.

Bir işveren "mezun mu" sorusunu sorar; "kaçla mezun" sorusunu sormaya çoğu
durumda hakkı yoktur ve pratikte de ihtiyacı yoktur. Notu `sd: always`
yapmak, issuer'ın onu **zorunlu olarak** seçici-açıklanabilir yapmasını
sağlar — yani mezun, diplomayı notunu göstermeden sunabilir.

Kâğıt diplomada bu mümkün değildir: belgeyi verirsin, üstündeki her şey görünür.
Tamga'nın somut üstünlüğü budur ve şema seviyesinde zorlanmazsa gerçekleşmez.

Aynı mantık `thesis_title` için de geçerlidir: tez başlığı, kişinin ilgi alanı
ve bazen siyasi/dinî görüşü hakkında bilgi taşıyabilir.

## 3.4 Türetilmiş claim'ler

**`is_graduate`** — her zaman `true`. Diplomanın varlığı mezuniyeti ima eder;
ama ayrı bir claim olması, mezunun **yalnızca bunu** açıklayabilmesini sağlar.
Bir işveren "diploması var mı" kontrolünde `is_graduate` + `awarding_body_name`
görür; program, not, tarih hiç açılmaz.

**`graduated_before`** — bir yıl değeri. `awarding_date`'in yılından türetilir.
"2020'den önce mezun" gibi kıdem koşullarını, tam mezuniyet tarihini açıklamadan
kanıtlar. `age_over_NN` deseninin doğrudan uygulaması.

Issuer bu alanı **her zaman** doldurur; hangi eşiklerde üretileceği
`tamga.derived_claims` içinde tanımlıdır.

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

## 3.6 Örnek payload (disclosure öncesi)

```json
{
  "iss": "https://issuer.bilgi.edu.tr",
  "vct": "urn:tamga:edu:DiplomaCredential:1",
  "vct#integrity": "sha256-3Qm2pV7yLx0KcW9tRfBnEsA4ZhUgJd1MoI6TvXbCqNw=",
  "iat": 1789000000,
  "cnf": { "jwk": { "kty": "EC", "crv": "P-256", "x": "...", "y": "..." } },
  "status": {
    "status_list": {
      "idx": 48213,
      "uri": "https://status.bilgi.edu.tr/v1/sl/7f3a9c21"
    }
  },

  "family_name": "Yılmaz",
  "given_name": "Ayşe",
  "birth_date": "2003-04-17",

  "awarding_body_name": {
    "tr-TR": "İstanbul Bilgi Üniversitesi",
    "en-US": "Istanbul Bilgi University"
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

## 3.7 İşveren senaryosu — ne açılır, ne açılmaz

Ayşe bir işverene başvuruyor. İşveren bir lisans diploması arıyor.

| Alan | Açılır mı | Neden |
|---|---|---|
| `is_graduate` | ✓ | Sorunun kendisi |
| `qualification_title` | ✓ | Hangi alan |
| `eqf_level` | ✓ | Seviye — makine okunur |
| `isced_f_code` | ✓ | Alan kodu — uluslararası tanınır |
| `awarding_body_name` | ✓ | Hangi kurum |
| `awarding_date` | ✓ | Kıdem hesabı |
| `family_name`, `given_name` | ✓ | Başvuru zaten isimli |
| `birth_date` | ✗ | Yaş ayrımcılığı yüzeyi |
| `grade` | ✗ | İşverenin ihtiyacı yok |
| `thesis_title` | ✗ | Görüş/ilgi alanı sızdırır |
| `credit_points`, `mode_of_study` | ✗ | İlgisiz |

Sunulan SD-JWT'de yalnızca ilk yedi alan disclosure olarak yer alır. Kalanlar
`_sd` içinde hash olarak kalır ve işveren varlıklarını bile ayırt edemez —
disclosure sayısı sabit olmadığı için hangi alanların gizlendiği de belli
olmaz.

Verifier'ın bu alanları isteme yetkisi ayrıca `RelyingPartyRegistry` scope'u ile
sınırlanır ([[SPEC-BC-0001]] §4).

---

# 4. ELM Eşleme Tablosu (Normatif)

[[RS-SCHEMA-0001]] §9 gereği zorunlu. Bu tablo olmadan şema "standart hizalı
görünen ama olmayan" bir şemadır.

## 4.1 DiplomaCredential ↔ ELM v3

| Tamga claim | ELM v3 yolu | OBv3 karşılığı |
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
| `is_graduate` | *(türetilmiş — ELM karşılığı yok)* | — |
| `graduated_before` | *(türetilmiş — ELM karşılığı yok)* | — |

## 4.2 Düzleştirme kuralı doğrulaması

[[RS-SCHEMA-0001]] §9 "iki seviyeden derin gitme" kuralı bu şemada tutuyor:
ELM'de dört seviye derinlikte olan `hasClaim.awardedBy.awardingBody.legalName`,
Tamga'da tek düzey `awarding_body_name` claim'idir.

## 4.3 Dışa aktarım

`mapping.json` dosyası ([[SPEC-SCHEMA-0001]] §1.3) bu tabloyu makine okunur
biçimde taşır. Bir Tamga diplomasının EDC'ye (Europass) dışa aktarılması bu
dosyayla yapılır.

**Kayıp uyarısı:** Türetilmiş claim'lerin (`is_graduate`, `graduated_before`)
ELM karşılığı yoktur; dışa aktarımda düşerler. Bu bir hata değil, beklenen
davranıştır — türetilmiş claim'ler Tamga'nın mahremiyet katmanına aittir.

---

# 5. Type Metadata Dokümanları

## 5.1 StudentCredential

```json
{
  "vct": "urn:tamga:edu:StudentCredential:1",
  "name": "Tamga Student Credential",
  "description": "Bir yükseköğretim kurumundaki öğrencilik durumunu kanıtlar.",
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
  "description": "Bir yükseköğretim kurumunun verdiği mezuniyet belgesi.",
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

# 6. OBS Entegrasyon Eşlemesi

Pilotun en kırılgan noktası, üniversitenin öğrenci bilgi sisteminden veri
çekmektir. Bu bölüm, issuer servisinin ([[ARCH-0003]]) ihtiyaç duyduğu asgari
alan setini tanımlar.

## 6.1 StudentCredential için gereken OBS alanları

| Tamga claim | Tipik OBS alanı | Not |
|---|---|---|
| `family_name`, `given_name` | Öğrenci ad/soyad | — |
| `birth_date` | Doğum tarihi | — |
| `student_status` | Kayıt durumu | OBS enum'u `ACTIVE`/`ON_LEAVE`'e eşlenmeli |
| `enrollment_year` | Kayıt yılı | Öğrenci numarasından türetilebilir |
| `study_level` | Program türü → EQF | §6.3 eşleme |
| `programme_title` | Program adı | İngilizcesi de gerekir |
| `isced_f_code` | — | OBS'de yok; ulusal YÖK tablosundan türetilir — §6.4 |
| `faculty_name` | Fakülte | — |

## 6.2 DiplomaCredential için ek alanlar

`qualification_title`, `awarding_date` (mezuniyet kararı tarihi),
`credit_points` (toplam AKTS), `grade` (mezuniyet ortalaması),
`grading_scheme`, `thesis_title` (varsa).

## 6.3 Program türü → EQF eşlemesi (Türkiye)

| Program | EQF | TYÇ |
|---|---|---|
| Ön lisans | 5 | TYC-5 |
| Lisans | 6 | TYC-6 |
| Yüksek lisans | 7 | TYC-7 |
| Doktora | 8 | TYC-8 |

## 6.4 ISCED-F kodu — ulusal sınıflandırmanın devralınması

ISCED-F kodu üniversitelerin OBS'lerinde alan olarak genellikle **bulunmaz.**
Ancak bu, kodun üretilemeyeceği anlamına gelmez — çünkü eşleme işi Türkiye'de
**ulusal düzeyde zaten yapılmıştır.**

### 6.4.1 Mevcut ulusal kaynak

YÖK, 2020'de yükseköğretim sistemindeki benzer içerikli veya benzer isimli tüm
aktif, pasif ve kapanan önlisans ve lisans programlarını ISCED-F 2013
sınıflaması referans alınarak bilimsel ölçütlere göre tek isim altında
birleştirmiştir. Süreçte 55 üniversiteden 120 akademisyenin katıldığı 17 çalışma
komisyonu görev almış, program sayısı yaklaşık 2.230'dan 679'a inmiştir. YÖK'ün
uluslararası birimi ayrıca lisans programlarının ISCED-F 2013 sınıflandırmasını
içeren bir doküman yayımlamıştır.

**Sonuç:** iş kalemi "her üniversite kendi tablosunu çıkarır" değil, **"ulusal
tablo bir kez içe aktarılır ve doğrulanır"**dır. 200 üniversite aynı işi 200 kez
yapmaz.

### 6.4.2 Uygulama

Eşleme tablosu `@tamga-network/schemas` paketinde **sürümlenmiş ağ varlığı** olarak
tutulur ([[ARCH-0005]]):

```
tr/isced-f-2013-programs.json   # YÖK program adı → ISCED-F kodu
```

Issuer servisi, OBS'den gelen program adını bu tabloyla eşler. Tabloda
bulunmayan program için ihraç **durur** ve operatöre düşer — sessizce boş veya
tahmini kod üretmez.

Kurum bazlı istisna (tabloda olmayan yeni program) `overrides` dosyasıyla
tanımlanır ve o da sürümlenir.

### 6.4.3 Asıl risk: yanlış kod

**Kod eksikliği değil, yanlış kod tehlikelidir.** Diploma imzalı, değişmez ve
kırk yıl yaşayan bir belgedir. Yanlış bir ISCED-F kodunun tek düzeltme yolu
belgeyi iptal edip yeniden vermektir; kâğıt diplomadaki gibi bir tashih
mümkün değildir.

Azaltma:

1. **Tablo ağ varlığıdır**, üniversite başına doğaçlama değil (§6.4.2).
2. **İki kademeli onay:** tabloyu üniversitenin öğrenci işleri **ve** bir Tamga
   gözden geçireni ilk ihraçtan önce onaylar.
3. **Kademeli kod izni** (§6.4.4) — emin olunmayan yerde daha genel kod.
4. **Örnek denetim:** ilk 100 belgede kod doğruluğu elle örneklenir.

### 6.4.4 Kod kademesi — neden 2–4 hane

ISCED-F 2013 üç kademelidir: **2 hane** geniş alan (10 adet), **3 hane** dar
alan (29 adet), **4 hane** ayrıntılı alan (80 adet).

Şemanın 1.0.0 taslağı `^[0-9]{4}$` ile en ayrıntılı kademeyi zorunlu tutuyordu.
1.1.0'da desen **`^[0-9]{2,4}$`** olarak gevşetilmiştir.

Gerekçe: ayrıntılı kademede hata olasılığı belirgin biçimde yüksektir ve §6.4.3
gereği hatanın bedeli kalıcıdır. Üniversite emin olmadığı programda 3 haneli dar
alan kodu verebilir; Kazakistan'daki bir işveren yine kullanılabilir bir sinyal
alır ("mühendislik ve mühendislik meslekleri" düzeyinde). Emin olunan
programlarda 4 hane kullanılır.

Kesinlik kaybı vardır; yanlış kod riskinden ucuzdur.

**Alanı tamamen opsiyonel yapmak reddedilmiştir** — ISCED-F, uluslararası
tanınırlığın taşıyıcısıdır ([[SPEC-SCHEMA-0001]] §8.3). Alan düşerse diploma
sınır ötesinde okunamayan bir metne dönüşür.

### 6.4.5 Pilot iş kalemi

→ [[PM-GTM-0001]]: *"YÖK ISCED-F 2013 program sınıflandırmasının içe aktarımı,
güncelliğinin teyidi ve pilot üniversitenin program listesiyle
karşılaştırılması."*

**Teyit notu:** Kaynak 2020 tarihlidir ve sonrasında güncellenmiş olabilir.
Pilot öncesi YÖK'ün güncel yayınından doğrulanmalıdır.

---

# 7. Değişmezler

| # | Değişmez |
|---|---|
| **E1** | Ulusal kimlik numarası bu iki NETWORK şemasında yer almaz (§1.2). |
| **E2** | `grade` ve `thesis_title` her zaman `sd: always`'tir (§3.3). |
| **E3** | `is_graduate` sabit `true`'dur; `false` bir diploma anlamsızdır. |
| **E4** | `StudentCredential` `exp` taşır; `DiplomaCredential` taşımaz. |
| **E5** | `DiplomaCredential` `status` taşır; `StudentCredential` taşımaz. |
| **E6** | Her iki şemada `additionalProperties: false`. |
| **E7** | `isced_f_code` her iki şemada zorunludur; 2, 3 veya 4 hane olabilir. |
| **E8** | Her `LangString` alanı en az kurumun resmî dilini içerir. |
| **E9** | `StudentCredential.exp - iat` ≤ 90 gün (tavan, §2.1.2). |
| **E10** | Hiçbir NETWORK eğitim şeması ulusal kimlik numarası alanı içermez (§1.2). |
| **E11** | Eşleme tablosunda karşılığı olmayan program için ihraç durur; tahmini kod üretilmez (§6.4.2). |

---

# Güvenlik ve Mahremiyet Notları

**Disclosure sayısı bir yan kanaldır.** Verifier, sunulan disclosure sayısından
"kaç alan gizlendi" bilgisini çıkarabilir. Tek başına zararsızdır ama iki
sunumun karşılaştırılmasıyla korelasyon üretebilir. Azaltma: cüzdan, aynı
verifier'a yapılan tekrar sunumlarda tutarlı bir disclosure seti kullanmalıdır.

**Status index korelasyonu.** `status.status_list.idx` her sunumda görünür
(`sd: never`) ve sabittir. Aynı diplomayı iki farklı verifier'a sunan bir mezun,
o iki verifier iş birliği yaparsa eşleştirilebilir. Bu bilinen bir SD-JWT
sınırıdır; çözümü batch issuance'tır ([[SPEC-CRED-0001]] §5, Faz 2).
**Pilotta kabul edilen risktir ve pilot katılımcılarına açıkça bildirilmelidir.**

**Status listesi, gizlenmiş claim'leri sızdırabilir.** `status` bloğu
`sd: never` olduğu için hem `idx` hem **liste URI'si** her sunumda görünür.
Liste URI'si veya listenin bölünme ölçütü kohort bilgisi taşıyorsa,
`awarding_date` veya `programme_title` gizlenmiş olsa bile bu bilgiler sızar.

Somut örnek: `.../statuslist/edu-2026-a` biçimindeki bir URI, mezuniyet yılını
doğrudan ele verir — mezun `awarding_date`'i açıklamamış olsa dahi.

Bu yüzden [[SPEC-CRED-0003]] §6.3 ve §6.4 iki kuralı **normatif** kılar:
liste URI'si opaktır ve listeler yıl/bölüm/kohort ölçütüyle bölünmez. Bu
dokümandaki örnekler (§3.6) o kurala uygundur.

**`birth_date` neden `sd: always`.** Doğum tarihi, isimle birleştiğinde
yüksek olasılıkla benzersiz bir tanımlayıcıdır. Zorunlu olarak gizlenebilir
olması, mezunun onu vermemeyi seçebilmesini garanti eder.

---

# Açık Konular

1. `student_status` enum'u tüm üye devletlerin eğitim sistemlerini kapsıyor mu?
   (`ON_LEAVE` karşılığı her ülkede var mı?)
1b. ~~Batch parti büyüklüğü~~ — **KAPANDI** (2026-09-09, [[SPEC-PROTO-0001]]
   §8.3): **10**. Öğrenci belgesinde Faz 0'da etkin; diplomada Faz 1'e ertelendi
   çünkü her kopya ayrı status indeksi tüketiyor (§8.4–8.5).
1c. `AttendanceCredential` (diploma almadan ayrılanlar için) ne zaman
   yazılacak? Pilot dışı ama talep gelebilir.
2. Çift anadal / yandal diploması nasıl temsil edilir — iki ayrı credential mı,
   tek credential'da dizi mi? Öneri: **iki ayrı credential** (basitlik).
   Karar bekliyor.
3. Yabancı uyruklu mezunun `awarding_body_country` ile uyruk ilişkisi —
   şemada uyruk alanı yok, bilinçli. Denklik senaryosunda gerekirse NATIONAL
   şemaya.
4. ISCED-F eşleme tablosunun bakımı kimde? Öneri: `@tamga-network/schemas` paketinde
   ortak tablo + kurum bazlı geçersiz kılma.

---

# İlgili Dokümanlar

[[SPEC-SCHEMA-0001]] · [[RS-SCHEMA-0001]] · [[ADR-0007]] · [[ADR-0008]] ·
[[SPEC-CRED-0001]] · [[SPEC-CRED-0002]] · [[SPEC-BC-0001]] · [[PM-ASSUR-0001]] ·
[[PM-GTM-0001]] · [[ARCH-0003]]

---

# Durum

**Draft** — 2026-09-09, sürüm 1.2.0. Kapsam bilinçli olarak iki tiple
sınırlıdır.

**1.0.0 → 1.2.0 değişiklikleri** (hepsi taslak aşamasında, yayınlanmamış
şema üzerinde — bu yüzden MAJOR değil MINOR):

1. `student_status` enum'undan `GRADUATED` kaldırıldı (§2.2.1).
2. `default_ttl_days` tavan olarak yeniden tanımlandı; verifier tazelik
   politikası (§2.1.2) ve batch issuance (§2.1.3) mekanizma olarak eklendi;
   bayat belge açığı §2.1.1'de kabul edilmiş risk olarak kaydedildi.
3. §1.2 yeniden yazıldı. Önceki sürüm `cnf`'in kimlik eşleştirmesini
   çözdüğünü ima ediyordu; bu **yanlıştı**. `cnf` anahtar kontrolünü
   kanıtlar, kişi kimliğini değil (§1.2.1). Faz 0 sınırlaması §1.2.3'te
   açıkça kaydedildi.
4. `isced_f_code` deseni `^[0-9]{4}$` → `^[0-9]{2,4}$` (§6.4.4).
5. §6.4 yeniden yazıldı: YÖK'ün mevcut ulusal ISCED-F 2013 sınıflandırması
   kaynak alındı; iş kalemi üniversite başına eşlemeden ulusal tablo
   içe aktarımına indirildi.
6. §3.6 örneğindeki status list URI'si (`edu-2026-a`) **sızdıran bir
   desendi** — mezuniyet yılını `awarding_date` gizlenmiş olsa bile ele
   veriyordu. Opak tanımlayıcıyla değiştirildi ve kural
   [[SPEC-CRED-0003]] §6.3'te normatifleştirildi.
 Örneklerdeki `#integrity` değerleri temsilîdir; gerçek
değerler yayın hattında ([[SPEC-SCHEMA-0001]] §6) hesaplanır. ISCED-F kodu
`0613` ve YÖK kurum kodu biçimi pilot öncesi saha doğrulaması gerektirir.
