---
document_id: ADR-0022
title: "Şəxsiyyət xidmətinin sinfi"
status: Active
version: 1.0.0
created: 2026-09-29
last_updated: 2026-10-02
summary: >
  Tamga şəxsiyyət xidməti etibar siyahısında QUALIFIED / I3 əvəzinə qeyri-kvalifikasiyalı EAA / I2 kimi qeydiyyata alınır; rəqəmsal şəxsiyyət sənədi `category` claim-ini daşımır. "Kvalifikasiyalı" Avropa İttifaqında (Aİ) müstəqil uyğunluğun qiymətləndirilməsini və nəzarət orqanının nəzarətini tələb edən hüquqi statusdur; Tamga hələ bu tələbi qarşılamır. Müstəqil qiymətləndirmədən sonra sinif yenidən yüksəldilə bilər. ADR-0011-in sinif sətrini dəyişir.
domain: Identity
translation_of: ADR-0022
source_version: "1.0.0"
---

# Kontekst

[[ADR-0011]] Tamga şəxsiyyət xidmətini [[t:trust-list|etibar siyahısında]] `class: QUALIFIED`, `assurance: I3` kimi qeydiyyata aldı; rəqəmsal şəxsiyyət sənədinə
`category: urn:tamga:eaa:qualified` yazılır və sxem bunu sabit dəyər kimi tələb edir.

Aİ boşluq təhlili (2026-09-29) və 27 sentyabr kod müqayisəsi (K5 tapıntısı) aşağıdakıları göstərdi:

- [[t:eIDAS]] 2.0-da "kvalifikasiyalı" ([[t:QEAA]] / [[t:QTSP]]) hüquqi statusdur. Bu status müstəqil uyğunluğun qiymətləndirilməsi qurumunun auditini və
  nəzarət orqanının nəzarətini tələb edir.
- [[FW-TF-0001]] I3-ü "müstəqil qiymətləndirmə" şərtinə bağlayır.
- Tamga həm siyahı operatoru, həm qeydiyyat qurumu, həm də şəxsiyyət xidmətidir. Özünü ən yüksək sinfə özü qeydiyyata alıb; müstəqil
  qiymətləndirmə yoxdur. Şəxsiyyəti məsafədən yoxlayan tərəfin (provayderin) ETSI TS 119 461-ə uyğunluğu yalnız bəyan səviyyəsindədir.

Bu vəziyyət Aİ tərəfi ilə danışıqlarda şişirdilmiş iddia kimi qəbul edilir; hüquqi və reputasiya riski daşıyır.

# Qərar

## K1 — Sinif və təminat

Tamga şəxsiyyət xidməti etibar siyahısında **`class: EAA`** (qeyri-kvalifikasiyalı elektron atribut sənədi, [[t:EAA]]) və **`assurance: I2`**
kimi qeydiyyata alınır.

## K2 — Rəqəmsal sənəddə kateqoriya yoxdur

Rəqəmsal şəxsiyyət sənədi (`urn:tamga:id:IdentityAttestation:1`) `category` claim-ini daşımır ([[ADR-0010]] K5: kateqoriya yalnız PUB /
QUALIFIED [[t:issuer|sənədi verən qurumlar]] üçündür). Sxem metadata-sındakı sənədi verən quruma dair minimal təminat səviyyəsi I3-dən I2-yə endirilir.

## K3 — İstifadə edən siyasətlər

Rəqəmsal şəxsiyyət sənədini tələb edən siyasətlər (qurumların şəxsiyyət uyğunlaşdırması, nümunə saytlar) sənədi verən quruma dair minimal təminat səviyyəsi kimi **I2** tələb edir.

Şəxsiyyət təsdiqinin özü dəyişmir:
- sənəd + canlılıq yoxlaması + üz uyğunlaşdırması,
- istəyə bağlı NFC çipin oxunması,
- HMAC ilə sənəd xülasəsi.

Yalnız etibar siyahısındakı etiket faktiki vəziyyətə uyğunlaşdırılır.

## K4 — Yenidən yüksəltmə

Müstəqil uyğunluğun qiymətləndirilməsi (ETSI TS 119 461 / TS 119 471 çərçivəsində) aparıldıqda və [[FW-TF-0001]] I3 şərtləri
qarşılandıqda sinif yeni ADR ilə yüksəldilir.

## K5 — Pilotdan əvvəl yerində düzəliş

Sxem 1.0.0 metadata-sı pilotdan əvvəl olduğu üçün yerində düzəldilir (2026-09-29 tarixli ingilis dili düzəlişi ilə eyni birdəfəlik istisna).
Mövcud test rəqəmsal şəxsiyyət sənədləri yenidən alınır. Pilotda D1 dəyişməzliyi olduğu kimi qüvvədədir.

# Nəzərdən keçirilmiş variantlar

| Seçim | Nəticə | Səbəb |
|---|---|---|
| QUALIFIED / I3-də qalmaq | rədd | Müstəqil qiymətləndirmə yoxdur; Aİ mənasında "kvalifikasiyalı" iddiası təmin edilə bilməz |
| QUALIFIED, I2 | rədd | Sinfin adı yenə də Aİ-dəki hüquqi statusla qarışdırılır |
| **EAA, I2** | **qəbul** | Faktiki vəziyyəti əks etdirir; Aİ-də kvalifikasiyalı olmayan EAA-nı hər kəs verə bilər |
| EAA, I1 | rədd | Şəxsiyyəti yoxlayan tərəfin prosesi və açarların idarə edilməsi I2 tələblərinə cavab verir |

# Dəyişməzlər

| Kod | Qayda |
|---|---|
| IDC1 | Tamga-nın özünün idarə etdiyi xidmət müstəqil uyğunluğun qiymətləndirilməsi olmadan etibar siyahısında QUALIFIED və ya I3 kimi qeydiyyata alınmır. |
| IDC2 | Rəqəmsal şəxsiyyət sənədi `category` claim-ini daşımır; sinif yüksəldilənə qədər heç bir siyasət rəqəmsal şəxsiyyət sənədi üçün I3 tələb etmir. |

# Nəticələr

- `apps/trust-publisher/registry/tl-tr.source.json`: `tamga-id` → `class: EAA`, `assurance: I2`.
- `packages/schemas`: IdentityAttestation `category` sahəsi çıxarılır, `min_issuer_assurance: I2` (1.0.0-da yerində).
- `apps/id` (operator repozitoriyası): rəqəmsal şəxsiyyət sənədinə `category` yazılmır. `apps/issuer`: şəxsiyyət uyğunlaşdırması siyasəti I2.
- [[ADR-0011]] sinif sətri, [[SPEC-ID-0003]], [[FW-RB-0001]] RB-AP-ID-04 və Identity Rulebook yenilənir.

# Status

**Accepted — 2026-09-29.** Layihə rəhbərliyinin təsdiqi ilə. DECISIONS: D-ID-7.
