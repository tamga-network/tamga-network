---
document_id: ADR-0045
title: "Şəxsiyyət sənədinin sahə adları: Aİ PID kodlaşdırması"
status: Active
version: 1.0.0
created: 2026-10-09
last_updated: 2026-10-11
summary: >
  Tamga şəxsiyyət sənədi (`urn:tamga:id:IdentityAttestation:1`) sahə adlarını və kodlaşdırmasını Avropa İttifaqının (Aİ) şəxs identifikasiya məlumatlarının (PID) Komissiyanın (Aİ) 2026/1731 saylı İcra Reqlamenti ilə müəyyən edilmiş kodlaşdırmasına uyğun daşıyır: SD-JWT VC-də `birthdate` (əvvəllər `birth_date`) və `nationalities` massivi (əvvəllər tək dəyərli `nationality`; hər element ayrıca açıqlanır); mdoc-da `birth_date` (full-date, #6.1004) və massiv dəyərli `nationality`. Ad, soyad, şəxsiyyət nömrəsi və verən ölkə sahələrinin adları onsuz da eyni idi. `age_over_18` Aİ PID dəstində yoxdur; Tamga sahəsi kimi ISO/IEC 18013-5 adı ilə hər iki formatda qalır. Tip, docType və ad sahəsi dəyişmir; sənəd PID deyil. İnkişaf mərhələsində sxem yerində düzəldilir (ADR-0029). ADR-0013 K2-ni (element adları SD-JWT adları ilə tam eynidir) və ADR-0011-in sahə cədvəlini dəyişir.
domain: Identity
related: ["[[ADR-0011]]", "[[ADR-0013]]", "[[ADR-0029]]", "[[ADR-0036]]", "[[ADR-0032]]", "[[FW-RB-0003]]", "[[SPEC-ID-0003]]"]
translation_of: ADR-0045
source_version: "1.0.0"
---

# Qısaca

Aİ şəxs identifikasiya məlumatlarının sahə adlarını və formatını reqlamentlə müəyyən etdi. Tamga-nın şəxsiyyət sənədi PID deyil, lakin eyni adlardan
istifadə edərsə, Aİ-nin yoxlayan tərəfləri və rəqəmsal cüzdanları onu əlavə uyğunlaşdırma aparmadan oxuya bilər. Bu qərar iki adı dəyişir (`birthdate`,
`nationalities`) və mdoc formatında doğum tarixini Aİ-nin tələb etdiyi tarix teqi ilə yazır.

# Kontekst

- Komissiyanın (Aİ) 2026/1731 saylı İcra Reqlamenti (dərc: 2026-07-22, qüvvəyə minmə: 2026-08-11) 2024/2977-nin PID Əlavəsini yenidən yazdı:
  - **SD-JWT VC** (Cədvəl 7–8): `family_name`, `given_name`, `birthdate` (YYYY-MM-DD), `place_of_birth`, `nationalities`
    (ISO 3166-1 alpha-2 massivi; məlum deyilsə `QU`, vətəndaşlığı olmayan şəxs üçün `QS`), `personal_administrative_number`, `issuing_country`,
    `date_of_expiry`, `date_of_issuance`… Bütün claim-lər, massiv elementləri daxil olmaqla, ayrıca seçici şəkildə açıqlanır (§4.2; ARF PID_21).
  - **ISO mdoc** (Cədvəl 6): element identifikatorları `family_name`, `given_name`, `birth_date` (`full-date` = #6.1004(tstr), RFC 8943),
    `place_of_birth`, `nationality` (kodlaşdırması `nationalities` = massiv), `personal_administrative_number`, `issuing_country`…
  - Yaş atributları (`age_over_NN`) PID dəstində **yoxdur**; Aİ-də yaş üçün ayrıca yaşın təsdiqi sənədindən istifadə olunur.
- Tamga şəxsiyyət sənədi indiyədək hər iki formatda `birth_date` və tək dəyərli `nationality` istifadə edirdi ([[ADR-0011]] sahə
  cədvəli; [[ADR-0013]] K2 "element adları SD-JWT claim adları ilə tam eynidir"). Aİ PID-ni xarici tip kimi yoxlayan Tamga yoxlayan tərəfi
  ([[ADR-0036]]) iki ayrı ad dəstini tanımalı idi; qurumların uyğunlaşdırma qaydaları da Tamga-ya xas adlara bağlı idi.
- Standartlar kitabxanasının KA-1731-3 qeydi: "Şəxsiyyət sənədinin sahə adları Aİ PID SD-JWT kodlaşdırmasına uyğunlaşdırılır".
- İnkişaf mərhələsindəyik ([[ADR-0029]]): real istifadəçi yoxdur; sxem yerində düzəldilir, geriyə uyğunluq yazılmır.
- Layihə rəhbərliyinin istiqaməti (2026-10-09): doğum tarixi sahəsi `birthdate` olmalıdır; düzəldilsin.

# Nəzərdən keçirilmiş variantlar

| Variant | Nəticə | Səbəb |
|---|---|---|
| **Aİ PID kodlaşdırması, hər format üzrə (bu ADR)** | **qəbul** | Aİ rəqəmsal cüzdanları və yoxlayan tərəfləri ilə eyni adlar; SD-JWT və mdoc-da Aİ-nin öz fərqləri olduğu kimi saxlanılır. |
| Mövcud adlar + yoxlayan tərəfdə uyğunlaşdırma cədvəli | rədd | Hər yoxlayan tərəf və qurum Tamga-ya xas adları bilməli olar; Aİ istiqaməti ilə ziddiyyət təşkil edir. |
| Hər iki formatda tək ad (`birthdate` mdoc-da da) | rədd | Aİ mdoc kodlaşdırması `birth_date` tələb edir; mdoc tərəfində Aİ-dən ayrılmaq demək olardı. |
| Aİ PID tipindən və ad sahəsindən istifadə (`urn:eudi:pid:1`, `eu.europa.ec.eudi.pid.1`) | rədd | Sənəd PID deyil (TL8); Aİ ad sahəsi və tipi yalnız PID provayderinə məxsusdur. |
| `age_over_18` əvəzinə köhnə PID qaydalar kitabı formatı (`age_equal_or_over.18`) | rədd | 2026/1731 PID dəstində yaş yoxdur; köhnə format qüvvədə olan reqlamentə əsaslanmır. ISO 18013-5 adı hər iki formatda başa düşülür. |

# Qərar

## K1 — SD-JWT VC adları
Şəxsiyyət sənədinin SD-JWT VC təqdimatı 2026/1731 Cədvəl 7–8 adlarından istifadə edir: `birthdate` (YYYY-MM-DD) və `nationalities`
(ISO 3166-1 alpha-2 massivi, ən azı bir element; məlum olmayan vətəndaşlıq `QU`, vətəndaşlığı olmayan şəxs `QS`). Massivin hər elementi ayrıca disclosure-dur
(RFC 9901 §4.2.2); Type Metadata-da `path: ["nationalities", null]`. `family_name`, `given_name`, `personal_administrative_number`
və `issuing_country` adları onsuz da eyni idi.

## K2 — mdoc element adları və kodlaşdırması
docType (`urn:tamga:id:IdentityAttestation:1`) və ad sahəsi (`tamga.id.1`) dəyişmir. Elementlər 2026/1731 Cədvəl 6-ya uyğundur: `birth_date`
`full-date` kimi #6.1004(tstr) teqi ilə, `nationality` massiv kimi; digər elementlər SD-JWT adları ilə eynidir. [[ADR-0013]] K2-dəki
"element adları SD-JWT claim adları ilə tam eynidir" qaydası belə dəyişir: **hər iki format eyni məlumatı daşıyır; ad və kodlaşdırma hər formatda Aİ PID
cədvəlinə uyğundur.** Adlar cədvəli açıq paketdədir (`@tamga-network/core/pid`); rəqəmsal cüzdan və yoxlayan tərəf iki formatı bu cədvəllə
müqayisə edir, əhatə dairəsi (RP qeydiyyatı) adları SD-JWT adlarıdır.

## K3 — Yaş
`age_over_18` Aİ PID dəstində yoxdur. Tamga sahəsi kimi ISO/IEC 18013-5 `age_over_NN` adı ilə hər iki formatda olduğu kimi qalır;
ZK predikatı ([[ADR-0032]]) dəyişmir.

## K4 — Tamga-ya xas sahələr və əhatə dairəsi
`document_type`, `document_number_hash`, `document_chip_verified`, `verification_method` Tamga sahələri kimi qalır. Qərar
yalnız şəxsiyyət sənədini əhatə edir: sürücülük vəsiqəsi məlumatları ISO/IEC 18013-5 mDL identifikatorlarından (`birth_date`), təhsil sənədləri
isə öz sxemlərindən istifadə etməyə davam edir; qurumun qeydiyyat mənbəyi interfeysindəki `birth_date` uyğunlaşdırma açarı qurumun öz
qeydidir və dəyişmir. Qurumlar şəxsiyyət sənədindən `birthdate` tələb edir.

## K5 — Keçid yoxdur
İnkişaf mərhələsi ([[ADR-0029]]): sxem yerində düzəldilir, köhnə ad üçün geriyə uyğunluq yazılmır. Köhnə adlı sınaq sənədləri yeni
sxemlə yoxlanılmır; rəqəmsal cüzdanlar şəxsiyyət sənədini yenidən alır.

## K6 — Açıq məsələ: `issuing_country`
2026/1731-də `issuing_country` PID provayderinin ölkəsidir; Tamga şəxsiyyət sənədində isə yoxlanılan şəxsiyyət sənədini verən
ölkədir. Ad hazırda saxlanılır; məna fərqi rulebook-da yazılıb. Ayrı bir ada keçid yeni ictimai ad tələb edir və layihə
rəhbərliyinin qərarına buraxılıb.

**Qərar (2026-10-11):** ayrı ad yoxdur; sahə Aİ mənasını daşıyır (sənədi verən provayderin ölkəsi). Hazırda sənədi Tamga
şəxsiyyət xidməti skan edilmiş şəxsiyyət sənədinə əsasən verdiyi üçün dəyər skan edilmiş sənədin ölkəsidir; kod dəyişmir. Dövlət PID
provayderi PID verdikdə sahə Aİ mənası ilə doldurulur və izah edilir ([[FW-RB-0003]] §4.6, [[SPEC-ID-0003]] §9).

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| PD1 | Şəxsiyyət sənədinin sahə adları və kodlaşdırması Aİ PID kodlaşdırmasına (İcra Reqlamenti (Aİ) 2026/1731: SD-JWT VC Cədvəl 7–8, mdoc Cədvəl 6) uyğundur; hər iki format eyni məlumatı daşıyır. |
| PD2 | Massiv dəyərli sahələrin (`nationalities`) hər elementi ayrıca seçici şəkildə açıqlanır (RFC 9901 §4.2.2). |

# Nəticələr

- Sxem kataloqu: `IdentityAttestation` yerində düzəldildi (`birthdate`, `nationalities`); `vct#integrity` dəyişdi.
- Kod: `@tamga-network/core/pid` (adlar cədvəli), `@tamga-network/mdoc` (`toPidMdocElements`, full-date), `@tamga-network/sd-jwt`
  (massiv elementinin disclosure-u), `@tamga-network/issuer` (uyğunlaşdırma açarı `birthdate`), `@tamga-network/verifier` (mdoc
  adları → sxem və əhatə dairəsi), `@tamga-network/wallet-core` (mdoc uyğunlaşdırması, MD1, sürücülük vəsiqəsi ilkin şərti); şəxsiyyət xidməti
  (operator repozitoriyası); qurumların uyğunlaşdırma konfiqurasiyası; etibar siyahısındakı yoxlayan tərəf əhatə dairələri.
- [[ADR-0011]] sahə cədvəli və [[ADR-0013]] K2 / MD1 mətni bu ADR-ə əsasən oxunur; [[SPEC-ID-0003]] §9, [[FW-RB-0003]] §2, §3, §4.6
  yeniləndi.
- Rəqəmsal cüzdanlar şəxsiyyət sənədini yenidən alır (K5).

# Status

**Accepted — 2026-10-09.** Layihə rəhbərliyinin təsdiqi ilə. DECISIONS: D-ID-11.
