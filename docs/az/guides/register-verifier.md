---
document_id: GUIDE-0008
title: "Yoxlayan tərəf kimi qeydiyyatdan keçmək"
status: Active
version: 1.0.0
created: 2026-10-03
last_updated: 2026-10-23
summary: >
  Saytın və ya xidmətin yoxlayan tərəf kimi Tamga etibar siyahısında qeydiyyatı: domen adı və giriş sertifikatı, Aİ-nin ümumi qeydiyyat məlumatları, istifadə əhatələri (məqsəd, sahələr, məxfilik siyasəti), qeydiyyat sertifikatı, vasitəçi yoxlayan tərəflər və psevdonim.
translation_of: GUIDE-0008
source_version: "1.0.0"
---

# Yoxlayan tərəf kimi qeydiyyatdan keçmək

Bu bələdçi şəxslərin rəqəmsal cüzdanından rəqəmsal sənəd tələb edəcək saytlar və xidmətlər (mağaza, işəgötürən, qurum portalı, tədbirə giriş) üçündür.

**Nə vaxt oxunmalıdır:**
- İlk təqdimat sorğunuzu göndərməzdən əvvəl. Qeydiyyatsız yoxlayan tərəfin tələb etdiyi hər sahə şəxsə ayrıca xəbərdarlıqla "qeydiyyatdakı
  əhatədən kənar" kimi göstərilir; psevdonim sorğusu ümumiyyətlə qəbul edilmir.
- Sonra: [[GUIDE-0001]] (Tamga ilə giriş) və ya [[GUIDE-0002]] (serverdə yoxlama).
- Rəqəmsal sənəd vermək istəyirsinizsə, bunun əvəzinə [[GUIDE-0007]].

## Necə işləyir?

Sorğu gəldikdə rəqəmsal cüzdan üç şeyi [[t:trust-list|etibar siyahısından]] yoxlayır: sorğunu kim göndərir, bu yoxlayan tərəf qeydiyyatdadır
və aktivdirmi, tələb olunan sahələr qeydiyyatdakı əhatənin daxilindədirmi? Əhatədən kənar sahə tələb olunarsa, şəxsə ayrıca xəbərdarlıq göstərilir.
Qeydiyyat bu üç sualın cavabını siyahıya yazdırmaqdır.

| Nə | Dəyər | Haradan |
|---|---|---|
| Daimi identifikator | domen adınız (`dns_name`) | müraciətiniz |
| Klient identifikatoru (`client_id`) | `x509_hash:…` | giriş sertifikatınızdan hesablanır ([[ADR-0034]]) |
| Giriş sertifikatı | X.509, domen adınız və qurum identifikasiya nömrəniz ilə | qeydiyyat qurumu, sizin CSR-ınız əsasında |
| Əhatələr | hər istifadə üçün məqsəd, rəqəmsal sənəd növü, sahələr | müraciətiniz |
| Qeydiyyat sertifikatı | hər istifadə üçün bir `rc-wrp+jwt` | dərc zamanı avtomatik yaradılır ([[ADR-0026]]) |

## 1. Açar və sertifikat sorğusu

Sorğularınızı imzalayacağınız P-256 açarını özünüz yaradın; gizli açar sizdə qalır.

```sh
openssl ecparam -name prime256v1 -genkey -noout -out rp.key.pem
openssl req -new -key rp.key.pem -subj "/CN=shop.example.com/O=Example Shop Ltd./C=TR" -out rp.csr.pem
```

Qeydiyyat qurumu giriş sertifikatına domen adınızı (SAN) və qurum identifikasiya nömrənizi (`organizationIdentifier`, məsələn
`VATTR-…`) yazır. Rəqəmsal cüzdan qeydiyyat sertifikatındakı identifikasiya nömrəsinin bu nömrə ilə üst-üstə düşdüyünü yoxlayır.

## 2. Müraciət faylı

```json
{
  "dns_name": "shop.example.com",
  "legal_name": "Example Shop Ltd.",
  "trade_name": "Example Shop",
  "access_cert": "rp-example-shop",
  "info_uri": "https://shop.example.com",
  "service_description": { "en-US": "Online shop offering student discounts.", "tr-TR": "Öğrenci indirimi sunan çevrim içi mağaza." },
  "is_public_sector_body": false,
  "entitlements": ["service_provider"],
  "scopes": [
    {
      "scope_id": "student-discount-1",
      "purpose": "Student discount",
      "purpose_localized": { "tr-TR": "Öğrenci indirimi" },
      "vct": "urn:tamga:edu:StudentCredential:1",
      "claims": ["is_enrolled"],
      "privacy_policy_uri": "https://shop.example.com/privacy"
    }
  ],
  "identifiers": [{ "scheme": "TR-VKN", "value": "TR0000000000" }],
  "postal_address": { "street_address": "Example Street 1", "locality": "Istanbul", "postal_code": "34000", "country": "TR" },
  "contact": { "support_uri": "https://shop.example.com/help" },
  "supervisory_authority": { "name": "Kişisel Verileri Koruma Kurumu (KVKK)", "country": "TR", "info_uri": "https://www.kvkk.gov.tr", "form_uri": "https://www.kvkk.gov.tr" }
}
```

Tam nümunə: repozitoriyada `apps/trust-publisher/registry/examples/rp-application.example.json`.

**Məcburi sahələr** ([[ADR-0024]]): ticarət adı, rəsmi identifikasiya nömrəsi, poçt ünvanı, əlaqə (dəstək ünvanı, e-poçt və ya
telefon), xidmətin təsviri, dövlət qurumu olub-olmamağınız, səlahiyyət növü (`entitlements`), məlumatların qorunması orqanı və müraciət yolu,
hər əhatə üçün məxfilik siyasətinin ünvanı. Çatışmayan sahə varsa, qeydiyyat aparılmır; qeydiyyat qurumu bütün çatışmazlıqları bir dəfəyə bildirir.

## 3. Əhatəni dar saxlayın

Hər əhatə (`scopes[]`) bir istifadədir: bir məqsəd, bir rəqəmsal sənəd növü və həmin məqsəd üçün lazım olan minimum sahələr. Nümunədəki mağaza tələbə
olub-olmadığını (`is_enrolled`) soruşur; adı, məktəbi, nömrəni soruşmur.

- Lazım olan hər ayrı məqsəd üçün ayrıca əhatə açın; məqsədi şəxsin anlayacağı dildə yazın (`purpose_localized`).
- Bəzi növlər ümumiyyətlə göstərilmir (məsələn, psevdonim toxumu, `urn:tamga:id:PseudonymSeed:1`); bunlar əhatəyə yazıla bilməz.
- Sıfır bilik sübutu ilə yaş yoxlaması şəxsiyyət sənədinin qısamüddətli ZK nüsxəsi ilə aparılır; əhatənin növü
  `urn:tamga:id:ShortLivedIdentityAttestation:1`, sahəsi `age_over_18` və ya `age_over_15`-dir ([[ADR-0044]], [[ADR-0064]]). Yaş
  əhatəsi tək hədd istəyir; hər iki həddi istəyən əhatə yaş aralığını üzə çıxarır və ayrıca əsaslandırılır.
- Əhatə müddətli ola bilər (`valid_from`, `valid_until`); müddəti bitmiş istifadə üçün qeydiyyat sertifikatı yaradılmır.

## 4. Qeydiyyat sertifikatı

Siyahı hər dəfə dərc edildikdə, hər etibarlı əhatəniz üçün bir [[t:registration-certificate|qeydiyyat sertifikatı]] (WRPRC,
ETSI TS 119 475) yaradılır və `trust.tamga.network/wrprc/` altında dərc olunur (kataloq: `wrprc/index.json`). Məzmun yalnız
imzalanmış siyahıdakı qeydinizdən gəlir; ayrıca qeydiyyat qurumu açarı ilə imzalanır; ən çoxu 12 ay etibarlıdır.

Təqdimat sorğunuzda bu sertifikatı `verifier_info` daxilində (`registration_cert`) göndərirsiniz. Rəqəmsal cüzdan imzanı, müddəti, identifikasiya
nömrəsinin uyğunluğunu və tələb olunan sahələrin sertifikatdakı əhatəyə uyğunluğunu yoxlayır ([[ADR-0026]]).

Sertifikat istifadənin **xidmət identifikatorunu** da daşıyır (`service_id`; ARF RPRC_17a). Müraciətdə istifadəyə `"service_id"`
versəniz, o yazılır (eyni xidmətin bir neçə istifadəsini vahid ad altında birləşdirir), verməsəniz `scope_id`. Sənədi verən qurumlar bir rəqəmsal sənəd
növünü yalnız müəyyən yoxlayan tərəflərə və xidmətlərə göstərilmək üçün məhdudlaşdıra bilər ([[GUIDE-0003]], paylaşım qaydası;
[[ADR-0046]]): icazəniz yoxdursa, rəqəmsal cüzdan şəxsi xəbərdar edir və standart seçim "Paylaşma"dır.

## 5. Vasitəçi yoxlayan tərəf

Başqa saytlar adından yoxlama aparan xidmətsinizsə (hostinq edilən yoxlayan tərəf kimi), [[t:intermediary|vasitəçi]] kimi qeydiyyatdan keçirsiniz
(`served_relying_parties[]`); əsas sayt da öz qeydində sizi göstərir (`uses_intermediaries[]`). Rəqəmsal cüzdan ekranda **əsas saytın** adını
göstərir və əhatəni onun qeydinə əsasən yoxlayır ([[ADR-0017]]).

## 6. Psevdonim (könüllü)

Şəxsi kimliyini öyrənmədən tanımaq istəyirsinizsə (məsələn, təkrar gələn müştəri), sayta xas psevdonim tələb edə bilərsiniz.
Qeydinizdə `pseudonyms` sahəsi `single` (hər şəxsə bir psevdonim) və ya `multiple` (şəxs istəsə, bir neçə) olur ([[ADR-0031]]).

## 7. Qeydiyyatdan sonra

| Vəziyyət | Nə baş verir |
|---|---|
| `ACTIVE` | Sorğularınız qəbul edilir |
| `SUSPENDED` | Rəqəmsal cüzdan qeydinizi aktiv saymır; bu, şəxsə açıq şəkildə göstərilir |
| `REVOKED` / `RETIRED` | Qeydiyyat bağlanıb; rəqəmsal cüzdan qeydinizi aktiv saymır |

Əhatə əlavə etmək və ya dəyişmək yeni müraciətdir; dəyişikliklər ən geci 24 saat ərzində dərc olunur. Qeydinizi öz kodunuzla
oxuya bilərsiniz: `source.relyingPartyByDnsName("shop.example.com")` ([[GUIDE-0006]]).

**Girişlər (turniket, bilet girişi).** Keçid kartı istifadə edirsinizsə, giriş qruplarınız qeydinizin `terminal_groups[]`
sahəsində dərc olunur: qrup identifikatoru, girişləri idarə edən qurum (`institution_id`), qrupun giriş siyasətləri və istəyə
bağlı cihaz sertifikatı barmaq izləri ([[ADR-0069]]). Giriş cihazları Tamga Verify-a terminal açarı ilə özünü təqdim edir;
qurumunuzun inzibatçısı açarları Qurum Konsolunun **Giriş terminalları** ekranında yaradır (açar bir dəfə göstərilir) və ləğv
edir. Siyahı qrupu geri çəkərsə, həmin qrupun girişləri dərhal dayanır. Oxuma: `source.terminalGroup("qrup-id")`.

## Qaydalar

| Kod | Nə deyir |
|---|---|
| [[ADR-0024]] RPR1–RPR3 | Qeydiyyat məlumatları tam olmadan qeydiyyat aparılmır; hər istifadənin məxfilik siyasəti var |
| [[ADR-0026]] | Qeydiyyat sertifikatı yalnız imzalanmış siyahıdakı qeyddən yaradılır; ən çoxu 12 ay |
| [[ADR-0034]] | Klient identifikatoru giriş sertifikatından hesablanan `x509_hash`; daimi identifikator domen adıdır |
| [[ADR-0017]] | Vasitəçi yoxlayan tərəf halında əsas sayt göstərilir və onun əhatəsi yoxlanılır |

Yoxlayan tərəf qaydalarının tam mətni: [Tamga ARF — Tamga Rulebook, RB-RP](https://arf.tamga.network/az/rulebook).
