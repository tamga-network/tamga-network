---
document_id: FW-DEF-0001
title: "Ek D — Tanımlar"
status: Active
version: 1.0.0
created: 2026-10-01
last_updated: 2026-11-16
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
| Belge türü | Bir belgenin alanlarını, görünen adlarını ve seçici açıklama politikasını tanımlayan, kalıcı kimliği olan tanım (`urn:tamga:…`). |
| Belge türü kataloğu | Belge türü tanımlarının ve şemalarının değişmez dosyalar olarak yayınlandığı yer (`schemas.tamga.network`). |
| Belge veren (Attestation Provider) | Belge veren kurum: üniversite, meslek kuruluşu, kamu kurumu, şirket. |
| Cihaz kanıtı | Telefonun işletim sisteminin, anahtarın cihazın güvenli bölgesinde üretildiğini ve uygulamanın değiştirilmediğini doğrulayan imzalı beyanı (Apple App Attest, Android key attestation). |
| Cüzdan | Kişinin belgelerini tutan ve gösteren uygulama. Ağın kurallarına uyan her cüzdan ağda kullanılabilir; Tamga Wallet ağın ilk cüzdanıdır. |
| Cüzdan birimi (Wallet unit) | Kişiye verilen cüzdanın belirli bir cihazdaki bütün yapılandırması: cüzdan örneği (uygulama) ile anahtarları koruyan güvenli donanım (WSCD) ve onu kullanan yazılım (WSCA) birlikte. Tamga'da güvenli donanım telefonun kendi güvenli bölgesidir; ayrı sertifikalı WSCA yoktur. |
| Cüzdan örneği (Wallet Instance) | Cihaza kurulu cüzdan uygulaması (web uygulaması da olabilir); cüzdan biriminin yazılım parçası. Cüzdan örneği kanıtı bu örnek için verilir. |
| Cüzdan örneği kanıtı (Wallet Instance Attestation, WIA) | Cüzdan sağlayıcısının bir cüzdan birimi için imzaladığı, en çok 24 saat geçerli beyan: cüzdan sürümü, anahtarın donanımda olduğu, PIN ya da biyometrinin etkin olduğu. Belge veren belgeyi vermeden önce denetler. |
| Cüzdan sağlayıcısı | Cüzdanı sunan, cüzdan birimlerini kaydeden ve cüzdan örneği kanıtı ile anahtar kanıtını imzalayan kuruluş. |
| Çapa günlüğü | İptal listesi yayınlarını ve belge türü tanım özetlerini saatlik imzalı kayıtlarla tutan, herkese açık günlük. |
| Defter aşaması | Güven kayıtlarının birden çok bağımsız işletmecinin tuttuğu ortak deftere taşındığı aşama. En az iki bağımsız işletmeci yazılı kabul verdiğinde başlar. |
| Doğrulama hattı | Doğrulayıcının bir gösterimi denetlediği sabit adımlar: ön koşul, yapı, tür, güven, durum, politika. Sonuç kabul, red ya da "şu an doğrulanamadı"dır. |
| Doğrulayıcı (Relying Party) | Cüzdandan belge isteyen ve doğrulayan kayıtlı kuruluş: işveren, web sitesi, kurum. |
| Doğrulayıcı örneği (Relying Party Instance) | Doğrulayıcının cüzdanla konuşan sistemi: sunucu, uygulama ya da okuyucu. AB'de her örneğe ayrı erişim sertifikası verilir; Tamga'da bugün doğrulayıcı başına tek erişim sertifikası vardır ve güven listesindeki kayıtla eşlenir. |
| Erişim sertifikası | Doğrulayıcının isteklerini imzaladığı X.509 sertifikası; istemci kimliği bu sertifikanın özetidir. |
| Erişim sertifikası makamı (Access CA) | Erişim sertifikalarını veren sertifika makamı; AB'de devletin yetkilendirdiği, güven çapası LoTE'de yayımlanan makam. Tamga'da ağın kökünce imzalanmış, yalnız doğrulayıcılara erişim sertifikası veren ara makam (`access-ca-1`) ve onun iptal listesi (CRL). Belge verenlere erişim sertifikası verilmez; kurumlar güven listesindeki belge imza sertifikasıyla tanınır. |
| Federasyon | Ülke güven listelerinin kendi sahipleri tarafından işletildiği ve listelerin listesinde bir araya getirildiği model. |
| Geçici işletmeci | Yönetişim kurumu kurulana kadar ağı ve ağın kendi hizmetlerini işleten tüzel kişi. Bugün bu rolü Tamga Network (kurulacak vakıf) adına bir geçici işletmeci üstlenir. Listelerde işletmeci adı "Tamga Network" yazılır (`status = "provisional"`). Vakıf kurulduğunda işletmecilik ona devredilir. |
| Geçiş kartı | Yakın alanda gösterimin kalıcı çözümü devreye girene kadar kullanılan, kısa ömürlü ve kapsamı sınırlı belge gösterimi. |
| Güven listesi | Bir ülkenin kök sertifikalarını, belge verenlerini ve kayıtlı doğrulayıcılarını taşıyan imzalı liste. AB'de "Trusted List" (ETSI TS 119 612) yalnız nitelikli güven hizmeti sağlayıcılarını taşır; Tamga'nın güven listesi daha geniştir: bütün türleri tek listede toplayan, LoTE'ye benzeyen birleşik bir listedir. |
| Güven listesi işletmecisi (Trusted List Scheme Operator) | Ulusal güven listesini derleyen, imzalayan ve yayınlayan kuruluş. Bugün Türkiye için Tamga, devlet adına geçici olarak. |
| Güvence seviyesi | Kişinin kimlik doğrulamasının (T), belge verenin akreditasyonunun (I) ve cüzdanın güvenliğinin (W) seviyesi. |
| Kayıt kurumu (Registrar) | Belge verenleri, doğrulayıcıları ve cüzdan sağlayıcılarını kaydeden kuruluş; yasal yetki vermez. |
| Kayıt sertifikası | Kayıt kurumunun bir doğrulayıcının her kullanımı için (belge verenlerde kurum başına) ürettiği, istenebilecek alanları ve amacı taşıyan imzalı belge (en çok 12 ay). |
| Kayıt sertifikası sağlayıcısı (Provider of registration certificates) | Kayıt sertifikalarını imzalayan kuruluş; AB'de devletin yetkilendirdiği, kayıt kurumuna bağlı ayrı bir rol. Tamga'da ayrı rol değildir: kayıt sertifikalarını kayıt kurumunun güven listesinde yayımlanan kayıt birimi anahtarı imzalar; iptalleri bir iptal listesindedir. |
| Kimlik belgesi (Tamga) | Kişi kimlik verisi sağlayıcısı yokken Tamga kimlik servisinin uzaktan kimlik doğrulamasıyla verdiği geçici kimlik belgesi. PID değildir. |
| Kişi kimlik verisi (PID) | Devletin en yüksek güvence seviyesinde verdiği kişi kimlik verisi. Tamga bu rolü üstlenmez. |
| Kopya | Aynı belgenin ayrı anahtarlara bağlı örneklerinden biri; cüzdan her doğrulayıcıya ayrı kopya gösterir. |
| Liste aşaması | Güvenin imzalı güven listelerine ve çapa günlüğüne dayandığı bugünkü aşama. |
| Mantıksal belge / teknik belge (Logical / technical attestation) | Kişinin cüzdanda tek belge olarak gördüğü kayıt mantıksal belgedir; onun cüzdanda tutulan, ayrı anahtarlara bağlı ve farklı biçimlerdeki (SD-JWT VC, mdoc) örnekleri teknik belgelerdir. Tamga'da teknik belgeye "kopya" denir. |
| Listelerin listesi (LoTL) | Ülke güven listelerinin adreslerini, imzacılarını ve tanınma durumlarını gösteren imzalı liste. |
| LoTE (List of Trusted Entities) | ETSI TS 119 602'ye göre belirli türdeki güvenilen kuruluşların (cüzdan sağlayıcıları, kişi kimlik verisi sağlayıcıları, erişim sertifikası makamları, kayıt sertifikası sağlayıcıları) imzalı listesi; AB'de tür başına ayrı liste vardır ve Komisyon yayımlar. Tamga'da bütün türler tek ülke güven listesindedir; aynı kaynaktan bir LoTE görünümü de yayımlanır. |
| Ortak defter | Güven kayıtlarının birden çok bağımsız işletmeci tarafından tutulduğu defter (blokzincir). Defter aşamasında kurulur. |
| Seçici açıklama (Selective disclosure) | Kişinin bir belgeden yalnızca istenen alanları göstermesi. Eşanlamlı: seçici paylaşım. |
| Sıfır bilgi ispatı | Bir bilginin doğru olduğunu, bilginin kendisini göstermeden kanıtlayan ispat; örneğin doğum tarihini göstermeden "18 yaşından büyüğüm". |
| Şema sahibi (Attestation Scheme Provider) | Bir belge türünün kural kitabını ve makine okunur şemasını yazan, yayımlayan ve sürdüren kuruluş. Tamga'da ağ düzeyindeki belge türleri için ağ, ulusal belge türleri için o türün devleti. |
| Takma ad | Cüzdanın her web sitesi için ayrı ürettiği, kararlı ama siteler arasında eşleştirilemeyen hesap kimliği. |
| Takma ad tohumu | Kimlik servisinin kişinin kimliğinden saklamadan türettiği ve yalnızca cüzdanda kalan gizli değer; takma adlar bundan türetilir. Gösterilemeyen ayrı bir belge türüyle verilir. |
| Tamga Network | Bu çerçevenin tanımladığı güven ağı: kurallar, güven listeleri, belge türü kataloğu ve açık kaynak paketler. Ağ bir ürün satmaz. |
| Tamga Verify | Ağın barındırılan doğrulayıcısı (aracı doğrulayıcı). |
| Tamga Wallet | Ağın ilk cüzdanı; ayrı bir üründür ve açık kaynak lisansıyla (EUPL-1.2) geliştirilir. Ağın kurallarına her cüzdan gibi uyar. |
| Yetkili kaynak | Belgedeki bilginin asıl sahibi olan sistem; örneğin üniversitenin öğrenci bilgi sistemi. |
| Yönetişim kurumu | Devletler katıldığında kurulan konsey ya da vakıf; listeleri ve ağ kurallarını yönetir. |

**Terim notu — doğrulayıcı.** Tamga'da "doğrulayıcı (verifier)" AB'deki "Relying Party" demektir. AB ARF'sinde "Verifier"
yalnız cüzdandan cüzdana etkileşimde başka bir kişiden belge isteyen kişidir; AB metniyle yan yana okurken bu fark gözetilmelidir.

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
| LoTE | List of Trusted Entities — güvenilen kuruluşlar listesi |
| LoTL | List of Trusted Lists — listelerin listesi |
| mdoc | ISO/IEC 18013-5 mobil belge biçimi |
| PID | Person Identification Data — kişi kimlik verisi |
| RP | Relying Party — doğrulayıcı |
| SD-JWT VC | Selective Disclosure JWT Verifiable Credential |
| TDT | Türk Devletleri Teşkilatı |
| WIA | Wallet Instance Attestation — cüzdan örneği kanıtı |
| WRPAC / WRPRC | Doğrulayıcı erişim sertifikası / kayıt sertifikası |
| WSCD | Wallet Secure Cryptographic Device — cüzdanın güvenli kriptografik donanımı |

# Durum

**Yürürlükte** — sürüm 1.0.0 (2026-10-16).
