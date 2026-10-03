---
document_id: FW-RB-0004
title: "Event Ticket Rulebook"
status: Active
version: 1.0.0
created: 2026-09-27
last_updated: 2026-10-02
summary: >
  Etkinlik biletinin (`urn:tamga:tkt:EventTicket:1`) rulebook'u (Tamga Rulebook'tan dallanır): kişisel veri taşımayan, cihaza
  bağlı, kapıda tek kullanımlık bir belge. Kim verir, hangi alanlar, geçerlilik ve iptal, kapıda geçiş kartıyla tek kullanım,
  devir (yeniden belge verme) ve doğrulama politikası. Kaynaklar ADR-0012, ADR-0014 ve şema kataloğudur.
---

# 0. Kapsam

| Tür | `vct` | Katalog |
|---|---|---|
| Etkinlik bileti | `urn:tamga:tkt:EventTicket:1` | `schemas.tamga.network/v1/tkt/EventTicket/1.0.0` |

Bilet **kişisel veri taşımaz**: kişiyi değil bileti gösterir; cihaz anahtarına bağlıdır (`cnf`), kimlik alanı yoktur. Kapıda
kimlik gerekiyorsa (örneğin isimli bilet) bu ayrı bir gösterimdir (kimlik belgesi, Identity Rulebook).

---

# 1. Veri modeli

| Alan | Tür | Seçici paylaşım | Not |
|---|---|---|---|
| `event_id` | metin | `always` | Etkinlik kodu |
| `event_name` | metin | `always` | |
| `event_start`, `event_end` | tarih-saat | `always` | |
| `venue_name` | metin | `always` | Mekân |
| `organizer_name` | metin | `always` | Organizatör |
| `ticket_class` | metin | `always` | ör. STANDARD, VIP, STUDENT |
| `seat` | metin (isteğe bağlı) | `always` | Koltuk |
| `ticket_no_hash` | `sha256-…` | `always` | Satıcının bilet numarasının özeti; satıcı kendi kaydıyla eşler |
| `gate` | nesne | `never` | Kapının geçiş kartı alacağı doğrulayıcı (`verifier_client_id`), terminal grubu, politika |
| `status`, `cnf`, `vct`, `iss`, `iat`, `exp` | — | `never` | Taşıma profili |

---

# 2. Kim verir

| Şart | Değer |
|---|---|
| Belge veren | Bilet satıcısı ya da organizatör (ör. bilet platformu) |
| Kategori | `EVENTS` |
| Asgari akreditasyon | I2 |
| Belge türü yetkisi | Bu `vct` için izin listesi kaydı |
| Kimlik doğrulama | Gerekmez (T0) — bilet kişiye değil cihaza bağlanır |

Not: `EventTicket:1` tür tanımında (değişmez dosya) [[t:issuer|belge veren]] kategorisi `OTHER` yazar; kayıtlar [[ADR-0014]] ile `EVENTS`
kategorisindedir. Tanımdaki düzeltme `EventTicket:2` ile gelir (yayınlanmış dosya değişmez, RB-SCH-02).

---

# 3. Geçerlilik, iptal ve devir

| Konu | Kural |
|---|---|
| Geçerlilik | `exp` = etkinliğin bitişi + 1 gün; en çok 400 gün (bir yıl önceden satış) |
| Kopya | **Koltuk başına bir kopya** |
| İptal listesi | Zorunlu: iptal **ve** kapıda "kullanıldı" biti |
| İptal | iade, etkinliğin iptali, hatalı satış |
| Devir | Bilet başkasına **aktarılmaz**; devir, satıcının eskisini iptal edip yeni cihaza yeniden vermesidir |

---

# 4. Kapıda tek kullanım

1. **Kayıt:** kişi bileti bir kez kapının doğrulayıcısına gösterir (`gate.verifier_client_id`, [[t:OpenID4VP]]); [[t:verifier|doğrulayıcı]]
   bir geçiş hakkı (`pass_grant`) döner.
2. **Kapı:** cüzdan 60 saniyelik, **kişisel veri içermeyen** imzalı geçiş jetonunu karekod olarak gösterir; terminal çevrim dışı
   doğrulayabilir.
3. **Tek geçiş:** geçişte iptal listesindeki bit "kullanıldı" yapılır; iptal listesi sabit aralıkla yayınlandığından aynı
   terminal grubundaki kapılar **ortak bir "kullanıldı" listesi** tutar ve aralık içindeki ikinci geçişi bu liste keser.
4. Organizatör hem belge veren hem doğrulayıcı olduğundan ilişkilendirilemezlik bu tür için anlamsızdır; bu kabul edilmiş
   bir durumdur.
5. Terminal yalnızca kayıtlı bir doğrulayıcının altında tanımlanır (`terminal_groups[]`).
6. Geçiş kartı her gösterimde PIN sormaz: bu, kişinin verdiği **süreli ve kapsamı belli** bir rızaya dayanır; rıza her an geri
   alınır ve her gösterim cüzdanda kayda geçer (Ek A §3.7; cüzdan kuralları [[SPEC-WALLET-0001]]).

---

# 5. Doğrulama politikası

| Politika | Gerekli |
|---|---|
| `event-ticket` (referans) | `vct = EventTicket:1`; belge veren `EVENTS` kategorisinde ve bu türe yetkili, en az I2; iptal edilmemiş ve kullanılmamış; istenen alanlar yalnızca `event_id` ve `ticket_class` |

Kapı kişinin adını, doğum tarihini ya da iletişim bilgisini istemez. Sonuç üç değerlidir; `INDETERMINATE` geçiş değildir.

---

# Kaynaklar

Bu belgenin dayandığı kararlar, şartnameler ve standartlar Ek E'de listelenir.

# Durum

**Yürürlükte** — sürüm 1.0.0 (2026-10-02).
