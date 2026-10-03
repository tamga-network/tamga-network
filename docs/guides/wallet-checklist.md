---
document_id: GUIDE-0010
title: "Cüzdan yayın öncesi kontrol listesi"
status: Active
version: 1.0.1
created: 2026-10-03
last_updated: 2026-10-03
summary: >
  Tamga uyumlu bir cüzdanı mağazaya göndermeden önce geçilecek kontrol listesi: anahtarlar ve cihaz kanıtı, kayıt, belge alma,
  gösterme ve onay ekranı, gizlilik ve günlük, cihaz değiştirme ve silme, güven listesi, uyum testleri ve mağaza.
---

# Cüzdan yayın öncesi kontrol listesi

Bu sayfa, [[GUIDE-0005]]'te anlatılan cüzdanı yayına hazırlayan ekipler içindir. Her madde bir kurala dayanır; kural kodları
[[SPEC-WALLET-0001]]'de, tam liste [Tamga ARF — Tamga Rulebook, RB-WP](https://arf.tamga.network/tr/rulebook)'dedir.

**Ne zaman okunur:** ilk mağaza gönderiminden önce ve her büyük sürümden önce.

## Anahtarlar ve cihaz

- Belge anahtarları cihazın güvenli bölgesinde üretiliyor (Secure Enclave, StrongBox ya da en az TEE); dışa aktarılamıyor;
  bir tohumdan türetilmiyor (WL1).
- Yazılım anahtarı yalnız test derlemesinde var; mağaza derlemesinde yazılım anahtarına düşüş kişiye açıkça gösteriliyor (WL3).
- Birim kaydında cihaz kanıtı gidiyor: iOS'ta App Attest, Android'de anahtar kanıtı zinciri ([[GUIDE-0005]] §4).
- Kanıtın reddedildiği durum denendi: birim yazılım seviyesinde kaydoluyor ve kişi uyarılıyor.
- Uygulama kimliği (Bundle ID, paket adı) cüzdan sağlayıcısının beklediğiyle aynı.

## Kayıt

- Cüzdan çözümü güven listesinde `wallet_providers[]` altında kayıtlı; WUA imza anahtarı listede.
- Uygulama sürümü, çözümün kayıtlı en düşük sürümünden (`min_version`) eski değil.

## Belge alma

- Teklif QR'ı ve PIN (`tx_code`) ayrı kanallardan geliyor; uygulama PIN'i teklifle aynı yerden almıyor.
- Her kopya ayrı bir anahtara bağlı; gelen belge yerelde doğrulanıyor (`receiveCredentials`).
- WUA süresi dolmadan yenileniyor (`wuaExpiringSoon`); belge işlemlerinde WIA ve anahtar kanıtı kullanılıyor.
- Kişinin eylemi olmadan yenileme yalnız izin verilen koşullarda yapılıyor (WL7, [[ADR-0023]]).

## Gösterme ve onay ekranı

- İstek imzası ve sertifikası denetleniyor (`verifyRequestObject`); doğrulayıcı kaydı imzalı listeden okunuyor (`checkRp`).
- Ekranda doğrulayıcının adı, amacı, istenen alanlar tek tek ve gizlilik politikası var; aracıda asıl site gösteriliyor
  ([[ADR-0017]]).
- Kapsam dışı alan ayrı görsel blokta, gecikmeli düğmeyle gösteriliyor (WL8).
- Her gösterim PIN ya da biyometri istiyor (WL11).
- Aynı doğrulayıcıya aynı kopya, farklı doğrulayıcıya farklı kopya gidiyor; kopyalar tükenince kişiye soruluyor (WL5, WL6).
- Gösterim anında şema sunucusuna istek yok (WL9).
- "Geçersiz" ile "doğrulanamadı" farklı gösteriliyor ([[SPEC-CRED-0003]] S14).

## Gizlilik ve günlük

- İşlem günlüğü cihazda; değer değil yalnız alan adları; sunucuya ve otomatik yedeğe gitmiyor (WL4).
- Günlük dışa aktarma yalnız kişinin başlattığı ve kendi parolasıyla şifreli (TS10, parola en az 8 karakter).
- Hata kayıtlarında, analitikte ve çökme raporlarında kişisel veri, belge içeriği ya da belge yok.
- Geçiş kartı QR'ı kişisel veri taşımıyor; jeton ömrü en çok 60 saniye (WL12).

## Cihaz değiştirme ve silme

- Yedek ve taşıma dosyası anahtar taşımıyor; yeni cihazda belgeler "yeniden al" listesiyle geri geliyor (WL2, WL10).
- Günlüğün geri yüklenmesi kişiye soruluyor.
- Cihaz devrinde birim iptal ediliyor (`revokeUnit`).
- Uygulama içinden hesap ve veri silme çalışıyor (`deleteUnit`, `requestIdentityErasure`); kurum verisi için başvuru yolu
  gösteriliyor.

## Güven listesi

- Kök parmak izleri uygulamaya gömülü (`TRUST_PINS`); liste sunucusuna güvenilmiyor.
- Liste bayatsa ya da indirilemiyorsa cevap "doğrulanamadı"; bilinmeyen biçim sürümünde işlem duruyor.
- Liste dosyaları elle yorumlanmıyor; yalnız `@tamga-network/trust/core` kullanılıyor ([[ADR-0015]]).

## Uyum ve mağaza

- Uyum vektörleri ve taahhüt testleri geçiyor; sonuç raporu hazır ([[GUIDE-0009]]).
- Gerçek iOS ve Android cihazlarda alma, gösterme, cihaz değiştirme ve silme uçtan uca denendi (test ağı: [[GUIDE-0013]]);
  iptal ve askı durumları da denendi.
- Mağaza incelemesi için deneme hesabı ve yönergesi hazır ([[ADR-0033]]).
- Gizlilik beyanı (App Store gizlilik etiketi, Google Play veri güvenliği formu) cihazda kalan günlükle ve silme yoluyla tutarlı.

## İlgili

- Adım adım geliştirme: [[GUIDE-0005]] · Kurallar: [[SPEC-WALLET-0001]] · Sorun giderme: [[GUIDE-0012]]
