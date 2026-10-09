---
title: İptal ve tazelik
---

# İptal ve tazelik

Bir belge [[t:revocation|iptal]] edilebilir: öğrenci kaydı silinir, bilet iade edilir, kimlik doğrulaması geçersiz
kalır. [[t:verifier|Doğrulayıcı]] bunu **[[t:status-list|iptal listesinden]]** öğrenir.

## İptal listesi

Her kurum, verdiği belgelerin durumunu IETF **Token Status List** biçiminde yayınlar (`https://status.tamga.network/{opak}`).
Liste bir bit dizisidir; her belgenin bir sırası vardır. Adres kurumu, yılı ya da kohortu açığa vurmaz. Listenin her yayını
güven altyapısının [[t:anchor-log|çapa günlüğüne]] kaydedilir; doğrulayıcı listenin gerçekten kurumdan geldiğini buradan
denetler.

Liste değişiklik olmasa da **2 dakikada bir** yeniden yayınlanır; böylece iptal anı dışarı sızmaz ve bir iptal, durum sunucusu
çalışırken birkaç dakikada (yayın aralığı + önceden çekme aralığınız) doğrulayıcılara ulaşır. Her liste belirteci 6 saat geçerlidir
(`exp` = `iat` + 6 saat): durum sunucusu kesintiye uğrarsa doğrulayıcı son listeyle bu süre boyunca doğrulamaya devam edebilir.

## Önceden çekme

Doğrulayıcı iptal listelerini **doğrulamadan önce** düzenli aralıklarla çeker ve önbellekte tutar; doğrulama anında kuruma
ya da Tamga'ya istek gitmez. Böylece kurum, belgenin nerede ve ne zaman gösterildiğini öğrenemez.

```ts
import { PrefetchStatusCache } from "@tamga-network/verifier";

const statusCache = new PrefetchStatusCache();
await statusCache.refresh(listUris); // birkaç dakikada bir
```

## Tazelik ve "şu an doğrulanamadı"

İptal listesi ya da [[t:trust-list|güven listesi]] politikanızdaki en eski yaştan bayatsa sonuç `INDETERMINATE` olur: belge
belki geçerlidir ama şu an kanıtlanamaz. Kullanıcıya "şu an doğrulanamadı, biraz sonra tekrar deneyin" deyin; reddetmeyin.

`@tamga-network/verifier` 0.3.1 ve sonrası bir liste belirtecini `exp`'e ve politikanızdaki azami yaşa
(`max_status_token_age_sec`) kadar kullanır.

## Sıfır bilgi ispatı ve iptal

Sıfır bilgi ispatıyla ([[t:ZK]]) yapılan sunum iptal listesindeki yeri açmaz; bu yüzden iptal sunumda denetlenemez. Karar
([[ADR-0044]]): bu sunum yalnız en çok 24 saat geçerli, cüzdanın kendiliğinden yenilediği kısa ömürlü kopyalarla yapılır; iptal
edilen belgenin kopyası yenilenmez. Uygulama sırada; o zamana kadar politika `accept_unrevocable_zk` alanını açıkça
koymadıkça böyle bir sunum `INDETERMINATE` döner.

## Ayrıntı

- İptal listesi: [[SPEC-CRED-0003]]
- Doğrulama hattı ve tazelik: [[SPEC-API-0001]]
- Sıfır bilgi ispatında kısa ömürlü kopyalar: [[ADR-0044]]
