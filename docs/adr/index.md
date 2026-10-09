---
title: Mimari Karar Kayıtları (ADR)
---

# Mimari karar kayıtları (ADR)

Bir ADR, Tamga Network'te verilmiş ve bağlayıcı hâle gelmiş bir kararın kalıcı kaydıdır: hangi sorun vardı, hangi
seçenekler değerlendirildi, ne karar verildi ve bunun sonuçları neler. Kapatılmış bir karar ancak yeni bir ADR ile
değişir; eski kayıt silinmez, "yerini aldı" olarak işaretlenir.

<AdrTable />

## Bir ADR'nin yapısı

| Bölüm | İçerik |
|---|---|
| Bağlam | Kararı gerektiren durum ve kısıtlar |
| Karar | Numaralı karar maddeleri (K1, K2, …) |
| Değerlendirilen seçenekler | Alternatifler, artıları ve eksileri, neden seçilmedikleri |
| Sonuçlar | Etkilenen belgeler, kod ve işletim |
| Değişmezler | Karardan doğan bağlayıcı kurallar (ör. `ADR-0017/HV1`); [bağlayıcı kurallar sayfasına](/rules) işlenir |
| Durum | Öneri → Kabul edildi → (gerekirse) Yerini aldı; kabul tarihi |

## Süreç

1. Öneri olarak yazılır (durum: Öneri).
2. Proje yönetimi kabul eder; tarih kaydedilir ve karar bir `D-*` kodu alır.
3. Etkilenen spesifikasyonlar ve [Tamga ARF](https://arf.tamga.network/tr/) belgeleri aynı çalışmada güncellenir.
