---
document_id: GUIDE-0012
title: "Problemlərin həlli"
status: Active
version: 1.0.0
created: 2026-10-03
last_updated: 2026-10-16
summary: >
  Tez-tez rast gəlinən problemlər və onların həlli: yoxlamada "yoxlanıla bilmədi" səbəbləri, rədd edilən addımlar, etibar siyahısının yüklənməsi xətaları, rəqəmsal cüzdanda rəqəmsal sənədin alınması və təqdim edilməsi xətaları, cihaz sübutu, qeydiyyat müraciəti və servis xətalarının formatı.
translation_of: GUIDE-0012
source_version: "1.0.0"
---

# Problemlərin həlli

Bu səhifə Tamga-ya qoşulan proqramçıların ən çox rastlaşdığı problemləri və onların həllini bir yerə toplayır.

**Nə vaxt oxumalı:** yoxlama gözlənilməz nəticə verdikdə, rəqəmsal cüzdan rəqəmsal sənədi ala və ya təqdim edə bilmədikdə,
qeydiyyat müraciəti geri qaytarıldıqda.

## Əvvəlcə: nəticə nə deyir?

Yoxlama üç dəyərli nəticə qaytarır ([[SPEC-API-0001]] §2):

| `outcome` | Mənası | İlk baxılacaq sahə |
|---|---|---|
| `ACCEPTED` | Bütün addımlar keçdi | — |
| `REJECTED` | Rəqəmsal sənəd etibarsızdır | `failed_step` |
| `INDETERMINATE` | Hazırda yoxlanıla bilmədi; rəqəmsal sənəd barədə hökm yoxdur | `indeterminate_reason` |

`REJECTED` və `INDETERMINATE` nəticələrini eyni mesajla göstərməyin. "Bu rəqəmsal sənəd etibarsızdır" və "hazırda yoxlaya bilmirəm" fərqli
qərarlardır (AP2).

## "Yoxlanıla bilmədi" (`INDETERMINATE`)

| `indeterminate_reason` | Səbəb | Həll |
|---|---|---|
| `STATUS_UNREACHABLE` | Rəqəmsal sənədin [[t:status-list|ləğv siyahısı]] endirilə bilmədi | Ləğv siyahılarını əvvəlcədən çəkin (`PrefetchStatusCache` + müntəzəm `refresh`); yoxlama anında şəbəkəyə müraciət etməyin |
| `STATUS_STALE` | Keşdəki ləğv siyahısı təzəlik həddini aşıb və ya lövbər anından əvvəl çəkilib | Yeniləmə intervalını qısaldın; saat fərqini yoxlayın (NTP) |
| `SCHEMA_UNREACHABLE` | Rəqəmsal sənəd növünün təsviri əldə edilə bilmədi | Sxem kataloqunu əvvəlcədən keşə yükləyin |
| `CHAIN_UNREACHABLE` / `INDEXER_STALE` | Etibar mənbəyi oxuna bilmədi və ya köhnəlib | Etibar siyahılarını müntəzəm endirin; `next_update` keçibsə, yeni siyahını alın |
| `SDK_VERSION_MISMATCH` | Kitabxana versiyası qayda versiyası ilə uyğun deyil | `@tamga-network/*` paketlərini yeniləyin |
| `STATUS_VALUE_UNKNOWN` | Ləğv siyahısındakı dəyərin müəyyən mənası yoxdur (4/8 bitlik xarici siyahı, tətbiqə xas dəyər) | Sənədi verən qurumun siyahı profilini soruşun; Tamga növlərində görünmür |

Etibar siyahısı köhnəlibsə və ya endirilə bilmirsə, etibar sorğuları `UNKNOWN` qaytarır və nəticə həmişə `INDETERMINATE` olur; heç vaxt
`ACCEPTED`, heç vaxt `REJECTED` olmur.

## Rədd edildi (`REJECTED`)

`failed_step` hansı addımın keçmədiyini göstərir ([[SPEC-API-0001]] §1). Ən çox rast gəlinənlər:

| Addım | Mənası | Baxılacaq yer |
|---|---|---|
| `A3` | İmza zənciri etibar siyahısındakı heç bir kökə bağlanmır | Düzgün siyahını və kök barmaq izlərini yükləmisinizmi? Test mühitinin rəqəmsal sənədini canlı siyahı ilə yoxlamırsınız ki? |
| `A3b` | Rəqəmsal sənədi imzalayan sertifikat `iss` sahəsindəki qurumla uyğun gəlmir | Qurumun identifikatoru həmişə sertifikatdan çıxarılır; `iss` dəyərinə etibar etməyin |
| `A3d` / `A6` | Sənəd sahibinə bağlılıq sübutu (KB-JWT) yoxdur və ya `aud`, `nonce`, `iat` uyğun gəlmir | Sorğuda göndərdiyiniz `nonce` ilə yoxladığınız eynidirmi? Saatlar sinxrondurmu? |
| `A5` | Disclosure-lardan biri rəqəmsal sənəddəki xülasələrlə uyğun gəlmir | Təqdimat dəyişdirilib; yenidən sorğu göndərin |
| `A7` | Rəqəmsal sənədin müddəti bitib (`exp`) və ya hələ qüvvəyə minməyib (`nbf`) | Şəxs rəqəmsal sənədini qurumdan yeniləməlidir; serverinizin saatı düzgündürmü? |
| `C1` | Rəqəmsal sənəd verildiyi anda qurum aktiv deyildi | Qurumun qeydiyyat tarixçəsinə baxın ([[GUIDE-0006]]) |
| `C2` | Qurum bu növ rəqəmsal sənədi verməyə səlahiyyətli deyildi | Qurumun rəqəmsal sənəd növü üzrə səlahiyyəti ([[GUIDE-0007]] §5) |
| `D6` | Rəqəmsal sənəd ləğv edilib və ya dayandırılıb | Sənədi verən quruma müraciət edin |
| `E3` | Tələb etdiyiniz sahələr qeydiyyatdakı əhatə dairənizdən kənardadır | Əhatə dairənizi genişləndirin ([[GUIDE-0008]] §3) |

## Etibar siyahısı yüklənmir

| Əlamət | Səbəb | Həll |
|---|---|---|
| İmza yoxlanılmır | Sabitlənmiş kök barmaq izi siyahını imzalayan köklə uyğun gəlmir | Barmaq izini `tamga.network/trust-anchor` ünvanından yenidən götürün; mühitləri (test / canlı) qarışdırmayın |
| "Naməlum format versiyası" | Siyahı daha yeni formatdadır | Oxuyucu qəsdən dayanır; kitabxananı yeniləyin |
| Versiya geriyə qayıtdı | Köhnə nüsxə təqdim olunur (keş, CDN) | Oxuyucu geriyə qaytarmanı rədd edir; keşi təmizləyin |
| Xarici siyahının qeydləri görünmür | Siyahı köhnəlib, onu imzalayan LOTL-dakı ilə uyğun gəlmir və ya qeyd əhatə dairəsindən kənardadır | Xarici siyahıya bağlı sorğular `UNKNOWN` qaytarır; digər siyahılara təsir etmir ([[GUIDE-0011]]) |

## Rəqəmsal cüzdan: rəqəmsal sənədin alınması

| Xəta (`WalletError`) | Səbəb | Həll |
|---|---|---|
| `tx_code_mismatch` | PIN yanlışdır | PIN təkliflə eyni kanaldan gəlmir; şəxsdən SMS və ya e-poçtdakı PIN-i istəyin |
| `offer_expired` / `offer_used` | Təklifin müddəti bitib və ya artıq istifadə olunub | Qurumdan yeni təklif istəyin |
| `offer_not_found` / `invalid_offer` | QR kod zədələnib və ya Tamga təklifi deyil | Təklifi yenidən skan edin |
| `trust_error` | Qurum və ya cüzdan provayderi siyahıda tapılmadı, imza yoxlanılmadı | Etibar siyahısını yeniləyin; qurumun qeydiyyatını yoxlayın |
| `unsupported` | Bu rəqəmsal cüzdanda dəstəklənməyən növ və ya ləğv edilmiş vahid ("This wallet has been revoked.") | Vahid ləğv edilibsə, yenidən qeydiyyatdan keçin |
| `network` | Bağlantı yoxdur | Yenidən cəhd edin |

## Rəqəmsal cüzdan: cihaz sübutu və WUA

Aşağıdakı cavab sahələri cüzdan provayderinə görə dəyişir; nümunələr bir provayderdən götürülüb (nümunə: Tamga Wallet
provayderi). Öz provayderinizin sənədlərinə baxın.

- **Qeydiyyat cavabında `attestation: "software"`:** cüzdan provayderi cihaz sübutundan istifadə edə bilmədi; qeydiyyat yenə də aparıldı və vahid proqram
  səviyyəsindədir. `reason` səbəbi göstərir: `not_configured` (provayderdə həmin platforma üçün App ID və ya köklər tənzimlənməyib), `invalid`
  (sübut yoxlanıla bilmədi — əksər hallarda tətbiq identifikatoru, Bundle ID və ya paket adı provayderin gözlədiyindən fərqlidir), `unsupported`
  (development build, emulyator, kilidi açılmış cihaz və ya aparat dəstəyi olmayan açar). `attestation: "none"` sübutun ümumiyyətlə təqdim edilmədiyini bildirir
  (Expo Go, yerli modul yoxdur). Qeydiyyat bu səbəblərə görə rədd edilmir.
- **Proqram səviyyəsində qeydiyyat:** Expo Go-da və ya yerli açar modulu olmadan işləyirsiniz. Development build istifadə edin
  ([[GUIDE-0005]] §1).
- **WUA-nın müddəti bitib:** rəqəmsal sənədi almadan əvvəl `wuaExpiringSoon` ilə yoxlayıb yeniləyin.

## Rəqəmsal cüzdan: təqdimat

| Əlamət | Səbəb | Həll |
|---|---|---|
| Ekranda "qeydiyyatdakı əhatə dairəsindən kənar" xəbərdarlığı | Yoxlayan tərəf qeydiyyatda deyil və ya əhatə dairəsindən kənar sahələr tələb edir | Yoxlayan tərəfin qeydiyyatını və əhatə dairəsini düzəldin ([[GUIDE-0008]]) |
| Qeydiyyat sertifikatı uyğun gəlmir | Qeydiyyat sertifikatındakı qurumun identifikasiya nömrəsi giriş sertifikatındakı ilə eyni deyil | Hər ikisi eyni rəsmi identifikasiya nömrəsindən yaradılmalıdır ([[ADR-0026]]) |
| Nüsxələr tükənib | Yoxlayan tərəf üçün xüsusi nüsxə qalmayıb | Şəxsə müraciət edin; yeniləmə qurumdan alınır ([[ADR-0023]]) |
| Psevdonim sorğusu rədd edildi | Yoxlayan tərəf qeydiyyatda deyil və ya qeydiyyatında `pseudonyms` yoxdur | Qeydiyyata psevdonim parametrini əlavə edin ([[ADR-0031]]) |

## Qeydiyyat müraciəti geri qaytarıldı

Qeydiyyat aləti çatışmayan və ya səhv olan sahələrin **hamısını** bir dəfəyə siyahı şəklində göstərir (`kayıt yapılamadı:` və altında bəndlər). Ən çox rast gəlinənlər:
`identifiers`, `postal_address`, `contact`, `supervisory_authority` (müraciət yolu: forma ünvanı, e-poçt və ya telefon),
`scopes[…].privacy_policy_uri`. Format: [[GUIDE-0007]] §2 və [[GUIDE-0008]] §2.

## Servis xətalarının formatı

Tamga servisləri xətaları RFC 9457 formatında qaytarır; `tamga_code` maşının oxuyacağı koddur və `detail` fərdi məlumatlar ehtiva etmir:

```json
{
  "type": "https://docs.tamga.network/errors/schema-not-authorized",
  "title": "The issuer cannot issue this schema",
  "status": 403,
  "tamga_code": "SCHEMA_NOT_AUTHORIZED"
}
```

- **Rədd edilən rəqəmsal sənəd xəta deyil:** yoxlama çağırışı uğurludur (200) və nəticəni gövdədə daşıyır (AP5).
- **`409`:** eyni `Idempotency-Key` fərqli gövdə ilə göndərilib.
- **`429`:** sorğu tezliyi limiti; `Retry-After` qədər gözləyin.

## Problem hələ də həll olunmayıbsa

Xəta jurnalınızdan fərdi məlumatları çıxarın və `verification_id`, `failed_step` və ya `indeterminate_reason`, kitabxana versiyası
(`sdk_version`) ilə birlikdə bildirin. Uyğunluq testlərini işə salmaq uyğunsuzluqların çoxunu üzə çıxarır: [[GUIDE-0009]].
