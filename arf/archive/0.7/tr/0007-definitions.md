---
document_id: FW-DEF-0001
title: Ek D — Tanımlar
category: Framework
domain: Architecture
status: Active
review_status: Completed
version: 0.1.0
created: 2026-10-01
last_updated: 2026-10-01
authors:
  - Tamga Network Engineering
language: tr
document_type: framework
audience:
  - institutions
  - regulators
  - integrators
  - engineers
tags:
  - framework
  - arf
  - glossary
related:
  - FW-ARF-0001
  - FW-REF-0001
depends_on:
  - FW-ARF-0001
summary: >
  Tamga ARF'de kullanılan terimlerin ve kısaltmaların tanımları. AB ARF'sinin tanımlar ekinin karşılığıdır; AB adı ile
  Tamga'daki karşılığı birlikte verilir.
priority: High
---

# 1. Terimler

| Terim | Tanım |
|---|---|
| Aracı doğrulayıcı (Intermediary) | Bir doğrulayıcı adına cüzdandan belge isteyen ve doğrulayan hizmet. Cüzdan, asıl doğrulayıcının adını gösterir. Tamga'da Tamga Verify. |
| Belge (elektronik öznitelik belgesi, EAA) | Bir belge verenin kişi hakkında imzaladığı ve kişinin cüzdanında taşınan belge: öğrenci belgesi, diploma, bilet gibi. |
| Belge sahibi (Holder) | Belgeyi cüzdanında taşıyan ve kime göstereceğine karar veren kişi. |
| Belge türü | Bir belgenin alanlarını, görünen adlarını ve seçici açıklama politikasını tanımlayan, kalıcı kimliği olan tanım (`urn:tamga:…`). |
| Belge türü kataloğu | Belge türü tanımlarının ve şemalarının değişmez dosyalar olarak yayınlandığı yer (`schemas.tamga.network`). |
| Belge veren (Attestation Provider) | Belge veren kurum: üniversite, meslek kuruluşu, kamu kurumu, şirket. |
| Bilinen kısayol | Pilot öncesinde geçici bir yolla çalışan işlev; listesi ve kapanış koşulu tamga.network'te yayınlanır. |
| Cihaz kanıtı | Telefonun işletim sisteminin, anahtarın cihazın güvenli bölgesinde üretildiğini ve uygulamanın değiştirilmediğini doğrulayan imzalı beyanı (Apple App Attest, Android anahtar kanıtı). |
| Cüzdan | Kişinin belgelerini tutan ve gösteren uygulama. Tamga Wallet, Tamga'nın AB uyumlu cüzdanıdır. |
| Cüzdan birimi | Bir cüzdanın belirli bir cihazdaki kurulumu. |
| Cüzdan kanıtı (WIA) ve anahtar kanıtı (KA) | Cüzdan sağlayıcısının cüzdan birimi ve belge anahtarları için imzaladığı kısa ömürlü beyanlar; belge veren ihraçtan önce denetler. |
| Cüzdan sağlayıcısı (Wallet Provider) | Cüzdanı sunan ve cüzdan kanıtlarını imzalayan kuruluş. |
| Çapa günlüğü | İptal listesi yayınlarını ve belge türü tanım özetlerini saatlik imzalı kayıtlarla tutan, herkese açık günlük. |
| Doğrulama hattı | Doğrulayıcının bir sunumu denetlediği sabit adımlar: ön koşul, yapı, tür, güven, durum, politika. Sonuç kabul, red ya da "şu an doğrulanamadı"dır. |
| Doğrulayıcı (Relying Party) | Cüzdandan belge isteyen ve doğrulayan kayıtlı kuruluş: işveren, web sitesi, kurum. |
| Erişim sertifikası | Doğrulayıcının isteklerini imzaladığı X.509 sertifikası; istemci kimliği bu sertifikanın özetidir. |
| Federasyon | Ülke güven listelerinin kendi sahipleri tarafından işletildiği ve listelerin listesinde bir araya getirildiği model. |
| Geçiş kartı | Yakın alan gösterme kalıcı çözümü devreye girene kadar kullanılan, kısa ömürlü ve kapsamı sınırlı belge sunumu. |
| Güven listesi | Bir ülkenin kök sertifikalarını, belge verenlerini ve kayıtlı doğrulayıcılarını taşıyan imzalı liste. |
| Güven listesi işletmecisi (Trusted List Scheme Operator) | Ulusal güven listesini derleyen, imzalayan ve yayınlayan kuruluş. Bugün Türkiye için Tamga, devlet adına geçici olarak. |
| Güvence seviyesi | Kişinin kimlik ispatının (T), belge verenin akreditasyonunun (I) ve cüzdanın güvenliğinin (W) seviyesi. |
| Kayıt kurumu (Registrar) | Belge verenleri, doğrulayıcıları ve cüzdan sağlayıcılarını kaydeden kuruluş; yasal yetki vermez. |
| Kayıt sertifikası | Kayıt kurumunun bir doğrulayıcının her kullanımı için ürettiği, istenebilecek alanları ve amacı taşıyan imzalı belge (en çok 12 ay). |
| Kimlik belgesi (Tamga) | Kişi kimlik verisi sağlayıcısı yokken Tamga kimlik servisinin uzaktan kimlik doğrulamasıyla verdiği geçici kimlik belgesi. PID değildir. |
| Kişi kimlik verisi (PID) | Devletin en yüksek güvence seviyesinde verdiği kişi kimlik verisi. Tamga bu rolü üstlenmez. |
| Kopya | Aynı belgenin ayrı anahtarlara bağlı örneklerinden biri; cüzdan her doğrulayıcıya ayrı kopya gösterir. |
| Listelerin listesi (LoTL) | Ülke güven listelerinin adreslerini, imzacılarını ve tanınma durumlarını gösteren imzalı liste. |
| Ortak defter | Güven kayıtlarının birden çok bağımsız işletmeci tarafından tutulduğu zincir. En az iki bağımsız işletmeci olduğunda kurulur. |
| Seçici açıklama | Kişinin bir belgeden yalnız istenen alanları göstermesi. |
| Sıfır bilgi ispatı | Bir bilginin doğru olduğunu, bilginin kendisini göstermeden kanıtlayan ispat; örneğin doğum tarihini göstermeden "18 yaşından büyüğüm". |
| Takma ad | Cüzdanın her web sitesi için ayrı ürettiği, kararlı ama siteler arasında eşleştirilemeyen hesap kimliği. |
| Takma ad tohumu | Kimlik servisinin kişinin kimliğinden saklamadan türettiği ve yalnız cüzdanda kalan gizli değer; takma adlar bundan türetilir. |
| Tamga Verify | Tamga'nın barındırılan doğrulayıcısı (aracı doğrulayıcı). |
| Yetkili kaynak (Authentic Source) | Belgedeki bilginin asıl sahibi olan sistem; örneğin üniversitenin öğrenci bilgi sistemi. |
| Yönetişim kurumu | Devletler katıldığında kurulan konsey ya da vakıf; listeleri ve ağ kurallarını yönetir. |

# 2. Kısaltmalar

| Kısaltma | Açılım |
|---|---|
| ARF | Architecture and Reference Framework — Mimari ve Referans Çerçevesi |
| DCQL | Digital Credentials Query Language |
| EAA | Electronic Attestation of Attributes — elektronik öznitelik belgesi |
| EUDI | European Digital Identity — Avrupa Dijital Kimliği |
| HAIP | OpenID4VC High Assurance Interoperability Profile |
| KA | Key Attestation — anahtar kanıtı |
| KVKK | 6698 sayılı Kişisel Verilerin Korunması Kanunu |
| LoTL | List of Trusted Lists — listelerin listesi |
| mdoc | ISO/IEC 18013-5 mobil belge biçimi |
| PID | Person Identification Data — kişi kimlik verisi |
| SD-JWT VC | Selective Disclosure JWT Verifiable Credential |
| TDT | Türk Devletleri Teşkilatı |
| WIA | Wallet Instance Attestation — cüzdan kanıtı |
| WRPAC / WRPRC | Doğrulayıcı erişim sertifikası / kayıt sertifikası |

# CHANGELOG

- **0.1.0 (2026-10-01)** — İlk sürüm; ana belgedeki tanımlar ayrı eke taşındı.

# Durum

**Active** — Tamga ARF 0.7 ile yayınlandı.
