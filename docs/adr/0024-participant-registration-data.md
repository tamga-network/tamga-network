---
document_id: ADR-0024
title: Katılımcı Kayıt Verisi — Doğrulayıcılar ve Belge Verenler için AB Ortak Veri Seti
category: ADR
domain: Trust
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
  - institutions
  - relying-parties
  - engineers
tags:
  - adr
  - registration
  - relying-party
  - trusted-list
keywords:
  - relying party registration
  - privacy policy
  - supervisory authority
  - entitlements
  - CIR 2025/848
summary: >
  Güven listesindeki doğrulayıcı (RP) ve belge veren kayıtları, AB'nin ortak kayıt veri setini (CIR 2025/848 Ek I, CIR 2026/1730
  değişikliğiyle; AB teknik şartnameleri TS5/TS6) taşır: resmî ad ve ticari ad, resmî kimlik numarası, adres, iletişim, hizmet
  açıklaması, her kullanım için amaç + gizlilik politikası, kamu kurumu işareti, yetki türü, aracı ilişkileri ve veri koruma
  kurumu. Cüzdan bunları onay ekranında gösterir; silme talebi ve şikâyet akışları bunlara dayanır.
related:
  - "[[ADR-0017]]"
  - "[[ADR-0022]]"
  - "[[FW-TF-0001]]"
  - "[[SPEC-TRUST-0001]]"
---

# Bağlam

Bugünkü doğrulayıcı kaydı yalnız şunları taşır:
- `client_id`,
- yasal ad,
- erişim sertifikası parmak izi,
- kullanım kapsamları (amaç + istenen alanlar).

AB boşluk analizinde (2026-09-29) bunun eksik olduğu çıktı. AB'de her doğrulayıcı ulusal kayıt kuruluşuna ortak bir veri seti
bildirir (CIR 2025/848 Ek I; TS6 v1.2.2). Cüzdan onay ekranında gizlilik politikasının bağlantısını göstermek zorundadır (RPA_10).
Kullanıcının silme talebi (TS7) ve veri koruma kurumuna şikâyeti (TS8) de bu kayıttaki iletişim bilgilerine dayanır.

Proje yönetimi, AB'de toplanan bilgilerin Tamga'da da toplanmasını onayladı.

# Karar

## K1 — Doğrulayıcı kaydı: AB ortak veri seti

Güven listesindeki `relying_parties[]` kaydı şu alanları taşır. Adlar TS5 `WalletRelyingParty` sınıfının karşılığıdır.

| TS6 | Alan | Tamga | Zorunlu |
|---|---|---|---|
| 1 | Resmî ad | `legal_name` | evet |
| 2 | Ticari ad (kullanıcıya görünen) | `trade_name` | evet |
| 3, 6 | Resmî kimlik numarası | `identifiers[]` (`{scheme, value}`; Türkiye: `TR-VKN` vergi kimlik no, `TR-MERSIS`; ülke önekli) | evet |
| 4 | Adres | `postal_address` | evet |
| 5 | Web sitesi | `info_uri` | hayır |
| 7 | İletişim | `contact` {`support_uri`, `email`, `phone`}; en az biri, `support_uri` önerilir | evet |
| 8 | Hizmet açıklaması | `service_description` (çok dilli) | evet |
| 9 | İstenen veri | `scopes[].vct` + `scopes[].claims` (bugün var) | evet |
| 10 | Amaç | `scopes[].purpose` + `purpose_localized` (bugün var) | evet |
| — | Gizlilik politikası (her kullanım için) | `scopes[].privacy_policy_uri` | evet |
| 11 | Kamu kurumu mu | `is_public_sector_body` | evet |
| 12–13 | Yetki türü | `entitlements[]` (`service_provider`, `non_q_eaa_provider`, `pub_eaa_provider`, …; ETSI TS 119 475 URI eşlemesi) | evet |
| 14–16 | Aracı ilişkisi | `uses_intermediaries[]` (RP) / `served_relying_parties[]` (aracı); [[ADR-0017]] | koşullu |
| — | Veri koruma kurumu | `supervisory_authority` {`name`, `country`, `email` / `phone` / `form_uri`}; Türkiye: KVKK Kurumu | evet |

## K2 — Belge verenler de aynı kimlik ve iletişim alanlarını taşır

`issuers[]` kaydı şu alanları taşır: `trade_name`, `identifiers[]`, `postal_address`, `info_uri`, `contact`,
`supervisory_authority`. Belge veren için `entitlements` otomatik yazılır: sınıf EAA → `non_q_eaa_provider`, PUB →
`pub_eaa_provider`. Bu alanlar ETSI TS 119 602 (LoTE) listelerindeki adres ve iletişim bilgisinin kaynağıdır.

## K3 — Cüzdan

- Onay ekranında ticari ad, amaç ve **gizlilik politikası bağlantısı** gösterilir (RPA_06, RPA_10).
- Kayıttaki iletişim ve veri koruma kurumu bilgisi, silme talebi (TS7) ve şikâyet (TS8) akışlarına kaynaktır.

## K4 — Kişisel veri

Güven listesi kamuya açıktır. Bu yüzden doğrulayıcı ve belge veren kaydı yalnız **kurumlar** (tüzel kişiler) içindir. Kişi olarak
doğrulayıcı kaydı pilotta desteklenmez. İletişim bilgisi kurumsal adrestir (destek sayfası, kurumsal e-posta/telefon); kişi adı
yazılmaz.

## K5 — Geçiş

- Liste biçiminde yeni alanlar **isteğe bağlı** eklenir; eski kayıtlar bozulmaz.
- Yayıncı, yeni ya da güncellenen her kayıtta K1/K2'nin zorunlu alanlarını ister. Pilot öncesinde bütün kayıtlar tamamlanır.
- Kayıt sertifikası (WRPRC, `verifier_info`) ve kayıt API'si (TS5) sonraki adımdır.

# Değerlendirilen seçenekler

| Seçenek | Sonuç | Neden |
|---|---|---|
| Bugünkü dar kayıt | ret | Gizlilik politikası, iletişim ve veri koruma kurumu yok; RPA_10, TS7, TS8 karşılanamaz |
| AB alan adlarını birebir (camelCase) | ret | Tamga listeleri snake_case; TS5 eşlemesi tabloyla belgelenir, dışa aktarımda AB adları kullanılır |
| **AB veri seti, Tamga adlarıyla** | **kabul** | Aynı içerik; LoTE ve ileride TS5 API dışa aktarımı eşlemeyle |

# Değişmezler

| Kod | Kural |
|---|---|
| RPR1 | Yeni ya da güncellenen her doğrulayıcı kaydı, her kullanım kapsamı için bir gizlilik politikası bağlantısı ve en az bir iletişim yolu taşır. |
| RPR2 | Doğrulayıcı ve belge veren kayıtları yalnız kurumlar içindir; kayıtta kişi adı ya da kişisel iletişim bilgisi bulunmaz. |
| RPR3 | Her doğrulayıcı kaydı yetkili veri koruma kurumunu ve ona ulaşma yolunu belirtir. |

# Sonuçlar

- `@tamga-network/trust` şeması: yeni alanlar (isteğe bağlı). Trust publisher: yeni/güncellenen kayıtta zorunlu alan denetimi.
- `apps/trust-publisher/registry`: mevcut kayıtlar (Tamga doğrulama servisi, kurumlar) tamamlanır. Kurumların resmî bilgileri
  kurumlardan alınır.
- Cüzdan onay ekranı: ticari ad + gizlilik politikası bağlantısı.
- LoTE (SPEC-ID-0002 §8.1.1): belge veren adres ve iletişimi bu alanlardan.
- [[SPEC-TRUST-0001]] ve [[FW-TF-0001]] katılım kuralları güncellenir.

# Durum

**Accepted — 2026-09-29.** Proje yönetimi onayıyla. DECISIONS: D-REG-1. Uygulama sırada.
