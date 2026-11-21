---
document_id: ADR-0095
title: "Sandbox'ta iletişim belgesinin kaynağı: operatör telefon, e-posta sağlayıcısı e-posta belgesi verir"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-21
last_updated: 2026-11-21
summary: >
  Bugün doğrulanmış e-posta ve telefon belgesini (urn:tamga:contact:EmailAddress:1, PhoneNumber:1) yalnız Tamga kimlik servisi,
  tek kullanımlık kodla verir (ADR-0021, FW-RB-0005). Sandbox'ta iki kurgusal kurum aynı türleri kendi kaydından verir: Sinyalnet
  Mobil (mobil operatör) telefon numarası belgesini abonesine, Postakuş (e-posta hizmeti) e-posta belgesini kullanıcısına. Sahiplik
  kanıtı tek kullanımlık kod değil, kurumun kendi hesabına giriştir (sandbox'ta kişi listeden seçilir). Belge biçimi, süre, iptal
  ve gizlilik kuralları ADR-0021 ile aynıdır. Gerçek ağ değişmez. Kabul: 2026-11-21.
domain: Credentials
related: ["[[ADR-0021]]", "[[ADR-0038]]", "[[ADR-0093]]", "[[FW-RB-0005]]", "[[ADR-0010]]"]
---

# Kısaca

Bir telefon numarasının kime ait olduğunu en iyi operatör, bir e-posta adresinin kime ait olduğunu en iyi e-posta hizmeti bilir.
Bugün Tamga'da bu iki belgeyi yalnız Tamga'nın kimlik servisi veriyor; kişiye kod gönderip doğru girilince. Bu karar sandbox'ta
belgenin asıl kaynağından da gelebileceğini göstermeyi önerir: kurgusal operatör Sinyalnet Mobil abonesine telefon numarası
belgesi, kurgusal e-posta hizmeti Postakuş kullanıcısına e-posta belgesi verir. Gerçek ağ değişmez.

# Bağlam

- **ADR-0021.** İki iletişim belgesi tanımlı: `urn:tamga:contact:EmailAddress:1` (`email`) ve `urn:tamga:contact:PhoneNumber:1`
  (`phone_number`, E.164). Sahiplik tek kullanımlık kodla kanıtlanır (CT1); veri yalnız akış süresince bellekte (CT2); belgede kimlik
  bilgisi ve `category` yok (CT3). Kural kitabı ([[FW-RB-0005]]) belge vereni "yalnız Tamga Network kimlik servisi" diye yazar.
- **AB çerçevesi.** eIDAS 2.0 ve ARF iletişim bilgisi için ayrı tür tanımlamaz; bu bilgiler nitelikli olmayan EAA olarak herhangi
  bir sağlayıcıdan gelebilir. Tarayıcı dünyasındaki e-posta doğrulama taslağında adresi e-posta sağlayıcısı imzalar ([[ADR-0021]]
  Bağlam). Yani asıl kaynak operatör ve e-posta hizmetidir.
- **Sandbox gösterim ağı.** Ad listesinde (proje yönetimi onayı, 2026-11-19) iki kurum var: Sinyalnet Mobil (`sinyalnet`, telefon
  numarası belgesi) ve Postakuş (`postakus`, e-posta belgesi). İkisi "belge veren serviste kod gerekir" diye ertelendi. Sandbox'taki
  uydurma kişilerin numaraları kurguya ayrılmış `+44 7700 900xxx` aralığında, e-postaları `@ornek.example`'dadır: bu adreslere kod
  gönderilemez.

# Karar

## K1 — Yalnız sandbox

Karar yalnız sandbox içindir ([[ADR-0038]]). Gerçek ağda iletişim belgesini yine yalnız Tamga kimlik servisi verir; ADR-0021 ve
kural kitabının gerçek ağ için yazdığı her şey aynen kalır.

## K2 — İki kurgusal kaynak kurum

| Kurum | Adres | Verdiği | Kime |
|---|---|---|---|
| Sinyalnet Mobil | `sinyalnet` | `urn:tamga:contact:PhoneNumber:1` | abonesine, kayıtlı numarası için |
| Postakuş | `postakus` | `urn:tamga:contact:EmailAddress:1` | kullanıcısına, kayıtlı adresi için |

İkisi TR ülke listesinde birer belge veren kaydıdır: `category: OTHER` (kapalı kümede telekom ya da e-posta kategorisi yok; yeni
kategori ayrı karar), `class: EAA`, `assurance: I1` (kimlik doğrulaması yok). Şema yetkisi yalnız kendi türleri içindir. "(TEST)"
işareti sistemce konur (SB4).

## K3 — Sahiplik kanıtı: kurumun kendi hesabı

Kaynak kurum kişiye kod göndermez; kişi kurumun kendi hesabına girer ve kurum kayıtlı numarayı ya da adresi belgeye yazar. Kişi
belgeye başka bir numara ya da adres yazdıramaz. Sandbox'ta hesaba giriş yoktur: kişi, sandbox'ın sahte kimlik sayfasındaki gibi
listeden seçilir; kurumun kaydı uydurma kişilerin dosyasından gelir. CT1 (kodla kanıt) kimlik servisi için aynen kalır; kaynak
kurum için kanıt kurumun kendi kaydıdır.

## K4 — Biçim ve kurallar ADR-0021 ile aynı

Tür, alanlar, yalnız SD-JWT VC, süre en çok 1 yıl, iptal listesi, `category` claim'i yok (CT3), adres ve numaranın günlüğe
yazılmaması (CT2) aynen geçerlidir. Doğrulayıcı ve cüzdan için belge, kimlik servisinin verdiğinden farklı değildir; yalnız
belge veren farklıdır ve doğrulama sonucunda kurum adı görünür.

## K5 — Kod

Barındırılan belge veren iletişim türlerini sandbox kiracılarına açar: kiracı ayarında tür ve kayıt alanı (`phone_number` /
`email`) belirtilir, kişinin kaydı uydurma kişilerin dosyasından eşleşir. Kimlik servisinin kod akışı değişmez.

# Gerekçe / alternatifler

- **Sandbox'ta da kodla kanıt — reddedildi.** Uydurma adreslere kod gönderilemez; gönderilebilen bir test gelen kutusu (`email-relay`)
  da kaynağın kim olduğunu göstermez.
- **Gerçek ağda da kaynak kurumlar — bu kararın dışında.** Gerçek bir operatörün katılımı, hukuki konum ve kategori sorusu (telekom)
  ayrı karardır; sandbox denemesi ona girdi olur.
- **Yeni kategori (`TELECOM`) — şimdilik hayır.** Kapalı kümeye değer eklemek ayrı ADR ister; sandbox için `OTHER` yeterli.

# Değişmezler

| Kod | Kural |
|---|---|
| CS1 | Kaynak kurumun iletişim belgesi yalnız sandbox'ta verilir; gerçek ağda iletişim belgesini yalnız kimlik servisi verir. |
| CS2 | Kaynak kurum belgeye yalnız kendi kaydındaki numarayı ya da adresi yazar; kişi başka değer yazdıramaz. |
| CS3 | Kaynak kurumun belgesi ADR-0021'in biçim, süre, iptal ve gizlilik kurallarına (CT2, CT3) uyar. |

# Açık sorular — kabulle karara bağlandı (2026-11-21)

1. Kategori `OTHER`; telekom kategorisi gerçek bir operatör katılmak isterse ayrı karar.
2. 74 uydurma kişinin hepsi Sinyalnet abonesi ve Postakuş kullanıcısıdır.

# Durum

**Accepted — 2026-11-21** (proje yönetimi onayı; birebir alıntı özel onay kaydında). DECISIONS: D-CONTACT-2. CS1–CS3 bağlayıcıdır.
Uygulama sırası: sandbox PKI (iki kurum sertifikası) → TR sandbox
listesine iki kayıt → barındırılan belge verende iletişim türleri → portal sayfası.

**Uygulama (2026-11-22).** Dört adım da yapıldı: sandbox PKI'da iki kurumun belge ve iptal listesi sertifikaları; TR sandbox
listesinde iki kayıt (`OTHER`, `EAA`, `I1`, yetki yalnız kendi türü); barındırılan belge verende kiracı ayarı `contact_provider`
(`claim`: `phone_number` ya da `email`; gerçek ağda kiracı açılmaz — CS1; değer kurumun kaydından — CS2; yenileme belirteci ve
cüzdan başlatmalı yol yok, yeniden almak yeni teklif); portalda kişi sayfasında "Sinyalnet Mobil verir" / "Postakuş verir"
düğmeleri (kimlik servisi yolu da durur; askı yok, yalnız iptal). Not: katalogdaki iletişim türlerinin bilgi amaçlı `tamga`
bloğu belge vereni `IDENTITY` ve en az `I2` diye anar ve açıklaması SMS/e-posta kodundan söz eder; bu alanlar kodda zorlanmaz,
iletişim belgesi isteyen bir doğrulama politikası yoktur. Katalog değiştirilmedi (bütünlük özeti değişirdi); gerçek bir kaynak
kurum katılırsa ayrı kararla ele alınır.
