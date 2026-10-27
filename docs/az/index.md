---
layout: home
title: Tamga Tərtibatçı Sənədləri
hero:
  name: Tamga Docs
  text: Yoxlanıla bilən rəqəmsal sənədləri məhsulunuza əlavə edin
  tagline: Diplomu, tələbə sənədini, şəxsiyyət sənədini və bileti saniyələr ərzində yoxlayın və ya onları şəxslərin rəqəmsal cüzdanına verin. Aİ-nin rəqəmsal şəxsiyyət standartları (OpenID4VC, SD-JWT VC, ISO mdoc) və açıq mənbəli paketlərlə.
  actions:
    - theme: brand
      text: Başlanğıc
      link: /az/guides/
    - theme: alt
      text: Anlayışlar
      link: /az/concepts/
    - theme: alt
      text: API arayışı
      link: /az/api/
features:
  - icon: ✓
    title: Sənədləri yoxlayın
    details: Veb saytınıza "Tamga ilə daxil ol" əlavə edin və ya öz serverinizdə diplom, şəxsiyyət, yaş və bilet yoxlayın.
    link: /az/guides/sign-in-with-tamga
    linkText: Yoxlama bələdçisi
  - icon: ⬇
    title: Sənəd verin
    details: Qurumunuzun sənədlərini şəxslərin rəqəmsal cüzdanına verin — hostinqdəki xidmətlə və ya öz serverinizlə.
    link: /az/guides/issue-credentials
    linkText: Sənəd vermə bələdçisi
  - icon: ▣
    title: Rəqəmsal cüzdan hazırlayın
    details: Tamga ilə uyğun rəqəmsal cüzdan hazırlayın; sənədləri qəbul edin, saxlayın və seçici paylaşımla (selective disclosure) göstərin.
    link: /az/guides/build-a-wallet
    linkText: Rəqəmsal cüzdan bələdçisi
  - icon: ⛓
    title: Etibar siyahılarını oxuyun
    details: İmzalı etibar siyahılarını kök açarınıza bağlayın; sonra ölkə siyahıları və ortaq reyestr gələcək.
    link: /az/guides/read-trust-lists
    linkText: Etibar siyahısı bələdçisi
---

<div class="tg-home">

## Beş dəqiqəyə yoxlama

Diplomu öz serverinizdə yoxlamaq üçün iki paket kifayətdir: [[t:trust-list|etibar siyahısı]] oxuyucusu və
[[t:verifier|yoxlayan tərəf]] üçün yoxlama xətti.

```sh
npm install @tamga-network/verifier @tamga-network/trust
```

```ts
import { fetchListTrustSource, verifyJws } from "@tamga-network/trust";
import { createPresentationRequest, dcqlFromPolicy } from "@tamga-network/verifier";

// 1. Load the trust lists (root fingerprint: tamga.network/trust-anchor)
const { source: trust } = await fetchListTrustSource("https://trust.tamga.network", http, {
  rootFingerprints: [ROOT_FINGERPRINT],
  verifyJws,
});

// 2. Create a signed request → show it as a QR code
const req = await createPresentationRequest({ signer, dcql: dcqlFromPolicy(DIPLOMA_POLICY), responseUri, requestUriBase });
show(req.qrPayload);
```

Tam, test edilmiş nümunə: [Kod nümunələri](/guides/code-examples). Hostinqdə yerləşdirilmiş yoxlayan tərəf olan Tamga Verify-dan istifadə etsəniz,
server kodu tələb olunmur: [Veb sayta "Tamga ilə daxil ol"](/guides/sign-in-with-tamga).

## Nəzər salın

<div class="tg-cards">

<a class="tg-card" href="/concepts/">
<strong>Anlayışlar</strong>
<span>Etibar siyahıları, rəqəmsal sənəd formatları, vermə və təqdimetmə, məxfilik, ləğv — qısa və sadə.</span>
</a>

<a class="tg-card" href="/packages/">
<strong>SDK-lar</strong>
<span>Doqquz <code>@tamga-network/*</code> paketi; Node və React Native. npm-də 0.7.3 sınaq versiyası; sabit 1.0.0 hazır olduqda.</span>
</a>

<a class="tg-card" href="/api/">
<strong>API arayış kitabçası</strong>
<span>Tamga Verify, rəqəmsal sənədlərin verilməsi, etibar siyahıları, status siyahıları və sxem kataloqu — bütün son nöqtələri ilə.</span>
</a>

<a class="tg-card" href="/specifications/">
<strong>Spesifikasiyalar</strong>
<span>Məcburi qaydalar: formatlar, protokollar, etibar siyahısı, yoxlama xətti.</span>
</a>

</div>

## Mühitlər

| Ünvan | Nədir |
|---|---|
| `trust.tamga.network` | İmzalanmış etibar siyahıları |
| `schemas.tamga.network` | Rəqəmsal sənəd növləri kataloqu |
| `issuer.tamga.network/{kurum}` | Hostinqdə yerləşdirilmiş rəqəmsal sənəd vermə xidməti |
| `verify.tamga.network` | Tamga Verify — hostinqdə yerləşdirilmiş yoxlayan tərəf və səhifə dəsti |
| `status.tamga.network` | Ləğv siyahıları |
| `console.tamga.network` | Qurum Konsolu — sənədi verən qurumların idarəetmə ekranı |
| `id.tamga.network` | Şəxsiyyət xidməti — müvəqqəti şəxsiyyət sənədi (dövlət PID-i gələnədək) |
| `docs.tamga.network` | Bu sənədlər |
| `arf.tamga.network` | Tamga ARF — çərçivə və qaydalar |

Bütün ünvanlar və onların təyinatı: [tamga.network/network](https://tamga.network/az/network).

Rollar, qoşulma qaydaları və etibar çərçivəsi: [Tamga ARF](https://arf.tamga.network/az/). Lisenziya: sənədlər CC BY 4.0, kod
Apache-2.0.

</div>
