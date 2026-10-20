---
title: Etibar siyahıları və federasiya
---

# Etibar siyahıları və federasiya

Diplom imzalı şəkildə gəlir; lakin imza tək başına "bu imzanı atan həqiqətən universitetdirmi?" sualına cavab vermir. Cavab
**[[t:trust-list|etibar siyahısındadır]]**: hansı qurumların, yəni [[t:issuer|sənədi verən qurumların]], hansı rəqəmsal sənəd növlərini verməyə səlahiyyətli
olduğunu, hansı [[t:verifier|yoxlayan tərəflərin]] qeydiyyatda olduğunu və hansı [[t:wallet-provider|cüzdan provayderlərinin]]
tanındığını göstərən, imzalı və versiyalı siyahı.

## İki səviyyə

| Siyahı | Nəyi ehtiva edir | Ünvan |
|---|---|---|
| **List of Trusted Lists (LOTL)** | Ölkə siyahılarının ünvanları və onları imzalayan sertifikatlar, cüzdan provayderləri, sxem kataloqu, ümumi parametrlər | `https://trust.tamga.network/lotl.jws` |
| **Ölkə siyahısı** | Həmin ölkənin sənədi verən qurumları, yoxlayan tərəfləri, kök sertifikatları | `https://trust.tamga.network/tl-tr.jws` |

Bu struktur Avropa İttifaqının (Aİ) etibar modeli ilə eynidir: Avropa Komissiyası bir [[t:LOTL]] dərc edir, hər üzv dövlət isə öz siyahısını. Formatlar
[[t:ETSI]] standartlarına uyğunlaşdırılır.

## Vahid kök açar

Rəqəmsal cüzdan və yoxlayan tərəf əvvəlcədən yalnız **bir şeyə** etibar edir: LOTL-u imzalayan kökün, yəni [[t:trust-anchor|etibar lövbərinin]], barmaq
izinə. Barmaq izini konfiqurasiyanızda sabitləyirsiniz (`https://tamga.network/trust-anchor`); qalanını siyahı bildirir. Siyahını
özünüz şərh etməyin — `TrustSource` interfeysi imzanı, versiya zəncirini və aktuallığı yoxlayıb sizə qeydləri təqdim edir.

```ts
import { fetchListTrustSource, verifyJws } from "@tamga-network/trust";

const { source } = await fetchListTrustSource("https://trust.tamga.network", http, {
  rootFingerprints: ["<fingerprint from the trust-anchor page>"],
  verifyJws,
});
const issuer = source.issuer(issuerId); // institution entry: authorised credential types, level, status
```

## Bu gün və gələcəkdə

- **Bu gün:** Türkiyə siyahısını Tamga milli orqan adından və müvəqqəti olaraq dərc edir (`operator.status: provisional`). Sənədi
  verən qurumların və yoxlayan tərəflərin qeydiyyatını Tamga operatoru aparır.
- **Təhvil:** Dövlət və ya onun səlahiyyət verdiyi qurum öz siyahısını dərc etdikdə LOTL həmin siyahının ünvanını və imzalayanını göstərir.
  Rəqəmsal sənədlər, rəqəmsal cüzdanlar və yoxlayan tərəflər dəyişmir; qurum identifikatorları (`issuer_id`) sertifikatdan törədiyi üçün eyni qalır.
- **[[t:federation|Federasiya]]:** Hər bir türk dövləti öz siyahısını idarə edə bilər; LOTL hamısını bir araya gətirir və bir-birinə
  tanıdır. Qarşılıqlı tanınma da (məs., Aİ siyahıları) eyni qapıdan gəlir. Zəncir ən azı iki müstəqil operator qoşulduqda bu
  qeydlərin ortaq reyestrinə çevrilir.

## Ətraflı

- Siyahı formatı və yenilənmə tezliyi: [[SPEC-TRUST-0001]]
- Qurum identifikatoru (X.509): [[SPEC-ID-0002]]
- Federasiya: [Federasiya](/concepts/federation) · ölkə siyahısını qoşmaq: [[GUIDE-0011]]
- Bələdçi: [[GUIDE-0006]]
- Mövqeləndirmə qərarı: [[ADR-0035]]
