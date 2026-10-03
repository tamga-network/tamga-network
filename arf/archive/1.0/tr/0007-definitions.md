---
document_id: FW-DEF-0001
title: "Ek D — Tanımlar"
status: Active
version: 1.0.0
created: 2026-10-01
last_updated: 2026-10-02
summary: >
  Tamga ARF'de kullanılan terimlerin ve kısaltmaların tanımları. AB ARF'sinin tanımlar ekinin karşılığıdır; AB adı ile
  Tamga'daki karşılığı birlikte verilir.
---

# 1. Terimler

| Terim | Tanım |
|---|---|
| Anahtar kanıtı (Key Attestation, KA) | Cüzdan sağlayıcısının, belgenin bağlanacağı anahtarların cihazın güvenli donanımında üretildiğini ve korunduğunu beyan eden kısa ömürlü imzalı belgesi; belge veren belgeyi vermeden önce denetler. |
| Aracı doğrulayıcı (Intermediary) | Bir doğrulayıcı adına cüzdandan belge isteyen ve doğrulayan hizmet. Cüzdan, asıl doğrulayıcının adını gösterir. Tamga'da Tamga Verify. |
| Belge (elektronik öznitelik belgesi, EAA) | Bir belge verenin kişi hakkında imzaladığı ve kişinin cüzdanında taşınan belge: öğrenci belgesi, diploma, bilet gibi. |
| Belge sahibi (Holder) | Belgeyi cüzdanında taşıyan ve kime göstereceğine karar veren kişi. |
| Belge türü | Bir belgenin alanlarını, görünen adlarını ve seçici paylaşım politikasını tanımlayan, kalıcı kimliği olan tanım (`urn:tamga:…`). |
| Belge türü kataloğu | Belge türü tanımlarının ve şemalarının değişmez dosyalar olarak yayınlandığı yer (`schemas.tamga.network`). |
| Belge veren (Attestation Provider) | Belge veren kurum: üniversite, meslek kuruluşu, kamu kurumu, şirket. |
| Cihaz kanıtı | Telefonun işletim sisteminin, anahtarın cihazın güvenli bölgesinde üretildiğini ve uygulamanın değiştirilmediğini doğrulayan imzalı beyanı (Apple App Attest, Android key attestation). |
| Cüzdan | Kişinin belgelerini tutan ve gösteren uygulama. Ağın kurallarına uyan her cüzdan ağda kullanılabilir; Tamga Wallet ağın ilk cüzdanıdır. |
| Cüzdan birimi (Wallet unit) | Bir cüzdanın belirli bir cihazdaki kurulumu. |
| Cüzdan örneği kanıtı (Wallet Instance Attestation, WIA) | Cüzdan sağlayıcısının bir cüzdan birimi için imzaladığı, en çok 24 saat geçerli beyan: cüzdan sürümü, anahtarın donanımda olduğu, PIN ya da biyometrinin etkin olduğu. Belge veren belgeyi vermeden önce denetler. |
| Cüzdan sağlayıcısı | Cüzdanı sunan, cüzdan birimlerini kaydeden ve cüzdan örneği kanıtı ile anahtar kanıtını imzalayan kuruluş. |
| Çapa günlüğü | İptal listesi yayınlarını ve belge türü tanım özetlerini saatlik imzalı kayıtlarla tutan, herkese açık günlük. |
| Defter aşaması | Güven kayıtlarının birden çok bağımsız işletmecinin tuttuğu ortak deftere taşındığı aşama. En az iki bağımsız işletmeci yazılı kabul verdiğinde başlar. |
| Doğrulama hattı | Doğrulayıcının bir gösterimi denetlediği sabit adımlar: ön koşul, yapı, tür, güven, durum, politika. Sonuç kabul, red ya da "şu an doğrulanamadı"dır. |
| Doğrulayıcı (Relying Party) | Cüzdandan belge isteyen ve doğrulayan kayıtlı kuruluş: işveren, web sitesi, kurum. |
| Erişim sertifikası | Doğrulayıcının isteklerini imzaladığı X.509 sertifikası; istemci kimliği bu sertifikanın özetidir. |
| Federasyon | Ülke güven listelerinin kendi sahipleri tarafından işletildiği ve listelerin listesinde bir araya getirildiği model. |
| Geçici işletmeci | Yönetişim kurumu kurulana kadar ağı işleten kuruluş: bugün Tamga. Vakıf kurulduğunda işletmecilik ona devredilir. |
| Geçiş kartı | Yakın alanda gösterimin kalıcı çözümü devreye girene kadar kullanılan, kısa ömürlü ve kapsamı sınırlı belge gösterimi. |
| Güven listesi | Bir ülkenin kök sertifikalarını, belge verenlerini ve kayıtlı doğrulayıcılarını taşıyan imzalı liste. |
| Güven listesi işletmecisi (Trusted List Scheme Operator) | Ulusal güven listesini derleyen, imzalayan ve yayınlayan kuruluş. Bugün Türkiye için Tamga, devlet adına geçici olarak. |
| Güvence seviyesi | Kişinin kimlik doğrulamasının (T), belge verenin akreditasyonunun (I) ve cüzdanın güvenliğinin (W) seviyesi. |
| Kayıt kurumu (Registrar) | Belge verenleri, doğrulayıcıları ve cüzdan sağlayıcılarını kaydeden kuruluş; yasal yetki vermez. |
| Kayıt sertifikası | Kayıt kurumunun bir doğrulayıcının her kullanımı için (belge verenlerde kurum başına) ürettiği, istenebilecek alanları ve amacı taşıyan imzalı belge (en çok 12 ay). |
| Kimlik belgesi (Tamga) | Kişi kimlik verisi sağlayıcısı yokken Tamga kimlik servisinin uzaktan kimlik doğrulamasıyla verdiği geçici kimlik belgesi. PID değildir. |
| Kişi kimlik verisi (PID) | Devletin en yüksek güvence seviyesinde verdiği kişi kimlik verisi. Tamga bu rolü üstlenmez. |
| Kopya | Aynı belgenin ayrı anahtarlara bağlı örneklerinden biri; cüzdan her doğrulayıcıya ayrı kopya gösterir. |
| Liste aşaması | Güvenin imzalı güven listelerine ve çapa günlüğüne dayandığı bugünkü aşama. |
| Listelerin listesi (LoTL) | Ülke güven listelerinin adreslerini, imzacılarını ve tanınma durumlarını gösteren imzalı liste. |
| Ortak defter | Güven kayıtlarının birden çok bağımsız işletmeci tarafından tutulduğu defter (blokzincir). Defter aşamasında kurulur. |
| Seçici paylaşım (Selective disclosure) | Kişinin bir belgeden yalnızca istenen alanları göstermesi. |
| Sıfır bilgi ispatı | Bir bilginin doğru olduğunu, bilginin kendisini göstermeden kanıtlayan ispat; örneğin doğum tarihini göstermeden "18 yaşından büyüğüm". |
| Takma ad | Cüzdanın her web sitesi için ayrı ürettiği, kararlı ama siteler arasında eşleştirilemeyen hesap kimliği. |
| Takma ad tohumu | Kimlik servisinin kişinin kimliğinden saklamadan türettiği ve yalnızca cüzdanda kalan gizli değer; takma adlar bundan türetilir. Gösterilemeyen ayrı bir belge türüyle verilir. |
| Tamga Network | Bu çerçevenin tanımladığı güven ağı: kurallar, güven listeleri, belge türü kataloğu ve açık kaynak paketler. Ağ bir ürün satmaz. |
| Tamga Verify | Ağın barındırılan doğrulayıcısı (aracı doğrulayıcı). |
| Tamga Wallet | Ağın ilk cüzdanı; ayrı bir ürün ve açık kaynaktır. Ağın kurallarına her cüzdan gibi uyar. |
| Yetkili kaynak | Belgedeki bilginin asıl sahibi olan sistem; örneğin üniversitenin öğrenci bilgi sistemi. |
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
| WIA | Wallet Instance Attestation — cüzdan örneği kanıtı |
| WRPAC / WRPRC | Doğrulayıcı erişim sertifikası / kayıt sertifikası |
| WSCD | Wallet Secure Cryptographic Device — cüzdanın güvenli kriptografik donanımı |

# Durum

**Yürürlükte** — sürüm 1.0.0 (2026-10-02).
