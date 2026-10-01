# Documentation Standard

**Standard Version:** 1.1.0 (2026-09-24: `Framework` katmanı ve `FW-<DOMAIN>-<NUMBER>` kimliği eklendi)
**Status:** Active
**Applies To:** Tamga Network Engineering Workspace içindeki tüm Markdown dokümanları

---

# Amaç

Bu doküman, Tamga Network Engineering Workspace'in resmi dokümantasyon standardını tanımlar.

Hedef; şu özelliklere sahip dokümantasyon üretmektir:

- insanlar için kolay okunur,
- AI sistemleri için kolay ayrıştırılır (parse),
- zamanla kolay bakım yapılır,
- depo genelinde izlenebilir (traceable),
- tüm katmanlarda tutarlı.

Dokümantasyon birinci sınıf bir mühendislik ürünü olarak ele alınır.

---

# Tasarım Prensipleri

- Dokümantasyon mühendislik gerekçesini korur.
- Dokümantasyon versiyonlanır.
- Dokümantasyon izlenebilirdir.
- Dokümantasyon yıllarca değerli kalmalıdır.
- Dokümantasyon hem insanlar hem AI için optimize edilir.
- Project Memory kararların **neden** verildiğini açıklar.
- Architecture sistemin **ne** olduğunu açıklar.
- Specification sistemin **nasıl** çalıştığını açıklar.
- Research dış sistemleri açıklar.
- Academy kavramları öğretir.
- ADR kabul edilmiş kararları kaydeder.
- RFC önerilen değişiklikleri kaydeder.

---

# YAML Front Matter

Her Markdown doküman **mutlaka** YAML front matter ile başlamalıdır.

## Zorunlu Alanlar

```yaml
---
document_id:
title:
category:
domain:
status:
review_status:
version:
created:
last_updated:
authors:
tags:
keywords:
summary:
priority:
---
```

## Opsiyonel Alanlar

Yalnızca değer kattığında ekle:

```yaml
language:
document_type:
audience:
stability:
maturity:
related:
depends_on:
see_also:
specs:
adrs:
rfcs:
research:
academy:
implementation:
references:
supersedes:
superseded_by:
review_cycle:
---
```

Uygulanmayan alanı yazma.

---

# Alan Tanımları

## document_id
Benzersiz doküman kimliği. Bkz. **Document ID Convention**.

## title
İnsan okunabilir başlık.

## category
Üst düzey kategori. Örnekler: `Philosophy`, `Identity`, `Trust`, `Architecture`, `Specification`, `Research`, `Academy`, `ADR`, `RFC`, `README`.

## domain
Birincil mühendislik alanı. Örnekler: `Philosophy`, `Identity`, `Trust`, `Credential`, `Authorization`, `Consent`, `Protocol`, `Event`, `Blockchain`, `Security`, `Governance`, `Platform`, `Documentation`.

## status
Dokümanın durumu. İzinli değerler: `Draft`, `Active`, `Deprecated`, `Superseded`, `Archived`.

## review_status
Dokümantasyon inceleme durumu (bkz. `DOCUMENTATION-LIFECYCLE.md`). İzinli değerler:
`Draft`, `Completed`, `In Review`, `Reviewed`, `Frozen`, `Deprecated`, `Archived`.

## version
Dokümanın semantik versiyonu. Örnek: `1.0.0`.

## created / last_updated
Tarih formatı: `YYYY-MM-DD`.

## authors
Örnek:
```yaml
authors:
  - Tamga Network Engineering
```

## tags
Kısa aranabilir etiketler.

## keywords
AI ve arama için daha uzun semantik anahtar kelimeler.

## summary
Katlanmış (folded) YAML ile kısa açıklama:
```yaml
summary: >
  Kimlik-öncelikli mimari prensibini tanımlar.
```

## priority
İzinli değerler: `Critical`, `High`, `Medium`, `Low`.

## stability (opsiyonel)
İzinli değerler: `Timeless`, `Stable`, `Evolutionary`, `Experimental`.

## maturity (opsiyonel)
İzinli değerler: `Foundational`, `Developing`, `Draft`, `Stable`, `Final`.

---

# Document ID Convention

## Project Memory
```text
PM-<DOMAIN>-<NUMBER>
```
Örnek: `PM-PH-0001`, `PM-ID-0001`, `PM-TRUST-0001`

## Architecture
```text
ARCH-<NUMBER>
```
Örnek: `ARCH-0001`

## Specification
```text
SPEC-<DOMAIN>-<NUMBER>
```
Örnek: `SPEC-ID-0001`, `SPEC-PROTO-0001`

## Academy
```text
ACA-<DOMAIN>-<NUMBER>
```
Örnek: `ACA-ID-0001`

## Research
```text
RS-<TOPIC>-<NUMBER>
```
Örnek: `RS-DID-0001`, `RS-W3C-VC-0001`

## ADR
```text
ADR-<NUMBER>
```

## RFC
```text
RFC-<NUMBER>
```

## Framework (dışa dönük çerçeve belgeleri — `docs/framework/`)
```text
FW-<DOMAIN>-<NUMBER>
```
Örnek: `FW-ARF-0001` (Tamga ARF), `FW-TF-0001` (Trust Framework), `FW-RB-0001` (Rulebook),
`FW-RB-0002` (Attestation Rulebook — eğitim), `FW-RISK-0001` (risk kütüğü). Kategori değeri
`Framework`. Bu katman **karar üretmez**: her kuralı bir ADR/SPEC/PM/INVARIANTS koduna atıfla
derler; kaynağı olmayan madde "ÖNERİ" etiketi taşır. Değişmez tablosu **içermez** (INVARIANTS'a
kod eklemez); kurallar `RB-<ROL>-<NN>` biçiminde numaralanır ve kaynak koda atıf verir.

### Yaygın Domain Kısaltmaları
`PH` Philosophy · `ID` Identity · `TRUST` Trust · `CRED` Credential · `SCHEMA` Schema · `AUTH` Authorization · `CONSENT` Consent · `PROTO` Protocol · `EVENT` Event · `BC` Blockchain · `SEC` Security · `GOV` Governance · `PLAT` Platform · (Framework için) `ARF` · `TF` · `RB` · `RISK`

> `SCHEMA` 2026-09-09'da eklendi ([[ADR-0007]], [[PM-SCHEMA-0001]]). Şema kayıt defteri,
> credential formatından ayrı bir domaindir: `CRED` belgenin *nasıl taşındığını*,
> `SCHEMA` *ne anlama geldiğini* tanımlar.


### Değişmez (Invariant) Kodları

Değişmez kodları **doküman kapsamlıdır**; farklı dokümanlarda aynı kod
bulunabilir. Bu yüzden:

- Doküman **içinde** kısa kod kullanılır: `S1`
- Doküman **dışına** atıfta doküman kimliği zorunludur: `[[SPEC-CRED-0003]]/S1`
- Bir dokümanın **adım kodları** (doğrulama hattı `A1…E4`) değişmez kodu
  DEĞİLDİR ve aynı harf-rakam biçimini kullansa bile ayrı bir isim alanıdır.

Tüm değişmezlerin indeksi [[INVARIANTS]]'tadır ve **üretilen** bir dosyadır.
Yeni doküman eklendiğinde yeniden üretilir; çakışma bölümü boş kalmalıdır.

---

# Markdown Kuralları

Her doküman:

- problemi açıklamalı,
- gerekçeyi açıklamalı,
- alternatifleri açıklamalı,
- ödünleşimleri açıklamalı,
- desteksiz görüşlerden kaçınmalı,
- tutarlı terminoloji kullanmalı,
- tarihsel gerekçeyi korumalı,
- yıllar sonra bile anlaşılır kalmalı.

---

# Kararlı Başlık Yapısı (Project Memory)

Uygun olduğunda Project Memory dokümanları şu yapıyı izler:

```text
Giriş
Problem
Evrim (Evolution)
Mimari (Architecture)
İlişkiler (Relationships)
Araştırma (Research)
Gelecek (Future)
Sonuç
İlgili Dokümanlar
Durum (Status)
```

Her başlık zorunlu değildir, ancak yapı öngörülebilir kalmalıdır.

---

# Çapraz Referans ve Bilgi Grafiği

Dokümanlar mümkün olduğunca diğer iç dokümanlara `document_id` ile referans vermelidir.

```text
PM-PH-0001, PM-ID-0001, ADR-0002, SPEC-ID-0001
```

Bu, izlenebilir bir **mühendislik bilgi grafiği (knowledge graph)** oluşturur. İzole dokümandan kaçın.

---

# Research First Kuralı

Önemli mühendislik kararları mümkün olduğunca araştırma ile desteklenmelidir. Bir doküman şunları açıklamalı:

- hangi problem incelendi,
- hangi alternatifler değerlendirildi,
- ne öğrenildi,
- bazı yaklaşımlar neden reddedildi,
- seçilen yön neden tercih edildi.

---

# AI Optimizasyonu

Kaçın: belirsiz terimler, açıklanmamış kısaltmalar, gizli varsayımlar, dokümante edilmemiş bağımlılıklar.

Tercih et: açık ilişkiler, kararlı kimlikler, semantik metadata, öngörülebilir başlıklar, deterministik yapı.

---

# Kurallar

- Her Markdown doküman YAML front matter içermelidir.
- Her dokümanın benzersiz bir `document_id`'si olmalıdır.
- Her doküman `DOCUMENTATION-LIFECYCLE.md`'deki yaşam döngüsünü izlemelidir.
- Temel (foundational) dokümanlar sonunda `Frozen` review_status'a ulaşmalıdır.
- Dokümantasyon yalnızca sonuçları değil, mühendislik gerekçesini de korumalıdır.
- Project Memory ≠ Specification.
- Specification ≠ Research.
- Academy ≠ Project Memory.
- Research ≠ pazarlama materyali.

---

# Sonuç

Tamga Network dokümantasyon sistemi, projenin ömrü boyunca mühendislik bilgisini korumak için tasarlanmıştır. Nihai amaç; hem insanlar hem AI sistemleri için yıllarca anlaşılır, sürdürülebilir ve kullanılabilir bir bilgi tabanı oluşturmaktır.
