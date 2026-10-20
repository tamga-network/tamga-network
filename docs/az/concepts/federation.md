---
title: Federasiya
---

# Federasiya

Tamga Network vahid mərkəzdən idarə olunan siyahı deyil. Hər ölkə öz qurumlarını öz [[t:trust-list|etibar siyahısında]]
saxlayır; Tamga bu siyahıları toplayır və onları bir-birinə tanıdır. Bu model **[[t:federation|federasiya]]** adlanır ([[ADR-0035]]).

## Bir lövbər, çoxlu siyahı

Rəqəmsal cüzdan və yoxlayan tərəf əvvəlcədən yalnız bir şeyi bilir: Tamga-nın siyahılar siyahısını ([[t:LOTL]]) imzalayan kökün barmaq izini.
Qalanını LOTL bildirir:

```
                     Tamga LOTL (root fingerprint pinned in the app)
                ┌──────────────┼──────────────────────┐
                ▼              ▼                      ▼
        Türkiye list      another member state   external list (e.g. the EU's
        (Tamga format)    (reserved)             wallet providers, ETSI)
           │                                          │
   issuers, verifiers,                       only the roles and credential
   root certificates                         types in its scope
```

- **Milli siyahılar** Tamga formatındadır; həmin ölkənin [[t:issuer|sənədi verən qurumlarını]], [[t:verifier|yoxlayan tərəflərini]] və kök
  sertifikatlarını ehtiva edir.
- **Xarici siyahılar** ölkələrin və ya Aİ-nin öz ETSI formatındakı siyahılarıdır ([[t:LoTE]]). LOTL onların ünvanını, imzalayanını və
  nəyə zəmanət verə biləcəklərini (əhatə dairəsini) göstərir ([[ADR-0036]]).

## Nə üçün federasiya?

| Sual | Cavab |
|---|---|
| Qurumu kim tanıyır? | Öz ölkəsi. Tamga ölkənin əvəzinə qərar vermir; bu gün Türkiyə üçün müvəqqəti olaraq gördüyü işlər təhvil verilə bilər. |
| Başqa ölkənin rəqəmsal sənədi qəbul edilirmi? | Ölkə həmin ölkəni tanıyırsa, bəli (qarşılıqlı tanınma; yoxlamada C3 addımı). |
| Aİ rəqəmsal cüzdanı Tamga qurumundan rəqəmsal sənəd ala bilərmi? | Həmin cüzdanın provayderinə zəmanət verən xarici siyahı LOTL-a əlavə edilibsə, bəli. |
| Siyahılardan biri pozulsa? | Yalnız həmin siyahıdan asılı sorğular "naməlum" nəticəsini qaytarır; digər siyahılar təsirlənmir. |

## Əhatə dairəsinin həddi

Xarici siyahı yalnız öz əhatə dairəsinə daxil olan işlərə zəmanət verə bilər. Məsələn, yalnız şəxsiyyət provayderlərinə zəmanət verən siyahı
diplom verən qurum əlavə edə bilməz; belə qeyd nəzərə alınmır. Hazırda LOTL-da xarici siyahı yoxdur; hər əlavə ayrıca təsdiq tələb edir.

## Təhvil

Hazırda Türkiyə siyahısını, qeydiyyat qurumunu və kök sertifikatı Tamga müvəqqəti olaraq idarə edir. Dövlət bu rolları öz üzərinə götürdükdə rəqəmsal cüzdan və
yoxlayan tərəflərdə yalnız ünvan və imzalayan dəyişir; qurumların identifikatorları və verilmiş rəqəmsal sənədlər qüvvədə qalır.

## Gələcəkdə: ortaq reyestr

Ən azı iki müstəqil operator qoşulduqda eyni qeydlər icazəli [[t:ledger|ortaq reyestrə]] köçürülə bilər ([[ADR-0009]]). Oxuma
interfeysi (`TrustSource`) dəyişmir; tətbiqlər də dəyişmir.

## Ətraflı

- Ölkə siyahısını qoşmaq: [[GUIDE-0011]]
- Siyahıları kodda oxumaq: [[GUIDE-0006]]
- Format: [[SPEC-TRUST-0001]] · Qayda: [[ADR-0036]]
