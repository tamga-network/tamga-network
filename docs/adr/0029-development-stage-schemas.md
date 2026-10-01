---
document_id: ADR-0029
title: Geliştirme Evresinde Şemalar Yerinde Düzeltilir — Sürüm Geçişi Beta ile Başlar
category: ADR
domain: Schema
status: Active
review_status: Completed
version: 1.0.0
created: 2026-09-30
last_updated: 2026-09-30
authors:
  - Tamga Network Engineering
language: tr
document_type: adr
audience:
  - engineers
tags:
  - adr
  - schema
  - versioning
keywords:
  - development stage
  - schema immutability
  - D1
summary: >
  Beta yayınına kadar belge şemaları yerinde düzeltilir: yanlış ya da eksik bir şema aynı sürüm yolunda güncellenir, eski deneme
  belgeleri geçersiz kalır ve yeniden alınır. Yayımlanmış şemanın değişmezliği (SPEC-SCHEMA-0001/D1) ve küçük sürüm kuralı
  ([[ADR-0010]] K4) beta ile birlikte uygulanmaya başlar. Tek ayar `SCHEMA_STAGE` ile.
related:
  - "[[ADR-0010]]"
  - "[[SPEC-SCHEMA-0001]]"
---

# Bağlam

[[ADR-0010]] ve SPEC-SCHEMA-0001/D1 gereği yayımlanmış bir şema dosyası asla değişmez. Değişiklik yeni sürüm yolu ister; eski
belgeler kendi sürümüyle doğrulanmaya devam eder. Bu kural gerçek kullanıcıların elinde belge varken doğrudur.

Tamga bugün geliştirme evresindedir:

- Uygulamayı ve siteyi kullanan gerçek kişi yoktur.
- Devletler resmî olarak sistemde değildir; AB'de bu yapı üye devletlere zorunlu tutulur, Türkiye'de henüz öyle değildir.
- Şemalar doğrusu bulunana kadar değişecektir (ör. AB eğitim kataloğuna göre eklenen alanlar).

Bu evrede sürüm geçişlerini taşımak iş yükü ve karışıklık üretir. Proje yönetimi, şemaların yanlışsa doğrudan düzeltilmesini ve
sürüm ya da kayıt sistemine belli bir olgunluğa gelince (beta) geçilmesini istedi.

# Karar

## K1 — Geliştirme evresi

`SCHEMA_STAGE = "development"` iken (`packages/schemas`):

- Şema tanımı aynı sürüm yolunda (ör. `1.0.0`) düzeltilir. Derleyici değişen dosyanın üzerine yazar ve uyarı basar.
- Yeni sürüm yolu açılmaz. Güven listesinde tür başına tek geçerli özet bulunur.
- Eski özetle verilmiş deneme belgeleri doğrulamada reddedilir ve yeniden alınır.
- Kırıcı değişiklik (alan adı, anlam) da yerinde yapılabilir. `vct` URN'i yalnız tür gerçekten başka bir şeye dönüşürse değişir.

## K2 — Beta ile geçiş

Beta yayınında `SCHEMA_STAGE = "stable"` yapılır. O andan itibaren:

- SPEC-SCHEMA-0001/D1 (yayımlanmış şema değişmez),
- küçük sürüm kuralı ([[ADR-0010]] K4: aynı `vct`, yeni metadata sürümü, eski özetler geçerli kalır; güven listesinde
  `content_hashes` — okuma tarafı hazır).

Aşamanın değiştirilmesi STATUS ve DECISIONS'a işlenir.

# Değişmezler

| Kod | Kural |
|---|---|
| DS1 | `SCHEMA_STAGE = "development"` yalnız gerçek kullanıcıya belge verilmeyen evrede kullanılır; ilk gerçek kurum ya da kişi belgesinden önce `stable` yapılır. |

# Durum

**Accepted — 2026-09-30.** Proje yönetimi onayıyla. DECISIONS: D-SCHEMA-5.
