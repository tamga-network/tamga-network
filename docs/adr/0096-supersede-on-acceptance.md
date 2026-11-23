---
document_id: ADR-0096
title: "Kimlik belgesi yenilenince eski kaydın iptali, yeni belgenin cüzdana eklendiği bildirilince"
status: Proposed
review_status: Draft
version: 0.1.0
created: 2026-11-23
last_updated: 2026-11-23
summary: >
  Bugün kimlik servisi aynı kimlik kartı ya da pasaport için yeni bir kimlik belgesi verdiği anda önceki etkin kaydı (ve ona bağlı
  sürücü belgesi bilgisini, ADR-0039) iptal eder. Kişi cüzdanın önizlemesinde "Ekleme" derse yeni belge silinir, eskisi de
  geçersiz olmuştur. Öneri: kimlik servisi OpenID4VCI bildirim ucunu (notification endpoint) açar; önceki kayıt yalnız cüzdan
  "eklendi" (credential_accepted) bildirince iptal edilir; "silindi" ya da "başarısız" bildirilirse yeni kayıt iptal edilir, eskisi
  kalır. Bildirim gelmezse önceki kayıt 24 saat sonra bugünkü gibi iptal edilir. Uygulama mağazaya çıkıştan önce.
domain: Identity
related: ["[[ADR-0039]]", "[[ADR-0059]]", "[[SPEC-PROTO-0001]]", "[[SPEC-ID-0003]]", "[[SPEC-WALLET-0001]]"]
---

# Kısaca

Kimlik belgesi yenilenince eski kayıt, yeni belge cüzdana gerçekten eklendiğinde iptal edilsin. Cüzdan bunu standart OpenID4VCI
bildirimiyle söyler. Bildirim hiç gelmezse süre sınırlıdır: 24 saat sonra bugünkü kural uygulanır.

# Bağlam

Kimlik servisi aynı belge (aynı belge özeti, `doc_hash`) için tek etkin kimlik kaydı tutar: yeni kayıt verildiği anda önceki etkin
kayıt `re-issuance` nedeniyle iptal edilir; önceki kimliğe bağlı sürücü belgesi bilgisi de iptal olur (ADR-0039). Cüzdan ise belgeyi
saklamadan önce kişiye önizleme gösterir (ISSU_11) ve kişi "Ekleme" diyebilir; o zaman yeni belge ve anahtarları silinir. Sonuç:
kişi yeni belgeyi reddettiğinde eski belgesi de geçersiz olmuştur. Cüzdanın metni bunu 2026-11-23'ten beri açıkça söyler (geçici
çözüm). Proje yönetiminin yönü: eski kaydın iptali, kişinin yeni belgeyi kabul ettiği ana ertelensin.

OpenID4VCI 1.0 bu durum için bildirim ucunu tanımlar: belge yanıtı `notification_id` taşır; cüzdan belgeyi sakladıktan ya da
sakladıktan vazgeçtikten sonra aynı erişim belirteciyle `credential_accepted`, `credential_deleted` ya da `credential_failure`
gönderir.

# Önerilen karar

- **K1 — Bildirim ucu.** Kimlik servisi meta verisinde `notification_endpoint` yayımlar; kimlik belgesi yanıtı `notification_id`
  taşır (bir verme işleminin bütün kopyaları için tek kimlik). İstek, belgeyi alan erişim belirteciyle ve aynı DPoP anahtarıyla
  kimlik doğrulanır; başka belirteçle ya da başka kayda ait `notification_id` ile gelen istek reddedilir. Bildirim tek kez işlenir.
- **K2 — Önceki kaydın iptali kabule bağlanır.** Yeni kayıt verilince önceki etkin kayıt hemen iptal edilmez; "devralma bekliyor"
  olarak işaretlenir. `credential_accepted` gelince önceki kayıt `re-issuance` nedeniyle iptal edilir (ADR-0039'daki bağlı sürücü
  belgesi bilgisi de aynı anda).
- **K3 — Reddedilen yeni kayıt.** `credential_deleted` ya da `credential_failure` gelince yeni kayıt iptal edilir (neden:
  `holder-declined`); önceki kayıt etkin kalır.
- **K4 — Bildirim gelmezse.** 24 saat içinde bildirim gelmezse önceki kayıt bugünkü gibi iptal edilir. Böylece aynı belge için iki
  etkin kayıt en çok 24 saat yan yana durur; tek etkin kayıt kuralı bu süreyle sınırlı olarak gevşer.
- **K5 — Cüzdan.** Cüzdan, belge yanıtında `notification_id` varsa önizleme kararından sonra bildirimi gönderir: saklandıysa
  `credential_accepted`, "Ekleme" ya da kopya uyuşmazlığında `credential_deleted`. Bildirim gönderilemezse yeniden denenir; belge
  saklama sonucu bildirime bağlı değildir.
- **K6 — Kapsam.** Yalnız kimlik servisinin kimlik belgesi. Kurumların belgeleri bu karardan etkilenmez.

# Gerekçe / alternatifler

| Seçenek | Durum | Neden |
|---|---|---|
| Bugünkü kural + açık metin | geçici | Kişi bilgilendirilir ama yeni belgeyi reddeden kişi eski belgesini kaybeder |
| Bildirim ucu, kabulde iptal (bu öneri) | önerildi | Standart OpenID4VCI aracı; kişinin kararı sunucuya ulaşır; süre sınırı tek etkin kayıt kuralını korur |
| Bildirim gelmezse eski kaydı hiç iptal etmemek | ret | Saldırgan bildirim göndermeyerek aynı belge için iki etkin kayıt tutabilirdi |
| Bildirim gelmezse yeni kaydı iptal etmek | ret | Belgeyi saklayıp çevrimdışı kalan kişinin yeni belgesi geçersiz olurdu |

# Önerilen kurallar (kabul edilirse bağlayıcı tabloya taşınır)

| Kod | Kural |
|---|---|
| SA1 | Kimlik belgesi yenilenince önceki etkin kayıt yalnız `credential_accepted` bildirimiyle ya da 24 saatlik süre dolunca iptal edilir. |
| SA2 | Bildirim yalnız belgeyi alan erişim belirteci ve DPoP anahtarıyla kabul edilir; tek kez işlenir. |
| SA3 | `credential_deleted` / `credential_failure` yeni kaydı iptal eder, önceki kaydı etkin bırakır. |

# Durum

**Proposed — 2026-11-23.** Kontrol bulgusu (yeni belgeyi reddetmek eski kimliği iptal ettiriyor) üzerine yazıldı; proje yönetimi
yönü onayladı, kural ayrıntıları kabul bekliyor. Uygulama: kimlik servisi (bildirim ucu, devralma bekleyen kayıt, 24 saat işi),
cüzdan çekirdeği (bildirim gönderme) ve cüzdan (sonraki paket sürümüyle). Mağazaya çıkıştan önce.
