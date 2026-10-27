---
document_id: GUIDE-0004
title: "Kod nümunələri"
status: Active
version: 1.0.0
created: 2026-09-27
last_updated: 2026-10-20
summary: >
  Beş işlək nümunə: veb sayta Tamga ilə giriş, öz serverinizdə rəqəmsal sənədin yoxlanılması, qurum olaraq rəqəmsal sənəd verilməsi, qurumun səlahiyyətinin sorğulanması və qurumun sorğu nöqtəsi. Kodlar `examples/` qovluğundakı real fayllardan bu səhifəyə götürülür və hər testdə işə salınır; bu səhifədəki kod paketlə uyğunsuz vəziyyətə düşə bilməz.
translation_of: GUIDE-0004
source_version: "1.0.0"
---

# Kod nümunələri

Bu səhifə Tamga-nın beş əsas istifadə ssenarisini kopyalayıb işə sala biləcəyiniz kodla göstərir.

**Nə vaxt oxumalı:** hər hansı bələdçini oxuduqdan sonra işlək kodu görmək istədiyinizdə və ya birbaşa koddan başlamağı
üstün tutduğunuzda. Hər nümunə onun təfərrüatlarını izah edən bələdçiyə keçid verir.

Aşağıdakı kodlar `tamga-network/examples/` qovluğundakı **real fayllardır**: hər test icrasında real paketlərlə
(mümkün olan hallarda real yoxlayan tərəflə) başdan sona sınaqdan keçirilir. Buna görə səhifədəki kod paketlərlə uyğunsuz vəziyyətə düşə bilməz.

## Quraşdırma

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

::: tip Versiya
Paketlər npm-də 0.7.3 sınaq versiyası ilə dərc olunur; sabit 1.0.0 versiyası hazır olduqda təqdim ediləcək. Sınaq versiyasında interfeys
dəyişə bilər. Paketlərdən mənbə repozitoriyasından da istifadə etmək olar
(`npm run release:check` dərcə hazır paketləri `.publish/` qovluğunda yaradır).
:::

| Nə etmək istəyirsiniz? | Paket | İdxal |
|---|---|---|
| Veb saytınıza Tamga ilə giriş | `@tamga-network/verifier` (+ səhifə dəsti `/web`) | `import { createRpAssertion } from "@tamga-network/verifier"` |
| Öz serverinizdə rəqəmsal sənədi yoxlamaq | `@tamga-network/verifier`, `@tamga-network/trust` | `import { verifyPresentation } from "@tamga-network/verifier"` |
| Qurum olaraq rəqəmsal sənəd vermək | `@tamga-network/issuer` | `import { createIssuerClient } from "@tamga-network/issuer/client"` |
| Qurumun səlahiyyətini sorğulamaq | `@tamga-network/trust` | `import { fetchListTrustSource } from "@tamga-network/trust"` |

## 1. Veb saytda "Tamga ilə daxil ol"

Təqdimatı **saytınızın serveri** açır: [[t:trust-list|etibar siyahısındakı]] qeydinizin açarı ilə imzalanmış, qısamüddətli
bəyanla. Səhifə yalnız QR kodu
göstərir və vəziyyəti izləyir; təsdiqlənmiş dəyərlər serverinizə bir dəfə ötürülür ([[ADR-0017]]). Təfərrüat: [[GUIDE-0001]].

::: code-group

<<< @/../examples/01-web-login/server.ts [server.ts]

<<< @/../examples/01-web-login/page.html [page.html]

:::

## 2. Öz serverinizdə rəqəmsal sənədin yoxlanılması

Host edilən [[t:verifier|yoxlayan tərəf]] xidməti olmadan: etibar siyahılarını yoxlayır, [[t:status-list|ləğv siyahılarını]] əvvəlcədən yükləyir, imzalı sorğu yaradır, şifrələnmiş
cavabı deşifrə edir və yoxlama zəncirini (T0 + A–E) işə salır. Nəticə üç dəyərlidir: `ACCEPTED`, `REJECTED`, `INDETERMINATE`
("hazırda yoxlamaq mümkün olmadı" — bu, rəqəmsal sənədin etibarsız olması demək deyil). Təfərrüat: [[GUIDE-0002]].

<<< @/../examples/02-verify-own-server/verifier.ts

## 3. Qurum olaraq rəqəmsal sənəd vermək (host edilən xidmət)

Tamga operatorunun qurumunuza verdiyi əhatə dairəsi müəyyən edilmiş API açarı ilə ([[ADR-0016]]). Təklif keçidi QR kod kimi göstərilir; PIN
ayrıca kanalla verilir, heç vaxt keçidin daxilində ötürülmür. Təfərrüat: [[GUIDE-0003]].

<<< @/../examples/03-issue-hosted/issuer.ts

## 4. Qurumun səlahiyyətini sorğulamaq

[[t:issuer|Sənədi verən]] qurum etibar siyahısında qeydiyyatdadırmı, aktivdirmi, bu sənəd növünü verməyə səlahiyyəti varmı? Fərdi məlumatlar daxil deyil. Təfərrüat: [[GUIDE-0006]].

<<< @/../examples/04-check-institution/check.ts

## 5. Qurumun sorğu nöqtəsi (səlahiyyətli mənbə)

Host edilən sənəd vermə xidməti sənəd məlumatını vermə anında qurumun sistemindən oxuyur və saxlamır ([[ADR-0020]]). Bu nümunə
tələbə informasiya sisteminizin (və ya onun müntəzəm ixracının) önündə yerləşdirəcəyiniz sorğu nöqtəsinin tam kodudur: imzalı sorğunu etibar siyahısı
əsasında yoxlayır (razılaşdırılmış yoxlayan tərəf qeydi, `aud`, müddət, birdəfəlik istifadə) və sənəd növünün tələb etdiyi sahələri qaytarır;
T.C. şəxsiyyət nömrəsini heç vaxt qaytarmır. Müqavilə: [Qurumun sorğu nöqtəsi](/api/institution-source).

<<< @/../examples/05-institution-source/source.ts

## Nümunələrin işə salınması

```sh
git clone https://github.com/tamga-network/tamga-network && cd tamga-network
npm install && npm run setup           # development PKI + trust lists
npx vitest run examples             # five examples, with the real packages
```
