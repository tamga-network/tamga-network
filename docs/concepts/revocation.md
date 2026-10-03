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

## Ayrıntı

- İptal listesi: [[SPEC-CRED-0003]]
- Doğrulama hattı ve tazelik: [[SPEC-API-0001]]
