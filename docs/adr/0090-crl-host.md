---
document_id: ADR-0090
title: "CRL için ayrı alan adı: crl.tamga.network, http ve https"
status: Active
review_status: Completed
version: 1.0.0
created: 2026-11-18
last_updated: 2026-11-18
summary: >
  Erişim sertifikası iptal listeleri (CRL, [[ADR-0087]]) güven listesi alan adının altından çıkar, ayrı bir alan adına taşınır:
  gerçek ağ `crl.tamga.network`, sandbox `crl.sandbox.tamga.network`. Bu alan adı aynı DER dosyasını hem `http` hem `https`
  üzerinden, yönlendirme yapmadan sunar; sertifikalardaki CRL Distribution Points uzantısı iki adres taşır: önce `http://`, sonra
  `https://`. Gerekçe: ETSI EN 319 412-2 V2.5.1 GEN-4.3.11-4 dağıtım noktalarından en az birinin `http` (ya da `ldap`) olmasını
  ister ve RFC 5280 §8 dağıtım noktasında `https`'i önermez; AB referans Android cüzdanı ise yalnız `http` gösteren sertifikada CRL'i
  indirmez. Güven listesi alan adı her isteği `https`'e yönlendirdiği için iki şema ancak ayrı bir alan adında birlikte sunulabilir.
  ADR-0087 K3'ün adres kuralının yerini alır; CRL profili, tazelik ve iptal tetikleri değişmez. Kabul: 2026-11-18.
domain: Trust
related: ["[[ADR-0058]]", "[[ADR-0068]]", "[[ADR-0087]]", "[[SPEC-TRUST-0001]]"]
---

# Kısaca

Doğrulayıcıların erişim sertifikalarının iptal listesi (CRL) kendi alan adına taşınır: `crl.tamga.network`. Liste orada hem şifresiz
(`http`) hem şifreli (`https`) bağlantıdan, aynı dosya olarak sunulur ve sertifikalar iki adresi de gösterir. AB standardı birinci
adresi, AB referans cüzdanı ikincisini istiyor; ikisini birlikte sunmanın tek temiz yolu ayrı bir alan adıdır.

# Bağlam

- [[ADR-0087]] K3 CRL'i yeni alan adı açmadan güven listesi alan adının altına koydu (`https://trust.tamga.network/crl/<makam>.crl`)
  ve sertifikalara yalnız bu `https` adresini yazdı. Sandbox'ta bu biçimde çalışıyor; gerçek ağda erişim sertifikası makamı henüz
  kurulmadı (anahtar töreniyle birlikte).
- **ETSI EN 319 412-2 V2.5.1 (2026-08) GEN-4.3.11-3/-4:** dağıtım noktası en az bir herkese açık CRL'i göstermeli ve bu adreslerden en
  az biri `http` (RFC 9110) ya da `ldap` (RFC 4516) olmalı. TS 119 411-8 sertifika profilini EN 319 411-1 üzerinden bu belgeye bağlar;
  tüzel kişi profili (EN 319 412-3) bu maddeyi değiştirmez. Yalnız `https` gösteren bugünkü sertifika bu maddeye uymaz.
- **RFC 5280 §8:** dağıtım noktasında `https` önerilmez (döngüsel bağımlılık); kullanılırsa sunucunun TLS sertifikası o CRL'e
  gerek duymadan doğrulanabilmeli. CRL imzalı olduğu için şifresiz taşıma bütünlüğü bozmaz.
- **AB referans cüzdanı:** Android uygulaması şifresiz trafiği kapatır ve yayına çıkış rehberi yalnız `http` adresi veren sertifikanın
  CRL denetiminin her zaman başarısız olacağını söyler; platformun CRL indiricisi dağıtım noktasındaki adresleri sırayla dener.
  iOS'ta da uygulama aktarım güvenliği `http` indirmesini engelleyebilir.
- Güven listesi alan adının sunucu bloğu her `http` isteğini `https`'e yönlendirir (HSTS ile birlikte); bu alan adında aynı dosyayı
  iki şemadan yönlendirmesiz sunmak bütün güven listesi alan adının kuralını gevşetmek demek olurdu.
- **Proje yönetiminin yönü:** gerekiyorsa yeni alt alan adı açmaktan kaçınılmaz; daha doğru yaklaşım seçilir.

# Karar

## K1 — Adres

| Ağ | Alan adı | Dosyalar |
|---|---|---|
| Gerçek ağ | `crl.tamga.network` | `/access-ca-1.crl`, `/root-ca.crl` |
| Sandbox | `crl.sandbox.tamga.network` | `/access-ca-1.crl`, `/root-ca.crl` |

Yol, alan adının kökünde `/<makam>.crl`'dir (küçük harf, rakam, tire). Makam adları [[ADR-0087]] K2'deki gibidir.

## K2 — İki şema, yönlendirme yok

- Alan adı aynı DER dosyasını `http` ve `https` üzerinden sunar; `http` isteği `https`'e yönlendirilmez, bu alan adında HSTS yoktur.
- Yanıt türü `application/pkix-crl`, herkese açık, CORS açık; alan adında CRL dışında hiçbir şey yayımlanmaz (kök ve bilinmeyen yol
  404).
- `https` tarafının TLS sertifikası Web PKI'dan gelir; Tamga'nın erişim sertifikası makamından ya da kökünden gelmez.
- İstek kaydı tutulmaz (iptal listesi çekimleri kimin hangi doğrulayıcıyı denetlediğini gösterebilir).

## K3 — Sertifikadaki dağıtım noktası

Her erişim sertifikası ve erişim sertifikası makamının sertifikası, tek dağıtım noktalı, kritik olmayan CRL Distribution Points
uzantısı taşır; `fullName` içinde iki adres, bu sırayla: `http://crl.<ağ>/<makam>.crl`, `https://crl.<ağ>/<makam>.crl`. `cRLIssuer`
ve `reasons` yoktur ([[ADR-0087]] K3'ün geri kalanı geçerli).

## K4 — Geçiş

- Gerçek ağda erişim sertifikası verilmediği için gerçek ağda geçiş yoktur; ilk sertifika bu kuralla verilir.
- Sandbox'ta dağıtım noktası taşıyan sertifika yalnız erişim sertifikası makamınınkidir; aynı anahtarla, yeni dağıtım noktasıyla
  yeniden verilir (sandbox erişim sertifikaları [[ADR-0087]]'den önce verildi, dağıtım noktası taşımaz; bundan sonra verilenler bu
  kuralla). Eski `trust.sandbox.tamga.network/crl/` yolu kaldırılır (geliştirme evresi: geriye uyum yok).
- Ayar kayıt defterindeki `roles.access_ca.crl.issuers[].uri` CRL'in `http` adresidir (`http://crl.<ağ>/<makam>.crl`); `https` eşi
  aynı alan adı ve yoldan türetilir, böylece iki ad hep aynı dosyayı gösterir. Yayıncının ayar denetimi şemanın `http`, alan adının
  güven listesi alan adına karşılık gelen CRL alan adı ve yolun alan adının kökünde `/<ad>.crl` olduğunu denetler.

# Değerlendirilen seçenekler

| Seçenek | Neden seçilmedi |
|---|---|
| Güven listesi alan adı altında, yalnız `https` (ADR-0087 K3) | EN 319 412-2 GEN-4.3.11-4'e uymaz; RFC 5280 §8 önermez. |
| Güven listesi alan adı altında, `http` için yönlendirme istisnası | Güven listesi alan adının HSTS ve yönlendirme kuralını gevşetir; HSTS'li alan adında `http` tarayıcılarda zaten yükseltilir. |
| Yalnız `http` | AB referans Android cüzdanı yalnız `http` gösteren sertifikada CRL'i indirmez. |
| OCSP | [[ADR-0087]]'de değerlendirildi: CRL seçildi; OCSP sonraki bir karar. |

# Değişmezler

| Kod | Kural |
|---|---|
| CH1 | Erişim sertifikası ve makam sertifikasındaki dağıtım noktası iki adres taşır: önce `http://crl.<ağ>/<makam>.crl`, sonra aynı yolun `https://` adresi. |
| CH2 | CRL alan adı iki şemada aynı dosyayı yönlendirmesiz sunar ve CRL dışında içerik yayımlamaz; `https` sertifikası Tamga PKI'ından gelmez. |

# Sonuçlar

- Yeni DNS kayıtları: `crl.tamga.network`, `crl.sandbox.tamga.network` (aynı sunucu).
- Liste yayıncısının ayar denetimi, PKI araçları (`--crl-uri` iki adres), operatör deposundaki sunucu ayarı ve [[SPEC-TRUST-0001]]
  §2 bu karara göre güncellenir; [[ADR-0087]] K3'e bu karara atıf düşülür.
- Tamga cüzdan çekirdeği ve doğrulayıcı için değişiklik yok: güveni imzalı listeden alırlar, CRL çekmezler ([[ADR-0087]] AR5).

# Durum

**Accepted — 2026-11-18.** DECISIONS: D-REG-6.
