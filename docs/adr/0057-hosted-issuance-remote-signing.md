---
document_id: ADR-0057
title: "Barındırılan belge vermede kurumun imza anahtarı: uzaktan imza (CSC API)"
status: Proposed
version: 1.0.0
created: 2026-10-20
last_updated: 2026-10-20
summary: >
  Barındırılan belge verme servisini kullanan kurumun belge ve iptal listesi imza anahtarları kurumda kalır: anahtar kurumun
  HSM'inde ya da kurumun seçtiği güven hizmeti sağlayıcısında durur ve servis imzayı Cloud Signature Consortium API v2
  (`signatures/signHash`) ile ister. Servise yalnız imzalanacak verinin SHA-256 özeti gider; belge içeriği ve kişisel veri
  gitmez. Gelen imza kurumun güven listesindeki sertifikasıyla yerelde doğrulanır. Gerçek ağda kurum anahtarı dosyadan
  okunmaz (PM-GOV G1, sapma S-1). Öneri — proje yönetimi onayı bekler.
domain: Identity
related: ["[[ADR-0016]]", "[[ADR-0020]]", "[[ADR-0050]]", "[[SPEC-ID-0002]]", "[[SPEC-PROTO-0001]]"]
---

# Bağlam

- Barındırılan belge verme servisi ([[ADR-0016]]) belgeleri kurum adına ve **kurumun anahtarıyla** imzalar. Proje kuralı açıktır:
  barındırılan hizmetlerde imza anahtarı hiçbir zaman ağın işletmecisinde durmaz (PM-GOV G1). Bugün sandbox kurumlarının
  anahtarları test anahtarıdır ve sunucuda dosya olarak durur (sapma S-1); gerçek ağda henüz kurum yoktur.
- Kurum katılım rehberleri "anahtarlar kurumun KMS/HSM'sinde üretilir, yalnız sertifika isteği (CSR) gönderilir" der. Ancak
  servisin bu anahtarı kullanmasının bir yolu tanımlı değildi: kod yalnız dosya anahtarını okuyordu. İlk kurum için bu bir
  engeldir.
- Kurum kendi belge verme servisini de işletebilir (`@tamga-network/issuer`); bu yol anahtarı zaten kurumda tutar ama
  OpenID4VCI sunucusu kurmayı gerektirir. Barındırılan yolun da anahtarı kurumda tutması gerekir.
- AB'de uzaktan imza ve mühür için yerleşik arayüz Cloud Signature Consortium API'dir (CSC API v2; ETSI TS 119 432 ile
  hizalı). Nitelikli güven hizmeti sağlayıcıları ve HSM ürünleri bu arayüzü sunar.

# Önerilen karar

## K1 — Kurumun anahtarı kurumda, imza uzaktan

Barındırılan serviste kurumun belge imza anahtarı ve iptal listesi imza anahtarı ([[ADR-0050]] K1) kurumun HSM'inde ya da
kurumun sözleşme yaptığı güven hizmeti sağlayıcısında üretilir ve orada kalır. Servis imzayı **CSC API v2** ile ister:

1. OAuth 2.0 istemci kimliğiyle erişim belirteci (`client_credentials`, `scope=service`);
2. `credentials/authorize` — tek imza için yetki (SAD), imzalanacak özete bağlı;
3. `signatures/signHash` — `hashAlgorithmOID` SHA-256 (2.16.840.1.101.3.4.2.1), `signAlgo` ecdsa-with-SHA256
   (1.2.840.10045.4.3.2).

Anahtar P-256 kalır ([[SPEC-ID-0002]]); sertifika kurumun CSR'ı üzerine kök sertifika makamınca verilir ve güven listesine
girer (değişmedi).

## K2 — Servise yalnız özet gider

Servis, imzalanacak verinin (JWS imza girdisi ya da COSE yapısı) yalnız SHA-256 özetini gönderir. Belge içeriği, kişisel veri
ve kişinin anahtarı uzaktan imza hizmetine gitmez; hizmet hangi kişiye belge verildiğini öğrenmez.

## K3 — Gelen imza yerelde doğrulanır

Servis her imzayı, kurumun güven listesindeki sertifikasının açık anahtarıyla doğrular. Doğrulanmayan imza (yanlış anahtar,
bozuk yanıt) kullanılmaz; belge verilmez. Hizmete ulaşılamazsa belge verilmez, kişi sonra yeniden dener (kaynağa ulaşılamaması
gibi, [[ADR-0020]]).

## K4 — Gerçek ağda dosya anahtarı yok

Gerçek ağda kurum anahtarı servis sunucusunda dosyadan okunmaz; yapılandırma bunu reddeder ve kurum açılmaz. Dosya anahtarı
yalnız yerel geliştirme, testler ve sandbox içindir (sandbox test anahtarları, [[ADR-0038]]).

## K5 — Sırlar ve sınırlar

Uzaktan imza hizmetinin istemci sırrı (ve hizmet istiyorsa imza PIN'i) servis sunucusunun gizli ortamındadır; kiracı
dosyasına ve depoya yazılmaz. Hizmet adresleri yalnız HTTPS. Kurum imza yetkisini dilediği an geri alabilir (hizmetteki
istemci kimliğini kapatarak); bu, servisin o kurum adına belge vermesini hemen durdurur.

# Gerekçe / alternatifler

| Seçenek | Sonuç | Neden |
|---|---|---|
| Kurumun anahtarını servis sunucusunda dosya olarak tutmak | ret | PM-GOV G1 |
| Bulut sağlayıcısına özgü anahtar hizmeti (tek sağlayıcı) | ret (tek başına) | Kurumu bir sağlayıcıya bağlar; CSC arayüzü sağlayıcıdan bağımsız |
| Kurumun işlettiği, Tamga'ya özgü bir imza ucu | ret | Yeni, standart dışı bir sözleşme olurdu; CSC zaten var |
| **CSC API v2 ile uzaktan imza (yalnız özet)** | **öneri** | AB'deki yerleşik arayüz; nitelikli sınıfa geçişte de aynı yol |
| Kurum kendi belge verme servisini işletir | korunur | İkinci yol olarak kalır ([[ADR-0016]]) |

# Önerilen kurallar (kabul edilirse bağlayıcı tabloya taşınır)

| Kod | Kural |
|---|---|
| RS1 | Barındırılan serviste kurumun belge ve iptal listesi imza anahtarı kurumda ya da kurumun güven hizmeti sağlayıcısında kalır; servis imzayı CSC API v2 ile ister. |
| RS2 | Uzaktan imza hizmetine yalnız imzalanacak verinin SHA-256 özeti gider; belge içeriği ve kişisel veri gitmez. |
| RS3 | Servis her uzaktan imzayı kurumun güven listesindeki sertifikasıyla doğrular; doğrulanmayan imzayla belge verilmez. |
| RS4 | Gerçek ağda kurum anahtarı servis sunucusunda dosyadan okunmaz. |

# Kararı bekleyen sorular (proje yönetimi)

1. CSC API v2'nin barındırılan servis için tek uzaktan imza arayüzü olarak kabulü.
2. İlk kurum için hangi uzaktan imza hizmeti (kurumun kendi HSM'i ya da bir güven hizmeti sağlayıcısı) — kurumla birlikte.
3. İmza başına bir istek yerine bir belgenin kopyalarını tek istekte imzalamak (CSC çoklu özet) — hız gerekirse.

# Durum

**Öneri — 2026-10-20.** Proje yönetimi onayını bekler. Uygulama hazırdır ve testlidir (barındırılan serviste `csc:` anahtar
referansı); gerçek ağda dosya anahtarı reddi PM-GOV G1'in kendisidir ve bu karardan bağımsız olarak uygulanır.
