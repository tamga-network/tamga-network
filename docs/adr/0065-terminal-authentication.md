---
document_id: ADR-0065
title: "Kapı terminalleri doğrulama servisine kimlik gösterir: terminal anahtarı"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-10-26
last_updated: 2026-10-26
summary: >
  Geçiş kartı yolunda (ADR-0012 B) kapılar jetonu Tamga Verify'ın `/terminal/verify` ucuna gönderir; uç bugüne kadar kimlik
  istemiyordu. Cüzdandaki 60 saniyelik QR'ı gören herkes jetonu önce kendisi gönderip tek kullanımlık bileti tüketebilir ve
  gerçek kapıda kişiyi durdurabilirdi. Karar: kapı kendini işletmecinin o terminal grubu için verdiği terminal anahtarıyla
  tanıtır (`Authorization: Bearer`); anahtarsız istek jetona dokunmaz. Anahtarları işletmeci doğrulayıcının yönetici ucundan
  verir ve iptal eder; sunucuda yalnız özeti durur. Sertifika tabanlı terminal kaydı (ADR-0012 K5 `terminal_groups[]`) çevrim
  dışı kapılar için hedef olmaya devam eder. Kabul: 2026-10-26 (güvenlik turu, proje yönetiminin genel onayı).
domain: Protocol
related: ["[[ADR-0012]]", "[[ADR-0017]]", "[[SPEC-API-0001]]", "[[FW-RB-0006]]"]
---

# Kısaca

Turnike ya da etkinlik kapısı, cüzdanın gösterdiği geçiş jetonunu doğrulama servisine gönderirken artık kendini tanıtır: her
terminal grubunun işletmeciden aldığı bir terminal anahtarı vardır ve istek bu anahtarla gelir. Anahtarsız gelen istek jetonu
okumaz, tüketmez, sayaçlara girmez. Böylece bir biletin QR'ını uzaktan fotoğraflayan kişi onu "kullanılmış" yapamaz.

# Bağlam

- [[ADR-0012]] B: kayıtlı kapı için cüzdan kopya anahtarıyla imzalı, kişisel veri içermeyen, 60 saniyelik `tamga-pass+jwt` jetonunu
  QR olarak gösterir; terminal jetonu doğrular ve `jti` tekrar listesi aynı terminal grubundaki kapılar arasında çevrim içi
  paylaşılır. Uygulamada bütün kapılar Tamga Verify'ın `POST /terminal/verify` ucunu çağırır; tekrar listesi ve tek kullanımlık
  bilet durumu (ADR-0012 K4, [[FW-RB-0006]] §4.3) orada tutulur.
- Uç kimlik istemiyordu (yalnız hız sınırı). Jeton kişisel veri taşımadığı için gizlilik riski yoktu; ama **hizmet engelleme
  riski** vardı: QR'ı gören (yanındaki kişi, kamera, ekran görüntüsü) jetonu 60 saniye içinde kendisi gönderirse `jti` listeye
  girer ya da tek kullanımlık bilet tüketilir; gerçek kapıda kişi DUR görür. Bağımsız güvenlik denetiminin (2026-10-26) bulgusu.
- ADR-0012 K5 terminalleri doğrulayıcı kaydında `terminal_groups[]` (grup, sertifika parmak izi, çevrim dışı izni) ile tanımlamayı
  öngörür. Bu kayıt alanı henüz liste şemasında yok; çevrim dışı doğrulayan terminal de yok. Bugünkü kapılar çevrim içi ve
  işletmecinin denetimindeki cihazlardır (turnike bilgisayarı, kapı tableti, sandbox'ın tarayıcı sayfası).
- Proje yönetiminin yönü: güvenlik denetiminin bulguları kapatılır; en az yıkıcı, doğru çözüm seçilir.

# Karar

## K1 — Kapı kimliğini terminal anahtarıyla gösterir
`POST /terminal/verify` yalnız `Authorization: Bearer <terminal anahtarı>` ile çağrılır. Anahtar bir **terminal grubuna** bağlıdır
(politikalardaki `terminal_group`); jeton anahtarın grubuna göre denetlenir. Gövdedeki `terminal_group` isteğe bağlıdır; verilirse
anahtarın grubuyla aynı olmalıdır (başka grubun kapısı gibi davranılamaz → 403). Anahtarsız ya da geçersiz anahtarlı istek
401 (`WWW-Authenticate: Bearer`) alır; jeton okunmaz, tekrar listesine ve kapı sayaçlarına dokunulmaz, denetim kaydına yalnız
"yetkisiz terminal isteği" olayı yazılır (adres ve jeton yok).

## K2 — Anahtarı işletmeci verir ve iptal eder
Anahtarlar doğrulayıcının yönetici uçlarından yönetilir (yönetici belirteci; nginx'te dışa kapalı, yalnız iç adres — Kurum
Konsolu'nun kapı sayaçları için kullandığı yol): `POST /terminal/keys {terminal_group, label}` yeni anahtarı **bir kez** döner,
`GET /terminal/keys` kayıtları özet olmadan listeler, `DELETE /terminal/keys/{id}` iptal eder. Grup, yüklü politikalardaki bir
terminal grubu olmalıdır. Kurum Konsolu'nda bu uçları saran ekran sonraki adımdır (iş listesinde).

## K3 — Sunucuda yalnız özet
Doğrulayıcı anahtarın yalnız SHA-256 özetini saklar (`terminal-keys.json`; kişisel veri yok) ve karşılaştırmayı sabit zamanlı
yapar. Anahtar `tk_` önekli, 192 bit rastgeledir.

## K4 — Yerel geliştirme ve sandbox
Ortamdan yüklenen anahtarlar (`TAMGA_VERIFY_TERMINAL_KEYS="grup:anahtar,…"`) yalnız yerel geliştirme ve sandbox içindir;
dosyaya yazılmaz, iptal edilemez. Sandbox'ın deneme kapısı anahtarları herkese açıktır (sandbox rehberi §6): sandbox gerçek
veri ve gerçek bilet taşımaz; amaç akışı denemektir. Gerçek ağda ortam anahtarı kullanılmaz; bugün gerçek ağda kapı politikası
da yoktur (`/terminal*` 404).

## K5 — Hedef değişmez
Sertifika tabanlı terminal kaydı (ADR-0012 K5 `terminal_groups[]`, çevrim dışı kapı) hedef olarak kalır; terminal anahtarı
çevrim içi kapıların bugünkü kimlik yoludur. Liste şemasına `terminal_groups[]` girince anahtar yerine sertifikayla kimlik
gösterilebilir; bu ADR o zaman güncellenir.

# Değerlendirilen seçenekler

| Seçenek | Sonuç | Neden |
|---|---|---|
| Uç açık kalsın, hız sınırı yeter | ret | Tek istek yeter: 60 saniyelik QR'ı gören kişi bileti tüketir; hız sınırı bunu durdurmaz |
| mTLS / terminal sertifikası (ADR-0012 K5) | hedef, bugün değil | Liste şeması, sertifika dağıtımı ve kapı yazılımı gerekir; sandbox'ın tarayıcı kapısı mTLS yapamaz |
| RP beyanı (`tamga-rp+jwt`, ADR-0017) ile kapı | ret | Erişim sertifikasının özel anahtarı her kapı cihazına dağıtılırdı; terminal grubu ayrımı yok |
| **Terminal grubu başına işletmecinin verdiği taşıyıcı anahtar** | **seçildi** | En az yıkıcı doğru çözüm: tek başlık, iç yönetici ucu, nginx hız sınırı aynen; sandbox sayfası anahtarı alanla çalışır |
| Jetonun `aud`'una kapı kimliği eklemek | ret | Jetonu cüzdan imzalar; kapı kimliği cüzdanda bilinmez ve QR'ı gören yine gönderebilir |

# Değişmezler

| Kod | Kural |
|---|---|
| TK1 | `POST /terminal/verify` yalnız bir terminal grubuna bağlı terminal anahtarıyla (`Authorization: Bearer`) çalışır; anahtarsız ya da geçersiz anahtarlı istek 401 alır ve jeton okunmaz, tekrar listesine ve sayaçlara dokunulmaz. Gövdedeki `terminal_group` anahtarın grubundan farklıysa 403. |
| TK2 | Terminal anahtarlarını işletmeci doğrulayıcının yönetici uçlarından verir ve iptal eder; anahtar yalnız verildiği yanıtta görünür; grup yüklü bir politikanın terminal grubu olmalıdır. |
| TK3 | Doğrulayıcı anahtarın yalnız özetini saklar (kişisel veri yok) ve sabit zamanlı karşılaştırır; ortamdan yüklenen anahtar yalnız yerel geliştirme ve sandbox içindir. |

# Sonuçlar

- Kod: `apps/verify` (`terminal-keys.ts`, `/terminal/verify` 401/403, `/terminal/keys` yönetici uçları, kapı sayfasında anahtar
  alanı — yalnız tarayıcı sekmesinde tutulur); ağ sunucusunda nginx `/terminal/keys` dışa kapalı; sandbox ortamında deneme
  anahtarları; sahne provası (`ops/demo-scenes`) anahtarla çağırır.
- Belgeler: [[SPEC-API-0001]] §6.4 (kimlik doğrulama tablosu) ve AP13 notu; doğrulayıcı API sayfası; sandbox rehberi §6;
  [[FW-RB-0006]] §4.3.
- İş listesi: Kurum Konsolu'nda terminal anahtarı ekranı (K2); liste şemasına `terminal_groups[]` (K5).

# Durum

**Accepted — 2026-10-26.** Proje yönetimi onayıyla (güvenlik turu düzeltmeleri, genel onay). DECISIONS: D-PROX-2.

**Not (2026-10-29):** K2 (Kurum Konsolu ekranı) ve K5 (`terminal_groups[]` liste şemasında) [[ADR-0069]] ile tamamlandı; anahtar kurum adına verilir (TG1–TG3).
