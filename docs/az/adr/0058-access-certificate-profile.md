---
document_id: ADR-0058
title: "Giriş sertifikatının profili (ETSI TS 119 411-8) və şəxsiyyət xidməti sertifikatının keçid vaxtı"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-21
last_updated: 2026-10-21
summary: >
  Yoxlayan tərəfin giriş sertifikatları (WRPAC) ETSI TS 119 411-8 V1.1.1 §6.6.1-ə uyğun tərtib edilir: subyekt sahəsində qurumun identifikasiya nömrəsi (dəyişməyib), `CN` şəxsin tanıyacağı ticarət adı və ya xidmət adı, SAN-da qeydiyyatdakı domen adına əlavə olaraq dəstək ünvanı (URI; GEN-6.6.1-07 əlaqə məlumatı). Xidmətə bağlı giriş sertifikatı verilən yoxlayan tərəfdə xidmət identifikatoru (`serviceIdentifier`, Aİ TS5) `OU` sahəsindədir (GEN-6.6.1-08). Siyasət identifikatoru və CPS ünvanı (GEN-6.6.1-03/06) şəbəkənin sertifikat tətbiqi bəyanatı dərc edildikdə əlavə olunur. Şəxsiyyət xidmətinin sənəd imza sertifikatına `organizationIdentifier` (ADR-0050 K3) bu gün deyil, şəbəkənin idarəsi fonda təhvil verilərkən yeni açarla verilir; beləliklə şəxsiyyət sənədləri bir dəfə yenidən alınır; təhvil bu gündən skriptləşdirilmiş tək addım kimi hazırlanır. Qəbul: 2026-10-21.
domain: Identity
related: ["[[ADR-0024]]", "[[ADR-0026]]", "[[ADR-0034]]", "[[ADR-0050]]", "[[SPEC-ID-0002]]"]
translation_of: ADR-0058
source_version: "1.0.0"
---

# Kontekst

- **Aİ qaydası (giriş sertifikatı).** ETSI TS 119 411-8 V1.1.1 (2025-10) etibar edən tərəflərin giriş sertifikatlarının siyasətidir;
  CIR 2025/848 Əlavə IV və CIR 2026/1730 ona istinad edir. Hüquqi şəxsə verilən sertifikatda (§6.6.1):
  - GEN-6.1.1-04: `CN` şəxsin tanıyacağı ticarət adı və ya xidmət adı **ola bilər**;
  - GEN-6.6.1-05: `organizationIdentifier` **məcburidir** (EN 319 412-1 §5.1.4);
  - GEN-6.6.1-07: etibar edən tərəfin əlaqə məlumatı SAN-da **məcburidir** — ən azı biri: dəstək veb ünvanı (URI), telefon
    (`otherName`, `id-at-telephoneNumber`) və ya e-poçt (`rfc822Name`);
  - GEN-6.6.1-08: eyni qurumun müxtəlif instansiyaları üçün əlavə sertifikatlar `OU` ilə ayrıla bilər;
  - GEN-6.6.1-03 / -06: siyasət identifikatoru (ETSI `NCP-l-eudiwrp` = 0.4.0.194118.1.2 və ya provayderin OID-i) və CPS ünvanı.
- **Aİ TS5 (qeydiyyat məlumatları).** `serviceIdentifier` ixtiyaridir; vasitəçidən istifadə edən yoxlayan tərəfdə məcburidir. Tək
  xidməti olan və ya xidmətə bağlı giriş sertifikatı istəməyən yoxlayan tərəf bu sahəni yazmaya bilər.
- **Bu gün.** Tamga giriş sertifikatı subyekt sahəsində `CN` (domen adı), `O`, `C` və real şəbəkədə `organizationIdentifier`
  ([[ADR-0026]] K3) daşıyır; SAN-da yalnız qeydiyyatdakı domen adı (`dNSName`, [[ADR-0034]]) var. **Əlaqə məlumatı yoxdur**
  (GEN-6.6.1-07 ödənilmir); siyasət identifikatoru və CPS ünvanı yoxdur. Xidmət identifikatoru qeydiyyat sertifikatında
  (`service_id`) var, giriş sertifikatında yoxdur. İlk Aİ uyğunluq turu (2026-10-13, təklif 10) bunu "giriş sertifikatında xidmət
  identifikatoru yoxdur" kimi qeyd etdi.
- **Şəxsiyyət xidməti sertifikatı.** [[ADR-0050]] K3: identifikasiya nömrəsi qeydiyyata daxil edildikdə şəxsiyyət xidmətinə yeni açar
  və `organizationIdentifier`-li sertifikat verilir. Nömrə 2026-10-19-da qeydiyyata daxil edildi, lakin bu nömrə **müvəqqəti
  operatora** aiddir; şəbəkənin idarəsi fonda təhvil verildikdə nömrə yenə dəyişir. Şəxsiyyət xidmətinin açarı dəyişdikdə bütün
  şəxsiyyət sənədləri yeni açarla yenidən alınmalıdır (sənədin imzalayanı dəyişir). Bu gün edilərsə, şəxslər şəxsiyyət
  sənədlərini iki dəfə yenidən almalı olar.

# Qərar

## K1 — Giriş sertifikatının subyekt sahəsi
- `organizationIdentifier` və `C` məcburidir (dəyişməyib, [[ADR-0026]] K3); `O` qurumun rəsmi adıdır.
- `CN`: şəxsin tanıyacağı ticarət adı və ya xidmət adı (qeydiyyatdakı `trade_name` və ya xidmətin adı). Domen adını `CN`-ə yazmaq
  artıq tələb olunmur; daimi identifikator SAN-dakı domen adıdır ([[ADR-0034]]).

## K2 — SAN: domen adı + əlaqə
- SAN qeydiyyatdakı domen adını (`dNSName`, [[ADR-0034]] CI3) və **ən azı bir əlaqə məlumatını** daşıyır. Tamga-da bu,
  qeydiyyatdakı dəstək ünvanıdır (`support_uri`, [[ADR-0024]]) və `uniformResourceIdentifier` kimi yazılır. Telefon və ya e-poçt
  əlavə olaraq yazıla bilər; şəxsi e-poçt və ya şəxsi telefon yazılmır.
- Dəyər qeydiyyat məlumatlarından götürülür (GEN-6.6.1-10); qeydiyyatda dəstək ünvanı yoxdursa, real şəbəkədə giriş sertifikatı
  verilmir.

## K3 — Xidmətə bağlı giriş sertifikatı
- Yoxlayan tərəf eyni qurum daxilində ayrıca idarə olunan xidmətlər üçün ayrıca giriş sertifikatı istəyərsə, hər sertifikat xidmət
  identifikatorunu `OU` sahəsində daşıyır (GEN-6.6.1-08). Dəyər qeydiyyatdakı xidmət identifikatorudur (qeydiyyat sertifikatındakı
  `service_id` ilə eyni). Bunlar etibar siyahısında ayrıca `relying_parties[]` qeydləridir, hər biri öz domen adı ilə.
- Tək giriş sertifikatı ilə bir neçə istifadə halını (əhatəni) idarə edən yoxlayan tərəfdə (şəbəkənin öz yoxlayan tərəfləri kimi)
  `OU` yazılmır; xidmət identifikatoru hər sorğuda qeydiyyat sertifikatında daşınır ([[ADR-0026]] K4).

## K4 — Siyasət identifikatoru və CPS (təxirə salınır)
- Giriş sertifikatına ETSI-nin `NCP-l-eudiwrp` identifikatoru **yazılmır**: bu identifikator sertifikatın Aİ etibar xidməti
  provayderi tərəfindən ETSI EN 319 411-1 auditi ilə verildiyinin bəyanatıdır; Tamga bunu bəyan edə bilməz.
- Şəbəkənin öz siyasət identifikatoru və CPS ünvanı şəbəkənin sertifikat tətbiqi bəyanatı dərc edildikdə (fondun yaradılması ilə)
  əlavə olunur.

## K5 — Şəxsiyyət xidməti sertifikatının keçid vaxtı ([[ADR-0050]] K3-ün vaxtı)
- Şəxsiyyət xidmətinin sənəd və ləğv siyahısı imza sertifikatına `organizationIdentifier` **şəbəkənin idarəsi fonda təhvil
  verilərkən** verilir: yeni açar (`issuer-id-2` və `-status`), fondun identifikasiya nömrəsi, yeni `issuer_id`; köhnə sertifikat
  üst-üstə düşmə müddətində yalnız köhnə sənədləri yoxlamaq üçün siyahıda qalır ([[ADR-0050]] K3, [[SPEC-ID-0002]] §4).
- O vaxta qədər dərc edənin xəbərdarlığı (ADR-0050 K4) davam edir; qeydiyyat sertifikatı (WRPRC) yaradılmasına təsir etmir.
- **Hazırlıq bu gündən:** sertifikat yalnız hüquqi cəhətdən mövcud olan hüquqi şəxsi adlandıra bildiyi üçün şəxsiyyət xidməti
  sertifikatı fond hüquqi şəxs statusu qazandıqda dəyişir; lakin təhvilin bütün addımları (müvəqqəti operatorun identifikatorunu
  daşıyan hər qeyd və sertifikat, yeni açar və sertifikatlar, siyahının yenidən dərci, cüzdan pinləri, yenidən alma elanı) bu gündən
  yazılı və skriptləşdirilmiş saxlanılır: operatorun təhvil proseduru və heç nəyi dəyişmədən planı çap edib girişləri yoxlayan
  quru sınaq aləti. Pilotdan əvvəl real istifadəçi olmadığı üçün təhvildə sənədlərin yenidən alınması qəbul edilə bilən xərcdir.
- Daha əvvəl edilməli olan hal yaranarsa (açarın sızması, sertifikatın müddəti, Aİ tərəfinin rəsmi tələbi), keçid eyni prosedurla
  həmin gün edilir və müvəqqəti operatorun nömrəsi yazılır.

# Nəzərdən keçirilmiş variantlar

| Seçim | Nəticə | Səbəb |
|---|---|---|
| Xidmət identifikatorunu hər giriş sertifikatına məcburi yazmaq | rədd | TS5-də ixtiyaridir; tək sertifikatla çoxlu istifadə halı idarə edən yoxlayan tərəf üçün xidmət identifikatoru hər sorğuda qeydiyyat sertifikatındadır |
| Xidmət identifikatorunu yeni X.509 genişlənməsində daşımaq | rədd | Aİ-də müəyyən edilmiş genişlənmə yoxdur; 411-8 `OU`-nu göstərir |
| `NCP-l-eudiwrp` yazmaq | rədd | Audit edilmiş Aİ etibar xidməti provayderinin bəyanatıdır |
| Şəxsiyyət xidmətinin açarını bu gün dəyişmək | rədd | Nömrə müvəqqəti operatorundur; təhvildə yenə dəyişir, şəxslər şəxsiyyət sənədlərini iki dəfə yenidən alır |

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| AC1 | Real şəbəkədə giriş sertifikatının SAN-ı qeydiyyatdakı domen adını və ən azı bir əlaqə məlumatını (dəstək ünvanı) daşıyır. |
| AC2 | Xidmətə bağlı giriş sertifikatında xidmət identifikatoru `OU` sahəsindədir və qeydiyyatdakı xidmət identifikatoru ilə eynidir. |
| AC3 | Giriş sertifikatı Tamga-nın bəyan edə bilmədiyi Aİ sertifikat siyasəti identifikatorunu daşımır. |

# Tətbiq

- `ops/pki-issue.ts`: `--contact-uri <ünvan>` (SAN `uniformResourceIdentifier`), `--contact-email <ünvan>` (SAN `rfc822Name`;
  korporativ ünvan) və `--service-id <identifikator>` (`OU`). `--prod` giriş sertifikatında `--contact-uri` məcburidir (AC1). Eyni
  açarla yeniləmə: `--key <şəxsi açar faylı>` və `--replace` (köhnə sertifikat ehtiyat qovluğuna köçürülür).
- 2026-10-21: real və sandbox yoxlayan tərəflərinin giriş sertifikatları **eyni açarla** yenidən verildi (`CN` ticarət adı, SAN domen
  adı + dəstək ünvanı + korporativ e-poçt). Sertifikat dəyişdiyi üçün `client_id` (`x509_hash`) dəyişdi, daimi qeyd (`dns_name`)
  dəyişmədi; siyahı dərc edildi. Psevdonimin sayt açarı [[ADR-0031]] K2-yə görə `dns_name`-dir ([[SPEC-WALLET-0001]] §5.4.1;
  wallet-core 0.7.1 müştəri identifikatoru ilə törətməni rədd edir) — saytlardakı psevdonimlərə yeniləmə təsir etmədi (canlı
  yoxlama ilə).
- Siyahı dərc edəni: real şəbəkədə aktiv (ACTIVE) yoxlayan tərəfin giriş sertifikatında SAN əlaqə məlumatı yoxdursa, xəbərdarlıq
  (AC1); `OU` ↔ qeydiyyatdakı xidmət identifikatoru yoxlaması (AC2) ilk xidmətə bağlı sertifikatla əlavə olunur.
- K5: fonda təhvil iş siyahısındadır; operatorun təhvil proseduru və quru sınaq aləti hazırdır.

# Status

**Accepted — 2026-10-21.** Layihə rəhbərliyinin təsdiqi ilə (K1–K5 təklif edildiyi kimi; K5-də təhvil bu gündən hazırlanır).
DECISIONS: D-REG-3.
