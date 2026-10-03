---
document_id: ADR-0028
title: "Sağlık belgeleri"
status: Proposed
version: 1.0.0
created: 2026-09-29
last_updated: 2026-10-02
summary: >
  Sağlık meslek mensupları için birbirini tamamlayan üç belge:
  (1) meslek icra belgesi — yetkili kaynak Sağlık Bakanlığı; pilotta deneme kurumu;
  (2) meslek odası üyelik belgesi — Türk Tabipleri Birliği / il tabip odaları;
  (3) kurum görev belgesi — hastane ya da klinik kendi personeline birim, unvan ve başlama tarihiyle verir.
  Başka bir kurum işe alımda bunları doğrulayıcı olarak ister (doğrulanmış özgeçmiş). Belgelerde sağlık verisi ve T.C. kimlik
  no yok. Hasta tarafı (AB Health ID, e-reçete) kapsam dışı, ileride. Tür adları öneridir.
domain: Credentials
---

# Bağlam

Proje yönetimi, ilk sektörler olarak üniversite ve sağlığı belirledi. Sağlıkta ilk hedef hekimleri ve sağlık personelini
belgelendirmek; kurumlar [[t:issuer]], başka kurumlar [[t:verifier]] olur.

Dünyada bir hekimin yetkisi tek belgeyle değil, **her bilgiyi kendi sahibinin verdiği birkaç belgeyle** kanıtlanır:

| Ülke / bölge | Yöntem |
|---|---|
| AB | Ulusal makam ruhsatı; diploma otomatik tanınır (2005/36/AT); yasaklanan hekim IMI uyarı sistemiyle bildirilir |
| ABD | Eyalet ruhsatı + NPI + uzmanlık belgesi; işe alan hastane "credentialing" ile birincil kaynaktan doğrular, sonra işlem yetkisi ("privileging") verir |
| Birleşik Krallık | GMC kaydı; NHS'in doğrulanabilir "Digital Staff Passport"u işe giriş kontrollerini kurumlar arasında taşıdı (2025'te kapandı; model sürüyor) |

[[t:EUDI-Wallet|EUDI Wallet'ta]] hekim belgesi **henüz tanımlı değil**. EHDS (Tüzük 2025/327) Komisyon'a sağlık meslek mensuplarının kimlik
doğrulaması için uygulama kararı çıkarma yetkisi veriyor. AB cüzdanının sağlıktaki tek tanımlı kullanımı hasta tarafındaki
e-reçete "Sağlık Kimliği"dir ([[t:mdoc]]; reçetenin kendisi cüzdana girmez).

Türkiye'de [[t:authentic-source|yetkili kaynaklar]]:

| Bilgi | Yetkili kaynak |
|---|---|
| Meslek icra yetkisi, uzmanlık | Sağlık Bakanlığı |
| Meslek odası üyeliği | Türk Tabipleri Birliği / il tabip odaları (kamu kurumu niteliğinde meslek kuruluşu) |
| Çalışma, birim, unvan | İşveren sağlık kuruluşu |

[[ADR-0020]] gereği bilgi her belgede kendi kaynağından okunur; Tamga saklamaz.

# Önerilen karar

## K1 — Üç belge, üç kaynak

| # | Belge | Veren | Güven listesi sınıfı | Tür adı (ÖNERİ, §6) |
|---|---|---|---|---|
| 1 | **Meslek icra belgesi** | Sağlık Bakanlığı. Pilotta "Sağlık Bakanlığı (deneme)" deneme kurumu; gerçek katılımda aynı tür, gerçek kayıt | `PUB` / `HEALTH` | `urn:tamga:health:PractitionerLicence:1` |
| 2 | **Oda üyelik belgesi** | TTB ya da il tabip odası, kendi üyelerine | `PUB` (kamu kurumu niteliğinde) ya da `EAA` / `HEALTH` | `urn:tamga:health:ProfessionalMembership:1` |
| 3 | **Kurum görev belgesi** | Hastane / klinik / sağlık grubu, kendi personeline | `EAA` / `HEALTH` | `urn:tamga:work:EmploymentCredential:1` (sektörsüz) |

Hiçbiri Tamga tarafından verilmez; Tamga barındırılan belge verme servisini işletir.

## K2 — Alanlar (öneri)

**Meslek icra belgesi:**
- `family_name`, `given_name`,
- `profession`: ISCO-08 kodu + ad; ör. 2211 hekim, 2261 diş hekimi, 2262 eczacı, 2221 hemşire,
- `specialty` (varsa; bakanlık uzmanlık dalı listesi),
- `registration_number` (meslek tescil no; [[t:selective-disclosure]] ile),
- `licence_status` (`ACTIVE` | `RESTRICTED`),
- `authority_name`, `issued_date`.

**Oda üyelik belgesi:**
- `family_name`, `given_name`, `profession`,
- `chamber_name`,
- `membership_number` (selective disclosure),
- `membership_status`, `member_since`.

**Kurum görev belgesi (sektörsüz):**
- `family_name`, `given_name`,
- `employer_name`, `employer_id` ([[t:trust-list]] kimliğinden),
- `job_title`, `department`, `start_date`, `end_date` (ayrılınca),
- `employment_type` (`FULL_TIME` | `PART_TIME` | `CONSULTANT` …).
- Sağlıkta isteğe bağlı: `clinical_privileges`, işlem yetkileri (ABD "privileging" karşılığı).

**Hiçbirinde yok:** T.C. kimlik no (IDP10), adres, maaş, sağlık verisi.

## K3 — Yaşam döngüsü

- Üç belge da **iptal ve askı** taşır (Token Status List 2 bit). AB'deki IMI uyarısının karşılığı, bakanlığın icra belgesini
  askıya alması ya da iptal etmesidir. Doğrulayıcı bunu anında görür.
- **Kurum görev belgesi ayrılışta** ya iptal edilir ya da `end_date` ile yeniden verilir. İkincisi önerilir: iş geçmişi
  kanıtı olarak kalır.
- Otomatik kopya yenileme ([[ADR-0023]]) üçünde de açıktır.

## K4 — Doğrulayıcı: işe alım ve görevlendirme

- Hekimi işe alacak ya da görevlendirecek kurum güven listesine doğrulayıcı olarak kaydolur: kullanım "İşe alım ve
  görevlendirme doğrulaması"; istenen alanlar üç belgeden.
- Hekim tek onayla üç belgeyi birlikte gönderir. Bu, doğrulanmış bir özgeçmiş gibi çalışır; hastane her şeyi baştan
  kontrol etmez.
- [[t:registration-certificate]] ([[ADR-0026]]) doğrulayıcının bu amaçla kayıtlı olduğunu gösterir.

## K5 — Açıklama politikası (EDP)

- Meslek icra belgesi için isteğe bağlı gömülü açıklama politikası (ETSI TS 119 472-3 §4.2.5): "yalnız registration
  certificate'ında sağlık hizmeti sunucusu yetkisi olan doğrulayıcılara".
- Cüzdan uymayan istekte uyarır; kişi yine de karar verir (ARF EDP_07).
- ETSI somut JSON adlarını tanımlamadığı için Tamga profili kabulde belirlenir.

## K6 — Kapsam dışı (ileride)

- Hasta Sağlık Kimliği (AB e-reçete pilotu, mdoc) ve e-Nabız / e-Reçete bağlantısı: yalnız Sağlık Bakanlığı belge veren olarak
  katılırsa.
- Sağlık kuruluşunun kendisi için belge verilmez: kuruluş güven listesi kaydıyla ve kayıt sertifikası ile tanınır
  ([[ADR-0024]], [[ADR-0026]]).

# Gerekçe / alternatifler

| Seçenek | Sonuç | Neden |
|---|---|---|
| Tek "hekim belgesi" (ruhsat + oda + işyeri birlikte) | ret | Bilgiler farklı kaynaklarda; biri değişince (işyeri) hepsi yeniden verilir; tek kurum hepsinin sahibi değil |
| Tamga'nın hekim belgesini vermesi | ret | Yetkili kaynak kurumdadır ([[ADR-0020]]) |
| Görev belgesini sağlığa özgü yapmak | öneri değil | Aynı ihtiyaç üniversite personelinde ve şirketlerde var; sektörsüz tür yeniden kullanılır |
| **Üç belge, her biri kendi kaynağından; işe alan kurum doğrulayıcı** | **öneri** | Dünyadaki uygulamayla aynı; AB modeline uyumlu |

# Önerilen kurallar (kabul edilirse bağlayıcı tabloya taşınır)

| Kod | Kural |
|---|---|
| HC1 | Sağlık alanı belgeleri sağlık verisi (tanı, reçete, tahlil, tedavi) ve T.C. kimlik no taşımaz. |
| HC2 | Meslek icra belgesini yalnız güven listesinde bu türe yetkili kurum verir; Tamga vermez. |
| HC3 | Sağlık alanı belgeleri iptal ve askı durumunu taşır; askıdaki belge doğrulamada geçersizdir. |

# Kararı bekleyen sorular (proje yönetimi)

1. **Tür adları:** §K1'deki öneriler ya da alternatifleri — `MedicalLicence`, `ChamberMembership` (tüm meslek odaları),
   `StaffAppointment` (sağlığa özgü görev).
2. Oda belgesinin sınıfı: `PUB` mı, `EAA` mı?
3. Pilot kurgusu: "Sağlık Bakanlığı (deneme)", bir tabip odası, bir özel hastane — deneme kiracıları.

# Durum

**Proposed — 2026-09-30.** Kurgu ve veren kurumlar proje yönetiminin yönlendirmesiyle yazıldı; tür adları kararda.
