---
document_id: ADR-0072
title: "Değer katmanı askıda: ADR-0003 kancaları araştırma yönü"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-30
last_updated: 2026-10-30
summary: >
  ADR-0003'ün değer katmanı kancaları (akıllı kontrat hesabı, ayrık anahtar alanları ve varlık kurtarması, kapsam-genel
  delegasyon, credential-gating, token kuralı) bağlayıcı olmaktan çıkar ve "araştırma yönü" olarak askıya alınır. Ağ token
  ihraç etmez, ödeme ya da değer aktarımı işlemez; zincir kodu yalnız imzalı listelerin projeksiyonudur (ADR-0051). Değer katmanının
  yeniden açılması yönetişim kurumunun kararını, bağımsız güvenlik incelemesini ve yeni bir ADR'yi ister. Kabul: 2026-10-30.
domain: Governance
related: ["[[ADR-0003]]", "[[ADR-0008]]", "[[ADR-0037]]", "[[ADR-0051]]", "[[ADR-0071]]"]
---

# Kısaca

Tamga Network bir güven ağıdır; para, token ya da ödeme işi yapmaz. Eskiden "ileride değer katmanı" için alınmış beş tasarım kararı
artık bağlayıcı değil; yalnız ileride araştırılabilecek bir yön olarak kayıtta duruyor.

# Bağlam

- [[ADR-0003]] (2026-08-06) yetkilendirme/değer katmanı için beş bağlayıcı kanca koymuştu: zincir hesabı akıllı kontrat cüzdanı,
  ayrık anahtar alanları ve kullanıcı seçimli varlık kurtarması, kapsam-genel delegasyon kaydı, genel credential-gating primitifi,
  kendi token yok ama FINANCE izin listesine bağlı token ihracı. Karar 4 2026-09-10'da daraltıldı ([[ADR-0008]]: zincir iptali göremez).
- Sonraki kararlar ağın biçimini değiştirdi: ağ yalnız ağdır, hizmet satmaz ([[ADR-0037]]); zincir imzalı listelerin
  projeksiyonudur ([[ADR-0051]]); ağ kâr amacı gütmeyen bir vakıf olacak ve ücret almaz ([[ADR-0071]]). Kamuya açık metinler (teknik
  rapor, senaryolar) değer katmanını zaten "araştırma yönü" olarak anıyordu; ADR-0003 ise hâlâ Active görünüyordu.
- Proje yönetiminin yönü: ADR-0003 "askıda — araştırma yönü" olarak işaretlensin.

# Karar

## K1 — Askı
[[ADR-0003]]'ün beş kancası ve onlara dayanan kararlar (D-AUTH-0…5, D-STR-1/2'nin değer katmanı kısmı) bağlayıcı olmaktan çıkar ve
araştırma yönü olarak askıya alınır. ADR-0003 silinmez; durumu bu ADR'ye işaret eder (belge standardındaki sözcükle `Superseded`).

## K2 — Bugünkü sınır
Ağ token ihraç etmez; ödeme, mutabakat ya da değer aktarımı işlemez; zincir kodu yalnız imzalı listelerin projeksiyonudur
([[ADR-0051]]) ve değer katmanı primitiflerini (akıllı hesap, delegasyon, credential-gating, token izin listesi) gerektirmez.
Depoda bu yönde kalmış kontrat taslakları prototiptir; üretimde açılmaz.

## K3 — Yeniden açılma
Değer katmanı ancak yönetişim kurumunun (vakıf / konsey) kararı, gizlilik araştırması (işlem grafiği), bağımsız güvenlik incelemesi
ve yeni bir ADR ile yeniden açılır.

## K4 — Dil
Kamuya açık metinlerde değer katmanı yalnız "araştırma yönü" olarak, ilk sürümün ve pilotun parçası olmadığı açıkça yazılarak anılır.

# Değerlendirilen seçenekler

| Seçenek | Sonuç | Neden |
|---|---|---|
| ADR-0003'ü olduğu gibi bırakmak | ret | Kâr amacı gütmeyen ağ, ücretsiz model ve projeksiyon zinciriyle çelişen Active karar |
| ADR-0003'ü tümüyle geri çekmek | ret | Araştırma birikimi korunmalı; yön ileride yeniden değerlendirilebilir |
| **Askıya almak: araştırma yönü, yeniden açılma koşullu** | **seçildi** | Bugünkü kararlarla tutarlı; birikim kayıtta kalır |

# Değişmezler

| Kod | Kural |
|---|---|
| VL1 | Ağ token ihraç etmez; ödeme, mutabakat ya da değer aktarımı işlemez; değer katmanı yönetişim kurumunun kararı, bağımsız güvenlik incelemesi ve yeni bir ADR olmadan açılmaz. |

# Sonuçlar

- [[ADR-0003]]: durum `Superseded` (askıda — araştırma yönü), başına bu ADR'ye işaret eden not.
- Kod değişikliği yok; kamuya açık metinler zaten "araştırma yönü" diyor.

# Durum

**Accepted — 2026-10-30.** Proje yönetiminin onayıyla (birebir alıntı özel onay kaydında). DECISIONS: D-AUTH-6. VL1 bağlayıcıdır.
