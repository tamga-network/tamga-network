---
layout: home
title: Tamga Geliştirici Belgeleri
hero:
  name: Tamga Docs
  text: Doğrulanabilir belgeleri ürününüze ekleyin
  tagline: Diploma, öğrenci belgesi, kimlik ve bileti saniyeler içinde doğrulayın ya da kişilerin cüzdanına verin. AB'nin dijital kimlik standartlarıyla (OpenID4VC, SD-JWT VC, ISO mdoc), açık kaynak paketlerle.
  actions:
    - theme: brand
      text: Başlarken
      link: /tr/guides/
    - theme: alt
      text: Kavramlar
      link: /tr/concepts/
    - theme: alt
      text: API başvurusu
      link: /tr/api/
features:
  - icon: ✓
    title: Belge doğrulayın
    details: Web sitenize "Tamga ile giriş yap" ekleyin ya da sunucunuzda diploma, kimlik, yaş ve bilet doğrulayın.
    link: /tr/guides/sign-in-with-tamga
    linkText: Doğrulama rehberi
  - icon: ⬇
    title: Belge verin
    details: Kurumunuzun belgelerini kişilerin cüzdanına verin — barındırılan servisle ya da kendi sunucunuzla.
    link: /tr/guides/issue-credentials
    linkText: Belge verme rehberi
  - icon: ▣
    title: Cüzdan geliştirin
    details: Tamga uyumlu bir cüzdan yapın; belgeleri alın, saklayın, selective disclosure ile gösterin.
    link: /tr/guides/build-a-wallet
    linkText: Cüzdan rehberi
  - icon: ⛓
    title: Güven listelerini okuyun
    details: İmzalı güven listelerini kök anahtarınıza sabitleyin; ileride ülke listeleri ve ortak defter.
    link: /tr/guides/read-trust-lists
    linkText: Güven listesi rehberi
---

<div class="tg-home">

## Beş dakikada doğrulama

Bir diplomayı kendi sunucunuzda doğrulamak için iki paket yeter: [[t:trust-list|güven listesi]] okuyucu ve
[[t:verifier|doğrulayıcı]] hattı.

```sh
npm install @tamga-network/verifier @tamga-network/trust
```

```ts
import { fetchListTrustSource, verifyJws } from "@tamga-network/trust";
import { createPresentationRequest, dcqlFromPolicy } from "@tamga-network/verifier";

// 1. Güven listelerini yükle (kök parmak izi: tamga.network/trust-anchor)
const { source: trust } = await fetchListTrustSource("https://trust.tamga.network", http, {
  rootFingerprints: [ROOT_FINGERPRINT],
  verifyJws,
});

// 2. İmzalı istek oluştur → QR olarak göster
const req = await createPresentationRequest({ signer, dcql: dcqlFromPolicy(DIPLOMA_POLICY), responseUri, requestUriBase });
show(req.qrPayload);
```

Tam, testli örnek: [Kod örnekleri](/guides/code-examples). Barındırılan doğrulayıcı Tamga Verify'ı kullanırsanız
sunucu kodu gerekmez: [Web sitesine "Tamga ile giriş yap"](/guides/sign-in-with-tamga).

## Göz atın

<div class="tg-cards">

<a class="tg-card" href="/concepts/">
<strong>Kavramlar</strong>
<span>Güven listeleri, belge biçimleri, verme ve gösterme, gizlilik, iptal — kısa ve sade.</span>
</a>

<a class="tg-card" href="/packages/">
<strong>SDK'lar</strong>
<span>Dokuz <code>@tamga-network/*</code> paketi; Node ve React Native. npm'de 0.2.0 deneme sürümü; kararlı 1.0.0 hazır olunca.</span>
</a>

<a class="tg-card" href="/api/">
<strong>API başvurusu</strong>
<span>Tamga Verify, belge verme, güven listeleri, durum listeleri ve şema kataloğu — her uç noktasıyla.</span>
</a>

<a class="tg-card" href="/specifications/">
<strong>Şartnameler</strong>
<span>Bağlayıcı kurallar: biçimler, protokoller, güven listesi, doğrulama hattı.</span>
</a>

</div>

## Ortamlar

| Adres | Ne |
|---|---|
| `trust.tamga.network` | İmzalı güven listeleri |
| `schemas.tamga.network` | Belge türü kataloğu |
| `issuer.tamga.network/{kurum}` | Barındırılan belge verme servisi |
| `verify.tamga.network` | Tamga Verify — barındırılan doğrulayıcı ve sayfa kiti |
| `status.tamga.network` | İptal listeleri |
| `console.tamga.network` | Kurum Konsolu — belge veren kurumların yönetim ekranı |
| `id.tamga.network` | Kimlik servisi — geçici kimlik belgesi (devlet PID’i gelene kadar) |
| `docs.tamga.network` | Bu belgeler |
| `arf.tamga.network` | Tamga ARF — çerçeve ve kurallar |

Adreslerin hepsi, ne işe yaradıklarıyla: [tamga.network/network](https://tamga.network/tr/network).

Roller, katılım kuralları ve güven çerçevesi: [Tamga ARF](https://arf.tamga.network/tr/). Lisans: belgeler CC BY 4.0, kod
Apache-2.0.

</div>
