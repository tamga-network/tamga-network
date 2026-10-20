---
title: API arayış kitabçası
description: "Tamga Network-un açıq HTTP interfeysləri — Tamga Verify, sənəd vermə xidməti, etibar siyahıları, status siyahıları və sxem kataloqu."
outline: [2, 3]
pageClass: api-page
---

# API arayış kitabçası

<p class="api-lede">Tamga Network-un HTTP üzərindən təqdim etdiyi hər şey: öz giriş məlumatlarınızla çağırdığınız xidmətlər və
hər kəsin endirə bildiyi açıq reyestrlər.</p>

Əksər inteqrasiyalar bu uc nöqtələrini əl ilə çağırmır: `@tamga-network/*` [paketləri](/packages/) onları əhatə edir, imzaları yoxlayır və
qaydaları Sizin əvəzinizə tətbiq edir. Bu arayış kitabçasından xətt üzərində dəqiq nəyin ötürüldüyünü görmək, başqa dildə klient yazmaq və ya
xətaları aradan qaldırmaq üçün istifadə edin.

## Xidmətlər

<div class="tg-cards">

<a class="tg-card" href="/api/verify">
<strong>Tamga Verify API</strong>
<span>Veb saytınızdan və ya xidmətinizdən şəxsdən rəqəmsal sənəd istəyin, yoxlanılmış nəticəni alın. Yerləşdirilmiş yoxlayan tərəf xidməti.</span>
</a>

<a class="tg-card" href="/api/issuer">
<strong>Sənəd vermə API-si</strong>
<span>Qurumlar üçün: reyestrlərinizdəki şəxslərə rəqəmsal sənəd təklif edin, bilet satın, sənədi ləğv edin və ya dayandırın.</span>
</a>

<a class="tg-card" href="/api/institution-source">
<strong>Qurum sorğu uc nöqtəsi</strong>
<span>Yerləşdirilmiş xidmətin sənəd məlumatlarını vermə anında oxuya bilməsi üçün <em>Sizin</em> tətbiq etdiyiniz uc nöqtə.</span>
</a>

</div>

## Açıq reyestrlər

<div class="tg-cards">

<a class="tg-card" href="/api/trust-lists">
<strong>Etibar siyahıları</strong>
<span>Kimin rəqəmsal sənəd verə biləcəyinin və kimin istəyə biləcəyinin imzalı siyahıları; kök barmaq izləri, lövbər jurnalı, arxiv.</span>
</a>

<a class="tg-card" href="/api/status-lists">
<strong>Status siyahıları</strong>
<span>Hər rəqəmsal sənədin ləğv statusu — hər siyahı üçün imzalı bir bit massivi, fərdi məlumatlar yoxdur.</span>
</a>

<a class="tg-card" href="/api/schema-catalogue">
<strong>Sxem kataloqu</strong>
<span>Rəqəmsal sənəd növləri: hər <code>vct</code> üçün növ metadatası və JSON Schema.</span>
</a>

</div>

## Bir baxışda

| API | Əsas ünvan | Autentifikasiya | Kim çağırır |
|---|---|---|---|
| [Tamga Verify](/api/verify) | `https://verify.tamga.network` | giriş sertifikatınızla imzalanmış RP bəyanatı | serveriniz (və status nişanı ilə səhifəniz) |
| [Sənəd vermə](/api/issuer) | `https://issuer.tamga.network/{slug}/api/v1` | əhatə dairəli API açarı `tmg_<slug>_…` | qurumun serveri |
| [Qurum sorğu uc nöqtəsi](/api/institution-source) | Sizin ünvanınız | yerləşdirilmiş xidmətin imzalı sorğusu (Siz yoxlayırsınız) | yerləşdirilmiş sənəd vermə xidməti |
| [Etibar siyahıları](/api/trust-lists) | `https://trust.tamga.network` | yoxdur — açıq, imzalı fayllar | hər kəs, `TrustSource` ilə |
| [Status siyahıları](/api/status-lists) | `https://status.tamga.network` | yoxdur — açıq, imzalı tokenlər | yoxlayan tərəflər |
| [Sxem kataloqu](/api/schema-catalogue) | `https://schemas.tamga.network/v1` | yoxdur — açıq | sənədi verən qurumlar, yoxlayan tərəflər, rəqəmsal cüzdanlar |

## Mühitlər

Hər xidmətin eyni qaydalarla ayrıca test şəbəkəsində işləyən sandbox ekvivalenti var ([[GUIDE-0013]]). Sandbox siyahıları
`environment: sandbox` daşıyır; real şəbəkəyə görə konfiqurasiya edilmiş yükləyici onlarda dayanır, əksi də doğrudur.

| Real şəbəkə | Sandbox |
|---|---|
| `verify.tamga.network` | `verify.sandbox.tamga.network` |
| `issuer.tamga.network` | `issuer.sandbox.tamga.network` |
| `trust.tamga.network` | `trust.sandbox.tamga.network` |
| `status.tamga.network` | `status.sandbox.tamga.network` |
| `id.tamga.network` | `id.sandbox.tamga.network` |
| `schemas.tamga.network` | ortaq |

## Ümumi qaydalar

- **HTTPS üzərindən JSON.** Səhifədə başqa cür göstərilməyibsə, sorğu və cavablar UTF-8 JSON-dur (imzalı fayllar kompakt
  JWS-dir: `application/jose`, `application/statuslist+jwt`). Vaxtlar UTC-də ISO 8601 formatındadır, sahə belə tələb edirsə Unix saniyəsidir.
- **Yoxlayan tərəf üçün paylaşılan gizli açar yoxdur.** Tamga Verify serverinizi qeydiyyatdan keçmiş giriş sertifikatınızın açarı ilə
  imzalanmış 60 saniyəlik bəyanatla tanıyır; bizim tərəfimizdə sıza biləcək və ya rotasiya edilməli heç nə yoxdur ([[ADR-0017]]).
- **Xətalar.** Tamga Verify `{ "error", "error_description" }` (OAuth formatı) qaytarır; sənəd vermə xidməti RFC 9457 problem
  təfərrüatı (`title`, `status`) qaytarır. Mövcud olmayan və ya başqasına məxsus resurs həmişə `404` olur — mövcudluğu açıqlanmır.
- **Sürət limitləri.** Limit aşıldıqda `Retry-After` (saniyə) ilə `429` qaytarılır. Klient ünvanları saxlanılmır və jurnala yazılmır.
- **Üç nəticə.** Yoxlama `ACCEPTED`, `REJECTED` və ya `INDETERMINATE` olur. "Hazırda yoxlamaq mümkün olmadı" heç vaxt "etibarsız" demək
  deyil.
- **Jurnalda fərdi məlumatlar yoxdur.** Rəqəmsal sənəd dəyərlərini, status indeksini və şəxsiyyət uyğunlaşdırma açarlarını öz tərəfinizdə də
  heç vaxt jurnala yazmayın ([[SPEC-API-0001]] AP3–AP4).
- **Reyestrlər keşlənə bilər.** Etibar siyahıları, status siyahıları və kataloq statikdir; CORS `*` və qısa keş müddəti ilə
  təqdim olunur. Həmişə nəqliyyat qatına deyil, imzaya etibar edin.

## Standart protokol uc nöqtələri

Rəqəmsal cüzdanlar xidmətlərlə standart EUDI protokolları vasitəsilə əlaqə qurur — sənəd vermək üçün [[t:OpenID4VCI]], təqdim etmək üçün
[[t:OpenID4VP]]. Bu uc nöqtələrini Siz çağırmırsınız (rəqəmsal cüzdan və paketlər çağırır); cüzdan tərtibatçısı nə gözləməli olduğunu bilsin deyə
burada sadalanır. Məcburi profillər: [[SPEC-PROTO-0001]] və [[SPEC-PROTO-0002]].

### Sənəd vermə xidməti — `https://issuer.tamga.network`

| Uc nöqtə | Məqsəd |
|---|---|
| <span class="api-method get">GET</span> `/.well-known/openid-credential-issuer/{slug}` | Credential Issuer Metadata; `Accept: application/jwt` ilə imzalı |
| <span class="api-method get">GET</span> `/.well-known/oauth-authorization-server/{slug}` | Avtorizasiya serverinin metadatası |
| <span class="api-method get">GET</span> `/{slug}/offers/{id}` | Rəqəmsal sənəd təklifi (`credential_offer_uri` hədəfi; fərdi məlumatlar yoxdur) |
| <span class="api-method post">POST</span> `/{slug}/par` · <span class="api-method get">GET</span> `/{slug}/authorize` | Push edilmiş avtorizasiya sorğusu və avtorizasiya — şəxsiyyətə bağlı təkliflər və rəqəmsal cüzdandan başladılan sorğular |
| <span class="api-method post">POST</span> `/{slug}/token` | Token (əvvəlcədən avtorizasiya edilmiş kod, avtorizasiya kodu, yeniləmə tokeni); [[t:DPoP]] ilə bağlı |
| <span class="api-method post">POST</span> `/{slug}/nonce` | Açar sübutları üçün yeni `c_nonce` |
| <span class="api-method post">POST</span> `/{slug}/credential` | Rəqəmsal sənədin verilməsi (DPoP, açar sübutu, rəqəmsal cüzdan sübutu) |
| <span class="api-method get">GET</span> `https://status.tamga.network/{list_id}` | Qurumun [status siyahıları](/api/status-lists) |

### Şəxsiyyət xidməti — `https://id.tamga.network`

Müvəqqəti şəxsiyyət sənədi provayderi ([[ADR-0022]]). Eyni OpenID4VCI uc nöqtələri, `{slug}` hissəsi olmadan:
`/.well-known/openid-credential-issuer`, `/.well-known/oauth-authorization-server`, `/par`, `/authorize`, `/token`,
`/nonce`, `/credential`; status siyahıları `/status/{list_id}` altındadır. Şəxsiyyətin təsdiqi yalnız bu xidmətin daxilində aparılır.

### Tamga Verify — `https://verify.tamga.network`

| Uc nöqtə | Məqsəd |
|---|---|
| <span class="api-method get">GET</span> `/vp/req/{id}` | İmzalı sorğu obyekti (`application/oauth-authz-req+jwt`) — QR koddakı `request_uri` |
| <span class="api-method post">POST</span> `/vp/response` | Rəqəmsal cüzdanın şifrələnmiş cavabı (`direct_post.jwt`); sürət limitlidir |
| <span class="api-method get">GET</span> `/p/{id}` | Şəxslər üçün yerləşdirilmiş gözləmə / nəticə səhifəsi (HTML) |

## Maşın tərəfindən oxuna bilən spesifikasiyalar

Hər arayış səhifəsi OpenAPI 3.1 faylından yaradılır. Faylı istənilən OpenAPI alətinə idxal edərək klient
yarada və ya test sorğusu göndərə bilərsiniz:

| Spesifikasiya | Fayl |
|---|---|
| Tamga Verify API | [`hosted-verifier-api.openapi.yaml`](/api/hosted-verifier-api.openapi.yaml) |
| Sənəd vermə API-si | [`tamga-issuer-api.openapi.yaml`](/api/tamga-issuer-api.openapi.yaml) |
| Qurum sorğu uc nöqtəsi | [`institution-source.openapi.yaml`](/api/institution-source.openapi.yaml) |
| Etibar siyahıları | [`trust-lists.openapi.yaml`](/api/trust-lists.openapi.yaml) |
| Status siyahıları | [`status-lists.openapi.yaml`](/api/status-lists.openapi.yaml) |
| Sxem kataloqu | [`schema-catalogue.openapi.yaml`](/api/schema-catalogue.openapi.yaml) |
