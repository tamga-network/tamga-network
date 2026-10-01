---
document_id: ADR-0023
title: Otomatik Kopya Yenileme — Yenileme Belirteciyle, Eşikte ve Rastgele Gecikmeyle
category: ADR
domain: Wallet
status: Active
review_status: Completed
version: 1.0.0
created: 2026-09-29
last_updated: 2026-09-29
authors:
  - Tamga Network Engineering
language: tr
document_type: adr
audience:
  - engineers
  - institutions
tags:
  - adr
  - wallet
  - batch-issuance
  - privacy
keywords:
  - automatic re-issuance
  - refresh token
  - credential_reuse_policy
  - unlinkability
summary: >
  Cüzdan, kopyaları azalan ya da süresi bitmek üzere olan kurum belgelerini kullanıcıya sormadan yeniler: OpenID4VCI yenileme
  belirteci (DPoP'a ve cüzdan onayına bağlı, tek kullanımlık, döndürülen), kurumun ilan ettiği eşiklerde (credential_reuse_policy),
  uygulama öndeyken ve rastgele gecikmeyle. Kişi alanlarını tutmayan kimlik ve iletişim belgelerinde yenileme kullanıcı eylemi
  olarak kalır. SPEC-WALLET-0001/WL7 değişir (ARF ISSU_42, ISSU_45, ISSU_63).
related:
  - "[[ADR-0011]]"
  - "[[ADR-0021]]"
  - "[[SPEC-WALLET-0001]]"
  - "[[SPEC-PROTO-0001]]"
  - "[[SPEC-SCHEMA-0002]]"
---

# Bağlam

[[SPEC-WALLET-0001]]/WL7 "otomatik yenileme yoktur" der. Gerekçe: cüzdan arka planda kuruma giderse kurum belgenin ne sıklıkta
kullanıldığını öğrenir ([[SPEC-SCHEMA-0002]] §2.1).

AB ARF 3.0 ters yönde: yeniden ihraç **mümkün olduğunca kullanıcı eylemi gerektirmemeli** (ISSU_42). Tek kullanımlık paket
yönteminde cüzdan, alt eşiğe inince yeni paket istemeli (ISSU_45). Cüzdan ve kurum, OpenID4VCI'nin yeniden ihraç özelliklerini
desteklemeli (ISSU_63).

Tamga kurumları eşikleri 2026-09-29'dan beri metadata'da ilan ediyor (`credential_reuse_policy`: 10'luk paket, 2 kopya kalınca,
süre bitimine 7 gün kala). Proje yönetimi AB ile aynı davranışı onayladı.

Kısıt: sessiz yenileme, kurumun kullanıcıya sormadan yeniden imza atabilmesini gerektirir.
- **Kurum belgeleri** (öğrenci, diploma): kurum öznitelikleri kendi yetkili kaynağından yeniden okur.
- **Kimlik belgesi** ([[ADR-0011]] K4) ve **iletişim belgeleri** ([[ADR-0021]] K3): servis, kişi alanlarını ihraçtan sonra tutmaz.
  Bunları sessizce yenilemek, kişi verisini saklamayı gerektirirdi. Bu yüzden kapsam dışıdır.

# Karar

## K1 — Ne zaman

Cüzdan bir kurum belgesini şu durumlardan biri gerçekleşince yeniler:
- kullanılmamış kopya sayısı kurumun `reissue_trigger_unused` değerine indi (Tamga: 2),
- belgenin bitişine `reissue_trigger_lifetime_left` kadar süre kaldı (Tamga: 7 gün).

Yenileme yalnız şu koşullar birlikteyken yapılır: uygulama önde, kilit açık, ağ var. Eşik aşıldıktan sonra **rastgele bir gecikme**
(0–6 saat) beklenir; böylece yenileme anı bir sunumun anına bağlanamaz.

## K2 — Nasıl: yenileme belirteci

- Kurum, ilk ihraçta token yanıtında bir `refresh_token` verir (OpenID4VCI 1.0, RFC 6749 §6).
- Belirteç o belge için üretilen **DPoP anahtarına bağlıdır** (RFC 9449 §5). Cüzdan bu anahtarı belge ömrü boyunca saklar; her
  mantıksal belgenin anahtarı ayrıdır.
- Her yenilemede cüzdan onayı (WUA) yeniden sunulur.
- Belirteç tek kullanımlıktır ve her kullanımda yenisiyle değişir (rotation). Ömrü belgenin azami geçerliliğini aşmaz.
- Yenileme sonunda yeni bir paket (10 kopya, yeni anahtarlar) alınır; eski kullanılmamış kopyalar silinir.

## K3 — Kurum ne yapar

- Öznitelikleri yetkili kaynaktan **yeniden okur**. Değişen alan varsa cüzdan kullanıcıya gösterir (ARF ISSU_59).
- Kaynakta kayıt artık yoksa (mezuniyet, kayıt silme) yenileme reddedilir ve belirteç iptal edilir.
- Yeni paketin geçerlilik süresi türün kuralına göredir (öğrenci belgesi ≤ 90 gün). Böylece öğrenci belgesi, öğrencilik sürdükçe
  kendiliğinden tazelenir.

## K4 — Kapsam dışı: kimlik ve iletişim belgeleri, biletler

Kimlik ve iletişim belgeleri yenileme belirteci almaz. Yenilemeleri kullanıcı eylemiyle olur (kimliği ya da adresi yeniden
doğrulamak). Biletler tek kullanımlıktır, yenilenmez. Cüzdan bu belgelerde kopya azalınca bugünkü gibi uyarır.

## K5 — Kullanıcı ayarı

Ayarlar'da "Kopyaları otomatik yenile" seçeneği bulunur. Varsayılan açıktır. Kapatılırsa bugünkü davranış (uyarı + elle yenileme)
geçerlidir.

## K6 — Mahremiyet dengesi

Kalıntı risk: kurum, yenileme sıklığından belgenin kaç **yeni** doğrulayıcıya gösterildiğini kabaca çıkarabilir (her 8 yeni
doğrulayıcıda bir istek). Azaltımlar:
- aynı doğrulayıcıya aynı kopya (WL5); tekrar sunumlar kopya tüketmez,
- rastgele gecikme,
- yenileme isteği hangi doğrulayıcıya sunulduğunu içermez,
- kullanıcı ayarı.

Bu, AB modeliyle aynı dengedir. Proje yönetimi kabul etti.

# Değerlendirilen seçenekler

| Seçenek | Sonuç | Neden |
|---|---|---|
| Otomatik yenileme yok (WL7 olduğu gibi) | ret | ARF ISSU_42/45 ile çelişir; kullanıcı kopya bitince yeni doğrulayıcıya belge gösteremez |
| Yeni kimlik sunumuyla sessiz yenileme | ret | Her yenilemede kimlik sunumu = kullanıcı onayı ve PIN; sessiz olamaz |
| Kimlik servisi kişi alanlarını şifreli saklar | ret | ADR-0011 K4 ve veri azaltımı ilkesiyle çelişir |
| **Yenileme belirteci (DPoP + WUA bağlı)** | **kabul** | OpenID4VCI'nin standart yolu; kurum yetkili kaynağa yeniden sorar |

# Değişmezler

| Kod | Kural |
|---|---|
| AR1 | Sessiz yenileme yalnız yenileme belirteci olan belgeler için, kurumun ilan ettiği eşikte, uygulama önde ve kilit açıkken ve rastgele gecikmeyle yapılır. |
| AR2 | Yenileme belirteci belgeye özel DPoP anahtarına bağlıdır, tek kullanımlıktır ve her kullanımda değişir; her yenilemede cüzdan onayı doğrulanır. |
| AR3 | Kurum yenilemede öznitelikleri yetkili kaynaktan yeniden okur; kaynakta kayıt yoksa belge verilmez ve belirteç iptal edilir. |
| AR4 | Kişi alanlarını saklamayan servisler (kimlik, iletişim) yenileme belirteci vermez. |

# Sonuçlar

- [[SPEC-WALLET-0001]]/WL7 yeniden ifade edilir: "Kullanıcı eylemi olmadan yenileme yalnızca AR1–AR4 koşullarında yapılır."
- [[SPEC-PROTO-0001]]: token ucu `refresh_token` (kurum issuer'ı); `grant_type=refresh_token` (DPoP + WUA); belirteç iptali.
- `tamga-platform/apps/issuer`: yenileme belirteci deposu (özet olarak), yetkili kaynaktan yeniden okuma.
- `wallet-core`: belge başına DPoP anahtarı + yenileme belirteci saklama; eşik denetimi. Cüzdan: arka plan yenileme, ayar,
  değişen alan bildirimi.

# Durum

**Accepted — 2026-09-29.** Proje yönetimi onayıyla. DECISIONS: D-WALLET-1. Uygulama sırada.
