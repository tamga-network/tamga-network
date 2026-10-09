---
document_id: GUIDE-0008
title: "Doğrulayıcı olarak kayıt olmak"
status: Active
version: 1.0.0
created: 2026-10-03
last_updated: 2026-10-03
summary: >
  Bir sitenin ya da hizmetin doğrulayıcı olarak Tamga güven listesine kaydı: alan adı ve erişim sertifikası, AB ortak kayıt
  verileri, kullanım kapsamları (amaç, alanlar, gizlilik politikası), kayıt sertifikası, aracı doğrulayıcılar ve takma ad.
---

# Doğrulayıcı olarak kayıt olmak

Bu rehber, kişilerin cüzdanından belge isteyecek siteler ve hizmetler (mağaza, işveren, kurum portalı, etkinlik girişi) içindir.

**Ne zaman okunur:**
- İlk sunum isteğinizi göndermeden önce. Kayıtsız bir doğrulayıcının istediği her alan, kişiye ayrı bir uyarıyla "kayıtlı
  kapsamın dışında" diye gösterilir; takma ad isteği hiç kabul edilmez.
- Sonra: [[GUIDE-0001]] (Tamga ile giriş) ya da [[GUIDE-0002]] (sunucuda doğrulama).
- Belge vermek istiyorsanız bunun yerine [[GUIDE-0007]].

## Nasıl çalışır?

Cüzdan, bir istek geldiğinde üç şeyi [[t:trust-list|güven listesinden]] denetler: isteği kim gönderiyor, bu doğrulayıcı kayıtlı
ve etkin mi, istenen alanlar kayıtlı kapsamın içinde mi? Kapsam dışı bir alan istenirse kişiye ayrı bir uyarı gösterilir.
Kayıt, bu üç sorunun cevabını listeye yazdırmaktır.

| Ne | Değer | Nereden |
|---|---|---|
| Kalıcı kimlik | alan adınız (`dns_name`) | başvurunuz |
| İstemci kimliği (`client_id`) | `x509_hash:…` | erişim sertifikanızdan hesaplanır ([[ADR-0034]]) |
| Erişim sertifikası | X.509, alan adınız ve kurum kimlik numaranızla | kayıt kurumu, sizin CSR'ınızdan |
| Kapsamlar | her kullanım için amaç, belge türü, alanlar | başvurunuz |
| Kayıt sertifikası | her kullanım için bir `rc-wrp+jwt` | yayında otomatik üretilir ([[ADR-0026]]) |

## 1. Anahtar ve sertifika isteği

İsteklerinizi imzalayacağınız P-256 anahtarını kendiniz üretin; özel anahtar sizde kalır.

```sh
openssl ecparam -name prime256v1 -genkey -noout -out rp.key.pem
openssl req -new -key rp.key.pem -subj "/CN=shop.example.com/O=Example Shop Ltd./C=TR" -out rp.csr.pem
```

Kayıt kurumu erişim sertifikasına alan adınızı (SAN) ve kurum kimlik numaranızı (`organizationIdentifier`, örneğin
`VATTR-…`) yazar. Cüzdan, kayıt sertifikasındaki kimlik numarasının bu numarayla eşleştiğini denetler.

## 2. Başvuru dosyası

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

Tam örnek: depoda `apps/trust-publisher/registry/examples/rp-application.example.json`.

**Zorunlu alanlar** ([[ADR-0024]]): ticari ad, resmî kimlik numarası, posta adresi, iletişim (destek adresi, e-posta ya da
telefon), hizmet açıklaması, kamu kurumu olup olmadığınız, yetki türü (`entitlements`), veri koruma kurumu ve başvuru yolu,
her kapsam için gizlilik politikası adresi. Eksik alan varsa kayıt yapılmaz; kayıt kurumu eksiklerin tamamını tek seferde bildirir.

## 3. Kapsamı dar tutun

Her kapsam (`scopes[]`) bir kullanımdır: bir amaç, bir belge türü ve o amaç için gereken en az alan. Örnekteki mağaza öğrenci
olup olmadığını (`is_enrolled`) sorar; adı, okulu, numarayı sormaz.

- Gereken her ayrı amaç için ayrı kapsam açın; amacı kişinin anlayacağı dilde yazın (`purpose_localized`).
- Bazı türler hiç gösterilmez (örneğin takma ad tohumu, `urn:tamga:id:PseudonymSeed:1`); bunlar kapsama yazılamaz.
- Sıfır bilgi ispatıyla yaş doğrulaması kimlik belgesinin kısa ömürlü ZK kopyasıyla yapılır; kapsamın türü
  `urn:tamga:id:ShortLivedIdentityAttestation:1`, alanı `age_over_18`'dir ([[ADR-0044]]).
- Kapsam süreli olabilir (`valid_from`, `valid_until`); süresi biten kullanım için kayıt sertifikası üretilmez.

## 4. Kayıt sertifikası

Liste her yayınlandığında, her geçerli kapsamınız için bir [[t:registration-certificate|kayıt sertifikası]] (WRPRC,
ETSI TS 119 475) üretilir ve `trust.tamga.network/wrprc/` altında yayınlanır (dizin: `wrprc/index.json`). İçerik yalnız
imzalı listedeki kaydınızdan gelir; ayrı bir kayıt kurumu anahtarıyla imzalanır; en çok 12 ay geçerlidir.

Sunum isteğinizde bu sertifikayı `verifier_info` içinde (`registration_cert`) gönderirsiniz. Cüzdan imzayı, süreyi, kimlik
numarası eşleşmesini ve istenen alanların sertifikadaki kapsamla uyumunu denetler ([[ADR-0026]]).

## 5. Aracı doğrulayıcı

Başka siteler adına doğrulama yapan bir hizmetseniz (barındırılan doğrulayıcı gibi) [[t:intermediary|aracı]] olarak kaydolursunuz
(`served_relying_parties[]`); asıl site de kaydında sizi gösterir (`uses_intermediaries[]`). Cüzdan ekranda **asıl sitenin** adını
gösterir ve kapsamı onun kaydına göre denetler ([[ADR-0017]]).

## 6. Takma ad (isteğe bağlı)

Kişiyi kimliğini öğrenmeden tanımak istiyorsanız (örneğin tekrar gelen müşteri) siteye özel takma ad isteyebilirsiniz.
Kaydınızda `pseudonyms` alanı `single` (kişi başına bir takma ad) ya da `multiple` (kişi isterse birden çok) olur ([[ADR-0031]]).

## 7. Kayıttan sonra

| Durum | Ne olur |
|---|---|
| `ACTIVE` | İstekleriniz kabul edilir |
| `SUSPENDED` | Cüzdan kaydınızı etkin saymaz; kişiye bu açıkça gösterilir |
| `REVOKED` / `RETIRED` | Kayıt kapandı; cüzdan kaydınızı etkin saymaz |

Kapsam eklemek ya da değiştirmek yeni bir başvurudur; değişiklikler en geç 24 saatte yayındadır. Kaydınızı kendi kodunuzla
okuyabilirsiniz: `source.relyingPartyByDnsName("shop.example.com")` ([[GUIDE-0006]]).

## Kurallar

| Kod | Ne der |
|---|---|
| [[ADR-0024]] RPR1–RPR3 | Kayıt verisi eksiksiz olmadan kayıt yapılmaz; her kullanımın gizlilik politikası vardır |
| [[ADR-0026]] | Kayıt sertifikası yalnız imzalı listedeki kayıttan üretilir; en çok 12 ay |
| [[ADR-0034]] | İstemci kimliği erişim sertifikasından hesaplanan `x509_hash`; kalıcı kimlik alan adı |
| [[ADR-0017]] | Aracı doğrulayıcıda asıl site gösterilir ve kapsamı denetlenir |

Doğrulayıcı kurallarının tamamı: [Tamga ARF — Tamga Rulebook, RB-RP](https://arf.tamga.network/tr/rulebook).
