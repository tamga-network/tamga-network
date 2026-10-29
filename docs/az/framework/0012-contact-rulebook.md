---
document_id: FW-RB-0005
title: "Contact Rulebook"
status: Active
version: 1.0.0
created: 2026-10-11
last_updated: 2026-10-16
summary: >
  Şəxsiyyət xidmətinin verdiyi iki əlaqə rəqəmsal sənədinin (yoxlanılmış e-poçt ünvanı `urn:tamga:contact:EmailAddress:1`, yoxlanılmış telefon nömrəsi `urn:tamga:contact:PhoneNumber:1`) rulebook-u, Aİ Attestation Rulebook şablonunun bölmə quruluşu ilə: atributlar və metaməlumatlar, hüquqi kateqoriya, SD-JWT VC kodlaşdırması, sahiblik sübutu, istifadə, etibar ankerləri, etibarlılıq müddəti və ləğv. Tamga Rulebook-dan şaxələnir; mənbəyi ADR-0021-dir.
translation_of: FW-RB-0005
source_version: "1.0.0"
---

| Versiya | Tarix | Təsvir |
|---|---|---|
| 1.0.0 | 2026-10-16 | Tamga ARF 1.0-ın aktual mətni; Aİ Attestation Rulebook şablonunun (versiya 1.5) bölmə strukturunda. |

**Sxemin sahibi:** Tamga Network. Tamga Network (yaradılacaq fond) adından müvəqqəti operator: BROS İNŞAAT SANAYİ VE DIŞ TİCARET LİMİTED ŞİRKETİ. **Rəy və təkliflər:** <https://github.com/tamga-network/tamga-network/issues>

---

# 1. Giriş

## 1.1 Əhatə dairəsi və məqsəd

| Növ | `vct` | Kataloq |
|---|---|---|
| Yoxlanılmış e-poçt ünvanı | `urn:tamga:contact:EmailAddress:1` | `schemas.tamga.network/v1/contact/EmailAddress/1.0.0` |
| Yoxlanılmış telefon nömrəsi | `urn:tamga:contact:PhoneNumber:1` | `schemas.tamga.network/v1/contact/PhoneNumber/1.0.0` |

**Məqsəd:** saytlar və qurumlar şəxsin e-poçt ünvanını və ya telefon nömrəsini hər dəfə öz kodlarını göndərərək yoxlamaq
əvəzinə bu rəqəmsal sənədi tələb edir; sübut bir dəfə alınır, rəqəmsal cüzdanda saxlanılır ([[ADR-0021]]). Rəqəmsal sənəd yalnız "bu ünvan bu rəqəmsal cüzdanın nəzarətində idi" deyir,
şəxsin kim olduğunu bildirmir. Hər iki növ Aİ baxımından ixtisaslı olmayan **[[t:EAA]]**-dir; eIDAS 2.0 və EUDI ARF e-poçt və ya
telefon üçün ayrıca PID sahəsi və ya müəyyən edilmiş növ nəzərdə tutmur.

## 1.2 Sənədin strukturu

Bölmə 2 atributlar və metaməlumatlar; Bölmə 3 kodlaşdırma; Bölmə 4 istifadə və rəqəmsal sənədin verilməsi; Bölmə 5 etibar lövbərləri; Bölmə 6 etibarlılıq
və ləğv; Bölmə 7 Aİ ilə uyğunluq.

## 1.3 Açar sözlər

**MUST**, **MUST NOT**, **SHOULD** və **MAY** RFC 2119 mənasındadır (Tamga Rulebook §0).

## 1.4 Terminlər

Terminlər Əlavə D-dədir; Aİ terminləri ARF Annex 1 mənasındadır.

---

# 2. Atributlar və metaməlumatlar

## 2.0 Aİ tələbləri və bu sənəddəki qarşılıqları

| Tələb | Qarşılıq |
|---|---|
| EAA olduğunun göstəricisi (ARB_12) | §2.1 — `category` yoxdur |
| Sənədi verənin kimliyi, Əlavə V b (ARB_15) | `iss` (identifikasiya xidməti) və `x5c` yarpaq sertifikatı |
| Subyektin kimliyi, Əlavə V c (ARB_17) | Qəsdən yoxdur: rəqəmsal sənəd şəxsiyyət məlumatı (ad, şəxsiyyət nömrəsi, doğum tarixi) daşımır (CT3); predmeti ünvan və ya nömrədir |
| Etibarlılığın başlanğıcı və sonu, Əlavə V e (ARB_19) | `iat`, `exp` |
| Etibar lövbərinin yeri, Əlavə V h (ARB_21) | Rəqəmsal sənəddə ayrıca sahə yoxdur; yer §5-dəki siyahılardır |

## 2.1 Ümumi məlumat və hüquqi kateqoriya

Hər ünvan və ya nömrə ayrıca rəqəmsal sənəddir; bir şəxs bir neçə ünvan əlavə edə bilər. **Hüquqi kateqoriya:** əlaqə rəqəmsal sənədi `category`
daşımamalıdır (**MUST NOT**) (CT3; [[ADR-0021]] K4): rəqəmsal sənəd ixtisaslı deyil və dövlət qurumunun sənədi deyil. Bu yoxluq ETSI TS 119 472-1
qaydasına uyğun göstəricidir (Aİ şablonundakı `category`; ARF mətnində köhnə adı `attestation_legal_category`, ARB_25).

## 2.2 Məcburi atributlar

| Növ | Məlumat identifikatoru | Təsvir | Məlumat tipi | Nümunə dəyər |
|---|---|---|---|---|
| E-poçt | `email` | Sahibliyi sübut edilmiş e-poçt ünvanı, kiçik hərflərə çevrilmiş | mətn (e-poçt) | `ayse@example.org` |
| Telefon | `phone_number` | Sahibliyi sübut edilmiş telefon nömrəsi, E.164 | mətn (`+` və 7–15 rəqəm) | `+905321234567` |

## 2.3 İstəyə bağlı atributlar

Yoxdur.

## 2.4 Şərti atributlar

Yoxdur.

## 2.5 Məcburi metaməlumatlar

| Məlumat identifikatoru | Təsvir | Məlumat tipi | Nümunə dəyər |
|---|---|---|---|
| `iss` | Sənədi verənin ünvanı (identifikasiya xidməti) | URI | `https://id.tamga.network` |
| `vct`, `vct#integrity` | Növ və növ təsvirinin heşi | URN, `sha256-…` | `urn:tamga:contact:EmailAddress:1` |
| `iat`, `exp` | Verildiyi an və etibarlılığın sonu (≤ 1 il) | NumericDate | — |
| `cnf` | Rəqəmsal cüzdanın cihaz açarı | JWK | — |
| `status` | Ləğv siyahısına istinad | obyekt | `{"status_list":{"idx":3307,"uri":"https://status.tamga.network/90ad5e2c"}}` |

## 2.6 İstəyə bağlı metaməlumatlar

Yoxdur.

## 2.7 Şərti metaməlumatlar

Yoxdur (`category` yoxdur).

---

# 3. Kodlaşdırma

## 3.1 ISO/IEC 18013-5 (mdoc)

**Yaxın sahə təhlili (ARB_02).** Əlaqə məlumatının internetsiz, üz-üzə təqdim edilməsi üçün istifadə ssenarisi yoxdur; rəqəmsal sənəd
yalnız SD-JWT VC kimi verilir, mdoc təqdimatı yoxdur ([[ADR-0021]] K4).

## 3.2 SD-JWT VC

HAIP 1.0-ın SD-JWT VC profilinə uyğundur (ARB_01b): `alg` ES256, `typ` `dc+sd-jwt`, `x5c`, `vct#integrity` məcburidir. Claim adları IANA-da
qeydiyyatdan keçmiş adlardır (ARB_06b, ARB_08).

| Məlumat identifikatoru | Claim adı | Kodlaşdırma | Mənbə | Seçici açıqlama |
|---|---|---|---|---|
| `email` | `email` | string | OpenID Connect Core §5.1 (IANA) | MUST |
| `phone_number` | `phone_number` | string (E.164) | OpenID Connect Core §5.1 (IANA) | MUST |
| `iss`, `vct`, `vct#integrity`, `iat`, `exp`, `cnf`, `status` | eyni | — | daşıma profili | MUST NOT |

Aİ PID-də eyni məlumatlar ixtiyari `email` və `phone_number` adları ilə keçir (mdoc-da `email_address`, `mobile_phone_number`);
Tamga-nın əlaqə rəqəmsal sənədi PID-in hissəsi deyil, ayrıca EAA-dır.

**Nümunə (e-poçt; JWT claim toplusu, açıqlamaları açılmış halda):**

```json
{
  "iss": "https://id.tamga.network",
  "vct": "urn:tamga:contact:EmailAddress:1",
  "vct#integrity": "sha256-…",
  "iat": 1791763200,
  "exp": 1823299200,
  "cnf": { "jwk": { "kty": "EC", "crv": "P-256", "x": "…", "y": "…" } },
  "status": { "status_list": { "idx": 3307, "uri": "https://status.tamga.network/90ad5e2c" } },
  "email": "ayse@example.org"
}
```

## 3.3 W3C VCDM

İstifadə olunmur.

---

# 4. İstifadə

## 4.1 İstifadə ssenariləri

Saytda qeydiyyat və ya əlaqə məlumatlarının yenilənməsi, qurumun şəxslə əlaqə saxlayacağı ünvanı şəxsin özünün təqdim etməsi. Ünvan saytlararası
identifikatordur; yalnız şəxsin razılığı ilə açıqlanır. **PID tələbi (ARB_27):** tələb olunmur. Əməliyyat məlumatları (ARF Topic 20) müəyyən
edilməyib. Yoxlayan tərəf kanonik ardıcıllığı tətbiq edir (RB-RP-03); nəticə üç qiymətlidir.

## 4.2 Rəqəmsal sənədin verilməsi siyasəti

| Tələb | Dəyər |
|---|---|
| Sənədi verən | Yalnız Tamga Network identifikasiya xidməti (`IDENTITY` · `EAA` · I2) |
| Şəxsiyyətin yoxlanılması | Tələb olunmur (T0): rəqəmsal sənəd yalnız sahibliyi sübut edir |
| Sahibliyin sübutu | Birdəfəlik 6 rəqəmli kod e-poçt və ya SMS ilə göndərilir; düzgün kod daxil edildikdə rəqəmsal sənəd verilir (CT1). Kod 10 dəqiqə etibarlıdır, ən çox 5 cəhd; axın başına ən çox 3, ünvan başına saatda ən çox 5 göndəriş; kod yaddaşda yalnız heş kimi saxlanılır |
| Axın | Şəxsiyyət sənədi ilə eyni: [[t:OpenID4VCI]] avtorizasiya kodu + [[t:PAR]] + PKCE + rəqəmsal cüzdan sübutu (WIA, KA; RB-AP-10) |
| Məlumatlar | Ünvan yalnız axın müddətində yaddaşda saxlanılır; rəqəmsal sənəd verildikdən sonra silinir; verilənlər bazasında yalnız açarlı heş. Ünvan, nömrə və kod jurnala yazılmır, ekranda maskalanmış göstərilir (CT2) |
| Göndəriş provayderi | Konfiqurasiya ilə seçilir; heç biri konfiqurasiya edilməyibsə, növ metaməlumatlarında elan edilmir. Test yolları real istifadəçilər üçün açıq mühitdə istifadə edilmir (CT4) |
| Daxili açıqlama siyasəti | Daşımır ([[ADR-0046]] K1) |

## 4.3 Cihaza bağlılıq

Hər iki növ **cihaza bağlıdır** (ARB_34; `cnf`). `cryptographically_bound_to` istifadə edilmir.

---

# 5. Etibar lövbərləri

İxtisaslı olmayan EAA üçün etibar lövbəri Tamga-nın imzalı etibar siyahılarından götürülür (ARB_26): siyahıların siyahısı
(`https://trust.tamga.network/lotl.jws`) və milli siyahı (`tl-tr.jws`) kök sertifikatlara əsasən yoxlanılır (kök barmaq izləri
`tamga.network/trust-anchor`, RB-OP-06); rəqəmsal sənədin `x5c` zənciri milli kökə bağlanır; `tl-tr › issuers[]` qeydi identifikasiya xidmətinə
bu iki növ üzrə səlahiyyət verir; növ `lotl › schemas[]` və `vct#integrity` ilə yoxlanılır.

---

# 6. Etibarlılıq və ləğv

## 6.1 Etibarlılıq siyasəti

`exp` = verildiyi an + 365 gün. Nömrələr və ünvanlar başqasına keçə bildiyi üçün etibarlılıq ən çox bir ildir; sübut yalnız rəqəmsal sənədin
verildiyi andakı sahibliyi göstərir.

## 6.2 Ləğv

| Mövzu | Qayda |
|---|---|
| Ləğv edilə bilərmi | **Bəli, məcburidir** — Token Status List (Aİ-nin Attestation Status List-i) |
| Ləğv şərtləri | Eyni ünvan yenidən sübut edildikdə köhnə rəqəmsal sənəd; şəxsin silmə tələbi (identifikasiya xidmətindən alınmış bütün rəqəmsal sənədlər); razılığın geri götürülməsi (RB-AP-21) — təfərrüat [[FW-POL-0001]] §3 |
| Siyahı ünvanı (ARB_24a) | Rəqəmsal sənəddəki `status.status_list.uri`; identifikasiya xidmətinin siyahıları `https://status.tamga.network/` altında; ünvan qeyri-şəffafdır |
| Dərc | Sabit intervalla (hazırda 2 dəqiqə), dəyişiklik olmasa belə (RB-AP-17) |

---

# 7. Uyğunluq

- Bu rulebook Aİ Attestation Rulebook şablonunun (1.5) bölmə strukturunu izləyir (ARB_29); Topic 12 uyğunlaşdırması Tamga Rulebook §11-dədir.
- Hər iki növ Tamga Rulebook-un bütün qaydalarını miras alır; növə xas invariantlar [[ADR-0021]] CT1–CT4-dür.
- **Məlum fərqlər:** subyektin kimliyi (ARB_17, SHOULD) qəsdən yoxdur; etibar lövbərinin yeri rəqəmsal sənəddə sahə kimi yoxdur və əlavə edilmir
  ([[ADR-0047]] K7); ixtisaslı olmayan EAA-da `category` yazılmır, ETSI-yə əməl edilir ([[ADR-0047]] K6).

---

# 8. Mənbələr

Aİ Attestation Rulebook şablonu, ARF Annex 2 Topic 7 və 12, ETSI TS 119 472-1, SD-JWT VC, HAIP 1.0, OpenID Connect Core 1.0, IETF
Token Status List. Bu sənədin əsaslandığı Tamga qərarları və spesifikasiyaları Əlavə E-də sadalanır.

# Status

**Qüvvədədir** — versiya 1.0.0 (2026-10-16).
