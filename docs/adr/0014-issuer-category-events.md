---
document_id: ADR-0014
title: "Etkinlik kategorisi"
status: Active
version: 1.0.0
created: 2026-09-27
last_updated: 2026-10-02
summary: >
  IssuerCategory kapalı kümesine (GOVERNMENT, IDENTITY, EDUCATION, HEALTH, FINANCE, LOGISTICS, OTHER) yalnızca EVENTS
  (etkinlik/bilet satıcısı) eklenir; TRANSPORT ve TELECOM gerçek bir kurum gelene kadar eklenmez. Yeni değer enum'un
  sonuna eklenir (sıra numarası kararlılığı). Bilet satıcısı `bubilet` OTHER'dan EVENTS'e taşınır. Karar DB-23'ü kapatır.
domain: Credentials
---

# Bağlam

`IssuerCategory` bir kurumun sektörünü söyleyen **kapalı kümedir** ([[SPEC-BC-0001]] §3, `@tamga-network/trust`
şeması, `IIssuerRegistry.sol`); küme DECISIONS'ta "nihai" diye kapatılmıştı, bu yüzden genişlemesi ADR ister. D10 (bilet)
ile ilk etkinlik bileti satıcısı (`bubilet`, operatör modeli) [[t:trust-list|güven listesine]] girdi ve uygun kategori olmadığından geçici
olarak `OTHER` aldı. Soru (DB-23, 2026-09-26): yalnızca **EVENTS** mi eklensin, yoksa cüzdanın ekranda zaten etiketini
gösterdiği **TRANSPORT** ve **TELECOM** de mi?

Proje yönetiminin kararı (2026-09-27): bilet [[t:issuer|belge verenleri]] için kategori **etkinlik** olur.

# Karar

1. **K1 — Yalnızca EVENTS eklenir.** Anlamı: etkinlik, konser, spor, sahne, fuar gibi bir olaya giriş hakkı veren
   bilet ya da katılım [[t:credential|belgesi]] ihraç eden kurum (bilet satıcısı, organizatör, mekân). Ulaşım bileti (TRANSPORT) ve operatör
   belgeleri (TELECOM) bu karara girmez; gerçek bir belge veren adayı çıktığında kendi ADR'siyle eklenir.
2. **K2 — Sıra numarası kararlılığı.** Yeni değer enum'un **sonuna** eklenir:
   `{GOVERNMENT, IDENTITY, EDUCATION, HEALTH, FINANCE, LOGISTICS, OTHER, EVENTS}`. Kontrat henüz dağıtılmadı (Faz 0),
   ama sona ekleme kuralı bundan sonraki her genişleme için de geçerlidir (ABI/depolama uyumu).
3. **K3 — Taşıma.** `bubilet` güven listesi kaydı `OTHER` → `EVENTS` (yeni liste sürümü); `event-ticket` [[t:verifier]]
   politikası `allowed_categories: ["EVENTS"]`. Cüzdan etiketi "Etkinlik".
4. **K4 — Şema metadata'sı değişmez.** `urn:tamga:tkt:EventTicket:1` metadata'sındaki `issuer_categories: ["OTHER"]`
   bilgilendiricidir ([[SPEC-SCHEMA-0001]]: bağlayıcı kontrol güven katmanındadır) ve yayınlanmış metadata'nın içerik özeti
   değiştirilemez (D1, `vct#integrity`). Düzeltme bir sonraki şema sürümünde (`EventTicket:2`) yapılır.

# Gerekçe / alternatifler

- **EVENTS + TRANSPORT + TELECOM (reddedildi):** belge vereni olmayan kategori açmak kümeyi spekülatif büyütür; bir
  kategorinin anlamı (ör. ulaşımda kart mı bilet mi, telekomda hat sahipliği mi) ilk gerçek kurumla netleşir.
- **OTHER'da bırakmak (reddedildi):** kaba filtre anlamını yitirir; bilet doğrulayıcısı "diğer" kategorisindeki her kurumu
  kabul etmek zorunda kalır. Asıl kapı yine `vct` + şema yetkisidir, ama kategori ikinci savunma hattıdır.
- **Adlandırma:** ilk öneri `TICKETING` idi; proje yönetiminin önerisiyle `EVENTS` — kategori satış kanalını değil, sektörü anlatır.

# Değişmezler

| # | Değişmez |
|---|---|
| **IC1** | `IssuerCategory` kapalı kümedir; yeni değer yalnızca ADR ile ve enum'un **sonuna** eklenir (sıra numaraları değişmez). |
| **IC2** | Kategori kaba filtredir, yetki değildir: bir belge verenin belgesinin kabulü `vct` + zaman pencereli şema yetkisiyle ([[SPEC-TRUST-0001]]) belirlenir; kategori tek başına kabul sebebi olamaz. |
| **IC3** | Kategori değişikliği yeni bir güven listesi sürümüyle yayınlanır ve belgenin `iat`'ına göre değerlendirilen yetkiyi geriye dönük değiştirmez (D-BC-3). |

# Sonuçlar

- Kod: `@tamga-network/trust` şeması, `IIssuerRegistry.sol`, güven listesi kaynağı (`bubilet`), `apps/verify` politikası,
  cüzdan etiket/ikon eşlemesi (`TICKETING` → `EVENTS`).
- Belgeler: [[SPEC-BC-0001]] (enum), [[SPEC-ID-0002]] (yorum satırı), terimler sözlüğü, DB-23 kapandı.
- Kalan: `EventTicket:2`'de `issuer_categories: ["EVENTS"]` (K4).

# Durum

**Accepted — 2026-09-27.** DECISIONS: D-CAT-1.
