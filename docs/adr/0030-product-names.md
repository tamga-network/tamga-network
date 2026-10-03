---
document_id: ADR-0030
title: "Ürün adları"
status: Active
version: 1.0.0
created: 2026-09-30
last_updated: 2026-10-02
summary: >
  Kullanıcıya görünen ürün adları sabitlenir: cüzdan uygulaması Tamga Wallet, web sitesi girişi "Tamga ile giriş yap"
  (Sign in with Tamga), barındırılan doğrulayıcı Tamga Verify. "TamgaID" ürün adı olarak kullanılmaz. D-OSS-2'deki "kullanıcıya
  görünen marka (TamgaID ile Giriş Yap) değişmez" cümlesinin yerini alır.
domain: Governance
---

# Bağlam

D-OSS-2 (2026-09-27) npm kapsamını `@tamga-network` olarak belirlerken kullanıcıya görünen markayı "TamgaID ile Giriş Yap" diye
anıyordu. Aynı ad sitede cüzdanın adı olarak da geçiyordu. Oysa:

- Cüzdan uygulamasının adı başından beri **Tamga Wallet**'tır (mağaza adı, paket kimliği `network.tamga.wallet`).
- `id.tamga.network` ve `tamga-id` kiracısı ayrı bir hizmettir: geçici kimlik [[t:attestation]] servisi ([[ADR-0011]]).
- Cüzdan yalnız kimlik taşımaz: kurum belgeleri, biletler ve ileride ödeme ve varlık tutma gibi işlevler de aynı uygulamada
  olabilir. Ürüne "ID" demek onu kimlikle sınırlar.

Tek bir adın üç ayrı şeye (cüzdan, giriş, kimlik servisi) karşılık gelmesi kullanıcıyı ve kurumları karıştırır.

# Karar

Kullanıcıya görünen üç ürün adı sabitlenir: cüzdan **Tamga Wallet**, web girişi **"Tamga ile giriş yap"**, barındırılan
[[t:verifier]] **Tamga Verify**. "TamgaID" ürün adı olarak kullanılmaz.

# Değişmezler

| Kod | Kural |
|---|---|
| PN1 | Cüzdan uygulamasının adı her yerde **Tamga Wallet**'tır (tk: Tamga Wallet). |
| PN2 | Web sitesi giriş düğmesi ve akışı **"Tamga ile giriş yap"** / "Tamga ile kayıt ol" (en "Sign in with Tamga" / "Sign up with Tamga"; tk "Tamga bilen gir" / "Tamga bilen hasaba dur"). Düğmenin görünümü marka sayfasındadır (`tamga.network/brand`). |
| PN3 | Barındırılan doğrulayıcının (aracı doğrulayıcı, [[ADR-0017]]; `verify.tamga.network`) adı **Tamga Verify**'dır. |
| PN4 | "TamgaID" ürün adı olarak kullanılmaz. Kod ve veri tanımlayıcıları (`tamga-id` kiracısı, `id.tamga.network`, `urn:tamga:id:*`) değişmez; bunlar ad değil adrestir. |

# Gerekçe / alternatifler

| Seçenek | Sonuç | Neden |
|---|---|---|
| Cüzdanın adını TamgaID yapmak | ret | "Tamga ile giriş" için kulağa hoş gelir, ama cüzdanın ödeme ve varlık işlevleri gelince ad anlamsız kalır. |
| "TamgaID ile giriş yap", cüzdan Tamga Wallet | ret | Aynı ürüne iki ad; kimlik servisiyle karışır. |
| **Cüzdan Tamga Wallet, giriş "Tamga ile giriş yap", doğrulayıcı Tamga Verify** | **kabul** | Tek ürün tek ad; giriş düğmesi markayı taşır, ürünü sınırlamaz. |

# Sonuçlar

- Site, belgeler, verify sayfaları, örnekler ve sözlükte "TamgaID" kullanılmaz.
- D-OSS-2'deki marka cümlesi bu ADR ile değişir (DECISIONS §9b).
- Paket adları değişmez (`@tamga-network/verifier`, `/web`).

# Durum

**Accepted — 2026-09-30.** Proje yönetimi onayıyla.
