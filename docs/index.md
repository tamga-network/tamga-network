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
      link: /guides/README
    - theme: alt
      text: Kavramlar
      link: /concepts/
    - theme: alt
      text: API başvurusu
      link: /api/
      target: _self
features:
  - icon: ✓
    title: Belge doğrulayın
    details: Web sitenize "Tamga ile giriş yap" ekleyin ya da sunucunuzda diploma, kimlik, yaş ve bilet doğrulayın.
    link: /guides/01-web-giris
    linkText: Doğrulama rehberi
  - icon: ⬇
    title: Belge verin
    details: Kurumunuzun belgelerini kişilerin cüzdanına verin — barındırılan servisle ya da kendi sunucunuzla.
    link: /guides/03-kurum-ihrac
    linkText: Belge verme rehberi
  - icon: ▣
    title: Cüzdan geliştirin
    details: Tamga uyumlu bir cüzdan yapın; belgeleri alın, saklayın, seçici olarak gösterin.
    link: /guides/05-cuzdan-gelistirme
    linkText: Cüzdan rehberi
  - icon: ⛓
    title: Güven listelerini okuyun
    details: İmzalı güven listelerini kökünüze sabitleyin; ileride ülke listeleri ve ortak defter.
    link: /guides/06-guven-listeleri-ve-ag
    linkText: Güven listeleri rehberi
---

<div class="tg-home">

## Beş dakikada doğrulama

Bir diplomayı kendi sunucunuzda doğrulamak için iki paket yeter.

```sh
npm install @tamga-network/verifier @tamga-network/trust @tamga-network/core
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

Tam, testli örnek: [Kod örnekleri](/guides/04-kod-ornekleri). Barındırılan doğrulayıcıyı kullanmak isterseniz sunucu kodu
gerekmez: [Web sitesine "Tamga ile giriş yap"](/guides/01-web-giris).

## Göz atın

<div class="tg-cards">

<a class="tg-card" href="/concepts/">
<strong>Kavramlar</strong>
<span>Güven listeleri, belge biçimleri, verme ve gösterme, gizlilik, iptal — kısa ve sade.</span>
</a>

<a class="tg-card" href="/packages/">
<strong>SDK'lar</strong>
<span>Sekiz <code>@tamga-network/*</code> paketi; Node ve React Native. npm'de ön sürüm.</span>
</a>

<a class="tg-card" href="/api/" target="_self">
<strong>API başvurusu</strong>
<span>Barındırılan belge verme ve doğrulama servislerinin uç noktaları.</span>
</a>

<a class="tg-card" href="/specifications/README">
<strong>Spesifikasyonlar</strong>
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

Roller, katılım kuralları ve güven çerçevesi: [Tamga ARF](https://arf.tamga.network/tr/). Lisans: belgeler CC BY 4.0, kod
Apache-2.0.

</div>
