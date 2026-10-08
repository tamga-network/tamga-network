---
document_id: GUIDE-0004
title: "Kod örnekleri"
status: Active
version: 1.0.0
created: 2026-09-27
last_updated: 2026-10-07
summary: >
  Dört çalışan örnek: web sitesine Tamga ile giriş, kendi sunucusunda belge doğrulama, kurum olarak belge verme ve kurum
  yetkisini sorgulama. Kodlar `examples/` klasöründeki gerçek dosyalardan bu sayfaya alınır ve her testte çalıştırılır; bu
  sayfadaki kod paketle uyumsuz hâle gelemez.
---

# Kod örnekleri

Bu sayfa, Tamga'nın dört temel kullanımını kopyalayıp çalıştırabileceğiniz kodla gösterir.

**Ne zaman okunur:** bir rehberi okuduktan sonra çalışan kodu görmek istediğinizde ya da doğrudan koddan başlamayı
sevdiğinizde. Her örnek, ayrıntısını anlatan rehbere bağlanır.

Aşağıdaki kodlar `tamga-network/examples/` klasöründeki **gerçek dosyalardır**: her test çalıştırmasında gerçek paketlerle
(mümkün olanlarda gerçek doğrulayıcıyla) uçtan uca denenir. Bu yüzden sayfadaki kod paketlerle uyumsuz hâle gelemez.

## Kurulum

::: code-group

```sh [npm]
npm install @tamga-network/verifier @tamga-network/trust @tamga-network/issuer
```

```sh [pnpm]
pnpm add @tamga-network/verifier @tamga-network/trust @tamga-network/issuer
```

```sh [yarn]
yarn add @tamga-network/verifier @tamga-network/trust @tamga-network/issuer
```

:::

::: tip Sürüm
Paketler npm'de 0.2.0 deneme sürümüyle yayımlanır; kararlı 1.0.0 hazır olunca gelir. Deneme sürümünde arayüz
değişebilir. Kaynak depodan da kullanılabilir
(`npm run release:check` yayına hazır paketleri `.publish/` klasöründe üretir).
:::

| Ne yapmak istiyorsunuz? | Paket | İçe aktarma |
|---|---|---|
| Web sitenize Tamga ile giriş | `@tamga-network/verifier` (+ sayfa kiti `/web`) | `import { createRpAssertion } from "@tamga-network/verifier"` |
| Kendi sunucunuzda belge doğrulamak | `@tamga-network/verifier`, `@tamga-network/trust` | `import { verifyPresentation } from "@tamga-network/verifier"` |
| Kurum olarak belge vermek | `@tamga-network/issuer` | `import { createIssuerClient } from "@tamga-network/issuer/client"` |
| Kurumun yetkisini sorgulamak | `@tamga-network/trust` | `import { fetchListTrustSource } from "@tamga-network/trust"` |

## 1. Web sitesine "Tamga ile giriş yap"

Sunumu **sitenizin sunucusu** açar: [[t:trust-list|güven listesindeki]] kaydınızın anahtarıyla imzalı, kısa ömürlü bir
beyanla. Sayfa yalnızca QR'ı
gösterir ve durumu izler; onaylanan değerler sunucunuza bir kez verilir ([[ADR-0017]]). Ayrıntı: [[GUIDE-0001]].

::: code-group

<<< @/../examples/01-web-login/server.ts [server.ts]

<<< @/../examples/01-web-login/page.html [page.html]

:::

## 2. Kendi sunucunuzda belge doğrulama

Barındırılan [[t:verifier|doğrulayıcı]] olmadan: güven listelerini doğrular, [[t:status-list|iptal listelerini]] önceden çeker, imzalı istek üretir, şifreli
cevabı çözer ve doğrulama hattını (T0 + A–E) çalıştırır. Sonuç üç değerlidir: `ACCEPTED`, `REJECTED`, `INDETERMINATE`
("şu an denetlenemedi" — belge geçersiz demek değildir). Ayrıntı: [[GUIDE-0002]].

<<< @/../examples/02-verify-own-server/verifier.ts

## 3. Kurum olarak belge vermek (barındırılan servis)

Kurumunuza Tamga operatörünün verdiği kapsamlı API anahtarıyla ([[ADR-0016]]). Teklif bağlantısı QR olarak gösterilir; PIN
ayrı bir kanaldan verilir, bağlantının içinde asla gitmez. Ayrıntı: [[GUIDE-0003]].

<<< @/../examples/03-issue-hosted/issuer.ts

## 4. Kurum yetkisini sorgulamak

Bir [[t:issuer|belge veren]] kurum güven listesinde kayıtlı mı, etkin mi, bu belge türünü vermeye yetkili mi? Kişisel veri içermez. Ayrıntı: [[GUIDE-0006]].

<<< @/../examples/04-check-institution/check.ts

## Örnekleri çalıştırmak

```sh
git clone https://github.com/tamga-network/tamga-network && cd tamga-network
npm install && npm run setup           # geliştirme PKI'si + güven listeleri
npx vitest run examples             # dört örnek, gerçek paketlerle
```
