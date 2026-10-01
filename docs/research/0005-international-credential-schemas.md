---
document_id: RS-SCHEMA-0001
title: Uluslararası Credential Şema Standartları — ELM, Open Badges, FHIR, mDL, DTC, vLEI
category: Research
domain: Schema
status: Active
review_status: Draft
version: 1.0.0
created: 2026-09-09
last_updated: 2026-09-09
authors:
  - Tamga Network Engineering
language: tr
document_type: research
audience:
  - engineers
  - architects
  - ai-agents
tags:
  - schema
  - elm
  - europass
  - open-badges
  - fhir
  - mdl
  - iso-18013-5
  - icao-dtc
  - vlei
  - un-cefact
keywords:
  - European Learning Model ELM v3
  - European Digital Credential for Learning EDC
  - Open Badges 3.0 CLR 2.0
  - HL7 FHIR International Patient Summary
  - ISO/IEC 18013-5 mobile driving licence
  - ICAO Digital Travel Credential
  - GLEIF vLEI UN/CEFACT
  - JSON-LD to SD-JWT VC mapping
summary: >
  Tamga'nın kendi credential şemalarını sıfırdan icat etmemesi için, alan alan
  hangi uluslararası veri modelinin devralınacağını inceler: eğitim (ELM v3 /
  EDC, Open Badges 3.0, CLR 2.0), sağlık (FHIR + IPS), ehliyet/kimlik
  (ISO/IEC 18013-5 mDL), seyahat (ICAO DTC), ticaret ve tüzel kişilik
  (UN/CEFACT, GLEIF vLEI). Kritik bulgu: bu modellerin çoğu W3C VCDM / JSON-LD
  yerlisidir; Tamga ise SD-JWT VC seçmiştir ([[ADR-0006]]). Bu bir çatışma
  değildir ama bedava da değildir — semantik devralınır, taşıyıcı devralınmaz
  ve iki yönlü bir eşleme tablosu tutulması zorunludur.
priority: Critical
related:
  - PM-SCHEMA-0001
  - ADR-0006
  - ADR-0007
  - SPEC-CRED-0001
  - RS-EIDAS-0001
  - RS-EBSI-0001
---

# Giriş

Tamga bir credential ağıdır. Bir credential ağının değeri, taşıdığı belgelerin
**başkaları tarafından anlaşılabilir** olmasından gelir. Kendi diploma şemamızı
sıfırdan uydurursak, o diploma yalnızca Tamga'nın içinde anlam taşır; Türkiye
dışına, Avrupa'ya veya bir uluslararası işverene çıktığı anda anlamsız bir JSON
nesnesine dönüşür.

Bu doküman şu soruyu cevaplar: **hangi alanda kimin veri modelini devralacağız,
ve devralma tam olarak ne demek?**

Bu bir spesifikasyon değildir. Şemaların kendisi [[SPEC-SCHEMA-0002]] (eğitim)
ve [[SPEC-SCHEMA-0003]] (diğer sektörler) içinde yazılır. Burası, o
spesifikasyonların dayandığı dış dünya incelemesidir.

---

# Problem

Depoda 2026-09-09 itibarıyla eğitim credential şeması **yoktu**.
[[SPEC-BC-0001]] `IssuerCategory.EDUCATION` enum değerini tanımlıyor, ama o
kategorideki bir issuer'ın imzalayacağı belgenin içinde ne olacağı hiçbir yerde
yazmıyordu. Pilotun tam merkezindeki nesne eksikti.

Bu boşluğu doldururken iki yanlış yol var:

1. **Sıfırdan uydurmak.** Hızlıdır, iki hafta sürer, ve interoperability'yi
   kalıcı olarak öldürür. Bir üniversite Tamga diplomasını Europass'a taşıyamaz.
2. **Bir standardı olduğu gibi kopyalamak.** ELM'in 480 özelliğini birebir
   almaya kalkarsak, pilotu asla başlatamayız — üniversitenin öğrenci bilgi
   sisteminde o alanların yarısı yok.

Doğru yol ortadadır ve bu dokümanın çıktısı odur: **profil çıkarmak.** Yani
tanınmış bir modelin alt kümesini, o modelin adlandırmasına sadık kalarak almak.

---

# Kıyas Kriterleri

Her standardı yedi kriterle değerlendirdik:

| Kriter | Neden önemli |
|---|---|
| **Olgunluk** | Yayınlanmış ve üretimde mi, yoksa taslak mı |
| **Taşıyıcı bağımlılığı** | Veri modeli JSON-LD/W3C VC'ye gömülü mü, yoksa format-agnostik mi |
| **Çok dillilik** | Türk dünyası çok dilli; model dil taşıyabiliyor mu |
| **Kontrollü sözlük** | Serbest metin yerine kodlu sözlükler var mı (EQF, ESCO, ISCED) |
| **Benimseme** | Bizim dışımızda kim kullanıyor |
| **Lisans/erişim** | Metin ücretsiz mi, ücretli mi |
| **SD-JWT VC'ye eşlenebilirlik** | Düz JSON claim'lerine düzleştirilebilir mi |

Son kriter belirleyicidir ve §9'da ayrıca ele alınmıştır.

---

# 1. Eğitim — European Learning Model (ELM)

## Nedir

ELM, Avrupa'da öğrenme fırsatları, yeterlilikler, akreditasyon ve credential'ların birlikte çalışabilirliği için Avrupa Komisyonu tarafından geliştirilmiş bir veri modelidir. Sahibi DG EMPL'dir.

Sürüm durumu: Komisyon Mayıs 2023'te ELM'in 3. sürümünü tanıttı; bu, öğrenme verisinin belgelenmesini ve dijital imzalı credential ihracını kolaylaştıran uzun vadeli destekli kararlı bir sürümdür. ELM v3 uzun vadeli destek almaya devam ederken, 2025'te veri modeli ve dokümantasyona yönelik birçok iyileştirme yapılarak ELM v3.3'e ulaşıldı.

Teknik temeli: ELM, Avrupa Birliği ve Avrupa Ekonomik Alanı içinde öğrenmeyi tanımlayan standart bir format sağlamak amacıyla, JSON-LD olarak ifade edilen (eskiden XML/XSD) W3C Verifiable Credentials veri modelinin bir uzantısıdır.

Kapsam ve bağlantıları: Model, 480'in üzerinde özellik ile öğrenmenin belgelenmesinde esneklik sağlar ve ELMO ile ve Avrupa Blokzincir Servisleri Altyapısı'nın (EBSI) Diploma Kullanım Senaryosu ile eşlenmiş ve birlikte çalışabilir durumdadır; ayrıca Avrupa Yeterlilikler Çerçevesi (EQF), ESCO ve ISCED-F gibi mevcut çerçeve ve sınıflandırmalara bağlıdır. Europass'ın 29 dilinin tamamında mevcuttur.

Ürün karşılığı **EDC** (European Digital Credential for Learning): bir kuruluş tarafından öğrenciye verilen, öğrenmesini belgeleyen doğrulanabilir dijital credential — diplomalar, eğitim sertifikaları, mikro-yeterlilikler, katılım belgeleri; elektronik mühürle imzalanır.

## Çekirdek sınıflar

Tamga'nın ilgilendiği alt küme:

| ELM sınıfı | Ne temsil eder | Tamga'da karşılığı |
|---|---|---|
| `EuropeanDigitalCredential` | Credential zarfı | SD-JWT VC'nin kendisi |
| `Person` | Öğrenci | `credentialSubject` claim'leri |
| `Organisation` | Üniversite | `iss` + X.509 ([[SPEC-ID-0002]]) |
| `LearningAchievement` | Kazanım (diploma, ders) | Ana claim bloğu |
| `LearningOutcome` | Öğrenme çıktısı | Opsiyonel, mikro-credential'da |
| `LearningActivity` | Faaliyet (ders alma, staj) | Transkript satırı |
| `Qualification` | Yeterlilik (lisans derecesi) | Diploma çekirdeği |
| `AwardingProcess` | Verme süreci (tarih, kurul) | `issuance` bloğu |
| `Assessment` | Değerlendirme (not) | Transkript notu |
| `Accreditation` | Kurumun akreditasyonu | Zincirde ([[SPEC-BC-0001]]) |
| `LearningEntitlement` | Kazanılan hak (doktoraya başvurabilme) | Faz 2 |

Kontrollü sözlükler: **EQF** (seviye 1–8), **ISCED-F** (eğitim alanı kodu),
**ESCO** (beceri/meslek), **ISCED seviye**. Bunlar serbest metin yerine kod
taşır ve tanınırlığın asıl kaynağıdır. "Bilgisayar Mühendisliği" yazmak yerine
ISCED-F `0613` yazmak, belgeyi Kazakistan'da da anlaşılır kılar.

## Değerlendirme

| Kriter | Sonuç |
|---|---|
| Olgunluk | Yüksek — üretimde, LTS |
| Taşıyıcı bağımlılığı | **Yüksek** — JSON-LD/W3C VC yerlisi (§9) |
| Çok dillilik | Mükemmel — 29 dil, dil etiketli alanlar |
| Kontrollü sözlük | Mükemmel — EQF/ESCO/ISCED-F |
| Benimseme | AB geneli + EBSI |
| Lisans | Açık, ücretsiz, GitHub'da |
| SD-JWT'ye eşlenebilirlik | Orta — düzleştirme kuralı gerekir |

**Karar önerisi:** Eğitim şemalarının **semantik omurgası ELM v3'ten alınır.**
Sınıf ve alan adlandırması korunur, kontrollü sözlükler aynen kullanılır,
JSON-LD taşıyıcısı alınmaz.

---

# 2. Eğitim — Open Badges 3.0 ve CLR 2.0 (1EdTech)

## Nedir

Open Badges 3.0, 1EdTech'in (eski adıyla IMS Global) rozet standardının W3C
Verifiable Credentials üzerine taşınmış sürümüdür. ELM'e göre çok daha
hafiftir: bir `AchievementSubject`, bir `Achievement`, ve hizalama
(`alignment`) bilgisi.

CLR (Comprehensive Learner Record) 2.0, aynı ailede transkript benzeri toplu
kayıt formatıdır — birden çok kazanımı tek belgede taşır.

## Nerede ELM'den iyi

- **Mikro-credential ve ders tamamlama** için ELM ağır kalır. "Yapay Zekâ 101
  sertifikası" için 480 özellikli bir modele girmeye gerek yok.
- Kurumsal eğitim, sertifika programı, bootcamp gibi formal olmayan öğrenme
  alanında benimseme ELM'den yüksek.
- Yapısı basit olduğu için bir üniversitenin BT birimi tarafından bir günde
  anlaşılır.

## Nerede zayıf

- Kontrollü sözlük disiplini ELM kadar güçlü değil; `alignment` serbest
  bırakılmış.
- Resmî yeterlilik (lisans derecesi) tanımlamak için tasarlanmamış.

**Karar önerisi:** Mikro-credential ve ders/sertifika tamamlama şemalarında
**OBv3 alan adlandırması** kullanılır. Resmî diploma ve transkriptte ELM
kullanılır. İki ailenin `alignment`/`Qualification` üzerinden köprüsü kurulur.

---

# 3. Sağlık — HL7 FHIR ve IPS

## Nedir

FHIR (Fast Healthcare Interoperability Resources), HL7'nin kaynak tabanlı
sağlık veri değişim standardıdır. Her klinik nesne bir *resource*'tur:
`Patient`, `Immunization`, `Observation`, `Condition`, `AllergyIntolerance`,
`MedicationStatement`.

**IPS** (International Patient Summary), FHIR üzerine kurulu, sınır ötesi acil
bakım için tasarlanmış minimum hasta özeti profilidir — alerjiler, ilaçlar,
problemler.

## Emsal: FHIR'i credential'a gömme

Bu alanda tekerlek icat etmeye gerek yok, çünkü iki büyük emsal var:

- **SMART Health Cards** — COVID döneminde aşı kaydını doğrulanabilir belge
  olarak taşımak için FHIR Bundle'ını sıkıştırıp imzalı JWT içine gömdü.
- **WHO GDHCN / DDCC** — aynı deseni küresel ölçekte kurumsallaştırdı.

Her ikisinin de ortak deseni: **credential, FHIR kaynağını taşır; credential
FHIR'i yeniden tanımlamaz.**

## Kritik uyarı

Sağlık verisi Tamga'nın en riskli alanıdır. [[PM-TRUST-0001]] gereği zincire
hiçbir şey yazılmaz; ama bunun ötesinde, sağlık credential'ı **seçici açıklama
olmadan asla** verilmemelidir. Bir sigorta şirketi "aşılı mı" diye sorduğunda,
tüm bağışıklama geçmişini görmemelidir.

**Karar önerisi:** Sağlık credential'ları FHIR R4/R5 kaynak yapısını taşır, IPS
profilini temel alır. [[SPEC-SCHEMA-0003]]'te iskelet olarak yazılır, pilot
kapsamına **alınmaz** (Faz 2+).

---

# 4. Ehliyet ve kimlik — ISO/IEC 18013-5 (mDL)

## Nedir

ISO/IEC 18013-5, mobil sürücü belgesinin (mDL) uluslararası standardıdır.
Yakınlık (proximity) senaryosu için tasarlanmıştır: telefonu polise/barmene
uzatırsın, NFC veya BLE üzerinden veri akar, internet gerekmez.

Veri modeli `org.iso.18013.5.1` isim alanı altında tanımlıdır. Öne çıkan
elemanlar: `family_name`, `given_name`, `birth_date`, `issue_date`,
`expiry_date`, `issuing_country`, `issuing_authority`, `document_number`,
`portrait`, `driving_privileges`, ve **`age_over_NN`** ailesi.

ISO/IEC 18013-7 aynı credential'ın çevrimiçi sunumunu tanımlar.

## Tamga için asıl değeri: `age_over_NN` deseni

Bu, seçici açıklamanın en zarif örneğidir. Barmen yaşını sormaz, doğum tarihini
görmez; yalnızca `age_over_18 = true` claim'ini alır. Doğum tarihi hiç
açıklanmaz.

Bu desen ehliyete özgü değildir ve Tamga'nın **tüm** şemalarında kullanılmalıdır:

- Diploma: `graduation_year` yerine, işveren için `graduated_before_2020 = true`
- Öğrencilik: `student_id` yerine `is_enrolled = true`
- Gelir: tutar yerine `income_above_threshold = true`

Doğru soru "hangi veriyi paylaşayım" değil, **"verifier'ın gerçekten ihtiyacı
olan iddia nedir"**dir. Türetilmiş boolean claim'ler bunun cevabıdır.

## Uyarı: format farkı ve maliyet

- mDL **mdoc/CBOR/COSE** kullanır, SD-JWT değil. [[ADR-0006]] mdoc'u ikincil
  format olarak zaten kabul etmiş durumda; bu doğru karardır çünkü mDL'i
  SD-JWT'ye çevirmek onu mDL olmaktan çıkarır.
- **ISO standartları ücretlidir.** 18013-5 metnini satın almak gerekir. Bu,
  pilot bütçesine yazılması gereken gerçek bir kalemdir; ELM ve OBv3 ücretsiz
  olduğu için bu farkı gözden kaçırmak kolaydır.

**Karar önerisi:** mDL, devlet katılımı (Faz 1) geldiğinde ele alınır. Ama
`age_over_NN` **deseni** bugünden tüm Tamga şemalarına ilke olarak girer.

---

# 5. Seyahat — ICAO DTC

Dijital Seyahat Belgesi (Digital Travel Credential), pasaportun çipindeki
mantıksal veri yapısının (LDS) dijital türevidir. İki bileşenlidir: sanal
bileşen (telefonda) ve fiziksel bileşen (pasaportun kendisi).

Tamga için doğrudan uygulanabilir değildir — pasaport ihracı bir devlet
tekelidir ve Faz 0'da böyle bir yetkimiz yok. Ancak **turizm modülü**
(`turkistantour.com` bağlamı) ve sınır geçişi senaryoları için Faz 2'de
referans alınacak model budur. İskelet olarak kaydedilir, yazılmaz.

---

# 6. Ticaret ve tüzel kişilik — UN/CEFACT ve GLEIF vLEI

## vLEI

GLEIF'in vLEI'si (verifiable Legal Entity Identifier), LEI kodunun
doğrulanabilir credential hâlidir. Üç katmanı vardır:

- **Legal Entity vLEI** — tüzel kişinin kendisi
- **OOR** (Official Organizational Role) — resmî yetkili (yönetim kurulu üyesi)
- **ECR** (Engagement Context Role) — bağlamsal yetkili (satın alma müdürü)

Bu üçlü ayrım, Tamga'nın "şirket çalışanı credential'ı" ihtiyacına **doğrudan**
oturur. Bir lojistik firmasının şoförü ECR'dir; imza yetkilisi OOR'dur.

## UN/CEFACT

Sınır ötesi ticaret belgelerinin (konşimento, menşe şahadetnamesi) veri
modelleri. MLETR (elektronik devredilebilir kayıtlar model kanunu) ile birlikte
"verifiable trades" modülünün hukuki-teknik temelini oluşturur.

**Karar önerisi:** Tüzel kişilik ve çalışan yetki şemalarında **vLEI'nin
LE/OOR/ECR üçlüsü devralınır.** UN/CEFACT lojistik modülüne (Faz 2)
bırakılır.

---

# 7. Karşılaştırma Tablosu

| Alan | Standart | Olgunluk | Taşıyıcı | Lisans | Tamga fazı |
|---|---|---|---|---|---|
| Diploma, transkript | **ELM v3** | Yüksek | JSON-LD | Ücretsiz | **Faz 0 — pilot** |
| Mikro-credential, sertifika | **OBv3 / CLR 2.0** | Yüksek | JSON-LD | Ücretsiz | **Faz 0** |
| Sağlık | FHIR R4/R5 + IPS | Yüksek | FHIR JSON | Ücretsiz | Faz 2 |
| Ehliyet, kimlik | ISO/IEC 18013-5 | Yüksek | mdoc/CBOR | **Ücretli** | Faz 1 |
| Seyahat | ICAO DTC | Orta | Karma | Kısmen | Faz 2 |
| Tüzel kişilik, çalışan | GLEIF vLEI | Orta | ACDC/KERI | Ücretsiz | **Faz 0 — iskelet** |
| Ticaret belgesi | UN/CEFACT | Yüksek | XML/JSON | Ücretsiz | Faz 2 |

---

# 8. Değerlendirilen ve Reddedilen Yaklaşımlar

## "Kendi şema dilimizi tasarlayalım" — Reddedildi

Gerekçe: Tanınırlık kaybı telafi edilemez. Bir Tamga diplomasının Avrupa'da
okunabilmesi, projenin varlık sebeplerinden biridir ([[PM-PH-0001]] "uyumlu ama
bağımsız"). Kendi sözlüğümüz bu iddiayı geçersiz kılar.

## "ELM'i olduğu gibi, JSON-LD dahil benimseyelim" — Reddedildi

Gerekçe: [[ADR-0006]] SD-JWT VC'yi birincil format olarak sabitledi. JSON-LD ve
Linked Data Proofs'a dönmek o kararı iptal eder; seçici açıklama, cüzdan
kütüphanesi ve OpenID4VP profili yeniden yazılır. Semantiği almak yeterlidir;
taşıyıcıyı almak gereksiz maliyettir.

## "Şemaları issuer'a bırakalım, her üniversite kendi alanını tanımlasın" — Reddedildi

Gerekçe: Verifier tarafını öldürür. Bir işveren, her üniversite için ayrı
ayrıştırma kodu yazmak zorunda kalır. Ağ etkisi tam da bu noktadan doğar;
şemayı serbest bırakmak ağı bir dosya sunucusuna indirger. Ayrıntılı gerekçe
[[PM-SCHEMA-0001]]'dedir.

---

# 9. Kritik Bulgu — Format Uyumsuzluğu ve Düzleştirme

Bu, dokümanın en önemli bölümüdür.

ELM ve OBv3 **W3C VCDM / JSON-LD yerlisidir.** Tamga ise **SD-JWT VC**
seçmiştir ([[ADR-0006]]). Bu bir çatışma değildir, ama bedava da değildir.

## Fark nerede

JSON-LD'de bir diploma iç içe geçmiş nesnelerden oluşur:

```
credentialSubject
  └── hasClaim (LearningAchievement)
        ├── awardedBy (AwardingProcess)
        │     └── awardingBody (Organisation)
        └── specifiedBy (Qualification)
              ├── EQFLevel
              └── ISCEDFCode
```

SD-JWT'nin seçici açıklaması ise **claim düzeyinde** çalışır. Bir `_sd`
dizisindeki her giriş tek bir claim'i gizler. Derin iç içe yapılar SD-JWT'de
mümkündür ama her seviye ek disclosure ve ek karmaşıklık demektir — ve
verifier'ın politika motoru ([[PM-ASSUR-0001]]) derin yolları sorgulamakta
zorlanır.

## Çözüm: kontrollü düzleştirme

ELM'in **semantiği** korunur, **yapısı** düzleştirilir:

| ELM yolu | Tamga claim'i |
|---|---|
| `hasClaim.specifiedBy.title` | `qualification_title` |
| `hasClaim.specifiedBy.EQFLevel` | `eqf_level` |
| `hasClaim.specifiedBy.ISCEDFCode` | `isced_f_code` |
| `hasClaim.awardedBy.awardingDate` | `awarding_date` |
| `hasClaim.awardedBy.awardingBody.legalName` | `awarding_body_name` |

Kural: **iki seviyeden derin gitme.** Gerekiyorsa alt nesne tek bir
seçici-açıklanabilir blok olarak kalır (örneğin transkript satırları), ama
diplomanın çekirdek alanları düzdür.

## Zorunlu sonuç: iki yönlü eşleme tablosu

Düzleştirme tek yönlü bir kayıp olursa, EDC'ye dışa aktarım imkânsızlaşır. Bu
yüzden [[SPEC-SCHEMA-0002]] her şema için **normatif bir eşleme tablosu**
içermek zorundadır:

```
Tamga claim  ←→  ELM özelliği  ←→  OBv3 karşılığı (varsa)
```

Bu tablo olmadan yazılan şema, standart hizalı görünen ama aslında hizalı
olmayan bir şemadır — ve bu, hiç hizalanmamış olmaktan daha tehlikelidir,
çünkü yanlış bir güven yaratır.

---

# 10. Öneriler (SPEC'lere Girdi)

1. Eğitim şemalarının semantik omurgası **ELM v3**'ten alınır; kontrollü
   sözlükler (EQF, ISCED-F, ESCO) **aynen** kullanılır.
2. Mikro-credential'da **OBv3** adlandırması kullanılır.
3. Her şema, iki yönlü **eşleme tablosu** taşır (§9).
4. **`age_over_NN` deseni** — türetilmiş boolean claim'ler — tüm şemalarda
   ilkedir, yalnızca ehliyette değil.
5. Düzleştirme kuralı: **iki seviyeden derin gitme.**
6. Çok dillilik baştan konur: `title` değil, dil etiketli `title` yapısı
   (TR/AZ/KZ/UZ/KG/EN). Sonradan eklemek tüm şemaları kırar.
7. Sağlık, seyahat, ticaret: **iskelet yazılır, pilota alınmaz.** →
   [[SPEC-SCHEMA-0003]] (2026-09-09) yazıldı; ayrıca yedi koşullu sektör açma
   kontrol listesi getirdi.
8. ISO 18013-5 metni **satın alınacak kalem** olarak bütçeye yazılır.

---

# Riskler

| Risk | Etki | Azaltma |
|---|---|---|
| ELM'in tamamını almaya çalışmak | Pilot felç olur | Profil (alt küme) çıkar; 480 değil ~40 alan |
| Düzleştirmenin belgelenmemesi | Sahte interoperability | §9 eşleme tablosu zorunlu |
| Çok dilliliğin ertelenmesi | Tüm şemalar yeniden yazılır | Baştan dil etiketli alanlar |
| ISO ücretinin bütçelenmemesi | Faz 1'de sürpriz | Şimdi kaleme yazıldı |
| ELM v4 çıkması | Şemalar eskir | Sürümleme + `extends` zinciri ([[ADR-0007]]) |

---

# Açık Sorular

1. ESCO beceri kodları Türkçe/Türk dünyası mesleklerini yeterince kapsıyor mu?
   Kapsamıyorsa Tamga kendi uzantı sözlüğünü nasıl yönetir? → `RS-SCHEMA-0002`
   (planlı)
2. Türkiye'de YÖK'ün diploma veri modeli (e-Devlet mezuniyet belgesi) ELM'e
   eşlenebilir mi? Pilot öncesi saha çalışması gerekir.
3. vLEI'nin ACDC/KERI taşıyıcısı Tamga'nın X.509 modeline nasıl köprülenir?
   → Faz 2

---

# İlgili Dokümanlar

[[PM-SCHEMA-0001]] · [[ADR-0006]] · [[ADR-0007]] · [[SPEC-CRED-0001]] ·
[[SPEC-SCHEMA-0001]] · [[SPEC-SCHEMA-0002]] · [[SPEC-SCHEMA-0003]] ·
[[RS-EIDAS-0001]] · [[RS-EBSI-0001]]

---

# Durum

**Draft** — 2026-09-09. ELM v3/v3.3 sürüm bilgisi ve SD-JWT VC Type Metadata
mekanizması birincil kaynaklardan doğrulanmıştır. OBv3/CLR sürüm ayrıntıları ve
FHIR IPS profil numarası, ilgili SPEC yazımı sırasında yeniden doğrulanacaktır.
