---
title: Ləğv və aktuallıq
---

# Ləğv və aktuallıq

Rəqəmsal sənəd [[t:revocation|ləğv]] edilə bilər: tələbənin qeydiyyatı silinir, bilet geri qaytarılır, şəxsiyyətin təsdiqi etibarsız
olur. [[t:verifier|Yoxlayan tərəf]] bunu **[[t:status-list|ləğv siyahısından]]** öyrənir.

## Ləğv siyahısı

Hər qurum verdiyi rəqəmsal sənədlərin statusunu IETF **Token Status List** formatında dərc edir (`https://status.tamga.network/{opak}`).
Siyahı bit ardıcıllığıdır; hər rəqəmsal sənədin öz sıra nömrəsi var. Ünvan qurumu, ili və ya kohortu açıb göstərmir. Siyahının hər dərci
etibar infrastrukturunun [[t:anchor-log|lövbər jurnalına]] qeyd olunur; yoxlayan tərəf siyahının həqiqətən qurumdan gəldiyini buradan
yoxlayır.

Siyahı dəyişiklik olmasa belə **hər 2 dəqiqədən bir** yenidən dərc edilir; beləliklə ləğv anı üzə çıxmır və ləğv, status serveri
işlədiyi müddətdə bir neçə dəqiqə ərzində (dərc intervalı + Sizin əvvəlcədən yükləmə intervalınız) yoxlayan tərəflərə çatır. Hər siyahı tokeni 6 saat etibarlıdır
(`exp` = `iat` + 6 saat): status serverində fasilə yaranarsa, yoxlayan tərəf bu müddət ərzində sonuncu siyahı ilə yoxlamanı davam etdirə bilər.

## Əvvəlcədən yükləmə

Yoxlayan tərəf ləğv siyahılarını **yoxlamadan əvvəl** müntəzəm intervallarla yükləyir və keşdə saxlayır; yoxlama anında quruma
və ya Tamga-ya sorğu göndərilmir. Beləliklə qurum rəqəmsal sənədin harada və nə vaxt təqdim edildiyini öyrənə bilmir.

```ts
import { PrefetchStatusCache } from "@tamga-network/verifier";

const statusCache = new PrefetchStatusCache();
await statusCache.refresh(listUris); // every few minutes
```

## Aktuallıq və "hazırda yoxlanıla bilmədi"

Ləğv siyahısı və ya [[t:trust-list|etibar siyahısı]] siyasətinizdəki maksimum yaşdan köhnədirsə, nəticə `INDETERMINATE` olur: rəqəmsal sənəd
bəlkə də etibarlıdır, lakin hazırda sübut edilə bilməz. İstifadəçiyə "hazırda yoxlanıla bilmədi, bir az sonra yenidən cəhd edin" deyin; rədd etməyin.

`@tamga-network/verifier` siyahı tokenindən `exp`-ə və siyasətinizdəki maksimum yaşa
(`max_status_token_age_sec`) qədər istifadə edir.

## Sıfır bilikli sübut və ləğv

Sıfır bilikli sübutla ([[t:ZK]]) edilən təqdimat ləğv siyahısındakı mövqeyi açmır; buna görə ləğv təqdimat zamanı yoxlanıla bilməz. Qərar
([[ADR-0044]]): bu təqdimat yalnız ən çoxu 24 saat etibarlı olan, rəqəmsal cüzdanın avtomatik yenilədiyi qısamüddətli nüsxələrlə aparılır; ləğv
edilmiş rəqəmsal sənədin nüsxəsi yenilənmir, əldə qalan nüsxə ən gec 24 saat ərzində etibarsız olur. Sübut nüsxənin növünü bağladığı üçün
yoxlayan tərəf bu təqdimatı ləğv yoxlamasını gözləmədən qəbul edir (`status: NOT_APPLICABLE`, əsaslandırma: qısa ömür). Qısamüddətli nüsxədən
istifadə edilməyən ZK təqdimatı, siyasət `accept_unrevocable_zk` sahəsini açıq şəkildə təyin etmədikcə `INDETERMINATE` qaytarır.

## Ətraflı

- Ləğv siyahısı: [[SPEC-CRED-0003]]
- Yoxlama xətti və aktuallıq: [[SPEC-API-0001]]
- Sıfır bilikli sübutda qısamüddətli nüsxələr: [[ADR-0044]]
