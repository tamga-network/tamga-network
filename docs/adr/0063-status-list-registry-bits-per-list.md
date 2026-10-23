---
document_id: ADR-0063
title: "Zincirdeki iptal listesi kaydı listenin kendi bit sayısını kabul eder"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-23
last_updated: 2026-10-23
summary: >
  Zincirdeki iptal listesi çapa kontratı (`StatusListRegistry`) bugüne kadar yalnız `bitsPerEntry = 2` kabul ediyordu; ADR-0048
  ise bit sayısını belge türüne bağladı (kimlik servisinin türleri 1, kurum listeleri 2). Zincir imzalı listelerin projeksiyonu
  olduğundan (ADR-0051) kontrat listenin kendi `bits` değerini kabul eder: IETF Token Status List'in izin verdiği 1, 2, 4 ya da 8.
  Değer kayıtta bir kez yazılır, değişmez ve kayıt olayında yayılır. Kontrat belge türünü bilmez; zincire tür, şema ya da bit
  içeriği yazılmaz. Tamga profili (1 ya da 2) yayıncıda ve doğrulayıcıda kalır. SPEC-BC-0001 L3'ü değiştirir. Üretim zinciri
  yoktur (ADR-0009 K4); değişiklik yerel geliştirme ve test zincirinde. Kabul: 2026-10-23.
domain: Trust
related: ["[[ADR-0008]]", "[[ADR-0009]]", "[[ADR-0048]]", "[[ADR-0051]]", "[[SPEC-BC-0001]]", "[[SPEC-CRED-0003]]"]
---

# Kısaca

Kimlik servisinin iptal listeleri 1 bitlik, kurum listeleri 2 bitliktir. Zincirdeki kayıt kontratı ise yalnız 2 biti kabul
ediyordu; kimlik listeleri zincire hiç kaydedilemezdi. Artık kontrat, listenin kendi bit sayısını (standardın izin verdiği 1, 2,
4 ya da 8) kaydeder. Zincire yine yalnız listenin adresi, özeti, sürümü ve boyutu gider; kişisel veri yoktur.

# Bağlam

- **ADR-0048 K1–K2.** İptal listelerinde bit sayısı türe göredir: kimlik servisinin türleri (kimlik belgesi, sürücü belgesi
  bilgisi, iletişim belgeleri) `bits = 1`, kurum listeleri `bits = 2` ([[SPEC-CRED-0003]] §3.3). Paketler 0.6.0'dan beri böyle
  yayımlar.
- **Kontrat.** `StatusListRegistry.registerList` `bitsPerEntry != REQUIRED_BITS (2)` olan listeyi `InvalidBitsPerEntry` ile
  reddediyordu ([[SPEC-BC-0001]] §7, L3 "`bitsPerEntry == 2`"). Faz 0'da liste geçmişi kontratlara aktarılınca ([[ADR-0009]] K7)
  kimlik servisinin listeleri kaydedilemezdi.
- **Zincir projeksiyondur** ([[ADR-0051]]): kaynak imzalı listedir, zincir onu izler. Kontratın kendi kuralıyla imzalı listeden
  farklı bir bit sayısı dayatması bu ilkeye aykırıdır.
- **Standart.** IETF Token Status List `bits` için 1, 2, 4 ve 8'e izin verir. Ağ ileride başka devletlerin belge verenlerini de
  taşıyacaktır (TDT-first); kontrat Tamga profilinin bugünkü iki değerine kilitlenmemelidir.

# Karar

## K1 — Listenin kendi bit sayısı

- `registerList` `bitsPerEntry` olarak **1, 2, 4 ya da 8** kabul eder; diğer her değer `InvalidBitsPerEntry` ile reddedilir.
  `REQUIRED_BITS` sabiti kalkar; yerine saf okuma `isAllowedBits(uint8)` gelir.
- Değer, kaydedilen listenin imzalı belirtecindeki `status_list.bits` ile aynıdır. Kayıtta bir kez yazılır; `publishList` bit
  sayısı almaz, yeni sürüm bit sayısını değiştiremez (bit sayısı değişecekse yeni liste açılır, S9).
- `ListRegistered` olayı bit sayısını da taşır: `ListRegistered(listId, issuerId, listURI, listSize, bitsPerEntry)`.

## K2 — Tür bilgisi zincire gitmez

- Kontrat belge türünü, şemayı ya da `suspension_allowed`'ı bilmez ve sormaz. "Kimlik servisinin listesi 1 bit olmalı" kuralı
  ([[ADR-0048]]/SU1) yayıncının ve doğrulayıcının kuralıdır; zincir yalnız listenin kendini nasıl tanımladığını kaydeder.
- Zincirde iptal biti, indeks, belge özeti ya da kişisel veri yoktur ([[ADR-0008]], DP1); bu karar bunu değiştirmez.

## K3 — Projeksiyon ve doğrulama

- Liste yayıncısının projeksiyon modülü, kayıt parametrelerini imzalı belirteçten çıkarır (`statusListRegistrationOf`: `sub` →
  adres, `status_list.bits` → bit sayısı, açılmış bayt × 8 / bits → kapasite, `sha256(jws)` → özet). Standart dışı bit sayısı
  hatadır.
- Tamga profili değişmez: Tamga yayıncıları yalnız 1 ya da 2 yayımlar, Tamga doğrulayıcısı yalnız bunları okur
  ([[SPEC-CRED-0003]] §3.3). Kontratın 4 ve 8'i kabul etmesi Tamga profiline yeni değer eklemez.

## K4 — Uygulama

- `contracts/src/revocation/StatusListRegistry.sol`, `IStatusListRegistry.sol`, kontrat testleri; `apps/trust-publisher` projeksiyon
  yardımcısı ve testi. Depolama düzeni değişmez (sabit depolamada yer tutmaz). Üretim zinciri yoktur ([[ADR-0009]] K4); değişiklik
  yerel geliştirme ve test zincirinde geçerlidir; geliştirme evresi kuralı gereği geçiş kodu yoktur ([[ADR-0029]]).

# Değerlendirilen seçenekler

| Seçenek | Sonuç | Neden |
|---|---|---|
| `REQUIRED_BITS = 2` kalsın, kimlik listeleri zincire kaydedilmesin | ret | Projeksiyon eksik kalır; kimlik listeleri Faz 0'da çapasız olur |
| Yalnız 1 ve 2 kabul (Tamga profili) | ret | Profil kuralı yayıncıda ve doğrulayıcıda; kontrat ağın başka devletlerine de hizmet eder, standart 1, 2, 4, 8 der |
| Bit sayısını belge türüne göre kontratta denetlemek | ret | Zincire tür bilgisi taşır; kontrat şema ile liste arasında bağ kuramaz (liste tür başına ayrı, ama tür adı zincirde yok) |
| **Listenin kendi bit sayısı, standardın kümesi içinde** | **seçildi** | Zincir imzalı listeyi izler; kayıt değişmez; kişisel veri yok |

# Değişmezler

| Kod | Kural |
|---|---|
| BL1 | Zincirdeki iptal listesi kaydı listenin kendi `bits` değerini tutar; değer 1, 2, 4 ya da 8'dir, kayıtta bir kez yazılır ve listenin ömrü boyunca değişmez. |
| BL2 | İptal listesi kaydına belge türü, şema, iptal biti ya da kişisel veri yazılmaz; türe göre bit kuralı yayıncıda ve doğrulayıcıda uygulanır. |

# Sonuçlar

- [[SPEC-BC-0001]] §7.1 (`bitsPerEntry` açıklaması, `isAllowedBits`), §7.4 ve §13 L3; [[SPEC-CRED-0003]] §4 kontrat arayüzü.
- Kod: `contracts/`, `apps/trust-publisher/src/chain/projection.ts`.

# Durum

**Accepted — 2026-10-23.** Proje yönetiminin genel uyum onayı kapsamında ("AB standartlarına uyumlu olalım, eksiklerimizi
giderelim, olması gerektiği gibi yapalım"): kontratı [[ADR-0048]] ve [[ADR-0051]] ile tutarlı kılan düzeltme. DECISIONS: D-BC-11.
[[SPEC-BC-0001]] L3'ü değiştirir; BL1–BL2 bağlayıcıdır.
