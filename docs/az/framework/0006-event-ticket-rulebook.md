---
document_id: FW-RB-0004
title: "Event Ticket Rulebook"
status: Active
version: 1.0.0
created: 2026-09-27
last_updated: 2026-10-16
summary: >
  Tədbir biletinin (`urn:tamga:tkt:EventTicket:1`) rulebook-u (Tamga Rulebook-dan şaxələnir), Avropa İttifaqının (Aİ) Attestation Rulebook şablonunun bölmə strukturu ilə: fərdi məlumatlar daşımayan, cihaza bağlı, girişdə birdəfəlik rəqəmsal sənəd. Atributlar və metaməlumatlar, hüquqi kateqoriya, SD-JWT VC kodlaşdırması, kim verir, girişdə birdəfəlik istifadə, yoxlama siyasəti, etibar lövbərləri, etibarlılıq, ləğv və ötürmə. Mənbələr ADR-0012, ADR-0014 və sxem kataloqudur.
translation_of: FW-RB-0004
source_version: "1.0.0"
---

| Versiya | Tarix | Təsvir |
|---|---|---|
| 1.0.0 | 2026-10-16 | Tamga ARF 1.0-ın aktual mətni; Aİ Attestation Rulebook şablonunun (versiya 1.5) bölmə strukturunda. |

**Sxemin sahibi:** Tamga Network (hazırda müvəqqəti operator). **Rəy və təkliflər:** <https://github.com/tamga-network/tamga-network/issues>

---

# 1. Giriş

## 1.1 Əhatə dairəsi və məqsəd

| Növ | `vct` | Kataloq |
|---|---|---|
| Tədbir bileti | `urn:tamga:tkt:EventTicket:1` | `schemas.tamga.network/v1/tkt/EventTicket/1.0.0` |

**Məqsəd:** bilet satıcısının və ya təşkilatçının bileti rəqəmsal cüzdana verməsi və girişin bileti şəxsi tanımadan, bir dəfə buraxması.
Bilet **fərdi məlumatlar daşımır**: şəxsi deyil, bileti göstərir; cihaz açarına bağlıdır (`cnf`), şəxsiyyət sahəsi yoxdur. Girişdə şəxsiyyət
tələb olunarsa (məsələn, adlı bilet), bu ayrıca təqdimatdır (şəxsiyyət sənədi, Identity Rulebook). Bilet Aİ baxımından kvalifikasiyalı olmayan
bir **[[t:EAA]]** hesab olunur.

## 1.2 Sənədin strukturu

2-ci bölmə atributlar və metaməlumatlar; 3-cü bölmə kodlaşdırma; 4-cü bölmə istifadə, rəqəmsal sənədin verilməsi və girişdə birdəfəlik istifadə; 5-ci bölmə etibar
lövbərləri; 6-cı bölmə etibarlılıq, ləğv və ötürmə; 7-ci bölmə Aİ ilə uyğunluq.

## 1.3 Açar sözlər

**MUST**, **MUST NOT**, **SHOULD** və **MAY** RFC 2119 mənasındadır (Tamga Rulebook §0).

## 1.4 Terminlər

Terminlər Əlavə D-dədir; Aİ terminləri ARF Annex 1 mənasındadır.

---

# 2. Atributlar və metaməlumatlar

## 2.0 Aİ tələbləri və bu sənəddəki qarşılıqları

| Tələb | Qarşılıq |
|---|---|
| EAA olmasının göstəricisi (ARB_12) | §2.1 |
| Sənədi verən qurumun kimliyi, Əlavə V, b (ARB_15) | `iss`, `x5c` yarpaq sertifikatı; həmçinin `organizer_name` |
| Subyektin kimliyi, Əlavə V, c (ARB_17) | Qəsdən yoxdur: bilet şəxsi deyil, cihazı bağlayır ([[ADR-0014]]); şəxs tələb olunarsa, şəxsiyyət sənədi ayrıca istənilir |
| Etibarlılığın başlanğıcı və sonu, Əlavə V, e (ARB_19) | `iat`, `exp` (§6.1); tədbirin vaxtı `event_start`, `event_end` |
| Etibar lövbərinin yeri, Əlavə V, h (ARB_21) | Rəqəmsal sənəddə ayrıca sahə yoxdur; yer sənədi verən qurumun sertifikat zənciri və Tamga etibar siyahılarıdır (§5) |

## 2.1 Ümumi məlumat və hüquqi kateqoriya

Sahələr tədbiri, məkanı və bilet sinfini təsvir edir; satıcının bilet nömrəsi yalnız heş dəyəri ilə daşınır. **Hüquqi kateqoriya
(`category`):** sənədi verən qurum `urn:tamga:eaa:qualified` və ya `urn:tamga:eaa:pub` dəyərini yalnız qeydiyyat sinfi kvalifikasiyalı
və ya dövlət olduqda və qeydiyyatdakı dəyərlə yazmalıdır (**MUST**); I1–I2-də yazmamalıdır (**MUST NOT**) (RB-AP-14). Kvalifikasiyalı olmayan EAA-da yoxluq ETSI TS 119 472-1
qaydasına uyğun göstəricidir (Aİ şablonundakı adla `category`; ARF mətnində köhnə adı `attestation_legal_category`, ARB_25).

## 2.2 Məcburi atributlar

| Məlumat identifikatoru | Təsvir | Məlumat tipi | Nümunə dəyər |
|---|---|---|---|
| `event_id` | Tədbirin kodu | mətn (1–64) | `KONSER-2026-11-21` |
| `event_name` | Tədbirin adı | mətn (1–200) | `Kış Konseri` |
| `event_start`, `event_end` | Başlanğıc və bitmə | tarix-vaxt (RFC 3339) | `2026-11-21T19:00:00+03:00` |
| `venue_name` | Məkan | mətn (1–200) | `Kültür Merkezi` |
| `organizer_name` | Təşkilatçı | mətn (1–200) | `Örnek Etkinlik A.Ş.` |
| `ticket_class` | Bilet sinfi (məs. STANDARD, VIP, STUDENT) | mətn (1–64) | `STANDARD` |
| `ticket_no_hash` | Satıcının bilet nömrəsinin heş dəyəri; satıcı onu öz qeydi ilə uyğunlaşdırır | `sha256-…` | `sha256-…` |
| `gate` | Girişin keçid kartı alacağı yoxlayan tərəf: `verifier_client_id`, `terminal_group`, istəyə bağlı `policy_id` | obyekt | `{"verifier_client_id":"x509_hash:…","terminal_group":"ana-giris"}` |

## 2.3 İstəyə bağlı atributlar

| Məlumat identifikatoru | Təsvir | Məlumat tipi | Nümunə dəyər |
|---|---|---|---|
| `seat` | Oturacaq | mətn (≤ 32) | `B-14` |

## 2.4 Şərti atributlar

Yoxdur.

## 2.5 Məcburi metaməlumatlar

| Məlumat identifikatoru | Təsvir | Məlumat tipi | Nümunə dəyər |
|---|---|---|---|
| `iss` | Sənədi verən qurumun ünvanı | URI | `https://issuer.tamga.network/ornek-bilet` |
| `vct`, `vct#integrity` | Növ və növ təsvirinin heş dəyəri | URN, `sha256-…` | `urn:tamga:tkt:EventTicket:1` |
| `iat`, `exp` | Verilmə anı və etibarlılığın sonu | NumericDate | — |
| `cnf` | Rəqəmsal cüzdanın cihaz açarı | JWK | — |
| `status` | Ləğv və "istifadə olunub" biti üçün siyahı istinadı | obyekt | `{"status_list":{"idx":701,"uri":"https://status.tamga.network/c41f9a07"}}` |

## 2.6 İstəyə bağlı metaməlumatlar

Yoxdur.

## 2.7 Şərti metaməlumatlar

| Məlumat identifikatoru | Şərt | Məlumat tipi |
|---|---|---|
| `category` | Yalnız qeydiyyat sinfi kvalifikasiyalı və ya dövlət olan sənədi verən qurumda (§2.1) | `urn:tamga:eaa:qualified` \| `urn:tamga:eaa:pub` |

---

# 3. Kodlaşdırma

## 3.1 ISO/IEC 18013-5 (mdoc)

**Yaxın sahə təhlili (ARB_02).** Girişdə internetsiz yoxlama tələb olunur; bunu bilet deyil, fərdi məlumatlar ehtiva etməyən 60 saniyəlik imzalı
keçid jetonu təmin edir ([[ADR-0012]]; §4.3): terminal jetonu oflayn yoxlayır. Buna görə bilet mdoc kimi verilmir.

## 3.2 SD-JWT VC

Bilet [[t:SD-JWT-VC]] kimi, HAIP 1.0-ın SD-JWT VC profilinə uyğun verilir (ARB_01b): `alg` ES256, `typ` `dc+sd-jwt`, `x5c`,
`vct#integrity` məcburidir. Bütün claim adları Tamga-ya xas adlardır (ARB_06b). "Seçici paylaşım" sütunu Type Metadata-dakı `sd`
dəyəridir (ARB_30).

| Məlumat identifikatoru | Claim adı | Kodlaşdırma | Qeyd | Seçici paylaşım |
|---|---|---|---|---|
| `event_id`, `event_name`, `venue_name`, `organizer_name`, `ticket_class`, `seat`, `ticket_no_hash` | eyni | string | Tamga-ya xas | MUST |
| `event_start`, `event_end` | eyni | string (RFC 3339 tarix-vaxt) | Tamga-ya xas | MUST |
| `gate` | `gate` | obyekt | Tamga-ya xas; fərdi məlumat deyil | MUST NOT |
| `iss`, `vct`, `vct#integrity`, `iat`, `exp`, `cnf`, `status`, `category` | eyni | — | daşıma profili | MUST NOT |

**Nümunə (JWT claim toplusu, disclosure-lar açılmış halda):**

```json
{
  "iss": "https://issuer.tamga.network/ornek-bilet",
  "vct": "urn:tamga:tkt:EventTicket:1",
  "vct#integrity": "sha256-…",
  "iat": 1792000000,
  "exp": 1795390800,
  "cnf": { "jwk": { "kty": "EC", "crv": "P-256", "x": "…", "y": "…" } },
  "status": { "status_list": { "idx": 701, "uri": "https://status.tamga.network/c41f9a07" } },
  "gate": { "verifier_client_id": "x509_hash:…", "terminal_group": "ana-giris" },
  "event_id": "KONSER-2026-11-21",
  "event_name": "Kış Konseri",
  "event_start": "2026-11-21T19:00:00+03:00",
  "event_end": "2026-11-21T22:00:00+03:00",
  "venue_name": "Kültür Merkezi",
  "organizer_name": "Örnek Etkinlik A.Ş.",
  "ticket_class": "STANDARD",
  "seat": "B-14",
  "ticket_no_hash": "sha256-…"
}
```

## 3.3 W3C VCDM

İstifadə olunmur.

---

# 4. İstifadə

## 4.1 İstifadə ssenariləri

Girişdə keçid və bilet sinfinin göstərilməsi. **PID tələbi (ARB_27):** tələb olunmur; giriş şəxsin adını, doğum tarixini və ya
əlaqə məlumatlarını istəmir. Adlı biletdə şəxsiyyət ayrıca təqdimatdır. Əməliyyat məlumatları (ARF Topic 20) müəyyən edilməyib.

## 4.2 Sənədin verilməsi siyasəti: kim verir

| Tələb | Dəyər |
|---|---|
| Sənədi verən qurum | Bilet satıcısı və ya təşkilatçı (məs. bilet platforması) |
| Kateqoriya | `EVENTS` |
| Minimum akkreditasiya | I2 |
| Sənəd növü üzrə səlahiyyət | Bu `vct` üçün icazə siyahısında qeyd |
| Kimliyin doğrulanması | Tələb olunmur (T0) — bilet şəxsə deyil, cihaza bağlanır |
| Rəqəmsal cüzdan | Sənəd verilməzdən əvvəl WIA və KA `wallet_providers[]` siyahısına əsasən yoxlanılır (RB-AP-10) |
| Daxili paylaşım siyasəti | Qurum istəsə, imzalı profil məlumatında dərc edir ([[ADR-0046]], RB-AP-26) |

Qeyd: `EventTicket:1` növ təsvirində (dəyişməz fayl) [[t:issuer|sənədi verən qurum]] kateqoriyası `OTHER` kimi yazılıb; qeydlər [[ADR-0014]] ilə `EVENTS`
kateqoriyasındadır. Təsvirdəki düzəliş `EventTicket:2` ilə gəlir (dərc olunmuş fayl dəyişmir, RB-SCH-02).

## 4.3 Girişdə birdəfəlik istifadə

1. **Qeydiyyat:** şəxs bileti bir dəfə girişin yoxlayan tərəfinə təqdim edir (`gate.verifier_client_id`, [[t:OpenID4VP]]); [[t:verifier|yoxlayan tərəf]]
   keçid hüququ (`pass_grant`) qaytarır.
2. **Giriş:** rəqəmsal cüzdan 60 saniyəlik, **fərdi məlumatlar ehtiva etməyən** imzalı keçid jetonunu QR kod kimi göstərir; terminal onu oflayn
   yoxlaya bilər.
3. **Tək keçid:** keçid zamanı ləğv siyahısındakı bit "istifadə olunub" vəziyyətinə keçirilir; ləğv siyahısı sabit intervalla dərc olunduğundan eyni
   terminal qrupundakı girişlər **ümumi "istifadə olunub" siyahısı** saxlayır və interval daxilində ikinci keçidi bu siyahı dayandırır.
4. Təşkilatçı həm sənədi verən qurum, həm də yoxlayan tərəf olduğundan əlaqələndirilməzlik bu növ üçün mənasızdır; bu, qəbul edilmiş
   vəziyyətdir.
5. Terminal yalnız qeydiyyatdan keçmiş yoxlayan tərəfin tabeliyində müəyyən edilir (`terminal_groups[]`).
6. Keçid kartı hər təqdimatda PIN soruşmur: bu, şəxsin verdiyi **müddətli və əhatəsi müəyyən** razılığa əsaslanır; razılıq istənilən an geri
   götürülə bilər və hər təqdimat rəqəmsal cüzdanda qeydə alınır (Əlavə A §3.7; rəqəmsal cüzdan qaydaları [[SPEC-WALLET-0001]]).

## 4.4 Yoxlama siyasəti (yoxlayan tərəfin öhdəlikləri)

| Siyasət | Tələb olunan |
|---|---|
| `event-ticket` (istinad) | `vct = EventTicket:1`; sənədi verən qurum `EVENTS` kateqoriyasında və bu növ üçün səlahiyyətli, ən azı I2; ləğv edilməmiş və istifadə olunmamış; tələb olunan sahələr yalnız `event_id` və `ticket_class` |

Yoxlama kanonik xəttdən keçir (RB-RP-03). Nəticə üç dəyərlidir; `INDETERMINATE` keçid demək deyil.

## 4.5 Cihaza bağlılıq

Bilet **cihaza bağlıdır** (ARB_34; `cnf`). `cryptographically_bound_to` istifadə olunmur.

---

# 5. Etibar lövbərləri

Kvalifikasiyalı olmayan EAA üçün etibar lövbəri Tamga-nın imzalı etibar siyahılarından götürülür (ARB_26): yoxlayan tərəf siyahıların siyahısını
(`https://trust.tamga.network/lotl.jws`) və milli siyahını (`tl-tr.jws`) əvvəlcədən yükləyir və kök sertifikatlara əsasən yoxlayır (kök
barmaq izləri `tamga.network/trust-anchor`, RB-OP-06); rəqəmsal sənədin `x5c` zənciri milli kökə bağlanır və `issuer_id` yarpaq
sertifikatın barmaq izidir; `tl-tr › issuers[]` qeydi kateqoriyanı (`EVENTS`), sinfi və bu növ üzrə səlahiyyəti müəyyən edir; növ `lotl › schemas[]`
və `vct#integrity` ilə yoxlanılır. Giriş terminalı siyahıları və öz yoxlayan tərəfinin açarını əvvəlcədən yükləyir.

---

# 6. Etibarlılıq, ləğv və ötürmə

## 6.1 Etibarlılıq siyasəti

`exp` = tədbirin bitməsi + 1 gün; ən çox 400 gün (bir il əvvəlcədən satış). Nüsxə: **hər oturacaq üçün bir nüsxə**.

## 6.2 Ləğv

| Mövzu | Qayda |
|---|---|
| Ləğv edilə bilərmi | **Bəli, məcburidir** — Token Status List (Aİ-nin Attestation Status List-i): ləğv **və** girişdə "istifadə olunub" biti |
| Ləğv şərtləri | Geri qaytarma, tədbirin ləğvi, səhv satış, ötürmə (§6.3) — təfərrüat [[FW-POL-0001]] §3 |
| Siyahının ünvanı (ARB_24a) | Rəqəmsal sənəddəki `status.status_list.uri`; şəbəkənin yerləşdirdiyi xidmətdə `https://status.tamga.network/` altında, öz xidmətini idarə edən satıcıda isə satıcının status serverində; ünvan qeyri-şəffafdır (opaque) |
| Dərc | Sabit intervalla, dəyişiklik olmasa belə (RB-AP-17) |

## 6.3 Ötürmə

Bilet başqasına **ötürülmür**; ötürmə dedikdə satıcının köhnə bileti ləğv edib onu yeni cihaza yenidən verməsi nəzərdə tutulur.

---

# 7. Uyğunluq

- Bu rulebook Aİ Attestation Rulebook şablonunun (1.5) bölmə strukturunu izləyir (ARB_29); Topic 12 uyğunlaşdırması Tamga Rulebook-un §11 bölməsindədir.
- Bilet Tamga Rulebook-un bütün qaydalarını miras alır.
- **Məlum fərqlər:** subyektin şəxsiyyəti (ARB_17, SHOULD) qəsdən yoxdur; etibar lövbərinin yeri rəqəmsal sənəddə sahə kimi yoxdur və əlavə edilmir
  ([[ADR-0047]] K7); kvalifikasiyalı olmayan EAA-da `category` yazılmır, ETSI izlənilir ([[ADR-0047]] K6); ETSI-nin `oneTime` məhdudiyyəti əvəzinə birdəfəlik istifadə girişdəki "istifadə edildi" biti ilə təmin olunur.

---

# 8. Mənbələr

Aİ Attestation Rulebook şablonu, ARF Annex 2 Topic 7 və 12, ETSI TS 119 472-1, SD-JWT VC, HAIP 1.0, IETF Token Status List. Bu
sənədin əsaslandığı Tamga qərarları və spesifikasiyaları Əlavə E-də sadalanır.

# Status

**Qüvvədədir** — versiya 1.0.0 (2026-10-16).
