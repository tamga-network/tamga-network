---
document_id: ADR-0057
title: "Hostinq edilən rəqəmsal sənəd verilməsində qurumun imza açarı: məsafədən imza (CSC API)"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-20
last_updated: 2026-10-20
summary: >
  Hostinq edilən rəqəmsal sənəd vermə xidmətindən istifadə edən qurumun rəqəmsal sənəd və ləğv siyahısı imza açarları qurumda qalır: açar qurumun HSM-ində və ya qurumun seçdiyi etibar xidməti provayderində saxlanılır, xidmət isə imzanı Cloud Signature Consortium API v2 (`signatures/signHash`) vasitəsilə tələb edir. Xidmətə yalnız imzalanacaq məlumatın SHA-256 heşi göndərilir; rəqəmsal sənədin məzmunu və fərdi məlumatlar göndərilmir. Gələn imza qurumun etibar siyahısındakı sertifikatı ilə lokal olaraq yoxlanılır. Real şəbəkədə qurum açarı fayldan oxunmur (PM-GOV G1, kənarlaşma S-1). Qəbul: 2026-10-20.
domain: Identity
related: ["[[ADR-0016]]", "[[ADR-0020]]", "[[ADR-0050]]", "[[SPEC-ID-0002]]", "[[SPEC-PROTO-0001]]"]
translation_of: ADR-0057
source_version: "1.0.0"
---

# Kontekst

- Hostinq edilən rəqəmsal sənəd vermə xidməti ([[ADR-0016]]) rəqəmsal sənədləri qurum adından və **qurumun açarı ilə** imzalayır. Layihə qaydası aydındır:
  hostinq edilən xidmətlərdə imza açarı heç vaxt şəbəkənin operatorunda saxlanılmır (PM-GOV G1). Bu gün sandbox qurumlarının
  açarları test açarlarıdır və serverdə fayl kimi saxlanılır (kənarlaşma S-1); real şəbəkədə hələ qurum yoxdur.
- Qurumların qoşulma bələdçiləri "açarlar qurumun KMS/HSM-ində yaradılır, yalnız sertifikat sorğusu (CSR) göndərilir" deyir. Lakin
  xidmətin bu açardan istifadə etməsinin yolu müəyyən edilməmişdi: kod yalnız fayl açarını oxuyurdu. İlk qurum üçün bu
  maneədir.
- Qurum öz rəqəmsal sənəd vermə xidmətini də idarə edə bilər (`@tamga-network/issuer`); bu yol açarı onsuz da qurumda saxlayır, lakin
  OpenID4VCI serverinin qurulmasını tələb edir. Hostinq edilən yol da açarı qurumda saxlamalıdır.
- Aİ-də məsafədən imza və möhür üçün qəbul olunmuş interfeys Cloud Signature Consortium API-dir (CSC API v2; ETSI TS 119 432 ilə
  uzlaşdırılmış). Kvalifikasiyalı etibar xidməti provayderləri və HSM məhsulları bu interfeysi təqdim edir.

# Qərar

## K1 — Qurumun açarı qurumdadır, imza məsafədən

Hostinq edilən xidmətdə qurumun rəqəmsal sənəd imza açarı və ləğv siyahısı imza açarı ([[ADR-0050]] K1) qurumun HSM-ində və ya
qurumun müqavilə bağladığı etibar xidməti provayderində yaradılır və orada qalır. Xidmət imzanı **CSC API v2** ilə tələb edir:

1. OAuth 2.0 müştəri identifikatoru ilə giriş tokeni (`client_credentials`, `scope=service`);
2. `credentials/authorize` — imzalanacaq heşə bağlı, tək imza üçün səlahiyyət (SAD);
3. `signatures/signHash` — `hashAlgorithmOID` SHA-256 (2.16.840.1.101.3.4.2.1), `signAlgo` ecdsa-with-SHA256
   (1.2.840.10045.4.3.2).

Açar P-256 olaraq qalır ([[SPEC-ID-0002]]); sertifikat qurumun CSR-i əsasında kök sertifikat orqanı tərəfindən verilir və etibar siyahısına
daxil edilir (dəyişməyib).

## K2 — Xidmətə yalnız heş göndərilir

Xidmət imzalanacaq məlumatın (JWS imza girişi və ya COSE strukturu) yalnız SHA-256 heşini göndərir. Rəqəmsal sənədin məzmunu, fərdi məlumatlar
və şəxsin açarı məsafədən imza xidmətinə göndərilmir; xidmət hansı şəxsə rəqəmsal sənəd verildiyini öyrənmir.

## K3 — Gələn imza lokal olaraq yoxlanılır

Xidmət hər imzanı qurumun etibar siyahısındakı sertifikatının açıq açarı ilə yoxlayır. Yoxlanılmayan imzadan (yanlış açar,
zədələnmiş cavab) istifadə olunmur; rəqəmsal sənəd verilmir. Xidmətə qoşulmaq mümkün olmadıqda rəqəmsal sənəd verilmir, şəxs sonra yenidən cəhd edir (mənbəyə qoşulmaq mümkün olmadığı
haldakı kimi, [[ADR-0020]]).

## K4 — Real şəbəkədə fayl açarı yoxdur

Real şəbəkədə qurum açarı xidmət serverində fayldan oxunmur; konfiqurasiya bunu rədd edir və qurum aktivləşdirilmir. Fayl açarı
yalnız lokal inkişaf, testlər və sandbox üçündür (sandbox test açarları, [[ADR-0038]]).

## K5 — Sirlər və sərhədlər

Məsafədən imza xidmətinin müştəri sirri (və xidmət tələb edirsə, imza PIN-i) xidmət serverinin gizli mühitində saxlanılır; icarəçi
faylına və repozitoriyaya yazılmır. Xidmət ünvanları yalnız HTTPS-dir. Qurum imza səlahiyyətini istənilən an geri ala bilər (xidmətdəki
müştəri identifikatorunu bağlamaqla); bu, xidmətin həmin qurum adından rəqəmsal sənəd verməsini dərhal dayandırır.

# Əsaslandırma / alternativlər

| Seçim | Nəticə | Səbəb |
|---|---|---|
| Qurumun açarını xidmət serverində fayl kimi saxlamaq | rədd | PM-GOV G1 |
| Bulud provayderinə xas açar xidməti (tək provayder) | rədd (tək başına) | Qurumu bir provayderə bağlayır; CSC interfeysi provayderdən asılı deyil |
| Qurumun idarə etdiyi, Tamga-ya xas imza nöqtəsi | rədd | Yeni, qeyri-standart müqavilə olardı; CSC artıq mövcuddur |
| **CSC API v2 ilə məsafədən imza (yalnız heş)** | **seçildi** | Aİ-də qəbul olunmuş interfeys; kvalifikasiyalı sinfə keçiddə də eyni yol |
| Qurum öz rəqəmsal sənəd vermə xidmətini idarə edir | saxlanılır | İkinci yol kimi qalır ([[ADR-0016]]) |

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| RS1 | Hostinq edilən xidmətdə qurumun rəqəmsal sənəd və ləğv siyahısı imza açarı qurumda və ya qurumun etibar xidməti provayderində qalır; xidmət imzanı CSC API v2 ilə tələb edir. |
| RS2 | Məsafədən imza xidmətinə yalnız imzalanacaq məlumatın SHA-256 heşi göndərilir; rəqəmsal sənədin məzmunu və fərdi məlumatlar göndərilmir. |
| RS3 | Xidmət hər məsafədən imzanı qurumun etibar siyahısındakı sertifikatı ilə yoxlayır; yoxlanılmayan imza ilə rəqəmsal sənəd verilmir. |
| RS4 | Real şəbəkədə qurum açarı xidmət serverində fayldan oxunmur. |

# Açıq məsələlər

1. CSC API v2 hostinq edilən xidmətin yeganə məsafədən imza interfeysidir (bu qərarla bağlandı).
2. İlk qurum üçün hansı məsafədən imza xidməti (qurumun öz HSM-i və ya etibar xidməti provayderi) — qurumla birlikdə
   seçilir.
3. Hər imza üçün ayrıca sorğu əvəzinə bir rəqəmsal sənədin nüsxələrini tək sorğuda imzalamaq (CSC çoxlu heş) — sürət lazım olarsa, ayrıca
   nəzərdən keçirilir.

# Status

**Accepted — 2026-10-20.** Layihə rəhbərliyinin təsdiqi ilə. DECISIONS: D-ID-13. Tətbiq hostinq edilən xidmətdə `csc:` açar
istinadı ilə (testlərlə); real şəbəkədə fayl açarının rədd edilməsi PM-GOV G1-in özüdür.
