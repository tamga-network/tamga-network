---
title: Güven listeleri ve federasyon
---

# Güven listeleri ve federasyon

Bir diploma imzalı gelir; ama imza tek başına "bu imzayı atan gerçekten bir üniversite mi?" sorusunu cevaplamaz. Cevap
**[[t:trust-list|güven listesinde]]**: hangi kurumların, yani [[t:issuer|belge verenlerin]], hangi belge türlerini vermeye yetkili
olduğunu, hangi [[t:verifier|doğrulayıcıların]] kayıtlı olduğunu ve hangi [[t:wallet-provider|cüzdan sağlayıcılarının]]
tanındığını gösteren, imzalı ve sürümlü bir liste.

## İki katman

| Liste | Ne içerir | Adres |
|---|---|---|
| **List of Trusted Lists (LOTL)** | Ülke listelerinin adresleri ve onları imzalayan sertifikalar, cüzdan sağlayıcıları, şema kataloğu, ortak ayarlar | `https://trust.tamga.network/lotl.jws` |
| **Ülke listesi** | O ülkenin belge verenleri, doğrulayıcıları, kök sertifikaları | `https://trust.tamga.network/tl-tr.jws` |

Bu yapı AB'nin güven modeliyle aynıdır: Avrupa Komisyonu bir [[t:LOTL]] yayınlar, her üye ülke kendi listesini. Biçimler
[[t:ETSI]] standartlarına eşlenir.

## Tek kök anahtar

Cüzdan ve doğrulayıcı yalnız **bir şeye** baştan güvenir: LOTL'u imzalayan kökün, yani [[t:trust-anchor|güven çapasının]], parmak
izine. Parmak izini yapılandırmanıza sabitlersiniz (`https://tamga.network/trust-anchor`); gerisini liste söyler. Listeyi
kendiniz yorumlamayın — `TrustSource` arayüzü imzayı, sürüm zincirini ve tazeliği denetleyip size kayıtları verir.

```ts
import { fetchListTrustSource, verifyJws } from "@tamga-network/trust";

const { source } = await fetchListTrustSource("https://trust.tamga.network", http, {
  rootFingerprints: ["<trust-anchor sayfasındaki parmak izi>"],
  verifyJws,
});
const issuer = source.issuer(issuerId); // kurum kaydı: yetkili belge türleri, seviye, durum
```

## Bugün ve yarın

- **Bugün:** Türkiye listesini Tamga, ulusal makam adına ve geçici olarak yayınlar (`operator.status: provisional`). Belge
  veren ve doğrulayıcı kaydını Tamga operatörü yapar.
- **Devir:** Devlet ya da yetkilendirdiği kurum kendi listesini yayınladığında LOTL o listenin adresini ve imzacısını gösterir.
  Belgeler, cüzdanlar ve doğrulayıcılar değişmez; kurum kimlikleri (`issuer_id`) sertifikadan türediği için aynı kalır.
- **[[t:federation|Federasyon]]:** Her Türk devleti kendi listesini işletebilir; LOTL hepsini bir araya getirir ve birbirine
  tanıtır. Karşılıklı tanıma da (ör. AB listeleri) aynı kapıdan gelir. Zincir, en az iki bağımsız işletmeci katıldığında bu
  kayıtların ortak defteri olur.

## Ayrıntı

- Liste biçimi ve kadans: [[SPEC-TRUST-0001]]
- Kurum kimliği (X.509): [[SPEC-ID-0002]]
- Federasyon: [Federasyon](/concepts/federation) · ülke listesini bağlamak: [[GUIDE-0011]]
- Rehber: [[GUIDE-0006]]
- Konumlanma kararı: [[ADR-0035]]
