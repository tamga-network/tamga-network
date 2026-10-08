---
title: API başvurusu
description: Tamga Network'ün herkese açık HTTP arayüzleri — Tamga Verify, belge verme servisi, güven listeleri, durum listeleri ve şema kataloğu.
outline: [2, 3]
pageClass: api-page
---

# API başvurusu

<p class="api-lede">Tamga Network'ün HTTP üzerinden sunduğu her şey: kendi kimlik bilgilerinizle çağırdığınız hizmetler ve
herkesin indirebildiği herkese açık kayıtlar.</p>

Çoğu entegrasyon bu uçları elle çağırmaz: `@tamga-network/*` [paketleri](/packages/) onları sarar, imzaları denetler ve
kuralları sizin yerinize uygular. Bu başvuruyu, kabloda tam olarak ne gittiğini görmek, başka bir dilde istemci yazmak ya da
hata ayıklamak için kullanın.

## Hizmetler

<div class="tg-cards">

<a class="tg-card" href="/api/verify">
<strong>Tamga Verify API</strong>
<span>Web sitenizden ya da servisinizden kişiden belge isteyin, doğrulanmış sonucu alın. Barındırılan doğrulayıcı.</span>
</a>

<a class="tg-card" href="/api/issuer">
<strong>Belge verme API'si</strong>
<span>Kurumlar için: kayıtlarınızdaki kişilere belge teklif edin, bilet satın, belgeyi iptal edin ya da askıya alın.</span>
</a>

<a class="tg-card" href="/api/institution-source">
<strong>Kurum sorgu ucu</strong>
<span>Barındırılan servisin belge verisini verme anında okuyabilmesi için <em>sizin</em> uyguladığınız uç.</span>
</a>

</div>

## Herkese açık kayıtlar

<div class="tg-cards">

<a class="tg-card" href="/api/trust-lists">
<strong>Güven listeleri</strong>
<span>Kimin belge verebileceğinin ve kimin isteyebileceğinin imzalı listeleri; kök parmak izleri, çapa günlüğü, arşiv.</span>
</a>

<a class="tg-card" href="/api/status-lists">
<strong>Durum listeleri</strong>
<span>Her belgenin iptal durumu — liste başına imzalı bir bit dizisi, kişisel veri yok.</span>
</a>

<a class="tg-card" href="/api/schema-catalogue">
<strong>Şema kataloğu</strong>
<span>Belge türleri: her <code>vct</code> için tür metadatası ve JSON Schema.</span>
</a>

</div>

## Bir bakışta

| API | Temel adres | Kimlik doğrulama | Kim çağırır |
|---|---|---|---|
| [Tamga Verify](/api/verify) | `https://verify.tamga.network` | erişim sertifikanızla imzalanmış RP beyanı | sunucunuz (ve durum jetonuyla sayfanız) |
| [Belge verme](/api/issuer) | `https://issuer.tamga.network/{slug}/api/v1` | kapsamlı API anahtarı `tmg_<slug>_…` | kurumun sunucusu |
| [Kurum sorgu ucu](/api/institution-source) | sizin adresiniz | barındırılan servisin imzalı isteği (siz doğrularsınız) | barındırılan belge verme servisi |
| [Güven listeleri](/api/trust-lists) | `https://trust.tamga.network` | yok — herkese açık, imzalı dosyalar | herkes, `TrustSource` ile |
| [Durum listeleri](/api/status-lists) | `https://status.tamga.network` | yok — herkese açık, imzalı belirteçler | doğrulayıcılar |
| [Şema kataloğu](/api/schema-catalogue) | `https://schemas.tamga.network/v1` | yok — herkese açık | belge verenler, doğrulayıcılar, cüzdanlar |

## Ortamlar

Her hizmetin aynı kurallarla ayrı bir deneme ağında çalışan bir sandbox eşi vardır ([[GUIDE-0013]]). Sandbox listeleri
`environment: sandbox` taşır; gerçek ağa göre yapılandırılmış yükleyici bunlarda durur, tersi de geçerlidir.

| Gerçek ağ | Sandbox |
|---|---|
| `verify.tamga.network` | `verify.sandbox.tamga.network` |
| `issuer.tamga.network` | `issuer.sandbox.tamga.network` |
| `trust.tamga.network` | `trust.sandbox.tamga.network` |
| `status.tamga.network` | `status.sandbox.tamga.network` |
| `id.tamga.network` | `id.sandbox.tamga.network` |
| `schemas.tamga.network` | ortak |

## Ortak kurallar

- **HTTPS üzerinden JSON.** Sayfada başka türlüsü yazmıyorsa istek ve yanıtlar UTF-8 JSON'dur (imzalı dosyalar kompakt
  JWS'dir: `application/jose`, `application/statuslist+jwt`). Zamanlar UTC'de ISO 8601, alan öyle diyorsa Unix saniyesidir.
- **Doğrulayıcı için paylaşılan gizli anahtar yok.** Tamga Verify sunucunuzu, kayıtlı erişim sertifikanızın anahtarıyla
  imzalanmış 60 saniyelik bir beyanla tanır; bizim tarafımızda sızacak ya da döndürülecek bir şey yoktur ([[ADR-0017]]).
- **Hatalar.** Tamga Verify `{ "error", "error_description" }` (OAuth biçimi) döndürür; belge verme servisi RFC 9457 problem
  ayrıntısı (`title`, `status`) döndürür. Olmayan ya da başkasına ait kaynak her zaman `404`'tür — varlığı açığa vurulmaz.
- **Hız sınırları.** Sınır aşılınca `Retry-After` (saniye) ile `429` gelir. İstemci adresleri saklanmaz ve günlüğe yazılmaz.
- **Üç sonuç.** Doğrulama `ACCEPTED`, `REJECTED` ya da `INDETERMINATE` olur. "Şu an denetlenemedi" asla "geçersiz" demek
  değildir.
- **Günlükte kişisel veri yok.** Belge değerlerini, durum indeksini ve kimlik eşleştirme anahtarlarını kendi tarafınızda da
  asla günlüğe yazmayın ([[SPEC-API-0001]] AP3–AP4).
- **Kayıtlar önbelleğe alınabilir.** Güven listeleri, durum listeleri ve katalog statiktir; CORS `*` ve kısa önbellekle
  sunulur. Taşıma katmanına değil, her zaman imzaya güvenin.

## Standart protokol uçları

Cüzdanlar hizmetlerle standart EUDI protokolleriyle konuşur — belge verme için [[t:OpenID4VCI]], gösterme için
[[t:OpenID4VP]]. Bu uçları siz çağırmazsınız (cüzdan ve paketler çağırır); cüzdan geliştiricisi ne bekleyeceğini bilsin diye
burada listelenir. Bağlayıcı profiller [[SPEC-PROTO-0001]] ve [[SPEC-PROTO-0002]].

### Belge verme servisi — `https://issuer.tamga.network`

| Uç nokta | Amaç |
|---|---|
| <span class="api-method get">GET</span> `/.well-known/openid-credential-issuer/{slug}` | Credential Issuer Metadata; `Accept: application/jwt` ile imzalı |
| <span class="api-method get">GET</span> `/.well-known/oauth-authorization-server/{slug}` | Yetkilendirme sunucusu metadatası |
| <span class="api-method get">GET</span> `/{slug}/offers/{id}` | Belge teklifi (`credential_offer_uri` hedefi; kişisel veri yok) |
| <span class="api-method post">POST</span> `/{slug}/par` · <span class="api-method get">GET</span> `/{slug}/authorize` | İtilmiş yetkilendirme isteği ve yetkilendirme — kimliğe bağlı teklifler ve cüzdandan başlatılan istekler |
| <span class="api-method post">POST</span> `/{slug}/token` | Belirteç (ön yetkili kod, yetkilendirme kodu, yenileme belirteci); [[t:DPoP]]'a bağlı |
| <span class="api-method post">POST</span> `/{slug}/nonce` | Anahtar kanıtları için yeni `c_nonce` |
| <span class="api-method post">POST</span> `/{slug}/credential` | Belge verme (DPoP, anahtar kanıtı, cüzdan kanıtı) |
| <span class="api-method get">GET</span> `https://status.tamga.network/{list_id}` | Kurumun [durum listeleri](/api/status-lists) |

### Kimlik servisi — `https://id.tamga.network`

Geçici kimlik belgesi sağlayıcısı ([[ADR-0022]]). Aynı OpenID4VCI uçları, `{slug}` parçası olmadan:
`/.well-known/openid-credential-issuer`, `/.well-known/oauth-authorization-server`, `/par`, `/authorize`, `/token`,
`/nonce`, `/credential`; durum listeleri `/status/{list_id}` altında. Kimlik ispatı yalnızca bu servisin içinde yapılır.

### Tamga Verify — `https://verify.tamga.network`

| Uç nokta | Amaç |
|---|---|
| <span class="api-method get">GET</span> `/vp/req/{id}` | İmzalı istek nesnesi (`application/oauth-authz-req+jwt`) — QR koddaki `request_uri` |
| <span class="api-method post">POST</span> `/vp/response` | Cüzdanın şifreli yanıtı (`direct_post.jwt`); hız sınırlı |
| <span class="api-method get">GET</span> `/p/{id}` | Kişiler için barındırılan bekleme / sonuç sayfası (HTML) |

## Makine okur tanımlar

Her başvuru sayfası bir OpenAPI 3.1 dosyasından üretilir. Dosyayı herhangi bir OpenAPI aracına aktararak istemci
üretebilir ya da deneme isteği gönderebilirsiniz:

| Tanım | Dosya |
|---|---|
| Tamga Verify API | [`hosted-verifier-api.openapi.yaml`](/api/hosted-verifier-api.openapi.yaml) |
| Belge verme API'si | [`tamga-issuer-api.openapi.yaml`](/api/tamga-issuer-api.openapi.yaml) |
| Kurum sorgu ucu | [`institution-source.openapi.yaml`](/api/institution-source.openapi.yaml) |
| Güven listeleri | [`trust-lists.openapi.yaml`](/api/trust-lists.openapi.yaml) |
| Durum listeleri | [`status-lists.openapi.yaml`](/api/status-lists.openapi.yaml) |
| Şema kataloğu | [`schema-catalogue.openapi.yaml`](/api/schema-catalogue.openapi.yaml) |
