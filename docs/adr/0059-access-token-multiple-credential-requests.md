---
document_id: ADR-0059
title: "Erişim belirteci ömrü içinde birden çok belge isteği"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-21
last_updated: 2026-10-21
summary: >
  Belge verenin erişim belirteci artık tek kullanımlık değil: kısa ömrü (≤ 5 dakika, PR9) içinde birden çok belge isteğinde
  kullanılabilir — OpenID4VCI 1.0 §8'in izin verdiği ve AB referans belge vereninin yaptığı gibi. Sınırlar: yalnız belirtecin
  kapsadığı belge yapılandırması, belirteç başına toplam kopya ≤ toplu ihraç büyüklüğü (10), her istek belirtecin bağlı olduğu DPoP
  anahtarıyla. Kimlik servisinde aynı belirteçle sonraki istek ilk isteğin kaydına kopya ekler, önceki paketi iptal etmez; kişi
  alanları belirtecin ömrü bitince ya da kopya hakkı dolunca silinir. ZK kopyası belirteci ve bilet tek paket kalır. Kabul:
  2026-10-21.
domain: Protocol
related: ["[[SPEC-PROTO-0001]]", "[[ADR-0011]]", "[[ADR-0031]]", "[[ADR-0044]]"]
---

# Bağlam

- **Standart.** OpenID4VCI 1.0 §8: belge isteği erişim belirteciyle yapılır; aynı belirteçle birden çok istek (başka yapılandırma,
  ek kopya, yeniden deneme) **yasak değildir**. AB referans belge vereni (eudi-srv-issuer) ve ülke PID sağlayıcıları belirteci
  ömrü boyunca birden çok istekte kabul eder. HAIP 1.0 ve FAPI 2.0 belirtecin DPoP ile göndericiye bağlanmasını ister (bizde var).
- **Bugün.** Tamga'da erişim belirteci tek kullanımlıktı: ilk başarılı belge isteğinden sonra silinir, ikinci istek
  `401 invalid_token` alırdı ("bir belirteç = bir paket"). Kimlik servisinde ikinci paket, aynı belge için verilmiş öncekini
  iptal ettirirdi (K6 süpersede).
- **OpenID uyum öz-testi (2026-10-21).** Test aracının FAPI 2.0 mutlu akışı ve "additional requests" modülü aynı belirteçle birkaç
  belge isteği atar (FAPI başlıklarıyla); tek kullanımlık belirteç bu iki modülü başarısız kılıyordu (bulgu G7).

# Karar

## K1 — Belirteç ömrü içinde birden çok istek
Erişim belirteci, ömrü (≤ 5 dakika, PR9) boyunca birden çok belge isteğinde kullanılabilir. Ömür uzamaz.

## K2 — Sınırlar
- Yalnız belirtecin kapsadığı belge yapılandırması (teklifteki / PAR'daki tür); başka yapılandırma `invalid_credential_request`
  ya da `unknown_credential_configuration`.
- Belirteç başına verilen **toplam kopya ≤ toplu ihraç büyüklüğü** (`MAX_COPIES_PER_ACCESS_TOKEN = BATCH_SIZE = 10`). Sınırı aşan
  istek reddedilir (`invalid_token`). Sayaç veritabanında tek deyimle tutulur; eşzamanlı istekler sınırı birlikte aşamaz.
- Her istek belirtecin bağlı olduğu DPoP anahtarıyla (RFC 9449); başka anahtar `401 invalid_dpop_proof`.

## K3 — Kimlik servisi: aynı kayda kopya
Aynı belirteçle sonraki istek ilk isteğin kaydına kopya ekler (aynı kayıt kimliği, aynı iptal izleme); önceki paket iptal
edilmez. Tek kullanımlık adımlar (inceleme kodu, davet hakkı, kimlik doğrulama sağlayıcısındaki oturumun silinmesi, takma ad
tohumu — [[ADR-0031]]) yalnız ilk istekte yapılır. Kayıt bu arada iptal edildiyse ya da silindiyse belirteç geçmez.

## K4 — Kişi alanlarının süresi ([[ADR-0011]] K4'ün süresi)
Kimlik servisi yetkilendirme kaydındaki kişi alanlarını artık ilk ihraçta değil, **belirtecin ömrü bitince ya da kopya hakkı
dolunca** siler (en geç ≤ 5 dakika + periyodik temizlik aralığı). Kayıt yine yalnız sunucudadır, günlüğe yazılmaz.

## K5 — Tek paket kalanlar
ZK kopyası erişim belirteci ([[ADR-0044]]) ve bilet (etkinlik başına tek belge) tek paket kalır.

# Değerlendirilen seçenekler

- **Tek kullanımlık kalsın (eski durum).** Standarda aykırı değil ama test aracının iki modülü başarısız kalır ve AB belge
  verenlerinden ayrışır; yeniden deneme (ağ kopması) yeni yetkilendirme ister.
- **Sınırsız yeniden kullanım.** Sınırsız kopya ve iptal listesi indeksi tüketimi; reddedildi.
- **Seçilen:** kısa ömür + yapılandırma + kopya sınırı + DPoP bağlama — AB referans belge vereniyle aynı yaklaşım.

# Değişmezler

| Kod | Kural |
|---|---|
| AT1 | Erişim belirteciyle yalnız belirtecin kapsadığı belge yapılandırması istenebilir. |
| AT2 | Bir erişim belirteciyle verilen toplam kopya sayısı toplu ihraç büyüklüğünü (10) geçmez; sayaç eşzamanlı isteklerde de aşılamaz. |
| AT3 | Her belge isteği belirtecin bağlı olduğu DPoP anahtarıyla yapılır; belirteç ömrü (≤ 5 dk) yeniden kullanımla uzamaz. |
| AT4 | Kimlik servisinde aynı belirteçle sonraki istek ilk isteğin kaydına kopya ekler; önceki paketi iptal etmez; iptal edilmiş ya da silinmiş kayda kopya eklenmez. |
| AT5 | Kimlik servisi yetkilendirme kaydındaki kişi alanlarını belirtecin ömrü bitince ya da kopya hakkı dolunca siler. |

# Uygulama

- `@tamga-network/issuer` 0.7.2: `MAX_COPIES_PER_ACCESS_TOKEN`, `withinAccessTokenAllowance`.
- Platform: `credential_grants.copies` sayacı (şema adımı 10), `claimGrant(…, copies, max)` / `releaseGrant(…, copies)`; kurum
  issuer'ı ve kimlik servisi belirteci ihraçtan sonra silmez (süre sonunda temizlik), kimlik servisi K3–K4.
- Şartname: [[SPEC-PROTO-0001]] §7.4.
- Testler: aynı belirteçle sıralı istekler sınıra kadar kabul, sınır aşımı ve süre sonu ret, başka DPoP anahtarı ret, eşzamanlı
  istekler sınırı aşamaz; kimlik servisinde aynı kayıt, önceki paket iptal edilmez, hak dolunca kişi alanları silinir.

# Durum

**Accepted — 2026-10-21.** Proje yönetimi onayıyla (OpenID uyum öz-testi bulgusu G7; AB referans belge vereniyle aynı yaklaşım).
DECISIONS: D-PROTO-3.
