---
document_id: GUIDE-0012
title: "Sorun giderme"
status: Active
version: 1.0.0
created: 2026-10-03
last_updated: 2026-10-03
summary: >
  Sık karşılaşılan sorunlar ve çözümleri: doğrulamada "doğrulanamadı" sebepleri, reddedilen adımlar, güven listesi yükleme
  hataları, cüzdanda belge alma ve gösterme hataları, cihaz kanıtı, kayıt başvurusu ve servis hata biçimi.
---

# Sorun giderme

Bu sayfa, Tamga'ya bağlanan geliştiricilerin en sık karşılaştığı sorunları ve çözümlerini toplar.

**Ne zaman okunur:** bir doğrulama beklenmedik sonuç verdiğinde, cüzdan bir belgeyi alamadığında ya da gösteremediğinde,
kayıt başvurusu geri döndüğünde.

## Önce: sonuç ne diyor?

Doğrulama üç değerli bir sonuç döner ([[SPEC-API-0001]] §2):

| `outcome` | Anlamı | İlk bakılacak alan |
|---|---|---|
| `ACCEPTED` | Bütün adımlar geçti | — |
| `REJECTED` | Belge geçersiz | `failed_step` |
| `INDETERMINATE` | Şu an kontrol edilemedi; belge hakkında hüküm yok | `indeterminate_reason` |

`REJECTED` ile `INDETERMINATE`'i aynı mesajla göstermeyin. "Bu belge geçersiz" ile "şu an kontrol edemiyorum" farklı
kararlardır (AP2).

## "Doğrulanamadı" (`INDETERMINATE`)

| `indeterminate_reason` | Sebep | Çözüm |
|---|---|---|
| `STATUS_UNREACHABLE` | Belgenin [[t:status-list|iptal listesi]] indirilemedi | İptal listelerini önceden çekin (`PrefetchStatusCache` + düzenli `refresh`); doğrulama anında ağa çıkmayın |
| `STATUS_STALE` | Önbellekteki iptal listesi tazelik eşiğini aştı ya da çapadan önce çekildi | Yenileme aralığını kısaltın; saat farkını denetleyin (NTP) |
| `SCHEMA_UNREACHABLE` | Belge türünün tanımı alınamadı | Şema kataloğunu önceden önbelleğe alın |
| `CHAIN_UNREACHABLE` / `INDEXER_STALE` | Güven kaynağı okunamadı ya da bayat | Güven listelerini düzenli indirin; `next_update` geçmişse yeni listeyi alın |
| `SDK_VERSION_MISMATCH` | Kütüphane sürümü kural sürümüyle uyumsuz | `@tamga-network/*` paketlerini güncelleyin |

Güven listesi bayatsa ya da indirilemiyorsa güven soruları `UNKNOWN` döner ve sonuç her zaman `INDETERMINATE` olur; asla
`ACCEPTED`, asla `REJECTED`.

## Reddedildi (`REJECTED`)

`failed_step` hangi adımın geçmediğini söyler ([[SPEC-API-0001]] §1). En sık görülenler:

| Adım | Ne demek | Bakılacak yer |
|---|---|---|
| `A3` | İmza zinciri güven listesindeki bir köke bağlanmıyor | Doğru listeyi ve kök parmak izlerini yüklediniz mi? Test ortamı belgesini canlı listeyle mi doğruluyorsunuz? |
| `A3b` | Belgeyi imzalayan sertifika, `iss` alanındaki kurumla eşleşmiyor | Kurum kimliği her zaman sertifikadan türetilir; `iss` değerine güvenmeyin |
| `A3d` / `A6` | Belge sahibine bağlılık kanıtı (KB-JWT) yok ya da `aud`, `nonce`, `iat` tutmuyor | İstekte gönderdiğiniz `nonce` ile doğruladığınız aynı mı? Saatler senkron mu? |
| `A5` | Bir disclosure belgedeki özetlerle eşleşmiyor | Sunum değiştirilmiş; yeniden isteyin |
| `C1` | Kurum, belgenin verildiği anda etkin değildi | Kurumun kayıt geçmişine bakın ([[GUIDE-0006]]) |
| `C2` | Kurum bu belge türünü vermeye yetkili değildi | Kurumun belge türü yetkisi ([[GUIDE-0007]] §5) |
| `D6` | Belge iptal edilmiş ya da askıya alınmış | Belgeyi veren kuruma sorun |
| `E3` | İstediğiniz alanlar kayıtlı kapsamınızın dışında | Kapsamınızı genişletin ([[GUIDE-0008]] §3) |

## Güven listesi yüklenmiyor

| Belirti | Sebep | Çözüm |
|---|---|---|
| İmza doğrulanmıyor | Sabitlenmiş kök parmak izi listeyi imzalayan kökle eşleşmiyor | Parmak izini `tamga.network/trust-anchor`'dan yeniden alın; ortamı (test / canlı) karıştırmayın |
| "Bilinmeyen biçim sürümü" | Liste daha yeni bir biçimde | Okuyucu bilerek durur; kütüphaneyi güncelleyin |
| Sürüm geri gitti | Eski bir kopya sunuluyor (önbellek, CDN) | Okuyucu geri sarmayı reddeder; önbelleği temizleyin |
| Dış liste kayıtları görünmüyor | Liste bayat, imzacısı LOTL'dakiyle eşleşmiyor ya da kayıt kapsam dışında | Dış listeye bağlı sorular `UNKNOWN` döner; diğer listeler etkilenmez ([[GUIDE-0011]]) |

## Cüzdan: belge alma

| Hata (`WalletError`) | Sebep | Çözüm |
|---|---|---|
| `tx_code_mismatch` | PIN yanlış | PIN teklifle aynı kanaldan gelmez; kişiden SMS ya da e-postadaki PIN'i isteyin |
| `offer_expired` / `offer_used` | Teklifin süresi doldu ya da kullanıldı | Kurumdan yeni teklif isteyin |
| `offer_not_found` / `invalid_offer` | QR bozuk ya da Tamga teklifi değil | Teklifi yeniden okutun |
| `trust_error` | Kurum ya da cüzdan sağlayıcısı listede bulunamadı, imza doğrulanmadı | Güven listesini tazeleyin; kurumun kaydını denetleyin |
| `unsupported` | Bu cüzdanda desteklenmeyen tür ya da iptal edilmiş birim ("This wallet has been revoked.") | Birim iptal edildiyse yeniden kaydolun |
| `network` | Bağlantı yok | Yeniden deneyin |

## Cüzdan: cihaz kanıtı ve WUA

- **`device_attestation_failed`:** cüzdan sağlayıcısı cihaz kanıtını doğrulayamadı. Çekirdek kanıtsız yeniden dener ve birim yazılım
  seviyesinde kaydolur. Sebep çoğunlukla geliştirme derlemesi, emülatör ya da uygulama kimliğinin (Bundle ID, paket adı)
  sağlayıcının beklediğinden farklı olmasıdır.
- **Yazılım seviyesinde kayıt:** Expo Go'da ya da yerel anahtar modülü olmadan çalışıyorsunuz. Geliştirme derlemesi kullanın
  ([[GUIDE-0005]] §1).
- **WUA süresi doldu:** belge almadan önce `wuaExpiringSoon` ile denetleyip yenileyin.

## Cüzdan: gösterme

| Belirti | Sebep | Çözüm |
|---|---|---|
| Ekranda "kayıtlı kapsamın dışında" uyarısı | Doğrulayıcı kayıtlı değil ya da kapsamı dışında alan istiyor | Doğrulayıcı kaydını ve kapsamını düzeltin ([[GUIDE-0008]]) |
| Kayıt sertifikası eşleşmiyor | Kayıt sertifikasındaki kurum kimlik numarası erişim sertifikasındakiyle aynı değil | İkisi de aynı resmî kimlik numarasından üretilmelidir ([[ADR-0026]]) |
| Kopyalar tükendi | Doğrulayıcıya özel kopya kalmadı | Kişiye sorun; kurumdan yenileme alınır ([[ADR-0023]]) |
| Takma ad isteği reddedildi | Doğrulayıcı kayıtlı değil ya da kaydında `pseudonyms` yok | Kayda takma ad ayarını ekleyin ([[ADR-0031]]) |

## Kayıt başvurusu geri döndü

Kayıt aracı eksik ya da hatalı alanların **tamamını** tek seferde listeler (`kayıt yapılamadı:` ve altında maddeler). Sık görülenler:
`identifiers`, `postal_address`, `contact`, `supervisory_authority` (başvuru yolu: form adresi, e-posta ya da telefon),
`scopes[…].privacy_policy_uri`. Biçim: [[GUIDE-0007]] §2 ve [[GUIDE-0008]] §2.

## Servis hata biçimi

Tamga servisleri hataları RFC 9457 biçiminde döner; `tamga_code` makinenin okuyacağı koddur ve `detail` kişisel veri içermez:

```json
{
  "type": "https://docs.tamga.network/errors/schema-not-authorized",
  "title": "Belge veren bu şemayla belge veremez",
  "status": 403,
  "tamga_code": "SCHEMA_NOT_AUTHORIZED"
}
```

- **Reddedilen belge bir hata değildir:** doğrulama çağrısı başarılıdır (200) ve sonucu gövdede taşır (AP5).
- **`409`:** aynı `Idempotency-Key` farklı gövdeyle gönderildi.
- **`429`:** hız sınırı; `Retry-After` kadar bekleyin.

## Hâlâ çözülmediyse

Hata kaydınızdan kişisel veriyi çıkarın ve `verification_id`, `failed_step` ya da `indeterminate_reason`, kütüphane sürümü
(`sdk_version`) ile birlikte bildirin. Uyum testlerini koşmak çoğu uyumsuzluğu gösterir: [[GUIDE-0009]].
