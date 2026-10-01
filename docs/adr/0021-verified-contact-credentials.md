---
document_id: ADR-0021
title: Doğrulanmış İletişim Belgeleri — E-posta Adresi ve Telefon Numarası
category: ADR
domain: Credentials
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
  - relying-parties
  - operators
tags:
  - adr
  - contact
  - email
  - phone
  - eaa
keywords:
  - verified email
  - verified phone number
  - one-time code
  - EmailAddress
  - PhoneNumber
summary: >
  Tamga kimlik servisi, sahipliği tek kullanımlık kodla kanıtlanan e-posta adresi ve telefon numarası için iki yeni belge türü
  verir: `urn:tamga:contact:EmailAddress:1` ve `urn:tamga:contact:PhoneNumber:1`. Nitelikli olmayan EAA; yalnızca SD-JWT VC;
  bir kişi birden çok adres ekleyebilir; Tamga adresi ihraçtan sonra tutmaz. Gönderim sağlayıcıları ayarla seçilir; ayarlı
  değilse tür ilan edilmez.
related:
  - "[[ADR-0010]]"
  - "[[ADR-0011]]"
  - "[[ADR-0013]]"
  - "[[FW-TF-0001]]"
---

# Bağlam

Siteler ve kurumlar bugün kişinin e-posta adresini ya da telefon numarasını kendi kodlarını göndererek doğruluyor: her site ayrı
bir SMS/e-posta maliyeti öder, kişi her kayıtta aynı kodu bekler. Tamga Wallet'ta bu kanıt bir kez alınıp saklanabilir; site
kod göndermek yerine belgeyi ister ([[ADR-0011]] ile aynı "bir kez doğrula, her yerde kullan" ilkesi).

**AB çerçevesi (inceleme, 2026-09-29).** eIDAS 2.0 ve EUDI ARF, e-posta ya da telefon için ayrı bir PID alanı veya tanımlı
attestation türü öngörmez; bu tür bilgiler nitelikli olmayan elektronik attestation (EAA) olarak herhangi bir sağlayıcı
tarafından verilebilir. Tarayıcı dünyasında benzer bir çalışma sürüyor (e-posta doğrulama protokolü taslağı: e-posta
sağlayıcısının imzaladığı SD-JWT ile adres kanıtı). Bu karar o çalışmayla çelişmez; biçim olarak SD-JWT VC ile aynı yoldadır.

# Karar

## K1 — İki belge türü

| vct | Claim | Biçim |
|---|---|---|
| `urn:tamga:contact:EmailAddress:1` | `email` (küçük harfe indirilmiş) | seçici açıklamalı |
| `urn:tamga:contact:PhoneNumber:1` | `phone_number` (E.164, ör. `+905321234567`) | seçici açıklamalı |

Yeni vct alan adı `contact` ([[ADR-0010]] URN biçimi). Metadata katalogda, `#integrity` zorunlu; süre 1 yıl, iptal listesi var.
Bir kişi birden çok adres ekleyebilir; her adres ayrı bir belgedir.

## K2 — Sahiplik kanıtı: tek kullanımlık kod

Akış kimlik belgesiyle aynıdır (OpenID4VCI authorization code + PAR + PKCE + WUA): cüzdan tarayıcıda Tamga kimlik servisini
açar, kişi adresi yazar, 6 haneli kod e-postayla ya da SMS ile gider, doğru kod girilince belge verilir.

- Kod 10 dakika geçerli, en çok 5 deneme; akış başına en çok 3 gönderim, adres başına saatte en çok 5 gönderim.
- Kod yalnızca özet olarak bellekte tutulur; karşılaştırma sabit sürelidir.
- Kimlik ispatı gerekmez: belge yalnızca "bu adres bu cüzdanın elindeydi" der, kişinin kim olduğunu söylemez.

## K3 — Veri ve günlük

- Adres yalnızca akış süresince bellekte tutulur; belge verildikten sonra silinir. Veritabanına yalnızca adresin anahtarlı
  özeti yazılır (aynı adres yeniden kanıtlanınca eski belge iptal edilir).
- Günlüğe adres, numara ya da kod yazılmaz (maskeli bile değil). Ekranda adres yalnızca maskeli gösterilir.

## K4 — Format ve kategori

Yalnızca SD-JWT VC; mdoc temsili verilmez ([[ADR-0013]] kimlik belgesine özgüdür). `category` claim'i yoktur: belge nitelikli
değildir ve kamu kurumu attestation'ı değildir.

## K5 — Gönderim sağlayıcıları

Sağlayıcı ayarla seçilir; hiçbiri ayarlı değilse tür metadata'da ilan edilmez ve istek reddedilir.

| Kanal | Seçenek | Durum |
|---|---|---|
| E-posta | HTTP e-posta API'si (`resend`) | test ve pilot |
| SMS | `email-relay` — SMS metni bir test gelen kutusuna e-postayla | **yalnız test** |
| SMS | yerli SMS sağlayıcısı (`netgsm`, onaylı başlık) | kod hazır, pilot öncesi etkinleştirilmez |
| İkisi | `log` — kod konsola | yalnız yerel geliştirme; canlıda başlatma hatası |

# Değerlendirilen seçenekler

| Seçenek | Sonuç | Neden |
|---|---|---|
| Adresi kimlik belgesine eklemek | ret | Kimlik belgesi kimlik ispatına bağlı; adres sık değişir, birden çok olabilir |
| Tek belgede e-posta + telefon | ret | Ayrı kanıtlar, ayrı yaşam döngüsü; kişi yalnızca birini gösterebilmeli |
| Kimlik ispatını önkoşul yapmak | ret | Gereksiz veri; sahiplik kanıtı kimlikten bağımsız |
| Kodu cüzdanda girmek | sonraya | Tarayıcı akışı kimlik belgesiyle ortak; uygulama içi ekran ürün aşamasında |

# Değişmezler

| Kod | Kural |
|---|---|
| CT1 | İletişim belgesi yalnızca kod doğru girildikten sonra verilir; kod tek kullanımlık, süreli ve deneme sınırlıdır. |
| CT2 | Adres, numara ve kod günlüğe, olay kaydına ya da veritabanına düz yazılmaz; yalnızca anahtarlı özet saklanır. |
| CT3 | İletişim belgesi kimlik bilgisi (ad, TCKN, doğum tarihi) taşımaz ve `category` claim'i içermez. |
| CT4 | Test gönderim yolları (`log`, `email-relay`) gerçek kullanıcıya açık ortamda kullanılmaz. |

# Sonuçlar

- `packages/schemas`: iki tür (EmailAddress 1.0.0, PhoneNumber 1.0.0). Güven listesi: Tamga kimlik servisi iki tür için yetkili.
- `tamga-platform/apps/id`: adres + kod ekranları (İngilizce / Türkçe), gönderim sağlayıcıları, sınırlar; ayarlar
  `TAMGA_CONTACT_*`, `TAMGA_RESEND_API_KEY`, `TAMGA_NETGSM_*`.
- Cüzdan: Belgeler → "Belge ekle" menüsünde doğrulanmış e-posta / telefon ekle; belge adları ve alan etiketleri sözlükte.
- Kurum ADR'si (yetkili kaynak kurumdadır, [[ADR-0020]]) teklif e-postasını kurumun göndermesini öngörür; iletişim
  belgesi, kurumun kişiye ulaşacağı adresi kişinin kendisinin sunmasını sağlar.

# Durum

**Accepted — 2026-09-29.** Adlar ve kapsam proje yönetimince onaylandı. DECISIONS: D-CONTACT-1.
