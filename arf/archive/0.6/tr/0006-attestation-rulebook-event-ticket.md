---
document_id: FW-RB-0004
title: Attestation Rulebook — Etkinlik Bileti
category: Framework
domain: Schema
status: Draft
review_status: Draft
version: 0.1.0
created: 2026-09-27
last_updated: 2026-09-27
authors:
  - Tamga Network Engineering
language: tr
document_type: framework
audience:
  - institutions
  - integrators
  - engineers
stability: Evolutionary
maturity: Draft
tags:
  - framework
  - rulebook
  - attestation-rulebook
  - ticket
keywords:
  - attestation rulebook event ticket
  - urn:tamga:tkt:EventTicket:1
  - single-use attestation
  - pass card gate
related:
  - FW-ARF-0001
  - FW-TF-0001
  - FW-RB-0001
  - ADR-0012
  - ADR-0014
  - SPEC-CRED-0003
  - SPEC-WALLET-0001
depends_on:
  - ADR-0012
  - ADR-0014
summary: >
  Etkinlik biletinin (`urn:tamga:tkt:EventTicket:1`) attestation rulebook'u: kişisel veri taşımayan, cihaza bağlı, kapıda tek
  kullanımlık bir belge. Kim verir, hangi alanlar, geçerlilik ve iptal, kapıda geçiş kartı ile tek kullanım, devir (yeniden
  ihraç) ve doğrulama politikası. Kaynaklar ADR-0012 K4, ADR-0014 ve şema kataloğudur.
priority: Medium
---

# 0. Kapsam

| Tip | `vct` | `schema_id` | Katalog |
|---|---|---|---|
| Etkinlik bileti | `urn:tamga:tkt:EventTicket:1` | `keccak256(vct)` | `schemas.tamga.network/v1/tkt/EventTicket/1.0.0` |

Bilet **kişisel veri taşımaz**: kişiyi değil bileti gösterir; cihaz anahtarına bağlıdır (`cnf`), kimlik alanı yoktur. Kapıda
kimlik gerekiyorsa (ör. isimli bilet) bu ayrı bir sunumdur (kimlik belgesi, [[FW-RB-0003]]).

---

# 1. Veri modeli

| Claim | Tip | Seçici açıklama | Not |
|---|---|---|---|
| `event_id` | string | `always` | Etkinlik kodu |
| `event_name` | string | `always` | |
| `event_start`, `event_end` | tarih-saat | `always` | |
| `venue_name` | string | `always` | Mekân |
| `organizer_name` | string | `always` | Organizatör |
| `ticket_class` | string | `always` | ör. STANDARD, VIP, STUDENT |
| `seat` | string (isteğe bağlı) | `always` | Koltuk |
| `ticket_no_hash` | `sha256-…` | `always` | Satıcının bilet numarasının özeti; satıcı kendi kaydıyla eşler |
| `gate` | nesne | `never` | Kapının geçiş kartı alacağı doğrulayıcı (`verifier_client_id`), terminal grubu, politika |
| `status`, `cnf`, `vct`, `iss`, `iat`, `exp` | — | `never` | Tel profili |

---

# 2. Kim ihraç eder

| Şart | Değer |
|---|---|
| İhraççı | Bilet satıcısı / organizatör (ör. bilet platformu) |
| Kategori | `EVENTS` ([[ADR-0014]]; kategori kaba filtredir, asıl kapı şema yetkisidir — IC2) |
| Asgari akreditasyon | I2 |
| Şema yetkisi | Bu `vct` için allowlist kaydı |
| Kimlik ispatı | Gerekmez (T0) — bilet kişiye değil cihaza bağlanır |

Not: `EventTicket:1` tip tanımında (değişmez dosya) issuer kategorisi `OTHER` yazar; kayıtlar [[ADR-0014]] ile `EVENTS`
kategorisindedir. Tanımdaki düzeltme `EventTicket:2` ile gelir (yayınlanmış dosya değişmez — D1).

---

# 3. Geçerlilik, iptal ve devir

| Konu | Kural |
|---|---|
| Geçerlilik | `exp` = etkinlik bitişi + 1 gün; en fazla 400 gün (bir yıl önceden satış) |
| Kopya | **Koltuk başına bir kopya** ([[ADR-0012]] K4) |
| Status list | Zorunlu: iptal **ve** kapıda "kullanıldı" biti |
| İptal | iade, etkinlik iptali, hatalı satış |
| Devir | Bilet başkasına **aktarılmaz**; devir = satıcının eskisini iptal edip yeni cihaza yeniden vermesi |

---

# 4. Kapıda tek kullanım

1. **Kayıt:** kişi bileti bir kez kapının doğrulayıcısına sunar (`gate.verifier_client_id`, OpenID4VP); doğrulayıcı bir
   geçiş hakkı (`pass_grant`) döner ([[ADR-0012]] K1-B).
2. **Kapı:** cüzdan 60 saniyelik, **kişisel veri içermeyen** imzalı geçiş jetonunu QR olarak gösterir; terminal çevrim dışı
   doğrulayabilir (K2).
3. **Tek geçiş:** geçişte status biti "kullanıldı" yapılır; status yayını sabit aralıklı olduğundan (S6) aynı terminal
   grubundaki kapılar **ortak kullanıldı listesi** tutar ve aralık içindeki ikinci geçişi bu liste keser (K3, K4).
4. Organizatör hem ihraççı hem doğrulayıcı olduğundan bağlanamazlık bu tip için anlamsızdır; kabul edilmiş durumdur (K4).
5. Terminal yalnızca kayıtlı bir RP'nin altında tanımlanır (`terminal_groups[]`, K5).

---

# 5. Doğrulama politikası

| Politika | Gerekli |
|---|---|
| `event-ticket` (referans) | `vct = EventTicket:1`; issuer `EVENTS` kategorisinde ve bu tipe yetkili, ≥ I2; status etkin (iptal/kullanılmış değil); istenen alanlar yalnızca `event_id` + `ticket_class` |

Kapı kişinin adını, doğum tarihini ya da iletişim bilgisini istemez. Sonuç üç değerlidir; `INDETERMINATE` geçiş değildir.

---

# 6. Demo sapmaları

| # | Sapma | Kapanış |
|---|---|---|
| S-9 | Demo cüzdanında anahtar yazılımda | Pilotta güvenli bölge |
| S-16 | Geçiş kartında her gösterimde PIN sorulmaz (süreli, kapsamlı rıza) | Kurallı istisna — [[SPEC-WALLET-0001]] WL12–WL14 |

---

# İlgili dokümanlar

[[FW-ARF-0001]] · [[FW-TF-0001]] · [[FW-RB-0001]] · [[FW-RB-0003]] · [[ADR-0012]] · [[ADR-0014]] · [[SPEC-CRED-0003]] ·
[[SPEC-WALLET-0001]]

# CHANGELOG

- **0.1.0 (2026-09-27)** — İlk taslak: [[ADR-0012]] K1–K5, [[ADR-0014]] ve şema kataloğunun derlemesi. Onay bekliyor.

# Durum

**Draft** — 0.1.0, 2026-09-27. Onay bekliyor; onaylanınca Active olur.
